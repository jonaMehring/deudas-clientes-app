// server/src/routes/clientesCc.js
import { Router } from "express";
import prisma from "../db.js";

const router = Router();

// Normaliza montos (similar a otros módulos)
function toAmount(a) {
  if (!a) return 0;
  return Number(
    String(a)
      .replace(/[^\d.,-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

// ---------------------------- LISTAR CLIENTES ----------------------------
router.get("/", async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
    });

    res.json(customers);
  } catch (e) {
    console.error("Error al listar clientes CC:", e);
    res.status(500).json({
      error: "Error al cargar clientes",
      details: e.message,
    });
  }
});

// ---------------------------- CREAR CLIENTE ----------------------------
router.post("/", async (req, res) => {
  try {
    const { name, address, phone, city } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio." });
    }

    const customer = await prisma.customer.create({
      data: {
        name: String(name).trim(),
        address: address ? String(address).trim() : null,
        phone: phone ? String(phone).trim() : null,
        city: city ? String(city).trim() : null,
        currentAccountBalance: 0,
      },
    });

    res.json(customer);
  } catch (e) {
    console.error("Error al crear cliente CC:", e);
    res.status(500).json({
      error: "Error al crear cliente",
      details: e.message,
    });
  }
});

// ---------------------------- HISTORIAL POR CLIENTE ----------------------------
router.get("/:id/movimientos", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const movimientos = await prisma.customerMovement.findMany({
      where: { customerId: id },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });

    res.json(movimientos);
  } catch (e) {
    console.error("Error al listar movimientos de cliente:", e);
    res.status(500).json({
      error: "Error al cargar movimientos",
      details: e.message,
    });
  }
});

// ---------------------------- REGISTRAR DEUDA ----------------------------
router.post("/:id/deuda", async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const { amount, date, description } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ error: "ID de cliente inválido." });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    const monto = toAmount(amount);
    if (!(monto > 0)) {
      return res.status(400).json({ error: "Monto de deuda inválido." });
    }

    const fecha = date ? new Date(date) : new Date();
    const desc = description || "Deuda registrada";

    const result = await prisma.$transaction(async (tx) => {
      const mov = await tx.customerMovement.create({
        data: {
          customerId,
          type: "DEBIT", // aumenta deuda
          amount: monto,
          date: fecha,
          method: "DEUDA",
          description: desc,
        },
      });

      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          currentAccountBalance: {
            increment: monto,
          },
        },
      });

      return { mov, balance: updated.currentAccountBalance };
    });

    res.json(result);
  } catch (e) {
    console.error("Error al registrar deuda:", e);
    res.status(500).json({
      error: "Error al registrar deuda",
      details: e.message,
    });
  }
});

// ---------------------------- REGISTRAR PAGO ----------------------------
router.post("/:id/pago", async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const { efectivo, transferencia, date, description } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ error: "ID de cliente inválido." });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    const montoEf = toAmount(efectivo);
    const montoTr = toAmount(transferencia);
    const total = (montoEf || 0) + (montoTr || 0);

    if (!(total > 0)) {
      return res
        .status(400)
        .json({ error: "El pago debe tener un monto mayor a cero." });
    }

    const saldoActual = Number(customer.currentAccountBalance || 0);
    if (saldoActual > 0 && total > saldoActual + 0.01) {
      return res.status(400).json({
        error: "El pago supera la deuda actual del cliente.",
      });
    }

    const fecha = date ? new Date(date) : new Date();

    let method = "EFECTIVO";
    if (montoEf > 0 && montoTr > 0) {
      method = "MIXTO";
    } else if (montoTr > 0 && !montoEf) {
      method = "TRANSFERENCIA";
    }

    const breakdown = [];
    if (montoEf > 0) breakdown.push(`Efectivo $${montoEf.toFixed(2)}`);
    if (montoTr > 0) breakdown.push(`Transferencia $${montoTr.toFixed(2)}`);

    const desc =
      description ||
      `Pago recibido (${breakdown.join(" + ") || "sin detalle"})`;

    const result = await prisma.$transaction(async (tx) => {
      const mov = await tx.customerMovement.create({
        data: {
          customerId,
          type: "CREDIT", // reduce deuda
          amount: total,
          date: fecha,
          method,
          description: desc,
        },
      });

      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          currentAccountBalance: {
            decrement: total,
          },
        },
      });

      return { mov, balance: updated.currentAccountBalance };
    });

    res.json(result);
  } catch (e) {
    console.error("Error al registrar pago de cliente:", e);
    res.status(500).json({
      error: "Error al registrar pago",
      details: e.message,
    });
  }
});

