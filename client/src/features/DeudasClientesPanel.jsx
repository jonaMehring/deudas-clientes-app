// client/src/features/DeudasClientesPanel.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function DeudasClientesPanel() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [movimientos, setMovimientos] = useState([]);

  const [newClient, setNewClient] = useState({
    name: "",
    address: "",
    phone: "",
    city: "",
  });

  const [debtForm, setDebtForm] = useState({
    amount: "",
    date: hoyISO(),
    description: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    efectivo: "",
    transferencia: "",
    date: hoyISO(),
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // movimiento que se está editando (DEBIT o CREDIT)
  const [editingMovement, setEditingMovement] = useState(null);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === Number(selectedId)) || null,
    [clients, selectedId]
  );

  const saldoCliente = useMemo(
    () => selectedClient?.currentAccountBalance || 0,
    [selectedClient]
  );

  const saldoTotal = useMemo(
    () =>
      clients.reduce(
        (acc, c) => acc + Number(c.currentAccountBalance || 0),
        0
      ),
    [clients]
  );

  const totalPago = useMemo(() => {
    const ef = Number(paymentForm.efectivo || 0);
    const tr = Number(paymentForm.transferencia || 0);
    return ef + tr;
  }, [paymentForm.efectivo, paymentForm.transferencia]);

  // ---------------- HELPERS ----------------
  function clearMessages() {
    setErr("");
    setOkMsg("");
  }

  function resetDebtForm() {
    setDebtForm({
      amount: "",
      date: hoyISO(),
      description: "",
    });
  }

  function resetPaymentForm() {
    setPaymentForm({
      efectivo: "",
      transferencia: "",
      date: hoyISO(),
      description: "",
    });
  }

  function resetNewClient() {
    setNewClient({
      name: "",
      address: "",
      phone: "",
      city: "",
    });
  }

  function cancelEditing() {
    setEditingMovement(null);
    resetDebtForm();
    resetPaymentForm();
  }

  // ---------------- LOADERS ----------------
  async function loadClients() {
    try {
      const { data } = await api.get("/clientes-cc");
      setClients(data || []);
      if (!selectedId && data?.length) {
        setSelectedId(String(data[0].id));
      }
    } catch (e) {
      setErr("No se pudieron cargar los clientes.");
    }
  }

  async function loadMovimientos(id) {
    if (!id) {
      setMovimientos([]);
      return;
    }
    try {
      const { data } = await api.get(`/clientes-cc/${id}/movimientos`);
      setMovimientos(data || []);
    } catch (e) {
      setErr("No se pudieron cargar los movimientos.");
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    clearMessages();
    cancelEditing();
    if (selectedId) {
      loadMovimientos(selectedId);
    } else {
      setMovimientos([]);
    }
  }, [selectedId]);

  // ---------------- HANDLERS ----------------
  function onChangeNewClient(e) {
    const { name, value } = e.target;
    setNewClient((c) => ({ ...c, [name]: value }));
  }

  function onChangeDebt(e) {
    const { name, value } = e.target;
    setDebtForm((f) => ({ ...f, [name]: value }));
  }

  function onChangePayment(e) {
    const { name, value } = e.target;
    setPaymentForm((f) => ({ ...f, [name]: value }));
  }

  async function saveClient(e) {
    e?.preventDefault();
    clearMessages();

    if (!newClient.name.trim()) {
      setErr("El nombre del cliente es obligatorio.");
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post("/clientes-cc", {
        name: newClient.name.trim(),
        address: newClient.address.trim() || null,
        phone: newClient.phone.trim() || null,
        city: newClient.city.trim() || null,
      });

      setOkMsg("Cliente creado correctamente.");
      resetNewClient();
      await loadClients();
      if (data?.id) setSelectedId(String(data.id));
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          "No se pudo crear el cliente. Verificá los datos."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------- REGISTRAR / EDITAR DEUDA ----------
  async function registrarDeuda() {
    clearMessages();
    if (!selectedId) {
      setErr("Seleccioná un cliente.");
      return;
    }

    const monto = Number(debtForm.amount);
    if (!(monto > 0)) {
      setErr("Ingresá un monto de deuda válido.");
      return;
    }

    try {
      setLoading(true);

      if (editingMovement && editingMovement.type === "DEBIT") {
        // EDITAR deuda existente
        await api.put(`/clientes-cc/movimientos/${editingMovement.id}`, {
          amount: monto,
          date: debtForm.date || hoyISO(),
          description: debtForm.description || "Deuda registrada",
        });
        setOkMsg("Deuda actualizada correctamente.");
      } else {
        // NUEVA deuda
        await api.post(`/clientes-cc/${selectedId}/deuda`, {
          amount: monto,
          date: debtForm.date || hoyISO(),
          description: debtForm.description || "Deuda registrada",
        });
        setOkMsg("Deuda registrada correctamente.");
      }

      resetDebtForm();
      setEditingMovement(null);
      await loadClients();
      await loadMovimientos(selectedId);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          "No se pudo registrar la deuda. Intentá de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------- REGISTRAR / EDITAR PAGO ----------
  async function registrarPago() {
    clearMessages();
    if (!selectedId) {
      setErr("Seleccioná un cliente.");
      return;
    }

    const ef = Number(paymentForm.efectivo || 0);
    const tr = Number(paymentForm.transferencia || 0);
    const total = ef + tr;

    if (!(total > 0)) {
      setErr("Ingresá al menos un monto en efectivo o transferencia.");
      return;
    }

    try {
      setLoading(true);

      if (editingMovement && editingMovement.type === "CREDIT") {
        // EDITAR pago existente
        await api.put(`/clientes-cc/movimientos/${editingMovement.id}`, {
          efectivo: ef,
          transferencia: tr,
          date: paymentForm.date || hoyISO(),
          description:
            paymentForm.description ||
            "Pago a cuenta de la deuda del cliente",
        });
        setOkMsg("Pago actualizado correctamente.");
      } else {
        // NUEVO pago
        await api.post(`/clientes-cc/${selectedId}/pago`, {
          efectivo: ef,
          transferencia: tr,
          date: paymentForm.date || hoyISO(),
          description:
            paymentForm.description ||
            "Pago a cuenta de la deuda del cliente",
        });
        setOkMsg("Pago registrado correctamente.");
      }

      resetPaymentForm();
      setEditingMovement(null);
      await loadClients();
      await loadMovimientos(selectedId);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          "No se pudo registrar el pago. Intentá de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  function setSaldarTodoEnFormulario() {
    if (!selectedId || !(saldoCliente > 0)) return;
    clearMessages();

    setPaymentForm((f) => ({
      ...f,
      efectivo: String(saldoCliente),
      transferencia: "",
      date: hoyISO(),
      description: "Cancelación total de la deuda",
    }));
    setEditingMovement(null);
  }

  // ---------- EDITAR / ELIMINAR MOVIMIENTOS DESDE LA TABLA ----------
  function handleEditMovement(m) {
    clearMessages();
    setEditingMovement(m);

    const dateISO = m.date
      ? new Date(m.date).toISOString().slice(0, 10)
      : hoyISO();

    if (m.type === "DEBIT") {
      setDebtForm({
        amount: String(m.amount ?? ""),
        date: dateISO,
        description: m.description || "",
      });
      // limpiamos pago
      resetPaymentForm();
    } else {
      // CREDIT → rellenar formulario de pago
      setPaymentForm({
        efectivo:
          m.method === "TRANSFERENCIA" ? "" : String(m.amount ?? ""),
        transferencia:
          m.method === "TRANSFERENCIA" ? String(m.amount ?? "") : "",
        date: dateISO,
        description: m.description || "",
      });
      // limpiamos deuda
      resetDebtForm();
    }
  }

  async function handleDeleteMovement(m) {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    clearMessages();

    try {
      setLoading(true);
      await api.delete(`/clientes-cc/movimientos/${m.id}`);
      if (editingMovement && editingMovement.id === m.id) {
        cancelEditing();
      }
      await loadClients();
      await loadMovimientos(selectedId);
      setOkMsg("Movimiento eliminado correctamente.");
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          "No se pudo eliminar el movimiento. Intentá de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------- RENDER ----------------
  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      {/* HEADER / RESUMEN GENERAL */}
      <section className="p-4 md:p-5 rounded-2xl border bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
              Gestión de deudas de clientes
            </h1>
            <p className="text-sm text-slate-200 mt-1">
              Creá clientes, registrá deudas y pagos, y visualizá el saldo
              total adeudado en un solo panel.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap justify-start md:justify-end">
            <div className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-center">
              <div className="text-xs uppercase tracking-wide text-slate-300">
                Clientes
              </div>
              <div className="text-lg font-bold">
                {clients.length.toLocaleString("es-AR")}
              </div>
            </div>

            <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-center">
              <div className="text-xs uppercase tracking-wide text-emerald-100">
                Saldo total adeudado
              </div>
              <div className="text-lg font-bold">
                $ {fmt(saldoTotal)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MENSAJES */}
      {(err || okMsg) && (
        <section>
          {err && (
            <div className="mb-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {err}
            </div>
          )}
          {okMsg && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              {okMsg}
            </div>
          )}
        </section>
      )}

      {/* GRID PRINCIPAL: CLIENTES / OPERACIONES */}
      <section className="grid gap-6 md:grid-cols-3">
        {/* LADO IZQUIERDO: CLIENTES */}
        <div className="space-y-4 md:col-span-1">
          {/* Selección de cliente */}
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Cliente seleccionado
            </h2>

            <label className="block text-xs text-gray-600 mb-1">
              Cliente
            </label>
            <select
              className="border rounded-xl px-3 py-2 w-full text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {!clients.length && (
                <option value="">— Sin clientes —</option>
              )}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {selectedClient && (
              <div className="mt-3 space-y-2">
                {/* SALDO DESTACADO */}
                <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-sm">
                  <span className="text-[11px] uppercase tracking-wide text-slate-300">
                    Saldo actual
                  </span>

                  <span
                    className={
                      "px-3 py-1 rounded-full text-lg font-bold " +
                      (saldoCliente > 0
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-500 text-white")
                    }
                  >
                    $ {fmt(saldoCliente)}
                  </span>
                </div>

                {/* INFO EXTRA DEL CLIENTE */}
                <div className="text-xs text-slate-700 space-y-1">
                  {selectedClient.city && (
                    <div>
                      <span className="text-slate-500">Localidad: </span>
                      <span>{selectedClient.city}</span>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div>
                      <span className="text-slate-500">Teléfono: </span>
                      <span>{selectedClient.phone}</span>
                    </div>
                  )}
                  {selectedClient.address &&(
                     <div>
                      <span className="text-slate-500">Direccion: </span>
                      <span>{selectedClient.address}</span>
                    </div>
                  ) }
                </div>
              </div>
            )}
          </div>

          {/* Alta de cliente */}
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Crear nuevo cliente
            </h2>

            <form onSubmit={saveClient} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={newClient.name}
                  onChange={onChangeNewClient}
                  className="border rounded-xl px-3 py-2 w-full"
                  placeholder="Nombre del cliente"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={newClient.address}
                  onChange={onChangeNewClient}
                  className="border rounded-xl px-3 py-2 w-full"
                  placeholder="Calle, número, etc."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={newClient.phone}
                    onChange={onChangeNewClient}
                    className="border rounded-xl px-3 py-2 w-full"
                    placeholder="Celular / fijo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Localidad
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={newClient.city}
                    onChange={onChangeNewClient}
                    className="border rounded-xl px-3 py-2 w-full"
                    placeholder="Ciudad / localidad"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Crear cliente"}
              </button>
            </form>
          </div>
        </div>

        {/* LADO DERECHO: OPERACIONES / MOVIMIENTOS */}
        <div className="space-y-4 md:col-span-2">
          {/* Registrar deuda */}
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">
                {editingMovement && editingMovement.type === "DEBIT"
                  ? "Editar deuda"
                  : "Registrar deuda"}
              </h2>
              {editingMovement && editingMovement.type === "DEBIT" && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="text-xs text-slate-500 underline"
                >
                  Cancelar edición
                </button>
              )}
              {selectedClient && (
                <span className="ml-auto text-xs text-slate-500">
                  Cliente:{" "}
                  <span className="font-medium">
                    {selectedClient.name}
                  </span>
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4 text-sm">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Monto
                </label>
                <input
                  type="number"
                  name="amount"
                  value={debtForm.amount}
                  onChange={onChangeDebt}
                  className="border-2 border-slate-900/70 rounded-xl px-3 py-2 w-full text-right text-lg font-semibold tracking-wide bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  name="date"
                  value={debtForm.date}
                  onChange={onChangeDebt}
                  className="border rounded-xl px-3 py-2 w-full"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Detalle (opcional)
                </label>
                <input
                  type="text"
                  name="description"
                  value={debtForm.description}
                  onChange={onChangeDebt}
                  className="border rounded-xl px-3 py-2 w-full"
                  placeholder="Ej: Venta a crédito, servicio, etc."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={registrarDeuda}
                disabled={loading || !selectedId}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-60"
              >
                {loading
                  ? "Guardando..."
                  : editingMovement && editingMovement.type === "DEBIT"
                  ? "Guardar cambios"
                  : "Agregar deuda"}
              </button>
              <button
                type="button"
                onClick={resetDebtForm}
                className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Registrar pago */}
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">
                {editingMovement && editingMovement.type === "CREDIT"
                  ? "Editar pago"
                  : "Registrar pago"}
              </h2>
              {editingMovement && editingMovement.type === "CREDIT" && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="text-xs text-slate-500 underline"
                >
                  Cancelar edición
                </button>
              )}
              {selectedClient && (
                <div className="text-xs text-slate-600 text-right ml-auto">
                  <div>Saldo actual del cliente</div>
                  <div className="font-semibold">
                    $ {fmt(saldoCliente)}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4 text-sm">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Efectivo
                </label>
                <input
                  type="number"
                  name="efectivo"
                  value={paymentForm.efectivo}
                  onChange={onChangePayment}
                  className="border rounded-xl px-3 py-2 w-full"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Transferencia
                </label>
                <input
                  type="number"
                  name="transferencia"
                  value={paymentForm.transferencia}
                  onChange={onChangePayment}
                  className="border rounded-xl px-3 py-2 w-full"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  name="date"
                  value={paymentForm.date}
                  onChange={onChangePayment}
                  className="border rounded-xl px-3 py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Total del pago
                </label>
                <div className="px-3 py-2 w-full rounded-xl bg-gray-50 border text-right font-semibold">
                  $ {fmt(totalPago)}
                </div>
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs text-gray-600 mb-1">
                  Detalle (opcional)
                </label>
                <input
                  type="text"
                  name="description"
                  value={paymentForm.description}
                  onChange={onChangePayment}
                  className="border rounded-xl px-3 py-2 w-full"
                  placeholder="Ej: Pago parcial, cancelación total, etc."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={registrarPago}
                disabled={loading || !selectedId}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading
                  ? "Guardando..."
                  : editingMovement && editingMovement.type === "CREDIT"
                  ? "Guardar cambios"
                  : "Registrar pago"}
              </button>
              <button
                type="button"
                onClick={setSaldarTodoEnFormulario}
                disabled={loading || !selectedId || !(saldoCliente > 0)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                Saldar deuda completa
              </button>
              <button
                type="button"
                onClick={resetPaymentForm}
                className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Historial de movimientos (lista desplegable) */}
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-800">
                Historial de movimientos
              </h2>
              <span className="text-xs text-slate-500">
                {movimientos.length} movimiento
                {movimientos.length !== 1 ? "s" : ""}
              </span>
            </div>

            {(!selectedId || !movimientos.length) && (
              <p className="text-sm text-slate-500">
                {selectedId
                  ? "Todavía no hay movimientos para este cliente."
                  : "Seleccioná un cliente para ver su historial."}
              </p>
            )}

            {selectedId && movimientos.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-slate-700 hover:text-slate-900">
                  Ver / ocultar historial
                </summary>
                <div className="mt-3 overflow-x-auto rounded-xl border">
                  <table className="w-full text-xs md:text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-2 text-left">Fecha</th>
                        <th className="py-2 px-2 text-left">Tipo</th>
                        <th className="py-2 px-2 text-left">Método</th>
                        <th className="py-2 px-2 text-left">Detalle</th>
                        <th className="py-2 px-2 text-right">Monto</th>
                        <th className="py-2 px-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="py-1.5 px-2">
                            {new Date(m.date).toLocaleDateString("es-AR")}
                          </td>
                          <td className="py-1.5 px-2">
                            {m.type === "DEBIT" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-100">
                                Deuda
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Pago
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            {m.method || "—"}
                          </td>
                          <td className="py-1.5 px-2">
                            {m.description || "—"}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            $ {fmt(m.amount)}
                          </td>
                          <td className="py-1.5 px-2 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleEditMovement(m)}
                              className="inline-flex items-center px-2 py-1 rounded-lg border border-blue-500 text-[11px] text-blue-600 hover:bg-blue-50"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMovement(m)}
                              className="inline-flex items-center px-2 py-1 rounded-lg border border-rose-500 text-[11px] text-rose-600 hover:bg-rose-50"
                            >
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
