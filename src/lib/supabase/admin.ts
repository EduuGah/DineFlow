import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env, serviceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client com service_role: IGNORA O RLS por completo.
 *
 * Existe para um caso só -- criar a credencial de um funcionário no Supabase
 * Auth, que exige privilégio administrativo. Um garçom não tem conta Google de
 * trabalho, e o restaurante não deveria depender de que tenha: quem dá acesso
 * é o administrador, com usuário e senha.
 *
 * Toda chamada precisa verificar a permissão de quem pediu ANTES de criar este
 * client, e derivar o restaurante da SESSÃO -- nunca do formulário.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
