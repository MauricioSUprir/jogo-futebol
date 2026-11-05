# PESQUISA — o TEMPO de jogo e a DIFICULDADE (item 33 da FILA)

Pesquisa feita em 05/11/2026 para o item 33 da `golaco/FILA.md` (categoria F). O pedido do dono, de 17/10: "editar o TEMPO de
jogo e a DIFICULDADE (na pausa/antes do jogo e vindo do TM pelo pedido)".

**Limites desta pesquisa:**
- Não tive o jogo nas mãos. O que é "da tela do FC" vem de capturas de terceiros (fora do repositório; seção 8) ou de transcrições.
- O fórum da EA (forums.ea.com) devolve 403 ao WebFetch e ao curl (Cloudflare). Dele só uso o resumo da busca, sempre
  marcado assim.
- Os créditos do Firecrawl acabaram no começo da pesquisa. Usei WebSearch, WebFetch e curl.
- Os números por nível (as "%" de inteligência e reação) vêm de sites de fãs (fifplay, fifauteam). Parecem transcrever as
  barras da descrição do jogo, mas **a EA não publica uma tabela técnica da IA por dificuldade**.

---

## 0. Resumo: o que a pesquisa sustenta (decisões propostas)

1. **A dificuldade do FC só mexe na CPU adversária.** A EA a descreve como "o usuário virtual que controla o time contra
   o qual você joga". Ela não mexe na física, nem nos atributos, nem na ajuda à pessoa: as assistências de passe e chute
   ficam em outra aba (Gameplay). As quatro dimensões que o FC mostra são inteligência de ataque, inteligência de defesa e
   do goleiro, velocidade de reação e marcação/espaço. Isso casa com o portão que o golaço já tem
   (`tatica.js contraPessoa(m, t)`): dificuldade só no time da IA contra uma pessoa. A IA × IA (demo, painel, Simular o
   resto) e o online (duas pessoas) ficam de fora sozinhos.
2. **O que a comunidade sente como "trapaça" é a CPU com alcance ou precisão sobre-humanos:**
   - interceptações "ridículas";
   - goleiro "sobre-humano";
   - passe certo de 89–95% qualquer que seja o time;
   - suspeita de "scripting" ou DDA (ajuste dinâmico de dificuldade).

   A própria EA, no FC 27, **reduziu** o alcance de bote e interceptação da IA. No FIFA 20 ela tirou as reações
   "sobre-humanas" do goleiro no 1×1. E nega em público qualquer DDA no FIFA. Os textos dos CPU Sliders do FC 27 dizem
   que eles mudam a VONTADE e o TEMPO DE PENSAR, "sem mudar as diferenças entre jogadores que vêm dos atributos".
   **Logo:** mexer em decisão, vontade e tempo de reação; nada de velocidade, física, chance de ganhar a dividida, alcance
   de interceptação ou precisão a mais nos níveis altos. Nenhum ajuste pelo placar (sem "rubber banding").
3. **Mapeamento proposto** (seção 4):
   - **Fácil** ≈ Amador / Semi-Pro;
   - **Normal** ≈ Profissional / Classe Mundial, que é o jogo de hoje, BIT A BIT;
   - **Difícil** ≈ Lendário;
   - **Lenda** ≈ Ultimate com um pouco do "Competitor Mode" (gestão de jogo pelo placar e decisão mais rápida).

   As alavancas estão na tabela da seção 4.2, com os nomes reais do `config.js` (8871b09d).
4. **Tempo de jogo:**
   - O FC oferece 3, 4, 5, 6, 7, 8, 9, 10, 15 e 20 minutos por tempo (FC 25, 26 e 27).
   - No FIFA 22 a faixa era 4–20, com padrão de 4 (página oficial de acessibilidade da EA).
   - **Não existe 45** em nenhum FIFA ou FC que eu tenha achado.
   - Nas Squad Battles o tempo é fixo em 4 min (desde o FC 24; antes 6). Rivals e Champions têm 6 min fixos.
   - **O FC não deixa mudar o tempo nem a dificuldade no meio da partida**: se escolhe antes, em Configurações → Partida
     ou na Prévia da partida.

   O golaço vai além do FC porque o dono pediu: mudar na pausa. Por isso o `mudarDuracao` tem de manter o minuto
   mostrado (seção 5.6) e precisa de travas contra abuso (seção 5.7).
5. A tela antes do jogo (item 64) **já reserva o campo** `dificuldade` na linha de informação: `prepartida.js linhaInfo`,
   2ª linha `[duracao, dificuldade, periodo]`. A ordem de corte (período → árbitro curto → árbitro → data → estádio com
   "…") nunca tira duração nem dificuldade. A tela do FC 24 mostra a duração antes da partida (nota oficial da EA, seção
   5.5). O formato exato "Beginner, 6 minutes" NÃO consegui confirmar em captura.

---

## 1. Dificuldade no EA FC (24 / 25 / 26 / 27)

### 1.1 Os níveis e a tabela "oficiosa"

FC 25 e FC 26 têm a mesma tabela nas duas fontes de fãs (fifplay FC 25 e FC 26; fifauteam FC 26). A FIFA 23 tem a mesma
estrutura, com Lendário 90/90/90/90.

| Nível (FC) | Inteligência de ataque | Inteligência de goleiro e defesa | Velocidade de reação | Marcação e espaço |
|---|---|---|---|---|
| Beginner (Iniciante) | 10% | 10% | 20% | 15% |
| Amateur (Amador) | 20% | 20% | 40% | 30% |
| Semi-Pro | 40% | 40% | 50% | 50% |
| Professional (Profissional) | 50% | 50% | 70% | 60% |
| World Class (Classe Mundial) | 75% | 75% | 80% | 80% |
| Legendary (Lendário) | 90% | 90% | 90% | 90% |
| Ultimate (só Squad Battles / FUT) | 100% | 90% | 100% | 100% |

- No **FC 27** a fifplay passou a usar palavras em vez de números. Ataque e defesa: "Very Low → Low → Moderate → Good →
  High → Very High → Maximum". Reação: "Very Slow → Slow → Average → Fast → Very Fast → Elite → Maximum". Marcação:
  "Loose → Loose → Balanced → Organized → Tight → Very Tight → Maximum".
- Segundo a mesma fonte, a dificuldade afeta "attacking decisions, defensive positioning, goalkeeper reactions, pressing,
  marking, and passing speed".
- A fifauteam (FC 27) resume: "Higher settings generally improve the AI's decision-making, reactions, positioning,
  passing, defending and ability to create scoring opportunities". E acrescenta "Most players choose Professional ... but
  World Class and Semi-Pro are also very popular" (sem fonte de dados).
- **O que aproveitar:** as quatro dimensões viram os quatro grupos de alavancas da proposta (reação, ataque,
  defesa/goleiro, marcação). As razões entre os níveis dão a ordem de grandeza (seção 4.1). Os "%" não são grandezas
  físicas, só uma escala relativa.

### 1.2 O que a EA confirmou em notas oficiais (Pitch Notes / Title Updates)

- **FIFA 20, TU2:** "CPU AI Controlled goalkeepers will not give away the direction of their dive in Penalty Kick situations,
  when playing on Legendary and Ultimate difficulties" (resumo da busca, SGO). No Fácil o goleiro da IA pode "se entregar"
  no pênalti; nos níveis altos, não.
- **FIFA 20, TU4:** "a number of changes to Legendary AI Difficulty". A CPU passou a "mark players better, apply more
  defensive pressure, make smarter passes, take better free kicks, dribble the ball more precisely" (EGM).
  - **Aproveitar:** os níveis altos ganham em MARCAÇÃO, PRESSÃO e DECISÃO, não em atributo.
- **FIFA 20 (antes do lançamento):** "Goalkeeper Reactions will also have tuning – specifically against 1v1 situations –
  resulting in less 'superhuman' reactions" (VGR).
  - **Aproveitar:** o goleiro da IA nos níveis altos não pode passar do limite humano (0,19–0,25 s, que é o
    `GOLEIRO.reacao` de hoje).
- **FIFA 21, TU3:** "Increased Competitor Mode difficulty. This change is most impactful when the CPU AI is defending counter
  attacks" (RealSport101).
- **FC 26, v1.1.0:** "on Professional difficulty and above, the CPU AI will focus more on buildup and team play" (resumo da
  busca; a página de notas do fórum dá 403).
- **FC 26, v1.1.3 (recapitulado nas Pitch Notes oficiais de novembro):**
  - a CPU passou a "Look for passes more often and make quicker decisions about them";
  - também a "Dribble more effectively with sharper turns, less straightforward movement, and less dwelling on the ball";
  - e a "Switch players on defense more often in situations where trailing the runner is not beneficial";
  - definição: "The term CPU AI here is referring to the virtual user controlling the team you're playing against in
    offline matches" (ea.com).
  - **Aproveitar:** o golaço já é assim. A IA dá a mesma entrada virtual que a pessoa (`ia.js entradaIA`, `acaoIA`); a
    dificuldade mexe no "usuário virtual".
