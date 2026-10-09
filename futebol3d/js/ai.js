// IA tática: bloco do time conforme a formação e a bola, pressão, cobertura,
// marcação, apoio ao portador, infiltrações sem ficar impedido, decisão de quem
// conduz (chutar, passar, enfiar, cruzar, driblar, afastar) e bolas paradas.
import { PITCH, GOAL, PLAYER, ANIM, clamp, lerp, angDiff } from './config.js';
import { updateIntensity, roleUtility } from './tactics.js';

// chance (por avaliação, ~3 por segundo com a bola) de a IA não ver um atacante pouco impedido
const OFFSIDE_MISS = 0.85;
// quanto o centroavante avança sobre a linha, em média, quando joga nela (m)
const LINE_PLAY = 1.7;
const HL = PITCH.halfL, HW = PITCH.halfW;
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// tempo para percorrer g metros partindo a v0 e acelerando (~4,5 m/s²) até vmax
function tempoAte(g, v0, vmax, a = 4.5) {
  if (g <= 0) return 0;
  const t1 = Math.max(0, (vmax - v0) / a), d1 = v0 * t1 + 0.5 * a * t1 * t1;
  if (g <= d1) return (-v0 + Math.sqrt(v0 * v0 + 2 * a * g)) / a;
  return t1 + (g - d1) / vmax;
}

export function humanDriving(m, p) {
  return p === m.controlled && p.team.human &&
    (m.phase === 'play' || (m.phase === 'setpiece' && m.sp && (m.sp.taker === p || (m.sp.type === 'penalty' && p.isGK))));
}

// Tempo até cada jogador alcançar a bola (usa a previsão da trajetória).
function intercepts(m, t) {
  const pr = m.pred;
  for (const p of t.players) {
    if (p.sentOff) { p.interceptT = 99; continue; }
    // quem antecipa bem lê a bola mais cedo (seção 7: "esse zagueiro antecipa")
    const react = p.human ? 0.1 : m.diff.aiReaction * 0.6 * (1.3 - (p.a.ant ?? p.a.def) / 99 * 0.6);
    const v = p.sprintSpd * 0.92;
    let found = -1;
    for (let k = 0; k < pr.n; k++) {
      const y = pr.y(k);
      if (y > 2.4) continue;
      const d = Math.hypot(pr.x(k) - p.x, pr.z(k) - p.z) - 0.7;
      const need = react + Math.max(0, d) / v + (d > 1 ? 0.25 : 0);
      if (need <= pr.t(k)) { found = k; break; }
    }
    if (found < 0) {
      const k = pr.n - 1;
      p.interceptK = k; p.ix = pr.x(k); p.iz = pr.z(k);
      p.interceptT = pr.t(k) + Math.hypot(p.ix - p.x, p.iz - p.z) / v;
    } else {
      p.interceptK = found; p.ix = pr.x(found); p.iz = pr.z(found); p.interceptT = pr.t(found);
    }
    if (m.ball.held) { p.ix = m.ball.p.x; p.iz = m.ball.p.z; p.interceptT = Math.hypot(p.ix - p.x, p.iz - p.z) / v; }
  }
}

// linha de impedimento (penúltimo adversário) no referencial de ataque do time
function attackingPrev(t) { return !!t.attacking; }

function offsideLine(m, t) {
  const ds = t.opp.players.filter(q => !q.sentOff).map(q => m.lx(t, q.x)).sort((a, b) => b - a);
  return Math.max(0, ds[1] ?? HL, m.lx(t, m.ball.p.x));
}

export function teamThink(m, t, dt) {
  intercepts(m, t);
  updateIntensity(m, t, dt);
  const inten = t.intensity ?? 0.5;
  const b = m.ball.p;
  const owner = m.owner;
  const attacking = owner ? owner.team === t : (m.lastTouch ? m.lastTouch.team === t : false);
  t.attacking = attacking;
  const offLine = offsideLine(m, t);
  // a linha que o atacante "enxerga": quando a defesa sobe (linha avança) ele recua com atraso
  // (~1,5 m/s); quando a defesa recua, acompanha na hora — o impedimento clássico da vida real
  if (t.lineSeen === undefined || !attackingPrev(t)) t.lineSeen = offLine;
  else t.lineSeen = offLine >= t.lineSeen ? offLine : Math.max(offLine, t.lineSeen - 1.5 * dt);
  // velocidade da linha (m/s, referencial de ataque): quem joga nela anda junto com o zagueiro
  if (t.prevOff !== undefined && dt > 0) t.lineV = lerp(t.lineV ?? 0, clamp((offLine - t.prevOff) / dt, -9, 9), 1 - Math.exp(-dt / 0.25));
  t.prevOff = offLine;
  const outfield = t.players.filter(p => !p.sentOff && !p.isGK);

  // perseguidor da bola solta
  let chaser = null;
  if (!owner || owner.team !== t) {
    for (const p of outfield) if (p.canPlay() && (!chaser || p.interceptT < chaser.interceptT)) chaser = p;
  }
  t.chaser = chaser;

  // pressionadores quando o adversário tem a bola
  let press1 = null, press2 = null, gatilho = false;
  if (owner && owner.team === t) t.tinhaBolaT = m.time;
  if (owner && owner.team !== t) {
    const sorted = outfield.filter(p => p.canPlay()).sort((a, c) => dist(a, owner) - dist(c, owner));
    press1 = sorted[0]; press2 = sorted[1];
    gatilho = gatilhoPressao(m, t, owner);
  }

  // alvos de formação
  for (const p of outfield) shapeTarget(m, t, p, attacking, offLine, t.lineSeen);
  flattenLine(m, t, outfield, attacking);
  if (!attacking) mark(m, t, outfield, press1, press2);
  else if (owner && owner.team === t) {
    support(m, t, outfield, owner, offLine, dt);
    // utilidade individual por função (§18): os que não estão no apoio imediato
    for (const p of outfield) if (!p.supportNow) roleUtility(m, t, p, owner, offLine);
    // centroavante "joga na linha": perto dela, oscila em volta (às vezes fica um pouco
    // adiantado — é daí que saem os impedimentos quando quem passa não percebe)
    for (const p of outfield) {
      if (p.role !== 'ATT' || Math.abs(t.formation[p.slot][2]) >= 10 || p.supportNow || p.runUntil > m.time) continue;
      const lxT = Math.max(m.lx(t, p.target.x), t.lineSeen - 1.1);
      if (lxT > offLine - 3) p.target.x = (lxT + LINE_PLAY + 0.75 * Math.sin(m.time * 1.1 + p.idx * 1.7)) * t.dir;
    }
    boxRuns(m, t, outfield, owner, offLine);
  } else if (!owner) {
    // cruzamento no ar: quem atacava a área segue para o seu ponto (impedimento já foi julgado no toque)
    const lk = m.lastKick;
    if (lk && lk.kind === 'cross' && lk.p.team === t && m.time - lk.t < 2.2) boxRuns(m, t, outfield, null, HL);
  }

  const aerea = pontoAereo(m);
  for (const p of t.players) {
    if (p.sentOff || p.isGK) continue;
    if (humanDriving(m, p)) continue;
    p.face = null; p.jockey = false; p.shielding = false;
    p.slow = 1;
    const phase = m.phase;
    if (phase === 'goal') { celebrate(m, p); continue; }
    if (phase === 'stopped' || phase === 'halftime' || phase === 'fulltime' || phase === 'ended') {
      if (m.shootout) { p.dx = p.dz = 0; continue; }
      p.moveTo(p.target.x, p.target.z, 0.25, false);
      p.face = b;
      continue;
    }
    if (phase === 'setpiece') continue;   // setpieceAI cuida
    if (p.stun > 0 || (p.action && ['slide', 'fall', 'getup', 'dejected'].includes(p.action.type))) continue;

    if (owner === p) { p.aiMode = 'condutor'; carrierThink(m, p, dt); continue; }
    p.aiMode = 'outro';
    if (tryAerial(m, p)) continue;
    // escanteio recém-cobrado: quem ataca a bola corre para a sua zona; quem marca acompanha o seu homem
    if (p.spRun && m.time < p.spRun.ate) { p.aiMode = 'escanteio'; p.moveTo(p.spRun.x, p.spRun.z, 1, true); p.face = b; continue; }
    if (p.spMarca && m.time < p.spMarca.ate) {
      const q = p.spMarca.q, og = m.ownGoalX(t);
      p.aiMode = 'marca-escanteio'; p.moveTo(q.x + Math.sign(og - q.x) * 0.9, q.z * 0.95, 1, true); p.face = b; continue;
    }
    // bola alta chegando: os dois de cada time que alcançam o ponto onde ela desce na altura da cabeça vão
    // lá disputar (antes ia só quem buscava a bola no chão, e chegava atrasado para o cabeceio)
    // (o destinatário do passe/cruzamento fica no "recebe": é lá que ele decide o voleio e o chute de primeira —
    // na disputa aérea ele só ia ao ponto da bola e os voleios da área caíram de 2,3 para 0,5 por partida)
    const pt = m.passTarget;
    if (!owner && aerea && aerea.de(t).includes(p) && !(pt && pt.p === p)) { p.aiMode = 'disputa-aerea'; p.moveTo(aerea.x, aerea.z, 1, true); p.face = b; continue; }

    if (pt && pt.p === p && !owner) {
      // vai ao encontro do passe
      p.aiMode = 'recebe';
      p.moveTo(p.ix, p.iz, 1, true);
      p.face = b;
      aiFirstTime(m, p);
      continue;
    }
    if (p === chaser && !owner && !m.ball.held) {
      p.aiMode = 'perseguidor';
      p.moveTo(p.ix, p.iz, 1, p.interceptT > 0.6);
      continue;
    }
    if (p === press1) { p.aiMode = 'pressao1'; pressCarrier(m, p, owner, dt, 1, gatilho); continue; }
    // 2º pressionador: estilo do time, intensidade alta ou o Motor que não para
    // (e na saída de bola do adversário, no campo dele: pressão alta — é dali que sai o roubo de bola
    // perto da área, a jogada que mais vira chute no futebol de hoje)
    if (p === press2 && (t.style.press > 0.55 || inten > 0.66 || p.traits.includes('motor') && inten > 0.5 || m.lx(t, owner.x) < -20 || m.lx(t, owner.x) > 24 || m.teamPressCall === t || gatilho)) { p.aiMode = 'pressao2'; pressCarrier(m, p, owner, dt, 2, gatilho); continue; }
    // enfiada ou lançamento sendo armado para ele, perto da linha: o atacante "sai no tempo do
    // passe" — segura em posição legal e arranca para cruzar a linha junto com o toque na bola.
    // O tempo dele tem erro (~0,2 s, menor no bom finalizador): quem sai cedo demais está
    // adiantado no instante do passe — é o impedimento clássico da vida real
    const armaKind = owner && owner.team === t ? (owner.prep?.q === p ? owner.prep.kind
      : owner.action && !owner.action.fired && owner.action.data?.receiver === p ? owner.action.type : null) : null;
    if ((armaKind === 'through' || armaKind === 'long') && m.lx(t, p.x) > offLine - 9) {
      // erro de tempo: ~0,35 s de desvio, puxado para o "cedo" (o atacante ansioso sai antes)
      if (p.runErr === undefined) p.runErr = (gauss() * 0.4 - 0.22) * (1.3 - m.diff.aiSkill * 0.6) * (p.traits.includes('cacador') ? 0.6 : 1);
      const ac = owner.action;
      const tKick = owner.prep ? Math.max(0, owner.prep.until - m.time) + (owner.prep.kind === 'through' ? 0.28 : 0.21) : Math.max(0, ac.contactT - ac.t);
      // chegada na linha relativa a ela: quem passa tem tempo, a defesa recua (a linha "foge")
      const lv = t.lineV || 0;
      const tLinha = tempoAte(offLine - m.lx(t, p.x), Math.max(0, p.vx * t.dir - lv), p.sprintSpd - Math.max(0, lv), 4);
      p.aiMode = 'infiltracao';
      if (tKick - tLinha + p.runErr <= 0) p.moveTo((offLine + 8) * t.dir, p.z, 1, true);   // sai
      else followLine(m, p, (offLine - 0.6) * t.dir, p.z, false);                           // segura na linha
      continue;
    }
    if (!armaKind) p.runErr = undefined;
    if (p.runUntil > m.time && attacking) {
      p.aiMode = 'infiltracao';
      const tgx = Math.min(p.target.x * t.dir, offLine - 0.4 + (p.runLate || 0)) * t.dir;
      followLine(m, p, tgx, p.target.z, Math.hypot(tgx - p.x, p.target.z - p.z) > 5);
      continue;
    }
    const far = Math.hypot(p.target.x - p.x, p.target.z - p.z);
    // quem ficou para trás do ataque acompanha correndo (sem arrancar): antes os meias trotavam e o
    // condutor chegava sozinho no último terço (retrato do ataque: meias 15–20 m atrás da bola)
    const atras = attacking && m.lx(t, p.target.x) - m.lx(t, p.x) > 6 && m.lx(t, b.x) > -10;
    // alvo "preguiçoso": o desenho tático anda com a bola a cada passe; quem está longe da
    // jogada acompanha a média (filtro de ~2 s), sem correr atrás de cada oscilação
    {
      // centroavante no ataque acompanha a linha de perto (é ali que ele joga)
      const atk = attacking && p.role === 'ATT';
      // a linha de 4 anda junta e rápido (sobe quando a bola volta, recua quando ela avança):
      // com o filtro lento de quem está longe, a linha "escorria" e nunca pegava ninguém adiantado
      const linhaDef = !attacking && p.role === 'DEF';
      // (subindo, a linha reage rápido — é a "subida em bloco"; recuando, com o filtro normal)
      const subindo = linhaDef && m.lx(t, p.target.x) - m.lx(t, p.x) > 1.5;
      const dbl = Math.hypot(b.x - p.x, b.z - p.z), tau = atk ? 0.12 : linhaDef ? (subindo ? 0.15 : 0.8) : atras ? 0.3 : lerp(0.4, 2.2, clamp((dbl - 10) / 25, 0, 1));
      const k = 1 - Math.exp(-dt / tau);
      if (p.lazyT === undefined || Math.abs(m.time - p.lazyT) > 0.5) { p.lazyX = p.target.x; p.lazyZ = p.target.z; }
      else { p.lazyX += (p.target.x - p.lazyX) * k; p.lazyZ += (p.target.z - p.lazyZ) * k; }
      p.lazyT = m.time;
    }
    p.aiMode = 'posicao';
    // (na posição, só arranca se ficou bem para trás da linha; senão acompanha trotando/correndo)
    if (attacking && p.role === 'ATT') followLine(m, p, p.lazyX, p.lazyZ, Math.hypot(p.lazyX - p.x, p.lazyZ - p.z) > 16);
    // linha de 4 sobe em bloco (auditoria Fase 3): quando o alvo da linha avança (bola recuada ou
    // afastada), os zagueiros sobem juntos na velocidade de corrida — o atacante que demora a voltar
    // fica impedido. Recuando, seguem o reposicionamento normal
    else {
      const sobe = !attacking && p.role === 'DEF' && m.lx(t, p.lazyX) - m.lx(t, p.x) > 1.0;
      shapeMove(m, p, p.lazyX, p.lazyZ, attacking ? 0.55 : 0.7, inten, sobe, atras);
    }
    if (far < 3) p.face = b;
  }
}

