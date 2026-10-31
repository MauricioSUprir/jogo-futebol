# Pesquisa — Etapa 4 (goleiro, regras IFAB, bolas paradas e equilíbrio)

Fontes consultadas antes de mexer e o que foi aproveitado de cada uma. A Etapa 4 sai em PRs menores; cada parte acrescenta
a sua seção aqui.

## 1. Painel de equilíbrio (seção 11 do pedido do dono)

| Fonte | O que diz | Onde entrou |
|---|---|---|
| Pedido do dono, seção 11 | Gols 2,3–3,5; conversão 9–14%; ~1/3 dos chutes no alvo; 35–40% de fora da área; ≤ 15% de 25 m ou mais; 12–18% dos gols de fora; passe 75–88%; 35–45% das posses no último terço; ≥ 1 impedimento; pênaltis ~76/18/6%; origem dos gols realista. Decidir com 144+ partidas | `tools/painel-equilibrio.mjs` mede tudo de uma vez, com o intervalo de 95% da média de gols |
| Pedido do dono, seção 8 | Goleiro: 66–72% de defesas no alvo, ~85% de fora da área, 55–60% de 6 a 16,5 m | Linhas do goleiro por distância no painel |
| The Analyst (Opta), temporada 2025/26 da Premier League | 27,4% dos gols de bola parada sem pênalti (20,6% em 2024/25) | Faixa 20–30% para a origem "bola parada" |
| The Analyst (Opta), pressão alta 2025/26 | 13–15 recuperações altas por jogo; ~16% terminam em chute | Definição de "erro na saída de bola" (recuperação a ≤ 40 m do gol e gol em ≤ 15 s; "high turnover" da Opta) |
| StatsBomb, "play pattern" | O gol herda o padrão da posse: escanteio, falta, lateral, contra-ataque, jogo corrido | Origem do gol pela posse que terminou nele |

**Linha de base da publicada** (144 partidas, sementes 1001–1144, antes da Etapa 4):

| Medida | Meta | Publicada |
|---|---|---|
| gols por partida | 2,3–3,5 | 2,11 ± 0,22 |
| chutes por partida | — | 9,8 |
| conversão | 9–14% | 20,7% |
| no alvo | ~1/3 | 63,1% |
| de fora da área | 35–40% | 27,2% |
| de 25 m ou mais | ≤ 15% | 5,8% |
| gols de fora da área | 12–18% | 6,5% |
| passe certo | 75–88% | 88,9% |
| posses no último terço | 35–45% | 48,0% |
| goleiro no alvo / 6–16,5 m / ≥ 16,5 m | 66–72 / 55–60 / ~85% | 67,3 / 57,6 / 88,9% |
| origem: trabalhada / contra / erro na saída / bola parada | — | 30 / 11 / 40 / 18% |

O que falta (para a parte do equilíbrio): **poucos chutes e precisos demais** — 9,8 chutes com 63% no alvo; para 2,3–3,5
gols com 9–14% de conversão são ~20–30 chutes por partida, mais de fora da área e menos no alvo. E 40% dos gols saem de
bola roubada perto da área adversária (a pressão alta da IA intensa).

## 2. Impedimento (IFAB Regra 11) e acréscimos (Regra 7)

| Fonte | O que diz | Onde entrou |
|---|---|---|
| IFAB, Leis do Jogo 2025/26 e 2026/27, Regra 11 (texto da The FA) | Posição de impedimento: qualquer parte da cabeça, do corpo ou dos pés no campo adversário (sem a linha do meio) e mais perto da linha de fundo que a bola e o penúltimo adversário; mãos e braços não contam; na mesma linha não é impedimento | `impedimento.js` `linhaImpedimento` (penúltimo adversário com o goleiro, a bola ou o meio) e `IMPEDIMENTO.tolerancia` (0,1 m: "na mesma linha"). O corpo é o centro do jogador (não há cabeça/pés na física) |
| idem, Regra 11.2 | A posição vale no instante em que o companheiro joga ou toca a bola; infração só se ele se envolve: joga/toca a bola, interfere no adversário, ou ganha vantagem no rebote da trave, do travessão, de um adversário ou de uma DEFESA deliberada | Foto da jogada (`fotografar`) a cada passe/chute e enquanto um companheiro tem a bola; infração quando um impedido da foto toca a bola — inclusive no rebote de uma defesa e no desvio no corpo de um adversário. "Interferir no adversário" sem tocar a bola fica de fora (sem visão/bloqueio na simulação) |
| idem, jogada deliberada | Receber de um adversário que jogou a bola deliberadamente (controle com possibilidade de passar, ganhar ou afastar a bola) não é ganhar vantagem — a não ser que seja uma defesa | Domínio, passe, chute ou bote do adversário zera a foto; defesa do goleiro e bola no corpo não zeram |
| idem, Regra 11.3 | Não há impedimento recebendo direto de tiro de meta, lateral ou escanteio | `SEM_IMPEDIMENTO`: a cobrança desses três zera a foto; a próxima jogada do time fotografa de novo |
| idem, Regra 11.4 | Tiro livre indireto onde a infração ocorreu, inclusive no próprio campo | `partida.js` `marcarImpedimento`: tiro livre indireto do outro time no ponto do toque; adversários a 9,15 m (Regra 13); a IA cobra com passe, nunca para quem está impedido |
| Frontiers in Psychology 2021 (Opta/WhoScored, 5 grandes ligas 2009/10–2018/19) | O número de impedimentos por jogo caiu na década e mais com o VAR; a Premier League tem menos que La Liga e Bundesliga | Meta do dono (≥ 1 por partida de 8 min reais) mantida; a IA não foi feita para errar de propósito |
| Premier League (dados oficiais de tempo de jogo) | Partida média de 101 min 43 s em 2023/24 e 99 min 56 s em 2024/25 (~10–12 min de acréscimo nos dois tempos); desde 2024/25 os primeiros 30 s de cada comemoração não contam | `PARTIDA.acrescimos`: base sorteada 1–3 min (1º T) e 3–5 min (2º T) + 0,5 min por gol + 0,25 min por substituição, até 5 e 10 min |
| IFAB, Regra 7.3 | O árbitro repõe o tempo perdido com substituições, atendimento, cera, sanções, comemorações, VAR etc. | O que conta nos acréscimos (gols e substituições do tempo; o impedimento não para) |
| Gramática de transmissão (linha de impedimento do VAR/replay) | A linha de impedimento aparece no replay da marcação; no jogo ao vivo alguns jogos mostram uma linha discreta | Linha viva amarelo-clara (branca se confundia com as linhas do campo) e a linha do lance parada, amarela, por 2,2 s no apito — sem texto na tela (sem narração) |

**Decisão da IA.** A enfiada para quem já passou da linha foi tirada (seria impedimento certo): com 48 partidas, os
impedimentos foram de 1,33 para 1,15 por partida, e os gols e chutes ficaram iguais dentro da variação. O passe rasteiro
para quem está impedido continua valendo 0,3× (`IA_ATAQUE.utilidade.impedido`): é a leitura errada que gera os
impedimentos de verdade, junto com o corredor que passa da linha enquanto o passe sai.

## 3. Faltas, vantagem, cartões e pênalti (IFAB Regras 12 e 14)

| Fonte | O que diz | Onde entrou |
|---|---|---|
| IFAB, Leis do Jogo 2026/27, Regra 12.1 (texto da The FA) | Tiro livre direto por carga, bote, rasteira, empurrão... **imprudente** (sem cuidado: sem cartão), **temerário** (sem ligar para o perigo: amarelo), **força excessiva** (põe o adversário em risco: vermelho); segurar e impedir com contato também | `faltas.js`: bote, dividida, carga por trás e falta tática (segurar); grau pela chegada e velocidade (`FALTAS.temerario` 6 m/s por trás; força excessiva sorteada acima de 7,6 m/s) |
| idem, Regra 12.3 (cautelas) | Amarelo por parar um ataque promissor (SPA) | `ataquePromissor`: dominando a bola no campo de ataque (≥ 10 m do meio), indo para a frente a ≥ 3,5 m/s, com ≤ 2 defensores de linha à frente |
| idem, Regra 12.4 (DOGSO, 4 critérios) | Distância ao gol, direção do jogo, chance de controle, defensores; na própria área, tentando jogar a bola: amarelo (e o pênalti); segurar/empurrar na área: vermelho; 2º amarelo = vermelho | `chanceClara` (≤ 30 m, indo para o gol, dominando, ninguém de linha no cone até o gol) e `montarFalta` (cartão pela origem: bote/dividida tentam a bola; carga/tática não) |
| idem, vantagem | O cartão sai na próxima parada; com vantagem no DOGSO é amarelo; no SPA não há cartão; sem vantagem para falta grave | `decidirFalta`/`resolverVantagem`: vantagem só clara (segue indo para a frente no ataque), volta em `FALTAS.vantagem` s se o outro time pegar a bola |
| idem, Regra 3 | Expulso não pode ser substituído | O expulso sai de `m.jogadores` e fica na vaga como buraco; o editor recusa substituí-lo e deixa trocar a vaga vazia (nunca o gol) |
| IFAB, Regra 14 | Bola na marca; o goleiro na linha, entre as traves; todos os outros fora da área, a 9,15 m da marca e atrás dela | `montarPenalti` (corte de câmera, como a TV) e `restricaoPenalti`/`bordaParada` (área + meia-lua para os dois times) |
| OLBG / dados da Premier League 2024/25 | ~22,8 faltas por jogo; 4,3 amarelos e 0,15 vermelho (temporada 2024/25 até a rodada 30); 0,23 pênalti por jogo | A partida daqui tem ~1/3 dos lances de 90 min e poucos desarmes (~5 botes por partida): faltas 1,5–5, amarelos 10–30% das faltas (real ~19%), vermelhos ≤ 0,2 |
| Opta (The Analyst) — pênaltis | 89,7% de conversão em 2023/24 (recorde); historicamente ~78% | A meta do dono (~76% gol, 18% defesa, 6% fora) |
| Estudos de pênalti (o goleiro escolhe o lado antes do chute; ~40% acerta o lado) | O goleiro que espera a bola não chega no canto | `GOLEIRO.penalti`: o goleiro escolhe o lado ANTES do chute (44/12/44%; o humano escolhe com o analógico); lado errado = não defende; lado certo = chance × 0,72; o cobrador com 1,8× o erro do chute (a pressão) |

**Calibração** (sementes 1001…, IA × IA, a demo no time 0):

| Medida | Meta | 8 partidas (1ª versão) | 48 partidas (final) |
|---|---|---|---|
| Faltas por partida | 1,5–5 | 3,9 (27 de 31 eram táticas) | 2,6 (bote 62%, carga 26%, tática 11%) |
| Amarelos (fração das faltas) | 10–30% (real ~19%) | 45% | 18% |
| Vermelhos por partida | ≤ 0,2 | 0,25 (DOGSO na carga de quem volta) | 0,08 (quem volta evita a carga na chance clara: × 0,2) |
| Vantagem (fração das faltas) | — | 90% | ~6% (só a vantagem clara) |
| Pênalti: gol / defesa / fora (canhão) | ~76 / 18 / 6% | 58 / 42 / 0,3% (o goleiro esperava a bola) | 77 / 18 / 5% (600 cobranças) |

## 3b. Faltas com sentido (pedido do dono, 15/10: "faltas muito forçadas e sem sentido")

O dono jogou a versão publicada no celular, contra a IA: "tem umas loucuras aí, umas forçadas de barra pra ter falta".

| Fonte | O que diz | Onde entrou |
|---|---|---|
| IFAB, Leis do Jogo 2026/27, Regra 12.1 (texto da The FA) | Tiro livre direto quando o jogador **carrega, dá o bote/disputa, segura**... de modo imprudente, temerário ou com força excessiva. **Imprudente** = "falta de atenção ou de cuidado ao fazer o desafio, ou age sem precaução"; **temerário** = "sem ligar para o perigo ou para as consequências para o adversário" (amarelo) | A falta nasce da força com que o defensor ENTRA no condutor, não da direção da chegada: `faltas.js forcaContato` (a velocidade dele para dentro do condutor, limitada pela aproximação; 0 a mais de 1,2 m — corpo 0,3 + perna até a bola 0,65 + o pé dele) e `fatorForca` (até 1 m/s, o passo, é contato incidental). Carga nas costas a ≥ 3 m/s = temerária. Segurar quem passou também fora do contra-ataque (sem cartão) |
| idem (o que a regra pune é o desafio de quem entra) | O condutor que recua para dentro de quem estava atrás faz o contato; quem acabou de perder a bola e segue a corrida não "carrega" | `faltaNaCarga` exige `forcaContato ≥ carga.vMin` (de quem entrou) e ignora quem tocou na bola há < `carga.perdeu` s |
| OLBG / Premier League 2024/25 (§3: ~22,8 faltas e 0,23 pênalti por jogo) + The Athletic (2024/25: ~57 min de bola rolando) | ~0,40 falta por minuto de bola rolando; ~1% das faltas vira pênalti | Referência do `teste-faltas-sentido` (faltas por minuto); o defensor na própria área e na chance clara evita entrar no homem (`bote.naArea` 0,4, `bote.naChanceClara` 0,2, como a carga já fazia): aqui 4–8% das faltas viravam pênalti |
| Física do corpo (`config.js JOGADOR.freio` 6,2 e `freioGiro` 8 m/s²; tempo de reação ~0,25 s) | Quem segue colado na mesma velocidade não freia a tempo quando o da frente freia mais forte | `defesa.js semAtropelar`: o time jogado por uma pessoa chega freando no condutor e guarda a folga para a freada dele no tempo de reação (a velocidade dele − 0,25 · 8 m/s) |

