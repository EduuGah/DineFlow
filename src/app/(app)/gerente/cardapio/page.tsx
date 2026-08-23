import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchCategories, fetchProducts } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { MenuManager } from "@/components/manager/menu-manager";

export const metadata: Metadata = { title: "Cardápio" };
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
        title="Cardápio"
        description="Produtos indisponíveis somem da tela do garçom sem sair do cadastro."
      />
      <MenuManager categories={categories} products={products} />
    </PageContainer>
  );
}
