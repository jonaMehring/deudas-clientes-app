import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL
});

export default api;
