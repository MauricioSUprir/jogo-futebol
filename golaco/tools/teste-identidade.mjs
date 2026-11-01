// Identidade visual dos times na partida (js/identidade.js, pura; pedido do dono de 15/10: "a logo dos times, torcida,
// e estádio adaptáveis a cada time"). Em Node, sem navegador (~1 s):
//   A) o PADRÃO (sem ?tm) é exatamente o de hoje: as constantes de cada módulo do desenho (KITS, paletas e mosaico da
//      torcida, cachecóis, faixas, placas, cadeiras, bandeira de escanteio, fachada, nome do estádio, cores do HUD) — e a
//      torcida gerada com as paletas padrão é BIT A BIT a de hoje;
//   B) a conta de cor: ΔE₀₀ (CIEDE2000) nos pares publicados por Sharma, Wu e Dalal (2005), CIELAB ida e volta;
//   C) pedidos do Total Match (formato v2 do contrato, times montados como o tm3d.js monta), com os casos difíceis: dois
//      times vermelhos, time azul contra o árbitro azul, preto-e-branco contra branco-e-preto, os 3 uniformes iguais,
//      uniforme escolhido que confunde, time sem identidade nem uniformes, jogo neutro com público baixo — uniformes sem
//      confusão (ΔE₀₀ mínimos), paletas ≥ 10 cores com neutros, faixas com os nomes (9 e 11 do visitante, letra legível),
//      placas, estádio, cores do HUD (contraste, longe do branco da bola e do outro time), escudo de reserva, público;
//   D) a torcida com as paletas do TM: os MESMOS lugares, só as camisas mudam; o público tira gente; jogo neutro mistura;
//   E) o estádio de cada clube (contrato de 15/10): edição pública, jogo neutro e estádio fora da base → o Estádio Golaço de
//      hoje com o nome "Estádio Total Match" e o mosaico "TOTAL MATCH" (cores PADRÃO); edição pro com o estádio achado na
//      base (assets/tm/estadios.json) → o nome real e as cores/estilo/cobertura/cadeiras do arquivo; a normalização do
//      nome (a chave da base); a base no formato; mandante de camisa verde na pública (só a camisa do mosaico da torcida
//      muda); estádios de mesmo nome (`homonimos`: o do clube mandante); os trechos da cobertura (só se tiram pedaços do anel).
//   node tools/teste-identidade.mjs [--js <pasta js>] [--base <estadios.json>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href).catch(() => null);
const fonte = f => { try { return fs.readFileSync(path.join(pastaJs, f), 'utf8'); } catch (_) { return ''; } };

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** O literal (objeto/array) que vem depois de `marca` no código-fonte (contando chaves/colchetes). */
function literal(src, marca) {
  const i = src.indexOf(marca);
  if (i < 0) return null;
  let j = i + marca.length;
  while (j < src.length && src[j] !== '{' && src[j] !== '[') j++;
  const abre = src[j], fecha = abre === '{' ? '}' : ']';
  let n = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === abre) n++; else if (src[k] === fecha && --n === 0) break; }
  try { return Function('return (' + src.slice(j, k + 1) + ')')(); } catch (_) { return null; }
}

const I = await imp('identidade.js');
const TD = await imp('render/torcida-dados.js');
const BD = await imp('render/bandeiras-dados.js');
const EF = await imp('estadio-forma.js');
if (!I) reg('identidade visual dos times (js/identidade.js)', 'não existe (Golaço FC × Ventania FC fixos)', 'existe', false);

