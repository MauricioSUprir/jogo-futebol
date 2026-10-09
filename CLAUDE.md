# Instruções do projeto (lidas em toda sessão)

Repositório com vários projetos. Os estáticos (sem build) são publicados pelo GitHub
Pages a cada merge na `main` (ver `.github/workflows/deploy-pages.yml`). O CreateFlow
(Next.js, raiz) é hospedado à parte.

## Preferências do dono
- **FILA EM VIGOR (09/10): o GOLAÇO NOVO (`golaco/`), feito do zero** — "totalmente novo, nada que restou
  do outro" (dono). Etapas 1–7 na seção "GOLAÇO NOVO" abaixo; cada etapa termina com PR + merge + link + prints.
  Etapa 1 ENTREGUE (#449, #450). Etapa 2 ENTREGUE (PR desta etapa: passe, enfiada, lançamento/cruzamento, chute,
  goleiro, botões sem CONDUÇÃO; revisão adversarial da Etapa 1 com 30 achados corrigidos). Próxima: Etapa 3.
  Retorno do dono (09/10): "achei legal"; a movimentação/condução "está bem boa,
  continue assim" (não mexer sem motivo medido). Quer um jogo **11×11 de alto nível, tipo FIFA**: posições,
  regras, táticas, torcida **cantando alto**, **cenas de pré-jogo**, botões de **chute, passe, enfiada,
  lançamento e saída do goleiro**, e **tirar o botão CONDUÇÃO** do celular. Ordem: Etapa 2 (ações + botões +
  goleiro básico) → 3 (11×11, tática, IA) → 4 (regras, goleiro, bolas paradas, equilíbrio) → 5 (modelos humanos,
  mocap, rostos) → 6 (torcida cantando, pré-jogo, replay, comemoração) → 7.
  As filas antigas do `futebol3d/` (abaixo) ficam PARADAS; o `futebol3d/` continua publicado e intocado porque o
  Total Match usa ele nas partidas 3D, até o dono decidir aposentá-lo. Não copiar nem ler código do `futebol3d/`
  para o projeto novo.
- Tudo em **português do Brasil**: textos da interface, comentários e mensagens de commit.
- Sempre mandar o **link do jogo/app** (GitHub Pages) fora do artifact, e **prints** a cada etapa.
- Testar antes de avançar; corrigir todo bug encontrado.
- Fluxo de entrega: branch → PR → merge na `main` (o link só atualiza depois do merge).
- Times, jogadores, marcas e anúncios dos jogos são **fictícios** (nada licenciado).
- **Falar sempre em português**, inclusive nas mensagens de andamento.
- **Sempre pesquisar melhorias** (sites, artigos, GDC, docs do three.js) antes de mexer em
  jogabilidade/animação/gráficos, citar o que foi aproveitado e **medir antes e depois**
  (clipes em `futebol3d/tools/clip.mjs`, números com as ferramentas `*-dbg.mjs`).
- Pontos que o dono já apontou e precisam de atenção contínua: condução de bola natural
  (nada robótico), animação/comemoração do gol, movimentação dos jogadores.
- Fila de tarefas: **só começar uma tarefa nova depois de terminar a atual** (anotar aqui as novas).
  Fila atual (GOLAÇO): condução natural → animação do gol → escalação no campinho com fotos
  → sombras/gráficos de dia + rostos/texturas + torcida fervorosa → **fotógrafos atrás do gol
  (hoje péssimos)** → **torcida vibrando de verdade** (pular, braços, ondas no gol/chance)
  → **cantos de torcida ao fundo** o jogo todo → **animação por captura de movimento (mocap)**
  (modelos com esqueleto + animações reais CMU/Mixamo; aprovado pelo dono, fim da fila).
- **Entrega em lote** (pedido do dono): fazer a fila inteira e só entregar (PR + merge + link)
  quando tudo estiver pronto; nas mensagens de andamento, só estimativa.
- **Urgente:** melhora extrema dos gráficos no celular (qualidade baixa/média).
- **PRIMEIRA COISA na próxima sessão:** gerar os rostos com o dono pelo ChatGPT (pedido em
  `tools/rostos/pedido-chatgpt.txt`, lotes 02–35, pasta do Drive "GOLAÇO – rostos") e colocar no jogo.
- **Jogador tem que ser um modelo humano 3D realista inteiro** (corpo e cabeça com formato de
  verdade, esqueleto, mocap). Nada de foto "colada" em cabeça/corpo de peças geométricas — o dono
  achou péssimo. O rosto é a pele da cabeça do modelo (UV), não um adesivo.
