import { create } from "zustand";
import type { Meeting, Transcript, Summary } from "@/types";

interface MeetingState {
  meetings: Meeting[];
  activeMeeting: Meeting | null;
  activeTranscript: Transcript | null;
  activeSummary: Summary | null;
  setMeetings: (meetings: Meeting[]) => void;
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  removeMeeting: (id: string) => void;
  setActiveMeeting: (meeting: Meeting | null) => void;
  setActiveTranscript: (transcript: Transcript | null) => void;
  setActiveSummary: (summary: Summary | null) => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  meetings: [],
  activeMeeting: null,
  activeTranscript: null,
  activeSummary: null,
  setMeetings: (meetings) => set({ meetings }),
  addMeeting: (meeting) =>
    set((s) => ({ meetings: [meeting, ...s.meetings] })),
  updateMeeting: (id, updates) =>
    set((s) => ({
      meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      activeMeeting:
        s.activeMeeting?.id === id
          ? { ...s.activeMeeting, ...updates }
          : s.activeMeeting,
    })),
  removeMeeting: (id) =>
    set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),
  setActiveMeeting: (meeting) => set({ activeMeeting: meeting }),
  setActiveTranscript: (transcript) => set({ activeTranscript: transcript }),
  setActiveSummary: (summary) => set({ activeSummary: summary }),
}));
