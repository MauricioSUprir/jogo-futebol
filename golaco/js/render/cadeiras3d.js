// Cadeiras 3D de perto (three.js; SOB DEMANDA — main.js SOB.cadeiras: não desenha o 1º quadro, a câmera de TV nunca
// chega perto da arquibancada). Item 69 da FILA, PR 1: a cadeira rebatível de estádio (concha + encosto, ~18
// triângulos: render/cadeiras-dados.js geometriaCadeira) instanciada nos BLOCOS da grade (a faixa entre duas escadas × 4
// fileiras) perto da câmera; longe fica a textura (a pintura da mesma grade). A escolha é por bloco, pelos px da cadeira
// na tela, com histerese e teto de instâncias/blocos (cadeiras-dados.js escolherBlocos, pura). Dentro de um bloco em 3D o
// material das arquibancadas troca a cadeira pintada pelo concreto do degrau (render/campo.js UNIFORMS_PERTO): a 3D fica
// sozinha em cima do piso. Uma malha instanciada (1 chamada de desenho, só quando algum bloco está perto); cada cadeira
// com a cor da sua célula da textura (a mesma conta: pintorGolaco / pintorAnel). PR 2: nos blocos mais perto o torcedor do
// quadro vira o torcedor 3D sentado na cadeira (render/torcedor3d.js, criado aqui quando a torcida liga: ligarTorcida).
// O ORÇAMENTO de triângulos por quadro (cadeiras-dados.js criarOrcamento3D/orcamentoPerto): o 3D de perto ganha no máximo
// o alvo da qualidade menos o resto do último desenho (renderer.info, pelo `medidor`), primeiro as pessoas, depois as
// cadeiras; no corte de câmera, 1 quadro sem 3D de perto e a escolha inteira no seguinte. Só desenho: o hash não muda.
import * as THREE from 'three';
import { geometriaCadeira, escolherBlocos, matrizCadeira, escalaLargura, criarOrcamento3D, CADEIRAS3D } from './cadeiras-dados.js';
import { criarTorcedores3D } from './torcedor3d.js';

const _v = new THREE.Vector3();
const _cor = new THREE.Color();

/**
 * Cria as cadeiras 3D. opc = {grupo (THREE.Group do estádio), info: {grade, cor(assento) → '#rrggbb', concreto: {piso,
 * espelho}} (a do estádio: render/campo.js), uniforms (campo.js UNIFORMS_PERTO), qualidade, medidor (opcional: () →
 * {frame, triangles} do último desenho, o renderer.info.render; sem ele, sem orçamento por quadro)} (sem a luz falsa dos
 * sinalizadores: o material dela tem a máscara, que apagaria a própria cadeira). Devolve {atualizar(camera, alturaPx, semCa,
 * deJogo), definirHora(h), definirQualidade(q), definirMedidor(fn), ligar(v), ligarTorcida(t), torcedores, orcamento,
 * blocos, instancias, teto, mesh, dispose()}.
 */
