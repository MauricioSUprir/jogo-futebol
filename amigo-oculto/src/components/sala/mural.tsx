"use client";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { Flag, Send, StickyNote, Trash2 } from "lucide-react";
import { publicarBilhete, excluirBilhete, denunciarConteudo, type CorBilhete } from "@/lib/acoes/sala";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";
import { Vazio } from "@/components/ui/cartao";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { DialogoDenuncia } from "@/components/sala/denuncia";
import { TempoRelativo } from "@/components/sala/tempo";
import { SeletorEmojis, inserirNoCursor } from "@/components/chat/seletor-emojis";
import { cn } from "@/lib/cn";

export type Bilhete = { id: string; user_id: string; body: string; color: CorBilhete; created_at: string };
type Perfis = Record<string, { nome: string; avatar: string | null }>;

const CORES: { valor: CorBilhete; nome: string }[] = [
  { valor: "ouro", nome: "Dourado" },
  { valor: "vermelho", nome: "Vermelho" },
  { valor: "verde", nome: "Verde" },
  { valor: "neve", nome: "Neve" },
  { valor: "rosa", nome: "Rosa" },
  { valor: "azul", nome: "Azul" },
];

/** Inclinação estável de cada bilhete (pelo id), para parecer colado à mão. */
function inclinacao(id: string) {
  let h = 0;
  for (const c of id) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return ((h % 7) - 3) * 0.45;
}

type Acao = { tipo: "novo"; bilhete: Bilhete } | { tipo: "remover"; id: string };

