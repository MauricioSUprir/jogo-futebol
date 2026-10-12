// Pele do corpo humano (Etapa 5.1; render/corpo3d.js): o NOSSO desenho (os ossos de todos os jogadores numa textura,
// uma chamada por nível de detalhe) tem de sair IGUAL ao SkinnedMesh do three.js (um corpo por objeto, a conta padrão
// skinning_vertex/skinnormal_vertex), pixel a pixel, no navegador (Chromium + WebGL2).
// Poses de verdade (Node): 22 jogadores de uma partida IA × IA e o goleiro mergulhando na grade de chutes; o corpo3d
// escolhe o nível de detalhe de cada um (perto, médio, longe) e a referência usa a MESMA faixa do índice.
// Três materiais × três câmeras (TV, média, perto):
//  - normal: MeshNormalMaterial (posição e normal da pele);
//  - cor: o material de verdade do corpo (uniforme por região, tom de pele, luz) contra um MeshStandardMaterial com a
//    mesma pintura e a pele do three.js;
//  - profundidade: MeshDepthMaterial (a conta da sombra).
// Meta: 0 pixel com diferença > 8 (0–255, qualquer canal) em todas as 9 imagens; os 3 níveis de detalhe usados;
// cada imagem com corpo bastante na tela (nada de passar com a tela vazia).
// Controle: --controle troca na textura os ossos dos dois antebraços de cada jogador (um erro de montagem): reprova.
//   node tools/teste-pele.mjs [--controle] [--salvar <pasta>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarMundo, passo } from '../js/sim.js';
import { mergulhoAtivo } from '../js/goleiro.js';
import { pose, NJ, J } from '../js/anim.js';
import { CAMPO, BOLA } from '../js/config.js';
import * as PT from './lib/partida-tatica.mjs';
import { servidor, abrir } from './lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const CONTROLE = args.includes('--controle');
const iSalvar = args.indexOf('--salvar');
const SALVAR = iSalvar >= 0 ? args[iSalvar + 1] : null;

