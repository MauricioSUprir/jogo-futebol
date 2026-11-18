// FITNESS CENTER — regras puras (sem banco nem DOM): catálogos, carga, ritmo, estatísticas do futebol,
// evolução da carga e os alertas de recuperação. O sistema prioriza evolução saudável e descanso:
// nenhum texto daqui incentiva treinar mais.
import { diaDaSemana, intervaloDeDias, somaDias, type ChaveDia } from "./datas";

// ───────────── Catálogos ─────────────

export const TIPOS_ATIVIDADE = {
  musculacao: "Musculação",
  cardio: "Cardio",
  futebol: "Futebol",
} as const;
export type TipoAtividade = keyof typeof TIPOS_ATIVIDADE;

export const GRUPOS_MUSCULARES: Record<string, string> = {
  peito: "Peito",
  costas: "Costas",
  pernas: "Pernas",
  ombros: "Ombros",
  bracos: "Braços",
  core: "Core / abdômen",
  corpo_todo: "Corpo todo",
  mobilidade: "Mobilidade",
  outro: "Outro",
};

export const TIPOS_CARDIO: Record<string, string> = {
  caminhada: "Caminhada",
  corrida: "Corrida",
  bicicleta: "Bicicleta",
  esteira: "Esteira",
  natacao: "Natação",
  outro: "Outro",
};

export const TIPOS_FUTEBOL: Record<string, string> = {
  partida: "Partida",
  treino: "Treino técnico",
  recreativo: "Futebol recreativo",
};

export const POSICOES: Record<string, string> = {
  goleiro: "Goleiro",
  zagueiro: "Zagueiro",
  lateral: "Lateral",
  volante: "Volante",
  meia: "Meia",
  ponta: "Ponta",
  atacante: "Atacante",
};

/** Escala de esforço percebido CR-10 (Borg), com legenda curta. */
export const ESFORCO: Record<number, string> = {
  0: "Repouso",
  1: "Muito, muito leve",
  2: "Leve",
  3: "Moderado",
  4: "Um pouco forte",
  5: "Forte",
  6: "Forte+",
  7: "Muito forte",
  8: "Muito forte+",
  9: "Quase máximo",
  10: "Máximo",
};

export function nomeEsforco(e: number | null | undefined): string {
  return e === null || e === undefined ? "—" : `${e} · ${ESFORCO[e] ?? ""}`;
}

/** Esforço usado na conta da carga quando a pessoa não informou. */
export const ESFORCO_PADRAO = 5;

export function nomeSubtipo(tipo: string, subtipo: string | null | undefined): string {
  if (tipo === "cardio") return TIPOS_CARDIO[subtipo ?? ""] ?? "Cardio";
  if (tipo === "futebol") return TIPOS_FUTEBOL[subtipo ?? ""] ?? "Futebol";
  return "Musculação";
}

// ───────────── Carga, ritmo e números ─────────────

/** Carga da sessão (método do esforço percebido): duração × esforço (0–10). */
export function cargaSessao(duracaoMin: number, esforco: number | null | undefined): number {
  return Math.max(0, Math.round(duracaoMin)) * (esforco ?? ESFORCO_PADRAO);
}

/** Ritmo em min/km ("5:30 /km"); null sem distância. */
export function ritmo(duracaoMin: number, km: number | null | undefined): string | null {
  if (!km || km <= 0 || duracaoMin <= 0) return null;
  const segPorKm = Math.round((duracaoMin * 60) / km);
  const m = Math.floor(segPorKm / 60);
  const s = segPorKm % 60;
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

/** Duração legível: "45 min", "1 h 20 min". */
export function formatarDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Número com no máximo 1 casa, em pt-BR ("62,5"). */
export function num(v: number, casas = 1): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

/** Primeiro número de um texto de repetições ("8-12" → 8; "30 s" → 30). */
export function repsSugeridas(reps: string): number | null {
  const m = /\d+/.exec(reps);
  return m ? Number(m[0]) : null;
}

// ───────────── Semana de treinamento ─────────────

export interface FichaSemana {
  id: string;
  nome: string;
  dias: number; // bitmask: bit 0 = domingo … bit 6 = sábado
}

export interface DiaSemana {
  dia: ChaveDia;
  dow: number;
  fichas: { id: string; nome: string }[];
  recuperacao: boolean; // nenhum treino planejado = dia de recuperação
}

/** A grade de 7 dias a partir de `inicio` (a segunda-feira da semana) com as fichas de cada dia. */
export function gradeDaSemana(fichas: FichaSemana[], inicio: ChaveDia): DiaSemana[] {
  return intervaloDeDias(inicio, somaDias(inicio, 6)).map((dia) => {
    const dow = diaDaSemana(dia);
    const doDia = fichas.filter((f) => (f.dias >> dow) & 1).map((f) => ({ id: f.id, nome: f.nome }));
    return { dia, dow, fichas: doDia, recuperacao: doDia.length === 0 };
  });
}

/** Bitmask a partir de dias da semana (0–6). */
export function mascaraDias(dias: number[]): number {
  return dias.filter((d) => d >= 0 && d <= 6).reduce((m, d) => m | (1 << d), 0);
}

export function diasDaMascara(mascara: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => (mascara >> d) & 1);
}

