import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchOpenOrderForTable, fetchMenu } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { OrderBuilder } from "@/components/waiter/order-builder";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Novo pedido" };
export const dynamic = "force-dynamic";

export default async function TableOrderPage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const session = await requireActiveRestaurant("orders.create");
  const supabase = await createClient();

  // O RLS já limita a consulta ao restaurante do usuário: um tableId de outro
  // tenant simplesmente não existe daqui, e vira 404.
  const { data: table } = await supabase
    .from("tables")
    .select("id, number, name, capacity")
    .eq("id", tableId)
    .maybeSingle();

  if (!table) notFound();

  const [menu, openOrder] = await Promise.all([
    fetchMenu(supabase),
    fetchOpenOrderForTable(supabase, tableId),
  ]);

  const hasProducts = menu.some((category) => category.products.length > 0);

  return (
    <PageContainer wide>
      <PageHeader
        backHref="/garcom"
        backLabel="Salão"
        title={`Mesa ${table.number}${table.name ? ` - ${table.name}` : ""}`}
        description={
          openOrder && openOrder.status !== "draft"
            ? `Comanda #${openOrder.number} aberta. Novos itens seguem como adicional.`
            : `${table.capacity} lugares`
        }
      />

      {hasProducts ? (
        <OrderBuilder
          restaurantId={session.restaurant.id}
          waiterId={session.userId}
          table={table}
          menu={menu}
          initialOrder={openOrder}
        />
      ) : (
        <EmptyState
          icon={<BookOpen className="size-8" />}
          title="O cardápio ainda esta vazio"
          description="Cadastre categorias e produtos para conseguir lancar pedidos."
          action={
            <Button asChild size="lg">
              <Link href="/gerente/cardapio">Montar cardápio</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