function dist(a, c) { return Math.hypot(a.x - c.x, a.z - c.z); }

// Acompanha um ponto que anda com a linha de impedimento: velocidade da linha + correção. Antes o
// atacante perseguia a posição e freava para chegar — ficava ~2 m atrás da linha (mediana) e quase
// nunca havia impedimento; o atacante de verdade corre "no ombro" do zagueiro, junto com ele
function followLine(m, p, x, z, sprintOk = true) {
  const t = p.team, ex = x - p.x, ez = z - p.z, d = Math.hypot(ex, ez);
  const vl = (t.lineV || 0) * t.dir;
  if (d < 0.25 && Math.abs(vl) < 0.4) { p.dx = p.dz = 0; p.sprint = false; return d; }
  const vx = ex / 0.55 + vl, vz = ez / 0.55;
  const vm = Math.hypot(vx, vz), smax = sprintOk && p.stamina > 0.3 ? p.sprintSpd : p.jog;
  const k = vm > smax ? smax / vm : 1;
  p.dx = vx * k; p.dz = vz * k; p.sprint = vm * k > p.jog + 0.2;
  return d;
}

function shapeTarget(m, t, p, attacking, offLine, lineSeen = offLine) {
  const [role, bx, bz] = t.formation[p.slot];
  const b = m.ball.p;
  const bl = m.lx(t, b.x), bzl = b.z * t.dir;
  const wide = 0.9 + t.style.width * 0.3;
  let x, z;
  if (attacking) {
    x = bx + 12 + bl * 0.6 + ((t.intensity ?? 0.5) - 0.5) * 10;
    z = bz * wide * 1.08 + bzl * 0.22;
    if (role === 'DEF') { x = Math.min(x, bl - 6, 22); if (Math.abs(bz) > 15) x += 4 * t.style.width; }
    if (role === 'ATT' || role === 'MID') x = Math.min(x, Math.max(offLine, bl) - 0.8);
    // centroavante "no ombro" do penúltimo defensor, pronto para a infiltração (é ali que
    // nascem os impedimentos), sem se descolar mais de 25 m da bola
    if (role === 'ATT') x = Math.max(x, Math.min(Math.max(lineSeen, bl) - 1.1, bl + 25));
  } else {
    // bloco mais alto com intensidade alta (pressão) — deixa espaço nas costas (§17)
    x = bx * 0.92 + bl * 0.55 - 3 + ((t.intensity ?? 0.5) - 0.5) * 16;
    // o bloco desliza para o lado da bola e fecha por dentro (largura real ~37 m sem a bola, F40)
    z = bz * 0.62 + bzl * 0.52;
    // altura da linha de 4 pela distância da bola ao próprio gol (bloco médio): bola no meio-campo
    // → linha a ~31 m do gol; bola a 35 m → ~20 m; na área, colada na pequena área. Antes a
    // linha média ficava a 23 m do gol (bola no meio → 21 m), funda demais: não havia espaço
    // nas costas e quase nunca impedimento (Opta/CIES: linha média real de 36 a 48 m do gol)
    if (role === 'DEF') x = -HL + clamp(0.6 * (bl + HL) - 1, 7, 42) + ((t.intensity ?? 0.5) - 0.5) * 10 + (bx + 34) * 0.5;
    if (role === 'DEF') { x = Math.max(x, -HL + 5); x = Math.min(x, bl - 3); }
    // bloco curto (meio–ataque real ~13 m sem a bola; aqui ficava a ~16 m): o meio sobe 2 m e o ataque recua 4 m.
    // (só recuando o ataque 5,5 m ele ficava longe demais para o contra-ataque e os chutes caíam)
    if (role === 'MID') x = Math.min(x + 2, bl + 1);
    if (role === 'ATT') x = Math.min(x - 4, bl + 6);
  }
  x = clamp(x, -HL + 2, HL - 2);
  z = clamp(z, -HW + 1.5, HW - 1.5);
  p.target.x = x * t.dir; p.target.z = z * t.dir;
}

// Zagueiros alinhados (linha de impedimento coerente).
function flattenLine(m, t, outfield, attacking) {
  const defs = outfield.filter(p => p.role === 'DEF');
  if (!defs.length) return;
  let line = 0;
  for (const p of defs) line += m.lx(t, p.target.x);
  line /= defs.length;
  // se um atacante adversário está muito fundo, a linha acompanha até a área
  for (const p of defs) {
    const cur = m.lx(t, p.target.x);
    const nx = lerp(cur, line, 0.8);
    p.target.x = nx * t.dir;
  }
}

