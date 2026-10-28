# Cenas de parada — referências (pesquisa de 22/10)

Pedido do dono (22/10, para depois dos rostos reais): "a cena de pós jogo, e a cena de intervalo, as cenas de cartões, e os
replays de faltas e jogadas passando na tela enquanto o jogo tá parado". Este arquivo junta o que as TRANSMISSÕES e os JOGOS
fazem, com números e fontes, e no fim de cada seção a tradução para o golaco (só desenho; o fecho do hash não muda; sem
narração: só o que a transmissão mostra). Nada foi lido do `futebol3d/`.

Método: WebSearch/WebFetch (sem Firecrawl). Vários sites deram 403 (SoccerGaming, Prima Games, GodIsAGeek, fórum da EA,
SAGE, USPTO): o que deles entra aqui veio do resumo da busca e está marcado "(resumo da busca)". O roteiro da DFL foi baixado
e lido com um extrator de PDF próprio (as colunas da tabela vieram embaralhadas na extração; a ordem dos rótulos abaixo é a
mais provável e está marcada quando houver dúvida).

---

## 0. A régua comum (vale para as 4 cenas)

### 0.1 O roteiro oficial de uma transmissão de verdade — DFL / Bundesliga International Feed
Fonte: "International Rundown MD22 FC Bayern München × 1. FC Union Berlin, 26/02/2023" (DFL, sinal internacional com
comentário em inglês; 26 câmeras "Top Match Plus": aérea, drone, câmeras de bandeirinha, polecam de alta velocidade).
https://b2b-newsletter.bundesliga.com/mailfiles/01/011a128c-c6ca-4be4-ad13-bf2e5e672061/2023-02-13_InternationalRundown_MD22_FCB-FCU.pdf

**Intervalo (apito do 1º tempo ≈ 18:16 → bola rolando no 2º tempo ≈ 18:33: ~17 min de sinal):**

| Início | Duração | Conteúdo (campo) | Gráfico no mesmo trecho |
|---|---|---|---|
| 18:16:00 | 1:00 | Jogadores saindo do campo / autores dos gols / técnicos / clima do estádio (acaba na 1ª pausa do comentário) | +0:20 do apito: tarja de baixo "placar do intervalo + autores + xGoals", **8 s** (+4 s de patrocínio) |
| 18:17:00 | 2:00 | Placar do intervalo em realidade aumentada; mano a mano, autor, técnicos, times saindo (acaba na 2ª pausa) | |
| 18:19:00 | 0:10 | Fim do comentário do 1º tempo | |
| 18:19:10 | 8:00 | "Halftime Compilations" — melhores momentos do 1º tempo sem voz (play-out) | +3:10: vídeo, **8:00** |
| 18:27:10 | 1:50 | Clima do estádio / estatísticas de time e de jogador; volta do comentário | +11:10: dados, **2:00** (estatísticas); +12:10: tela cheia, **0:50** ("posições médias/tendências" por janela de tempo); +13:00: RA, **0:15** |
| 18:29:00 | 0:15 | 2º começo do comentário; jogadores no túnel | |
| ≈ 18:33 | — | Saída do 2º tempo | 46': "Placar e relógio: substituições do intervalo", **6 s** |

**Pós-jogo (apito final ≈ 19:18 → fim do sinal 19:45: ~27 min):**

| Início | Duração | Conteúdo (campo) | Gráfico |
|---|---|---|---|
| 19:18:00 | 2:30 | Jogadores saindo / autores dos gols / técnicos / clima (mano a mano, times saindo) | +0:20: tarja "placar final + autores + xGoals", **8 s** |
| 19:20:30 | 0:15 + 0:15 | Placar final em realidade aumentada (com vídeo) | +2:30: RA, **0:15** |
| ≈ 19:21 | 2:00 | Até a 2ª pausa do comentário | |
| ≈ 19:23 | 4:40 | "Super Flash Interviews" (EN) / estatísticas de time e de jogador | +5:00: estatísticas pós-jogo (se não houver entrevista) |
| 19:27:40 | 0:20 | Fim do comentário | +9:00: tabela do campeonato em tela cheia, **0:40** |
| 19:28:00 | 0:30 | Vinheta de encerramento | |
| 19:28:30 | 5:00 | Melhores momentos (play-out) | |
| 19:33:30 | 11:30 | Entrevistas / "beauty shot" (plano bonito do estádio) até o fim | |

