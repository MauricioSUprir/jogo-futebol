// Prints dos seis modelos de carro (js/carros3d.js) lado a lado, de dia e de noite (faróis, lanternas e giroflex acesos),
// no material do trânsito: para conferir a forma sem o resto da cidade.
// Uso: node velocista/tools/vista-carros.mjs <pasta-de-prints>
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), pasta = process.argv[2] || '/tmp/vista-carros';
fs.mkdirSync(pasta, { recursive: true });
const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
const html = `<!doctype html><html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"}}</script></head>
<body style="margin:0;background:#000"><script type="module">
import * as THREE from 'three';
import { geometriaCarro, luzesNoMaterial, TIPOS } from '../js/carros3d.js';
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1280, 720); r.toneMapping = THREE.ACESFilmicToneMapping; document.body.appendChild(r.domElement);
const cena = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1280 / 720, 0.1, 200);
const pm = new THREE.PMREMGenerator(r), ce = new THREE.Scene(); ce.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: 0xb8d4f0, side: THREE.BackSide }))); const faixa = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); faixa.position.set(0, 12, 0); ce.add(faixa); cena.environment = pm.fromScene(ce, 0.02).texture;
const sol = new THREE.DirectionalLight(0xfff2dd, 2.2); sol.position.set(6, 10, 8); cena.add(sol, new THREE.HemisphereLight(0xbfd8ff, 0x404040, 0.6));
const chao = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.9 })); chao.rotation.x = -Math.PI / 2; cena.add(chao);
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.3, envMapIntensity: 0.9 }), luz = luzesNoMaterial(mat);
const cores = { sedan: 0x9e1418, hatch: 0x1d3c86, suv: 0x2a2c30, van: 0xdadade, taxi: 0xf2bd1a, policia: 0xf0f0f2 };
luz.uFarol.value = 1;
TIPOS.forEach((t, k) => { const m = new THREE.InstancedMesh(geometriaCarro(THREE, t), mat, 1); m.setColorAt(0, new THREE.Color(cores[t])); m.setMatrixAt(0, new THREE.Matrix4().makeRotationY(-0.6).setPosition((k % 3) * 6 - 6, 0, Math.floor(k / 3) * 5 - 2.5)); cena.add(m); });
window.foto = (vista, noite) => {
  cena.background = new THREE.Color(noite ? 0x05070d : 0x9cc4ef); sol.intensity = noite ? 0.15 : 2.2; cena.environmentIntensity = noite ? 0.1 : 1;
  const [x, y, z] = vista; cam.position.set(x, y, z); cam.lookAt(0, 0.7, 0); r.render(cena, cam);
};
window.pronto = true;
</script></body></html>`;
const arq = path.join(AQUI, '.vista-carros.html'); fs.writeFileSync(arq, html);
await pagina.goto(srv.url + 'tools/.vista-carros.html', { timeout: 300000 });
await pagina.waitForFunction(() => window.pronto, null, { timeout: 300000 });
for (const [nome, vista, noite] of [['carros-dia', [0, 9, 17], false], ['carros-lado', [17, 3, 2], false], ['carros-noite', [0, 6, 16], true], ['carros-tras', [-12, 4, -12], true]]) {
  await pagina.evaluate(([v, n]) => window.foto(v, n), [vista, noite]);
  await pagina.screenshot({ path: path.join(pasta, `${nome}.png`), timeout: 300000 });
}
console.log(erros.length ? `erros: ${erros.slice(0, 3).join(' | ')}` : 'sem erros');
fs.rmSync(arq, { force: true });
await navegador.close(); await srv.fechar();
