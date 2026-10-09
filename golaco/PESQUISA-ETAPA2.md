# PESQUISA — Etapa 2 (passes, chute, goleiro e controles)

Este documento reúne as constantes, as regras e as metas da Etapa 2 do GOLAÇO novo (`golaco/`): os botões PASSE, ENFIADA, LANÇAMENTO (que vira CRUZAMENTO na faixa lateral do último terço), CHUTE e GOLEIRO, o domínio e a IA de passe. Ele complementa o `golaco/PESQUISA.md` da Etapa 1.

**Como ler:**
- **Unidades e medidas.** Tudo está no SI. A distância de chute é medida até o centro do gol.
- **"Análise própria" e "cálculo próprio".** São contas feitas nesta pesquisa sobre dados abertos (StatsBomb e Metrica).
- **Volumes "por partida".** São de 90 min, somando os dois times quando o texto diz isso. Precisam ser escalados pelo tempo de jogo do GOLAÇO.
- **Velocidade média não é velocidade de saída.** A velocidade "média" é distância ÷ tempo. A velocidade de saída sai da rolagem e do voo de `bola.js` (`velParaDistancia`).

## 1. Constantes

### 1.1 Passe rasteiro

| Constante | Valor proposto | Fonte |
|---|---|---|
| Tempo do passe rasteiro, do toque à recepção (mediana) | 5–10 m: 0,89 s · 10–15 m: 1,13 s · 15–20 m: 1,39 s · 20–25 m: 1,64 s · 25–30 m: 1,87 s · 30–40 m: 2,20 s | StatsBomb-149 |
| Velocidade média no trajeto (d/t) | 8,7 · 10,8 · 12,4 · 13,6 · 14,6 · 15,0 m/s nas mesmas faixas. O p25–p75 fica em ±2 m/s da mediana | StatsBomb-149 |
| Velocidade média por faixa (rastreamento) | < 15 m: 10,4 m/s (p10–p90 6,3–16,1) · 15–30 m: 13,2 (9,0–18,6) · > 30 m: 15,7 (11,0–19,4) | Metrica |
| Tempo de voo (rastreamento) | Mediana / p90: < 15 m 0,96 / 1,52 s · 15–30 m 1,56 / 2,28 s · > 30 m 2,52 / 3,56 s. Passe de 20 m: ~1,0–2,3 s | Metrica |
| Velocidade de saída do passe firme | ~16 m/s (16,20 m/s medidos). Teto do rasteiro forte: ~18–19 m/s | Pfaff 2022 |
| Desaceleração | Vem da rolagem calibrada de `bola.js`. Não usar os 7,93 m/s² de Pfaff: eles parariam uma bola de 16 m/s em ~16 m e contradizem os tempos do StatsBomb | Pfaff 2022 × StatsBomb-149 |
| Velocidade da bola no pé (passe ASSISTIDO) | ~6–10 m/s, calculada pela rolagem | eFootball v2.2.0 |
| Acerto por distância (bola rolando; meta ±5 pontos) | 5–10 m 90,6% · 10–15 m 91,9% · 15–20 m 90,2% · 20–25 m 86,8% · 25–30 m 81,0% · 30–40 m 70,5% · 40–50 m 51,0% · 50–60 m 39,0% · 60–80 m 26,9%. Geral 84,5%. O 0–5 m (50,8%) é toque curto disputado e não serve de meta | StatsBomb-149 |
| Acerto por altura | Rasteiro: 94–96% de 5 a 30 m e 90,9% de 30 a 40 m. Alto: 41–60% de 5 a 50 m | StatsBomb-149 |
| Mistura de alturas | 78% rasteiros (mediana 13,3 m), 8,2% baixos, 13,8% altos (mediana 29,2 m) | StatsBomb-149 |
| Pressão, direção e terço | Sob pressão: 86,2% → 73,9% (≈ −12 pontos). Para frente 78,2%; para trás ou para o lado 94,4%. Por terço: defesa 83,3%, meio 88,6%, ataque 76,4% | StatsBomb-149 |
| Último terço, por time e por partida | 111,7 passes (76,4%). Para frente (≥ 5 m, sem cruzamento): 34,3 (75,3%; 63,7% sob pressão, 77,1% sem). Laterais e para trás: 67,0 (83,9%). Rasteiro de 10–20 m: 92,8% (87,6% para frente); de 20–30 m: 87,2% (78,7% para frente). Para dentro da área: 13,35 passes (45,4%), 10,6% viram finalização | StatsBomb-149 |
| Força mínima do passe manual ao espaço | ≥ 0,40 da barra. Abaixo disso vira passe assistido no pé | EA FC 24 Switch |
| Força da barra × distância do recebedor | 0–0,33 → ≤ 15 m · 0,33–0,66 → 10–30 m · > 0,66 → ≥ 25 m | EA FC 25 TU#8 (faixas propostas) |

### 1.2 Enfiada

| Constante | Valor proposto | Fonte |
|---|---|---|
| Volume e desfecho (90 min) | 4,03 por partida (≈ 2 por time): 34,3% completas, 44,3% incompletas, 19,2% impedidas, 2,2% para fora | StatsBomb-149 |
| Comprimento (p25 / mediana / p75) | 17,6 / 26,2 / 37,3 m | StatsBomb-149 |
| Tempo até a recepção (completas) | 1,54 / 2,04 / 2,59 s | StatsBomb-149 |
| Velocidade média | 10,8 / 13,7 / 16,2 m/s | StatsBomb-149 |
| Altura | 50% rasteiras, 42% altas, 8% baixas | StatsBomb-149 |
| Valor da enfiada | Do total: 18,5% viram finalização e 5,7% viram gol. Das completas: 53,9% viram finalização e 16,5% viram gol, com xG médio de 0,212 por finalização. Na MLS de 2014, a finalização vinda de enfiada converteu 22%, contra 13% da vinda de cruzamento | StatsBomb-149, MLSsoccer/Opta, Analytics FC |
| Recebedor no instante do passe | 1,27 m atrás da linha (p25–p75: 0,43–1,97 m), em posição legal | StatsBomb-360 |
| Distância entre o recebedor e o ponto de queda | Mediana 15,6 m (9,5–21,4). Corrida implícita: 7,5 m/s (6,1–9,0) | StatsBomb-360 |
| Ponto de chegada | Posição do recebedor + rumo × v_corrida (7–8 m/s) × t_voo (~2 s) ≈ 15 m à frente | StatsBomb-360 |
| Avanço no sentido do ataque (definição: ≥ 4 m) | Mediana 6,3 m (p10 4,3; p90 13,1). Passe de 21,2 m, bola a 11,3 m/s de média, voo de 1,86 s (1,12–3,00) | Metrica |
| Corrida do recebedor | 4,41 m/s (p10 2,90; p90 6,60); 5,84 m/s quando a bola cai a 8 m ou mais à frente. Ângulo entre a corrida e o passe: 47° (39° quando a bola cai a 8 m ou mais). O ponto fica 18° fora da linha passador–recebedor | Metrica |
| `ACOES.enfiada` (atual) | lead [4,5; 12] m e vNoPonto [3,5; 7] m/s já batem com o p10–p90 real | Metrica |
| Adiantamento sobre a posição prevista | ~1–2 m | EA FC 26 / FC 27 |

### 1.3 Lançamento

