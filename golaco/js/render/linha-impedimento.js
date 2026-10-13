// Linha de impedimento desenhada no gramado (pedido do dono, seção 8: "impedimento com a linha desenhada").
//  - no apito do impedimento: a linha DO LANCE (a do instante do passe) fica parada, amarela e mais grossa, por
//    IMPEDIMENTO.linhaCongela s (a marcação, sem texto na tela; o replay mostra a mesma linha);
//  - a linha VIVA (com a bola rolando no campo de ataque de quem tem a bola: amarelo-clara, na linha de impedimento
//    DESTE time — impedimento.js linhaImpedimento) só com IMPEDIMENTO.linhaViva: DESLIGADA desde 11/10 (dono: "não
//    quero a linha de impedimento durante o jogo"); o código fica para o replay e para conferências.
// Uma malha (1 draw call quando visível). Só lê o mundo: não muda o hash.
// Análise semiautomática do replay (render/replay-saot.js; pedido do dono de 12/10): uma 2ª malha 'planos-saot' — a
// PAREDE do defensor (vertical, translúcida, na faixa dos jogadores do lance), o PLANO do atacante e os dois anéis do
// PULSO no quadril — numa BufferGeometry só, cor e alfa por vértice (+1 chamada, só na análise; pré-carregada no 1º
// quadro desenhado, como a torcida: o 1º replay não engasga). mostrarSaot(cena | null) é comandado pelo replay.
import * as THREE from 'three';
import { CAMPO, IMPEDIMENTO, PASSO, REPLAY } from '../config.js';
import { linhaImpedimento } from '../impedimento.js';
import { jogadorPorId } from '../sim.js';

const VIVA = new THREE.Color(0xfff2a8), AMARELA = new THREE.Color(0xffd84a);
const OPACA_VIVA = 0.55, OPACA_LANCE = 0.95;
const SEG_ANEL = 32;
const _c0 = new THREE.Color(), _c1 = new THREE.Color();

/**
 * Malha dos planos da análise: 2 retângulos (parede, plano) com borda em cima e dos lados e 2 anéis (pulsos), em
 * posições/cores reescritas por quadro (~160 vértices). Índices fixos.
 */
