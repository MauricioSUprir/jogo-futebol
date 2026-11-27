"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BellOff, Check, CheckCheck, ChevronRight, Trash2 } from "lucide-react";
import { Botao, BotaoIcone } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/cartao";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { IndicadorAoVivo, useTempoReal } from "@/components/sala/ao-vivo";
import { dataHora, relativo } from "@/lib/formatos";
import { cn } from "@/lib/cn";
import { excluirLidas, excluirNotificacao, marcarNotificacaoLida, marcarTodasLidas } from "@/lib/acoes/notificacoes";
import { linkSeguro, tipoDaNotificacao, type CorTipo } from "@/components/notificacoes/tipos";

export type Notificacao = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

const COR: Record<CorTipo, string> = {
  t1: "bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1",
  esmeralda: "bg-esmeralda/12 text-esmeralda",
  ouro: "bg-ouro/15 text-ouro-escuro dark:text-ouro-claro",
  rubi: "bg-rubi/12 text-rubi",
  neutro: "bg-black/5 text-suave dark:bg-white/10",
};

/** Lista de notificações: não lidas em destaque, marcar/excluir e as novas chegando em tempo real. */
export function ListaNotificacoes({
  iniciais,
  usuarioId,
  aoVivo,
  soNaoLidas,
  temLidas,
}: {
  iniciais: Notificacao[];
  usuarioId: string;
  /** só a primeira página recebe as novas em tempo real */
  aoVivo: boolean;
  soNaoLidas: boolean;
  temLidas: boolean;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const { menosMovimento } = usePreferencias();
  const [itens, setItens] = useState(iniciais);
  const [anuncio, setAnuncio] = useState("");
  const [ocupado, iniciar] = useTransition();

  useEffect(() => setItens(iniciais), [iniciais]);

  // novas chegando e lidas em outro aparelho, em tempo real (o hook autentica o Realtime antes de assinar e reassina
  // se o canal cair; ao voltar, busca o que passou no meio-tempo)
  const estado = useTempoReal(
    `lista-notificacoes:${usuarioId}`,
    [
      { tabela: "notifications", evento: "INSERT", filtro: `user_id=eq.${usuarioId}` },
      { tabela: "notifications", evento: "UPDATE", filtro: `user_id=eq.${usuarioId}` },
    ],
    (m) => {
      const n = m.nova as unknown as Notificacao;
      if (m.tipo === "INSERT") {
        setItens((l) => (l.some((x) => x.id === n.id) ? l : [n, ...l]));
        setAnuncio(`Nova notificação: ${n.title}`);
      } else if (m.tipo === "UPDATE") {
        setItens((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: n.read_at } : x)));
      }
    },
    aoVivo,
  );
  const estadoAnterior = useRef(estado);
  useEffect(() => {
    if (estadoAnterior.current === "caiu" && estado === "ao-vivo") router.refresh();
    estadoAnterior.current = estado;
  }, [estado, router]);

  const naoLidas = itens.filter((n) => !n.read_at).length;
  const visiveis = soNaoLidas ? itens.filter((n) => !n.read_at) : itens;

  function abrir(n: Notificacao) {
    const destino = linkSeguro(n.link);
    iniciar(async () => {
      if (!n.read_at) {
        setItens((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
        await marcarNotificacaoLida(n.id);
      }
      if (destino) router.push(destino);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {aoVivo ? <IndicadorAoVivo estado={estado} className="mr-auto px-0" /> : null}
        <Botao
          variante="vidro"
          tamanho="p"
          disabled={!naoLidas || ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await marcarTodasLidas();
              if (r.ok) {
                setItens((l) => l.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
                avisar(r.mensagem ?? "Pronto.");
                router.refresh();
              } else avisar(r.erro, "erro");
            })
          }
        >
          <CheckCheck className="size-4" aria-hidden /> Marcar todas como lidas
        </Botao>
        <Botao
          variante="fantasma"
          tamanho="p"
          disabled={!temLidas || ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await excluirLidas();
              if (r.ok) {
                setItens((l) => l.filter((x) => !x.read_at));
                avisar(r.mensagem ?? "Pronto.");
                router.refresh();
              } else avisar(r.erro, "erro");
            })
          }
        >
          <Trash2 className="size-4" aria-hidden /> Limpar as lidas
        </Botao>
      </div>

      {visiveis.length === 0 ? (
        <Vazio
          icone={<BellOff className="size-10" />}
          titulo={soNaoLidas ? "Nenhuma notificação não lida" : "Nenhuma notificação por aqui"}
          texto="Quando houver sorteio, mensagens, avisos ou lembretes nos seus grupos, eles aparecem aqui na hora."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visiveis.map((n) => {
              const tipo = tipoDaNotificacao(n.kind);
              const Icone = tipo.icone;
              const lida = !!n.read_at;
              return (
                <motion.li
                  key={n.id}
                  layout={!menosMovimento}
                  initial={menosMovimento ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={menosMovimento ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 24 }}
                  className={cn(
                    "relative flex items-start gap-3 overflow-hidden rounded-3xl border p-3 pr-2 sm:p-4",
                    lida ? "border-transparent bg-white/35 dark:bg-white/[0.03]" : "vidro-forte border-[color-mix(in_oklab,var(--t1)_30%,transparent)]",
                  )}
                >
                  {!lida ? <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-t1" /> : null}
                  <span className={cn("mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-2xl", COR[tipo.cor])}>
                    <Icone className="size-5" aria-hidden />
                  </span>
                  <button
                    type="button"
                    onClick={() => abrir(n)}
                    className="min-w-0 flex-1 rounded-xl text-left"
                    aria-label={`${lida ? "" : "Não lida. "}${tipo.rotulo}: ${n.title}${n.body ? `. ${n.body}` : ""}`}
                  >
                    <span className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wider text-suave">
                      {tipo.rotulo}
                      <time dateTime={n.created_at} title={dataHora(n.created_at) ?? undefined} className="font-medium normal-case tracking-normal" suppressHydrationWarning>
                        · {relativo(n.created_at)}
                      </time>
                    </span>
                    <span className={cn("mt-0.5 block break-words text-[15px] leading-snug", lida ? "text-texto/85" : "font-semibold")}>{n.title}</span>
                    {n.body ? <span className="mt-0.5 block break-words text-sm text-suave">{n.body}</span> : null}
                    {linkSeguro(n.link) ? (
                      <span className="mt-1 inline-flex items-center gap-0.5 text-sm font-semibold text-t1">
                        Abrir <ChevronRight className="size-4" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!lida ? (
                      <BotaoIcone
                        rotulo={`Marcar como lida: ${n.title}`}
                        className="size-11"
                        onClick={() =>
                          iniciar(async () => {
                            setItens((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
                            const r = await marcarNotificacaoLida(n.id);
                            if (!r.ok) avisar(r.erro, "erro");
                          })
                        }
                      >
                        <Check className="size-4" aria-hidden />
                      </BotaoIcone>
                    ) : null}
                    <BotaoIcone
                      rotulo={`Excluir notificação: ${n.title}`}
                      className="size-11 text-suave hover:text-rubi"
                      onClick={() =>
                        iniciar(async () => {
                          const antes = itens;
                          setItens((l) => l.filter((x) => x.id !== n.id));
                          const r = await excluirNotificacao(n.id);
                          if (!r.ok) {
                            setItens(antes);
                            avisar(r.erro, "erro");
                          }
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </BotaoIcone>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
