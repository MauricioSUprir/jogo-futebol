// Rede no navegador (Chromium, WebGL de verdade): a rede DESENHADA é véu de noiva, BRANCA de dia e de noite e
// MEXE na tela quando a bola bate (pedido do dono, 11/10). Monta o estádio com os MESMOS módulos da página
// (render/cena.js criarCena + render/campo.js criarCampo, numa tela à parte) e desenha o gol +x de três câmeras
// fixas — a de TV (a do jogo com o foco no limite perto do gol), a câmera do gol (camera.js CAMERA_GOL) e uma de
// perfil —, com e sem a malha da rede (a cor do fio sem misturar com o fundo) e com e sem uma batida no pico da
// bolsa (render/rede-onda.js registrarImpacto/uniformsRede nos uniforms da rede). PC 1280×720 Alta e celular
// 844×390 dpr 2 Média, dia e noite.
//   1) forma (geometria da malha): véu — no chão ≥ 2,4 m atrás da linha, no alto ≤ 0,6 m, sem teto plano, a
//      profundidade caindo com a altura;
//   2) branca: o fio de perto (câmera a ~1,1 m da rede; percentil 90 do L* dos pixels que mudam com a rede) com
//      L* ≥ 85 de dia e ≥ 80 à noite, saturação ≤ 0,08, sem estourar (≤ 5% em 255); nas câmeras do gol e de perfil a
//      rede CLAREIA o gol (L* com a rede − L* sem ela ≥ +12 em ≥ 15% da caixa do gol; o fio com saturação ≤ 0,12); na
//      TV, ≥ +5 em ≥ 15%;
//   3) mexe: na câmera do gol ≥ 4% dos pixels do gol mudam > 20 no pico da bolsa; na TV ≥ 1%.
// Não depende da IA, do goleiro nem de semente. A versão publicada antes do véu (rede-caixote cinza) reprova (21 itens).
//   node tools/teste-rede-tela.mjs [--raiz <pasta do jogo>] [--so pc-dia,...] [--prints <pasta>]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const so = arg('--so', '') ? new Set(arg('--so', '').split(',')) : null;
const pastaPrints = arg('--prints', '') ? path.resolve(arg('--prints', '')) : null;
if (pastaPrints) fs.mkdirSync(pastaPrints, { recursive: true });

const CONFIGS = [
  { nome: 'pc-dia', w: 1280, h: 720, dpr: 1, toque: false, q: 'alta', hora: 'dia' },
  { nome: 'pc-noite', w: 1280, h: 720, dpr: 1, toque: false, q: 'alta', hora: 'noite' },
  { nome: 'cel-dia', w: 844, h: 390, dpr: 2, toque: true, q: 'media', hora: 'dia' },
  { nome: 'cel-noite', w: 844, h: 390, dpr: 2, toque: true, q: 'media', hora: 'noite' },
];
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : String(v));

