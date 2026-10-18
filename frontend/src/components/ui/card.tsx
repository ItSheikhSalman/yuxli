// file: frontend/src/components/ui/card.tsx
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  /** Default true. Turn off when the card is a flush table or media frame. */
  padded?: boolean;
  /** Adds a subtle hover lift effect */
  hoverable?: boolean;
  /** Subtle accent border indicator */
  accent?: "blue" | "cyan" | "purple" | "green" | "amber" | "danger";
}

const ACCENT_CLASSES = {
  blue:   "border-t-2 border-t-indigo-500",
  cyan:   "border-t-2 border-t-sky-500",
  purple: "border-t-2 border-t-indigo-500",
  green:  "border-t-2 border-t-emerald-500",
  amber:  "border-t-2 border-t-amber-500",
  danger: "border-t-2 border-t-rose-500",
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, padded = true, hoverable = false, accent, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-xl border border-line bg-panel card-shadow",
        "transition-colors duration-150",
        padded && "p-4 sm:p-5",
        hoverable && "hover:border-line/80 hover:bg-panel-hover/50 cursor-pointer",
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
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-raised border border-line text-brand-accent">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm sm:text-base font-semibold tracking-tight text-text-main">
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
    <Card className={cn("border border-line bg-panel p-4 sm:p-5", className)}>
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
    <section className={cn("flex flex-col gap-3", className)}>
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
    <Card className="relative overflow-hidden transition-all duration-150 border border-line bg-panel hover:border-line/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </span>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-raised text-muted",
            tone,
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 text-2xl sm:text-3xl font-semibold font-mono tracking-tight text-text-main tabular-nums">
        {loading ? (
          <span className="skeleton inline-block h-8 w-20 rounded" />
        ) : (
          value
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-muted truncate">
          {subtitle}
        </div>
      )}
    </Card>
  );
}
