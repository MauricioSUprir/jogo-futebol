// Autor do gol (HUD do "GOL!"): conta PURA (sem three.js nem DOM), só lendo os eventos da simulação, como o
// resto do estádio (não mexe no mundo nem no hash). Testada em Node (tools/teste-torcida.mjs).
//
// Antes o "GOL!" usava ev.autor = m.ultimoToque, que só muda em chute, passe, cabeceio, espalmada, roubada e
// dividida — condução e domínio não contam: um gol que entrou depois da condução de um adversário saía com o
// autor errado e sem "Gol contra" (contraprova M5). Aqui o autor é quem tocou por último DE VERDADE, pela
// ordem dos eventos de toque de cada passo (TOQUES, inclusive o toque da condução e o domínio; a dividida
// perdida não toca na bola).
//
// Convenção das súmulas para desvio: chute do time que marcou, depois só desvio/defesa do adversário (bateu
// no corpo, o goleiro espalmou para dentro) e gol → o gol é de quem chutou (não é gol contra). Qualquer outro
// toque de verdade no meio (passe, condução, domínio) quebra essa ligação.
// Sem alocar por passo: os registros são objetos fixos reaproveitados (ativo = false quando vazio).

export const TOQUES = new Set(['toque', 'chute', 'passe', 'cabeceio', 'dominioAereo', 'defesa', 'bateuCorpo', 'roubada', 'dividida']);
const DESVIO = new Set(['defesa', 'bateuCorpo']);

const reg = () => ({ ativo: false, id: null, tipo: '', tick: 0, time: null });

export function criarAutorGol() {
  return { ultimo: reg(), chute: reg(), gol: { ativo: false, tick: 0, time: null, id: null, contra: false, desvio: false } };
}

/** Mundo novo: esquece tudo. */
export function zerarAutorGol(est) {
  est.ultimo.ativo = false; est.chute.ativo = false; est.gol.ativo = false;
}

function marcar(r, id, tipo, tick, time) { r.ativo = true; r.id = id; r.tipo = tipo; r.tick = tick; r.time = time; }

/**
 * Os eventos de UM passo, na ordem (o mesmo array de m.eventos; nada é alterado). timeDe(id) → 0 | 1 | null.
 * Se o passo tem um gol, preenche est.gol = {ativo, tick, time, id, contra, desvio} e devolve true.
 */
export function autorEventos(est, eventos, tick, timeDe) {
  let teveGol = false;
  for (const e of eventos) {
    const tipo = e.tipo;
    if (TOQUES.has(tipo) && e.id != null && !(tipo === 'dividida' && !e.ganhou)) {
      const time = timeDe(e.id);
      marcar(est.ultimo, e.id, tipo, tick, time);
      if (tipo === 'chute' || tipo === 'cabeceio') marcar(est.chute, e.id, tipo, tick, time);
      else if (est.chute.ativo && !(DESVIO.has(tipo) && time !== est.chute.time)) est.chute.ativo = false;
    } else if (tipo === 'gol') {
      autorDoGol(est, e, tick, timeDe, est.gol);
      teveGol = true;
    } else if (tipo === 'saida' || tipo === 'recomeco') {
      est.ultimo.ativo = false; est.chute.ativo = false;
    }
  }
  return teveGol;
}

/** Autor de verdade de um gol ({tipo: 'gol', time, autor}) em out {ativo, tick, time, id, contra, desvio}. */
export function autorDoGol(est, ev, tick, timeDe, out = {}) {
  let id = est.ultimo.ativo ? est.ultimo.id : (ev.autor ?? null);
  let desvio = false;
  if (id != null && ev.time != null && timeDe(id) !== ev.time && est.chute.ativo && est.chute.time === ev.time) {
    // chute de quem marcou e só desvio/defesa do adversário depois: gol de quem chutou
    id = est.chute.id;
    desvio = true;
  }
  const t = id != null ? timeDe(id) : null;
  out.ativo = true; out.tick = tick; out.time = ev.time ?? null; out.id = id;
  out.contra = t != null && ev.time != null && t !== ev.time; out.desvio = desvio;
  return out;
}
