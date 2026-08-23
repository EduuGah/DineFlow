"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import { RETURN_TO_COOKIE, RETURN_TO_MAX_AGE } from "@/lib/auth/return-to";
import { fail, type ActionResult } from "@/lib/errors";

/**
 * Entrada no sistema: apenas Google.
 *
 * Um restaurante nao gerencia senha de garcom. A conta Google que a pessoa ja
 * usa no celular vira a credencial, e some da operacao toda a categoria de
 * problema "esqueci a senha" no meio do movimento.
 */
export async function signInWithGoogle(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<never>> {
  const supabase = await createClient();

  const raw = String(formData.get("proximo") ?? "").trim();
  // Só caminho interno: "//evil.com" viraria open redirect com a sessao nova.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inicio";

  /*
   * O destino vai num cookie, e nao na query da URL de retorno.
   *
   * Assim a `redirectTo` fica FIXA -- exatamente uma URL por ambiente para
   * liberar no Supabase, sem curinga e sem query string. Configuracao de OAuth
   * quebrada e o erro mais comum e mais chato de diagnosticar num deploy.
   *
   * sameSite lax e obrigatorio aqui: a volta do Google e uma navegacao GET de
   * primeiro nivel, e um cookie strict nao seria enviado nela.
   */
  const cookieStore = await cookies();
  cookieStore.set(RETURN_TO_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RETURN_TO_MAX_AGE,
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl()}/auth/callback`,
      queryParams: {
        // Deixa a pessoa escolher a conta: em restaurante e comum o celular
        // ja estar logado com a conta pessoal de outro funcionario.
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    return fail(error ?? new Error("Nao foi possivel iniciar o login com o Google."));
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/entrar");
}
