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
`proxVelRolando`, `distRolando`, `velParaDistancia` e `velParaChegarCom` são a mesma conta da
integração: o planejador do toque sabe exatamente onde a bola rolando vai estar (e com que
velocidade chega). Traves, travessão, rede e placas usam colisão contínua: o segmento de cada
subpasso é varrido contra os cilindros e os planos, e o lado de cada plano vem do início do
subpasso — a bola parada ou lenta do lado de fora (atrás do gol, por fora da rede, além da placa)
fica onde está, e nada atravessa em velocidade nenhuma.

## Jogador (`js/jogador.js`)
Campos: `x, z, vx, vz, rumo, giro, ax, az, fase, pes[2]{apoio, x, z, rumo, faseApoio,
faseSaida, fasePouso, lx, lz, lrumo, puxa, gx, gz}, par (parâmetros dos atributos), ix, iz, imag
(pedido do analógico), intRumo, intW, botoes, cond, travaApoio`.
- `fase` em PASSOS: o pé j pisa quando `fase` cruza um inteiro n ≡ j (mod 2) e fica no chão
  por `2·carga` passos (`infoPassada`). Pé no chão = parado no mundo (sem patinar).
- **A fase nunca salta** (o pé no balanço é desenhado pela fase): quando um pé tem de sair antes
  (ficou para trás/torto, ou o toque pede o pé livre), só o RITMO muda, com limite
  (`PASSADA.ritmo*`, `velPeBalanco`). Parando, o pé no ar termina o passo (não pousa de uma vez).
- No balanço: `faseSaida`/`fasePouso` (a animação anda entre elas) e o ponto de pouso
  `lx, lz, lrumo` — segue o previsto com velocidade limitada e é exatamente onde o pé é plantado.
- `puxa` (0–1) e `gx, gz`: gesto do toque (só visual, integrado pela simulação — `conducao.js`
  `atualizarGesto`): peso e ponto aonde o pé desenhado vai até a bola, com velocidade limitada.
- Pé plantado e tronco: mais torto que 1,0 rad o pé dá um passo para se alinhar (a passada fica
  ativa mesmo parado); o tronco girando mais rápido que os passos, o pé plantado gira no lugar
  (pivô, sem sair do ponto) e nunca fica a mais de 1,2 rad do tronco.
- `travaApoio` (0 | 1 | null): pé que não sai do chão agora (pedalada: segura o corpo enquanto o
  outro faz o arco). `passoPassada(j, comBola, dt, ev, saida)`: `saida = {pe, em, pousoEm?}` —
  `pousoEm` (pedalada) faz o pé `pe` no ar pousar daqui a tantos segundos pelo ritmo.
- `passoCorpo(k, dx, dz, vel, rumoAlvo, par, dt)` é usada pela simulação E pela previsão.

## Condução (`js/conducao.js`)
`j.cond = { toque{tick, pe, bx, bz, tipo, tol?, modo?, desde?, qx?, qz?}, ult{tick, pe, bx, bz,
dx, dz, v, tipo}, busca, longeDesde, pedalada{tick0, lado}, cortePendente, corteRumo,
semDominioAte, puxada{tick0, rumo} }`. O toque é marcado com antecedência e o impulso é calculado
no próprio tick. **O toque sai sempre do pé livre** (`peLivre`: no ar desde antes deste tick, com o outro
no chão; no domínio vale também com os dois no ar). Com os dois pés no chão, `saidaParaToque`
pede à passada que tire o pé do toque do chão a tempo, e o toque espera por ele
(`GESTO.esperaSaida`). `atualizarGesto` (no fim do passo) integra o gesto de cada pé.
- Tick do próximo toque forçado (antes de o corpo alcançar a bola, ou freando) cai num tick com um
  pé livre na passada prevista (nunca na fase de voo da corrida).
- **Corte** (a bola sai na linha do analógico ±20°, o corpo segura o rumo até o toque —
  `cortePendente`/`corteRumo`, no máximo 0,25 s). Corte "para trás" do corpo embalado (> ~100° do
  sentido da corrida, > 5 m/s) em que o corpo nunca alcançaria a bola na linha pedida: a bola sai
  na direção mais perto da pedida em que o corpo ainda a alcança. Virando aos poucos (o analógico
  passa pela borda), com a bola já fora do rumo pedido, o toque também sai em cima da hora.
- **Puxada de sola** (`tipo 'sola'` no `ult`; `cond.puxada`): modificador + analógico para trás
  (> ~120° do tronco) até 3 m/s; a sola do pé do lado da bola puxa a bola para trás
  (`CONDUCAO.puxadaVel`) com o outro pé no chão, e o tronco segura o rumo 0,2 s. Sem o
  modificador o mesmo comando não faz puxada.
- **Recepção** (`tentarDominio(m, j, primeira?)`; `toque.modo`): `'frente'` (parado ou a bola vem
  contra o sentido da corrida: freia a ≤ 1 m/s e vira para a bola, com a previsão feita pela
  mesma regra) ou `'corrida'` (a bola vem por trás/de lado no sentido da corrida, ou quase parada à
  frente: segue correndo, corrige o caminho até `qx, qz` e domina em velocidade, primeiro toque para
  a frente). `semDominioAte`: quem acabou de ter a bola roubada não domina de novo por 0,5 s.
