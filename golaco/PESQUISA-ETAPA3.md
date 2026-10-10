# PESQUISA — Etapa 3 do GOLAÇO (11×11, tática, IA com e sem bola e "Editar time")

Base da Etapa 3 (plano: partida 11×11 com formações e tática, IA com e sem bola mais intensa,
"Editar time" na pausa no estilo do Gerenciar equipe do FC, jogo aéreo com troca para quem disputa).
Aqui fica o **número de jogo real que vira meta de teste** e constante do `js/config.js` (blocos
`PARTIDA`, `TATICA`, `IA_DEFESA`, `IA_ATAQUE`, `DEFESA_HUMANO`, `TROCA_AEREA`) e o que foi aproveitado
de cada fonte. Os números vêm de fontes abertas e de duas **análises próprias** sobre o rastreamento
aberto da Metrica Sports: a 1ª ("rascunho" no texto; `tools/pesquisa/analise_metrica.py`) e a 2ª
(`tools/pesquisa/tatica_metrica.py`). As medidas dos testes da partida
(`tools/lib/partida-medidas.mjs`) usam as mesmas definições. A seção 11 traz a pesquisa da tela
"Editar time", a 12 a ameaça esperada (xT) usada pela IA com a bola e a 13 como cada número virou
constante.

## 0. Como ler

- **Coordenadas do GOLAÇO**: x = comprimento (±52,5), z = largura (±34). Todas as tabelas usam um time que **ataca para
  +x**; a direita de quem ataca é **+z** (lateral-direito em z > 0). Para o time que ataca para −x, troque o sinal de x e z.
- **Altura da linha** = distância do defensor de linha mais recuado (sem o goleiro) até a **própria** linha de gol
  (definição da FIFA, EFI 2022). Linha a 32 m ⇒ x = −52,5 + 32 = −20,5.
- **Comprimento do bloco** = do jogador de linha mais recuado ao mais adiantado (sem goleiro; FIFA EFI). **Largura** =
  do mais aberto de um lado ao mais aberto do outro (sem goleiro).
- **Terços pela bola** (referencial de quem está sendo medido): t1 = bola no meu terço defensivo (x_bola < −17,5),
  t2 = meio, t3 = meu terço de ataque (x_bola ≥ 17,5). Sem bola, t1 ≈ **bloco baixo**, t2 ≈ **bloco médio**,
  t3 ≈ **bloco alto/pressão alta**.
- **Corredores** (linhas da área prolongadas): centro |z| ≤ 9,16 · meio-espaço 9,16–20,16 · corredor lateral > 20,16.
- **Confiança**: **A** = estudo revisado/rastreamento grande ou documento oficial; **M** = amostra pequena (incl. a
  análise própria de 2 jogos), dado oficial de jogo comercial, ou exemplo de um time; **B** = guia de comunidade,
  inferência ou estimativa minha.
- **Análise própria (Metrica)**: 2 partidas anônimas (Sample Game 1 e 2), 25 Hz, posse tirada dos eventos, só bola
  rolando, 5 Hz para forma. Liga e nível desconhecidos (9,7 km por 90 por jogador ⇒ ritmo um pouco abaixo da elite).
  Bate com a Bundesliga (Forcher 2024) e com a Copa 2022 (FIFA) nas medidas de forma — por isso serve de referência,
  sempre como **faixa**, nunca ponto.

---

## 1. Formações: uso real e posições por função

### 1.1 O que se usa (Premier League, partidas × times)

| Formação | 2023/24 | 2024/25 | Confiança / fonte |
|---|---|---|---|
| 4-2-3-1 | 39% | **54%** (primária de 13 dos 20 times) | A — Premier League 2025 |
| 3-4-2-1 | 9% | 15% | A — idem |
| 4-3-3 | 23% | 15% | A — idem |
| 4-1-4-1 | — | 4% | A — idem |
| 4-4-2 | 7% | 3% | A — idem |
| 4-4-1-1 / 3-5-2 | 5% / 5% | — | A — idem |

**A formação muda com a fase** (Shaw & Glickman 2019, 180 jogos): o 4-3-3 defende como 4-1-4-1/4-5-1, o 4-2-3-1 como
4-4-1-1, o 3-4-3 como 5-4-1 e o 3-5-2 como 5-3-2; atacando, laterais sobem à altura do volante e os meias abertos viram
trio de frente. A área do time atacando é ≈ 2× a defendendo (exemplo de um time; A). O EA FC 25 formaliza isso: **a
formação define a forma sem bola; as funções definem o comportamento com bola** (A — EA Pitch Notes FC 25).

Menu do GOLAÇO (proposta): 4-3-3, 4-2-3-1, 4-4-2, 4-1-4-1, 3-5-2, 5-3-2, 3-4-3 (3-4-2-1). Cobre > 95% do uso real.

### 1.2 Posição média REAL por função (análise própria, Metrica; time em 4-4-2 por profundidade)

Média de 5 "times-tempo" com 10 de linha fixos (2 jogos × 2 times × 2 tempos, menos os com troca). Funções pela ordem de
profundidade (4 defesa, 4 meio, 2 frente) e pelo lado médio. "Bola no centro" = |x_bola| < 10 e |z_bola| < 10.
**Cuidado:** médias sobre várias posições da bola encolhem a largura (o bloco desliza de lado); a largura instantânea é
a da seção 2. Confiança **M**.

**Sem bola (defendendo)** — coordenadas (x, z):

| Função | Bola no centro | Bola no meu terço (bloco baixo) | Bola no meio (bloco médio) | Bola no terço de ataque (bloco alto) |
|---|---|---|---|---|
| GOL | (−42, 0) | (−49, 0) | (−42, 0) | (−34, 0) |
| LD | (−17, 15) | (−35, 12) | (−17, 15) | (4, 18) |
| ZD | (−18, 4) | (−37, 4) | (−19, 4) | (−2, 7) |
| ZE | (−17, −4) | (−36, −3) | (−17, −5) | (0, −3) |
| LE | (−17, −14) | (−35, −12) | (−17, −14) | (3, −12) |
| MD (aberto) | (−5, 10) | (−26, 11) | (−5, 11) | (20, 10) |
| MCD | (−8, 2) | (−28, 2) | (−9, 2) | (11, 4) |
| MCE | (−6, −3) | (−27, −2) | (−6, −3) | (17, −3) |
| ME (aberto) | (−5, −14) | (−26, −10) | (−5, −14) | (18, −11) |
| AT direita | (6, 2) | (−10, 1) | (5, 1) | (28, 5) |
| AT esquerda | (5, −4) | (−10, −2) | (6, −3) | (28, −1) |

**Com bola (atacando)**:

| Função | Bola no centro | Bola no meu terço (construção) | Bola no meio (progressão) | Bola no terço de ataque (criação) |
|---|---|---|---|---|
| GOL | (−38, 0) | (−46, −1) | (−38, 0) | (−30, 0) |
| LD | (−4, 21) | (−28, 16) | (−4, 22) | (15, 19) |
| ZD | (−11, 7) | (−32, 5) | (−12, 8) | (5, 8) |
| ZE | (−10, −4) | (−31, −6) | (−11, −5) | (7, −4) |
| LE | (−5, −16) | (−27, −17) | (−4, −18) | (14, −14) |
| MD (aberto) | (9, 15) | (−14, 13) | (9, 15) | (28, 12) |
| MCD | (1, 3) | (−21, 1) | (1, 4) | (18, 3) |
| MCE | (3, −4) | (−18, −5) | (3, −3) | (23, −4) |
| ME (aberto) | (9, −17) | (−13, −15) | (9, −17) | (28, −14) |
| AT direita | (14, 3) | (−2, 3) | (15, 4) | (33, 4) |
| AT esquerda | (15, 0) | (−2, −5) | (16, −2) | (33, −4) |

Leituras que viram regra:
- **Sem bola, bola no centro**: linhas a x ≈ −17,5 / −6 / +5,5 ⇒ **defesa–meio ≈ 11,5 m e meio–ataque ≈ 11,5 m**
  (bate com Forcher 2024: 10,2 e 13,2 m; A). Zagueiros ~8–9 m entre si; laterais ~10–11 m por fora deles.
- **Com bola**: os laterais sobem ~13 m e abrem ~5 m; os zagueiros abrem para ±5–8; a frente sobe ~9 m; o goleiro
  sobe ~4 m. Defesa–meio com bola ≈ 15,5 m (mediana Metrica), meio–ataque ≈ 10,6 m.
- **O atacante não acompanha o recuo por inteiro**: sem bola, do bloco médio para o baixo os atacantes descem só ~15 m
  (k ≈ 0,43), enquanto a defesa desce ~18–19 m (k ≈ 0,51); do médio para o alto, os atacantes sobem ~23 m (k ≈ 0,66).
  Ou seja, **a relação bola → posição não é linear**: quem está na frente fica mais alto quando a bola está no fundo
  (saída para o contra-ataque). Por isso a proposta (2.6) interpola entre **3 tabelas por terço**, e não usa um único k.
- k efetivo por função, entre terços (Δx da função ÷ 35 m de Δx da bola):

| Função | Sem bola t1→t2 | Sem bola t2→t3 | Com bola t1→t2 | Com bola t2→t3 |
|---|---|---|---|---|
| Goleiro | 0,20 | 0,23 | 0,23 | 0,23 |
| Lateral | 0,51 | 0,60 | 0,69 | 0,54 |
| Zagueiro | 0,51 | 0,49 | 0,57 | 0,49 |
| Meia aberto | 0,60 | 0,71 | 0,66 | 0,54 |
| Meio central | 0,54 | 0,57 | 0,63 | 0,49 |
| Atacante | 0,43 | 0,66 | 0,49 | 0,51 |

  Na largura, k_z por função (regressão do rascunho, Metrica; M): sem bola zagueiro 0,32 · lateral 0,30 · meio central
  0,41 · meia aberto 0,29 · atacante 0,34; com bola 0,29 · 0,23 · 0,35 · 0,21 · 0,27. Centroide do time:
  x_c ≈ 0,59·x_bola − 8,6 (sem bola) / +1,9 (com bola); z_c ≈ 0,33·z_bola (sem) / 0,29·z_bola (com) (r 0,78–0,87).

### 1.3 Posição-base proposta por formação (bola no centro), calibrada pelos dados acima

