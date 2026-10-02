// Traves, travessão, armação de trás, REDES DE PANO SIMULADAS e bandeirinhas de
// escanteio tremulando. Traves/armação/redes/mastros/bandeiras: 5 chamadas de desenho.
//
// ============================================================================
// API (para quem integra — stadium.js / main.js)
// ----------------------------------------------------------------------------
//   const goals = buildGoals(ctx)   // ctx = { U: { uTime, uWind }, anisotropy, shadows, quality? }
//   root.add(goals)
//
//   goals.userData.update(dt, time, ballPos, ballVel) -> ballOffset {x,y,z}
//       Chamar TODO quadro (depois da física, antes de renderizar). Se não for chamada,
//       a rede ainda anima os impactos de impact() sozinha (via onBeforeRender e U.uTime),
//       mas sem a bola "afundar" nem encostar nela — por isso vale a pena ligar.
//       dt       = segundos do quadro (é limitado internamente a 1/20 s)
//       time     = relógio da cena (o mesmo de U.uTime)
//       ballPos  = {x,y,z} posição da bola (pode ser null → só simula a rede)
//       ballVel  = {x,y,z} velocidade da bola em m/s (pode ser null)
//       Retorna um deslocamento de EXIBIÇÃO para a malha da bola (objeto reutilizado,
//       normalmente {0,0,0}). Durante um chute forte na rede, a rede "engole" a bola
//       e a empurra até ~1 m para fora do plano rígido que ball.js usa; somar este
//       deslocamento à posição desenhada da bola faz ela afundar junto com a rede.
//       Opcional (a rede funciona igual sem usar o retorno). Não altera a física.
//
//   goals.userData.impact(goalSign, point, strength, time)
//       Compatível com a versão antiga (evento 'net'/'sidenet' de ball.js).
//       goalSign -1 = gol oeste, +1 = gol leste; point {x,y,z}; strength 0..1.
//       Se update() já detectou o mesmo impacto pela velocidade da bola (caso normal),
//       a chamada é ignorada; senão aplica um "empurrão" no ponto (vindo de dentro
//       para fora, ou de fora para dentro se o ponto estiver fora do gol).
//
//   goals.userData.netInfo()   // diagnóstico: { nodes, springs, awake:[bool,bool], steps }
//
// Custo: 2 panos de 894 nós (teto+fundo contínuos 35×18 e duas laterais 11×12),
// 3285 molas cada (estruturais + cisalhamento, só de tração). Cada gol "dorme" quando
// a rede para (≈ 3–3,7 s depois de um chute forte: impacto + 1–3 s de balanço);
// dormindo, o custo de CPU é só um teste de caixa com a bola (~0,001 ms) e nada é
// reenviado à GPU. Acordado: passos de 1/120 s, 4 iterações (3 na qualidade baixa),
// normais recalculadas só no gol ativo; medido ≈0,6 ms/quadro por gol ativo num
// contêiner lento e disputado (SwiftShader) — bem menos num PC/celular comum.
// Montagem: ~0,15–0,3 s (a rede assenta sob a gravidade uma vez, com folga nas cordas).
// O balanço leve do vento quando parada é feito no shader (custo zero de CPU).
// ============================================================================
import * as THREE from 'three';
import { PITCH, GOAL, BALL } from './config.js';
import { mergeSimple } from './stadium-bowl.js';

const R = BALL.radius;
const H = 1 / 120;                 // passo da simulação do pano
const GRAV = 9.81;
const DAMP = 0.985;                // amortecimento por passo (ar + atrito das cordas)
const RC = 0.17;                   // raio de colisão bola↔nós (malha de simulação ≈ 22 cm)
const Y_TOP = GOAL.height + 0.03;  // altura em que o teto da rede prende no travessão
const HW = GOAL.halfWidth + GOAL.postRadius;
const CELL = 0.12;                 // tamanho da malha real da rede (12 cm)

function tube(a, b, r, seg = 12) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg, 1, false);
  g.translate(0, dir.length() / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  const n = g.toNonIndexed(); g.dispose();
  return n;
}
function ball(p, r, ws = 12, hs = 8) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.translate(p.x, p.y, p.z);
  const n = g.toNonIndexed(); g.dispose();
  return n;
}

// textura da rede: malha quadrada de cordas com nós, 4×4 células por repetição
function netTexture() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const cell = S / 4;
  // corda: núcleo branco com borda mais escura (dá volume de perto)
  const cord = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    for (let i = 0; i <= 4; i++) {
      const p = i * cell;
      g.beginPath(); g.moveTo(p, -4); g.lineTo(p, S + 4); g.stroke();
      g.beginPath(); g.moveTo(-4, p); g.lineTo(S + 4, p); g.stroke();
    }
  };
  cord(9, 'rgba(214,218,224,0.9)');
  cord(5.5, 'rgba(255,255,255,1)');
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    g.fillStyle = 'rgba(210,212,216,1)';
    g.beginPath(); g.arc(i * cell, j * cell, 7.5, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(i * cell - 1, j * cell - 1, 5, 0, 7); g.fill();
  }
  // o canvas guarda cor pré-multiplicada: os pixels transparentes viriam pretos e
  // escureceriam os mipmaps (franjas pretas de longe). Copia só o alfa e usa cor
  // clara em tudo.
  const img = g.getImageData(0, 0, S, S).data;
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const a = img[i * 4 + 3];
    const k = a > 8 ? img[i * 4] : 255;
    data[i * 4] = k; data[i * 4 + 1] = a > 8 ? img[i * 4 + 1] : 255; data[i * 4 + 2] = a > 8 ? img[i * 4 + 2] : 255;
    data[i * 4 + 3] = a;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// Montagem da malha de simulação de um gol (sinal s). Tudo em coordenadas do mundo.