**Diagnóstico na main** (`tools/lib/faltas-registro.mjs`: toda falta com o estado de antes do passo; o time 0 jogado como uma
pessoa — 'persegue' = analógico na bola e CORRER a mais de 4 m; 'pressao' = + PRESSÃO segurado; 'dribla' = conduz 3 s em
zigue-zague; 'demo' = IA × IA; 12 partidas por modelo, sementes 2001…, 3001…, 6001…, 1001… e 1013…; faltas por partida):

| Categoria | persegue | pressão | dribla | IA × IA |
|---|---|---|---|---|
| IA: bote com contato < 1 m/s | 1,50 | 1,92 | 5,42 | 0,58 |
| IA: bote com contato ≥ 1 m/s | 0,42 | 0,58 | 2,25 | 0,63 |
| IA: carga por trás | 0,00 | 0,50 | 0,67 | 0,13 |
| IA: segurar (contra-ataque) | 0,33 | 0,17 | 0,50 | 0,21 |
| pessoa: carga de quem só corria atrás (controlado / chamado da PRESSÃO) | 1,83 | 1,67 | 2,42 | 0,29 |
| pessoa: outras (dividida, companheiros) | 0,33 | 0,50 | 0,58 | 0,17 |
| **Total** | **4,42** | **5,33** | **11,83** | **2,00** |
| amarelos · vermelhos · pênaltis | 0,67 · 0,08 · 0,00 | 0,75 · 0 · 0,17 | 2,00 · 1,08 · 1,17 | 0,54 · 0,04 · 0,17 |

Causas: (1) o bote da IA virava falta pela direção da chegada e pela velocidade do defensor (`chanceFaltaBote`), sem olhar se
ele entrava no condutor: nos modelos com uma pessoa, a mediana da força de contato das faltas de bote era 0,00–0,26 m/s (o
defensor recuando de frente ou acompanhando de lado, com a bola mais perto dele); (2) o controlado da pessoa, com o analógico
na bola, chegava por trás a ~5,6 m/s num condutor a ~2,6 m/s, e a trombada virava carga (50%). Com as duas juntas, 2/3 a 3/4
das faltas eram "sem sentido".

**Depois** (as mesmas sementes):

| Categoria | persegue | pressão | dribla | IA × IA |
|---|---|---|---|---|
| IA: bote com contato < 1 m/s | 0 | 0 | 0 | 0 |
| IA: bote com contato ≥ 1 m/s | 1,17 | 1,00 | 2,75 | 0,54 |
| IA: carga por trás | 0,17 | 0,17 | 0,33 | 0,13 |
| IA: segurar (contra-ataque e fora dele) | 0,92 | 0,33 | 2,42 | 0,63 |
| pessoa: carga de quem só corria atrás | 0 | 0,50 | 0 | 0,17 (IA) |
| pessoa: outras | 0,33 | 0,50 | 0,25 | 0,25 |
| **Total** | **2,58** | **2,50** | **5,75** | **1,71** |
| amarelos · vermelhos · pênaltis | 0,42 · 0 · 0,08 | 0,83 · 0,08 · 0,08 | 1,00 · 0,08 · 0,17 | 0,58 · 0 · 0,08 |

**Contraprova** (mesma régua, `teste-faltas-sentido` A8–A13 e B4; reprovam no commit e9d88eed): (1) a DIVIDIDA da pessoa
seguia pela régua antiga (sem a força do contato) — no modelo 'dividida' (DIVIDIDA com a bola a ≤ 1,5 m) 60% das faltas
dela eram com o corpo entrando a < 1 m/s (8 partidas: 15 de 25; de frente recuando, 17% de chance de falta): agora
`chanceFaltaDividida` é a mesma régua do bote da IA (0 sem o corpo entrar; de lado a 3 m/s 71%, por trás forte 95%);
(2) o 'segurar' saía com o condutor parado de costas, andando ou com o defensor alcançando (~1/3 das 'segurar': o
condutor a < 3 m/s ou indo para trás) — agora só segura quem escapa dele (`tatica.escapa` 3 m/s, `tatica.ganhando`
0,5); (3) na própria área o cuidado do defensor (`bote.naArea` 0,4) virava roubada LIMPA com o mesmo contato que fora
dela é falta (de lado entrando a ~2,5 m/s: 69% limpo dentro × 29% fora) — agora o defensor tira o corpo
(`BOTE_EVITADO`, sem bote) e a fração limpa é a mesma (29% × 29%), com o pênalti mantido em 31%.

A mediana da força de contato dos botes da IA que viram falta passou para 2,5–3,8 m/s. Pendente: na IA × IA o jogo tem 0,21
falta por minuto de bola rolando (main 0,25; real ~0,40) — faltam as faltas que o jogo ainda não tem (no alto, segurar na
bola parada); não foi reposto à custa de botes sem contato.

## 4. Bolas paradas: lateral, tiro de meta, escanteio e barreira (IFAB Regras 13, 15 e 16)

| Fonte | O que diz | Onde entrou |
|---|---|---|
| IFAB, Leis do Jogo 2025/26, Regra 15 (texto da The FA) | De frente para o campo, parte de cada pé na linha lateral ou fora dela, as duas mãos levando a bola de trás e por cima da cabeça; adversários a ≥ 2 m | `lateral.js` e `partida.js montarLateral`: o cobrador com o pé da frente sobre a linha, de frente para o campo, a bola nas duas mãos atrás da cabeça (a bola do estado nas mãos; `anim.js` põe as palmas dos dois lados dela) e o arco por cima da cabeça até a soltura |
| Linthorne & Everett 2006 (Sports Biomechanics), que citam Messier & Brody, Kollath & Schwirtz, Bray & Kerwin | Arremesso de 12–19 m/s entre homens, solto a ~2,3 m; ângulo ótimo ~30° (mais rápido em ângulos baixos) | `LATERAL.vMax` [12, 19] pela força e pelo passe longo; `elevLongo` 0,52 rad (30°); o esqueleto daqui é mais baixo, a soltura fica a ~1,9 m |
| Pedido do dono, seção 8 | "Lateral: bola nas duas mãos acima da cabeça, três opções de passe e marcadores nelas" | `opcoesLateral` (3 melhores por risco da linha, distância e avanço), `opcaoMirada` (o analógico escolhe), `render/marcas-lateral.js` (anéis no gramado, a escolhida amarela e pulsando) |
| IFAB, Regra 16 (desde 2019/20) | A bola em qualquer ponto da pequena área, em jogo quando chutada e se move claramente; adversários fora da área até lá; companheiros podem receber dentro | `montarTiroDeMeta`: a bola no chão na pequena área, o goleiro cobra com o pé como qualquer bola parada (antes: a bola nas mãos dele e a reposição) |
| Pedido do dono, seção 8 | "Saída curta com os zagueiros abertos" | `TIRO_DE_META.aberto` (zagueiros nos cantos da área), volante na meia-lua, laterais altos; a IA sorteia curto (55%) e o goleiro espera os zagueiros abrirem (até 5 s) |
| Kubayi & Larkin 2020 (600 escanteios da Copa de 2018) | Defesa por zona sofreu 6,0% de gols; a mista, 3,7%; os gols saem mais do meio e do 1º pau | Defesa mista: zona na pequena área + individual nos melhores no alto (`ESCANTEIO.zonasDefesa`, `papeisEscanteio`) |
| Premier League, "Which clubs are best at defending corners and why" | A maioria mistura; 4 na zona da pequena área (2 no 1º pau, 1 no meio, 1 no 2º pau) | As zonas da defesa (meio, 1º pau, frente do 1º pau e, com gente sobrando, o 2º pau) |
| Copa de 2022 (570 escanteios) e estudo de 1.139 escanteios (Copa 2010, Euro 2012, Champions 2010/11) | 2,2–2,6% dos escanteios viram gol; com 3–4 atacantes atacando a área, mais chutes | Ataque com 5 nas zonas (centro, 1º pau, 2º pau, marca do pênalti, entrada da área), 2 atrás, o resto na 2ª bola |
| Copa América 2021 (175 escanteios); FIFA Training Centre (Copas femininas 2019/2023); Premier League (500 escanteios longos) | O ataque fez o 1º contato em 52,6%; na Premier League a defesa ganha mais | `AEREO`: disputa pelo alto (nota no alto: cabeceio, impulsão, altura; vantagem para quem está do lado do gol); o canhão dá 44% de 1º contato do ataque |
| Opta (The Analyst): cabeceios | ~1/3 dos cabeceios a gol vão no alvo | Testado nesta parte (`erroGolPartida`, o cabeceio a gol espalhando como o real) e tirado: valia para todo cabeceio da partida e derrubou os gols de bola rolando (painel de 144: 1,78 → 1,67 e o goleiro saiu da meta, 72,7%). Fica para a entrega do cabeceio, junto com a elevação mirada (hoje a cabeçada sai sempre para baixo e bate nas pernas) |
| IFAB, Regra 13 | Barreira a 9,15 m; com 3 ou mais na barreira, os atacantes a ≥ 1 m dela | `bolas-paradas.js barreiraDoTiroLivre`, `partida.js montarBarreira` e `foraDaBarreira` |
| Plus Magazine (Universidade de Cambridge), "The wall" | A largura que tapa 2/3 do gol a partir do 1º pau ÷ ~0,45 m por defensor; no meio a 22 m dá ~4,5 (eles usam 4); perto e no meio, 5–6 | `BARREIRA`: 5 no meio a 18 m, 4 a 21–26 m, 3 a ~30 m, ≤ 2 de lado, nenhuma a 33 m ou mais |
| Opta (The Analyst), "Free-kick specialists: celebrating an endangered species" | 2,4–4,4% dos chutes de falta viram gol nas grandes ligas; mediana de 27,6 m; ~20% das faltas no terço final são chutadas | O chute de falta por cima da barreira (efeito por cima, `ACOES.chute.faltaErro`): canhão de faltas perigosas (18–31 m) com ~5% de gol, ~29% no alvo e ~20% na barreira |

**Calibração** (canhões com estados do meio do jogo, IA × IA; sementes e lances diferentes em cada cena):

| Medida | Meta | Antes (publicada) | Depois |
|---|---|---|---|
| Escanteio: 1º contato do ataque | 35–62% (real 40–53%) | 88% (ninguém disputava: o recebedor sempre cabeceava) | 49% |
| Escanteio: gol (≤ 8 s) | o mais perto de 2,6% | 22% (24 partidas) | 11,4% (canhão de 123) |
| Tiro livre perigoso: gol / no alvo / barreira | 2–12% / 18–36% / 15–40% | sem barreira | 6,3% / 32,9% / 17,5% (143 chutes; 3 lotes antes: 4,9% / 28,7% / 19–22%) |
| Lateral: o time fica com a bola | ≥ 55% | (com o pé) | 71–80% |

**Defeitos achados no caminho e corrigidos:**
- A barreira de quem ataca para −x ficava atrás da bola: a média de dois ângulos perto de +π e −π dava ~0. Agora os ângulos são medidos a partir da direção do gol.
- O atacante que perdia a disputa cabeceava a bola recém-afastada, colada nele (`AEREO.perdeuSalto`).
- O chute de falta sem efeito (o do humano sem MOD) saía por cima. Agora a falta tem efeito por cima: a bola desce.

**Painel de 144 partidas (mesmas sementes, contra a publicada):** gols 2,13 → 1,68 por partida; o goleiro 66,1% → 72,5% (6–16,5 m: 58,7% → 64,6%). Os gols que sumiram são os de escanteio (as cabeçadas sem disputa, de perto) e os de saída de bola roubada perto da área: a mistura de chutes mudou (chutes a menos de 6 m: 0,89 → 0,42 por partida; gols de bola parada 0,61 → 0,42 e de saída roubada 0,75 → 0,50), não o goleiro. O dono decidiu publicar (11/10); a entrega do cabeceio + IA intensa tem de trazer os gols de volta. Testado e descartado nesta parte: o cabeceio a gol espalhando em todo lance (1,67 gols) e a disputa pelo alto desligada também na bola parada (1,90 gols, mas com o escanteio sem disputa — o defeito da publicada).

**Pendente (próxima parte, o goleiro):** o goleiro ainda não sai no cruzamento. É o que falta para o gol por escanteio chegar perto dos 2,6% reais. Por partida, o escanteio já dá ~0,25 gol (2,6 escanteios × ~10%), o mesmo que no jogo real (~10 × 2,6%).

**Medido de novo (12/10, na rede véu de noiva):** o 11,4% do canhão de 123 foi um sorteio favorável. O mesmo canhão com outras 8 sementes dá, na main, 16,7% (1009–1016) e 10,3% (1017–1024), e com 32 sementes (~500 escanteios) 13,5% — a taxa real fica em ~13%, um ponto acima da meta de 12% (na rede véu: 12,1%, 15,3%, 11,8% e 12,7%; a rede não muda o escanteio). O `teste-bolas-paradas` C3 passou a reprovar só quando a contagem prova mais de 12% (binomial, p < 5%), como os vermelhos do `teste-faltas`; descer de verdade é com o goleiro saindo no cruzamento.

## 5. Mãos do goleiro, recuo, 8 s e o goleiro na mão do humano (pedidos do dono de 11/10)

