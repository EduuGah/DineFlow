import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchTables } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { TablesManager } from "@/components/manager/tables-manager";

export const metadata: Metadata = { title: "Mesas" };
export const dynamic = "force-dynamic";

export default async function ManagerTablesPage() {
  await requireActiveRestaurant("tables.manage");
  const supabase = await createClient();
  const tables = await fetchTables(supabase);

  return (
    <PageContainer>
      <PageHeader title="Mesas" description="O salão do garçom e montado a partir daqui." />
      <TablesManager tables={tables} />
    </PageContainer>
  );
}
