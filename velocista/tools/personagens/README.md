# Personagens da história (Caitlin, Cisco) — como refazer `velocista/assets/personagens/`

Os programas são cópias adaptadas de `golaco/tools/humano/` (lá está a explicação do encaixe): aqui o corpo, a cabeça e as
mechas de cabelo saem separados e só há o LOD1 (celular). As mechas soltas do Rocketbox não ficam no jogo (a textura
delas não encaixa); o cabelo é o da malha da cabeça. Nada daqui vai para o site.

1. Rocketbox (MIT), só o avatar e a licença (`$E` = uma pasta de rascunho):
   ```bash
   git clone --depth 1 --filter=blob:none --no-checkout https://github.com/microsoft/Microsoft-Rocketbox $E/rocketbox
   cd $E/rocketbox && git sparse-checkout set --no-cone LICENSE.md '/Assets/Avatars/Professions/Medical_Female_02/Export/Medical_Female_02.fbx' \
     '/Assets/Avatars/Professions/Medical_Female_02/Textures/*' '/Assets/Avatars/Adults/Male_Adult_04/Export/Male_Adult_04.fbx' \
     '/Assets/Avatars/Adults/Male_Adult_04/Textures/*' && git checkout
   ```
2. Um venv com o `bpy` (5.2 no Python 3.13; o 4.5 também serve) — ele tem o numpy.
3. Para cada personagem (`B` = o Python do venv, `S` = esta pasta, `o` = a saída):
   ```bash
   $B -I $S/glb.py <avatar.fbx> $o/rb
   $B -I $S/extrair.py $o/rb_lods.glb $o/rb.npz
   $B -I $S/encaixar.py $o/rb.npz $o/enc
   $B -I $S/pesos.py $o/enc.npz $o/enc-repouso.json $o/pesos.npz
   (cd $o && $B -I $S/lods.py $o/pesos.npz $o/lods.npz)
   # sem as mechas soltas:
   $B -I -c "import numpy as np; d=np.load('$o/lods.npz'); np.savez('$o/sem.npz', **{k: d[k] for k in d.files if not k.startswith('cabelo')})"
   $B -I $S/exportar_bin.py $o/sem.npz $o/enc-repouso.json velocista/assets/personagens/<nome> "Microsoft Rocketbox <avatar> (MIT)…"
   ```
4. Texturas: `<pre>_body_color.tga` → `corpo.webp` e `<pre>_head_color.tga` → `cabeca.webp`, 1024 px (Pillow, WebP 82/86).
5. Conferir: `node velocista/tools/vista-equipe.mjs <pasta>` (retratos e o Cortex) e `node velocista/tools/teste-historia.mjs --celular`.
