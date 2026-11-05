// Pré-jogo no navegador (Chromium): pedido do dono de 11/10 — cenas de fora do estádio, o estádio, a entrada dos times,
// a fila com a câmera passando, cortes de torcida e as escalações dos dois times no campinho, uma depois da outra
// (~10 s cada, o mesmo fundo). Com ?prejogo=1 (desligado por padrão com navigator.webdriver: os outros testes abrem
// direto no jogo), relógio manual, PC 1280×720 Alta e celular 844×390 Média com toque:
//   1) logo depois de pronto: o pré-jogo ativo na abertura, a partida no tick 0 (0 passos), o HUD escondido, 0 erros;
//      sem ?prejogo (webdriver) ele NÃO liga;
//   2) ≥ 11 planos na ordem do roteiro; cenas de 50–65 s; a escalação do mandante inteira na tela 10 ± 0,2 s e depois
//      a do visitante pelo mesmo tempo (relógio de 50 ms);
//   3) cada plano aparece (print com variação de cor): túnel, entrada, plano alto e o geral com ≥ 8 andantes na tela;
//      nas filas a câmera anda ≥ 8 m e cada um dos 11 do time passa pelo terço central do quadro (30 qps); nos planos
//      de fora a fachada cobre ≥ 25% da tela;
//   4) escalação: 11 cartas com os titulares de estadoTime(t) na ordem das vagas, folga ≥ 6 px, nada fora da tela nem da
//      área segura, letra ≥ 10 px, nada cortado e o botão Pular sem encostar em carta nem no nome do time — também em
//      568×320, 640×360, 667×375, 844×390 (com e sem entalhe), 1366×600, 1440×900, 1024×768, 1920×1080 e 800×1000 (em pé);
//  4b) a escalação EM PÉ (item 29; dono, 17/10: "o campinho da escalação do jogo EM PÉ (retrato), não deitado"), nas duas
//      folhas de cada uma dessas telas (o perfil do PC) e no celular 844×390 (dpr 2, toque), depois de a TM Cond chegar:
//      E1 a caixa do campo em pé (altura ≥ 1,15 × largura); E2 o GOL embaixo (≥ 10 px abaixo de todas) e no meio (± 2 px);
//      E3 o lado (na mesma fila, col menor → x menor ≥ 5 px; col < 0 à esquerda do meio, > 0 à direita); E4 as linhas sem
//      distorção (viewBox "0 0 L 105", 68 ≤ L ≤ 89,3; o círculo redondo ± 3%; a grande área de baixo 40,32 × 16,5 ± 3% e
//      colada à linha de fundo); E5 as cartas no campo (o centro dentro dele ± 1 px), na área segura, folga ≥ 9 px; E6 a letra
//      mínima (§7.4/§7.5: altura da tela ≤ 480 → nome e posição ≥ 11, ≥ 10 com altura < 350; PC → nome ≥ 13, posição ≥ 11;
//      número ≥ 16); E7 nada cortado (na largura — também por fração de px: a largura do texto no canvas × a caixa — e a TINTA
//      do nome dentro da caixa dele: os traços de baixo de g, y, ç); E8
//      sem rolar (documento, #prejogo, a folha, a coluna) e a coluna ≥ 8 px do grupo do campo; E9 a mesma caixa nas duas
//      folhas (± 0,5 px); E10 o Pular sem encostar em carta nem no nome do time; E11 o nome e a posição em TM Cond (carregada);
//      E12 as pontas nunca tangentes à lateral (a borda da carta ≥ 5 px para dentro, ou a carta centrada na lateral ± 1 px;
//      revisão V1 do item 29);
//      E4 também as linhas recortadas pelo canto arredondado do campo (clip-path com o raio: os cantos vivos do retângulo
//      furavam a curva; revisões A2/V3);
//      E13 o nome do time em ≤ 3 linhas (revisão V6);
//  15) a escalação com ?tm e nomes LONGOS (tools/lib/pedidos-tm.mjs PED_NOMES_LONGOS: os dois nomes de time mais compridos e
//      camisas de 10 letras com M e W; o visitante com 3 nomes de estresse): E1–E13 em 568×320, 640×360, 844×390 com entalhe,
//      1366×600 e 1920×1080, com o escudo na coluna; cortados: 0 no mandante, no visitante só os de estresse (com "…"); e o
//      pedido MISTO (PED_NOMES_MISTOS: um nome de time curto e camisas curtas × o nome e as camisas longas) em 1280×1024 e
//      844×390 — a mesma caixa nas duas folhas com colunas de larguras diferentes (A1) e as cartas de cada folha pelos nomes
//      dela (V2: as pontas do time de nomes curtos dentro do campo); e, com o arquivo da TM Cond bloqueado, 568×320 do elenco
//      fictício sem nome cortado (a reserva do sistema encolhida por size-adjust — V5);
//   5) pular: um clique/toque avança 1 bloco no mesmo quadro; Esc (PC) e o botão Pular (celular) vão direto ao jogo:
//      o HUD volta, a partida continua no tick 0 com o hash de criarPartida (Node) e 600 passos dão o mesmo hash no Node
//      e no Chromium;
//   6) som: com o toque da abertura as camadas da torcida tocam no pré-jogo, o filtro de fora abafa; o apito da saída
//      só toca no FIM (0 antes, 1 depois);
//   7) desempenho no celular (Média): ≤ 40 chamadas de desenho e ≤ 130 mil triângulos em todo plano;
//   8) memória: geometrias e texturas depois do pré-jogo = as do jogo aberto sem ele (o lado de fora descartado);
//   9) o vão das placas na frente do túnel aberto no pré-jogo (por ali o cortejo passa; recorte nas 2 malhas das placas
//      e as pontas) e fechado no jogo (as placas inteiras, a bola bate nelas);
//  10) celular em pé no meio do pré-jogo: a tela de girar cobre, o tempo não anda, o toque não avança, o som fica como
//      na pausa do jogo (sem o plano do pré-jogo por cima); deitado de novo, continua;
//  11) "Reiniciar partida" (só a escalação): o lado de fora sem o entorno (nunca entra no quadro);
//  12) pular de qualquer instante (3 modos, da abertura ao fim; botão Pular, Esc e pularTudo): jogo no tick 0 com o
//      hash de criarPartida e o estádio do jogo de volta (near/far, placas inteiras, HUD);
//  13) a pausa cabe sem rolar no celular deitado (também com "Modo de jogo" aberto) e "Pré-jogo da partida" passa pelos
//      4 modos e salva;
//  14) o estádio REAL do Total Match (?tm, edição pro; contrato "Estádio de cada clube"), celular 844×390 Média de dia, 2
//      estilos e as coberturas que tiram mais do anel — Aflitos (concreto, 'nenhuma') e BUKO Stadion (vidro, 'parcial') — e
//      o Maracanã (16/10: a forma própria, tigela oval com o anel de cobertura, estadio-planta.js + render/estadio-real.js):
//      o estádio achado na base com o desenho dele (o Maracanã com a forma dele carregada), cada plano com cor, ≤ 40
//      chamadas e ≤ 130 mil triângulos, a marquise escondida só no pré-jogo da 'nenhuma' (de volta no jogo) e 0 erros.
// Na versão publicada não há pré-jogo (reprova no item 1).
//   node tools/teste-prejogo.mjs [--raiz <pasta do jogo>] [--so-tm (só o item 14)] [--so-esc (só os itens 4, 4b e 15, com
//   ?prejogo=escalacao)]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const soTm = args.includes('--so-tm');
const soEsc = args.includes('--so-esc');
const imp = f => import(pathToFileURL(path.join(raiz, 'js', f)).href);
const { criarPartida, passoPartida } = await imp('partida.js');
const { FORMACOES } = await imp('formacoes.js');
// as vagas de cada formação (fila/col) para o E3 (o lado de cada carta)
const VAGAS = Object.fromEntries(Object.entries(FORMACOES).map(([k, f]) => [k, Object.fromEntries(f.vagas.map(v => [v.id, { fila: v.fila, col: v.col }]))]));
const { hashMundo } = await imp('sim.js');
const { BOTAO } = await imp('config.js');
const SEMENTE = 3;
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : String(v));
const hexa = h => (h >>> 0).toString(16).padStart(8, '0');

// o roteiro de 600 passos depois do pré-jogo (o mesmo nos dois motores)
function roteiro(n) {
  const r = [];
  for (let i = 0; i < n; i++) {
    const a = 0.8 * Math.sin(i / 40);
    r.push({ x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9, botoes: (i >= 90 && i < 170 ? BOTAO.CORRER : 0) | (i >= 260 && i < 280 ? BOTAO.PASSE : 0) | (i >= 420 && i < 445 ? BOTAO.CHUTE : 0) });
  }
  return r;
}
function hashNode(n) {
  const m = criarPartida({ semente: SEMENTE });
  const h0 = hashMundo(m);
  for (const e of roteiro(n)) {
    const t = { 0: { x: e.x, z: e.z, botoes: e.botoes } };
    Object.defineProperties(t, { x: { value: e.x }, z: { value: e.z }, botoes: { value: e.botoes } });
    passoPartida(m, t, null);
  }
  return { h0, h: hashMundo(m) };
}
const NODE = hashNode(600);

