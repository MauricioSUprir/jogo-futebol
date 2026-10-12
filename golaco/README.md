# GOLAÇO — futebol 3D no navegador (projeto novo)

Jogo de futebol 11×11 em 3D para PC e celular, feito do zero, publicado pelo GitHub Pages em
`/golaco/`. Times, jogadores, estádios, marcas e anúncios são **fictícios**.

O jogo tem que ser gostoso de jogar antes de ser bonito: **controle de bola, passe e tática
primeiro**. Cada etapa só termina com as metas medidas por teste automático.

## Etapa 1 — base e controle de bola

- Campo oficial 105 × 68 m (IFAB), gols com rede, bola com física (arrasto com crise do
  arrasto, efeito Magnus, quique e rolagem na grama calibrados por ensaios FIFA; colisão contínua
  com traves, redes e placas).
- Condução **sem ímã**: entre os toques a bola rola com física de verdade; cada toque calcula a
  velocidade exata para a bola chegar onde o pé vai estar no próximo toque, na passada.
- Corte, giro de 180°, puxada de sola, condução curta, pedalada, domínio orientado e proteção.

## Pedido de 10/10 — o jogador nunca sai da bola, controle de bola e goleiro que pula e espalma

- **Recepção que nunca sai da bola**: com a bola vindo para o seu jogador (passe para ele ou bola livre que passa
  perto e é dele — nem do companheiro nem do adversário que chega antes), o corpo vai ao encontro dela — o analógico
  decide para onde vai o **1º toque** (±20°) e abre o corpo para aquele lado; nada do analógico o afasta da bola.
  Embalado, ele corta freando para a linha da bola, e o 1º toque sai para o lado pedido só até onde o corpo
  acompanha (90° a 4,5 m/s, ~45° a 7 m/s). Analógico solto: recebe de frente, como antes. Chute indo para o gol não
  puxa o seu jogador para a frente dele. A IA não muda.
- **Controle de bola por atributo**: o bom (controle acima de 70) domina mais limpo; o fraco (abaixo de 55) espirra
  mais a bola forte; na faixa dos titulares (59–70) é a conta de antes.
- **Goleiro que pula e espalma**: mergulho desenhado (sai do chão, corpo estendido, a mão chega à bola no contato,
  cai de lado e levanta), salto para a bola alta perto do corpo e na cavadinha por cima dele, defesa em pé curvando
  o tronco sobre a bola baixa, mãos prontas à frente da cintura; mergulha ao longo da linha do gol, nunca para dentro
  dele, com o corpo no máximo a ~4,6 m/s; no rebote começa de onde está (no chão, só alcança o que dá dali); a defesa
  que o corpo desenhado não alcança vira gol. A espalmada sai forte e para fora (trave, linha de fundo ou por cima do
  travessão), nunca de volta para a área — e não volta para as mãos dele logo depois (antes metade das espalmadas
  virava encaixe). Chute desviado num corpo: o goleiro relê (e muitas vezes é enganado) — a
  bola nunca "vai parar" nas mãos de longe. Com a bola na mão, as palmas ficam dos dois lados dela; a bola pega
  solta chega às mãos sem salto.
- Pesquisa e números: `PESQUISA-RECEPCAO-GOLEIRO.md`.

## Etapa 3 — partida 11×11, tática, IA e "Editar time"

- A página abre na **partida 11×11** (Golaço FC × Ventania FC, elencos fictícios de 23): 2 tempos curtos
  (o relógio mostra 0'–90'), intervalo com troca de lado, saída de bola, lateral, escanteio e tiro de meta
  (simplificados; a regra completa é da Etapa 4). Na bola parada quem está no raio sai andando (a parede é
  pela locomoção: nada de pé arrastado). Os treinos continuam no menu "Modo de jogo".
- **Editar time** na pausa: formação (6), escalação no campinho com as reservas (troca por dois toques),
  substituição na próxima parada (5 em 3 paradas, IFAB) e táticas (mentalidade, pressão, largura, linha),
  com a prévia pela mesma conta da IA.
