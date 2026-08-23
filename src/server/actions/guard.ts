import "server-only";

import { getSession, type ActiveSession } from "@/lib/auth/session";
import { can, type Permission } from "@/domain/permissions";
import { DomainError } from "@/lib/errors";

/**
 * Guarda de Server Action.
 *
 * Server Action e um endpoint HTTP: qualquer pessoa autenticada pode chama-la
 * diretamente, sem passar pela tela que a esconde. Por isso a permissão e
 * verificada aqui dentro, e não apenas no componente que renderiza o botao.
 *
 * Esta e a segunda barreira, não a única -- o RLS ainda vale para toda query
 * que a action fizer.
 */
export async function assertPermission(permission: Permission): Promise<ActiveSession> {
  const session = await getSession();

  if (!session) {
    throw new DomainError("Sua sessão expirou. Entre novamente.", "UNAUTHENTICATED");
  }

  // Autenticado no Google mas ainda sem vínculo: nenhuma action de operação
  // faz sentido antes de a conta pertencer a um restaurante.
  if (!session.profile) {
    throw new DomainError("Sua conta ainda não está vinculada a um restaurante.", "NO_TENANT");
  }

  if (session.profile.status !== "active") {
    throw new DomainError("Seu acesso foi desativado.", "INACTIVE");
  }

  if (!can(session.profile.role, permission)) {
    throw new DomainError("Você não tem permissão para essa ação.", "FORBIDDEN");
  }

  return session as ActiveSession;
}

/** Igual a assertPermission, exigindo também restaurante não suspenso. */
export async function assertRestaurantPermission(
  permission: Permission,
): Promise<ActiveSession & { restaurantId: string }> {
  const session = await assertPermission(permission);

  if (!session.restaurant) {
    throw new DomainError("Sua conta ainda não está vinculada a um restaurante.", "NO_TENANT");
  }

  if (session.restaurant.status !== "active" && session.restaurant.status !== "trial") {
    throw new DomainError(
      "A assinatura do restaurante está suspensa. Fale com o administrador.",
      "SUSPENDED",
    );
  }

  return { ...session, restaurantId: session.restaurant.id };
}
