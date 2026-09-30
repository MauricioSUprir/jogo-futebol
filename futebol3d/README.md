# GOLAÇO — futebol 3D no navegador

Partida 11 contra 11 em 3D que roda no navegador (PC e celular), feita com three.js
(WebGL 2) e sem etapa de build: arquivos estáticos, publicados pelo GitHub Pages em
`/futebol3d/`. Todos os times, jogadores, escudos, estádios e anúncios são **fictícios**.

## O que tem

- **Modos**: Amistoso, Copa GOLAÇO (mata-mata com 8 clubes, prorrogação e pênaltis) e
  Liga GOLAÇO (turno único, tabela e artilharia), com progresso salvo no aparelho.
- **Regras**: gol, lateral, escanteio, tiro de meta, falta (direta e indireta), pênalti,
  vantagem, cartões amarelo e vermelho, impedimento no momento do passe (a defesa
  deliberada do goleiro não anula), recuo proibido para o goleiro, acréscimos,
  intervalo, prorrogação e disputa de pênaltis alternada com morte súbita.
- **Física da bola** (120 Hz): arrasto aerodinâmico, efeito Magnus (curva, topspin e
  backspin), vento, quique com atrito que troca velocidade por rotação, rolagem na grama,
  traves e travessão, rede e placas.
- **Jogadores**: aceleração e inércia (freiam antes de virar), fôlego, colisão de corpo,
  condução em toques (a bola não gruda no pé), domínio que pode espirrar, chute, passe,
  lançamento, cruzamento, enfiada, colocado, cavadinha, voleio, cabeceio, drible com finta,
  proteção, desarme e carrinho.
- **IA**: bloco da formação que acompanha a bola, linha de defesa alinhada, pressão e
  cobertura, marcação do lado do gol, apoio com linhas de passe, infiltrações sem ficar
  impedido, e decisão de passe/chute/drible pelo risco do passe e pela chance de gol.
- **Goleiro**: posicionamento no ângulo, saída 1 contra 1, leitura da trajetória, tempo
  de reação, mergulho com alcance real, encaixe ou rebote, saída em cruzamentos e reposição.
- **Gráficos**: gramado com padrão de corte, estádio com torcida animada, refletores
  noturnos, sol de dia e fim de tarde, sombras em tempo real, reflexos PBR, bloom e
  replay dos gols com câmeras de cinema.
- **Áudio** sintetizado: torcida que reage aos lances, batucada, apito, chute, trave e rede.
- **Controles**: teclado, controle (gamepad) e toque (joystick + botões que mudam no
  ataque e na defesa). Qualidade automática com resolução dinâmica.

## Controles

| Ação | Teclado | Controle |
|---|---|---|
| Mover / correr | WASD ou setas / Shift | Analógico esquerdo / RT |
| Passe (defendendo: pressão) | Espaço | A |
| Chute, segure para força (defendendo: carrinho) | K | B |
| Passe longo / cruzamento | L | X |
| Enfiada | I | Y |
| Chute colocado / cavadinha | O / P | RB + B / LT + B |
| Trocar jogador | Q | LB |
| Drible / proteger bola | F / E | Analógico direito |
| Pausa | Esc | Start |

## Rodar localmente

```bash
cd futebol3d && python3 -m http.server 8000
# http://localhost:8000
```

## Testes (Node, sem gráficos)

```bash
node tools/test-ball.mjs          # física da bola
node tools/sim-test.mjs 3 none    # partida inteira CPU x CPU
node tools/sim-test.mjs 3 home    # com um "humano" aleatório
node tools/shootout-test.mjs      # prorrogação e pênaltis
node tools/gk-test.mjs            # goleiro contra chutes
node tools/pen-test.mjs           # conversão de pênaltis
node tools/tournament-test.mjs    # Copa e Liga
```

Com um servidor em `futebol3d/` na porta 8790, os testes no navegador (Playwright) ficam em
`tools/game-shot.mjs`, `tools/e2e.mjs` e `tools/keys-test.mjs`.

## Créditos

three.js (MIT). Texturas de grama: ambientCG.com (CC0). Todo o resto (modelos dos
jogadores, animações, estádio, escudos, bola e sons) é gerado por código.
