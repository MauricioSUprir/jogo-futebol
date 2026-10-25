// Adereços dos vilões com arma (desenhos próprios, geometria simples): presos aos ossos do modelo (humano.js), então
// acompanham a pose. Espaço do osso em repouso = espaço do modelo: x = frente, y = cima, z = direita do personagem;
// o braço em repouso aponta para o lado (z), então a arma vai ao longo de +z na mão direita e aponta para onde o braço
// aponta. Devolve {ponta} — o Object3D na boca da arma (de onde sai o raio de gelo, o fogo, o raio do bastão).
import * as THREE from 'three';

const mat = (cor, emissivo = 0, metal = 0.6, rug = 0.35) => new THREE.MeshStandardMaterial({ color: cor, emissive: emissivo, emissiveIntensity: emissivo ? 1.6 : 0, metalness: metal, roughness: rug });

export function colocarAderecos(id, modelo) {
  const osso = (n) => modelo.ossos.find((o) => o.name === n);
  const mao = osso('maoD'), cabeca = osso('cabeca'), peito = osso('peito');
  const ponta = new THREE.Object3D();
  const mats = [];
  const peca = (geo, m, pai, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; pai.add(o); mats.push(m); return o; };
  if (id === 'frio') {
    // óculos de proteção de lente laranja e a arma de gelo (corpo grafite, anéis e boca azul brilhante)
    const faixa = mat(0x1a1d22, 0, 0.2, 0.6), lente = mat(0xff9a2a, 0x7a3a00, 0.1, 0.15);
    peca(new THREE.TorusGeometry(0.105, 0.012, 6, 24), faixa, cabeca, 0.0, 0.035, 0, Math.PI / 2, 0, 0).scale.set(1, 1.15, 1);
    for (const lado of [-1, 1]) peca(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 16), lente, cabeca, 0.092, 0.04, lado * 0.036, 0, 0, Math.PI / 2);
    const corpo = mat(0x2a2f38, 0, 0.8, 0.3), gelo = mat(0x9fe6ff, 0x3fb8ff, 0.1, 0.1);
    peca(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 12), corpo, mao, 0.02, -0.03, 0.2, Math.PI / 2);
    peca(new THREE.BoxGeometry(0.05, 0.1, 0.06), corpo, mao, 0.02, -0.08, 0.1);
    for (const z of [0.16, 0.24, 0.32]) peca(new THREE.TorusGeometry(0.046, 0.01, 6, 16), gelo, mao, 0.02, -0.03, z);
    peca(new THREE.SphereGeometry(0.035, 12, 8), gelo, mao, 0.02, -0.03, 0.38);
    ponta.position.set(0.02, -0.03, 0.42); mao.add(ponta);
  } else if (id === 'onda') {
    // lança-chamas (cano de cobre, boca laranja) e o tanque nas costas
    const cobre = mat(0x8a4a22, 0, 0.85, 0.35), ferro = mat(0x2b2422, 0, 0.7, 0.45), brasa = mat(0xff8a3d, 0xff4a00, 0.1, 0.3);
    peca(new THREE.CylinderGeometry(0.03, 0.042, 0.42, 12), cobre, mao, 0.02, -0.03, 0.24, Math.PI / 2);
    peca(new THREE.BoxGeometry(0.06, 0.12, 0.08), ferro, mao, 0.02, -0.09, 0.1);
    peca(new THREE.TorusGeometry(0.045, 0.012, 6, 16), brasa, mao, 0.02, -0.03, 0.45);
    for (const z of [-0.09, 0.09]) peca(new THREE.CylinderGeometry(0.075, 0.075, 0.46, 14), ferro, peito, -0.2, -0.05, z);
    peca(new THREE.SphereGeometry(0.03, 10, 8), brasa, peito, -0.2, 0.2, 0.09);
    ponta.position.set(0.02, -0.03, 0.48); mao.add(ponta);
  } else if (id === 'mago') {
    // bastão escuro com uma pedra verde que brilha na ponta
    const pau = mat(0x2a1f2e, 0, 0.3, 0.5), pedra = mat(0x7dffa8, 0x22ff77, 0.2, 0.15);
    peca(new THREE.CylinderGeometry(0.018, 0.022, 0.9, 10), pau, mao, 0.02, -0.03, 0.18, Math.PI / 2);
    peca(new THREE.OctahedronGeometry(0.06, 0), pedra, mao, 0.02, -0.03, 0.66);
    ponta.position.set(0.02, -0.03, 0.7); mao.add(ponta);
  }
  return { ponta, dispose() { mats.forEach((m) => m.dispose()); } };
}
