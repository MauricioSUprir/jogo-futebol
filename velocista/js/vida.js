// A VIDA DO BARRY ALLEN (dono, 26/10: "a história tem que ter MUITA tensão"): o que aparece no mundo nas missões dele —
// o cavalete amarelo das pistas da perícia (com o anel no chão e o feixe), o gelo do Capitão Frio subindo em volta da Iris
// enquanto o cronômetro corre, a tempestade do Mago do Tempo em cima da casa dos West e os raios da noite do raio no
// laboratório. Só desenho e efeitos: quem conta as pistas e o tempo é o jogo (onde ficam: missoes.js e marcos.js).
import * as THREE from 'three';

export function criarVida(cena, { fx, mobile = false } = {}) {
  // ---------- a pista da perícia: o cavalete numerado, o anel que pulsa no chão e um feixe fino para achar de longe ----------
  const marca = new THREE.Group(); marca.visible = false; cena.add(marca);
  const amarelo = new THREE.MeshStandardMaterial({ color: 0xffc81e, roughness: 0.45, emissive: 0x4a3200 });
  const cavalete = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.26, 0.42, 3, 1).translate(0, 0.21, 0), amarelo);
  const brilho = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 40).rotateX(-Math.PI / 2).translate(0, 0.04, 0), brilho(new THREE.Color(2.2, 1.6, 0.25), 0.8));
  const feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 8, 1, true).translate(0, 4.5, 0), brilho(new THREE.Color(1.6, 1.2, 0.2), 0.3));
  marca.add(cavalete, anel, feixe);
  /** a próxima pista em (x, y, z); sem x, some */
  function pista(x, y, z, t) {
    marca.visible = x != null; if (x == null) return;
    marca.position.set(x, y, z); cavalete.rotation.y = t * 0.6;
    const p = 0.5 + 0.5 * Math.sin(t * 5); anel.scale.setScalar(1 + 0.18 * p); anel.material.opacity = 0.45 + 0.4 * p;
  }

  // ---------- o gelo em volta da Iris (cresce com o cronômetro: 0 = começou, 1 = acabou) ----------
  const NG = 11;
  const gelo = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 1, 5).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0xd2f0ff, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.6, emissive: 0x0c3a5a, emissiveIntensity: 0.9 }), NG);
  gelo.visible = false; gelo.frustumCulled = false; cena.add(gelo);
  const LASCAS = Array.from({ length: NG }, (_, k) => ({ a: (k / NG) * Math.PI * 2 + 0.35 * Math.sin(k * 7.1), r: 0.42 + 0.16 * (((k * 37) % 5) / 5), alt: 0.95 + 0.75 * (((k * 13) % 7) / 7), inc: 0.12 + 0.1 * ((k * 5) % 3) / 3 }));
  let escGelo = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(), pos = new THREE.Vector3(), esc = new THREE.Vector3();
  function poeGelo(x, y, z, f) {
    gelo.visible = f != null; if (f == null) return;
    const s = 0.18 + 0.82 * Math.min(1, Math.max(0, f)); escGelo = s;
    LASCAS.forEach((l, k) => {
      eixo.set(Math.sin(l.a), 0, -Math.cos(l.a)); q.setFromAxisAngle(eixo, l.inc);       // as lascas abrem para fora
      pos.set(x + Math.cos(l.a) * l.r, y, z + Math.sin(l.a) * l.r); esc.set(1 + s * 0.5, l.alt * s, 1 + s * 0.5);
      gelo.setMatrixAt(k, m4.compose(pos, q, esc));
    });
    gelo.instanceMatrix.needsUpdate = true;
  }
  function quebrarGelo(x, y, z) {
    gelo.visible = false;
    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28; fx.raio(x, y + 0.3 + Math.random() * 1.4, z, x + Math.cos(a) * 1.6, y + Math.random() * 1.8, z + Math.sin(a) * 1.6, { vida: 0.35, desvio: 0.5, r: 1.2, g: 2.0, b: 2.8 }); }
    fx.clarao(x, y + 1, z, 3.5, 0.4);
  }

  // ---------- a tempestade do Mago em cima da casa dos West: raios verdes caindo em volta, cada vez mais perto ----------
  let proxRaio = 0;
  function tempestade(dt, cx, cz, P, f = 0) {
    if (Math.hypot(P.x - cx, P.z - cz) > 700) return;                 // longe demais para ver
    proxRaio -= dt; if (proxRaio > 0) return;
    proxRaio = (0.25 + Math.random() * 0.7) * (1 - 0.5 * f);
    const a = Math.random() * 6.28, r = 8 + Math.random() * (34 - 22 * f), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    fx.raio(x + (Math.random() - 0.5) * 12, 75, z + (Math.random() - 0.5) * 12, x, 0.3, z, { vida: 0.32, desvio: 5, r: 1.3, g: 2.6, b: 1.5 });
    if (!mobile || Math.random() < 0.5) fx.raio(x, 30 + Math.random() * 20, z, x + (Math.random() - 0.5) * 16, 0.3, z + (Math.random() - 0.5) * 16, { vida: 0.22, desvio: 3, r: 1.1, g: 2.2, b: 1.3 });
    fx.clarao(x, 1.2, z, 7, 0.35);
  }

  // ---------- a noite do raio: faíscas nas bancadas do laboratório e o raio do Núcleo atravessando o Barry ----------
  function faiscas(P) {
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, d = 1.5 + Math.random() * 3; fx.raio(P.x + Math.cos(a) * d, P.y + 0.9, P.z + Math.sin(a) * d, P.x + Math.cos(a) * d + (Math.random() - 0.5), P.y + 0.9 + Math.random() * 1.4, P.z + Math.sin(a) * d + (Math.random() - 0.5), { vida: 0.25, desvio: 0.3, r: 1.4, g: 1.8, b: 2.6 }); }
  }
  function raioNoite(P, teto = 4.4) {
    for (let i = 0; i < 9; i++) fx.raio(P.x + (Math.random() - 0.5) * 3, P.y + teto, P.z + (Math.random() - 0.5) * 3, P.x + (Math.random() - 0.5) * 0.3, P.y + 0.4 + Math.random() * 1.2, P.z + (Math.random() - 0.5) * 0.3, { vida: 0.6, desvio: 0.8, r: 2.6, g: 2.4, b: 1.2 });
    fx.clarao(P.x, P.y + 1.2, P.z, 7, 0.7); fx.onda(P.x, P.y, P.z, 9, 0.7);
  }

  return { pista, poeGelo, quebrarGelo, tempestade, faiscas, raioNoite,
    /** (testes) o que está em cena: o marcador da pista e o gelo, com a altura da lasca mais alta */
    get estado() { return { pista: marca.visible, gelo: gelo.visible, alturaGelo: gelo.visible ? Math.max(...LASCAS.map((l) => l.alt)) * escGelo : 0 }; } };
}