function criarPlanosSaot() {
  // vértices: retângulo = corpo (4) + borda de cima (4) + 2 bordas dos lados (8) = 16; anel = (SEG + 1) × 2
  const NR = 16, NA = (SEG_ANEL + 1) * 2, NV = NR * 2 + NA * 2;
  const pos = new Float32Array(NV * 3), cor = new Float32Array(NV * 4);
  const idx = [];
  const quad = o => idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  for (const r of [0, NR]) for (let q = 0; q < 4; q++) quad(r + q * 4);
  for (const a of [NR * 2, NR * 2 + NA]) for (let k = 0; k < SEG_ANEL; k++) { const o = a + k * 2; idx.push(o, o + 1, o + 3, o, o + 3, o + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'planos-saot';
  m.renderOrder = 4;            // depois da linha do chão (3), antes do HUD (DOM)
  m.frustumCulled = false;      // a malha muda de lugar a cada análise
  m.visible = false;
  m.castShadow = false; m.receiveShadow = false;
  return { m, geo, pos, cor, NR, NA, nTri: idx.length / 3 };
}

/** Time com a bola: o dono (pé ou mão), senão o do passe/chute no ar, senão null. */
function timeComBola(m) {
  const id = m.naMao ?? m.posse;
  if (id != null) { const j = jogadorPorId(m, id); return j ? j.time : null; }
  return m.voo ? m.voo.time ?? null : null;
}

export function criarLinhaImpedimento(cena) {
  const mat = new THREE.MeshBasicMaterial({
    color: VIVA, opacity: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(0.16, CAMPO.largura), mat);
  malha.rotation.x = -Math.PI / 2;
  malha.renderOrder = 3;
  malha.visible = false;
  malha.name = 'linha-impedimento';
  cena.add(malha);
  const _l = { u: 0, x: 0, defensor: null };
  let vis = 0, x = 0, lance = false, timeLinha = null, corLinha = 0xffd84a;
  // planos da análise semiautomática (pré-carga: no 1º quadro desenhado vai para a GPU com 0 triângulos)
  const PS = criarPlanosSaot();
  cena.add(PS.m);
  let precarga = true, restaurar = false;
  const est = { visivel: false, parede: 0, plano: 0, pulsoDef: 0, pulsoAtac: 0, xParede: null, xPlano: null, corPlano: null, corParede: null, zMin: 0, zMax: 0, anelDef: null, anelAtac: null };
  const S = REPLAY.saot;

  /** Retângulo vertical r (0 = parede, 1 = plano) em x, z de z0 a z1, até `alt`, cor `c` com alfa de baixo/cima × a. */
  function retangulo(r, xr, z0, z1, alt, c, aB, aC, a) {
    const o = r * PS.NR, P = PS.pos, C = PS.cor, b = S.parede.borda;
    const put = (v, px, py, pz, al) => { const i = (o + v) * 3, k = (o + v) * 4; P[i] = px; P[i + 1] = py; P[i + 2] = pz; C[k] = c.r; C[k + 1] = c.g; C[k + 2] = c.b; C[k + 3] = al; };
    // corpo (alfa de baixo para cima)
    put(0, xr, 0, z0, aB * a); put(1, xr, 0, z1, aB * a); put(2, xr, alt, z1, aC * a); put(3, xr, alt, z0, aC * a);
    // borda de cima e dos lados (mais forte: a parede tem contorno, como na TV)
    const ab = Math.min(1, 0.75 * a);
    put(4, xr, alt - b * 2, z0, ab); put(5, xr, alt - b * 2, z1, ab); put(6, xr, alt, z1, ab); put(7, xr, alt, z0, ab);
    put(8, xr, 0, z0, ab); put(9, xr, 0, z0 + b * 2, ab); put(10, xr, alt, z0 + b * 2, ab); put(11, xr, alt, z0, ab);
    put(12, xr, 0, z1 - b * 2, ab); put(13, xr, 0, z1, ab); put(14, xr, alt, z1, ab); put(15, xr, alt, z1 - b * 2, ab);
  }
  /** Anel horizontal k (0 = defensor, 1 = atacante) no quadril (x, y, z), raio r, cor c, alfa a. */
  function anel(k, xr, yr, zr, raio, c, a) {
    const o = PS.NR * 2 + k * PS.NA, P = PS.pos, C = PS.cor, w = S.pulso.largura;
    for (let s2 = 0; s2 <= SEG_ANEL; s2++) {
      const ang = (s2 / SEG_ANEL) * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang);
      for (let e = 0; e < 2; e++) {
        const v = o + s2 * 2 + e, i = v * 3, q = v * 4, rr = raio + (e ? w : -w) * 0.5;
        P[i] = xr + cs * rr; P[i + 1] = yr; P[i + 2] = zr + sn * rr;
        C[q] = c.r; C[q + 1] = c.g; C[q + 2] = c.b; C[q + 3] = a;
      }
    }
  }

  return {
    malha,
    /** A malha dos planos da análise (testes). */
    malhaSaot: PS.m,
    /** Estado da linha (testes): {visivel, x, lance (a do apito), opacidade, cor}. */
    get estado() { return { visivel: malha.visible, x, lance, opacidade: mat.opacity, cor: corLinha }; },
    /** Estado dos planos da análise (testes): visível, alfas, x da parede e do plano, cores, anéis. */
    get estadoSaot() { return { ...est, triangulos: PS.m.visible ? PS.nTri : 0 }; },
    /** mundo: estado da simulação; dt: s do quadro; desenha: este quadro vai mesmo ser desenhado (pré-carga). */
    atualizar(mundo, dt, desenha = true) {
      // pré-carga dos planos da análise: no 1º quadro desenhado, com 0 triângulos (programa e geometria na GPU)
      if (restaurar) { restaurar = false; PS.geo.setDrawRange(0, Infinity); PS.m.visible = false; }
      if (precarga && desenha) { precarga = false; PS.m.visible = true; PS.geo.setDrawRange(0, 0); restaurar = true; }
      const p = mundo?.partida;
      let alvo = 0, xAlvo = x, ehLance = false, t = null;
      if (p) {
        const ui = p.ultimoImped;
        if (ui && mundo.tick >= ui.tick && (mundo.tick - ui.tick) * PASSO < IMPEDIMENTO.linhaCongela) {
          alvo = OPACA_LANCE; xAlvo = ui.linhaX; ehLance = true;
        } else if (IMPEDIMENTO.linhaViva && p.estado === 'jogo' && !(mundo.parada && !mundo.parada.rolou)) {
          t = timeComBola(mundo);
          if (t != null && mundo.bola.p.x * mundo.ataca[t] > 0) {
            linhaImpedimento(mundo, t, _l);
            if (_l.u > 0) { alvo = OPACA_VIVA; xAlvo = _l.x; }
          }
        }
      }
      // a linha do lance aparece na hora; a viva acompanha a defesa sem degrau (a simulação anda a 60 Hz) e,
      // trocando de time, nasce no lugar novo
      const k = 1 - Math.exp(-(dt > 0 ? dt : 0) * 18);
      if (ehLance || !malha.visible || vis < 0.02 || (t != null && t !== timeLinha)) x = xAlvo;
      else x += (xAlvo - x) * k;
      if (t != null) timeLinha = t;
      const passo = (dt > 0 ? dt : 0) / IMPEDIMENTO.linhaMostra;
      vis = ehLance ? alvo : vis + Math.max(-passo, Math.min(passo, alvo - vis));
      lance = ehLance;
      malha.visible = vis > 0.005;
      if (!malha.visible) return;
      corLinha = ehLance ? 0xffd84a : 0xfff2a8;
      mat.color.copy(ehLance ? AMARELA : VIVA);
      mat.opacity = vis;
      malha.scale.x = ehLance ? 1.8 : 1;
      malha.position.set(x, 0.021, 0);
    },
    /**
     * Desenho COMANDADO (o replay do impedimento, render/replay.js): l = null (some) ou {visivel, x, opacidade, cor?} — a
     * linha do lance (grossa; amarela, ou a cor dada: branco-gelo/verde na análise) em x, sem ler o mundo nem depender da
     * linha do jogo ao vivo.
     */
    mostrar(l) {
      const vis = !!(l && l.visivel && l.opacidade > 0.005);
      malha.visible = vis;
      lance = vis;
      if (!vis) { mat.opacity = 0; return; }
      x = l.x;
      corLinha = l.cor ?? 0xffd84a;
      mat.color.setHex(corLinha);
      mat.opacity = Math.min(1, l.opacidade);
      malha.scale.x = 1.8;
      malha.position.set(x, 0.021, 0);
    },
    /**
     * Planos da análise semiautomática (comandado pelo replay): sc = null (somem) ou o `cena()` do diretor — {ativa, tipo,
     * parede, plano, pulsoDef, pulsoAtac, batidaDef, batidaAtac, cor, mesmaLinha, cena: {linhaX, zMin, zMax, atac {x, z,
     * y}, def {x, z, y} | null}}. A parede fica no x da linha (= o quadril do defensor), o plano no x do quadril do
     * atacante; impedimento: o plano fica vermelho na decisão; posição legal: parede e plano ficam verdes.
     */
    mostrarSaot(sc) {
      if (restaurar) { restaurar = false; PS.geo.setDrawRange(0, Infinity); }
      if (!sc || !sc.ativa) { PS.m.visible = false; est.visivel = false; return; }
      const c = sc.cena, C = S.cores, legal = sc.tipo === 'legal';
      // parede: branco-gelo; na posição legal vai para o verde com a decisão
      _c0.setHex(C.gelo);
      if (legal) _c0.lerp(_c1.setHex(C.legal), sc.cor);
      retangulo(0, c.linhaX, c.zMin, c.zMax, S.parede.altura, _c0, S.parede.alfaBaixo, S.parede.alfaCima, sc.parede);
      est.corParede = _c0.getHex();
      // plano do atacante: neutro → vermelho (impedimento) ou verde (legal); "mesma linha": sem plano (alfa 0)
      _c0.setHex(C.neutro).lerp(_c1.setHex(legal ? C.legal : C.impedimento), sc.cor);
      const H = S.plano.meiaLargura;
      retangulo(1, c.atac.x, c.atac.z - H, c.atac.z + H, S.parede.altura, _c0, S.plano.alfaBaixo, S.plano.alfaCima, sc.plano);
      est.corPlano = _c0.getHex();
      // pulsos: anel no quadril que cresce e some na batida
      const P = S.pulso;
      _c0.setHex(C.pulso);
      if (legal) _c0.lerp(_c1.setHex(C.legal), sc.cor);
      const d = c.def;
      const aD = sc.pulsoDef * (0.35 + 0.65 * (1 - sc.batidaDef));
      anel(0, d ? d.x : c.linhaX, d ? d.y : 0.95, d ? d.z : c.atac.z, P.raio * (1 + P.cresce * sc.batidaDef), _c0, d ? aD : 0);
      const aA = sc.pulsoAtac * (0.35 + 0.65 * (1 - sc.batidaAtac));
      anel(1, c.atac.x, c.atac.y, c.atac.z, P.raio * (1 + P.cresce * sc.batidaAtac), _c0, aA);
      PS.geo.attributes.position.needsUpdate = true;
      PS.geo.attributes.color.needsUpdate = true;
      PS.m.visible = sc.parede > 0.002 || sc.plano > 0.002 || aD > 0.002 || aA > 0.002;
      est.visivel = PS.m.visible; est.parede = sc.parede; est.plano = sc.plano; est.pulsoDef = d ? aD : 0; est.pulsoAtac = aA;
      est.xParede = c.linhaX; est.xPlano = c.atac.x; est.zMin = c.zMin; est.zMax = c.zMax;
      est.anelDef = d ? { x: d.x, y: d.y, z: d.z } : null; est.anelAtac = { x: c.atac.x, y: c.atac.y, z: c.atac.z };
    },
  };
}
