# Pré-jogo — pesquisa e decisões (pedido do dono de 11/10)

> "No pré-jogo, quero cenas de pré-jogo, com fora do estádio, aparecendo o estádio, jogadores entrando em campo, fazendo a
> fila, a câmera passando. No final das cenas pré-jogo, mostrando vários cuts de torcida e estádio pré-jogo, aparece a
> escalação dos dois times em um campinho: primeiro um time, aparece grande na tela, com o mesmo fundo, uns 10 seg, aí sai
> da tela, e entra a escalação do outro time, da mesma forma."

Tudo é DESENHO: o pré-jogo acontece antes do 1º passo da partida (o mundo fica no tick 0, o hash não muda e o apito da
saída só toca no fim dele). Módulos: `js/cortejo.js` e `js/prejogo-roteiro.js` (puros), `js/estadio-forma.js` (puro: os
sólidos e o lado de fora), `js/render/prejogo.js` (o diretor), `js/render/estadio-fora.js`, `js/prejogo-tela.js` e
`js/escalacao-tela.js` (DOM), `js/campinho.js` (o mesmo desenho do campinho do "Editar time"), `css/prejogo.css`.

## Fontes e o que foi aproveitado de cada uma

| Fonte | O que aproveitamos |
|---|---|
| SoccerGaming — "EA SPORTS FC 24 Matchday Experience Details" (deep dive da EA), https://soccergaming.com/fc-24-matchday-experience-details/ | As cenas do pré-jogo do FC 24 ("fans arriving at stadium", "stadium tunnels entrance", times entrando e se cumprimentando no campo) e o som da torcida que sobe quando a câmera chega perto: viraram os planos 2 (fachada e chegada), 4 (túnel) e 5 (entrada) e o som por plano (abafado de fora e no túnel, aberto por dentro). |
| GamingBolt — FC 24 deep dive (matchday), https://gamingbolt.com/ea-sports-fc-24-deep-dive-trailer-details-improvements-to-the-matchday-experience | Preparação passando por vestiário, cabine e túneis: o túnel é plano obrigatório (o vestiário fica fora: não temos o modelo). |
| SoccerGaming — "Team lineups might return in FC 24", https://soccergaming.com/team-lineups-might-return-in-fc-24/ e o fórum da EA ("Will team introductions return?", https://forums.ea.com/discussions/fc-24-general-discussion-en/will-team-introductions-return/7570773/replies/7570775) | A cena clássica das escalações saiu no FC 24 ("encurtamos as cenas de introdução") e os jogadores pediram a volta; a EA prometeu introduções novas no FC 25. É exatamente o pedido: a fila com a câmera passando e a escalação no campinho. |
| PlayStation Blog — FC 25 hands-on (https://blog.playstation.com/?p=395588) e God is a Geek — "EA Sports FC 25 presentation" (https://godisageek.com/2024/07/ea-sports-fc-25-presentation-a-look-at-the-big-changes/) | As "walkouts" voltaram às cenas do pré-jogo no FC 25 e a apresentação imita a TV das grandes ligas: planos com lente e movimentos de transmissão (drone, grua, steadicam, trilho), não de videogame. |
| wTVision — "Football Graphics Explained", https://www.wtvision.com/football-graphics-explained | "Lineup graphics present the starting players" e "formation graphics organize the players on a virtual pitch": a escalação é o campinho com a formação e, em cada carta, número, nome e posição de cada titular. Sem reservas nem técnico: menos coisa na tela (o dono pediu cada time grande). |
| Jersey FA — orientação do cumprimento antes do jogo, https://jerseyfa.com/news/2020/mar/11/coronavirus---pre-match-handshake-guidance ; NECSL — "Pre-Game Sportsmanship Statement & Procedure", https://www.thenecsl.com/sportsmanship-statement.html ; Premier League (protocolo de entrada, 2020: os times continuam fazendo a fila com a música; https://premierleague.com/news/1636646) | Os times entram juntos com a arbitragem e fazem a fila no meio-campo, "um time de cada lado dos árbitros", de frente para o público: a fila em z = 3,2 m, árbitros no meio (0 e ±0,85 m), mandante à esquerda da TV, de frente para a tribuna (rumo π/2). O aperto de mão ficou de fora (precisa de animação de braço que o manequim não tem). |
| Premier League — "BCD guide: What will be different on TV?", https://www.premierleague.com/news/1682755 | Câmeras fixas no túnel mostram os jogadores antes de entrar: o plano 4 é uma câmera parada no fundo do túnel, atrás das duas colunas, que só empurra de leve, olhando a luz do campo. |
| "Preferred walking speed" (Wikipedia, com Ralston 1958 e Bohannon), https://en.wikipedia.org/wiki/Preferred_walking_speed | Andar preferido de 1,10–1,65 m/s (~1,25 m/s em laboratório); a entrada em campo é uma caminhada de cerimônia: 1,45 m/s no cortejo, que cabe na faixa e deixa a passada da locomoção do jogo (`jogador.js`) com os pés plantados. |
| three.js docs — `CatmullRomCurve3` (https://threejs.org/docs/pages/CatmullRomCurve3.html) | Trilhos Catmull–Rom do tipo **centrípeto** (sem laços nem bicos com pontos irregulares) e percorridos pelo **comprimento do arco** (`getPointAt`: velocidade constante no trilho) com suavização por plano. Implementado puro em `prejogo-roteiro.js` (a mesma conta não uniforme da three.js) para o teste dos trilhos rodar em Node com a MESMA curva que a página desenha. |
| three.js docs — `BokehPass` e o fórum (tag bokeh) | Profundidade de campo é mais uma renderização da tela inteira e tem relatos de piscar no iOS: sem DOF no celular; o fundo "desfocado" vem da lente longa (fov 28–34) e, na escalação, do degradê escuro sobre o 3D vivo. |
| MDN — "Autoplay guide for media and Web Audio APIs", https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide | O AudioContext só começa num gesto: sem a abertura "Toque para começar", os 80 s do pré-jogo seriam mudos. O mesmo toque pede, no Android, a tela cheia deitada (`screen.orientation.lock`). Desde o item 64 (04/11) esse gesto é o "Jogar partida" da tela antes do jogo (§8); a abertura de texto só aparece sem a tela. |

## 1. Roteiro (prejogo-roteiro.js)

Completo, ~81,6 s: 60,5 s de cenas + 2 × 10,55 s de escalação (0,55 s entrando + 10 s inteira na tela).

| # | Plano | s | Câmera | Cortejo | Som |
|---|---|---|---|---|---|
| 1 | Aéreo de fora | 7 | drone em órbita (raio 300 → 235 m, 135 → 92 m de altura, fov 38), saindo do preto | — | abafado (600 Hz), baixo |
| 2 | Fachada e chegada | 5 | grua na praça, do chão até a placa "ESTÁDIO GOLAÇO", com a torcida chegando | — | abafado (800 Hz) |
| 3 | O estádio cheio por dentro | 5 | mergulho ao preto e o alto da tribuna, debaixo da cobertura (o anel inteiro, o mosaico, a organizada) | — | aberto, canto |
| 4 | Túnel | 6 | parada no fundo do túnel, atrás das colunas, olhando a luz do campo | ao vivo, 0–6 s | 900 → 2400 Hz |
| 5 | Entrada em campo | 6 | steadicam de ré 5 m à frente dos árbitros, com a tribuna atrás | ao vivo, 6–12 s | palmas, sinalizadores e bandeirão |
| 6 | Plano alto | 5,5 | do alto do lado de lá (fov 24): as colunas viram e a fila se forma | foto aos 31 s | aberto |
| 7a/7b | A fila com a câmera passando | 8 + 8 | trilho a 4,6 m da fila, 1,6 m de altura, 11,3 m a ~1,4 m/s, fov 38 (das canelas para cima, com as faixas de cinema) | fila montada, "respirando" | aberto |
| 8a–d | Cortes de torcida e estádio | 4 × 2,5 | organizada (bandeirão e sinalizadores), arquibancada de lá de perto, setor visitante, o estádio do alto da tribuna | fila | aberto |
| 9/10 | Escalação do mandante / do visitante | 10,55 + 10,55 | o MESMO fundo: órbita lenta dentro do estádio (raio 58 m, 24 m, 1,2°/s), contínua de uma para a outra | fila | um pouco mais baixo |

Curto (~41 s): 3, 7a e 7b com 5 s, 8a e 8d e as duas escalações. Só escalação: ~21 s. Ordem das escalações: mandante (o
time do humano) primeiro, como na súmula e na TV.

## 2. Cortejo (cortejo.js)

22 titulares e 3 árbitros num mundo à parte, só com `passoCorpo`, `passoPassada`, `passoPeDesenhado` e `alturaQuadril`
(o mesmo passo do `sim.js`). Árbitros na frente no meio do túnel; as duas colunas lado a lado (x = ±1,2 m), o capitão na
frente (o de linha de maior nível) e o goleiro em 2º; parados a 0,9 m um do outro no túnel (a coluna de 11 cabe nos 12 m
dele: o último a 1,1 m do fundo) e cada um sai um pouco depois do da frente, até 1,55 m andando; no meio-campo cada
coluna vira para o seu lado e o 1º vai mais longe — cada um para 1,05 m antes do da frente (ninguém passa por cima de
quem já parou); a ponta de dentro fica a 2,0 m do meio, ao lado do assistente. Na vaga o corpo vira para a tribuna. O
goleiro anda com `posicao 'MEI'` (com 'GOL' a pose põe as mãos "prontas" à frente da cintura). Medido
(`teste-cortejo`): pé plantado 0 m/s, pé que salta razão 0,90, corpos a ≥ 0,85 m, vaga 4 cm, rumo 0°, último na fila aos
42,4 s, 0,14 ms por passo dos 25 no Node, hash da partida igual.

## 3. Lado de fora (estadio-forma.js + render/estadio-fora.js)

A câmera de TV do jogo fica DENTRO da arquibancada do lado de cá: cobertura e fachada só existem no pré-jogo (criadas no
começo, descartadas no fim; `teste-prejogo` item 8: geometrias e texturas iguais às do jogo sem pré-jogo). Fachada em
volta de tudo (±93 × ±79 m, cantos de 12 m — com 24 m as quinas dos fundos furavam a fachada —, 27,6 m: brises, faixa de
LED verde, portões acesos à noite), placa fictícia "ESTÁDIO GOLAÇO", cobertura em anel (sobe para o campo, 27,6 → 30 m),
cantos do lado de cá fechados com degrau e cadeiras vazias, o túnel por dentro (paredes claras, luzes no teto e a faixa
verde: o túnel iluminado explica os jogadores claros lá dentro), esplanada (praça, estacionamentos com as vagas, gramados;
descartada por shader dentro da fachada), bairro (ruas por textura alinhadas aos prédios), 576 prédios (caixas
instanciadas, janelas no shader, acesas por sorteio à noite), 149 árvores, 511 carros e 1137 torcedores chegando (o MESMO
material e atlas da torcida, em pé). Texturas desenhadas por código (nada a baixar). Baixa: sem prédios, árvores, carros
e torcedores. Medido no celular (844×390, Média, `teste-prejogo` item 7): pior plano 35 chamadas e 122 mil triângulos
(meta ≤ 40 e ≤ 130 mil; o jogo tem 26–28 chamadas e 82–98 mil).

## 4. Trilhos fora dos sólidos

`estadio-forma.js solidoEm(x, y, z, folga)` descreve arquibancadas (a massa debaixo do degrau), paredes, marquise, teto de
cá, fundos, placas, gols, bancos, refletores e, de fora, fachada, cobertura, cantos, árvores e prédios; o corredor do
túnel é livre. `teste-prejogo-roteiro` confere 50 pontos de cada plano dos 3 modos e da abertura com 0,5 m de folga, a
inclinação (−60…+20°: olhar para cima a fachada e a arquibancada é natural), o fov e o tranco (≤ 8 m/s dentro, ≤ 45 m/s
no drone). O teste pegou 3 erros na 1ª versão (a câmera do túnel a 0,4 m do fundo, a grua olhando 17° para cima, a
panorâmica da arquibancada de lá a 11 m/s).

## 4b. O vão das placas na frente do túnel (contraprova)

A 1ª versão fazia as duas colunas e os árbitros atravessarem as placas de LED do lado de cá (z = 40, inteiras de ponta a
ponta) nos planos do túnel e da entrada em campo — bem no meio do quadro da steadicam. Nos estádios as placas abrem na
saída do túnel; aqui o vão (±3 m, `FORA.vaoPlacas`) só existe no pré-jogo: no jogo a bola bate nas placas (`bola.js`) e
um vão de verdade mudaria a simulação (ou a bola quicaria no nada). O diretor recorta as duas malhas das placas com os
planos de recorte da three.js (docs `Material.clippingPlanes`/`clipIntersection` e `WebGLRenderer.localClippingEnabled`:
some só o que está dentro dos três planos) e fecha as pontas com dois arremates escuros; no fim do pré-jogo tudo volta.
Medido: `teste-cortejo` "ninguém atravessa o estádio" 659 contatos com as placas → 0; `teste-prejogo` itens 9 (aberto no
pré-jogo, 2/2 malhas recortadas) e o vão fechado no jogo (0/2, recorte local desligado).

## 5. Pular e preferências

(Com a tela antes do jogo do item 64 ligada, o pré-jogo começa pelo "Jogar partida" dela; o resto desta seção vale igual — §8.)
Toque/clique, Enter, Espaço ou A: próximo BLOCO (cenas → escalação 1 → escalação 2 → jogo). Botão Pular (ícone + palavra,
≥ 48 px; some parado e volta com qualquer toque), Esc/P ou Start: direto para o jogo. Pausa → "Modo de jogo" → "Pré-jogo da partida":
cada toque passa para o próximo (completo → curto → só escalação → desligado; salvo). Na 1ª versão era uma linha a mais
nas opções da pausa e a pausa passou a rolar 41 px no celular deitado (ela cabia inteira: "nada sobre nada"); no
submenu "Modo de jogo" cabe sem rolar (`teste-prejogo` item 13). "Reiniciar partida" no meio do jogo toca só a escalação; "Jogar de novo" e a volta de
um treino para a partida tocam a preferência. `?prejogo=0|1|curto|escalacao` força. DESLIGADO por padrão com
`navigator.webdriver`, `?prints=1` e `?demo=1` (os testes e prints que já existem abrem direto no jogo, como antes).
Celular em pé no meio do pré-jogo: a tela de girar cobre, o tempo não anda, o toque não avança e a torcida abaixa e abafa
como na pausa do jogo (a 1ª versão mantinha o som do plano por cima da pausa); deitado de novo, continua de onde estava.
Aba escondida: o tempo não anda e, de volta, o 1º quadro avança um passo só (nada de pular os segundos escondidos). No
"Reiniciar partida" (só a escalação) e no curto o lado de fora vem sem o entorno (esplanada, bairro, prédios, carros,
torcedores nunca entram no quadro): 6 peças em vez de 12.

## 6. Medidas (antes → depois)

| Medida | Antes (main) | Depois | Meta |
|---|---|---|---|
| Cenas antes da saída de bola | 0 (abre na saída; apito no carregamento) | 12 planos, 60,5 s (curto 20 s) | ≥ 11 planos, 50–65 s |
| Escalações no campinho | não havia | mandante 10,0 s e visitante 10,0 s inteiras na tela, o mesmo fundo | 10 ± 0,2 s cada |
| Nada encosta na escalação (568×320 a 1920×1080) | — | folga mín. 10 px, letra ≥ 10 px, 0 fora, 0 cortado, Pular sem encostar | ≥ 6 px, ≥ 10 px |
| Escalação em pé (item 29; §9): 11 telas do PC, o celular e `?tm` com nomes longos | deitada (L/A 1,30–1,68), o GOL à esquerda | em pé (L/A 0,80–0,85), o GOL embaixo, o círculo redondo, a letra do §7.4/§7.5, a tinta do nome inteira, TM Cond | E1–E11 do `teste-prejogo` 4b/15 |
| Cortejo: pé plantado / pé que salta / corpos | — | 0 m/s / razão 0,90 / ≥ 0,85 m | ≤ 0,05 / ≤ 1 / ≥ 0,6 m |
| Fila: vaga / rumo / último parado | — | 4 cm / 0° / 42,4 s | ≤ 10 cm / ≤ 5° / ≤ 50 s |
| Trilhos dentro de sólidos (3 modos + abertura, 1200 pontos) | — | 0 | 0 |
| Celular Média: pior plano | jogo 26–28 chamadas, 82–98 mil tri | 35 chamadas, 122 mil tri | ≤ 40, ≤ 130 mil |
| CPU por quadro no celular simulado (CPU 4×, sem o desenho) | jogo: meta do teste-desempenho-celular | p95 0,3–4,4 ms por trecho (média 0,1–1,5 ms) | p95 ≤ 6 ms |
| Memória depois do pré-jogo (geometrias / texturas) | 30 / 15 | 30 / 15 | iguais |
| Hash da partida depois do pré-jogo; treino e partida bit a bit | — | `criarPartida` igual; 600 passos Node = Chromium; `hash-igual` e `hash-partida` IGUAL | iguais |
| Download | ~3,18 MB | 3,29 MB (`teste-carga`: +114 KB de JS/CSS; as texturas são desenhadas por código) | ≤ 4 MB |

## 7. Pendências (para depois)

- Rostos: os closes ficam a 4,6 m (o manequim não tem rosto até a Etapa 5); depois dos rostos o trilho da fila pode chegar
  a 3 m.
- Aperto de mão, mascotes e o hino: precisam de animação de braço (mocap da Etapa 5).
- A cobertura e a fachada só no pré-jogo (a TV do jogo fica dentro da arquibancada de cá); se um dia a câmera de jogo sair
  dali, elas podem ficar no jogo (o plano geral do intervalo atravessaria a cobertura: CAMERA_GERAL [0, 34, 78]).

## 8. Desde o item 64 (04/11): a tela antes do jogo vem antes do pré-jogo

O dono pediu (23/10, com o print da pré-partida do EA FC) uma tela de entrada "nesse nível" com a cara do TM; a pesquisa, as
fontes e as medidas estão no `PESQUISA-ESTADIO.md` §7.5 e o contrato em "Tela antes do jogo (item 64)" no `CONTRATOS.md`. O que
muda AQUI:
- **A abertura deixa de ser o gesto** quando a tela está ligada: ela continua montada (o aéreo de fora, o som abafado) como o
  FUNDO da tela, mas CALADA (`prejogo-tela.mudo(true)`: o toque, o Enter/Espaço e o Ⓐ não agem). O "Jogar partida" da tela é o
  gesto que libera o som (a mesma regra do MDN acima) e chama `prejogo.comecar()`; daí em diante o pré-jogo é o de sempre (os
  mesmos blocos, o Pular, o "Pré-jogo da partida"). A escolha do "Pré-jogo da partida" feita pelo ≡ da tela vale no Jogar.
- **Sem a tela** (webdriver, `?prints=1`, `?demo=1`, `?prepartida=0`, ou o módulo dela sem chegar em 1,5 s) a abertura "Toque para
  começar" volta a ser o gesto, como antes: o `teste-prejogo` e os prints continuam iguais.
- **O Ⓐ do Jogar** ainda segurado no quadro seguinte contava como um aperto NOVO para a camada do pré-jogo e pulava o bloco das
  cenas (~60 s): a camada passou a ler o Ⓐ sempre e a ignorar o que já estava apertado quando volta a ouvir (revisão A1).
- **O Personalizar antes do jogo** recria o mundo do tick 0 com a escalação nova; o diretor refaz o cortejo, os treinadores, as
  fotos e as escalações (`refazerTimes`) sem remontar o lado de fora — o reserva escalado sai do túnel e aparece na escalação.
- **Toques até o jogo** na partida com o pré-jogo: 2, como antes (Jogar + Pular no lugar de toque para começar + Pular).

## 9. A escalação em pé (item 29, 05/11)

Pedido do dono (17/10): "o campinho da escalação do jogo EM PÉ (retrato), não deitado". Antes, o `escalacao-tela.js` decidia
`vertical = W/H < 0,95` pela ÁREA do campinho (a tela menos a coluna do time), sempre deitada no celular e no PC: o campo saía
deitado com o gol à esquerda em todas as telas (só a janela de PC em pé virava). O nó era a LARGURA: em pé, as 5 filas ficam na
altura (a carta com a altura de antes) e 5 cartas lado a lado têm de caber numa caixa mais estreita que alta — com a letra do
sistema (a DejaVu dos testes, larga) não cabia no celular; com a TM Cond (a letra das fichas da tela antes do jogo) cabe.

**Fontes e o que foi aproveitado de cada uma:**

| fonte | aproveitado |
|---|---|
| Globo 2025, Brasileirão (o pacote do Premiere) | o gol embaixo; o campo INTEIRO plano achatado a L/A 0,80; os jogadores das pontas ~9% para dentro das laterais. A caixa alta dos nomes ficou de fora (escolha do dono, abaixo) |
| Football Manager 26 (a tela da tática) | as marcas no tamanho real e só a distância entre as laterais esticada (o círculo redondo; o FM estica ~1,45×, aqui 1,24–1,31×) |
| Copa 2026 (FIFA) | o gol embaixo e a escalação de UM time em pé ao lado da coluna. A metade do campo ficou como alternativa (não é retrato) |
| Premier League 2023/24–2025/26 | a ordem goleiro → defesa → meio → ataque (a cascata das cartas sobe do gol ao ataque); o campo deitado é o gráfico dos DOIS times, o de um time é em pé |
| EA FC 26 (Team Management), FC Mobile 26/27, FC 27 (pacote Bundesliga e "MUN") | o goleiro embaixo é a regra dos jogos; a coluna à esquerda + o campo em pé é o nosso modelo |
| LFU 2025 (Prime Video, Record, CazéTV) | contraexemplo: o goleiro EM CIMA; ficamos com a Globo, a Copa e os jogos |
| PESQUISA-ESTADIO §7.4/§7.5 (Apple HIG, Material, WCAG, XAG, Valve) | a letra: nome ≥ 10 px em 568×320 e ≥ 11 nos outros celulares, informação ≥ 11, PC ≥ 13 |
| A ficha do item 64 (`prepartida.js`) | a TM Cond 800 e a tabela de avanços (a conta não espera a fonte) |

**Decisões** (as recomendadas da especificação; o dono pode trocar):
- O campo inteiro em pé a L/A 0,80, alargando até 0,85 quando o nome mais largo pede; as cartas das pontas ~9% para dentro das
  laterais e, no aperto, sobre a linha (no máximo meia carta para fora). Alternativas: a escala real 0,648 com as pontas sobre as
  laterais; a metade do campo (Copa 2026; cartas maiores, mas o desenho fica deitado, L/A 1,3); as cartas sempre dentro das
  laterais (com camisas de 10 letras do TM em 568×320 a caixa passa de quadrada: não cabe).
- O nome de camisa em TM Cond 800, caixa NORMAL (a caixa alta da Globo/Copa custa ~14% de largura: com camisas de 10 letras do
  TM, 4 nomes sairiam com "…" em 568×320). O número e a posição na letra de antes.
- Ao lado do campo, a coluna de antes (escudo com `?tm`, a faixa, "Escalação", o nome e a formação; sem técnico nem reservas),
  agora do tamanho do conteúdo (até 34vw) e centrada junto com o campo. O goleiro numa fila própria.
- A posição sobe de 10 para 11 px nos celulares a partir de 350 px de altura (568×320 continua com 10); o nome com entrelinha
  1,25 (os traços de baixo de g, y, ç saíam cortados).
- **A largura do nome na tela** (achado na implementação): o Chromium sem posição subpixel do texto (Linux, o CI) arredonda o
  avanço de cada letra ao px — "Mmmmmmmmmm" a 14,44 px dá 97,1 px pela tabela e 98 na tela, e saía com "…" numa carta de 106
  px. A conta usa a maior entre a tabela exata e a dos avanços arredondados (`letra-cond.js larguraCondInteira`), e o teste
  confere o corte também por fração de px (a largura do texto no canvas × a caixa).
- A janela de PC em pé: a coluna em cima e o campo embaixo; se a largura não dá, a altura desce e, se o nome mais largo segurar
  a carta, a letra e as cartas pela largura.

**Antes → depois** (o `teste-prejogo --so-esc` e o `mapa/medir-escalacao.mjs`; elenco fictício, as duas folhas iguais):

| tela | antes: o campo (L/A) | depois: o campo (L/A) | carta antes → depois | nome / posição (px) antes → depois |
|---|---|---|---|---|
| 844×390 | 578×364 (1,59), o GOL à esquerda | 291×364 (0,80), o GOL embaixo | 105×62 → 50×62 | 11,8 / 10 → 11,8 / 11 |
| 844×390 com entalhe | 508×343 (1,48) | 275×343 (0,80) | 91×58 → 47×58 | 11,0 / 10 → 11,0 / 11 |
| 667×375 | 457×350 (1,31) | 280×350 (0,80) | 81×59 → 47×59 | 11,2 / 10 → 11,2 / 11 |
| 640×360 | 438×336 (1,30) | 275×336 (0,82) | 77×56 → 47×56 | 10,6 / 10 → 11 / 11 |
| 568×320 | 394×298 (1,32) | 253×298 (0,85) | 68×49 → 43×49 | 10 / 10 → 10 / 10 |
| 1280×720 | 877×604 (1,45) | 541×671 (0,81) | 120×76 → 100×76 | 14,4 / 11,4 (igual) |
| 1366×600 | 937×559 (1,68) | 448×559 (0,80) | 120×76 → 81×76 | igual |
| 1440×900 (16:10) | 992×683 (1,45) | 672×840 (0,80) | 120×76 (igual) | igual |
| 1024×768 (4:3) | 701×483 (1,45) | 577×716 (0,81) | 120×76 → 107×76 | igual |
| 1920×1080 | 1352×931 (1,45) | 816×1020 (0,80) | 120×76 (igual) | igual |
| 800×1000 (janela de PC em pé) | 752×830 (0,91; o círculo achatado, 1,40) | 665×830 (0,80; o círculo redondo) | 120×76 (igual) | igual |
| `?tm`, nomes longos | deitado; 3 nomes de estresse cortados | 568×320 253×298, 640×360 285×336, 844×390 com entalhe 291×343 (0,85), 1366×600 475×559 (0,85), 1920×1080 816×1020 | celular 53–62, PC 107–120 | celular: só os 3 de estresse com "…"; PC: nenhum |

A tinta do nome (os traços de baixo de g, y, ç) saía da caixa em 11 das 16 telas medidas na base; agora em nenhuma. A
letra do nome em TM Cond em todas (antes, a do sistema). Os tempos não mudaram (cada escalação inteira 9,95 e 10,0 s; as duas
juntas 0,55 s); o plano da escalação no celular Média: 31 chamadas e 128 mil triângulos (o 3D; a mudança é só DOM). Download
inicial +14 KB (o `escalacao-tela.js` com a conta e os comentários, o `letra-cond.js`, o `@font-face` no `prejogo.css`; folga
720 → 706 KB). As 5 mutações da especificação (a escalação da base, a carta sem o nome, a entrelinha 1, o nome sem a TM Cond e o
campinho sem a largura) reprovam o 4b ou o `teste-escalacao-campo`.

**Riscos que ficam:** antes de a TM Cond chegar, a letra de reserva (mais larga) pode pôr "…" nos primeiros quadros, sobretudo no
modo "só a escalação" (o `montar` pede a fonte com o texto dos nomes; a cascata só começa em 0,12 s; `font-display: swap`); a
coluna do tamanho do conteúdo muda o x do campo entre as duas folhas (até ~30 px, durante o deslize); as cartas ficam mais
estreitas que as deitadas (celular 68–105 → 43–62 px, PC 120 → 81–120), com as letras iguais ou maiores.

### 9.1 A revisão (05/11): as pontas, as duas folhas e o acabamento

Os achados confirmados da revisão do item 29 (um commit cada; o teste que reprova antes em cada um):
- **As pontas nunca tangentes à lateral (V1).** A conta do "~9% para dentro" copiou da Globo o CENTRO da carta, mas lá o quadrado
  tem 7% da largura do campo (36/520) e a nossa carta 17% (50/291): a borda caía a 0–1,7 px da lateral em todas as telas (568×320:
  1 px para fora) e as 11 cartas coincidiam com a moldura. Agora o campo alarga (0,80 → até 0,85, o teto: 105 × 0,85 = 89,25 m,
  a largura máxima da Regra 1) até a borda da carta da ponta ficar 6 px para dentro (`ESCALACAO.margem`; mínimo 5) e, quando nem o
  teto dá, a carta fica SOBRE a linha, centrada nela (inset 0) — nunca no meio do caminho. 568×320 do fictício: a folha do
  mandante sobre a linha (a carta de 43 px não cabe com margem nem a 0,85), a do visitante dentro; com os nomes do TM nos
  celulares, sobre a linha. `teste-prejogo` E12 e `teste-escalacao-campo` N1.
- **A mesma caixa nas duas folhas, as cartas de cada uma pelos nomes dela (A1, V2).** A coluna é do tamanho do nome do time e
  cada folha media só a dela: com nomes de larguras diferentes (PC 1280×1024, um nome de ~22+ letras) os campos saíam com
  tamanho e topo diferentes (771×964 topo 30 × 742×928 topo 48). E a carta dos 22 nomes ia também ao time de nomes curtos (as
  pontas dele até meia carta para fora sem precisar). Agora `tamanhosDasFolhas`: a largura do grupo pela coluna MAIS LARGA das
  duas (a escondida medida sem aparecer), a altura pela conta dos 22 e a menor das áreas, a largura do campo pela maior das duas
  folhas; a carta, a letra e o inset de cada folha pelos 11 nomes dela. O pedido misto novo (`PED_NOMES_MISTOS`: "Rio Azul" de
  camisas curtas × "Sociedade Esportiva…" de camisas longas) no `teste-prejogo` 15 e no N5.
- **As linhas recortadas pelo canto (A2, V3):** `clip-path: inset(0 round 11px)` (13 com `?tm`) só no SVG; os cantos vivos do
  retângulo de 0,5 m furavam a curva da borda depois que o campo passou a `overflow: visible`. E4.
- **A posição mais leve que o nome (V4):** a mesma TM Cond, 0,02 em, opacidade 0,78 (o FC Mobile 26 e o FC 26 põem a posição
  pequena e apagada; Globo e Copa nem a mostram). E11.
- **A reserva da TM Cond (V5):** faces `local()` com `size-adjust` no mínimo da razão TM Cond ÷ reserva medida no Chromium nos
  nomes do elenco e do TM (Arial/Liberation/Helvetica/Roboto/FreeSans 71%, razão 0,72–0,82; DejaVu 62%, 0,63–0,74) — a técnica
  do `size-adjust` para a fonte de reserva (CSS Fonts 5). Com o arquivo bloqueado, 568×320: 10 de 22 nomes com "…" → 0. A letra
  de reserva sai menor que a TM Cond (só enquanto ela não chega, ou se falhar). `teste-prejogo` 15.
- **O nome longo do time (V6):** acima de 22 letras (só nomes do TM) clamp(18 px, 2,2vw, 30 px) em até 3 linhas (antes 4–5
  linhas a 27–46 px, mais pesado que o campo). E13.
- **A faixa da carta com `?tm` (V7):** o atalho `border-color` do `tm.css` apagava a cor do time no topo. E14.
- Fora do item, baratos: a sigla de letras largas no escudo de reserva (V9: "AAW" a 30 encostava no contorno; a letra desce pela
  largura na DejaVu Sans Bold, `teste-identidade` G) e o comentário da pausa no `index.html` que fechava antes da hora (V10: o
  `") -->"` solto no canto da tela; `teste-carga`).
- Ficou de fora: o corte do nome de camisa em 10 letras sem marca do `tm-times.js camisaDe` (V8: "Evangelista" → "Evangelist";
  muda o nome da camisa em todo o jogo do TM — fica para quem mexer na ponte).