const srv = await servidor(0, raiz);
for (const c of CONFIGS) {
  if (so && !so.has(c.nome)) continue;
  const { navegador, pagina: pg, erros } = await abrir({ largura: c.w, altura: c.h, dpr: c.dpr, toque: c.toque });
  pg.setDefaultTimeout(180000);
  try {
    await pg.goto(`${srv.url}?prints=1&semente=5&q=${c.q}&hora=${c.hora}${c.toque ? '&toque=1' : ''}`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    const r = await pg.evaluate(async cfg => {
      const g = window.__golaco;
      g.relogio.usarManual(true);
      const THREE = await import('three');
      const { criarCena } = await import('./js/render/cena.js');
      const { criarCampo } = await import('./js/render/campo.js');
      const RO = await import('./js/render/rede-onda.js');
      const { CAMPO, CAMERA } = await import('./js/config.js');
      const { CAMERA_GOL } = await import('./js/render/camera.js');
      let RF = null; try { RF = await import('./js/rede-forma.js'); } catch (_) { RF = null; }
      const MX = CAMPO.meioX, HG = CAMPO.gol.altura, ZL = CAMPO.gol.largura / 2;
      const canvas = document.createElement('canvas');
      const cena3d = criarCena({ canvas, qualidade: cfg.q, hora: cfg.hora });
      cena3d.redimensionar(cfg.w, cfg.h);
      const campo = criarCampo({ qualidade: cfg.q, aniso: cena3d.anisotropia() });
      cena3d.cena.add(campo.grupo);
      campo.definirHora(cfg.hora);
      const gl = cena3d.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const cam = new THREE.PerspectiveCamera(32, cfg.w / cfg.h, 0.5, 900);
      const malha = campo.rede.mesh;

      // 1) forma: a malha da rede do gol +x
      const pos = malha.geometry.attributes.position;
      let fundoChao = 0, fundoAlto = 0, teto = 0;
      const faixas = [[0, 0.4], [0.8, 1.2], [1.6, 2.0], [2.2, HG + 0.01]].map(() => 0);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        if (x <= 0) continue;
        const X = x - MX;
        if (y < 0.05) fundoChao = Math.max(fundoChao, X);
        if (y > HG - 0.05) fundoAlto = Math.max(fundoAlto, X);
        if (y > HG - 0.02 && X > 0.8) teto++;
        [[0, 0.4], [0.8, 1.2], [1.6, 2.0], [2.2, HG + 0.01]].forEach(([a, b], k) => { if (y >= a && y <= b) faixas[k] = Math.max(faixas[k], X); });
      }
      const forma = { fundoChao, fundoAlto, teto, faixas, vertices: pos.count, triangulos: malha.geometry.index.count / 3 };

      // câmeras: TV (foco no limite perto do gol), câmera do gol (CAMERA_GOL) e perfil
      const pequena = Math.min(cfg.w, cfg.h) < 520;
      const tv = pequena ? { ...CAMERA, ...CAMERA.celular } : CAMERA;
      const fx = MX - 14;
      const cams = {
        tv: { de: [fx, tv.altura, tv.distancia], para: [fx, 0, 0], fov: 2 * Math.atan(CAMERA.largura * (pequena ? CAMERA.telaPequena : 1) / (cfg.w / cfg.h) / 2 / Math.hypot(tv.altura, tv.distancia)) * 180 / Math.PI },
        gol: { de: [MX - CAMERA_GOL.recuo, CAMERA_GOL.altura, CAMERA_GOL.lateral], para: [MX + CAMERA_GOL.olharAlem, CAMERA_GOL.olharY, 0], fov: CAMERA_GOL.fov },
        perfil: { de: [MX + 1.4, 1.5, 13.5], para: [MX + 1.4, 1.2, 0], fov: 32 },
        // de perto, de dentro do gol olhando a rede de fundo a ~1,1 m: o fio com vários pixels (a cor dele, sem mistura)
        macro: { de: [MX + 0.15, 1.0, 0.4], para: [MX + 1.6, 1.0, -0.3], fov: 40 },
      };
      const caixa = c => {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const x of [MX - 0.1, MX + 3.0]) for (const y of [0, 2.7]) for (const z of [-ZL - 0.2, ZL + 0.2]) {
          const v = new THREE.Vector3(x, y, z).project(cam);
          const px = (v.x + 1) / 2 * W, py = (v.y + 1) / 2 * H;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        const cl = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
        return { x0: cl(x0, 0, W - 1), y0: cl(y0, 0, H - 1), x1: cl(x1, 1, W), y1: cl(y1, 1, H) };
      };
      function quadro(cn) {
        const c = cams[cn];
        cam.fov = c.fov; cam.aspect = cfg.w / cfg.h; cam.position.set(...c.de); cam.lookAt(...c.para); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        cena3d.acompanhar(c.para[0], c.para[2]);
        cena3d.desenhar(cam);
        const px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px;
      }
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const Lstar = (r, g2, b) => { const Y = 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
      function comparar(A, B, cx) {
        let n = 0, m8 = 0, m20 = 0, sL = 0, sLf = 0, nm = 0;
        const lista = [];
        for (let y = cx.y0; y < cx.y1; y++) for (let x = cx.x0; x < cx.x1; x++) {
          const i = 4 * (y * W + x);
          const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
          n++;
          if (d > 8) { m8++; sL += Lstar(A[i], A[i + 1], A[i + 2]); sLf += Lstar(B[i], B[i + 1], B[i + 2]); nm++; }
          if (d > 20) { m20++; lista.push([d, A[i], A[i + 1], A[i + 2]]); }
        }
        lista.sort((a, b) => b[0] - a[0]);
        // os pixels mais claros com a rede (o fio cheio): percentil 90 de L* entre os que mudam
        const Ls = lista.map(([, r, g2, b]) => [Lstar(r, g2, b), r, g2, b]).sort((a, b) => a[0] - b[0]);
        const p90 = Ls.length ? Ls[Math.floor(Ls.length * 0.9)] : null;
        let nClip = 0; for (const [, r, g2, b] of lista) if (r >= 250 && g2 >= 250 && b >= 250) nClip++;
        const top = lista.slice(0, Math.max(1, Math.round(lista.length * 0.25)));
        let tL = 0, tS = 0, tC = 0, tR = 0, tG = 0, tB = 0;
        for (const [, r, g2, b] of top) { const mx = Math.max(r, g2, b), mn = Math.min(r, g2, b); tL += Lstar(r, g2, b); tS += mx ? (mx - mn) / mx : 0; if (r >= 250 && g2 >= 250 && b >= 250) tC++; tR += r; tG += g2; tB += b; }
        const nt = lista.length ? top.length : 0;
        return {
          n, frac8: m8 / n, frac20: m20 / n, dL: nm ? (sL - sLf) / nm : 0,
          p90: p90 ? { L: p90[0], cor: p90.slice(1), sat: Math.max(...p90.slice(1)) ? (Math.max(...p90.slice(1)) - Math.min(...p90.slice(1))) / Math.max(...p90.slice(1)) : 0, clip: lista.length ? nClip / lista.length : 0 } : null,
          fio: nt ? { L: tL / nt, sat: tS / nt, clip: tC / nt, cor: [Math.round(tR / nt), Math.round(tG / nt), Math.round(tB / nt)] } : null,
        };
      }
      // batida sintética no véu/fundo do gol +x (a 0,9 m de altura, 1 m para o lado), 22 m/s, no pico da bolsa
      const est = RO.criarOndas();
      const Xb = RF ? RF.profundidadeVeu(0.9) : CAMPO.gol.profundidade;
      RO.registrarImpacto(est, { plano: 4, x: MX + Xb, y: 0.9, z: -1.0, vel: 22, sinal: 1 }, 10);
      const parar = () => RO.uniformsRede(est, -1e9, campo.rede.a, campo.rede.b);
      const pico = () => RO.uniformsRede(est, 10 + RO.TEMPO_PICO, campo.rede.a, campo.rede.b);
      const saida = { forma, cams: {} };
      const imgs = {};
      for (const cn of Object.keys(cams)) {
        if (cn === 'macro') { parar(); malha.visible = true; const com = quadro(cn); const cx = { x0: 0, y0: 0, x1: W, y1: H }; malha.visible = false; const sem = quadro(cn); malha.visible = true; saida.cams[cn] = { caixa: cx, cor: comparar(com, sem, cx), mov: { frac20: 0, frac8: 0 } }; if (cfg.prints) imgs[cn] = (() => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g2 = cv.getContext('2d'), im = g2.createImageData(W, H); for (let y = 0; y < H; y++) im.data.set(com.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); g2.putImageData(im, 0, 0); return cv.toDataURL('image/png').split(',')[1]; })(); continue; }
        parar();
        malha.visible = true; const com = quadro(cn);
        const cx = caixa(cn);
        malha.visible = false; const sem = quadro(cn);
        malha.visible = true;
        pico(); const mexe = quadro(cn);
        parar();
        const cor = comparar(com, sem, cx), mov = comparar(mexe, com, cx);
        saida.cams[cn] = { caixa: cx, cor, mov: { frac20: mov.frac20, frac8: mov.frac8 } };
        // imagens (para conferência): com a rede parada e no pico
        const png = px => {
          const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
          const g2 = cv.getContext('2d'), im = g2.createImageData(W, H);
          for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
          g2.putImageData(im, 0, 0);
          return cv.toDataURL('image/png').split(',')[1];
        };
        if (cfg.prints) { imgs[cn] = png(com); imgs[cn + '-pico'] = png(mexe); }
      }
      cena3d.renderer.dispose();
      return { ...saida, imgs };
    }, { ...c, prints: !!pastaPrints });
    if (pastaPrints) for (const [k, b64] of Object.entries(r.imgs)) fs.writeFileSync(path.join(pastaPrints, `${c.nome}-${k}.png`), Buffer.from(b64, 'base64'));
    const F = r.forma;
    if (c.nome === 'pc-dia' || (so && ![...so].includes('pc-dia') && res.length === 0)) {
      const desce = F.faixas.every((v, k) => k === 0 || v <= F.faixas[k - 1] - 0.2);
      meta('Forma: véu de noiva (malha da rede, gol +x)', `chão ${f(F.fundoChao)} m · alto ${f(F.fundoAlto)} m · teto ${F.teto} vértice(s) · por altura ${F.faixas.map(v => f(v)).join(' → ')} m · ${F.vertices} vértices, ${F.triangulos} triângulos`,
        'chão ≥ 2,4 · alto ≤ 0,6 · sem teto · cai ≥ 0,2 m por faixa', F.fundoChao >= 2.4 && F.fundoAlto <= 0.6 && F.teto === 0 && desce);
    }
    const noite = c.hora === 'noite', Lmin = noite ? 80 : 85;
    const k = r.cams.macro.cor.p90;
    meta(`Branca (${c.nome}): cor do fio de perto (percentil 90)`, k ? `rgb(${k.cor.join(', ')}), L* ${f(k.L, 1)}, saturação ${f(k.sat)}, estourado ${f(k.clip * 100, 1)}%` : 'sem rede na tela',
      `L* ≥ ${Lmin}, saturação ≤ 0,08, ≤ 5% estourado`, k && k.L >= Lmin && k.sat <= 0.08 && k.clip <= 0.05);
    for (const cn of ['gol', 'perfil']) {
      const q = r.cams[cn].cor;
      meta(`Branca (${c.nome}, câmera ${cn === 'gol' ? 'do gol' : 'de perfil'}): a rede clareia o gol`, `ΔL* ${f(q.dL, 1)} em ${f(q.frac8 * 100, 1)}% da caixa; fio (25% que mais mudam) L* ${f(q.fio?.L, 1)}, sat ${f(q.fio?.sat)}`,
        'ΔL* ≥ +12 em ≥ 15%; sat ≤ 0,12', q.dL >= 12 && q.frac8 >= 0.15 && q.fio && q.fio.sat <= 0.12);
    }
    const tvc = r.cams.tv.cor;
    meta(`Branca na TV (${c.nome}): a rede clareia o gol`, `ΔL* ${f(tvc.dL, 1)} em ${f(tvc.frac8 * 100, 1)}% da caixa do gol`, 'ΔL* ≥ +5 em ≥ 15%', tvc.dL >= 5 && tvc.frac8 >= 0.15);
    meta(`Mexe (${c.nome}): pico da bolsa × parada`, `câmera do gol ${f(r.cams.gol.mov.frac20 * 100, 1)}% · TV ${f(r.cams.tv.mov.frac20 * 100, 1)}% · perfil ${f(r.cams.perfil.mov.frac20 * 100, 1)}% dos pixels do gol`, 'gol ≥ 4% · TV ≥ 1%', r.cams.gol.mov.frac20 >= 0.04 && r.cams.tv.mov.frac20 >= 0.01);
    // (o 404 de js/rede-forma.js numa versão sem o módulo é do próprio teste)
    const errosR = erros.filter(e => !/status of 404/.test(e));
    if (errosR.length) meta(`Sem erro no console (${c.nome})`, errosR.slice(0, 2).join(' | '), 'nenhum', false);
  } catch (e) {
    meta(`Rodou (${c.nome})`, e.message.split('\n')[0], 'sem erro', false);
  } finally {
    await navegador.close();
  }
}
await srv.fechar();
const w = [0, 0];
for (const m of res) { w[0] = Math.max(w[0], m.nome.length); w[1] = Math.max(w[1], m.medido.length); }
for (const m of res) console.log(`${m.ok ? 'PASSOU  ' : 'REPROVOU'} | ${m.nome.padEnd(w[0])} | ${m.medido.padEnd(Math.min(w[1], 120))} | ${m.alvo}`);
const falhas = res.filter(m => !m.ok).length;
console.log(falhas ? `\nteste-rede-tela: REPROVOU (${falhas})` : '\nteste-rede-tela: PASSOU');
process.exit(falhas ? 1 : 0);
