"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, History } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderTimeline, type OrderWithItems } from "@/lib/queries";
import { CANCELLATION_REASON_LABELS, ORDER_STATUS_LABELS, auditActionLabel } from "@/domain/labels";
import { formatCurrency, formatDateTime, formatDuration } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, Td, Th, Tr } from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/ui/badge";
import { EmptyState, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import type { Tables } from "@/types/database";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  ...Object.entries(ORDER_STATUS_LABELS)
    .filter(([value]) => value !== "draft")
    .map(([value, label]) => ({ value, label: label.label })),
];

export function OrderHistory({
  orders,
  from,
  to,
  status,
}: {
  orders: OrderWithItems[];
  from: string;
  to: string;
  status: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<OrderWithItems | null>(null);

  function applyFilter(next: Record<string, string>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    router.push(`/gerente/pedidos?${search.toString()}`);
  }

  const visible = status ? orders.filter((order) => order.status === status) : orders;

  const revenue = visible
    .filter((order) => order.status === "delivered" || order.status === "completed")
    .reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="De" htmlFor="from">
          <Input
            id="from"
            type="date"
            defaultValue={from}
            onChange={(event) => applyFilter({ de: event.target.value })}
          />
        </Field>
        <Field label="Ate" htmlFor="to">
          <Input
            id="to"
            type="date"
            defaultValue={to}
            onChange={(event) => applyFilter({ ate: event.target.value })}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select
            id="status"
            defaultValue={status}
            onChange={(event) => applyFilter({ status: event.target.value })}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="text-foreground-muted text-sm">
        {visible.length} pedido(s) - {formatCurrency(revenue)} em pedidos entregues
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="Nenhum pedido no periodo"
          description="Ajuste as datas ou o status para ver outros pedidos."
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Mesa</Th>
              <Th>Garcom</Th>
              <Th>Status</Th>
              <Th align="center">Itens</Th>
              <Th align="right">Total</Th>
              <Th>Enviado</Th>
              <Th align="right">Preparo</Th>
              <Th align="right"></Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => {
              const prepSeconds =
                order.started_at && order.ready_at
                  ? (new Date(order.ready_at).getTime() - new Date(order.started_at).getTime()) /
                    1000
                  : null;

              return (
                <Tr key={order.id}>
                  <Td className="tabular font-bold">#{order.number}</Td>
                  <Td className="tabular">{order.tables?.number ?? "-"}</Td>
                  <Td>{order.waiter?.name ?? "-"}</Td>
                  <Td>
                    <OrderStatusBadge status={order.status} size="sm" short />
                  </Td>
                  <Td align="center" className="tabular">
                    {order.items_count}
                  </Td>
                  <Td align="right" className="tabular font-semibold">
                    {formatCurrency(order.total)}
                  </Td>
                  <Td className="tabular text-foreground-muted">
                    {formatDateTime(order.sent_at ?? order.created_at)}
                  </Td>
                  <Td align="right" className="tabular text-foreground-muted">
                    {prepSeconds == null ? "-" : formatDuration(prepSeconds)}
                  </Td>
                  <Td align="right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(order)}>
                      Detalhes
                    </Button>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      <OrderDetailDialog order={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/**
 * Detalhe com a linha do tempo (secao 18 do roadmap).
 *
 * "Onde esse pedido parou?" e a pergunta que o cliente real faz. A resposta
 * vem do audit_log, que o banco escreve por trigger -- nao depende de a
 * aplicacao ter lembrado de registrar.
 */
function OrderDetailDialog({
  order,
  onClose,
}: {
  order: OrderWithItems | null;
  onClose: () => void;
}) {
  // A linha do tempo guarda o pedido a que pertence: assim trocar de pedido
  // nao exige limpar o estado dentro do efeito, e a tela nunca mostra o
  // historico do pedido anterior enquanto o novo carrega.
  const [loaded, setLoaded] = useState<{
    orderId: string;
    logs: Tables<"audit_logs">[];
  } | null>(null);

  useEffect(() => {
    if (!order) return;

    let cancelled = false;
    void fetchOrderTimeline(createClient(), order.id).then((logs) => {
      if (!cancelled) setLoaded({ orderId: order.id, logs });
    });

    return () => {
      cancelled = true;
    };
  }, [order]);

  const timeline = order && loaded?.orderId === order.id ? loaded.logs : null;

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={(next) => !next && onClose()}
      title={order ? `Pedido #${order.number}` : ""}
      description={order ? `Mesa ${order.tables?.number ?? "?"} - ${order.waiter?.name ?? ""}` : ""}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      {order ? (
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="text-foreground mb-2 text-sm font-semibold">Itens</h3>
            <ul className="flex flex-col gap-1.5">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span className="tabular min-w-7 font-bold">{item.quantity}x</span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        item.status === "cancelled" ? "text-foreground-subtle line-through" : ""
                      }
                    >
                      {item.product_name}
                    </span>
                    {item.batch > 1 ? (
                      <span className="text-brand ml-2 text-xs font-semibold">adicional</span>
                    ) : null}
                    {item.notes ? (
                      <span className="text-warning block text-xs font-medium">{item.notes}</span>
                    ) : null}
                  </span>
                  <span className="tabular font-medium">{formatCurrency(item.total_price)}</span>
                </li>
              ))}
            </ul>
            <p className="tabular border-border mt-3 border-t pt-2 text-right text-base font-bold">
              {formatCurrency(order.total)}
            </p>
          </section>

          {order.cancellation_reason ? (
            <section className="bg-danger-soft rounded-[var(--radius-control)] px-3.5 py-3">
              <h3 className="text-danger text-sm font-semibold">Cancelamento</h3>
              <p className="text-danger text-sm">
                {CANCELLATION_REASON_LABELS[order.cancellation_reason]}
                {order.cancellation_note ? ` - ${order.cancellation_note}` : ""}
              </p>
            </section>
          ) : null}

          <section>
            <h3 className="text-foreground mb-2 flex items-center gap-2 text-sm font-semibold">
              <History className="size-4" />
              Linha do tempo
            </h3>
            {timeline === null ? (
              <SkeletonList rows={3} />
            ) : timeline.length === 0 ? (
              <p className="text-foreground-muted text-sm">Sem registros.</p>
            ) : (
              <ol className="border-border flex flex-col gap-2.5 border-l pl-4">
                {timeline.map((entry) => (
                  <li key={entry.id} className="relative text-sm">
                    <span className="bg-brand absolute top-1.5 -left-[1.3125rem] size-2 rounded-full" />
                    <span className="tabular text-foreground-subtle">
                      {formatDateTime(entry.created_at)}
                    </span>{" "}
                    <span className="text-foreground font-medium">
                      {entry.actor_name ?? "Sistema"}
                    </span>{" "}
                    <span className="text-foreground-muted">{auditActionLabel(entry.action)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}
    </Dialog>
  );
}
