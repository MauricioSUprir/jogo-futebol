// Um item da agenda (evento ou tarefa) que abre os detalhes, a edição e a exclusão.
import { Check, Clock, MapPin, Repeat, Trash2 } from "lucide-react";
import type { ItemAgenda } from "@/lib/servidor/dados";
import { categoriaEvento, PRIORIDADES } from "@/lib/catalogo";
import { horaNoFuso } from "@/lib/datas";
import { textoRecorrencia } from "@/lib/recorrencia";
import { concluirTarefa, excluirEvento, excluirTarefa, tirarDoHorario } from "@/acoes/agenda";
import { Dialogo } from "../cliente";
import { classesBotao } from "../ui";
import { FormEvento, FormTarefa } from "./formularios";
import { cn } from "@/lib/cn";

export function corItem(i: Pick<ItemAgenda, "tipo" | "categoria">) {
  return i.tipo === "tarefa" ? "#a78bfa" : categoriaEvento(i.categoria).cor;
}

export function horario(i: ItemAgenda, tz: string) {
  if (i.diaInteiro) return "Dia inteiro";
  return `${horaNoFuso(i.inicio, tz)}${i.fim ? `–${horaNoFuso(i.fim, tz)}` : ""}`;
}

export function ItemAgendaBotao({ item: i, tz, compacto }: { item: ItemAgenda; tz: string; compacto?: boolean }) {
  const cor = corItem(i);
  const e = i.edicao;
  const gatilho = (
    <span className="flex w-full min-w-0 items-start gap-2 text-left">
      <span className="mt-0.5 h-full w-1 shrink-0 self-stretch rounded-full" style={{ background: cor }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", i.concluida && "text-suave line-through")}>{i.titulo}</span>
        {!compacto && <span className="numero block text-xs text-suave">{horario(i, tz)}</span>}
      </span>
      {i.tipo === "tarefa" && i.concluida && <Check className="h-4 w-4 shrink-0 text-ok" aria-hidden />}
    </span>
  );
  return (
    <Dialogo
      gatilho={gatilho}
      classeGatilho="w-full rounded-xl border border-borda bg-fundo-2/60 px-2.5 py-2 transition hover:border-borda-forte hover:bg-white/[0.03]"
      titulo={i.titulo}
      descricao={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span style={{ color: cor }}>{i.tipo === "tarefa" ? `Tarefa · prioridade ${PRIORIDADES[i.prioridade ?? 2].toLowerCase()}` : categoriaEvento(i.categoria).nome}</span>
          <span className="numero inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {horario(i, tz)}</span>
          {i.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {i.local}</span>}
          {i.recorrencia && i.recorrencia !== "nenhuma" && <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5" /> {textoRecorrencia(i.recorrencia)}</span>}
        </span>
      }
    >
      {i.notas && <p className="mb-4 whitespace-pre-wrap rounded-xl border border-borda bg-fundo-2/60 p-3 text-sm text-suave">{i.notas}</p>}
      {i.tipo === "tarefa" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <form action={concluirTarefa}>
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="feita" value={i.concluida ? "0" : "1"} />
              <button className={classesBotao(i.concluida ? "secundario" : "primario", "p")}>
                <Check className="h-4 w-4" /> {i.concluida ? "Reabrir" : "Concluir"}
              </button>
            </form>
            <form action={tirarDoHorario}>
              <input type="hidden" name="id" value={i.id} />
              <button className={classesBotao("secundario", "p")}>Tirar do horário</button>
            </form>
            <form action={excluirTarefa}>
              <input type="hidden" name="id" value={i.id} />
              <button className={classesBotao("perigo", "p")}>
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            </form>
          </div>
          <FormTarefa
            dia={i.dia}
            inicial={{
              id: i.id,
              titulo: i.titulo,
              duracao: i.duracaoMin ?? 30,
              prioridade: i.prioridade ?? 2,
              prazo: e.prazo as string | undefined,
              notas: i.notas ?? undefined,
              dia: e.dia as string,
              hora: e.hora as string,
            }}
          />
        </>
      ) : (
        <>
          <form action={excluirEvento} className="mb-4">
            <input type="hidden" name="id" value={i.id} />
            <button className={classesBotao("perigo", "p")}>
              <Trash2 className="h-4 w-4" /> Excluir{i.recorrencia !== "nenhuma" ? " (todas as repetições)" : ""}
            </button>
          </form>
          <FormEvento
            dia={i.dia}
            inicial={{
              id: i.id,
              titulo: i.titulo,
              categoria: i.categoria,
              dia: e.dia as string,
              diaFim: e.diaFim as string | undefined,
              diaInteiro: !!e.diaInteiro,
              inicio: e.inicio as string | undefined,
              fim: e.fim as string | undefined,
              local: i.local ?? undefined,
              notas: i.notas ?? undefined,
              repetir: i.recorrencia ?? "nenhuma",
              repetirAte: e.repetirAte as string | undefined,
            }}
          />
        </>
      )}
    </Dialogo>
  );
}
