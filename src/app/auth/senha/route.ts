import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { env } from "@/lib/env";
import { safeReturnTo } from "@/lib/auth/return-to";
import { signInSchema } from "@/domain/schemas";
import type { Database } from "@/types/database";

/**
 * Entrada da equipe: e-mail e senha.
 *
 * Route Handler pelo mesmo motivo do login com Google -- os cookies de sessao
 * precisam sair na propria resposta de redirect, e nao depender de o cliente
 * aplicar o que veio de uma Server Action.
 *
 * A mensagem de credencial invalida e unica de proposito: dizer "e-mail nao
 * cadastrado" transformaria a tela num verificador de quais e-mails existem na
 * plataforma.
 */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData();

  const next = safeReturnTo(String(form.get("proximo") ?? ""));
  const parsed = signInSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });

  const recusa = () => NextResponse.redirect(`${origin}/entrar?erro=credencial`, { status: 303 });

  if (!parsed.success) return recusa();

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

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    console.error("[auth] senha recusada:", error?.message ?? "sem usuario");
    return recusa();
  }

  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.status === "inactive") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/entrar?erro=conta-inativa`, { status: 303 });
  }

  // 303 forca o navegador a trocar o POST por um GET no destino: sem isso,
  // recarregar a pagina seguinte reenviaria a senha.
  const response = NextResponse.redirect(`${origin}${next}`, { status: 303 });
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}
