import { client } from "./client";

export const register = (email: string, password: string) =>
  client.post<{ access_token: string }>("/auth/register", { email, password });

export const login = (email: string, password: string) =>
  client.post<{ access_token: string }>("/auth/login", { email, password });
