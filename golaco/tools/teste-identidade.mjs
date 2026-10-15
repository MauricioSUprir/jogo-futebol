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
//   D) a torcida com as paletas do TM: os MESMOS lugares, só as camisas mudam; o público tira gente; jogo neutro mistura.
//   node tools/teste-identidade.mjs [--js <pasta js>]
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
    const okArq = ["'#12a95c'", "'#0d8447'", "'#2a3033'", "'#0f5233'", "'#14181a'"].every(c => src.includes(c))
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
    const okEst = c.neutro ? id.estadio.nome === 'Arena Central' : id.estadio.nome === (c.p.home.identidade?.estadio?.nome || c.p.home.stadium || `Arena ${c.p.home.name}`);
    reg(`C ${c.nome}: placas, estádio e mosaico`, `placas ${pn.map(x => x.texto).join(' | ')} · estádio "${id.estadio.nome}" · mosaico "${id.mosaico.texto}"`, c.neutro ? 'TOTAL MATCH + neutras · nome genérico' : 'TOTAL MATCH + mandante + escudo · estádio do mandante', okPn && okEst && id.mosaico.texto.length > 0);
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
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-identidade: REPROVOU (${falhas})` : '\nteste-identidade: PASSOU');
process.exit(falhas ? 1 : 0);