- **FC 26, v1.4.0 (oficial):**
  - Squad Battles: a CPU estava "overly passive ... long periods of low-pressure possession" e passou a ter "a more
    proactive and attacking approach".
  - Defesa da IA: "reduce the reaction times of AI defenders when marking the ball carrier, increasing the chance of them
    leaving more open space while transitioning between actions". A frase diz "reduzir o tempo de reação", mas o efeito
    descrito é o de reagir MAIS DEVAGAR. Leio como reação mais lenta.
  - **Aproveitar:** o tempo de reação do marcador é a alavanca que a EA usa para abrir ou fechar espaço.
- **FC 27, entrevista na Gamescom (PCGamesN, via Gameluster):**
  - Sam Rivera: "increasing the tackle range for manual defenders or user-controlled defenders, increasing the
    interception range, but at the same time decreasing those same ranges for AI players".
  - Kantcho Doskov: "defensive AI cannot be relied on like you used to in the past".
  - **Aproveitar:** NÃO aumentar o alcance de interceptação nem o de bote da IA nos níveis altos.
- **FC 27:** a fifplay diz que a EA "recalibrated the difficulty progression" entre Profissional, Classe Mundial e
  Lendário, "creating clearer differences". Não achei o texto oficial. No fórum, a gerente de comunidade sugeriu um nível
  entre Profissional e Classe Mundial (resumo da busca), depois de queixas de que o salto entre os dois era grande.
  - **Aproveitar:** os degraus têm de ser parecidos entre si.

### 1.3 Os modificadores do FC

- **Competitor Mode** (só no Lendário e no Ultimate; desde o FIFA 20). Na página oficial de acessibilidade do FIFA 22:
  "Turn On/Off to enable or disable having a more challenging opponent ... can only be enabled on Legendary or Ultimate".
  No FC 27 (texto do jogo transcrito pela fifauteam):
  - "simulates the play style of some of the world's best FC players";
  - versões separadas para o adversário e para os companheiros de CPU;
  - descrições de fãs: "more skill moves, advanced dribbling and attacking combinations" e "tactical changes when it takes
    the lead".
  - **Aproveitar:** o Lenda ganha comportamento de gente boa (decidir rápido, gerir o jogo pelo placar), não atributo.
- **Player Based Difficulty** (desde o FIFA 21): "Star players on the CPU AI team will have enhanced intelligence while they
  are being controlled". A fifauteam dá o exemplo: no Profissional, os craques jogam como no Classe Mundial e os fracos
  como no Semi-Pro. No FIFA 22 havia o **"Player Based Difficulty Indicator"** (padrão: ligado), um sinal na tela. Ideia
  para depois, fora do item 33.

### 1.4 CPU Sliders: separados da dificuldade, mas mostram as alavancas que a EA expõe

- **FC 26** (captura fifplay, fora do repositório: `fifplay-fc-26-game-settings-cpu-sliders.jpg`):
  - texto do jogo: "CPU Sliders affect the way the opposing AI 'thinks' on a moment-to-moment basis. Baseline CPU
    decision-making varies from team-to-team based on that particular team's style of play. CUSTOM (default): Slider
    defaults are set to 50";
  - sliders: Tackle Aggression, Buildup Speed, Shot Frequency, First Touch Pass Frequency, Crossing Frequency, Dribble
    Frequency e Skill Move Frequency, todos com "- CPU".
- **FC 27** (texto do jogo transcrito pela fifauteam):
  - "DEFENDING AGGRESSION: ... Higher values mean a CPU opponent who closes space faster and marks tighter";
  - "STAND TACKLE AGGRESSION: Increases/reduces the CPU opponent's willingness to attempt stand tackles";
  - "REGULAR / LONG / POWER ... SHOT FREQUENCY: willingness to take ... shots";
  - "BUILD SPEED: ... Lower values correspond to a more patient opponent";
  - "FIRST TOUCH PASS FREQUENCY: Increases/decreases the amount of time a CPU opponent will 'think' before making a pass.
    **Does not affect the relative attribute-driven differences between players**";
  - o seletor "AI Behaviour" ganhou as opções Custom, Tactical e Dynamic.
- **Sliders de "simulação"** (User/CPU, aba Game Type Settings; lista da RealSport101): Sprint Speed, Acceleration, Shot
  Error, Pass Error, Shot Speed, Pass Speed, Goalkeeper Ability, Positioning (Marking, Run Frequency, Line
  Height/Length/Width), Fullback Positioning, First Touch Control Error. Captura
  `fifplay-fc-26-game-settings-game-type-settings.jpg` (fifplay, fora do repositório), com os sliders a 50.
  - Estes mexem em atributo e física. O FC os deixa NAS MÃOS da pessoa (personalização explícita), fora da dificuldade.
- **Aproveitar:** as alavancas "boas" da dificuldade são as de VONTADE (bote, chute, cruzamento), TEMPO DE PENSAR e
  APROXIMAÇÃO/MARCAÇÃO. O erro de execução (Pass/Shot Error) existe no FC, mas como personalização. Na proposta ele só
  PIORA a IA no Fácil.

### 1.5 Assistências à pessoa: separadas da dificuldade

- Captura fifplay (fora do repositório) `fifplay-fc-26-game-settings-gameplay.jpg`, aba Gameplay do FC 26:
  - "Preset: COMPETITIVE"; Shot Assistance "ASSISTED"; Through Pass Assistance e Lobbed Through Pass "SEMI"; Auto Shots,
    Assisted Headers e Auto Flair Pass "OFF";
  - "The Competitive preset is always enabled in online competitive matches".
- No FC 24 o chute "Semi-Assisted" virou "Precision Shooting" (Pitch Notes oficiais da versão de Switch).
- **Aproveitar:** no FC a dificuldade não ajuda a pessoa. No golaço o Fácil também não deve mexer no cone do passe, na
  troca automática nem nas outras ajudas da pessoa (`ACOES.passe.cone` e cia.). Uma opção "Assistência" separada, se o
  dono quiser, fica para outro item.

### 1.6 Recompensa por dificuldade: o TM já imita

- Squad Battles do FC 26, pontos por partida (fifauteam): Beginner 1.500, Amateur 1.550, Semi-Pro 1.600, Pro 1.700, World
  Class 1.800, Legendary 1.900, Ultimate 2.000.
- O Total Ultimate do TM já tem `DIFS` (`legacy-total-match/js/ut-modos.js` ~488): Amador ×1,0, Profissional ×1,6,
  Craque Mundial ×2,3 e Lendário ×3,2. Hoje isso entra como `reforco` (atributo) na partida simulada.
- **Aproveitar:** se a dificuldade muda na pausa, a recompensa tem de usar a MAIS FÁCIL usada (seção 5.7).

### 1.7 Onde se escolhe e quando

- Configurações → Configurações de jogo → aba **Match → GENERAL** (captura fifplay, fora do repositório: `fifplay-fc-26-game-settings-match.jpg`,
  FC 26): Quick Match ON, **Half Length 6 MINUTES**, **Difficulty Level WORLD CLASS**, Competitor Mode OFF (cinza, porque
  só liga no Lendário/Ultimate), Player Based Difficulty OFF, Watch Full Match Intro OPT-IN, Attributes DEFAULT, Quick
  Substitutes ON.
- Texto do Quick Match: "will take you straight to Match Preview ... Any changes made after getting into Match Preview will
  also be saved".
- **No meio da partida não muda:**
  - fifplay (FC 25, 26 e 27): "Difficulty ... is set in the Game Settings menu before a match and can't be changed once it
    starts" e "Once the match begins, the difficulty level cannot normally be changed until the game ends";
  - no FAQ da fifplay (FC 26), na pausa dá para mexer em câmera, áudio e regras, e "Some advanced options (like CPU sliders)
    are only adjustable from the main menu";
  - no fórum (resumo da busca), um jogador relata que "the game difficulty, length of half settings etc are not accessible
    in a match".
- Squad Battles: a dificuldade do adversário se escolhe depois do time. Online (Rivals, Champions) não tem dificuldade.

### 1.8 O que a comunidade sente como injusto: a lista do que NÃO fazer

- **FC 27, Classe Mundial** (fórum, resumo da busca): "unfair rather than challenging"; "passing lanes disappear and CPU
  interceptions feel ridiculous"; "artificially handicapping the player to manufacture difficulty".
- **FC 26:** "Pro too easy, WC too hard" (título do tópico). Também "AI defenders with a 100% successful block rate on
  World Class" (resumo).
