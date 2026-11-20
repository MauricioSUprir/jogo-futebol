// Sessão de musculação nova: pela ficha (?ficha=) ou livre.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { db } from "@/lib/db";
import { seriesFeitas } from "@/lib/servidor/treinos";
import { hoje, horaNoFuso } from "@/lib/datas";
import { cargasDaUltimaVez, chaveExercicio, num, repsSugeridas } from "@/lib/treinos";
import { CabecalhoPagina, classesBotao } from "@/components/ui";
import { FormSessao, type ExercicioSessao } from "@/components/treinos/form-sessao";

export const metadata = { title: "Sessão de musculação" };

const txt = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export default async function NovaSessao({ searchParams }: { searchParams: Promise<{ ficha?: string }> }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const { ficha: fichaId } = await searchParams;
  const ficha = fichaId
    ? await db.workoutPlan.findFirst({ where: { id: fichaId, userId: user.id }, include: { exercises: { orderBy: { position: "asc" } } } })
    : null;
  if (fichaId && !ficha) notFound();
  const ultima = cargasDaUltimaVez(await seriesFeitas(user.id));
  const exercicios: ExercicioSessao[] = (ficha?.exercises ?? []).map((e) => {
    const antes = ultima.get(chaveExercicio(e.name)) ?? [];
    const repsFicha = repsSugeridas(e.reps);
    const ultimaCarga = antes.length ? antes[antes.length - 1].carga : null;
    const dica = [
      `${e.sets} × ${e.reps}`,
      e.loadKg !== null ? `${num(e.loadKg)} kg na ficha` : null,
      antes.some((s) => s.carga !== null)
        ? `última vez: ${antes.map((s) => (s.carga !== null ? `${num(s.carga)} kg` : "—")).join(", ")}`
        : antes.some((s) => s.reps !== null)
          ? `última vez: ${antes.map((s) => s.reps ?? "—").join(", ")} reps`
          : null,
      e.notes,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      nome: e.name,
      grupo: e.muscleGroup,
      descanso: e.restSec,
      dica,
      series: Array.from({ length: e.sets }, (_, k) => ({
        reps: txt(antes[k]?.reps ?? repsFicha),
        carga: txt(antes[k]?.carga ?? ultimaCarga ?? e.loadKg),
      })),
    };
  });
  return (
    <>
      <Link href="/treinos?aba=musculacao" className={classesBotao("fantasma", "p", "mb-3 -ml-2")}>
        <ArrowLeft className="h-4 w-4" /> Musculação
      </Link>
      <CabecalhoPagina
        rotulo="Fitness Center"
        titulo={ficha ? ficha.name : "Sessão livre"}
        descricao={ficha ? "As séries já vêm com a carga da última vez. Ajuste para o que fez de verdade." : "Adicione os exercícios e as séries que fez."}
      />
      <FormSessao
        hoje={hojeK}
        inicial={{
          fichaId: ficha?.id,
          titulo: "",
          dia: hojeK,
          hora: horaNoFuso(new Date(), user.timezone),
          duracao: 60,
          esforco: null,
          notas: "",
          exercicios,
        }}
      />
    </>
  );
}
