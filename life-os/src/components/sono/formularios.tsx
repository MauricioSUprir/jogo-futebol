"use client";
import { useActionState, useEffect } from "react";
import { salvarConfigSono, salvarNoite } from "@/acoes/sono";
import { QUALIDADE } from "@/lib/sono";
import { nomeDiaCurto } from "@/lib/datas";
import { AreaTexto, Campo, Entrada, Mensagem } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { Escala } from "../checkin/form";

function useFechar(ok?: string) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (ok) fechar();
  }, [ok, fechar]);
}

export interface NoiteForm {
  id?: string;
  dia: string;
  deitou: string; // HH:MM local
  acordou: string;
  latenciaMin: number | null;
  despertares: number | null;
  qualidade: number | null;
  notas: string | null;
}

/** Registrar (ou editar) uma noite. O dia é o dia em que acordou. */
export function FormNoite({ hoje, noite, compacto }: { hoje: string; noite: NoiteForm; compacto?: boolean }) {
  const [estado, acao] = useActionState(salvarNoite, undefined);
  useFechar(estado?.ok);
  const qualidades = Object.entries(QUALIDADE).map(([v, t]) => ({ v: Number(v), t }));
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      {noite.id && <input type="hidden" name="id" value={noite.id} />}
      {compacto ? (
        <input type="hidden" name="dia" value={noite.dia} />
      ) : (
        <Campo rotulo="Dia em que acordou" htmlFor="sn-dia" dica="Se dormiu antes da meia-noite, a noite começa no dia anterior.">
          <Entrada id="sn-dia" name="dia" type="date" required defaultValue={noite.dia} max={hoje} />
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Foi dormir" htmlFor="sn-deitou">
          <Entrada id="sn-deitou" name="deitou" type="time" required defaultValue={noite.deitou} />
        </Campo>
        <Campo rotulo="Acordou" htmlFor="sn-acordou">
          <Entrada id="sn-acordou" name="acordou" type="time" required defaultValue={noite.acordou} />
        </Campo>
      </div>
      {!compacto && (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Até pegar no sono (min)" htmlFor="sn-lat" dica="Opcional">
            <Entrada id="sn-lat" name="latencia" type="number" inputMode="numeric" min={0} max={240} step={5} defaultValue={noite.latenciaMin ?? ""} />
          </Campo>
          <Campo rotulo="Despertares" htmlFor="sn-desp" dica="Opcional">
            <Entrada id="sn-desp" name="despertares" type="number" inputMode="numeric" min={0} max={30} defaultValue={noite.despertares ?? ""} />
          </Campo>
        </div>
      )}
      <Escala nome="qualidade" rotulo="Qualidade percebida" opcoes={qualidades} valor={noite.qualidade} />
      {!compacto && (
        <Campo rotulo="Diário de sono (opcional)" htmlFor="sn-notas" dica="Sonhos, o que ajudou ou atrapalhou, como acordou.">
          <AreaTexto id="sn-notas" name="notas" maxLength={2000} defaultValue={noite.notas ?? ""} className="min-h-20" />
        </Campo>
      )}
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{noite.id ? "Salvar alterações" : "Registrar noite"}</BotaoEnvio>
    </form>
  );
}

export function FormConfigSono({
  metaMin,
  dormir,
  acordar,
  diasAula,
  lembreteMin,
}: {
  metaMin: number;
  dormir: string;
  acordar: string;
  diasAula: number[];
  lembreteMin: number;
}) {
  const [estado, acao] = useActionState(salvarConfigSono, undefined);
  useFechar(estado?.ok);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <Campo
        rotulo="Meta de sono (horas por noite)"
        htmlFor="sc-meta"
        dica="Valor seu, ajustável; para adolescentes, as referências costumam falar em 8 a 10 horas por noite — não é recomendação médica."
      >
        <Entrada id="sc-meta" name="meta" type="number" inputMode="decimal" min={4} max={14} step={0.25} required defaultValue={metaMin / 60} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Horário de dormir" htmlFor="sc-dormir">
          <Entrada id="sc-dormir" name="dormir" type="time" required defaultValue={dormir} />
        </Campo>
        <Campo rotulo="Horário de acordar" htmlFor="sc-acordar">
          <Entrada id="sc-acordar" name="acordar" type="time" required defaultValue={acordar} />
        </Campo>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Dias de aula (o dia em que acorda)</legend>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <label key={d}>
              <input type="checkbox" name="diasAula" value={d} defaultChecked={diasAula.includes(d)} className="peer sr-only" />
              <span className="inline-flex h-9 min-w-11 cursor-pointer select-none items-center justify-center rounded-lg border border-borda px-2 text-sm capitalize text-suave transition peer-checked:border-eletrico peer-checked:bg-eletrico/20 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
                {nomeDiaCurto(d)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Campo rotulo="Lembrete de preparar o descanso (minutos antes)" htmlFor="sc-lem" dica="Aparece no painel. 0 desliga.">
        <Entrada id="sc-lem" name="lembrete" type="number" inputMode="numeric" min={0} max={180} step={5} required defaultValue={lembreteMin} />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">Salvar</BotaoEnvio>
    </form>
  );
}
