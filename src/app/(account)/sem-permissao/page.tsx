import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/domain/permissions";
import { PageContainer } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const session = await getSession();
  const home = session?.profile ? ROLE_HOME[session.profile.role] : "/inicio";

  return (
    <PageContainer>
      <EmptyState
        icon={<ShieldOff className="size-8" />}
        title="Voce nao tem acesso a essa tela"
        description="Se voce precisa dessa funcao, peca ao gerente do restaurante para ajustar seu papel."
        action={
          <Button asChild size="lg">
            <Link href={home}>Voltar para o inicio</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