Pedidos: "eu não consigo mexer com o goleiro, o goleiro só consegue pegar na mão dentro da área" e "não pode recuo".
Diagnóstico (scratch `diag11/goleiro-regras`): o analógico não movia o goleiro (com a bola na mão a velocidade era 0; a
IA repunha pelo humano aos 3 s), TROCAR nunca escolhia o goleiro, a mão não conhecia a regra (só o "pegou" conferia a
área, pelo centro da bola; com GOLEIRO ele espalmava a 24 m da linha) e todo recuo ia para a mão (o goleiro nem entrava
na disputa da bola livre com o pé).

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| IFAB, Leis do Jogo 2025/26, Regra 12 (theifab.com/laws/latest/fouls-and-misconduct) | Tiro livre indireto se o goleiro, na própria área, toca a bola com a mão depois de soltá-la e antes de outro jogador tocá-la, ou depois de um chute deliberado de companheiro para ele (salvo se ele chutou para repor), ou direto de um lateral de companheiro. Fora da área ele tem as restrições de qualquer jogador. Com a bola sob controle nas mãos ele não pode ser disputado; soltou (ou largou no chão), pode | `regras-goleiro.js`: `maoPermitida` (na área — qualquer parte da bola sobre a linha —, sem `semMao` do time e sem `soltou` dele); `registrarChute`/`registrarToque` (o chute/passe de companheiro liga o recuo; cabeça/peito, adversário ou bola morta desligam); PEGAR com recuo/soltou = `tiroLivre` indireto; a IA pressiona o goleiro com a bola no pé (`ia-tatica.js pressionavel`), nunca com ela nas mãos |
| IFAB, Regra 12.3 (mesma página; mudança de 2025/26) | Mais de 8 s com a bola nas mãos dentro da área = escanteio do adversário, do lado do campo mais perto do goleiro; o árbitro conta os últimos 5 s com a mão levantada | `GOLEIRO.oitoSegundos` (8) e `contagem` (5): `partida.js oitoSegundos` → `escanteio`; o relógio começa com ele de pé (`g.segura.dePe`) e a bola em jogo; o anel âmbar sem texto (`relogioMao`) no lugar da mão do árbitro |
| IFAB, Regra 13 (tiros livres) | Tiro livre indireto do ataque dentro da pequena área: na linha dela, no ponto mais perto | `pontoTiroLivreMao` (a barreira na linha do gol ainda não existe — pendência) |
| IFAB, Regra 16 (tiro de meta) | Os adversários ficam fora da área até a bola estar em jogo | Na montagem os adversários na área vão para fora (corte de câmera) — o mesmo do branch `golaco/bolas-paradas` (e1d409e5) |
| FIFPlay — controles do EA FC 25 (fifplay.com/fc-25-controls) | Goleiro com a bola: Throw/Pass, Drop Kick, Drop Ball (Y/△: soltar no chão e sair jogando), Pick Up Ball (R1/RB); mover o goleiro | PASSE = rola curto; LANÇAMENTO (e CHUTE) = chutão; ENFIADA (Y) = soltar no chão; PEGAR no RB/O e num botão de toque que só aparece com o goleiro com a bola no pé |
| GINX — "How to control the goalkeeper in FIFA 22"; manual do FIFA 20 | "Switch to Goalkeeper": o goleiro controlado anda pelo analógico | TROCAR segurado 0,4 s (`GOLEIRO.trocarGoleiro`) leva ao goleiro; sem a bola o analógico o move (a defesa automática continua: chute lido e mergulho vêm antes); com a bola na mão ele anda até a borda da área (`maoAnda`: 3,2 m/s, 4,5 com CORRER; parede pela locomoção a 0,6 m da linha) |

**Medido** (`tools/teste-goleiro-regras.mjs`, base = a publicada antes desta entrega): recuo do humano agarrado 18/18 →
0/18 (domina com o pé 0 → 18/18); com a bola na mão o goleiro anda 0,00 → 14,4 m sem sair da área; reposição pelo humano
aos 3,03 s → nunca antes de 8 s (8 s → escanteio 0/9 → 9/9); TROCAR segurado 0/3 → 3/3; mão com a bola fora da área (24 m,
GOLEIRO segurado) 12/18 → 0/18; IA × IA (8 partidas): recuo agarrado 2 → 0, adversário na área no tiro de meta 3,5 s → 0.

**Painel** (`tools/painel-equilibrio.mjs`, 144 partidas, sementes 1001–1144, base × agora): com as regras (e o jogador
parado e a PRESSÃO), gols 2,13 → 2,09, chutes 9,6 → 10,0, defesas 66,1 → 69,1% (6–16,5 m 58,7 → **60,8%**, fora da meta
55–60%; de fora da área 86,7 → 87,1%), erro na saída de bola 35 → 32% dos gols, faltas 2,8 → 2,3 por partida. Os gols de
6 a 16,5 m caíram (177 → 164) com as mesmas defesas (252 → 254) — coerente com o fim do tiro de meta roubado com o
adversário dentro da área (erro na saída de bola 35 → 32% dos gols). Duas correções medidas com as mesmas 144 sementes: o
gatilho do condutor lento só contra o humano (63,5% — não era a causa; descartado) e `GOLEIRO.logit.c0Partida` −0,1 só na
partida: 6–16,5 m 59,0%, total 68,0%, de fora da área 86,8%, gols 2,13, impedimentos 1,15, bola parada 29% — tudo o que
estava na meta continua nela (a amostra de 144 varia ±4 pontos nessa faixa: ~420 chutes no alvo).

## 6. Cabeceio na bola rolando e IA intensa com responsabilidade (pedidos do dono de 11/10)

Pedidos: "os jogadores não cabeceiam a bola, de jeito nenhum" e "o jogo tem que ser mais intenso, ninguém do outro time
corre, ninguém marca, mas tem que marcar com responsabilidade e consciência, a IA tem que ser mais inteligente".
Diagnóstico e contraprova (scratch `diag11/cabeceio*`, `diag11/ia-intensa*`): o cabeceio a gol era teletransportado para
o chão no mesmo tick (`finalizarChute` punha a bola rolando), ninguém pulava (o toque aéreo só marcava a bola que passava a
0,6 m, sem tempo de subir), a disputa pelo alto só existia na bola parada e o painel tinha 0 gol de cabeça na bola rolando.
Na defesa, contra quem arranca com a bola o 1º homem ficava parado ou subindo no corredor (3,0 m/s para o próprio gol com o
condutor a 3 m), quem foi batido seguia como 1º homem, a bola roubada saía para a frente do condutor (26% das roubadas
desfeitas pelo mesmo jogador em 1 s) e 30–41% das arrancadas do próprio campo chegavam à área contra o bloco armado.

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| The Analyst (Opta), "fewer headed goals" (theanalyst.com/articles/premier-league-fewer-headed-goals-2024-25) | PL 2023/24: 203 de 1.246 gols de cabeça (16%); ~4,0 cabeceios a gol por jogo, ~1,6 no alvo (~40%); 34,7 cruzamentos por jogo, 8,4 certos (24%) | Linha "gols de cabeça" do painel (8–18%); `ACOES.cabeceio.erroGol` calibrado no canhão de cruzamentos pelo no alvo (~40%) e gol (10–13%) por cabeceio a gol |
| The FA, "Heading guidance — professional football" (2021, dados Opta) | Cabeceios por jogo: zagueiros 7,02, meias 4,93, atacantes 3,65 | A intenção sem botão (`intencaoCabeceio`): no meu terço afasta, na área adversária a gol, no meio passe — quem defende cabeceia mais (o volume do painel é informativo) |
| Premier League (premierleague.com/news/3854577) | Times de jogo aéreo passam de 600 duelos pelo alto por temporada (~17 por jogo) | Ordem de grandeza dos duelos pelo alto no jogo corrido (linha informativa do painel) |
| Fílter et al. 2022 (MMU) | No cabeceio com corrida a cabeça passa ~0,56 m da estatura; último apoio ~0,24 s | `CABECEIO.salto` (o quadril sobe 0,40–0,65 m pela impulsão), `alcanceCabeceio` pela cabeça desenhada, `preparoPulo` |
| Becker 2021 (RPTU) | Força própria do cabeceio com corrida ~8,3 m/s | `ACOES.cabeceio.potencia` (já da Etapa 2) + `redirecao` |
| Mancini et al. 2022, Sports Medicine and Health Science (pmc.ncbi.nlm.nih.gov/articles/PMC9453686) | No pouso do cabeceio com salto o joelho toca o chão com 19–24° de flexão e chega a 69–90°; a altura do pulo de cabeceio fica ~2,5 cm abaixo do salto vertical máximo | `CABECEIO.amortece` (o quadril baixa depois do pouso), o pulo um pouco abaixo do máximo |
| Fases do cabeceio com salto (Shewchenko 2005; Bauer 2001) | Preparação (agacha), impulsão com os braços, extensão do tronco para trás na subida, chicote para a frente no contato, no alto do pulo | `quadroPulo` (`agacha`, braços, `arco`, peso da inclinação) e o contato no alto do pulo (`tc`) |
| Tese da Universidade de Atenas sobre os escanteios da Copa América 2021 (pergamos.lib.uoa.gr/uoa/dl/frontend/en/browse/3329322; 175 escanteios, Wyscout) | O ataque faz o 1º contato em 52,6% dos escanteios; 8 gols (4,6%) | `AEREO.zonaBolaParada` (quem defende ataca a bola só na zona dele) e `ataqueBolaParada` (quem ataca vem na corrida, no tempo da cobrança) — o canhão de escanteios do `teste-bolas-paradas` (meta 35–62%) |
| FIFA Training Centre, "Goalkeeping fundamentals: defending the penalty area"; Keeperstop, "Dealing with crosses" | O goleiro lê se o cruzamento vai ao 1º pau, ao meio ou ao 2º pau e se ajusta antes; postura aberta para acompanhar a bola até o 2º pau | `GOLEIRO.leCruzamento`: a bissetriz do ponto onde a bola desce para a cabeça, não da bola no ar (no escanteio ele ficava no 1º pau e a cabeçada no 2º entrava) |
| Wyscout, glossário PPDA (dataglossary.wyscout.com/ppda) | PPDA médio ~11 (6,7–18,2 nas ligas) | O `teste-pressao` (grupo `etapa3`) |
| Forcher et al. 2024, "Is a compact organization important for defensive success in elite football?" (Universidade de Viena) | A compactação dos jogadores mais perto da bola pesa no sucesso defensivo | Só o 1º e o 2º homem vão à bola; o bloco do corredor acompanha no lugar dele na forma (`acompanhaCorredor`) |
| Andrienko et al. 2017, "Visual analysis of pressure in football" (City, University of London) | A pressão cai com a distância e com o defensor atrás do atacante | O batido deixa de ser o 1º homem (`batido`, `batidoPaga`) |
| Metrica Sports, dados de amostra (github.com/metrica-sports/sample-data) | Com o condutor rápido, ~51% dos defensores a mais de 4 m/s | Referência da contraprova para não exagerar o bloco inteiro correndo (`fBloco` < 1) |
| EA SPORTS FC 27, Pitch Notes (ea.com) | Defesa por "contain"/"jockey" com corrida e o desarme na hora certa | `acompanhar`: conter pela velocidade (a conta do CONTER do humano) e fechar até o bote perto do gol; desarme sem parar de correr |
| Sportsessionplanner, 1 × 1 (já citada na §17 da Etapa 3) | Fechar, conter e dar o bote quando o atacante dá a chance | `IA_DEFESA.corrida.engaja`: longe do gol atrasa a arrancada, perto ele tira a bola |
| FBref (dados Opta), "2023-2024 Premier League Defensive Action Stats" (fbref.com/en/comps/9/2023-2024/defense) | Interceptações por time por jogo: média 8,49 (6,13 o Manchester City a 9,95 o Brentford) | Pedido do dono de 12/10 ("a defesa mal intercepta passe"): linha do painel e referência do `teste-intercepta` em interceptações por time por partida. As nossas partidas têm ~1/3 dos passes e quase nenhum outro jeito de errar o passe (no real ~11% dos passes errados são interceptações; aqui ~60%), então a meta é interceptar mais que a base (8,75) e no máximo 14, com o passe certo no real |
| Opta via The Analyst e Premier League (temporada 2023/24) | ~941 passes por jogo (os dois times) e ~780 certos por jogo → passe certo ≈ 82,9% | Meta do `teste-intercepta`: passe certo 80–86,5% (o real ~80–85% com a margem da amostra; a publicada ficava em 88–89%) |
| FIFA Training Centre, defesa por zona (já citada acima) | O marcador fica do lado da bola e do gol do homem dele, pronto para cortar a linha de passe sem perder o homem | `ia-tatica.js pontoMarcacao`: o marcador (individual ou da zona) puxado `linhaDePasse.sombra[pressão]` para a linha de passe do condutor, a `sombraDist` m do homem |
| Opta, definição de interceptação ("a player intercepts a pass by moving into the line of the intended pass") e tempo de reação a um estímulo visual no esporte (~0,2 s) | O corte é ler a trajetória e chegar à linha antes do recebedor | `cortaPasse`: o 1º ponto da trajetória (`preverBola`) que o defensor alcança da velocidade que leva, com 0,2 s de leitura e 0,1 s antes do recebedor; e no `sim.js` o recebedor que só marcou o domínio não tira a vez de quem foi cortar (antes o canhão do passe arriscado cortava 1 de 92 passes alcançáveis) |
| Contraprova de 11/10 (`diag11/ia-intensa-contraprova`) | Só correr não para a arrancada; falta o desarme lado a lado e não subir no corredor; o trote não pode virar "arrancada" | A ordem das mudanças (bote com `semDominioAte` e a bola para o lado do defensor; acompanhar sem subir; filtro da pressa; o batido; o 1º homem além da linha de engajamento) e `corrida.v` = 6,3 m/s |

**Medido** (13/10; o painel de 144 no GitHub não pôde ser disparado daqui — `workflow_dispatch` com 403 para a integração
da sessão —, então 48 partidas locais, sementes 1001–1048, as MESMAS na main e na branch; ± = intervalo de 95% dos gols):