// X = profundidade a partir da linha do gol (para fora do campo).
function netLayout(s, out) {
  const x0 = s * PITCH.halfL;
  const W = (X) => x0 + s * X;
  const nodes = out.nodes, springs = out.springs, tris = out.tris;
  const base0 = nodes.length;

  // grade genérica: fn(i,j) -> {x,y,z,u,v}; pin(i,j) -> bool
  // slackI/slackJ: folga das cordas em cada direção (cordas não resistem a compressão)
  function grid(ni, nj, fn, pin, slackI, slackJ, panel, flip) {
    const b = nodes.length;
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const p = fn(i, j);
      const edge = Math.min(i, j, ni - i, nj - j);
      nodes.push({ ...p, pin: pin(i, j), free: Math.min(1, edge / 3), panel });
    }
    const id = (i, j) => b + j * (ni + 1) + i;
    const L = (a, c) => Math.hypot(nodes[a].x - nodes[c].x, nodes[a].y - nodes[c].y, nodes[a].z - nodes[c].z);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      if (i < ni) springs.push([id(i, j), id(i + 1, j), L(id(i, j), id(i + 1, j)) * (1 + slackI), 1]);
      if (j < nj) springs.push([id(i, j), id(i, j + 1), L(id(i, j), id(i, j + 1)) * (1 + slackJ), 1]);
      if (i < ni && j < nj) {
        const sd = 1 + (slackI + slackJ) * 0.5 + 0.01;
        springs.push([id(i, j), id(i + 1, j + 1), L(id(i, j), id(i + 1, j + 1)) * sd, 0.35]);
        springs.push([id(i + 1, j), id(i, j + 1), L(id(i + 1, j), id(i, j + 1)) * sd, 0.35]);
      }
      if (i < ni && j < nj) {
        const a = id(i, j), bb = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        if (flip) tris.push(a, c, bb, a, d, c); else tris.push(a, bb, c, a, c, d);
      }
    }
  }

  // --- teto + fundo: uma única grade contínua. Colunas ao longo de z; linhas seguem o
  // perfil travessão → barra de trás no alto → barra do chão.
  const NC = 34, NR1 = 5, NR2 = 12, NR = NR1 + NR2;
  const A = [0.05, Y_TOP], B = [GOAL.topDepth, Y_TOP], C = [GOAL.depth, 0.0];
  const lenR = Math.hypot(B[0] - A[0], B[1] - A[1]), lenB = Math.hypot(C[0] - B[0], C[1] - B[1]);
  const prof = (j) => {
    if (j <= NR1) { const t = j / NR1; return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, lenR * t]; }
    const t = (j - NR1) / NR2; return [B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t, lenR + lenB * t];
  };
  grid(NC, NR, (i, j) => {
    const [X, y, arc] = prof(j), z = -HW + (2 * HW) * i / NC;
    return { x: W(X), y, z, u: (z + HW) / (CELL * 4), v: arc / (CELL * 4) };
  }, (i, j) => {
    const onRow = j === 0 || j === NR1 || j === NR, onCol = i === 0 || i === NC;
    // ganchos a cada 2 nós: entre eles a corda fica solta e forma "barriguinhas"
    return (onRow && (i % 2 === 0 || onCol)) || (onCol && (j % 2 === 0 || onRow));
  }, 0.05, 0.09, 0, s < 0);

  // --- laterais: X de 0 (trave) até o fundo inclinado; y do chão ao alto
  const NA = 10, NB = 11;
  for (const sz of [-1, 1]) {
    grid(NA, NB, (i, j) => {
      const y = Y_TOP * j / NB;
      const dep = GOAL.depth + (GOAL.topDepth - GOAL.depth) * (y / Y_TOP);
      const X = 0.05 + (dep - 0.05) * i / NA;
      return { x: W(X), y: Math.max(0.0, y), z: sz * HW, u: X / (CELL * 4), v: y / (CELL * 4) };
    }, (i, j) => {
      const onI = i === 0 || i === NA, onJ = j === 0 || j === NB;
      return (onJ && (i % 2 === 0 || onI)) || (onI && (j % 2 === 0 || onJ));
    }, 0.035, 0.03, sz < 0 ? 1 : 2, s * sz < 0);
  }
  return { first: base0, count: nodes.length - base0 };
}

