// Bolas paradas no estilo FIFA na tela (pedido do dono, 16/10; carregado SOB DEMANDA pelo main.js na 1ª bola parada da
// partida: fora do download inicial). Contrato "Cobrança mirada e câmera da bola parada" no CONTRATOS.md; pesquisa em
// PESQUISA-ETAPA4.md §12 (e §12.1, item 65). Só lê o mundo (o hash não muda).
//  - Câmera atrás do cobrador (escanteio, tiro livre, tiro de meta e pênalti do humano; pênalti contra): o plano em
//    render/plano-bola-parada.js (puro) — no escanteio, alta (item 66: a área inteira grande no quadro).
//  - A mira da cobrança (item 65, dono 23/10: "tem que estar com a cara do Total Match, alguma coisa mais minimalista"): a
//    linha da física (mira-linha.js preverMira) desenhada FINA e de largura constante na tela — miolo branco e contorno preto
//    do TM, esmaecendo no fim, sem seta —, só a parte do plano (mira-linha.js desenhoDaMira: ALTA/TENSA até 45% do arco até
//    o alvo); o ANEL verde do TM no chão no alvo do voo (ALTA/TENSA) e o ARCO verde ao lado da bola, do lado da curva (28° por
//    degrau; com curva 0, nada). Uma malha, uma chamada de desenho, um ShaderMaterial pequeno com o antisserrilhado próprio
//    (a Média e a Baixa não têm MSAA) e sem teste de profundidade (por cima do cobrador, como no EA FC). Some no chute.
//  - Sem painel e sem texto na tela (o rótulo do tipo continua nos dados: preverMira().rotulo); as classes da página:
//    html.mira-visivel (o minimapa sai) e html.cobranca-mirada (PEGAR/TROCAR da bola na mão saem das vagas d/e). Os
//    chevrons ‹ › do gesto da curva no toque (entrada.js definirCurva: .toque.curva-arrasto) têm o CSS aqui.
import * as THREE from 'three';
import { CAMPO, MIRA, BOLA } from '../config.js';
import { alvoPadrao, chuteAGol, comTrajetoria } from '../mira.js';
import { CAMERA_BOLA_PARADA, CAMERA_ESCANTEIO, planoBolaParada, perfilBolaParada } from './plano-bola-parada.js';
// o plano da câmera (puro, testado em Node) mora em render/plano-bola-parada.js
export { CAMERA_BOLA_PARADA, CAMERA_ESCANTEIO, planoBolaParada, perfilBolaParada };
import { preverMira, desenhoDaMira } from '../mira-linha.js';

const TIPOS_CAM = ['escanteio', 'tiroLivre', 'tiroDeMeta', 'penalti'];

// os chevrons do gesto (item 65): ~4×8,5 px (um quadrado de 6 px girado com o traço de 2 px em dois lados), perto da borda do
// círculo e 9 px acima do centro, ao lado do ícone (o nome do botão fica logo abaixo do centro e, nos botões pequenos, ocupa
// quase toda a largura: teste-hud-minimo H9c, ≥ 1 px dele e ≥ 2 px da borda); verde do TM com o botão solto e preto do TM no
// verde do .ativo; o lado do arrasto (data-curva) em α 1, o outro em 0,35
const CSS = `
html.mira-visivel .minimapa { display: none; }
.toque.curva-arrasto .btn-chute::before, .toque.curva-arrasto .btn-chute::after,
.toque.curva-arrasto .btn-lancamento::before, .toque.curva-arrasto .btn-lancamento::after {
  content: ''; position: absolute; top: 50%; width: 6px; height: 6px; margin-top: -12px; box-sizing: border-box; pointer-events: none;
  border: solid var(--tm-verde, #22c55e); filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.7)); }
.toque.curva-arrasto .btn-chute::before, .toque.curva-arrasto .btn-lancamento::before { left: 7px; border-width: 0 0 2px 2px; transform: rotate(45deg); }
.toque.curva-arrasto .btn-chute::after, .toque.curva-arrasto .btn-lancamento::after { right: 7px; border-width: 2px 2px 0 0; transform: rotate(45deg); }
.toque.curva-arrasto .btn-toque.ativo::before, .toque.curva-arrasto .btn-toque.ativo::after { border-color: #050807; filter: none; }
.toque.curva-arrasto .btn-toque[data-curva="d"]::before, .toque.curva-arrasto .btn-toque[data-curva="e"]::after { opacity: 0.35; }`;

