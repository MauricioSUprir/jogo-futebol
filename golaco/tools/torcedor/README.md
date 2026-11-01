# Torcedor 3D (item 69, PR 2) — como refazer `golaco/assets/torcedor/torcedor.bin`

Nada daqui vai para o site. Os programas em Python rodam FORA do repositório, nos mesmos dois venvs do
`tools/humano/README.md` (o do `bpy` 4.5 e o com `numpy scipy pillow`); os arquivos baixados ficam numa pasta de rascunho
(`$E`), sempre com `-I` (os arquivos baixados não são código).

1. Rocketbox (MIT): o clone do `tools/humano/README.md` com os dois avatares e a textura de cor do corpo e da cabeça:
   ```bash
   cd $E/dl/rocketbox && git checkout HEAD -- Assets/Avatars/Adults/Male_Adult_16 Assets/Avatars/Adults/Female_Adult_17
   ```
2. Na ordem (`B` = o Python do bpy, `P` = o outro, `R` = `$E/dl/rocketbox/Assets/Avatars/Adults`):
   ```bash
   for a in Male_Adult_16 Female_Adult_17; do $B -I golaco/tools/torcedor/extrair.py $R/$a/Export/$a.fbx $E/enc/$a.npz 300 120; done
   $P -I golaco/tools/torcedor/torcedor.py golaco/assets/torcedor/torcedor.bin $E/rel.json \
     $E/enc/Male_Adult_16.npz $R/Male_Adult_16/Textures/m019_body_color.tga $R/Male_Adult_16/Textures/m019_head_color.tga \
     $E/enc/Female_Adult_17.npz $R/Female_Adult_17/Textures/f006_body_color.tga $R/Female_Adult_17/Textures/f006_head_color.tga
   ```
   - `extrair.py`: no Blender sem janela, os pesos nos 22 ossos do jogo, sem o cabelo em cartões/cílios/olhos/dentes, a
     costura do pescoço soldada e os 2 níveis por Decimate (colapso, simétrico): o nível 0 da malha original (~300
     triângulos) e o nível 1 do nível 0 (~120), com o joelho e o cotovelo protegidos (`TORC_RAIO` 0,09 m, `TORC_FATOR` 3).
   - `torcedor.py`: as regiões de cor pela textura, as 8 poses da torcida (cinemática direta + inversa de 2 ossos; sentado
     com as nádegas no assento a 0,43 m, as costas na frente do encosto e os pés no piso; de pé na passagem livre) e o
     arquivo `TCD1` (formato no topo de `js/render/torcedor-dados.js lerModelo`).
3. Conferir: `node golaco/tools/teste-torcida.mjs` (seção G: sentado na cadeira, rumo, poses, cachecol, escolha) e
   `node golaco/tools/teste-estadio.mjs` (item 9: a VAT na GPU = no JS; item 14b: o torcedor 3D no jogo).
