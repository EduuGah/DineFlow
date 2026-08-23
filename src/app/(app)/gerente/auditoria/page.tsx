import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchAuditLog } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { DataTable, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, auditActionLabel } from "@/domain/labels";
import { formatDateTime } from "@/lib/utils/format";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const ENTITY_LABELS: Record<string, string> = {
  order: "Pedido",
  product: "Produto",
  category: "Categoria",
  table: "Mesa",
  user: "Funcionario",
};

export default async function AuditPage() {
  await requireActiveRestaurant("audit.view");
  const supabase = await createClient();
  const logs = await fetchAuditLog(supabase, { limit: 200 });

  return (
    <PageContainer wide>
      <PageHeader
        title="Auditoria"
        description="Quem fez o que, e quando. Os registros sao gravados pelo banco e nao podem ser editados."
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-8" />}
          title="Nenhum registro ainda"
          description="Assim que a operacao comecar, cada acao relevante aparece aqui."
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Quando</Th>
              <Th>Quem</Th>
              <Th>Papel</Th>
              <Th>Acao</Th>
              <Th>Sobre</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const metadata = (log.metadata ?? {}) as Record<string, unknown>;
              const orderNumber = metadata.order_number ?? metadata.number;

              return (
                <Tr key={log.id}>
                  <Td className="tabular text-foreground-muted whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </Td>
                  <Td className="font-medium">{log.actor_name ?? "Sistema"}</Td>
                  <Td className="text-foreground-muted">
                    {log.actor_role ? ROLE_LABELS[log.actor_role as Enums<"user_role">] : "-"}
                  </Td>
                  <Td>{auditActionLabel(log.action)}</Td>
                  <Td>
                    <Badge tone="neutral" size="sm">
                      {ENTITY_LABELS[log.entity] ?? log.entity}
                      {orderNumber ? ` #${orderNumber}` : ""}
                    </Badge>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </PageContainer>
  );
}
