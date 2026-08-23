import type { Enums } from "@/types/database";

export type UserRole = Enums<"user_role">;

/**
 * Permissoes por papel (secao 1.3 do roadmap).
 *
 * Esta tabela decide o que aparece na tela e qual rota cada papel pode abrir.
 * Ela NAO e a fronteira de seguranca: quem barra escrita indevida e o RLS mais
 * os triggers do banco. Manter as duas alinhadas evita mostrar um botao que
 * vai falhar -- mas mesmo que divirjam, o banco continua correto.
 */
export const PERMISSIONS = [
  "tables.view",
  "orders.create",
  "orders.edit_draft",
  "orders.send",
  "orders.deliver",
  "orders.complete",
  "orders.cancel",
  "orders.view_all",
  "kitchen.view",
  "kitchen.accept",
  "kitchen.start",
  "kitchen.finish",
  "kitchen.reopen",
  "menu.manage",
  "tables.manage",
  "staff.manage",
  "restaurant.configure",
  "reports.view",
  "audit.view",
  "platform.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const WAITER: Permission[] = [
  "tables.view",
  "orders.create",
  "orders.edit_draft",
  "orders.send",
  "orders.deliver",
  "orders.complete",
  "orders.cancel",
  "orders.view_all",
];

const KITCHEN: Permission[] = [
  "orders.view_all",
  "kitchen.view",
  "kitchen.accept",
  "kitchen.start",
  "kitchen.finish",
  "kitchen.reopen",
  "orders.cancel",
];

const MANAGER: Permission[] = [
  ...WAITER,
  ...KITCHEN,
  "menu.manage",
  "tables.manage",
  "staff.manage",
  "reports.view",
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  waiter: WAITER,
  kitchen: KITCHEN,
  manager: MANAGER,
  admin: [...MANAGER, "restaurant.configure"],
  platform_admin: ["platform.manage"],
};

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function isManagerRole(role: UserRole | null | undefined): boolean {
  return role === "manager" || role === "admin";
}