// Marcação por zona com encaixe no atacante mais próximo (do lado do gol).
function mark(m, t, outfield, press1, press2) {
  const gx = m.ownGoalX(t);
  const taken = new Set();
  const opps = t.opp.players.filter(q => !q.sentOff && !q.isGK && q !== m.owner)
    .sort((a, c) => Math.abs(a.x - gx) - Math.abs(c.x - gx));
  for (const q of opps) {
    if (m.lx(t, q.x) > 5) continue;   // atacante no nosso campo
    // lado fraco: o atacante aberto do outro lado do campo fica com a zona — o lateral fecha por dentro
    // (bloco real: ~37 m de largura; seguindo o ponta do lado fraco o nosso ficava com ~44 m). Perto da
    // nossa área, marca sempre
    if (Math.abs(q.z - m.ball.p.z) > 19 && m.lx(t, q.x) > -32) continue;
    let best = null, bd = 14;
    for (const p of outfield) {
      if (taken.has(p) || p === press1 || p === press2) continue;
      const d = Math.hypot(p.target.x - q.x, p.target.z - q.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) continue;
    taken.add(best);
    const dx = gx - q.x, dz = -q.z, dl = Math.hypot(dx, dz) || 1;
    const tight = m.lx(t, q.x) < -25 ? 1.3 : 2.2;
    let mx = q.x + dx / dl * tight;
    const mz = q.z + dz / dl * tight;
    // zaga em linha (marcação por zona, como a linha de 4 de verdade): o zagueiro acompanha o
    // atacante de lado, mas não afunda atrás da altura da linha por causa dele — quem fica
    // adiantado fica impedido. Antes ele recuava sempre 2,2 m "de costas para o gol" e o
    // centroavante empurrava a linha até a área (linha média a 23 m do gol; real: 36–48 m)
    if (best.role === 'DEF') mx = Math.max(m.lx(t, mx), m.lx(t, best.target.x) - 0.6) * t.dir;
    best.target.x = lerp(best.target.x, mx, 0.75);
    best.target.z = lerp(best.target.z, mz, 0.75);
    best.markOf = q;
  }
}

// Apoio: dois companheiros oferecem linhas de passe; atacantes infiltram.
function support(m, t, outfield, owner, offLine, dt) {
  // o centroavante segura a linha (no ombro do zagueiro) e só vem buscar jogo no último terço
  const lxo = m.lx(t, owner.x);
  const near = outfield.filter(p => p !== owner && !p.human && !(p.role === 'ATT' && Math.abs(t.formation[p.slot][2]) < 10 && lxo < 15))
    .sort((a, c) => dist(a, owner) - dist(c, owner)).slice(0, 2);
  for (const p of outfield) p.supportNow = near.includes(p);
  const angs = [0.8, -0.8, 1.9, -1.9, 0];
  for (const p of near) {
    let best = null, bs = -1e9;
    for (const a of angs) {
      const ang = (t.dir > 0 ? 0 : Math.PI) + a;
      const r = a === 0 ? 16 : 11;
      const x = clamp(owner.x + Math.cos(ang) * r, -HL + 2, HL - 2);
      const z = clamp(owner.z + Math.sin(ang) * r, -HW + 1.5, HW - 1.5);
      if (m.lx(t, x) > offLine - 0.5) continue;
      let s = -Math.hypot(x - p.x, z - p.z) * 0.15;
      for (const q of t.opp.players) if (!q.sentOff) s -= Math.max(0, 6 - Math.hypot(q.x - x, q.z - z));
      for (const o of outfield) if (o !== p && o !== owner) s -= Math.max(0, 5 - Math.hypot(o.x - x, o.z - z)) * 0.6;
      if (s > bs) { bs = s; best = { x, z }; }
    }
    if (best) { p.target.x = lerp(p.target.x, best.x, 0.7); p.target.z = lerp(p.target.z, best.z, 0.7); }
  }
  // infiltrações
  const deFrente = Math.cos(angDiff(owner.heading, t.dir > 0 ? 0 : Math.PI)) > 0.5 && m.pressure(owner) < 0.45;
  if (m.lx(t, owner.x) > -15) {
    for (const p of outfield) {
      if (p === owner || p.human || (p.role !== 'ATT' && !(p.role === 'MID' && Math.random() < 0.3))) continue;
      const hunter = p.traits.includes('explosivo') || p.traits.includes('cacador') ? 1.8 : 1;
      if (p.runUntil < m.time && Math.random() < dt * (deFrente ? 1.2 : 0.35) * (0.6 + t.style.directness) * hunter * (0.8 + 0.4 * (t.intensity ?? 0.5))) {
        p.runUntil = m.time + rand(2, 3.5);
        p.runZ = clamp(p.z * 0.6, -14, 14);
      }
      if (p.runUntil > m.time) { p.target.x = Math.min(HL - 8, offLine + 12) * t.dir; p.target.z = p.runZ ?? p.z; }
      // às vezes o atacante erra o tempo da corrida e fica impedido
      // na espera da infiltração o atacante "joga na linha": às vezes fica um pouco adiantado
      // (0,2–1,2 m), mais raramente bem adiantado — quem passa nem sempre percebe
      if (p.runUntil > m.time && p.runLate === undefined) {
        const erro = (1.1 - m.diff.aiSkill + 0.2) * (p.traits.includes('cacador') ? 0.5 : 1);
        const r = Math.random();
        p.runLate = r < 0.12 * erro ? rand(1.2, 2.2) : r < 0.55 * erro ? rand(0.2, 1.2) : 0;
      }
      if (p.runUntil <= m.time) p.runLate = undefined;
    }
  }
}

// Ataque à área: com a bola no último terço pelos lados, o centroavante vai ao primeiro pau, um
// atacante/meia do outro lado ao segundo pau e um meia chega na marca do pênalti — é o alvo do
// cruzamento. Em posição legal até a bola sair (a linha da defesa limita); com o cruzamento no ar,
// atacam o ponto. Antes ninguém ia para a área e o time quase só chutava de fora
const BOX_SPOTS = [[HL - 6.5, 2.5], [HL - 9, -4], [HL - 12, -0.5]];   // [x de ataque, z (lado da bola = +)]
function boxRuns(m, t, outfield, owner, offLine) {
  const ref = owner || m.lastKick?.p;
  if (!ref) return;
  if (owner) {
    if (m.lx(t, owner.x) < 20 || Math.abs(owner.z) < 10) { for (const p of outfield) p.boxSpot = null; return; }
  } else if (!outfield.some(p => p.boxSpot)) return;
  const sg = Math.sign(ref.z) || 1;
  if (owner) {
    const cand = outfield.filter(p => p !== owner && !p.human && !p.supportNow && p.runUntil <= m.time && (p.role === 'ATT' || p.role === 'MID'));
    // atacantes primeiro, depois quem já está mais perto da área
    cand.sort((a, c) => (c.role === 'ATT') - (a.role === 'ATT') || m.lx(t, c.x) - m.lx(t, a.x));
    const usados = new Set();
    for (const p of outfield) p.boxSpot = null;
    for (const [sx, sz] of BOX_SPOTS) {
      let best = null, bd = 1e9;
      for (const p of cand.slice(0, 4)) {
        if (usados.has(p)) continue;
        const d = Math.hypot(sx * t.dir - p.x, sz * sg - p.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best && bd < 30) { usados.add(best); best.boxSpot = { x: sx, z: sz * sg }; }
    }
  }
  for (const p of outfield) {
    if (!p.boxSpot || p === owner) continue;
    // o tempo da corrida não é perfeito: às vezes passa meio metro da linha (impedimento no cruzamento)
    const lx = Math.min(p.boxSpot.x, offLine - 0.4 + 0.8 * Math.sin(m.time * 1.3 + p.idx * 2.1));
    p.target.x = lx * t.dir; p.target.z = p.boxSpot.z;
  }
}

// Melhor alvo de cruzamento: companheiro na área (ou chegando nela), em posição legal, perto do
// gol e com o marcador a alguma distância. Pontuação já no padrão das outras opções.
function crossTarget(m, p) {
  const t = p.team, gx = m.goalX(t), off = offsideLine(m, t);
  let best = null, n = 0;
  for (const q of t.players) {
    if (q === p || q.sentOff || q.isGK || !q.canPlay()) continue;
    const lq = m.lx(t, q.x);
    if (lq < HL - 19 || Math.abs(q.z) > 11 || lq > off + 0.2) continue;
    n++;
    const dg = Math.hypot(gx - q.x, q.z);
    let mk = 9;
    for (const o of t.opp.players) if (!o.sentOff && !o.isGK) mk = Math.min(mk, Math.hypot(o.x - q.x, o.z - q.z));
    const s = 0.34 - dg * 0.01 + Math.min(mk, 4) * 0.06;
    if (!best || s > best.s) best = { q, s };
  }
  if (!best) return null;
  best.s += 0.1 * (n - 1) - m.pressure(p) * 0.2 + (m.lx(t, p.x) > 32 ? 0.08 : 0);
  return best;
}

// Passe para trás da linha de fundo ("cut-back"): da ponta, já perto da linha de fundo, rasteiro e para trás para
// quem chega de frente entre a pequena área e a marca do pênalti — a jogada que mais vira gol no futebol de hoje
// (o finalizador chuta de primeira, de frente, com a defesa correndo para o próprio gol). Sem ela, sem os gols da
// saída de bola roubada no tiro de meta (Regra 16), quase todo gol da IA saía de longe
function cutbackTarget(m, p) {
  const t = p.team, off = offsideLine(m, t);
  let best = null;
  for (const q of t.players) {
    if (q === p || q.sentOff || q.isGK || !q.canPlay()) continue;
    const lq = m.lx(t, q.x);
    if (lq < HL - 18 || lq > HL - 6 || Math.abs(q.z) > 9 || lq > off + 0.2) continue;
    const s = 0.55 + Math.min(openness(m, q), 5) * 0.07 - laneRisk(m, p, q.x, q.z, 'ground', q) * 1.1;
    if (!best || s > best.s) best = { q, s };
  }
  return best && best.s > 0.5 ? best : null;
}

function segDist2(ax, az, bx, bz, px, pz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(ax + dx * u - px, az + dz * u - pz);
}

// Gatilhos de pressão (os times de verdade pressionam juntos, num momento — F41 da análise da movimentação):
// logo depois de perder a bola (contrapressão, 3 s), condutor de costas para o nosso gol e condutor preso na
// lateral. No gatilho o 2º homem fecha junto com o 1º. (Com "domínio ruim" e "bola recém-dominada" também, a
// pressão a dois virava regra e os chutes por partida caíam ~20%.)
function gatilhoPressao(m, t, o) {
  if (m.time - (t.tinhaBolaT ?? -9) < 2.5) return true;
  const gx = m.ownGoalX(t), ax = gx - o.x, az = -o.z, al = Math.hypot(ax, az) || 1;
  if ((ax * o.fx + az * o.fz) / al < -0.35) return true;
  return Math.abs(o.z) > HW - 6;
}

function pressCarrier(m, p, o, dt, n, gatilho = false) {
  const t = p.team;
  const gx = m.ownGoalX(t);
  // fica entre a bola e o gol; aperta quando perto
  const dx = gx - o.x, dz = -o.z, dl = Math.hypot(dx, dz) || 1;
  const d = dist(p, o);
  // o 2º homem: no gatilho fecha a ~2,2 m (cobre o drible para dentro); fora dele, segura a 5 m
  const ahead = n === 1 ? (d > 4 ? 0.8 : 1.2) : gatilho ? 2.2 : 5;
  const tx = o.x + o.vx * 0.3 + dx / dl * ahead, tz = o.z + o.vz * 0.3 + dz / dl * ahead;
  // contornando quem protege a bola: segue para o lado dele até chegar (antes a ordem de contornar
  // valia um quadro a cada 0,12 s e a de ficar entre ele e o gol a puxava de volta — com o atacante
  // parado de costas, o marcador ficava a 1 m para sempre sem dar o bote)
  const ct = n === 1 && p.contorna && p.contorna.ate > m.time ? p.contorna : null;
  if (ct) {
    // passo lateral direto (o moveTo, parado, ignora alvos a menos de ~1 m — e o lado do atacante fica a ~0,8 m)
    const ux = m.ball.p.x - o.x, uz = m.ball.p.z - o.z, ul = Math.hypot(ux, uz) || 1;
    const ex = o.x + ux / ul * 0.5 + (-uz / ul) * ct.side * 0.95 - p.x, ez = o.z + uz / ul * 0.5 + (ux / ul) * ct.side * 0.95 - p.z, de = Math.hypot(ex, ez);
    const sv = de > 0.12 ? Math.min(3, de * 4) : 0;
    p.dx = de > 0.12 ? ex / de * sv : 0; p.dz = de > 0.12 ? ez / de * sv : 0; p.sprint = false;
  } else p.moveTo(tx, tz, 1, d > (n === 1 ? (gatilho ? 2.5 : 3) : gatilho ? 3 : 9));   // (arranca para fechar; no gatilho, os dois)
  if (d < 4) { p.face = m.ball.p; p.jockey = d < 2.5 && n === 1; }
  if (n !== 1 || p.action || p.fooled > 0) return;
  const skill = m.diff.aiSkill;
  p.aiTimer -= dt;
  if (p.aiTimer > 0) return;
  const bd = Math.hypot(m.ball.p.x - p.x, m.ball.p.z - p.z);
  // corpo do atacante entre mim e a bola (ele protege): não atravessa — contorna pelo lado
  // em que já está e espera a bola se expor (seção 9/10 da especificação)
  const bx0 = m.ball.p.x, bz0 = m.ball.p.z;
  // (o corpo tem de estar ANTES da bola na linha do marcador: só "perto da bola" não basta — com a
  // bola colada no pé, o marcador ao lado se achava bloqueado e nunca dava o bote)
  const blocked = segDist2(p.x, p.z, bx0, bz0, o.x, o.z) < 0.45 && Math.hypot(bx0 - o.x, bz0 - o.z) < 1.0 && Math.hypot(o.x - p.x, o.z - p.z) < bd;
  if (blocked && bd < 2.5) {
    const ux = bx0 - o.x, uz = bz0 - o.z, ul = Math.hypot(ux, uz) || 1;
    const side = ((p.x - o.x) * -uz + (p.z - o.z) * ux) >= 0 ? 1 : -1;
    p.moveTo(o.x + ux / ul * 0.5 + (-uz / ul) * side * 0.95, o.z + uz / ul * 0.5 + (ux / ul) * side * 0.95, 1, false);
    p.face = m.ball.p; p.aiTimer = 0.12;
    if (!p.contorna || p.contorna.ate < m.time) p.contorna = { ate: m.time + 0.6, side };
    return;
  }
  // bola exposta (toque longo do atacante): o bom antecipador ataca na hora
  const expo = Math.hypot(bx0 - o.x, bz0 - o.z) > 0.75;
  // Agressivo dá o bote mais cedo; Muralha espera a bola se expor
  const reach = p.traits.includes('agressivo') ? 1.6 : 1.35;
  if (p.traits.includes('muralha') && !expo && bd < 1.35 && Math.random() < 0.6) { p.aiTimer = 0.15; return; }
  if (bd < reach) {
    p.aiTimer = rand(0.25, 0.6) * (expo ? 0.4 : 1) + m.diff.aiReaction * (1.2 - (p.a.ant ?? p.a.def) / 99 * 0.6);
    if (Math.random() < (expo ? 0.85 : 0.45) + skill * 0.15) {
      // mesma dividida do humano: bote curto até onde a bola vai estar no contato
      const bx = m.ball.p.x + m.ball.v.x * 0.22, bz = m.ball.p.z + m.ball.v.z * 0.22;
      const bl = Math.hypot(bx - p.x, bz - p.z) || 1, lx = (bx - p.x) / bl, lz = (bz - p.z) / bl;
      p.startAction('tackle', { face: Math.atan2(lz, lx), lunge: Math.min(7.5, Math.max(0, (bl - 0.55) / 0.2)), lx, lz });
      p.heading = Math.atan2(lz, lx);
    }
  } else if (bd < 3.2 && bd > 1.8 && o.speed > 5 && Math.random() < 0.06 * (0.5 + t.style.press)) {
    // carrinho quando o atacante escapa
    p.heading = Math.atan2(m.ball.p.z + m.ball.v.z * 0.25 - p.z, m.ball.p.x + m.ball.v.x * 0.25 - p.x);
    p.startAction('slide', { speed: Math.max(6.5, p.speed * 1.1) });
    p.aiTimer = 1.5;
  } else p.aiTimer = 0.15;
}

// Ponto de cabeceio da bola alta: onde ela desce passando pela altura da cabeça (~2,2 m), daqui a 0,3–2,5 s.
// Por time, os dois jogadores de linha que chegam lá a tempo (correndo) são os que disputam.
function pontoAereo(m) {
  if (m._aerea && m._aerea.t === m.time) return m._aerea.v;
  let v = null;
  const b = m.ball, pr = m.pred;
  if (m.phase === 'play' && !m.owner && !b.held && b.p.y > 1.0) {
    for (let k = 1; k < pr.n; k++) {
      const y = pr.y(k), yp = pr.y(k - 1);
      // só perto das áreas (cruzamento, escanteio, chutão na área): no meio-campo, dois de cada time indo em toda
      // bola alta desmontava o time e o ataque (o placar caiu de ~3 para ~2 gols por partida)
      if (yp > 2.2 && y <= 2.2 && pr.t(k) > 0.3) { if (Math.abs(pr.x(k)) > HL - 24 && Math.abs(pr.z(k)) < 26) v = { x: pr.x(k), z: pr.z(k), tc: pr.t(k) }; break; }
      if (y < 1.0) break;
    }
  }
  if (v) {
    const cache = new Map();
    v.de = (t) => {
      if (cache.has(t)) return cache.get(t);
      const alvo = m.passTarget && m.passTarget.p.team === t ? m.passTarget.p : null;
      const ok = t.players.filter(q => !q.sentOff && !q.isGK && !humanDriving(m, q) && q.canPlay())
        .map(q => ({ q, d: Math.hypot(q.x - v.x, q.z - v.z) - (q === alvo ? 3 : 0) }))
        .filter(o => o.d < 14 && o.d / Math.max(4, o.q.sprintSpd * 0.85) <= v.tc + 0.35)
        .sort((a, c) => a.d - c.d).slice(0, 2).map(o => o.q);
      cache.set(t, ok);
      return ok;
    };
  }
  m._aerea = { t: m.time, v };
  return v;
}

// Cabeceio / voleio quando a bola chega pelo alto.
function tryAerial(m, p) {
  if (p.action || !p.canPlay() || m.owner) return false;
  const b = m.ball;
  if (b.p.y < 0.6 && b.v.y <= 0) return false;
  const pr = m.pred;
  const t = p.team;
  // cabeceio: contato em ~0,32 s
  const kH = Math.max(0, Math.round(0.31 / pr.dt) - 1);
  const hx = pr.x(kH), hy = pr.y(kH), hz = pr.z(kH);
  const px = p.x + p.vx * 0.31, pz = p.z + p.vz * 0.31;
  const dH = Math.hypot(hx - px, hz - pz);
  // disputa pelo alto: além de quem vai na bola, os dois mais perto do ponto de contato de cada time
  // sobem juntos (antes só subia um, e a bola alta quase nunca era disputada pelos dois times)
  // (só perto das áreas, como o ponto aéreo: no meio-campo, dois de cada time subindo em toda bola alta
  // trocava o domínio por cabeçada para longe — +6 bolas perdidas por partida)
  const areaH = Math.abs(hx) > HL - 24 && Math.abs(hz) < 26;
  let perto = p === t.chaser || (m.passTarget && m.passTarget.p === p) || dH < 0.7;
  if (!perto && areaH && dH < 1.6) {
    let antes = 0;
    for (const q of t.players) if (q !== p && !q.sentOff && !q.isGK && Math.hypot(hx - (q.x + q.vx * 0.31), hz - (q.z + q.vz * 0.31)) < dH) antes++;
    perto = antes < 2;
  }
  // com adversário também chegando na bola, sobe de um pouco mais longe (estica para disputar)
  const disputa = areaH && t.opp.players.some(q => !q.sentOff && !q.isGK && Math.hypot(hx - q.x, hz - q.z) < 2.2);
  if (hy > 1.35 && hy < 2.5 && dH < (disputa ? 1.6 : areaH ? 1.3 : 1.0) && perto) {
    const gx = m.goalX(t);
    const dGoal = Math.hypot(gx - p.x, p.z);
    const ownBox = m.inOwnBox(p, p.x, p.z);
    const shot = dGoal < 18 && Math.abs(p.z) < 13;
    let data;
    if (shot) data = { kind: 'shot', jump: clamp(hy - 1.75, 0, 0.6) };
    else if (ownBox || m.lx(t, p.x) < -25) {
      // corte de cabeça no cruzamento, na própria área: às vezes sai de lado, pela linha de fundo — escanteio (no
      // futebol real boa parte dos ~10 escanteios por partida nasce assim; aqui todo corte ia para a frente e havia
      // ~1,5 escanteio por partida). Só quando a bola passa bem longe da trave
      const lk = m.lastKick, og = m.ownGoalX(t), sz = Math.sign(p.z) || 1;
      const tx = og + Math.sign(og) * 4, tz = sz * rand(GOAL.halfWidth + 6, 15);
      const zLinha = p.z + (tz - p.z) * Math.abs(og - p.x) / Math.max(0.5, Math.abs(tx - p.x));
      if (ownBox && lk && lk.kind === 'cross' && lk.p.team !== t && Math.abs(zLinha) > GOAL.halfWidth + 2 && Math.random() < 0.3)
        data = { kind: 'pass', target: { x: tx, z: tz }, jump: clamp(hy - 1.75, 0, 0.6) };
      else data = { kind: 'pass', target: { x: p.x + t.dir * 25, z: p.z + (p.z > 0 ? 8 : -8) }, jump: clamp(hy - 1.75, 0, 0.6) };
    }
    else {
      const rec = headerReceiver(m, p);
      data = { kind: 'pass', receiver: rec?.q, target: rec ? { x: rec.q.x, z: rec.q.z } : { x: p.x + t.dir * 16, z: p.z * 0.8 }, jump: clamp(hy - 1.75, 0, 0.6) };
    }
    p.heading = Math.atan2(hz - p.z, hx - p.x);
    p.startAction('header', data);
    return true;
  }
  // voleio no ataque
  const kV = Math.max(0, Math.round(0.27 / pr.dt) - 1);
  const vy = pr.y(kV), dV = Math.hypot(pr.x(kV) - (p.x + p.vx * 0.27), pr.z(kV) - (p.z + p.vz * 0.27));
  // (sobra na entrada da área também: o voleio de fora, até ~28 m)
  if (vy > 0.45 && vy < 1.2 && dV < 1.0 && m.lx(t, p.x) > HL - 28 && Math.abs(p.z) < 16 && p === t.chaser) {
    p.heading = Math.atan2(m.goalX(t) === 0 ? 0 : -p.z, m.goalX(t) - p.x);
    p.startAction('volley', { power: 0.8 });
    return true;
  }
  return false;
}

// Cabeceio para um companheiro: só no alcance de uma cabeçada (6–18 m), para a frente ou para o
// lado e com ele livre. Sem ninguém assim, a cabeçada é um corte para a frente (não é passe).
// Antes mirava o melhor "lançamento" (18–60 m), que a cabeça não alcança: 16 passes de cabeça por
// partida no meio-campo, 57% certos
function headerReceiver(m, p) {
  const t = p.team, off = offsideLine(m, t), lxb = m.lx(t, m.ball.p.x);
  let best = null;
  for (const q of t.players) {
    if (q === p || q.sentOff || q.isGK || !q.canPlay()) continue;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < 6 || d > 18) continue;
    const lq = m.lx(t, q.x), prog = lq - m.lx(t, p.x);
    if (prog < -8 || (lq > 0 && lq > off + 0.2 && lq > lxb)) continue;
    const s = 0.3 + Math.min(openness(m, q), 7) * 0.06 + prog * 0.01 - laneRisk(m, p, q.x, q.z, 'air', q) * 1.2 - d * 0.01;
    if (!best || s > best.s) best = { q, s };
  }
  return best && best.s > 0.35 ? best : null;
}

// ------------------------------------------------------------ quem tem a bola
export function carrierThink(m, p, dt) {
  const t = p.team;
  const gx = m.goalX(t);
  p.aiTimer -= dt;
  const press = m.pressure(p);
  // enfiada/lançamento "preparado": quem passa levanta a cabeça e ajeita o corpo (0,2–0,4 s)
  // antes de soltar. É a janela em que o atacante às vezes arranca cedo demais e fica impedido
  if (p.prep) {
    const pr = p.prep;
    if (pr.t0 < (p.gotBall || 0) || m.time - pr.t0 > 1 || p.action) p.prep = null;
    else if (m.time < pr.until && press < 0.8) { prepCarry(m, p); return; }
    else {
      p.prep = null;
      const q = pr.q;
      // impedimento escancarado (> 2,5 m) quem passa costuma enxergar e desiste; o de um ou dois
      // passos, de frente para o jogo e com a linha em movimento, não
      if (!q.sentOff && q.canPlay() && !(m.lx(t, q.x) - offsideLine(m, t) > 2.5 && Math.random() < 0.75)) { execPass(m, p, pr.kind, q); return; }
    }
  }
  if (p.intent && p.aiTimer > 0 && !(press > 0.8 && p.intent.kind === 'dribble')) { applyDribble(m, p, p.intent); return; }
  if (p.action) return;

  const skill = m.diff.aiSkill;
  const held = m.time - (p.gotBall || 0);
  const options = [];
  const dGoal = Math.hypot(gx - p.x, p.z);
  const xg = shotQuality(m, p);
  const tr = p.traits;
  const shotBias = (0.7 + p.a.sho / 99 * 0.6) * (tr.includes('finalizador') && dGoal < 18 ? 1.25 : 1);
  // cara a cara (ninguém de linha perto entre ele e o gol): com o goleiro no gol, leva a bola até
  // perto (de 25 m o chute é ruim; no futebol real a finalização do cara a cara sai de 8–14 m);
  // com o goleiro adiantado, a resposta é a cavadinha
  const gkO = t.opp.gk;
  const foraGk = gkO && !gkO.sentOff ? Math.abs(m.ownGoalX(t.opp)) - Math.abs(gkO.x) : 0;
  const dGk = gkO && !gkO.sentOff ? Math.hypot(gkO.x - p.x, gkO.z - p.z) : 99;
  // (cara a cara de verdade: passou da última linha — nenhum defensor à frente ou na mesma altura, nenhum a 5 m.
  // Com "ninguém a 7 m" valia também com a linha da defesa 8–10 m à frente: o condutor que tinha o chute de
  // 20–25 m seguia conduzindo para dentro do bloco — 1/3 das decisões a 16–30 m e os chutes de 12 a 25 m caíram
  // de ~10 para ~5 por partida)
  const lxp = m.lx(t, p.x);
  const caraACara = dGoal > 13 && dGoal < 34 && Math.abs(p.z) < 18 &&
    !t.opp.players.some(q => !q.isGK && !q.sentOff && (Math.hypot(q.x - p.x, q.z - p.z) < 5 || (m.lx(t, q.x) > lxp - 1.5 && Math.abs(q.z - p.z) < 20)));
  const levaAtePerto = caraACara && foraGk < 6;
  // goleiro saindo em disparada de longe (botão GOLEIRO): o atacante segue com a bola para driblá-lo ou tocar
  // por cima quando ele chegar, em vez de bater de 25 m logo que o vê sair (com a vontade de chutar desta versão,
  // o chute de longe cedo deixava o goleiro do humano sem chegar na bola em ~1/4 dos lances)
  const gkDisparada = gkO && !gkO.sentOff && foraGk > 4 && dGk > 9 &&
    ((gkO.vx * (p.x - gkO.x) + gkO.vz * (p.z - gkO.z)) / dGk) > 3;
  if (dGoal < 32) {
    let sS = xg * 4.6 * shotBias + (dGoal < 12 ? 0.3 : 0);
    // dentro da área o atacante finaliza mesmo com zagueiro na frente (no futebol real ~60% dos
    // chutes saem da área e ~1/4 dos chutes é travado); antes ele quase sempre tentava mais um passe
    if (dGoal < 18 && Math.abs(p.z) < 17) sS += 0.4;
    // chute de fora da área quando o jogador está de frente para o gol: no futebol real ~40% dos
    // chutes saem de fora da área (convertem ~3–5%), quase todos de 17 a 28 m. O bônus é cheio até
    // 25 m e cai até 33 m: é nessa faixa (24–40 m) que o condutor da IA mais decide (~350 vezes por
    // partida, quase sempre conduzindo marcado) e antes quase nunca chutava dali
    // Marcado também chuta (no futebol real ~1/4 dos chutes é travado), só que com menos vontade
    if (dGoal > 16 && dGoal < 33 && Math.abs(p.z) < 18 && press < 0.95 && xg > 0.006 && !levaAtePerto &&
      Math.cos(angDiff(p.heading, Math.atan2(-p.z, gx - p.x))) > 0.25) sS += (1.15 + p.a.sho / 99 * 0.22 + (tr.includes('finalizador') ? 0.08 : 0)) * clamp((33 - dGoal) / 8, 0, 1) * (1.3 - press * 0.45) * (gkDisparada ? 0.4 : 1);
    // goleiro vindo em cima (saiu do gol e está a 3–9 m): finaliza antes de ele chegar, colocado
    const vemGk = gkO && !gkO.sentOff && foraGk > 5 && dGk > 3 && dGk < 9 && dGoal < 24 &&
      ((gkO.vx * (p.x - gkO.x) + gkO.vz * (p.z - gkO.z)) / dGk) > 3;
    // (+0,15: com a vontade de chutar maior desta versão, +0,5 fazia o atacante chutar quase sempre antes de o
    // goleiro chegar — o botão GOLEIRO deixava de 'atacar a bola')
    if (vemGk) sS += 0.15;
    options.push({ kind: vemGk || (dGoal > 16 && Math.abs(p.z) > 6 && Math.random() < 0.5) ? 'finesse' : 'shot', s: sS });
  }
  // cavadinha no goleiro que saiu do gol
  if (foraGk > 6 && dGk > 5 && dGk < 14 && dGoal > 9 && dGoal < 30 && Math.abs(p.z) < 16)
    options.push({ kind: 'chip', s: 0.35 + clamp((foraGk - 6) / 10, 0, 0.35) + p.a.sho / 99 * 0.1 });

  const lx = m.lx(t, p.x);
  for (const mode of ['ground', 'through', 'air']) {
    const r = bestReceiver(m, p, mode);
    // Maestro prefere o passe certo; Criativo arrisca o que quebra linhas
    const bonus = (tr.includes('maestro') && mode === 'ground' ? 0.1 : 0) + (tr.includes('criativo') && mode === 'through' ? 0.14 : 0) + (tr.includes('maestro') && mode === 'through' ? 0.06 : 0);
    if (r) options.push({ kind: mode === 'ground' ? 'pass' : mode === 'through' ? 'through' : (lx > 25 && Math.abs(p.z) > 16 ? 'cross' : 'long'), s: r.s + bonus, q: r.q });
  }
  // cruzamento: da ponta, no último terço, para quem ataca a área (no futebol real ~15–20 por
  // time por jogo, ~25% certos; aqui quase não havia)
  if (lx > 20 && Math.abs(p.z) > 12) {
    const c = crossTarget(m, p);
    if (c) options.push({ kind: 'cross', s: c.s + (tr.includes('criativo') ? 0.05 : 0), q: c.q });
  }
  if (lx > HL - 11 && Math.abs(p.z) > 4 && Math.abs(p.z) < 24) {
    const c = cutbackTarget(m, p);
    if (c) options.push({ kind: 'pass', s: c.s + (tr.includes('criativo') || tr.includes('maestro') ? 0.05 : 0), q: c.q });
  }
  const space = spaceAhead(m, p);
  const dribK = (tr.includes('driblador') ? 0.16 : 0) + (tr.includes('explosivo') && space > 6 ? 0.1 : 0) - (tr.includes('maestro') ? 0.05 : 0);
  // no último terço, com espaço na frente, conduz para dentro da área (é de lá que sai a maioria
  // dos gols: no futebol real ~60% dos chutes e ~80% dos gols)
  const ataca = lx > 18 && lx < HL - 14 && space > 4 ? 0.14 : 0;
  options.push({ kind: 'dribble', s: 0.28 + Math.min(space, 12) * 0.04 + p.a.dri / 99 * 0.22 - press * (tr.includes('driblador') ? 0.3 : 0.5) + (lx < -30 ? -0.3 : 0) + dribK + ataca + (levaAtePerto ? 0.45 : 0) });
  if (lx < -28 && press > 0.5) options.push({ kind: 'clear', s: 0.55 + press * 0.3 });

  // ruído conforme a dificuldade
  for (const o of options) o.s += (Math.random() - 0.5) * 0.25 * (1.25 - skill);
  options.sort((a, c) => c.s - a.s);
  let pick = options[0];
  // segura um instante depois de dominar
  // segura um instante depois de dominar (o Maestro segura um pouco mais e escolhe)
  // (na área o domínio já é o ajeite para o chute: segura bem menos)
  // (contra a pressão mais intensa o jogo fica mais rápido no meio-campo, como no futebol de alta intensidade:
  // ~0,25 s; segurando 0,35 s a pressão chegava antes da decisão — chutes e passes para a frente caíam)
  const segura = dGoal < 18 && (pick.kind === 'shot' || pick.kind === 'finesse') ? 0.15 : tr.includes('maestro') ? 0.45 : lx > -18 && lx < 18 ? 0.25 : 0.35;
  if (pick.kind !== 'dribble' && held < segura && press < 0.6) pick = { kind: 'dribble', s: 0 };

  // perto do gol a jogada é mais rápida: o condutor reavalia mais vezes (a janela de chute abre e
  // fecha em meio segundo); no resto do campo, o ritmo normal
  p.aiTimer = lx > 18 ? rand(0.12, 0.28) + m.diff.aiReaction * 0.3 : lx > -18 ? rand(0.16, 0.36) + m.diff.aiReaction * 0.4 : rand(0.2, 0.45) + m.diff.aiReaction * 0.5;
  if (pick.kind === 'dribble') { p.intent = { kind: 'dribble' }; applyDribble(m, p, p.intent); return; }
  p.intent = null;
  // de perto o finalizador coloca (chapa, ~20 m/s) em vez de encher o pé; de longe, força
  const pw = pick.kind === 'shot' ? (dGoal < 12 ? rand(0.3, 0.6) : clamp(0.55 + dGoal / 60, 0.55, 0.92)) : 0.6;
  if (pick.kind === 'chip') {
    const tg = aiShotTarget(m, p, 'shot');
    p.startAction('chip', { target: tg, power: 0.6, face: Math.atan2(tg.z - p.z, tg.x - p.x), foot: footFor(p, tg) });
  } else if (pick.kind === 'shot' || pick.kind === 'finesse') {
    const tg = aiShotTarget(m, p, pick.kind);
    p.startAction(pick.kind, { target: tg, power: pw, face: Math.atan2(tg.z - p.z, tg.x - p.x), foot: footFor(p, tg) });
  } else if (pick.kind === 'clear') {
    const tg = { x: p.x + t.dir * rand(35, 50), z: clamp(p.z * 1.4 + rand(-10, 10), -HW + 3, HW - 3) };
    p.startAction('clear', { target: tg, power: 0.9, face: Math.atan2(tg.z - p.z, tg.x - p.x) });
  } else {
    const q = pick.q;
    if ((pick.kind === 'through' || pick.kind === 'long') && press < 0.8) {
      // pressionado, olha menos tempo
      p.prep = { kind: pick.kind, q, t0: m.time, until: m.time + rand(0.15, 0.35) * (1 - press * 0.6), dx: p.dx, dz: p.dz };
      prepCarry(m, p);
      return;
    }
    execPass(m, p, pick.kind, q);
  }
}

// Finalização de primeira: quem recebe o passe perto do gol, de frente, chuta sem dominar quando a
// bola chega ao pé no tempo do contato (no futebol real cerca de metade dos gols sai de primeira).
// Antes a IA sempre dominava, segurava ~0,35 s e só então decidia — o zagueiro chegava antes.
// A decisão é tomada uma vez por passe (finalizador decide mais vezes por chutar).
function aiFirstTime(m, p) {
  const b = m.ball, t = p.team, gx = m.goalX(t), pt = m.passTarget;
  if (p.action || !p.canPlay() || b.held || b.p.y > 1.3) return;
  if (p.ftKey !== pt.t) {
    p.ftKey = pt.t;
    const dG = Math.hypot(gx - pt.x, pt.z);
    const quer = clamp(0.3 + p.a.sho / 99 * 0.35 - Math.max(0, dG - 9) * 0.025 + (p.traits.includes('finalizador') ? 0.15 : 0), 0.05, 0.8);
    // (de fora da área, até ~24 m, só a bola rasteira e com menos frequência: o "chute de primeira")
    p.ftGo = (dG < 18 ? Math.abs(pt.z) < 13 : dG < 24 && Math.abs(pt.z) < 15 && b.p.y < 0.4) && m.lx(t, pt.x) < HL - 1.5 && Math.random() < quer;
  }
  if (!p.ftGo) return;
  // mesmo gatilho por tempo do humano (human.js firstTime)
  const anim = b.p.y > 0.45 ? ANIM.volley : ANIM.kick, ct = anim.dur * anim.contact;
  const rx = b.p.x - p.footX(), rz = b.p.z - p.footZ(), vx = b.v.x - p.vx, vz = b.v.z - p.vz, vv = vx * vx + vz * vz;
  const tc = vv > 1 ? -(rx * vx + rz * vz) / vv : 99;
  const dmin = tc < 99 ? Math.hypot(rx + vx * tc, rz + vz * tc) : Math.hypot(rx, rz);
  if (!(tc > 0 && tc <= ct + 1 / 60 && dmin < 1.0)) return;
  // no instante do toque: de costas para o gol ou sem ângulo, domina
  const aGoal = Math.atan2(-p.z, gx - p.x);
  if (Math.cos(angDiff(p.heading, aGoal)) < -0.2 || shotQuality(m, p) < 0.03) { p.ftGo = false; return; }
  const kind = b.p.y > 0.45 ? 'volley' : 'shot', dGoal = Math.hypot(gx - p.x, p.z);
  const tg = aiShotTarget(m, p, kind);
  const aT = Math.atan2(tg.z - p.z, tg.x - p.x), aB = Math.atan2(b.p.z - p.z, b.p.x - p.x);
  p.startAction(kind, { target: tg, power: dGoal < 12 ? rand(0.35, 0.6) : rand(0.55, 0.8), face: aB + angDiff(aB, aT) * 0.5, foot: footFor(p, tg) });
  p.ftGo = false;
}

// segue conduzindo no mesmo rumo enquanto prepara o passe (cabeça erguida), sem arrancar. Frear de
// repente ou mudar de rumo deixava a bola do último toque longe do pé (o toque foi planejado para
// o caminho anterior)
function prepCarry(m, p) {
  const pr = p.prep;
  if (pr && pr.dx !== undefined) { p.dx = pr.dx; p.dz = pr.dz; }
  else applyDribble(m, p, { kind: 'dribble' });
  const v = Math.hypot(p.dx, p.dz);
  if (v > p.jog) { p.dx *= p.jog / v; p.dz *= p.jog / v; }
  p.sprint = false;
}

function execPass(m, p, kind, q) {
  const tg = { x: q.x, z: q.z };
  // enfiada: o passador olha antes de soltar (~0,35 s até o toque)
  p.startAction(kind, { receiver: q, target: tg, power: kind === 'through' ? 0.55 : 0.6, face: Math.atan2(q.z - p.z, q.x - p.x), foot: footFor(p, tg), speedup: kind === 'through' ? 0.6 : 1 });
}

function footFor(p, tg) {
  // usa o pé bom; o ruim só quando o alvo está muito do outro lado
  const side = angDiff(p.heading, Math.atan2(tg.z - p.z, tg.x - p.x));
  if (p.foot > 0 && side < -1.2 && p.a.dri > 80) return -1;
  if (p.foot < 0 && side > 1.2 && p.a.dri > 80) return 1;
  return p.foot;
}

function applyDribble(m, p, intent) {
  const t = p.team;
  const gx = m.goalX(t);
  // rumo ao gol, desviando dos adversários
  let dx = gx - p.x, dz = -p.z * 0.6;
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  let ax = dx, az = dz;
  for (const q of t.opp.players) {
    if (q.sentOff) continue;
    const rx = p.x - q.x, rz = p.z - q.z, d = Math.hypot(rx, rz);
    if (d > 7 || d < 0.01) continue;
    const front = (q.x - p.x) * dx + (q.z - p.z) * dz;
    if (front < -1) continue;
    const w = (7 - d) / 7 * 1.6;
    ax += rx / d * w; az += rz / d * w;
  }
  // não sair pela lateral
  if (Math.abs(p.z) > HW - 4) az -= Math.sign(p.z) * 1.5;
  const al = Math.hypot(ax, az) || 1;
  const space = spaceAhead(m, p);
  // cansado arranca menos (seção 34: frequência de sprint)
  const sprint = space > 7 + p.fatigue * 8 && p.stamina > 0.25 + p.fatigue * 0.3;
  const s = sprint ? p.sprintSpd : p.jog;
  p.dx = ax / al * s; p.dz = az / al * s; p.sprint = sprint;
  // protege a bola se muito pressionado
  if (m.pressure(p) > 0.85 && space < 2) { p.shielding = true; p.slow = 0.5; }
}

// Reposicionamento sem a bola (auditoria Fase 2: velocidades reais). A marcha sai da
// distância ao alvo e à jogada: velocidade ≈ distância / 2,5 s (o alvo anda com a bola e
// quem está perto dele só caminha), teto de trote longe da bola, de corrida perto dela;
// arrancada só num recuo/avanço longo perto da jogada. Referência: em jogos reais ~40% do
// tempo é caminhando/parado e ~5% em alta intensidade (>25 km/h).
function shapeMove(m, p, x, z, urg, inten = 0.5, linha = false, acompanha = false) {
  const ex = x - p.x, ez = z - p.z, d = Math.hypot(ex, ez);
  const b = m.ball.p, db = linha ? Math.min(Math.hypot(b.x - p.x, b.z - p.z), 12) : Math.hypot(b.x - p.x, b.z - p.z);
  // parado fica parado até o alvo se afastar (mais folga longe da bola)
  const arrive = linha ? 0.4 : p.speed < 0.6 ? lerp(1.5, 3.5, clamp((db - 10) / 25, 0, 1)) : 0.5;
  if (d < arrive) { p.dx = p.dz = 0; p.sprint = false; return d; }
  const near = 1 - clamp((db - 10) / 20, 0, 1);              // 1 perto da jogada, 0 longe
  const cap = linha || acompanha ? p.jog : lerp(lerp(2.2, 3.0, inten), p.jog, near * near);
  const sprintOk = (linha ? d > 8 : d > 14 && near > 0.6) && p.stamina > 0.35;
  // centroavante no ataque: vai direto para a linha (ela anda com o ataque)
  const want = d / (linha ? 0.7 : acompanha ? 1.4 : lerp(4.5, 2, urg * near));
  const brake = Math.sqrt(2 * PLAYER.decel * 0.55 * d);
  const s = Math.min(sprintOk ? p.sprintSpd : cap, want, brake);
  p.dx = ex / d * s; p.dz = ez / d * s;
  p.sprint = sprintOk && s > p.jog + 0.2;
  return d;
}

function spaceAhead(m, p) {
  const t = p.team;
  const fx = t.dir, fz = 0;
  let minD = 30;
  for (const q of t.opp.players) {
    if (q.sentOff) continue;
    const rx = q.x - p.x, rz = q.z - p.z;
    const along = rx * fx + rz * fz;
    if (along < -1) continue;
    const lat = Math.abs(-rx * fz + rz * fx);
    if (lat < 3 + along * 0.4) minD = Math.min(minD, Math.hypot(rx, rz));
  }
  return minD;
}

// Chance de gol aproximada (ângulo de abertura, distância, bloqueios).
export function shotQuality(m, p) {
  const t = p.team;
  const gx = m.goalX(t);
  const dx = Math.abs(gx - p.x);
  const a1 = Math.atan2(GOAL.halfWidth - p.z * Math.sign(gx), dx), a2 = Math.atan2(-GOAL.halfWidth - p.z * Math.sign(gx), dx);
  const open = Math.abs(a1 - a2);
  const d = Math.hypot(gx - p.x, p.z);
  let xg = Math.pow(open / 1.2, 1.1) * Math.exp(-d / 16);
  let blockers = 0;
  for (const q of t.opp.players) {
    if (q.sentOff || q.isGK) continue;
    const along = ((q.x - p.x) * (gx - p.x) + (q.z - p.z) * (-p.z)) / (d * d);
    if (along < 0 || along > 1) continue;
    const cx = p.x + (gx - p.x) * along, cz = p.z + (-p.z) * along;
    if (Math.hypot(q.x - cx, q.z - cz) < 1.2 + along * 2.5) blockers++;
  }
  xg *= Math.pow(0.7, blockers);
  if (dx < 1) xg *= 0.2;
  return xg;
}

function aiShotTarget(m, p, kind = 'shot') {
  const t = p.team, gx = m.goalX(t);
  const gk = t.opp.gk;
  const side = gk.z > 0.2 ? -1 : gk.z < -0.2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
  // colocação: o finalizador frio escolhe o canto; com marcador em cima o chute sai "no gol",
  // mais perto do meio, onde o goleiro alcança. Antes todo chute ia no canto e, de perto, o
  // goleiro quase nunca chegava (conversão de 30% entre 6 e 11 m; no futebol real, ~15–20%)
  // de longe acertar o canto é bem mais difícil: no futebol real só ~15–20% dos gols saem de fora da área
  const dG = Math.hypot(gx - p.x, p.z);
  const calma = (kind === 'finesse' ? 0.85 : clamp(0.2 + p.a.sho / 99 * 0.55 - m.pressure(p) * 0.35, 0.1, 0.8)) * clamp(1 - (dG - 18) / 20, 0.45, 1);
  // mira longe do goleiro PELO ÂNGULO DE QUEM CHUTA: o ponto da linha do gol cuja trajetória passa mais longe
  // dele (antes valia só o lado oposto ao z do goleiro — com o goleiro na bissetriz, o "meio do outro lado"
  // passava a ~1 m dele e virava defesa). O frio escolhe bem; pressionado, o chute sai mais "no gol"
  const lim = GOAL.halfWidth - 0.45;
  let melhor = side * 2, nota = -1e9;
  if (gk && !gk.sentOff) for (let k = 0; k <= 12; k++) {
    const zz = -lim + 2 * lim * k / 12;
    const s = Math.min(segDist2(p.x, p.z, gx, zz, gk.x, gk.z), 2.5) - Math.abs(zz) / lim * 0.25 + rand(0, 1.2) * (1 - calma);
    if (s > nota) { nota = s; melhor = zz; }
  }
  const z = Math.random() < calma ? melhor : melhor * rand(0.3, 0.8);
  return { x: gx, y: Math.random() < 0.55 ? rand(0.2, 0.6) : rand(1.2, 2.05), z };
}

// Melhor companheiro para passe rasteiro, enfiada ou bola alta.
export function bestReceiver(m, p, mode, dirx, dirz, ponta = false) {
  const t = p.team;
  let best = null;
  const lxP = m.lx(t, p.x);
  const offLine = offsideLine(m, t);
  for (const q of t.players) {
    if (q === p || q.sentOff || !q.canPlay()) continue;
    const dx = q.x - p.x, dz = q.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 4) continue;
    if (mode === 'ground' && d > 38) continue;
    if (mode === 'air' && (d < 18 || d > 60)) continue;
    const lq = m.lx(t, q.x);
    if (mode === 'through' && (lq < lxP - 2 || d > 45 || q.isGK)) continue;
    // impedido não recebe (a IA respeita a linha)... mas quem passa erra a leitura quando o
    // atacante está só um pouco adiantado (como na vida real: ~2–4 impedimentos por jogo)
    if (lq > 0 && lq > offLine + 0.2 && lq > m.lx(t, m.ball.p.x)) {
      const margem = lq - offLine;
      const erra = margem < 1.2 ? OFFSIDE_MISS : margem < 2.5 ? OFFSIDE_MISS * 0.4 : 0.01;
      if (dirx !== undefined || Math.random() > erra * (1.25 - m.diff.aiSkill * 0.5)) continue;
    }
    if (q.isGK && (m.pressure(q) > 0.3 || mode !== 'ground')) continue;
    let s;
    const progress = (lq - lxP);
    const open = openness(m, q);
    if (dirx !== undefined) {
      const ang = Math.abs(angDiff(Math.atan2(dirz, dirx), Math.atan2(dz, dx)));
      if (ang > 1.05) continue;
      s = Math.cos(ang) * 2 - d / 45 + Math.min(open, 6) * 0.04;
    } else {
      let tx = q.x, tz = q.z;
      if (mode === 'through') {
        const lead = 8;
        tx = q.x + t.dir * lead; tz = q.z - q.z * 0.1;
        if (m.lx(t, tx) > HL - 3) continue;
      }
      const risk = laneRisk(m, p, tx, tz, mode, q);
      // passe arriscado custa caro: a bola cortada vira contra-ataque (o acerto de passe real
      // fica em 80–88%; aqui eram 18% dos passes rasteiros cortados). Perto do gol rival o time
      // arrisca mais (no futebol real o acerto cai de ~88% no próprio campo para ~70% no último
      // terço): antes o peso do risco era o mesmo em todo o campo e quase nenhum passe entrava na área
      // (a enfiada pesa o risco quase como o passe rasteiro: cortada em 3 de cada 4 no último terço)
      // (no meio, contra a pressão a dois, o risco pesa um pouco mais: 0,85 → 0,95 no rasteiro e 1,5 → 1,65 na
      // enfiada — sem isso o acerto de passe caía de 77% para 76%)
      const kRisk = mode === 'ground' ? 2.2 * (lxP > 18 ? 0.8 : lxP < -18 ? 1.15 : 0.95) : mode === 'through' ? (lxP > 18 ? 1.8 : 1.65) : 1.6;
      // progressão vale mais que recuo (para a frente 0,025/m, para trás 0,022/m): contra o bloco fechado a IA
      // reciclava a bola para trás — 36% dos passes, ~58 por partida (no futebol real ~20–25% são para trás)
      s = 0.36 + clamp(progress, -15, 25) * (progress > 0 && mode !== 'air' ? 0.025 : 0.022) + Math.min(open, 7) * 0.045 - risk * kRisk - (d > 30 ? 0.15 : 0);
      // virada de jogo: o bloco que defende fecha o lado da bola, o lado de lá fica livre
      if (mode === 'ground' && Math.abs(q.z - m.ball.p.z) > 18 && open > 6 && progress > -6 && risk < 0.15) s += 0.12;
      if (mode === 'through') {
        s += q.runUntil > m.time ? 0.35 : -0.25;
        // a enfiada boa sai quando o atacante está chegando na linha ("no ombro" do zagueiro);
        // com ele ainda 4–5 m atrás, a defesa chega antes
        const mg = lq - offLine;
        s += mg > -1.6 ? 0.3 : mg > -3 ? 0.1 : mg < -4.5 ? -0.2 : 0;
      }
      // bola longa nas costas da zaga: idem, sai quando o atacante está na linha
      if (mode === 'air' && q.role === 'ATT') { const mg = lq - offLine; s += mg > -1.6 && mg < 1.2 ? 0.15 : 0; }
      // bola longa disputada quase sempre se perde (era 32% de acerto): só lança com folga
      if (mode === 'air') s -= 0.67 - t.style.directness * 0.15 + Math.max(0, risk - 0.2) * 2.0 + (lxP < -15 ? 0.12 : 0);
      if (m.lx(t, q.x) > HL - 17 && Math.abs(q.z) < 18) s += 0.2;
      if (ponta) s += clamp((Math.abs(q.z) - 12) / 14, 0, 1) * 0.25;
      if (lq < -35) s -= 0.2;
      // para trás só quando apertado: sem pressão o meia procura a frente ou conduz (no meio-campo
      // 45% dos passes da IA iam para trás; no futebol real ~25–30%)
      // (apertado também: o time pressionado sai jogando para a frente ou para o lado livre; recua só sem saída —
      // antes, sob pressão, o recuo não custava nada e com a pressão a dois virava o padrão)
      if (progress < -4 && lxP > -30) s -= 0.18 * (1 - clamp(m.pressure(p) * 1.4, 0, 1));
      // recuo para o goleiro só para sair de um aperto perto da própria área
      if (q.isGK && !(lxP < -25 && m.pressure(p) > 0.7)) s -= 0.2;
    }
    if (!best || s > best.s) best = { q, s };
  }
  return best;
}

