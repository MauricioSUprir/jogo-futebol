// Registro de TODA falta marcada numa partida 11×11 (pedido do dono, 15/10: "faltas muito forçadas e sem sentido"),
// com o contexto do lance tirado do estado ANTES do passo em que ela nasceu (o passo mexe nos corpos: a falta corta a
// velocidade de quem sofreu). O time 0 é o do humano, jogado por um "modelo" de jogador (determinístico, sem sorteio):
//   'demo'      a IA joga pelo controlado (entradaDemoPartida) — a partida IA × IA;
//   'persegue'  com o adversário com a bola (ou a bola solta), analógico na bola e CORRER a mais de 4 m dela (o jogador
//               típico de celular); com a bola no próprio time, a demo;
//   'pressao'   'persegue' + PRESSÃO segurado o tempo todo em que o adversário tem a bola;
//   'dividida'  'persegue' + DIVIDIDA tocada (borda) com a bola a ≤ 1,5 m do controlado, no máximo a cada 0,4 s;
//   'tudo'      'persegue' + PRESSÃO + DIVIDIDA (o jogador que aperta tudo);
//   'dribla'    'persegue' na defesa + com a bola no pé do controlado, 3 s conduzindo para o gol em zigue-zague (CORRER
//               de 1 em 1 s) antes de devolver para a demo (passe/chute) — é onde a IA faz falta NELE.
// Bola parada, bola na mão e goleiro: a demo (como a pessoa que deixa a cobrança para a IA).
//
// Cada falta: {sem, modelo, tick, min, origem, motivo, grau, cartao, area, timeDef, controlado (o def é o controlado do
// humano, jogado pela pessoa), chamado (o def é o companheiro chamado pela PRESSÃO: ramo 'pressaoHumano' no tick), ramo
// (o ramo da IA do def), chegada ('frente'/'lado'/'tras' pela direção do condutor), vDef, vCond, vFecha (velocidade de
// aproximação ao longo da linha def → condutor; > 0 = fechando), vRel (|v_def − v_cond|), dDefCond, dDefBola, dCondBola,
// condLento (condutor abaixo de ACOES.boteIA.vParado sem tocar na bola há semToque s), encostada (a bola encostada no
// def com os dois andando juntos: o caso do boteIA), alcanceBola (a bola ao alcance do pé do def: ≤ ACOES.boteIA.alcance
// + 0,1 m — havia disputa pela bola), paraBola (o def ia na direção da bola: cos ≥ 0,5 entre a velocidade dele e o
// caminho até ela, a ≥ 1 m/s), condTocou (o condutor tocou na bola no último 0,1 s), vEntra (a velocidade do PRÓPRIO def
// na direção do condutor), forca (a força do contato que o def fez: min(vEntra, vFecha)⁺ — o defensor que recua ou só
// acompanha não entra no homem; o condutor que trava na frente dele não é carga de quem estava atrás) e forcaImpacto (a
// maior força nos últimos 0,33 s: a colisão dos corpos zera a aproximação no passo do choque, então a força de agora
// sai ~0 depois do contato), forcaContato (a maior força nos últimos 0,33 s só com os corpos encostando, ≤ 0,75 m, ou a de
// agora com o defensor a ≤ 1,2 m antes ou depois da locomoção do passo: a força do contato que o árbitro do teste usa;
// mais longe, 0), dDepois (a distância def → condutor depois da locomoção do passo)}.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MODELOS = ['demo', 'persegue', 'pressao', 'dividida', 'tudo', 'dribla'];

export async function carregarLogica(JS) {
  const imp = f => import(pathToFileURL(path.join(JS, f)).href);
  const [P, S, CFG, F] = await Promise.all([imp('partida.js'), imp('sim.js'), imp('config.js'), imp('faltas.js')]);
  return { P, S, CFG, F };
}

