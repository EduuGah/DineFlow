import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { env, appUrl } from "@/lib/env";
import { RETURN_TO_COOKIE, RETURN_TO_MAX_AGE, safeReturnTo } from "@/lib/auth/return-to";
import type { Database } from "@/types/database";

/**
 * Inicio do login com Google.
 *
 * Precisa ser um Route Handler, e não uma Server Action.
 *
 * `signInWithOAuth` gera o verificador PKCE e o guarda num cookie. Numa Server
 * Action que termina em `redirect()` para um dominio externo, esse cookie pode
 * não chegar ao navegador -- e sem ele o `code` que o Google devolve não pode
 * ser trocado por sessão, o que aparece para o usuário como "não foi possível
 * concluir o login".
 *
 * Aqui os cookies são gravados explicitamente na resposta de redirect, então
 * eles saem junto com o 302 e estao disponíveis na volta.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const next = safeReturnTo(searchParams.get("proximo"));

  // O client escreve o verificador via setAll; guardamos para anexar a
  // resposta logo abaixo.
  const pending: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl()}/auth/callback`,
      queryParams: {
        // Deixa a pessoa escolher a conta: em restaurante e comum o celular
        // já estar logado com a conta pessoal de outro funcionário.
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    console.error("[auth] falha ao iniciar o login com Google:", error?.message ?? "sem URL");
    return NextResponse.redirect(`${origin}/entrar?erro=provedor-indisponivel`);
  }

  const response = NextResponse.redirect(data.url);

  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  /*
   * O destino vai num cookie, e não na query da URL de retorno, para a
   * `redirectTo` ficar FIXA -- exatamente uma URL por ambiente para liberar no
   * Supabase, sem curinga e sem query string.
   *
   * sameSite lax e obrigatório: a volta do Google e uma navegação GET de
   * primeiro nível, e um cookie strict não seria enviado nela.
   */
  response.cookies.set(RETURN_TO_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: RETURN_TO_MAX_AGE,
  });

  return response;
}