- **Proteção** (modificador com marcador a < 5 m): o corpo gira em volta da bola, de costas para o
  marcador, no máximo `CONDUCAO.giroProtecao` (× agilidade); andando, o grupo corpo+bola anda pelo
  analógico no passo de proteção. Marcador do treino: contorna a `TREINO.marcadorContorno` e dá o
  bote quando a bola fica do lado dele (`TREINO.marcadorBote`).

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
- Na simulação (`sim.js aplicarEntrada`) a entrada é quantizada em 1/1024 (sem zero negativo) e
  há um limiar ÚNICO de direção (`ENTRADA.magDirecao`): abaixo dele o pedido é zero — nem anda no
  rumo antigo nem vira o tronco.
- `paraMundo(ax, ay, yawCamera)` converte o analógico da tela para o mundo.

## Página e desenho (`index.html`, `js/main.js`, `js/render/*`, `js/hud.js`, `js/entrada.js`)
- `js/sessao.js` (puro): `criarTreino`, `passoTreino(m, entrada, acoes)` (passo + bola fora +
  ações `recomecar|maquina|marcador`), `entradaDemo`. Recomeço (`treino.js devolverBola`): perto das
  linhas o jogador volta para 1 m dentro do campo (a bola volta dentro); embalado, a bola sai
  rolando com a velocidade do corpo; um gol marcado pela simulação não gera um segundo aviso. A página e os testes em Node usam as
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

## Etapa 2 — ações com bola, goleiro e vários jogadores (contrato)
- **Entradas por TIME**: `passo(m, { [time]: {x, z, botoes} })`. O time humano (0) controla UM jogador por vez:
  `m.controlado = { 0: id }`. Os demais jogadores são da IA (`js/ia.js`), que gera para cada um uma entrada
  virtual `{x, z, botoes}` passando pela MESMA `aplicarEntrada` (a IA "aperta botões" como o humano).
  `m.humanos = [0]` (times com humano). Troca: `BOTAO.TROCAR` (borda) e automática no passe (o recebedor vira
  o controlado).
- **Posição**: `j.posicao` = `'GOL'` | `'ZAG'` | `'LAT'` | `'VOL'` | `'MEI'` | `'PON'` | `'ATA'`. Goleiro tem a
  lógica própria em `js/goleiro.js` (posicionamento na bissetriz, defesa, saída com `BOTAO.GOLEIRO` segurado).
  Campo: o time 0 ataca o gol de x = +52,5; o time 1, o de x = −52,5 (`m.ataca = {0: 1, 1: -1}`).
- **Ações** (`js/acoes.js`, puro): `BOTAO.PASSE | ENFIADA | LANCAMENTO | CHUTE` — apertar começa a carregar a força
  (`j.carga = {tipo, t0, mod}`, cheia em 0,8 s), soltar cria o pedido (`j.pedido = {tipo, forca, mod, tick}`). Com a
  bola, o chute/passe sai no próximo toque possível (o toque marcado `j.cond.toque.tipo = 'acao'`); bola chegando,
  sai **de primeira**. `m.voo = {tipo, de, para, alvo:{x,z}, tickChegada, alto}` descreve o passe/chute em
  andamento (o desenho marca o ponto de queda no gramado quando `alto`). Tipos: `'passe' | 'enfiada' |
  'enfiadaAlta' | 'lancamento' | 'cruzamento' | 'chute' | 'colocado' | 'cavadinha' | 'cabeceio'`.
- `j.recebe = {tick, x, z, tipo}`: o jogador que vai receber (vem ao encontro / arranca na enfiada).
- `j.mergulho = {tick0, dx, dz, alt, lado}`: goleiro mergulhando (a animação deita o corpo nessa direção).
- Eventos novos: `passe`, `chute`, `defesa` ({tipo: 'encaixe'|'espalmada'}), `gol`, `troca`, `saidaGoleiro`.
- **Troca de controle**: sempre por `assumirControle(m, time, novo)` (`acoes.js`): a carga e o pedido em andamento
  vão para o novo jogador e os botões segurados contam como já apertados (sem carga nova falsa). As bordas do
  TROCAR são do time: `m.botoesTimeAgora[time]` e `m.botoesTimeAnt[time]`.
- **Mira**: `j.mira = {x, z, mag}` guarda o analógico segurado durante a carga e até o toque (soltar botão e
  analógico juntos não perde a direção).
- **Goleiro**: `lerChute` decide uma vez por chute (`m.voo.tickChave`) com `chanceDefesa(lateral, dChute, altura,
  alcance, attr)` (logística dos dados × alcance físico de `alcanceGoleiro(τ)`); `j.defesa` pode ter `recuo` (bola
  por cima: volta para o ponto em que ela desce). Com a defesa decidida, a bola não colide com o corpo do goleiro.
- **Bola alta**: `bolaAltaPassando(m, j)` devolve o ponto de maior aproximação; com toque `'aereo'` marcado o jogador
  vai para esse ponto (`movimentoAereo`). Eventos: `cabeceio`, `dominioAereo` ({vChegada, sobra}).

