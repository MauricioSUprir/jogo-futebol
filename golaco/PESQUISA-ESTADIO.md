# GOLAÇO — pesquisa do estádio: rede que balança, efeito de gol, torcida e som

Pedido do dono (10/10): "quero um efeito de rede, efeito de gol, quando a rede balança, quando sai gol, isso que eu
quero, que tenha torcida no estádio, e com barulho de torcida". Esta é a primeira versão (a Etapa 6 completa traz
torcida cantando alto, pré-jogo, replay e comemoração). Tudo aqui é DESENHO e SOM: a lógica do jogo e o hash não
mudam (`tools/hash-igual.mjs` IGUAL, `tools/hash-partida.mjs` IGUAL à publicada).

## 1. Rede que balança (`js/render/rede-onda.js`, `js/render/campo.js`)

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| Patente EA US 8.000.947, "Particle-based cloth simulation using Verlet integration with fixed and stiff-spring constraints supporting collision detection and reaction with projectiles in sports video games" | Rede de jogo de esporte como malha de partículas com molas, pontos presos na armação, reação localizada à bola e propagação pelo tecido; antes disso os jogos usavam animação ou corpos rígidos | Os três sinais visuais: bolsa NO PONTO da batida, onda que corre pelo pano e borda presa na armação (`fixo()`: 0 na trave, travessão e barras). Sem simular partículas: a resposta é analítica no vertex shader (sem estado na GPU, igual em todo quadro, barata no celular) |
| Daniel Holden, "Spring-It-On: The Game Developer's Spring-Roll-Call" (a mesma referência da mola da câmera) | Mola amortecida exata; subamortecida passa do ponto e volta | A bolsa é a resposta de um oscilador subamortecido a um impulso: e^(−ζωτ)·sin(ω_d τ), 2 Hz, ζ = 0,3 — pico em 0,106 s, volta passando do ponto (−37%) e para em ~1,1 s (janela até 1,6 s) |
| Ondaleta de Ricker ("chapéu mexicano", sismologia) | Pulso que se propaga com um lóbulo positivo e dois negativos | A onda que corre pelo pano a 6,5 m/s a partir da batida (o "balanço") |
| three.js r170 — `Material.onBeforeCompile`, `customProgramCacheKey`, uniforms de vetor (`uniform4fv` com Float32Array) | Injetar código no shader de um material pronto, sem perder luz, névoa e mapa | A rede continua um `MeshLambertMaterial` com a mesma textura; o vertex shader ganha `redeDesloc` (REDE_GLSL gerado das MESMAS constantes da conta em JS) e até 4 batidas em `uRedeA/uRedeB` |
| Física da bola do projeto (`bola.js`: rede devolve 2% da velocidade) | A bola "morre" no plano da rede | A bola DESENHADA entra na bolsa e volta com ela (`empurraoBola`): a bola encostada vai junto quando a rede estufa e a rede que volta nunca passa por dentro dela (teste: ≤ 1 cm) — o ponto da física (e o hash) fica igual |

Números escolhidos (testados em `tools/teste-rede.mjs` com a física de verdade): bolsa = 0,7·(1 − e^(−v/14)) m (25 m/s →
0,58 m; 5 m/s → 0,21 m; abaixo de 0,8 m/s nada), raio 0,75 m, borda presa de 0,6 m (0,25 m na barra do chão — o chute
rasteiro também estufa), centro da bolsa a ≥ 0,55 m da armação (batida no canto faz a bolsa na parte solta, não uma dobra
na trave), 30% da batida chega aos outros panos do mesmo gol. Batidas achadas comparando a bola antes/depois de cada passo
(encostada no plano e perdendo ≥ metade da velocidade normal): por dentro estufa para fora; por fora (lateral, teto, fundo
por trás) afunda para dentro; trave, travessão, bola por cima e para fora não contam.

## 2. Efeito de gol (`js/hud.js`, `css/estilo.css`, `js/render/camera.js`)

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math" (GDC 2016) | Tremor de câmera por "trauma" que decai, com ruído suave (não aleatório quadro a quadro), translação + rotação pequenas | Tremor que decai em 0,3 s, soma de senos lentos (6–9,5 Hz, determinístico), ≤ 12 cm (a 44 m do foco: ~0,15°), metade dele no "olhar"; zoom de 9% que entra em 0,35 s e sai até 2,4 s; o foco puxa 30% para a boca do gol |
| MDN `prefers-reduced-motion` | Quem pede menos movimento no sistema | Sem tremor, metade do zoom e o "GOL!" sem a animação de batida |
| Transmissões de TV / EA FC (o "GOL" gráfico) | O gráfico entra logo depois do lance e fica no terço de baixo, sem tampar a jogada | "GOL!" entra 0,3 s depois (a rede estufa primeiro, sem nada na frente), no terço de baixo (62% da altura no celular, 70% no PC), com o número e o nome do autor (elenco fictício), "Gol contra" quando for, o time e o minuto; placar pulsando (só brilho, sem mudar de tamanho: nada encosta no minimapa); some em 2,4 s, antes da saída de bola (2,5 s, `PARTIDA.golPausa`), e não pega toque nem clique |

