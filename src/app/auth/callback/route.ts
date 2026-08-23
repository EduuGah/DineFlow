import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RETURN_TO_COOKIE, safeReturnTo } from "@/lib/auth/return-to";

/**
 * Retorno do login com Google.
 *
 * O Supabase manda a pessoa de volta para ca com um `code` de uso unico, que
 * trocamos por uma sessao. O verificador PKCE vive num cookie gravado quando o
 * login comecou, entao a troca so funciona no mesmo navegador que iniciou --
 * um `code` interceptado nao vale nada sozinho.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const cookieStore = await cookies();
  const next = safeReturnTo(cookieStore.get(RETURN_TO_COOKIE)?.value);
  cookieStore.delete(RETURN_TO_COOKIE);

  if (oauthError) {
    console.error("[auth] o provedor recusou o login:", oauthError);
    return NextResponse.redirect(`${origin}/entrar?erro=acesso-negado`);
  }

  if (!code) {
    console.error("[auth] retorno sem parametro code");
    return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // O motivo real fica no log do servidor: a tela mostra so o suficiente
    // para a pessoa saber o que fazer, sem detalhe de infraestrutura.
    console.error("[auth] falha ao trocar o code por sessao:", error.message);

    // Verificador ausente e um caso a parte: nao adianta "tentar de novo" com
    // o mesmo link, a pessoa precisa recomecar o login.
    const semVerificador =
      error.message.toLowerCase().includes("verifier") ||
      error.message.toLowerCase().includes("pkce");

    return NextResponse.redirect(
      `${origin}/entrar?erro=${semVerificador ? "sem-verificador" : "sessao-invalida"}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
