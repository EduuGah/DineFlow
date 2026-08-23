"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChefHat, MailQuestion } from "lucide-react";
import { createRestaurant } from "@/server/actions/restaurant";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ActionResult } from "@/lib/errors";

/**
 * Primeiro acesso de quem entrou com Google e ainda nao tem vinculo.
 *
 * Duas pessoas diferentes chegam nesta tela, e ela precisa servir as duas: o
 * dono, que vai cadastrar a casa aqui mesmo, e o funcionario que entrou antes
 * de o gerente convidar o e-mail dele. Por isso o formulario vem primeiro e a
 * explicacao do convite logo abaixo, sem exigir escolha nenhuma na chegada.
 */
export function CreateRestaurantForm({ email }: { email: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(
    createRestaurant,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      router.push("/gerente");
    }
  }, [state, router]);

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <div className="flex flex-col gap-5 py-6">
      <div className="flex flex-col gap-2">
        <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-xl">
          <ChefHat className="size-5" />
        </span>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Cadastre seu restaurante
        </h1>
        <p className="text-foreground-muted text-sm">
          Voce entrou como <span className="text-foreground font-medium">{email}</span>. Dê um nome
          à casa e o DineFlow já abre configurado para você montar o cardápio.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4" noValidate>
        {state && !state.ok ? (
          <p
            role="alert"
            className="bg-danger-soft text-danger flex items-start gap-2 rounded-[var(--radius-control)] px-3.5 py-3 text-sm font-medium"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <Field label="Nome do restaurante" htmlFor="name" required error={fieldErrors?.name}>
          <Input
            id="name"
            name="name"
            required
            autoFocus
            maxLength={120}
            placeholder="Cantina da Esquina"
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Criando...">
          Criar restaurante
        </Button>

        <p className="text-foreground-subtle text-center text-xs">
          São 14 dias de teste. Você vira o administrador da conta.
        </p>
      </form>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <MailQuestion className="text-foreground-muted size-4" />
              Faz parte da equipe de um restaurante?
            </span>
          }
        />
        <CardBody className="text-foreground-muted text-sm">
          Não crie um restaurante novo. Peça ao gerente para convidar exatamente este e-mail em
          <span className="text-foreground font-medium"> Equipe → Convidar</span>. Assim que o
          convite existir, saia e entre de novo com o Google — seu acesso aparece já vinculado à
          casa.
        </CardBody>
      </Card>
    </div>
  );
}
