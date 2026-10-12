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

## 6. Estádio cheio e som da torcida durante o jogo (pedido de 11/10)

Pedido do dono: "Coloca mais torcida no estádio, bandeirões, sinalizadores, e bota som de torcida também, pra durante o
jogo". Medido antes: o murmúrio do jogo saía a −26,9 dBFS (o apito 14,6 dB acima, e no celular a torcida "sumia"), o
canto só se ouvia em 35% do tempo e havia 1 canto só (laço de 14 s); no iPhone com a chave de silencioso o jogo ficava
mudo e, depois de bloquear a tela, o som não voltava. Na imagem, as fileiras da frente (as que a câmera de TV mostra)
estavam 37/62/88% ocupadas (Baixa/Média/Alta), o lado de cá não existia (embaixo da câmera, só o verso preto das
placas) e não havia faixa, bandeira nem sinalizador.

### 6.1 Som (`js/render/som.js`, `mixagem.js`, `festa.js`, `assets/sons/`)

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| WebKit Bugzilla 237322 (Web Audio mudo com a chave de silencioso do iPhone) | O Web Audio sai pelo canal da campainha (sessão 'ambient') e a chave de silencioso cala; a saída da Apple é `navigator.audioSession.type = 'playback'` (iOS 16.4/17+), antes de criar ou retomar o contexto | Com o som ligado, `'playback'` antes de criar/retomar; desligado, volta a `'auto'` (`teste-som-jogo` M6) |
| MDN, `AudioSession.type` | 'playback' é exclusivo (pausa a música de outro app); 'ambient' mistura | Escolhido 'playback': o jogo tem som mesmo no silencioso (o custo é pausar a música de outro app) |
| WebKit Bugzilla 264473 | Os tipos 'transient'/'transient-solo' tocam sem som no iOS 17/18 | Nunca usar 'transient' |
| WebKit Bugzilla 276016 e fórum PlayCanvas (iOS: áudio que não volta depois de minimizar) | Depois de minimizar/bloquear, o contexto fica 'interrupted' e não volta sozinho | `statechange` + `visibilitychange`/`pageshow` tentam retomar; se não voltar a 'running', os ouvintes de gesto ficam armados e o próximo toque retoma; `estado` sempre o do contexto (M7: suspensão vinda de fora + 1 toque → 'running') |
| Chrome Developers, "Autoplay policy" / "Web Audio autoplay" | Retomar em click/touchend/pointerup; o pointerdown de toque não vale como gesto | Mantido (o som.js já ouvia touchend e pointerup; medido: 'running' no 1º toque, M1) |
| Audiokinetic, "Mastering a Game with Wwise, Part 1" (metas da PlayStation); Designing Sound, entrevista com Garry Taylor (Sony) | −23 LUFS no console e −18 LUFS (±2 LU) no portátil, pico real ≤ −1 dBTP | Cada gravação medida em LUFS (EBU R128) e nivelada para um alvo único (`MIXAGEM.alvoLufs` −16: celular, alto-falante pequeno, estádio) e limitador no fim da cadeia com pico ≤ −1 dBFS (M10) |
| Rob Bridgett, "Mobile loudness: an adaptive approach" | No celular (ambiente barulhento) vale compressão em tempo real puxando para o alvo | Limitador (`DynamicsCompressorNode` razão 20, ataque 2 ms) no master; as reações abaixam o leito e os cantos ~4 dB (`MIXAGEM.reacao`) em vez de somar por cima |
| TV Technology sobre o FIFA 10 (torcida gravada com Holophone) | Base de torcida gravada no estádio + reações disparadas por lance ("ohhs", "ahhs") + cantos isolados numa camada própria | Três camadas: leito (murmúrio + agito), cantos numa agenda própria (`festa.js`: ~2/3 do tempo calmo cantando, 4 cantos (2 gerais — o 1º também é o do setor visitante, abafado —, incentivo e festa), troca sem repetir) e reações disparadas (gol, "uuuh" ×2, palmas, vaia) |
| Sound Particles, Paul Boechler sobre a torcida do FIFA nas transmissões de 2020 | Operação "tipo DJ": um botão por tipo de lance e um fader de intensidade | O fader é o ânimo (`emocao.js`) e os botões são os eventos: incentivo com a casa atacando, festa depois do gol, vaia com a posse longa do visitante (§6.3), canto do setor visitante depois do gol deles (abafado, à esquerda) |
| Freesound (licenças conferidas uma a uma; créditos em `assets/sons/CREDITOS.md`) | — | Cantos: duas gravações de organizada brasileira (Bruna32U, CC0; três trechos) — a do clássico de Milão no San Siro (neilraouf, CC0) saiu antes da publicação, porque a torcida podia cantar o nome de um clube de verdade (os times daqui são fictícios); batucada (reinsamba, CC BY 4.0; 153,6 batidas/min — o pulo da organizada vai no tempo dela por `relogioBatida`); 2º "uuuh" de 60 mil pessoas no Brasil (felix.blume, CC0); vaia (Julien_Matthey, CC0). Transcritas com faster-whisper: nenhuma narração nem fala inteligível. Descartados: BBC Sound Effects (licença RemArc só pessoal/educacional) e o pacote Sonniss (proíbe redistribuir o som solto) |

