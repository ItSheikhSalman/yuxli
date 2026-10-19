import { request } from "./client";

export interface TrainingResource {
  id: string;
  revision: number;
  name?: string;
  content?: string;
  approved?: boolean;
  [key: string]: any;
}
export interface TrainingGroup extends TrainingResource {
  chatId: string;
  enabled: boolean;
  mode: string;
  learning: boolean;
  adminConfirmed: boolean;
  noticeVersion: string | null;
  retentionDays: number;
  proactive: boolean;
  reactionEnabled: boolean;
  humor: boolean;
  profile?: {
    messages: number;
    enoughData: boolean;
    language: string | null;
    averageWords: number | null;
    preferReactions: boolean;
    updatedAt: number | null;
  };
  metrics?: { action: string; count: number }[];
}
export interface TrainingOverview {
  workspaceId: string;
  operator: boolean;
  groups: TrainingGroup[];
  templates: TrainingResource[];
  limits: Record<string, number>;
  deployment: TrainingResource;
  notice: string;
  noticeVersion: string;
  formats: string[];
  connections: { id: string; name: string }[];
  authorizedChats: { chatId: string; name: string | null; kind: "group" | "direct"; observedAt: number }[];
}
export const trainingApi = {
  get: <T>(path: string) => request<T>(`/ai/training${path}`),
  post: <T>(path: string, body: unknown = {}) =>
    request<T>(`/ai/training${path}`, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(`/ai/training${path}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (path: string) => request(`/ai/training${path}`, { method: "DELETE" }),
};
