/**
 * Conversas anônimas como a interface recebe: um SUBCONJUNTO do que a função `secret_threads` devolve (nada é
 * acrescentado). Do lado "de quem me tirou" não existe nome, id nem foto: só o papel.
 */
export type TipoMensagemAnonima = "message" | "question" | "clue" | "gift_info";

export type MensagemAnonima = {
  id: string;
  minha: boolean;
  tipo: TipoMensagemAnonima;
  texto: string | null;
  oculta: boolean;
  criadaEm: string;
  lidaEm: string | null;
};

export type Conversas =
  | { disponivel: false }
  | {
      disponivel: true;
      /** eu tirei essa pessoa (eu sou anônimo para ela). Sem `revelado`, o nome não sai do servidor: a pessoa ainda
       * não passou pela revelação (o momento é dela) */
      paraQuemTirei: { revelado: boolean; nome: string; bloqueada: boolean; mensagens: MensagemAnonima[] };
      /** essa pessoa me tirou (anônima para mim) */
      deQuemMeTirou: { bloqueada: boolean; mensagens: MensagemAnonima[] } | null;
    };

export type LadoConversa = "receiver" | "santa";

export const TIPOS_MENSAGEM: Record<TipoMensagemAnonima, { rotulo: string; curto: string }> = {
  message: { rotulo: "Mensagem", curto: "Mensagem" },
  question: { rotulo: "Pergunta", curto: "Pergunta" },
  clue: { rotulo: "Pista", curto: "Pista" },
  gift_info: { rotulo: "Sobre o presente", curto: "Presente" },
};

/** Não lidas: mensagens do outro lado (não minhas), visíveis e sem leitura. */
export function naoLidas(lista: MensagemAnonima[] | undefined | null) {
  return (lista ?? []).filter((m) => !m.minha && !m.lidaEm && !m.oculta).length;
}
