import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/** Rotas que existem sem sessao. */
const PUBLIC_ROUTES = ["/entrar", "/auth", "/termos", "/privacidade"];

const isPublic = (pathname: string) =>
  pathname === "/" || PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

/**
 * Renovacao de sessao e guarda de acesso anonimo.
 *
 * O proxy faz DUAS coisas, e so essas duas: mantem o token vivo e manda quem
 * nao tem sessao para a tela de entrada.
 *
 * Ele NAO decide mais para onde um usuario autenticado deve ir. Essa decisao
 * dependia do papel lido do JWT, que so atualiza no proximo refresh do token --
 * e quando ela discordava do que a pagina decidia (lendo o banco ao vivo), o
 * usuario ficava saltando entre telas sem entender por que. Navegacao de quem
 * ja entrou agora e sempre explicita: um botao, um destino.
 *
 * Isto nunca foi uma fronteira de seguranca. O proxy roda no edge e nao ve o
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
  // cookie sem verificar assinatura -- diferenca que importa num guard.
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
