import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, menos assets estaticos e imagens -- o refresh de sessao nao
     * precisa rodar para cada icone, e num salao com internet ruim cada
     * round-trip evitado conta.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
