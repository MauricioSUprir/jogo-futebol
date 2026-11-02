// O plano da câmera atrás do cobrador nas bolas paradas da pessoa (PURO: sem three nem DOM, para os testes em Node; o
// desenho, a linha e o painel moram em render/bola-parada.js, que reexporta isto). Contrato "Cobrança mirada e câmera da
// bola parada" no CONTRATOS.md (PESQUISA-ETAPA4.md §12) e, no escanteio, "Câmera de TV (item 66)".
//  - Tiro livre, tiro de meta, pênalti e pênalti contra: `atras` m atrás, `lado` m para o lado (o que fica mais para dentro
//    do campo), `altura` m; olhar e fov pela conta (a bola em `bolaY` da altura do quadro, o alvo em `alvoY`); fora dos
//    sólidos (estadio-forma.js solidoEm) e de jogadores: chega e sobe.
//  - Escanteio (item 66; dono, 23/10, com o print de um escanteio: "não dá pra ver a área completamente"): atrás do cobrador
//    mas ALTA — o "elevated angle ... Tap to Pass-friendly" do escanteio do EA FC Mobile (a câmera baixa atrás da bola deixava
//    a área como uma tira de 7,7% da altura da tela, com jogadores de 15 px no celular). A lente 13 m atrás e 8 m acima, a
//    bola em 86% da altura do quadro e o alvo em 30%; a até 17 m da bola com a corrida da cobrança; sempre ≥ 2 m acima do que
//    houver embaixo (no escanteio do lado de lá ela fica sobre os degraus da arquibancada).
import { solidoEm } from '../estadio-forma.js';
import { cameraNoLadoDeCa } from './torcida-dados.js';

export const CAMERA_BOLA_PARADA = {
  atras: 4.6, lado: 1.9, altura: 2.6, bolaY: 0.76, alvoY: 0.4, fov: [40, 74], distMax: 7.6, atrasMin: 3.2,
  folgaSolido: 0.4, folgaJogador: 1.0, tentativas: 6,
};
export const CAMERA_ESCANTEIO = {
  ...CAMERA_BOLA_PARADA,
  atras: 13, lado: 1.2, altura: 8, bolaY: 0.86, alvoY: 0.3, fov: [26, 62], distMax: 17, atrasMin: 6.5,
  folgaCabeca: 2,             // m: a lente sempre a ≥ isto acima do que houver logo embaixo (degraus, cabeças)
  // bloqueada (a arquibancada encostada no campo do lado de lá: o Maracanã, as arenas), chega 15% e sobe 1 m por tentativa
  // (com os 18% e 0,55 m dos outros tipos, o Maracanã com a corrida ficava dentro da arquibancada; varridos no G5 do
  // teste-camera: este par tira todas as lentes dos sólidos com o pior jogador na marca a 14 px)
  chega: 0.85, sobe: 1.0, tentativas: 10,
  ladoDeCa: true,             // dentro da caixa da arquibancada de cá ela sai do desenho (a mesma regra da TV): não bloqueia
};
/** O perfil da câmera atrás do cobrador pelo tipo da cobrança. */
export const perfilBolaParada = tipo => (tipo === 'escanteio' ? CAMERA_ESCANTEIO : CAMERA_BOLA_PARADA);

/**
 * Plano {de, para, fov (vertical)} atrás da bola (bx, bz) olhando o alvo (tx, ty, tz); lado −1 = câmera à esquerda.
 * recuo (m; a corrida da cobrança, item 70): o cobrador espera `recuo` m atrás da bola (na linha bola–alvo). O quadro é
 * montado pelo ponto da linha na altura dele (no lugar da bola: os pés dele em bolaY, a bola mais acima, à frente dele), com
 * a lente a até C.distMax m da bola (atrás dele C.atrasMin–C.atras m) — o cobrador inteiro na metade de baixo. C = o perfil
 * (CAMERA_BOLA_PARADA; no escanteio, CAMERA_ESCANTEIO).
 */
export function planoBolaParada(bx, bz, tx, ty, tz, lado, jogadores, out, recuo = 0, C = CAMERA_BOLA_PARADA) {
  out.de ??= [0, 0, 0]; out.para ??= [0, 0, 0];
  let dx = tx - bx, dz = tz - bz;
  const D = Math.hypot(dx, dz) || 1;
  dx /= D; dz /= D;
  let atras = C.atras;
  if (recuo > 0) { bx -= dx * recuo; bz -= dz * recuo; atras = Math.max(C.atrasMin, Math.min(C.atras, C.distMax - recuo)); }
  let alt = C.altura, ld = C.lado, px = 0, pz = 0;
  for (let k = 0; k <= C.tentativas; k++) {
    px = bx - dx * atras - dz * ld * lado; pz = bz - dz * atras + dx * ld * lado;
    const escondida = !!C.ladoDeCa && pz > 0 && cameraNoLadoDeCa({ x: px, y: alt, z: pz });
    let livre = escondida || !solidoEm(px, alt, pz, C.folgaSolido, false);
    // (o escanteio alto: nada logo embaixo da lente — os degraus e as cabeças da arquibancada de lá)
    if (livre && !escondida && C.folgaCabeca) livre = !solidoEm(px, alt - C.folgaCabeca, pz, C.folgaSolido, false);
    if (livre && alt < 2.3) for (const j of jogadores) if (Math.hypot(j.x - px, j.z - pz) < C.folgaJogador) { livre = false; break; }
    if (livre) break;
    atras *= C.chega ?? 0.82; alt += C.sobe ?? 0.55; ld *= 0.9;
  }
  // arfagem p e tan(fov/2) t: a bola em bolaY e o alvo em alvoY (ângulos abaixo do horizonte, por bissecção)
  const tb = Math.atan2(alt - 0.11, Math.hypot(bx - px, bz - pz)), tt = Math.atan2(alt - ty, Math.hypot(tx - px, tz - pz));
  const k2 = 2 * (C.bolaY - 0.5);
  const yAlvo = p => 0.5 - Math.tan(p - tt) * k2 / (2 * Math.tan(tb - p));
  let lo = tt - 0.3, hi = tb - 0.02;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (yAlvo(m) > C.alvoY) lo = m; else hi = m; }
  const f = Math.max(C.fov[0], Math.min(C.fov[1], (2 * Math.atan(Math.tan(tb - (lo + hi) / 2) / k2) * 180) / Math.PI));
  const p = tb - Math.atan(Math.tan((f * Math.PI) / 360) * k2); // com o fov limitado, a bola volta para bolaY
  let lx = (bx + tx) / 2 - px, lz = (bz + tz) / 2 - pz;
  const ll = Math.hypot(lx, lz) || 1;
  out.de[0] = px; out.de[1] = alt; out.de[2] = pz;
  out.para[0] = px + lx / ll * 10; out.para[1] = alt - Math.tan(p) * 10; out.para[2] = pz + lz / ll * 10;
  out.fov = f;
  return out;
}
