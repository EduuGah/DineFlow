import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { PageContainer } from "@/components/shared/page-header";
import { AppHub } from "@/components/shared/app-hub";
import { CreateRestaurantForm } from "@/components/manager/create-restaurant-form";
import { Banner } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Início" };
export const dynamic = "force-dynamic";

/**
 * Tela inicial depois de entrar.
 *
 * Nao redireciona para lugar nenhum -- e o unico destino do app garantido a
 * renderizar. Quem chega aqui ou escolhe para onde ir, ou descobre o que falta
 * para poder ir a algum lugar.
 */
export default async function HomePage() {
  const session = await requireSession();

  // Sem perfil: ou e o dono no primeiro acesso, ou falta o convite do gerente.
  if (!session.profile) {
    return (
      <PageContainer className="max-w-xl">
        <CreateRestaurantForm email={session.email} />
      </PageContainer>
    );
  }

  // Admin da plataforma nao pertence a restaurante nenhum -- para ele o hub
  // mostra o painel da plataforma, nao a operacao de uma casa.
  if (session.profile.role === "platform_admin") {
    return (
      <PageContainer className="max-w-3xl">
        <AppHub
          role={session.profile.role}
          restaurantName="Plataforma DineFlow"
          userName={session.profile.name}
        />
      </PageContainer>
    );
  }

  if (!session.restaurant) {
    return (
      <PageContainer className="max-w-xl">
        <Banner tone="warning">
          Seu acesso está vinculado a um restaurante que não existe mais. Fale com quem administra a
          conta.
        </Banner>
      </PageContainer>
    );
  }

  const suspended = session.restaurant.status !== "active" && session.restaurant.status !== "trial";

  return (
    <PageContainer className="max-w-3xl">
      {suspended ? (
        <Banner tone="danger" icon={<CreditCard className="size-4 shrink-0" />}>
          A assinatura está suspensa e a operação fica bloqueada até a regularização.
        </Banner>
      ) : (
        <AppHub
          role={session.profile.role}
          restaurantName={session.restaurant.name}
          userName={session.profile.name}
        />
      )}

      <p className="text-foreground-subtle flex justify-center gap-4 text-center text-xs">
        <Link href="/" className="hover:text-foreground-muted">
          Sobre o DineFlow
        </Link>
        <Link href="/diagnostico" className="hover:text-foreground-muted">
          Diagnóstico
        </Link>
      </p>
    </PageContainer>
  );
}
