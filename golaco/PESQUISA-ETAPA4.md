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
