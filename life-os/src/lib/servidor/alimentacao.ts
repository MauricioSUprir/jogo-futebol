// NUTRITION HUB — leituras do banco: refeições, dias de treino, registro rápido, insights e exportação.
import { db } from "@/lib/db";
import type { Meal, User } from "@/generated/prisma/client";
import { chaveParaData, dataParaChave, intervaloDeDias, minutosNoFuso, somaDias, type ChaveDia } from "@/lib/datas";
import { sugerirRefeicao, sugestoesGentis, type RefeicaoReg, type Refeicao } from "@/lib/alimentacao";
import type { Insight } from "@/lib/insights";

export interface RefeicaoDoDia extends RefeicaoReg {
  id: string;
  at: Date;
  descricao: string;
  fome: number | null;
  saciedade: number | null;
  notas: string | null;
}

function paraRegistro(m: Meal, tz: string): RefeicaoDoDia {
  return {
    id: m.id,
    dia: dataParaChave(m.day),
    at: m.at,
    minutos: minutosNoFuso(m.at, tz),
    tipo: m.slot,
    grupos: m.groups,
    descricao: m.description,
    fome: m.hunger,
    saciedade: m.satiety,
    notas: m.notes,
  };
}

/** Refeições do período (mais antigas primeiro), com o horário local. */
export async function refeicoesDoPeriodo(user: User, de: ChaveDia, ate: ChaveDia): Promise<RefeicaoDoDia[]> {
  const linhas = await db.meal.findMany({
    where: { userId: user.id, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } },
    orderBy: [{ day: "asc" }, { at: "asc" }],
  });
  return linhas.map((m) => paraRegistro(m, user.timezone));
}

/** Dias de treino: há atividade registrada no Fitness Center ou o dia foi marcado como de treino no Hydro Track. */
export async function diasDeTreino(userId: string, de: ChaveDia, ate: ChaveDia): Promise<Set<ChaveDia>> {
  const faixa = { gte: chaveParaData(de), lte: chaveParaData(ate) };
  const [atividades, agua] = await Promise.all([
    db.activity.findMany({ where: { userId, day: faixa }, select: { day: true } }),
    db.waterDay.findMany({ where: { userId, day: faixa, trainingDay: true }, select: { day: true } }),
  ]);
  return new Set([...atividades, ...agua].map((d) => dataParaChave(d.day)));
}

/** Props do registro rápido de refeição (botão central). */
export async function dadosRegistroRapidoAlimentacao(user: User, hojeK: ChaveDia): Promise<{ hoje: ChaveDia; tipoSugerido: Refeicao }> {
  return { hoje: hojeK, tipoSugerido: sugerirRefeicao(minutosNoFuso(new Date(), user.timezone)) };
}

/** Insights do painel (máx. 2): só convites gentis de variedade, nunca quantidade. */
export async function insightsAlimentacao(user: User, hojeK: ChaveDia): Promise<Insight[]> {
  const ult7 = intervaloDeDias(somaDias(hojeK, -6), hojeK);
  const refeicoes = await refeicoesDoPeriodo(user, ult7[0], hojeK);
  return sugestoesGentis(refeicoes, ult7).slice(0, 2);
}

export async function exportarAlimentacao(userId: string) {
  const [refeicoes, plano, compras, receitas] = await Promise.all([
    db.meal.findMany({ where: { userId }, orderBy: [{ day: "asc" }, { at: "asc" }] }),
    db.mealPlanItem.findMany({ where: { userId }, orderBy: { position: "asc" } }),
    db.shoppingItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.recipe.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    refeicoes: refeicoes.map((m) => ({
      dia: dataParaChave(m.day),
      horario: m.at.toISOString(),
      tipo: m.slot,
      descricao: m.description,
      grupos: m.groups,
      fome: m.hunger,
      saciedade: m.satiety,
      observacoes: m.notes,
    })),
    planejamento: plano.map((p) => ({ diasDaSemana: p.weekdays, tipo: p.slot, descricao: p.description, diaDeTreino: p.trainingDay })),
    listaDeCompras: compras.map((c) => ({ item: c.name, quantidade: c.quantity, categoria: c.category, marcado: c.checked })),
    receitas: receitas.map((r) => ({
      titulo: r.title,
      ingredientes: r.ingredients,
      preparo: r.steps,
      etiquetas: r.tags,
      favorita: r.favorite,
      diaDeTreino: r.forTraining,
    })),
  };
}
