import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Tabela do painel do gerente. Rola horizontalmente dentro do proprio
 * container: a pagina nunca ganha scroll lateral, nem em celular.
 */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "border-border bg-surface overflow-x-auto rounded-[var(--radius-card)] border",
        className,
      )}
    >
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-border bg-surface-muted border-b px-4 py-3",
        "text-foreground-muted text-xs font-semibold tracking-wide uppercase",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "border-border text-foreground border-b px-4 py-3",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn("hover:bg-surface-muted last:[&>td]:border-b-0", className)}>{children}</tr>
  );
}
