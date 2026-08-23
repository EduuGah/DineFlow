import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/shared/legal-placeholder";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <LegalPlaceholder
      title="Termos de uso"
      description="Os termos de uso do DineFlow estão em elaboracao juridica e serao publicados aqui antes do lancamento comercial."
    />
  );
}