/** Entrada do controlado do time 0 pelo modelo (st: estado do modelo, por partida). */
export function entradaModelo(L, m, modelo, st) {
  const { P, S, CFG } = L;
  const { BOTAO, PASSO } = CFG;
  // (a demo só é calculada quando é a entrada: ela anda o estado da IA do controlado, e a pessoa não faz isso)
  const demo = () => P.entradaDemoPartida(m);
  if (modelo === 'demo') return demo();
  const j = S.jogadorPorId(m, m.controlado[0]);
  if (!j || j.posicao === 'GOL') return demo();
  if (m.parada && !m.parada.rolou) return demo();
  if (m.naMao != null) return demo();
  const dono = m.posse != null ? S.jogadorPorId(m, m.posse) : null;
  if (dono && dono.time === 0) {
    if (modelo === 'dribla' && dono === j) {
      if (st.conduz !== j.id) { st.conduz = j.id; st.desde = m.tick; }
      const t = (m.tick - st.desde) * PASSO;
      if (t < 3) {
        const gx = m.ataca[0] * 52.5;
        const base = Math.atan2(-j.z * 0.5, gx - j.x);
        const r = base + (Math.floor(t / 0.7) % 2 ? 0.6 : -0.6);
        return { x: Math.cos(r), z: Math.sin(r), botoes: Math.floor(t) % 2 ? BOTAO.CORRER : 0 };
      }
    }
    return demo();
  }
  st.conduz = -1;
  const b = m.bola.p;
  const dx = b.x - j.x, dz = b.z - j.z, d = Math.hypot(dx, dz) || 1;
  let botoes = d > 4 ? BOTAO.CORRER : 0;
  if (dono && dono.time === 1) {
    if (modelo === 'pressao' || modelo === 'tudo') botoes |= BOTAO.PRESSAO;
    if ((modelo === 'dividida' || modelo === 'tudo') && d <= 1.5 && m.tick - (st.ultDiv ?? -1e9) >= Math.round(0.4 / PASSO)) {
      botoes |= BOTAO.DIVIDIDA; st.ultDiv = m.tick;
    }
  }
  return { x: dx / d, z: dz / d, botoes };
}

/** Foto do estado antes do passo (só o que o registro usa). */
function foto(m, st) {
  const js = new Map();
  for (const j of m.jogadores) js.set(j.id, { x: j.x, z: j.z, vx: j.vx, vz: j.vz, rumo: j.rumo, ramo: j.ia?.ramo ?? '', iaTick: j.ia?.tick ?? -9, ult: j.cond?.ult ? j.cond.ult.tick : -1e9, par: j.par, time: j.time });
  return { tick: m.tick, js, bx: m.bola.p.x, bz: m.bola.p.z, by: m.bola.p.y, posse: m.posse, controlado: m.controlado[0], trocaTick: st.trocaTick, ult: m.ultimoToque ? { ...m.ultimoToque } : null };
}

/** Força do contato de d em c (objetos da foto): min(vEntra, vFecha), ≥ 0. */
function forcaFoto(d, c) {
  const lx = c.x - d.x, lz = c.z - d.z, l = Math.hypot(lx, lz) || 1;
  const vEntra = (d.vx * lx + d.vz * lz) / l;
  const vFecha = ((d.vx - c.vx) * lx + (d.vz - c.vz) * lz) / l;
  return { vEntra, forca: Math.max(0, Math.min(vEntra, vFecha)) };
}

