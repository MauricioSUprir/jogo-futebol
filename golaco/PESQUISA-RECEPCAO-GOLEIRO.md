# Pesquisa — recepção que nunca sai da bola, controle de bola e goleiro que pula e espalma

Pedido do dono (10/10): "os jogadores podem ter um controle de bola melhor … o goleiro não pula, e nem espalma
direito, quando a bola chega no jogador, e eu já mudo o analógico pro lado que eu quero, o jogador sai da
bola, isso nunca pode acontecer, de um jogador se afastar da bola com ela perto, ele tem que sempre dominar
ela". Este arquivo junta o que foi lido antes de mexer e **o que foi aproveitado de cada fonte**. Os números
de biomecânica do goleiro já levantados na Etapa 2 continuam em `PESQUISA-ETAPA2.md` (tabela do goleiro).

## 1. Recepção: o analógico é a intenção do 1º toque, não para onde o corpo foge

| Fonte | O que diz | O que foi usado |
|---|---|---|
| EA SPORTS FC (notas de jogabilidade e guias de controle: "Pass Receiver Lock" — o recebedor fica preso ao passe; o 1º toque vai para onde o analógico aponta; "Directional First Touch") | Nos jogos de futebol atuais o jogador que vai receber não segue o analógico livremente: o corpo vai ao encontro do passe e o analógico escolhe a direção do domínio | `recepcao.js`: o corpo vai ao encontro da bola pela conta do encontro; o analógico só decide o 1º toque (domínio orientado ±20°, `conducao.js planejarAlvo` com `orientado`) e abre o tronco (`RECEPCAO.corpoAberto`) |
| The FA — England Football Learning, "receiving" / sessões de 1º toque sob pressão (sportsessionplanner "1st Touch – Away From Pressure": receber com o pé mais longe da bola, toque para longe da pressão, corpo aberto) | Receber de corpo aberto (meia-volta), com o pé de trás, levando a bola pela frente do corpo para o lado que se quer jogar | `ladoDoToque`: com o analógico inclinado, a bola chega do lado dele (`RECEPCAO.ofsFrente` na direção do analógico) e o 1º toque a leva pela frente do corpo; para trás do corpo o máximo é o lado (o pé não alcança atrás) |
| Locomoção do próprio jogo (`jogador.js passoCorpo`, Etapa 1: freia na linha acima de `JOGADOR.angInversao`) e medida em jogo (`tools/medir-controle.mjs`) | Embalado, um pedido quase de lado/para trás caía na "inversão": o corpo freava na linha sem sair de lado e passava da linha da bola | `movimentoAssistido`: embalado, o pedido abre no máximo `RECEPCAO.angCorteMax` (1,5 rad) — ele corta freando; e o encontro sem pressa conta o tempo de chegar **parando** (`tempoAlcance(…, parar)`) |
| Iga & Nunome 2016 (já em `config.js`, domínio no peito/coxa: a bola morre com 5–10% da velocidade) | O bom domínio "mata" a bola | o domínio orientado curto (`DOMINIO_CURTO` 0,45 m) deixa a bola a um passo, no lado pedido; embalado a mais de 4,5 m/s contra o analógico (`DOMINIO_CONTRA`) ele amortece no caminho em vez de mandar a bola para trás (medido em jogo: o humano perdia a bola sozinho) |

## 2. Controle de bola por atributo

| Fonte | O que diz | O que foi usado |
|---|---|---|
| Curvas de atributo dos jogos de futebol (erro do 1º toque cresce mais na ponta fraca: o jogador de 90 domina limpo; o de 45 "espirra") e o `teste-dominio` da Etapa 1 (fraco a 15 m/s ≥ 15 pontos abaixo do bom) | O erro não é linear no atributo | `CONDUCAO.dominioErroAng/Vel` com `dominioCurva` 1,5: erro = bom + (ruim − bom)·((100 − attr)/100)^1,5. Medido em jogo (`medir-controle`, partida IA × IA, 8 sementes): p95 do 1º toque 0,93 m (controle ≥ 80) × 0,91 m (70–79) × 1,84 m (< 70); na publicada 1,20 × 1,09 × 1,54 (o bom era *pior* que o médio) |

## 3. Goleiro: mergulho, salto e espalmada

