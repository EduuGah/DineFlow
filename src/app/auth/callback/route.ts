import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RETURN_TO_COOKIE } from "@/lib/auth/return-to";

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
  const stored = cookieStore.get(RETURN_TO_COOKIE)?.value ?? "";
  cookieStore.delete(RETURN_TO_COOKIE);

  // Só caminho interno: mesmo vindo de um cookie proprio, tratamos o valor
  // como entrada -- e barato, e fecha a porta para open redirect.
  const next = stored.startsWith("/") && !stored.startsWith("//") ? stored : "/inicio";

  if (oauthError) {
    return NextResponse.redirect(`${origin}/entrar?erro=acesso-negado`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=sessao-invalida`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
