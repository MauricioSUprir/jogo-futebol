"use client";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, Crown, Gift, Lock, Timer, Trash2, Vote } from "lucide-react";
import { encerrarEnquete, excluirEnquete, votarEnquete } from "@/lib/acoes/enquetes";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/cartao";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { TempoRelativo } from "@/components/sala/tempo";
import type { EnqueteVista, Votante } from "@/components/enquetes/tipos";
import { dataHora } from "@/lib/formatos";
import { cn } from "@/lib/cn";

function iguais(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function nomes(v: Votante[]) {
  if (!v.length) return "Ninguém votou nesta opção.";
  return `Votaram: ${v.map((x) => x.nome).join(", ")}.`;
}

export function CartaoEnquete({ eventoId, enquete: e, eu }: { eventoId: string; enquete: EnqueteVista; eu: { id: string; nome: string; avatar: string | null } }) {
  const [votos, setVotosOtimistas] = useOptimistic(e.meusVotos);
  const [selecao, setSelecao] = useState<string[]>(e.meusVotos);
  const [pendente, iniciar] = useTransition();
  const [excluir, setExcluir] = useState(false);
  const [encerrar, setEncerrar] = useState(false);
  const { avisar } = useAvisos();
  const { som } = usePreferencias();

  // quando os MEUS votos mudam no servidor (outra aba), a seleção acompanha; votos dos outros não mexem nela
  const chaveMeus = [...e.meusVotos].sort().join();
  useEffect(() => setSelecao(chaveMeus ? chaveMeus.split(",") : []), [chaveMeus]);

  // contagem com o meu voto otimista aplicado
  const opcoes = e.opcoes.map((o) => {
    const semMim = o.votantes.filter((v) => v.usuarioId !== eu.id);
    const comigo = votos.includes(o.id) ? [...semMim, { usuarioId: eu.id, nome: eu.nome, avatar: eu.avatar }] : semMim;
    return { ...o, votantes: comigo };
  });
  const votantes = new Set(opcoes.flatMap((o) => o.votantes.map((v) => v.usuarioId))).size;
  const maior = Math.max(0, ...opcoes.map((o) => o.votantes.length));
  const mudou = !iguais(selecao, votos);

  function votar(ids: string[]) {
    iniciar(async () => {
      setVotosOtimistas(ids);
      const r = await votarEnquete(eventoId, e.id, ids);
      if (r.ok) {
        tocar("tique", som);
        avisar(r.mensagem ?? "Voto registrado!");
      } else {
        setSelecao(e.meusVotos);
        avisar(r.erro, "erro");
      }
    });
  }

  const grupoId = `enquete-${e.id}`;
  return (
    <article className="vidro rounded-cartao p-5 sm:p-6" aria-labelledby={`${grupoId}-titulo`}>
      <header className="mb-4 flex items-start gap-3">
        {e.autor ? <Avatar nome={e.autor.nome} caminho={e.autor.avatar} tamanho={36} /> : null}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {e.categoria === "presente" ? (
              <Selo cor="t1">
                <Gift className="size-3" aria-hidden /> Presentes
              </Selo>
            ) : (
              <Selo>Geral</Selo>
            )}
            {e.aberta ? (
              <Selo cor="esmeralda">Aberta</Selo>
            ) : (
              <Selo>
                <Lock className="size-3" aria-hidden /> Encerrada
              </Selo>
            )}
            {e.multipla ? <Selo cor="ouro">Várias respostas</Selo> : null}
          </div>
          <h3 id={`${grupoId}-titulo`} className="font-titulo text-lg font-semibold leading-snug sm:text-xl">
            {e.pergunta}
          </h3>
          <p className="mt-0.5 text-xs text-suave">
            {e.autor ? `${e.autor.nome} · ` : ""}
            <TempoRelativo iso={e.criadaEm} />
            {e.aberta && e.encerraEm ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <Timer className="size-3" aria-hidden /> encerra {dataHora(e.encerraEm)}
                </span>
              </>
            ) : null}
            {!e.aberta && (e.encerradaEm ?? e.encerraEm) ? ` · encerrou ${dataHora(e.encerradaEm ?? e.encerraEm)}` : ""}
          </p>
        </div>
      </header>

      <fieldset disabled={!e.aberta || pendente}>
        <legend className="sr-only">
          {e.pergunta} {e.multipla ? "(pode marcar várias)" : "(uma resposta)"}
        </legend>
        <ul className="flex flex-col gap-2.5">
          {opcoes.map((o) => {
            const n = o.votantes.length;
            const pct = votantes ? Math.round((n / votantes) * 100) : 0;
            const marcada = selecao.includes(o.id);
            const vencedora = !e.aberta && n > 0 && n === maior;
            const minha = votos.includes(o.id);
            return (
              <li key={o.id}>
                <label
                  className={cn(
                    "relative block overflow-hidden rounded-2xl border px-4 py-3 transition",
                    e.aberta ? "cursor-pointer hover:border-[color-mix(in_oklab,var(--t1)_45%,transparent)]" : "cursor-default",
                    marcada ? "border-t1" : "border-borda",
                    "focus-within:ring-4 focus-within:ring-ouro/30",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 transition-[width] duration-700",
                      vencedora
                        ? "bg-[color-mix(in_oklab,var(--ouro)_22%,transparent)]"
                        : "bg-[color-mix(in_oklab,var(--t1)_12%,transparent)]",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex items-center gap-3">
                    {e.aberta ? (
                      <input
                        type={e.multipla ? "checkbox" : "radio"}
                        name={grupoId}
                        value={o.id}
                        checked={marcada}
                        onChange={(ev) => {
                          if (e.multipla) {
                            setSelecao((s) => (ev.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)));
                          } else {
                            setSelecao([o.id]);
                            if (!votos.includes(o.id)) votar([o.id]);
                          }
                        }}
                        className="size-5 shrink-0 accent-[var(--t1)]"
                      />
                    ) : vencedora ? (
                      <Crown className="size-5 shrink-0 text-ouro" aria-label="Mais votada" />
                    ) : null}
                    <span className="min-w-0 flex-1 font-semibold">
                      {o.rotulo}
                      {minha ? (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-xs font-semibold text-t1">
                          <Check className="size-3" aria-hidden /> seu voto
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="flex -space-x-2" aria-hidden title={o.votantes.map((v) => v.nome).join(", ") || undefined}>
                        {o.votantes.slice(0, 4).map((v) => (
                          <Avatar key={v.usuarioId} nome={v.nome} caminho={v.avatar} tamanho={24} className="ring-2 ring-[var(--fundo)]" />
                        ))}
                        {o.votantes.length > 4 ? (
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold ring-2 ring-[var(--fundo)] dark:bg-white/15">
                            +{o.votantes.length - 4}
                          </span>
                        ) : null}
                      </span>
                      <span className="w-14 text-right text-sm tabular-nums">
                        <strong>{pct}%</strong> <span className="text-suave">({n})</span>
                      </span>
                    </span>
                  </span>
                  <span className="sr-only">{nomes(o.votantes)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-suave">
          {votantes} pessoa{votantes === 1 ? "" : "s"} votou{votantes === 1 ? "" : "aram"}
        </p>
        {e.aberta && e.multipla && mudou ? (
          <Botao tamanho="p" carregando={pendente} onClick={() => votar(selecao)}>
            <Vote className="size-4" aria-hidden /> {votos.length ? "Atualizar voto" : "Votar"}
          </Botao>
        ) : null}
        {e.aberta && votos.length && !mudou ? (
          <Botao
            tamanho="p"
            variante="fantasma"
            disabled={pendente}
            onClick={() => {
              setSelecao([]);
              votar([]);
            }}
          >
            Retirar voto
          </Botao>
        ) : null}
        {e.podeGerenciar && e.aberta ? (
          <Botao tamanho="p" variante="contorno" disabled={pendente} onClick={() => setEncerrar(true)}>
            <Lock className="size-4" aria-hidden /> Encerrar
          </Botao>
        ) : null}
        {e.podeGerenciar ? (
          <button
            type="button"
            onClick={() => setExcluir(true)}
            aria-label={`Excluir a enquete “${e.pergunta}”`}
            title="Excluir enquete"
            className="inline-flex size-11 items-center justify-center rounded-full text-suave transition hover:bg-rubi/10 hover:text-rubi"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        ) : null}
      </footer>

      <Dialogo aberto={encerrar} aoFechar={() => setEncerrar(false)} titulo="Encerrar a enquete?" descricao="Ninguém mais vota; o resultado fica visível para o grupo.">
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setEncerrar(false)}>
            Cancelar
          </Botao>
          <Botao
            onClick={() => {
              setEncerrar(false);
              iniciar(async () => {
                const r = await encerrarEnquete(eventoId, e.id);
                avisar(r.ok ? (r.mensagem ?? "Enquete encerrada.") : r.erro, r.ok ? "ok" : "erro");
              });
            }}
          >
            <Lock className="size-4" aria-hidden /> Encerrar
          </Botao>
        </div>
      </Dialogo>
      <Dialogo aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Excluir a enquete?" descricao="A enquete e todos os votos somem para todos. Não dá para desfazer.">
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setExcluir(false)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            onClick={() => {
              setExcluir(false);
              iniciar(async () => {
                const r = await excluirEnquete(eventoId, e.id);
                avisar(r.ok ? (r.mensagem ?? "Enquete excluída.") : r.erro, r.ok ? "ok" : "erro");
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Excluir
          </Botao>
        </div>
      </Dialogo>
    </article>
  );
}
