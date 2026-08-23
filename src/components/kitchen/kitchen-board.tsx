"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Inbox, Flame, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchKitchenOrders, type OrderWithItems } from "@/lib/queries";
import { useRealtime } from "@/hooks/use-realtime";
import { useTicker } from "@/hooks/use-ticker";
import { playAlert, unlockAudio } from "@/lib/sound";
import { RealtimeIndicator } from "@/components/shared/sync-indicator";
import { EmptyState, SkeletonList } from "@/components/ui/feedback";
import { OrderTicket, LATE_AFTER_SECONDS } from "./order-ticket";
import { secondsSince } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/domain/orders/state-machine";

const COLUMNS = [
  {
    key: "new" as const,
    title: "Novos",
    icon: Inbox,
    statuses: ["sent", "received"] as const,
    accent: "text-info",
  },
  {
    key: "preparing" as const,
    title: "Em preparo",
    icon: Flame,
    statuses: ["preparing"] as const,
    accent: "text-warning",
  },
  {
    key: "ready" as const,
    title: "Prontos",
    icon: CheckCircle2,
    statuses: ["ready"] as const,
    accent: "text-success",
  },
];

/**
 * Kitchen Display System (secoes 12 e 37 do roadmap).
 *
 * Nao e uma tela administrativa com filtros e menus: sao tres colunas, cartoes
 * grandes e um botao obvio por cartao. A cozinha nao "navega" no sistema --
 * ela olha, toca e volta para a chapa.
 */
export function KitchenBoard({
  restaurantId,
  role,
  initialOrders,
}: {
  restaurantId: string;
  role: UserRole;
  initialOrders: OrderWithItems[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));

  // Cronometro proprio: os cartoes envelhecem mesmo sem evento novo.
  useTicker(10_000);

  const reload = useCallback(async () => {
    try {
      const fresh = await fetchKitchenOrders(createClient());

      // Apita apenas para comanda que a cozinha ainda nao viu. Reconexao
      // reenvia eventos antigos, e um KDS que apita a cada reconexao e um KDS
      // com o som desligado no fim da primeira noite.
      const hasNew = fresh.some(
        (order) => !knownIds.current.has(order.id) && order.status === "sent",
      );

      knownIds.current = new Set(fresh.map((order) => order.id));
      setOrders(fresh);

      if (hasNew) playAlert("newOrder");
    } catch {
      // Mantem a fila em tela; o proximo sync corrige.
    } finally {
      setLoading(false);
    }
  }, []);

  const status = useRealtime({
    restaurantId,
    tables: ["orders", "order_items"],
    onEvent: reload,
    onSync: reload,
  });

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const grouped = useMemo(() => {
    const result = {
      new: [] as OrderWithItems[],
      preparing: [] as OrderWithItems[],
      ready: [] as OrderWithItems[],
    };

    for (const order of orders) {
      const column = COLUMNS.find((item) =>
        (item.statuses as readonly string[]).includes(order.status),
      );
      if (column) result[column.key].push(order);
    }

    // Mais antigo primeiro em todas as colunas: quem esperou mais sai antes.
    for (const key of Object.keys(result) as (keyof typeof result)[]) {
      result[key].sort((a, b) =>
        (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at),
      );
    }

    return result;
  }, [orders]);

  const lateCount = orders.filter(
    (order) =>
      order.status !== "ready" &&
      secondsSince(order.sent_at ?? order.created_at) >= LATE_AFTER_SECONDS,
  ).length;

  if (loading) return <SkeletonList rows={4} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <RealtimeIndicator status={status} />
        {lateCount > 0 ? (
          <span className="bg-danger inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-white">
            {lateCount} pedido(s) atrasado(s)
          </span>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ChefHat className="size-8" />}
          title="Nenhum pedido na fila"
          description="Assim que um garcom enviar um pedido, ele aparece aqui automaticamente."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((column) => (
            <section key={column.key} className="flex min-w-0 flex-col gap-3">
              <h2 className="text-foreground flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
                <column.icon className={cn("size-4", column.accent)} />
                {column.title}
                <span className="tabular bg-surface-muted text-foreground-muted ml-auto rounded-full px-2.5 py-0.5 text-xs">
                  {grouped[column.key].length}
                </span>
              </h2>

              {grouped[column.key].length === 0 ? (
                <p className="border-border text-foreground-subtle rounded-[var(--radius-card)] border border-dashed px-4 py-8 text-center text-sm">
                  Vazio
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {grouped[column.key].map((order) => (
                    <li key={order.id}>
                      <OrderTicket order={order} role={role} onDone={reload} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
