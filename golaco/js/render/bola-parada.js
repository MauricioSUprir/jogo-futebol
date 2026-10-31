// Bolas paradas no estilo FIFA na tela (pedido do dono, 16/10; carregado SOB DEMANDA pelo main.js na 1ª bola parada da
// partida: fora do download inicial). Contrato "Cobrança mirada e câmera da bola parada" no CONTRATOS.md; pesquisa em
// PESQUISA-ETAPA4.md §12. Só lê o mundo (o hash não muda).
//  - Câmera atrás do cobrador (escanteio, tiro livre, tiro de meta e pênalti do humano; pênalti contra): `atras` m atrás,
//    `lado` m para o lado (o que fica mais para dentro do campo), `altura` m; olhar e fov pela conta (a bola em `bolaY`
//    da altura do quadro, o alvo em `alvoY`); fora dos sólidos (estadio-forma.js solidoEm) e de jogadores: chega e sobe.
//  - Linha da cobrança mirada (mira-linha.js preverMira: a física da bola): uma fita virada para a câmera, miolo amarelo →
//    azul e bordas escuras, 1 chamada de desenho; some no chute.
//  - Painel embaixo: o rótulo de COMANDO do tipo (ALTA, TENSA, CHUTE, CURTA, LONGA) e o trilho do efeito (Z/X no PC).
import * as THREE from 'three';
import { CAMPO, MIRA } from '../config.js';
import { solidoEm } from '../estadio-forma.js';
import { alvoPadrao, chuteAGol } from '../mira.js';
import { preverMira } from '../mira-linha.js';

export const CAMERA_BOLA_PARADA = {
  atras: 4.6, lado: 1.9, altura: 2.6, bolaY: 0.76, alvoY: 0.4, fov: [40, 74], recuo: 2.4,
  folgaSolido: 0.4, folgaJogador: 1.0, tentativas: 6,
};
const TIPOS_CAM = ['escanteio', 'tiroLivre', 'tiroDeMeta', 'penalti'];

/**
 * Plano {de, para, fov (vertical)} atrás da bola (bx, bz) olhando o alvo (tx, ty, tz); lado −1 = câmera à esquerda.
 * atrasMin (m; a corrida da cobrança, item 70): a câmera recua até ficar isto atrás da bola (o cobrador no ponto de partida
 * da corrida fica no quadro, à frente dela).
 */
export function planoBolaParada(bx, bz, tx, ty, tz, lado, jogadores, out, atrasMin = 0) {
  const C = CAMERA_BOLA_PARADA;
  out.de ??= [0, 0, 0]; out.para ??= [0, 0, 0];
  let dx = tx - bx, dz = tz - bz;
  const D = Math.hypot(dx, dz) || 1;
  dx /= D; dz /= D;
  let atras = Math.max(C.atras, atrasMin), alt = C.altura, ld = C.lado, px = 0, pz = 0;
  for (let k = 0; k <= C.tentativas; k++) {
    px = bx - dx * atras - dz * ld * lado; pz = bz - dz * atras + dx * ld * lado;
    let livre = !solidoEm(px, alt, pz, C.folgaSolido, false);
    if (livre && alt < 2.3) for (const j of jogadores) if (Math.hypot(j.x - px, j.z - pz) < C.folgaJogador) { livre = false; break; }
    if (livre) break;
    atras *= 0.82; alt += 0.55; ld *= 0.9;
  }
  // arfagem p e tan(fov/2) t: a bola em bolaY e o alvo em alvoY (ângulos abaixo do horizonte, por bissecção)
  const tb = Math.atan2(alt - 0.11, Math.hypot(bx - px, bz - pz)), tt = Math.atan2(alt - ty, Math.hypot(tx - px, tz - pz));
  const k2 = 2 * (C.bolaY - 0.5);
  const yAlvo = p => 0.5 - Math.tan(p - tt) * k2 / (2 * Math.tan(tb - p));
  let lo = tt - 0.3, hi = tb - 0.02;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (yAlvo(m) > C.alvoY) lo = m; else hi = m; }
  const f = Math.max(C.fov[0], Math.min(C.fov[1], (2 * Math.atan(Math.tan(tb - (lo + hi) / 2) / k2) * 180) / Math.PI));
  const p = tb - Math.atan(Math.tan((f * Math.PI) / 360) * k2); // com o fov limitado, a bola volta para bolaY
  let lx = (bx + tx) / 2 - px, lz = (bz + tz) / 2 - pz;
  const ll = Math.hypot(lx, lz) || 1;
  out.de[0] = px; out.de[1] = alt; out.de[2] = pz;
  out.para[0] = px + lx / ll * 10; out.para[1] = alt - Math.tan(p) * 10; out.para[2] = pz + lz / ll * 10;
  out.fov = f;
  return out;
}

