# GOLAÇO — contratos entre módulos

Regra de ouro: **a lógica (`js/*.js` fora de `js/render/` e de `js/entrada.js`/`js/main.js`) não
usa three.js nem DOM**. Ela roda nos testes em Node. Toda aleatoriedade passa pelo gerador com
semente (`js/rng.js`, estado em `mundo.rng`). `Math.random` é proibido na lógica.

**Matemática determinística:** na lógica, seno, cosseno, atan2, exp, log, pow, asin, acos e hypot
saem SEMPRE de `js/matdet.js` (`MD.sin(...)` etc.), nunca do `Math`. `Math.sin/cos/pow` mudam
no último bit entre motores e versões (Node 22 × Chromium 141 já diferem) e isso quebra o
replay e o hash Node = navegador. `Math.sqrt/abs/floor/round/min/max/sign/imul` são exatos e
podem ser usados. Conferido por `tools/teste-matdet.mjs` (precisão) e `tools/teste-carga.mjs`
(mesmos bits no Node e no Chromium).

## Coordenadas e unidades
- SI: metros, segundos, quilos, radianos.
- x = comprimento (±52,5), z = largura (±34), y para cima. Linha de gol em x = ±52,5.
- Rumo h → direção (cos h, 0, sin h). À direita de quem olha no rumo h: (−sin h, 0, cos h).
- Pé 0 = esquerdo, pé 1 = direito.

## Tempo
- Simulação em passo fixo `PASSO = 1/60 s` (`config.js`). A bola integra em `SUBPASSOS_BOLA`
  subpassos dentro de cada passo.
- O desenho é **interpolado** entre o estado anterior e o atual com `alfa ∈ [0,1)` vindo do
  acumulador (`js/laco.js`). No máximo `MAX_PASSOS_POR_QUADRO` passos por quadro.
- **Encaixe do delta** (Glaiel 2019): média dos últimos 8 deltas a ≤ 0,2 ms de 1/30, 1/60, 1/120
  ou 1/144 s → o delta é exatamente esse período (a 60 Hz, sempre 1 passo por quadro, mesmo com o
  carimbo do rAF tremendo). Na ressincronia (`laco.ultimo = null`) o acumulador volta a meio passo.

## Mundo (`js/sim.js`)
- `criarMundo({semente, jogadores:[{id,x,z,rumo,attr,time,papel}], bola:{x,z}, posse, log})`
- `passo(mundo, entradas)` — avança 1/60 s. `entradas = { [id]: {x, z, botoes} }`:
  analógico **já no mundo** (|v| ≤ 1, quantizado em 1/1024) + máscara `BOTAO` (`config.js`).
- `hashMundo(mundo)` — FNV-1a do estado (bola, corpos, pés, posse, tick, gerador).
- `mundo.eventos` — eventos do último passo (`toque`, `quique`, `trave`, `rede`, `perda`, ...).
- `mundo.posse` — id do jogador com a bola ou `null`.

## Bola (`js/bola.js`)
`bola = { p{x,y,z}, v{x,y,z}, w{x,y,z} (giro, rad/s), q{x,y,z,w} (orientação), rolando }`.
`proxVelRolando`, `distRolando`, `velParaDistancia` são a mesma conta da integração: o
planejador do toque sabe exatamente onde a bola rolando vai estar.

## Jogador (`js/jogador.js`)
Campos: `x, z, vx, vz, rumo, giro, ax, az, fase, pes[2]{apoio, x, z, rumo, faseApoio,
faseSaida, fasePouso, lx, lz, lrumo, puxa, gx, gz}, par (parâmetros dos atributos), ix, iz, imag
(pedido do analógico), intRumo, intW, botoes, cond`.
- `fase` em PASSOS: o pé j pisa quando `fase` cruza um inteiro n ≡ j (mod 2) e fica no chão
  por `2·carga` passos (`infoPassada`). Pé no chão = parado no mundo (sem patinar).
- **A fase nunca salta** (o pé no balanço é desenhado pela fase): quando um pé tem de sair antes
  (ficou para trás/torto, ou o toque pede o pé livre), só o RITMO muda, com limite
  (`PASSADA.ritmo*`, `velPeBalanco`). Parando, o pé no ar termina o passo (não pousa de uma vez).
- No balanço: `faseSaida`/`fasePouso` (a animação anda entre elas) e o ponto de pouso
  `lx, lz, lrumo` — segue o previsto com velocidade limitada e é exatamente onde o pé é plantado.
