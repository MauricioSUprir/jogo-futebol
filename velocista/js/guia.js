// Guia até o objetivo (como o GPS dos jogos de herói em mundo aberto): feixe de luz no local, marcador na tela com a
// distância (gruda na borda quando o local sai do quadro, com a seta para ele) e setas brilhantes no chão pelo caminho
// das ruas, também desenhado no minimapa. A rota anda pela grade de ruas: vai até a rua mais perto, segue por ela até o
// cruzamento com a rua do alvo e entra nela até a altura do alvo.
import * as THREE from 'three';
import { CELL, MEIO } from './cidade.js';

const eixo = (k) => k * CELL - MEIO;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ruaMaisPerto = (v) => Math.round((v + MEIO) / CELL);
const PASSO_SETA = 4.5;           // metros entre as setas do chão
const ALCANCE_SETAS = 170;        // setas só até essa distância de caminho à frente do herói

/** Rota pelas ruas de (x, z) até (tx, tz): lista de pontos [x, z]. */
export function rotaPelasRuas(x, z, tx, tz) {
  const kx = ruaMaisPerto(x), kz = ruaMaisPerto(z), dxRua = Math.abs(x - eixo(kx)), dzRua = Math.abs(z - eixo(kz));
  const pts = [[x, z]];
  if (Math.hypot(tx - x, tz - z) < 30) { pts.push([tx, tz]); return pts; }
  if (dxRua <= dzRua) {
    // estou numa rua que corre ao longo de z (x constante): sigo por ela até a rua horizontal do alvo
    const X = eixo(kx), Zt = eixo(ruaMaisPerto(tz));
    pts.push([X, z], [X, Zt], [tx, Zt]);
  } else {
    const Z = eixo(kz), Xt = eixo(ruaMaisPerto(tx));
    pts.push([x, Z], [Xt, Z], [Xt, tz]);
  }
  pts.push([tx, tz]);
  // tira trechos de comprimento ~0
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
}

