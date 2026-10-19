// file: frontend/src/components/ui/tabs.tsx
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface TabOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface TabBarProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly TabOption<T>[];
  "aria-label": string;
  className?: string;
}

function navigateTabs<T extends string>(event: KeyboardEvent<HTMLButtonElement>, index: number, options: readonly TabOption<T>[], onChange: (value: T) => void) {
  const parent = event.currentTarget.parentElement;
  if (!parent || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const direction = getComputedStyle(parent).direction === "rtl" ? -1 : 1;
  const delta = event.key === "ArrowRight" ? direction : -direction;
  const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + delta + options.length) % options.length;
  event.preventDefault();
  onChange(options[next].value);
  parent.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: TabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center rounded-lg border border-line bg-panel-raised/60 p-0.5", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => navigateTabs(event, index, options, onChange)}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all duration-120 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500",
              selected
                ? "bg-panel text-text-main shadow-xs border border-line font-semibold"
                : "text-muted hover:text-text-main border border-transparent",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Separate pills for a scrolling tab strip (Sticker Studio, Settings). */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: TabBarProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex items-center gap-1.5 overflow-x-auto no-scrollbar", className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => navigateTabs(event, index, options, onChange)}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors duration-120 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500",
              selected
                ? "bg-indigo-600 text-white shadow-xs font-semibold"
                : "border border-line/70 bg-panel text-muted hover:bg-panel-hover hover:text-text-main",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
