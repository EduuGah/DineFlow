"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Saida do sistema.
 *
 * A ENTRADA nao mora aqui: ela e um Route Handler (`/auth/login`), porque o
 * cookie do verificador PKCE precisa ser gravado na mesma resposta que
 * redireciona para o Google -- algo que uma Server Action terminando em
 * `redirect()` externo nao garante.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/entrar");
}
