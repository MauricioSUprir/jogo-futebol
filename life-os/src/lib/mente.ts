// MIND CENTER — regras PURAS (tests/unit/mente.test.ts): tipos do diário, respiração e padrões de estresse.
// Só padrões dos próprios registros; nunca diagnóstico. Comparações só com dados suficientes.
import { comparaGrupos, mediaDe, umaCasa, type Checkin } from "./checkin";
import { diaDaSemana, somaDias, type ChaveDia } from "./datas";

/** "Às segundas", "Aos sábados"… */
export const NOS_DIAS = ["Aos domingos", "Às segundas", "Às terças", "Às quartas", "Às quintas", "Às sextas", "Aos sábados"];

export const TIPOS_DIARIO = {
  diario: { nome: "Diário", descricao: "Como foi o dia" },
  acontecimento: { nome: "Acontecimento importante", descricao: "Algo que marcou" },
  reflexao: { nome: "Reflexão", descricao: "Pensar com calma sobre algo" },
  pensamentos: { nome: "Organizar pensamentos", descricao: "Tirar da cabeça e pôr em ordem" },
  positivo: { nome: "Coisas boas", descricao: "O que foi bom hoje" },
} as const;

export type TipoDiario = keyof typeof TIPOS_DIARIO;

export function tipoValido(t: string): t is TipoDiario {
  return t in TIPOS_DIARIO;
}

/** Perguntas-guia opcionais para o espaço de reflexão. */
export const PERGUNTAS_GUIA = [
  "O que deu certo hoje?",
  "O que está ocupando sua cabeça?",
  "Do que você se orgulha esta semana?",
  "O que você faria diferente, com calma?",
  "Quem ou o que te ajudou hoje?",
  "Qual é o próximo passo pequeno que dá para dar?",
] as const;

// ───── Respiração ─────

export interface FaseRespiracao {
  nome: string; // texto mostrado
  segundos: number;
  // O círculo: "cresce" (inspirar), "encolhe" (expirar) ou "segura" (fica como está).
  movimento: "cresce" | "encolhe" | "segura";
}

export const RESPIRACOES = {
  caixa: {
    nome: "Respiração em caixa",
    resumo: "4 · 4 · 4 · 4",
    descricao: "Inspire, segure, expire e segure, 4 segundos cada.",
    fases: [
      { nome: "Inspire", segundos: 4, movimento: "cresce" },
      { nome: "Segure", segundos: 4, movimento: "segura" },
      { nome: "Expire", segundos: 4, movimento: "encolhe" },
      { nome: "Segure", segundos: 4, movimento: "segura" },
    ],
  },
  relaxante: {
    nome: "4-7-8",
    resumo: "4 · 7 · 8",
    descricao: "Inspire em 4, segure em 7 e solte devagar em 8.",
    fases: [
      { nome: "Inspire", segundos: 4, movimento: "cresce" },
      { nome: "Segure", segundos: 7, movimento: "segura" },
      { nome: "Expire", segundos: 8, movimento: "encolhe" },
    ],
  },
  coerencia: {
    nome: "Coerência",
    resumo: "5 · 5",
    descricao: "Inspire em 5 e expire em 5, num ritmo constante.",
    fases: [
      { nome: "Inspire", segundos: 5, movimento: "cresce" },
      { nome: "Expire", segundos: 5, movimento: "encolhe" },
    ],
  },
} satisfies Record<string, { nome: string; resumo: string; descricao: string; fases: FaseRespiracao[] }>;

export type TipoRespiracao = keyof typeof RESPIRACOES;

export function duracaoCiclo(t: TipoRespiracao): number {
  return RESPIRACOES[t].fases.reduce((s, f) => s + f.segundos, 0);
}

/**
 * Onde a respiração está depois de `segundos` (ciclos completos e fase atual).
 * `fim` = terminou os `ciclos` pedidos.
 */
export function posicaoRespiracao(
  t: TipoRespiracao,
  segundos: number,
  ciclos: number,
): { ciclo: number; fase: number; restante: number; fim: boolean } {
  const fases = RESPIRACOES[t].fases;
  const ciclo = duracaoCiclo(t);
  const total = ciclo * ciclos;
  if (segundos >= total) return { ciclo: ciclos, fase: fases.length - 1, restante: 0, fim: true };
  const s = Math.max(0, segundos);
  const nCiclo = Math.floor(s / ciclo);
  let dentro = s - nCiclo * ciclo;
  let fase = 0;
  while (fase < fases.length - 1 && dentro >= fases[fase].segundos) {
    dentro -= fases[fase].segundos;
    fase++;
  }
  return { ciclo: nCiclo + 1, fase, restante: Math.ceil(fases[fase].segundos - dentro), fim: false };
}

// ───── Padrões de estresse ─────

export interface EstresseDow {
  dow: number;
  media: number | null;
  n: number;
}

/** Estresse médio por dia da semana (0 = domingo). */
export function estressePorDiaDaSemana(checkins: Pick<Checkin, "dia" | "estresse">[]): EstresseDow[] {
  const por = Array.from({ length: 7 }, () => [] as number[]);
  for (const c of checkins) if (c.estresse !== null) por[diaDaSemana(c.dia)].push(c.estresse);
  return por.map((v, dow) => ({ dow, media: mediaDe(v), n: v.length }));
}

