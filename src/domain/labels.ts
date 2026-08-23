import type { Enums } from "@/types/database";

/**
 * Vocabulario que a equipe do restaurante ve na tela.
 *
 * Os termos foram escolhidos para soarem como o salao fala, nao como o banco
 * modela: "Na cozinha" em vez de "received", "Pronto para retirada" em vez de
 * "ready".
 */

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "accent";

export type StatusLabel = {
  label: string;
  short: string;
  tone: Tone;
  description: string;
};

export const ORDER_STATUS_LABELS: Record<Enums<"order_status">, StatusLabel> = {
  draft: {
    label: "Rascunho",
    short: "Rascunho",
    tone: "neutral",
    description: "Ainda sendo montado pelo garcom. A cozinha nao ve.",
  },
  sent: {
    label: "Enviado para a cozinha",
    short: "Novo",
    tone: "info",
    description: "Na fila da cozinha, aguardando ser iniciado.",
  },
  received: {
    label: "Recebido pela cozinha",
    short: "Recebido",
    tone: "info",
    description: "A cozinha confirmou que viu o pedido.",
  },
  preparing: {
    label: "Em preparo",
    short: "Preparando",
    tone: "warning",
    description: "A cozinha esta fazendo os pratos.",
  },
  ready: {
    label: "Pronto para retirada",
    short: "Pronto",
    tone: "success",
    description: "Aguardando o garcom levar para a mesa.",
  },
  delivered: {
    label: "Entregue na mesa",
    short: "Entregue",
    tone: "accent",
    description: "O cliente ja recebeu o pedido.",
  },
  completed: {
    label: "Finalizado",
    short: "Finalizado",
    tone: "neutral",
    description: "Atendimento encerrado.",
  },
  cancelled: {
    label: "Cancelado",
    short: "Cancelado",
    tone: "danger",
    description: "Pedido cancelado; nao entra no faturamento.",
  },
};

export const TABLE_STATUS_LABELS: Record<Enums<"table_status">, StatusLabel> = {
  available: {
    label: "Livre",
    short: "Livre",
    tone: "neutral",
    description: "Sem pedido aberto.",
  },
  occupied: {
    label: "Ocupada",
    short: "Ocupada",
    tone: "accent",
    description: "Cliente na mesa, com pedido em rascunho ou ja entregue.",
  },
  waiting: {
    label: "Aguardando cozinha",
    short: "Na cozinha",
    tone: "warning",
    description: "Pedido enviado, sendo preparado.",
  },
  ready: {
    label: "Pedido pronto",
    short: "Pronto",
    tone: "success",
    description: "Tem pedido esperando para ser levado.",
  },
  closed: {
    label: "Fechada",
    short: "Fechada",
    tone: "neutral",
    description: "Mesa fora de operacao.",
  },
};

export const ROLE_LABELS: Record<Enums<"user_role">, string> = {
  waiter: "Garcom",
  kitchen: "Cozinha",
  manager: "Gerente",
  admin: "Administrador",
  platform_admin: "Administrador da plataforma",
};

export const ROLE_DESCRIPTIONS: Record<Enums<"user_role">, string> = {
  waiter: "Abre pedidos, envia para a cozinha e entrega nas mesas.",
  kitchen: "Recebe pedidos, controla o preparo e marca quando fica pronto.",
  manager: "Gerencia cardapio, mesas, equipe e acompanha a operacao.",
  admin: "Dono do restaurante. Tudo que o gerente faz, mais as configuracoes.",
  platform_admin: "Equipe DineFlow. Nao pertence a nenhum restaurante.",
};

export const CANCELLATION_REASONS: {
  value: Enums<"cancellation_reason">;
  label: string;
}[] = [
  { value: "customer_gave_up", label: "Cliente desistiu" },
  { value: "waiter_error", label: "Erro do garcom" },
  { value: "product_unavailable", label: "Produto indisponivel" },
  { value: "duplicate", label: "Pedido duplicado" },
  { value: "other", label: "Outro motivo" },
];

export const CANCELLATION_REASON_LABELS = Object.fromEntries(
  CANCELLATION_REASONS.map((reason) => [reason.value, reason.label]),
) as Record<Enums<"cancellation_reason">, string>;

/**
 * Observacoes que aparecem como atalho na tela do garcom. Sao as que a equipe
 * digita o dia inteiro; o campo livre continua disponivel para o resto.
 */
export const QUICK_NOTES = [
  "Sem cebola",
  "Sem gelo",
  "Bem passado",
  "Ao ponto",
  "Mal passado",
  "Pouco sal",
  "Molho separado",
  "Sem pimenta",
  "Sem queijo",
  "Para viagem",
] as const;

/** Traduz as acoes do log de auditoria para a linha do tempo do pedido. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "order.created": "abriu o pedido",
  "order.sent": "enviou para a cozinha",
  "order.received": "confirmou o recebimento",
  "order.preparing": "iniciou o preparo",
  "order.ready": "marcou como pronto",
  "order.delivered": "entregou na mesa",
  "order.completed": "finalizou o pedido",
  "order.cancelled": "cancelou o pedido",
  "order.complement_sent": "enviou um adicional",
  "order_item.added": "adicionou um item",
  "order_item.removed": "removeu um item",
  "table.insert": "criou a mesa",
  "table.update": "alterou a mesa",
  "table.delete": "excluiu a mesa",
  "category.insert": "criou a categoria",
  "category.update": "alterou a categoria",
  "category.delete": "excluiu a categoria",
  "product.insert": "criou o produto",
  "product.update": "alterou o produto",
  "product.delete": "excluiu o produto",
  "user.insert": "cadastrou um funcionario",
  "user.update": "alterou um funcionario",
  "user.delete": "removeu um funcionario",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}