| Medida (painel) | main (base) | branch | Meta |
|---|---|---|---|
| gols por partida | 1,79 ± 0,35 | 1,50 ± 0,35 | 2,3–3,5 |
| chutes por partida (time 0 / time 1) | 8,5 (4,2 / 4,3) | 6,6 (3,5 / 3,1) | — |
| conversão / no alvo | 19,9% / 62,7% | 22,4% / 67,8% | 9–14% / 28–38% |
| chutes de fora da área / gols de fora | 34,6% / 12,3% | 43,8% / 19,7% | 35–40% / 12–18% |
| passe certo | 88,7% | 85,9% | 75–88% (Opta: 82,9%) |
| interceptações por time por partida | 8,09 | 11,88 | 8,5–14 (PL: 8,5) |
| posses que chegam ao último terço | 46,4% | 41,2% | 35–45% |
| impedimentos por partida | 1,15 | 1,17 | ≥ 1 |
| goleiro: total / 6–16,5 m / de fora | 69,2 / 58,1 / 88,9% | 67,6 / 54,2 / 83,6% | 66–72 / 55–60 / 80–90% |
| origem dos gols: trabalhada / contra-ataque / roubada alta / bola parada | 23 / 10 / 47 / 19% | 36 / 18 / 31 / 14% | bola parada 20–30% |
| gols de cabeça | 6,2% | 9,9% | 8–18% (PL: 16%) |
| duelos pelo alto por partida (bola rolando) | 1,6 (0,0) | 3,5 (1,9) | — |

Onde foram os gols (ablação com `--set`, 48 partidas cada, a mesma base): a defesa contra a arrancada com `corrida.v`
6,3 m/s levava os gols a 0,90 (sem ela, 1,60) — o condutor da IA ainda acelerando ligava o bloco inteiro e o contra-ataque
morria; com 6,8 m/s (só a disparada de verdade; o humano com a bola vai a 7,6) 1,50. O corte do passe sozinho quase não
muda os gols (sem ele, 1,10 contra 0,90), nem a sombra na linha de passe (1,19). O que caiu foi o gol de roubada alta
(47% dos gols na main, ~0,8 por partida — no real ~10–15%): a defesa nova perde menos bola perto da área. Calibrado:
`GOLEIRO.logit.c0Partida` −0,1 → −0,35 (o goleiro tinha ido a 75–79% com menos chances claras), `IA_ATAQUE.contra` bonus
1,0 e 8 s (a retomada no meio vira contra-ataque), `utilidade.chute` 3,0. Falta ~0,3 gol para a main e ~0,8 para a meta:
volume de ataque (chutes 6,6 contra 8,5) — a calibração final fica com a condução curta, como combinado. Testes:
`teste-intercepta` (base: 1/92 passes alcançáveis cortados, passe certo 88,7%, 8,75 interceptações; agora 20/34 = 59%,
85,1%, 11,29; homem livre 77,8% → 75,6%), `teste-cabeceio` e `teste-defesa-corrida` (a base reprova 8 e 6 metas); o defensor do corredor ultrapassado
ficou em 3,3–3,6 m/s (meta ≥ 5; base 3,0) — PENDENTE, não reprova.

## 7. Volume de ataque com a defesa que corta o passe (rodada de 13/10)

Pedido: trazer de volta o volume de ataque sem afrouxar a defesa nova (os chutes tinham caído de 9,2 para 6,8 por partida
no painel de 144 do CI, os gols de 1,81 para 1,42). Diagnóstico (scratch `cabia/dbg-terco.mjs`, sementes 1001–1016): no
último terço as posses eram as mesmas da main (14,9 por partida) — faltavam ações em cada uma (passes 25 → 20, cruzamentos
4,1 → 2,8, chutes da área 3,6 → 2,1), e o gol de roubada alta caía de 1,0 para 0,4 por partida (na main, 30% das
roubadas a ≤ 40 m do gol viravam gol — Opta: ~2%).

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| FIFA Training Centre, "Third player combinations" (fifatrainingcentre.com/en/game/game-analysis/in-possession/third-player-combinations.php) | A combinação em quatro fases: o passe, a devolução de primeira, a corrida para o espaço que o marcador do passador não acompanha e o passe final | A tabela da IA (`tabelaIA`): o passe curto no campo de ataque com espaço à frente sai com a corrida do passador, e quem recebe vê a devolução como enfiada. A devolução de primeira foi medida e saiu (chutes 7,6 → 6,2 e passe certo 85 → 82% em 48 partidas) |
| American Soccer Analysis, "Where goals come from: playing the killer final ball" (2021) | Enfiada: chute de ~0,30 de xG; o cutback acontece ~1,6 vez por partida com 32% de acerto; os dois convertem bem mais que o cruzamento | Valorizar a bola no espaço para quem corre (a tabela vira enfiada). O "passe para quem finaliza" (o valor do passe pela chance de gol do recebedor) foi medido e não mudou os gols (1,73 → 1,71 em 48 partidas): não entrou |
| StatsBomb, "How do Headers compare to Shots?" | Da mesma zona o cabeceio marca ~62% do chute; 95% dos cabeceios são do meio da área | `utilidade.cruzamentoV` 0,25 → 0,35 (com o cabeceio na bola rolando o cruzamento rende gol), sem passar da faixa de gols de cabeça (12–13%; PL 16%) |
| Opta Analyst, "Premier League pressing stats" (2024) | PL 2024/25: 2,5 roubadas altas que terminam em chute por jogo, 0,3 em gol (13% dos chutes delas; 15–17% das roubadas altas terminam em chute) | O gol de roubada alta da main (~0,7 por partida, 37% dos gols) é o defeito antigo (a saída de bola roubada perto da área); a branch fica mais perto do real e não se buscou de volta esse gol |

Também medido e descartado (48 partidas, `--set`): o condutor cauteloso (`manterPeso` 0,85 / `manterLado` 0,7: chutes 7,6 →
4,9), o ousado no campo todo (0,55 / 0,25: chutes 8,4, mas no meio-campo ia para cima da PRESSÃO do humano e sobravam
menos bolas longas — os duelos pelo alto com a bola rolando caíam para ~1,5), mais gente na área no cruzamento
(`TATICA.naArea`) e a defesa da arrancada só a partir de 7,2 m/s (o humano em disparada passava a fazer 1,9 gol por
partida no `teste-defesa-corrida`, meta ≤ 1,5).

Medido (painel do CI, 144 partidas, main × branch, mesmas sementes): ver o relatório do PR #471.

### 7.1 Rodada de 14/10 — onde o volume se perde (diagnóstico, 24–48 partidas locais, decisão no CI)

- **O passador que confere a linha** (Jordet et al. 2020, *Frontiers in Psychology*, "Scanning, contextual factors, and
  association with performance in English Premier League footballers", 9.574 posses: o jogador olha em volta mais antes de
  passar do que antes de qualquer outra ação, e quem olha mais acerta mais o passe). Medido: ~16 passes por partida saíam
  com a linha fechada no toque (risco ≥ 0,8 pela conta do `riscoCaminho`) tendo < 0,2 na decisão — a carga do botão e a
  espera do pé de apoio levam 0,3–0,9 s e a marcação na linha de passe fecha a linha nesse tempo; 2/3 deles eram perdidos
  (um terço das perdas do meio-campo). Desistir do passe quando a linha fecha derrubou esses passes de 16,2 para 3,3 por
  partida, mas não trouxe volume (7,4 → 7,6 chutes, 1,71 → 1,67 gol em 48) e as interceptações voltaram ao nível da base
  (13,1 → 8,0 por time, teste-intercepta A pede ≥ base + 1,5) com o passe certo em 88,6% (meta 80–86,5%): boa parte das
  interceptações novas eram erro do passador. Não entrou — fica para o dono decidir (IA que passa melhor × defesa que
  intercepta mais); uma versão pela `visao` (quem olha mais vê a linha fechar) é o meio-termo natural.
- **Ablação da defesa nova** (48 partidas, base = a branch, 7,4 chutes; a main nas mesmas sementes: 9,4): sem a sombra da
  linha de passe 7,2; sem o corte do passe 7,8; goleiro sem ler o cruzamento 8,0; sem a defesa da arrancada 8,1. Nenhuma
  peça explica sozinha: cada uma tira ~0,5 chute (a soma dá a diferença). O que falta são os chutes da área sem ser de
  cabeça (5,06 → 3,44 por partida) e os escanteios (2,33 → 1,69); os cabeceios a gol quase não mudam (1,44 → 1,19).
- **Pesos do ataque não trazem volume** (48 partidas): `utilidade.chute` 3,6 → 7,1 chutes; `primeira.xg` 0,08 → 7,4;
  `cruzamentoV` 0,45 → 7,5 (base 7,4). O condutor que encara no último terço (`manterTerco`) parecia neutro em 48 (7,4 ×
  7,5) mas vale ~0,4 chute nas 144 do CI (7,3 × 6,9) — de novo, 48 partidas enganam.
- No painel do CI com a IA jogando pelo humano do time 0, só o time 1 perde chute (4,7 → 3,2); sem o controle humano
  (`m.humanos = []`) os dois perdem parecido: a causa é geral, não do lado do humano.

### 7.2 Rodada de 15/10 — passe certo, PRESSÃO que corre e gols (triagem em 48 partidas locais, decisão no CI)

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| Premier League / Opta, "Season trends: Quality on rise as midfield takes focus" (premierleague.com/news/1745761) | A parte dos passes que terminam no último terço caiu de ~38% (2006/07) para 28,7% (2019/20), o mínimo da série | Diagnóstico: com a defesa que corta o passe, só ~10% dos nossos passes terminam no último terço e 94% dos passes curtos (< 15 m) dão certo (o meio-campo acerta 91,5%, o último terço só 52%) — o time troca passe de lado. Linha informativa no `teste-intercepta` A |
| Opta via Premier League, "Opta Analyst on long balls" (premierleague.com/en/news/4426039) e Planet Football / Opta (long ball = passe de mais de 35 jardas; 47,3% certos na média da PL) | 2025/26: 849 passes por jogo, 82,6% certos; o lançamento acerta menos da metade | O lançamento mais cedo (`lancamentoMin` 25, `lancamentoP` 0,6–0,8) foi medido: os nossos lançamentos acertam ~0–4% (bola alta sem ninguém ganhando) e os gols caíam (1,31 em 48); não entrou |
| The Analyst (Opta), PL 2023/24: 34,7 cruzamentos por jogo, 24% certos (já citada na §6) | Cruzar é ~3,7% dos passes | Aqui ~1,4% (o cruzamento quase só sai com 2+ na área) — ver o candidato abaixo |
| Driblab, "on-ball pressures" (driblab.com/blog/arrigo-on-ball-pressures); StatsBomb, "Under Pressure" (blogarchive.statsbomb.com) | Passe "sob pressão" = defensor a ≤ 2 m do passador; a taxa de acerto cai sob pressão | Medido no jogo: livre 93,6%, adversário a 2–4 m 89,5%, a ≤ 2 m 72,9% — a queda existe; o excesso de acerto está no passe curto sem pressão no meio-campo |
| EA SPORTS FC 27, Pitch Notes (ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-gameplay-deep-dive) | Alcance de interceptação da IA reduzido; o defensor controlado alcança mais que o da IA | O corte da IA segue pela física (leitura 0,2 s, nada de corte mágico); a folga por zona do candidato abaixo seguia isso |
| Reynolds, "Steering Behaviors For Autonomous Characters" (GDC 1999), *obstacle avoidance*; GameDev.net, "American football AI" (gamedev.net/forums/topic/461155) | O agente olha à frente na direção do movimento e desvia do obstáculo mais perto que cruza o caminho; em jogos de futebol americano o recebedor soma "ir ao ponto" e "fugir dos adversários" | `defesa.js desviarCorpos` (ENTROU): o chamado da PRESSÃO em disparada contorna o corpo mais perto à frente (0,7 s de corrida, a 0,8 m dele) — trombadas com quem não é o condutor 4,2 → 2,1 por 100 lances, M5 80 → 83% |