- Rostos: escolhido **retrato por IA de pessoa fictícia** projetado na cabeça 3D (opção B);
  **textura com foto, nada desenhado por código** (o dono não quer rosto procedural).
- **Sempre dar estimativa de tempo** ao começar uma tarefa e **atualizá-la** a cada
  mensagem de andamento (ex.: "faltam ~40 min").
- **Fila nova (08/10, depois da Fase 3 da auditoria):** análise da movimentação (FEITA e enviada: plano em 6 etapas —
  corpo com peso, toque planejado no giro, pé plantado no mundo + inercialização, clipes de partida/parada/pivô, IA sem
  vai-e-volta, intensidade); botão GOLEIRO, bolas paradas, bola na mão, disputa pelo alto, divididas, troca de jogador,
  goleiro na bissetriz, intensidade dos dois times e condução organizada (ENTREGUES em 09/10 num PR só; o dono escolheu a
  versão REALISTA, sem vídeos, e o merge com o equilíbrio passando na média mas não em toda rodada) → **agora:** volume
  de ataque na área (abaixo) → vai-e-volta da condução da IA → giro com bola natural e condução mais no pé (etapas 1–2
  da análise) → Fase 4 (começando por rosto × corpo: mesmo tom, sem emenda) → Fase 5.
  Estado entregue (144 partidas, `tools/painel-equilibrio.mjs`): ~24 chutes, ~2,4 gols, 10% de conversão, passe 77%,
  escanteios 2,2, goleiro 67–69% (80–84% nos chutes de longe no alvo), 29% dos gols de fora da área; intensidade OK
  (largura ~39 m, meio–ataque ~13,5 m, marcador a ≤ 3 m ~45%). A versão publicada antes tinha ~1 gol por partida de
  saída de bola roubada no tiro de meta com o adversário dentro da área (defeito da Regra 16, corrigido;
  `tools/origem-chutes.mjs` separa esses lances); sem esses lances as duas versões empatam em gols. O teste de 24
  partidas reprova ~1/3 das rodadas (média ~2,45, piso 2,3) e o goleiro de 6 a 16,5 m oscila 45–73% entre rodadas de 36
  partidas (meta ≥ 55%). Próximo PR — volume de ataque: com o goleiro na meta (≥ 66%), 2,6 gols pedem ~7,6+ chutes no
  alvo — falta volume de chance de verdade (e ~55% dos chutes ainda saem de 25 m ou mais). Pistas
  (rastro das decisões): no último terço quase todo passe fica negativo (bloco fechado = linha de passe "arriscada" no
  `laneRisk`) e o condutor dribla até perder no bote (~6 por partida) ou chutar; o cruzamento vira corte de cabeça; o
  passe para trás da linha de fundo quase nunca acha alvo. Ajuste só de peso não mudou o volume (testados: apoio por
  linha de passe, transição, corridas, passe "para quem finaliza", finalizar sob pressão). Medir com 144+ partidas
  (amostra de 48 varia ±0,25 gol).

## GOLAÇO NOVO (`golaco/`) — futebol 3D do zero (publicado em `/golaco/`)
Pedido completo do dono (09/10) guardado no histórico da sessão; resumo das regras que valem SEMPRE:
- Jogável antes de bonito: **controle de bola, passe e tática primeiro**; gráfico/animação/estádio depois e nunca
  podem piorar o que já funciona. **Sem recuo**: nenhuma entrega piora medida que já estava boa (mesma ferramenta,
  mesma amostra, comparar com a versão publicada).
- Toda mudança de jogabilidade tem teste que **reprova antes e passa depois**, com tabela antes → depois no PR.
  O GitHub Actions roda os testes (`golaco/tools/rodar-testes.mjs` + `teste-carga.mjs`) em todo PR
  (`.github/workflows/golaco-testes.yml`) e antes do deploy (`deploy-pages.yml`, job `testes-golaco`): reprovou,
  não publica.
- **Pesquisar antes de mexer** (artigos, GDC, docs do three.js, dados reais) e dizer no PR o que aproveitou de cada
  fonte. Base da Etapa 1: `golaco/PESQUISA.md` (física da bola, biomecânica, passo fixo, jogos, three.js).
- Prints sempre com torcida e HUD ligados (torcida só existe a partir da Etapa 6): PC 1280×720 Alta e celular
  844×390 Média, dia e noite. Vídeo só quando o dono pedir (quadro a quadro, relógio controlado, 30 qps).
