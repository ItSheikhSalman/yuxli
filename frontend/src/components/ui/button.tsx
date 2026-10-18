// file: frontend/src/components/ui/button.tsx
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonVariants = {
  base: "relative inline-flex shrink-0 items-center justify-center gap-2 font-medium text-sm tracking-normal transition-all duration-120 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] cursor-pointer rounded-lg",
  variant: {
    primary:
      "bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs border border-indigo-500/30",
    secondary:
      "border border-line bg-panel-raised text-text-main hover:bg-panel-hover hover:border-line/80 shadow-xs",
    ghost:
      "text-muted hover:bg-panel-hover hover:text-text-main border border-transparent",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-xs border border-rose-500/30",
    success:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs border border-emerald-500/30",
  },
  size: {
    sm: "h-8 min-h-8 px-2.5 text-xs font-medium rounded-md",
    md: "h-9 min-h-9 px-3.5 text-xs sm:text-sm font-medium rounded-lg",
    lg: "h-10 min-h-10 px-4 text-sm font-medium rounded-lg",
  },
  icon: {
    sm: "size-8 min-h-8 min-w-8 p-0 rounded-md",
    md: "size-9 min-h-9 min-w-9 p-0 rounded-lg",
    lg: "size-10 min-h-10 min-w-10 p-0 rounded-lg",
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
          className="size-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
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
        pressed && "border-indigo-500/40 bg-indigo-500/10 text-indigo-400",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      ) : (
        <span aria-hidden className="shrink-0 flex items-center justify-center">
          {glyph}
        </span>
      )}
    </button>
  );
});
