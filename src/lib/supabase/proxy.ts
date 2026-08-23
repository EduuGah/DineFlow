import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/** Rotas que existem sem sessão. */
const PUBLIC_ROUTES = ["/entrar", "/auth", "/termos", "/privacidade"];

const isPublic = (pathname: string) =>
  pathname === "/" || PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

/**
 * Renovacao de sessão e guarda de acesso anônimo.
 *
 * O proxy faz DUAS coisas, e só essas duas: mantem o token vivo e manda quem
 * não tem sessão para a tela de entrada.
 *
 * Ele NAO decide mais para onde um usuário autenticado deve ir. Essa decisão
 * dependia do papel lido do JWT, que só atualiza no proximo refresh do token --
 * e quando ela discordava do que a página decidia (lendo o banco ao vivo), o
 * usuário ficava saltando entre telas sem entender por que. Navegacao de quem
 * já entrou agora e sempre explicita: um botao, um destino.
 *
 * Isto nunca foi uma fronteira de segurança. O proxy roda no edge e não ve o
 * banco; quem barra acesso indevido a dado e o RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalida o token no servidor do Supabase. getSession() leria o
  // cookie sem verificar assinatura -- diferença que importa num guard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/entrar";
    redirect.searchParams.set("proximo", pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}