### 6.2 Torcida cheia, lado de cá, festa (`torcida-dados.js`, `torcida.js`, `campo.js`, `bandeiras*.js`, `sinalizadores.js`, `fumaca.js`, `luz-falsa.js`)

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| Dobbyn et al. (2005), "Geopostors" (multidões por impostores + geometria) | Nível de detalhe pela distância: o gasto vai para quem aparece grande | As 9 fileiras da frente (as que a TV mostra) quase cheias em toda qualidade (85/97/98%) e as de cima mais vazias na Baixa; lado de cá com sorteio próprio (os outros setores não mudam) |
| Gramática de TV (a câmera principal fica no lado das cabines, na arquibancada de cá) | A câmera de TV está DENTRO da arquibancada do lado de cá | A arquibancada de cá (espelho da de lá, com o túnel dos times e os bancos de reservas na frente) sai do desenho com a câmera dentro dela (`cameraNoLadoDeCa`, a mesma conta para a torcida e a arquibancada) e aparece nos planos do outro lado, no geral e na câmera do gol; o verso das placas do lado de cá virou painel verde (a faixa preta embaixo da imagem sumiu) |
| godotshaders, "3D simple animated flag shader" e "Waving flag" | Bandeira no vertex shader: `sin(k·u − ω·t)·amp·u` (a borda do mastro parada) + ruído | `BANDEIRA_GLSL`/`pontoBandeira` (a MESMA conta, GPU = JS em 4096 pontos no `teste-estadio`), com balanço do mastro; bandeirões com onda própria (`BANDEIRAO_GLSL`) que abrem na saída de cada tempo e no gol da casa; faixas com nomes FICTÍCIOS; tudo numa chamada de desenho |
| mein-mmo sobre a pirotecnia do FIFA 17; ESPN sobre as festas da torcida do Eintracht Frankfurt | Pirotecnia em jogo de futebol só em momento marcado (entrada, gol), não com a bola rolando; a referência visual de faixas, bandeirão e "muro" de sinalizadores | Sinalizadores só na saída do 1º e do 2º tempo, no gol (5 da casa na organizada e quinas, 2 no setor visitante) e na vitória; 22–28 s acesos, no máximo 8 |
| Fórum three.js: "Smoke Effect - InstancedMesh2" e "Creating 3D smoke particles" | Fumaça em quadros instanciados, sem escrever profundidade, textura de ruído | Núcleo + halo + fumaça numa malha instanciada (1 chamada, só com fogo/fumaça), o caminho de cada partícula calculado no shader (`FUMACA_GLSL`, zero CPU por quadro), o vento leva a fumaça para FORA do campo (testado em Node) |
| Arm, Mali Best Practices e fórum sobre translucidez | Translúcido não escreve profundidade nem tem descarte precoce: cada camada custa um pixel inteiro | Poucas partículas (Baixa 0, Média 10, Alta 14 por sinalizador), alfa ≤ 0,4, halo de 6 m; overdraw medido no pico do gol (passada de depuração aditiva): 0,2 tela (meta ≤ 0,5); bandeiras e bandeirões opacos, desenhados antes da torcida |
| three.js r170, `WebGLPrograms` (a chave do programa inclui `numPointLights`) | Acender uma luz real muda a chave e recompila todos os materiais iluminados | A luz vermelha do sinalizador vai por uniform (`vec4[8]`, `LUZ_FALSA_GLSL`) no shader da torcida, das arquibancadas e das bandeiras — nunca `PointLight` |
| Farkas, Helbing e Vicsek, "Mexican waves in an excitable medium", Nature 419:131 (2002) | A ola corre a ~12 m/s (≈ 20 cadeiras/s), 6–12 m de largura, quase sempre no sentido horário, e começa com a torcida calma | Ola na volta do estádio pelo shader da torcida (`OLA_GLSL`, a mesma conta de `olaPeso`), disparada com o agito baixo por 40 s, no máximo 1 a cada 3 min |
| three.js `InstancedBufferGeometry.instanceCount` / `WebGLRenderer` (um desenho com 0 instâncias não vira chamada, mas a geometria e o programa sobem) | — | Pré-carga: no 1º quadro os grupos da torcida fora do quadro, o lado de cá e os sinalizadores vão para a GPU sem desenhar nada — o 1º corte de câmera e o 1º sinalizador não engasgam e a memória da GPU não cresce no meio do jogo |

