# 🗂️ Total Match 3D — o que falta, por categoria

> Resumo da `golaco/FILA.md` (lá estão o status, a evidência e o plano de cada item).
> **Como funciona:** o dono escolhe a categoria; nada começa sem o aval dele. Cada item vira um PR.
> Atualizado em 07/11.

**Legenda:** 🆕 pedido novo (23/10 ou 29/10) · 🔎 achado na entrega do carrinho, da faixa de baixo, do placar, da câmera, da mira (02/11) ou da pausa e da tela antes do jogo (04/11) ou da escalação em pé, da foto do autor e do tempo de jogo e da dificuldade (05/11) ou do clássico e do CI do #621 (06/11) · ⏳ espera o seu aval para começar · ⭐ prioridade pedida pelo dono · ⚙️ muda as partidas (os lances do jogo) · ✅ entregue

---

## 🎬 A. Cenas — ~3 h

| nº | o que é | horas |
|---|---|---|
| 7 | Cortes da torcida e do treinador na comemoração do gol | 3 |

---

## 🛠️ B. Correções e regras — ~34 h

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
| 81 | 🔎 Testes de tela que oscilaram sem ligação com a mudança (a contagem de programas de shader na cena de substituição; a aba parada do online; o aviso do "Simular o resto" no teste do TM; o pico de CPU no replay de parada do CI do #599; o tempo dos lugares do estádio genérico no CI do #600; os passos do jogo no teste do TM com a máquina cheia, na entrega do item 29) | 4 |
| 92 | ✅ Os tempos dos testes da mira na divisão do CI: 287 s e 130 s, do log do CI (#613) | 0,25 |
| 93 | ✅ O tempo do teste da pausa na divisão do CI: 243 s, do log do CI (#613) | 0,25 |
| 100 | ✅ O tempo do teste da tela antes do jogo na divisão do CI: 441 s, do log do CI (#613) | 0,25 |
| 101 | 🔎 O que ficou fora do teste da tela antes do jogo: o tempo até ela aparecer e do Jogar ao 1º plano, o download com o TM, 4 das 5 provas de que o teste reprova sem a correção, a espera de 100 s no online e o tempo do "Simular partida" | 2 |
| 84 | ✅ O tempo do teste do HUD na divisão do CI: 131 s, do log do CI (#599) | 0,25 |
| 108 | 🔎 O nome de camisa do TM com mais de 10 letras sai cortado no meio, sem marca ("Evangelista" vira "Evangelist"): cortar com "…" ou usar outra parte do nome | 1 |
| 109 | ✅ O tempo do teste do pré-jogo na divisão do CI: 580 s, do log do CI (#614; no #615) | 0,25 |
| 111 | ✅ Os tempos dos testes da comemoração e da tela antes do jogo na divisão do CI: 85 s e 600 s, do log do CI do #615 (no #618) | 0,25 |
| 113 | 🔎 Conferir rodando o que a foto do autor não rodou: o online com uma pessoa na edição pro e a outra na pública, o aviso "Conexão instável" escondido na comemoração, as fotos nas fichas no Modo Livre e nos Pênaltis, e se o boneco parece com a foto (fora dos rostos reais) | 2 |
| 114 | ✅ Os tempos do teste da dificuldade (792 s), do teste da pausa (250 s) e do teste da tela antes do jogo (430 s) na divisão do CI, do log do 1º CI do #618 (#619) | 0,25 |
| 115 | 🔎 Conferir rodando o que o tempo de jogo e a dificuldade não rodaram depois da revisão: o online do TM, o TM na edição pública, os Pênaltis e o Modo Livre do TM, o Viverde e o ‹ › da pausa num celular de verdade | 1,5 |
| 127 | 🔎 A falta tática dentro da própria área (o zagueiro batido puxa a camisa e é pênalti com amarelo): tirar, como já é no "segurar" | 1 |
| 128 | 🔎 Um teste de desempenho no celular (informativo) acusa sobra de memória depois de 10 substituições (geometrias 33 → 37) e a CPU da comemoração acima do jogo; já acontecia antes dos itens 124–126 | 2 |

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

## 📱 F. Telas, HUD, câmera e controles — ~81 h a fazer

| nº | o que é | horas |
|---|---|---|
| 34 | ✅ ⭐ **Botão de CARRINHO**: L e X na defesa (com a bola alta, lançamento) e o botão "CARRIN." no celular; desliza na bola pela perna desenhada, quem erra fica ~1,2 s no chão, falta e cartão pela Regra 12 (#597) | 14 |
| 66 | ✅ **Câmera**: segue a bola (atraso p90 9,5 → 5,7 m, miolo 94,5 → 98,3%), a área inteira no último terço (15,9 → 96,7% com a bola nela), 6% mais aberta e o escanteio da pessoa alto (a área 7,7 → 23,6% da tela); na bola muito alta o gramado e os jogadores ficam no quadro, e no Rumo ao Estrelato o seu jogador fica no quadro (#600) | 8 |
| 58 | ✅ **Menu de pausa igual ao do FC 24**: o jogo parado à vista, a lista de texto à esquerda (Voltar ao jogo, Editar time, Estatísticas, Replay, Opções, …) e o campinho do seu time no canto direito (número, nome, cartões, quem entra e "você"; tocar nele abre o Editar time); cabe sem rolar até o celular pequeno, com teclado, controle e toque; no PC também nas telas 4:3, 5:4 e 16:10 e na janela baixa (#602) | 8 |
| 64 | ✅ **Tela antes do jogo** (todo modo) no nível da pré-partida do EA FC 24, com a cara do TM: os dois times e a hora, estádio · data · árbitro, o campinho com as 11 fichas (busto, nota, nome na letra da carta do TM), o selo da tática; Jogar partida · Visão tática (com e sem a bola) · Personalizar (+ Simular partida no TM); no online o "Pronto" dos dois; o "Jogar" liga o som e começa o pré-jogo; cabe sem rolar do celular pequeno ao PC, com teclado, controle, toque e leitor de tela (#613) | 16 |
| 65 | ✅ **Mira das bolas paradas** minimalista, com a cara do TM: a linha fina branca com contorno (4 px no celular, antes até 11), o anel verde onde a bola cai, o arco verde da curva junto da bola, sem painel nem texto; no celular a curva é segurar o CHUTE ou o LANÇAMENTO e ARRASTAR o polegar para o lado (os 2 botões CURVA saíram: o HUD da cobrança 14,5 → 10,8% no celular pequeno); teclado e controle iguais; o dedo que já estava no botão antes de a mira aparecer também arrasta (#601) | 8 |
| 59 | ✅ **Minimapa embaixo, no meio**, entre o analógico e os botões (92×60 no padrão; a torcida do alto livre: 5,4% → 0%), o topo só com placar e menu (#598) | 1,5 |
| 60 | ✅ **Nome do jogador com a bola nos cantos de baixo** (o time da esquerda do placar à esquerda, o da direita à direita), sem piscar e sem pegar toque (#598) | 1,5 |
| 32 | ✅ **Placar um pouco maior, com a cara do TM e o relógio em minutos e segundos** ("34:12"; nos acréscimos o relógio continua com o "+4"; "Intervalo"/"Fim" no lugar do relógio; 28 px no celular, 30 no PC) (#599) | 4,5 |
| 29 | ✅ **Campinho da escalação do pré-jogo em pé**: o campo inteiro com o gol embaixo (como a Globo), o círculo redondo, as cartas das pontas para dentro das laterais, o nome na letra da carta do TM sem cortar (nem os traços de baixo do g e do y), a posição a 11 px no celular; do celular pequeno ao PC, com e sem a cara do TM (#614) | 4 |
| 30 | ✅ **Cena de substituição no online**: vale a opção de quem criou a sala, nos dois aparelhos (a faixa ENTRA/SAI aparece sempre); cada um vê a sua cena e pode pular só a sua — quem acaba antes espera o outro, com "{nome} ainda está vendo a cena." no aviso, sem o "Conexão instável" e sem W.O. (antes dizia "A conexão parou" em toda espera longa, também na do replay e da comemoração do outro); a troca feita pelo outro jogador abre a mesma cena no mesmo tick nos dois; o menu aberto não congela a cena nem a pula; com o celular em pé ela congela; o jogo continua igual nos dois (#622) | 4 |
| 31 | ✅ **Foto do autor do gol com o número e o nome na comemoração**: o cartão no canto de cima à direita, na linha do placar (desde o item 126, embaixo à direita e menor; foto da edição pro do TM, a pílula com escudo, sigla e número e o NOME completo como a linha principal, também no celular; sem foto, uma linha da altura do placar), 3,5 s na tela a partir de 0,4 s depois do 1º corte, nunca no gol contra nem com a bola rolando; e a mesma foto no lugar do busto nas fichas da tela antes do jogo (#615) | 7 |
| 33 | ✅ **Escolher o tempo de jogo e a dificuldade**: 3 a 10 min por tempo e Fácil/Normal/Difícil/Lenda na pausa ("Modo de jogo"; no TM, "Partida e cenas"), na tela antes do jogo ("2 × 4 min \| Normal") e pela Config do TM; nas Batalhas do Ultimate a dificuldade é a da Batalha, travada; a dificuldade muda só a IA adversária, sem mexer em atributo nem física (o Normal é o jogo de hoje): nos testes contra um jogador roteirizado, a IA marca ~0,65 gol por partida no Fácil, 0,9 no Normal, 1,07 no Difícil e 1,2 no Lenda (#618) | 9 |
| 124 | ✅ **A tela antes do jogo no lugar da janela "Jogar em 3D / Simular"**, em todos os modos do TM: o "Jogar" abre o estádio 3D direto na tela antes do jogo (também a Partida de Base, com 11 ou mais); "Simular partida" fecha o 3D e o TM simula lance a lance, como sempre, com a escalação que a tela mostrou (o Personalizar vale); em pé, a tela "Gire o celular" também tem o "Simular partida"; na Config, "Tela antes do jogo" ou "Sempre simular" (a escolha antiga virou a tela uma vez); sem WebGL 2 simula, com um aviso; o "Simular direto" da Partida rápida simula sem o 3D; o X do carregamento agora funciona; o "Simular o resto" da pausa continua no 3D (#620) | 8 |
| 35 | ✅ **Clássico mais pegado**: no clássico (o TM manda quem é rival de quem) os jogadores da IA dos DOIS times entram mais no bote e o batido segura mais quem escapa; o árbitro é o mesmo. Contra você: a IA faz +23–31% de faltas e leva +32% de amarelos, entra +12% no bote e você chuta ~12% menos (a versão anterior tirava 34% dos seus chutes); seus companheiros entram mais no bote, mas não seguram (o cartão seria seu); na IA × IA (o Simular o resto): botes +47%, faltas +34–38%; gols e chutes do jogo iguais; o seu jogador não muda (o bote dele é o botão) (#619) | 9 |
| 119 | 🔎 O teste da pressão também com o clássico (informativo) | 1 |
| 120 | 🔎 ⏳ Cartão sem falta no clássico (reclamação, conduta): seria do árbitro | 4 |
| 121 | 🔎 ⏳ O bote fisicamente mais forte no clássico (chegar mais rápido: mais falta por contato) | 3 |
| 123 | 🔎 O tempo do teste do clássico no CI | 0,2 |
| 76 | 🔎 Quem sofre o carrinho cai e levanta (hoje só perde velocidade e o domínio) | 8 |
| 80 | 🔎 ⏳ Carrinho: menos falta antes da bola (o atacante pular o carrinho, ou o contato colado na bola contar como bola primeiro) | 6 |
| 79 | 🔎 Carrinho: depois do apito, até a cobrança ser montada, a bola não passar por dentro das pernas de quem está deitado | 3 |
| 82 | 🔎 Gol nos acréscimos com o minuto "45+2'" na tarja das cenas (hoje sai "45'"; o resultado no TM não muda) | 1,5 |
| 83 | 🔎 O espaço da tela no celular está no limite: medir em mais telas e com a fonte do aparelho, e o custo do relógio no celular | 2 |
| 85 | 🔎 A câmera nova também na câmera aproximada, na janela estreita (em pé) do PC e no replay fechado (hoje só a TV acompanha a bola sem atraso) | 4 |
| 86 | 🔎 Modo Livre com a câmera bem alta e perto: a bola alta ainda sai do quadro em ~27% das vezes (antes do item 66, 34%) | 2 |
| 87 | 🔎 ⏳ Falta da IA de 30 a 35 m do gol no celular: a área não cabe inteira (a bola e o gol, sim) — abrir o plano só nessa cobrança, ou deixar | 2 |
| 88 | 🔎 Tiro de meta que você cobra, nas telas baixas (667×375, e 568×320 com o entalhe): a bola fica debaixo do botão CORRER | 2 |
| 89 | 🔎 Escanteio que você cobra do lado de lá: a câmera alta fica colada numa bandeira da torcida (uma mancha verde e preta no canto) | 2 |
| 90 | 🔎 Na montagem da sua falta ou do seu escanteio, os botões do celular são os da defesa por ~1 s (o botão grande não é o CHUTE) | 1,5 |
| 91 | 🔎 As outras marcas no gramado (as opções do lateral, amarelas, e a marca de onde a bola alta cai) com a mesma cara da mira nova | 2 |
| 94 | 🔎 A "Ajuda e controles" com a cara da pausa nova (hoje é a janela de antes e rola no celular) | 3 |
| 95 | 🔎 ⏳ Atrás da pausa, um close do seu jogador (a câmera de "bastidores" do FC 24) no lugar do jogo parado na TV — opcional | 4 |
| 96 | 🔎 Com a pausa aberta, o jogo parado deixar de ser redesenhado a cada quadro (economiza bateria no celular) | 2 |
| 97 | 🔎 O "C" do capitão nas fichas do campinho da pausa (o fôlego só quando o jogo tiver cansaço) | 1,5 |
| 99 | 🔎 ⏳ Os botões da pausa no celular com 44 px de altura onde couber (hoje de 28 a 44; o padrão da Apple é 44) | 1,5 |
| 102 | 🔎 ⏳ O fundo da tela antes do jogo escuro e desfocado como o do FC (hoje a cidade ou o estádio aparecem nítidos atrás do campinho) | 3 |
| 103 | 🔎 O nome de cada jogador embaixo do disco na Visão tática (hoje só o número; o nome só no disco escolhido) | 2 |
| 104 | 🔎 O selo grande da competição no alto da tela antes do jogo no PC, como o do FC 24 | 2 |
| 105 | 🔎 O Editar time com a mesma cara da tela antes do jogo (as fichas da carta do TM e a letra do TM) | 5 |
| 106 | ✅ **A tela antes do jogo aparece enquanto o estádio 3D carrega**: ~0,3 s depois de a página do 3D abrir (antes, 3–4 s no navegador dos testes, só com o estádio pronto), com um fundo escuro e o Simular partida, a Visão tática e o Personalizar já valendo; o Jogar e o ≡ mostram uma barrinha de carga dentro do botão e voltam sozinhos quando o estádio fica pronto; no TM o X e o "Abrindo o estádio 3D…" saem assim que a tela aparece e, no Simular, o 3D some na hora (antes ficava ~2,4 s à vista) (#635) | 4 |
| 110 | 🔎 A foto da edição pro também nas cartas da escalação do pré-jogo (no celular não cabe sem refazer o item 29; no PC, sim) | 2 |
| 112 | 🔎 ⏳ A foto enquadrada uma a uma pelo rosto, para a camisa de outro clube não aparecer (hoje o pé da foto escurece, mas as listras logo abaixo do queixo ainda aparecem) | 3 |
| 116 | 🔎 ⏳ Separar mais o Lenda do Difícil: no placar os dois quase empatam (1,07 × 1,2 gol da IA por partida); o Lenda aperta mais, mas não cria chances melhores | 3 |
| 117 | 🔎 ⏳ Na pausa, ← e → mudando a duração e a dificuldade também no teclado e no controle (hoje voltar um valor é só tocar no lado esquerdo do botão), a duração à vista no celular e "Dif. Normal" na tela antes do jogo do celular | 1,5 |
| 118 | 🔎 ⏳ O TM usar a dificuldade e a duração da partida 3D (pontos e recompensas por dificuldade; hoje o resultado já traz as duas e o TM não usa) | 3 |
| 125 | ✅ **Fontes mais legais, o campinho da pausa maior e as telas do 3D mais caprichadas**: a letra da carta do TM (condensada, esportiva) nos títulos, menus, números e nomes e a Inter no texto, em todas as telas do 3D (pausa, submenus, Editar time, tela antes do jogo, escalação, cenas, faixas, "GOL!", replay, placar do TM); na pausa a lista com o destaque animado e o campinho do seu time ~1,5× maior no PC e ~1,3× no celular, com a formação grande dentro do campo, os nomes em maiúsculas e "você" em destaque; o Editar time maior no PC e nenhuma letra abaixo de 11 px; sem crescer o download do começo (#621) | 12 |
| 126 | ✅ **Cartão do autor do gol menor e no canto de baixo**: embaixo à direita (no celular, logo acima do "Pular", que fica no mesmo lugar do replay), ~4× menor no PC e ~2× no celular, o nome em maiúsculas e inteiro também no celular pequeno; nunca em cima do autor nem dos outros jogadores (#621) | 3 |
| 129 | ✅ **O menu aberto no online não pula mais o replay nem a comemoração** (dono, 06/11: "corrige"): como na cena de substituição, a cena segue andando com o menu, a Ajuda ou o Editar time abertos e as teclas e botões são do menu — P/Start e Esc fecham, H abre a Ajuda, Enter e o A do controle apertam o botão em foco; depois de fechar, um aperto novo pula como antes (antes o P, o H, o Enter, o J e o A pulavam a cena e às vezes deixavam o menu aberto); fora do online nada muda (#630) | 0,5 |

---

## 🔁 G. O 3D no lugar da simulação — ~47 h

| nº | o que é | horas |
|---|---|---|
| 36 | Prorrogação na partida 3D | 12 |
| 37 | Disputa de pênaltis no mesmo jogo, com o resultado indo ao TM | 12 |
| 38 | Rumo ao Estrelato quando você começa no banco | 8 |
| 39 | O Palpite da Arena em 3D, assistido (a Partida de Base entrou no item 124) | 3 |
| 40 | Online antigo e o Duelo do Ultimate em 3D | 10 |
| 41 | Checagem que reprova toda partida do usuário sem caminho em 3D | 2 |

---

## 🌐 H. Online — ~34 h

| nº | o que é | horas |
|---|---|---|
| 42 | Indicador de sinal no HUD | 3 |
| 43 | Convite pela lista de amigos | 5 |
| 44 | Voltar à partida depois de recarregar a página | 20 |
| 98 | 🔎 A pausa nova no online: o tempo da pausa combinada dentro dela, "Toque de novo: sair" também com o mouse e o teclado, e as telas largas do PC no teste | 1,5 |
| 107 | 🔎 ⏳ Personalizar o time na tela antes do jogo também no online (hoje só fora dele) | 4 |
| 56 | Rollback (fora da fila ativa: só se houver reclamação medida) | 40 |

---

## 🎨 I. Visual, corpo e estádios — ~69 h a fazer + lotes

| nº | o que é | horas |
|---|---|---|
| 69 | ✅ **Cadeiras e torcida em 3D**, parecidas com as reais, em todos os estádios (4 PRs: a cadeira e o degrau (#586); o torcedor 3D sentado nas cadeiras de perto, com as poses do quadro (#593); o impostor octaédrico assado na carga, a escolha por bloco e a densidade real perto (#595); os 523 estádios calibrados — fileiras de 0,8 m por metro, caimento ≤ 34°, escada de ~1,2 m, nenhuma cadeira sobreposta ou dentro de um sólido, o torcedor no tamanho de gente, a lotação dos sem forma e as cores da base = as desenhadas (#596)) | 52 |
| 61 | ✅ **Passada natural**: no túnel, na fila e nas cenas cada um anda no seu passo e no seu ritmo, com o braço balançando contra a perna, a pelve e o ombro girando e a saída do parado em 3–5 passos; o trio de arbitragem na frente das colunas; o cotovelo do corpo novo sem o "segurando bandeja" (#632). O quique da pelve fica para o mocap | 5 |
| 62 | ✅ **Linha escura na nuca**: era o relevo do pano do corpo desenhado na cabeça; a cabeça ficou lisa, sem a linha de costas e sem as rugas no rosto (#631) | 2 |
| 63 | ✅ **Bordas tracejadas em volta dos números e patrocínios das camisas**: a camisa lê os logos e os números sem o erro que pegava a borda da caixa, e as máscaras dos logos com margem e sem névoa (o logo do mesmo tamanho na camisa) (#631) | 2 |
| 77 | ✅ **Carrinho: a mão de apoio no chão**, no boneco simples e no corpo novo (a palma virada para o chão), acompanhando a queda e o levantar; a manga comprida do goleiro cobre o braço inteiro (#631) | 2 |
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
3. 🎮 Quando tirar o "Simular" das partidas (depois da categoria G). Desde o item 124 a janela "Jogar em 3D / Simular" saiu: o Simular ficou na tela antes do jogo e no "Sempre simular" da Config.
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
16. 🎯 Item 65 (a mira das bolas paradas): feita com as escolhas recomendadas — a linha fina BRANCA com contorno preto (o branco é a única cor que aparece em todo gramado; o verde do TM fica no anel, no arco e nas setinhas dos botões); a mesma informação de antes (nos cruzamentos a linha até perto da metade e o anel onde a bola cai; dá para mostrar só o começo, como no EA, mas aí fica mais difícil); a curva mostrada por um arco verde junto da bola (dá para usar o ponto de contato do EA, ou nada); no celular, segurar o CHUTE ou o LANÇAMENTO e arrastar o polegar para o lado, um degrau a cada 14 px (dá para mudar o passo, arrastar antes de carregar, usar o analógico ou voltar aos 2 botões CURVA, que estouram o espaço da tela); o nome do tipo da batida (ALTA, CHUTE...) saiu da tela. Para conferir no seu celular: o arrasto da curva (à direita do CHUTE sobra pouco espaço) e o traço da linha. Da revisão: na montagem da sua falta os botões são os da defesa por ~1 s (item 90; recomendado mostrar os do ataque). Detalhes na FILA ("Depende do dono" 17).
17. ⏸️ Item 58 (a pausa): feita com as escolhas recomendadas — as opções (qualidade, câmera, minimapa, som...) num submenu Opções, como o "Settings" do FC (custa alguns apertos a mais no teclado e no controle); o campinho é o SEU meio campo em pé, como no FIFA 23 (dá para mostrar o campo inteiro, mas no celular pequeno os nomes não cabem); "Cenas" dentro do "Modo de jogo"; a linha "Selecionar · Voltar" só no PC; atrás da pausa o jogo parado, sem desfoque (dá para pôr o close de um jogador, como o FC 24: item 95); o placar pequeno em cima à direita; tocar no campinho abre o Editar time; o Esc num submenu volta um passo; a fonte Inter do TM também fora do TM; sem animação ao abrir. **A decidir:** os botões da pausa no celular têm de 28 a 44 px de altura (o padrão da Apple é 44): (a) deixar (recomendado: é o que cabe sem tirar nada da lista), (b) 44 px só onde há lugar (item 99) ou (c) 44 px em todo celular, tirando um item da lista (por exemplo a Ajuda para dentro das Opções). Para conferir no seu celular: o entalhe e o polegar nas linhas mais baixas (testados só no navegador). Detalhes na FILA ("Depende do dono" 18).
18. 🏟️ Item 64 (a tela antes do jogo): feita com as escolhas recomendadas — a "Visão tática" mostra o time com e sem a bola, como no FC 25 (no FC 24 ela é assistir a partida como técnico: muda o jogo, seria outra entrega); no TM, "Simular partida" simulava pelo jogo 3D — no item 124 passou a ser o simulador do TM, lance a lance (dá para voltar ao jogo 3D, ou tirar a aba); o fundo é o estádio visto de fora (ou o jogo parado) atrás de um véu escuro; o árbitro tem nome inventado, a data é a do aparelho fora do TM e não há clima nem dificuldade até o item 33; cada jogador é uma ficha da carta do TM com um busto na cor da camisa (a foto vem no item 31); dá para ver o time adversário; nos Pênaltis e com o pré-jogo desligado há 1 toque a mais antes do jogo; Personalizar antes do jogo vale como escalação (não conta substituição); no online, sem Personalizar e sair antes do jogo é W.O.; não há opção para desligar a tela; nos treinos ela não aparece; as abas de 40 px no celular pequeno, como na pausa. **A decidir:** o fundo (a revisão achou nítido e poluído): (a) desfocar o 3D e escurecer mais as bordas (recomendado), (b) o estádio por dentro, vazio e escuro, ou (c) um fundo liso (item 102); a moldura das fichas mais fina, como no FC (gosto); a tela aparecer enquanto o jogo carrega (item 106; feita: ver o 28) e o Personalizar no online (item 107). Para conferir no seu celular: o entalhe, o toque nas abas de 40 px e o som ligando pelo botão do controle. Detalhes na FILA ("Depende do dono" 19).
19. 📋 Item 29 (a escalação do pré-jogo em pé): feita com as escolhas recomendadas — o campo inteiro em pé achatado como o da Globo (dá para usar a escala real, com as cartas das pontas em cima das laterais, ou só a metade do campo, como a Copa 2026); o nome de camisa em letra normal (em caixa alta, como na TV, alguns nomes de 10 letras do TM sairiam com "…" no celular pequeno); ao lado, a coluna do time como antes (dá para pôr os reservas e o técnico numa coluna à direita, ~2–3 h); o goleiro numa linha só dele; a posição a 11 px no celular, na letra da carta e mais apagada que o nome (no PC ela fica pequena: vale olhar). Da revisão: quando a carta da ponta não cabe dentro do campo (no celular pequeno e com nomes longos do TM), ela fica centrada em cima da linha lateral, meia carta para fora (a alternativa, a carta quase encostando na linha, parece desalinhada); enquanto a letra da carta não chega, o nome aparece numa letra do sistema reduzida, menor, mas sem "…" (dá para esperar a letra, atrasando a escalação). Para conferir no seu celular: a letra chegando pela rede e a letra reduzida no Android. Detalhes na FILA ("Depende do dono" 20).
20. 📸 Item 31 (a foto do autor na comemoração, #615): feito com as escolhas recomendadas — o cartão fica 3,5 s (2,6 s no gol do adversário) mesmo quando a câmera corta para o abraço, no canto de cima à direita (o único lugar que nunca tapa o autor no celular; no item 126 ele foi para baixo à direita e ficou menor: ver o 24); mostra também o escudo e a sigla, sem o minuto; aparece também no gol da IA contra você; a foto só na edição pro (nem a foto importada da carreira própria aparece na pública); as fotos de 220 px que o TM já tem (nada novo no repositório); sem foto nas cartas da escalação do pré-jogo (não cabe no celular: item 110); no online vale a edição de quem criou a sala; o crédito das fotos fica no TM. Da revisão: o nome aparece inteiro também no celular, maior que o número (que foi para junto da sigla); muitas fotos são de jogos por OUTRO clube — o pé da foto escurece até a cor do cartão, mas as listras logo abaixo do queixo ainda aparecem: dá para enquadrar foto a foto pelo rosto (~3 h, item 112); fora dos rostos reais, o boneco pode não parecer com a foto (a conferir no item 113). Para conferir no seu celular: a foto chegando pela rede e o cartão com o entalhe. Detalhes na FILA ("Depende do dono" 21).
21. ⏱️ Item 33 (o tempo de jogo e a dificuldade, #618): feito com as escolhas recomendadas — 3, 4, 5, 6, 8 ou 10 min por tempo, padrão 4 (dá para pôr 15 e 20, como o FC); dá para mudar no meio da partida, na pausa (o FC não deixa), menos no online; os 4 níveis do TM (Fácil ≈ Amador/Semi-Pro do FC, Normal = o jogo de hoje, Difícil ≈ Lendário, Lenda ≈ Ultimate, sem um 5º nível); a dificuldade só mexe na vontade, na decisão e na reação da IA adversária — nada de atributo, física ou alcance — e, no Fácil, a IA erra mais o chute; o Modo Livre e os Pênaltis ficam no Normal; a tela antes do jogo mostra o nível também no Normal; no TM a duração e a dificuldade vêm da Config, as Batalhas usam a delas travada, o online usa a duração de quem criou a sala; fora do TM o jogo lembra a sua escolha; o Lenda sem "jogar com o placar" (o Competitor Mode do FC). Da revisão: a dificuldade foi calibrada pelo PLACAR (antes os gols da IA quase não mudavam entre os níveis); no PC o item da pausa mostra "4 min · Normal" e no celular só "Normal"; voltar um valor é tocar no lado esquerdo do botão. **A decidir:** o Difícil e o Lenda quase empatam no placar — (a) deixar (recomendado: o Lenda já aperta mais e faz mais faltas) ou (b) separar o Lenda no ataque, ~3 h (item 116); ← e → mudando o valor no teclado e no controle (item 117); o TM dar pontos e recompensas pela dificuldade da partida 3D (item 118). Para conferir no seu celular: o toque no lado esquerdo do botão e o cadeado nas Batalhas. Detalhes na FILA ("Depende do dono" 22).
22. ⚔️ Item 35 (o clássico pegado, #619): feito com as escolhas recomendadas — vale só no clássico que o TM manda (fora do TM, só pelo link com `?classico=1`; sem botão na pausa); a IA dos dois times e os seus companheiros entram mais no bote e o jogador batido da IA segura mais quem escapa (a decisão do jogador; o árbitro e os cartões pelo mesmo critério); o seu jogador não muda. Da revisão: contra você o clássico é mais leve no bote (+12%) e mais no segurar (faltas da IA +23–31%, amarelos da IA +32%), para não virar a dificuldade de cima (a 1ª versão tirava 34% dos seus chutes; agora ~12%); seus companheiros não seguram (o amarelo e a suspensão seriam seus); na IA × IA (o Simular o resto) botes +47% e faltas +34–38%; o Lenda continua apertando mais que o Difícil no clássico. **A decidir:** a faixa das faltas (+25–50% ou a média real, +10–20%); o clássico mais forte contra você (vira dificuldade); os companheiros segurando também; o Normal e o Difícil quase empatam no bote com o clássico (o bote satura); o bote fisicamente mais forte (item 121: muda a falta por contato); o cartão sem falta (item 120, seria do árbitro); um botão "Clássico" na pausa fora do TM; a Config "Rivalidade" do TM desligando o clássico. Para conferir jogando: a sensação no seu celular. Detalhes na FILA ("Depende do dono" 23).
23. 🏟️ Item 124 (a tela antes do jogo no lugar da janela "Jogar em 3D / Simular", #620): feito com as escolhas recomendadas — a janela saiu de todo modo com o seu time (dá para deixá-la como 3ª opção na Config, "Perguntar"); "Simular partida" é o simulador do TM, lance a lance, com os titulares da tela (dá para simular pelo jogo 3D, como no item 64: aí a formação e a tática do Personalizar também valeriam); na Config, "Tela antes do jogo" ou "Sempre simular", e toda escolha antiga virou a tela uma vez (dá para respeitar o "Sempre simular" antigo); ficam fora do 3D o Online de salas e o Duelo ao vivo (o resultado é dividido com a outra pessoa), os pênaltis e a prorrogação do TM, o Rumo ao Estrelato no banco, o Palpite e a Base com menos de 11; o X do carregamento simula calado (a confirmação "Sair do 3D?" agora aparece por cima do 3D; antes ficava atrás e o X não fazia nada). Da revisão: o "Simular direto" da Partida rápida simula sem o 3D; em pé, o "Gire o celular" tem o "Simular partida"; só o "Jogar partida" liga o som. **A decidir:** o "Enfrentar" do Ultimate Online e a Copa Online continuam no 3D, como já estavam pela janela — (a) manter (recomendado: o adversário é a IA com o elenco da outra pessoa, como nas Rivais) ou (b) só simulados, ~0,5 h; a tela aparecer enquanto o jogo carrega (item 106) sobe de prioridade (recomendado): agora toda partida passa pelo carregamento do 3D, 5 a 13 s até a tela no Chromium sem GPU, também para quem só quer simular (o "Sempre simular" resolve para quem simula muito) — feita (item 106: ver o 28). Para conferir no seu celular: o tempo até a tela, o "Gire o celular" com o botão no app instalado e a confirmação do X no meio da tela. Detalhes na FILA ("Depende do dono" 24).
24. 🔤 Itens 125 e 126 (a letra nova, o campinho e o cartão do autor, #621): feitos com as escolhas recomendadas — a letra da carta do TM (a Barlow Condensed) nos títulos, números e nomes e a Inter no texto (dá para usar uma letra mais "videogame", a Saira, ou mais "editorial", a Sofia Sans); dois pesos (dá para pôr um 3º); tudo reto, sem itálico (dá para pôr o "GOL!" itálico); a lista da pausa em letra normal, como no FC 24 (dá para pôr tudo em MAIÚSCULAS); o campinho da pausa com 36% da largura no PC (dá 34% ou 37%); no celular, sem o nome do time em cima do campinho (+32% de campo); o placar do TM na letra nova (dá para voltar à Inter do item 32); o Editar time maior no PC (dá para manter o tamanho); os nomes da escalação do pré-jogo continuam em letra normal (em MAIÚSCULAS alguns nomes longos sairiam com "…" no celular pequeno). O cartão do autor: embaixo à direita no PC e no celular (dá para pôr embaixo à esquerda no PC, como a TV; no celular a esquerda tapa o autor em ~3 de cada 4 quadros); no celular, logo acima do "Pular", que fica no mesmo lugar do replay (dá para colar o cartão no canto e subir o "Pular", ou pôr o "Pular" em cima); a foto de 73 px no PC grande e de 47 no celular. Dá para fazer ainda: a letra nova nos números das camisas do 3D, os nomes da pausa sem "…" no celular pequeno e fontes mais leves. Para conferir no seu celular: a letra chegando pela rede, as letras pequenas e o cartão com o entalhe. Detalhes na FILA ("Depende do dono" 25).
25. 🔁 Item 30 (a cena de substituição no online, #622): feito com as escolhas recomendadas — vale a opção de quem criou a sala, nos dois aparelhos (dá para cada um usar a sua, ou levar a escolha pelo pedido do TM); cada um vê e pula só a sua cena e quem acaba antes espera o outro, com "ainda está vendo a cena" no aviso, sem o "Conexão instável" e sem W.O. (dá para o "Pular" valer só quando os dois pulam, ou o pulo de um pular para os dois); a troca que o outro faz abre a mesma cena no mesmo tick nos dois (dá para a cena aparecer só para quem trocou: o outro vê só a faixa e espera); o menu aberto não congela a cena nem a pula. **Decidido** (06/11, você: "corrige"): com o menu aberto no online a tecla também não pula mais o REPLAY nem a COMEMORAÇÃO — o mesmo tratamento da substituição (item 129, #630). Para conferir com duas pessoas: a espera quando um pula e o outro não. Detalhes na FILA ("Depende do dono" 26).
26. 🧍 Itens 62, 63 e 77 (a nuca, as bordas dos decalques e a mão do carrinho, #631): feitos com as escolhas recomendadas — a cabeça lisa, sem relevo (dá para fazer um relevo próprio da cabeça, com poros e cabelo, junto com o acabamento dos closes, item 49); a costura do meio da cabeça (uma linha de tom de leve, do alto do cabelo à gola, só no close de costas; já existia) fica para junto dos rostos novos (F1, ~2 h; dá para fazer um PR só para ela agora); os logos não encostam mais na borda: ficam do mesmo tamanho na camisa, mas 29 dos 161 perdem um pouco de nitidez de perto (o LUBRAX do Flamengo ~15% no close; de longe, igual) — dá para pôr máscaras maiores só nesses (o download da versão de teste cresce) ou refazer a partir dos logos originais; a mão de apoio no chão vale pela pose, também em quem cai sentado depois de um cabeceio (dá para deixar só no carrinho). Para conferir no seu celular (a prova que faltou): o túnel e a fila do pré-jogo na versão de teste sem os retângulos tracejados, a nuca de costas e se o jogo continua leve. Detalhes na FILA ("Depende do dono" 27).
27. 🚶 Item 61 (a passada natural, #632): feito com as escolhas recomendadas — só no túnel, na fila e nas cenas (no jogo a passada e a corrida continuam as de antes); cada um com a sua fase e o seu ritmo, um pouco diferente (dá para variar mais o ritmo, mas aí um terço dá passos curtos demais); o braço balançando ±11° contra a perna, como a pesquisa (dá para deixar mais solto, ±15–17°); no corpo novo o braço solto com a dobra do jogo também durante a partida (dá para deixar só no pré-jogo e nas cenas, ~1 h); o trio de arbitragem quase em linha, sozinho na frente das colunas; nos treinadores só o quadril e o tronco acompanham a perna (os braços continuam nas posturas deles). **A decidir:** o sobe e desce do quadril (~13 cm por passo; o real é 4–5 cm) e o calcanhar que não sobe no fim do passo — (a) esperar o mocap (recomendado: itens 50–52) ou (b) uma camada do pé no desenho, ~4–6 h. Para conferir no seu celular: o túnel e a fila com o corpo novo (a edição pro do TM) e com o boneco simples. Detalhes na FILA ("Depende do dono" 28).
28. 🏟️ Item 106 (a tela antes do jogo enquanto o estádio carrega, #635): feita com as escolhas recomendadas — a tela espera no máximo 0,3 s pelo que precisa (o código dela, as letras e os escudos) antes de o estádio começar a montar (dá para não esperar nada, mas às vezes ela apareceria sem a letra certa); enquanto carrega, um fundo escuro com o verde do TM vindo de baixo (dá para pôr a foto do estádio ou o escudo do mandante); já dá para ver a Visão tática, trocar o time mostrado, Personalizar, Simular e voltar; o Jogar e o ≡ esperam o estádio, com uma barrinha de carga dentro do botão e o aviso "O estádio ainda está carregando." no toque (dá para liberar no ≡ o que não mexe no estádio, como o som e a Ajuda); o X do TM sai assim que a tela aparece, menos em pé nos Pênaltis, no Livre e no online, onde a tela "Gire o celular" não tem botão (dá para pôr um botão de sair nela, ~1 h); o Simular aceita o 2º toque até 3 s depois de o "Toque de novo" aparecer; no controle, antes do estádio, só o Y, o X, o LB e o RB funcionam (o resto chega com o estádio; dá para fazer antes, ~1–2 h). **A decidir:** no navegador dos testes, sem placa de vídeo, o estádio (o Jogar) fica pronto 1–2 s mais tarde e a tela fica parada por até ~1,7 s em alguns momentos da carga (a tela e o estádio disputam o desenho) — (a) aceitar (recomendado: a tela chega ~1–3 s antes e o Simular já vale; no celular de verdade a conta é outra), (b) mostrar a tela um pouco mais tarde, depois do gramado e da torcida, ou (c) uma tela mais simples (o fundo, os escudos e o Simular) até o estádio. Para conferir no seu celular: o tempo até a tela e até o Jogar, o toque no Simular durante a carga e o app instalado em pé. Detalhes na FILA ("Depende do dono" 29).

---

## ✅ Entregue nesta rodada

- 🏟️ A tela antes do jogo aparece enquanto o estádio 3D carrega (~0,3 s depois de a página abrir, antes 3–4 s no navegador dos testes): já dá para Simular, ver a Visão tática e Personalizar; o Jogar mostra a carga e vale quando o estádio fica pronto; no TM o X sai logo e, no Simular, o 3D some na hora (item 106, #635)
- 🚶 A passada natural no túnel, na fila e nas cenas: cada um anda no seu passo e no seu ritmo, com o braço balançando contra a perna, o quadril e o ombro girando e a saída do parado em 3–5 passos; os árbitros sozinhos na frente das colunas; o cotovelo do corpo novo solto; no jogo a passada e a corrida não mudam (item 61, #632)
- 🧍 O acabamento do corpo: a nuca sem a linha escura (e o rosto sem as rugas), os números e patrocínios das camisas sem os retângulos tracejados em volta e a mão de apoio do carrinho no chão, no boneco simples e no corpo novo; só desenho, o jogo continua igual (itens 62, 63 e 77, #631)
- 🔁 O menu aberto no online não pula mais o replay nem a comemoração: a cena segue andando, as teclas são do menu (P e Esc fecham, H abre a Ajuda, Enter e o A do controle apertam o botão) e, com o menu fechado, um aperto novo pula como antes (item 129, #630)
- 🔁 A cena de substituição no online: a opção de quem criou a sala vale nos dois aparelhos, cada um vê e pula a sua cena e quem acaba antes espera o outro com "ainda está vendo a cena" no aviso, nunca "A conexão parou"; o jogo continua igual nos dois (item 30, #622)
- 🔤 A letra esportiva da carta do TM nos títulos, números e nomes de todas as telas do 3D, o campinho da pausa ~1,5× maior e mais caprichado (a formação dentro do campo, os nomes em maiúsculas, "você" em destaque) e o Editar time maior no PC, sem crescer o download do começo (item 125, #621)
- 📸 O cartão do autor do gol menor e no canto de baixo à direita: ~4× menor no PC e ~2× no celular, o nome inteiro também no celular pequeno, nunca em cima do autor (item 126, #621)
- 🏟️ A tela antes do jogo no lugar da janela "Jogar em 3D / Simular": o "Jogar" de todo modo com o seu time abre o estádio 3D na tela antes do jogo, onde dá para jogar ou simular lance a lance como sempre; na Config, "Sempre simular" pula o 3D (item 124, #620)
- ⚔️ O clássico mais pegado: no clássico do TM os jogadores da IA dos dois times entram mais no bote e o batido segura mais; o árbitro é o mesmo — contra você faltas da IA +23–31% sem virar dificuldade, na IA × IA faltas +34–38%; gols e chutes iguais (item 35, #619)
- ⏱️ O tempo de jogo (3 a 10 min por tempo) e a dificuldade (Fácil, Normal, Difícil, Lenda) na pausa, na tela antes do jogo e pela Config do TM; a dificuldade muda só a IA adversária, o Normal é o jogo de hoje (item 33, #618)
- 📸 A foto do autor do gol com o número e o nome na comemoração, no canto de cima à direita (a foto só na edição pro do TM; sem foto, o número e o nome numa linha), e a mesma foto no lugar do busto nas fichas da tela antes do jogo (item 31, #615)
- 📋 A escalação do pré-jogo com o campinho EM PÉ: o campo inteiro com o gol embaixo, o círculo redondo, o nome de camisa na letra da carta do TM e sem cortar, do celular pequeno ao PC e com nomes longos do TM (item 29, #614)
- 🏟️ A tela antes do jogo no nível da pré-partida do EA FC 24, com a cara do TM: os dois times e a hora, estádio · data · árbitro, o campinho com as 11 fichas, Jogar partida · Visão tática · Personalizar (+ Simular partida no TM), em todo jogo antes do pré-jogo; o "Jogar" liga o som (item 64, #613)
- ⏸️ A pausa igual à do FC 24: a lista à esquerda, as opções num submenu e o campinho do seu time no canto direito (item 58, #602)
- 🎯 A mira das bolas paradas minimalista, com a cara do TM: a linha fina branca, o anel onde a bola cai e o arco da curva junto da bola, sem painel nem texto; no celular a curva é arrastar o polegar no CHUTE ou no LANÇAMENTO (item 65, #601)
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
