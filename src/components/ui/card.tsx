import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-surface shadow-card rounded-[var(--radius-card)] border",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        {description ? <p className="text-foreground-muted mt-0.5 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

/** Número grande com rotulo -- os cartoes do dashboard do gerente. */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "info" | "warning" | "success" | "danger" | "accent";
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "text-foreground",
    info: "text-info",
    warning: "text-warning",
    success: "text-success",
    danger: "text-danger",
    accent: "text-accent",
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-foreground-muted text-sm font-medium">{label}</p>
        {icon ? <span className={cn("shrink-0", tones[tone])}>{icon}</span> : null}
      </div>
      <p className={cn("tabular mt-2 text-3xl font-bold", tones[tone])}>{value}</p>
      {hint ? <p className="text-foreground-subtle mt-1 text-sm">{hint}</p> : null}
    </Card>
  );
}
