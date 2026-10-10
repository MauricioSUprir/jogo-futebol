// Movimento dos jogadores da IA sem a bola (dono, 09/10: "o movimento dos jogadores tá meio
// estranho"). Treino de ataque jogado pela IA (o que se vê em volta do jogador), 3 sementes × 3 min,
// só jogadores de linha da IA (sem o controlado). Mede o que o olho estranha em jogo ESTÁVEL (fora
// do 1 s depois de a bola trocar de time: reagir à perda/recuperação é virada legítima — o total,
// com as transições, também tem limite):
//  - vai e volta: a direção do movimento inverte (> 135°) em 0,25–1 s;
//  - tremor do tronco: o giro troca de sentido (> 1,5 rad/s dos dois lados) em ≤ 0,4 s;
//  - anda-para-anda: > 2,5 m/s → < 0,5 m/s → > 2,5 m/s em ≤ 2 s;
//  - de costas para a bola andando devagar (< 2 m/s, bola a > 2 m);
//  - amontoado: companheiro a < 2 m (dois marcando o mesmo homem, todos na bola);
//  - trombadas entre companheiros (começo de contato a < 0,65 m).
// E o que não pode piorar (sem recuo): o treino chega ao chute e a defesa pressiona o condutor.
//   node tools/teste-movimento.mjs              (lógica do repositório)
//   node tools/teste-movimento.mjs --js <pasta> (mede outra cópia da lógica, ex.: a publicada)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ia = process.argv.indexOf('--js');
const JS = ia > 0 ? path.resolve(process.argv[ia + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const { criarTreino, passoTreino, entradaDemo } = await imp('sessao.js');
const { PASSO } = await imp('config.js');

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const fmt = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
const dif = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };

const SEMENTES = [1, 2, 3, 4], MIN = 3, N = Math.round(MIN * 60 / PASSO);
const A = { seg: 0, segEst: 0, inv: 0, invEst: 0, tremor: 0, tremorEst: 0, paraArranca: 0, lento: 0, costas: 0, viz: 0, viz2: 0, contatos: 0, trocas: 0 };
let chutesMin = Infinity, pressao = 0, pressaoN = 0, assentada = 0, assentadaN = 0, dois = 0;

for (const sem of SEMENTES) {
  const m = criarTreino({ semente: sem });
  const H = new Map(); // id → últimos 60 ticks {vx, vz, giro}
  const st = new Map(); // id → estado (inversão, tremor, para-arranca)
  let pular = 0, chutes = 0, timeBola = null, ultTroca = -999, donoAnt = null, desde = 0;
  for (let i = 0; i < N; i++) {
    const ev = passoTreino(m, entradaDemo(m));
    for (const e of ev) if (e.tipo === 'chute') chutes++;
    // time com a bola (no pé, nas mãos ou o passe/chute no ar dele)
    const idB = m.posse ?? m.naMao;
    const tb = idB != null ? m.jogadores.find(o => o.id === idB)?.time : m.voo ? m.voo.time : timeBola;
    if (tb != null && tb !== timeBola) { if (timeBola != null) { A.trocas++; ultTroca = i; } timeBola = tb; }
    const est = i - ultTroca > 60;
    // recomeço (bola de volta ao meio): o mundo salta, não conta 0,75 s
    if (ev.some(e => e.tipo === 'recomeco')) { pular = 45; H.clear(); st.clear(); }
    if (pular > 0) { pular--; continue; }
    const b = m.bola.p;
    const ctrl = m.controlado[0];
    // defesa pressiona quem conduz: alguém do time 1 a ≤ 3 m do condutor do time 0
    if (m.posse != null) {
      const d0 = m.jogadores.find(o => o.id === m.posse);
      if (d0 && d0.time === 0) {
        pressaoN++;
        const perto = m.jogadores.filter(o => o.time === 1 && o.posicao !== 'GOL' && Math.hypot(o.x - d0.x, o.z - d0.z) <= 3).length;
        if (perto >= 1) pressao++;
        if (perto >= 2) dois++;
        // posse assentada: o mesmo condutor há mais de 1,5 s (fora o bate-rebate depois de uma perda)
        if (d0.id === donoAnt && i - desde > 90) { assentadaN++; if (perto >= 1) assentada++; }
        if (d0.id !== donoAnt) { donoAnt = d0.id; desde = i; }
      }
    }
    const linha = m.jogadores.filter(o => o.posicao !== 'GOL' && o.papel === 'ia');
    for (const j of linha) {
      const h = H.get(j.id) ?? [];
      h.push({ vx: j.vx, vz: j.vz, giro: j.giro, x: j.x, z: j.z });
      if (h.length > 61) h.shift();
      H.set(j.id, h);
      const s = st.get(j.id) ?? { ultInv: -999, ultTrem: -999, rapido: false, paradoEm: -1 };
      st.set(j.id, s);
      if (j.id === ctrl || m.posse === j.id || m.naMao === j.id) continue;
      A.seg += PASSO;
      if (est) A.segEst += PASSO;
      const v = Math.hypot(j.vx, j.vz), dirv = Math.atan2(j.vz, j.vx);
      if (v > 0.8 && i - s.ultInv > 45) {
        for (let k = 15; k <= 60 && k < h.length; k++) {
          const o = h[h.length - 1 - k];
          if (Math.hypot(o.vx, o.vz) > 0.8 && Math.abs(dif(Math.atan2(o.vz, o.vx), dirv)) > 3 * Math.PI / 4) { A.inv++; if (est) A.invEst++; s.ultInv = i; break; }
        }
      }
      if (Math.abs(j.giro) > 1.5 && i - s.ultTrem > 10) {
        for (let k = 1; k <= 24 && k < h.length; k++) {
          const o = h[h.length - 1 - k];
          if (Math.abs(o.giro) > 1.5 && Math.sign(o.giro) !== Math.sign(j.giro)) { A.tremor++; if (est) A.tremorEst++; s.ultTrem = i; break; }
        }
      }
      if (v > 2.5) { if (s.paradoEm >= 0 && i - s.paradoEm <= 120) A.paraArranca++; s.paradoEm = -1; s.rapido = true; }
      else if (v < 0.5 && s.rapido && s.paradoEm < 0) { s.paradoEm = i; s.rapido = false; }
      const db = Math.hypot(b.x - j.x, b.z - j.z);
      if (v < 2 && db > 2) {
        A.lento++;
        if (Math.abs(dif(Math.atan2(b.z - j.z, b.x - j.x), j.rumo)) > Math.PI / 2) A.costas++;
      }
      let dm = Infinity;
      for (const o of m.jogadores) {
        if (o === j || o.time !== j.time || o.posicao === 'GOL') continue;
        const d = Math.hypot(o.x - j.x, o.z - j.z);
        dm = Math.min(dm, d);
        if (o.id > j.id && o.papel === 'ia' && o.id !== ctrl) {
          const ho = H.get(o.id);
          if (ho && ho.length >= 2 && h.length >= 2) {
            const a = ho[ho.length - 2], c = h[h.length - 2];
            if (d < 0.65 && Math.hypot(a.x - c.x, a.z - c.z) >= 0.65) A.contatos++;
          }
        }
      }
      if (dm < Infinity) { A.viz++; if (dm < 2) A.viz2++; }
    }
  }
  chutesMin = Math.min(chutesMin, chutes);
}

const porMin = (x, seg = A.seg) => x / (seg / 60);
const pct = (a, b) => (b ? 100 * a / b : NaN);
console.log(`lógica: ${JS}\n${SEMENTES.length} sementes × ${MIN} min, ${fmt(A.seg / 60, 0)} min·jogador da IA sem a bola (${fmt(pct(A.segEst, A.seg), 0)}% em jogo estável), ${fmt(A.trocas / (SEMENTES.length * MIN), 1)} trocas de time com a bola/min`);
reg('vai e volta (direção inverte em ≤ 1 s), jogo estável', `${fmt(porMin(A.invEst, A.segEst))}/min por jogador`, '≤ 8/min', porMin(A.invEst, A.segEst) <= 8);
reg('vai e volta, total (com as transições)', `${fmt(porMin(A.inv))}/min`, '≤ 11/min', porMin(A.inv) <= 11);
reg('tremor do tronco (giro troca de lado em ≤ 0,4 s), jogo estável', `${fmt(porMin(A.tremorEst, A.segEst))}/min`, '≤ 7/min', porMin(A.tremorEst, A.segEst) <= 7);
reg('tremor do tronco, total', `${fmt(porMin(A.tremor))}/min`, '≤ 10/min', porMin(A.tremor) <= 10);
reg('anda-para-anda (≤ 2 s)', `${fmt(porMin(A.paraArranca))}/min`, '≤ 4/min', porMin(A.paraArranca) <= 4);
reg('de costas para a bola andando devagar', `${fmt(pct(A.costas, A.lento))}%`, '≤ 15%', pct(A.costas, A.lento) <= 15);
reg('companheiro a menos de 2 m (amontoado)', `${fmt(pct(A.viz2, A.viz))}% do tempo`, '≤ 10%', pct(A.viz2, A.viz) <= 10);
reg('trombadas entre companheiros', `${fmt(porMin(A.contatos), 2)}/min`, '≤ 2/min', porMin(A.contatos) <= 2);
reg('sem recuo — treino chega ao chute', `pior semente: ${chutesMin} chutes em ${MIN} min`, '≥ 5', chutesMin >= 5);
reg('sem recuo — defesa pressiona o condutor (marcador a ≤ 3 m)', `${fmt(pct(pressao, pressaoN))}% do tempo com a bola (2+ marcadores: ${fmt(pct(dois, pressaoN))}%)`, '≥ 40%', pct(pressao, pressaoN) >= 40);
reg('sem recuo — pressão na posse assentada (mesmo condutor > 1,5 s)', `${fmt(pct(assentada, assentadaN))}%`, '≥ 50% (publicada: 59%)', pct(assentada, assentadaN) >= 50);

const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-movimento: REPROVOU (${falhas})` : '\nteste-movimento: PASSOU');
process.exit(falhas ? 1 : 0);
