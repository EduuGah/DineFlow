import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchKitchenOrders } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";

export const metadata: Metadata = { title: "Cozinha" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const session = await requireActiveRestaurant("kitchen.view");
  const supabase = await createClient();
  const orders = await fetchKitchenOrders(supabase);

  return (
    // A cozinha fica em tema escuro por padrao: a tela costuma estar longe,
    // fixa na parede, e o contraste alto cansa menos num turno inteiro.
    <div className="dark bg-background min-h-full">
      <PageContainer wide>
        <PageHeader
          title="Cozinha"
          description="Pedidos em tempo real. Mais antigo sempre no topo."
        />
        <KitchenBoard
          restaurantId={session.restaurant.id}
          role={session.profile.role}
          initialOrders={orders}
        />
      </PageContainer>
    </div>
  );
}
