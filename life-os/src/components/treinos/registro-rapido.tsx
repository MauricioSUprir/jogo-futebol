"use client";
// Registro rápido de atividade para o botão central "Registrar": tipo (musculação pela ficha, cardio ou
// futebol), duração e esforço. O registro completo (séries, gols, distância…) fica no Fitness Center.
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { registrarAtividade } from "@/acoes/treinos";
import { Campo, Entrada, Mensagem, Selecao } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { CampoEsforco } from "./formularios";
import { TIPOS_CARDIO, TIPOS_FUTEBOL } from "@/lib/treinos";

export function RegistroRapidoTreino({ hoje, fichas }: { hoje: string; fichas: { id: string; nome: string }[] }) {
  const [estado, acao] = useActionState(registrarAtividade, undefined);
  const [tipo, setTipo] = useState<"musculacao" | "cardio" | "futebol">("musculacao");
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="dia" value={hoje} />
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Tipo</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["musculacao", "Musculação"],
              ["cardio", "Cardio"],
              ["futebol", "Futebol"],
            ] as const
          ).map(([k, v]) => (
            <label key={k}>
              <input type="radio" name="tipo" value={k} checked={tipo === k} onChange={() => setTipo(k)} className="peer sr-only" />
              <span className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-borda bg-fundo-2/70 px-1 text-sm text-suave transition peer-checked:border-eletrico peer-checked:bg-eletrico/20 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
                {v}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {tipo === "musculacao" && (
        <Campo rotulo="Ficha" htmlFor="rrt-ficha">
          <Selecao id="rrt-ficha" name="fichaId" defaultValue={fichas[0]?.id ?? ""}>
            <option value="">Sessão livre</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
      )}
      {tipo === "cardio" && (
        <Campo rotulo="Atividade" htmlFor="rrt-sub">
          <Selecao id="rrt-sub" name="subtipo" defaultValue="corrida">
            {Object.entries(TIPOS_CARDIO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </Campo>
      )}
      {tipo === "futebol" && (
        <Campo rotulo="Tipo de futebol" htmlFor="rrt-fut">
          <Selecao id="rrt-fut" name="subtipo" defaultValue="recreativo">
            {Object.entries(TIPOS_FUTEBOL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Duração (min)" htmlFor="rrt-dur">
          <Entrada id="rrt-dur" name="duracao" type="number" inputMode="numeric" min={1} max={600} required defaultValue={tipo === "futebol" ? 60 : tipo === "cardio" ? 30 : 50} key={tipo} />
        </Campo>
        <CampoEsforco id="rrt-esf" />
      </div>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Registrando…">Registrar atividade</BotaoEnvio>
      <p className="text-xs text-apagado">
        Séries, gols e distância:{" "}
        <Link href="/treinos" onClick={fechar} className="text-eletrico-claro hover:underline">
          Fitness Center
        </Link>
        .
      </p>
    </form>
  );
}
