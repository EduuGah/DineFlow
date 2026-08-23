"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, MailQuestion } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { createRestaurant } from "@/server/actions/restaurant";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ActionResult } from "@/lib/errors";

/**
 * Primeiro acesso de quem entrou com Google e ainda não tem vínculo.
 *
 * Duas pessoas diferentes chegam nesta tela, e ela precisa servir as duas: o
 * dono, que vai cadastrar a casa aqui mesmo, e o funcionário que entrou antes
 * de o gerente convidar o e-mail dele. Por isso o formulário vem primeiro e a
 * explicacao do convite logo abaixo, sem exigir escolha nenhuma na chegada.
 */
export function CreateRestaurantForm({ email }: { email: string }) {
  // Em caso de sucesso a action redireciona no servidor e este componente nem
  // chega a re-renderizar -- o estado aqui só existe para mostrar erro.
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(
    createRestaurant,
    null,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  /*
   * Confirmacao com botao, em vez de navegação automática.
   *
   * A ancora comum forca recarga completa: o hub e renderizado do zero, sem
   * chance de o cache do router servir a versão anterior desta mesma conta --
   * aquela em que ela ainda não tinha restaurante.
   */
  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <span className="bg-success-soft text-success flex size-14 items-center justify-center rounded-full">
          <CheckCircle2 className="size-7" />
        </span>
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Restaurante criado</h1>
          <p className="text-foreground-muted mt-2 text-sm">
            Você e o administrador da conta. O proximo passo e cadastrar as mesas e o cardápio.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2">
          <Button asChild size="lg" fullWidth icon={<ArrowRight className="size-4" />}>
            {/* Quem cria o restaurante vira admin: o destino útil e o painel. */}
            <a href="/gerente">Acessar o painel</a>
          </Button>
          <a
            href="/inicio"
            className="text-foreground-muted hover:text-foreground text-center text-xs"
          >
            ou ver todas as áreas
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-6">
      <div className="flex flex-col gap-2">
        <Logo className="size-11" />
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Cadastre seu restaurante
        </h1>
        <p className="text-foreground-muted text-sm">
          Você entrou como <span className="text-foreground font-medium">{email}</span>. Dê um nome
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
