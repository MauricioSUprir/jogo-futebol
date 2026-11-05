# Pesquisa — item 35 (F): clássico mais PEGADO pela agressividade dos jogadores, com o árbitro IGUAL

Contrato: "Clássico pegado (item 35)" no `CONTRATOS.md`. Teste: `tools/teste-classico.mjs` (medida: `tools/lib/classico-medidas.mjs`).
A proposta do §3 foi o ponto de partida; o que entrou de fato (a tabela `config.js CLASSICO`, os valores finais e a triagem) está
no §6.

Pedido do dono (17/10): "clássico mais PEGADO: mais faltas pela AGRESSIVIDADE dos jogadores (bote mais forte, mais
contato), não pelo árbitro (o pedido do TM já traz `partida.classico`)". Esta pesquisa junta (1) dados reais de clássicos ×
jogos comuns — com medição própria em dados abertos —, separando o que é do JOGADOR do que é do ÁRBITRO, (2) o que os jogos
(EA FC, FIFA, Football Manager, PES/eFootball) fazem e (3) a proposta da tabela `CLASSICO` com as metas do `teste-classico`.

Pesquisa feita em 05/11/2026. Os scripts estão em `tools/pesquisa/classico_*.py` (só a biblioteca padrão); os dados brutos
não ficam no repositório (baixáveis: StatsBomb Open Data no GitHub e a API pública da ESPN — ver o §4).

---

## 0. Resumo (o que levar para o código)

1. **No clássico real o jogador disputa mais, o árbitro apita quase igual.** Medição própria em **226 clássicos** (6
   conjuntos: StatsBomb Europa 2015/16, ESPN Brasileirão, Argentina, Inglaterra, Espanha e Itália 2023–25), ajustada
   pelo estilo dos dois times: faltas **+11,2% [+8,4; +14,1]** (Brasil +8,7%, Argentina +11,6%, Europa +12,5%;
   Premier League, 50 dérbis, +16% [+6; +25] no HSAC); nas rivalidades mais quentes **+25% a +50%** (Barça × Real
   2023–25 +48%, Atlético-MG × Cruzeiro +45%, Newell's × Central +30%, Fla-Flu +28%, Betis × Sevilla +27%, Athletic ×
   Real Sociedad +25%; jogos isolados até +60%). A **fração de falta por disputa no chão** (falta ÷ (desarme + falta))
   sobe pouco: **+4,2% [+2,1; +6,4]** — **dois terços das faltas a mais vêm de MAIS DISPUTAS** (≈ +7%; na Europa os
   desarmes por minuto de bola rolando +11% [+4; +17]); o outro terço é disputa mais dura OU apito mais rigoroso — os
   dados não separam os dois, e cabe com folga nos ±10% do "árbitro igual".
2. **A pressão (volume) NÃO sobe:** pressões por minuto de bola rolando no clássico **+0,0% [−5,6; +6,2]** (StatsBomb,
   45 clássicos), interceptações e recuperações iguais. O clássico é **mais contato quando já está perto**, não mais
   corrida nem mais pressão. Isso casa com a lição do D8 (o jogo já corre mais que o real): **redistribuir, nunca somar**.
3. **Cartões sobem mais que as faltas:** amarelos **+30% [+23; +37]** junto (Brasil +18%, Argentina +38%, Europa +33%;
   Serie A, dérbis da mesma cidade 2002–09, **+42%** com o rigor do árbitro controlado — Kilduff et al. 2016);
   amarelo por falta **+15% [+10; +21]** (Brasil +9% n.s., Espanha +3% n.s., Itália +29%, Argentina +24%); os cartões
   SEM falta (reclamação, conduta, 2º amarelo) **+64%** (Europa 2015/16: 1,44 × 0,88 por partida) — esses o jogo não
   tem. **Vermelhos +40% [+5; +88]** junto, mas puxados pela Argentina (+167%: 0,68 × 0,27 por jogo; Boca × River 1,75);
   no Brasil +3% e na Europa +31%, os dois sem significância.
4. **Chutes um pouco menos, gols iguais ou um pouco menos:** chutes **−4,6% [−7,2; −2,0]**, gols −7% [−14,5; +1,0]
   (Bundesliga 1999–2009: gols iguais — Bäker et al. 2012), passes −4,9%. **Bola rolando −4% [−6; −1]** (estimada nos
   eventos do StatsBomb; mais reinícios +5%).
5. **Jogos:** nenhum documenta efeito de clássico NA JOGABILIDADE (EA FC/PES: ambiente, narração, objetivos; FM: moral,
   atributo oculto "Important Matches"). O que eles têm é a SEPARAÇÃO que o dono pediu: o EA FC 26 tem
   **"Tackle Aggression – CPU" (1–99, padrão 50)** separado de **"Referee Strictness"**; o FIFA 13–17 tinha
   **"Aggression"** (o quanto o time entra no bote) separado de **"Pressure"** (onde aperta); o FM separa
   **Aggression** (vontade de disputar) de **Dirtiness** (quanto faz falta) e tem "Get Stuck In"/"Tackle Harder".
6. **Proposta:** `CLASSICO` com a VONTADE do bote (risco por passo como taxa, ×1,4, e o descanso ÷1,4), o 1º homem
   CONTENDO mais perto (−0,5 m) e APERTANDO mais perto (−0,4 m), a arrancada final do aperto de mais perto (−1,5 m: o
   "bote mais forte" sem correr mais longe), a bola encostada disputada com um pouco mais de velocidade relativa, e os
   companheiros da pessoa chegando no condutor um pouco mais fortes — **nada** no árbitro (`FALTAS.*`, chance da
   DIVIDIDA, cartões), **nada** no volume de pressão (engaja, encurta, contrapressão, recomposição). Metas: botes
   +25–50%, faltas +25–50% (o "clássico quente" real; a média real, +11%, não se percebe numa partida de 8 min),
   chance de falta por contato ±10%, amarelos +20–60%, vermelhos ≤ 0,2/partida, gols e chutes sem queda provada além
   de −25%/−15%, bola rolando −2% a −8%, intensidade (m/min, PPDA) sem subir além de +5%.

---

## 1. Dados reais: clássicos × jogos comuns

### 1.1 Medição própria — StatsBomb Open Data, 5 ligas europeias 2015/16 (eventos)

**Fonte:** StatsBomb Open Data, <https://github.com/statsbomb/open-data> (temporada 2015/16 completa da Premier League,
La Liga, Serie A e Ligue 1; da Bundesliga só os jogos do Leverkusen — fora da conta ajustada). 1 517 partidas.
Eventos lidos um a um (script `tools/pesquisa/classico_resumo_partida.py`, análise `tools/pesquisa/classico_analise_sb.py`).

**Grupos:**
- **A — clássico de verdade** (45 partidas): mesma cidade/região + as grandes rivalidades históricas — Arsenal ×
  Tottenham, Liverpool × Everton, Manchester United × City, Newcastle × Sunderland, Liverpool × United, Aston Villa ×
  West Brom; Real × Atlético, Barcelona × Espanyol, Sevilla × Betis, Barcelona × Real, Athletic × Real Sociedad, Celta ×
  Deportivo, Valencia × Levante; Juventus × Torino, Inter × Milan, Roma × Lazio, Genoa × Sampdoria, Chievo × Verona,
  Inter × Juventus; PSG × OM, Lyon × Saint-Étienne, Bastia × Ajaccio, Nice × Monaco.
- **B — outras rivalidades** (90): os outros dérbis de Londres e de Madri, bascos, valencianos, andaluzes, bretões,
  Olympico, Derby del Sole, toscano etc.
- **N — comuns** (1 382).

**Ajuste:** "bruto" = média do grupo ÷ média dos comuns. "Ajustado" = soma observada ÷ soma esperada, a esperada pelo
estilo de cada time nos jogos comuns × o que o adversário costuma sofrer ÷ a média da liga (time E adversário; o
Atlético de Madri faz falta em qualquer jogo — não é o clássico). Intervalo de 95% por bootstrap das partidas (4 000).

**Bola rolando** estimada pelos eventos: tempo da partida − os intervalos entre o último lance vivo e cada reinício
(lateral, tiro de meta, escanteio, falta, saída, pênalti, bola ao chão). Dá ~54,7 min nos comuns (os números oficiais das ligas costumam ficar entre 55 e 60 min;
serve para comparar grupos, não como número absoluto).

