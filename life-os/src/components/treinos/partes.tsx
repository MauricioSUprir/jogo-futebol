// Peças de servidor do Fitness Center: alertas, item de atividade, grade da semana e indicadores.
import Link from "next/link";
import type { ReactNode } from "react";
import { CircleCheck, Dumbbell, Footprints, HeartHandshake, Pencil, Play, ShieldAlert, Sparkles, Trash2, Trophy, type LucideIcon } from "lucide-react";
import { excluirAtividade } from "@/acoes/treinos";
import { Selo, classesBotao } from "../ui";
import { BotaoEnvio, Dialogo } from "../cliente";
import { FormCardio, FormFutebol } from "./formularios";
import { dataParaChave, diaRelativo, horaNoFuso, nomeDiaCurto } from "@/lib/datas";
import { POSICOES, formatarDuracao, nomeEsforco, nomeSubtipo, num, ritmo, type Alerta, type DiaSemana } from "@/lib/treinos";
import type { AtividadeCompleta } from "@/lib/servidor/treinos";
import { cn } from "@/lib/cn";

export const ICONE_TIPO: Record<string, LucideIcon> = { musculacao: Dumbbell, cardio: Footprints, futebol: Trophy };

export function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="painel min-w-0 p-3.5 sm:p-4">
      <p className="rotulo truncate">{rotulo}</p>
      <p className="numero mt-1 truncate font-display text-xl font-bold">{valor}</p>
      {detalhe && <p className="mt-0.5 line-clamp-2 text-xs text-apagado">{detalhe}</p>}
    </div>
  );
}

