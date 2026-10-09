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

## Etapa 2 — passe, chute, goleiro (esta versão)

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
| PASSE | J | A | PASSE |
| CHUTE | K | B | CHUTE |
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
CHUTE, PASSE, ENFIADA e LANÇAMENTO; sem ela, TROCAR e GOLEIRO. Segurar o botão carrega a força.

## Rodar

```bash
cd golaco && python3 -m http.server 8000   # http://localhost:8000
```

## Testes

```bash
node golaco/tools/rodar-testes.mjs     # lógica em Node (em paralelo, ~30 s): Etapa 1 (com recomeço do treino) + passes, chute, goleiro e jogo aéreo — o Actions roda antes do deploy
#   (metas que dependem só do desenho do pé no anim.js saem como "PENDENTE"; teste-conducao/teste-dribles --estrito reprovam com elas)
node golaco/tools/teste-carga.mjs      # navegador: erros, download ≤ 4 MB, hash Node = Chromium, 144 Hz, câmera sem tremor
node golaco/tools/teste-controles.mjs  # navegador: teclado (PC) e toque (celular) de verdade, direção NA TELA
node golaco/tools/prints.mjs           # prints PC/celular (deitado e em pé), dia/noite, menu, ajuda, manequim e gol de perto (tools/saida/)
```

Contratos entre módulos: `CONTRATOS.md`. Constantes: `js/config.js`. Pesquisa que embasa os
números: `PESQUISA.md` (Etapa 1) e `PESQUISA-ETAPA2.md` (Etapa 2).
