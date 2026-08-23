import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { ROLE_HOME, can, permissionForRoute, type UserRole } from "@/domain/permissions";
import type { Database } from "@/types/database";

const PUBLIC_ROUTES = ["/entrar", "/auth", "/termos", "/privacidade"];

const isPublic = (pathname: string) =>
  pathname === "/" || PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

/**
 * Guarda de rota (secao 9 do roadmap): autenticado -> restaurante -> papel.
 *
 * Roda no proxy do Next (o antigo middleware). A checagem aqui existe para
 * redirecionar bem, nao para proteger dado: o proxy roda no edge e nao ve o
 * banco. Quem barra acesso indevido a dado continua sendo o RLS.
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

  if (!user) {
    if (isPublic(pathname)) return response;

    const redirect = request.nextUrl.clone();
    redirect.pathname = "/entrar";
    redirect.searchParams.set("proximo", pathname);
    return NextResponse.redirect(redirect);
  }

  const role = (user.app_metadata?.role ?? null) as UserRole | null;

  // Usuario logado nao volta para a tela de login.
  if (pathname === "/entrar" || pathname === "/") {
    const home = request.nextUrl.clone();
    home.pathname = role ? ROLE_HOME[role] : "/inicio";
    home.search = "";
    return NextResponse.redirect(home);
  }

  // Sem o papel no token (conta recem-criada, por exemplo) deixamos passar: a
  // pagina resolve o perfil no banco e decide.
  const permission = permissionForRoute(pathname);
  if (role && permission && !can(role, permission)) {
    const home = request.nextUrl.clone();
    home.pathname = ROLE_HOME[role];
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