// ───────────── Musculação: evolução da carga ─────────────

export interface SerieFeita {
  dia: ChaveDia;
  sessaoId: string;
  exercicio: string;
  serie: number;
  reps: number | null;
  carga: number | null;
}

/** Normaliza o nome do exercício para comparar sessões ("Supino reto " = "supino reto"). */
export function chaveExercicio(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

export interface PontoCarga {
  dia: ChaveDia;
  sessaoId: string;
  maior: number; // maior carga da sessão (kg)
  reps: number | null; // repetições feitas com a maior carga
  volume: number; // soma de carga × repetições
}

/** Maior carga por sessão de um exercício, em ordem de data. */
export function evolucaoCarga(series: SerieFeita[], exercicio: string): PontoCarga[] {
  const alvo = chaveExercicio(exercicio);
  const porSessao = new Map<string, PontoCarga>();
  for (const s of series) {
    if (chaveExercicio(s.exercicio) !== alvo || s.carga === null) continue;
    const p = porSessao.get(s.sessaoId) ?? { dia: s.dia, sessaoId: s.sessaoId, maior: -1, reps: null, volume: 0 };
    if (s.carga > p.maior || (s.carga === p.maior && (s.reps ?? 0) > (p.reps ?? 0))) {
      p.maior = s.carga;
      p.reps = s.reps;
    }
    p.volume += s.carga * (s.reps ?? 0);
    porSessao.set(s.sessaoId, p);
  }
  return [...porSessao.values()].sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
}

/** Os exercícios já feitos, do mais recente para o mais antigo (um nome por exercício). */
export function exerciciosFeitos(series: SerieFeita[]): string[] {
  const vistos = new Map<string, { nome: string; dia: ChaveDia }>();
  for (const s of series) {
    const k = chaveExercicio(s.exercicio);
    const v = vistos.get(k);
    if (!v || s.dia > v.dia) vistos.set(k, { nome: s.exercicio.trim(), dia: s.dia });
  }
  return [...vistos.values()].sort((a, b) => (a.dia < b.dia ? 1 : -1)).map((v) => v.nome);
}

/**
 * Cargas da última vez de cada exercício, por série (para já preencher a sessão nova).
 * `series` em qualquer ordem; vale a sessão mais recente em que o exercício apareceu.
 */
export function cargasDaUltimaVez(series: SerieFeita[]): Map<string, { reps: number | null; carga: number | null }[]> {
  const ultima = new Map<string, { dia: ChaveDia; sessaoId: string }>();
  for (const s of series) {
    const k = chaveExercicio(s.exercicio);
    const u = ultima.get(k);
    if (!u || s.dia > u.dia || (s.dia === u.dia && s.sessaoId > u.sessaoId)) ultima.set(k, { dia: s.dia, sessaoId: s.sessaoId });
  }
  const r = new Map<string, { reps: number | null; carga: number | null }[]>();
  for (const s of [...series].sort((a, b) => a.serie - b.serie)) {
    const k = chaveExercicio(s.exercicio);
    if (ultima.get(k)?.sessaoId !== s.sessaoId) continue;
    const lista = r.get(k) ?? [];
    lista.push({ reps: s.reps, carga: s.carga });
    r.set(k, lista);
  }
  return r;
}

// ───────────── Futebol ─────────────

export interface JogoFutebol {
  dia: ChaveDia;
  subtipo: string; // partida | treino | recreativo
  minutos: number | null;
  duracao: number;
  gols: number | null;
  assistencias: number | null;
  posicao: string | null;
  nota: number | null; // desempenho percebido 1–10
}

export interface EstatFutebol {
  jogos: number; // partidas + recreativo
  partidas: number;
  recreativos: number;
  treinos: number;
  minutos: number;
  gols: number;
  assistencias: number;
  /** Participações em gol (gols + assistências) a cada 90 min; null com menos de 90 min no total. */
  por90: number | null;
  mediaDesempenho: number | null;
  porPosicao: { posicao: string; jogos: number; minutos: number; gols: number; assistencias: number }[];
}

/** Minutos jogados: os informados; sem eles, a duração da atividade. */
export function minutosJogados(j: Pick<JogoFutebol, "minutos" | "duracao">): number {
  return j.minutos ?? j.duracao;
}

export function estatisticasFutebol(lista: JogoFutebol[]): EstatFutebol {
  const jogos = lista.filter((j) => j.subtipo !== "treino");
  const minutos = jogos.reduce((s, j) => s + minutosJogados(j), 0);
  const gols = jogos.reduce((s, j) => s + (j.gols ?? 0), 0);
  const assistencias = jogos.reduce((s, j) => s + (j.assistencias ?? 0), 0);
  const notas = jogos.map((j) => j.nota).filter((n): n is number => n !== null);
  const pos = new Map<string, EstatFutebol["porPosicao"][number]>();
  for (const j of jogos) {
    const k = j.posicao ?? "—";
    const p = pos.get(k) ?? { posicao: k, jogos: 0, minutos: 0, gols: 0, assistencias: 0 };
    p.jogos++;
    p.minutos += minutosJogados(j);
    p.gols += j.gols ?? 0;
    p.assistencias += j.assistencias ?? 0;
    pos.set(k, p);
  }
  return {
    jogos: jogos.length,
    partidas: jogos.filter((j) => j.subtipo === "partida").length,
    recreativos: jogos.filter((j) => j.subtipo === "recreativo").length,
    treinos: lista.length - jogos.length,
    minutos,
    gols,
    assistencias,
    por90: minutos >= 90 ? ((gols + assistencias) / minutos) * 90 : null,
    mediaDesempenho: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
    porPosicao: [...pos.values()].sort((a, b) => b.jogos - a.jogos || b.minutos - a.minutos),
  };
}

/** Temporada = ano civil. */
export function temporadaDe(dia: ChaveDia): number {
  return Number(dia.slice(0, 4));
}

/** Estatísticas por temporada (mais recente primeiro). */
export function porTemporada(lista: JogoFutebol[]): { temporada: number; est: EstatFutebol }[] {
  const anos = [...new Set(lista.map((j) => temporadaDe(j.dia)))].sort((a, b) => b - a);
  return anos.map((temporada) => ({ temporada, est: estatisticasFutebol(lista.filter((j) => temporadaDe(j.dia) === temporada)) }));
}

/** Jogos (partidas + recreativo) por mês de uma temporada: 12 posições, jan = 0. */
export function jogosPorMes(lista: JogoFutebol[], temporada: number): number[] {
  const meses = Array(12).fill(0) as number[];
  for (const j of lista) {
    if (j.subtipo === "treino" || temporadaDe(j.dia) !== temporada) continue;
    meses[Number(j.dia.slice(5, 7)) - 1]++;
  }
  return meses;
}

// ───────────── Semana e minutos ─────────────

export interface AtividadeResumo {
  dia: ChaveDia;
  tipo: string;
  duracao: number;
  esforco: number | null;
}

/** Minutos por tipo num intervalo de dias. */
export function minutosPorTipo(lista: AtividadeResumo[], de: ChaveDia, ate: ChaveDia): Record<TipoAtividade, number> {
  const r: Record<TipoAtividade, number> = { musculacao: 0, cardio: 0, futebol: 0 };
  for (const a of lista) if (a.dia >= de && a.dia <= ate && a.tipo in r) r[a.tipo as TipoAtividade] += a.duracao;
  return r;
}

/** Soma de minutos por semana (blocos de 7 dias terminando em `ate`), da mais antiga à atual. */
export function minutosPorSemana(lista: AtividadeResumo[], ate: ChaveDia, semanas: number, tipo?: string): { inicio: ChaveDia; minutos: number }[] {
  return Array.from({ length: semanas }, (_, i) => {
    const fim = somaDias(ate, -7 * (semanas - 1 - i));
    const inicio = somaDias(fim, -6);
    const minutos = lista.filter((a) => a.dia >= inicio && a.dia <= fim && (!tipo || a.tipo === tipo)).reduce((s, a) => s + a.duracao, 0);
    return { inicio, minutos };
  });
}

// ───────────── Alertas de recuperação ─────────────

export interface RegistroRecuperacao {
  dia: ChaveDia;
  descanso: boolean;
  cansaco: number | null; // 1–5
  recuperacao: number | null; // 1–5
  dor: number | null; // 1–5
  desconforto: string | null;
}

export interface Alerta {
  id: "seguidos" | "carga" | "cansaco" | "desconforto" | "equilibrio";
  tom: "atencao" | "positivo";
  texto: string;
}

/** Dias seguidos com atividade, terminando hoje (ou ontem, se hoje ainda não teve). Descanso marcado quebra. */
export function diasSeguidosComAtividade(lista: AtividadeResumo[], recup: RegistroRecuperacao[], hoje: ChaveDia): number {
  const comAtividade = new Set(lista.map((a) => a.dia));
  const descanso = new Set(recup.filter((r) => r.descanso).map((r) => r.dia));
  let dia = comAtividade.has(hoje) && !descanso.has(hoje) ? hoje : somaDias(hoje, -1);
  let n = 0;
  while (comAtividade.has(dia) && !descanso.has(dia)) {
    n++;
    dia = somaDias(dia, -1);
  }
  return n;
}

/** Carga dos últimos 7 dias e a média semanal das 3 semanas anteriores (null sem 3 semanas de histórico). */
export function cargaSemanal(lista: AtividadeResumo[], hoje: ChaveDia): { atual: number; media: number | null } {
  const soma = (de: ChaveDia, ate: ChaveDia) =>
    lista.filter((a) => a.dia >= de && a.dia <= ate).reduce((s, a) => s + cargaSessao(a.duracao, a.esforco), 0);
  const atual = soma(somaDias(hoje, -6), hoje);
  const primeira = lista.reduce<ChaveDia | null>((m, a) => (m === null || a.dia < m ? a.dia : m), null);
  // As 3 semanas anteriores (hoje-27 … hoje-7) precisam estar inteiras dentro do histórico registrado.
  if (primeira === null || primeira > somaDias(hoje, -27)) return { atual, media: null };
  const semanas = [0, 1, 2].map((i) => soma(somaDias(hoje, -13 - 7 * i), somaDias(hoje, -7 - 7 * i)));
  return { atual, media: semanas.reduce((s, x) => s + x, 0) / 3 };
}

export const LIMITE_SEGUIDOS = 6;
export const LIMITE_SALTO_CARGA = 1.5;

export function alertasRecuperacao(lista: AtividadeResumo[], recup: RegistroRecuperacao[], hoje: ChaveDia): Alerta[] {
  const alertas: Alerta[] = [];

  // (a) muitos dias seguidos sem descanso
  const seguidos = diasSeguidosComAtividade(lista, recup, hoje);
  if (seguidos >= LIMITE_SEGUIDOS) {
    alertas.push({
      id: "seguidos",
      tom: "atencao",
      texto: `${seguidos} dias seguidos com atividade. Que tal um dia de descanso? É na recuperação que o corpo fica mais forte.`,
    });
  }

  // (b) carga da semana bem acima do costume
  const carga = cargaSemanal(lista, hoje);
  if (carga.media !== null && carga.media > 0 && carga.atual > LIMITE_SALTO_CARGA * carga.media) {
    const pct = Math.round((carga.atual / carga.media - 1) * 100);
    alertas.push({
      id: "carga",
      tom: "atencao",
      texto: `A carga dos últimos 7 dias está ${pct}% acima da média das 3 semanas anteriores. Aumentar aos poucos ajuda a evitar lesões: vale segurar o ritmo e priorizar o descanso.`,
    });
  }

  // (c) cansaço alto ou recuperação baixa em 2 dos últimos 3 registros (das últimas 2 semanas)
  const recentes = recup
    .filter((r) => r.dia <= hoje && r.dia >= somaDias(hoje, -13) && (r.cansaco !== null || r.recuperacao !== null))
    .sort((a, b) => (a.dia < b.dia ? 1 : -1))
    .slice(0, 3);
  const pesados = recentes.filter((r) => (r.cansaco ?? 0) >= 4 || (r.recuperacao !== null && r.recuperacao <= 2)).length;
  if (pesados >= 2) {
    alertas.push({
      id: "cansaco",
      tom: "atencao",
      texto: "Você registrou cansaço alto ou pouca recuperação em dias seguidos. Um treino leve ou um dia de descanso, sono e água em dia costumam ajudar.",
    });
  }

  // (d) desconforto ou dor forte nos últimos 3 dias
  const doiu = recup.some(
    (r) => r.dia <= hoje && r.dia >= somaDias(hoje, -2) && ((r.desconforto ?? "").trim() !== "" || (r.dor ?? 0) >= 4),
  );
  if (doiu) {
    alertas.push({
      id: "desconforto",
      tom: "atencao",
      texto: "Você registrou desconforto ou dor nos últimos dias. Pegue leve com essa região; se continuar, pare e converse com um adulto de confiança ou um profissional de saúde.",
    });
  }

  // Elogio: semana com treino e descanso equilibrados
  if (alertas.length === 0) {
    const semana = intervaloDeDias(somaDias(hoje, -6), hoje);
    const ativos = new Set(lista.filter((a) => a.dia >= semana[0] && a.dia <= hoje).map((a) => a.dia));
    const diasAtivos = semana.filter((d) => ativos.has(d)).length;
    const descansos = semana.length - diasAtivos;
    if (diasAtivos >= 2 && diasAtivos <= 5 && descansos >= 2) {
      alertas.push({
        id: "equilibrio",
        tom: "positivo",
        texto: `Semana equilibrada: ${diasAtivos} dias de atividade e ${descansos} de descanso. Recuperar também faz parte do treino.`,
      });
    }
  }
  return alertas;
}