export function ListaAlertas({ alertas, vazio }: { alertas: Alerta[]; vazio?: ReactNode }) {
  if (alertas.length === 0) return vazio ? <p className="text-sm text-suave">{vazio}</p> : null;
  return (
    <ul className="grid grid-cols-1 gap-2">
      {alertas.map((a) => (
        <li
          key={a.id}
          className={cn(
            "flex gap-2.5 rounded-xl border px-3 py-2.5 text-sm",
            a.tom === "positivo" ? "border-ok/30 bg-ok/10" : "border-alerta/30 bg-alerta/10",
          )}
        >
          {a.tom === "positivo" ? (
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
          ) : a.id === "desconforto" ? (
            <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-alerta" aria-hidden />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-alerta" aria-hidden />
          )}
          <span>{a.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** Título de uma atividade para listas ("Treino A", "Corrida", "Partida × Leões"). */
export function tituloAtividade(a: AtividadeCompleta): string {
  if (a.title) return a.title;
  if (a.kind === "musculacao") return a.plan?.name ?? "Musculação";
  if (a.kind === "futebol" && a.subtype !== "treino" && a.opponent) return `${nomeSubtipo(a.kind, a.subtype)} × ${a.opponent}`;
  return nomeSubtipo(a.kind, a.subtype);
}

function detalhes(a: AtividadeCompleta): string[] {
  const d: string[] = [formatarDuracao(a.durationMin)];
  if (a.kind === "cardio" && a.distanceKm) {
    d.push(`${num(a.distanceKm, 2)} km`);
    const r = ritmo(a.durationMin, a.distanceKm);
    if (r && ["corrida", "caminhada", "esteira"].includes(a.subtype ?? "")) d.push(r);
  }
  if (a.kind === "musculacao" && a.sets.length) {
    const exs = new Set(a.sets.map((s) => s.exercise.trim().toLowerCase())).size;
    d.push(`${exs} exercício${exs === 1 ? "" : "s"} · ${a.sets.length} série${a.sets.length === 1 ? "" : "s"}`);
  }
  if (a.kind === "futebol" && a.subtype !== "treino") {
    if (a.minutes !== null) d.push(`${a.minutes} min em campo`);
    if (a.scoreFor !== null && a.scoreAgainst !== null) d.push(`${a.scoreFor} × ${a.scoreAgainst}`);
    if (a.position) d.push(POSICOES[a.position] ?? a.position);
  }
  if (a.effort !== null) d.push(`esforço ${a.effort}`);
  return d;
}

/** Botão de apagar com confirmação. */
export function ApagarAtividade({ id, nome }: { id: string; nome: string }) {
  return (
    <Dialogo
      gatilho={<Trash2 className="h-4 w-4" />}
      rotuloGatilho={`Apagar ${nome}`}
      classeGatilho="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo"
      titulo="Apagar registro?"
      descricao={nome}
    >
      <form action={excluirAtividade} className="grid grid-cols-1 gap-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-suave">O registro e as séries dele saem do histórico.</p>
        <BotaoEnvio variante="perigo" pendente="Apagando…">
          Apagar
        </BotaoEnvio>
      </form>
    </Dialogo>
  );
}

export function ItemAtividade({ a, tz, hojeK, mostrarNotas }: { a: AtividadeCompleta; tz: string; hojeK: string; mostrarNotas?: boolean }) {
  const Icone = ICONE_TIPO[a.kind] ?? Dumbbell;
  const dia = dataParaChave(a.day);
  const nome = tituloAtividade(a);
  const hora = a.at ? horaNoFuso(a.at, tz) : undefined;
  const jogo = a.kind === "futebol" && a.subtype !== "treino";
  return (
    <li className="flex items-start gap-3 rounded-xl border border-borda bg-fundo-2/50 px-3 py-2.5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 grid-cols-1 place-items-center rounded-xl border border-borda bg-painel-2">
        <Icone className="h-4 w-4 text-eletrico-claro" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium">{nome}</span>
          {jogo && (a.goals ?? 0) > 0 && <Selo cor="#34d399">{a.goals} gol{a.goals === 1 ? "" : "s"}</Selo>}
          {jogo && (a.assists ?? 0) > 0 && <Selo cor="#60a5fa">{a.assists} assist.</Selo>}
          {a.rating !== null && <Selo>nota {a.rating}</Selo>}
        </p>
        <p className="mt-0.5 text-xs text-suave">
          {diaRelativo(dia, hojeK)}
          {hora && ` · ${hora}`} · {detalhes(a).join(" · ")}
        </p>
        {mostrarNotas && a.notes && <p className="mt-1 line-clamp-3 text-xs text-apagado">{a.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center">
        {a.kind === "musculacao" ? (
          <Link href={`/treinos/sessao/${a.id}`} className="rounded-lg p-1.5 text-apagado hover:bg-white/5 hover:text-texto" aria-label={`Editar ${nome}`}>
            <Pencil className="h-4 w-4" />
          </Link>
        ) : (
          <Dialogo
            gatilho={<Pencil className="h-4 w-4" />}
            rotuloGatilho={`Editar ${nome}`}
            classeGatilho="rounded-lg p-1.5 text-apagado hover:bg-white/5 hover:text-texto"
            titulo={`Editar · ${nomeSubtipo(a.kind, a.subtype)}`}
          >
            {a.kind === "cardio" ? (
              <FormCardio
                hoje={hojeK}
                inicial={{ id: a.id, subtipo: a.subtype ?? "outro", dia, hora, duracao: a.durationMin, distancia: a.distanceKm, esforco: a.effort, notas: a.notes }}
              />
            ) : (
              <FormFutebol
                hoje={hojeK}
                inicial={{
                  id: a.id,
                  subtipo: a.subtype ?? "partida",
                  dia,
                  hora,
                  duracao: a.durationMin,
                  esforco: a.effort,
                  minutos: a.minutes,
                  gols: a.goals,
                  assistencias: a.assists,
                  posicao: a.position,
                  time: a.team,
                  adversario: a.opponent,
                  competicao: a.competition,
                  placarPro: a.scoreFor,
                  placarContra: a.scoreAgainst,
                  nota: a.rating,
                  notas: a.notes,
                }}
              />
            )}
          </Dialogo>
        )}
        <ApagarAtividade id={a.id} nome={nome} />
      </div>
    </li>
  );
}

/** A semana de treinamento: o que cada ficha tem em cada dia, o que foi feito e os dias de recuperação. */
export function GradeSemana({
  grade,
  hojeK,
  feitos,
  descansos,
}: {
  grade: DiaSemana[];
  hojeK: string;
  feitos: Map<string, string[]>; // dia → títulos das atividades feitas
  descansos: Set<string>;
}) {
  return (
    <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-7">
      {grade.map((d) => {
        const feito = feitos.get(d.dia) ?? [];
        const ehHoje = d.dia === hojeK;
        return (
          <li
            key={d.dia}
            className={cn(
              "flex min-w-0 items-start gap-3 rounded-xl border border-borda bg-fundo-2/50 p-2.5 sm:flex-col sm:gap-1.5",
              ehHoje && "border-eletrico/60 shadow-[inset_0_0_0_1px_rgb(37_99_235/0.35)]",
            )}
          >
            <p className="w-12 shrink-0 text-xs font-semibold capitalize sm:w-auto">
              {nomeDiaCurto(d.dow)} <span className="numero font-normal text-apagado">{Number(d.dia.slice(8))}</span>
              {ehHoje && <span className="sr-only"> (hoje)</span>}
            </p>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-1">
              {d.fichas.map((f) => (
                <Link
                  key={f.id}
                  href={`/treinos/sessao?ficha=${f.id}`}
                  className="flex min-w-0 items-center gap-1 rounded-md bg-eletrico/15 px-1.5 py-0.5 text-xs text-texto hover:bg-eletrico/25"
                  title={`Registrar ${f.nome}`}
                >
                  <Play className="h-3 w-3 shrink-0 text-eletrico-claro" aria-hidden />
                  <span className="truncate">{f.nome}</span>
                </Link>
              ))}
              {d.recuperacao && feito.length === 0 && (
                <span className="text-xs text-apagado">{descansos.has(d.dia) ? "Descanso marcado" : "Recuperação"}</span>
              )}
              {feito.map((t, k) => (
                <span key={k} className="flex min-w-0 items-center gap-1 text-xs text-ok">
                  <CircleCheck className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{t}</span>
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function LegendaEsforco() {
  return (
    <p className="text-xs text-apagado">
      Carga = duração × esforço percebido (0–10). Sem esforço informado, conta {nomeEsforco(5).toLowerCase()}.
    </p>
  );
}

export function BotaoNovaSessao({ fichaId, rotulo = "Registrar sessão" }: { fichaId: string; rotulo?: string }) {
  return (
    <Link href={`/treinos/sessao?ficha=${fichaId}`} className={classesBotao("primario", "p")}>
      <Play className="h-3.5 w-3.5" /> {rotulo}
    </Link>
  );
}
