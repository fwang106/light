"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Loader2, MessageSquare } from "lucide-react";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { SPEAKER_COLORS } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toaster";
import type { ModelConfig, ChatSource } from "@/types";

interface Props {
  meetingId: string;
  modelConfig: ModelConfig;
}

function SourcePill({ source }: { source: ChatSource }) {
  return (
    <button
      className="text-xs bg-primary/10 border border-primary/20 text-primary rounded-full px-2 py-0.5 hover:bg-primary/20 transition-colors"
      title={source.text}
    >
      {source.speaker} @{Math.round(source.start_time)}s
    </button>
  );
}

export function ChatInterface({ meetingId, modelConfig }: Props) {
  const { messages, streaming, streamingContent, sendMessage, loadHistory, clearHistory } =
    useStreamingChat(meetingId);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadHistory().catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSend() {
    const msg = input.trim();
    if (!msg || streaming) return;
    setInput("");
    try {
      await sendMessage(msg, modelConfig.chat);
    } catch (e: any) {
      toast({ title: "Chat error", description: e.message, variant: "destructive" });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleClear() {
    if (!confirm("Clear chat history?")) return;
    await clearHistory();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between shrink-0">
        <p className="text-xs text-muted-foreground">Ask anything about this meeting</p>
        {messages.length > 0 && (
          <button onClick={handleClear} className="text-muted-foreground hover:text-foreground p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">Chat with your transcript</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask questions like "What were the main decisions?" or "Who is responsible for X?"
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["What were the action items?", "Summarize the key decisions", "Who mentioned the deadline?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="text-xs bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 hover:bg-slate-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-slate-800 border border-slate-700 rounded-bl-sm"
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/10">
                  {msg.sources.map((s, i) => (
                    <SourcePill key={i} source={s} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
              <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
              <span className="inline-block w-1 h-4 bg-primary rounded-full animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 shrink-0">
        <div className="flex gap-2 bg-slate-800 border border-slate-700 rounded-2xl p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the meeting..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground py-1 px-1 max-h-28"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="w-8 h-8 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 self-end"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
