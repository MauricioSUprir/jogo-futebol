"use client";
// "Planejar meu dia": mostra a proposta do planejador antes de gravar.
import { useActionState, useState } from "react";
import { CalendarCheck, Wand2 } from "lucide-react";
import { aplicarPlano, planejar } from "@/acoes/agenda";
import { BotaoEnvio, manterValores } from "../cliente";
import { Entrada, Mensagem } from "../ui";

export function Planejar({ hoje, amanha }: { hoje: string; amanha: string }) {
  const [estado, acao] = useActionState(planejar, undefined);
  const [aplicado, setAplicado] = useState<unknown>(null);
  const jaAplicado = aplicado !== null && aplicado === estado;
  return (
    <div className="grid grid-cols-1 gap-4">
      <form action={acao} onReset={manterValores} className="flex flex-wrap items-end gap-2">
        <label className="grid grid-cols-1 gap-1.5 text-xs font-medium text-suave">
          Dia
          <Entrada name="dia" type="date" min={hoje} defaultValue={hoje} className="w-44" />
        </label>
        <BotaoEnvio pendente="Calculando…">
          <Wand2 className="h-4 w-4" /> Planejar
        </BotaoEnvio>
        <span className="text-xs text-apagado">Amanhã: {amanha.split("-").reverse().join("/")}</span>
      </form>
      {estado?.erro && <Mensagem tipo="info">{estado.erro}</Mensagem>}
      {jaAplicado && <Mensagem tipo="ok">Plano aplicado: as tarefas estão na agenda.</Mensagem>}
      {estado?.dia && !jaAplicado && (
        <form
          onReset={manterValores}
          action={async (fd) => {
            await aplicarPlano(fd);
            setAplicado(estado);
          }}
          className="grid grid-cols-1 gap-3"
        >
          <input type="hidden" name="dia" value={estado.dia} />
          <p className="text-sm text-suave">
            Proposta para <span className="text-texto">{estado.dia.split("-").reverse().join("/")}</span> · {Math.floor(estado.livresMin / 60)} h{" "}
            {estado.livresMin % 60} min livres na sua janela do dia. Compromissos ganham 10 min de folga e há pausa depois de 90 min de foco.
          </p>
          {estado.itens.length > 0 ? (
            <ol className="grid grid-cols-1 gap-1.5">
              {estado.itens.map((it) => (
                <li key={it.id} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/60 px-3 py-2 text-sm">
                  <input type="hidden" name="item" value={`${it.id}@${it.inicio}`} />
                  <span className="numero w-24 text-suave">
                    {it.inicio}–{it.fim}
                  </span>
                  <span className="flex-1">{it.titulo}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Mensagem tipo="info">Nenhuma tarefa coube nos horários livres.</Mensagem>
          )}
          {estado.semLugar.length > 0 && (
            <p className="text-xs text-alerta">Não couberam: {estado.semLugar.join(", ")}.</p>
          )}
          {estado.itens.length > 0 && (
            <BotaoEnvio className="justify-self-start" pendente="Aplicando…">
              <CalendarCheck className="h-4 w-4" /> Aplicar plano
            </BotaoEnvio>
          )}
        </form>
      )}
    </div>
  );
}
