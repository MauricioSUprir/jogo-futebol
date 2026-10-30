// O DETALHE DE PERTO da cidade (dono, 30/10: "melhore MUITO a qualidade das texturas da cidade"): uma textura pequena de
// grão (as pedrinhas do asfalto, o poro do concreto, a folha da grama) repetida a cada 1–2,5 m pelo mundo e multiplicada
// em cima da textura de sempre, no shader do próprio material (sem chamada a mais). De perto o chão e as paredes ganham
// textura de verdade; de longe o mipmap leva o grão para o cinza médio e nada muda. As coordenadas saem da posição no
// mundo (o chão pelo x/z, as paredes pelo plano delas), então o grão não estica em prédio alto nem em quarteirão grande.
import * as THREE from 'three';

let sem = 91;
const rnd = () => { sem = (sem * 1664525 + 1013904223) >>> 0; return sem / 4294967296; };
const cache = new Map();

// cada pintor desenha em cinza em volta de 128 (a média fica em 0,5: multiplicado por 2 dá 1)
const PINTORES = {
  asfalto(g, S) {
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S * S / 40; i++) { const v = rnd() < 0.5 ? 70 + rnd() * 40 : 150 + rnd() * 70, r = 0.6 + rnd() * rnd() * 3.2; g.fillStyle = `rgba(${v},${v},${v},${0.5 + rnd() * 0.4})`; repete(g, S, rnd() * S, rnd() * S, r); }
    for (let i = 0; i < S * S / 6; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${0.06 * rnd()})`; g.fillRect(rnd() * S, rnd() * S, 1, 1); }
  },
  concreto(g, S) {
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) { const x = rnd() * S, y = rnd() * S, r = S * (0.05 + rnd() * 0.15), v = rnd() < 0.5 ? 0 : 255; for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.08)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); } }
    for (let i = 0; i < S * S / 14; i++) { const v = rnd() < 0.55 ? 60 + rnd() * 50 : 160 + rnd() * 60; g.fillStyle = `rgba(${v},${v},${v},${0.18 + rnd() * 0.3})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(40,40,40,0.5)'; repete(g, S, rnd() * S, rnd() * S, 0.8 + rnd() * 1.6); }      // os poros
  },
  grama(g, S) {
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S * S / 10; i++) { const v = rnd() < 0.5 ? 70 + rnd() * 40 : 150 + rnd() * 60, x = rnd() * S, y = rnd() * S, l = 3 + rnd() * 7; g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - l); g.stroke(); }
  },
};
function repete(g, S, x, y, r) { for (const dx of [0, -S, S]) for (const dy of [0, -S, S]) { const cx = x + dx, cy = y + dy; if (cx < -r || cx > S + r || cy < -r || cy > S + r) continue; g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill(); } }

/** A textura de grão `tipo` ('asfalto' | 'concreto' | 'grama'), linear (é um fator, não uma cor), repetindo. */
export function texturaDetalhe(tipo, aniso = 4, S = 512) {
  const k = `${tipo}-${S}`; if (cache.has(k)) return cache.get(k);
  sem = 91 + tipo.length * 17;
  const c = document.createElement('canvas'); c.width = c.height = S; PINTORES[tipo](c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.colorSpace = THREE.NoColorSpace;
  cache.set(k, t); return t;
}

/**
 * Põe o grão no material (encadeia com outro onBeforeCompile que ele já tenha, como as salas das janelas).
 * escala: metros por repetição do grão; forca: 0..1 (quanto o grão pesa).
 */
export function comDetalhe(material, tex, { escala = 1.5, forca = 0.5 } = {}) {
  const antes = material.onBeforeCompile, chaveAntes = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (sh, ren) => {
    antes?.call(material, sh, ren);
    sh.uniforms.tDetalhe = { value: tex }; sh.uniforms.detEscala = { value: 1 / escala }; sh.uniforms.detForca = { value: forca };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDetUv;\nuniform float detEscala;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 dwp = modelMatrix * vec4(transformed, 1.0); vec3 dn = normalize(mat3(modelMatrix) * objectNormal);
          vDetUv = (abs(dn.y) > 0.6 ? dwp.xz : (abs(dn.x) > abs(dn.z) ? dwp.zy : dwp.xy)) * detEscala; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDetUv;\nuniform sampler2D tDetalhe;\nuniform float detForca;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= mix(1.0, texture2D(tDetalhe, vDetUv).r * 2.0, detForca);`);
  };
  material.customProgramCacheKey = () => `${chaveAntes ? chaveAntes() : ''}|det-${tex.uuid}-${escala}-${forca}`;
  material.needsUpdate = true;
  return material;
}
