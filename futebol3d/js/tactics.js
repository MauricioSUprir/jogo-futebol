// Camada tática da IA (especificação §17–§20). Lógica pura (sem three.js/DOM).
//
// • Intensidade (§17): estado tático/emocional de cada time, de "muito baixa" a "extrema",
//   calculado pelo placar, minuto, importância (mata-mata) e cansaço do time. Sobe a
//   pressão, a linha, o apoio e a agressividade — e cobra energia (desgaste ↑) e abre
//   espaço atrás. Ninguém consegue pressionar no máximo o jogo inteiro.
// • Utilidade individual (§18): cada jogador avalia pontos candidatos perto da sua função
//   e escolhe o de maior utilidade = espaço + linha de passe + função + oportunidade −
//   risco (impedimento, congestionamento). Atacante busca profundidade, ponta amplitude,
//   meia entrelinhas, lateral avalia ultrapassagem, volante cobre.
// • Traços (§20): mudam DECISÕES, não só números (ver traitsOf).
import { PITCH, clamp, lerp } from './config.js';

const HL = PITCH.halfL, HW = PITCH.halfW;

// ------------------------------------------------------------------ traços
export const TRAITS = {
  maestro: { nome: 'Maestro', ic: '🎨', desc: 'dita o ritmo: prefere o passe certo, segura e acelera o jogo' },
  explosivo: { nome: 'Explosivo', ic: '⚡', desc: 'arranca nas costas e conduz em velocidade' },
  driblador: { nome: 'Driblador', ic: '🪄', desc: 'procura o 1×1 e a finta' },
  finalizador: { nome: 'Finalizador', ic: '🎯', desc: 'chuta mais na área e erra menos sob pressão' },
  criativo: { nome: 'Criativo', ic: '🧠', desc: 'arrisca o passe que quebra linhas' },
  motor: { nome: 'Motor', ic: '🏃', desc: 'cansa menos e pressiona o jogo todo' },
  muralha: { nome: 'Muralha', ic: '🧱', desc: 'firme no corpo a corpo e paciente para dar o bote' },
  lider: { nome: 'Líder', ic: '👑', desc: 'organiza o time: sobe a intensidade quando é preciso' },
  frio: { nome: 'Frio', ic: '🧊', desc: 'não treme: pênalti e finalização sob pressão' },
  agressivo: { nome: 'Agressivo', ic: '🔥', desc: 'dá o bote cedo e chega forte (mais faltas)' },
  cacador: { nome: 'Caçador de Espaços', ic: '👁️', desc: 'ataca o espaço vazio e vive no limite do impedimento' },
};

// Até 2 traços por jogador, pelos atributos e pela posição (determinístico).
export function traitsOf(a, pos) {
  const c = [];
  const att = ['CA', 'ATA', 'PD', 'PE'].includes(pos), mid = ['MEI', 'MC', 'VOL', 'MD', 'ME'].includes(pos);
  const ctl = a.ctl ?? a.dri, agi = a.agi ?? a.dri, acc = a.acc ?? a.pac, str = a.str ?? a.phy, ant = a.ant ?? a.def;
  if (a.pas >= 84 && ctl >= 80 && (mid || pos === 'MEI')) c.push(['maestro', a.pas + ctl]);
  if (acc >= 88) c.push(['explosivo', acc * 2]);
  if (a.dri >= 85 && agi >= 82) c.push(['driblador', a.dri + agi]);
  if (a.sho >= 84 && att) c.push(['finalizador', a.sho * 2]);
  if (a.pas >= 79 && a.dri >= 80 && !c.some(x => x[0] === 'maestro')) c.push(['criativo', a.pas + a.dri - 4]);
  if ((a.sta ?? a.phy) >= 84) c.push(['motor', (a.sta ?? a.phy) * 2 - 6]);
  if (a.def >= 85 && str >= 85) c.push(['muralha', a.def + str]);
  if (att && a.pac >= 82 && a.sho >= 78 && !c.some(x => x[0] === 'explosivo')) c.push(['cacador', a.pac + a.sho - 2]);
  if (a.def >= 76 && str >= 84 && !c.some(x => x[0] === 'muralha')) c.push(['agressivo', str + a.def - 8]);
  if (a.sho >= 77 && ctl >= 78 && (a.bal ?? a.phy) >= 76) c.push(['frio', a.sho + ctl - 6]);
  c.sort((x, y) => y[1] - x[1]);
  return c.slice(0, 2).map(x => x[0]);
}

