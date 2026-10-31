// Ato 3 — o tempo. Três peças:
//  - FENDAS temporais: rasgos no ar em cruzamentos em volta do laboratório (o Núcleo Aurora acordou). Fecha quem fica
//    VIBRANDO dentro dela até o anel encher;
//  - o TÚNEL do tempo: um tubo de luz em volta do herói (shader com faixas correndo), mostrado nas cenas da viagem;
//  - a NOITE DO ACIDENTE (época 'passado'): a cidade parada na noite de seis semanas atrás, com a coluna de energia do
//    Núcleo saindo da cúpula, raios em volta e o Flash Reverso do passado na porta do laboratório; a EXPLOSÃO é chamada
//    por uma fala da cena.
// A lógica de jogo (missões, cenas, época) fica em jogo.js; aqui só o que existe no mundo e o desenho.
import * as THREE from 'three';
import { CELL, MEIO, LAB_CELULA } from './cidade.js';
import { criarHeroi } from './humano.js';

const eixo = (k) => k * CELL - MEIO;
const [LI, LJ] = LAB_CELULA;
// quatro cruzamentos em volta do S.T.A.R. Labs (nem perto demais, nem longe demais)
const LUGARES_FENDA = [[LI - 3, LJ + 2], [LI + 4, LJ - 2], [LI + 2, LJ + 5], [LI - 4, LJ - 3]].map(([i, j]) => ({ x: eixo(i), z: eixo(j) }));
const rnd = (a, b) => a + Math.random() * (b - a);

const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// miolo da fenda: um redemoinho de luz azul e dourada, com a borda sumindo
const FRAG_FENDA = /* glsl */`
uniform float t; uniform float forca; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
  float espiral = sin(a * 5.0 + r * 14.0 - t * 6.0) * 0.5 + 0.5;
  float anel = smoothstep(1.0, 0.75, r) * smoothstep(0.0, 0.5, r);
  vec3 cor = mix(vec3(0.18, 0.45, 1.4), vec3(1.4, 0.95, 0.25), espiral);
  float alfa = anel * (0.25 + 0.5 * espiral) * forca;
  gl_FragColor = vec4(cor * alfa, alfa);
}`;
// túnel: faixas de luz correndo ao longo do tubo (v = comprimento), azul e dourado, com relâmpagos
const FRAG_TUNEL = /* glsl */`
uniform float t; varying vec2 vUv;
float h(float n) { return fract(sin(n * 91.345) * 47453.1); }
void main() {
  float u = vUv.x * 48.0, v = vUv.y * 6.0 - t * 3.5;
  float col = floor(u), f = fract(v + h(col) * 7.0);
  float faixa = smoothstep(0.0, 0.06, f) * smoothstep(0.45, 0.06, f) * step(0.35, h(col + 3.0));
  vec3 cor = mix(vec3(0.15, 0.45, 1.6), vec3(2.2, 1.5, 0.35), h(col + 11.0));
  float raio = pow(max(0.0, sin(vUv.x * 40.0 + t * 9.0) * sin(vUv.y * 25.0 - t * 13.0)), 30.0) * 3.0;
  vec3 fundo = vec3(0.02, 0.03, 0.08) + vec3(0.05, 0.1, 0.3) * (0.5 + 0.5 * sin(vUv.y * 20.0 - t * 2.0));
  gl_FragColor = vec4(fundo + cor * faixa * 1.6 + vec3(1.6, 1.8, 2.4) * raio, 1.0);
}`;

