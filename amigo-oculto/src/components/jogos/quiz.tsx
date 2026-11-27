"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Check, CircleCheck, CircleX, Plus, Trash2, Trophy, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Cartao, Selo, Vazio } from "@/components/ui/cartao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar, vibrar } from "@/components/efeitos/som";
import { criarPerguntaQuiz, excluirPerguntaQuiz, responderQuiz } from "@/lib/acoes/jogos";
import { cn } from "@/lib/cn";

export type PerguntaQuiz = {
  id: string;
  question: string;
  options: string[];
  created_at: string;
  subject_id: string;
  subject_name: string;
  subject_avatar: string | null;
  mine: boolean;
  my_choice: number | null;
  my_correct: boolean | null;
  correct_index: number | null;
  answers: number;
  right_answers: number;
};

export type LinhaPlacar = { id: string; nome: string; avatar: string | null; acertos: number; respostas: number; perguntas: number };

const LETRAS = ["A", "B", "C", "D"];

export function Quiz({
  eventoId,
  perguntas,
  placar,
  admin,
  euId,
}: {
  eventoId: string;
  perguntas: PerguntaQuiz[];
  placar: LinhaPlacar[];
  admin: boolean;
  euId: string;
}) {
  const [aba, setAba] = useState<"turma" | "minhas" | "placar">("turma");
  const [soFaltam, setSoFaltam] = useState(false);
  const confete = useRef<ConfeteHandle>(null);
  const { menosMovimento } = usePreferencias();
  const daTurma = perguntas.filter((p) => !p.mine);
  const minhas = perguntas.filter((p) => p.mine);
  const faltam = daTurma.filter((p) => p.my_choice === null).length;
  const visiveis = soFaltam ? daTurma.filter((p) => p.my_choice === null) : daTurma;

  const abas = [
    { id: "turma" as const, rotulo: "Perguntas da turma", extra: faltam ? String(faltam) : null },
    { id: "minhas" as const, rotulo: "Minhas perguntas", extra: `${minhas.length}/10` },
    { id: "placar" as const, rotulo: "Placar", extra: null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Confete ref={confete} desligado={menosMovimento} />
      <div role="tablist" aria-label="Seções do quiz" className="rolagem-fina -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            id={`aba-quiz-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`painel-quiz-${a.id}`}
            onClick={() => setAba(a.id)}
            className={cn(
              "vidro inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-suave transition hover:text-texto",
              aba === a.id && "bg-[color-mix(in_oklab,var(--t1)_16%,transparent)] text-t1",
            )}
          >
            {a.rotulo}
            {a.extra ? <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{a.extra}</span> : null}
          </button>
        ))}
      </div>

      {aba === "turma" ? (
        <div role="tabpanel" id="painel-quiz-turma" aria-labelledby="aba-quiz-turma" className="flex flex-col gap-3">
          {daTurma.length ? (
            <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-suave">
              <input type="checkbox" checked={soFaltam} onChange={(e) => setSoFaltam(e.target.checked)} className="size-4 accent-[var(--t1)]" />
              Mostrar só as que faltam ({faltam})
            </label>
          ) : null}
          {visiveis.length ? (
            visiveis.map((p) => (
              <CartaoPergunta
                key={p.id}
                eventoId={eventoId}
                pergunta={p}
                podeExcluir={admin}
                aoAcertar={() => confete.current?.disparar({ quantidade: 90, origemY: 0.35 })}
              />
            ))
          ) : (
            <Vazio
              titulo={daTurma.length ? "Você respondeu tudo!" : "Ainda não há perguntas da turma"}
              texto={daTurma.length ? "Volte mais tarde: novas perguntas aparecem aqui." : "Que tal começar? Crie perguntas sobre você na aba “Minhas perguntas”."}
            />
          )}
        </div>
      ) : null}

      {aba === "minhas" ? (
        <div role="tabpanel" id="painel-quiz-minhas" aria-labelledby="aba-quiz-minhas" className="flex flex-col gap-4">
          {minhas.length < 10 ? <NovaPergunta eventoId={eventoId} /> : <Selo cor="ouro">Você chegou ao limite de 10 perguntas.</Selo>}
          {minhas.map((p) => (
            <CartaoPergunta key={p.id} eventoId={eventoId} pergunta={p} podeExcluir />
          ))}
        </div>
      ) : null}

      {aba === "placar" ? (
        <div role="tabpanel" id="painel-quiz-placar" aria-labelledby="aba-quiz-placar">
          <Placar linhas={placar} euId={euId} />
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {faltam ? `${faltam} perguntas para responder.` : ""}
      </span>
    </div>
  );
}

