// O relógio do placar em MM:SS (item 32 da FILA; dono, 17/10: "o placar com mais a cara do Total Match, um pouco MAIOR e o
// relógio com os SEGUNDOS além dos minutos"; contrato "Placar (17/10)" no CONTRATOS.md). A conta pura js/relogio-placar.js
// (fora do fecho do hash), sem navegador:
//  R1 consistência: 7 durações (0,25 a 45 min por tempo), todos os ticks do tempo regulamentar dos dois tempos (o m.partida
//     de criarPartida, num mundo sintético): floor(segundoDeJogo/60) === minutoDeJogo em 100% dos ticks; o segundo nunca
//     volta (também na passagem para os acréscimos); com 4 min, 675 ± 1 mudanças em 3600 ticks (11,25 por segundo real)
//  R2 acréscimos: com 1, 4 e 10 minutos anunciados, em todos os ticks até o apito, floor(s/60) − 45·tempo ===
//     acrescimoDeJogo(m).decorrido (as 7 durações, os 2 tempos)
//  R3 texto: "00:00", "34:12", "45:00", "47:13" + "+4", "97:13" + "+10", "100:18", "Intervalo" e "Fim" (formato parado);
//     nenhum texto com "'"; o {minuto} de antes continua aceito
//  R4 partida de verdade (criarPartida 0,5 min por tempo, entradaDemoPartida, 2 sementes, até o fim): "00:00" no tick 0; o
//     segundo não volta dentro de um tempo; o "+N" (N = partida.acrescimo) chega em "45:00" e em "90:00"; "Intervalo"; o 2º
//     tempo abre em "45:00"; "Fim"; o minuto da súmula (sumula.js minutoTM) = o minuto do relógio limitado ao tempo
//     regulamentar (1–45 no 1º, 46–90 no 2º) em TODO tick com a bola em jogo — um gol em qualquer tick leva o minuto que o
//     placar mostrou
//  R5 pureza: o hashMundo de uma partida que chama segundoDeJogo/textoRelogio a cada tick = o de uma que não chama; o
//     módulo não importa nada (nem DOM, nem three) e não está no fecho do hash (tools/fecho-hash.mjs)
// Na base (sem o módulo) REPROVA: o import dentro de try/catch vira REPROVOU, não exceção.
//   node tools/teste-relogio-placar.mjs [--js <pasta js>]   (--js: mede outra cópia da lógica, ex.: a base)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ia = process.argv.indexOf('--js');
const JS = ia > 0 ? path.resolve(process.argv[ia + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js');
const { hashMundo } = await imp('sim.js');
const { minutoTM } = await imp('sumula.js');
let R = null, erroImport = null;
try { R = await imp('relogio-placar.js'); } catch (e) { erroImport = e.code ?? e.message.split('\n')[0]; }

const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const DURACOES = [0.25, 0.5, 1, 4, 6, 10, 45];

if (!R) {
  for (const n of ['R1', 'R2', 'R3', 'R4', 'R5']) meta(`${n} (o módulo js/relogio-placar.js)`, `não existe (${erroImport})`, 'o módulo', false);
} else {
  const { segundoDeJogo, textoRelogio } = R;
  // um mundo sintético com o m.partida de criarPartida (minutoDeJogo, acrescimoDeJogo e segundoDeJogo só leem m.tick e
  // m.partida); o tick0 do tempo fora do zero, para a conta não depender dele
  const sintetico = min => {
    const mp = P.criarPartida({ semente: 1, minutosPorTempo: min });
    return { tick: 0, partida: { ...mp.partida, estado: 'jogo', acrescimo: null } };
  };
  // R1
  {
    let total = 0, erradosMin = 0, voltas = 0, exemplo = '', mud4 = null;
    for (const min of DURACOES) {
      const m = sintetico(min), p = m.partida, T = p.ticksPorTempo;
      for (const tempo of [1, 2]) {
        p.tempo = tempo; p.tick0Tempo = tempo === 1 ? 137 : 137 + T + 911; p.acrescimo = null;
        let ant = -1, mudou = 0;
        // o tempo regulamentar e mais 1/4 dele (a passagem para os acréscimos: o segundo também não volta ali)
        for (let d = 0; d < T + Math.ceil(T / 4); d++) {
          m.tick = p.tick0Tempo + d;
          if (d >= T) p.acrescimo = 4;
          const s = segundoDeJogo(m);
          if (d < T) {
            total++;
            if (Math.floor(s / 60) !== P.minutoDeJogo(m)) { erradosMin++; if (!exemplo) exemplo = `${min} min, ${tempo}º tempo, d = ${d}: ${s} s × minuto ${P.minutoDeJogo(m)}`; }
          }
          if (s < ant) { voltas++; if (!exemplo) exemplo = `${min} min, d = ${d}: ${ant} → ${s}`; }
          if (ant >= 0 && s !== ant && d <= 3600) mudou++;
          ant = s;
        }
        if (min === 4 && tempo === 1) mud4 = mudou;
      }
    }
    meta('R1 consistência: floor(segundo/60) = minutoDeJogo (7 durações × 2 tempos, todos os ticks do tempo regulamentar), nunca volta, ritmo com 4 min',
      `${total - erradosMin}/${total} ticks iguais, ${voltas} voltas${exemplo ? ` (${exemplo})` : ''}; 4 min: ${mud4} mudanças em 3600 ticks (${(mud4 / 60).toFixed(2)} por segundo real)`,
      '100%, 0 voltas, 675 ± 1', erradosMin === 0 && voltas === 0 && Math.abs(mud4 - 675) <= 1);
  }
  // R2
  {
    let n = 0, errados = 0, exemplo = '';
    for (const min of DURACOES) {
      const m = sintetico(min), p = m.partida, T = p.ticksPorTempo;
      for (const tempo of [1, 2]) for (const a of [1, 4, 10]) {
        p.tempo = tempo; p.tick0Tempo = 500; p.acrescimo = a;
        const apito = T + Math.round(a * T / 45);
        for (let d = T; d < apito; d++) {
          m.tick = p.tick0Tempo + d;
          const ac = P.acrescimoDeJogo(m), s = segundoDeJogo(m);
          n++;
          if (!ac || Math.floor(s / 60) - 45 * tempo !== ac.decorrido) { errados++; if (!exemplo) exemplo = `${min} min, +${a}, d = ${d}: ${s} s × decorrido ${ac?.decorrido}`; }
        }
      }
    }
    meta('R2 acréscimos: floor(segundo/60) − 45·tempo = acrescimoDeJogo().decorrido em todos os ticks até o apito (+1, +4, +10; 7 durações; 2 tempos)',
      `${n - errados}/${n} ticks iguais${exemplo ? ` (${exemplo})` : ''}`, '100%', n > 0 && errados === 0);
  }
  // R3
  {
    const casos = [
      [{ segundo: 0, estado: 'jogo', acrescimo: null }, '00:00', '', 'jogo'],
      [{ segundo: 2052, estado: 'jogo', acrescimo: null }, '34:12', '', 'jogo'],
      [{ segundo: 307, estado: 'parada', acrescimo: null }, '05:07', '', 'jogo'],
      [{ segundo: 2700, estado: 'parada', acrescimo: null }, '45:00', '', 'jogo'],
      [{ segundo: 2833, estado: 'jogo', acrescimo: { anunciado: 4, decorrido: 2 } }, '47:13', '+4', 'acrescimo'],
      [{ segundo: 5833, estado: 'gol', acrescimo: { anunciado: 10, decorrido: 7 } }, '97:13', '+10', 'acrescimo'],
      [{ segundo: 6018, estado: 'gol', acrescimo: { anunciado: 10, decorrido: 10 } }, '100:18', '+10', 'acrescimo'],
      [{ segundo: 2700, estado: 'intervalo', acrescimo: null }, 'Intervalo', '', 'parado'],
      [{ segundo: 5400, estado: 'fim', acrescimo: null }, 'Fim', '', 'parado'],
      // o {minuto} de antes (main.js até o item 32, placarDeTeste dos testes antigos)
      [{ minuto: 34, tempo: 1, estado: 'jogo', acrescimo: null }, '34:00', '', 'jogo'],
      [{ minuto: 45, tempo: 1, estado: 'jogo', acrescimo: { anunciado: 4, decorrido: 2 } }, '47:00', '+4', 'acrescimo'],
    ];
    const f = [];
    for (const [r, tx, ex, fo] of casos) {
      const t = textoRelogio(r);
      if (t.texto !== tx || t.extra !== ex || t.formato !== fo) f.push(`${JSON.stringify(r)} → "${t.texto}" "${t.extra}" ${t.formato} (esperado "${tx}" "${ex}" ${fo})`);
      if (/['’]/.test(t.texto + t.extra)) f.push(`"${t.texto}${t.extra}" com apóstrofo`);
    }
    meta('R3 texto do bloco: MM:SS (2 dígitos; 3 além de 99:59), "+N" só nos acréscimos, "Intervalo"/"Fim" parados, sem "\'", o {minuto} de antes aceito',
      f.length ? f.join(' | ') : `${casos.length}/${casos.length} casos`, 'todos', f.length === 0);
  }
  // R4
  {
    const f = [], linhas = [];
    let gols = 0, ticksVistos = 0;
    for (const semente of [3, 8]) {
      const m = P.criarPartida({ semente, minutosPorTempo: 0.5 });
      const ler = () => textoRelogio({ segundo: segundoDeJogo(m), estado: m.partida.estado, acrescimo: P.acrescimoDeJogo(m) });
      const t0 = ler();
      if (t0.texto !== '00:00') f.push(`s${semente}: tick 0 "${t0.texto}"`);
      let ant = { s: 0, tempo: 1, t: t0 }, viuMais = { 1: null, 2: null }, viuIntervalo = false, abre2 = null, fim = null;
      for (let i = 0; i < 20000 && m.partida.estado !== 'fim'; i++) {
        const ev = P.passoPartida(m, P.entradaDemoPartida(m));
        const p = m.partida, s = segundoDeJogo(m), t = ler();
        ticksVistos++;
        if (ev.some(e => e.tipo === 'gol')) gols++;
        if (p.estado !== 'intervalo' && p.estado !== 'fim') {
          if (p.tempo === ant.tempo && s < ant.s) f.push(`s${semente} t${p.tempo} tick ${m.tick}: ${ant.s} → ${s}`);
          // o minuto da súmula de um gol neste tick = o minuto do relógio limitado ao tempo regulamentar
          const mr = Math.floor(s / 60), lim = p.tempo >= 2 ? Math.max(46, Math.min(90, mr)) : Math.max(1, Math.min(45, mr));
          if (minutoTM(m) !== lim) f.push(`s${semente} tick ${m.tick}: súmula ${minutoTM(m)}' × relógio ${t.texto}`);
          if (t.extra && viuMais[p.tempo] === null) {
            viuMais[p.tempo] = `${t.texto} ${t.extra}`;
            const esperado = p.tempo === 1 ? '45:00' : '90:00';
            if (t.texto !== esperado || t.extra !== `+${p.acrescimo}`) f.push(`s${semente}: o "+N" do ${p.tempo}º tempo chegou em "${t.texto} ${t.extra}" (esperado "${esperado} +${p.acrescimo}")`);
            if (ant.t.extra) f.push(`s${semente}: "+N" antes do tempo regulamentar`);
          }
          if (p.tempo === 2 && abre2 === null) abre2 = t.texto;
        } else if (p.estado === 'intervalo') {
          viuIntervalo = true;
          if (t.texto !== 'Intervalo' || t.formato !== 'parado' || t.extra) f.push(`s${semente}: intervalo "${t.texto}" ${t.formato}`);
        }
        if (p.estado === 'fim') fim = t;
        ant = { s, tempo: p.tempo, t };
      }
      if (!viuMais[1] || !viuMais[2]) f.push(`s${semente}: sem o "+N" (${viuMais[1]}, ${viuMais[2]})`);
      if (!viuIntervalo) f.push(`s${semente}: sem "Intervalo"`);
      if (abre2 !== '45:00') f.push(`s${semente}: o 2º tempo abre em "${abre2}"`);
      if (!fim || fim.texto !== 'Fim' || fim.formato !== 'parado') f.push(`s${semente}: fim "${fim?.texto}"`);
      linhas.push(`s${semente}: "${t0.texto}" → ${viuMais[1]} → Intervalo → ${abre2} → ${viuMais[2]} → ${fim?.texto}`);
    }
    meta('R4 partida de verdade (0,5 min por tempo, demo, 2 sementes): 00:00, não volta, "+N" em 45:00/90:00, Intervalo, 2º tempo em 45:00, Fim; o minuto da súmula = o do relógio em todo tick',
      `${f.length ? 'FALHAS: ' + [...new Set(f)].slice(0, 6).join(' | ') + ' — ' : ''}${linhas.join('; ')} (${ticksVistos} ticks, ${gols} gols)`, 'a sequência; 0 diferenças', f.length === 0);
  }
  // R5
  {
    const rodar = chama => {
      const m = P.criarPartida({ semente: 5, minutosPorTempo: 0.25 });
      let acc = 0;
      for (let i = 0; i < 2400; i++) {
        P.passoPartida(m, P.entradaDemoPartida(m));
        if (chama) { const s = segundoDeJogo(m); acc += s + textoRelogio({ segundo: s, estado: m.partida.estado, acrescimo: P.acrescimoDeJogo(m) }).texto.length; }
      }
      return { h: hashMundo(m), acc };
    };
    const a = rodar(false), b = rodar(true);
    const fonte = fs.readFileSync(path.join(JS, 'relogio-placar.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const importa = /\bimport\b/.test(fonte), dom = /\b(document|window|THREE|three)\b/.test(fonte);
    let noFecho = null;
    const fh = path.join(JS, '..', 'tools', 'fecho-hash.mjs');
    if (fs.existsSync(fh)) noFecho = /relogio-placar\.js/.test(execFileSync(process.execPath, [fh], { encoding: 'utf8' }));
    meta('R5 pureza: hashMundo igual chamando o relógio a cada tick; o módulo sem import (nem DOM, nem three) e fora do fecho do hash',
      `hash ${a.h === b.h ? 'IGUAL' : `DIFERENTE (${a.h} × ${b.h})`}; import ${importa ? 'SIM' : 'nenhum'}; DOM/three ${dom ? 'SIM' : 'não'}; no fecho ${noFecho === null ? '(sem a ferramenta)' : noFecho ? 'SIM' : 'não'}`,
      'igual; nenhum; não; não', a.h === b.h && !importa && !dom && noFecho === false);
  }
}

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.every(r => r.ok);
console.log(ok ? '\nteste-relogio-placar: PASSOU' : '\nteste-relogio-placar: REPROVOU');
process.exit(ok ? 0 : 1);
