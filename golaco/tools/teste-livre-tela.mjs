// teste-livre-tela: o Modo Livre no navegador (pedido do dono de 16/10; js/livre.js, js/livre-pagina.js,
// js/render/camera-livre.js; contrato "Modo Livre" no CONTRATOS.md). Relógio manual (o laço da página, quadro a quadro).
//   A  (Node, sem navegador) as poses das 6 câmeras: TV, Aproximada, Ampla, Alta, Atrás e Jogador × Altura e Distância 0,
//      5, 10, 15 e 20 × 3 telas (PC 16:9, celular deitado, 4:3) × os 2 rumos do ataque × focos na borda do que cada câmera
//      alcança (+ as transições a meio caminho entre câmeras de mesmo rumo): nenhuma dentro de um sólido do estádio do jogo
//      (estadio-forma.js; a arquibancada de cá só com a câmera dentro da caixa dela, que sai do desenho), nenhuma com
//      arquibancada, parede ou teto na frente do campo (raios pelo quadro até o gramado), Jogador ≥ 3,2 m de altura e ≥ 3 m
//      da cabeça do controlado. A2: sem os limites (segurarPose) a mesma varredura reprova — ela enxerga o problema.
//      A3 a câmera não pula (o foco andando 0,05 m: ≤ 0,6 m; o limite antigo da caixa de cá pulava 14 m), A4 a bola e o
//      controlado (pés e cabeça) dentro das margens do quadro (camera-livre.js QUADRO: acima do minimapa) nas bordas do
//      campo — a pequena área e os cantos do meu gol, as laterais, o outro gol — nos dois rumos, A5 o corte do Jogador na
//      troca de controlado para longe (revisão de 16/10).
//   B  PC 1280×720 Alta, de dia: ?modo=livre abre a pausa no submenu Jogadores com o "Jogar"; cada câmera escolhida PELA
//      PAUSA (Câmera → o botão → Voltar → Continuar), com a bola no pé do controlado: o quadro não vazio, a bola e o
//      controlado (cabeça, cintura e pés) no quadro, a câmera fora de sólido e a ≥ 3 m do controlado, os pontos do gramado à
//      vista com cor de grama (nada atravessando a arquibancada nem a cobertura) e a fração de grama na tela. B0b a pausa no
//      PC sem texto cortado ("Meu time", "Adversário", os subtítulos dos treinos); B2 os cantos do lado de cá fechados (o céu
//      em Atrás e Jogador); B3 a bola no pé na pequena área e nos cantos do meu gol: a bola e o controlado no quadro, a bola
//      acima do minimapa.
//   C  PC: C cicla pelas 6 câmeras (com o aviso "Câmera: …"); Atrás e Jogador com o rumo do ataque do meu time e o
//      analógico para cima levando o controlado para o gol que eu ataco (na TV, para o lado de lá); TV → Ampla com transição
//      e TV → Atrás com corte; Altura e Distância (−/+ na pausa) sobem e afastam a câmera; a escolha fica salva (recarregar
//      volta com a câmera e o ajuste); na partida (Modo de jogo) a câmera volta a ser a da partida (TV/Aproximada), sem os
//      cantos do Livre; C6 o −/+ no limite fica apagado sem perder o foco (o controle) e o aperto a mais não muda nada.
//   D  Celular 844×390 Média, de noite (toque, entalhe): a pausa do Livre (Continuar | Replay; Jogadores | Câmera;
//      Recomeçar | Bola no meu pé; Modo de jogo; Ajuda — sem Editar time e sem Reiniciar) e os submenus Jogadores, Câmera e
//      Modo de jogo (com "Modo Livre N contra M") cabem SEM ROLAR e nada encosta; na coluna das opções o nome da câmera
//      no lugar do TV | Aproximada; as 6 câmeras de noite com as conferências do B e o custo de desenho de cada uma dentro do
//      teto do jogo no celular (≤ 40 chamadas, ≤ 130 mil triângulos: o do pré-jogo).
//   E  568×320 (toque, entalhe): a barra da pausa sem nada encostando nem passando da janela, os botões do Livre sem
//      encostar uns nos outros (a pausa rola nessa tela, como a da partida: medido e mostrado). Em toda pausa medida, nada
//      cortado: os botões, os nomes das linhas do Livre e os subtítulos <small>.
//   F  ?tm (o quadro do Total Match imitado, pedido com modo "livre" e livre {linha [3, 2], goleiro [sim, não]}): a cara do
//      TM (as câmeras em pílula), 4 contra 2 no "Jogar", a pausa com "Voltar ao Total Match" (sem Modo de jogo, Simular o
//      resto, Reiniciar e Editar time) sem rolar em 844×390, e o clique manda tm3d:fim com {livre: {placar}} ao pai.
//   G  Nenhum erro no console em nenhuma tela.
//   H  A junção com a main (16/10): H1 a bola parada do humano (tiro de meta, escanteio) com as câmeras TV, Alta e Atrás do
//      Livre mostra a câmera atrás do cobrador (#490: a do Livre cobria o plano e o analógico girava por ele, escondido) e a
//      "direita" leva o fim da linha da mira para a direita na tela; depois da cobrança, de volta à câmera do Livre sem
//      salto; H2 mudar os jogadores na pausa no meio da cobrança mirada: a mira fica e o cobrador e a câmera não somem; H3 R
//      ("Bola no meu pé") no meio do gol descarta o replay daquele gol (antes tocava na próxima saída sem gol).
//   node tools/teste-livre-tela.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = p => import(pathToFileURL(path.join(AQUI, p)).href);
const CL = await imp('../js/render/camera-livre.js');
const { solidoEm } = await imp('../js/estadio-forma.js');
const { cameraNoLadoDeCa } = await imp('../js/render/torcida-dados.js');
const { CAMERA, CAMPO } = await imp('../js/config.js');
const { PED_A } = await imp('lib/pedidos-tm.mjs');
const res = [];
const meta = (nome, medido, ok) => res.push({ nome, medido, ok: !!ok });
const errosTodos = [];

