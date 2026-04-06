"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Mic, FileText, Clock, AlertCircle, Loader2 } from "lucide-react";
import { meetingsApi } from "@/lib/api";
import { useMeetingStore } from "@/stores/meetingStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatDuration, formatDate } from "@/lib/utils";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/ui/AppShell";
import { NewMeetingModal } from "@/components/recording/NewMeetingModal";
import type { Meeting } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  recording: "text-red-400",
  uploading: "text-yellow-400",
  transcribing: "text-blue-400",
  summarizing: "text-purple-400",
  ready: "text-green-400",
  error: "text-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  recording: "Recording...",
  uploading: "Uploading...",
  transcribing: "Transcribing...",
  summarizing: "Analyzing...",
  ready: "Ready",
  error: "Error",
};

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const isProcessing = ["uploading", "transcribing", "summarizing"].includes(meeting.status);
  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 flex-1">{meeting.title}</h3>
        <span className={`text-xs font-medium shrink-0 flex items-center gap-1 ${STATUS_COLORS[meeting.status] || "text-muted-foreground"}`}>
          {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
          {meeting.status === "error" && <AlertCircle className="w-3 h-3" />}
          {STATUS_LABELS[meeting.status] || meeting.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {meeting.duration ? formatDuration(meeting.duration) : "--:--"}
        </span>
        <span>{formatDate(meeting.created_at)}</span>
      </div>
      {meeting.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{meeting.description}</p>
      )}
    </button>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { meetings, setMeetings } = useMeetingStore();
  const { modelPreferences } = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("action") === "new") setShowNew(true);
  }, [searchParams]);

  useEffect(() => {
    loadMeetings();
  }, []);

  async function loadMeetings() {
    try {
      const data = await meetingsApi.list();
      setMeetings(data);
    } catch (e: any) {
      setError("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
            <div>
              <h1 className="text-xl font-bold">Meetings</h1>
              <p className="text-xs text-muted-foreground">{meetings.length} recording{meetings.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mb-2 text-red-400" />
                <p className="text-sm">{error}</p>
                <button onClick={loadMeetings} className="mt-3 text-primary text-sm hover:underline">
                  Try again
                </button>
              </div>
            ) : meetings.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <Mic className="w-8 h-8 text-primary/60" />
                </div>
                <h3 className="font-medium mb-1">No meetings yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Tap the button above to record your first meeting
                </p>
                <button
                  onClick={() => setShowNew(true)}
                  className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                >
                  Start recording
                </button>
              </div>
            ) : (
              meetings
                .filter((m) => m.status !== "deleted")
                .map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onClick={() => router.push(`/meetings/${meeting.id}`)}
                  />
                ))
            )}
          </div>
        </div>

        {showNew && (
          <NewMeetingModal
            onClose={() => setShowNew(false)}
            defaultModelConfig={modelPreferences}
            onCreated={(meeting) => {
              setShowNew(false);
              router.push(`/meetings/${meeting.id}/record`);
            }}
          />
        )}
      </AppShell>
    </AuthGuard>
  );
}
