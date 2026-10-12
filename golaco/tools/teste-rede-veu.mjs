// Rede "véu de noiva" (pedido do dono, 11/10: "as redes têm que ser brancas, e ter uma movimentação na rede quando a
// bola toca nela, quero que seja em véu de noiva"). Teste em Node com a FÍSICA da bola (bola.js), a regra do gol
// (sim.js verificarGol, treino.js) e a conta do desenho (render/rede-onda.js):
//   F) forma medida pela física: onde a bola encosta na rede de fundo depende da altura (véu: ≥ 1,8 m rasteiro,
//      ≤ 0,9 m perto do travessão, mais fundo quanto mais baixo) — numa caixa é sempre a mesma profundidade; sem teto
//      plano (a bola que cai atrás do travessão escorrega por trás até o chão); a bola que entra "morre no fundo"
//      (parada no chão, dentro, em ≤ 3 s); nada entra por fora (de trás, de cobertura, pela lateral) e nada sai por
//      dentro (Monte Carlo: 600 bolas de dentro e 600 de fora);
//   G) o gol não conta a bola que está atrás do véu (sim.js verificarGol e o "gol" do treino), e conta a de dentro;
//   D) desenho: a armação (postes, travessão, hastes e estacas) não se mexe, a bolsa sai pela normal do véu no ponto
//      da batida, as batidas são achadas no véu por dentro e por fora e nas laterais, e a bola desenhada entra na
//      bolsa sem furar o véu.
// Na versão publicada antes do véu (rede-caixote de 2 m com teto) reprova.
//   node tools/teste-rede-veu.mjs [--js <pasta js>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt as fmtP } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const impOpc = async f => { try { return await imp(f); } catch (_) { return null; } };
const { CAMPO, BOLA, PASSO } = await imp('config.js');
const { criarBola, passoBola } = await imp('bola.js');
const RF = await impOpc('rede-forma.js');
const MX = CAMPO.meioX, G = CAMPO.gol, ZL = G.largura / 2, HG = G.altura, R = BOLA.raio;
const fmt = (v, d = 2) => fmtP(v, d).replace('.', ',');
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
// "dentro do gol" pela forma da PRÓPRIA versão (véu: rede-forma.js; caixa: a profundidade fixa de config.js)
const profV = y => (RF ? RF.profundidadeVeu(Math.max(0, Math.min(HG, y))) : G.profundidade);
const dentroV = (X, y, z) => (RF ? RF.dentroDoVeu(X, y, z) : X >= 0 && X < G.profundidade && y < HG && Math.abs(z) < ZL);

/** vy para a bola sair de (X0 m antes da linha, y0) com vx e passar 0,3 m antes da linha na altura yAlvo. */
function vyPara(X0, y0, vx, yAlvo) {
  let lo = -3, hi = 12;
  for (let it = 0; it < 40; it++) {
    const vy = (lo + hi) / 2;
    const b = criarBola(MX - X0, 0); b.p.y = y0; b.v.x = vx; b.v.y = vy; b.rolando = false;
    let yl = -1;
    for (let t = 0; t < 300 && yl < 0; t++) {
      const xa = b.p.x, ya = b.p.y; passoBola(b, []);
      const xm = MX - 0.3;
      if (b.p.x >= xm && xa < xm) yl = ya + (b.p.y - ya) * (xm - xa) / (b.p.x - xa);
    }
    if (yl < yAlvo) lo = vy; else hi = vy;
  }
  return (lo + hi) / 2;
}
/** Roda a bola: o 1º ponto em que a velocidade para dentro (vx) cai mais que metade num passo, a trajetória e o fim. */
function rodar(b, ticks = 240) {
  let contato = null;
  const traj = [];
  for (let t = 0; t < ticks; t++) {
    const vx0 = b.v.x;
    passoBola(b, []);
    traj.push({ x: b.p.x, y: b.p.y, z: b.p.z, v: Math.hypot(b.v.x, b.v.y, b.v.z) });
    if (!contato && b.p.x > MX && vx0 > 2 && b.v.x < 0.5 * vx0) contato = { X: b.p.x - MX, y: b.p.y, t };
  }
  return { contato, traj, fim: { x: b.p.x, y: b.p.y, z: b.p.z, v: Math.hypot(b.v.x, b.v.y, b.v.z) } };
}

