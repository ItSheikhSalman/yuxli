// file: frontend/src/components/ui/button.tsx
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonVariants = {
  base: "relative inline-flex shrink-0 items-center justify-center gap-2 font-bold tracking-tight transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] cursor-pointer",
  variant: {
    primary:
      "bg-gradient-to-r from-brand-blue via-indigo-600 to-brand-cyan text-white shadow-md shadow-brand-blue/25 hover:shadow-lg hover:shadow-brand-blue/35 hover:brightness-110 border border-white/15",
    secondary:
      "border border-line/80 bg-panel-raised/90 backdrop-blur-md text-text-main hover:bg-panel-hover hover:border-brand-blue/30 shadow-sm",
    ghost:
      "text-muted hover:bg-panel-hover/80 hover:text-text-main",
    danger:
      "bg-gradient-to-r from-danger to-rose-600 text-white shadow-md shadow-danger/25 hover:shadow-lg hover:shadow-danger/35 hover:brightness-110 border border-white/10",
    success:
      "bg-gradient-to-r from-ok to-teal-500 text-white shadow-md shadow-ok/25 hover:shadow-lg hover:shadow-ok/35 hover:brightness-110 border border-white/10",
  },
  size: {
    sm: "h-9 min-h-9 rounded-xl px-3.5 text-xs font-semibold",
    md: "h-10 min-h-10 rounded-xl px-4 text-sm font-bold",
    lg: "h-11 min-h-11 rounded-2xl px-5 text-sm font-bold",
  },
  icon: {
    sm: "size-9 min-h-9 min-w-9 rounded-xl p-0",
    md: "size-10 min-h-10 min-w-10 rounded-xl p-0",
    lg: "size-11 min-h-11 min-w-11 rounded-2xl p-0",
  },
} as const;

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    icon,
    className,
    type = "button",
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants.base,
        buttonVariants.variant[variant],
        buttonVariants.size[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      ) : (
        icon && (
          <span aria-hidden className="shrink-0 flex items-center justify-center">
            {icon}
          </span>
        )
      )}
      {children}
    </button>
  );
});

export interface IconButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "children" | "aria-label"> {
  label: string;
  icon?: ReactNode;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  pressed?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    children,
    variant = "secondary",
    size = "sm",
    loading = false,
    pressed,
    className,
    type = "button",
    disabled,
    ...props
  },
  ref,
) {
  const glyph = icon ?? children;
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      aria-label={label}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants.base,
        buttonVariants.variant[variant],
        buttonVariants.icon[size],
        pressed && "border-brand-blue/50 bg-brand-blue/20 text-brand-cyan shadow-sm",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      ) : (
        <span aria-hidden className="shrink-0 flex items-center justify-center">
          {glyph}
        </span>
      )}
    </button>
  );
});