- **FIFA 17** (fã, OS): "the AI constantly gets 89–95% pass accuracy regardless of the team's passing ability".
- **"Scripting", "momentum" e DDA:** a EA nega em público.
  - Corey Andress (2019): "none of this is in FIFA now, or previously". A EA atribui as falhas aos sistemas de "poor
    touches or poor shots" movidos por fatores do jogador, como o cansaço (PCGamesN).
  - Página oficial "Fair Play & Dynamic Difficulty Adjustment": "there is no DDA or scripting in Ultimate Team modes".
  - A EA tem a patente US10286323B2 e diz que ela "never was in FIFA, Madden or NHL, and never will be".
- **Conclusão para o golaço:**
  - dificuldade FIXA e escolhida, sem ajuste pelo placar nem pelo desempenho;
  - nada de alcance, precisão ou reflexo acima do humano nos níveis altos;
  - a dificuldade aparece na tela antes do jogo e na pausa (a pessoa sabe o que escolheu).

---

## 2. eFootball e FC Mobile

- **eFootball (Konami):** o nível da IA se chama **"Match Level"**. As notas oficiais da versão 3.00 (2024) dizem:
  - "we have redesigned the opposition's footballing mentality in VS AI Matches. Players will now make more appropriate
    decisions in the right timing. **Depending on their abilities**, they may perform a variety of actions such as breaking
    through with feints, dribbling with more ball-holding intensity or play lofted passes";
  - "we have also adjusted the difficulty balance of each Match Level".

  Os nomes dos níveis (Beginner, Amateur, Regular, Professional, Top Player, Superstar, Legend; os do PES) NÃO confirmei
  em fonte oficial: os sites de fãs se contradizem. Também não confirmei se o nível dos eventos é fixo pela divisão (é o que
  diz um resumo do Reddit). **Aproveitar:** a Konami também mexe na DECISÃO e no MOMENTO das ações, e cada jogador age
  pelos seus atributos.
- **FC Mobile:**
  - Retrabalho da dificuldade anunciado pela EA (Renderz, 23/10/2024): Semi-Pro e Pro ficaram "more balanced and easier
    overall", em Challenge Mode, ICON Chronicles, TOTW e Key Matches. No H2H, quando o adversário sai, a IA que assume
    ficou mais fraca.
  - Sem números. Os nomes de todos os níveis do FC Mobile não confirmei (a matéria cita só semi-pro e pro).
  - Duração: o H2H é "a full 90-minute match ... sped up, so fulltime will take about six to eight minutes" (Wikipedia),
    ou seja, ~3–4 min por tempo.
  - **Aproveitar:** no celular os degraus de baixo têm de ser FÁCEIS de verdade (foi a queixa que a EA atendeu).

---

## 3. Pesquisa acadêmica e de desenvolvedores (ajuste de dificuldade; justo × trapaça)

| Fonte | O que diz | O que aproveitar |
|---|---|---|
| Hunicke, "The Case for Dynamic Difficulty Adjustment in Games", ACE 2005 (sistema Hamlet, Half-Life) | Ajusta a oferta e a procura de itens (reativo) e a precisão e o dano dos inimigos (proativo e reativo) | Exemplo clássico de ajuste por precisão e dano. Para nós só serve o lado "precisão" no Fácil |
| Andrade, Ramalho, Santana, Corruble, "Challenge-Sensitive Action Selection: an Application to Game Balancing", IAT 2005 (DOI 10.1109/IAT.2005.52) | O agente (aprendizado por reforço) escolhe ações num RANKING de valor conforme o nível estimado da pessoa: em vez da melhor, uma pior quando precisa facilitar. Testado num jogo de luta | No golaço (IA por utilidade) o equivalente é, no Fácil, às vezes ficar com a 2ª melhor opção quando ela é parecida. É erro de decisão plausível, não de física |
| Mick West, "Intelligent Mistakes: How to Incorporate Stupidity Into Your AI Code", Game Developer, 18/03/2009 | "For weak poker AI, an intelligent mistake consists of figuring out what you should do, and then not doing it"; "The computer has to throw the game in order to make it fun"; erro "inhumanly stupid" quebra a ilusão; tirar cálculo da IA gera erros que nenhum humano faria | No Fácil: CALCULAR tudo igual ao Normal e errar de propósito, com probabilidade, em escolhas plausíveis. Nunca cortar a visão da IA |
| Lidén, "Artificial Stupidity: The Art of Intentional Mistakes", AI Game Programming Wisdom 2 (2003/2004), pp. 41–48 | Só a referência (o PDF da Drexel deu 503) | Não li; não cito técnicas dele |
| Jimenez, "The Pure Advantage: Advanced Racing Game AI", Game Developer, 03/02/2009 (Black Rock, *Pure*) | Rubber banding "usually ... rely predominately on speed changes" e "it's not fair, and that unfairness is easy to spot". Eles ajustaram HABILIDADES dos pilotos com um deslocamento limitado e evitaram o nome "rubber banding" pela má fama | Nada de velocidade a mais para a IA. Mexer em habilidade e decisão, com teto |
| Gonçalves, Barros, Pais, J. Guerreiro, T. Guerreiro, Rodrigues, "The Trick is to Stay Behind? Defining and Exploring the Design Space of Player Balancing Mechanics", CHI 2024 (DOI 10.1145/3613904.3642441) | Espaço de projeto em 6 categorias (Determinação, Momento, Alvo, Efeito, Retorno, Informação). Estudo com 8 pares e 7 mecânicas num jogo de corrida. Lições: "merited victory", agência sobre quando o equilíbrio age, equilíbrio sem atrapalhar o jogo | Dificuldade escolhida pela pessoa (agência), igual a partida inteira, e a vitória continua merecida (sem ajuste pelo placar) |
| Smeddinck, Mandryk, Birk, Gerling, Barsilowski, Malaka, "How to Present Game Difficulty Choices? Exploring the Impact on Player Experience", CHI 2016, pp. 5595–5607 | Pelos resumos: a maioria PREFERIU escolher a dificuldade à mão; o ajuste automático não mudou muito a experiência; o tipo de escolha mexe na sensação de autonomia | Menu de dificuldade explícito (como o FC e o TM). Sem ajuste automático |
| Depping, Mandryk, Li, Gutwin, Vicencio-Moreira, "How Disclosing Skill Assistance Affects Play Experience in a Multiplayer FPS", CHI 2016, pp. 3462–3472 | Pelo resumo: CONTAR à pessoa que há ajuda não piorou a experiência, contra a crença de que a ajuda tem de ficar escondida | A dificuldade pode e deve aparecer (linha de informação e pausa). Nada escondido |
| Xue, Wu, Kolen, Aghdaie, Zaman (EA), "Dynamic Difficulty Adjustment for Maximized Engagement in Digital Games", WWW 2017 Companion, p. 465 | Pelo resumo: até 9% mais engajamento em jogos da EA, efeito neutro na monetização; a dificuldade vira probabilidade de transição num grafo de progressão | É DDA para jogos de fases, não para o FIFA (a EA diz que não usa no FIFA). Só confirma que a EA separa as coisas. Não li o PDF (binário) e não sei qual alavanca usaram |
| Sepulveda, Besoain, Barriga, "Exploring Dynamic Difficulty Adjustment in Videogames", arXiv 2007.07220 (2020) | Revisão de DDA. Só li o resumo | Referência geral |

**Síntese para o golaço:**
- Dificuldade escolhida, fixa, visível, só contra a pessoa.
- Os níveis de cima ganham em DECIDIR melhor e mais rápido, APERTAR com mais vontade e REAGIR mais rápido, com teto
  humano. Os de baixo ERRAM decisões de forma plausível e reagem mais devagar.
- Nada de física, velocidade, alcance ou atributo escondido a favor da IA.

---

## 4. Proposta: a tabela `DIFICULDADE` (4 níveis do TM)

### 4.1 Mapeamento e escala

O TM já usa os valores `facil | normal | dificil | lenda` (`legacy-total-match/js/settings.js` ~71 e `storage.js` 49:
padrão `"normal"`). Na simulação do TM a dificuldade mexe na FORÇA do time da pessoa (`engine.js` 110: `DIFF = { facil:
1.4, normal: 0, dificil: -1.4, lenda: -2.8 }` × 0,02, ou seja, ±2,8% por degrau). Isso é atributo; no jogável não pode
(seção 1.8).

**Por que o Normal de hoje ≈ Profissional / Classe Mundial:** o golaço contra a pessoa foi calibrado em dados reais
(PPDA ~9, aproximação do 1º homem ~7 km/h, Metrica e Opta; Categoria D). O dono pediu "mais difícil" e isso já entrou
(D2/D3). É o nível "realista", que no FC fica entre Pro e Classe Mundial ("most players choose Professional", fifauteam).

| TM | FC equivalente | Ataque (FC) | Defesa (FC) | Reação (FC) | Marcação (FC) |
|---|---|---|---|---|---|
| Fácil | entre Amador e Semi-Pro | 20–40% | 20–40% | 40–50% | 30–50% |
| **Normal** (= hoje, bit a bit) | Profissional–Classe Mundial | 50–75% | 50–75% | 70–80% | 60–80% |
| Difícil | Lendário | 90% | 90% | 90% | 90% |
| Lenda | Ultimate + gestão do Competitor Mode | 100% | 90% | 100% | 100% |