| Medida (por partida, os dois times) | Clássico A | Comum | Bruto | Ajustado [IC 95%] |
|---|---|---|---|---|
| Faltas (sem mão na bola) | 31,8 | 28,4 | +11,8% | **+14,0% [+7,4; +20,7]** |
| Amarelos (todos) | 5,96 | 4,45 | +34,0% | **+36,1% [+20,5; +52,0]** |
| Amarelos dados em falta (contagem) | 4,51 | 3,57 | +26,4% | +29,0% [+13,5; +45,1] |
| Vermelhos | 0,27 | 0,26 | +2,4% | +10% [−49; +82] (n.s.) |
| Desarmes ("Duel: Tackle") | 42,2 | 39,2 | +7,8% | **+7,4% [+2,3; +12,3]** |
| Pressões | 313 | 322 | −2,7% | −2,9% [−7,7; +2,0] |
| Interceptações | 23,2 | 24,6 | −5,4% | −6,2% [−16,9; +4,7] |
| Recuperações de bola | 103 | 107 | −3,3% | −0,4% [−4,5; +3,7] |
| Duelos aéreos | 43,4 | 42,6 | +1,9% | +8,1% [−1,3; +16,8] (n.s.) |
| Chutes (sem pênalti) | 24,5 | 24,6 | −0,2% | −1,8% [−8,6; +5,2] |
| Gols | 2,29 | 2,63 | −13,0% | −15,3% [−31,4; +0,9] (n.s.) |
| Passes (bola rolando) | 812 | 867 | −6,3% | **−8,5% [−11,4; −5,6]** |
| Bola rolando (min, estimada) | 53,2 | 54,7 | −2,7% | **−4,0% [−6,2; −1,4]** |
| Reinícios | 110 | 107 | +2,4% | +4,7% [+1,9; +7,8] |

Razões (as que separam jogador × árbitro):

| Razão | Clássico A | Comum | Diferença [IC 95%] |
|---|---|---|---|
| Falta ÷ (desarme + falta) — "falta por disputa no chão" | 0,430 | 0,421 | **+2,1% [−3,7; +7,7]** |
| Amarelo (da falta) ÷ falta | 0,142 | 0,126 | +13,1% [+1,4; +25,1] |
| As duas ajustadas pelo estilo dos times (falta ÷ disputa; amarelo ÷ falta) | | | +3,5% [−0,6; +7,8]; +13,1% [+1,5; +25,5] |
| Falta ÷ pressão | 0,102 | 0,088 | +14,9% [+5,2; +25,6] |
| Falta por min de bola rolando | 0,598 | 0,520 | +14,9% [+4,8; +25,2] |
| Desarme por min de bola rolando | 0,794 | 0,716 | **+10,8% [+4,2; +17,0]** |
| Pressão por min de bola rolando | 5,88 | 5,88 | **+0,0% [−5,6; +6,2]** |
| Cartões sem falta (reclamação/conduta + 2º amarelo) por partida | 1,44 | 0,88 | +64% (só bruto) |

Por liga (A, bruto): La Liga faltas +21%, amarelos +48%; Ligue 1 +9% / +38%; Premier League +2% / +3% (mas desarmes
+21%); Serie A +7% / +23%. Partidas mais pegadas da amostra (faltas observadas × esperadas): Betis × Sevilla 52 × 32;
Barcelona × Espanyol 48 × 32; Torino × Juventus 44 × 33; Inter × Milan 42 × 30; Barcelona × Real 42 × 25; Nice × Monaco
42 × 27; Sampdoria × Genoa 42 × 33. Os PSG × OM daquele ano foram os mais limpos (17 e 14 faltas).

Grupo B (outras rivalidades, 90): faltas +1,3% (n.s.), amarelos +10% [+1; +20], vermelhos +68% [+15; +126] — o
"dérbi de Londres" comum não é pegado; o efeito está nas rivalidades fortes.

### 1.2 Medição própria — Brasileirão 2023–2025 (ESPN, estatística por partida)

**Fonte:** a API pública do placar/resumo da ESPN (`site.api.espn.com/apis/site/v2/sports/soccer/bra.1/...`, a mesma
que alimenta <https://www.espn.com.br/futebol/>), 1 007 partidas com estatística completa (69 sem passes ou desarmes
ficaram de fora; 26 de 2024 não vieram na listagem). Faltas, amarelos, vermelhos, desarmes ("totalTackles", definição
Opta: a falta não conta como desarme), interceptações, chutes, passes. Script `tools/pesquisa/classico_espn_coleta.py` e
`tools/pesquisa/classico_analise_espn.py` (`--duplo` = ajuste por time E adversário, por temporada).

**Clássicos (A, 82 partidas):** os 6 do Rio (Fla, Flu, Vasco, Botafogo), os 6 de São Paulo (Corinthians, Palmeiras,
São Paulo, Santos), Gre-Nal, Atlético-MG × Cruzeiro (e os do América-MG em 2023), Atletiba (2023), Ba-Vi (2024–25),
Clássico-Rei (2025). **B (241):** os outros jogos entre os 12 grandes (interestaduais).

| Medida (por partida) | Clássico | Comum | Bruto | Ajustado time+adversário [IC 95%] |
|---|---|---|---|---|
| Faltas | 29,4 | 27,1 | +8,6% | **+8,7% [+3,6; +13,9]** |
| Amarelos | 5,57 | 4,97 | +12,1% | **+18,0% [+5,9; +30,2]** |
| Vermelhos | 0,35 | 0,29 | +24,1% | +2,9% [−36; +51] (n.s.) |
| Desarmes | 33,7 | 32,7 | +2,9% | +2,8% [−2,1; +7,6] (n.s.) |
| Interceptações | 16,4 | 16,9 | −2,9% | −1,7% (n.s.) |
| Chutes | 25,8 | 27,0 | −4,3% | −3,7% [−8,3; +0,9] (n.s.) |
| Chutes no alvo | 8,5 | 9,2 | −6,9% | −7,4% [−14,7; +0,5] (n.s.) |
| Gols | 2,39 | 2,52 | −5,2% | −7,8% [−21,2; +6,3] (n.s.) |
| Passes | 828 | 838 | −1,2% | −1,7% (n.s.) |
| Cruzamentos | 35,9 | 38,8 | −7,4% | −5,1% [−9,2; −1,0] |
| **Falta ÷ (desarme + falta)** — bruta; ajustada | 0,466 | 0,453 | | **+3,0% [−0,4; +6,4]**; +3,1% [−0,6; +6,8] |
| Amarelo ÷ falta — bruto; ajustado | 0,190 | 0,184 | | +3,2% [−5,9; +12,7]; +8,5% [−0,8; +18,9] (n.s.) |

Por clássico (faltas observadas × esperadas pelo estilo dos dois times, n = jogos): **Atlético-MG × Cruzeiro +45%**
(n = 4), **Fla-Flu +28%** (5), Flu × Vasco +25% (5), Botafogo × Flamengo +21% (6), Botafogo × Fluminense +16% (6),
Botafogo × Vasco +15% (4), Fla × Vasco +13% (5), Corinthians × Palmeiras +7% (6), Corinthians × São Paulo +7% (6),
Gre-Nal +1% (5), Choque-Rei 0% (6), Ba-Vi +4% (4), Palmeiras × Santos −31% (4). Com o ajuste só pelo time, faltas
+10,3% e amarelos +22,8%.

Os interestaduais entre grandes (B) quase não mudam: faltas +2,1% (n.s.), amarelos +7% [+1; +14] — o efeito é da
RIVALIDADE local, não do "jogo grande".

### 1.3 Medição própria — Argentina 2023–25 e Inglaterra/Espanha/Itália 2023–25 (ESPN) e o resultado JUNTO

Mesma coleta e a mesma conta do §1.2 (ESPN, ajuste por time e adversário por temporada; nas ligas europeias a
temporada vai de agosto a maio). Partidas com estatística incompleta ficam de fora (na Argentina, 139 de 1 266).

**Clássicos (A):** Argentina — Boca × River, Racing × Independiente, Rosario Central × Newell's, Estudiantes × Gimnasia,
San Lorenzo × Huracán, Colón × Unión, os três de Córdoba (Talleres, Belgrano, Instituto), Banfield × Lanús, Godoy Cruz ×
Independiente Rivadavia (38 partidas). Inglaterra — North London, Merseyside, Manchester, Liverpool × United, Villa ×
Wolves, Brighton × Palace, Leicester × Forest, Bournemouth × Southampton (28). Espanha — Real × Atlético, Barça × Real,
Barça × Espanyol, Betis × Sevilla, Athletic × Real Sociedad (18). Itália — Inter × Milan, Juve × Torino, Roma × Lazio,
Inter × Juve (15).