// O líder do time: maior soma de atributos físico+defesa+passe entre os veteranos (o 1º
// em campo com mais "presença"); marcado ao montar a partida.
export function pickLeader(players) {
  let best = null, bs = -1;
  for (const p of players) {
    if (p.isGK) continue;
    const s = p.a.phy + p.a.def * 0.6 + p.a.pas * 0.6;
    if (s > bs) { bs = s; best = p; }
  }
  if (best && !best.traits.includes('lider')) best.traits = [...best.traits.slice(0, 1), 'lider'];
}

// ------------------------------------------------------------------ intensidade
export const INTENSITY_LEVELS = ['Muito baixa', 'Baixa', 'Normal', 'Alta', 'Extrema'];
export const intensityLevel = (v) => (v < 0.22 ? 0 : v < 0.4 ? 1 : v < 0.62 ? 2 : v < 0.82 ? 3 : 4);

// Atualiza t.intensity (0..1) uma vez por segundo de jogo, suavizado.
export function updateIntensity(m, t, dt) {
  t.intT = (t.intT || 0) - dt;
  if (t.intT > 0 && t.intensity !== undefined) return;
  t.intT = 1;
  const fullMin = 90, minute = m.clock / 60, f = clamp(minute / fullMin, 0, 1.4);
  const diff = t.score - t.opp.score;
  let v = 0.45 + (t.style.press - 0.6) * 0.25;
  if (diff < 0) v += (0.12 + 0.38 * f * f) * Math.min(2, -diff) * 0.75;      // perdendo: aperta mais no fim
  else if (diff > 0) v -= 0.1 + 0.15 * f;                                      // ganhando: controla
  else if (f > 0.75) v += m.cfg?.knockout ? 0.18 : 0.08;                        // empate no fim (mata-mata pesa)
  if (m.shootout) v = 0.5;
  // líder em campo puxa o time quando o jogo pede
  if (t.players.some(p => !p.sentOff && p.traits?.includes('lider')) && (diff < 0 || f > 0.75)) v += 0.05;
  // cansaço do time limita o quanto dá para sustentar
  let fat = 0, n = 0;
  for (const p of t.players) if (!p.sentOff && !p.isGK) { fat += p.fatigue; n++; }
  v -= (fat / Math.max(1, n)) * 0.45;
  v = clamp(v, 0.05, 1);
  const prev = t.intensity ?? v;
  t.intensity = prev + (v - prev) * 0.35;
  const lvl = intensityLevel(t.intensity);
  if (t.intLevel !== undefined && lvl !== t.intLevel && lvl === 4 && m.phase === 'play') {
    m.emit('banner', { text: 'PRESSÃO TOTAL', sub: `${t.data?.name || t.name || ''} vai para o tudo ou nada`, kind: 'chance' });
  }
  t.intLevel = lvl;
}

// ------------------------------------------------------------------ utilidade
// Linha de defesa e de meio do adversário (coordenada "lx" do time t: + = rumo ao gol rival).
export function oppLines(m, t) {
  const xs = t.opp.players.filter(q => !q.sentOff && !q.isGK).map(q => m.lx(t, q.x)).sort((a, b) => b - a);
  const def = xs.slice(0, 4), midl = xs.slice(4, 8);
  const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  return { def: avg(def), mid: avg(midl) };
}

// Espaço livre num ponto (distância ao adversário mais próximo, saturada).
function space(m, t, x, z) {
  let d = 99;
  for (const q of t.opp.players) if (!q.sentOff) d = Math.min(d, Math.hypot(q.x - x, q.z - z));
  return Math.min(d, 9);
}

// Linha de passe livre do portador até o ponto (adversário perto do segmento = ruim).
function laneOpen(t, ox, oz, x, z) {
  const dx = x - ox, dz = z - oz, L = Math.hypot(dx, dz) || 1;
  let worst = 9;
  for (const q of t.opp.players) {
    if (q.sentOff) continue;
    const u = clamp(((q.x - ox) * dx + (q.z - oz) * dz) / (L * L), 0, 1);
    worst = Math.min(worst, Math.hypot(ox + dx * u - q.x, oz + dz * u - q.z));
  }
  return Math.min(worst, 5);
}