| Constante | Valor proposto | Fonte |
|---|---|---|
| Volume (passe alto ≥ 30 m, sem cruzamento) | 60,2 por partida (≈ 30 por time), 44,7% de acerto | StatsBomb-149 |
| Acerto / tempo mediano / velocidade média | 30–40 m: 49,2% / 2,33 s / 15,2 m/s · 40–50 m: 47,1% / 2,81 s / 15,9 · 50–60 m: 39,0% / 3,35 s / 16,2 · 60–80 m: 26,6% / 3,95 s / 16,2 | StatsBomb-149 |
| Tempo de voo-alvo do botão | 35 / 45 / 55 / 70 m → 2,3 / 2,8 / 3,3 / 3,9 s (±0,4 s) | StatsBomb-149 |
| Acerto-alvo | ~45–50% até 50 m (metade vira disputa aérea). 40–50 m na IA × IA: 40–55% | StatsBomb-149 |
| Inversão de jogo | 73,2% de acerto, mediana de 44,2 m e 2,69 s. Meta: ≥ 65% para o lado livre | StatsBomb-149 |
| Tiro de meta | Longo (≥ 40 m): 38,3%, mediana de 60,5 m e 3,53 s. Curto: 98,8% | StatsBomb-149 |
| Ápice máximo pelo tempo de voo (h ≤ g·T²/8) | ~6,7 m com 2,33 s e ~9,7 m com 2,81 s (só limite superior) | StatsBomb-149 (derivado) |
| Ângulo de saída para o alcance máximo | 25–30°. Um ângulo maior sai com v0 menor | Sakamoto 2026 |
| Exemplos resolvidos (arrasto de Goff 2017, sem efeito) | 40 m com ápice de 8 m → 24,5 m/s a 34,4° e 2,52 s · 25 m com ápice de 2 m → 24,2 m/s a 15,6° e 1,24 s · cavadinha de 8 m com ápice de 3 m → 10,0 m/s a 53,6° e 1,54 s · 60 m com ápice de 12 m → 32 m/s | Berkeley + teste próprio |
| Tolerância do método de tiro | \|erro\| < 0,05 m, no máximo ~6 iterações. Teste: pouso e ápice a ≤ 0,1 m, ≤ 20 chamadas ao integrador | Berkeley + teste próprio |
| Teto físico de v0 | ~35 m/s × fator do atributo de chute (a faixa real vai de 18 a 35 m/s) | Kellis & Katis 2007 |
| Precisão do lançamento a 40 m (bom lançador) | Erro médio ≈ 1,6 m (2,3° extrapolados da medida a 20 m), ~2 m a 50 m, antes de vento e Magnus. A meta de ±3 m a 40 m não tem medida direta (ver Incertezas) | Carlsson 2018 (extrapolação) |

### 1.4 Cruzamento e escanteio

| Constante | Valor proposto | Fonte |
|---|---|---|
| Volume e eficiência (bola rolando) | 21,1 por partida, 31,5% completos, 17,1% viram finalização, 2,83% viram gol. Das finalizações vindas de cruzamento: 16,5% de gol, 46% de cabeça, xG médio de 0,137 | StatsBomb-149 |
| Referências Opta | 23,58% de acerto, 1,76% de gol em até 5 s, ~5% na melhor zona. Premier League: 1 gol a cada 91,92 cruzamentos (~15% dos gols). Copa 2014: 3,2% | StatsBomb Blog cruzamentos, Večeř, Ispirlidis 2026 |
| Metas de equilíbrio | Acerto de 24–32%. ~1 gol a cada 35–90 cruzamentos. ~Metade dos completos vira finalização | StatsBomb-149 + Opta |
| Alto | 65,6% do total; 30,7% de acerto; 15,8% viram finalização; 2,04% viram gol; xG 0,112 (75% de cabeça); 28,9 m, 1,84 s, 16,4 m/s de média, ~20–23 m/s na saída | StatsBomb-149 |
| Rasteiro | 21,7% do total; 36,1% de acerto; 21,3% viram finalização; 4,26% viram gol; xG 0,184; 15,8 m, 0,94 s, 16,4 m/s | StatsBomb-149 |
| Baixo/tenso | 12,8% do total; 27,9% de acerto; 17,0% viram finalização; 4,49% viram gol; xG 0,152; 19,6 m, 1,08 s, 18,1 m/s (p75 de 22,9) | StatsBomb-149 |
| Para trás da linha de fundo (cut-back) | 1,95 por partida, 42,3% de acerto, 22% viram finalização, 5,2% viram gol, 74% rasteiros | StatsBomb-149 |
| Velocidade de saída × marcador | 23,1 m/s sem defensor, 20,4 com defensor longe, 19,2 com defensor perto (acerto de 78 / 78 / 59%). Reduzir ~12–17% com marcador perto | SHU cruzamento |
| Pé do cruzador | 79,1% com o pé do lado (curva para fora) e 20,9% com o pé oposto (curva para dentro). Perto da linha de fundo (5,5–0 m), 66,2% rasteiros | Ispirlidis 2026 |
| Zonas de chegada | Marca do pênalti: 60,3% (32,5% de acerto, 21,7% viram finalização). 1º pau dentro da pequena área: 11% (9% de acerto). 2º pau dentro da pequena área: 7,8% (25,4% de acerto, 19,3% viram finalização). Gols: 64 de 89 na marca, 17 no 2º pau, 3 no 1º pau | StatsBomb-149 |
| Pesos dos alvos da IA | ~60% marca do pênalti · ~15% 2º pau · ~10% 1º pau | StatsBomb-149 |
| Área no instante do cruzamento | 2,45 atacantes contra 4,66 defensores; 73% dos atacantes na faixa central. Corrida do recebedor: 5,1 m (3,0–9,0). Yamada & Hayashi: 7,0 ± 3,4 m, recebendo 2,2 m à frente da linha de defesa | StatsBomb-360, Yamada & Hayashi 2015 |
| Escanteio | 9,6 por partida, 14,2% curtos. Longos: 39,9% marca do pênalti, 26,4% 1º pau, 9,3% 2º pau, 5,2% centro da pequena área, 9,3% fora da área. Curva para dentro 624, para fora 450, reto 50. Voo de 1,53 s com ~21,8 m/s de média; 35,2% de acerto. Tolerância: ±10 pontos e ±0,3 s | StatsBomb-149 |

### 1.5 Chute

| Constante | Valor proposto | Fonte |
|---|---|---|
| Chute forte máximo (melhores atributos) | 31–34 m/s, nunca acima de 38 m/s (recorde citado de 137 km/h) | Shinkai 2008, AWS/DFL |
| Limiar de "chute forte" | > 27,8 m/s (100 km/h), que deve ser raro | AWS/DFL |
| Razão velocidade da bola ÷ velocidade do pé | ~1,40 (faixa da literatura: 1,06–1,65) | Shinkai 2008, Kellis & Katis 2007 |
| Colocado de chapa | ≈ 0,84 × o forte (26,0 ÷ 30,8 m/s) | Shinkai 2008 |
| Colocado com curva | ≈ 0,87 × o reto (19,2 contra 22,1 m/s), 30–40 rad/s, ~1,5 m de desvio em 20 m (medido: 1,49 m com 36,4 rad/s). A literatura dá 25–59 rad/s para a curva | Whiteside 2010 |
| Chute forte, rotação e ângulo | ≤ 2 rev/s e saída a 10–16°. "Folha seca": 30,6 m/s, 15,3–16,2°, 0,8–1,4 rev/s | Whiteside 2010, Shinkai 2009 |
| Velocidade quando se prioriza a precisão | 73–96% da velocidade máxima | Carlsson 2018 |
| Regressão do Magnus (falta de Beckham) | Saída a 36 m/s com 63 rad/s de efeito lateral, a 27 m do gol → desvio de 2,5–3,5 m e chegada a 17–21 m/s | Goff & Carré 2009 |
| Decaimento do giro | 4–8% até o ápice, ≤ ~12% ao tocar o chão | Goff & Carré 2009 |
| Cavadinha no alvo | Altura mediana na linha: 1,33 m. Tem de descer antes do travessão (2,44 m) | StatsBomb-1485 |
| Bola (quique FIFA) | Solta de 2,00 m: quique de 1,35–1,55 m (e = 0,82–0,88) | FIFA 2018 |

### 1.6 Dispersões (erro de execução)

| Constante | Valor proposto | Fonte |
|---|---|---|
| Passe com a parte interna a 20 m (erro médio) | 0,82 ± 0,14 m em ritmo de jogo · 0,94 em velocidade máxima · 1,00 com a bola em movimento | Carlsson 2018 |
| Erro angular base do passe | ~2,3° → ~1,6 m a 40 m e ~2 m a 50 m (sem vento e Magnus). Teste: 200 passes de 20 m sem pressão com erro médio de 0,7–1,0 m | Carlsson 2018 |
| Erro angular base do chute colocado | ~1,9° de erro médio (0,68 m a 20 m), ou σ ≈ 1,6° por eixo (erro médio = 1,25σ) | Carlsson 2018 |
| Dispersão vertical do craque | σ do ângulo de saída ≈ 1,5–2°. Acertar um alvo de 1 m² a 20 m exige ângulos dentro de ~3° | Alcock 2012, Whiteside 2010 |
| Pé ruim | ×1,4 na dispersão (0,68 → 0,95 m) e ×0,84 na velocidade (27,1 contra 32,1 m/s). No alvo, a 0–12 m: 55,5% contra 62,4%. Conversão/xG: 0,89 contra 1,11 | Carlsson 2018, Nunome 2006, StatsBomb-1485 |
| Força máxima | ×1,15 na dispersão (0,78 contra 0,68 m) | Carlsson 2018 |
| Passe com a bola em movimento ou de primeira | ×1,2 | Carlsson 2018 |
| Chute de primeira | ×1,1 (43,2% no alvo, contra 47,8% com a bola dominada) | StatsBomb-1485 |
| Pressão no chute | ×1,15–1,2 só com marcador a ≤ 1,5 m e chute a < 12 m. De 12 a 35 m a pressão não muda nada (≤ 1 ponto) | StatsBomb-1485 |
| Pressão no passe | ≈ −12 pontos de acerto com marcador a ≤ 2–3 m | StatsBomb-149 |
| Primeira × ângulo | Erro cresce com o ângulo entre a chegada e a saída: ~0° pouco, 90° médio, ≥ 135° alto. Penalidade extra na enfiada alta de primeira | EA FC 25 TU#8, EA FC 26 |
| Cabeceio | Erro base de 5–13° com a bola até ~0,30 m acima da cabeça parada; ≥ 20–30° perto do limite do salto; acima de 15° o cabeceio sai errado | Marcolin & Petrone 2006 |