| Ajustado (time + adversário) | Argentina (38) | Inglaterra (28) | Espanha (18) | Itália (15) |
|---|---|---|---|---|
| Faltas | **+11,6% [+4,5; +18,8]** | +5,7% [−0,7; +11,9] | **+25,0% [+14,7; +35,6]** | +10,8% [−1,2; +22,5] |
| Amarelos | **+38% [+22; +55]** | +21% [+2; +39] | +28% [+6; +53] | **+43% [+23; +62]** |
| Vermelhos | **+167% [+35; +336]** (0,68 × 0,27 por jogo) | +128% (n.s.; 0,29 × 0,13) | +1% (n.s.) | +44% (n.s.) |
| Desarmes | +1,9% (n.s.) | +6,3% (n.s.) | +6,7% [+0,3; +13,7] | −9,6% [−18,7; −0,3] |
| Falta ÷ disputa (ajustada) | +5,4% [−0,4; +11,7] | −0,4% [−6,3; +5,6] | +9,7% [+2,8; +16,2] | +11,2% [+1,1; +21,6] |
| Amarelo ÷ falta (ajustado) | **+24% [+8; +40]** | +14% (n.s.) | +3% (n.s.) | **+29% [+15; +48]** |
| Chutes | −9,4% [−14,8; −3,8] | −3,8% (n.s.) | −0,7% (n.s.) | −8,3% (n.s.) |
| Gols | −14,9% (n.s.) | +0,2% (n.s.) | +2,6% (n.s.) | −5,3% (n.s.) |
| Passes | −12,1% [−15,4; −8,9] | −2,5% (n.s.) | −6,8% [−10,8; −3,0] | −2,2% (n.s.) |

Os mais pegados (faltas observadas × esperadas): **Barcelona × Real Madrid +48%** (4 jogos), Colón × Unión +38% (1),
Newell's × Central +30% (3), Godoy Cruz × Rivadavia +29% (3), **Betis × Sevilla +27%** (4), Athletic × Real Sociedad +25%
(4), Talleres × Instituto +23% (4), Estudiantes × Gimnasia +22% (5), Villa × Wolves +18% (4), **Boca × River +15%** (4;
9,5 amarelos e 1,75 vermelho por jogo), Roma × Lazio +15% (4). Os mais "limpos": Racing × Independiente −22%, o
Merseyside −1%, Liverpool × United −6%.

**O resultado JUNTO** (os 6 conjuntos — StatsBomb Europa 2015/16, Brasil, Argentina, Inglaterra, Espanha e Itália 2023–25 —
por variância inversa no log da razão; `tools/pesquisa/classico_junta.py`, saída no terminal; **226 clássicos**):

| Medida | Clássico ÷ comum [IC 95%] |
|---|---|
| **Faltas** | **+11,2% [+8,4; +14,1]** |
| Desarmes | +4,1% [+1,5; +6,7] |
| **Falta ÷ disputa (desarme + falta), ajustada** | **+4,2% [+2,1; +6,4]** (bruta +2,8% [+0,8; +4,9]) |
| Amarelos | **+30,1% [+23,4; +37,1]** |
| Amarelo ÷ falta, ajustado | +15,0% [+9,5; +20,9] (bruto +12,5%) |
| Vermelhos | +40% [+5; +88] (193 clássicos; a Argentina puxa) |
| Interceptações | −2,4% (n.s.) |
| Chutes | **−4,6% [−7,2; −2,0]** |
| Gols | −7,1% [−14,5; +1,0] (n.s.) |
| Passes | −4,9% [−6,1; −3,7] |

Por região: Brasil + Argentina faltas +9,7% [+5,6; +14,0], amarelos +26%; Europa faltas +12,5% [+8,6; +16,5], amarelos
+33%.

### 1.4 Literatura e outras fontes

