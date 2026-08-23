"use client";

import { useCallback, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchOpenOrders, type OrderWithItems } from "@/lib/queries";
import { useRealtime } from "@/hooks/use-realtime";
import { OrderCard } from "@/components/orders/order-card";
import { EmptyState, SkeletonList } from "@/components/ui/feedback";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/domain/orders/state-machine";

const FILTERS = [
  { value: "mine", label: "Meus pedidos" },
  { value: "ready", label: "Prontos" },
  { value: "all", label: "Todos abertos" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

export function WaiterOrders({
  restaurantId,
  waiterId,
  role,
  initialOrders,
}: {
  restaurantId: string;
  waiterId: string;
  role: UserRole;
  initialOrders: OrderWithItems[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<Filter>("mine");
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    try {
      setOrders(await fetchOpenOrders(createClient()));
    } catch {
      // Mantem a última lista conhecida se a rede falhar.
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtime({
    restaurantId,
    tables: ["orders", "order_items"],
    onEvent: reload,
    onSync: reload,
  });

  const visible = useMemo(() => {
    const filtered = orders.filter((order) => {
      if (order.status === "draft") return order.waiter_id === waiterId;
      if (filter === "mine") return order.waiter_id === waiterId;
      if (filter === "ready") return order.status === "ready";
      return true;
    });

    // Pronto primeiro: e o que exige ação imediata do garçom.
    return filtered.sort((a, b) => {
      if (a.status === "ready" && b.status !== "ready") return -1;
      if (b.status === "ready" && a.status !== "ready") return 1;
      return (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at);
    });
  }, [orders, filter, waiterId]);

  const counts = useMemo(
    () => ({
      mine: orders.filter((order) => order.waiter_id === waiterId).length,
      ready: orders.filter((order) => order.status === "ready").length,
      all: orders.length,
    }),
    [orders, waiterId],
  );

  if (loading) return <SkeletonList rows={3} />;

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
            <span className="tabular text-xs opacity-80">{counts[item.value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="Nenhum pedido aberto"
          description="Assim que você enviar um pedido para a cozinha ele aparece aqui."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <li key={order.id}>
              <OrderCard
                order={order}
                role={role}
                onDone={reload}
                href={order.status === "draft" ? `/garcom/mesa/${order.table_id}` : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
