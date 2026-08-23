import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traducao de erro para linguagem de restaurante.
 *
 * Um garçom no meio do movimento não pode receber "new row violates row-level
 * security policy". Os códigos DF00x são levantados pelos triggers do banco
 * (ver supabase/migrations/..._orders.sql) justamente para que a mensagem
 * chegue aqui identificavel.
 */

const SQLSTATE_MESSAGES: Record<string, string> = {
  DF001: "Esse pedido não pode mudar para esse status agora. Atualize a tela e tente de novo.",
  DF002: "Você não tem permissão para essa ação.",
  DF003: "Esse produto está indisponível no momento.",
  DF004: "Esse pedido já foi para a cozinha e não aceita mais essa alteração.",
  DF005: "Não há itens novos para enviar.",
  DF006: "Sua conta já está vinculada a um restaurante.",
  DF007: "Informe o nome do restaurante.",

  // Codigos padrao do Postgres que aparecem com frequência na operação.
  "23505": "Esse registro já existe.",
  "23503": "Esse item depende de outro registro que não existe mais.",
  "23514": "Alguns dados não passaram na validação.",
  "42501": "Você não tem permissão para essa ação.",
  PGRST301: "Sua sessão expirou. Entre novamente.",

  /*
   * Banco desatualizado em relacao ao código.
   *
   * Acontece quando um deploy sobe sem as migrations correspondentes: a tela
   * chama algo que ainda não existe no banco. A mensagem aponta para a causa
   * porque quem ve isso e quem instalou o sistema, não o garçom.
   */
  "42P01": "O banco de dados está desatualizado (tabela ausente). Aplique as migrations pendentes.",
  "42883": "O banco de dados está desatualizado (funcao ausente). Aplique as migrations pendentes.",
  PGRST202:
    "O banco de dados está desatualizado: esta operação ainda não existe nele. Aplique as migrations pendentes (npm run db:push).",
};

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  staff_invitations_pending_email_key: "Já existe um convite pendente para esse e-mail.",
  orders_restaurant_id_client_request_id_key: "Esse pedido já foi enviado.",
  tables_restaurant_id_number_key: "Já existe uma mesa com esse número.",
  categories_restaurant_id_name_key: "Já existe uma categoria com esse nome.",
  users_restaurant_email_key: "Já existe um funcionário com esse e-mail.",
  restaurants_slug_key: "Já existe um restaurante com esse endereço.",
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

/** Erro de idempotencia: a mesma operação já tinha sido registrada. */
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

  // Violacao de RLS chega sem código DF: o usuário mirou dado de outro tenant
  // ou perdeu a permissão. Não vale detalhar qual dos dois.
  if (pg?.message?.includes("row-level security")) {
    return "Você não tem acesso a esse dado.";
  }

  if (pg?.message?.includes("Failed to fetch") || pg?.message?.includes("NetworkError")) {
    return "Sem conexão. Verifique a internet e tente de novo.";
  }

  return "Não foi possível concluir a operação. Tente de novo.";
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
   * A tela mostra só o que ajuda quem esta atendendo; quem opera o sistema
   * precisa do resto. Sem isto, um erro sem código conhecido vira "não foi
   * possível concluir a operação" e desaparece -- sem nenhum rastro de onde
   * procurar.
   */
  if (typeof window === "undefined") {
    const pg = error as Partial<PostgrestError> & { message?: string };
    console.error(
      "[dineflow] ação falhou:",
      [pg?.code, pg?.message ?? String(error), pg?.details, pg?.hint].filter(Boolean).join(" | "),
    );
  }

  return { ok: false, error: friendlyError(error), fieldErrors };
}
