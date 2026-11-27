"use client";
import { useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CheckCheck, EyeOff, Flag, Gift, HelpCircle, Lightbulb, Loader2, MessageCircle, Send } from "lucide-react";
import { SeletorEmojis, inserirNoCursor } from "@/components/chat/seletor-emojis";
import { horaCurta, rotuloDoDia, chaveDoDia } from "@/components/sala/tempo";
import { TIPOS_MENSAGEM, type MensagemAnonima, type TipoMensagemAnonima } from "@/components/mensagens/tipos";
import type { Resultado } from "@/lib/acoes/resultado";
import { dataHora } from "@/lib/formatos";
import { cn } from "@/lib/cn";

export const ICONES_TIPO: Record<TipoMensagemAnonima, typeof MessageCircle> = {
  message: MessageCircle,
  question: HelpCircle,
  clue: Lightbulb,
  gift_info: Gift,
};

const SUGESTOES: Record<TipoMensagemAnonima, string[]> = {
  question: [
    "Qual o seu número de calçado?",
    "Qual tamanho de camiseta você usa?",
    "Prefere doce ou salgado?",
    "Qual é a sua cor favorita?",
    "Tem algum hobby novo?",
    "Tem alguma alergia que eu deva saber?",
  ],
  gift_info: [
    "O que você mais quer da sua lista?",
    "Prefere algo útil ou divertido?",
    "Tem algo que você não gostaria de ganhar?",
    "Livro, roupa ou experiência?",
  ],
  clue: ["Pista: eu adoro ", "Pista: nós já ", "Pista: o seu presente tem a ver com "],
  message: ["Já estou pensando no seu presente!", "Você vai gostar, prometo.", "Boas festas!"],
};

export type PropsConversa = {
  id: string;
  /** quem está do outro lado, como aparece no topo */
  cabecalho: ReactNode;
  mensagens: MensagemAnonima[];
  /** texto quando não há mensagens */
  vazio: ReactNode;
  /** null = pode escrever; texto = motivo para não poder */
  bloqueio: ReactNode | null;
  /** mostra o seletor de tipo e as sugestões (lado de quem tirou) */
  comTipos: boolean;
  rotuloCampo: string;
  placeholder: string;
  dica?: ReactNode;
  aoEnviar: (tipo: TipoMensagemAnonima, texto: string) => Promise<Resultado<unknown>>;
  aoDenunciar: (m: MensagemAnonima) => void;
  /** quem é o outro lado nas bolhas dele (para leitores de tela) */
  nomeOutro: string;
};