/**
 * O desenho da mira (item 65). Cores iguais com ?tm e sem (constantes do módulo, não do CSS): o miolo da linha branco (a única
 * cor ≥ 3:1 em todo gramado medido, dia e noite: 3,7–8,0:1), o contorno preto do TM a α 0,8 (separa a linha do gramado claro:
 * 3,4–4,3:1), o verde do TM (#22c55e) no que a pessoa controla — o anel e o arco —, sempre com o contorno. Larguras em px CSS
 * pela altura H da tela: max(a, b·H) — a linha 2 px de miolo + 1 de contorno de cada lado no celular (4 px), 3,6 + 1,4 no PC
 * (6,5 px); o verde 2,5 / 4,7 px de miolo. `aa`: px de geometria além do contorno (o antisserrilhado).
 */
export const MIRA_DESENHO = {
  alfaContorno: 0.8,
  linha: { miolo: [2, 0.005], contorno: [1, 0.002] },
  verde: { miolo: [2.5, 0.0065], contorno: [1, 0.002] },
  aa: 0.75,
  // o arco da curva: 28° por degrau (0,25), centrado na horizontal, do lado da curva; raio = max(1,6 × o raio da bola na
  // tela, 0,026·H) px — ≥ 4 px de arco por degrau também em 568×320 (com 0,024·H, 3,75 px); um ponto a cada 7°
  arco: { grausPorDegrau: 28, raioBola: 1.6, raioTela: 0.026, passoGraus: 7 },
  // o anel do alvo: o raio da marca de queda (render/marcas.js), no gramado
  anel: { raio: 0.9, lados: 32, y: 0.03 },
  acende: 0.15, // s até a linha acender (some na hora no chute)
};
const px = (par, H) => Math.max(par[0], par[1] * H);
const COR_LINHA = new THREE.Color(0xffffff), COR_VERDE = new THREE.Color(0x22c55e);
const MAX_P = MIRA.maxPontos + 2 + 17 + MIRA_DESENHO.anel.lados + 1;