### 1.7 xG e chutes no alvo

| Constante | Valor proposto | Fonte |
|---|---|---|
| Conversão, chute de pé em jogada, sem pênalti (tolerância de ±30% relativos) | 0–6 m 51,0% · 6–9 m 29,5% · 9–12 m 17,9% · 12–16,5 m 12,6% · 16,5–20 m 5,9% · 20–25 m 3,5% · 25–30 m 1,7% · 30–40 m 1,1% (n = 28.775) | StatsBomb-1485 |
| xG logístico (decisão da IA e HUD) | logit = −0,962 − 0,1196·d(m) + 1,348·ângulo das traves (rad). Dá 0,45 a 6 m, 0,20 a 11 m, 0,087 a 16,5 m, 0,054 a 20 m e 0,028 a 25 m (chutes de frente) | StatsBomb-1485 |
| Cabeçada | 0–6 m 28,3% · 6–9 m 11,5% · 9–12 m 5,8% | StatsBomb-1485 |
| No alvo, entre os não bloqueados (±5 pontos) | 0–6 m 72% · 6–9 m 60% · 9–12 m 57% · 12–16,5 m 54% · 16,5–20 m 46% · 20–25 m 40% · 25–30 m 35% · 30–40 m 26% | StatsBomb-1485 |
| Mistura global | Conversão de 9,2%, 32,2% no alvo, 26,2% bloqueados. Fora da área: 42,4% dos chutes, 3,4% de conversão, 15,7% dos gols. Dentro da área: 13,4%. Pequena área: 7,0% dos chutes, 28,4% de conversão | StatsBomb-1485, Kennett |
| Metas do equilíbrio | Gols de fora: 12–18% do total. Chutes de fora: 38–45%. Conversão de fora: 2,5–4,5%. Dentro da área: 11–15%. Pênalti: 70–78%. Falta direta: ~5–8% | StatsBomb-1485, Kennett |
| Bloqueio por defensor no triângulo chutador–traves | 0 → 13,8% bloqueados e 13,2% de gol · 1 → 41,5% e 5,5% · 2+ → ~48–51% e 3–4,5%. Cada defensor bloqueia ~30–40% | StatsBomb-1485 |
| Pressão de perto (0–12 m) | 55,6% no alvo e 21,8% de gol, contra 61,7% e 27,4% sem pressão | StatsBomb-1485 |
| 1×1 | 24,8% de gol e 62,8% no alvo. Meta: 20–30% | StatsBomb-1485 |
| Cavadinha × distância chutador–goleiro | 0–6 m 31,9% · 6–10 m 29,0% · 10–16 m 21,6% · > 16 m 3,9%. Geral: 20,1% de gol e 41,8% no alvo | StatsBomb-1485 |
| Pênalti | 72,6% gol, 19,3% defendidos, 8,1% fora ou na trave | StatsBomb-1485 |

### 1.8 Goleiro

| Constante | Valor proposto | Fonte |
|---|---|---|
| Reação ao chute em jogo (`GK_REACAO`) | 0,19–0,25 s após o toque, menor para goleiro melhor (futsal: 188 ms a 6 m e 212 ms a 10 m) | Higueras-Herbada 2020 |
| Reação simples do goleiro | 181,9 ± 20,4 ms, mais rápida que a do meia (224,0 ms). Piso da IA: ~0,18 s (11 passos) | Ruschel 2011 |
| Pênalti: reação | Lado antecipado (as mãos já diferem 115 ms antes do toque). Altura só ~245 ms depois. Bola do pé à linha: 525 ± 64 ms | Higueras-Herbada 2020 |
| Mergulho: centro de massa | Pico de 3,6–4,0 m/s (média de 2,84–3,18). Deslocamento de ~1,5 m (1,36–1,54) | Monteiro 2022 |
| Mergulho: alcance da mão | Deslocamento + ~2,0 m → ~3,5 m do ponto de partida em ~1,0 s (0,97–1,05 s do estímulo ao toque). Canto alto: +0,1 s (0,07–0,15) | Monteiro 2022, Ibrahim 2019, Tsai 2005 |
| Impulsão das pernas no mergulho | Perna oposta 2,7 m/s, perna do mesmo lado 1,2 m/s | Ibrahim 2019 |
| Pênalti: alcance e defesa | 2,75 m (mergulho tardio; 2,6–2,9) e 3,1 m (antecipado; 3,0–3,2) a partir do centro. Dentro do alcance: P(defesa) = 0,7, com transição linear de ±0,7 m. 61,5% mergulham antecipado. Meta: 70–78% de gols, 15–22% de defesas | Bransen 2025 |
| Taxa de defesa por distância (chute no alvo, ±6 pontos) | 0–6 m 22% · 6–9 m 41% · 9–12 m 59% · 12–16,5 m 67% · 16,5–20 m 81% · 20–25 m 87% · 25–30 m 93% · 30–40 m 95%. Global ~71% | StatsBomb-1485 |
| Taxa de defesa por zona | Pequena área 38,5% · área 68,2% · fora da área 86,8% | StatsBomb-1485 |
| Taxa de defesa por altura e lado | Baixo 71,7%, meia altura 76,6%, alto 67,8%. Centro 79,4%, canto 69,8% (≈ −10 pontos no canto) | StatsBomb-1485 |
| Defesa × distância lateral até a bola | 0–0,5 m 88,7% · 0,5–1 m 75,7% · 1–1,5 m 75,6% · 1,5–2 m 66,1% · 2–2,5 m 55,1% · 2,5–3 m 46,8% · 3–4 m 35,2% · > 4 m 31,4% | StatsBomb-1485 |
| Fórmula de defesa | logit = −0,350 − 1,150·lateral(m) + 0,2186·distância chutador–goleiro(m) − 0,219·altura na linha(m). Lateral de 2 m → 27% a 8 m, 63% a 15 m, 89% a 22 m. Teste: ±10 pontos | StatsBomb-1485 |
| Desfecho da defesa | 48,5% seguradas, 18,0% espalmadas para um adversário, 11,7% para um companheiro, 21,8% para fora. Meta: 45–52% seguradas e 15–22% de rebote para o adversário | StatsBomb-1485 |
| P(segurar) por situação | Chute de longe com o goleiro em pé: ≈ 0,60 · em pé (geral) 0,548 · mergulho 0,245 · chute da pequena área 0,23 (40% de rebote perigoso). Mergulho: 39,1% para fora. Chute alto (≥ 1,65 m): 43% para fora | StatsBomb-1485 |
| Parte do corpo na defesa | 69% as duas mãos, 18% uma mão, 10% os pés | StatsBomb-1485 |
| Posição | Bissetriz do ângulo das traves (desvio mediano de 0,213 do meio-ângulo; meta ≤ 0,25) | StatsBomb-1485 |
| Profundidade na hora do chute | Chute da pequena área: 1,19 m (0,82–1,92) · da área: 1,83 m (1,19–2,83) · de fora: 2,10 m (1,46–3,02) | StatsBomb-1485 |
| 1×1 com o atacante dominando | Fechar o ângulo sem passar de ~4 m da linha | StatsBomb-1485 |

### 1.9 Cabeceio e jogo aéreo

