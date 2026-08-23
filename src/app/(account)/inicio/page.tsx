import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/domain/permissions";
import { PageContainer } from "@/components/shared/page-header";
import { CreateRestaurantForm } from "@/components/manager/create-restaurant-form";

export const metadata: Metadata = { title: "Cadastrar restaurante" };
export const dynamic = "force-dynamic";

/**
 * Ponto de pouso do primeiro login.
 *
 * Quem ja tem vinculo vai direto para a tela do papel. Quem nao tem chegou
 * aqui por um de dois caminhos: e o dono e precisa cadastrar o restaurante, ou
 * e da equipe e o gerente ainda nao convidou o e-mail dele.
 */
export default async function HomePage() {
  const session = await requireSession();

  if (session.profile && session.restaurant) {
    redirect(ROLE_HOME[session.profile.role]);
  }

  return (
    <PageContainer className="max-w-xl">
      <CreateRestaurantForm email={session.email} />
    </PageContainer>
  );
}