// ---------------------------------------------------------------- F) forma medida pela física
const perfil = [];
for (const yAlvo of [0.11, 0.5, 1.0, 1.5, 2.0, 2.25]) {
  const b = criarBola(MX - 11, 0.3);
  if (yAlvo <= R + 1e-9) { b.v.x = 20; b.rolando = true; }
  else { b.p.y = 0.3; b.v.x = 22; b.v.y = vyPara(11, 0.3, 22, yAlvo); b.rolando = false; }
  perfil.push({ yAlvo, ...rodar(b) });
}
{
  const cont = perfil.map(p => p.contato);
  const todos = cont.every(Boolean);
  let monot = todos;
  for (let i = 1; i < cont.length && todos; i++) if (cont[i].X > cont[i - 1].X + 0.05) monot = false;
  const xBaixo = cont[0]?.X ?? NaN, xAlto = cont[cont.length - 1]?.X ?? NaN;
  reg('Forma: rede de fundo em véu (onde a bola encosta × altura)', todos ? cont.map(c => `y ${fmt(c.y)} → ${fmt(c.X)} m`).join(' · ') : 'sem contato em algum chute',
    'alto ≤ 0,9 m, rasteiro ≥ 1,8 m, mais fundo quanto mais baixo', todos && monot && xAlto <= 0.9 && xBaixo >= 1.8);
}
// sem teto plano: bola solta 1,5 m atrás do travessão e 1 m acima dele escorrega por trás até o chão (sem entrar)
{
  const b = criarBola(MX + 1.5, 0); b.p.y = HG + 1.0; b.rolando = false;
  const r = rodar(b, 240);
  const entrou = r.traj.some(p => dentroV(p.x - MX, p.y, p.z) && p.x - MX > 0.3);
  reg('Sem teto plano: bola que cai atrás do travessão escorrega por trás até o chão', `em 4 s: y ${fmt(r.fim.y)} m, X ${fmt(r.fim.x - MX)} m${entrou ? ', ENTROU no gol' : ''}`, 'y ≤ 0,2 m, sem entrar (não fica no teto a 2,55 m)', r.fim.y <= 0.2 && !entrou);
}
// "morre no fundo": parada no chão, dentro, em ≤ 3 s; nunca sai pela rede
for (const p of perfil) {
  const fim = p.traj[Math.min(p.traj.length - 1, 180)];
  const saiu = p.traj.some(q => q.x - MX > profV(q.y) + 0.05 || Math.abs(q.z) > ZL + 0.05);
  const ok = fim.v < 0.3 && fim.y < R + 0.02 && !saiu && fim.x - MX > 0.3;
  reg(`Bola que entra a ${fmt(p.yAlvo)} m morre no fundo`, `em 3 s: |v| ${fmt(fim.v)} m/s, y ${fmt(fim.y)} m, X ${fmt(fim.x - MX)} m${saiu ? ', SAIU pela rede' : ''}`, '|v| < 0,3, no chão, dentro', ok);
}
// por fora não entra: de trás rasteira (3–30 m/s), cobertura por cima do travessão, lateral de fora
{
  let entrou = 0, tot = 0;
  const ini = [];
  for (const v of [3, 8, 15, 22, 30]) for (const z of [-3, 0, 2.5]) ini.push({ x: MX + 5, y: R, z, vx: -v, vy: 0, rol: true });
  for (const v of [12, 16, 20]) for (const z of [-2, 0, 3]) ini.push({ x: MX - 12, y: 1.0, z, vx: v, vy: vyPara(12, 1.0, v, 2.9), rol: false });
  for (const v of [8, 15]) for (const X of [0.6, 1.2, 2.0]) ini.push({ x: MX + X, y: 0.8, z: 8, vz: -v, vx: 0, vy: 2, rol: false });
  for (const c of ini) {
    const b = criarBola(c.x, c.z); b.p.y = c.y; b.v.x = c.vx; b.v.y = c.vy; b.v.z = c.vz ?? 0; b.rolando = c.rol;
    let dentro = false;
    for (let t = 0; t < 300; t++) { passoBola(b, []); const X = b.p.x - MX; if (dentroV(X + R * 0.5, b.p.y, b.p.z) && Math.abs(b.p.z) < ZL - 0.05 && X > 0.3) dentro = true; }
    tot++; if (dentro) entrou++;
  }
  reg('Por fora não entra (de trás 3–30 m/s, cobertura por cima, lateral de fora)', `${entrou}/${tot} entraram`, '0', entrou === 0);
}
// Monte Carlo: 600 bolas de dentro (já atrás da linha, para trás/lados/cima) e 600 de fora (atrás, dos lados, de cima)
{
  let sem = 12345;
  const rnd = () => { sem = (sem * 1103515245 + 12345) % 2147483648; return sem / 2147483648; };
  let escapou = 0, entrou = 0, pior = 0;
  for (let k = 0; k < 600; k++) {
    const b = criarBola(MX + 0.15, -3.3 + 6.6 * rnd()); b.p.y = 0.12 + 2.1 * rnd();
    const v = 6 + 26 * rnd(), a = (rnd() - 0.5) * 2.6, e = (rnd() - 0.3) * 1.2;
    b.v.x = v * Math.cos(a) * Math.cos(e); b.v.z = v * Math.sin(a) * Math.cos(e); b.v.y = v * Math.sin(e); b.rolando = false;
    let fora = false;
    for (let t = 0; t < 240; t++) {
      passoBola(b, []);
      const X = b.p.x - MX, exc = Math.max(Math.abs(b.p.z) - ZL, X - profV(b.p.y));
      if (X > 0.25 && b.p.y < HG - 0.05 && exc > 0.02) { fora = true; pior = Math.max(pior, exc); }
    }
    if (fora) escapou++;
  }
  for (let k = 0; k < 600; k++) {
    const tipo = k % 3, b = criarBola(0, 0);
    if (tipo === 0) { b.p.x = MX + 3.2 + 3 * rnd(); b.p.z = -4 + 8 * rnd(); b.p.y = R + 2 * rnd(); }
    else if (tipo === 1) { b.p.x = MX + 0.3 + 2.4 * rnd(); b.p.z = (rnd() < 0.5 ? -1 : 1) * (ZL + 1 + 4 * rnd()); b.p.y = R + 2 * rnd(); }
    else { b.p.x = MX + 0.2 + 3 * rnd(); b.p.z = -3.5 + 7 * rnd(); b.p.y = HG + 0.5 + 3 * rnd(); }
    const alvo = { x: MX + 0.8, y: 0.8, z: -2 + 4 * rnd() };
    const d = Math.hypot(alvo.x - b.p.x, alvo.y - b.p.y, alvo.z - b.p.z), v = 4 + 24 * rnd();
    b.v.x = (alvo.x - b.p.x) / d * v; b.v.y = (alvo.y - b.p.y) / d * v; b.v.z = (alvo.z - b.p.z) / d * v; b.rolando = false;
    let dentro = false;
    for (let t = 0; t < 240; t++) {
      passoBola(b, []);
      const X = b.p.x - MX;
      if (X > 0.3 && b.p.y < HG - 0.15 && Math.abs(b.p.z) < ZL - 0.15 && X < profV(b.p.y) - 0.15) dentro = true;
    }
    if (dentro) entrou++;
  }
  reg('Nada atravessa a rede (Monte Carlo: 600 de dentro, 600 de fora)', `${escapou} escaparam (pior ${fmt(pior * 100, 1)} cm) · ${entrou} entraram`, '0 · 0', escapou === 0 && entrou === 0);
}

