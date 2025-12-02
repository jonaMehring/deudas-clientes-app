import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import clientesCcRouter from "./routes/clientesCc.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, message: "API de deudas de clientes" });
});

app.use("/api/clientes-cc", clientesCcRouter);

app.use((err, req, res, next) => {
  console.error("Error no manejado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});
