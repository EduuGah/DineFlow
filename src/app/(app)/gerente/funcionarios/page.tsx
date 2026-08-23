import type { Metadata } from "next";
import { requireActiveRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchPendingInvitations, fetchStaff } from "@/lib/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StaffManager } from "@/components/manager/staff-manager";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireActiveRestaurant("staff.manage");
  const supabase = await createClient();
  const [staff, invitations] = await Promise.all([
    fetchStaff(supabase),
    fetchPendingInvitations(supabase),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Equipe"
        description="Cada pessoa entra com a própria conta Google -- e assim que o histórico sabe quem fez o que."
      />
      <StaffManager
        staff={staff}
        invitations={invitations}
        currentUserId={session.userId}
        currentRole={session.profile.role}
      />
    </PageContainer>
  );
}
