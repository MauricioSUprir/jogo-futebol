// Proteção (seção 4): com o modificador, o corpo fica entre a bola e o marcador, que precisa
// contornar para roubar. Marcador de treino atacando de 8 direções (3 sementes cada), 10 s por
// tentativa, comparando com o mesmo lance SEM o modificador:
//  - parado (analógico solto): corpo entre bola e marcador e tempo até roubar;
//  - contorno: o protetor gira em volta da bola no máximo CONDUCAO.giroProtecao (pela agilidade);
//    um marcador que contorna mais rápido chega à bola em tempo finito. Com um protetor fraco
//    (agilidade 30) e o marcador contornando a 3,2 m/s, mede quanto o marcador girou em volta do
//    condutor (giro LÍQUIDO, com sinal) antes de roubar — com amostra mínima de roubadas (sem
//    roubada não há o que medir: reprova);
//  - andando com o modificador (analógico 0,35, 0,5 e 1,0 = teclado): proteger não pode entregar
//    a bola mais do que não proteger, o corpo continua entre a bola e o marcador e o jogador anda
//    de verdade (o grupo corpo+bola não trava);
//  - roubada de verdade: depois do "Roubada!" a bola não volta ao pé de quem perdeu em 0,5 s;
//  - girando devagar no lugar (protegendo, recebendo parado), o pé plantado não fica torcido.
//   node tools/teste-protecao.mjs
import { criarMundo, passo } from '../js/sim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { alternarMarcador, maquinaPasse, ID_MARCADOR } from '../js/treino.js';
import { difAng } from '../js/mat.js';
import { tabelaTexto, fmt, DEG, percentil, media } from './lib/medidas.mjs';

const DUR = 10;

function tentativa(ang, proteger, semente, analog = 0, opc = {}) {
  const m = criarMundo({ semente, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0, attr: opc.attr ?? {} }], bola: { x: 0.4, z: 0 }, posse: 0 });
  const j = m.jogadores[0];
  alternarMarcador(m, 0);
  const mk = m.jogadores.find(o => o.id === ID_MARCADOR);
  mk.x = Math.cos(ang) * 5; mk.z = Math.sin(ang) * 5; mk.rumo = ang + Math.PI; mk.descanso = 0;
  if (opc.contorno) mk.contorno = opc.contorno;
  const e = { x: analog, z: 0, botoes: proteger ? BOTAO.MOD : 0 };
  let entre = 0, perto = 0, tRoubo = null, giro = 0, aAnt = null, voltou = false;
  for (let i = 0; i < DUR * 60; i++) {
    passo(m, { 0: e });
    const dM = Math.hypot(mk.x - j.x, mk.z - j.z);
    const aM = Math.atan2(mk.z - j.z, mk.x - j.x);
    // giro líquido do marcador em volta do condutor enquanto encostado (< 2,5 m)
    if (tRoubo === null) {
      if (dM < 2.5) { if (aAnt !== null) giro += difAng(aAnt, aM); aAnt = aM; } else aAnt = null;
      if (dM < 2.5 && m.posse === 0) {
        perto++;
        const aB = Math.atan2(m.bola.p.z - j.z, m.bola.p.x - j.x);
        if (Math.abs(difAng(aB, aM)) > 110 / DEG) entre++;
      }
    }
    if (tRoubo === null && m.eventos.some(ev => ev.tipo === 'roubada')) tRoubo = i;
    else if (tRoubo !== null) {
      if (i - tRoubo >= 30) break;
      if (m.posse === 0) voltou = true; // a bola voltou ao pé de quem perdeu
    }
  }
  const tFim = tRoubo !== null ? (tRoubo + 1) * PASSO : DUR;
  return { entre: perto ? entre / perto : 1, tRoubo: tFim, roubou: tRoubo !== null, giro: Math.abs(giro) * DEG, voltou, avanco: j.x / Math.max(tFim, 0.5) };
}