function openness(m, q) {
  let o = 20;
  for (const r of q.team.opp.players) if (!r.sentOff) o = Math.min(o, Math.hypot(r.x - q.x, r.z - q.z));
  return o;
}

export function laneRisk(m, p, tx, tz, mode, q = null) {
  const dx = tx - p.x, dz = tz - p.z, L = Math.hypot(dx, dz) || 1;
  const speed = mode === 'air' ? 20 : 10;
  let risk = 0;
  if (mode === 'air') {
    // bola longa: corrida até o ponto de queda durante o voo (~0,5 s + D/19). Quem chega
    // antes — o recebedor ou algum defensor — fica com ela (antes só contava defensor a 3 m
    // do ponto, num voo de ~2 s: 106 lançamentos por jogo e 15% de acerto)
    const tb = 0.5 + L / 19;
    const tRec = q ? Math.max(0, Math.hypot(q.x - tx, q.z - tz) - 1) / 7 + 0.15 : 0.6;
    for (const o of p.team.opp.players) {
      if (o.sentOff) continue;
      const tOpp = Math.max(0, Math.hypot(o.x - tx, o.z - tz) - 1.2) / 6.8 + 0.3;
      risk = Math.max(risk, clamp((Math.max(tRec, tb * 0.6) - tOpp) * 0.9 + 0.45, 0, 1));
      // marcador colado no passador: a bola bate nele na saída
      const fx = o.x - p.x, fz = o.z - p.z, fd = Math.hypot(fx, fz);
      if (fd < 2.2 && (fx * dx + fz * dz) / (fd * L + 1e-6) > 0.3) risk = Math.max(risk, 0.75);
    }
    return risk;
  }
  for (const o of p.team.opp.players) {
    if (o.sentOff) continue;
    const u = clamp(((o.x - p.x) * dx + (o.z - p.z) * dz) / (L * L), 0, 1);
    const cx = p.x + dx * u, cz = p.z + dz * u;
    const d = Math.hypot(o.x - cx, o.z - cz);
    const tb = (u * L) / speed;
    const to = Math.max(0, d - 0.9) / 6.5 + 0.2;
    risk = Math.max(risk, clamp((tb - to) * 1.6 + 0.4, 0, 1));
    // marcador colado no passador: o passe que sai na direção dele bate na perna. Era a maior causa
    // de passe cortado (55% dos passes da IA saíam com marcador a ~2 m, e só 70% chegavam): o
    // cálculo acima achava que a bola passava antes de ele reagir
    const fx = o.x - p.x, fz = o.z - p.z, fd = Math.hypot(fx, fz);
    if (fd < 2.6) {
      const along = (fx * dx + fz * dz) / L, lat = Math.abs(-fx * dz + fz * dx) / L;
      if (along > -0.2 && lat < 1.15) risk = Math.max(risk, 0.9 - lat * 0.35);
    }
  }
  return risk;
}