Razões contra o meio do Normal (ataque e defesa 62,5; reação 75; marcação 70):

| Nível | Ataque | Defesa | Reação | Marcação |
|---|---|---|---|---|
| Fácil (ponto médio 30 / 30 / 45 / 40) | ×0,48 | ×0,48 | ×0,60 | ×0,57 |
| Difícil | ×1,44 | ×1,44 | ×1,20 | ×1,29 |
| Lenda | ×1,60 | ×1,44 | ×1,33 | ×1,43 |

Leitura prática:
- **TEMPOS** (reação, leitura, pensar) escalam por 1/reação: Fácil ×1,67, Difícil ×0,83 e Lenda ×0,75, sempre com o
  piso humano.
- **VONTADES** (bote, chute) e **APROXIMAÇÃO** não são lineares com o "%". O ponto de partida é Fácil ×0,6, Difícil ×1,25
  e Lenda ×1,5, CALIBRADOS pelas metas de resultado da seção 4.4 (o "%" do FC é opaco).

### 4.2 As alavancas e os valores iniciais

Tudo vale só no time `t` com `contraPessoa(m, t)` verdadeiro. O Normal é a identidade: valores de hoje (8871b09d), sem
conta e sem sorteio.

**R: reação e leitura** (FC: "Reaction Speed").

| Id | Chave no `config.js` | O que é | Normal (hoje) | Fácil | Difícil | Lenda |
|---|---|---|---|---|---|---|
| R1 | `IA_DEFESA.livre.le` | s para ler o passe da pessoa antes de ir cortar | 0,20 | 0,33 | 0,17 | 0,15 |
| R2 | `IA.antecipaPressao` | s: quem aperta mira à frente do condutor da pessoa | 0,7 | 0,4 | 0,8 | 0,9 |
| R3 | `IA_ATAQUE.condutor.avaliaTicks` | ticks entre as avaliações do condutor da IA (o "pensar"; FC 27 "First Touch Pass Frequency") | 6 (0,1 s) | 10 | 5 | 4 |
| R4 | `IA_PESSOA.utilidade.passeAntecipa` | s: o passe da IA lê a defesa da pessoa à frente | 0,5 | 0,25 | 0,6 | 0,7 |
| R5 | `GOLEIRO.reacao` (o goleiro da IA nos chutes da pessoa) | s depois do toque [ruim, bom] | [0,25; 0,19] | [0,30; 0,24] | [0,24; 0,18] | [0,23; 0,17] (piso 0,17) |

**V: vontade e marcação na defesa** (FC: "Defending Intelligence", "Marking & Space"; sliders "Defending Aggression" e
"Stand Tackle Aggression").

| Id | Chave no `config.js` | O que é | Normal (hoje) | Fácil | Difícil | Lenda |
|---|---|---|---|---|---|---|
| V1 | `ACOES.boteIA.chancePorPasso` / `descanso` | VONTADE de dar o bote (sorteio por tick ao alcance) e a espera depois. A chance de GANHAR (`chanceDividida`) não muda | 0,08 / 45 | 0,05 / 70 | 0,10 / 40 | 0,12 / 35 |
| V2 | `IA_PESSOA.engaja[1]` (Média; Baixa e Alta com o mesmo deslocamento) | m do meu gol em que o 1º homem sai do bloco | 69 | 62 | 71 | 73 |
| V3 | `IA_PESSOA.encurta[2]` | fração do caminho que o da zona encurta, só no gatilho | 0,30 | 0,15 | 0,35 | 0,40 |
| V4 | `IA_DEFESA.contrapressao.s` / `.max` (Média) | contrapressão depois da perda (FC Lendário: "much less time to recover after losing possession") | 3 s / 2 | 2 s / 1 | 4 s / 2 | 5 s / 3 |
| V5 | `IA_DEFESA.gatilhos.janela` | s em que um gatilho de pressão vale | 1,5 | 1,0 | 1,7 | 2,0 |
| V6 | `IA_PESSOA.marcaPerto.suave.div` / `.corre` | intensidade d/div e sprint além de `corre` m, para quem marca perto da bola | 7 / 9 | 10 / 12 | 6,5 / 8 | 6 / 7 |

**A: ataque** (FC: "Attacking Intelligence"; sliders "Shot Frequency" e "Build Speed").

| Id | Chave no `config.js` | O que é | Normal (hoje) | Fácil | Difícil | Lenda |
|---|---|---|---|---|---|---|
| A1 | `IA_ATAQUE.utilidade.chute` | peso do chute na utilidade (vontade de chutar) | 3,0 | 2,2 | 3,3 | 3,5 |
| A2 | `IA_ATAQUE.contra.bonus` / `.s` | contra-ataque depois da retomada | 1,0 / 8 | 0,5 / 6 | 1,2 / 8 | 1,4 / 9 |
| A3 | `IA_ATAQUE.primeira.xg` | xG mínimo para finalizar de primeira | 0,12 | 0,18 | 0,11 | 0,10 |
| A4 | erro de execução da IA (`ACOES.passe/enfiada/lancamento.erroBom/erroRuim` e o erro do chute) | multiplicador (FC "Pass/Shot Error - CPU") | ×1 | ×1,3 | ×1 | ×1 |
| A5 | (novo) decisão "humana" | com probabilidade p por decisão do condutor, fica com a 2ª melhor opção se ela estiver a ≤ 15% da utilidade da melhor (Andrade 2005; West 2009) | p = 0 | p = 0,2 | 0 | 0 |
| A6 | (novo, só Lenda) gestão de jogo | a partir dos 70', ganhando: mentalidade −1 (guarda a bola); perdendo: +1 (FC Competitor Mode: "tactical changes when it takes the lead") | não | não | não | sim |

**G: goleiro** (FC: "GK & Defending Intelligence").

| Id | Chave no `config.js` | O que é | Normal (hoje) | Fácil | Difícil | Lenda |
|---|---|---|---|---|---|---|
| G1 | `GOLEIRO.logit.c0Partida` (só o goleiro da IA, só nos chutes da pessoa) | desvio no logit da defesa | +0 | −0,25 | +0,08 | +0,15 (teto) |
| G2 | `GOLEIRO.penalti.antecipa` (opcional; conferir no `goleiro.js`/`partida.js` o que ela faz) | se for o adiantamento do mergulho, o goleiro da IA "se entrega" mais cedo no Fácil (FIFA 20 TU2: no Lendário/Ultimate não se entrega) | 0,08 | 0,18 | 0,06 | 0,05 |

Na faixa em que o goleiro defende ~68%, p(1 − p) ≈ 0,22. G1 dá então ≈ −5,4 pontos percentuais no Fácil, +1,7 no Difícil
e +3,3 no Lenda.

**Em NENHUM nível** (atributo escondido perceptível):
- velocidade, aceleração e atributos dos jogadores da IA; física da bola e do chute;
- chance de ganhar a dividida e o bote (`chanceDividida`);
- alcance de interceptação (`IA_DEFESA.livre.antes/acel/alturaMax`; a EA REDUZIU o da IA no FC 27);
- o árbitro;
- as ajudas da pessoa;
- precisão da IA melhor que a de hoje (A4 só piora no Fácil).

### 4.3 Cuidados (CLAUDE.md e pesquisa)

- **Volume:** V6, V4 e V2 nos níveis de cima somam corrida. No Normal o volume é real (D3/D8: a perda no teto ~230 m/min;
  meta de intensidade 180–235). Nos níveis de cima, passar do real é escolha de jogo (o Lendário do FC não é "realista").
  As metas de intensidade do `teste-intensidade`/`teste-ia-corre` continuam valendo SÓ no Normal.
- **Faltas:** V1 (mais botes) sobe as faltas da IA. A meta do `teste-faltas-sentido` (pênaltis da IA ≤ 0,6 por partida)
  vale no Normal. Nos outros níveis é só para conferir; não pode passar do dobro sem explicação.
- **R2 e R3** já deram efeitos colaterais quando mexidos (D2/D3: ultrapassagem, `teste-nao-passa`, roubadas desfeitas).
  Medir com 24–48 partidas e conferir o `teste-nao-passa` no Difícil e no Lenda.
- **A5 sorteia:** só com o nível ≠ normal, para não mudar o fluxo do `m.rng` no Normal.

### 4.4 Metas de resultado para o `teste-dificuldade` (proposta)

Contra o roteiro (`tools/lib/humano-roteiro.mjs`: 'conduz' e 'agressivo'; 24–48 partidas por nível, as mesmas sementes):
- **Botes da IA** (tentativas: `boteErrado` + roubadas no pé + faltas no bote) por minuto de posse da pessoa: Fácil ≤ 0,7×
  Normal; Difícil ≥ 1,15×; Lenda ≥ 1,3×. Cada degrau PROVADO (Poisson, p < 5%).