// ---------------------------------------------------------------- G) a regra do gol segue o véu
{
  const SIM = await imp('sim.js');
  const TR = await imp('treino.js');
  /** Bola parada no ponto (X atrás da linha do gol +x, y, z): gol no 1º passo da partida? e o aviso do treino. */
  const caso = (X, y, z) => {
    const m = SIM.criarMundo({ semente: 1, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }] });
    Object.assign(m.bola, criarBola(MX + X, z)); m.bola.p.y = y; m.bola.rolando = y <= R + 1e-9;
    SIM.passo(m, {});
    const gol = m.eventos.some(e => e.tipo === 'gol');
    // treino: o aviso da bola que saiu ('gol' ou 'fora'), com a bola posta no mesmo ponto
    const t = SIM.criarMundo({ semente: 1, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }] });
    Object.assign(t.bola, criarBola(MX + X, z)); t.bola.p.y = y;
    t.eventos = [];
    TR.cuidarBolaFora(t, 0);
    return { gol, aviso: t.eventos.find(e => e.tipo === 'gol' || e.tipo === 'fora')?.tipo ?? '-' };
  };
  // atrás da curva do véu (numa caixa de 2 m isto é "dentro")
  const atras = caso(1.5, 1.6, 0), atras2 = caso(2.3, 0.6, -1);
  reg('Gol: bola atrás do véu (X 1,5 m, y 1,6 m; X 2,3 m, y 0,6 m) não é gol', `partida: ${atras.gol ? 'GOL' : 'sem gol'} / ${atras2.gol ? 'GOL' : 'sem gol'} · treino: ${atras.aviso} / ${atras2.aviso}`, 'sem gol · fora', !atras.gol && !atras2.gol && atras.aviso === 'fora' && atras2.aviso === 'fora');
  const dentro = caso(0.6, 0.5, 1.0), alto = caso(0.3, 2.2, -2.5);
  reg('Gol: bola dentro (X 0,6 m, y 0,5 m; X 0,3 m, y 2,2 m) é gol', `partida: ${dentro.gol ? 'GOL' : 'sem gol'} / ${alto.gol ? 'GOL' : 'sem gol'} · treino: ${dentro.aviso} / ${alto.aviso}`, 'GOL · gol', dentro.gol && alto.gol && dentro.aviso === 'gol' && alto.aviso === 'gol');
}