- `puxa` (0–1) e `gx, gz`: gesto do toque (só visual, integrado pela simulação — `conducao.js`
  `atualizarGesto`): peso e ponto aonde o pé desenhado vai até a bola, com velocidade limitada.
- `passoCorpo(k, dx, dz, vel, rumoAlvo, par, dt)` é usada pela simulação E pela previsão.

## Condução (`js/conducao.js`)
`j.cond = { toque{tick, pe, bx, bz, tipo}, ult{tick, pe, bx, bz, dx, dz, v, tipo}, busca,
pedalada{tick0, lado} }`. O toque é marcado com antecedência e o impulso é calculado no próprio
tick. **O toque sai sempre do pé livre** (`peLivre`: no ar desde antes deste tick, com o outro
no chão; no domínio vale também com os dois no ar). Com os dois pés no chão, `saidaParaToque`
pede à passada que tire o pé do toque do chão a tempo, e o toque espera por ele
(`GESTO.esperaSaida`). `atualizarGesto` (no fim do passo) integra o gesto de cada pé.

## Animação (`js/anim.js`) — função pura do estado
`pose(j, mundo, saida?) → Float32Array(3·NJ)` com as posições no mundo das juntas, na ordem de
`JUNTAS`; `SEGMENTOS` lista os pares de juntas desenhados (com raio). A pose é calculada uma
vez por passo de simulação; o desenho interpola entre a pose anterior e a atual.
- Pé no chão = o ponto plantado na simulação (nada o tira do lugar). Pé no ar = da saída
  (`pe.x, pe.z`) ao pouso (`lx, lz`) pela fase, um tick adiantado (no último tick do balanço já
  está no ponto de pouso), mais o gesto do toque (`puxa`, `gx, gz`), com desvio limitado pelo
  tempo que o pé ainda tem no ar. `tools/teste-patinacao.mjs` mede todos os quadros.

## Entrada (`js/controle.js` puro, `js/entrada.js` com DOM)
- `processarAnalogico(x, y, zonaMorta, zonaExterna)` → `{x, y, mag}` com **zona morta radial**
  (a direção é preservada; sem travar em 8 direções).
- `paraMundo(ax, ay, yawCamera)` converte o analógico da tela para o mundo.

## Página e desenho (`index.html`, `js/main.js`, `js/render/*`, `js/hud.js`, `js/entrada.js`)
- `js/sessao.js` (puro): `criarTreino`, `passoTreino(m, entrada, acoes)` (passo + bola fora +
  ações `recomecar|maquina|marcador`), `entradaDemo`. A página e os testes em Node usam as
  mesmas funções na mesma ordem.
- `main.js`: a cada passo guarda pose/bola ANTERIOR e calcula a ATUAL (pose uma vez por passo);
  desenha interpolando com `alfa`. `window.__golaco` = `{mundo, hash(), passos, alfa, render
  ({bola, jogador, camera, quadros, alfa} do último quadro desenhado), pausar(), rodarPassos(n,
  roteiro), reiniciar(opc), relogio:{usarManual, avancar(ms, {desenhar})}, forcarEntrada(e),
  estado(), desenhar(), cameraLivre({de, para, fov} | null), naTela(x, y, z) → px CSS}`.
  Parâmetros: `?semente ?q ?hora ?camera ?demo ?marcador ?prints ?qps ?toque ?entalhe`.
- `render/jogador3d.js`: todas as cápsulas de todos os jogadores num `InstancedMesh` (atributos
  por instância: raios, comprimento, achatamento, cores e padrão); cabeça e cabelo instanciados.
  Os raios vêm de `SEGMENTOS` (anim.js); o desenho pode afinar um segmento (`estilo().r`).
- Câmera de TV: `yaw = −π/2` fixo (a entrada usa `paraMundo(ax, ay, camera.yaw)`). Enquadramento
  pela LARGURA vista no foco (`CAMERA.largura`), não pelo fov: tela mais larga que 16:9 mantém a
  largura (jogador maior no celular deitado), 4:3 perde metade, em pé usa `CAMERA.retrato` (mais
  alta e inclinada, sem céu) e tela pequena fecha mais (`CAMERA.telaPequena`). Testes: "direita no
  controle = direita na tela" (`teste-controles`, via `naTela`) e câmera sem tremor a 144 Hz
  (`teste-carga`).
