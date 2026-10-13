# GOLAÇO — contratos entre módulos

Regra de ouro: **a lógica (`js/*.js` fora de `js/render/` e de `js/entrada.js`/`js/main.js`/`js/hud.js`/
`js/editor-time.js`) não usa three.js nem DOM**. Ela roda nos testes em Node. Toda aleatoriedade passa pelo gerador com
semente (`js/rng.js`, estado em `mundo.rng`). `Math.random` é proibido na lógica. Em `js/render/`, o som (`som.js`, Web
Audio) é DOM; `rede-onda.js`, `emocao.js`, `torcida-dados.js` e `autor-gol.js` são puros (testados em Node), mas são do
desenho: só leem o mundo, nunca escrevem nele.

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

### Rede véu de noiva (`js/rede-forma.js`; pedido do dono, 11/10)
A rede do gol é o VÉU DE NOIVA (Maracanã): sem caixa nem teto. Medidas em `config.js` `CAMPO.gol.veu = {haste: 0.45,
fundo: 2.8, segmentos: 40}` (`CAMPO.gol.profundidade` = o fundo, 2,8 m: a maior profundidade). Perfil no plano X × y
(X = metros atrás da linha do gol, y = altura): faixa de cima y = 2,44 de X = 0 a `haste` (as hastes dos cantos) e o véu
y = 2,44·((fundo − X)/(fundo − haste))² até o chão em X = `fundo` (parábola tangente ao chão); as laterais são panos
verticais do poste até o véu (X ≤ `profundidadeVeu(y)`). A MESMA forma vale na física, na regra do gol e no desenho.
- **`rede-forma.js` (puro: só + − × ÷ e `Math.sqrt`, igual em todo motor JS)**: `VEU`, `profundidadeVeu(y)`, `alturaVeu(X)`,
  `dentroDoVeu(X, y, z)` (por baixo do véu e entre as laterais), `COMPRIMENTO_PERFIL`, `PERFIL {X, y, s}`,
  `pertoPerfil(X, y, out)` → `{X, y, nx, ny, d, s}` (ponto da polilinha mais perto, normal para FORA, distância com sinal:
  + = do lado de fora), `pontoPerfil(s, out)`, `fundoDaCunha(r)` (até onde vai o centro da bola parada no chão: 2,06 m).
- **Física (`bola.js colidirGol`)**: as laterais seguram por dentro e por fora até o véu; o véu é a polilinha (o lado vem do
  INÍCIO do subpasso, como os planos finos; o filtro de altura vale pelo começo OU pelo fim do subpasso — a bola de dentro
  subindo a ≥ ~27 m/s não pula a faixa de cima). Por dentro devolve `amortecimentoRede` da velocidade normal e segura o que
  escorrega (×0,45 na batida forte, |vn| > 3; ×0,85 na média; ×0,995 encostada): a bola escorrega pelo véu até a cunha do
  fundo e "morre" lá. Por fora (×0,3/×0,6) ela não entra (o pé do véu é quase deitado: rolando rápido de trás ela sobe
  um pouco por fora — a 20 m/s até ~1,6 m — e volta, sem passar por cima); a bola por cima do travessão escorrega por
  trás até o chão. Evento `rede` (força = |vn|) só por dentro com |vn| > 1,5 m/s.
- **Gol (`sim.js verificarGol`) e treino (`treino.js` dentroDoGol)**: a bola atrás do véu (X > `profundidadeVeu(y)`) não é
  gol; o gol continua sendo a bola passar inteira da linha entre as traves e por baixo do travessão.
- **Hash**: muda a física atrás da linha. O treino de CONDUÇÃO fica bit a bit igual enquanto a bola não entra no gol
  (`hash-igual`, 20 sementes × 3 min: `conducao-demo` IGUAL; `conducao-roteiro` igual em 19 de 20 — na semente 14 o
  jogador leva a bola para dentro do gol no passo 3271 e a física do véu diverge no 3363); o de ATAQUE diverge no passo
  seguinte ao 1º chute (ou lançamento) cuja trajetória prevista passa da linha do gol (o goleiro e a IA simulam a bola com
  `passoBola` até depois da linha) — sementes 1–4: passos 510–997 (demo) e 832–1929 (roteiro). A partida diverge no 1º
  lance assim. Base nova do `hash-igual` depois do merge: `--ref <commit do merge>`.

## Jogador (`js/jogador.js`)
Campos: `x, z, vx, vz, rumo, giro, ax, az, fase, ritmo, pes[2]{apoio, x, z, rumo, faseApoio,
faseSaida, fasePouso, lx, lz, lrumo, puxa, gx, gz, tx, ty, tz, bx, bz, k, chegou, pendente},
par (parâmetros dos atributos), ix, iz, imag (pedido do analógico), intRumo, intW, botoes, cond,
travaApoio, quadril`.
- `fase` em PASSOS: o pé j pisa quando `fase` cruza um inteiro n ≡ j (mod 2) e fica no chão
  por `2·carga` passos (`infoPassada`). Pé no chão = parado no mundo (sem patinar).
- **A fase nunca salta**: quando um pé tem de sair antes (ficou para trás/torto, ou o toque pede
  o pé livre), só o RITMO muda, com limite (`PASSADA.ritmo*`, `velPeBalanco`); `j.ritmo` guarda o
  do último tick. Parando, o pé no ar termina o passo (não pousa de uma vez). Pé de apoio perto do
  limite da perna (`alcancePlantado` → `alcanceMax`) sai depressa, até `ritmoUrgente`, mesmo no
  gesto do toque; parado com o corpo a mais de `alcanceParado` de um pé, ele dá um passo.
- A passada roda DEPOIS da colisão entre corpos (`sim.js`): o pouso é mirado pela velocidade que o
  corpo tem depois do contato.
- No balanço: `faseSaida`/`fasePouso` e o ponto de pouso `lx, lz, lrumo` — a previsão do corpo no
  pouso + meio apoio, refeita a cada tick (tempo até o pouso contínuo, pelo ritmo) e parada quando
  o pé desenhado chega a ele (`chegou`); é exatamente onde o pé é plantado.
- **Pé desenhado** `tx, ty, tz` (tornozelo; `bx, bz, k` = trajetória sem o gesto): integrado no fim
  do passo por `passoPeDesenhado(j, mundo, dt)` — trajetória do balanço até o pouso (perfil
  `perfilBalanco`, altura do passo), gesto do toque e arco da pedalada, seguidos com no máximo
  `PASSADA.velPeMax` (90% de 3 + 2,5·v). O pé só é plantado quando o pé desenhado está a um quadro
  do ponto de pouso (`velPeAterrissa`); senão fica `pendente` (no ar) até chegar.
- `puxa` (0–1) e `gx, gz`: gesto do toque (só visual, integrado pela simulação — `conducao.js`
  `atualizarGesto`): peso e ponto aonde o pé desenhado vai até a bola, com velocidade limitada.
- `quadril`: altura do quadril da última pose (`anim.js alturaQuadril`, guardada pela simulação no
  fim do passo).
- Pé plantado e tronco: mais torto que 1,0 rad o pé dá um passo para se alinhar (a passada fica
  ativa mesmo parado); o tronco girando mais rápido que os passos, o pé plantado gira no lugar
  (pivô, sem sair do ponto) e nunca fica a mais de 1,2 rad do tronco.
- `travaApoio` (0 | 1 | null): pé que não sai do chão agora (pedalada: segura o corpo enquanto o
  outro faz o arco). `passoPassada(j, comBola, dt, ev, saida)`: `saida = {pe, em, pousoEm?}` —
  `pousoEm` (pedalada) faz o pé `pe` no ar pousar daqui a tantos segundos pelo ritmo.
- `passoCorpo(k, dx, dz, vel, rumoAlvo, par, dt)` é usada pela simulação E pela previsão.
- **Forma única (desempenho, Etapa 3):** `criarJogador` já declara TODOS os campos que os outros módulos põem
  no jogador depois (`papel, posicao, vagaId, vagaIdx, posDetalhe, vaga, iaT, recebe, corrida, intercepta, carga,
  pedido, mira, miraAuto, iaAcao, defesa, mergulho, segura, saindo, ia, botoesTime, giroParado, quadril, iaA,
  pedidoPedalada, ladoOlha, ritmo, ultLanc, ultMod, descansoBote, defH, conter, descanso, contorno`), com
  `undefined` (o mesmo valor de antes da 1ª escrita), na mesma ordem para todos: os 22 ficam com UMA classe oculta
  do motor JS. Com uma ordem por jogador (eram 9 formas na partida) os acessos ficavam megamórficos e cada leitura de
  número alocava (~300 KB de lixo por passo). **Campo novo no jogador: declarar em `criarJogador`** (o mesmo vale
  para `j.cond`: `criarCond`).
- `freqPassada(s, comBola)` e `cargaPassada(s)` são a conta de `infoPassada` sem alocar (use no caminho quente);
  `progressoBalanco` devolve um objeto REAPROVEITADO (ler os campos na hora) e `pontoPouso` aceita um `out`.

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
  `cortePendente`/`corteRumo`, no máximo 0,25 s). Corte "para trás" do corpo embalado (> ~95° do
  sentido da corrida, > 5 m/s) em que o corpo não alcançaria a bola na linha pedida em até 0,5 s:
  a bola sai na direção mais perto da pedida em que o corpo ainda a alcança. Virando aos poucos (o analógico
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
- **Previsões sem alocar (Etapa 3, plano 4.3):** `preverBola(b, n)` → `{xs, zs, ys, rol}` e `preverCorpo(m, j, n,
  ...)` → `{n, xs, zs, rs, ss, fs}` devolvem vetores **SÓ DE LEITURA e reaproveitados** (dois jogos que se revezam:
  a resposta vale até a SEGUNDA previsão nova seguinte; os vetores podem ter mais de n + 1 posições — use só 0..n).
  Nenhum chamador escreve neles nem os guarda. `preverBola` é compartilhada no passo: a chave é o estado que a física
  lê (p, v, w, rolando; a orientação `q` é só do desenho), a mesma bola pedida com horizonte maior continua a conta
  de onde parou, e `rol[i]` diz se ela rola no tick i (`acoes.js bolaAltaPassando` usa esta previsão). Bit a bit a
  mesma conta (`tools/hash-igual.mjs`). `movimentoBase(..., ctx, out?)`, `marcadorPrevisto(..., out?)` e
  `pontoContato(..., out?)` aceitam um objeto de saída. No toque, `velParaDistancia` (busca binária) e a rolagem por
  tick têm memória (as mesmas contas); `tentarDominio` descarta antes da previsão quem não alcança a bola em nenhum
  tick (poda exata: bola mais longe do corpo de agora que o toque + o máximo que o corpo anda até lá).
- **Proteção** (modificador com marcador a < 5 m): o corpo gira em volta da bola, de costas para o
  marcador, no máximo `CONDUCAO.giroProtecao` (× agilidade); andando, o grupo corpo+bola anda pelo
  analógico no passo de proteção. Marcador do treino: contorna a `TREINO.marcadorContorno` e dá o
  bote quando a bola fica do lado dele (`TREINO.marcadorBote`).

## Animação (`js/anim.js`) — função pura do estado
`pose(j, mundo, saida?) → Float32Array(3·NJ)` com as posições no mundo das juntas, na ordem de
`JUNTAS`; `SEGMENTOS` lista os pares de juntas desenhados (com raio). A pose é calculada uma
vez por passo de simulação; o desenho interpola entre a pose anterior e a atual.
- Pé no chão = o ponto plantado na simulação (nada o tira do lugar). Pé no ar = o pé desenhado
  do estado (`tx, ty, tz`, ver Jogador). `tools/teste-patinacao.mjs` mede todos os quadros.
- Quadril: teto pelo alcance das pernas — pé no chão; pé no ar na saída (o próprio pé) e no fim
  do balanço (o ponto de pouso visto do corpo, meio apoio à frente), e no meio do balanço até
  `QUEDA_BALANCO` abaixo do nominal. Para cima sobe no máximo `QUADRIL_SOBE` (1,5 m/s) a partir de
  `j.quadril`; para baixo vai direto ao teto. `alturaQuadril(j, mundo)` (usada pela simulação) e a
  pose dão a mesma altura.

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
  alta e inclinada, sem céu — hoje só na janela estreita do PC: no celular em pé o jogo para e mostra
  "Gire o celular", main.js retratoBloqueado + #girar no CSS) e tela pequena fecha mais (`CAMERA.telaPequena`) e, deitada, usa a TV mais baixa e mais longe (`CAMERA.celular`: a torcida do outro lado no alto do quadro durante o jogo, mesma largura vista no foco). Testes: "direita no
  controle = direita na tela" (`teste-controles`, via `naTela`) e câmera sem tremor a 144 Hz
  (`teste-carga`).

## Estádio — rede que balança, efeito de gol, torcida e som (contrato)
Pesquisa: `PESQUISA-ESTADIO.md`. **Só desenho e som: nada aqui escreve no mundo** (o hash não muda: `hash-igual` e
`hash-partida` IGUAIS). Constantes nos próprios módulos (não em `config.js`). A FORMA da rede (véu de noiva) é lógica
(`js/rede-forma.js`, ver "Rede véu de noiva" em Bola): o desenho só a lê.
- **Puros (sem three.js nem DOM; testados em Node):** `js/render/rede-onda.js`, `js/render/emocao.js`,
  `js/render/torcida-dados.js`. Aleatoriedade só por gerador próprio com semente fixa (`geradorTorcida`), nunca `m.rng`.
- **`rede-onda.js`** (rede VÉU DE NOIVA, forma de `rede-forma.js`): `REDE` (constantes: 1,6 Hz, ζ 0,24, bolsa até
  0,85 m, raio 0,8 m, onda a 5,5 m/s, dura 1,9 s), `VEU_DESENHO`, panos para as batidas e a bola desenhada (índice
  `(lado > 0 ? 4 : 0) + k`, k: 0 véu = faixa de cima + curva, 2 lateral z−, 3 lateral z+; o 1, teto, não existe mais).
  A deformação é um CAMPO VETORIAL no espaço: cada batida empurra os pontos perto dela na direção da bolsa (a normal do véu
  ou ±z da lateral NO PONTO DA BATIDA), então o véu e as laterais mexem juntos sem rasgar na emenda. `fixo(x, y, z)` (0 na
  armação — postes, travessão, hastes, pé das laterais e fundo do véu no chão —, 1 longe; aceita também `(plano, x, y,
  z)`; a malha grava num atributo), `mola(τ)`, `perfil(r, τ)`, `amplitude(v)`, `criarOndas()` → `{imp[4], total}`
  (`imp`: `{ativo, t0, x, y, z, plano, amp, dx, dy, dz}`), `limparOndas`, `centroBolsa` (ponto da bolsa na parte solta e
  a direção dela), `registrarImpacto(est, {plano, x, y, z, vel, sinal}, t0)` (t0 = o FIM do passo da batida: a bola
  desenhada, interpolada do começo ao fim do passo, só encosta na rede no fim — com meio passo antes ela pulava ~9 cm para
  a frente no quadro da batida), `deslocamentoVetor(est, x, y, z, t, out)` (o vetor, sem a fixação), `normalNoPonto(plano,
  x, y, z, out)`, `normalPano(i)` (no meio do pano), `deslocamento(est, plano, x, y, z, t)` (m pela normal do pano no ponto,
  + = para fora; sem a fixação), `redeAtiva(est, t)`, `detectarImpactos(p0, v0, p1, v1, out)` → n (bola antes/depois do
  passo; véu pela distância ao perfil, laterais até o véu), `empurraoBola(est, p, t, out)` (o deslocamento da bola
  DESENHADA no bojo), `uniformsRede(est, t, a, b)` (a = [x, y, z, amp]·4, b = [τ, dx, dy, dz]·4) e `REDE_GLSL` (a mesma
  conta em GLSL, gerada das mesmas constantes: `vec3 redeDesloc(vec3 p)`; a fixação é o atributo `aFixo`).
  `empurraoBola` termina com a RESTRIÇÃO: na posição final, a superfície da bola desenhada não passa de nenhum pano
  deformado em que a física encosta (3 passadas; sem furo nos cantos). O shader da rede (`campo.js`) refaz a normal pela
  inclinação da bolsa (diferença finita a 10 cm, produto vetorial das duas tangentes deslocadas).
- **`emocao.js`**: `EMOCAO`, `criarEmocao()` → `{agito, torcida: [{excita, tensao, lamento, palmas}·2], disparos,
  contagem}`, `emocaoEvento(est, ev, {t, timeDe, bola, ataca})` (os eventos de `m.eventos` e `{tipo: 'redeImpacto', vel}`),
  `emocaoPasso(est, {t, bola, posseTime, ataca, estado}, dt)`, `consumirDisparos(est)` → `[{tipo: 'gol'|'uuuh'|'palmas'|
  'apito'|'apitoIntervalo'|'apitoFim'|'rede'|'chute', grupo, forca}]`, `zerarEmocao`. Grupo 0 = torcida do time 0 (casa),
  1 = do time 1. `agito` (o barulho geral) vai ao máximo só no gol da CASA (`EMOCAO.casa`); no gol do visitante cai para
  `agitoGolSofrido` em `caiGolSofrido` s (a casa cala; só o setor visitante comemora).
- **`autor-gol.js`**: `criarAutorGol()`, `zerarAutorGol`, `autorEventos(est, eventos, tick, timeDe)` (uma vez por passo,
  na ordem dos eventos; preenche `est.gol = {ativo, tick, time, id, contra, desvio}` no passo do gol), `autorDoGol`,
  `TOQUES`. O autor é o último toque de VERDADE (`toque` da condução, domínio, chute, passe, cabeceio, defesa, bateuCorpo,
  roubada, dividida ganha); chute de quem marcou seguido só de desvio/defesa do adversário → gol de quem chutou. Sem alocar
  por passo.
- **`torcida-dados.js`**: `ARQUIBANCADA` (a geometria de `campo.js`), `TORCIDA` (ocupação e animação por qualidade,
  `atlas` [64, 128], setores), `POSE`, `NIVEIS`, `cadeiras()`, `gerarTorcidaNiveis(mascara)` → `{n, pos (x, y, z, escala),
  camisa, pele (rgb + semente), cabelo, info (time, setor, organizada, semente2), nivel (0 Baixa, 1 Média, 2 Alta),
  faixas[setor] = {inicio, porNivel[3]}}` (TODOS os torcedores de uma vez; as qualidades são prefixos em cada
  arquibancada; ordem: setor, nível, fileira da frente para cima), `quantosNoSetor(d, setor, qualidade)`,
  `gerarTorcida(qualidade, mascara)` (os de nível ≤ o da qualidade, o mesmo formato sem `nivel`), `atlasTorcida(cw, ch)`
  (RGBA: pesos de camisa/pele/cabelo × cobertura; acento = o resto), `POSE_REGRA` (limiares e ritmos),
  `poseDoTorcedor(niveis, h, h2, org, t, animada)` e `POSE_GLSL` (`vec2 torcidaPose(...)` → (pose, pulo): a MESMA regra,
  gerada de `POSE_REGRA`), `CAIXA_POSE` (largura e altura de cada pose em fração da célula: o quadro encolhe para a pose).
- **Com three.js/DOM:** `torcida.js` (`criarTorcida(cena, {qualidade, mascara, hora})` → `{mesh, n, atualizar(t, emocao,
  camera), definirHora, definirQualidade, dispose}`: um `Group` com uma malha instanciada por grupo de arquibancada (5
  desde 11/10, com o lado de cá; ver "Estádio cheio" abaixo), mesmo material e atlas — com corte por CAIXA contra o frustum da câmera em `atualizar`; monta TODOS os torcedores
  uma vez e `definirQualidade` só muda `instanceCount` e o uniform `uAnimada` — nada remonta nem recompila), `campo.js` (a
  rede véu de noiva é UMA malha para os dois gols — o véu a ~15 cm ao longo do perfil e as laterais em leque, X =
  a·`profundidadeVeu(y)` — com os atributos `aFixo` e `aUvM` (metros sobre o tecido) e `onBeforeCompile`; trama COLMEIA
  procedural no fragment shader (`REDE_TRAMA`: hexágono de 12 cm, fio de 6 mm que não afina abaixo de ~1 px — só fica até
  15% mais transparente — e vira véu branco uniforme de opacidade 0,32 quando a célula fica < ~2 px; sem textura, sem
  moiré); BRANCA com luz própria de dia e de noite (`LUZ_GOL`, `definirHora`); armação branca (postes, travessão, hastes
  de 0,45 m e as cordas do chão), sem a armação cinza da caixa; `campo.rede = {a, b, mesh}` = os uniforms das batidas), `texturas.js mascaraGolaco()` (cadeiras do mosaico, a mesma para a textura e para a torcida), `camera.js`
  (`efeitoGol(x, z, {fechado})`: com `fechado` (partida) CORTA para a câmera do gol `CAMERA_GOL` até `encerrarGol()`; sem
  ele (treino) zoom/tremor leve `EFEITO_GOL`; `encerrarGol()`, `efeitoAtivo`, `planoGol` ('fechado' | 'leve' | null),
  `planoGeral(v)` / `geral` (intervalo e fim: `CAMERA_GERAL`); `foco()` acompanha a boca do gol na câmera do gol),
  **`som.js` (Web Audio, DOM)**: `criarSom({base, ligado, volume, aoMudar})` → `{iniciar(), atualizar(emocao, pausado, t),
  tocar(disparo), definir({ligado, volume}), estado ('sem-audio' | 'desligado' | 'sem-contexto' | 'suspenso' |
  'rodando'), info ({…, contexto, baixando, pendente}), tocados, baixar(), analisar(nome) (envelope de uma gravação)}`. O
  AudioContext só nasce no primeiro gesto e só com o som LIGADO; desligado, nada baixa e o contexto existente é
  suspenso. Os arquivos baixam depois da página abrir (`SOM.atrasoCarga` ou o primeiro gesto). O apito que chega antes do
  som liberado fica pendente até `SOM.apitoPendente` ms.
- **`main.js`**: a cada passo (`rodarPasso` → `estadioPasso`, só lendo o mundo) acompanha o autor (`autorEventos`),
  procura batidas na rede com a bola antes/depois do passo, alimenta o ânimo com os eventos e toca os disparos; no
  desenho: bola desenhada = física + `empurraoBola`, uniforms da rede, torcida e som. Relógio do estádio: `passosTotais`
  (não volta a zero ao trocar de mundo; parado na pausa). Os eventos que o mundo já traz ANTES do 1º passo (o `saida` do
  começo da partida) passam pelo ânimo e pelo som em `eventosIniciais()` (no início e em `trocarMundo`). Gol:
  `hud.evento(ev)` (só "GOL!": sem autor nem minuto escritos — sem narração na tela, dono 10/10) + `cam.efeitoGol(x, z, {fechado:
  partida})`; `saida`/`recomeco` encerram o "GOL!" e a câmera do gol (`encerrarEfeitosGol`) e o plano geral; `intervalo`
  e `fimDeJogo` ligam o plano geral. Menu: comandos `som` (`'ligado'|'desligado'`) e `volume` (0–1), salvos em
  `golaco.prefs.v1` (`som`, `volume`).
- **`hud.js`**: `evento({tipo: 'gol'}, {fixo})` (`fixo`: o aviso fica na tela — sem o tempo e sem o apagar da
  animação, classe `fixo`), `esconderGol()`. O "GOL!" fica no terço de cima (por cima da torcida, longe da boca do gol na
  câmera do gol); no celular, compacto entre o analógico e os botões.
- **API (`window.__golaco`)**: `estadio {torcida, rede, deslocamentoRede(plano, x, y, z), emocao, som, redeOnda(v) (só o
  desenho: o mesmo instante com/sem a onda), mostrarTorcida(v), trocarTorcida(q) (ms da troca de qualidade só da
  torcida), bolaDesenhada, efeitoCamera, planoCamera ('fechado' | 'leve' | 'geral' | 'jogo'), autorGol, ultimoToque,
  baixarSons(), analisarSom(nome)}`, `definirSom(v)`, `definirVolume(v)`, `mostrarEvento(ev, {fixo})` (o "GOL!";
  `fixo` segura na tela — prints). `autorGol` (o autor de verdade, `render/autor-gol.js`) não aparece na tela.
- **Testes**: `tools/teste-rede.mjs`, `tools/teste-rede-veu.mjs` e `tools/teste-torcida.mjs` (Node, grupo padrão),
  `tools/teste-estadio.mjs` e `tools/teste-rede-tela.mjs` (navegador, no CI: a rede montada com `criarCena` +
  `criarCampo` numa tela à parte — forma da malha, cor do fio de perto, a rede clareia o gol nas câmeras de TV, do gol e de
  perfil, e mexe no pico da bolsa; PC Alta e celular Média, dia e noite). O gol do teste de navegador e dos prints da rede
  é ROTEIRIZADO (`tools/lib/gol-roteirizado.mjs`: um jogador do time com a bola e o último toque, os adversários do
  corredor e o goleiro tirados do caminho e o chute com a física da bola — não depende da IA nem do goleiro de nenhuma
  frente; o gol achado em Node não se repetia na página); só os prints do ataque antes do gol usam a semente achada em
  Node (`tools/lib/acha-gol.mjs acharGol`).

## Estádio cheio e som da torcida no jogo (pedido de 11/10; contrato)
Pedido do dono: "Coloca mais torcida no estádio, bandeirões, sinalizadores, e bota som de torcida também, pra durante o
jogo". Pesquisa em `PESQUISA-ESTADIO.md` §6. **Só desenho e som** (o hash não muda: `hash-igual` IGUAL; `teste-som-jogo`
M11 confere o hash Node = página com o som ligado, desligado e sem Web Audio). Constantes nos próprios módulos; a única
em `config.js` é `ESTADIO` (túnel e bancos: geometria que outras frentes podem precisar).
- **Puros (sem three.js nem DOM; testados em Node no `teste-torcida`):** `festa.js`, `mixagem.js`, `luz-falsa.js`,
  `bandeiras-dados.js`, `fumaca.js` (e `torcida-dados.js`, que ganhou o lado de cá). Aleatoriedade só por gerador próprio
  com semente fixa (`FESTA.semente`, `geradorTorcida`), nunca `m.rng`; o relógio é o do estádio (`emocao.t` =
  `passosTotais`·PASSO, parado na pausa).
