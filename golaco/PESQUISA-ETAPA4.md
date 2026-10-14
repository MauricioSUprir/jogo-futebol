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