const VERT = `
attribute float aLado;
attribute vec3 aLarg;
attribute vec4 aCor;
varying float vD;
varying vec3 vLarg;
varying vec4 vCor;
void main() {
  vD = aLado * aLarg.x; vLarg = aLarg; vCor = aCor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// d = a distância ao eixo em px CSS; o miolo e a borda pelo smoothstep de 1 pixel do aparelho (fwidth): sem MSAA o contorno de
// 1 px não pisca
const FRAG = `
uniform vec3 uContorno;
uniform float uAlfaContorno;
varying float vD;
varying vec3 vLarg;
varying vec4 vCor;
void main() {
  float d = abs(vD);
  float aa = max(fwidth(vD), 1e-3);
  float miolo = 1.0 - smoothstep(vLarg.z - 0.5 * aa, vLarg.z + 0.5 * aa, d);
  float borda = 1.0 - smoothstep(vLarg.y - aa, vLarg.y, d);
  float a = borda * mix(uAlfaContorno, 1.0, miolo) * vCor.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uContorno, vCor.rgb, miolo), a);
  #include <colorspace_fragment>
}`;

/** A malha da mira: polilinhas (a linha, o arco, o anel) de 2 vértices por ponto, viradas para a câmera, numa chamada só. */
function criarLinha(cena) {
  const N = MAX_P, D = MIRA_DESENHO;
  const pos = new Float32Array(N * 6), larg = new Float32Array(N * 6), cor = new Float32Array(N * 8), lado = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { lado[i * 2] = -1; lado[i * 2 + 1] = 1; }
  const idx = new Uint16Array((N - 1) * 6);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aLarg = new THREE.BufferAttribute(larg, 3), aCor = new THREE.BufferAttribute(cor, 4), aIdx = new THREE.BufferAttribute(idx, 1);
  for (const a of [aPos, aLarg, aCor, aIdx]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('aLarg', aLarg); geo.setAttribute('aCor', aCor);
  geo.setAttribute('aLado', new THREE.BufferAttribute(lado, 1)); geo.setIndex(aIdx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uContorno: { value: new THREE.Color(0x050807) }, uAlfaContorno: { value: D.alfaContorno } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'linha-mira'; malha.renderOrder = 6; malha.frustumCulled = false; malha.visible = false;
  cena.add(malha);

  // o quadro: a câmera (olho, direita, cima, frente) e k = m por px CSS a 1 m de profundidade
  const C = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, ux: 0, uy: 0, uz: 0, fx: 0, fy: 0, fz: 0, k: 0, H: 1 };
  let nv = 0, ni = 0;
  /** Um ponto da polilinha (2 vértices): o centro, a tangente, a meia largura total e a do miolo (px CSS), a cor e a opacidade. */
  function ponto(x, y, z, tx, ty, tz, meia, miolo, rgb, a) {
    const vx = C.x - x, vy = C.y - y, vz = C.z - z;
    let ox = ty * vz - tz * vy, oy = tz * vx - tx * vz, oz = tx * vy - ty * vx;
    const prof = Math.max(0.05, (x - C.x) * C.fx + (y - C.y) * C.fy + (z - C.z) * C.fz);
    const G = meia + D.aa, w = G * C.k * prof / (Math.hypot(ox, oy, oz) || 1);
    ox *= w; oy *= w; oz *= w;
    const p = nv * 6, q = nv * 8;
    pos[p] = x - ox; pos[p + 1] = y - oy; pos[p + 2] = z - oz; pos[p + 3] = x + ox; pos[p + 4] = y + oy; pos[p + 5] = z + oz;
    larg[p] = larg[p + 3] = G; larg[p + 1] = larg[p + 4] = meia; larg[p + 2] = larg[p + 5] = miolo;
    cor[q] = cor[q + 4] = rgb.r; cor[q + 1] = cor[q + 5] = rgb.g; cor[q + 2] = cor[q + 6] = rgb.b; cor[q + 3] = cor[q + 7] = a;
    nv++;
  }
  /** Fecha a polilinha que começou no ponto n0 (os triângulos entre os pontos dela). */
  function fechar(n0) {
    for (let i = n0; i < nv - 1; i++) {
      const a = i * 2;
      idx[ni] = a; idx[ni + 1] = a + 1; idx[ni + 2] = a + 2; idx[ni + 3] = a + 1; idx[ni + 4] = a + 3; idx[ni + 5] = a + 2;
      ni += 6;
    }
  }
  const plano = {}, s = new Float64Array(MIRA.maxPontos);
  let vis = 0, est = null;
  const lerp = (a, b, t) => a + (b - a) * t;
  return {
    malha,
    get estado() { return est ?? { visivel: false, pontos: 0, desenhados: 0, opacidade: 0, larguraPx: null, verdePx: null, arco: null, alvo: null, anel: null, fimVisivel: null, tipo: null, triangulos: 0 }; },
    /** m = o mundo (a bola), pts/info = preverMira (info null: some), cam = a câmera three.js do quadro. */
    atualizar(m, pts, info, cam, dt) {
      const ativo = !!info && info.n >= 2;
      vis = ativo ? (info.carregando ? 1 : Math.min(1, vis + dt / D.acende)) : 0; // some na hora no chute
      malha.visible = vis > 0.01;
      if (!malha.visible) { est = null; return; }
      const e = cam.matrixWorld.elements, H = Math.max(1, window.innerHeight);
      C.x = e[12]; C.y = e[13]; C.z = e[14];
      C.rx = e[0]; C.ry = e[1]; C.rz = e[2]; C.ux = e[4]; C.uy = e[5]; C.uz = e[6]; C.fx = -e[8]; C.fy = -e[9]; C.fz = -e[10];
      C.k = 2 * Math.tan((cam.fov * Math.PI) / 360) / (H * (cam.zoom || 1)); C.H = H;
      const mioloL = px(D.linha.miolo, H), contL = px(D.linha.contorno, H), meiaL = mioloL / 2 + contL;
      const mioloV = px(D.verde.miolo, H), contV = px(D.verde.contorno, H), meiaV = mioloV / 2 + contV;
      nv = 0; ni = 0;
      // 1) a linha: do começo (inicio m de arco) ao fim do plano, a opacidade entrando, cheia e esmaecendo até 0 no fim
      const d = desenhoDaMira(info, pts, plano), n = Math.min(info.n, d.iFim + 1);
      s[0] = 0;
      for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2], pts[i * 3 + 2] - pts[i * 3 - 1]);
      const alfa = u => vis * (u < d.entra ? Math.max(0, (u - d.inicio) / Math.max(1e-6, d.entra - d.inicio)) : u <= d.esmaece ? 1 : Math.max(0, (d.fim - u) / Math.max(1e-6, d.fim - d.esmaece)));
      const n0 = nv;
      const emArco = (u, out) => { // o ponto e a tangente a u m de arco (entre os pontos da física)
        let i = 1; while (i < n - 1 && s[i] < u) i++;
        const t = (u - s[i - 1]) / Math.max(1e-9, s[i] - s[i - 1]), a = (i - 1) * 3, b = i * 3;
        out[0] = lerp(pts[a], pts[b], t); out[1] = lerp(pts[a + 1], pts[b + 1], t); out[2] = lerp(pts[a + 2], pts[b + 2], t);
        out[3] = pts[b] - pts[a]; out[4] = pts[b + 1] - pts[a + 1]; out[5] = pts[b + 2] - pts[a + 2];
        return out;
      };
      const q = [0, 0, 0, 0, 0, 0];
      if (n >= 2 && d.fim > d.inicio + 0.05) {
        emArco(d.inicio, q); ponto(q[0], q[1], q[2], q[3], q[4], q[5], meiaL, mioloL / 2, COR_LINHA, alfa(d.inicio));
        for (let i = 1; i < n; i++) {
          if (s[i] <= d.inicio || s[i] >= d.fim) continue;
          const a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3;
          ponto(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], pts[b] - pts[a], pts[b + 1] - pts[a + 1], pts[b + 2] - pts[a + 2], meiaL, mioloL / 2, COR_LINHA, alfa(s[i]));
        }
        emArco(Math.min(d.fim, s[n - 1]), q); ponto(q[0], q[1], q[2], q[3], q[4], q[5], meiaL, mioloL / 2, COR_LINHA, alfa(d.fim));
        fechar(n0);
      }
      const desenhados = nv - n0;
      // 2) o anel do alvo (ALTA e TENSA): no gramado, o raio da marca de queda
      let anel = null;
      if (d.alvo) {
        const A = D.anel, a0 = nv;
        for (let j = 0; j <= A.lados; j++) {
          const t = (j / A.lados) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
          ponto(d.alvo.x + A.raio * c, A.y, d.alvo.z + A.raio * sn, -sn, 0, c, meiaV, mioloV / 2, COR_VERDE, vis);
        }
        fechar(a0);
        anel = { x: d.alvo.x, z: d.alvo.z, raio: A.raio };
      }
      // 3) o arco da curva: junto da bola, no plano da tela, do lado da curva (a direita de quem bate é a direita da tela com a
      // câmera atrás do cobrador; a conta pelo lado mesmo assim: a mistura com a TV), 28° por degrau; com curva 0, nada
      let arco = null;
      if (comTrajetoria(info.tipo) && info.curva !== 0 && m) {
        const A = D.arco, b = m.bola.p;
        const prof = Math.max(0.3, (b.x - C.x) * C.fx + (b.y - C.y) * C.fy + (b.z - C.z) * C.fz);
        const bolaPx = BOLA.raio / (C.k * prof), raioPx = Math.max(A.raioBola * bolaPx, A.raioTela * H), R = raioPx * C.k * prof;
        // a direita de quem bate (−sen, cos da mira) na direita da tela?
        const dirTela = -Math.sin(info.ang) * C.rx + Math.cos(info.ang) * C.rz;
        const lado = Math.sign(info.curva) * (dirTela >= 0 ? 1 : -1), t0 = lado > 0 ? 0 : Math.PI;
        const graus = (A.grausPorDegrau * Math.abs(info.curva)) / MIRA.curvaPasso, vao = (graus * Math.PI) / 180;
        const k = Math.max(2, Math.ceil(graus / A.passoGraus) + 1), a0 = nv;
        for (let j = 0; j < k; j++) {
          const t = t0 - vao / 2 + (vao * j) / (k - 1), c = Math.cos(t), sn = Math.sin(t);
          ponto(b.x + R * (c * C.rx + sn * C.ux), b.y + R * (c * C.ry + sn * C.uy), b.z + R * (c * C.rz + sn * C.uz),
            -sn * C.rx + c * C.ux, -sn * C.ry + c * C.uy, -sn * C.rz + c * C.uz, meiaV, mioloV / 2, COR_VERDE, vis);
        }
        fechar(a0);
        arco = { curva: info.curva, graus, raioPx, lado: lado > 0 ? 'direita' : 'esquerda' };
      }
      geo.setDrawRange(0, ni);
      aPos.needsUpdate = true; aLarg.needsUpdate = true; aCor.needsUpdate = true; aIdx.needsUpdate = true;
      aPos.clearUpdateRanges(); aLarg.clearUpdateRanges(); aCor.clearUpdateRanges(); aIdx.clearUpdateRanges();
      aPos.addUpdateRange(0, nv * 6); aLarg.addUpdateRange(0, nv * 6); aCor.addUpdateRange(0, nv * 8); aIdx.addUpdateRange(0, ni);
      est = {
        visivel: true, pontos: info.n, desenhados, opacidade: vis, tipo: info.tipo,
        larguraPx: { miolo: mioloL, contorno: contL }, verdePx: { miolo: mioloV, contorno: contV },
        arco, alvo: d.alvo ? { x: d.alvo.x, z: d.alvo.z } : null, anel,
        fimVisivel: { m: d.fim, i: d.iFim, total: d.total, inicio: d.inicio, esmaece: d.esmaece }, triangulos: ni / 3,
      };
    },
  };
}

/**
 * cena three.js e a raiz do HUD (#hud; desde o item 65 nada entra nela: a tela da cobrança fica sem painel e sem texto).
 * Devolve {camera(mundo, timeHumano), desenhar(mundo, camera, dt), esconder(), malha (a da mira: o main.js a compila na carga),
 * estado(...), linha, pontos(mundo)}.
 */
export function criarTelaBolaParada(cena) {
  const doc = document;
  const st = doc.createElement('style'); st.textContent = CSS; doc.head.appendChild(st);
  const linha = criarLinha(cena);
  const pts = new Float64Array(MIRA.maxPontos * 3), info = {}, plano = { de: [0, 0, 0], para: [0, 0, 0], fov: 50 }, alvo = {};
  const visto = { vis: false, classe: false };
  let chave = '', ladoCam = -1;
  const html = doc.documentElement;
  // as classes da página: mira-visivel (o minimapa sai: a bola fica embaixo, no meio) e cobranca-mirada (PEGAR e TROCAR da bola
  // na mão saem das vagas d/e)
  function classes(v, efeito) {
    const vis = !!v;
    if (vis !== visto.vis) { visto.vis = vis; html.classList.toggle('mira-visivel', vis); }
    if (efeito !== visto.classe) { visto.classe = efeito; html.classList.toggle('cobranca-mirada', efeito); }
  }
  return {
    /** O plano da câmera agora e o rumo dela no chão ({plano, yaw, alvo}) ou null. */
    camera(m, th) {
      const pr = m.parada;
      if (!m.partida || m.disputa || !pr || pr.rolou || pr.cobrador == null || !TIPOS_CAM.includes(pr.tipo)) return null;
      if (!m.humanos?.includes(th) || m.iaJoga?.[th]) return null;
      if (!(pr.time === th && m.controlado?.[th] === pr.cobrador) && !(pr.tipo === 'penalti' && pr.time !== th)) return null;
      alvoPadrao(m, pr, alvo);
      const dx = alvo.x - pr.x, dz = alvo.z - pr.z, d = Math.hypot(dx, dz) || 1;
      const k = `${pr.tipo}/${pr.inicio}/${pr.cobrador}`;
      if (k !== chave) {
        // o lado mais para dentro do campo (no escanteio: longe das placas); empate = à esquerda de quem bate
        const fora = s => {
          const x = pr.x - dx / d * 4.6 - dz / d * 1.9 * s, z = pr.z - dz / d * 4.6 + dx / d * 1.9 * s;
          return Math.max(0, Math.abs(x) - CAMPO.meioX) + Math.max(0, Math.abs(z) - CAMPO.meioZ);
        };
        ladoCam = fora(1) < fora(-1) - 0.05 ? 1 : -1; chave = k;
      }
      // a corrida da cobrança (item 70, P1; corrida.js): o quadro pelo ponto de partida do cobrador (a distância dele atrás da
      // bola, na linha bola–alvo) — o ponto fica parado a parada inteira (a câmera não anda com a corrida)
      const cr = pr.corrida, recuo = cr ? Math.max(0, ((pr.x - cr.x0) * dx + (pr.z - cr.z0) * dz) / d) : 0;
      planoBolaParada(pr.x, pr.z, alvo.x, pr.tipo === 'penalti' || chuteAGol(m, pr) ? 1.0 : 0, alvo.z, ladoCam, m.jogadores, plano, recuo, perfilBolaParada(pr.tipo));
      return { plano, yaw: Math.atan2(dz, dx), alvo };
    },
    /** A mira (a linha, o anel e o arco) e as classes da página (depois da câmera do quadro). */
    desenhar(m, cam, dt, mostrarLinha = true) {
      const v = m ? preverMira(m, pts, info) : null;
      linha.atualizar(m, pts, mostrarLinha ? v : null, cam, dt);
      classes(v, !!v && m.parada?.tipo !== 'tiroDeMeta');
      return v;
    },
    esconder() { linha.atualizar(null, pts, null, null, 0); classes(null, false); },
    /** A malha da mira (o main.js compila o programa dela na carga do módulo: renderer.compileAsync). */
    get malha() { return linha.malha; },
    get linha() { return linha.estado; },
    /** Estado para os testes (main.js __golaco.bolaParada.estado). */
    estado(m, cam, r) {
      const pr = m.parada, p = cam.camera.position;
      return {
        ativa: !!r, mistura: cam.misturaBolaParada, yaw: r ? r.yaw : null, alvo: r ? { ...r.alvo } : null,
        plano: r ? { de: [...r.plano.de], para: [...r.plano.para], fov: r.plano.fov } : null,
        camera: { x: p.x, y: p.y, z: p.z, fov: cam.camera.fov }, linha: linha.estado,
        tipo: pr?.tipo ?? null, cobrador: pr?.cobrador ?? null, bola: pr ? { x: pr.x, z: pr.z } : null,
        mira: pr?.mira ? { ang0: pr.mira.ang0, ang: pr.mira.ang, curva: pr.mira.curva } : null,
        classe: document.documentElement.classList.contains('cobranca-mirada'),
      };
    },
    /** Os pontos da física da linha inteira agora (a tela desenha só o começo: estado.linha.fimVisivel). */
    pontos(m) { const r = preverMira(m, pts, {}); return r ? Array.from({ length: r.n }, (_, i) => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]) : []; },
  };
}