- **`festa.js`** (a agenda da torcida; vive em `emocao.festa`): `FESTA` (cantos, batucada, vaia, sinalizadores,
  bandeirão, ola), `PONTOS_SINALIZADOR` ({organizada, quinas, visitante}), `criarFesta`, `zerarFesta`,
  `festaEvento(f, ev, ctx, disparar)` (chamada por `emocaoEvento` ANTES do ânimo: o gol corta o canto e agenda o canto de
  festa, os sinalizadores e o bandeirão; a `saida` do 1º e do 2º tempo acende sinalizadores e abre o bandeirão;
  `intervalo`; `fimDeJogo` com vitória da casa), `festaReacao(f, tipo)` (uma reação abaixa o canto), `festaPasso(f,
  emocao, ctx, dt, disparar)` (por passo, no fim de `emocaoPasso`: troca de canto — cantando ~2/3 do tempo calmo —, canto
  de incentivo com a casa atacando, vaia com a posse longa do visitante — 1 s por s no campo todo, 2 s por s rondando a
  área da casa, vaia em `FESTA.vaia.segura` = 35 (~2 por partida de 2 × 4 min; a regra antiga, só perto da área, dava 0
  em partidas inteiras) —, apaga sinalizadores,
  dispara a ola com o agito baixo por 40 s), `nivelCanto(f, t)` → {nivel, fase 'cantando'|'cantando-fim'|'pausa',
  clipe, lado}, `fogoSinalizador(s, t)` (0–1), `aberturaBandeirao(f, t)`, `estadoOla(f, t)` → {theta, largura, forca,
  ativa}, `olaPeso(x, z, ola)` e `OLA_GLSL` (a mesma conta no shader), `forcarFesta(f, {sinalizadores, cor, bandeirao,
  ola})` (testes e prints). O gol de um lado cancela o canto de festa que o outro ainda ia cantar (gol da casa e, logo
  depois, gol do visitante: canta o setor visitante, não a festa da casa). Pirotecnia SÓ em momento marcado (saída do tempo, gol, vitória), nunca acesa no meio de um
  lance qualquer; no máximo `FESTA.sinalizadores.max` (8) ao mesmo tempo.
- **`mixagem.js`**: `MIXAGEM` (alvo −16 LUFS, leito, agito, canto, batucada, reação, apitos, vaia),
  `nivelamento(lufs)` (ganho que leva uma gravação medida ao alvo), `abaixamento(emocao, t)` (as reações abaixam o
  leito e os cantos ~4 dB), `alvosMixagem(emocao, out)` → {ambiente, agito, canto, cantoClipe, cantoLado, batucada,
  proximoCanto, abaixa}: a MESMA conta para o som e para os testes (Node).
- **`som.js`** (Web Audio, DOM): cadeia `fontes → bus → filtro (pausa) → pre → mestre → limitador → destino`;
  `SOM.arquivos[*].lufs` (medido) nivela cada gravação; `SOM.cantos` na ordem de `FESTA.cantos.papeis`; cantos
  decodificados sob demanda (no máximo `SOM.cantosNaMemoria` = 2; o MP3 baixado fica, o `AudioBuffer` sai); canto do
  setor visitante com passa-baixas e pan à esquerda, organizada (batucada) à direita (`SOM.pan`);
  `navigator.audioSession.type = 'playback'` com o som ligado (o iPhone no silencioso toca; desligado volta a 'auto';
  nunca 'transient'); `statechange` e `visibilitychange`/`pageshow` retomam e, se o contexto não volta a 'running'
  (iOS 'interrupted'), os ouvintes de gesto continuam armados; `estado` é sempre o do contexto. Novos: `relogioBatida`
  (s no tempo da batucada: o pulo da organizada acompanha o som), `info.{estado, decodificados, lacos, cantosTocando,
  cantos, cantoAgora, niveis, contexto, sessao, ouvindoGesto, memoriaMiB}`. Limitador `SOM.limitador` (pico ≤ −1 dBFS
  medido no grito do gol).
- **`luz-falsa.js`**: `LUZ_FALSA`, `UNIFORMS_LUZ` ({uFlare: vec4[8] (x, y, z, força), uFlareN}),
  `atualizarLuzFalsa(festa, t)`, `luzFalsaEm(uFlare, p)` e `LUZ_FALSA_GLSL`: a luz vermelha dos sinalizadores entra por
  UNIFORM no shader da torcida, da arquibancada e das bandeiras — nunca `PointLight` (mudaria `numPointLights` e
  recompilaria todos os materiais).
- **`bandeiras-dados.js`**: `BANDEIRAS` (quantidades por qualidade, onda), `TEXTOS_FAIXAS` (nomes FICTÍCIOS),
  `faixas()`, `bandeiras()`, `bandeiroes()` (lado de lá 40 × 10 m; organizada 24 × 14 m), `pontoBandeira(a, b, fase,
  t, animada)` e `BANDEIRA_GLSL`, `ondaBandeirao(u, v, larg, t, animada)` e `BANDEIRAO_GLSL` (GPU = JS conferido no
  `teste-estadio`), `sobBandeirao(p, b, abre, margem)` e `SOB_GLSL` (debaixo do pano aberto: as bandeiras de mastro
  abaixam e os torcedores seguram o pano — braços em V, sem pular; `BANDEIRAS.sob`; altura 2,3 m e onda 0,25 m para o pano
  nunca descer abaixo das mãos: ninguém fura o pano, `teste-torcida`; GPU = JS no `teste-estadio`). **`bandeiras.js`**: `criarBandeiras(cena, {qualidade, hora})` → {mesh (1 chamada, opaca, desenhada
  antes da torcida), uniforms (uAbre), atualizar(festa, t), definirQualidade (prefixo por `drawRange`), definirHora,
  dispose}; atlas 1024² desenhado em canvas.
- **`fumaca.js`**: `FUMACA` (vida, subida, vento para FORA do campo, tamanho, alfa, partículas por qualidade: Baixa 0),
  `fumacaParticula(s, p, P, t)` e `FUMACA_GLSL` (o caminho de cada partícula sai do shader: nada simulado na CPU).
  **`sinalizadores.js`**: `criarSinalizadores(cena, {qualidade, hora})` → {mesh (1 chamada, só visível com fogo ou
  fumaça; núcleo + halo + fumaça numa malha instanciada, mistura pré-multiplicada), atualizar(festa, t),
  definirQualidade, definirHora, quantas, medirOverdraw(renderer, camera, escala) (em telas cheias), dispose}.
- **`torcida-dados.js`**: setor 3 = lado de cá (z +), `GRUPOS` (lado, fundo+x, fundo−x, ca-frente, ca-cima: uma malha
  cada), `cameraNoLadoDeCa(p)` (a câmera de TV fica DENTRO da arquibancada de cá: com ela lá, a arquibancada e a
  torcida de cá saem do desenho), `cadeiraNoTunel(x, y)`, `TORCIDA.ocupacaoFrente`/`ocupacaoCa`/`frente` (as 9
  fileiras da frente quase cheias), `gerarTorcidaNiveis` (lado de cá com sorteio próprio: os outros setores não mudam).
- **`torcida.js`**: 5 malhas instanciadas (uma por grupo), `atualizar(t, emocao, camera, batida, desenha)` (ola, luz
  falsa, quem está debaixo do bandeirão, bandeiras, sinalizadores e o corte por caixa; o lado de cá nunca com a câmera
  dentro dele), `bandeiras`, `sinalizadores`, `mostrarFesta(v)`. Pré-carga: no 1º quadro DESENHADO de verdade (`desenha`;
  com o celular em pé nada é desenhado) os grupos fora do quadro e os sinalizadores vão para a GPU com 0 instâncias (geometria e programa prontos, nenhuma chamada de desenho) — o 1º corte de câmera não engasga e a
  memória da GPU não sobe no meio do jogo (`teste-desempenho-celular`, "sem vazamento").
- **`campo.js`** (só arquibancada/entorno/placas): arquibancada do lado de cá espelhada com o TÚNEL (`ESTADIO.tunel`),
  teto curto, os bancos de reservas (`ESTADIO.bancos`) na MESMA malha (somem com ela: no celular a TV pegava a cobertura
  deles no canto de baixo) e três caixas de corte; verso das placas do lado de cá em painéis
  verdes (sem a faixa preta); `atualizar(t, camera, desenha)` tira o lado de cá do desenho com a câmera dentro dele (pré-carga
  igual à da torcida, 1 chamada vazia só no 1º quadro); `ladoDeCa` (testes).
- **`config.js`**: `ESTADIO = {tunel: {x, z, largura, altura, profundidade, laje}, bancos: {x, z, altura}}`.
- **`main.js`** (ganchos mínimos): `campo.atualizar(t, camera, renderizar)`, `torcida.atualizar(t, emocao, camera,
  som.relogioBatida, renderizar)`; API `estadio.{torcida.grupos, torcida.ladoDeCa, bancosVisiveis, festa, festaVisual, forcarFesta(o),
  mostrarFesta(v), overdrawFumaca()}`.
- **Orçamento** (medido): chamadas de desenho no jogo +1 (faixas/bandeiras/bandeirões) e +1 só com sinalizadores
  acesos (`teste-estadio` item 12: ≤ 2; câmera de TV no PC Alta, 20 instantes: publicada 26–27, nova 28–29); overdraw da fumaça ≤ 0,5 tela no pico do gol (medido 0,2); Baixa sem fumaça;
  sons novos ~0,5 MB (todos 1,37 MB, baixados depois da página pronta); memória do áudio ≤ 30 MiB.
- **Testes**: `tools/teste-som-jogo.mjs` (navegador, CI: M1–M11), `tools/teste-torcida.mjs` (Node: seções E e F),
  `tools/teste-estadio.mjs` (itens 11 lado de cá e bancos fora da TV, 12 festa), `tools/teste-desempenho-celular.mjs` (os sinalizadores
  acesos contam à parte na comparação partida × treino).
