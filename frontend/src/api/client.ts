import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "";

export const client = axios.create({ baseURL: BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("naptrap_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