if (I) {
  const P = I.IDENTIDADE_PADRAO;
  // ---------------------------------------------------------------- A) padrão = hoje
  {
    const src = fonte('render/jogador3d.js');
    const kits = literal(src, 'export const KITS =');
    const ok = kits && ['linha0', 'goleiro0', 'linha1', 'goleiro1', 'arbitro'].every(k => igual(kits[k], P.kits[k]));
    reg('A1 padrão: uniformes = KITS de hoje (render/jogador3d.js)', ok ? '5 de 5 iguais' : 'diferentes', 'iguais', !!ok);
  }
  {
    const src = fonte('render/torcida-dados.js');
    const casa = literal(src, 'const CASA_CAMISA ='), fora = literal(src, 'const FORA_CAMISA =');
    const ok = igual(casa, P.torcida.casa) && igual(fora, P.torcida.fora) && TD && TD.VERDE_MOSAICO === P.torcida.mosaico;
    const st = fonte('render/torcida.js');
    const ac = /uAcento0: \{ value: new THREE\.Color\(0x([0-9a-f]{6})\) \}, uAcento1: \{ value: new THREE\.Color\(0x([0-9a-f]{6})\)/.exec(st);
    const okAc = ac && ('#' + ac[1]) === P.torcida.acentos[0] && ('#' + ac[2]) === P.torcida.acentos[1];
    reg('A2 padrão: camisas da torcida, mosaico e cachecóis = os de hoje', `paletas ${ok ? 'iguais' : 'diferentes'}, cachecóis ${okAc ? 'iguais' : 'diferentes'}`, 'iguais', !!ok && !!okAc);
  }
  if (BD) {
    const ok = igual(BD.TEXTOS_FAIXAS, P.faixas) && igual(BD.faixas(P.faixas), BD.faixas());
    reg('A3 padrão: as 12 faixas = as de hoje (bandeiras-dados.js)', ok ? '12 de 12 iguais' : 'diferentes', 'iguais', ok);
  }
  {
    const src = fonte('render/texturas.js');
    const pain = literal(src, 'const PAINEIS =');
    const okP = igual(pain, P.paineis);
    // (item 69: as cores das cadeiras moraram para o pintor da grade, render/cadeiras-dados.js pintorGolaco)
    let srcCad = '';
    try { srcCad = fonte('render/cadeiras-dados.js'); } catch (_) { srcCad = ''; }
    const okArq = ["'#12a95c'", "'#0d8447'", "'#2a3033'", "'#0f5233'", "'#14181a'"].every(c => src.includes(c) || srcCad.includes(c))
      && P.arquibancada.friso === '#12a95c' && P.arquibancada.mosaico === '#0d8447' && P.arquibancada.tom === '#2a3033' && P.arquibancada.tom2 === '#0f5233' && P.arquibancada.cadeira === '#14181a';
    const okEsc = /cores\?\.fundo \?\? '#19e07a'/.test(src) && /cores\?\.faixa \?\? '#07090a'/.test(src) && P.escanteio.fundo === '#19e07a' && P.escanteio.faixa === '#07090a';
    reg('A4 padrão: placas, cadeiras/friso/mosaico e bandeira de escanteio = os de hoje', `placas ${okP ? 'iguais' : 'diferentes'} · cadeiras ${okArq ? 'iguais' : 'diferentes'} · escanteio ${okEsc ? 'igual' : 'diferente'}`, 'iguais', okP && okArq && okEsc);
  }
  {
    const srcF = fonte('render/estadio-fora.js');
    const fach = literal(srcF, 'const FACHADA_PADRAO =');
    const okF = fach && Object.keys(fach).every(k => fach[k] === P.fachada[k]);
    const okE = EF && EF.FORA.placa.texto === P.estadio.placa;
    reg('A5 padrão: fachada/cobertura/túnel e o nome do estádio = os de hoje', `fachada ${okF ? 'igual' : 'diferente'} · placa "${EF?.FORA.placa.texto}"`, 'iguais', !!okF && !!okE);
  }
  {
    const hud = literal(fonte('hud.js'), 'const COR_MAPA =');
    const cor = literal(fonte('main.js'), 'const COR_TIME =');
    const okH = hud && Object.keys(hud).every(k => hud[k] === P.hud.mapa[k]);
    const okC = igual(cor, P.hud.faixa);
    reg('A6 padrão: minimapa e faixa ENTRA/SAI = os de hoje (hud.js, main.js)', `minimapa ${okH ? 'igual' : 'diferente'} · faixa ${okC ? 'igual' : 'diferente'}`, 'iguais', !!okH && okC);
  }
  {
    // nomes e siglas do padrão = os do elenco (Golaço FC e Ventania FC)
    const EL = await imp('elenco.js');
    const okNomes = !EL || (['golaco', 'ventania'].every((k, t) => EL.ELENCOS[k]?.nome === P.times[t].nome && EL.ELENCOS[k]?.sigla === P.times[t].sigla));
    const ok = okNomes && P.tm === false && Object.isFrozen(P) && Object.isFrozen(P.kits.linha0) && igual(I.extrasPlacar(P, 0), {}) && igual(I.extrasPlacar(P, 1), {});
    reg('A7 padrão: nomes/siglas do elenco, não é do TM, congelada e o placar sem nada a mais', ok ? 'Golaço FC/GLÇ × Ventania FC/VNT, tm falso, congelada, extras {}' : 'não', 'sim', ok);
  }
  if (TD) {
    // a torcida com as paletas padrão passadas explicitamente = a de hoje, byte a byte
    const nA = Math.round(TD.ARQUIBANCADA.comprimento / TD.ARQUIBANCADA.assento);
    const masc = new Uint8Array(nA * TD.ARQUIBANCADA.fileiras);
    for (let f = 26; f < 34; f++) for (let a = 70; a < 180; a++) masc[a + f * nA] = 1;
    const hoje = TD.gerarTorcidaNiveis(masc);
    const comPadrao = TD.gerarTorcidaNiveis(masc, { ...P.torcida, publico: P.publico });
    const campos = ['pos', 'camisa', 'pele', 'cabelo', 'info', 'nivel'];
    const ok = hoje.n === comPadrao.n && campos.every(c => Buffer.compare(Buffer.from(hoje[c].buffer), Buffer.from(comPadrao[c].buffer)) === 0);
    reg('A8 padrão: torcida com as paletas padrão = a de hoje (byte a byte)', `${hoje.n} torcedores, ${ok ? 'iguais' : 'DIFERENTES'}`, 'iguais', ok);
  }

  // ---------------------------------------------------------------- B) conta de cor
  {
    const pares = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 0, 0], [50, -1, 2], 2.3669], [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381], [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
    ];
    const err = Math.max(...pares.map(([a, b, e]) => Math.abs(I.deltaE2000(a, b) - e)));
    const ida = ['#19e07a', '#c52613', '#1144dd', '#ffffff', '#07090a', '#ffd200'].every(h => I.deLab(I.lab(h)) === h);
    reg('B1 ΔE₀₀ (CIEDE2000) nos pares de Sharma et al. e CIELAB ida e volta', `erro máx. ${err.toExponential(1)} · ida e volta ${ida ? 'exata' : 'errada'}`, '≤ 1e-4 · exata', err <= 1e-4 && ida);
  }

  // ---------------------------------------------------------------- C) pedidos do Total Match
  // uniforme no formato do TM (tm3d.js kit): {shirt, sleeves, shorts, socks, pattern, second, trim, number, collar, ...}
  const kit = (shirt, second, pattern = 'plain', shorts = null, sleeves = null) => ({ shirt, sleeves: sleeves ?? shirt, shorts: shorts ?? second, socks: shirt, pattern, second, trim: second, number: second, collar: 'crew', sponsor: 'TOTAL MATCH', sponsorColor: second });
  const gk = c => kit(c, '#111111', 'plain', c);
  const time = (o) => ({
    id: 'tm_' + o.short, name: o.name, short: o.short, stadium: o.stadium ?? null, formation: '4-4-2', formacaoTM: '4-4-2', rating: 75,
    colors: { primary: o.c1, secondary: o.c2 }, kits: o.kits, kitEscolhido: o.esc ?? null, players: [],
    identidade: o.identidade ?? { escudo: o.escudo ?? null, escudoTipo: o.escudo ? 'real' : null, bandeira: null, pais: '', liga: '', tecnico: '', estadio: o.estadioObj ?? null },
  });
  const ped = (home, away, partida = {}) => ({ v: 2, id: 't', titulo: 'teste', origem: 'teste', userSide: 'home', controle: null, partida: { neutro: false, publico: 1, classico: false, nomeClassico: null, competicao: 'Liga Teste', ...partida }, home, away });
  const FLA = time({ name: 'Rubro-Negro FC', short: 'RNF', c1: '#c52613', c2: '#111111', stadium: 'Estádio do Povo', escudo: 'https://exemplo.invalido/rnf.png',
    kits: { home: kit('#c52613', '#111111', 'halves'), away: kit('#ffffff', '#c52613'), third: kit('#111111', '#c52613'), gk: gk('#c9e83a'), gkAway: gk('#6b6f7a') } });
  const BRA = time({ name: 'Touro Vermelho', short: 'TVE', c1: '#d2023d', c2: '#ffffff',
    kits: { home: kit('#d2023d', '#ffffff', 'sash'), away: kit('#ffffff', '#d2023d', 'hoops'), third: kit('#111111', '#d2023d'), gk: gk('#f5a524'), gkAway: gk('#3a7bd5') } });
  const AZUL = time({ name: 'Azulão do Vale', short: 'AZV', c1: '#2459d6', c2: '#ffffff', estadioObj: { nome: 'Arena do Vale', capacidade: 30000, foto: null },
    kits: { home: kit('#2459d6', '#ffffff'), away: kit('#ffffff', '#2459d6'), third: kit('#0d1b3e', '#ffffff'), gk: gk('#2a9d5c'), gkAway: gk('#c9e83a') } });
  const AMARELO = time({ name: 'Canarinho EC', short: 'CAN', c1: '#ffd200', c2: '#0033a0',
    kits: { home: kit('#ffd200', '#0033a0'), away: kit('#0033a0', '#ffd200'), third: kit('#ffffff', '#0033a0'), gk: gk('#2459d6'), gkAway: gk('#111111') } });
  const PB = time({ name: 'Estrela Solitária', short: 'EST', c1: '#111111', c2: '#ffffff',
    kits: { home: kit('#111111', '#ffffff', 'stripes'), away: kit('#ffffff', '#111111'), third: kit('#6b6f7a', '#111111'), gk: gk('#c9e83a'), gkAway: gk('#f5a524') } });
  const BP = time({ name: 'Alvinegro Paulista', short: 'ALV', c1: '#ffffff', c2: '#111111',
    kits: { home: kit('#ffffff', '#111111'), away: kit('#111111', '#ffffff'), third: kit('#8a8f96', '#111111'), gk: gk('#111111'), gkAway: gk('#f5a524') } });
  const TODOS_VERM = (nome, s, c) => time({ name: nome, short: s, c1: c, c2: c, kits: { home: kit(c, c), away: kit(c, c), third: kit(c, c), gk: gk('#c9e83a'), gkAway: gk('#c9e83a') } });
  const SEM = { id: 'tm_draft', name: 'Draft dos Sonhos', short: '', colors: { primary: '#6a4c93' }, players: [], identidade: { escudo: null, escudoTipo: null, bandeira: null, pais: '', liga: '', tecnico: '', estadio: null } };
  const CASOS = [
    { nome: 'dois vermelhos (metades × faixa)', p: ped(FLA, BRA), linha: 25 },
    { nome: 'azul contra o árbitro azul', p: ped(AZUL, AMARELO), linha: 25, arbNaoAzul: true },
    { nome: 'preto-e-branco × branco-e-preto', p: ped(PB, BP), linha: 25 },
    { nome: 'os 3 uniformes iguais (vermelho × vermelho): o de reserva', p: ped(TODOS_VERM('Vermelho A', 'VMA', '#c8102e'), TODOS_VERM('Vermelho B', 'VMB', '#d0202a')), linha: 25, foraFixo: 'reserva' },
    { nome: 'visitante escolheu um uniforme que confunde', p: ped(FLA, { ...BRA, kitEscolhido: 0 }), linha: 25, foraFixo: 'home' },
    { nome: 'time sem identidade nem uniformes (Draft)', p: ped(SEM, AZUL), linha: 25 },
    { nome: 'jogo neutro, público baixo', p: ped(AZUL, FLA, { neutro: true, publico: 0.05 }), linha: 25, neutro: true },
  ];
  const hex = h => /^#[0-9a-f]{6}$/.test(h);
  const todasCores = o => {
    const l = [];
    (function vai(x) { if (typeof x === 'string' && x[0] === '#') l.push(x); else if (x && typeof x === 'object') for (const v of Object.values(x)) vai(v); })(o);
    return l;
  };
  const resumo = [];
  for (const c of CASOS) {
    let id = null, erro = null;
    try { id = I.identidadeDoPedido(c.p); } catch (e) { erro = e; }
    if (!id) { reg(`C ${c.nome}: monta a identidade`, String(erro), 'sem erro', false); continue; }
    const k = id.kits;
    const dl = I.deltaCamisas(k.linha0, k.linha1);
    const dg = Math.min(I.deltaCamisas(k.goleiro0, k.linha0), I.deltaCamisas(k.goleiro0, k.linha1), I.deltaCamisas(k.goleiro1, k.linha0), I.deltaCamisas(k.goleiro1, k.linha1), I.deltaCamisas(k.goleiro0, k.goleiro1));
    const da = Math.min(...[k.linha0, k.linha1, k.goleiro0, k.goleiro1].map(x => I.deltaCamisas(k.arbitro, x)));
    // o melhor par possível entre os uniformes de linha dos dois (para o caso em que nenhum passa)
    const ops = t => ['home', 'away', 'third'].map(x => t.kits?.[x]).filter(Boolean).map(x => I.kitDoTM(x));
    let melhorPar = 0;
    for (const a of ops(c.p.home)) for (const b of ops(c.p.away)) melhorPar = Math.max(melhorPar, I.deltaCamisas(a, b));
    const metaL = c.linha ?? Math.min(I.LIMIAR.linha, melhorPar - 1e-6);
    const okL = dl >= metaL - 1e-9;
    const okFixo = !c.foraFixo || id.uniformes.escolha.fora === c.foraFixo;
    reg(`C ${c.nome}: uniformes de linha sem confusão`, `ΔE₀₀ ${fmt(dl, 1)} (${id.uniformes.escolha.casa} × ${id.uniformes.escolha.fora}; melhor possível ${fmt(melhorPar, 1)})`, `≥ ${fmt(metaL, 1)}${c.foraFixo ? ' · visitante no escolhido' : ''}`, okL && okFixo);
    reg(`C ${c.nome}: goleiros e árbitro longe`, `goleiros ${fmt(dg, 1)} · árbitro ${fmt(da, 1)} (${k.arbitro.camisa})`, `≥ ${I.LIMIAR.goleiro} · ≥ ${I.LIMIAR.arbitro}${c.arbNaoAzul ? ' · árbitro não azul' : ''}`,
      dg >= I.LIMIAR.goleiro && da >= I.LIMIAR.arbitro && (!c.arbNaoAzul || I.deltaE(k.arbitro.camisa, '#2459d6') >= 15));
    // paletas da torcida (≥ 10 cores, com neutros) e cachecóis
    const neutros = l => l.filter(([h]) => I.croma(h) < 12).length;
    const okPal = [id.torcida.casa, id.torcida.fora].every(l => l.length >= 10 && neutros(l) >= 3 && l.every(([h, p]) => hex(h) && p > 0));
    reg(`C ${c.nome}: paletas da torcida`, `casa ${id.torcida.casa.length} cores (${neutros(id.torcida.casa)} neutras) · fora ${id.torcida.fora.length} (${neutros(id.torcida.fora)})`, '≥ 10 cores, ≥ 3 neutras', okPal);
    // faixas: 12, nome do visitante só em 9 e 11, o do mandante em alguma das outras; letra legível
    const nomeCasa = I.nomeCurto(c.p.home, 14), sigCasa = id.times[0].sigla, nomeFora = I.nomeCurto(c.p.away, 14);
    const fx = id.faixas;
    const comFora = fx.map((f, i) => (f[0].includes(nomeFora) ? i : -1)).filter(i => i >= 0);
    const comCasa = fx.map((f, i) => (f[0].includes(nomeCasa) || f[0].includes(sigCasa) ? i : -1)).filter(i => i >= 0);
    const contrMin = Math.min(...fx.map(f => I.contraste(f[1], f[2])));
    const setores = BD ? BD.faixas(fx).map(f => f.setor) : null;
    const okFx = fx.length === 12 && igual(comFora, [9, 11]) && comCasa.length >= 5 && comCasa.every(i => i !== 9 && i !== 11) && contrMin >= 3 && (!setores || (setores[9] === 2 && setores[11] === 2));
    reg(`C ${c.nome}: faixas com os nomes`, `12 · visitante em [${comFora}] · mandante em ${comCasa.length} · contraste mín. ${fmt(contrMin, 1)}:1`, 'visitante só em 9 e 11 (setor dele) · mandante ≥ 5 · ≥ 3:1', okFx);
    // placas, estádio e mosaico
    const pn = id.paineis;
    const okPn = pn.length === 4 && pn[0].texto === 'TOTAL MATCH' && (c.neutro ? !pn.some(x => x.detalhe === 'escudo') : pn.some(x => x.detalhe === 'escudo') && pn.some(x => x.texto === nomeCasa));
    // (pedidos sem `edicao` = edição pública: o Estádio Total Match; o estádio real é a seção E)
    const okEst = I.ESTADIO_TM ? id.estadio.nome === I.ESTADIO_TM.nome && id.estadio.real === false : id.estadio.nome.length > 0;
    reg(`C ${c.nome}: placas, estádio e mosaico`, `placas ${pn.map(x => x.texto).join(' | ')} · estádio "${id.estadio.nome}" · mosaico "${id.mosaico.texto}"`, c.neutro ? 'TOTAL MATCH + neutras · Estádio Total Match' : 'TOTAL MATCH + mandante + escudo · Estádio Total Match (pública)', okPn && okEst && id.mosaico.texto.length > 0);
    // HUD
    const m = id.hud.mapa, FUNDO_MAPA = '#061a0f', FUNDO_HUD = '#0b1012';
    const okMapa = ['t0', 't1', 't0gol', 't1gol'].every(x => I.deltaE(m[x], '#ffffff') >= 22 && I.contraste(m[x], FUNDO_MAPA) >= 3)
      && I.deltaE(m.t0, m.t1) >= 25 && Math.min(I.deltaE(m.t0gol, m.t0), I.deltaE(m.t0gol, m.t1), I.deltaE(m.t1gol, m.t0), I.deltaE(m.t1gol, m.t1), I.deltaE(m.t0gol, m.t1gol)) >= 18;
    const okPl = id.hud.placar.every(h => I.contraste(h, FUNDO_HUD) >= 3) && I.deltaE(id.hud.placar[0], id.hud.placar[1]) >= 15
      && id.hud.faixa.every(f => I.contraste(f.cor, f.texto) >= 4);
    reg(`C ${c.nome}: cores do HUD`, `mapa ${m.t0}/${m.t1} (bola ${fmt(Math.min(I.deltaE(m.t0, '#ffffff'), I.deltaE(m.t1, '#ffffff')), 0)}, entre ${fmt(I.deltaE(m.t0, m.t1), 0)}) · placar ${id.hud.placar.join('/')}`, 'longe da bola ≥ 22 e do outro ≥ 25 · contraste ≥ 3 · faixa ≥ 4:1', okMapa && okPl);
    // escudo (url ou o de reserva), público, cores válidas
    const okEsc = id.times.every(T => T.escudo.url && T.escudo.gerado.startsWith('data:image/svg+xml') && decodeURIComponent(T.escudo.gerado).includes(`>${T.sigla}<`));
    const okPub = c.neutro ? id.publico === 0.1 && id.torcida.foraLados > 0.3 : id.publico === 1 && id.torcida.foraLados === 0.03;
    const cores = todasCores({ kits: id.kits, torcida: id.torcida, faixas: id.faixas, paineis: id.paineis, arquibancada: id.arquibancada, escanteio: id.escanteio, fachada: id.fachada, hud: id.hud });
    reg(`C ${c.nome}: escudo, público e cores válidas`, `escudos ${id.times.map(T => (T.escudo.url === T.escudo.gerado ? 'reserva' : 'TM')).join('/')} · público ${id.publico} · ${cores.length} cores ${cores.every(hex) ? 'válidas' : 'INVÁLIDAS'}`, 'url + reserva com a sigla · público 0,1–1 · #rrggbb', okEsc && okPub && cores.every(hex));
    resumo.push(`${c.nome}: ${k.linha0.camisa}/${k.linha0.padrao} × ${k.linha1.camisa}/${k.linha1.padrao} · gol ${k.goleiro0.camisa} ${k.goleiro1.camisa} · árb ${k.arbitro.camisa}`);
  }
  // o mesmo pedido → a mesma identidade (sem sorteio no relógio)
  {
    const a = I.identidadeDoPedido(CASOS[0].p), b = I.identidadeDoPedido(JSON.parse(JSON.stringify(CASOS[0].p)));
    reg('C determinismo: mesmo pedido → mesma identidade', igual(a, b) ? 'iguais' : 'diferentes', 'iguais', igual(a, b));
  }
  // pedido quebrado (sem times, cores inválidas): nunca falha
  {
    let ok = true;
    for (const p of [{}, { home: {}, away: {} }, { home: { colors: { primary: 'vermelho' }, kits: { home: { shirt: 'xyz' } } }, away: null }]) {
      try { const id = I.identidadeDoPedido(p); if (!id.tm || !todasCores(id.kits).every(hex)) ok = false; } catch (_) { ok = false; }
    }
    reg('C pedido incompleto ou com cores inválidas: usa a reserva', ok ? 'sem erro, cores válidas' : 'falhou', 'sem erro', ok);
  }

  // ---------------------------------------------------------------- D) torcida do TM: mesmos lugares, outras camisas
  if (TD) {
    const id = I.identidadeDoPedido(CASOS[0].p);
    const base = TD.gerarTorcidaNiveis(null);
    const tm = TD.gerarTorcidaNiveis(null, { ...id.torcida, publico: 1 });
    const mesmosLugares = base.n === tm.n && Buffer.compare(Buffer.from(base.pos.buffer), Buffer.from(tm.pos.buffer)) === 0 && Buffer.compare(Buffer.from(base.nivel.buffer), Buffer.from(tm.nivel.buffer)) === 0;
    let mudou = 0, casaOk = 0, nCasa = 0;
    const pal = new Set(id.torcida.casa.map(([h]) => h));
    for (let i = 0; i < tm.n; i++) {
      const h = '#' + [0, 1, 2].map(j => tm.camisa[4 * i + j].toString(16).padStart(2, '0')).join('');
      if (h !== '#' + [0, 1, 2].map(j => base.camisa[4 * i + j].toString(16).padStart(2, '0')).join('')) mudou++;
      if (tm.info[4 * i] === 0) { nCasa++; if (pal.has(h)) casaOk++; }
    }
    reg('D1 torcida do TM: os mesmos lugares, as camisas do mandante', `${tm.n} lugares ${mesmosLugares ? 'iguais' : 'DIFERENTES'} · ${fmt(100 * mudou / tm.n, 0)}% das camisas mudaram · ${fmt(100 * casaOk / nCasa, 1)}% da casa na paleta dele`, 'iguais · > 50% · 100%', mesmosLugares && mudou / tm.n > 0.5 && casaOk === nCasa);
    const meio = TD.gerarTorcidaNiveis(null, { ...id.torcida, publico: 0.5 });
    const q = d => TD.quantosNoSetor(d, 0, 'alta');
    const fr = q(meio) / q(base);
    reg('D2 público do TM (0,5): menos gente nas mesmas cadeiras', `${q(meio)} de ${q(base)} no lado de lá (${fmt(100 * fr, 0)}%)`, '40–60%', fr >= 0.4 && fr <= 0.6);
    const idN = I.identidadeDoPedido(CASOS[6].p);
    const neu = TD.gerarTorcidaNiveis(null, { ...idN.torcida, publico: 1 });
    const fracFora = d => { let a = 0, n = 0; for (let i = 0; i < d.n; i++) if (d.info[4 * i + 1] === 0) { n++; if (d.info[4 * i] === 255) a++; } return a / n; };
    reg('D3 jogo neutro: as duas torcidas misturadas nos lados', `visitantes no lado de lá: ${fmt(100 * fracFora(base), 1)}% (hoje) → ${fmt(100 * fracFora(neu), 1)}% (neutro)`, 'hoje ≤ 5% · neutro 35–55%', fracFora(base) <= 0.05 && fracFora(neu) >= 0.35 && fracFora(neu) <= 0.55);
  }
  if (args.includes('--resumo')) console.log(resumo.join('\n') + '\n');

  // ---------------------------------------------------------------- E) o estádio de cada clube (Total Match, 15/10)
  if (!I.ESTADIO_TM || !I.normalizarNomeEstadio) reg('E estádio de cada clube (ESTADIO_TM, normalizarNomeEstadio, base)', 'não existe (o estádio do mandante pelas cores dele)', 'existe', false);
  else {
    const arqBase = args.includes('--base') ? path.resolve(args[args.indexOf('--base') + 1]) : path.resolve(pastaJs, '../assets/tm/estadios.json');
    let BASE = null, erroBase = null;
    try { BASE = JSON.parse(fs.readFileSync(arqBase, 'utf8')); } catch (e) { erroBase = e.message; }
    const ESTILOS = ['vidro', 'concreto', 'metal', 'membrana', 'tijolo', 'trelica', 'paineis'], COB = ['total', 'lados', 'parcial', 'nenhuma'], PAD = ['liso', 'misto', 'faixas', 'mosaico', 'setores', 'raios'];
    const hexN = v => v === null || hex(v);
    // E1 a base no formato do contrato: {versao: 1, estadios: {"<nome normalizado>": Estadio}}, chave = normalizar(nome)
    {
      const ents = BASE && BASE.estadios && typeof BASE.estadios === 'object' ? Object.entries(BASE.estadios) : [];
      const ruins = [];
      for (const [k, e] of ents) {
        const pb = [];
        if (k !== I.normalizarNomeEstadio(k) || k !== I.normalizarNomeEstadio(e.nome)) pb.push('chave');
        if (!ESTILOS.includes(e.fachada_estilo)) pb.push('estilo');
        if (!hex(e.fachada_cor) || !hex(e.fachada_cor2) || !hexN(e.fachada_led) || !hex(e.cobertura_cor) || !hex(e.cadeiras_cor) || !hexN(e.cadeiras_cor2)) pb.push('cor');
        if (!COB.includes(e.cobertura)) pb.push('cobertura');
        if (!PAD.includes(e.cadeiras_padrao)) pb.push('padrão');
        if (!(Number.isInteger(e.aneis) && e.aneis >= 1 && e.aneis <= 3)) pb.push('anéis');
        // (os campos que o desenho não usa — cidade, marca, confiança, fontes — podem faltar; se vierem, no formato)
        if ((e.confianca != null && !['alta', 'media', 'baixa'].includes(e.confianca)) || (e.cidade != null && typeof e.cidade !== 'string') || (e.marca != null && typeof e.marca !== 'string') || (e.fontes != null && !Array.isArray(e.fontes))) pb.push('campos');
        if (pb.length) ruins.push(`${k}: ${pb.join(', ')}`);
      }
      const estilos = new Set(ents.map(([, e]) => e.fachada_estilo)), coberturas = new Set(ents.map(([, e]) => e.cobertura));
      reg('E1 base dos estádios (assets/tm/estadios.json) no formato do contrato', erroBase ? `não abriu: ${erroBase}` : `versão ${BASE.versao} · ${ents.length} estádios · ${estilos.size} estilos · ${coberturas.size} coberturas${ruins.length ? ' · fora do formato: ' + ruins.slice(0, 4).join('; ') : ''}`,
        'versão 1 · ≥ 4 estádios · chave = nome normalizado · cores #rrggbb · escolhas das listas', !erroBase && BASE.versao === 1 && ents.length >= 4 && ruins.length === 0);
    }
    // E2 normalização do nome (a chave da base): minúsculas, sem acento, só letras/números e espaço simples
    {
      const casos = [['Maracanã', 'maracana'], ['Estádio Nabi Abi Chedid', 'estadio nabi abi chedid'], ['  Beira-Rio ', 'beira rio'], ['Diyarbakır Stadium', 'diyarbakir stadium'],
        ["St. James' Park", 'st james park'], ['1º de Maio', '1o de maio'], ['MAC³PARK Stadion', 'mac3park stadion'], ['Cetilar® Arena', 'cetilar arena'], ['Estadio Municipal El Molinón – Enrique Castro "Quini"', 'estadio municipal el molinon enrique castro quini'],
        ['Weserstadion  BREMEN', 'weserstadion bremen'], ['Stadion Miejski (Łódź)', 'stadion miejski lodz'], [null, ''], [undefined, '']];
      const errados = casos.filter(([a, b]) => I.normalizarNomeEstadio(a) !== b);
      const idem = casos.every(([a]) => I.normalizarNomeEstadio(I.normalizarNomeEstadio(a)) === I.normalizarNomeEstadio(a));
      reg('E2 nome normalizado (chave da base)', errados.length ? errados.map(([a, b]) => `"${a}" → "${I.normalizarNomeEstadio(a)}" (esperado "${b}")`).join('; ') : `${casos.length} de ${casos.length} certos · idempotente ${idem ? 'sim' : 'não'}`, 'todos certos · idempotente', !errados.length && idem);
    }
    // pedidos: o mandante com o estádio da base (pelo identidade.estadio.nome e, sem ele, pelo stadium)
    const BASE_T = { versao: 1, estadios: {
      'arena do vale': { nome: 'Arena do Vale', cidade: 'Vale', fachada_estilo: 'membrana', fachada_cor: '#e7ecef', fachada_cor2: '#8a949a', fachada_led: '#e2231a', cobertura: 'lados', cobertura_cor: '#f4f6f6', cadeiras_cor: '#c8102e', cadeiras_cor2: '#f2f2f2', cadeiras_padrao: 'faixas', aneis: 3, marca: 'membrana que acende', confianca: 'alta', fontes: [] },
      'estadio do povo': { nome: 'Estádio do Povo', cidade: 'Rio', fachada_estilo: 'tijolo', fachada_cor: '#8e3b2a', fachada_cor2: '#d8d0c0', fachada_led: null, cobertura: 'parcial', cobertura_cor: '#5b6166', cadeiras_cor: '#1f5fbf', cadeiras_cor2: null, cadeiras_padrao: 'mosaico', aneis: 1, marca: 'tijolo', confianca: 'media', fontes: [] },
    } };
    const comEd = (p, edicao) => ({ ...JSON.parse(JSON.stringify(p)), edicao });
    const pPub = comEd(ped(AZUL, FLA), 'public'), pPro = comEd(ped(AZUL, FLA), 'pro');
    const pProSem = comEd(ped(BRA, FLA), 'pro');                                  // mandante sem estádio na base
    const pProNeutro = comEd(ped(AZUL, FLA, { neutro: true }), 'pro');
    const pProStadium = comEd(ped(FLA, AZUL), 'pro');                             // achado pelo `stadium` ("Estádio do Povo")
    const P = I.IDENTIDADE_PADRAO;
    // E3 pública: o Estádio Golaço de hoje com o nome "Estádio Total Match" (mesmo com a base na mão)
    {
      const id = I.identidadeDoPedido(pPub, BASE_T), id0 = I.identidadeDoPedido(pPub);
      const okNome = id.estadio.nome === 'Estádio Total Match' && id.estadio.placa === 'ESTÁDIO TOTAL MATCH' && id.mosaico.texto === 'TOTAL MATCH' && !id.estadio.real && id.estadio.motivo === 'publica';
      const okCores = igual(id.fachada, { ...P.fachada }) && igual(id.arquibancada, { ...P.arquibancada }) && igual(id0.fachada, id.fachada) && igual(id0.arquibancada, id.arquibancada);
      const okTimes = id.paineis[0].texto === 'TOTAL MATCH' && id.torcida.casa.length >= 10 && id.faixas.some(f => f[0].includes(id.times[0].sigla) || f[0].includes(I.nomeCurto(AZUL, 14)));
      reg('E3 pública: "Estádio Total Match" com as cores PADRÃO do Golaço (fachada, LED, cobertura, cadeiras, friso)', `"${id.estadio.nome}" · placa "${id.estadio.placa}" · mosaico "${id.mosaico.texto}" (${id.torcida.mosaico}) · fachada ${okCores ? '= padrão' : 'DIFERENTE'} · times ${okTimes ? 'pelos times' : 'não'}`,
        'nome/placa/mosaico do TM · cores = padrão · torcida, faixas e placas pelos times', okNome && okCores && okTimes);
    }
    // E3b pública com o mandante de camisa VERDE (a torcida inteira verde: o mosaico verde sumiria): o estádio continua o
    // de hoje bit a bit (fachada, cadeiras, friso e as cadeiras do mosaico em #0d8447); só a camisa de quem está no mosaico
    // da torcida vai para o branco (#f2f4f3). Com o mandante azul (E3), o verde do Golaço (#19e07a).
    {
      const VERDE = time({ name: 'Verdão do Litoral', short: 'VDL', c1: '#009c3b', c2: '#ffdf00',
        kits: { home: kit('#009c3b', '#ffdf00'), away: kit('#ffffff', '#009c3b'), third: kit('#0b3d2a', '#ffdf00'), gk: gk('#2459d6'), gkAway: gk('#111111') } });
      const casos = [['pública', I.identidadeDoPedido(comEd(ped(VERDE, FLA), 'public'), BASE_T)], ['pro sem o estádio', I.identidadeDoPedido(comEd(ped(VERDE, FLA), 'pro'), BASE_T)]];
      const ruins = casos.filter(([, id]) => !(id.estadio.nome === 'Estádio Total Match' && igual(id.fachada, { ...P.fachada }) && igual(id.arquibancada, { ...P.arquibancada }) && id.arquibancada.mosaico === '#0d8447' && id.torcida.mosaico === '#f2f4f3' && id.mosaico.texto === 'TOTAL MATCH'));
      const azul = I.identidadeDoPedido(pPub, BASE_T).torcida.mosaico;
      reg('E3b pública com mandante VERDE: estádio PADRÃO bit a bit (cadeiras do mosaico #0d8447); a torcida do mosaico em branco', `${casos.map(([n, id]) => `${n}: cadeiras do mosaico ${id.arquibancada.mosaico}, torcida do mosaico ${id.torcida.mosaico}, estádio ${igual(id.fachada, { ...P.fachada }) && igual(id.arquibancada, { ...P.arquibancada }) ? '= padrão' : 'DIFERENTE'}`).join(' · ')} · mandante azul: torcida ${azul}`,
        'cadeiras #0d8447 e o resto = padrão · torcida #f2f4f3 (verde) e #19e07a (azul)', ruins.length === 0 && azul === P.torcida.mosaico);
    }
    // E4 pro com o estádio achado: o nome real e as cores/estilo do arquivo
    {
      const id = I.identidadeDoPedido(pPro, BASE_T), e = BASE_T.estadios['arena do vale'];
      const f = id.fachada, a = id.arquibancada;
      const ok = id.estadio.real && id.estadio.nome === 'Arena do Vale' && id.estadio.placa === 'ARENA DO VALE' && id.estadio.chave === 'arena do vale' && id.estadio.motivo === 'real'
        && f.estilo === e.fachada_estilo && f.cor === e.fachada_cor && f.cor2 === e.fachada_cor2 && f.ledCor === e.fachada_led && f.ledNoite === e.fachada_led && f.cobertura === e.cobertura && f.coberturaCor === e.cobertura_cor && f.aneis === e.aneis
        && a.cadeira === e.cadeiras_cor && a.cadeira2 === e.cadeiras_cor2 && a.padrao === e.cadeiras_padrao && a.aneis === e.aneis && a.friso === e.fachada_cor2
        && id.mosaico.texto === I.nomeCurto(AZUL, 12) && todasCores({ f, a }).every(hex);
      const okPlaca = id.paineis.some(x => x.detalhe === 'escudo');
      reg('E4 pro com o estádio do mandante na base: o nome real e as cores, o estilo, a cobertura e as cadeiras do arquivo', `"${id.estadio.nome}" (${id.estadio.chave}) · ${f.estilo} ${f.cor}/${f.cor2} LED ${f.ledCor} · cobertura ${f.cobertura} ${f.coberturaCor} · cadeiras ${a.padrao} ${a.cadeira}/${a.cadeira2} · friso ${a.friso}`,
        'tudo do arquivo · placa com o nome real', ok && okPlaca);
      const id2 = I.identidadeDoPedido(pProStadium, BASE_T), f2 = id2.fachada, a2 = id2.arquibancada;
      const ok2 = id2.estadio.real && id2.estadio.nome === 'Estádio do Povo' && f2.estilo === 'tijolo' && f2.ledCor === null && f2.led === null && f2.cobertura === 'parcial' && a2.padrao === 'mosaico'
        && hex(a2.cadeira2) && I.deltaE(a2.cadeira2, a2.cadeira) >= 10 && I.deltaE(a2.mosaico, a2.cadeira) >= 20 && todasCores({ f2, a2 }).every(hex);
      reg('E4b pro achado pelo `stadium` (sem identidade.estadio): sem LED, 2ª cor das cadeiras e o mosaico com contraste', `"${id2.estadio.nome}" · ${f2.estilo}, LED ${f2.ledCor}, cobertura ${f2.cobertura} · cadeiras ${a2.cadeira}/${a2.cadeira2}, mosaico ${a2.mosaico}`, 'achado · ΔE₀₀ ≥ 10 (2ª cor) e ≥ 20 (mosaico)', ok2);
    }
    // E5 pro sem o estádio na base, sem a base (não carregou) ou jogo neutro → como a pública
    {
      const casos = [['sem-dado', I.identidadeDoPedido(pProSem, BASE_T)], ['sem-base', I.identidadeDoPedido(pPro, null)], ['sem-base', I.identidadeDoPedido(pPro, { versao: 1, estadios: [] })], ['neutro', I.identidadeDoPedido(pProNeutro, BASE_T)]];
      const ruins = casos.filter(([m, id]) => !(id.estadio.nome === 'Estádio Total Match' && !id.estadio.real && id.estadio.motivo === m && id.mosaico.texto === 'TOTAL MATCH' && igual(id.fachada, { ...P.fachada }) && igual(id.arquibancada, { ...P.arquibancada })));
      reg('E5 pro sem o estádio na base, sem a base ou jogo neutro: como a pública', casos.map(([m, id]) => `${m}: "${id.estadio.nome}" (${id.estadio.motivo})`).join(' · '), 'Estádio Total Match com as cores padrão', ruins.length === 0);
    }
    // E6 um estádio com campos quebrados na base: nunca falha, cores e escolhas válidas (as de reserva)
    {
      let ok = true, txt = '';
      try {
        const b = { versao: 1, estadios: { 'arena do vale': { nome: 'Arena do Vale', fachada_estilo: 'neon', fachada_cor: 'azul', fachada_cor2: 12, fachada_led: 'xyz', cobertura: 'meia', cobertura_cor: null, cadeiras_cor: '#12', cadeiras_padrao: 'xadrez', aneis: 9 } } };
        const id = I.identidadeDoPedido(pPro, b), f = id.fachada, a = id.arquibancada;
        ok = id.estadio.real && ESTILOS.includes(f.estilo) && COB.includes(f.cobertura) && PAD.includes(a.padrao) && f.aneis >= 1 && f.aneis <= 3 && f.ledCor === null && todasCores({ f, a }).every(hex);
        txt = `${f.estilo}, ${f.cobertura}, ${a.padrao}, ${f.aneis} anéis, cores ${todasCores({ f, a }).every(hex) ? 'válidas' : 'INVÁLIDAS'}`;
        // e a mesma base com um item que não é objeto: como a pública
        const id2 = I.identidadeDoPedido(pPro, { versao: 1, estadios: { 'arena do vale': 'oi' } });
        ok = ok && !id2.estadio.real;
      } catch (e) { ok = false; txt = String(e); }
      reg('E6 estádio com campos quebrados: sem erro, escolhas e cores de reserva', txt, 'sem erro · válidas', ok);
    }
    // E7 a base de verdade (o arquivo) com um pedido pro do mandante de cada estádio dela: todos achados
    if (BASE && BASE.estadios) {
      const ents = Object.values(BASE.estadios);
      const achados = ents.filter(e => { const t = time({ name: 'Mandante', short: 'MAN', c1: '#2459d6', c2: '#ffffff', estadioObj: { nome: e.nome, capacidade: 1, foto: null }, kits: AZUL.kits }); const id = I.identidadeDoPedido(comEd(ped(t, FLA), 'pro'), BASE); return id.estadio.real && id.estadio.nome === e.nome; });
      reg('E7 base do arquivo: cada estádio é achado pelo nome do pedido', `${achados.length} de ${ents.length}`, 'todos', achados.length === ents.length && ents.length > 0);
    }
    // E7b estádios de MESMO nome (base.homonimos: {"<chave>": [Estadio & {clubes: [nome do clube no TM]}]}): o do clube
    // mandante; outro clube com esse nome de estádio → estadios[chave]. Numa base de ensaio (sempre) e na do arquivo (Caxias ×
    // Montevideo City Torque no "Estádio Centenário"), cada homônimo no formato e achado pelo clube dele
    {
      const H = { ...BASE_T, homonimos: { 'arena do vale': [{ ...BASE_T.estadios['arena do vale'], cidade: 'Outra Cidade', fachada_estilo: 'tijolo', fachada_cor: '#7a2e22', clubes: ['Azulão do Vale'] }] } };
      const meu = I.identidadeDoPedido(pPro, H), outro = I.identidadeDoPedido(comEd(ped(time({ name: 'Outro Clube', short: 'OUT', c1: '#2459d6', c2: '#ffffff', stadium: 'Arena do Vale', kits: AZUL.kits }), FLA), 'pro'), H);
      const okEnsaio = meu.estadio.real && meu.estadio.dados.cidade === 'Outra Cidade' && meu.fachada.estilo === 'tijolo' && meu.fachada.cor === '#7a2e22'
        && outro.estadio.real && outro.estadio.dados.cidade === 'Vale' && outro.fachada.estilo === 'membrana';
      const txt = [`ensaio: Azulão → ${meu.estadio.dados?.cidade} (${meu.fachada.estilo}), outro clube → ${outro.estadio.dados?.cidade} (${outro.fachada.estilo})`];
      let okArq = true;
      const homs = BASE && BASE.homonimos && typeof BASE.homonimos === 'object' ? Object.entries(BASE.homonimos) : [];
      for (const [k, lista] of homs) {
        if (!Array.isArray(lista) || !BASE.estadios[k]) { okArq = false; txt.push(`${k}: fora do formato`); continue; }
        for (const h of lista) {
          const fmt = I.normalizarNomeEstadio(h.nome) === k && ESTILOS.includes(h.fachada_estilo) && COB.includes(h.cobertura) && PAD.includes(h.cadeiras_padrao) && hex(h.fachada_cor) && Array.isArray(h.clubes) && h.clubes.length > 0;
          const achados = (h.clubes || []).map(cl => I.identidadeDoPedido(comEd(ped(time({ name: cl, short: 'HOM', c1: '#2459d6', c2: '#ffffff', stadium: h.nome, kits: AZUL.kits }), FLA), 'pro'), BASE));
          const ok = fmt && achados.length > 0 && achados.every(id => id.estadio.real && id.estadio.nome === h.nome && id.estadio.dados.cidade === h.cidade && id.fachada.cor === h.fachada_cor);
          okArq = okArq && ok;
          txt.push(`${h.clubes?.join('/')} → ${achados[0]?.estadio.nome} (${achados[0]?.estadio.dados?.cidade}, ${achados[0]?.fachada.cor})${ok ? '' : ' ERRADO'}`);
        }
        // um clube de fora da lista com o mesmo nome de estádio: a entrada principal
        const p0 = BASE.estadios[k], id0 = I.identidadeDoPedido(comEd(ped(time({ name: 'Clube Sem Homônimo', short: 'CSH', c1: '#2459d6', c2: '#ffffff', stadium: p0.nome, kits: AZUL.kits }), FLA), 'pro'), BASE);
        const ok0 = id0.estadio.real && id0.estadio.dados.cidade === (p0.cidade || '') && id0.fachada.cor === p0.fachada_cor;
        okArq = okArq && ok0;
        txt.push(`outro clube → ${id0.estadio.nome} (${id0.estadio.dados?.cidade})${ok0 ? '' : ' ERRADO'}`);
      }
      if (BASE && !homs.length) txt.push('a base do arquivo não tem homônimos');
      reg('E7b estádios de mesmo nome (homonimos): o do clube mandante; outro clube → a entrada principal', txt.join(' · '), 'ensaio e arquivo: cada clube no estádio dele', okEnsaio && okArq);
    }
    // E8 os trechos da cobertura (identidade.js trechoCoberto → fachada.trechos): só se TIRAM pedaços do anel; 'parcial' =
    // o lado de lá (o da marquise do jogo: render/campo.js)
    if (I.trechoCoberto && I.TRECHOS_COBERTURA) {
      const n = I.TRECHOS_COBERTURA.n, conta = t => Array.from({ length: n }, (_, i) => I.trechoCoberto(t, i));
      const tot = conta('total'), la = conta('lados'), pa = conta('parcial'), ne = conta('nenhuma'), sem = conta(undefined);
      const q = l => l.filter(Boolean).length;
      const ladoCa = i => i >= 18 && i <= 25, ladoLa = i => i >= 54 && i <= 61, fundo = i => (i >= 0 && i <= 7) || (i >= 36 && i <= 43);
      const ok = q(tot) === n && q(sem) === n && q(ne) === 0
        && la.every((v, i) => (ladoCa(i) || ladoLa(i) ? v : true) && (fundo(i) ? !v : true)) && pa.every((v, i) => (ladoLa(i) ? v : true) && (ladoCa(i) || fundo(i) ? !v : true))
        && pa.every((v, i) => !v || la[i]) && la.every((v, i) => !v || tot[i]);
      // e a identidade leva os trechos ao desenho (render/estadio-fora.js): 'total' = null (o anel inteiro, o de hoje)
      const tr = cob => { const b = { versao: 1, estadios: { 'arena do vale': { ...BASE_T.estadios['arena do vale'], cobertura: cob } } }; return I.identidadeDoPedido(pPro, b).fachada.trechos; };
      const okId = tr('total') === null && igual(tr('lados'), la) && igual(tr('parcial'), pa) && igual(tr('nenhuma'), ne);
      reg('E8 cobertura: total / lados / parcial / nenhuma = pedaços do anel (nunca fora dele)', `trechos cobertos: total ${q(tot)}, lados ${q(la)}, parcial ${q(pa)} (lado de lá), nenhuma ${q(ne)} (de ${n}) · na identidade ${okId ? 'iguais' : 'DIFERENTES'}`, 'total ⊇ lados ⊇ parcial · lados sem os fundos · parcial só o lado de lá · fachada.trechos = esses', ok && okId);
    } else reg('E8 cobertura: total / lados / parcial / nenhuma', 'sem trechoCoberto (identidade.js)', 'existe', false);
  }
}

