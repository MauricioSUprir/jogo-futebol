// Corpo humano do herói: o Rocketbox Sports_Male_02 (MIT, ver assets/humano/CREDITOS.md) como SkinnedMesh de 25 ossos,
// com o traje desenhado no shader (js/traje.js: máscara, painéis, frisos, cinto, luvas e botas; herói original, vermelho e dourado, emblema próprio), e a animação (corrida, sprint, ar, planeio, escalada, vibração, luta)
// calculada por ossos em coordenadas do modelo (x = frente, y = cima, z = direita do personagem).
import * as THREE from 'three';
import { lerCorpo } from './corpo-dados.js';
import { aplicarTraje } from './traje.js';

const BASE = new URL('../assets/humano/', import.meta.url);
// pessoas da história (Caitlin, Cisco): outro corpo do Rocketbox, com a roupa e o rosto das texturas dele
// (velocista/tools/personagens), o mesmo esqueleto e a mesma animação do herói
const PESSOAS = { caitlin: { escala: 0.94 }, cisco: { escala: 1 }, joe: { escala: 1.01 }, iris: { escala: 0.95 }, frio: { escala: 1.02 }, onda: { escala: 1.04 }, mago: { escala: 1 }, devoe: { escala: 1 } };
// emblema do peito de cada traje (desenhos próprios): disco, cor do anel e do símbolo, símbolo
const EMBLEMAS = {
  heroi: { disco: 0x1a1416, cor: 0xf6c82a, emissivo: 0x8a6008, forma: 'faisca', brilhoTecido: 0x8a1010 },
  zoom: { disco: 0x05070a, cor: 0x3a8cff, emissivo: 0x1a50ff, forma: 'divisa', brilhoTecido: 0x203050 },
  reverso: { disco: 0x9a0a0a, cor: 0x141010, emissivo: 0x000000, forma: 'faisca', brilhoTecido: 0x806010 },
  savitar: { disco: 0x15181d, cor: 0x9fdcff, emissivo: 0x3fa8ff, forma: 'divisa', brilhoTecido: 0x607890 },
  // o traje novo (em aprovação): losango dourado em relevo com o fundo vinho e um raio próprio cruzando
  civil: { disco: 0, cor: 0, emissivo: 0, forma: 'faisca', brilhoTecido: 0x1a2440 },   // à paisana: sem emblema, brilho de tecido azul
  vulto: { disco: 0, cor: 0, emissivo: 0, forma: 'faisca', brilhoTecido: 0x101012 },   // o vulto: sem emblema, tecido fosco
  novo: { disco: 0x3a0309, cor: 0xffc93a, emissivo: 0x9a6a08, forma: 'losango', brilhoTecido: 0xa0141a },
};
const SEM_EMBLEMA = new Set(['civil', 'vulto', 'bumerangue', 'trapaceiro', 'espelhos', 'piao', 'peekaboo']);
// trajes maiores que o herói (a armadura do Savitar)
const ESCALA_TRAJE = { savitar: 1.14 };
const NOMES = ['pelve', 'lombar', 'peito', 'pescoco', 'cabeca', 'claviculaE', 'bracoE', 'antebracoE', 'maoE', 'claviculaD', 'bracoD', 'antebracoD', 'maoD',
  'coxaE', 'canelaE', 'peE', 'coxaD', 'canelaD', 'peD', 'ajJoelhoE', 'ajJoelhoD', 'ajCotoveloE', 'ajCotoveloD', 'ajQuadrilE', 'ajQuadrilD'];
const PAI = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 2, 9, 10, 11, 0, 13, 14, 0, 16, 17, 14, 17, 7, 11, 0, 0];
const I = Object.fromEntries(NOMES.map((n, i) => [n, i]));
const AJ = [[19, 13, 14], [20, 16, 17], [21, 6, 7], [22, 10, 11], [23, 0, 13], [24, 0, 16]];   // ajudante, osso de cima, osso de baixo

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

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

