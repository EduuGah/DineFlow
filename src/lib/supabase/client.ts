"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Client do browser. Uma unica instancia por aba: cada `createBrowserClient`
 * abre o proprio canal de realtime, e varios canais para a mesma mesa e o
 * caminho mais rapido para eventos duplicados no KDS.
 */
export function createClient() {
  cached ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return cached;
}