function celebrate(m, p) {
  const c = p.celebTarget, gi = m.goalInfo;
  if (c && !c.mate) {
    // autor: corre até a torcida; perto dela faz o gesto (a joelhada começa antes, deslizando)
    if (p.celebDone) { p.dx = p.dz = 0; if (!p.action) p.face = { x: c.x * 1.2, z: c.z * 1.2 }; return; }
    const v = p.celebVariant || 0;
    const d = p.moveTo(c.x, c.z, 1, true);
    if (v !== 0 && d < (v === 1 ? 5.5 : 1.6) && (!p.action || p.action.type !== 'celebrate')) {
      p.startAction('celebrate', { variant: v, dur: v === 1 ? 3.2 : 3.6 });
      p.celebDone = true;
    } else if (v === 0 && d < 1.2) { p.celebDone = true; p.dx = p.dz = 0; }
  } else if (c && c.mate) {
    // companheiros: reagem, correm até o autor e fecham o abraço em roda
    const sc = gi?.scorer;
    if (!sc || gi.t < c.delay) { p.dx = p.dz = 0; return; }
    if (p.action && p.action.type === 'hug') return;
    if (p.isGK) { p.moveTo(p.x + Math.sign(c.x) * 0.5, p.z, 0.4, false); if (!p.action && gi.t > 1.5) p.startAction('celebrate', { variant: 2, dur: 3 }); return; }
    const k = p.team.players.indexOf(p), ang = k * 2.4 + 0.7;
    const sx = sc.x + sc.vx * 0.35, sz = sc.z + sc.vz * 0.35;
    const tx = sx + Math.cos(ang) * 0.62, tz = sz + Math.sin(ang) * 0.62;
    const d = p.moveTo(tx, tz, 1, true);
    const scStill = Math.hypot(sc.vx, sc.vz) < 1.2;
    if (d < 1.0 && scStill) p.startAction('hug', { dur: 6, variant: k, face: Math.atan2(sc.z - p.z, sc.x - p.x) });
  } else {
    p.moveTo(p.x * 0.98, p.z * 0.98, 0.15, false);
    p.face = m.ball.p;
  }
}

