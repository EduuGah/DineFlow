"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchTablesWithOrders, type TableWithOrders } from "@/lib/queries";
import { useRealtime } from "@/hooks/use-realtime";
import { TABLE_STATUS_LABELS } from "@/domain/labels";
import { formatCurrency, minutesSince, pluralize } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SkeletonGrid } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Enums } from "@/types/database";

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "ready", label: "Prontos" },
  { value: "waiting", label: "Na cozinha" },
  { value: "occupied", label: "Ocupadas" },
  { value: "available", label: "Livres" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

/**
 * Painel de mesas do garcom.
 *
 * E a tela mais usada do sistema: precisa responder "onde tem coisa
 * esperando por mim?" antes de o garcom terminar de olhar. Por isso as mesas
 * com pedido pronto sobem para o topo e ganham destaque de cor e borda.
 */
export function TablesBoard({
  restaurantId,
  initialTables,
}: {
  restaurantId: string;
  initialTables: TableWithOrders[];
}) {
  const [tables, setTables] = useState(initialTables);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTables(await fetchTablesWithOrders(createClient()));
    } catch {
      // Falha de rede aqui nao limpa a tela: o garcom continua vendo o
      // ultimo estado conhecido ate a proxima sincronizacao.
    } finally {
      setLoading(false);
    }
  }, []);

  // Um evento de pedido muda o status da mesa por trigger, entao qualquer
  // mudanca nas duas tabelas exige recarregar o painel.
  useRealtime({
    restaurantId,
    tables: ["tables", "orders"],
    onEvent: reload,
    onSync: reload,
  });

  useEffect(() => {
    // Sincroniza tambem ao voltar para a aba: em celular o socket costuma
    // cair enquanto a tela esta apagada.
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: tables.length };
    for (const table of tables) {
      result[table.status] = (result[table.status] ?? 0) + 1;
    }
    return result;
  }, [tables]);

  const visible = useMemo(() => {
    const filtered = filter === "all" ? tables : tables.filter((table) => table.status === filter);

    // Prioridade visual: pronto > aguardando > ocupada > livre.
    const weight: Record<Enums<"table_status">, number> = {
      ready: 0,
      waiting: 1,
      occupied: 2,
      available: 3,
      closed: 4,
    };

    return [...filtered].sort((a, b) => weight[a.status] - weight[b.status] || a.number - b.number);
  }, [tables, filter]);

  if (loading) return <SkeletonGrid items={12} />;

  if (tables.length === 0) {
    return (
      <EmptyState
        icon={<UtensilsCrossed className="size-8" />}
        title="Nenhuma mesa cadastrada"
        description="Cadastre as mesas do salao para comecar a lancar pedidos."
        action={
          <Button asChild size="lg">
            <Link href="/gerente/mesas">Cadastrar mesas</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              filter === item.value
                ? "bg-brand text-brand-foreground"
                : "bg-surface-muted text-foreground-muted hover:text-foreground",
            )}
          >
            {item.label}
            <span className="tabular text-xs opacity-80">{counts[item.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="size-8" />}
          title="Nenhuma mesa neste filtro"
          description="Troque o filtro para ver as demais mesas do salao."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((table) => (
            <li key={table.id}>
              <TableCard table={table} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TableCard({ table }: { table: TableWithOrders }) {
  const label = TABLE_STATUS_LABELS[table.status];
  const openOrders = table.orders ?? [];
  const readyOrder = openOrders.find((order) => order.status === "ready");
  const total = openOrders.reduce((sum, order) => sum + Number(order.total), 0);

  const oldest = openOrders.reduce<string | null>(
    (acc, order) => (!acc || order.created_at < acc ? order.created_at : acc),
    null,
  );

  return (
    <Link
      href={`/garcom/mesa/${table.id}`}
      className={cn(
        "flex min-h-32 flex-col justify-between gap-2 rounded-[var(--radius-card)] border-2 p-4",
        "transition-colors active:scale-[0.99]",
        table.status === "ready"
          ? "border-success bg-success-soft"
          : table.status === "waiting"
            ? "border-warning/50 bg-warning-soft"
            : table.status === "occupied"
              ? "border-accent/40 bg-surface"
              : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="tabular text-foreground text-2xl font-bold">{table.number}</p>
          {table.name ? (
            <p className="text-foreground-muted truncate text-xs">{table.name}</p>
          ) : null}
        </div>
        <Badge tone={label.tone} size="sm" solid={table.status === "ready"}>
          {label.short}
        </Badge>
      </div>

      {openOrders.length === 0 ? (
        <span className="text-foreground-muted inline-flex items-center gap-1 text-sm font-medium">
          <Plus className="size-4" />
          Abrir pedido
        </span>
      ) : (
        <div className="text-sm">
          <p className="text-foreground font-semibold">
            {readyOrder
              ? `Pedido #${readyOrder.number} pronto`
              : pluralize(openOrders.length, "pedido aberto", "pedidos abertos")}
          </p>
          <p className="tabular text-foreground-muted">
            {formatCurrency(total)}
            {oldest ? ` - ha ${minutesSince(oldest)} min` : null}
          </p>
        </div>
      )}
    </Link>
  );
}
