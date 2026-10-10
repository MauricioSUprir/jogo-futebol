// teste-editor (Etapa 3, Parte 1): "Editar time" em Node — tela §10.1, E1–E11. Elenco e notas,
// formações, encaixe húngaro, regra dos dois toques, validação da edição (7 recusas), a edição
// como ENTRADA do passo (vaga nova, substituição na parada no mesmo índice, goleiro só troca na
// parada), determinismo com a edição e o treino bit a bit igual à base.
//
// Metas (tela §10.1):
//  E1  23 por time; ids únicos, ≠ 0 e ≠ 90; números 1–23; camisa ≤ 10 caracteres e única no time;
//      ≥ 3 goleiros; nas 6 formações o melhor 11 do elenco inteiro tem 0 fora de posição.
//  E2  nota natural = nível ± 1 nos 46; ZAG jogando de ATA ≤ nível − 12; GOL na linha ≤ 50; notas
//      fixadas (lista abaixo: qualquer mudança no gerador aparece aqui).
//  E3  formações: 11 vagas, 1 GOL, ids únicos; linhas em ordem; dentro da fila, ordem por z = ordem
//      por col; nenhum par a < 1 fila e < 1 col; espelhada (LD↔LE …). Linhas em ordem = a média do x
//      de cada grupo (gol < def < mei < ata) cresce, sem e com a bola — a regra "o maior x de uma
//      fila < o menor da seguinte" da tela não vale com as posições da pesquisa (§1.3, Metrica: os
//      alas do 3-5-2 ficam a −18 sem a bola, atrás dos volantes; com a bola os pontas passam dos
//      meias), então ela vale pelo grupo (decisão da Parte 1, desvio 3 da Parte 0).
//  E4  encaixe dos titulares do Golaço: 4-3-3 → 4-2-3-1 com 0 fora; 4-3-3 → 3-5-2 com exatamente 2
//      fora; o goleiro no GOL; o mesmo resultado em 2 execuções.
//  E5  tocar: todos os casos da tabela 4.1 (com recusas e cancelar), rascunho e evento esperados.
//  E6  validarEdicao: as 7 recusas da tela §8.3 e as edições boas aceitas.
//  E7  troca PD↔PE: no tick seguinte j(11).vagaId = 'PD' e posicao 'PON'; em 3–8 s o z médio do 11
//      (lado de quem ataca) > +8 (sem a edição, < −8). Depende da IA tática ler a vaga: enquanto o
//      ia-tatica.js for o esqueleto da Parte 0, sai AGUARDANDO IA (não conta como reprovação nem
//      como PASSOU).
//  E8  substituição: pendente até a parada; na parada o 22 ocupa o índice que era do 9, o 9 vai para
//      `saiu`, subs 1/5 e 1/3, evento `substituicao`, o controlado segue o novo; trazer o 9 de volta
//      é recusado.
//  E9  troca que mexe no GOL: o goleiro não sai do gol antes da parada (a < 8 m da linha); na parada
//      a troca vale.
//  E10 determinismo: mesma semente + roteiro + edição no passo 300 = mesmo hash; sem a edição ou com
//      ela no passo 301 o hash é outro; só a tática diferente já muda o hash.
//  E11 sem recuo: hashes do treino iguais aos da base 980b0b0 (gravados abaixo, as mesmas cenas do
//      tools/hash-igual.mjs) e o treino sem m.times. (A prova completa é o hash-igual.)
//
//   node tools/teste-editor.mjs [--antes] [--js <pasta>] [--base N]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const ANTES = args.includes('--antes');
const BASE = +arg('--base', 1);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const existe = f => fs.existsSync(path.join(JS, f));
const PASSO = 1 / 60;

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok, aguardando = false) => {
  linhas.push([nome, medido, meta, aguardando ? 'AGUARDANDO IA' : ok ? 'PASSOU' : 'REPROVOU']);
  if (!ok && !aguardando) falhas++;
};
const fmt = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-editor: REPROVOU (${falhas})${ANTES ? ' [--antes]' : ''}` : `\nteste-editor: PASSOU${ANTES ? ' [--antes]' : ''}`);
  process.exit(falhas ? 1 : 0);
}

console.log(`teste-editor: lógica ${JS}${ANTES ? ' (IA clássica: --antes)' : ''}`);
const faltam = ['elenco.js', 'formacoes.js', 'escalacao.js', 'partida.js'].filter(f => !existe(f));
if (faltam.length) {
  reg('E1–E10: módulos do Editar time', `não existem: ${faltam.join(', ')}`, 'elenco, formações, escalação, partida', false);
  fim();
}
const E = await imp('elenco.js');
const F = await imp('formacoes.js');
const X = await imp('escalacao.js');
const P = await imp('partida.js');
const S = await imp('sessao.js');
const SIM = await imp('sim.js');
const B = await imp('bola.js');
const ACO = await imp('acoes.js');

// ------------------------------------------------------------------------------------- E1
{
  const times = Object.values(E.ELENCOS);
  const ids = times.flatMap(t => t.jogadores.map(j => j.id));
  const prob = [];
  for (const t of times) {
    const js = t.jogadores;
    if (js.length !== 23) prob.push(`${t.id}: ${js.length} jogadores`);
    const nums = js.map(j => j.num);
    if (new Set(nums).size !== 23 || nums.some(n => n < 1 || n > 23)) prob.push(`${t.id}: números`);
    const cam = js.map(j => j.camisa);
    if (cam.some(c => !c || c.length > 10)) prob.push(`${t.id}: camisa > 10`);
    if (new Set(cam).size !== cam.length) prob.push(`${t.id}: camisa repetida`);
    if (js.filter(j => j.pos === 'GOL').length < 3) prob.push(`${t.id}: < 3 goleiros`);
    for (const fid of F.ORDEM_FORMACOES) {
      const o = F.melhorOnze(t.id, fid);
      const vs = F.FORMACOES[fid].vagas;
      const fora = vs.filter(v => o[v.id] == null || E.encaixeNaVaga(E.fichaDe(o[v.id]), v.pos) === 'fora');
      if (fora.length) prob.push(`${t.id} ${fid}: ${fora.length} fora`);
    }
  }
  if (new Set(ids).size !== ids.length) prob.push('ids repetidos');
  if (ids.includes(0) || ids.includes(90)) prob.push('id 0 ou 90');
  reg('E1 elenco: 23 por time, ids, números, camisas, goleiros, melhor 11 sem fora (6 formações)', prob.length ? prob.slice(0, 4).join('; ') : `${times.length} times × 23, ok`, 'tudo certo', prob.length === 0);
}

// ------------------------------------------------------------------------------------- E2
{
  const FIXAS = '1:78 2:75 3:76 4:77 5:76 6:74 7:78 8:77 9:79 10:80 11:77 12:72 13:69 14:71 15:67 16:68 17:70 18:70 19:70 20:70 21:69 22:71 23:66 101:76 102:72 103:75 104:74 105:75 106:73 107:76 108:76 109:78 110:78 111:75 112:71 113:67 114:70 115:67 116:67 117:69 118:70 119:68 120:69 121:68 122:70 123:65';
  const SOMA = 42350; // soma das notas dos 46 nas 15 posições
  let natMax = 0, zagAta = -99, golLinha = 0, soma = 0;
  const obs = [];
  for (const t of Object.values(E.ELENCOS)) for (const j of t.jogadores) {
    const a = E.atributosDe(j);
    const n = E.notaNaPosicao(a, j.pos);
    natMax = Math.max(natMax, Math.abs(n - j.nivel));
    obs.push(`${j.id}:${n}`);
    for (const p of Object.keys(E.PESOS)) soma += E.notaNaPosicao(a, p);
    if (j.pos === 'ZAG') zagAta = Math.max(zagAta, E.notaNaPosicao(a, 'ATA') - j.nivel);
    if (j.pos === 'GOL') for (const p of Object.keys(E.PESOS)) if (p !== 'GOL') golLinha = Math.max(golLinha, E.notaNaPosicao(a, p));
  }
  reg('E2 nota natural = nível ± 1 (46 jogadores)', `maior diferença ${natMax}`, '≤ 1', natMax <= 1);
  reg('E2 ZAG jogando de ATA', `até nível ${zagAta}`, '≤ nível − 12', zagAta <= -12);
  reg('E2 GOL jogando na linha', `até ${golLinha}`, '≤ 50', golLinha <= 50);
  const iguais = obs.join(' ') === FIXAS && soma === SOMA;
  reg('E2 notas fixadas (natural dos 46 e soma das 15 posições)', iguais ? `iguais (soma ${soma})` : `mudaram (soma ${soma} × ${SOMA})`, 'iguais à lista', iguais);
}

// ------------------------------------------------------------------------------------- E3
{
  const ESP = { LD: 'LE', LE: 'LD', ADD: 'ADE', ADE: 'ADD', MD: 'ME', ME: 'MD', PD: 'PE', PE: 'PD' };
  const prob = [];
  for (const fid of F.ORDEM_FORMACOES) {
    const vs = F.FORMACOES[fid].vagas;
    if (vs.length !== 11 || vs.filter(v => v.pos === 'GOL').length !== 1 || new Set(vs.map(v => v.id)).size !== 11) prob.push(`${fid}: regra 1`);
    for (const fase of ['sem', 'com']) {
      const med = ['gol', 'def', 'mei', 'ata'].map(g => vs.filter(v => v.grupo === g)).filter(a => a.length).map(a => a.reduce((s, v) => s + v[fase].x, 0) / a.length);
      for (let k = 0; k + 1 < med.length; k++) if (med[k] >= med[k + 1]) prob.push(`${fid} ${fase}: regra 2`);
      for (const fl of new Set(vs.map(v => v.fila))) {
        const a = vs.filter(v => v.fila === fl);
        const pz = [...a].sort((p, q) => p[fase].z - q[fase].z).map(v => v.id).join();
        const pc = [...a].sort((p, q) => p.col - q.col).map(v => v.id).join();
        if (pz !== pc) prob.push(`${fid} ${fase} fila ${fl}: regra 3`);
      }
    }
    for (let i = 0; i < 11; i++) for (let k = i + 1; k < 11; k++) if (Math.abs(vs[i].fila - vs[k].fila) < 1 && Math.abs(vs[i].col - vs[k].col) < 1) prob.push(`${fid}: regra 4 (${vs[i].id}, ${vs[k].id})`);
    for (const v of vs) {
      const e = vs.find(o => o.col === -v.col && o.fila === v.fila && o.sem.z === -v.sem.z && o.com.z === -v.com.z && o.sem.x === v.sem.x && o.com.x === v.com.x);
      if (!e || (ESP[v.pos] ?? v.pos) !== e.pos) prob.push(`${fid}: regra 5 (${v.id})`);
    }
  }
  reg('E3 formações: as 5 regras nas 6 formações', prob.length ? prob.slice(0, 4).join('; ') : '6 formações ok', '0 problemas', prob.length === 0);
}

// ------------------------------------------------------------------------------------- E4
{
  const g = E.ELENCOS.golaco;
  const tit = Object.values(g.titularesPadrao);
  const fora = v => F.FORMACOES[v.f].vagas.filter(x => E.encaixeNaVaga(E.fichaDe(v.o[x.id]), x.pos) === 'fora').map(x => `${E.fichaDe(v.o[x.id]).camisa}@${x.id}`);
  const a = { f: '4-2-3-1', o: F.encaixar(tit, '4-2-3-1', 'golaco', g.titularesPadrao) };
  const b = { f: '3-5-2', o: F.encaixar(tit, '3-5-2', 'golaco', g.titularesPadrao) };
  const b2 = F.encaixar(tit, '3-5-2', 'golaco', g.titularesPadrao);
  const fa = fora(a), fb = fora(b);
  const ok = fa.length === 0 && fb.length === 2 && a.o.GOL === g.titularesPadrao.GOL && b.o.GOL === g.titularesPadrao.GOL && JSON.stringify(b.o) === JSON.stringify(b2);
  reg('E4 encaixe: 4-3-3 → 4-2-3-1 e → 3-5-2 (Golaço)', `${fa.length} fora; ${fb.length} fora (${fb.join(', ')}); goleiro no GOL; repetível`, '0; 2; sim; sim', ok);
}

// ------------------------------------------------------------------------------------- E5
{
  const prob = [];
  const espera = (cond, txt) => { if (!cond) prob.push(txt); };
  const t0 = X.estadoInicialTime('golaco');
  let r = X.rascunhoDe(t0);
  let o = X.tocar(r, 7);
  espera(o.evento?.tipo === 'escolheu' && o.rasc.escolhido === 7, 'escolher');
  o = X.tocar(o.rasc, 7);
  espera(o.evento?.tipo === 'desmarcou' && o.rasc.escolhido === null, 'desmarcar');
  // titular ↔ titular
  o = X.tocar(X.tocar(r, 7).rasc, 11);
  espera(o.evento?.tipo === 'trocou' && o.rasc.vagas.PD === 11 && o.rasc.vagas.PE === 7 && o.rasc.escolhido === null && !o.evento.gol, 'titular ↔ titular');
  const trocado = o.rasc;
  espera(JSON.stringify(X.desfazer(trocado).vagas) === JSON.stringify(r.vagas), 'desfazer');
  o = X.tocar(X.tocar(r, 1).rasc, 5);
  espera(o.evento?.tipo === 'trocou' && o.evento.gol === true && o.rasc.vagas.GOL === 5, 'troca com o GOL (pendente no mundo)');
  // titular → reserva e reserva → titular
  o = X.tocar(X.tocar(r, 9).rasc, 22);
  espera(o.evento?.tipo === 'substituiu' && o.rasc.vagas.ATA === 22 && o.rasc.substituicoes.length === 1 && o.rasc.substituicoes[0].sai === 9 && o.rasc.substituicoes[0].entra === 22, 'titular → reserva');
  const sub = o.rasc;
  o = X.tocar(X.tocar(r, 18).rasc, 8);
  espera(o.evento?.tipo === 'substituiu' && o.rasc.vagas.MCD === 18 && o.rasc.substituicoes[0].sai === 8, 'reserva → titular');
  // reserva → reserva: o 2º é o escolhido
  o = X.tocar(X.tocar(r, 18).rasc, 19);
  espera(o.evento?.tipo === 'escolheu' && o.rasc.escolhido === 19, 'reserva → reserva');
  // quem entra / quem sai: painel do par, sem escolher
  o = X.tocar(sub, 22);
  espera(o.evento?.tipo === 'pendente' && o.evento.a === 9 && o.evento.b === 22 && o.rasc.escolhido === null, 'toque em quem entra');
  o = X.tocar(sub, 9);
  espera(o.evento?.tipo === 'pendente' && o.evento.a === 9 && o.rasc.escolhido === null, 'toque em quem sai');
  // reserva no lugar de quem entraria: o par muda, a contagem não
  o = X.tocar(X.tocar(sub, 19).rasc, 22);
  espera(o.evento?.tipo === 'substituiu' && o.rasc.vagas.ATA === 19 && o.rasc.substituicoes.length === 1 && o.rasc.substituicoes[0].sai === 9 && o.rasc.substituicoes[0].entra === 19 && X.situacao(o.rasc, 22).tipo === 'reserva', 'troca o reserva do par');
  // cancelar
  const canc = X.cancelarSubstituicao(sub, 22);
  espera(canc.vagas.ATA === 9 && canc.substituicoes.length === 0, 'cancelar substituição');
  // recusas: limite, paradas, substituído
  r = X.rascunhoDe({ ...t0, subs: { feitas: 5, paradas: 2 } });
  o = X.tocar(X.tocar(r, 9).rasc, 22);
  espera(o.evento?.tipo === 'recusou' && o.evento.motivo === 'limite' && o.rasc.vagas.ATA === 9, 'recusa: limite de 5');
  r = X.rascunhoDe({ ...t0, subs: { feitas: 2, paradas: 3 } });
  o = X.tocar(X.tocar(r, 9).rasc, 22);
  espera(o.evento?.tipo === 'recusou' && o.evento.motivo === 'paradas', 'recusa: 3 paradas');
  r = X.rascunhoDe({ ...t0, saiu: [13] });
  o = X.tocar(r, 13);
  espera(o.evento?.tipo === 'recusou' && o.evento.motivo === 'saiu' && o.rasc.escolhido === null, 'recusa: substituído');
  // pendente da 5ª: com 4 feitas e 1 no rascunho, a 6ª é recusada
  r = X.rascunhoDe({ ...t0, subs: { feitas: 4, paradas: 1 } });
  o = X.tocar(X.tocar(r, 9).rasc, 22);
  o = X.tocar(X.tocar(o.rasc, 8).rasc, 18);
  espera(o.evento?.tipo === 'recusou' && o.evento.motivo === 'limite', 'recusa: feitas + pendentes');
  // fora do elenco, desfazer tudo e a edição
  espera(X.tocar(X.rascunhoDe(t0), 105).evento === null, 'id de outro elenco');
  const r0 = X.rascunhoDe(t0);
  espera(X.edicaoDe(r0) === null && X.edicaoDe(X.desfazerTudo(trocado)) === null, 'sem mudança: sem edição');
  const ed = X.edicaoDe(trocado);
  espera(ed && ed.tipo === 'editarTime' && ed.base === t0.versao && ed.vagas.PD === 11 && Object.keys(ed.vagas).join() === F.FORMACOES['4-3-3'].vagas.map(v => v.id).join(), 'edição da troca');
  reg('E5 tocar: os casos da tabela 4.1 (com recusas e cancelar)', prob.length ? prob.join('; ') : '21 casos ok', 'todos', prob.length === 0);
}

// ------------------------------------------------------------------------------------- E6
{
  const t = X.estadoInicialTime('golaco');
  const r = X.rascunhoDe(t);
  const boa = X.edicaoDe(X.tocar(X.tocar(r, 7).rasc, 11).rasc);
  const sub = X.edicaoDe(X.tocar(X.tocar(r, 9).rasc, 22).rasc);
  const form = X.edicaoDe(X.mudarFormacao(r, '4-2-3-1'));
  const tat = X.edicaoDe(X.mudarTatica(r, 'linha', 2));
  const v = (ts, ed) => X.validarEdicao(ts, ed);
  const casos = [];
  const recusa = (nome, ts, ed, cod) => { const res = v(ts, ed); casos.push([nome, !res.ok && res.codigo === cod, res]); };
  const aceita = (nome, ts, ed) => { const res = v(ts, ed); casos.push([nome, res.ok === true, res]); };
  aceita('troca de vagas', t, boa); aceita('substituição', t, sub); aceita('formação', t, form); aceita('tática', t, tat);
  recusa('1 base velha', t, { ...boa, base: 7 }, 1);
  recusa('2 formação inexistente', t, { ...boa, formacao: '2-3-5' }, 2);
  const semVaga = { ...boa, vagas: { ...boa.vagas } }; delete semVaga.vagas.PD;
  recusa('2 vagas sem as 11', t, semVaga, 2);
  recusa('3 id fora do elenco', t, { ...boa, vagas: { ...boa.vagas, PD: 107 } }, 3);
  recusa('3 id repetido', t, { ...boa, vagas: { ...boa.vagas, PD: 7 } }, 3);
  const tSaiu = { ...t, saiu: [22] };
  recusa('3 id que já saiu', tSaiu, sub, 3);
  recusa('4 quem sai não está em campo', t, { ...sub, substituicoes: [{ sai: 18, entra: 22 }] }, 4);
  recusa('4 quem entra já está em campo', t, { ...sub, substituicoes: [{ sai: 9, entra: 7 }] }, 4);
  recusa('4 par repetido', t, { ...sub, substituicoes: [{ sai: 9, entra: 22 }, { sai: 9, entra: 22 }] }, 4);
  recusa('5 escalação ≠ substituições', t, { ...boa, vagas: { ...boa.vagas, ATA: 22 } }, 5);
  recusa('6 limite de 5', { ...t, subs: { feitas: 5, paradas: 2 } }, sub, 6);
  recusa('6 sem paradas (3/3)', { ...t, subs: { feitas: 3, paradas: 3 } }, sub, 6);
  recusa('7 tática fora da faixa', t, { ...boa, tatica: { ...boa.tatica, mentalidade: 3 } }, 7);
  recusa('7 tática não inteira', t, { ...boa, tatica: { ...boa.tatica, pressao: 1.5 } }, 7);
  const ruins = casos.filter(c => !c[1]);
  reg('E6 validarEdicao: 7 recusas (12 casos) e 4 edições boas', ruins.length ? ruins.map(c => `${c[0]} → ${JSON.stringify(c[2])}`).join('; ') : `${casos.length} casos ok`, 'todos', ruins.length === 0);
}

// ----------------------------------------------------------------------- partida: utilidades
const criar = (sem, extra = {}) => S.criarTreino({ modo: 'partida', semente: sem, iaClassica: ANTES, ...extra });
const jp = (m, id) => SIM.jogadorPorId(m, id);
function ateRolar(m, max = 900) {
  for (let i = 0; i < max && m.partida.estado !== 'jogo'; i++) S.passoTreino(m, S.entradaDemo(m));
}
/** Bola para fora pela lateral perto de (x, ±34), com o último toque do time `toque`: começa uma parada. */
function bolaParaFora(m, toque, x = 10, sz = 1) {
  for (const j of m.jogadores) if (Math.hypot(j.x - x, j.z - sz * 30) < 10) P.teleportar(j, j.x + (j.x >= x ? 12 : -12), j.z * 0.4, j.rumo);
  m.posse = null; m.naMao = null; m.voo = null;
  for (const j of m.jogadores) { j.recebe = null; j.corrida = null; }
  Object.assign(m.bola, B.criarBola(x, sz * 31));
  B.chutarRasteiro(m.bola, 0, sz * 13);
  const t = m.jogadores.find(j => j.time === toque && j.posicao !== 'GOL');
  m.ultimoToque = { id: t.id, time: toque, tick: m.tick };
}
const esqueletoIA = existe('ia-tatica.js') && /ESQUELETO \(Parte 0\)/.test(fs.readFileSync(path.join(JS, 'ia-tatica.js'), 'utf8'));

// ------------------------------------------------------------------------------------- E7
{
  let imediato = true;
  const zCom = [], zSem = [];
  for (let s = 0; s < 4; s++) {
    for (const comEd of [true, false]) {
      const m = criar(BASE + 10 + s);
      ateRolar(m);
      for (let i = 0; i < 120; i++) S.passoTreino(m, S.entradaDemo(m));
      const r = X.rascunhoDe(m.times[0]);
      const ed = X.edicaoDe(X.tocar(X.tocar(r, 7).rasc, 11).rasc);
      S.passoTreino(m, S.entradaDemo(m), comEd ? [ed] : null);
      if (comEd) {
        const j11 = jp(m, 11);
        if (!(j11.vagaId === 'PD' && j11.posicao === 'PON' && jp(m, 7).vagaId === 'PE')) imediato = false;
      }
      let soma = 0, n = 0;
      for (let i = 1; i <= 480; i++) {
        S.passoTreino(m, S.entradaDemo(m));
        if (i >= 180) { const j11 = jp(m, 11); soma += j11.z * m.ataca[0]; n++; }
      }
      (comEd ? zCom : zSem).push(soma / n);
    }
  }
  reg('E7 troca PD↔PE: vaga e função no tick seguinte', imediato ? 'j(11) PD/PON, j(7) PE' : 'não mudou', 'PD/PON', imediato);
  const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const ok = med(zCom) > 8 && med(zSem) < -8;
  reg('E7 a IA leva o 11 para a vaga nova (z médio em 3–8 s, 4 sementes)', `com a edição ${fmt(med(zCom))} m; sem ${fmt(med(zSem))} m${esqueletoIA ? ' (ia-tatica.js ainda é o esqueleto)' : ''}`, '> +8; < −8', ok, esqueletoIA);
}

// ------------------------------------------------------------------------------------- E8
{
  const prob = [];
  const m = criar(BASE + 20);
  ateRolar(m);
  for (let i = 0; i < 60; i++) S.passoTreino(m, S.entradaDemo(m));
  const idx9 = m.jogadores.findIndex(j => j.id === 9);
  const ed = X.edicaoDe(X.tocar(X.tocar(X.rascunhoDe(m.times[0]), 9).rasc, 22).rasc);
  const ev0 = S.passoTreino(m, S.entradaDemo(m), [ed]);
  if (!ev0.some(e => e.tipo === 'timeEditado' && e.pendente)) prob.push('sem timeEditado pendente');
  if (!m.times[0].pendente || !jp(m, 9) || jp(m, 22)) prob.push('o 9 saiu antes da parada');
  // joga um pouco (sem parada) e o 9 continua
  let paradaAntes = false;
  for (let i = 0; i < 60; i++) { S.passoTreino(m, S.entradaDemo(m)); if (m.parada) paradaAntes = true; }
  if (!paradaAntes && (!jp(m, 9) || jp(m, 22))) prob.push('trocou sem parada');
  if (!m.parada) bolaParaFora(m, 1);
  let evSub = null;
  for (let i = 0; i < 400 && !evSub; i++) {
    const ev = S.passoTreino(m, S.entradaDemo(m));
    evSub = ev.find(e => e.tipo === 'substituicao') ?? null;
  }
  if (!evSub || evSub.sai !== 9 || evSub.entra !== 22 || evSub.time !== 0) prob.push(`evento ${JSON.stringify(evSub)}`);
  if (m.jogadores[idx9]?.id !== 22) prob.push(`índice ${idx9} tem o ${m.jogadores[idx9]?.id}`);
  const t = m.times[0];
  if (!t.saiu.includes(9) || t.subs.feitas !== 1 || t.subs.paradas !== 1 || t.pendente) prob.push(`estado ${JSON.stringify({ saiu: t.saiu, subs: t.subs, pendente: !!t.pendente })}`);
  if (jp(m, 22)?.vagaId !== 'ATA') prob.push('o 22 não está no ATA');
  // trazer o 9 de volta: recusado
  const volta = { ...X.edicaoDe(X.mudarTatica(X.rascunhoDe(t), 'linha', 2)) };
  volta.vagas = { ...volta.vagas, ATA: 9 };
  const evv = S.passoTreino(m, S.entradaDemo(m), [volta]);
  if (!evv.some(e => e.tipo === 'edicaoRecusada')) prob.push('o 9 voltou');
  // o controlado segue o novo (contrato de aplicarPendentes)
  const m2 = criar(BASE + 21);
  ateRolar(m2);
  const ed2 = X.edicaoDe(X.tocar(X.tocar(X.rascunhoDe(m2.times[0]), 10).rasc, 20).rasc);
  S.passoTreino(m2, S.entradaDemo(m2), [ed2]);
  ACO.assumirControle(m2, 0, jp(m2, 10));
  X.aplicarPendentes(m2, 0);
  if (m2.controlado[0] !== 20) prob.push(`controlado ${m2.controlado[0]} (esperado 20)`);
  reg('E8 substituição: pendente até a parada, mesmo índice, saiu, 1/5 e 1/3, evento, controlado, sem volta', prob.length ? prob.join('; ') : 'ok', 'tudo certo', prob.length === 0);
}

// ------------------------------------------------------------------------------------- E9
{
  const prob = [];
  const m = criar(BASE + 30);
  ateRolar(m);
  const ed = X.edicaoDe(X.tocar(X.tocar(X.rascunhoDe(m.times[0]), 1).rasc, 5).rasc);
  S.passoTreino(m, S.entradaDemo(m), [ed]);
  if (m.times[0].vagas.GOL !== 1 || jp(m, 1).posicao !== 'GOL' || jp(m, 5).posicao === 'GOL' || !m.times[0].pendente) prob.push('o goleiro trocou antes da parada');
  let maxLinha = 0, n = 0;
  for (let i = 0; i < 240 && !m.parada; i++) {
    S.passoTreino(m, S.entradaDemo(m));
    const g = jp(m, 1);
    maxLinha = Math.max(maxLinha, Math.abs(g.x - (-m.ataca[0] * 52.5)));
    n++;
  }
  if (maxLinha >= 8) prob.push(`goleiro a ${fmt(maxLinha)} m da linha`);
  if (!m.parada) bolaParaFora(m, 1, -10, -1);
  for (let i = 0; i < 400 && m.times[0].pendente; i++) S.passoTreino(m, S.entradaDemo(m));
  if (m.times[0].vagas.GOL !== 5 || jp(m, 5).posicao !== 'GOL' || jp(m, 1).vagaId !== 'VOL') prob.push(`na parada: GOL ${m.times[0].vagas.GOL}, j(1) ${jp(m, 1).vagaId}`);
  if (m.times[0].subs.feitas !== 0) prob.push('troca de vaga contou como substituição');
  reg('E9 troca com o GOL: o goleiro fica no gol até a parada; na parada vale', prob.length ? prob.join('; ') : `goleiro até ${fmt(maxLinha)} m da linha em ${n} passos; trocou na parada`, '< 8 m; troca na parada', prob.length === 0);
}

// ------------------------------------------------------------------------------------ E10
{
  const rodar = (passoEd, tatLinha = 2) => {
    const m = criar(BASE + 40);
    let ed = null;
    for (let i = 0; i < 900; i++) {
      let acoes = null;
      if (i === passoEd) {
        let r = X.rascunhoDe(m.times[0]);
        r = X.tocar(X.tocar(r, 7).rasc, 11).rasc;
        r = X.mudarTatica(r, 'linha', tatLinha);
        ed = X.edicaoDe(r);
        acoes = [ed];
      }
      S.passoTreino(m, S.entradaDemo(m), acoes);
    }
    return SIM.hashMundo(m);
  };
  const a = rodar(300), b = rodar(300), sem = rodar(-1), outro = rodar(301), tat = rodar(300, 0);
  const ok = a === b && a !== sem && a !== outro && a !== tat;
  reg('E10 determinismo com a edição no passo 300', `2 execuções ${a === b ? 'iguais' : 'diferentes'}; sem edição ${a !== sem ? 'outro' : 'igual'}; no 301 ${a !== outro ? 'outro' : 'igual'}; só a tática ${a !== tat ? 'outro' : 'igual'}`, 'iguais; outro; outro; outro', ok);
}

// ------------------------------------------------------------------------------------ E11
{
  // hashes da base 980b0b0 (as cenas de tools/hash-igual.mjs, encurtadas: 1800 passos, hash a cada 600)
  const BASE980 = {
    'ataque-1': [3298389666, 255764296, 4082737914],
    'ataque-2': [3929265932, 3750097417, 646006693],
    'conducao-7': [1415330591, 986885701, 4093573822],
  };
  const R = await import(pathToFileURL(path.join(AQUI, 'lib/roteiros.mjs')).href);
  const obt = {};
  let semTimes = true;
  for (const sem of [1, 2]) {
    const m = S.criarTreino({ modo: 'ataque', semente: sem });
    const hs = [];
    for (let i = 0; i < 1800; i++) { S.passoTreino(m, S.entradaDemo(m), i === 900 ? ['recomecar'] : null); if (i % 600 === 599) hs.push(SIM.hashMundo(m)); }
    obt[`ataque-${sem}`] = hs;
    if (m.times !== undefined || m.partida !== undefined) semTimes = false;
  }
  {
    const rot = R.criarRoteiro(7);
    const m = S.criarTreino({ modo: 'conducao', semente: 7, rumo: rot.rumo0 });
    const hs = [];
    for (let i = 0; i < 1800; i++) {
      S.passoTreino(m, R.entrada(rot, i / 60, m.jogadores[0]), i === 700 ? ['marcador'] : i === 1300 ? ['maquina'] : null);
      if (i % 600 === 599) hs.push(SIM.hashMundo(m));
    }
    obt['conducao-7'] = hs;
    if (m.times !== undefined) semTimes = false;
  }
  const dif = Object.keys(BASE980).filter(k => JSON.stringify(obt[k]) !== JSON.stringify(BASE980[k]));
  reg('E11 treino igual à base 980b0b0 (3 cenas × 3 hashes) e sem m.times', dif.length ? `diferem: ${dif.join(', ')}` : `9 hashes iguais${semTimes ? '' : '; treino com m.times'}`, 'iguais; sem m.times', !dif.length && semTimes);
}
fim();
