// Condução sem ímã (auditoria, Fase 2 item 5): entre os toques a bola é física pura. Em
// partidas IA x IA, a cada passo com um dono conduzindo (sem ação, bola rolando, nenhum
// toque/disputa no passo), compara a velocidade da bola depois do passo com a de uma bola
// LIVRE rolando a partir do mesmo estado (mesmo modelo de ball.js). Qualquer força extra é ímã.
// Também mede a distância bola-jogador na condução (alvo ~0,5 m; até ~1,2 m só em arrancada).
// Reprova (saída 1) se houver ímã em > 0,5% dos passos ou distâncias fora do alvo.
// Mede DUAS partidas (times diferentes): com uma só, o p95 da arrancada oscilava ±0,03 m entre
// execuções (amostras do mesmo lance seguidas).
// node tools/ima-test.mjs [segundos por partida=240]
import { Match } from '../js/match.js';
import { Ball } from '../js/ball.js';
import { DEFAULT_SETTINGS, BALL } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const secs = +(process.argv[2] || 240);
const livre = new Ball();
let passos = 0, ima = 0, pior = 0;
const dist = { corrida: [], arrancada: [] };
for (const [h, a] of [[0, 1], [2, 3]]) {
const m = new Match({ home: TEAMS[h], away: TEAMS[a], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: 6, intro: false } });
m.headless = true;
let tocou = false;
const orig = m.touch.bind(m);
m.touch = (p, how) => { tocou = true; return orig(p, how); };
for (let i = 0; i < 60 * secs; i++) {
  const o = m.owner, b = m.ball;
  const ok = o && !o.action && m.phase === 'play' && !b.held && b.rolling && b.p.y <= BALL.radius + 0.01 && !b.inNet;
  if (ok) livre.copyFrom(b);
  tocou = false;
  m.step(1 / 60, null);
  for (const e of m.events) if (e.type === 'replay') m.replayFinished();
  m.events.length = 0;
  if (!ok || tocou || m.owner !== o || o.action) continue;
  livre.step(1 / 120); livre.step(1 / 120);
  const dv = Math.hypot(b.v.x - livre.v.x, b.v.z - livre.v.z);
  passos++; if (dv > 0.02) ima++; pior = Math.max(pior, dv);
  if (m.time - (o.gotBall || 0) > 0.7 && o.speed > 4) {
    const ah = (b.p.x - o.x) * o.fx + (b.p.z - o.z) * o.fz;
    (o.speed > 6.5 ? dist.arrancada : dist.corrida).push(ah);
  }
}
}
const med = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] ?? 0;
const fr = ima / Math.max(1, passos);
const okIma = passos > 500 && fr <= 0.005;
const okC = dist.corrida.length > 100 && med(dist.corrida) >= 0.35 && med(dist.corrida) <= 0.65 && p95(dist.corrida) <= 1.0;
const okA = dist.arrancada.length > 50 && p95(dist.arrancada) <= 1.25;   // pedido: "até ~1,2 m" (1,2 com uma casa)
console.log(`${okIma ? 'PASSOU' : 'FALHOU'} | ímã entre toques: ${(fr * 100).toFixed(1)}% de ${passos} passos (pior desvio ${pior.toFixed(2)} m/s; alvo ≤ 0,5%)`);
console.log(`${okC ? 'PASSOU' : 'FALHOU'} | condução correndo (4–6,5 m/s): bola ${med(dist.corrida).toFixed(2)} m à frente em média (p95 ${p95(dist.corrida).toFixed(2)}; alvo ~0,5, p95 ≤ 1,0)`);
console.log(`${okA ? 'PASSOU' : 'FALHOU'} | arrancada (>6,5 m/s): média ${med(dist.arrancada).toFixed(2)} m, p95 ${p95(dist.arrancada).toFixed(2)} m (alvo p95 ≤ ~1,2 m, até 1,25)`);
process.exit(okIma && okC && okA ? 0 : 1);
