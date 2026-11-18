// Leituras do Sleep Lab (painel, página, insights, exportação e registro rápido).
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { chaveParaData, dataParaChave, horaNoFuso, somaDias, type ChaveDia } from "@/lib/datas";
import type { Insight } from "@/lib/insights";
import { checkinsDoPeriodo } from "./checkin";
import { aulaVsLivre, bateuMeta, duracaoMin, formatarDuracao, horaDeMinutos, regularidade, sonoEEnergia, type Noite } from "@/lib/sono";
import { umaCasa } from "@/lib/checkin";

/** Configuração do sono (criada com o padrão na primeira leitura). Várias partes da mesma página leem ao mesmo
 * tempo: o upsert do Prisma não é atômico aqui (dois INSERT na primeira visita), então cria com ON CONFLICT DO NOTHING. */
export async function configSono(userId: string) {
  const atual = await db.sleepSettings.findUnique({ where: { userId } });
  if (atual) return atual;
  await db.sleepSettings.createMany({ data: [{ userId }], skipDuplicates: true });
  return db.sleepSettings.findUniqueOrThrow({ where: { userId } });
}

export async function noitesDoPeriodo(userId: string, de: ChaveDia, ate: ChaveDia): Promise<Noite[]> {
  const linhas = await db.sleepLog.findMany({
    where: { userId, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } },
    orderBy: { day: "asc" },
  });
  return linhas.map((l) => ({
    id: l.id,
    dia: dataParaChave(l.day),
    deitou: l.bedtime,
    acordou: l.wakeTime,
    latenciaMin: l.latencyMin,
    despertares: l.awakenings,
    qualidade: l.quality,
    notas: l.notes,
  }));
}

/** Props do registro rápido do sono (botão central "Registrar"). */
export async function dadosRegistroRapidoSono(user: User, hojeK: ChaveDia) {
  const [cfg, hojeNoite] = await Promise.all([
    configSono(user.id),
    db.sleepLog.findUnique({ where: { userId_day: { userId: user.id, day: chaveParaData(hojeK) } } }),
  ]);
  return {
    hoje: hojeK,
    deitou: hojeNoite ? horaNoFuso(hojeNoite.bedtime, user.timezone) : cfg.bedtime,
    acordou: hojeNoite ? horaNoFuso(hojeNoite.wakeTime, user.timezone) : cfg.wake,
    qualidade: hojeNoite?.quality ?? null,
    jaRegistrada: !!hojeNoite,
  };
}

/** Até 2 frases sobre o sono das últimas semanas (padrões dos próprios registros; nada de diagnóstico). */
export async function insightsSono(user: User, hojeK: ChaveDia): Promise<Insight[]> {
  const de = somaDias(hojeK, -27);
  const [cfg, noites, checkins] = await Promise.all([configSono(user.id), noitesDoPeriodo(user.id, de, hojeK), checkinsDoPeriodo(user.id, de, hojeK)]);
  const r: Insight[] = [];
  const e = sonoEEnergia(noites, checkins, cfg.targetMin);
  if (e && Math.abs(e.diferenca) >= 0.5) {
    r.push({
      tom: e.diferenca > 0 ? "positivo" : "neutro",
      texto:
        e.diferenca > 0
          ? `Depois de noites com ${formatarDuracao(cfg.targetMin)} ou mais, sua energia registrada foi ${umaCasa(e.a)} em média, contra ${umaCasa(e.b)} nas outras.`
          : `Nos seus registros, a energia não subiu depois das noites mais longas (${umaCasa(e.a)} × ${umaCasa(e.b)}).`,
    });
  }
  const ultimas7 = noites.filter((n) => n.dia > somaDias(hojeK, -7));
  if (ultimas7.length >= 3) {
    const batidas = ultimas7.filter((n) => bateuMeta(n, cfg.targetMin)).length;
    r.push({
      tom: batidas >= Math.ceil(ultimas7.length * 0.7) ? "positivo" : "neutro",
      texto: `Você chegou à sua meta de sono em ${batidas} de ${ultimas7.length} noites registradas nesta semana.`,
    });
  }
  const aul = aulaVsLivre(noites, cfg.schoolDays, user.timezone);
  if (r.length < 2 && aul.jetlagMin !== null && aul.jetlagMin >= 90) {
    r.push({
      tom: "atencao",
      texto: `Entre dias de aula e dias livres, o meio do seu sono muda cerca de ${formatarDuracao(aul.jetlagMin)}. Horários parecidos ajudam o corpo a se acostumar.`,
    });
  }
  return r.slice(0, 2);
}

/** Tudo do Sleep Lab, para a exportação completa. */
export async function exportarSono(userId: string) {
  const [cfg, noites] = await Promise.all([
    db.sleepSettings.findUnique({ where: { userId } }),
    db.sleepLog.findMany({ where: { userId }, orderBy: { day: "asc" } }),
  ]);
  return {
    configuracao: cfg && {
      metaMin: cfg.targetMin,
      dormir: cfg.bedtime,
      acordar: cfg.wake,
      diasAula: cfg.schoolDays,
      lembreteMin: cfg.remindMin,
    },
    noites: noites.map((n) => ({
      dia: dataParaChave(n.day),
      deitou: n.bedtime.toISOString(),
      acordou: n.wakeTime.toISOString(),
      tempoAteDormirMin: n.latencyMin,
      despertares: n.awakenings,
      qualidade: n.quality,
      duracaoMin: duracaoMin({ deitou: n.bedtime, acordou: n.wakeTime, latenciaMin: n.latencyMin }),
      diario: n.notes,
    })),
  };
}

/** Números do cartão do painel. */
export async function resumoSono(user: User, hojeK: ChaveDia) {
  const [cfg, noites] = await Promise.all([configSono(user.id), noitesDoPeriodo(user.id, somaDias(hojeK, -6), hojeK)]);
  const ultima = noites[noites.length - 1] ?? null;
  const media = noites.length ? noites.reduce((s, n) => s + duracaoMin(n), 0) / noites.length : null;
  const reg = regularidade(noites, user.timezone);
  return { cfg, ultima, media, n: noites.length, dormirMedio: horaDeMinutos(reg.dormir) };
}