// ---------------------------- EDITAR MOVIMIENTO ----------------------------
router.put("/movimientos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const old = await prisma.customerMovement.findUnique({
      where: { id },
    });

    if (!old) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: old.customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const body = req.body || {};
    const fecha = body.date ? new Date(body.date) : old.date;
    const desc = body.description ?? old.description;

    let newAmount = old.amount;
    let method = old.method;

    if (old.type === "DEBIT") {
      // editar deuda
      newAmount = toAmount(body.amount ?? old.amount);
      if (!(newAmount > 0)) {
        return res.status(400).json({ error: "Monto de deuda inválido." });
      }
    } else {
      // editar pago (CREDIT)
      const montoEf = toAmount(body.efectivo);
      const montoTr = toAmount(body.transferencia);
      const total = (montoEf || 0) + (montoTr || 0);

      if (total > 0) {
        newAmount = total;

        method = "EFECTIVO";
        if (montoEf > 0 && montoTr > 0) method = "MIXTO";
        else if (montoTr > 0 && !montoEf) method = "TRANSFERENCIA";
      } else {
        // si no viene desglose, permitir editar solo amount
        newAmount = toAmount(body.amount ?? old.amount);
      }

      if (!(newAmount > 0)) {
        return res.status(400).json({ error: "Monto de pago inválido." });
      }
    }

    const diff = Number(newAmount) - Number(old.amount);

    await prisma.$transaction(async (tx) => {
      // actualizar movimiento
      await tx.customerMovement.update({
        where: { id },
        data: {
          amount: newAmount,
          date: fecha,
          description: desc,
          method,
        },
      });

      // ajustar saldo según tipo y diferencia
      if (diff !== 0) {
        if (old.type === "DEBIT") {
          // deuda: saldo += amount
          if (diff > 0) {
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                currentAccountBalance: {
                  increment: diff,
                },
              },
            });
          } else {
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                currentAccountBalance: {
                  decrement: -diff,
                },
              },
            });
          }
        } else {
          // pago (CREDIT): saldo -= amount
          if (diff > 0) {
            // pago mayor → baja más el saldo
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                currentAccountBalance: {
                  decrement: diff,
                },
              },
            });
          } else {
            // pago menor → sube el saldo
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                currentAccountBalance: {
                  increment: -diff,
                },
              },
            });
          }
        }
      }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("Error al editar movimiento:", e);
    res.status(500).json({
      error: "Error al editar movimiento",
      details: e.message,
    });
  }
});

// ---------------------------- ELIMINAR MOVIMIENTO ----------------------------
router.delete("/movimientos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const mov = await prisma.customerMovement.findUnique({
      where: { id },
    });

    if (!mov) {
      return res.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      // revertir impacto en el saldo
      if (mov.type === "DEBIT") {
        // se había incrementado → ahora decrementa
        await tx.customer.update({
          where: { id: mov.customerId },
          data: {
            currentAccountBalance: {
              decrement: mov.amount,
            },
          },
        });
      } else {
        // pago: se había decrementado → ahora incrementa
        await tx.customer.update({
          where: { id: mov.customerId },
          data: {
            currentAccountBalance: {
              increment: mov.amount,
            },
          },
        });
      }

      await tx.customerMovement.delete({
        where: { id },
      });
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("Error al eliminar movimiento:", e);
    res.status(500).json({
      error: "Error al eliminar movimiento",
      details: e.message,
    });
  }
});

export default router;
