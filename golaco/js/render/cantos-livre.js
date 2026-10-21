// Os cantos do lado de cá no Modo Livre (revisão de 16/10: Atrás e Jogador olham pelo comprimento e deixavam à vista, o
// jogo todo, o vão entre o fundo e a arquibancada de cá — céu, o chão verde de fora e o mastro do refletor —, que a TV
// nunca enquadra). O degrau de concreto com cadeiras vazias do pré-jogo (estadio-forma.js FORA.canto, a mesma forma do
// render/estadio-fora.js, que fica só no pré-jogo) com o MATERIAL da arquibancada dos fundos do jogo (render/campo.js
// 'arquibancada-fundos': a mesma textura, as cores do mandante com ?tm e a noite pelo campo.definirHora). Carregado só no
// Livre (livre-pagina.js, import dinâmico): sem o Livre nada disto entra no download nem na cena. +1 chamada de desenho,
// 152 triângulos. Só desenho: a simulação não vê nada disto (hash igual).
import * as THREE from 'three';
import { FORA } from '../estadio-forma.js';
import { ARQUIBANCADA as A } from './torcida-dados.js';

// as paredes de trás dos cantos (a faixa de cima da textura, como as das arquibancadas do jogo — render/campo.js): da beira
// do degrau até a altura da parede do fundo (22 m, yTopoFundo + 5) e da de cá (25 m, yTopoLado + 5); sem elas o céu e o
// mastro do refletor apareciam por cima do degrau, entre as duas arquibancadas
const V_PAREDE = 0.975, PAREDE = { fundo: A.yTopoFundo + 5, lado: A.yTopoLado + 5 };

/**
 * A malha dos dois cantos (pura): {pos, uv, cor, idx} — o degrau do criarCantos do estadio-fora.js e as paredes de trás
 * (a de fora, em |x| = 88,5, e a do fundo, em z = 74,5).
 */
export function malhaCantos(N = 6) {
  const K = FORA.canto, vMax = A.vMax;
  const pos = [], uv = [], cor = [], idx = [];
  const [y00, y10, y01, y11] = K.y;
  for (const s of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / N;
      const x = s * (K.x[0] + (K.x[1] - K.x[0]) * u), z = K.z[0] + (K.z[1] - K.z[0]) * v;
      const y = (y00 * (1 - u) + y10 * u) * (1 - v) + (y01 * (1 - u) + y11 * u) * v;
      pos.push(x, y, z); cor.push(1, 1, 1);
      uv.push(0.04 + 0.2 * (v - u + 1) / 2, vMax * Math.max(u, v));
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = base + j * (N + 1) + i, b = a + N + 1;
      if (s > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    // paredes: (p0, p1) a beira de baixo, (p2, p3) a de cima
    const parede = (p0, p1, p2, p3) => {
      const b0 = pos.length / 3;
      pos.push(...p0, ...p1, ...p2, ...p3); cor.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
      uv.push(0.04, V_PAREDE, 0.24, V_PAREDE, 0.24, 1, 0.04, 1);
      idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    };
    const xf = s * K.x[1], xi = s * K.x[0], z0 = K.z[0], z1 = K.z[1];
    parede([xf, y10, z0], [xf, y11, z1], [xf, PAREDE.lado, z1], [xf, PAREDE.fundo, z0]);
    parede([xi, y01, z1], [xf, y11, z1], [xf, PAREDE.lado, z1], [xi, PAREDE.lado, z1]);
  }
  return { pos, uv, cor, idx };
}

/** Põe os cantos na cena com o material dado (o dos fundos). {mesh, visivel(v), material(m), dispose()}. */
export function criarCantosLivre(cena, material) {
  const M = malhaCantos();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(M.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(M.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(M.cor, 3));
  g.setIndex(M.idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'livre-cantos';
  mesh.castShadow = false; mesh.receiveShadow = false;
  cena.add(mesh);
  return {
    mesh,
    visivel(v) { mesh.visible = !!v; },
    material(m) { if (m && m !== mesh.material) mesh.material = m; },
    dispose() { cena.remove(mesh); g.dispose(); },
  };
}
