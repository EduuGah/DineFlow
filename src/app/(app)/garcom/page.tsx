import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchTablesWithOrders } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { TablesBoard } from "@/components/waiter/tables-board";

export const metadata: Metadata = { title: "Salão" };

// O salão muda a cada pedido; não há nada a cachear entre requisicoes.
export const dynamic = "force-dynamic";

export default async function WaiterHomePage() {
  const session = await requireActiveRestaurant("orders.create");
  const supabase = await createClient();
  const tables = await fetchTablesWithOrders(supabase);

  return (
    <PageContainer wide>
      <PageHeader
        title="Salão"
        description="Toque em uma mesa para abrir ou continuar um pedido."
      />
      <TablesBoard restaurantId={session.restaurant.id} initialTables={tables} />
    </PageContainer>
  );
}
