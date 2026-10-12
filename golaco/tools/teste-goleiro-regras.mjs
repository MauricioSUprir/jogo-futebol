// Goleiro pelas Leis do Jogo e o goleiro na mão do humano (pedidos do dono, 11/10: "eu não consigo mexer com o goleiro",
// "o goleiro só consegue pegar na mão dentro da área", "não pode recuo"). IFAB 2025/26: Regra 12.2 (recuo, lateral de
// companheiro e a bola que ele soltou → tiro livre indireto), 12.3 (mais de 8 s com a bola nas mãos → escanteio do lado
// do goleiro), 16 (tiro de meta: adversários fora da área até a bola rolar). Partida 11×11 (criarPartida), humano no
// time 0. Itens (reprovam na base — a publicada antes desta entrega — e passam depois):
//  G1 recuo do humano (PASSE do zagueiro para o goleiro, 18 cenas): nunca vai para a mão; o goleiro domina com o pé
//     (≥ 80%);
//  G3 bola na mão + analógico com CORRER: o goleiro anda (≥ 3 m), nunca sai da área, ninguém repõe por ele antes de 7,9 s;
//     o anel dos últimos 5 s aparece (só a partir de 3 s, esvaziando);
//  G4 mais de 8 s com a bola nas mãos → escanteio do adversário, do lado do campo mais perto do goleiro (100%);
//  G5 PEGAR com a bola do recuo no pé (na área) → tiro livre INDIRETO do adversário, na linha da pequena área se ela
//     estava dentro dela (100%); PEGAR sem recuo (bola que veio do adversário) → a bola vai para a mão (100%);
//  G5b ENFIADA com a bola nas mãos solta a bola no chão; PEGAR antes de outro tocar → tiro livre indireto (100%);
//  G5c cabeceio de passe de um companheiro para o goleiro: a mão vale (encaixe, 100%);
//  G5d (contraprova) chute no ar a ~1 m do goleiro controlado: martelar PEGAR não muda o lance (a bola rápida é da
//     defesa automática; antes da correção todo chute perto do corpo virava "pegou");
//  G6 goleiro a 24 m (GOLEIRO segurado), chute de 36 m: nenhuma defesa com a mão com a bola fora da área;
//  G7 TROCAR segurado (≥ 0,4 s) leva o controle ao goleiro (3/3); o goleiro controlado sem a bola anda pelo analógico
//     (≥ 2 m de diferença em 2 s contra a mesma cena sem analógico);
//  G8 tiro de meta do humano com 4 atacantes na área: nenhum adversário na área na cobrança (0/4);
//  G9 IA × IA (8 partidas): nenhum recuo com o pé agarrado; 0 s com adversário na área depois da montagem do tiro de
//     meta (corte de câmera); bola na mão ≤ 8 s.
//   node tools/teste-goleiro-regras.mjs                       (lógica do repositório)
//   node tools/teste-goleiro-regras.mjs --js <pasta js>       (outra cópia da lógica, ex.: a base)  [--partidas 8]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const NP = +arg('--partidas', 8);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js');
const { BOTAO } = await imp('config.js');
const A = await imp('acoes.js');
let RG = null;
try { RG = await imp('regras-goleiro.js'); } catch (_) { /* base: não existe */ }

const MX = 52.5;
const naArea = (m, t, x, z) => Math.abs(x - (-m.ataca[t] * MX)) < 16.5 && Math.abs(z) < 20.16;
const naPequena = (m, t, x, z) => Math.abs(x - (-m.ataca[t] * MX)) < 5.5 + 1e-6 && Math.abs(z) < 9.16;
const gkDe = (m, t) => m.jogadores.find(j => j.time === t && j.posicao === 'GOL');
const linhas = [['item', 'medido', 'meta', '']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };

