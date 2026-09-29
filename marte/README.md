# Jezero — sobrevivência em Marte

Jogo 3D de sobrevivência em Marte que roda no navegador (PC e celular), feito com
three.js (WebGL 2) e Rapier (física em WebAssembly). Sem etapa de build: arquivos
estáticos, publicados pelo GitHub Pages em `/marte/`.

## Fase 1 — protótipo jogável (esta entrega)

- **Relevo real** da cratera Jezero: HiRISE DTM a 1 m/px (2 × 2 km jogáveis, 18,58° N
  77,25° L) e CTX DTM a 20 m/px até 6,4 km para o horizonte. Algumas crateras de 4 a 45 m
  foram adicionadas por procedimento, porque o DTM suaviza as menores.
- **Física real**: gravidade de 3,71 m/s² (pulo de ~0,68 m e ~1,2 s no ar), controlador de
  personagem com passo fixo de 60 Hz, colisão com o heightfield do terreno, cascos
  convexos em ~2 a 6 mil rochas e paredes no limite do mapa.
- **Céu e tempo marcianos**: um sol de 24 h 39 min (1 sol = 40 min de jogo), Sol com 0,35°
  de diâmetro aparente, céu caramelo de dia e halo azul no pôr do sol, estrelas, Terra,
  e Fobos e Deimos em órbitas reais. Temperatura, pressão e vento variam ao longo do dia.
- **Gráficos**: materiais PBR (texturas CC0 recoloridas), mistura por altura entre
  regolito, areia e rocha, sombras em cascata (CSM), IBL do céu, tone mapping ACES,
  névoa de poeira com dispersão para frente, poeira balística e pegadas.
- **Controles**: teclado e mouse, joystick virtual com botões no celular e gamepad.
  Câmera em 3ª pessoa (com colisão) e em 1ª pessoa (vista de dentro do capacete).
- **Qualidade** automática ou manual (Baixa, Média, Alta e Ultra), com resolução dinâmica.
- Som procedural do traje (respiração, ventoinha, passos e vento abafado), salvamento
  automático e opções de acessibilidade.

## Rodar localmente

```bash
cd marte && python3 -m http.server 8000
# abra http://localhost:8000
```

Parâmetros úteis na URL: `?quality=low|medium|high|ultra`, `?autostart=1`, `?hour=18.1`,
`?fps=1`.

## Regerar os dados do terreno e das texturas

Rode `python3 tools/build_assets.py <pasta_dos_downloads> .` (os dados brutos têm ~180 MB e não ficam no repositório). Os arquivos-fonte estão em
`https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/` (HiRISE e CTX)
e em ambientCG (Ground079S, Ground096B e Rocks011, versão 2K-JPG). Veja o cabeçalho do script.

## Créditos

NASA / JPL-Caltech / University of Arizona / USGS Astrogeology (dados de relevo, domínio
público) · ambientCG (texturas CC0) · three.js (MIT) · Rapier (Apache-2.0).
