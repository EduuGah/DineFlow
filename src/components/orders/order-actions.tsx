"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submit } from "@/lib/offline/outbox";
import { friendlyError } from "@/lib/errors";
import {
  allowedTransitions,
  primaryAction,
  type OrderStatus,
  type UserRole,
} from "@/domain/orders/state-machine";
import { CANCELLATION_REASONS, ORDER_STATUS_LABELS } from "@/domain/labels";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { Enums } from "@/types/database";

type OrderSummary = { id: string; number: number; status: OrderStatus };

/**
 * Botoes de acao de um pedido.
 *
 * As opcoes vem da maquina de estados filtrada pelo papel -- a tela nunca
 * mostra um botao que o banco vai recusar. Mesmo assim, o erro do servidor e
 * tratado: entre o render e o clique, outra pessoa pode ter movido o pedido.
 */
export function OrderActions({
  order,
  role,
  size = "md",
  onDone,
}: {
  order: OrderSummary;
  role: UserRole;
  size?: "sm" | "md" | "lg" | "xl";
  onDone?: () => void;
}) {
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const primary = primaryAction(order.status, role);
  const others = allowedTransitions(order.status, role).filter(
    (status) => status !== "cancelled" && status !== primary?.to,
  );
  const canCancel = allowedTransitions(order.status, role).includes("cancelled");

  async function move(status: OrderStatus) {
    setPending(status);
    try {
      await submit({
        kind: "order.status",
        id: crypto.randomUUID(),
        orderId: order.id,
        status,
      });
      onDone?.();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setPending(null);
    }
  }

  if (!primary && others.length === 0 && !canCancel) return null;

  return (
    <div className="flex items-center gap-2">
      {primary ? (
        <Button
          size={size}
          onClick={() => void move(primary.to)}
          loading={pending === primary.to}
          loadingText="Aguarde..."
        >
          {primary.label}
        </Button>
      ) : null}

      {others.length > 0 || canCancel ? (
        <Dropdown
          trigger={
            <Button
              size={size}
              variant="outline"
              aria-label="Outras acoes"
              icon={<ChevronDown className="size-4" />}
            >
              {primary ? "" : "Acoes"}
            </Button>
          }
        >
          <DropdownLabel>Pedido #{order.number}</DropdownLabel>
          {others.map((status) => (
            <DropdownItem key={status} onSelect={() => void move(status)}>
              {ORDER_STATUS_LABELS[status].label}
            </DropdownItem>
          ))}
          {canCancel ? (
            <DropdownItem
              destructive
              icon={<Ban className="size-4" />}
              onSelect={() => setCancelOpen(true)}
            >
              Cancelar pedido
            </DropdownItem>
          ) : null}
        </Dropdown>
      ) : null}

      <CancelOrderDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        order={order}
        onDone={onDone}
      />
    </div>
  );
}

/**
 * Cancelamento com motivo obrigatorio (secao 17 do roadmap).
 *
 * O motivo nao e burocracia: e o que permite ao gerente descobrir depois que
 * metade dos cancelamentos foi "produto indisponivel" num item so.
 */
export function CancelOrderDialog({
  open,
  onOpenChange,
  order,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderSummary;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState<Enums<"cancellation_reason">>("customer_gave_up");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCancel() {
    setSaving(true);
    try {
      // Cancelamento nao entra na fila offline: precisa de confirmacao do
      // servidor agora. Cancelar "no escuro" um prato que ja foi feito e pior
      // do que avisar o garcom que a rede caiu.
      const { error } = await createClient()
        .from("orders")
        .update({
          status: "cancelled",
          cancellation_reason: reason,
          cancellation_note: note.trim() || null,
        })
        .eq("id", order.id);

      if (error) throw error;

      toast.success(`Pedido #${order.number} cancelado.`);
      onOpenChange(false);
      setNote("");
      onDone?.();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancelar pedido #${order.number}`}
      description="O pedido sai da fila da cozinha e fica registrado no historico."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Voltar
          </Button>
          <Button variant="danger" onClick={() => void handleCancel()} loading={saving}>
            Cancelar pedido
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Motivo" htmlFor="cancel-reason" required>
          <Select
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as Enums<"cancellation_reason">)}
          >
            {CANCELLATION_REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Detalhes"
          htmlFor="cancel-note"
          hint="Opcional, mas ajuda muito na hora de entender o relatorio."
        >
          <Textarea
            id="cancel-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Ex.: cliente precisou sair antes do prato ficar pronto"
          />
        </Field>
      </div>
    </Dialog>
  );
}
