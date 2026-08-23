import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  ChefHat,
  CircleDollarSign,
  Clock,
  Flame,
  Receipt,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { formatCurrency, formatDuration } from "@/lib/utils/format";
import { OnboardingChecklist } from "@/components/manager/onboarding-checklist";

export const metadata: Metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

type Summary = {
  orders_total: number;
  orders_open: number;
  orders_ready: number;
  orders_delivered: number;
  orders_cancelled: number;
  revenue: number;
  average_ticket: number;
  tables_occupied: number;
  tables_total: number;
  seconds_to_send: number | null;
  seconds_to_start: number | null;
  seconds_to_prepare: number | null;
  seconds_to_deliver: number | null;
  staff_active: number;
};

type OnboardingStatus = {
  tables: number;
  categories: number;
  products: number;
  waiters: number;
  kitchen: number;
  completed_at: string | null;
};

export default async function ManagerDashboardPage() {
  await requireActiveRestaurant("reports.view");
  const supabase = await createClient();

  const [summaryResult, topProductsResult, onboardingResult] = await Promise.all([
    supabase.rpc("dashboard_summary", {}),
    supabase.rpc("top_products", { p_limit: 5 }),
    supabase.rpc("onboarding_status", {}),
  ]);

  const summary = (summaryResult.data ?? {}) as unknown as Summary;
  const topProducts = topProductsResult.data ?? [];
  const onboarding = (onboardingResult.data ?? {}) as unknown as OnboardingStatus;

  const setupIncomplete =
    onboarding.tables === 0 ||
    onboarding.products === 0 ||
    onboarding.waiters + onboarding.kitchen === 0;

  return (
    <PageContainer wide>
      <PageHeader
        title="Painel do dia"
        description="Numeros do movimento de hoje, atualizados a cada carregamento."
        action={
          <Button asChild variant="outline">
            <Link href="/gerente/pedidos">Ver historico</Link>
          </Button>
        }
      />

      {setupIncomplete ? <OnboardingChecklist status={onboarding} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pedidos hoje"
          value={summary.orders_total ?? 0}
          icon={<Receipt className="size-5" />}
          hint={`${summary.orders_delivered ?? 0} entregues`}
        />
        <StatCard
          label="Em preparo"
          value={summary.orders_open ?? 0}
          tone="warning"
          icon={<Flame className="size-5" />}
          hint="na fila da cozinha"
        />
        <StatCard
          label="Prontos aguardando"
          value={summary.orders_ready ?? 0}
          tone="success"
          icon={<ChefHat className="size-5" />}
          hint="esperando o garcom"
        />
        <StatCard
          label="Cancelados"
          value={summary.orders_cancelled ?? 0}
          tone={summary.orders_cancelled > 0 ? "danger" : "neutral"}
          icon={<Ban className="size-5" />}
          hint="veja os motivos no historico"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatCurrency(summary.revenue ?? 0)}
          tone="accent"
          icon={<CircleDollarSign className="size-5" />}
          hint="pedidos entregues e finalizados"
        />
        <StatCard
          label="Ticket medio"
          value={formatCurrency(summary.average_ticket ?? 0)}
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          label="Mesas ocupadas"
          value={`${summary.tables_occupied ?? 0}/${summary.tables_total ?? 0}`}
          icon={<UtensilsCrossed className="size-5" />}
        />
        <StatCard
          label="Equipe ativa"
          value={summary.staff_active ?? 0}
          icon={<ChefHat className="size-5" />}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Tempo medio de cada etapa"
            description="Onde o pedido esta demorando hoje."
          />
          <CardBody className="flex flex-col gap-3">
            <TimingRow
              label="Do lancamento ate o envio"
              hint="quanto tempo o garcom leva montando a comanda"
              seconds={summary.seconds_to_send}
            />
            <TimingRow
              label="Do envio ate a cozinha comecar"
              hint="fila de espera da cozinha"
              seconds={summary.seconds_to_start}
            />
            <TimingRow
              label="Preparo"
              hint="do inicio ate ficar pronto"
              seconds={summary.seconds_to_prepare}
            />
            <TimingRow
              label="Do pronto ate a entrega"
              hint="prato parado no balcao"
              seconds={summary.seconds_to_deliver}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mais pedidos hoje" description="Top 5 do dia." />
          <CardBody>
            {topProducts.length === 0 ? (
              <EmptyState
                title="Nenhum item vendido ainda"
                description="Os produtos mais pedidos aparecem aqui assim que o movimento comecar."
              />
            ) : (
              <ol className="flex flex-col gap-3">
                {topProducts.map((product, index) => (
                  <li key={product.product_id} className="flex items-center gap-3">
                    <span className="tabular bg-surface-muted text-foreground-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                      {product.product_name}
                    </span>
                    <span className="tabular text-foreground-muted text-sm">
                      {product.quantity}x
                    </span>
                    <span className="tabular text-foreground w-24 text-right text-sm font-semibold">
                      {formatCurrency(product.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}

function TimingRow({
  label,
  hint,
  seconds,
}: {
  label: string;
  hint: string;
  seconds: number | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-foreground text-sm font-medium">{label}</p>
        <p className="text-foreground-subtle text-xs">{hint}</p>
      </div>
      <span className="tabular text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm font-bold">
        <Clock className="text-foreground-subtle size-4" />
        {seconds == null ? "--" : formatDuration(seconds)}
      </span>
    </div>
  );
}
