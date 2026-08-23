import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchCategories, fetchProducts } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { MenuManager } from "@/components/manager/menu-manager";

export const metadata: Metadata = { title: "Cardapio" };
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  await requireActiveRestaurant("menu.manage");
  const supabase = await createClient();

  const [categories, products] = await Promise.all([
    fetchCategories(supabase),
    fetchProducts(supabase),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Cardapio"
        description="Produtos indisponiveis somem da tela do garcom sem sair do cadastro."
      />
      <MenuManager categories={categories} products={products} />
    </PageContainer>
  );
}