Regras de calibração: **sem bola** (bloco médio, "linha 50") defensores em x ≈ −19/−20 (altura ≈ 32–33 m, mediana real
31,8 m), meio a ~11 m deles, frente a ~12 m do meio; largura entre médias 30–34 m (instantânea ~36–40 m). **Com bola**
zagueiros em x ≈ −12/−13 (linha ≈ 40 m; real 38,4 m), frente em +15/+18, largura entre médias 44–52 m (instantânea
~48–52 m). Pontas/alas modernos seguram o corredor (|z| ≥ 22); meias por dentro no meio-espaço (|z| ≈ 9–13).
Confiança **M** (derivado; ajustar com o teste de forma). Notação: GOL, LD/ZD/ZC/ZE/LE, ALD/ALE (alas), VOL, VD/VE
(volantes), MCD/MCE, MD/ME (meias abertos), MEI (meia central), MEID/MEIE (meias por dentro), PD/PE (pontas), CA/CAD/CAE.

| Formação | Fase | GOL | Defesa | Meio | Frente |
|---|---|---|---|---|---|
| **4-3-3** | sem bola (4-1-4-1) | (−42, 0) | LD (−19, 15) · ZD (−20, 5) · ZE (−20, −5) · LE (−19, −15) | VOL (−13, 0) · MCD (−8, 8) · MCE (−8, −8) | PD (−6, 17) · PE (−6, −17) · CA (4, 0) |
| | com bola | (−38, 0) | LD (−3, 21) · ZD (−13, 9) · ZE (−13, −9) · LE (−3, −21) | VOL (−6, 0) · MCD (4, 11) · MCE (4, −11) | PD (14, 24) · PE (14, −24) · CA (17, 0) |
| **4-2-3-1** | sem bola (4-4-1-1) | (−42, 0) | LD (−19, 15) · ZD (−20, 5) · ZE (−20, −5) · LE (−19, −15) | VD (−10, 5) · VE (−10, −5) · MD (−7, 16) · ME (−7, −16) | MEI (−1, 0) · CA (4, 0) |
| | com bola | (−38, 0) | LD (−3, 21) · ZD (−13, 9) · ZE (−13, −9) · LE (−3, −21) | VD (−6, 7) · VE (−5, −7) | PD (12, 23) · PE (12, −23) · MEI (8, 0) · CA (17, 0) |
| **4-4-2** | sem bola | (−42, 0) | LD (−19, 15) · ZD (−20, 5) · ZE (−20, −5) · LE (−19, −15) | MD (−7, 16) · MCD (−9, 5) · MCE (−9, −5) · ME (−7, −16) | CAD (4, 4) · CAE (4, −4) |
| | com bola | (−38, 0) | LD (−3, 22) · ZD (−12, 8) · ZE (−12, −8) · LE (−3, −22) | MD (10, 23) · MCD (0, 6) · MCE (2, −6) · ME (10, −23) | CAD (16, 4) · CAE (15, −5) |
| **4-1-4-1** | sem bola | (−42, 0) | como 4-4-2 | VOL (−14, 0) · MCD (−7, 7) · MCE (−7, −7) · MD (−6, 17) · ME (−6, −17) | CA (4, 0) |
| | com bola | (−38, 0) | como 4-3-3 | VOL (−6, 0) · MCD (5, 10) · MCE (5, −10) · MD (12, 24) · ME (12, −24) | CA (17, 0) |
| **3-5-2** | sem bola (5-3-2) | (−42, 0) | ZD (−20, 9) · ZC (−21, 0) · ZE (−20, −9) · ALD (−18, 19) · ALE (−18, −19) | VOL (−11, 0) · MCD (−8, 9) · MCE (−8, −9) | CAD (4, 5) · CAE (4, −5) |
| | com bola | (−38, 0) | ZD (−12, 14) · ZC (−15, 0) · ZE (−12, −14) | ALD (8, 26) · ALE (8, −26) · VOL (−5, 0) · MCD (4, 11) · MCE (4, −11) | CAD (16, 5) · CAE (16, −5) |
| **5-3-2** | sem bola | (−43, 0) | ALD (−20, 20) · ZD (−21, 9) · ZC (−22, 0) · ZE (−21, −9) · ALE (−20, −20) | VOL (−12, 0) · MCD (−10, 10) · MCE (−10, −10) | CAD (2, 5) · CAE (2, −5) |
| | com bola | (−39, 0) | ZD (−14, 14) · ZC (−17, 0) · ZE (−14, −14) · ALD (3, 25) · ALE (3, −25) | VOL (−7, 0) · MCD (3, 11) · MCE (3, −11) | CAD (15, 5) · CAE (15, −5) |
| **3-4-3** (3-4-2-1) | sem bola (5-4-1) | (−42, 0) | ZD (−20, 9) · ZC (−21, 0) · ZE (−20, −9) · ALD (−19, 20) · ALE (−19, −20) | VD (−9, 6) · VE (−9, −6) · MEID (−5, 13) · MEIE (−5, −13) | CA (4, 0) |
| | com bola | (−38, 0) | ZD (−11, 15) · ZC (−14, 0) · ZE (−11, −15) | ALD (10, 26) · ALE (10, −26) · VD (−4, 7) · VE (−4, −7) | MEID (12, 11) · MEIE (12, −11) · CA (18, 0) |

Conferência: sem bola, linha de defesa → frente = 23–25 m entre médias (real 22–24 m em médias; bloco instantâneo
27–30 m); com bola, 29–31 m entre médias (instantâneo 32–35 m). Variante de **pressão alta no 4-3-3**: os pontas ficam
em x ≈ +2 e |z| ≈ 15 para pular nos laterais adversários (forma 4-3-3 "de cima"), o CA em +8.

Nomes de posição e desenho do campinho: padrão Opta/StatsBomb (GK, RB, RCB, CB, LCB, LB, RWB, LWB, CDM, RCM, LCM, RM, LM,
CAM, RW, LW, ST…), com as coordenadas de 68 formações já mapeadas no mplsoccer (`formations.py`). Para o
"Editar time", o FC 25 alterna a vista **com bola / sem bola** do mesmo campinho (A — EA FC 25/26).

---

## 2. Compactação: comprimento e largura do bloco por altura

### 2.1 Tabela consolidada (10 de linha, sem goleiro)

| Situação | Comprimento (m) | Largura (m) | Confiança / fonte |
|---|---|---|---|
| **Sem bola, bloco baixo** (bola no meu terço) | **30,4** (24,3–36,8) | **33,2** (29,0–37,0) | M — Metrica (própria) |
| Sem bola, bloco baixo — exemplos | 24,3 (Al Ahly) · 32,3 (Al Ittihad) | — | M — FIFA, Mundial de Clubes 2023 |
| Sem bola, bloco baixo — caso extremo | 11,1 (todos os 10) | 30,1 | M — UEFA, Real Madrid × Man City 2023/24 |
| **Sem bola, bloco médio** (bola no meio) | **27,2** (23,8–31,7) | **37,2** (34,2–41,0) | M — Metrica |
| Sem bola, bloco médio — Copa 2022 (média do torneio) | **27,2** (22,5 Arábia – 29,1 Argentina) | **40,1** (38,4 França – 40,75 Marrocos) | A — FIFA TSG 2022 |
| Sem bola, bloco médio — exemplos | 26,0 (Al Ahly) · 32,8 (Al Ittihad) · 21,8 (Real Madrid, 4-4-2) | 44 entre laterais (Real Madrid) | M — FIFA 2023, UEFA 2023/24 |
| **Sem bola, bloco alto** (bola no meu terço de ataque) | **34,7** (30,0–40,4) | **39,1** (35,5–42,8) | M — Metrica |
| Bloco alto × 2018 (Copa 2022) | ~1 m mais curto | ~2 m mais largo | M — FIFA TSG 2022 |
| Sem bola, geral (Bundesliga 2020/21, 153 jogos) | 32,5 ± 8,7 | 37,3 ± 4,8 (área 793 ± 227 m²) | A — Forcher 2024 |
| Sem bola, geral (La Liga) | 34–36 | 36–37 | A — Castellano 2013; Castellano & Álvarez-Pastor (via Rico-González 2022) |
| **Com bola, construção** (bola no meu terço) | **36,5** (30,3–41,1) | **44,3** (34,1–54,1) | M — Metrica |
| **Com bola, progressão** (bola no meio) | **32,5** (29,7–35,6) | **52,3** (44,1–57,6) | M — Metrica |
| **Com bola, criação** (bola no terço de ataque) | **35,6** (32,1–39,8) | **44,6** (38,6–50,4) | M — Metrica |
| Com bola, geral (La Liga) | 36–37 ± 7 | 41 ± 10 | A — Castellano 2013 (via Rico-González) |
| Faixa geral da revisão (13 estudos) | 31–46 | 35–48 | A — Rico-González 2022 |
| Área: "compacto" × "solto" (Opta Vision) | compacto < **600 m²**; solto > **900 m²** | | A — The Analyst/Opta Vision 2024/25 |
| Área com bola ÷ sem bola | 1,3–2,0 (Metrica 1,48; Shaw ~2) | | M |
| Distância entre centroides dos times (no comprimento) | 6,7 (5,5–7,9) | | M — Metrica; A — Frencken (UCL) 7 ± 2 |
| Pressão alta × bloco recuado (experimento 11×11, juvenis) | pressão alta = time **mais comprido** e linhas mais separadas; centroides a 7 ± 1 m (alta) × 9 ± 2 m (recuado) | | M — Low et al. 2021 |
| Subgrupo que decide | área dos **5 defensores mais perto da bola**: 196 m² (defesa bem-sucedida) × 202 m² | | A — Forcher 2024 |

Leituras:
1. **O bloco mais curto é o médio** (~27 m): bloco baixo estica um pouco (atacantes ficam mais altos) e o alto estica
   mais (~35 m: a frente pressiona e a defesa não sobe tudo). Confirmado em duas fontes independentes (FIFA 2022 e
   Metrica, ambas 27,2 m no bloco médio).
2. **A largura sem bola cresce com a altura do bloco** (33 → 37 → 39 m), e **com bola é máxima no meio** (52 m) e cai
   no último terço (45 m: todo mundo converge para a área) e na construção (44 m).
3. **Defesa compacta se mede perto da bola** (Forcher 2024): não adianta o bloco inteiro estar estreito se os 5 mais
   perto da bola estão soltos.

### 2.2 Definição de bloco para o código (FIFA EFI 2022)

- **Bloco médio**: ≥ 8 jogadores de linha do time sem bola no terço do meio (ou meio + defesa), ≥ 4 atrás da bola,
  "parados" (< 10 km/h) em ≥ 1,6 s dos últimos 2,0 s; a fase acaba se o critério falhar 0,4 s em 2,0 s (A — FIFA TSG).
