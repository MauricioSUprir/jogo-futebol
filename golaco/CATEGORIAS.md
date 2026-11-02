# 🗂️ Total Match 3D — o que falta, por categoria

> Resumo da `golaco/FILA.md` (lá estão o status, a evidência e o plano de cada item).
> **Como funciona:** o dono escolhe a categoria; nada começa sem o aval dele. Cada item vira um PR.
> Atualizado em 02/11.

**Legenda:** 🆕 pedido novo (23/10 ou 29/10) · 🔎 achado na entrega do carrinho, da faixa de baixo, do placar ou da câmera (02/11) · ⏳ espera o seu aval para começar · ⭐ prioridade pedida pelo dono · ⚙️ muda as partidas (os lances do jogo) · ✅ entregue

---

## 🎬 A. Cenas — ~3 h

| nº | o que é | horas |
|---|---|---|
| 7 | Cortes da torcida e do treinador na comemoração do gol | 3 |

---

## 🛠️ B. Correções e regras — ~23 h

| nº | o que é | horas |
|---|---|---|
| 57 | 🆕 ⚙️ **Impedimento pela parte do corpo mais perto do gol** (não pelo centro), e o replay com as linhas nesses pontos | 6 |
| 8 | Estádios de nome igual: falta a forma do Centenário de Caxias do Sul (o de Montevidéu ficou certo no #596) | 1 |
| 9 | Duas metas da condução que seguem marcadas como pendentes | 0,5 |
| 10 | Textos da documentação que contradizem o código | 1 |
| 11 | ⚙️ Tiro livre indireto perto do gol: os defensores na linha entre as traves | 4 |
| 74 | 🔎 ⚙️ ⏳ SPA na área tentando a bola sem cartão também no bote da IA e na DIVIDIDA (Regra 12.4; no carrinho já é assim) | 1,5 |
| 73 | 🔎 O "descanso" da DIVIDIDA errada fica guardado e tira o bote da IA desse jogador mais tarde | 1 |
| 72 | 🔎 O mergulho do goleiro e o pulo do cabeceio continuam no desenho durante o intervalo | 2 |
| 78 | 🔎 Carrinho: conferir as outras listas onde o jogador deitado ainda pode contar | 2 |
| 71 | 🔎 Um item do teste do estádio (o "GOL!" na tela) que não mede nada | 1 |
| 81 | 🔎 Testes de tela que oscilaram sem ligação com a mudança (a contagem de programas de shader na cena de substituição; a aba parada do online; o aviso do "Simular o resto" no teste do TM; o pico de CPU no replay de parada do CI do #599) | 3 |
| 84 | ✅ O tempo do teste do HUD na divisão do CI: 131 s, do log do CI (#599) | 0,25 |

---

## 🧤 C. Goleiro e chute — ~45 h a fazer ⚙️ *(escolhida em 27/10)*

| nº | o que é | horas |
|---|---|---|
| 12 | ✅ Goleiro realista: movimento, espalmadas, encaixes, saída no 1×1 e no cruzamento (#558) | 8 |
| 13 | ✅ Chute com a barra cheia mais alto, podendo acertar o ângulo, com o analógico no canto (#567) | 5 |
| 14 | ✅ Goleiro espalmando bola alta com a mão de cima, e nada atravessa o goleiro (#568) | 4 |
| 15 | ✅ Lançamento mais reto e rápido: 18–26° com teto de 33 m/s, a 40 m o ápice de 8,0 para 4,7 m (#572) | 6 |
| 16 | ✅ Reposição do goleiro com a mão: rolar, por cima do ombro, bate-pronto e chutão; a IA repõe com a mão em ~69% (#579) | 5 |
| 68 | ✅ Mira pelo que se vê na tela: o meio do gol visto vai no meio (no celular, antes, 1 em 3 ia para um canto), o pênalti na trave vista (#583) | 6 |
| 70 | ✅ P1 (corrida) · P2 (estilos). **Cobranças com corrida**: no pênalti, escanteio, tiro de meta e falta o cobrador sai de 2,5–5 m e corre até a bola (3–4,7 m/s), o pé de apoio ao lado dela; a bola rola na mesma hora de antes (#588). **Jeitos de bater o pênalti** (pulinho, paradinha, forte, colocado, cavadinha), com o goleiro que sai cedo e o cobrador que o lê; o goleiro na linha até o chute (P2, #594) | 24 |

---

## 🧠 D. IA mais intensa — ✅ FEITA (26/10) ⚙️

| nº | o que é | horas |
|---|---|---|
| 67 | ✅ 🆕 ⭐ **A IA correr de verdade, para marcar e para atacar** | 10 |
| 18 | ✅ ⭐ **Botão PRESSÃO funcionando de verdade** | 5 |
| 17 | ✅ Seus companheiros apertarem o condutor da IA | 8 |
| 19 | ✅ Defensor ultrapassado recuar rápido (meta: 5 m/s) | 5 |
| 20 | ✅ Pressão mais agressiva | 4 |
| 21 | ✅ A IA atacar mais contra você (volume de chutes) | 8 |
| 22 | ✅ Movimentação melhor e jogo mais tenso (sem o vai e volta) | 10 |
| 23 | ✅ Forma do time (linha de 4, atrás da bola) | 6 |
| 24 | ✅ Apoio (companheiros à frente) | 6 |
| 25 | ✅ Intensidade (lances rápidos) | 6 |

---

## ⚖️ E. Equilíbrio — ~38 h ⚙️ *(depois da IA)*

| nº | o que é | horas |
|---|---|---|
| 26 | Mais chutes e menos precisos (hoje poucos e certeiros demais) | 16 |
| 27 | Gols por partida: de ~1,8 para 2,3–3,5 | 4 |
| 28 | Faltas que ainda não existem (duelo pelo alto, segurar no escanteio) | 6 |
| 75 | 🔎 A IA também dar carrinho (2–5,5 por time por partida, como no real) | 12 |

---

## 📱 F. Telas, HUD, câmera e controles — ~86,5 h a fazer

| nº | o que é | horas |
|---|---|---|
| 34 | ✅ ⭐ **Botão de CARRINHO**: L e X na defesa (com a bola alta, lançamento) e o botão "CARRIN." no celular; desliza na bola pela perna desenhada, quem erra fica ~1,2 s no chão, falta e cartão pela Regra 12 (#597) | 14 |
| 66 | ✅ **Câmera**: segue a bola (atraso p90 9,5 → 5,7 m, miolo 94,5 → 98,3%), a área inteira no último terço (15,9 → 96,7% com a bola nela), 6% mais aberta e o escanteio da pessoa alto (a área 7,7 → 23,6% da tela); na bola muito alta o gramado e os jogadores ficam no quadro, e no Rumo ao Estrelato o seu jogador fica no quadro (#600) | 8 |
| 58 | 🆕 **Menu de pausa igual ao do FC 24**, com o campinho do seu time no canto direito | 8 |
| 64 | 🆕 **Tela antes do jogo** (todo modo) no nível da do EA FC, com a cara do TM | 12 |
| 65 | 🆕 **Mira das bolas paradas** minimalista, com um jeito bom de pôr curva | 8 |
| 59 | ✅ **Minimapa embaixo, no meio**, entre o analógico e os botões (92×60 no padrão; a torcida do alto livre: 5,4% → 0%), o topo só com placar e menu (#598) | 1,5 |
| 60 | ✅ **Nome do jogador com a bola nos cantos de baixo** (o time da esquerda do placar à esquerda, o da direita à direita), sem piscar e sem pegar toque (#598) | 1,5 |
| 32 | ✅ **Placar um pouco maior, com a cara do TM e o relógio em minutos e segundos** ("34:12"; nos acréscimos o relógio continua com o "+4"; "Intervalo"/"Fim" no lugar do relógio; 28 px no celular, 30 no PC) (#599) | 4,5 |
| 29 | Campinho da escalação em pé | 4 |
| 30 | Cena de substituição no online | 4 |
| 31 | Foto do autor do gol com número e nome na comemoração | 6 |
| 33 | Escolher o tempo de jogo e a dificuldade | 9 |
| 35 | Clássico mais pegado (mais faltas pela vontade dos jogadores) | 7 |
| 76 | 🔎 Quem sofre o carrinho cai e levanta (hoje só perde velocidade e o domínio) | 8 |
| 80 | 🔎 ⏳ Carrinho: menos falta antes da bola (o atacante pular o carrinho, ou o contato colado na bola contar como bola primeiro) | 6 |
| 79 | 🔎 Carrinho: depois do apito, até a cobrança ser montada, a bola não passar por dentro das pernas de quem está deitado | 3 |
| 82 | 🔎 Gol nos acréscimos com o minuto "45+2'" na tarja das cenas (hoje sai "45'"; o resultado no TM não muda) | 1,5 |
| 83 | 🔎 O espaço da tela no celular está no limite: medir em mais telas e com a fonte do aparelho, e o custo do relógio no celular | 2 |
| 85 | 🔎 A câmera nova também na câmera aproximada, na janela estreita (em pé) do PC e no replay fechado (hoje só a TV acompanha a bola sem atraso) | 4 |
| 86 | 🔎 Modo Livre com a câmera bem alta e perto: a bola alta ainda sai do quadro em ~27% das vezes (antes do item 66, 34%) | 2 |
| 87 | 🔎 ⏳ Falta da IA de 30 a 35 m do gol no celular: a área não cabe inteira (a bola e o gol, sim) — abrir o plano só nessa cobrança, ou deixar | 2 |

---

## 🔁 G. O 3D no lugar da simulação — ~49 h

| nº | o que é | horas |
|---|---|---|
| 36 | Prorrogação na partida 3D | 12 |
| 37 | Disputa de pênaltis no mesmo jogo, com o resultado indo ao TM | 12 |
| 38 | Rumo ao Estrelato quando você começa no banco | 8 |
| 39 | Partida de Base e o Palpite da Arena em 3D | 5 |
| 40 | Online antigo e o Duelo do Ultimate em 3D | 10 |
| 41 | Checagem que reprova toda partida do usuário sem caminho em 3D | 2 |

---

## 🌐 H. Online — ~28 h

| nº | o que é | horas |
|---|---|---|
| 42 | Indicador de sinal no HUD | 3 |
| 43 | Convite pela lista de amigos | 5 |
| 44 | Voltar à partida depois de recarregar a página | 20 |
| 56 | Rollback (fora da fila ativa: só se houver reclamação medida) | 40 |

---

## 🎨 I. Visual, corpo e estádios — ~132 h + lotes

| nº | o que é | horas |
|---|---|---|
| 69 | ✅ **Cadeiras e torcida em 3D**, parecidas com as reais, em todos os estádios (4 PRs: a cadeira e o degrau (#586); o torcedor 3D sentado nas cadeiras de perto, com as poses do quadro (#593); o impostor octaédrico assado na carga, a escolha por bloco e a densidade real perto (#595); os 523 estádios calibrados — fileiras de 0,8 m por metro, caimento ≤ 34°, escada de ~1,2 m, nenhuma cadeira sobreposta ou dentro de um sólido, o torcedor no tamanho de gente, a lotação dos sem forma e as cores da base = as desenhadas (#596)) | 52 |
| 61 | 🆕 **Passada natural** (no túnel e na fila parecem marchar) | 5 |
| 62 | 🆕 Linha escura na nuca (costura da textura da cabeça) | 2 |
| 63 | 🆕 Bordas tracejadas em volta dos números e patrocínios das camisas | 2 |
| 77 | 🔎 Carrinho: a mão de apoio do boneco simples encostar no chão | 2 |
| F1 | Rostos do Brasileirão com o processo novo (a versão de teste) | 6 |
| 45 | Gráficos melhores no celular (Baixa e Média) | 12 |
| 46 | Sombra do estádio no gramado de dia | 6 |
| 47 | Torcida reagindo em onda no gol e na chance | 4 |
| 48 | Fotógrafos atrás do gol | 10 |
| 49 | Acabamento do corpo nos closes | 6 |
| 50–53 | Mocap: movimento capturado na corrida, nas cenas e nos detalhes | 25 |
| 54 | Rostos reais das outras ligas (uma por PR) | ~5 por liga |
| 55 | Os 418 estádios sem forma própria, em lotes | ~10 por lote |

---

## 🤔 Decisões que são suas

1. 🎥 As câmeras do Modo Livre também na partida?
2. 🌐 TURN no online: precisa de conta de adulto e tem custo.
3. 🎮 Quando tirar o "Simular" das partidas (depois da categoria G).
4. 🥅 Cavadinha no pênalti: hoje entra 88%, a pesquisa diz que deveria ser menos que o pênalti comum (77%).
5. 🌀 Velocidade da falta com curva (hoje 23 m/s aos 27 m; o real é 17–21).
6. ↩️ Corte de 90° em velocidade (mexe na condução que você aprovou).
7. 🔄 IA que passa melhor × defesa que intercepta mais.
8. 🙂 Rostos da edição pública (fonte e licença).
9. 📊 O painel de estatísticas fica no pós-jogo?
10. 🏟️ Item 69: a qualidade Baixa sem bonecos 3D? Gente em toda cadeira perto da câmera nos estádios grandes? Entrega em 2 ou em 4 PRs?
11. 🎯 Item 70: P1 e P2 feitas com as escolhas recomendadas (aval de 31/10: a falta também corre; a IA começa antes; os comandos do EA FC, com PARADINHA e PULINHO no toque só na cobrança do pênalti; a paradinha depois da corrida impossível; o rendimento realista, ± 10 pontos do normal; o goleiro na linha até o chute também na partida). Falta confirmar: a janela da cavadinha vale a corrida toda.
12. 🦵 Item 34 (carrinho): feito com as escolhas recomendadas — "CARRIN." no botão; quem sofre não cai (item 76); sem "levantar rápido"; vale em toda bola baixa e parado; ~1,2 s no chão no erro e 0,5 s no acerto; L e X = carrinho na defesa e lançamento com a bola alta; vermelho direto de qualquer lado; dois carrinhos: falta só de quem não tocou a bola; o seu jogador no Rumo ao Estrelato também dá carrinho. A escolher: menos falta antes da bola (item 80), o SPA na área sem cartão para todos (item 74) e a IA dar carrinho (item 75).
13. 📍 Itens 59 e 60 (a faixa de baixo): feitos com as escolhas recomendadas — o orçamento da tela conta o nome e mede o ≡ pelo ícone (10,95% no pior caso, medido com o relógio em "0'" — ver o 14; com a régua de antes, 11,77%: só passa dos 11% com a régua nova); o arco de botões subiu 8–10 px; o nome sem caixa alta; com a bola solta ele fica apagado (na tela ~95% do tempo, sem piscar); nada de nome nos treinos nem na disputa; o minimapa continua desligado por padrão no celular.
14. ⏱️ Item 32 (o placar): feito com a escolha recomendada — na tela de 568×320 (o iPhone SE de 2016) o HUD pode ocupar até 12% (nas outras, 11%): ali o placar com minutos e segundos, escudos e siglas não cabe nos 11% (o de antes já passava dos 11% com o relógio de verdade: 12,06% nos acréscimos; o novo, 11,85%). Também escolhidos: nos acréscimos o relógio continua andando ("47:13 +4"), "Intervalo"/"Fim" no lugar do relógio, o símbolo do TM some do placar nas telas de até 700 px de largura. Na revisão: no celular, cada dígito a mais no placar (gols de 2 dígitos, ou o relógio passando de 99:59) aperta os espaços, e com dois a mais sai também o "+N" dos acréscimos; a tela de 640×360 usa o placar de 26 px e fica nos 11% (#599). Alternativas medidas na FILA ("Depende do dono" 15).
15. 🎥 Item 66 (a câmera): feita com as escolhas recomendadas — 6% mais aberta (o seu jogador ~35 px no celular; o mínimo é 34; dá para abrir 4% ou 8%); um pouco de espaço à frente da jogada (dá para deixar a bola bem no centro, ou com o espaço da TV de verdade); o escanteio cobrado por você atrás do cobrador e alto (dá para voltar à baixa, só a TV, ou mais longe); a área inteira quando a bola está nela, mais do que a TV mostra; a câmera não gira como a da TV (giraria o analógico). Da revisão: no Rumo ao Estrelato o seu jogador vem antes da área (a área inteira com a bola nela cai de 96% para 76% só nesse modo); a câmera acelera mais vezes para acompanhar a bola, sem tremer (se achar agitada, dá para suavizar); a falta da IA de 30 a 35 m no celular sem a área inteira (item 87). Detalhes e números na FILA ("Depende do dono" 16).

---

## ✅ Entregue nesta rodada

- 🎥 A câmera que acompanha a bola e mostra a área: menos atraso, a bola mais no centro, a área inteira quando a bola está nela, 6% mais aberta e o escanteio que você cobra visto do alto (item 66, #600)
- ⏱️ O placar um pouco maior, com a cara do TM e o relógio em minutos e segundos (item 32, #599)
- 📍 A faixa de baixo: o minimapa embaixo no meio, entre o analógico e os botões, e o nome do jogador com a bola nos cantos de baixo (itens 59 e 60, #598)
- 🦵 Botão de CARRINHO: L e X na defesa e o botão "CARRIN." no celular, a perna desenhada na bola, falta e cartão pela Regra 12, as cenas continuam o deslize (#597)
- 🧤 Goleiro espalmando bola alta (#568)
- 🎯 Chute no ângulo com a barra cheia e o analógico no canto (#567)
- 🧤 Goleiro realista (#558)
- 🧠 Categoria D inteira: a IA corre para marcar e para atacar, botão PRESSÃO, companheiros apertando, forma e apoio (#524, #530, #534, #536, #538, #542, #549, #550)

- 🎞️ Replays nas paradas: faltas, trave, espalmada e chance perdida (#507)
- 🟨 Cena do cartão: amarelo, vermelho e expulsão (#508)
- ⏸️ Cena do intervalo, com os lances do 1º tempo (#510)
- 🏁 Cena do pós-jogo: melhor em campo, troca de camisa, melhores momentos (#516)
- 👕 Patrocínios nas camisas reais (versão de teste)