// ------------------------------------------------------------------ A: varredura das poses (Node)
function varrer(semLimites) {
  const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
  const TV = { largura: CAMERA.largura, distancia: CAMERA.distancia, altura: CAMERA.altura, olharY: 0, limX: MX - 14, limZ0: -MZ + 12, limZ1: MZ - 11 };
  const TVC = { ...TV, ...CAMERA.celular };
  const AP = { largura: CAMERA.aproximada.largura, distancia: CAMERA.aproximada.distancia, altura: CAMERA.aproximada.altura, olharY: 0.6, limX: MX - 3, limZ0: -MZ + 3, limZ1: MZ - 2 };
  const ARQ = /arquibancada|fundo|parede|marquise|teto|túnel/;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  let poses = 0; const falhas = [];
  const segura = (m, p) => { if (!semLimites) CL.segurarPose(m, p); };
  function confere(p, asp, rot) {
    poses++;
    const [x, y, z] = p.de;
    if (CL.poseBloqueada(x, y, z)) { falhas.push(`${rot}: dentro de ${solidoEm(x, y, z, 0.6, false)}`); return; }
    const corte = cameraNoLadoDeCa({ x, y, z });
    const f = norm(sub(p.para, p.de)), r = norm([-f[2], 0, f[0]]), u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const tv = Math.tan(p.fov * Math.PI / 360), th = tv * asp;
    for (const sx of [-1, -0.5, 0, 0.5, 1]) for (const sy of [-1, -0.5, 0]) {
      const d = norm([f[0] + r[0] * sx * th + u[0] * sy * tv, f[1] + r[1] * sx * th + u[1] * sy * tv, f[2] + r[2] * sx * th + u[2] * sy * tv]);
      if (d[1] >= -1e-3) continue;
      const tg = -y / d[1], gx = x + d[0] * tg, gz = z + d[2] * tg;
      if (Math.abs(gx) > MX || Math.abs(gz) > MZ) continue;    // o chão desse raio fica fora do campo
      for (let t = 0.8; t < tg - 0.5; t += 0.8) {
        const s = solidoEm(x + d[0] * t, y + d[1] * t, z + d[2] * t, 0.3, false);
        if (!s || !ARQ.test(s) || (corte && /cá|túnel/.test(s))) continue;
        falhas.push(`${rot}: ${s} na frente do campo`); return;
      }
    }
  }
  const nova = () => ({ de: [0, 0, 0], para: [0, 0, 0], fov: 0 });
  const P = nova(), Q = nova(), M = nova();
  const fat = [0, 5, 10, 15, 20].map(CL.fatorAjuste);
  const perfil = (m, peq) => (m === 'tv' ? (peq ? TVC : TV) : m === 'aproximada' ? AP : CL.PERFIS_LIVRE[m]);
  const focos = (m, peq, fd = 1) => {
    const Pf = perfil(m, peq);
    // (Ampla/Alta: os limites do foco encolhem com a Distância — camera-livre.js limitesLateral)
    const L = m === 'ampla' || m === 'alta' ? CL.limitesLateral(Pf, fd) : Pf;
    if (Pf.limX != null) return { xs: [-L.limX, -L.limX / 2, 0, L.limX / 2, L.limX], zs: [L.limZ0, (L.limZ0 + L.limZ1) / 2, L.limZ1] };
    if (m === 'atras') return { xs: [-(MX - 4), -30, 0, 30, MX - 4], zs: [-(MZ - 4), 0, MZ - 4] };
    return { xs: [-(MX + 2), -MX + 3, -30, 0, 30, MX - 3, MX + 2], zs: [-(MZ + 2), -20, 0, 20, MZ + 2] };
  };
  const pose = (m, fx, fz, fa, fd, dir, asp, peq, out) => {
    const Pf = perfil(m, peq);
    if (Pf.limX != null) CL.poseLateral(Pf, fx, fz, fa, fd, asp, peq, out);
    else CL.poseComprimento(m, fx, fz, dir, fa, fd, asp, out, m === 'jogador' ? 4 * Math.sign(fz || 1) : 0);
    segura(m, out);
    return out;
  };
  const PARES = [['tv', 'ampla'], ['tv', 'alta'], ['ampla', 'alta'], ['aproximada', 'alta'], ['atras', 'jogador']];
  for (const [asp, peq] of [[16 / 9, false], [844 / 390, true], [4 / 3, false]]) {
    for (const fa of fat) for (const fd of fat) for (const dir of [1, -1]) {
      for (const m of CL.CAMERAS_LIVRE) {
        const { xs, zs } = focos(m, peq, fd);
        for (const fx of xs) for (const fz of zs) {
          pose(m, fx, fz, fa, fd, dir, asp, peq, P);
          confere(P, asp, `${m} tela ${asp.toFixed(2)} altura ×${fa.toFixed(2)} distância ×${fd.toFixed(2)} rumo ${dir} foco (${fx}, ${fz})`);
          if (m === 'jogador') {
            const dh = Math.hypot(P.de[0] - fx, P.de[1] - 1.8, P.de[2] - fz);
            if (dh < 3 || P.de[1] < 3.2) falhas.push(`jogador: a ${dh.toFixed(2)} m da cabeça, ${P.de[1].toFixed(2)} m de altura, foco (${fx}, ${fz})`);
          }
        }
      }
      // transições: a meio caminho entre duas câmeras de mesmo rumo, no mesmo foco (o lugar do controlado e da bola)
      for (const [a, b] of PARES) {
        const { xs, zs } = focos(a, peq, fd);
        for (const fx of xs) for (const fz of zs) {
          pose(a, fx, fz, fa, fd, dir, asp, peq, P); pose(b, fx, fz, fa, fd, dir, asp, peq, Q);
          for (let i = 0; i < 3; i++) { M.de[i] = (P.de[i] + Q.de[i]) / 2; M.para[i] = (P.para[i] + Q.para[i]) / 2; }
          M.fov = (P.fov + Q.fov) / 2;
          segura(b, M);
          confere(M, asp, `transição ${a} → ${b} tela ${asp.toFixed(2)} foco (${fx}, ${fz})`);
        }
      }
    }
  }
  return { poses, falhas };
}
{
  const t0 = Date.now();
  const a = varrer(false), b = varrer(true);
  const tipos = [...new Set(b.falhas.map(f => f.replace(/ tela.*?:|foco.*$/g, '').replace(/\s+/g, ' ').trim().split(':').slice(-1)[0].trim()))];
  meta('A1 poses das 6 câmeras (× Altura/Distância 0–20, 3 telas, 2 rumos, focos na borda, transições): fora de sólido, nenhuma arquibancada/parede/teto na frente do campo, Jogador ≥ 3,2 m e ≥ 3 m da cabeça',
    `${a.poses} poses, ${a.falhas.length} falhas${a.falhas.length ? ': ' + a.falhas.slice(0, 4).join(' | ') : ''} (${Date.now() - t0} ms com a contraprova)`, a.falhas.length === 0 && a.poses > 10000);
  meta('A2 contraprova: sem os limites da câmera do Livre (segurarPose) a mesma varredura reprova',
    `${b.falhas.length} falhas sem os limites (${tipos.slice(0, 6).join('; ')})`, b.falhas.length > 0);
}

// A3–A5 (revisão de 16/10): a câmera não pula, a bola e o controlado ficam no quadro nas bordas do campo, e o Jogador corta
// na troca de controlado para longe. A câmera de verdade (criarCameraLivre) com uma câmera falsa que guarda a pose; o foco
// da TV/Aproximada (o de camera.js) = o controlado preso nos limites dela (a bola no pé: o pior caso perto da borda).
{
  const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
  const TV = { largura: CAMERA.largura, distancia: CAMERA.distancia, altura: CAMERA.altura, olharY: 0, limX: MX - 14, limZ0: -MZ + 12, limZ1: MZ - 11, retrato: 0 };
  const TVC = { ...TV, ...CAMERA.celular };
  const AP = { largura: CAMERA.aproximada.largura, distancia: CAMERA.aproximada.distancia, altura: CAMERA.aproximada.altura, olharY: 0.6, limX: MX - 3, limZ0: -MZ + 3, limZ1: MZ - 2, retrato: 0 };
  const fovParaDe = (a, peq) => p => {   // a conta de camera.js fovPara (paisagem)
    let larg = p.largura;
    if (a < 16 / 9) larg *= Math.sqrt(Math.max(a, 1.25) / (16 / 9));
    if (peq) larg *= CAMERA.telaPequena;
    return (2 * Math.atan(larg / 2 / Math.hypot(p.distancia, p.altura - p.olharY) / a) * 180) / Math.PI;
  };
  const nova = () => ({ de: [0, 0, 0], para: [0, 0, 0], fov: 0 });
  const fat = [0, 5, 10, 15, 20];
  // A3: continuidade — o foco andando de 0,05 em 0,05 m pela faixa toda: a câmera anda ≤ 0,6 m (o degrau de 0,5 m da subida
  // por cima do travessão é o único salto que sobra). Contraprova: o limite antigo da caixa de cá (a borda mais perto)
  const limiteAntigo = (m, p) => {
    const S = CL.SEGURANCA, d = p.de;
    if (!['tv', 'aproximada', 'ampla', 'alta'].includes(m)) return CL.segurarPose(m, p);
    if (d[2] > S.zCaMax) d[2] = S.zCaMax;
    if (d[2] > S.zCa && d[1] > S.yCa) { if (d[1] - S.yCa > d[2] - S.zCa) d[2] = S.zCa; else d[1] = S.yCa; }
    return p;
  };
  const saltos = segura => {
    let pior = 0, onde = '';
    for (const [asp, peq] of [[16 / 9, false], [844 / 390, true]]) for (const a of fat) for (const dd of fat) {
      const fa = CL.fatorAjuste(a), fd = CL.fatorAjuste(dd);
      for (const m of CL.CAMERAS_LIVRE) {
        const lado = !['atras', 'jogador'].includes(m);
        const Pf = m === 'tv' ? (peq ? TVC : TV) : m === 'aproximada' ? AP : CL.PERFIS_LIVRE[m];
        const L = m === 'ampla' || m === 'alta' ? CL.limitesLateral(Pf, fd) : Pf;
        const linhas = lado ? [0, L.limX] : [0, 30, -30];
        for (const fixo of linhas) for (const dir of lado ? [1] : [1, -1]) {
          let ant = null;
          const ini = lado ? L.limZ0 : -(MX - 4), fimF = lado ? L.limZ1 : MX - 4;
          for (let v = ini; v <= fimF + 1e-9; v += 0.05) {
            const p = nova();
            if (lado) CL.poseLateral(Pf, fixo, v, fa, fd, asp, peq, p, m === 'tv' || m === 'aproximada' ? fovParaDe(asp, peq) : null);
            else CL.poseComprimento(m, v, fixo, dir, fa, fd, asp, p);
            segura(m, p);
            if (ant) { const sl = Math.hypot(p.de[0] - ant[0], p.de[1] - ant[1], p.de[2] - ant[2]); if (sl > pior) { pior = sl; onde = `${m} altura ${a} distância ${dd} ${lado ? `z ${v.toFixed(2)}` : `x ${v.toFixed(2)}`}`; } }
            ant = p.de;
          }
        }
      }
    }
    return { pior, onde };
  };
  const c = saltos(CL.segurarPose), c0 = saltos(limiteAntigo);
  meta('A3 a câmera não pula: o foco andando de 0,05 em 0,05 m (6 câmeras × Altura/Distância 0–20 × 2 telas), a câmera anda ≤ 0,6 m; contraprova: o limite antigo da caixa de cá (a borda mais perto) pula',
    `maior passo ${c.pior.toFixed(2)} m (${c.onde}); com o limite antigo ${c0.pior.toFixed(1)} m (${c0.onde})`, c.pior <= 0.6 && c0.pior > 2);

  // A4: a bola e o controlado (pés e cabeça) dentro das margens do quadro (QUADRO: acima do minimapa do PC) nas bordas do campo,
  // nos dois rumos — a pequena área e os cantos do MEU lado (escanteio contra, tiro de meta), as laterais, o outro gol
  const camFalsa = () => {
    const c = { fov: 30, aspect: 16 / 9, pos: [0, 0, 0], alvo: [0, 0, 0], updateProjectionMatrix() {}, lookAt(x, y, z) { c.alvo = [x, y, z]; } };
    c.position = { set(x, y, z) { c.pos = [x, y, z]; } };
    return c;
  };
  const ndc = (c, x, y, z) => {
    const f = [c.alvo[0] - c.pos[0], c.alvo[1] - c.pos[1], c.alvo[2] - c.pos[2]], lf = Math.hypot(...f); f[0] /= lf; f[1] /= lf; f[2] /= lf;
    const r = [-f[2], 0, f[0]], lr = Math.hypot(r[0], r[2]); r[0] /= lr; r[2] /= lr;
    const u = [-r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1]];
    const d = [x - c.pos[0], y - c.pos[1], z - c.pos[2]], zz = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    const tv = Math.tan(c.fov * Math.PI / 360);
    return [(d[0] * r[0] + d[2] * r[2]) / zz / (tv * c.aspect), (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / zz / tv, zz];
  };
  const Q = CL.QUADRO, eps = 0.02;
  let casos = 0; const falhas = [];
  for (const [asp, peq] of [[16 / 9, false], [844 / 390, true]]) for (const dir of [1, -1]) {
    const lugares = [[-dir * 51, 0], [-dir * 47, 8], [-dir * 52, 33], [-dir * 52, -33], [0, 32], [0, -32], [dir * 40, 32], [-dir * 40, -32], [dir * 51, 0], [dir * 52, 33], [0, 0]];
    for (const a of fat) for (const dd of fat) for (const m of CL.CAMERAS_LIVRE) for (const [x, z] of lugares) {
      casos++;
      const cam = CL.criarCameraLivre({ dir: () => dir });
      cam.definirAjuste({ altura: a, distancia: dd });
      const camera = camFalsa();
      const Pf = m === 'tv' ? (peq ? TVC : TV) : AP;
      const est = { modo: m, aspecto: asp, pequena: peq, x: Math.max(-Pf.limX, Math.min(Pf.limX, x)), z: Math.max(Pf.limZ0, Math.min(Pf.limZ1, z)) };
      const bx = x + 0.35 * dir;
      const alvo = { jx: x, jz: z, jvx: 0, jvz: 0, bx, bz: z, ax: NaN, az: NaN };
      cam.atualizar(1 / 60, alvo, true, { camera, est, p: Pf, fovPara: fovParaDe(asp, peq) });
      camera.aspect = asp;
      const b = ndc(camera, bx, 0.11, z), pe = ndc(camera, x, 0, z), cab = ndc(camera, x, 1.8, z);
      const ok = b[2] > 0 && Math.abs(b[0]) <= Q.x + eps && b[1] <= Q.cima + eps && b[1] >= Q.baixo - eps
        && pe[2] > 0 && Math.abs(pe[0]) <= Q.x + eps && pe[1] >= Q.baixo - eps && cab[2] > 0 && Math.abs(cab[0]) <= Q.x + eps && cab[1] <= Q.cima + eps;
      if (!ok && falhas.length < 400) falhas.push(`${m} ${peq ? 'celular' : 'PC'} rumo ${dir} altura ${a} distância ${dd} (${x}, ${z}): bola ${b[0].toFixed(2)}/${b[1].toFixed(2)}, pés ${pe[0].toFixed(2)}/${pe[1].toFixed(2)}`);
    }
  }
  meta('A4 a bola e o controlado (pés e cabeça) no quadro, acima do minimapa (6 câmeras × Altura/Distância 0–20 × 2 telas × 2 rumos × a pequena área e os cantos do meu lado, as laterais, o outro gol)',
    `${casos} casos, ${falhas.length} fora${falhas.length ? ': ' + falhas.slice(0, 4).join(' | ') : ''}`, falhas.length === 0 && casos > 5000);

  // A5: Jogador — a troca de controlado para longe (a 25 m) corta: o novo no quadro já no quadro seguinte
  {
    const cam = CL.criarCameraLivre({ dir: () => 1 });
    const camera = camFalsa();
    const est = { modo: 'jogador', aspecto: 16 / 9, pequena: false, x: 0, z: 0 };
    const I = { camera, est, p: TV, fovPara: fovParaDe(16 / 9, false) };
    const alvo = { jx: -10, jz: 5, jvx: 0, jvz: 0, bx: -9.6, bz: 5, ax: NaN, az: NaN };
    for (let i = 0; i < 60; i++) cam.atualizar(1 / 60, alvo, i === 0, I);
    Object.assign(alvo, { jx: 12, jz: -8, bx: 12.4, bz: -8 });
    cam.atualizar(1 / 60, alvo, false, I);
    camera.aspect = 16 / 9;
    const pe = ndc(camera, 12, 0, -8), cortes = cam.resumo().cortesJogador;
    // e a troca para perto (a 5 m) segue pela mola (sem corte)
    Object.assign(alvo, { jx: 15, jz: -4, bx: 15.4, bz: -4 });
    cam.atualizar(1 / 60, alvo, false, I);
    const cortes2 = cam.resumo().cortesJogador;
    meta('A5 Jogador: a troca de controlado para longe (25 m) corta e o novo fica no quadro no quadro seguinte; para perto (5 m) segue pela mola',
      `${cortes} corte(s); o novo em ${pe[0].toFixed(2)}/${pe[1].toFixed(2)}; troca para perto: ${cortes2 - cortes} corte(s)`,
      cortes === 1 && pe[2] > 0 && Math.abs(pe[0]) <= 1 && Math.abs(pe[1]) <= 1 && cortes2 === cortes);
  }
}