- **Bloco baixo**: 8 jogadores de linha só no terço defensivo (A — FIFA). **Pressão alta**: os da frente fecham os
  defensores adversários na construção (A — FIFA EFI). **Contrapressão**: logo após a perda, pressão agressiva
  para retomar, sobretudo após perder no último terço (A — FIFA EFI). **Recomposição**: correr para o próprio gol.
- Tempo nas fases (Copa feminina 2023, % do tempo sem bola): bloco médio 18,3%, bloco baixo 15,3%, bloco alto 4,8%,
  pressão média 5,7%, pressão alta 3,5%, pressão baixa 1,0%, recomposição 4,2% (M — Front. Sports 2026). Bloco baixo
  18% do tempo sem bola na Copa feminina 2023 (FIFA). Bloco médio na Copa 2022: Marrocos 38%, França 37%, Espanha 9%.
  Real Madrid 38% do tempo sem bola em bloco médio em Munique 2023/24. Arsenal: 21,2% em bloco baixo e 47% em "alta
  compactação" contra a construção adversária (2024/25). (M)

---

## 3. Altura da linha defensiva, linha de 4 e impedimento

### 3.1 Altura da linha (último defensor de linha até o próprio gol)

| Situação | Altura (m) | Confiança / fonte |
|---|---|---|
| Sem bola, bola no meu terço | **15,0** (10,7–18,3) | M — Metrica |
| Sem bola, bola no meio | **31,8** (25,8–37,6) | M — Metrica |
| Sem bola, bola no meu terço de ataque | **48,0** (43,6–52,0) | M — Metrica |
| Com bola, por terço | 17,3 (11,4–23,9) · 38,4 (31,4–45,1) · 53,1 (48,3–57,0) | M — Metrica |
| Defensor mais recuado por zona da bola (La Liga) | atacando, zonas 1–5: ~10, 25, 38, 45, 50 · defendendo, zonas 1–5: ~45, 40, 30, 20, 6 | A/M — Castellano & Álvarez-Pastor (lido em gráfico, via Rico-González 2022) |
| Defensor mais próximo do próprio gol (times de cima da La Liga) | 22–29 (mais recuado vencendo ou empatando) | A — Santos et al. (via Rico-González) |
| Bloco médio do Real Madrid (4-4-2), 2023/24 | **35,7** | M — UEFA |
| Man City, linha média num jogo de 67% de posse | **~55** | M — UEFA 2023/24 |
| Onde as ações defensivas acontecem ("Defensive Distance", Bundesliga 2021/22) | **40,3–46,3** (Bayern 46,3, o mais alto) | A — StatsBomb |
| Onde começam as posses em jogo corrido ("start distance", PL 2024/25) | 39,5 (Ipswich) – **46,2** (Man City) | A — Opta/The Analyst |
| Linha recua × sobe por estilo, no EA FC 25 | Recuada 1–30 (padrão 25) · Equilibrada 31–60 (50) · Alta 61–90 (70) · Agressiva 91–100 (95) | A — EA FC 25 FC IQ |
| Goleiro atrás do último defensor | ~22 m (15,6–27,8) sem bola; 23 m com bola. Revisão: 9 m (bola longe) a 30 m (bola perto) | M — Metrica; A — Fradua (via Rico-González) |
| Distância do último defensor até a bola (sem bola) | 7,8 m (bola no meu terço) · **20,5 m** (meio) · 36,9 m (bola lá na frente) | M — Metrica |

**Mapa proposto controle → altura (bola no centro)**, ancorado na mediana real e nos quartis:
`altura_linha ≈ 20 + 0,25 × linha` (m), linha 1–100 ⇒ Recuada 25 → **26 m**, Equilibrada 50 → **32,5 m**, Alta 70 →
**37,5 m**, Agressiva 95 → **44 m**. Os valores caem dentro de p25–p90 reais (25,8–43,2 m) (M/B). A linha também se move
com a bola (k ≈ 0,5 da defesa) e tem piso/teto: ≥ 6 m do gol e ≤ ~56 m (p90 real), e nunca à frente da bola quando ela
está atrás dos defensores.

### 3.2 Linha de 4 alinhada (análise própria nova, M)

Espalhamento no comprimento entre os 4 jogadores de linha mais recuados (máx − mín de x), sem bola:

| Bola | Mediana | p25–p75 | p90 |
|---|---|---|---|
| No meu terço | **3,5 m** | 2,2–5,5 | 8,2 |
| No meio | **4,0 m** | 2,2–7,3 | 10,6 |
| No terço de ataque (pressão alta) | **8,4 m** | 4,1–13,9 | 17,7 |
| Geral (desvio-padrão dos 4) | 1,7 m | 1,0–3,3 | 5,2 |

Ou seja: **linha de 4 "reta" = ≤ ~4 m de diferença entre o mais recuado e o mais adiantado** no bloco baixo/médio; na
pressão alta um lateral salta e a linha "quebra" (8 m). O FC 26 mexeu justamente nisso: "a linha não sobe tão longe
automaticamente para deixar em impedimento" e "zagueiros que saem da linha o fazem com mais segurança" (A — EA FC 26).

### 3.3 Linha de impedimento (análise própria nova, M)

- Atacante mais adiantado em relação à linha de impedimento (penúltimo adversário, incluindo o goleiro, ou a bola, ou o
  meio-campo): **mediana 2,0 m atrás da linha** (p25 0,7 · p75 3,7 · p10 0,8 m **à frente**).
- Alguém do time com bola em **posição** de impedimento (não necessariamente participando): **16%** do tempo com bola.
- Impedimentos marcados: os times que mais deixam o adversário em impedimento na PL 2024/25 tiveram 88–96 na temporada
  (≈ 2,3–2,5 por jogo; Liverpool 96, Aston Villa 93, Chelsea 88) (A — Opta Vision). Total por partida (dois times):
  estimativa **~3–4** (B, inferido).
- FIFA 14 ("Teammate Intelligence") e FC 26: atacantes **olham a linha** antes de partir e voltam mais rápido quando
  estão em impedimento (M — EA).

---

## 4. Pressão

### 4.1 Intensidade de pressão do time (PPDA e afins)

| Medida | Valores | Confiança / fonte |
|---|---|---|
| **PPDA** (passes do adversário no campo de construção dele ÷ ações defensivas — faltas, interceptações, duelos defensivos ganhos, carrinhos — na mesma zona; Wyscout usa os 60% do campo perto do gol adversário) | Top-5 ligas 2018/19: **média 11,0**; mais intenso Eibar **6,7**; menos intenso Nürnberg **18,2** | A — Wyscout (glossário) |
| PPDA por liga, 2019/20 | La Liga 9,9 · Serie A 10,8 · Bundesliga 11,2 · Premier 11,6 · Ligue 1 11,8 | M — Total Football Analysis (Wyscout) |
| PPDA por time, 2021/22 | Barcelona 7,3 (o menor) · Liverpool 8,6 · Norwich/Troyes 16,9 (os maiores) | A — Premier League (Wyscout) |
| PPDA StatsBomb (zona = 60% à frente de 40% do campo) Bundesliga 2021/22 | **6,3–11,9** (Bayern 6,5) | A — StatsBomb |
| **"Agressão"** (% das recepções adversárias com desarme, falta ou pressão em ≤ 2 s) | **19–29%** (Bundesliga 2021/22; Bayern 26%) | A — StatsBomb |
| Pressões no campo adversário por 90 | 57–84 | A — StatsBomb |
| Pressões no terço final (PL 2024/25) | Chelsea 67,6 por jogo (6º) | A — Opta |
| Retomadas altas (posse que começa em jogo corrido a ≤ 40 m do gol adversário) | top da PL 2024/25: 285–300 na temporada (≈ 7,5–8 por jogo); Chelsea 8,0 por jogo; 12–21% delas acabam em chute | A — Opta/The Analyst |
| "Pressão intensa" (Opta Vision) | adversário a ≤ **2 m** de quem tem a bola | A — Opta Vision |
| "Pressão" (StatsBomb, evento) | defensor a ≤ ~5 jardas (4,6 m) de quem tem a bola | A — StatsBomb |

**Faixas propostas por estilo** (B/M — interpolação nas faixas acima): Recuada **PPDA 14–17**, agressão 18–21% ·
Equilibrada **10–12**, 22–24% · Alta **8–10**, 25–27% · Agressiva **6,5–8**, 28–30%. Atenção: PPDA depende de como o
GOLAÇO contar "ação defensiva" — fixar a definição (Wyscout) no painel e comparar sempre com ela. A análise própria
deu PPDA 3,9–6,1 com os eventos da Metrica, que não seguem a definição (contam desafios demais) — **não usar como meta**.

### 4.2 Distâncias de marcação (análise própria nova + rascunho, M)

| Medida | Mediana (p25–p75) | Observação |
|---|---|---|
| 1º marcador até o portador (geral; portador a ≤ 1,5 m da bola) | **4,7 m** (2,6–7,8); p10 1,3 m | rascunho (portador a ≤ 1 m): 5,2 m |
| 1º marcador por terço (do time que defende) | bloco baixo **3,6** (2,1–5,7) · médio **5,2** (2,9–8,4) · alto **5,5** (2,5–9,6) | perto do próprio gol aperta mais |
| **2º marcador** até o portador | **9,6 m** (6,6–13,3) | a cobertura real fica a ~7–13 m, não colada |
| Defensores a ≤ 10 m do portador | 2 (1–3); por terço: 2,2 · 1,7 · 1,4 (médias) | |
| Defensores a ≤ 5 m do portador | médias 1,0 · 0,6 · 0,6 (baixo · médio · alto) | mediana 0 no médio/alto |
| Marcador na recepção do passe | 6,0 m (3,8–9,4) | rascunho |
| Recepções com marcador a ≤ 2 m em até 3 s | 40%; quando acontece, mediana 0,72 s | rascunho |
| Quanto o marcador fecha no 1º segundo após a recepção | 1,6 m (0,2–2,8) | rascunho |

Modelos de pressão para o código: oval de Andrienko 2017 (alcance 9 m à frente do portador, 3 m atrás; pressão =
(1 − d/L)^1,75; média sobre a bola ~21–35% e **47–59% no último 1 s antes da retomada**) (A); pressão por tempo de
chegada (probabilidade de alcançar o portador em T = 1,5 s, σ = 0,45 s; só defensor a ≥ 2 m/s) (A — Bekkers 2025);
FIFA EFI considera distância, **ângulo (defensor à frente pressiona mais que atrás)** e soma de todos (A).