// ---------------------------------------------------------- bolas paradas
// Organização (pedido do dono: "tiro de meta muito mal organizado, jogadores do time adversário dentro da
// área"; escanteio, lateral). Alvos no referencial de ataque do time que cobra (lx: o próprio gol em -HL,
// lz = z·dir), uma vez por bola parada:
//  tiro de meta — zagueiros abertos na área, volante na entrada dela, laterais altos e abertos; o adversário
//                 FORA da área (Regra 16), 2–3 atacantes pressionando na linha da área
//  lateral      — 3 opções (curta na linha, curta por dentro, mais longa por dentro) e quem marca cada uma
//  escanteio    — 5 na área partindo de trás para atacar a bola (primeiro pau, segundo pau, marca do pênalti,
//                 em cima do goleiro, entre o primeiro pau e a marca), 2 na entrada da área, 2 atrás; quem
//                 defende: 3 na pequena área (zona), 1 no primeiro pau, marcação nos mais fortes no alto,
//                 1 na entrada da área e 1 na frente para o contra-ataque
const slotOf = (p) => { const f = p.team.formation[p.slot] || []; return { role: f[0] || p.role, bx: f[1] ?? 0, bz: f[2] ?? 0 }; };
const aereo = (q) => (q.data.look?.height || 1.8) * 100 + (q.a.phy ?? 60) * 0.6 + (q.a.str ?? 60) * 0.3;
function alvosBolaParada(m, sp) {
  const team = sp.team, opp = team.opp, dir = team.dir;
  const set = (p, lx, lz) => { p.spAlvo = { x: lx * dir, z: lz * dir }; };
  const vivos = (t) => t.players.filter(q => !q.sentOff && !q.isGK);
  for (const q of m.players) { q.spRun = null; q.spMarca = null; q.spAlvo = null; }
  if (sp.type === 'goalkick') {
    const defs = vivos(team).filter(q => slotOf(q).role === 'DEF').sort((a, c) => slotOf(a).bz - slotOf(c).bz);
    const n = defs.length, lat = n >= 4;
    defs.forEach((q, k) => {
      if (lat && (k === 0 || k === n - 1)) { set(q, -HL + 27, (k ? 1 : -1) * 27); return; }
      const cen = lat ? n - 2 : n, i = lat ? k - 1 : k;
      if (cen === 3 && i === 1) { set(q, -HL + 19, 0); return; }
      set(q, -HL + 11.5, cen <= 1 ? 0 : (i / (cen - 1) - 0.5) * 2 * 13.5);
    });
    vivos(team).filter(q => slotOf(q).role === 'MID').sort((a, c) => slotOf(a).bx - slotOf(c).bx)
      .forEach((q, k) => { if (k === 0) set(q, -HL + 21, 0); else set(q, -HL + 34, clamp(slotOf(q).bz * 1.1, -25, 25)); });
    vivos(team).filter(q => slotOf(q).role === 'ATT').forEach(q => set(q, -HL + 50, clamp(slotOf(q).bz, -26, 26)));
    for (const q of vivos(opp)) {
      const s = slotOf(q);
      let lx, lz = -s.bz;
      if (s.role === 'ATT') { lx = -HL + 18; lz = clamp(-s.bz * 0.45, -11, 11); }
      else if (s.role === 'MID') { lx = -HL + 31; lz = clamp(-s.bz, -24, 24); }
      else { lx = -HL + 58; lz = clamp(-s.bz * 0.9, -24, 24); }
      if (lx < -HL + PITCH.boxDepth + 1 && Math.abs(lz) < PITCH.boxHalfW + 1) lx = -HL + PITCH.boxDepth + 1.5;
      set(q, lx, lz);
    }
  } else if (sp.type === 'throwin') {
    const lzT = sp.z * dir, sg = Math.sign(lzT) || 1, lxT = sp.x * dir;
    const opcoes = [[lxT + 9, sg * (HW - 5)], [lxT - 2, sg * (HW - 10)], [lxT + 4, sg * (HW - 17)]]
      .map(([x, z]) => [clamp(x, -HL + 3, HL - 3), z]);
    const livres = vivos(team).filter(q => q !== sp.taker), escolhidos = [];
    for (const [ox, oz] of opcoes) {
      let best = null, bd = 1e9;
      for (const q of livres) { if (escolhidos.includes(q)) continue; const d = Math.hypot(q.x - ox * dir, q.z - oz * dir); if (d < bd) { bd = d; best = q; } }
      if (best) { escolhidos.push(best); set(best, ox, oz); }
    }
    const usados = [], og = m.ownGoalX(opp);
    for (const q of escolhidos) {
      let best = null, bd = 1e9;
      for (const o of vivos(opp)) { if (usados.includes(o)) continue; const d = Math.hypot(o.x - q.spAlvo.x, o.z - q.spAlvo.z); if (d < bd) { bd = d; best = o; } }
      if (best) { usados.push(best); best.spAlvo = { x: q.spAlvo.x + Math.sign(og - q.spAlvo.x) * 1.5, z: q.spAlvo.z * 0.94 }; }
    }
  } else if (sp.type === 'corner') {
    const lado = Math.sign(sp.z * dir) || 1;
    const zonas = [[HL - 5, lado * 2.5], [HL - 6, -lado * 3.5], [HL - 11, lado * 0.5], [HL - 2.5, lado * 0.6], [HL - 8, lado * 6]];
    const cand = vivos(team).filter(q => q !== sp.taker).sort((a, c) => aereo(c) - aereo(a));
    const nArea = Math.max(0, Math.min(5, cand.length - 4));
    cand.forEach((q, k) => {
      if (k < nArea) {
        const [zx, zz] = zonas[k];
        set(q, zx - 4.5, zz * 0.5 - lado * 2);                     // parte de trás, longe da zona
        q.spRun = { x: zx * dir, z: zz * dir, ate: 0, alvo: true };
      } else if (k < nArea + 2) set(q, HL - 19, (k === nArea ? 1 : -1) * 7);
      else set(q, k === nArea + 2 ? 2 : -10, (k % 2 ? 9 : -9));   // atrás, no meio-campo
    });
    // quem defende (no referencial de quem cobra, o gol defendido fica em lx = +HL)
    const dfs = vivos(opp);
    const frente = dfs.filter(q => slotOf(q).role === 'ATT').sort((a, c) => c.a.pac - a.a.pac).slice(0, 1);
    const zona = [[HL - 4.5, lado * 3.2], [HL - 4.5, 0], [HL - 4.5, -lado * 3.2]];
    const resto = dfs.filter(q => !frente.includes(q)).sort((a, c) => aereo(c) - aereo(a));
    const marcados = cand.slice(0, nArea);
    let i = 0;
    for (const q of frente) set(q, 8, lado * -6);
    // marcação individual nos mais fortes no alto (os mais altos de quem defende)
    for (const a of marcados.slice(0, 3)) { const q = resto[i++]; if (!q) break; set(q, a.spAlvo.x * dir + 0.9, a.spAlvo.z * dir * 0.95); q.spMarca = { q: a, ate: 0 }; }
    for (const [zx, zz] of zona) { const q = resto[i++]; if (!q) break; set(q, zx, zz); }
    { const q = resto[i++]; if (q) set(q, HL - 0.9, lado * (GOAL.halfWidth + 0.3)); }        // primeiro pau
    { const q = resto[i++]; if (q) set(q, HL - 17, 0); }                                     // entrada da área
    while (i < resto.length) { const q = resto[i++]; const a = marcados[3 + (i % 2)]; if (a) { set(q, a.spAlvo.x * dir + 0.9, a.spAlvo.z * dir * 0.95); q.spMarca = { q: a, ate: 0 }; } else set(q, HL - 9, -lado * 6); }
  }
}

