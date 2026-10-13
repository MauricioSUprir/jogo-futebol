// HUD mínimo (navegador): a tela da PARTIDA com pouca coisa por cima do jogo. Pedido do dono (11/10): "quero menos
// informação na tela", "tem muita coisa na tela", "não quero a linha de impedimento durante o jogo; quando o jogo
// parar por impedimento, aí no replay vai mostrar a linha". Diagnóstico e pesquisa: PESQUISA-ESTADIO.md, "Tela limpa".
//  H1 área do HUD no celular deitado (união geométrica: caixas visíveis do #hud + botões de toque como círculos +
//     analógico em repouso quando a opacidade passa de 0,25), no ataque E na defesa, em 844×390, 667×375 e 568×320
//     (entalhe simulado): ≤ 11% da tela no pior caso
//  H2 texto na tela durante o jogo fora do placar e dos NOMES dos botões de toque (barra de força, painel, avisos):
//     0 caracteres — nas duas fases das 3 telas e em 2 min de jogo de verdade (a barra de força aparece quando a IA
//     carrega o passe). Os nomes dos botões voltaram por pedido do dono (12/10: "coloca o nome da função do botão
//     de novo") e são medidos no H9
//  H9 nomes dos botões de toque por padrão (dono, 12/10): todo botão visível mostra o nome da função, inteiro dentro
//     do CÍRCULO do botão (a corda na altura do texto), nas duas fases das 3 telas (na versão anterior, só o ícone:
//     reprova; com os botões a 80%, "LANÇAMENTO" passava da borda — em telas pequenas vira "LANÇAR")
//  H3 torcida visível escondida pelo HUD no celular 844×390 (pixels de torcida do canvas — torcida ligada ×
//     desligada, a conta do item 10 do teste-estadio — que caem dentro das formas do HUD), 8 instantes: ≤ 15%
//  H4 linha de impedimento VIVA (com a bola rolando): 0 amostras em 2 min de jogo; a DO LANCE continua no apito
//  H5 PC 1280×720: a dica de teclas aparece no começo e some sozinha (≤ 9 s pelo relógio das animações da página, que
//     atrasa do real com a máquina carregada); depois dela, área do HUD ≤ 2,5%
//  H6 (informativo) jogadores a < 20 m da bola com ≥ 30% do corpo atrás do HUD, média por instante
//  H7 opções da pausa: "Minimapa" (padrão desligado no celular e ligado no PC) e "Nomes nos botões" (padrão
//     LIGADO desde 12/10) mudam a tela, ficam salvas e, com os dois ligados, nada encosta
//     e, na barra de cima da pausa, título, opções, tela cheia e X não encostam (folga ≥ 4 px) nas 3 telas do H1
//  H8 os ajustes de toque antigos (golaco.toque.v1) não valem mais: todo mundo recebe o padrão novo (80%, 55%)
//   node tools/teste-hud-minimo.mjs [--raiz <pasta do jogo>]   (--raiz: mede outra cópia, ex.: a base)
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const srv = await servidor(0, raiz);
const pronta = pg => pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });

