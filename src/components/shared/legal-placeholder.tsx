import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Documento juridico ainda nao publicado.
 *
 * Melhor uma pagina honesta do que um 404 num link do rodape -- ou, pior, um
 * texto legal inventado. O conteudo definitivo entra antes do lancamento
 * comercial (secao 25 do roadmap).
 */
export function LegalPlaceholder({
  title,
  description,
  summary,
}: {
  title: string;
  description: string;
  summary?: string[];
}) {
  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-xl">
          <FileText className="size-5" />
        </span>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-foreground-muted">{description}</p>
      </div>

      {summary ? (
        <ul className="border-border bg-surface flex flex-col gap-2 rounded-[var(--radius-card)] border p-5">
          {summary.map((item) => (
            <li key={item} className="text-foreground-muted flex gap-2 text-sm">
              <span className="bg-brand mt-2 size-1.5 shrink-0 rounded-full" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <Button asChild variant="outline" className="self-start">
        <Link href="/">Voltar</Link>
      </Button>
    </article>
  );
}
