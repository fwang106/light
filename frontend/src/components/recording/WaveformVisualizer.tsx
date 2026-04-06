"use client";

interface Props {
  data: number[];
  active: boolean;
  color?: string;
}

export function WaveformVisualizer({ data, active, color = "#6366f1" }: Props) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-12 w-full">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 max-w-[3px] rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(10, v * 100)}%`,
            backgroundColor: color,
            opacity: active ? 0.7 + v * 0.3 : 0.2,
            animationDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </div>
  );
}