**Candidato medido e NÃO adotado** (9080b9ba, revertido): corte com a folga por zona (`IA_DEFESA.livre.antes` [meu terço,
meio, terço deles] = [0,2, 0,05, 0,1]), `riscoMentalidade` × 1,2 e `cruzamentoP` com um na área 0,06 → 0,2. No
`teste-intercepta` resolvia o passe certo (86,5 → 84,4%, interceptações 10,75, chutes 6,7 → 9,7 nas 12 partidas), mas no
painel de 144 do CI os gols ficaram em 1,70 (main 1,85; antes 1,71), o goleiro de 6 a 16,5 m saiu da faixa (60,0%) e 7 testes
reprovaram (duelos pelo alto 1,25 por partida, gols do sprint 1,58, faltas 1,25 por partida, PRESSÃO M1 e M4, e os do replay
e dos treinadores da #479). Lição de novo: a triagem em 48 partidas (V7 +0,25 gol) não resolve efeitos de 0,2 gol, e os
testes no fio da navalha mudam com qualquer trajetória nova.

Diagnóstico do M5 (o chamado a > 4 m, ≥ 1 s depois, a ≥ vCorrida): ~1.000 dos ~5.400 passos que reprovavam eram o chamado
pedindo disparada (CORRER, analógico cheio) e ainda acelerando — no passe do adversário o alvo muda de lado, o corpo freia
na linha (jogador.js: inversão além de 112°) e arranca de novo; parte vinha de trombadas. Testados e descartados: contar a
inversão no tempo de chegada da escolha (`tempoChegada`: +1 ponto no M5, dentro da variação de 8 partidas) e a histerese só
sem curva grande (sem ganho). Achado e NÃO aplicado (pendência): o domínio marcado de quem ia receber o passe cortado ficava
de pé com a bola no pé do adversário (~1.000 passos por partida, de frente a até 1 m/s, até 3,7 s); tirá-lo melhora a
reação na hora da perda, mas derruba o M3 da PRESSÃO (o 2º companheiro mais perto em 2 s: Δ 1,89 → 1,39 m, meta 1,5) — com
o recebedor livre para recompor, ele fica perto do condutor com e sem o botão — e o M5 (83 → 77%).

Defeito de desenho corrigido (o que a leitura 0,15 do corte tinha exposto, §7.1 do relatório de 14/10, aparecia de novo com a
trajetória nova): no pulo do cabeceio o pé que saía do chão no meio do passo caía para o chão no 1º passo do voo
(`cabeceio.js pesNoAr`: 6,8 cm num quadro, 1,11× o limite do `teste-patinacao`). Agora ele parte da altura que tinha e a
sobra some até o pouso (`teste-cabeceio` F4: 3 quadros acima do limite → 0, pior 1,05× → 0,77×). Muda o treino em passos
raros (`hash-igual`: ataque-roteiro diferente a partir do passo 4800 da semente 3, um pulo com o pé no ar).

Defeitos da câmera e dos treinadores que os gols da partida do #471 expuseram (CI do 9933ea0e; desenho, o hash da partida
não muda):
- `teste-tecnicos` T13 (treinador × jogador ≥ 0,5 m) — PENDENTE: o ponto calmo da IA (`ia-tatica.js alvoCalmo`) gira aos
  poucos e, com a bola saindo pela lateral, o caminho girado levava o jogador 106 em arco 4,75 m para fora da linha, pela
  área técnica, a 6,5 m/s junto do fundo dela (0,46 m do treinador, semente 7). O treinador não tem para onde fugir (está no
  fundo da área e o jogador passa entre ele e o campo). Corrigir na IA (o giro que sairia do campo vira de uma vez:
  mín 0,46 → 2,23 m, 216fac2c) dispara em ~3/4 das partidas — mesmo só dentro da área técnica — e reembaralha a amostra de
  todos os testes da partida: no CI do 216fac2c reprovaram por pouco 4 que passavam (trote da IA 0,60 m, meta ≤ 0,59;
  tiros livres no alvo 17,7%, meta ≥ 18%; interceptações 10,00, meta ≥ 10,25; PRESSÃO M4). Voltou a partida do 9933ea0e; o
  caso fica com a correção dos treinadores robustos da main (golaco/replay-robusto) ou com uma rodada própria de IA.
- T5 (mão ≤ 0,15 m por passo): a reação ao gol misturava as juntas em 0,2 s fixos e a mão que vinha das costas para os
  braços em V corria 9 m/s (0,152 m num passo). A mistura da reação cresce com o caminho da mão (`TECNICOS.maoPicoGol` 8,1
  m/s no pico do smoothstep, a mesma conta da troca comum): 0,152 → 0,146 m, com a mão acima da cabeça ainda em 0,28–0,37 s.
- T7 (comemoração ≥ 3 s): artefato do teste — o laço parava no apito final e cortava a comemoração de um gol nos últimos
  segundos (2,48 s). A medida segue 3,6 s depois do fim sem andar a partida (o T8 conta os gestos só até o apito, como
  antes): 2,48–3,50 → 3,50 s.
- `teste-replay-anel` G9 (olho do treinador ≤ 0,15 m da cabeça): no pulo/agachar de uma vez da reação ao gol o atraso da
  gaussiana levava a lente a 0,157 m. O olho suavizado fica a ≤ 4 cm do bruto (`REPLAY.treinador.olhoMax`).
- G8 (≥ 48 gols com autor na amostra): com ~1,6 gol por partida, 28 partidas davam 44; a amostra cresceu para 36.
- G7 (a boca do gol no quadro da 1ª pessoa em chute − 0,5 s; apareceu com a trajetória do 216fac2c, semente 9 — o caso real
  fica corrigido mesmo sem ela): o
  cruzamento rasteiro chegava a 140° do gol e, puxando o olhar 60% da bola para o gol, a boca do gol ficava a 54° do centro
  (fora dos 45° do quadro). O olhar antes do chute fica a ≤ 30° da boca do gol na horizontal (`REPLAY.primeira.golAntes`):
  54 → 38°, no quadro nas três telas.

Candidato do passe certo sem o corte por zona (o que sobrou do 9080b9ba): `IA_ATAQUE.riscoMentalidade` × 1,2 (o condutor
aceita mais risco no passe para a frente; Opta/PL: 28,7% dos passes terminam no último terço, aqui ~9%) e
`utilidade.cruzamentoP` com um na área 0,06 → 0,2 (The Analyst: ~3,7% dos passes são cruzamentos, aqui ~1,3%). Na partida do
9933ea0e, `teste-intercepta` A (12 partidas, sementes 301–312): passe certo 86,7 → 86,0%, interceptações 10,79 → 10,25 (meta
≥ 10,25: no limite), último terço 9,4 → 11,0% dos passes, cruzamentos 1,3 → 2,4%, chutes por partida 6,6 → 8,5. O
`teste-defesa-corrida` reprovava os gols do roteiro sprint com 12 partidas (1,58; a mesma conta foi de 1,42 a 1,67 entre
versões que não mexem na defesa da arrancada): com 24 partidas, 1,21 (9933ea0e) → 1,29 (candidato), meta ≤ 1,5 — a amostra
cresceu para 24. Decisão pelo painel de 144 do CI.

Gols de fora da área (painel do bf918606: 11,5%, meta 12–18%; goleiro de 16,5 m ou mais 86,2%, meta ~85%):
| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| Premier League / Opta, "Why are players shooting less from long range this season?" (premierleague.com/news/4272809) e Jonathan Wilson (The Guardian, dados Opta) | 2024/25: 11,5% dos gols de fora da área, o mínimo desde 1992; 2006/07: 20,2%; desde 2003/04, 14,3% em média, com o chute de longe convertendo ~3,7% | O nosso 11,5% é o do ano mais baixo; a meta 12–18% fica com a média. O chute de fora daqui já converte ~6,7% (poucos chutes e precisos demais: 65% no alvo), então o ajuste não aumenta o volume de chutes de longe (`chuteLonge` fica em 0,25, os chutes de fora já estão em 36,9%, meta 35–40%) |
| The Analyst / Premier League, goleiros 2024/25 (premierleague.com/news/4293708; theanalyst.com) | O melhor goleiro da PL defende 73,5% dos chutes no alvo; o pior, 51,5% | O total daqui (69,2%) fica na meta 66–72%; o ajuste mexe só no chute de longe |
`GOLEIRO.logit.cLongePartida` −0,035 por m de chute além de 15 m do goleiro (só na partida; o treino e o pênalti não mudam):
`teste-bolas-paradas` D4 (tiros livres de 18–31 m) gol 8,5% (meta 2–12%), `teste-goleiro` e `teste-mergulho` PASSOU,
hash-igual IGUAL. Decisão pelo painel de 144 do CI.

## 12. Bolas paradas no estilo FIFA: câmera atrás do cobrador e linha de trajetória com curva (pedido do dono, 16/10)

Pedido (com a imagem do EA FC: câmera baixa atrás e ao lado do cobrador do escanteio, uma linha amarela → azul saindo da
bola e o rótulo "CHIP" embaixo): "nos escanteios, pênaltis, faltas e tiros de meta, quero que tenha igual no fifa, uma
espécie de 3ª pessoa, quase uma 1ª pessoa mas não é, que fica atrás do jogador [...] e eu quero que tenha essa linha no
escanteio, e na falta, que tenha como colocar curva".

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| Red Bull, "EA Sports FC 25 set piece guide" (redbull.com/gb-en/ea-sports-fc-25-set-piece-guide) e Team Gullit, "EA FC 25 set pieces" (teamgullit.com/ea-sports-fc-25/set-pieces) | Falta: o analógico esquerdo mira (alinhando com a barreira), o direito põe a curva, a força é segurar o chute (~1,5 barra perto da área, ~2,5 mais longe); o atributo do cobrador manda na curva e na precisão | A divisão dos controles: o analógico GIRA a mira, a carga do botão é a força e a curva é um controle à parte (analógico direito no controle; Z/X no teclado; dois botões CURVA no toque); o efeito máximo e o erro saem do atributo (`MIRA.giroAtrib`; o erro do chute/lançamento do jogo) |
| fut.gg, "FIFA 23 Guide: How To Take Free Kicks"; Charlie Intel, "FIFA 23 set pieces" (charlieintel.com/fifa-23/fifa-23-set-pieces-free-kicks-corners-penalties-188966) | No sistema novo de falta a linha de trajetória mostra só os primeiros metros; um texto diz o tipo de batida que está montada; a força pelo botão | No CHUTE a gol a linha vai só até 4 m além da barreira (`MIRA.linhaChute`; sem barreira, 11 m): mostra se passa por cima dela e como a curva começa, não onde entra (a falta continua difícil). O rótulo de COMANDO do tipo (ALTA, TENSA, CHUTE, CURTA, LONGA) embaixo, no lugar do "CHIP" da imagem |
| A imagem do dono (EA FC) | Câmera baixa (~altura de uma pessoa), atrás e um pouco ao lado do cobrador, a área no meio do quadro; a linha sai da bola até a área (escanteio: a trajetória inteira) | `CAMERA_BOLA_PARADA`: 4,6 m atrás, 1,9 m para o lado (o cobrador fica de um lado da bola), 2,6 m de altura; o olhar e o fov pela conta (a bola a 76% da altura do quadro, o alvo a 40%). No escanteio, no tiro livre longe e no cruzamento a linha vai até a bola cair |
| Passmore et al. 2012; Whiteside 2010 (já na §4 e na PESQUISA-ETAPA2) | Magnus pela razão de giro; efeito de 30–40 rad/s no chute de falta | A curva é giro no eixo vertical (`MIRA.giro` 38 rad/s × 0,7–1 pelo atributo) pela MESMA física da bola (bola.js): a linha é a simulação passo a passo da própria bola (`mira.js simularLinha`), então a bola de verdade passa a 0,0 cm dela sem o erro do cobrador (`teste-mira` A) |

Medido (`teste-mira` E, canhão de 96 escanteios e 96 tiros livres diretos de 18–30 m com o humano roteirizado; a mesma conta
na main com o humano de antes: o analógico para a zona / o canto e o botão):

| | antes (main) | depois (mira perfeita pela linha) | real |
|---|---|---|---|
| escanteio do humano: gol em ≤ 8 s | 5,2% (5/96) | 10,4% (10/96) | 2,6% (Copa 2022); a IA × IA do jogo: ~13% (`teste-bolas-paradas` C3) |
| tiro livre direto do humano: gol · no alvo | 3,1% · 11,5% | 8,3% · 13,5% | 5–7% (pedido); Opta 2,4–4,4% |

O roteirizado do "depois" é o teto: acha a melhor mira simulando a trajetória INTEIRA (a pessoa só vê os primeiros metros
na falta) e acerta a força no tick. Os dois ficam nas faixas dos canhões da IA (escanteio ≤ 12%, falta 2–12%). O gol de
escanteio acima do real é o do jogo inteiro (o goleiro ainda não sai no cruzamento: pendência da Etapa 4, parte 3b).

## 13. Goleiro realista: defesa pela dificuldade, encaixe × espalmada, set, 1×1 e saída no cruzamento (pedido do dono, 15/10)

