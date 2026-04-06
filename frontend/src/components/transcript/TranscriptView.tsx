"use client";
import { useEffect, useRef } from "react";
import { useTranscriptSync } from "@/hooks/useTranscriptSync";
import { SPEAKER_COLORS } from "@/types";
import { formatDuration, cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/types";

interface Props {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TranscriptView({ segments, currentTime, onSeek }: Props) {
  const { activeIndex } = useTranscriptSync(segments, currentTime);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && currentTime > 0) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  if (!segments.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm px-4">
        No transcript segments found.
      </div>
    );
  }

  // Group consecutive same-speaker segments
  const groups: { speaker: string; segments: TranscriptSegment[]; startIdx: number }[] = [];
  segments.forEach((seg, idx) => {
    const last = groups[groups.length - 1];
    if (last && last.speaker === seg.speaker) {
      last.segments.push(seg);
    } else {
      groups.push({ speaker: seg.speaker, segments: [seg], startIdx: idx });
    }
  });

  return (
    <div className="overflow-y-auto h-full px-4 pb-4 space-y-4">
      {groups.map((group, gIdx) => {
        const color = SPEAKER_COLORS[group.speaker] || "#6366f1";
        const isActive = group.segments.some(
          (_, sIdx) => group.startIdx + sIdx === activeIndex
        );

        return (
          <div key={gIdx} className="flex gap-3">
            {/* Speaker dot */}
            <div className="shrink-0 mt-1">
              <div
                className="w-2 h-2 rounded-full mt-1"
                style={{ backgroundColor: color }}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* Speaker name + time */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold" style={{ color }}>
                  {group.speaker}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(group.segments[0].start_time)}
                </span>
              </div>

              {/* Segments */}
              <div>
                {group.segments.map((seg, sIdx) => {
                  const segGlobalIdx = group.startIdx + sIdx;
                  const isSegActive = segGlobalIdx === activeIndex;
                  return (
                    <button
                      key={seg.id}
                      ref={isSegActive ? activeRef : undefined}
                      onClick={() => onSeek(seg.start_time)}
                      className={cn(
                        "text-left text-sm leading-relaxed transition-colors hover:text-foreground",
                        isSegActive
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {seg.text}{" "}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
