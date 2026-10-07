# Instruções do projeto (lidas em toda sessão)

Repositório com vários projetos. Os estáticos (sem build) são publicados pelo GitHub
Pages a cada merge na `main` (ver `.github/workflows/deploy-pages.yml`). O CreateFlow
(Next.js, raiz) é hospedado à parte.

## Preferências do dono
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

## GOLAÇO (`futebol3d/`) — futebol 3D
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
  condutor "monta" na bola (`human.js` keepBall, também para a IA). Medir: `tools/ima-test.mjs` (0% de ímã,
  ~0,5 m correndo, p95 ≤ ~1,2 m na arrancada), `tools/keepball-test.mjs`, `tools/protecao-test.mjs`.
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
  chutes/gols por distância `tools/chutes-mapa.mjs`; equilíbrio `tools/gols-media.mjs 24` (~8–10 gols/partida;
  varia ±1,5 entre execuções — usar 24 partidas); proteção `tools/protecao-test.mjs`; contato de corpo
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
  `ima-test`; vídeos de movimento `tools/cenas.mjs --cena a|b|c`.

### Testes (rodar antes de todo commit do futebol3d)
```bash
cd futebol3d
node tools/test-ball.mjs && node tools/sim-test.mjs 3 none && node tools/sim-test.mjs 3 home \
  && node tools/shootout-test.mjs && node tools/pen-test.mjs && node tools/offside-test.mjs \
  && node tools/tournament-test.mjs && node tools/troca-test.mjs
# Fase 1 da auditoria (navegador): node tools/fase1-test.mjs && node tools/piscada-test.mjs
# Fase 2 (Node): node tools/patinacao-test.mjs && node tools/giro-test.mjs && node tools/inclinacao-test.mjs \
#   && node tools/velocidades-test.mjs 3 && node tools/ima-test.mjs 600
# navegador (servidor: python3 -m http.server 8790 em futebol3d/):
node tools/load-check.mjs && node tools/game-shot.mjs --advance 20
```
O Chromium headless não passa pelo proxy: os testes usam `tools/cdn-route.mjs`
(cache via curl) para o jsdelivr e o Google Fonts.

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
