"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Gift, ListChecks, Plus, Vote, X } from "lucide-react";
import { criarEnquete } from "@/lib/acoes/enquetes";
import { Botao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Interruptor } from "@/components/ui/campos";
import { useAvisos } from "@/components/ui/avisos";
import { cn } from "@/lib/cn";

const SUGESTOES_PRESENTE = ["Qual o melhor presente até R$ 100?", "Vale presente de experiência?", "Embrulho criativo ou sacola?"];

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending}>
      <Vote className="size-4" aria-hidden /> Criar enquete
    </Botao>
  );
}

/** Botão + diálogo para criar enquete (2 a 8 opções, múltipla escolha, encerramento, categoria). */
export function NovaEnquete({
  eventoId,
  categoriaInicial,
  bloqueio,
  abrirAoCarregar = false,
}: {
  eventoId: string;
  categoriaInicial: "geral" | "presente";
  bloqueio: string | null;
  abrirAoCarregar?: boolean;
}) {
  const [aberto, setAberto] = useState(abrirAoCarregar && !bloqueio);
  const [estado, acao] = useActionState(criarEnquete, null);
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [multipla, setMultipla] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [encerraEm, setEncerraEm] = useState("");
  const { avisar } = useAvisos();
  const ultimo = useRef<HTMLInputElement>(null);
  const novaOpcao = useRef(false);

  useEffect(() => setCategoria(categoriaInicial), [categoriaInicial]);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      avisar(estado.mensagem ?? "Enquete criada!");
      setAberto(false);
      setOpcoes(["", ""]);
      setPergunta("");
      setMultipla(false);
      setEncerraEm("");
    }
  }, [estado, avisar]);

  useEffect(() => {
    if (novaOpcao.current) {
      ultimo.current?.focus();
      novaOpcao.current = false;
    }
  }, [opcoes.length]);

  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};

  return (
    <>
      <Botao onClick={() => setAberto(true)} disabled={!!bloqueio} title={bloqueio ?? undefined}>
        <Plus className="size-4" aria-hidden /> Nova enquete
      </Botao>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Nova enquete"
        descricao="Todos do grupo podem votar e ver quem votou em quê."
      >
        <form action={acao} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="eventoId" value={eventoId} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Sobre o quê?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { valor: "geral", rotulo: "Geral", icone: ListChecks },
                  { valor: "presente", rotulo: "Presentes", icone: Gift },
                ] as const
              ).map((c) => (
                <label
                  key={c.valor}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition focus-within:ring-4 focus-within:ring-ouro/30",
                    categoria === c.valor ? "border-t1 bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1" : "border-borda",
                  )}
                >
                  <input
                    type="radio"
                    name="categoria"
                    value={c.valor}
                    checked={categoria === c.valor}
                    onChange={() => setCategoria(c.valor)}
                    className="sr-only"
                  />
                  <c.icone className="size-4" aria-hidden /> {c.rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Campo
              name="pergunta"
              rotulo="Pergunta"
              required
              maxLength={200}
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder={categoria === "presente" ? "Ex.: Qual o melhor presente até R$ 100?" : "Ex.: Qual o melhor dia para a confraternização?"}
              erro={campos.pergunta}
            />
            {categoria === "presente" && !pergunta ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGESTOES_PRESENTE.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPergunta(s)}
                    className="min-h-9 rounded-full border border-borda px-3 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Opções (2 a 8)</legend>
            <ol className="flex flex-col gap-2">
              {opcoes.map((o, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden className="w-5 shrink-0 text-right text-sm font-bold text-suave">
                    {i + 1}.
                  </span>
                  <input
                    ref={i === opcoes.length - 1 ? ultimo : undefined}
                    name="opcao"
                    value={o}
                    maxLength={100}
                    aria-label={`Opção ${i + 1}`}
                    onChange={(e) => setOpcoes((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (i === opcoes.length - 1 && opcoes.length < 8 && o.trim()) {
                          novaOpcao.current = true;
                          setOpcoes((l) => [...l, ""]);
                        }
                      }
                    }}
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-borda bg-white/70 px-4 text-[15px] focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 dark:bg-white/5"
                    placeholder={i < 2 ? `Opção ${i + 1}` : "Outra opção"}
                  />
                  {opcoes.length > 2 ? (
                    <button
                      type="button"
                      aria-label={`Remover a opção ${i + 1}`}
                      onClick={() => setOpcoes((l) => l.filter((_, j) => j !== i))}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-suave hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
            {campos.opcoes ? (
              <p role="alert" className="mt-1.5 text-sm font-medium text-rubi">
                {campos.opcoes}
              </p>
            ) : null}
            {opcoes.length < 8 ? (
              <Botao
                variante="fantasma"
                tamanho="p"
                className="mt-2"
                onClick={() => {
                  novaOpcao.current = true;
                  setOpcoes((l) => [...l, ""]);
                }}
              >
                <Plus className="size-4" aria-hidden /> Adicionar opção
              </Botao>
            ) : null}
          </fieldset>
          <Interruptor
            name="multipla"
            rotulo="Permitir mais de uma resposta"
            descricao="Cada pessoa pode marcar várias opções."
            marcado={multipla}
            aoMudar={setMultipla}
          />
          <Campo
            name="encerraEm"
            type="datetime-local"
            rotulo="Encerra em"
            opcional
            value={encerraEm}
            onChange={(e) => setEncerraEm(e.target.value)}
            dica="Sem data, fica aberta até alguém encerrar (horário de Brasília)."
            erro={campos.encerraEm}
          />
          {estado && !estado.ok && !Object.keys(campos).length ? (
            <p role="alert" className="text-sm font-medium text-rubi">
              {estado.erro}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Enviar />
          </div>
        </form>
      </Dialogo>
    </>
  );
}
