// file: frontend/src/components/Toasts.tsx

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useI18n } from "../context/I18nContext";
import { IconButton } from "./ui";

export interface Toast {
  id: string;
  message: string;
  type?: "success" | "warning" | "error" | "info";
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: Toast["type"], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

function ToastItem({ item, onRemove }: { item: Toast; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setLeaving(true);
    timerRef.current = setTimeout(() => onRemove(item.id), 220);
  }, [item.id, onRemove]);

  useEffect(() => {
    const dur = item.duration ?? 4000;
    timerRef.current = setTimeout(() => dismiss(), dur);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.duration, dismiss]);

  const borderCls =
    item.type === "success"
      ? "border-ok/40"
      : item.type === "error"
        ? "border-danger/40"
        : item.type === "warning"
          ? "border-warn/40"
          : "border-line";

  const accentCls =
    item.type === "success"
      ? "from-ok"
      : item.type === "error"
        ? "from-danger"
        : item.type === "warning"
          ? "from-warn"
          : "from-brand-blue";

  const dur = item.duration ?? 4000;

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto relative overflow-hidden flex items-center gap-3
        rounded-2xl border bg-panel-raised/95 px-4 py-3
        text-sm text-text-main shadow-2xl backdrop-blur-xl
        ${borderCls}
        ${leaving ? "animate-toast-out" : "animate-toast-in"}
      `}
    >
      {/* Icon */}
      <span className="shrink-0">
        {item.type === "success" && <CheckCircle2 size={18} className="text-ok" />}
        {item.type === "error"   && <XCircle      size={18} className="text-danger" />}
        {item.type === "warning" && <AlertTriangle size={18} className="text-warn" />}
        {item.type === "info"    && <Info          size={18} className="text-info" />}
        {!item.type              && <Info          size={18} className="text-muted" />}
      </span>

      {/* Message */}
      <span className="flex-1 font-medium leading-snug">{item.message}</span>

      {/* Dismiss */}
      <IconButton
        variant="ghost"
        size="sm"
        label={t("dismiss")}
        icon={<X size={14} />}
        onClick={dismiss}
        className="shrink-0 size-7 min-w-7 min-h-7 rounded-lg opacity-60 hover:opacity-100"
      />

      {/* Progress bar */}
      <div
        className={`toast-progress bg-gradient-to-r ${accentCls} to-transparent opacity-60`}
        style={{ "--duration": `${dur}ms` } as React.CSSProperties}
      />
    </div>
  );
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: Toast["type"] = "info", duration = 4000) => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]); // max 5 at once
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-5 end-5 z-[9999] flex flex-col gap-2.5 w-full max-w-[360px] px-4 pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};