// ------------------------------------------------------------------ poses (Node)
const LP = await PT.carregar(path.join(AQUI, '..', 'js'));
const ataque = PT.parte3Presente(LP) ? 'jogo' : 'substituto';
const mc = PT.criarJogo(LP, 7, { minutos: 60, ataque });
for (let i = 0; i < 700; i++) PT.passoJogo(LP, mc);
const lista = mc.jogadores.map(j => {
  const p = new Float32Array(NJ * 3);
  pose(j, mc, p);
  return { id: j.id, time: j.time, goleiro: j.posicao === 'GOL', pose: Array.from(p) };
});
// goleiro mergulhando (chute a 11 m, no canto, a meia altura), no meio do mergulho; levado para um canto livre
{
  const GX = CAMPO.meioX, bx = GX - 11, bz = 0;
  const m = criarMundo({ semente: 9, jogadores: [
    { id: 0, x: 0, z: 30, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
    { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL' },
  ], bola: { x: bx, z: bz }, posse: null });
  for (let i = 0; i < 90; i++) passo(m, {});
  const zA = m.jogadores[1].z + 2.4, v = 22, ux = GX - bx, uz = zA - bz, D = Math.hypot(ux, uz), tt = D / v;
  const b = m.bola;
  b.p.x = bx; b.p.y = BOLA.raio; b.p.z = bz; b.v.x = ux / D * v; b.v.y = (1.0 - BOLA.raio + 0.5 * 9.81 * tt * tt) / tt; b.v.z = uz / D * v;
  b.w.x = b.w.y = b.w.z = 0; b.rolando = false;
  m.voo = { tipo: 'chute', de: 0, time: 0, tick0: m.tick, tickChave: m.tick };
  let ticks = 0, achou = null;
  for (let i = 0; i < 150 && !achou; i++) {
    passo(m, {});
    const g = m.jogadores[1];
    if (mergulhoAtivo(g, m.tick) && ++ticks === 12) { achou = new Float32Array(NJ * 3); pose(g, m, achou); }
  }
  if (!achou) { console.log('teste-pele: REPROVOU (o goleiro não mergulhou na cena montada)'); process.exit(1); }
  const px = achou[J.pelve * 3], pz = achou[J.pelve * 3 + 2];
  for (let i = 0; i < NJ; i++) { achou[i * 3] += -20 - px; achou[i * 3 + 2] += 26 - pz; }
  lista.push({ id: 120, time: 1, goleiro: true, pose: Array.from(achou) });
}
const alvoPerto = lista.length - 1;
// o jogador mais perto do centro do quadro médio: o primeiro do time 0 que não é goleiro
const alvoMedio = lista.findIndex(l => !l.goleiro && l.time === 0);

// ------------------------------------------------------------------ navegador
const srv = await servidor();
const nav = await abrir({ largura: 960, altura: 540 });
let res;
try {
  await nav.pagina.goto(srv.url + 'css/estilo.css');   // uma página do servidor (os módulos saem da raiz do jogo)
  await nav.pagina.setContent(`<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js"}}</script>
</head><body style="margin:0;background:#000"><canvas id="c" width="960" height="540"></canvas></body></html>`);
  res = await nav.pagina.evaluate(rodarNaPagina, { lista, alvoPerto, alvoMedio, controle: CONTROLE, salvar: !!SALVAR });
} finally {
  await nav.navegador.close();
  await srv.fechar();
}
if (res.erro) { console.log('teste-pele: REPROVOU —', res.erro); process.exit(1); }
if (SALVAR) {
  fs.mkdirSync(SALVAR, { recursive: true });
  for (const r of res.imagens) {
    for (const k of ['nosso', 'ref']) fs.writeFileSync(path.join(SALVAR, `pele-${r.nome}-${k}.png`), Buffer.from(r[k], 'base64'));
  }
}

// ------------------------------------------------------------------ resultado
const linhas = [];
const meta = (nome, medido, alvo, ok) => linhas.push({ nome, medido, alvo, ok: !!ok });
for (const r of res.comp) {
  meta(`${r.material} · câmera ${r.camera}`, `${r.dif} px com diferença > 8 (maior ${r.maior}); ${r.corpo} px de corpo`,
    `0 px; corpo ≥ ${r.minCorpo} px`, r.dif === 0 && r.corpo >= r.minCorpo);
}
meta('Níveis de detalhe usados (perto, médio, longe)', res.lods.join(', ') + ' jogadores', 'os 3 em uso', res.lods.every(n => n > 0));
meta('Erros no console', String(nav.erros.length + (res.errosPagina?.length ?? 0)), '0', nav.erros.length === 0);
const larg = Math.max(...linhas.map(r => r.nome.length));
console.log(`teste-pele${CONTROLE ? ' (CONTROLE: antebraços trocados na textura)' : ''} — ${lista.length} corpos, ${res.comp.length} imagens`);
for (const r of linhas) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
for (const e of nav.erros) console.log('  console: ' + e);
const ok = linhas.every(r => r.ok);
console.log(ok ? '\nteste-pele: PASSOU' : '\nteste-pele: REPROVOU');
process.exit(ok ? 0 : 1);

// ------------------------------------------------------------------ dentro da página
async function rodarNaPagina({ lista, alvoPerto, alvoMedio, controle, salvar }) {
  try {
    const THREE = await import('three');
    const { lerCorpo } = await import('/js/render/corpo-leitor.js');
    const { criarCorpos3D, injetarPele, DECL_F } = await import('/js/render/corpo3d.js');
    const { NO, O } = await import('/js/render/esqueleto.js');
    const buf = await (await fetch('/assets/jogador/corpo.bin')).arrayBuffer();
    const corpo = lerCorpo(buf);
    const W = 960, H = 540;
    const canvas = document.getElementById('c');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = false;
    const cena = new THREE.Scene();
    cena.background = new THREE.Color(0x000000);
    cena.add(new THREE.HemisphereLight(0xdfeaff, 0x3a4a2a, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(-30, 60, 25);
    cena.add(sol);
    const api = criarCorpos3D(cena, 'alta', corpo);
    api.definirTela(H);
    api.cabelos.visible = false;
    for (const o of cena.children) if (o.name === 'jogadores-manchas') o.visible = false;
    const T = api.teste;
    const jogs = lista.map(l => ({ ...l, pose: Float32Array.from(l.pose), controlado: false, proximo: false, x: l.pose[0], z: l.pose[2], rumo: 0 }));

    // câmeras
    const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 160);
    const pelve = i => new THREE.Vector3(jogs[i].pose[0], jogs[i].pose[1], jogs[i].pose[2]);
    const CAMERAS = {
      // perto/longe justos para a profundidade (BasicDepthPacking) separar bem os tons
      tv: c => { c.near = 15; c.far = 110; c.position.set(0, 12.3, 58); c.lookAt(0, 0, 0); },
      media: c => { c.near = 4; c.far = 16; const p = pelve(alvoMedio); c.position.set(p.x + 6, p.y + 2.2, p.z + 8); c.lookAt(p); },
      perto: c => { c.near = 1.5; c.far = 5; const p = pelve(alvoPerto); c.position.set(p.x + 2.2, p.y + 0.9, p.z + 2.0); c.lookAt(p); },
    };

    // referência: um SkinnedMesh do three.js por corpo, com os ossos = os quadros do esqueleto (posição, giro e escala) e
    // o inverso do quadro de repouso — a mesma matriz de pele (M = Rp·diag(sl, s, sl)·Rbᵀ, t = hp − M·hb)
    const esq = api.esqueleto;
    const aPos = new THREE.BufferAttribute(corpo.pos, 3), aNrm = new THREE.BufferAttribute(corpo.nrm, 3);
    const aOss = new THREE.Uint8BufferAttribute(corpo.ossos, 4), aPes = new THREE.BufferAttribute(corpo.pesos, 4);
    const indice = new THREE.BufferAttribute(corpo.idx, 1);
    const geoNivel = T.lods.map(l => {
      const g = new THREE.BufferGeometry();
      g.setIndex(indice);
      g.setAttribute('position', aPos); g.setAttribute('normal', aNrm);
      g.setAttribute('skinIndex', aOss); g.setAttribute('skinWeight', aPes);
      g.setDrawRange(l.ini, l.n);
      return g;
    });
    const Fb = esq.quadrosRepouso;
    const inversos = [];
    for (let o = 0; o < NO; o++) {
      const b = o * 12, m = new THREE.Matrix4();
      // quadro: h (3) + R por linhas (colunas = eixos X, Y, Z)
      m.set(Fb[b + 3], Fb[b + 4], Fb[b + 5], Fb[b], Fb[b + 6], Fb[b + 7], Fb[b + 8], Fb[b + 1], Fb[b + 9], Fb[b + 10], Fb[b + 11], Fb[b + 2], 0, 0, 0, 1);
      inversos.push(m.invert());
    }
    const DADOS = new Float32Array(4);
    function ossosDoCorpo(pose) {
      esq.calcular(pose, new Float32Array(NO * 12), 0);
      const F = esq.quadros, S = esq.escalas, SL = esq.escalasLargura;
      const ossos = [];
      for (let o = 0; o < NO; o++) {
        const b = o * 12, bone = new THREE.Bone();
        bone.matrixAutoUpdate = false; bone.matrixWorldAutoUpdate = false;
        const sl = SL[o], s = S[o];
        bone.matrixWorld.set(F[b + 3] * sl, F[b + 4] * s, F[b + 5] * sl, F[b], F[b + 6] * sl, F[b + 7] * s, F[b + 8] * sl, F[b + 1],
          F[b + 9] * sl, F[b + 10] * s, F[b + 11] * sl, F[b + 2], 0, 0, 0, 1);
        ossos.push(bone);
      }
      return ossos;
    }
    // material de cor da referência: a MESMA pintura (DECL_F) com os dados do jogador num uniforme e a pele do three.js
    function materialCorRef(dados) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.74, metalness: 0 });
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, T.uni, { uDadosRef: { value: new THREE.Vector4(...dados) } });
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nvarying vec4 vDados;\nuniform vec4 uDadosRef;\n')
          .replace('#include <skinbase_vertex>', '#include <skinbase_vertex>\nvRest = position;\nvDados = uDadosRef;\n');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' + DECL_F)
          .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = corCorpo(vRest, vDados);');
      };
      mat.customProgramCacheKey = () => 'teste-pele-ref';
      return mat;
    }
    const matNormalRef = new THREE.MeshNormalMaterial();
    const matProfRef = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
    const matNormalNosso = new THREE.MeshNormalMaterial();
    injetarPele(matNormalNosso, T.tex, false, null);
    const matProfNosso = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
    injetarPele(matProfNosso, T.tex, false, null);

    const gl = renderer.getContext();
    const ler = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const png = () => canvas.toDataURL('image/png').split(',')[1];
    const comp = [], imagens = [], lods = [0, 0, 0];
    let refs = [];
    for (const [nomeCam, por] of Object.entries(CAMERAS)) {
      por(cam);
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      api.atualizar(jogs, cam);
      const niveis = Array.from(api.niveis.slice(0, jogs.length));
      for (const k of niveis) lods[k]++;
      const dados = api.textura.image.data;
      if (controle) {
        // erro de montagem: os dois antebraços trocados na linha de cada jogador
        for (let p = 0; p < jogs.length; p++) {
          const a = p * T.LARG * 4 + O.antebracoE * 12, b = p * T.LARG * 4 + O.antebracoD * 12;
          for (let i = 0; i < 12; i++) { const t = dados[a + i]; dados[a + i] = dados[b + i]; dados[b + i] = t; }
        }
        api.textura.needsUpdate = true;
      }
      // referência deste quadro
      for (const r of refs) { cena.remove(r); }
      refs = jogs.map((jg, p) => {
        const ossos = ossosDoCorpo(jg.pose);
        const o = p * T.LARG * 4 + (T.LARG - 1) * 4;
        for (let i = 0; i < 4; i++) DADOS[i] = dados[o + i];
        const malha = new THREE.SkinnedMesh(geoNivel[niveis[p]], materialCorRef(Array.from(DADOS)));
        malha.frustumCulled = false;
        malha.bind(new THREE.Skeleton(ossos, inversos), new THREE.Matrix4());
        cena.add(malha);
        return malha;
      });
      const nossas = api.malhas.filter(m => m.geometry.instanceCount > 0);
      const matCorNosso = api.malhas[0].material;
      const MATERIAIS = [
        ['normal', matNormalNosso, () => matNormalRef],
        ['cor', matCorNosso, null],
        ['profundidade', matProfNosso, () => matProfRef],
      ];
      for (const [nomeMat, matNosso, refMat] of MATERIAIS) {
        const corRef = refs.map(r => r.material);
        // nosso
        for (const m of api.malhas) { m.material = matNosso; m.visible = nossas.includes(m); }
        for (const r of refs) r.visible = false;
        renderer.render(cena, cam);
        const a = ler();
        const pa = salvar ? png() : null;
        // referência
        for (const m of api.malhas) m.visible = false;
        refs.forEach((r, i) => { r.visible = true; r.material = refMat ? refMat() : corRef[i]; });
        renderer.render(cena, cam);
        const b = ler();
        const pb = salvar ? png() : null;
        refs.forEach((r, i) => { r.material = corRef[i]; });
        for (const m of api.malhas) m.material = matCorNosso;
        let dif = 0, maior = 0, corpoPx = 0;
        for (let i = 0; i < a.length; i += 4) {
          const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
          if (d > 8) dif++;
          if (d > maior) maior = d;
          if (a[i] + a[i + 1] + a[i + 2] > 0 || b[i] + b[i + 1] + b[i + 2] > 0) corpoPx++;
        }
        const minCorpo = { tv: 1500, media: 2000, perto: 20000 }[nomeCam];
        comp.push({ material: nomeMat, camera: nomeCam, dif, maior, corpo: corpoPx, minCorpo });
        if (salvar) imagens.push({ nome: `${nomeCam}-${nomeMat}`, nosso: pa, ref: pb });
      }
    }
    return { comp, lods, imagens };
  } catch (e) {
    return { erro: String(e && e.stack || e) };
  }
}
