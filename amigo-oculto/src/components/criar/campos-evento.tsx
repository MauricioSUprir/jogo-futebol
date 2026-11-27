"use client";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, Globe2, Hand, Lock, Plus } from "lucide-react";
import { AreaTexto, Campo, Interruptor } from "@/components/ui/campos";
import { OpcoesCartao } from "@/components/criar/opcoes-cartao";
import { SeletorTema } from "@/components/criar/seletor-tema";
import { SeletorCapa } from "@/components/criar/seletor-capa";
import { LIMITES, type RascunhoEvento } from "@/lib/validacao/evento";
import { paraInputLocal } from "@/lib/formatos";
import { cn } from "@/lib/cn";

export type ErrosEvento = Partial<Record<keyof RascunhoEvento | "_", string>>;

export interface PropsCampos {
  r: RascunhoEvento;
  mudar: (parcial: Partial<RascunhoEvento>) => void;
  erros: ErrosEvento;
  /** a pessoa saiu do campo (o assistente valida aquele campo) */
  aoSair?: (campo: keyof RascunhoEvento) => void;
  /** depois do sorteio: limite, prazo, data e modo do sorteio e aprovação ficam travados */
  travado?: boolean;
  desabilitado?: boolean;
}

/** id estável de cada campo (o assistente leva o foco ao primeiro com erro) */
export const idDoCampo = (campo: keyof RascunhoEvento) => `evento-${campo}`;

/** "agora" no formato do <input type="datetime-local"> (só no navegador, para não divergir da renderização no servidor) */
function useAgoraLocal() {
  const [agora, setAgora] = useState<string | undefined>(undefined);
  useEffect(() => setAgora(paraInputLocal(new Date().toISOString())), []);
  return agora;
}

function Contador({ atual, max }: { atual: number; max: number }) {
  return (
    <span className={cn("tabular-nums", atual > max ? "text-rubi" : "text-suave")} aria-hidden>
      {atual}/{max}
    </span>
  );
}