Pedido: "os goleiros se movimentando melhor e as espalmas e as seguradas de bola mais realistas, ele defende mais bolas
difíceis do que fáceis" — e a pendência #114 (sair no 1×1 e no cruzamento). O diagnóstico (canhão da main, 16 partidas,
2.535 chutes no alvo) achou: a chance de defesa só pesava a distância do chute (a bola no corpo de perto virava gol em
34%; a de 3 m de lado de 25–30 m era defendida 70–85%), o sorteio que falhava deixava a bola atravessar o corpo (58 gols
"pelo corpo"), o encaixe não dependia da força nem da altura (a bola no meio de chute de < 12 m espalmada 74%), toda
espalmada ia para fora (rebote < 2%; 1,6% entravam no próprio gol), o goleiro nunca saía no 1×1 nem no cruzamento e
estava "set" (os dois pés no chão) em só 29–34% dos chutes. Contrato: `CONTRATOS.md`, "Goleiro realista (16/10)".

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| StatsBomb open data (github.com/statsbomb/open-data), medido aqui: 348 partidas (Copas 2018/2022, Euros 2020/2024, Copa América 2024, AFCON 2023, Bundesliga 23/24), 2.662 chutes no alvo com o goleiro no freeze-frame | Defesa 71,1%; pela distância lateral goleiro → bola: < 0,5 m 93% · 1–1,5 m 80% · 2–2,5 m 67% · 3–4 m 34% · ≥ 4 m 17% (alta a ≥ 4 m: 8%); o terço fácil (P ≥ 0,8) defendido ~97%, o quinto difícil 18%; a fórmula da Etapa 2 subestima o meio da curva | A chance pela FOLGA física (alcance no tempo que sobra − lateral), não pela distância do chute (`chanceReal`); a bola no corpo sempre parada; a bola alta longe do corpo com o termo `cAlto`; as metas A do `teste-goleiro-realista` (o corpo ≥ 90%, a curva cai faixa a faixa) |
| Idem, 1.893 defesas ligadas ao chute | Segura 47% (em pé 52%, mergulho 28%; em pé baixa 55%, alta 42%; mergulho alto 4% e 72% para fora); duas mãos 66%, uma mão 5–6%; de < 11 m segura 38%, de ≥ 25 m 63%; rebote perigoso 21% (mergulho baixo 30%) | `segura.emPe` / `mergulho` por altura (0,66/0,6/0,45 e 0,4/0,26/0,05), a bola forte escapa mais (`kV`), a da ponta dos dedos é espalmada (`folgaPlena`); o rebote perto, de lado (`rebater`), na bola forte em pé e no mergulho rasteiro de perto; metas B1–B5 (rebote do ataque 8–30% das espalmadas) |
| Idem, `goalkeeper.position` no chute (2.656 no alvo) | "Set" em 88,9% dos chutes → defesa 75,7%; "Moving" 8,6% → 39,3%; "Prone" 21,2% | O estado entra na conta (`atrasoDoEstado`: `semBase` s sem os dois pés no chão e parado, mais o tempo de frear) e o movimento busca o set: zona com histerese, set com o chute armado, passos curtos perto do ponto (`velPosicao`); meta C1 |
| Idem, `one_on_one` (364) e "Keeper Sweeper" (685 em 696 goleiro-partidas) | 1×1: 23,4% de gol, 63% das no alvo defendidas, quase tudo em pé/bloqueio; saída na bola ~1,0 por goleiro por partida, 74% encaixe, quase todas na área | O 1×1 sem a regra dos 0,8× (`umXumPartida`), fechar na bissetriz até `umXum.max` m e cair na bola do toque longo (`abafar`); a bola solta da área (`varrer`); metas D1 (≥ 0,5 saída de 1×1 por partida) e D2 (≥ 1 bola solta) |
| Idem, cruzamentos (20,8 por partida na área) e escanteios (9,2) | O goleiro intervém em 8,2% dos cruzamentos (encaixe 60%, soco 34%) e em 10,7% dos escanteios longos (soco 62%); quase sempre na pequena área (≤ 5,5 m: 19,9%); com o toque dele o gol do lance cai de 3,4% para 0,7%; escanteio vira gol em 2,5% | A saída no alto só no ponto que ele alcança antes do cabeceio, perto da linha (`cruz.dist` 8,5 m) e na altura das mãos; soco quando contestado ou com a bola rápida, senão encaixe (`saidaNoAlto`); meta E1 (≥ 2% dos escanteios) |
| StatsBomb, "The Enigma of Shot Placement" (blogarchive.statsbomb.com/articles/soccer/the-enigma-of-shot-placement/); American Soccer Analysis, "A Deep Dive Into Shot Location and Placement" (MLS 2011–16) | No meio baixo/médio só 12–13% viram gol; nos cantos 50–60%; a bola que obriga a atravessar o gol ≈ 3× a do corpo; o 2º pau converte 2–3× o 1º | A curva monotônica (meta A3: corpo > exige < 2 m/s > 2–5 m/s > ≥ 5 m/s) e a dificuldade medida pela física no teste (lateral e tempo de voo), não pela conta do jogo |
| Ibrahim et al. 2019, Frontiers in Sports and Active Living (10 goleiros de elite) | Base de 75% da perna e joelho a ~55° dão o mergulho mais rápido; ~1 s do sinal até a mão na bola do canto | A base de goleiro (`mov.base`, `agacha`, `inclina`: pés mais abertos, quadril baixo, tronco para a frente; o mergulho parte dela) e o braço que demora a esticar (`alcance.tReflexo`/`tEsticar`) |
| Gryszczenko et al. 2024, Retos 57 (Copa 2018, 669 finalizações); J-STAGE (430 mergulhos, split-step) | Postura preparatória em 91%; antecipar (sair antes de ler) em 61% e associado a MAIS gols; o goleiro decola junto com o apoio do pé do chutador | Ficar set com o chute armado e só reagir na leitura (o tempo de reação de antes); antecipar só a posição — a bola do condutor `antecipa` s à frente —, nunca o mergulho |
| Fatayri, Serykh & Gumin, "What drives a goalkeeper's decision?" (StatsBomb Conference 2022) | Modelo de mergulho: reação 0,2 s, impulsão 0,5 s, até 1,2 s; os goleiros reais vão mais para a bola e para os lados do que o ótimo | A forma do `alcanceReal` (reação, depois o deslocamento e o braço); a profundidade perto da linha com a bola junto da linha de fundo (`linhaPerto`) |
| The FA, "Different saving actions for goalkeepers" (learn.englandfootball.com) | Espalmar só quando não dá para segurar, para o lado e longe do perigo, nunca de volta para a área; no 1×1 a ≤ ~2,7 m bloquear ou cair na bola ganhável (smother), a 2,7–7,3 m ficar grande | A espalmada nunca para o gol nem para o meio (`estadoEspalmada`, `rebater` para o lado); o abafar na bola do toque longo; o corpo que bloqueia de verdade (`corpoNaBola`: nada atravessa o goleiro) |
| American Soccer Analysis, "Valuing goalkeepers with goals added" (2021); Hockey-Graphs 2015 (rebound control) | O valor da defesa = xRebound − xParry (o lugar do rebote pesa); a saída falha no cruzamento custa ~0,45 gol | O rebote existe e é perigoso (meta B5), mas sai de lado e perto, nunca para o meio; a saída no alto só quando chega (desiste se não chega: `cruz.tolera`) |
| FIFA Training Centre, "Goalkeepers dominating in the air" (Sub-17 2023) e "Dealing with crosses" (Sub-17 feminino 2024); Driblab, "Measuring aerials goalkeeper game" (40 mil cruzamentos) | ~1 saída no alto por partida, 84–92% de sucesso; ler a trajetória cedo, impulsão de um pé; escanteios que caem fora da pequena área raramente são pegos | `cruz.p` 0,93; a leitura pela trajetória prevista a cada `cada` passos, o pulo desenhado (tipo `'salto'`) com a mão na bola; a saída só perto da linha |
| Science for Sport, "Goalkeeper training: 5 key movement skills"; IDA Valencia, "How to handle 1v1 situations" | Shuffle (passos laterais curtos, sem cruzar) para ajustes; passo cruzado só para distâncias longas; no 1×1 sair no toque longo, parar e ficar set antes do chute | Os passos curtos perto do ponto (`vAjuste`), o fim de passo mais rápido na base (`ritmoFim`: para com os dois pés no chão); meta C3 (pés cruzados ≤ 10%) |
| EA, Pitch Notes FC 26 (Gameplay Deep Dive e Holiday Update); FIFA 22 TU#1; Destructoid (FC 25 "Deflector") | O posicionamento por aprendizado "não está ativo durante a defesa"; "deflection control": as deflexões fogem do perigo; no cruzamento soco × encaixe e "o tempo importa"; o mergulho no ângulo de perto ficou de propósito menos eficaz | O posicionamento só posiciona (a defesa é a desenhada); a espalmada para longe dos atacantes; o soco no cruzamento contestado; a bola alta de perto no canto quase indefensável (`cAlto` com a folga pequena) |

Medido (canhão do `medir-goleiro.mjs`, 16 partidas IA × IA, sementes 1001–1016, a mesma ferramenta e amostra do
diagnóstico; "exige" = (lateral − 0,5 m) ÷ (voo − 0,2 s), m/s):

| | antes (main) | depois | real |
|---|---|---|---|
| defesa: no corpo · exige < 2 · 2–5 · ≥ 5 m/s | 82,0 · 70,0 · 45,4 · 11,7% | 93,3 · 76,7 · 45,4 · 2,2% | lateral < 0,5 m 93% |
| no corpo de perto (chute < 12 m): encaixe | 25,2% | 66,2% | segura 47% (em pé 52%) |
| no corpo e lenta: segura | 58,6% | 77,2% | em pé baixa 55% |
| espalmadas para a linha de fundo · o ataque pega o rebote · gol de rebote | 96,6 · 1,6 · 1,6% | 72,0 · 15,3 · 7,5% | rebote perigoso 21% |
| no chute das partidas: parado · os dois pés no chão | 58,5 · 34,1% | 64,8 · 59,1% | "Set" 88,9% |
| saídas em 16 partidas: 1×1 · cruzamento · bola solta | 0 · 0 · 0 | 15 · 3 · 44 | ~1 por goleiro por partida |
| escanteio: gol · o goleiro toca | 7,7 · 7,7% | 5,6 · 14,3% | 2,5 · 10,7% |

Painel de 48 partidas (sementes 1001–1048) da 1ª versão: gols 1,65 → 1,85 e "as três metas do goleiro dentro pela
primeira vez" — **corrigido na revisão (21/10)**: era sorte das sementes 1001–1048. Com as 144 do painel (as do CI) a main
já estava nas três metas (68,5 / 60,0 / 85,2%) e a 1ª versão (96f66255) tinha gols 1,82 → 1,64, bola parada 25 → 13%,
escanteios 2,3 → 1,4 e, no canhão de contra-ataque, o 1×1 defendido 53,7 → 45,3% (a IA cavava em 47%).

### 13.1 Revisão adversarial (16–21/10): o que mudou e de onde veio cada número

Achados confirmados: o chute colocado (MOD + CHUTE) e a cavadinha tratados como cruzamento pela saída no alto (a saída
trocava a defesa já lida); a "bola solta" contando o chute do adversário no ar; o 1×1 que corria até 5,5 m da linha; o
encaixe no corpo (0,92) e o rebote sem fonte; as metas B1/B2/E1/A4/C1/D2 calibradas para passar. Medido aqui, nas mesmas
348 partidas da StatsBomb (eventos locais; scripts na pasta de trabalho da sessão):

| Fonte (StatsBomb open data, medido aqui) | O que diz | O que foi aproveitado |
|---|---|---|
| 729 defesas com a bola a < 0,5 m de lado | Segura 32% de < 12 m, 40% de 12–16,5 m, 59% de 16,5–25 m, 79% de ≥ 25 m | `segura.corpoDist` (antes 0,92 fixo: 72% de encaixe de perto); metas B1 (≥ 16,5 m: 50–80%, real 64,9%) e B2 (< 12 m: 20–45%, real 32,0%) |
| 1.006 defesas não seguras ("Touched Out" ÷ não seguras) | Para fora: em pé 26/30/72% (baixa/média/alta), mergulho 36/52/76% | `rebote.foraEmPe` / `foraMergulho` (antes o rebote só pela força) |
| 2.662 chutes no alvo, defesa pela distância lateral e do goleiro | ≥ 16,5 m: 85,4% (1.126); a ≥ 2,5 m de lado com o chute a ≥ 22 m: 64,8% (105); no corpo de perto (< 8 m): 85,5% | `erroLonge`/`latErro` (a leitura do chute de longe erra mais, fora do canto); meta A4 (50–80% e ≥ 15 pontos abaixo do corpo de perto) |
| Idem, jogadores entre o chute e o goleiro (a < 1 m do segmento) | Sem efeito mensurável (< 16,5 m: 59,5/59,1/65,3% com 0/1/2+; ≥ 16,5 m: 85,4/88,8/83,6%) | A "visão tapada" NÃO entrou |
| 8.417 chutes (sem pênalti) | 27,4% bloqueados (15,6% de < 11 m, 36,1% de 16,5–25 m); 25,8% dos bloqueados viram escanteio; o bloqueio é a maior origem de escanteio | `BLOQUEIO` (sim.js `bloqueioPerna`: a perna esticada de quem está perto e de frente; antes só o corpo, 0,31 m: 5,8% dos chutes bloqueados → 21,5%) |
| 7.077 cruzamentos de bola rolando (20,3 por partida) | 1,09 escanteio por partida sai de cruzamento (5,4%) | `BLOQUEIO.altoPasse`/`pertoPasse` (o cruzamento bloqueado perto do pé de quem cruza: 0,17 escanteio por partida de 5,6 cruzamentos, 3,1%) |
| Cortes de cabeça de cruzamento | Escanteio em 22% na pequena área, 7% a 5,5–11 m, 0,7% a 11–16,5 m; lateral 7–10% | `CABECEIO.afastaReal` (a bola sai pela física da testa, não pela intenção; antes nenhum afastamento de cabeça virava escanteio) |
| 364 chutes em 1×1 (no alvo) | Defesa 70,5% com o goleiro a < 2 m da linha, 68,4% a 2–4 m, 41,9% a 4–6 m | O goleiro só corre na bola do toque longo a que chega antes; com a bola no pé do dono, fica na posição (fechar até 2,5–3,5 m baixou o canhão para 49–51%); metas D1 (< 4 m no chute ≥ 90%) e G1 (≥ a main) |
| 685 "Keeper Sweeper" | 0,081 por chute (0,061 na área) | Meta D2 por chute (≥ 0,03; PENDENTE: hoje ~0,01–0,04) |
| "goalkeeper.position" (2.656 no alvo) | "Set" (parado) em 88,9% | Pés plantados parado na base (`setGk`, `alcanceSet`, `vSetPes`); meta C1 no instante do chute ≥ 80% (PENDENTE: hoje ~70%) |
| Escanteios longos | O goleiro toca em 10,7% (encaixe em 38% das saídas) | Meta E1 ≥ 7% (PENDENTE: hoje 2–3%, só socos); a saída no alto deixou de ser barrada pela leitura de chute da mesma bola (1,6 → 2,1–3%) |

Painel de 144 partidas (sementes 1001–1144, as do CI; base = main 278ff4b5 gravada; o merge da main de 21/10 só mudou o
Modo Livre e o Math → MD do anim.js/ia-ataque.js):

| medida | meta | main | 96f66255 | agora |
|---|---|---|---|---|
| gols por partida | 2,3–3,5 | 1,82 | 1,64 | 1,92 (pareado +0,10 ± 0,28) |
| chutes por partida | — | 8,4 | 7,7 | 8,8 |
| goleiro: no alvo · 6–16,5 m · ≥ 16,5 m | 66–72 · 55–60 · 80–90% | 68,5 · 60,0 · 85,2 | 70,3 · 58,5 · 88,7 | 66,5 · 58,8 · 84,5 |
| gols de fora da área | 12–18% | 13,9% | 12,7% | 14,2% |
| gols de cabeça | 8–18% | 15,1% | 12,7% | 11,7% |
| origem bola parada | 20–30% | 25% | 13% | 21% (gols de bola parada −0,05 ± 0,14 por partida) |
| escanteios por partida | — | 2,3 | 1,4 | 1,7 (pareado −0,60 ± 0,31) |
| chutes bloqueados | (real 27,4%) | 5,8% | — | 21,5% |
| pênaltis gol/defesa/fora | ~76/18/6% | 71/14/14% (7) | — | 90/0/10% (10) |

