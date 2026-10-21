// Roteiro do pré-jogo (js/prejogo-roteiro.js, puro) e os trilhos de câmera contra os sólidos do estádio
// (js/estadio-forma.js). Pedido do dono de 11/10 (cenas de fora, o estádio, a entrada, a fila com a câmera passando,
// cortes de torcida e as duas escalações de ~10 s, uma depois da outra, com o mesmo fundo). Metas
// (PESQUISA-PREJOGO.md §1 e §4):
//   1) 'completo': ≥ 11 planos na ordem fora → dentro → túnel → entrada → fila (2 trilhos) → ≥ 4 cortes de torcida e
//      estádio → escalação do mandante → escalação do visitante; cenas de 50–65 s; cada plano ≥ 2 s;
//   2) cada escalação inteira na tela por 10 ± 0,1 s; a 2ª entra enquanto a 1ª sai (o mesmo tempo); o MESMO fundo: a
//      órbita da câmera não salta de uma para a outra (< 1 cm);
//   3) 'curto' ~40 s e 'escalacao' só as duas (~21 s);
//   4) pular: próximo BLOCO (cenas → escalação 0 → escalação 1 → fim) de qualquer instante;
//   5) trilhos: 50 pontos de cada plano (e da abertura) FORA dos sólidos (arquibancadas, paredes, coberturas,
//      fachada, placas, gols, bancos, refletores, prédios, árvores) com 0,5 m de folga — o túnel só por dentro do
//      corredor; câmera inclinada entre −60° e +20°, fov 20–60°, sem tranco (velocidade ≤ 8 m/s dentro do estádio e
//      ≤ 45 m/s no drone);
//   6) a fila com a câmera passando: cada um dos 11 titulares do time passa pelo terço central do quadro (16:9) e a
//      câmera anda ≥ 8 m.
// Na versão publicada não há pré-jogo (reprova no import).
// --forma <chave>: o estádio com forma própria da base (assets/tm/estadios.json, ex.: maracana; estadio-planta.js): os
// trilhos ajustados por ele (ajustarPlano/ajustarAbertura) contra os sólidos DELE (estadio-forma.js definirForma).
//   node tools/teste-prejogo-roteiro.mjs [--js <pasta js>] [--forma maracana]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let R = null, F = null;
try { R = await imp('prejogo-roteiro.js'); F = await imp('estadio-forma.js'); } catch (e) { R = null; }
if (!R) {
  reg('roteiro do pré-jogo (js/prejogo-roteiro.js)', 'não existe (a partida abre direto na saída de bola)', 'existe', false);
} else {
  const { criarRoteiro, planoEm, blocoEm, proximoBloco, cameraEm, cameraAbertura, escalacaoEm, pontosDoPlano, PREJOGO } = R;
  const { solidoEm, noCorredorDoTunel } = F;
  // estádio com forma própria (--forma): a planta liga os sólidos e ajusta os planos e a abertura
  let ajuste = null, ajAbertura = c => c;
  if (args.includes('--forma')) {
    const fs = await import('node:fs');
    const chave = args[args.indexOf('--forma') + 1];
    const base = JSON.parse(fs.readFileSync(path.join(pastaJs, '../assets/tm/estadios.json'), 'utf8'));
    const PL = await imp('estadio-planta.js');
    const planta = PL.criarPlanta(PL.validarForma(base.estadios[chave]?.forma));
    F.definirForma(planta);
    ajuste = planta.ajustarPlano; ajAbertura = c => planta.ajustarAbertura(c);
    linhas.push([`forma: ${chave}`, planta ? planta.familia : 'não achada', '', '']);
  }
  const criarRoteiroF = criarRoteiro;
  const r = criarRoteiroF('completo', ajuste);
  const cenas = r.planos.filter(p => p.bloco === 'cenas');
  const ordem = r.planos.map(p => p.id);
  // 1) ordem e durações
  const pos = id => ordem.indexOf(id);
  const cortes = ['organizada', 'ladoDeLa', 'visitantes', 'geral'];
  const ordemOk = pos('aereo') === 0 && pos('fachada') === 1 && pos('dentro') > pos('fachada') && pos('tunel') > pos('dentro')
    && pos('entrada') > pos('tunel') && pos('filaMandante') > pos('entrada') && pos('filaVisitante') === pos('filaMandante') + 1
    && cortes.every(c => pos(c) > pos('filaVisitante') && pos(c) < pos('escalacao0')) && pos('escalacao1') === ordem.length - 1 && pos('escalacao0') === ordem.length - 2;
  reg('Completo: planos na ordem fora → dentro → túnel → entrada → fila → cortes → escalações', `${r.planos.length} planos: ${ordem.join(' → ')}`, '≥ 11; essa ordem', r.planos.length >= 11 && ordemOk);
  reg('Completo: cenas de 50–65 s e total', `cenas ${fmt(r.fimCenas, 1)} s; total ${fmt(r.total, 1)} s`, '50–65 s', r.fimCenas >= 50 && r.fimCenas <= 65);
  const curtos = r.planos.filter(p => p.dur < 2).map(p => p.id);
  reg('Cada plano ≥ 2 s', `menor ${fmt(Math.min(...r.planos.map(p => p.dur)), 1)} s${curtos.length ? ' (' + curtos.join(', ') + ')' : ''}`, '≥ 2 s', curtos.length === 0);

  // 2) escalações: quanto tempo cada uma fica INTEIRA na tela (passo de 10 ms)
  const cheia = { 0: 0, 1: 0 }, juntas = { 0: 0, 1: 0 };
  const e = {};
  for (let t = 0; t < r.total + 1; t += 0.01) {
    escalacaoEm(r, t, e);
    if (e.cheia === 0 || e.cheia === 1) cheia[e.cheia] += 0.01;
    if (e.saiTime === 0 && e.time === 1) { juntas[0] += 0.01; }
  }
  reg('Escalação do mandante inteira na tela', `${fmt(cheia[0], 2)} s`, '10 ± 0,1 s', Math.abs(cheia[0] - 10) <= 0.1);
  reg('Escalação do visitante inteira na tela', `${fmt(cheia[1], 2)} s`, '10 ± 0,1 s', Math.abs(cheia[1] - 10) <= 0.1);
  reg('A 2ª entra enquanto a 1ª sai', `${fmt(juntas[0], 2)} s juntas (entrada de ${PREJOGO.escalacao.entra} s)`, `${PREJOGO.escalacao.entra} ± 0,02 s`, Math.abs(juntas[0] - PREJOGO.escalacao.entra) <= 0.02);
  const p0 = r.planos[pos('escalacao0')], p1 = r.planos[pos('escalacao1')];
  const a = cameraEm(r, p0.t1 - 1e-6, {}), b = cameraEm(r, p1.t0, {});
  const salto = Math.hypot(a.px - b.px, a.py - b.py, a.pz - b.pz);
  reg('Escalações com o MESMO fundo (órbita contínua de uma para a outra)', `salto ${fmt(salto * 100, 2)} cm; fundo da 1ª ${p0.orbita ? 'órbita' : 'trilho'}, da 2ª ${p1.orbita ? 'órbita' : 'trilho'}`, '< 1 cm; órbita nas duas', salto < 0.01 && p0.orbita && p0.orbita === p1.orbita);

  // 3) curto e só escalação
  const rc = criarRoteiroF('curto', ajuste), re = criarRoteiroF('escalacao', ajuste);
  reg('Curto: ~40 s (as escalações inteiras)', `${fmt(rc.total, 1)} s (${rc.planos.length} planos: ${rc.planos.map(p => p.id).join(', ')})`, '35–45 s', rc.total >= 35 && rc.total <= 45 && rc.planos.some(p => p.id === 'escalacao1'));
  reg('Só escalação: as duas (~21 s)', `${fmt(re.total, 2)} s (${re.planos.map(p => p.id).join(', ')})`, '20–22 s; 2 planos', re.total >= 20 && re.total <= 22 && re.planos.length === 2);

  // 4) pular: próximo bloco
  let pulaOk = true; const exemplos = [];
  for (const rr of [r, rc, re]) {
    for (let t = 0; t < rr.total; t += 0.37) {
      const b0 = blocoEm(rr, t), tn = proximoBloco(rr, t);
      const esperado = b0 === 'cenas' ? (rr.blocos.find(x => x.nome === 'escalacao0').t0) : b0 === 'escalacao0' ? rr.blocos.find(x => x.nome === 'escalacao1').t0 : rr.total;
      if (Math.abs(tn - esperado) > 1e-9) { pulaOk = false; exemplos.push(`${rr.modo} ${fmt(t, 2)} s: ${fmt(tn, 2)} ≠ ${fmt(esperado, 2)}`); }
    }
  }
  reg('Pular: próximo bloco (cenas → escalação 0 → escalação 1 → jogo)', pulaOk ? 'certo em todos os instantes (3 modos)' : exemplos.slice(0, 3).join('; '), 'sim', pulaOk);

  // 5) trilhos contra os sólidos
  const FOLGA = 0.5;
  const bloqueios = [], tranco = [], incl = [], tunelFora = [];
  let pontos = 0;
  for (const rr of [r, rc, re]) {
    rr.planos.forEach((p, i) => {
      const L = pontosDoPlano(rr, i, 50);
      L.forEach((q, k) => {
        pontos++;
        const s = solidoEm(q.p[0], q.p[1], q.p[2], FOLGA, true);
        if (s) bloqueios.push(`${rr.modo}/${p.id} #${k} em (${q.p.map(v => fmt(v, 1)).join(', ')}): ${s}`);
        const dx = q.l[0] - q.p[0], dy = q.l[1] - q.p[1], dz = q.l[2] - q.p[2];
        const pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
        if (pitch < -60 || pitch > 20 || q.fov < 20 || q.fov > 60) incl.push(`${p.id}: ${fmt(pitch, 0)}°/${fmt(q.fov, 0)}`);
        if (p.id === 'tunel' && !noCorredorDoTunel(q.p[0], q.p[1], q.p[2])) tunelFora.push(k);
        if (k > 0) {
          const dt = p.dur / 49;
          const v = Math.hypot(q.p[0] - L[k - 1].p[0], q.p[1] - L[k - 1].p[1], q.p[2] - L[k - 1].p[2]) / dt;
          if (v > (p.fora ? 45 : 8)) tranco.push(`${p.id} ${fmt(v, 1)} m/s`);
        }
      });
    });
  }
  // abertura (órbita pelo tempo real: 2 min)
  for (let t = 0; t < 120; t += 2.4) {
    const c = ajAbertura(cameraAbertura(t, {}));
    pontos++;
    const s = solidoEm(c.px, c.py, c.pz, FOLGA, true);
    if (s) bloqueios.push(`abertura ${fmt(t, 1)} s: ${s}`);
  }
  reg('Trilhos fora dos sólidos (0,5 m de folga; 3 modos + abertura)', bloqueios.length ? `${bloqueios.length} de ${pontos}: ${bloqueios.slice(0, 3).join(' | ')}` : `0 de ${pontos} pontos`, '0', bloqueios.length === 0);
  reg('Túnel: a câmera só por dentro do corredor', tunelFora.length ? `${tunelFora.length} pontos fora` : 'os 50 pontos no corredor', 'todos', tunelFora.length === 0);
  reg('Câmera inclinada −60…+20°, fov 20–60°', incl.length ? incl.slice(0, 4).join('; ') : 'todos', 'todos', incl.length === 0);
  reg('Sem tranco no trilho (≤ 8 m/s dentro, ≤ 45 m/s no drone)', tranco.length ? tranco.slice(0, 4).join('; ') : 'todos', 'todos', tranco.length === 0);

  // 6) a fila com a câmera passando: cada titular no terço central do quadro (16:9) em algum quadro
  const { criarCortejo, filaFinal } = await imp('cortejo.js');
  const { criarPartida } = await imp('partida.js');
  const m = criarPartida({ semente: 3 });
  const c = criarCortejo(m.times);
  filaFinal(c);
  for (const id of ['filaMandante', 'filaVisitante']) {
    const i = pos(id), p = r.planos[i];
    const L = pontosDoPlano(r, i, 240);
    const vistos = new Set();
    for (const q of L) {
      const fx = q.l[0] - q.p[0], fz = q.l[2] - q.p[2], fl = Math.hypot(fx, fz);
      const tanH = Math.tan((q.fov * Math.PI) / 360) * 16 / 9;
      for (const a of c.andantes) {
        if (a.time !== p.time) continue;
        const dx = a.j.x - q.p[0], dz = a.j.z - q.p[2];
        const frente = (dx * fx + dz * fz) / fl, lado = (dx * -fz + dz * fx) / fl;
        if (frente > 0 && Math.abs(lado / frente) < tanH / 3) vistos.add(a.id);
      }
    }
    const anda = Math.hypot(L[L.length - 1].p[0] - L[0].p[0], L[L.length - 1].p[2] - L[0].p[2]);
    reg(`${p.nome}: cada um dos 11 no terço central`, `${vistos.size}/11; a câmera anda ${fmt(anda, 1)} m`, '11/11; ≥ 8 m', vistos.size === 11 && anda >= 8);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-prejogo-roteiro: REPROVOU (${falhas})` : '\nteste-prejogo-roteiro: PASSOU');
process.exit(falhas ? 1 : 0);