function partidaEmJogo(sem) {
  const m = P.criarPartida({ semente: sem, minutosPorTempo: 60 });
  for (let i = 0; i < 600 && !(m.partida.estado === 'jogo' && !m.parada); i++) P.passoPartida(m, P.entradaDemoPartida(m));
  return m;
}
function limpar(m) {
  m.voo = null; m.naMao = null; m.posse = null; m.ultimoToque = null;
  if (m.regraMao) { m.regraMao.semMao = -1; m.regraMao.soltou = -1; }
  for (const j of m.jogadores) { j.defesa = null; j.mergulho = null; j.pedido = null; j.carga = null; j.recebe = null; j.segura = null; j.saindo = false; }
}
function darBola(m, j) {
  const b = m.bola;
  b.p.x = j.x + Math.cos(j.rumo) * 0.4; b.p.z = j.z + Math.sin(j.rumo) * 0.4; b.p.y = 0.11;
  b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0; b.rolando = true;
  m.posse = j.id;
}
/** Adversários longe (no outro campo), o goleiro do time 0 perto do gol. */
function afastarAdversarios(m) {
  const lado0 = m.ataca[0];
  let k = 0;
  for (const o of m.jogadores) if (o.time === 1 && o.posicao !== 'GOL') { P.teleportar(o, lado0 * (10 + (k % 5) * 6), -25 + (k % 7) * 8, lado0 > 0 ? Math.PI : 0); k++; }
}
function cenaRecuo(sem, D, z0) {
  const m = partidaEmJogo(sem);
  limpar(m);
  const lado0 = m.ataca[0], gx = -lado0 * MX, g = gkDe(m, 0);
  P.teleportar(g, gx + lado0 * 1.5, 0, lado0 > 0 ? 0 : Math.PI);
  afastarAdversarios(m);
  const d = m.jogadores.find(o => o.time === 0 && o.posicao === 'ZAG') ?? m.jogadores.find(o => o.time === 0 && o.posicao !== 'GOL');
  const dx = gx + lado0 * D;
  P.teleportar(d, dx, z0, Math.atan2(-z0, g.x - dx));
  limpar(m); darBola(m, d); A.assumirControle(m, 0, d);
  return { m, g, d };
}
/** Passe do zagueiro para o goleiro (o humano aperta PASSE na direção dele). true se o passe saiu. */
function recuar(m, g, d) {
  const dx = g.x - d.x, dz = g.z - d.z, l = Math.hypot(dx, dz);
  for (let i = 0; i < 60; i++) {
    const ev = P.passoPartida(m, { x: dx / l, z: dz / l, botoes: i < 22 ? BOTAO.PASSE : 0 });
    if (ev.some(x => x.tipo === 'passe' && x.id === d.id)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- G1: recuo do humano
{
  let n = 0, mao = 0, pe = 0;
  for (const sem of [11, 12]) for (const D of [12, 20, 28]) for (const z0 of [-12, 0, 12]) {
    const { m, g, d } = cenaRecuo(sem, D, z0);
    const lado0 = m.ataca[0];
    if (!recuar(m, g, d)) { n++; continue; }
    let pegou = false, comPe = false;
    for (let i = 0; i < 60 * 6; i++) {
      const ev = P.passoPartida(m, { x: lado0, z: 0, botoes: 0 });
      if (ev.some(x => x.tipo === 'defesa' && x.id === g.id && x.modo !== 'espalmada')) pegou = true;
      if (m.posse === g.id && m.naMao !== g.id) comPe = true;
      if (comPe || pegou) break;
    }
    n++; if (pegou) mao++; if (comPe) pe++;
  }
  reg('G1 recuo do humano com o pé: o goleiro agarra com a mão', `${mao}/${n}`, '0', mao === 0);
  reg('G1 recuo do humano: o goleiro domina com o pé', `${pe}/${n}`, `≥ ${Math.ceil(n * 0.8)}/${n}`, pe >= n * 0.8);
}
// ---------------------------------------------------------------- G3 + G4: bola na mão (andar, 8 s, escanteio)
{
  let n = 0, fora = 0, cantoOk = 0;
  const andou = [], segurou = [], anelOk = [];
  for (const sem of [11, 12, 13]) for (const z0 of [-8, 0, 8]) {
    const m = partidaEmJogo(sem); limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = gkDe(m, 0);
    P.teleportar(g, gx + lado0 * 4, z0, lado0 > 0 ? 0 : Math.PI);
    limpar(m);
    m.naMao = g.id; m.posse = g.id; g.segura = { desde: m.tick };
    A.assumirControle(m, 0, g);
    const x0 = g.x, z0g = g.z, t0 = m.tick;
    let maxD = 0, solta = null, canto = null, anel = { antes: false, depois: false, cai: true, ult: 2 };
    for (let i = 0; i < 60 * 10 && solta == null; i++) {
      // anda para a frente 2 s e depois de lado (para o lado da área mais perto), com CORRER
      const e = i < 120 ? { x: lado0, z: 0, botoes: BOTAO.CORRER } : { x: 0, z: z0 >= 0 ? 1 : -1, botoes: BOTAO.CORRER };
      const ev = P.passoPartida(m, e);
      for (const x of ev) if (x.tipo === 'escanteio' || (x.tipo === 'oitoSegundos')) canto = canto ?? x;
      if (m.naMao === g.id) {
        maxD = Math.max(maxD, Math.hypot(g.x - x0, g.z - z0g));
        if (!naArea(m, 0, g.x, g.z)) fora++;
        const s = (m.tick - t0) / 60, r = RG?.relogioMao ? RG.relogioMao(m, 0) : null;
        if (s < 2.9 && r) anel.antes = true;
        if (s > 3.2 && s < 7.9) { if (r) { anel.depois = true; if (r.frac > anel.ult + 1e-9) anel.cai = false; anel.ult = r.frac; } else anel.cai = false; }
      } else solta = m.tick;
    }
    n++; andou.push(maxD); segurou.push(((solta ?? m.tick) - t0) / 60);
    anelOk.push(!anel.antes && anel.depois && anel.cai);
    // escanteio do adversário (time 1), do lado do campo do goleiro
    const pr = m.parada;
    if (pr && pr.tipo === 'escanteio' && pr.time === 1 && Math.sign(pr.z) === (z0 >= 0 ? 1 : -1) && Math.sign(pr.x) === Math.sign(gx)) cantoOk++;
  }
  const minA = Math.min(...andou), minS = Math.min(...segurou);
  reg('G3 bola na mão + analógico: o goleiro anda', `mín ${minA.toFixed(2)} m (${n} cenas)`, '≥ 3 m', minA >= 3);
  reg('G3 bola na mão: nunca fora da área', `${fora} passos fora`, '0', fora === 0);
  reg('G3 ninguém repõe pelo humano antes de 7,9 s', `mín ${minS.toFixed(2)} s`, '≥ 7,9 s', minS >= 7.9);
  reg('G3 anel dos últimos 5 s (aparece aos 3 s, esvazia)', `${anelOk.filter(Boolean).length}/${n}`, `${n}/${n}`, anelOk.every(Boolean));
  reg('G4 mais de 8 s com a bola nas mãos → escanteio do adversário do lado do goleiro', `${cantoOk}/${n}`, `${n}/${n}`, cantoOk === n);
}
// ---------------------------------------------------------------- G5: PEGAR (recuo = tiro livre indireto; sem recuo = mão)
{
  let n = 0, ok = 0, nLivre = 0, okLivre = 0;
  for (const sem of [51, 52]) for (const D of [14, 22]) for (const z0 of [-6, 6]) {
    const { m, g, d } = cenaRecuo(sem, D, z0);
    const lado0 = m.ataca[0];
    if (!recuar(m, g, d)) { n++; continue; }
    // espera o goleiro dominar com o pé e o controle ir para ele; então PEGAR
    let comPe = false;
    for (let i = 0; i < 360 && !comPe; i++) { P.passoPartida(m, { x: 0, z: 0, botoes: 0 }); comPe = m.posse === g.id && m.naMao !== g.id && m.controlado[0] === g.id; }
    const bx = m.bola.p.x, bz = m.bola.p.z;
    let tl = null;
    for (let i = 0; i < 90 && !tl; i++) {
      const ev = P.passoPartida(m, { x: 0, z: 0, botoes: i === 2 ? BOTAO.PEGAR ?? 0 : 0 });
      for (const x of ev) if (x.tipo === 'tiroLivre') tl = x;
      if (m.naMao === g.id) break;
    }
    n++;
    if (tl && tl.time === 1 && tl.indireto !== false && m.parada && !m.parada.direto) {
      const dentroPeq = naPequena(m, 0, bx, bz);
      const naLinha = Math.abs(Math.abs(m.parada.x - (-lado0 * MX)) - 5.5) < 0.05;
      if (!dentroPeq || naLinha) ok++;
    }
  }
  reg('G5 PEGAR a bola do recuo no pé → tiro livre indireto do adversário (na linha da pequena área se dentro dela)', `${ok}/${n}`, `${n}/${n}`, n > 0 && ok === n);
  // sem recuo: a bola rolando do adversário para o goleiro, ele domina com o pé (controlado) e PEGAR → mão
  for (const sem of [53, 54, 55]) {
    const m = partidaEmJogo(sem); limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = gkDe(m, 0);
    P.teleportar(g, gx + lado0 * 8, 0, lado0 > 0 ? 0 : Math.PI);
    afastarAdversarios(m);
    limpar(m); darBola(m, g); A.assumirControle(m, 0, g);
    nLivre++;
    for (let i = 0; i < 30; i++) { P.passoPartida(m, { x: 0, z: 0, botoes: i === 4 ? BOTAO.PEGAR ?? 0 : 0 }); if (m.naMao === g.id) break; }
    if (m.naMao === g.id && !m.parada) okLivre++;
  }
  reg('G5 PEGAR sem recuo (bola no pé, na área): a bola vai para a mão', `${okLivre}/${nLivre}`, `${nLivre}/${nLivre}`, okLivre === nLivre);
}
// ---------------------------------------------------------------- G5b: ENFIADA solta no chão; PEGAR de novo = infração
{
  let n = 0, soltou = 0, infr = 0;
  for (const sem of [56, 57, 58]) {
    const m = partidaEmJogo(sem); limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = gkDe(m, 0);
    P.teleportar(g, gx + lado0 * 6, 0, lado0 > 0 ? 0 : Math.PI);
    afastarAdversarios(m);
    limpar(m);
    m.naMao = g.id; m.posse = g.id; g.segura = { desde: m.tick - 60 };
    A.assumirControle(m, 0, g);
    n++;
    let noPe = false, tl = false;
    for (let i = 0; i < 120; i++) {
      const bot = i < 6 ? BOTAO.ENFIADA : (noPe && i > 40 && i < 44 ? (BOTAO.PEGAR ?? 0) : 0);
      const ev = P.passoPartida(m, { x: 0, z: 0, botoes: bot });
      if (m.posse === g.id && m.naMao == null) noPe = true;
      if (ev.some(x => x.tipo === 'tiroLivre' && x.time === 1)) { tl = true; break; }
    }
    if (noPe) soltou++;
    if (tl) infr++;
  }
  reg('G5b ENFIADA com a bola nas mãos solta a bola no pé', `${soltou}/${n}`, `${n}/${n}`, soltou === n);
  reg('G5b PEGAR a bola que ele soltou, antes de outro tocar → tiro livre indireto', `${infr}/${n}`, `${n}/${n}`, infr === n);
}
// ---------------------------------------------------------------- G5c: cabeceio de passe do companheiro: a mão vale
{
  let n = 0, mao = 0;
  for (const sem of [61, 62, 63]) for (const D of [10, 14]) {
    const m = partidaEmJogo(sem); limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = gkDe(m, 0);
    P.teleportar(g, gx + lado0 * 1.5, 0, lado0 > 0 ? 0 : Math.PI);
    afastarAdversarios(m);
    const d = m.jogadores.find(o => o.time === 0 && o.posicao === 'ZAG');
    P.teleportar(d, gx + lado0 * D, 2, Math.atan2(-2, g.x - (gx + lado0 * D)));
    limpar(m); A.assumirControle(m, 0, d);
    // a bola na cabeça do zagueiro: cabeceio de passe na direção do goleiro (o humano aponta o analógico)
    const b = m.bola; b.p.x = d.x + Math.cos(d.rumo) * 0.3; b.p.z = d.z + Math.sin(d.rumo) * 0.3; b.p.y = 1.8; b.v.x = b.v.y = b.v.z = 0; b.rolando = false;
    d.imag = 1; d.ix = Math.cos(d.rumo); d.iz = Math.sin(d.rumo);
    A.executarCabeceio(m, d, { tipo: 'passe', forca: 0.5 });
    n++;
    for (let i = 0; i < 180; i++) {
      const ev = P.passoPartida(m, { x: 0, z: 0, botoes: 0 });
      if (ev.some(x => x.tipo === 'defesa' && x.id === g.id && x.modo !== 'espalmada')) { mao++; break; }
      if (m.posse != null && m.posse !== g.id) break;
    }
  }
  reg('G5c cabeceio de passe de um companheiro para o goleiro: a mão vale (encaixe)', `${mao}/${n}`, `${n}/${n}`, mao === n);
}
// ---------------------------------------------------------------- G5d: PEGAR não pega chute no ar (contraprova)
// O goleiro controlado pelo humano, chute de 9 m a 28–36 m/s passando a ~1 m dele (sem o botão: gol). Martelando PEGAR
// (a cada 2 passos), o resultado tem que ser o MESMO de sem o botão: a bola rápida é da defesa automática (antes da
// correção, 100% viravam "pegou" — o goleiro controlado ficava imbatível em chute perto do corpo).
{
  let n = 0, igual = 0, pegouBotao = 0;
  const lance = (sem, zl, v, martela) => {
    const m = partidaEmJogo(sem); limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = gkDe(m, 0);
    P.teleportar(g, gx + lado0 * 2, 0, lado0 > 0 ? 0 : Math.PI);
    const atk = m.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL');
    P.teleportar(atk, gx + lado0 * 9, 0, lado0 > 0 ? Math.PI : 0);
    for (const o of m.jogadores) if (o !== g && o !== atk && o.posicao !== 'GOL') P.teleportar(o, lado0 * 20, o.z, o.rumo);
    A.assumirControle(m, 0, g);
    limpar(m);
    const b = m.bola; b.p.x = atk.x - lado0 * 0.5; b.p.z = 0; b.p.y = 0.11;
    const ux = gx - b.p.x, uz = zl - b.p.z, l = Math.hypot(ux, uz);
    b.v.x = ux / l * v; b.v.z = uz / l * v; b.v.y = 0.3; b.w.x = b.w.y = b.w.z = 0; b.rolando = false;
    m.voo = { tipo: 'chute', de: atk.id, time: 1, para: null, alvo: { x: gx, z: zl }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick, alto: false };
    m.ultimoToque = { id: atk.id, time: 1, tick: m.tick };
    for (let i = 0; i < 120; i++) {
      const ev = P.passoPartida(m, { x: 0, z: 0, botoes: martela && i % 2 === 0 ? (BOTAO.PEGAR ?? 0) : 0 });
      if (ev.some(e => e.tipo === 'gol')) return 'gol';
      const d = ev.find(e => e.tipo === 'defesa' && e.id === g.id);
      if (d) return d.modo;
    }
    return 'outro';
  };
  for (const sem of [71, 72]) for (const zl of [-1.0, 0.9]) for (const v of [28, 34]) {
    const a = lance(sem, zl, v, false), b = lance(sem, zl, v, true);
    n++; if (a === b) igual++; if (b === 'pegou' && a !== 'pegou') pegouBotao++;
  }
  reg('G5d chute no ar a ~1 m do goleiro controlado: martelar PEGAR não muda o lance', `${igual}/${n} iguais (${pegouBotao} "pegou" só pelo botão)`, `${n}/${n}`, igual === n);
}
// ---------------------------------------------------------------- G7: TROCAR segurado vai para o goleiro; o analógico o move
{
  let n = 0, foi = 0;
  const dif = [];
  for (const sem of [21, 22, 23]) {
    const m = partidaEmJogo(sem);
    for (let i = 0; i < 40; i++) P.passoPartida(m, { x: 0, z: 0, botoes: BOTAO.TROCAR }); // segura TROCAR 0,67 s
    const g = gkDe(m, 0);
    n++; if (m.controlado[0] === g.id) foi++;
    const run = (anal) => {
      const q = partidaEmJogo(sem), gg = gkDe(q, 0); A.assumirControle(q, 0, gg);
      const tr = [];
      for (let i = 0; i < 120; i++) { if (q.controlado[0] !== gg.id) A.assumirControle(q, 0, gg); P.passoPartida(q, anal ? { x: 0, z: 1, botoes: 0 } : { x: 0, z: 0, botoes: 0 }); tr.push([gg.x, gg.z]); }
      return tr;
    };
    const a = run(true), b = run(false);
    dif.push(Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]))));
  }
  reg('G7 TROCAR segurado (≥ 0,4 s) leva o controle ao goleiro', `${foi}/${n}`, `${n}/${n}`, foi === n);
  reg('G7 goleiro controlado sem bola: o analógico o move (2 s)', `mín ${Math.min(...dif).toFixed(3)} m de diferença`, '≥ 2 m', Math.min(...dif) >= 2);
}
// ---------------------------------------------------------------- G6: com a bola fora da área, nada de mão
{
  let n = 0, fora = 0;
  for (const sem of [31, 32]) for (const z of [-2, 0, 2]) for (const v of [22, 26, 30]) {
    const m = partidaEmJogo(sem); limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX, g = gkDe(m, 0);
    P.teleportar(g, gx + lado0 * 24, z, lado0 > 0 ? 0 : Math.PI);
    const atk = m.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL');
    P.teleportar(atk, gx + lado0 * 36, z * 1.5, lado0 > 0 ? Math.PI : 0);
    for (const o of m.jogadores) if (o !== g && o !== atk && o.posicao !== 'GOL') P.teleportar(o, lado0 * 20, o.z, o.rumo);
    limpar(m);
    const b = m.bola; b.p.x = atk.x - lado0 * 0.5; b.p.z = atk.z; b.p.y = 0.11;
    const ux = gx - b.p.x, uz = 0.4 * Math.sign(z || 1) - b.p.z, l = Math.hypot(ux, uz);
    b.v.x = ux / l * v; b.v.z = uz / l * v; b.v.y = 1.2; b.w.x = b.w.y = b.w.z = 0; b.rolando = false;
    m.voo = { tipo: 'chute', de: atk.id, time: 1, para: null, alvo: { x: gx, z: 0 }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick, alto: false };
    m.ultimoToque = { id: atk.id, time: 1, tick: m.tick };
    n++;
    for (let i = 0; i < 150; i++) {
      const bx = m.bola.p.x, bz = m.bola.p.z;
      const ev = P.passoPartida(m, { x: 0, z: 0, botoes: BOTAO.GOLEIRO });
      if (ev.some(e => e.tipo === 'defesa' && e.id === g.id && !naArea(m, 0, bx, bz))) { fora++; break; }
      if (ev.some(e => e.tipo === 'defesa' || e.tipo === 'gol')) break;
    }
  }
  reg('G6 goleiro a 24 m (GOLEIRO segurado), chute de 36 m: defesa com a mão com a bola fora da área', `${fora}/${n}`, '0', fora === 0);
}
// ---------------------------------------------------------------- G8: tiro de meta do humano com 4 atacantes na área
{
  let n = 0, com = 0;
  for (const sem of [41, 42, 43, 44]) {
    const m = partidaEmJogo(sem); limpar(m);
    const lado0 = m.ataca[0], gx = -lado0 * MX;
    const atks = m.jogadores.filter(o => o.time === 1 && o.posicao !== 'GOL').slice(0, 4);
    atks.forEach((o, k) => P.teleportar(o, gx + lado0 * (5 + 3 * k), -6 + 4 * k, lado0 > 0 ? Math.PI : 0));
    const b = m.bola; b.p.x = gx - lado0 * 0.5; b.p.z = 9; b.p.y = 0.11; b.v.x = -lado0 * 3; b.v.y = 0; b.v.z = 0; b.rolando = true;
    m.partida.ultimoTime = 1; m.partida.ultimoId = atks[0].id; m.partida.ultimoTick = m.tick;
    let cobrou = false;
    for (let i = 0; i < 600 && !cobrou; i++) {
      const pr = m.parada, montada = pr && pr.tipo === 'tiroDeMeta' && pr.cobrador != null && !pr.rolou;
      const e = montada ? { x: lado0, z: 0.3, botoes: (m.tick - pr.desde) % 30 < 12 ? BOTAO.PASSE : 0 } : { x: 0, z: 0, botoes: 0 };
      for (const x of P.passoPartida(m, e)) if (x.tipo === 'cobranca' && x.parada === 'tiroDeMeta') {
        cobrou = true; n++;
        if (m.jogadores.some(o => o.time === 1 && naArea(m, 0, o.x, o.z))) com++;
      }
    }
  }
  reg('G8 tiro de meta do humano (PASSE na montagem, 4 atacantes na área): adversário na área na cobrança', `${com}/${n}`, '0', n === 4 && com === 0);
}
// ---------------------------------------------------------------- G9: IA × IA
if (NP > 0) {
  let recuo = 0, tmAdvSeg = 0, tm = 0, maxMao = 0;
  for (let k = 0; k < NP; k++) {
    const m = P.criarPartida({ semente: 1001 + k, minutosPorTempo: 4 });
    let ult = null, desde = null;
    for (let i = 0; i < 2 * 4 * 3600 + 3600 && m.partida.estado !== 'fim'; i++) {
      const pr = m.parada;
      if (pr && pr.tipo === 'tiroDeMeta' && pr.cobrador != null && !pr.rolou && m.jogadores.some(o => o.time !== pr.time && naArea(m, pr.time, o.x, o.z))) tmAdvSeg += 1 / 60;
      const antes = m.naMao;
      const ev = P.passoPartida(m, P.entradaDemoPartida(m));
      for (const e of ev) {
        if (e.tipo === 'cobranca' && e.parada === 'tiroDeMeta') tm++;
        if (e.tipo === 'defesa' && e.modo !== 'espalmada') {
          const g = m.jogadores.find(j => j.id === e.id);
          if (ult && g && ult.time === g.time && ult.id !== g.id && ult.pe) recuo++;
        }
      }
      if (m.naMao != null && antes == null && !ev.some(e => e.tipo === 'tiroDeMeta')) desde = m.tick;
      if (m.naMao == null && desde != null) { maxMao = Math.max(maxMao, (m.tick - desde) / 60); desde = null; }
      for (const e of ev) {
        const j = e.id != null ? m.jogadores.find(q => q.id === e.id) : null;
        if (!j) continue;
        if (e.tipo === 'passe' || e.tipo === 'chute') ult = { id: j.id, time: j.time, pe: e.modo !== 'cabeceio' };
        else if (e.tipo === 'cabeceio') ult = { id: j.id, time: j.time, pe: false };
        else if (e.tipo === 'bateuCorpo' || e.tipo === 'roubada') ult = { id: j.id, time: j.time, pe: e.tipo === 'roubada' };
      }
      if (m.posse != null && m.naMao == null) { const d = m.jogadores.find(q => q.id === m.posse); if (d && d.posicao !== 'GOL') ult = { id: d.id, time: d.time, pe: true }; }
      if (m.parada && !m.parada.rolou) ult = null;
    }
  }
  reg(`G9 IA×IA (${NP} partidas): recuo com o pé agarrado pelo goleiro`, `${recuo}`, '0', recuo === 0);
  reg(`G9 IA×IA: segundos com adversário na área depois da montagem do tiro de meta (${tm} tiros)`, `${tmAdvSeg.toFixed(1)} s`, '0 (corte de câmera)', tmAdvSeg < 0.05);
  reg('G9 IA×IA: bola na mão do goleiro', `máx ${maxMao.toFixed(2)} s`, '≤ 8 s', maxMao <= 8);
}
const larg = [0, 1, 2, 3].map(c => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(`lógica: ${JS}`);
for (const l of linhas) console.log(l.map((v, c) => String(v).padEnd(larg[c])).join(' | '));
console.log(falhas ? `\nteste-goleiro-regras: REPROVOU (${falhas})` : '\nteste-goleiro-regras: PASSOU');
process.exit(falhas ? 1 : 0);
