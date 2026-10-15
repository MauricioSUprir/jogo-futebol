// Área técnica e treinadores NA TELA (Chromium; pedido do dono de 12/10: "quero a área técnica e o treinador"; js/tecnicos.js,
// estadio-forma.js retasAreaTecnica, render/campo.js, render/jogador3d.js). Celular deitado (844×390, Média, toque), partida
// IA × IA com a câmera de TV do celular (CAMERA.celular):
//   V1 nos instantes em que a câmera de TV mostra o lado do banco (um treinador INTEIRO dentro do quadro), os
//      treinadores APARECEM: o mesmo quadro desenhado com × sem eles (estadio.mostrarTecnicos, só o desenho) muda ≥ 40 px
//      (a 1/2 da resolução) em ≥ 90% dos instantes (≥ 8 instantes medidos); a linha da frente da área técnica dele também
//      no quadro (algum dos 5 pontos dela). "Dentro do quadro" = na tela E na frente da câmera (naTela .atras): um ponto
//      atrás da câmera cai espelhado dentro da tela — a câmera do gol (depois de um gol, na área e de costas para a área
//      técnica) contava o treinador atrás dela como "no quadro" (15/10: 3 dos 20 instantes, 0 px, na partida do #471);
//   V2 custo no desenho: as chamadas de desenho com × sem os treinadores IGUAIS (eles vão no manequim instanciado; as
//      linhas da área técnica na malha das linhas) e os triângulos a mais ≤ 2 × os de um boneco;
//   V3 custo na CPU do quadro (medirQuadro, sem o desenho): a página com os treinadores × a mesma partida com
//      ?tecnicos=0 (mesma semente), 3 blocos de 300 quadros alternados: p95 (mediana dos blocos) ≤ o sem + 1 ms;
//   V4 as LINHAS da área técnica no gramado: de uma câmera parada perto dela (sem os treinadores no desenho), os pixels
//      sobre as linhas dos lados são mais claros que a grama ao lado (≥ +25 de luminância) nas duas áreas;
//   V5 console sem erros;
//   V6 a cena de substituição (a fila de cenas da main, 15/10; 6 cenas: 1, 4 e 2 pares em lateral perto da área técnica):
//      os treinadores dão os passos da cena (o mundo parado), o ator mais perto a ≥ 0,5 m de cada um e a câmera de ala a
//      ≥ 0,6 m da cápsula deles em todos os quadros;
//   V7 (contraprova 15/10) depois de cada uma dessas cenas, no anel do replay: todo passo em que um treinador "anda" mais que
//      REPLAY.saltoTecnico desde o passo gravado antes (os passos da cena não são gravados) é um CORTE — senão o replay
//      seguinte (o "Replay" da pausa, o gol logo depois da troca) o desliza ~3 m num passo;
//   V8 (15/10) o critério "no quadro" do V1 sem depender da partida: uma câmera parada na área, na altura da câmera do
//      gol (2,6 m), de COSTAS para cada treinador (ele 37 m atrás dela, no eixo: a projeção espelhada cai no meio da tela)
//      → ele NÃO conta (e não aparece: < 40 px com × sem); a mesma câmera de frente para ele a 15 m → conta e aparece
//      (≥ 40 px). Com o naTela antigo (sem .atras; --raiz da main de 15/10) a câmera de costas o contava.
// Na versão sem os treinadores (origin/main antes desta frente) V1, V2, V4, V6 e V8 reprovam (não existem).
//   node tools/teste-tecnicos-tela.mjs [--raiz <pasta do jogo>] [--so V1,V6]   (--so V1 roda V1–V4 e V8)
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const mediana = v => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
const erros = [];
// --so V6: só uma parte (diagnóstico)
const SO = args.includes('--so') ? new Set(args[args.indexOf('--so') + 1].split(',')) : null;
const CEL = { largura: 844, altura: 390, dpr: 1, toque: true };
const URL0 = '?q=media&demo=1&semente=4&toque=1&entalhe=1&hora=dia&replay=0&comemoracao=0';

const srv = await servidor(0, raiz);
async function abrirPagina(url) {
  const nav = await abrir(CEL);
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load' });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return nav;
}

