// "Smart Insights" da Fase 1: frases curtas a partir dos registros — PURO (tests/unit/insights.test.ts).
// Regras simples e transparentes (nada de diagnóstico; só padrões dos próprios registros).
import type { DiaAgua } from "./agua";
import { formatarMl } from "./agua";

export interface ResumoHabito {
  nome: string;
  pct30: number;
  esperados30: number;
  sequencia: number;
}

export interface Insight {
  tom: "positivo" | "neutro" | "atencao";
  texto: string;
}

export function gerarInsights(opts: {
  agua7: DiaAgua[]; // últimos 7 dias terminados
  aguaAnterior7: DiaAgua[]; // os 7 antes desses
  habitos: ResumoHabito[];
  provasProximas: { titulo: string; dias: number }[];
}): Insight[] {
  const r: Insight[] = [];

  const comRegistro = opts.agua7.filter((d) => d.aguaMl > 0);
  if (comRegistro.length >= 3) {
    const batidos = opts.agua7.filter((d) => d.bateu).length;
    r.push({
      tom: batidos >= 5 ? "positivo" : batidos >= 3 ? "neutro" : "atencao",
      texto: `Você bateu a meta de água em ${batidos} dos últimos 7 dias.`,
    });
    const m1 = opts.agua7.reduce((a, d) => a + d.aguaMl, 0) / 7;
    const m0 = opts.aguaAnterior7.reduce((a, d) => a + d.aguaMl, 0) / 7;
    if (m0 > 0) {
      const dif = Math.round(((m1 - m0) / m0) * 100);
      if (Math.abs(dif) >= 10) {
        r.push({
          tom: dif > 0 ? "positivo" : "atencao",
          texto: `Média de ${formatarMl(Math.round(m1))} por dia: ${dif > 0 ? "+" : ""}${dif}% em relação à semana anterior.`,
        });
      }
    }
  }

  const avaliaveis = opts.habitos.filter((h) => h.esperados30 >= 5);
  if (avaliaveis.length) {
    const melhor = [...avaliaveis].sort((a, b) => b.pct30 - a.pct30)[0];
    if (melhor.pct30 >= 60) {
      r.push({ tom: "positivo", texto: `Seu hábito mais consistente é "${melhor.nome}" (${melhor.pct30}% em 30 dias).` });
    }
    const pior = [...avaliaveis].sort((a, b) => a.pct30 - b.pct30)[0];
    if (pior !== melhor && pior.pct30 < 40) {
      r.push({
        tom: "neutro",
        texto: `"${pior.nome}" está em ${pior.pct30}%. Que tal deixar a meta menor ou mudar o horário?`,
      });
    }
  }
  const emChamas = opts.habitos.filter((h) => h.sequencia >= 7).sort((a, b) => b.sequencia - a.sequencia)[0];
  if (emChamas) r.push({ tom: "positivo", texto: `${emChamas.sequencia} dias seguidos de "${emChamas.nome}".` });

  for (const p of opts.provasProximas.slice(0, 2)) {
    r.push({
      tom: p.dias <= 2 ? "atencao" : "neutro",
      texto: p.dias === 0 ? `Hoje tem prova: ${p.titulo}.` : p.dias === 1 ? `${p.titulo} amanhã.` : `${p.titulo} em ${p.dias} dias.`,
    });
  }

  return r.slice(0, 4);
}

// ───── Gamificação (recompensas virtuais, derivadas dos registros) ─────

export const XP = { habito: 10, metaAgua: 15, tarefa: 5, atividade: 10, estudo: 5, meta: 50, checkin: 2, noite: 2 };

/** XP pelo que foi feito (registro, não intensidade: treinar mais forte não dá mais pontos). */
export function calcularXp(c: {
  habitos: number;
  diasMetaAgua: number;
  tarefas: number;
  atividades?: number;
  sessoesEstudo?: number;
  metasConcluidas?: number;
  checkins?: number;
  noites?: number;
}): number {
  return (
    c.habitos * XP.habito +
    c.diasMetaAgua * XP.metaAgua +
    c.tarefas * XP.tarefa +
    (c.atividades ?? 0) * XP.atividade +
    (c.sessoesEstudo ?? 0) * XP.estudo +
    (c.metasConcluidas ?? 0) * XP.meta +
    (c.checkins ?? 0) * XP.checkin +
    (c.noites ?? 0) * XP.noite
  );
}

/** Nível n começa em 100 · n(n−1)/2 XP: 0, 100, 300, 600, 1000… */
export function nivel(xp: number): { nivel: number; base: number; proximo: number; pct: number } {
  const n = Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / 100)) / 2);
  const base = (100 * n * (n - 1)) / 2;
  const proximo = (100 * (n + 1) * n) / 2;
  return { nivel: n, base, proximo, pct: Math.round(((xp - base) / (proximo - base)) * 100) };
}