- Honestidade nos resultados (número, quanto faltou, proposta). Decisão de produto é do dono; o resto, decidir e seguir.
- Etapas: 1 base + controle de bola (seção 4 do pedido) → 2 passes (passe, enfiada ≥ 4 m à frente, lançamento,
  cruzamento, chute, domínio) → 3 11×11 e tática (formações, IA com/sem bola, troca, jogo aéreo ≥ 90% troca para
  quem disputa) → 4 goleiro, regras (IFAB), bolas paradas e equilíbrio (painel em Node, 144+ partidas) → 5 modelo
  humano realista + mocap + rostos por IA (UV) → 6 estádio, torcida, câmera, replay, comemoração → 7 celular, menus,
  modos e desempenho.
- Técnica: three.js **0.170.0** por importmap (jsdelivr), ES modules, sem build. Lógica (`js/*.js` exceto `entrada.js`,
  `main.js`, `hud.js` e `js/render/`) **sem three.js nem DOM**. Passo fixo 1/60 s + desenho interpolado (`laco.js`).
  Aleatoriedade só por `rng.js` (sfc32 com semente no mundo); mesma semente = mesmo hash (`hashMundo`). Pose =
  função pura do estado (`anim.js`). Contratos em `golaco/CONTRATOS.md`, constantes em `golaco/js/config.js`.
  Coordenadas: x = comprimento (±52,5), z = largura (±34), y para cima, rumo h → (cos h, 0, sin h).
- Condução (Etapa 1, `js/conducao.js`): sem ímã — o toque calcula a velocidade da bola pela MESMA conta da rolagem
  (`bola.js` velParaDistancia, exata) para chegar ao ponto do pé no próximo toque, prevendo o próprio corpo com a
  mesma função de locomoção (`jogador.js` passoCorpo). Toque sincronizado com a passada (pé de apoio no chão), um
  por passada correndo, a cada passo na condução curta/proteção/freada forte; checagem de ultrapassagem (o corpo
  nunca passa por cima da bola) e de folga máxima (≤ 0,8 m); corte = a bola sai na linha do analógico (±20°) com o
  corpo segurando o rumo até o toque; domínio pela linha do analógico com erro por atributo/velocidade/pressão;
  proteção = o corpo gira em volta da bola, de costas para o marcador.
- Etapa 2 (`js/acoes.js`, `goleiro.js`, `ia.js`, `sessao.js` modo 'ataque'): botões carregam força e soltam pedido
  (`j.carga`/`j.pedido`, mira guardada em `j.mira`); toque de ação no pé livre; troca de controle SEMPRE por
  `assumirControle` (carga/pedido vão junto; TROCAR pela borda do time e nunca com a bola no pé). Números da
  pesquisa em `golaco/PESQUISA-ETAPA2.md` (StatsBomb: tempos de passe, logística de defesa do goleiro, cruzamento;
  biomecânica de chute, mergulho e cabeceio). Testes: `teste-passes`, `teste-chutes`, `teste-goleiro` (canhão de
  bolas ±10 pontos da logística), `teste-aereo`, `teste-treino` (treino com a IA não trava), `teste-recomeco`;
  `teste-patinacao` mede também o treino de ataque (10 jogadores). Pendências para o dono: corte de 90° a ~7 m/s em
  2–3 apoios (PESQUISA pede 3–5); tornozelo do pé que toca até a bola p95 0,33 m (meta ≤ 0,30, só `--estrito`);
  falta com curva chega a ~24 m/s aos 27 m (vídeo: 17–21).
- Testes da Etapa 1 (Node, `node golaco/tools/rodar-testes.mjs`, ~30 s): bola, determinismo, entrada/zona morta,
  laço, resposta (≤ 0,1 s), condução (16 cenas + 4), cortes/giro/puxada, perda (60 s × 20 sementes), patinação,
  domínio, proteção, dribles. Navegador (`golaco/tools/`): `teste-carga.mjs` (erros, download ≤ 4 MB, hash Node =
  Chromium), `prints.mjs`. O Chromium headless daqui não passa pelo proxy: `tools/lib/navegador.mjs` serve o CDN de
  um cache baixado com curl.

## GOLAÇO antigo (`futebol3d/`) — futebol 3D (fila PARADA; segue publicado para o Total Match)
- three.js 0.170 por importmap (jsdelivr), ES modules, **sem etapa de build**.
- Identidade visual: **preto e verde**.
- Contratos entre módulos: `futebol3d/tools/CONTRACTS.md`; constantes em `js/config.js`.
  Coordenadas: x = comprimento (±52,5), z = largura (±34), y para cima;
  heading h → (cos h, 0, sin h).
- Lógica de jogo (`ball.js`, `match.js`, `ai.js`, `gk.js`, `human.js`, `player.js`, `anim.js`)
  **não pode depender de three.js/DOM** — roda nos testes em Node.
