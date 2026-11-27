"use client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Assina um canal do tempo real só depois de entregar o token da sessão ao socket. Sem isso, um canal montado logo
 * na abertura da página pode entrar como anônimo (a sessão dos cookies ainda não carregou) e o servidor recusa os
 * filtros ("invalid column for filter"), porque o anônimo não enxerga as tabelas.
 * O nome ganha um sufixo aleatório: no modo estrito do React o efeito monta duas vezes e o tópico não se repete.
 * Devolve a função de limpeza para o `useEffect`.
 */
export function assinarComSessao(
  nome: string,
  montar: (canal: RealtimeChannel) => RealtimeChannel,
  aoStatus?: (status: string) => void,
): () => void {
  const supabase = clienteNavegador();
  let canal: RealtimeChannel | null = null;
  let ativo = true;
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!ativo) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
    } catch {
      // sem sessão: o canal tenta assim mesmo (o RLS decide)
    }
    if (!ativo) return;
    canal = montar(supabase.channel(`${nome}:${Math.random().toString(36).slice(2, 10)}`));
    canal.subscribe((status) => aoStatus?.(status));
  })();
  return () => {
    ativo = false;
    if (canal) void supabase.removeChannel(canal);
  };
}
