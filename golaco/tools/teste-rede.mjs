// Rede que balança (js/render/rede-onda.js — a conta pura que o shader da rede usa):
//   A) a bolsa: sobe rápido (pico em 0,08–0,2 s), passa do ponto (balança) e para em ≤ 1,5 s; a onda
//      corre pelo pano; a amplitude cresce com a velocidade e satura; a armação não se mexe;
//   B) as batidas são achadas com a física de verdade (bola.js): chute no fundo, no ângulo, no teto e na
//      lateral por dentro; lateral, teto e fundo por fora; nada na trave/travessão, por cima, para fora
//      e na bola lenta;
//   C) a bola DESENHADA entra na bolsa e volta com ela (nunca atravessa a rede deformada) e nada pula.
// Na versão publicada a rede é estática: este teste reprova (o módulo não existe).
//   node tools/teste-rede.mjs [--js <pasta js>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let RO;
try { RO = await imp('render/rede-onda.js'); } catch (e) { RO = null; }
if (!RO) {
  reg('módulo da rede que balança (render/rede-onda.js)', 'não existe (rede estática)', 'existe', false);
} else {
  const { CAMPO, BOLA, PASSO } = await imp('config.js');
  const { criarBola, passoBola } = await imp('bola.js');
  const { REDE, mola, perfil, amplitude, fixo, criarOndas, registrarImpacto, deslocamento, detectarImpactos, empurraoBola, TEMPO_PICO, normalPano } = RO;
  const MX = CAMPO.meioX, G = CAMPO.gol, ZL = G.largura / 2, HG = G.altura, PROF = G.profundidade, R = BOLA.raio;

  // ---------------------------------------------------------------- A) a bolsa e a onda
  {
    let tPico = 0, vPico = -1, vMin = 0, tMin = 0, depois = 0;
    for (let t = 0; t <= 2; t += 0.001) {
      const v = mola(t);
      if (v > vPico) { vPico = v; tPico = t; }
      if (t > tPico + 0.05 && t < 0.8 && v < vMin) { vMin = v; tMin = t; }
    }
    let aos15 = 0;
    for (let t = 1.5; t < REDE.duracao; t += 0.005) aos15 = Math.max(aos15, Math.abs(perfil(0, t)), Math.abs(perfil(1, t)));
    for (let t = REDE.duracao; t <= 2.5; t += 0.005) depois = Math.max(depois, Math.abs(perfil(0, t)), Math.abs(perfil(1, t)));
    let resto11 = 0;
    for (let t = 1.1; t <= 1.5; t += 0.005) resto11 = Math.max(resto11, Math.abs(mola(t)));
    reg('Bolsa sobe rápido: pico da mola', `${fmt(tPico, 3)} s (TEMPO_PICO ${fmt(TEMPO_PICO, 3)}), valor ${fmt(vPico, 3)}`, '0,08–0,20 s, valor 1', tPico >= 0.08 && tPico <= 0.2 && Math.abs(vPico - 1) < 0.01 && Math.abs(TEMPO_PICO - tPico) < 0.003);
    reg('Balança: passa do ponto e volta', `mínimo ${fmt(vMin, 2)} em ${fmt(tMin, 2)} s`, 'entre −0,5 e −0,15 (0,2–0,6 s)', vMin <= -0.15 && vMin >= -0.5 && tMin >= 0.2 && tMin <= 0.6);
    reg('Para em ~1,5 s', `|mola| depois de 1,1 s ≤ ${fmt(resto11, 3)}; de 1,5 s ${fmt(aos15, 4)}; de ${REDE.duracao} s ${fmt(depois, 4)}`, '≤ 0,05 · ≤ 0,01 · 0', resto11 <= 0.05 && aos15 <= 0.01 && depois === 0);
    reg('Zero antes da batida', `perfil(0, 0) = ${perfil(0, 0)}, perfil(0, −0,1) = ${perfil(0, -0.1)}`, '0', perfil(0, 0) === 0 && perfil(0, -0.1) === 0);
    // a onda: em τ = 0,3 s o maior deslocamento entre 1 e 4 m do ponto fica na frente da onda (c·τ)
    const tau = 0.3, frente = REDE.ondaVel * tau;
    let rMax = 0, vM = 0;
    for (let r = 1; r <= 4; r += 0.01) { const v = Math.abs(perfil(r, tau)); if (v > vM) { vM = v; rMax = r; } }
    const tau2 = 0.45, frente2 = REDE.ondaVel * tau2;
    let rMax2 = 0, vM2 = 0;
    for (let r = 1.5; r <= 5; r += 0.01) { const v = Math.abs(perfil(r, tau2)); if (v > vM2) { vM2 = v; rMax2 = r; } }
    reg('Onda corre pelo pano (frente da onda)', `τ 0,3 s: máx em ${fmt(rMax, 2)} m (frente ${fmt(frente, 2)}); τ 0,45 s: ${fmt(rMax2, 2)} m (${fmt(frente2, 2)})`, '±0,5 m da frente, e anda', Math.abs(rMax - frente) <= 0.5 && Math.abs(rMax2 - frente2) <= 0.5 && rMax2 > rMax + 0.5);
    const a25 = amplitude(25), a5 = amplitude(5), a1 = amplitude(0.5), a35 = amplitude(35);
    reg('Bolsa pela força do chute (satura)', `25 m/s ${fmt(a25, 2)} m · 5 m/s ${fmt(a5, 2)} · 35 m/s ${fmt(a35, 2)} · 0,5 m/s ${fmt(a1, 2)}`, '25: 0,35–0,55 · 5: 0,10–0,25 · 35 ≤ 0,55 · lenta 0',
      a25 >= 0.35 && a25 <= 0.55 && a5 >= 0.1 && a5 <= 0.25 && a35 <= REDE.ampMax && a35 > a25 && a1 === 0);
    // armação parada: arestas de todos os 8 panos
    let maxBorda = 0, minMeio = 1;
    for (let i = 0; i < 8; i++) {
      const s = i >= 4 ? 1 : -1, k = i & 3;
      const pts = [], meio = [];
      for (let a = 0; a <= 1.0001; a += 0.05) {
        if (k === 0) { const xf = s * (MX + PROF); pts.push([xf, 0, -ZL + 2 * ZL * a], [xf, HG, -ZL + 2 * ZL * a], [xf, HG * a, -ZL], [xf, HG * a, ZL]); }
        else if (k === 1) { pts.push([s * MX, HG, -ZL + 2 * ZL * a], [s * (MX + PROF), HG, -ZL + 2 * ZL * a], [s * (MX + PROF * a), HG, -ZL], [s * (MX + PROF * a), HG, ZL]); }
        else { const z = k === 2 ? -ZL : ZL; pts.push([s * MX, HG * a, z], [s * (MX + PROF), HG * a, z], [s * (MX + PROF * a), 0, z], [s * (MX + PROF * a), HG, z]); }
      }
      if (k === 0) meio.push([s * (MX + PROF), HG / 2, 0]);
      else if (k === 1) meio.push([s * (MX + PROF / 2), HG, 0]);
      else meio.push([s * (MX + PROF / 2), HG / 2, k === 2 ? -ZL : ZL]);
      for (const p of pts) maxBorda = Math.max(maxBorda, fixo(i, ...p));
      for (const p of meio) minMeio = Math.min(minMeio, fixo(i, ...p));
    }
    reg('Armação parada (8 panos)', `fixo na aresta ≤ ${fmt(maxBorda, 6)} · no meio ≥ ${fmt(minMeio, 3)}`, 'aresta 0, meio 1', maxBorda < 1e-9 && minMeio > 0.999);
  }

  // ---------------------------------------------------------------- B) batidas com a física da bola
  /**
   * Roda a bola com a física do jogo (passoBola) e acha as batidas passo a passo (como o main.js faz).
   * ini = {X (profundidade atrás da linha do gol do lado s; negativo = campo), y, z, v: [vx', vy, vz]}
   * com vx' para dentro do gol (+ = para o fundo). Devolve as batidas [{tick, plano, x, y, z, vel, sinal}].
   */
  function cena(s, ini, ticks = 150) {
    const b = criarBola(s * (MX + ini.X), ini.z);
    b.p.y = ini.y;
    b.v.x = s * ini.v[0]; b.v.y = ini.v[1]; b.v.z = ini.v[2];
    b.rolando = !(ini.v[1] > 0.01 || ini.y > R + 1e-3);
    const p0 = { x: 0, y: 0, z: 0 }, v0 = { x: 0, y: 0, z: 0 };
    const out = [], achadas = [];
    for (let t = 0; t < ticks; t++) {
      Object.assign(p0, b.p); Object.assign(v0, b.v);
      passoBola(b, []);
      const n = detectarImpactos(p0, v0, b.p, b.v, out);
      for (let k = 0; k < n; k++) achadas.push({ tick: t, ...out[k] });
    }
    return { achadas, bola: b };
  }
  /**
   * vy para a bola chutada de X0 (com vx', vz) passar a 0,3 m da linha do gol na altura y (bisseção na
   * física; medida antes da linha para a trave e o travessão não entrarem na conta).
   */
  function vyParaAltura(X0, y0, vx, vz, yAlvo) {
    let lo = -2, hi = 12;
    for (let it = 0; it < 40; it++) {
      const vy = (lo + hi) / 2;
      const b = criarBola(MX + X0, 0); b.p.y = y0; b.v.x = vx; b.v.y = vy; b.v.z = vz; b.rolando = false;
      let yLinha = -1;
      for (let t = 0; t < 200 && yLinha < 0; t++) { const xa = b.p.x, ya = b.p.y; passoBola(b, []); const xm = MX - 0.3; if (b.p.x >= xm && xa < xm) yLinha = ya + (b.p.y - ya) * (xm - xa) / (b.p.x - xa); }
      if (yLinha < yAlvo) lo = vy; else hi = vy;
    }
    return (lo + hi) / 2;
  }
  const YT = HG + G.raioPoste;
  const CENAS = [
    { nome: 'chute rasteiro forte no meio (fundo, por dentro)', ini: { X: -14, y: R, z: 0.5, v: [26, 0, 0.3] }, k: 0, sinal: 1, vel: [18, 27], z: [0.3, 1.2] },
    { nome: 'chute no ângulo (fundo alto, por dentro)', ini: { X: -16, y: 1.0, z: -1, v: [27, vyParaAltura(-16, 1.0, 27, -1.6, 2.1), -1.6] }, k: 0, sinal: 1, vel: [18, 29], y: [1.4, 2.44] },
    { nome: 'bola subindo dentro do gol (teto, por dentro)', ini: { X: 1, y: 0.6, z: 0.5, v: [0.3, 11, 0] }, k: 1, sinal: 1, vel: [8, 11] },
    { nome: 'bola atravessando o gol (lateral z+, por dentro)', ini: { X: 1.0, y: 0.8, z: 0, v: [0, 2, 15] }, k: 3, sinal: 1, vel: [12, 15.5] },
    { nome: 'bola de fora na lateral (lateral z+, por fora)', ini: { X: 1.0, y: 0.8, z: 9, v: [0, 2, -15] }, k: 3, sinal: -1, vel: [12, 15.5] },
    { nome: 'bola caindo no teto (teto, por fora)', ini: { X: 1.2, y: 7, z: 0, v: [0, -1, 0] }, k: 1, sinal: -1, vel: [8, 10.5] },
    { nome: 'bola atrás do gol no fundo (fundo, por fora)', ini: { X: 5, y: 0.6, z: 0, v: [-12, 1.5, 0] }, k: 0, sinal: -1, vel: [9, 12.5] },
    { nome: 'bola lenta rolando até o fundo (bolsa pequena)', ini: { X: 0.5, y: R, z: 0.2, v: [2.2, 0, 0] }, k: 0, sinal: 1, vel: [0.8, 2.3] },
  ];
  for (const s of [1, -1]) {
    for (const c of CENAS) {
      const { achadas } = cena(s, c.ini);
      const plano = (s > 0 ? 4 : 0) + c.k;
      const primeira = achadas[0];
      const ok = !!primeira && primeira.plano === plano && primeira.sinal === c.sinal && primeira.vel >= c.vel[0] && primeira.vel <= c.vel[1]
        && (!c.z || (primeira.z * 1 >= c.z[0] && primeira.z <= c.z[1])) && (!c.y || (primeira.y >= c.y[0] && primeira.y <= c.y[1]))
        && achadas.filter(a => a.plano === plano && a.sinal === c.sinal).length === 1;
      reg(`Batida: ${c.nome} (gol ${s > 0 ? '+x' : '−x'})`,
        primeira ? `pano ${primeira.plano} (meta ${plano}), sinal ${primeira.sinal}, ${fmt(primeira.vel, 1)} m/s em (${fmt(primeira.x, 2)}, ${fmt(primeira.y, 2)}, ${fmt(primeira.z, 2)}), batidas ${achadas.length}` : 'nenhuma',
        `pano ${plano}, sinal ${c.sinal}, ${c.vel[0]}–${c.vel[1]} m/s, 1 batida nele`, ok);
    }
    // nada: trave, travessão, por cima, para fora, bola parada encostada
    const NADA = [
      { nome: 'chute na trave', ini: { X: -12, y: 0.6, z: ZL + G.raioPoste, v: [24, 0.5, 0] } },
      { nome: 'chute no travessão', ini: { X: -12, y: 1.0, z: 0, v: [24, vyParaAltura(-12, 1.0, 24, 0, YT), 0] } },
      { nome: 'chute por cima do gol', ini: { X: -14, y: 1.0, z: 0, v: [25, vyParaAltura(-14, 1.0, 25, 0, 3.0), 0] } },
      { nome: 'chute para fora (z = 6 m)', ini: { X: -14, y: R, z: 6, v: [25, 0, 0] } },
      { nome: 'bola parada encostada no fundo', ini: { X: PROF - R, y: R, z: 0, v: [0, 0, 0] } },
    ];
    for (const c of NADA) {
      const { achadas } = cena(s, c.ini, 90);
      // trave/travessão: a bola pode voltar e entrar no gol depois — o que vale é não achar batida
      // na rede ANTES de a bola passar da linha por dentro (centro a ≥ RC atrás dela)
      reg(`Sem batida falsa: ${c.nome} (gol ${s > 0 ? '+x' : '−x'})`, `${achadas.length} batida(s)${achadas.length ? ` (pano ${achadas[0].plano} no tick ${achadas[0].tick})` : ''}`, '0', achadas.length === 0);
    }
  }

  // ---------------------------------------------------------------- C) bola desenhada no bojo
  {
    const s = 1;
    const b = criarBola(s * (MX - 14), 0.4);
    b.v.x = 26; b.v.z = 0.2;
    const est = criarOndas();
    const p0 = { x: 0, y: 0, z: 0 }, v0 = { x: 0, y: 0, z: 0 }, out = [], emp = { x: 0, y: 0, z: 0 };
    let t0 = null, maxOff = 0, atravessa = 0, pulo = 0, ultimo = null, fimOff = 0, tick = 0;
    const amostras = [];
    for (tick = 0; tick < 240; tick++) {
      Object.assign(p0, b.p); Object.assign(v0, b.v);
      passoBola(b, []);
      const tFim = (tick + 1) * PASSO;
      const n = detectarImpactos(p0, v0, b.p, b.v, out);
      for (let k = 0; k < n; k++) if (t0 === null) { registrarImpacto(est, out[k], tFim - PASSO / 2); t0 = tFim - PASSO / 2; }
      if (t0 === null) continue;
      // dois quadros por passo (desenho a 120 Hz: bola interpolada)
      for (const a of [0.5, 1]) {
        const t = tick * PASSO + a * PASSO;
        const p = { x: p0.x + (b.p.x - p0.x) * a, y: p0.y + (b.p.y - p0.y) * a, z: p0.z + (b.p.z - p0.z) * a };
        empurraoBola(est, p, t, emp);
        const off = emp.x * s; // para fora do gol
        maxOff = Math.max(maxOff, off);
        // a rede deformada em frente à bola desenhada (fundo): a bola não passa dela
        const yz = { y: Math.min(HG, Math.max(0, p.y + emp.y)), z: Math.max(-ZL, Math.min(ZL, p.z + emp.z)) };
        const xf = s * (MX + PROF);
        const dRede = deslocamento(est, 4, xf, yz.y, yz.z, t) * fixo(4, xf, yz.y, yz.z);
        const centro = s * (p.x + emp.x) - MX; // profundidade do centro desenhado
        atravessa = Math.max(atravessa, centro + R - (PROF + dRede));
        if (ultimo !== null) pulo = Math.max(pulo, Math.abs(off - ultimo));
        ultimo = off;
        if (t - t0 > REDE.duracao + 0.05) fimOff = Math.max(fimOff, Math.abs(off));
        amostras.push([t - t0, off]);
      }
    }
    const tMax = amostras.reduce((m, a) => (a[1] > m[1] ? a : m), [0, -1])[0];
    reg('Bola desenhada entra na bolsa (chute de 26 m/s)', `vai até ${fmt(maxOff, 2)} m para dentro da rede (em ${fmt(tMax, 2)} s)`, '≥ 0,25 m', t0 !== null && maxOff >= 0.25);
    reg('Bola desenhada nunca atravessa a rede deformada', `passa no máximo ${fmt(atravessa * 100, 1)} cm`, '≤ 1 cm', t0 !== null && atravessa <= 0.01);
    reg('Bola desenhada sem pulo (a 120 Hz)', `maior variação ${fmt(pulo * 100, 1)} cm por quadro`, '≤ 8 cm', t0 !== null && pulo <= 0.08);
    reg('Bola desenhada volta ao ponto da física', `depois de ${REDE.duracao} s: ${fmt(fimOff * 1000, 2)} mm`, '0', t0 !== null && fimOff < 1e-6);
  }

  // ---------------------------------------------------------------- D) impactos guardados
  {
    const est = criarOndas();
    for (let k = 0; k < 6; k++) registrarImpacto(est, { plano: 4, x: MX + PROF, y: 1, z: k - 3, vel: 10 + k, sinal: 1 }, k * 0.1);
    const ativos = est.imp.filter(i => i.ativo).length;
    const fica = est.imp.some(i => i.t0 === 0.5) && est.imp.some(i => i.t0 === 0.4);
    const outroGol = deslocamento(est, 0, -(MX + PROF), 1, 0, 0.6);
    reg('Até 4 batidas ao mesmo tempo (troca a mais fraca)', `${ativos} guardadas, as 2 últimas presentes ${fica}`, '4, sim', ativos === REDE.maxImpactos && fica);
    reg('O outro gol não sente a batida', `deslocamento no gol −x: ${outroGol}`, '0', outroGol === 0);
    const n = normalPano(4);
    reg('Normal do fundo do gol +x para fora', `(${n.x}, ${n.y}, ${n.z})`, '(1, 0, 0)', n.x === 1 && n.y === 0 && n.z === 0);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-rede: REPROVOU (${falhas})` : '\nteste-rede: PASSOU');
process.exit(falhas ? 1 : 0);