export function criarGuia(cena, { mobile = false } = {}) {
  // ---- feixe de luz no alvo (um cilindro aberto com degradê vertical) + anel no chão ----
  const matFeixe = new THREE.ShaderMaterial({
    uniforms: { cor: { value: new THREE.Color(1.6, 1.2, 0.2) }, t: { value: 0 } },
    vertexShader: 'varying float vy; void main(){ vy = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 cor; uniform float t; varying float vy; void main(){ float a = (1.0 - smoothstep(0.0, 220.0, vy)) * (0.55 + 0.12 * sin(vy * 0.15 - t * 6.0)); gl_FragColor = vec4(cor * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
  });
  const geoFeixe = new THREE.CylinderGeometry(1.4, 1.4, 220, 16, 1, true); geoFeixe.translate(0, 110, 0);
  const feixe = new THREE.Mesh(geoFeixe, matFeixe); feixe.frustumCulled = false;
  const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 220, 8, 1, true).translate(0, 110, 0), matFeixe); nucleo.frustumCulled = false;
  const matAnel = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const anel = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.2, 40).rotateX(-Math.PI / 2), matAnel);
  const local = new THREE.Group(); local.add(feixe, nucleo, anel); local.visible = false; cena.add(local);

  // ---- setas no chão (uma malha instanciada; o brilho corre na direção do caminho) ----
  const forma = new THREE.Shape();
  forma.moveTo(0, 0.95); forma.lineTo(0.9, -0.15); forma.lineTo(0.55, -0.15); forma.lineTo(0, 0.45); forma.lineTo(-0.55, -0.15); forma.lineTo(-0.9, -0.15); forma.closePath();
  const geoSeta = new THREE.ShapeGeometry(forma); geoSeta.rotateX(-Math.PI / 2);       // a ponta para +z... depois de deitar aponta para -z
  geoSeta.rotateY(Math.PI);                                                               // ponta para +z
  const MAXS = Math.ceil(ALCANCE_SETAS / PASSO_SETA) + 2;
  const matSeta = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const setas = new THREE.InstancedMesh(geoSeta, matSeta, MAXS);
  setas.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXS * 3), 3);
  setas.frustumCulled = false; setas.count = 0; cena.add(setas);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0), corS = new THREE.Color();

  // ---- marcador na tela ----
  const mk = document.createElement('div'); mk.id = 'marcadorGuia';
  mk.innerHTML = '<svg viewBox="-20 -20 40 40"><path class="seta" d="M0 -17 L7 -9 L-7 -9 Z"/><path class="losango" d="M0 -10 L9 0 L0 10 L-9 0 Z"/><circle class="ponto" r="3"/></svg><span></span>';
  document.getElementById('hud').appendChild(mk);
  const mkTexto = mk.querySelector('span'), mkSvg = mk.querySelector('svg'), mkSeta = mk.querySelector('.seta');
  const proj = new THREE.Vector3();

  let rota = null, rotaT = 0, alvoAnt = null, tempo = 0;
  const corAlvo = new THREE.Color();

  /** alvo: {x, z, y?, cor:'#hex', rotulo?} ou null. camera: a câmera do jogo; P: o herói. */
  function atualizar(dt, alvo, P, camera) {
    tempo += dt; matFeixe.uniforms.t.value = tempo;
    if (!alvo) { local.visible = false; setas.count = 0; mk.style.display = 'none'; rota = null; return; }
    corAlvo.set(alvo.cor);
    const forte = corAlvo.clone().multiplyScalar(1.7);
    matFeixe.uniforms.cor.value.copy(forte); matAnel.color.copy(forte);
    // feixe e anel
    local.visible = true; local.position.set(alvo.x, alvo.y ?? 0.06, alvo.z);
    const pulso = (tempo * 0.8) % 1; anel.scale.setScalar(0.6 + pulso * 1.2); matAnel.opacity = 1 - pulso;
    const dist = Math.hypot(alvo.x - P.x, alvo.z - P.z);
    local.visible = dist > 22;                                  // de perto o feixe esconderia o alvo (vilão, bandidos)

    // rota: refeita a cada 0,25 s ou quando o alvo muda
    rotaT -= dt;
    if (!rota || rotaT <= 0 || !alvoAnt || Math.hypot(alvoAnt.x - alvo.x, alvoAnt.z - alvo.z) > 3) { rota = rotaPelasRuas(P.x, P.z, alvo.x, alvo.z); rotaT = 0.25; alvoAnt = { x: alvo.x, z: alvo.z }; }

    // setas: andam pela rota a cada PASSO_SETA m, deslizando para a frente (o caminho "corre" para o alvo)
    let n = 0, percorrido = 0;
    const fase = (tempo * 9) % PASSO_SETA;
    const noAlto = P.y > 12;                                     // no telhado: as setas continuam no chão, mais fortes
    if (dist > 12) {
      let resto = PASSO_SETA - fase + 4;                         // primeira seta 4 m à frente do herói (não fica embaixo dele)
      for (let i = 1; i < rota.length && n < MAXS; i++) {
        const [ax, az] = rota[i - 1], [bx, bz] = rota[i], L = Math.hypot(bx - ax, bz - az);
        if (L < 0.01) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L, h = Math.atan2(ux, uz);
        let s = resto;
        while (s < L && n < MAXS && percorrido + s < ALCANCE_SETAS) {
          const x = ax + ux * s, z = az + uz * s;
          if (Math.hypot(alvo.x - x, alvo.z - z) < 5) break;
          M.compose(V.set(x, 0.09, z), Q.setFromAxisAngle(Y, h), S.setScalar(mobile ? 0.8 : 0.68));
          setas.setMatrixAt(n, M);
          // some ao longe e perto do herói
          const d = percorrido + s, a = Math.min(1, Math.max(0, (d - 4) / 10)) * (1 - Math.max(0, (d - ALCANCE_SETAS * 0.6) / (ALCANCE_SETAS * 0.4)));
          corS.copy(corAlvo).multiplyScalar((noAlto ? 1.8 : 1.15) * Math.max(0, a));
          setas.setColorAt(n, corS);
          n++; s += PASSO_SETA;
        }
        resto = s - L; percorrido += L;
        if (percorrido > ALCANCE_SETAS) break;
      }
    }
    setas.count = n; setas.instanceMatrix.needsUpdate = true; if (setas.instanceColor) setas.instanceColor.needsUpdate = true;

    // marcador: posição do alvo na tela; fora do quadro (ou atrás) gruda na borda de uma elipse, com a seta para ele
    proj.set(alvo.x, (alvo.y ?? 0) + 3, alvo.z).project(camera);
    const W = innerWidth, H = innerHeight;
    let sx = proj.x, sy = -proj.y;
    const atras = proj.z > 1;
    if (atras) { sx = -sx; sy = -sy; }
    // a faixa de baixo (energia, o rótulo do marcador) e a de cima (missão) ficam livres: limites em pixels
    const yMax = 1 - 230 / H, yMin = -1 + 170 / H;
    const fora = atras || Math.abs(sx) > 0.88 || sy > yMax || sy < yMin;
    if (fora) {
      let a = Math.atan2(sy, sx); if (atras && Math.abs(sy) < 0.2) a = Math.atan2(0.9, sx >= 0 ? 0.4 : -0.4);
      sx = Math.cos(a) * 0.86; sy = clamp(Math.sin(a) * 0.9, yMin, yMax);
      mkSeta.style.display = ''; mkSeta.setAttribute('transform', `rotate(${(a * 180) / Math.PI + 90})`);
    } else mkSeta.style.display = 'none';
    mk.style.display = 'flex';
    mk.style.transform = `translate(${(sx * 0.5 + 0.5) * W}px, ${(sy * 0.5 + 0.5) * H}px)`;
    mk.style.color = alvo.cor; mkSvg.style.filter = `drop-shadow(0 0 6px ${alvo.cor})`;
    mkTexto.textContent = (alvo.rotulo ? alvo.rotulo + ' · ' : '') + (dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`);
    mk.classList.toggle('perto', dist < 25);
  }

  /** desenha a rota no minimapa (o contexto já está na transformação do mundo). */
  function desenharNoMapa(g, largura) {
    if (!rota || !alvoAnt) return;
    g.strokeStyle = corAlvo.getStyle(); g.lineWidth = largura; g.lineJoin = 'round'; g.lineCap = 'round';
    g.globalAlpha = 0.85; g.beginPath(); g.moveTo(rota[0][0], rota[0][1]);
    for (let i = 1; i < rota.length; i++) g.lineTo(rota[i][0], rota[i][1]);
    g.stroke(); g.globalAlpha = 1;
  }

  return { atualizar, desenharNoMapa, get rota() { return rota; }, get setas() { return setas.count; }, marcador: mk };
}