// ---------------------------------------------------------------------------
// Pano de um gol: Verlet + restrições de distância só de tração (PBD).
class NetCloth {
  constructor(s, pos, info, springs, iters) {
    this.s = s;
    this.pos = pos;                         // Float32Array (vista do atributo 'position')
    this.n = pos.length / 3;
    this.prev = new Float32Array(pos);
    this.rest = new Float32Array(pos);
    this.inv = new Float32Array(this.n);    // 0 = preso
    for (let i = 0; i < this.n; i++) this.inv[i] = info[i].pin ? 0 : 1;
    const ns = springs.length;
    this.sa = new Uint16Array(ns); this.sb = new Uint16Array(ns);
    this.sl = new Float32Array(ns); this.sk = new Float32Array(ns);
    springs.forEach((sp, k) => { this.sa[k] = sp[0]; this.sb[k] = sp[1]; this.sl[k] = sp[2]; this.sk[k] = sp[3]; });
    this.iters = iters;
    this.awake = false;
    this.quiet = 0;
    this.awakeT = 0;
    this.acc = 0;
    this.steps = 0;
    this.maxMove = 0;
    // "bola virtual": empurra a rede além do plano rígido de ball.js
    this.px = { on: false, t: 0, q: 0, qd: 0, qmax: 1, nx: 0, ny: 0, nz: 0, ax: 0, ay: 0, az: 0, follow: false, cx: 0, cy: 0, cz: 0, pcx: 0, pcy: 0, pcz: 0, t0: -1e4 };
    // bola real (contato suave: bola parada dentro da rede, rolando no fundo)
    this.pending = null;
    this.bx = 0; this.by = -100; this.bz = 0; this.pbx = 0; this.pby = -100; this.pbz = 0;
  }

  // normais suaves (média das faces) só deste pano
  normals() {
    const p = this.pos, n = this.nrm, t = this.tri;
    n.fill(0);
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      const ex = p[c] - p[b], ey = p[c + 1] - p[b + 1], ez = p[c + 2] - p[b + 2];
      const fx = p[a] - p[b], fy = p[a + 1] - p[b + 1], fz = p[a + 2] - p[b + 2];
      const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
      n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
      n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
      n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
  }

  wake() { if (!this.awake) { this.awake = true; this.awakeT = 0; } this.quiet = 0; }

  // Assenta a rede sob a gravidade (feito uma vez na montagem) e guarda a pose de repouso.
  settle(steps = 260) {
    const d = DAMP;
    for (let k = 0; k < steps; k++) this.step(k < steps * 0.6 ? 0.9 : d, false);
    this.prev.set(this.pos);
    this.rest.set(this.pos);
  }

  step(damp, collide = true, f = 1) {
    const p = this.pos, q = this.prev, inv = this.inv, n = this.n;
    const g = GRAV * H * H;
    let mm = 0;
    for (let i = 0; i < n; i++) {
      if (inv[i] === 0) continue;
      const k = i * 3;
      const vx = (p[k] - q[k]) * damp, vy = (p[k + 1] - q[k + 1]) * damp, vz = (p[k + 2] - q[k + 2]) * damp;
      q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2];
      p[k] += vx; p[k + 1] += vy - g; p[k + 2] += vz;
      const m = Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
      if (m > mm) mm = m;
    }
    this.maxMove = mm;
    const sa = this.sa, sb = this.sb, sl = this.sl, sk = this.sk, ns = sa.length;
    const px = this.px;
    // centro da bola virtual interpolado dentro do quadro (sem túnel)
    const cx = px.pcx + (px.cx - px.pcx) * f, cy = px.pcy + (px.cy - px.pcy) * f, cz = px.pcz + (px.cz - px.pcz) * f;
    const bx = this.pbx + (this.bx - this.pbx) * f, by = this.pby + (this.by - this.pby) * f, bz = this.pbz + (this.bz - this.pbz) * f;
    for (let it = 0; it < this.iters; it++) {
      for (let s = 0; s < ns; s++) {
        const a = sa[s] * 3, b = sb[s] * 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const L2 = dx * dx + dy * dy + dz * dz, r = sl[s];
        if (L2 <= r * r) continue;                // corda frouxa: não empurra
        const L = Math.sqrt(L2);
        const wa = inv[sa[s]], wb = inv[sb[s]], w = wa + wb;
        if (w === 0) continue;
        const c = (L - r) / (L * w) * sk[s];
        p[a] += dx * c * wa; p[a + 1] += dy * c * wa; p[a + 2] += dz * c * wa;
        p[b] -= dx * c * wb; p[b + 1] -= dy * c * wb; p[b + 2] -= dz * c * wb;
      }
      if (!collide || it < this.iters - 2) continue;   // colisão nas 2 últimas iterações
      for (let i = 0; i < n; i++) {
        if (inv[i] === 0) continue;
        const k = i * 3;
        if (px.on && px.q > 0) {
          // coluna: tudo que está "atrás" da frente da bola (no sentido do chute) e
          // dentro do raio lateral é levado para a superfície da bola → a rede embrulha a bola
          const rx = p[k] - cx, ry = p[k + 1] - cy, rz = p[k + 2] - cz;
          const sN = rx * px.nx + ry * px.ny + rz * px.nz;
          if (sN > -0.7 && sN < RC) {
            const lat2 = rx * rx + ry * ry + rz * rz - sN * sN;
            if (lat2 < RC * RC) {
              const front = Math.sqrt(RC * RC - lat2);
              if (sN < front) { const m = front - sN; p[k] += px.nx * m; p[k + 1] += px.ny * m; p[k + 2] += px.nz * m; }
            }
          }
        }
        if (by > -50) {
          const rx = p[k] - bx, ry = p[k + 1] - by, rz = p[k + 2] - bz;
          const d2 = rx * rx + ry * ry + rz * rz, rb = R + 0.02;
          if (d2 < rb * rb && d2 > 1e-8) {
            const d = Math.sqrt(d2), m = (rb - d) / d;
            p[k] += rx * m; p[k + 1] += ry * m; p[k + 2] += rz * m;
          }
        }
        if (p[k + 1] < 0.012) p[k + 1] = 0.012;
      }
    }
    this.steps++;
  }
}

