import { getIdToken } from "./firebaseAuth";
import type {
  Meeting,
  Transcript,
  Summary,
  ChatMessage,
  AvailableModels,
  ModelConfig,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function authHeaders(): Promise<HeadersInit> {
  const token = await getIdToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Meetings
export const meetingsApi = {
  list: (limit = 20) =>
    request<Meeting[]>(`/api/meetings?limit=${limit}`),

  create: (data: { title: string; description?: string; model_config_data?: ModelConfig }) =>
    request<Meeting>("/api/meetings", { method: "POST", body: JSON.stringify(data) }),

  get: (id: string) => request<Meeting>(`/api/meetings/${id}`),

  update: (id: string, data: { title?: string; description?: string }) =>
    request<Meeting>(`/api/meetings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<void>(`/api/meetings/${id}`, { method: "DELETE" }),
};

// Transcripts
export const transcriptApi = {
  get: (meetingId: string) =>
    request<Transcript>(`/api/meetings/${meetingId}/transcript`),

  status: (meetingId: string) =>
    request<{ meeting_id: string; status: string; error?: string }>(
      `/api/meetings/${meetingId}/transcript/status`
    ),
};

// Summary
export const summaryApi = {
  get: (meetingId: string) =>
    request<Summary>(`/api/meetings/${meetingId}/summary`),

  generate: (meetingId: string, model?: string) =>
    request<Summary>(`/api/meetings/${meetingId}/summarize`, {
      method: "POST",
      body: JSON.stringify({ model }),
    }),

  toggleActionItem: (meetingId: string, itemId: string, completed: boolean) =>
    request<Summary>(`/api/meetings/${meetingId}/summary/action-items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    }),
};

// Chat
export const chatApi = {
  history: (meetingId: string) =>
    request<{ meeting_id: string; messages: ChatMessage[] }>(
      `/api/meetings/${meetingId}/chat/history`
    ),

  clearHistory: (meetingId: string) =>
    request<void>(`/api/meetings/${meetingId}/chat/history`, { method: "DELETE" }),

  async *stream(meetingId: string, message: string, model?: string) {
    const token = await getIdToken();
    const res = await fetch(`${BASE}/api/meetings/${meetingId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, model }),
    });

    if (!res.ok) throw new Error("Chat request failed");
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6));
          } catch {
            // ignore malformed
          }
        }
      }
    }
  },
};

// TTS
export const ttsApi = {
  generate: (meetingId: string, voice = "alloy", model = "tts-1") =>
    request<{ storage_path: string; download_url: string }>(
      `/api/meetings/${meetingId}/tts`,
      { method: "POST", body: JSON.stringify({ voice, model }) }
    ),

  getUrl: (meetingId: string) =>
    request<{ download_url: string }>(`/api/meetings/${meetingId}/tts`),
};

// Models
export const modelsApi = {
  list: () => request<AvailableModels>("/api/models"),
};