// ---------------------------------------------------------------- D) desenho (conta pura do shader)
{
  const RO = await impOpc('render/rede-onda.js');
  if (!RO || !RO.VEU_DESENHO || !RF) {
    reg('Desenho da rede em véu (render/rede-onda.js com a forma do véu)', 'não (panos da caixa: fundo, teto e laterais retos)', 'véu', false);
  } else {
    const { criarOndas, registrarImpacto, deslocamentoVetor, fixo, detectarImpactos, empurraoBola } = RO;
    // armação parada: postes, travessão, hastes e estacas do chão
    let maxF = 0;
    for (let a = 0; a <= 1.0001; a += 0.05) {
      for (const s of [1, -1]) for (const t of [-1, 1]) {
        maxF = Math.max(maxF, fixo(s * MX, HG * a, t * ZL), fixo(s * MX, HG, t * ZL * (2 * a - 1)), fixo(s * (MX + RF.VEU.haste * a), HG, t * ZL),
          fixo(s * (MX + RF.VEU.fundo), 0, t * ZL * (2 * a - 1)), fixo(s * (MX + RF.VEU.fundo * a), 0, t * ZL));
      }
    }
    const o = {}; RF.pontoPerfil(RF.COMPRIMENTO_PERFIL * 0.45, o);
    const meio = fixo(MX + o.X, o.y, 0);
    reg('Desenho: armação parada (postes, travessão, hastes, estacas)', `fixo na armação ≤ ${fmt(maxF, 6)} · no meio do véu ${fmt(meio, 3)}`, '0 · 1', maxF < 1e-9 && meio > 0.99);
    // a bolsa sai pela normal do véu no ponto da batida
    const est = criarOndas();
    registrarImpacto(est, { plano: 4, x: MX + o.X, y: o.y, z: 0.3, vel: 22, sinal: 1 }, 0);
    const D = deslocamentoVetor(est, MX + o.X, o.y, 0.3, 0.1, {});
    const amp = Math.hypot(D.x, D.y, D.z), cos = (D.x * o.nx + D.y * o.ny) / Math.max(1e-9, amp);
    reg('Desenho: a bolsa sai pela normal do véu (para trás e para cima)', `${fmt(amp)} m, ângulo com a normal ${fmt(Math.acos(Math.min(1, cos)) * 180 / Math.PI, 1)}°`, '≥ 0,3 m, ≤ 2°', amp >= 0.3 && cos >= Math.cos(2 * Math.PI / 180));
    // batidas achadas com a física (como o main.js faz, passo a passo)
    const cenas = [
      { nome: 'chute no véu por dentro', b: () => { const b = criarBola(MX - 11, 0.3); b.p.y = 0.3; b.v.x = 22; b.v.y = vyPara(11, 0.3, 22, 1.2); b.rolando = false; return b; }, plano: 4, sinal: 1 },
      { nome: 'rasteiro no fundo por dentro', b: () => { const b = criarBola(MX - 11, 0.5); b.v.x = 20; return b; }, plano: 4, sinal: 1 },
      { nome: 'bola por cima do travessão caindo no véu por fora', b: () => { const b = criarBola(MX - 0.5, 0); b.p.y = 3.2; b.v.x = 4; b.v.y = 1; b.rolando = false; return b; }, plano: 4, sinal: -1 },
      { nome: 'bola de trás no véu por fora', b: () => { const b = criarBola(MX + 5, 0); b.p.y = 0.6; b.v.x = -12; b.v.y = 1.5; b.rolando = false; return b; }, plano: 4, sinal: -1 },
      { nome: 'lateral z+ por dentro', b: () => { const b = criarBola(MX + 0.9, 0); b.p.y = 0.8; b.v.z = 15; b.v.y = 2; b.rolando = false; return b; }, plano: 7, sinal: 1 },
      { nome: 'lateral z+ por fora', b: () => { const b = criarBola(MX + 0.9, 9); b.p.y = 0.8; b.v.z = -15; b.v.y = 2; b.rolando = false; return b; }, plano: 7, sinal: -1 },
    ];
    for (const c of cenas) {
      const b = c.b(), p0 = {}, v0 = {}, out = [], ach = [];
      for (let t = 0; t < 150; t++) { Object.assign(p0, b.p); Object.assign(v0, b.v); passoBola(b, []); const n = detectarImpactos(p0, v0, b.p, b.v, out); for (let k = 0; k < n; k++) ach.push({ ...out[k] }); }
      const a = ach[0];
      reg(`Desenho: batida — ${c.nome}`, a ? `pano ${a.plano}, sinal ${a.sinal}, ${fmt(a.vel, 1)} m/s` : 'nenhuma', `pano ${c.plano}, sinal ${c.sinal}`, !!a && a.plano === c.plano && a.sinal === c.sinal);
    }
    // a bola desenhada entra na bolsa e não fura o véu deformado (chute forte, 4 quadros por passo)
    {
      const b = criarBola(MX - 11, 0.3); b.p.y = 0.3; b.v.x = 24; b.v.y = vyPara(11, 0.3, 24, 1.0); b.rolando = false;
      const est2 = criarOndas(), p0 = {}, v0 = {}, out = [], emp = { x: 0, y: 0, z: 0 }, pp = {};
      let pior = 0, entra = 0, bat = 0;
      for (let t = 0; t < 200; t++) {
        Object.assign(p0, b.p); Object.assign(v0, b.v);
        passoBola(b, []);
        const n = detectarImpactos(p0, v0, b.p, b.v, out);
        for (let k = 0; k < n; k++) if (registrarImpacto(est2, out[k], (t + 1) * PASSO)) bat++;
        for (const a of [0.25, 0.5, 0.75, 1]) {
          const tt = (t + a) * PASSO;
          const p = { x: p0.x + (b.p.x - p0.x) * a, y: p0.y + (b.p.y - p0.y) * a, z: p0.z + (b.p.z - p0.z) * a };
          empurraoBola(est2, p, tt, emp);
          const d = { x: p.x + emp.x, y: p.y + emp.y, z: p.z + emp.z };
          entra = Math.max(entra, Math.hypot(emp.x, emp.y, emp.z));
          // furo: a superfície da bola desenhada além do véu deformado (pela normal no ponto mais perto)
          const X = d.x - MX;
          if (X < 0 || Math.abs(d.z) > ZL) continue;
          RF.pertoPerfil(X, d.y, pp);
          const Dv = deslocamentoVetor(est2, MX + pp.X, pp.y, d.z, tt, {});
          const dn = (Dv.x * pp.nx + Dv.y * pp.ny) * fixo(MX + pp.X, pp.y, d.z);
          if (Math.abs(pp.d) < R + 0.6) pior = Math.max(pior, pp.d + R - dn);
        }
      }
      reg('Desenho: a bola desenhada entra na bolsa e não fura o véu', `${bat} batida(s); entra ${fmt(entra)} m; pior furo ${fmt(pior * 100, 1)} cm`, '≥ 1 batida, entra ≥ 0,2 m, furo ≤ 1 cm', bat >= 1 && entra >= 0.2 && pior <= 0.01);
    }
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-rede-veu: REPROVOU (${falhas})` : '\nteste-rede-veu: PASSOU');
process.exit(falhas ? 1 : 0);
