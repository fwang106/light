"use client";
import { useState } from "react";
import {
  FileText, CheckSquare, Square, Sparkles, Volume2, Loader2, AlertCircle, Play, Pause,
} from "lucide-react";
import { summaryApi, ttsApi } from "@/lib/api";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/components/ui/Toaster";
import type { Meeting, Summary, ActionItem } from "@/types";

interface Props {
  meeting: Meeting;
  summary: Summary | null;
  onSummaryUpdated: (s: Summary) => void;
}

export function SummaryView({ meeting, summary, onSummaryUpdated }: Props) {
  const { modelPreferences, ttsVoice, ttsModel } = useSettingsStore();
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingTts, setGeneratingTts] = useState(false);
  const [ttsUrl, setTtsUrl] = useState<string | null>(summary?.tts_summary_url || null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsAudio = typeof Audio !== "undefined" ? new Audio() : null;

  async function handleGenerateSummary() {
    setGeneratingSummary(true);
    try {
      const s = await summaryApi.generate(meeting.id, modelPreferences.summarization);
      onSummaryUpdated(s);
      toast({ title: "Summary generated" });
    } catch (e: any) {
      toast({ title: "Failed to generate summary", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleToggleAction(item: ActionItem) {
    try {
      const updated = await summaryApi.toggleActionItem(meeting.id, item.id, !item.completed);
      onSummaryUpdated(updated);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }

  async function handleTts() {
    setGeneratingTts(true);
    try {
      const result = await ttsApi.generate(meeting.id, ttsVoice, ttsModel);
      setTtsUrl(result.download_url);
      toast({ title: "Voice summary ready" });
    } catch (e: any) {
      toast({ title: "TTS failed", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingTts(false);
    }
  }

  function handlePlayTts() {
    if (!ttsUrl || !ttsAudio) return;
    if (ttsPlaying) {
      ttsAudio.pause();
      setTtsPlaying(false);
    } else {
      ttsAudio.src = ttsUrl;
      ttsAudio.play().then(() => setTtsPlaying(true)).catch(() => {});
      ttsAudio.onended = () => setTtsPlaying(false);
    }
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary/60" />
        </div>
        <p className="text-sm text-muted-foreground text-center">No summary yet</p>
        <button
          onClick={handleGenerateSummary}
          disabled={generatingSummary}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {generatingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generatingSummary ? "Generating..." : "Generate Summary"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Actions row */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleGenerateSummary}
          disabled={generatingSummary}
          className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 transition-colors disabled:opacity-50"
        >
          {generatingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {generatingSummary ? "Regenerating..." : "Regenerate"}
        </button>

        {ttsUrl ? (
          <button
            onClick={handlePlayTts}
            className="flex items-center gap-1.5 text-xs bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl px-3 py-2 transition-colors"
          >
            {ttsPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {ttsPlaying ? "Pause" : "Play Summary"}
          </button>
        ) : (
          <button
            onClick={handleTts}
            disabled={generatingTts}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 transition-colors disabled:opacity-50"
          >
            {generatingTts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
            {generatingTts ? "Generating voice..." : "Voice Summary"}
          </button>
        )}
      </div>

      {/* Summary text */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Summary
        </h3>
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.summary}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Model: {summary.model_used}</p>
      </section>

      {/* Action items */}
      {summary.action_items.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Action Items ({summary.action_items.filter((a) => !a.completed).length} open)
          </h3>
          <div className="space-y-2">
            {summary.action_items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleToggleAction(item)}
                className="w-full flex items-start gap-3 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-left transition-colors hover:bg-slate-800 active:scale-[0.99]"
              >
                {item.completed ? (
                  <CheckSquare className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.text}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    {item.assignee && (
                      <span className="text-xs text-muted-foreground">@{item.assignee}</span>
                    )}
                    {item.due_date && (
                      <span className="text-xs text-muted-foreground">{item.due_date}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Key decisions */}
      {summary.key_decisions.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Key Decisions
          </h3>
          <ul className="space-y-1.5">
            {summary.key_decisions.map((d, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Participants */}
      {summary.participants.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Participants
          </h3>
          <div className="flex flex-wrap gap-2">
            {summary.participants.map((p, i) => (
              <span key={i} className="text-xs bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1">
                {p}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
