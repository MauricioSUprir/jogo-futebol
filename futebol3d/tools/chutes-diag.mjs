// Desfecho de cada chute em partidas IA x IA (diagnóstico do equilíbrio, Fase 3):
// gol | defesa (encaixe/rebote) | goleiro tocou e não segurou (gol) | fora | bloqueado.
// Também: distância média, % no alvo, % de defesa do goleiro nos chutes no alvo.
// node tools/chutes-diag.mjs [partidas=6] [minutos por tempo=padrão do jogo]
import { Match } from '../js/match.js';
import { DEFAULT_SETTINGS } from '../js/config.js';
import { TEAMS } from '../js/teams.js';
const N = +(process.argv[2] || 6), HM = +(process.argv[3] || DEFAULT_SETTINGS.halfMinutes);
const GK = {};
const R = { gol: 0, golTocado: 0, defesa: 0, recolheu: 0, fora: 0, trave: 0, bloqueado: 0, desviado: 0, outro: 0 }, dist = [], distGol = [];
// por situação no instante do chute: cara a cara (nenhum defensor entre a bola e o gol) ou não
const SIT = {};
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, halfMinutes: HM, intro: false } });
  m.headless = true;
  let aberto = null;
  const fecha = (r) => { if (!aberto) return; R[r]++; { const c = (SIT[aberto.sit] ||= { n: 0, g: 0 }); c.n++; if (r === 'gol' || r === 'golTocado') c.g++; } if (r === 'outro' && process.env.DEBUG) console.log('outro:', aberto.ev.slice(0, 12).join(','), '| bola', m.ball.p.x.toFixed(1), m.ball.p.y.toFixed(1), m.ball.p.z.toFixed(1), 'dono', m.owner ? (m.owner.isGK ? 'GK' : m.owner.team === aberto.time ? 'atacante' : 'defesa') : '-'); if (r === 'gol' || r === 'golTocado') distGol.push(aberto.d); aberto = null; };
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) {
      if (e.type === 'replay') m.replayFinished();
      if (e.type === 'shot') {
        fecha('outro');
        const p = m.lastShot?.p; const gx = m.goalX(p.team);
        aberto = { t: m.time, d: Math.hypot(gx - m.ball.p.x, m.ball.p.z), gkTocou: false, ev: [], time: p.team };
        {
          // defensores (sem o goleiro) dentro do triângulo bola–traves, mais um respiro de 1 m
          const bx = m.ball.p.x, bz = m.ball.p.z; let def = 0;
          for (const q of p.team.opp.players) {
            if (q.sentOff || q.isGK) continue;
            const u = (q.x - bx) / (gx - bx); if (u <= 0 || u >= 1) continue;
            const half = 3.66 * u + 1 * (1 - u) + 0.6, cz = bz + (0 - bz) * u;
            if (Math.abs(q.z - cz) < half) def++;
          }
          aberto.sit = (def === 0 ? 'cara a cara' : def === 1 ? '1 defensor na frente' : '2+ defensores') + (aberto.d < 16.5 ? ' (área)' : ' (fora)');
        }
        dist.push(aberto.d);
      }
      if (!aberto) continue;
      aberto.ev.push(e.type + (e.kind ? ':' + e.kind : '') + (e.text ? ':' + e.text : ''));
      if (e.type === 'goal') {
        const gk = m.teams.find(t => t !== m.lastShot?.p.team)?.gk;
        const k2 = aberto.gkTocou ? 'tocou e não segurou' : aberto.mergulhou ? 'mergulhou e não alcançou' : 'nem mergulhou';
        GK[k2] = (GK[k2] || 0) + 1;
        fecha(aberto.gkTocou ? 'golTocado' : 'gol');
      }
      else if (e.type === 'save') fecha('defesa');
      else if (e.type === 'catch') fecha('recolheu');
      else if (e.type === 'bar' || e.type === 'post') fecha('trave');
      else if (e.type === 'block') fecha('bloqueado');
      else if (e.type === 'touch' && m.lastTouch?.isGK) aberto.gkTocou = true;
      else if (e.type === 'touch' && m.lastTouch && m.lastTouch.team !== aberto.time) fecha('desviado');
      else if (e.type === 'banner' && /TIRO DE META|ESCANTEIO|LATERAL/.test(e.text || '')) fecha('fora');
    }
    m.events.length = 0;
    if (aberto) { const gk = m.teams.find(t => t !== aberto.time)?.gk; if (gk?.action?.type === 'gk_dive') aberto.mergulhou = true; }
    if (aberto && m.time - aberto.t > 4) fecha('outro');
  }
}
const tot = Object.values(R).reduce((a, b) => a + b, 0), noAlvo = R.gol + R.golTocado + R.defesa + R.recolheu;
console.log(`chutes/partida ${(tot / N).toFixed(1)} | distância média ${(dist.reduce((a, b) => a + b, 0) / dist.length).toFixed(1)} m (gols: ${(distGol.reduce((a, b) => a + b, 0) / Math.max(1, distGol.length)).toFixed(1)} m)`);
console.log(Object.entries(R).map(([k, v]) => `${k} ${(v / N).toFixed(1)}`).join(' | '));
console.log('gols:', JSON.stringify(GK));
const faixa = (a, b) => (dist.filter(d => d >= a && d < b).length / dist.length * 100).toFixed(0) + '%';
const faixaG = (a, b) => distGol.filter(d => d >= a && d < b).length;
console.log(`distância dos chutes: <6 m ${faixa(0, 6)} | 6–11 ${faixa(6, 11)} | 11–16,5 ${faixa(11, 16.5)} | 16,5–25 ${faixa(16.5, 25)} | >25 ${faixa(25, 99)}  — gols: ${faixaG(0, 6)}/${faixaG(6, 11)}/${faixaG(11, 16.5)}/${faixaG(16.5, 25)}/${faixaG(25, 99)}`);
console.log(`no alvo ${(noAlvo / tot * 100).toFixed(0)}% | goleiro defende ${((R.defesa + R.recolheu) / Math.max(1, noAlvo) * 100).toFixed(0)}% dos chutes no alvo | conversão ${((R.gol + R.golTocado) / tot * 100).toFixed(1)}%`);
console.log('por situação (chutes/partida, conversão):', Object.entries(SIT).sort().map(([k, v]) => `${k}: ${(v.n / N).toFixed(1)}, ${(v.g / v.n * 100).toFixed(0)}%`).join(' | '));