if (!SO || SO.has('V1')) try {
  const A = await abrirPagina(URL0);
  try {
    const pg = A.pagina;
    const tem = await pg.evaluate(() => typeof window.__golaco.estadio?.mostrarTecnicos === 'function' && !!window.__golaco.estadio.tecnicos);
    if (!tem) {
      meta('V1 os treinadores aparecem na TV do celular com o banco no quadro', 'sem treinadores (estadio.tecnicos/mostrarTecnicos não existem)', 'existem', false);
      meta('V2 chamadas de desenho iguais com × sem os treinadores; triângulos a mais ≤ 2 bonecos', 'sem treinadores', 'existem', false);
      meta('V4 as linhas da área técnica no gramado', 'sem área técnica', 'existem', false);
      meta('V8 o "no quadro" do V1 não conta quem está atrás da câmera', 'sem treinadores', 'existem', false);
    } else {
      // ---------------------------------------------------------------- V1 + V2
      const r = await pg.evaluate(async () => {
        const g = window.__golaco;
        const { retasAreaTecnica } = await import('./js/estadio-forma.js');
        const cv = document.querySelector('canvas');
        const off = document.createElement('canvas'); off.width = 422; off.height = 195; // a 1/2
        const cx = off.getContext('2d', { willReadFrequently: true });
        const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
        const W = window.innerWidth, H = window.innerHeight;
        // no quadro: na tela e NA FRENTE da câmera (atrás dela a projeção cai espelhada dentro da tela)
        const dentro = p => p && !p.atras && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
        const frente = retasAreaTecnica().filter(q => q.lado === 'frente');
        const inst = [], cham = [], semInst = { n: 0 };
        let k = 0;
        for (; k < 30000 && inst.length < 20; k++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          if (k % 20) continue;
          // a cabeça de um treinador no quadro (a câmera de TV olhando o lado do banco)
          // (inteiro: a cabeça e os pés, com 0,4 m para cada lado; quem está só pela metade na borda do quadro não conta)
          const tl = g.estadio.tecnicos.lista;
          const vistos = tl.filter(t => [[0, 1.8], [0, 0.03], [-0.4, 1], [0.4, 1]].every(([dx, y]) => dentro(g.naTela(t.x + dx, y, t.z))));
          if (!vistos.length) { semInst.n++; continue; }
          g.estadio.mostrarTecnicos(true); g.desenhar(); const a = ler(); const ca = g.estado().desenhoChamadas, ta = g.estado().desenhoTriangulos;
          g.estadio.mostrarTecnicos(false); g.desenhar(); const b = ler(); const cb = g.estado().desenhoChamadas, tb = g.estado().desenhoTriangulos;
          g.estadio.mostrarTecnicos(true);
          let n = 0;
          for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 20) n++;
          // a frente da área técnica de quem está no quadro (o meio da linha)
          const area = vistos.map(t => { const f = frente.find(q => q.time === t.time); return [0, 0.25, 0.5, 0.75, 1].some(u => dentro(g.naTela(f.x0 + (f.x1 - f.x0) * u, 0, (f.z0 + f.z1) / 2))); });
          inst.push({ px: n, ids: vistos.map(t => t.id), area: area.every(Boolean) });
          cham.push({ ca, cb, ta, tb });
          for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          k += 120;
        }
        return { inst, cham, passos: k, semInst: semInst.n, boneco: g.estadio.triangulosBoneco };
      });
      const vis = r.inst.filter(x => x.px >= 40).length, comArea = r.inst.filter(x => x.area).length;
      meta('V1 os treinadores aparecem na TV do celular com o banco no quadro (com × sem: ≥ 40 px a 1/2) e a frente da área técnica junto',
        `${vis}/${r.inst.length} instantes com eles visíveis (mediana ${mediana(r.inst.map(x => x.px))} px; ${r.passos} passos); área técnica no quadro em ${comArea}/${r.inst.length}`,
        '≥ 90% (≥ 8 instantes); todos', r.inst.length >= 8 && vis >= 0.9 * r.inst.length && comArea === r.inst.length);
      const difC = r.cham.filter(c => c.ca !== c.cb).length, triMax = Math.max(...r.cham.map(c => c.ta - c.tb));
      meta('V2 chamadas de desenho iguais com × sem os treinadores; triângulos a mais ≤ 2 bonecos',
        `${r.cham.length - difC}/${r.cham.length} instantes com as mesmas chamadas (${r.cham[0]?.ca ?? '-'}); triângulos a mais até ${triMax} (um boneco: ${r.boneco})`,
        `todos; ≤ ${2 * (r.boneco ?? 0)}`, r.cham.length >= 8 && difC === 0 && r.boneco > 0 && triMax <= 2 * r.boneco);
      // ---------------------------------------------------------------- V4 (as linhas no gramado)
      const v4 = await pg.evaluate(async () => {
        const g = window.__golaco;
        const { retasAreaTecnica } = await import('./js/estadio-forma.js');
        const cv = document.querySelector('canvas');
        const off = document.createElement('canvas'); off.width = 844; off.height = 390;
        const cx = off.getContext('2d', { willReadFrequently: true });
        const lum = (d, x, y) => { const i = (Math.round(y) * off.width + Math.round(x)) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
        const out = [];
        g.estadio.mostrarTecnicos(false);
        for (const t of [0, 1]) {
          const lados = retasAreaTecnica().filter(q => q.time === t && q.lado !== 'frente');
          const xm = lados.reduce((s, q) => s + (q.x0 + q.x1) / 2, 0) / 2;
          // câmera parada do campo, alta, olhando a área técnica (de frente para as placas)
          g.cameraLivre({ de: [xm, 7, 26], para: [xm, 0, 37], fov: 50 });
          g.desenhar();
          cx.drawImage(cv, 0, 0, off.width, off.height);
          const d = cx.getImageData(0, 0, off.width, off.height).data;
          let linha = 0, grama = 0, n = 0;
          for (const q of lados) {
            const xc = (q.x0 + q.x1) / 2, dentro = xc < xm ? 1 : -1;   // a grama ao lado: 0,5 m para dentro da área
            for (let s = 0.2; s <= 0.8; s += 0.15) {
              const z = q.z0 + (q.z1 - q.z0) * s;
              const p = g.naTela(xc, 0.01, z), p2 = g.naTela(xc + dentro * 0.5, 0.01, z);
              if (p.x < 1 || p.x > off.width - 2 || p.y < 1 || p.y > off.height - 2) continue;
              linha += lum(d, p.x, p.y); grama += lum(d, p2.x, p2.y); n++;
            }
          }
          out.push({ time: t, linha: linha / Math.max(1, n), grama: grama / Math.max(1, n), n });
        }
        g.estadio.mostrarTecnicos(true); g.cameraLivre(null); g.desenhar();
        return out;
      });
      meta('V4 as linhas da área técnica no gramado (câmera parada perto, sem os treinadores): mais claras que a grama ao lado',
        v4.map(o => `área ${o.time}: linha ${f2(o.linha)} × grama ${f2(o.grama)} (${o.n} pontos)`).join(' · '), '≥ +25 nas duas', v4.length === 2 && v4.every(o => o.n >= 6 && o.linha >= o.grama + 25));
      // ---------------------------------------------------------------- V8 (atrás da câmera não é "no quadro")
      const v8 = await pg.evaluate(() => {
        const g = window.__golaco;
        const cv = document.querySelector('canvas');
        const off = document.createElement('canvas'); off.width = 422; off.height = 195; // a 1/2, como o V1
        const cx = off.getContext('2d', { willReadFrequently: true });
        const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
        const W = window.innerWidth, H = window.innerHeight;
        const naTelaXY = p => p && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
        const dentro = p => naTelaXY(p) && !p.atras;                                   // o MESMO critério do V1
        const pts = t => [[0, 1.8], [0, 0.03], [-0.4, 1], [0.4, 1]].map(([dx, y]) => g.naTela(t.x + dx, y, t.z));
        const difPx = () => {
          g.estadio.mostrarTecnicos(true); g.desenhar(); const a = ler();
          g.estadio.mostrarTecnicos(false); g.desenhar(); const b = ler();
          g.estadio.mostrarTecnicos(true);
          let n = 0;
          for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 20) n++;
          return n;
        };
        const plano = (l, t) => { g.cameraLivre(l); g.desenhar(); const p = pts(t); return { conta: p.every(dentro), xy: p.every(naTelaXY), px: difPx() }; };
        const out = [];
        for (const t of g.estadio.tecnicos.lista) {
          const s = t.x < 0 ? -1 : 1;
          // a câmera do gol depois de um gol (render/camera.js CAMERA_GOL: 6,5 m antes da linha, 13 m para o lado da TV,
          // 2,6 m de altura) fica a ~(29, 23) m do treinador do lado dela; aqui, de costas para ele, no eixo
          const de = [t.x + 29 * s, 2.6, t.z - 23];
          const costas = plano({ de, para: [2 * de[0] - t.x, 2.6, 2 * de[2] - t.z], fov: 27 }, t);
          const frente = plano({ de: [t.x, 4, t.z - 15], para: [t.x, 1, t.z], fov: 27 }, t);
          out.push({ id: t.id, costas, frente });
        }
        g.cameraLivre(null); g.desenhar();
        return out;
      });
      meta('V8 o "no quadro" do V1 não conta quem está atrás da câmera (câmera na área de costas para cada treinador; de frente, conta)',
        v8.map(o => `${o.id}: de costas ${o.costas.conta ? 'CONTA' : 'não conta'} (na tela pelo x/y: ${o.costas.xy ? 'sim' : 'não'}; ${o.costas.px} px) · de frente ${o.frente.conta ? 'conta' : 'NÃO conta'} (${o.frente.px} px)`).join(' · '),
        'de costas: não conta e < 40 px; de frente: conta e ≥ 40 px', v8.length === 2 && v8.every(o => !o.costas.conta && o.costas.px < 40 && o.frente.conta && o.frente.px >= 40));
    }
    // ------------------------------------------------------------------ V3 (CPU do quadro com × sem os treinadores)
    const B = await abrirPagina(URL0 + '&tecnicos=0');
    try {
      const bloco = p => p.evaluate(() => {
        const g = window.__golaco;
        g.medirQuadro({ zerar: true });
        for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        const q = g.medirQuadro({ zerar: true });
        return { p95: q.cpu.p95, media: q.cpu.media, tec: !!window.__golaco.estadio?.tecnicos };
      });
      // as duas no mesmo ponto da partida (recomeça; aquecimento), depois blocos alternados
      for (const p of [pg, B.pagina]) await p.evaluate(() => { const g = window.__golaco; g.reiniciar({ modo: 'partida', semente: 4 }); for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      const com = [], sem = [];
      for (let b = 0; b < 3; b++) { com.push(await bloco(pg)); sem.push(await bloco(B.pagina)); }
      const pc = mediana(com.map(x => x.p95)), ps = mediana(sem.map(x => x.p95));
      meta('V3 CPU do quadro (sem o desenho) com os treinadores × ?tecnicos=0: p95 (mediana de 3 blocos de 300 quadros)',
        `com ${f2(pc)} ms (média ${f2(mediana(com.map(x => x.media)))}; treinadores ${com[0].tec}) × sem ${f2(ps)} ms (média ${f2(mediana(sem.map(x => x.media)))}; treinadores ${sem[0].tec})`,
        `≤ ${f2(ps + 1)} ms`, com[0].tec && !sem[0].tec && pc <= ps + 1);
    } finally { erros.push(...B.erros); await B.navegador.close(); }
  } finally { erros.push(...A.erros); await A.navegador.close(); }
} catch (e) {
  meta('Execução', String(e?.message ?? e).split('\n')[0], 'sem exceção', false);
}
// ------------------------------------------------------------------ V6 (a cena de substituição, 15/10)
// a fila de cenas da main (#477): na cena de substituição (o mundo parado) os treinadores continuam no desenho, dão os
// passos da cena (não congelam no meio de uma passada), saem da frente de quem sai e de quem entra e a câmera de ala
// (na beira do campo, do lado de cá) nunca fica dentro de um deles
if (!SO || SO.has('V6')) try {
  const C6 = await abrirPagina('?q=media&semente=7&toque=1&entalhe=1&hora=dia&replay=0&comemoracao=0&substituicao=1');
  try {
    const r = await C6.pagina.evaluate(async () => {
      const g = window.__golaco;
      if (!g.cenaSubst || !g.substituicaoDeTeste || !g.estadio?.tecnicos) return { sem: true };
      const { distanciaTecnico } = await import('./js/tecnicos.js');
      const out = { cenas: 0, quadros: 0, distMin: Infinity, distEx: '', camMin: Infinity, camEx: '', andaram: 0, desenhados: 0, perto: 0, saltoMax: 0, saltosSemCorte: 0, saltoEx: '' };
      // a troca num lateral em frente a uma área técnica (o lateral de substituicaoDeTeste: x = ±14, z = meioZ + 0,5) e a
      // de 5 pares dos dois times
      const casos = [{ pares: [{ sai: 9, entra: 22 }] }, { pares: [{ sai: 9, entra: 22 }, { sai: 7, entra: 17 }, { time: 1, sai: 110, entra: 120 }, { time: 1, sai: 107, entra: 117 }] }, { pares: [{ sai: 11, entra: 19 }, { sai: 2, entra: 13 }] }];
      for (const [ci, caso] of casos.entries()) {
        for (const sem of [7, 3]) {
          g.reiniciar({ modo: 'partida', semente: sem + ci * 10 });
          for (let i = 0; i < 240; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          g.substituicaoDeTeste({ pares: caso.pares, parada: 'lateral' });
          let q = 0;
          while (q < 600 && !g.cenaSubst.ativo) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
          if (!g.cenaSubst.ativo) continue;
          out.cenas++;
          const t0 = g.estadio.tecnicos.k, tickS = g.mundo.tick;
          let k = 0;
          while (g.cenaSubst.ativo && k < 900) {
            g.relogio.avancar(1000 / 60, { desenhar: k % 4 === 0 }); k++;
            if (!g.cenaSubst.ativo) break;
            out.quadros++;
            const tl = g.estadio.tecnicos.lista, at = g.cenaSubst.atores() ?? [], cp = g.cenaSubst.camera.posicao;
            for (const t of tl) {
              for (const a of at) { const d = Math.hypot(a.x - t.x, a.z - t.z); if (d < out.distMin) { out.distMin = d; out.distEx = `${t.id} × ${a.id} (${a.tipo}) ${d.toFixed(2)} m, caso ${ci}`; } if (d < 1) out.perto++; }
              if (cp) { const d = distanciaTecnico(cp.x, cp.y, cp.z, t.x, t.z); if (d < out.camMin) { out.camMin = d; out.camEx = `${t.id}: ${d.toFixed(2)} m (${g.cenaSubst.camera.nome}, caso ${ci})`; } }
            }
          }
          out.andaram += g.estadio.tecnicos.k - t0 > k * 0.5 ? 1 : 0;
          out.desenhados += g.estadio.tecnicos.lista.length === 2 ? 1 : 0;
          // V7: o jogo volta; no anel, o salto do treinador entre dois passos gravados só com corte no passo de depois
          for (let i = 0; i < 40; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          const lim = 0.25, corte = t => (typeof g.replay.corteNoAnel === 'function' ? g.replay.corteNoAnel(t) === true : false);
          for (let t = tickS - 3; t < g.mundo.tick; t++) for (const id of [210, 211]) {
            const a = g.replay.noAnel(t, id), b = g.replay.noAnel(t + 1, id);
            if (!a || !b) continue;
            const d = Math.hypot(b.x - a.x, b.z - a.z);
            if (d > out.saltoMax) out.saltoMax = d;
            if (d > lim && !corte(t + 1)) { out.saltosSemCorte++; if (!out.saltoEx) out.saltoEx = `${id}: ${d.toFixed(2)} m de ${t} a ${t + 1}, caso ${ci}`; }
          }
        }
      }
      return out;
    });
    if (r.sem) meta('V6 cena de substituição: os treinadores andam com ela, saem da frente dos atores e a câmera fica fora deles', 'sem a cena ou sem os treinadores', 'existem', false);
    else meta('V6 cena de substituição: os treinadores andam com ela, saem da frente dos atores e a câmera fica fora deles',
      `${r.cenas} cenas, ${r.quadros} quadros: dão os passos da cena em ${r.andaram}/${r.cenas}; o ator mais perto a ${f2(r.distMin)} m (${r.distEx}; a < 1 m em ${r.perto} quadros×pares); a câmera a ≥ ${f2(r.camMin)} m da cápsula (${r.camEx})`,
      '6 cenas; todas; ≥ 0,5 m; ≥ 0,6 m', r.cenas === 6 && r.andaram === r.cenas && r.distMin >= 0.5 && r.camMin >= 0.6);
    if (!r.sem) meta('V7 depois da cena: o treinador que andou nela não desliza no replay (salto > 0,25 m entre passos gravados só com corte)',
      `${r.cenas} cenas: o maior salto entre dois passos gravados ${f2(r.saltoMax)} m; sem corte ${r.saltosSemCorte}${r.saltoEx ? ` (${r.saltoEx})` : ''}`,
      '0 saltos sem corte', r.cenas === 6 && r.saltosSemCorte === 0);
  } finally { erros.push(...C6.erros); await C6.navegador.close(); }
} catch (e) { meta('V6 execução (cena de substituição)', String(e?.message ?? e).split('\n')[0], 'sem exceção', false); }
meta('V5 console sem erros', erros.length ? erros.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', erros.length === 0);
await srv.fechar();

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-tecnicos-tela: PASSOU' : '\nteste-tecnicos-tela: REPROVOU');
process.exit(ok ? 0 : 1);