## Replay — gol, impedimento com a linha e "Replay" da pausa (contrato)
Pedidos do dono de 11/10 ("o replay não funciona"; "quando o jogo parar por impedimento, no replay vai mostrar a linha").
Pesquisa: `PESQUISA-ESTADIO.md` §6. **Só desenho: o replay LÊ um anel do que foi desenhado e a simulação fica PARADA
enquanto ele toca, como na pausa** — o hash no mesmo tick é o mesmo com e sem replay (`hash-igual` e `hash-partida`
IGUAIS; `teste-replay` B1/B2). Constantes em `config.js REPLAY`.
- **`render/replay-anel.js` (puro, Node)**: `criarAnel({ticks, vagas, nj})` → anel fixo (`ticks` × `vagas` × (NJ×3 + 3)
  Float32 + ids/time/goleiro, bola p+q, relógio do estádio e corte por passo; 600 × 24 = 3,36 MB, alocado uma vez) com
  `inicio(tick, tEstadio, cortou)`, `jogador(v, id, time, goleiro, x, z, rumo, pose)`, `fim(bolaP, bolaQ)`, `slot(tick)`,
  `ultimoCorte(de, ate)`, `primeiroCorte(de, ate)`, `primeiro`/`ultimo` (sem buraco; tick que não segue o anterior = mundo novo, recomeça),
  `limpar()`, `bytes`. `lerQuadro(anel, tFracionario, lista, bp, bq, kitDe)` → n (itens no formato do
  `jogador3d.atualizar`, sem controlado; interpola pose/x/z, rumo pelo caminho curto e a bola por nlerp; o passo marcado
  como corte não é interpolado; a substituição segue o id), `tempoEstadio(anel, t)`, `bolaNoTick`, `jogadorNoTick`,
  `defensorDaLinha(anel, tick, time, linhaX, tol)`.
- **`render/replay-roteiro.js` (puro, Node)**: roteiro = `{tipo: 'gol'|'impedimento'|'menu', planos: [{de, ate, vel, cam:
  'tv'|'atras'|'lateral'|'linha', congela?: {tick, s, velDepois}}], lado, ...}`; nunca atravessa um corte do anel.
  `roteiroGol(anel, {golTick, chuteTick, lado, golaco?})` (TV 1× do chute − 4 s, ou do último corte, até o gol + 0,8 s;
  atrás do gol 0,5× do chute − 1 s até o gol + 1 s; golaço = chute de ≥ 20 m: + lateral 0,35×; ≤ 12 s, golaço ≤ 14 s —
  o começo da TV encolhe; nenhum plano passa de um corte depois do gol), `roteiroImpedimento(anel, {fotoTick, apitoTick,
  linhaX, idImpedido, time, lado})` (câmera 'linha', 0,6× até o passe, congela 1,6 s nele e segue até o apito — o toque
  do impedido — em ≤ 2,5 s reais: `congela.velDepois` = 1× ou mais depressa com o apito longe do passe, até 2× (apito até
  5 s depois do passe); além disso para antes do toque), `roteiroMenu(anel)` (os últimos 10 s, TV 1×; a menos de 3 s
  de um corte — pausa logo depois de uma montagem de falta/lateral — o lance ANTES do corte, o que parou o jogo; null
  com menos de 0,5 s: o botão da pausa não fecha a pausa), `ehGolaco`, `duracao(roteiro)` e o relógio `criarRelogio`, `iniciarRelogio`,
  `avancarRelogio(r, dt)` (false no fim), `velocidadeAgora`, `linhaDoReplay(r, dt, out)` (`{visivel, x, opacidade}`: só no
  impedimento, do tick do passe em diante, entrando em 0,25 s, até o fim).
- **`render/replay.js` (three.js)**: `criarDiretor({anel, aspecto})` → `{camera, ativo, estado, tick, velocidade,
  redimensionar, aoGol({golTick, chuteTick, lado}), golPendente, depoisDoGol(), descartarGol(), reverGol(golaco),
  impedimento(i), menu(), iniciar(roteiro), pular(), limpar(), avancar(dt), linha(dt), posicionar(bolaDesenhada, dtR)}`.
  Câmeras: 'tv' = outra instância de `camera.js` seguindo a bola gravada e antecipando pela velocidade dela 0,25 s à frente
  no anel; 'atras' (atrás do gol, 6 m, por cima da rede); 'lateral' (beira do campo do lado da TV, 1,6 m, fov 18°);
  'linha' (no x da linha, 15 m de altura, 8 m fora do campo do lado da TV: a linha em pé no quadro; o fov cobre o impedido e
  o defensor da linha no passo do passe, fixo o replay inteiro).
- **GANCHO DO PÓS-GOL**: o evento `gol` só guarda o gol (`diretor.aoGol`); o replay entra quando o pós-gol chega na vez
  dele — hoje `main.js posGol()` na `saida` de bola (ou no `intervalo`/`fimDeJogo`, antes da faixa). A cena de
  comemoração (outra frente) entra ANTES: quando acabar, chama `posGol()` (que chama `diretor.depoisDoGol()`).
- **`main.js`**: `gravarNoAnel(cortou)` em `rodarPasso` logo depois da pose (só copia; ≤ 50 µs, medido ~11 µs); `cortou` =
  jogador levado > 2 m ou bola > 2,5 m. Replay ativo: o laço não roda passos (`laco.ultimo = agora`, como na pausa), o
  passo que abriu o replay interrompe os que sobravam no quadro, `desenharReplay` desenha do anel (rede re-balança com o
  relógio gravado; sem marcas de queda nem do lateral; a linha pelo `linhaImped.mostrar(diretor.linha(dt))`). Pula:
  qualquer ação (Esc/Start não abre a pausa), um botão APERTADO durante o replay (o já segurado não conta), clique ou
  toque (camada `#replay`); no pulo, a entrada é solta e o botão do controle segurado só vale de novo depois de solto.
  Sons do passo que abriu o replay do gol (o apito da saída) tocam no fim dele. Um passo rodado com o replay ativo (só pela
  API `rodarPassos`) encerra o replay. Mundo novo: anel e diretor limpos. Depois do replay do impedimento, a linha parada
  do apito não se repete ao vivo enquanto a bola não rola (`linhaNoReplay`).
- **Evento `impedimento`** ganha `tickFoto` (o passo da jogada do companheiro: a foto da Regra 11 — o quadro congelado).
- **`render/linha-impedimento.js`**: `mostrar(null | {visivel, x, opacidade})` — desenho comandado da linha do lance
  (amarela, 1,8×), sem ler o mundo.
- **HUD/página**: `hud.replay(ativo)` (classe `em-replay` no `html`: minimapa, menu, avisos, carga, cartão, painel e botões
  de toque somem; marca "REPLAY" no canto de cima à direita — a marca da transmissão, nenhum lance vira texto; "Pular" só
  com toque, ≥ 48 px; a faixa verde `#replay-faixa` cruza a tela na entrada e na saída, 0,4 s, sem bloquear nada; nada
  disso no modo de prints, a não ser a marca). Pausa: botão "Replay" (`data-cmd="replay"`, só na partida) e o ajuste
  "Replays automáticos" (`data-grupo="replayAuto"`, salvo em `golaco.prefs.v1.replay`; `?replay=0|1` força).
- **API (`window.__golaco.replay`)**: `estado`, `anel {primeiro, ultimo, bytes}`, `custo {gravarMsPorPasso, passos,
  quadroReplayMs, quadros}`, `zerarCusto()`, `medirGravacao(n, lotes)` (ms por gravação, mediana dos lotes),
  `automatico(v?)` (sem salvar), `golPendente`, `pular()`, `menu()`, `gol(golaco?)` (o último gol de novo).
- **Testes**: `tools/teste-replay-anel.mjs` (Node, padrão: anel, roteiros e relógio, e o replay de um gol e de um
  impedimento de verdade em Node) e `tools/teste-replay.mjs` (navegador, CI): gol roteirizado (começa na saída, mostra o
  chute e a bola entrando, simulação parada, 2 planos, só a marca na tela, apito depois), hash com × sem replay (`--base`
  compara outra versão), gol natural, impedimento (linha só do passe em diante, no x do lance, câmera alinhada, congela ≥
  1,2 s, não fica parada depois), pausa, Esc, tecla do jogo, toque no celular, "desligado" salvo, custos. Os testes de
  navegador que não são do replay abrem com `?replay=0` (o replay seguraria a simulação ~10 s depois de um gol).
  `tools/lib/acha-gol.mjs` ganhou `comoPagina` (a entrada da IA pelo humano como a página entrega: o lance do laço da
  página).

## Comemoração do gol (pedido de 11/10: "não tem cena de comemoração!!!"; contrato)
Pesquisa: `PESQUISA-ESTADIO.md` §10. **Só desenho: a cena anda num mundo à parte (cópias dos 22) e a simulação nunca é
escrita** — a página só SEGURA o laço no passo antes da montagem da saída (gol + 149) enquanto a cena roda; a saída sai no
mesmo tick (gol + 150), com o mesmo hash (`hash-igual` e `hash-partida` IGUAIS; `teste-comemoracao` 11 e
`teste-comemoracao-tela` A4/B5). Ordem na partida: gol → comemoração (6–8,5 s; curta ~4,5 s) → replay → saída de bola.
Constantes em `config.js COMEMORACAO`.
- **`js/comemoracao.js` (puro, Node)**: `planejarComemoracao(m, gol {tick, time, id, contra}, {timeHumano, ultima,
  variante?, corrida?})` → plano `{golTick, time, s, curta, autorId, contraId, contra, alvo {x, z, ux, uz, nome:
  'bandeirinha'|'fundo'|'lateral', d0, perto}, variante, corrida, colegas [ids], colegasPerto, reacaoId, hash}` (só lê o
  mundo). Quem comemora: o autor de verdade (`render/autor-gol.js`); gol contra ou sem autor do time que marcou → o de
  linha do time que marcou mais perto da bola (o autor do gol contra vira 'contra': agachado com as mãos na cabeça). Alvo:
  o mais perto a ≥ 8 m (curta: 6 m) entre a bandeirinha do lado dele, a linha de fundo diante da torcida (x = ±51, z =
  ±12) e a lateral do lado da TV; além de 22 m (curta: 13 m) ele vem para perto na mesma reta. Finalização
  `escolherFinal(tick, id, ultima, curta)` = `hashGol(tick, id)` (Math.imul; nunca o m.rng) entre `FINAIS` ('joelhos',
  'pulo', 'ceu', 'bracos', 'giro'; curta: 'bracos', 'ceu') sem a última; corrida 'aviao' | 'punho' | 'peito' (curta:
  'punho'). Colegas: até 4 de linha mais perto do alvo a ≤ 45 m, saindo com 0,35 + 0,15·i s de atraso.
  `criarCena(plano, m)` → cena (cópia de cada jogador: estado cinemático, pés copiados, mergulho em andamento por
  structuredClone; nada de bola, IA, condução, salto ou arremesso; mundo falso `{tick, posse: null, naMao: null, parada:
  null, bola, jogadores}`). `passoCena(c)` = 1 tick: desejo do roteiro → `passoCorpo` → separação a 0,5 m (quem está num
  golpe não cede; quem sofreu cede 0,25) → `passoPassada` → `passoPeDesenhado` → tick++ → `alturaQuadril` → `pose` +
  golpes + gestos (o goleiro que voava termina com `passoMergulho/fixarMergulho/pesMergulho`). `avancarCena(c, dt)` roda
  os ticks inteiros e guarda `c.alfa` (o desenho interpola `ant → atu`); `tempoCena`, `faseEm(c, tk)`, `faseCena(c)`
  ('rede' | 'corrida' | 'final' | 'abraco' | 'reacao' | 'fim'), `duracaoCena`, `infoAtores`. Por ator: `ant`, `atu`
  (Float32Array NJ×3), `x0/z0/r0 → x1/z1/r1`, `noAr` (os pés desenhados fora do chão por um golpe: deslize, pulo, giro,
  pulo do grupo), `desliza`, `ajoelhado`, `agacha`. `planoCamera(c, {pequena, aspecto}, out)` → `{nome: 'rede' |
  'steadicam' | 'contraplano' | 'reacao' | 'fim', fase, de: [x, y, z], para: [x, y, z], fov}`: função pura das posições
  do autor guardadas por tick (média de 0,3 s + a velocidade média × meia janela: sem atraso andando reto) — steadicam
  6,5 m à frente e 2,4 m do lado da TV, 1,6 m de altura, fov 32; contraplano 7,5 m atrás do grupo e 2,5 m de lado (o lado com
  menos gente perto da lente nos próximos 0,8 s, escolhido uma vez no começo do abraço: `c.ladoContra`) olhando 6 m além
  dele a 2,4 m de altura (a torcida atrás do alvo enche o fundo; o resto do time para a 10 m, atrás da câmera), fov 36; reação de frente para quem sofreu (puxada para o lado da
  TV), 4,8 m, fov 30, girada em volta dele pelo giro escolhido UMA vez no começo da reação (`c.giroReacao`: entre 0, ±0,5 e
  ±1 rad, o de menor custo — gente na frente da lente a < 2,2 m dentro do ângulo do quadro ou perto da linha de visão,
  integrado no próximo segundo pela posição + velocidade; o 0 fica se o custo dele for ≤ 0,03 m·s — contraprova: um
  defensor andando para a saída passava a < 1 m da lente em ~15% das cenas curtas; `teste-comemoracao` 13); câmera nunca além de 5,5 m das linhas nem dentro do gol; celular: fov × 0,88 e o assunto no terço
  esquerdo. Exporta `ik`/`ikBraco`/`BRACO`/`ANTEBRACO` do `anim.js` (só exportar: o hash não muda).
- **Golpes e gestos** (todos por IK: os ossos ficam com o comprimento certo): de joelhos (o corpo desliza desacelerando
  até parar no alvo, entre 2,5 e 7 m/s²; pelve na altura de joelhos, joelho 6 cm à frente do quadril a 6,5 cm do chão,
  canela deitada para trás; tronco 0,32 rad para trás; os pés deslizam presos ao corpo até ele parar, depois ficam
  plantados onde a pose os desenha); pulo (agacha 0,2 s, estende 0,1 s, voo balístico de 0,5 m com as pernas encolhendo
  0,16 m, aterrissa 0,35 s; o giro dá uma volta inteira no ar); agachado (pelve 0,3 m abaixo, tronco para a frente,
  joelhos para a frente com os pés onde estão); pulo do grupo no abraço (0,13 m a 1,8 Hz, com o autor em pé). Gestos =
  alvo da mão no referencial do rumo a partir do ombro + polo do cotovelo, com peso suave e mistura de um gesto para o
  outro (a mão nunca salta). Quem sofreu: para 0,8 s, anda a ≤ 1,3 m/s para a saída cabisbaixo, mãos na cintura (id par)
  ou na cabeça (ímpar).
- **`main.js` (diretor)**: no evento `gol` da partida (e `comemoracaoLigada`), `iniciarComemoracao` monta o plano e a
  cena. Laço: a cena anda no relógio do desenho (`avancarCena(c, dt)`, parada na pausa); `seguraSimulacao()` = cena
  'rodando' e `estado === 'gol'` e `tick + 1 − desde ≥ golPausa` → o passo não roda (`laco.acum` não acumula); a
  entrada do humano NÃO vai para a simulação durante a cena (`ENTRADA_NEUTRA`; a demo segue). `desenharQuadro` desenha os
  atores da cena (interpolados por `c.alfa`) no lugar dos da simulação, sem anel nem seta do controlado, sem marcas do
  gramado, barra de força nem cartão. Câmera: até o 1º corte (`rede`, 1,2 s) a câmera do gol do jogo; no 1º corte sai o
  "GOL!" e `cam.encerrarGol()`; depois `cam.definirCinema(planoCam)`. Pular: um botão APERTADO depois de 0,5 s (o que
  estava segurado ou foi apertado antes não conta), qualquer ação de tecla (Esc, Enter → ação `pular`, R, C, H...), clique
  ou toque na camada `#comemoracao` (o "Pular" do toque é o alvo visível). `fimComemoracao(pulou)`: estado 'solta' (a
  cena fica parada no último quadro até a saída); pulada antes da hora, os passos que faltam até a saída rodam a
  `passosCortina` (40) por quadro com a faixa verde cruzando a tela (`hud.cortina()`); o aperto que pulou não vira jogada
  (entrada solta e bloqueada/desbloqueada, como no replay) e NÃO pula o replay (outro aperto pula). Quando a camada sai
  (`encerrarComemoracao`), `entrada.reposicionar()` refaz o analógico de descanso (calculado com os botões escondidos ele ia
  para o alto da tela). Na `saida` (ou
  `intervalo`, `fimDeJogo`, `recomeco`) a cena é descartada (`encerrarComemoracao`) antes do `posGol()` do replay. Treino:
  sem cena (o efeito leve de sempre). `?comemoracao=0|1` força; sem opção na pausa (a pausa não cabe sem rolar em 844×390).
- **`render/camera.js`**: `definirCinema(plano | null)` (o mesmo objeto do `planoCamera`, atualizado por quadro), `cinema`
  (nome do plano ou null); corte quando o nome muda; dentro do plano, a câmera segue o plano como vem (já suave); "reduzir
  movimento": a posição fica onde o plano começou e só o olhar segue. `foco()` = para onde a câmera de cinema olha.
- **HUD (`hud.js`, `index.html`, `css/estilo.css`)**: `hud.comemoracao(ativo)` (classe `em-comemoracao`: minimapa, menu,
  avisos, barra de força, cartão, dica, painel, faixa e botões de toque somem — só o placar e o "GOL!" até o 1º corte;
  camada `#comemoracao` com o "Pular" só com toque, ≥ 48 px no canto de baixo à direita), `hud.cortina()` (a faixa verde).
- **API (`window.__golaco.comemoracao`)**: `ativa`, `estado` ({fase, t, duracao, k, estado: 'rodando' | 'solta', rapida,
  autor, alvo, variante, corrida, curta, time, golTick, colegas, reacao, contra, plano, kFinal, kFimFinal, kFimAbraco,
  kFim, kPulo}), `atores()`, `naTela(id?)` (caixa px da pose desenhada), `pular()`, `ligada(v?)` (sem salvar),
  `forcarFinal(v)` (a do próximo gol), `custo` ({msPorTick, ticks}), `zerarCusto()`. `estadio.planoCamera` = 'comemoracao'
  com a câmera de cinema.
