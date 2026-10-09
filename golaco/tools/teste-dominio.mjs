// Domínio (seção 4): primeiro toque orientado pelo analógico; a qualidade depende do
// atributo de controle, da velocidade da bola e da pressão (esta medida PAREADA: as mesmas 400
// sementes com e sem o marcador perto, e uma diferença mínima — não só "menor"). Máquina de passes rasteiros
// (chegando a 6–15 m/s, de 12 m) contra um jogador parado com o analógico apontando para onde quer sair
// (±60° da direção de onde a bola vem). "Dominou e saiu jogando" = a bola sai na direção
// pedida (±30°) e o jogador continua com ela por 1,5 s sem ir buscá-la.
// Em movimento (achado da revisão + enfiada da Etapa 2): (a) RECEPÇÃO EM CORRIDA — correndo a
// ~6 e ~8,5 m/s, a bola vem por trás ou de lado (até 60° do sentido da corrida), rasteira, a 4–7
// m/s, passando a até 0,8 m do caminho: domina sem parar e o primeiro toque leva a bola para a
// frente; (b) trotando/correndo, passe vindo de 45°, 90° e 135° mirado no caminho dele; (c) bola
// solta rolando à frente de quem corre atrás dela.
//   node tools/teste-dominio.mjs [--so-movimento]
import { criarMundo, passo } from '../js/sim.js';
import { PASSO, BOTAO, BOLA } from '../js/config.js';
import { chutarRasteiro, proxVelRolando, DT_BOLA } from '../js/bola.js';
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

// ------------------------------------------------------------ domínio em movimento
/** Rola a bola: devolve {ticks, v} para percorrer D saindo a v0 (mesma conta da integração). */
function rolar(v0, D) {
  let s = v0, d = 0, n = 0;
  while (d < D && s > 0 && n < 1e6) { s = proxVelRolando(s, DT_BOLA); d += s * DT_BOLA; n++; }
  return { t: n * DT_BOLA, v: s };
}
/** Velocidade de saída para chegar a D metros com velocidade u (busca binária com teto que cresce). */
function saidaPara(D, u) {
  let lo = u, hi = u + 5;
  while (rolar(hi, D).v < u) { lo = hi; hi *= 1.5; }
  for (let i = 0; i < 40; i++) { const mm = (lo + hi) / 2; if (rolar(mm, D).v < u) lo = mm; else hi = mm; }
  return (lo + hi) / 2;
}
/**
 * Lança a bola rasteira para chegar ao ponto P em que o jogador estaria (seguindo reto na
 * velocidade atual) daqui a T s, deslocado `lat` m para o lado e `frente` m para a frente,
 * vindo na direção `beta` (rad, relativa ao sentido da corrida: 0 = por trás) a `u` m/s.
 */
function lancarAoEncontro(m, j, { u, beta, lat = 0, frente = 0, D = 12 }) {
  const s = Math.hypot(j.vx, j.vz) || 1;
  const hx = j.vx / s, hz = j.vz / s;
  const v0 = saidaPara(D, u);
  const T = rolar(v0, D).t;
  const px = j.x + j.vx * T + hx * frente - hz * lat, pz = j.z + j.vz * T + hz * frente + hx * lat;
  const dx = hx * Math.cos(beta) - hz * Math.sin(beta), dz = hz * Math.cos(beta) + hx * Math.sin(beta);
  const b = m.bola;
  m.posse = null;
  b.p.x = px - dx * D; b.p.y = BOLA.raio; b.p.z = pz - dz * D;
  chutarRasteiro(b, dx * v0, dz * v0);
  return T;
}

/** Recepção em corrida: devolve {dominou, semParar, frente}. */
function recepcaoCorrida(sem, e, u, beta, lat) {
  const m = criarMundo({ semente: sem, jogadores: [{ id: 0, x: -40, z: 0, rumo: 0 }], bola: { x: 40, z: 30 }, posse: null });
  const j = m.jogadores[0];
  for (let i = 0; i < 150; i++) passo(m, { 0: e });
  const s0 = Math.hypot(j.vx, j.vz);
  const T = lancarAoEncontro(m, j, { u, beta, lat });
  let tDom = null, sMin = Infinity, dirOk = false;
  const n = Math.round((T + 1.2) / PASSO);
  for (let i = 0; i < n; i++) {
    passo(m, { 0: e });
    if (tDom === null) sMin = Math.min(sMin, Math.hypot(j.vx, j.vz));
    if (tDom === null && m.posse === 0) {
      tDom = i;
      const b = m.bola;
      // primeiro toque para a frente: no sentido da corrida/analógico (±30°)
      dirOk = Math.abs(difAng(Math.atan2(b.v.z, b.v.x), Math.atan2(e.z, e.x))) <= 30 / DEG && Math.hypot(b.v.x, b.v.z) > 2;
    }
    if (tDom !== null && i - tDom > 20) break;
  }
  if (tDom !== null) for (let i = 0; i < 20; i++) sMin = Math.min(sMin, Math.hypot(j.vx, j.vz));
  return { dominou: tDom !== null, semParar: tDom !== null && sMin >= 0.6 * s0, frente: dirOk };
}

