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
  travessão), nunca de volta para a área. Chute desviado num corpo: o goleiro relê (e muitas vezes é enganado) — a
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
node golaco/tools/rodar-testes.mjs     # lógica em Node (em paralelo; --par N limita os processos): Etapas 1 e 2 + partida, Editar time, custo, defesa do humano, troca aérea, recepção, mergulho — o Actions roda antes do deploy
node golaco/tools/rodar-testes.mjs --etapa3   # + os testes da IA 11×11 (forma, táticas, pressão, movimento, apoio, intensidade)
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
node golaco/tools/prints.mjs           # prints PC/celular (deitado e em pé), dia/noite, menu, ajuda, manequim e gol de perto (tools/saida/)
```

Contratos entre módulos: `CONTRATOS.md`. Constantes: `js/config.js`. Pesquisa que embasa os
números: `PESQUISA.md` (Etapa 1), `PESQUISA-ETAPA2.md` (Etapa 2), `PESQUISA-ETAPA3.md` (Etapa 3) e
`PESQUISA-RECEPCAO-GOLEIRO.md` (recepção, controle de bola e goleiro, 10/10).
A lógica (`js/*.js` menos `main.js`, `hud.js`, `entrada.js`, `editor-time.js` e `js/render/`) não usa three.js nem
DOM e roda nos testes em Node.
