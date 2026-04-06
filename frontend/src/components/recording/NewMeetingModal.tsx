"use client";
import { useState } from "react";
import { X, Mic } from "lucide-react";
import { meetingsApi } from "@/lib/api";
import { useMeetingStore } from "@/stores/meetingStore";
import type { Meeting, ModelConfig } from "@/types";

interface Props {
  onClose: () => void;
  onCreated: (meeting: Meeting) => void;
  defaultModelConfig: ModelConfig;
}

export function NewMeetingModal({ onClose, onCreated, defaultModelConfig }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { addMeeting } = useMeetingStore();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const meeting = await meetingsApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        model_config_data: defaultModelConfig,
      });
      addMeeting(meeting);
      onCreated(meeting);
    } catch (err: any) {
      console.error("Failed to create meeting", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 safe-bottom">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-semibold">New Meeting</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <input
              type="text"
              placeholder="Meeting title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              maxLength={200}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>
          <div>
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>
          <button
            type="submit"
            disabled={!title.trim() || loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-3 font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Mic className="w-4 h-4" />
            {loading ? "Creating..." : "Start Recording"}
          </button>
        </form>
      </div>
    </div>
  );
}