- **Chutes da IA** por partida contra a pessoa: Fácil ≤ 0,75×; Difícil ≥ 1,15×; Lenda ≥ 1,25×.
- **Informativos:** gols da IA; defesas do goleiro da IA (Fácil −4 a −6 pontos; Lenda +2 a +4); PPDA da IA contra o
  "espelho" (`teste-pressao --humano`). Faixas de PPDA:

  | Nível | PPDA da IA contra o espelho |
  |---|---|
  | Fácil | 12–14 |
  | Normal | 9–10 (hoje) |
  | Difícil | 8–9 |
  | Lenda | 7–8 |

  Para comparar: o Liverpool de 2021/22 tinha 8,6 (Wyscout); o Lenda aperta mais que qualquer time real.
- **Normal:** `hash-partida --ref 8871b09d` e `hash-igual --ref 8871b09d` IGUAIS. A IA × IA nunca muda em nenhum nível:
  o painel é igual com qualquer dificuldade porque o portão é `contraPessoa`.

---

## 5. Tempo de jogo

### 5.1 Durações oferecidas

| Jogo | Opções por tempo (min) | Padrão | Fonte |
|---|---|---|---|
| FC 25 / FC 26 / FC 27 | 3, 4, 5, 6, 7, 8, 9, 10, 15, 20 | não declarado. A captura do FC 26 mostra "6 MINUTES", mas pode ser a escolha de quem capturou | fifplay (FC 25 e FC 26), fifauteam (FC 27, texto: "Choose how many minutes you want each half to last") |
| FIFA 22 | 4 a 20 | **4 min**; dificuldade padrão **Semi-Pro** | página oficial de acessibilidade da EA ("This option has a value range of 4 to 20 minutes") |
| Demo do FC 25 | 4 | 4 | fifplay |

**45 não existe** (o máximo é 20) em nenhuma versão que achei. O "45" da lista do item é o relógio mostrado, não uma opção.

### 5.2 Padrão e trava por modo

- **Kick-Off, Carreira:** a pessoa escolhe nas configurações.
- **Squad Battles:** 4 min FIXOS desde o FC 24. Nota da EA (dbltap, fut.gg): "we're reducing Squad Battles halves to 4
  minutes from 6 minutes".
- **Division Rivals, Champions:** "a universal duration, and it's not possible to tweak it", em geral 6 min por tempo
  (Destructoid).
- **FC Mobile H2H:** os 90' acelerados em ~6–8 min no total.
- **eFootball:** não confirmei o padrão. Uma liga comunitária usa "10 minutes time" na partida inteira.

### 5.3 Como o relógio anda

- O minuto mostrado é proporcional: 45' a cada tempo real de "Half Length". Com 6 min, 7,5 minutos de jogo por minuto
  real; com 4, 11,25.
- O relógio PARA nas cenas (gol, lateral, falta). Com isso o tempo do jogo rodando bate certinho com a opção. A Mein-MMO
  confere com cronômetro nas Squad Battles: "Achtet man nun darauf, keine Unterbrechungen durch Cutscenes zu haben (etwa
  bei Toren, Einwürfen, Fouls und Ähnlichem) ... kommt man auf genau 4 Minuten pro Halbzeit".
- O FC mostra MM:SS, passa de 45:00 e 90:00 e põe o "+N" ao lado. Isso já está registrado no repositório
  (`golaco/PESQUISA-ESTADIO.md`, tabela do relógio; fonte: fórum).
- Como o FC calcula os acréscimos com tempos curtos, não confirmei.
- **No golaço hoje:** `PARTIDA.minutosPorTempo` 4 e `partida.js` 145–147 `ticksPorTempo = round(min·60/PASSO)`. O minuto
  mostrado é `45 · (tick − tick0Tempo) / ticksPorTempo` (`partida.js` 1357–1363). Os acréscimos ficam em minutos DO JOGO
  (`p.acrescimo`) e viram ticks por `acrescimo · ticksPorTempo / 45` (1369). `ticksPorTempo` entra no hash (1849). O
  `criarPartida` já aceita `minutosPorTempo` (107/145) e o `?min=` (`main.js` 273) já existe.

### 5.4 Mudar no meio: o FC não deixa

Ver 1.7. A dificuldade e o tempo se escolhem antes. O FC 26 deixa mudar na Prévia da partida (antes do apito) e salva para
a próxima. Na pausa, só câmera, áudio e regras.

### 5.5 Onde aparece antes do jogo

- **Confirmado:** a tela antes da partida das Squad Battles do FC 24 mostra a duração. Nota oficial da TU3 (FC 24 1.04,
  via MP1st): "The Squad Battles pre-match screen displayed a duration of 6 minutes instead of the intended 4 minutes per
  half, this was a visual issue only".
- **Não confirmado:** o formato "Beginner, 6 minutes" (dificuldade e duração juntas) numa captura do FC. A busca não achou
  imagem da Prévia da partida (FC 26/27) com os dois campos.
- **No golaço:** o item 64 já deixou o campo pronto. `prepartida.js` 305: `l2 = [c.duracao, c.dificuldade, c.periodo]`;
  471: `dificuldade: ctx.dificuldade ?? null`; a duração é "2 × 4 min" no celular e "2 tempos de 4 min" no PC. O corte só
  tira período, árbitro, data e encurta o estádio. A dificuldade nunca sai, como a duração.
- **Proposta de texto:**
  - celular: "2 × 4 min | Normal";
  - PC: "2 tempos de 4 min | Dificuldade: Normal";
  - SÓ quando há IA contra a pessoa;
  - online, IA × IA (demo) e Pênaltis: sem a dificuldade;
  - Livre: "Sem relógio | Normal", se a dificuldade valer no Livre.

### 5.6 `mudarDuracao` puro: proposta de conta

- `T = p.ticksPorTempo`, `T' = round(min' · 60 / PASSO)`.
- Manter a fração do tempo já jogado, também nos acréscimos (`alem = m.tick − tick0 − T`, que vira `alem · T'/T`):
  - `p.tick0Tempo' = m.tick − round((m.tick − p.tick0Tempo) · T' / T)`;
  - `p.ticksPorTempo = T'`.
- `p.acrescimo` (minutos do jogo) não muda. O tempo real que falta escala com o tempo novo.
- Teste: o MM:SS mostrado antes e depois é IGUAL. A diferença de arredondamento é ≤ 1 tick: com 4 min, 1 tick = 0,1875 s
  do relógio do jogo. Escolher o arredondamento que mantém o segundo mostrado.
- Conferir os outros usos de `tick0Tempo` (`partida.js` 1379, 1707, 1709) e qualquer janela em minutos do jogo.
- **Proibido:**
  - no online (o anfitrião manda no pedido; nunca muda no meio);
  - no Livre e nos Pênaltis (sem relógio: a opção nem aparece);
  - durante cena ou replay (só na pausa).
- **Hash:** muda só quando a pessoa muda. O Normal e a duração padrão ficam IGUAIS.
- **Efeito no jogo:** os eventos crescem com o tempo real. O painel é calibrado com 4 min (~2,1 gols por partida). Com 10
  min, esperar ~2,5× gols, chutes e faltas por partida, como no FC: a súmula ao TM sai maior. Não normalizar (o FC também
  não normaliza; não confirmado).

### 5.7 Travas contra abuso (decisão do dono)

- **O risco:** mudar na pausa é o que o FC proíbe. Exemplos: encurtar o jogo quando está ganhando; trocar para Fácil
  quando precisa de um gol.
- **Proposta:**
  - fora do TM, livre;
  - no TM, a dificuldade e a duração vêm do pedido. Na pausa, mudar só se o pedido permitir;
  - o resultado ao TM leva a dificuldade MAIS FÁCIL usada e a duração final (campos opcionais), para o TM decidir pontos
    e recompensas: Total Ultimate `×mult`, Squad Battles do FC por dificuldade.
- **Rumo ao Estrelato:** a dificuldade vale (a pessoa controla um jogador; o portão `contraPessoa` já cobre o travado do
  "só o meu jogador").
- **Simular o resto:** é IA × IA e a dificuldade não age. O TM tinha o `DIFF` na simulação dele. Diferença pequena;
  anotar.

### 5.8 Lado do TM (`tm3d.js`)

- **Dificuldade:** `TM.storage.settings().difficulty` (`facil | normal | dificil | lenda`) vai no pedido.
- **Squad Battles do Total Ultimate:** mapear `batDif` → `amador:facil`, `pro:normal`, `mundial:dificil`, `lenda:lenda`.
  Fixar a duração como o FC fixa as Squad Battles (4 min = o padrão do golaço).
