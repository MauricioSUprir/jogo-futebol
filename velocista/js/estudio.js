// O QUADRO DE VÍDEO das cenas (edição pessoal; dono, 31/10: "todos os personagens terem seu boneco ... as cenas NÃO podem
// ser paradas, tem que ter movimento"): quem fala do S.T.A.R. Labs pelo comunicador (Caitlin, Cisco, Wells) com o herói longe
// do laboratório aparece no Cortex, num quadro no canto de cima da tela, gesticulando e com a câmera sempre andando; as falas
// da TV mostram o laboratório ao vivo, visto de um helicóptero. É uma cena 3D pequena, à parte: o laboratório de verdade só
// existe (carregado) com o herói perto dele. Desenhada por cima da imagem do jogo, no retângulo do quadro (#quadroVideo).
import * as THREE from 'three';
import { criarHeroi } from './humano.js';
import { construirSilhueta } from './lab3d.js';

const DO_LAB = new Set(['caitlin', 'cisco', 'wells', 'thawne']);

/** as telas do Cortex (uma textura de canvas): gráficos, o mapa da cidade, a assinatura do acelerador */
function telas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#04070f'; x.fillRect(0, 0, 2048, 512);
  const painel = (px, py, w, h, f) => { x.save(); x.translate(px, py); x.fillStyle = '#071226'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(90,190,255,.55)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); f(w, h); x.restore(); };
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let k = 0; k < 6; k++) painel(30 + k * 336, 70, 300, 200, (w, h) => {
    x.strokeStyle = ['#5fd2ff', '#ffcf3a', '#ff5a4a', '#7dffa8', '#5fd2ff', '#b98cff'][k]; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40, y = h * (0.55 + 0.3 * Math.sin(t * (6 + k) + k) * (0.4 + rnd() * 0.6)); i ? x.lineTo(t * w, y) : x.moveTo(t * w, y); }
    x.stroke(); x.fillStyle = 'rgba(160,210,255,.8)'; x.font = '600 22px Inter, sans-serif'; x.fillText(['PARTÍCULAS', 'BATIMENTOS', 'ENERGIA', 'TAQUÍONS', 'CIDADE', 'SINAL'][k], 14, 32);
  });
  for (let k = 0; k < 4; k++) painel(110 + k * 470, 300, 400, 170, (w, h) => {
    x.strokeStyle = 'rgba(95,210,255,.5)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(0, i * h / 8); x.lineTo(w, i * h / 8); x.stroke(); x.beginPath(); x.moveTo(i * w / 8, 0); x.lineTo(i * w / 8, h); x.stroke(); }
    x.fillStyle = '#ffcf3a'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(rnd() * w, rnd() * h, 6, 0, 7); x.fill(); }
  });
  x.fillStyle = 'rgba(200,230,255,.9)'; x.font = '700 34px Inter, sans-serif'; x.fillText('S.T.A.R. LABS · CÓRTEX', 760, 46);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function criarEstudio({ mobile = false, aniso = 2 } = {}) {
  const cena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 4000);
  const geos = [], mats = [];
  const m = (g, mat) => { geos.push(g); mats.push(mat); return new THREE.Mesh(g, mat); };

  // ---------- o Cortex ----------
  const cortex = new THREE.Group(); cena.add(cortex);
  cortex.add(new THREE.HemisphereLight(0xa8c4ff, 0x0b0f18, 1.5));
  const chave = new THREE.DirectionalLight(0xfff4e8, 2.4); chave.position.set(1.8, 3, 3.2); cortex.add(chave);
  const recorte = new THREE.DirectionalLight(0x53d6ff, 3.2); recorte.position.set(-2.2, 2.2, -3); cortex.add(recorte);
  const piso = m(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a1222, roughness: 0.3, metalness: 0.5 }));
  cortex.add(piso);
  const tex = telas();
  const parede = m(new THREE.CylinderGeometry(5.2, 5.2, 4.4, 56, 1, true, Math.PI * 0.55, Math.PI * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x0e1a33, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85, roughness: 0.55, side: THREE.BackSide }));
  parede.position.y = 2.2; cortex.add(parede);
  // a mesa em arco, com a borda acesa (o tampo de vidro com o brilho dos monitores)
  const mesa = m(new THREE.CylinderGeometry(1.55, 1.55, 0.86, 40, 1, true, -0.75, 1.5), new THREE.MeshStandardMaterial({ color: 0x141c2c, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
  mesa.position.set(0, 0.43, -0.75); cortex.add(mesa);
  const borda = m(new THREE.TorusGeometry(1.55, 0.025, 6, 40, 1.5), new THREE.MeshBasicMaterial({ color: 0x5fd8ff }));
  borda.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.75); borda.position.set(0, 0.87, -0.75); cortex.add(borda);
  for (const [px, ry] of [[-0.55, 0.35], [0.55, -0.35]]) {
    const mon = m(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ map: tex, color: 0x9fdcff }));
    mon.position.set(px, 1.12, 0.62); mon.rotation.y = Math.PI + ry; cortex.add(mon);
  }

  // ---------- a TV: o S.T.A.R. Labs ao vivo, de noite, visto de um helicóptero ----------
  const tv = new THREE.Group(); cena.add(tv); tv.visible = false;
  const ceuGeo = new THREE.SphereGeometry(2500, 24, 12), cores = [];
  for (let i = 0; i < ceuGeo.attributes.position.count; i++) { const y = ceuGeo.attributes.position.getY(i) / 2500, k = Math.max(0, y); cores.push(0.05 + 0.12 * (1 - k), 0.05 + 0.06 * (1 - k), 0.16 + 0.12 * (1 - k)); }
  ceuGeo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  tv.add(m(ceuGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  const chao = m(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x05070c }));
  tv.add(chao);
  { // as luzes da cidade em volta
    const n = mobile ? 900 : 2200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 120 + Math.random() * 1400, a = Math.random() * 6.28; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.5 + Math.random() * 30; pos[i * 3 + 2] = Math.sin(a) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tv.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd38a, size: 2.2, sizeAttenuation: true }))); geos.push(g);
  }
  const lab = construirSilhueta(THREE, 0, 0); tv.add(lab.grupo); lab.grupo.visible = true;
  const caixa = new THREE.Box3().setFromObject(lab.grupo), labC = caixa.getCenter(new THREE.Vector3()), labH = caixa.max.y;
  const nevoa = { near: 600, far: 3000, color: new THREE.Color(0x0a0d1c) };

  // ---------- quem fala ----------
  const atores = {}, carregando = {};
  function ator(id) {
    const pessoa = id === 'thawne' ? 'wells' : id;
    if (!carregando[id]) carregando[id] = criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, pessoa }).then((mod) => {
      const raiz = new THREE.Group(); raiz.add(mod.grupo); raiz.visible = false; cortex.add(raiz); atores[id] = { mod, raiz };
    }).catch((e) => console.warn('quadro de vídeo sem', id, e));
    return carregando[id];
  }

  // ---------- o quadro na tela ----------
  const quadro = document.createElement('div'); quadro.id = 'quadroVideo'; quadro.hidden = true;
  quadro.innerHTML = '<span class="qv-rotulo"><i></i><b></b></span>';
  document.body.appendChild(quadro);
  const rotulo = quadro.querySelector('b');

  let atual = null, t = 0, a0 = 0;
  /** deixa prontos os corpos de quem vai falar do laboratório numa cena */
  function preparar(ids) { for (const id of ids) if (DO_LAB.has(id)) ator(id); }
  /** mostra o quadro com `id` falando (do Cortex) ou 'tv'; null esconde. Devolve se está mostrando */
  function mostrar(id) {
    if (id && id !== 'tv' && !atores[id]) { if (DO_LAB.has(id)) ator(id); id = null; }   // (o corpo ainda carregando: sem o quadro)
    if (id === atual) return !!id;
    atual = id; t = 0; a0 = (Math.random() - 0.5) * 0.7;
    quadro.hidden = !id; quadro.classList.toggle('tv', id === 'tv');
    if (!id) return false;
    rotulo.textContent = id === 'tv' ? 'AO VIVO · CANAL 4' : 'S.T.A.R. LABS · CÓRTEX';
    cortex.visible = id !== 'tv'; tv.visible = id === 'tv';
    for (const [k, a] of Object.entries(atores)) a.raiz.visible = k === id;
    if (id !== 'tv') { const a = atores[id]; a.raiz.position.set(0, 0, 0); a.raiz.rotation.y = 0; }
    return true;
  }
  const r0 = new THREE.Vector4();
  /** desenha o quadro por cima da imagem do jogo (depois do pós-processamento) */
  function desenhar(renderer, dt, canvas) {
    if (!atual) return;
    t += dt;
    const sentado = atual === 'wells' || atual === 'thawne';
    if (atual === 'tv') {
      // o helicóptero: um arco largo em volta da torre, descendo devagar
      const g = a0 + 0.6 + t * 0.06, r = 330 - t * 4, y = labH * 0.85 + 70 - t * 2;
      cam.position.set(labC.x + Math.sin(g) * r, y, labC.z + Math.cos(g) * r); cam.lookAt(labC.x, labH * 0.55, labC.z);
      lab.atualizar(cam, nevoa, 1, true, t);
    } else {
      const a = atores[atual]; if (!a) return;
      // quem fala vira um pouco para as telas e volta (está trabalhando enquanto fala)
      a.raiz.rotation.y = 0.28 * Math.sin(t * 0.45 + a0 * 3);
      a.mod.aplicar({ v: 0, noChao: true, fala: true, sentado }, dt);
      const yc = sentado ? 1.2 : 1.55, g = a0 + t * 0.07, d = Math.max(1.35, 2.35 - t * 0.12);
      cam.position.set(Math.sin(g) * d + 0.02 * Math.sin(t * 1.3), yc + 0.05 + 0.015 * Math.sin(t * 1.7), Math.cos(g) * d);
      cam.lookAt(0.01 * Math.sin(t * 1.9), yc - 0.08, 0);
    }
    // o retângulo do quadro, em pixels do canvas (o setViewport do three já multiplica pela densidade da tela)
    const rc = canvas.getBoundingClientRect(), rq = quadro.getBoundingClientRect();
    const x = rq.left - rc.left, y = rc.bottom - rq.bottom, w = rq.width, h = rq.height;
    if (w < 8 || h < 8) return;
    if (Math.abs(cam.aspect - w / h) > 1e-3) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    renderer.getViewport(r0);
    const alvo = renderer.getRenderTarget(), autoClear = renderer.autoClear;
    renderer.setRenderTarget(null); renderer.autoClear = true;
    renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
    renderer.render(cena, cam);
    renderer.setScissorTest(false); renderer.setViewport(r0.x, r0.y, r0.z, r0.w);   // (getViewport devolve em pixels CSS, como o setViewport recebe)
    renderer.setRenderTarget(alvo); renderer.autoClear = autoClear;
  }
  return {
    preparar, mostrar, desenhar,
    get atual() { return atual; },
    /** os corpos prontos (testes) */
    get prontos() { return Object.keys(atores); },
  };
}