function bateria(proteger, analog, opc) {
  const r = [];
  for (let k = 0; k < 8; k++) for (let s = 1; s <= 3; s++) r.push(tentativa((k * Math.PI) / 4 + s * 0.13, proteger, k * 10 + s, analog, opc));
  return r;
}
const f = (arr, campo) => arr.map(x => x[campo]);
const resumo = r => ({
  entre: media(f(r, 'entre')),
  roub: r.filter(x => x.roubou).length,
  t: percentil(f(r, 'tRoubo'), 0.5),
  giros: r.filter(x => x.roubou).map(x => x.giro),
  voltou: r.filter(x => x.voltou).length,
  avanco: percentil(f(r, 'avanco'), 0.5),
});

// ---- parado
const com = resumo(bateria(true, 0)), sem = resumo(bateria(false, 0));
const linhas = [
  ['parado (analógico solto), 24 tentativas de 10 s', 'com proteção', 'sem proteção'],
  ['corpo entre bola e marcador (marcador a < 2,5 m)', `${fmt(com.entre * 100, 0)}%`, `${fmt(sem.entre * 100, 0)}%`],
  ['roubadas', `${com.roub}`, `${sem.roub}`],
  [`tempo mediano até roubar (${DUR} = não roubou)`, `${fmt(com.t)} s`, `${fmt(sem.t)} s`],
  ['giro líquido do marcador antes de roubar (mediana)', com.giros.length ? `${fmt(percentil(com.giros, 0.5), 0)}° (${com.giros.length} roubadas)` : 'sem amostra', sem.giros.length ? `${fmt(percentil(sem.giros, 0.5), 0)}°` : '—'],
  ['bola voltou ao pé de quem perdeu em 0,5 s', `${com.voltou}`, `${sem.voltou}`],
];
console.log(tabelaTexto(linhas));

// ---- contorno: marcador contornando a 3,2 m/s contra protetor fraco (agilidade 30) e padrão
const RAPIDO = { contorno: 3.2 };
const fraco = resumo(bateria(true, 0, { ...RAPIDO, attr: { agilidade: 30 } }));
const fracoSem = resumo(bateria(false, 0, { ...RAPIDO, attr: { agilidade: 30 } }));
const padrao = resumo(bateria(true, 0, RAPIDO));
const giroMed = fraco.giros.length ? percentil(fraco.giros, 0.5) : NaN;
console.log('');
console.log(tabelaTexto([
  ['marcador contornando a 3,2 m/s', 'protetor agilidade 30', 'sem proteção', 'protetor agilidade 75'],
  ['roubadas em 24', fraco.roub, fracoSem.roub, padrao.roub],
  [`tempo mediano até roubar (${DUR} = não roubou)`, `${fmt(fraco.t)} s`, `${fmt(fracoSem.t)} s`, `${fmt(padrao.t)} s`],
  ['giro líquido antes de roubar (mediana)', fraco.giros.length ? `${fmt(giroMed, 0)}°` : 'sem amostra', fracoSem.giros.length ? `${fmt(percentil(fracoSem.giros, 0.5), 0)}°` : '—', padrao.giros.length ? `${fmt(percentil(padrao.giros, 0.5), 0)}°` : '—'],
]));

// ---- andando com o modificador
const andando = [];
const linA = [['andando (24 tentativas de 10 s)', 'roubadas com MOD', 'sem MOD', 't mediano com MOD', 'sem MOD', 'corpo entre (com)', 'avanço (com)']];
let voltouAndando = 0;
for (const a of [0.35, 0.5, 1]) {
  const c = resumo(bateria(true, a)), s = resumo(bateria(false, a));
  andando.push({ a, c, s });
  voltouAndando += c.voltou + s.voltou;
  linA.push([`analógico ${a}`, c.roub, s.roub, `${fmt(c.t)} s`, `${fmt(s.t)} s`, `${fmt(c.entre * 100, 0)}%`, `${fmt(c.avanco)} m/s`]);
}
console.log('');
console.log(tabelaTexto(linA));