## 3. Torcida no estádio (`js/render/torcida-dados.js`, `js/render/torcida.js`)

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| NVIDIA GPU Gems 3, cap. 2 "Animated Crowd Rendering" (B. Dudash) | Milhares de personagens numa chamada (instancing), animação na GPU, nível de detalhe para quem está longe | Os torcedores em 3 malhas instanciadas, uma por arquibancada (≤ 3 chamadas de desenho; corte por caixa contra o frustum da câmera: com a câmera de TV no meio-campo os dois fundos — 60% da torcida — nem vão para a GPU), pose/pulo/balanço no vertex shader por uniforms de ânimo, nada por quadro na CPU além do corte; quantidade por qualidade (Baixa 38% das cadeiras e sem animação, Média 62%, Alta 90%) |
| Akenine-Möller et al., "Real-Time Rendering", billboards axiais | Objeto simétrico em volta do eixo vertical (árvore, pessoa) pode ser um quadro que gira só em y | Cada torcedor é um quadro virado para a câmera girando em y (de longe, gente; sem tombar de cima) |
| Ben Golus, "Anti-aliased Alpha Test: The Esoteric Alpha To Coverage"; Ignacio Castaño, "Computing Alpha Mipmaps" | O mipmap tira opacidade das partes finas e a figura "some" de longe; corrigir o alfa pelo nível do mipmap | `a · (1 + 0,22·nível)` no fragment shader: braços e cabeças não somem de longe |
| Atlas por máscaras (técnica comum de impostores coloridos por instância) | Uma figura em tons de região + cor por instância | Atlas de 8 poses desenhado por código (SDF de cápsulas/círculos), canais = pesos de camisa, pele, cabelo/calça e o resto = acento (cachecol): cada torcedor tem camisa, pele e cabelo próprios sem textura nova; os pesos já vêm vezes a cobertura (o mipmap médio continua certo) |
| Regulamentos de estádio (UEFA, segregação de torcidas) e o costume dos estádios | Torcida visitante num setor separado por cadeiras vazias | Golaço FC (mandante) em quase tudo (87,6% na Alta), organizada no fundo +x (sempre em pé, pulando no ritmo, cachecóis), setor visitante (Ventania FC, branco e cinza) no fundo −x com 4 m de cadeiras vazias de cada lado, alguns visitantes espalhados |
| Mosaicos de torcida (coreografia) | O desenho na arquibancada feito pelas pessoas | As cadeiras do "GOLAÇO" do lado de lá viram camisas verdes: o nome continua lendo com a torcida sentada em cima |

Ânimo (`js/render/emocao.js`, o mesmo para a torcida 3D e o som): murmúrio pela bola no terço final de qualquer lado; a
torcida do time que ataca levanta; gol = explosão (todo mundo em pé, braços para cima, pulando; segura 2,6 s e cai em ~3,5 s)
e a outra torcida põe a mão na cabeça; chute perigoso perdido (defesa, trave, para fora rente à trave) = "uuuh" e mãos na
cabeça; a outra torcida aplaude a defesa; apitos na saída, no intervalo e no fim. A regra da pose é a mesma no shader e em
`poseDoTorcedor` (testada em Node).

## 4. Som da torcida (`js/render/som.js`, `assets/sons/`)

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| MDN, "Autoplay guide for media and Web Audio APIs"; Chrome, "Autoplay policy" | O AudioContext só toca depois de um gesto; criar/retomar (`resume`) dentro dele | O contexto só é CRIADO no primeiro toque, clique ou tecla (nada antes, sem aviso no console); página escondida suspende |
| Sound Particles, "How Paul Boechler Created Live Stadium Crowds From FIFA Recordings" (o sistema de torcida do FIFA usado nas transmissões de 2020) | Uma base de torcida "de fundo" de gravações reais + camadas disparadas pelo jogo (gol, quem marcou, lance) com os melhores momentos destacados | Base: murmúrio do estádio em laço; camada "agitada" que sobe com a bola no terço final; canto ao fundo indo e voltando; reações disparadas pelos eventos (explosão do gol, "uuuh", palmas); tudo gravação real de estádio/torcida |
| MDN `AudioBufferSourceNode.loopStart/loopEnd`; atraso/enchimento do codificador MP3 (LAME) | Laço por pontos; o MP3 pode ganhar silêncio no começo/fim | Laços com cruzamento de potência igual e 0,25 s de margem periódica dos dois lados: o jogo toca de 0,25 s até 0,25 s + período — sem buraco nem estalo mesmo se o decodificador não cortar o atraso (conferido: emenda abaixo do passo típico do sinal) |
| MDN `BiquadFilterNode`, `DynamicsCompressorNode`, `AudioParam.setTargetAtTime` | Filtros, compressor, rampas suaves | Pausa abaixa e abafa a torcida (passa-baixas 900 Hz); compressor no fim (gol + laços não estouram); ganhos mudam com rampa (0,35 s) e só quando o alvo muda |
| Gravações livres | — | Work With Sounds / Torsten Nilsson, "Football Austria vs. Sweden" (Ernst Happel, CC BY 4.0): murmúrio, agitado, canto e "uuuh"; Gregor Quendel, "Free Crowd Cheering Sounds" (CC BY 4.0): explosão do gol e palmas; SpliceSound, apito do árbitro (CC0). Créditos em `assets/sons/CREDITOS.md` |

Sem gravação livre boa: o "chuá" da bola na rede e a batida do chute são feitos por código (ruído filtrado com envelope
curto; grave que cai). O "uuuh" é um trecho real da gravação do estádio (reação a um lance), não um "uuuh" de estúdio.