- **Testes**: `tools/teste-comemoracao.mjs` (Node, padrão; `--js <pasta>` mede outra versão: sem o módulo, reprova) —
  5 gols naturais (sementes conhecidas; se pararem de ter gol, as próximas) + 3 roteirizados (`tools/lib/gol-node.mjs`:
  time 0, time 1 = curta, gol contra): NaN, ossos ±0,5 cm, pé plantado ≤ 0,05 m/s e pé no ar ≤ (2,5v + 3)·dt fora dos
  golpes (a régua do `teste-patinacao`), autor ≤ 3 m do alvo em ≤ 4,5 s, ≥ 2 colegas a ≤ 1,2 m até 6,5 s (cena normal com
  ≥ 2 a ≤ 45 m), pelves ≥ 0,40 m, joelhos 0,02–0,12 m, pés ≥ 0,2 m por ≥ 0,4 s no pulo e no giro, mãos ≥ 0,2 m acima da
  cabeça ≥ 0,5 s no céu, mãos acima da cabeça ≥ 1 s em toda cena, quem sofreu com gesto ≥ 70% e ≤ 2,5 m/s depois de 1,2 s,
  duração e fases, variedade (12 gols e 2000 sequências), pureza (hash antes = depois; tick a tick = quadros variados) e
  custo ≤ 0,6 ms/tick. `tools/teste-comemoracao-tela.mjs` (navegador, CI e antes do deploy; `--raiz <pasta>`): fases e
  duração, autor no quadro ≥ 85% com ≥ 100 px, simulação parada no gol + 149 com o relógio parado, ordem cena → replay →
  saída no tick de sempre com o mesmo hash, só o placar na tela, torcida ≥ 30% no contraplano, pular (antes de 0,5 s não;
  depois em ≤ 2 quadros; o mesmo aperto não pula o replay), celular ("Pular" sem encostar, botões escondidos, toque), gol
  natural, treino sem cena, CPU do quadro ≤ p95 do jogo + 1 ms, console. Os testes de navegador que não são da comemoração
  e atravessam um gol esperando a saída abrem com `?comemoracao=0` (`teste-estadio`, `teste-desempenho-celular` — que
  mede a cena à parte com a CPU 4× —, `prints.mjs` fora das cenas dela e das do replay).

## Cena de substituição e faixa ENTRA/SAI (pedido de 12/10; contrato)
Pedido do dono: "quando tiver substituição, quero que tenha a cena de substituição, só jogador saindo e entrando, e
embaixo, no modelo, a informação de quem entra e quem sai". Pesquisa: `PESQUISA-ESTADIO.md` §11. Constantes em `config.js
SUBST`. **Só desenho**: a troca acontece na simulação como sempre (`escalacao.js aplicarPendentes`, evento `substituicao
{time, sai, entra}`); a cena anda num mundo à parte (cópias) e a página só SEGURA o laço depois do passo das trocas
enquanto ela roda (como o replay). `hash-igual` e `hash-partida` IGUAIS; o hash no tick T + 700 é o mesmo com a cena
ligada, desligada e em Node (`teste-substituicao-tela` T1).
- **`js/substituicao.js` (puro, Node; sem m.rng nem Math.random)**: `pontoDeSaida(x, z)` (o ponto do contorno mais perto
  — Regra 3.3; na linha de fundo nunca na boca do gol: |z| ≥ `golRaio + golFolga`); `planejarSubstituicao(m, pares,
  {timeHumano, posAntes(id)})` → `{tick, pares (o do humano primeiro; por par: time, sai, entra, goleiro, saida {x, z, nx,
  nz, linha}, d0 (3,0–3,6 m da linha no 1º quadro do plano, pelo hashGol), para (onde ele para além da linha, longe do
  gol, da quina, dos outros e dos caminhos dos reservas), espera (lugar do reserva na grama do lado de cá: z = 35,2, x =
  ±(0,7 + 0,8k)), vaga (onde o reserva está na simulação), numSai/numEntra, rentaGol}, planos [{nome: 'sai' | 'sai2' |
  'entra', par, t0, t1}], duracao}` (só lê o mundo; 1 par = 5,0 s, ≥ 2 pares = 6,4 s, teto 6,5); `criarCenaSubst(plano, m)`
  → cena (cópias dos 22 por `comemoracao.js criarAtor`; a cópia de quem entra vira quem SAI, com o id e o uniforme dele;
  os reservas e o quarto árbitro, id `SUBST.idQuarto` = 203, kit 'arbitro', em (0; 35,6); a bola copiada — no chão se
  estava na mão de quem sai; só o par 0 tem pré-rolagem de 1,1 s, os outros começam parados); `passoCenaSubst(c)` = 1
  tick com a MESMA locomoção do jogo (`passoCorpo → passoPassada → passoPeDesenhado → alturaQuadril → pose`), desvio
  de Reynolds para quem anda, separação a 0,55 m, quem freou e assentou fica fixo (sem custo); `avancarCenaSubst(c, dt)`
  (devolve `alfa`), `tempoCenaSubst`, `duracaoCenaSubst`, `planoEm(c, t)`, `placaNasMaos(c, pose, out)`, `paresDaPlaca(c,
  t, out)` ({indice, n, time, entra, sai, corEntra: 'verde', corSai: 'vermelho'}: troca a cada `placaTroca` s, o do humano
  primeiro), `planoCameraSubst(c, {pequena, aspecto}, out)` → `{nome: 'sai' | 'sai2' | 'entra' | 'fim', de, para, fov}`
  (SAI: câmera de ala FORA da linha, ≥ `lenteMin` + 0,5 m de todo ator, sem ninguém grande no quadro, nunca em sólido
  — `estadio-forma.js solidoEm`; o corpo inteiro acima da faixa: pés a `SUBST.pes` do quadro; ENTRA: câmera baixa no
  gramado do lado de cá, pan do quarto para o reserva; celular: `comemoracao.js ajustarCelular`), `consumirEventosSubst(c,
  out)` (`{tipo: 'substituicao', cruzou: true, time, sai, entra}` quando quem sai cruza a linha: palmas da torcida dele em
  `render/emocao.js`), `infoAtoresSubst(c)`. Quem entra cruza a lateral só DEPOIS do par dele ter saído, pela linha do
  meio-campo (|x| ≤ 1 m), a partir de `sinal` + `escalona`·ordem s do plano ENTRA. `comemoracao.js` só passou a exportar
  `copiaJogador`, `criarAtor`, `separar(c, min)`, `maoEm`, `gesto`, `limitarCamera`, `ajustarCelular` (a comemoração não
  mudou).
- **`render/placa-subst.js`**: `criarPlacaSubst(cena)` → `{mesh, estado {visivel, entra, sai}, mostrar(entra, sai),
  atualizar(pos | null, desenha)}`: caixa 0,58 × 0,38 × 0,03 m com `CanvasTexture` 256 × 168 de dígitos de 7 segmentos
  (verde ▲ entra, vermelho ▼ sai), redesenhada só quando o par muda; pré-carga no 1º quadro desenhado (`setDrawRange(0, 0)`:
  o programa e a textura sobem antes da 1ª cena — `teste-substituicao-tela` T9).
- **`main.js`**: fila única `filaCenas` (gol → comemoração → replay inteiro → substituição → recomeço; itens `{tipo:
  'subst' | 'faixaSub', pares}` ou funções das faixas de intervalo/fim). `decidirSubst(eventos)` no fim de `rodarPasso`:
  trocas do intervalo (o tick do 'intervalo' ou o fim dele) → sem cena, faixa na saída do 2º tempo; com o replay tocando
  ou a fila cheia → entra na fila; senão a cena (ligada) ou só a faixa. `rodarPassos` (testes) nunca abre a cena. O som
  do passo que abre qualquer cena vai para `somAdiado` e toca quando a fila esvazia (o apito da saída depois da cena:
  `estadio.sonsPedidos`). Laço com a cena: `laco.ultimo = agora` (a simulação não anda nem recupera o tempo); pausa, aba
  escondida e celular em pé congelam a cena. Pular: um aperto NOVO depois de `pularDepois` (0,5 s) — botão, tecla (menos
  Esc/P e F3), clique/toque na camada `#substituicao` ("Pular" 112 × 52) —; o aperto que pulou não vira jogada
  (`entrada.soltarTudo` + `bloquear`). Fim (`fimSubst`): corte seco para a câmera de TV, a faixa passa para o jogo (a
  contagem segue), `proximaCena()`. `trocarMundo` cancela a cena, a fila e a faixa. Opção "Substituição: ligada | só a
  faixa" no submenu "Modo de jogo" (`prefs.substituicao`; `?substituicao=0|1` força; desligada por padrão com
  `navigator.webdriver`, `?prints=1` e `?demo=1`).
- **HUD**: `hud.substituicao(ativo)` (classe `em-substituicao`: some o mesmo que na comemoração), `hud.faixaSubst(pares,
  agora, cena | null)`, `faixaSubstQuadro(agora, cena)`, `faixaSubstEstado(agora)` → `{visivel, modo: 'cena' | 'jogo',
  pagina, n, texto, restante, dur}`, `esconderFaixaSubst()`. `#faixa-subst` (role status, aria-live polite): sigla do
  time na cor dele, ▲ ENTRA número nome, ▼ SAI número nome, "1/2" com mais de um par; `data-texto` = a frase do leitor
  de tela ("Golaço FC: entra 22 Wallace Pimenta, sai 9 Diego Albuquerque"). Fica ≥ 4,0 s (mesmo com a cena pulada),
  2,5 s por par (1,8 com ≥ 4), teto 10 s; na cena, a página do plano (SAI/SAI2: o par dele; ENTRA: de par em par).
  Lugar: PC embaixo à esquerda (64 px da borda, 280–520 px; no jogo, sem chegar no minimapa); celular na cena embaixo à
  esquerda (área segura + 14 px, ≤ 64 px de altura, sem chegar no "Pular"); celular no jogo, uma linha compacta no lugar
  do aviso (topo + 74 px, ≤ 360 px, nomes da camisa) com o aviso descendo 42 px (`html.faixa-subst-topo`). Sem aviso de
  texto da substituição (`TEXTO_EVENTO` sem `substituicao`).
- **API (`window.__golaco`)**: `cenaSubst` {`ativo`, `estado` ({plano, tempo, total, k, tick, pares, planos, camera}),
  `atores()`, `camera`, `naTela(id?)`, `placa` {`estado`, `naTela()`}, `pular()`, `ligada(v?)` (sem salvar), `custo`,
  `zerarCusto()`, `fila`, `faixa()`}; `substituicaoDeTeste({pares, time, parada})` (a edição na fila e a parada forçada
  como `bolaParadaDeTeste`; a troca sai pelo `aplicarPendentes` de verdade); `estadio.sonsPedidos`; `estado().programas`.
- **Testes**: `tools/teste-substituicao.mjs` (Node, padrão; `--js <pasta>`: sem o módulo, reprova) — canhão de 49 paradas
  (8 sementes × lateral, escanteio, tiro de meta, tiro livre, pênalti, gol + 5 + 5): S1 duração e o corte para a TV; S2
  Regra 3.3 (≤ 0,5 m do ponto mais perto, nunca a boca do gol, antes do fim do plano dele; no 1º quadro andando 2,2 m/s a
  3,0–3,6 m), quem entra pelo meio-campo só depois do par; S3 NaN, ossos, pé plantado ≤ 0,05 m/s e pé no ar (a régua do
  `teste-patinacao`); S4 corpos ≥ 0,5 m, ninguém nas placas nem no gol; S5 hash e rng iguais, sem Math.random, mesma
  entrada = mesma cena (também em quadros variados); S6 ≤ 0,6 ms/tick e criação ≤ 3 ms; S7 lente ≥ 2,5 m, câmera fora dos
  sólidos, o ator no quadro ≥ 95%, os pés acima da faixa no celular; S8 a placa (números, cores, o humano primeiro) e o
  quarto árbitro. `tools/teste-substituicao-tela.mjs` (navegador, CI e antes do deploy; `--raiz <pasta>`): T1–T10 (hash
  com e sem a cena e em Node; tick parado; faixa em ≤ 3 quadros e ≥ 4 s também pulada e "só a faixa"; pular; gol + troca
  na fila e o apito depois; intervalo sem cena (a troca pedida nele e a feita no apito dele: a faixa na saída do 2º tempo); pausa, aba escondida, em pé, `trocarMundo`; nada sobre nada em 4 telas e a
  opção salva; CPU, chamadas de desenho, programas e memória no celular; a placa ≥ 40 px). `teste-editor-tela` 5 confere
  a faixa (data-texto exato; "ENTRA 22 Wallace" e "SAI 9 Diego" na tela) e `teste-hud-minimo` H7 o submenu sem rolar.

## Pré-jogo (pedido de 11/10; contrato)
Pedido do dono: cenas de fora do estádio, o estádio, a entrada dos times, a fila com a câmera passando, cortes de torcida e
as duas escalações no campinho (~10 s cada, o mesmo fundo). Pesquisa e números em `PESQUISA-PREJOGO.md`. **Só desenho**: o
pré-jogo acontece ANTES do 1º passo da partida (o mundo fica no tick 0; `hash-igual` IGUAL; `teste-prejogo` confere o hash
de `criarPartida` depois dele e 600 passos Node = Chromium) e o apito da saída (`eventosIniciais`) só toca no fim.
- **`js/cortejo.js`** (puro): `CORTEJO` (velocidade 1,45 m/s, espaçamentos no túnel/andando/na fila, colunas, árbitros
  ids 200–202), `criarCortejo(times)` → `{tick, mini, andantes: [{j, id, time (0, 1 ou 2 = árbitro), arb, goleiro, kit,
  k, caminho, s0, sFim, atraso, chegou}]}` (mini-mundo `{tick, posse, naMao, parada, voo, bola}`: só o que a pose e a
  passada leem; lê `m.times` UMA vez, nunca o mundo depois), `passoCortejo(c)` (corpo, passada, pé desenhado, quadril — a
  ordem do `sim.js`), `tempoCortejo`, `fotoCortejo(c)`/`restaurarCortejo(c, f)` (structuredClone), `filaFinal(c)` (a fila
  montada parada, sem simular), `vagaFinal(c, i)`, `chegaram(c)`, `ordemDaColuna(tm)` (capitão, goleiro, vagas),
  `pontoCaminho`, `cabeNoTunel()`. Sem rng. Campo novo que `anim.js`/`jogador.js` passarem a ler do mundo tem que entrar no
  mini-mundo (o `teste-cortejo` pega NaN ou exceção na pose).
- **`js/prejogo-roteiro.js`** (puro): `PREJOGO` (modos, tempos da escalação, preto, mergulho, faixas 2,39:1),
  `criarRoteiro(modo)` → `{modo, planos: [{id, nome, bloco 'cenas'|'escalacao0'|'escalacao1', dur, t0, t1, cam: {de, para,
  fov, suave} | orbita, som, torcida, eventos, cortejo: {tc} | 'fila' | null, fora, transicao, time}], total, blocos,
  fimCenas, tEscalacao, durEscalacao}`, `planoEm`, `blocoEm`, `proximoBloco` (pular), `cameraEm(r, t, out)`,
  `cameraAbertura(t)`, `escuroEm` (preto e mergulho), `escalacaoEm` ({time, entrando, saindo, saiTime, cheia}),
  `sinaisEm` (som e torcida do plano), `pontosDoPlano` (testes), `criarCurva`/`pontoCurva` (Catmull–Rom centrípeta pelo
  comprimento do arco — a conta da three.js, pura).
- **`js/estadio-forma.js`** (puro): `FORA` (fachada, cobertura, cantos, esplanada, bairro, praça, estacionamentos, placa,
  `vaoPlacas` — o vão de ±3 m nas placas de cá na frente do túnel, só no pré-jogo),
  `sdRetArredondado`, `alturaCobertura`, `alturaCanto`, `predios()`, `arvores()`, `carros()`, `torcedoresFora()`
  (posições com semente própria), `solidoEm(x, y, z, folga, fora)` (nome do sólido ou null; o corredor do túnel é livre;
  com `fora` o vão das placas também — o `teste-cortejo` confere que nenhum andante entra em sólido),
  `noCorredorDoTunel`.
- **`js/render/prejogo.js`** (diretor): `criarPrejogo({cena3d, cam, jog3d, bola3d, campo, torcida, som(), mundo(), hora(),
  qualidade(), comToque(), aoFim()})` → `{iniciar(modo, {abertura}), quadro(dt, agoraMs, desenhar, parado) (false quando
  acabou; parado = celular em pé: o tempo não anda e o som fica como na pausa do jogo — `som.cena(null)` e
  `som.atualizar(emo, true)`),
  acao(a) ('pausa' pula tudo), proximo, pularTudo, irPara(t), comecar, cancelar, ativo, naAbertura, api}`. Câmera: escreve
  direto em `cam.camera` (fov do roteiro = vertical em 16:9; mais estreito, a mesma largura; near/far e a névoa por plano,
  restaurados no fim). Desenha o cortejo por `jog3d.atualizar(lista)` (kit `arbitro`), força o lado de cá visível pelo
  frustum (a regra `cameraNoLadoDeCa` é do jogo), um ânimo próprio (`criarEmocao`) para a torcida e o som, `som.cena({ganho,
  filtro})` por plano. A fila parada "respira" só no desenho (peito ±1 cm, peso de um pé para o outro; os pés plantados
  não mexem). **Vão das placas**: no `iniciar` recorta as duas malhas das placas (`placas` e `placas-estrutura` do
  `campo.grupo`) com `Material.clippingPlanes` + `clipIntersection` (|x| < `FORA.vaoPlacas.meia`, z além da linha das
  placas) e `renderer.localClippingEnabled`, e põe 2 pontas escuras; no fim devolve tudo (o jogo tem as placas inteiras
  porque a bola bate nelas em `bola.js`). API `vao` → `{aberto, meia, malhas, recortadas, local, pontas}` (lido da cena).
- **`js/render/estadio-fora.js`**: `criarEstadioFora(cena, {qualidade, hora, aniso, materialTorcida, entorno})` → `{grupo,
  modoFora(v) (o entorno só nos planos de fora), definirHora, atualizar, dispose(), info: {pecas, entorno, triangulos,
  ...}}`. `entorno: false` (o diretor passa quando o roteiro não tem plano de fora nem abertura: curto e só escalação):
  só a estrutura (6 peças, ~760 triângulos). Nada projeta sombra.
