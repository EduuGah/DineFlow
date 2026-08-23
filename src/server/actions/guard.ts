import "server-only";

import { getSession, type ActiveSession } from "@/lib/auth/session";
import { can, type Permission } from "@/domain/permissions";
import { DomainError } from "@/lib/errors";

/**
 * Guarda de Server Action.
 *
 * Server Action e um endpoint HTTP: qualquer pessoa autenticada pode chama-la
 * diretamente, sem passar pela tela que a esconde. Por isso a permissao e
 * verificada aqui dentro, e nao apenas no componente que renderiza o botao.
 *
 * Esta e a segunda barreira, nao a unica -- o RLS ainda vale para toda query
 * que a action fizer.
 */
export async function assertPermission(permission: Permission): Promise<ActiveSession> {
  const session = await getSession();

  if (!session) {
    throw new DomainError("Sua sessao expirou. Entre novamente.", "UNAUTHENTICATED");
  }

  // Autenticado no Google mas ainda sem vinculo: nenhuma action de operacao
  // faz sentido antes de a conta pertencer a um restaurante.
  if (!session.profile) {
    throw new DomainError("Sua conta ainda nao esta vinculada a um restaurante.", "NO_TENANT");
  }

  if (session.profile.status !== "active") {
    throw new DomainError("Seu acesso foi desativado.", "INACTIVE");
  }

  if (!can(session.profile.role, permission)) {
    throw new DomainError("Voce nao tem permissao para essa acao.", "FORBIDDEN");
  }

  return session as ActiveSession;
}

/** Igual a assertPermission, exigindo tambem restaurante nao suspenso. */
export async function assertRestaurantPermission(
  permission: Permission,
): Promise<ActiveSession & { restaurantId: string }> {
  const session = await assertPermission(permission);

  if (!session.restaurant) {
    throw new DomainError("Sua conta ainda nao esta vinculada a um restaurante.", "NO_TENANT");
  }

  if (session.restaurant.status !== "active" && session.restaurant.status !== "trial") {
    throw new DomainError(
      "A assinatura do restaurante esta suspensa. Fale com o administrador.",
      "SUSPENDED",
    );
  }

  return { ...session, restaurantId: session.restaurant.id };
}
