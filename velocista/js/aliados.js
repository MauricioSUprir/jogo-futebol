// Os aliados de fora do laboratório: o detetive Joe (que criou você) e a Iris (repórter do Picture News). Corpos do
// Rocketbox (MIT; pessoas genéricas da biblioteca, só os nomes são da história), convertidos como a equipe do Cortex.
// Aparecem no ponto do passo da história que os chama (marcos.js PONTOS: a porta da Delegacia, o Jitters, a praça da
// Prefeitura...) e ficam até a cena daquele passo acabar; viram para o herói quando ele chega perto e gesticulam quando falam.
// Também quem aparece só numa cena da vida do Barry: o VULTO da noite do raio e o homem de amarelo na cozinha dos West (os
// dois vibrando, o rosto borrado).
import * as THREE from 'three';
import { criarHeroi } from './humano.js';
import { pontoMundo } from './marcos.js';

const PERFIS = { joe: { pessoa: 'joe' }, iris: { pessoa: 'iris' }, vulto: { traje: 'vulto', vibra: true }, reverso: { traje: 'reverso', vibra: true } };
const IDS = Object.keys(PERFIS);

export function criarAliados(cena, { mobile = false, aniso = 2, chao = () => 0.3 } = {}) {
  const pessoas = {};                                        // id → {modelo, raiz, x, z, h, ponto}
  const carregando = {};
  async function carregar(id) {
    if (!carregando[id]) carregando[id] = criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, ...PERFIS[id] }).then((modelo) => {
      const raiz = new THREE.Group(); raiz.add(modelo.grupo); raiz.visible = false; cena.add(raiz);
      modelo.grupo.traverse((o) => { if (o.isMesh) o.castShadow = !mobile; });
      pessoas[id] = { id, modelo, raiz, x: 0, z: 0, h: 0, ponto: null };
    }).catch((e) => { console.warn('aliado sem corpo', id, e); });
    return carregando[id];
  }
  let quadro = {};                                           // id → nome do ponto (o que o passo atual pede)
  /** quem fica onde: {joe: 'delegacia', iris: 'cafe', vulto: 'cantoCsi'}; null ou {} esconde todos */
  function posicionar(mapa) {
    quadro = mapa || {};
    for (const id of IDS) {
      const nome = quadro[id];
      if (!nome) { if (pessoas[id]) pessoas[id].raiz.visible = false; continue; }
      carregar(id);
      const p = pessoas[id]; if (!p || p.ponto === nome) continue;
      const w = pontoMundo(nome); p.ponto = nome; p.x = w.x; p.z = w.z; p.h = w.h; p.h0 = w.h; p.y = w.y ?? chao(p.x, p.z);
      p.raiz.position.set(p.x, p.y, p.z); p.raiz.rotation.y = p.h;
    }
  }
  const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function atualizar(dt, P, { quemFala = null } = {}) {
    for (const id of IDS) {
      const p = pessoas[id]; if (!p) continue;
      const ativo = !!quadro[id];
      if (ativo && p.ponto !== quadro[id]) posicionar(quadro);    // o corpo acabou de carregar
      const perto = ativo && Math.hypot(P.x - p.x, P.z - p.z) < 160 && Math.abs(P.y - (p.y ?? P.y)) < 40;   // (dentro de um lugar: só com o herói lá)
      p.raiz.visible = perto;
      if (!perto) continue;
      const alvo = Math.hypot(P.x - p.x, P.z - p.z) < 14 ? Math.atan2(P.x - p.x, P.z - p.z) : p.h0;
      p.h += ang(alvo - p.h) * Math.min(1, dt * 3); p.raiz.rotation.y = p.h;
      p.modelo.aplicar({ v: 0, noChao: true, fala: quemFala === id, vibrando: !!PERFIS[id].vibra }, dt);
    }
  }
  return {
    posicionar, atualizar, carregar,
    /** foco de câmera de quem está em cena (null se não está) */
    foco: (id) => (quadro[id] && pessoas[id]?.raiz.visible ? { x: pessoas[id].x, y: pessoas[id].raiz.position.y, z: pessoas[id].z } : null),
    /** onde o herói fica para conversar: a `d` m à frente do primeiro aliado em cena, olhando para ele */
    diante(d = 3.6) {
      // (de frente para quem é de carne e osso; só com o vulto ou o homem de amarelo em cena, de frente para ele)
      let ids = IDS.filter((id) => quadro[id] && !PERFIS[id].vibra); if (!ids.length) ids = IDS.filter((id) => quadro[id]); if (!ids.length) return null;
      const ws = ids.map((id) => pontoMundo(quadro[id])), mx = ws.reduce((a, w) => a + w.x, 0) / ws.length, mz = ws.reduce((a, w) => a + w.z, 0) / ws.length, h = ws[0].h;
      const x = mx + Math.sin(h) * d, z = mz + Math.cos(h) * d;
      return { x, z, h: Math.atan2(mx - x, mz - z), y: ws[0].y };
    },
    get pessoas() { return pessoas; },
  };
}