// ---------------------------------------------------------------------------
export function buildGoals(ctx) {
  const { U, anisotropy, shadows } = ctx;
  const low = ctx.quality && ctx.quality.label === 'Baixa';
  const group = new THREE.Group();
  group.name = 'gols';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const r = GOAL.postRadius, hw = HW, top = GOAL.height + r;
  const posts = [], frame = [];
  const rf = 0.024;

  // ---- malha de simulação das duas redes (antes da armação: os ganchos vão nos nós presos)
  const L = { nodes: [], springs: [], tris: [] };
  const ranges = [];
  const springsBy = [];
  for (const s of [-1, 1]) {
    const sp0 = L.springs.length;
    ranges.push(netLayout(s, L));
    springsBy.push([sp0, L.springs.length]);
  }

  for (const s of [-1, 1]) {
    const x = s * PITCH.halfL;
    // traves e travessão (medida interna 7,32 × 2,44), com bases arredondadas
    for (const z of [-hw, hw]) {
      posts.push(tube(V(x, 0, z), V(x, top, z), r, 24));
      posts.push(ball(V(x, top, z), r, 20, 12));
    }
    posts.push(tube(V(x, top, -hw), V(x, top, hw), r, 24));
    // armação de trás (tubos finos) + suportes traseiros
    const xb = x + s * GOAL.depth, xt = x + s * GOAL.topDepth, yt = Y_TOP;
    for (const z of [-hw, hw]) {
      frame.push(tube(V(x, 0.02, z), V(xb, 0.02, z), rf));
      frame.push(tube(V(x + s * 0.02, yt, z), V(xt, yt, z), rf));
      frame.push(tube(V(xt, yt, z), V(xb, 0.02, z), rf));
      frame.push(ball(V(xt, yt, z), rf * 1.6, 8, 6));
      frame.push(ball(V(xb, 0.02, z), rf * 1.6, 8, 6));
    }
    frame.push(tube(V(xb, 0.02, -hw), V(xb, 0.02, hw), rf));
    frame.push(tube(V(xt, yt, -hw), V(xt, yt, hw), rf));
    // escoras traseiras (2) do alto até o chão, um pouco para trás
    for (const z of [-hw * 0.34, hw * 0.34]) {
      frame.push(tube(V(xt, yt, z), V(xb + s * 0.15, 0.02, z), rf * 0.8, 8));
    }
  }
  // ganchos: pequenos anéis nos pontos em que a rede prende
  const hookGeos = [];
  for (const nd of L.nodes) if (nd.pin) hookGeos.push(ball(V(nd.x, nd.y, nd.z), 0.014, 6, 4));

  const postMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.28, metalness: 0.15 });
  // Vibração da trave/travessão quando a bola bate: modo de vibração amortecido,
  // preso no chão (traves) e com barriga no meio do travessão. Por gol (oeste/leste).
  const uShakeW = { value: new THREE.Vector4(-100, 0, 0, 0) };   // t0, força, z do impacto, altura
  const uShakeE = { value: new THREE.Vector4(-100, 0, 0, 0) };
  const shakeGLSL = (sh) => {
    sh.uniforms.uShakeW = uShakeW; sh.uniforms.uShakeE = uShakeE; sh.uniforms.uTimeS = U.uTime;
    sh.vertexShader = 'uniform vec4 uShakeW; uniform vec4 uShakeE; uniform float uTimeS;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 S = position.x < 0.0 ? uShakeW : uShakeE;
        float dt = uTimeS - S.x;
        if (dt > 0.0 && dt < 2.5) {
          float env = S.y * exp(-dt * 2.6);
          float hy = clamp(position.y / ${GOAL.height.toFixed(2)}, 0.0, 1.0);
          float bar = smoothstep(${(GOAL.height - 0.05).toFixed(2)}, ${GOAL.height.toFixed(2)}, position.y);
          // traves: dobram a partir da base; travessão: barriga no meio
          float mode = pow(hy, 1.6) * (1.0 - bar) + bar * (0.35 + 0.65 * cos(clamp(position.z / ${GOAL.halfWidth.toFixed(2)}, -1.0, 1.0) * 1.5708));
          float near = exp(-abs(position.z - S.z) * 0.35);
          float w = sin(dt * 58.0) * 0.6 + sin(dt * 31.0 + 1.3) * 0.4;
          transformed.x += env * mode * near * w * 0.045 * sign(position.x);
          transformed.y += env * bar * mode * w * 0.02;
        }
      }`);
  };
  postMat.onBeforeCompile = shakeGLSL;
  const postMesh = new THREE.Mesh(mergeSimple(posts), postMat);
  posts.forEach((g) => g.dispose());
  postMesh.castShadow = shadows; postMesh.receiveShadow = true;
  postMesh.name = 'traves';
  group.add(postMesh);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xc4c8ce, roughness: 0.4, metalness: 0.55 });
  frameMat.onBeforeCompile = shakeGLSL;
  const frameMesh = new THREE.Mesh(mergeSimple(frame.concat(hookGeos)), frameMat);
  frame.forEach((g) => g.dispose()); hookGeos.forEach((g) => g.dispose());
  frameMesh.castShadow = shadows;
  frameMesh.name = 'armacao';
  group.add(frameMesh);

  // ---- rede: geometria única para os dois gols; cada pano simula numa fatia do buffer
  const N = L.nodes.length;
  const posArr = new Float32Array(N * 3), uvArr = new Float32Array(N * 2), freeArr = new Float32Array(N);
  L.nodes.forEach((nd, i) => {
    posArr[i * 3] = nd.x; posArr[i * 3 + 1] = nd.y; posArr[i * 3 + 2] = nd.z;
    uvArr[i * 2] = nd.u; uvArr[i * 2 + 1] = nd.v;
    freeArr[i] = nd.pin ? 0 : Math.max(0.15, nd.free);
  });
  const cloths = ranges.map((rg, gi) => {
    const [s0, s1] = springsBy[gi];
    const sp = L.springs.slice(s0, s1).map(([a, b, l, k]) => [a - rg.first, b - rg.first, l, k]);
    const c = new NetCloth(gi === 0 ? -1 : 1, posArr.subarray(rg.first * 3, (rg.first + rg.count) * 3), L.nodes.slice(rg.first, rg.first + rg.count), sp, low ? 3 : 4);
    c.first = rg.first;
    c.settle();
    return c;
  });

  const ng = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(posArr, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  ng.setAttribute('position', posAttr);
  ng.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  ng.setAttribute('aFree', new THREE.BufferAttribute(freeArr, 1));
  ng.setIndex(L.tris);
  ng.computeVertexNormals();
  const nrmAttr = ng.attributes.normal;
  nrmAttr.setUsage(THREE.DynamicDrawUsage);
  // normais só da fatia do gol que se mexeu (triângulos em índices locais)
  cloths.forEach((c, gi2) => {
    const lo = c.first, hi = c.first + c.n, tri = [];
    for (let i = 0; i < L.tris.length; i += 3) {
      const a = L.tris[i];
      if (a >= lo && a < hi) tri.push(a - lo, L.tris[i + 1] - lo, L.tris[i + 2] - lo);
    }
    c.tri = new Uint16Array(tri);
    c.nrm = nrmAttr.array.subarray(lo * 3, hi * 3);
  });
  ng.boundingSphere = new THREE.Sphere(new THREE.Vector3(), PITCH.halfL + 6);
  const netTex = netTexture();
  netTex.anisotropy = anisotropy;
  const netMat = new THREE.MeshStandardMaterial({
    map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9, metalness: 0,
    color: 0xf6f6f4, emissive: 0x2a2c30,
  });
  // uma passada só (a passada BackSide separada inverteria a normal no vértice)
  netMat.forceSinglePass = true;
  netMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aFree;
uniform float uTime;
uniform vec2 uWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
// balanço leve do vento (custo zero de CPU com a rede parada)
float wAmp = length( uWind );
float sway = ( sin( position.z * 1.9 + uTime * 1.7 + position.y * 1.3 ) + 0.45 * sin( position.z * 4.3 - uTime * 2.9 + position.x ) ) * 0.009 * wAmp;
transformed += normalize( objectNormal + vec3( 1e-4 ) ) * sway * aFree;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
// cordas finas são iluminadas quase por igual de todos os lados: a normal (virada
// para a câmera) é puxada para cima, assim o teto visto de baixo não fica escuro
normal = normalize( normal + normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) * 1.15 );`)
      .replace('#include <map_fragment>', `#include <map_fragment>
// de longe a malha vira um véu muito ralo: reforça o alfa quando a textura minifica
float mipK = clamp( ( length( fwidth( vMapUv ) ) - 0.02 ) * 18.0, 0.0, 1.0 );
diffuseColor.a = min( 1.0, diffuseColor.a * ( 1.0 + 1.3 * mipK ) );`);
  };
  const netMesh = new THREE.Mesh(ng, netMat);
  netMesh.name = 'redes';
  netMesh.renderOrder = 3;
  group.add(netMesh);

  // ------------------------------------------------------------------ interação bola ↔ rede
  const gi = (s) => (s < 0 ? 0 : 1);
  const backLen = Math.hypot(GOAL.depth - GOAL.topDepth, GOAL.height);
  const BN = [GOAL.height / backLen, (GOAL.depth - GOAL.topDepth) / backLen]; // normal do fundo (X, y)
  const backAt = (y) => GOAL.depth + (GOAL.topDepth - GOAL.depth) * Math.min(1, Math.max(0, y / GOAL.height));
  const pv = { x: 0, y: 0, z: 0, set: false };
  const offset = { x: 0, y: 0, z: 0 };
  let lastTime = 0;

  // "complacência" do ponto: perto das barras a rede quase não cede
  function compliance(X, y, z, surf) {
    let d;
    const dz = hw - Math.abs(z);
    if (surf === 'back') d = Math.min(y / BN[0], (GOAL.height - y) / BN[0], dz);
    else if (surf === 'roof') d = Math.min(X, GOAL.topDepth - X, dz) * 1.4;
    else d = Math.min(X, y, GOAL.height - y, backAt(y) - X);
    return THREE.MathUtils.clamp(0.35 + d / 1.1, 0.4, 1);
  }

  // dispara a bola virtual: n = direção em que a rede é empurrada
  function launch(c, pt, n, speed, comp, follow, time) {
    const px = c.px;
    px.on = true; px.t = 0; px.t0 = time; px.q = 0; px.follow = follow;
    px.nx = n[0]; px.ny = n[1]; px.nz = n[2];
    px.qd = Math.min(32, speed) * comp;
    px.qmax = 1.05 * comp;
    px.ax = pt.x; px.ay = pt.y; px.az = pt.z;
    px.cx = px.pcx = pt.x; px.cy = px.pcy = pt.y; px.cz = px.pcz = pt.z;
    c.wake();
  }

  // superfície mais próxima de um ponto (para impactos sem velocidade conhecida)
  function nearestSurface(s, p) {
    const X = s * p.x - PITCH.halfL, y = p.y, z = p.z;
    const inside = X > 0 && Math.abs(z) < GOAL.halfWidth && y < GOAL.height && X < backAt(y);
    const c = [
      { surf: 'back', d: Math.abs(backAt(y) - X) * BN[0], n: [s * BN[0], BN[1], 0] },
      { surf: 'roof', d: Math.abs(GOAL.height - y), n: [0, 1, 0] },
      { surf: 'side', d: Math.abs(GOAL.halfWidth - Math.abs(z)), n: [0, 0, Math.sign(z) || 1] },
    ].sort((a, b) => a.d - b.d)[0];
    if (!inside) c.n = c.n.map((v) => -v);
    return { ...c, X, inside };
  }

  // O evento 'net' costuma chegar ANTES do update() do mesmo quadro: guarda como
  // pendente; o update() só o usa se não detectar o choque pela velocidade da bola.
  function impact(goalSign, point, strength, time) {
    const c = cloths[gi(goalSign)];
    time = time ?? lastTime;
    if (c.px.on && Math.abs(time - c.px.t0) < 0.35) return;   // update() já tratou
    c.pending = { x: point.x, y: point.y, z: point.z, strength: THREE.MathUtils.clamp(strength, 0, 1), time };
  }
  function applyPending(c, time) {
    const pd = c.pending;
    c.pending = null;
    if (!pd || (c.px.on && Math.abs(time - c.px.t0) < 0.35)) return;
    const ns = nearestSurface(c.s, pd);
    const comp = compliance(ns.X, pd.y, pd.z, ns.surf);
    launch(c, pd, ns.n, 5 + 22 * pd.strength, comp, false, pd.time);
  }

  // detecta o choque da bola com a rede pela mudança de velocidade entre quadros
  function detect(c, bp, bv, time) {
    const s = c.s;
    const X = s * bp.x - PITCH.halfL, y = bp.y, z = bp.z, az = Math.abs(z);
    const cand = [];
    const inside = X > -0.02 && az < GOAL.halfWidth + 0.01 && y < GOAL.height + 0.01 && X < backAt(y) + 0.02;
    const reach = R + 0.09;
    if (inside) {
      cand.push({ surf: 'back', gap: (backAt(y) - X) * BN[0], n: [s * BN[0], BN[1], 0] });
      cand.push({ surf: 'roof', gap: GOAL.height - y, n: [0, 1, 0] });
      cand.push({ surf: 'side', gap: GOAL.halfWidth - az, n: [0, 0, Math.sign(z) || 1] });
    } else {
      // por fora: rede lateral e teto
      if (X > 0 && X < backAt(y) && y < GOAL.height && az >= GOAL.halfWidth) cand.push({ surf: 'side', gap: az - hw, n: [0, 0, -Math.sign(z)] });
      if (X > 0 && X < GOAL.topDepth && az < GOAL.halfWidth && y >= GOAL.height) cand.push({ surf: 'roof', gap: y - Y_TOP, n: [0, -1, 0] });
      if (X > backAt(y) - 0.02 && az < GOAL.halfWidth && y < GOAL.height) cand.push({ surf: 'back', gap: (X - backAt(y)) * BN[0], n: [-s * BN[0], -BN[1], 0] });
    }
    let best = null, bestV = 2.5;
    for (const k of cand) {
      if (k.gap > reach) continue;
      const vin = pv.x * k.n[0] + pv.y * k.n[1] + pv.z * k.n[2];
      const vnow = bv.x * k.n[0] + bv.y * k.n[1] + bv.z * k.n[2];
      if (vin > bestV && vnow < vin * 0.55) { best = k; bestV = vin; }
    }
    if (!best) return;
    if (c.px.on && time - c.px.t0 < 0.3) return;
    // ponto de contato: onde a bola encostou (centro da bola)
    const comp = compliance(Math.max(0, X), y, z, best.surf);
    launch(c, bp, best.n, bestV * 0.92, comp, true, time);
  }

  const OM = 15, ZETA = 0.5;   // frequência (rad/s) e amortecimento da "mola" rede+bola
  let calledThisFrame = false, fbT = null;
  function update(dt, time, bp, bv) {
    calledThisFrame = true;
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    lastTime = time ?? lastTime + dt;
    offset.x = offset.y = offset.z = 0;
    let dirty = false;
    for (const c of cloths) {
      const s = c.s, px = c.px;
      let near = false;
      if (bp) {
        const X = s * bp.x - PITCH.halfL;
        near = X > -0.8 && X < GOAL.depth + 0.8 && Math.abs(bp.z) < hw + 0.8 && bp.y < Y_TOP + 0.8;
        if (near && bv && pv.set) detect(c, bp, bv, lastTime);
      }
      if (c.pending) applyPending(c, lastTime);
      // bola real para contato suave
      c.pbx = c.bx; c.pby = c.by; c.pbz = c.bz;
      if (near) {
        c.bx = bp.x; c.by = bp.y; c.bz = bp.z;
        if (c.pby < -50) { c.pbx = c.bx; c.pby = c.by; c.pbz = c.bz; }
        if (!c.awake) {
          // parada: só acorda se a bola estiver encostando na rede
          const p = c.pos, rb = R + 0.015;
          for (let i = 0; i < c.n; i++) {
            if (c.inv[i] === 0) continue;
            const dx = p[i * 3] - bp.x, dy = p[i * 3 + 1] - bp.y, dz = p[i * 3 + 2] - bp.z;
            if (dx * dx + dy * dy + dz * dz < rb * rb) { c.wake(); break; }
          }
        } else {
          const mv = Math.abs(c.bx - c.pbx) + Math.abs(c.by - c.pby) + Math.abs(c.bz - c.pbz);
          if (mv > 0.002) c.quiet = 0;
        }
      } else { c.by = c.pby = -100; }

      // bola virtual: oscilador amortecido na direção n
      if (px.on) {
        px.pcx = px.cx; px.pcy = px.cy; px.pcz = px.cz;
        const sub = Math.max(1, Math.ceil(dt / H));
        const h = dt / sub;
        for (let k = 0; k < sub; k++) {
          const stiff = OM * OM * (1 + 1.2 * Math.max(0, px.q / px.qmax) ** 2);
          const acc = -stiff * px.q - 2 * ZETA * OM * px.qd;
          px.qd += acc * h; px.q += px.qd * h;
          if (px.q > px.qmax) { px.q = px.qmax; px.qd = Math.min(px.qd, 0); }
        }
        px.t += dt;
        // âncora: ponto do impacto; a bola virtual acompanha a queda/deslize da bola real
        // (componente tangencial), mas não o recuo dela ao longo de n
        let ax = px.ax, ay = px.ay, az = px.az;
        if (px.follow && near) {
          const dx = bp.x - px.ax, dy = bp.y - px.ay, dz = bp.z - px.az;
          const dn = dx * px.nx + dy * px.ny + dz * px.nz;
          ax += dx - dn * px.nx; ay += dy - dn * px.ny; az += dz - dn * px.nz;
        }
        const q = Math.max(0, px.q);
        px.cx = ax + px.nx * q; px.cy = ay + px.ny * q; px.cz = az + px.nz * q;
        if (px.t < 0.02) { px.pcx = px.ax; px.pcy = px.ay; px.pcz = px.az; }
        if (px.follow && near) {
          // exibição: a bola afunda com a rede e volta suavemente para a posição física
          const w = THREE.MathUtils.smoothstep(q, 0, 0.3 * px.qmax);
          offset.x += (px.cx - bp.x) * w; offset.y += (px.cy - bp.y) * w; offset.z += (px.cz - bp.z) * w;
          if (offset.y + bp.y < R) offset.y = R - bp.y;
        }
        if (px.t > 1.4 || (px.t > 0.3 && px.q <= 0 && Math.abs(px.qd) < 0.3)) px.on = false;
        c.quiet = 0;
      }

      if (!c.awake) continue;
      c.acc += dt;
      let n = 0;
      const nsub = Math.min(4, Math.floor(c.acc / H));
      while (c.acc >= H && n < 4) {
        c.acc -= H; n++;
        c.step(DAMP, true, n / nsub);
      }
      if (n >= 4) c.acc = 0;
      c.awakeT += dt;
      if (c.maxMove < 0.0011) c.quiet += dt; else c.quiet = Math.max(0, c.quiet - dt * 0.5);
      if (!px.on && (c.quiet > 0.35 || c.awakeT > 6)) { c.awake = false; c.acc = 0; }
      c.dirty = true; dirty = true;
    }
    if (bv) { pv.x = bv.x; pv.y = bv.y; pv.z = bv.z; pv.set = true; }
    if (dirty) {
      posAttr.needsUpdate = true;
      for (const c of cloths) if (c.dirty) { c.normals(); c.dirty = false; }
      nrmAttr.needsUpdate = true;
    }
    return offset;
  }

  // ---- bandeirinhas de escanteio
  const poles = [];
  const flag = { pos: [], uv: [], pole: [], idx: [] };
  const NU = 10, NV = 6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * PITCH.halfL, z = sz * PITCH.halfW;
    const g = tube(V(x, 0, z), V(x, 1.55, z), 0.018, 8);
    const col = new Float32Array(g.attributes.position.count * 3).fill(0.85);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    poles.push(g);
    const base = flag.pos.length / 3;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      flag.pos.push(i / NU, j / NV, 0);
      flag.uv.push(i / NU, j / NV);
      flag.pole.push(x, 1.55, z);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 2, d = a + NU + 1;
      flag.idx.push(a, b, c, a, c, d);
    }
  }
  const poleMesh = new THREE.Mesh(mergeSimple(poles), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
  poles.forEach((g) => g.dispose());
  poleMesh.castShadow = shadows;
  poleMesh.name = 'mastros';
  group.add(poleMesh);

  const fc = document.createElement('canvas');
  fc.width = 64; fc.height = 64;
  const fg = fc.getContext('2d');
  fg.fillStyle = '#ffd21a'; fg.fillRect(0, 0, 64, 64);
  fg.fillStyle = '#e8261b'; fg.beginPath(); fg.moveTo(0, 64); fg.lineTo(64, 64); fg.lineTo(64, 0); fg.fill();
  const ftex = new THREE.CanvasTexture(fc);
  ftex.colorSpace = THREE.SRGBColorSpace;
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.Float32BufferAttribute(flag.pos, 3));
  fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(flag.uv, 2));
  fgeo.setAttribute('aPole', new THREE.Float32BufferAttribute(flag.pole, 3));
  fgeo.setIndex(flag.idx);
  fgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80);
  const fmat = new THREE.MeshStandardMaterial({ map: ftex, side: THREE.DoubleSide, roughness: 0.8 });
  fmat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPole;\nuniform float uTime;\nuniform vec2 uWind;')
      .replace('#include <beginnormal_vertex>', `
float spd = length( uWind );
vec2 wd = spd > 0.05 ? uWind / spd : vec2( 0.7, 0.7 );
float lift = clamp( spd / 6.0, 0.15, 1.0 );
vec3 dir = normalize( vec3( wd.x, 0.0, wd.y ) * lift + vec3( 0.0, -1.0, 0.0 ) * ( 1.0 - lift ) * 0.8 );
vec3 side = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) + 1e-4 );
float u = position.x, v = position.y;
float ph = uTime * ( 5.0 + spd * 1.6 ) - u * 6.0 + aPole.x * 0.37 + aPole.z * 0.21;
float amp = u * ( 0.03 + 0.012 * spd );
vec3 objectNormal = normalize( side + dir * cos( ph ) * u * 0.8 );`)
      .replace('#include <begin_vertex>', `
vec3 transformed = aPole - vec3( 0.0, ( 1.0 - v ) * 0.36, 0.0 ) + dir * u * 0.46 + side * sin( ph ) * amp
  + vec3( 0.0, sin( ph * 0.7 ) * 0.015 * u, 0.0 );`);
  };
  const flagMesh = new THREE.Mesh(fgeo, fmat);
  flagMesh.frustumCulled = false;
  flagMesh.castShadow = false;
  flagMesh.name = 'bandeirinhas';
  group.add(flagMesh);

  // Compatibilidade: se ninguém chamar update() no quadro, a rede ainda simula
  // (sem colisão com a bola, só os impactos de impact()) usando o relógio U.uTime.
  netMesh.onBeforeRender = () => {
    const now = U.uTime.value;
    if (calledThisFrame) { calledThisFrame = false; fbT = now; return; }
    if (fbT === null || now < fbT) fbT = now;
    const dt = now - fbT;
    if (dt > 0) { fbT = now; update(dt, now, null, null); calledThisFrame = false; }
  };

  group.userData.impact = impact;
  // bola na trave/travessão: o gol treme e a rede sacode junto
  group.userData.shake = (goalSign, point, strength, time) => {
    const u = goalSign < 0 ? uShakeW : uShakeE;
    u.value.set(time, Math.min(1.2, 0.35 + strength * 1.2), point ? point.z : 0, point ? point.y : 1);
    if (point) impact(goalSign, { x: goalSign * (PITCH.halfL + 0.3), y: Math.min(2.3, point.y), z: point.z * 0.9 }, strength * 0.45, time);
  };
  group.userData.update = update;
  group.userData.netInfo = () => ({
    nodes: N, springs: L.springs.length, awake: cloths.map((c) => c.awake), steps: cloths.map((c) => c.steps),
    proxy: cloths.map((c) => (c.px.on ? +c.px.q.toFixed(3) : null)),
  });
  return group;
}
