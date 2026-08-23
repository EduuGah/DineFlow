import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Voltar",
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="text-foreground-muted hover:text-foreground mb-1 inline-flex items-center gap-1 text-sm font-medium"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        ) : null}
        <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="text-foreground-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PageContainer({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6",
        wide ? "max-w-[110rem]" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
