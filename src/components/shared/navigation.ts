import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChefHat,
  ClipboardList,
  LayoutGrid,
  ScrollText,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import type { Permission } from "@/domain/permissions";
import { can, type UserRole } from "@/domain/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  /** Aparece na barra inferior do celular. */
  primary?: boolean;
  /** Marca o item como ativo tambem nas subrotas. */
  match?: (pathname: string) => boolean;
};

const ITEMS: NavItem[] = [
  {
    href: "/garcom",
    label: "Salao",
    icon: LayoutGrid,
    permission: "orders.create",
    primary: true,
    match: (path) => path === "/garcom" || path.startsWith("/garcom/mesa"),
  },
  {
    href: "/garcom/pedidos",
    label: "Pedidos",
    icon: ClipboardList,
    permission: "orders.create",
    primary: true,
  },
  {
    href: "/cozinha",
    label: "Cozinha",
    icon: ChefHat,
    permission: "kitchen.view",
    primary: true,
  },
  {
    href: "/gerente",
    label: "Painel",
    icon: ScrollText,
    permission: "reports.view",
    primary: true,
    match: (path) => path === "/gerente",
  },
  {
    href: "/gerente/cardapio",
    label: "Cardapio",
    icon: BookOpen,
    permission: "menu.manage",
    primary: true,
  },
  {
    href: "/gerente/mesas",
    label: "Mesas",
    icon: UtensilsCrossed,
    permission: "tables.manage",
  },
  {
    href: "/gerente/funcionarios",
    label: "Equipe",
    icon: Users,
    permission: "staff.manage",
  },
  {
    href: "/gerente/pedidos",
    label: "Historico",
    icon: ClipboardList,
    permission: "reports.view",
  },
  {
    href: "/gerente/auditoria",
    label: "Auditoria",
    icon: ScrollText,
    permission: "audit.view",
  },
];

export function navigationFor(role: UserRole): NavItem[] {
  return ITEMS.filter((item) => can(role, item.permission));
}

/**
 * Barra inferior do celular: no maximo cinco itens.
 *
 * Mais que isso e alvo pequeno demais para quem esta com uma mao ocupada -- o
 * resto vai para o menu do perfil.
 */
export function primaryNavigationFor(role: UserRole): NavItem[] {
  return navigationFor(role)
    .filter((item) => item.primary)
    .slice(0, 5);
}

export function isActive(item: NavItem, pathname: string): boolean {
  return item.match ? item.match(pathname) : pathname.startsWith(item.href);
}