/** Passe vindo de `ang` (graus, origem relativa ao rumo da corrida) mirado no caminho dele. */
function passeEmMovimento(sem, mag, ang, vel, frente) {
  const m = criarMundo({ semente: sem, jogadores: [{ id: 0, x: -30, z: 0, rumo: 0 }], bola: { x: 40, z: 30 }, posse: null });
  const j = m.jogadores[0];
  const e = { x: mag, z: 0, botoes: 0 };
  for (let i = 0; i < 90; i++) passo(m, { 0: e });
  // origem a 12 m na direção ang; a bola chega ao caminho dele com a velocidade vel
  const a = (ang / DEG) + (sem - 6) * 0.02;
  let T = 1.5;
  let px = 0, pz = 0, v0 = 0, d = 0, ox = j.x + Math.cos(a) * 12, oz = j.z + Math.sin(a) * 12;
  for (let k = 0; k < 30; k++) {
    px = j.x + j.vx * T + frente; pz = j.z + j.vz * T;
    d = Math.hypot(px - ox, pz - oz);
    v0 = saidaPara(d, vel);
    T = rolar(v0, d).t;
  }
  const b = m.bola;
  m.posse = null;
  b.p.x = ox; b.p.y = BOLA.raio; b.p.z = oz;
  chutarRasteiro(b, (px - ox) / d * v0, (pz - oz) / d * v0);
  for (let i = 0; i < 180; i++) { passo(m, { 0: e }); if (m.posse === 0) return true; }
  return false;
}

/** Bola solta rolando à frente (mesmo sentido) de quem corre atrás dela. */
function perseguir(sem, e, vb) {
  const m = criarMundo({ semente: sem, jogadores: [{ id: 0, x: -30, z: 0, rumo: 0 }], bola: { x: 40, z: 30 }, posse: null });
  const j = m.jogadores[0];
  for (let i = 0; i < 90; i++) passo(m, { 0: e });
  const b = m.bola;
  b.p.x = j.x + 1.5 + (sem % 3) * 0.5; b.p.y = BOLA.raio; b.p.z = j.z + ((sem % 5) - 2) * 0.15;
  chutarRasteiro(b, vb, 0);
  for (let i = 0; i < 240; i++) { passo(m, { 0: e }); if (m.posse === 0) return true; }
  return false;
}

