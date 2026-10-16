// teste-livre-tela: o Modo Livre no navegador (pedido do dono de 16/10; js/livre.js, js/livre-pagina.js,
// js/render/camera-livre.js; contrato "Modo Livre" no CONTRATOS.md). Relógio manual (o laço da página, quadro a quadro).
//   A  (Node, sem navegador) as poses das 6 câmeras: TV, Aproximada, Ampla, Alta, Atrás e Jogador × Altura e Distância 0,
//      5, 10, 15 e 20 × 3 telas (PC 16:9, celular deitado, 4:3) × os 2 rumos do ataque × focos na borda do que cada câmera
//      alcança (+ as transições a meio caminho entre câmeras de mesmo rumo): nenhuma dentro de um sólido do estádio do jogo
//      (estadio-forma.js; a arquibancada de cá só com a câmera dentro da caixa dela, que sai do desenho), nenhuma com
//      arquibancada, parede ou teto na frente do campo (raios pelo quadro até o gramado), Jogador ≥ 3,2 m de altura e ≥ 3 m
//      da cabeça do controlado. A2: sem os limites (segurarPose) a mesma varredura reprova — ela enxerga o problema.
//   B  PC 1280×720 Alta, de dia: ?modo=livre abre a pausa no submenu Jogadores com o "Jogar"; cada câmera escolhida PELA
//      PAUSA (Câmera → o botão → Voltar → Continuar), com a bola no pé do controlado: o quadro não vazio, a bola e o
//      controlado (cabeça, cintura e pés) no quadro, a câmera fora de sólido e a ≥ 3 m do controlado, os pontos do gramado à
//      vista com cor de grama (nada atravessando a arquibancada nem a cobertura) e a fração de grama na tela.
//   C  PC: C cicla pelas 6 câmeras (com o aviso "Câmera: …"); Atrás e Jogador com o rumo do ataque do meu time e o
//      analógico para cima levando o controlado para o gol que eu ataco (na TV, para o lado de lá); TV → Ampla com transição
//      e TV → Atrás com corte; Altura e Distância (−/+ na pausa) sobem e afastam a câmera; a escolha fica salva (recarregar
//      volta com a câmera e o ajuste); na partida (Modo de jogo) a câmera volta a ser a da partida (TV/Aproximada).
//   D  Celular 844×390 Média, de noite (toque, entalhe): a pausa do Livre (Continuar | Replay; Jogadores | Câmera;
//      Recomeçar | Bola no meu pé; Modo de jogo; Ajuda — sem Editar time e sem Reiniciar) e os submenus Jogadores, Câmera e
//      Modo de jogo (com "Modo Livre N contra M") cabem SEM ROLAR e nada encosta; na coluna das opções o nome da câmera
//      no lugar do TV | Aproximada; as 6 câmeras de noite com as conferências do B e o custo de desenho de cada uma dentro do
//      teto do jogo no celular (≤ 40 chamadas, ≤ 130 mil triângulos: o do pré-jogo).
//   E  568×320 (toque, entalhe): a barra da pausa sem nada encostando nem passando da janela, os botões do Livre sem
//      encostar uns nos outros (a pausa rola nessa tela, como a da partida: medido e mostrado).
//   F  ?tm (o quadro do Total Match imitado, pedido com modo "livre" e livre {linha [3, 2], goleiro [sim, não]}): a cara do
//      TM (as câmeras em pílula), 4 contra 2 no "Jogar", a pausa com "Voltar ao Total Match" (sem Modo de jogo, Simular o
//      resto, Reiniciar e Editar time) sem rolar em 844×390, e o clique manda tm3d:fim com {livre: {placar}} ao pai.
//   G  Nenhum erro no console em nenhuma tela.
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
  const focos = (m, peq) => {
    const Pf = perfil(m, peq);
    if (Pf.limX != null) return { xs: [-Pf.limX, -Pf.limX / 2, 0, Pf.limX / 2, Pf.limX], zs: [Pf.limZ0, (Pf.limZ0 + Pf.limZ1) / 2, Pf.limZ1] };
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
        const { xs, zs } = focos(m, peq);
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
        const { xs, zs } = focos(a, peq);
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
    await pg.evaluate(c => { const g = window.__golaco; g.definirCamera(c); g.livre.recomecar('pe'); }, c);
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

  // C5: na partida (Modo de jogo) a câmera volta a ser a da partida; o segmentado TV | Aproximada de volta
  const part = await pg.evaluate(async () => {
    const g = window.__golaco;
    g.abrirMenu();
    document.getElementById('btn-modos').click();
    document.querySelector('#menu-modos [data-cmd="modo"][data-valor="partida"]').click();
    for (let i = 0; i < 40 && g.mundo.modo !== 'partida'; i++) await new Promise(r => setTimeout(r, 50));
    g.abrirMenu();
    const vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none';
    const r = { modo: g.mundo.modo, camera: g.camera, seg: vis(document.querySelector('.segmentado[data-grupo="camera"]')), botao: vis(document.getElementById('opcao-camera-livre')), livre: vis(document.getElementById('btn-livre-camera')) };
    g.fecharMenu();
    return r;
  });
  meta('C5 PC: de volta à partida (Modo de jogo), a câmera é a da partida (TV/Aproximada), com o TV | Aproximada na pausa e sem os botões do Livre',
    `modo ${part.modo}, câmera ${part.camera}, segmentado ${part.seg ? 'à vista' : 'ESCONDIDO'}, botão da câmera do Livre ${part.botao ? 'À VISTA' : 'escondido'}, Jogadores | Câmera ${part.livre ? 'À VISTA' : 'escondido'}`,
    part.modo === 'partida' && ['tv', 'aproximada'].includes(part.camera) && part.seg && !part.botao && !part.livre);
  meta('G1 PC: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  errosTodos.push(...s.erros);
  await s.navegador.close();
}

// ------------------------------------------------------------------ D: celular 844×390, Média, de noite
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
  const cortados = botoes.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim().slice(0, 16));
  const jr = j.getBoundingClientRect();
  const fora = botoes.filter(b => { const r = b.getBoundingClientRect(); return r.right > jr.right + 0.5 || r.left < jr.left - 0.5; }).map(b => b.textContent.trim().slice(0, 14));
  return {
    rola: j.scrollHeight - j.clientHeight, id: lista?.id, linhas: filhos.length, textos: filhos.map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    encosta: enc, cortados, fora,
  };
};
const okPausa = p => p.rola <= 0 && p.linhas <= 5 && p.encosta.length === 0 && p.cortados.length === 0 && p.fora.length === 0;
const txtPausa = p => `rola ${p.rola} px, ${p.linhas} linhas [${p.textos.join(' / ')}]${p.encosta.length ? '; ENCOSTA: ' + p.encosta.slice(0, 3).join(', ') : ''}${p.cortados.length ? '; CORTADO: ' + p.cortados.join(', ') : ''}${p.fora.length ? '; FORA: ' + p.fora.join(', ') : ''}`;
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

await srv.fechar();
let falhas = 0;
for (const r of res) { console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}\n          ${r.medido}`); if (!r.ok) falhas++; }
console.log(falhas ? `\nteste-livre-tela: REPROVOU (${falhas})` : '\nteste-livre-tela: PASSOU');
process.exit(falhas ? 1 : 0);