function Chip({ children, onClick, ativo, disabled }: { children: ReactNode; onClick: () => void; ativo?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ativo}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50",
        ativo ? "border-transparent bg-t1 text-white" : "border-borda bg-white/50 text-texto hover:border-t1 dark:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

export function CamposBasico({ r, mudar, erros, aoSair, desabilitado }: PropsCampos) {
  return (
    <div className="flex flex-col gap-5">
      <Campo
        id={idDoCampo("nome")}
        rotulo="Nome do amigo oculto"
        placeholder="Ex.: Amigo Oculto da Família 2026"
        value={r.nome}
        maxLength={LIMITES.nomeMax + 10}
        onChange={(e) => mudar({ nome: e.target.value })}
        onBlur={() => aoSair?.("nome")}
        erro={erros.nome}
        dica={
          <span className="flex justify-between gap-2">
            <span>Como o grupo vai aparecer no convite e na sala.</span>
            <Contador atual={r.nome.trim().length} max={LIMITES.nomeMax} />
          </span>
        }
        autoComplete="off"
        required
        disabled={desabilitado}
      />
      <AreaTexto
        id={idDoCampo("descricao")}
        rotulo="Descrição"
        opcional
        placeholder="Conte o clima da festa, quem participa, um recado para o grupo…"
        value={r.descricao}
        onChange={(e) => mudar({ descricao: e.target.value })}
        onBlur={() => aoSair?.("descricao")}
        erro={erros.descricao}
        dica={<Contador atual={r.descricao.length} max={LIMITES.descricao} />}
        rows={3}
        disabled={desabilitado}
      />
      <SeletorCapa caminho={r.capa} aoMudar={(capa) => mudar({ capa })} tema={r.tema} desabilitado={desabilitado} erro={erros.capa} />
      <SeletorTema valor={r.tema} aoMudar={(tema) => mudar({ tema })} desabilitado={desabilitado} />
    </div>
  );
}

export function CamposQuando({ r, mudar, erros, aoSair, desabilitado }: PropsCampos) {
  const agora = useAgoraLocal();
  return (
    <div className="flex flex-col gap-5">
      <Campo
        id={idDoCampo("revelacaoEm")}
        type="datetime-local"
        rotulo="Data e horário da revelação"
        opcional
        value={r.revelacaoEm}
        min={agora}
        onChange={(e) => mudar({ revelacaoEm: e.target.value })}
        onBlur={() => aoSair?.("revelacaoEm")}
        erro={erros.revelacaoEm}
        dica="O dia do encontro, quando cada um descobre quem tirou. Horário de Brasília. A sala mostra a contagem regressiva."
        disabled={desabilitado}
      />
      <Campo
        id={idDoCampo("local")}
        rotulo="Local do encontro"
        opcional
        placeholder="Ex.: Casa da vó Lúcia, salão do prédio, online pelo Meet…"
        value={r.local}
        maxLength={LIMITES.local + 10}
        onChange={(e) => mudar({ local: e.target.value })}
        onBlur={() => aoSair?.("local")}
        erro={erros.local}
        autoComplete="off"
        disabled={desabilitado}
      />
    </div>
  );
}

const FAIXAS = [
  { rotulo: "Até R$ 50", min: "", max: "50" },
  { rotulo: "R$ 50 a R$ 100", min: "50", max: "100" },
  { rotulo: "R$ 100 a R$ 150", min: "100", max: "150" },
  { rotulo: "R$ 150 a R$ 250", min: "150", max: "250" },
];

export function CamposPresentes({ r, mudar, erros, aoSair, desabilitado }: PropsCampos) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-semibold">Faixas comuns</p>
        <div className="flex flex-wrap gap-2">
          {FAIXAS.map((f) => (
            <Chip
              key={f.rotulo}
              ativo={r.valorMinimo === f.min && r.valorMaximo === f.max}
              onClick={() => mudar({ valorMinimo: f.min, valorMaximo: f.max })}
              disabled={desabilitado}
            >
              {f.rotulo}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          id={idDoCampo("valorMinimo")}
          rotulo="Valor mínimo (R$)"
          opcional
          inputMode="decimal"
          placeholder="Ex.: 50"
          value={r.valorMinimo}
          onChange={(e) => mudar({ valorMinimo: e.target.value })}
          onBlur={() => aoSair?.("valorMinimo")}
          erro={erros.valorMinimo}
          autoComplete="off"
          disabled={desabilitado}
        />
        <Campo
          id={idDoCampo("valorMaximo")}
          rotulo="Valor máximo (R$)"
          opcional
          inputMode="decimal"
          placeholder="Ex.: 100"
          value={r.valorMaximo}
          onChange={(e) => mudar({ valorMaximo: e.target.value })}
          onBlur={() => aoSair?.("valorMaximo")}
          erro={erros.valorMaximo}
          autoComplete="off"
          disabled={desabilitado}
        />
      </div>
      <p className="text-sm text-suave">
        Deixe os dois em branco para não ter faixa de valor. Use vírgula para os centavos (49,90).
      </p>
    </div>
  );
}

export function CamposParticipacao({ r, mudar, erros, aoSair, travado, desabilitado }: PropsCampos) {
  const agora = useAgoraLocal();
  const trava = travado || desabilitado;
  return (
    <div className="flex flex-col gap-6">
      {travado ? (
        <p className="flex items-start gap-2 rounded-2xl bg-ouro/12 px-4 py-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-ouro-escuro dark:text-ouro-claro" aria-hidden />
          <span>
            O sorteio já foi feito: o limite, o prazo de entrada, a data e o modo do sorteio e a aprovação de novos participantes
            ficam travados para não mudar as regras com o jogo em andamento.
          </span>
        </p>
      ) : null}
      <OpcoesCartao
        rotulo="Como será o sorteio?"
        valor={r.modoSorteio}
        aoMudar={(modoSorteio) => mudar({ modoSorteio })}
        desabilitado={trava}
        erro={erros.modoSorteio}
        opcoes={[
          {
            valor: "manual",
            titulo: "Eu sorteio quando quiser",
            descricao: "Você confere quem entrou e faz o sorteio pelo painel do organizador.",
            icone: <Hand className="size-5" />,
          },
          {
            valor: "scheduled",
            titulo: "Sorteio agendado",
            descricao: "Acontece sozinho na data marcada, e todos são avisados.",
            icone: <CalendarClock className="size-5" />,
          },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          id={idDoCampo("sorteioEm")}
          type="datetime-local"
          rotulo={r.modoSorteio === "scheduled" ? "Data e horário do sorteio" : "Data prevista do sorteio"}
          opcional={r.modoSorteio !== "scheduled"}
          value={r.sorteioEm}
          min={agora}
          onChange={(e) => mudar({ sorteioEm: e.target.value })}
          onBlur={() => aoSair?.("sorteioEm")}
          erro={erros.sorteioEm}
          dica={r.modoSorteio === "scheduled" ? "O sorteio roda sozinho nessa hora." : "Só para o grupo se programar; quem sorteia é você."}
          disabled={trava}
        />
        <Campo
          id={idDoCampo("prazoEntrada")}
          type="datetime-local"
          rotulo="Prazo para entrar no grupo"
          opcional
          value={r.prazoEntrada}
          min={agora}
          onChange={(e) => mudar({ prazoEntrada: e.target.value })}
          onBlur={() => aoSair?.("prazoEntrada")}
          erro={erros.prazoEntrada}
          dica="Depois dele o convite para de aceitar gente nova."
          disabled={trava}
        />
      </div>
      <Campo
        id={idDoCampo("limite")}
        rotulo="Limite de participantes"
        opcional
        inputMode="numeric"
        placeholder="Sem limite"
        value={r.limite}
        onChange={(e) => mudar({ limite: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })}
        onBlur={() => aoSair?.("limite")}
        erro={erros.limite}
        dica={`De ${LIMITES.participantesMin} a ${LIMITES.participantesMax} pessoas. Em branco, sem limite.`}
        disabled={trava}
        wrapperClassName="sm:max-w-xs"
      />
      <OpcoesCartao
        rotulo="Quem pode encontrar o grupo?"
        valor={r.visibilidade}
        aoMudar={(visibilidade) => mudar({ visibilidade })}
        desabilitado={desabilitado}
        erro={erros.visibilidade}
        opcoes={[
          { valor: "private", titulo: "Privado", descricao: "Só entra quem recebe o link, o QR Code ou o código.", icone: <Lock className="size-5" /> },
          {
            valor: "public",
            titulo: "Público",
            descricao: "Aparece em Explorar; qualquer pessoa pode pedir para entrar.",
            icone: <Globe2 className="size-5" />,
          },
        ]}
      />
      <div className="rounded-2xl border border-borda px-4 py-2">
        <Interruptor
          rotulo="Aprovar novos participantes"
          descricao={
            r.visibilidade === "public"
              ? "Recomendado para grupos públicos: cada pedido espera a sua aprovação."
              : "Quem usar o convite fica pendente até você aprovar (convidados por e-mail entram direto)."
          }
          marcado={r.aprovacao}
          aoMudar={(aprovacao) => mudar({ aprovacao })}
          desabilitado={trava}
        />
      </div>
    </div>
  );
}

const SUGESTOES_REGRAS = [
  "Presente embrulhado e com um cartão.",
  "Nada de vale-presente ou dinheiro.",
  "Respeite a faixa de valor combinada.",
  "Guarde a nota fiscal para trocas.",
  "Chegue no horário para a revelação.",
  "Capriche na descrição do seu amigo oculto!",
];

export function CamposRegras({ r, mudar, erros, aoSair, desabilitado }: PropsCampos) {
  const linhas = r.regras.split("\n").map((l) => l.replace(/^•\s*/, "").trim());
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-semibold">Toque para adicionar</p>
        <div className="flex flex-wrap gap-2">
          {SUGESTOES_REGRAS.map((s) => {
            const ja = linhas.includes(s);
            return (
              <Chip
                key={s}
                ativo={ja}
                disabled={desabilitado}
                onClick={() =>
                  mudar({
                    regras: ja
                      ? r.regras
                          .split("\n")
                          .filter((l) => l.replace(/^•\s*/, "").trim() !== s)
                          .join("\n")
                      : `${r.regras.trimEnd()}${r.regras.trim() ? "\n" : ""}• ${s}`,
                  })
                }
              >
                {ja ? null : <Plus className="size-3.5" aria-hidden />}
                {s}
              </Chip>
            );
          })}
        </div>
      </div>
      <AreaTexto
        id={idDoCampo("regras")}
        rotulo="Regras do grupo"
        opcional
        placeholder="Escreva do seu jeito as combinações do grupo."
        value={r.regras}
        onChange={(e) => mudar({ regras: e.target.value })}
        onBlur={() => aoSair?.("regras")}
        erro={erros.regras}
        dica={<Contador atual={r.regras.length} max={LIMITES.regras} />}
        rows={6}
        disabled={desabilitado}
      />
    </div>
  );
}
