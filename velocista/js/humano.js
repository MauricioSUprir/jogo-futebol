// Corpo humano do herói: o Rocketbox Sports_Male_02 (MIT, ver assets/humano/CREDITOS.md) como SkinnedMesh de 25 ossos,
// com o uniforme pintado por região, capuz e emblema, e a animação (corrida, sprint, ar, planeio, escalada, vibração)
// calculada por ossos em coordenadas do modelo (x = frente, y = cima, z = direita do personagem).
import * as THREE from 'three';
import { lerCorpo } from './corpo-dados.js';

const BASE = new URL('../assets/humano/', import.meta.url);
const NOMES = ['pelve', 'lombar', 'peito', 'pescoco', 'cabeca', 'claviculaE', 'bracoE', 'antebracoE', 'maoE', 'claviculaD', 'bracoD', 'antebracoD', 'maoD',
  'coxaE', 'canelaE', 'peE', 'coxaD', 'canelaD', 'peD', 'ajJoelhoE', 'ajJoelhoD', 'ajCotoveloE', 'ajCotoveloD', 'ajQuadrilE', 'ajQuadrilD'];
const PAI = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 2, 9, 10, 11, 0, 13, 14, 0, 16, 17, 14, 17, 7, 11, 0, 0];
const I = Object.fromEntries(NOMES.map((n, i) => [n, i]));
const AJ = [[19, 13, 14], [20, 16, 17], [21, 6, 7], [22, 10, 11], [23, 0, 13], [24, 0, 16]];   // ajudante, osso de cima, osso de baixo

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

// cores do uniforme por região da máscara (0 pele, 1 camisa, 2 manga, 3 gola, 4 punho, 5 calção, 6 barra, 7 meião, 8 chuteira, 9 sola, 10 acabamento)
const CORES = [[196, 22, 40], [200, 20, 38], [178, 16, 34], [240, 190, 40], [235, 185, 40], [182, 17, 35], [236, 186, 40], [188, 18, 36], [226, 170, 30], [26, 20, 20], [250, 214, 80]];

function origensDeRepouso(J, rep) {
  const o = new Array(25);
  const p = (n) => J[n].slice();
  const ombro = (lado) => { const s = lado < 0 ? p('ombroE') : p('ombroD'); s[1] -= rep.queda; s[2] += lado * rep.abre; return s; };
  const cotovelo = (S, H) => {
    const d = [H[0] - S[0], H[1] - S[1], H[2] - S[2]], L = Math.hypot(...d), u = d.map((x) => x / L);
    const L1 = rep.braco, L2 = rep.antebraco;
    if (L >= L1 + L2) return [S[0] + u[0] * L1, S[1] + u[1] * L1, S[2] + u[2] * L1];
    const a = (L1 * L1 - L2 * L2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    let pole = [-1, 0, 0]; const dp = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2]; pole = pole.map((x, k) => x - dp * u[k]);
    const pl = Math.hypot(...pole); pole = pole.map((x) => x / pl);
    return [0, 1, 2].map((k) => S[k] + u[k] * a + pole[k] * h);
  };
  const tornozelo = (J1, J2) => { const a = J1.slice(), k = J2, d = [k[0] - a[0], k[1] - a[1], k[2] - a[2]], l = Math.hypot(...d); return a.map((x, i) => x + (d[i] / l) * (rep.sobeTornozelo ?? 0)); };
  const sE = ombro(-1), sD = ombro(1), cE = cotovelo(sE, p('maoE')), cD = cotovelo(sD, p('maoD'));
  const tE = tornozelo(p('tornozeloE'), p('joelhoE')), tD = tornozelo(p('tornozeloD'), p('joelhoD'));
  o[0] = p('pelve'); o[1] = p('lombar'); o[2] = p('peito'); o[3] = p('pescoco'); o[4] = p('cabeca');
  o[5] = p('peito'); o[6] = sE; o[7] = cE; o[8] = p('maoE'); o[9] = p('peito'); o[10] = sD; o[11] = cD; o[12] = p('maoD');
  o[13] = p('quadrilE'); o[14] = p('joelhoE'); o[15] = tE; o[16] = p('quadrilD'); o[17] = p('joelhoD'); o[18] = tD;
  o[19] = p('joelhoE'); o[20] = p('joelhoD'); o[21] = cE; o[22] = cD; o[23] = p('quadrilE'); o[24] = p('quadrilD');
  return o;
}

function carregarImagem(url) { return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; }); }