| Constante | Valor proposto | Fonte |
|---|---|---|
| "Potência própria" do cabeceio (bola parada) | Em pé: 6,4 m/s (teste 5,5–7,2) · salto parado: 4,9 m/s (×0,77; 4,0–5,8) · com corrida: 8,3 m/s (×1,30; 7,2–9,4) | Becker 2021 |
| Ganho de velocidade da bola | Salto parado 3,35–5,9 m/s; com 5 m de corrida 6,95–10,75 m/s | Marcolin & Petrone 2006 |
| Massa efetiva | ~13,8% da massa corporal (10,4–12,3 kg) no salto forte; faixa de 5–50% pela técnica | Kristensen 2002, Babbs 2001 |
| Velocidade da cabeça no impacto | 2,31–3,59 m/s. Para a bola sair mais rápida que 13,1 m/s: e(cabeça–bola) ≳ 0,7 (conta da pesquisa) | Kristensen 2002 |
| Contato | ~8,5 ms (< 16,7 ms): impulso num passo só | Babbs 2001 |
| Velocidade horizontal da bola no cabeceio em jogo | Média de 5,7 m/s (adultos); meta de 5–7 m/s | Babbs 2001 |
| Alcance da cabeça com corrida | ~0,56 m acima da estatura (2,31 m para 1,75 m; ±0,08). Último apoio: 0,24 s. Decolagem com 2,15 m/s na horizontal e 3,79 m/s na resultante | Fílter 2022 |
| Impulsão (atributo) | O CG sobe 0,30–0,58 m (média ~0,45). Decolagem a 2,4–3,4 m/s. Voo de 0,49–0,69 s (0,61), com ápice na metade. Num pé só: ~metade | icSPORTS 2018 |
| Leitura de bola alta | Atraso de decisão de 0,3–0,5 s (até 0,84 s). Chegar correndo (v > 0) em ≥ 70% dos casos; primeira corrida na direção certa em ≤ 0,84 s em ≥ 74% | McLeod & Dienes 1996 |
| Atraso perceptivo da IA a qualquer evento de bola | 0,18–0,22 s (11–13 passos de 1/60). Teste: média de 0,18–0,23 s, nunca abaixo de 0,17 s | Ruschel 2011 |
| Régua de altura do passe | Rasteiro: não sai do chão. Baixo: ápice abaixo do ombro. Alto: ápice acima do ombro | StatsBomb Live API |

### 1.10 Domínio

| Constante | Valor proposto | Fonte |
|---|---|---|
| Modelo de amortecimento | v_saída = v_parte + e·(v_parte − v_bola), com e(pé–bola) = 0,46–0,68 (0,463 reproduz 0,48 contra 0,52 m/s medidos) | Iga & Nunome 2016, Kellis & Katis 2007 |
| Recuo ideal do segmento | ~30–40% da velocidade da bola, escalado pelo atributo de domínio | Iga & Nunome 2016 |
| Medidas reais | Bola aérea: −9,73 → +0,52 m/s, com o pé recuando de −1,46 para −4,04 m/s. Rasteira: 15,4 → 1,5 m/s; com giro de 90°: 15,0 → 2,0 m/s | Iga & Nunome 2016, Tahara 2012 |
| Metas | Bola aérea a 10 m/s: resíduo ≤ 1,0 m/s (alvo ~0,5). Rasteira a 15 m/s: ≤ 2,0 m/s | Iga & Nunome 2016 |
| Peito e coxa | e ≤ 0,82 (bola–aço), com recuo menor que o do pé. Sem medição direta | FIFA 2018 (teto) |

### 1.11 Recepção, TTI e IA de passe

| Constante | Valor proposto | Fonte |
|---|---|---|
| `RECEPCAO.sigmaTTI` | 0,45 s | Spearman 2017, Shaw/FoT |
| `RECEPCAO.taxaControle` (λ) | 4,3 s⁻¹ (~95% de domínio no 1º segundo). Defesa: κ = 1,72 no λ (artigo de 2018) | Spearman 2017, Shaw/FoT |
| TTI de referência (HUD e depuração) | Reação de 0,7 s, 5 m/s, bola a 15 m/s | Shaw/FoT |
| TTI para a IA decidir o passe | Reação de 0,3 s e 7 m/s (97,7% dos recebedores reais chegam a tempo, contra 70,2% com 0,7 s e 5 m/s) | Metrica |
| Folga do passe seguro | Seguro: TTI_adv − TTI_receb ≥ 0,25 s. Arriscado: 0,25–0,55 s. Meta: ≤ 15% dos passes da IA com folga < 0,25 s e acerto de 77–85% | Metrica |
| TTI com inércia | Vmax 7,8 m/s e α 1,3 s⁻¹. Alcance real: 6,16 m em 1 s e 12,94 m em 2 s (teste do `passoCorpo`: ±15%) | Narizuka 2023 |
| Linha de passe livre | Amostrar a cada 1 m. Adversário com aMax ≈ 5 m/s² e vMax de 7–8 m/s; v_toward = \|v0\|·cos θ | Pfaff 2022 |
| Filtro de linha (Buckland) | Bola a 12 m/s, adversário a 7 m/s, reação de 0,3 s, raio de 0,5 m: 80,6% dos recebedores reais têm linha livre, contra 22,3% dos outros companheiros no cone de ±30° | Buckland, Metrica |
| Influência espacial | Raio de 4 m (perto da bola) a 10 m (longe); esticamento s²/13²; centro em pos + 0,5·v. Desmarque ativo: > 1,5 m/s | Fernández & Bornn 2018 |
| Previsão do recebedor | dur = (clamp(0,3 + 0,05·d, 0, 1))^0,7 × 0,7 s, no máximo 0,7 s | GRF |
| Assistência de direção | Passe 0,4 · enfiada 0,2 · lançamento 0,2. Cai por 1 − (desvio/50 m)^1,5 | GRF |
| Cone de candidatos | ~35° em torno da posição prevista. ±20° cobre 95% dos casos (desvio p95 de 17,8°) | Metrica |
| Nota de seleção | ângulo (°) + 0,3 × distância (m): 92,6% de acerto (com peso 0,2: 92,0%; com 0,5: 93,0%). Regra atual `ACOES.passe.cone` = 0,55 rad, pegando o mais perto: ~86%. Meta: ≥ 90% | Metrica |
| Cone de visão do passador | Só entram companheiros vistos nos últimos ~0,5–1 s. Cone de busca θ2 de 20–30° (a calibrar) | Konami patente |
| Reação do recebedor ao botão | ≤ 0,2 s até ter ≥ 0,5 m/s rumo ao ponto | Metrica |
| Recebedor real no chute | 2,34 m/s (p10 0,81; p90 4,49). ~28% vêm ≥ 1 m ao encontro do passador; ~30% se afastam ≥ 1 m | Metrica |
| Defensor da IA ao passe | Rampa de ~1 m/s por segundo (sem tempo morto fixo). Reação de 0,35–0,5 s, menor com finta (369 contra 447 ms) | Metrica, Huang & Yang 2018 |
| Desmarque (Etapa 3) | > 4,17 m/s por > 0,7 s. ~15 por jogador por jogo, ~72% para o espaço | CIES 88 |
| Tabela e terceiro homem | Tabela: 86 por jogo (dois times), 46,5% devolvidas de primeira, ~10 m por passe, 2,68 s; ~17 com avanço ≥ 5 m. Terceiro homem com corrida: ~27 por jogo, 3,4 s | Metrica |

### 1.12 Controles de toque

| Constante | Valor proposto | Fonte |
|---|---|---|
| Piso de qualquer botão | 48×48 px CSS, com ≥ 8 px de folga entre bordas | Apple HIG (44 pt), Material 3 (48 dp) |
| CHUTE e PASSE | ≥ 12 mm ≈ 75 px CSS (1 px ≈ 0,16 mm) | Hoober 2017 |
| Secundários (ENFIADA, LANÇAR, CORRIDA, TROCAR, GOLEIRO) | ≥ 9,6 mm ≈ 60 px CSS | Parhi 2006 |
| Arranjo | Arco em volta do CHUTE, a no máximo ~2 diâmetros dele. Opção "botões grandes": +20% | Hoober 2017 |
| Latência | Do pointerdown ao comando: ≤ 1 passo (16,7 ms). De ponta a ponta: ≤ 69 ms | PredicTaps 2024 |
| Duplo toque | Não usar nos botões de ação (exige espera de 150–500 ms) | PredicTaps 2024 |
| Deslize no botão (variante) | ≥ ~20 px. Teste: 100 toques automáticos sem falso positivo | eFootball 2022 |
| Custo da força alta | Acima de ~0,8 da barra, somar quadros à preparação | eFootball 2022 |
| Toque no campo | Num raio de ~2 m de um companheiro = passe no pé | EA FIFA Mobile (gestos) |
| Troca do conjunto de botões na troca de posse | ≤ 1 quadro | EA FIFA Mobile (botões) |

## 2. Regras de jogo que a pesquisa sustenta

