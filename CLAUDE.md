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
- **Fila nova (08/10, depois da Fase 3 da auditoria):** análise completa da movimentação (FEITA e enviada: plano em
  6 etapas — corpo com peso, toque planejado no giro, pé plantado no mundo + inercialização, clipes de partida/parada/
  pivô, IA sem vai-e-volta, intensidade) → **próximo PR:** botão de sair com o goleiro na defesa (ele ataca a bola),
  bola parada e organização (tiro de meta sem adversário na área, lateral e reposição do goleiro com a bola NA MÃO —
  hoje flutua, escanteio organizado, cabeceio e disputa pelo alto, organização tática), **divididas mais efetivas**
  (desde a Fase 3 o bote de frente no atacante que protege vira falta), **troca de jogador mais rápida e inteligente**,
  **goleiro defendendo mais** (~70% de defesas, espalmando) e **mais intensidade e movimentação dos dois times (MUITO
  importante para o dono**: fechar o lado da bola, pressão em gatilhos, apoio e corridas) → giro com bola natural e
  condução mais no pé → Fase 4 (começando por rosto × corpo: mesmo tom, sem emenda) → Fase 5.

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
  condutor "monta" na bola (`human.js` keepBall, também para a IA); em plena arrancada, um toque por passada.
  Medir: `tools/ima-test.mjs` (duas partidas; 0% de ímã, ~0,5 m correndo, p95 ≤ ~1,2 m na arrancada),
  `tools/keepball-test.mjs`, `tools/protecao-test.mjs`.
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
- Antes de publicar: `python3 ferramentas/conferir-estilos.py` (botão sem estilo = visual padrão do
  navegador) e versão nova em `index.html` (`?v=NNN`) + `sw.js` (`total-match-vNNN`).

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