- `anim.js` é função pura do estado (o replay depende disso).
- Desempenho: jogadores e torcida instanciados; poucos draw calls; qualidade `baixa` tem
  que rodar em celular médio.
- Pasta `tools/` não vai para o site.
- **É o motor 3D do Total Match** (dono, 09/10: "juntar tudo no Total Match"; o menu e os 8 clubes não aparecem mais
  ao público): o TM abre `futebol3d/index.html?tm=<id>` num quadro e o resultado volta para ele (`js/ponte-tm.js`; lado
  do TM em `legacy-total-match/js/tm3d.js`). **Sem `?tm` o endereço leva ao Total Match** — para abrir o menu antigo
  (desenvolvimento, links de teste para o dono) use `futebol3d/index.html?golaco`; os testes automatizados (navigator.webdriver)
  continuam abrindo o menu. Na partida do TM: titulares encaixados nas vagas pela prancheta do TM (método húngaro),
  times de fora por `teams.js` registerTeam, pausa com "Simular o resto" (sem Reiniciar/Sair) e "Controlar só o meu
  jogador" (Rumo ao Estrelato: troca bloqueada, câmera Pro, bola parada/goleiro com a IA). Mexeu em main.js/menus.js/
  teams.js? Rodar também `node legacy-total-match/ferramentas/testar-3d.mjs` (TM + 3D de ponta a ponta).
- **Visual = a cara do Total Match** (dono, 09/10: "deixa os botões, menu, tudo com a cara do total match"):
  `css/tm.css`, carregado por ÚLTIMO, troca a aparência de menus/pausa/configurações, HUD (placar com o logo TM,
  faixas, gol, cartão, escalação), controles de toque e carregamento — Inter, preto #050807 + verde #22c55e, botão
  principal em pílula com degradê verde, cartões arredondados com borda fina; nada itálico/inclinado/condensado e
  nada de emoji como ícone. Fontes locais em `assets/fontes` (Inter; Barlow Condensed só nos números das camisas e
  letras dos escudos), logo em `assets/tm-logo.png`. Peça nova de interface: usar as variáveis `--tm-*` desse arquivo.

- Rostos: fotos de pessoas que não existem (`assets/rostos/`, montado por `tools/rostos/processar.py`;
  retratos por IA em `tools/rostos/brutos/gNN.png` + banco SFHQ CC0) projetadas na cabeça escaneada
  (`assets/cabeca/`, só a forma; `tools/rostos/cabeca.py`). Pedido para o ChatGPT gerar os lotes:
  `tools/rostos/pedido-chatgpt.txt` → imagens na pasta do Drive "GOLAÇO – rostos" → copiar para
  `brutos/` como `gNN.png` e rodar `processar.py`.
- Jogador realista: `assets/jogador/corpo.{json,bin}` gerado por `tools/humano/rig.py` (corpo dos
  Human Base Meshes do Blender Studio, CC0, exportado por `tools/humano/exportar.py` com bpy; cabeça
  com a forma do escaneamento Lee Perry-Smith, CC BY 3.0). Deformado por 17 ossos no shader
  (`players3d.js`, BODY_SKIN); a malha procedural antiga só entra se o arquivo faltar.
- Condução SEM ímã (auditoria Fase 2; `match.js` controlBall/dribbleTouch): entre os toques a bola é física
  pura. No toque, o impulso é calculado pela rolagem de ball.js (`rollSpeedFor`) para a bola chegar ao pé
  no próximo toque, prevendo o caminho do próprio jogador com `integrate` (apoio, giro, aceleração). Modos:
  fase (n passadas), ajuste, arranque, giro (corte), amortece (domínio), arraste (sola). Entre toques o
  condutor "monta" na bola (`human.js` keepBall, também para a IA); em plena arrancada, um toque por passada.
  Medir: `tools/ima-test.mjs` (duas partidas; 0% de ímã, ~0,5 m correndo, p95 ≤ ~1,2 m na arrancada),
  `tools/keepball-test.mjs`, `tools/protecao-test.mjs`.
- Condução organizada (dono, 09/10: "melhorou, mas tá muito desorganizada"): na curva o toque manda a bola PELA curva
  (`match.js` dribbleTouch prevê o giro do analógico, `p.intentW` medido em `human.js` keepBall) e o corpo do jogador
  controlado segue o rumo pedido com a bola no caminho (só vai buscá-la fora de ~35° do rumo); em arrancada na curva ele
  tira o pé (~3,2 m/s² de lado com a bola). Medir: `tools/conducao-org-test.mjs` (publicado: o rumo oscilava 60–100°/s
  numa curva pedida de 30°/s, cortes sem pedir, bola até ~0,5 m fora do caminho). Pendente: o vai-e-volta da condução
  da IA (rumo pedido inverte ~25×/min, o corpo ~35–40×/min; tentativas de suavizar o rumo da IA derrubaram o ataque).
