import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * Checklist de configuração (secoes 31 e 32 do roadmap).
 *
 * O objetivo declarado e o restaurante conseguir começar a operar sem falar
 * com ninguem. Por isso a lista mostra o proximo passo concreto com link
 * direto, e some sozinha quando a configuração mínima esta feita.
 */
export function OnboardingChecklist({
  status,
}: {
  status: {
    tables: number;
    categories: number;
    products: number;
    waiters: number;
    kitchen: number;
  };
}) {
  const steps = [
    {
      label: "Cadastrar as mesas do salão",
      done: status.tables > 0,
      href: "/gerente/mesas",
      hint:
        status.tables > 0 ? `${status.tables} mesas cadastradas` : "Crie o intervalo de uma vez",
    },
    {
      label: "Criar categorias do cardápio",
      done: status.categories > 0,
      href: "/gerente/cardapio",
      hint:
        status.categories > 0 ? `${status.categories} categorias` : "Entradas, pratos, bebidas...",
    },
    {
      label: "Cadastrar os produtos",
      done: status.products > 0,
      href: "/gerente/cardapio",
      hint: status.products > 0 ? `${status.products} produtos` : "Com nome e preço",
    },
    {
      label: "Criar os acessos da equipe",
      done: status.waiters + status.kitchen > 0,
      href: "/gerente/funcionarios",
      hint:
        status.waiters + status.kitchen > 0
          ? `${status.waiters} no salão, ${status.kitchen} na cozinha`
          : "Pelo menos um garçom e uma cozinha",
    },
  ];

  const done = steps.filter((step) => step.done).length;

  return (
    <Card>
      <CardHeader
        title="Falta pouco para começar a operar"
        description={`${done} de ${steps.length} etapas concluidas`}
      />
      <CardBody className="flex flex-col gap-1">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-3",
              "hover:bg-surface-muted",
            )}
          >
            {step.done ? (
              <span className="bg-success flex size-6 shrink-0 items-center justify-center rounded-full text-white">
                <Check className="size-3.5" />
              </span>
            ) : (
              <Circle className="text-foreground-subtle size-6 shrink-0" />
            )}

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-medium",
                  step.done ? "text-foreground-muted line-through" : "text-foreground",
                )}
              >
                {step.label}
              </span>
              <span className="text-foreground-subtle block text-xs">{step.hint}</span>
            </span>

            {!step.done ? <ArrowRight className="text-brand size-4 shrink-0" /> : null}
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}