- **Duração:** o TM não tem configuração de duração do 3D. O "Tempo de jogo (velocidade)" do `settings.js` é a velocidade
  da SIMULAÇÃO (instantâneo, rápido, normal, lento), outra coisa. Proposta: "Duração do tempo (3D)" com 3, 4, 5, 6, 8 e
  10 min (padrão 4), ou deixar na tela antes do jogo do golaço (o ≡ do item 64).
- **Online 3D:** a duração é a do anfitrião, a dificuldade não vai.

### 5.9 Opções propostas para o golaço

- 3, 4, 5, 6, 8 e 10 min por tempo (padrão 4).
- 15 e 20 min só se o dono quiser: são as do FC, mas no celular uma partida de 40 min é longa e o painel nunca foi medido
  nisso.
- O 4 é o padrão do FIFA 22, da demo do FC 25 e das Squad Battles.

---

## 6. Nomes e implementação (o que a pesquisa e o CLAUDE.md pedem)

- **Normal = identidade de verdade:** ramificar (`if (dif)`), não multiplicar por 1 nem somar 0 (`x + 0` transforma −0 em
  +0, e isso pode mudar um `atan2`). Nenhum sorteio novo no Normal. O nível fica FORA do `hashMundo` (ou ausente no
  Normal).
- **Sobreposição POR PARTIDA**, não mutação global do `config.js`: os testes rodam várias partidas no mesmo processo. Por
  exemplo `m.dif` com as chaves resolvidas na criação, como o `IA_PESSOA` "juntado por cima", mas guardado no mundo.
- **Nomes:** procurar antes. `dificuldade` só aparece em `prepartida*.js` (o campo da tela). No `main.js` há muitos
  `duracao*` das cenas (`duracaoCena`, `duracaoCenaSubst`): para o tempo de jogo usar `minutosPorTempo`, que já é o nome da
  opção do `criarPartida`, e não `duracao`. Lição do CLAUDE.md: `m.iaMarca` já era cache, e uma chave nova não pode
  repetir a que ela cobre.
- **Medir:** contra a pessoa, 24–48 partidas por nível, metas que reprovam quando PROVAM, e conferir depois as sementes
  fixas do CI (lição do D2).

---

## 7. O que NÃO confirmei

1. O formato "Beginner, 6 minutes" na tela antes do jogo do FC (só que a duração aparece, pela nota da TU3 do FC 24).
2. O padrão do Half Length no FC 25/26/27 (no FIFA 22 era 4; a captura do FC 26 mostra 6, que pode ser escolha de quem
   capturou).
3. Os números exatos da IA por nível vindos da EA. A tabela de "%" é de fãs. Não achei datamining com tempo de reação,
   erro de passe ou de chute por nível, nem do mod do FC 25 na Nexus (403).
4. A nota "on Professional difficulty and above, the CPU AI will focus more on buildup" (FC 26 v1.1.0) veio do resumo da
   busca; a página dá 403.
5. Os nomes atuais dos níveis do eFootball e do FC Mobile.
6. Como o FC calcula os acréscimos com tempos curtos, e se o FC normaliza alguma estatística pela duração.
7. As técnicas do capítulo de Lidén e os detalhes (amostra, efeitos) de Smeddinck 2016, Depping 2016 e Xue 2017: li só os
   resumos.
8. O que `GOLEIRO.penalti.antecipa` faz exatamente no código (G2 é opcional por isso).

---

## 8. Capturas

As capturas de tela usadas na pesquisa (fifplay.com, FC 26: Configurações → Match → GENERAL com "Half Length" e "Difficulty
Level"; a aba CPU Sliders; Game Type Settings; Gameplay com as assistências) NÃO entram no repositório: só os endereços das
páginas na seção 9 (https://www.fifplay.com/fc-26-game-settings/).

---

## 9. Fontes (endereço e o que aproveitei)

**EA (oficial):**
- https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-feedback-update-november: CPU AI v1.1.3 (passes mais
  frequentes, decisões mais rápidas, drible, troca na defesa); "virtual user controlling the team".
- https://www.ea.com/en/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-title-update-1-4-0: Squad Battles mais proativa;
  tempo de reação dos defensores da IA ao marcar o condutor.
- https://www.ea.com/able/resources/fifa/fifa-22/xbox-series-x/game-settings: Half Length 4–20 (padrão 4), dificuldade
  padrão Semi-Pro, Competitor Mode, Player Based Difficulty e o indicador.
- https://ea.com/amp/news/fair-play-and-dynamic-difficulty-adjustment: sem DDA nem scripting; a patente "never was in FIFA".
- https://mp1st.com/title-updates-and-patches/ea-sports-fc-24-update-1-04-out-this-oct-12-for-title-update-3: nota da TU3
  do FC 24 (a tela antes da partida mostra a duração).
- https://www.dbltap.com/posts/ea-fc-24-ultimate-team-squad-battles-match-length-reduced-01h7dehh6ggk e
  https://www.fut.gg/news/5-big-changes-coming-to-ultimate-team-in-ea-sports-fc-24/: Squad Battles 6 → 4 min (pela busca).
- https://ea.com/en-us/games/ea-sports-fc/pitch-notes/news/fc-24-switch-deepdive: Precision Shooting no lugar do
  Semi-Assisted (pela busca).

**Imprensa e sites de fãs:**
- https://www.fifplay.com/fc-25-difficulty-levels/ e https://www.fifplay.com/fc-26-difficulty-levels/: tabela de "%";
  dificuldade não muda depois de começar.
- https://www.fifplay.com/fc-27-difficulty-levels/: escala em palavras do FC 27; o que a dificuldade afeta.
- https://www.fifplay.com/fc-27-how-to-beat-legendary-difficulty/: o Lendário dá menos tempo depois da perda; progressão
  recalibrada no FC 27.
- https://www.fifplay.com/fc-25-game-settings/ e https://www.fifplay.com/fc-26-game-settings/: Half Length 3–20; Match
  Settings; as capturas.
- https://fifauteam.com/fc-26-difficulty-levels-explained/: descrições dos níveis, Competitor Mode, Player Based Difficulty,
  pontos das Squad Battles por nível.
- https://fifauteam.com/fc-27-game-settings/: textos do jogo dos CPU Sliders do FC 27 (Defending Aggression, Stand Tackle
  Aggression, First Touch Pass Frequency "does not affect the relative attribute-driven differences"), Half Length,
  Competitor Mode e Player Based Difficulty para adversário e companheiros.
- https://fifauteam.com/fc-27-difficulty-levels/: "Most players choose Professional"; Player Based Difficulty com exemplo.
- https://realsport101.com/article/best-fc-25-sliders-for-realistic-gameplay: lista dos sliders de simulação e da CPU.
- https://egmnow.com/?p=3630: FIFA 20 TU4, Lendário (marca melhor, mais pressão, passes melhores).
- https://realsport101.com/article/fifa-21-just-got-even-harder-as-ea-rolls-out-update-to-ai-how-to-defeat-what-is-competitor-mode:
  FIFA 21 TU3, Competitor Mode.
- https://www.sportsgamersonline.com/games/soccer/fifa-20-october-title-update-2-is-out/amp/: goleiro da CPU não entrega o
  lado do pênalti no Lendário/Ultimate (pela busca).
- https://vgr.com/?p=48017: FIFA 20, menos reações "sobre-humanas" do goleiro no 1×1 (pela busca).
- https://gameluster.com/fc-27-defending-manual-control/: FC 27, alcance de bote e interceptação da IA reduzido (Rivera,
  Doskov; PCGamesN, 15/09/2026).
- https://www.pcgamesn.com/fifa-19/scripting-dda-momentum: a EA nega scripting e DDA; "poor touches or poor shots" por
  fatores do jogador.
- https://www.thesixthaxis.com/2019/06/19/fifa-20-dynamic-difficulty-patent-ea-promise-they-arent-using/: patente
  US10286323B2.
- https://mein-mmo.de/ea-fc-24-4-minuten-in-squad-battles-einstellen/: cronômetro, o relógio para nas cenas, 4 min exatos.
- https://destructoid.com/?p=533892: Rivals e Champions com duração fixa, em geral 6 min (pela busca).
- https://renderz.app/news/article/ai-difficulty-reworked-in-fc-mobile~169: retrabalho da dificuldade do FC Mobile
  (23/10/2024).
- https://en.wikipedia.org/wiki/EA_Sports_FC_Mobile: H2H de 90' em ~6–8 min (pela busca).
- https://www.konami.com/efootball/en/page/2024/versioninfo_v3-00: eFootball v3.00, "Match Level", decisões e equilíbrio.
- Fórum da EA, só o resumo da busca (403):
  - https://forums.ea.com/discussions/fc-27-feedback-en/world-class-difficulty-is-an-embarrassment-to-gameplay-balance-in-fc-27/13826809
  - https://forums.ea.com/discussions/fc-26-feedback-en/ai-difficulty-needs-to-be-rebalanced---pro-too-easy-wc-too-hard-/13064386
  - https://forums.ea.com/discussions/fc-26-feedback-en/world-class-and-professional-difficulties-gap/13441823
  - https://forums.ea.com/discussions/fc-26-technical-issues-en/settings-not-working/13010564
