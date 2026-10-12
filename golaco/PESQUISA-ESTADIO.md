# GOLAÇO — pesquisa do estádio: rede que balança, efeito de gol, torcida e som

Pedido do dono (10/10): "quero um efeito de rede, efeito de gol, quando a rede balança, quando sai gol, isso que eu
quero, que tenha torcida no estádio, e com barulho de torcida". Esta é a primeira versão (a Etapa 6 completa traz
torcida cantando alto, pré-jogo, replay e comemoração). Tudo aqui é DESENHO e SOM: a lógica do jogo e o hash não
mudam (`tools/hash-igual.mjs` IGUAL, `tools/hash-partida.mjs` IGUAL à publicada) — menos a seção 6 (rede véu de noiva,
11/10), que muda a FORMA da rede também na física da bola atrás da linha.

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
| Transmissões de TV / EA FC (o "GOL" gráfico) | O gráfico entra logo depois do lance, sem tampar a jogada | "GOL!" entra 0,3 s depois (a rede estufa primeiro, sem nada na frente), no terço de CIMA, por cima da torcida (depois da contraprova: na câmera do gol a boca do gol fica do meio para baixo; no celular, compacto entre o analógico e os botões — seção 5); o autor e o minuto saíram na integração (dono, 10/10: "não quero narração em cima"); placar pulsando (só brilho, sem mudar de tamanho: nada encosta no minimapa); some em 2,4 s, antes da saída de bola (2,5 s, `PARTIDA.golPausa`), e não pega toque nem clique |

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

## 5. Correções depois da contraprova (fonte → o que aproveitamos)

A contraprova adversarial achou 1 bloqueante (B1), 5 importantes (I1–I5) e 10 menores (M1–M10). O que foi pesquisado
para cada correção:

| Achado | Fonte | O que aproveitamos |
|---|---|---|
| I2 rede que quase não se via; I3 torcida fora do quadro no celular | Gramática de transmissão de TV (o diretor CORTA para o plano fechado depois do gol; o eixo de 180°: a câmera fica do mesmo lado para esquerda e direita não inverterem) | No gol da partida a transmissão corta para a câmera do gol (`camera.js CAMERA_GOL`): do lado da câmera de TV, baixa (2,6 m) e ~60° fora do eixo do gol — a rede de fundo estufa de PERFIL (a bolsa anda ~37 px na tela; na câmera de TV andava ~13 px) e a arquibancada atrás do gol (a organizada explodindo) enche ~29% do quadro, no PC e no celular. Volta com outro corte na saída de bola. Intervalo e fim: plano geral do estádio |
| idem (enjoo) | Guias de conforto de câmera em jogos e realidade virtual (Meta/Oculus, "locomotion": aceleração contínua da câmera enjoa; corte instantâneo não) e Eiserloh (GDC 2016) | Nada de travelling rápido até o gol: só cortes; dentro do plano, aproximação lenta (o fov fecha 7% em 2,5 s) e um tranco de 3,5 cm que morre em 0,22 s; com "reduzir movimento" do sistema, sem aproximar nem tremer |
| I2 (luz) | GPU Gems 1, cap. 1 (Finch, "Effective Water Simulation from Physical Models"): a normal da superfície deslocada no vertex shader sai da derivada do deslocamento; three.js r170 `beginnormal_vertex`/`objectNormal` | O shader da rede refaz a normal pela inclinação da bolsa (diferença finita a 10 cm nos dois eixos do pano, com `redeFixo`): a luz muda na dobra |
| M1 bola furando a rede nos cantos | Müller et al., "Position Based Dynamics" (2007): restrições resolvidas por projeção, em passadas (Gauss-Seidel) | `empurraoBola` termina projetando a bola desenhada contra CADA pano deformado em que a física encosta, em 3 passadas: em 14 partidas, quadros com furo > 1 cm 284 → 0 (pior 6,7 → 0,1 cm) |
| I1 grito do gol atrasado | Vroomen e Keetels (2010), "Perception of intersensory synchrony: a tutorial review": som atrasado mais que ~0,1–0,2 s deixa de "pertencer" ao lance | O recorte do grito começa na subida (5,3 s da gravação): já sai a ~6 dB do pico (antes, −34 dB nos primeiros 2,5 s; só ficava alto aos 4–5 s, depois da saída de bola) |
| I4 a casa rugia no gol do visitante | Sound Particles sobre a torcida do FIFA (reações por time: festa de um lado, lamento do outro) | O barulho geral só vai ao máximo no gol da casa; no gol do visitante cai para ~0,06 em 0,5 s e só toca a festa do setor visitante, baixa e abafada |
| I5 apito do início | MDN e Chrome, política de reprodução automática (o som só começa num gesto) | O apito da saída do começo fica PENDENTE e toca quando o som é liberado, se em até 6 s; o "Reiniciar partida" também apita |
| M7 som desligado ligava o Web Audio | MDN `AudioContext.suspend()` (libera o hardware de áudio: menos CPU e bateria) | Desligado, o gesto não cria contexto e nada baixa; desligar com o contexto rodando abaixa e SUSPENDE |
| M3 custo por pixel da torcida | Guias de GPU de celular (Arm Mali Best Practices e Apple Metal Best Practices: geometria com alpha test custa por pixel; desenhar da frente para trás; quadros justos); Persson (Humus), "Particle trimming" (polígono justo em volta do sprite corta a sobreposição) | Quadro de cada torcedor na medida da pose (`CAIXA_POSE`: sentado 38% do quadro cheio, média 58%) e torcedores da fileira da frente para cima (o teste de profundidade descarta cedo os de trás) |
| M4 trocar a qualidade remontava a torcida | three.js `InstancedBufferGeometry.instanceCount` | Todos os torcedores montados uma vez e as qualidades são prefixos (o mesmo sorteio por cadeira): trocar = quantos desenhar e um uniform (0,9 ms com a CPU 4× mais lenta; antes ~300 ms) |
| M5 autor do gol errado | Critérios de súmula para gol contra (Premier League e UEFA, "goal accreditation": chute no alvo desviado conta para quem chutou; o último toque de verdade de outro jogador do adversário é gol contra) | `autor-gol.js`: último toque pelos eventos (a condução e o domínio contam); desvio/defesa do adversário depois do chute → gol de quem chutou |
| M9 contas do shader e do JS escritas à mão duas vezes | WebGL2 + `EXT_color_buffer_float` (ler de volta, em float, o que o shader calculou) | A pose (`POSE_GLSL`) sai das mesmas constantes do JS (`POSE_REGRA`), e o `teste-estadio` avalia a pose e a rede NO SHADER de verdade (4096 casos cada) e compara com o JS |
| B1 teste preso à semente 6 | — | Gol roteirizado no `teste-estadio` (`tools/lib/gol-roteirizado.mjs`: a física da bola com velocidade conhecida, defensores e goleiro fora do caminho) e gol de verdade achado em Node para os prints (`tools/lib/acha-gol.mjs`); conferido com a lógica do PR 1 e do PR 3 por cima desta branch |
| M2 "GOL!" embaixo dos botões | Layout medido nos celulares (568×320, 667×375, 844×390) | No celular, o "GOL!" fica compacto logo abaixo da barra de cima e no meio, entre o analógico e o arco de botões; no PC, no terço de cima (na câmera do gol a boca do gol fica do meio para baixo) |