function contexto(L, m, f0, e, sem, modelo, anel) {
  const { CFG, F, P } = L;
  const { ACOES, PASSO } = CFG;
  const d = f0.js.get(e.def), c = f0.js.get(e.id);
  const r = { sem, modelo, tick: f0.tick, min: P.minutoDeJogo ? P.minutoDeJogo(m) : null, origem: e.origem, motivo: e.motivo, grau: e.grau, cartao: e.cartao, area: e.area, timeDef: d ? d.time : null };
  if (!d || !c) return r;
  r.controlado = f0.controlado === e.def && d.time === 0;
  // s desde que o controle passou para ele (a trombada com a corrida que ele herdou da IA)
  r.desdeTroca = r.controlado && f0.trocaTick != null ? (f0.tick - f0.trocaTick) * PASSO : null;
  r.ramo = d.iaTick >= f0.tick - 1 ? d.ramo : '';
  r.chamado = r.ramo === 'pressaoHumano';
  // chegada pela mesma conta do faltas.js (objetos com os campos que ela lê)
  r.chegada = F.chegada({ x: d.x, z: d.z }, { x: c.x, z: c.z, vx: c.vx, vz: c.vz, rumo: c.rumo });
  r.vDef = Math.hypot(d.vx, d.vz); r.vCond = Math.hypot(c.vx, c.vz);
  const lx = c.x - d.x, lz = c.z - d.z, l = Math.hypot(lx, lz) || 1;
  r.vFecha = ((d.vx - c.vx) * lx + (d.vz - c.vz) * lz) / l;
  r.vRel = Math.hypot(d.vx - c.vx, d.vz - c.vz);
  r.dDefCond = l;
  r.dDefBola = Math.hypot(f0.bx - d.x, f0.bz - d.z);
  r.dCondBola = Math.hypot(f0.bx - c.x, f0.bz - c.z);
  const B = ACOES.boteIA;
  r.condLento = r.vCond < B.vParado && !((f0.tick - c.ult) * PASSO < B.semToque);
  r.encostada = r.dDefBola <= B.encostada && r.vRel <= B.encostadaVrel && r.chegada !== 'tras';
  r.alcanceBola = r.dDefBola <= B.alcance + 0.1 && f0.by < 0.5;
  r.paraBola = r.vDef >= 1 && ((d.vx * (f0.bx - d.x) + d.vz * (f0.bz - d.z)) / (r.vDef * (r.dDefBola || 1))) >= 0.5;
  // o condutor tocou na bola no último 0,1 s (ela saindo do pé dele)
  r.condTocou = (f0.tick - c.ult) * PASSO < 0.1;
  const fa = forcaFoto(d, c);
  r.vEntra = fa.vEntra; r.forca = fa.forca;
  // (a de agora só com o defensor a ≤ 1,2 m do condutor: mais longe, não há contato possível). A distância vale também
  // depois da locomoção deste passo: o jogo decide o bote com os corpos já andados (sim.js passoCorpo → colisaoCorpos →
  // boteIA) e a foto é de antes — fechando a 6–7 m/s, 0,1 m de diferença
  const lp = Math.hypot((c.x + c.vx * PASSO) - (d.x + d.vx * PASSO), (c.z + c.vz * PASSO) - (d.z + d.vz * PASSO));
  r.dDepois = lp;
  let fi = fa.forca, fc = Math.min(l, lp) <= 1.2 ? fa.forca : 0;
  for (const g of anel) {
    const dd = g.js.get(e.def), cc = g.js.get(e.id);
    if (!dd || !cc) continue;
    const f = forcaFoto(dd, cc).forca;
    fi = Math.max(fi, f);
    // encostando (corpos a ≤ 2 raios + 0,15 m: o passo do choque ou o anterior a ele)
    if (Math.hypot(cc.x - dd.x, cc.z - dd.z) <= 0.75) fc = Math.max(fc, f);
  }
  r.forcaImpacto = fi;
  // a força do CONTATO (o árbitro independente do teste): a de agora ou a de quando os corpos encostaram nos últimos
  // 0,33 s — a aproximação de longe que freou antes de chegar não conta
  r.forcaContato = fc;
  return r;
}

/**
 * Roda as partidas e devolve {faltas: [...], partidas: [{sem, modelo, faltas, amarelos, vermelhos, penaltis, botes,
 * divididas, ticksJogo}]}. opc: {sementes, modelos (um por partida, em rodízio), min (minutos por tempo)}.
 */
export async function registrarFaltas(JS, { sementes, modelos = ['demo'], min = 4, botesLimpos = false } = {}) {
  const L = await carregarLogica(JS);
  const { P } = L;
  const faltas = [], partidas = [], limpos = botesLimpos ? [] : null;
  sementes.forEach((sem, k) => {
    const modelo = modelos[k % modelos.length];
    const m = P.criarPartida({ semente: sem, minutosPorTempo: min });
    const st = {};
    const R = { sem, modelo, ctrl: -1, faltas: 0, amarelos: 0, vermelhos: 0, penaltis: 0, roubadas: 0, divididas: 0, ticksJogo: 0 };
    const N = Math.round(2 * min * 60 * 60) + 6000;
    const anel = [];
    for (let i = 0; i < N && m.partida.estado !== 'fim'; i++) {
      if (m.controlado[0] !== R.ctrl) { R.ctrl = m.controlado[0]; st.trocaTick = m.tick; }
      const f0 = foto(m, st);
      anel.push(f0); if (anel.length > 20) anel.shift();
      const ev = P.passoPartida(m, entradaModelo(L, m, modelo, st));
      if (m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou)) R.ticksJogo++;
      for (const e of ev) {
        if (e.tipo === 'falta') { R.faltas++; faltas.push(contexto(L, m, f0, e, sem, modelo, anel)); }
        else if (e.tipo === 'cartao') { if (e.cor === 'vermelho') R.vermelhos++; else R.amarelos++; }
        else if (e.tipo === 'penaltiMarcado') R.penaltis++;
        else if (e.tipo === 'roubada') {
          R.roubadas++;
          // o bote limpo da IA (opc.limpos): o mesmo contexto da falta, para comparar
          if (limpos && e.ia && f0.posse != null) limpos.push(contexto(L, m, f0, { def: e.id, id: f0.posse, origem: 'boteLimpo' }, sem, modelo, anel));
        }
        else if (e.tipo === 'dividida') R.divididas++;
      }
    }
    partidas.push(R);
  });
  return { faltas, partidas, limpos };
}
