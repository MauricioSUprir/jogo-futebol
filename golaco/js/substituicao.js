// Cena de SUBSTITUIÇÃO (pedido do dono de 12/10: "quando tiver substituição, quero que tenha a cena de substituição, só
// jogador saindo e entrando, e embaixo, no modelo, a informação de quem entra e quem sai"). PURA: sem three.js nem DOM,
// sem m.rng e sem Math.random — testada em Node (tools/teste-substituicao.mjs) e desenhada pela página (main.js) no
// lugar dos jogadores da simulação. Contrato em CONTRATOS.md ("Cena de substituição"); pesquisa em PESQUISA-ESTADIO.md
// §11; constantes em config.js SUBST.
//
// O mundo NÃO é tocado: no passo das trocas os 22 são COPIADOS (a receita da comemoração: comemoracao.js copiaJogador/
// criarAtor) para um mundo de cena à parte, que anda com a MESMA locomoção do jogo (jogador.js passoCorpo, passoPassada,
// passoPeDesenhado; anim.js alturaQuadril e pose). A cópia de quem ENTRA (na simulação ele já está na vaga) vira quem
// SAI (o mesmo lugar na lista, o id e o uniforme dele); quem entra espera na grama entre a lateral e as placas, no
// meio-campo do lado de cá, ao lado do QUARTO ÁRBITRO com a placa no alto. Os outros freiam até parar e, parados, ficam
// fixos (não custam mais nada).
//
// Regra 3.3 da IFAB: quem sai vai pelo ponto MAIS PERTO do contorno (lateral z = ±34 ou linha de fundo x = ±52,5; na
// linha de fundo nunca pela boca do gol: |z| ≥ SUBST.golRaio) e só depois quem entra cruza a lateral, pela linha do
// meio-campo (|x| ≤ 1 m), com o sinal da placa. Roteiro (s desde o começo da cena):
//   SAI  (2,4 s; 2,2 com 2 pares ou mais): câmera de ala de FORA da linha, no rosto de quem sai, que já entra no quadro
//        andando firme (2,2 m/s, pré-rolagem invisível) a 3,0–3,6 m da linha, cruza por volta de 1,5 s, aplaude (palmas da
//        torcida do time dele: o evento sai na hora do cruzamento) e para ~1,2 m além da linha;
//   SAI2 (1,6 s; só com 2 pares ou mais): o mesmo com o 2º par (os outros saem fora do quadro, ao mesmo tempo);
//   ENTRA (2,6 s): câmera baixa no gramado do lado de cá, olhando o quarto árbitro com a placa e o banco ao fundo; a
//        partir de 0,5 s os reservas cruzam a lateral um a um (0,35 s), cada um só depois do par dele ter saído, e
//        trotam para a vaga;
//   fim: a página corta seco para a câmera de TV (a vaga com o reserva só aparece depois do corte).
// Câmera (planoCameraSubst): por CORTES (o nome do plano muda); dentro do plano só gira (pan) e fecha/abre o zoom para o
// corpo inteiro ficar acima da faixa ENTRA/SAI (os pés a SUBST.pes da altura do quadro), o assunto no terço esquerdo (o
// "Pular" fica à direita). Variações (distância de quem sai, lado da câmera) pelo hash do (tick, id) — comemoracao.js
// hashGol. Nada é alocado por tick (vetores e objetos reaproveitados).
import { PASSO, CAMPO, SUBST, BOLA, COMEMORACAO } from './config.js';
import { criarJogador, passoCorpo, passoPassada, passoPeDesenhado } from './jogador.js';
import { pose, alturaQuadril, J, NJ, ik } from './anim.js';
import { criarAtor, separar, maoEm, gesto, hashGol, limitarCamera, ajustarCelular } from './comemoracao.js';
import { fichaDe, atributosDe } from './elenco.js';
import { solidoEm } from './estadio-forma.js';

const S = SUBST;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const PLACAS_X = MX + CAMPO.entorno, PLACAS_Z = MZ + CAMPO.entorno;
const s60 = s => Math.round(s / PASSO);
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
const u32 = h => h / 4294967296;

/** Tipos de ator. */
export const TIPOS = ['campo', 'sai', 'entra', 'quarto'];
const CAMPO_T = 0, SAI_T = 1, ENTRA_T = 2, QUARTO_T = 3;
/** Nomes dos planos, na ordem. */
export const PLANOS = ['sai', 'sai2', 'entra', 'fim'];