- https://www.osftw.com/news/884990/active-intelligence-system-in-fifa-17-trailer-interview: a queixa dos 89–95% de passe
  certo (fã; pela busca).

**Pesquisa acadêmica e de desenvolvedores:**
- Hunicke 2005 (ACE), PDF do Hamlet: https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf (pela busca; não li o PDF).
- Andrade et al. 2005: https://hal-ensta-paris.archives-ouvertes.fr/UPMC/hal-01492624 (resumo).
- Mick West 2009: https://www.gamedeveloper.com/programming/intelligent-mistakes-how-to-incorporate-stupidity-into-your-ai-code
- Jimenez 2009: https://www.gamedeveloper.com/design/the-pure-advantage-advanced-racing-game-ai
- Gonçalves et al., CHI 2024: https://techandpeople.github.io/downloads/TheTrickIsToStayBehindPoster.pdf (pôster; resumos
  pela busca).
- Smeddinck et al., CHI 2016: https://www.cs.mcgill.ca/~jeromew/data/COMP766/CHI2016/p5595-smeddinck.pdf (resumos).
- Depping et al., CHI 2016: dblp https://dblp.uni-trier.de/pid/179/4636.html (resumo).
- Xue et al., WWW 2017: https://archives.iw3c2.org/www2017/proceedings/companion/p465.pdf (resumo pela busca; o PDF veio
  binário).
- Sepulveda, Besoain, Barriga 2020: https://arxiv.org/abs/2007.07220

**Repositório** (lido, não alterado; worktree 8871b09d):
- `golaco/js/config.js`: IA, IA_DEFESA, IA_ATAQUE, IA_PESSOA, ACOES.boteIA, GOLEIRO, PARTIDA.
- `golaco/js/partida.js`: relógio, `ticksPorTempo`, acréscimos, hash.
- `golaco/js/sim.js boteIA`.
- `golaco/js/tatica.js contraPessoa`.
- `golaco/js/prepartida.js linhaInfo`.
- `legacy-total-match/js/settings.js`, `storage.js`, `engine.js` (DIFF), `ut-modos.js` (DIFS).

---

## 10. A calibração (05/11; o que foi medido)

A régua: `tools/teste-dificuldade.mjs` (time 0 = a pessoa roteirizada, `tools/lib/humano-roteiro.mjs`, nos 4 roteiros; 2 × 4 min;
8 sementes por roteiro = 32 partidas por nível, PAREADAS — as mesmas sementes e roteiros em todos os níveis; a razão ao Normal com
o p5–p95 de um bootstrap estratificado por roteiro). Na base 8871b09d o Normal mede: 7,86 botes da IA por minuto de posse da pessoa,
4,94 chutes da IA e 2,78 da pessoa por partida, 2,16 faltas da IA, gols 0,88 × 0,25, posse da IA 71,8%.

| Rodada | O que mudou (só nos níveis; o Normal é sempre o mesmo) | Botes Fácil / Difícil / Lenda | Chutes da IA Fácil / Difícil / Lenda | Faltas Lenda |
|---|---|---|---|---|
| 1 | os valores iniciais da especificação | 0,79 / 1,15 / 1,26 | 0,91 / 1,09 / 1,06 | 1,35 |
| 2 | bote do Fácil 0,025/110, engaja −8, encurta 0,1; Difícil 0,12/34, +3, 0,38; Lenda 0,18/24, +5, 0,45; `chuteLonge` e `chutePosse` entram (a vontade de chutar de fora e o custo de perder a posse no chute) | 0,67 / 1,25 / 1,40 | 0,77 / 1,15 / 1,20 | 1,55 |
| 3 | mais vontade de chutar (Difícil `chuteLonge` 0,42; Lenda `chute` 4,6, `chuteLonge` 0,65) | 0,64 / 1,23 / 1,37 | 0,76 / 0,98 / 1,27 | 1,55 |
| 4 | Fácil `chute` 1,2, `chuteLonge` 0,05, `chutePosse` 0,7; Difícil `chute` 4,6/0,65/0,3; Lenda bote 0,22/20, +6, 0,5, `chute` 5,6/1,0/0,2 | 0,61 / 1,29 / 1,54 | 0,67 / 1,07 / 1,31 | 1,45 |
| 5 | Difícil `chute` 5,2/0,85/0,22; Lenda `chute` 6,5/1,0/0,1 | — / 1,27 / 1,54 | — / 0,97 / **1,31 (as MESMAS partidas da rodada 4)** | 1,45 |
| 6 | Difícil com `avaliaTicks` 5 (e os chutes da rodada 4); Lenda com `avaliaTicks` 4 | — / 1,25 / 1,43 | — / 1,18 / 1,18 | 1,17 |
| **final** | Fácil da rodada 4, Difícil da 6, Lenda da 4 | **0,61 / 1,25 / 1,54** | **0,67 / 1,18 / 1,31** | **1,45** |

Leituras:
- **A vontade de chutar satura.** Na rodada 5 o Lenda com `chute` 6,5 deu as mesmas 32 partidas, bit a bit, que com 5,6: a decisão do
  condutor já escolhia o chute em todo lance em que ele aparecia. O que põe a IA mais vezes em posição de chute é ter a bola de volta
  mais cedo (bote, engajamento, encurtar: as roubadas no campo da pessoa) e pensar mais rápido (`avaliaTicks` 5 = 0,083 s, a
  "velocidade de reação" das descrições do FC).
- **O bote satura também** (o mapa: +50% na chance por tick = +21% de botes): o Lenda precisa de 0,22 por tick (2,75× o Normal) para
  dar 1,54× os botes. As faltas sobem menos que os botes (1,45×; a guarda é 1,8×).
- **O ruído entre configurações vizinhas é maior que o efeito pequeno**: o Difícil, com quase os mesmos valores, mediu 0,97–1,18 nos
  chutes da IA entre as rodadas (uma mudança qualquer embaralha todas as partidas contra o roteiro — a lição do D2/D3). Por isso o CI
  só exige PROVAR os degraus grandes (Fácil < Normal e Normal < Lenda) e o `--completo` (16 sementes) os vizinhos.
- **O inverso na pessoa**: os chutes do time da pessoa no Fácil 1,85× o Normal (o roteiro 'conduz' chuta 15,6 por partida contra 7,8)
  e no Lenda 0,82×.
- A contrapressão por nível, o "2º melhor passe" do Fácil e o `antecipaPressao` (a reserva da especificação) não foram precisos.

**A contraprova com outras sementes (a lição do D8: repetir antes de concluir).** Com a tabela final:

| Amostra | Botes Fácil / Difícil / Lenda | Chutes da IA Fácil / Difícil / Lenda | Chutes da pessoa Fácil / Difícil / Lenda | Faltas Lenda | O teste |
|---|---|---|---|---|---|
| sementes 1–8 (as do CI), 32 por nível | 0,61 / 1,25 / 1,54 | 0,67 / 1,18 / 1,31 | 1,85 / 1,19 / 0,82 | 1,45 | PASSOU |
| sementes 9–16, 32 por nível | 0,62 / **1,15** / 1,49 | **0,77** / **1,08** / **1,24** | 1,45 / 0,77 / 0,63 | 1,25 | REPROVOU nos PONTOS: Difícil 1,15 no limite dos botes (≥ 1,15); chutes Fácil 0,77 (≤ 0,75), Difícil 1,08 (≥ 1,10), Lenda 1,24 (≥ 1,25). As PROVAS (Fácil < Normal < Lenda) passaram |
| `--completo` (16 sementes, 64 por nível) | 0,61 / 1,20 / 1,52 | 0,72 / **1,13** / 1,27 | 1,62 / 0,94 / 0,71 | 1,34 | REPROVOU: chutes do Difícil 1,13 (o `--completo` pede ≥ 1,15) e o D7 — os degraus VIZINHOS dos chutes não se provam (Normal < Difícil 0,89 [0,77–1,03]; Difícil < Lenda 0,88 [0,76–1,02]) |

Leitura: os degraus grandes (Fácil < Normal < Lenda) se provam em todas as amostras; os PONTOS do CI (8 sementes) foram calibrados
nas sementes 1–8 e erram por pouco nas 9–16 (o efeito do Difícil nos chutes é ~1,1–1,2, do tamanho do ruído de 32 partidas). O
`--completo` fica como medida do dono, fora do CI.

**Rodada 7 (testada, NÃO entrou):** Difícil bote 0,14/30, engaja +4, encurta 0,42; Lenda bote 0,26/16, encurta 0,55. Nas 16
sementes os botes e os chutes do Difícil passam (1,25 e 1,20), mas o Lenda passou a deixar a pessoa chutar MAIS que o Difícil
(chutes da pessoa Difícil 0,72 × Lenda 0,84: "Difícil < Lenda" provado no lado errado, o D6 reprova) e os chutes Difícil < Lenda
continuam sem prova (0,93 [0,81–1,07]). Ficou a tabela final.