export function criarCadeiras3D(opc) {
  const { info, uniforms: U } = opc;
  const grade = info.grade;
  const G = geometriaCadeira();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(G.posicao, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(G.normal, 3));
  // plástico injetado (polipropileno) fosco: Lambert dos dois lados (a concha é uma casca fina, vista por trás também)
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const maxInst = Math.max(1, CADEIRAS3D.teto.alta);
  const mesh = new THREE.InstancedMesh(geo, mat, maxInst);
  mesh.name = 'cadeiras3d';
  mesh.count = 0;
  mesh.frustumCulled = false;      // a escolha já é pelo cone da câmera (os blocos fora dele não entram)
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxInst * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.visible = false;
  opc.grupo.add(mesh);
  U.uConcPiso.value.set(info.concreto?.piso ?? 0x43494c);
  U.uConcEspelho.value.set(info.concreto?.espelho ?? 0x3b4043);
  let teto = CADEIRAS3D.teto[opc.qualidade] ?? CADEIRAS3D.teto.media, qual = opc.qualidade ?? 'media', hora = 'dia';
  // o torcedor 3D (item 69, PR 2: render/torcedor3d.js) nos blocos mais perto, quando a torcida existe (ligarTorcida)
  let tor = null;
  let chave = '', inst = 0, nBlocos = 0, ligado = true, medidor = opc.medidor ?? null;
  // o orçamento de triângulos do quadro (puro: cadeiras-dados.js) e o que ele deu neste quadro
  const orc = criarOrcamento3D({ qualidade: qual });
  const VAZIO = { blocos: [], fileiras: [], tri: [0, 0], triCadeira: G.triangulos };
  const camOrc = { obj: null, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, fov: 50, deJogo: false };
  // os ancestrais visíveis (o grupo do estádio fora do desenho: o 3D de perto também)
  const naCena = () => { for (let o = opc.grupo; o; o = o.parent) if (!o.visible) return false; return true; };
  const cam = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, fov: 50, aspecto: 1, alturaPx: 720 };
  // pré-carga: no 1º quadro depois de chegar a malha vai para a GPU com 0 instâncias (o programa compila antes do 1º
  // plano de perto — nada engasga no corte)
  let precarga = true;
  const corCache = new Map();
  function corDe(a) {
    const h = info.cor(a);
    let c = corCache.get(h);
    if (!c) { c = new THREE.Color(h); corCache.set(h, c); }
    return c;
  }
  /** Escreve as instâncias e as caixas da máscara dos blocos escolhidos. */
  function aplicar(lista) {
    const m = mesh.instanceMatrix.array, cr = mesh.instanceColor.array;
    let k = 0;
    lista.forEach((bi, ib) => {
      for (const a of grade.assentosDoBloco(bi)) {
        if (k >= maxInst) break;
        matrizCadeira(a, escalaLargura(a.larg), m, 16 * k);
        _cor.copy(corDe(a));
        cr[3 * k] = _cor.r; cr[3 * k + 1] = _cor.g; cr[3 * k + 2] = _cor.b;
        k++;
      }
      const b = grade.blocos[bi].caixa;
      U.uPertoC.value[ib].set(b.c[0], b.c[1], b.c[2], 0);
      U.uPertoE.value[ib].set(b.e[0], b.e[1], b.e[2], 0);
      U.uPertoA.value[ib].set(b.eixo[0], b.eixo[1], 0, 0);
    });
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.clearUpdateRanges?.();
    U.uPertoN.value = lista.length;
    mesh.visible = k > 0;
    inst = k; nBlocos = lista.length;
  }
  return {
    mesh,
    get blocos() { return nBlocos; },
    get instancias() { return inst; },
    get teto() { return teto; },
    /**
     * A câmera deste quadro (three.js PerspectiveCamera), a altura da tela em px CSS e semCa (a câmera está dentro do lado
     * de cá: ele e as cadeiras dele saem do desenho — a câmera de TV) e deJogo (a câmera de jogo, a TV: nenhuma cadeira 3D —
     * o custo do jogo na TV não muda).
     */
    atualizar(camera, alturaPx, semCa = false, deJogo = false) {
      if (!camera || !camera.isPerspectiveCamera) return;
      camera.updateMatrixWorld();
      camera.getWorldDirection(_v);
      cam.x = camera.position.x; cam.y = camera.position.y; cam.z = camera.position.z;
      cam.fx = _v.x; cam.fy = _v.y; cam.fz = _v.z;
      cam.fov = camera.fov / (camera.zoom || 1); cam.aspecto = camera.aspect; cam.alturaPx = alturaPx || 720;
      // o orçamento deste quadro: o último desenho (o resto dele) e a câmera (o corte)
      camOrc.obj = camera; camOrc.x = cam.x; camOrc.y = cam.y; camOrc.z = cam.z; camOrc.fx = cam.fx; camOrc.fy = cam.fy; camOrc.fz = cam.fz;
      camOrc.fov = cam.fov; camOrc.deJogo = !!deJogo;
      const ctx = orc.inicio(medidor ? medidor() : null, camOrc);
      tor?.preparar();
      let desejo = VAZIO;
      if (ligado && !deJogo && ctx.orcamento > 0) {
        // o que cada parte QUER (os tetos da qualidade e a histerese dos px contra o que está desenhado; no corte, sem ela)
        const at = orc.atual, antB = ctx.semAnteriores ? new Set() : at.blocos;
        const r = escolherBlocos(grade.blocos, cam, antB, { teto, semSetor: semCa ? 3 : null });
        const dt = tor ? tor.desejo(r.lista, cam, ctx.semAnteriores ? new Map() : at.fileiras) : null;
        desejo = { blocos: r.lista.map(i => ({ i, px: r.px.get(i), n: grade.blocos[i].n })), fileiras: dt ? dt.fileiras : [], tri: dt ? dt.tri : [0, 0], triCadeira: G.triangulos };
      }
      // o que cabe no orçamento (as pessoas primeiro; histerese; no corte, nada neste quadro)
      const plano = orc.planejar(desejo, ctx);
      const lista = [...plano.blocos].sort((p, q) => p - q);
      const k = lista.join(',');
      if (k !== chave) { chave = k; aplicar(lista); }
      // os torcedores 3D: só nas fileiras do plano (sentados nas cadeiras 3D dele; na TV, nenhum)
      tor?.aplicarEscolha(plano.fileiras);
      // pré-carga: só o 1º quadro com 0 instâncias (o programa compila); depois, desenhada só com alguma cadeira
      if (precarga) { precarga = false; mesh.visible = true; } else mesh.visible = mesh.count > 0;
      // o que o 3D de perto vai desenhar neste quadro (o resto do próximo quadro é o total menos isto)
      const vis = naCena(), gc = vis && mesh.visible ? mesh.count * G.triangulos : 0, gt = vis && tor ? tor.desenhados : 0;
      orc.gastou(gc + gt, { cadeiras: gc, torcedores: gt });
    },
    /**
     * O orçamento agora (testes e medidas): {alvo, resto (o último desenho menos o 3D de perto dele), orcamento (alvo −
     * resto: o máximo deste quadro), gasto: {total, cadeiras, torcedores} (o que o 3D de perto desenha neste quadro), corte,
     * esperando (o quadro do corte: sem 3D de perto), novo, medido (com medidor)}.
     */
    get orcamento() { return { ...orc.estado, medido: !!medidor }; },
    /** De onde vem o total do último desenho: () → {frame, triangles} (renderer.info.render). */
    definirMedidor(fn) { medidor = fn ?? null; },
    definirHora(h) { hora = h; mat.color.setScalar(h === 'noite' ? 0.5 : 1); tor?.definirHora(h); },
    /** A torcida do estádio (render/torcida.js) existe: liga o torcedor 3D nos blocos de perto (o modelo baixa fora da Baixa). */
    ligarTorcida(torcida) {
      if (tor || !torcida || !torcida.dados) return;
      tor = criarTorcedores3D({ grupo: opc.grupo, grade, torcida, qualidade: qual, hora });
    },
    /** O torcedor 3D agora (testes e medidas): {carregado, torcedores, blocos, triangulos, lods: [nível 0, nível 1]}. */
    get torcedores() { return tor ? { carregado: tor.carregado, torcedores: tor.torcedores, blocos: tor.blocos, triangulos: tor.triangulos, lods: tor.lods } : null; },
    /** O torcedor 3D (testes: as malhas, o modelo e a VAT). */
    get torcedor3d() { return tor; },
    /** Liga/desliga (testes: o mesmo quadro com e sem as cadeiras 3D; desligadas, a pintura volta em todo bloco). */
    ligar(v) { const era = ligado; ligado = !!v; if (ligado && !era) { chave = ''; orc.replanejar(); } },
    definirQualidade(q) { teto = CADEIRAS3D.teto[q] ?? teto; qual = q; chave = ''; orc.definirQualidade(q); tor?.definirQualidade(q); },
    dispose() { tor?.dispose(); opc.grupo.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose?.(); U.uPertoN.value = 0; },
  };
}