export function setpieceAI(m, dt) {
  const sp = m.sp;
  if (!sp) return;
  sp.t += dt;
  const team = sp.team, opp = team.opp;
  const b = m.ball.p;
  const gx = m.goalX(team), dir = team.dir;
  if (!sp.alvos && (sp.type === 'goalkick' || sp.type === 'throwin' || sp.type === 'corner')) { sp.alvos = true; alvosBolaParada(m, sp); }
  if (sp.type === 'goalkick' || sp.type === 'throwin' || sp.type === 'corner') {
    for (const t of m.teams) for (const p of t.players) {
      if (p.sentOff || p.isGK || p === sp.taker || humanDriving(m, p)) continue;
      const a = p.spAlvo || p.target, d = Math.hypot(a.x - p.x, a.z - p.z);
      p.moveTo(a.x, a.z, d > 3 ? 1 : 0.6, d > 9);
      p.face = b;
    }
  } else if ((sp.type === 'freekick' || sp.type === 'indirect') && Math.abs(gx - b.x) < 40) {
    const spots = [
      [5.5, 3 * Math.sign(b.z || 1)], [6.5, -3 * Math.sign(b.z || 1)], [11, 0], [9, 5], [16.5, -2], [8, -8],
    ];
    const line = offsideLine(m, team);
    const att = team.players.filter(p => !p.sentOff && !p.isGK && p !== sp.taker).sort((a, c) => c.a.phy + c.data.look.height * 30 - (a.a.phy + a.data.look.height * 30));
    att.forEach((p, k) => {
      if (humanDriving(m, p)) return;
      if (k < spots.length && k < 5) {
        let x = gx - dir * spots[k][0], z = spots[k][1];
        x = Math.min(m.lx(team, x), line - 0.5) * dir;
        p.target.x = x; p.target.z = z;
      }
      p.moveTo(p.target.x, p.target.z, 0.6, false);
      p.face = b;
    });
    const def = opp.players.filter(p => !p.sentOff && !p.isGK && !p.inWall);
    def.forEach((p, k) => {
      if (humanDriving(m, p)) return;
      const q = att[k];
      if (q && k < 6) { const og = m.ownGoalX(opp); p.target.x = q.target.x + Math.sign(og - q.target.x) * 1; p.target.z = q.target.z * 0.9; }
      p.moveTo(p.target.x, p.target.z, 0.6, false);
      p.face = b;
    });
  } else {
    for (const t of m.teams) for (const p of t.players) {
      if (p.sentOff || p.isGK || p === sp.taker || p.inWall || humanDriving(m, p)) continue;
      if (sp.type === 'kickoff' || sp.type === 'penalty') { p.dx = p.dz = 0; p.face = b; continue; }
      p.moveTo(p.target.x, p.target.z, 0.5, false);
      p.face = b;
    }
  }
  for (const p of m.wall || []) { p.dx = p.dz = 0; p.face = b; }
  if (!sp.taken && sp.taker) { sp.taker.dx = sp.taker.dz = 0; }

  // tiro de meta do humano apertado com adversário ainda na área: sai assim que a área esvaziar
  if (sp.pendente && !sp.taken && (!areaOcupada(m, sp) || sp.t > 6)) { const pd = sp.pendente; sp.pendente = null; m.takeSetpiece(pd.kind, pd.params); return; }
  // cobrador da IA: espera o time se arrumar (tiro de meta: área vazia de adversários, Regra 16;
  // escanteio: quem vai atacar a bola no ponto de partida; lateral: as opções chegando), no máximo ~6 s
  const human = team.human && !(m.shootout && false);
  const wait = sp.type === 'kickoff' ? 1.2 : sp.type === 'penalty' ? 1.8 : 1.6;
  if (sp.taken || (human && sp.t < 14) || sp.t < wait) return;
  if (sp.t < 6 && sp.type === 'goalkick' && areaOcupada(m, sp)) return;
  // (escanteio: até ~10 s — os zagueiros vêm do outro campo, como no futebol de verdade)
  if (sp.t < (sp.type === 'corner' ? 10 : 5) && (sp.type === 'corner' || sp.type === 'throwin') &&
    team.players.some(q => !q.sentOff && !q.isGK && q !== sp.taker && q.spAlvo && Math.hypot(q.spAlvo.x - q.x, q.spAlvo.z - q.z) > (sp.type === 'corner' ? 2.5 : 4))) return;
  aiTakeSetpiece(m, sp);
}