// ------------------------------------------------------------------ navegador
const srv = await servidor(0, RAIZ);
const pronta = pg => pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
const quadros = (pg, n, desenhar = false) => pg.evaluate(([n, d]) => { const g = window.__golaco; for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: d && i === n - 1 }); }, [n, desenhar]);
/** Conferências de uma câmera no quadro de agora (desenhado aqui). */
const MEDIR = async () => {
  const g = window.__golaco;
  const CLp = await import('./js/render/camera-livre.js');
  g.desenhar();
  const cv = document.querySelector('canvas'), W = innerWidth, H = innerHeight;
  const off = document.createElement('canvas'); off.width = Math.round(W / 2); off.height = Math.round(H / 2);
  const cx = off.getContext('2d', { willReadFrequently: true });
  cx.drawImage(cv, 0, 0, off.width, off.height);
  const d = cx.getImageData(0, 0, off.width, off.height).data;
  const ehGrama = (r, gg, b) => gg > 28 && gg > r * 1.12 && gg > b * 1.2;
  let escuro = 0, grama = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] < 24) escuro++; if (ehGrama(d[i], d[i + 1], d[i + 2])) grama++; }
  const n = d.length / 4;
  const dentro = p => !p.atras && p.x >= 1 && p.x <= W - 1 && p.y >= 1 && p.y <= H - 1;
  // pontos do gramado à vista (fora das linhas): a cor é de grama — uma arquibancada/cobertura na frente mostraria outra
  let pts = 0, ptsG = 0;
  for (let x = -49.3; x <= 50; x += 3.3) for (let z = -32.4; z <= 33; z += 3.3) {
    const p = g.naTela(x, 0.02, z);
    if (!dentro(p)) continue;
    pts++;
    const k = (Math.min(off.height - 1, Math.floor(p.y / 2)) * off.width + Math.min(off.width - 1, Math.floor(p.x / 2))) * 4;
    if (ehGrama(d[k], d[k + 1], d[k + 2])) ptsG++;
  }
  const e = g.estado(), R = g.render, j = e.jogador, b = e.bola;
  const cam = R.camera;
  return {
    camera: g.camera, livre: g.livre.camera, escuro: escuro / n, grama: grama / n, pts, ptsGrama: pts ? ptsG / pts : 0,
    bola: dentro(g.naTela(b.x, b.y + 0.11, b.z)),
    controlado: !!j && [0.05, 1, 1.8].every(y => dentro(g.naTela(j.x, y, j.z))),
    distControlado: j ? Math.hypot(cam.x - j.x, cam.y - 1.2, cam.z - j.z) : NaN,
    bloqueada: CLp.poseBloqueada(cam.x, cam.y, cam.z), cam: [cam.x, cam.y, cam.z].map(v => +v.toFixed(1)),
    chamadas: e.desenhoChamadas, tri: e.desenhoTriangulos,
  };
};
/** Escolhe a câmera pela pausa: abre, Câmera, o botão dela, Voltar, Continuar. */
const pelaPausa = (pg, c) => pg.evaluate(c => {
  const g = window.__golaco;
  g.abrirMenu();
  document.getElementById('btn-livre-camera').click();
  const sub = document.getElementById('menu-camera-livre');
  const vis = !sub.hidden && sub.offsetParent !== null;
  sub.querySelector(`[data-cmd="livre-cam"][data-valor="${c}"]`).click();
  const marcado = sub.querySelector('[aria-pressed="true"]')?.dataset.valor;
  sub.querySelector('[data-cmd="livre-voltar"]').click();
  document.getElementById('btn-continuar').click();
  return { vis, marcado, aberto: g.estado().menuAberto };
}, c);
const conferirCameras = async (pg, rot) => {
  const linhas = []; let ok = true; const custo = {};
  for (const c of CL.CAMERAS_LIVRE) {
    await pg.evaluate(() => window.__golaco.livre.recomecar('pe'));
    await quadros(pg, 3);
    const pp = await pelaPausa(pg, c);
    await quadros(pg, 48);
    const m = await pg.evaluate(MEDIR);
    custo[c] = [m.chamadas, m.tri];
    const bom = pp.vis && pp.marcado === c && !pp.aberto && m.camera === c && m.escuro < 0.3 && m.bola && m.controlado && !m.bloqueada && m.distControlado >= 3
      && m.pts >= 20 && m.ptsGrama >= 0.8 && m.grama >= 0.2;
    if (!bom) ok = false;
    linhas.push(`${CL.NOME_CAMERA[c]}${bom ? '' : ' [FALHOU]'}: grama ${(m.grama * 100).toFixed(0)}% da tela, ${(m.ptsGrama * 100).toFixed(0)}% de ${m.pts} pontos do gramado com cor de grama, bola ${m.bola ? 'sim' : 'NÃO'}, controlado ${m.controlado ? 'sim' : 'NÃO'} a ${m.distControlado.toFixed(1)} m, câmera ${m.cam.join('/')}${m.bloqueada ? ' DENTRO DE SÓLIDO' : ''}${pp.marcado !== c ? ` (marcado ${pp.marcado})` : ''}${pp.aberto ? ' (pausa aberta)' : ''}`);
  }
  return { ok, texto: `${rot}: ${linhas.join('; ')}`, custo };
};

