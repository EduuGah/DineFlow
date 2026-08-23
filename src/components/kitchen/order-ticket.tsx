"use client";

import { AlarmClock, MessageSquare, UserRound } from "lucide-react";
import { OrderActions } from "@/components/orders/order-actions";
import { Badge } from "@/components/ui/badge";
import { formatDuration, secondsSince } from "@/lib/utils/format";
import type { OrderWithItems } from "@/lib/queries";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/domain/orders/state-machine";

/** Acima disso o pedido pisca em vermelho: alguem esta esperando demais. */
export const LATE_AFTER_SECONDS = 15 * 60;
const WARN_AFTER_SECONDS = 8 * 60;

/**
 * Comanda da cozinha.
 *
 * Regras de leitura a distancia (secao 37): quantidade em corpo grande a
 * esquerda, nome do prato em seguida, observação SEMPRE destacada em amarelo.
 * "Sem cebola" não pode competir visualmente com o resto -- e a linha que
 * causa prato devolvido.
 */
export function OrderTicket({
  order,
  role,
  onDone,
}: {
  order: OrderWithItems;
  role: UserRole;
  onDone?: () => void;
}) {
  const reference = order.status === "ready" ? order.ready_at : order.sent_at;
  const elapsed = secondsSince(reference ?? order.created_at);

  const late = order.status !== "ready" && elapsed >= LATE_AFTER_SECONDS;
  const warning = order.status !== "ready" && !late && elapsed >= WARN_AFTER_SECONDS;

  const items = order.order_items
    .filter((item) => item.status !== "cancelled")
    .sort((a, b) => a.batch - b.batch || a.created_at.localeCompare(b.created_at));

  const hasComplement = items.some((item) => item.batch > 1);

  return (
    <article
      className={cn(
        "bg-surface flex flex-col gap-3 rounded-[var(--radius-card)] border-2 p-4",
        late
          ? "animate-pulse-soft border-danger"
          : warning
            ? "border-warning"
            : order.status === "ready"
              ? "border-success"
              : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-foreground text-3xl leading-none font-extrabold">
            #{order.number}
          </p>
          <p className="text-foreground mt-1 text-lg font-bold">
            Mesa {order.tables?.number ?? "?"}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span
            className={cn(
              "tabular inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold",
              late
                ? "bg-danger text-white"
                : warning
                  ? "bg-warning-soft text-warning"
                  : "bg-surface-muted text-foreground-muted",
            )}
          >
            <AlarmClock className="size-4" />
            {formatDuration(elapsed)}
          </span>
          {hasComplement ? (
            <Badge tone="brand" size="sm" solid>
              Tem adicional
            </Badge>
          ) : null}
        </div>
      </header>

      <ul className="flex flex-col gap-2.5">
        {items.map((item, index) => {
          const startsNewBatch = index > 0 && item.batch !== items[index - 1].batch;

          return (
            <li key={item.id}>
              {startsNewBatch ? (
                <p className="border-border text-brand mt-1 mb-2 border-t border-dashed pt-2 text-xs font-bold tracking-wide uppercase">
                  Adicional
                </p>
              ) : null}

              <div className="flex items-start gap-3">
                <span className="tabular text-brand min-w-9 text-2xl leading-tight font-extrabold">
                  {item.quantity}x
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-lg leading-snug font-semibold">
                    {item.product_name}
                  </p>
                  {item.notes ? (
                    <p className="bg-warning-soft text-warning mt-1 flex items-start gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-base font-bold">
                      <MessageSquare className="mt-0.5 size-4 shrink-0" />
                      {item.notes}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {order.notes ? (
        <p className="bg-warning-soft text-warning rounded-[var(--radius-control)] px-3 py-2 text-base font-bold">
          Pedido: {order.notes}
        </p>
      ) : null}

      <footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-foreground-muted inline-flex items-center gap-1.5 text-sm">
          <UserRound className="size-4" />
          {order.waiter?.name ?? "-"}
        </span>
        <OrderActions
          order={{ id: order.id, number: order.number, status: order.status }}
          role={role}
          size="lg"
          onDone={onDone}
        />
      </footer>
    </article>
  );
}
