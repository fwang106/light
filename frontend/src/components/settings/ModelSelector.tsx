"use client";
import type { AIModel } from "@/types";

interface Props {
  label: string;
  options: AIModel[];
  value: string;
  onChange: (value: string) => void;
}

const PROVIDER_BADGE: Record<string, string> = {
  anthropic: "bg-orange-500/10 text-orange-400",
  openai: "bg-green-500/10 text-green-400",
};

export function ModelSelector({ label, options, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 text-right"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
          {options.length === 0 && (
            <option value={value}>{value}</option>
          )}
        </select>
        {options.length > 0 && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${
              PROVIDER_BADGE[options.find((o) => o.id === value)?.provider || ""] || ""
            }`}
          >
            {options.find((o) => o.id === value)?.provider}
          </span>
        )}
      </div>
    </div>
  );
}