### 4.3 Contrapressão (transição defensiva)

| Medida | Valor | Confiança / fonte |
|---|---|---|
| Janela | **5 s** (regra de Guardiola; StatsBomb conta contrapressão em ≤ 5 s da perda). FIFA 23 "Pressão após perda": ~**7 s** | A — Bauer & Anzer 2021, StatsBomb; M — FIFPlay |
| Perdas que viram contrapressão | **23%** (20–30 por time por jogo, ~115 perdas) | A — Bauer & Anzer 2021 (Bundesliga, 6 temporadas) |
| Sucesso da contrapressão (retoma em ≤ 5 s) | **31%** | A — idem |
| Superioridade em 10 m na hora da perda | retoma em ≤ 5 s em 36,2% × 30,2% | A — idem |
| Duração da transição defensiva | 9,3 s (contrapressão 9,9 s; recompor 18,3 s) | A — idem |
| Retomada em ≤ 5 s após **qualquer** perda em jogo corrido | **36,5%**; em ≤ 10 s **54,7%** (468 perdas) | M — Metrica (nova) |
| Jogadores do time que perdeu a ≤ 10 m da bola na perda | 2 (1–3) | M — Metrica (nova) |
| Companheiro mais perto (sem contar quem perdeu) | 4,7 m (2,7–7,9) | M — Metrica (nova) |
| Alguém (≠ quem perdeu) chega a ≤ 2 m da bola em ≤ 3 s | **61%** das perdas; quando chega em ≤ 5 s, mediana **0,6 s** (0–1,9) | M — Metrica (nova) |
| Mais perto da bola após a perda (qualquer um) | 2,9 m (t = 0) · 3,7 (1 s) · 3,5 (2 s) · 3,9 (3 s) · 3,8 (5 s) | M — Metrica (nova) |

Regra: contrapressão só para quem está a ≤ ~10 m (1–3 jogadores) e só se o time tem gente perto (superioridade em 10 m) e
a perda foi no campo adversário/perto da lateral; os outros recompõem. Passados 5 s (7 s no "Agressiva"), todo mundo
volta à forma sem bola.

### 4.4 Gatilhos de pressão (quando o bloco "pula")

Passe para trás; toque pesado/bola solta; passe para a lateral/linha (a linha é "defensor extra"); recebedor de costas
para o gol; passe lento/alto para um zagueiro; goleiro com a bola nos pés (A/M — material de treinadores, Bauer & Anzer
2021, EA FC 25 "Agressiva: pressiona no toque pesado", FIFA 23 "Pressão no toque pesado", FM "Trigger press" por jogador).
No FM, a **linha de engajamento** diz onde o 1º homem começa a pressionar; com linha alta os outros fecham linhas de
passe e saem de posição para atrapalhar a construção; com linha baixa o 1º homem dificilmente pressiona e os outros
guardam a forma (M — FM, guias).

---

## 5. Com bola: apoio, largura, profundidade, área

### 5.1 Apoio ao portador (rascunho, M — Metrica; A — Steiner 2018)

| Medida | Valor |
|---|---|
| Companheiro mais perto do portador | **10,2 m** (7,2–13,6) |
| Companheiros a ≤ 15 m / ≤ 20 m | 2 (1–3) / 3 (2–5) |
| Linhas de passe livres (≤ 30 m, nenhum adversário a < 12° da linha) | **3** (2–4), média 3,4 |
| Onde estão os companheiros a ≤ 30 m | 37% à frente · 36% de lado · 27% atrás |
| O que decide o destino do passe | proximidade (mais forte), linha aberta, menos marcação, estar à frente; os 4 juntos acertam 41% (63% entre os 2 primeiros) |

Jogos: FC 26 "sempre ter alguém disponível como opção de passe"; "construção equilibrada = opções de corrida + apoio
curto" (A — EA). PES "Amplitude de apoio" (0 = perto para passes curtos; alto = longe para passe longo) (M — guias).

### 5.2 Largura e ocupação de corredores

- Largura com bola: 48,3 m (39,8–55,6) geral; **52 m com a bola no meio**, 44–45 m nas pontas do campo (M — Metrica).
- Terço final com a bola (jogadores no campo adversário): corredor esquerdo 1,0 · meio-espaço esquerdo 1,5 · centro
  3,9 · meio-espaço direito 1,5 · corredor direito 1,1; na área 1,2 (p90 4) (M — Metrica).
