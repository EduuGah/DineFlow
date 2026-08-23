import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchStaff } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StaffManager } from "@/components/manager/staff-manager";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireActiveRestaurant("staff.manage");
  const supabase = await createClient();
  const staff = await fetchStaff(supabase);

  return (
    <PageContainer>
      <PageHeader
        title="Equipe"
        description="Cada pessoa entra com o próprio acesso — é assim que o histórico sabe quem fez o quê."
      />
      <StaffManager
        staff={staff}
        currentUserId={session.userId}
        currentRole={session.profile.role}
      />
    </PageContainer>
  );
}
