"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mic, Mail, Lock, Eye, EyeOff, Chrome } from "lucide-react";
import { signInWithEmail, signInWithGoogle, resetPassword } from "@/lib/firebaseAuth";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmail(email, password);
      router.push("/meetings");
    } catch (err: any) {
      setError(err.message?.replace("Firebase: ", "") || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      router.push("/meetings");
    } catch (err: any) {
      setError(err.message?.replace("Firebase: ", "") || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email) { setError("Enter your email first"); return; }
    await resetPassword(email);
    setResetSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-3 border border-primary/20">
            <Mic className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">MeetingLight</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-powered meeting transcription</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-5">Sign in</h2>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-red-400 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}
          {resetSent && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg p-3 mb-4">
              Reset link sent! Check your email.
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleReset} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-3 font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-800/50 px-3 text-xs text-muted-foreground">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-700 rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Chrome className="w-4 h-4" />
            Continue with Google
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          No account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
