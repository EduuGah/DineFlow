import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { DataTable, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Plataforma" };
export const dynamic = "force-dynamic";

const STATUS_TONE = {
  trial: "info",
  active: "success",
  suspended: "warning",
  cancelled: "danger",
} as const;

/**
 * Painel da plataforma (secao 35 do roadmap) -- versão inicial.
 *
 * Entrega apenas a listagem de restaurantes, que e o que o admin da plataforma
 * consegue ler por RLS hoje. Assinaturas, receita e churn dependem do modulo de
 * cobranca (Sprint 12) e ainda não existem no banco.
 */
export default async function PlatformPage() {
  await requirePermission("platform.manage");
  const supabase = await createClient();

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: users } = await supabase.from("users").select("restaurant_id, status");

  const staffByRestaurant = new Map<string, number>();
  for (const user of users ?? []) {
    if (!user.restaurant_id || user.status !== "active") continue;
    staffByRestaurant.set(user.restaurant_id, (staffByRestaurant.get(user.restaurant_id) ?? 0) + 1);
  }

  return (
    <PageContainer wide>
      <PageHeader title="Restaurantes" description="Contas ativas na plataforma DineFlow." />

      <Banner tone="info">
        Metricas de assinatura, receita e churn chegam junto com o modulo de cobranca.
      </Banner>

      {!restaurants || restaurants.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-8" />}
          title="Nenhum restaurante cadastrado"
          description="Os restaurantes aparecem aqui assim que criarem conta."
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Restaurante</Th>
              <Th>Endereço</Th>
              <Th>Plano</Th>
              <Th>Status</Th>
              <Th align="center">Equipe ativa</Th>
              <Th>Criado em</Th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((restaurant) => (
              <Tr key={restaurant.id}>
                <Td className="font-medium">{restaurant.name}</Td>
                <Td className="text-foreground-muted">/{restaurant.slug}</Td>
                <Td className="uppercase">{restaurant.plan}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[restaurant.status]} size="sm">
                    {restaurant.status}
                  </Badge>
                </Td>
                <Td align="center" className="tabular">
                  {staffByRestaurant.get(restaurant.id) ?? 0}
                </Td>
                <Td className="tabular text-foreground-muted">
                  {formatDateTime(restaurant.created_at)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </PageContainer>
  );
}
