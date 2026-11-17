// Planejamento automático do dia — PURO (tests/unit/planejador.test.ts).
// Encaixa tarefas nos horários livres da janela do dia, respeitando compromissos (com folga antes e
// depois), o horário atual e pausas: nunca mais de `focoMax` minutos de tarefas seguidas sem uma pausa
// de pelo menos `pausa` minutos.

export interface Ocupado {
  inicio: number; // minutos desde 00:00 (local)
  fim: number;
}

export interface TarefaParaPlanejar {
  id: string;
  durationMin: number;
  priority: number; // 1 alta … 3 baixa
  dueDay: string | null; // "AAAA-MM-DD"
}

export interface OpcoesPlano {
  janelaInicio: number;
  janelaFim: number;
  ocupados: Ocupado[];
  tarefas: TarefaParaPlanejar[];
  agoraMin?: number | null; // se o dia é hoje, começa depois de agora
  folgaCompromisso?: number; // minutos livres antes/depois de um compromisso
  folgaTarefa?: number; // minutos entre duas tarefas
  focoMax?: number;
  pausa?: number;
  passo?: number;
}

export interface Encaixe {
  id: string;
  inicio: number;
  fim: number;
}

export interface Plano {
  encaixes: Encaixe[];
  semLugar: string[];
}

export function ordenarTarefas<T extends TarefaParaPlanejar>(tarefas: T[]): T[] {
  return [...tarefas].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const da = a.dueDay ?? "9999-12-31";
    const db = b.dueDay ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    if (a.durationMin !== b.durationMin) return b.durationMin - a.durationMin;
    return a.id < b.id ? -1 : 1;
  });
}

const sobrepoe = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export function planejarDia(o: OpcoesPlano): Plano {
  const folgaC = o.folgaCompromisso ?? 10;
  const folgaT = o.folgaTarefa ?? 5;
  const focoMax = o.focoMax ?? 90;
  const pausa = o.pausa ?? 15;
  const passo = o.passo ?? 5;

  let inicio = o.janelaInicio;
  if (o.agoraMin != null) inicio = Math.max(inicio, Math.ceil(o.agoraMin / passo) * passo);

  const bloqueios = o.ocupados.map((b) => ({ inicio: b.inicio - folgaC, fim: b.fim + folgaC }));
  const encaixes: Encaixe[] = [];
  const semLugar: string[] = [];

  // Sequência de tarefas encostadas (separadas por menos que a pausa) que passa por [t0, t1).
  const corrida = (t0: number, t1: number): number => {
    let ini = t0;
    let fim = t1;
    let mudou = true;
    const usados = new Set<Encaixe>();
    let total = t1 - t0;
    while (mudou) {
      mudou = false;
      for (const e of encaixes) {
        if (usados.has(e)) continue;
        if (e.fim <= ini && ini - e.fim < pausa) {
          usados.add(e);
          total += e.fim - e.inicio;
          ini = e.inicio;
          mudou = true;
        } else if (e.inicio >= fim && e.inicio - fim < pausa) {
          usados.add(e);
          total += e.fim - e.inicio;
          fim = e.fim;
          mudou = true;
        }
      }
    }
    return total;
  };

  for (const t of ordenarTarefas(o.tarefas)) {
    const dur = Math.max(5, Math.round(t.durationMin));
    let colocado = false;
    for (let t0 = inicio; t0 + dur <= o.janelaFim; t0 += passo) {
      const t1 = t0 + dur;
      if (bloqueios.some((b) => sobrepoe(t0, t1, b.inicio, b.fim))) continue;
      if (encaixes.some((e) => sobrepoe(t0, t1, e.inicio - folgaT, e.fim + folgaT))) continue;
      // Tarefa longa sozinha é aceita; o que não pode é emendar várias passando do foco máximo.
      const run = corrida(t0, t1);
      if (run > dur && run > focoMax) continue;
      encaixes.push({ id: t.id, inicio: t0, fim: t1 });
      colocado = true;
      break;
    }
    if (!colocado) semLugar.push(t.id);
  }

  encaixes.sort((a, b) => a.inicio - b.inicio);
  return { encaixes, semLugar };
}

/** Minutos livres da janela (fora de compromissos), para mostrar "você tem 3 h livres". */
export function minutosLivres(janelaInicio: number, janelaFim: number, ocupados: Ocupado[]): number {
  let livres = 0;
  for (let m = janelaInicio; m < janelaFim; m++) {
    if (!ocupados.some((b) => m >= b.inicio && m < b.fim)) livres++;
  }
  return livres;
}
