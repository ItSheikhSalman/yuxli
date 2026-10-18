// file: frontend/src/components/ui/card.tsx
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  /** Default true. Turn off when the card is a flush table or media frame. */
  padded?: boolean;
  /** Adds a subtle hover lift effect */
  hoverable?: boolean;
  /** Adds a colored gradient top border */
  accent?: "blue" | "cyan" | "purple" | "green" | "amber" | "danger";
}

const ACCENT_CLASSES = {
  blue:   "border-t-2 border-t-brand-blue shadow-[0_-4px_16px_rgba(37,99,235,0.25)]",
  cyan:   "border-t-2 border-t-brand-cyan shadow-[0_-4px_16px_rgba(6,182,212,0.25)]",
  purple: "border-t-2 border-t-brand-purple shadow-[0_-4px_16px_rgba(168,85,247,0.25)]",
  green:  "border-t-2 border-t-ok shadow-[0_-4px_16px_rgba(16,185,129,0.25)]",
  amber:  "border-t-2 border-t-warn shadow-[0_-4px_16px_rgba(245,158,11,0.25)]",
  danger: "border-t-2 border-t-danger shadow-[0_-4px_16px_rgba(239,68,68,0.25)]",
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, padded = true, hoverable = false, accent, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-2xl border border-line/80 bg-panel/90 backdrop-blur-xl card-shadow",
        "transition-all duration-200",
        padded && "p-4 sm:p-5 md:p-6",
        hoverable && "hover:border-brand-blue/35 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 cursor-pointer",
        accent && ACCENT_CLASSES[accent],
        className,
      )}
      {...props}
    />
  );
});

/** Same surface as Card. */
export const Panel = Card;

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-cyan/15 to-brand-blue/15 text-brand-cyan border border-brand-cyan/25 shadow-sm">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-tight text-text-main md:text-lg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  className,
  ...props
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader {...props} />
    </Card>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3.5", className)}>
      {title && <CardHeader title={title} description={description} actions={actions} />}
      {children}
    </section>
  );
}

/** Stat card — number + label + icon */
export function StatCard({
  label,
  value,
  icon,
  subtitle,
  tone,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  subtitle?: ReactNode;
  tone?: string;
  loading?: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:border-line/90 hover:shadow-md">
      <div className="relative flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          {label}
        </span>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border border-line/60 bg-surface/50 text-text-main transition-all duration-200 group-hover:scale-105 shadow-sm",
            tone,
          )}
        >
          {icon}
        </div>
      </div>
      <div className="relative mt-2 text-2xl sm:text-3xl font-extrabold font-sans tracking-tight text-text-main tabular-nums">
        {loading ? (
          <span className="skeleton inline-block h-8 w-20 rounded-md" />
        ) : (
          value
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-muted truncate font-medium">
          {subtitle}
        </div>
      )}
    </Card>
  );
}