- Rostos encaixados por 478 pontos (MediaPipe) nos marcos da cabeça 3D (`tools/rostos/marcos_cabeca.py`
  → `cabeca-marcos.json`; `processar.py` deforma cada foto por triângulos e tira a luz lateral).
- Corrida/caminhada por captura de movimento (CMU, uso livre): `assets/mocap/locomocao.json`, gerado por
  `tools/mocap/retarget.py`; `anim.js` mistura pela fase da passada (`s.stride` em ciclos). Pés travados por
  IK no apoio (passada procedural sem patinar; a captura só no meio do balanço e só até ~6 m/s — acima é
  passada por comprimento conforme a velocidade). Medir: `tools/patinacao-test.mjs` (< 0,05 m/s),
  `tools/inclinacao-test.mjs` (tronco pela aceleração, `pose.acc`), `tools/giro-test.mjs` (180° ≤ 0,25 m).

- Desempenho: torcida em 16 setores por anel com recorte pela câmera e malha leve ao longe
  (`stadium-crowd.js`, updateLOD); jogadores em alta/ultra com malha detalhada só para quem aparece
  grande na tela (`players3d.js`, lodUpdate). Painel `?perf` no link (ou F3): FPS, 1% pior, CPU/GPU ms,
  draw calls, triângulos. Medir com `tools/perf-bench.mjs` (antes/depois) e `tools/lod-check.mjs` (prints).

- Jogabilidade (medidas): condução `tools/drible-medida.mjs` (alvo ~0,45 m correndo / ~0,6 m arrancada);
  dividida `tools/dividida-test.mjs`; primeira `tools/primeira-test.mjs`; agilidade `tools/agilidade.mjs`;
  chutes/gols por distância `tools/chutes-mapa.mjs`; equilíbrio `tools/equilibrio-test.mjs 24 --par 4`
  (auditoria Fase 3, configurações PADRÃO = tempos de 4 min, como a auditoria mediu: 2,3–3,5 gols/partida,
  conversão 9–14%, passe 75–88%, ≥ 1 impedimento/partida; 24 partidas variam ±0,4 gol e ±1,7 ponto de
  conversão entre execuções (8 rodadas medidas: ~1 em 4 reprova por sorteio) — para calibrar use 192; `--base pasta` mede outra versão); linha de defesa
  `tools/linha-test.mjs` (alinhada, acompanha a bola, sobe em bloco); espalmada para escanteio nunca entra
  `tools/espalmada-test.mjs`; diagnósticos `tools/chutes-diag.mjs` e `tools/passes-diag.mjs`;
  proteção `tools/protecao-test.mjs`; contato de corpo
  `tools/contato-test.mjs`; fadiga `tools/fadiga.mjs`.
- Especificação "Master Gameplay & Visual Spec" (dono): fases A–F feitas. A posse/proteção/primeiro toque/giro/
  0,93×/troca direcional; B fadiga em 2 camadas, contato por massa/força/equilíbrio, antecipação; C IA em
  `js/tactics.js` (intensidade contextual, utilidade por função, traços de personalidade — `tools/intensidade-test.mjs`);
  D modos (`MODES` em config.js) e controles de toque ajustáveis (tamanho/transparência/editor de posição,
  tocar no jogador); E cantos por setor `js/chants.js` (`tools/cantos-test.mjs`) + áudio espacial (PannerNode
  por setor e na bola); F clima (`WEATHER`, `ball.js` SURFACE, `js/rain.js`, `tools/clima-test.mjs`), câmera TV
  adaptativa (camera.js), preset gráfico Competitivo. Atributos detalhados em `teams.js` (detailAttrs).
  Celular: 4 botões (+ DIVIDIDA na defesa) e gestos — conferir com `tools/gesture-test.mjs`.

