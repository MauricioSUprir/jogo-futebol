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
| MDN — "Autoplay guide for media and Web Audio APIs", https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide | O AudioContext só começa num gesto: sem a abertura "Toque para começar", os 80 s do pré-jogo seriam mudos. O mesmo toque pede, no Android, a tela cheia deitada (`screen.orientation.lock`). |

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
