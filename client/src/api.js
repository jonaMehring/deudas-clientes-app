import axios from "axios";

// Base de la API: Koyeb en producción, localhost en desarrollo
const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

export const API = axios.create({
  // 👇 acá ya incluimos el /api
  baseURL: `${API_BASE}/api`,
});

export default API;