// Ajusta p.target pela utilidade da função quando o time ataca (chamado depois do
// alvo de formação). Reavalia a cada ~0,5 s por jogador (barato).
export function roleUtility(m, t, p, owner, offLine) {
  if (!owner || owner === p || p.human) return;
  p.utT = (p.utT || 0) - 1;
  if (p.utT > 0 && p.utPick) { p.target.x = lerp(p.target.x, p.utPick.x, 0.6); p.target.z = lerp(p.target.z, p.utPick.z, 0.6); return; }
  p.utT = 30;
  const [role, , bz] = t.formation[p.slot];
  const lines = oppLines(m, t);
  const blx = m.lx(t, owner.x), inten = t.intensity ?? 0.5;
  const wide = Math.abs(bz) > 14;
  const tr = p.traits || [];
  let anchorX = m.lx(t, p.target.x), anchorZ = p.target.z * t.dir;
  // função de cada um (coordenadas "do time": x para o gol rival, z no lado do time)
  let kind = 'manter';
  if (role === 'ATT' && !wide) { kind = 'profundidade'; anchorX = Math.min(offLine - 1, Math.max(anchorX, Math.min(offLine - 1, blx + 25))); }
  else if (role === 'ATT' || (role === 'MID' && wide)) { kind = 'amplitude'; anchorZ = Math.sign(bz || 1) * (HW - 4); }
  else if (role === 'MID' && Math.abs(bz) < 6 && p.slot === t.formation.findIndex(f => f[0] === 'MID')) { kind = 'cobertura'; anchorX = Math.min(anchorX, blx - 6); }
  else if (role === 'MID') { kind = 'entrelinhas'; anchorX = clamp((lines.def + lines.mid) / 2, blx - 4, offLine - 1.5); }
  else if (role === 'DEF' && wide && blx > -5 && Math.sign(owner.z * t.dir || 1) === Math.sign(bz) && inten + t.style.width * 0.4 > 0.75) {
    kind = 'ultrapassagem'; anchorX = Math.min(offLine - 1, blx + 9); anchorZ = Math.sign(bz) * (HW - 3);
  }
  if (kind === 'manter') return;
  // candidatos em volta da âncora; utilidade = espaço + linha de passe + função − risco
  let best = null, bs = -1e9;
  const ox = owner.x, oz = owner.z;
  for (let i = 0; i < 9; i++) {
    // profundidade: só desliza na linha (não recua)
    const ddx = i === 0 ? 0 : Math.cos(i * 0.785) * (kind === 'entrelinhas' ? 4 : kind === 'profundidade' ? 1.2 : 6);
    const ddz = i === 0 ? 0 : Math.sin(i * 0.785) * (kind === 'amplitude' ? 3 : 6);
    let lx = anchorX + ddx, lz = anchorZ + ddz;
    lx = clamp(lx, -HL + 3, HL - 3); lz = clamp(lz, -HW + 1.5, HW - 1.5);
    const x = lx * t.dir, z = lz * t.dir;
    let u = space(m, t, x, z) * 0.55 + laneOpen(t, ox, oz, x, z) * 0.45;
    u -= Math.hypot(lx - anchorX, lz - anchorZ) * 0.12;                         // fidelidade à função
    // risco de impedimento (o centroavante de profundidade vive na linha: pune menos)
    if (lx > offLine - 0.4) u -= kind === 'profundidade' ? (tr.includes('cacador') ? 0.6 : 1.2) : (tr.includes('cacador') ? 1.5 : 4);
    if (kind === 'profundidade') u += (lx - blx) * 0.05 * (tr.includes('explosivo') || tr.includes('cacador') ? 1.6 : 1);
    for (const o of t.players) if (o !== p && !o.sentOff) u -= Math.max(0, 5 - Math.hypot(o.target.x - x, o.target.z - z)) * 0.35;
    if (u > bs) { bs = u; best = { x, z }; }
  }
  if (best) { p.utPick = best; p.utKind = kind; p.target.x = lerp(p.target.x, best.x, 0.6); p.target.z = lerp(p.target.z, best.z, 0.6); }
}
