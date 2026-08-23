import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traducao de erro para linguagem de restaurante.
 *
 * Um garcom no meio do movimento nao pode receber "new row violates row-level
 * security policy". Os codigos DF00x sao levantados pelos triggers do banco
 * (ver supabase/migrations/..._orders.sql) justamente para que a mensagem
 * chegue aqui identificavel.
 */

const SQLSTATE_MESSAGES: Record<string, string> = {
  DF001: "Esse pedido nao pode mudar para esse status agora. Atualize a tela e tente de novo.",
  DF002: "Voce nao tem permissao para essa acao.",
  DF003: "Esse produto esta indisponivel no momento.",
  DF004: "Esse pedido ja foi para a cozinha e nao aceita mais essa alteracao.",
  DF005: "Nao ha itens novos para enviar.",
  DF006: "Sua conta ja esta vinculada a um restaurante.",
  DF007: "Informe o nome do restaurante.",

  // Codigos padrao do Postgres que aparecem com frequencia na operacao.
  "23505": "Esse registro ja existe.",
  "23503": "Esse item depende de outro registro que nao existe mais.",
  "23514": "Alguns dados nao passaram na validacao.",
  "42501": "Voce nao tem permissao para essa acao.",
  PGRST301: "Sua sessao expirou. Entre novamente.",

  /*
   * Banco desatualizado em relacao ao codigo.
   *
   * Acontece quando um deploy sobe sem as migrations correspondentes: a tela
   * chama algo que ainda nao existe no banco. A mensagem aponta para a causa
   * porque quem ve isso e quem instalou o sistema, nao o garcom.
   */
  "42P01": "O banco de dados esta desatualizado (tabela ausente). Aplique as migrations pendentes.",
  "42883": "O banco de dados esta desatualizado (funcao ausente). Aplique as migrations pendentes.",
  PGRST202:
    "O banco de dados esta desatualizado: esta operacao ainda nao existe nele. Aplique as migrations pendentes (npm run db:push).",
};

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  staff_invitations_pending_email_key: "Ja existe um convite pendente para esse e-mail.",
  orders_restaurant_id_client_request_id_key: "Esse pedido ja foi enviado.",
  tables_restaurant_id_number_key: "Ja existe uma mesa com esse numero.",
  categories_restaurant_id_name_key: "Ja existe uma categoria com esse nome.",
  users_restaurant_email_key: "Ja existe um funcionario com esse e-mail.",
  restaurants_slug_key: "Ja existe um restaurante com esse endereco.",
};

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string = "DOMAIN_ERROR",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Erro de idempotencia: a mesma operacao ja tinha sido registrada. */
export function isDuplicateRequest(error: unknown): boolean {
  const pg = error as Partial<PostgrestError> | null;
  return (
    pg?.code === "23505" &&
    typeof pg.message === "string" &&
    pg.message.includes("client_request_id")
  );
}

export function friendlyError(error: unknown): string {
  if (error instanceof DomainError) return error.message;

  const pg = error as Partial<PostgrestError> & { message?: string };

  if (pg?.message) {
    for (const [constraint, message] of Object.entries(UNIQUE_CONSTRAINT_MESSAGES)) {
      if (pg.message.includes(constraint)) return message;
    }
  }

  if (pg?.code && SQLSTATE_MESSAGES[pg.code]) {
    return SQLSTATE_MESSAGES[pg.code];
  }

  // Violacao de RLS chega sem codigo DF: o usuario mirou dado de outro tenant
  // ou perdeu a permissao. Nao vale detalhar qual dos dois.
  if (pg?.message?.includes("row-level security")) {
    return "Voce nao tem acesso a esse dado.";
  }

  if (pg?.message?.includes("Failed to fetch") || pg?.message?.includes("NetworkError")) {
    return "Sem conexao. Verifique a internet e tente de novo.";
  }

  return "Nao foi possivel concluir a operacao. Tente de novo.";
}

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  /*
   * No servidor, o motivo real vai para o log.
   *
   * A tela mostra so o que ajuda quem esta atendendo; quem opera o sistema
   * precisa do resto. Sem isto, um erro sem codigo conhecido vira "nao foi
   * possivel concluir a operacao" e desaparece -- sem nenhum rastro de onde
   * procurar.
   */
  if (typeof window === "undefined") {
    const pg = error as Partial<PostgrestError> & { message?: string };
    console.error(
      "[dineflow] acao falhou:",
      [pg?.code, pg?.message ?? String(error), pg?.details, pg?.hint].filter(Boolean).join(" | "),
    );
  }

  return { ok: false, error: friendlyError(error), fieldErrors };
}