/** Desvio e número de cores de um print (PNG) — decodificado numa página auxiliar. */
async function estatisticas(contexto, png) {
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const r = await aux.evaluate(async src => {
    const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode();
    const c = document.getElementById('c'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0, s2 = 0, n = 0; const cores = new Set();
    for (let k = 0; k < d.length; k += 4 * 7) { const l = 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; s += l; s2 += l * l; n++; cores.add((d[k] >> 4) * 256 + (d[k + 1] >> 4) * 16 + (d[k + 2] >> 4)); }
    const m = s / n;
    return { desvio: Math.sqrt(Math.max(0, s2 / n - m * m)), cores: cores.size };
  }, png.toString('base64'));
  await aux.close();
  return r;
}

/** As cartas de uma escalação na tela: folga, fora da tela, letra, nomes. */
async function conferirEscalacao(pg, t) {
  return pg.evaluate(t => {
    const g = window.__golaco, P = g.prejogo;
    // o botão Pular aparece com qualquer movimento: confere o lugar dele junto com as cartas
    document.getElementById('prejogo').dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    const cs = P.escalacao.cartas(t);
    const W = innerWidth, H = innerHeight;
    const css = getComputedStyle(document.documentElement);
    const sa = k => parseFloat(css.getPropertyValue(k)) || 0;
    const area = { l: sa('--sa-l'), r: W - sa('--sa-r'), t: sa('--sa-t'), b: H - sa('--sa-b') };
    let folga = Infinity, fora = 0, cortados = 0, fonte = Infinity;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i].rect;
      if (a.x < area.l - 0.5 || a.y < area.t - 0.5 || a.x + a.w > area.r + 0.5 || a.y + a.h > area.b + 0.5) fora++;
      if (cs[i].cortado) cortados++;
      fonte = Math.min(fonte, cs[i].fonteMin);
      for (let k = i + 1; k < cs.length; k++) {
        const b = cs[k].rect;
        const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
        folga = Math.min(folga, Math.max(gx, gy));
      }
    }
    const tm = g.estadoTime(t);
    const ordem = Object.values(tm.vagas);
    const ids = cs.map(c => c.id);
    // o botão Pular (se estiver visível) não encosta em carta nem no nome do time
    const pu = P.escalacao.pular, info = P.escalacao.info(t);
    const toca = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    let pularEncosta = 0;
    if (pu.visivel) {
      for (const c of cs) if (toca(pu, c.rect)) pularEncosta++;
      const nome = document.querySelectorAll('.pj-esc')[t].querySelector('.pj-esc-nome').getBoundingClientRect();
      if (toca(pu, { x: nome.left, y: nome.top, w: nome.width, h: nome.height })) pularEncosta++;
    }
    if (!pu.visivel) pularEncosta = -1;
    return { n: cs.length, folga, fora, cortados, fonte, ordemOk: ids.length === 11 && ids.every((id, i) => id === ordem[i]), nomes: cs.map(c => c.nome).join(', '), pularEncosta, info };
  }, t);
}

/**
 * A escalação EM PÉ (item 29, 4b): E1–E11 da folha t, medidos no DOM (valem também na base, que reprova). Espera a TM Cond.
 * Devolve {campo, falhas: [E…], resumo, cortados: [nomes], elipse: [nomes com text-overflow ellipsis]}.
 */