// ------------------------------------------------------------------ F: camisas REAIS da temporada (edição pro, 22/10)
// a base assets/tm/uniformes.json (tools/uniformes/gerar.mjs a partir da pesquisa): na pro, o clube da base veste a camisa
// real (pelo nome, sem acento); na pública e fora da base, nada muda; nas duas, os uniformes seguem sem confusão
if (I) {
  let base = null;
  try { base = JSON.parse(fs.readFileSync(path.resolve(pastaJs, '../assets/tm/uniformes.json'), 'utf8')); } catch (_) { base = null; }
  if (!base || typeof I.comCamisasReais !== 'function') reg('F1 camisas reais da temporada (assets/tm/uniformes.json + comCamisasReais)', 'não existem', 'existem', false);
  else {
    const t = (name, pais = 'Brasil') => ({ name, colors: { primary: '#c52613', secondary: '#111111' }, kits: {}, identidade: { pais } });
    const ped = (ed, a, b) => ({ edicao: ed, partida: { neutro: true }, home: t(a), away: t(b) });
    const pro = I.identidadeDoPedido(ped('pro', 'Flamengo', 'Sao Paulo'), null, base);
    const pub = I.identidadeDoPedido(ped('public', 'Flamengo', 'São Paulo'), null, base);
    const fora = I.identidadeDoPedido(ped('pro', 'Clube Inventado', 'Outro FC'), null, base);
    const fla = base.clubes.Flamengo.home, sp = base.clubes['São Paulo'];
    const okPro = pro.kits.linha0.real && pro.kits.linha0.camisa === fla.camisa && pro.kits.linha0.padrao === 'hoops' && pro.kits.linha1.real
      && [sp.home, sp.away, sp.third].some(k => k && k.camisa === pro.kits.linha1.camisa);
    const okPub = !pub.kits.linha0.real && !pub.kits.linha1.real, okFora = !fora.kits.linha0.real && !fora.kits.linha1.real;
    reg('F1 pro: o clube da base veste a camisa real (Flamengo de aros; "Sao Paulo" sem acento acha o São Paulo)', `Flamengo ${pro.kits.linha0.camisa}/${pro.kits.linha0.padrao}${pro.kits.linha0.real ? ' (real)' : ''} · São Paulo ${pro.kits.linha1.camisa}${pro.kits.linha1.real ? ' (real)' : ''}`, 'as reais', okPro);
    reg('F2 pública e clube fora da base: nada muda (as camisas pelas cores do TM)', `pública ${okPub ? 'sem real' : 'COM REAL'} · fora da base ${okFora ? 'sem real' : 'COM REAL'}`, 'sem real', okPub && okFora);
    // sem confusão entre os 20 da base, dois a dois (o mandante de casa; o visitante escolhe)
    let pior = Infinity, ex = '';
    const nomes = Object.keys(base.clubes);
    for (const a of nomes) for (const b of nomes) {
      if (a === b) continue;
      const r = I.identidadeDoPedido(ped('pro', a, b), null, base);
      const d = r.uniformes.medidas.linhas;
      if (d < pior) { pior = d; ex = `${a} × ${b}`; }
    }
    reg('F3 os 20 clubes da base dois a dois: as camisas de linha sem confusão (ΔE₀₀ do pior jogo)', `pior ${pior.toFixed(1)} (${ex})`, `≥ ${I.LIMIAR.linhaMin}`, pior >= I.LIMIAR.linhaMin);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-identidade: REPROVOU (${falhas})` : '\nteste-identidade: PASSOU');
process.exit(falhas ? 1 : 0);