// ------------------------------------------------------------------ a pausa (B, D, E, F)
/** A pausa como está: rola (px), as linhas visíveis da lista aberta, os textos, encostos entre os botões à vista. */
const PAUSA = () => {
  const j = document.querySelector('.janela-menu');
  const lista = [...document.querySelectorAll('#menu .menu-acoes')].find(e => !e.hidden);
  const vis = e => !!e && !e.hidden && e.offsetParent !== null && e.getBoundingClientRect().height > 0;
  const filhos = lista ? [...lista.children].filter(vis) : [];
  const botoes = [...document.querySelectorAll('#menu button')].filter(vis);
  const enc = [];
  for (let a = 0; a < botoes.length; a++) for (let b = a + 1; b < botoes.length; b++) {
    const A = botoes[a], B = botoes[b];
    if (A.contains(B) || B.contains(A)) continue;
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    const gap = Math.max(rb.left - ra.right, ra.left - rb.right, rb.top - ra.bottom, ra.top - rb.bottom);
    if (gap < 2) enc.push(`${A.textContent.trim().slice(0, 14)} × ${B.textContent.trim().slice(0, 14)}`);
  }
  // (cortado: o botão, o nome das linhas do Livre — "Meu time", "Adversário", "Altura", "Distância" — e os subtítulos
  // <small> dos botões, que cortam com reticências)
  const textos = [...botoes, ...[...document.querySelectorAll('#menu .livre-rotulo, #menu button small')].filter(vis)];
  const cortados = textos.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim().slice(0, 16));
  const jr = j.getBoundingClientRect();
  const fora = botoes.filter(b => { const r = b.getBoundingClientRect(); return r.right > jr.right + 0.5 || r.left < jr.left - 0.5; }).map(b => b.textContent.trim().slice(0, 14));
  return {
    rola: j.scrollHeight - j.clientHeight, id: lista?.id, linhas: filhos.length, textos: filhos.map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    encosta: enc, cortados, fora,
  };
};
const okPausa = p => p.rola <= 0 && p.linhas <= 5 && p.encosta.length === 0 && p.cortados.length === 0 && p.fora.length === 0;
const txtPausa = p => `rola ${p.rola} px, ${p.linhas} linhas [${p.textos.join(' / ')}]${p.encosta.length ? '; ENCOSTA: ' + p.encosta.slice(0, 3).join(', ') : ''}${p.cortados.length ? '; CORTADO: ' + p.cortados.join(', ') : ''}${p.fora.length ? '; FORA: ' + p.fora.join(', ') : ''}`;

