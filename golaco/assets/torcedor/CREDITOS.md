# Torcedor 3D — créditos

- **Malhas, esqueleto e texturas de origem:** Microsoft Rocketbox Avatar Library, avatares `Adults/Male_Adult_16` e
  `Adults/Female_Adult_17`, licença MIT (texto completo em `LICENSE-rocketbox.md`, "Copyright (c) 2020 Microsoft"),
  repositório https://github.com/microsoft/Microsoft-Rocketbox, commit `0943055db6ec570bcef9f2c8b41c9e5467c808f9`.
- **O que foi derivado aqui** (golaco/tools/torcedor/): as duas malhas reduzidas a ~300 e ~120 triângulos (Decimate do
  Blender, com as dobras do joelho e do cotovelo protegidas), o cabelo em cartões, os cílios, os olhos e os dentes tirados,
  os pesos nos 22 ossos do jogo, as 8 poses da torcida (as mesmas do quadro: sentado, palmas, de pé, braços em V, um
  braço, cachecol e mãos na cabeça) postas por cinemática e assadas vértice a vértice (`torcedor.bin`), o cachecol
  desenhado entre as mãos e as regiões de cor (camisa, pele, cabelo, calça, sapato) lidas da textura de cada avatar.
- **Nenhuma textura do Rocketbox é publicada:** a roupa é pintada no shader pelas cores do time da torcida (a camisa do
  quadro, o cachecol na cor do time) e a pele e o cabelo vêm do sorteio de cada torcedor.