async function texturaCorpo(aniso) {
  const img = await carregarImagem(new URL('regioes.png', BASE).href);
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.drawImage(img, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), px = d.data;
  for (let i = 0; i < S * S; i++) { const r = Math.min(10, px[i * 4]); const k = CORES[r]; px[i * 4] = k[0]; px[i * 4 + 1] = k[1]; px[i * 4 + 2] = k[2]; px[i * 4 + 3] = 255; }
  g.putImageData(d, 0, 0);
  g.filter = 'blur(1.2px)'; g.drawImage(c, 0, 0); g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}
function texturaWebp(url, cor, aniso) {
  return new Promise((ok, falha) => new THREE.TextureLoader().load(url, (t) => { if (cor) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; ok(t); }, undefined, falha));
}

function malha(parte, esqueleto, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(parte.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(parte.nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(parte.uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(parte.ossos), 4));
  const w = new Float32Array(parte.nv * 4); for (let i = 0; i < w.length; i++) w[i] = parte.pesos[i] / 255;
  g.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(parte.idx), 1));
  const m = new THREE.SkinnedMesh(g, material); m.frustumCulled = false;
  return m;
}

/** Cria o herói. Devolve {grupo, aplicar(est, dt), materiais, dispose()}. */
export async function criarHeroi({ aniso = 4, lod = 1 } = {}) {
  const [ind, bin] = await Promise.all([fetch(new URL('corpo.json', BASE)).then((r) => r.json()), fetch(new URL('corpo.bin', BASE)).then((r) => r.arrayBuffer())]);
  const dados = lerCorpo(ind, bin), L = dados.lods[lod];
  const origens = origensDeRepouso(ind.repouso.juntas, ind.repouso);

  const raiz = new THREE.Group();                    // espaço do modelo (x = frente)
  const ossos = NOMES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  ossos.forEach((b, i) => { const pai = PAI[i], o = origens[i]; if (pai < 0) { b.position.set(o[0], o[1], o[2]); raiz.add(b); } else { const po = origens[pai]; b.position.set(o[0] - po[0], o[1] - po[1], o[2] - po[2]); ossos[pai].add(b); } });
  raiz.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(ossos);

  const [texCorpo, texCabeca, texNormal] = await Promise.all([texturaCorpo(aniso), texturaWebp(new URL('cabeca-rb.webp', BASE).href, true, aniso), texturaWebp(new URL('pano-normal.webp', BASE).href, false, aniso)]);
  texNormal.wrapS = texNormal.wrapT = THREE.RepeatWrapping;
  const matCorpo = new THREE.MeshStandardMaterial({ map: texCorpo, normalMap: texNormal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.42, metalness: 0.22, emissive: 0x2a0004 });
  const matCabeca = new THREE.MeshStandardMaterial({ map: texCabeca, roughness: 0.65, metalness: 0 });
  const corpo = malha(L.partes.corpo, esqueleto, matCorpo), cabeca = malha(L.partes.cabeca, esqueleto, matCabeca);
  for (const m of [corpo, cabeca]) { raiz.add(m); m.bind(esqueleto, new THREE.Matrix4()); }

  // capuz, orelhas douradas e emblema no peito
  const vermelho = new THREE.MeshStandardMaterial({ color: 0xc8142a, roughness: 0.4, metalness: 0.25, emissive: 0x2a0004 });
  const ouro = new THREE.MeshStandardMaterial({ color: 0xf0be28, roughness: 0.28, metalness: 0.65, emissive: 0x5a3c00 });
  const J = ind.repouso.juntas, hc = [0.03, 1.668, 0], jc = J.cabeca;
  const capuz = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, Math.PI + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.64), vermelho);
  capuz.scale.set(0.128, 0.122, 0.1); capuz.position.set(hc[0] - jc[0], hc[1] - jc[1], hc[2] - jc[2]); ossos[I.cabeca].add(capuz);
  for (const l of [-1, 1]) {
    const asa = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.1, 6), ouro);
    asa.position.set(hc[0] - jc[0] - 0.02, hc[1] - jc[1] + 0.045, l * 0.1); asa.rotation.set(l * 0.9, 0, 0.9); ossos[I.cabeca].add(asa);
  }
  const forma = new THREE.Shape(); forma.moveTo(0.03, 0.1); forma.lineTo(-0.05, -0.01); forma.lineTo(0, -0.01); forma.lineTo(-0.03, -0.1); forma.lineTo(0.05, 0.015); forma.lineTo(0, 0.015); forma.closePath();
  const emb = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshStandardMaterial({ color: 0xf6c82a, emissive: 0xb88a10, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  emb.scale.setScalar(1.15); emb.position.set(0.118, 1.305 - J.peito[1], 0); emb.rotation.y = Math.PI / 2; ossos[I.peito].add(emb);

  // ---------- pose ----------
  const wq = NOMES.map(() => new THREE.Quaternion());      // rotação de mundo (espaço do modelo) de cada osso
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), qi = new THREE.Quaternion();
  const eu = new THREE.Euler(), ex = new THREE.Vector3(1, 0, 0), ez = new THREE.Vector3(0, 0, 1), ey = new THREE.Vector3(0, 1, 0);
  const sinal = (i) => (NOMES[i].endsWith('E') ? -1 : 1);

  function local(i, x, y, z) {                           // define a rotação LOCAL (relativa ao pai) e propaga o mundo
    ossos[i].quaternion.setFromEuler(eu.set(x, y, z, 'XYZ'));
    if (PAI[i] < 0) wq[i].copy(ossos[i].quaternion); else wq[i].copy(wq[PAI[i]]).multiply(ossos[i].quaternion);
  }
  function mundo(i, q) {                                 // define a rotação DE MUNDO desejada
    if (PAI[i] < 0) ossos[i].quaternion.copy(q); else ossos[i].quaternion.copy(qi.copy(wq[PAI[i]]).invert()).multiply(q);
    wq[i].copy(q);
  }
  // rotação de mundo = giro em torno do eixo lateral z por `a` (positivo: a ponta que aponta para baixo vai para a frente), depois abdução em x
  const qz = (a, abd = 0) => qa.setFromAxisAngle(ez, a).multiply(qb.setFromAxisAngle(ex, abd));
  const tmp = new THREE.Quaternion();
  const par = (a, abd = 0) => tmp.copy(qz(a, abd));

  const est = { fase: 0, ar: 0, planeio: 0, parede: 0, vib: 0, pele: 0, tt: 0 };
  const posAn = new THREE.Vector3(), semente = { s: 1 };
  const rnd = () => { semente.s = (semente.s * 16807) % 2147483647; return semente.s / 2147483647 - 0.5; };

  function aplicar(e, dt) {
    const v = e.v, tt = (est.tt += dt);
    est.ar = lerp(est.ar, e.noChao ? 0 : 1, 1 - Math.exp(-14 * dt));
    est.planeio = lerp(est.planeio, e.planando ? 1 : 0, 1 - Math.exp(-9 * dt));
    est.parede = lerp(est.parede, e.parede ? 1 : 0, 1 - Math.exp(-10 * dt));
    est.vib = lerp(est.vib, e.vibrando ? 1 : 0, 1 - Math.exp(-12 * dt));
    const r = clamp((v - 1.2) / 11, 0, 1), s2 = clamp((v - 18) / 36, 0, 1), vivo = clamp(v / 1.5, 0, 1);
    est.fase += dt * (e.parede ? 14 : (3.2 + v * 0.55 * (v > 25 ? 0.6 : 1)));
    const ph = est.fase;
    const hipA = (0.22 + 0.3 * r + 0.42 * s2) * vivo, hipOff = 0.04 + 0.12 * s2;
    const kMax = (0.35 + 0.65 * r + 0.95 * s2) * vivo, kBase = 0.06 + 0.12 * r + 0.1 * s2;
    const lean = 0.03 + 0.1 * r + 0.5 * s2 - 0.1 * est.planeio;
    const brA = (0.12 + 0.5 * r + 0.42 * s2) * vivo, elb = 0.22 + 0.95 * r + 0.45 * s2;
    const resp = Math.sin(tt * 2.2) * (1 - vivo);

    // coluna
    const twist = 0.2 * (0.4 + 0.6 * r + 0.3 * s2) * Math.sin(ph) * vivo;
    local(0, 0, twist * 0.5, 0);
    local(1, 0, -twist * 0.5, -0.45 * lean + 0.02 * resp);
    local(2, 0, -twist * 0.6, -0.45 * lean);
    local(3, 0, 0, 0.1 * lean);
    local(4, 0, twist * 0.2, 0.5 * lean * (1 - 0.0) - 0.04);
    for (const c of [I.claviculaE, I.claviculaD]) local(c, 0, 0, 0);

    // pernas e braços: cada segmento em rotação de MUNDO em torno do eixo lateral (dobras limpas)
    const noAr = est.ar;
    for (const lado of [-1, 1]) {
      const E = lado < 0, p = ph + (E ? 0 : Math.PI);
      const co = E ? I.coxaE : I.coxaD, ca = E ? I.canelaE : I.canelaD, pe = E ? I.peE : I.peD;
      let hip = hipOff + hipA * Math.sin(p), knee = kBase + kMax * Math.pow(0.5 + 0.5 * Math.cos(p + 0.35), 2);
      // no ar: uma perna à frente dobrada, a outra para trás
      const hipAr = E ? 0.95 : -0.35, kneeAr = E ? 1.25 : 0.55;
      hip = lerp(hip, hipAr * (0.6 + 0.4 * s2), noAr); knee = lerp(knee, kneeAr, noAr);
      hip = lerp(hip, -0.12 + lado * 0.05, est.planeio * noAr); knee = lerp(knee, 0.25, est.planeio * noAr);
      const abd = lado * 0.035 * (1 - noAr);
      mundo(co, par(hip, abd)); mundo(ca, par(hip - knee, abd * 0.5));
      const dedo = -(hip - knee) * 0.5 - 0.5 * Math.max(0, -Math.sin(p)) * (1 - noAr) - 0.25 * noAr;
      mundo(pe, par(dedo));
      // braços
      const br = E ? I.bracoE : I.bracoD, an = E ? I.antebracoE : I.antebracoD, mao = E ? I.maoE : I.maoD;
      const pb = E ? ph : ph + Math.PI;                       // braço do mesmo lado vai com a perna OPOSTA
      const sw = -brA * Math.sin(pb);
      let swing = sw, cot = elb + 0.22 * Math.sin(pb + 1.0) * (0.4 + s2);
      swing = lerp(swing, E ? 1.0 : -0.5, noAr * (1 - est.planeio));
      cot = lerp(cot, 1.2, noAr);
      swing = lerp(swing, 0, est.planeio); cot = lerp(cot, 0.1, est.planeio);
      const abdB = lerp(lado * 0.8, -lado * 0.84, est.planeio);
      mundo(br, qz(swing, abdB)); mundo(an, qz(swing + cot, abdB));
      mundo(mao, wq[an].clone());
    }
    // ajudantes: meio caminho entre o osso de cima e o de baixo (a dobra não murcha)
    for (const [h, a, b] of AJ) {
      qc.copy(wq[a]).slerp(wq[b], 0.5); mundo(h, qc);
    }
    raiz.updateMatrixWorld(true);

    // vibração: tremor do corpo todo
    const vj = est.vib;
    raiz.position.set(vj * rnd() * 0.05, 0, vj * rnd() * 0.05);
    raiz.rotation.set(vj * rnd() * 0.06, 0, vj * rnd() * 0.06);
    // pé no chão: o osso do tornozelo mais baixo toca a altura de repouso
    if (!e.parede && noAr < 0.5) {
      let minY = 9;
      for (const i of [I.peE, I.peD]) { ossos[i].getWorldPosition(posAn); posAn.sub(raiz.position); if (posAn.y < minY) minY = posAn.y; }
      raiz.position.y = (0.115 - minY) * (1 - noAr * 2);
    }
    // material: vibração = translúcido com brilho
    matCorpo.emissive.setRGB(0.16 + 0.8 * vj * (0.5 + 0.5 * Math.sin(tt * 90)), 0.0 + 0.25 * vj, 0.02);
    matCorpo.opacity = 1 - 0.38 * vj; matCorpo.transparent = vj > 0.02;
    matCabeca.opacity = matCorpo.opacity; matCabeca.transparent = matCorpo.transparent;
    return raiz.position.y;
  }

  // pose inicial
  aplicar({ v: 0, noChao: true }, 0.016);
  // o modelo olha para +x; o jogo olha para +z (rotação y = -90°)
  const frente = new THREE.Group(); frente.rotation.y = -Math.PI / 2; frente.add(raiz);
  const materiais = [matCorpo, matCabeca, vermelho, ouro, texCorpo, texCabeca, texNormal];
  return {
    grupo: frente, aplicar, materiais, ossos, raiz,
    setVisivelProfundo(prof) { for (const m of [matCorpo, matCabeca, vermelho, ouro, emb.material]) { m.depthTest = !prof; } },
    dispose() { corpo.geometry.dispose(); cabeca.geometry.dispose(); materiais.forEach((m) => m.dispose?.()); },
  };
}
