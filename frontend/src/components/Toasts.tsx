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
    timerRef.current = setTimeout(() => onRemove(item.id), 180);
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
      ? "border-emerald-500/30"
      : item.type === "error"
        ? "border-rose-500/30"
        : item.type === "warning"
          ? "border-amber-500/30"
          : "border-line";

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto relative overflow-hidden flex items-center gap-2.5
        rounded-xl border bg-panel-raised px-3.5 py-2.5
        text-xs sm:text-sm text-text-main shadow-lg
        ${borderCls}
        ${leaving ? "animate-toast-out" : "animate-toast-in"}
      `}
    >
      {/* Icon */}
      <span className="shrink-0">
        {item.type === "success" && <CheckCircle2 size={16} className="text-emerald-400" />}
        {item.type === "error"   && <XCircle      size={16} className="text-rose-400" />}
        {item.type === "warning" && <AlertTriangle size={16} className="text-amber-400" />}
        {item.type === "info"    && <Info          size={16} className="text-blue-400" />}
        {!item.type              && <Info          size={16} className="text-muted" />}
      </span>

      {/* Message */}
      <span className="flex-1 font-medium leading-normal">{item.message}</span>

      {/* Dismiss */}
      <IconButton
        variant="ghost"
        size="sm"
        label={t("dismiss")}
        icon={<X size={13} />}
        onClick={dismiss}
        className="shrink-0 size-6 min-w-6 min-h-6 rounded opacity-60 hover:opacity-100"
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
      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 end-4 z-[9999] flex flex-col gap-2 w-full max-w-[340px] px-3 pointer-events-none"
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