async function conferirEmPe(pg, t) {
  await pg.evaluate(() => (document.fonts && document.fonts.load ? document.fonts.load('800 11px "TM Cond"').catch(() => null) : null));
  return pg.evaluate(({ t, VAGAS }) => {
    const g = window.__golaco, P = g.prejogo;
    document.getElementById('prejogo').dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    const W = innerWidth, H = innerHeight;
    const css = getComputedStyle(document.documentElement);
    const sa = k => parseFloat(css.getPropertyValue(k)) || 0;
    const seg = { l: sa('--sa-l'), r: W - sa('--sa-r'), t: sa('--sa-t'), b: H - sa('--sa-b') };
    const R = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const f1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
    const folha = document.querySelectorAll('.pj-esc')[t];
    const campoEl = folha.querySelector('.pj-esc-campo'), areaEl = folha.querySelector('.pj-esc-area'), infoEl = folha.querySelector('.pj-esc-info');
    const rc = R(campoEl), ra = R(areaEl), ri = R(infoEl);
    const meio = rc.x + rc.w / 2;
    const vagas = VAGAS[g.estadoTime(t).formacao] || {};
    const cartas = [...folha.querySelectorAll('.pj-carta')].map(d => { const r = R(d); return { d, r, v: vagas[d.dataset.vaga], cx: r.x + r.w / 2, cy: r.y + r.h / 2, id: d.dataset.vaga }; });
    const falhas = [], det = [];
    // E1 em pé
    if (!(rc.h >= 1.15 * rc.w)) falhas.push(`E1 caixa ${f1(rc.w)}×${f1(rc.h)} (L/A ${(rc.w / rc.h).toFixed(2)})`);
    // E2 o GOL embaixo e no meio
    const gol = cartas.find(c => c.v && c.v.fila === 0);
    if (!gol) falhas.push('E2 sem o GOL');
    else {
      const acima = cartas.filter(c => c !== gol && !(gol.cy >= c.cy + 10)).map(c => c.id);
      if (acima.length || Math.abs(gol.cx - meio) > 2) falhas.push(`E2 GOL ${acima.length ? 'não está abaixo de ' + acima.slice(0, 3).join('/') : ''} ${f1(gol.cx - meio)} px do meio`);
    }
    // E3 o lado
    const lado = [];
    for (const a of cartas) {
      if (!a.v) { lado.push(a.id + '?'); continue; }
      if (a.v.col < 0 && !(a.cx < meio)) lado.push(a.id);
      if (a.v.col > 0 && !(a.cx > meio)) lado.push(a.id);
      for (const b of cartas) if (b.v && a.v.fila === b.v.fila && a.v.col < b.v.col && !(a.cx <= b.cx - 5)) lado.push(`${a.id}/${b.id}`);
    }
    if (lado.length) falhas.push(`E3 lado: ${[...new Set(lado)].slice(0, 4).join(', ')}`);
    // E4 as linhas em pé sem distorção
    const svg = folha.querySelector('.pj-esc-linhas');
    const viewBox = svg.getAttribute('viewBox') || '';
    const vb = viewBox.trim().split(/\s+/).map(Number);
    const elip = svg.querySelector('ellipse');
    const re = elip ? R(elip) : null;
    const rs = [...svg.querySelectorAll('rect')].map(R);
    const grandes = rs.slice(1).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 2).sort((a, b) => (b.y + b.h) - (a.y + a.h));
    const ga = grandes[0];
    const circ = re ? re.w / re.h : NaN, gaLA = ga ? ga.w / ga.h : NaN, gaFundo = ga ? rc.y + rc.h - (ga.y + ga.h) : NaN;
    // (as linhas recortadas pelo canto arredondado do campo: o raio de dentro da borda — os cantos vivos furavam a curva)
    const raioCampo = parseFloat(getComputedStyle(campoEl).borderTopLeftRadius) || 0, clip = getComputedStyle(svg).clipPath || 'none';
    const mClip = clip.match(/^inset\(0(?:px)?(?: 0(?:px)?)* round ([\d.]+)px/);
    const recorte = !!mClip && Math.abs(+mClip[1] - (raioCampo - 1)) <= 0.5;
    const e4 = vb.length === 4 && vb[0] === 0 && vb[1] === 0 && vb[3] === 105 && vb[2] >= 68 && vb[2] <= 89.3 && Math.abs(circ - 1) <= 0.03
      && Math.abs(gaLA / (40.32 / 16.5) - 1) <= 0.03 && gaFundo >= -1 && gaFundo <= 0.01 * rc.h + 2 && recorte;
    if (!e4) falhas.push(`E4 viewBox "${viewBox}", círculo ${circ.toFixed(2)}, grande área ${gaLA.toFixed(2)} a ${f1(gaFundo)} px do fundo, recorte das linhas "${clip}" (raio ${raioCampo})`);
    // E5 no campo, na área segura, folga
    let folga = Infinity, par = '', foraCampo = [], foraSeg = 0;
    cartas.forEach((c, i) => {
      if (c.cx < rc.x - 1 || c.cx > rc.x + rc.w + 1 || c.cy < rc.y - 1 || c.cy > rc.y + rc.h + 1) foraCampo.push(c.id);
      const a = c.r;
      if (a.x < seg.l - 0.5 || a.y < seg.t - 0.5 || a.x + a.w > seg.r + 0.5 || a.y + a.h > seg.b + 0.5) foraSeg++;
      for (let k = i + 1; k < cartas.length; k++) {
        const b = cartas[k].r;
        const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
        if (Math.max(gx, gy) < folga) { folga = Math.max(gx, gy); par = `${c.id}/${cartas[k].id}`; }
      }
    });
    if (foraCampo.length || foraSeg || !(folga >= 9)) falhas.push(`E5 fora do campo ${foraCampo.join('/') || 0}, fora da área segura ${foraSeg}, folga ${f1(folga)} (${par})`);
    // E6 a letra mínima
    const cel = H <= 480, peq = H < 350;
    const mn = cel ? (peq ? { nome: 10, pos: 10 } : { nome: 11, pos: 11 }) : { nome: 13, pos: 11 };
    const fonte = { num: Infinity, nome: Infinity, pos: Infinity };
    let semPos = 0;
    for (const c of cartas) for (const [k, sel] of [['num', '.pj-num'], ['nome', '.pj-nome'], ['pos', '.pj-pos']]) {
      const st = getComputedStyle(c.d.querySelector(sel));
      if (st.display === 'none') { if (k === 'pos') semPos++; continue; }
      fonte[k] = Math.min(fonte[k], parseFloat(st.fontSize));
    }
    if (!(fonte.num >= 16 && fonte.nome >= mn.nome - 0.01 && (semPos === cartas.length || fonte.pos >= mn.pos - 0.01))) falhas.push(`E6 letra nº ${f1(fonte.num)} / nome ${f1(fonte.nome)} / pos ${f1(fonte.pos)} (mín. 16 / ${mn.nome} / ${mn.pos})`);
    // E7 nada cortado: na largura e a tinta do nome dentro da caixa
    const ctx = (window.__tpCanvas = window.__tpCanvas || document.createElement('canvas').getContext('2d'));
    const cortados = [], elipse = [], tinta = [];
    for (const c of cartas) {
      const nm = c.d.querySelector('.pj-nome'), st = getComputedStyle(nm);
      ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const m = ctx.measureText(nm.textContent);
      // cortado: também o que passa por fração de px (o "…" aparece; o scrollWidth/clientWidth arredondados não veem)
      const rn = nm.getBoundingClientRect();
      if (nm.scrollWidth > nm.clientWidth + 1 || m.width > rn.width + 0.05) { cortados.push(nm.textContent); if (st.textOverflow === 'ellipsis') elipse.push(nm.textContent); }
      const hb = rn.height, lh = Number.isFinite(parseFloat(st.lineHeight)) ? parseFloat(st.lineHeight) : hb;
      const base = (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const topo = base - m.actualBoundingBoxAscent, fundo = base + m.actualBoundingBoxDescent;
      if (topo < -0.5 || fundo > hb + 0.5) tinta.push(`${nm.textContent} (${f1(topo)}..${f1(fundo)} em ${f1(hb)})`);
    }
    if (tinta.length) falhas.push(`E7 tinta cortada: ${tinta.slice(0, 3).join(', ')}`);
    // E8 sem rolar; a coluna longe do grupo do campo
    const pj = document.getElementById('prejogo'), de = document.documentElement;
    const rola = Math.max(0, de.scrollWidth - W) + Math.max(0, de.scrollHeight - H) + [pj, folha, infoEl].reduce((s, e) => s + Math.max(0, e.scrollHeight - e.clientHeight - 1), 0);
    const vao = Math.max(ra.x - (ri.x + ri.w), ri.x - (ra.x + ra.w), ra.y - (ri.y + ri.h), ri.y - (ra.y + ra.h));
    if (rola > 0 || !(vao >= 8)) falhas.push(`E8 rola ${f1(rola)} px; coluna a ${f1(vao)} px do campo`);
    // E10 o Pular
    const pu = P.escalacao.pular;
    const toca = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    let pular = -1;
    if (pu.visivel) { pular = cartas.filter(c => toca(pu, c.r)).length + (toca(pu, R(folha.querySelector('.pj-esc-nome'))) ? 1 : 0); }
    if (pular !== 0) falhas.push(`E10 Pular ${pular < 0 ? 'invisível' : 'encosta em ' + pular}`);
    // E11 a TM Cond
    const fam = getComputedStyle(folha.querySelector('.pj-nome') || folha).fontFamily.replace(/["']/g, '');
    const famPos = getComputedStyle(folha.querySelector('.pj-pos') || folha).fontFamily.replace(/["']/g, '');
    const carregada = [...document.fonts].some(ff => ff.family.replace(/["']/g, '') === 'TM Cond' && ff.status === 'loaded');
    if (!(fam.startsWith('TM Cond') && famPos.startsWith('TM Cond') && carregada)) falhas.push(`E11 letra do nome "${fam.split(',')[0]}", da posição "${famPos.split(',')[0]}" (TM Cond carregada ${carregada})`);
    // E12 as pontas nunca tangentes à lateral: a borda da carta ≥ 5 px para dentro, ou a carta centrada na lateral (± 1 px)
    let pontas = Infinity, pontaRuim = '';
    for (const c of cartas) {
      for (const [dentro, centro] of [[c.r.x - rc.x, c.cx - rc.x], [rc.x + rc.w - (c.r.x + c.r.w), rc.x + rc.w - c.cx]]) {
        if (dentro >= 4.95) continue;
        const desvio = Math.abs(centro);
        if (desvio > 1 && dentro < pontas) { pontas = dentro; pontaRuim = `${c.id} a ${f1(dentro)} px da lateral (o centro a ${f1(centro)})`; }
      }
    }
    if (pontaRuim) falhas.push(`E12 ponta tangente: ${pontaRuim}`);
    // E13 o nome do time em até 3 linhas
    const nomeTime = folha.querySelector('.pj-esc-nome'), stNt = getComputedStyle(nomeTime);
    const lhNt = Number.isFinite(parseFloat(stNt.lineHeight)) ? parseFloat(stNt.lineHeight) : 1.02 * parseFloat(stNt.fontSize);
    const linhasNt = Math.round(nomeTime.getBoundingClientRect().height / lhNt);
    if (!(linhasNt <= 3)) falhas.push(`E13 nome do time em ${linhasNt} linhas de ${f1(parseFloat(stNt.fontSize))} px`);
    const c0 = cartas[0]?.r;
    const resumo = `campo ${f1(rc.w)}×${f1(rc.h)} (${(rc.w / rc.h).toFixed(2)}), viewBox ${vb.map(v => Math.round(v * 10) / 10).join(' ')}, carta ${c0 ? f1(c0.w) + '×' + f1(c0.h) : '—'}, letra ${f1(fonte.num)}/${f1(fonte.nome)}/${f1(fonte.pos)}, folga ${f1(folga)}`;
    return { campo: rc, falhas, resumo, cortados, elipse, escudo: !!folha.querySelector('.pj-esc-escudo') };
  }, { t, VAGAS });
}

/** O item 4 e o 4b nas telas da lista (o perfil do PC: dpr 1, sem toque). tela = {w, h, entalhe?, item4?}. */
async function telasEscalacao(pg, telas, { prefixo = 'Escalação', cortadosOk = null } = {}) {
  for (const T of telas) {
    if (T.w !== pg.viewportSize().width || T.h !== pg.viewportSize().height) await pg.setViewportSize({ width: T.w, height: T.h });
    await pg.evaluate(e => document.documentElement.classList.toggle('entalhe-simulado', !!e), !!T.entalhe);
    const nome = `${T.w}×${T.h}${T.entalhe ? ' com entalhe' : ''}${T.rotulo ? ' ' + T.rotulo : ''}`;
    let pior = { folga: Infinity, fora: 0, fonte: Infinity, cortados: 0, ordem: true, n: 11, pular: 0 };
    const emPe = [];
    for (const t of [0, 1]) {
      await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; const p = pj.planos.find(q => q.id === `escalacao${t}`); pj.irPara(p.t0 + 2); g.relogio.avancar(16); g.relogio.avancar(16); }, t);
      if (T.item4 !== false) {
        const c = await conferirEscalacao(pg, t);
        pior = { folga: Math.min(pior.folga, c.folga), fora: pior.fora + c.fora, fonte: Math.min(pior.fonte, c.fonte), cortados: pior.cortados + c.cortados, ordem: pior.ordem && c.ordemOk, n: Math.min(pior.n, c.n), pular: pior.pular + Math.abs(c.pularEncosta) };
      }
      emPe.push(await conferirEmPe(pg, t));
    }
    if (T.item4 !== false && !cortadosOk) meta(`${prefixo} em ${nome}: nada encosta`, `folga ${f1(pior.folga)} px; fora ${pior.fora}; letra ${f1(pior.fonte)} px; cortados ${pior.cortados}; Pular encosta ${pior.pular}`, '≥ 6 px; 0; ≥ 10 px; 0; 0', pior.n === 11 && pior.ordem && pior.folga >= 6 && pior.fora === 0 && pior.fonte >= 10 && pior.cortados === 0 && pior.pular === 0);
    // E7 (na largura) e E9 (a mesma caixa nas duas folhas)
    const falhas = [...emPe[0].falhas.map(x => 't0 ' + x), ...emPe[1].falhas.map(x => 't1 ' + x)];
    const cortes = cortadosOk ? cortadosOk(emPe) : (emPe[0].cortados.length + emPe[1].cortados.length ? `E7 cortados: ${[...emPe[0].cortados, ...emPe[1].cortados].join(', ')}` : null);
    if (cortes) falhas.push(cortes);
    const [a, b] = [emPe[0].campo, emPe[1].campo];
    if (!(Math.abs(a.w - b.w) <= 0.5 && Math.abs(a.h - b.h) <= 0.5 && Math.abs(a.y - b.y) <= 0.5)) falhas.push(`E9 caixas ${f1(a.w)}×${f1(a.h)} (topo ${f1(a.y)}) × ${f1(b.w)}×${f1(b.h)} (topo ${f1(b.y)})`);
    const ids = [...new Set(falhas.map(x => x.match(/E\d+/)?.[0]).filter(Boolean))].sort((a, b) => +a.slice(1) - +b.slice(1));
    meta(`${prefixo} em pé em ${nome} (E1–E13, as duas folhas)`, falhas.length ? `falham ${ids.join(' ')} — ` + falhas.slice(0, 4).join(' | ') + (falhas.length > 4 ? ` (+${falhas.length - 4})` : '') : `${emPe[0].resumo}; cortados ${emPe[0].cortados.length + emPe[1].cortados.length}`,
      'em pé, GOL embaixo, lado, linhas, no campo, letra, nada cortado, sem rolar, a mesma caixa, Pular, TM Cond, pontas, nome do time', falhas.length === 0);
  }
  await pg.evaluate(() => document.documentElement.classList.remove('entalhe-simulado'));
}
// as telas do item 4 e do 4b no perfil do PC (a 1280×720 do perfil: o item 4 já mediu)
const TELAS_ESC = [{ w: 1280, h: 720, item4: false }, { w: 568, h: 320 }, { w: 640, h: 360 }, { w: 667, h: 375 }, { w: 844, h: 390 }, { w: 844, h: 390, entalhe: true },
  { w: 1366, h: 600 }, { w: 1440, h: 900 }, { w: 1024, h: 768 }, { w: 1920, h: 1080 }, { w: 800, h: 1000, rotulo: '(janela em pé)' }];

const srv = await servidor(0, raiz);
const PERFIS = [
  { nome: 'PC 1280×720 Alta', largura: 1280, altura: 720, dpr: 1, q: 'alta', toque: false, pc: true },
  { nome: 'celular 844×390 Média', largura: 844, altura: 390, dpr: 2, q: 'media', toque: true, pc: false },
];
const memoria = {};
try {
  // ---------------------------------------------------------------- 1b) sem ?prejogo, com webdriver: não liga
  if (!soTm && !soEsc) {
    const { navegador, pagina: pg, erros } = await abrir({ largura: 1280, altura: 720 });
    await pg.goto(`${srv.url}?semente=${SEMENTE}&q=media`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 120000 });
    const r = await pg.evaluate(() => ({ ativo: !!window.__golaco.prejogo?.ativo, wd: navigator.webdriver }));
    meta('Testes automatizados (webdriver) abrem direto no jogo', `pré-jogo ativo ${r.ativo} (webdriver ${r.wd})`, 'false', r.ativo === false && erros.length === 0);
    // memória do jogo sem pré-jogo (item 8): 120 quadros do jogo — com o modelo do torcedor 3D já baixado (item 69, PR 2: ele
    // é pedido no 1º quadro e as 4 malhas sobem uma por quadro; sem esperar, a conta dependia de quando o arquivo chegava)
    await pg.evaluate(() => window.__golaco.desenhar());
    await pg.waitForFunction(() => window.__golaco.estadio?.cadeiras?.torcedores?.carregado ?? true, null, { timeout: 60000 }).catch(() => {});
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); for (let i = 0; i < 120; i++) g.relogio.avancar(16.7); });
    memoria.sem = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geometrias: e.geometrias, texturas: e.texturas }; });
    await navegador.close();
  }

  for (const P of soTm || soEsc ? [] : PERFIS) {
    const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: P.largura, altura: P.altura, dpr: P.dpr, toque: P.toque });
    await pg.goto(`${srv.url}?prejogo=1&semente=${SEMENTE}&q=${P.q}&hora=dia${P.toque ? '&toque=1' : ''}`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16); });
    // ---------------------------------------------------------------- 1) abertura, tick 0
    const e1 = await pg.evaluate(() => {
      const g = window.__golaco, p = g.prejogo;
      if (!p) return null;
      return { ativo: p.ativo, fase: p.fase, tick: g.estado().tick, passos: g.passos, hud: getComputedStyle(document.getElementById('hud')).display, apito: g.estadio.som?.tocados?.apito ?? 0 };
    });
    if (!e1) {
      meta(`${P.nome}: pré-jogo na página (window.__golaco.prejogo)`, 'não existe: a página abre direto na saída de bola', 'existe', false);
      await navegador.close();
      continue;
    }
    meta(`${P.nome}: abre no pré-jogo (abertura), partida no tick 0, HUD escondido`, `ativo ${e1.ativo}, ${e1.fase}, tick ${e1.tick}, ${e1.passos} passos, HUD ${e1.hud}, ${erros.length} erros`, 'true, abertura, 0, 0, none, 0', e1.ativo && e1.fase === 'abertura' && e1.tick === 0 && e1.passos === 0 && e1.hud === 'none' && erros.length === 0);
    // o toque da abertura: começa as cenas e libera o som
    if (P.toque) await pg.touchscreen.tap(P.largura / 2, P.altura / 2); else await pg.mouse.click(P.largura / 2, P.altura / 2);
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(16); });
    // ---------------------------------------------------------------- 2) roteiro
    const R = await pg.evaluate(() => { const p = window.__golaco.prejogo; return { fase: p.fase, planos: p.planos, fimCenas: p.fimCenas, total: p.total }; });
    const ids = R.planos.map(p => p.id);
    const ordemEsperada = ['aereo', 'fachada', 'dentro', 'tunel', 'entrada', 'alto', 'filaMandante', 'filaVisitante', 'organizada', 'ladoDeLa', 'visitantes', 'geral', 'escalacao0', 'escalacao1'];
    meta(`${P.nome}: o toque da abertura começa as cenas; ≥ 11 planos na ordem; cenas 50–65 s`, `${R.fase}; ${ids.length} planos; cenas ${f1(R.fimCenas)} s (total ${f1(R.total)} s)`, 'rodando; a ordem do roteiro; 50–65 s', R.fase === 'rodando' && ids.length >= 11 && ordemEsperada.every((id, i) => ids[i] === id) && R.fimCenas >= 50 && R.fimCenas <= 65);
    // ---------------------------------------------------------------- 3) e 7) cada plano
    const porPlano = [];
    let piorCham = 0, piorTri = 0, semCor = [], poucos = [], fachadaPouca = [];
    for (const p of R.planos) {
      const t = (p.t0 + p.t1) / 2;
      const r = await pg.evaluate(t => {
        const g = window.__golaco, pj = g.prejogo;
        pj.irPara(t - 0.04); g.relogio.avancar(16); g.relogio.avancar(16);
        const d = pj.desenho;
        // a fachada na tela (o retângulo projetado da caixa dela, cortado pela tela)
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const x of [-93, 93]) for (const y of [0, 27.6]) for (const z of [-79, 79]) { const q = g.naTela(x, y, z); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
        const W = innerWidth, H = innerHeight;
        const cob = Math.max(0, Math.min(W, x1) - Math.max(0, x0)) * Math.max(0, Math.min(H, y1) - Math.max(0, y0)) / (W * H);
        return { plano: pj.plano, na: pj.andantesNaTela(), cham: d.chamadas, tri: d.triangulos, cob, som: g.estadio.som, cena: pj.somCena };
      }, t);
      const png = await pg.screenshot();
      const est = await estatisticas(contexto, png);
      porPlano.push({ id: p.id, ...r, ...est });
      if (r.plano !== p.id) semCor.push(`${p.id}≠${r.plano}`);
      if (est.desvio < 8 || est.cores < 40) semCor.push(`${p.id} (desvio ${f1(est.desvio)}, ${est.cores} cores)`);
      if (['tunel', 'entrada', 'alto', 'geral'].includes(p.id) && r.na < 8) poucos.push(`${p.id}: ${r.na}`);
      if (p.fora && r.cob < 0.25) fachadaPouca.push(`${p.id}: ${f1(r.cob * 100)}%`);
      piorCham = Math.max(piorCham, r.cham); piorTri = Math.max(piorTri, r.tri);
    }
    meta(`${P.nome}: cada plano aparece (o plano certo, print com cor)`, semCor.length ? semCor.join('; ') : `${porPlano.length} planos (desvio mín ${f1(Math.min(...porPlano.map(x => x.desvio)))})`, 'todos', semCor.length === 0);
    meta(`${P.nome}: túnel, entrada, plano alto e geral com ≥ 8 andantes na tela`, poucos.length ? poucos.join('; ') : porPlano.filter(x => ['tunel', 'entrada', 'alto', 'geral'].includes(x.id)).map(x => `${x.id} ${x.na}`).join(', '), '≥ 8', poucos.length === 0);
    meta(`${P.nome}: planos de fora com a fachada ≥ 25% da tela`, fachadaPouca.length ? fachadaPouca.join('; ') : porPlano.filter(x => R.planos.find(q => q.id === x.id)?.fora).map(x => `${x.id} ${f1(x.cob * 100)}%`).join(', '), '≥ 25%', fachadaPouca.length === 0);
    if (!P.pc) meta(`${P.nome}: ≤ 40 chamadas de desenho e ≤ 130 mil triângulos em todo plano`, `pior ${piorCham} chamadas, ${f1(piorTri / 1000)} mil tri (${porPlano.map(x => `${x.id} ${x.cham}/${Math.round(x.tri / 1000)}k`).join(' ')})`, '≤ 40; ≤ 130 mil', piorCham <= 40 && piorTri <= 130000);
    // 9) o vão das placas na frente do túnel, aberto no pré-jogo (o plano da entrada em campo)
    {
      const ent = R.planos.find(q => q.id === 'entrada');
      const v = await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; pj.irPara(t); g.relogio.avancar(16); return pj.vao ?? null; }, (ent.t0 + ent.t1) / 2);
      meta(`${P.nome}: vão das placas na frente do túnel aberto no pré-jogo (o cortejo passa por ele)`, v ? `aberto ${v.aberto}, ${v.recortadas}/${v.malhas} malhas recortadas (±${v.meia} m), recorte local ${v.local}, ${v.pontas} pontas` : 'não existe (as colunas atravessam as placas inteiras)', 'true, 2/2, true, 2', v && v.aberto && v.malhas === 2 && v.recortadas === 2 && v.local && v.pontas === 2);
    }
    // as filas: a câmera passando (30 qps) — cada um dos 11 do time pelo terço central do quadro
    for (const id of ['filaMandante', 'filaVisitante']) {
      const p = R.planos.find(q => q.id === id);
      const r = await pg.evaluate(({ t0, t1, time }) => {
        const g = window.__golaco, pj = g.prejogo;
        const vistos = new Set();
        let c0 = null, c1 = null;
        for (let t = t0 + 0.01; t < t1 - 0.01; t += 1 / 30) {
          pj.irPara(t); g.relogio.avancar(0, { desenhar: false });
          const c = pj.camera; if (!c0) c0 = c; c1 = c;
          const W = innerWidth;
          const s = g.estadoTime(time);
          for (const id of Object.values(s.vagas)) {
            const q = pj.posicaoAndante(id);
            if (!q) continue;
            const v = g.naTela(q.x, 1.75, q.z);
            if (v.x > W / 3 && v.x < 2 * W / 3) vistos.add(id);
          }
        }
        return { vistos: vistos.size, anda: Math.hypot(c1.x - c0.x, c1.z - c0.z) };
      }, { t0: p.t0, t1: p.t1, time: p.time });
      meta(`${P.nome}: ${id === 'filaMandante' ? 'fila do mandante' : 'fila do visitante'} — os 11 passam pelo terço central, a câmera anda ≥ 8 m`, `${r.vistos}/11; ${f1(r.anda)} m`, '11/11; ≥ 8 m', r.vistos === 11 && r.anda >= 8);
    }
    // som durante o pré-jogo (de fora abafado; por dentro aberto)
    const fora = porPlano.find(x => x.id === 'aereo'), dentro = porPlano.find(x => x.id === 'dentro');
    meta(`${P.nome}: som do pré-jogo (contexto rodando, camadas do leito; de fora abafado, por dentro aberto)`, `contexto ${dentro?.som?.contexto}, laços ${(dentro?.som?.lacos ?? []).join('/') || '—'}; filtro de fora ${fora?.cena?.filtro} Hz, por dentro ${dentro?.cena?.filtro} Hz`, 'running; ≥ 1 laço; < 1000; 18000', dentro?.som?.contexto === 'running' && (dentro?.som?.lacos?.length ?? 0) >= 1 && fora?.cena?.filtro < 1000 && dentro?.cena?.filtro >= 18000);
    // ---------------------------------------------------------------- 4) escalação (e nas outras telas)
    for (const t of [0, 1]) {
      await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; const p = pj.planos.find(q => q.id === `escalacao${t}`); pj.irPara(p.t0 + 2); g.relogio.avancar(16); }, t);
      const c = await conferirEscalacao(pg, t);
      meta(`${P.nome}: escalação ${t === 0 ? 'do mandante' : 'do visitante'} — 11 titulares na ordem, nada encosta`, `${c.n} cartas (${c.nomes}); folga ${f1(c.folga)} px; fora ${c.fora}; letra ${f1(c.fonte)} px; cortados ${c.cortados}; Pular encosta ${c.pularEncosta < 0 ? "(invisível)" : c.pularEncosta}`, '11 na ordem; ≥ 6 px; 0; ≥ 10 px; 0; 0', c.n === 11 && c.ordemOk && c.folga >= 6 && c.fora === 0 && c.fonte >= 10 && c.cortados === 0 && c.pularEncosta === 0);
    }
    if (P.pc) {
      // 4) nas outras telas e 4b) a escalação em pé (item 29) em todas
      await telasEscalacao(pg, TELAS_ESC);
      await pg.setViewportSize({ width: P.largura, height: P.altura });
      // ---------------------------------------------------------------- 2b) as duas escalações ~10 s cada (relógio de 50 ms)
      const tempos = await pg.evaluate(() => {
        const g = window.__golaco, pj = g.prejogo;
        pj.irPara(pj.fimCenas - 0.3);
        const cheia = { 0: 0, 1: 0 };
        let apitoAntes = g.estadio.som?.tocados?.apito ?? 0, n = 0;
        while (pj.ativo && n < 1000) {
          g.relogio.avancar(50, { desenhar: false });
          n++;
          if (!pj.ativo) break;
          apitoAntes = Math.max(apitoAntes, g.estadio.som?.tocados?.apito ?? 0);
          const c = pj.escalacao.cheia;
          if (c === 0 || c === 1) cheia[c] += 0.05;
        }
        const e = g.estado();
        return { cheia, apitoAntes, ativo: pj.ativo, tick: e.tick, passos: g.passos, hash: g.hash(), hud: getComputedStyle(document.getElementById('hud')).display, apito: g.estadio.som?.tocados?.apito ?? 0, estado: e.relogio?.estado };
      });
      meta(`${P.nome}: escalação do mandante inteira 10 ± 0,2 s, depois a do visitante`, `${f1(tempos.cheia[0])} s e ${f1(tempos.cheia[1])} s`, '10 ± 0,2 s cada', Math.abs(tempos.cheia[0] - 10) <= 0.2 && Math.abs(tempos.cheia[1] - 10) <= 0.2);
      meta(`${P.nome}: fim natural → jogo no tick 0 com o hash de criarPartida (Node)`, `ativo ${tempos.ativo}, tick ${tempos.tick}, ${tempos.passos} passos, HUD ${tempos.hud}, relógio ${tempos.estado}; hash ${hexa(tempos.hash)} × Node ${hexa(NODE.h0)}`, 'false, 0, iguais', !tempos.ativo && tempos.tick === 0 && tempos.hud !== 'none' && tempos.hash === NODE.h0);
      meta(`${P.nome}: o apito da saída só no fim do pré-jogo`, `${tempos.apitoAntes} antes; ${tempos.apito} depois`, '0; 1', tempos.apitoAntes === 0 && tempos.apito === 1);
      const vf = await pg.evaluate(() => window.__golaco.prejogo.vao ?? null);
      meta(`${P.nome}: no jogo o vão fecha (placas inteiras: a bola bate nelas)`, vf ? `aberto ${vf.aberto}, ${vf.recortadas}/${vf.malhas} recortadas, recorte local ${vf.local}, ${vf.pontas} pontas` : 'sem vão', 'false, 0/2, false, 0', vf && !vf.aberto && vf.malhas === 2 && vf.recortadas === 0 && !vf.local && vf.pontas === 0);
      const h = await pg.evaluate(rot => window.__golaco.rodarPassos(rot.length, rot), roteiro(600));
      meta(`${P.nome}: 600 passos depois do pré-jogo (Node = Chromium)`, `Chromium ${hexa(h)} · Node ${hexa(NODE.h)}`, 'iguais', h === NODE.h);
    } else {
      // 4b) a escalação em pé no celular de verdade (dpr 2, toque)
      await telasEscalacao(pg, [{ w: P.largura, h: P.altura, item4: false, rotulo: '(celular, dpr 2, toque)' }]);
      // ---------------------------------------------------------------- 10) celular em pé no meio do pré-jogo
      await pg.evaluate(() => { const g = window.__golaco, pj = g.prejogo; pj.irPara(12); g.relogio.avancar(16); g.relogio.avancar(16); });
      await pg.setViewportSize({ width: P.altura, height: P.largura });
      const emPe = await pg.evaluate(() => {
        const g = window.__golaco, pj = g.prejogo, t0 = pj.tempo;
        for (let i = 0; i < 30; i++) g.relogio.avancar(16);
        return { dt: pj.tempo - t0, parado: pj.parado, cena: pj.somCena, girar: getComputedStyle(document.getElementById('girar')).display, bloco: pj.bloco };
      });
      await pg.touchscreen.tap(P.altura / 2, P.largura / 2);
      const aposToque = await pg.evaluate(() => { const g = window.__golaco, pj = g.prejogo; g.relogio.avancar(16); return { bloco: pj.bloco, ativo: pj.ativo }; });
      await pg.setViewportSize({ width: P.largura, height: P.altura });
      const deitado = await pg.evaluate(() => {
        const g = window.__golaco, pj = g.prejogo, t0 = pj.tempo;
        for (let i = 0; i < 30; i++) g.relogio.avancar(16);
        return { dt: pj.tempo - t0, parado: pj.parado, cena: pj.somCena };
      });
      meta(`${P.nome}: celular em pé no pré-jogo — tela de girar, tempo parado, toque não avança, som como na pausa do jogo; deitado continua`,
        `em pé: girar ${emPe.girar}, anda ${f1(emPe.dt)} s, parado ${emPe.parado}, som do plano ${emPe.cena ? 'POR CIMA da pausa' : 'solto (pausa do jogo)'}, toque: ${emPe.bloco} → ${aposToque.bloco}; deitado: anda ${f1(deitado.dt)} s, som do plano ${deitado.cena ? 'de volta' : 'faltando'}`,
        'flex, 0 s, true, pausa, cenas → cenas; ~0,5 s, de volta',
        emPe.girar !== 'none' && emPe.dt === 0 && emPe.parado === true && emPe.cena === null && aposToque.ativo && aposToque.bloco === emPe.bloco && deitado.dt > 0.3 && !deitado.parado && deitado.cena !== null);
      // ---------------------------------------------------------------- 5) pular: toque = próximo bloco; botão Pular = jogo
      const b = await pg.evaluate(() => { const g = window.__golaco, pj = g.prejogo; pj.irPara(20); g.relogio.avancar(16); return pj.bloco; });
      await pg.touchscreen.tap(P.largura * 0.6, P.altura * 0.4);
      const b1 = await pg.evaluate(() => window.__golaco.prejogo.bloco);
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      await pg.touchscreen.tap(P.largura * 0.6, P.altura * 0.4);
      const b2 = await pg.evaluate(() => window.__golaco.prejogo.bloco);
      meta(`${P.nome}: um toque avança 1 bloco no mesmo quadro`, `${b} → ${b1} → ${b2}`, 'cenas → escalacao0 → escalacao1', b === 'cenas' && b1 === 'escalacao0' && b2 === 'escalacao1');
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      const pu = await pg.evaluate(() => window.__golaco.prejogo.escalacao.pular);
      await pg.touchscreen.tap(pu.x + pu.w / 2, pu.y + pu.h / 2);
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      const fim = await pg.evaluate(() => { const g = window.__golaco, e = g.estado(); return { ativo: g.prejogo.ativo, tick: e.tick, hash: g.hash(), hud: getComputedStyle(document.getElementById('hud')).display, toque: getComputedStyle(document.getElementById('toque')).display, apito: g.estadio.som?.tocados?.apito ?? 0 }; });
      meta(`${P.nome}: botão Pular → direto ao jogo (HUD e toque de volta; tick 0 e o hash de criarPartida)`, `ativo ${fim.ativo}, tick ${fim.tick}, HUD ${fim.hud}, toque ${fim.toque}; hash ${hexa(fim.hash)} × Node ${hexa(NODE.h0)}; apito ${fim.apito}`, 'false, 0, visíveis, iguais, 1', !fim.ativo && fim.tick === 0 && fim.hud !== 'none' && fim.toque !== 'none' && fim.hash === NODE.h0 && fim.apito === 1);
      const vf = await pg.evaluate(() => window.__golaco.prejogo.vao ?? null);
      meta(`${P.nome}: depois de pular o vão fecha (placas inteiras)`, vf ? `aberto ${vf.aberto}, ${vf.recortadas}/${vf.malhas} recortadas, recorte local ${vf.local}, ${vf.pontas} pontas` : 'sem vão', 'false, 0/2, false, 0', vf && !vf.aberto && vf.malhas === 2 && vf.recortadas === 0 && !vf.local && vf.pontas === 0);
      const h = await pg.evaluate(rot => window.__golaco.rodarPassos(rot.length, rot), roteiro(600));
      meta(`${P.nome}: 600 passos depois de pular (Node = Chromium)`, `Chromium ${hexa(h)} · Node ${hexa(NODE.h)}`, 'iguais', h === NODE.h);
      // 13) (depois dos 600 passos: fechar a pausa deixa o jogo andar) a pausa cabe inteira sem rolar no celular deitado (como antes do pré-jogo: com a linha "Pré-jogo" nas opções
      // ela rolava 41 px); a escolha fica em "Modo de jogo" → "Pré-jogo da partida" (cada toque passa para o próximo, salvo)
      const mn = await pg.evaluate(() => {
        const g = window.__golaco;
        const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
        esc(); g.relogio.avancar(16);
        const j = document.querySelector('.janela-menu');
        // (item 58: a janela não rola mais — quem rolaria é o corpo da faixa ou o nível à vista)
        const rola = () => (j ? Math.max(j.scrollHeight - j.clientHeight, ...[...document.querySelectorAll('#menu .menu-corpo, #menu .menu-acoes:not([hidden])')].map(e => e.scrollHeight - e.clientHeight)) : NaN);
        const r = { aberto: !document.getElementById('menu').hidden, rola: rola() };
        document.getElementById('btn-modos')?.click();
        r.rolaModos = rola();
        const b = document.getElementById('btn-prejogo');
        r.botao = !!b && b.getBoundingClientRect().height >= 44;
        r.ciclo = [];
        if (b) for (let i = 0; i < 4; i++) { b.click(); r.ciclo.push(document.getElementById('estado-prejogo').textContent); }
        try { r.salvo = JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}').prejogo; } catch (_) { r.salvo = null; }
        document.querySelector('[data-cmd="modos-voltar"]')?.click();
        esc(); g.relogio.avancar(16);
        r.fechado = document.getElementById('menu').hidden;
        return r;
      });
      meta(`${P.nome}: a pausa cabe sem rolar (também com "Modo de jogo" aberto); "Pré-jogo da partida" passa pelos 4 e salva`,
        `menu ${mn.aberto ? 'aberto' : 'FECHADO'}, rola ${mn.rola} px (Modo de jogo: ${mn.rolaModos} px); botão ${mn.botao ? 'ok' : 'não existe'}; ${mn.ciclo.join(' → ') || '—'}; salvo ${mn.salvo}; fecha ${mn.fechado}`,
        'rola ≤ 0 e ≤ 0; curto → só escalação → desligado → completo; completo',
        mn.aberto && mn.rola <= 0 && mn.rolaModos <= 0 && mn.botao && mn.ciclo.join('|') === 'curto|só escalação|desligado|completo' && mn.salvo === 'completo' && mn.fechado);
    }
    // ---------------------------------------------------------------- 8) memória depois do pré-jogo
    await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 120; i++) g.relogio.avancar(16.7); });
    const mem = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geometrias: e.geometrias, texturas: e.texturas }; });
    if (P.pc) memoria.pc = mem;
    meta(`${P.nome}: sem erro no console`, `${erros.length}${erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''}`, '0', erros.length === 0);
    await navegador.close();
  }
  // --so-esc: só os itens 4 e 4b (o perfil do PC com ?prejogo=escalacao) e o 15
  if (soEsc) {
    const { navegador, pagina: pg, erros } = await abrir({ largura: 1280, altura: 720 });
    await pg.goto(`${srv.url}?prejogo=escalacao&semente=${SEMENTE}&q=media&hora=dia&replay=0&comemoracao=0`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
    await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16); g.prejogo?.comecar(); g.relogio.avancar(16); });
    if (await pg.evaluate(() => !!window.__golaco.prejogo?.ativo)) await telasEscalacao(pg, TELAS_ESC.map(T => ({ ...T, item4: true })));
    else meta('Pré-jogo só a escalação (?prejogo=escalacao) na página', 'não ligou', 'ativo', false);
    meta('Só a escalação (--so-esc): sem erro no console', `${erros.length}${erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''}`, '0', erros.length === 0);
    await navegador.close();
  }
  // ---------------------------------------------------------------- 15) a escalação com ?tm e nomes longos (item 29)
  if (!soTm) {
    const { PED_NOMES_LONGOS, PED_NOMES_MISTOS, CAM_ESTRESSE } = await import(new URL('./lib/pedidos-tm.mjs', import.meta.url).href);
    const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: 1366, altura: 600 });
    await contexto.addInitScript(ps => { try { for (const p of ps) localStorage.setItem('tm3d:pedido:' + p.id, JSON.stringify(p)); } catch (_) { /* nada */ } }, [PED_NOMES_LONGOS, PED_NOMES_MISTOS]);
    await pg.goto(`${srv.url}?tm=${PED_NOMES_LONGOS.id}&prejogo=escalacao&replay=0&comemoracao=0&semente=${SEMENTE}&q=media&hora=dia`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
    const ok = await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16); if (!g.prejogo) return false; g.prejogo.comecar(); g.relogio.avancar(16); return { ativo: g.prejogo.ativo, tm: document.documentElement.classList.contains('tm'), nomes: [0, 1].map(t => document.querySelectorAll('.pj-esc')[t]?.querySelector('.pj-esc-nome')?.textContent) }; });
    if (!ok || !ok.ativo) meta('?tm com nomes longos: o pré-jogo (só a escalação) na página', 'não ligou', 'ativo', false);
    else {
      meta('?tm com nomes longos: a cara do TM e os dois nomes de time do pedido', `html.tm ${ok.tm}; ${ok.nomes.join(' × ')}`, `true; ${PED_NOMES_LONGOS.home.name} × ${PED_NOMES_LONGOS.away.name}`, ok.tm && ok.nomes[0] === PED_NOMES_LONGOS.home.name && ok.nomes[1] === PED_NOMES_LONGOS.away.name);
      // cortados: 0 no mandante; no visitante só os nomes de estresse, cada um com "…"; o escudo na coluna
      const cortadosOk = emPe => {
        const ruins = [];
        if (emPe[0].cortados.length) ruins.push(`mandante: ${emPe[0].cortados.join(', ')}`);
        const fora = emPe[1].cortados.filter(n => !CAM_ESTRESSE.includes(n) || !emPe[1].elipse.includes(n));
        if (fora.length) ruins.push(`visitante: ${fora.join(', ')}`);
        if (!emPe[0].escudo || !emPe[1].escudo) ruins.push('sem o escudo na coluna');
        return ruins.length ? `E7 cortados/escudo: ${ruins.join('; ')}` : null;
      };
      await telasEscalacao(pg, [{ w: 568, h: 320 }, { w: 640, h: 360 }, { w: 844, h: 390, entalhe: true }, { w: 1366, h: 600 }, { w: 1920, h: 1080 }], { prefixo: '?tm, nomes longos: escalação', cortadosOk });
    }
    // o pedido MISTO (A1/V2): as colunas dos dois times com larguras diferentes e as cartas de cada folha pelos nomes dela
    await pg.setViewportSize({ width: 1280, height: 1024 });
    await pg.goto(`${srv.url}?tm=${PED_NOMES_MISTOS.id}&prejogo=escalacao&replay=0&comemoracao=0&semente=${SEMENTE}&q=media&hora=dia`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
    const okM = await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16); if (!g.prejogo) return false; g.prejogo.comecar(); g.relogio.avancar(16); return { ativo: g.prejogo.ativo, nomes: [0, 1].map(t => document.querySelectorAll('.pj-esc')[t]?.querySelector('.pj-esc-nome')?.textContent) }; });
    if (!okM || !okM.ativo) meta('?tm com o pedido misto: o pré-jogo (só a escalação) na página', 'não ligou', 'ativo', false);
    else {
      meta('?tm com o pedido misto: os dois nomes de time do pedido', okM.nomes.join(' × '), `${PED_NOMES_MISTOS.home.name} × ${PED_NOMES_MISTOS.away.name}`, okM.nomes[0] === PED_NOMES_MISTOS.home.name && okM.nomes[1] === PED_NOMES_MISTOS.away.name);
      await telasEscalacao(pg, [{ w: 1280, h: 1024 }, { w: 844, h: 390 }], { prefixo: '?tm, pedido misto: escalação' });
      // as colunas de fato diferentes (o caso do A1) e, no celular, as pontas do time de nomes curtos dentro do campo (V2)
      const md = [];
      for (const t of [0, 1]) {
        md.push(await pg.evaluate(t => {
          const g = window.__golaco, pj = g.prejogo, p = pj.planos.find(q => q.id === `escalacao${t}`);
          pj.irPara(p.t0 + 2); g.relogio.avancar(16); g.relogio.avancar(16);
          return { info: pj.escalacao.info(t).w, ...pj.escalacao.campo(t) };
        }, t));
      }
      const [m0, m1] = md;
      meta('?tm, pedido misto em 844×390: colunas diferentes, a mesma caixa, as pontas do mandante (nomes curtos) para dentro', `colunas ${f1(m0.info)} × ${f1(m1.info)} px; caixa ${f1(m0.w)}×${f1(m0.h)} × ${f1(m1.w)}×${f1(m1.h)}; borda da ponta ${f1(m0.inset - m0.cw / 2)} × ${f1(m1.inset - m1.cw / 2)} px; carta ${m0.cw} × ${m1.cw}`,
        'colunas ≠; a mesma caixa; mandante ≥ 5 px, carta menor', Math.abs(m0.info - m1.info) > 20 && m0.w === m1.w && m0.h === m1.h && m0.inset - m0.cw / 2 >= 5 && m0.cw < m1.cw);
    }
    // a TM Cond que não chega (V5): com o arquivo dela bloqueado, a reserva do sistema encolhida (size-adjust) não põe "…" em nome
    // nenhum do elenco fictício na tela mais apertada (568×320); antes, a reserva larga cortava 2 nomes. (Com rota, o Playwright não
    // usa o cache: o arquivo não vem da página anterior)
    const nErros = erros.length;
    await contexto.route('**/tmcond-800-*.woff2', r => r.abort());
    await pg.setViewportSize({ width: 568, height: 320 });
    await pg.goto(`${srv.url}?prejogo=escalacao&replay=0&comemoracao=0&semente=${SEMENTE}&q=media&hora=dia`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
    const semFonte = await pg.evaluate(async () => {
      const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16);
      if (!g.prejogo) return null;
      g.prejogo.comecar(); g.relogio.avancar(16);
      await document.fonts.load('800 10px "TM Cond"').catch(() => null);
      await document.fonts.ready;
      const pj = g.prejogo, ctx = document.createElement('canvas').getContext('2d'), cortados = [];
      let n = 0;
      for (const t of [0, 1]) {
        const p = pj.planos.find(q => q.id === `escalacao${t}`);
        pj.irPara(p.t0 + 2); g.relogio.avancar(16); g.relogio.avancar(16);
        for (const nm of document.querySelectorAll('.pj-esc')[t].querySelectorAll('.pj-nome')) {
          const st = getComputedStyle(nm), r = nm.getBoundingClientRect();
          ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
          n++;
          if (nm.scrollWidth > nm.clientWidth + 1 || ctx.measureText(nm.textContent).width > r.width + 0.05) cortados.push(nm.textContent);
        }
      }
      const tmCond = [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'TM Cond').map(f => f.status);
      return { n, cortados, tmCond: [...new Set(tmCond)].join('/') };
    });
    meta('Escalação em 568×320 sem a TM Cond (o arquivo bloqueado): a reserva encolhida não corta nome nenhum', semFonte ? `${semFonte.cortados.length} de ${semFonte.n} cortados${semFonte.cortados.length ? ': ' + semFonte.cortados.join(', ') : ''} (TM Cond: ${semFonte.tmCond})` : 'o pré-jogo não ligou',
      '0 cortados; a TM Cond sem carregar', !!semFonte && semFonte.n === 22 && semFonte.cortados.length === 0 && !/loaded/.test(semFonte.tmCond));
    await contexto.unroute('**/tmcond-800-*.woff2');
    // (o arquivo bloqueado aparece no console como recurso que falhou: só esses saem da conta)
    for (let i = erros.length - 1; i >= nErros; i--) if (/Failed to load resource|ERR_FAILED/.test(erros[i])) erros.splice(i, 1);
    meta('?tm com nomes longos: sem erro no console', `${erros.length}${erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''}`, '0', erros.length === 0);
    await navegador.close();
  }
  // Esc no PC (pular tudo) e a memória (item 8)
  if (!soTm && !soEsc) {
    const { navegador, pagina: pg, erros } = await abrir({ largura: 1280, altura: 720 });
    await pg.goto(`${srv.url}?prejogo=1&semente=${SEMENTE}&q=alta&hora=dia`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
    const ok = await pg.evaluate(() => !!window.__golaco.prejogo);
    if (ok) {
      await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.relogio.avancar(16); g.prejogo.comecar(); g.prejogo.irPara(30); g.relogio.avancar(16); });
      await pg.keyboard.press('Enter');
      const b = await pg.evaluate(() => window.__golaco.prejogo.bloco);
      await pg.keyboard.press('Escape');
      await pg.evaluate(() => window.__golaco.relogio.avancar(16));
      const fim = await pg.evaluate(() => { const g = window.__golaco; return { ativo: g.prejogo.ativo, tick: g.estado().tick, menu: g.estado().menuAberto, hash: g.hash() }; });
      // 11) o "Reiniciar partida" toca só a escalação: o lado de fora sem o entorno
      const re = await pg.evaluate(() => { const g = window.__golaco; const ok = g.prejogo.iniciar('escalacao', {}); g.relogio.avancar(16); const f = g.prejogo.fora; const r = { ok, modo: g.prejogo.modo, fora: f, total: g.prejogo.total }; g.prejogo.pularTudo(); g.relogio.avancar(16); r.depois = g.prejogo.ativo; return r; });
      meta('Só a escalação (Reiniciar partida): o lado de fora sem o entorno', `${re.modo}, ${f1(re.total)} s; entorno ${re.fora?.entorno}, ${re.fora?.pecas} peças, ${re.fora?.triangulos} triângulos; ativo depois de pular ${re.depois}`, 'escalacao; false; ≤ 8 peças', re.ok && re.modo === 'escalacao' && re.fora && re.fora.entorno === false && re.fora.pecas <= 8 && !re.depois);
      // 12) pular de QUALQUER instante (os 3 modos, da abertura ao último décimo): jogo no tick 0 com o hash de
      // criarPartida, o estádio do jogo de volta (névoa e near/far da câmera, placas inteiras, sem html.prejogo, HUD)
      const pulos = await pg.evaluate(() => {
        const g = window.__golaco, pj = g.prejogo;
        const jogo = { near: pj.camera.near, far: pj.camera.far };
        const ruins = [];
        let n = 0;
        for (const modo of ['completo', 'curto', 'escalacao']) {
          const fim = { completo: 81.6, curto: 41.1, escalacao: 21.1 }[modo];
          for (const t of [-1, 0, 0.25, 4, 9, 14, 19, 24, 29, 33, 38, 44, 50, 55, 59, 61, 64, 70, 72, 77, fim - 0.1].filter(t => t < fim)) {
            if (!pj.iniciar(modo, { abertura: t < 0 })) { ruins.push(`${modo} ${t}: não iniciou`); continue; }
            g.relogio.avancar(16);
            if (t >= 0) { pj.irPara(t); g.relogio.avancar(16); }
            const plano = pj.plano ?? pj.fase;
            // na abertura o botão Pular não aparece (Esc ou Start pulam); depois, alterna os três jeitos
            const jeito = t < 0 ? 2 : n % 3;
            if (jeito === 0) pj.pularTudo(); else if (jeito === 1) document.querySelector('.pj-pular').click(); else window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
            g.relogio.avancar(16);
            n++;
            const c = pj.camera, v = pj.vao;
            const ok = !pj.ativo && g.estado().tick === 0 && c.near === jogo.near && c.far === jogo.far && v && !v.aberto && v.recortadas === 0 && !v.local
              && !document.documentElement.classList.contains('prejogo') && getComputedStyle(document.getElementById('hud')).display !== 'none';
            if (!ok) ruins.push(`${modo} ${t} (${plano}): ativo ${pj.ativo}, near ${c.near}, vão ${v ? v.aberto + '/' + v.recortadas : 'não existe'}`);
          }
        }
        return { n, ruins, hash: g.hash() };
      });
      meta('Pular de qualquer instante (3 modos; Pular, Esc e pularTudo): jogo no tick 0, hash de criarPartida, estádio do jogo de volta', `${pulos.n} pulos; ${pulos.ruins.length ? pulos.ruins.slice(0, 3).join('; ') : 'todos limpos'}; hash ${hexa(pulos.hash)} × Node ${hexa(NODE.h0)}`, 'todos limpos; iguais', pulos.n >= 40 && pulos.ruins.length === 0 && pulos.hash === NODE.h0);
      meta('PC: Enter → próximo bloco; Esc → direto ao jogo (sem abrir o menu)', `Enter: ${b}; Esc: ativo ${fim.ativo}, tick ${fim.tick}, menu ${fim.menu}, hash ${hexa(fim.hash)}`, 'escalacao0; false, 0, false, o de criarPartida', b === 'escalacao0' && !fim.ativo && fim.tick === 0 && !fim.menu && fim.hash === NODE.h0);
      await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 120; i++) g.relogio.avancar(16.7); });
      const mem = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geometrias: e.geometrias, texturas: e.texturas }; });
      meta('Memória: geometrias e texturas depois do pré-jogo = as do jogo sem ele', `com pré-jogo ${mem.geometrias} geo / ${mem.texturas} tex; sem ${memoria.sem.geometrias} / ${memoria.sem.texturas}`, 'iguais', mem.geometrias === memoria.sem.geometrias && mem.texturas === memoria.sem.texturas);
      meta('PC (Esc): sem erro no console', `${erros.length}`, '0', erros.length === 0);
    }
    await navegador.close();
  }
  // ---------------------------------------------------------------- 14) estádio real do Total Match (edição pro)
  if (!soEsc) {
    const { PED_A } = await import(new URL('./lib/pedidos-tm.mjs', import.meta.url).href);
    // sem forma (o Estádio Golaço nas cores dele: concreto sem cobertura e vidro com a parcial), o Maracanã (planta própria)
    // e um da planta genérica (estadio-generico.js: os Aflitos, a família que a base tiver)
    const baseEst = JSON.parse(fs.readFileSync(path.join(raiz, 'assets', 'tm', 'estadios.json'), 'utf8')).estadios;
    const famAflitos = baseEst.aflitos?.forma?.familia ?? null;
    const CASOS_TM = [['Estadio Alberto Suppici', 'concreto', 'nenhuma'], ['BUKO Stadion', 'vidro', 'parcial'], ['Maracanã', 'concreto', 'total', 'tigela'], ['Aflitos', baseEst.aflitos?.fachada_estilo ?? 'concreto', baseEst.aflitos?.cobertura ?? 'nenhuma', famAflitos]];
    const ids = CASOS_TM.map((_, i) => `prejogo-tm-${i}`);
    const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
    await contexto.addInitScript(lista => { for (const [k, v] of lista) try { localStorage.setItem(k, v); } catch (_) { /* nada */ } },
      CASOS_TM.map(([nome], i) => ['tm3d:pedido:' + ids[i], JSON.stringify({ ...PED_A, id: ids[i], edicao: 'pro', home: { ...PED_A.home, stadium: nome } })]));
    for (const [i, [nome, estilo, cob, forma = null]] of CASOS_TM.entries()) {
      const nErros = erros.length;
      await pg.goto(`${srv.url}?tm=${ids[i]}&prejogo=1&semente=${SEMENTE}&q=media&hora=dia&toque=1`, { waitUntil: 'load' });
      await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
      const est = await pg.evaluate(() => {
        const g = window.__golaco, id = g.identidade;
        g.relogio.usarManual(true); g.relogio.avancar(16); g.relogio.avancar(16);
        if (!g.prejogo) return null;
        g.prejogo.comecar(); g.relogio.avancar(16);
        return { nome: id?.estadio?.nome, real: !!id?.estadio?.real, estilo: id?.fachada?.estilo, cob: id?.fachada?.cobertura, estilos: !!id?.estilos, forma: id?.forma3d?.planta?.familia ?? null, planos: g.prejogo.planos };
      });
      if (!est) { meta(`TM pro ${nome}: pré-jogo na página`, 'não existe', 'existe', false); continue; }
      meta(`TM pro ${nome}: o estádio real achado na base, com o desenho dele (${estilo}, cobertura ${cob}${forma ? ', forma ' + forma : ''})`, `"${est.nome}" real ${est.real} · ${est.estilo}/${est.cob} · fachada-estilos.js ${est.estilos ? 'carregado' : 'não'} · forma ${est.forma ?? 'nenhuma'}`, `"${nome}" true · ${estilo}/${cob} · carregado · forma ${forma ?? 'nenhuma'}`, est.nome === nome && est.real && est.estilo === estilo && est.cob === cob && est.estilos && est.forma === forma);
      let piorCham = 0, piorTri = 0, marqMin = Infinity, marqMax = 0;
      const ruins = [], custos = [];
      for (const p of est.planos) {
        const r = await pg.evaluate(t => { const g = window.__golaco, pj = g.prejogo; pj.irPara(t - 0.04); g.relogio.avancar(16); g.relogio.avancar(16); const d = pj.desenho; return { plano: pj.plano, cham: d.chamadas, tri: d.triangulos, marq: g.identidade.estilos?.marquiseEscondida ? g.identidade.estilos.marquiseEscondida() : -1 }; }, (p.t0 + p.t1) / 2);
        const e = await estatisticas(contexto, await pg.screenshot());
        if (r.plano !== p.id || e.desvio < 8 || e.cores < 40) ruins.push(`${p.id} (${r.plano}; desvio ${f1(e.desvio)}, ${e.cores} cores)`);
        piorCham = Math.max(piorCham, r.cham); piorTri = Math.max(piorTri, r.tri);
        marqMin = Math.min(marqMin, r.marq); marqMax = Math.max(marqMax, r.marq);
        custos.push(`${p.id} ${r.cham}/${Math.round(r.tri / 1000)}k`);
      }
      meta(`TM pro ${nome}: cada plano aparece (o plano certo, print com cor)`, ruins.length ? ruins.join('; ') : `${est.planos.length} planos`, 'todos', ruins.length === 0 && est.planos.length >= 11);
      meta(`TM pro ${nome}: ≤ 40 chamadas de desenho e ≤ 130 mil triângulos em todo plano (celular Média)`, `pior ${piorCham} chamadas, ${f1(piorTri / 1000)} mil tri (${custos.join(' ')})`, '≤ 40; ≤ 130 mil', piorCham <= 40 && piorTri <= 130000);
      // a marquise de lá e o teto curto de cá (render/campo.js): somem no pré-jogo SEM cobertura e voltam inteiros no jogo
      const fim = await pg.evaluate(() => { const g = window.__golaco; g.prejogo.pularTudo(); g.relogio.avancar(16); return { ativo: g.prejogo.ativo, tick: g.estado().tick, marq: g.identidade.estilos?.marquiseEscondida ? g.identidade.estilos.marquiseEscondida() : -1 }; });
      // com forma própria a arquibancada do Estádio Golaço (e a marquise dela) nem existe: nada a esconder
      const okMarq = forma ? marqMax <= 0 : cob === 'nenhuma' ? marqMin > 0 : marqMax === 0;
      meta(`TM pro ${nome}: a marquise ${cob === 'nenhuma' ? 'escondida em todo o pré-jogo' : 'no lugar (o lado de lá coberto)'}; no jogo, a malha inteira de volta`, `triângulos escondidos no pré-jogo ${marqMin}–${marqMax}; depois de pular: ${fim.marq} (ativo ${fim.ativo}, tick ${fim.tick})`, `${cob === 'nenhuma' ? '> 0' : '0'}; 0 (false, 0)`, okMarq && fim.marq <= 0 && !fim.ativo && fim.tick === 0);
      meta(`TM pro ${nome}: sem erro no console`, `${erros.length - nErros}${erros.length > nErros ? ': ' + erros.slice(nErros, nErros + 2).join(' | ') : ''}`, '0', erros.length === nErros);
    }
    await navegador.close();
  }
} finally {
  await srv.fechar();
}

let falhas = 0;
for (const r of res) {
  if (!r.ok) falhas++;
  console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}\n          ${r.medido}   (alvo: ${r.alvo})`);
}
console.log(falhas ? `\nteste-prejogo: REPROVOU (${falhas})` : '\nteste-prejogo: PASSOU');
process.exit(falhas ? 1 : 0);
