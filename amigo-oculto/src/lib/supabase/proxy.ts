import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Renova a sessão (cookies) em toda requisição e devolve quem está logado. */
export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(paraGravar, cabecalhos) {
        for (const { name, value } of paraGravar) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of paraGravar) resposta.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(cabecalhos ?? {})) resposta.headers.set(k, v);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  return { resposta, usuario: data?.claims ?? null };
}