- Jogo de posição: campo mental em **20 zonas = 5 corredores × 4 faixas**, um jogador por zona, nunca dois na mesma;
  receber no **meio-espaço** é o objetivo (M — Coaches' Voice, guias). A regra "no máximo 3 numa linha horizontal e 2
  numa vertical" circula, mas não achei fonte séria (B).
- Sobreposições/sobreposições por dentro (PL 2024/25): Newcastle 277 sobreposições (~7,3 por jogo, o máximo), Spurs
  259 por dentro (~6,8); City só 76 sobreposições (~2 por jogo) (A — Opta Vision). FIFA 23 Largura ofensiva 1–35
  estreita / 36–69 equilibrada / 70–100 aberta (pontas na linha) (M — FIFPlay).

### 5.3 Corridas em profundidade e sem bola

| Medida | Valor | Confiança / fonte |
|---|---|---|
| Corridas fortes (≥ 5,5 m/s por ≥ 1 s) por jogador por 90, com bola | 12,7 para a frente; **2,7 terminam além do último defensor** (≈ 27 por time) | M — Metrica |
| Centroavante | nas costas **9–10** por jogo; pressionar 10–13; atacar a área 2–3 | A — Ju 2023 (PL) |
| Ponta | nas costas 7; pressionar 7; conduzir 5; vir buscar 5 | A — Ju 2023 |
| Mistura do centroavante | nas costas 32% · atacar o cruzamento 23% · à frente da bola 22% · vir buscar 8% | A — SkillCorner (202 CAs) |
| Corrida (SkillCorner) | > 15 km/h por ≥ 0,7 s; 10 tipos | A — SkillCorner/CIES |
| Corridas para passe curto/para trás (vir buscar, recuar) | até 7,1 por jogo (PSG); 25–31% das corridas nos times de posse | M — CIES 2023 |
| Duração e distância das ações intensas | ~2 s e ~20 m (sobreposição ~27 m/3 s) | A — Ju 2023 |
| Sequência de posse (PL 2024/25) | City 5,1 passes e 15,7 s por sequência (o máximo); avanço médio ~12,5 m por sequência; velocidade de ataque 1,4 (City) – 2,1 m/s (Forest) | A — Opta |

### 5.4 Quantos na área no cruzamento

| Medida | Valor | Confiança / fonte |
|---|---|---|
| Atacantes na área no **momento do cruzamento** (jogo corrido) | mediana **3** (1–4), p90 5 | M — Metrica (nova, 35 cruzamentos) |
| Defensores na área (com o goleiro) no cruzamento / na chegada | 6 (4–8) / 7 (5–8,5) | M — Metrica (nova) |
| Escanteio | 5 atacantes (5–6) × 10 defensores (9–11, com o goleiro) | M — Metrica (nova, 18 escanteios) |
| Champions feminina | **3 atacantes × 4 defensores** na área no contato com o cruzamento | M — UEFA |
| Eficiência do cruzamento (Copa 2018) | 949 cruzamentos → 20 gols (**2,1%**) | A — Mitrotasios 2022 |
| Para onde vai o cruzamento que vira gol | entre a marca do pênalti e a pequena área, atrás do zagueiro do meio; quem vem do lado oposto ataca em diagonal | A — Yamada & Hayashi 2015 |
| Copa feminina 2023 | 1/3 dos gols de jogo corrido com assistência de cruzamento; 36% dos cruzamentos na "2ª pequena área" | M — The FA |
| Jogos | FIFA 23 "Jogadores na área" 1–3 baixo / 4–7 equilibrado / 8–10 alto; escanteio e falta 1–5; FC 25 tática rápida "Entrar na área"; FC 26 marcação individual dentro da área | M/A |

---

## 6. Intensidade (para calibrar a IA e o cansaço futuro)

| Medida | Valor | Confiança / fonte |
|---|---|---|
| Distância por jogador de linha por partida | ~10–12 km (elite); 9,7 km na Metrica | A — Di Salvo 2007, Barnes 2014; M — Metrica |
| **Ritmo por fase (m/min por jogador, bola rolando)** | Com bola: construção 128 · progressão 142 · criação 132 · **ataque rápido 196** · transição 145. Sem bola: bloco alto 141 · **bloco médio 153** · bloco baixo 139 · **defesa rápida 208** · transição 156 | A — Jerome 2024 (1083 partidas) |
| Tempo de bola rolando por fase (cada time) | construção/bloco alto 18,2% · progressão/bloco médio 12,0% · criação/bloco baixo 7,1% · ataque/defesa rápida 3,8% · transições 8,9% | A — Jerome 2024 |
| Velocidade média com bola rolando | ~2,3 m/s (com posse 2,28; sem 2,33) | M — Metrica |
| % do tempo com bola rolando | parado 0,9 · andando 48,5 · trotando 37,8 · correndo 9,6 · alta 2,7 · sprint 0,6 | M — Metrica |
| Alta intensidade (> 19,8 km/h) com/sem bola, por posição | sem bola: zagueiro 533 m · lateral 657 · meio 697 · meia aberto 624 · atacante 386 | A — Barnes 2014 |
| Sprints (> 25,1 km/h) por partida | zagueiro ~39 · lateral ~63 · meio ~59 · meia aberto ~74 · atacante ~59 (depende muito do filtro; Metrica com ≥ 1 s: 6,7) | M — Barnes 2014 (via rascunho) |
| Acelerações/frenagens > 3 m/s² | ~0,8–1,2 por minuto por jogador | A — Morgans 2024 |
| Cansaço | alta intensidade cai ~20% nos últimos 15 min; recuperação entre esforços muito intensos 65 → 83 s; pressão "Agressiva" gasta mais fôlego (FC 25) | A — Bradley 2009; A — EA |
| Tendência | carga de corrida da PL subindo (TD, alta intensidade e sprint, 2014/15 → 2018/19, 1634 jogos) | A — Allen 2024 |
| Time inteiro (Copa feminina 2023) | 108,2 km por partida (91,5–123); > 20 km/h: 4,9 km; quem usa pressão alta/bloco médio/recomposição corre mais | A — Front. Sports 2026 |

Metas de ritmo da IA (bola rolando, por jogador de linha): **m/min 120–160** no jogo organizado, **180–220** em
ataque/defesa rápida; distribuição de velocidade perto da real (± 5 pontos por faixa).

---

## 7. Jogo aéreo: quem disputa (base da troca automática)

| Medida | Valor | Confiança / fonte |
|---|---|---|
| Disputas aéreas por partida | **28,5 e 36** nos 2 jogos (eventos AERIAL ÷ 2) | M — Metrica (nova) |
| PL 2023/24 (20 rodadas) | Everton 665 disputas aéreas (~33 por jogo, o time que mais disputa) | A — Premier League |
| **Quem disputa era o companheiro mais perto do ponto da disputa no instante do lançamento** | **80%** (73/91) | M — Metrica (nova) |
| Quem disputa estava entre os **2** mais perto no lançamento | **96%** (87/91) | M — Metrica (nova) |
| Quem disputa era o mais perto **0,5 s antes** da disputa | **97%** (88/91) | M — Metrica (nova) |
| EA FC (troca automática) | opções: Automática · Em bolas altas e soltas · Só em bolas altas (lançamentos e cruzamentos) · Só em bolas soltas · Manual; "assistência de movimento" mantém o novo jogador correndo na direção atual por um tempo (Nenhuma/Baixa/Alta) | M — FIFPlay, guias |

Consequência para a meta do dono ("jogo aéreo ≥ 90% troca para quem disputa"): escolher só no lançamento acerta ~80%;
**reavaliar durante o voo** (tempo de chegada ao ponto de queda previsto pela física da bola, a cada ≤ 0,1 s, com
histerese de ~0,2–0,3 s) chega a ~97% nos dados reais. Meta proposta: **≥ 90%** das disputas do time do humano com o
jogador controlado sendo o que disputa, e **≤ 1 troca extra** por bola alta (sem "pisca-pisca").

---

## 8. Como os jogos expõem as táticas (valores e efeitos)

| Jogo | Controle | Valores | Efeito descrito | Confiança |
|---|---|---|---|---|
| **EA FC 25** | Estilo de construção | Passes curtos (apoio curto, transição paciente) · Equilibrado · Contra-ataque (corridas nas costas, transição rápida) | | A — EA |
| | Abordagem defensiva + altura da linha | Recuada 1–30 (25): linha acompanha as corridas, sem pressão · Equilibrada 31–60 (50): flexível, sem pressão · Alta 61–90 (70): raramente acompanha corridas, pressão mínima · Agressiva 91–100 (95): nunca acompanha, **pressiona no toque pesado, cansa mais** | | A — EA |
| | Largura | **removida**: as funções definem a largura | | A — EA |
| | Foco tático (durante o jogo) | Padrão · Ofensivo (sobe 1 nível construção e defesa; ex.: Equilibrado/Equilibrada → Contra-ataque/Alta) · Defensivo (desce 1 nível) | | A — EA |
| | Táticas rápidas | Linha de impedimento · Pressão do time · Sobrecarregar bolas paradas · Entrar na área | | A — EA |
| | Funções e familiaridade | 31 funções, 52 combinações; Função/Função+/Função++; fora de posição = alerta; familiaridade pesa **10–40%** nas fórmulas de posicionamento | | A — EA |
| | Elenco/banco/trocas | banco até 9; 5 trocas em 3 paradas; até 5 táticas salvas; resumo com 3 forças e 3 fraquezas (Ataque, Defesa, Largura, Resistência, Comprimento, Construção) | | A — EA |
| **EA FC 26** | IA | apoio sempre oferecendo passe; mais corridas; atacante fica em jogo e volta rápido do impedimento; linha não sobe tanto para impedimento; marcação individual na área; CPU com estilos (cruza muito, constrói devagar, tiki-taka, pressão com vários, "contenção dupla"); fora de posição pesa bem menos; até 10 códigos de tática | | A — EA |
| **FIFA 23** (táticas personalizadas) | Estilo defensivo | Equilibrado · Pressão no toque pesado · Pressão após perda (~7 s, cansa) · Pressão constante (cansa, abre buracos) · Recuar (compacto, entrega a bola) | | M — FIFPlay |
| | Largura defensiva / Profundidade | 1–35 estreita/recuada · 36–69 equilibrada · 70–100 larga/alta | | M — FIFPlay |
| | Construção / Criação | Equilibrada, Lenta, Rápida, Bola longa, Posse / Equilibrada, Posse, Corridas à frente, Passe direto | | M — FIFPlay |
| | Largura ofensiva / Jogadores na área / Escanteio / Falta | 1–100 / 1–10 (4–7 equilibrado) / 1–5 / 1–5 | | M — FIFPlay |
| **PES 2017–2021** (Estilo de equipe) | Ataque | estilo (contra-ataque/posse), construção (passe longo/curto), área de ataque (centro/lados), posicionamento (manter formação/flexível), **amplitude de apoio** | baixo = perto do portador (passe curto); alto = longe (passe longo) | M — guias (escala 1–10 ou 0–100 conforme a fonte) |
| | Defesa | estilo (pressão na frente/defesa total), área de contenção (meio/lados), pressão (agressiva/conservadora), **linha defensiva**, **compactação**, nº na linha (4/5) | linha alta combina com impedimento; compactação alta = os de lado fecham o portador | M — guias |
| **eFootball 2026** | Estilos de equipe (sem barras numéricas) | Posse (perto, linha alta, pressão coordenada) · Contra-ataque rápido (linha alta, pressão forte) · Contra-ataque com bola longa (bloco baixo) · Pelas pontas (pontas na linha, sobreposição, cruzamento cedo) · Bola longa (linha um pouco mais baixa) | | M — FIFPlay |
| **Football Manager** | Mentalidade | 7 níveis: Muito defensiva, Defensiva, Cautelosa, Equilibrada, Positiva, Ofensiva, Muito ofensiva (internamente 1–20, provável) | risco, ritmo e quantos se comprometem no ataque | M — guias |
| | Sem bola | linha de engajamento e linha defensiva (Muito mais baixa … Muito mais alta), "trigger press" (Muito menos … Muito mais frequente), armadilha de impedimento, empurrar para dentro/fora | | M — guias |
| | Transição / com bola | contrapressão × recompor; contra-ataque × manter forma; largura (Muito estreita … Muito larga), ritmo | | M — guias |

**Proposta para o "Editar time" do GOLAÇO** (poucos controles, efeito medido; M/B):

| Controle | Opções | Efeito em constante | Meta medida (teste) |
|---|---|---|---|
| Formação | 4-3-3, 4-2-3-1, 4-4-2, 4-1-4-1, 3-5-2, 5-3-2, 3-4-3 | troca as 2 tabelas-base (com/sem bola) da seção 1.3 | posição média por função com a bola no centro a ≤ 3 m da tabela |
| Mentalidade | Muito defensiva · Defensiva · Equilibrada · Ofensiva · Muito ofensiva (= Foco tático do FC + mentalidade do FM) | desloca as bases com bola em +2 a +4 m/nível (laterais e meias), muda o nº de corredores nas costas (±1/nível) e o viés de passe para a frente | linha com bola +≥ 2 m por nível; corridas nas costas +≥ 15% por nível; ataques com ≥ 4 na área sobem |
| Pressão (abordagem defensiva) | Recuada · Equilibrada · Alta · Agressiva | linha de engajamento (o 1º homem só sai na bola se ela estiver a até 42 / 57 / 77 m do meu gol / em qualquer lugar; B), contrapressão 0 / 3 / 5 / 7 s, gatilhos (Agressiva: toque pesado no campo todo), gasto de fôlego ×1,0 / 1,0 / 1,1 / 1,25 | **PPDA 14–17 / 10–12 / 8–10 / 6,5–8**; agressão 18–21 / 22–24 / 25–27 / 28–30%; monotônico |
| Altura da linha | 1–100 (padrão 25/50/70/95 pela abordagem) | `altura ≈ 20 + 0,25 × linha` m com a bola no centro | 26 / 32,5 / 37,5 / 44 m ± 2 m; cada passo de 20 pontos ≥ 4 m |
| Largura (com bola) | 1–100 (Estreita 1–35 · Equilibrada 36–69 · Aberta 70–100, como FIFA 23) | `largura ≈ 38 + 0,2 × valor` m (50 → 48 m, mediana real) | largura com bola 42 / 48 / 55 m ± 3 m, monotônica; ocupação do corredor lateral sobe com o valor |
| Largura (sem bola) | Compacta · Normal · Aberta | 33 / 37 / 41 m (bloco médio) | ± 2 m |
| Construção | Passes curtos · Equilibrada · Contra-ataque | amplitude de apoio 8 / 10 / 13 m; % de corridas nas costas 20 / 30 / 45%; transição paciente/normal/rápida | companheiro mais perto 8–9 / 10–11 / 12–14 m; passes por sequência maiores no "curtos" |
| Na área no cruzamento | 2–3 · 3–4 · 4–5 (Entrar na área) | quantos atacam a área | mediana 2–3 / 3 / 4 no momento do cruzamento |

---

## 9. IA barata em JS: o que aproveitar

| Técnica | Como fica no GOLAÇO | Custo (por avaliação) | Fonte |
|---|---|---|---|
| **Formação = função da posição da bola** | 3 tabelas por fase (bola no meu terço / meio / terço de ataque, seção 1.2/1.3) + interpolação linear em x_bola + k_z·z_bola por função; Delaunay (Akiyama & Noda) se quiser mais pontos | 22 jogadores × 2 interpolações: desprezível | Akiyama & Noda 2007 (Gliders2d); Reis, Lau & Oliveira 2001 (SBSP, FC Portugal) |
| **Troca dinâmica de vaga** | algoritmo húngaro 10×10 (custo = distância à vaga) a cada ~1 s, só troca se ganho > limiar | O(n³) ≈ 1000 operações | Bialkowski 2014 (papéis por quadro); SoccerCPD (Kim 2022, húngaro sobre a formação); Reis 2001 (DPRE) |
| **Grade de zonas (jogo de posição)** | 5 corredores (|z| 0–9,16–20,16–34) × 4–6 faixas; regra de ocupação no ataque (≥ 1 por corredor lateral, ≤ 1 por zona de meio-espaço, ninguém duplicado) | 22 lookups | Coaches' Voice, guias; Metrica (ocupação real) |
| **Mapa de influência** | grade 5 m (21 × 14 = 294 células); gabaritos pré-calculados por raio; queda linear `I = M − M·d/D` ou quadrática `I = M − M·(d/D)²`; mapas somados (meu − dele) para achar espaço | 22 × ~25–50 células por atualização, a 4–10 Hz | Dave Mark, Game AI Pro 2 cap. 30 (Modular Tactical Influence Maps) |
| **Controle de campo simplificado** | tempo de chegada = segue a velocidade por 0,7 s e corre a 5 m/s; P(meu time) ≈ logística da diferença de tempos (σ = 0,45 s), avaliado só nos ~20–40 pontos candidatos (apoios, alvos de passe, queda da bola alta) | 40 pontos × 22 jogadores ≈ 900 contas | Spearman 2018 / Shaw (Friends of Tracking): reação 0,7 s, 5 m/s, σ 0,45 s, λ 4,3/s (goleiro ×3), bola 15 m/s |
| **Influência individual** | raio 4 m (perto da bola) → 10 m (longe), esticado na direção da corrida, centrado em pos + 0,5 s × vel | por jogador | Fernández & Bornn 2018 |
| **Pressão sobre o portador** | oval 9 m à frente/3 m atrás, (1 − d/L)^1,75 somado; ou P(chegar em 1,5 s) | 11 contas | Andrienko 2017; Bekkers 2025 |
| **Pontos de apoio com nota** | grade de pontos à frente/ao lado do portador; nota = linha aberta (cone ≥ 12°) + distância ideal 8–14 m + à frente + controle de campo; recalcular a cada ~0,25 s | ~30 pontos | Buckland 2004 (Simple Soccer); Steiner 2018 |
| **Decisão por utilidade com histerese** | bônus de 1,2–1,5× para a decisão atual e compromisso mínimo de 0,5–1,0 s (salvo troca de posse) | trivial | IAUS; Utility Intelligence; GDC "AI Positioning and Spatial Evaluation" (avaliar candidatos e escolher o melhor) |
| **Fases de jogo explícitas** | posse × zona da bola → construção/progressão/criação/ataque rápido/transição (com bola) e bloco alto/médio/baixo/defesa rápida/transição (sem bola), com critério tipo FIFA (≥ 8 no terço, ≥ 4 atrás da bola) | trivial | Jerome 2024; FIFA EFI |

Nada disso precisa de three.js nem DOM: tudo cabe na lógica em `js/*.js`, determinístico (aleatoriedade só pelo
`rng.js`). Orçamento sugerido: IA tática a 4–10 Hz escalonada por jogador (não todos no mesmo quadro), alvo suavizado
entre avaliações (constante de tempo ~0,3–0,7 s, coerente com a reação de 0,7 s do modelo de chegada).

---

## 10. Metas de teste sugeridas (Node, IA × IA 11×11, várias sementes)

Todas as medidas com **as mesmas definições da análise própria** (`tools/pesquisa/analise_metrica.py` e
`tools/pesquisa/tatica_metrica.py`, portadas em `tools/lib/partida-medidas.mjs`). Metas = faixa da
**mediana** do GOLAÇO. Amostra sugerida: 20 sementes × 3–5 min de bola rolando (variação entre rodadas a medir antes).

| Teste | Métrica | Meta | Base real |
|---|---|---|---|
| `teste-forma` | comprimento sem bola por terço (baixo/médio/alto) | 26–34 / **24–31** / 30–39 m | 30,4 / 27,2 / 34,7 (Metrica); 27,2 (Copa 2022) |
| | largura sem bola por terço | 30–37 / 34–41 / 35–43 m | 33,2 / 37,2 / 39,1; 40,1 (Copa 2022) |
| | comprimento / largura com bola | 30–39 m / 44–54 m (no meio 47–56) | 33,9 / 48,3 (52,3 no meio) |
| | área com ÷ sem bola | 1,3–2,0 | 1,48 |
| | defesa–meio e meio–ataque sem bola | 9–13 m e 11–15 m | 11,6 e 12,4 (Metrica); 10,2 e 13,2 (Forcher) |
| | centroide × bola (inclinação x / z) | 0,5–0,7 / 0,25–0,40 | 0,59 / 0,33 |
| `teste-formacao` | posição média por função (bola no centro) × tabela 1.3 | erro ≤ 3 m em ≥ 9 de 11 | — |
| `teste-altura-linha` | altura sem bola por terço | 12–18 / 28–36 / 44–52 m | 15,0 / 31,8 / 48,0 |
| | com o controle (bola no centro) | 26 / 32,5 / 37,5 / 44 m ± 2 m, monotônico | mapa 3.1 |
| `teste-linha-de-4` | espalhamento x dos 4 mais recuados, sem bola | mediana ≤ 5 m (baixo/médio), ≤ 10 m (alto) | 3,5 / 4,0 / 8,4 |
| `teste-impedimento` | atacante mais adiantado até a linha | mediana 1–3,5 m atrás | 2,0 |
| | % do tempo com alguém em posição de impedimento | 8–25% | 16% |
| | impedimentos marcados por partida (90 min) | 1–4 | ~2,3–2,5 por time que mais provoca |
| `teste-pressao` | 1º marcador até o portador (geral / por terço) | 4–6,5 m / baixo 3–5, médio 4–6,5, alto 4–7 | 4,7 / 3,6 / 5,2 / 5,5 |
| | 2º marcador até o portador | 7–13 m | 9,6 |
| | defensores a ≤ 10 m do portador | média 1,4–2,4 | 1,8 |
| | agressão (recepções com defensor a ≤ 4,6 m em ≤ 2 s) | 19–29% (Equilibrada 22–24%) | StatsBomb |
| | PPDA por abordagem | 14–17 / 10–12 / 8–10 / 6,5–8, monotônico | Wyscout/StatsBomb |
| `teste-contrapressao` | retomada em ≤ 5 s após perda em jogo corrido | 25–40% (Agressiva no topo) | 36,5% (Metrica); 31% (Bauer) |
| | alguém (≠ quem perdeu) a ≤ 2 m da bola em ≤ 3 s | 50–70% | 61% |
| | jogadores do time que perdeu a ≤ 10 m (t = 0) | mediana 1–3 | 2 |
| | volta à forma depois da janela | 0 jogadores ainda pressionando 2 s após o fim da janela (5/7 s), salvo os 2 mais perto | Bauer 2021 |
| `teste-apoio` | companheiro mais perto do portador | 8–12 m | 10,2 |
| | linhas de passe livres ≥ 2 | ≥ 75% do tempo com posse; média 2,8–4 | 3,4 |
| | companheiros à frente / de lado / atrás (≤ 30 m) | 30–45% / 30–45% / 20–35% | 37 / 36 / 27 |
| `teste-corredores` | ocupação no terço final com a bola | corredor 0,7–1,5 cada · meio-espaço 1–2 cada · centro 3–5 | 1,0 / 1,5 / 3,9 |
| `teste-corridas` | corridas fortes que terminam nas costas da defesa, por time por 90 | 15–40 | ~27 (Metrica) |
| `teste-cruzamento` | atacantes na área no cruzamento | mediana 2–4, p90 ≤ 6 | 3 (p90 5); UEFA 3 |
| | escanteio | 4–7 atacantes na área | 5 |
| `teste-aereo` | disputas do time do humano em que o controlado é quem disputa | **≥ 90%** | 97% (reavaliando até 0,5 s antes) |
| | trocas extras por bola alta | ≤ 1 | — |
| | disputas aéreas por 90 min | 20–40 | 28,5–36 |
| `teste-intensidade` | m/min com bola rolando (jogo organizado / rápido) | 120–160 / 180–220 | Jerome 2024 |
| | % do tempo por faixa de velocidade | ± 5 pontos da real | Metrica |
| | inversões > 135° em ≤ 1 s (≥ 1,5 m/s) | ≤ 0,6 por min por jogador | 0,36 |
| `teste-taticas` (Editar time) | cada controle move a sua métrica no sentido certo e com o tamanho mínimo da tabela da seção 8 | 100% dos controles | — |

Regra de entrega (CLAUDE.md): cada teste tem de **reprovar na versão publicada** e passar depois, com tabela antes →
depois; medidas que já estavam boas (condução, passes, goleiro) não podem piorar.

---

## 11. Tela "Editar time": o que existe e o que foi aproveitado

| Fonte | O que diz | O que aproveitamos |
|---|---|---|
| EA, Pitch Notes FC 25 (gameplay e FC IQ) | Táticas de equipe = Formação + **Abordagem defensiva** + **Estilo de construção**. Visões "Com a bola"/"Sem a bola". Funções com familiaridade básica, **+** e **++**, e **exclamação amarela** quando o jogador está fora de posição. Táticas no direcional, menu de substituições e "mude tática e substituições a qualquer momento" | A **prévia Com a bola / Sem a bola** na aba Táticas, a **! âmbar** para fora de posição, a mudança a qualquer momento (na pausa) e os nomes em pt-BR usados pela EA ("Com a Bola", "Sem a Bola", "Predefinições") |
| fifauteam.com, táticas do FC 26 | Abordagem defensiva × altura da linha: Profunda 1–30 (padrão 25), Equilibrada 31–60 (50), Alta 61–90 (70), Agressiva 91–100 (95, pressão no toque longo). Construção: Passes curtos / Equilibrada / Contra-ataque | **Altura da linha em 3 níveis** (Profunda, Equilibrada e Alta). "Agressiva" = linha Alta com pressão Alta. O **estilo de construção** fica para depois |
| fifplay (táticas do FIFA antigo) | **Planos de jogo** Ultradefensivo … Ultraofensivo, trocados no direcional. Largura 1–100, **jogadores na área** 1–10, estilo de pressão | **Mentalidade em 5 níveis** com esses nomes. "Jogadores na área" vira um parâmetro da mentalidade (`TATICA.naArea`), sem um controle a mais |
| IFAB, Regra 3 (2025/26) e decisão de 2022 | 5 substituições em 3 oportunidades, mais o intervalo; de 3 a 15 reservas relacionados; quem sai não volta; troca com o goleiro numa paralisação | `PARTIDA.subsMax = 5`, `paradasMax = 3`; quem sai fica em "Substituídos"; substituição na próxima parada |
| CBF (desde 2013) | Até 12 reservas no banco nas Séries A e B | **23 por time = 11 + 12** (`js/elenco.js`) |
| WCAG 2.2 (2.5.7 arrastar, 2.5.8 tamanho do alvo); padrão de abas do WAI-ARIA APG; Material (alvo de 48 dp) | Toda função feita arrastando precisa de alternativa sem arrastar. Abas com `role=tablist` e setas | **Tocar em dois** como único jeito obrigatório; abas e seletores com teclado; **48 px** de alvo |
| Metrica (análise própria, seção 1–5) | Zagueiros sem bola com a bola no meio a ~18 m da linha do meio; largura com bola no terço médio ~50 m; atacantes na área no cruzamento: mediana 3 | O nível médio de cada controle = o jogo real |

Limite: não há página oficial que descreva quadro a quadro o "Gerenciar equipe" dentro da partida
do FC; o desenho vem das notas oficiais (táticas, funções, visões, fora de posição) e do
comportamento conhecido do jogo.

---

## 12. Ameaça esperada (xT) — o valor de cada zona para a IA com a bola

**Fonte:** Karun Singh, *Introducing Expected Threat (xT)*, 2018 (<https://karun.in/blog/expected-threat.html>),
com a grade aberta 12×8 publicada pelo autor (<https://karun.in/blog/data/open_xt_12x8_v1.json>),
calculada sobre uma temporada inteira (2017/18) da Premier League. Confiança **A/M** (modelo aberto
e muito usado na análise de desempenho; blog, não artigo revisado).

**O modelo:** cada zona (x, y) tem a chance de chute s, a chance de gol do chute g, a chance de mover
a bola m e a matriz de transição T (para onde a posse vai com um passe ou condução). A ameaça é a
solução de `xT(x,y) = s·g + m·Σ T(x,y → z,w)·xT(z,w)` (iterada até convergir): quanto a posse naquela
zona vale em chance de gol nos próximos lances.

**Grade** (chance; linhas = largura, de uma lateral à outra; colunas = comprimento, do próprio gol ao
gol adversário — a grade é simétrica na largura):

| | c0 | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c9 | c10 | c11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| l0 | 0,0064 | 0,0078 | 0,0084 | 0,0098 | 0,0113 | 0,0125 | 0,0147 | 0,0175 | 0,0212 | 0,0276 | 0,0349 | 0,0379 |
| l1 | 0,0075 | 0,0088 | 0,0094 | 0,0106 | 0,0121 | 0,0138 | 0,0161 | 0,0187 | 0,0240 | 0,0295 | 0,0407 | 0,0465 |
| l2 | 0,0089 | 0,0098 | 0,0100 | 0,0111 | 0,0127 | 0,0143 | 0,0169 | 0,0194 | 0,0241 | 0,0286 | 0,0549 | 0,0644 |
| l3 | 0,0094 | 0,0108 | 0,0102 | 0,0113 | 0,0126 | 0,0148 | 0,0169 | 0,0200 | 0,0239 | 0,0351 | 0,1081 | 0,2575 |
| l4 | 0,0094 | 0,0108 | 0,0102 | 0,0113 | 0,0126 | 0,0148 | 0,0169 | 0,0200 | 0,0239 | 0,0351 | 0,1081 | 0,2575 |
| l5 | 0,0089 | 0,0098 | 0,0100 | 0,0111 | 0,0127 | 0,0143 | 0,0169 | 0,0194 | 0,0241 | 0,0286 | 0,0549 | 0,0644 |
| l6 | 0,0075 | 0,0088 | 0,0094 | 0,0106 | 0,0121 | 0,0138 | 0,0161 | 0,0187 | 0,0240 | 0,0295 | 0,0407 | 0,0465 |
| l7 | 0,0064 | 0,0078 | 0,0084 | 0,0098 | 0,0113 | 0,0125 | 0,0147 | 0,0175 | 0,0212 | 0,0276 | 0,0349 | 0,0379 |

**No GOLAÇO** (`config.js IA_ATAQUE.xT`, plano 2.6): no referencial do time com a bola, coluna =
`floor((u + 52,5) / 8,75)` e linha = `floor((w + 34) / 8,5)` (zonas de 8,75 × 8,5 m). A utilidade de
um passe é `P·V(destino) − (1 − P)·C`, com `P = 1 − riscoLinha` e `V = xT`; a da condução, `P(manter)·V`
a 5 m à frente. Leitura que vira regra: a ameaça quase não muda até ~70 m do próprio gol (0,01–0,02) e
salta perto da área (0,11–0,26 nas duas colunas finais, no meio): a IA só arrisca quando o ganho de
zona compensa o risco de perder a bola.

---

## 13. Do número à constante (`js/config.js`, plano 2.7 e 3.2)

| Constante | Valor inicial | De onde vem (seção) |
|---|---|---|
| `TATICA.linhaAltura` | 26 / 32,5 / 40 m (bola no centro, sem bola) | §3.1 (mapa `20 + 0,25 × linha`: 26 / 32,5 / 37,5 / 44): 3 níveis; a Alta fica entre a Alta e a Agressiva do FC |
| `TATICA.largura` (fator z com / sem bola) | 0,88 / 1,00 / 1,15 · 0,90 / 1,00 / 1,10 → com bola 42/48/55 m, sem bola 33/37/41 m | §2.1 e §8 (FIFA 23: Estreita/Equilibrada/Aberta) |
| `TATICA.k`, `TATICA.kz` | k por função entre terços; k_z por função | §1.2 (Metrica) |
| `TATICA.mentalidadeBloco` | 3 m por nível (−2..+2) | §8 (2–4 m por nível) |
| `TATICA.naArea` | 2 / 2 / 3 / 4 / 5 | §5.4 (mediana 3, p90 5) |
| `IA_DEFESA.contencao` | 5,0 / 3,0 / 2,0 m | §4.2 (1º marcador 4,7 m, p25 2,6). A Média é mais apertada que a mediana **de propósito**: o dono pediu jogo mais intenso |
| `IA_DEFESA.engaja` | 42 / 60 / 105 m do meu gol | §8 (FM, linha de engajamento: 42 / 57 / 77 / qualquer) |
| `IA_DEFESA.contrapressao` | 0 / 3 / 5 s; até 0 / 2 / 3 jogadores a ≤ 10 m | §4.3 (Bauer & Anzer 2021; FIFA 23) |
| `IA_DEFESA.zona` | raio 7 m, peso 0,6; marcação individual a ≤ 20 m do gol | §8 (FC 26: individual na área); §2.1 (Forcher 2024: os 5 mais perto) |
| `IA_DEFESA.gatilhos` | janela 1,5 s; passe para trás > 3 m; toque pesado > 1,5 m; de costas > 110°; lateral |z| > 27 | §4.4 |
| `IA_ATAQUE.apoio` | 2 apoios, 8–14 m, cone 12°, histerese 1,3, compromisso 0,75 s | §5.1 (Steiner 2018); §9 (Buckland 2004) |
| `IA_ATAQUE.corridas` | folga 2 m, além 8–12 m, recarga 6 s | §5.3 (Ju 2023; SkillCorner) |
| `IA_ATAQUE.condutor` | 10 Hz, histerese 1,25, compromisso 0,5 s, chute ≤ 28 m | §9 (utilidade com histerese) |
| `IA_ATAQUE.xT` | grade 12×8 | §12 |
| `TROCA_AEREA` | reavalia a cada 0,1 s, 2 avaliações, folga 0,25 s, ≤ 1 correção | §7 (reavaliar até 0,5 s antes acerta 97%) |
| `PARTIDA.subsMax`, `paradasMax` | 5 em 3 paradas | §11 (IFAB, Regra 3) |

---

## 14. Fontes (com confiança)

**Rastreamento, compactação e linha**
- Análise própria — Metrica Sports, Sample Game 1 e 2 (25 Hz). M. [repositório](https://github.com/metrica-sports/sample-data) ·
  scripts `tools/pesquisa/analise_metrica.py` e `tools/pesquisa/tatica_metrica.py`.
- Forcher, Forcher, Altmann, Jekauc & Kempe 2024, *Int J Sports Sci Coach* 19(2):757–768 — forma sem bola, linhas, 5 mais
  perto da bola. A. [doi](https://doi.org/10.1177/17479541231172695)
- Rico-González et al. 2022, *Biology of Sport* 39(1):101–114 — revisão com valores de referência (Castellano 2013,
  Castellano & Álvarez-Pastor, Fradua, Santos, Frencken, Clemente…). A. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8805357/)
- Castellano, Álvarez, Figueira, Coutinho & Sampaio 2013, *IJPAS* 13(3):822–832. A (via revisão).
  [registro](https://ekoizpen-zientifikoa.ehu.eus/documentos/60cd2948ad242a605acf94d4?lang=en)
- FIFA TSG, Copa 2022 — bloco médio: 27,2 × 40,1 m, % do tempo por seleção, critério do bloco. A.
  [página](https://www.fifatrainingcentre.com/en/fwc2022/technical-and-tactical-analysis/controlling-the-game-without-the-ball--the-mid-block-and-compactness.php)
- FIFA EFI (Enhanced Football Intelligence) — definições de fases, altura da linha, comprimento, pressão. A.
  [PDF](https://www.fifatrainingcentre.com/media/native/world-cup-2022/Enhanced%20Football%20Intelligence%20EN.pdf)
- FIFA, Mundial de Clubes 2023 (Al Ahly × Al Ittihad: comprimento em bloco médio/baixo). M.
  [página](https://fifatrainingcentre.com/en/game/tournaments/fcwc/2023/using-block-defending-and-central-pressure-to-negate-world-class-players.php)
- UEFA, Performance Insights 2023/24 — Real Madrid (linha 35,7 m; 21,8 × 44 m; 38% em bloco médio) e Man City (linha
  ~55 m; bloco de 30,1 × 11,1 m). M. [Real Madrid](https://uefa.com/uefachampionsleague/news/028d-1ad2aace62a4-fd3586ac6b79-1000--champions-league-performance-insights-real-madrid-s-mid-) ·
  [City](https://de.uefa.com/uefachampionsleague/news/028c-1aaee213a636-7afb308e0250-1000--in-the-zone-how-madrid-nullified-man-city/)
- Low, Rein, Raabe, Schwab & Memmert 2021, *J Sports Sci* 39(19):2199–2210 — pressão alta × recuada (11×11 juvenil). M.
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/33982645/)
- Shaw & Glickman 2019 (Barça Sports Analytics Summit) — formação por fase. A.
  [pdf](https://www.sportperformanceanalysis.com/s/Dynamic-analysis-of-team-strategy-in-professional-football-By-Laurie-Shaw-And-Mark-Glickman.pdf)
- Opta Vision / The Analyst 2024/25 — compacto < 600 m², solto > 900 m², pressão intensa ≤ 2 m, impedimentos,
  sobreposições. A. [artigo](https://theanalyst.com/articles/opta-vision-stats-tracking-data-premier-league)
- Front. Sports Act. Living 2026 (Copa feminina 2023, estilos defensivos) — % do tempo por fase, 108,2 km. M.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13107637/)

**Pressão e transição**
- Wyscout, glossário PPDA (média 11,01; 6,72–18,21; 2018/19). A. [glossário](https://dataglossary.wyscout.com/ppda/)
- Premier League (Wyscout 2021/22: 7,26–16,93). A. [explicação](https://www.premierleague.com/news/4250153)
- StatsBomb, Bundesliga Report 2021/22 — PPDA 6,3–11,9, Defensive Distance 40,3–46,3 m, agressão 19–29%, pressões no
  campo adversário 57–84. A. [pdf](https://blogarchive.statsbomb.com/uploads/2022/05/StatsBomb-Bundesliga-Report-1.pdf)
- Trainor 2014 (origem do PPDA). A. [Hudl/StatsBomb](https://www.hudl.com/blog/defensive-metrics-measuring-the-intensity-of-a-high-press)
- Opta/The Analyst, estilos da PL 2024/25 — start distance, retomadas altas, sequências. A.
  [artigo](https://theanalyst.com/articles/analysing-premier-league-playing-styles-2024-25)
- Bauer & Anzer 2021, *Data Min Knowl Disc* 35:2009–2049 — contrapressão. A. [Springer](https://link.springer.com/article/10.1007/s10618-021-00763-7)
- Andrienko et al. 2017, *Data Min Knowl Disc* 31(6) — modelo de pressão. A. [pdf](https://openaccess.city.ac.uk/id/eprint/17464/)
- Bekkers 2025 — intensidade de pressão por tempo de chegada. A. [arXiv](https://arxiv.org/abs/2501.04712)
- StatsBomb, contrapressão. A. [blog](https://blogarchive.statsbomb.com/articles/soccer/how-statsbomb-data-helps-measure-counter-pressing/)

**Com bola, intensidade, aéreo**
- Steiner et al. 2018, *Current Issues in Sport Science* 3 — destino do passe. A. [artigo](https://bop.unibe.ch/index.php/ciss/article/view/7564)
- Ju et al. 2023, *Biology of Sport* 40(1) — ações de alta intensidade por função. A. [pdf](https://researchonline.ljmu.ac.uk/id/eprint/17199/)
- SkillCorner / CIES — tipos de corrida, centroavantes. A/M. [TGG](https://trainingground.guru/articles/skillcorner-analysing-centre-forwards-off-ball-runs) ·
  [CIES](https://football-observatory.com/Analysis-of-run-types-27-leagues-worldwide)
- Mitrotasios et al. 2022 (Copa 2018, cruzamentos). A. [VU](https://vuir.vu.edu.au/46384/)
- Yamada & Hayashi 2015, *Football Science* 12:24–32 — cruzamentos que viram gol. A. [J-STAGE](https://www.jstage.jst.go.jp/article/jssfenfs/12/0/12_24/_article)
- UEFA, Champions feminina — 3 atacantes × 4 defensores no cruzamento. M.
  [UEFA](https://www.uefa.com/womenschampionsleague/news/027f-17960e899457-ba4c2d00eba0-1000--uefa-women-s-champions-league-performance-insight-how-cros)
- The FA, Copa feminina 2023 — cruzamentos. M. [FA](https://community.thefa.com/coaching/b/insights-analysis-blogs/posts/cross-like-a-boss---the-goalscoring-impact-of-crossing-at-the-2023-women-s-world-cup)
- Jerome et al. 2024, *Eur J Sport Sci* 24(11) — ritmo por fase. A. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11534638/)
- Bradley 2009; Barnes 2014; Morgans 2024; Allen 2024 — intensidade (detalhes no rascunho). A.
  [Allen 2024](https://doi.org/10.1177/17479541231164507)
- Premier League (disputas aéreas 2023/24, parcial). A. [PL](https://www.Premierleague.Com/news/3854577)
- Premier League 2025 — formações usadas. A. [notícia](https://www.premierleague.com/news/4323030)

**Jogos**
- EA FC 25 Pitch Notes (FC IQ). A. [EA](https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-fc-iq-deep-dive)
- EA FC 26 Pitch Notes (gameplay). A. [EA](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive)
- FIFA 23 táticas (FIFPlay). M. [FIFPlay](https://www.fifplay.com/fifa-23-tactics/)
- EA FC 25 troca automática (FIFPlay e guias). M. [FIFPlay](https://www.fifplay.com/fc-25-controller-settings/)
- PES Team Style (pesmastery; evoweb). M. [pesmastery](https://pesmastery.com/pes-team-style/) ·
  [evoweb](https://evoweb.uk/threads/tactics-thread-pes-2014.71950/)
- eFootball 2026 estilos de equipe (FIFPlay). M. [FIFPlay](https://www.fifplay.com/efootball-2026-team-playstyles/)
- Football Manager (mentalidade, linha de engajamento, gatilhos). M. [FIFPlay FM24](https://www.fifplay.com/football-manager-2024-tactics-and-formations/) ·
  [fmscout](https://www.fmscout.com/a-football-manager-2021-hints-and-tips.html?pg=4) ·
  [passion4fm](https://www.passion4fm.com/football-manager-opposition-instructions-cheat-sheet/)

**Tela "Editar time" e xT**
- EA SPORTS FC 25, Pitch Notes, Gameplay Deep Dive. A. [EA](https://www.ea.com/en/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive)
- EA SPORTS FC 25, Pitch Notes, FC IQ (pt-BR). A. [EA](https://www.ea.com/pt-br/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-fc-iq-deep-dive)
- Táticas do FC 26 (abordagem defensiva × altura da linha, construção). M. [fifauteam](https://fifauteam.com/fc-26-tactics/)
- Táticas e planos de jogo (FIFA antigo). M. [FIFPlay](https://www.fifplay.com/fc-25-tactics-and-game-plans/)
- IFAB, cinco substituições permanentes. A. [IFAB](https://www.theifab.com/news/the-ifab-permanently-approves-five-substitute-option-in-top-level-competitions/) ·
  Regra 3 (2025/26). A. [The FA](https://www.thefa.com/-/media/files/thefaportal/governance-docs/laws-of-the-game/2025-26/law-3---the-players.ashx)
- WCAG 2.2, 2.5.7 e 2.5.8. A. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) ·
  WAI-ARIA APG, abas. A. [W3C](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- Singh 2018, *Introducing Expected Threat (xT)* e a grade aberta 12×8. A/M. [blog](https://karun.in/blog/expected-threat.html) ·
  [grade](https://karun.in/blog/data/open_xt_12x8_v1.json)

**IA**
- Spearman 2018 / Shaw (Friends of Tracking) — controle de campo. A. [código](https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking)
- Fernández & Bornn 2018 (MIT Sloan) — espaço. A. [pdf](http://www.lukebornn.com/papers/fernandez_ssac_2018.pdf)
- Mark 2015, *Game AI Pro 2* cap. 30 — mapas de influência modulares. A.
  [pdf](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf)
- GDC Vault, "AI Positioning and Spatial Evaluation". M. [GDC](https://gdcvault.com/play/1021706/AI-Positioning-and-Spatial-Evaluation)
- Akiyama & Noda 2007 (via Gliders2d) — formação por Delaunay. A. [arXiv](https://arxiv.org/pdf/1812.10202)
- Reis, Lau & Oliveira 2001 (FC Portugal SBSP/DPRE). A. [doi](https://doi.org/10.1007/3-540-44568-4_11)
- Bialkowski et al. 2014 (ICDM) — papéis por quadro. A. [Disney Research](https://la.disneyresearch.com/publication/large-scale-analysis-of-soccer-matches-using-spatiotemporal-tracking-data/)
- Kim et al. 2022 (SoccerCPD) — formação e troca de papéis com algoritmo húngaro. A. [arXiv](https://arxiv.org/pdf/2206.10926)
- Buckland 2004, *Programming Game AI by Example* (Simple Soccer). A.
  [capítulo](https://www.oreilly.com/library/view/programming-game-ai/9781556220784/chapter-77.html)
- Jogo de posição (20 zonas). M. [Coaches' Voice](https://learning.coachesvoice.com/cv/positional-play-football-tactics-explained-guardiola-cruyff-manchester-city/)

---

## 15. Incertezas

- **Metrica = 2 jogos anônimos** (liga e nível desconhecidos). A forma bate com Bundesliga e Copa 2022, mas as metas são
  faixas. As posições por função supõem 4-4-2 por profundidade; num 4-3-3 ou 3-5-2 os rótulos mudam — no GOLAÇO, medir
  por **linha** (4/5 mais recuados, meio, frente) com a mesma definição.
- **Médias por função encolhem a largura** (o bloco desliza de lado conforme a bola). Para largura use a medida
  instantânea (seção 2), não a distância entre médias.
- **PPDA varia por fonte** (zona de 60% × "40% e à frente"; quais ações contam). A análise própria deu 3,9–6,1 porque os
  eventos da Metrica não seguem a definição: não serve de meta. Fixar a definição Wyscout no painel do GOLAÇO.
- **"Agressão" StatsBomb** usa "pressão" anotada à mão (~5 jardas); no GOLAÇO, aproximar por defensor a ≤ 4,6 m em ≤ 2 s.
- **Contrapressão Metrica** conta todas as perdas em jogo corrido (inclui as que não viram contrapressão); Bauer & Anzer
  contam só as situações de contrapressão (23% das perdas). Comparar cada número com a sua própria definição.
- **Cruzamentos Metrica**: só 35 cruzamentos e 18 escanteios; "na área" pelo retângulo da área (x > 36, |z| < 20,16);
  defensores contam o goleiro.
- **Disputa aérea**: o "ponto da disputa" é onde o disputante estava (sabido depois); no jogo, o ponto de queda vem da
  física da bola (previsto), o que só melhora a escolha. 91 disputas.
- **Impedimentos por partida** (3–4 no total) é inferência a partir dos líderes da PL; o teste usa faixa larga (1–4).
- **Valores de jogos** (FIFA 23, PES, eFootball, FM) vêm de guias de comunidade; só o EA FC 25/26 é documentação oficial.
  As escalas do PES aparecem como 1–10, 0–20 ou 0–100 conforme a fonte e a versão.
- **Mapas controle → constante** (linha `20 + 0,25 × v`, largura `38 + 0,2 × v`, PPDA por abordagem) são propostas
  lineares ancoradas nas medianas reais; o FC não publica as contas. Calibrar no `teste-taticas`.
- **Sprints** dependem do limiar e do filtro (Barnes ~40–75 por partida × Metrica 6,7 com ≥ 1 s): só comparar o GOLAÇO
  consigo mesmo, com a mesma definição.