export function criarTempo(cena, { mobile = false, aniso = 2, fx, lab, chao = null } = {}) {
  const U = { t: { value: 0 } };

  // ---------- fendas ----------
  const geoMiolo = new THREE.CircleGeometry(2.4, 40), geoAnel = new THREE.TorusGeometry(2.55, 0.09, 8, 64);
  // o anel de progresso em 21 passos prontos (nada de geometria nova a cada quadro)
  const PROG = Array.from({ length: 21 }, (_, i) => new THREE.RingGeometry(2.75, 3.0, 48, 1, Math.PI / 2, Math.max(0.001, i / 20) * Math.PI * 2));
  const fendas = LUGARES_FENDA.map((p, k) => {
    const g = new THREE.Group(); g.position.set(p.x, 3.2, p.z); g.visible = false; cena.add(g);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_FENDA, uniforms: { t: U.t, forca: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(geoMiolo, mat));
    g.add(new THREE.Mesh(geoAnel, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 0.78, 0.26), toneMapped: false })));   // forte o bastante para o brilho, sem estourar de perto
    const prog = new THREE.Mesh(PROG[0], new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.4), transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide }));
    g.add(prog);
    g.rotation.y = k * 0.9;
    return { ...p, g, mat, prog, aberta: false, progresso: 0, sumindo: 0 };
  });
  let fendasLigadas = false;
  function ligarFendas(on) {
    fendasLigadas = on;
    for (const f of fendas) { if (on && !f.fechada) { f.aberta = true; f.g.visible = true; } if (!on) f.g.visible = false; }
  }
  /** devolve quantas fendas fecharam neste quadro */
  function passoFendas(dt, P) {
    let fechou = 0;
    for (let k = 0; k < fendas.length; k++) {
      const f = fendas[k];
      if (f.sumindo > 0) { f.sumindo -= dt; const s = Math.max(0.001, f.sumindo / 0.8); f.g.scale.setScalar(s); if (f.sumindo <= 0) f.g.visible = false; continue; }
      if (!f.aberta) continue;
      f.g.rotation.z += dt * 0.4;
      const d = Math.hypot(P.x - f.x, P.z - f.z), dentro = d < 4 && Math.abs(P.y + 1 - f.g.position.y) < 4;
      f.progresso = Math.max(0, Math.min(1, f.progresso + (dentro && P.vibrando ? dt / 2.2 : -dt * 0.25)));
      f.prog.material.opacity = 0.25 + 0.75 * f.progresso; f.prog.geometry = PROG[Math.round(f.progresso * 20)];
      f.mat.uniforms.forca.value = 1 - 0.6 * f.progresso;
      if (Math.random() < dt * (d < 40 ? 3 : 0.8)) {
        const a = rnd(0, 6.28); fx.raio(f.x, f.g.position.y, f.z, f.x + Math.cos(a) * rnd(3, 7), f.g.position.y + rnd(-3, 3), f.z + Math.sin(a) * rnd(3, 7), { vida: 0.18, desvio: 0.6, r: 0.4, g: 1.2, b: 2.4 });
      }
      if (f.progresso >= 1) {
        f.aberta = false; f.fechada = true; f.sumindo = 0.8; fechou++;
        fx.clarao(f.x, f.g.position.y, f.z, 7, 0.4); fx.onda(f.x, 0, f.z, 14, 0.6);
      }
    }
    return fechou;
  }

  // ---------- túnel do tempo ----------
  const tunel = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 160, 48, 1, true).rotateX(Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_TUNEL, uniforms: { t: U.t }, side: THREE.BackSide, toneMapped: false }));
  tunel.visible = false; tunel.frustumCulled = false; cena.add(tunel);   // opaco e com profundidade: esconde a cidade lá fora

  // ---------- a noite do acidente ----------
  const coluna = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 5.5, 140, 24, 1, true).translate(0, 70, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.6, 2.6), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  coluna.position.set(lab.cx, 10, lab.cz); coluna.visible = false; cena.add(coluna);
  let reverso = null, carregandoRev = null;
  const posRev = { x: lab.entrada.x + 3, z: lab.entrada.z - 6 };
  function prepararReverso() {
    if (carregandoRev) return carregandoRev;
    carregandoRev = criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, traje: 'reverso' }).then((m) => {
      reverso = new THREE.Group(); reverso.add(m.grupo); reverso.userData.modelo = m; reverso.visible = false;
      reverso.position.set(posRev.x, chao ? chao(posRev.x, posRev.z, 2) : 0, posRev.z); cena.add(reverso);
    }).catch((e) => console.warn('reverso do passado sem corpo', e));
    return carregandoRev;
  }
  let epoca = 'presente', explosao = 0;

  return {
    // ---- fendas ----
    ligarFendas, passoFendas,
    get fendasLigadas() { return fendasLigadas; },
    /** o herói está a até 5 m de uma fenda aberta (a vibração pode começar parada) */
    pertoDeFenda(P) { return fendasLigadas && fendas.some((f) => f.aberta && Math.hypot(P.x - f.x, P.z - f.z) < 5); },
    get fendasAbertas() { return fendas.filter((f) => f.aberta).length; },
    /** a fenda aberta mais perto (para o guia) */
    alvoFenda(P) {
      let melhor = null, md = 1e9;
      for (const f of fendas) if (f.aberta) { const d = Math.hypot(P.x - f.x, P.z - f.z); if (d < md) { md = d; melhor = f; } }
      return melhor ? { x: melhor.x, z: melhor.z, cor: '#7fd8ff', rotulo: 'Fenda temporal' } : null;
    },
    fendas,
    // ---- túnel ----
    set tunel(on) { tunel.visible = !!on; },
    get tunel() { return tunel.visible; },
    // ---- época ----
    get epoca() { return epoca; },
    prepararReverso,
    /** muda a época do mundo: 'passado' liga a noite do acidente; 'ignicao' a linha do tempo alterada; 'presente' volta ao normal */
    definirEpoca(e) {
      epoca = e;
      coluna.visible = e === 'passado';
      if (reverso) reverso.visible = e === 'passado';
      document.body.classList.toggle('passado', e === 'passado' || e === 'noite');   // ('noite': o passado jogável, sem o laboratório)
      document.body.classList.toggle('ignicao', e === 'ignicao');     // Parte 2: a linha do tempo alterada (index.html)
    },
    /** onde está o Reverso do passado (foco da cena), com ele já carregado */
    focoReverso() { return reverso && reverso.visible ? { x: reverso.position.x, y: reverso.position.y, z: reverso.position.z } : null; },
    lugarDoReverso: posRev,
    /** a explosão do Núcleo: clarão, onda e raios saindo da cúpula para a cidade */
    explodir() {
      explosao = 2.5;
      fx.clarao(lab.cx, 18, lab.cz, 40, 0.9); fx.onda(lab.cx, 0, lab.cz, 90, 1.2);
      for (let i = 0; i < 18; i++) { const a = rnd(0, 6.28), r = rnd(30, 120); fx.raio(lab.cx, 22, lab.cz, lab.cx + Math.cos(a) * r, rnd(0, 20), lab.cz + Math.sin(a) * r, { vida: 0.9, desvio: 3, r: 2.2, g: 1.6, b: 0.6 }); }
      document.body.classList.remove('clarao'); void document.body.offsetWidth; document.body.classList.add('clarao');
    },
    /** a cada quadro (também nas cenas): anima fendas, túnel, coluna e o Reverso do passado */
    atualizar(dt, camera, P, { quemFala = null } = {}) {
      U.t.value += dt;
      if (tunel.visible) {
        // o tubo vai junto com a câmera, alinhado com o rumo do herói
        tunel.position.set(P.x, P.y + 1.4, P.z); tunel.rotation.set(0, P.h, 0);
        if (Math.random() < dt * 10) { const a = rnd(0, 6.28); fx.raio(P.x + Math.cos(a) * 8, P.y + 1.4 + Math.sin(a) * 8, P.z, P.x + Math.cos(a + 1) * 8, P.y + 1.4 + Math.sin(a + 1) * 8, P.z + rnd(-10, 10), { vida: 0.15, desvio: 1, r: 0.6, g: 1.4, b: 2.6 }); }
      }
      if (epoca === 'passado') {
        const pulso = 0.35 + 0.2 * Math.sin(U.t.value * 7) + 0.1 * Math.random();
        coluna.material.opacity = pulso + (explosao > 0 ? 0.6 : 0); coluna.scale.x = coluna.scale.z = 1 + (explosao > 0 ? explosao * 0.6 : 0.05 * Math.sin(U.t.value * 3));
        if (Math.random() < dt * 2.5) { const a = rnd(0, 6.28), r = rnd(10, 45); fx.raio(lab.cx, rnd(15, 60), lab.cz, lab.cx + Math.cos(a) * r, rnd(0, 8), lab.cz + Math.sin(a) * r, { vida: 0.25, desvio: 2, r: 1.0, g: 1.4, b: 2.6 }); }
        if (reverso) {
          reverso.visible = true;
          reverso.rotation.y = Math.atan2(P.x - reverso.position.x, P.z - reverso.position.z);
          reverso.userData.modelo.aplicar({ v: 0, noChao: true, fala: quemFala === 'reverso', vibrando: explosao > 0 }, dt);
        }
      }
      if (explosao > 0) explosao -= dt;
    },
  };
}
