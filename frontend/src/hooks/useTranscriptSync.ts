import { useMemo } from "react";
import type { TranscriptSegment } from "@/types";

export function useTranscriptSync(
  segments: TranscriptSegment[],
  currentTime: number
): { activeIndex: number } {
  const activeIndex = useMemo(() => {
    if (!segments.length || currentTime === 0) return -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start_time) return i;
    }
    return 0;
  }, [segments, currentTime]);

  return { activeIndex };
}