// ---- pés acompanham o tronco girando devagar no lugar (sem a perna ficar torcida): proteção
// com o marcador dando a volta devagar (0,3–1,5 rad/s a 1,4 m) e recepção parada da máquina de
// passes. Torção = ângulo entre o pé PLANTADO e o tronco (a passada normal limita a ~69°).
let torcaoMax = 0;
{
  const medirTorcao = j => { for (const p of j.pes) if (p.apoio) torcaoMax = Math.max(torcaoMax, Math.abs(difAng(p.rumo, j.rumo)) * DEG); };
  for (const w of [0.3, 0.8, 1.5]) {
    const m = criarMundo({ semente: 1, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }], bola: { x: 0.4, z: 0 }, posse: 0 });
    const j = m.jogadores[0];
    alternarMarcador(m, 0);
    const mk = m.jogadores.find(o => o.id === ID_MARCADOR);
    for (let i = 0; i < 15 * 60; i++) {
      const a = w * i * PASSO + Math.PI;
      mk.x = j.x + Math.cos(a) * 1.4; mk.z = j.z + Math.sin(a) * 1.4;
      mk.vx = -Math.sin(a) * 1.4 * w; mk.vz = Math.cos(a) * 1.4 * w; mk.descanso = 999;
      passo(m, { 0: { x: 0, z: 0, botoes: BOTAO.MOD } });
      medirTorcao(j);
    }
  }
  for (let rep = 1; rep <= 40; rep++) {
    const m = criarMundo({ semente: rep, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }], bola: { x: 30, z: 30 }, posse: null });
    const j = m.jogadores[0];
    for (let i = 0; i < 8 * 60; i++) {
      if (i % 120 === 0) maquinaPasse(m, 0);
      passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      medirTorcao(j);
    }
  }
}

const okAndando = andando.every(x => x.c.roub <= x.s.roub && x.c.t >= x.s.t);
const metas = [
  ['corpo entre a bola e o marcador (parado)', com.entre >= 0.8, `${fmt(com.entre * 100, 0)}%`, '≥ 80%'],
  ['proteger segura a bola bem mais tempo (parado)', com.t >= 2.5 * sem.t, `${fmt(com.t)} s × ${fmt(sem.t)} s`, '≥ 2,5×'],
  ['para roubar, o marcador precisa contornar (giro líquido, protetor fraco)', fraco.giros.length >= 6 && giroMed >= 60,
    fraco.giros.length ? `${fmt(giroMed, 0)}° em ${fraco.giros.length} roubadas` : 'sem amostra (0 roubadas)', '≥ 60° (≥ 6 roubadas)'],
  ['contornar mais rápido que o protetor gira chega à bola; o mais ágil segura mais', fraco.roub >= 6 && padrao.t >= fraco.t && padrao.roub <= fraco.roub,
    `ag. 30: ${fraco.roub} em ${fmt(fraco.t)} s · ag. 75: ${padrao.roub} em ${fmt(padrao.t)} s`, 'ag. 30 ≥ 6 roubadas; ag. 75 segura mais'],
  ['proteger andando não entrega a bola (0,35/0,5/1,0)', okAndando,
    andando.map(x => `${x.c.roub}×${x.s.roub}`).join(' · '), 'com MOD ≤ sem MOD (roubadas e tempo)'],
  ['protegendo andando, o jogador anda de verdade (avanço mediano)', andando.every(x => x.c.avanco >= 1.0), andando.map(x => `${fmt(x.c.avanco)}`).join(' · ') + ' m/s', '≥ 1,0 m/s'],
  ['corpo entre a bola e o marcador andando com o modificador', andando.every(x => x.c.entre >= 0.8), andando.map(x => `${fmt(x.c.entre * 100, 0)}%`).join(' · '), '≥ 80%'],
  ['pés acompanham o tronco girando devagar no lugar (torção pé plantado × tronco)', torcaoMax <= 75, `${fmt(torcaoMax, 0)}°`, '≤ 75°'],
  ['roubada de verdade: não volta ao pé de quem perdeu em 0,5 s', com.voltou + sem.voltou + voltouAndando + fraco.voltou + fracoSem.voltou === 0, `${com.voltou + sem.voltou + voltouAndando + fraco.voltou + fracoSem.voltou} caso(s)`, '0'],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(m => [m[0], m[2], m[3], m[1] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(m => m[1]);
console.log(ok ? '\nteste-protecao: PASSOU' : '\nteste-protecao: REPROVOU');
process.exit(ok ? 0 : 1);
