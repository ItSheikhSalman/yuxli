// file: frontend/src/components/ui/badge.tsx
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn";

export type BadgeTone = "ok" | "warn" | "danger" | "info" | "neutral" | "purple";

const TONE: Record<BadgeTone, string> = {
  ok:      "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  warn:    "border-amber-500/25 bg-amber-500/10 text-amber-400",
  danger:  "border-rose-500/25 bg-rose-500/10 text-rose-400",
  info:    "border-blue-500/25 bg-blue-500/10 text-blue-400",
  neutral: "border-line bg-panel-raised text-muted",
  purple:  "border-indigo-500/25 bg-indigo-500/10 text-indigo-400",
};

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-normal",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusPill({
  dot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps & { dot?: boolean; pulse?: boolean; children?: ReactNode }) {
  return (
    <Badge {...props}>
      {dot && (
        <span className={cn("size-1.5 shrink-0 rounded-full bg-current", pulse && "pulse-dot")} />
      )}
      {children}
    </Badge>
  );
}

/** A small numeric count badge */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white leading-none",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