**Gráficos de evento durante o jogo (todos no "Placar e relógio"):** depois do gol **6 s**; substituição **6 s**; **cartão
amarelo/vermelho = "identificação do jogador" 6 s** (+4 s de patrocínio); pênalti **6 s** ("últimos pênaltis do
jogador"); "Match Facts" da Bundesliga 8–16 s (recorde de velocidade 16 s, probabilidade de vitória 8 s, bola parada 12 s);
acréscimos 8 s; patrocínio de 4 s a cada 10 min. Na saída de cada tempo: placar e relógio.
→ **Regra que dá para copiar:** gráfico de evento = 6 s; placar/autores do intervalo e do fim = 8 s, 20 s depois do apito;
ninguém narra o lance em texto — o gráfico só IDENTIFICA (nome, número, cartão, placar).

### 0.2 Replays medidos em 500 jogos — SoccerNet-v2 (Deliège et al., CVPR-W 2021)
https://arxiv.org/abs/2011.13367 (texto: https://ar5iv.labs.arxiv.org/html/2011.13367)
- **32.932 planos de replay** ligados à ação mostrada; **66 por jogo**, **43 por hora**, **duração média 6,8 s por plano**.
- "Normalmente **1 a 3 replays** da ação são mostrados de pontos de vista diferentes".
- Dos planos da transmissão: **86,7% ao vivo, 10,9% replay de uma ação, 2,4% outro replay**.
- Transições: **71,4% corte seco, 14,2% fusão, 14,2% vinheta com logo**.
- 583 trocas de câmera por jogo; 13 classes de plano: câmera principal (centro, esquerda, direita), principal atrás do gol,
  câmera da linha do gol, spidercam, close de jogador ou árbitro, close do banco/comissão, close do escanteio, close atrás do
  gol, dentro do gol, torcida, outro. Ações anotadas incluem "Yellow card", "Yellow then red card", "Red card", "Foul",
  "Substitution", "Offside" (as classes que um replay de parada costuma mostrar).

### 0.3 Quanto dura cada parada de verdade — Opta / The Analyst (Premier League)
- 2022-23 (https://theanalyst.com/articles/guide-to-premier-league-time-wasting): lateral ~16 s (13,6–19 por time), tiro de
  meta ~30 s, "meio minuto perdido em cada falta, escanteio e tiro de meta" (falta 31,3–40,9 s por time), **pênalti ~2 min
  até a cobrança**, **comemoração de gol 72 s**, **VAR ~73 s**; ~38 laterais por jogo; bola rolando 54 min 46 s (55,8%).
- 2025-26 (https://theanalyst.com/articles/premier-league-football-time-throw-ins-goal-kicks-substitutions-stats): lateral
  17,9 s, tiro de meta 30,1 s, **substituição 73,6 s** (MLS 2025: 65,2 s).
- 2026-27 (https://theanalyst.com/articles/premier-league-2026-27-five-trends): lateral 15,3 s, tiro de meta 27,7 s (o menor
  já medido), por causa da contagem de 5 s da IFAB.

### 0.4 Leis do jogo que mexem nas cenas (IFAB 2025/26 e 2026/27)
- **Lei 7.2:** "intervalo ... não superior a 15 minutos"; a duração é do regulamento e só muda com permissão do árbitro.
  **Lei 7.3:** acréscimo por substituições, atendimento, cera, sanções disciplinares, VAR, **comemoração de gol**.
  https://www.theifab.com/laws/latest/the-duration-of-the-match/
- **Lei 12.3:** o jogo "não pode recomeçar até a sanção ser aplicada"; com vantagem, o cartão sai na PRÓXIMA bola fora;
  o expulso "tem de deixar as imediações do campo e a área técnica"; a autoridade vai da vistoria antes do jogo até sair do
  campo depois do fim. https://www.theifab.com/laws/latest/fouls-and-misconduct/
- **2026/27** (IFAB, https://theifab.com/news/the-ifab-introduces-further-measures-to-improve-match-flow-and-player-behaviour/;
  resumos: Irish FA, Concacaf): lateral/tiro de meta retardados de propósito → o árbitro apita, sinaliza e faz **contagem
  VISUAL de 5 s** (perde o lateral; o tiro de meta vira escanteio); quem sai na substituição tem **10 s** desde a placa e
  sai **pelo ponto mais perto**; o atendido em campo fica **1 min fora** depois do recomeço.
- **"Só o capitão"** (UEFA desde a EURO 2024; Premier League 2025/26; recomendado pela IFAB, não obrigatório): só um
  jogador de cada time se aproxima do árbitro; quem chega com reclamação/desrespeito leva amarelo.
  https://www.premierleague.com/en/news/4373884 ; https://www.thescore.com/news/2912240

---

## 1. Pós-jogo

### TV
- **Estrutura e tempos:** DFL (0.1): apito final → **2:30 de campo** (jogadores saindo, autores dos gols, técnicos, mano a
  mano, clima) com a tarja do placar final + autores aos **+20 s por 8 s** → placar final em RA **15 s** aos +2:30 →
  estatísticas de time e jogador (+5:00) e tabela (+9:00, 40 s) → melhores momentos (5:00). O plano de câmera do fim é o
  mesmo do intervalo ("players leaving pitch / scorers / coaches / stadium atmosphere"): autor do gol, técnicos, torcida.
- **Melhor em campo:** Premier League — voto da torcida no site/app que **abre no apito final e fecha 15 min depois**
  (https://www.premierleague.com/news/1264918); Champions — escolhido pelos observadores técnicos da UEFA, **troféu entregue
  depois do fim** (https://www.uefa.com/uefachampionsleague/news/029d-1ebc5919370a-12e5f6ca70df-1000--all-you-need-to-know-about-the-uefa-technical-observers-for-the-202526-champions-league-season/);
  Brasil (Globo) — "Craque do Jogo" votado pelos internautas DURANTE a transmissão, a repórter entrega o troféu no gramado
  depois do jogo (caso Sidão, 2019: https://www.metropoles.com/esportes/futebol/goleiro-tem-atuacao-ruim-e-e-ridicularizado-em-premiacao-da-tv-globo);
  em 2024 "Craque Betano da Partida" (https://www.poder360.com.br/poder-sportsmkt/craque-do-jogo-betano-brasileirao-1-milhao-interacoes/).
- **Troca de camisa:** costume de fim de jogo como sinal de respeito (1º registro 1931); também acontece no intervalo e no
  túnel; nenhuma regra proíbe (https://en.wikipedia.org/wiki/Shirt_swapping).
- **Final grande:** HBS na final da Copa 2026 com 60 câmeras e cerimônia do troféu (SVG,
  https://www.sportsvideo.org/newsletter/archive/sunday-inside-world-cup/) — fora do nosso escopo (liga, não final).
- **Estatísticas que as transmissões usam** (wTVision, https://www.wtvision.com/football-graphics-explained): posse,
  finalizações, finalizações no alvo, acerto de passe, escanteios, faltas, comparação de jogadores; "os melhores gráficos
  escolhem os números que explicam a fase do jogo"; gráfico grande demais "cobre o jogo e polui".

### Jogos
- **EA SPORTS FC 25** (https://www.ea.com/ea-studios/ea-sports/news/visuals-audio-deep-dive): replays de gol "durante e
  depois da partida"; **no pós-jogo, "uma sequência de 3 ângulos de câmera"** por gol. **Match Recap** no intervalo e no fim
  (offline; online só no fim) (https://www.ea.com/en/games/ea-sports-fc/fc-25/news/fc-25-highlighter).
- **Match Facts do FC 25** (https://fifauteam.com/fc-25-stats-match-facts-performance/): Resumo = posse, tempo de recuperação,
  chutes, xG, passes, desarmes, defesas, faltas, impedimentos, escanteios, tiros livres, pênaltis, amarelos, vermelhos,
  quebras de linha; abas Posse, Finalização, Passe, Defesa, Eventos; "Performance" por jogador com **Melhor em campo** e
  notas.
- **FC 24** (resumo da busca, SoccerGaming/Prima): a EA CORTOU as introduções longas porque "muitos jogadores pulavam";
  os "Insight Overlays" substituíram parte das telas de estatística do intervalo e do fim; FC 24 TU3 corrigiu um travamento
  na tela de pós-jogo. A crítica recorrente: "a maioria pula quase todas as cenas" (https://www.fifplay.com/article-is-the-ea-sports-fc-24-matchday-experience-any-good/).
- **eFootball/PES:** não achei documentação oficial de cena de pós-jogo; a cena de "melhor em campo" do PES 2021 só existe em
  mod (https://www.pesmodding.com/2025/10/scene-potm-player-of-match-for-pes-2021.html) — sinal de que os jogadores pedem.

### Tradução para o golaco (proposta)
Partida de 2 × 4 min: o pós-jogo da TV (2:30 de campo) não cabe; o padrão dos jogos é curto e pulável. Proposta ~30–40 s,
qualquer toque pula para a tela do resultado:
1. Apito final (o tick do `fimDeJogo`; o mundo já fica parado) → corte para os jogadores: quem ganhou comemorando/abraçando,
   quem perdeu agachado ou com as mãos na cabeça (a mesma locomoção + gestos da `comemoracao.js`), 6–8 s.
2. Cumprimentos: duplas de adversários se cumprimentando, árbitro cumprimentado pelos capitães, 1 ou 2 trocas de camisa
   (sorteio por hash do jogo, sem `m.rng`), 5–6 s.
3. Técnicos (`tecnicos.js`, o gancho `treinadorDoTime`): aperto de mão na linha lateral, 4 s.
4. Torcida (o ânimo de `render/emocao.js` pelo resultado: festa de quem ganhou, vaia/silêncio de quem perdeu), 3–4 s.
5. Melhor em campo pela nota da súmula (`sumula.js`): plano fechado dele (a foto do TM, quando houver) com a tarja de
   identificação (nome + número), 5 s.
6. Placar final (a tarja da DFL: placar + autores, 8 s) e uma tela de estatísticas da súmula com 5–6 números (posse,
   finalizações, no alvo, escanteios, faltas, cartões) — tudo é gráfico de transmissão, nenhum texto narra o lance.
7. Opcional: os gols da partida em 1 ângulo cada (o anel só tem 10 s; ver 4 — precisaria guardar os lances).

## 2. Intervalo

### TV
- **IFAB:** ≤ 15 min. **DFL** (0.1): ~17 min de sinal entre os apitos; **1:00** de jogadores saindo/autores/técnicos/clima,
  tarja do placar do intervalo + autores aos **+20 s por 8 s**, **2:00** de placar em RA e times saindo, **8:00** de melhores
  momentos, **~2:00** de estatísticas (+0:50 de posições médias), jogadores no túnel e a saída do 2º tempo; aos 46' a
  tarja das substituições do intervalo (6 s).
- **Vestiário:** na Premier League 2025/26 o acesso ao vestiário é restrito e **nunca no intervalo nem na preleção**
  (The Telegraph via Goal BR, https://www.goal.com/br/listas/premier-league-tera-entrevistas-jogadores-substituidos-transmissoes-temporada-2025-26-segundo-jornal-ingles/blt48504c0c730ce2db)
  — a TV mostra o caminho até o túnel e a volta, não o vestiário.
- **Brasil:** a Globo 2025 estreou Supercine Cam (plano cinematográfico dos rostos), superdrone e cabo; grafismo novo com
  tempo, placar e "a bolinha que pinta quando sai um gol na rodada" (https://www.netvasco.com.br/n/358161/tv-globo-anuncia-novidades-para-a-cobertura-do-brasileiro-2025).
  Não achei roteiro público do intervalo da Globo/Premiere nem da TNT/CBS na Champions (lacuna).

### Jogos
- **FC 24** (resumo da busca, SoccerGaming): cenas de intervalo com jogadores entrando no vestiário, conversa no vestiário,
  reservas aquecendo no gramado, comentaristas; Prima: os Insight Overlays "tiram as chatas estatísticas do intervalo".
- **FC 25:** Match Recap no intervalo (offline). Pedido recorrente dos jogadores (fórum da EA, FC 27, resumo da busca):
  intervalo com cenas que mudam pelo placar e pelo desempenho.

### Tradução para o golaco (proposta)
Hoje: faixa "Intervalo" de 3 s (`PARTIDA.intervalo`) + plano geral. Proposta ~20–30 s, pulável:
1. Apito do 1º tempo → jogadores caminhando para o túnel (o caminho do cortejo do pré-jogo ao contrário, `cortejo.js`;
   o placar pesa no gesto: quem perde de cabeça baixa), árbitros na frente, 6–8 s; técnicos indo junto.
2. Tarja do placar do intervalo + autores (8 s, como a DFL) sobre o plano do estádio.
3. Melhores momentos do 1º tempo: 2–3 lances × 5–7 s (gols, a maior chance, a defesa) — exige guardar lances além do anel de
   10 s (ver 4).
4. Estatísticas do 1º tempo (as mesmas 5–6 da pós-jogo), 6 s.
5. Volta: times saindo do túnel (o cortejo curto) e a saída do 2º tempo; as trocas do intervalo na faixa ENTRA/SAI que já
   existe. Pausa/Editar time continuam disponíveis.

## 3. Cartões

### O árbitro (regras e prática)
- Procedimento: parar o jogo, **isolar o jogador**, dizer o motivo, **erguer o cartão acima da cabeça olhando/apontando
  para ele**, anotar no caderno ("booking") — a ordem pode inverter (mostrar primeiro) para não esquentar o lance.
  https://en.wikipedia.org/wiki/Penalty_card ; https://www.askasoccerreferee.com/?p=1221 ;
  https://legacy.nisoa.com/instruction/intercollegiate-instruction/2010/09/01/compilation-of-input-for-isolating-a-player/
  (afasta os outros com o braço estendido, mão erguida).
- **2º amarelo:** mostra o amarelo e em seguida o vermelho. **Vermelho:** sai das imediações do campo e da área técnica
  (Lei 12); o time fica com um a menos.
- **Reclamação:** "só o capitão" (0.4) — o resto fica longe; quem cerca o árbitro reclamando leva amarelo.
- Com vantagem, o cartão vem na próxima bola fora — a cena pode acontecer num lateral, longe do lance.

### TV
- Gráfico: DFL "Placar e relógio: identificação do jogador com cartão amarelo/vermelho", **6 s** (0.1); wTVision: gráfico
  de evento é breve e só confirma quem fez; o placar pode carregar o vermelho o jogo todo.
- Planos: depois do lance a TV corta para closes de jogadores e do árbitro (reação) e só então entra o replay (patente
  US7657836, Sharp: "a região entre o ao vivo e o replay costuma ter closes de jogadores, árbitros ...";
  https://patents.google.com/patent/US7657836B2/en); o replay da falta é "bem mais curto que o do gol"; cartões amarelo e
  vermelho estão na lista de eventos "emocionantes".

### Jogos
- **FC 24:** câmera do PONTO DE VISTA do árbitro, cena "por chance" depois de amarelo ou falta (resumo da busca); GamingBolt:
  na hora do cartão, da expulsão ou da falta sendo armada (https://gamingbolt.com/ea-sports-fc-24-deep-dive-trailer-details-improvements-to-the-matchday-experience).
  FC 24 TU6 corrigiu "no vermelho às vezes aparecia a cena do amarelo" (https://www.gonintendo.com/contents/29585-ea-sports-fc-24-holiday-update-title-update-6-now-available).
- **FC 25:** câmera em 1ª pessoa do árbitro e do jogador "usada mais nos replays e paradas" (https://blog.playstation.com/?p=395588).
- **FC 26:** as cenas em 1ª pessoa podem ser desligadas ("POV Camera Scenes", Configurações → Visual → Acessibilidade); a
  queixa: "tiram você do jogo, quebram a concentração e gastam segundos" (https://www.magicgameworld.com/?p=128860).

### Tradução para o golaco (proposta)
Hoje: ícone de cartão sem texto em cima do jogador (`#cartao-icone`). Proposta ~4–6 s (amarelo) e ~8–10 s (vermelho), pulável,
com o mundo parado no tick da sanção (a Lei 12 já manda o jogo esperar — hash igual):
1. Árbitro caminha/corre até o infrator, braço estendido afastando os outros, ergue o cartão acima da cabeça apontando
   para ele (IK do braço, como os gestos da comemoração); 2º amarelo = amarelo e depois vermelho. Atenção: hoje NÃO há
   árbitro em campo durante o jogo (só no pré-jogo, `cortejo.js idArbitro` 200, e o quarto árbitro 203 na substituição) —
   a cena tem de trazê-lo para o mundo dela (como o quarto árbitro), com a malha `arbitro` de `render/jogador3d.js`.
2. Close do jogador reagindo (mãos na cabeça, braços abertos reclamando) e do capitão se aproximando — só ele perto do
   árbitro ("só o capitão").
3. Tarja de identificação (número + nome + o cartão), **6 s**, como a DFL — é gráfico de transmissão, não narração.
4. Vermelho: o expulso caminha para fora pelo ponto mais perto até o túnel (a mesma locomoção da `substituicao.js`), 1º
   plano 4–5 s e depois a cena corta (a simulação já o tirou de `m.jogadores`).
5. Variação por hash do lance (como a comemoração) e opção de desligar ("Cenas da partida"), porque os jogos mostram que a
   repetição cansa.

## 4. Replays nas paradas

### TV
- **Quando:** "no próximo intervalo do jogo", na bola parada (https://en.wikipedia.org/wiki/Instant_replay); o replay "surge
  no tempo morto do futebol" (Mediação/FUMEC, resumo da busca: https://revista.fumec.br/index.php/mediacao/article/download/2160/pdf_5).
- **Quanto:** 66 planos de replay por jogo, 6,8 s cada, 1–3 ângulos por lance, 10,9% dos planos (SoccerNet, 0.2).
- **Quanto é demais:** LaLiga (Sergio Carranza, chefe de realização, COPE 20/10/2026): "o que temos de priorizar é
  respeitar o ao vivo"; "tentamos dar o mínimo de repetições"; **"se dá para resolver em dois ângulos, melhor que em três"**;
  26 câmeras, ~15 em planos fechados (até 40 num clássico) (https://www.muchodeporte.com/sevilla-fc/el-jefe-de-realizacion-de-laliga-aumenta-la-indignacion-se-decidio-no-dar-esa-repeticion/ ;
  https://www.cope.es/programas/el-partidazo-de-cope/audios/liga-defiende-realizacion-polemica-madrid-sevilla-no-hay-intentemos-ocultar-mundo-deja-bufanda-afuera-trabajar-20261020_3458617.html).
  ESPN/Footyology (AFL): o "3º ou 4º replay de outro ângulo" faz perder o reinício; regra proposta: plano aberto no jogo,
  close só numa pausa longa o bastante (https://footyology.com.au/footys-tv-directors-must-listen-to-the-viewers/).
  Caso Díaz (Tottenham × Liverpool, 2023): "um replay rapidíssimo e o jogo já tinha andado" — a polêmica ficou sem
  explicação na TV (https://www.empireofthekop.com/2023/10/03/ben-foster-liverpool-var-diaz/).
- **Ordem:** ao vivo → closes de reação → replay mais fechado e mais lento (patente US7657836); a vinheta/cortina marca a
  entrada e a saída do replay (Barnfield 2013, "Soccer, Broadcasting, and Narrative", resumo da busca; SoccerNet: 14% com
  logo).
- **Voltar sem perder o reinício:** a janela é a parada (0.3: lateral 15–18 s, tiro de meta 28–30 s, falta/escanteio ~30 s,
  substituição 65–74 s, pênalti ~2 min, comemoração 72 s, VAR 73 s). Guia de produção: perto do reinício, janela
  picture-in-picture em vez de replay em tela cheia (resumo da busca, https://www.switcherstudio.com/blog/instant-replay);
  FIBA 3x3: nas interrupções, cobertura contínua da arena OU replays/melhores momentos curtos (resumo da busca).
- **Jogos:** FC 24 previa estatísticas sobrepostas durante as paradas (fifplay); FC 25/26 usam a 1ª pessoa do árbitro/jogador
  nos replays de parada, com opção de desligar.

### O que a TV repete — medido nos rótulos do SoccerNet-v2 (27–28/10)
O artigo (0.2) não traz a chance de replay por tipo de lance; os rótulos públicos trazem. Base: o repositório
`SoccerNet/SN-Labels` no Hugging Face (https://huggingface.co/datasets/SoccerNet/SN-Labels; 500 jogos de 2014–2017 das 5
grandes ligas e da Champions). Arquivos: `Labels-v2.json` (as 17 ações) e `Labels-cameras.json` (cada plano, com `replay`
e, no replay, o `link` para a ação mostrada). São 498 jogos com os dois arquivos. As classes estão definidas no material
suplementar do artigo (§7.1). "Shots on/off target" = chute com intenção de gol, na direção da meta ou fora dela. "Direct
free-kick" = tiro livre "with the intention to score or if the other team forms a wall". "Clearance" = tiro de meta.
- **Chance de replay por situação** (o replay ligado ao chute de −2 a +12 s; à falta de −2 a +3 s):

  | situação | n | com replay |
  |---|---|---|
  | chute no alvo que vira escanteio (espalmada, desvio) | 836 | 82% (687) |
  | chute fora do alvo que vira escanteio (desvio, bloqueio) | 454 | 66% (298) |
  | chute fora do alvo que vira tiro de meta | 3.560 | 72% (2551) |
  | chute no alvo e o jogo segue (o goleiro segura) | 2.743 | 55% |
  | chute de falta (após um "Direct free-kick") que vira escanteio | 40 | 68% (27) |
  | falta com cartão | 1.889 | 88% |
  | falta sem cartão, pênalti nem tiro livre direto | 9.056 | 47% |
  | escanteio sem chute nos 15 s antes | 4.717 | 13% |
  | lateral | 18.863 | 3% |

- **Pelo atraso:** do chute até a bola morrer em ≤ 2 s, 73% de replay (n 4.841). Em 2–4 s, 65% (695). Em 4–8 s, 51% (456).
  Em 8–15 s, 47% (453).
- **Replay DURANTE a parada** (um plano de replay entre o lance que parou a bola e o recomeço; sem gol nem impedimento):
  30,6% das 42.259 paradas. Por recomeço: lateral 6,7%, tiro livre indireto 43,9%, escanteio 43,2%, tiro de meta 52,6%,
  tiro livre direto 74,3% (1609/2166; sem cartão 67,4%, 1087/1613; com cartão 96,5%), pênalti 97,5%. Escanteio com
  chute nos 15 s antes: 72,5% (sem: 30,7%). Tiro de meta com chute antes: 69,1% (sem: 36,9%). Lateral com chute antes:
  28,2%.
- **Por situação** (28/10; a régua do P3 do `teste-replay-paradas`, `TV_SIT`): o replay DURANTE a parada pelo recomeço e
  pelo que veio antes dele. CARTÃO = um cartão entre o apito e o recomeço; senão CHUTE = um "Shots on/off target" nos 15 s
  antes do apito; senão nada. Intervalo de Wilson 95% entre colchetes. O tiro livre de todas as causas (falta ou bola fora;
  o "após Foul" sozinho dá 96,5% / 67,4% no direto e 87,6% / 37,4% no indireto, com e sem cartão).

  | recomeço | cartão | chute nos 15 s (sem cartão) | nada |
  |---|---|---|---|
  | lateral | 29,8% (17/57) [19,5–42,7] | 28,1% (152/541) [24,5–32,0] | 6,0% (1093/18209) [5,7–6,4] |
  | escanteio | 47,8% (11/23) [29,2–67,0] | 72,5% (1040/1434) [70,2–74,8] | 30,6% (1020/3335) [29,0–32,2] |
  | tiro de meta | 69,1% (47/68) [57,4–78,8] | 69,0% (2583/3742) [67,5–70,5] | 36,5% (1428/3908) [35,0–38,1] |
  | tiro livre direto | 96,4% (504/523) [94,4–97,7] | 79,3% (23/29) [61,6–90,2] | 67,0% (1082/1614) [64,7–69,3] |
  | tiro livre indireto | 87,5% (951/1087) [85,4–89,3] | 60,4% (113/187) [53,3–67,2] | 37,1% (2722/7342) [36,0–38,2] |
  | pênalti | 97,5% (156/160) [93,7–99,0], todos | | |

  Por que por situação: no jogo quase todo escanteio e a maioria dos tiros de meta vêm de um chute (main, sementes 1–48:
  95 de 101 escanteios e 59 de 83 tiros de meta), e a taxa média por recomeço (43,2% e 52,6%) é a mistura das linhas. A
  conta por recomeço deixava a fidelidade 15–25 pontos otimista. Script: `tools/pesquisa/soccernet_situacao.py` (só a
  biblioteca padrão; a pasta com os rótulos do SoccerNet/SN-Labels).
- **Espaço entre replays:** a TV não espera. Contando do recomeço da última parada com replay, nas paradas que vêm
  depois de um cartão ou de um chute ela repete 65,6% a 0–15 s, 72,0% a 15–30 s e 72,5% a 30–60 s. Com todas as paradas:
  29,7%, 28,5% e 31,0%. Os 30 s do `REPLAY_PARADA.espaco` são uma escolha nossa (não repetir em seguida), não da TV.
- **Guia da UEFA** (European Qualifiers, Broadcast Partner Production Manual 2016-18, §3.6.2 "Replay guidelines", p. 30;
  28/10: antes citado como §3.6.1, que é "General principles and match director guidelines"): "Replays should
  only be inserted when relevant to current live action"; "Quality takes precedence over quantity"; "No replay should be
  inserted when the ball is in play" (https://www.crz.gov.sk//data/att/3082683_dokument1.pdf).
- **No golaco** (`js/lances.js`, 28/10; números em `PLANO-CENAS.md` §2.7 e no PR): entram as classes que a fonte sustenta
  (≥ 50%) e que o jogo tem. São o chute bloqueado que vira escanteio, o chute de dentro da área que sai em tiro de meta e
  a falta até a distância da barreira (o "Direct free-kick"). Ficam de fora o desvio que vira lateral (28% na parada), o
  escanteio e o tiro de meta sem chute (30,7% e 36,9% na parada) e o goleiro que segura (o replay da TV sai na parada
  seguinte, que aqui vem muito depois). A janela de 4 s fica: 4–8 s dá 51%, e a de 8 s acrescentou 1 replay em cada
  amostra de 24 partidas. (28/10) O chute fora fica só o de dentro da área: a fonte cobre todo chute fora do alvo, de
  qualquer distância, mas com o forte de fora (≥ 22 m/s, o critério da espalmada) o ar em replay passava de 16% (o
  orçamento do dono; teto 16,3% nas sementes 301–348). Decisão do dono: o piso de 2 replays por partida saiu; a régua é a
  fidelidade à TV POR SITUAÇÃO (a tabela acima) ≥ a da versão publicada na mesma amostra. Main de 28/10 57,6%, 61,3% e
  58,7% (sementes 1–48, 201–248 e 301–348); o goleiro realista com as classes novas 66,0%, 70,1% e 70,6%
  (`PLANO-CENAS.md` §2.7).

### Tradução para o golaco (proposta)
- **Diferença importante:** aqui a parada dura 2–4 s (`PARTIDA.foraEspera` 1,0 + `montagemPor` 0,3–1,5 + a IA cobra em
  0,6–1,4 s) e o tempo é ×11,25 (4 min reais por 45'). Não dá para "caber na parada": o replay de parada tem de SEGURAR o
  mundo no passo da bola morta, como o replay do gol já faz (hash-igual/hash-partida IGUAIS), e soltar no mesmo tick.
- **Gatilhos (só na bola parada, um por parada, o mais forte):** falta com cartão ou pênalti; chance clara perdida
  (finalização de dentro da área/xG alto, bola na trave); defesa difícil do goleiro (espalmada para escanteio); dividida
  forte/falta perto da área; impedimento (já existe). Nada de replay em lateral sem lance.
- **Orçamento:** 1–2 ângulos (LaLiga), 4–7 s por ângulo (SoccerNet 6,8 s), ≤ 12 s no total; teto de ~6–8 por partida de
  8 min (a TV faz ~25–35 lances repetidos em 90 min); nunca dois seguidos sem jogo no meio; qualquer toque pula (como hoje);
  "Replays automáticos" na pausa vale também para estes.
- **Lances:** o anel de 10 s basta para um lance que acabou de acontecer (falta → apito); para os melhores momentos do
  intervalo/fim, guardar só os lances marcados (cópia de trechos do anel, ~3,4 MB por 10 s — limitar a uns 6–8 lances ou
  guardar a semente + entradas e redesenhar).
- **Online:** a cena segura só o MEU lado (como replay/comemoração hoje); no 1×1 pode ficar desligada por padrão.

## 5. O que o golaco já tem (para reaproveitar)
Faixa "Intervalo" de 3 s + plano geral no intervalo e no fim; ícone do cartão sem texto; replay com anel de 10 s, diretor e
câmeras (gol, impedimento, pausa); `comemoracao.js` (cópia dos 22, locomoção, gestos por IK, abraços, cabisbaixos);
`substituicao.js` (sai pelo ponto mais perto, quarto árbitro, faixa ENTRA/SAI ≥ 4 s, fila `filaCenas`); `tecnicos.js`
(reagem; gancho `treinadorDoTime`); `cortejo.js` (túnel, fila); `sumula.js` (gols, cartões, chutes, no alvo, posse, nota);
torcida com ânimo/vaia/festa; `hud.terco` (o selo do replay, única exceção de texto). Falta: o árbitro em campo durante o
jogo (só existe no pré-jogo e, como quarto árbitro, na substituição) e um guarda-lances além dos 10 s do anel.

## 6. Lacunas honestas
- Não há roteiro público da Globo/Premiere nem da TNT/CBS (Champions) — a régua de tempos é a da DFL (sinal internacional).
- Não achei regra escrita de diretor ("nunca perca o reinício"); o que existe é prática (LaLiga, Wikipedia, críticas da AFL).
- eFootball/PES: sem documentação oficial das cenas de cartão/fim; as cenas de pós-jogo do FC 24–26 só aparecem em
  prévias e resumos (vários sites bloqueados com 403).
- Média de duração de replay POR TIPO de lance (falta × gol × chance) não aparece no SoccerNet; só a média geral (6,8 s).
