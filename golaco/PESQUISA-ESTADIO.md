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
Retorno do dono (12/10): "coloca o nome da função do botão de novo" — os nomes voltaram por padrão (a opção continua na
pausa para quem quiser só o ícone); o resto da tela limpa fica como está (`teste-hud-minimo` H9).
### 7.1 Placar no formato da referência, menor e com a cara do GOLAÇO (12/10; `index.html`, `css/estilo.css`, `js/hud.js`)

Pedido do dono (12/10), com uma imagem de referência: "quero o placar assim, tem que ser algo menor e mais com a nossa
cara". A referência é uma barra de TV no canto de cima à esquerda: marca do jogo | escudo + sigla da casa | "1 - 0" |
sigla + escudo do visitante | relógio num bloco verde; fundo escuro translúcido, cantos arredondados, caixa alta. Medida
na própria imagem (2532×1170 = 844×390 com 3 px por px): **248×29 px = 7192 px² (2,2% da tela)**, números de ~14 px,
siglas e relógio de ~11 px. O placar publicado antes: 30 px de altura no celular (34 no PC), sem marca e sem escudos.

| Fonte | O que aproveitamos |
|---|---|
| Placares de TV (Premier League, Champions League, Brasileirão na TV aberta, EA SPORTS FC) — a forma comum das transmissões (nenhuma publica medidas: lacuna registrada, sem números inventados) | Uma barra só no canto de cima à esquerda; a marca da competição abre a barra; sigla de 3 letras com a cor do time numa faixa; o placar no meio; o relógio num bloco separado no fim. Daí: a ordem da referência, a faixa de cor de cima a baixo na borda de fora de cada time (casa verde logo depois da marca, visitante branca logo antes do relógio, como na referência) e o relógio no bloco verde da marca |
| "Designing the Modern Scorebug" (SportsVideo.org, 2026, já citado no §7) | Logos dos times no lugar das siglas (a Fox trocou as letras por logos em 2025) e "um placar menor pode ser mais legível que um maior se a tipografia e o espaço forem precisos" (contraste, espaço, hierarquia). Daí: escudo + sigla, números MAIORES numa barra MENOR (16 px numa barra de 24 px; na referência ~14 px em 29 px) e o contraste do relógio conferido no teste |
| Apple Human Interface Guidelines, Typography (https://developer.apple.com/design/human-interface-guidelines/typography) | Mínimo de 11 pt no iOS (padrão 17). Daí: siglas de 11 px no celular (12 no PC) — o placar antes também tinha 11 — e nada abaixo de 10 px (o "1º T +4"/"Intervalo" estava em 9 px e subiu para 10) |
| Material Design 3, escala de tipos (https://m3.material.io/styles/typography/type-scale-tokens) | Label Small = 11, Title Small = 14, Title Medium = 16. Daí: números (placar e relógio) ≥ 14 px — o relógio subiu de 12 para 14 px (15 no PC) — e os gols com 16 px (17 no PC) |
| WCAG 2.x, contraste mínimo 4,5:1 | Relógio preto (#07090a) no verde da marca (#19e07a): ~11:1; conferido no teste (≥ 4,5:1) |

Identidade (a "nossa cara"): preto e verde da interface (`--preto`, `--verde`, `--texto`), a mesma fonte (`--fonte`), o
símbolo do GOLAÇO (o paralelogramo verde do favicon e da placa do estádio) no lugar da marca da referência e escudos
desenhados aqui, fictícios: Golaço FC = escudo preto com o G verde do bandeirão da organizada; Ventania FC = escudo branco
com o vento. Nada licenciado e nenhum texto novo na tela (escudos e marca são só desenho; o nome do time fica só no
`aria-label`).

Resultado (`teste-hud-minimo` H10, mesma ferramenta na base com `--raiz`; largura × altura no jogo "34'" / acréscimos
"45+2' 1º T +4" / intervalo):

| Medida (`teste-hud-minimo` H10) | Antes (placar compacto) | Depois | Referência do dono | Meta |
|---|---|---|---|---|
| Celular (844×390, 667×375 e 568×320, com entalhe): jogo "34'" | 169×30 = 5084 px² | 197×24 = 4732 px² | 248×29 = 7192 px² | altura ≤ 24 px; altura e área < antes e < referência |
| Celular: acréscimos "45+2' 1º T +4" | 225×30 = 6743 px² | 254×24 = 6086 px² | | idem |
| Celular: intervalo | 232×30 = 6949 px² | 259×24 = 6226 px² | | idem |
| PC 1280×720: jogo / acréscimos / intervalo | 182×34 = 6176 / 238×34 = 8101 / 244×34 = 8290 px² | 209×26 = 5421 / 266×26 = 6922 / 271×26 = 7040 px² | | altura ≤ 26 px; área < antes e < referência |
| Peças (marca, 2 escudos, 2 siglas, placar, relógio no bloco verde, nessa ordem) | faltam a marca e os 2 escudos; relógio sem bloco | todas, na ordem; relógio preto no verde (~11:1) | todas | todas; contraste ≥ 4,5:1 |
| Números (gols / relógio), siglas, "1º T +4" no celular | 15 / 12 px, 11 px, 9 px | 16 / 14 px, 11 px, 10 px | ~14 px, ~11 px | ≥ 14, ≥ 11, ≥ 10 px |
| Com o minimapa ligado (acréscimos) | nada encosta, mas em 568 px o "1º T +4" some e o 10-9 passa 1,6 px por cima do minimapa (main 48b24933; na 1ª versão deste placar, em 667 e 568) | nada encosta nas 3 telas, com o "1º T +4" na tela e também com 10-9 (em 667 e 568 os espaços apertam, `topo-c4`, e o minimapa encosta à direita do placar; contraprova de 13/10) | | folga ≥ 4 px com o minimapa e o menu; "1º T +4" na tela |
| Treino de ataque com o minimapa e o painel | a marca não existia | (contraprova de 13/10) a marca saía em 667 e 568 px com 40–90 px livres; agora fica e nada encosta | | marca na tela, folga ≥ 4 px |
| Leitor de tela (árvore de acessibilidade) | "GLÇ 0 0 VNT" | (contraprova de 13/10) "Golaço FC 0 0 Ventania FC" (`role="img"` com o nome) | | nome dos dois times |

A base REPROVA o H10 nos 12 casos (3 telas do celular + PC × 3 estados: sem marca e sem escudos, 30/34 px de altura, relógio de 12–13 px, "1º T" de 9 px) e a
versão nova passa. O placar ficou um pouco mais LARGO que o de antes (a marca e os escudos ocupam ~30 px), mas mais baixo
(24 × 30 px) e com área menor em todos os estados e telas; a tela limpa continua no orçamento (H1: 7,2–10,0% no celular,
≤ 11%; H5: 1,7% no PC, ≤ 2,5%). Nos treinos o placar é o mesmo, sem o relógio (159×24 px no celular, 168×26 no PC; nada
encosta no painel nem no menu nas 3 telas e no PC — conferido à parte).

## 8. Rede véu de noiva e branca (pedido de 11/10; `js/rede-forma.js`, `js/bola.js`, `js/render/rede-onda.js`, `js/render/campo.js`)

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

## 9. Replay (`js/render/replay-anel.js`, `replay-roteiro.js`, `replay.js`; pedidos do dono de 11/10)

"O replay não funciona" e "quando o jogo parar por impedimento, aí no replay vai mostrar a linha". O diagnóstico mostrou
que não havia replay nenhum: depois do gol a câmera do gol ficava 2,5 s parada na rede (sem jogadores) até a saída de
bola — o dono via isso como um replay que não funciona. A linha de impedimento aparecia em ~87% do jogo ao vivo e, no
apito, a linha do passe ficava parada sobre os jogadores do instante do apito (1,45 s depois do passe). Agora: um anel com
os últimos 10 s do que foi DESENHADO e um diretor de replay; a simulação espera parada, como na pausa (hash igual).

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| EA SPORTS FC 25 — "Visuals & Audio Deep Dive" (ea.com/ea-studios/ea-sports/news/visuals-audio-deep-dive) | Replays de gol durante e depois da partida, com câmeras próprias de replay; no pós-jogo, "uma sequência de 3 ângulos" | No jogo, 2 planos (TV 1× e atrás do gol 0,5×); o 3º (lateral baixa 0,35×) só no golaço (chute de ≥ 20 m) |
| EA SPORTS FC 25 — Highlighter (ea.com/games/ea-sports-fc/fc-25/news/fc-25-highlighter) | Instant Replay aberto pela pausa | "Replay" no menu de pausa com os últimos 10 s (TV 1×, sem atravessar o último corte) |
| fifauteam — FC 27 Highlighter Replay (guia) | No Instant Replay o jogador controla a linha do tempo, a câmera e a velocidade | Fica para uma 2ª fase (pausar, voltar 2 s, 1×/0,5×/0,25×, trocar de câmera); a base (anel + relógio fracionário) já permite |
| GGRecon — "EA FC 24: how to skip celebrations"; fórum EA FC 26 ("pular a comemoração sem pular o replay") | Replay e comemoração saem com um aperto; há ajuste para não mostrar; jogadores reclamam que pular a comemoração pula o replay | Qualquer tecla, botão, clique ou toque pula, sem combinação; ajuste "Replays automáticos" na pausa; o gancho `posGol()` deixa a comemoração (outra frente) ANTES do replay — cada um com o seu pulo |
| Premier League — "How offsides are determined by VAR" (premierleague.com/en/news/1488423) | Câmeras calibradas; a linha sai na imagem CONGELADA do lance; o público vê só a imagem final | Replay do impedimento com a câmera ALINHADA com a linha (no x dela, alta, do lado da TV: a linha fica em pé no quadro), congelado 1,6 s no quadro do passe com a linha entrando em 0,25 s; nenhum texto |
| Unreal Engine — Replay System (dev.epicgames.com, "Using the Replay System"): Memory Streamer, checkpoints | Replay instantâneo da memória; checkpoints + mudanças para andar no tempo | Anel na memória para o replay instantâneo (10 s); checkpoint de mundo + entradas fica para melhores momentos da partida inteira, se um dia vier |
| Glenn Fiedler — "Snapshot Interpolation" (gafferongames.com) | Desenhar estados gravados interpolando dois vizinhos, sem re-simular | `lerQuadro` interpola dois passos do anel como o desenho ao vivo (pose por junta, rumo pelo caminho curto, bola por nlerp); passo de corte não interpola |
| Philip Orwig, GDC 2017 — "Replay Technology in Overwatch: Kill Cam, Gameplay, and Highlights" | Kill cam interrompível, feita ao lado do modelo do jogo | O replay só lê o anel e pode ser interrompido em qualquer quadro sem tocar no mundo (o pulo só desliga o diretor) |
| bugnet — "How to build a replay system" | Gravar entradas e re-simular (exige determinismo, custa CPU no replay) × gravar estado (custa memória, não diverge) | Estado desenhado: 3,36 MB fixos; o quadro do replay custa ~0,13 ms de CPU contra ~1,1 ms do quadro ao vivo (re-simular custaria a simulação inteira por passo) |
| Transmissões de TV (Wikipedia "Instant replay"; Creative COW, transições de replay das emissoras; Fiveable, "instant replays") | A emissora "anuncia" o replay com uma vinheta que cruza a tela (o logo voa e puxa o replay), e o replay mistura ângulos e câmera lenta | A faixa verde (a da identidade, como a do "GOL!") cruza a tela em 0,4 s na entrada e na saída do replay — o espectador sabe que é replay sem texto; com "reduzir movimento", não passa |
| O próprio jogo (relógio do estádio gravado) | A rede balança pelo relógio do estádio (`rede-onda.js`, impactos com `t0`) | O anel grava o relógio do estádio por passo: no replay a rede re-balança com o tempo gravado, sem mudar `rede-onda.js` |

**O lance lento (28/10; `replay-roteiro.js montarGol`/`planosExtrasGol`, contrato "Replay").** Com o goleiro realista, a bola
que sobe da perna no bloqueio fica livre e às vezes quica, bate na trave e entra 2–3 s depois do chute. Os pisos do roteiro
(a TV até 1,5 s antes do chute; o de trás do gol até 0,3 s antes dele, a 0,5×) davam a base ≥ 4,9 + 3Δ s (Δ = gol − chute; +
3,14 s da lateral no golaço) e o replay passava do teto (semente 102: 16,94 s contra 14). A ordem de corte segue as fontes
que já guiavam o replay: a SoccerNet-v2 (`PESQUISA-CENAS-TV.md` §0.2: 1 a 3 ângulos por lance, 6,8 s por plano) e a LaLiga
(§4: "se dá para resolver em dois ângulos, melhor que em três") — a TV a 1× fica com o chute e o desvio inteiros (o lance
que se lê); o de trás do gol é o plano "mais fechado e mais lento" (patente US7657836, §3/§4) e mostra o GOL, então é ele que
começa mais perto do gol (até 1 s antes dele: 4 s de plano no mínimo); se ainda passar, sai o 3º ângulo (a lateral do
golaço); por último, só fora do golaço e com Δ ≳ 5,7 s, o de trás do gol. Nos extras, a 1ª pessoa sai quando não cabe (já
era a regra) e o treinador volta ao plano dele; com Δ ≳ 4,9 s, a parte 1 dele começa até 0,8 s antes do gol. Medido: 14 gols
lentos sintéticos (`teste-replay-anel` G3b) e as partidas das sementes do CI, 101–128 e 201–240 (G3 agora com a base).

### 9.1 Análise semiautomática do impedimento e posição legal (pedido do dono de 12/10)

"No impedimento, quero que seja marcado o impedimento, tenha cena de impedimento, tipo aquelas cenas de replay do
impedimento semiautomático" e "pode colocar o selo IMPEDIMENTO sim, e em um replay qualquer, aparece uma cena de quando NÃO
foi impedimento também". Antes, o jogo "marcava" o impedimento só com o apito (som) e o replay da linha congelado 1,6 s,
sem nenhuma decisão na tela. Agora: o replay do impedimento ganha a análise semiautomática (P2 'saot') e o replay do gol
— e o "Replay" da pausa — ganha a checagem de POSIÇÃO LEGAL quando o passe foi apertado.

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| The FA — explicação do SAOT na FA Cup (27/02/2025, thefa.com) e Premier League — "Semi-automated offside technology: What you need to know" (premierleague.com/en/news/4256036) | Replay virtual 3D só dos jogadores do lance, com o uniforme do time; a linha é uma PAREDE branca vertical com um "pulso" na parte do corpo do defensor; a parte impedida do atacante atravessa a parede e fica em vermelho; "an offside decision will be shown with a red line and onside with a green line"; o quadro final fica "on an angle, off-centre" e nele o pulso some; o replay CORTA para a cena, sem sobrepor a imagem da TV | O plano 'saot': corte seco, só o impedido, o defensor da linha, quem passou e a bola; parede branco-gelo no defensor, pulsos (anéis) no quadril, plano do atacante que fica vermelho (impedimento) ou parede/plano/linha verdes (legal); quadro final oblíquo e fora do centro (16/22°, 12/20° fora do eixo) e sem pulsos |
| FIFA — Semi-automated offside technology (inside.fifa.com, Copa 2022) | 12 câmeras, até 29 pontos por jogador a 50 Hz e a bola a 500 Hz para o "kick point"; a animação 3D sai dos MESMOS dados, mostra os membros no instante do passe "from the best possible perspectives" e vai ao ar na parada seguinte à decisão | A cena sai do anel do replay (os mesmos dados da simulação, 60 Hz exatos; o "kick point" é o `tickFoto` da Regra 11); no gol, a checagem entra no fim do replay, antes da saída (a parada seguinte) |
| ESPN (Dale Johnson), "Premier League semi-automated VAR offside: All you need to know" (2025) e "Will semi-automated offside be the big VAR fix…" (2023, com Collina e Holzmüller) | O VAR só aciona o sistema nos lances que mudam o jogo (gol, pênalti, vermelho); a animação da PL não fica "directly in line with the two players as they can appear over the top of each other"; a da UEFA demora por ser sobreposta à TV, a da PL é "standalone"; meta média da FIFA de 70 → 25 s | A checagem de posição legal só no lance que acaba em gol (ou, na pausa, em chute/gol); a câmera nunca termina alinhada (sobreposição ≤ 30% medida em `teste-saot` S4); a cena é curta e própria (3,4–3,6 s), pulável |
| Premier League — "How offsides are determined by VAR" (premierleague.com/en/news/1488423) | Linha 2D rápida nos lances claros; o processo completo só nos apertados; o público vê só a imagem final da decisão | Sem cena nos lances claros (margem > 1,0 m) nem com a linha na bola/meio-campo |
| Goal.com — PSG × Liverpool (12/03/2025) | Barcola "just played onside" antes do gol de Dembélé; o gráfico foi mostrado pela Amazon no INTERVALO | Respaldo para "em um replay qualquer": a análise legal também no fim do "Replay" da pausa, não só no gol |
| FIFA, Copa 2026 (Catar × Suíça; Yahoo Sports) | "a brief technical outage prevented the onside animation graphic from being generated" | A TV mostra a POSIÇÃO LEGAL num lance decisivo — o selo "POSIÇÃO LEGAL" (par do "IMPEDIMENTO") |
| Inside World Football (03/06/2026) | Na Copa 2026 o alerta ao assistente dispara a partir de 10 cm; no Mundial de Clubes 2025 e no Intercontinental, só acima de 50 cm | Faixa de "apertado": até 0,5 m é sempre apertado (a faixa antiga sem alerta automático) |
| Universidade de Bath (Soltani, ISBS 2022); Helsen, Gilis e Weston, Journal of Sports Sciences 24(5), 2006 | O chute é percebido 132 ms depois de acontecer; na Copa 2002, 26,2% de erro dos assistentes (86,6% bandeira levantada sem impedimento: "flash-lag") | Limite de 1,0 m: 132 ms × 5–8 m/s de velocidade relativa = 0,66–1,06 m — a faixa em que o olho erra (inferência nossa; nenhuma fonte dá um número em metros para quando a TV desenha) |
| IFAB — Regra 11 e Protocolo do VAR (theifab.com) | Contam cabeça, corpo e pés; mãos e braços não (o limite é a axila); vale o 1º contato da jogada; o VAR revê o gol com impedimento na construção | `parteMaisAvancada`: pelve, lombar, peito, pescoço, cabeça, quadris, joelhos, tornozelos e pontas, com o raio da cápsula; a cena legal só aparece se também for legal por elas (critério v) |

Escolhas (e por quê):
- **Selo "POSIÇÃO LEGAL", não "GOL VALIDADO"**: forma par com o "IMPEDIMENTO" aprovado (os dois falam da posição no passe —
  "offside/onside" da PL; "onside or offside position", Collina); serve em qualquer replay (pausa, intervalo), que foi o
  que o dono pediu; "GOL VALIDADO" contaria o lance em texto e afirmaria uma checagem do gol inteiro (falta, mão) que o jogo
  não faz.
- **O ponto que vale é o quadril**: a simulação decide pelo centro do corpo (`impedimento.js`, tolerância 0,1 m). A parede
  e o plano ficam nele, então o desenho nunca contradiz a decisão; na tela o pé pode atravessar a parede (a contradição
  centro × partes é medida no `medir-saot`). Passar a regra para as partes do corpo muda o hash, a IA e o árbitro do
  `teste-impedimento`: decisão do dono, num PR à parte.
- **Cores**: impedimento vermelho (#ff3b30) e legal verde (#19e07a, o `--verde` do jogo), a convenção da PL; o âmbar da
  linha do chão fica só no P1; parede branco-gelo; o pulso azul-claro (a "medição", como o pulso da PL).
- **Câmera longe na largura**: com o atacante e o defensor a mais de ~30 m um do outro na largura do campo, olhando pela
  linha um fica perto e o outro longe da câmera: o quadro de 16/22° a ≤ 30 m não cabe os dois. A câmera recua até 45 m no
  mesmo ângulo (ainda 12–24°) e, só com ~60 m (canto a canto), sobe e abre (até 62°); o `teste-saot` S4 prova por busca que
  nenhum quadro de 12–24° cabe os dois nesses casos antes de aceitar o nível "extra".
- **Frequência medida** (`medir-saot`, PARCIAL: 40 das 144 partidas, sementes 1001–1040 — com a máquina a carga ~120 em 4
  núcleos a varredura passou do limite de tempo): 67 gols; a cena de POSIÇÃO LEGAL em 6 (9,0%; com 0,5 m seriam 4 = 6,0%),
  dentro da faixa 5–30% — o limite fica em 1,0 m; margens dos 6: −0,05 (mesma linha), 0,05, 0,43, 0,48, 0,59, 0,91 m; a
  espera extra nesses gols é a análise (3,4 s); por partida, 1,30 impedimento e 0,15 cena legal. Das 132 cadeias de passe
  dos gols, 61% passam de 5 m e só 6% ficam até 1,0 m. Contradição centro × partes: 2 dos 52 impedimentos marcados pelo
  centro seriam legais pelas partes do corpo (3,8%; a cena mostra o quadril, coerente com a decisão) e 0 dos 6 legais.

Correções sobre a pesquisa inicial: os "skeletons flying above the ground" da MIT Technology Review (23/06/2026) são erro
de dado num TESTE de laboratório, não algo que o torcedor viu (mesmo assim o `teste-saot` S8 confere a pose da análise: a
gravada, nenhuma junta abaixo de −2 cm); não há fonte para "Decision upheld. Goal disallowed.", "ghostly" ou "frozen in
space" (não estão na MIT nem na TNT); "legal só pela tolerância mostra só a linha do defensor em verde" não está na ESPN
(a cena "mesma linha" é escolha nossa: sem o plano do atacante, o pulso dele encostado na parede).

**A próxima peça da arbitragem em campo (Etapa 6, fora deste PR): assistentes com bandeira.** A marcação de TV ao vivo é o
assistente levantando a bandeira no apito. Metas propostas: (A) dois assistentes na lateral, cada um numa metade, no x do
penúltimo defensor (IFAB Practical Guidelines for Match Officials: "keep in line with the second-last defender"); (B)
corrida lateral de 1–6 m/s com passos de lado e de frente (Krustrup, Helsen e Bangsbo 2009: ~7 km por jogo, 35% de lado);
(C) bandeira levantada no apito do impedimento por ~1,5 s, apontando a altura do lance; (D) sem patinar (o mesmo
`teste-patinacao`). Custo medido na proposta: +5 a 11 mil triângulos no celular, o anel do replay em 24 de 24 vagas e um
estado novo no laço do `main.js` — por isso fica para a Etapa 6.

## 10. Comemoração do gol (`js/comemoracao.js`, `main.js`, `render/camera.js`; pedido do dono de 11/10)

"Não tem cena de comemoração!!!". O diagnóstico (versão publicada antes desta entrega) mostrou: depois do gol, 2,48 s de
câmera do gol PARADA na rede (o autor fora do quadro em 75 de 75 quadros) e corte para a saída de bola; nesses 2,48 s a IA
levava o autor de volta 15,7 m a 6,9 m/s, nenhum colega chegava perto (o mais perto a 16–24 m), nenhuma mão acima da
cabeça, nenhum joelho no chão — não havia pose de comemoração nenhuma. Agora: uma cena de 6–8,5 s (curta, ~4,5 s, no gol da
IA contra o humano), pulável depois de 0,5 s, que anda num mundo À PARTE (cópias dos 22, com a MESMA locomoção do jogo e
gestos/golpes por IK por cima); a simulação só espera no passo antes da saída (hash igual) e o replay vem depois.

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| EA Help — "How to celebrate in EA SPORTS FC" (help.ea.com/en/articles/ea-sports-fc/how-to-celebrate/) | Comemoração assinada ou aleatória pela combinação de botões; cancelar "ends the celebration sequence early so the match can move toward the restart" | A finalização sai sozinha (hash do lance, nunca a mesma duas vezes seguidas) e a cena sempre pode ser pulada; escolher a finalização pelos botões fica para depois (a interface papel/fase/gesto já permite) |
| EA Forums FC 26 — "Skip goal celebrations without skipping replays"; FIFPlay — "FC 25: How to skip your goal celebration & replay" (L1 + R1 pula os dois) | No FC um aperto pula a comemoração E o replay; os jogadores pedem para separar | Dois apertos separados: o 1º acaba a comemoração, o 2º o replay — o mesmo botão ainda segurado não pula o replay (a entrada é solta no pulo, como no replay) |
| GGRecon — "How to skip goal celebrations & replays in EA FC 24" | A comemoração do adversário não se pula direto; há "Celebration Camera Focus: User Controlled Team" | Gol da IA contra o humano: cena CURTA (alvo a ≤ 13 m, finalização de 0,9 s, sem abraço) e o último plano é a reação do time do humano |
| Red Bull — "FIFA 21 celebrations guide"; FIFPlay — "FIFA 17 Celebrations" | A comemoração tem duas partes: "running celebrations" (Arms Out, Aeroplane) e "finishing moves" (Knee Slide...) | Fase CORRIDA com o gesto dela (braços abertos, punho cerrado, mão no peito) + fase FINALIZAÇÃO (de joelhos, pulo com soco, céu, braços em V, giro no ar) |
| Xsens — "FIFA 22 motion capture"; T3 — FIFA 14 (comemorações capturadas de atletas) | No EA as comemorações são clipes de captura (milhares de animações) | Com o manequim de 19 juntas (Etapa 4), gestos por IK sobre a locomoção: o protótipo e o teste mostram 0 NaN, ossos a ≤ 1,4 mm, pé plantado parado. A interface (papel, fase, gesto, tempo) fica pronta para trocar por clipes na Etapa 5 (mocap) |
| Mirror / Reddit r/soccer (maio de 2025) — "Premier League: cinegrafistas com Steadicam no gramado para as comemorações em 2025/26"; Insider Sport | A transmissão passa a ter Steadicam no gramado depois do gol para pegar a comemoração de perto | O plano principal: STEADICAM à frente e de lado do autor (6,5 m e 2,4 m do lado da câmera de TV, 1,6 m de altura, fov 32) — o autor dentro do quadro em 100% dos quadros da corrida e da finalização (antes 0/75) |
| TVBEurope (LaLiga: câmera de cinema na beira do campo, estabilizador) | O visual "cinema" da comemoração: plano próximo e estável, fundo cheio | CONTRAPLANO no gramado atrás do grupo (7,5 m) olhando a arquibancada atrás do alvo: a torcida enche 43% do quadro; desfoque de verdade fica de fora (caro no celular) |
| Squirrel Eiserloh, GDC 2016 — "Juicing Your Cameras With Math" (já em §2) | Corte não enjoa; travelling rápido sim; suavizar sem atraso | Câmera por CORTES entre os planos; dentro do plano, sem mola (uma mola crítica atrasava a steadicam ~2,7 m a 8 m/s): a suavidade é a média do autor em 0,3 s mais a velocidade média × meia janela (sem atraso andando reto); "reduzir movimento": a câmera fica onde o plano começou |
| CMU Graphics Lab Motion Capture Database | Captura livre com saltos e gestos | Para a Etapa 5; aqui os números vêm da física: pulo balístico de 0,5 m (voo de 0,64 s, pés ≥ 0,2 m do chão por 0,53 s), deslize de joelhos desacelerando até parar no alvo (2,5–7 m/s²) |
| three.js — `AnimationAction.crossFadeTo` / `SkinnedMesh` | Misturar clipes com ossos | Etapa 5: os gestos viram clipes misturados por crossFade; hoje o manequim é por juntas e a mistura é a do alvo da mão (um gesto para o outro em 0,3 s, a mão nunca salta) |
| O próprio jogo | `jogador.js` passoCorpo/passoPassada/passoPeDesenhado, `anim.js` pose/alturaQuadril/ik/ikBraco, `goleiro.js` passoMergulho, `teste-patinacao` | A cena usa a MESMA locomoção e a MESMA régua de pé plantado/pé no ar; o goleiro que voava termina a defesa desenhada; separação de corpos como o colisaoCorpos (0,5 m; quem sofreu cede pouco — quem corre para o abraço desvia) |

Medidas (Node, `tools/teste-comemoracao.mjs`, 5 gols naturais + 3 roteirizados; navegador, `teste-comemoracao-tela.mjs`):
autor a ≤ 3 m do alvo em 1,5–3,5 s; 2 colegas no abraço em 3,6–5,1 s (antes: o mais perto a 16,3 m); mãos acima da cabeça
≥ 3,6 s (antes: 0); joelhos a 6,7 cm do chão parado e ≥ 5,6 cm no deslize; pés ≥ 0,2 m do chão por 0,53 s no pulo e no giro;
pelves a ≥ 0,47 m; pé plantado 0,000 m/s, pé no ar ≤ 0,90 do limite; quem sofreu: 100% com gesto, ≤ 1,4 m/s; 0,09–0,23 ms
por tick (22 atores; a simulação custa ~0,6 ms por passo); hash do mundo igual antes e depois; a saída no mesmo tick (gol +
150) com o mesmo hash que sem a cena.

## 11. Cena de substituição e faixa ENTRA/SAI (`js/substituicao.js`, `render/placa-subst.js`, `main.js`, `hud.js`; pedido do dono de 12/10)

"Quando tiver substituição, quero que tenha a cena de substituição, só jogador saindo e entrando, e embaixo, no modelo, a
informação de quem entra e quem sai". O diagnóstico (versão antes desta entrega, `teste-substituicao` "antes"): na
simulação o reserva SURGIA a 0,03 m de onde o titular estava, no mesmo tick, ninguém cruzava a linha, cena 0 s; na tela, só
um aviso de texto ("sai Diego, entra Wallace", sem número nem time). Agora: uma cena de 5,0 s (1 par) ou 6,4 s (2 ou mais;
teto 6,5), pulável depois de 0,5 s, num mundo À PARTE (cópias, a MESMA locomoção do jogo) — a simulação só espera depois
do passo das trocas (hash igual) — e a faixa de TV embaixo com sigla, ▲ ENTRA número nome, ▼ SAI número nome.

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| IFAB, Regras do Jogo, Regra 3.3 (procedimento de substituição; theifab.com; thefa.com "Law 3 – The Players") | Quem é substituído sai pelo ponto mais perto da linha do contorno (salvo indicação do árbitro); o substituto entra só depois de ele sair, pela linha do meio-campo, com o sinal do árbitro, numa paralisação | `pontoDeSaida` (lateral ou linha de fundo, o mais perto; erro máx 0,19 m em 146 saídas); o reserva cruza com \|x\| ≤ 1 m só depois do par dele (`teste-substituicao` S2) |
| IFAB, "Changes to the Laws of the Game 2026/27" e o protocolo de substituição com tempo (Circular 34; Irish FA, julho de 2026) | A partir de 1/7/2026 quem sai tem 10 s depois da placa; passou disso, o substituto só entra na 1ª parada depois de 1 min; o motivo é o tempo perdido e o ritmo do jogo | Quem sai anda FIRME (2,2 m/s), já no 1º quadro do plano, a 3,0–3,6 m da linha: cruza em ~1,5 s; a cena inteira cabe em 5–6,5 s e o relógio da partida não perde nada (a cena é só desenho) |
| Premier League (19/07/2019, as mudanças da Regra 3 para 2019/20) | A saída pelo ponto mais perto começou para cortar a "caminhada até o banco" | O goleiro e quem está perto da linha de fundo saem por ela (nunca pela boca do gol: \|z\| ≥ 4,75 m) — o print `pc-subst-sai-goleiro` |
| IFAB Regra 6.2 / guia da FA para o quarto árbitro | O quarto árbitro ajuda no procedimento: confere o equipamento e mostra a placa no meio-campo | O quarto árbitro (id 203, kit dos árbitros) em (0; 35,6), com a placa no alto nas duas mãos (IK: `G_PLACA`), ao lado dos reservas que esperam na grama do lado de cá |
| Fabricantes de placas eletrônicas (Stramatel "Substitution player board"; Referee Store, placas UCL e Major League; Favero) | "RED = OUT, GREEN = IN": 2 dígitos de LED vermelhos para quem sai e 2 verdes para quem entra, legíveis de longe | A placa: caixa 0,58 × 0,38 m, dígitos de 7 segmentos (os apagados em cinza, como no LED), ▲ verde entra e ▼ vermelho sai; com vários pares troca a cada 0,8 s, o do humano primeiro (S8; no celular ≥ 40 px no plano ENTRA — `teste-substituicao-tela` T10) |
| Transmissão de TV (posições de câmera do futebol: câmeras de ala na beira do campo e a do banco) | O close de quem sai é feito da beira do campo; o banco e o quarto árbitro por uma câmera baixa | Plano SAI: câmera de ala FORA da linha, no rosto de quem sai (lente ≥ 2,5 m de todo ator, ninguém grande no quadro, nunca dentro de sólido); plano ENTRA: câmera baixa no gramado do lado de cá, pan do quarto árbitro para o reserva |
| Lower thirds (School of Motion, "Sports lower thirds"; Epidemic Sound; Riverside; Vimeo) | 3–6 (até 7) s na tela para dar tempo de ler; informação mínima, no terço de baixo, dentro da área segura | A faixa fica ≥ 4,0 s (também com a cena pulada aos 0,6 s), 2,5 s por par (1,8 com ≥ 4), teto 10 s; só sigla, ▲/▼, ENTRA/SAI, número e nome (a exceção do dono à regra "sem narração"); PC embaixo à esquerda, celular dentro da área segura, nada encosta no HUD (T8) |
| EA Forums, FC 26 ("Stupid substitution animation"; o fio do botão das substituições rápidas que é o mesmo do pular replay) | A animação de substituição "toma o lugar" do replay e os jogadores pedem um jeito de desligar; o mesmo botão que pula uma coisa dispara outra | Fila ÚNICA: gol → comemoração → replay INTEIRO → substituição → recomeço (a cena nunca rouba o replay, T5); pular só com um aperto NOVO depois de 0,5 s, e esse aperto nunca vira jogada (T4); opção "Substituição: ligada / só a faixa" no "Modo de jogo" |
| Squirrel Eiserloh, GDC 2016 — "Juicing Your Cameras With Math" (já em §2 e §10) | Corte não enjoa; travelling rápido sim | Câmera por CORTES entre os planos (SAI, SAI2, ENTRA) e corte SECO para a TV no fim; dentro do plano só o pan e o zoom do enquadramento |
| Craig Reynolds, GDC 1999 — "Steering Behaviors For Autonomous Characters" | Separação e desvio de obstáculos olhando à frente | `desviar()` para quem anda (reservas e quem sai) e separação a 0,55 m: nenhum par de corpos a < 0,5 m nas 49 paradas do canhão (S4) |
| O próprio jogo | `jogador.js` passoCorpo/passoPassada/passoPeDesenhado, `anim.js` pose, `comemoracao.js` criarAtor/gesto/maoEm, `estadio-forma.js` solidoEm, a régua do `teste-patinacao` | A cena usa a MESMA locomoção e a MESMA régua de pé plantado/pé no ar; os gestos (palmas de quem sai, troca de peso de quem espera, a placa no alto) por IK |

Medidas (Node, `tools/teste-substituicao.mjs`, canhão de 49 paradas — 8 sementes × lateral, escanteio, tiro de meta, tiro
livre, pênalti e gol + uma de 5 + 5): duração 5,00 s (1 par) e 6,40 s (2 a 10 pares); quem sai cruza a ≤ 0,19 m do ponto
mais perto, entre 1,40 e 3,67 s, nunca pela boca do gol, no 1º quadro a 2,20 m/s e 3,01–3,51 m da linha; reservas cruzam
com |x| ≤ 0,60 m, nunca antes do par; 0 NaN, ossos ±1,4 mm, pé plantado 0,000 m/s, pé no ar ≤ 0,90 do limite; corpos ≥
0,55 m; ninguém nas placas nem no gol; hash e rng iguais; 0 chamadas ao Math.random; 0,10 ms por tick de cena (CPU) e 1,8
ms para criar a cena; lente ≥ 2,79 m; o ator no quadro em 100% dos quadros (PC e celular) e os pés acima da faixa no
celular.

## 12. Área técnica e treinadores (`js/tecnicos.js`, `estadio-forma.js`, `render/campo.js`; pedido do dono de 12/10)

"Quero a área técnica e o treinador." Antes: nenhum técnico no estádio, nenhuma marcação na beira do campo. Agora: as duas
áreas técnicas desenhadas na malha das linhas (+0 chamadas) e os dois treinadores FICTÍCIOS (terno no mandante, agasalho
no visitante) andando com a MESMA locomoção do jogo num mundo à parte, só lendo a partida (o hash não muda).

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| IFAB, Leis do Jogo, Regra 1 ("The Technical Area") | A área vai 1 m além de cada lado dos assentos e, para a frente, até 1 m da linha lateral; demarcada; o técnico dá instruções de dentro dela, uma pessoa por vez | `ESTADIO.areaTecnica` derivada dos bancos (x ±4 a ±18) e do campo (frente a 1 m da lateral, fundo nas placas), linha de 0,12 m nos 3 lados abertos; o treinador nunca sai dela (`teste-tecnicos` T1, T2) |
| Bundesliga (fotos de transmissão: retângulo de giz) | A marcação é uma linha contínua, da largura das outras | Linha contínua, para dentro da área (como as linhas do campo) |
| Smith & Cushion (2006), "An investigation of the in-game behaviours of professional, top-level youth soccer coaches", J. Sports Sciences 24(4) | O silêncio (observar) é a maior categoria (~40% do jogo); instrução, elogio e incentivo vêm em rajadas curtas | 55–85% do tempo observando (posturas: braços cruzados, mãos na cintura, mão no queixo, mãos atrás, agachado raro); incentivo na bola recuperada e numa sequência de passes (T8) |
| Análise dos técnicos na Copa do Mundo de 2022 (contagem por minuto de jogo televisionado) | ~2 gestos táticos por minuto e ~0,7 emocionais | 1–2,5 instruções por minuto de bola rolando; reclamar/lamentar raros; nunca o mesmo (gesto, variante) duas vezes seguidas (T8) |
| Transmissões (Premier League, LaLiga): câmera principal alta do lado dos bancos | O banco fica embaixo da câmera principal; o técnico aparece quando a jogada vem para a lateral de cá | Recuo quando a bola vem para a linha de cá (z 39,2) e esquiva da bola e dos jogadores: ninguém tapa a TV (T11–T13); visíveis na TV do celular com o banco no quadro (`teste-tecnicos-tela` V1) |
| O próprio jogo | `jogador.js` passoCorpo/passoPassada/passoPeDesenhado, `anim.js` pose/ikBraco, gestos da comemoração (`comemoracao.js` maoEm) | Pé plantado sem patinar (T4), gestos por IK com os ossos do tamanho certo (T5), a troca de gesto comum com a mão ≤ 6,5 m/s no pico (`TECNICOS.maoPico`: a mistura cresce com a distância) e, quando a linha reta da mão passaria pela cabeça (das costas para as palmas no alto), um arco de 0,25 m pela frente (`TECNICOS.arcoMao`; antes a mão empurrada para fora da cabeça dava a volta nela de uma vez: 0,158 m num passo) |

Medidas (Node, `tools/teste-tecnicos.mjs`, 24 partidas de 2 × 4 min; navegador, `tools/teste-tecnicos-tela.mjs`, celular
844×390 Média): 0 passos fora da área em 1,5 milhão; pé plantado 0,0000 m/s; a mão ≤ 0,15 m por passo; olhando a bola com
mediana de 1°; reação ao gol em 0,27–0,38 s (mão acima da cabeça) e às mãos na cabeça em ≤ 0,42 s; 83% observando e 2,0
instruções por minuto; nunca entre a TV e a bola (0 passos); 8,9 µs por passo; a mão ≤ 0,142 m por passo (antes 0,158); visíveis em 20/20 instantes com o banco no
quadro; chamadas de desenho iguais com e sem eles (+2 bonecos de triângulos); CPU do quadro sem recuo.

## 13. 3ª e 4ª câmeras do replay do gol: 1ª pessoa do autor e visão do treinador (`js/render/replay-olhos.js`, `replay-roteiro.js`, `replay.js`; pedidos do dono de 12/10)

"Quero que tenha uma 3ª e uma 4ª câmera de replay, onde uma é a visão em 1ª pessoa do jogador fazendo o gol." "A 4ª pode ser
a visão do treinador, quero a área técnica e o treinador." O replay do gol fica: TV 1× → atrás do gol 0,5× → [lateral do
golaço] → 1ª PESSOA do autor 0,6× → VISÃO DO TREINADOR do time que marcou (o que ele vê → corte → ele reagindo) → [checagem
de posição legal]. Os planos de antes não mudam (orçamento próprio de ≤ 7 s; total ≤ 19 s, golaço 21).

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| Pozzo, Berthoz & Lefort (1990/1991), estabilização da cabeça e do olhar na locomoção humana (Exp. Brain Research) | Andando e correndo a cabeça sobe e desce 2–9 cm, mas o olhar fica estável: o cérebro compensa | O olho da 1ª pessoa SEM balanço: a altura é a média de um passo (0,33 s) e uma gaussiana de 0,22 s; o manequim balança até ±9 cm correndo e o olho fica ≤ 0,8 cm do próprio movimento lento (`teste-replay-anel` G6) |
| John Nesky (thatgamecompany), GDC 2014, "50 Game Camera Mistakes" (#41, #42, #44) | Nada de balançar a câmera na passada; não mudar o campo de visão dentro de um plano; o conforto é dado em graus horizontais | Campo de visão HORIZONTAL de 90° fixo na 1ª pessoa; teleobjetiva fixa na visão do treinador (o quadro de 30 m na distância do gol); sem zoom dentro do plano |
| Oculus/Meta, "VR Best Practices" (locomoção e conforto) | "Do not use head bobbing"; giros de câmera lentos e previsíveis; o horizonte nivelado | Rolagem sempre 0; o giro com LIMITE de 85°/s no tempo do replay (`limitarGiro`: ida e volta, a média — sem atraso — e gaussiana de 0,05 s): p95 ~80°/s, máximo ≤ 90°/s (antes do limite: p95 192°/s e picos de 1936°/s quando a bola passava embaixo do olho) |
| arXiv 1611.06292 (conforto em rotações de câmera virtual) | O que incomoda é a DURAÇÃO da mudança rápida, não o tamanho total | Giros curtos e lentos: o olhar desce para a bola de chute − 0,3 s a chute + 0,2 s e volta para o gol |
| Transmissão da UEFA: câmera 3 baixa (atrás dos bancos) | Teleobjetiva baixa na lateral do banco que pega a área inteira do gol | Parte 1 da visão do treinador: o olho na cabeça gravada dele, o olhar a meio caminho da bola e da boca do gol, a bola sempre no quadro (100%) e o giro ≤ 14°/s |
| Steadicam no gramado depois do gol (Premier League 2025/26; já em §10) | O plano de reação próximo e estável, com o banco e a torcida atrás | Parte 2: corte seco para uma câmera parada no gramado, ele INTEIRO no terço esquerdo (agora com os pés e o alto da cabeça da pose gravada: correndo, o pé da frente saía por baixo em 2% dos quadros), ninguém na frente, a lente fora dos sólidos |

Decisões medidas (antes → depois, `teste-replay-anel`: 14 partidas antes, 28 depois): a boca do gol no quadro 0,5 s antes do chute
0/18 → 34/34 (o olhar antes do chute ia na bola, 30° para baixo: no celular deitado o gol ficava acima do quadro; agora a
bola puxada 60% para o gol e no máximo 18° para baixo); a bola no quadro do chute ao gol 94% → 96,5%; o giro p95 196 → 80°/s
(máximo 1936 → 86°/s); o olho a ≤ 0,148 m do centro da cabeça (antes 0,25 m) e a ≤ 0,057 m do olho bruto na horizontal
(antes 0,215 m); a parte 2 do treinador com ele inteiro no quadro 98,4% → 100%; o pênalti com o goleiro no quadro. Uma meta mudou de forma: "≤ 6 cm do olho bruto"
vale na HORIZONTAL — com a passada de agora a cabeça oscila ±9 cm e um olho a ≤ 6 cm dela na vertical também balançaria;
a vertical fica presa pela cabeça (≤ 0,15 m) e pelo balanço (≤ 1 cm).

## 14. Cadeiras e degraus em 3D (item 69 da FILA, PR 1 de 4: a cadeira e o degrau; `js/render/cadeiras-dados.js`, `render/cadeiras3d.js`, `render/campo.js`, `render/estadio-real.js`, `render/estadio-generico.js`, `estadio-planta.js`, `estadio-generico.js`, `render/torcida-dados.js`)

Pedido do dono (29/10): "cadeiras parecidas com as reais e torcida 3D, em todos os estádios". Antes deste PR a cadeira
não tinha geometria em estádio nenhum: no Estádio Golaço a arquibancada era UMA rampa lisa com as cadeiras pintadas; no
Maracanã e nas 104 genéricas, a textura nas faixas do perfil, sem degrau. O PR 1 faz a CADEIRA e o DEGRAU; o torcedor 3D
(PR 2), o impostor/LOD da torcida (PR 3) e a calibração dos 523 estádios (PR 4) vêm depois.

**Fontes e o que foi aproveitado de cada uma**
- **FIFA Football Stadiums Guidelines (2022), §5.2 "Seating and standing areas"** (publications.fifa.com): "tread depths
  of the terracing should be 800mm (minimum), with seat centres at 500mm (minimum)"; passagem livre (clearway) mínima de
  400 mm na frente da cadeira; "a figure in the range of 28 seats between gangways is accepted as good practice
  internationally" (14 com uma escada só). → `CADEIRA.largura` 0,5 m, `CADEIRA.fileira` 0,8 m, `CADEIRA.entreEscadas` 28,
  `CADEIRA.passagem` 0,4 m; a fileira de cada planta curva sai da profundidade média ÷ 0,8 m e as cadeiras por gomo de
  floor(comprimento ÷ 0,5 m) (nunca mais de 28).
- **Guide to Safety at Sports Grounds ("Green Guide", 6ª ed., 2018; SGSA)**: largura recomendada de 500 mm (460 mínima),
  fileira recomendada de 800 mm (§12.12; 700 mínima), o caimento de uma arquibancada de cadeiras não passa de 34°
  (o valor citado nos manuais de estádio a partir dele); **SGSA SG02**: escada radial de 1,2 m. → `CADEIRA.caimentoMax` 34°
  (o Golaço tem 31–32°, o Maracanã ≤ 26°; nas genéricas a forma da pesquisa às vezes passa — o PR 4 calibra) e a escada:
  o Golaço tem 1,0 m (2 células de 0,5 m: mudar mexeria na textura e na torcida inteiras), a genérica 1,2 m, o Maracanã a
  da textura aprovada nas rodadas da prévia (8% do gomo: 0,59 m na 1ª fileira, ~1,1 m na última) — anotado para o PR 4.
- **UEFA Stadium Infrastructure Regulations / CAF Stadium Regulations**: as cadeiras individuais, fixas no piso, com
  encosto de no mínimo 30 cm medido a partir do assento. → `CADEIRA.assento.encosto` 0,36 m e o teste C7 (≥ 0,30 m).
- **OMSI, "How to choose stadium seating" (fabricante, 2026)**: assento de 45–50 cm de largura, 38–40 cm de fundo, encosto
  de 35–40 cm, distância entre encostos ≥ 80–85 cm, mecanismo rebatível por mola em quase toda cadeira moderna. →
  `CADEIRA.assento` {largura 0,46, fundo 0,40, altura 0,43, encosto 0,36}: a concha do assento (as bordas de lado mais altas
  que o meio), o lábio da frente, o encosto em concha (as bordas 3 cm para a frente) e inclinado para trás, o pé no meio —
  18 triângulos (`geometriaCadeira`); o centro do assento a 64% do piso (o encosto encostado no espelho de trás, a passagem
  de 0,33 m na frente do assento rebaixado).
- **three.js 0.170 — InstancedMesh** (docs): `count`, `setMatrixAt`/`instanceColor` com `needsUpdate`, e "the engine
  automatically computes the bounding sphere when needed ... you may need to recompute it if an instance is transformed".
  → uma malha instanciada só (1 chamada de desenho) com as matrizes e as cores escritas SÓ quando a escolha dos blocos
  muda; `frustumCulled = false` (a escolha já é pelo cone da câmera: a esfera não precisa ser refeita).
- **three.js 0.170 — LOD** (docs): `addLevel(object, distance, hysteresis)` — "threshold used to avoid flickering at LOD
  boundaries, as a fraction of distance". → a MESMA ideia na escolha dos blocos (entra com a cadeira ≥ 10 px, sai abaixo
  de 7,5 px) e no degrau das plantas curvas (a malha em escada entra a < 42 m da caixa do setor e sai além de 50 m), sem
  o objeto LOD (a escolha é por bloco e pelos px na tela, não pela distância ao centro do objeto).
- **GPU Gems 3, cap. 2 "Animated Crowd Rendering"** (NVIDIA) e **Millán & Rudomín, "Impostors, pseudo-instancing and image
  maps for GPU crowd rendering"**: multidão com instâncias e nível de detalhe pela distância (geometria perto, imagem
  longe). → a cadeira em geometria só nos blocos perto da câmera e, longe, a TEXTURA da mesma grade (o "impostor" da
  arquibancada). O impostor do torcedor fica para o PR 3.

**O que mudou (decisões)**
- **A grade é a fonte única** (`cadeiras-dados.js`, puro): do Estádio Golaço (`gradeGolaco`: as 36 × 250 células de 0,5 m
  de antes, a escada a cada 26 — a capacidade continua 29,6 mil) e das plantas curvas (`criarGradeAnel`: fileiras de ~0,8 m
  pela profundidade média, cadeiras de ≥ 0,5 m em cada metade de ladrilho da textura; no Maracanã o u da textura passou a
  ser o ARCO no meio da profundidade, não o ângulo — por ângulo a cadeira da frente dos lados tinha 0,36 m e a dos fundos
  0,77 m; agora p1–p99 0,43–0,59 m, e as 60 escadas ficam a distâncias iguais na volta). A textura pinta CADA fileira da
  grade em duas faixas — o PISO (o assento visto de cima) e o ESPELHO (o encosto visto de frente) —, as duas na cor da
  cadeira: de longe a fração de cor é a mesma de qualquer ângulo (na TV do celular a média de cor da arquibancada de lá
  mudou < 2 níveis de 255).
- **O degrau em geometria**: no Golaço as arquibancadas são retas e cada fileira vira um piso e um espelho (~1 mil
  triângulos a mais nas 4); nas curvas cada setor tem DUAS malhas — a lisa de antes (agora passando pelos assentos, para o
  torcedor sentado no piso ficar em cima dela) e a em escada (com as colunas da curva: ~11–16 mil triângulos por setor) —
  e a em escada só entra perto da câmera (a < 42 m, a mesma distância máxima da cadeira 3D: com 52 m o pré-jogo do San
  Siro passava da meta de 130 mil triângulos no celular) e nunca na câmera de jogo (a TV fica sempre na lisa: com a bola
  perto de um gol ela chegava perto do fundo e o San Siro pagava +13 mil triângulos na TV do celular; o plano aéreo e a
  fachada do pré-jogo ficam na lisa pela distância).
- **A torcida senta na grade**: cada torcedor é uma cadeira da grade (o piso do degrau, o centro do assento; um por
  cadeira); no Golaço os mesmos sorteios e a mesma quantidade de antes (só o lugar mudou: ~0,26 m mais baixo, no piso);
  no Maracanã o lado de baixo em todas as fileiras e o de cima em uma sim, uma não (o torcedor maior vale 2).
- **A cadeira 3D de perto** (`cadeiras3d.js`, SOB DEMANDA): por BLOCO (a faixa entre duas escadas × 4 fileiras), pelos px
  da cadeira na tela (0,5 m · altura da tela ÷ (2 · d · tan(fov/2))), com histerese, até `CADEIRAS3D.teto` cadeiras (Baixa
  0, Média 320, Alta 3.072) e 20 blocos; dentro de um bloco em 3D o material das arquibancadas troca a pintura pelo
  concreto do degrau (uma caixa orientada por bloco no shader: `UNIFORMS_PERTO`), e o lado de cá sai junto com a câmera
  de TV dentro dele.

## 15. O torcedor 3D (item 69 da FILA, PR 2 de 4; `js/render/torcedor-pose.js`, `torcedor-dados.js`, `torcedor3d.js`, `torcida.js`, `cadeiras3d.js`; `tools/torcedor/`)

Pedido do dono (29/10): "torcida 3D, em todos os estádios"; aval de 31/10 ("68, 69 é 70 faz") com as recomendações do
"Depende do dono" 11: a Baixa sem bonecos 3D, a Média só perto da câmera, a Alta mais longe. Até aqui o torcedor era só um
QUADRO de 2 triângulos virado para a câmera (um atlas SDF de 8 poses); o PR 1 sentou cada um numa cadeira da grade e pôs a
cadeira 3D nos blocos de perto. Este PR põe um CORPO 3D nessas cadeiras de perto, com a mesma pose do quadro.

**Fontes e o que foi aproveitado de cada uma**
- **SideFX Labs, "Vertex Animation Textures" 3.0/3.1 (Houdini)** (sidefx.com/docs/houdini/nodes/out/labs--vertex_animation_
  textures-3.0): no modo de corpo mole o exportador grava a POSIÇÃO de cada vértice em cada quadro numa textura e a rotação
  (ou a normal, comprimida no alfa) noutra, com opção de 16/32 bits em ponto flutuante ("HDR") e o conselho de não fazer
  texturas compridas e baixas demais. → a VAT daqui (`vatDados`) é uma textura RGBA float (32 bits: a GPU lê com
  `texelFetch`, sem filtro, e o JS faz a mesma conta bit a bit) com a posição e a normal de cada vértice em duas linhas por
  pose; são só 8 "quadros" (as 8 poses) e 4 malhas: 235 × 64 texels (~235 KB na GPU).
- **Epic, "AnimToTexture" (Unreal 5.1, a multidão do City Sample)** (dev.epicgames.com, "Baking out vertex animation in
  editor with AnimToTexture"): o modo VÉRTICE grava a posição de cada vértice e capta qualquer deformação, ao preço de mais
  textura e de cada malha ser assada à parte; o modo OSSO guarda os ossos (menos memória, reaproveitável); a malha animada
  vai numa Instanced Static Mesh com dados por instância (`PerInstanceCustomData`) para cada um se mexer diferente. → o modo
  vértice (as poses são poucas e as malhas pequenas: 55 KB no arquivo) e os dados por instância (as cores, as sementes e a
  cadeira de cada torcedor) numa `InstancedBufferGeometry` por malha.
- **NVIDIA, GPU Gems 3, cap. 2 "Animated Crowd Rendering"** (Dudash): a multidão inteira por instâncias com a animação lida
  de textura no vertex shader, variação por instância (cor, animação) e nível de detalhe por malhas diferentes. → as cores
  do torcedor (camisa, pele, cabelo — as do quadro) e a semente por instância, a REGIÃO de cor por vértice (camisa, pele,
  cabelo, calça, sapato, acento) e dois níveis (~300 e ~125 triângulos) em malhas separadas.
- **Millán & Rudomín, "Impostors, pseudo-instancing and image maps for GPU crowd rendering"** e a discussão da Unity
  "How to treat huge amount of Stadium Crowds" (discussions.unity.com): geometria perto, impostor (imagem) longe, escolhidos
  por um mapa de nível de detalhe; o **PopcornFX "Stadium Crowd using Skeletal Mesh particles"**: a troca pela distância vai
  das malhas 3D até impostores 2D. → o torcedor 3D só nas fileiras de perto (pelos px da cadeira na tela) e o QUADRO de hoje
  como o impostor no resto; o impostor octaédrico assado na carga é o PR 3.
- **Gonzalez-Franco et al., "The Rocketbox Library and the Utility of Freely Available Rigged Avatars" (Frontiers in
  Virtual Reality, 2020)** e o repositório microsoft/Microsoft-Rocketbox (MIT): 115 avatares com o esqueleto do Biped e as
  texturas. → `Adults/Male_Adult_16` e `Adults/Female_Adult_17` (camiseta e jeans: a camiseta vira a camisa do time) pela
  mesma cadeia do corpo dos jogadores (`tools/humano`: os 22 ossos do jogo, os pesos somados no ancestral).
- **Blender 4.5, modificador Decimate (Collapse)** (docs.blender.org): redução por colapso de arestas, simetria em x e um
  grupo de vértices que diz onde reduzir (invertido: protege). → o nível 0 direto da malha original e o nível 1 a partir do
  nível 0 com o joelho e o cotovelo protegidos (da original, o anel do joelho tinha dezenas de vértices e o Decimate parava
  em ~250 triângulos; sem proteção a perna do nível 1 virava um tubo reto que não dobrava no sentado).
- **three.js 0.170** (docs): `InstancedBufferGeometry`/`InstancedBufferAttribute` (`instanceCount`, `setUsage(Dynamic
  DrawUsage)`, `addUpdateRange` — sobe só o pedaço escrito), `DataTexture` com `FloatType` e `NearestFilter`, `ShaderMaterial`
  em GLSL ES 3.0 (`gl_VertexID`, `texelFetch`) com `UniformsLib.fog`. → uma malha por (variação, nível), o vértice achado pelo
  `gl_VertexID` (sem um 2º UV), os uniforms do ânimo COMPARTILHADOS com o material da torcida (os mesmos objetos).
- **FIFA/Green Guide/OMSI** (§14): o assento a 0,43 m, a fileira de 0,8 m, a passagem livre ≥ 0,4 m na frente. → sentado,
  as nádegas no assento, as costas na frente do encosto e os pés no piso da fileira; de pé, os pés na passagem (entre o lábio
  do assento e o bico do degrau).

**O que mudou (decisões)**
- **A mesma pose no quadro e no 3D**: a conta da pose saiu do vertex shader da torcida para `torcedor-pose.js ESTADO_GLSL`
  (a regra `POSE_REGRA`, a ola, o bandeirão aberto, o pulo e o balanço) e os DOIS shaders a incluem, com o mesmo lugar e as
  mesmas sementes; o 3D usa os mesmos uniforms da torcida. `estadoTorcedor()` é a conta em JS; a GPU = JS no `teste-estadio`
  9 (4096 torcedores com a ola e os dois bandeirões; a VAT em 4 malhas × 4096 vértices nas 8 poses).
- **As 8 poses** postas por cinemática (direta na coluna, inversa de 2 ossos nos braços e pernas, alvos pelas juntas do
  próprio avatar) e assadas por mistura linear dos pesos: sentado com as mãos nas coxas ou batendo palmas; de pé com os
  braços soltos, batendo palmas, em V, um braço erguido, o cachecol aberto acima da cabeça (a faixa entre as mãos, na cor
  do time; fechada num ponto nas outras poses) e as mãos na cabeça. Quem está sentado não pula (o quadro sobe junto da ola;
  o 3D sairia do assento); a escala do quadro (até 2 no anel de cima do Maracanã) fica entre 0,94 e 1,06 e escala em volta
  do assento (sentado) ou do piso (de pé).
- **A unidade é a FILEIRA do bloco**: o bloco inteiro (24 cadeiras × 4 fileiras, ~93 torcedores na frente) não cabia nos
  9 mil triângulos da Média nem no nível 1; por fileira, a Média mostra 1–3 fileiras (as de mais px) e a Alta até ~1.200
  torcedores. Teto em TRIÂNGULOS (o orçamento do celular é em triângulos), histerese na entrada e no nível 0.
- **O quadro de quem está em 3D sai** por um byte por instância (`aOculto`), escrito só quando a escolha muda.
- **Custo** (tools/medir-cadeiras.mjs, antes = a base do PR 1, depois = este PR, padrão, Maracanã, Aflitos e San Siro): na
  TV nada muda (celular 29 chamadas e 99,8 mil triângulos no padrão, igual; nenhum torcedor 3D em 20 instantes do jogo no
  `teste-estadio`); o pior plano do pré-jogo no celular fica IGUAL nos 4 estádios (padrão 40/127,8 mil, Maracanã 38/125,3
  mil, Aflitos 37/99,8 mil, San Siro 37/123,6 mil: são os planos aéreos, sem 3D) — o 3D aparece no plano do lado de lá
  (24–58 torcedores, 20–26 chamadas, ≤ 113 mil) e no alto (Aflitos e San Siro, ≤ 33 chamadas, ≤ 104 mil); nas câmeras de
  perto do celular, +2 a +4 chamadas e +2 a +9 mil triângulos (17–70 torcedores); no PC Alta, até ~1.250 torcedores com
  +2 a +4 chamadas e até +160 mil triângulos (o padrão de perto passa de ~225 para ~383 mil). Baixa: nada (o modelo nem é
  baixado). O que baixa sob demanda: o modelo 55 KB + os módulos 26 KB.
