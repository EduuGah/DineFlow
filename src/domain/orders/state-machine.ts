import type { Enums } from "@/types/database";

export type OrderStatus = Enums<"order_status">;
export type UserRole = Enums<"user_role">;

export const ORDER_STATUSES = [
  "draft",
  "sent",
  "received",
  "preparing",
  "ready",
  "delivered",
  "completed",
  "cancelled",
] as const satisfies readonly OrderStatus[];

/** Estados em que a comanda ainda ocupa a mesa e a operacao. */
export const OPEN_ORDER_STATUSES = [
  "draft",
  "sent",
  "received",
  "preparing",
  "ready",
  "delivered",
] as const satisfies readonly OrderStatus[];

/** Estados que a cozinha enxerga no KDS. */
export const KITCHEN_STATUSES = [
  "sent",
  "received",
  "preparing",
  "ready",
] as const satisfies readonly OrderStatus[];

/**
 * Camada central de transicoes (secao 15 do roadmap).
 *
 * Este mapa e o espelho exato de `app.order_transition_allowed()` no banco. O
 * banco e a autoridade -- ele barra qualquer transicao invalida venha de onde
 * vier. Esta copia existe para a UI saber quais botoes mostrar sem precisar de
 * um round-trip, e o teste `state-machine-parity` garante que as duas nunca
 * divergem.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["received", "preparing", "cancelled"],
  received: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  // ready -> preparing: a cozinha marcou pronto por engano e reabre
  // ready -> sent: um complemento entrou e a comanda volta para a fila
  ready: ["preparing", "delivered", "sent", "cancelled"],
  // delivered -> ready: o garcom marcou entrega por engano
  delivered: ["completed", "ready", "sent"],
  completed: [],
  cancelled: [],
};

/**
 * Quem pode fazer cada transicao. Espelha `app.order_transition_roles()`.
 *
 * A ordem das regras importa e e a mesma do SQL: a primeira que casar vence.
 */
export function transitionRoles(from: OrderStatus, to: OrderStatus): readonly UserRole[] {
  if (to === "cancelled") {
    // Enquanto a cozinha nao comecou, o garcom resolve sozinho. Depois que
    // virou insumo gasto, so a gerencia -- ou a cozinha, que e quem descobre
    // que o produto acabou.
    if (from === "draft") return ["waiter", "manager", "admin"];
    if (from === "sent" || from === "received") return ["waiter", "kitchen", "manager", "admin"];
    return ["kitchen", "manager", "admin"];
  }

  if (from === "draft" && to === "sent") return ["waiter", "manager", "admin"];
  if (to === "received" || to === "preparing") return ["kitchen", "manager", "admin"];
  if (from === "preparing" && to === "ready") return ["kitchen", "manager", "admin"];
  if (from === "delivered" && to === "ready") return ["manager", "admin"];
  if (to === "delivered") return ["waiter", "manager", "admin"];
  if (to === "completed") return ["waiter", "manager", "admin"];
  // Reabertura por complemento (ready/delivered -> sent)
  if (to === "sent") return ["waiter", "manager", "admin"];

  return [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canRoleTransition(from: OrderStatus, to: OrderStatus, role: UserRole): boolean {
  return canTransition(from, to) && transitionRoles(from, to).includes(role);
}

/** Transicoes que este papel pode disparar a partir do estado atual. */
export function allowedTransitions(from: OrderStatus, role: UserRole): OrderStatus[] {
  return ORDER_TRANSITIONS[from].filter((to) => transitionRoles(from, to).includes(role));
}

export function isOpen(status: OrderStatus): boolean {
  return (OPEN_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isFinal(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * Proximo passo natural do fluxo para o papel -- e o que vira o botao
 * primario na tela. A cozinha nao precisa escolher entre cinco acoes num
 * sabado a noite; ela precisa de um botao grande com a acao obvia.
 */
export function primaryAction(
  status: OrderStatus,
  role: UserRole,
): { to: OrderStatus; label: string } | null {
  const options: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> =
    role === "kitchen"
      ? {
          sent: { to: "preparing", label: "Iniciar preparo" },
          received: { to: "preparing", label: "Iniciar preparo" },
          preparing: { to: "ready", label: "Marcar pronto" },
        }
      : {
          draft: { to: "sent", label: "Enviar para a cozinha" },
          ready: { to: "delivered", label: "Entregar na mesa" },
          delivered: { to: "completed", label: "Finalizar pedido" },
        };

  const action = options[status];
  if (!action) return null;
  return canRoleTransition(status, action.to, role) ? action : null;
}