Os escanteios continuam abaixo da main: 90% dos escanteios da main vinham da espalmada (52% das defesas iam para fora;
real 20%). Com a espalmada pela StatsBomb, o bloqueio, o cruzamento bloqueado e o corte de cabeça devolveram 1,4 → 1,7; o
resto do escanteio real (cortes com o pé sob pressão, ~20 cruzamentos por partida contra ~6 daqui) é do volume de ataque
(Etapa 4.5). Pendências: C1, D2 e E1 (as metas da pesquisa ficam no `teste-goleiro-realista` como PENDENTE, `--estrito`).

### 13.2 Junção com a main (26–27/10, Categoria C, item 12)

O #493 ficou parado desde 21/10; a main ganhou a Categoria D (IA intensa) e o merge embaralhou as partidas. Dois itens do
`teste-goleiro-realista` passaram a reprovar e foram atacados na causa, não na meta:
- **G1 (contra-ataque 1×1, defesa ≥ a da main):** 52,3% contra 53%. Com a Categoria D a IA chega ao 1×1 mais rápido e
  o goleiro set não tinha a leitura do corpo do chutador que o goleiro real tem (StatsBomb, 364 1×1: 70,5% defendidos com
  ele a < 2 m da linha, quase tudo em pé/bloqueio; The FA: no 1×1 "ficar grande" e ler o chutador). `umXum.leitura`
  0,08 s só na finalização com o pé de quem estava sozinho, com o goleiro na base e sem desvio.
- **E1/E2 (escanteio):** a saída no alto que dava certo em 4,6% (real 10,7%) e o gol de escanteio a 10,6% no canhão
  (guarda ≤ 10%). Três causas medidas no canhão pareado (os mesmos 476 escanteios): o pulo da saída limitado pela
  velocidade do mergulho parado levava o corpo para TRÁS (a mão longe da bola) — o pulo agora é da corrida; o ponto da
  saída só até 2,2 m de altura (a mão no pulo vai a ~2,5 m, acima da cabeça de quem cabeceia, `cabeceio.js`) e o
  `chegaAntes` de 0,1 s (ele não precisa chegar parado); e o corte de cabeça com `vTesta` 7 (a bola caía na entrada da
  área e a 2ª bola virava gol: 7 em 476). Mais `folgaCabeceio` 0,5 → 0,8 (o cabeceio a gol no alvo defendido 60,5% → 68%;
  Opta/StatsBomb ~70%). Saída que dá certo 4,6% → 7,8%; gol de escanteio 8,4–10,6% → 6,9–7,0%.

### 13.3 O passe certo da branch e a bola que sobra (28/10, Categoria C, item 12)

O `teste-intercepta` A (passe certo 80–86,5%; Premier League 23/24: 82,9%) pegou a branch acima da main: 178 partidas
(sementes 601–760 e 1001–1018, o medidor do diagnóstico com a definição do teste) dão main 85,91% (± 0,18) e branch 86,62%
(± 0,17), Δ +0,71 ± 0,23 pt. A decomposição por origem da posse e pelo lance que deixou a bola solta (até 5 s antes)
mostra que o passe "de jogo corrido" não mudou (posse depois de corte de passe sem lance antes: 87,2% → 87,2%, ± 0,4) e que
a diferença vem de lances que o goleiro realista mudou de propósito: menos escanteios (2,34 → 1,86 por partida: o
escanteio tem o passe que mais erra) e o cruzamento do escanteio que chega a um companheiro (0% → 8,2%; real 42,7%), +0,25
pt; a bola espalmada que fica em jogo e a defesa recupera (0,35 → 5,9 passes por partida, 92% certos), +0,12 pt; o
bloqueio com a perna (+0,05 pt). Medido aqui na StatsBomb open data (215 partidas: Copa 2022, Euro 2024 e as 100 primeiras
da Premier League 2015/16; eventos baixados um a um; o 1º toque com controle depois do lance, até 15 s):

| | real (StatsBomb) | main | branch |
|---|---|---|---|
| defesas seguras ("Success" · "Saved Twice") | 36,0% · 10,4% (1.177 defesas) | 42,4% · 0 | 36,0% · 0 (211) |
| defesas que ficam em jogo sem segurar | 30,9% | 1,6% | 30,8% |
| rebote em jogo: o ataque toca primeiro | 42,7% ± 2,6 (349) | — | 44,4% ± 6,3 (63) |
| chute bloqueado em jogo: o ataque toca primeiro | 50,5% ± 1,6 (991) | — | 19,6% ± 5,3 (56) |
| a posse de quem defende depois da defesa: passes por posse, certos | 3,6 · 87,9% ± 0,9 | 6,1 · 86,0% | 6,9 · 88,1% |
| depois do rebote em jogo ("In Play Danger/Safe") | 4,4–5,9 · 86,7–90,3% | — | 9,7 · 91,9% |
| depois do chute bloqueado | 4,7 · 86,9% ± 0,9 | — | 7,9 · 89,7% |
| referência: jogo corrido sem lance antes | 87,2% | 87,2% | 87,2% |

O volume (31% das defesas em jogo) e quem pega o rebote batem com o real; a posse que nasce perto do próprio gol depois
do ataque do adversário é que é limpa demais no jogo TODO (na main, depois do cruzamento cortado: 11,5 passes, 93,2%; depois
do chute do adversário: 92,1%; o real dessas: 87,2% e 86,5%) — é a contrapressão de quem perdeu a bola na área (Categoria D)
e o erro do passe (E), não o goleiro. O que era defeito da branch: o chute bloqueado em jogo ficava com a defesa em 80% porque
o bloqueador DOMINAVA no passo seguinte a bola que saía da canela subindo a ~11 m/s (`sim.js bolaLivre`: a bola abaixo de
0,45 m era domínio no pé mesmo subindo) — ou um vizinho a matava no peito subindo a 10–19 m/s (`bolaAltaNoCorpo`). Com
`m.bloq.sobe` ninguém a domina enquanto ela sobe no 1º voo para cima de 0,45 m (96 partidas pareadas, 601–696):

| | real | branch | com a correção |
|---|---|---|---|
| chute bloqueado em jogo: o ataque toca primeiro | 50,5% ± 1,6 | 19,6% ± 5,3 (64 partidas) | 48,4% ± 6,3 (62) |
| depois dele, a posse de quem defende: passes, certos | 4,7 · 86,9% | 7,9 · 89,7% | 6,3 · 86,9% |
| `teste-goleiro-realista` D4 (dominada subindo; partidas + canhão) | — | 10 de 69 | 0 de 64 |
| passe certo (definição do `teste-intercepta` A) | PL 23/24: 82,9% | 86,85% | 86,56% (Δ −0,30 ± 0,16 pt) |

Painel de 48 partidas (1001–1048) contra a branch: gols 1,25 → 1,31, chutes 7,8 → 8,0, escanteios 1,8 → 1,9, passe 86,8 →
86,5%, metas fora da faixa 10 → 8 (gols de cabeça 22,2 → 16,4% e chutes de fora da área 41,7 → 38,1% entram); o
`teste-goleiro-realista` passa inteiro; `hash-igual` IGUAL (o treino não tem `bloqueioPerna`).
O que sobra sobre a main não está provado: na revisão independente, numa terceira amostra (2201–2264, 64 partidas
pareadas), main 86,43%, branch 86,57% e a correção 86,29%; juntando com as 96 de 601–696, a correção fica +0,27 ± 0,26 pt
sobre a main (160 partidas) — compatível com a main. A mistura nova se repete nela (+0,42 pt: rebote e escanteio realistas)
e a taxa vai para o outro lado (−0,28 pt); o que resta é a calibração da posse que nasce perto do próprio gol (D e E), não
o goleiro. Com a correção, o `teste-intercepta` A (96 partidas, 301–396) PASSA: passe certo 86,2%, interceptações 10,96,
homem livre 72,3%. O "Saved Twice" (o goleiro pega o próprio rebote; `GOLEIRO.reagarra` não
deixa) fica anotado: pela conta, mexe < 0,02 pt no passe certo.

## 14. Goleiro espalma bola alta e nada atravessa o goleiro (C3, item 14 da FILA; pedido do dono de 17/10)

Pedido: "o goleiro ESPALMA bola alta, hoje só rasteira e meia altura". A FILA dizia "encaixe da bola alta em 34–39%
(StatsBomb: 4%)". Conferido aqui antes de mexer: o 34–39% é do TREINO (o mundo do `teste-mergulho`, a logística de antes:
35,3% dos 85 mergulhos/saltos defendidos com a bola a ≥ 1,9 m e ≥ 1,2 m de lado); o 4% é só o MERGULHO no real. Na PARTIDA
(o goleiro realista do C1) o mergulho nessa bola já espalmava (91%); o que ainda segurava demais era a bola por cima do
goleiro adiantado (a conta do treino, 0,6) e o "pegou" da mão desenhada passando perto da bola antes do contato sorteado.
Contrato: `CONTRATOS.md`, "Goleiro espalma bola alta e nada atravessa o goleiro (C3)".

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| StatsBomb open data (github.com/statsbomb/open-data), medido aqui: 728 partidas (Copas 2018/2022, Euros 2020/2024, Copa América 2024, AFCON 2023, Bundesliga 23/24, Premier League 15/16), 4.106 defesas de chute sem pênalti com o goleiro no freeze-frame e a altura da bola na linha (`end_location` z) | Bola a ≥ 1,9 m e ≥ 1,2 m de lado do goleiro (107 defesas): encaixe 29,9%, para fora 50,5%, uma mão 42,1%; só o MERGULHO (44): encaixe 2,3%, para fora 77,3% (79,1% das não seguras, IC 95% 65–89%), em jogo 20,5%, uma mão 61,4%, duas 34,1%; em pé (63): encaixe 49,2% (o goleiro que chega embaixo dela com tempo) | As metas do `teste-mergulho` H: no mergulho, espalmada ≥ 85% (a meta da FILA cabe no real do mergulho, não no da população inteira — 70% não seguras); H4 "para fora" com o rebote na faixa do real (65–95%; a FILA pedia ≥ 90%, acima do real: fica ≥ 90% só na espalmada de propósito, H3, que sai por cima do travessão); uma mão como o desenho da espalmada alta (o real tem 61% de uma mão: as duas mãos ficam no mergulho curto e no salto) |
| Idem, a bola a < 1,2 m de lado (246) | Encaixe 20,7%, para fora 58,1%, uma mão 43,5%, duas 55,3% | Perto do corpo ficam as duas palmas (`umaMao.lado`; o salto com as duas mãos acima da cabeça, B10) |
| Idem, o goleiro adiantado (a distância à linha no freeze-frame) com a bola a ≥ 1,9 m na linha | A < 1 m 34,0% de encaixe (106); 1–2 m 21,6% (153); 2–3 m 18,6% (59); ≥ 3 m 8,6% (35) — a ≥ 2 m, 14,9% (14 de 94) | `GOLEIRO.realista.segura.recuoAlto` [1,8 m, 0,15]: a bola alta por cima do goleiro que volta segura 15% (antes ~64% das que ele alcançava; no teste, H1b 36,7% → 13,3%) |
| Everybody Soccer, "The Pros and Cons of a Top Hand and Bottom Hand Save" (everybodysoccer.squarespace.com, 2018) | A mão de cima é a do ombro mais perto do travessão no mergulho (para a bola à direita do goleiro, a esquerda); a escolha só conta no terço de cima do gol; a de cima alcança mais longe e é a preferida para espalmar por cima ou pela trave e no "de volta para o travessão"; a de baixo é mais rápida, para a reação de perto | `maoDaEspalmada`: a mão de cima (o ombro mais alto no contato) no mergulho alto e no salto do goleiro que volta; `umaMao.y` 1,63 m (o terço de cima de 2,44); a de baixo só quando a de cima não chega |
| Carlisle United, "Academy: keeper training part four" (carlisleunited.co.uk, 2014); Sport Session Planner, "Tipping over the Crossbar" e "Lobs & Top Hand Saves" | Espalmar com uma mão, a palma (mais força) empurrando a bola por cima do travessão; voltar com o passo cruzado e ficar de lado para a bola | A palma no lado da bola que dá para o ombro (atrás e embaixo dela, `umaMao.palma` = o raio da bola) e a outra mão só acompanhando (`umaMao.outra`); a espalmada alta continua saindo por cima do travessão (`espalmar`, acima de 1,85 m: H3 100%) |

Citado nos resumos de busca e não lido (não entrou): um estudo de biomecânica que compara a mão de cima e a de baixo no mergulho
alto (a de baixo para distâncias grandes de lado, a de cima com a saída cedo) — o PDF (shobix.co.jp/jssf, P-085) não abriu
aqui.

Medido (`teste-mergulho` H e I, partida copiada da semente 5; antes = main 02f4ec4a):

