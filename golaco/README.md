# GOLAÇO — futebol 3D no navegador (projeto novo)

Jogo de futebol 11×11 em 3D para PC e celular, feito do zero, publicado pelo GitHub Pages em
`/golaco/`. Times, jogadores, estádios, marcas e anúncios são **fictícios**.

O jogo tem que ser gostoso de jogar antes de ser bonito: **controle de bola, passe e tática
primeiro**. Cada etapa só termina com as metas medidas por teste automático.

## Etapa 1 — base e controle de bola (esta versão)

- Campo oficial 105 × 68 m (IFAB), gols com rede, bola com física (arrasto com crise do
  arrasto, efeito Magnus, quique e rolagem na grama calibrados por ensaios FIFA, traves e rede).
- Um jogador controlável conduzindo a bola **sem ímã**: entre os toques a bola rola com física
  de verdade; cada toque calcula a velocidade exata para a bola chegar onde o pé vai estar no
  próximo toque (prevendo o caminho do próprio corpo), sincronizado com a passada.
- Corte, giro de 180°, puxada de sola, condução curta, pedalada, domínio orientado e proteção.
- Treino: máquina de passes (domínio) e marcador (proteção).
- Manequim provisório: o modelo humano realista com captura de movimento e rosto é a Etapa 5.

## Controles

| Ação | Teclado | Controle | Toque |
|---|---|---|---|
| Mover | WASD / setas | analógico esquerdo | analógico à esquerda |
| CORRER (segurar) | Shift | RT | CORRER |
| Modificador (condução curta, proteção, drible) | Ctrl ou E | LT | CONDUÇÃO |
| Pedalada | dois toques rápidos no modificador | | |
| Recomeçar (bola no pé) | R | | menu |
| Máquina de passes / marcador | M / N | Y / X | menu |
| Câmera TV / aproximada | C | | menu |
| Ajuda / pausa | H / Esc | View / Start | menu |

## Rodar

```bash
cd golaco && python3 -m http.server 8000   # http://localhost:8000
```

## Testes

```bash
node golaco/tools/rodar-testes.mjs     # lógica em Node (~30 s) — o Actions roda antes do deploy
node golaco/tools/teste-carga.mjs      # navegador: erros, download ≤ 4 MB, hash Node = Chromium
node golaco/tools/prints.mjs           # prints PC/celular, dia/noite (tools/saida/)
```

Contratos entre módulos: `CONTRATOS.md`. Constantes: `js/config.js`. Pesquisa que embasa os
números: `PESQUISA.md`.