// ------------------------------------------------------------------------------------------------ plano
/** Distância do ponto (px, pz) ao segmento (ax, az)–(bx, bz). */
function distSeg(px, pz, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 1e-12 ? clamp(((px - ax) * ex + (pz - az) * ez) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
}

/**
 * Ponto do contorno mais perto de (x, z) (Regra 3.3): a projeção na lateral (z = ±34) ou na linha de fundo (x = ±52,5),
 * a mais perto; na linha de fundo com |z| < golRaio (o gol e a rede) o ponto vai para |z| = golRaio do lado dele.
 * Devolve {x, z, nx, nz (normal para FORA), linha: 'lateral' | 'fundo', dist}.
 */
export function pontoDeSaida(x, z) {
  const px = clamp(x, -MX, MX), pz = clamp(z, -MZ, MZ);
  const dl = MZ - Math.abs(pz), df = MX - Math.abs(px);
  if (dl <= df) {
    const sz = pz >= 0 ? 1 : -1;
    return { x: px, z: sz * MZ, nx: 0, nz: sz, linha: 'lateral', dist: dl };
  }
  const sx = px >= 0 ? 1 : -1, sz = pz >= 0 ? 1 : -1;
  return { x: sx * MX, z: Math.abs(pz) < S.golRaio + S.golFolga ? sz * (S.golRaio + S.golFolga) : pz, nx: sx, nz: 0, linha: 'fundo', dist: df };
}

/**
 * Plano da cena (só LÊ o mundo). pares = [{time, sai, entra}] na ordem dos eventos do passo. opc = {timeHumano (o time
 * dele primeiro; padrão 0), posAntes(id) → {x, z} | null (a posição de quem saiu no tick anterior: o anel do replay na
 * página; sem ela, a do reserva no mundo)}. Devolve {tick, pares (ordenados, com o ponto de saída, a distância do 1º
 * quadro e os números), planos [{nome, par, t0, t1}], duracao (s)}.
 */
export function planejarSubstituicao(m, pares, opc = {}) {
  const th = opc.timeHumano ?? 0;
  const lista = pares.map((p, i) => ({ ...p, i })).sort((a, b) => (a.time === th ? 0 : 1) - (b.time === th ? 0 : 1) || a.i - b.i);
  const n = lista.length;
  const planos = [];
  if (n <= 1) {
    planos.push({ nome: 'sai', par: 0, t0: 0, t1: S.sai });
    planos.push({ nome: 'entra', par: -1, t0: S.sai, t1: S.sai + S.entra });
  } else {
    planos.push({ nome: 'sai', par: 0, t0: 0, t1: S.sai1de2 });
    planos.push({ nome: 'sai2', par: 1, t0: S.sai1de2, t1: S.sai1de2 + S.sai2 });
    planos.push({ nome: 'entra', par: -1, t0: S.sai1de2 + S.sai2, t1: S.sai1de2 + S.sai2 + S.entra });
  }
  const duracao = Math.min(S.teto, planos[planos.length - 1].t1);
  // onde cada reserva espera (time 0: x +; time 1: x −) e o caminho dele até cruzar a lateral pelo meio-campo: quem sai
  // pelo lado de cá não para em cima disso (nem do quarto árbitro)
  const nPorTime = [0, 0];
  const xCruza = pontoDeCruzar(m, lista);
  const espera = lista.map(p => {
    const s = p.time === 1 ? -1 : 1, q = nPorTime[p.time === 1 ? 1 : 0]++;
    return { x: s * (S.espera.x0 + S.espera.passo * q), z: S.espera.z, lado: s, cx: xCruza[p.time === 1 ? 1 : 0] };
  });
  const obst = [[S.quarto.x, S.quarto.z, S.quarto.x, S.quarto.z]];
  for (const e of espera) {
    obst.push([e.x, e.z, e.cx, e.z]);
    obst.push([e.cx, e.z, e.cx, MZ - 2]);
  }
  const ps = [];
  lista.forEach((p, k) => {
    const novo = m.jogadores.find(j => j.id === p.entra);
    const antes = opc.posAntes ? opc.posAntes(p.sai) : null;
    const x0 = antes ? antes.x : novo ? novo.x : 0, z0 = antes ? antes.z : novo ? novo.z : 0;
    const h = hashGol(m.tick, p.sai);
    const sd = pontoDeSaida(x0, z0);
    // o plano em que ele aparece: o 1º par no SAI, o 2º no SAI2; do 3º em diante saem fora do quadro junto com o 2º
    const pl = k === 0 ? planos[0] : planos[1];
    const durPl = pl.t1 - pl.t0;
    // distância da linha no 1º quadro do plano dele (3,0–3,6 m, com 1 tick de folga nas pontas): cruza antes do fim do
    // plano (com folga de 0,15 s)
    const d0min = S.distSai[0] + 0.05, dMax = Math.min(S.distSai[1] - 0.05, S.velSai * (durPl - 0.15));
    const d0 = lerp(d0min, Math.max(d0min, dMax), u32(h));
    // quem sai sem plano (3º par em diante) pela mesma reta de um que já sai (o goleiro e um zagueiro pela mesma ponta
    // da pequena área): 1,1 m à frente dele (cruza antes; nunca um dentro do outro)
    let adianta = 0;
    if (k >= 2) for (const q of ps) if (q.k >= 1 && q.saida.nx === sd.nx && q.saida.nz === sd.nz && Math.hypot(q.saida.x - sd.x, q.saida.z - sd.z) < 1.2) adianta += 1.1;
    // onde para depois de cruzar: alemLinha além da linha; de lado (ao longo dela) se outro já parou ali (≥ 1 m entre
    // eles) ou se ali é o lugar dos reservas e do quarto árbitro (≥ 1 m deles e do caminho deles; o trecho até lá a
    // ≥ 0,8 m de quem espera); nunca na boca do gol nem além da bandeirinha
    const tx = -sd.nz, tz = sd.nx;
    const sgn = sd.linha === 'fundo' ? (Math.sign(sd.z * tz) || 1) : ((h >>> 11) & 1 ? 1 : -1);
    let para = null;
    procura: for (const alem of [S.alemLinha, S.alemLinha * 0.75]) {
      for (let q = 0; q <= 16; q++) {
        const dl = q === 0 ? 0 : (q % 2 ? 1 : -1) * Math.ceil(q / 2) * sgn;
        const px = sd.x + sd.nx * alem + tx * dl, pz = sd.z + sd.nz * alem + tz * dl;
        if (Math.abs(px) > MX - 0.5 && Math.abs(pz) < S.golRaio) continue;
        if (sd.linha === 'lateral' ? Math.abs(px) > MX - 0.5 : Math.abs(pz) > MZ - 0.5) continue;
        if (ps.some(o => Math.hypot(o.para.x - px, o.para.z - pz) < 1.0)) continue;
        if (obst.some(o => distSeg(px, pz, o[0], o[1], o[2], o[3]) < 1.0)) continue;
        if (obst.some(o => o[0] === o[2] && o[1] === o[3] ? false : distSeg(o[0], o[1], sd.x, sd.z, px, pz) < 0.8)) continue;
        if (distSeg(S.quarto.x, S.quarto.z, sd.x, sd.z, px, pz) < 0.8) continue;
        para = { x: px, z: pz };
        break procura;
      }
    }
    para ??= { x: sd.x + sd.nx * S.alemLinha, z: sd.z + sd.nz * S.alemLinha };
    const fs = fichaDe(p.sai), fe = fichaDe(p.entra);
    ps.push({
      k, time: p.time, sai: p.sai, entra: p.entra, goleiro: !!(novo && novo.posicao === 'GOL'),
      x0, z0, saida: sd, d0, adianta, para, espera: espera[k], tPlano: pl.t0, comPlano: k < 2, hash: h,
      // a hora em que ele cruza a linha (s da cena): a d0 − adianta dela no 1º quadro do plano dele, a velSai
      tCruza: pl.t0 + (d0 - adianta) / S.velSai,
      rentaGol: sd.linha === 'fundo' && Math.abs(sd.z) < S.golRaio + 1.5,
      vaga: { x: novo ? novo.x : 0, z: novo ? novo.z : 0 },
      numSai: fs?.num ?? null, numEntra: fe?.num ?? null,
    });
  });
  return { tick: m.tick, pares: ps, planos, duracao, timeHumano: th };
}

/**
 * O x em que os reservas de cada time cruzam a lateral (Regra 3.3: pela linha do meio-campo, |x| ≤ 1 m): ±SUBST.cruzaX
 * (time 0: x +; time 1: x −), ou outro ponto da lista SUBST.cruzaOpcoes se alguém do jogo está parado ali (o cobrador do
 * lateral no meio-campo: antes o reserva o contornava e cruzava a 1,01 m). Do outro lado da linha do meio só se o outro
 * time não troca (os reservas dele esperam ali). Sem nenhum livre, o mais longe de todos. Devolve [x do time 0, x do 1].
 */
function pontoDeCruzar(m, lista) {
  const entram = new Set(lista.map(p => p.entra));
  const troca = [lista.some(p => p.time !== 1), lista.some(p => p.time === 1)];
  const obs = [];
  for (const j of m.jogadores) {
    if (entram.has(j.id)) continue; // na cena, a vaga dele é de quem sai (vai para longe)
    const v = Math.hypot(j.vx, j.vz), ox = j.x + j.vx * v / 12, oz = j.z + j.vz * v / 12; // onde para (freando a 6 m/s²)
    if (Math.abs(ox) < 3 && oz > MZ - 2.6 && oz < MZ + 1.6) obs.push(ox);
  }
  const out = [0, 0];
  for (const t of [0, 1]) {
    const s = t === 1 ? -1 : 1;
    let melhor = s * S.cruzaX, folga = -Infinity;
    for (const k of S.cruzaOpcoes) {
      if (k < 0 && troca[1 - t]) continue;
      const x = s * k;
      let f = Infinity;
      for (const ox of obs) f = Math.min(f, Math.abs(ox - x));
      if (f >= S.cruzaFolga) { melhor = x; break; }
      if (f > folga + 1e-9) { folga = f; melhor = x; }
    }
    out[t] = melhor;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ atores e cena
/** Desloca o jogador (corpo e pés: o desenho e os alvos) em (dx, dz). */
function levar(j, dx, dz) {
  j.x += dx; j.z += dz;
  for (const p of j.pes) { p.x += dx; p.z += dz; p.lx += dx; p.lz += dz; p.gx += dx; p.gz += dz; p.tx += dx; p.tz += dz; p.bx += dx; p.bz += dz; }
}

/** Um passo da locomoção de um jogador sozinho (a pré-rolagem): corpo, passada, pé desenhado e quadril. */
function passoSozinho(j, mF, dx, dz, vel, rumo) {
  passoCorpo(j, dx, dz, vel, rumo, j.par, PASSO, false);
  passoPassada(j, false, PASSO, null, null);
  passoPeDesenhado(j, mF, PASSO);
  j.quadril = alturaQuadril(j, mF);
}

function novoAtor(j, i, tipo) {
  const a = criarAtor(j, i);
  a.tipo = tipo; a.par = -1; a.kit = null; a.parado = 0; a.poseFixa = false;
  a.fase = 'espera'; a.cruzou = -1; a.cx = 0; a.cz = 0; a.tSai = 0; a.ordem = -1; a.k0 = 0;
  return a;
}

/**
 * Cena a partir do mundo no passo das trocas (só LÊ o mundo: cópias). plano = planejarSubstituicao(...). Devolve o estado
 * da cena; passoCenaSubst anda um tick. A pré-rolagem de quem sai (ele já entra no plano andando) roda aqui, uma vez.
 */
export function criarCenaSubst(plano, m) {
  const b = m.bola.p;
  const idsEntra = new Set(plano.pares.map(p => p.entra));
  // mini-mundo: o que a pose e a passada leem. A bola parada onde está; segurada por quem não está em campo na cena
  // (o reserva que virou o cobrador do lateral), no chão
  const segurada = (m.naMao != null && idsEntra.has(m.naMao)) || (m.parada && m.parada.tipo === 'lateral' && !m.parada.rolou && idsEntra.has(m.parada.cobrador));
  const mF = {
    tick: m.tick, posse: null, naMao: m.naMao != null && !idsEntra.has(m.naMao) ? m.naMao : null,
    parada: m.parada && !idsEntra.has(m.parada.cobrador) ? { tipo: m.parada.tipo, rolou: m.parada.rolou, cobrador: m.parada.cobrador } : null,
    voo: null,
    bola: { p: { x: b.x, y: segurada ? BOLA.raio : b.y, z: b.z }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
    jogadores: [], ataca: m.ataca,
  };
  const atores = [];
  const porEntra = new Map(plano.pares.map((p, k) => [p.entra, k]));
  for (let i = 0; i < m.jogadores.length; i++) {
    const j = m.jogadores[i];
    const k = porEntra.get(j.id);
    if (k == null) {
      const a = novoAtor(j, i, CAMPO_T);
      a.j.mergulho = null;
      atores.push(a);
      continue;
    }
    // a vaga do reserva na simulação: na cena, quem sai (o id e o uniforme dele), andando para o ponto de saída
    const p = plano.pares[k];
    const sd = p.saida, rumo = Math.atan2(sd.nz, sd.nx);
    const js = criarJogador(p.sai, 0, 0, rumo, atributosDe(fichaDe(p.sai) ?? {}), p.time);
    js.posicao = 'MEI'; // anda como jogador de linha (o goleiro também: as mãos "prontas" são do jogo); o uniforme vem da lista
    const a = novoAtor(js, i, SAI_T);
    a.id = p.sai; a.time = p.time; a.goleiro = p.goleiro; a.par = k; a.fase = 'anda';
    atores.push(a);
  }
  // reservas esperando (do lado do time: time 0 x +, time 1 x −) e o quarto árbitro com a placa
  plano.pares.forEach((p, k) => {
    const e = p.espera;
    const j = criarJogador(p.entra, e.x, e.z, -Math.PI / 2, atributosDe(fichaDe(p.entra) ?? {}), p.time);
    j.posicao = 'MEI';
    const a = novoAtor(j, atores.length, ENTRA_T);
    a.goleiro = p.goleiro; a.par = k; a.ordem = k; a.lado = e.lado;
    atores.push(a);
  });
  const jq = criarJogador(S.idQuarto, S.quarto.x, S.quarto.z, -Math.PI / 2, {}, 2);
  jq.posicao = 'MEI';
  const quarto = novoAtor(jq, atores.length, QUARTO_T);
  quarto.kit = 'arbitro'; quarto.time = 2; quarto.goleiro = false;
  atores.push(quarto);
  for (const a of atores) mF.jogadores.push(a.j);

  const c = {
    plano, mF, atores, quarto, sai: atores.filter(a => a.tipo === SAI_T).sort((x, y) => x.par - y.par),
    entra: atores.filter(a => a.tipo === ENTRA_T).sort((x, y) => x.ordem - y.ordem),
    k: 0, acum: 0, alfa: 0, acabou: false, kFim: s60(plano.duracao), ticksUltimo: 0,
    tEntra: plano.planos.find(p => p.nome === 'entra').t0,
    bola: mF.bola.p, eventos: [], cams: plano.planos.map(() => null), planoAtual: 0,
    _d: { dx: 1, dz: 0, vel: 0, rumo: 0 },
  };
  // quem sai: o 1º par entra no plano já andando — pré-rolagem: anda sozinho do repouso (fora de tudo) até a velocidade
  // firme e é levado para ficar a d0 da linha no 1º quadro; os outros saem do repouso no começo da cena (ao fundo do 1º
  // plano), de longe o bastante para, no plano deles, estarem a d0 da linha (o arranque atrasa SUBST.arranque m)
  const N = s60(S.preRolagem);
  for (const a of c.sai) {
    const p = plano.pares[a.par], sd = p.saida, j = a.j;
    let D;
    if (a.par === 0) {
      for (let t = 0; t < N; t++) passoSozinho(j, mF, sd.nx, sd.nz, S.velSai, Math.atan2(sd.nz, sd.nx));
      D = p.d0;
    } else D = p.d0 + S.velSai * p.tPlano - S.arranque - p.adianta;
    levar(j, sd.x - sd.nx * D - j.x, sd.z - sd.nz * D - j.z);
  }
  mF.tick = m.tick;
  for (const a of atores) {
    a.j.quadril = a.j.quadril ?? alturaQuadril(a.j, mF);
    poseAtor(c, a, 0);
    a.ant.set(a.atu);
    a.x0 = a.x1 = a.j.x; a.z0 = a.z1 = a.j.z; a.r0 = a.r1 = a.j.rumo;
    // quem já estava parado e plantado na simulação (o teleportado da montagem, o cobrador no ponto) fica fixo já: ninguém
    // precisa frear e a pose não muda mais (o quarto árbitro também: os braços com a placa são da pose fixa)
    const j = a.j;
    if ((a.tipo === CAMPO_T || a.tipo === QUARTO_T) && Math.hypot(j.vx, j.vz) < 0.02 && j.pes[0].apoio && j.pes[1].apoio && !j.pes[0].pendente && !j.pes[1].pendente
      && Math.abs(j.quadril - alturaQuadril(j, mF)) < 1e-6) { a.fixo = true; a.poseFixa = true; }
  }
  c.cams[0] = escolherCamera(c, 0);
  return c;
}

// ------------------------------------------------------------------------------------------------ passo
function para(c, vel, rumo) {
  const d = c._d;
  d.dx = Math.cos(rumo); d.dz = Math.sin(rumo); d.vel = vel; d.rumo = rumo;
  return d;
}
function rumoA(c, ex, ez, vel, rumo) {
  const d = c._d, l = Math.hypot(ex, ez) || 1;
  d.dx = ex / l; d.dz = ez / l; d.vel = vel; d.rumo = rumo;
  return d;
}

function desejo(c, a, t) {
  const j = a.j;
  if (a.tipo === SAI_T) {
    const p = c.plano.pares[a.par], sd = p.saida, rumo = Math.atan2(sd.nz, sd.nx);
    if (a.cruzou < 0) {
      // até a linha: na reta da normal, pelo ponto mais perto (o desvio de lado volta devagar), sem frear; no horário
      // (p.tCruza): quem atrasou (contornou alguém parado na reta) apressa o passo até velSaiMax para cruzar quando o
      // plano manda; adiantado, anda firme a velSai (contraprova de 15/10: contornando um zagueiro parado ele perdeu 0,4 m
      // e cruzou 0,07 s depois do fim do plano dele)
      const lado = (j.x - sd.x) * -sd.nz + (j.z - sd.z) * sd.nx;
      const falta = -((j.x - sd.x) * sd.nx + (j.z - sd.z) * sd.nz), resta = p.tCruza - t;
      const vel = resta > PASSO ? clamp(falta / resta, S.velSai, S.velSaiMax) : S.velSaiMax;
      return rumoA(c, sd.nx - (-sd.nz) * lado * 0.8, sd.nz - sd.nx * lado * 0.8, vel, rumo);
    }
    // cruzou: para no ponto dele (alemLinha além da linha; de lado se outro já parou ali), freando
    const ex = p.para.x - j.x, ez = p.para.z - j.z, falta = Math.hypot(ex, ez);
    if (falta <= 0.04) { a.chegou = true; return para(c, 0, rumo); }
    return rumoA(c, ex, ez, Math.min(S.velSai, Math.sqrt(2 * S.freioSai * falta)), rumo);
  }
  if (a.tipo === ENTRA_T) {
    if (a.fase === 'espera') {
      const pr = c.sai.find(x => x.par === a.par);
      const hora = c.tEntra + S.sinal + S.escalona * a.ordem;
      if (t >= hora && (!pr || pr.cruzou >= 0)) a.fase = 'vai';
      else return para(c, 0, -Math.PI / 2);
    }
    if (a.fase === 'vai') {
      // pela grama, ao longo da lateral, até a frente da linha do meio-campo (freando para virar)
      const ex = c.plano.pares[a.par].espera.cx - j.x, ez = S.espera.z - j.z, d = Math.hypot(ex, ez);
      if (Math.abs(ex) < 0.25) a.fase = 'cruza';
      else return rumoA(c, ex, ez, Math.min(S.velEntra, 0.5 + 1.8 * d), Math.atan2(ez, ex));
    }
    if (a.fase === 'cruza') {
      // cruza a lateral pela linha do meio-campo (Regra 3.3: |x| ≤ 1 m), reto para dentro do campo
      const ex = c.plano.pares[a.par].espera.cx - j.x, ez = MZ - 1.2 - j.z;
      if (j.z < MZ - 0.3) a.fase = 'campo';
      else return rumoA(c, ex, ez, S.velEntra, Math.atan2(ez, ex));
    }
    const v = c.plano.pares[a.par].vaga, ex = v.x - j.x, ez = v.z - j.z, d = Math.hypot(ex, ez);
    if (d < 0.3) return para(c, 0, j.rumo);
    return rumoA(c, ex, ez, Math.min(S.velEntra, d * 1.6), Math.atan2(ez, ex));
  }
  // os outros (e o quarto árbitro): freiam até parar, no rumo de agora — mas ninguém para nas placas: quem vem correndo
  // para fora do campo e não para antes delas (a freada: v²/(2·freio)) tira só a velocidade para fora e escorrega ao
  // longo delas (contraprova de 15/10: um jogador correndo a 7,7 m/s para fora da lateral no tiro de meta parava 0,8 m
  // dentro da faixa das placas)
  const v = Math.hypot(j.vx, j.vz);
  if (v > 0.3 && !a.fixo) {
    const k = v / (2 * j.par.freio), px = j.x + j.vx * k, pz = j.z + j.vz * k;
    const tx = Math.abs(px) > LIM_X && px * j.vx > 0 ? 0 : j.vx, tz = Math.abs(pz) > LIM_Z && pz * j.vz > 0 ? 0 : j.vz;
    if (tx !== j.vx || tz !== j.vz) {
      const vt = Math.hypot(tx, tz);
      return vt > 1e-6 ? rumoA(c, tx, tz, vt, j.rumo) : para(c, 0, j.rumo);
    }
  }
  return para(c, 0, j.rumo);
}
// até onde quem freia pode ir (o centro do corpo): 0,9 m antes das placas
const LIM_X = PLACAS_X - 0.9, LIM_Z = PLACAS_Z - 0.9;

/**
 * Desvio de quem anda (Reynolds, "Steering Behaviors", GDC 1999: evitar obstáculos): alguém à frente (até 1,8 m) e perto
 * da reta (< 0,8 m de lado) empurra o rumo pedido para o lado contrário, mais forte quanto mais perto. Escreve em d.
 * fora ≠ 0 (o z do ponto de saída rente ao gol): só vale o desvio que AFASTA do meio do gol (|z| maior).
 */
function desviar(c, a, d, fora = 0) {
  const j = a.j;
  let lat = 0;
  for (const b of c.atores) {
    if (b === a) continue;
    const ex = b.j.x - j.x, ez = b.j.z - j.z;
    const u = ex * d.dx + ez * d.dz;
    if (u <= 0 || u > 1.8) continue;
    const w = -ex * d.dz + ez * d.dx; // de lado (+ = à esquerda do rumo)
    if (Math.abs(w) >= 0.8) continue;
    const k = ((0.8 - Math.abs(w)) / 0.8) * (1 - u / 1.8);
    lat += (w >= 0 ? -1 : 1) * k;
  }
  // (à esquerda do rumo = (−dz, dx): o z anda dx·lat; para fora do gol é o sinal de z)
  if (fora) lat = d.dx * fora > 0 ? Math.max(0, lat) : Math.min(0, lat);
  if (lat === 0) return;
  lat = clamp(lat, -1, 1) * 0.9;
  const nx = d.dx + -d.dz * lat, nz = d.dz + d.dx * lat, l = Math.hypot(nx, nz) || 1;
  d.dx = nx / l; d.dz = nz / l;
}

/** Ordem da vez entre dois que andam colados (o menor não cede): quem sai antes de quem entra, o par de antes primeiro. */
function ordemVez(a) { return (a.tipo === SAI_T ? 0 : 100) + a.par; }

/** Ator que anda neste tick (fixo = parado e plantado: não roda a locomoção nem a pose). */
function anda(a) { return !a.fixo; }

/** Um tick (1/60 s) da cena. Devolve false se ela já acabou. */
export function passoCenaSubst(c) {
  if (c.acabou) return false;
  const t = c.k * PASSO, mF = c.mF, at = c.atores;
  for (let i = 0; i < at.length; i++) {
    const a = at[i];
    if (!anda(a)) continue;
    const d = desejo(c, a, t);
    // (quem sai pela linha de fundo rente ao gol só desvia para o lado de FORA do gol: para dentro, o desvio o poria na
    // boca do gol; sem desvio nenhum ele trombava em quem já parou na reta e cruzava a linha atrasado)
    if (d.vel > 0.3 && (a.tipo === ENTRA_T || a.tipo === SAI_T)) desviar(c, a, d, a.tipo === SAI_T && c.plano.pares[a.par].rentaGol ? c.plano.pares[a.par].saida.z : 0);
    passoCorpo(a.j, d.dx, d.dz, d.vel, d.rumo, a.j.par, PASSO, false);
  }
  // ninguém dentro de ninguém: quem sai e quem entra têm a vez (não cedem a quem anda ou freia: esse sai do caminho);
  // colado em alguém já parado (fixo), quem anda é que cede (contorna); dois com a vez colados: cede o que vem depois na
  // ordem (quem sai antes de quem entra; o par de antes primeiro) — antes nenhum dos dois cedia e um entrava no outro
  const min = S.separacao;
  for (const a of c.sai) a.prio = !a.fixo && !a.chegou;
  for (const a of c.entra) a.prio = !a.fixo && (a.fase === 'vai' || a.fase === 'cruza');
  for (const a of at) {
    if (!a.prio) continue;
    for (const b of at) {
      if (b === a || !(b.fixo || (b.prio && ordemVez(b) < ordemVez(a)))) continue;
      if (Math.hypot(b.j.x - a.j.x, b.j.z - a.j.z) < min + 0.05) { a.prio = false; break; }
    }
  }
  for (const a of at) if (a.prio) a.fixo = true;
  separar(c, min);
  for (const a of at) if (a.prio) { a.fixo = false; a.prio = false; }
  for (let i = 0; i < at.length; i++) if (anda(at[i])) passoPassada(at[i].j, false, PASSO, null, null);
  for (let i = 0; i < at.length; i++) if (anda(at[i])) passoPeDesenhado(at[i].j, mF, PASSO);
  mF.tick++;
  c.k++;
  const tk = c.k * PASSO;
  for (let i = 0; i < at.length; i++) {
    const a = at[i], j = a.j;
    if (anda(a)) j.quadril = alturaQuadril(j, mF);
    // cruzou a linha? (quem sai: o contorno; quem entra: a lateral)
    if (a.tipo === SAI_T && a.cruzou < 0) {
      const sd = c.plano.pares[a.par].saida;
      const s1 = (j.x - sd.x) * sd.nx + (j.z - sd.z) * sd.nz;
      if (s1 >= 0) {
        const s0 = (a.x1 - sd.x) * sd.nx + (a.z1 - sd.z) * sd.nz, f = s0 < s1 ? -s0 / (s1 - s0) : 1;
        a.cruzou = c.k; a.cx = lerp(a.x1, j.x, f); a.cz = lerp(a.z1, j.z, f);
        // palmas da torcida do time dele (main.js: emocao.js, no relógio do desenho)
        c.eventos.push({ tipo: 'substituicao', cruzou: true, time: a.time, sai: a.id, entra: c.plano.pares[a.par].entra });
      }
    } else if (a.tipo === ENTRA_T && a.cruzou < 0 && j.z <= MZ && a.z1 > MZ) {
      const f = (a.z1 - MZ) / (a.z1 - j.z);
      a.cruzou = c.k; a.cx = lerp(a.x1, j.x, f); a.cz = MZ;
    }
    // parado e plantado por 0,2 s (o quadril assentado): fica fixo (quem sai e quem entra não: ainda vão andar ou
    // gesticular)
    if ((a.tipo === CAMPO_T || a.tipo === QUARTO_T) && !a.fixo) {
      const v = Math.hypot(j.vx, j.vz);
      if (v < 0.02 && j.pes[0].apoio && j.pes[1].apoio && !j.pes[0].pendente && !j.pes[1].pendente) { if (++a.parado >= 12) a.fixo = true; } else a.parado = 0;
    }
  }
  for (let i = 0; i < at.length; i++) {
    const a = at[i];
    if (a.fixo && a.poseFixa) continue; // parado: a pose não muda (ant = atu desde o 1º tick fixo)
    a.ant.set(a.atu);
    a.x0 = a.x1; a.z0 = a.z1; a.r0 = a.r1;
    if (a.fixo && a.tipo !== QUARTO_T) { a.poseFixa = true; continue; }
    poseAtor(c, a, tk);
    a.x1 = a.j.x; a.z1 = a.j.z; a.r1 = a.j.rumo;
    if (a.fixo) a.poseFixa = true;
  }
  // câmera do plano novo: escolhida no 1º tick dele (com as posições de agora)
  const pl = c.plano.planos;
  while (c.planoAtual + 1 < pl.length && tk >= pl[c.planoAtual + 1].t0 - 1e-9) {
    c.planoAtual++;
    c.cams[c.planoAtual] = escolherCamera(c, c.planoAtual);
  }
  if (c.k >= c.kFim) c.acabou = true;
  return true;
}

/**
 * Avança a cena dt s reais (o relógio do desenho: a página chama a cada quadro, parada na pausa). Roda os ticks inteiros
 * e guarda a sobra em alfa (o desenho interpola ant → atu). Devolve alfa; os ticks rodados ficam em c.ticksUltimo.
 */
export function avancarCenaSubst(c, dt) {
  c.ticksUltimo = 0;
  if (c.acabou) { c.alfa = 1; return 1; }
  c.acum += Math.max(0, dt);
  while (c.acum >= PASSO - 1e-9 && !c.acabou) { passoCenaSubst(c); c.acum -= PASSO; c.ticksUltimo++; }
  if (c.acum < 0) c.acum = 0;
  c.alfa = c.acabou ? 1 : Math.min(1, c.acum / PASSO);
  return c.alfa;
}

/** Tempo (s) da cena no estado desenhado. */
export function tempoCenaSubst(c) { return Math.max(0, c.k - 1 + c.alfa) * PASSO; }
/** Duração (s). */
export function duracaoCenaSubst(c) { return c.kFim * PASSO; }
/** Índice do plano no tempo t (s); planos.length = fim. */
export function planoEm(c, t) {
  const pl = c.plano.planos;
  if (c.acabou || t >= c.plano.duracao - 1e-9) return pl.length;
  for (let i = pl.length - 1; i >= 0; i--) if (t >= pl[i].t0 - 1e-9) return i;
  return 0;
}

// ------------------------------------------------------------------------------------------------ poses e gestos
const SUP = [J.pelve, J.lombar, J.peito, J.pescoco, J.cabeca, J.ombroE, J.cotoveloE, J.maoE, J.ombroD, J.cotoveloD, J.maoD, J.quadrilE, J.quadrilD];
// placa no alto: as mãos dos lados da placa (f, r para fora do ombro, y acima do ombro) e o cotovelo para fora
const G_PLACA = [0.1, 0.05, 0.43, 0, 1, -0.2];

/** Reserva esperando: o peso passa de um pé para o outro (o quadril vai de lado; os pés plantados, as pernas por IK). */
function trocaPeso(o, j, t, fase) {
  const d = 0.035 * Math.sin(2 * Math.PI * 0.55 * t + fase);
  const rx = -Math.sin(j.rumo), rz = Math.cos(j.rumo), fx = Math.cos(j.rumo), fz = Math.sin(j.rumo);
  for (let k = 0; k < SUP.length; k++) { const i = SUP[k] * 3; o[i] += rx * d; o[i + 2] += rz * d; }
  for (let p = 0; p < 2; p++) {
    const iQ = p ? J.quadrilD : J.quadrilE, iJ = p ? J.joelhoD : J.joelhoE, iT = p ? J.tornozeloD : J.tornozeloE;
    ik(o[iQ * 3], o[iQ * 3 + 1], o[iQ * 3 + 2], o[iT * 3], o[iT * 3 + 1], o[iT * 3 + 2], fx, 0.05, fz, o, iJ, iT);
  }
}

/** Palmas (as duas mãos à frente do rosto, abrindo e fechando a `freq` Hz) com peso w. */
function palmas(o, h, t, w) {
  if (w <= 0) return;
  const ab = 0.5 + 0.5 * Math.cos(2 * Math.PI * S.aplauso.freq * t);
  // r < 0: para dentro (as mãos perto do meio do corpo: a 3 cm dele fechadas, a 10 cm abertas)
  const r = -0.16 + 0.07 * ab;
  _g[0] = 0.3; _g[1] = r; _g[2] = 0.12; _g[3] = -0.2; _g[4] = 1; _g[5] = -0.6;
  gesto(o, h, -1, _g, null, 0, w);
  gesto(o, h, 1, _g, null, 0, w);
}
const _g = [0, 0, 0, 0, 0, 0];

function poseAtor(c, a, t) {
  const o = a.atu, j = a.j, h = j.rumo;
  pose(j, c.mF, o);
  if (a.tipo === SAI_T && a.cruzou >= 0) palmas(o, h, t, suave((t - a.cruzou * PASSO) / S.aplauso.entra));
  else if (a.tipo === ENTRA_T && a.fase === 'espera') trocaPeso(o, j, t, a.ordem * 1.7);
  else if (a.tipo === QUARTO_T) {
    gesto(o, h, -1, G_PLACA, null, 0, 1);
    gesto(o, h, 1, G_PLACA, null, 0, 1);
  }
}

/**
 * A placa do quarto árbitro no estado desenhado (out = {x, y, z, rumo}): no ponto médio das mãos + 0,10 m, de frente
 * para onde ele olha. pose = a pose desenhada (interpolada) do quarto árbitro.
 */
export function placaNasMaos(c, poseQ, out) {
  const o = poseQ ?? c.quarto.atu;
  out.x = (o[J.maoE * 3] + o[J.maoD * 3]) / 2;
  out.y = (o[J.maoE * 3 + 1] + o[J.maoD * 3 + 1]) / 2 + 0.1;
  out.z = (o[J.maoE * 3 + 2] + o[J.maoD * 3 + 2]) / 2;
  out.rumo = c.quarto.j.rumo;
  return out;
}

/**
 * O par mostrado na placa no tempo t (s da cena): passa de par em par a cada SUBST.placaTroca s, o do humano primeiro.
 * Devolve {indice, n, time, entra (número, verde), sai (número, vermelho), idEntra, idSai}.
 */
export function paresDaPlaca(c, t, out = {}) {
  const ps = c.plano.pares, n = ps.length;
  const i = n ? Math.floor(Math.max(0, t) / S.placaTroca) % n : 0;
  const p = ps[i];
  out.indice = i; out.n = n; out.time = p?.time ?? 0;
  out.entra = p?.numEntra ?? null; out.sai = p?.numSai ?? null; out.idEntra = p?.entra ?? null; out.idSai = p?.sai ?? null;
  out.corEntra = 'verde'; out.corSai = 'vermelho';
  return out;
}

// ------------------------------------------------------------------------------------------------ câmera
const SAMPLES = [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4];
const _pt = { x: 0, z: 0 };
/** Onde o ator vai estar (parado) daqui a pouco: quem freia para em v²/(2·6) m. */
function previsto(a, out) {
  const j = a.j, v = Math.hypot(j.vx, j.vz);
  const d = a.fixo || v < 0.05 ? 0 : (v * v) / 12;
  out.x = j.x + (v > 0.05 ? (j.vx / v) * d : 0); out.z = j.z + (v > 0.05 ? (j.vz / v) * d : 0);
  return out;
}
/** Posição do assunto do plano (quem sai / o 1º reserva) daqui a u s (a reta dele; aproximada). */
function assuntoEm(c, ip, u, out) {
  const pl = c.plano.planos[ip];
  if (pl.nome === 'entra') {
    const a = c.entra[0], j = a.j, v = c.plano.pares[a.par].vaga, xc = c.plano.pares[a.par].espera.cx;
    const t0 = S.sinal + S.escalona * a.ordem, dc = Math.hypot(xc - j.x, MZ - j.z);
    let s = Math.max(0, (u - t0)) * S.velEntra * 0.85;
    if (s <= dc) { const f = dc > 0 ? s / dc : 1; out.x = lerp(j.x, xc, f); out.z = lerp(j.z, MZ, f); return out; }
    s -= dc;
    const ex = v.x - xc, ez = v.z - MZ, l = Math.hypot(ex, ez) || 1;
    s = Math.min(s, l);
    out.x = xc + (ex / l) * s; out.z = MZ + (ez / l) * s;
    return out;
  }
  return caminhoSai(c, c.sai.find(x => x.par === pl.par) ?? c.sai[0], u, out);
}
/**
 * Onde quem sai vai estar daqui a u s (aproximado): pela normal até a linha e depois até o ponto em que ele para (o
 * `para` do plano: de lado ao longo da linha se outro já parou ali — antes a conta seguia a normal e a câmera ficava
 * colada em quem parava de lado).
 */
function caminhoSai(c, a, u, out) {
  const p = c.plano.pares[a.par], sd = p.saida, j = a.j;
  const s0 = (j.x - sd.x) * sd.nx + (j.z - sd.z) * sd.nz;
  const s = s0 + S.velSai * u;
  if (s <= 0) { out.x = sd.x + sd.nx * s; out.z = sd.z + sd.nz * s; return out; }
  const ex = p.para.x - sd.x, ez = p.para.z - sd.z, l = Math.hypot(ex, ez) || 1, f = Math.min(1, s / l);
  out.x = sd.x + ex * f; out.z = sd.z + ez * f;
  return out;
}
/** Assunto do plano ip (o ator). */
function assunto(c, ip) {
  const pl = c.plano.planos[ip];
  if (!pl || pl.nome === 'entra') return c.entra[0];
  return c.sai.find(x => x.par === pl.par) ?? c.sai[0];
}

/** Custo da câmera em (cx, cz): gente perto da lente (inválida) e gente entre a lente e o assunto (oclusão). */
function custoCamera(c, ip, cx, cz, dur) {
  const sujeito = assunto(c, ip);
  let oclusao = 0, duro = 0;
  for (const a of c.atores) {
    if (a === sujeito) continue;
    const p = previsto(a, _pt);
    // quem também anda (os outros que saem e os reservas): a reta deles nas amostras
    const movel = a.tipo === SAI_T || a.tipo === ENTRA_T;
    for (const u of SAMPLES) {
      if (u > dur + 1e-9) break;
      let ax = p.x, az = p.z;
      if (movel) {
        if (a.tipo === SAI_T) {
          caminhoSai(c, a, u, _pt);
          ax = _pt.x; az = _pt.z;
        } else if (c.plano.planos[ip].nome === 'entra') {
          // os outros reservas: entre a espera e o ponto de cruzar
          const f = clamp((u - S.sinal - S.escalona * a.ordem) / 1.0, 0, 1);
          ax = lerp(a.j.x, c.plano.pares[a.par].espera.cx, f); az = lerp(a.j.z, MZ - 0.5, f);
        }
      }
      const da = Math.hypot(ax - cx, az - cz);
      if (da < S.lenteMin + 0.5) { duro += S.lenteMin + 0.5 - da; continue; }
      const q = assuntoEm(c, ip, u, _q);
      const ex = q.x - cx, ez = q.z - cz, el2 = ex * ex + ez * ez || 1;
      const w = ((ax - cx) * ex + (az - cz) * ez) / el2;
      if (w > 0.05 && w < 0.97) {
        const lado = Math.hypot(ax - cx - ex * w, az - cz - ez * w);
        if (lado < 0.7) oclusao += 0.7 - lado;
      }
      // alguém grande no quadro (perto da lente e dentro do ângulo do plano): um corpo a 3 m enche a borda da tela
      if (da < 8 && w > 0) {
        const cosA = ((ax - cx) * ex + (az - cz) * ez) / (da * Math.sqrt(el2));
        if (cosA > 0.83) oclusao += (8 - da) * 0.5;
      }
    }
  }
  // o assunto também nunca colado na lente; no ENTRA (fov fixo) nunca mais perto do que a distância em que o corpo
  // inteiro cabe no quadro (com a vaga para o lado da lente ele vinha correndo para ela e a cabeça saía por cima)
  const dMin = c.plano.planos[ip].nome === 'entra' ? D_CABE_ENTRA : S.lenteMin + 1;
  for (const u of SAMPLES) {
    if (u > dur + 1e-9) break;
    const q = assuntoEm(c, ip, u, _q);
    const dq = Math.hypot(q.x - cx, q.z - cz);
    if (dq < dMin) duro += dMin - dq;
  }
  // alguém perto da lente: a câmera só fica se não houver outra — e então a que deixa todos mais longe
  return duro > 0 ? DURO * (1 + duro) + oclusao : oclusao;
}
const DURO = 1e6;
// distância (m) a partir da qual o corpo inteiro (1,95 m com folga) fica no quadro do fov fixo do plano ENTRA: os pés a
// SUBST.pes da altura (a inclinação do enquadrar) e a cabeça até a borda de cima (≈ 5,8 m). Com a cabeça só até
// SUBST.cabeca (6,5 m, ou 7,0 com folga) a câmera de sempre era trocada por uma mais longe sem precisar e a placa no
// celular caía de 50 para 39–44 px (teste-substituicao-tela T10)
const D_CABE_ENTRA = 1.95 / ((2 - 2 * S.pes) * Math.tan((S.camEntra.fov * Math.PI) / 360));
const _q = { x: 0, z: 0 };

/** Câmera de um plano: {x, y, z} (fixa no plano inteiro), escolhida no começo dele. */
function escolherCamera(c, ip) {
  const pl = c.plano.planos[ip];
  if (!pl) return null;
  const dur = pl.t1 - pl.t0;
  let melhor = null, menor = Infinity;
  const tentar = (x, y, z) => {
    if (Math.abs(x) > PLACAS_X - 0.5 || Math.abs(z) > PLACAS_Z - 0.5) return false;
    // nunca dentro do gol (nem da rede), da arquibancada, das placas ou dos bancos
    if (Math.abs(x) > MX - 0.5 && Math.abs(z) < S.golRaio) return false;
    if (solidoEm(x, y, z, 0.3, false)) return false;
    const custo = custoCamera(c, ip, x, z, dur);
    if (custo < menor - 1e-9) { menor = custo; melhor = { x, y, z }; }
    return custo <= 1e-9;
  };
  if (pl.nome === 'entra') {
    const E = S.camEntra, a = c.entra[0], v = c.plano.pares[a.par].vaga;
    // do lado contrário ao x da vaga (o reserva nunca corre na direção da lente)
    const lado = v.x >= 0 ? -1 : 1;
    for (const dx of [0, 1.5, -1.5, 3]) for (const z of [E.z, E.z - 1.5, E.z + 1.5, E.z - 3]) if (tentar(lado * (E.x + dx), E.y, z)) return melhor;
    for (const dx of [0, 1.5, 3]) for (const z of [E.z, E.z - 1.5, E.z - 3]) if (tentar(-lado * (E.x + dx), E.y, z)) return melhor;
    return melhor ?? { x: lado * E.x, y: E.y, z: E.z };
  }
  const a = assunto(c, ip), p = c.plano.pares[a.par], sd = p.saida, A = S.camSai;
  // ao longo da linha: tx/tz; o lado pelo hash, forçado para longe do gol (linha de fundo) e da bandeirinha
  const tx = -sd.nz, tz = sd.nx;
  let lado = (p.hash >>> 9) & 1 ? 1 : -1;
  const L = (A.lado[0] + A.lado[1]) / 2, F = (A.fora[0] + A.fora[1]) / 2;
  const ok = l => {
    const x = sd.x + tx * l * L, z = sd.z + tz * l * L;
    if (sd.linha === 'lateral') return Math.abs(x) <= MX - 3;
    return Math.abs(z) >= 6 && Math.abs(z) <= MZ - 3;
  };
  if (sd.linha === 'fundo') lado = Math.sign((sd.z || 1) * tz) || 1; // para longe do gol
  if (!ok(lado)) lado = -lado;
  for (const l of [lado, -lado]) {
    if (!ok(l)) continue;
    for (const Ld of [L, A.lado[0], A.lado[1]]) for (const Fd of [F, A.fora[0], A.fora[1]]) {
      const x = sd.x + tx * l * Ld + sd.nx * Fd, z = sd.z + tz * l * Ld + sd.nz * Fd;
      if (tentar(x, A.altura, z)) return melhor;
    }
  }
  // nenhuma livre (vários saindo pelo mesmo lado, os reservas e o quarto árbitro no meio-campo): mais longe ao longo da
  // linha e mais para fora (o zoom acompanha a distância); sem nenhuma livre, fica a menos ruim (custo duro: a que deixa
  // todos mais longe da lente) — antes ia para a posição padrão sem conferir ninguém
  const okPos = (x, z) => (sd.linha === 'lateral' ? Math.abs(x) <= MX - 3 : Math.abs(z) >= 6 && Math.abs(z) <= MZ - 3);
  for (const l of [lado, -lado]) {
    for (const Ld of A.longe) for (const Fd of [F, A.fora[0], A.fora[1], A.foraMax]) {
      const x = sd.x + tx * l * Ld + sd.nx * Fd, z = sd.z + tz * l * Ld + sd.nz * Fd;
      if (okPos(x, z) && tentar(x, A.altura, z)) return melhor;
    }
  }
  return melhor ?? { x: sd.x + tx * lado * L + sd.nx * F, y: A.altura, z: sd.z + tz * lado * L + sd.nz * F };
}

/**
 * Enquadra o assunto em (sx, sz) da câmera out.de: o corpo inteiro com os pés a SUBST.pes da altura do quadro (acima da
 * faixa embaixo) e a cabeça perto de SUBST.cabeca; o assunto no terço esquerdo (o "Pular" fica à direita). fov = null:
 * o zoom acompanha a distância (o corpo inteiro); senão o fov dado. No celular, o terço é o do ajustarCelular da
 * comemoração (o mesmo deslocamento do olhar).
 */
function enquadrar(out, sx, sz, fov, opc) {
  const cx = out.de[0], cy = out.de[1], cz = out.de[2];
  const d = Math.hypot(sx - cx, sz - cz) || 1;
  const ndcPe = 2 * S.pes - 1, ndcCab = 2 * S.cabeca - 1;
  let tanH = fov == null ? 1.95 / ((ndcCab - ndcPe) * d) : Math.tan((fov * Math.PI) / 360);
  if (fov == null) tanH = clamp(tanH, Math.tan((16 * Math.PI) / 360), Math.tan((34 * Math.PI) / 360));
  out.fov = (2 * Math.atan(tanH) * 180) / Math.PI;
  out.para[0] = sx; out.para[2] = sz;
  if (opc.pequena) {
    // ajustarCelular multiplica o fov pelo fator do celular e põe o assunto no terço esquerdo
    out.fov /= COMEMORACAO.camera.celular;
    ajustarCelular(out, opc);
  } else {
    const fx = (sx - cx) / d, fz = (sz - cz) / d, a = Math.max(1, opc.aspecto ?? 16 / 9);
    const k = d * tanH * a / 3;
    out.para[0] += -fz * k; out.para[2] += fx * k;
  }
  // inclinação: os pés (y 0) a ndcPe na vertical
  const dl = Math.hypot(out.para[0] - cx, out.para[2] - cz) || d;
  const th = Math.atan2(cy, d) - Math.atan(-ndcPe * tanH);
  out.para[1] = cy - dl * Math.tan(th);
}

/**
 * Plano de câmera do estado desenhado: out = {nome ('sai' | 'sai2' | 'entra' | 'fim'), de:[x,y,z], para:[x,y,z], fov
 * (vertical, graus, para 16:9)}. opc = {pequena, aspecto}. Pura: só lê a cena. Corte = o nome muda.
 */
export function planoCameraSubst(c, opc, out) {
  const t = tempoCenaSubst(c);
  const ip = planoEm(c, t);
  const pl = c.plano.planos[ip];
  if (!pl) { out.nome = 'fim'; return out; }
  out.nome = pl.nome;
  const cam = c.cams[ip] ?? (c.cams[ip] = escolherCamera(c, ip));
  out.de[0] = cam.x; out.de[1] = cam.y; out.de[2] = cam.z;
  limitarCamera(out);
  const a = assunto(c, ip);
  // o assunto desenhado (interpolado)
  const sx = lerp(a.x0, a.x1, c.alfa), sz = lerp(a.z0, a.z1, c.alfa);
  if (pl.nome === 'entra') {
    // pan: do quarto árbitro com a placa (o sinal) para o 1º reserva (já com ele no quadro ao lado do quarto)
    const w = suave((t - pl.t0 - S.sinal) / 0.6);
    const qx = lerp((S.quarto.x + sx) / 2, sx, w), qz = lerp((S.quarto.z + sz) / 2, sz, w);
    enquadrar(out, qx, qz, S.camEntra.fov, opc);
  } else enquadrar(out, sx, sz, null, opc);
  return out;
}

/** Objeto de saída do planoCameraSubst (um por página/teste, reaproveitado). */
export function criarPlanoCameraSubst() { return { nome: 'sai', de: [0, 0, 0], para: [0, 0, 0], fov: 22 }; }

/** Eventos novos da cena (as palmas de quem cruzou a linha) para a página; esvazia a fila. */
export function consumirEventosSubst(c, out = []) {
  out.length = 0;
  for (const e of c.eventos) out.push(e);
  c.eventos.length = 0;
  return out;
}

/**
 * Informação para testes e API: por ator {id, time, tipo, x, z, rumo, v, goleiro, kit, cruzou (tick ou −1), cx, cz,
 * fixo, fase, par}.
 */
export function infoAtoresSubst(c) {
  return c.atores.map(a => ({
    id: a.id, time: a.time, tipo: TIPOS[a.tipo], x: a.j.x, z: a.j.z, rumo: a.j.rumo, v: Math.hypot(a.j.vx, a.j.vz),
    goleiro: a.goleiro, kit: a.kit, cruzou: a.cruzou, cx: a.cx, cz: a.cz, fixo: a.fixo, fase: a.fase, par: a.par,
  }));
}
