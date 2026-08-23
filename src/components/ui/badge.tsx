import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { ORDER_STATUS_LABELS, TABLE_STATUS_LABELS } from "@/domain/labels";
import type { Enums } from "@/types/database";

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "accent" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-foreground-muted",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
  brand: "bg-brand-soft text-brand",
};

const SOLID: Record<Tone, string> = {
  neutral: "bg-foreground-subtle text-background",
  info: "bg-info text-white",
  warning: "bg-warning text-black",
  success: "bg-success text-white",
  danger: "bg-danger text-white",
  accent: "bg-accent text-white",
  brand: "bg-brand text-brand-foreground",
};

export function Badge({
  tone = "neutral",
  solid = false,
  size = "md",
  className,
  children,
}: {
  tone?: Tone;
  solid?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        solid ? SOLID[tone] : TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function OrderStatusBadge({
  status,
  size = "md",
  solid = false,
  short = false,
}: {
  status: Enums<"order_status">;
  size?: "sm" | "md" | "lg";
  solid?: boolean;
  short?: boolean;
}) {
  const label = ORDER_STATUS_LABELS[status];
  return (
    <Badge tone={label.tone} size={size} solid={solid}>
      {short ? label.short : label.label}
    </Badge>
  );
}

export function TableStatusBadge({
  status,
  size = "md",
}: {
  status: Enums<"table_status">;
  size?: "sm" | "md" | "lg";
}) {
  const label = TABLE_STATUS_LABELS[status];
  return (
    <Badge tone={label.tone} size={size}>
      {label.short}
    </Badge>
  );
}

/** Contador de não-lidas. Some sozinho no zero para não virar ruido visual. */
export function CountBadge({ count, tone = "danger" }: { count: number; tone?: Tone }) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "tabular inline-flex min-w-5 items-center justify-center rounded-full px-1.5",
        "text-xs font-bold",
        SOLID[tone],
      )}
      aria-label={`${count} não lidas`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
