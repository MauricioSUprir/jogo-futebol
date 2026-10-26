# Corpo humano (Etapa 5) — como refazer os assets de `golaco/assets/jogador/`

Nada daqui vai para o site. Os programas em Python rodam FORA do repositório, num venv; os arquivos baixados ficam numa
pasta de rascunho (`$E`).

1. Rocketbox (MIT), só o avatar e a licença:
   ```bash
   git clone --depth 1 --filter=blob:none --no-checkout https://github.com/microsoft/Microsoft-Rocketbox $E/dl/rocketbox
   cd $E/dl/rocketbox && git sparse-checkout set --no-cone LICENSE.md 'Assets/Avatars/Professions/Sports_Male_02/*' && git checkout
   ```
2. Python: um venv com o `bpy` 4.5 (`pip install bpy==4.5.*`, ~950 MB) para o Blender sem janela, e outro com
   `numpy opencv-python-headless pillow` (`-I` sempre: os arquivos baixados não são código).
3. Na ordem:
   ```bash
   B=$E/venv-bpy/bin/python; P=$E/venv/bin/python; H=golaco/tools/humano; T=$E/dl/rocketbox/Assets/Avatars/Professions/Sports_Male_02
   $B -I $H/rocketbox_glb.py $T/Export/Sports_Male_02.fbx $E/out/sm02        # FBX → GLB com 22 ossos (LOD0/LOD1)
   $B -I $H/extrair.py $E/out/sm02_lods.glb $E/enc/rb.npz                      # malhas, UV e pesos em numpy
   $P -I $H/encaixar.py $E/enc/rb.npz $E/enc/enc                              # nas medidas do jogo + repouso.json
   $P -I $H/pesos.py $E/enc/enc.npz $E/enc/enc-repouso.json $E/enc/pesos.npz  # os 6 ajudantes, ≤ 4 influências
   (cd $E && $B -I $H/lods.py $E/enc/pesos.npz $E/enc/lods.npz)              # LOD0–3
   $P -I $H/exportar_bin.py $E/enc/lods.npz $E/enc/enc-repouso.json golaco/assets/jogador
   $P -I $H/regioes.py $E/enc/lods.npz $T/Textures/m301_body_color.tga $T/Textures/m301_body_normal.tga golaco/assets/jogador 512
   ```
   A cabeça (`cabeca-rb.webp`) é a `m301_head_color.tga` em 512² (Pillow, WebP 86).
4. Conferir: `node golaco/tools/teste-ossos.mjs` (juntas, saltos, sola, dobra, assets) e
   `node golaco/tools/teste-corpo-tela.mjs` (no jogo, com `?corpo=humano`).

`repouso-do-jogo.mjs` mede a pose de pé do `anim.js` (as medidas que o `encaixar.py` usa).
