import { useState, useCallback } from "react";
import { chatApi } from "@/lib/api";
import type { ChatMessage, ChatSource } from "@/types";

export function useStreamingChat(meetingId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const loadHistory = useCallback(async () => {
    const { messages: history } = await chatApi.history(meetingId);
    setMessages(history);
  }, [meetingId]);

  const sendMessage = useCallback(
    async (content: string, model?: string) => {
      if (streaming) return;

      const userMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      setStreamingContent("");

      let fullContent = "";
      let sources: ChatSource[] = [];

      try {
        for await (const event of chatApi.stream(meetingId, content, model)) {
          if (event.type === "chunk") {
            fullContent += event.content;
            setStreamingContent(fullContent);
          } else if (event.type === "sources") {
            sources = event.sources;
          } else if (event.type === "done") {
            const assistantMsg: ChatMessage = {
              id: Math.random().toString(36).slice(2),
              role: "assistant",
              content: fullContent,
              sources: sources.length > 0 ? sources : undefined,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setStreamingContent("");
          } else if (event.type === "error") {
            throw new Error(event.content);
          }
        }
      } finally {
        setStreaming(false);
        setStreamingContent("");
      }
    },
    [meetingId, streaming]
  );

  const clearHistory = useCallback(async () => {
    await chatApi.clearHistory(meetingId);
    setMessages([]);
  }, [meetingId]);

  return { messages, streaming, streamingContent, sendMessage, loadHistory, clearHistory };
}
