// Estádio: detalhes à beira do campo — bancos de reservas com cadeiras, túnel dos
// jogadores com cobertura telescópica e mesa do 4º árbitro (os fotógrafos ficam em
// stadium-photogs.js, numa malha própria animada).
// Tudo vai para os acumuladores de estrutura (opaco) e vidro (translúcido) do estádio.
import * as THREE from 'three';
import { PITCH } from './config.js';
import { BOWL } from './stadium-bowl.js';

const M = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);

// bancos de reservas: estrutura, 2 fileiras de cadeiras tipo concha e cobertura curva
function dugouts(st, glass, ctx) {
  const { homeColor, awayColor } = ctx;
  const zBack = -(BOWL.B + 2.7), zFront = -(BOWL.B + 0.35), depth = zFront - zBack;
  const dark = 0x1b1d22;
  for (const [sx, team] of [[-1, homeColor], [1, awayColor]]) {
    const cx = sx * 12, w = 10;
    const tc = new THREE.Color(team);
    // cadeiras escuras demais somem: clareia um pouco a cor do time
    const seatCol = tc.clone().lerp(new THREE.Color(0.5, 0.5, 0.52), tc.getHSL({}).l < 0.08 ? 0.12 : 0);
    st.box(w, 0.15, depth, dark, M(cx, 0.075, (zBack + zFront) / 2));
    st.box(w, 3.0, 0.15, 0x23262d, M(cx, 1.5, zBack));
    // faixa na cor do time no fundo do banco
    st.box(w - 0.4, 0.35, 0.02, team, M(cx, 2.35, zBack + 0.09));
    for (const e of [-1, 1]) st.box(0.12, 2.25, depth, 0x2a2d35, M(cx + e * w / 2, 1.125, (zBack + zFront) / 2));
    for (let r = 0; r < 2; r++) {
      const zr = zBack + 0.55 + r * 0.95, yr = 0.15 + r * 0.25;
      st.box(w - 0.5, 0.2 + yr, 0.7, 0x15171b, M(cx, (0.2 + yr) / 2, zr));
      for (let k = 0; k < 14; k++) {
        const x = cx - w / 2 + 0.6 + k * ((w - 1.2) / 13);
        st.box(0.52, 0.1, 0.5, seatCol, M(x, 0.46 + yr, zr + 0.05));
        // encosto alto acolchoado (levemente inclinado)
        const m = new THREE.Matrix4().makeRotationX(-0.12).setPosition(x, 0.86 + yr, zr - 0.2);
        st.box(0.5, 0.72, 0.1, seatCol, m);
        st.box(0.3, 0.12, 0.02, 0xdddddd, new THREE.Matrix4().makeRotationX(-0.12).setPosition(x, 1.1 + yr, zr - 0.145));
      }
    }
    // cobertura curva de acrílico com armação
    const shell = new THREE.CylinderGeometry(depth, depth, w, 20, 1, true, 0, Math.PI / 2);
    shell.rotateZ(Math.PI / 2);
    shell.scale(1, 0.3, 1);
    shell.translate(cx, 2.25, zBack);
    glass.addGeo(shell, new THREE.Color(0.75, 0.85, 0.95), null, 0.28);
    for (const e of [-1, 0, 1]) {
      const x = cx + e * (w / 2 - 0.05);
      let prev = null;
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI / 2;
        const p = new THREE.Vector3(x, 2.25 + Math.sin(a) * depth * 0.3, zBack + Math.cos(a) * depth);
        if (prev) st.beam(prev, p, 0.07, 0.07, 0x9a9ea6);
        prev = p;
      }
    }
  }
  // mesa do 4º árbitro (com placa eletrônica de substituição)
  st.box(2.0, 0.8, 0.8, 0x2b2f38, M(4.6, 0.4, -(BOWL.B + 1.2)));
  st.box(0.6, 0.4, 0.06, 0x111111, M(4.2, 1.0, -(BOWL.B + 1.0)));
}

// túnel dos jogadores: cobertura telescópica que avança do anel inferior até o gramado
function tunnel(st, glass, ctx) {
  const z0 = -(BOWL.B + 3.0), z1 = -(BOWL.B - 1.6);
  const segs = 3, len = (z1 - z0) / segs;
  const accent = new THREE.Color(ctx.accent);
  // piso de borracha e muretas
  st.box(4.2, 0.04, z1 - z0 + 0.6, 0x101412, M(0, 0.02, (z0 + z1) / 2));
  for (let i = 0; i < segs; i++) {
    const r = 1.95 - i * 0.1, h = 2.75 - i * 0.1;
    const za = z0 + i * len - 0.05, zb = za + len + 0.1;
    const shell = new THREE.CylinderGeometry(r, r, zb - za, 24, 1, true, -Math.PI / 2, Math.PI);
    shell.rotateX(-Math.PI / 2);
    shell.scale(1, (h - 0.9) / r, 1);
    shell.translate(0, 0.9, (za + zb) / 2);
    glass.addGeo(shell, new THREE.Color(0.04, 0.05, 0.05), null, 0.72);
    // costados retos (até a altura onde começa o arco)
    for (const e of [-1, 1]) {
      st.box(0.06, 0.9, zb - za, 0x16191c, M(e * r, 0.45, (za + zb) / 2));
      st.box(0.07, 0.12, zb - za, accent, M(e * (r + 0.01), 0.82, (za + zb) / 2));
    }
    // arcos de aço nas pontas de cada gomo
    for (const z of [za + 0.05, zb - 0.05]) {
      let prev = null;
      for (let k = 0; k <= 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI;
        const p = new THREE.Vector3(Math.sin(a) * (r + 0.03), 0.9 + Math.cos(a) * (h - 0.9 + 0.03), z);
        if (prev) st.beam(prev, p, 0.08, 0.08, 0xc2c6cc);
        prev = p;
      }
      for (const e of [-1, 1]) st.beam(new THREE.Vector3(e * (r + 0.03), 0, z), new THREE.Vector3(e * (r + 0.03), 0.9, z), 0.08, 0.08, 0xc2c6cc);
    }
  }
  // moldura da boca do túnel na arquibancada
  st.box(4.6, 0.3, 0.3, 0x16191c, M(0, 2.9, z0 - 0.05));
  st.box(4.6, 0.08, 0.06, accent, M(0, 2.72, z0 + 0.12));
}

export function buildDetails(ctx, st, glass) {
  dugouts(st, glass, ctx);
  tunnel(st, glass, ctx);
}