- IA por formação e tática (bloco, linha, pressão, contrapressão; apoios, corredores, corridas nas costas,
  ataque à área) e troca automática para quem disputa a bola alta.
- Defesa do humano: **CONTER** (segurar: acompanha o condutor entre a bola e o gol, de frente para ele),
  **DIVIDIDA** (bote em pé) e **PRESSÃO** (segurar: um companheiro aperta o condutor).
- Pesquisa e números: `PESQUISA-ETAPA3.md`.
- **IA mais intensa** (pedido do dono, 10/10: "o jogo tem que ser MAIS INTENSO, a IA não corre para trás"): na perda da
  bola, quem ficou à frente dela volta **em disparada** para trás da linha da bola, pelo lado do gol (recomposição), e os
  mais perto apertam por 4 s (contrapressão; 7 s na pressão Alta) — vale para a IA adversária e para os companheiros do
  humano; o meio fica atrás da bola no próprio campo, a cobertura da linha de defesa cobre de lado, toda bola solta é
  disputada em disparada e quem volta contorna o condutor. Medido no `teste-transicao` (ver PESQUISA-ETAPA3.md §16).
- Tela limpa (dono, 10/10): **sem narração** — os lances (passe, chute, defesa, lateral...) não viram texto;
  na partida o topo é só placar, minimapa e menu (o painel "Conduzindo"/km/h fica nos treinos). Avisos só
  de comando (menu, treino, edição do time) e o efeito do gol.
- **Celular só deitado**: em pé (com toque) a tela "Gire o celular para jogar" cobre tudo e o jogo para;
  onde dá (Android), o botão "Tela cheia deitada" trava a tela. Janela estreita no PC continua jogando.

## Estádio — rede, gol, torcida e som (primeira versão; a Etapa 6 completa vem depois)

- **Rede véu de noiva, branca e que balança** (11/10): sem caixa nem teto — hastes curtas nos cantos de cima e a rede
  caindo em curva até o chão a 2,8 m (`js/rede-forma.js`, a MESMA forma na física da bola, na regra do gol e no
  desenho); a bola que entra encosta onde a rede está e "morre no fundo"; trama colmeia branca de dia e de noite. A
  bola entra, a rede estufa pela normal do véu no ponto da batida, passa do ponto, volta e a onda corre pela rede
  (~1,9 s), com a luz mudando na dobra; a bola desenhada vai junto no bojo e nunca fura a rede (nem nos cantos); batida
  por fora (lateral, véu) afunda a rede para dentro.
- **Efeito de gol**: na partida a transmissão CORTA para a câmera do gol (baixa, de lado: a rede estufando de perfil e a
  torcida atrás do gol explodindo) até a saída de bola; "GOL!" grande no alto com o número e o nome de quem tocou por
  último de verdade (desvio conta para quem chutou; "Gol contra" quando for) e o minuto, placar pulsando. No treino, zoom
  e tremor curtos que acabam quando a bola volta. Sem tremor com "reduzir movimento". Não atrasa a saída de bola nem
  atrapalha os controles. Intervalo e fim: plano geral do estádio.
- **Torcida no estádio**: até 18 mil torcedores (Alta; 13 mil na Média do celular, 8 mil sem animação na Baixa — trocar a
  qualidade não remonta nada), a casa (Golaço FC, preto e verde) é maioria, organizada pulando atrás de um gol, setor
  visitante (Ventania FC, branco) atrás do outro, o mosaico "GOLAÇO" em camisas verdes; levantam no ataque, explodem no
  gol, põem a mão na cabeça na chance perdida.