const CSS = `
.mira-cobranca { position: absolute; left: 50%; bottom: calc(var(--sa-b) + 8px); transform: translateX(-50%); display: flex;
  flex-direction: column; align-items: center; gap: 3px; padding: 4px 10px 5px; background: rgba(7, 9, 10, 0.62);
  border: 1px solid rgba(255, 216, 74, 0.45); border-radius: 8px; pointer-events: none; z-index: 1; }
.mira-cobranca[hidden], html.em-replay .mira-cobranca, html.em-comemoracao .mira-cobranca, html.mira-visivel .minimapa { display: none; }
.mira-tipo { font-size: 12px; font-weight: 900; letter-spacing: 0.16em; color: #ffd84a; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8); }
.mira-efeito { display: flex; align-items: center; gap: 6px; }
.mira-trilho { position: relative; display: block; width: 72px; height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, rgba(58, 160, 255, 0.55), rgba(255, 255, 255, 0.25) 50%, rgba(58, 160, 255, 0.55)); }
.mira-trilho::before { content: ''; position: absolute; left: 50%; top: -2px; width: 1px; height: 8px; background: rgba(255, 255, 255, 0.5); }
.mira-trilho i { position: absolute; top: 50%; left: calc(50% + var(--curva, 0) * 36px); width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px;
  border-radius: 50%; background: #ffd84a; box-shadow: 0 0 6px rgba(255, 216, 74, 0.8); transition: left 0.08s; }
.mira-kbd { font: 800 9px/1 var(--fonte); color: var(--texto-2); padding: 2px 4px; border: 1px solid rgba(255, 255, 255, 0.28); border-radius: 3px; }
html.com-toque .mira-kbd, .mira-cobranca.sem-efeito .mira-efeito { display: none; }
.btn-efeito svg { stroke: #ffd84a; }
.btn-efeito.ativo svg { stroke: var(--preto); }`;

const LARG = 0.2, LARG_DIST = 0.009; // m perto; × a distância longe (no fundo do quadro a fita não some)
const AMARELA = [1.0, 0.82, 0.08], AZUL = [0.3, 0.72, 1.0], BORDA = [0.02, 0.03, 0.03], MUDA = [0.5, 0.72];

