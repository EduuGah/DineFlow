import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client de servidor com a sessão do usuário. Toda query feita por ele passa
 * pelo RLS -- e assim que o isolamento entre restaurantes chega até as
 * Server Actions e Server Components.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie. O middleware já
          // renova a sessão antes da renderizacao, então ignorar aqui e
          // seguro.
        }
      },
    },
  });
}
