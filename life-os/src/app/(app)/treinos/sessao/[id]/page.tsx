// Editar uma sessão de musculação já registrada.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { db } from "@/lib/db";
import { dataParaChave, hoje, horaNoFuso } from "@/lib/datas";
import { chaveExercicio } from "@/lib/treinos";
import { CabecalhoPagina, classesBotao } from "@/components/ui";
import { FormSessao, type ExercicioSessao } from "@/components/treinos/form-sessao";

export const metadata = { title: "Editar sessão" };

const txt = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export default async function EditarSessao({ params }: { params: Promise<{ id: string }> }) {
  const user = await exigirUsuario();
  const { id } = await params;
  const a = await db.activity.findFirst({
    where: { id, userId: user.id, kind: "musculacao" },
    include: { sets: { orderBy: { id: "asc" } }, plan: { include: { exercises: true } } },
  });
  if (!a) notFound();
  const descanso = new Map((a.plan?.exercises ?? []).map((e) => [chaveExercicio(e.name), e.restSec]));
  const exercicios: ExercicioSessao[] = [];
  for (const s of a.sets) {
    let ex = exercicios.find((e) => chaveExercicio(e.nome) === chaveExercicio(s.exercise));
    if (!ex) {
      ex = { nome: s.exercise, grupo: s.muscleGroup, descanso: descanso.get(chaveExercicio(s.exercise)) ?? 60, series: [] };
      exercicios.push(ex);
    }
    ex.series.push({ reps: txt(s.reps), carga: txt(s.loadKg) });
  }
  return (
    <>
      <Link href="/treinos?aba=musculacao" className={classesBotao("fantasma", "p", "mb-3 -ml-2")}>
        <ArrowLeft className="h-4 w-4" /> Musculação
      </Link>
      <CabecalhoPagina rotulo="Fitness Center" titulo={`Editar · ${a.title ?? a.plan?.name ?? "Sessão"}`} />
      <FormSessao
        hoje={hoje(user.timezone)}
        inicial={{
          id: a.id,
          fichaId: a.planId ?? undefined,
          titulo: a.title ?? "",
          dia: dataParaChave(a.day),
          hora: a.at ? horaNoFuso(a.at, user.timezone) : undefined,
          duracao: a.durationMin,
          esforco: a.effort,
          notas: a.notes ?? "",
          exercicios,
        }}
      />
    </>
  );
}
