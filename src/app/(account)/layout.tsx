import { requireSession } from "@/lib/auth/session";
import { AccountShell } from "@/components/shared/account-shell";

/**
 * Telas de conta e de excecao (primeiro acesso sem restaurante, acesso
 * desativado, assinatura suspensa, painel da plataforma).
 *
 * Ficam FORA do grupo (app) de proposito: o layout de (app) redireciona quem
 * nao tem perfil ou restaurante ativo para ca, e se estas paginas morassem la
 * dentro o redirecionamento se chamaria em loop.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <AccountShell
      user={{
        name: session.profile?.name ?? session.email,
        role: session.profile?.role ?? null,
        restaurantName: session.restaurant?.name ?? null,
      }}
    >
      {children}
    </AccountShell>
  );
}
