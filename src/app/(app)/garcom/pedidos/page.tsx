import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchOpenOrders } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { WaiterOrders } from "@/components/waiter/waiter-orders";

export const metadata: Metadata = { title: "Meus pedidos" };
export const dynamic = "force-dynamic";

export default async function WaiterOrdersPage() {
  const session = await requireActiveRestaurant("orders.create");
  const supabase = await createClient();
  const orders = await fetchOpenOrders(supabase);

  return (
    <PageContainer wide>
      <PageHeader title="Pedidos abertos" description="Pedidos prontos aparecem primeiro." />
      <WaiterOrders
        restaurantId={session.restaurant.id}
        waiterId={session.userId}
        role={session.profile.role}
        initialOrders={orders}
      />
    </PageContainer>
  );
}