export function MuralDeBilhetes({
  eventoId,
  eu,
  admin,
  bloqueio,
  bilhetes,
  perfis,
}: {
  eventoId: string;
  eu: string;
  admin: boolean;
  /** motivo para não poder escrever (silenciado, arquivado) */
  bloqueio: string | null;
  bilhetes: Bilhete[];
  perfis: Perfis;
}) {
  const [lista, aplicar] = useOptimistic(bilhetes, (atual: Bilhete[], a: Acao) =>
    a.tipo === "novo" ? [a.bilhete, ...atual] : atual.filter((b) => b.id !== a.id),
  );
  const [texto, setTexto] = useState("");
  const [cor, setCor] = useState<CorBilhete>("ouro");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const [apagar, setApagar] = useState<Bilhete | null>(null);
  const [denunciar, setDenunciar] = useState<Bilhete | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const { avisar } = useAvisos();
  const { som } = usePreferencias();

  function publicar() {
    const t = texto.trim();
    if (!t) {
      setErro("Escreva o seu bilhete.");
      campo.current?.focus();
      return;
    }
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "novo", bilhete: { id: `tmp-${Date.now()}`, user_id: eu, body: t, color: cor, created_at: new Date().toISOString() } });
      const r = await publicarBilhete(eventoId, t, cor);
      if (r.ok) {
        setTexto("");
        tocar("tique", som);
        avisar(r.mensagem ?? "Bilhete publicado.");
      } else {
        setErro(r.erro);
        avisar(r.erro, "erro");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {bloqueio ? (
        <p className="vidro rounded-2xl px-4 py-3 text-sm" role="status">
          {bloqueio}
        </p>
      ) : (
        <form
          className="vidro-forte rounded-cartao p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            publicar();
          }}
        >
          <label htmlFor="novo-bilhete" className="mb-2 flex items-center gap-2 font-titulo text-lg font-semibold">
            <StickyNote className="size-5 text-t1" aria-hidden /> Deixe um bilhete para o grupo
          </label>
          <textarea
            id="novo-bilhete"
            ref={campo}
            value={texto}
            maxLength={500}
            rows={3}
            onChange={(e) => {
              setTexto(e.target.value);
              if (erro) setErro(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                publicar();
              }
            }}
            aria-invalid={erro ? true : undefined}
            aria-describedby="novo-bilhete-ajuda"
            placeholder="Um recado, uma lembrança, um “mal posso esperar!”…"
            className={cn(
              "bilhete w-full resize-none rounded-2xl border-0 px-4 py-3 text-[15px] font-medium leading-relaxed shadow-[0_8px_20px_-12px_rgb(0_0_0/0.45)] focus:outline-none focus:ring-4 focus:ring-ouro/40",
              `bilhete-${cor}`,
            )}
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-suave" id="novo-bilhete-ajuda">
            {erro ? (
              <span role="alert" className="font-medium text-rubi">
                {erro}
              </span>
            ) : (
              <span>Todos do grupo veem os bilhetes.</span>
            )}
            <span className="tabular-nums">{texto.length}/500</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <fieldset className="flex items-center gap-1.5">
              <legend className="sr-only">Cor do bilhete</legend>
              {CORES.map((c) => (
                <label key={c.valor} className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full" title={c.nome}>
                  <input
                    type="radio"
                    name="cor-bilhete"
                    value={c.valor}
                    checked={cor === c.valor}
                    onChange={() => setCor(c.valor)}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{c.nome}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "bilhete size-7 rounded-full border border-black/10 transition peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-t1 peer-checked:ring-offset-2 peer-checked:ring-offset-[var(--fundo)] peer-focus-visible:ring-4 peer-focus-visible:ring-ouro/50",
                      `bilhete-${c.valor}`,
                    )}
                  />
                </label>
              ))}
            </fieldset>
            <SeletorEmojis aoEscolher={(e) => setTexto((v) => inserirNoCursor(campo.current, v, e).slice(0, 500))} />
            <Botao type="submit" carregando={enviando} className="ml-auto">
              <Send className="size-4" aria-hidden /> Colar no mural
            </Botao>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        <Vazio
          icone={<StickyNote className="size-8" aria-hidden />}
          titulo="O mural está em branco"
          texto="Seja a primeira pessoa a deixar um bilhete para o grupo."
        />
      ) : (
        <ul className="columns-1 gap-4 sm:columns-2 xl:columns-3" aria-label="Bilhetes do mural">
          {lista.map((b) => {
            const autor = perfis[b.user_id] ?? { nome: "Ex-participante", avatar: null };
            const meu = b.user_id === eu;
            const provisorio = b.id.startsWith("tmp-");
            return (
              <li key={b.id} className="mb-4 break-inside-avoid pt-2">
                <article
                  className={cn(
                    "bilhete relative rounded-[1.25rem] px-5 pb-3 pt-6 shadow-[0_14px_28px_-16px_rgb(40_20_0/0.55)] transition-transform",
                    `bilhete-${b.color}`,
                    provisorio && "opacity-70",
                  )}
                  style={{ transform: `rotate(${inclinacao(b.id)}deg)` }}
                  aria-label={`Bilhete de ${autor.nome}`}
                >
                  <span
                    aria-hidden
                    className="absolute -top-2 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-2deg] rounded-sm bg-white/55 shadow-sm backdrop-blur-[1px] dark:bg-white/35"
                  />
                  <p className="whitespace-pre-line break-words text-[15px] font-medium leading-relaxed">{b.body}</p>
                  <footer className="mt-4 flex items-center gap-2 border-t border-[color-mix(in_oklab,var(--tinta)_15%,transparent)] pt-2.5">
                    <Avatar nome={autor.nome} caminho={autor.avatar} tamanho={26} />
                    <div className="min-w-0 flex-1 text-xs leading-tight">
                      <p className="truncate font-bold">{meu ? "Você" : autor.nome}</p>
                      <p className="opacity-75">
                        <TempoRelativo iso={b.created_at} />
                      </p>
                    </div>
                    {!provisorio && (meu || admin) ? (
                      <button
                        type="button"
                        onClick={() => setApagar(b)}
                        aria-label={meu ? "Excluir meu bilhete" : `Excluir o bilhete de ${autor.nome}`}
                        title="Excluir"
                        className="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-black/10"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    ) : null}
                    {!provisorio && !meu ? (
                      <button
                        type="button"
                        onClick={() => setDenunciar(b)}
                        aria-label={`Denunciar o bilhete de ${autor.nome}`}
                        title="Denunciar"
                        className="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-black/10"
                      >
                        <Flag className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Dialogo
        aberto={!!apagar}
        aoFechar={() => setApagar(null)}
        titulo="Excluir este bilhete?"
        descricao={apagar && apagar.user_id !== eu ? "Você organiza o grupo: o bilhete some para todos." : "Ele some do mural para todos."}
      >
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setApagar(null)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            carregando={enviando}
            onClick={() => {
              const b = apagar;
              if (!b) return;
              setApagar(null);
              iniciar(async () => {
                aplicar({ tipo: "remover", id: b.id });
                const r = await excluirBilhete(eventoId, b.id);
                avisar(r.ok ? (r.mensagem ?? "Bilhete removido.") : r.erro, r.ok ? "ok" : "erro");
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Excluir
          </Botao>
        </div>
      </Dialogo>

      <DialogoDenuncia
        aberto={!!denunciar}
        aoFechar={() => setDenunciar(null)}
        trecho={denunciar?.body}
        explicacao="O organizador do grupo recebe a denúncia com o texto do bilhete e decide o que fazer."
        aoConfirmar={(motivo) => denunciarConteudo("wall", denunciar!.id, motivo)}
      />
    </div>
  );
}
