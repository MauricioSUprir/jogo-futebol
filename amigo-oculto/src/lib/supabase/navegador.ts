"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente do navegador (mesma sessão dos cookies). Usado no tempo real, nos uploads e no login. */
export function clienteNavegador() {
  if (!cliente) cliente = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cliente;
}
