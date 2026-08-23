import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-foreground hover:bg-brand-hover shadow-card",
  secondary: "bg-surface-muted text-foreground hover:bg-border",
  outline: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
  danger: "bg-danger text-white hover:brightness-110 shadow-card",
  success: "bg-success text-white hover:brightness-110 shadow-card",
};

/*
 * As alturas não são decorativas. `lg` (48px) e o mínimo confortavel para um
 * garçom tocando com o polegar enquanto segura uma bandeja; `xl` (64px) e o
 * tamanho das ações do KDS, tocadas de longe e com a mao ocupada.
 */
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  xl: "h-16 px-6 text-lg gap-2.5",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  asChild?: boolean;
  fullWidth?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  icon,
  asChild = false,
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";

  return (
    <Component
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-control)] font-semibold",
        "transition-[background-color,color,filter,opacity] duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        "select-none",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
          {loading && loadingText ? loadingText : children}
        </>
      )}
    </Component>
  );
}
