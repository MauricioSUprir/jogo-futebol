// Lugar de cada jogador da IA nas bolas paradas da Etapa 4 (pedido do dono, seção 8). Puro: sem three.js nem DOM;
// matemática pelo MD. O ia-tatica.js pergunta aqui antes do papel de sempre, enquanto a parada não foi cobrada
// (m.parada && !m.parada.rolou); quem não tem lugar aqui (null) segue o papel de sempre.
//
//  - Tiro de meta (Regra 16; TIRO_DE_META): do time que cobra, os zagueiros abrem nos cantos da área (dentro dela: só os
//    adversários ficam fora), o volante encosta na meia-lua e os laterais sobem pelos lados — a saída curta.
// Coordenadas: as vagas estão no referencial de quem ataca para +x (a direita dele é +z); no mundo, x e z × m.ataca.

import { TIRO_DE_META, CAMPO } from './config.js';
import { FORMACOES } from './formacoes.js';

const LADO_CAMPO = { LD: 1, LE: 1, ADD: 1, ADE: 1 };

/** Lado da vaga do jogador no mundo (+1 / −1 / 0 no meio) — pela posição-base sem a bola dela. */
function ladoDaVaga(m, j) {
  const f = m.times?.[j.time] && FORMACOES[m.times[j.time].formacao];
  const v = f && f.vagas[j.vagaIdx];
  if (!v) return j.z >= 0 ? 1 : -1;
  const z = v.sem.z * m.ataca[j.time];
  return z > 0.5 ? 1 : z < -0.5 ? -1 : 0;
}

/**
 * Lugar do jogador j (da IA, sem a bola) na bola parada por cobrar: escreve {x, z, correr} em out e devolve out, ou
 * null (sem lugar especial: o papel de sempre).
 */
export function alvoBolaParada(m, j, out) {
  const pr = m.parada;
  if (!pr || pr.rolou || pr.cobrador == null || j.id === pr.cobrador || j.posicao === 'GOL') return null;
  if (pr.tipo === 'tiroDeMeta' && j.time === pr.time) return tiroDeMeta(m, j, out);
  return null;
}

function tiroDeMeta(m, j, out) {
  const T = TIRO_DE_META, lado = m.ataca[j.time], gx = -lado * CAMPO.meioX;
  const pos = j.posDetalhe;
  let u, w;
  const s = ladoDaVaga(m, j);
  if (pos === 'ZAG') { u = T.aberto.u - (s === 0 ? 2 : 0); w = s * T.aberto.z; }
  else if (pos === 'VOL') { u = T.volante.u; w = s * 6; }
  else if (LADO_CAMPO[pos]) { u = T.laterais.u; w = (s || 1) * T.laterais.z; }
  else return null;
  out.x = gx + lado * u; out.z = w; out.correr = true;
  return out;
}