| Fonte | O que diz | O que foi usado |
|---|---|---|
| Spratford et al. 2009 (resumo em Ibrahim et al. 2019, J. Sports Sciences, "Kinematic and kinetic analysis of the goalkeeper's diving save in football", https://www.tandfonline.com/doi/full/10.1080/02640414.2018.1499413) | O goleiro de alto nível mergulha **mais direto para a bola** e mais rápido; o corpo vai estendido no voo | O mergulho é uma "prancha": no contato, pés (fora do chão), quadril, ombros e mãos quase numa linha que aponta para a bola (`goleiro.js resolverMergulho`) |
| Ibrahim et al. 2019 / Monteiro 2022 (https://pmc.ncbi.nlm.nih.gov/articles/PMC9630263/) — já em `PESQUISA-ETAPA2.md` | Pico do centro de massa 3,6–4,0 m/s, deslocamento ~1,5 m, ~1,0 s do estímulo ao toque; perna oposta empurra mais (2,7 m/s) que a do lado (1,2 m/s) | `V_PICO` 4,6 m/s (folga do braço curto do boneco); perfil do centro S(u) = 2u² − u³ (sai devagar, chega rápido); o pé do lado da bola dá o passo e o outro empurra do lugar; a defesa começa no máximo `GOLEIRO.antecipaMergulho` (0,5 s) antes do contato |
| "The Effect of Preparatory Posture on Goalkeeper's Diving Save" (PMC7739625) | Postura de espera com joelhos flexionados encurta o tempo de movimento | Na impulsão o quadril baixa 0,1 m antes de subir (`quadroMergulho`, fase 'impulso') |
| The FA — England Football Learning, "Different saving actions for goalkeepers" (https://learn.englandfootball.com/articles-and-resources/coaching/resources/2023/Different-saving-actions-for-goalkeepers); JB Goalkeeping, "Punching and Parrying" (https://www.jbgoalkeeping.com/noncatch.html); Reusch goalkeeping ("Never parry forward. Forward = rebound goal. Wide = corner.") | Espalmar para o lado do gol / por fora da trave / por cima do travessão, **nunca de volta para a área** | `espalmar`: por cima do travessão (bola acima de 1,85 m), pela linha de fundo por fora da trave (contato a < 4 m da linha) ou bem aberta (|z| ≥ 10 m), conferido pela física (`espalmadaSegura`: não pode entrar no gol nem morrer na zona perigosa); `teste-mergulho`: espalmadas que morrem a < 11 m da linha e |z| < 9 m — publicada 67,5%, agora 7,2% |
| StatsBomb (já em `PESQUISA-ETAPA2.md`: 48,5% seguradas, 21,8% para fora, 18% para um adversário) | A proporção segurar × espalmar | Mantida (`GOLEIRO.segurar`); a espalmada agora vai para fora em vez de cair na frente do gol |
| Penalty dive kinematics (Scientific Reports 2024, https://www.nature.com/articles/s41598-024-60074-x) | O corpo cai de lado e o goleiro se levanta em seguida | Depois do contato: cai de lado (quadril a 0,17 m), fica `T_CHAO` no chão e levanta em `T_LEVANTA` com os pés vindo para debaixo do quadril — do contato até de pé: mediana 0,93 s (0,88–1,02) |

## 4. Correções da contraprova (10/10): limites do corpo, rebote, cavadinha, espalmada e 1º toque embalado

A contraprova adversarial achou o goleiro "teletransportando" (centro do corpo a até 64 m/s quando a reação
acabava em cima da hora), o tronco virando ~90° num quadro no rebote, a cavadinha sem pulo, a espalmada ainda
jogável na área e a curva nova do domínio derrubando os gols da partida. O que foi lido e usado em cada correção:

| Fonte | O que diz | O que foi usado |
|---|---|---|
| Monteiro 2022 / Ibrahim 2019 (já acima) | O centro de massa do goleiro chega a 3,6–4,0 m/s no mergulho | Teto duro: o perfil do centro (Hermite, partindo da velocidade que ele tinha) é limitado a `GOLEIRO.mergulho.vPico` 4,6 m/s de lado e `vFrente` 2,5 m/s para a frente, conferido amostrando a velocidade (`faixaDesloc`); medido: pior 5,2 m/s no canhão de 1050 chutes (antes 64) |
| "Biomechanical Analysis of Anticipation of Elite and Inexperienced Goalkeepers" (handebol, https://pmc.ncbi.nlm.nih.gov/articles/PMC3590836/) | Goleiros experientes começam o movimento ~0,19 s ANTES de a bola sair, lendo o corpo de quem arremessa | `GOLEIRO.leitura` 0,1 s: o corpo começa a se mexer um pouco antes do fim da reação da conta da chance de defesa (que não muda) — o desenho tem tempo de chegar à bola sem teletransporte. Com isso a defesa sorteada que o corpo não alcança vira gol (`maoAlcanca`) sem mudar o canhão do `teste-goleiro` (±8 pontos dos dados; ±7 antes) |
| Biomecânica do soco (PMC9798280: pico do jab de boxeadores de elite 7,2 m/s; direto de trás 8–12,5 m/s) | O braço humano mais rápido chega a ~12 m/s | `GOLEIRO.mergulho.vMao` 12 m/s: a mão vai da espera até a bola no máximo nesse pico (perfil suave, em relação ao corpo); mais que isso, a defesa não vale |
| Física do salto (v = √(2·g·h): 0,6 m de subida saem a ~3,4 m/s) | A impulsão limita quanto e quão rápido o quadril sobe | `sobe` 3,5 m/s e `saltoMax` 0,6 m: no salto e na cavadinha o goleiro alcança ~2,6 m com a mão |
| Treinadores de goleiro (já acima: "para fora = escanteio") e o critério duro da contraprova (bola abaixo de 1,5 m e de 7 m/s na zona perigosa em 2 s) | A espalmada boa sai forte e para fora da área | `espalmada.vMin` 8 m/s (a bola parada na mão do goleiro era o rebote), até 8 direções cada vez mais abertas e mais altas, conferidas pela física até a bola não ficar jogável na zona; medido com atacantes na área (`teste-mergulho` C): o ataque tocou primeiro em 1,6% das espalmadas (publicada: 33,6%) |
| Locomoção do próprio jogo (`jogador.js`: aceleração de lado `latCorte`, freio) e a medida do `teste-recepcao` | A ~7 m/s o corpo não acompanha uma bola mandada de lado ou para trás (ficava a 1,3–2,1 m do pé 0,5 s depois) | `conducao.js anguloEmbalado(v)`: o 1º toque orientado sai no máximo 90° do sentido da corrida a 4,5 m/s e ~45° a 7 m/s, para o lado do analógico (o "directional first touch" limitado pelo embalo) |
| Contraprova (ablação só da curva do domínio, 32 partidas: 2,03 × 1,38 gols) e o elenco (menor controle de titular: 59) | A curva mais dura na faixa 55–69 tirava o ataque da partida | A conta publicada volta entre 55 e 70; acima de 70 o erro cai mais depressa (o bom mais limpo); abaixo de 55 (nenhum titular) cresce mais depressa (o fraco espirra a bola forte — `teste-dominio`) |
| Hudl/StatsBomb, "Post-Shot Expected Goals (PSxG)" (https://support.hudl.com/s/article/post-shot-expected-goals): "deflections tend to significantly increase the likelihood of a goal"; Apunts 2025, "Shooting and goalkeepers response analysis in a professional football league" (https://www.apunts.org/en-shooting-goalkeepers-response-analysis-in-articulo-S2666506925000045: 8–21% dos chutes desviados); no hóquei, a defesa cai mais de 10 pontos com o desvio (OMHA, https://www.omha.net/news_article/show/716614-using-deflections-and-tip-ins-to-alter-goalie-positioning) | O desvio engana o goleiro: ele reage de novo, do zero | `m.desvio` + `lerChute` relê o chute desviado com o tempo de reação inteiro; a defesa lida antes só vale com a bola onde foi lida (`GOLEIRO.desvioMax`) e, sem tempo de começar a nova, com a mão desenhada na bola. Medido (`teste-mergulho` E, 228 chutes desviados): a bola nunca salta (publicada: até 8,4 m num quadro; na partida, 23 m); 18 de 70 desviados no alvo defendidos depois de reler, todos com a mão ≤ 0,25 m |
| The FA, "Different saving actions" (já acima: depois do encaixe a bola vem para o peito, protegida pelas mãos) | A bola segura fica entre as mãos, junto do corpo | Bola na mão de pé com as palmas dos dois lados dela (`anim.js`), o encaixe desenhado termina nesse ponto (antes os braços "pulavam" ~0,43 m no quadro em que a defesa acabava; agora ≤ 0,01 m) e a bola pega solta chega às mãos a `bolaMao.vJunta` 4 m/s (antes saltava ~0,9 m num quadro) |
| StatsBomb (já em `PESQUISA-ETAPA2.md`: das bolas que o goleiro toca, 48,5% seguradas, 21,8% para fora, 18% para um adversário) | A espalmada é um desfecho próprio, não um encaixe adiado | `GOLEIRO.reagarra` 0,5 s: o goleiro não pega a própria espalmada logo depois. Medido (`teste-mergulho` B11): a espalmada voltava para as mãos dele em ≤ 0,5 s em 46,6% dos casos na publicada (65,1% na versão da contraprova) — agora 0%; no rebote disputado (C), todas as 120 espalmadas saem do campo |

## O que ficou de fora (honestidade)

- Não há captura de movimento do mergulho (fica para a Etapa 5, mocap): a pose é procedural, pela mesma conta da
  simulação.
- Bola alta e longe (acima de ~2,3 m, no ângulo): o boneco tem o braço curto, e o mergulho sai com o tronco a
  ~35° (deitar mais pediria o quadril a ~1,8 m do chão); abaixo disso o tronco passa de 45°.
- Batido em cima da hora, o goleiro mergulha atrasado (o pico ~0,3 s depois de começar): quando a bola já entrou,
  ele ainda está saindo do chão.
- O "Pass Receiver Lock" e o "Directional First Touch" são descritos em notas e guias do EA FC; não há número
  público — os números da recepção (0,42 m à frente, ±20°, 1,5 rad) foram calibrados pelos testes deste repositório.