| Fonte | Dado | O que aproveitar |
|---|---|---|
| Kilduff, Galinsky, Gallo & Reade (2016), "Whatever it takes to win: Rivalry increases unethical behavior", *Academy of Management Journal* 59(5):1508–1534, doi:10.5465/amj.2014.0545 — números lidos na versão do ResearchGate <https://www.researchgate.net/publication/251324711> | Serie A 2002–2009, 2 788 partidas, rivalidade = mesma cidade. **Amarelos 6,03 × 4,25 por partida (+42%)**; Poisson com o rigor do árbitro controlado (média de cartões dele até ali): coeficiente 0,408 → **IRR 1,50**; **vermelhos 0,50 × 0,33 (+52%, p = 0,057)**, IRR 1,90; por jogador, razão de chances 1,73 (amarelo) e 1,99 (vermelho). Mecanismo: a rivalidade aumenta o "risco psicológico" e o comportamento antiético (entradas perigosas, simulação) — do JOGADOR | O teto real dos cartões (dérbis de cidade); o efeito sobrevive ao controle do árbitro → é do jogador. Não mede faltas |
| Kruse & Maennig (2019), "Yellow Cards and Suspension by Choice", Hamburg Contemporary Economic Discussions nº 64, <http://www.hced.uni-hamburg.de/WorkingPapers/HCED-064.pdf> (resumo: <https://econpapers.repec.org/paper/hcewpaper/064.htm>) | Bundesliga 2013/14–2017/18, 3 060 time-partidas, 8,6% em dérbis: **dérbi +0,19 a +0,20 amarelo por time por partida** (p < 0,05), sobre média de 1,81 → **≈ +11%**, com as características do árbitro controladas | Faixa de baixo dos amarelos |
| Harvard Sports Analysis Collective (jan/2015), "Premier League: Do Derbies Feature More Aggression?" <https://harvardsportsanalysis.org/2015/01/premier-league-do-derbies-feature-more-aggression> (hoje 404; números pelos trechos da busca) | 50 dérbis da Premier League em 5 temporadas: **25,95 × 22,38 faltas por partida (+16%)**, IC +1,4 a +5,7 faltas (**+6% a +25%**), p = 0,0013. O autor levanta a hipótese de o árbitro apitar mais para controlar o jogo | Confirma a faixa das faltas |
| HSAC (mar/2018), "An Analysis Of Aggression In Major European Soccer Rivalries" <https://harvardsportsanalysis.org/2018/03/an-analysis-of-aggression-in-major-european-soccer-rivalries/> (404; trechos) | 4 ligas: mais faltas nas rivalidades; na Serie A uma rivalidade puxa o efeito; com amarelos, parecido | Efeito concentrado em poucas rivalidades (como no Brasil) |
| Bäker, Mechtel & Vetter (2012), "Beating thy Neighbor: Derby Effects in German Professional Soccer", *Jahrbücher für Nationalökonomie und Statistik* 232(3):224–246, <https://www.degruyterbrill.com/document/doi/10.1515/jbnst-2012-0304/html> | Bundesliga 1999–2009: **sem diferença** em gols, resultados e nota do árbitro | Gols iguais |
| Buraimo, Forrest & Simmons (2010), "The 12th man? Refereeing bias in English and German soccer", *JRSS A* 173(2):431–449, <https://ideas.repec.org/a/bla/jorssa/v173y2010i2p431-449.html> | Modelo dos cartões minuto a minuto com controle de dérbi, placar, cartões recentes; viés pelo mandante (pista de atletismo = menos cartões para o visitante) | O viés do árbitro é da TORCIDA/mando, não do dérbi — não modelar. Não consegui o coeficiente do dérbi |
| Dawson, Dobson, Goddard & Wilson (2007), "Are football referees really biased and inconsistent?", *JRSS A* 170(1):231–250, <https://econpapers.repec.org/RePEc:bla:jorssa:v:170:y:2007:i:1:p:231-250> | Premier League 1996–2003: os árbitros diferem entre si; visitante leva mais cartões | Variação de árbitro = ruído; o dono quer o árbitro fixo |
| Nevill, Balmer & Williams (2002), *Psychology of Sport and Exercise* 3(4):261–272; Unkelbach & Memmert (2010), *J. Sport & Exercise Psychology* 32(4):483–498 (<https://lida.sport-iat.de/dfb/Record/4020801>); Pettersson-Lidbom & Priks (2010), *Economics Letters* 108(2) | Com o barulho da torcida o árbitro marca ~15,5% menos faltas contra o mandante (vídeo, 40 árbitros); o barulho muda o amarelo; sem torcida (Itália 2007) o mandante leva mais cartões | É o lado do ÁRBITRO (pressão da torcida) — fica de fora, como o dono pediu |
| El Gráfico, "Todos los historiales del Superclásico" <https://www.elgrafico.com.ar/articulo/superclasicos/50461/todos-los-historiales-del-superclasico-river-boca> e "Los antecedentes de superclásicos con múltiples expulsiones" <https://elgrafico.com.ar/articulo/primera-division/103693/los-antecedentes-historicos-de-superclasicos-con-multiples-expulsiones-en-un-mismo-equipo> | 158 expulsos em ~266 Superclásicos (≈ 0,6 por jogo, histórico); 2023: 6 a 8 expulsões num jogo | Caso extremo, não a média |
| Netflu (levantamento do Bolavip) <https://www.netflu.com.br/fluminense-x-vasco-e-um-dos-classicos-com-maior-media-de-cartoes-confira/> (403; trechos) | Cartões por clássico: Atlético-MG × Cruzeiro 7,8; Gre-Nal 6,8; Ba-Vi 6,7; Flu × Vasco entre os maiores | Sem método nem período: só ilustrativo |
| Maisfutebol, Porto × Sporting 12/02/2022 <https://maisfutebol.iol.pt/fc-porto/sporting/faltas-tempo-ultil-e-expulsoes-os-numeros-horriveis-do-classico> | 31 faltas, 12 amarelos, 8 expulsões (5 jogadores), **tempo útil 41% (43 de 105 min)** contra 49 min de média da liga | Caso extremo; a bola rolando cai com as faltas |
| Total Match (o próprio jogo de gestão), `legacy-total-match/js/engine.js:120–122, 280` | A simulação 2D já trata o clássico: chances ×1,06 ("jogo mais aberto"), a diferença técnica pesa ×0,6 e **cartões ×1,6** (0,032 × 0,02 por minuto, 14% vermelhos) | O 3D vai substituir a simulação: +60% de cartões passa da média real (+30% junto) e fica no teto (+43–50%); as chances +6% contrariam os dados (chutes iguais ou −4%). Informativo — não é desta tarefa mexer no TM |

### 1.5 Jogador × árbitro — a decomposição

Faltas = disputas × chance de a disputa virar falta.

| | Europa 2015/16 (A, 45) | Brasil (A, 82) | Junto (226) |
|---|---|---|---|
| Disputas no chão (desarme + falta) | 74,0 × 67,6 = **+9,5%** (bruto) | 63,1 × 59,8 = **+5,6%** (bruto) | ≈ **+7%** (desarmes +4,1% e faltas +11,2%) |
| Desarmes por min de bola rolando | **+10,8% [+4; +17]** | (sem bola rolando na ESPN) | — |
| Fração falta ÷ disputa (ajustada) | +3,5% [−0,6; +7,8] | +3,1% [−0,6; +6,8] | **+4,2% [+2,1; +6,4]** |
| Faltas | +14,0% | +8,7% | **+11,2%** |
| Pressões por min de bola rolando | +0,0% [−5,6; +6,2] | — | — |

- **Do JOGADOR (com certeza):** mais disputas (≈ +7% — **dois terços** das faltas a mais; na Europa, os desarmes por
  minuto +11% com as pressões iguais: cada pressão termina mais vezes em contato), mais faltas por pressão (+15%), mais
  cartões sem falta (reclamação, provocação: +64%), menos passes e menos bola rolando (o jogo picotado).
- **Ambíguo (o outro terço, +4% [+2; +6]):** a fração falta ÷ disputa e o amarelo ÷ falta (+15% [+10; +21]) podem
  ser disputa mais dura (do jogador: chega mais rápido, entra por trás) OU apito mais rigoroso (do árbitro). Kilduff
  (IRR 1,50 com o rigor do árbitro controlado) e Kruse & Maennig (com o árbitro controlado) puxam para o jogador.
  Para o jogo isso cabe com folga nos ±10% da chance por contato (o C3 abaixo).
- **Do ÁRBITRO (o que fica de fora):** a pressão da torcida sobre o apito (Nevill, Unkelbach & Memmert,
  Pettersson-Lidbom & Priks, Buraimo et al.) e o "árbitro que aperta o critério para controlar o clássico" (hipótese do
  HSAC) — nenhum dos dois entra.

### 1.6 Faixas reais para o jogo (clássico ÷ comum)

| Medida | Média dos clássicos (junto, 226) | Clássicos quentes / teto | Fontes |
|---|---|---|---|
| Faltas | **+11% [+8; +14]** (por conjunto: +6% a +25%) | +25% a +50% (Barça × Real 2023–25 +48%, Galo × Cruzeiro +45%, Newell's × Central +30%, Fla-Flu +28%, Betis × Sevilla +27%); jogos isolados até +60% | §1.1–§1.3, HSAC |
| Disputas no chão (desarme + falta) | ≈ +7% (desarmes +4% [+1,5; +6,7]) | — | §1.5 |
| Falta por disputa (o "árbitro") | **+4% [+2; +6]** | Itália +11%, Espanha +10% | §1.5 |
| Pressão por minuto | 0% (±6%) | — | §1.1 |
| Amarelos | **+30% [+23; +37]** | +42% a +50% (Serie A, mesma cidade; Itália 2023–25 +43%) | §1.1–§1.3, Kruse & Maennig, Kilduff |
| Amarelo por falta | +15% [+10; +21] | Itália +29%, Argentina +24% | §1.3 |
| Vermelhos | +40% [+5; +88] (Brasil +3%, Europa +31%, n.s.) | Argentina +167%; Serie A +52% (p = 0,057); Superclásico ~0,6/jogo | §1.3, Kilduff, El Gráfico |
| Chutes | **−4,6% [−7; −2]** | — | §1.3 |
| Gols | −7% [−14,5; +1] (n.s.) | — | §1.3, Bäker et al. |
| Passes | −4,9% [−6; −4] | Argentina −12% | §1.3 |
| Bola rolando | −4% [−6; −1] | tempo útil 41% num Porto × Sporting | §1.1, Maisfutebol |

---

## 2. Jogos: o clássico na jogabilidade

| Jogo | O que existe | Efeito de clássico na jogabilidade? |
|---|---|---|
| **EA SPORTS FC 26** — FIFPlay, "FC 26 Game Settings" <https://www.fifplay.com/fc-26-game-settings>; Dexerto <https://www.dexerto.com/wikis/ea-fc-26-guides-walkthrough-tips/best-ai-behavior-sliders> | "AI Behaviour" (Tactical / Dynamic / Custom) com os controles da CPU de 1 a 99 (padrão 50): **Tackle Aggression – CPU** ("how hard the CPU tackles"; ~75 = "moderate to high aggression, which means more fouls"), Buildup Speed, Shot/Cross/Dribble/Skill Move Frequency. **Separado** em Regras → Árbitro: **Referee Strictness** (Very Lenient … Very Strict), Bookings, Handball; Gameplay → Defending: **Professional Fouls** on/off | **Não documentado.** O clássico tem ambiente (cantos, narração "derby"); no FC 27 as "Rivalries" do Player Career são objetivos (<https://realsport101.com/article/fc-27-player-career-new-rivalries-explained>). Jogadores relatam "a CPU fica mais forte no dérbi" (fórum EA, <https://forums.ea.com/discussions/fc-26-general-discussion-en/the-problem-of-disproportionate-talent-among-arch-rivals/12915543>) — impressão, sem confirmação |
| **FIFA 13–17 (táticas personalizadas)** — FIFPlay "FIFA 16 Tactics" <https://www.fifplay.com/fifa-16-tactics/>; FUTBIN (FIFA 18) <https://www.futbin.com/18/tactics-builder/view/4099> | Defesa: **Pressure** (onde começa a apertar: 1–33 recuado, 34–66 médio, 67–100 alto) e **Aggression** ("how hard the team will tackle and how much pressure is applied to the ball possessor"; "high aggression can result in a higher number of fouls") | Não por clássico; a separação pressão (onde) × agressividade (o quanto entra) é a mesma da nossa proposta |
| **Football Manager** — passion4fm/footballmanagerblog (atributos ocultos) <https://www.footballmanagerblog.org/2024/09/football-manager-guide-hidden-attributes.html>; fm-arena (testes de instruções) <https://fm-arena.com/find-comment/18379/> | **Aggression** (visível: vontade de se envolver nos lances) × **Dirtiness** (oculto: quanto faz falta; teste de usuário: Dirtiness 20 ≈ 1 cartão por jogo, Aggression 20 quase nenhum); **Important Matches** (oculto: desempenho em clássico/final); instrução "Get Stuck In"/"Tackle Harder" sobe o nível de agressividade do bote | O SI não publica um multiplicador de dérbi; a comunidade diz que jogador agressivo leva mais cartão em dérbi (contraditório). O modelo do FM é o que o dono pediu: a VONTADE (Aggression/Tackle Harder) separada da FALTA (Dirtiness) e do árbitro |
| **PES 2020 / eFootball** — Gamesatlas <https://www.gamesatlas.com/pes-2020/features/pes-2020-new-matchday-mode-stand-united-in-support-of-your-team>; evoweb <https://evoweb.uk/threads/higher-agression-of-pressure-on-the-ball-in-pes-2017-and-2018.78602/> | Master League do PES 2020 passou a tratar o dérbi com "mais prioridade" (narrativa); o Matchday é um evento online de dérbis | Nada documentado na jogabilidade; um usuário do PES 2017 descreve o dérbi "batalha por cada bola, muitas faltas" (impressão) |

**O que o jogador percebe** (pelos relatos e pelo que os controles fazem): a CPU **entra mais no bote** (mais desarmes,
mais carrinhos, mais faltas, mais bola parada), o jogo **para mais**; com o rigor do árbitro igual, o que é falta continua
sendo falta. Nenhum desses jogos deixa o clássico mais "aberto" — o nosso também não deve.

---

## 3. Proposta: a tabela `CLASSICO`

### 3.1 Princípios (vindos dos dados e das regras do projeto)

1. **Só a vontade e o contato perto da bola** (§1.5): a IA tenta mais o bote quando a bola está ao alcance, contém e aperta
   mais perto — o volume de pressão (engaja, encurta, contrapressão, recomposição, `IA_DEFESA.livre`) NÃO muda (pressão
   por minuto igual no real; o jogo já corre mais que o real, D8: redistribuir, nunca somar).
2. **O árbitro é o mesmo código** (`faltas.js` 143–198: `chanceFaltaBote`, `fatorForca`, `faltaNoBote`, `faltaNaCarga`,
   `montarFalta`, os critérios dos cartões, vantagem, DOGSO/SPA) e as mesmas constantes (`FALTAS.*`). A DIVIDIDA do humano
   (`chanceDividida`) também não muda. As faltas sobem porque há mais contato; os cartões sobem porque há mais faltas e
   porque a chegada é um pouco mais forte (temerário pela velocidade) — nunca pelo critério.
3. **Os dois times** (IA × IA da partida marcada — o "Simular o resto", a demo com a opção — e os companheiros da pessoa);
   **o controlado não** (o bote dele é o botão).
4. **No formato da `DIFICULDADE`**: deltas e multiplicadores com o MESMO significado da constante que cobrem, juntados uma
   vez na carga do módulo (como `BOTE_D`/`CONTEM_D`), nunca espalhados por cima de `IA_DEFESA`/`ACOES.boteIA` (lição: chave
   nova num objeto juntado por cima sobrescreve a de mesmo nome).
5. **`m.classico` fora do hash** (como `m.dificuldade`): sem o clássico o mundo não ganha o campo e tudo fica bit a bit.
   Antes de criar, procurar o nome (`grep -rn "classico" golaco/js`: hoje só `identidade.js:663`, `main.js:3445` — o
   `classico` do contexto da tela —, `prepartida*.js`; nenhum `m.classico`). No online, `m.classico` vem do pedido do
   anfitrião (o mesmo nos dois aparelhos).

### 3.2 As alavancas

| Chave | Cobre (hoje) | Valor proposto | Por quê / fonte |
|---|---|---|---|
| `vontade` | `ACOES.boteIA.chancePorPasso` (0,08) como TAXA: p' = 1 − (1 − p)^vontade | **1,4** (0,08 → 0,110) | A vontade de disputar (EA FC "Tackle Aggression", FM "Tackle Harder"). A forma de taxa satura sozinha no Lenda (0,22 → 0,294) |
| (a mesma `vontade`) | `ACOES.boteIA.descanso` (45 passos) ÷ vontade, com piso `descansoMin` | 45 → **32**; piso **12** (0,2 s) | Volta a tentar mais cedo depois de um bote que não ganhou |
| `contencao` | `IA_DEFESA.contencao` [5,5; 2,75; 1,5] (m somados, piso 1,25 — a mesma conta da `DIFICULDADE.contencao`) | **−0,5** (Média 2,75 → 2,25) | O 1º homem colado: mais janelas de bola ao alcance (pressão igual, contato maior: falta por pressão +15% no real) |
| `aperto` | `IA_DEFESA.aperto` [1,5; 1,5; 0,6] (m somados, piso 0,6) | **−0,4** (1,5 → 1,1) | No gatilho, chega mais perto da bola |
| `apertoArranca` | `IA_DEFESA.apertoArranca` [6; 6; 2,5] (m somados, piso 2,5) | **−1,5** (6 → 4,5) | "Bote mais forte" = CORRE só no fim, de mais perto: chega mais rápido ao condutor (porVel e temerário pela velocidade, o mesmo árbitro) sem correr mais longe. Amarelo por falta real +15% [+10; +21] (junto; parte pode ser do árbitro) |
| `encostadaVrelMais` | `ACOES.boteIA.encostadaVrel` (1,0 m/s) — somado | **+0,4** (1,0 → 1,4) | A bola encostada no marcador é disputada com os dois andando um pouco mais rápido um do outro: mais "corpo a corpo". Opcional (medir com e sem) |
| `chegaCompanheiros` | `DEFESA_HUMANO.semAtropelar.chega` (1,0 m/s) — só os companheiros da pessoa, o controlado não | **1,5** | O time da pessoa também entra pegado (o clássico é dos dois). Cuidado com o B2 do `teste-faltas-sentido` (carga do controlado: ele fica de fora) |

**NÃO mexer:** `ACOES.boteIA.alcance`/`colada`/`bolaSolta` (física do alcance), `FALTAS.*` inteiro (bote, força, carga,
tática, temerário, excessivo, carrinho, vantagem, DOGSO, SPA), a `chanceDividida` do humano, `IA_DEFESA.engaja`,
`IA_PESSOA.engaja/encurta`, `IA_DEFESA.contrapressao`, `TATICA.recomp`, `IA_DEFESA.livre`, o cabeceio e o aéreo (duelos
aéreos +8% n.s. no real). **Falta tática** (`FALTAS.tatica`): é decisão do jogador, mas não há dado real separado dela e
mexer muda a fração falta ÷ contato e os amarelos por SPA — fora da v1 (anotar). A IA não usa o carrinho (item 75).

**Valores iniciais, não finais:** a resposta do número de botes à vontade não é linear (o bote só sai com a bola ao
alcance e solta do pé — janelas curtas); calibrar com a triagem `--set` em 32–40 sementes (lição do D8) e conferir nas
rodadas de 8, sempre olhando o painel junto (faltas, cartões, gols, chutes, bola rolando).

### 3.3 Como o clássico combina com a dificuldade (item 33)

A `DIFICULDADE` vale só no time da IA contra a pessoa (`nivelContra`); o clássico vale em todo jogador da IA dos dois
times. No time da IA contra a pessoa os dois se somam NA MESMA conta, aplicados sobre o valor do nível:

| Nível | bote por passo sem → com clássico | descanso (passos) | contenção na Média (m) | contenção na Alta (m) |
|---|---|---|---|---|
| Fácil | 0,025 → 0,035 | 110 → 79 | 3,75 → 3,25 | 2,50 → 2,00 |
| Normal | 0,080 → 0,110 | 45 → 32 | 2,75 → 2,25 | 1,50 → **1,25 (piso)** |
| Difícil | 0,120 → 0,164 | 34 → 24 | 2,35 → 1,85 | 1,25 → 1,25 (piso) |
| Lenda | 0,220 → 0,294 | 20 → 14 | 2,15 → 1,65 | 1,25 → 1,25 (piso) |

- **Não satura:** o bote como taxa nunca passa de 1 e muda menos onde já é alto (Lenda: o tempo médio até o bote cai de
  4,5 para 3,4 passos — o ganho no Lenda vem da contenção, que tem piso); o descanso tem piso de 12 passos; a contenção, o
  piso de 1,25 m (o mesmo da dificuldade).
- **A ordem dos níveis fica:** Fácil + clássico (0,035 / 79 / 3,25) continua abaixo do Normal sem clássico; Normal +
  clássico (0,110 / 32 / 2,25) fica perto do Difícil sem clássico **só no bote** (o Difícil tem também engaja, encurta,
  contrapressão e a vontade de chutar, que o clássico não mexe).
- **Teste da combinação:** Lenda + clássico com os vermelhos ≤ 0,2 por partida e as faltas da IA na pessoa dentro da meta;
  a ordem Fácil+C < Normal+C < Difícil+C < Lenda+C nos botes.

### 3.4 Metas do `teste-classico` (pareado: as mesmas sementes com e sem o clássico)

Amostra: o jogo tem ~2,6 faltas, ~0,47 amarelo e ~0,08 vermelho por partida (Etapa 4). Com 48 partidas são ~125 faltas
na base: o intervalo de 95% da razão fica em ±24% — curto para uma faixa de +25% a +50%. **Usar 96 partidas** (±17%) ou
reprovar SÓ quando a contagem prova (razão de Poisson, p < 5%), como no D8.

| # | Medida | Meta | Base real |
|---|---|---|---|
| C1 | Botes da IA (roubada da IA + `boteErrado` + falta de bote + bote evitado — este não tem evento: contar na lógica instrumentada, como a `copiaInstrumentada` do D3) | **+25% a +50%** (reprova se provar < +20% ou > +60%) | disputas reais ≈ +7% (desarmes +4%); no jogo, com o árbitro igual, as faltas só sobem pelo contato → os botes têm de subir quase o mesmo que as faltas |
| C2 | Faltas por partida | **+25% a +50%** (reprova se provar < +20% ou > +60%) | média real +11% [+8; +14] (imperceptível em 8 min: 2,6 → 2,9); clássicos quentes +25% a +50% (jogos isolados até +60%) |
| C3 | Chance de falta POR CONTATO (o árbitro) | **±10%**, medida (a) pela média da chance CALCULADA (`chanceFaltaBote × fatorForca` e a da carga) em cada contato, sem sorteio, e (b) estratificada por chegada (frente/lado/trás) | real: falta ÷ disputa +4% [+2; +6] (226 clássicos). A mutação "árbitro ×1,3 no clássico" tem de reprovar |
| C4 | Amarelos por partida | **+20% a +60%**; amarelo por falta 0% a +20% (só pela chegada mais rápida) | +30% [+23; +37], teto +43–50%; amarelo por falta +15% [+10; +21] (parte pode ser do árbitro) |
| C5 | Vermelhos | **≤ 0,2 por partida** (reprova se provar > 0,2); também no Lenda + clássico | +40% [+5; +88] junto, puxado pela Argentina (+167%); Brasil +3%, Europa +31% (n.s.) |
| C6 | Gols | sem queda provada > 25% nem alta provada > 10% | −7% [−14,5; +1] |
| C7 | Chutes | sem queda provada > 15% | −4,6% [−7; −2] |
| C8 | Bola rolando | −2% a −8%; reprova se provar queda > 10% | −4% [−6; −1] |
| C9 | Intensidade (m/min, PPDA do `teste-pressao`, `medir-corrida`) | não sobe além de +5% | pressão por minuto 0% (±6%) |
| C10 | Sem o clássico | `hash-igual`/`hash-partida` IGUAIS; com ele, DIFERENTE | — |
| C11 | Combinação com a dificuldade | ordem dos níveis nos botes; Lenda + C nos vermelhos | §3.3 |

**Decisão de produto (do dono):** a FILA pedia faltas +30–60%. Os dados dizem: a média real é +11% (numa partida de
8 min, 2,6 → 2,9 faltas — ninguém percebe) e o "clássico quente" é +25% a +50%; +60% só em jogos isolados. Proponho a
faixa do clássico quente (+25% a +50%, centro +35%); se o dono quiser o realista médio, é só baixar a `vontade` e a
contenção, sem mudar o resto.

Também: o `teste-ponte-tm` (o campo `partida.classico` do pedido chega em `m.classico`; sem o campo, nada muda), o
`teste-faltas`, o `teste-faltas-sentido` (B2: o controlado não muda) e o `teste-cenas` (cenas de cartão com mais cartões).

### 3.5 O que não confirmei / riscos

- **Não separei de vez o jogador do árbitro** na fração falta ÷ disputa (+4% [+2; +6]) e no amarelo ÷ falta (+15% [+10; +21]): os dados
  públicos não dizem quem apitou mais duro. Os estudos que controlam o árbitro (Kilduff; Kruse & Maennig) dizem que o
  efeito continua — mas eles medem cartões, não faltas.
- **Duelos 1 × 1 (Opta "duels")** não estão na ESPN; usei os desarmes. Os "50/50" do StatsBomb caíram 30% no clássico, mas
  são poucos (2–3 por jogo) — não usei.
- **Bola rolando** é estimativa pelos eventos (os comuns dão ~54,7 min, um pouco abaixo dos números oficiais das ligas);
  serve para a diferença, não para o valor. Não achei o tempo útil oficial de clássicos brasileiros.
- **As páginas do HSAC** saíram do ar (404): os números (25,95 × 22,38; IC +1,4 a +5,7) vêm dos trechos da busca.
- **Buraimo et al. 2010** tem a variável de dérbi, mas não consegui o coeficiente; **Gitmez et al. 2020** (Liverpool,
  dérbi × não dérbi) não li.
- **Jogos:** nenhum documento oficial da EA, da Konami ou da SI descreve um efeito de clássico na jogabilidade; o que
  está na tabela do §2 são os controles separados (agressividade × árbitro), não um "modo clássico".
- **Os valores do §3.2 são o ponto de partida** — a resposta dos botes à vontade e à contenção precisa ser medida; se
  `vontade` 1,4 + contenção não chegarem a +25%, subir primeiro a contenção/aperto (mais janelas) antes da vontade (no
  Lenda a vontade já satura).
- A ESPN não listou 26 partidas do Brasileirão 2024; 69 (Brasil) e 139 (Argentina) vieram sem desarmes/passes (fora da
  conta). A fração falta ÷ disputa BRUTA engana quando os clássicos são de times que fazem pouca falta (Espanha: bruta
  −0,5%, ajustada +9,7%) — usar a ajustada.
- Os conjuntos por liga têm poucos clássicos (15 a 82); só o resultado junto (226) tem intervalo curto. A definição de
  "clássico" é minha (mesma cidade/região + as rivalidades históricas); os grupos B (outras rivalidades, jogos entre
  grandes) quase não mudam — o efeito é da rivalidade forte.

---

## 4. Reproduzir

```bash
D=<pasta para os dados>   # (fora do repositório)
mkdir -p $D/sb $D/espn
# StatsBomb: resumo de cada partida (eventos lidos direto do GitHub, nada gravado além do resumo; ids.txt = os ids das
# partidas das 5 ligas 2015/16, da lista data/matches/ do open-data)
cat $D/sb/ids.txt | xargs -P 2 -I{} sh -c 'curl -sS https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/{}.json | python3 -I tools/pesquisa/classico_resumo_partida.py {}' > $D/sb/resumos.jsonl
python3 -I tools/pesquisa/classico_analise_sb.py $D --duplo
# ESPN: coleta (liga, início, fim, saída; acrescenta só o que falta) e análise (bra, arg, eng, esp, ita)
python3 -I tools/pesquisa/classico_espn_coleta.py bra.1 2025-03-28 2025-12-08 $D/espn/bra.jsonl
python3 -I tools/pesquisa/classico_analise_espn.py $D/espn/bra.jsonl bra --duplo --json=$D/espn/res_bra.json
python3 -I tools/pesquisa/classico_analise_espn.py $D/espn/ita.jsonl,$D/espn/ita23.jsonl ita --duplo --json=$D/espn/res_ita.json
# junto (variância inversa no log da razão)
python3 -I tools/pesquisa/classico_junta.py $D/sb/res_A.json $D/espn/res_bra.json $D/espn/res_arg.json $D/espn/res_eng.json $D/espn/res_esp.json $D/espn/res_ita.json
```

---

## 5. A medida de base no jogo (29d67bad, antes do clássico)
**Como:** uma cópia da lógica da base com ganchos que SÓ LEEM (o molde do `tools/lib/classico-medidas.mjs`): o começo de cada
contato de corpo entre adversários (`sim.js colisaoCorpos`), a OPORTUNIDADE (tick com a bola ao alcance, depois do descanso e
da trava da bola colada) e a TENTATIVA (passou o `chancePorPasso`) do `boteIA`, o desfecho do `faltaNoBote` e o `p` que o
árbitro calcula no bote (`pb·ff`), na carga e na DIVIDIDA. Partidas de 2 × 4 min (sementes 1001–1024 por modo; 2 processos;
120 partidas em 602 s): `demo` = IA × IA (a IA pelo controlado do time 0, os dois times somados) e os 4 roteiros
(`tools/lib/humano-roteiro.mjs`: o time 0 é a pessoa, a IA é o time 1); ± = 95% da média por partida (1,96·dp/√n); as razões
das sondas por bootstrap pareado pelas sementes. As ferramentas dessa medida viraram o `tools/lib/classico-medidas.mjs` e o
`tools/teste-classico.mjs` (o `--set` e a opção do clássico).

### 5.1 Base, por partida (2 × 4 min)

| medida | demo IA × IA (24) | agressivo (24) | conduz (24) | calmo (24) | passivo (24) | 4 roteiros (96) |
|---|---|---|---|---|---|---|
| bola rolando (min) | 7,94 ± 0,08 | 7,47 | 7,41 | 7,69 | 7,53 | 7,52 ± 0,05 |
| contatos de corpo (começos, 2 times) | 146,8 ± 9,2 | 158,1 | 162,9 | 173,1 | 144,7 | 159,7 ± 4,9 |
| … por min rolando · com o condutor | 18,5 · 21,8 | 21,2 · 31,2 | 22,0 · 37,0 | 22,5 · 48,3 | 19,2 · 31,2 | 21,2 · 36,9 |
| IA: oportunidades (ticks) | 80,5 ± 12,9 | 179 | 326 | 244 | 137 | 221,5 ± 20,8 |
| IA: TENTATIVAS de bote | 5,96 ± 0,96 | 14,1 ± 1,6 | 25,8 ± 2,3 | 18,9 ± 2,2 | 11,9 ± 1,6 | 17,66 ± 1,43 |
| … por min rolando | 0,75 | 1,89 | 3,48 | 2,45 | 1,58 | 2,35 |
| … frente / lado / trás (%) | 71 / 22 / 8 | 66 / 20 / 14 | 83 / 12 / 5 | 68 / 21 / 11 | 81 / 10 / 8 | 75 / 16 / 9 |
| … lento · encostada (%) | 8 · 19 | 24 · 22 | 12 · 25 | 27 · 35 | 19 · 42 | 20 · 30 |
| desfecho: falta / semGanhar / limpo / evitado (%) | 16,1 / 16,1 / 67,1 / 0,7 | 16,6 / 12,2 / 71,2 / 0 | 7,9 / 6,3 / 85,1 / 0,6 | 7,3 / 15,7 / 77,0 / 0 | 5,3 / 15,8 / 78,9 / 0 | 9,0 / 11,6 / 79,2 / 0,2 |
| **p médio do árbitro por bote** [IC 95%] | 17,4% [12,5–22,2] | 15,8% [12,4–19,7] | 8,4% [6,4–10,6] | 8,0% [6,3–9,8] | 5,5% [3,6–7,3] | 9,3% [8,0–10,7] |
| **faltas ÷ botes avaliados** [IC 95%] | 16,1% [10,2–21,9] | 16,6% [12,1–21,2] | 7,9% [5,8–10,2] | 7,3% [5,2–9,5] | 5,3% [3,1–7,7] | 9,0% [7,6–10,6] |
| IA: cargas avaliadas (p médio) | 1,42 (42,9%) | 0,83 (44%) | 1,46 (16,9%) | 0,75 (47,8%) | 0,83 (46%) | 0,97 (34,9%) |
| IA: roubadas no bote · boteErrado | 3,92 · 1,04 | 9,00 · 2,75 | 20,7 · 2,88 | 12,3 · 5,25 | 8,29 · 2,96 | 12,56 · 3,46 |
| **IA: FALTAS** | 2,21 ± 0,61 | 3,29 ± 0,75 | 3,71 ± 0,89 | 1,92 ± 0,47 | 1,13 ± 0,46 | 2,51 ± 0,39 |
| … bote / carga / tática / segurar | 0,96 / 0,50 / 0,29 / 0,46 | 2,33 / 0,38 / 0,13 / 0,46 | 2,04 / 0,25 / 0,54 / 0,88 | 1,38 / 0,38 / 0,04 / 0,13 | 0,63 / 0,38 / 0 / 0,13 | 1,59 / 0,34 / 0,18 / 0,40 |
| IA: amarelos · vermelhos · pênaltis | 0,58 · 0,04 · 0,29 | 0,29 · 0,04 · 0 | 0,96 · 0,13 · 0,25 | 0,13 · 0 · 0,04 | 0,29 · 0 · 0 | 0,42 ± 0,14 · 0,04 (4 em 96) · 0,07 |
| time da pessoa: botes dos companheiros · faltas (da DIVIDIDA) | — | 1,00 · 2,25 (1,83) | 1,13 · 2,13 (1,67) | 1,00 · 1,88 (1,58) | 1,08 · 0,29 (0) | 1,05 · 1,64 (1,27) |
| gols (IA × pessoa) | 1,92 ± 0,47 (2 times) | 1,04 × 0,17 | 0,50 × 1,17 | 0,54 × 0,13 | 1,50 × 0 | 0,90 × 0,36 |
| chutes (IA × pessoa) | 8,88 ± 1,13 (2 times) | 4,00 × 1,79 | 2,00 × 8,25 | 3,00 × 0,83 | 9,75 × 0,29 | 4,69 × 2,79 |

Leituras:
- **A falta de bote é minoria na IA × IA**: 43% das faltas (0,96 de 2,21); carga 23%, tática+segurar 34%. Contra os
  roteiros, 63% (1,59 de 2,51). Com a chance por contato igual, +25% de botes dá só **+11% de faltas na IA × IA e +16%
  contra os roteiros**; para +30% de faltas só pelo bote seriam precisos **+69% (IA × IA) / +47% (roteiros) de botes**.
- **A chance por contato depende de QUEM conduz e COMO**: 5–17% por bote conforme o roteiro (o 'conduz' e o 'passivo'
  levam o bote de frente/lento, `FALTAS.bote.lento` 0,4 e `frente` 0,2). A razão global muda com a MISTURA: compare
  estratificado por roteiro, pareado pelas sementes.
- **Precisão**: com 96 partidas a chance por contato tem IC de ±15% relativo (9,3 [8,0–10,7]) — o "±10%" não se PROVA
  com amostra viável; dá para reprovar quando o IC da razão clássico/sem PROVAR que está fora de [0,9; 1,1]. O estimador
  de menor variância é o p médio do árbitro (Σp ÷ N, a mesma régua: segue o realizado — 17,4 × 16,1, 9,3 × 9,0) — exige
  a lógica instrumentada (ou recalcular o p pela foto antes do passo, como o `tools/lib/faltas-registro.mjs`).
- **Sem instrumentar**, as tentativas ≈ `roubada {ia}` + `boteErrado` + `falta {origem:'bote'}` dos defensores do time
  (o `BOTE_EVITADO` não tem evento: 0–0,7% das tentativas). Confere: 3,92 + 1,04 + 0,96 = 5,92 × 5,96 (demo); 12,56 +
  3,46 + 1,59 = 17,61 × 17,66 (roteiros). (O teste-dificuldade conta botes = roubada{ia} + boteErrado — SEM as faltas.)
- Ritmo real (PL 2024/25, citado no teste-faltas-sentido): ~0,40 falta por min de bola rolando. A IA × IA faz 0,28
  (2,21 ÷ 7,94): **+30–60% leva a 0,36–0,45, em volta do real** — a faixa da FILA é coerente com o futebol.
- Cartões e pênaltis são raros: vermelhos 1 em 24 (demo) e 4 em 96 (roteiros; 3 deles no 'conduz'); pênaltis 0,29
  (demo, 2 times) e 0,25 no 'conduz'. A guarda "vermelhos ≤ 0,2" tem folga, mas só se prova com Poisson e 48+ partidas.
- Amostra: botes ±16% (demo, 24) e ±8% (roteiros, 96); faltas ±28% (demo, 24) e ±16% (roteiros, 96). Para ver +25% de
  botes, 48+ partidas por braço; para a faixa de faltas +30–60%, ~100 por braço (ou juntar demo + roteiros). As sementes
  pareadas ajudam pouco (a partida diverge em segundos; ver os IC das sondas).

### 5.2 Sondas (IA × IA, 16 sementes pareadas 1001–1016; razão sonda/base [IC 95%])

| sonda (`--set`) | oportunidades | tentativas | faltas (todas) | faltas de bote | tática+segurar | amarelos | vermelhos | p médio/bote | gols · chutes |
|---|---|---|---|---|---|---|---|---|---|
| `chancePorPasso` 0,12, `descanso` 30 (×1,5) | 0,81 [0,67–1,00] | **1,23** [0,98–1,58] | 0,84 [0,61–1,07] | 1,00 [0,63–1,50] | 0,54 [0,13–0,82] | 1,38 | 0 × 0 | 17,6 × 18,8% | 0,77 · 0,83 |
| `chancePorPasso` 0,16, `descanso` 22 (×2) | 0,55 [0,42–0,70] | **1,34** [0,98–1,88] | 1,05 [0,71–1,50] | 1,56 [0,79–3,36] | 0,54 [0,25–0,91] | 0,88 | 2 × 0 | 19,3 × 18,8% | 1,00 · 1,09 |
| `IA_DEFESA.contencao` [5; 2,25; 1,25] + `engaja` [48, 72, 105] | 1,00 | 1,05 [0,83–1,42] | 1,03 | 0,88 | 1,15 | 1,25 | 0 × 0 | 12,8 × 18,8% | 1,03 · 1,19 |
| ×1,5 + `aperto` [1,0; 0,9; 0,5] + `perigo` 36 + `gatilhos.janela` 2 | 0,67 [0,53–0,86] | 1,01 [0,77–1,33] | 0,95 [0,67–1,38] | 0,88 | 1,00 | 2,00 [1,00–5,33] | 2 × 0 | 17,5 × 18,8% | 1,03 · 1,19 |

(16 partidas: IC largos — são indicação para a triagem, não decisão.)

1. **A vontade satura também na IA × IA**: ×1,5 na chance → +23% de botes, ×2 → +34%; as oportunidades CAEM 19% e 45%
   (o bote mais cedo acaba a janela). O "≥ +25%" fica no limite só pela vontade (×2 ou mais, com o descanso junto).
2. **As faltas não acompanham**: o bote mais cedo tira as faltas de quem foi BATIDO (tática+segurar ×0,54 nas duas) e o
   total fica em 0,84–1,05. Mais vontade de bote, sozinha, não dá +30–60% de faltas.
3. **A aproximação (contenção, engajamento, aperto, gatilhos) não criou oportunidade na IA × IA** — com o aperto mais
   perto as oportunidades caíram 33% (hipótese, não provada: o condutor da IA solta a bola mais cedo sob pressão — o risco
   do passe e o `manter` do ia-ataque.js; rastrear tick a tick antes de calibrar). A sonda de contenção/engajamento mudou
   a MISTURA dos botes (p médio 18,8 → 12,8%): é ela que ameaça a meta "chance por contato igual".
4. A chance por contato fica igual quando só a VONTADE muda (17,5–19,3 × 18,8%) — o caminho limpo para o "árbitro igual".
5. Os cartões oscilam muito (amarelos 0,88–2,00×; 2 vermelhos em 16 em duas sondas): as guardas de cartão precisam de
   amostra grande e teste que reprova quando prova.

**Consequência para o plano (decisão a levar ao dono se se confirmar com 48+ partidas):** "botes ≥ +25%" e "faltas
+30–60%" com a "chance por contato igual" só fecham se o clássico criar contato que NÃO substitui outro (o bote mais cedo
substitui a falta do batido). Caminhos do lado do JOGADOR, cada um com custo: (a) vontade do bote bem acima de ×2 (satura;
o Lenda contra a pessoa já está em 0,22/20); (b) o batido que continua no condutor (`IA_DEFESA.corrida.batido/batidoPaga`)
e a falta tática como decisão do jogador (`FALTAS.tatica.chancePorPasso/semSPA` — está no faltas.js e cada tática no
ataque promissor é AMARELO: os cartões sobem junto e a mistura vai para 'tras', p mais alto); (c) o lado de quem conduz
também "pegado" (segura mais a bola sob pressão = mais duelos; mexe no ataque da IA); (d) baixar a faixa de faltas para
o que a vontade dá (+10–25%). Nenhuma sonda aqui testou (b)–(c).

---

## 6. O que entrou e a calibração

### 6.1 A triagem (o §3 da especificação)

`teste-classico --so medida --sem-dif --sementes 8 --demo 32 --sem0 1001` = **64 partidas por braço** (demo 1001–1032 + 4
roteiros × 1001–1008), pareadas com o braço sem o clássico jogado uma vez e reaproveitado (`--sem-de`); razão com ÷ sem
[p5–p95 do bootstrap pareado e estratificado por modo]. "Faltas esperadas" = Σ p do árbitro (bote · cuidado, carga, passo do
batido que segura); "chance por contato" = Σ p ÷ N nos botes e cargas avaliados (o C3b).

| variação | botes | faltas esperadas | faltas marcadas | chance por contato (só o bote) | amarelos | vermelhos com | gols | chutes | volume | presença |
|---|---|---|---|---|---|---|---|---|---|---|
| inicial: vontade 1,4 + contenção −0,5 m + aperto −0,4 m | 1,04 [0,95–1,14] | 1,14 [1,01–1,30] | 0,98 [0,81–1,18] | 1,16 [1,01–1,32] (1,17 [1,01–1,34]) | 1,18 [0,80–1,81] | 5 em 64 | 0,89 [0,74–1,07] | 1,03 [0,93–1,13] | 1,00 [0,99–1,02] | 0,96 [0,94–0,99] |
| T1 vontade 1,8 | 1,12 [1,05–1,20] | 1,03 [0,92–1,15] | 0,91 [0,76–1,10] | 1,01 [0,88–1,15] (1,03 [0,89–1,18]) | 0,96 [0,60–1,56] | 0 em 64 | 0,94 [0,78–1,11] | 0,99 [0,92–1,08] | 1,00 [1,00–1,01] | 0,98 [0,96–1,00] |
| T1 vontade 2,2 | 1,25 [1,15–1,36] | 1,06 [0,95–1,19] | 1,12 [0,93–1,35] | 0,96 [0,84–1,11] (1,02 [0,87–1,19]) | 1,32 [0,85–2,00] | 7 em 64 | 1,07 [0,90–1,28] | 0,97 [0,89–1,06] | 0,99 [0,98–1,00] | 0,97 [0,95–0,99] |
| T3 vontade 1,8 + encostada +0,4 m/s | 1,19 [1,11–1,27] | 1,07 [0,96–1,19] | 0,99 [0,84–1,18] | 1,01 [0,89–1,14] (1,03 [0,90–1,18]) | 0,96 [0,61–1,50] | 3 em 64 | 0,96 [0,81–1,14] | 0,95 [0,87–1,04] | 1,00 [0,99–1,01] | 0,98 [0,96–1,01] |
| T4 vontade 1,8 + segura 2 | 1,10 [1,02–1,19] | 1,19 [1,06–1,33] | 1,14 [0,96–1,35] | 1,03 [0,89–1,19] (1,06 [0,91–1,23]) | 1,25 [0,82–1,95] | 0 em 64 | 0,90 [0,76–1,06] | 1,00 [0,93–1,09] | 1,00 [0,99–1,01] | 0,97 [0,95–0,99] |
| vontade 2,2 + encostada + segura 2 | 1,22 [1,13–1,31] | 1,28 [1,16–1,43] | 1,32 [1,12–1,57] | 1,08 [0,93–1,25] (1,14 [0,98–1,34]) | 1,04 [0,69–1,57] | 4 em 64 | 0,95 [0,79–1,14] | 0,95 [0,86–1,04] | 1,00 [0,99–1,01] | 0,98 [0,95–1,00] |
| vontade 2,6 + encostada + segura 2 | 1,27 [1,18–1,37] | 1,43 [1,29–1,57] | 1,45 [1,22–1,72] | 1,14 [0,99–1,31] (1,21 [1,03–1,41]) | 1,57 [1,06–2,42] | 5 em 64 | 0,88 [0,73–1,05] | 0,95 [0,87–1,04] | 1,00 [0,99–1,00] | 0,97 [0,95–1,00] |
| **vontade 2,6 + segura 2 (a escolhida)** | 1,25 [1,16–1,35] | 1,36 [1,24–1,50] | 1,34 [1,12–1,61] | 1,12 [0,98–1,28] (1,17 [1,00–1,36]) | 1,25 [0,81–1,95] | 6 em 64 | 1,03 [0,88–1,21] | 1,01 [0,92–1,10] | 1,00 [0,99–1,01] | 0,97 [0,95–0,99] |
| a escolhida, OUTRAS sementes (3001–3032 + 4 × 3001–3008) | 1,32 [1,22–1,42] | 1,39 [1,24–1,57] | 1,49 [1,27–1,77] | 1,01 [0,90–1,14] (1,07 [0,94–1,22]) | 1,52 [1,05–2,15] | 5 em 64 | 0,91 [0,75–1,11] | 1,09 [0,98–1,20] | 0,99 [0,98–1,00] | 0,96 [0,93–0,98] |

Leituras:
- **A vontade satura** (confirma a sonda do §5.2): o bote mais cedo FECHA a janela — as oportunidades (passos com a bola ao
  alcance) caem 33% com 1,8 e ~45% com 2,6 —, então ×2,4 na chance por passo (0,08 → 0,195) dá +25–32% de botes.
- **O bote substitui a falta do batido:** com a vontade sozinha os botes sobem e as faltas esperadas ficam em +3–6% (o batido que
  segurava não fica mais colado atrás do condutor: a tática+segurar marcada caiu de 0,72 → 0,31 por partida na demo com 1,8). A
  porta de decisão da especificação só abriu com o `segura` (a decisão do batido; o apito e o cartão iguais): com ele, as faltas
  PROVADAS acima de +20% nas duas amostras.
- **A contenção e o aperto mais perto pioram:** menos botes (+4%: o condutor solta a bola antes) e a chance por contato +16%
  (o 1º homem colado chega com o corpo: as faltas esperadas de carga contra os roteiros subiram de 0,25 para 0,41 por partida)
  — saíram.
- **A bola encostada** (+0,4 m/s na diferença de velocidade) dá só +2–7% de botes e sobe a chance por contato (o contato com
  força): saiu.
- **A chance por contato sobe um pouco com a vontade alta** (o bote sai no começo da janela, com o defensor ainda chegando:
  `porVel` e `fatorForca` da MESMA régua): 1,12 e 1,01 nas duas amostras (só o bote 1,17 e 1,07) — dentro do "reprova só quando
  prova" de [0,90; 1,10]; o real dá +4% [+2; +6]. É o "bote mais forte" do pedido no sentido de mais decidido, não de mais veloz.
- **O resto não mexe:** volume de corrida 0,99–1,00, disparada 1,00, presença perto do condutor −3–4% (o bote mais cedo acaba a
  pressão mais cedo), gols 0,91–1,03 e chutes 1,01–1,09 (nenhum lado provado), bola rolando 1,00 e 0,98 (a parada da falta).

### 6.2 O que entrou

`config.js CLASSICO = { vontade: 2,6, descansoMin: 16, boteTeto: 0,26, segura: 2 }` (as chaves da especificação
`contencaoMenos`, `apertoMenos` e `encostadaVrelMais` saíram com o código delas). Por nível (chance por passo / descanso):
Fácil 0,025/110 → 0,064/42; Normal 0,080/45 → 0,195/17; Difícil 0,120/34 → 0,26/16 (teto/piso); Lenda 0,22/20 → 0,26/16. O
Fácil+C continua abaixo do Normal sem clássico (0,064 < 0,08); Difícil+C e Lenda+C ficam iguais no bote (o teto do envelope
do item 33) — o Lenda continua acima pelo resto da dificuldade (engaja, encurta, contenção, contrapressão).