- **`js/prejogo-tela.js`** (DOM): `criarPrejogoTela({aoProximo, aoPularTudo, aoComecar, comToque})` → `{raiz (#prejogo,
  criado no body), escalacao, mostrar(v) (põe html.prejogo: o HUD, os controles de toque e a dica somem), abertura(times
  | null), faixas(k, proporção), preto(a), fundoEscalacao(a), atualizar(agora) (A do controle; o Pular some parado),
  pularVisivel, botaoPular}`. Toque/clique = próximo bloco (abertura: começa); Enter/Espaço também (na captura); Esc/P/Start
  chegam pela entrada bloqueada (`main.js tratarAcao('pausa')`).
- **`js/escalacao-tela.js`** (DOM): `criarEscalacaoTela(raiz)` → `{montar(times), mostrar(e) (escalacaoEm + tau),
  esconder(), estado, cartas(t), folha(t)}`; `tamanhoEscalacao(W, H, vertical)` (cartas até 120 × 76; passo ≥ carta + 10
  px). Usa `posicaoNaTela` (editor-time.js) e `svgCampinho` (campinho.js). O movimento sai do relógio do roteiro (nada de
  transição do CSS: o relógio manual dos testes e prints vale).
- **`js/campinho.js`** (puro): `svgCampinho(vertical)` → `{viewBox, html}` (o editor passou a usar; layout idêntico).
- **`som.js`**: `cena({ganho, filtro})` / `cena(null)` (substitui o alvo do barramento e do passa-baixas da pausa);
  `cenaPre`. **`jogador3d.js`**: `KITS.arbitro`.
