"use client";
import { useEffect } from "react";
import { onAuthChange } from "@/lib/firebaseAuth";
import { useAuthStore } from "@/stores/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });
    return unsub;
  }, []);

  return <>{children}</>;
}