/**
 * O dia da semana em que o estresse costuma ser mais alto — só com ≥ 14 registros no total, ≥ 3 naquele dia
 * e pelo menos meio ponto acima da média geral. Senão, null (sem conclusão com poucos dados).
 */
export function diaMaisEstressante(checkins: Pick<Checkin, "dia" | "estresse">[]): { dow: number; media: number; geral: number } | null {
  const com = checkins.filter((c) => c.estresse !== null);
  if (com.length < 14) return null;
  const geral = mediaDe(com.map((c) => c.estresse))!;
  const candidatos = estressePorDiaDaSemana(com).filter((d) => d.n >= 3 && d.media !== null && d.media >= geral + 0.5);
  if (!candidatos.length) return null;
  const pior = candidatos.sort((a, b) => b.media! - a.media! || a.dow - b.dow)[0];
  return { dow: pior.dow, media: pior.media!, geral };
}

/**
 * Estresse no dia seguinte a noites curtas (abaixo da meta) × noites que bateram a meta.
 * `sono` = minutos dormidos na noite que terminou no dia (o dia em que acordou).
 */
export function estresseESono(
  checkins: Pick<Checkin, "dia" | "estresse">[],
  sono: Map<ChaveDia, number>,
  metaMin: number,
) {
  const pares = checkins
    .filter((c) => c.estresse !== null && sono.has(c.dia))
    .map((c) => ({ grupo: (sono.get(c.dia)! < metaMin ? "a" : "b") as "a" | "b", valor: c.estresse }));
  return comparaGrupos(pares); // a = noite curta, b = meta batida
}

/** Dias com prova marcada até `janela` dias depois (inclusive o próprio dia). */
export function diasComProvaPerto(dias: ChaveDia[], provas: ChaveDia[], janela = 3): Set<ChaveDia> {
  const r = new Set<ChaveDia>();
  for (const d of dias) {
    if (provas.some((p) => p >= d && p <= somaDias(d, janela))) r.add(d);
  }
  return r;
}

/** Estresse em dias com prova perto × sem prova perto. */
export function estresseEProvas(checkins: Pick<Checkin, "dia" | "estresse">[], comProva: Set<ChaveDia>) {
  return comparaGrupos(checkins.map((c) => ({ grupo: (comProva.has(c.dia) ? "a" : "b") as "a" | "b", valor: c.estresse })));
}

/** As emoções mais marcadas no período. */
export function emocoesFrequentes(checkins: Pick<Checkin, "emocoes">[], n = 6): { emocao: string; vezes: number }[] {
  const conta = new Map<string, number>();
  for (const c of checkins) for (const e of c.emocoes) conta.set(e, (conta.get(e) ?? 0) + 1);
  return [...conta.entries()]
    .map(([emocao, vezes]) => ({ emocao, vezes }))
    .sort((a, b) => b.vezes - a.vezes || a.emocao.localeCompare(b.emocao, "pt-BR"))
    .slice(0, n);
}

/**
 * Mostrar o cartão de apoio no topo: humor ≤ 2 em 3 ou mais dos últimos 7 check-ins com humor.
 * (Não é diagnóstico: é só um lembrete gentil de que conversar ajuda.)
 */
export function apoioNoTopo(checkins: Pick<Checkin, "dia" | "humor">[]): boolean {
  const ultimos = checkins
    .filter((c) => c.humor !== null)
    .sort((a, b) => (a.dia < b.dia ? 1 : -1))
    .slice(0, 7);
  return ultimos.filter((c) => (c.humor as number) <= 2).length >= 3;
}

export interface Padrao {
  tom: "positivo" | "neutro" | "atencao";
  texto: string;
}

/** Frases dos padrões de estresse (a mesma regra na página e nos insights do painel). */
export function frasesPadroes(opts: {
  dia: ReturnType<typeof diaMaisEstressante>;
  sono: ReturnType<typeof estresseESono>;
  provas: ReturnType<typeof estresseEProvas>;
}): Padrao[] {
  const r: Padrao[] = [];
  if (opts.sono && Math.abs(opts.sono.diferenca) >= 0.5) {
    r.push(
      opts.sono.diferenca > 0
        ? {
            tom: "atencao",
            texto: `Depois de noites abaixo da sua meta de sono, seu estresse registrado foi em média ${umaCasa(opts.sono.a)} de 5, contra ${umaCasa(opts.sono.b)} quando a meta foi batida.`,
          }
        : {
            tom: "neutro",
            texto: `Seu estresse não subiu depois de noites mais curtas (${umaCasa(opts.sono.a)} × ${umaCasa(opts.sono.b)} de 5).`,
          },
    );
  }
  if (opts.provas && opts.provas.diferenca >= 0.5) {
    r.push({
      tom: "atencao",
      texto: `Nos dias com prova chegando (até 3 dias), seu estresse ficou em ${umaCasa(opts.provas.a)} de 5, contra ${umaCasa(opts.provas.b)} nos outros dias. Planejar a revisão com antecedência pode ajudar.`,
    });
  }
  if (opts.dia) {
    r.push({
      tom: "neutro",
      texto: `${NOS_DIAS[opts.dia.dow]} seu estresse costuma ser mais alto (${umaCasa(opts.dia.media)} de 5, média geral ${umaCasa(opts.dia.geral)}).`,
    });
  }
  return r;
}
