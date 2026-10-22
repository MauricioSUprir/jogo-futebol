// Pose de descanso do corpo humano tirada do PRÓPRIO jogo (anim.js): o jogador do treino parado, de pé, depois de 2 s
// sem entrada. Grava as 19 juntas (o mesmo JUNTAS do anim.js) em coordenadas do jogador: origem no chão sob a pelve,
// +x = para a frente (rumo), +z = para a direita do jogador, y para cima. Os braços saem em A (abertos ARCO graus da
// vertical, no plano dos ombros) — o descanso do esqueleto do desenho (js/render/esqueleto.js definirBind) e da malha
// (tools/humano/encaixar.py) é este mesmo arquivo.
// Uso: node tools/humano/repouso-do-jogo.mjs [saida=assets/jogador/repouso.json] [arco=40]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarTreino, passoTreino } from '../../js/sessao.js';
import { pose, JUNTAS, J, NJ } from '../../js/anim.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const saida = path.resolve(RAIZ, process.argv[2] || 'assets/jogador/repouso.json');
const ARCO = Number(process.argv[3] ?? 40) * Math.PI / 180;

const m = criarTreino({ modo: 'conducao' });
const vazio = { x: 0, z: 0, botoes: 0 };
for (let t = 0; t < 120; t++) passoTreino(m, vazio, []);
const j = m.jogadores.find(q => q.posicao !== 'GOL') ?? m.jogadores[0];
const po = pose(j, m, new Float32Array(NJ * 3));
// para o referencial do jogador
const cx = po[J.pelve * 3], cz = po[J.pelve * 3 + 2];
const fx = Math.cos(j.rumo), fz = Math.sin(j.rumo); // frente
const rx = -fz, rz = fx;                            // direita
const loc = new Array(NJ);
for (let i = 0; i < NJ; i++) {
  const dx = po[i * 3] - cx, dz = po[i * 3 + 2] - cz;
  loc[i] = [dx * fx + dz * fz, po[i * 3 + 1], dx * rx + dz * rz];
}
// simetria: média dos dois lados (o descanso tem de ser simétrico; o jogo pode ter 1 mm de diferença)
const par = n => n.endsWith('E') ? n.slice(0, -1) + 'D' : n.endsWith('D') ? n.slice(0, -1) + 'E' : null;
for (const n of JUNTAS) {
  const o = par(n);
  if (!o || !n.endsWith('E')) { if (!o) loc[J[n]][2] = 0; continue; }
  const a = loc[J[n]], b = loc[J[o]];
  const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2, z = (Math.abs(a[2]) + Math.abs(b[2])) / 2;
  const sE = Math.sign(a[2]) || -1;
  loc[J[n]] = [x, y, sE * z]; loc[J[o]] = [x, y, -sE * z];
}
// braços em A: o braço e o antebraço retos, abertos ARCO da vertical para fora, com os comprimentos do jogo
const d = (a, b) => Math.hypot(loc[b][0] - loc[a][0], loc[b][1] - loc[a][1], loc[b][2] - loc[a][2]);
for (const s of ['E', 'D']) {
  const om = loc[J['ombro' + s]], lb = d(J['ombro' + s], J['cotovelo' + s]), la = d(J['cotovelo' + s], J['mao' + s]);
  const lado = Math.sign(om[2]);
  const ux = 0, uy = -Math.cos(ARCO), uz = lado * Math.sin(ARCO);
  loc[J['cotovelo' + s]] = [om[0] + ux * lb, om[1] + uy * lb, om[2] + uz * lb];
  loc[J['mao' + s]] = [om[0] + ux * (lb + la), om[1] + uy * (lb + la), om[2] + uz * (lb + la)];
}
const r = x => Math.round(x * 1e4) / 1e4;
const juntas = Object.fromEntries(JUNTAS.map((n, i) => [n, loc[i].map(r)]));
const medidas = {};
for (const [a, b] of [['pelve', 'lombar'], ['lombar', 'peito'], ['peito', 'pescoco'], ['pescoco', 'cabeca'], ['ombroE', 'ombroD'],
  ['ombroE', 'cotoveloE'], ['cotoveloE', 'maoE'], ['quadrilE', 'quadrilD'], ['quadrilE', 'joelhoE'], ['joelhoE', 'tornozeloE'], ['tornozeloE', 'pontaE']])
  medidas[a + '-' + b] = r(d(J[a], J[b]));
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, JSON.stringify({
  descricao: 'Descanso do corpo humano: o jogador do treino parado (anim.js), braços em A. x = frente, z = direita, y = cima, origem no chão sob a pelve.',
  arcoBracos: Math.round(ARCO * 180 / Math.PI), juntas, medidas,
}, null, 1) + '\n');
console.log(saida); console.log(medidas); console.log(juntas);
