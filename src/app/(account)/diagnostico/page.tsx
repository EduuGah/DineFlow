import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Check, X } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import { can, type Permission, type UserRole } from "@/domain/permissions";
import { ROLE_LABELS } from "@/domain/labels";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Diagnóstico" };
export const dynamic = "force-dynamic";

/**
 * O que o servidor enxerga desta sessão.
 *
 * Existe porque "não funciona" não e diagnosticavel: as guardas do app
 * redirecionam em silencio, e de fora não da para saber se o bloqueio veio de
 * sessão ausente, perfil não provisionado, restaurante suspenso ou papel sem
 * permissão. Esta tela responde isso em uma olhada.
 *
 * Não tem guarda própria além de exigir sessão -- e justamente a tela que
 * precisa renderizar quando todas as outras estao redirecionando.
 *
 * Mostra apenas dados da própria conta, que o RLS já liberaria de qualquer
 * forma. Nenhuma chave, nenhum token.
 */
export default async function DiagnosticPage() {
  const session = await getSession();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Consulta crua, para distinguir "não existe" de "o RLS escondeu".
  const { data: profileRow, error: profileError } = user
    ? await supabase.from("users").select("*").eq("id", user.id).maybeSingle()
    : { data: null, error: null };

  const { data: restaurantRow, error: restaurantError } = profileRow?.restaurant_id
    ? await supabase
        .from("restaurants")
        .select("*")
        .eq("id", profileRow.restaurant_id)
        .maybeSingle()
    : { data: null, error: null };

  const ambiente = process.env.VERCEL_ENV ?? "local";
  const role = (profileRow?.role ?? null) as UserRole | null;

  const áreas: { label: string; href: string; permission: Permission }[] = [
    { label: "Painel do gerente", href: "/gerente", permission: "reports.view" },
    { label: "Salão", href: "/garcom", permission: "orders.create" },
    { label: "Cozinha", href: "/cozinha", permission: "kitchen.view" },
  ];

  /** Reproduz, sem redirecionar, a decisão de requireActiveRestaurant(). */
  function veredito(permission: Permission): { ok: boolean; motivo: string } {
    if (!user) return { ok: false, motivo: "sem sessão -> /entrar" };
    if (!profileRow) return { ok: false, motivo: "sem perfil -> /inicio" };
    if (profileRow.status !== "active")
      return { ok: false, motivo: "conta inativa -> /conta-inativa" };
    if (!role || !can(role, permission)) {
      return { ok: false, motivo: `papel ${role ?? "?"} não tem ${permission} -> /sem-permissão` };
    }
    if (!restaurantRow) return { ok: false, motivo: "restaurante não encontrado -> /inicio" };
    if (restaurantRow.status !== "active" && restaurantRow.status !== "trial") {
      return { ok: false, motivo: `assinatura ${restaurantRow.status} -> /restaurante-suspenso` };
    }
    return { ok: true, motivo: "acesso liberado" };
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Diagnóstico"
        description="O que o servidor enxerga desta sessão agora."
        action={
          <Button asChild variant="outline">
            <Link href="/inicio">Voltar</Link>
          </Button>
        }
      />

      {!user ? (
        <Banner tone="danger">
          Nenhuma sessão foi reconhecida no servidor. Entre novamente em /entrar.
        </Banner>
      ) : null}

      <Card>
        <CardHeader title="Ambiente" />
        <CardBody className="flex flex-col gap-2 text-sm">
          <Linha rotulo="Execução" valor={ambiente} />
          <Linha rotulo="appUrl() (retorno do OAuth)" valor={appUrl()} />
          <Linha
            rotulo="NEXT_PUBLIC_APP_URL"
            valor={process.env.NEXT_PUBLIC_APP_URL ?? "(não definida)"}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sessão" />
        <CardBody className="flex flex-col gap-2 text-sm">
          <Linha rotulo="Autenticado" valor={user ? "sim" : "NÃO"} />
          <Linha rotulo="E-mail" valor={user?.email ?? "-"} />
          <Linha
            rotulo="Papel no token (app_metadata)"
            valor={String(user?.app_metadata?.role ?? "(ausente)")}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Perfil no banco" description="Tabela public.users" />
        <CardBody className="flex flex-col gap-2 text-sm">
          <Linha rotulo="Encontrado" valor={profileRow ? "sim" : "NÃO"} />
          <Linha rotulo="Nome" valor={profileRow?.name ?? "-"} />
          <Linha rotulo="Papel" valor={role ? `${role} (${ROLE_LABELS[role]})` : "-"} />
          <Linha rotulo="Situação" valor={profileRow?.status ?? "-"} />
          {profileError ? <Linha rotulo="Erro" valor={profileError.message} alerta /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Restaurante" description="Tabela public.restaurants" />
        <CardBody className="flex flex-col gap-2 text-sm">
          <Linha rotulo="Vínculo no perfil" valor={profileRow?.restaurant_id ?? "(nenhum)"} />
          <Linha rotulo="Encontrado" valor={restaurantRow ? "sim" : "NÃO"} />
          <Linha rotulo="Nome" valor={restaurantRow?.name ?? "-"} />
          <Linha rotulo="Assinatura" valor={restaurantRow?.status ?? "-"} />
          {restaurantError ? <Linha rotulo="Erro" valor={restaurantError.message} alerta /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Acesso por área"
          description="Mesma decisão que a página tomaria, sem redirecionar."
        />
        <CardBody className="flex flex-col gap-3">
          {áreas.map((área) => {
            const resultado = veredito(área.permission);
            return (
              <div key={área.href} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    resultado.ok ? "bg-success text-white" : "bg-danger text-white",
                  )}
                >
                  {resultado.ok ? <Check className="size-3" /> : <X className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block font-medium">{área.label}</span>
                  <span className="text-foreground-muted block">{resultado.motivo}</span>
                </span>
              </div>
            );
          })}
        </CardBody>
      </Card>

      {session && !session.profile ? (
        <Banner tone="warning" icon={<AlertTriangle className="size-4 shrink-0" />}>
          A conta está autenticada mas sem perfil. Ou é o primeiro acesso do dono, ou falta um
          convite pendente para este e-mail.
        </Banner>
      ) : null}
    </PageContainer>
  );
}

function Linha({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-foreground-muted">{rotulo}</span>
      <span
        className={cn("font-mono text-xs break-all", alerta ? "text-danger" : "text-foreground")}
      >
        {valor}
      </span>
    </div>
  );
}