- Auditoria "reforma com provas obrigatórias" (dono): fases 1–5, uma de cada vez, cada item com teste que
  REPROVA antes e passa depois, tabela antes→depois, prints com torcida+HUD e vídeos MP4 de ≥20 s gravados
  quadro a quadro com relógio controlado (`tools/pump.mjs`: `__pump.on()`/`step(ms)`). Ferramentas:
  `tools/fase1-test.mjs` (bola interpolada a 60/120/144 Hz, zona morta radial, tremor por tempo),
  `tools/piscada-test.mjs` (300 quadros a 30 qps forçando a resolução dinâmica; reprova com canvas apagado
  ou quadro vazio), `tools/gravar.mjs --cena tv|cel|dia|noite` (vídeos), `tools/prints-fase.mjs` (PC Alta
  1280×720 e celular 844×390 dpr2 Média, dia/noite + close do rosto). Fase 1 feita (piscada, interpolação,
  analógico, tremor). Fase 2 (movimento): `patinacao-test`, `giro-test`, `inclinacao-test`,
  `velocidades-test` (IA longe da jogada anda/trota: ≥35% < 7 km/h, ≤5% > 25 km/h; `ai.js` shapeMove),
  `ima-test`; vídeos de movimento `tools/cenas.mjs --cena a|b|c`. Fase 3 (jogabilidade, IA em `ai.js`/`gk.js`):
  linha de 4 por zona que sobe em bloco, atacante na linha com erro de tempo na corrida, Regra 11 (impedido
  que disputa a bola), linha de impedimento desenhada (`js/offside-line.js`); goleiro por dificuldade,
  espalmada para escanteio (`parryOut`) e rebote na área; chute de média distância, finalização de primeira,
  cruzamento com ataque à área, pressão alta, decisão mais rápida no último terço; passe com risco por zona.
  Vídeo de lance natural IA×IA com semente (nada roteirizado): `tools/lance-clip.mjs --evento impedimento|defesa|espalmada`.
- Pedidos do dono de 08/10 (PR depois da Fase 3): botão GOLEIRO na defesa (`gk.js` gkRush; `human.js` userGKRush; tecla G/Y;
  `tools/goleiro-sai-test.mjs`, `tools/goleiro-botao-test.mjs` no celular, vídeo `tools/goleiro-clip.mjs`; contra o botão o
  atacante da IA segue com a bola em vez de bater logo — `ai.js` contraBotao, só contra o humano, IA×IA não muda); bolas paradas
  (`ai.js` alvosBolaParada/setpieceAI: tiro de meta com o adversário fora da área do começo ao fim da cobrança — Regra 16, `match.js` regra16: quem está na área
  vai para fora na montagem, com corte de câmera, e ninguém entra até a bola rolar, nem o humano; `tools/tiro-de-meta-test.mjs`;
  a IA espera os zagueiros abrirem e só o time de pressão alta (estilo ≥ 0,7) põe os atacantes na beira da área — com todos
  prontos ali a saída curta era roubada bem mais que na versão antiga; medir a saída com o painel, linha "após tiro de meta" —,
  lateral com 3 opções, escanteio
  com zona + individual; `match.js` handsPoint: a bola fica NAS mãos no lateral e com o goleiro; `tools/bola-parada-test.mjs`,
  prints `tools/bola-parada-prints.mjs`); disputa pelo alto perto das áreas (`ai.js` pontoAereo, `match.js` doHeader com duelo
  por altura/impulsão/força; `tools/disputa-aerea-test.mjs`); dividida que vale de lado (perna sai do quadril; `match.js`
  ajustaBote; `tools/dividida-test.mjs --alvo` e `--natural --alvo`); troca automática NO PASSE do adversário e com o marcador
  batido (`human.js` autoSwitch; `tools/troca-auto-test.mjs`); intensidade enxuta (bloco estreito pela forma, meio sobe 2 m e
  ataque recua 4 m, 1º marcador arranca a 3 m; a pressão a dois nos gatilhos saiu — custava ~1 chute por partida;
  `tools/intensidade-jogo-test.mjs`); goleiro na bissetriz e IA mirando
  longe dele, chute de longe menos preciso (`tools/defesas-test.mjs`: ~67% de defesas, ~2/3 espalmadas). Equilíbrio recalibrado
  com tudo isso (versão realista entregue, 8 rodadas = 192 partidas: 2,48 gols, 10,5%, 77,1% de passe, 1,75
  impedimento; o de 24 reprova ~1 em 3 por sorteio — falta volume de ataque, ver a fila). Bola parada com o time todo
  atordoado não trava mais (`tools/cobrador-test.mjs`). `tools/fase1-test.mjs` espera a bola rolar antes de medir a
  interpolação (com falta/lateral logo no começo, ~15% das partidas, reprovava por sorteio).

