"use client";

import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/types/database";

/**
 * Fila local de operações (secao 22 do roadmap).
 *
 * Restaurante com Wi-Fi ruim e a regra, não a exceção. Toda escrita do garçom
 * entra aqui antes de ir para o servidor: se a rede cair no meio do envio, a
 * operação fica gravada no aparelho e sai sozinha quando a conexão voltar.
 *
 * IDEMPOTENCIA
 * Cada operação carrega um id gerado no cliente e usado como chave primaria da
 * linha. Reenviar a mesma operação colide com a chave existente -- o banco
 * recusa e nos tratamos como "já aplicada". E por isso que dois cliques no
 * botao Enviar, ou um retry automático, nunca viram dois pedidos.
 *
 * Vale notar o limite disso: o id gerado no cliente identifica uma linha que o
 * usuário tem permissão de criar. Nenhuma decisão de acesso depende dele -- o
 * RLS continua derivando o tenant da sessão, nunca do payload.
 */

const STORAGE_KEY = "dineflow:outbox:v1";
const MAX_ATTEMPTS = 8;

export type OutboxOperation =
  | {
      kind: "order.create";
      id: string;
      restaurantId: string;
      tableId: string;
      waiterId: string;
      clientRequestId: string;
      notes: string | null;
    }
  | {
      kind: "item.add";
      id: string;
      restaurantId: string;
      orderId: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      notes: string | null;
    }
  | { kind: "item.update"; id: string; quantity: number; notes: string | null }
  | { kind: "item.remove"; id: string }
  | {
      kind: "order.status";
      id: string;
      orderId: string;
      status: Enums<"order_status">;
      reason?: Enums<"cancellation_reason">;
      reasonNote?: string | null;
    };

type Entry = { operation: OutboxOperation; attempts: number; queuedAt: number };

type Listener = (state: { pending: number; flushing: boolean }) => void;

let listeners: Listener[] = [];
let flushing = false;

function read(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    // localStorage corrompido não pode derrubar o app do garçom.
    return [];
  }
}

function write(entries: Entry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Cota estourada: seguimos sem persistir e a operação vai na tentativa atual.
  }
  notify(entries.length);
}

function notify(pending: number) {
  for (const listener of listeners) listener({ pending, flushing });
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.push(listener);
  listener({ pending: read().length, flushing });
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

export function pendingCount(): number {
  return read().length;
}

/** Erro de rede (vale reenviar) x erro do banco (não adianta insistir). */
function isTransient(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? "";
  const code = (error as { code?: string })?.code ?? "";

  if (code) return false;
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("network") ||
    message.includes("timeout")
  );
}

/** Chave duplicada = a operação já tinha sido aplicada numa tentativa anterior. */
function isAlreadyApplied(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}

async function execute(operation: OutboxOperation): Promise<void> {
  const supabase = createClient();

  if (operation.kind === "order.create") {
    const { error } = await supabase.from("orders").insert({
      id: operation.id,
      restaurant_id: operation.restaurantId,
      table_id: operation.tableId,
      waiter_id: operation.waiterId,
      client_request_id: operation.clientRequestId,
      notes: operation.notes,
    });
    if (error && !isAlreadyApplied(error)) throw error;
    return;
  }

  if (operation.kind === "item.add") {
    const { error } = await supabase.from("order_items").insert({
      id: operation.id,
      restaurant_id: operation.restaurantId,
      order_id: operation.orderId,
      product_id: operation.productId,
      // Nome e preço são sobrescritos pelo trigger com os valores do cardápio.
      // Vao no payload apenas para satisfazer o NOT NULL da coluna.
      product_name: operation.productName,
      quantity: operation.quantity,
      unit_price: operation.unitPrice,
      notes: operation.notes,
      batch: 1,
    });
    if (error && !isAlreadyApplied(error)) throw error;
    return;
  }

  if (operation.kind === "item.update") {
    const { error } = await supabase
      .from("order_items")
      .update({ quantity: operation.quantity, notes: operation.notes })
      .eq("id", operation.id);
    if (error) throw error;
    return;
  }

  if (operation.kind === "item.remove") {
    const { error } = await supabase.from("order_items").delete().eq("id", operation.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: operation.status,
      cancellation_reason: operation.reason ?? null,
      cancellation_note: operation.reasonNote ?? null,
    })
    .eq("id", operation.orderId);
  if (error) throw error;
}

export type FlushResult = {
  applied: number;
  failed: { operation: OutboxOperation; error: unknown }[];
  pending: number;
};

/**
 * Envia a fila em ordem. Para na primeira falha de rede -- reenviar as
 * seguintes fora de ordem criaria item em pedido que ainda não existe.
 */
export async function flushOutbox(): Promise<FlushResult> {
  if (flushing) return { applied: 0, failed: [], pending: read().length };

  flushing = true;
  notify(read().length);

  const failed: FlushResult["failed"] = [];
  let applied = 0;

  try {
    let entries = read();

    while (entries.length > 0) {
      const [entry, ...rest] = entries;

      try {
        await execute(entry.operation);
        applied += 1;
        entries = rest;
        write(entries);
      } catch (error) {
        if (isTransient(error) && entry.attempts + 1 < MAX_ATTEMPTS) {
          entries[0] = { ...entry, attempts: entry.attempts + 1 };
          write(entries);
          break;
        }

        // Erro definitivo (produto indisponível, pedido já fechado, sem
        // permissão): descartamos a operação e devolvemos o motivo, para a
        // tela poder explicar em vez de tentar para sempre.
        failed.push({ operation: entry.operation, error });
        entries = rest;
        write(entries);
      }
    }

    return { applied, failed, pending: entries.length };
  } finally {
    flushing = false;
    notify(read().length);
  }
}

export function enqueue(operation: OutboxOperation): void {
  const entries = read();
  entries.push({ operation, attempts: 0, queuedAt: Date.now() });
  write(entries);
}

/**
 * Caminho normal de escrita: tenta direto e, se a rede falhar, guarda para
 * depois. Erros do banco sobem na hora -- "produto indisponível" precisa
 * aparecer enquanto o garçom ainda está na mesa.
 */
export async function submit(operation: OutboxOperation): Promise<{ queued: boolean }> {
  if (read().length > 0) {
    // Já existe fila: entrar nela mantem a ordem das operações.
    enqueue(operation);
    void flushOutbox();
    return { queued: true };
  }

  try {
    await execute(operation);
    return { queued: false };
  } catch (error) {
    if (!isTransient(error)) throw error;
    enqueue(operation);
    return { queued: true };
  }
}

export function clearOutbox() {
  write([]);
}
