"use client";
import { useActionState, useEffect } from "react";
import { registrarBebida, salvarConfigAgua } from "@/acoes/agua";
import { Campo, Entrada, Mensagem, Selecao } from "../ui";
import { BotaoEnvio, useFecharDialogo, manterValores } from "../cliente";
import { BEBIDAS } from "@/lib/agua";

function useFechar(ok?: string) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (ok) fechar();
  }, [ok, fechar]);
}

export function FormBebida({ hoje, copo }: { hoje: string; copo: number }) {
  const [estado, acao] = useActionState(registrarBebida, undefined);
  useFechar(estado?.ok);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="tipo" value="personalizado" />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Quantidade (ml)" htmlFor="b-ml">
          <Entrada id="b-ml" name="ml" type="number" inputMode="numeric" min={10} max={5000} step={10} required defaultValue={copo} autoFocus />
        </Campo>
        <Campo rotulo="Bebida" htmlFor="b-beb">
          <Selecao id="b-beb" name="bebida" defaultValue="agua">
            {Object.entries(BEBIDAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Dia" htmlFor="b-dia">
          <Entrada id="b-dia" name="dia" type="date" defaultValue={hoje} max={hoje} />
        </Campo>
        <Campo rotulo="Horário (opcional)" htmlFor="b-hora" dica="Vazio = agora">
          <Entrada id="b-hora" name="hora" type="time" />
        </Campo>
      </div>
      <p className="text-xs text-apagado">Só a água conta para a meta; as outras bebidas ficam registradas à parte.</p>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Registrando…">Registrar</BotaoEnvio>
    </form>
  );
}

export function FormConfigAgua({ meta, copo, garrafa, rapidos }: { meta: number; copo: number; garrafa: number; rapidos: number[] }) {
  const [estado, acao] = useActionState(salvarConfigAgua, undefined);
  useFechar(estado?.ok);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <Campo
        rotulo="Meta diária (ml)"
        htmlFor="c-meta"
        dica="Valor seu, ajustável a qualquer momento. Não é recomendação médica: siga a orientação adequada para sua idade, o clima e suas atividades."
      >
        <Entrada id="c-meta" name="meta" type="number" inputMode="numeric" min={250} max={8000} step={50} required defaultValue={meta} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Tamanho do copo (ml)" htmlFor="c-copo">
          <Entrada id="c-copo" name="copo" type="number" inputMode="numeric" min={50} max={2000} step={10} required defaultValue={copo} />
        </Campo>
        <Campo rotulo="Tamanho da garrafa (ml)" htmlFor="c-garrafa">
          <Entrada id="c-garrafa" name="garrafa" type="number" inputMode="numeric" min={100} max={3000} step={10} required defaultValue={garrafa} />
        </Campo>
      </div>
      <Campo rotulo="Botões rápidos (ml, separados por vírgula)" htmlFor="c-rap" dica="Até 4. Ex.: 200, 300">
        <Entrada id="c-rap" name="rapidos" defaultValue={rapidos.join(", ")} inputMode="numeric" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">Salvar</BotaoEnvio>
    </form>
  );
}
