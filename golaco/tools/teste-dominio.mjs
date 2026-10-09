// Domínio (seção 4): primeiro toque orientado pelo analógico; a qualidade depende do
// atributo de controle, da velocidade da bola e da pressão. Máquina de passes rasteiros
// (chegando a 6–15 m/s, de 12 m) contra um jogador parado com o analógico apontando para onde quer sair
// (±60° da direção de onde a bola vem). "Dominou e saiu jogando" = a bola sai na direção
// pedida (±30°) e o jogador continua com ela por 1,5 s sem ir buscá-la.
//   node tools/teste-dominio.mjs
import { criarMundo, passo } from '../js/sim.js';
import { PASSO } from '../js/config.js';
import { maquinaPasse, alternarMarcador, ID_MARCADOR } from '../js/treino.js';
import { difAng } from '../js/mat.js';
import { tabelaTexto, fmt, DEG } from './lib/medidas.mjs';

function tentativa(controle, vel, semente, pressao) {
  const m = criarMundo({ semente, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0, attr: { controle, drible: controle } }], bola: { x: 30, z: 30 }, posse: null });
  const j = m.jogadores[0];
  if (pressao) {
    alternarMarcador(m, 0);
    const mk = m.jogadores.find(o => o.id === ID_MARCADOR);
    mk.papel = 'parado'; mk.x = -1.0; mk.z = 1.6; // perto, mas sem tirar a bola
  }
  // a bola vem de frente (rumo 0 → vem de +x), com variação de ±25°
  const angVem = ((semente * 37) % 51 - 25) / DEG;
  maquinaPasse(m, 0, { angulo: angVem, dist: 12, vel });
  const lado = semente % 2 ? 1 : -1;
  const saida = angVem + Math.PI + lado * (((semente * 13) % 61) / DEG); // sai para um lado, até 60°
  // o "lado de saída" é relativo à direção de onde a bola vem: vira para trás ±60°
  const alvo = angVem + lado * (Math.PI / 2 + ((semente * 13) % 31) / DEG);
  const e = { x: Math.cos(alvo) * 0.5, z: Math.sin(alvo) * 0.5, botoes: 0 };
  let tDom = null, dirOk = false, buscou = false;
  for (let i = 0; i < 240; i++) {
    // o analógico só é inclinado quando a bola está chegando (~0,3 s), como no jogo
    const b0 = m.bola;
    const chegando = Math.hypot(b0.p.x - j.x, b0.p.z - j.z) < Math.max(1.5, Math.hypot(b0.v.x, b0.v.z) * 0.3);
    passo(m, { 0: chegando || tDom !== null ? e : { x: 0, z: 0, botoes: 0 } });
    if (tDom === null && m.posse === 0) {
      tDom = i;
      const b = m.bola;
      dirOk = Math.abs(difAng(Math.atan2(b.v.z, b.v.x), alvo)) <= 30 / DEG || Math.hypot(b.v.x, b.v.z) < 0.3;
    }
    if (tDom !== null && i - tDom < 90 && j.cond.busca) buscou = true;
  }
  void saida;
  const ficou = tDom !== null && m.posse === 0 && !buscou;
  return { dominou: tDom !== null, ok: ficou && dirOk };
}

const vels = [6, 9, 12, 15];
const linhas = [['controle', ...vels.map(v => `${v} m/s`), `15 m/s c/ pressão`]];
const taxa = {};
for (const controle of [90, 70, 45]) {
  const lin = [String(controle)];
  for (const v of vels) {
    let ok = 0;
    const N = 40;
    for (let s = 1; s <= N; s++) if (tentativa(controle, v, s, false).ok) ok++;
    taxa[`${controle}/${v}`] = ok / N;
    lin.push(`${Math.round((100 * ok) / N)}%`);
  }
  let okp = 0;
  for (let s = 1; s <= 40; s++) if (tentativa(controle, 15, s + 500, true).ok) okp++;
  taxa[`${controle}/15p`] = okp / 40;
  lin.push(`${Math.round((100 * okp) / 40)}%`);
  linhas.push(lin);
}
console.log('Domínio orientado e saída jogando (% de 40 passes):');
console.log(tabelaTexto(linhas));
const metas = [
  ['bom jogador (90) domina e sai jogando até 12 m/s', taxa['90/6'] >= 0.9 && taxa['90/9'] >= 0.9 && taxa['90/12'] >= 0.9, `${fmt(taxa['90/12'] * 100, 0)}% a 12 m/s`, '≥ 90%'],
  ['bom jogador (90) a 15 m/s', taxa['90/15'] >= 0.8, `${fmt(taxa['90/15'] * 100, 0)}%`, '≥ 80%'],
  ['jogador fraco (45) erra mais na bola forte', taxa['45/15'] <= taxa['90/15'] - 0.15, `${fmt(taxa['45/15'] * 100, 0)}% × ${fmt(taxa['90/15'] * 100, 0)}%`, '≥ 15 pontos abaixo'],
  ['a velocidade da bola pesa (fraco: 6 m/s > 15 m/s)', taxa['45/6'] >= taxa['45/15'] + 0.1, `${fmt(taxa['45/6'] * 100, 0)}% × ${fmt(taxa['45/15'] * 100, 0)}%`, '≥ 10 pontos'],
  ['a pressão pesa (médio 70 a 15 m/s)', taxa['70/15p'] < taxa['70/15'], `${fmt(taxa['70/15p'] * 100, 0)}% × ${fmt(taxa['70/15'] * 100, 0)}%`, 'menor com pressão'],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(m => [m[0], m[2], m[3], m[1] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(m => m[1]);
console.log(ok ? '\nteste-dominio: PASSOU' : '\nteste-dominio: REPROVOU');
process.exit(ok ? 0 : 1);
