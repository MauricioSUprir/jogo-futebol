"use client";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, ArrowRight, Ban, CheckCircle2, Lock, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Campo, Interruptor, Selecao } from "@/components/ui/campos";
import { Vazio } from "@/components/ui/cartao";
import { Confirmar } from "@/components/admin/confirmar";
import { useAcao } from "@/components/admin/usar-acao";
import { adicionarRestricao, excluirRestricao } from "@/lib/acoes/admin";
import { MIN_PARTICIPANTES, sorteioViavel, type Restricao } from "@/lib/sorteio/algoritmo";

export type PessoaRestricao = { id: string; nome: string; avatar: string | null };
export type ItemRestricao = { id: string; dador: string; recebedor: string; mutuo: boolean; observacao: string | null };

function viavel(ids: string[], lista: Restricao[]) {
  if (ids.length < MIN_PARTICIPANTES) return null; // sem gente suficiente ainda: não dá para avaliar
  const conjunto = new Set(ids);
  try {
    return sorteioViavel(
      ids,
      lista.filter((r) => conjunto.has(r.giver) && conjunto.has(r.receiver)),
    );
  } catch {
    return false;
  }
}

export function RestricoesCliente({
  eventoId,
  pessoas,
  restricoes,
  aberto,
}: {
  eventoId: string;
  pessoas: PessoaRestricao[];
  restricoes: ItemRestricao[];
  aberto: boolean;
}) {
  const { pendente, executar } = useAcao();
  const [dador, setDador] = useState("");
  const [recebedor, setRecebedor] = useState("");
  const [mutuo, setMutuo] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [excluindo, setExcluindo] = useState<ItemRestricao | null>(null);

  const porId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);
  const ids = useMemo(() => pessoas.map((p) => p.id), [pessoas]);
  const atuais: Restricao[] = useMemo(() => restricoes.map((r) => ({ giver: r.dador, receiver: r.recebedor, mutual: r.mutuo })), [restricoes]);
  const situacao = useMemo(() => viavel(ids, atuais), [ids, atuais]);
  const comNova = useMemo(() => {
    if (!dador || !recebedor || dador === recebedor) return null;
    return viavel(ids, [...atuais, { giver: dador, receiver: recebedor, mutual: mutuo }]);
  }, [ids, atuais, dador, recebedor, mutuo]);

  function adicionar(e: FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!dador) novos.dador = "Escolha quem não pode tirar.";
    if (!recebedor) novos.recebedor = "Escolha quem não pode ser tirado.";
    if (dador && dador === recebedor) novos.recebedor = "Escolha duas pessoas diferentes.";
    setErros(novos);
    if (Object.keys(novos).length) return;
    executar(() => adicionarRestricao(eventoId, { dador, recebedor, mutuo, observacao }), {
      depois: () => {
        setDador("");
        setRecebedor("");
        setObservacao("");
        setMutuo(true);
      },
      erro: (r) => {
        if (!r.ok && r.campos) setErros(r.campos);
      },
    });
  }

  const nome = (id: string) => porId.get(id)?.nome ?? "Participante";

  return (
    <div className="flex flex-col gap-6">
      {situacao === false ? (
        <p className="flex items-start gap-2 rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-medium text-rubi" role="status">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Com estas restrições não existe nenhuma combinação possível: o sorteio vai falhar. Remova alguma restrição.
        </p>
      ) : situacao === true && restricoes.length > 0 ? (
        <p className="flex items-start gap-2 rounded-2xl bg-esmeralda/10 px-4 py-3 text-sm font-medium text-esmeralda" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          Tudo certo: com estas restrições o sorteio é possível.
        </p>
      ) : null}

      {aberto ? (
        pessoas.length < 2 ? (
          <Vazio titulo="Ainda há pouca gente" texto="As restrições ficam disponíveis quando pelo menos duas pessoas estiverem aprovadas no grupo." />
        ) : (
          <form onSubmit={adicionar} className="flex flex-col gap-4 rounded-2xl border border-borda p-4" noValidate>
            <p className="font-semibold">Nova restrição</p>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <Selecao rotulo="Quem não pode tirar" value={dador} onChange={(e) => setDador(e.target.value)} erro={erros.dador}>
                <option value="">Escolha uma pessoa</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
              <span className="hidden h-12 items-center justify-center text-suave sm:mt-[1.6rem] sm:flex" aria-hidden>
                {mutuo ? <ArrowLeftRight className="size-5" /> : <ArrowRight className="size-5" />}
              </span>
              <Selecao rotulo={mutuo ? "Com quem" : "Quem não pode ser tirado"} value={recebedor} onChange={(e) => setRecebedor(e.target.value)} erro={erros.recebedor}>
                <option value="">Escolha uma pessoa</option>
                {pessoas
                  .filter((p) => p.id !== dador)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
              </Selecao>
            </div>
            <Interruptor
              rotulo="Valer nos dois sentidos"
              descricao={mutuo ? "Nenhum dos dois tira o outro (bom para casais e irmãos)." : "Só a primeira pessoa fica proibida de tirar a segunda."}
              marcado={mutuo}
              aoMudar={setMutuo}
            />
            <Campo
              rotulo="Observação"
              opcional
              placeholder="Ex.: são um casal"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value.slice(0, 120))}
              erro={erros.observacao}
              dica="Só os organizadores veem."
            />
            {comNova === false ? (
              <p className="flex items-start gap-2 rounded-2xl bg-ouro/12 px-4 py-3 text-sm" role="status">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ouro-escuro dark:text-ouro-claro" aria-hidden />
                Atenção: com esta restrição o sorteio fica impossível.
              </p>
            ) : null}
            <Botao type="submit" carregando={pendente} className="self-start">
              <Plus className="size-4" aria-hidden /> Adicionar restrição
            </Botao>
          </form>
        )
      ) : (
        <p className="flex items-start gap-2 rounded-2xl bg-ouro/12 px-4 py-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />O sorteio já foi feito: as restrições ficam guardadas só para consulta.
        </p>
      )}

      <section aria-labelledby="titulo-restricoes" className="flex flex-col gap-3">
        <h3 id="titulo-restricoes" className="font-titulo text-lg font-semibold">
          Restrições ({restricoes.length})
        </h3>
        {restricoes.length === 0 ? (
          <Vazio icone={<Ban className="size-9" />} titulo="Nenhuma restrição" texto="Sem restrições, qualquer pessoa pode tirar qualquer outra (menos a si mesma)." />
        ) : (
          <ul className="flex flex-col gap-2">
            {restricoes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-borda px-3 py-3 sm:px-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                    <Avatar nome={nome(r.dador)} caminho={porId.get(r.dador)?.avatar} tamanho={28} />
                    <span className="[overflow-wrap:anywhere]">{nome(r.dador)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-suave">
                    {r.mutuo ? <ArrowLeftRight className="size-4" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
                    {r.mutuo ? "não se tiram" : "não tira"}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                    <Avatar nome={nome(r.recebedor)} caminho={porId.get(r.recebedor)?.avatar} tamanho={28} />
                    <span className="[overflow-wrap:anywhere]">{nome(r.recebedor)}</span>
                  </span>
                  {r.observacao ? <span className="w-full text-sm text-suave [overflow-wrap:anywhere]">{r.observacao}</span> : null}
                </div>
                {aberto ? (
                  <Botao variante="fantasma" tamanho="p" onClick={() => setExcluindo(r)} aria-label={`Excluir a restrição entre ${nome(r.dador)} e ${nome(r.recebedor)}`}>
                    <Trash2 className="size-4" aria-hidden />
                  </Botao>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirmar
        aberto={!!excluindo}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir esta restrição?"
        descricao={excluindo ? `${nome(excluindo.dador)} e ${nome(excluindo.recebedor)} poderão se tirar no sorteio.` : undefined}
        rotuloConfirmar="Excluir"
        carregando={pendente}
        aoConfirmar={() => excluindo && executar(() => excluirRestricao(eventoId, excluindo.id), { depois: () => setExcluindo(null) })}
      />
    </div>
  );
}
