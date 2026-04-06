"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Cpu, Volume2, LogOut, User } from "lucide-react";
import { modelsApi } from "@/lib/api";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAuthStore } from "@/stores/authStore";
import { logOut } from "@/lib/firebaseAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ModelSelector } from "@/components/settings/ModelSelector";
import type { AvailableModels } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { modelPreferences, ttsVoice, ttsModel, setModelPreferences, setTtsVoice, setTtsModel } = useSettingsStore();
  const [models, setModels] = useState<AvailableModels | null>(null);

  useEffect(() => {
    modelsApi.list().then(setModels).catch(() => {});
  }, []);

  async function handleSignOut() {
    await logOut();
    router.push("/login");
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-border">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>

        <div className="p-4 space-y-6 max-w-lg mx-auto">
          {/* Profile */}
          <section>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Account
            </h2>
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <p className="font-medium">{user?.displayName || "User"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </section>

          {/* AI Models */}
          <section>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> AI Models
            </h2>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 divide-y divide-slate-700/50">
              <ModelSelector
                label="Transcription"
                options={models?.transcription || []}
                value={modelPreferences.transcription}
                onChange={(v) => setModelPreferences({ transcription: v })}
              />
              <ModelSelector
                label="Summarization"
                options={models?.summarization || []}
                value={modelPreferences.summarization}
                onChange={(v) => setModelPreferences({ summarization: v })}
              />
              <ModelSelector
                label="Action Items"
                options={models?.action_items || []}
                value={modelPreferences.action_items}
                onChange={(v) => setModelPreferences({ action_items: v })}
              />
              <ModelSelector
                label="Chat"
                options={models?.chat || []}
                value={modelPreferences.chat}
                onChange={(v) => setModelPreferences({ chat: v })}
              />
            </div>
          </section>

          {/* Voice Summary */}
          <section>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" /> Voice Summary
            </h2>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 divide-y divide-slate-700/50">
              <ModelSelector
                label="TTS Model"
                options={models?.tts || []}
                value={ttsModel}
                onChange={setTtsModel}
              />
              <ModelSelector
                label="Voice"
                options={models?.tts_voice || []}
                value={ttsVoice}
                onChange={setTtsVoice}
              />
            </div>
          </section>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-2xl py-3 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}
