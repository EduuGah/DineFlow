import { UserX } from "lucide-react";
import { PageContainer } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/feedback";

export default function InactiveAccountPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={<UserX className="size-8" />}
        title="Seu acesso foi desativado"
        description="Fale com o gerente do restaurante para reativar sua conta. Seu historico de pedidos continua preservado."
      />
    </PageContainer>
  );
}
