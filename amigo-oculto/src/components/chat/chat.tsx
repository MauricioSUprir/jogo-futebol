"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, Copy, Crown, Ellipsis, Flag, Loader2, MessagesSquare, Send, Trash2, VolumeX } from "lucide-react";
import {
  apagarMensagemChat,
  denunciarConteudo,
  enviarMensagemChat,
  mensagensAnteriores,
  perfilDoMembro,
  silenciarParticipante,
} from "@/lib/acoes/sala";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { DialogoDenuncia } from "@/components/sala/denuncia";
import { IndicadorAoVivo, useTempoReal } from "@/components/sala/ao-vivo";
import { chaveDoDia, horaCurta, rotuloDoDia } from "@/components/sala/tempo";
import { SeletorEmojis, inserirNoCursor } from "@/components/chat/seletor-emojis";
import type { MensagemChat, PerfilResumo } from "@/components/chat/tipos";
import { dataHora } from "@/lib/formatos";
import { cn } from "@/lib/cn";

type Msg = MensagemChat & { pendente?: boolean };
type Perfis = Record<string, PerfilResumo>;

const AGRUPAR_MS = 5 * 60_000;
const SUGESTOES = ["Oi, pessoal! 👋", "Já estou animado(a) com o amigo oculto! 🎁", "Alguém já sabe o que vai dar? 🤫"];