// formas do HUD visíveis (no navegador): retângulos e círculos; e o texto visível fora do placar
const FORMAS = () => {
  const vis = e => e && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.01;
  const f = [];
  for (const e of document.querySelectorAll('#hud [data-caixa], #carga.visivel')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1) f.push({ nome: e.dataset.caixa || e.id, ret: [r.left, r.top, r.right, r.bottom] });
  }
  for (const e of document.querySelectorAll('#toque:not([hidden]) .btn-toque')) {
    if (getComputedStyle(e).display === 'none' || e.offsetWidth === 0) continue;
    f.push({ nome: e.id, circ: [e.offsetLeft + e.offsetWidth / 2, e.offsetTop + e.offsetHeight / 2, Math.min(e.offsetWidth, e.offsetHeight) / 2] });
  }
  const ab = document.querySelector('#toque:not([hidden]) .analogico-base');
  const op = ab ? +getComputedStyle(document.getElementById('analogico')).opacity : 0;
  if (ab && op > 0.25) { const r = ab.getBoundingClientRect(); if (r.width > 0) f.push({ nome: 'analogico', circ: [r.left + r.width / 2, r.top + r.height / 2, r.width / 2] }); }
  let fora = 0; const txt = [];
  for (const e of document.querySelectorAll('#hud *, #toque *')) {
    if (!vis(e) || e.closest('.placar') || e.closest('.btn-toque')) continue;
    for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { fora += n.textContent.trim().length; txt.push(n.textContent.trim()); }
  }
  // nomes dos botões de toque (H9): visível, com texto e inteiro dentro do botão
  const nomes = { botoes: 0, comNome: 0, sem: [] };
  for (const b of document.querySelectorAll('#toque:not([hidden]) .btn-toque')) {
    if (getComputedStyle(b).display === 'none' || b.offsetWidth === 0) continue;
    nomes.botoes++;
    const sp = b.querySelector('span'), rb = b.getBoundingClientRect(), rs = sp ? sp.getBoundingClientRect() : null;
    // inteiro dentro do CÍRCULO (não só do quadrado): na altura do texto, a corda do círculo (pela borda mais longe do
    // centro, a de cima ou a de baixo) tem de conter a largura do texto
    const cx = rb.left + rb.width / 2, cy = rb.top + rb.height / 2, raio = rb.width / 2;
    const dy = rs ? Math.max(Math.abs(rs.top - cy), Math.abs(rs.bottom - cy)) : raio;
    const meia = dy < raio ? Math.sqrt(raio * raio - dy * dy) : 0;
    const ok = sp && vis(sp) && sp.textContent.trim() && rs.width > 0 && rs.left >= cx - meia - 0.5 && rs.right <= cx + meia + 0.5;
    if (ok) nomes.comNome++; else nomes.sem.push(b.id);
  }
  return { f, fora, txt: [...new Set(txt)], nomes };
};
const AREA = (f, W, H) => {
  let n = 0, t = 0;
  for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
    t++;
    if (f.some(s => (s.ret ? x >= s.ret[0] && x <= s.ret[2] && y >= s.ret[1] && y <= s.ret[3] : (x - s.circ[0]) ** 2 + (y - s.circ[1]) ** 2 <= s.circ[2] ** 2))) n++;
  }
  return n / t;
};
/** Formas que encostam (folga 4 px; círculo × retângulo pela distância). */
const ENCOSTA = f => {
  const p = [];
  const dRet = (c, r) => Math.hypot(c[0] - Math.max(r[0], Math.min(c[0], r[2])), c[1] - Math.max(r[1], Math.min(c[1], r[3]))) - c[2];
  for (let i = 0; i < f.length; i++) for (let k = i + 1; k < f.length; k++) {
    const a = f[i], b = f[k];
    let d;
    if (a.circ && b.circ) d = Math.hypot(a.circ[0] - b.circ[0], a.circ[1] - b.circ[1]) - a.circ[2] - b.circ[2];
    else if (a.circ) d = dRet(a.circ, b.ret);
    else if (b.circ) d = dRet(b.circ, a.ret);
    else d = Math.max(a.ret[0] - b.ret[2], b.ret[0] - a.ret[2], a.ret[1] - b.ret[3], b.ret[1] - a.ret[3]);
    if (d < 4) p.push(`${a.nome} × ${b.nome}`);
  }
  return p;
};

