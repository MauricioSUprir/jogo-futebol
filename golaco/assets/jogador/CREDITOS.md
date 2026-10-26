# Corpo humano dos jogadores — créditos

- **Malha, esqueleto e texturas de origem:** Microsoft Rocketbox Avatar Library, avatar `Professions/Sports_Male_02`,
  licença MIT (texto completo em `LICENSE-rocketbox.md`, "Copyright (c) 2020 Microsoft"), repositório
  https://github.com/microsoft/Microsoft-Rocketbox, commit `0943055db6ec570bcef9f2c8b41c9e5467c808f9`.
- **O que foi derivado aqui** (golaco/tools/humano/): o esqueleto reduzido a 22 ossos com os pesos somados nos que ficam,
  a malha encaixada nas medidas do jogo (pernas, tronco, ombro e tornozelo do desenho), os 6 ajudantes de meio-giro, os 4
  níveis de detalhe, a máscara de regiões do uniforme (`regioes.png`), o mapa de normais do pano em 512² (`pano-normal.webp`)
  e a textura da cabeça em 512² (`cabeca-rb.webp`).
- **Não se publica a textura de cor do corpo do Rocketbox**: ela traz "FYA MOTORS", "ROCKETBOX", um escudo e o número 18.
  O uniforme do jogo é pintado no shader (cores dos times), e o número das costas é desenhado de um atlas de dígitos.
