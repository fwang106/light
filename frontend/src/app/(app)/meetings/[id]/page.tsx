"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { meetingsApi, transcriptApi, summaryApi } from "@/lib/api";
import { useMeetingStore } from "@/stores/meetingStore";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/ui/AppShell";
import { MeetingHeader } from "@/components/ui/MeetingHeader";
import { TranscriptView } from "@/components/transcript/TranscriptView";
import { AudioPlayer } from "@/components/player/AudioPlayer";
import { SummaryView } from "@/components/summary/SummaryView";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Loader2, AlertCircle } from "lucide-react";
import type { Meeting, Transcript, Summary } from "@/types";

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setActiveMeeting, setActiveTranscript, setActiveSummary } = useMeetingStore();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [tab, setTab] = useState("transcript");

  useEffect(() => {
    loadData();
    // Poll for status changes when processing
    const poll = setInterval(async () => {
      const m = await meetingsApi.get(id).catch(() => null);
      if (m && m.status !== meeting?.status) {
        setMeeting(m);
        if (m.status === "ready") {
          loadTranscriptAndSummary(m);
          clearInterval(poll);
        }
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [id]);

  async function loadData() {
    try {
      const m = await meetingsApi.get(id);
      setMeeting(m);
      setActiveMeeting(m);
      if (m.status === "ready") {
        await loadTranscriptAndSummary(m);
      }
    } catch {
      setError("Meeting not found");
    } finally {
      setLoading(false);
    }
  }

  async function loadTranscriptAndSummary(m: Meeting) {
    const [t, s] = await Promise.allSettled([
      transcriptApi.get(m.id),
      summaryApi.get(m.id),
    ]);
    if (t.status === "fulfilled") { setTranscript(t.value); setActiveTranscript(t.value); }
    if (s.status === "fulfilled") { setSummary(s.value); setActiveSummary(s.value); }
  }

  if (loading) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  if (error || !meeting) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-2 text-red-400" />
            <p className="text-sm">{error || "Meeting not found"}</p>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  const isProcessing = ["uploading", "transcribing", "summarizing"].includes(meeting.status);

  return (
    <AuthGuard>
      <AppShell>
        <div className="flex flex-col h-full">
          <MeetingHeader
            meeting={meeting}
            onBack={() => router.push("/meetings")}
            onRecordAgain={() => router.push(`/meetings/${id}/record`)}
          />

          {/* Audio Player - show when ready */}
          {meeting.status === "ready" && meeting.audio_download_url && transcript && (
            <div className="px-4 pb-2 shrink-0">
              <AudioPlayer
                src={meeting.audio_download_url}
                segments={transcript.segments}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
              />
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>
              <h3 className="font-medium mb-1">
                {meeting.status === "uploading" ? "Uploading audio..." :
                 meeting.status === "transcribing" ? "Transcribing with AI..." :
                 "Generating summary..."}
              </h3>
              <p className="text-sm text-muted-foreground">This may take a few minutes</p>
            </div>
          )}

          {/* Error state */}
          {meeting.status === "error" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <h3 className="font-medium mb-1">Processing failed</h3>
              <p className="text-sm text-muted-foreground">{meeting.error_message}</p>
            </div>
          )}

          {/* Tabs - show when ready */}
          {meeting.status === "ready" && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
                <div className="px-4 shrink-0">
                  <TabsList className="w-full grid grid-cols-3 bg-slate-800/50 rounded-xl p-1">
                    <TabsTrigger value="transcript" className="rounded-lg text-xs">Transcript</TabsTrigger>
                    <TabsTrigger value="summary" className="rounded-lg text-xs">Summary</TabsTrigger>
                    <TabsTrigger value="chat" className="rounded-lg text-xs">Chat</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="transcript" className="flex-1 overflow-hidden mt-2">
                  {transcript ? (
                    <TranscriptView
                      segments={transcript.segments}
                      currentTime={currentTime}
                      onSeek={(time) => setCurrentTime(time)}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No transcript available
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="summary" className="flex-1 overflow-y-auto mt-2 px-4">
                  <SummaryView
                    meeting={meeting}
                    summary={summary}
                    onSummaryUpdated={setSummary}
                  />
                </TabsContent>

                <TabsContent value="chat" className="flex-1 overflow-hidden mt-2 flex flex-col">
                  <ChatInterface meetingId={meeting.id} modelConfig={meeting.model_config_data} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