### 2.1 Seleção do alvo do passe (PASSE)
1. **Candidatos.** São os companheiros dentro de ~35° do analógico, medidos sobre a posição **prevista** (pos + vel × dur, com dur ≤ 0,7 s), e não sobre a posição atual. Usar a prevista sobe o acerto do recebedor real de 75,6% para 85,0%. Fonte: Metrica, GRF.
2. **Nota.** Ângulo (graus) + 0,3 × distância (m) + penalidade de linha bloqueada; vence a menor. Dá 92,6% nos passes reais, contra ~86% da regra atual. A força da barra desempata entre perto e longe. Fonte: Metrica, EA FC 25 TU#8.
3. **Cone de visão.** Só recebe quem o passador viu nos últimos ~0,5–1 s. Sem candidato, a bola vai crua na direção do analógico, com erro: é um passe errado de verdade. A checagem roda a cada 1/60 s. Fonte: Konami patente.
4. **Ponto do passe.** É a posição prevista do recebedor no tempo de voo, integrando a corrida dele com a rolagem de `bola.js`. Fonte: Metrica, EA FC 26.
5. **Assistência por tipo.** Passe 0,4, enfiada 0,2, lançamento 0,2, caindo quando o analógico aponta longe do candidato. Fonte: GRF.
6. **Três níveis de assistência.**
   - ASSISTIDO, padrão no celular: velocidade automática para a bola chegar ao pé a ~6–10 m/s.
   - SEMI: recebedor pelo cone, velocidade pela barra.
   - MANUAL: direção crua e velocidade pela barra.

   O passe manual ao espaço só vale com força ≥ 0,40. Fonte: eFootball v2.2.0, EA FC 24 Switch.
7. **Erro do passe.** Erro = base × (1 − atributo) × (1 + pressão a ≤ 3 m) × (1 + sujeira do comando). O passe continua afetado pela limpeza do comando e pela pressão sobre o passador. Fonte: EA FC 25 TU#8 / TU#15.

### 2.2 Linha de passe livre (no lugar de um risco de linha pessimista)
1. **Teste de linha livre.** A linha é livre se a bola chega antes do adversário em todos os pontos, amostrados a cada 1 m. t_bola vem de `velParaDistancia`, que é exata. Fonte: Pfaff 2022.
2. **Filtro barato.** Ignorar o adversário atrás do passador. O passe é inseguro se o adversário estiver mais perto da linha que vMaxAdv × t_bola + raios. Testar 3 alvos por recebedor: o pé e as duas tangentes de um círculo de raio 0,3 × t_bola × vMax. Fonte: Buckland, medido na Metrica.
3. **Folga.** Seguro com folga ≥ 0,25 s. Arriscado entre 0,25 e 0,55 s, com peso menor e só no último terço. Fonte: Metrica.
4. **Calibração do risco.** No real, o rasteiro de 10–20 m para frente no último terço completa ~88%. Se a IA marca a maioria desses passes como arriscados, ela está pessimista. Fonte: StatsBomb-149.
5. **Quem fica com a bola.** Integrar dP_j = (1 − ΣP_k)·logística(T − t_int,j)·λ·dt a 1/60 s, com a defesa ganhando κ = 1,72 no λ. Fonte: Spearman 2017, Shaw/FoT.

### 2.3 Enfiada no espaço (ENFIADA)
1. **O que a assistência faz.** Escolhe só **quem** recebe (dentro do cone do analógico) e **onde** a bola cai: à frente da corrida, na posição prevista + ~1–2 m. Ela não desvia a bola para um vão longe da mira. Fonte: EA FC 26, EA FC 27.
2. **Ponto de queda.** ~15 m à frente da posição do recebedor no passe (v_corrida de 7–8 m/s × ~2 s), com avanço de 4,5–12 m no sentido do ataque. Fonte: StatsBomb-360, Metrica.
3. **Tempo da corrida.** O atacante espera ~1 m atrás da linha e arranca no passe. O impedimento é julgado no instante do passe, sem contar mãos e braços; estar na linha é legal; não há impedimento direto de tiro de meta, lateral ou escanteio. Fonte: StatsBomb-360, IFAB Lei 11.
4. **Metas (90 min).** ~2 enfiadas por time, 30–40% completas e ~20% impedidas. A enfiada completa vira finalização em ~metade dos casos, com xG ~0,2, o dobro do cruzamento alto. É a alavanca concreta para o volume de chance. Fonte: StatsBomb-149, Analytics FC, MLSsoccer/Opta.

### 2.4 Recebedor que arranca
1. **Reação ao botão.** O recebedor do usuário vai para o ponto previsto em ≤ 0,2 s após o botão. O jogador real já se move antes do passe (2,15 m/s em −0,4 s). Fonte: Metrica.
2. **Corrida para o destino.** O recebedor corre para o destino da bola, e não para a bola. Na enfiada, a corrida é diagonal (~40–50° da trajetória) a 4,5–6 m/s. Fonte: EA FC 24 Switch, Metrica.
3. **Vir ao encontro.** Com marcador nas costas, ~30% dos recebedores dão passos ao encontro do passador (≥ 1 m). Fonte: Metrica.
4. **Defensor da IA.** Acelera em rampa (~1 m/s por segundo) e reage ao passe em 0,35–0,5 s, menos se houver finta. Fonte: Metrica, Huang & Yang 2018.
5. **Tabela.** Depois do passe, o passador corre para o espaço. B devolve de primeira em ~45–50% dos casos, com ~10 m por passe e 2,5–3 s no total. **Terceiro homem:** C já corre a ≥ 4 m/s quando A passa para B. Atalho no celular: PASSE deslizado para baixo = tabela. Fonte: Metrica, EA FIFA Mobile (botões), eFootball 2022.

### 2.5 Lançamento (LANÇAMENTO)
1. **Método de tiro no próprio integrador** (passo 1/60, arrasto, Magnus, rolagem). Os passos:
   1. estimativa sem arrasto;
   2. secante em vz até acertar o ápice;
   3. secante em vh até acertar o alcance.

   Na crise do arrasto (~9–13 m/s), usar regula falsi / Illinois, recaindo em bisseção. Parametrizar por ápice + velocidade no plano dá solução única. Fonte: Berkeley, Goff & Carré 2009, Goff 2017, Forrest Smith.
2. **Ângulo.** 25–30° para o alcance máximo. Um lob mais alto sai mais lento. Fonte: Sakamoto 2026.
3. **Teto de v0.** Se o alvo pede mais de ~35 m/s × atributo, baixar primeiro o ápice e depois o alcance. O jogo nunca gera bola impossível. Fonte: Kellis & Katis 2007.
4. **Precisão.** O lançamento é menos preciso que o rasteiro, e metade termina em disputa aérea. Fonte: StatsBomb-149, EA FC 26 TU 1.5.0.
5. **Contexto.** LANÇAR vira CRUZAR quando o condutor está na faixa lateral do último terço. Fonte: EA FIFA Mobile (botões).

### 2.6 Cruzamento por zonas
1. **Três cruzamentos.** Alto (~1,8 s, ~20–23 m/s na saída), tenso (~1,1 s, 18–23 m/s) e rasteiro ou para trás (~0,9 s). Com marcador perto, a saída cai 12–17%. Meta de proporção: ~65/22/13. Fonte: StatsBomb-149, SHU cruzamento.
2. **Preferência na linha de fundo.** A IA prefere o cruzamento para trás e o rasteiro (xG 0,18 contra 0,11 do alto), e a maioria sai rasteira. Fonte: StatsBomb-149, Ispirlidis 2026.
3. **Pé do cruzador.** Pé do lado em ~80% (curva para fora). A curva para dentro é mais rara, mas um pouco mais perigosa no meio da área. Fonte: Ispirlidis 2026.
4. **Ataque à área.** 2–3 atacantes, cada um começando 5–7 m antes do ponto de chegada e cronometrando para chegar junto com a bola.
   - Um ataca o 1º pau, se afastando da bola.
   - Outro entra na diagonal no 2º pau.
   - Outro fica na marca do pênalti para o cruzamento para trás.

   Pesos dos alvos: 60/15/10. Mirar à frente do atacante. Meta: ≥ 70% das finalizações de cruzamento saem entre a marca do pênalti e a pequena área. Fonte: StatsBomb-360, Yamada & Hayashi 2015, EA FC 26.
5. **Escanteio.** ~14% curtos. Dos longos: ~40% na marca do pênalti, ~26% no 1º pau, ~10% no 2º pau. A curva para dentro é um pouco mais frequente. A cobrança sai mais forte que o cruzamento de bola rolando. Fonte: StatsBomb-149.

