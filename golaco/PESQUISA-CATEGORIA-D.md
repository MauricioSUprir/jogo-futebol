# Pesquisa da categoria D — a IA correr para marcar e para atacar (24/10)

Pedido do dono (24/10, ao escolher a categoria D): "adiciona nessa D a IA correr, tanto pra marcar, tanto pra atacar, pq
ela não corre". Itens da `FILA.md`: 17–25 e 67. Plano em 8 PRs (D1–D8); este documento junta a pesquisa, a medição
contra o jogo real e o que cada PR aproveitou. O D1 (o botão PRESSÃO) está no `CONTRATOS.md`; o D2 (a IA ataca
correndo, itens 67 e 21) está na seção 5 e o D3 (a IA marca correndo, itens 67, 19 e 20) na seção 6.

## 1. Resumo

**Em volume, a IA já corre mais que um time real.** Contra o humano roteirizado, por jogador de linha e com a bola
rolando, ela faz 188 m/min contra 140 do rastreamento real (Metrica), 85 contra 12,6 m/min em alta intensidade
(> 19,8 km/h), 1,39 contra 0,14 disparada por minuto, e reage à perda em 0,9 s contra 4–5 s. O `teste-intensidade`
(grupo etapa3) já mede 267 m/min nos lances rápidos, acima do teto de 180–220.

**O "não corre" que o dono vê vem de QUEM corre e QUANDO:**
- o condutor da IA quase para com a bola: 7,6 km/h de mediana (real 10,0), anda 47% do tempo (real 34%) e fica com a
  bola 0,48 s; em 79% do tempo com a bola no pé ele já está carregando um passe;
- o apoio a até 10 m da bola anda 51% do tempo (real 41%): é a única alta intensidade abaixo do real (23 contra 31 m/min);
- as corridas à frente da bola quase não chegam à área: 3% contra 31%;
- na defesa, do 2º ao 5º homem trotam (o teto de trote do ponto calmo vale até 12 m), e a recomposição freia até parar
  antes de virar 180°;
- o vai e volta é 19 vezes o real (5,8 contra 0,30 por jogador-minuto): arranca, freia e inverte, e isso lê como hesitação;
- os companheiros da pessoa ficam a 7,7 m do condutor da IA (a IA fica a 2,1 m do condutor humano);
- o jogador da própria pessoa dispara o dobro de qualquer um da IA, e é com ele que o dono compara.

**Princípio do plano: redistribuir, não somar.** A corrida vai para quem tem a bola, para perto dela (a tela do celular
deitado mostra ~39,6 m de largura) e para a área; quem está longe da jogada corre menos. Todo PR leva teto de volume
(`teste-ia-corre` seção V) e nada mexe na física (`JOGADOR.*`, que já bate com o real) nem na condução que o dono aprovou.

## 2. Como medi

- **A régua** é `tools/lib/corrida-medidas.mjs` (as mesmas funções para o GOLAÇO e para o rastreamento real) e o
  `tools/teste-ia-corre.mjs` (no CI: 3 roteiros × 4 sementes; para decidir: 8 sementes por roteiro).
  - Partidas de 2 × 4 min com a física em tempo real, contra o humano de `tools/lib/humano-roteiro.mjs` (agressivo, calmo,
    passivo; o "conduz" fica para o informativo, porque só corre para o gol).
  - Faixas reais de velocidade: andar < 7 · trote 7–14 · corrida 14–19,8 · alta 19,8–25,2 · disparada > 25,2 km/h.
  - Fases do time: "sem" e "com" a bola, e "perda"/"ganho" (os 5 s depois de uma troca de posse que dura ≥ 0,5 s).
  - Disparada = > 25,2 km/h por ≥ 1 s; corrida à frente da bola = ≥ 19,8 km/h para a frente por ≥ 1 s, chegando à área até
    1 s depois do fim; vai e volta = a direção inverte (> 135°) em 0,25–1 s, com ≥ 1,5 m/s nos dois instantes.
  - Posse do condutor = do domínio até a bola sair do pé ou trocar de dono; trocas de condutor por minuto de posse do time.
- **Jogo real:** o rastreamento aberto da Metrica (Sample Game 1 e 2, 25 Hz, liga não identificada; 2231 jogador-min com a
  bola rolando), com a suavização e a posse do `tools/pesquisa/analise_metrica.py`. As faixas batem com as do
  `PESQUISA-ETAPA3.md` §6 para o mesmo rastreamento (48,6 / 37,4 / 10,7 / 2,7 / 0,6%).
- **Fontes** de memória estão marcadas como tal.

## 3. A IA contra o real (main antes da categoria D)

| Medida (por jogador de linha, bola rolando) | IA adversária × humano | Companheiros do humano | IA × IA (demo) | Real (Metrica) |
|---|---|---|---|---|
| m/min | **188** | 173 | 166 | 140 |
| % do tempo andar / trote / corrida / alta / disparada | 40,7 / 25,0 / 12,8 / **15,3 / 6,3** | 40,5 / 33,3 / 10,8 / 9,9 / 5,4 | 44,5 / 31,5 / 9,3 / 9,4 / 5,3 | 48,6 / 37,4 / 10,7 / 2,7 / 0,6 |
| Alta + disparada, m/min | **85,5** | 62,3 | 59,5 | 12,6 |
| Disparadas por minuto | **1,39** | 1,24 | 1,10 | 0,14 |
| Duração da disparada / pico ÷ máxima | 1,5 s / 96% | 1,7 s / 97% | 1,6 s / 97% | 2,0 s / 81% |
| Perda: 1º, 2º e 3º mais perto a ≥ 14,4 km/h úteis em | **0,9 / 0,9 / 1,2 s** | 1,1 / 1,3 / 1,7 s | 0,8 / 0,9 / 1,4 s | 4,4 / 5,0 / 5,0 s |
| Corridas à frente da bola por min de posse · % que chegam à área | 18,0 · **3%** | 12,4 · 2% | 15,4 · 4% | 1,64 · **31%** |
| 1º homem sobre o condutor: mediana · ≤ 2 m · ≤ 5 m | 2,1 m · 48% · 82% | **7,7 m · 8% · 29%** | 3,8 m · 24% · 63% | 5,2 m · 13% · 48% |
| Aproximação do 1º homem a 2–4 / 4–7 / 7–12 m (km/h) | **2,2 / 1,6 / 1,7** | 10,5 / 14,7 / 11,1 | 8,5 / 14,4 / 8,1 | 4,8 / 7,4 / 7,5 |
| Condutor: mediana · % andando · % ≥ 19,8 km/h | **7,6 km/h · 47% · 3,2%** | — | 9,1 · 41% · 5,2% | 10,0 · 34% · 8,7% |
| Trocas de condutor por min de posse | **37** | — | 34 | 19 |
| Vai e volta por jogador-min | **5,8** | 5,8 | 5,5 | 0,30 |