// ------------------------------------------------------------------ B e C: PC 1280×720, Alta, de dia
{
  const s = await abrir({ largura: 1280, altura: 720 });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=livre&q=alta&hora=dia&replay=0&comemoracao=0&semente=5`, { waitUntil: 'load' });
  await pronta(pg);
  const ini = await pg.evaluate(() => {
    const g = window.__golaco, vis = id => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; };
    return { modo: g.mundo.modo, menu: g.estado().menuAberto, jogadores: vis('menu-livre'), jogar: vis('btn-livre-jogar'), acoes: vis('menu-acoes'), camera: g.camera, yaw: g.livre.camera.yaw };
  });
  meta('B0 PC: ?modo=livre abre a pausa no submenu Jogadores com o "Jogar" (o mundo "livre"; câmera TV sem escolha salva)',
    `modo ${ini.modo}, pausa ${ini.menu ? 'aberta' : 'FECHADA'}, Jogadores ${ini.jogadores ? 'à vista' : 'NÃO'}, Jogar ${ini.jogar ? 'à vista' : 'NÃO'}, ações ${ini.acoes ? 'À VISTA' : 'escondidas'}, câmera ${ini.camera}`,
    ini.modo === 'livre' && ini.menu && ini.jogadores && ini.jogar && !ini.acoes && ini.camera === 'tv');
  {
    const P = PAUSA.toString().replace(/^/, '(') + ')';
    const jog = await pg.evaluate(P => eval(P)(), P);
    const modos = await pg.evaluate(P => { document.querySelector('#menu-livre [data-cmd="livre-voltar"]').click(); document.getElementById('btn-modos').click(); const r = eval(P)(); document.querySelector('#menu-modos [data-cmd="modos-voltar"]').click(); document.getElementById('btn-livre-jogadores').click(); return r; }, P);
    meta('B0b PC 1280×720: o submenu Jogadores ("Meu time", "Adversário" inteiros) e o Modo de jogo (os subtítulos dos treinos) sem nada cortado nem encostando',
      `Jogadores: ${txtPausa(jog)} · Modo de jogo: ${txtPausa(modos)}`, okPausa(jog) && jog.id === 'menu-livre' && okPausa(modos) && modos.id === 'menu-modos');
  }
  await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); document.getElementById('btn-livre-jogar').click(); });
  await quadros(pg, 60);
  const B = await conferirCameras(pg, 'PC Alta, dia');
  meta('B1 PC Alta, dia: as 6 câmeras escolhidas pela pausa — quadro não vazio, a bola e o controlado no quadro, câmera fora de sólido e a ≥ 3 m do controlado, ≥ 80% dos pontos do gramado à vista com cor de grama, ≥ 20% de grama na tela', B.texto, B.ok);

  // C: a tecla C cicla pelas 6 (com o aviso de comando)
  await pg.evaluate(() => window.__golaco.definirCamera('tv'));
  await quadros(pg, 2);
  const ciclo = [];
  let avisos = new Set();
  for (let i = 0; i < 6; i++) {
    await pg.keyboard.press('KeyC');
    await quadros(pg, 2);
    const v = await pg.evaluate(() => ({ c: window.__golaco.camera, aviso: document.getElementById('aviso')?.textContent?.trim() ?? '' }));
    ciclo.push(v.c); if (v.aviso) avisos.add(v.aviso);
  }
  meta('C1 PC: a tecla C passa pelas 6 câmeras do Livre e volta à TV, com o aviso "Câmera: …"',
    `${ciclo.join(' → ')}; avisos [${[...avisos].join(' | ')}]`,
    ciclo.join() === 'aproximada,ampla,alta,atras,jogador,tv' && [...avisos].some(a => /^Câmera: /.test(a)));

  // C2: o rumo do analógico — para cima = para o gol que eu ataco (Atrás, Jogador); na TV, para o lado de lá
  const anda = async c => {
    // (um lance limpo: a saída põe cada um no seu lugar, os adversários a ≥ 9,15 m, e a bola no pé rolando — o "onde estou"
    // de antes dependia de onde o jogo tinha deixado a marcação: com a IA contra a pessoa marcando colada, categoria D, o
    // controlado começava de costas com dois adversários a 1 m, perdia a bola no giro e andava 1,5 m preso entre eles)
    await pg.evaluate(c => { const g = window.__golaco; g.definirCamera(c); g.livre.recomecar('meio'); }, c);
    await quadros(pg, 2);
    await pg.evaluate(() => window.__golaco.livre.recomecar('pe'));
    await quadros(pg, 30);
    const a = await pg.evaluate(() => ({ ...window.__golaco.estado().jogador, dir: window.__golaco.mundo.ataca[0], yaw: window.__golaco.livre.camera.yaw }));
    await pg.keyboard.down('ArrowUp');
    await quadros(pg, 60);
    await pg.keyboard.up('ArrowUp');
    const b = await pg.evaluate(() => window.__golaco.estado().jogador);
    // o rumo pedido no chão (para onde o corpo vira) e o quanto andou nele (a bola pode ter sido roubada no caminho)
    const alvo = c === 'tv' ? -Math.PI / 2 : a.dir > 0 ? 0 : Math.PI;
    const dif = Math.abs(Math.atan2(Math.sin(b.rumo - alvo), Math.cos(b.rumo - alvo)));
    const anda = (b.x - a.x) * Math.cos(alvo) + (b.z - a.z) * Math.sin(alvo);
    return { c, dx: b.x - a.x, dz: b.z - a.z, dir: a.dir, yaw: a.yaw, mesmo: a.id === b.id, dif, anda };
  };
  const rumos = [];
  for (const c of ['atras', 'jogador', 'tv']) rumos.push(await anda(c));
  const okRumo = rumos.every(r => r.mesmo && r.dif < 0.35 && r.anda >= 1.5 && (r.c === 'tv' ? Math.abs(r.yaw + Math.PI / 2) < 1e-6 : Math.abs(r.yaw - (r.dir > 0 ? 0 : Math.PI)) < 1e-6));
  meta('C2 PC: Atrás e Jogador com o rumo do ataque do meu time (yaw 0 ou π): o analógico para cima vira e leva o controlado para o gol que eu ataco (na TV, para o lado de lá)',
    rumos.map(r => `${CL.NOME_CAMERA[r.c]}: yaw ${r.yaw.toFixed(2)}, ataque ${r.dir > 0 ? '+x' : '−x'}, corpo a ${(r.dif * 180 / Math.PI).toFixed(0)}° do rumo pedido, andou ${r.anda.toFixed(1)} m nele (Δx ${r.dx.toFixed(1)}, Δz ${r.dz.toFixed(1)})${r.mesmo ? '' : ' (TROCOU de controlado)'}`).join('; '), okRumo);

  // C3: transição (mesmo rumo) e corte (rumo diferente)
  const tr = await pg.evaluate(() => {
    const g = window.__golaco, r = {};
    g.definirCamera('tv'); for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    g.definirCamera('ampla'); g.relogio.avancar(1000 / 60, { desenhar: false });
    r.ampla = g.livre.camera;
    for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    r.amplaFim = g.livre.camera;
    g.definirCamera('atras'); g.relogio.avancar(1000 / 60, { desenhar: false });
    r.atras = g.livre.camera;
    return r;
  });
  meta('C3 PC: TV → Ampla com transição de 0,6 s (mesmo rumo) e Ampla → Atrás com corte (rumo diferente)',
    `TV → Ampla: de ${tr.ampla.anterior} a ${(tr.ampla.transicao * 100).toFixed(0)}% no 1º quadro, ${tr.amplaFim.anterior == null ? 'terminada' : 'AINDA'} em 1 s; Ampla → Atrás: ${tr.atras.anterior == null ? 'corte' : `transição de ${tr.atras.anterior}`}`,
    tr.ampla.anterior === 'tv' && tr.ampla.transicao < 0.2 && tr.amplaFim.anterior == null && tr.atras.anterior == null && tr.atras.transicao === 1);

  // B2–B3 (revisão de 16/10), 1 de linha contra só o goleiro (ninguém tira a bola no meio da medida), Altura/Distância 10:
  //   B2 os cantos do lado de cá fechados no Livre (render/cantos-livre.js): Atrás e Jogador olham pelo comprimento e
  //      mostravam o vão entre o fundo e a arquibancada de cá — céu, o chão verde de fora, o mastro (antes: céu 2,1–2,3% da
  //      tela em média e 4,1% no pior lugar; depois ~0%);
  //   B3 com a bola no pé do controlado na pequena área e nos cantos do MEU gol (o escanteio contra, o tiro de meta), a bola
  //      e o controlado no quadro e a bola acima do minimapa (≤ 87% da altura) em Atrás, Jogador e TV (antes, em Atrás, a
  //      bola a 130–140% da altura: fora)
  {
    await pg.evaluate(() => { const g = window.__golaco; g.livre.ajustar({ linha: [1, 0], goleiro: [false, true] }); g.livre.ajustarCamera({ altura: 10, distancia: 10 }); });
    await quadros(pg, 20);
    const dir = await pg.evaluate(() => window.__golaco.mundo.ataca[0]);
    const lugar = async (c, x, z) => {
      await pg.evaluate(([c, x, z]) => {
        const g = window.__golaco;
        g.definirCamera(c);
        const j = g.mundo.jogadores.find(o => o.id === g.estado().jogador.id);
        j.x = x; j.z = z; j.vx = 0; j.vz = 0;
        g.livre.recomecar('pe');
      }, [c, x, z]);
      await quadros(pg, 70, true);
      return pg.evaluate(() => {
        const g = window.__golaco;
        g.desenhar();
        const cv = document.querySelector('canvas'), W = innerWidth, H = innerHeight;
        const off = document.createElement('canvas'); off.width = Math.round(W / 2); off.height = Math.round(H / 2);
        const cx = off.getContext('2d', { willReadFrequently: true });
        cx.drawImage(cv, 0, 0, off.width, off.height);
        const d = cx.getImageData(0, 0, off.width, off.height).data;
        let ceu = 0;
        // céu de dia: azul-claro (o azul passa o vermelho e o verde, claro)
        for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (b > r + 15 && b >= gg && r + gg + b > 420) ceu++; }
        const e = g.estado(), j = e.jogador, bo = e.bola;
        const dentro = p => !p.atras && p.x >= 1 && p.x <= W - 1 && p.y >= 1 && p.y <= H - 1;
        const pb = g.naTela(bo.x, bo.y + 0.11, bo.z);
        return { ceu: ceu / (d.length / 4), bola: dentro(pb), bolaY: pb.y / H, ctrl: !!j && [0.05, 1, 1.8].every(y => dentro(g.naTela(j.x, y, j.z))) };
      });
    };
    const ceu = {}, cantos = await pg.evaluate(() => window.__golaco.livre.cantos);
    for (const c of ['atras', 'jogador']) {
      const v = [];
      for (const x of [0, 20, 40]) for (const z of [0, 15, 28]) v.push((await lugar(c, x * dir, z)).ceu);
      ceu[c] = { media: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v) };
    }
    meta('B2 PC: os cantos do lado de cá fechados no Livre — Atrás e Jogador no campo de ataque (9 lugares) com céu ≤ 0,8% da tela em média e ≤ 1,2% no pior lugar (antes 2,1% em Atrás e 2,3% no Jogador, 4,1% no pior lugar: o vão do canto)',
      `cantos ${cantos == null ? 'NÃO estão na cena' : cantos ? 'na cena' : 'ESCONDIDOS'}; ${['atras', 'jogador'].map(c => `${CL.NOME_CAMERA[c]}: céu ${(100 * ceu[c].media).toFixed(2)}% (pior ${(100 * ceu[c].max).toFixed(2)}%)`).join('; ')}`,
      cantos === true && ['atras', 'jogador'].every(c => ceu[c].media <= 0.008 && ceu[c].max <= 0.012));
    const lin = []; let okB3 = true;
    for (const c of ['atras', 'jogador', 'tv']) for (const [x, z] of [[-51 * dir, 0], [-47 * dir, 8], [-52 * dir, 33], [-52 * dir, -33]]) {
      const m = await lugar(c, x, z);
      const ok = m.bola && m.ctrl && m.bolaY <= 0.87;
      if (!ok) okB3 = false;
      lin.push(`${CL.NOME_CAMERA[c]} (${x}, ${z}): bola ${m.bola ? `a ${(100 * m.bolaY).toFixed(0)}%` : 'FORA'}, controlado ${m.ctrl ? 'sim' : 'NÃO'}`);
    }
    meta('B3 PC: a bola no pé na pequena área e nos cantos do meu gol — a bola e o controlado no quadro e a bola acima do minimapa (≤ 87% da altura) em Atrás, Jogador e TV', lin.join('; '), okB3);
    await pg.evaluate(() => window.__golaco.livre.ajustar({ linha: [4, 4], goleiro: [true, true] }));
    await quadros(pg, 5);
  }

  // C4: Altura e Distância pela pausa (−/+), salvas; recarregar volta com a câmera e o ajuste
  const aj = await pg.evaluate(() => {
    const g = window.__golaco, av = n => { for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); };
    g.definirCamera('alta'); g.livre.recomecar('pe'); av(60);
    const c0 = { ...g.render.camera };
    g.abrirMenu(); document.getElementById('btn-livre-camera').click();
    const sub = document.getElementById('menu-camera-livre'), bt = (c, k) => sub.querySelector(`[data-cmd="${c}"][data-valor="${k}"]`);
    for (let i = 0; i < 4; i++) bt('livre-ajuste-mais', 'altura').click();
    const r = { altura: document.getElementById('livre-ajuste-altura').textContent };
    document.getElementById('btn-continuar').click();
    av(60);
    const c1 = { ...g.render.camera };
    g.abrirMenu(); document.getElementById('btn-livre-camera').click();
    for (let i = 0; i < 5; i++) bt('livre-ajuste-menos', 'distancia').click();
    r.distancia = document.getElementById('livre-ajuste-distancia').textContent;
    document.getElementById('btn-continuar').click();
    av(60);
    const c2 = { ...g.render.camera }, j = g.estado().jogador;
    const dist = c => Math.hypot(c.x - j.x, c.z - j.z);
    let prefs = null; try { prefs = JSON.parse(localStorage.getItem('golaco.prefs.v1')); } catch (_) { /* */ }
    return { ...r, y0: c0.y, y1: c1.y, d1: dist(c1), d2: dist(c2), prefs: prefs ? { cameraLivre: prefs.cameraLivre, cameraAjuste: prefs.cameraAjuste, camera: prefs.camera ?? null } : null, resumo: g.livre.camera };
  });
  await pg.reload({ waitUntil: 'load' });
  await pronta(pg);
  const volta = await pg.evaluate(() => ({ camera: window.__golaco.camera, ajuste: window.__golaco.livre.camera }));
  meta('C4 PC: Altura +4 sobe a câmera e Distância −5 aproxima (a Alta); a escolha fica salva (prefs: cameraLivre, cameraAjuste) e volta ao recarregar',
    `Altura ${aj.altura}: y ${aj.y0.toFixed(1)} → ${aj.y1.toFixed(1)} m; Distância ${aj.distancia}: ${aj.d1.toFixed(1)} → ${aj.d2.toFixed(1)} m do controlado no chão; prefs ${JSON.stringify(aj.prefs)}; recarregada: câmera ${volta.camera}, Altura ${volta.ajuste.altura}, Distância ${volta.ajuste.distancia}`,
    aj.altura === '14' && aj.distancia === '5' && aj.y1 > aj.y0 + 3 && aj.d2 < aj.d1 - 2 && aj.prefs?.cameraLivre === 'alta' && aj.prefs?.cameraAjuste?.altura === 14 && aj.prefs?.cameraAjuste?.distancia === 5
      && volta.camera === 'alta' && volta.ajuste.altura === 14 && volta.ajuste.distancia === 5);

  // C6: o −/+ no limite (Altura 20, Meu time 11) fica apagado sem perder o foco (o controle navegando a pausa): com
  //   `disabled` o foco ia para o <body> e a cruz voltava ao 1º botão da pausa; e o aperto a mais não muda nada
  const lim = await pg.evaluate(() => {
    const g = window.__golaco;
    g.abrirMenu(); document.getElementById('btn-livre-camera').click();
    const sub = document.getElementById('menu-camera-livre'), mais = sub.querySelector('[data-cmd="livre-ajuste-mais"][data-valor="altura"]');
    mais.focus();
    for (let i = 0; i < 9; i++) mais.click();
    const r = { altura: document.getElementById('livre-ajuste-altura').textContent, focoA: document.activeElement === mais, apagadoA: mais.getAttribute('aria-disabled') };
    sub.querySelector('[data-cmd="livre-voltar"]').click();
    document.getElementById('btn-livre-jogadores').click();
    const mm = document.querySelector('#menu-livre [data-cmd="livre-mais"][data-valor="meu"]');
    mm.focus();
    for (let i = 0; i < 12; i++) mm.click();
    r.meu = document.getElementById('livre-n-meu').textContent; r.focoM = document.activeElement === mm; r.apagadoM = mm.getAttribute('aria-disabled');
    for (let i = 0; i < 6; i++) document.querySelector('#menu-livre [data-cmd="livre-menos"][data-valor="meu"]').click();
    document.getElementById('btn-livre-jogar').click();
    return r;
  });
  meta('C6 PC: o −/+ no limite (Altura 20, Meu time 11) fica apagado com o foco nele (o controle não perde a posição na pausa) e o aperto a mais não muda o número',
    `Altura ${lim.altura} (foco ${lim.focoA ? 'no +' : 'PERDIDO'}, apagado ${lim.apagadoA}); Meu time ${lim.meu} (foco ${lim.focoM ? 'no +' : 'PERDIDO'}, apagado ${lim.apagadoM})`,
    lim.altura === '20' && lim.focoA && lim.apagadoA === 'true' && lim.meu === '11' && lim.focoM && lim.apagadoM === 'true');
  await quadros(pg, 5);

  // C5: na partida (Modo de jogo) a câmera volta a ser a da partida; o segmentado TV | Aproximada de volta
  const part = await pg.evaluate(async () => {
    const g = window.__golaco;
    g.abrirMenu();
    document.getElementById('btn-modos').click();
    document.querySelector('#menu-modos [data-cmd="modo"][data-valor="partida"]').click();
    for (let i = 0; i < 40 && g.mundo.modo !== 'partida'; i++) await new Promise(r => setTimeout(r, 50));
    g.abrirMenu();
    const vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none';
    const r = { modo: g.mundo.modo, camera: g.camera, seg: vis(document.querySelector('.segmentado[data-grupo="camera"]')), botao: vis(document.getElementById('opcao-camera-livre')), livre: vis(document.getElementById('btn-livre-camera')), cantos: g.livre.cantos };
    g.fecharMenu();
    return r;
  });
  meta('C5 PC: de volta à partida (Modo de jogo), a câmera é a da partida (TV/Aproximada), com o TV | Aproximada na pausa, sem os botões do Livre e sem os cantos dele',
    `modo ${part.modo}, câmera ${part.camera}, segmentado ${part.seg ? 'à vista' : 'ESCONDIDO'}, botão da câmera do Livre ${part.botao ? 'À VISTA' : 'escondido'}, Jogadores | Câmera ${part.livre ? 'À VISTA' : 'escondido'}, cantos ${part.cantos ? 'À VISTA' : 'escondidos'}`,
    part.modo === 'partida' && ['tv', 'aproximada'].includes(part.camera) && part.seg && !part.botao && !part.livre && part.cantos !== true);
  meta('G1 PC: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  errosTodos.push(...s.erros);
  await s.navegador.close();
}

// ------------------------------------------------------------------ D: celular 844×390, Média, de noite
{
  const s = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=livre&q=media&hora=noite&toque=1&entalhe=1&replay=0&comemoracao=0&semente=7`, { waitUntil: 'load' });
  await pronta(pg);
  const jog = await pg.evaluate(PAUSA);
  const acoes = await pg.evaluate(P => { document.querySelector('#menu-livre [data-cmd="livre-voltar"]').click(); return eval(P)(); }, PAUSA.toString().replace(/^/, '(') + ')');
  const cam = await pg.evaluate(P => { document.getElementById('btn-livre-camera').click(); const r = eval(P)(); r.botoes = [...document.querySelectorAll('#menu-camera-livre [data-cmd="livre-cam"]')].map(b => b.textContent.trim()); document.querySelector('#menu-camera-livre [data-cmd="livre-voltar"]').click(); return r; }, PAUSA.toString().replace(/^/, '(') + ')');
  const modos = await pg.evaluate(P => { document.getElementById('btn-modos').click(); const r = eval(P)(); r.livre = document.getElementById('btn-modo-livre')?.textContent.replace(/\s+/g, ' ').trim(); document.querySelector('#menu-modos [data-cmd="modos-voltar"]').click(); return r; }, PAUSA.toString().replace(/^/, '(') + ')');
  const opc = await pg.evaluate(() => {
    const vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none';
    const b = document.getElementById('opcao-camera-livre');
    return { botao: vis(b), texto: b?.textContent.trim(), seg: vis(document.querySelector('.segmentado[data-grupo="camera"]')) };
  });
  const textos = acoes.textos.join(' / ');
  meta('D1 celular 844×390: a pausa do Livre — Continuar | Replay; Jogadores | Câmera; Recomeçar | Bola no meu pé; Modo de jogo; Ajuda (sem Editar time nem Reiniciar) — sem rolar, nada encosta nem fica cortado',
    txtPausa(acoes), okPausa(acoes) && acoes.linhas === 5 && /Jogadores.*Câmera/.test(textos) && /Recomeçar.*Bola no meu pé/.test(textos) && /Modo de jogo/.test(textos) && /Ajuda/.test(textos) && !/Editar time|Reiniciar/.test(textos));
  meta('D2 celular 844×390: os submenus Jogadores, Câmera (as 6 câmeras, Altura, Distância) e Modo de jogo (com "Modo Livre N contra M") sem rolar, nada encosta nem fica cortado',
    `Jogadores: ${txtPausa(jog)} · Câmera: ${txtPausa(cam)} (botões ${cam.botoes.join(', ')}) · Modo de jogo: ${txtPausa(modos)} ("${modos.livre}")`,
    okPausa(jog) && jog.id === 'menu-livre' && okPausa(cam) && cam.id === 'menu-camera-livre' && cam.botoes.length === 6 && /Altura/.test(cam.textos.join()) && /Distância/.test(cam.textos.join())
      && okPausa(modos) && /^Modo Livre \d+ contra \d+$/.test(modos.livre ?? ''));
  meta('D3 celular: na coluna das opções o nome da câmera (abre o submenu Câmera) no lugar do TV | Aproximada',
    `botão ${opc.botao ? `à vista ("${opc.texto}")` : 'NÃO'}, segmentado ${opc.seg ? 'À VISTA' : 'escondido'}`, opc.botao && opc.texto === 'TV' && !opc.seg);
  await pg.evaluate(() => { const g = window.__golaco; g.relogio.usarManual(true); g.fecharMenu(); });
  await quadros(pg, 60);
  const D = await conferirCameras(pg, 'celular Média, noite');
  meta('D4 celular 844×390 Média, de noite: as 6 câmeras pela pausa com as conferências do B1', D.texto, D.ok);
  // o teto do jogo no celular Média: o do pré-jogo (≤ 40 chamadas, ≤ 130 mil triângulos; teste-prejogo). Ao vivo (sonda de
  // 300 quadros, 5 contra 5): a TV da partida 11 × 11 fica em 26–29 chamadas e 94 mil triângulos (máx. 100 mil); Atrás em
  // 29–31 (máx. 36) e 82 mil (máx. 92 mil) — o lado de cá entra no quadro —, as outras ≤ 35 e ≤ 83 mil
  meta('D5 celular Média: custo de desenho de cada câmera no quadro do D4 dentro do teto do jogo no celular (≤ 40 chamadas, ≤ 130 mil triângulos, o do pré-jogo)',
    CL.CAMERAS_LIVRE.map(c => `${CL.NOME_CAMERA[c]} ${D.custo[c][0]} / ${(D.custo[c][1] / 1000).toFixed(0)} mil`).join('; '),
    CL.CAMERAS_LIVRE.every(c => D.custo[c][0] > 0 && D.custo[c][0] <= 40 && D.custo[c][1] <= 130000));
  meta('G2 celular: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  errosTodos.push(...s.erros);
  await s.navegador.close();
}

