import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/shared/legal-placeholder";

export const metadata: Metadata = { title: "Politica de privacidade" };

export default function PrivacyPage() {
  return (
    <LegalPlaceholder
      title="Politica de privacidade"
      description="A politica de privacidade completa esta em elaboracao juridica. Abaixo, o resumo tecnico do que o sistema coleta hoje."
      summary={[
        "Dados coletados: nome, e-mail e telefone (opcional) dos funcionarios do restaurante.",
        "Nenhum dado de cliente final e armazenado -- nao ha cadastro de consumidor, CPF ou telefone de mesa.",
        "Finalidade: identificar quem executou cada acao na operacao do restaurante.",
        "Os dados de cada restaurante ficam isolados no banco por politicas de acesso a nivel de linha.",
        "O log de auditoria registra as acoes, mas remove contato e imagem antes de gravar.",
      ]}
    />
  );
}