Por fase e distância à bola, com a IA atacando: a ≤ 10 m 138 m/min, 51% andando, 23 m/min de alta (real 161 · 41% · 31);
a > 25 m 180 m/min, 46% andando, 79 m/min de alta (real 118 · 60% · 5). Ou seja: perto da bola a IA anda, longe dela corre.

Limites: contra o roteiro a IA defende só ~11% do tempo (ele perde a bola rápido); a Metrica são 2 jogos de nível
desconhecido e a suavização a 25 Hz corta disparadas (para disparadas, Barnes 2014 é a referência melhor).

## 4. O que a literatura e os jogos dizem

### 4.1 Dados físicos reais

- **Por fase de jogo** — Jerome et al. 2024, *Eur J Sport Sci* 24(11), 1083 partidas, Stats Perform
  (https://pmc.ncbi.nlm.nih.gov/articles/PMC11534638/), por jogador de linha (alta 5,48–7,0 m/s; disparada > 7,0 m/s):

  | Fase (com / sem a bola) | % da bola rolando | m/min | Alta m/min | Disparada m/min |
  |---|---|---|---|---|
  | Construção / bloco alto | 18,2 | 128 ± 8 / 141 ± 10 | 5,2 / 8,5 | 0,9 / 1,5 |
  | Progressão / bloco médio | 12,0 | 142 ± 10 / 153 ± 12 | 11 / 13 | 3,2 / 2,8 |
  | Criação / bloco baixo | 7,1 | 132 ± 9 / 139 ± 10 | 12 / 12,1 | 3,8 / 2,9 |
  | Ataque rápido / defesa rápida | 3,8 | 196 ± 15 / 208 ± 17 | 31 ± 7,6 / 41,1 ± 11,5 | 16 ± 7,1 / 14,6 ± 7,4 |
  | Transição ofensiva / defensiva (≤ 6 s) | 8,9 | 145 ± 8 / 156 ± 9 | 12 / 14,9 | 3,2 / 3,6 |

  p90 estimado (média + 1,28 dp, supondo normal): ~215 m/min no ataque rápido, ~230 na defesa rápida (para o item 25).
- **Com e sem a bola** — Castellano et al. 2022, LaLiga (https://pmc.ncbi.nlm.nih.gov/articles/PMC9331352/): sem a bola se
  corre 9% mais no total e 19% mais acima de 21 km/h (~143 × ~157 m/min por jogador, dividindo o time por 10).
- **Copa de 2022** (Bradley, FIFA Training Centre: https://www.fifatrainingcentre.com/en/fwc2022/physical-analysis/what-distances-did-teams-cover.php
  e …/viewing-match-physical-performances-through-a-tactical-lens--why-do-teams-run.php): zagueiros e volantes fazem 70–85%
  da alta intensidade sem a bola, atacantes 60–70% com ela; alta sem a bola × recuperações r ≈ 0,6, com a bola × entradas no
  terço final r ≈ 0,8.
- **Premier League por faixa da tabela** — Ju et al. 2023 (https://pmc.ncbi.nlm.nih.gov/articles/PMC10108770; papéis
  táticos: https://researchonline.ljmu.ac.uk/id/eprint/17199/): os de cima correm 34–35% mais COM a bola (movimento para
  receber, condução, corrida nas costas, entrada na área); cada ação de alta dura ~2–3 s e cobre ~20–25 m; o centroavante faz
  9–10 corridas nas costas por jogo.
- **Para que se dispara** — LaLiga 2 2020/21, 1848 disparadas, *PLoS One* 2024 (https://pmc.ncbi.nlm.nih.gov/articles/PMC11164352/):
  recomposição 24,7%, pressão 13,9%, fechar/interceptar 13,3%, perseguir 12,4%, corrida nas costas 10,9%, corrida coletiva
  8,7%, entrada na área 7,6%, condução 6,5%. Por posição: zagueiro 42,5% recomposição; volante e meia 29,7% recomposição;
  **atacante 26,7% pressão, 24,5% corrida nas costas e 17,9% entrada na área**.
- **Média e pico com a bola rolando** — Mernagh et al. 2021 (Championship, STATSports): 128 ± 15 m/min
  (https://statsports.com/article/ball-in-play-collection-made-easy-with-sonra-live); pico de 1 min no Brasileirão 2019:
  182 ± 21 m/min (https://pmc.ncbi.nlm.nih.gov/articles/PMC9523008).
- **Barnes et al. 2014**, Premier League 2012/13 (https://sure.sunderland.ac.uk/4904): 57 disparadas por jogo (~1 por minuto
  de bola rolando, contando ações curtas).
- **Acelerações** > 3 m/s²: 0,8–1,0 por minuto (Premier League × Ligue 1, https://pmc.ncbi.nlm.nih.gov/articles/PMC11694201/).
- **Pressão:** PPDA média das 5 grandes ligas 11,0 (Wyscout 2018/19); o time mais intenso 8,6–9,9 (Liverpool 2021/22,
  https://learning.coachesvoice.com/?p=61775; Bournemouth 2024/25, Opta). Agressão StatsBomb 19–29% (Leeds de Bielsa 29–30%,
  https://blogarchive.statsbomb.com/articles/soccer/leeds-united-under-marcelo-bielsa-an-analytical-review/). Contrapressão:
  pressão em ≤ 5 s em 47% das posses nas zonas dela (https://blogarchive.statsbomb.com/articles/soccer/how-statsbomb-data-helps-measure-counter-pressing/).
- **Tempo de chegada:** controle de campo de Spearman/Shaw — reação 0,7 s, vmax 5 m/s, σ 0,45 s
  (https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking); Bekkers 2025 — pressão como probabilidade logística
  do tempo de chegada, defensor abaixo de 2 m/s não conta (https://arxiv.org/html/2501.04712v1).

### 4.2 Como os jogos fazem a IA ser e parecer intensa

- **FIFA 22, Tactical AI** (https://www.ea.com/ea-play/news/pitch-notes-fifa-22-gameplay-deep-dive): os atacantes "can make
  up to 6 times more decisions per second" (as corridas são reavaliadas mais vezes); "runs for long balls played into space
  behind the opposing back line"; a defesa "operate more as a unit"; o **Explosive Sprint** "only happens for a short duration
  when activated, then tapers off".
- **Pressão do time e fôlego:** Team Press de 30 → 20 s no FIFA 21 (https://www.pcgamesn.com/fifa-21/team-press); de 20 → 45 s
  com até 2,6× mais desgaste no FC 25 TU14 (https://sportskeeda.com/esports/all-ea-fc-25-title-update-14-patch-notes).
- **FC 27** (https://www.ea.com/games/ea-sports-fc/fc-27/news/fc-27-closed-beta-feedback-update e …/pitch-notes-fc27-gameplay-deep-dive):
  "Role Familiarity then influences the urgency with which a player makes those available runs"; no Competitivo, a IA dos
  companheiros do jogador "support the play instead of winning possession outright"; corridas curvas "smarter, more
  contextual".
- **FC 26, Title Update 1.4** (https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-title-update-1-4-0): no Squad
  Battles a CPU estava "overly passive", com "long periods of low-pressure possession", e ficou "more proactive and attacking".
  Atualização de outubro (…/pitch-notes-fc26-feedback-update-october): domínios lentos freavam o condutor, "making the
  defender chasing them feel overly quick".
- **Dificuldade = reação + decisão + marcação**, não física: a tabela do FC 25 (FIFPlay, não oficial,
  https://www.fifplay.com/fc-25-difficulty-levels/) e o Google Research Football (θ acelera ou freia "the bot reaction time
  and decision making", https://arxiv.org/pdf/1907.11180). Relato de usuário do FC 26: no Lendário a IA "reage antes do
  comando" — o limite do que ainda parece justo.
- **Técnicas:** utilidade com curvas de resposta (Mark & Dill, GDC 2010, https://gdcvault.com/play/1012410/Improving-AI-Decision-Modeling-Through);
  Steel Circus (pontos sorteados pontuados por mapas de influência, https://philippseifried.com/blog/2019/12/ai-in-steel-circus-part-1/);
  ghosting (Le, Carr, Yue, Lucey 2017, https://authors.library.caltech.edu/75181/).

### 4.3 O que faz um jogador parecer lento ou "NPC"

- **Cadência** (https://pmc.ncbi.nlm.nih.gov/articles/PMC12047830/): o arranque é passo curto e rápido (4,58 passos/s, 1,21 m);
  o `PASSADA.tabela` do GOLAÇO já segue isso.
- **Inclinação** α = atan(a/g) (di Prampero et al. 2005, https://cob.silverchair.com/jeb/article/208/14/2809/15645/Sprint-running-a-new-energetic-approach);
  o `anim.js` usa 0,8 × atan2(a, g) — só aparece quando a IA de fato acelera.
- **Resposta × fluidez:** Clavet, GDC 2016 (https://gdcvault.com/play/1023280/Motion-Matching-and-The-Road) e Avalanche, GDC 2015
  (https://gdcvault.com/play/1021981/Finding-Balance-Realizing-Responsive-High-Quality-Character-Animation).

**Conclusão para o jogo:** a física do GOLAÇO já bate com o real (aceleração 8,5 m/s², cadência de Dorn 2012 e Takai 2025,
inclinação); o "não corre" vem das decisões.

## 5. D2 — a IA ataca correndo (itens 67-ataque e 21)

### 5.1 O que entrou (só contra a pessoa: `tatica.js contraPessoa`; constantes em `config.js IA_PESSOA`)

| Peça | O que muda | Fonte / por quê |
|---|---|---|
| Condutor (`decidir`) | a condução vale onde ele CHEGA (`conduzDist` = clamp(livre − 2, 5, 10) com ≥ 7 m livres); `conduz` 0,85 → 1,0; `conduzSolta` [1,5, 4] → [2,5, 5] s | o passe ganhava 79% do tempo porque a condução era avaliada a 5 m; FC 26 TU 1.4: CPU "overly passive" → "more proactive and attacking" |
| Condutor (risco) | a chance de manter a bola lê cada adversário onde ele estará em 0,12 s (`manterAntecipa`; a IA × IA segue no agora) | revisão do D2: com a condução valendo mais e o risco só no agora, o condutor conduzia para dentro de quem fechava correndo — roubadas no pé 2,42 → 3,02 por min (+25%); com 0,12 s, 2,33 |
| Condutor (ritmo) | `magConduz` 0,9 → 0,6 (~3,3 m/s, trotando com a bola) e CORRER só com ≥ 14 m livres (`correrAte` 25 → 35) | com 0,9 o condutor ia a 16,5 km/h de mediana (real 10,0) e 33% do tempo acima de 19,8 km/h (real 8,7%) |
| Apoio curto | modo novo `IA.modos.apoia` (corrida firme a partir de ~6 m do ponto, CORRER além de 10 m) com o ponto a > 4 m e o condutor conduzindo (≥ 3 m/s) | com o condutor conduzindo, o apoio a ≤ 10 m andava 43% (real 33%; sem o condutor na conta — o "51%" do plano contava o próprio condutor); "available runs" com urgência pela função (FC 27) |
| Apoio pela referência | a espera antes de voltar vale até 12 m (`volta` [8 → 12, 1 s]); LONGE da bola (> 25 m) parado até o alvo passar de 7 m e na marcha lenta até 10 m | o apoioRef era metade do vai e volta (2,95 de 5,99); longe da bola a IA fazia 180 m/min (real 118, 60% andando) |
| Subida com o ataque (#500) | só para quem está a ≤ 20 m da bola (`sobeMax`) | a faixa da tela do celular; longe da bola ela era ~22 m/min do volume atacando |
| Corridas nas costas | só de quem joga na FRENTE (vaga sem a bola à frente do meio-campo: os centroavantes), só com a linha deles nos últimos 45 m, destino DENTRO da área (marca do pênalti → pequena área, lado oposto à bola), espera o passe 3,5 s (era 2) e 2,5 s além da linha (era 1,5); `recarga` e `max` iguais | à área 3% (real 31%); PLoS One 2024: corrida nas costas e entrada na área são 24,5% e 17,9% das disparadas dos atacantes, a recomposição é dos meias (29,7%); Ju 2023: 9–10 corridas nas costas do centroavante por jogo |
| Ataque à área | corre com o ponto a > 3 m (era 6) | quem chega atrasado não cabeceia |
| Virada do condutor | já conduzindo a > 2 m/s, a direção nova fica a ≤ 0,6 rad do movimento; sem a condução curta (MOD) contra a pessoa | `teste-nao-passa`: virando 50–60° de uma vez a 3–4 m/s (o `anguloEmbalado` deixa ~110°) e com a proteção girando o corpo em volta da bola ainda a ~3 m/s, a bola ficava atrás do corpo — os casos dos condutores da IA 11 → 2 em 28 partidas; a condução (`conducao.js`) não muda |

### 5.2 A triagem (o que foi medido e não entrou)

Triagem com `--set` no `teste-ia-corre` (4 sementes × 3 roteiros; as decisões com 8):
- **`conduz` 1,0 com `magConduz` 0,9 e CORRER com 7 m** (o plano): o condutor a 16,6 km/h, V1 212 e V2 211 m/min, 3,1 gols
  da IA por partida. A resposta do `conduz` é em degrau: 0,85 → 9,0 km/h; 0,9 → 10,7 km/h com a posse mediana ainda em
  0,50 s; 0,95 → 0,60 s; 1,0 → 1,1 s. Por isso o peso 1,0 e o ritmo pelo `magConduz`.
- **"parado só a 1 m e sem a marcha" no apoio pela referência** (o plano): A6/A7 iguais (33,4% × 33,4%; 70,8 × 69,2 m/min) e
  +0,14 no vai e volta. Saiu; entrou a `volta` de 12 m (−0,5 no vai e volta).
- **Destino na área só nos últimos 35 m** (o plano): 13–14% chegando à área; com 45 m, 20–24%.
- **`espera` 2,5 s:** 8,5% chegando à área; 3,0 s: 13,7%; 3,5 s: 20%.
- **Disparada da retomada só perto da bola** (`transOf` com 20–25 m de longe): −0,5 a −2 m/min, dentro do ruído. Saiu.
- **"Passou da bola" (`teste-nao-passa`, 42 partidas):** o condutor trotando (`magConduz` 0,6) dava 0,60 por partida (meta
  ≤ 0,5; a base 0,31): 0,75 → 0,52; 0,9 → 0,38 (mas o condutor a 16 km/h). A sonda (`medir-passa.mjs` com `sonda`) mostrou os
  dois mecanismos: a proteção do MOD com o adversário a < 2,5 m girando o corpo a ~3 m/s, e as viradas de 50–60° da direção
  da condução. Só a curta desligada: 0,48; só a virada limitada: 0,40; as duas: 0,33. O "condutor cercado por dois solta a
  bola" (conduzir × 0,5 com 2 a ≤ 3 m) não entrou: não mexeu no teste da PRESSÃO (M2 56%, M8 3,1).
- **Antecipação do adversário no risco da condução** (revisão do D2; 8 sementes × 3 roteiros, roubadas sofridas pela IA por
  minuto de bola no pé, base 2,42): 0 s (o D2 antes da revisão) 3,02, posse 0,90 s; 0,1 s 2,09, 0,90 s; 0,12 s 2,33, 0,83 s; 0,15 s 2,22,
  0,85 s; 0,25 s 2,19, 0,80 s; 0,4 s 1,50, mas 0,72 s e 28,6 trocas por minuto (reprovam A4 e A5). Entrou 0,12 s: com 0,1 s os pênaltis da IA no condutor da
  pessoa no 'dribla' do `teste-faltas-sentido` (36 partidas) iam a 0,64 por partida (B3: ≤ 0,6; main 0,39; 0,12 s 0,50; 0,15 s
  0,39; 0,25 s 0,53; sem a antecipação 0,22) e as sementes do CI reprovavam (3 vermelhos em 4 partidas); com 0,15 e 0,2 s o
  `teste-nao-passa` das sementes do CI reprovava por 2 casos "perdeu a bola" do time da PESSOA (o controlado invertendo o
  analógico, um companheiro com o domínio marcado), nenhum do condutor da IA: o sorteio caótico das sementes fixas. A
  antecipação parece somar ~0,1 pênalti por partida no 'dribla' (média de 0,1–0,25 s: 0,52; ruído de ±0,12 em 36 partidas).
- **O apoio perto sem o condutor** (revisão do D2): a ≤ 10 m da bola, sem o dono, andando — base 53,7%, D2 42,8% e D2 sem o
  apoio curto 45,4% (a medida com o condutor junto passava sem ele; esta também passa, meta ≤ 46). Com o condutor conduzindo
  (≥ 10,8 km/h): base 42,8%, D2 26,0%, D2 sem o apoio curto 37,1%, real 33,2% — é a medida que separa (A6b).
- **Corridas de meias e pontas até a área:** o MEIO da IA voltava a 5,4 m/s nos 3 s depois da perda (teste-transicao
  `--humano`, meta ≥ 5,5; base 6,1) — quem estava em disparada para a área quando a bola se perdia freava antes de voltar.
  Sprint na recomposição com a bola até 20 m além do meio (o `urgente` do D3) não resolveu (5,2 m/s). Só os da frente: 5,9.

### 5.3 Antes → depois (teste-ia-corre, 24 partidas: 3 roteiros × 8 sementes; ± = bootstrap estratificado por roteiro)

| Medida | Antes (main ebf0abc6) | Depois | Meta | Real |
|---|---|---|---|---|
| A1 condutor: mediana (km/h) | 7,63 ± 0,10 | 11,84 ± 0,03 | ≥ 9,5 | 10,0 |
| A2 condutor: tempo andando (%) | 46,7 ± 0,8 | 22,5 ± 0,4 | ≤ 38 | 34 |
| A3 condutor: tempo a ≥ 19,8 km/h (%) | 3,16 ± 0,33 | 9,5 ± 0,6 | ≥ 6 | 8,7 |
| A4 posse de cada condutor (mediana, s) | 0,50 ± 0,01 | 0,83 ± 0,02 | ≥ 0,8 | 1,04 |
| A5 trocas de condutor por min de posse | 37,8 ± 0,4 | 26,5 ± 0,3 | ≤ 28 | 18,7 |
| A6 apoio a ≤ 10 m da bola (sem o condutor): andando (%) | 53,7 ± 0,5 | 42,8 ± 0,6 | ≤ 46 | 43,3 |
| A6b ...com o condutor conduzindo (≥ 10,8 km/h): andando (%) | 42,8 | 26,0 ± 0,9 | ≤ 33 | 33,2 |
| A7 apoio a ≤ 10 m (sem o condutor): alta + disparada (m/min) | 22,5 ± 1,6 | 53,1 ± 2,2 | ≥ 30 | 29,7 |
| A7b ...com o condutor conduzindo: alta + disparada (m/min) | 80,6 | 109,0 ± 3,8 | — | 61,7 |
| A6c/A7c a ≤ 10 m COM o condutor (a conta do real): andando (%) · alta (m/min) | 52,3 · 20,5 | 37,5 · 49,3 | — | 41 · 31 |
| A8 corridas à frente da bola que chegam à área (%) | 3,7 ± 0,5 | 23,7 ± 1,0 | ≥ 15 | 31 |
| A9 corridas à frente da bola por min de posse | 17,4 ± 0,2 | 9,7 ± 0,2 | ≤ 18 (não sobe) | 1,6 |
| A10 item 21: chutes de dentro da área (%) | 60,4 ± 5,9 | 78,4 ± 3,8 | ≥ 70 | — |
| A11 item 21: conversão (%) | 21,8 ± 3,2 | 19,8 ± 2,9 | (8–15, pendente) | — |
| A12 chutes da IA por partida | 4,2 ± 0,4 | 6,8 ± 0,5 | — | — |
| V1 IA atacando (m/min) | 168,2 ± 1,1 | 156,0 ± 1,1 | ≤ 190 | — |
| V2 IA no total (m/min) | 181,9 ± 1,3 | 171,4 ± 1,3 | ≤ 195 | 140 |
| V3 vai e volta por jogador-min | 5,95 ± 0,08 | 4,74 ± 0,05 | ≤ 5,8 | 0,30 |
| V4 gols da IA contra o roteiro por partida | 0,92 ± 0,14 | 1,33 ± 0,22 | ≥ 0,92 (não caem) | — |
| V5 roubadas sofridas pela IA por min de bola no pé | 2,42 ± 0,22 | 2,33 ± 0,20 | ≤ 2,78 (base + 15%) | — |
| V6 chutes do roteiro por partida | 0,83 ± 0,15 | 0,79 ± 0,22 | — | — |

O A10: o "≥ 55%" do plano a main já cumpria (60,4% nas 8 sementes, 63,8% nas 9–12, 53,2% só nas 1–4 do CI); a meta é ≥ 70%,
a que separa a base do D2. O ± de antes (o desvio entre as partidas ÷ √n) media a dispersão das medianas de cada partida e
misturava os roteiros — 2 a 3 vezes maior no A4 e no V4. Os números "real" do A6, A6b, A7 e A7b saem da mesma conta no
rastreamento da Metrica (sem o dono da bola); o A4 real, a posse mediana de cada condutor, é 1,04 s.
Por distância à bola, a IA atacando: perto da bola a corrida subiu, longe dela desceu até o real, e o total caiu (a
redistribuição). Por roteiro (8 partidas cada), gols da IA por partida e chutes: agressivo 0,38 → 0,75 (3,1 → 4,4 chutes),
calmo 0,50 → 0,50 (2,4 → 4,4), passivo — que não defende — 1,88 → 2,75 (7,1 → 11,5). O roteiro: 0 → 0,17 gol e 0,83 → 0,79
chute por partida (o agressivo 1,4 → 2,1). No CI (3
roteiros × 4 sementes) passam todas as metas ligadas (A4 0,87 ± 0,02, A6b 27,5, V5 2,21 ± 0,20; a base reprova 14, as duas do portão entre elas).

### 5.4 Os testes protegidos

- `teste-nao-passa`: 0,31 → 0,60 por partida com o condutor trotando; com a virada limitada e sem a curta, 0,33 (meta ≤ 0,5);
  na versão final (antecipação de 0,12 s), 0,24. O controlado da pessoa passa da bola um pouco mais (3 → 6 casos em 28
  partidas): ele recebe mais bolas em movimento. Com a antecipação de 0,15 e 0,2 s o "perdeu a bola" (meta 0) dava 2 nas
  sementes do teste, sempre do time da pessoa (o controlado invertendo o analógico 116°, um companheiro com o domínio
  marcado a 3,9 m da bola): o sorteio das sementes fixas, nenhum do condutor da IA.
- `teste-pressao-humano`: com a IA ficando com a bola, os "casos longos" passaram de 197 para ~570, a maioria com o
  companheiro mais perto a 9–12 m (fora do alcance em 1,5 s: ~6,4 m do parado + 2 m). O M2 passou a contar os casos ao
  alcance (≤ 8,5 m): base 73,3% ± 4,1; o D2 final (antecipação de 0,12 s) 64,7% ± 3,8 nas sementes 7001–7032 e 73,5% ± 3,1
  nas 7101–7132 (meta ≥ 60%); o de todos os longos fica informativo (65 → 58%). O M8 (trombadas do chamado) 1,9 → 4,8 por
  100 casos: 30 das 37 eram com os PRÓPRIOS companheiros que continham o condutor; o desvio do chamado com 0,45 m de folga
  (era 0,25): 2,6 e 1,8. O M5 ficou em 80,7% e 81,2% (meta ≥ 80; base 87,4%). O M9 — o ganho da bola com o botão — subiu:
  +13,1 → +15,2 e +14,1 pontos.
- `teste-transicao --humano` (etapa3): passa (o meio volta a 6,1 m/s). `teste-defesa-corrida`, `teste-livre`, `teste-parado`,
  `teste-cavadinha`, `teste-defesa-humano`, `teste-ponte-tm`, `teste-faltas-sentido` (B2 0,08; B3 3,75 · 0,25 · 0,50),
  `teste-dois-humanos`, `teste-online` e `teste-math-proibido`: passam.
- Navegador: a página (`?demo=1`, `__golaco.rodarPassos(n, 'demo')`, `main.js entradaDoTime`) passa `iaCobra` em toda a
  entrada da demo e nunca `ia`. Na 1ª versão do D2 o portão só lia o `m.iaJoga` (só `ia`) e LIGAVA nela; com o
  `m.iaNaEntrada` (revisão do D2) a demo da página é IA × IA — também para a subida do #500, que na main ligava ali —, então
  os lances que os testes de navegador acham mudam em relação à main (o achador da parada: semente 4 amarelo → semente 2
  espalmada). Os achadores rodam na hora do teste; duas premissas de semente caíram e viraram condições do próprio lance:
  - `teste-replay-paradas-tela` V11: o lance era forçado num ponto fixo (±49, −24) na bola morta seguinte, qualquer uma; com
    a bola longe do ponto o olhar entre o lance e a bola o tirava do quadro por construção (1ª versão do D2: a bola a 39 m em
    x do ponto, |x| 1,36). Agora o lance fica onde a bola estava num tick de 0,5 a 3,5 s antes de uma bola morta, com a bola
    a |x| ≥ 45 (além do limX ±38,5 do foco da TV, o que o V11 confere; a chave é o último desses ticks). Com a chave fixa
    em inicio − 90 a semente 2 da demo IA × IA não tinha nenhuma bola morta assim em 30000 passos. D2 |x| 0,33 / |y| 0,38
    (escanteio), base 0,34 / 0,28 (meta 0,6 / 0,8).
  - `teste-cenas-tela` F7 (TM): a partida curta (`min=1`) da demo guardava 2 gols com o portão ligado na página e 0 com a
    demo IA × IA; a premissa "nenhum lance guardado" virou "o 2º botão = há lance guardado" (com a lista do guardador na
    saída).
  - `teste-replay-paradas-tela` V8b (online) reprovou uma vez com a máquina cheia (B 4 passos além de A + D + 2, com D 4) e
    passou nas rodadas seguintes: o online não passa pelo portão (dois humanos), é tempo.
  - `teste-replay-paradas-tela` (inteiro), `teste-cenas-tela` (inteiro), `teste-replay`, `teste-comemoracao-tela` e
    `teste-carga` (folga 1295 KB, hash Node = Chromium): passam.

### 5.5 Limites e o que fica

- **Item 21, conversão:** 21,8% → 19,8% (o real é 8–15%): a IA chega mais e de mais perto, e quem defende contra ela é o
  roteiro com os companheiros da pessoa a 6–8 m do condutor. Os companheiros apertarem é o D4 (item 17); o goleiro e o
  chute, a categoria C.
- **O roteiro passivo não defende:** é o que leva a média de gols da IA a 1,33; contra o agressivo 0,75 e o calmo 0,50 (base
  0,38 e 0,50).
- **Os chutes da pessoa** (V6, informativo) variam muito entre sementes e versões: 0,83 → 1,46 por partida com a antecipação
  de 0,1 s, 0,63 com 0,15 s e 0,79 com 0,12 s (o agressivo 1,4 → 2,1); no lote 21–28 do revisor quase não mudou. As roubadas no pé, a parte
  medida do "correr no condutor e dar a DIVIDIDA", ficaram abaixo da base (V5).
- **O condutor anda 23% do tempo** (real 34%): só anda no domínio e na condução curta; está dentro da meta, mas abaixo do real.
- **Corridas à frente da bola** seguem 6× o real por minuto de posse (10,1 contra 1,6): o resto é a subida com o ataque.

## 6. D3 — a IA marca correndo (itens 67-defesa, 19 e 20)

Dono, 17/10: "A IA NÃO CORRE, NEM PRA DEFENDER, NEM PRA ATACAR, tem que ser mais difícil"; 11/10: "tem que marcar com
responsabilidade e consciência". A medição (seção 3 e o mapa das travas) dizia: o 1º homem já fica a ~2 m do condutor da
pessoa (o real é 5,2 m — ele NÃO aperta mais); quem não corre são os de trás dele, pelo teto de trote do ponto calmo, e o
volume da transição já está no teto (229,7 m/min nos 5 s depois da perda; Jerome 2024: 156 ± 9 na transição defensiva e
208 ± 17 na defesa rápida, p90 ~230). O D3 REDISTRIBUI: a corrida vai para quem marca perto da bola e é paga longe dela.

### 6.1 O que entrou (só contra a pessoa; `config.js IA_PESSOA`, contrato "D3" no `CONTRATOS.md`)

| Peça | O que muda | Fonte / por quê |
|---|---|---|
| Quem marca perto da bola (`alvoCalmo`: zona, fechaLinha, linha, cobre) | a até 33 m da bola: sem o teto do trote, intensidade d / 7 (era d / 14: a 5 m do ponto ~4,2 m/s), sprint além de 9 m (era 12), sem o arranque calmo, a espera da volta [12 m, 1,3 s] (era [8, 1,0]) | o "longe e devagar" era 31% do tempo marcando (zona e linha, dois terços); a faixa da tela do celular deitado (39,6 m de largura no foco); a espera maior segurou o vai e volta (sem ela 5,07, com ela 4,75–4,85 por jogador-min) |
| Encurtar | quem guarda a zona do meio/frente a ≤ 12 m do condutor, com ele abaixo de 4 m/s e na janela de um gatilho de pressão (recepção, de costas, toque pesado, lateral, passe para trás, perda), vai 0,3 do caminho até 4 m dele, do lado do meu gol; a linha de defesa fica | o plano D3: "quando a pessoa recebe, o 2º e o 3º fecham correndo"; FC 27 Closed Beta (EA): os zagueiros "step towards their marked players" mas apertam menos; FM e FIFA 21: pressão no toque ruim e na recepção. Sempre ligado, os da zona subiam no condutor que arrancava (faltas da IA no humano 1,96 → 2,67) |
| Linha de engajamento | a Média sai do bloco com a bola a ≤ 67 m do meu gol (era 66) | PPDA contra o espelho na faixa dos que mais apertam (Liverpool 2021/22 8,6, Wyscout; Bournemouth 2024/25 9,9, Opta; média das 5 ligas 11,0): com 66, 11,4 e 8,9 nos dois conjuntos de sementes (o 1º acima do teto 10,5); 67, 9,4 e 8,5; 68, 9,7 e 8,0 (o 2º abaixo do piso 8); com 70, 7,6; com 78 (o plano), agressão 86% (o teto real nesta definição é 78%: Metrica 68 ± 10) |
| Recomposição: virada em ARCO | com o pedido a > 100° da velocidade e o corpo a > 3 m/s, o rumo a 0,95 rad da velocidade pelo lado do pedido (quase atrás: pelo lado do meu gol), com o CORRER | acima de 112° (`JOGADOR.angInversao`) o corpo freia na linha até PARAR e só então vira; na curva ele vira pela aceleração lateral do corte (`latCorte`) — a física é a mesma, `JOGADOR.*` intacto |
| Recomposição longe da bola | a mais de 16 m da bola, intensidade 0,75 (~4,5 m/s) e sem o sprint — menos o MEIO que ficou à frente da bola, que volta sempre a todo vapor | o que paga o volume de perto da bola (a perda, no teto); o meio poupado: com o "longe" valendo para ele o recuo do meio no `teste-transicao --humano` caía de 6,1 para 4,0–5,5 m/s (meta ≥ 5,5 — o lance de que o dono reclama) |
| O passe da IA contra a pessoa | no passe e na enfiada, o risco da linha também com cada adversário onde ele estará em 0,5 s (o maior dos dois) | o passe sai depois da carga do botão (0,3–0,7 s); a roubada desfeita era o passe decidido no tick da roubada e solto na corrida de volta da pessoa (abaixo, 6.2). Spearman 2018 (o controle do campo; o código do Friends of Tracking, Shaw 2020): cada jogador segue na velocidade dele durante o tempo de reação (0,7 s) antes de ir à bola |
| Item 19: o corredor | com o condutor rápido, o bloco do corredor sprinta com 4 m de atraso (era 8) | antes ele trotava até 8 m atrás do ponto. Medido e fora: quem o condutor rápido já passou recompor na hora em disparada (abaixo) |
| A régua | `copiaInstrumentada` (a distância e o rumo até o ponto do `para()`), o "longe e devagar" por ramo, distância e ação, o 2º e o 3º homem, a aproximação de 4–12 m, a perda por ramo; `teste-pressao --humano` (a pessoa "espelho") | as medidas do mapa das travas levadas para o repositório |

### 6.2 A triagem (o que foi medido e não entrou; 8 sementes × 3 roteiros, as triagens de 4)

- **O sprint mais cedo da recomposição** (`corre` 11 → 8, `urgente` 10 → 20, `vUrgente` 4 → 3) e **a frente sprintando nos 2 s
  da perda**: a recomposição "longe e devagar" não mudou (28,8 × 28,2%) e a perda subiu ~4 m/min. O diagnóstico
  (`diag-recomp` no rascunho): 95% do "longe e devagar" da recomposição está nos primeiros 0,75 s de cada uma — a
  ACELERAÇÃO, do 2,4 m/s mediano do começo (41% começam abaixo de 2 m/s) —; a inversão é ~1 ponto. Falta de sprint não é.
- **A cobertura do 2º homem a 6 m pelo modo pressa** (o plano): o 2º homem não mudou (o `cobre` quase nunca é o 2º mais perto:
  contrapressão 25%, aperta 22%, zona 21%) e a roubada desfeita do `teste-defesa-corrida` ia de 4% a 7–9% (sem ela, 4%). Saiu.
- **`engaja` 78** (o plano): aproximação 9,6 km/h, mas agressão 86% contra o espelho e PPDA 8,4. Ficou 67 (abaixo).
- **O raio de 20 m** (o plano): o "longe e devagar" ficava em 22,8% (os de 20 a 30 m da bola eram 6 pontos); 30 m: 18,4%;
  33 m: 16,6%.
- **`IA_DEFESA.corrida.v` 6,3 só contra a pessoa** (item 19): o defensor do corredor 3,1 → 4,1 m/s e 38 duelos (77 → 38: menos
  gente passada), mas o vai e volta 4,90 e as roubadas sofridas 2,82/min reprovavam o `teste-ia-corre`. O plano listava 6,3
  como "não mexer" pela IA × IA (o contra-ataque da IA morria no painel); contra a pessoa o efeito é outro, mas as guardas
  não deixam.
- **O 1º homem recuando com o condutor a > 4,5 m/s** (o "recua1"): 3,9 m/s, sem ganho. **A contenção mais longe** (`dist`
  [3, 0,5, 3, 7]): 4,2 m/s, mas 41% das arrancadas do bloco armado chegavam à área (meta ≤ 25%).
- **Sem o gatilho da recepção contra a pessoa:** a agressão não caiu (84%): ela vinha do `engaja`.
- **O volume:** cada ganho perto da bola subia a perda (base 229,7 ± 2,1, no teto): o arco com o CORRER +4–6, o raio de 30 m
  +4–7; pagaram a recomposição longe da bola (0,75 de intensidade: −6) e a espera da volta (−4). Com 0,7 a recomposição longe
  ficava a ~4,1 m/s, em cima dos 4 m/s da medida.
- **A roubada desfeita** (`teste-defesa-corrida`, ≤ 5% pela binomial; main 16/368, 4%): com a marcação do D3 ela ia a 7–9%
  em quase toda calibração. O rastro (`dc-desf` no rascunho: a posse tick a tick nos 60 depois de cada roubada da IA no
  roteiro sprint) mostrou o mecanismo: o ladrão domina no tick 1, decide o passe e o SOLTA ~0,5 s depois (a carga do botão),
  justo quando acaba o `semDominio` de quem perdeu — e a pessoa, voltando para o lado do gol dela, está a ~0,8 m à frente da
  bola, a 0,3 m da linha do passe (os passes que saíram bem: a pessoa atrás da bola). Esses passes viravam desfeita em 6,6%
  na main e em 14% com o D3 (mais passes curtos no meio-campo: o time marca mais perto). O risco lido também 0,15–0,25 s à
  frente não mudou nada (a pessoa ainda não estava na linha); o MAIOR entre o agora e 0,5 s à frente levou esses passes a
  ~10% e a desfeita a 6–7% (passa na binomial).
- **Quem o condutor rápido já passou, recompondo na hora em disparada** (atrás dele, a ≤ 15 m; o plano do item 19): a
  mediana do defensor do corredor CAÍA (3,1 × 4,3 m/s numa calibração, 2,6 × 3,8 noutra; ~57 duelos): quem volta correndo
  fica de novo na frente da arrancada e é passado virando. A chegada à área não mudou além do ± (16 × 19%). Saiu.
- **O meio poupado e o volume:** com o "longe" (20 m) valendo também para o meio que ficou à frente da bola, o recuo dele no
  `teste-transicao --humano` caía de 6,1 para 4,0 m/s (com 30 m só para quem ficou à frente, 5,1–5,5; meta ≥ 5,5); poupando
  o meio, a perda ia a 234–237 m/min (20 m) — com 16 m, 232; com a intensidade longe 0,65, a marcação devagar (M5) ia a 23%
  (a recomposição longe a ~3,9 m/s conta como devagar).
- **As medidas da marcação mudam entre calibrações vizinhas mais que o ±:** a aproximação de 4–7 m foi de 3,6 a 8,7 km/h, o
  PPDA de 8,4 a 10,8 (o encurtar 0,30 × 0,35), o gol por chute nas arrancadas de 0 a 26% (12–23 chutes). Por isso as metas do
  D3 reprovam só quando a medida PROVA estar do lado errado (2 ±; a binomial no `teste-defesa-corrida`), a aproximação é a
  de 4–12 m numa faixa só, o `teste-ia-corre` roda com 8 sementes no CI e o `--humano` com 48.

### 6.3 Antes → depois (`teste-ia-corre`, 24 partidas: 3 roteiros × 8 sementes; `teste-pressao --humano`, 48 partidas; `teste-defesa-corrida`, 24 + 6)

| Medida | Antes (main 2c9e7066, o D2) | Depois | Meta | Real |
|---|---|---|---|---|
| M2 aproximação do 1º homem a 4–12 m (km/h) | 2,43 ± 0,64 | 6,58 ± 0,69 | ≥ 5 | 7,4–7,5 |
| M2a / M2b a 4–7 / 7–12 m (km/h) | 2,54 / 2,41 | 7,84 / 6,01 | (informativas) | 7,4 / 7,5 |
| M5 marcando: o ponto a > 5 m e o corpo < 4 m/s (%) | 31,08 ± 0,60 | 15,61 ± 0,27 | ≤ 18 | — |
| M6 ...na recomposição (%) | 27,28 ± 0,69 | 21,81 ± 0,65 | (≤ 15: informativa, a aceleração) | — |
| M7 / M8 2º e 3º homem (mediana, m) | 6,53 / 11,88 | 7,39 / 12,30 | (≤ 5 / ≤ 8,5: informativas) | 9,6 (2º marcador) |
| M1 1º homem (mediana, m) | 1,99 | 2,03 | (não aperta mais) | 5,2 |
| M4 IA marcando: m/min | 209,8 | 217,1 | — | — |
| V7 IA nos 5 s depois de perder: m/min | 229,7 ± 2,1 | 232,0 ± 2,2 | ≤ 230 (reprova além de 2 ±) | 156 ± 9 (Jerome, transição) |
| V1 / V2 IA atacando / no total: m/min | 156,0 / 171,4 | 149,0 / 165,3 | ≤ 190 / ≤ 195 | — / 140 |
| V3 vai e volta por jogador-min | 4,74 ± 0,05 | 4,32 ± 0,08 | ≤ 4,74 (2 ±) | 0,30 |
| disparadas por minuto | 1,29 | 1,24 | (redistribuir) | 0,14 |
| V5 roubadas sofridas pela IA por min de bola no pé | 2,33 ± 0,20 | 1,88 ± 0,14 | ≤ 2,78 | — |
| V4 gols da IA contra o roteiro por partida | 1,33 ± 0,22 | 1,58 ± 0,30 | ≥ 0,92 | — |
| A11 conversão da IA (%) | 19,8 ± 2,9 | 26,4 ± 4,5 | (informativa) | 8–15 |
| A1–A10 (o ataque do D2) | — | todas dentro (condutor 12,0 km/h, posse 0,97 s, à área 34,0%) | as do D2 | — |
| PPDA da IA contra o espelho (sementes 1–48) | 11,90 | 9,38 | 8–10,5 (alvo 9–10,5) | 8,6–9,9 (os que mais apertam) |
| agressão (recepção com a IA a ≤ 4,6 m em ≤ 2 s) | 71,7% | 74,4% | 58–78% | 68 ± 10% (Metrica) |
| retomada em ≤ 5 s | 35,9% | 39,8% | 34–54% | 44,1 ± 10% |
| `teste-defesa-corrida`: roubada desfeita pelo mesmo condutor | 15/368 (4%) | 18/343 (5%) | ≤ 5% (binomial) | — |
| ...defensor do corredor (mediana, m/s) | 3,90 (61 duelos) | 3,38 (50) | ≥ 5 (pendente) | — |
| ...arrancadas do bloco armado que chegam à área | 34/251 (14%) | 49/237 (21%) | ≤ 25% | — |
| ...gols do roteiro sprint · faltas da IA no humano por partida | 0,54 · 1,96 | 0,54 · 1,63 | ≤ 1,5 · ≤ 5 | — |
| `teste-transicao --humano`: recuo do meio da IA que ficou à frente (m/s) | 6,1 | (2ª tabela) | ≥ 5,5 | — |

O PPDA "11,0 contra o roteiro" do plano era o da IA × IA (o `teste-pressao` da Média). Contra os roteiros da pessoa e contra o
construtor (o ataque substituto dos testes no time 0) o PPDA da IA dá ~1,5–3: eles quase não passam diante da pressão — é
medida da pessoa roteirizada. O "espelho" (a pessoa joga com a decisão da IA, sem a marca `ia`) constrói como a IA: 11,9 na
base, o mesmo da Média IA × IA de antes.

### 6.4 Os testes protegidos

O resultado de cada teste da lista está no PR (os estatísticos com 2 rodadas). O `teste-defesa-corrida` ganhou `--set` e o gol
por chute nas arrancadas pela binomial (com 12–23 chutes o "≤ 20%" ia de 0 a 26% entre calibrações vizinhas). Demo e treino
bit a bit iguais (`hash-partida --base` a main: a demo IGUAL; `hash-igual --base` a main: as 4 cenas IGUAIS); a partida contra
a pessoa muda de propósito.

### 6.5 Limites e o que fica

- **Item 19 (o defensor do corredor ≥ 5 m/s): não alcançado** (3,90 → 3,38 m/s, 50 duelos; 3,35 com 64 na 2ª rodada). O recuo do 1º homem começa com o
  condutor rápido ligado, a ~6 m do defensor e 0,8 s antes de ele passar (mediana de 57 duelos); do ~0,5 m/s de então, a(v) =
  A0·(1 − v/S0) com A0 8,5 m/s² (Alonso-Callejo 2022) dá no máximo ~4,8 m/s em 0,8 s. Para chegar a 5, o recuo tem de começar
  ~1 s antes — o condutor ainda acelerando — e o que foi medido nessa direção (o limiar a 6,3 m/s; o recuo com 4,5 m/s; a
  contenção mais longe; quem já foi passado voltando em disparada, que DERRUBAVA a mediana a 2,6) ou não deu ou quebrou as
  guardas; entre calibrações vizinhas a mediana foi de 2,0 a 4,7 m/s. Proposta ao dono: uma meta de chegada (a arrancada do
  bloco armado na área ≤ 25%, que passa: 21% e 10% nas duas rodadas, base 14%) no lugar da velocidade, ou o recuo mais cedo valendo também contra a
  pessoa no D5 (o vai e volta), quando a guarda dele for outra.
- **A recomposição "longe e devagar" ≤ 15%: não alcançada** (27,3 → 21,8%): é a aceleração do começo de cada recomposição; só
  diminui com menos recomposições começando paradas (os de trás já se mexendo) — o D5/D6.
- **O 2º e o 3º homem ≤ 5 / ≤ 8,5 m: não alcançados** (6,5 → 7,4 e 11,9 → 12,3 m: o 1º homem sai mais cedo — o `engaja` —, e
  o 2º fica na cobertura dele). O 2º marcador real fica a 9,6 m do portador (Metrica; p25 6,6 m; `PESQUISA-ETAPA3.md` §4.2): a
  IA já fica mais perto que o real, e o "≤ 5 m" poria dois colados no condutor o tempo todo. Ficam informativas.
- **O volume da perda** ficou 229,7 → 232,0 m/min (dentro do ±; 229,7 na 2ª rodada de 48 partidas; o teto da guarda é 230): é o
  preço do meio que volta a todo vapor (6,1 m/s). O volume TOTAL da IA caiu (171,4 → 165,3 m/min) e o vai e volta também (4,74 →
  4,32).
- **A roubada desfeita** subiu 4 → 5% (6% na 2ª rodada; passa na binomial): o passe que o ladrão solta na corrida de volta da pessoa ainda sai
  em ~10% desses passes (6,6% na main). Fica para o D4 (os companheiros da pessoa) ou para a carga do passe da IA
  (cancelar o passe com a linha fechada no meio da carga), que vale também na IA × IA.
- **A conversão da IA contra o roteiro** foi 19,8 → 26,4% (25,7% na 2ª rodada; o real é 8–15%): a IA ganha a bola mais alto. Os companheiros da
  pessoa (D4) e o goleiro (categoria C).