## 11. A revisão (05/11): calibrar pelo RESULTADO

As revisões do item 33 mostraram que a tabela da §10 acertava os SUBSTITUTOS (botes e chutes da IA) e errava o que a pessoa sente:
os gols da IA não mudavam entre os níveis (0,83 / 0,89 / 0,95 / 0,94 por partida) e o Lenda não era mais difícil que o Difícil. A
causa medida (revisão B2): o `chuteLonge` 0,65/1,0 e o `chutePosse` 0,3/0,2 do Difícil e do Lenda trocavam a chance boa pelo chute de
longe (chutes da IA de mais de 20 m: 8 / 21 / 44 / 51%; gol por chute 24 / 20 / 16 / 15%). E o Fácil, que perdia a vontade de chutar
de fora (`chuteLonge` 0,05), só chutava de perto e convertia MAIS (revisão B3). Três alavancas não mexiam em nada que se meça
(revisão B4): `avaliaTicks` (o tempo com a bola do condutor da IA ficou 0,85–0,87 s em todos), o `erro` ×1,2 no passe (passe certo
82–83%) e a `reacaoGoleiro` (defesas do goleiro da IA 63 / 58 / 67 / 56%).

**O que mudou** (`config.js DIFICULDADE`; o Normal continua o jogo de hoje, bit a bit):

| | Fácil | Difícil | Lenda |
|---|---|---|---|
| `utilidade.chute` | 1,2 → **2,0** (a vontade de chutar de DENTRO cai a 2/3 da do Normal) | 4,6 → **3,6** | 5,6 → **4,2** (o teto da reserva A1 da especificação) |
| `utilidade.chuteLonge` | 0,05 → **0,6** (o chute de fora vale 1,2, mais que no Normal: chutar de longe à toa é decidir PIOR) | 0,65 → **o do Normal** (0,25) | 1,0 → **o do Normal** |
| `utilidade.chutePosse` | 0,7 → o do Normal | 0,3 → o do Normal | 0,2 → o do Normal |
| `contrapressao` (s / quantos, na Média) | **1 s / 1** (era o do Normal, 3 s / 2) | **4 s / 2** | **5 s / 3** (a reserva V4) |
| `contencao` (m somados à do 1º homem) | **+1,0** | **−0,4** | **−0,6** (revisão B5) |
| `erroChute` (só o chute) | **1,5** (era `erro` 1,2 no passe e no chute) | — | — |
| `avaliaTicks`, `reacaoGoleiro` | **saíram** (sem efeito medível; o `goleiro.js` saiu do fecho do diff) | `avaliaTicks` saiu | `avaliaTicks` saiu |

O bote, o engajamento, o encurtar, a leitura do passe (`le`) e o `passeAntecipa` ficaram como na §10.

**Medido** (`teste-dificuldade`, as mesmas partidas pareadas: 4 roteiros × 16 sementes = 64 por nível, duas amostras independentes;
o saldo é o da pessoa, gols dela − gols da IA, por partida):

| Medida | Antes (sementes 1–16) | Depois, sementes 1–16 | Depois, sementes 17–32 |
|---|---|---|---|
| gols da IA por partida, F / N / D / L | 0,83 / 0,89 / 0,95 / 0,94 | **0,64 / 0,89 / 1,08 / 1,22** | **0,66 / 0,88 / 1,06 / 1,17** |
| saldo da pessoa | −0,49 / −0,64 / −0,65 / −0,78 | **−0,16 / −0,64 / −0,81 / −0,88** | **−0,24 / −0,47 / −0,76 / −0,86** |
| V/E/D da pessoa | 12/24/28 · 9/27/28 · 10/21/33 · 7/24/33 | 13/31/20 · 9/27/28 · 8/22/34 · 12/16/36 | 11/31/22 · 13/28/23 · 5/27/32 · 11/14/39 |
| xG da IA por partida | 0,75 / 0,66 / 0,67 / 0,75 | 0,53 / 0,66 / 0,82 / 0,97 | 0,48 / 0,76 / 0,84 / 0,82 |
| chutes da IA (de até 20 m) | 3,52 (3,38) / 4,89 (3,75) / 5,52 (2,78) / 6,23 (3,28) | 3,89 (2,53) / 4,89 (3,75) / 5,66 (4,36) / 6,28 (4,92) | 3,47 (2,30) / 4,83 (3,91) / 5,58 (4,39) / 5,58 (4,14) |
| botes da IA (razão ao Normal) | 0,61 / 1 / 1,20 / 1,52 | 0,52 / 1 / 1,24 / 1,51 | 0,53 / 1 / 1,26 / 1,52 |
| chutes da pessoa (razão) | 1,62 / 1 / 0,94 / 0,71 | 1,55 / 1 / 0,86 / 0,73 | 1,77 / 1 / 0,79 / 0,84 |
| faltas da IA por partida | 1,81 / 2,44 / 2,83 / 3,27 | 1,86 / 2,44 / 2,61 / 3,41 | 2,08 / 2,27 / 2,77 / 3,41 |

Nas 128 partidas por nível: gols da IA **0,65 / 0,89 / 1,07 / 1,20** e saldo da pessoa **−0,20 / −0,56 / −0,79 / −0,87** — os quatro
níveis em ordem nas duas amostras. Provado (bootstrap pareado, 90%): gols da IA Fácil < Lenda (0,53 [0,37–0,72] e 0,56 [0,40–0,75]) e
saldo da pessoa Fácil > Lenda (+0,72 [0,38–1,08] e +0,63 [0,30–0,97]); Fácil > Normal no saldo numa amostra (+0,48 [0,16–0,83]) e não
na outra (+0,23 [−0,05–0,52]); Normal > Difícil no saldo numa (+0,30 [0,05–0,56]). Entre Difícil e Lenda o resultado é quase o mesmo
(gols da IA 1,07 × 1,20; saldo −0,79 × −0,87): o Lenda se separa pelo aperto (botes 1,51× contra 1,25×, faltas 3,4 contra 2,7).

**Leituras:**
- O que põe gol na conta é a chance boa: com a vontade de chutar até 4,2 e o chute de fora no peso do Normal, a bola recuperada mais
  cedo (bote, engajamento, contrapressão) vira chute de PERTO (de até 20 m: 3,75 → 4,92 no Lenda) em vez de chute de longe.
- O Fácil é fácil pelos dois lados: a IA chuta menos de perto e erra mais o chute, e a pessoa chuta 1,6–1,8× mais (a IA aperta
  metade e quase não faz contrapressão).
- A distância que a pessoa vê do 1º defensor 0,5 s e 1 s depois do domínio quase não mudou (3,8 / 4,1 / 4,0 / 4,0 m e 3,2 / 3,4 /
  3,3 / 3,2 m): a `contencao` vale só no ramo 'contem', e no Fácil a posse com o defensor colado sobrevive mais (ele quase não dá o
  bote) — a mesma seleção da revisão B5. Ficou a alavanca (o sentido é o do FC), sem efeito medível nessa régua.
- O ponto do Lenda no xG (≥ 1,15) e os degraus vizinhos no xG (Normal < Difícil, Difícil < Lenda) não se provam em toda amostra de 64
  (sementes 17–32: Lenda 1,09, Difícil < Lenda 1,03 [0,87–1,24]): a distância entre vizinhos continua para o dono ("Depende do dono"
  22).

**O teste** (revisão A2: a meta só reprova quando PROVA): no CI (sementes 1–8) os pontos reprovam só com o p5/p95 do lado errado; as
provas exigidas são as que passam em TODA amostra de 32 partidas medida (os 4 blocos de 8 sementes de 1 a 32): botes Fácil < Normal
< Lenda, xG Fácil < Lenda, chutes da pessoa Fácil > Lenda, faltas do Lenda ≤ 1,8× e nenhum lado errado provado nos gols da IA e no
saldo (D9). O `--completo` (16 sementes) é a medida do dono, fora do CI e não é passo antes do merge: os pontos exatos, os vizinhos
provados (D7) e o resultado Fácil < Lenda provado (D9); nas sementes 1–16 reprova só no D7 (xG Normal < Difícil 0,80 [0,65–1,00],
Difícil < Lenda 0,85 [0,68–1,05]).

**Desvio da especificação registrado** (revisão B3 da duração): com a duração de destino abaixo de 0,75 min (T' < 2700 ticks, só pelo
`?min` e pela API; o ciclo da pausa nunca vai abaixo de 3 min) o `mudarDuracao` mantém o MINUTO e o segundo mostrado pode voltar
alguns segundos (o T2 do `teste-partida` conta 592 casos, informativo); com as 6 opções o segundo fica IGUAL em todos os casos.
