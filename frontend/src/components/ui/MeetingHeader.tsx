"use client";
import { ArrowLeft, Mic, Trash2, MoreVertical } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { meetingsApi } from "@/lib/api";
import { useMeetingStore } from "@/stores/meetingStore";
import { formatDuration } from "@/lib/utils";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
  onBack: () => void;
  onRecordAgain?: () => void;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  recording: { label: "Recording", color: "text-red-400 bg-red-400/10" },
  uploading: { label: "Uploading", color: "text-yellow-400 bg-yellow-400/10" },
  transcribing: { label: "Transcribing", color: "text-blue-400 bg-blue-400/10" },
  summarizing: { label: "Analyzing", color: "text-purple-400 bg-purple-400/10" },
  ready: { label: "Ready", color: "text-green-400 bg-green-400/10" },
  error: { label: "Error", color: "text-red-500 bg-red-500/10" },
};

export function MeetingHeader({ meeting, onBack, onRecordAgain }: Props) {
  const router = useRouter();
  const { removeMeeting } = useMeetingStore();
  const [showMenu, setShowMenu] = useState(false);
  const badge = STATUS_BADGE[meeting.status] || STATUS_BADGE.ready;

  async function handleDelete() {
    if (!confirm("Delete this meeting?")) return;
    await meetingsApi.delete(meeting.id);
    removeMeeting(meeting.id);
    router.push("/meetings");
  }

  return (
    <div className="px-4 pt-12 pb-3 shrink-0 border-b border-slate-800/50">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
          {badge.label}
        </span>
        <div className="flex-1" />
        {onRecordAgain && meeting.status === "ready" && (
          <button
            onClick={onRecordAgain}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
            title="Re-record"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 min-w-[140px] overflow-hidden">
              <button
                onClick={() => { setShowMenu(false); handleDelete(); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <h2 className="font-semibold text-base leading-tight line-clamp-2">{meeting.title}</h2>
      {meeting.duration && (
        <p className="text-xs text-muted-foreground mt-0.5">{formatDuration(meeting.duration)}</p>
      )}
    </div>
  );
}
