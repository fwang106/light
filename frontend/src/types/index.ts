export type MeetingStatus =
  | "recording"
  | "uploading"
  | "transcribing"
  | "summarizing"
  | "ready"
  | "error"
  | "deleted";

export interface ModelConfig {
  transcription: string;
  summarization: string;
  action_items: string;
  chat: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: MeetingStatus;
  duration?: number;
  audio_path?: string;
  audio_download_url?: string;
  recorded_at?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
  model_config_data: ModelConfig;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
}

export interface Transcript {
  meeting_id: string;
  language: string;
  segments: TranscriptSegment[];
  full_text: string;
  created_at: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  due_date?: string;
  completed: boolean;
}

export interface Summary {
  meeting_id: string;
  summary: string;
  action_items: ActionItem[];
  key_decisions: string[];
  participants: string[];
  model_used: string;
  tts_summary_path?: string;
  tts_summary_url?: string;
  created_at: string;
}

export interface ChatSource {
  chunk_index: number;
  text: string;
  start_time: number;
  speaker?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  created_at: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: "anthropic" | "openai";
  default: boolean;
}

export interface AvailableModels {
  transcription: AIModel[];
  summarization: AIModel[];
  chat: AIModel[];
  action_items: AIModel[];
  tts: AIModel[];
  tts_voice: AIModel[];
}

export interface UserSettings {
  modelPreferences: ModelConfig;
  ttsVoice: string;
  ttsModel: string;
}

// Speaker color mapping
export const SPEAKER_COLORS: Record<string, string> = {
  "Speaker 1": "#6366f1",  // indigo
  "Speaker 2": "#ec4899",  // pink
  "Speaker 3": "#14b8a6",  // teal
  "Speaker 4": "#f59e0b",  // amber
  "Speaker 5": "#3b82f6",  // blue
  "Speaker 6": "#8b5cf6",  // violet
  "Speaker 7": "#10b981",  // emerald
  "Speaker 8": "#f97316",  // orange
};