function ordenar(lista: Msg[]) {
  return [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** Mensagem só de emojis (até 3) aparece grande, sem balão. */
function soEmojis(texto: string) {
  const t = texto.trim();
  if (!t || t.length > 24) return false;
  if (!/^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s]+$/u.test(t)) return false;
  const seg = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
  return [...seg.segment(t.replace(/\s/g, ""))].length <= 3;
}

export function ChatDoGrupo({
  eventoId,
  eu,
  euParticipanteId,
  admin,
  arquivado,
  silenciadoAteInicial,
  iniciais,
  temMaisInicial,
  perfisIniciais,
}: {
  eventoId: string;
  eu: string;
  euParticipanteId: string;
  admin: boolean;
  arquivado: boolean;
  silenciadoAteInicial: string | null;
  iniciais: MensagemChat[];
  temMaisInicial: boolean;
  perfisIniciais: Perfis;
}) {
  const [mensagens, setMensagens] = useState<Msg[]>(() => ordenar(iniciais));
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const [perfis, setPerfis] = useState<Perfis>(perfisIniciais);
  const [silenciadoAte, setSilenciadoAte] = useState<string | null>(silenciadoAteInicial);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [novasAbaixo, setNovasAbaixo] = useState(0);
  const [anuncio, setAnuncio] = useState("");
  const [acoesDe, setAcoesDe] = useState<Msg | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [denunciar, setDenunciar] = useState<Msg | null>(null);
  const [focado, setFocado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [ocupado, iniciar] = useTransition();
  const lista = useRef<HTMLDivElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const restaurarRolagem = useRef<number | null>(null);
  const buscandoPerfil = useRef(new Set<string>());
  const { avisar } = useAvisos();
  const { som } = usePreferencias();

  const silenciado = !!silenciadoAte && new Date(silenciadoAte).getTime() > agora;
  const podeEscrever = !arquivado && !silenciado;

  // relógio para "Hoje/Ontem" e para o fim do silêncio
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const pertoDoFim = useCallback(() => {
    const el = lista.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }, []);

  const rolarParaOFim = useCallback((suave = false) => {
    const el = lista.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
    setNovasAbaixo(0);
  }, []);

  // ao abrir: a conversa no fim e o cartão do chat inteiro na tela (o campo fica logo acima da barra do celular)
  useLayoutEffect(() => {
    rolarParaOFim();
    const c = cartao.current;
    if (c) {
      const r = c.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top - 88 });
    }
  }, [rolarParaOFim]);

  // depois de carregar as anteriores, mantém a mesma mensagem na tela
  useLayoutEffect(() => {
    const el = lista.current;
    if (el && restaurarRolagem.current !== null) {
      el.scrollTop = el.scrollHeight - restaurarRolagem.current;
      restaurarRolagem.current = null;
    }
  }, [mensagens]);

  const garantirPerfil = useCallback(
    async (usuarioId: string) => {
      if (perfis[usuarioId] || buscandoPerfil.current.has(usuarioId)) return;
      buscandoPerfil.current.add(usuarioId);
      const p = await perfilDoMembro(eventoId, usuarioId);
      if (p) setPerfis((atual) => ({ ...atual, [usuarioId]: p }));
    },
    [eventoId, perfis],
  );

  const chegou = useCallback(
    (m: MensagemChat) => {
      const embaixo = pertoDoFim();
      setMensagens((atual) => (atual.some((x) => x.id === m.id) ? atual : ordenar([...atual, m])));
      if (m.user_id !== eu) {
        void garantirPerfil(m.user_id);
        const nome = perfis[m.user_id]?.nome ?? "Alguém";
        setAnuncio(`Nova mensagem de ${nome}: ${m.body}`);
        tocar("tique", som);
        if (embaixo) requestAnimationFrame(() => rolarParaOFim(true));
        else setNovasAbaixo((n) => n + 1);
      }
    },
    [eu, garantirPerfil, perfis, pertoDoFim, rolarParaOFim, som],
  );

  const estado = useTempoReal(
    `chat:${eventoId}`,
    [
      { tabela: "chat_messages", evento: "INSERT", filtro: `event_id=eq.${eventoId}` },
      { tabela: "chat_messages", evento: "UPDATE", filtro: `event_id=eq.${eventoId}` },
      { tabela: "participants", evento: "UPDATE", filtro: `id=eq.${euParticipanteId}` },
    ],
    (mud) => {
      if (mud.tabela === "participants") {
        setSilenciadoAte((mud.nova.muted_until as string | null) ?? null);
        return;
      }
      const m = mud.nova as unknown as MensagemChat;
      if (mud.tipo === "INSERT") chegou(m);
      else if (mud.tipo === "UPDATE") setMensagens((atual) => atual.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
    },
  );

  // o que chegou com o aparelho dormindo ou a conexão caída: busca as últimas e junta (pelo id)
  const sincronizar = useCallback(async () => {
    const r = await mensagensAnteriores(eventoId, new Date(Date.now() + 60_000).toISOString());
    if (r.ok && r.dados) {
      const novas = r.dados.mensagens;
      for (const n of novas) void garantirPerfil(n.user_id);
      setMensagens((atual) => {
        const porId = new Map(atual.map((x) => [x.id, x] as const));
        for (const n of novas) porId.set(n.id, { ...porId.get(n.id), ...n });
        return ordenar([...porId.values()]);
      });
    }
  }, [eventoId, garantirPerfil]);
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void sincronizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [sincronizar]);
  const estadoAnterior = useRef(estado);
  useEffect(() => {
    if (estadoAnterior.current === "caiu" && estado === "ao-vivo") void sincronizar();
    estadoAnterior.current = estado;
  }, [estado, sincronizar]);

  function enviar() {
    const t = texto.trim();
    if (!t || !podeEscrever) return;
    if (t.length > 1000) {
      setErro("Use até 1.000 caracteres.");
      return;
    }
    setErro(null);
    const tmp: Msg = { id: `tmp-${Date.now()}`, user_id: eu, body: t, created_at: new Date().toISOString(), deleted_at: null, deleted_by: null, pendente: true };
    setMensagens((atual) => [...atual, tmp]);
    setTexto("");
    requestAnimationFrame(() => rolarParaOFim(true));
    iniciar(async () => {
      const r = await enviarMensagemChat(eventoId, t);
      if (r.ok && r.dados) {
        const real = r.dados;
        setMensagens((atual) => {
          const sem = atual.filter((x) => x.id !== tmp.id);
          return sem.some((x) => x.id === real.id) ? sem : ordenar([...sem, real]);
        });
      } else {
        setMensagens((atual) => atual.filter((x) => x.id !== tmp.id));
        setTexto((v) => v || t);
        const msg = r.ok ? "Não foi possível enviar." : r.erro;
        setErro(msg);
        avisar(msg, "erro");
      }
    });
  }

  async function carregarAntigas() {
    const primeira = mensagens.find((m) => !m.pendente);
    if (!primeira || carregandoAntigas) return;
    setCarregandoAntigas(true);
    const r = await mensagensAnteriores(eventoId, primeira.created_at);
    setCarregandoAntigas(false);
    if (!r.ok || !r.dados) {
      avisar(r.ok ? "Não foi possível carregar." : r.erro, "erro");
      return;
    }
    const el = lista.current;
    if (el) restaurarRolagem.current = el.scrollHeight - el.scrollTop;
    const { mensagens: antigas, temMais: mais } = r.dados;
    setTemMais(mais);
    setMensagens((atual) => ordenar([...antigas.filter((a) => !atual.some((x) => x.id === a.id)), ...atual]));
    for (const a of antigas) void garantirPerfil(a.user_id);
    setAnuncio(`${antigas.length} mensagens anteriores carregadas.`);
  }

  // grupos: dia → blocos do mesmo autor (com até 5 min entre as mensagens)
  const dias = useMemo(() => {
    const saida: { dia: string; iso: string; blocos: { autor: string; msgs: Msg[] }[] }[] = [];
    for (const m of mensagens) {
      const dia = chaveDoDia(m.created_at);
      let d = saida[saida.length - 1];
      if (!d || d.dia !== dia) {
        d = { dia, iso: m.created_at, blocos: [] };
        saida.push(d);
      }
      const ultimo = d.blocos[d.blocos.length - 1];
      const anterior = ultimo?.msgs[ultimo.msgs.length - 1];
      if (ultimo && ultimo.autor === m.user_id && new Date(m.created_at).getTime() - new Date(anterior.created_at).getTime() < AGRUPAR_MS) {
        ultimo.msgs.push(m);
      } else d.blocos.push({ autor: m.user_id, msgs: [m] });
    }
    return saida;
  }, [mensagens]);

  const autorDasAcoes = acoesDe ? perfis[acoesDe.user_id] : null;

  return (
    <div
      ref={cartao}
      className={cn(
        "vidro-forte relative flex h-[calc(100dvh-11.5rem)] min-h-[26rem] flex-col overflow-hidden rounded-cartao md:h-[calc(100dvh-7.5rem)]",
        focado && "z-[45]",
      )}
    >
      <header className="flex items-center gap-3 border-b border-borda px-4 py-3 sm:px-5">
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1">
          <MessagesSquare className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-titulo text-lg font-semibold leading-tight">Chat do grupo</h2>
          <p className="truncate text-xs text-suave">Todos do grupo leem. Seja gentil e não dê spoiler do sorteio!</p>
        </div>
        <IndicadorAoVivo estado={estado} />
      </header>

      <div ref={lista} className="rolagem-fina relative flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5" aria-label="Mensagens" role="region" tabIndex={0}>
        {temMais ? (
          <div className="mb-4 flex justify-center">
            <Botao variante="vidro" tamanho="p" onClick={carregarAntigas} carregando={carregandoAntigas}>
              Carregar mensagens anteriores
            </Botao>
          </div>
        ) : mensagens.length ? (
          <p className="mb-4 text-center text-xs text-suave">Começo da conversa</p>
        ) : null}

        {mensagens.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <MessagesSquare className="size-10 text-ouro" aria-hidden />
            <p className="font-titulo text-lg font-semibold">Nenhuma mensagem ainda</p>
            <p className="max-w-xs text-sm text-suave">Puxe o assunto! Tudo o que for escrito aqui aparece na hora para o grupo todo.</p>
            {podeEscrever ? (
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setTexto(s);
                      campo.current?.focus();
                    }}
                    className="vidro min-h-11 rounded-full px-4 text-sm font-medium hover:-translate-y-0.5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          dias.map((d) => (
            <section key={d.dia} aria-label={rotuloDoDia(d.iso, agora)} suppressHydrationWarning>
              <div className="sticky top-0 z-10 my-3 flex justify-center">
                <span className="vidro rounded-full px-3 py-1 text-xs font-semibold capitalize text-suave" suppressHydrationWarning>
                  {rotuloDoDia(d.iso, agora)}
                </span>
              </div>
              {d.blocos.map((b) => {
                const meu = b.autor === eu;
                const autor = perfis[b.autor];
                const nome = autor?.nome ?? "Ex-participante";
                return (
                  <div key={b.msgs[0].id} className={cn("mb-3 flex items-end gap-2", meu && "flex-row-reverse")}>
                    {!meu ? <Avatar nome={nome} caminho={autor?.avatar} tamanho={32} className="mb-5" /> : null}
                    <div className={cn("flex min-w-0 max-w-[82%] flex-col gap-1 sm:max-w-[70%]", meu ? "items-end" : "items-start")}>
                      {!meu ? (
                        <p className="flex items-center gap-1 px-2 text-xs font-semibold text-suave">
                          {nome}
                          {autor?.admin ? (
                            <span className="inline-flex items-center gap-0.5 text-ouro-escuro dark:text-ouro-claro">
                              <Crown className="size-3" aria-hidden /> <span className="sr-only">organizador</span>
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      {b.msgs.map((m, i) => (
                        <Bolha
                          key={m.id}
                          m={m}
                          meu={meu}
                          primeira={i === 0}
                          ultima={i === b.msgs.length - 1}
                          nome={meu ? "Você" : nome}
                          aoAcoes={() => {
                            setConfirmarApagar(false);
                            setAcoesDe(m);
                          }}
                        />
                      ))}
                      <p className="px-2 text-[11px] text-suave" suppressHydrationWarning>
                        {horaCurta(b.msgs[b.msgs.length - 1].created_at)}
                        {b.msgs[b.msgs.length - 1].pendente ? " · enviando…" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>

      {novasAbaixo > 0 ? (
        <button
          type="button"
          onClick={() => rolarParaOFim(true)}
          className="absolute bottom-24 left-1/2 z-20 inline-flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] px-4 text-sm font-semibold text-white shadow-lg"
        >
          <ArrowDown className="size-4" aria-hidden /> {novasAbaixo} nova{novasAbaixo === 1 ? "" : "s"} mensage{novasAbaixo === 1 ? "m" : "ns"}
        </button>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {anuncio}
      </p>

      <div className="border-t border-borda bg-[var(--vidro-forte)] px-2 pb-2 pt-2 sm:px-4 sm:pb-3">
        {!podeEscrever ? (
          <p className="flex items-center gap-2 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm text-suave dark:bg-white/[0.05]" role="status">
            <VolumeX className="size-4 shrink-0" aria-hidden />
            {arquivado
              ? "Este grupo está arquivado: o chat fica só para leitura."
              : `O organizador silenciou você até ${dataHora(silenciadoAte)}. Você ainda pode ler as mensagens.`}
          </p>
        ) : (
          <form
            className="flex items-end gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            <SeletorEmojis aoEscolher={(e) => setTexto((v) => inserirNoCursor(campo.current, v, e))} />
            <div className="min-w-0 flex-1">
              <label htmlFor="campo-chat" className="sr-only">
                Escreva uma mensagem para o grupo
              </label>
              <textarea
                id="campo-chat"
                ref={campo}
                rows={1}
                value={texto}
                maxLength={1000}
                enterKeyHint="send"
                placeholder="Mensagem para o grupo"
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? "erro-chat" : undefined}
                onFocus={() => setFocado(true)}
                onBlur={() => setFocado(false)}
                onChange={(e) => {
                  setTexto(e.target.value);
                  if (erro) setErro(null);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
                }}
                onKeyDown={(e) => {
                  const toque = window.matchMedia("(pointer: coarse)").matches;
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !toque) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                className="block max-h-36 min-h-11 w-full resize-none rounded-3xl border border-borda bg-white/80 px-4 py-2.5 text-[16px] leading-6 text-texto placeholder:text-suave/80 focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 dark:bg-white/5"
              />
            </div>
            <button
              type="submit"
              disabled={!texto.trim() || ocupado}
              aria-label="Enviar mensagem"
              title="Enviar (Enter)"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white shadow-md transition active:scale-95 disabled:opacity-45"
            >
              {ocupado ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
            </button>
          </form>
        )}
        {erro ? (
          <p id="erro-chat" role="alert" className="px-3 pt-1.5 text-sm font-medium text-rubi">
            {erro}
          </p>
        ) : null}
      </div>

      {/* ações de uma mensagem */}
      <Dialogo
        aberto={!!acoesDe}
        aoFechar={() => setAcoesDe(null)}
        titulo={acoesDe?.user_id === eu ? "Sua mensagem" : `Mensagem de ${autorDasAcoes?.nome ?? "ex-participante"}`}
        descricao={acoesDe ? dataHora(acoesDe.created_at, { weekday: "long" }) : undefined}
      >
        {acoesDe ? (
          <div className="flex flex-col gap-2">
            <blockquote className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-borda bg-black/[0.03] px-4 py-3 text-sm dark:bg-white/[0.04]">
              {acoesDe.body}
            </blockquote>
            <AcaoMenu
              icone={<Copy className="size-4" aria-hidden />}
              rotulo="Copiar o texto"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(acoesDe.body);
                  avisar("Texto copiado.");
                } catch {
                  avisar("Não foi possível copiar.", "erro");
                }
                setAcoesDe(null);
              }}
            />
            {acoesDe.user_id !== eu ? (
              <AcaoMenu
                icone={<Flag className="size-4" aria-hidden />}
                rotulo="Denunciar mensagem"
                onClick={() => {
                  setDenunciar(acoesDe);
                  setAcoesDe(null);
                }}
              />
            ) : null}
            {admin && acoesDe.user_id !== eu && autorDasAcoes?.participanteId && !autorDasAcoes.admin ? (
              <div className="rounded-2xl border border-borda p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <VolumeX className="size-4" aria-hidden /> Silenciar {autorDasAcoes.nome.split(" ")[0]} no chat e no mural
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { min: 60, rotulo: "1 hora" },
                    { min: 60 * 24, rotulo: "1 dia" },
                    { min: 60 * 24 * 7, rotulo: "7 dias" },
                    { min: 0, rotulo: "Retirar silêncio" },
                  ].map((o) => (
                    <Botao
                      key={o.rotulo}
                      tamanho="p"
                      variante={o.min ? "contorno" : "fantasma"}
                      disabled={ocupado}
                      onClick={() => {
                        const alvo = autorDasAcoes.participanteId!;
                        setAcoesDe(null);
                        iniciar(async () => {
                          const r = await silenciarParticipante(eventoId, alvo, o.min);
                          avisar(r.ok ? (r.mensagem ?? "Feito.") : r.erro, r.ok ? "ok" : "erro");
                        });
                      }}
                    >
                      {o.rotulo}
                    </Botao>
                  ))}
                </div>
              </div>
            ) : null}
            {acoesDe.user_id === eu || admin ? (
              confirmarApagar ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-rubi/40 bg-rubi/5 p-3">
                  <p className="flex-1 text-sm">Apagar para todos? Fica só “mensagem removida”.</p>
                  <Botao tamanho="p" variante="fantasma" onClick={() => setConfirmarApagar(false)}>
                    Cancelar
                  </Botao>
                  <Botao
                    tamanho="p"
                    variante="perigo"
                    onClick={() => {
                      const alvo = acoesDe;
                      setAcoesDe(null);
                      iniciar(async () => {
                        setMensagens((atual) =>
                          atual.map((x) => (x.id === alvo.id ? { ...x, body: "", deleted_at: new Date().toISOString(), deleted_by: eu } : x)),
                        );
                        const r = await apagarMensagemChat(alvo.id);
                        if (!r.ok) {
                          setMensagens((atual) => atual.map((x) => (x.id === alvo.id ? alvo : x)));
                          avisar(r.erro, "erro");
                        } else avisar("Mensagem apagada.");
                      });
                    }}
                  >
                    Apagar
                  </Botao>
                </div>
              ) : (
                <AcaoMenu
                  perigo
                  icone={<Trash2 className="size-4" aria-hidden />}
                  rotulo={acoesDe.user_id === eu ? "Apagar minha mensagem" : "Apagar mensagem (organizador)"}
                  onClick={() => setConfirmarApagar(true)}
                />
              )
            ) : null}
          </div>
        ) : null}
      </Dialogo>

      <DialogoDenuncia
        aberto={!!denunciar}
        aoFechar={() => setDenunciar(null)}
        trecho={denunciar?.body}
        explicacao="O organizador recebe a denúncia com o texto da mensagem e decide se apaga ou silencia quem mandou."
        aoConfirmar={(motivo) => denunciarConteudo("chat", denunciar!.id, motivo)}
      />
    </div>
  );
}

function Bolha({
  m,
  meu,
  primeira,
  ultima,
  nome,
  aoAcoes,
}: {
  m: Msg;
  meu: boolean;
  primeira: boolean;
  ultima: boolean;
  nome: string;
  aoAcoes: () => void;
}) {
  const apagada = !!m.deleted_at;
  const grande = !apagada && soEmojis(m.body);
  return (
    <div className={cn("group flex max-w-full items-center gap-0.5", meu && "flex-row-reverse")}>
      <div
        title={dataHora(m.created_at) ?? undefined}
        className={cn(
          "min-w-0 max-w-full whitespace-pre-wrap break-words text-[15px] leading-relaxed",
          grande
            ? "px-1 text-4xl leading-tight"
            : cn(
                "rounded-3xl px-4 py-2.5",
                meu
                  ? "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_72%,black))] text-white"
                  : "border border-borda bg-white/85 dark:bg-white/[0.07]",
                meu ? (primeira ? "rounded-tr-3xl" : "rounded-tr-lg") : primeira ? "rounded-tl-3xl" : "rounded-tl-lg",
                meu ? !ultima && "rounded-br-lg" : !ultima && "rounded-bl-lg",
                apagada && "border border-dashed border-borda bg-transparent text-suave italic dark:bg-transparent",
                m.pendente && "opacity-70",
              ),
        )}
      >
        <span className="sr-only">{nome}: </span>
        {apagada ? (m.deleted_by && m.deleted_by !== m.user_id ? "Mensagem removida pelo organizador" : "Mensagem removida") : m.body}
      </div>
      {!apagada && !m.pendente ? (
        <button
          type="button"
          onClick={aoAcoes}
          aria-label={`Ações da mensagem de ${nome}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-suave/60 transition hover:bg-black/5 hover:text-texto focus-visible:text-texto pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 dark:hover:bg-white/10"
        >
          <Ellipsis className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function AcaoMenu({ icone, rotulo, onClick, perigo }: { icone: React.ReactNode; rotulo: string; onClick: () => void; perigo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-semibold transition hover:bg-black/5 dark:hover:bg-white/10",
        perigo && "text-rubi",
      )}
    >
      {icone} {rotulo}
    </button>
  );
}