const metasMov = [];
{
  const corridas = [['corrida (~6 m/s)', { x: 1, z: 0, botoes: 0 }], ['arrancada (~8,5 m/s)', { x: 1, z: 0, botoes: BOTAO.CORRER }]];
  const lin = [['recepção em corrida', 'dominou', 'sem parar', '1º toque à frente']];
  let tot = 0, dom = 0, sp = 0, fr = 0;
  const falhas = [];
  for (const [nome, e] of corridas) {
    let n = 0, d1 = 0, s1 = 0, f1 = 0, sem = 1;
    for (const u of [4, 5.5, 7]) for (const bg of [0, 30, -30, 60, -60]) for (const lat of [-0.8, -0.3, 0.3, 0.8]) {
      const r = recepcaoCorrida(sem++, e, u, bg / DEG, lat);
      n++; if (r.dominou) d1++; if (r.semParar) s1++; if (r.frente) f1++;
      if (!r.dominou || !r.semParar || !r.frente) falhas.push(`${nome} u=${u} β=${bg}° lat=${lat}: ${r.dominou ? '' : 'não dominou '}${r.dominou && !r.semParar ? 'parou ' : ''}${r.dominou && !r.frente ? 'toque fora da frente' : ''}`);
    }
    lin.push([nome, `${d1}/${n}`, `${s1}/${n}`, `${f1}/${n}`]);
    tot += n; dom += d1; sp += s1; fr += f1;
  }
  console.log(tabelaTexto(lin));
  if (process.argv.includes('--detalhe')) for (const f of falhas) console.log('  - ' + f);
  metasMov.push(['recepção em corrida: domina (bola por trás/de lado, 4–7 m/s, ≤ 0,8 m do caminho)', dom / tot >= 0.95, `${dom}/${tot}`, '≥ 95%']);
  metasMov.push(['recepção em corrida: sem parar (velocidade ≥ 60% da inicial)', sp / tot >= 0.9, `${sp}/${tot}`, '≥ 90%']);
  metasMov.push(['recepção em corrida: 1º toque para a frente (±30° do analógico)', fr / tot >= 0.9, `${fr}/${tot}`, '≥ 90%']);
}
{
  const lin = [['passe em movimento (12 sementes)', ...[45, 90, 135].flatMap(a => [6, 10, 14].map(v => `${a}°/${v}`))]];
  let tot = 0, ok = 0;
  for (const [nome, mag] of [['trote', 0.5], ['corrida', 1]]) {
    for (const frente of [0, 0.4]) {
      const l = [`${nome}${frente ? ' (mira no pé)' : ''}`];
      for (const ang of [45, 90, 135]) for (const vel of [6, 10, 14]) {
        let k = 0;
        for (let s = 1; s <= 12; s++) if (passeEmMovimento(s, mag, ang, vel, frente)) k++;
        l.push(`${k}/12`); tot += 12; ok += k;
      }
      lin.push(l);
    }
  }
  console.log(tabelaTexto(lin));
  metasMov.push(['passe em movimento (trote/corrida, de 45°/90°/135°, 6–14 m/s)', ok / tot >= 0.95, `${ok}/${tot} = ${fmt((100 * ok) / tot, 0)}%`, '≥ 95%']);
}
{
  const lin = [['bola solta à frente', '4 m/s', '6 m/s']];
  let tot = 0, ok = 0;
  for (const [nome, e] of [['trote', { x: 0.5, z: 0, botoes: 0 }], ['corrida', { x: 1, z: 0, botoes: 0 }], ['arrancada', { x: 1, z: 0, botoes: BOTAO.CORRER }]]) {
    const l = [nome];
    for (const vb of [4, 6]) {
      let k = 0;
      for (let s = 1; s <= 10; s++) if (perseguir(s, e, vb)) k++;
      l.push(`${k}/10`);
      tot += 10; ok += k;
    }
    lin.push(l);
  }
  console.log(tabelaTexto(lin));
  metasMov.push(['bola solta à frente: quem corre atrás alcança e domina', ok / tot >= 0.9, `${ok}/${tot}`, '≥ 90%']);
}
console.log('');
if (process.argv.includes('--so-movimento')) {
  console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metasMov.map(m => [m[0], m[2], m[3], m[1] ? 'PASSOU' : 'REPROVOU'])]));
  process.exit(metasMov.every(m => m[1]) ? 0 : 1);
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
  for (let s = 1; s <= 40; s++) if (tentativa(controle, 15, s, true).ok) okp++;
  taxa[`${controle}/15p`] = okp / 40;
  lin.push(`${Math.round((100 * okp) / 40)}%`);
  linhas.push(lin);
}
console.log('Domínio orientado e saída jogando (% de 40 passes; a coluna com pressão usa as MESMAS sementes):');
console.log(tabelaTexto(linhas));
// pressão: comparação PAREADA (mesmas sementes com e sem o marcador parado perto), 400 passes
const NP = 400;
let semP = 0, comP = 0;
for (let s = 1001; s < 1001 + NP; s++) {
  if (tentativa(70, 15, s, false).ok) semP++;
  if (tentativa(70, 15, s, true).ok) comP++;
}
taxa['70/15sp'] = semP / NP; taxa['70/15cp'] = comP / NP;
const metas = [
  ['bom jogador (90) domina e sai jogando até 12 m/s', taxa['90/6'] >= 0.9 && taxa['90/9'] >= 0.9 && taxa['90/12'] >= 0.9, `${fmt(taxa['90/12'] * 100, 0)}% a 12 m/s`, '≥ 90%'],
  ['bom jogador (90) a 15 m/s', taxa['90/15'] >= 0.8, `${fmt(taxa['90/15'] * 100, 0)}%`, '≥ 80%'],
  ['jogador fraco (45) erra mais na bola forte', taxa['45/15'] <= taxa['90/15'] - 0.15, `${fmt(taxa['45/15'] * 100, 0)}% × ${fmt(taxa['90/15'] * 100, 0)}%`, '≥ 15 pontos abaixo'],
  ['a velocidade da bola pesa (fraco: 6 m/s > 15 m/s)', taxa['45/6'] >= taxa['45/15'] + 0.1, `${fmt(taxa['45/6'] * 100, 0)}% × ${fmt(taxa['45/15'] * 100, 0)}%`, '≥ 10 pontos'],
  ['a pressão pesa (médio 70 a 15 m/s, 400 passes pareados)', taxa['70/15cp'] <= taxa['70/15sp'] - 0.06, `${fmt(taxa['70/15cp'] * 100, 0)}% × ${fmt(taxa['70/15sp'] * 100, 0)}%`, '≥ 6 pontos abaixo'],
];
metas.push(...metasMov);
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(m => [m[0], m[2], m[3], m[1] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(m => m[1]);
console.log(ok ? '\nteste-dominio: PASSOU' : '\nteste-dominio: REPROVOU');
process.exit(ok ? 0 : 1);