### 2.7 Chute (CHUTE), colocado e cavadinha
1. **Carga e rasteiro.** Segurar enche a barra (0–1). Um 2º toque antes do chute sair marca "rasteiro": menos elevação e mais velocidade. Vale para todos os tipos, menos a cavadinha. Sem finalização cronometrada. Fonte: EA FC 26.
2. **Colocado** (deslizar para baixo): ~0,84–0,87× a velocidade do chute forte, 30–40 rad/s e ~1,5 m de curva em 20 m. O efeito vem do atributo, e não do gesto. Fonte: Shinkai 2008, Whiteside 2010, EA FIFA Mobile (gestos).
3. **Cavadinha** (deslizar para cima): alta e lenta, descendo antes do travessão. Só funciona com o goleiro a ≥ 4–6 m da linha e o chutador a ≤ 10 m dele. Em média não é melhor que o chute normal contra goleiro adiantado. Meta: ~30% de gols com o goleiro a ~8 m e o chutador a 4–8 m; < 5% com o chutador a > 16 m do goleiro. Fonte: StatsBomb-1485, EA Help (chute).
4. **Chute forte** (opcional): preparação mais longa e mira sem cone de assistência. A força alta sempre custa quadros de preparação. Fonte: EA FC 26, eFootball 2022.
5. **Decisão da IA.** A IA decide entre chutar e passar pelo xG logístico, que também alimenta o placar de xG do HUD. Fonte: StatsBomb-1485.

### 2.8 Jogada de primeira
O comando apertado com a bola chegando fica guardado e sai no 1º contato, sem domínio. Também vale se chegar um pouco atrasado. O erro cresce com o ângulo entre a chegada e a saída (faixas 0–45°, 45–90°, 90–135° e 135–180°), e a enfiada alta de primeira tem penalidade extra. Fonte: EA FC 25 TU#8, EA FC 26.

### 2.9 Goleiro e saída do goleiro (GOLEIRO)
1. **Reação.** Não reage à trajetória antes de 0,19–0,25 s após o toque (~0,18 s no limite inferior). Fonte: Higueras-Herbada 2020, Ruschel 2011.
2. **Posição.** Na bissetriz, a 1,2 m da linha contra chute de perto, ~1,8 m contra chute de dentro da área e ~2,1 m contra chute de fora. Fonte: StatsBomb-1485.
3. **Mergulho físico.** O alcance é limitado pelo tempo: a mão chega a ~3,5 m de lado em ~1,0 s, com +0,1 s no canto alto. Fonte: Monteiro 2022, Ibrahim 2019, Tsai 2005.
4. **Desfecho da defesa** conforme a situação:
   - segura mais em pé e no chute de longe;
   - espalma mais no mergulho e no chute alto;
   - dá rebote perigoso no chute da pequena área.

   Fonte: StatsBomb-1485.
5. **Botão GOLEIRO.**
   - No PC funciona enquanto estiver segurado.
   - No celular é liga/desliga, e desliga sozinho quando a bola sai da área de perigo.
   - Com o botão ativo, o goleiro corre para o condutor com aceleração limitada pelo atributo de saída, nunca instantânea.
   - Ao soltar, ele volta para a bissetriz.

   Fonte: EA FC 25 TU#15, EA FC 26, EA FIFA 20 manual, EA FIFA Mobile (botões e gestos).
6. **1×1.** Com o atacante dominando a bola, o goleiro fecha o ângulo sem passar de ~4 m da linha. A saída só compensa se ele chega antes do próximo toque. Meta: conversão de 20–30%, sem aumentar quando o goleiro sai mais cedo. Fonte: StatsBomb-1485.
7. **Pênalti.** O goleiro fica na linha até o toque, com ao menos parte de um pé nela. Pode antecipar o lado antes do toque, com risco de ser enganado, e decide a altura só após ~0,25 s. Defesa feita com infração do goleiro manda repetir a cobrança (advertência na 1ª, amarelo nas seguintes). Fonte: IFAB Regra 14, Higueras-Herbada 2020, Bransen 2025.
8. **Bola com efeito.** O goleiro e a IA preveem a trajetória primeiro sem o Magnus e corrigem depois. Fonte: McLeod & Dienes 1996 (cita Craig 2006).

### 2.10 Jogo aéreo e domínio
1. **Bola alta.** O ponto de queda não é conhecido de imediato: há atraso de 0,3–0,5 s e uma estimativa ruidosa que converge. A IA ajusta o ritmo para chegar junto com a bola, e não para chegar e esperar. Fonte: McLeod & Dienes 1996.
2. **Cabeceio.** É um impulso num único passo, com a velocidade relativa (jogador + cabeça − bola) e a massa efetiva pelo atributo. A impulsão começa ~0,24 s + o tempo de subida antes da chegada da bola. Fonte: Babbs 2001, Kristensen 2002, Fílter 2022, icSPORTS 2018.
3. **Domínio.** É amortecimento: o pé recua ~30–40% da velocidade da bola, conforme o atributo. Sem recuo, a bola espirra com e × v. Fonte: Iga & Nunome 2016, Kellis & Katis 2007.

### 2.11 Botões no celular e no teclado
1. **Conjunto que muda com a posse** (em ≤ 1 quadro).
   - **Ataque:** PASSE, ENFIADA, LANÇAR/CRUZAR, CHUTE e CORRIDA. O lançamento tem botão próprio, como o dono pediu.
   - **Defesa:** DIVIDIDA/PRESSÃO, CARRINHO, TROCAR e GOLEIRO, este só sem a bola.

   Nenhum botão de ataque aparece na defesa, e o conjunto não tem botão de condução. Fonte: EA FIFA Mobile (botões).
2. **Variantes por deslize curto** no botão: PASSE para cima = por cima, PASSE para baixo = tabela, CHUTE para baixo = colocado, CHUTE para cima = cavadinha. O disparo é no pointerdown, com touch-action:none. Não usar duplo toque, exceto o 2º toque do CHUTE para o rasteiro, porque o chute já espera a barra encher. Fonte: EA FIFA Mobile (botões), eFootball 2022, PredicTaps 2024, EA FC 26.
3. **Toque no campo** (modo alternativo): perto de um companheiro = passe no pé; à frente dele = enfiada. Fonte: EA FIFA Mobile (gestos).
4. **Tamanhos e posições** como na seção 1.12, conferidos por getBoundingClientRect no celular 844×390 dpr2, sem sobreposição. Fonte: Apple HIG, Material 3, Parhi 2006, Hoober 2017.
5. **Teclado.** Uma tecla por família (passe, lançar/cruzar, enfiada, chute) mais 2 modificadores:
   - A (tipo R1) = versão tensa ou colocado;
   - B (tipo L1) = versão por cobertura, cavadinha ou tabela.

   Duas vezes a tecla de cruzamento = cruzamento baixo. TROCAR na Q. GOLEIRO segurado em G/Y. Fonte: EA FIFA 20 manual.

## 3. O que aproveitamos de cada fonte

**Dados de jogo e análises próprias**
- **StatsBomb-149** (Copa 2022, Euro 2024, Bundesliga 23/24 do Leverkusen): tempos e acerto do passe por distância, altura e pressão; último terço; enfiada; lançamento; cruzamento por tipo e zona; escanteio. https://raw.githubusercontent.com/statsbomb/open-data/master/data/competitions.json
- **StatsBomb-360** (Copa 2022): sincronia da enfiada e quantos atacantes e defensores há na área no cruzamento. Mesma URL do item anterior.
- **StatsBomb-1485**: conversão e xG por distância, chutes no alvo, bloqueio, defesas do goleiro, segurar × espalmar, bissetriz e profundidade, 1×1, cavadinha, pé ruim. Mesma URL.
- **StatsBomb Events v4.0.0**: definições de pressão e de desfecho do goleiro. https://raw.githubusercontent.com/statsbomb/open-data/master/doc/Open%20Data%20Events%20v4.0.0.pdf
- **StatsBomb Live API**: régua de altura do passe pelo ombro. https://live-data-api-guide.statsbomb.com/api-reference/live-match-event-graph-schema.html
- **Kennett** (blog StatsBomb): referência independente de conversão dentro e fora da área, falta direta e pênalti. https://blogarchive.statsbomb.com/articles/soccer/premier-league-shot-benchmarks/
- **StatsBomb Blog cruzamentos** (dados Opta): acerto e "conversão" do cruzamento nas cinco grandes ligas. https://blogarchive.statsbomb.com/articles/soccer/how-low-can-you-go-assorted-thoughts-about-crosses/
- **Večeř**: 1 gol a cada 91,92 cruzamentos na Premier League. https://www2.karlin.mff.cuni.cz/~dostal/workshop_4_14.pdf
- **Metrica** (sample-data, cálculo próprio, 1.663 passes): seleção do recebedor, ponto previsto, validação do TTI, comportamento do recebedor e do defensor, enfiadas, tabelas e terceiro homem. https://raw.githubusercontent.com/metrica-sports/sample-data/master/data/Sample_Game_2/Sample_Game_2_RawEventsData.csv
- **Analytics FC**: volume de finalizações e gols vindos de enfiada na Premier League. https://analyticsfc.co.uk/blog/2022/09/02/through-ball-in-the-premier-league-receivers/
- **MLSsoccer/Opta 2014**: conversão da finalização vinda de enfiada (22%) contra a vinda de cruzamento (13%). https://www.mlssoccer.com/playoffs/2025/news/tempo-free-soccer-what-do-crosses-and-through-balls-say-about-mls-teams-attackin
- **CIES 88** (SkillCorner): definição e volume dos desmarques. https://football-observatory.com/IMG/sites/mr/mr88/en/

