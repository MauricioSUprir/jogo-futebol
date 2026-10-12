// Rede que balança — rede VÉU DE NOIVA (js/render/rede-onda.js: a conta pura que o shader da rede usa; a forma é a
// de js/rede-forma.js, a mesma da física da bola):
//   A) a bolsa: sobe rápido (pico em 0,08–0,2 s), passa do ponto (balança) e para em ~1,9 s (o véu é mais solto que a
//      caixa de antes: balança mais devagar e por mais tempo — decisão de 11/10); a onda corre pela rede; a amplitude
//      cresce com a velocidade e satura; a armação (postes, travessão, hastes e estacas do chão) não se mexe;
//   B) as batidas são achadas com a física de verdade (bola.js): rasteiro e no ângulo no véu, a bola subindo dentro do
//      gol, as laterais por dentro e por fora, a bola caindo no véu por fora e a de trás do gol; nada na trave, no
//      travessão, por cima, para fora e na bola parada na cunha do fundo;
//   C) a bola DESENHADA entra na bolsa e volta com ela (nunca fura a rede deformada) e nada pula; nos cantos também.
// Na versão da rede-caixote (antes do véu) reprova (os panos e o perfil não existem).
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

let RO = null, RF = null;
try { RO = await imp('render/rede-onda.js'); } catch (e) { RO = null; }
try { RF = await imp('rede-forma.js'); } catch (e) { RF = null; }
if (!RO || !RF || !RO.deslocamentoVetor) {
  reg('rede véu de noiva (render/rede-onda.js com o campo vetorial e js/rede-forma.js)', !RO ? 'rede estática' : 'rede-caixote (panos retos: fundo, teto e laterais)', 'véu', false);
} else {
  const { CAMPO, BOLA, PASSO } = await imp('config.js');
  const { criarBola, passoBola } = await imp('bola.js');
  const { REDE, mola, perfil, amplitude, fixo, criarOndas, registrarImpacto, deslocamento, deslocamentoVetor, detectarImpactos, empurraoBola, TEMPO_PICO, normalPano } = RO;
  const { VEU, profundidadeVeu, pertoPerfil, pontoPerfil, fundoDaCunha, COMPRIMENTO_PERFIL } = RF;
  const MX = CAMPO.meioX, G = CAMPO.gol, ZL = G.largura / 2, HG = G.altura, R = BOLA.raio;
  const CUNHA = fundoDaCunha(R);

  // ---------------------------------------------------------------- A) a bolsa e a onda
  {
    let tPico = 0, vPico = -1, vMin = 0, tMin = 0, depois = 0;
    for (let t = 0; t <= 2; t += 0.001) {
      const v = mola(t);
      if (v > vPico) { vPico = v; tPico = t; }
      if (t > tPico + 0.05 && t < 0.8 && v < vMin) { vMin = v; tMin = t; }
    }
    let aos17 = 0, resto14 = 0;
    for (let t = 1.7; t < REDE.duracao; t += 0.005) aos17 = Math.max(aos17, Math.abs(perfil(0, t)), Math.abs(perfil(1, t)));
    for (let t = REDE.duracao; t <= 2.6; t += 0.005) depois = Math.max(depois, Math.abs(perfil(0, t)), Math.abs(perfil(1, t)));
    for (let t = 1.4; t <= 2.0; t += 0.005) resto14 = Math.max(resto14, Math.abs(mola(t)));
    reg('Bolsa sobe rápido: pico da mola', `${fmt(tPico, 3)} s (TEMPO_PICO ${fmt(TEMPO_PICO, 3)}), valor ${fmt(vPico, 3)}`, '0,08–0,20 s, valor 1', tPico >= 0.08 && tPico <= 0.2 && Math.abs(vPico - 1) < 0.01 && Math.abs(TEMPO_PICO - tPico) < 0.003);
    reg('Balança: passa do ponto e volta', `mínimo ${fmt(vMin, 2)} em ${fmt(tMin, 2)} s`, 'entre −0,5 e −0,15 (0,2–0,6 s)', vMin <= -0.15 && vMin >= -0.5 && tMin >= 0.2 && tMin <= 0.6);
    reg('Para em ~1,9 s', `|mola| depois de 1,4 s ≤ ${fmt(resto14, 3)}; perfil depois de 1,7 s ${fmt(aos17, 4)}; de ${REDE.duracao} s ${fmt(depois, 4)}`, '≤ 0,05 · ≤ 0,015 · 0', resto14 <= 0.05 && aos17 <= 0.015 && depois === 0);
    reg('Zero antes da batida', `perfil(0, 0) = ${perfil(0, 0)}, perfil(0, −0,1) = ${perfil(0, -0.1)}`, '0', perfil(0, 0) === 0 && perfil(0, -0.1) === 0);
    // a onda: em τ = 0,3 s o maior deslocamento entre 1 e 4 m do ponto fica na frente da onda (c·τ)
    const tau = 0.3, frente = REDE.ondaVel * tau;
    let rMax = 0, vM = 0;
    for (let r = 1; r <= 4; r += 0.01) { const v = Math.abs(perfil(r, tau)); if (v > vM) { vM = v; rMax = r; } }
    const tau2 = 0.45, frente2 = REDE.ondaVel * tau2;
    let rMax2 = 0, vM2 = 0;
    for (let r = 1.5; r <= 5; r += 0.01) { const v = Math.abs(perfil(r, tau2)); if (v > vM2) { vM2 = v; rMax2 = r; } }
    reg('Onda corre pela rede (frente da onda)', `τ 0,3 s: máx em ${fmt(rMax, 2)} m (frente ${fmt(frente, 2)}); τ 0,45 s: ${fmt(rMax2, 2)} m (${fmt(frente2, 2)})`, '±0,5 m da frente, e anda', Math.abs(rMax - frente) <= 0.5 && Math.abs(rMax2 - frente2) <= 0.5 && rMax2 > rMax + 0.5);
    const a25 = amplitude(25), a5 = amplitude(5), a1 = amplitude(0.5), a35 = amplitude(35);
    reg('Bolsa pela força do chute (satura)', `25 m/s ${fmt(a25, 2)} m · 5 m/s ${fmt(a5, 2)} · 35 m/s ${fmt(a35, 2)} · 0,5 m/s ${fmt(a1, 2)}`, '25: 0,55–0,80 · 5: 0,15–0,35 · 35 ≤ ampMax · lenta 0',
      a25 >= 0.55 && a25 <= 0.8 && a5 >= 0.15 && a5 <= 0.35 && a35 <= REDE.ampMax && a35 > a25 && a1 === 0);
    // armação parada: postes, travessão, hastes, pé das laterais e fundo do véu no chão (os dois gols); meio dos panos solto
    let maxBorda = 0, minMeio = 1;
    const o = { X: 0, y: 0, nx: 0, ny: 0, s: 0 };
    for (const s of [-1, 1]) {
      for (let a = 0; a <= 1.0001; a += 0.05) {
        for (const t of [-1, 1]) {
          maxBorda = Math.max(maxBorda, fixo(s * MX, HG * a, t * ZL), fixo(s * (MX + VEU.haste * a), HG, t * ZL), fixo(s * (MX + VEU.fundo * a), 0, t * ZL));
        }
        maxBorda = Math.max(maxBorda, fixo(s * MX, HG, -ZL + 2 * ZL * a), fixo(s * (MX + VEU.fundo), 0, -ZL + 2 * ZL * a));
      }
      pontoPerfil(COMPRIMENTO_PERFIL * 0.45, o);
      minMeio = Math.min(minMeio, fixo(s * (MX + o.X), o.y, 0));
      for (const t of [-1, 1]) minMeio = Math.min(minMeio, fixo(s * (MX + 0.5 * profundidadeVeu(1.0)), 1.0, t * ZL));
    }
    reg('Armação parada (postes, travessão, hastes, estacas)', `fixo na armação ≤ ${fmt(maxBorda, 6)} · no meio do véu e das laterais ≥ ${fmt(minMeio, 3)}`, 'armação 0, meio ≥ 0,9', maxBorda < 1e-9 && minMeio >= 0.9);
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
  /** vy para a bola chutada de X0 (com vx', vz) passar a 0,3 m da linha do gol na altura y (bisseção na física). */
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
  // uma batida por contato: nenhuma outra no mesmo pano em menos de 0,25 s (a bola que bate no alto do véu, cai e
  // encosta de novo embaixo é outro contato — no véu isso acontece: ela escorrega até a cunha do fundo)
  const umaPorContato = l => l.length >= 1 && l.every((a, i) => i === 0 || a.tick - l[i - 1].tick >= 15);
  // k: 0 = véu, 2/3 = laterais z−/z+; vel = velocidade normal à rede na batida (m/s)
  const CENAS = [
    { nome: 'chute rasteiro forte no meio (véu baixo, por dentro)', ini: { X: -14, y: R, z: 0.5, v: [26, 0, 0.3] }, k: 0, sinal: 1, vel: [6, 14], z: [0.3, 1.2], y: [0, 0.6] },
    { nome: 'chute no ângulo (véu alto, por dentro)', ini: { X: -16, y: 1.0, z: -1, v: [27, vyParaAltura(-16, 1.0, 27, -1.6, 2.1), -1.6] }, k: 0, sinal: 1, vel: [14, 29], y: [1.4, 2.44] },
    { nome: 'bola subindo dentro do gol (véu, por dentro)', ini: { X: 1, y: 0.6, z: 0.5, v: [0.3, 11, 0] }, k: 0, sinal: 1, vel: [4, 11] },
    { nome: 'bola atravessando o gol (lateral z+, por dentro)', ini: { X: 1.0, y: 0.8, z: 0, v: [0, 2, 15] }, k: 3, sinal: 1, vel: [12, 15.5] },
    { nome: 'bola de fora na lateral (lateral z+, por fora)', ini: { X: 1.0, y: 0.8, z: 9, v: [0, 2, -15] }, k: 3, sinal: -1, vel: [12, 15.5] },
    { nome: 'bola caindo no véu (por fora, de cima)', ini: { X: 1.2, y: 7, z: 0, v: [0, -1, 0] }, k: 0, sinal: -1, vel: [4, 10.5] },
    { nome: 'bola de trás do gol no véu (por fora)', ini: { X: 5, y: 0.6, z: 0, v: [-12, 1.5, 0] }, k: 0, sinal: -1, vel: [3, 12.5] },
    { nome: 'bola rolando devagar até o fundo (bolsa pequena)', ini: { X: 0.5, y: R, z: 0.2, v: [4, 0, 0] }, k: 0, sinal: 1, vel: [0.8, 2.5] },
  ];
  for (const s of [1, -1]) {
    for (const c of CENAS) {
      const { achadas } = cena(s, c.ini);
      const plano = (s > 0 ? 4 : 0) + c.k;
      const primeira = achadas[0];
      const ok = !!primeira && primeira.plano === plano && primeira.sinal === c.sinal && primeira.vel >= c.vel[0] && primeira.vel <= c.vel[1]
        && (!c.z || (primeira.z >= c.z[0] && primeira.z <= c.z[1])) && (!c.y || (primeira.y >= c.y[0] && primeira.y <= c.y[1]))
        && umaPorContato(achadas.filter(a => a.plano === plano && a.sinal === c.sinal));
      reg(`Batida: ${c.nome} (gol ${s > 0 ? '+x' : '−x'})`,
        primeira ? `pano ${primeira.plano} (meta ${plano}), sinal ${primeira.sinal}, ${fmt(primeira.vel, 1)} m/s em (${fmt(primeira.x, 2)}, ${fmt(primeira.y, 2)}, ${fmt(primeira.z, 2)}), batidas ${achadas.map(a => `${a.tick}:${a.plano}${a.sinal > 0 ? '+' : '−'}${fmt(a.vel, 1)}@${fmt(a.y, 2)}`).join(' ')}` : 'nenhuma',
        `pano ${plano}, sinal ${c.sinal}, ${c.vel[0]}–${c.vel[1]} m/s, 1 batida por contato`, ok);
    }
    // nada: trave, travessão, por cima, para fora, bola parada na cunha do fundo
    const NADA = [
      { nome: 'chute na trave', ini: { X: -12, y: 0.6, z: ZL + G.raioPoste, v: [24, 0.5, 0] } },
      { nome: 'chute no travessão', ini: { X: -12, y: 1.0, z: 0, v: [24, vyParaAltura(-12, 1.0, 24, 0, YT), 0] } },
      { nome: 'chute por cima do gol', ini: { X: -14, y: 1.0, z: 0, v: [25, vyParaAltura(-14, 1.0, 25, 0, 3.0), 0] } },
      { nome: 'chute para fora (z = 6 m)', ini: { X: -14, y: R, z: 6, v: [25, 0, 0] } },
      { nome: 'bola parada na cunha do fundo', ini: { X: CUNHA, y: R, z: 0, v: [0, 0, 0] } },
    ];
    for (const c of NADA) {
      const { achadas } = cena(s, c.ini, 90);
      reg(`Sem batida falsa: ${c.nome} (gol ${s > 0 ? '+x' : '−x'})`, `${achadas.length} batida(s)${achadas.length ? ` (pano ${achadas[0].plano} no tick ${achadas[0].tick})` : ''}`, '0', achadas.length === 0);
    }
  }

  // ---------------------------------------------------------------- C) bola desenhada no bojo
  // furo = quanto a superfície da bola DESENHADA passa do pano DEFORMADO em frente a ela (véu pela normal no ponto
  // mais perto do perfil; lateral pela normal ±z), para cada pano em que a bola da física encosta
  const geo = (s, k, p) => {
    const X = s * p.x - MX, cl = (v, a, b) => Math.max(a, Math.min(b, v));
    if (k === 0) {
      const q = pertoPerfil(X, p.y, { X: 0, y: 0, nx: 0, ny: 0, d: 0, s: 0 });
      return { dist: q.d, px: s * (MX + q.X), py: q.y, pz: cl(p.z, -ZL, ZL), nx: s * q.nx, ny: q.ny, nz: 0, dentro: Math.abs(p.z) <= ZL && X >= -R };
    }
    const tz = k === 2 ? -1 : 1, yc = cl(p.y, 0, HG);
    return { dist: tz * p.z - ZL, px: s * (MX + cl(X, 0, profundidadeVeu(yc))), py: yc, pz: tz * ZL, nx: 0, ny: 0, nz: tz, dentro: X >= 0 && X <= profundidadeVeu(yc) && p.y <= HG };
  };
  const _dv = { x: 0, y: 0, z: 0 };
  const defNormal = (est, g, t) => { deslocamentoVetor(est, g.px, g.py, g.pz, t, _dv); return (_dv.x * g.nx + _dv.y * g.ny + _dv.z * g.nz) * fixo(g.px, g.py, g.pz); };
  /**
   * Maior furo (m), quanto a bola desenhada entra (m, pela direção da 1ª bolsa), maior variação do empurrão por quadro,
   * maior passo da bola DESENHADA por quadro (p + empurrão) e o resto do empurrão depois que a última batida acabou.
   */
  function furoCena(s, ini, ticks = 200, quadros = [0.25, 0.5, 0.75, 1]) {
    const b = criarBola(s * (MX + ini.X), ini.z);
    b.p.y = ini.y; b.v.x = s * ini.v[0]; b.v.y = ini.v[1]; b.v.z = ini.v[2];
    b.rolando = !(ini.v[1] > 0.01 || ini.y > R + 1e-3);
    const est = criarOndas(), p0 = {}, v0 = {}, out = [], emp = { x: 0, y: 0, z: 0 };
    let pior = 0, batidas = 0, nq = 0, entra = 0, pulo = 0, passoMax = 0, ult = null, uDes = null, tUlt = null, fim = 0, dir = null, vChegada = 0;
    for (let tick = 0; tick < ticks; tick++) {
      Object.assign(p0, b.p); Object.assign(v0, b.v);
      passoBola(b, []);
      const n = detectarImpactos(p0, v0, b.p, b.v, out);
      for (let k = 0; k < n; k++) {
        const im = registrarImpacto(est, out[k], (tick + 1) * PASSO);
        if (!im) continue;
        batidas++; tUlt = (tick + 1) * PASSO;
        if (!dir) { dir = { x: im.dx, y: im.dy, z: im.dz }; vChegada = Math.hypot(v0.x, v0.y, v0.z); }
      }
      for (const a of quadros) {
        const t = (tick + a) * PASSO;
        const p = { x: p0.x + (b.p.x - p0.x) * a, y: p0.y + (b.p.y - p0.y) * a, z: p0.z + (b.p.z - p0.z) * a };
        empurraoBola(est, p, t, emp);
        const d = { x: p.x + emp.x, y: p.y + emp.y, z: p.z + emp.z };
        if (dir) {
          entra = Math.max(entra, emp.x * dir.x + emp.y * dir.y + emp.z * dir.z);
          if (ult) pulo = Math.max(pulo, Math.hypot(emp.x - ult.x, emp.y - ult.y, emp.z - ult.z));
          if (uDes) passoMax = Math.max(passoMax, Math.hypot(d.x - uDes.x, d.y - uDes.y, d.z - uDes.z));
          ult = { x: emp.x, y: emp.y, z: emp.z };
          uDes = d;
          if (t - tUlt > REDE.duracao + 0.05) fim = Math.max(fim, Math.hypot(emp.x, emp.y, emp.z));
        }
        for (const ss of [-1, 1]) for (const k of [0, 2, 3]) {
          const g0 = geo(ss, k, p);
          if (!g0.dentro || Math.abs(g0.dist) > R + 0.05) continue;
          const gd = geo(ss, k, d);
          const def = defNormal(est, gd, t);
          const fura = g0.dist <= 0 ? gd.dist + R - def : def - (gd.dist - R);
          pior = Math.max(pior, fura);
          nq++;
        }
      }
    }
    const passoChegada = vChegada * PASSO / quadros.length; // o quanto a bola andava por quadro ao chegar na rede
    return { pior, batidas, quadros: nq, entra, pulo, passoMax, passoChegada, fim };
  }
  {
    const vy = vyParaAltura(-14, 0.4, 26, 0.2, 1.0);
    const r = furoCena(1, { X: -14, y: 0.4, z: 0.4, v: [26, vy, 0.2] }, 300, [0.5, 1]);
    reg('Bola desenhada entra na bolsa (chute de 26 m/s a 1 m de altura)', `vai até ${fmt(r.entra, 2)} m para dentro da rede (pela direção da bolsa), ${r.batidas} batida(s)`, '≥ 0,25 m', r.batidas > 0 && r.entra >= 0.25);
    reg('Bola desenhada nunca atravessa a rede deformada', `passa no máximo ${fmt(r.pior * 100, 1)} cm`, '≤ 1 cm', r.batidas > 0 && r.pior <= 0.01);
    // o véu é mais solto que a caixa: logo depois da batida a bolsa anda a ~10 m/s (a bola chegou a ~25 m/s) — a bola
    // desenhada desacelera junto com a rede, sem pular para a frente
    reg('Bola desenhada sem pulo (a 120 Hz)', `empurrão varia até ${fmt(r.pulo * 100, 1)} cm por quadro; a bola desenhada anda até ${fmt(r.passoMax * 100, 1)} cm por quadro depois da batida (chegou andando ${fmt(r.passoChegada * 100, 1)} cm)`, 'empurrão ≤ 12 cm; nunca mais rápida que chegou', r.batidas > 0 && r.pulo <= 0.12 && r.passoMax <= r.passoChegada + 1e-9);
    reg('Bola desenhada volta ao ponto da física', `${REDE.duracao} s depois da última batida: ${fmt(r.fim * 1000, 2)} mm`, '0', r.batidas > 0 && r.fim < 1e-6);
  }
  // cantos: a bola desenhada não fura nenhum pano (contraprova M1: no canto o empurrão de um pano levava a bola para
  // perto da armação do outro, que quase não se mexe, e ela furava esse outro)
  {
    const CANTOS = [
      { nome: 'rasteiro no canto (véu × lateral)', ini: { X: -10, y: R, z: ZL - 0.45, v: [22, 0, 0.9] } },
      { nome: 'no ângulo (véu alto × lateral)', ini: { X: -12, y: 1.4, z: ZL - 0.9, v: [24, vyParaAltura(-12, 1.4, 24, 1.2, 2.2), 1.2] } },
      { nome: 'cruzando o gol rente ao véu (lateral × véu)', ini: { X: profundidadeVeu(0.55) - 0.35, y: 0.55, z: 0.5, v: [1.5, 1.2, -15] } },
      { nome: 'diagonal forte para o canto de trás (lateral × véu)', ini: { X: 0.4, y: 0.6, z: -1.0, v: [9, 1.0, -12] } },
    ];
    let piorTodos = 0, cenasOk = 0;
    const desc = [];
    for (const s of [1, -1]) {
      for (const c of CANTOS) {
        const r = furoCena(s, c.ini);
        piorTodos = Math.max(piorTodos, r.pior);
        if (r.batidas > 0 && r.quadros > 0) cenasOk++;
        desc.push(`${fmt(r.pior * 100, 1)}`);
      }
    }
    reg('Cantos: a bola desenhada não fura a rede (4 cenas × 2 gols, 4 quadros por passo)', `pior ${fmt(piorTodos * 100, 1)} cm (cenas: ${desc.join(' · ')} cm); ${cenasOk}/8 com batida`, '≤ 1 cm e 8/8 com batida', piorTodos <= 0.01 && cenasOk === 8);
    // contraprova M6 (agora no véu): bola rolando por cima da faixa de cima até cair pelo véu por fora — sem bolsa por dentro
    const { achadas } = cena(1, { X: 0.2, y: HG + R, z: 0.3, v: [3.2, 0, 0] }, 120);
    const falsa = achadas.filter(a => a.sinal > 0);
    reg('Bola rolando por cima da faixa de cima e caindo pelo véu: sem bolsa por dentro', `${falsa.length} batida(s) "por dentro" (todas: ${achadas.map(a => `pano ${a.plano} ${a.sinal > 0 ? '+' : '−'}`).join(', ') || 'nenhuma'})`, '0', falsa.length === 0);
  }

  // ---------------------------------------------------------------- D) impactos guardados
  {
    const est = criarOndas();
    for (let k = 0; k < 6; k++) registrarImpacto(est, { plano: 4, x: MX + profundidadeVeu(1), y: 1, z: k - 3, vel: 10 + k, sinal: 1 }, k * 0.1);
    const ativos = est.imp.filter(i => i.ativo).length;
    const fica = est.imp.some(i => i.t0 === 0.5) && est.imp.some(i => i.t0 === 0.4);
    const outroGol = deslocamento(est, 0, -(MX + profundidadeVeu(1)), 1, 0, 0.6);
    reg('Até 4 batidas ao mesmo tempo (troca a mais fraca)', `${ativos} guardadas, as 2 últimas presentes ${fica}`, '4, sim', ativos === REDE.maxImpactos && fica);
    reg('O outro gol não sente a batida', `deslocamento no gol −x: ${outroGol}`, '0', outroGol === 0);
    const n = normalPano(4), nl = Math.hypot(n.x, n.y, n.z);
    reg('Normal do véu do gol +x: para fora (para trás e para cima)', `(${fmt(n.x, 3)}, ${fmt(n.y, 3)}, ${fmt(n.z, 3)})`, 'x > 0, y > 0, z = 0, unitária', n.x > 0 && n.y > 0 && n.z === 0 && Math.abs(nl - 1) < 1e-9);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-rede: REPROVOU (${falhas})` : '\nteste-rede: PASSOU');
process.exit(falhas ? 1 : 0);
