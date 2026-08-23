import { CreditCard } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { PageContainer } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/feedback";

export default async function SuspendedPage() {
  const session = await getSession();

  return (
    <PageContainer>
      <EmptyState
        icon={<CreditCard className="size-8" />}
        title="Assinatura suspensa"
        description={`O acesso operacional de ${session?.restaurant?.name ?? "este restaurante"} está bloqueado. Fale com o administrador da conta para regularizar a assinatura e liberar a equipe.`}
      />
    </PageContainer>
  );
}
