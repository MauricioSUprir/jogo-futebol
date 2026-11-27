import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Cliente com a chave service_role (ignora o RLS). SÓ no servidor e só para: o sorteio (algoritmo + commit atômico),
 * o cron e a fila de entrega de e-mail/push. Nunca devolver o que ele lê sem checar a permissão de quem pediu.
 */
export function clienteAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient<Database>(SUPABASE_URL, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