Medido depois (mesmas ferramentas): murmúrio −26,9 → −19,0 dBFS, apito − leito 14,6 → 6,0 dB, canto audível 35% →
70% do tempo, 1 → 3 cantos em 60 s, pico ≤ −1 dBFS no grito do gol, memória do áudio ~26 MiB, 1,37 MB de som no
total (nada baixa antes da página pronta); torcedores 7.939/12.704/18.067 → 13.989/19.971/25.571 (Baixa/Média/Alta),
fileiras da frente 37/62/88% → 85/97/98%, lado de cá 0 → 5.274 torcedores na Média; chamadas de desenho no jogo
(câmera de TV no PC Alta, 20 instantes, semente 4; medida refeita na contraprova com a mesma ferramenta nas duas versões)
26–27 na publicada → 28–29 logo depois da saída (sinalizadores acesos) e 28 sem eles: +1 das faixas/bandeiras sempre e
+1 dos sinalizadores só quando acesos; overdraw da fumaça no pico do gol 0,2 tela;
`hash-igual` IGUAL (o som ligado, desligado ou sem Web Audio não muda o jogo).

### 6.3 Contraprova (12/10): o que estava errado e o que mudou

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| BBC Sport, "What is tifo, why are they common and how are they made?"; ESPN, "Behind the banner: How a World Cup-themed USA tifo was born"; Hibernian FC ("supporters are encouraged to hold up the material") | O bandeirão/tifo é SEGURADO pelas mãos da torcida e "sobe por cima dela e ondula pela arquibancada" | Debaixo do pano aberto ninguém fura: os torcedores seguram o pano (braços em V, sem pular) e as bandeiras de mastro abaixam (`sobBandeirao`/`SOB_GLSL`, GPU = JS); o pano subiu para 2,3 m pela normal e a onda caiu para 0,25 m (o vão livre nunca fica abaixo das mãos). Medido no gol (Alta, 4 s pulando): 1.134 torcedores e 15 das 32 bandeiras furavam o pano → 0 e 0 (`teste-torcida`). O bandeirão da organizada virou listras verdes e pretas (a metade preta inteira virava uma mancha escura no canto da câmera do gol) |
| Dear Sports Fan, "Why do soccer fans whistle?"; Reddit r/worldcup sobre a torcida do Marrocos assobiando a cada posse da França (Copa de 2022) | Assobio/vaia é desagrado; a torcida da casa assobia o adversário quando ele fica com a bola — e fazer isso o tempo todo é exceção | A regra antiga (o visitante 15 s perto da área da casa) nunca disparava: 0 vaias em 4 partidas IA × IA inteiras (acúmulo máximo 8,7 s), porque o visitante quase nunca fica 15 s rondando a área. Agora conta a posse do visitante (1 s por s no campo todo, 2 s por s a ≤ 32 m do gol da casa) e vaia aos 35: 0–4 por partida de 2 × 4 min (média 2 em 6 partidas) — nunca "o tempo todo" |
| (medida própria: `festa.js` em partidas inteiras) | Gol da casa e, 20 s depois, gol do visitante: a casa voltava a cantar a FESTA por cima do gol deles (o `festaAte` do 1º gol continuava valendo) | O gol de um lado cancela a festa agendada do outro; teste "dois gols em 20 s" no `teste-torcida` |
| (medida própria: `teste-som-jogo` M10) | Com o limiar do limitador em −5,5 dBFS o pico no grito do gol saiu a −1,1/−1,3/−1,4 dBFS: a 0,1–0,4 dB da meta (≤ −1), o CI reprovaria por sorteio | Limiar −6,5 (a compensação automática do nó sobe de +3,1 para +3,7 dB): pico −1,7 dBFS em 2 rodadas, leito −18,1/−18,5 dBFS e apito − leito 6,2/6,4 dB (as outras metas seguem passando) |
| (medida própria: `main.js`) | Com o celular em pé a tela "Gire o celular" cobre tudo e nenhum quadro é desenhado — a pré-carga do 1º quadro era gasta num quadro que não ia para a GPU | A pré-carga espera o 1º quadro desenhado de verdade (`desenha`/`renderizar`) |
## 7. Tela limpa (11/10): HUD mínimo e linha de impedimento só no apito (`css/estilo.css`, `js/hud.js`, `js/entrada.js`, `js/render/*`)