function CartaoPergunta({
  eventoId,
  pergunta: p,
  podeExcluir,
  aoAcertar,
}: {
  eventoId: string;
  pergunta: PerguntaQuiz;
  podeExcluir?: boolean;
  aoAcertar?: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [escolhaLocal, setEscolhaLocal] = useState<number | null>(null);
  const [resultado, setResultado] = useState<{ certa: boolean; indiceCerto: number } | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const { avisar } = useAvisos();
  const { som, vibracao, menosMovimento } = usePreferencias();

  const escolha = p.my_choice ?? escolhaLocal;
  const certo = p.correct_index ?? resultado?.indiceCerto ?? null;
  const respondida = !p.mine && (p.my_choice !== null || resultado !== null);
  const acertou = p.my_correct ?? resultado?.certa ?? null;

  function responder(i: number) {
    if (respondida || pendente || p.mine) return;
    setEscolhaLocal(i);
    iniciar(async () => {
      const r = await responderQuiz(eventoId, p.id, i);
      if (r.ok && r.dados) {
        setResultado(r.dados);
        if (r.dados.certa) {
          tocar("festa", som);
          vibrar([30, 40, 30], vibracao);
          aoAcertar?.();
        } else {
          tocar("erro", som);
          vibrar(60, vibracao);
        }
      } else if (!r.ok) {
        setEscolhaLocal(null);
        avisar(r.erro, "erro");
      }
    });
  }

  function excluir() {
    iniciar(async () => {
      const r = await excluirPerguntaQuiz(eventoId, p.id);
      setConfirmarExcluir(false);
      avisar(r.ok ? (r.mensagem ?? "Excluída.") : r.erro, r.ok ? "ok" : "erro");
    });
  }

  return (
    <motion.div layout={!menosMovimento} className="vidro rounded-cartao p-5">
      <div className="mb-3 flex items-center gap-3">
        <Avatar nome={p.subject_name} caminho={p.subject_avatar} tamanho={36} />
        <p className="min-w-0 flex-1 text-sm text-suave">
          {p.mine ? "Sua pergunta" : (
            <>
              Pergunta de <strong className="text-texto">{p.subject_name}</strong>
            </>
          )}
        </p>
        {respondida && acertou !== null ? (
          acertou ? <Selo cor="esmeralda"><CircleCheck className="size-3.5" aria-hidden /> Acertou</Selo> : <Selo cor="rubi"><CircleX className="size-3.5" aria-hidden /> Errou</Selo>
        ) : null}
        {podeExcluir ? (
          <button
            type="button"
            onClick={() => setConfirmarExcluir(true)}
            className="inline-flex size-10 items-center justify-center rounded-full text-suave hover:bg-black/5 hover:text-rubi dark:hover:bg-white/10"
            aria-label="Excluir pergunta"
            title="Excluir pergunta"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <p className="font-titulo text-lg font-semibold leading-snug sm:text-xl">{p.question}</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Opções">
        {p.options.map((o, i) => {
          const eCerta = certo === i && (respondida || p.mine);
          const minhaErrada = respondida && escolha === i && certo !== i;
          return (
            <button
              key={i}
              type="button"
              disabled={p.mine || respondida || pendente}
              onClick={() => responder(i)}
              aria-label={`${LETRAS[i]}: ${o}${eCerta ? " (resposta certa)" : ""}${escolha === i && !p.mine ? " (sua escolha)" : ""}`}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl border border-borda px-3 py-2 text-left text-[15px] font-medium transition",
                !p.mine && !respondida && "hover:-translate-y-0.5 hover:border-[var(--t1)] hover:bg-[color-mix(in_oklab,var(--t1)_8%,transparent)]",
                eCerta && "border-esmeralda bg-esmeralda/12 text-texto",
                minhaErrada && "border-rubi bg-rubi/10",
                pendente && escolha === i && "animate-pulse",
                "disabled:cursor-default",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs font-bold dark:bg-white/10",
                  eCerta && "bg-esmeralda text-white",
                  minhaErrada && "bg-rubi text-white",
                )}
              >
                {eCerta ? <Check className="size-4" aria-hidden /> : minhaErrada ? <X className="size-4" aria-hidden /> : LETRAS[i]}
              </span>
              <span className="min-w-0 flex-1">{o}</span>
            </button>
          );
        })}
      </div>
      {respondida || p.mine ? (
        <p className="mt-3 text-sm text-suave">
          {p.answers + (resultado && p.my_choice === null ? 1 : 0)} resposta(s) ·{" "}
          {p.right_answers + (resultado?.certa && p.my_choice === null ? 1 : 0)} acerto(s)
        </p>
      ) : null}
      <Dialogo aberto={confirmarExcluir} aoFechar={() => setConfirmarExcluir(false)} titulo="Excluir esta pergunta?" descricao="As respostas dela também somem do placar.">
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={() => setConfirmarExcluir(false)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" carregando={pendente} onClick={excluir}>
            Excluir
          </Botao>
        </div>
      </Dialogo>
    </motion.div>
  );
}

function NovaPergunta({ eventoId }: { eventoId: string }) {
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [certa, setCerta] = useState<number | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();
  const { avisar } = useAvisos();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (certa === null) {
      setErros({ certa: "Marque qual opção é a certa." });
      return;
    }
    iniciar(async () => {
      const r = await criarPerguntaQuiz(eventoId, { pergunta, opcoes, certa });
      if (r.ok) {
        avisar(r.mensagem ?? "Pergunta publicada!");
        setPergunta("");
        setOpcoes(["", ""]);
        setCerta(null);
        setErros({});
      } else {
        setErros(r.campos ?? {});
        avisar(r.erro, "erro");
      }
    });
  }

  return (
    <Cartao forte>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <h3 className="font-titulo text-lg font-semibold">Nova pergunta sobre você</h3>
        <AreaTexto
          rotulo="Pergunta"
          placeholder="Ex.: Qual é a minha sobremesa favorita?"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          maxLength={200}
          erro={erros.pergunta}
          className="min-h-20"
          required
        />
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Opções (marque a certa)</legend>
          {opcoes.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-borda has-[:checked]:border-esmeralda has-[:checked]:bg-esmeralda has-[:checked]:text-white">
                <input
                  type="radio"
                  name="certa"
                  className="sr-only"
                  checked={certa === i}
                  onChange={() => setCerta(i)}
                  aria-label={`Opção ${LETRAS[i]} é a certa`}
                />
                {certa === i ? <Check className="size-4" aria-hidden /> : <span className="text-xs font-bold">{LETRAS[i]}</span>}
              </label>
              <Campo
                wrapperClassName="flex-1"
                aria-label={`Opção ${LETRAS[i]}`}
                placeholder={`Opção ${LETRAS[i]}`}
                value={o}
                maxLength={80}
                onChange={(e) => setOpcoes((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                erro={erros[`opcoes.${i}`]}
              />
              {opcoes.length > 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpcoes((l) => l.filter((_, j) => j !== i));
                    setCerta((c) => (c === null ? null : c === i ? null : c > i ? c - 1 : c));
                  }}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-suave hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={`Remover opção ${LETRAS[i]}`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
          {erros.certa ? <p className="text-sm font-medium text-rubi" role="alert">{erros.certa}</p> : null}
          {erros.opcoes ? <p className="text-sm font-medium text-rubi" role="alert">{erros.opcoes}</p> : null}
          {opcoes.length < 4 ? (
            <Botao variante="fantasma" tamanho="p" className="w-fit" onClick={() => setOpcoes((l) => [...l, ""])}>
              <Plus className="size-4" aria-hidden /> Mais uma opção
            </Botao>
          ) : null}
        </fieldset>
        <Botao type="submit" carregando={pendente} className="self-start">
          Publicar pergunta
        </Botao>
      </form>
    </Cartao>
  );
}

function Placar({ linhas, euId }: { linhas: LinhaPlacar[]; euId: string }) {
  const ordenadas = useMemo(
    () => [...linhas].filter((l) => l.respostas > 0).sort((a, b) => b.acertos - a.acertos || b.respostas - a.respostas || a.nome.localeCompare(b.nome)),
    [linhas],
  );
  if (!ordenadas.length) return <Vazio icone={<Trophy className="size-10" />} titulo="Placar vazio" texto="Assim que alguém responder, o placar aparece aqui." />;
  return (
    <ol className="flex flex-col gap-2">
      {ordenadas.map((l, i) => (
        <li
          key={l.id}
          className={cn("vidro flex items-center gap-3 rounded-2xl px-4 py-3", l.id === euId && "ring-2 ring-[color-mix(in_oklab,var(--t1)_45%,transparent)]")}
        >
          <span className={cn("w-7 text-center font-titulo text-lg font-semibold", i === 0 ? "text-ouro" : "text-suave")}>{i + 1}º</span>
          <Avatar nome={l.nome} caminho={l.avatar} tamanho={36} />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {l.nome}
            {l.id === euId ? <span className="font-normal text-suave"> (você)</span> : null}
          </span>
          <span className="text-right text-sm">
            <strong className="text-esmeralda">{l.acertos}</strong>
            <span className="text-suave"> de {l.respostas}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