// algum adversário dentro da área no tiro de meta?
export function areaOcupada(m, sp) {
  return sp.team.opp.players.some(q => !q.sentOff && !q.isGK && m.inOwnBox(sp.team.players[0], q.x, q.z));
}

function aiTakeSetpiece(m, sp) {
  const team = sp.team, p = sp.taker, b = m.ball.p;
  const gx = m.goalX(team), dir = team.dir;
  if (sp.type === 'kickoff') {
    const q = team.players.filter(q => q !== p && !q.sentOff).sort((a, c) => dist(a, p) - dist(c, p))[0];
    sp.aim = Math.atan2(q.z - p.z, q.x - p.x);
    m.takeSetpiece('pass', { receiver: q, target: { x: q.x, z: q.z }, power: 0.35 });
    return;
  }
  if (sp.type === 'throwin') {
    const cands = team.players.filter(q => q !== p && !q.sentOff && !q.isGK && dist(q, p) < 22).sort((a, c) => (openness(m, c) - dist(c, p) * 0.2) - (openness(m, a) - dist(a, p) * 0.2));
    const q = cands[0];
    if (q) { sp.aim = Math.atan2(q.z - p.z, q.x - p.x); m.takeSetpiece('pass', { receiver: q, target: { x: q.x, z: q.z } }); }
    else m.takeSetpiece('pass', { target: { x: p.x + dir * 10, z: p.z * 0.7 } });
    return;
  }
  if (sp.type === 'corner') {
    // bola numa zona de ataque (primeiro pau ~35%, segundo pau ~25%, marca do pênalti ~25%, outras), no
    // ponto onde o atacante daquela zona vai chegar correndo
    const runners = team.players.filter(q => q.spRun && q.spRun.alvo && !q.sentOff);
    const pesos = [0.35, 0.25, 0.25, 0.05, 0.1];
    let r = Math.random(), k = 0;
    while (k < runners.length - 1 && r > pesos[k]) { r -= pesos[k]; k++; }
    const q = runners[k];
    const tg = q ? { x: q.spRun.x, z: q.spRun.z } : { x: gx - dir * 8, z: 0 };
    sp.aim = Math.atan2(tg.z - p.z, tg.x - p.x);
    m.takeSetpiece('cross', { receiver: q, target: tg, power: 0.75 });
    return;
  }
  if (sp.type === 'goalkick') {
    // tiro de meta curto quando há zagueiro livre (como o futebol de hoje); senão, longo no mais
    // livre na queda da bola (antes: atacante sorteado)
    const qd = team.players.filter(q => q.role === 'DEF' && !q.sentOff).sort((a, c) => openness(m, c) - openness(m, a))[0];
    if (qd && openness(m, qd) > 5 && Math.random() < 0.95) { sp.aim = Math.atan2(qd.z - p.z, qd.x - p.x); m.takeSetpiece('pass', { receiver: qd, target: { x: qd.x, z: qd.z }, power: 0.6 }); return; }
    const q = bestReceiver(m, p, 'air')?.q || team.players.filter(q => (q.role === 'ATT' || q.role === 'MID') && !q.sentOff).sort(() => Math.random() - 0.5)[0];
    const tg = { x: q.x, z: q.z };
    sp.aim = Math.atan2(tg.z - p.z, tg.x - p.x);
    m.takeSetpiece('long', { receiver: q, target: tg, power: 0.9 });
    return;
  }
  if (sp.type === 'penalty') {
    const z = (Math.random() < 0.5 ? -1 : 1) * rand(1.5, GOAL.halfWidth - 0.5);
    const tg = { x: gx, y: Math.random() < 0.6 ? rand(0.2, 0.7) : rand(1.1, 1.9), z };
    if (Math.random() < 0.08) tg.z = rand(-0.6, 0.6);
    sp.aim = Math.atan2(tg.z - b.z, tg.x - b.x);
    m.takeSetpiece('penalty', { target: tg, power: rand(0.55, 0.85) });
    return;
  }
  // falta
  const dGoal = Math.hypot(gx - b.x, b.z);
  const angleOk = Math.abs(b.z) < 22;
  if (sp.type === 'freekick' && dGoal < 30 && angleOk) {
    const side = b.z > 0 ? -1 : 1;
    const tg = { x: gx, y: rand(1.3, 2.1), z: side * rand(2.0, GOAL.halfWidth - 0.45) };
    sp.aim = Math.atan2(tg.z - b.z, tg.x - b.x);
    m.takeSetpiece('freekick', { target: tg, power: 0.7, foot: p.foot });
    return;
  }
  const r = bestReceiver(m, p, dGoal < 45 ? 'air' : 'ground') || bestReceiver(m, p, 'ground');
  if (r) {
    sp.aim = Math.atan2(r.q.z - p.z, r.q.x - p.x);
    m.takeSetpiece(dGoal < 45 ? 'cross' : 'pass', { receiver: r.q, target: { x: r.q.x, z: r.q.z }, power: 0.6 });
  } else m.takeSetpiece('long', { target: { x: gx - dir * 12, z: 0 }, power: 0.8 });
}