| | antes | depois | real |
|---|---|---|---|
| H1 mergulho na bola alta (≥ 1,9 m, ≥ 1,2 m de lado): espalmada | 90,9% (80/88) | 90,9% (80/88) | 97,7% |
| H1b a mesma bola por cima do goleiro adiantado: seguras | 36,7% (11/30) | 13,3% (4/30) | 14,9% |
| H2 espalmada com UMA mão (a de cima) na bola, acima da cabeça | 2,7% (3/113) | 83,3% (105/126) | 61,4% (mergulho) |
| H4 espalmadas para fora em 3 s (com o rebote) | 81,4% | 82,5% | 79,1% |
| H5 a espalmada sorteada vira "pegou" antes do contato | 21 de 370 | 0 de 370 | — |
| I1a fora da área, a bola bate no ar (> 5 cm da casca do corpo desenhado) | 1 de 1 | 0 de 41 | — |
| I1b fora da área, sem bater, a bola entra > 2 cm no miolo do corpo desenhado | 17/600 | 0/600 | — |
| I2 a saída que falha (com a mão forçada a não chegar): a bola dentro do corpo do pulo / batida no ar | 3/30 (a mão 1 de 1) / — | 0/76 (a mão 0/26, 26 batidas) / 0 de 51 | — |
| I3 o goleiro atrás da bola "defende" a 18–45 m dela | 4/120 | 0/120 | — |

Revisão de 29/10 (o 1º C3 reprovou): o "corpo" da colisão era um cilindro fixo no centro lógico do goleiro, de 0,9 a 1,75 m
— a bola batia no AR acima da cabeça do goleiro agachado na base (a cabeça desenhada a 1,28–1,53 m; até 32 cm do corpo) e
entrava no peito, que fica 0,11–0,20 m à frente do centro com o tronco inclinado (até 15 cm, sem contato); e o I1 de antes
media contra o próprio cilindro (circular). Agora a colisão é com o corpo DESENHADO (as cápsulas do manequim — afuniladas e
achatadas frente–trás, como o render/jogador3d.js as desenha — e a cabeça) na pose do passo, e o teste mede pelo desenho entre
dois limites independentes da conta (o miolo e a casca). No 1º C3 (a mesma ferramenta): I1a 8 de 130 batidas no ar (até 19,8
cm), I1b 28/600, I2 34 de 38 batidas no ar (o bloqueio pela previsão de 8 passos com os raios grossos do C1). Não há fonte
externa para isto: é a regra "o que se vê é o que acontece" (a mesma do cabeceio pela cabeça desenhada, `sim.js
cabecaNaBola`).

| Fonte (revisão de 29/10) | O que diz | O que foi aproveitado |
|---|---|---|
| Erin Catto, "Continuous Collision", GDC 2013 (box2d.org/files/ErinCatto_ContinuousCollision_GDC2013.pdf) | Testar só a posição do fim do passo deixa o objeto rápido atravessar ("tunneling"); a saída é o tempo do impacto (TOI); achar a raiz por bisseção é "simples mas incrivelmente robusto" quando há um intervalo que a cerca; parar a bola no TOI "perde um pouco de tempo" do passo | `sim.js colisaoCorpoGoleiro`: o caminho do passo em pedaços de 5 cm acha o 1º pedaço dentro do corpo (o intervalo), 7 bisseções (~1 mm) dão o ponto de entrada, e a bola fica no último ponto fora, refletida pela normal — o resto do passo fica perdido (no máximo ~0,45 m de um chute forte, um passo) |
| Yue Jia e Mark Harman, "An Analysis and Survey of the Development of Mutation Testing", IEEE TSE 37(5), 2011 | Um teste só é adequado se "mata" os mutantes — cópias com uma falha de propósito; o mutante que sobrevive mostra o caso que o teste não cobre | As mutações da revisão (a colisão sem a saída que falha, o "pegou" por cima da espalmada) e as daqui (9 no total) rodadas no `teste-mergulho`; a M5 sobrevivia — a mão que não chega quase nunca acontecia com a bola indo ao corpo — e o I2 ganhou o grupo da mão forçada a não chegar |

Painel de 144 em duas amostras (base = main 02f4ec4a, pareado por semente). 1001–1144: 121 partidas idênticas, 23 mudam; gols
1,65 → 1,68 por partida (Δ +0,028 ± 0,058), goleiro 67,2 → 67,6% (6–16,5 m 57,4 → 56,6%, de fora 86,7 → 87,4%: as três metas),
gols de cabeça 16,7 → 15,2%, impedimentos 1,03 → 1,01. 7001–7144 (a da revisão): 125 idênticas, 19 mudam; goleiro no alvo 66,5 →
66,3% (o 1º C3: 65,8%, fora da meta), impedimentos 0,89 → 0,87. Juntas (288): impedimentos Δ −0,024 ± 0,049 (z −0,98), goleiro
66,3 → 66,3% (IC95 do bootstrap pareado [−0,88; +0,79] ponto). O impedimento caía nas duas: uma amostra NOVA de 288
(4001–4288; 246 idênticas, 42 mudam) decide — impedimentos 1,03 → 1,07 (Δ +0,031 ± 0,040, o sinal ao contrário), goleiro 68,0 →
68,3% (6–16,5 m 59,1 → 59,6%, de fora 83,7 → 83,1%). As 576 juntas: impedimentos 1,00 → 1,00 (Δ +0,003 ± 0,032), goleiro 67,5 →
67,6% (57,6 → 57,5%, 84,7 → 84,6%; IC95 do bootstrap pareado [−0,52; +0,78] ponto), gols 1,72 → 1,71, gols de cabeça 14,1 → 13,4%
(Δ −0,010 ± 0,013 por partida, z −1,6): era sorteio — só ~15% das partidas mudam e, depois da 1ª defesa diferente, o jogo é outro.
`teste-goleiro-realista` em 24 sementes (1001–1024), main → agora: D2 (bola solta da área) 0,020 → 0,015 por chute (4 → 3
lances; as duas abaixo de 0,03), E1 (escanteio, sai e soca) 8,5 → 8,3%, E2 (gol de escanteio) 7,2 → 8,2% (z ≈ 0,7), B1 (no corpo,
≥ 16,5 m, segura) 63,5 → 54,2% — pareado pela cena, a queda é toda da bola por cima do goleiro adiantado (27 de 256 cenas; o
`recuoAlto` acima, StatsBomb 14,9%); sem ela, 62,0 → 64,0%. No canhão essa bola é 20% das cenas do B1 (a altura na linha sorteada
uniforme até 2,3 m com o goleiro a ~3 m); na StatsBomb, o goleiro a ≥ 2 m com a bola a ≥ 1,9 m é 2,3% das defesas (94 de 4.106).
O chute com a barra cheia no ângulo (C2) contra o goleiro realista posicionado, a grade da sonda do C2 só com o analógico nos
cantos (2.160 chutes, os mesmos nas duas versões): gols 68,2% → 68,3% (Δ +0,1 ± 0,1) — a espalmada alta nova não é defesa
"milagrosa": a chance não mudou, só o desenho.

## 15. Reposição do goleiro com a mão: rolar, arremessar por cima do ombro e o bate-pronto (C5, item 16 da FILA)

**O que estava.** Com a bola nas mãos, a IA só dava o chutão (a bola ia ao chão no pé dele e saía o LANÇAMENTO, `sim.js
goleiroComBola`); o "PASSE com a mão" do humano era o passe rasteiro com o pé a partir do chão; não havia gesto (a bola
pulava das mãos para o chão num quadro).

**O real (StatsBomb open data, medido para esta entrega; `pass.body_part` do passe do goleiro na bola rolando: "Keeper Arm"
= arremesso, "Drop Kick" = bate-pronto/chutão, e o passe com o pé depois de pegar com a mão na mesma posse = a bola no chão).**
Scripts fora do repositório (`sb_repos2.py` na pasta de trabalho da sessão); 149 partidas, 1.915 reposições da mão.

| Competição | partidas | com a mão | bate-pronto/chutão | no chão (pé) | certas com a mão | certos do bate-pronto |
|---|---|---|---|---|---|---|
| Premier League 2015/16 (40) | 40 | 56,3% | 41,2% | 2,6% | 94,2% | 32,7% |
| Bundesliga 2015/16 (34) | 34 | 61,2% | 35,6% | 3,2% | 93,6% | 32,1% |
| Copa do Mundo 2022 (24) | 24 | 79,4% | 18,0% | 2,6% | 98,6% | 22,4% |
| Euro 2024 (51) | 51 | 80,9% | 16,0% | 3,0% | 98,0% | 36,7% |
| **total** | 149 | **68,1%** | 29,0% | 2,9% | **96,1%** | 32,3% |

- Distância do arremesso: p10/p25/p50/p75/p90 = 10,3 / 14,3 / 19,4 / 27,4 / 35,7 m. Até 15 m: 28% (99% certos, 99% rasteiros);
  15–25 m: 42% (99%, 88% rasteiros); 25–35 m: 19% (96%; rasteiro 53%, baixo 31%, alto 16%); 35–50 m: 9% (84%, quase todos no ar).
- O bate-pronto/chutão: mediana 57,7 m (p25 51,3, p75 65,1), alto em 98%, 32% certos (a disputa no alto).
- Sem sinal de pressão no momento da reposição (StatsBomb marca "under pressure" em 0% delas: o adversário não pode
  pressionar o goleiro com a bola nas mãos — Regra 12.3); a escolha é pelo campo, não pelo goleiro pressionado.

| Fonte | O que diz | O que foi aproveitado |
|---|---|---|
| StatsBomb open data (acima) | A mistura mão × pé por competição, o acerto e a distância | `GOLEIRO.reposicao.livre`/`riscoMax`/`rolarMax`: a IA arremessa quando há companheiro livre (fração 55–82% = a faixa das 4 competições); rola até 30 m (até 25 m 97% rasteiros, 25–35 m metade); por cima acima disso; o teste (A1–A4) |
| van den Tillaar & Ettema 2004, J Sports Sci Med 3(4):211 (jssm.org) | Arremesso por cima com bola de 0,409 kg: ~21,5 m/s (handebolistas experientes) | `vOmbro` 19–24 m/s pela força e pelo passe longo (o goleiro com a bola maior, que a mão agarra menos) |
| Gutiérrez-Davila et al. 2012, J Hum Kinet 34:41 (PMC3590836) | 24–25 m/s no arremesso de handebol de elite | o teto de `vOmbro` (24) |
| EA FC 25, controles (fifplay.com/fc-25-controls) | Goleiro: Throw/Pass (X/A: rola curto, arremessa mais longe), Driven Throw (R1+X), Drop Kick (◯/▢), Driven Kick (R1+▢), Drop Ball (△) | PASSE = arremesso (rola; por cima com a barra cheia — o "driven throw" — ou longe), LANÇAMENTO = bate-pronto (o "driven kick": mais baixo e mais tenso), CHUTE = chutão, ENFIADA = no chão (já era) |
| Human Kinetics, "Understanding the goalkeeper as an orchestrator" (us.humankinetics.com, trecho de livro de treino de goleiros) | "O drop kick é um golpe de meia-volta" (a bola toca o chão e o pé bate logo depois), mais preciso que o punt para avançar a bola | `reposicao.js`: o bate-pronto chuta no tick depois do quique; o chutão bate no ar a `yChutao` 0,42 m |
| Linthorne & Patel 2011, "Optimum projection angle for attaining maximum distance in a soccer punt kick", J Sports Sci Med 10(1):203 (PMC3737918) | No punt do goleiro a velocidade de saída fica quase igual em todos os ângulos (22–28 m/s; 27,1 m/s no ângulo preferido) e o ângulo ótimo para a distância é alto (49–52° nos dois goleiros medidos) — o punt é a bola ALTA | o bate-pronto mais BAIXO e mais tenso que o chutão (`ACOES.batePronto` 11,5–17°; o chutão é o lançamento do C4, 18–26°, sobe até `elevAlta` quando precisa) |

**O que mudou** (só na partida; o treino segue como era, `hash-igual` IGUAL): o gesto em `js/reposicao.js` (puro); a IA
escolhe pela pressão (`acoes.js alvoReposicao`: `escolherAlvo('reposicaoMao')` com a nota do passe e o `riscoLinha` — com a
distância ao SEGMENTO: o adversário 20 m além do recebedor, perto da reta, contava como na linha e dava risco 1 em quase
toda reposição medida —, só o companheiro fora da própria área, sem adversário a menos de 10 m e com risco ≤ 0,2); o
arremesso em `acoes.js arremessoGoleiro` (rolando: a velocidade do passe rasteiro para a distância, até o braço; por cima:
chega a quem recebe na coxa/peito, como o curto do lateral); o bate-pronto pela conta do lançamento com `ACOES.batePronto`.

**Medido** (`tools/teste-reposicao.mjs`, 6 partidas da demo, 104–107 reposições do canhão; main → agora): com a mão 0% →
69,2% (rolar 66, por cima 6; chutão 32); certas com a mão — → 93,1% (meta ≥ 90%: StatsBomb 96,1%); distância mediana — →
24,5 m (p25 22,3, p75 27,5: o time abre a ~25 m do gol com a bola no goleiro — `ia-tatica.js` —, mais longe que o real, 19,4 m);
perda a < 40 m do próprio gol logo depois 9/107 → 10/104 (informativo; o painel decide). Painel de 144 (1001–1144, a main
973de847 com as mesmas sementes): gols 1,76 → 1,76, passe certo 86,5 → 86,8%, interceptações 10,88 → 10,73, último terço
42,6 → 42,4%, origem "erro na saída de bola" 35 → 31%, goleiro 67,0 / 60,2 / 82,5% → 66,3 / 56,2 / 85,4%: nenhuma meta que
estava na faixa saiu (a de 6–16,5 m, fora na main, voltou).

**Pendente/limites.** A distância do arremesso fica acima do real (mediana 24,5 × 19,4 m): o time abre a ~25 m do gol com a
bola no goleiro e quase não há companheiro livre a 10–18 m; aproximar o apoio é da IA (categoria D), não daqui. O arremesso
por cima chega a quem recebe na coxa/peito; os poucos que se perdem (5 de 72) são a bola que o recebedor não domina no ar —
o domínio aéreo é o de sempre. A IA não usa o bate-pronto (só o humano): o real mistura os dois no "Drop Kick".