// ------------------------------------------------------------------ E: 568×320
{
  const s = await abrir({ largura: 568, altura: 320, dpr: 2, toque: true });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=livre&q=baixa&toque=1&entalhe=1&replay=0&comemoracao=0&semente=7`, { waitUntil: 'load' });
  await pronta(pg);
  const topo = await pg.evaluate(() => {
    const j = document.querySelector('.janela-menu'), jr = j.getBoundingClientRect();
    const vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
    const pecas = [document.querySelector('.janela-topo h2'), ...document.querySelectorAll('.janela-topo .chip, .janela-topo .btn-fechar')].filter(vis);
    let folga = Infinity, fora = 0;
    for (let a = 0; a < pecas.length; a++) {
      const ra = pecas[a].getBoundingClientRect();
      if (ra.right > jr.right + 0.5 || ra.left < jr.left - 0.5) fora++;
      for (let b = a + 1; b < pecas.length; b++) { const rb = pecas[b].getBoundingClientRect(); folga = Math.min(folga, Math.max(rb.left - ra.right, ra.left - rb.right)); }
    }
    return { folga, fora, n: pecas.length };
  });
  const sub = {};
  for (const [nome, abre] of [['Jogadores', null], ['ações', '#menu-livre [data-cmd="livre-voltar"]'], ['Câmera', '#btn-livre-camera']]) {
    sub[nome] = await pg.evaluate(([P, sel]) => { if (sel) document.querySelector(sel).click(); return eval(P)(); }, [PAUSA.toString().replace(/^/, '(') + ')', abre]);
  }
  const okE = topo.n >= 3 && topo.folga >= 4 && topo.fora === 0 && Object.values(sub).every(p => p.encosta.length === 0 && p.cortados.length === 0 && p.fora.length === 0);
  meta('E1 568×320: a barra da pausa sem encostar nem passar da janela; nos submenus e nas ações do Livre nada encosta, fica cortado ou passa da janela (a pausa rola nessa tela, como a da partida)',
    `barra: ${topo.n} peças, folga ${topo.folga.toFixed(0)} px${topo.fora ? `, ${topo.fora} FORA` : ''}; ${Object.entries(sub).map(([k, p]) => `${k}: rola ${p.rola} px${p.encosta.length ? ', ENCOSTA ' + p.encosta.join(', ') : ''}${p.cortados.length ? ', CORTADO ' + p.cortados.join(', ') : ''}${p.fora.length ? ', FORA ' + p.fora.join(', ') : ''}`).join('; ')}`, okE);
  meta('G3 568×320: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  errosTodos.push(...s.erros);
  await s.navegador.close();
}

// ------------------------------------------------------------------ F: ?tm, pedido com modo "livre"
{
  const pedido = { ...PED_A, id: 'tL', modo: 'livre', livre: { linha: [3, 2], goleiro: [true, false] } };
  const json = JSON.stringify(JSON.stringify(pedido)).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>TM</title></head><body style="margin:0;background:#000">
<script>
localStorage.setItem('tm3d:pedido:tL', ${json});
localStorage.removeItem('tm3d:resultado:tL');
window.__msgs = [];
addEventListener('message', e => { const f = document.getElementById('q'); if (e.origin === location.origin && f && e.source === f.contentWindow) window.__msgs.push(e.data); });
const f = document.createElement('iframe');
f.id = 'q'; f.src = 'index.html?tm=tL&q=baixa&replay=0&comemoracao=0&toque=1&entalhe=1';
f.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
document.body.appendChild(f);
</script></body></html>`;
  const s = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  const pg = s.pagina;
  const url = `${srv.url}__quadro-tm-livre.html`;
  await s.contexto.route(url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await pg.goto(url, { waitUntil: 'load' });
  let fr = null;
  for (let i = 0; i < 200 && !fr; i++) { fr = pg.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await pg.waitForTimeout(50); }
  await fr.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  // a fonte do TM (Inter) chega depois do 1º layout: espera ela antes de medir a pausa
  await fr.evaluate(() => document.fonts?.ready);
  await pg.waitForFunction(() => window.__msgs.some(m => m.tipo === 'tm3d:pronto'), null, { timeout: 10000 }).catch(() => {});
  const jog = await fr.evaluate(P => {
    const r = eval(P)();
    r.tm = document.documentElement.classList.contains('tm');
    r.n = ['meu', 'adv'].map(k => document.getElementById(`livre-n-${k}`)?.textContent);
    document.getElementById('btn-livre-jogar').click();
    return r;
  }, PAUSA.toString().replace(/^/, '(') + ')');
  await fr.evaluate(() => window.__golaco.relogio.usarManual(true));
  await quadros(fr, 30);
  const tmp = await fr.evaluate(P => {
    const g = window.__golaco;
    const conta = [0, 1].map(t => g.mundo.jogadores.filter(o => o.time === t).length);
    g.abrirMenu();
    const r = eval(P)();
    document.getElementById('btn-livre-camera').click();
    const sub = eval(P)();
    const b = document.querySelector('#menu-camera-livre [aria-pressed="true"]'), o = document.querySelector('#menu-camera-livre [aria-pressed="false"]');
    const cs = getComputedStyle(b), co = getComputedStyle(o);
    r.camera = { sub, raio: parseFloat(co.borderTopLeftRadius), fundo: cs.backgroundImage, fonte: cs.fontFamily };
    document.querySelector('#menu-camera-livre [data-cmd="livre-voltar"]').click();
    r.conta = conta;
    return r;
  }, PAUSA.toString().replace(/^/, '(') + ')');
  const t = tmp.textos.join(' / ');
  meta('F1 ?tm: a cara do TM e o pedido livre {linha [3, 2], goleiro [sim, não]}: a pausa abre no Jogadores com 4 e 2, e o "Jogar" põe 4 contra 2',
    `html.tm ${jog.tm ? 'sim' : 'NÃO'}; Jogadores ${jog.n.join(' e ')}; em campo ${tmp.conta.join(' × ')}; Jogadores: ${txtPausa(jog)}`,
    jog.tm && jog.n.join() === '4,2' && tmp.conta.join() === '4,2' && okPausa(jog));
  meta('F2 ?tm 844×390: a pausa do Livre com "Voltar ao Total Match" (sem Modo de jogo, Simular o resto, Reiniciar e Editar time) e o submenu Câmera sem rolar; as câmeras em pílula do TM (a escolhida no degradê)',
    `${txtPausa(tmp)} · Câmera: ${txtPausa(tmp.camera.sub)}; raio ${tmp.camera.raio} px, escolhida ${/gradient/.test(tmp.camera.fundo) ? 'no degradê' : 'SEM o degradê'}, fonte ${tmp.camera.fonte.split(',')[0]}`,
    okPausa(tmp) && /Voltar ao Total Match/.test(t) && !/Modo de jogo|Simular o resto|Reiniciar|Editar time/.test(t) && /Jogadores.*Câmera/.test(t)
      && okPausa(tmp.camera.sub) && tmp.camera.raio >= 16 && /gradient/.test(tmp.camera.fundo) && /Inter/.test(tmp.camera.fonte));
  await fr.evaluate(() => document.getElementById('btn-voltar-tm').click());
  await pg.waitForFunction(() => window.__msgs.some(m => m.tipo === 'tm3d:fim'), null, { timeout: 10000 }).catch(() => {});
  const msgs = await pg.evaluate(() => window.__msgs.map(m => ({ ...m })));
  const fim = msgs.find(m => m.tipo === 'tm3d:fim');
  meta('F3 ?tm: "Voltar ao Total Match" manda tm3d:fim com {livre: {placar}} ao pai',
    `${msgs.map(m => m.tipo).join(', ')} · ${fim ? JSON.stringify(fim.resultado) : 'sem tm3d:fim'}`,
    !!fim && Array.isArray(fim.resultado?.livre?.placar) && fim.resultado.livre.placar.length === 2 && !('homeGoals' in fim.resultado));
  meta('G4 ?tm: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  errosTodos.push(...s.erros);
  await s.navegador.close();
}

// ------------------------------------------------------------------ H: a junção com a main (#490 e o replay)
{
  const s = await abrir({ largura: 1280, altura: 720 });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=livre&q=baixa&hora=dia&replay=0&comemoracao=0&substituicao=0&semente=5`, { waitUntil: 'load' });
  await pronta(pg);
  await pg.evaluate(() => { window.__golaco.relogio.usarManual(true); document.getElementById('btn-livre-jogar').click(); });
  await quadros(pg, 30);
  await pg.evaluate(() => window.__golaco.bolaParada.carregar());
  await quadros(pg, 20);
  /** A bola parada de teste do meu time montada, com o controlado cobrando. */
  const montar = async tipo => {
    await pg.evaluate(t => window.__golaco.bolaParadaDeTeste(t), tipo);
    for (let k = 0; k < 40; k++) {
      await quadros(pg, 10);
      if (await pg.evaluate(t => { const m = window.__golaco.mundo, pr = m.parada; return pr?.tipo === t && pr.cobrador != null && pr.cobrador === m.controlado[0]; }, tipo)) return true;
    }
    return false;
  };
  const fimLinha = () => pg.evaluate(() => { const g = window.__golaco, p = g.bolaParada.pontos(); if (!p.length) return null; const q = p[Math.min(p.length - 1, 40)]; return g.naTela(q[0], q[1], q[2]); });
  const linhasH1 = []; let okH1 = true;
  for (const [cam, tipo] of [['tv', 'tiroDeMeta'], ['alta', 'escanteio'], ['atras', 'tiroDeMeta']]) {
    await pg.evaluate(c => window.__golaco.definirCamera(c), cam);
    await quadros(pg, 5);
    const montou = await montar(tipo);
    await quadros(pg, 90);
    const e = await pg.evaluate(() => { const g = window.__golaco, b = g.bolaParada.estado, c = g.render.camera; return { ativa: !!b?.ativa, mistura: b?.mistura ?? 0, de: b?.plano?.de ?? null, cam: [c.x, c.y, c.z], modo: g.livre.camera?.modo }; });
    const dist = e.de ? Math.hypot(...e.de.map((v, i) => v - e.cam[i])) : Infinity;
    const a = await fimLinha();
    await pg.keyboard.down('ArrowRight'); await quadros(pg, 40);
    const b = await fimLinha();
    await pg.keyboard.up('ArrowRight'); await quadros(pg, 2);
    const dx = a && b ? b.x - a.x : 0, dy = a && b ? b.y - a.y : 0;
    // a cobrança (PASSE) e a volta à câmera do Livre: o maior passo da câmera por quadro enquanto a mistura sai
    await pg.keyboard.down('KeyJ'); await quadros(pg, 12); await pg.keyboard.up('KeyJ');
    const volta = await pg.evaluate(() => {
      const g = window.__golaco;
      let ant = null, maior = 0, mistura = 1;
      for (let i = 0; i < 200 && mistura > 0; i++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const c = g.render.camera, p = [c.x, c.y, c.z];
        mistura = g.bolaParada.estado?.mistura ?? 0;
        if (ant) maior = Math.max(maior, Math.hypot(p[0] - ant[0], p[1] - ant[1], p[2] - ant[2]));
        ant = p;
      }
      return { maior, mistura };
    });
    const bom = montou && e.modo === cam && e.ativa && e.mistura >= 0.99 && dist <= 0.5 && dx > 40 && Math.abs(dx) > Math.abs(dy) && volta.mistura === 0 && volta.maior <= 3;
    if (!bom) okH1 = false;
    linhasH1.push(`${cam}/${tipo}${bom ? '' : ' [FALHOU]'}: ${montou ? '' : 'NÃO MONTOU; '}câmera a ${dist.toFixed(1)} m do plano (mistura ${e.mistura.toFixed(2)}); "direita" ${dx.toFixed(0)}/${dy.toFixed(0)} px; volta à do Livre ${volta.mistura === 0 ? 'sim' : 'NÃO'}, maior passo ${volta.maior.toFixed(2)} m/quadro`);
    await pg.evaluate(() => window.__golaco.livre.recomecar('pe'));
    await quadros(pg, 10);
  }
  meta('H1 PC: a bola parada do humano no Livre (TV, Alta, Atrás) mostra a câmera atrás do cobrador (#490) e a "direita" leva o fim da linha da mira para a direita na tela; depois da cobrança volta à câmera do Livre sem salto (antes a do Livre cobria o plano: a linha descia 66 px na TV)',
    linhasH1.join('; '), okH1);

  // H2: mudar os jogadores na pausa no meio da cobrança mirada — a mira e a curva ficam, a câmera/linha não somem
  await pg.evaluate(() => window.__golaco.definirCamera('tv'));
  const montouH2 = await montar('escanteio');
  await quadros(pg, 60);
  await pg.keyboard.down('ArrowRight'); await quadros(pg, 25); await pg.keyboard.up('ArrowRight'); await quadros(pg, 2);
  const h2a = await pg.evaluate(() => { const m = window.__golaco.mundo; return { ang: m.parada?.mira?.ang ?? null, curva: m.parada?.mira?.curva ?? null, cob: m.parada?.cobrador ?? null }; });
  const h2 = await pg.evaluate(() => {
    const g = window.__golaco, e = g.livre.escolha();
    g.abrirMenu();
    g.livre.ajustar({ linha: [e.linha[0], e.linha[1] === 7 ? 4 : 7], goleiro: e.goleiro });
    document.getElementById('btn-continuar').click();
    const r = { quadros: 0, semCobrador: 0, outraMira: 0, semCamera: 0, entrou: null };
    for (let i = 0; i < 60; i++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      const m = g.mundo, pr = m.parada, b = g.bolaParada.estado;
      r.quadros++;
      if (!pr || pr.cobrador == null || pr.cobrador !== m.controlado[0]) r.semCobrador++;
      if (!pr?.mira) r.outraMira++; else r.ang = pr.mira.ang;
      if (!b?.ativa) r.semCamera++;
    }
    r.escolha = g.livre.escolha().linha.join('×');
    return r;
  });
  const okH2 = montouH2 && h2a.ang != null && h2.semCobrador === 0 && h2.semCamera === 0 && h2.outraMira === 0 && Math.abs(h2.ang - h2a.ang) < 1e-9;
  meta('H2 PC: mudar os jogadores na pausa no meio da cobrança mirada (escanteio, o adversário 4 ↔ 7): a mira da pessoa fica e o cobrador, a câmera e a linha não somem (antes ~50 passos sem cobrador e a mira de volta ao padrão)',
    `${montouH2 ? '' : 'NÃO MONTOU; '}mira ${h2a.ang?.toFixed(3)} → ${h2.ang?.toFixed(3) ?? '—'}; em ${h2.quadros} quadros: sem cobrador ${h2.semCobrador}, sem a câmera ${h2.semCamera}, sem mira ${h2.outraMira}; agora ${h2.escolha}`, okH2);
  meta('G5 H (bola parada): sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  errosTodos.push(...s.erros);
  await s.navegador.close();
}
// H3: R ("Bola no meu pé") no meio do gol — o replay daquele gol é descartado (nem toca, nem fica para a próxima saída)
{
  const s = await abrir({ largura: 1280, altura: 720 });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?modo=livre&q=baixa&hora=dia&replay=1&comemoracao=0&substituicao=0&semente=7`, { waitUntil: 'load' });
  await pronta(pg);
  const r = await pg.evaluate(async () => {
    const g = window.__golaco, av = n => { for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); };
    g.relogio.usarManual(true); document.getElementById('btn-livre-jogar').click();
    av(30);
    // o diretor do replay baixado (sob demanda: o "Replay" da pausa o pede)
    for (let k = 0; k < 100 && !g.replay.estado; k++) { g.abrirMenu(); document.querySelector('#menu [data-cmd="replay"]').click(); await new Promise(f => setTimeout(f, 50)); }
    for (let i = 0; i < 900 && g.replay.estado?.ativo; i++) av(1);
    if (g.estado().menuAberto) g.fecharMenu();
    g.livre.ajustar({ linha: [3, 0], goleiro: [false, false] });
    av(5);
    const pl = () => [g.mundo.placar[0], g.mundo.placar[1]], p0 = pl();
    for (let n = 0; n < 9000; n++) { g.rodarPassos(1, 'demo'); if (g.mundo.placar[0] !== p0[0] || g.mundo.placar[1] !== p0[1]) break; }
    av(20);
    const gol = { placar: pl(), estado: g.mundo.partida.estado, pendente: !!g.replay.golPendente };
    g.livre.recomecar('pe');
    const r1 = [];
    for (let k = 0; k < 120; k++) { av(1); if (g.replay.estado?.ativo) r1.push(g.replay.estado.tipo); }
    const depoisR = { estado: g.mundo.partida.estado, pendente: !!g.replay.golPendente, replay: [...new Set(r1)] };
    av(180);
    g.livre.recomecar('meio');
    const r2 = [];
    for (let k = 0; k < 600; k++) { av(1); if (g.replay.estado?.ativo) r2.push(g.replay.estado.tipo); }
    return { gol, depoisR, saida: { replay: [...new Set(r2)], placar: pl() } };
  });
  meta('H3 PC: R ("Bola no meu pé") no meio do gol descarta o replay daquele gol — nem toca, nem entra na próxima saída sem gol ("Recomeçar bola no meio"); antes ficava pendente e tocava lá',
    `gol ${r.gol.placar.join('×')} (${r.gol.estado}, pendente ${r.gol.pendente ? 'sim' : 'não'}); depois do R: ${r.depoisR.estado}, pendente ${r.depoisR.pendente ? 'SIM' : 'não'}, replay [${r.depoisR.replay.join(', ')}]; na saída sem gol: replay [${r.saida.replay.join(', ')}], placar ${r.saida.placar.join('×')}`,
    r.gol.pendente && !r.depoisR.pendente && r.depoisR.replay.length === 0 && r.saida.replay.length === 0 && r.saida.placar.join() === r.gol.placar.join());
  meta('G6 H3 (replay): sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  errosTodos.push(...s.erros);
  await s.navegador.close();
}

await srv.fechar();
let falhas = 0;
for (const r of res) { console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}\n          ${r.medido}`); if (!r.ok) falhas++; }
console.log(falhas ? `\nteste-livre-tela: REPROVOU (${falhas})` : '\nteste-livre-tela: PASSOU');
process.exit(falhas ? 1 : 0);