- **`main.js`** (ganchos): `modoPrejogo()` (`?prejogo=` força; webdriver/`?prints`/`?demo` desligam; senão
  `prefs.prejogo`, padrão 'completo'), `comecarPrejogo(modo, abertura)` (bloqueia a entrada), `fimDoPrejogo()` (libera a
  entrada, corta a câmera, `eventosIniciais()`), `quadro()` (no pré-jogo o laço fica parado: `laco.ultimo = agora`),
  `tratarAcao`, `trocarMundo(m, {prejogo: 'preferencia'|'escalacao'})`, comandos `prejogo` (valor) e `prejogo-ciclo` (o botão "Pré-jogo da
  partida" do submenu "Modo de jogo": o próximo modo; `#estado-prejogo` mostra o atual), API `__golaco.prejogo`
  (`ativo, fase, modo, bloco, plano, indice, tempo, total, fimCenas, planos, pular(), pularTudo(), irPara(t), comecar(),
  iniciar(modo, {abertura}), andantesNaTela(), posicaoAndante(id), escalacao: {visivel, time, cheia, cartas(t), folha(t),
  pular, info(t)}, camera, desenho: {chamadas, triangulos}, somCena, parado, vao, cortejo, fora}`); `quadro()` passa
  `parado` = `retratoBloqueado()`; `desenhar()` desenha o pré-jogo
  quando ele está ativo.
- **Testes**: `tools/teste-cortejo.mjs` e `tools/teste-prejogo-roteiro.mjs` (Node, padrão do CI), `tools/teste-prejogo.mjs`
  (navegador, CI), `tools/prints-prejogo.mjs` (prints de cada plano e das escalações + folhas de contato).

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
- `j.mergulho`: a defesa desenhada do goleiro (mergulho, salto ou em pé) — ver a seção "Pedido de 10/10" abaixo.
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


## Etapa 3 — partida 11×11, tática, IA e "Editar time" (contrato)
Pesquisa: `PESQUISA-ETAPA3.md`. Constantes: `config.js` (blocos `PARTIDA`, `TATICA`, `IA_DEFESA`, `IA_ATAQUE`,
`DEFESA_HUMANO`, `TROCA_AEREA`; cada parte edita só o seu bloco) e os atributos `marcacao`, `desarme`, `visao`,
`folego` (= 65 no padrão; o treino não lê).

**Chave única: `m.times`.** Toda lógica nova (IA tática, troca aérea, regras da partida, parada, hash dos times) só
liga quando o mundo tem `m.times` (a partida). O treino (`'ataque'`, `'conducao'`) fica **bit a bit igual** à base:
`node tools/hash-igual.mjs` (20 sementes × 3 min por cena, hash a cada 600 passos, contra `git archive 980b0b0`) roda
antes de todo commit/merge. Única exceção prevista: os botões de defesa do humano (`defesa.js`) agem também no
treino, mas só com CONTER/DIVIDIDA/PRESSÃO apertados (ou `j.defH` ligado), e nenhum roteiro do treino aperta esses bits.
`js/ia.js` (a IA "clássica" do treino) fica congelado: só exporta `para`, `freiaNaLinha`, `pontoInterceptacao`,
`vaiNaBolaLivre`, `dono`, `acaoIA`, `marcacao` e `entradaIA`.

**Arquivos.** Puros (sem three.js nem DOM; só `MD` e `m.rng`): `elenco.js`, `formacoes.js`, `tatica.js`,
`escalacao.js`, `partida.js`, `ia-tatica.js`, `ia-ataque.js`, `defesa.js`, `troca.js`. Com DOM: `js/editor-time.js`
(sobreposição "Editar time") e `css/editor.css`, além dos de antes (`main.js`, `hud.js`, `entrada.js`, `render/*`).

### Passo da partida
```
main.js (DOM)                  partida.js (puro)
quadro() ─ rodarPasso ──▶ passoPartida(m, entrada, acoes)
  edicaoNaFila ─┘          1. ações-objeto ANTES do passo: aplicarEdicao(m, ed) + m.log.push({tick, acao})
                           2. sim.passo(m, {0: entrada})  (intervalo e fim: só m.tick++, o mundo fica parado)
                              ├ entrada da IA: m.times ? entradaIATatica : entradaIA (também na assistência do passe)
                              │   ia-tatica.js (sem bola) ──▶ ia-ataque.js (com bola) ──▶ null = IA clássica
                              ├ controlado: entradaConter (CONTER) · alvoAereo (bola alta, só com m.times) · pedidoPressao
                              ├ trocarJogador (TROCAR) + trocaAerea(m) (só com m.times)
                              ├ passo 2 (movimento), antes de passoCorpo: troncoConter (o controlado com j.conter
                              │   vira o tronco para o condutor: defesa.js rumoConter, limitado pela velocidade como
                              │   o "olha a bola" da IA) · paredeParada(m, j, mv) (com m.parada: só o PEDIDO muda)
                              ├ desarmes: boteIA (IA) · dividida (controlado, com DIVIDIDA ou j.defH)
                              └ m.parada sem rolar: só o cobrador toca a bola (bolaLivre, goleiro, boteIA, colisaoBolaCorpo)
                           3. regrasPartida(m): relógio, gol, bola fora → parada/saída, intervalo, fim, aplicarPendentes
                           4. eventos de depois do passo (timeEditado / edicaoRecusada)
```

### Módulos (assinaturas finais)
- **`elenco.js`**: `POSICOES` (15 códigos: GOL, LD, LE, ZAG, ADD, ADE, VOL, MC, MD, ME, MEI, PD, PE, SA, ATA → `{nome,
  funcao, lado}`), `FUNCAO` (pos → `j.posicao`: GOL, LAT, ZAG, VOL, MEI, PON, ATA), `PESOS` (nota por posição),
  `CHAVES` (19 atributos gerados, ordem fixa), `ELENCOS` (`golaco`, `ventania`), `fichaDe(id)`, `elencoDoJogador(id)`,
  `h32(a, b)`, `atributosDe(jog)` (determinístico; nota natural = nível ± 1; devolve cópia), `notaNaPosicao(attr, pos)`,
  `encaixeNaVaga(jog, pos)` → `'natural' | 'alternativa' | 'fora'`, `numerosCarta(attr)` → `{RIT, FIN, PAS, DRI, DEF,
  FIS}`, `notaTime(vagas, formacao)` → `{geral, ata, mei, def}`, `estrelas(geral)` (½ a 5).
- **`formacoes.js`**: `FORMACOES` (`'4-3-3' '4-2-3-1' '4-4-2' '4-1-4-1' '3-5-2' '5-3-2'` → `{id, vagas, porId, indice,
  xLinhaSem}`), `ORDEM_FORMACOES` (menu e índice do hash), `vagasDe(formacao)`, `hungaro(custo)`,
  `encaixar(titulares, formNova, elenco, vagasAntigas)` → `{vagaId: id}` (só a tela usa; a edição leva o resultado),
  `BONUS_ENCAIXE`.
- **`tatica.js`**: `TATICA_PADRAO` `{0, 1, 1, 1}`, `FUNCAO_K`, `posicaoTatica(formacao, vaga, tatica, bola, fase, ataca,
  out)` → `out {x, z}` (mundo; `vaga` = id ou objeto Vaga; `fase` `'sem'|'com'`; pura e sem alocar), `alturaLinha(formacao,
  tatica, bola, fase, ataca)` → m, `tercoDaBola(bx, ataca)` → 1|2|3, `faseDoTime(m, time)` → `m.iaTime[time]`.
  **Contrato com a tela:** a prévia desenha `posicaoTatica(..., bola = {x: 0, z: 0}, ...)` — a mesma conta da IA.
- **`escalacao.js`**: `estadoInicialTime(elencoId, {formacao, vagas, tatica}?)`, `vestirVaga(m, j, vagaId)`,
  `rascunhoDe(timeEstado, edicaoNaFila?, time?)`, `situacao(rasc, id)`, `reservasDe(rasc)`, `tocar(rasc, id)` → `{rasc,
  evento}`, `cancelarSubstituicao(rasc, id)`, `mudarFormacao(rasc, f)`, `mudarTatica(rasc, chave, nivel)`, `desfazer(rasc)`,
  `desfazerTudo(rasc)`, `edicaoDe(rasc)` → edição | null, `validarEdicao(timeEstado, ed, elencoId?)` → `{ok, codigo?
  (1–7), motivo?}` (a tela usa a mesma), `aplicarEdicao(m, ed)` → `{ok, codigo?, motivo?, pendente}`,
  `aplicarPendentes(m, t, {intervalo}?)` → n, `misturarTimes(h, m)`.
- **`partida.js`**: `criarPartida({semente, minutosPorTempo, iaClassica, elencos, times, saida, log})`,
  `passoPartida(m, entrada, acoes)` → eventos, `regrasPartida(m)`, `montarSaida(m, time)`, `teleportar(j, x, z, rumo)`
  (corpo E pés juntos: o quadro do teleporte não conta na patinação), `restricaoParada(m, j, x, z, out)` → `out` (o ponto
  permitido mais perto; a IA mira nele), `paredeParada(m, j, mv)` → pedido de movimento (ver Parede), `zonaLivre(m)`
  (ninguém dentro da restrição, com 5 cm de tolerância), `alvoCobranca(m, j, tipo?)` → `{dx, dz, tipo, forca, para}`,
  `entradaCobranca(m, j)` (a cobrança jogada pela IA pelo humano), `minutoDeJogo(m)` → 0..90, `entradaDemoPartida(m)`,
  `misturarPartida(h, m)`, `cobradorDaSaida(timeEstado)`, `vagaDoJogador(timeEstado, id)`, `ESTADOS`, `TIPOS_PARADA`.
  - **Parede da parada pela LOCOMOÇÃO** (`paredeParada`, chamada pelo `sim.js` no passo 2 antes de `passoCorpo`): muda
    só o pedido de movimento, nunca a posição do corpo (os pés seguem pela passada; antes a parede empurrava o corpo a
    até 7 m/s com os pés plantados — `teste-patinacao`, cena "bolas paradas com gente no raio"). Dentro da restrição:
    sai pelo ponto de `restricaoParada` a √(2·`freioParede`·(fundo + `margemParede`)), entre `saiParede` e `empurrao`
    m/s. Fora: a componente do pedido para dentro fica ≤ √(2·`freioParede`·(distância à borda − `margemParede`)) —
    freia antes da borda. Com o CORPO indo para dentro (trombada perto da borda, ou embalado quando a bola morre) — fora,
    mais depressa que √(2·`JOGADOR.freio`·distância à borda); dentro, ainda entrando —, o pedido é a velocidade do corpo
    refletida na borda (a de lado fica; dentro, para fora pelo menos a velocidade de saída): a locomoção freia a entrada
    pela aceleração lateral e pela freada, sem a inversão que freava tudo na linha (`teste-partida` F: 192 cenas com a
    velocidade de uma trombada que a freada normal para antes do raio — ninguém entra). Vale da bola morta (lateral,
    escanteio e tiro de meta; a saída é montada por teleporte) até a bola rolar; o cobrador e quem está `'parado'` ficam
    de fora.
- **`ia-tatica.js`**: `entradaIATatica(m, j)` → `{x, z, botoes}` (despacho: `iaClassica` ou goleiro com a bola nas mãos
  → `entradaIA`; recebe/corrida/bola livre; condutor → `condutorTatico`; fase `'com'` → `apoioTatico`; sem bola → a IA
  sem bola), `estadoIA(m, j)` (prepara `j.ia` para usar o `para()` de fora do ia.js).
  - **Papéis sem a bola, nesta ordem** (`semBola`): PRESSÃO do humano → contrapressão (janela `IA_DEFESA.contrapressao.s`
    depois da perda: 0 / 4 / 7 s por nível de pressão) → 1º homem (aperta/contém) → 2º homem (cobre; sendo da linha de
    defesa, no máximo `IA_DEFESA.coberturaFundo` m atrás da própria referência) → marcação individual na área →
    **recomposição** (`recompor`, `ramo 'recompoe'`) → referência (linha/zona, ponto calmo).
  - **Recomposição em disparada** (PR "IA intensa"; `TATICA.recomp`): quem está mais de `liga` m (nos `janela` s depois
    da perda; fora dela, `ligaOrganizado` m) à frente do alvo — a referência sem a bola e, para quem não é da frente
    (vaga com x ≥ 0 sem a bola), também `atras` m atrás da linha da bola (com um passe deles no ar, o ponto de chegada;
    o meio nunca a menos de `TATICA.meioAtras[3]` m do gol) — volta pelo modo pressa até ficar a menos de `desliga` m
    dele, com CORRER (sprint) a mais de `corre` m e com urgência (bola a menos de `urgente` m além do meio para o meu
    lado, ou vindo para o meu gol a mais de `vUrgente` m/s); na janela, também quem ficou `ligaBola` m à frente da bola com a
    referência atrás dela (depois de uma recomposição acabada, só `respiro` s depois). Caminho pelo lado do gol (o z
    anda `lateral` do caminho enquanto está à frente da bola); no máximo `max` s (depois, `pausa` s sem recomeçar). Chute
    deles no ar e bola parada desligam. Estado em `j.iaT` (`recomp, recompDesde, recompBloq, recompFim`).
  - Quem segue a referência ou recompõe **contorna o condutor adversário** que está no caminho (`desviaCondutor`,
    `IA_DEFESA.desvio`): passar por dentro dele empurrava o corpo do condutor e, com a referência presa ao corpo dele, o
    bloco inteiro andava para o próprio gol.
  - Bola livre: CORRER só quando é disputa (um adversário chega até `IA_DEFESA.livre.disputa` s depois).
  - `tatica.js posicaoTatica` (sem a bola, só com a bola no meu campo — a prévia com a bola no centro não muda): o meio
    (vaga com x < 0 sem a bola, fora da linha de defesa) fica `TATICA.meioAtras[0]` m atrás da bola, mas não a menos de
    `[1] + [2] ×` (distância natural da vaga até a linha) m à frente da linha de defesa nem a menos de `[3]` m do meu gol.
- **`ia-ataque.js`**: `apoioTatico(m, j)`, `condutorTatico(m, j)` → entrada ou **null (= a IA clássica decide)**.
- **`defesa.js`**: `condutorAdversario(m, j)` → o condutor adversário que j pode marcar (bola no pé, no chão, fora da
  parada) ou null; `entradaConter(m, j, e)` → entrada ou null (estado em `j.conter`: filtro da velocidade do condutor e
  histerese do CORRER); `rumoConter(m, j)` → rumo do tronco para a bola com o CONTER valendo neste tick, ou null (o
  `sim.js` usa no passo 2); `chanceDividida(j, d0, bx, bz)`; `dividida(m, j)` (estado em `j.defH`); `pedidoPressao(m,
  j)` (grava `m.pedidoPressao[time] = tick`); `pressaoPedida(m, time)`; `pressionadorDe(m, time)` → id do companheiro
  que aperta (uma vez por tick, em `m.pressaoHumano[time] = {tick, id}`; −1 = ninguém); `entradaPressao(m, j)` → a
  entrada de referência de quem aperta, ou null (a IA tática decide usar). **`iaClassica` desliga tudo isto.**
- **`troca.js`**: `trocaAerea(m)` (troca por `assumirControle`, evento `trocaAerea {id}`), `alvoAereo(m, j, e)` → entrada
  ou null. **`iaClassica` desliga** (o "antes" dos testes não troca nem ajuda); também não age com a partida em
  `'gol'`, `'intervalo'` ou `'fim'`.
- **`entrada.js`** (DOM): `ACOES_TECLA`, `TECLA_BIT`, `SENTIDO_FASE` (botão físico → `[bit no ataque, bit na defesa]`:
  J/A = PASSE/CONTER, K/B = CHUTE/DIVIDIDA, O/RB = —/PRESSÃO, Y = ENFIADA/GOLEIRO), `criarSentidoFixo(tabela?)` → `{bit(id,
  apertado, fase), atual(id), soltarTudo()}` (puro: o sentido fica fixo do aperto até soltar, mesmo se a posse mudar),
  `BOTOES_TOQUE`, `calcularLayoutToque(W, H, sa, tamanho?, vagas?)`, `criarEntrada(opc)` → entrada com `bloquear(v)` e
  `bloqueada` (o "Editar time" aberto: nada vaza para o jogo, só a pausa). Tela limpa (11/10): ver "Tela limpa" no fim
  (defesa do toque com 5 botões, `criarToqueOuSegura`, `escalaAnalogico`, `ler(yaw, agora)`).
- **`editor-time.js`** (DOM, com `css/editor.css`): `criarEditorTime(opc)`, `modoDaTela(w, h)`, `posicaoNaTela(vaga, W, H,
  cw, ch, vertical)`, `tamanhoCarta(modo, W, H)`. Usa as funções puras de `escalacao.js`/`tatica.js` (a mesma conta do
  jogo) e devolve a edição pela fila da página.

### Estruturas
- **Elenco** (`ELENCOS[id]`): `{id, nome, sigla, uniforme: {linha, goleiro} (chaves dos KITS de render/jogador3d.js),
  formacaoPadrao, titularesPadrao: {vagaId: id}, taticaPadrao, jogadores: [Jog]}`; `Jog = {id, num, nome, camisa (≤ 10
  caracteres), pos, alt: [pos], nivel, pe: 'D'|'E'}`. **Ids no mundo:** Golaço FC 1–23 (= número), Ventania FC 101–123.
  Nunca o 0 (condução) nem o 90 (marcador do treino).
- **Vaga** (`FORMACOES[f].vagas`, ordem fixa com GOL primeiro = ordem do hash, do desempate e do `vagaIdx`):
  `{id, pos, fila, col, grupo: 'gol'|'def'|'mei'|'ata', sem: {x, z}, com: {x, z}}` — metros, bola no centro,
  referencial de quem ataca para +x (direita = +z). `grupo 'def'` = a linha de defesa sem a bola (alinhada pela altura).
- **Tática**: `{mentalidade: −2..2, pressao: 0..2, largura: 0..2, linha: 0..2}`.
- **`m.times`** = `{0: T, 1: T}`, `T = {elenco, formacao, vagas: {vagaId: id} (os 11 em campo), tatica, pendente: null |
  {vagas, substituicoes: [{sai, entra}]}, saiu: [ids], subs: {feitas, paradas}, versao, editadoEm}` (`editadoEm` = tick
  da última edição aplicada; entra no hash: a mesma edição um tick depois dá outro hash). Quem está no banco não é objeto
  da simulação: só os 22 em campo ficam em `m.jogadores` (time 0 na ordem da formação, depois o time 1). A substituição
  troca o objeto no **mesmo índice** de `m.jogadores`.
- **Jogador em campo** (campos novos): `j.vagaId` (`'MCE'`), `j.vagaIdx` (0–10: substitui `id·97` e a paridade do id em
  todo código novo), `j.posDetalhe` (= `vaga.pos`), `j.posicao = FUNCAO[posDetalhe]`, `j.iaT` (estado da IA tática;
  criado uma vez e reaproveitado), `j.defH` (estado do humano na defesa, `null` quando nada). `j.vaga` (deslocamento à
  frente da bola, z absoluto) continua com o sentido do treino e só é lido pela IA clássica (`vestirVaga` o mantém).
- **`m.partida`** = `{estado: 'jogo'|'parada'|'gol'|'intervalo'|'fim', tempo: 1|2, tick0Tempo, ticksPorTempo,
  saidaInicial: 0|1, iaClassica, desde, ultimoTime, ultimoId, ultimoTick, golTime}`. `ultimoTime/ultimoId/ultimoTick` =
  o último toque na bola (quem está com ela, senão `m.ultimoToque`, senão o evento `bateuCorpo`): decide lateral ×
  escanteio × tiro de meta. Relógio mostrado: `minutoDeJogo(m)` (0'–45' e 45'–90', acelerado). Intervalo: troca de lado
  (`m.ataca` invertido; goleiro, IA e ações já leem `ataca()`/`linhaDoGol`).
- **`m.parada`** = `null | {tipo: 'saida'|'lateral'|'escanteio'|'tiroDeMeta', time (quem cobra), x, z (ponto), cobrador:
  id | null, inicio (tick em que a bola morreu), desde (tick da montagem), pronta (tick em que pode cobrar), atraso
  (ticks que a IA espera depois de pronta, sorteados pelo m.rng), rolou, raio (m; 'area' = fora da área), papel (papel
  do cobrador antes da cobrança; ele fica `'parado'` até cobrar), levado (m que o cobrador foi levado até o ponto; o
  HUD avisa acima de `PARTIDA.teleporteCobrador`)}`. **`cobrador === null` = bola morta** (antes da montagem: 1 s fora,
  2,5 s depois do gol): ninguém toca nela. Com `rolou === false`, só o cobrador toca a bola e ninguém dá bote. Nenhuma
  parada passa de `PARTIDA.paradaMax` (8 s).
- **`m.golTick`**: tick do gol (o `sim.js verificarGol` só conta com `m.golTick == null`); **−2 com a bola morta** (a bola
  que sai pela linha de fundo e entra rolando por fora não vale); volta a `null` quando a bola rola (cobrança).
  `m.foraDesde` = tick em que a bola saiu (ou null).
- **`m.iaTime[time]`** (`faseDoTime`) = `{tick, fase: 'com'|'sem', desde, transicao: 'def'|'of'|null, mistura: 0..1}`.
- **`m.pedidoPressao[time]`** = tick do último PRESSÃO segurado pelo humano daquele time.
- **Edição** (ação da fila, aplicada no início do tick): `{tipo: 'editarTime', time, base: versao, formacao, vagas: {...11},
  substituicoes: [{sai, entra}], tatica}` — `vagas` é o arranjo final desejado; `substituicoes` é a lista completa.
  Recusada (base velha etc.) → evento `edicaoRecusada {time, motivo}`.
- **Rascunho** (só da tela, nunca o mundo): `{time, elenco, base, formacao, vagas, tatica, substituicoes, saiu, subs,
  escolhido, historico, original}`.
- **Eventos novos**: `saida {time}`, `lateral {time, x, z, id, levado}`, `escanteio {time, lado, id, levado}`, `tiroDeMeta
  {time, id, levado}`, `fora`, `cobranca {parada, id}` (a bola rolou; `parada` = o tipo da parada), `intervalo`, `fimDeJogo
  {placar}`, `timeEditado {time, pendente}`, `edicaoRecusada {time, motivo, codigo}`, `substituicao {time, sai, entra}`,
  `trocaAerea {id}`, `dividida {id, ganhou, motivo}`.
- **Outros campos do mundo na partida**: `m.pedidoPressao[time]` (tick do PRESSÃO), `m.pressaoHumano[time]` (`{tick, id}`
  de quem aperta), `m.iaTime[time]` (fase do time). Criados quando usados (`??=`).
- **Hash**: com `m.times`, `hashMundo` mistura também `misturarTimes` (para cada time: índice da formação, ids na ordem
  das vagas, as 4 táticas, pendente, saiu, subs, versao) e `misturarPartida` (estado, tempo, relógio, parada). Sem
  `m.times` o hash é o de antes. `sim.js misturarHash(h, x)` é a mistura FNV-1a de um número.
- **API da página para os testes** (`window.__golaco`, Parte 5): `reiniciar({modo: 'partida' | 'ataque' | 'conducao',
  semente, minutosPorTempo})` (sem modo: o da página), `editarTime(ed)` (põe na fila; entra no próximo passo),
  `edicaoNaFila`, `estadoTime(t)` (cópia de `m.times[t]`), `editor` (`aberto`, `abrir()`, `voltar()` = PRONTO, `esc()`,
  `aba`, `modo`, `rascunho`), `medirQuadro({zerar}?)` → `{quadros, passos, sim, pose, jogadores, desenho, cpu}` (cada um
  `{media, p95, max}` em ms; `cpu` = o quadro sem o desenho), `trocarModo(v)` (como o menu "Modo de jogo"), `modoPagina`,
  `entradaEtapa3` (a entrada já tem os botões da defesa e o `bloquear()`), `estado()` com `times`, `relogio {tempo,
  minuto}`, `parada` e `placar`. **Parâmetros da página:** `?modo=partida|ataque|conducao` (padrão: partida) e `?min=N`
  (minutos reais por tempo da partida), além dos de antes.

### Testes da Etapa 3
- `tools/rodar-testes.mjs`: cada linha é `[nome, arquivo, argumentos?, grupo?]`. O padrão (o CI) roda os 22 de antes
  + `teste-custo`. O grupo `'etapa3'` (`--etapa3` = padrão + etapa3; `--so etapa3`) tem os marcadores
  "AGUARDANDO PARTE N" e os testes novos até passarem 5 vezes seguidas com sementes diferentes; então a parte tira o
  `'etapa3'` da linha dela.
- Todo teste novo aceita `--antes` (a mesma partida com `criarPartida({iaClassica: true})`, a IA de hoje) e
  `--js <pasta>`; metas sobre a mediana, ≥ 8 sementes no CI. Medidas comuns: `tools/lib/partida-medidas.mjs` (terço,
  fase, forma, linha de 4, área, portador, linhas de passe livres, corredores, impedimento, troca de posse, PPDA).
- `tools/teste-transicao.mjs` (PR "IA intensa"; IA × IA no grupo padrão — passou 5 rodadas seguidas, sementes 1, 25, 49,
  73 e 97; `--humano` no grupo `'etapa3'`): partidas inteiras (24 sementes; `--humano` = time 0 de um humano roteirizado,
  metas para o time da IA): tempo até 8 dos 10 de linha atrás da bola depois da perda (mediana ≤ 6 s) e velocidade de
  recuo de quem ficou > 10 m à frente da bola nos 3 s seguintes (mediana ≥ 4,6 m/s); informa o contra-ataque que chega
  ao terço final com superioridade, o pico de velocidade para o próprio gol, a contrapressão, sprints, alta intensidade,
  chutes no alvo, posses no terço final e o tempo da recuperação ao chute. `--par N` (padrão 2), `--sem0 K`.
- `tools/teste-custo.mjs`: razão partida ÷ treino no mesmo processo (média e p95 ≤ 2,5×; nenhum passo > 50 ms — acima de
  20 ms de parede, vale a CPU do fio principal: `process.threadCpuUsage`, sem a espera do escalonador nem os fios de fundo).
- `tools/teste-desempenho-celular.mjs` (navegador): Chromium 844×390, Média, CPU 4×, 30 s de partida demo; CPU por quadro
  sem a GPU p95 ≤ 6 ms e média ≤ 3 ms.
- Otimização da lógica: o hash da PARTIDA tem de ficar igual antes e depois (além do `hash-igual` do treino):
  `node tools/hash-partida.mjs` (repositório × HEAD; `--ref <commit>` ou `--base <pasta js>`): partidas inteiras IA × IA e
  com humano aleatório (botões de defesa e uma edição do time), `hashMundo` a cada 300 passos nas duas cópias da lógica.

## Pedido de 10/10 — recepção que nunca sai da bola, controle de bola e goleiro que pula e espalma (contrato)
Pesquisa: `PESQUISA-RECEPCAO-GOLEIRO.md` (seção 4: as correções da contraprova). Constantes: `config.js` `RECEPCAO`,
`CONDUCAO.dominioErroAng/Vel`, `CONDUCAO.dominioCraque`, `CONDUCAO.dominioFraco`, `CONDUCAO.dominioOrientado`,
`GOLEIRO.espalmada`, `GOLEIRO.antecipaMergulho`, `GOLEIRO.antecipaSalto`, `GOLEIRO.leitura`, `GOLEIRO.vLado`,
`GOLEIRO.mergulho` (limites físicos e tempos da defesa desenhada), `GOLEIRO.bolaMao`, `GOLEIRO.desvioMax`,
`GOLEIRO.pegaMergulho`.
- **Recepção assistida** (`js/recepcao.js`, puro): só para o jogador **controlado pelo humano** que vai receber —
  o passe é para ele (`j.recebe`) ou a bola livre passa perto e ele chega antes dos companheiros e dos adversários
  (`tipoRecepcao`; o adversário que chega `RECEPCAO.folgaAdversario` s antes fica com ela). **Finalização indo para o
  gol não é bola livre** (chute, colocado, cavadinha, cabeceio mais forte que `chuteVForte`, ou mais que `chuteVMin`
  rumo à boca do gol até `chuteFolgaTrave` por fora da trave): a assistência puxava o controlado para a linha do
  chute (cortava o do companheiro, bloqueava o do adversário com o analógico para longe). Chute desviado lento ou
  indo para fora volta a ser bola livre.
  `planejarRecepcao(m, j)` roda no passo 1 (entradas) e grava `j.recep = {ativo, tick (deste plano), alvo (tick do
  encontro), qx, qz (onde o corpo chega), bx, bz (a bola lá), ux, uz (sentido dela), modo: 'frente'|'corrida', vmax,
  rapido, livre}`; `recepcaoAtiva(m, j)` = plano deste tick. No passo 2 o corpo anda por `movimentoAssistido` (o
  mesmo que `conducao.js preverCorpo` usa na previsão do domínio). O analógico decide o 1º toque (domínio orientado:
  `conducao.js tentarDominio → dominioAssistido`, `planejarAlvo(…, orientado)` com `orientado` = a direção pedida em
  rad, ±20°) e abre o tronco; CORRER ou o analógico para a bola apressam o encontro; nada do analógico afasta o corpo
  da linha da bola. **Embalado** (mais que `dominioOrientado.vLivre` m/s), a direção do 1º toque é a do analógico
  limitada a `anguloEmbalado(v)` do sentido da corrida (90° a 4,5 m/s, ~45° a 7 m/s; exportada para o teste): a bola
  para trás ou de lado fugia do corpo. Analógico solto = recebe de frente como antes. A IA não muda (recebe pelo
  caminho de antes) e **a entrada da demo marca `ia: true`** (`sessao.js entradaDemo`, `partida.js
  entradaDemoPartida`): a IA jogando pelo humano recebe como a IA. `criarJogador` declara `recep: undefined`.
  `tempoAlcance(j, qx, qz, vmax, parar)`: com `parar`, chega freando (embalado passa do ponto, para e volta).
  Bola que bate num corpo (`sim.js colisaoBolaCorpo`) derruba os planos de domínio aéreo/cabeceio marcados
  (`cond.toque.tipo === 'aereo'`): o jogador ia para o ponto antigo enquanto a bola fugia (até 3 m no lançamento).
  Embalado (> 1,2 m/s), o pedido de movimento abre no máximo `RECEPCAO.angCorteMax` do sentido da corrida.
- **Erro do domínio por atributo** (`conducao.js executarToque`): σ (ângulo e velocidade, × bola forte e pressão) =
  a conta publicada `lerp(ruim, bom, controle/100)` entre `dominioFraco.ate` (55) e `dominioCraque.desde` (70);
  acima de 70 cai em linha reta até `dominioCraque.ang/vel` no 100 (o bom domina mais limpo); abaixo de 55 sobe em
  linha reta até `dominioFraco.ang/vel` no 0 (o fraco espirra a bola forte). Os titulares dos dois elencos têm
  controle 59–83: na faixa deles só o bom mudou (a curva mais dura de antes tirava ~0,6 gol por partida).
- **Goleiro — defesa desenhada** (`js/goleiro.js`, puro; matemática pelo MD — entra no estado e no hash):
  `lerChute` marca `d.inicio` = fim da reação **menos `GOLEIRO.leitura`** (o corpo começa a se mexer um pouco antes:
  o goleiro lê o chutador; a chance de defesa não muda) e, na bola por cima do goleiro adiantado (`d.recuo`), a bola
  do contato (`bx, by, bz`); `d.lido` = o tick da leitura. **Chute desviado**: `sim.js colisaoBolaCorpo` grava
  `m.desvio = tick` quando a bola bate num corpo; `lerChute` relê o chute (defesa nova, reação inteira) se
  `m.desvio > d.lido`. `aplicarDefesa` só vale com a bola a ≤ `desvioMax` (|Δxz| + |Δy|) de `bx, by, bz` e, com
  outra defesa desenhada ainda em andamento (a relida não teve tempo de começar), com a mão desenhada dela a ≤
  `pegaMergulho` da bola; senão é goleiro batido (evento `goleiroBatido` com `desvio: true`) — antes a defesa lida
  acontecia no tick lido com a bola em outro lugar (a bola ia parar nas mãos de até 23 m num quadro).
  `movimentoGoleiro`: com chute vindo, o tronco fica de frente para o chute (até ~35° do campo), sem virar atrás da
  bola que passa; começa a defesa (`iniciarMergulho(m, j, d)`) uma vez por leitura (`j.mergulho.idDefesa` = a
  identidade da leitura: `lido` e `tick`), no máximo `antecipaMergulho` s antes do contato (`antecipaSalto` na
  cavadinha: antes disso volta correndo; depois, salta para trás até a bola) — antes disso anda de lado até `vLado`.
  `iniciarMergulho`: o **lado do mergulho é a linha do gol** (frente final = o campo; o tronco gira do rumo de antes até
  lá em `mergulho.tGiro`, sem salto) e o centro nunca chega a menos de `margemLinha` da linha. Tipos pela bola no
  contato: `'salto'` (alta e perto; quadril até `saltoMax` acima de em pé), `'baixa'`/`'peito'` (em pé, perto) e
  `'mergulho'` (a "prancha"). **Limites físicos duros**: o centro anda no perfil Hermite (sai com a velocidade que
  tinha) com velocidade ≤ `vPico` de lado e ≤ `vFrente` para a frente (`faixaDesloc`); o tronco inclina ≤ `giro`
  rad/s e curva ≤ `dobra` rad/s; o quadril sobe ≤ `sobe` m/s e agacha ≤ `agacha` m/s; a queda e o deitar também
  respeitam `giro`. O tronco parte da inclinação da pose de pé (a mesma conta de `anim.js pose`, pelo MD) e, no
  **rebote** (defesa nova com outra em andamento), do quadro em andamento (`quadroMergulho` do anterior: quadril,
  inclinação, rumo) e com as mãos saindo de onde estavam em relação ao ombro (`j.mergulho.mao0`, em
  `mergulho.tMaoRebote`) — deitado, ele só alcança o que dá dali (`j.mergulho.rebote`). **A defesa sorteada só vale se a
  mão desenhada chega a `maoOk` da bola no contato e sem passar de `vMao` em relação ao corpo** (`maoAlcanca`); senão
  vira goleiro batido (`d.sucesso = false`, `j.mergulho.rebaixada`) — no recuo do próprio time (`d.proprio`) não há
  mergulho batido: `iniciarMergulho` devolve null, `d.fora = true` e ele recebe a bola que passa perto
  (`bolaLivre`) — exceto a bola no corpo (em pé, a até
  `corpoLado` de lado e abaixo de `corpoAlto`), que bate nele e sai (vira espalmada). Batido em cima da hora, o
  mergulho é atrasado (`tp`: o pico `tMinFalha` s depois de começar). Campos de `j.mergulho` no comentário do módulo
  (`tick0, tc, tp, T, tipo, sucesso, encaixe, x0, z0, fx, fz, lx, lz, ladoS, rF, dYaw, tGiro, sC, fC, hC, hLow, phi0,
  phiC, th0, thC, v0L, v0F, h0, bx, by, bz, ext, tImp, tq, vc, sFim, sLev, fim, pe0, perto, passo, pmL, pmF, pf,
  passa, durPasso, iniPasso, rebote, rebaixada, …`). `mergulhoAtivo(j, tick)` (tick0 < tick ≤ fim).
  `quadroMergulho(g, tick, q)` é **função pura do tempo**: centro (x, z), rumo e frente/lado do tick (`yaw, fx, fz,
  lx, lz`), quadril h, inclinações `phi` (de lado) e `th` (para a frente), braços, fase, tornozelos `a0/a1` e apoio.
  Na simulação (`sim.js`): passo 2 `passoMergulho` (o corpo = quadro do próximo tick, `j.rumo = q.yaw`), depois das
  trombadas `fixarMergulho` + `pesMergulho` (pés plantados/no ar pelo quadro), passo 8 sem `passoPeDesenhado`;
  `goleiroComBola` espera ele levantar. **Bola na mão** (`bolaNaMao`): no encaixe desenhado, nas mãos do quadro
  (`bolaNasMaosMergulho`: trazida ao peito em `tAbraca` e, nos últimos `bolaMao.tJunta` s, ao ponto de segurar em pé);
  de pé, `bolaMao.frente` à frente na altura `bolaMao.altura`. A diferença de quando ele pegou (bola solta a até 1 m,
  tiro de meta no chão) fica em `j.segura.off` e some a `bolaMao.vJunta` m/s — a bola não salta para a mão. No meio
  da defesa desenhada ele só pega a bola solta com a mão desenhada a ≤ `pegaMergulho` dela (`maoNaBola`), e a
  própria espalmada não volta para as mãos dele antes de `GOLEIRO.reagarra` s (`m.ultimoToque`: antes ~metade das
  espalmadas virava encaixe 1 tick depois). Na
  animação: `anim.js pose` com a bola na mão põe as palmas dos dois lados da bola do estado (±`bolaMao.palma`); o
  encaixe desenhado termina nesse mesmo ponto (sem salto de braço no fim). `anim.js poseMergulho` (mesmo quadro, `maosMergulho(g, q, out, segura)`,
  `eixosMergulho`); `alturaQuadril` devolve o h do quadro. **Mãos prontas**: `MAO_PRONTA_FRENTE/BAIXO`
  (`goleiro.js`) — a espera da defesa desenhada e a pose de pé do goleiro sem a bola (`anim.js pose`, por IK; com
  chute vindo, sempre): sem salto de braço ao começar e ao terminar a defesa. `render/jogador3d.js frente()`: com o
  tronco a mais de ~30° da vertical a frente sai em 3D (cima × direita); de pé, a conta de sempre (os jogadores de
  linha não mudam).
- **Espalmada** (`aplicarDefesa → espalmar`): por cima do travessão (bola acima de `alturaTravessao`), pela linha de
  fundo por fora da trave (contato a < `perto` m da linha) ou bem aberta (|z| ≥ `zAberta`), a `fracaoV` da bola entre
  `vMin` e `vMax`; até `tentativas` direções, cada uma mais aberta e mais alta, conferidas pela física
  (`espalmadaSegura`): não entra no gol e, depois de `tSai` s, não fica jogável (abaixo de `jogavelAlt` e de
  `jogavelV`) na zona perigosa (< `zonaX` da linha, |z| < `zonaZ`) nos `tConfere` s seguintes.
- **Testes**: `teste-recepcao` (padrão; canhão de 1000 bolas: domínio ≥ 99%, corpo nunca se afasta > 0,15 m, 1º toque
  ±20° ≥ 95% no total e em cada corpo — parado, trote, corrida —, bola ≤ 1,2 m do pé 0,5 s depois ≥ 97% no total e em
  cada corpo; embalado, a direção certa é a do analógico limitada por `anguloEmbalado`), `teste-mergulho` (padrão;
  A: grade de 432 chutes — mergulho desenhado em 100% dos chutes a > 1 m, mão ≤ 0,25 m ≥ 95%, espalmada que morre na
  zona ≤ 10%, pés sem patinar com v ≤ 6 m/s; B: canhão variado de 900 chutes + 150 rebotes no chão — mão ≤ 0,25 m ≥
  95% (com a cavadinha), centro ≤ 5,5 m/s, pelve ≤ 7,5 m/s, nunca atrás da linha, tronco ≤ 20°/quadro, espalmada
  jogável na zona ≤ 10%, salto na bola alta perto ≥ 80%, espalmada que volta para as mãos em 0,5 s ≤ 2%; C: rebote
  disputado com 3 atacantes e 2 defensores — o ataque
  toca primeiro ≤ 10%; E: 648 chutes rasteiros que raspam num zagueiro depois da leitura — nas defesas, mão ≤
  0,25 m ≥ 95%, a bola nunca salta > 0,3 m num quadro), `teste-patinacao` (no mergulho do goleiro, v = a maior velocidade do corpo, da pelve
  desenhada também, até 6 m/s — o corpo cai), `teste-carga` 5c (um chute forçado no treino: o goleiro mergulha e o
  hash é o mesmo no Node e no Chromium), `tools/medir-controle.mjs` (informativo, minutos: domínio que escapa, perdas
  sozinho, bola–pé por velocidade, 1º toque por atributo, "se afastou da bola vindo" do humano roteirizado; `--sonda
  tipo,h|i,semente,tick` imprime o lance).

## Etapa 4 — regras (IFAB), goleiro, bolas paradas e equilíbrio (contrato)

Sai em PRs menores; cada um acrescenta a sua parte aqui. Pesquisa e números em `PESQUISA-ETAPA4.md`.

### Impedimento (Regra 11) e acréscimos (Regra 7.3)
- `impedimento.js` (puro): `penultimoAdversario(m, t)`, `linhaImpedimento(m, t, out)` → `{u, x, defensor}` (o maior entre
  o penúltimo adversário com o goleiro, a bola e o meio, no referencial de quem ataca), `emPosicaoDeImpedimento(m, j, u)`
  (`IMPEDIMENTO.tolerancia` = "na mesma linha"), `fotografar(m, t, idToque)` e `regraImpedimento(m)` — chamada por
  `partida.js regrasPartida` com a bola rolando (e no passo em que o tiro de meta rola). Lê quem tocou a bola no passo
  (o dono no pé ou na mão; eventos `passe`, `chute`, `roubada` = deliberados; `bateuCorpo` = desvio; `defesa` = defesa do
  goleiro): impedido da foto que toca → devolve a infração; jogada deliberada do adversário → zera; `cobranca` de tiro de
  meta, lateral ou escanteio → zera sem fotografar; senão a jogada deliberada do passo fotografa de novo.
- Estado: `m.partida.imped = null | {time, ids, tick, linhaX, por}`; `m.partida.ultimoImped = {tick, linhaX, id, time, x,
  z}` (para o desenho); `bolaMorta` zera a foto. Infração: evento `impedimento {id, time, x, z, linhaX, por, tickFoto}`
  (`tickFoto`: o passo da foto — o quadro que o replay congela) e parada
  `tiroLivre` (novo em `TIPOS_PARADA`, no fim da lista) do outro time no ponto do toque; `PARTIDA.raio.tiroLivre` 9,15 m;
  a montagem é a do lateral (o de linha mais perto, virado para o ataque), evento `tiroLivre {time, x, z, id, levado,
  indireto: true}`; `alvoCobranca` não passa para quem está impedido; o humano não chuta a gol (indireto).
- Acréscimos: no fim do tempo regulamentar `anunciarAcrescimo` (rng do mundo) grava `m.partida.acrescimo` (min de jogo) e
  emite `acrescimo {tempo, minutos}`; o tempo acaba em `ticksPorTempo + round(acrescimo · ticksPorTempo / 45)`.
  `m.partida.contagem = {gols, subs, imped}` do tempo. `acrescimoDeJogo(m)` → `{anunciado, decorrido} | null` (o
  `minutoDeJogo` fica em 45/90); o HUD mostra "45+2'" e "1º T +4".
- Desenho (`render/linha-impedimento.js`, só lê o mundo): no apito, a linha do lance (`ultimoImped.linhaX`) parada,
  amarela e mais grossa por `IMPEDIMENTO.linhaCongela` s. A linha VIVA (amarelo-clara, na linha de impedimento de quem tem
  a bola no campo de ataque) só com `IMPEDIMENTO.linhaViva` — **desligada desde 11/10** (dono: "não quero a linha de
  impedimento durante o jogo"; o replay mostra a do lance). API de testes: `__golaco.linhaImpedimento` → `{visivel, x,
  lance, opacidade}`.
- Hash: `misturarPartida` inclui acréscimo, contagem, a foto e o último apito (a partida muda; o treino não).
- Testes: `teste-impedimento` (padrão): cenas da Regra 11, recomeço, árbitro independente em 6 partidas, acréscimos.
  `tools/painel-equilibrio.mjs` (seção 11; `--base <pasta js>` compara duas versões com as mesmas sementes).

### Faltas, vantagem, cartões, expulsão (Regra 12) e pênalti (Regra 14)
- `faltas.js` (puro, só com `m.partida`): `chegada(d, c)` → 'frente'|'lado'|'tras'; `naAreaDe(m, t, x, z)`;
  `chanceClara(m, c, def)` (DOGSO); `ataquePromissor(m, c)` (SPA); `montarFalta(m, d, c, origem, tentouBola, excessivo)` →
  `{def, cond, time (quem sofreu), x, z, area, chegada, v, grau, cartao, motivo, origem, tick}`; `registrarFalta(m, f)`
  (a 1ª do passo: `m.faltaPendente` e o evento `falta`); `chanceFaltaBote`, `faltaNoBote`, `faltaTatica`, `faltaNaCarga`
  (sorteiam pelo m.rng). Ganchos: `sim.js boteIA` (tática antes do alcance; o bote que chega), `sim.js colisaoCorpos`
  (carga), `defesa.js resolverBote` (dividida do humano que não ganha a bola).
- `partida.js`: `passoPartida` zera `m.faltaPendente`; `regrasPartida` (bola rolando) → `decidirFalta`: na área →
  `penaltiMarcado` + parada `penalti`; vantagem clara (`vantagem`; `resolverVantagem`: `vantagemVolta` + apito); senão
  `apitarFalta` (evento `apito`, parada `tiroLivre` com `direto: true`). Cartões: `m.partida.cartoes` (amarelos por id),
  `cartoesPendentes` (saem em `bolaMorta`), evento `cartao {id, time, cor, motivo, segundo}`, `ultimoCartao` (desenho).
  Expulsão (`expulsar`): sai de `m.jogadores` para `m.expulsos`; `m.times[t].expulsos` e `saiu`; a vaga guarda o id (o
  buraco); substituição pendente dele é desfeita; goleiro expulso → o de linha mais perto vai para a vaga GOL.
- Pênalti: `montarPenalti` (cobrador = maior finalização; goleiro na linha; os outros na beira da área/meia-lua; o canto
  `pr.miraZ` e a força `pr.forca` da IA e o lado do goleiro `pr.palpite`/`gk.palpite` sorteados na montagem; evento
  `cobrancaPenalti`); `rolou` abre `penaltiAberto` (o goleiro do humano escolhe o lado pelo analógico); `resolverPenalti`
  → evento `penalti {time, id, resultado: 'gol'|'defesa'|'fora'}`. Na cobrança o humano pode chutar (pênalti e tiro
  livre direto); `pedido.penalti` multiplica o erro (`ACOES.chute.penaltiErro`). `goleiro.js lerChute`: no pênalti, lado
  errado = não defende (o mergulho desenhado vai para o lado escolhido); lado certo = chance × `GOLEIRO.penalti.fator`.
- Escalação: `situacao` → 'expulso'; `tocar` troca o buraco com um titular (nunca o gol) e recusa substituí-lo;
  `mudarFormacao` deixa o buraco nas vagas que sobram (fora do gol); `validarEdicao` aceita o expulso só como buraco e
  fora do gol; `misturarTimes` inclui os expulsos.
- Desenho/HUD: `#cartao-icone` em cima de quem levou (`hud.cartao`, `FALTAS.icone` s; sem texto); apito nos eventos
  `apito` e `impedimento`; corte de câmera em `cobrancaPenalti`; editor: carta `.expulso` com o cartão vermelho.
  API de testes: `__golaco.faltaDeTeste({area, cartao, doMeu})`.
- Testes: `teste-faltas` (padrão): cenas, vantagem e volta, pênalti montado, 2º amarelo/expulsão/editor, goleiro
  expulso, canhão de 400 pênaltis, 12 partidas.

### Bolas paradas (Regras 13, 15 e 16) e disputa pelo alto
Pedido do dono (seção 8). Tudo só com `m.partida`: o treino fica bit a bit igual (`hash-igual`).
- `lateral.js` (puro): `lateralSegurando(m)`; `pontoMaosLateral(c, s, out)` (s = 0 atrás da cabeça, 1 a soltura à
  frente; Bézier por cima da cabeça); `segurarLateral(m)` (o sim.js chama no passo da bola, no lugar da física, nos
  passos 3, 5 e 6: a bola fica NAS mãos, parada); `vMaxArremesso(j)` (LATERAL.vMax pelo atributo); `opcoesLateral(m, c,
  out)` → até 3 `{id, nota}` (companheiros de linha a LATERAL.dMin–dMax m, risco da linha pelo `acoes.js riscoLinha`,
  distância perto de dIdeal, um pouco à frente); `opcaoMirada(m, c, ops, cosMin)` (a opção mais perto do analógico;
  solto, a 1ª); `alvoLongoNaArea(m, c, out)`.
- `partida.js montarLateral`: a bola em z = ±meioZ; o cobrador (o lateral/ala do lado, `LATERAL.preferirLateral` m de
  vantagem) a LATERAL.linha m por fora, de frente para o campo; `pr.opcaoIA` (sorteio por LATERAL.pesos), `pr.longa`
  (perto da área, LATERAL.longaNaArea), `pr.arremesso = null`. Cobrança: PASSE, ENFIADA ou LANÇAMENTO (o CHUTE não
  vale) começam o arco (`pr.arremesso {tick0, solta}`, LATERAL.tempo s) e a bola sai das mãos por `acoes.js
  arremessoLateral` (velocidade até vMaxArremesso, elevação LATERAL.elevCurto/elevLongo, erro por atributo).
- `bolas-paradas.js` (puro): `alvoBolaParada(m, j, out)` (o ia-tatica.js pergunta antes do papel de sempre, antes do
  chute e na janela depois dele); `bolaParadaAtiva(m)` (`m.partida.bp`: ESCANTEIO.janela s depois do chute, até alguém
  dominar ou a bola ir à mão); `notaAerea(j)`; `papeisEscanteio(m, c)` → `[{id, papel, u, w, su, sw, marca}]` (ataque: 5
  zonas — centro, 1º pau, 2º pau, marca do pênalti, entrada da área —, 2 ficam, o resto na segunda bola; defesa mista:
  zona na pequena área, individual nos 4 melhores no alto, borda, frente para o contra-ataque); `pontoEscanteio`,
  `pontoMarcador` (do lado do gol, ESCANTEIO.marca m); no ar, o defensor mais perto de `m.voo.alvo` ataca a bola;
  `barreiraDoTiroLivre(m, t, bx, bz)` → `{n, pontos, cx, cz, px, pz, dist, ladoLongo}` ou null (longe: BARREIRA.longe)
  — cobre BARREIRA.cobre do gol a partir de BARREIRA.foraPau por fora do 1º pau, ângulos relativos ao meio do gol (sem o
  salto de ±π de quem ataca para −x), de lado (BARREIRA.deLado) no máximo 2; `alturaSalto(j, tick)`;
  `colisaoBarreira(m)` (depois do `colisaoBolaCorpo`: restituição/amortece, uma batida por jogador, eventos
  `bateuCorpo` + `bateuBarreira`, `m.desvio`).
- `partida.js`: `montarEscanteio` (papéis, teleporte para os pontos de saída, goleiro na linha, `pr.zonaIA` sorteada
  por ESCANTEIO.zonaIA, eventos `escanteio` e `corteBolaParada`); `montarBarreira`/`desfazerBarreira` (a barreira
  fica `parado` até a bola rolar; no chute, `j.salto {tick, h}`; `m.partida.barreira {ids, tick, bateu}`); os
  atacantes a ≥ BARREIRA.ataque m da barreira; o goleiro se desloca BARREIRA.goleiro m para o lado longo
  (`goleiro.js`). `montarTiroDeMeta`: a bola no chão dentro da pequena área (TIRO_DE_META.dentro), o goleiro cobra com
  o pé; os adversários que estão na área vão para fora JÁ na montagem (`restricaoParada` + `teleportar`, evento
  `corteBolaParada`) e o humano só cobra com `zonaLivre` (Regra 16); `pr.curta` (TIRO_DE_META.curta); a IA espera os zagueiros abrirem (≤ TIRO_DE_META.chegou m da vaga, até
  esperaMax s) e passa curto para um zagueiro livre (≥ curtoLivre m) ou lança no mais adiantado. Adversários fora da
  área até a cobrança (Regra 16, como antes). `rolou` grava `m.voo.bolaParada = pr.tipo` e, no escanteio,
  `m.partida.bp`. `fecharMontagem`: o cobrador vira `parado` (papel guardado em `pr.papel`); o humano que defende o
  pênalti ou a barreira fica com o goleiro.
- Disputa pelo alto (`sim.js bolaAltaNoCorpo`, só com `m.voo.bolaParada`): o rival mais perto da bola alta
  (AEREO.raio, y ≥ AEREO.yMin; o controlado tem preferência) disputa por `ganhaDisputa` (logística de AEREO.k·Δnota/100,
  ± AEREO.ladoGol para quem defende); o rival ganha → afasta de cabeça e `j.perdeuAlto` (não tenta de novo por
  AEREO.perdeuSalto s); senão `j.disputa = m.tick` e o cabeceio sai com erro × AEREO.erroDisputa. Na bola rolando a
  disputa não vale (derrubou os gols de 2,8 para 1,5;
  fica para a 4.5 junto com o volume de chutes).
- Tiro livre direto com barreira (`acoes.js chute` com `pedido.barreira {dist, altura}`): a IA procura a elevação que
  passa por cima da barreira (BARREIRA.alturaPassar no ponto dela, com o efeito de cima `giroFalta`) e abaixo do
  travessão (yBarreiraMax); erro × `faltaErro`.
- Desenho: `anim.js` (as palmas dos dois lados da bola no lateral, o seguimento depois da soltura, o pulo da barreira
  somado a todas as juntas); `render/marcas-lateral.js` (3 anéis sob as opções do humano, a escolhida amarela e
  pulsando; sem texto); corte de câmera em `corteBolaParada`. API de testes: `__golaco.marcasLateral`,
  `__golaco.bolaParadaDeTeste(tipo)`, `__golaco.faltaDeTeste({u, w, ...})`.
- Testes: `teste-bolas-paradas` (padrão): A lateral (mãos, arco, 3 opções, CHUTE recusado, posse mantida), B tiro de
  meta (bola no chão, zagueiros abertos, saída curta), C escanteio (canhão de 120 de estados no meio da partida: 1º
  contato do ataque 35–62%, gol ≤ 12%, chute ≥ 12%), D barreira (canhão de 160: na barreira 15–40%, gol 2–12%, no alvo
  18–36%), E 8 partidas IA × IA (as quatro acontecem, nenhuma parada passa de 8 s, o time fica com a bola
  em ≥ 55% dos laterais). `teste-estadio` (navegador) confere os marcadores do lateral.
## Tela limpa (11/10) — HUD mínimo e linha de impedimento só no apito (contrato)
Pedido do dono (11/10): "quero menos informação na tela", "tem muita coisa na tela", "não quero a linha de impedimento
durante o jogo; quando o jogo parar por impedimento, aí no replay vai mostrar a linha". Pesquisa em `PESQUISA-ESTADIO.md`
("Tela limpa"). **Só desenho, DOM e a forma de apertar o toque**: nenhuma linha de `sim.js`, `acoes.js`, `defesa.js` ou
`ia*.js` mudou e o mundo recebe as mesmas máscaras de sempre (`hash-igual` IGUAL; `teste-determinismo` passa).
- **Orçamento de tela** (`tools/teste-hud-minimo.mjs`, navegador, no CI e antes do deploy): no celular deitado (844×390,
  667×375, 568×320 com entalhe, ataque e defesa) a união das formas do HUD (caixas visíveis do `#hud`, botões como
  círculos, analógico em repouso se a opacidade passar de 0,25) cobre ≤ 11% da tela; 0 caracteres fora do placar; ≤ 15%
  dos pixels de torcida atrás do HUD; 0 amostras com a linha viva; PC ≤ 2,5% depois de 9 s. Peça nova de HUD na partida
  tem de caber nisso (ou ir para a pausa).
- **`index.html`/`css/estilo.css`**: na partida (`html.em-partida`) o placar é compacto de TV (30 px no celular, 34 no PC;
  sem a marca, sem borda nem caixinha nos gols; barrinha de cor de 3 px por time) e o "1º T" só aparece com
  `.placar-relogio.com-tempo` (intervalo, fim e acréscimos; o texto fica no DOM); menu só com o ícone (44×44); barra de
  força 44×6 sem o rótulo (`#carga-tipo` continua com o texto, escondido); dica de teclas do PC (`#dica`) some 8 s depois
  de `hud.pronto()` e de cada troca de modo. Botões de toque translúcidos (fundo 0,32, borda 1,5–2 px, sem sombra) com
  o ícone e o nome (`html.nomes-botoes`, `--ic`, `--fs`) — LIGADO sem escolha salva desde 12/10 (dono: "coloca o nome da
  função do botão de novo"; `main.js nomesLigados`); "Nomes nos botões" desligado na pausa = só o ícone (`--ic-so`). Analógico em repouso a 0,3 × a
  opacidade e sem o pino; com o dedo, como antes. Minimapa 112×73 a 0,8; escondido com `html.mapa-desligado` ou, sem
  escolha salva, com `html.com-toque` sem `html.mapa-ligado` (escondido não redesenha: `hud.minimapa` sai antes).
- **Pausa**: dois botões de liga/desliga na barra de cima (`#chip-minimapa`, `#chip-nomes`, `aria-pressed`; "Nomes nos
  botões" só com `html.com-toque`) — na barra para a pausa continuar cabendo sem rolar em 844×390 (a lista de opções não
  tinha altura sobrando). Até 600 px de largura ficam sem a bolinha (o estado fica no fundo verde), para não encostar no
  título em 568×320 com entalhe (folga ≥ 4 px conferida no `teste-hud-minimo`, H7). `data-cmd="minimapa" | "nomes"` → `comando(cmd, valor?)` (sem valor alterna; 'ligado' |
  'desligado' fixam); salvos em `golaco.prefs.v1` como `prefs.minimapa` ('ligado' | 'desligado' | ausente = padrão do
  aparelho) e `prefs.nomesBotoes` (boolean). `main.js aplicarTelaLimpa()` liga as classes; `hud.definirEstado({minimapa,
  nomes})` marca o estado que vale (o padrão muda quando os controles de toque aparecem: `aoMudarLayout`).
- **`entrada.js`**: ajustes em `golaco.toque.v2` (a v1 é apagada e ignorada) com o padrão `{tamanho: 0.8, opacidade: 0.55}`;
  `escalaAnalogico(tamanho)` = `min(1.4, tamanho / 0.8)` (CSS `--analogico-escala`): no padrão novo o analógico é o de
  antes (raio 58 px, o mesmo curso do dedo). **Defesa do toque com 5 botões** (`BOTOES_TOQUE`): TROCAR (grande), GOLEIRO
  (a), PRESSÃO (b), DIVIDIDA (c) e CORRER — nada no 2º anel (as vagas d/e continuam no `calcularLayoutToque` para o
  CARRINHO). O `btn-conter` saiu da página: a DIVIDIDA tem `segura: 'CONTER'` e usa `criarToqueOuSegura(toque, segura,
  limiar = ENTRADA.toqueCurto)` (pura) → `{apertar(), quadro(agora) → bit segurado, soltar() → pulso, cancelar(),
  segurando}`: segurar = CONTER desde o 1º quadro; soltar antes de `ENTRADA.toqueCurto` (0,25 s do relógio do jogo) = um
  pulso de DIVIDIDA (o bote começa no soltar). Só o `pointerup` vale como soltar: `pointercancel` (o sistema tomou o toque)
  e a captura perdida chamam `cancelar()` — nada de bote (contraprova). `ler(yaw, agora)` recebe o tempo do laço (o relógio manual nos testes).
  Teclado e controle não mudam (J/A = CONTER, K/B = DIVIDIDA, O/RB = PRESSÃO).
- **Desenho** (só lê o mundo): `render/linha-impedimento.js` com `IMPEDIMENTO.linhaViva` (false); `render/jogador3d.js`
  sem a seta no chão do controlado (anel + triângulo de 2,2% do menor lado da tela); `render/marcas.js criarMarcas(cena,
  {timeHumano})`: a marca de queda só para a bola alta do time do humano (`m.voo.time`; null = os dois times).
- **Testes**: `teste-hud-minimo` (H1–H8; `--raiz <pasta>` mede outra cópia; o H5 espera a animação da dica acabar — o
  relógio das animações do Chromium sem GPU atrasa do real com a máquina carregada — e o H7 confere a barra da pausa nas 3
  telas), `teste-entrada` (5 botões, nada no 2º anel, `criarToqueOuSegura` e do toque ao jogo: tocada = bote, segurada =
  conter), `teste-controles` (lista da defesa com 5 e a DIVIDIDA tocada/segurada/cancelada pelo sistema com toque de
  verdade; volta ao tamanho salvo). `tools/prints.mjs`: sem as cenas da linha viva;
  cenas `*-jogador-ve*` sem o `?prints=1` (a página como ela abre).

## Pedidos de 11/10 — regras e controles (contrato)

Tudo novo só vale na partida (`m.partida`): o treino continua bit a bit igual (`tools/hash-igual.mjs` IGUAL). Pesquisa em
`PESQUISA-ETAPA3.md` §17 (jogador parado, PRESSÃO) e `PESQUISA-ETAPA4.md` §5 (goleiro).

### Condutor parado ou lento
- `sim.js boteIA`: com o condutor abaixo de `ACOES.boteIA.vParado` m/s e sem tocar na bola há `semToque` s, a regra da
  bola "colada" (dD < 0,35 ou dB > dD) não vale — quem tem a bola ao alcance (0,65 m) tenta; passou do sorteio e não é
  falta, ganha por `defesa.js chanceDividida` (a mesma da DIVIDIDA do humano); errou: evento `boteErrado {id}` e descanso.
- `ia-tatica.js blocoDoTime`: estado `B.lentoId`, `B.lentoDesde`, `B.lento` — condutor pressionável com a velocidade
  filtrada (`B.cvx/cvz`) abaixo de `IA_DEFESA.lento.v` por `lento.s[pressão]` s (+ `lento.longe` fora da linha de
  engajamento): o 1º homem aperta (também além da linha), mirando `lento.aperto` m da bola; o 2º cobre em todo nível.
- `faltas.js chanceFaltaBote`: × `FALTAS.bote.lento` com o condutor abaixo de `vParado` (vale também na DIVIDIDA).

### PRESSÃO (`defesa.js`; o desenho em `render/jogador3d.js`)
- `pressionadorDe(m, time, excluir = -1)` → id de quem chega primeiro ao ponto de encontro (a `pressao.colado` m do corpo
  do condutor, do lado do gol, adiantado pela corrida dele até `leadMax` s; tempo com `acel`/`freio`; quem já ia leva
  `histerese` s), sem o controlado, o goleiro e `excluir` (nunca exclui quem já ia). Uma vez por tick em
  `m.pressaoHumano[time] = {tick, id}`.
- `pressionadorVisivel(m, time)` → id do chamado no último passo, ou −1 (pura; `main.js` passa `pressiona` na lista do
  desenho: setas âmbar acima da cabeça, `indicador-pressao`).
- `entradaPressao(m, j)`: bola solta do pé do condutor (> `bolaSolta` m) e eu mais perto → vou na bola; a mais de
  `chega` m → disparada (analógico cheio + CORRER) ao ponto de encontro, contornando o condutor a `contorno` m se venho
  por trás; perto → pela velocidade (a do condutor + `ganho` × (ponto − corpo), até `aproxMax` m/s a mais; por trás,
  fechando no máximo `trasAprox` m/s), mirando `naBola` m antes da bola, do lado do gol. Estado `j.pressaoH = {corre}`.
- `ia-tatica.js`: `B.apertaProprio` (o 1º aperta por conta própria); `B.pedido` é calculado ANTES do aperto, com
  `excluir = p1` quando ele já aperta (o botão chama outro); quem foi chamado no tick anterior (`B.pedidoTick`) não é o
  1º nem o 2º homem do bloco; `B.aperta1 = B.apertaProprio` (o botão soma um jogador, não dois).

### Goleiro pelas Leis do Jogo (`regras-goleiro.js`, puro)
- Estado `m.regraMao = {semMao: time | -1, soltou: id | -1}` (no hash da partida) e `m.infracaoMao` (do passo).
- `naPropriaArea(m, g, x, z, r = BOLA.raio)`; `maoPermitida(m, g, x, z)` (fora da partida: sempre); `motivoSemMao` →
  'recuo' | 'soltou' | 'fora' | null; `registrarChute(m, j, tipo)` (acoes.js finalizarChute: de linha liga o recuo do
  time dele; cabeceio = toque de cabeça); `registrarToque(m, j, modo)` ('cabeca' | 'peito' | 'posse' | 'corpo' |
  'roubada' | 'defesa'; sim.js, goleiro.js aplicarDefesa, defesa.js); `limparRegraMao(m)` (partida.js bolaMorta);
  `segundosNaMao(m, g)` (de pé, bola em jogo: `g.segura.dePe`); `relogioMao(m, time)` → `{id, frac}` nos últimos
  `GOLEIRO.contagem` s (o anel `anel-oito`); `paredeAreaMao(m, g, mv)`; `pontoTiroLivreMao(m, g, x, z, out)` (na
  pequena área → na linha dela); `goleiroNoPe(m, g)` (a bola no pé dele, ou a bola livre que ele não pode pegar com a mão
  e ele vai: o passe é para ele, ou a ≤ `GOLEIRO.pe.busca` m sendo o 1º do time e antes dos adversários / na área).
- `goleiro.js lerChute`: sem `maoPermitida` no ponto do contato (ou do recuo por cima) → `j.defesa = {fora: true,
  semMao: true, ...}` (bloqueia com o corpo); o cabeceio de PASSE de companheiro conta como passe dele ("proprio").
- `sim.js`: o goleiro entra em `candidatosBolaLivre` quando não pode usar a mão; o "pegou" usa `maoPermitida`;
  `goleiroComoLinha` (anda pela locomoção de jogador de linha: bola no pé, `goleiroNoPe`, ou o do humano sem a bola com o
  analógico mexido — a defesa automática vem antes); `andarComBolaNaMao` (`GOLEIRO.maoAnda` + `paredeAreaMao`; colado na
  linha do gol o rumo pedido fica no arco em que a bola nas mãos fica a ≥ `GOLEIRO.soltaLinha` m aquém dela — virar para o
  gol não faz gol contra); `bolaAquemDaLinha` (partida: a bola que sai das mãos fica a ≥ `soltaLinha` m aquém da linha);
  `goleiroComBola` (IA: `esperaIA`; treino e demo — `m.iaJoga[time]`, a entrada com `ia` —: `esperaHumano`; humano na
  partida: sem reposição automática, ENFIADA = `soltarNoChao` (evento `soltou`, `regraMao.soltou`), CHUTE vira
  LANÇAMENTO; tiro de meta: a IA cobra por ele em `PARTIDA.cobrancaHumanoMax`); `pegarDoHumano` (PEGAR na borda, bola a ≤
  `GOLEIRO.pegaPe` m, no pé dele ou solta a ≤ `GOLEIRO.pegaVMax` m/s — a bola rápida é da defesa automática —, na área: mão → "pegou"; sem mão → `m.infracaoMao` e evento `maoGoleiro {id, motivo}`);
  `trocarJogador`: TROCAR segurado `GOLEIRO.trocarGoleiro` s → o goleiro (evento `troca {id, goleiro: true}`;
  `m.trocarDesde[time]`). O goleiro da IA com o pé recebe `ia-tatica.js entradaGoleiroPe` (sem a bola: ao ponto de
  interceptação; com ela: espera `pe.espera` s e passa curto ao companheiro livre a `dMin–dMax` m, nunca para trás; com
  adversário a < `pe.pressao` m ou sem ninguém, chutão para a frente e para o lado dele; nunca conduz).
- `partida.js regrasPartida` (bola rolando, antes das faltas): `m.infracaoMao` → `apitarMao` (eventos `apito {motivo:
  'maoGoleiro'}` e `infracaoMao {id, time, motivo}`; parada `tiroLivre` indireto do adversário); mais de
  `GOLEIRO.oitoSegundos` s → `oitoSegundos` (eventos `apito {motivo: 'oitoSegundos'}` e `oitoSegundos {id, time}`; parada
  `escanteio` do adversário do lado do goleiro). `rolou` no tiro de meta com a bola nas mãos zera o relógio dela.
  `montarTiroDeMeta`: adversários na área vão para fora (evento `corteBolaParada {parada: 'tiroDeMeta'}`; `main.js` corta a
  câmera nele, como no recomeço — a mesma linha do branch `golaco/bolas-paradas`; `teste-estadio` item 11).
- IA: `acoes.js escolherAlvo` — na partida a IA só passa para o goleiro com `recuoSeguro` (`GOLEIRO.recuoIA`);
  `ia-tatica.js pressionavel(m, o)`: o goleiro com a bola no pé é pressionado, com ela nas mãos não.
- Entrada e tela: `BOTAO.PEGAR` (4096); `SENTIDO_FASE` O/RB = PEGAR (ataque) / PRESSÃO (defesa); botão de toque
  `btn-pegar` na vaga 'd' do ataque, visível só com `#toque.goleiro-pe` (`entrada.definirGoleiroPe(v)`, main.js:
  goleiro do humano com a bola no pé). API de testes: `__golaco.cenaDeTeste('pressao' | 'goleiroMao' | 'goleiroPe')` e
  `__golaco.indicadores` (`{pressao: {x, y, z} | null, oito: {x, z, segmentos, total} | null}`).

### Testes
`teste-parado`, `teste-pressao-humano` (pareado, `tools/lib/pressao-pareada.mjs`) e `teste-goleiro-regras` no padrão;
`teste-defesa-humano` (a meta antiga do PRESSÃO, que passava sem o botão, virou a pareada); `teste-controles` (celular:
a marca do PRESSÃO, o PEGAR, o goleiro andando com a bola e o anel); `teste-goleiro-trava` segue medindo o treino;
`teste-entrada` (O/RB no ataque = PEGAR); `teste-taticas` mede a forma com `IA_DEFESA.lento` desligado (a cena prende a
bola parada no pé do condutor).

### Equilíbrio (painel de 144 partidas, mesmas sementes da base)
`GOLEIRO.logit.c0Partida` (−0,1): `goleiro.js chanceDefesa(..., partida)` soma no logit só na partida (o treino não
muda). Sem ele as defesas de 6 a 16,5 m iam a 60,8% (meta 55–60%): as regras tiraram gols fáceis nessa faixa (177 → 164
com as mesmas defesas). Com ele: 59,0% · total 68,0% · de fora da área 86,8% · gols 2,13 (base 2,13) · impedimentos 1,15
· bola parada 29% dos gols — nenhuma medida que estava na meta saiu dela.
