import type { ReactNode } from "react";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("text-foreground-muted size-5 animate-spin", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse-soft bg-surface-muted rounded-[var(--radius-control)]",
        className,
      )}
      aria-hidden
    />
  );
}

/** Esqueleto de lista -- usado enquanto pedidos/mesas carregam. */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-busy>
      <span className="sr-only">Carregando...</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function SkeletonGrid({ items = 8, className }: { items?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}
      aria-busy
    >
      <span className="sr-only">Carregando...</span>
      {Array.from({ length: items }, (_, index) => (
        <Skeleton key={index} className="h-28" />
      ))}
    </div>
  );
}

/**
 * Estado vazio (secao 11). Nunca so "nenhum resultado": sempre diz o que
 * fazer em seguida, porque quem chega aqui geralmente esta configurando o
 * sistema pela primeira vez.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)]",
        "border-border border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="text-foreground-subtle">{icon}</div> : null}
      <div>
        <p className="text-foreground text-base font-semibold">{title}</p>
        {description ? (
          <p className="text-foreground-muted mt-1 max-w-md text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Nao foi possivel carregar",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)]",
        "border-danger/30 bg-danger-soft border px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle className="text-danger size-7" />
      <div>
        <p className="text-foreground text-base font-semibold">{title}</p>
        {description ? <p className="text-foreground-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

/** Faixa de aviso; usada para o estado offline e para restaurante suspenso. */
export function Banner({
  tone = "warning",
  icon,
  children,
  action,
}: {
  tone?: "info" | "warning" | "danger";
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: "bg-info-soft text-info border-info/30",
    warning: "bg-warning-soft text-warning border-warning/30",
    danger: "bg-danger-soft text-danger border-danger/30",
  };

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3",
        "text-sm font-medium",
        tones[tone],
      )}
    >
      {icon ?? <AlertTriangle className="size-4 shrink-0" />}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function OfflineBanner() {
  return (
    <Banner tone="danger" icon={<WifiOff className="size-4 shrink-0" />}>
      Sem conexao. Os pedidos ficam guardados aqui e sao enviados assim que a internet voltar.
    </Banner>
  );
}
