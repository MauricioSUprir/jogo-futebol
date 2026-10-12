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
