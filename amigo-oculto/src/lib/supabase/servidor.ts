import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Cliente com a sessão de quem está usando (RLS vale). Para Server Components, Server Actions e Route Handlers. */
export async function clienteServidor() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(paraGravar) {
        try {
          for (const { name, value, options } of paraGravar) cookieStore.set(name, value, options);
        } catch {
          // Server Component não grava cookie; o proxy renova a sessão em toda requisição.
        }
      },
    },
  });
}

export type ClienteSupabase = Awaited<ReturnType<typeof clienteServidor>>;
