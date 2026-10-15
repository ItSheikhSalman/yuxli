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
  blue:   "border-t-brand-blue/60",
  cyan:   "border-t-brand-cyan/60",
  purple: "border-t-brand-purple/60",
  green:  "border-t-ok/60",
  amber:  "border-t-warn/60",
  danger: "border-t-danger/60",
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, padded = true, hoverable = false, accent, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-line/70 bg-panel card-shadow",
        "transition-all duration-200",
        padded && "p-4 md:p-5",
        hoverable && "hover:border-brand-blue/25 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
        accent && `border-t-2 ${ACCENT_CLASSES[accent]}`,
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
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-text-main md:text-lg">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
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
  tone,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: string;
  loading?: boolean;
}) {
  return (
    <Card className="group transition-all hover:-translate-y-0.5 hover:border-brand-blue/20">
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-[11px] font-bold uppercase tracking-wider text-muted sm:text-xs">
          {label}
        </span>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-all group-hover:scale-110",
            tone,
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 font-mono text-2xl font-extrabold tracking-tight text-text-main sm:text-3xl">
        {loading ? (
          <span className="skeleton inline-block h-8 w-16 rounded" />
        ) : (
          value
        )}
      </div>
    </Card>
  );
}
