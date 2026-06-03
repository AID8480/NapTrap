import { client } from "./client";

export interface SessionOut {
  id: string;
  started_at: string;
  ended_at: string | null;
  max_fatigue_level: number;
  alert_count: number;
}

export const getHistory = () => client.get<SessionOut[]>("/session/history");
export const clearHistory = () => client.delete("/session/history");