/** A linha (fita de 3 vértices por ponto: borda, miolo, borda). */
function criarLinha(cena) {
  const N = MIRA.maxPontos, pos = new Float32Array(N * 9), cor = new Float32Array(N * 12), idx = new Uint16Array((N - 1) * 12);
  for (let i = 0; i < N - 1; i++) for (let s = 0; s < 2; s++) {
    const a = i * 3 + s, b = a + 3, q = i * 12 + s * 6;
    idx[q] = a; idx[q + 1] = a + 1; idx[q + 2] = b; idx[q + 3] = a + 1; idx[q + 4] = b + 1; idx[q + 5] = b;
  }
  const geo = new THREE.BufferGeometry(), aPos = new THREE.BufferAttribute(pos, 3), aCor = new THREE.BufferAttribute(cor, 4);
  aPos.setUsage(THREE.DynamicDrawUsage); aCor.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('color', aCor); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const malha = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  }));
  malha.name = 'linha-mira'; malha.renderOrder = 6; malha.frustumCulled = false; malha.visible = false;
  cena.add(malha);
  let vis = 0, nUlt = 0;
  return {
    get estado() { return { visivel: malha.visible, pontos: nUlt, opacidade: vis }; },
    atualizar(pts, n, info, c, dt) {
      const ativo = !!info && n >= 2, alvo = ativo ? (info.carregando ? 1 : 0.85) : 0;
      vis = ativo ? (info.carregando ? alvo : Math.min(alvo, vis + dt / 0.15)) : 0; // some na hora no chute
      malha.visible = vis > 0.01; nUlt = ativo ? n : 0;
      if (!malha.visible) return;
      let tot = 0;
      for (let i = 1; i < n; i++) tot += Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2], pts[i * 3 + 2] - pts[i * 3 - 1]);
      tot = Math.max(tot, 1e-3);
      for (let i = 0, s = 0; i < n; i++) {
        const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2], j0 = Math.max(0, i - 1) * 3, j1 = Math.min(n - 1, i + 1) * 3;
        const tx = pts[j1] - pts[j0], ty = pts[j1 + 1] - pts[j0 + 1], tz = pts[j1 + 2] - pts[j0 + 2];
        const vx = c.x - x, vy = c.y - y, vz = c.z - z; // lado da fita = tangente × (para a câmera)
        let ox = ty * vz - tz * vy, oy = tz * vx - tx * vz, oz = tx * vy - ty * vx;
        const w = Math.max(LARG, LARG_DIST * Math.hypot(vx, vy, vz)) / 2 / (Math.hypot(ox, oy, oz) || 1);
        ox *= w; oy *= w; oz *= w;
        const k = i * 9;
        pos[k] = x - ox; pos[k + 1] = y - oy; pos[k + 2] = z - oz; pos[k + 3] = x; pos[k + 4] = y; pos[k + 5] = z;
        pos[k + 6] = x + ox; pos[k + 7] = y + oy; pos[k + 8] = z + oz;
        if (i > 0) s += Math.hypot(x - pts[i * 3 - 3], y - pts[i * 3 - 2], z - pts[i * 3 - 1]);
        const u = s / tot, a = vis * (u < 0.03 ? u / 0.03 : u > 0.88 ? Math.max(0, (1 - u) / 0.12) : 1);
        const m = Math.min(1, Math.max(0, (u - MUDA[0]) / (MUDA[1] - MUDA[0])));
        for (let cc = 0; cc < 3; cc++) {
          const q = i * 12 + cc * 4, borda = cc !== 1;
          for (let e = 0; e < 3; e++) cor[q + e] = borda ? BORDA[e] : AMARELA[e] + (AZUL[e] - AMARELA[e]) * m;
          cor[q + 3] = borda ? a * 0.55 : a;
        }
      }
      geo.setDrawRange(0, (n - 1) * 12);
      aPos.needsUpdate = true; aCor.needsUpdate = true;
    },
  };
}

