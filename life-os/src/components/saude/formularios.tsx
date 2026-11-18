"use client";
import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { salvarEmergencia, salvarRegistroSaude } from "@/acoes/saude";
import { DEF_TIPOS, TIPOS_SANGUINEOS, type Contato, type TipoSaude } from "@/lib/saude";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao, classesBotao } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";

function useFechar(ok?: string) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (ok) fechar();
  }, [ok, fechar]);
}

export interface RegistroForm {
  id?: string;
  titulo: string;
  dia: string;
  hora: string | null;
  diaFim: string | null;
  profissional: string | null;
  detalhes: string | null;
  dose: string | null;
  proximo: string | null;
  intensidade: number | null;
  parteCorpo: string | null;
  status: string;
}

/** Formulário de qualquer tipo de registro de saúde: mostra só os campos daquele tipo. */
export function FormRegistroSaude({ tipo, hoje, registro }: { tipo: TipoSaude; hoje: string; registro?: RegistroForm }) {
  const [estado, acao] = useActionState(salvarRegistroSaude, undefined);
  useFechar(estado?.ok);
  const def = DEF_TIPOS[tipo];
  const c = def.campos;
  const r = registro;
  const id = (k: string) => `sr-${tipo}-${k}`;
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="tipo" value={tipo} />
      {r?.id && <input type="hidden" name="id" value={r.id} />}
      {c.titulo && (
        <Campo rotulo={c.titulo} htmlFor={id("titulo")}>
          <Entrada id={id("titulo")} name="titulo" required maxLength={120} defaultValue={r?.titulo ?? ""} autoFocus={!r} />
        </Campo>
      )}
      {c.dose && (
        <Campo rotulo={c.dose} htmlFor={id("dose")}>
          <Entrada id={id("dose")} name="dose" maxLength={120} defaultValue={r?.dose ?? ""} />
        </Campo>
      )}
      {c.parteCorpo && (
        <Campo rotulo={c.parteCorpo} htmlFor={id("parte")}>
          <Entrada id={id("parte")} name="parteCorpo" maxLength={60} defaultValue={r?.parteCorpo ?? ""} placeholder="Ex.: joelho direito" />
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        {c.dia && (
          <Campo rotulo={c.dia} htmlFor={id("dia")}>
            <Entrada id={id("dia")} name="dia" type="date" required defaultValue={r?.dia ?? hoje} max={def.futuro ? undefined : hoje} />
          </Campo>
        )}
        {c.hora && (
          <Campo rotulo={c.hora} htmlFor={id("hora")} dica="Opcional">
            <Entrada id={id("hora")} name="hora" type="time" defaultValue={r?.hora ?? ""} />
          </Campo>
        )}
        {c.diaFim && (
          <Campo rotulo={c.diaFim} htmlFor={id("fim")} dica="Opcional">
            <Entrada id={id("fim")} name="diaFim" type="date" defaultValue={r?.diaFim ?? ""} />
          </Campo>
        )}
        {c.proximo && (
          <Campo rotulo={c.proximo} htmlFor={id("prox")} dica="Opcional">
            <Entrada id={id("prox")} name="proximo" type="date" defaultValue={r?.proximo ?? ""} />
          </Campo>
        )}
        {c.intensidade && (
          <Campo rotulo={c.intensidade} htmlFor={id("int")}>
            <Entrada id={id("int")} name="intensidade" type="number" inputMode="numeric" min={0} max={10} defaultValue={r?.intensidade ?? ""} />
          </Campo>
        )}
        {def.status && (
          <Campo rotulo={c.status ?? "Situação"} htmlFor={id("status")}>
            <Selecao id={id("status")} name="status" defaultValue={r?.status ?? "ativo"}>
              <option value="ativo">{def.status[0]}</option>
              <option value="encerrado">{def.status[1]}</option>
            </Selecao>
          </Campo>
        )}
      </div>
      {c.profissional && (
        <Campo rotulo={c.profissional} htmlFor={id("prof")}>
          <Entrada id={id("prof")} name="profissional" maxLength={120} defaultValue={r?.profissional ?? ""} />
        </Campo>
      )}
      {c.detalhes && (
        <Campo rotulo={c.detalhes} htmlFor={id("det")}>
          <AreaTexto id={id("det")} name="detalhes" maxLength={4000} defaultValue={r?.detalhes ?? ""} className="min-h-20" />
        </Campo>
      )}
      {tipo === "consulta" && !r?.id && <p className="text-xs text-apagado">Consulta marcada (hoje ou depois) entra sozinha na agenda.</p>}
      {tipo === "medicamento" && <p className="text-xs text-apagado">Registre como foi prescrito; o LIFE OS não sugere nem muda doses.</p>}
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{r?.id ? "Salvar alterações" : "Salvar"}</BotaoEnvio>
    </form>
  );
}

export interface EmergenciaForm {
  sangue: string | null;
  alergias: string | null;
  condicoes: string | null;
  medicamentos: string | null;
  plano: string | null;
  observacoes: string | null;
  contatos: Contato[];
}

export function FormEmergencia({ dados }: { dados: EmergenciaForm }) {
  const [estado, acao] = useActionState(salvarEmergencia, undefined);
  useFechar(estado?.ok);
  const [contatos, setContatos] = useState<(Contato & { k: number })[]>(() =>
    (dados.contatos.length ? dados.contatos : [{ nome: "", relacao: "", telefone: "" }]).map((c, k) => ({ ...c, k })),
  );
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Tipo sanguíneo" htmlFor="em-sangue">
          <Selecao id="em-sangue" name="sangue" defaultValue={dados.sangue ?? ""}>
            <option value="">Não sei</option>
            {TIPOS_SANGUINEOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Plano de saúde" htmlFor="em-plano">
          <Entrada id="em-plano" name="plano" maxLength={200} defaultValue={dados.plano ?? ""} />
        </Campo>
      </div>
      <Campo rotulo="Alergias" htmlFor="em-alergias">
        <AreaTexto id="em-alergias" name="alergias" maxLength={1000} defaultValue={dados.alergias ?? ""} className="min-h-16" />
      </Campo>
      <Campo rotulo="Condições de saúde" htmlFor="em-cond">
        <AreaTexto id="em-cond" name="condicoes" maxLength={1000} defaultValue={dados.condicoes ?? ""} className="min-h-16" />
      </Campo>
      <Campo rotulo="Medicamentos em uso" htmlFor="em-med">
        <AreaTexto id="em-med" name="medicamentos" maxLength={1000} defaultValue={dados.medicamentos ?? ""} className="min-h-16" />
      </Campo>
      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-1.5 text-xs font-medium text-suave">Contatos de emergência (até 5)</legend>
        {contatos.map((c, i) => (
          <div key={c.k} className="grid grid-cols-1 gap-2 rounded-xl border border-borda p-2.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Entrada name="contatoNome" aria-label={`Nome do contato ${i + 1}`} placeholder="Nome" maxLength={80} defaultValue={c.nome} />
            <Entrada name="contatoRelacao" aria-label={`Relação do contato ${i + 1}`} placeholder="Relação (mãe, pai…)" maxLength={60} defaultValue={c.relacao} />
            <Entrada name="contatoTelefone" aria-label={`Telefone do contato ${i + 1}`} placeholder="Telefone" type="tel" inputMode="tel" maxLength={30} defaultValue={c.telefone} />
            <button
              type="button"
              onClick={() => setContatos((xs) => xs.filter((x) => x.k !== c.k))}
              className={classesBotao("fantasma", "icone", "justify-self-end")}
              aria-label={`Remover contato ${i + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {contatos.length < 5 && (
          <button
            type="button"
            onClick={() => setContatos((xs) => [...xs, { nome: "", relacao: "", telefone: "", k: Math.max(0, ...xs.map((x) => x.k)) + 1 }])}
            className={classesBotao("contorno", "p", "justify-self-start")}
          >
            <Plus className="h-4 w-4" /> Contato
          </button>
        )}
      </fieldset>
      <Campo rotulo="Observações" htmlFor="em-obs">
        <AreaTexto id="em-obs" name="observacoes" maxLength={2000} defaultValue={dados.observacoes ?? ""} className="min-h-16" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">Salvar</BotaoEnvio>
    </form>
  );
}