- **Som** (gravações livres, créditos em `assets/sons/CREDITOS.md` e na Ajuda): murmúrio do estádio que sobe perto do gol, canto ao
  fundo, explosão do gol (na hora), "uuuh", palmas, apitos (início, saída, intervalo, fim) e o chuá da rede. No gol do
  visitante a casa cala e só o setor deles comemora. Liga no primeiro toque/tecla (regra dos navegadores; o apito do
  início espera por ele). Menu → "Som da torcida": ligado/desligado e volume (salvos); desligado não liga o Web Audio nem
  baixa os sons. Pesquisa: `PESQUISA-ESTADIO.md`.

## Etapa 2 — passe, chute, goleiro

- Treino de ataque: o seu time (goleiro + 5) contra uma defesa (goleiro + 3), com IA enxuta.
- **PASSE** (no pé; o companheiro pelo analógico), **ENFIADA** (no espaço, o recebedor arranca),
  **LANÇAMENTO** (vira **cruzamento** na faixa lateral do último terço: analógico para a linha de
  fundo = 1º pau, atravessado = 2º pau, para trás = marca do pênalti; dois toques = rasteiro),
  **CHUTE** (com o modificador: colocado com efeito; goleiro adiantado: cavadinha), de primeira,
  tabela (passe com o modificador), cabeceio e domínio no peito.
- Força pela barra (segurar), perna boa e ruim, pressão, de primeira — calibrados com dados reais
  (StatsBomb, biomecânica): ver `PESQUISA-ETAPA2.md`.
- Goleiro: bissetriz e profundidade dos dados, reação e mergulho medidos, segura ou espalma,
  1×1 fechando o ângulo, **GOLEIRO** (segurar) sai na bola até 35 m, bola nas mãos.
- **TROCAR** de jogador e troca automática no passe e na perda da bola.
- Manequim provisório: o modelo humano realista com captura de movimento e rosto é a Etapa 5.

## Controles

| Ação | Teclado | Controle | Toque |
|---|---|---|---|
| Mover | WASD / setas | analógico esquerdo | analógico à esquerda |
| PASSE (atacando) / CONTER (defendendo, segurar) | J | A | PASSE / CONTER |
| CHUTE (atacando) / DIVIDIDA (defendendo) | K | B | CHUTE / DIVIDIDA |
| PRESSÃO do companheiro (defendendo, segurar) | O | RB | PRESSÃO |
| LANÇAMENTO / cruzamento | L | X | LANÇAMENTO |
| ENFIADA (atacando) / GOLEIRO (defendendo) | I / G | Y | ENFIADA / GOLEIRO |
| CORRER (segurar) | Shift | RT | CORRER |
| TROCAR de jogador | Q | LB | TROCAR |
| Modificador (colocado, tabela, condução curta, proteção) | E | LT | — |
| Pedalada | dois toques rápidos no modificador | | |
| Recomeçar a jogada | R | | menu |
| Câmera TV / aproximada | C | R3 | menu |
| Ajuda / pausa | H / Esc | View / Start | menu |

No celular os botões trocam sozinhos: com a bola (ou o passe vindo para o seu time) aparecem
CHUTE, PASSE, ENFIADA e LANÇAMENTO; sem ela, TROCAR, GOLEIRO, CONTER, DIVIDIDA e PRESSÃO. Segurar o botão
carrega a força. O botão físico guarda o sentido do momento em que foi apertado (segurar J enquanto a posse
muda não troca o passe por CONTER no meio).

## Rodar

```bash
cd golaco && python3 -m http.server 8000   # http://localhost:8000
```

Parâmetros da página: `?modo=partida|ataque|conducao` (padrão: partida), `?min=N` (minutos reais por tempo),
`?semente=N`, `?demo=1` (a IA joga pelo humano), `?q=baixa|media|alta`, `?hora=dia|noite`, `?camera=tv|aproximada`,
`?toque=1`, `?qps=1`.

## Testes

