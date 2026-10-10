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

## O que ficou de fora (honestidade)

- Não há captura de movimento do mergulho (fica para a Etapa 5, mocap): a pose é procedural, pela mesma conta da
  simulação.
- O "Pass Receiver Lock" e o "Directional First Touch" são descritos em notas e guias do EA FC; não há número
  público — os números da recepção (0,42 m à frente, ±20°, 1,5 rad) foram calibrados pelos testes deste repositório.
