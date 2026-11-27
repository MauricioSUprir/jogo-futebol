import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import { ErroSorteio, sortear, validarPares, type Restricao } from "@/lib/sorteio/algoritmo";

/**
 * Executa o sorteio NO SERVIDOR: lê os aprovados e as restrições com a chave service_role, roda o algoritmo
 * (aleatoriedade criptográfica) e grava tudo de uma vez com public.commit_draw — que trava o evento e confere de novo a
 * permutação inteira e as restrições dentro da mesma transação. Os pares nunca saem daqui: a função devolve só a versão.
 *
 * Quem pode chamar: a Server Action do organizador (depois de conferir que ele é organizador) e o cron dos sorteios
 * agendados. Em nenhum dos dois casos o resultado é devolvido para a interface.
 */
export interface PedidoSorteio {
  eventoId: string;
  /** organizador que pediu (null = sorteio agendado) */
  autorId: string | null;
  refazer?: boolean;
  motivo?: string;
}

export class ErroServicoSorteio extends Error {
  constructor(public readonly codigo: string) {
    super(codigo);
  }
}

type EntradaSorteio = {
  status: "open" | "drawn" | "finished";
  archived: boolean;
  draw_version: number;
  participants: string[];
  restrictions: Restricao[];
};

export async function executarSorteio(pedido: PedidoSorteio): Promise<{ versao: number; participantes: number }> {
  const admin = clienteAdmin();
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const { data, error } = await admin.rpc("draw_input", { p_event: pedido.eventoId });
    if (error) throw new ErroServicoSorteio(error.message);
    if (!data) throw new ErroServicoSorteio("event_not_found");
    const entrada = data as unknown as EntradaSorteio;
    if (entrada.archived) throw new ErroServicoSorteio("event_archived");
    if (entrada.status === "finished") throw new ErroServicoSorteio("event_finished");
    if (entrada.status === "drawn" && !pedido.refazer) throw new ErroServicoSorteio("already_drawn");
    if (entrada.status === "open" && pedido.refazer) throw new ErroServicoSorteio("not_drawn");

    let pares;
    try {
      pares = sortear(entrada.participants, entrada.restrictions).pares;
    } catch (e) {
      if (e instanceof ErroSorteio) throw new ErroServicoSorteio(e.codigo);
      throw e;
    }
    const problema = validarPares(entrada.participants, entrada.restrictions, pares);
    if (problema) throw new Error(`sorteio inválido: ${problema}`); // não acontece; o banco confere de novo

    const { data: versao, error: erroCommit } = await admin.rpc("commit_draw", {
      p_event: pedido.eventoId,
      p_pairs: pares,
      p_expected_version: entrada.draw_version,
      p_actor: pedido.autorId ?? undefined,
      p_scheduled: pedido.autorId === null,
      p_redraw: !!pedido.refazer,
      p_reason: pedido.motivo || undefined,
    });
    if (!erroCommit) return { versao: versao as number, participantes: entrada.participants.length };
    // a lista mudou entre a leitura e a gravação (alguém entrou/saiu): lê de novo e sorteia outra vez
    if ((erroCommit.message === "roster_changed" || erroCommit.message === "version_conflict") && tentativa < 3) continue;
    throw new ErroServicoSorteio(erroCommit.message);
  }
  throw new ErroServicoSorteio("roster_changed");
}

/** Sorteios agendados cuja hora chegou (cron e páginas do grupo chamam; o banco garante que cada um roda uma vez). */
export async function executarSorteiosVencidos(): Promise<{ eventoId: string; ok: boolean; erro?: string }[]> {
  const admin = clienteAdmin();
  const { data, error } = await admin.rpc("cron_due_draws");
  if (error) throw error;
  const resultados: { eventoId: string; ok: boolean; erro?: string }[] = [];
  for (const eventoId of (data ?? []) as string[]) {
    try {
      await executarSorteio({ eventoId, autorId: null });
      resultados.push({ eventoId, ok: true });
    } catch (e) {
      resultados.push({ eventoId, ok: false, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return resultados;
}