## 6. Rede véu de noiva e branca (pedido de 11/10; `js/rede-forma.js`, `js/bola.js`, `js/render/rede-onda.js`, `js/render/campo.js`)

Pedido do dono: "as redes têm que ser brancas, e ter uma movimentação na rede quando a bola toca nela, quero que seja
em véu de noiva". Diagnóstico da versão publicada (medido): a rede era uma CAIXA de 2 m ("caixote", com teto plano e
armação cinza atrás), cinza-esverdeada (fio de perto L* 79 de dia e 50 à noite, puxado para o azul), ESCURECIA o gol
na câmera de TV (ΔL* −7 a −10) e quase não mexia na tela (0,8–3,1% dos pixels do gol na câmera do gol, 0% na TV):
a textura de losango de 128 px cobre ~7% do pano e vira uma névoa escura com o mipmap, o material não tinha luz
própria (a face que a câmera vê fica de costas para o sol) e o shader ainda escurecia a bolsa em até 45%.

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| Super Rádio Tupi (08/03/2022), "Próximo da reabertura, Maracanã confirma retorno das redes véu de noiva" (https://www.tupi.fm/sentinelas/proximo-da-reabertura-maracana-confirma-retorno-das-redes-veu-de-noiva-confira/) + a foto da rede nova | A rede véu de noiva "estufa a costura e vai morrer no fundo do gol"; contraste com o "padrão Fifa, formato retangular" de 2013–2014. A foto mostra a trama colmeia branca, sem caixa nem suportes atrás, a lateral com a borda em curva do canto de cima até o chão bem atrás do gol | A forma (faixa de cima curta e a curva longa até o chão, sem teto), a trama COLMEIA branca e a física "morre no fundo": por dentro o véu segura a bola e ela escorrega até a cunha do fundo |
| GloboEsporte (29/07/2013), "Concessionária do Maracanã estuda voltar com modelo tradicional da rede" (https://m.globoesporte.globo.com/futebol/noticia/2013/07/concessionaria-do-maracana-estuda-voltar-com-modelo-tradicional-da-rede.html; reproduzida pelo NETFLU: https://www.netflu.com.br/concessionaria-estuda-retornar-com-redes-antigas-do-maracana/) | "As antigas tinham uma haste nos cantos superiores, de aproximadamente 40 cm, que apoiava a rede e fazia com que ela caísse na diagonal e estufasse na hora do gol" | Hastes de 0,45 m nos cantos de cima (`CAMPO.gol.veu.haste`) e nada atrás do gol; a armação desenhada é só postes, travessão, as duas hastes e as cordas do chão |
| Agência Brasil (03/2022), reabertura do Maracanã (https://agenciabrasil.ebc.com.br/esportes/noticia/2022-03/com-novo-gramado-maracana-reabre-sabado-com-flamengo-x-bangu) | "A volta da famosa rede véu da noiva, que estufa quando os jogadores acertam a bola no alvo" | O que importa é a bolsa no gol: o véu é mais solto que a caixa (1,6 Hz, ζ 0,24, bolsa até 0,85 m, dura 1,9 s) |
| gov.br, Relatório da dispensa 19/2023 (especificação de redes de campo, item "Fio 4mm Tipo Véu"; https://www.gov.br/casacivil/pt-br/acesso-a-informacao/licitacoes-e-contratos/secretaria-de-administracao/contratacoes-diretas/2023/relatorio-da-dispensa-19-2023.pdf) | Rede 7,50 × 2,50 m, recuo superior 0,60 m e inferior 2,00 m, malha 15 × 15 cm, fio 4 mm, cor BRANCA | Confirma o recuo de cima curto e o de baixo longo; o véu do Maracanã é mais fundo embaixo (2,8 m: `fundo`); malha ~15 cm na malha do desenho |
| Listagens do mercado brasileiro ("Rede Oficial de Futebol Modelo México (Caixote) Trama Colmeia", Bondfaro: https://www.bondfaro.com.br/rede-tenis) | "Caixote" = rede em caixa; "trama colmeia" = malha hexagonal | Vocabulário: o jogo tinha o caixote; o véu usa a trama colmeia |
| nets4you, redes "continental" (https://www.nets4you.com/products/single-full-size-continental-football-goal-nets-3mm-diameter) | Estilo europeu: topo ~0,8 m, base ~2 m, malha 120 mm, fio 3–4 mm | Célula de 12 cm; o fio de 6 mm é exagerado de propósito para aparecer na TV |
| Ben Golus, "The Best Darn Grid Shader (Yet)" (https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8; versão do LÖVR em https://lovr.org/docs/v0.19.0/Environment/Grid_(Smooth)) | Linha com largura mínima de ~1 px pela derivada de tela ("phone-wire AA") e, quando a célula fica menor que um pixel, troca pela média (sem moiré) | Fio que nunca afina abaixo de ~1 px (só fica até 15% mais transparente: `opacMin` 0,85) e, longe (célula < ~2 px), véu branco uniforme de opacidade 0,32 (`longe`) — ao longe a rede CLAREIA o gol em vez de escurecer |
| Evan Wallace, "Anti-Aliased Grid Shader" (https://www.madebyevan.com/shaders/grid/) | fwidth = \|dFdx\| + \|dFdy\| para a largura e a borda da linha em pixels | Largura e borda do fio da colmeia em pixels (derivadas de tela no fragment shader) |
| "Hexagon rendering" (https://gameutility.bearblog.dev/hexagon-rendering/) | Grade hexagonal no shader: a célula mais perto entre duas grades deslocadas e a distância até a borda | `redeHexBorda` no fragment shader: a trama colmeia sem textura (sai a `texRede` de 128² com mipmaps, ~87 KB na GPU) |
| Patente EA US 8.000.947 e Müller et al. 2007 (Position Based Dynamics), seções 1 e 5 | Bolsa no ponto, onda pelo tecido, armação presa; restrição por projeção | Os mesmos sinais, agora contra o perfil do véu: a deformação vira um CAMPO VETORIAL (cada batida empurra pela normal do véu no ponto da batida), então o véu e as laterais mexem juntos sem rasgar na emenda; a bola desenhada continua presa ao véu deformado (furo ≤ 0,1 cm) |

Forma escolhida (uma só, em `rede-forma.js`, para a física, a regra do gol e o desenho): faixa de cima de 0,45 m e a
parábola tangente ao chão até 2,8 m — a profundidade cai com a altura (y 0,11 → 2,30 m · 0,5 → 1,74 · 1,0 → 1,30 · 1,5 →
0,96 · 2,0 → 0,67 · 2,44 → 0,45); inclinação de 61° perto do topo, 47° a 0,64 m e 19° perto do chão; perfil de 3,99 m;
a bola parada no chão para na cunha com o centro a 2,06 m. A parábola (corrente com carga uniforme na horizontal) é
quase a catenária e só usa + − × ÷ e raiz: igual bit a bit em todo motor JS (`teste-determinismo`, Node = Chromium).

Por que a física muda junto: com o véu desenhado e a física da caixa, um chute a 1 m de altura pararia 0,59 m ATRÁS da
rede desenhada (e a bola por cima do travessão ficava no teto a 2,55 m para sempre). Agora a bola encosta onde a rede
está (medido pela física: y 0,11 → 2,06 m · 0,84 → 1,28 · 1,40 → 0,89 · 1,97 → 0,56 · 2,28 → 0,41 m) e morre no fundo
em ≤ 3 s; 0/600 bolas de dentro escapam e 0/600 de fora entram (Monte Carlo do `teste-rede-veu`). O gol continua sendo a
bola passar a linha; a bola atrás do véu não conta.

Antes → depois (mesmas ferramentas; `teste-rede-tela` = navegador, rede montada numa tela à parte, sem IA nem semente):

| Medida | Antes (caixote) | Depois (véu) | Meta |
|---|---|---|---|
| Forma da malha (gol +x): fundo no chão / no alto / vértices de teto | 2,00 / 2,00 m / 466 | 2,80 / 0,45 m / 0 (2,80 → 1,45 → 0,86 → 0,52 m por faixa de altura) | ≥ 2,4 / ≤ 0,6 / 0 |
| Física: onde a bola encosta (y 0,11 → 2,28 m) | 1,89 m em toda altura | 2,06 → 0,41 m | rasteiro ≥ 1,8, alto ≤ 0,9 |
| Fio de perto (L*, percentil 90), PC dia / noite | 78,9 / 49,8 (sat 0,19 à noite) | 87,2 / 89,7 (sat ≤ 0,03) | ≥ 85 / ≥ 80, sat ≤ 0,08 |
| Fio de perto, celular dia / noite | 78,5 / 50,1 | 86,9 / 89,7 | ≥ 85 / ≥ 80 |
| TV: a rede clareia o gol (ΔL*), 4 configurações | −7,1 a −9,5 (escurece) | +17,0 a +19,1 | ≥ +5 |
| Câmera do gol: ΔL* | −1,1 a +7,4 | +30,8 a +36,0 | ≥ +12 |
| Mexe no pico da bolsa: pixels do gol que mudam > 20 (câmera do gol / TV / perfil) | 0,8–3,1% / 0,0% / 0,2–0,5% | 5,5–5,7% / 2,2–2,5% / 4,5–4,7% | ≥ 4% / ≥ 1% |
| Custo (as duas redes) | 4.052 vértices, 7.348 triângulos, 2 chamadas, textura 128² | 4.160 (+2,7%), 7.724 (+5,1%), 2 chamadas, sem textura | ≤ +10%, mesmas chamadas |
| Painel de equilíbrio, gols por partida (288 partidas IA × IA, sementes 1001–1144 e 2001–2144, `--base`) | 1,98 | 1,98 (diferença pareada +0,00 ± 0,20) | não cair |
| Painel, chutes por partida (as mesmas 288) | 9,42 | 9,22 (−0,21 ± 0,53: dentro do ruído) | não cair |

O gol continua sendo a bola passar a linha: o véu só muda o que acontece DEPOIS dela (e as previsões da bola que passam
da linha), então a partida diverge no 1º chute ao gol e as duas amostras de 144 andam para lados opostos (1ª: gols 2,13
→ 1,99, chutes 9,58 → 9,15; 2ª: gols 1,82 → 1,97, chutes 9,27 → 9,28) — ruído de amostra, não efeito da rede.

Luz própria (`LUZ_GOL` em `campo.js`): rede 0xaaadab de dia e de noite (de dia 0xa0a3a1 deixava o fio a 86,2, só 1 ponto
acima da meta; 0xaaadab dá 87,2 sem estourar: 0% em 255), armação 0x2a2c2b / 0x5a5c5b. Sai o escurecimento de 45% da
bolsa: a dobra aparece pela normal refeita. A bolsa começa no FIM do passo da batida (a bola desenhada, interpolada do
começo ao fim do passo, só encosta na rede no fim; com meio passo antes ela andava +40% no quadro da batida).