Pedido do dono (11/10): "quero menos informação na tela", "tem muita coisa na tela", "não quero a linha de impedimento
durante o jogo; quando o jogo parar por impedimento, aí no replay vai mostrar a linha". Medido na versão publicada
(`tools/teste-hud-minimo.mjs`): no celular deitado o HUD cobria 18–24% da tela (9–10 peças, 46 caracteres de texto,
CHUTE de 104 px a 80% de opacidade, analógico visível em repouso), escondia 31–34% da torcida que a câmera do celular (#459)
passou a mostrar, e a linha de impedimento viva ficava na tela em ~30% do tempo com a bola rolando (42–47% da partida).
Nenhum teste media isso: os de antes só conferiam que nada encosta e que os botões têm ≥ 48 px.

| Fonte | O que aproveitamos |
|---|---|
| EA SPORTS FC 26, recursos de acessibilidade (EA, oficial: https://www.ea.com/able/resources/ea-sports-fc/fc-26) | O FC deixa desligar cada camada ("Score Clock", indicador do próximo da troca, tamanho do indicador do jogador, radar 2D/3D). Daí: minimapa como OPÇÃO da pausa, indicador do controlado menor (triângulo 2,6% → 2,2% e sem a seta no chão) e o anel do próximo da troca mantido (no FC é ligado por padrão) |
| FC 25, configurações do jogo (FIFPlay: https://www.fifplay.com/fc-25-game-settings/) | "Time/Score Display" e "Radar Off/2D/3D": o padrão da TV é só placar e relógio, o resto é opcional. Daí: na partida o topo é só o placar compacto e o menu; minimapa desligado no celular por padrão |
| FC Mobile 24, guia de controles (FIFAMobileGuide: https://www.fifamobileguide.com/gameplay-controls; FIFAuteam: https://fifauteam.com/fc-mobile-24-controls/) | O FC Mobile tem tamanho dos botões, analógico flutuante e "Gestures Only"; na defesa, "Sprint & Tackle": SEGURAR perto do condutor = marca/acompanha, TOCAR = bote em pé (nenhum dos dois guias dá o tempo do toque × segurar). Daí: botões menores por padrão (80%), analógico discreto e a DIVIDIDA de dois sentidos (tocar = bote, segurar = CONTER) — a defesa cai para 5 botões, todos no 1º anel. Limiar escolhido: 0,25 s (um toque curto dura ~0,07–0,15 s; o "long press" do Android/iOS é 0,4–0,5 s, longo demais para a defesa) e o CONTER começa no 1º quadro do aperto, sem esperar o limiar |
| eFootball, manual de controles (Konami: https://www.konami.com/efootball/en/page/mobile_controller) | A página só tem uma imagem: sem número oficial de tamanho ou transparência dos botões. Lacuna registrada, sem números inventados |
| "Designing the Modern Scorebug" (SportsVideo.org, 2026: https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/) | Placar e relógio primeiro, o resto em camadas que só aparecem quando precisa; placares mais limpos, sem enfeite; "não deixe grande demais". Daí: placar de 30 px (34 no PC), sem a marca e sem caixinhas nos gols, e o "1º T" só no intervalo, no fim e nos acréscimos ("1º T +4", como na TV) |
| Score bug (Wikipédia: https://en.wikipedia.org/wiki/Score_bug) | O placar fica num canto de cima, fora da ação. Mantido no canto de cima à esquerda |
| Finger-Friendly Design (Smashing Magazine: https://www.smashingmagazine.com/2012/02/finger-friendly-design-ideal-mobile-touchscreen-target-sizes/) | 44×44 pt (Apple) e 48 dp (Material), polegar de 9–11 mm. O piso de 48 px dos botões do jogo continua (no menor celular, 568×320, o menor botão fica com 48 px) e o menu passa a 44 px |
| "Toward Minimalist HUDs?" (Universidade de Bonn, 2026: https://bonndoc.ulb.uni-bonn.de/xmlui/handle/20.500.11811/14207) | 59 jogadores: HUD mais minimalista teve mais imersão e mais preferência; a clareza dependeu da familiaridade. Daí: botões só com o ícone e a opção "Nomes nos botões" (e a Ajuda, com o desenho de cada ícone) para quem está aprendendo |
| "Removing the HUD" (CHI PLAY 2015, Open University: https://oro.open.ac.uk/46759) | Tirar o que está fora do mundo do jogo aumentou a imersão de quem já joga. Daí: a linha viva sai (fica a do lance, no apito), o rótulo da barra de força sai e a marca de queda fica só para a bola alta do próprio time |

Resultado (`teste-hud-minimo` na versão final, mesma amostra na base e agora; conferido na contraprova): HUD no celular
23,5% → 10,1% no pior caso (844×390: 18,2/19,3% → 7,3/7,3%), texto fora do placar 46 → 0 caracteres, torcida atrás do HUD
31–34% → 13–14% (varia ±1,5 ponto entre rodadas), linha viva 29,7% → 0 (a do lance continua no apito), PC 3,8% → 1,8%
depois que a dica de teclas some (8,6 s de animação); chamadas de desenho no print do
celular 28 → 24. O analógico, com o dedo na tela, ficou igual ao de antes (mesmo raio: `entrada.js escalaAnalogico`), e o
mundo recebe as mesmas máscaras (hash do treino e da partida iguais). "Minimapa" e "Nomes nos botões" ficaram como botões de
liga/desliga na barra da pausa: na lista de opções sobravam 3 px em 844×390 e uma linha a mais fazia a pausa rolar 62 px.
