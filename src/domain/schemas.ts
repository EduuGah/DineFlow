import { z } from "zod";

/**
 * Validacao de entrada. Roda no servidor (Server Actions) e e reaproveitada no
 * cliente so para dar feedback antecipado -- a validacao que conta e a do
 * servidor, somada as constraints do banco.
 */

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} precisa ter pelo menos ${min} caracteres.`)
    .max(max, `${label} pode ter no maximo ${max} caracteres.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Texto pode ter no maximo ${max} caracteres.`)
    .optional()
    .transform((value) => (value ? value : null));

/*
 * Limpa ANTES de validar.
 *
 * O autocompletar do teclado no celular costuma acrescentar um espaco no fim,
 * e maiusculas no comeco. Validar primeiro faria o garcom levar "e-mail
 * invalido" por causa de um espaco que ele nem consegue ver.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail valido."));

export const restaurantNameSchema = z.object({
  name: requiredText("O nome do restaurante", 2, 120),
});

export const invitationSchema = z.object({
  email: emailSchema,
  role: z.enum(["waiter", "kitchen", "manager", "admin"], {
    error: "Selecione um papel valido.",
  }),
});

// ---------------------------------------------------------------------------
// Configuracao do restaurante
// ---------------------------------------------------------------------------

export const tableSchema = z.object({
  number: z.coerce
    .number()
    .int("O numero da mesa precisa ser inteiro.")
    .min(1, "O numero da mesa comeca em 1.")
    .max(9999, "Numero de mesa muito alto."),
  name: optionalText(60),
  capacity: z.coerce
    .number()
    .int()
    .min(1, "A mesa precisa comportar ao menos 1 pessoa.")
    .max(50, "Capacidade maxima de 50 lugares."),
  area: optionalText(60),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: requiredText("O nome da categoria", 2, 80),
  description: optionalText(280),
  position: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const productSchema = z.object({
  name: requiredText("O nome do produto", 2, 120),
  description: optionalText(500),
  categoryId: z.uuid("Selecione uma categoria.").nullable(),
  price: z.coerce
    .number()
    .min(0, "O preco nao pode ser negativo.")
    .max(99999.99, "Preco acima do limite."),
  prepMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(600)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  imageUrl: z.url("URL de imagem invalida.").nullable().optional().default(null),
  position: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
});

export const staffUpdateSchema = z.object({
  name: requiredText("O nome do funcionario", 2, 120),
  role: z.enum(["waiter", "kitchen", "manager", "admin"], {
    error: "Selecione um papel valido.",
  }),
  phone: optionalText(20),
  status: z.enum(["active", "inactive"]),
});

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const orderItemSchema = z.object({
  productId: z.uuid("Produto invalido."),
  quantity: z.coerce
    .number()
    .int("A quantidade precisa ser inteira.")
    .min(1, "A quantidade minima e 1.")
    .max(99, "Quantidade maxima de 99 por item."),
  notes: optionalText(280),
});

export const createOrderSchema = z.object({
  tableId: z.uuid("Selecione uma mesa."),
  // Gerada no cliente antes do envio: dois cliques no mesmo botao produzem a
  // mesma chave e o banco recusa o duplicado (secao 22 do roadmap).
  clientRequestId: z.uuid(),
  notes: optionalText(500),
});

export const cancelOrderSchema = z.object({
  orderId: z.uuid(),
  reason: z.enum(
    ["customer_gave_up", "waiter_error", "product_unavailable", "duplicate", "other"],
    { error: "Selecione o motivo do cancelamento." },
  ),
  note: optionalText(500),
});

export const restaurantSettingsSchema = z.object({
  name: requiredText("O nome do restaurante", 2, 120),
  timezone: z.string().min(3).max(60),
  logoUrl: z.url("URL de logo invalida.").nullable().optional().default(null),
});

export type InvitationInput = z.infer<typeof invitationSchema>;
export type TableInput = z.infer<typeof tableSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
