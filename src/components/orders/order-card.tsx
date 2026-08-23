"use client";

import Link from "next/link";
import { Clock, MessageSquare, UserRound } from "lucide-react";
import { OrderStatusBadge, Badge } from "@/components/ui/badge";
import { OrderActions } from "./order-actions";
import { CANCELLATION_REASON_LABELS } from "@/domain/labels";
import type { UserRole } from "@/domain/orders/state-machine";
import { formatCurrency, formatTime, minutesSince } from "@/lib/utils/format";
import type { OrderWithItems } from "@/lib/queries";
import { cn } from "@/lib/utils/cn";

/**
 * Cartao de pedido usado pelo garcom e pelo gerente.
 *
 * A cozinha tem o proprio cartao (kitchen/order-ticket.tsx): la a informacao
 * relevante e outra e o tamanho precisa ser bem maior.
 */
export function OrderCard({
  order,
  role,
  onDone,
  href,
}: {
  order: OrderWithItems;
  role: UserRole;
  onDone?: () => void;
  href?: string;
}) {
  const items = order.order_items.filter((item) => item.status !== "cancelled");
  const waitingMinutes = minutesSince(order.ready_at ?? order.sent_at ?? order.created_at);

  const title = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="tabular text-foreground text-base font-bold">#{order.number}</span>
      <span className="text-foreground text-base font-semibold">
        Mesa {order.tables?.number ?? "?"}
      </span>
      <OrderStatusBadge status={order.status} size="sm" />
      {order.status === "ready" ? (
        <Badge tone="success" size="sm" solid>
          ha {waitingMinutes} min
        </Badge>
      ) : null}
    </div>
  );

  return (
    <article
      className={cn(
        "bg-surface flex flex-col gap-3 rounded-[var(--radius-card)] border p-4",
        order.status === "ready" ? "border-success shadow-card" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {href ? (
          <Link href={href} className="min-w-0 hover:underline">
            {title}
          </Link>
        ) : (
          <div className="min-w-0">{title}</div>
        )}
        <span className="tabular text-foreground text-base font-bold">
          {formatCurrency(order.total)}
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className="tabular text-foreground min-w-6 font-bold">{item.quantity}x</span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground">{item.product_name}</span>
              {item.batch > 1 ? (
                <Badge tone="brand" size="sm" className="ml-2">
                  adicional
                </Badge>
              ) : null}
              {item.notes ? (
                <span className="text-warning mt-0.5 flex items-start gap-1">
                  <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
                  {item.notes}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {order.status === "cancelled" && order.cancellation_reason ? (
        <p className="bg-danger-soft text-danger rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium">
          {CANCELLATION_REASON_LABELS[order.cancellation_reason]}
          {order.cancellation_note ? ` - ${order.cancellation_note}` : ""}
        </p>
      ) : null}

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="text-foreground-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3.5" />
            {order.waiter?.name ?? "-"}
          </span>
          <span className="tabular inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatTime(order.sent_at ?? order.created_at)}
          </span>
        </div>

        <OrderActions
          order={{ id: order.id, number: order.number, status: order.status }}
          role={role}
          size="sm"
          onDone={onDone}
        />
      </div>
    </article>
  );
}