/** cena three.js e a raiz do painel (#hud). Devolve {camera(mundo, timeHumano), desenhar(mundo, camera, dt), esconder(), ...}. */
export function criarTelaBolaParada(cena, raiz) {
  const doc = document;
  const st = doc.createElement('style'); st.textContent = CSS; doc.head.appendChild(st);
  const painel = doc.createElement('div');
  painel.id = 'mira'; painel.className = 'mira-cobranca'; painel.dataset.caixa = 'mira'; painel.hidden = true;
  painel.setAttribute('aria-hidden', 'true');
  painel.innerHTML = '<b class="mira-tipo"></b><span class="mira-efeito"><kbd class="mira-kbd">Z</kbd><span class="mira-trilho"><i></i></span><kbd class="mira-kbd">X</kbd></span>';
  raiz.appendChild(painel);
  const elTipo = painel.querySelector('.mira-tipo'), elMarca = painel.querySelector('.mira-trilho i');
  const linha = criarLinha(cena);
  const pts = new Float64Array(MIRA.maxPontos * 3), info = {}, plano = { de: [0, 0, 0], para: [0, 0, 0], fov: 50 }, alvo = {};
  const visto = { vis: false, rot: '', curva: null, efeito: null, classe: false };
  let chave = '', ladoCam = -1;
  const html = doc.documentElement;
  function painelDe(v, efeito) {
    const vis = !!v;
    if (vis !== visto.vis) { painel.hidden = !vis; visto.vis = vis; html.classList.toggle('mira-visivel', vis); }
    if (efeito !== visto.classe) { visto.classe = efeito; html.classList.toggle('cobranca-mirada', efeito); }
    if (!vis) return;
    if (v.rotulo !== visto.rot) { elTipo.textContent = visto.rot = v.rotulo; }
    if (v.curva !== visto.curva) { elMarca.style.setProperty('--curva', String(visto.curva = v.curva)); }
    if (efeito !== visto.efeito) { painel.classList.toggle('sem-efeito', !(visto.efeito = efeito)); }
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
      // a corrida da cobrança (item 70, P1; corrida.js): a câmera recua até o ponto de partida do cobrador (+ C.recuo m) — o
      // ponto fica parado a parada inteira (a câmera não anda com a corrida)
      const cr = pr.corrida, atrasMin = cr ? ((pr.x - cr.x0) * dx + (pr.z - cr.z0) * dz) / d + CAMERA_BOLA_PARADA.recuo : 0;
      planoBolaParada(pr.x, pr.z, alvo.x, pr.tipo === 'penalti' || chuteAGol(m, pr) ? 1.0 : 0, alvo.z, ladoCam, m.jogadores, plano, atrasMin);
      return { plano, yaw: Math.atan2(dz, dx), alvo };
    },
    /** A linha e o painel (depois da câmera do quadro). */
    desenhar(m, cam, dt, mostrarLinha = true) {
      const v = m ? preverMira(m, pts, info) : null;
      linha.atualizar(pts, v && mostrarLinha ? v.n : 0, mostrarLinha ? v : null, cam.position, dt);
      painelDe(v, !!v && m.parada?.tipo !== 'tiroDeMeta');
      return v;
    },
    esconder() { linha.atualizar(pts, 0, null, null, 0); painelDe(null, false); },
    get linha() { return linha.estado; },
    /** Estado para os testes (main.js __golaco.bolaParada.estado). */
    estado(m, cam, r) {
      const pr = m.parada, p = cam.camera.position;
      return {
        ativa: !!r, mistura: cam.misturaBolaParada, yaw: r ? r.yaw : null, alvo: r ? { ...r.alvo } : null,
        plano: r ? { de: [...r.plano.de], para: [...r.plano.para], fov: r.plano.fov } : null,
        camera: { x: p.x, y: p.y, z: p.z, fov: cam.camera.fov }, linha: linha.estado, hud: visto.vis ? { rotulo: visto.rot, curva: visto.curva } : null,
        tipo: pr?.tipo ?? null, cobrador: pr?.cobrador ?? null, bola: pr ? { x: pr.x, z: pr.z } : null,
        mira: pr?.mira ? { ang0: pr.mira.ang0, ang: pr.mira.ang, curva: pr.mira.curva } : null,
        classe: document.documentElement.classList.contains('cobranca-mirada'),
      };
    },
    get painel() { return visto.vis ? { rotulo: visto.rot, curva: visto.curva } : null; },
    pontos(m) { const r = preverMira(m, pts, {}); return r ? Array.from({ length: r.n }, (_, i) => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]) : []; },
  };
}
