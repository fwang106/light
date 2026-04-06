import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelConfig } from "@/types";

interface SettingsState {
  modelPreferences: ModelConfig;
  ttsVoice: string;
  ttsModel: string;
  setModelPreferences: (prefs: Partial<ModelConfig>) => void;
  setTtsVoice: (voice: string) => void;
  setTtsModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelPreferences: {
        transcription: "whisper-1",
        summarization: "claude-3-5-sonnet-20241022",
        action_items: "claude-3-5-sonnet-20241022",
        chat: "claude-3-5-sonnet-20241022",
      },
      ttsVoice: "alloy",
      ttsModel: "tts-1",
      setModelPreferences: (prefs) =>
        set((s) => ({ modelPreferences: { ...s.modelPreferences, ...prefs } })),
      setTtsVoice: (ttsVoice) => set({ ttsVoice }),
      setTtsModel: (ttsModel) => set({ ttsModel }),
    }),
    { name: "meeting-settings" }
  )
);
