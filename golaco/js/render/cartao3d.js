// O CARTÃO 3D na mão do árbitro (cena do cartão, js/cena-cartao.js; pedido do dono de 22/10: "as cenas de cartões";
// sob demanda: main.js SOB.cenas). Uma malha só (um
// retângulo de 11 × 16 cm: 1,5× o real, 7,5 × 10,5 cm, para ler no celular a 844 × 390 — o cartão de verdade some a
// 8 m com a lente do celular), cor plana sem luz nem tom (MeshBasicMaterial, toneMapped false: a MESMA cor do ícone do
// CSS, #f5c518 / #e5484d, de dia e de noite). Preso à mão direita desenhada do árbitro (a mão segura a parte de baixo), com
// a face virada para o punido (cena-cartao.js cartaoNaMao). Só desenha (1 chamada) enquanto está visível; no 1º desenho
// depois de criado aparece fora do campo para o three.js compilar o material antes da 1ª cena (nada engasga no corte) e se
// esconde sozinho logo depois dele (onAfterRender: também no pré-jogo, que desenha sem passar pelo atualizar).
import * as THREE from 'three';

export const CARTAO3D = { largura: 0.11, altura: 0.16, pegada: 0.34, cores: { amarelo: 0xf5c518, vermelho: 0xe5484d } };

export function criarCartao3D(cena) {
  const geo = new THREE.PlaneGeometry(CARTAO3D.largura, CARTAO3D.altura);
  const mat = new THREE.MeshBasicMaterial({ color: CARTAO3D.cores.amarelo, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'cartao3d';
  mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = false;
  // pré-carga: o 1º quadro desenha o cartão bem abaixo do gramado (compila o material)
  mesh.position.set(0, -60, 0);
  mesh.visible = true;
  cena.add(mesh);
  let precarga = true, cor = 'amarelo', ativo = false;
  // a pré-carga: desenhado uma vez (compila o material) e escondido logo depois, a não ser que a cena já o use
  mesh.onAfterRender = () => { if (precarga) { precarga = false; if (!ativo) mesh.visible = false; } };
  return {
    mesh,
    /**
     * info = null (some) ou {visivel, cor ('amarelo' | 'vermelho'), x, y, z (a mão), nx, nz (a face, horizontal)}.
     */
    atualizar(info) {
      if (!info || !info.visivel) { ativo = false; if (!precarga) mesh.visible = false; return; }
      ativo = true;
      if (info.cor !== cor) { cor = info.cor; mat.color.setHex(CARTAO3D.cores[cor] ?? CARTAO3D.cores.amarelo); }
      // a mão segura a parte de baixo do cartão (os dedos cobrem ~2,6 cm dela): o centro a `pegada` × altura acima da mão
      const y = info.y + CARTAO3D.altura * CARTAO3D.pegada;
      mesh.position.set(info.x, y, info.z);
      mesh.lookAt(info.x + info.nx, y, info.z + info.nz);
      mesh.visible = true;
    },
    get visivel() { return mesh.visible && mesh.position.y > -10; },
    get cor() { return cor; },
  };
}