### Testes (rodar antes de todo commit do futebol3d)
```bash
cd futebol3d
node tools/test-ball.mjs && node tools/sim-test.mjs 3 none && node tools/sim-test.mjs 3 home \
  && node tools/shootout-test.mjs && node tools/pen-test.mjs && node tools/offside-test.mjs \
  && node tools/tournament-test.mjs && node tools/troca-test.mjs
# Fase 1 da auditoria (navegador): node tools/fase1-test.mjs && node tools/piscada-test.mjs
# Fase 2 (Node): node tools/patinacao-test.mjs && node tools/giro-test.mjs && node tools/inclinacao-test.mjs \
#   && node tools/velocidades-test.mjs 3 && node tools/ima-test.mjs 600
# Fase 3 (Node): node tools/equilibrio-test.mjs 24 --par 4 && node tools/linha-test.mjs && node tools/espalmada-test.mjs
# Pedidos de 08/10 (Node): node tools/dividida-test.mjs 200 --alvo && node tools/dividida-test.mjs 400 --natural --alvo \
#   && node tools/troca-auto-test.mjs && node tools/intensidade-jogo-test.mjs && node tools/defesas-test.mjs 36 --par 3 \
#   && node tools/goleiro-sai-test.mjs && node tools/bola-parada-test.mjs && node tools/disputa-aerea-test.mjs \
#   && node tools/cobrador-test.mjs && node tools/conducao-org-test.mjs && node tools/tiro-de-meta-test.mjs
#   (navegador, celular: node tools/goleiro-botao-test.mjs)
# navegador (servidor: python3 -m http.server 8790 em futebol3d/):
node tools/load-check.mjs && node tools/game-shot.mjs --advance 20
```
O Chromium headless não passa pelo proxy: os testes usam `tools/cdn-route.mjs`
(cache via curl) para o jsdelivr e o Google Fonts.

## TOTAL MATCH (`legacy-total-match/`) — jogo de gestão (JS puro, sem build)
- Identidade **verde e preto, profissional, sem emoji** (pedido do dono): emoji NÃO é ícone. O
  conversor de `js/icones.js` troca qualquer emoji da interface pelo ícone (Lucide, ISC) ou tira;
  emoji só fica em conteúdo (post, comentário, chat — `MANTER`). Para mudar o mapa:
  `ferramentas/gerar-icones.py`. Ícone direto no código: `TM.ic("nome")`.
- Fonte Inter em `assets/fontes/` (OFL). Cores pelas variáveis de `:root` em `css/styles.css`
  (`--gold*` = verde da marca; `--ok/--erro/--alerta` só para estado).
- **Cenas com a cara do jogo**: recortes das capas dos modos (artes do dono, originais em
  `ferramentas/capas-originais/`) feitos por `ferramentas/gerar-cenas.py` → `b-*.jpg`, só no topo das telas
  (`js/cenas.js`, `TOPO`). **Todos os atalhos (menu "Mais modos", início da carreira, "Todas as seções") ficam
  com ícone + nome** — o dono não gostou das mini imagens neles e pediu o jeito de antes (sem emoji).
  Pôsteres: próximo jogo no início da carreira (`TM.coachUI.posterJogo`) e fim de jogo nas telas de resultado
  (`TM.ui.posterFim`).
- **Cartas do Total Ultimate** (`ultimate.js` cardEl, CSS "A CARTA (Total Match)"): estilo da referência do
  dono — moldura chanfrada e brilho na cor da raridade (Base = bronze, Elite = prata, Craque = ouro, Lenda =
  **verde**; versões especiais com cor própria), nota/nome em Barlow Condensed (`assets/fontes`, OFL), faixa com
  bandeira (`assets/bandeiras`, flag-icons MIT, `ferramentas/gerar-bandeiras.mjs`) e escudo, triângulos e marca
  TM (`assets/cartas`, `ferramentas/gerar-cartas.py`), silhueta quando o jogador não tem foto real.
- **Modo claro vale também na tela inicial** (vitrine; bloco "MENU no tema claro" no CSS). **Avisos**
  (`TM.ui.toast(msg, tipo?)`) aparecem no MEIO da tela, um por vez, com selo ok/erro/alerta — o dono não quer
  aviso escondido lá embaixo.
- **Rumo ao Estrelato — mercado** (`js/rae-mercado.js`, estado em `c.mercado`; ganchos em `rae.js`: `aposRodada`
  no fim de cada jogo, cartão "Seu futuro" no centro, travas no fim de temporada/sem clube): temporada com fim
  (`(clubes-1)*2` rodadas, 30–38) e 2 janelas (4 primeiras rodadas e meio); olheiros/rumores; empresário com
  estilo; propostas de compra/empréstimo/fim de contrato/renovação com negociação; clube pode segurar (pedir para
  sair = −15 de confiança); apresentação em 5 passos (exames, assinatura, camisa, coletiva, boas-vindas);
  trajetória. O clube mais fraco do jogo tem força ~62: a faixa de clubes alarga até ter opções.