**Modelos de passe e de controle de campo**
- **Spearman 2017**: σ do TTI, taxa de controle λ e integração da posse ao longo da trajetória. https://static.hudl.com/craft/downloads/SSAC17-Physics-Based-Modeling-of-Pass-Probabilities-in-Soccer.pdf
- **Shaw/FoT** (Metrica_PitchControl.py): parâmetros de referência do TTI (0,7 s, 5 m/s, 15 m/s, κ_def). https://raw.githubusercontent.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking/master/Metrica_PitchControl.py
- **Pfaff 2022**: velocidade de saída do passe, aMax do jogador e linha de passe livre por grade de 1 m. https://arxiv.org/pdf/2210.16474
- **Fernández & Bornn 2018**: mapa de influência para a linha de passe e o espaço de desmarque. http://www.lukebornn.com/papers/fernandez_ssac_2018.pdf
- **Narizuka 2023**: TTI com inércia (Vmax e α, valores de Fujimura & Sugihara) e alcance real em 1 e 2 s. https://pmc.ncbi.nlm.nih.gov/articles/PMC9845223/
- **Buckland** (Simple Soccer): filtro de linha segura e os 3 alvos por recebedor. https://raw.githubusercontent.com/michaelnares/Simple-Soccer/HEAD/SoccerTeam.cpp
- **GRF** (Google Research Football): estrutura da seleção do recebedor (posição prevista, nota e assistência por tipo), só a ideia, sem copiar código. https://raw.githubusercontent.com/google-research/football/master/third_party/gfootball_engine/src/onthepitch/AIsupport/AIfunctions.cpp
- **Huang & Yang 2018**: reação do defensor ao passe curto e efeito da finta (só o resumo). https://lawdata.com.tw/tw/detail.aspx?no=414241

**Biomecânica do passe, do chute e do cruzamento**
- **Carlsson 2018** (JSSM 17:74): erro do passe a 20 m, pé ruim e força máxima. https://jssm.org/jssm-17-74.xml-Fulltext
- **Alcock 2012**: ângulos de saída dentro de ~3° para acertar 1 m² a 20 m. https://lida.sport-iat.de/dfb/Record/4024629?lng=en
- **Sakamoto 2026**: ângulo de saída de 25–30° para o alcance máximo e v0 menor com ângulo maior. https://journals.sagepub.com/doi/10.1177/17479541261452984
- **Shinkai 2008**: velocidade do peito do pé e da chapa e razão bola/pé. https://ojs.ub.uni-konstanz.de/cpa/article/view/1999/1867
- **AWS/DFL** (Bundesliga Match Facts Shot Speed): limiar de "chute forte" e exemplos de velocidade (sem URL no levantamento).
- **Nunome 2006**: velocidade do pé ruim, 84% da do bom (resumo, sem URL no levantamento).
- **Whiteside 2010**: velocidade e rotação do chute com curva e desvio lateral a 20 m. https://ojs.ub.uni-konstanz.de/cpa/article/view/4446
- **Shinkai 2009**: chute sem rotação ("folha seca"): velocidade, ângulo e rotação (sem URL no levantamento).
- **Kellis & Katis 2007**: faixa de velocidade do chute máximo e e(pé–bola). https://www.jssm.org/jssm-06-154.xml-Fulltext
- **SHU cruzamento** (Sheffield Hallam): queda da velocidade do cruzamento com defensor perto. https://shura.shu.ac.uk/7338/
- **Ispirlidis 2026** (JHSE, cita Pulling 2018 e Mitrotasios 2022): pé e curva do cruzamento e cruzamento rasteiro perto da linha de fundo. https://www.jhse.es/index.php/jhse/article/download/defensive-adaptations-crosses-elite-football/289/18650
- **Yamada & Hayashi 2015**: zona-alvo do cruzamento que vira gol e corrida do recebedor. https://www.shobix.co.jp/jssf/tempfiles/journal/2015/101.pdf

**Física da bola e solucionador**
- **Berkeley** (método de tiro): transformar o lançamento com alvo em problema de valor inicial resolvido por raiz. https://pythonnumericalmethods.studentorg.berkeley.edu/notebooks/chapter23.02-The-Shooting-Method.html
- **Forrest Smith** ("Solving Ballistic Trajectories"): por que parametrizar por ápice, e não por velocidade fixa (forrestthewoods.com).
- **Goff & Carré 2009**: ordem do laço (vz pelo ápice, vh pelo alcance), regressão do Magnus (Beckham) e decaimento do giro. https://wiki.penfieldrobotics.com/wiki/images/c/c0/Goff_Carre_AJP_2009.pdf
- **Goff 2017**: curvas CD(v) e CL(v) e crise do arrasto a ~12,5–15 m/s. https://shura.shu.ac.uk/15728/1/Kelley%20-%20Creating%20drag%20and%20lift%20curves%20%28AM%29.pdf
- **FIFA 2018** (manual de testes): quique e restituição da bola. https://digitalhub.fifa.com/m/4e93a32cd03542cf/original/testing-manual-fifa-quality-programme-for-footballs-2018.pdf

**Domínio, cabeceio e bola alta**
- **Iga & Nunome 2016**: amortecimento do domínio com a parte interna (velocidades antes e depois e recuo do pé). https://ojs.ub.uni-konstanz.de/cpa/article/view/6897/6193
- **Tahara 2012**: domínio de bola rasteira, com e sem giro de 90° (sem URL no levantamento).
- **Becker 2021**: velocidade do cabeceio em pé, saltando e com corrida. https://kluedo.ub.rptu.de/frontdoor/deliver/index/docId/6263/file/_10078-77-2021-v77-2021-07.pdf
- **Marcolin & Petrone 2006**: forma da curva de precisão do cabeceio pela folga de alcance. https://ojs.ub.uni-konstanz.de/cpa/article/view/219/179
- **Kristensen 2002**: massa efetiva e velocidade da cabeça no cabeceio forte. https://ojs.ub.uni-konstanz.de/cpa/article/view/726/648
- **Babbs 2001**: duração do contato, faixa de massa efetiva e velocidade da bola no cabeceio em jogo. https://docs.lib.purdue.edu/cgi/viewcontent.cgi?article=1035&context=bmepubs
- **Fílter 2022**: altura da cabeça no salto com corrida, último apoio e velocidades de decolagem. https://repository.mmu.ac.uk/articles/journal_contribution/Effect_of_Ball_Inclusion_on_Jump_Performance_in_Soccer_Players_A_Biomechanical_Approach/32460069
- **icSPORTS 2018**: altura dos saltos (CMJ, com braços, num pé) que define o atributo de impulsão. https://www.scitepress.org/Papers/2018/69001/69001.pdf
- **McLeod & Dienes 1996** (cita Craig 2006): atraso na leitura da bola alta, chegar correndo e o Magnus ignorado no começo. https://users.sussex.ac.uk/~dienes/McLeod%20&%20Dienes%201996.pdf
- **Ruschel 2011**: tempo de reação simples por posição (o goleiro é o mais rápido). https://www.redalyc.org/pdf/2730/273022544008.pdf

**Goleiro e regras**
- **Higueras-Herbada 2020** (cita Navia 2017): o lado antes da altura e a reação após o toque. https://pmc.ncbi.nlm.nih.gov/articles/PMC7056909/
- **Monteiro 2022**: velocidade e deslocamento do centro de massa no mergulho. https://pmc.ncbi.nlm.nih.gov/articles/PMC9630263/
- **Ibrahim 2019** (dois artigos) e **Tsai 2005**: tempo até a bola, impulsão das pernas e canto alto mais lento (sem URL no levantamento).
- **Bransen 2025** (arXiv 2505.24629): alcance do mergulho no pênalti, ρ = 0,7 e 61,5% de mergulho antecipado (sem URL no levantamento).
- **IFAB Regra 14**: posição do goleiro no pênalti e repetição por infração. https://theifab.com/laws/latest/the-penalty-kick
- **IFAB Lei 11**: instante do julgamento do impedimento, partes do corpo que contam e exceções. https://www.theifab.com/laws/latest/offside/
- **EA Help (chute)**: quando usar a cavadinha. https://help.ea.com/en/articles/ea-sports-fc/how-to-shoot/

