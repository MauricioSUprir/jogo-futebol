// Modo Livre 3D (dono, 16/10: "um modo livre, como no fifa, um modo de treino, onde pode ter a quantidade de jogadores
// que eu escolher, contra a quantidade de jogadores que eu escolher, pode ser adaptável durante a partida"; js/livre.js;
// contrato "Modo Livre" no CONTRATOS.md). Metas:
//   A) montagem N × M em todas as bordas (1×0, 1×1 só com o goleiro do outro lado, 1+GK × 0+GK, 10×10 sem goleiros, 11×11,
//      3×7 e sorteados): quantos em campo = a escolha; todo jogador com vaga válida e a vaga dele no time; os de linha nas
//      vagas de maior prioridade; ninguém em cima de ninguém; quem está fora é buraco (expulsos) e guardado; m.livre fora
//      do hash;
//   B) mudar no meio do jogo (tirar e pôr com a bola no pé de quem sai, com o controlado, com o goleiro com a bola nas mãos,
//      numa saída e num lateral montados — o cobrador sai e o time dele fica sem linha): quem fica não se mexe, a bola fica
//      onde estava, o controlado nunca sai, quem entra
//      aparece no ponto da vaga com os pés plantados, sem NaN nem jogador sem vaga, e o jogo segue (20 s depois);
//   C) IA × IA de 2 min: 3×3 e 5×5 (total de cada lado, com os goleiros; 20 sementes) com a posse trocando (média ≥ 6, com
//      a bola rolando), chutes (média ≥ 2) e ≤ 10% do tempo dos de linha a > 40 m da bola na pior semente; 1×0 (sem
//      goleiros; 4 sementes): chutes ≥ 2 e a distância (a posse não troca: não há adversário); 1+GK × 0+GK informativo;
//   D) gol e bola fora sem cobrador nulo (o time sem ninguém de linha passa a cobrança: lateral, escanteio → tiro de meta,
//      tiro de meta sem goleiro → escanteio, 8 s do goleiro, saída depois do gol) e o único de linha que cobrou toca de novo;
//   E) determinismo (a mesma semente e as mesmas mudanças nos mesmos ticks = o mesmo hash) e o Livre não vaza para a
//      partida (a mesma partida antes e depois de rodar o Livre: o mesmo hash; hash-partida/hash-igual comparam com a base);
//   F) o goleiro sozinho no gol defende: o canhão do teste-goleiro no Livre 1 × só o goleiro = o canhão no mundo de sempre.
//   G) sem impedimento, nem na IA (contrato §1): no Livre 11 × 11 os companheiros do condutor à frente da defesa adversária
//      não voltam por causa da linha (na partida ~36% do tempo voltando; antes da correção, no Livre, ~40%) e recebem o passe.
//   node tools/teste-livre.mjs [--js <pasta js>] [--sementes N (C: 20)]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
// (C: 20 sementes de 2 min no 3×3 e no 5×5 — as trocas de posse do 3×3 variam ~2,8 por semente: com 6 a média ia de 7 a
// 10 entre os lotes, com 10 ainda ±0,9; 60 sementes, sem o impedimento na IA do Livre: 6,3 — e 4 no 1×0)
const NSEM = args.includes('--sementes') ? Math.max(1, +args[args.indexOf('--sementes') + 1] || 20) : 20;

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let LV = null;
try { LV = await imp('livre.js'); } catch (e) { LV = null; console.error(e?.message); }
if (!LV) {
  reg('Modo Livre (js/livre.js)', 'não existe', 'existe', false);
} else {
  const { criarLivre, passoLivre, entradaDemoLivre, ajustarJogadores, recomecarLivre, prioridadeVagas, escolhaDoMundo, normalizarEscolha } = LV;
  const { LIVRE, CAMPO, PASSO, PARTIDA, GOLEIRO, JOGADOR, PASSADA } = await imp('config.js');
  const { hashMundo, jogadorPorId, criarMundo, passo } = await imp('sim.js');
  const { criarPartida, passoPartida, entradaDemoPartida, teleportar } = await imp('partida.js');
  const { assumirControle } = await imp('acoes.js');
  const { FORMACOES } = await imp('formacoes.js');
  const MX = CAMPO.meioX;
  const ehLinha = o => o.posicao !== 'GOL';
  const seg = s => Math.round(s / PASSO);

  /** Problemas de consistência do mundo do Livre (lista de textos; vazia = tudo certo). */
  function problemas(m) {
    const p = [];
    for (const t of [0, 1]) {
      const s = m.times[t], f = FORMACOES[s.formacao];
      const prio = prioridadeVagas(s.formacao);
      const lin = m.jogadores.filter(o => o.time === t && ehLinha(o));
      const vistos = new Set();
      for (const o of m.jogadores.filter(q => q.time === t)) {
        if (!Number.isFinite(o.x) || !Number.isFinite(o.z) || !Number.isFinite(o.vx) || !Number.isFinite(o.rumo)) p.push(`NaN no ${o.id}`);
        const v = f.porId[o.vagaId];
        if (!v || o.vagaIdx !== f.indice[o.vagaId] || s.vagas[o.vagaId] !== o.id) p.push(`${o.id} sem vaga válida (${o.vagaId})`);
        if (vistos.has(o.vagaId)) p.push(`vaga ${o.vagaId} com 2`); vistos.add(o.vagaId);
        if ((s.expulsos ?? []).includes(o.id)) p.push(`${o.id} em campo e no buraco`);
        if (v && (v.grupo === 'gol') !== (o.posicao === 'GOL')) p.push(`${o.id} goleiro fora do gol (${o.vagaId})`);
      }
      // os de linha nas vagas de maior prioridade
      const alvo = new Set(prio.slice(0, lin.length));
      for (const o of lin) if (!alvo.has(o.vagaId)) p.push(`${o.id} fora das ${lin.length} vagas de maior prioridade (${o.vagaId})`);
      // quem está fora: buraco e guardado
      for (const id of Object.values(s.vagas)) {
        const em = m.jogadores.some(o => o.id === id);
        if (!em && !(s.expulsos ?? []).includes(id)) p.push(`${id} fora sem buraco`);
        if (!em && !m.livre.fora[id]) p.push(`${id} fora sem estar guardado`);
      }
    }
    const b = m.bola.p;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z)) p.push('bola NaN');
    const h = m.timeHumano ?? 0, c = m.controlado[h];
    if (!m.jogadores.some(o => o.id === c && o.time === h)) p.push(`controlado ${c} não está em campo`);
    if (m.parada && m.parada.cobrador != null && !m.jogadores.some(o => o.id === m.parada.cobrador && o.time === m.parada.time)) p.push('cobrador fora do time que cobra');
    return p;
  }
  /** A menor distância entre dois jogadores em campo. */
  function menorDist(m) {
    let d = Infinity;
    const js = m.jogadores;
    for (let i = 0; i < js.length; i++) for (let k = i + 1; k < js.length; k++) d = Math.min(d, Math.hypot(js[i].x - js[k].x, js[i].z - js[k].z));
    return d;
  }
  const contar = m => { const e = escolhaDoMundo(m); return `${e.linha[0]}${e.goleiro[0] ? '+G' : ''}×${e.linha[1]}${e.goleiro[1] ? '+G' : ''}`; };
  const passos = (m, n, onEv) => { for (let i = 0; i < n; i++) { const ev = passoLivre(m, entradaDemoLivre(m), null); if (onEv) onEv(ev, m); } };

  // ------------------------------------------------------------ A. montagem N × M
  {
    const casos = [
      [[1, 0], [false, false]], [[1, 0], [false, true]], [[1, 0], [true, true]], [[10, 10], [false, false]], [[10, 10], [true, true]],
      [[2, 6], [true, true]], [[1, 1], [true, true]], [[0, 3], [true, false]], [[3, 0], [true, true]], [[5, 10], [false, true]],
    ];
    // sorteados (com semente fixa: a lista é sempre a mesma)
    let r = 12345;
    const rnd = () => { r = (r * 1103515245 + 12345) >>> 0; return r / 4294967296; };
    for (let k = 0; k < 14; k++) casos.push([[Math.floor(rnd() * 11), Math.floor(rnd() * 11)], [rnd() < 0.6, rnd() < 0.6]]);
    let erros = [], certos = 0, perto = Infinity, hashFora = true;
    for (const [linha, goleiro] of casos) {
      const m = criarLivre({ semente: 7, linha, goleiro });
      const esp = normalizarEscolha({ linha, goleiro }, 0);
      const e = escolhaDoMundo(m);
      const ok = e.linha[0] === esp.linha[0] && e.linha[1] === esp.linha[1] && e.goleiro[0] === esp.goleiro[0] && e.goleiro[1] === esp.goleiro[1];
      const p = problemas(m);
      if (ok && !p.length) certos++; else erros.push(`${JSON.stringify(linha)}${JSON.stringify(goleiro)}: ${ok ? '' : 'contagem ' + contar(m) + ' '}${p.slice(0, 2).join('; ')}`);
      perto = Math.min(perto, menorDist(m));
      // m.livre fora do hash
      const h0 = hashMundo(m);
      m.livre.ajustes += 7; m.livre.linha = [9, 9]; m.livre.fora[999] = { x: 1 };
      if (hashMundo(m) !== h0) hashFora = false;
    }
    reg('A1. Montagem N × M (bordas + 14 sorteadas): contagem, vagas de maior prioridade, buracos, controlado', `${certos}/${casos.length}${erros.length ? ' — ' + erros.slice(0, 2).join(' | ') : ''}`, `${casos.length}/${casos.length}`, certos === casos.length);
    reg('A2. Ninguém em cima de ninguém na montagem (menor distância entre dois)', `${fmt(perto, 2)} m`, '≥ 1 m', perto >= 1);
    reg('A3. m.livre fora do hash (mexer nele não muda hashMundo)', hashFora ? 'igual' : 'mudou', 'igual', hashFora);
    // o time do humano nunca fica sem ninguém de linha; 11 sem goleiro não existe (10 de linha no máximo)
    const n0 = normalizarEscolha({ linha: [0, 12], goleiro: [false, false] }, 0);
    reg('A4. Limites: humano ≥ 1 de linha, ≤ 10 de linha por time', `pedido [0, 12] → [${n0.linha}]`, '[1, 10]', n0.linha[0] === 1 && n0.linha[1] === 10);
    const pr = prioridadeVagas('4-3-3').slice(0, 5).join(', ');
    reg('A5. Ordem das vagas (4-3-3): ZAG central, ATA, meio central, PE, 2º ZAG...', pr, 'ZE, ATA, VOL, PE, ZD', pr === 'ZE, ATA, VOL, PE, ZD');
  }

  // ------------------------------------------------------------ B. mudar no meio do jogo
  {
    const relato = [];
    let okFica = true, okBola = true, okCtrl = true, okEntra = true, okPes = true, okSegue = true, nAcoes = 0;
    let errosB = [];
    /** Aplica a escolha agora (como a ação do passo) e confere o que a meta B pede. */
    function mudar(m, e, nome) {
      nAcoes++;
      const h = m.timeHumano ?? 0, ctrl = m.controlado[h], ctrlGol = jogadorPorId(m, ctrl)?.posicao === 'GOL';
      const antes = new Map(m.jogadores.map(o => [o.id, { x: o.x, z: o.z, vx: o.vx, vz: o.vz }]));
      const bola = { x: m.bola.p.x, z: m.bola.p.z };
      const dono = m.posse;
      m.eventos = [];
      const r = ajustarJogadores(m, e);
      const montou = m.eventos.some(ev => ev.tipo === 'saida');
      // quem ficou não se mexeu (sem montagem de saída) e a bola ficou onde estava
      if (!montou) {
        for (const o of m.jogadores) {
          const a = antes.get(o.id);
          if (a && (Math.abs(a.x - o.x) > 1e-9 || Math.abs(a.z - o.z) > 1e-9)) { okFica = false; errosB.push(`${nome}: ${o.id} mexeu`); break; }
        }
        if (Math.hypot(m.bola.p.x - bola.x, m.bola.p.z - bola.z) > 1e-9) { okBola = false; errosB.push(`${nome}: a bola mexeu`); }
        if (dono != null && r.saiu.includes(dono) && m.posse != null) { okBola = false; errosB.push(`${nome}: a bola de quem saiu não ficou solta`); }
      }
      // (o goleiro controlado sai pela escolha do goleiro: o controle passa a um de linha)
      if (!jogadorPorId(m, ctrl) && !ctrlGol) { okCtrl = false; errosB.push(`${nome}: o controlado saiu`); }
      for (const id of r.entrou) {
        const j = jogadorPorId(m, id);
        if (!j) { okEntra = false; continue; }
        let d = Infinity;
        for (const o of m.jogadores) if (o !== j) d = Math.min(d, Math.hypot(o.x - j.x, o.z - j.z));
        if (d < LIVRE.afastar - 1e-6) { okEntra = false; errosB.push(`${nome}: ${id} entrou a ${fmt(d, 2)} m de alguém`); }
        // (com a saída montada de novo, todos foram levados ao lugar e o cobrador fica 'parado' até cobrar)
        if (!montou && (Math.hypot(j.vx, j.vz) > 0 || j.papel !== 'ia')) { okEntra = false; errosB.push(`${nome}: ${id} entrou ${j.papel} a ${fmt(Math.hypot(j.vx, j.vz), 2)} m/s`); }
        for (const pe of j.pes) if (!pe.apoio || Math.hypot(pe.x - j.x, pe.z - j.z) > PASSADA.afastamentoLateral + 0.05) okPes = false;
      }
      const p = problemas(m);
      if (p.length) { okSegue = false; errosB.push(`${nome}: ${p[0]}`); }
      relato.push(`${nome}: ${contar(m)}`);
      return r;
    }
    function segue(m, s, nome) {
      try {
        passos(m, seg(s));
        const p = problemas(m);
        if (p.length) { okSegue = false; errosB.push(`${nome} (depois): ${p[0]}`); }
      } catch (err) { okSegue = false; errosB.push(`${nome}: exceção ${err.message}`); }
    }
    for (const sem of [11, 12, 13]) {
      const m = criarLivre({ semente: sem, linha: [4, 4], goleiro: [true, true] });
      passos(m, seg(6));
      // 1) a bola no pé de alguém que sai: o condutor do adversário (o de menor prioridade, longe) — força tirar todos menos 1
      let tent = 0;
      while (m.posse == null && tent++ < 600) passos(m, 1);
      const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
      if (dono) {
        const t = dono.time, e = escolhaDoMundo(m);
        if (ehLinha(dono) && dono.id !== m.controlado[0]) { e.linha[t] = t === 0 ? 1 : 0; }
        mudar(m, e, `s${sem} tira com a bola no pé`);
        segue(m, 20, `s${sem} tira com a bola no pé`);
      }
      // 2) o controlado nunca sai: o humano de 5 para 1 de linha
      {
        const e = escolhaDoMundo(m); e.linha[0] = 1;
        const c = m.controlado[0];
        mudar(m, e, `s${sem} humano para 1`);
        if (!jogadorPorId(m, c) || !ehLinha(jogadorPorId(m, c))) { okCtrl = false; errosB.push(`s${sem}: o controlado ${c} saiu`); }
        segue(m, 20, `s${sem} humano para 1`);
      }
      // 3) põe de volta (10 de linha de cada lado, sem goleiros) e depois 11×11
      mudar(m, { linha: [10, 10], goleiro: [false, false] }, `s${sem} 10×10 sem goleiros`);
      segue(m, 15, `s${sem} 10×10`);
      mudar(m, { linha: [10, 10], goleiro: [true, true] }, `s${sem} 11×11`);
      segue(m, 15, `s${sem} 11×11`);
      // 4) o goleiro com a bola nas mãos sai
      tent = 0;
      while (m.naMao == null && tent++ < seg(60)) passos(m, 1);
      if (m.naMao != null) {
        const g = jogadorPorId(m, m.naMao), e = escolhaDoMundo(m);
        e.goleiro[g.time] = false;
        mudar(m, e, `s${sem} goleiro com a bola nas mãos sai`);
        if (m.naMao != null || jogadorPorId(m, g.id)) { okBola = false; errosB.push(`s${sem}: a bola ficou na mão de quem saiu`); }
        segue(m, 15, `s${sem} goleiro sai`);
      } else relato.push(`s${sem}: sem bola na mão em 60 s`);
      // 5) numa bola parada montada (a saída do recomeço): monta de novo com quem ficou
      recomecarLivre(m, 'meio');
      passos(m, 1);
      const cobr = m.parada?.cobrador;
      const e = escolhaDoMundo(m); e.linha[0] = 2; e.linha[1] = 3;
      mudar(m, e, `s${sem} na saída montada`);
      if (!m.parada || m.parada.cobrador == null || !jogadorPorId(m, m.parada.cobrador)) { okSegue = false; errosB.push(`s${sem}: saída sem cobrador (antes ${cobr})`); }
      segue(m, 20, `s${sem} depois da saída`);
    }
    // 6) no lateral montado do adversário, o adversário fica sem ninguém de linha (o cobrador sai): o lateral passa ao meu
    //    time e é montado de novo; e no escanteio montado do meu time entra gente dos dois lados
    for (const sem of [14, 15]) {
      const m = criarLivre({ semente: sem, linha: [4, 4], goleiro: [true, true] });
      passos(m, seg(3));
      const pr0 = m.parada; if (pr0 && pr0.cobrador != null && pr0.papel != null) { const c = jogadorPorId(m, pr0.cobrador); if (c) c.papel = pr0.papel; }
      const ult = m.jogadores.find(o => o.time === 0 && ehLinha(o));
      m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.cobrou = null;
      Object.assign(m.bola.p, { x: 8, y: 0.11, z: CAMPO.meioZ + 0.5 }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
      m.partida.ultimoTime = 0; m.partida.ultimoId = ult.id; m.partida.ultimoTick = m.tick; m.ultimoToque = { id: ult.id, time: 0, tick: m.tick };
      for (let i = 0; i < seg(4) && !(m.parada && m.parada.cobrador != null); i++) passoLivre(m, entradaDemoLivre(m), null);
      const antes = m.parada ? `${m.parada.tipo} t${m.parada.time}` : 'nada';
      mudar(m, { linha: [4, 0], goleiro: [true, true] }, `s${sem} lateral do adversário, ele fica sem linha`);
      for (let i = 0; i < seg(4) && !(m.parada && m.parada.cobrador != null); i++) passoLivre(m, entradaDemoLivre(m), null);
      const pr = m.parada;
      if (!(pr && pr.tipo === 'lateral' && pr.time === 0 && jogadorPorId(m, pr.cobrador)?.time === 0)) { okSegue = false; errosB.push(`s${sem}: ${antes} → ${pr ? pr.tipo + ' t' + pr.time + ' c' + pr.cobrador : 'nada'}`); }
      else relato.push(`s${sem}: ${antes} → lateral t0`);
      mudar(m, { linha: [9, 6], goleiro: [true, false] }, `s${sem} entra gente no lateral montado`);
      segue(m, 15, `s${sem} depois do lateral`);
    }
    reg('B1. Quem fica não se mexe e a bola fica onde estava (solta, se era de quem saiu)', okFica && okBola ? `${nAcoes} mudanças` : errosB.slice(0, 2).join(' | '), 'nenhum teletransporte', okFica && okBola);
    reg('B2. O controlado nunca sai (o goleiro sai só pela escolha: o controle passa)', okCtrl ? 'sempre em campo' : errosB.find(x => x.includes('controlado')), 'sempre', okCtrl);
    reg('B3. Quem entra: parado, papel ia, a ≥ LIVRE.afastar m de todos, pés plantados no corpo', okEntra && okPes ? 'certo' : `${okEntra ? '' : 'lugar/estado'} ${okPes ? '' : 'pés'} ${errosB.find(x => x.includes('entrou')) ?? ''}`, 'sempre', okEntra && okPes);
    reg('B4. Sem NaN nem jogador sem vaga, e o jogo segue (20 s depois de cada mudança; bola parada montada de novo)', okSegue ? relato.slice(0, 3).join(' · ') + ' …' : errosB.slice(0, 2).join(' | '), 'sempre', okSegue);
  }

  // ------------------------------------------------------------ C. IA × IA de 2 min
  {
    const confs = {
      '3×3': { linha: [2, 2], goleiro: [true, true] }, '5×5': { linha: [4, 4], goleiro: [true, true] },
      '1×0': { linha: [1, 0], goleiro: [false, false] }, '2×1 (1+G × só G)': { linha: [1, 0], goleiro: [true, true] },
    };
    const R = {};
    for (const [nome, e] of Object.entries(confs)) {
      const res = [];
      const ns = nome.startsWith('1×0') || nome.startsWith('2×1') ? Math.min(4, NSEM) : NSEM;
      for (let s = 1; s <= ns; s++) {
        const m = criarLivre({ semente: s, ...e });
        let trocas = 0, todas = 0, ult = null, chutes = 0, gols = 0, longe = 0, am = 0, erro = null;
        try {
          for (let i = 0; i < seg(120); i++) {
            const ev = passoLivre(m, entradaDemoLivre(m), null);
            for (const x of ev) { if (x.tipo === 'chute') chutes++; if (x.tipo === 'gol') gols++; }
            const id = m.naMao ?? m.posse;
            if (id != null) {
              const j = jogadorPorId(m, id);
              if (j && j.time !== ult) { if (ult != null) { todas++; if (m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou)) trocas++; } ult = j.time; }
            }
            const b = m.bola.p;
            for (const j of m.jogadores) { if (!ehLinha(j)) continue; am++; if (Math.hypot(j.x - b.x, j.z - b.z) > 40) longe++; }
          }
        } catch (err) { erro = err.message; }
        res.push({ trocas, todas, chutes, gols, longe: longe / Math.max(1, am), erro });
      }
      const med = k => res.reduce((a, r) => a + r[k], 0) / res.length;
      R[nome] = { trocas: med('trocas'), todas: med('todas'), chutes: med('chutes'), gols: med('gols'), longe: Math.max(...res.map(r => r.longe)), minTrocas: Math.min(...res.map(r => r.trocas)), minChutes: Math.min(...res.map(r => r.chutes)), erros: res.filter(r => r.erro).map(r => r.erro) };
    }
    for (const nome of ['3×3', '5×5']) {
      const r = R[nome];
      reg(`C. ${nome} (IA × IA, 2 min, ${NSEM} sementes): posse troca com a bola rolando (média; todas as trocas, com os recomeços)`, `${fmt(r.trocas, 1)} (mín ${r.minTrocas}; todas ${fmt(r.todas, 1)})`, 'média ≥ 6', r.trocas >= 6 && !r.erros.length);
      reg(`C. ${nome}: chutes por 2 min (média; gols ${fmt(r.gols, 1)})`, `${fmt(r.chutes, 1)} (mín ${r.minChutes})`, 'média ≥ 2', r.chutes >= 2);
      reg(`C. ${nome}: tempo dos de linha a > 40 m da bola (a pior semente)`, `${fmt(100 * r.longe, 1)}%`, '≤ 10%', r.longe <= 0.10);
    }
    {
      const r = R['1×0'];
      reg('C. 1×0 sem goleiros (2 min): chutes (a posse não troca: não há adversário)', `${fmt(r.chutes, 1)} (mín ${r.minChutes}; gols ${fmt(r.gols, 1)})`, 'média ≥ 2', r.chutes >= 2 && !r.erros.length);
      reg('C. 1×0: tempo a > 40 m da bola (a pior semente)', `${fmt(100 * r.longe, 1)}%`, '≤ 10%', r.longe <= 0.10);
      const q = R['2×1 (1+G × só G)'];
      console.log(`informativo — 2×1 (1 de linha + goleiro × só o goleiro): trocas ${fmt(q.trocas, 1)} (todas ${fmt(q.todas, 1)}), chutes ${fmt(q.chutes, 1)}, gols ${fmt(q.gols, 1)}, longe ${fmt(100 * q.longe, 1)}%${q.erros.length ? ' ERROS ' + q.erros[0] : ''}`);
      if (q.erros.length) reg('C. 2×1 (1 de linha + goleiro × só o goleiro) sem erro', q.erros[0], 'sem erro', false);
    }
  }

  // ------------------------------------------------------------ D. gol e bola fora com um time sem ninguém de linha
  {
    const casos = [];
    /** Põe a bola fora (x, z) com o último toque do time `ult` e roda até a cobrança ser montada (ou 6 s). */
    function fora(m, x, z, ult) {
      const j = m.jogadores.find(o => o.time === ult) ?? m.jogadores[0];
      m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
      for (const o of m.jogadores) { if (o.segura) o.segura = null; }
      Object.assign(m.bola.p, { x, y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
      m.partida.ultimoTime = ult; m.partida.ultimoId = j.id; m.partida.ultimoTick = m.tick;
      m.ultimoToque = { id: j.id, time: ult, tick: m.tick };
      for (let i = 0; i < seg(6); i++) {
        passoLivre(m, entradaDemoLivre(m), null);
        if (m.parada && m.parada.cobrador != null) break;
      }
      const pr = m.parada;
      return pr && pr.cobrador != null ? { tipo: pr.tipo, time: pr.time, cobrador: jogadorPorId(m, pr.cobrador) } : null;
    }
    // 1+G × só G: lateral do time 1 (sem linha) → do time 0; escanteio do time 1 → tiro de meta do time 0
    {
      const m = criarLivre({ semente: 21, linha: [1, 0], goleiro: [true, true] });
      passos(m, seg(1));
      const a = fora(m, 10, CAMPO.meioZ + 0.5, 0);
      casos.push(['lateral do time sem linha → o outro cobra', a && a.tipo === 'lateral' && a.time === 0 && a.cobrador?.time === 0, a ? `${a.tipo} t${a.time}` : 'nada']);
      // o time 1 defende o gol de x = +52,5 (o 0 ataca para +x): bola fora pela linha de fundo de lá com o último toque do
      // time 1 (o goleiro) = escanteio do time 0; com o último toque do time 0 = tiro de meta do time 1 pelo goleiro dele
      const b = fora(m, MX + 0.5, 5, 0);
      casos.push(['tiro de meta do time só com o goleiro: o goleiro cobra', b && b.tipo === 'tiroDeMeta' && b.time === 1 && b.cobrador?.posicao === 'GOL', b ? `${b.tipo} t${b.time} ${b.cobrador?.posicao}` : 'nada']);
      // escanteio para o time 1 (bola fora pela linha de fundo do time 0 com o último toque do time 0)
      const c = fora(m, -MX - 0.5, 5, 0);
      casos.push(['escanteio do time sem linha → tiro de meta do outro', c && c.tipo === 'tiroDeMeta' && c.time === 0, c ? `${c.tipo} t${c.time}` : 'nada']);
    }
    // 1 × 0 sem goleiros: tiro de meta do time 1 (vazio) → escanteio do 0; saída depois do gol do 0 → do 0; o único de linha
    // que cobrou toca de novo
    {
      const m = criarLivre({ semente: 22, linha: [1, 0], goleiro: [false, false] });
      passos(m, seg(1));
      const a = fora(m, MX + 0.5, -6, 0);
      casos.push(['tiro de meta do time vazio → escanteio do outro', a && a.tipo === 'escanteio' && a.time === 0, a ? `${a.tipo} t${a.time}` : 'nada']);
      const m2 = criarLivre({ semente: 23, linha: [1, 0], goleiro: [false, false] });
      let gol = false, saida = null, retoma = false, depois = -1;
      for (let i = 0; i < seg(90) && !retoma; i++) {
        const ev = passoLivre(m2, entradaDemoLivre(m2), null);
        for (const e of ev) { if (e.tipo === 'gol') gol = true; if (e.tipo === 'saida' && gol) { saida = e.time; depois = m2.tick; } }
        if (saida != null && m2.parada == null && m2.posse != null && m2.tick > depois + 30) retoma = true;
      }
      casos.push(['saída depois do gol com o outro time vazio: quem tem linha dá a saída', gol && saida === 0, `gol ${gol}, saída t${saida}`]);
      casos.push(['o único de linha que cobrou a saída toca de novo (não trava)', retoma, retoma ? 'retomou' : 'travou']);
    }
    // 8 s do goleiro do time 0 com o time 1 sem linha: o escanteio do 1 vira tiro de meta do 0
    {
      const m = criarLivre({ semente: 24, linha: [1, 0], goleiro: [true, false] });
      passos(m, seg(1));
      const g = m.jogadores.find(o => o.time === 0 && !ehLinha(o));
      const pr0 = m.parada; if (pr0 && pr0.cobrador != null && pr0.papel != null) { const c = jogadorPorId(m, pr0.cobrador); if (c) c.papel = pr0.papel; }
      m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.voo = null; m.posse = g.id; m.naMao = g.id;
      teleportar(g, -MX + 8, 2, 0);
      // o goleiro do humano (controlado, parado: a IA não repõe por ele) com a bola nas mãos há 7,5 s
      assumirControle(m, 0, g);
      g.segura = { desde: m.tick - seg(7.5), dePe: m.tick - seg(7.5), off: { x: 0, y: 0, z: 0 } };
      let pr = null;
      for (let i = 0; i < seg(6); i++) { passoLivre(m, { x: 0, z: 0, botoes: 0 }, null); if (m.parada && m.parada.cobrador != null) { pr = m.parada; break; } }
      casos.push(['8 s do goleiro com o adversário vazio: tiro de meta do próprio time', pr && pr.time === 0 && pr.tipo === 'tiroDeMeta', pr ? `${pr.tipo} t${pr.time}` : 'nada']);
    }
    // varredura: 30 configurações × 40 s IA × IA — nenhuma cobrança montada sem cobrador do time que cobra, nenhuma exceção
    let nulos = 0, excecoes = 0, montadas = 0;
    for (let k = 0; k < 30; k++) {
      const e = { linha: [1 + (k * 7) % 10, (k * 3) % 11], goleiro: [k % 3 !== 0, k % 4 !== 1] };
      const m = criarLivre({ semente: 100 + k, ...e });
      let viu = null;
      try {
        for (let i = 0; i < seg(40); i++) {
          passoLivre(m, entradaDemoLivre(m), null);
          const pr = m.parada;
          if (pr && pr.cobrador != null && pr !== viu) { viu = pr; montadas++; const c = jogadorPorId(m, pr.cobrador); if (!c || c.time !== pr.time) nulos++; }
        }
      } catch (err) { excecoes++; if (excecoes === 1) console.error(err); }
    }
    for (const [nome, ok, med] of casos) reg(`D. ${nome}`, med, 'certo', !!ok);
    reg('D. Varredura (30 configurações × 40 s): cobrança sem cobrador do time ou exceção', `${nulos} sem cobrador, ${excecoes} exceções (${montadas} cobranças)`, '0 e 0', nulos === 0 && excecoes === 0);
  }

  // ------------------------------------------------------------ E. determinismo e nada vaza para a partida
  {
    const roteiro = [[600, { linha: [2, 5], goleiro: [true, false] }], [1500, { linha: [7, 1], goleiro: [false, true] }], [2400, { linha: [10, 10], goleiro: [true, true] }]];
    const rodar = sem => {
      const m = criarLivre({ semente: sem, linha: [4, 4], goleiro: [true, true] });
      const hs = [];
      for (let i = 0; i < 3600; i++) {
        const ac = roteiro.filter(([t]) => t === i).map(([, e]) => ({ tipo: 'livreAjuste', ...e }));
        if (i === 3000) ac.push({ tipo: 'livreRecomecar', onde: 'pe' });
        passoLivre(m, entradaDemoLivre(m), ac.length ? ac : null);
        if (i % 300 === 299) hs.push(hashMundo(m));
      }
      return hs.join(',');
    };
    const a = rodar(31), b = rodar(31), c = rodar(32);
    reg('E1. Determinismo: a mesma semente e as mesmas mudanças nos mesmos ticks = o mesmo hash (12 hashes em 60 s)', a === b ? 'iguais' : 'diferentes', 'iguais', a === b);
    reg('E2. Outra semente, outro jogo', a !== c ? 'diferente' : 'igual', 'diferente', a !== c);
    const partida = () => {
      const m = criarPartida({ semente: 5, minutosPorTempo: 1 });
      for (let i = 0; i < 3000; i++) passoPartida(m, entradaDemoPartida(m), null);
      return hashMundo(m);
    };
    const p1 = partida();
    { const m = criarLivre({ semente: 5, linha: [3, 2], goleiro: [true, true] }); passos(m, 1200); ajustarJogadores(m, { linha: [10, 10], goleiro: [false, true] }); passos(m, 600); }
    const p2 = partida();
    reg('E3. O Livre não vaza para a partida: a mesma partida antes e depois de rodar um Livre (o hash da base: hash-partida)', p1 === p2 ? 'iguais' : 'diferentes', 'iguais', p1 === p2);
  }

  // ------------------------------------------------------------ F. o goleiro sozinho no gol defende (canhão)
  {
    const GX = MX, MEIO = CAMPO.gol.largura / 2;
    const MEDIO = { reflexo: 72, posicionamento: 72, mergulho: 72 };
    /** O canhão do teste-goleiro numa célula: a partida (os outros parados longe) ou o Livre (1 de linha parado × só o goleiro). */
    function celula(d, lat, livre, n) {
      let ok = 0, tot = 0;
      for (let s = 1; s <= n; s++) {
        const ang = ((((s * 41) % 61) - 30)) * Math.PI / 180;
        const bx = GX - Math.cos(ang) * d, bz = Math.sin(ang) * d;
        let m, g, step;
        if (livre) {
          m = criarLivre({ semente: 3000 + s * 7 + d * 131 + Math.round(lat * 10), linha: [1, 0], goleiro: [false, true] });
          const a = m.jogadores.find(o => o.time === 0);
          g = m.jogadores.find(o => o.time === 1);
          g.par.attr = { ...g.par.attr, ...MEDIO };
          // a bola rolando, sem parada; o atacante parado atrás dela; o goleiro no gol dele (x = +52,5)
          const pr = m.parada; if (pr && pr.cobrador != null && pr.papel != null) { const c = jogadorPorId(m, pr.cobrador); if (c) c.papel = pr.papel; }
          m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.posse = null; m.voo = null; m.naMao = null; m.cobrou = null;
          teleportar(a, bx - 3, bz, 0); a.papel = 'parado';
          teleportar(g, GX - 1, 0, Math.PI);
          Object.assign(m.bola.p, { x: bx, y: 0.11, z: bz }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
          step = () => passoLivre(m, { x: 0, z: 0, botoes: 0 }, null);
        } else {
          // a partida 11×11 (as mesmas regras do goleiro: a mão só na área, a calibração da partida — GOLEIRO.logit
          // c0Partida/cLongePartida): o goleiro do time 1 no gol e os outros 21 parados longe (o atacante atrás da bola)
          m = criarPartida({ semente: 3000 + s * 7 + d * 131 + Math.round(lat * 10) });
          g = m.jogadores.find(o => o.time === 1 && o.posicao === 'GOL');
          g.par.attr = { ...g.par.attr, ...MEDIO };
          const pr = m.parada; if (pr && pr.cobrador != null && pr.papel != null) { const c = jogadorPorId(m, pr.cobrador); if (c) c.papel = pr.papel; }
          m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.posse = null; m.voo = null; m.naMao = null; m.cobrou = null;
          let k = 0;
          for (const o of m.jogadores) {
            if (o === g) continue;
            if (o.time === 0 && o.posicao === 'ATA') { teleportar(o, bx - 3, bz, 0); o.papel = 'parado'; continue; }
            teleportar(o, -45 + (k % 5) * 3, -30 + Math.floor(k / 5) * 3, 0); o.papel = 'parado'; k++;
          }
          teleportar(g, GX - 1, 0, Math.PI);
          Object.assign(m.bola.p, { x: bx, y: 0.11, z: bz }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
          step = () => passoPartida(m, { x: 0, z: 0, botoes: 0 }, null);
        }
        for (let i = 0; i < 120; i++) step();
        if (m.posse != null || m.naMao != null || Math.hypot(m.bola.p.x - bx, m.bola.p.z - bz) > 0.5) continue; // o goleiro saiu na bola parada
        const lado = s % 2 ? 1 : -1;
        const y = 0.3 + ((s * 0.618034) % 1) * 1.6;
        const pz = g.z + lado * lat;
        const kx = (GX - bx) / (g.x - bx);
        const zLinha = bz + (pz - bz) * kx;
        if (Math.abs(zLinha) > MEIO - 0.15) continue;
        const ux0 = GX - bx, uz0 = zLinha - bz, D = Math.hypot(ux0, uz0);
        const v = 22 + (((s * 3) % 7) - 3);
        const ux = ux0 / D, uz = uz0 / D;
        let lo = -0.2, hi = 0.6;
        const Dg = Math.hypot(g.x - bx, pz - bz);
        for (let k = 0; k < 30; k++) {
          const el = (lo + hi) / 2, t = Dg / (v * Math.cos(el)), yy = 0.11 + v * Math.sin(el) * t - 4.905 * t * t;
          if (yy < y) lo = el; else hi = el;
        }
        const el = (lo + hi) / 2;
        m.bola.v.x = ux * v * Math.cos(el); m.bola.v.y = v * Math.sin(el); m.bola.v.z = uz * v * Math.cos(el);
        m.bola.rolando = false;
        const atk = m.jogadores.find(o => o.time === 0 && o.papel === 'parado' && Math.hypot(o.x - (bx - 3), o.z - bz) < 0.5) ?? m.jogadores.find(o => o.time === 0);
        m.voo = { tipo: 'chute', de: atk.id, time: 0, tick0: m.tick, tickChave: m.tick };
        let r = null;
        for (let i = 0; i < 150 && !r; i++) {
          const ev = step() ?? m.eventos;
          for (const e of ev) { if (e.tipo === 'gol') r = 'gol'; else if (e.tipo === 'defesa') r = 'defesa'; }
          if (m.bola.p.x > GX + 0.3 && !r) r = 'fora';
        }
        if (r === 'gol' || r === 'defesa') { tot++; if (r === 'defesa') ok++; }
      }
      return { p: ok / Math.max(1, tot), n: tot };
    }
    let pior = 0, txt = [], somaL = 0, somaB = 0, nL = 0, nB = 0;
    for (const d of [8, 15, 22]) for (const lat of [0.5, 1.5, 2.5]) {
      const b = celula(d, lat, false, 30), l = celula(d, lat, true, 30);
      pior = Math.max(pior, Math.abs(b.p - l.p));
      somaL += l.p * l.n; somaB += b.p * b.n; nL += l.n; nB += b.n;
      txt.push(`${d}/${lat}: ${fmt(100 * l.p, 0)}×${fmt(100 * b.p, 0)}`);
    }
    console.log('canhão (Livre × partida, % de defesas por distância/lateral) — ' + txt.join(' · '));
    // (30 chutes por célula: o sorteio da defesa sozinho dá ~±12 pontos de diferença numa célula; o total, ~±4)
    const dif = Math.abs(somaL / Math.max(1, nL) - somaB / Math.max(1, nB));
    reg('F. Goleiro sozinho (Livre 1 × só o goleiro): o canhão do teste-goleiro igual ao da partida (os outros 21 parados longe)', `total ${fmt(100 * somaL / Math.max(1, nL), 0)}% × ${fmt(100 * somaB / Math.max(1, nB), 0)}% (${nL} no alvo); pior célula ±${fmt(100 * pior, 0)}`, 'total ±6 pontos, célula ±20', dif <= 0.06 && pior <= 0.20);
  }

  // ------------------------------------------------------------ G. sem impedimento, nem na IA (contrato §1; revisão de 16/10)
  // Os companheiros do condutor à frente do penúltimo adversário e da bola (+ 1 m, no campo de lá): na partida a IA os traz
  // de volta para a linha (voltando a > 1,5 m/s ~36% do tempo); no Livre ninguém volta por isso e o passe para eles sai.
  // Antes da correção a linha da IA só mudava com menos de 2 adversários: no Livre 11 × 11 eles voltavam ~40% do tempo
  // (6 sementes × 2 min), mais que na partida, e quase não recebiam o passe (1,3% dos passes)
  {
    const NG = 3, SG = 60;
    let n = 0, volta = 0, passes = 0, passesImp = 0, erroG = null;
    try {
      for (let sem = 1; sem <= NG; sem++) {
        const m = criarLivre({ semente: sem, linha: [10, 10], goleiro: [true, true] });
        for (let i = 0; i < seg(SG); i++) {
          const vooAntes = m.voo;
          passoLivre(m, entradaDemoLivre(m), null);
          const imped = t => {
            const lado = m.ataca[t];
            let u1 = -Infinity, u2 = -Infinity;
            for (const o of m.jogadores) { if (o.time === t) continue; const u = o.x * lado; if (u > u1) { u2 = u1; u1 = u; } else if (u > u2) u2 = u; }
            const lin = Math.max(u2, m.bola.p.x * lado, 0) + 1;
            return m.jogadores.filter(o => o.time === t && ehLinha(o) && o.x * lado > lin);
          };
          const v = m.voo;
          if (v && v !== vooAntes && v.para != null && ['passe', 'enfiada', 'lancamento', 'enfiadaAlta', 'cruzamento'].includes(v.tipo)) {
            passes++;
            if (imped(v.time).some(o => o.id === v.para)) passesImp++;
          }
          const c = m.posse != null ? jogadorPorId(m, m.posse) : null;
          if (m.partida.estado !== 'jogo' || m.parada || !c || !ehLinha(c)) continue;
          for (const o of imped(c.time)) { if (o === c) continue; n++; if (o.vx * m.ataca[c.time] < -1.5) volta++; }
        }
      }
    } catch (e) { erroG = e.message; }
    const fv = volta / Math.max(1, n), fp = passesImp / Math.max(1, passes);
    reg(`G. Sem impedimento na IA (Livre 11 × 11, ${NG} × ${SG} s): quem está à frente da defesa adversária não volta por isso e recebe o passe`,
      erroG ?? `voltando ${fmt(100 * fv, 1)}% de ${n} amostras; ${passesImp}/${passes} passes para eles (${fmt(100 * fp, 1)}%)`,
      'voltando ≤ 15%, passes ≥ 2%', !erroG && n > 200 && fv <= 0.15 && fp >= 0.02);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\n${falhas} item(ns) REPROVADO(S)` : '\nTodos os itens passaram.');
process.exit(falhas ? 1 : 0);
