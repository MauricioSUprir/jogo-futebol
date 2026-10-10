# GOLAÇO — contratos entre módulos

Regra de ouro: **a lógica (`js/*.js` fora de `js/render/` e de `js/entrada.js`/`js/main.js`/`js/hud.js`/
`js/editor-time.js`) não usa three.js nem DOM**. Ela roda nos testes em Node. Toda aleatoriedade passa pelo gerador com
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
    freia antes da borda. Vale da bola morta (lateral, escanteio e tiro de meta; a saída é montada por teleporte) até a
    bola rolar; o cobrador e quem está `'parado'` ficam de fora.
- **`ia-tatica.js`**: `entradaIATatica(m, j)` → `{x, z, botoes}` (despacho: `iaClassica` ou goleiro com a bola nas mãos
  → `entradaIA`; recebe/corrida/bola livre; condutor → `condutorTatico`; fase `'com'` → `apoioTatico`; sem bola → a IA
  sem bola), `estadoIA(m, j)` (prepara `j.ia` para usar o `para()` de fora do ia.js).
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
  `bloqueada` (o "Editar time" aberto: nada vaza para o jogo, só a pausa).
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
- `tools/teste-custo.mjs`: razão partida ÷ treino no mesmo processo (média e p95 ≤ 2,5×; nenhum passo > 50 ms — acima de
  20 ms de parede, vale a CPU do fio principal: `process.threadCpuUsage`, sem a espera do escalonador nem os fios de fundo).
- `tools/teste-desempenho-celular.mjs` (navegador): Chromium 844×390, Média, CPU 4×, 30 s de partida demo; CPU por quadro
  sem a GPU p95 ≤ 6 ms e média ≤ 3 ms.
- Otimização da lógica: o hash da PARTIDA tem de ficar igual antes e depois (além do `hash-igual` do treino):
  `node tools/hash-partida.mjs` (repositório × HEAD; `--ref <commit>` ou `--base <pasta js>`): partidas inteiras IA × IA e
  com humano aleatório (botões de defesa e uma edição do time), `hashMundo` a cada 300 passos nas duas cópias da lógica.