**Controles nos jogos atuais**
- **EA FIFA Mobile (botões)**: conjunto de botões por posse, variantes por deslize e saída do goleiro. https://www.ea.com/able/news/gameplay-guide
- **EA FIFA Mobile (gestos)**: tocar no campo para passe ou enfiada, efeito pelo atributo e goleiro liga/desliga. https://www.ea.com/ea-studios/ea-sports/news/gameplay-controls-guide-gesture-controls
- **EA FIFA 20 manual**: mapa de console com famílias + modificadores para o teclado. https://ea.com/able/resources/fifa/fifa-20/ps4/text-manual
- **EA FC 24 Switch**: passe manual com força ≥ 40 e recebedor correndo para o destino. https://www.ea.com/games/ea-sports-fc/pitch-notes/news/fc-24-switch-deepdive
- **EA FC 25 TU#8**: a força escolhe a distância e a primeira responde mesmo com o comando atrasado. https://www.ea.com/games/ea-sports-fc/fc-25/news/fc-25-pitch-notes-gameplay-refresh-update
- **EA FC 25 TU#15**: aceleração limitada do goleiro que sai e precisão do rasteiro pelo atributo. https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc25-season-finale-update
- **EA FC 26 deep dive**: 2º toque para o chute rasteiro, fim da finalização cronometrada, Passing Lanes, primeira a 135°/180° e cruzamento mais à frente. https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive
- **EA FC 27 deep dive**: enfiada seguindo estritamente o analógico. https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-gameplay-deep-dive
- **Konami patente US8172657B2**: cone de busca do recebedor + campo de visão do passador, checados a 1/60 s. https://patents.google.com/patent/US8172657B2/en
- **eFootball v2.2.0**: níveis de assistência na velocidade do passe. https://www.konami.com/efootball/ar/page/2023/season2_patch-notes_v2-20
- **eFootball 2022 comandos**: deslize curto no botão, passe e chute fortes custando tempo, passe e corre. https://www.konami.com/efootball/en-us/page/new_controls

**Toque e interface**
- **Apple HIG**: piso de 44×44 pt. https://developer.apple.com/design/human-interface-guidelines/buttons
- **Material 3**: 48×48 dp com 8 dp de folga. https://m3.material.io/foundations/designing/structure
- **Parhi 2006**: 9,2–9,6 mm para toques com o polegar. https://www.microsoft.com/en-us/research/?p=155150
- **Hoober 2017**: 12 mm nos cantos e desenhar tudo ~20% maior. https://www.uxmatters.com/mt/archives/2017/07/design-for-fingers-touch-and-people-part-3.php
- **PredicTaps 2024**: custo do duplo toque (150–500 ms) e limiar perceptível de 69 ms. https://arxiv.org/html/2408.02525v1

## 4. Incertezas

**Bases de dados**
- **Duas análises StatsBomb diferentes.** Passes, cruzamentos e escanteios saem de 149 partidas (Copa 2022, Euro 2024, Leverkusen 23/24); chutes e goleiro saem de 1.485 jogos, com outras competições. O Leverkusen é um time dominante, e as competições de seleção pesam muito; isso pode puxar volumes e acertos. Todos os dados são de elite: metas "reais" num jogo de tempos curtos precisam ser escaladas pelo tempo de jogo e comparadas com a versão publicada ("sem recuo").
- **Tempos do StatsBomb são de toque até a recepção.** No lançamento, o tempo pode incluir um quique. Por isso o ápice derivado (≤ 6,7 m e ≤ 9,7 m) é só limite superior. O exemplo resolvido de 40 m com ápice de 8 m dá 2,52 s, contra a mediana real de 2,81 s para 40–50 m.
- **Metrica tem só 2 jogos.** Os 92,6% da nota de seleção usam a direção real do passe no lugar do analógico. Com direção e força perfeitas o acerto chega a 98,3%, número otimista. A ambiguidade é real: em 40,7% dos passes há 2 ou mais companheiros no cone de ±15°.
- **Enfiada: os dois números de distância não se comparam.** O SB360 mede 15,6 m entre o recebedor e o ponto de queda, com só 76 enfiadas e o recebedor aproximado pelo companheiro visível mais próximo. A Metrica mede 6,3 m de avanço no sentido do ataque, entre passes definidos por ≥ 4 m à frente. As definições e as amostras são diferentes: não somar nem trocar um número pelo outro.

**Valores com conflito ou ambiguidade**
- **Pfaff 2022.** A desaceleração de 7,93 m/s² contradiz os tempos do StatsBomb. O artigo troca as unidades ("10 m/s²" e "4,98 m/s"). Os dados são de um só clube, e o pico de 11,13 m/s de jogador é alto. Usar só a velocidade de saída e a aceleração do jogador.
- **κ_def.** O código de referência usa 1, e o comentário dele diz que o artigo de 2018 usa 1,72. A escolha fica para o teste.

**Precisão e chute**
- **Lançamento "±3 m a 40 m para bom lançador".** Não há medida direta. O erro de 2,3° vem de passes com a parte interna a 20 m, feitos por jogadoras da 1ª divisão sueca, e a extrapolação angular para 40 m ignora vento e Magnus. Conta nossa: com erro médio de 1,6 m numa gaussiana 2D (σ ≈ 1,28 m), um raio de 3 m cobre ~94% dos lançamentos. A meta é plausível, mas precisa ser confirmada no teste.
- **Amostras pequenas no chute.** A velocidade vem de 2 jogadores (Shinkai 2008) e o pé ruim de 5 (Nunome 2006). Os multiplicadores (×1,4, ×1,15, ×1,2, ×1,1) são pontos de partida.
- **Correlação, não causa.** O 1×1 e a cavadinha mostram correlação: o goleiro longe da linha costuma ser o que já foi batido. Não concluir que sair cedo piora a defesa; o teste só exige que a conversão não cresça.

**Goleiro**
- **Reação e mergulho medidos fora do jogo.** A reação vem de pênaltis e futsal, não de chute em jogo. O mergulho vem de 6 e 10 goleiros em laboratório. O alcance da mão (+ ~2,0 m sobre o centro de massa) é estimativa da pesquisa.

**Cabeceio, domínio e defensor**
- **Pouca medida direta.** Marcolin & Petrone tem n = 3 (confiança baixa): vale a forma da curva, não os valores. Kristensen tem n = 5. O e(cabeça–bola) ≳ 0,7 é conta da pesquisa, não da fonte. Peito e coxa não têm medição direta: e ≤ 0,82 é só teto.
- **Huang & Yang 2018:** só o resumo em inglês foi lido (confiança baixa).
- **Sakamoto 2026:** goleiros de base, ângulos extrapolados, sem efeito, só o resumo.

**Controles**
- **EA e Konami não publicam números.** O θ do cone de busca e as faixas de força × distância são propostas a calibrar.
- **FC 26 × FC 27 discordam na enfiada.** O FC 26 usa Passing Lanes (escolhe o melhor recebedor no vão, respeitando a mira). O FC 27 faz a enfiada seguir estritamente o analógico. Seguimos o FC 27 para o ponto e o FC 26 para o adiantamento. Se o dono preferir outro comportamento, é decisão de produto.
- **Precisão do passe alto no FC 26 TU 1.5.0:** citada sem URL própria.

**Fontes lidas parcialmente**
- Sem URL no levantamento: AWS/DFL, Nunome 2006, Shinkai 2009, Tahara 2012, Ibrahim 2019, Tsai 2005, Bransen 2025 e Craig 2006. Só o resumo foi lido de Nunome 2006, Sakamoto 2026, Alcock 2012, Huang & Yang 2018 e de um dos artigos de Ibrahim 2019.

**Nomes de código do `futebol3d/` nos achados**
- Vários "como aplicar" citam nomes do `futebol3d/`: `ball.js`/`rollSpeedFor`, `match.js`, `laneRisk`, `doHeader`, `pontoAereo`, `alvosBolaParada`/`setpieceAI`, `passes-diag`, `chutes-diag`, `bola-parada-test`, `goleiro-sai-test`, `test-ball`, `offside-test` e `disputa-aerea-test`. Pela regra do projeto, o GOLAÇO novo não lê nem copia esse código. Os testes e funções equivalentes têm de ser criados do zero em `golaco/`: `bola.js` (`velParaDistancia`), `jogador.js` (`passoCorpo`), `acoes.js`, `ia.js`, `config.js` e `golaco/tools/`.