```bash
node golaco/tools/rodar-testes.mjs     # lógica em Node (em paralelo): Etapas 1 e 2 + partida, Editar time, custo, defesa do humano, troca aérea, transição defensiva, rede e torcida, recepção, mergulho — o Actions roda antes do deploy
node golaco/tools/rodar-testes.mjs --etapa3   # + os testes da IA 11×11 (forma, táticas, pressão, movimento, apoio, intensidade)
node golaco/tools/rodar-testes.mjs --par 2    # no máximo 2 testes ao mesmo tempo (também em hash-igual e hash-partida)
node golaco/tools/teste-transicao.mjs [--humano] # transição defensiva: recomposição em disparada depois da perda (IA × IA ou contra o humano roteirizado)
node golaco/tools/teste-recepcao.mjs   # 1000 bolas no jogador do humano com o analógico já para o lado: domina, nunca se afasta, 1º toque ±20°
node golaco/tools/teste-mergulho.mjs   # canhões de chutes no goleiro: mergulho desenhado, mão na bola, corpo ≤ 5,5 m/s, rebote, cavadinha, espalmada para fora (com atacantes na área), chute desviado
node golaco/tools/medir-controle.mjs   # (minutos, informativo) controle de bola em jogo: domínio que escapa, perdas, bola–pé, 1º toque por atributo
node golaco/tools/hash-igual.mjs       # o treino bit a bit igual a uma base (padrão 980b0b0; --ref <commit>) — rodar antes de todo commit da lógica;
                                       #   o pedido de 10/10 muda o treino de propósito (recepção, domínio, goleiro): use --ref com o commit dele
node golaco/tools/hash-partida.mjs     # otimização: a partida 11×11 bit a bit igual à de antes (repositório × HEAD)
#   (metas que dependem só do desenho do pé no anim.js saem como "PENDENTE"; teste-conducao/teste-dribles --estrito reprovam com elas)
node golaco/tools/teste-carga.mjs      # navegador: erros, download ≤ 4 MB, hash Node = Chromium, 144 Hz, câmera sem tremor
node golaco/tools/teste-controles.mjs  # navegador: teclado (PC) e toque (celular) de verdade, direção NA TELA
node golaco/tools/teste-editor-tela.mjs        # navegador: a tela Editar time (abas, campinho, reservas, teclado e toque)
node golaco/tools/teste-desempenho-celular.mjs # navegador: celular simulado (844×390, Média, CPU 4×): CPU por quadro p95 ≤ 6 ms
node golaco/tools/teste-rede-veu.mjs   # rede véu de noiva (Node): forma pela física, morre no fundo, nada atravessa, gol pelo véu, desenho
node golaco/tools/teste-rede-tela.mjs  # navegador: a rede véu de noiva na tela (forma da malha, fio branco de dia e de noite, clareia o gol, mexe na batida)
node golaco/tools/teste-estadio.mjs    # navegador: torcida (qualidades, chamadas, troca sem remontar, pixels dia/noite), gol ROTEIRIZADO (rede estufa, câmera do gol, "GOL!", saída no tempo), gol do visitante, treino, som (1º gesto, apito do início, grito na hora, desligado, volume), "GOL!" em 3 celulares, GPU = JS
python3 -I golaco/tools/sons/fazer_sons.py <gravações> <saída>  # refaz os sons a partir das gravações originais (CREDITOS.md)
node golaco/tools/prints.mjs           # prints PC/celular deitado (e a tela de girar em pé), dia/noite, menu, ajuda, manequim e o gol de verdade (tools/lib/acha-gol.mjs acha a semente) na câmera do gol (tools/saida/)
```

Contratos entre módulos: `CONTRATOS.md`. Constantes: `js/config.js`. Pesquisa que embasa os
números: `PESQUISA.md` (Etapa 1), `PESQUISA-ETAPA2.md` (Etapa 2), `PESQUISA-ETAPA3.md` (Etapa 3) e
`PESQUISA-RECEPCAO-GOLEIRO.md` (recepção, controle de bola e goleiro, 10/10).
A lógica (`js/*.js` menos `main.js`, `hud.js`, `entrada.js`, `editor-time.js` e `js/render/`) não usa three.js nem
DOM e roda nos testes em Node.