/** Cria o herói (ou, com `pessoa`, alguém da história). Devolve {grupo, aplicar(est, dt), materiais, dispose()}. */
export async function criarHeroi({ aniso = 4, lod = 1, mobile = false, traje = 'heroi', pessoa = null } = {}) {
  const base = pessoa ? new URL(`../assets/personagens/${pessoa}/`, import.meta.url) : BASE;
  const [ind, bin] = await Promise.all([fetch(new URL('corpo.json', base)).then((r) => r.json()), fetch(new URL('corpo.bin', base)).then((r) => r.arrayBuffer())]);
  const dados = lerCorpo(ind, bin), L = dados.lods[lod];
  const origens = origensDeRepouso(ind.repouso.juntas, ind.repouso);

  const raiz = new THREE.Group();                    // espaço do modelo (x = frente)
  const ossos = NOMES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  ossos.forEach((b, i) => { const pai = PAI[i], o = origens[i]; if (pai < 0) { b.position.set(o[0], o[1], o[2]); raiz.add(b); } else { const po = origens[pai]; b.position.set(o[0] - po[0], o[1] - po[1], o[2] - po[2]); ossos[pai].add(b); } });
  raiz.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(ossos);

  let matCorpo, matCabeca, texCabeca, texs = [];
  if (pessoa) {
    // roupa e rosto pelas texturas do próprio modelo. O cabelo é o da malha da cabeça: as mechas soltas do Rocketbox
    // (a parte 'cabelo' do corpo.json) não encaixam na textura daqui e ficam de fora.
    const [tc, th] = await Promise.all(['corpo', 'cabeca'].map((n) => texturaWebp(new URL(`${n}.webp`, base).href, true, aniso)));
    texCabeca = th; texs = [tc];
    matCorpo = new THREE.MeshStandardMaterial({ map: tc, roughness: 0.82, metalness: 0 });
    matCabeca = new THREE.MeshStandardMaterial({ map: th, roughness: 0.6, metalness: 0 });
  } else {
    texCabeca = await texturaWebp(new URL('cabeca-rb.webp', BASE).href, true, aniso);
    // o traje (cores, painéis, frisos, cinto, luvas, botas e a máscara) é desenhado no shader: js/traje.js.
    // No PC, verniz (clearcoat) e brilho de tecido (sheen); no celular, o mesmo desenho sem essas camadas.
    matCorpo = aplicarTraje(mobile
      ? new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, emissive: traje === 'civil' ? 0x000000 : 0x120002 })
      : new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.18, sheenColor: new THREE.Color(EMBLEMAS[traje]?.brilhoTecido ?? 0x8a1010), emissive: traje === 'civil' ? 0x000000 : 0x120002 }), 'corpo', traje);
    matCabeca = aplicarTraje(new THREE.MeshStandardMaterial({ map: texCabeca, roughness: 0.65, metalness: 0 }), 'cabeca', traje);
  }
  const corpo = malha(L.partes.corpo, esqueleto, matCorpo), cabeca = malha(L.partes.cabeca, esqueleto, matCabeca);
  for (const m of [corpo, cabeca]) { raiz.add(m); m.bind(esqueleto, new THREE.Matrix4()); }

  // emblema próprio do herói (no centro do peitoral): disco grafite, anel dourado e uma faísca de quatro pontas
  const J = ind.repouso.juntas;
  const EM = EMBLEMAS[traje] || EMBLEMAS.heroi;
  const matDisco = new THREE.MeshStandardMaterial({ color: EM.disco, roughness: 0.35, metalness: 0.4 });
  const matEmb = new THREE.MeshStandardMaterial({ color: EM.cor, roughness: 0.25, metalness: 0.85, emissive: EM.emissivo, emissiveIntensity: 0.7, side: THREE.DoubleSide });
  const emb = new THREE.Group();
  const faisca = new THREE.Shape();
  if (EM.forma === 'losango') {
    // losango em relevo (moldura dourada chanfrada), o fundo vinho e o raio dourado cruzando por cima, também em relevo
    const losango = (w, h) => { const f = new THREE.Shape(); f.moveTo(0, h); f.lineTo(w, 0); f.lineTo(0, -h); f.lineTo(-w, 0); f.closePath(); return f; };
    const moldura = losango(0.074, 0.088); moldura.holes.push(losango(0.056, 0.067));
    const ext = (forma, prof) => new THREE.ExtrudeGeometry(forma, { depth: prof, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0022, bevelSegments: 2, curveSegments: 1 });
    emb.add(new THREE.Mesh(ext(moldura, 0.005), matEmb));
    emb.add(new THREE.Mesh(new THREE.ShapeGeometry(losango(0.058, 0.07)), matDisco));
    const raio = new THREE.Shape();
    [[0.03, 0.068], [-0.012, 0.006], [0.01, 0.006], [-0.03, -0.068], [0.014, -0.004], [-0.008, -0.004]].forEach(([x, y], i) => (i ? raio.lineTo(x, y) : raio.moveTo(x, y)));
    raio.closePath();
    const mr = new THREE.Mesh(ext(raio, 0.007), matEmb); mr.position.z = 0.001; emb.add(mr);
  } else {
  const disco = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), matDisco); disco.position.z = -0.001; emb.add(disco);
  emb.add(new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 40), matEmb));
  if (EM.forma === 'divisa') {                          // duas divisas (setas) apontando para a frente
    for (const o of [-0.022, 0.018]) { faisca.moveTo(o - 0.018, 0.04); faisca.lineTo(o + 0.022, 0); faisca.lineTo(o - 0.018, -0.04); faisca.lineTo(o - 0.032, -0.04); faisca.lineTo(o + 0.008, 0); faisca.lineTo(o - 0.032, 0.04); faisca.closePath(); }
  } else { faisca.moveTo(0, 0.052); faisca.lineTo(0.014, 0.014); faisca.lineTo(0.052, 0); faisca.lineTo(0.014, -0.014); faisca.lineTo(0, -0.052); faisca.lineTo(-0.014, -0.014); faisca.lineTo(-0.052, 0); faisca.lineTo(-0.014, 0.014); faisca.closePath(); }
  emb.add(new THREE.Mesh(new THREE.ShapeGeometry(faisca), matEmb));
  }
  // a frente do peito em repouso fica em x = 0,145: o emblema logo à frente dela, no meio do peitoral
  emb.scale.setScalar(1.15); emb.position.set(0.152, 1.325 - J.peito[1], 0); emb.rotation.y = Math.PI / 2;
  if (EM.forma === 'losango') { emb.position.x = 0.146; emb.scale.z = 0.5; }       // o relevo colado no peito (de lado não fica uma placa solta)
  if (!pessoa && !SEM_EMBLEMA.has(traje)) ossos[I.peito].add(emb);        // à paisana (e o vulto), sem emblema
  emb.material = matEmb;

  const frente = new THREE.Group();
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

  const est = { fase: 0, ar: 0, planeio: 0, parede: 0, vib: 0, pele: 0, tt: 0, luta: 0 };
  const posAn = new THREE.Vector3(), origem = new THREE.Vector3(), semente = { s: 1 };
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
    // luta: guarda (punhos na frente do rosto) e o tronco gira com o golpe (soco, gancho, raio)
    est.luta = lerp(est.luta, e.luta || 0, 1 - Math.exp(-8 * dt));
    const g = e.golpe, giroG = g ? -g.lado * (g.tipo === 'gancho' ? 0.45 : 0.38) * g.k : 0, inclG = g?.tipo === 'gancho' ? 0.12 * g.k : g ? -0.1 * g.k : 0;
    const lutaInc = 0.12 * est.luta * (1 - est.ar);
    local(1, 0, -twist * 0.5 + giroG * 0.5, -0.45 * lean + 0.02 * resp - lutaInc * 0.5 + inclG);
    local(2, 0, -twist * 0.6 + giroG * 0.6, -0.45 * lean - lutaInc * 0.5 + inclG * 0.5);
    local(3, 0, 0, 0.1 * lean);
    // falando (cenas da história): a cabeça acompanha a fala e os braços gesticulam
    est.fala = lerp(est.fala || 0, e.fala ? 1 : 0, 1 - Math.exp(-5 * dt));
    const fl = est.fala * (1 - vivo);
    local(4, 0, twist * 0.2 + fl * 0.12 * Math.sin(tt * 1.7), 0.5 * lean * (1 - 0.0) - 0.04 + fl * 0.05 * Math.sin(tt * 3.1));
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
      const Lp = est.luta * (1 - noAr) * (1 - r);               // base de luta: joelhos dobrados, pés afastados, um à frente
      knee += 0.32 * Lp; hip += 0.16 * Lp + (E ? 0.14 : -0.1) * Lp;
      const abd = lado * (0.035 + 0.07 * Lp) * (1 - noAr);
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
      let abdB = lerp(lado * 0.8, -lado * 0.84, est.planeio);
      const L = est.luta * (1 - noAr) * (1 - r * 0.8);
      if (L > 0.01) { swing = lerp(swing, 0.35, L); cot = lerp(cot, 1.55, L); abdB = lerp(abdB, lado * 0.86, L); }
      if (g && g.k > 0) {
        const meu = lado === g.lado;
        if (meu && (g.tipo === 'soco' || g.tipo === 'raio')) { swing = lerp(swing, 1.5, g.k); cot = lerp(cot, 0.04, g.k); abdB = lerp(abdB, lado * 1.0, g.k); }
        else if (meu && g.tipo === 'gancho') { swing = lerp(swing, 1.2, g.k); cot = lerp(cot, 1.05, g.k); abdB = lerp(abdB, lado * 0.95, g.k); }
        else { swing = lerp(swing, 0.35, g.k); cot = lerp(cot, 1.6, g.k); abdB = lerp(abdB, lado * 0.86, g.k); }   // o outro braço fica na guarda
      }
      if (fl > 0.01) { const gst = 0.5 + 0.5 * Math.sin(tt * (E ? 2.3 : 1.9) + (E ? 0 : 1.7)); swing = lerp(swing, 0.32 + 0.22 * gst, fl * (E ? 0.6 : 1)); cot = lerp(cot, 1.15 + 0.35 * gst, fl * (E ? 0.6 : 1)); abdB = lerp(abdB, lado * 0.62, fl); }
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
      frente.getWorldPosition(origem);
      for (const i of [I.peE, I.peD]) { ossos[i].getWorldPosition(posAn); posAn.sub(origem); posAn.y -= raiz.position.y; if (posAn.y < minY) minY = posAn.y; }
      raiz.position.y = (0.115 - minY) * (1 - noAr * 2);
    }
    // material: vibração = translúcido com brilho
    if (!pessoa) matCorpo.emissive.setRGB(0.02 + 0.8 * vj * (0.5 + 0.5 * Math.sin(tt * 90)), 0.003 + 0.3 * vj, 0.004);
    matCorpo.opacity = 1 - 0.38 * vj; matCorpo.transparent = vj > 0.02;
    matCabeca.opacity = matCorpo.opacity; matCabeca.transparent = matCorpo.transparent;
    return raiz.position.y;
  }

  // pose inicial
  aplicar({ v: 0, noChao: true }, 0.016);
  // o modelo olha para +x; o jogo olha para +z (rotação y = -90°)
  frente.rotation.y = -Math.PI / 2; frente.add(raiz);
  if (pessoa) frente.scale.setScalar(PESSOAS[pessoa]?.escala ?? 1);
  else if (ESCALA_TRAJE[traje]) frente.scale.setScalar(ESCALA_TRAJE[traje]);
  const materiais = [matCorpo, matCabeca, matDisco, matEmb, texCabeca, ...texs];
  return {
    grupo: frente, aplicar, materiais, ossos, raiz,
    setVisivelProfundo(prof) { for (const m of [matCorpo, matCabeca, matDisco, matEmb]) { m.depthTest = !prof; } },
    dispose() { corpo.geometry.dispose(); cabeca.geometry.dispose(); materiais.forEach((m) => m.dispose?.()); },
  };
}
