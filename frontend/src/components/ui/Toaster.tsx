"use client";
import * as Toast from "@radix-ui/react-toast";
import { create } from "zustand";
import { X } from "lucide-react";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (t: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(t: Omit<ToastItem, "id">) {
  useToastStore.getState().addToast(t);
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore();
  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={(open) => !open && removeToast(t.id)}
          className={`fixed bottom-20 left-4 right-4 z-50 flex items-start justify-between gap-3 rounded-2xl p-4 shadow-lg border transition-all
            ${t.variant === "destructive"
              ? "bg-red-900/90 border-red-700 text-red-100"
              : "bg-slate-800 border-slate-700 text-white"
            }`}
        >
          <div>
            <Toast.Title className="font-medium text-sm">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="text-xs text-muted-foreground mt-0.5">
                {t.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close onClick={() => removeToast(t.id)} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="w-4 h-4" />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport />
    </Toast.Provider>
  );
}
