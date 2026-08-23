import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchOrderHistory } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { OrderHistory } from "@/components/manager/order-history";
import { SkeletonList } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Historico de pedidos" };
export const dynamic = "force-dynamic";

/** Sete dias e a janela que responde "como foi a semana?" sem paginar. */
function defaultRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);

  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(today) };
}

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; status?: string }>;
}) {
  await requireActiveRestaurant("reports.view");
  const { de, ate, status } = await searchParams;
  const range = defaultRange();

  const from = de || range.from;
  const to = ate || range.to;

  const supabase = await createClient();
  const orders = await fetchOrderHistory(supabase, { from, to, limit: 300 });

  return (
    <PageContainer wide>
      <PageHeader
        title="Historico de pedidos"
        description="Todo pedido enviado fica aqui, inclusive os cancelados."
      />
      <Suspense fallback={<SkeletonList rows={5} />}>
        <OrderHistory orders={orders} from={from} to={to} status={status ?? ""} />
      </Suspense>
    </PageContainer>
  );
}
