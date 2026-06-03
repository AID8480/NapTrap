import { client } from "./client";

export interface BaselineOut {
  id: string;
  rmssd_value: number;
  method: "sleep" | "resting";
  recorded_at: string;
  is_active: boolean;
}

export interface BaselineListOut {
  baselines: BaselineOut[];
  active: BaselineOut | null;
}

export interface BaselinePreview {
  interval_count: number;
  duration_minutes: number;
  rmssd_value: number;
}

export const getBaseline = () => client.get<BaselineListOut>("/user/baseline");

export const previewBaseline = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post<BaselinePreview>("/user/baseline/preview", fd);
};

export const uploadBaseline = (file: File, method: "sleep" | "resting") => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post<BaselineOut>(`/user/baseline/upload?method=${method}`, fd);
};

export const selectBaseline = (baseline_id: string) =>
  client.post<BaselineOut>("/user/baseline/select", { baseline_id });

export const deleteBaseline = (baseline_id: string) =>
  client.delete(`/user/baseline/${baseline_id}`);
