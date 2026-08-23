import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission } from "@/domain/permissions";
import type { Tables } from "@/types/database";

export type Profile = Tables<"users">;
export type Restaurant = Tables<"restaurants">;

/**
 * Sessao do usuario.
 *
 * `profile` e nulo de propósito: com login via Google existe um estado real e
 * legitimo em que a pessoa esta autenticada mas ainda nao pertence a nenhum
 * restaurante -- o dono no primeiro acesso, antes de cadastrar a casa. Tratar
 * isso como "sem sessao" jogaria essa pessoa de volta para o login num laco.
 */
export type Session = {
  userId: string;
  email: string;
  profile: Profile | null;
  restaurant: Restaurant | null;
};

/** Sessao com perfil garantido, para as telas de operacao. */
export type ActiveSession = Session & { profile: Profile };

/**
 * `cache()` do React deduplica dentro de uma mesma renderizacao: o layout, a
 * pagina e cada Server Component podem chamar a vontade sem multiplicar
 * queries.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: restaurant } = profile?.restaurant_id
    ? await supabase.from("restaurants").select("*").eq("id", profile.restaurant_id).maybeSingle()
    : { data: null };

  return {
    userId: user.id,
    email: user.email ?? profile?.email ?? "",
    profile: profile ?? null,
    restaurant: restaurant ?? null,
  };
});

/** Exige apenas estar autenticado. Sem sessao, manda para o login. */
export async function requireSession(nextPath?: string): Promise<Session> {
  const session = await getSession();

  if (!session) {
    const target = nextPath ? `/entrar?proximo=${encodeURIComponent(nextPath)}` : "/entrar";
    redirect(target);
  }

  if (session.profile && session.profile.status !== "active") {
    redirect("/conta-inativa");
  }

  return session;
}

/**
 * Exige vinculo com um restaurante. Quem ainda nao tem vai para /inicio, que
 * oferece cadastrar a casa ou explica que falta o convite do gerente.
 */
export async function requireProfile(): Promise<ActiveSession> {
  const session = await requireSession();

  if (!session.profile) {
    redirect("/inicio");
  }

  return session as ActiveSession;
}

/** Exige sessao com uma permissao. Sem ela, volta para a home do papel. */
export async function requirePermission(permission: Permission): Promise<ActiveSession> {
  const session = await requireProfile();

  if (!can(session.profile.role, permission)) {
    redirect("/sem-permissao");
  }

  return session;
}

/**
 * Exige um restaurante operacional. Restaurante suspenso perde acesso a dado
 * pelo RLS, entao a UI precisa parar antes e explicar o motivo.
 */
export async function requireActiveRestaurant(
  permission?: Permission,
): Promise<ActiveSession & { restaurant: Restaurant }> {
  const session = permission ? await requirePermission(permission) : await requireProfile();

  if (!session.restaurant) {
    redirect("/inicio");
  }

  if (session.restaurant.status !== "active" && session.restaurant.status !== "trial") {
    redirect("/restaurante-suspenso");
  }

  return session as ActiveSession & { restaurant: Restaurant };
}
