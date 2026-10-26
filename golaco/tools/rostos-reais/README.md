# Rostos reais (Etapa 5.2) — a versão de teste da edição pro do Total Match

Cada jogador da edição **pro** (a "Season Update", trancada por chave no TM) ganha o rosto dele na pele da cabeça do corpo
humano (Rocketbox `Sports_Male_02`, a UV da própria cabeça). A foto é a **livre mais recente e neutra** do Wikimedia
Commons. A textura é obra derivada da foto, então os créditos vão em `assets/rostos-reais/CREDITOS-<liga>.md`. Na edição
pública e sem o TM nada disso é baixado (`main.js ligarRostosReais`). Uma liga por PR.

## As etapas

1. **`fotos_html.py`: a foto de cada jogador.**
   - **Identidade:** o Wikidata, que o TM já guarda em `legacy-total-match/assets/CREDITOS-imagens.md`.
   - **Candidatas:** vêm da foto principal (P18), da categoria do Commons e das subcategorias dela (P373). Vêm também da
     **busca de imagens** do Commons (`Special:MediaSearch`, pela PÁGINA), com o nome do Wikidata e o nome de nascimento.
     Daqui, a API e o `upload.wikimedia.org` dão 429. As miniaturas vêm de `thumb.wikimedia.org`, pelo md5 do nome.
   - **Ordem:** da mais nova para a mais velha. Fica a 1ª que passa em três filtros:
     - (a) de frente e com o rosto **neutro**, pelo MediaPipe Face Landmarker: |yaw| ≤ 18°, pitch −12…15°, |roll| ≤ 14°,
       sorriso ≤ 0,5, boca ≤ 0,12, bico ≤ 0,4, olhos abertos, olhos a ≥ 45 px. Uma foto com sorriso aberto, boné,
       língua de fora ou cabeça inclinada deixava a expressão gravada na pele.
     - (b) a **pessoa certa**: a busca traz companheiros, técnicos e políticos. O rosto é comparado ao da foto que o TM
       já mostra pelo SFace do OpenCV Zoo, com cosseno ≥ 0,40. Na conferência deu 0,68–0,95 para a mesma pessoa e
       ≤ 0,2 para outras.
     - (c) **licença livre**: CC0, CC BY, CC BY-SA ou domínio público.
   - `FOTO_SEGUNDA=1` com `FOTO_YAW`/`FOTO_SORRISO` mais largos refaz só quem ficou sem foto.
2. **`processar_liga.py` → `rosto_na_cabeca.py`: a foto na UV da cabeça.**
   - **Marcos:** os 468 marcos da foto e os do render de frente da cabeça (`rb_cabeca.py`, Blender). Os 898 triângulos da
     malha canônica do MediaPipe levam a foto para a UV. O lado escondido do rosto sai do lado visível espelhado.
   - **Portão de qualidade:** o resíduo de Procrustes dos marcos estáveis é ≤ 0,165 da distância entre os olhos.
   - **Exposição:** primeiro pela esclera. Depois é conferida pela PELE, com L* entre 24 e 72. O olho escuro ou apertado
     clareava o rosto até o branco.
   - **Tom:** o tom de pele vai para a faixa de cor de pele (a* 9–24, b* 10–30, matiz 35–66°). A luz verde do gramado, o
     casaco ou a sombra azulada puxavam o tom para o cinza-esverdeado.
   - **Tirar a luz da foto:** a média local da pele (normalização com pesos, σ 3,5% da textura) sai e o tom fica. O
     brilho do flash é comprimido. A barba, os olhos e a boca ficam como estão.
   - **Cabelo:** recebe a cor da foto só FORA do rosto. Os olhos e a boca da textura base viravam manchas marrons.
   - **A costura da UV:** o mesmo ponto em duas ilhas, no alto da cabeça e no meio da testa. Os dois lados vão para a
     média ao longo de cada aresta.
   - **Borda:** a borda escura das ilhas da textura base é refeita a partir de dentro.
   - **Margem:** 24 px para fora, para o mipmap não puxar o preto.
   - **Saída:** `<liga>/<chave>.webp` (512², WebP 86), `<liga>.json` (nome, pele, foto com título/data/autor/licença/
     página, a pose e a expressão) e `CREDITOS-<liga>.md`.

## Como refazer uma liga

O ambiente precisa do venv com `mediapipe`, `opencv-python` e `numpy`. Na 1ª vez, o MediaPipe precisou de
`apt-get install libegl1 libgles2`.

Os modelos:
- `face_landmarker.task` e `selfie_multiclass_256x256.tflite` (MediaPipe, Apache 2.0);
- `canonical_face_model.obj` (MediaPipe, Apache 2.0);
- `face_recognition_sface_2021dec.onnx` (Apache 2.0) e `face_detection_yunet_2023mar.onnx` (MIT), do OpenCV Zoo, pelo
  Hugging Face `opencv/face_recognition_sface` e `opencv/face_detection_yunet`. O `github.com/opencv` não está liberado
  nesta máquina.

```bash
E=<pasta de trabalho>; H=golaco/tools/rostos-reais; M=$E/modelos; R=$E/reais
# a cabeça (uma vez): render de frente + malha com UV
$B -I $H/rb_cabeca.py $E/out/sm02_lods.glb $T/Textures/m301_head_color.tga $R/rb_frente.png $R/rb_cabeca.npz
# as fotos (≈ 15 s por jogador; retoma de onde parou)
FOTO_SFACE=$M/face_recognition_sface_2021dec.onnx FOTO_YUNET=$M/face_detection_yunet_2023mar.onnx \
  FOTO_REF=legacy-total-match/assets/jogadores FOTO_N=20 \
  $P -I $H/fotos_html.py legacy-total-match/assets/CREDITOS-imagens.md br $M/face_landmarker.task $R/br3
# as texturas
$P -I $H/processar_liga.py $R/br3/manifesto.json br $R/rb_frente.png $R/rb_cabeca.npz $M/canonical_face_model.obj \
  $E/prev/m301_head_color_1024.png $E/prev/m301_body_color_1024.png $M/face_landmarker.task \
  $M/selfie_multiclass_256x256.tflite $E/rasc golaco/assets/rostos-reais
node golaco/tools/teste-rostos-reais.mjs --liga br
```

Para conferir: `teste-rostos-reais` (Node) e `teste-corpo-tela` C4/C5 (navegador).