- **Total Ultimate 2.0** (pedido do dono: "algo profissional, nível muito maior", inspirado no Ultimate Team atual):
  núcleo em `js/ultimate.js` (cartas, química, pacotes, loja, escalação, clube) + módulos que conversam pela API interna
  `TM.ut._i` e pelos eventos `TM.ut._i.on/emit` ("partida", "pacote", "venda", "compra", "dme", "item", "evolucao",
  "divisao", "nivel"): `ut-modos.js` (executor de partida, elencos CPU, Rivais com prêmios da semana, Batalhas de Elenco,
  Champions, recompensas e escolha de jogador), `ut-temporada.js` (passe de 40 níveis + objetivos diários/semanais/
  temporada/Fundamentos), `ut-dme.js` (DME por categorias, melhorias repetíveis, DME de jogador, "montar com as mais
  baratas"), `ut-draft.js`, `ut-evolucoes.js`, `ut-mercado.js` (leilão, observação, lista de transferências).
  **Química** do modelo atual: 0–3 por jogador, 33 no time; clube 2/4/7, liga 3/5/8, país 2/5/8 (Pitch Notes da EA); fora de posição = 0;
  posições alternativas fixas por jogador; Ícone/Herói entram com 3 (Ícone: 2 no país e 1 em cada liga; Herói: 2 na liga). **Nota da equipe** com a correção de quem está acima
  da média (`notaEquipe`). Escudo do clube é desenhado (forma + símbolo + sigla), sem emoji. Teste de ponta a ponta:
  `node ferramentas/testar-ultimate.mjs http://localhost:8207 <pasta>` (servidor na pasta do jogo).
- **Nada sobre nada** (pedido do dono): nenhum botão/cartão pode encostar em outro nem ficar cortado na borda, em
  celular, tablet e PC. Tela de início: celular = carrossel com vão fixo (ui.js `geo`/`poe`); >= 760 px = os 7 modos
  lado a lado (grade, `.vit-palco.grade`). Campos de escalação usam `separaCampo` (afasta cartas que encostariam);
  "fora de posição" fica DENTRO da carta (`.ut-card.fora`). Conferir com `node ferramentas/testar-sobreposicao.mjs <pasta> [rota]`
  (7 larguras; tem que dar 0).
- Antes de publicar: `python3 ferramentas/conferir-estilos.py` (botão sem estilo = visual padrão do
  navegador) e versão nova em `index.html` (`?v=NNN`) + `sw.js` (`total-match-vNNN`).
- **Partidas em 3D** (`js/tm3d.js`; dono, 09/10: o GOLAÇO vira o motor 3D do TM, tudo num jogo só): antes de toda
  partida do seu time (matchview com `pauseSide`) aparece Jogar em 3D / Simular (Config → "Partidas do seu time":
  Perguntar / Sempre 3D / Sempre simular). O 3D (`futebol3d/`, mesmo site e mesmo localStorage) recebe os dois times
  com 18 jogadores, a vaga de cada titular na prancheta, os uniformes do TM (inclusive o do pré-jogo da carreira) e
  devolve placar, gols (autor, minuto, pênalti, contra), cartões e estatísticas, aplicados no MESMO `result` — o modo
  segue o fluxo normal (pênaltis/prorrogação continuam no TM). Rumo ao Estrelato: titular joga controlando só o
  próprio jogador (`rae.js` preparaPartida/timesDaPartida; nota, gols e assistências vêm do 3D). O service worker não
  guarda nada de `futebol3d/`. Teste de ponta a ponta: `node ferramentas/testar-3d.mjs` (como montar o site no topo do arquivo).

## LANCE A LANCE (`simulador/`) — simulador de partidas (a "bolinha")
- Canvas 2D, ES modules, **sem build e sem dependências externas**. Identidade: grafite + verde-limão.
- `js/engine.js` (motor), `teams.js`, `league.js`, `rng.js`, `commentary.js` **não podem depender de DOM** —
  rodam nos testes em Node. Motor determinístico: toda aleatoriedade pelo RNG com semente.
- Coordenadas: x = comprimento (±52,5), y = largura (±34); cada time tem `dir` ±1 (u = x·dir).
- Ao mexer no motor, rodar `node tools/stats-report.mjs 200` e comparar com a tabela do README.

### Testes (rodar antes de todo commit do simulador)
```bash
cd simulador
node tools/engine-test.mjs
# navegador (servidor: python3 -m http.server 8791 em simulador/):
node tools/ui-shot.mjs --out /tmp/lal && node tools/e2e.mjs
```
