import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  BookOpen,
  ChefHat,
  LayoutGrid,
  ScrollText,
  Users,
} from "lucide-react";
import { can, type Permission, type UserRole } from "@/domain/permissions";
import { ROLE_LABELS } from "@/domain/labels";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type Destination = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: Permission;
  primary?: boolean;
};

const DESTINATIONS: Destination[] = [
  {
    href: "/gerente",
    label: "Painel do gerente",
    description: "Movimento do dia, tempos de preparo e histórico.",
    icon: ScrollText,
    permission: "reports.view",
    primary: true,
  },
  {
    href: "/garcom",
    label: "Salão",
    description: "Mesas, lançamento e entrega de pedidos.",
    icon: LayoutGrid,
    permission: "orders.create",
    primary: true,
  },
  {
    href: "/cozinha",
    label: "Cozinha",
    description: "Fila de preparo em tempo real.",
    icon: ChefHat,
    permission: "kitchen.view",
    primary: true,
  },
  {
    href: "/gerente/cardapio",
    label: "Cardápio",
    description: "Categorias, produtos e disponibilidade.",
    icon: BookOpen,
    permission: "menu.manage",
  },
  {
    href: "/gerente/funcionarios",
    label: "Equipe",
    description: "Convites e papéis da equipe.",
    icon: Users,
    permission: "staff.manage",
  },
  {
    href: "/plataforma",
    label: "Restaurantes",
    description: "Contas ativas na plataforma DineFlow.",
    icon: Building2,
    permission: "platform.manage",
    primary: true,
  },
];

/**
 * Tela inicial de quem já tem vínculo.
 *
 * Existe para tornar a navegação explicita. Antes, entrar levava a pessoa
 * direto para a área do papel dela por redirecionamento automático -- o que
 * funciona até dois redirecionamentos discordarem, e aí a tela pisca sem
 * explicacao. Um botao por destino resolve isso e ainda deixa o gerente
 * alternar entre painel, salão e cozinha sem decorar URL.
 */
export function AppHub({
  role,
  restaurantName,
  userName,
}: {
  role: UserRole;
  restaurantName: string;
  userName: string;
}) {
  const available = DESTINATIONS.filter((item) => can(role, item.permission));
  const primary = available.filter((item) => item.primary);
  const secondary = available.filter((item) => !item.primary);

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">{restaurantName}</h1>
        <p className="text-foreground-muted text-sm">
          {userName}{" "}
          <Badge tone="brand" size="sm" className="ml-1">
            {ROLE_LABELS[role]}
          </Badge>
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {primary.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "border-border flex h-full items-start gap-4 rounded-[var(--radius-card)] border-2",
                "bg-surface hover:border-brand p-5 transition-colors active:scale-[0.99]",
              )}
            >
              <span className="bg-brand-soft text-brand flex size-11 shrink-0 items-center justify-center rounded-xl">
                <item.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground flex items-center gap-2 text-base font-semibold">
                  {item.label}
                  <ArrowRight className="text-brand size-4" />
                </span>
                <span className="text-foreground-muted mt-0.5 block text-sm">
                  {item.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {secondary.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground-subtle text-xs font-semibold tracking-wide uppercase">
            Configuração
          </h2>
          <ul className="flex flex-col gap-2">
            {secondary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="border-border bg-surface hover:bg-surface-muted flex items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3"
                >
                  <item.icon className="text-foreground-muted size-4 shrink-0" />
                  <span className="text-foreground min-w-0 flex-1 text-sm font-medium">
                    {item.label}
                  </span>
                  <ArrowRight className="text-foreground-subtle size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
