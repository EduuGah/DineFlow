import Link from "next/link";
import { ArrowRight, Bell, ChefHat, ShieldCheck, WifiOff } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { PRIMARY_AREA } from "@/domain/permissions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const HIGHLIGHTS = [
  {
    icon: ChefHat,
    title: "Do salão para a cozinha, na hora",
    description:
      "O garçom lanca o pedido no celular e a comanda aparece na tela da cozinha no mesmo instante, com as observações em destaque.",
  },
  {
    icon: Bell,
    title: "Ninguem mais grita 'saiu!'",
    description:
      "Quando a cozinha marca pronto, o garçom recebe aviso com som e o pedido sobe para o topo da lista dele.",
  },
  {
    icon: WifiOff,
    title: "Aguenta Wi-Fi de restaurante",
    description:
      "Se a conexão cair no meio do lancamento, o pedido fica guardado no aparelho e sai sozinho quando a rede voltar -- sem duplicar.",
  },
  {
    icon: ShieldCheck,
    title: "Cada restaurante com seus dados",
    description:
      "O isolamento entre restaurantes e garantido no banco de dados, não na tela. Ninguem enxerga o movimento de ninguem.",
  },
];

export default async function LandingPage() {
  const session = await getSession();

  // Um clique até o trabalho. O menu continua a um link de distancia, para
  // quem precisa alternar entre salão, cozinha e painel.
  const areaPrincipal = session?.profile ? PRIMARY_AREA[session.profile.role] : "/inicio";

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <span className="bg-brand text-brand-foreground flex size-9 items-center justify-center rounded-xl">
            <ChefHat className="size-5" />
          </span>
          <span className="text-foreground text-lg font-bold tracking-tight">DineFlow</span>
        </span>
        <Button asChild variant={session ? "primary" : "ghost"}>
          {/*
            Ancora comum, e não o Link do Next, de proposito: a recarga completa
            nunca serve uma versão antiga da página de destino guardada no cache
            do router. Numa transição rara como "entrar no app", garantia de
            estado fresco vale mais do que navegação instantanea.
          */}
          <a href={session ? areaPrincipal : "/entrar"}>{session ? "Ir para o app" : "Entrar"}</a>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-6 py-10">
        {session ? (
          <section className="border-brand/40 bg-brand-soft/40 flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border-2 p-5">
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-base font-semibold">
                {session.restaurant?.name ?? "Você já está conectado"}
              </p>
              <p className="text-foreground-muted text-sm">{session.email}</p>
            </div>
            <div className="flex flex-col items-stretch gap-1.5">
              <Button asChild size="lg" icon={<ArrowRight className="size-4" />}>
                <a href={areaPrincipal}>Acessar o painel</a>
              </Button>
              <a
                href="/inicio"
                className="text-foreground-muted hover:text-foreground text-center text-xs"
              >
                ou ver todas as áreas
              </a>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-6">
          <h1 className="text-foreground max-w-3xl text-3xl leading-tight font-bold tracking-tight sm:text-5xl">
            Um restaurante tolera um sistema simples.
            <span className="text-brand block">Não tolera perder um pedido.</span>
          </h1>
          <p className="text-foreground-muted max-w-2xl text-base sm:text-lg">
            O DineFlow cuida do caminho mais critico da operação: garçom lanca, cozinha recebe,
            cozinha marca pronto, garçom entrega. Tudo em tempo real, com histórico de quem fez o
            que.
          </p>
          <div className="flex flex-wrap gap-3">
            {session ? null : (
              <>
                <Button asChild size="lg" icon={<ArrowRight className="size-4" />}>
                  <a href="/entrar">Cadastrar meu restaurante</a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="/entrar">Já tenho conta</a>
                </Button>
              </>
            )}
          </div>
          {session ? null : (
            <p className="text-foreground-subtle text-sm">14 dias de teste. Sem cartao.</p>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {HIGHLIGHTS.map((item) => (
            <article
              key={item.title}
              className="border-border bg-surface flex flex-col gap-2 rounded-[var(--radius-card)] border p-5"
            >
              <item.icon className="text-brand size-5" />
              <h2 className="text-foreground text-base font-semibold">{item.title}</h2>
              <p className="text-foreground-muted text-sm">{item.description}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-border text-foreground-subtle border-t px-6 py-6 text-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <span>DineFlow</span>
          <span className="flex gap-4">
            <Link href="/termos" className="hover:text-foreground-muted">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-foreground-muted">
              Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
