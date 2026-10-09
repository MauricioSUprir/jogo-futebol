// Proteção (seção 4): com o modificador, o corpo fica entre a bola e o marcador, que precisa
// contornar para roubar. Marcador de treino atacando de 8 direções; 6 s por tentativa.
// Compara com o jogador parado SEM proteger.
//   node tools/teste-protecao.mjs
import { criarMundo, passo } from '../js/sim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { alternarMarcador, ID_MARCADOR } from '../js/treino.js';
import { difAng } from '../js/mat.js';
import { tabelaTexto, fmt, DEG, percentil, media } from './lib/medidas.mjs';

function tentativa(ang, proteger, semente) {
  const m = criarMundo({ semente, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }], bola: { x: 0.4, z: 0 }, posse: 0 });
  const j = m.jogadores[0];
  alternarMarcador(m, 0);
  const mk = m.jogadores.find(o => o.id === ID_MARCADOR);
  mk.x = Math.cos(ang) * 5; mk.z = Math.sin(ang) * 5; mk.rumo = ang + Math.PI; mk.descanso = 0;
  let entre = 0, perto = 0, tRoubo = null, giro = 0, aAnt = null;
  for (let i = 0; i < 6 * 60; i++) {
    passo(m, { 0: { x: 0, z: 0, botoes: proteger ? BOTAO.MOD : 0 } });
    const dM = Math.hypot(mk.x - j.x, mk.z - j.z);
    const aM = Math.atan2(mk.z - j.z, mk.x - j.x);
    if (aAnt !== null) giro += Math.abs(difAng(aAnt, aM));
    aAnt = aM;
    if (dM < 2.5 && m.posse === 0) {
      perto++;
      const aB = Math.atan2(m.bola.p.z - j.z, m.bola.p.x - j.x);
      if (Math.abs(difAng(aB, aM)) > 110 / DEG) entre++;
    }
    if (m.stats.roubadas > 0) { tRoubo = (i + 1) * PASSO; break; }
  }
  return { entre: perto ? entre / perto : 1, tRoubo: tRoubo ?? 6, roubou: tRoubo !== null, giro: giro * DEG };
}

const res = { com: [], sem: [] };
for (const proteger of [true, false]) {
  for (let k = 0; k < 8; k++) {
    for (let s = 1; s <= 3; s++) res[proteger ? 'com' : 'sem'].push(tentativa((k * Math.PI) / 4 + s * 0.13, proteger, k * 10 + s));
  }
}
const f = (arr, campo) => arr.map(r => r[campo]);
const entreCom = media(f(res.com, 'entre'));
const tCom = percentil(f(res.com, 'tRoubo'), 0.5), tSem = percentil(f(res.sem, 'tRoubo'), 0.5);
const roubCom = res.com.filter(r => r.roubou).length, roubSem = res.sem.filter(r => r.roubou).length;
const giroRoubo = res.com.filter(r => r.roubou).map(r => r.giro);
const giroMed = giroRoubo.length ? percentil(giroRoubo, 0.5) : 360;
const linhas = [
  ['', 'com proteção', 'sem proteção'],
  ['corpo entre bola e marcador (marcador a < 2,5 m)', `${fmt(entreCom * 100, 0)}%`, `${fmt(media(f(res.sem, 'entre')) * 100, 0)}%`],
  ['roubadas em 6 s (24 tentativas)', `${roubCom}`, `${roubSem}`],
  ['tempo mediano até roubar (6 = não roubou)', `${fmt(tCom)} s`, `${fmt(tSem)} s`],
  ['marcador contornou antes de roubar (giro mediano)', `${fmt(giroMed, 0)}°`, '—'],
];
console.log(tabelaTexto(linhas));
const metas = [
  ['corpo entre a bola e o marcador', entreCom >= 0.8, `${fmt(entreCom * 100, 0)}%`, '≥ 80%'],
  ['proteger segura a bola bem mais tempo', tCom >= 2.5 * tSem, `${fmt(tCom)} s × ${fmt(tSem)} s`, '≥ 2,5×'],
  ['para roubar, o marcador precisa contornar', giroMed >= 60, `${fmt(giroMed, 0)}°`, '≥ 60°'],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(m => [m[0], m[2], m[3], m[1] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(m => m[1]);
console.log(ok ? '\nteste-protecao: PASSOU' : '\nteste-protecao: REPROVOU');
process.exit(ok ? 0 : 1);
