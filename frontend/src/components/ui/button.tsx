// file: frontend/src/components/ui/button.tsx
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonVariants = {
  base: "inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-1 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]",
  variant: {
    primary:
      "bg-gradient-to-r from-brand-blue to-brand-cyan text-white shadow-md hover:shadow-lg hover:opacity-90",
    secondary:
      "border border-line bg-panel-raised text-text-main hover:bg-panel-hover hover:border-line",
    ghost:
      "text-muted hover:bg-panel-hover/70 hover:text-text-main",
    danger:
      "bg-danger text-white shadow-md shadow-danger/20 hover:bg-danger/85 hover:shadow-danger/30",
    success:
      "bg-ok text-white shadow-md shadow-ok/20 hover:bg-ok/85",
  },
  size: {
    sm: "h-9 min-h-9 rounded-lg px-3 text-xs",
    md: "h-10 min-h-10 rounded-xl px-4 text-sm",
    lg: "h-11 min-h-11 rounded-xl px-5 text-sm",
  },
  icon: {
    sm: "size-9 min-h-9 min-w-9 rounded-lg p-0",
    md: "size-10 min-h-10 min-w-10 rounded-xl p-0",
    lg: "size-11 min-h-11 min-w-11 rounded-xl p-0",
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
          <span aria-hidden className="shrink-0">
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
        pressed && "border-brand-blue/40 bg-brand-blue/15 text-brand-blue",
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
        <span aria-hidden className="shrink-0">
          {glyph}
        </span>
      )}
    </button>
  );
});