// H1 + H2: layout nas duas fases e três telas de celular (determinístico, sem simular)
let piorArea = 0, piorTexto = 0; const txtVisto = new Set(); const linhasH1 = [];
const nomesBotoes = { botoes: 0, comNome: 0, sem: new Set() };
let piorPausa = Infinity; const linhasPausa = [];
for (const [w, h] of [[844, 390], [667, 375], [568, 320]]) {
  const { navegador, pagina } = await abrir({ largura: w, altura: h, dpr: 2, toque: true });
  try {
    await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&demo=1&semente=4`, { waitUntil: 'load' });
    await pronta(pagina);
    const r = await pagina.evaluate(([FS, AS]) => {
      const formas = eval(FS), area = eval(AS);
      const g = window.__golaco; g.relogio.usarManual(true);
      for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const out = {};
      for (const fase of ['ataque', 'defesa']) {
        const tq = document.getElementById('toque');
        tq.classList.toggle('fase-ataque', fase === 'ataque'); tq.classList.toggle('fase-defesa', fase === 'defesa');
        const x = formas();
        out[fase] = { area: area(x.f, innerWidth, innerHeight), pecas: x.f.length, fora: x.fora, txt: x.txt, nomes: x.nomes };
      }
      g.sincronizarFase?.();
      // a barra de cima da pausa (título, Minimapa, Nomes nos botões, tela cheia, X): nada encosta nem passa da janela
      g.abrirMenu?.();
      const topo = document.querySelector('.janela-menu .janela-topo');
      if (topo) {
        const pecas = [];
        for (const e of topo.children) {
          if (e.offsetParent === null) continue;
          const filhos = e.classList.contains('chips-tela') ? [...e.children].filter(c => c.offsetParent !== null) : [e];
          for (const c of filhos) { const q = c.getBoundingClientRect(); pecas.push({ nome: c.id || c.tagName, l: q.left, r: q.right }); }
        }
        pecas.sort((a, b) => a.l - b.l);
        let folga = Infinity, par = '';
        for (let i = 1; i < pecas.length; i++) { const d = pecas[i].l - pecas[i - 1].r; if (d < folga) { folga = d; par = `${pecas[i - 1].nome} × ${pecas[i].nome}`; } }
        out.pausa = { folga, par, transborda: topo.scrollWidth - topo.clientWidth };
      }
      g.fecharMenu?.();
      return out;
    }, [FORMAS.toString(), AREA.toString()]);
    for (const fase of ['ataque', 'defesa']) {
      piorArea = Math.max(piorArea, r[fase].area); piorTexto = Math.max(piorTexto, r[fase].fora);
      r[fase].txt.forEach(t => txtVisto.add(t));
      nomesBotoes.botoes += r[fase].nomes.botoes; nomesBotoes.comNome += r[fase].nomes.comNome; r[fase].nomes.sem.forEach(id => nomesBotoes.sem.add(`${w}×${h} ${fase} ${id}`));
      linhasH1.push(`${w}×${h} ${fase} ${(r[fase].area * 100).toFixed(1)}% (${r[fase].pecas} peças)`);
    }
    if (r.pausa) { linhasPausa.push(`${w}×${h} folga ${r.pausa.folga.toFixed(0)} px (${r.pausa.par})${r.pausa.transborda > 0 ? `, transborda ${r.pausa.transborda} px` : ''}`); piorPausa = Math.min(piorPausa, r.pausa.transborda > 0 ? -1 : r.pausa.folga); }
  } finally { await navegador.close(); }
}
meta('H9 nomes dos botões de toque por padrão (dono, 12/10), inteiros dentro do círculo do botão (3 telas, 2 fases)', `${nomesBotoes.comNome}/${nomesBotoes.botoes} botões com o nome${nomesBotoes.sem.size ? ' — sem: ' + [...nomesBotoes.sem].slice(0, 8).join(', ') : ''}`, 'todos', nomesBotoes.botoes > 0 && nomesBotoes.comNome === nomesBotoes.botoes);
meta('H1 área do HUD no celular (pior caso, ataque e defesa, 3 telas)', `${(piorArea * 100).toFixed(1)}% — ${linhasH1.join('; ')}`, '≤ 11%', piorArea <= 0.11);
meta('H7 barra da pausa no celular (título, opções, tela cheia, X): nada encosta nem transborda (3 telas com entalhe)', linhasPausa.join('; ') || 'sem a pausa', 'folga ≥ 4 px (a do ENCOSTA)', linhasPausa.length === 3 && piorPausa >= 4);

// H2 (jogo) + H3 + H4 + H6: jogo de verdade no celular 844×390
{
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    // ?comemoracao=0: a comemoração do gol seguraria a simulação ~5–7,5 s por gol e mudaria a linha do tempo destes 2 min
    // (o apito forçado no fim caía no meio de uma cena, o que não existe no jogo); a tela da cena é medida no
    // teste-comemoracao-tela (A5, C1)
    await pagina.goto(`${srv.url}?q=media&hora=dia&toque=1&entalhe=1&demo=1&semente=11&comemoracao=0`, { waitUntil: 'load' });
    await pronta(pagina);
    const r = await pagina.evaluate(([FS]) => {
      const formas = eval(FS);
      const g = window.__golaco; g.relogio.usarManual(true);
      const cv = document.querySelector('canvas');
      const off = document.createElement('canvas'); off.width = 211; off.height = 98;
      const cx = off.getContext('2d', { willReadFrequently: true });
      const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
      const sx = innerWidth / off.width, sy = innerHeight / off.height;
      const dentro = (f, x, y) => f.some(s => (s.ret ? x >= s.ret[0] && x <= s.ret[2] && y >= s.ret[1] && y <= s.ret[3] : (x - s.circ[0]) ** 2 + (y - s.circ[1]) ** 2 <= s.circ[2] ** 2));
      const carga = document.getElementById('carga'), cargaTipo = document.getElementById('carga-tipo');
      let torc = 0, torcEsc = 0, viva = 0, lance = 0, amostras = 0, comCarga = 0, cargaTexto = 0, textoJogo = 0;
      const txt = new Set();
      const perto = [];
      for (let k = 0; k < 8; k++) {
        for (let i = 0; i < 900; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          if (i % 6 === 0) {
            const li = g.linhaImpedimento; const rol = g.mundo.partida?.estado === 'jogo' && !(g.mundo.parada && !g.mundo.parada.rolou);
            if (rol) { amostras++; if (li?.visivel && !li.lance) viva++; if (li?.visivel && li.lance) lance++; }
            // barra de força na tela: o rótulo ("PASSE", "CHUTE") não aparece na partida
            if (carga?.classList.contains('visivel')) {
              comCarga++;
              if (cargaTipo && cargaTipo.textContent.trim() && getComputedStyle(cargaTipo).display !== 'none' && cargaTipo.offsetWidth > 0) cargaTexto++;
            }
            if (i % 60 === 0) { const x = formas(); textoJogo = Math.max(textoJogo, x.fora); x.txt.forEach(t => txt.add(t)); }
          }
        }
        g.estadio.mostrarTorcida(true); g.desenhar(); const a = ler();
        g.estadio.mostrarTorcida(false); g.desenhar(); const b = ler();
        g.estadio.mostrarTorcida(true); g.desenhar();
        const { f } = formas();
        for (let p = 0, i = 0; i < a.length; i += 4, p++) {
          if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 <= 24) continue;
          torc++;
          if (dentro(f, ((p % off.width) + 0.5) * sx, (Math.floor(p / off.width) + 0.5) * sy)) torcEsc++;
        }
        const m = g.mundo; let n = 0;
        for (const j of m.jogadores) {
          if (Math.hypot(j.x - m.bola.p.x, j.z - m.bola.p.z) >= 20) continue;
          const p0 = g.naTela(j.x, 0, j.z), p1 = g.naTela(j.x, 1.8, j.z); if (!p0 || !p1) continue;
          const hh = Math.abs(p0.y - p1.y), ww = Math.max(4, 0.4 * hh); let d = 0, t = 0;
          for (let u = 0; u < 5; u++) for (let v = 0; v < 7; v++) { t++; if (dentro(f, p0.x - ww / 2 + (ww * u) / 4, Math.min(p0.y, p1.y) + (hh * v) / 6)) d++; }
          if (d / t >= 0.3) n++;
        }
        perto.push(n);
      }
      // apito de impedimento (o lance de agora): a linha DO LANCE aparece parada no gramado
      const p = g.mundo.partida;
      p.ultimoImped = { tick: g.mundo.tick, linhaX: 18 * (g.mundo.ataca?.[0] ?? 1), id: -1, time: 0 };
      g.desenhar();
      const li = g.linhaImpedimento;
      return { torc, torcEsc, viva, lance, amostras, perto, comCarga, cargaTexto, textoJogo, txt: [...txt], apito: li ? { visivel: li.visivel, lance: li.lance, x: li.x } : null };
    }, [FORMAS.toString()]);
    piorTexto = Math.max(piorTexto, r.textoJogo + (r.cargaTexto ? 1 : 0));
    r.txt.forEach(t => txtVisto.add(t));
    meta('H2 texto fora do placar e dos nomes dos botões durante o jogo (3 telas, 2 fases e 2 min de partida)', `${piorTexto} caracteres${txtVisto.size ? ': ' + [...txtVisto].join(' ') : ''}; barra de força com rótulo em ${r.cargaTexto}/${r.comCarga} amostras`, '0', piorTexto === 0 && r.cargaTexto === 0);
    const fr = r.torcEsc / Math.max(1, r.torc);
    meta('H3 torcida visível escondida pelo HUD (celular 844×390, 8 instantes)', `${(fr * 100).toFixed(1)}% de ${r.torc} pixels de torcida`, '≤ 15%', fr <= 0.15 && r.torc > 500 && erros.length === 0);
    meta('H4 linha de impedimento viva com a bola rolando (2 min de jogo)', `${r.viva}/${r.amostras} amostras (${(100 * r.viva / Math.max(1, r.amostras)).toFixed(1)}%); linha do lance ${r.lance}`, '0', r.viva === 0 && r.amostras > 500);
    meta('H4 no apito do impedimento a linha DO LANCE aparece parada', r.apito ? `visível ${r.apito.visivel}, do lance ${r.apito.lance}, x = ${r.apito.x.toFixed(1)}` : 'sem estado', 'visível, do lance', r.apito?.visivel && r.apito.lance);
    const med = r.perto.reduce((s, v) => s + v, 0) / r.perto.length;
    meta('H6 (informativo) jogadores a < 20 m da bola atrás do HUD', `média ${med.toFixed(2)} por instante (${r.perto.join(',')})`, 'informativo', true);
  } finally { await navegador.close(); }
}

// H5: PC 1280×720 — a dica de teclas aparece no começo e some sozinha; 9 s depois o HUD ocupa ≤ 2,5%
{
  const { navegador, pagina } = await abrir({ largura: 1280, altura: 720, dpr: 1, toque: false });
  try {
    await pagina.goto(`${srv.url}?q=baixa&demo=1&semente=4`, { waitUntil: 'load' });
    await pronta(pagina);
    await pagina.waitForTimeout(1000);
    const dica0 = await pagina.evaluate(() => { const d = document.getElementById('dica'); const s = d && getComputedStyle(d); return !!d && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.5; });
    // a dica some pelo relógio das animações da página (8 s + 0,6 s de esmaecer). Com a máquina carregada o Chromium sem
    // GPU desenha poucos quadros e esse relógio atrasa ~1–2 s do real: esperar um tempo fixo media a dica ainda na tela
    // (2,5% "passando" por arredondamento). Espera o fim da animação (até 40 s reais) e mede o tempo DELA.
    const fimDica = await pagina.waitForFunction(() => {
      const d = document.getElementById('dica'); if (!d) return { ms: -1 };
      const s = getComputedStyle(d);
      if (s.visibility !== 'hidden' && +s.opacity > 0.01) return false;
      const a = d.getAnimations()[0];
      return { ms: a ? Math.round(+(a.effect?.getComputedTiming().endTime ?? a.currentTime)) : -1 };
    }, null, { timeout: 40000, polling: 250 }).then(h => h.jsonValue()).catch(() => null);
    const r = await pagina.evaluate(([FS, AS]) => { const x = eval(FS)(); return { area: eval(AS)(x.f, innerWidth, innerHeight), nomes: x.f.map(s => s.nome) }; }, [FORMAS.toString(), AREA.toString()]);
    meta('H5 área do HUD no PC 1280×720 (depois que a dica some)', `${(r.area * 100).toFixed(1)}% (${r.nomes.join(', ')})`, '≤ 2,5%', r.area <= 0.025);
    meta('H5 a dica de teclas do PC aparece no começo e some sozinha em ≤ 9 s', `${dica0 ? 'visível 1 s depois de abrir' : 'não aparece'}; ${fimDica ? `some aos ${(fimDica.ms / 1000).toFixed(1)} s de animação` : 'não some em 40 s'}`, 'visível; some ≤ 9 s',
      dica0 && fimDica && fimDica.ms > 0 && fimDica.ms <= 9000);
    const mapa = await pagina.evaluate(() => { const m = document.getElementById('minimapa'); return !!m && getComputedStyle(m).display !== 'none' && m.offsetWidth > 0; });
    meta('H7 PC: o minimapa continua ligado por padrão', String(mapa), 'true', mapa);
  } finally { await navegador.close(); }
}

// H7 + H8: opções da pausa no celular e os ajustes antigos
{
  const { navegador, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&demo=1&semente=4`, { waitUntil: 'load' });
    await pronta(pagina);
    // H8: ajustes salvos com a chave antiga (tamanho 130%, opacidade 95%) e a página aberta de novo
    await pagina.evaluate(() => { localStorage.setItem('golaco.toque.v1', JSON.stringify({ tamanho: 1.3, opacidade: 0.95 })); });
    await pagina.reload({ waitUntil: 'load' });
    await pronta(pagina);
    const aj = await pagina.evaluate(() => { const s = getComputedStyle(document.documentElement); return { tam: s.getPropertyValue('--toque-escala').trim(), opa: s.getPropertyValue('--toque-opacidade').trim(), chute: document.getElementById('btn-chute')?.offsetWidth ?? 0 }; });
    meta('H8 ajustes antigos (golaco.toque.v1) não valem: padrão novo 80% / 55%', `tamanho ${aj.tam}, opacidade ${aj.opa}, CHUTE ${aj.chute} px`, '0.8 / 0.55', +aj.tam === 0.8 && +aj.opa === 0.55);
    const estado = () => pagina.evaluate(() => {
      const m = document.getElementById('minimapa'), sp = document.querySelector('#btn-chute span');
      return {
        mapa: !!m && getComputedStyle(m).display !== 'none' && m.offsetWidth > 0,
        nomes: !!sp && getComputedStyle(sp).display !== 'none' && sp.offsetWidth > 0,
        temOpcoes: !!document.getElementById('chip-minimapa') && !!document.getElementById('chip-nomes'),
        pressionados: [document.getElementById('chip-minimapa')?.getAttribute('aria-pressed'), document.getElementById('chip-nomes')?.getAttribute('aria-pressed')].join('/'),
        // a pausa cabe sem rolar no celular deitado (como antes das opções novas)
        rola: (() => { const j = document.querySelector('.janela-menu'); return j ? j.scrollHeight - j.clientHeight : 0; })(),
      };
    });
    const e0 = await estado();
    let e1 = { mapa: false, nomes: false }, e2 = e1, e3 = { nomes: true }, enc = ['sem as opções'], menu = { pressionados: '-', rola: NaN };
    if (e0.temOpcoes) {
      await pagina.evaluate(() => window.__golaco.abrirMenu());
      menu = await estado();
      // liga o minimapa (os nomes já vêm ligados): os dois ligados
      await pagina.click('#chip-minimapa');
      await pagina.evaluate(() => window.__golaco.fecharMenu());
      await pagina.waitForTimeout(150);
      e1 = await estado();
      // ligados, nada encosta: placar, minimapa, menu e botões das duas fases (com os nomes)
      enc = await pagina.evaluate(([FS, ES]) => {
        const formas = eval(FS), encosta = eval(ES), p = [];
        for (const fase of ['ataque', 'defesa']) {
          const tq = document.getElementById('toque');
          tq.classList.toggle('fase-ataque', fase === 'ataque'); tq.classList.toggle('fase-defesa', fase === 'defesa');
          p.push(...encosta(formas().f).map(t => `${fase}: ${t}`));
        }
        window.__golaco.sincronizarFase?.();
        return p;
      }, [FORMAS.toString(), ENCOSTA.toString()]);
      await pagina.reload({ waitUntil: 'load' });
      await pronta(pagina);
      e2 = await estado();
      // desligar os nomes na pausa: só o ícone, e fica salvo
      await pagina.evaluate(() => window.__golaco.abrirMenu());
      await pagina.click('#chip-nomes');
      await pagina.evaluate(() => window.__golaco.fecharMenu());
      await pagina.reload({ waitUntil: 'load' });
      await pronta(pagina);
      e3 = await estado();
    }
    meta('H7 celular: minimapa desligado e nomes dos botões LIGADOS por padrão (dono, 12/10); opções na pausa (que cabe sem rolar)', `minimapa ${e0.mapa ? 'ligado' : 'desligado'}, nomes ${e0.nomes ? 'ligados' : 'desligados'}, opções ${e0.temOpcoes ? `na pausa (marcadas ${menu.pressionados}), pausa rola ${menu.rola} px` : 'NÃO existem'}`, 'minimapa não, nomes sim, opções na pausa (false/true), rola ≤ 0 px', !e0.mapa && e0.nomes && e0.temOpcoes && menu.pressionados === 'false/true' && menu.rola <= 0);
    meta('H7 celular: com o minimapa ligado na pausa os dois aparecem, nada encosta e fica salvo; desligar os nomes deixa só o ícone (salvo)', `ligados: minimapa ${e1.mapa}, nomes ${e1.nomes}${enc.length ? ' — encosta: ' + enc.join('; ') : ''}; depois de abrir de novo: minimapa ${e2.mapa}, nomes ${e2.nomes}; nomes desligados e aberto de novo: ${e3.nomes ? 'ainda aparecem' : 'só o ícone'}`, 'tudo true, nada encosta; depois só o ícone',
      e1.mapa && e1.nomes && enc.length === 0 && e2.mapa && e2.nomes && !e3.nomes && erros.length === 0);
  } finally { await navegador.close(); }
}
await srv.fechar();
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.every(r => r.ok);
console.log(ok ? '\nteste-hud-minimo: PASSOU' : '\nteste-hud-minimo: REPROVOU');
process.exit(ok ? 0 : 1);
