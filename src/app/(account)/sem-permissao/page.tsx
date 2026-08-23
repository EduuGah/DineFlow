import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { PageContainer } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={<ShieldOff className="size-8" />}
        title="Voce nao tem acesso a essa tela"
        description="Se voce precisa dessa funcao, peca ao gerente do restaurante para ajustar seu papel."
        action={
          <Button asChild size="lg">
            <Link href="/inicio">Voltar para o inicio</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