export function Conversa({
  id,
  cabecalho,
  mensagens,
  vazio,
  bloqueio,
  comTipos,
  rotuloCampo,
  placeholder,
  dica,
  aoEnviar,
  aoDenunciar,
  nomeOutro,
}: PropsConversa) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoMensagemAnonima>("question");
  const [erro, setErro] = useState<string | null>(null);
  const [provisoria, setProvisoria] = useState<MensagemAnonima | null>(null);
  const [enviando, iniciar] = useTransition();
  const lista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const tudo = provisoria ? [...mensagens, provisoria] : mensagens;

  useLayoutEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tudo.length]);

  function enviar() {
    const t = texto.trim();
    if (!t) {
      setErro("Escreva a mensagem.");
      campo.current?.focus();
      return;
    }
    const tipoFinal = comTipos ? tipo : "message";
    setErro(null);
    setProvisoria({ id: "tmp", minha: true, tipo: tipoFinal, texto: t, oculta: false, criadaEm: new Date().toISOString(), lidaEm: null });
    setTexto("");
    iniciar(async () => {
      const r = await aoEnviar(tipoFinal, t);
      setProvisoria(null);
      if (!r.ok) {
        setTexto(t);
        setErro(r.erro);
      }
    });
  }

  let diaAnterior = "";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-borda px-4 py-3 sm:px-5">{cabecalho}</div>
      <div
        ref={lista}
        role="region"
        aria-label="Mensagens"
        tabIndex={0}
        className="rolagem-fina flex max-h-[55dvh] min-h-[16rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 lg:max-h-[min(60dvh,34rem)]"
      >
        {tudo.length === 0 ? <div className="m-auto max-w-xs py-6 text-center text-sm text-suave">{vazio}</div> : null}
        {tudo.map((m) => {
          const dia = chaveDoDia(m.criadaEm);
          const novoDia = dia !== diaAnterior;
          diaAnterior = dia;
          const Icone = ICONES_TIPO[m.tipo];
          return (
            <div key={m.id} className="flex flex-col">
              {novoDia ? (
                <p className="my-2 self-center rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold capitalize text-suave dark:bg-white/[0.06]" suppressHydrationWarning>
                  {rotuloDoDia(m.criadaEm)}
                </p>
              ) : null}
              <div className={cn("group flex max-w-[88%] items-center gap-1 sm:max-w-[78%]", m.minha ? "flex-row-reverse self-end" : "self-start")}>
                <div
                  title={dataHora(m.criadaEm) ?? undefined}
                  className={cn(
                    "min-w-0 rounded-3xl px-4 py-2.5",
                    m.oculta
                      ? "border border-dashed border-borda text-sm italic text-suave"
                      : m.minha
                        ? "rounded-br-lg bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_72%,black))] text-white"
                        : "rounded-bl-lg border border-borda bg-white/85 dark:bg-white/[0.07]",
                    m.id === "tmp" && "opacity-70",
                  )}
                >
                  <span className="sr-only">{m.minha ? "Você" : nomeOutro}: </span>
                  {m.tipo !== "message" && !m.oculta ? (
                    <span
                      className={cn(
                        "mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider",
                        m.minha ? "text-white/85" : "text-t1",
                      )}
                    >
                      <Icone className="size-3.5" aria-hidden /> {TIPOS_MENSAGEM[m.tipo].rotulo}
                    </span>
                  ) : null}
                  {m.oculta ? (
                    <span className="flex items-center gap-1.5">
                      <EyeOff className="size-4" aria-hidden /> Mensagem denunciada e escondida
                    </span>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.texto}</p>
                  )}
                </div>
                {!m.minha && !m.oculta ? (
                  <button
                    type="button"
                    onClick={() => aoDenunciar(m)}
                    aria-label="Denunciar esta mensagem"
                    title="Denunciar"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-suave/60 transition hover:bg-black/5 hover:text-rubi focus-visible:text-rubi pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 dark:hover:bg-white/10"
                  >
                    <Flag className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <p className={cn("mt-0.5 flex items-center gap-1 px-2 text-[11px] text-suave", m.minha ? "self-end" : "self-start")} suppressHydrationWarning>
                {m.id === "tmp" ? "enviando…" : horaCurta(m.criadaEm)}
                {m.minha && m.lidaEm ? (
                  <span className="inline-flex items-center gap-0.5 text-esmeralda">
                    · <CheckCheck className="size-3.5" aria-hidden /> lida
                  </span>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-borda px-3 pb-3 pt-3 sm:px-5">
        {bloqueio ? (
          <div className="rounded-2xl bg-black/[0.04] px-4 py-3 text-sm text-suave dark:bg-white/[0.05]" role="status">
            {bloqueio}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            {comTipos ? (
              <>
                <fieldset className="mb-2">
                  <legend className="sr-only">Tipo da mensagem</legend>
                  <div className="rolagem-fina -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {(["question", "gift_info", "clue", "message"] as TipoMensagemAnonima[]).map((t) => {
                      const I = ICONES_TIPO[t];
                      return (
                        <label
                          key={t}
                          className={cn(
                            "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition focus-within:ring-4 focus-within:ring-ouro/30",
                            tipo === t ? "border-t1 bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1" : "border-borda text-suave hover:text-texto",
                          )}
                        >
                          <input type="radio" name={`tipo-${id}`} value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
                          <I className="size-4" aria-hidden /> {TIPOS_MENSAGEM[t].rotulo}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Sugestões rápidas" role="group">
                  {SUGESTOES[tipo].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setTexto(s);
                        requestAnimationFrame(() => {
                          campo.current?.focus();
                          campo.current?.setSelectionRange(s.length, s.length);
                        });
                      }}
                      className="min-h-9 rounded-full bg-black/[0.04] px-3 text-left text-xs font-medium text-texto transition hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                    >
                      {s.trim()}
                      {s.endsWith(" ") ? "…" : ""}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <div className="flex items-end gap-1">
              <SeletorEmojis aoEscolher={(e) => setTexto((v) => inserirNoCursor(campo.current, v, e))} />
              <div className="min-w-0 flex-1">
                <label htmlFor={`campo-${id}`} className="sr-only">
                  {rotuloCampo}
                </label>
                <textarea
                  id={`campo-${id}`}
                  ref={campo}
                  rows={1}
                  value={texto}
                  maxLength={1000}
                  enterKeyHint="send"
                  placeholder={placeholder}
                  aria-invalid={erro ? true : undefined}
                  aria-describedby={erro ? `erro-${id}` : dica ? `dica-${id}` : undefined}
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
                disabled={!texto.trim() || enviando}
                aria-label="Enviar em segredo"
                title="Enviar em segredo"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white shadow-md transition active:scale-95 disabled:opacity-45"
              >
                {enviando ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
              </button>
            </div>
            {erro ? (
              <p id={`erro-${id}`} role="alert" className="px-2 pt-1.5 text-sm font-medium text-rubi">
                {erro}
              </p>
            ) : dica ? (
              <p id={`dica-${id}`} className="px-2 pt-1.5 text-xs text-suave">
                {dica}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
