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
- `passo(mundo, entradas)` — avança 1/60 s. `entradas = { [id]: {x, z, botoes, repete?} }`:
  analógico **já no mundo** (|v| ≤ 1, quantizado em 1/1024) + máscara `BOTAO` (`config.js`). `repete: true` = a MESMA
  leitura do analógico do passo anterior (o `main.js` lê a entrada uma vez por quadro: a 30 qps o 2º passo do quadro
  repete a do 1º); sem o campo, cada passo é uma leitura nova (testes em Node, API `__golaco`).
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
- `ox, oz` (condução curta, 12/10; **só o desenho**): deslocamento que a pose soma ao pé desenhado no ar para a
  chuteira (cápsula tornozelo–ponta) parar na SUPERFÍCIE da bola dele (posse ou domínio, bola abaixo de
  `GESTO.superficieVBola`, corpo acima de `GESTO.superficieV`): a direção é do centro da bola para o tornozelo e a
  distância é a saída do centro da bola da cápsula. Anda só com o que sobra de `GESTO.velSuperficie` depois do passo
  de `tx, tz`, e fica abaixo de `GESTO.velDesvio × livre` (zero na saída do chão e no pouso). A física NUNCA lê
  `ox, oz` (pouso, goleiro e hash usam `tx, tz`). Medido (`teste-conducao`): chuteira dentro da bola 61,3% → 32% dos
  quadros só com este ajuste, 46,3% com o toque mais frequente da condução curta (o resto é o pé que POUSA embaixo da
  bola — ponto de pouso da física); a meta PENDENTE de ≤ 1% continua.
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
  pedidoPedalada, ladoOlha, ritmo, ultLanc, ultMod, descansoBote, defH, conter, descanso, contorno, recep, porHumano`), com
  `undefined` (o mesmo valor de antes da 1ª escrita), na mesma ordem para todos: os 22 ficam com UMA classe oculta
  do motor JS. Com uma ordem por jogador (eram 9 formas na partida) os acessos ficavam megamórficos e cada leitura de
  número alocava (~300 KB de lixo por passo). **Campo novo no jogador: declarar em `criarJogador`** (o mesmo vale
  para `j.cond`: `criarCond`).
- `freqPassada(s, comBola)` e `cargaPassada(s)` são a conta de `infoPassada` sem alocar (use no caminho quente);
  `progressoBalanco` devolve um objeto REAPROVEITADO (ler os campos na hora) e `pontoPouso` aceita um `out`.

## Condução (`js/conducao.js`)
`j.cond = { toque{tick, pe, bx, bz, tipo, tol?, modo?, desde?, qx?, qz?}, ult{tick, pe, bx, bz,
dx, dz, v, tipo}, busca, longeDesde, pedalada{tick0, lado}, cortePendente, corteRumo,
semDominioAte, puxada{tick0, rumo}, esperaSalto, restoPassos }`. O toque é marcado com antecedência e o impulso é calculado
no próprio tick. **O toque sai sempre do pé livre** (`peLivre`: no ar desde antes deste tick, com o outro
no chão; no domínio vale também com os dois no ar). Com os dois pés no chão, `saidaParaToque`
pede à passada que tire o pé do toque do chão a tempo, e o toque espera por ele
(`GESTO.esperaSaida`). `atualizarGesto` (no fim do passo) integra o gesto de cada pé.
- Tick do próximo toque forçado (antes de o corpo alcançar a bola, ou freando) cai num tick com um
  pé livre na passada prevista (nunca na fase de voo da corrida).
- **Passos entre toques pela velocidade** (condução curta, pedido de 12/10; `passosDoToque`): `CONDUCAO.passosPorToque`
  dá os passos por toque pela velocidade do corpo (1 até 3,5 m/s, 1,5 a 5,6 m/s, 2 a partir de 7,4 m/s); no meio da
  tabela 1 e 2 se alternam pela difusão do erro (`restoPassos`; sem rng, a mesma regra para o humano e a IA). Ficam em
  2 (um toque por passada, como antes): domínio, `j.inv`, freada (pede 1 m/s a menos do que corre), analógico além de
  `CONDUCAO.angRitmo` do sentido da corrida e passe/chute carregando (`j.carga`, `j.pedido`). A condução curta (MOD) e
  a proteção: 1 passo fixo. O primeiro replanejamento (folga/arco/ultrapassagem → 1 passo) só roda quando o ritmo deu
  2; o da violação de `semUltrapassar` roda sempre. A física do toque, a previsão do corpo, `folgaMax`, `alcance`,
  `intervaloMin` e `faseToque` não mudam.
- **Gesto do analógico no tick do toque** (`j.saltoTick`, marcado por `sim.js aplicarEntrada` quando o analógico pula
  mais que `CONDUCAO.saltoGesto` num tick; `cond.esperaSalto`): o toque marcado para esse tick espera 1 tick (se a
  bola continua ao alcance) e lê o analógico de novo; se ele ainda pula, ou a bola sairia do alcance, sai um **toque de
  freio** (`executarToque(…, freio = true)`): no sentido da velocidade do corpo, até s²/(2·freioGiro) + ofsFrente(s)
  à frente dele, com v0 = `velParaParar` (a mesma conta da rolagem). O freio não põe o corpo em inversão (`j.inv`);
  abaixo de 2,5 m/s o toque sai normal. A espera é pela próxima leitura NOVA do analógico (`j.leituraTick`, o passo da
  última entrada sem `repete`; `cond.esperaInicio/esperaLeitura`): com a entrada marcada `repete` (a mesma leitura do
  quadro anterior) o toque segue esperando, até 3 ticks e com a bola ao alcance; chegou a leitura nova, decide como
  acima (pulou de novo → freio; não pulou → toque normal). Se o pé do toque sai do chão antes, o toque fica para o passo
  seguinte. A 60 qps (toda entrada nova) é exatamente a regra de 1 tick. (Contraprova de 13/10: a 30 qps o toque que
  esperou via a leitura do meio do gesto repetida e saía para o lado — 2,5 m no giro de 180° comum e 4,2 m com o gesto
  no tick do toque; `teste-cortes`, entrada a 30 qps, ≤ 0,35 m = 0,25 + o passo a mais da leitura a 6 m/s. O freio
  quando a janela da passada fecha sem leitura nova foi medido e descartado: mandava a bola reto nos cortes de uma vez
  — 22 trechos de > 0,6 s com a bola longe em 480 sementes do roteiro duro a 30 qps, contra 7 sem ele.)
- **Placas:** o toque não manda a bola além das placas (`ateAPlaca`; `CAMPO.meioX/meioZ + entorno`): com o alvo além
  delas, a bola sai para parar antes (`velParaParar`). Só acontece fora do campo (treino e testes).
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
- **Ninguém passa da bola quase dominada** (só na partida, `m.partida`; o treino fica bit a bit igual; pedido do dono,
  15/10; medida em `tools/medir-passa.mjs`, teste `teste-nao-passa`):
  - **domínio da IA embalada** (`executarToque` com `tipo 'dominio'`, quem não é o humano — `!j.porHumano` — sem a
    recepção assistida, a ≥ `CONDUCAO.dominioIA.vMin` m/s): o 1º toque é planejado com o analógico trocado, só durante
    o plano, pelo sentido da corrida no ritmo de agora (`magParaVelocidade`, sem CORRER/MOD se não precisar) — a
    entrada da IA na recepção é a de chegar ao ponto do encontro e muda no tick seguinte para a do condutor. O
    `cond.ref` fica com esse analógico (o condutor que pedir outra coisa replaneja no tick seguinte, com a bola à frente);
  - **proteção só até `CONDUCAO.protecaoVmax` m/s** (`emProtecao`): acima, o MOD é a condução curta (freando com a bola
    no pé); a proteção começa quando o corpo cai a isso;
  - **passe lento não é só do recebedor** (`sim.js bolaLivre`, `RECEPCAO.passeLento`): com um passe para outro no ar, o
    candidato que só MARCOU o domínio (posse ainda nula, o mesmo `voo.tickChave`) não encerra a vez — seguem os que
    estão com a bola no chão, até `passeLento` m/s e ao alcance do pé AGORA (`bolaLentaNoPe`): o adversário que corta e
    o companheiro de quem passou em cima dela (contraprova: só com o adversário, o companheiro deixava o passe lento
    correr colado no pé). Mesma forma do `soMarcou` do cabeceio (PR #471), que deixa seguir quem corta o passe
    (`cortandoPasse`), o controlado do humano e o goleiro adversário (o de quem passou, nunca) — na junção, as condições
    se somam (OU).
  - **virada da IA compatível com o embalo** (`ia-ataque.js viradaComEmbalo`, só o condutor da IA tática — o humano
    vira como pede): até `IA_ATAQUE.condutor.virada.janela` s depois da posse nova e acima de `vMin` m/s, se o rumo
    pedido está a mais de `anguloEmbalado(v)` (conducao.js) da corrida, a entrada vira só até esse limite (× `curva`) e
    a inclinação pede a velocidade em que o resto do ângulo cabe (`velocidadeParaAngulo`, no mínimo `vFim`; sem
    CORRER/MOD — `magParaVelocidade`). Enquanto vira, `decidir` não troca o rumo da condução (`ia.viradaOk === false`);
    quando a virada cabe, o compromisso recomeça (`ia.opDesde`). Vale também com uma ação carregando (o corpo segue o
    pedido de condução).
  - **domínio marcado não sobra com a bola de outro** (`sim.js`, laço do movimento, só o controlado do humano — sem a
    IA jogando por ele): com `m.posse` de OUTRO jogador (no pé ou na mão do goleiro), o `cond.toque` de tipo `'dominio'`
    é apagado antes de `movimentoRecepcao` — só a bola livre (`tentarDominio`) refazia ou apagava o plano, e o plano
    velho guiava o corpo (em corrida reto até o ponto do toque; de frente ou assistido a ≤ 1 m/s) até a bola ficar livre
    de novo, sem obedecer ao analógico. Medida: `teste-nao-passa` meta 4 (episódios de ≥ 2 passos do controlado). Na IA
    o plano velho fica (pendência: apagado para todos, a defesa da IA perdia a intensidade calibrada na #471).
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
  estado(), desenhar(), cameraLivre({de, para, fov} | null), naTela(x, y, z) → {x, y} px CSS e `atras` (o ponto atrás da
  câmera: a projeção dele cai espelhada dentro da tela — "no quadro" é na tela E `!atras`)}`.
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
  linhaX, idImpedido, time, lado, defensor, por})` (P1 câmera 'linha', 0,6× até o passe — sem congelar desde 12/10 — e
  até o apito — o toque do impedido — em ≤ 2,2 s reais: `congela.velDepois` = 1× ou mais depressa com o apito longe do
  passe, até 2×; além disso para antes do toque; P2 a análise semiautomática: seção seguinte), `roteiroMenu(anel)` (os últimos 10 s, TV 1×; a menos de 3 s
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

## Replay: análise semiautomática do impedimento e posição legal (pedido de 12/10; contrato)
Pedidos do dono (12/10): "no impedimento, quero que seja marcado o impedimento, tenha cena de impedimento, tipo aquelas
cenas de replay do impedimento semiautomático" e "pode colocar o selo IMPEDIMENTO sim, e em um replay qualquer, aparece uma
cena de quando NÃO foi impedimento também". Pesquisa: `PESQUISA-ESTADIO.md` §9.1. **Só desenho**: a cena lê o anel do
replay e a simulação espera parada (`hash-igual` e `hash-partida` IGUAIS; `teste-replay` F6 com × sem replay). Constantes
em `config.js REPLAY.impedimento` e `REPLAY.saot`.
- **Lógica (1 campo, fora do hash)**: `impedimento.js fotografar` guarda `defensor` (o id do penúltimo adversário que faz
  a linha; null = a bola ou o meio-campo) em `m.partida.imped`; `regraImpedimento` devolve `defensor` na infração e
  `partida.js marcarImpedimento` o põe no evento `impedimento` (ao lado de `por` e `tickFoto`). O hash não lê o campo.
- **Anel (`render/replay-anel.js`)**: por passo, a foto da Regra 11 em vigor no fim dele — `foto(tick, time, por, def,
  linhaX, lado)` (Int32/Int8/Int16/Int16/Float32/Int8; −1 = nenhuma) — e as marcas do passo — `marcar(bits)` (bit0 =
  chute ou cabeceio PARA O GOL, bit1 = gol: `marcasDoPasso(eventos, voo)` — o cabeceio de passe e o corte do rival não
  são chute); +~9 KB fixos (3,37 MB no total). `main.js gravarNoAnel(cortou, eventos)` só lê
  `m.partida.imped` e os eventos. Funções puras: `fotoNoTick`, `marcasNoTick`, `poseNoTick(anel, tick, id, out, xz)`,
  `parteMaisAvancada(pose, lado)` (cabeça, tronco e pés + o raio da cápsula: `JUNTAS_VALEM`, `RAIO_PARTE`; braços não
  contam, Regra 11) e `cadeiasNoIntervalo(anel, de, ate, time, out)` (A → B do time: a última foto de A seguida da 1ª de B,
  sem foto nula, do adversário ou corte no meio).
- **Cérebro (`render/replay-saot.js`, puro, Node)**: `cenaImpedimento(anel, ev)` → `{tipo, fotoTick, idAtac, idDef, idPor,
  linhaX, lado, margem, mesmaLinha, atac, def, por, bola, zMin, zMax}` (o defensor vem do EVENTO); `checagemLegal(anel,
  {golTick | fimTick, time?, lado?, de?, teste?, limite?, semPartes?})` → a cena de posição legal mais apertada ou null:
  (i) o lance acaba em gol do time (pausa: em chute/gol) sem a foto zerar no caminho; (ii) cadeia A → B depois do último
  corte; (iii) a linha era um defensor; (iv) margem = (linhaX − x de B)·lado em [−0,10; 1,00] m; (v) legal também pelas
  partes do corpo (sem tolerância). `medirCadeia`, `enquadrarSaot(anel, cena, aspecto)` (pinhole própria, cilindros de
  0,35 × 1,9 m: os dois no quadro com 8% de folga e sobreposição ≤ 30%, câmera ≥ 2 m e fora dos sólidos —
  `estadio-forma.js solidoEm` —; mira o centro do par na tela; níveis: 0 = 16/22° e ±12/±20° a 9–30 m; 1 = o mesmo até
  45 m (os dois a 30–48 m na largura); 2 = sobe e abre até 62°/±40°; a checagem de sólidos — dezenas de amostras de
  `solidoEm` — só no candidato que enquadra ou que seria o "menos ruim": `custoEnquadrar.solidos`, S9 ≤ 15 mil por
  enquadramento; antes 415 mil), `medirCandidato`, `cameraSaot(enq, u, out,
  reduzir)` (órbita do alto: 68°, azimute final + 35° para fora, 1,3 × a distância), `faseSaot(t, tipo, out, mesmaLinha,
  reduzir)` (`{fase, u, parede, plano, pulsoDef, pulsoAtac, batidaDef, batidaAtac, cor, selo, decidido}`),
  `duracaoSaot(tipo)`. O ponto que vale é o CENTRO do corpo (o quadril; o `impedimento.js` decide por ele): parede no x da
  linha (= o defensor), plano no x do atacante — o desenho nunca contradiz a decisão.
- **Roteiros (`render/replay-roteiro.js`)**: impedimento = P1 `{cam: 'linha', vel 0,6, congela: {tick: foto, s: 0,
  velDepois}}` (passe − 1,0 s até o toque, depois do passe em ≤ 2,2 s reais, 1–2×) + P2 `{de = ate = foto, vel 1, cam:
  'saot', congela: {tick: foto, s: 3,6, velDepois: 1}, saot: cena}`; total ≤ 7,47 s. Gol: `roteiroGol(anel, {..., time})`
  acrescenta a análise LEGAL de 3,4 s no fim quando há checagem (orçamento 12 → 13 s, golaço 14 → 15: encolhe o plano de
  TV — nunca começando depois de 0,5 s antes do passe checado —, depois o de trás do gol; não cabe = sem checagem); SEM
  checagem o roteiro é o de antes, campo a campo (`teste-saot` S6, também nos gols de verdade). `roteiroMenu` também
  acrescenta a análise (a cadeia acaba em chute ou gol). `roteiroLegalTeste(anel, limite?)`, `tempoSaot(rel)` (no último
  quadro o relógio zera `congelado`: devolve `s`, o selo não pisca), `linhaDoReplay` decide pelo plano (`{visivel, x,
  opacidade, cor}`: amarela no P1 do passe em diante; branco-gelo na análise, verde na decisão legal). Relógio: um plano
  só congelado não pode ser o 1º; `congela.s = 0` só troca a velocidade (sem quadro parado).
- **Diretor (`render/replay.js`)**: `posicionar` com o caso 'saot'; `iniciar` chama `enquadrarSaot` uma vez por roteiro
  (e de novo no `redimensionar`) e `enquadrarLinha` usa o `defensor` do roteiro; `cena()` → `{ativa, tipo, ids (impedido,
  defensor, quem passou), parede, plano, pulsoDef, pulsoAtac, batidaDef, batidaAtac, cor, selo, decidido, mesmaLinha, fase,
  t, cena}`; `estado.saot` = `{tipo, fase, t, el, az, idDef, idAtac, idPor, margem, linhaX, lado, fotoTick, mesmaLinha,
  selo, enquadrado, desvio, elFim, dist, ladoCamera}`; `saotDeTeste(tipo, {limite})`, `legalMaisApertada(limite)`,
  `reduzirMovimento` (o "reduzir movimento" do sistema: sem órbita, selo sem animação).
- **Desenho**: `render/linha-impedimento.js` — `mostrar(l)` aceita `l.cor`; 2ª malha `planos-saot` (1 BufferGeometry:
  parede e plano com borda + 2 anéis de 32 segmentos, 144 triângulos, cor e alfa por vértice, `depthWrite: false`,
  `renderOrder` 4, sem sombra; pré-carregada no 1º quadro desenhado — `atualizar(mundo, dt, desenha)`), `mostrarSaot(sc |
  null)`, `estadoSaot`. `main.js desenharReplay`: na análise só os jogadores do lance (`soDaCena`, lista de referências;
  `jogador3d.js` não muda), `linhaImped.mostrarSaot`, `hud.terco(...)` só com `decidido`; `fimReplay` apaga os dois.
  Cores: impedimento #ff3b30, legal #19e07a, parede branco-gelo #eef6ff, plano neutro #d8dee2, pulso #6fc3ff.
- **Selo e terço de baixo** — a ÚNICA exceção à "sem narração" (dono, 12/10): `index.html #terco` (irmão de `#replay`,
  z-index 31, `pointer-events: none`, `data-caixa="terco"`, canto de baixo à esquerda), `hud.terco(spec | null)` (só mexe
  no DOM quando o tipo muda; `spec.tipo` 'impedimento' → "IMPEDIMENTO", 'legal' → "POSIÇÃO LEGAL"; exatamente esses
  textos, sem nome nem minuto; a cena de substituição acrescenta o tipo dela), `hud.tercoTipo`. Só no quadro final da
  análise; fora do `TEXTO_EVENTO` (nenhum lance ao vivo vira texto: `teste-hud-minimo` H2 sem mudança). `html.em-replay` e
  `html.modo-prints` não escondem; `html.sem-hud` esconde. Pílula `rgba(7,9,10,.85)`, borda esquerda de 4 px e bandeira
  na cor da decisão, 15 px/40 px no PC e 13 px/34 px no celular; entra em 0,2 s (sem animação com "reduzir movimento").
- **API** (`window.__golaco.replay`): `saotDeTeste(tipo, {limite})`, `legalMaisApertada(limite)`, `desenhados`, `planos`
  (o `estadoSaot` + `selo`), `reduzirMovimento(v)`, `noAnel(tick, id)`, `selo(tipo)` (testes de layout); `estado().
  desenhoTriangulos`.
- **Testes**: `tools/teste-saot.mjs` (Node, padrão: S1 durações a 60 e 30 qps, S2 defensor no anel, S3 critério com 10
  cenas montadas — `lib/cena-montada.mjs` — + 2 da pausa, S4 câmera nas montadas e nos impedimentos de verdade das
  sementes 1–40 — `lib/varre-saot.mjs`, `lib/anel-node.mjs` —, S5 selo, S6 gol com/sem checagem, S7 coerência, S8 pose);
  `teste-replay-anel` (B8, B11, B16, B17, C8 com os 2 planos; congelamento ≥ 3,0 s; ≤ 7,5 s); `teste-replay` (C4 no P1, C5
  ≥ 3,0 s no P2, A4/A5 com a checagem, A10 e F1–F11); `teste-impedimento` E1 (o defensor = o penúltimo do árbitro
  independente); `teste-desempenho-celular` (informativo: a análise com CPU 4×); `tools/medir-saot.mjs` (fora do CI: a
  frequência da posição legal em 144 partidas); prints `*-impedimento-saot*`, `*-legal*` (`lib/acha-legal.mjs`) e a
  sequência `pc-impedimento` → `pc-impedimento-saot-orbita` → `pc-impedimento-saot`.

## Área técnica, treinadores e as câmeras 3 e 4 do replay do gol (pedidos de 12/10; contrato)
Pedidos do dono (12/10): "quero que tenha uma 3ª e uma 4ª câmera de replay, onde uma é a visão em 1ª pessoa do jogador
fazendo o gol"; "a 4ª pode ser a visão do treinador, quero a área técnica e o treinador". Pesquisa: `PESQUISA-ESTADIO.md`
§12 e §13. **Só desenho**: os treinadores andam num mundo à parte e só LEEM a partida; o replay lê o anel e a simulação
espera parada (`hash-igual` e `hash-partida` IGUAIS; `teste-tecnicos` T10). Constantes em `config.js` `ESTADIO.areaTecnica`,
`TECNICOS`, `REPLAY.gol.extras`, `REPLAY.primeira`, `REPLAY.treinador`; `REPLAY.vagas` = 26 (22 + 2 treinadores + 2 de folga).
- **Área técnica (IFAB Regra 1; `estadio-forma.js`)**: `areaTecnica(time)` → `{time, lado (−1 mandante | +1 visitante), x0,
  x1, z0 (a frente: 1 m da lateral), z1 (o fundo: as placas − 0,3), poligono}`; `dentroAreaTecnica(time, x, z, margem)`;
  `retasAreaTecnica()` → as 6 linhas (frente, dentro, fora de cada área; 0,12 m, para dentro). `render/campo.js` as desenha
  na malha das linhas (+0 chamadas).
- **`js/tecnicos.js` (puro, Node; sem rng fora do `rng.js` — `hash01(semente, id, bloco)` —; nunca escreve no mundo)** — a API:
  - `criarTecnicos(times, semente)` → `T = {k, semente, tecs: [tec × 2], golTick, golTime, mini}`; cada `tec = {id (210
    mandante | 211 visitante: `IDS_TECNICOS`; não cruza com os jogadores 1–123 nem com os árbitros 200–203), time, lado,
    area, j (o corpo: criarJogador, posição 'TEC'), estado, variante, postura, atu/ant (pose, 57 floats), x0/z0/r0 →
    x1/z1/r1 (o passo anterior → o atual, para interpolar), ...}`;
  - `criarLeitura()` → `L` (reaproveitada: nada alocado por passo); `leituraDoMundo(m, eventos, L)` (DEPOIS do passo da
    partida: bola, posse por time, lado, parada, placar, os eventos que eles olham — gol, chute/cabeceio, passe, defesa,
    trave, fora, impedimento/falta/cartão/pênalti (reclama), roubada, intervalo, fim, saída — e os jogadores perto das
    áreas: `L.perto` x, z, vx, vz e `L.pertoId`, de z > meioZ − 8 e |x| < xLim[1] + 8); `leituraVazia(L)` (pré-jogo: sem
    jogo); `pedirAplauso(L, s)` (os dois aplaudem `s` s: o pré-jogo, os times saindo do túnel);
  - ESQUIVA (15/10, frente "replay robusto"): uma só, para a bola e os jogadores (`esquivar`): o caminho previsto da bola
    (rolagem de bola.js, 1 s) e o de quem está a ≤ 14 m (2 s, com a curva que ele vem fazendo, medida pelo id, e o raio
    crescendo ½·`TECNICOS.esquiva.curva`·t²); com o caminho para o alvo de agora passando perto de alguma, ele vai para o
    lugar da área (16 direções × 3 distâncias; a `TECNICOS.esquiva.borda` m dos lados e da frente além da margem de sempre:
    o pé da disparada) com a MAIOR folga até todas, prevendo o próprio corpo (rampa de 5,5 m/s² até
    3 m/s), evitando o plano da TV com a bola perto da linha de cá; reações ao gol de qualquer gesto: a mão sobe com o pico
    em `TECNICOS.maoPicoGol` m/s, passa do topo da cabeça em `TECNICOS.comemora.cruza` s (a mistura das mãos espera ou
    encurta) e nunca anda mais que `TECNICOS.maoPassoMax` m num passo (a rede de segurança);
  - `passoTecnicos(T, L)` = 1 passo de 1/60 s dos dois (estado → locomoção do jogo → pé desenhado → pose com torção,
    cabeça na bola e braços por IK; a mistura de um gesto para o outro cresce com o caminho da mão: ≤ `maoPico` m/s no
    pico da troca comum e ≤ `maoPicoGol` m/s na reação ao gol — `comemora.sobe`/`misturaGol` só crescem com a mão vindo de
    longe, T5 ≤ 0,15 m por passo); `poseTecnico(tec, out)` (57 floats no mundo: o formato do anel e do desenho);
  - (16/10, frente "cenas robustas") o pé no ar POUSA DENTRO da área: o ponto de pouso da passada fica preso a
    `TECNICOS.margemPe` m das bordas (`pousoNaArea`, depois de `passoPassada`) — o passo lateral sem cruzar as pernas
    empurrava o pé até 0,7 m do centro, para fora da área (T2, T20); as VARIANTES vão por RODÍZIO: cada volta usa todas,
    nunca a mesma (gesto, variante) seguida, na ordem da sequência de Weyl da semente (a j-ésima vez do gesto:
    frac(semente·φ + treinador + gesto + j·(√2 − 1))) — equidistribuídas em qualquer faixa de sementes seguidas (T8, T21);
    as palmas depois da comemoração também entram no rodízio; o "vamos" na saída, uma vez por gol; a rede de segurança da
    mão (≤ `maoPassoMax` m por passo) e o "fora da cabeça" em duas voltas (o "fora da cabeça" sozinho, depois dela, passava
    a mão de 0,15 m num passo na troca de um gesto para outro andando: T22);
  - `ESTADOS` = observa, instrui, aplaude, reclama, lamenta, comemora, sofreu, intervalo, fim, vamos (variantes em
    `TECNICOS.variantes`); `infoTecnicos(T)` → por treinador `{id, time, x, z, rumo, v, estado, variante, varianteNome,
    postura, olhar, noAr, rapido, recuo, esquiva}` (testes e API);
  - câmeras de cinema: `distanciaTecnico(x, y, z, cx, cz)` (até a cápsula de 0,30 × 1,85 m) e `afastarDeTecnicos(p, T |
    T.tecs | [{x, z}], dmin = 0,6)` (empurra a câmera na horizontal, sem entrar nas placas) — usados pela comemoração, pelo
    pré-jogo e pela lateral do golaço;
  - **GANCHO das cenas** (frente `golaco/cenas-jogo`: `comemoracao.js opc.treinador`, `cena-fim.js treinadores`, o
    `main.js treinadorDoTime(t)` dela): `treinadorDoTime(T, t)` → `{id, time, x, z, rumo, kit}` do treinador do time `t`
    ONDE ELE ESTÁ (dentro da área técnica: `teste-tecnicos` T16) ou `null` sem treinadores; `kitTecnico(time)` →
    'tecnico0' | 'tecnico1'. Quem juntar as duas frentes: (1) `function treinadorDoTime(t) { return tecnicos ?
    treinadorDoTimeTec(tecnicos, t) : null; }` no `main.js` (importe com outro nome); (2) o contrato da outra frente pede
    `id ≥ 300` só para não cruzar com ninguém — 210/211 já não cruzam (jogadores 1–123, árbitros 200–203) e são os ids
    gravados no anel (`it.tecnico`); (3) durante uma cena que já tem o ator 'treinador' do time t, o `anexarTecnicos` do
    `main.js` tem de PULAR esse treinador (senão ele sai em dobro); (4) o treinador de verdade continua dando passos
    durante a cena (os passos da cena segura: `tecAlfaCena`) e volta ao desenho quando ela acaba.
- **Página (`main.js`)**: `?tecnicos=0` desliga (A/B do custo); na partida, um `passoTecnicos` por passo da simulação, depois
  do estádio (também nos passos da cena segura da comemoração e nos da cena de substituição — o mundo parado; nesta, a
  leitura troca os jogadores perto das áreas pelos atores da cena: `atoresNaLeitura`, e eles saem da frente de quem sai —
  e a câmera de ala dela passa por `afastarDeTecnicos`; `jog3d.reservar` conta os 2); `anexarTecnicos(lista, n, alfa)` põe os dois na lista do
  `jogador3d.atualizar` (o manequim instanciado: +0 chamadas; `it.tecnico`, `it.kit` 'tecnico0'/'tecnico1') no jogo, na
  comemoração e no pré-jogo; o anel grava os dois depois dos jogadores (bit2 de `info`). `jogador3d.js`: os kits dos
  técnicos, o estilo de treinador e `it.ocultar` (`OCULTA.cabeca | OCULTA.tronco`: some a cabeça, o pescoço, o peito, os
  ombros e os braços — a 1ª pessoa); `triangulosPorBoneco`.
- **Roteiro do gol (`render/replay-roteiro.js`)**: `roteiroGol(anel, {golTick, chuteTick, lado, time, autor, contra,
  desvio, tipoChute, reduzirMovimento, extras})` — os planos de antes campo a campo iguais aos de `{extras: false}` (=
  o roteiro antigo); `planosExtrasGol(anel, g, base)` acrescenta, antes da checagem: `{cam: 'primeira', vel 0,6, de: chute −
  0,9 s, ate: gol + 0,4 s, autor, chuteTick, golTick, lado, tipoChute}` (sem gol contra, sem autor ou chute no anel, sem
  "reduzir movimento"; os passos RUINS — outro corpo a < 0,3 m da lente no quadro, a lente a < `REPLAY.primeira.solidoFolga`
  m de algo sólido (estadio-forma.js solidoEm: o gol inteiro, as placas...) ou perto do chão, o próprio quadril/pernas a <
  `proprio` m dela — depois do chute acabam o plano antes, antes do chute o começam depois, até não sobrar nenhum; fica se
  sobrar ≥ 1,2 s reais) e `{cam:
  'treinador', vel 1, de: chute − 0,8 s, corte: gol + 0,3 s, ate: gol + 2,3 s, tecnico (210 + time que marcou)}` (sem lugar
  para a câmera da parte 2: só a parte 1; plano < 1 s sai); nenhum plano atravessa um corte (o começo procura o último corte
  ATÉ O GOL — também um entre o chute e o gol; sem ≥ `extras.primeiraMin` s de corrida antes do chute depois dele, sem 1ª
  pessoa: contraprova 15/10, `teste-replay-anel` B19); extras ≤ 7 s (encolhe o começo
  da 1ª pessoa, o fim da parte 2 e o começo da parte 1, nessa ordem); total ≤ 19 s (golaço 21; checagem + 1). O
  enquadramento vai em `plano.enq` (não enumerável).
- **Olhos (`render/replay-olhos.js`, puro, Node)**: `enquadrarPrimeira(anel, p)` → `{olho, dir, bruto, cabeca, bolaSome,
  fovH 90, perto 0,10, w0, n}` (olho estabilizado: horizontal ≤ 2 cm do olho bruto antes da esfera e ≤ 6 cm depois — o
  recuo na esfera para a 3,5 cm do centro —, altura sem o balanço da passada, dentro da esfera de 0,148 m da cabeça; olhar em
  ÂNGULO: antes do chute a bola puxada 60% para o gol, ≥ −18° e a ≤ `golAngMax`° do centro da boca, descendo em linha (de
  chute − 0,48 s a − 0,07 s) para o ponto do contato e nele até chute + 0,05 s, depois a bola e a bola puxada 35%, também a
  ≤ `golAngMax`° do centro da boca (cabeceio: depois do contato, a bola); depois do fim do plano o olhar fica o do último
  passo dele (os passos de fora não puxam o de dentro); o alvo nunca a < `pisoFrente` m à frente do olho na direção do gol; σ 0,03 s em volta do
  chute; giro ≤ 85°/s por `limitarGiro(yaw, arf, n, L)`; 16/10, frente "cenas robustas": a altura presa pela esfera e por
  [yMin, yMax] vira uma correção DILATADA por gaussiana — σ `sigmaPrende`, começa antes e acaba depois, sem degrau; só as
  presas acima de `prendeMin` m (5 mm: a pequena num passo só, no fundo da passada, também é degrau — G17) de antes de
  chute − `prendeAntes` s, e nada no cabeceio (o salto logo depois do agachado) — e a
  GARANTIA da boca do gol: em chute − 0,5 s e de chute + `golDe` s ao gol, o centro da boca a ≤ `golMargem` da meia tela nas
  duas telas, pela correção mínima de rumo/arfagem, dilatada com σ `sigmaGol` — `garantirGol`); `cameraPrimeira(e, t, out)`; `corpoNaLente(anel, e, dmin, sem,
  todos?)` e `lenteRuimPrimeira(anel, e, folga, proprio, todos?)` (o 1º passo ruim, ou todos na lista); `enquadrarTreinador(anel, p)` → parte 1 (o olho na cabeça dele — presa a ≤ `REPLAY.treinador.prende` m do olho bruto —, teleobjetiva fixa
  com 30 m na distância do gol) + `parte2` (`parte2Treinador`: câmera parada no gramado com ele inteiro — pés e alto da
  cabeça da pose — no terço esquerdo, fora dos sólidos, ≥ 0,6 m de qualquer corpo, o lugar com menos gente na frente);
  `cameraTreinador(e, t, aspecto, pequena, out)`; `zLateralDoPlano(anel, de, ate, lado)` (o z da lateral do golaço para o
  plano INTEIRO: meioZ + 1 com um treinador gravado a < 2 m do caminho dela; o diretor calcula uma vez por plano — antes,
  quadro a quadro, ela pulava 2,5 m: `teste-tecnicos` T15) e `cameraLateral(cx, tecnicos, out, z)` (a lateral do golaço fora dos
  treinadores); `tecnicosNoTick(anel, tick, out)`; `planoReacaoTreinador(anel, p, opc)` (a parte 2 para outros planos);
  `projetar`, `fovVerticalDe`.
- **Diretor (`render/replay.js`)**: `posicionar` com 'primeira' (plano de recorte próximo 0,10 m) e 'treinador';
  `desenho()` → `{ocultar: o autor na 1ª pessoa, sem: o treinador na parte 1 da visão dele, semBola: a bola a < 0,35 m da
  lente}`; `cameraExtra(t)`; `estado` ganha `autor, tecnico, corte, parte (1 | 2), fovH, duracoes, cams`. O "Pular" vale em
  qualquer plano (um toque/tecla pula o replay inteiro).
- **API** (`window.__golaco`): `replay.desenho` (`{ids, ocultos, semBola, bola}` do último quadro), `replay.cameraExtra`,
  `replay.custo.quadroReplayP95`, `replay.chuteDeTeste(id, tipo)` (o chute da física de um teste conta para o autor;
  `tools/lib/gol-roteirizado.mjs {marcarChute}` dá 60 passos de corrida do autor antes do chute, para o corte do
  teletransporte ficar antes dele), `replay.corteNoAnel(tick)`;
  `estadio.tecnicos` (`{lista: infoTecnicos, msPorPasso, passos (os do jogo), k (todos, também os das cenas)}`),
  `estadio.mostrarTecnicos(v)` (só o desenho), `estadio.triangulosBoneco`.
- **Testes**: `teste-tecnicos` (Node, padrão: T1–T19; T17 a reação ao gol de qualquer gesto, T18 quem corre perto da
  área técnica e T19 a esquiva saindo da quina da área com os pés dentro dela, sem partida; as partidas seguem 4 s depois do apito final; `--estresse` 72 partidas, 3× as sementes do T17 e
  2× as direções do T18 e do T19; `--so-sinteticos` só o T17, o T18 e o T19), `teste-replay-anel` (G1–G14: ordem, os planos de antes iguais,
  orçamentos, anel e cortes, pênalti, olho/olhar/giro/bola/gol da 1ª pessoa, corpo na lente, as duas partes do treinador,
  a lente fora dos sólidos, a reação dele, pose gravada = ao vivo, G14 o gol de cabeça sintético com o autor seguindo para
  dentro do gol — `--so-g14` —; `--estresse` 84 partidas; o G8 cresce a amostra com as
  sementes seguintes até 48 gols com autor), `teste-replay` (navegador: G1–G3 ordem, durações e quem
  some; G4 celular 844×390 Média — chamadas por plano ≤ o máximo ao vivo + 1 e CPU p95 do quadro do replay ≤ a do jogo + 1
  ms —; G5 um toque no meio da 1ª pessoa pula tudo; G6 nada some; G7 a câmera dos planos novos sem salto entre quadros), `teste-tecnicos-tela` (navegador, CI: visíveis na TV do
  celular com o banco no quadro, chamadas iguais com e sem eles, CPU do quadro × `?tecnicos=0`, as linhas no gramado e,
  V6, a cena de substituição: eles andam com ela, longe dos atores e da câmera; V7, depois dela, o salto deles entre dois
  passos gravados só com corte; V8, quem está atrás da câmera — a do gol, de costas para a área técnica — não conta como
  "no quadro").
- **Anel e cenas com o mundo parado (contraprova 15/10)**: os passos que os treinadores dão numa cena com a simulação
  parada (a substituição) não vão para o anel; no passo gravado seguinte, um treinador a > `REPLAY.saltoTecnico` (0,25 m)
  do último passo gravado marca CORTE (`main.js gravarNoAnel`; `tools/lib/anel-node.mjs` igual) — senão o replay seguinte
  o deslizava ~3 m num passo. Quem juntar uma cena nova que segura a simulação e anda os treinadores (golaco/cenas-jogo)
  ganha isso de graça.

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
  ±1 rad, o de menor custo — gente na frente da lente a < 2,2 m de profundidade dentro do quadro do PC ou do celular
  (fov × 0,88, até 2,2:1, o eixo girado para o terço esquerdo) ou perto da linha de visão, integrado na reação INTEIRA (até
  o fim da cena: na curta ela dura até 2 s), cada um andando reto para o destino dele na cena (a vaga do abraço, a saída,
  10 m do grupo) e parando nele; o 0 fica se o custo dele for ≤ 0,03 m·s — contraprovas: um defensor andando para a saída
  passava a < 1 m da lente em ~15% das cenas curtas; (15/10) o custo só olhava o 1º segundo e o quadro do PC e um colega
  correndo para o abraço passava rente à lente no celular; `teste-comemoracao` 13, com mais 12 gols naturais); câmera nunca além de 5,5 m das linhas nem dentro do gol; celular: fov × 0,88 e o assunto no terço
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
  ±(0,7 + 0,8k)), vaga (onde o reserva está na simulação), numSai/numEntra, rentaGol, tCruza (a hora em que ele cruza a
  linha: quem atrasou contornando alguém parado apressa até `velSaiMax` = 2,35 m/s para cruzar nela; adiantado, anda a
  `velSai`)}, planos [{nome: 'sai' | 'sai2' |
  'entra', par, t0, t1}], duracao}` (só lê o mundo; 1 par = 5,0 s, ≥ 2 pares = 6,4 s, teto 6,5); `criarCenaSubst(plano, m)`
  → cena (cópias dos 22 por `comemoracao.js criarAtor`; a cópia de quem entra vira quem SAI, com o id e o uniforme dele;
  os reservas e o quarto árbitro, id `SUBST.idQuarto` = 203, kit 'arbitro', em (0; 35,6); a bola copiada — no chão se
  estava na mão de quem sai; só o par 0 tem pré-rolagem de 1,1 s, os outros começam parados); `passoCenaSubst(c)` = 1
  tick com a MESMA locomoção do jogo (`passoCorpo → passoPassada → passoPeDesenhado → alturaQuadril → pose`), desvio
  de Reynolds para quem anda (quem sai rente ao gol só desvia para FORA dele), separação a 0,55 m (dois com a vez colados:
  cede o de depois — quem sai antes de quem entra, o par de antes primeiro), quem freou e assentou fica fixo (sem custo;
  quem vem correndo para fora e pararia a < 0,9 m das placas CURVA para dentro freando — o pedido a 1,45 rad da velocidade,
  para dentro, na velocidade de agora: −freio na linha e latCorte de lado; 16/10, antes ele pedia só a velocidade ao longo
  delas, sem frear, e encostava nelas: S4, S9); `avancarCenaSubst(c, dt)`
  (devolve `alfa`), `tempoCenaSubst`, `duracaoCenaSubst`, `planoEm(c, t)`, `placaNasMaos(c, pose, out)`, `paresDaPlaca(c,
  t, out)` ({indice, n, time, entra, sai, corEntra: 'verde', corSai: 'vermelho'}: troca a cada `placaTroca` s, o do humano
  primeiro), `planoCameraSubst(c, {pequena, aspecto}, out)` → `{nome: 'sai' | 'sai2' | 'entra' | 'fim', de, para, fov}`
  (SAI: câmera de ala FORA da linha, ≥ `lenteMin` + 0,5 m de todo ator — quem sai pelo caminho até o `para` dele —, sem
  ninguém grande no quadro, nunca em sólido — `estadio-forma.js solidoEm`; sem nenhuma livre na grade, a 2ª grade
  `camSai.longe`/`foraMax`; sem nenhuma livre nela, a menos ruim (custo duro finito), nunca a posição padrão sem conferir;
  o corpo inteiro acima da faixa: pés a `SUBST.pes` do quadro; ENTRA: câmera baixa no gramado do lado de cá, pan do
  quarto para o reserva, o reserva nunca mais perto da lente que a distância em que o corpo cabe no quadro do fov fixo (≈ 5,8 m);
  celular: `comemoracao.js ajustarCelular`), `consumirEventosSubst(c,
  out)` (`{tipo: 'substituicao', cruzou: true, time, sai, entra}` quando quem sai cruza a linha: palmas da torcida dele em
  `render/emocao.js`), `infoAtoresSubst(c)`. Quem entra cruza a lateral só DEPOIS do par dele ter saído, pela linha do
  meio-campo (|x| ≤ 1 m: `±cruzaX`, ou o 1º de `cruzaOpcoes` a ≥ `cruzaFolga` de quem do jogo está parado ali — o
  cobrador do lateral no meio-campo —; do outro lado da linha do meio só se o outro time não troca), a partir de `sinal`
  + `escalona`·ordem s do plano ENTRA. `comemoracao.js` só passou a exportar
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
  contagem segue), `proximaCena()`. O "Replay" da pausa no meio da cena entra na frente da fila (`{tipo: 'replay', ro}`):
  a cena segue com a faixa e o replay vem depois dela (T12). `trocarMundo` cancela a cena, a fila e a faixa. Opção "Substituição: ligada | só a
  faixa" no submenu "Modo de jogo" (`prefs.substituicao`; `?substituicao=0|1` força; desligada por padrão com
  `navigator.webdriver`, `?prints=1` e `?demo=1`).
- **HUD**: `hud.substituicao(ativo)` (classe `em-substituicao`: some o mesmo que na comemoração), `hud.faixaSubst(pares,
  agora, cena | null)`, `faixaSubstQuadro(agora, cena)`, `faixaSubstEstado(agora)` → `{visivel, modo: 'cena' | 'jogo',
  pagina, n, texto, restante, dur}`, `esconderFaixaSubst()`. `#faixa-subst` (role status, aria-live polite): sigla do
  time na cor dele, ▲ ENTRA número nome, ▼ SAI número nome, "1/2" com mais de um par; `data-texto` = a frase do leitor
  de tela ("Golaço FC: entra 22 Wallace Pimenta, sai 9 Diego Albuquerque"). Fica ≥ 4,0 s (mesmo com a cena pulada),
  2,5 s por par (1,8 com ≥ 4), teto 10 s; na cena, a página do plano (SAI/SAI2: o par dele; ENTRA: do 3º par em diante,
  de par em par, sem trocar a < 0,5 s do corte); no jogo (depois da cena ou sem ela) passam primeiro as páginas vistas por
  menos de 0,6·porPar (a última da cena primeiro), cada uma porPar s, e a faixa vai até max(dur, o fim delas) — todo par
  aparece ≥ 1,5 s (`teste-substituicao-tela` T11).
  Lugar: PC embaixo à esquerda (64 px da borda, 280–520 px; no jogo, sem chegar no minimapa); celular na cena embaixo à
  esquerda (área segura + 14 px, ≤ 64 px de altura, sem chegar no "Pular"); celular no jogo, uma linha compacta no lugar
  do aviso (topo + 74 px, ≤ 360 px, nomes da camisa) com o aviso descendo 42 px (`html.faixa-subst-topo`). Sem aviso de
  texto da substituição (`TEXTO_EVENTO` sem `substituicao`).
- **API (`window.__golaco`)**: `cenaSubst` {`ativo`, `estado` ({plano, tempo, total, k, tick, pares, planos, camera}),
  `atores()`, `camera`, `naTela(id?)`, `placa` {`estado`, `naTela()`}, `pular()`, `ligada(v?)` (sem salvar), `custo`,
  `zerarCusto()`, `fila`, `faixa()`}; `substituicaoDeTeste({pares, time, parada})` (a edição na fila e a parada forçada
  como `bolaParadaDeTeste`; a troca sai pelo `aplicarPendentes` de verdade); `estadio.sonsPedidos`; `estado().programas`.
- **Testes**: `tools/teste-substituicao.mjs` (Node, padrão; `--js <pasta>`: sem o módulo, reprova; `--estresse`: + 48
  sementes, 337 paradas, ~1,5 min — rodar em toda mescla da main que mude a simulação: os estados mudam e a cena tem de
  passar em todos) — canhão de 49 paradas (8 sementes × lateral, escanteio, tiro de meta, tiro livre, pênalti, gol + 5 + 5): S1 duração e o corte para a TV; S2
  Regra 3.3 (≤ 0,5 m do ponto mais perto, nunca a boca do gol, antes do fim do plano dele; no 1º quadro andando 2,2 m/s a
  3,0–3,6 m), quem entra pelo meio-campo só depois do par; S3 NaN, ossos, pé plantado ≤ 0,05 m/s e pé no ar (a régua do
  `teste-patinacao`); S4 corpos ≥ 0,5 m, ninguém nas placas nem no gol; S5 hash e rng iguais, sem Math.random, mesma
  entrada = mesma cena (também em quadros variados); S6 ≤ 0,6 ms/tick e criação ≤ 3 ms; S7 lente ≥ 2,5 m, câmera fora dos
  sólidos, o ator no quadro ≥ 95%, os pés acima da faixa no celular; S8 a placa (números, cores, o humano primeiro) e o
  quarto árbitro. `tools/teste-substituicao-tela.mjs` (navegador, CI e antes do deploy; `--raiz <pasta>`): T1–T10 (hash
  com e sem a cena e em Node; tick parado; faixa em ≤ 3 quadros e ≥ 4 s também pulada e "só a faixa"; pular; gol + troca
  na fila e o apito depois; intervalo sem cena (a troca pedida nele e a feita no apito dele: a faixa na saída do 2º tempo); pausa, aba escondida, em pé, `trocarMundo`; nada sobre nada em 4 telas e a
  opção salva; CPU, chamadas de desenho, programas e memória no celular; a placa ≥ 40 px; T11 2 a 5 pares: cada um na faixa
  ≥ 1,5 s, nenhuma página < 0,5 s; T12 o "Replay" da pausa no meio da cena). `teste-editor-tela` 5 confere
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
- **Cavadinha por dois toques no CHUTE** (pedido do dono, 12/10; `acoes.js`, constantes em `ACOES.cavadinha`):
  - `j.porHumano` (sim.js, a cada passo; partida.js `cobrar` no cobrador): os botões são da PESSOA — o controlado do
    time humano com a entrada sem `ia` (a demo/IA jogando pelo humano manda `ia: true` e conta como IA). A carga do
    humano leva `humano: true` e o pedido dela também (`j.pedido.humano`).
  - **2º aperto do CHUTE** com o pedido de chute do humano ainda de pé (não tocou na bola) e até `ACOES.toqueDuplo` s
    depois de soltar o 1º: `j.pedido.cavadinha = true`, `j.pedido.segura = true` (o pedido não é marcado nem expira) e
    a carga nova `{tipo: 'chute', cavadinha: true}`; o toque 'acao' já marcado é desfeito. Soltar o 2º: a força dele
    vale (`pedido.forca`), `segura = false`, a idade conta de novo e o toque é marcado como sempre (lead 2). De primeira
    com o 2º ainda segurado (`executarAcao`): a força carregada até ali. Vale em qualquer lugar e na cobrança do
    pênalti/tiro livre direto (Panenka).
  - **Janela do 2º toque**: o chute do humano de toque rápido (segurado < `toqueRapido` s) leva `pedido.espera` = tick
    de soltar + `janela` s; `processarPedido` só marca o toque da ação a partir de `espera − 2` ticks (a condução segue
    até lá) e o `cobrar` da bola parada espera também. O chute carregado (≥ `toqueRapido`) não tem `espera`: sai no
    mesmo tick de antes (teste-cavadinha C: igual ao da IA na mesma cena). Só o **aperto novo** espera (`carga.novo`:
    o time não segurava o botão no passo anterior — `m.botoesTimeAnt`; no `cobrar`, que roda antes do passo,
    `m.botoesTimeAgora`): o botão que já vinha segurado quando o controle trocou vira borda no novo controlado, mas não
    é toque rápido e chuta na hora (teste-cavadinha I; era o que mudava o hash-igual do treino de ataque).
  - `chute()`: `pedido.cavadinha` → `cavadinha()` de qualquer lugar; a cavadinha AUTOMÁTICA (goleiro adiantado) só
    para o pedido sem `humano` — o chute de um toque do humano nunca vira cavadinha. A pedida mira pelo analógico como o
    chute (`zPeloAnalogico`; sem analógico, 0,4 × z da bola, como a da IA), cai `alemDaLinha` m depois da linha, com a
    elevação `elevPedida` pela força do 2º toque (rápido = 0,72 rad, a da IA; segurado = até 1,0 rad, mais alta) e o
    mesmo erro de força e direção da cavadinha de antes (StatsBomb: difícil de dosar). Teto: a pedida nunca sai mais
    rápida que o chute mais forte do mesmo jogador (`ACOES.chute.v[1]` × finalização × pé; o erro de força entra antes
    do teto) — de longe a busca pedia até 45 m/s e a bola saía a até ~70 m/s (contraprova 13/10, teste-cavadinha K); com
    o teto o balão de longe cai antes do gol. A automática da IA (até `distMax`) não passa por isso (fica como era).
  - O cobrador parado (`papel 'parado'`) com `espera` nunca é marcado por `processarPedido` (chuta pela cobrança).
  - A cobrança da demo (`entradaDemoPartida` com o controlado cobrando) leva `iaCobra: true` (sem `ia`, para o resto
    da simulação seguir igual — `m.iaJoga`): o `cobrar` e o sim.js não a tomam como da pessoa. A entrada da cobrança da
    IA repete o botão a cada `PARTIDA.repeteCobranca`; sem a marca, o 2º aperto virava cavadinha (teste-cavadinha J; o
    canhão de pênaltis do teste-faltas caía de ~77% para 67% de gols). Na PÁGINA (`?demo=1`), `main.js entradaDoTime`
    entrega a entrada da demo sem o `ia` (como sempre), mas com a marca `iaCobra` (= `ia || iaCobra`), também no
    `rodarPassos(n, 'demo')` da API e nos achadores `comoPagina` (`tools/lib/acha-gol.mjs`, `acha-impedimento.mjs`): a
    demo da página é a IA de antes (contraprova 13/10: sem a marca, 9 cavadinhas em 40 pênaltis da demo; teste-controles).
  - **Bola parada**: o CHUTE só cobra pênalti e tiro livre direto (`cobrar` descarta o pedido de chute nas outras) —
    no escanteio, lateral, tiro de meta e tiro livre indireto, dois toques no CHUTE não fazem nada e o PASSE/LANÇAMENTO
    depois cobra normal (teste-cavadinha H3). Pênalti: dois toques = **Panenka** (`pedido.penalti` + `cavadinha`;
    `ACOES.cavadinha.penalti`): SEM a pressão do pênalti (`penaltiErro` não entra), erro próprio de força/direção
    (`erroForca`/`erroDir`, bem menor que o da cavadinha de jogo: bola parada a 11 m, sem marcador), elevação de
    `elevPedida[0]` (2º toque rápido) até `elevMax` (segurado; mais em pé, 1% de força mudava 0,3 m na altura em que a bola
    chega ao goleiro) e a velocidade que passa 0,4 m antes da linha a `y` m, descendo (`velParaAlturaEm`, como o chute).
    A busca de "cair `alemDaLinha` m depois da linha" (`velParaPousar`) não serve no pênalti: com o gol no caminho o pouso
    não cresce com a velocidade (a bola bate no travessão ou no teto da rede e volta) e a busca parava no travessão — sem
    erro nenhum, a Panenka passava a ~2,8 m na linha. O goleiro: contrato do pênalti (Etapa 4, faltas). Medido
    (teste-cavadinha H4, 48 sementes, finalização 40/60/83, 2º toque rápido e segurado): contra o goleiro que mergulha
    97% de gols e 97% no alvo (antes 22% e 29%); contra o que fica no meio, 100% defendidas (antes 6%; 11 gols e 34 fora
    em 48). A cavadinha de jogo, a da IA e a do tiro livre não mudam. Tiro livre direto
    (~22 m, barreira): dois toques = cavadinha por cima da barreira (× `faltaErro`; 0/10 na barreira, quase todas fora).
  - **Entrada** (`entrada.js`, DOM): soltar e apertar de novo ANTES de um passo ver a soltura (teclado, toque e controle
    num quadro sem passo) não perde a 2ª borda — o passo vê o botão solto e o seguinte, apertado (`soltas`, `vistos`
    pelo `passoUsou(botoes)` que o main.js chama ANTES de cada passo, `adiados` viram o pulso do próximo em
    `limparPulsos(true)`; fora do laço, `limparPulsos()` limpa tudo, também `vistos` — o replay que começa dentro do
    passo, no apito do impedimento ou na saída depois do gol, chama `limparPulsos()` depois do `passoUsou`: sem passo
    nenhum no replay, a tecla segurada no começo, solta e apertada de novo, pula, como na main; antes ela ficava
    escondida o replay inteiro — contraprova 13/10, teste-controles). Não vale para CORRER e o modificador (dois Shift
    seguros não piscam). A repetição automática da tecla (`keydown` com `repeat`) não conta. O toque cancelado pelo
    sistema (`pointercancel`, `lostpointercapture`) no CHUTE é soltar, como sempre foi (teste-controles).
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
  j)` (grava `m.pedidoPressao[time] = tick`); `pressaoPedida(m, time)` (até `pressao.validade` s depois do último passo com
  o botão, só com o time defendendo e sem bola do time depois do pedido — `m.possePorTime`; `encerrarPressao(m, time)` na
  retomada); `pressionadorDe(m, time)` → id do companheiro
  que aperta (uma vez por tick, em `m.pressaoHumano[time] = {tick, id}`; −1 = ninguém); `entradaPressao(m, j)` → a
  entrada de referência de quem aperta, ou null (a IA tática decide usar). **`iaClassica` desliga tudo isto.**
- **`troca.js`**: `trocaAerea(m)` (troca por `assumirControle`, evento `trocaAerea {id}`), `alvoAereo(m, j, e)` → entrada
  ou null. **`iaClassica` desliga** (o "antes" dos testes não troca nem ajuda); também não age com a partida em
  `'gol'`, `'intervalo'` ou `'fim'`.
- **`entrada.js`** (DOM): `ACOES_TECLA`, `TECLA_BIT`, `SENTIDO_FASE` (botão físico → `[bit no ataque, bit na defesa]`:
  J/A = PASSE/CONTER, K/B = CHUTE/DIVIDIDA, O/RB = PEGAR/PRESSÃO, Y = ENFIADA/GOLEIRO), `criarSentidoFixo(tabela?, rele?)` →
  `{bit(id, apertado, fase), atual(id), soltarTudo()}` (puro: o sentido fica fixo do aperto até soltar, mesmo se a posse
  mudar; só os de `rele` — `RELE_NA_DEFESA`, O e RB: o PEGAR é um toque, segurado não faz nada — presos no sentido do
  ataque passam ao da defesa quando a fase vira defesa; o contrário nunca),
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
- **`m.pedidoPressao[time]`** = tick do último PRESSÃO segurado pelo humano daquele time (null depois da retomada:
  `defesa.js encerrarPressao`; o pedido só vale com `m.possePorTime[time]` ≤ ele — o time sem a bola desde o pedido).
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
  Com a bola morta (partida: `m.parada` ainda sem cobrar — o impedimento ou a falta apitados com o chute no ar; Regra 9.2)
  `aplicarDefesa` não defende nem dá a bola a ninguém (`d.fora`; o mergulho desenhado segue).
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
  livre direto); `pedido.penalti` multiplica o erro (`ACOES.chute.penaltiErro`; a Panenka não: erro próprio,
  `ACOES.cavadinha.penalti`). `goleiro.js lerChute`: no pênalti, lado errado = não defende (o mergulho desenhado vai para
  o lado escolhido); lado certo = chance × `GOLEIRO.penalti.fator`. **Panenka** (`m.voo.tipo === 'cavadinha'` no pênalti,
  ~1,3–1,6 s até o goleiro): contra quem escolheu um lado (`palpite` ±2,2) e a bola a mais de `GOLEIRO.penalti.meio` m
  dele = lado errado — o mergulho desenhado sai para o lado escolhido com o pico `GOLEIRO.penalti.picoPanenka` s depois
  do chute e ele fica deitado até a bola passar a linha (`defesa.chaoAte` → `mergulho.tChao`); contra quem ficou no
  meio (`palpite` 0): sem sorteio — pega (encaixa) a que alcança, e a que passa alta por cima dele busca voltando para a
  linha (`recuoBolaAlta`, como o goleiro adiantado). Só a Panenka: o chute do pênalti (IA e humano) fica como era
  (teste-faltas C igual; hash-partida igual).
- Escalação: `situacao` → 'expulso'; `tocar` troca o buraco com um titular (nunca o gol) e recusa substituí-lo;
  `mudarFormacao` deixa o buraco nas vagas que sobram (fora do gol); `validarEdicao` aceita o expulso só como buraco e
  fora do gol; `misturarTimes` inclui os expulsos.
- Desenho/HUD: `#cartao-icone` em cima de quem levou (`hud.cartao`, `FALTAS.icone` s; sem texto); apito nos eventos
  `apito` e `impedimento`; corte de câmera em `cobrancaPenalti`; editor: carta `.expulso` com o cartão vermelho.
  API de testes: `__golaco.faltaDeTeste({area, cartao, doMeu})`.
- Testes: `teste-faltas` (padrão): cenas, vantagem e volta, pênalti montado, 2º amarelo/expulsão/editor, goleiro
  expulso, canhão de 400 pênaltis, 12 partidas.
- **Faltas com sentido** (pedido do dono, 15/10: "faltas muito forçadas e sem sentido"; `PESQUISA-ETAPA4.md` §3b):
  `forcaContato(m, d, c)` = a velocidade com que o defensor ENTRA no condutor, limitada pela aproximação dos dois
  (min(v_d · n, (v_d − v_c) · n)⁺) ou a guardada no choque dos corpos (`guardarChoque`, chamada em `sim.js colisaoCorpos`
  antes da resposta, só na partida; `j.choque {id, tick, f}`: a maior dos últimos `FALTAS.forca.janela` s); 0 a mais de
  `FALTAS.forca.alcance` m entre os centros (corpo + perna até a bola + o pé dele: não há contato). O bote da IA
  (`faltaNoBote`) vira falta com a chance de antes × `fatorForca(f)` (0 até `FALTAS.forca.min` — o passo, contato
  incidental —, rampa até `cheia`, × (1 + `porForca` · (f − min)) acima — `porForca` 1,0 desde a junção com a main
  (#471): 0,5 deixava as 12 partidas IA × IA do teste-faltas em 1,42 falta por partida (meta 1,5–5) —; × `bote.naArea` na própria área e
  × `bote.naChanceClara` na chance clara de gol — ali o defensor evita entrar no homem, como na carga; teto 0,95): o desarme
  sem entrar no homem não é falta, mas também não ganha sempre: com o condutor abaixo de `bote.semCorpoV` m/s (na corrida
  a bola vai à frente do pé e quem chega antes leva) e fora do condutor parado/lento, com a chance de antes ×
  `bote.semCorpo` × (1 − fatorForca) ele devolve `BOTE_SEM_GANHAR` (sim.js boteIA: o condutor segura o contato e segue, o
  defensor descansa, evento `boteErrado`) — sem isso a falta "do nada" virava roubada limpa (+0,7 roubada por partida no
  painel da junção #480 + #481, o ataque perdia volume; teste-faltas-sentido A14); o resto é limpo (a IA leva a bola).
  Evitar é tirar o corpo: o sorteio que seria falta fora da área e o
  cuidado descarta devolve `BOTE_EVITADO` (sim.js boteIA: sem bote, descansa) — a fração de botes limpos com o mesmo
  contato é igual dentro e fora da área (contraprova de 15/10: dentro da área o bote forte virava roubada limpa). A
  DIVIDIDA da pessoa usa a mesma régua (`chanceFaltaDividida(m, d, c, motivo)` = min(0,95, chanceFaltaBote × fatorForca) ×
  `dividida[motivo]`, sem o cuidado da área). A carga (`faltaNaCarga`) exige `forcaContato ≥ carga.vMin` (o condutor que recua para dentro
  de quem estava atrás não é carga dele) e não vale para quem tocou na bola há menos de `carga.perdeu` s (o embalo de quem
  acabou de perder a bola no bote); nas costas a ≥ `carga.temeraria` m/s é temerária (amarelo; Regra 12.1). Segurar
  (`faltaTatica`): o marcador batido colado por trás segura — no ataque promissor `tatica.chancePorPasso` por passo
  (origem 'tatica', amarelo: SPA), fora dele `tatica.semSPA` (origem 'segurar', o cartão pela regra geral) só com o
  condutor escapando dele (se afastando a ≥ `tatica.escapa` m/s, ele sem ganhar terreno: aproximação ≤ `tatica.ganhando`)
  e nunca na própria área.
  `defesa.js semAtropelar(m, j, mv)` (sim.js, só na partida, só no time jogado por uma pessoa — `m.humanos` sem
  `m.iaJoga`; o controlado, os companheiros da IA e o chamado da PRESSÃO a ≤ `pressao.chega` m): a velocidade pedida
  para dentro do condutor adversário (ou do recebedor do passe dele) fica ≤ (a dele se afastando − `reacao` ·
  `JOGADOR.freioGiro` · (1 − folga/`perto`)⁺)⁺ + √(chega² + 2 · freio · folga) (`DEFESA_HUMANO.semAtropelar`: quem vem
  atrás guarda a folga para a freada do condutor no tempo de reação, só perto); a de lado fica; a DIVIDIDA saindo não muda. A demo e o time da IA não mudam.
  Teste: `teste-faltas-sentido` (padrão; registro de toda falta com o contexto em `tools/lib/faltas-registro.mjs`; o
  árbitro do teste mede a força do contato com os corpos encostando ou a ≤ 1,2 m, antes ou depois da locomoção do passo).

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
- **`index.html`/`css/estilo.css`**: o placar é a barra de TV da seção "Placar (12/10)" abaixo (antes: compacto de 30 px
  no celular e 34 no PC, sem a marca) e o "1º T" só aparece com
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
- (condução curta, 12/10) a regra da bola colada lê `ACOES.boteIA.colada` (0,305: o 0,35 de antes × 0,87, a razão da
  bola–condutor da IA no trote, 0,67 → 0,58 m; também `boteIA.bolaSolta` 0,7 → 0,61, `DEFESA_HUMANO.pressao.bolaSolta`
  0,5 → 0,435 e `dividida.soltaIni/soltaFaixa` 0,45/0,5 → 0,39/0,435) e não vale com a bola **encostada** no corpo do
  marcador (`boteIA.encostada`, 0,42 m do centro dele) e os dois andando juntos (velocidade relativa ≤ `encostadaVrel`,
  1 m/s): o condutor empurrando a bola no marcador colado à frente — só com o marcador à frente ou de lado
  (`faltas.js chegada` ≠ 'tras'; nas costas do condutor o bote era quase sempre falta, 14/10). Vale também no treino (o
  hash do ataque muda).

### PRESSÃO (`defesa.js`; o desenho em `render/jogador3d.js`)
- `pressionadorDe(m, time, excluir = -1)` → id de quem chega primeiro ao ponto de encontro (a `pressao.colado` m do corpo
  do condutor, do lado do gol, adiantado pela corrida dele até `leadMax` s; tempo pelo perfil de aceleração do corpo,
  `tempoChegada`: x(t) = vA·t − (vA − v0)/k·(1 − e^(−k·t)), k = acel0/vTeto, v0 = a velocidade que ele já tem na direção do
  ponto, e quem corre para o outro lado antes freia na linha até parar com `freioGiro`; quem já ia leva
  `histerese` s — só se o ponto não pede a inversão dele, além de `JOGADOR.angInversao` do sentido da corrida: no passe
  do adversário, quem teria de frear na linha até parar cede para quem chega primeiro), sem o controlado, o goleiro e
  `excluir` (nunca exclui quem já ia). Uma vez por tick em `m.pressaoHumano[time] = {tick, id}`.
- `pressionadorVisivel(m, time)` → id do chamado no último passo, ou −1 (pura; `main.js` passa `pressiona` na lista do
  desenho: setas âmbar acima da cabeça, `indicador-pressao`).
- **Validade do pedido** (D1, 23/10; pedido do dono: "preciso do botão de pressão funcionando"): `pressaoPedida(m, time)`
  vale até `pressao.validade` s (1 s) depois do último passo com o botão — um toque curto chama alguém por ~1 s (antes
  valia 1 PASSO: o chamado dava uns passos e voltava ao bloco) — e só com o time DEFENDENDO (`defende`: a partida em
  'jogo' e a bola não é dele — nem no pé, nem nas mãos, nem num voo dele; no intervalo/fim o passo não grava o botão e o
  pedido ficava "valendo" sem ninguém chamado). A retomada encerra o pedido (o toque de antes não volta a valer se a bola
  se perde de novo; segurado, o próximo passo grava de novo): `pressaoPedida` exige `m.possePorTime[time]` (o último tick
  com a bola do time no começo do passo, no pé ou nas mãos) ≤ o pedido — qualquer retomada, também o encaixe e o PEGAR do
  goleiro, que não passam por `sim.js ganhouPosse` (contraprova de 24/10: o toque voltava na reposição cortada dentro de
  1 s, 9 de 9; `teste-pressao-humano` M12) — e `ganhouPosse` chama `encerrarPressao(m, j.time)` (a bola ganha e perdida
  no mesmo passo). A vantagem de quem já vai é `histerese` 0,5 s com o condutor e `histeresePasse` 1,0 s no passe do adversário
  (era 0,3 nos dois: a marca pulava de jogador 1,30 vez em 3 s segurado, ~85% num passe da IA; teste-pressao-humano M11).
- **C1, LIGADA** (`pressao.controlado` true; dono, 24/10: "meu jogador aperta também" — como o botão Pressão do FC Mobile; no console o RB não mexe no seu jogador):
  `entradaPressaoPropria(m, j)` — com o PRESSÃO segurado e o analógico a ≤ `pressao.soltoMax`, o PRÓPRIO controlado
  também aperta pela mesma perseguição do chamado (`perseguirCondutor`/`corridaAoPasse`, estado em `j.pressaoP`/
  `j.pressaoPS`; não conta como chamado: `chamadoRecente` não vale para ele). Só com o botão: a demo fica igual.
- `entradaPressao(m, j)`: bola solta do pé do condutor (> `bolaSolta` m) e eu mais perto → vou na bola; a mais de
  `chega` m → disparada (analógico cheio + CORRER) ao ponto de encontro, contornando o condutor a `contorno` m se venho
  por trás (do lado do gol dele ou nas costas dele pela corrida dele, `faltas.js chegada`); perto → pela velocidade (a do
  condutor + `ganho` × (ponto − corpo), até `aproxMax` m/s a mais; por trás, fechando no máximo `trasAprox` m/s pela
  velocidade de AGORA do condutor), mirando `naBola` m antes da bola, do lado do gol. No passe do adversário corre para
  `colado` m do ponto de chegada (o mesmo ponto em que `pressionadorDe` mede quem chega primeiro). Estado
  `j.pressaoH = {corre, tick}` (`tick`: o último passo em que ele foi o chamado).
  Em todos os trechos a disparada **desvia dos outros corpos** (`desvio`: a aproximação máxima prevista em `desvio.T` s;
  passa a ≥ 2 raios + `desvio.folga` m) e **chega freando** (`chegaFreando`, "chegada rápida, freada no fim"): a
  velocidade PEDIDA com que fecha no corpo do adversário (também o recebedor `voo.para`) fica na curva
  √(c² + 2 · a · folga) − margem, a = `freioChegada` × o freio do corpo, c = `contato` (abaixo de `FALTAS.forca.min`); com o
  condutor vindo, além de dEng = 2 raios + (vCorrida² − contato²)/(2a) (onde quem chega correndo tem de começar a frear)
  a curva vale para a velocidade DELE (+ a do condutor vindo: segue em disparada) e, dentro, no referencial do condutor
  (c + a do condutor vindo); a margem é a da freada do condutor que se afasta (`semAtropelar.reacao/perto`); com o corpo
  já acima da curva, o pedido fica abaixo dela pelo excesso (o corpo segue o pedido com o atraso de `JOGADOR.tauVel` e a
  aceleração de lado limitada: correndo ao lado de um condutor rápido ele trombava nas costas dele).
- `chamadoRecente(m, j)` → j é (ou foi há até `depois` s) o chamado (pelo `j.pressaoH.tick`; só existe com o PRESSÃO
  apertado). `sim.js boteIA`: o chamado não faz falta tática (`faltaTatica`: parar o contra-ataque com falta é da pessoa,
  pela DIVIDIDA) e o bote dele passa por `boteContidoDoChamado(m, j, dono)` → 'embalado' (FECHANDO no condutor a mais de
  `FALTAS.bote.vLivre` m/s pela conta do `faltas.js forcaContato`: a MENOR entre a parte da velocidade dele e a da relativa
  na direção do corpo do condutor — D1: pela velocidade absoluta, o chamado que corria junto do condutor nunca tentava; só
  pela relativa, o condutor vindo para cima do chamado parado contava como embalo dele, com a falta impossível), 'tras'
  (nas costas dele, `faltas.js chegada`), 'corpo' (`faltas.js forcaContato` > `FALTAS.forca.min`, inclusive o choque
  recente) ou null (tenta).
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
  goleiro do humano com a bola no pé e a mão valendo). API de testes: `__golaco.cenaDeTeste('pressao' | 'goleiroMao' |
  'goleiroPe' | 'goleiroPeRecuo')` e
  `__golaco.indicadores` (`{pressao: {x, y, z} | null, oito: {x, z, segmentos, total} | null}`).

### Testes
`teste-parado`, `teste-pressao-humano` (pareado, `tools/lib/pressao-pareada.mjs`; 32 partidas, uma por processo — com 8 a
mesma lógica passava ou reprovava pelo sorteio dos lances; nas 128 partidas da main o M4 ficava acima da meta, 1,58× as
faltas, e o M5 no limite, 80,6% — o chamado fazia falta demais e corria de menos; corrigido com a chegada pelo perfil de
aceleração, a curva de chegada, o desvio e o bote sem entrar no corpo: `PESQUISA-ETAPA3.md` §17.3) e `teste-goleiro-regras`
no padrão;
`teste-defesa-humano` (a meta antiga do PRESSÃO, que passava sem o botão, virou a pareada); `teste-controles` (celular:
a marca do PRESSÃO, o PEGAR, o goleiro andando com a bola e o anel); `teste-goleiro-trava` segue medindo o treino;
`teste-entrada` (O/RB no ataque = PEGAR; preso como PEGAR, vira PRESSÃO quando a fase vira defesa); `teste-taticas` mede a
forma com `IA_DEFESA.lento` desligado (a cena prende a bola parada no pé do condutor). D1 (23/10): o `teste-pressao-humano`
mede também TODAS as posses em ramos de 3 s com o humano parado (`pressao-pareada.mjs` `tres`): M9 (botão 1 s: ganhar a
bola em 3 s ≥ +6 pontos sobre o sem botão), M10 (bola ao alcance do chamado, fora das costas e do corpo entrando: o bote
liberado em ≥ 90% dos passos), M11 (trocas do chamado em 3 s segurado ≤ 0,8) e M12 (a retomada pela mão do goleiro
encerra o pedido: o toque de antes não volta na reposição cortada); o `teste-controles` confere o O segurado de antes do
domínio do adversário (PEGAR → PRESSÃO, com a marca) e o `teste-replay` C7, o O segurado como PEGAR no apito do
impedimento do meu time: o rele a PRESSÃO no quadro seguinte não é aperto novo (`main.js iniciarReplay` trata o PEGAR
segurado como PRESSÃO segurado; antes o replay sumia sozinho).

### Equilíbrio (painel de 144 partidas, mesmas sementes da base)
`GOLEIRO.logit.c0Partida` (−0,1): `goleiro.js chanceDefesa(..., partida)` soma no logit só na partida (o treino não
muda). Sem ele as defesas de 6 a 16,5 m iam a 60,8% (meta 55–60%): as regras tiraram gols fáceis nessa faixa (177 → 164
com as mesmas defesas). Com ele: 59,0% · total 68,0% · de fora da área 86,8% · gols 2,13 (base 2,13) · impedimentos 1,15
· bola parada 29% dos gols — nenhuma medida que estava na meta saiu dela.

## Cabeceio na bola rolando e IA intensa com responsabilidade (12/10, contrato)

Pedidos do dono de 11/10: "os jogadores não cabeceiam a bola, de jeito nenhum" e "o jogo tem que ser mais intenso, ninguém
do outro time corre, ninguém marca, mas tem que marcar com responsabilidade e consciência". Pesquisa em
`PESQUISA-ETAPA4.md` §6. O treino muda só onde há bola alta (o pulo vale em todo modo); a IA intensa e a disputa no jogo
corrido só na partida.

### O pulo do cabeceio (`cabeceio.js`, puro)
- Estado `j.cab = {tA, td, tc, tp, tf, h, bx, by, bz, cx, cz, vx, vz, saiu, x0, z0, lx, lz, cabeceio}` (criado em
  `jogador.js` como `undefined`, junto com `disputaAlta`, `disputa`, `perdeuAlto`): contramovimento `tA..td` (pés no chão),
  sai do chão em `td`, contato em `tc` (no alto do pulo), pousa em `tp`, amortece até `tf`; `h` = quanto o quadril sobe
  (0 = cabeceia sem pular, só o tronco); `(bx, by, bz)` a bola no contato (a física do jogo, `conducao.js preverBola`);
  `(cx, cz)` onde o corpo vai para a testa encontrar a bola; `cabeceio = false` no pulo de quem só disputa.
- `alturaPulo(j)` (impulsão → `CABECEIO.salto`), `alcanceCabeceio(j)` (de pé + pulo + tronco + encosto),
  `inclinacaoAte(px, py, pz, bx, by, bz, out)` (ângulo do tronco para a cabeça ir à bola), `subidaPara(y, L)`,
  `preparoPulo(h)` (s do pedido ao contato), `planejarPulo(m, j, tc, bx, by, bz, ux, uz, nx, nz, folgaAlc)` → `j.cab` ou
  null (não alcança), `puloAtivo(j, t)`, `noAr(j, t)`, `quadroPulo(c, t, out)` → `{off, w, arco, braco}` (o que a pose lê),
  `sairDoChao(m, j)` (em `td`: velocidade de saída para o ponto, no máximo `vSaida`; longe demais do ponto, cancela),
  `passoCorpoNoAr(m, j)` (balístico), `pesNoAr(m, j)` (os pés saem de onde estavam e pousam parados em `lx/lz`; o pé que
  saiu no meio do balanço parte da altura que tinha, `cab.y0[p]` acima do tornozelo no chão, e essa sobra some até o pouso —
  15/10, `teste-cabeceio` F4: antes ele caía ~7 cm no 1º passo do voo),
  `intencaoCabeceio(m, j, y)` → `{tipo: 'chute' | 'lancamento' | 'passe', forca, auto: true}` (a gol na área adversária a até
  `CABECEIO.gol` m, afastar no meu terço, passe no resto; null para passe com a bola na altura do peito).
- `anim.js`: a pose lê `j.cab` (função pura do estado): o quadril no pulo (`hyPulo`), o tronco inclinado para a bola com o
  arco da subida e o chicote do contato, os braços subindo; `alturaQuadril` devolve o do pulo.

### Simulação (`sim.js`)
- Ordem no passo: no movimento, `sairDoChao` em `td` e, voando (`td < t ≤ tp`), `passoCorpoNoAr` no lugar da locomoção;
  na passada, `pesNoAr` no lugar de `passoPassada`; `passoPeDesenhado` pulado no ar; na bola livre quem está no ar não
  domina.
- Bola morta e teleporte (contraprova de 14/10): na partida, `pontoDeCabeceio` para no 1º ponto em que a bola já saiu
  INTEIRA do campo (`bolaForaEm`, Regra 9) e nenhum cabeceio é planejado para ele; com a parada ainda sem cobrar
  (`naParada`) o pulo que não saiu do chão e a disputa marcada são cancelados (quem já está no ar termina o pulo);
  `partida.js teleportar` zera `j.cab` e `j.disputaAlta` (antes os pés ficavam no ponto de pouso velho, a até 15 m do
  corpo). Teste: `teste-cabeceio` F. A cena da comemoração (`comemoracao.js`) copia `j.cab` de quem
  já saiu do chão e termina o pulo (`passoCorpoNoAr`/`pesNoAr`, como o `sim.js`); o pulo que ainda não saiu do chão não
  sai (teste-comemoracao 14).
- `bolaAltaNoCorpo`: o toque aéreo marcado (`c.toque.tipo = 'aereo'`) vira cabeceio só com o pulo planejado para o tick
  (`j.cab.tc === m.tick`) e a cabeça DESENHADA na bola (`cabecaNaBola`: pose do tick, superfícies a até `CABECEIO.folga`);
  senão o peito/coxa (bola até `alturaPeito[1] + 0,15`). Marcação: `pontoDeCabeceio(m, j, querCabeca, raioMax)` — o 1º
  ponto da trajetória que ele alcança a tempo de pular (correr + `preparoPulo`), preferindo a bola `conforto` m abaixo do
  alcance; só vai antes à bola com botão, adversário a até `disputaPerto` m ou intenção ≠ passe; o controlado com o
  analógico mexido só cabeceia a bola que passa nele; na bola parada quem defende só na zona (`AEREO.zonaBolaParada`).
- Disputa no jogo corrido (partida, fora da bola parada): `agendarDisputa(m, j, cab)` escolhe o adversário de linha mais
  rápido que chega a até `AEREO.vai` m do ponto antes da saída e planeja o pulo dele ombro com ombro (`CABECEIO.ombro` de
  lado, `recua` antes; `j.disputaAlta = {tc, x, z, contra}`; `movimentoAereo` o leva até lá). No contato, `rivalNoAlto`
  (jogo corrido: quem pulou com a cabeça desenhada a até `AEREO.folgaRival` da bola; bola parada: a regra da Etapa 4) e
  `ganhaDisputa` (nota no alto; jogo corrido: `iniciativa` + `kDist` × diferença de distância à bola + `ladoGolRolando`
  perto do gol; bola parada: `ladoGol` + `ataqueBolaParada` para quem ataca). O rival ganha de raspão (`raspao`: desvia,
  perde força) se a cabeça dele não estava na bola. Evento `disputaAerea {id (quem ganhou), perdeu, dono, bolaParada,
  alcancou, p}`; o cabeceio sai como `passe` com `modo: 'cabeceio'` e `m.voo.cabeceio` = o tipo ('chute', 'lancamento',
  'passe').
- `acoes.js executarCabeceio`: a gol mira baixo na linha (`CABECEIO.yGol`, `elevacaoParaAltura`) a `zGol` m do meio, do lado
  longe do goleiro (ou o analógico), com o erro `ACOES.cabeceio.erroGol` (bola parada e rolando; × `AEREO.erroDisputa` em
  disputa); afastar sem botão (`p.auto`): para longe do meu gol e para o lado da bola (`vAfasta`, `elAfasta`, `ladoAfasta`).
  `finalizarChute` só põe a bola rolando no chão com ela rolando ou na altura do pé (antes o cabeceio a gol era
  teletransportado para o chão).
- `goleiro.js`: `chanceDefesa(..., partida, tVoo)` soma `logit.cTempo` × (tVoo − dChute / vRef) na partida (bola lenta dá
  tempo); `pontoDoCruzamento` — cruzamento/lançamento do adversário no ar: a bissetriz é a do ponto onde a bola desce a
  `GOLEIRO.leCruzamento.y` m (a até `dist` m do gol, nos próximos `ticks`), não a da bola no ar.

### IA intensa com responsabilidade (`ia-tatica.js`, `sim.js boteIA`; constantes `IA_DEFESA.corrida`, `saltoPressa`)
- `blocoDoTime`: `B.rapido` — condutor adversário de linha a mais de `corrida.v` m/s (o corpo dele, agora) vindo para o meu
  gol (≥ metade da velocidade nessa direção); desliga pela velocidade filtrada abaixo de `v − hist`. Com ele: quem ficou
  mais de `batido` m atrás do condutor paga `batidoPaga` m para ser o 1º homem (havendo alguém do lado do gol a até
  `batidoFrente` m).
- `semBola`: com `B.rapido` o 1º homem sai do bloco também além da linha de engajamento e `acompanhar(..., 'contem' |
  'aperta')`; o 2º `acompanhar(..., 'cobre')`; o resto do corredor (`acompanhaCorredor`: do lado do gol, a até `raio` m e
  `corredor` m de lado) segue o ponto calmo no ritmo `fBloco` × v; a recomposição liga com `liga` m de atraso.
- `acompanhar`: velocidade = a do condutor (a do corpo) + `ganho` × (ponto − corpo) → `defesa.js entradaVelocidade`
  (exportada). Ponto: contém a `dist[0] + dist[1]·v` m (entre `dist[2]` e `dist[3]`) na linha condutor → gol, encolhendo
  até `aperto` m entre `engaja[1]` e `engaja[0]` m do gol; `cobre` atrás e por dentro; com a bola mais perto dele que do pé
  do condutor (`atacaBola`), a bola — sem parar de correr. Do lado do gol e a menos de `recua[0]` m, nunca sobe
  (velocidade para o gol ≥ a do condutor − `recua[1]`). Estado `j.iaT.acomp = {corre}`.
- `alvoPressa`: trocando de papel o filtro só recomeça com o ponto novo a mais de `IA_DEFESA.saltoPressa` m.
- Quem está no caminho do condutor rápido (`noCaminho`: do lado do gol, a menos de `corrida.recua[0]` m e a até
  `corrida.caminho` m da linha condutor → gol) recua junto, `acompanhar(..., 'cobre')`; a contrapressão com o condutor
  rápido também acompanha (`'aperta'`).
- Interceptação (pedido de 12/10, "a defesa mal intercepta passe"): `pontoMarcacao(m, B, a, meuGol, p, out)` — quem marca
  o adversário `a` (individual, `B.marcaAdv`, ou na zona, `B.zonaAdv`) fica `marcaDist` m do lado do meu gol dele e, com o
  condutor deles a até `linhaDePasse.alcance` m (e a mais de `sombraMin`), puxado `linhaDePasse.sombra[pressão]` para o
  ponto a `sombraDist` m de `a` na linha de passe do condutor para ele.
- Corte do passe (`ia-tatica.js cortaPasse`, só na partida): no passe do adversário com destino, vai cortar quem do time
  chega a um ponto da TRAJETÓRIA (`conducao.js preverBola`, rasteira ou até `livre.alturaMax` m, `livre.horizonte` ticks)
  com `livre.le` s de leitura, `livre.antes` s antes de o recebedor chegar a ela (a mesma conta, sem leitura). Tempo de
  chegada (`tempoCorte`): da velocidade que já leva na direção do ponto, a `livre.acel` m/s² até a arrancada, o pé a 0,5 m.
  Só o primeiro do time (6 ticks de vantagem para quem já ia); decidido, segue até a bola passar (`j.iaT.corte = {chave:
  voo.tickChave, x, z, ate}`, `livre.segue` ticks de folga), direto ao ponto em disparada, sem o filtro da pressa (ramo
  `'corta'`). `cortandoPasse(m, j)` (exportada) diz se j está cortando o passe no ar.
- `sim.js bolaLivre` (partida, passe rasteiro com destino): o candidato que só MARCOU o domínio (o recebedor esperando) não
  encerra mais a vez — seguem os adversários do passador que estão cortando (`cortandoPasse`) ou controlados pelo humano
  (sem a IA jogando por ele), e o goleiro adversário; os companheiros do passador só com a bola lenta no pé
  (`bolaLentaNoPe`, a regra do "passe lento não é só do recebedor" acima). Antes o recebedor com o toque
  marcado encerrava a vez de todos e o defensor no caminho só cortava com a bola batendo no corpo.
- `sim.js boteIA` (partida): com o condutor a mais de `ACOES.boteIA.vLado` m/s a bola tirada sai para o lado do defensor e
  `tras` para trás no caminho do condutor; o condutor fica sem dominar até `semDominioAte` (a regra da DIVIDIDA). O
  escolhido da PRESSÃO do humano (ramo `'pressaoHumano'`) não dá o bote embalado nem por trás (a regra da main, #474;
  a IA × IA não usa a PRESSÃO: o painel não muda com isso).
- Falta no bote (`faltas.js faltaNoBote`, 14/10): de frente, com o defensor sem entrar no condutor (a velocidade dele na
  direção do condutor ≤ 0: corre para o próprio gol ou fica) e a bola já solta do pé do condutor (≥ `ACOES.boteIA.bolaSolta`),
  ele joga a bola antes do homem. Era o desarme da defesa da arrancada contra o condutor em disparada que empurra a bola
  0,6–0,8 m (50 das 67 faltas da IA no humano no teste-defesa-corrida eram botes de frente, quase todos assim). Na junção
  com as faltas com sentido (15/10) o × `FALTAS.bote.naBola` saiu: a força do contato (`forcaContato` × `fatorForca`) já dá
  chance zero a quem não entra no condutor (a velocidade dele na direção do condutor ≤ 0) — uma régua só para o bote.
- Calibração (painel de 48, 13/10): `IA_DEFESA.corrida.v` 6,8 (só a disparada de verdade liga a defesa da arrancada),
  `GOLEIRO.logit.c0Partida` −0,35, `IA_ATAQUE.contra` {s: 8, bonus: 1,0}, `utilidade.chute` 3,0.
- Volume de ataque (rodada de 13/10, painel de 144 do CI): **tabela da IA** (`ia-ataque.js tabelaIA`, `IA_ATAQUE.tabela`; DESLIGADA
  — `tabela: null` — em 14/10: ~17 tabelas por partida e só ~3,6 devoluções para quem correu; sem ela os chutes sobem de 7,2
  para 8,1 em 48 partidas e voltam a passar o teste-pressao-humano M3/M4 e o teste-botoes B14b):
  o passe de `dMin`–`dMax` m (no máximo `tras` m para trás), do campo a partir de `uMin` m, com `livre` m livres à frente
  do passador e no máximo `max` tabelas correndo no time, sai com o modificador (acoes.js `tabela`: o passador arranca
  para o espaço); quem recebe vê a devolução como enfiada (a corrida `'tabela'` vale como a `'nasCostas'`); a tabela
  acaba com a bola perdida; nunca na cobrança. **Condutor no último terço** (`manter`, `utilidade.manterTerco` {u, peso,
  lado}): a partir de `u` m o peso dos marcadores no caminho é menor — ele encara e entra na área (no campo todo isso
  levava o condutor para cima da PRESSÃO do humano). Vale ~0,4 chute por partida no painel de 144 (7,3 com ele, 6,9 sem,
  14/10) e faz o chamado da PRESSÃO correr menos (teste-pressao-humano M5 72%, meta 80% — PENDENTE: o condutor que encara
  para perto do marcador e as aproximações do chamado ficam curtas, quase só a aceleração). `utilidade.cruzamentoV` 0,35 e `chuteLonge` 0,25;
  `IA_DEFESA.corrida.v` 7,0; `GOLEIRO.logit.c0Partida` −0,3 e, de longe, `cLongePartida` −0,035 por m de chute além de
  `dLonge` 15 m do goleiro (15/10: gols de fora da área); o pênalti com o próprio `GOLEIRO.penalti.c0Partida` −0,1 (a
  calibração dele, canhão 77/18/5% e teste-botoes B6d, é a da main; com o −0,3 da bola rolando as defesas de pênalti iam a
  0% no painel de 144).
- O arremesso do lateral (`m.voo.tipo === 'lateral'`) não entra no corte do passe (`vaiNaLivre`), e o lateral do meu time
  não se afasta de cabeça no meu terço (`cabeceio.js intencaoCabeceio`).
- Troca aérea (`troca.js`): quem tem `j.disputaAlta` pendente (o pulo ombro com ombro contra o cabeceio do adversário)
  conta como disputante marcado (até `janelaMarcado` s); no empate — a previsão confirmada põe o controlado na bola até
  `antecede` ticks depois do toque marcado de outro companheiro que não o recebedor — o controle fica com ele.
- PRESSÃO do humano (`DEFESA_HUMANO.pressao`): `chega` 2,0 m e `aproxMax` 5 m/s (o bote do escolhido só abaixo de
  `FALTAS.bote.vLivre` e não por trás: a regra do sim.js boteIA que veio da main, #474). Na aproximação vale a
  `corridaAte`/`chegaFreando` da main (#476: fecha no condutor no máximo a √(2·`freio`·folga) + `trasAprox`; a mesma conta
  que esta branch tinha feito só por trás — 10 de 11 faltas com o botão eram carga por trás do chamado a 5–6 m/s) e o
  `bolaSolta` 0,435 da condução curta. O chamado (`defesa.js chamadoDaPressao`: o último escolhido dentro da validade, com
  o pedido valendo) não entra no corte do passe (`ia-tatica.js vaiNaLivre`): segue a PRESSÃO até o ponto de chegada. Sem
  o botão nada disso liga (o painel IA × IA não muda).
- O chamado da PRESSÃO contorna quem está no caminho (15/10; `defesa.js desvio`, `DEFESA_HUMANO.pressao.desvio`
  {T 0,6 s, folga 0,25 m, alcance 6 m}): em toda `corridaAte` (aproximação do condutor, bola solta do pé dele e o ponto de
  chegada do passe do adversário), o corpo de outro jogador — companheiro ou adversário, não o alvo — que na aproximação
  máxima prevista (Reynolds 1999) dos próximos `T` s passa a menos de 2 raios + `folga` m faz o rumo girar o necessário
  para passar a essa distância, do lado em que ele já está. Antes ele ia reto, trombava (`sim.js colisaoCorpos`: ~1,8 m/s
  a menos) e recomeçava a arrancada. Na junção com a main (#471, que trouxe outro desvio, `desviarCorpos`, pelo ponto a
  `lado` m do corpo) ficou um só: medidos os dois na mesma lógica integrada (`teste-pressao-humano`, 32 partidas, sementes
  7001–7032), M8 1,3 (este) × 1,8 (`desviarCorpos`) trombadas por 100 casos (meta ≤ 3; base 799ab53b 4,2) e M1–M7 iguais
  dentro do sorteio (M5 84,1 × 83,8%). A partida IA × IA não muda (só as cenas `humano`, que apertam PRESSÃO, mudam).

### Testes
`teste-cabeceio` (canhão de cruzamentos, pose, teleporte, partidas demo, humano) e `teste-defesa-corrida` (humano
roteirizado em arrancada e em trote contra a IA) no padrão; os dois aceitam `--js <pasta>` (a base reprova).
`teste-intercepta` (padrão): A) partidas IA × IA — interceptações NA LINHA do passe por time por partida (o passe com
destino dominado por um adversário de linha com a bola andando, a 2 m ou mais do recebedor, sem bater no corpo; mais que a
base + 1,5 e ≤ 14), passe certo (80–86,5%) e o homem livre (recepção no último terço sem ninguém da IA a até 3 m; ≤ base + 3
pontos); B) canhão do passe arriscado (o meia passa a 12–28 m com um adversário a até 3,5 m da linha): dos passes que a
física diz alcançáveis (a conta do `cortaPasse`, com 0,2 s de leitura e 0,1 s antes do recebedor) a IA corta ≥ 50%, dos
outros ≤ 15%. A mesma contagem de interceptações no painel (por time por partida).
`painel-equilibrio` ganhou `--base-json` (a base gravada), `--set` (constantes só da versão medida) e as linhas de chutes
por time, gols de cabeça (8–18%), cabeceios e duelos pelo alto. `prints-cabeceio.mjs`: cabeceio, disputa e o corredor (TV
e de perto).

## Auditoria dos botões (dono, 12/10: "ainda tem botões que não funcionam")
- **Botões de tela pelo toque** (`js/toque-botao.js`, DOM): `aoTocar(el, fn)` age no `pointerup` do MESMO dedo que desceu no
  elemento (dentro dele, com folga de 10 px) e engole o `click` desse toque; mouse, teclado e `element.click()` seguem pelo
  `click`. Vale no ≡ (`entrada.js`), em `[data-cmd]` e `.segmentado` (`hud.js`), na raiz do editor (`editor-time.js`) e no
  "Pular" do pré-jogo. O navegador não gera o `click` com outro dedo na tela (o polegar no analógico). `engolirClique(e)`:
  as camadas que somem no `pointerdown` (pular o replay, a comemoração, avançar o pré-jogo, o fundo da pausa) engolem o
  click do mesmo toque (senão ele caía no ≡ e reabria a pausa) — com o evento, enquanto AQUELE dedo está na tela e até
  450 ms depois de ele sair (o click vem depois do pointerup, por mais que o dedo demore; um dedo cujo pointerup nunca
  veio deixa de valer em 8 s); sem o evento, nos próximos 450 ms.
- **Entrada**: `definirFase(visivel, agora, posseRival)` — `agora` (a do mundo no passo, sem a histerese de 0,25 s dos
  botões visíveis) fixa o sentido de J/K/O/G e A/B/Y/RB no aperto; com `posseRival` (o adversário com a bola no pé), o toque
  no botão grande ainda visível como CHUTE vale pelo TROCAR (`botaoQueVale`; só o grande — nas outras vagas o da defesa é
  outra ação: o PASSE virava o GOLEIRO e, segurado, tirava o goleiro do gol, contraprova; o PASSE/ENFIADA/LANÇAMENTO
  na perda segue como pedido sem bola). `KeyG` está em `SENTIDO_FASE` como `[0, GOLEIRO]` (só na defesa). A DIVIDIDA segurada só vira
  CONTER depois de `ENTRADA.toqueCurto` (o toque curto não afasta o defensor antes do bote). `definirGoleiroMao(v)` mostra o
  `btn-trocar-mao` (TROCAR, vaga 'e' do ataque) com a bola nas mãos do goleiro do humano; `definirGoleiroPe` (PEGAR) só
  com a bola em jogo e a mão valendo (`regras-goleiro.js maoPermitida`: na área, sem recuo, sem a bola que ele soltou —
  depois do recuo o botão não aparece; a tecla O/RB ainda marca o tiro livre indireto, Regra 12.2). `definirMenu(v)`: com a pausa/Ajuda abertas o controle emite `menu-cima/baixo/esq/dir/ok/
  voltar` (`hud.navegarPad`). `soltarTudo(ignorarPad)`; `main.js` limpa os pulsos a cada quadro pausado e solta tudo
  (ignorando o controle segurado) quando a pausa fecha. `main.js faseDoMundo`: a bola solta sem dono que o controlado
  alcança antes de qualquer adversário (rebote, sobra) é ataque. A Ajuda aberta pela pausa volta para ela ao fechar.
- **Simulação** (`sim.js`): `m.possePorTime[time] = tick` (o último tick de cada time com a bola no pé ou na mão, no
  começo do passo — por time: guardar só o último time com a bola fazia a escolha antiga "reviver" quando o adversário
  recuperava a bola, contraprova B14b) e `m.trocaManual[time] = {tick, id, goleiro}` (TROCAR tocado ou segurado).
  `ganhouPosse` passa o humano para o jogador de linha mais perto da
  bola em todo ganho de posse do outro time (como antes: o "Auto" do EA FC), menos por cima da escolha manual da jogada
  de defesa em andamento (`troca.js escolhaManual`: o controlado é o escolhido pelo TROCAR e o time dele não teve a bola
  desde então). Só na perda, como chegou a ficar, mudava a medida pareada do PRESSÃO (o controlado deixava de ser o mais perto
  e o 1º homem da IA já apertava sem o botão: `teste-pressao-humano` M1 Δ 0,35 m, M4 10 → 27 faltas) e o treino. Toque aéreo vencido (a hora passou ou a bola é de outro) é limpo em
  `movimentoAereo` e no laço do `bolaLivre`. `candidatoTroca` pula `papel` 'parado'/'marcador' (a barreira).
  Pênalti montado: o goleiro do humano anda com o analógico (só com um canto escolhido: `partida.js ladoPenaltiHumano`)
  só na linha e no máximo `GOLEIRO.penalti.passo` m (0,5) do meio (`partida.js restricaoPenalti`) — o passo para o lado
  escolhido, não até a trave (`teste-botoes` B6d: lado certo no
  fim 7/38 como na main, segurado desde a montagem 9/38; congelado no meio eram 4/38 nos dois). `m.cobrou = {id, tick}` (`partida.js rolou`; zerado em `bolaMorta`):
  quem cobrou fica fora da bola livre e da bola alta (`candidatosBolaLivre`, `ia-tatica.js vaiNaLivre`) até outro jogador
  tocar (posse, mão, `ultimoToque`, `bateuCorpo`).
- **PRESSÃO** (`defesa.js`): `passeAdversario(m, time)` — no passe do adversário o pedido segue valendo e o chamado corre
  para `m.voo.alvo` (pelo lado do meu gol) até `pressao.colado` m dele (freia no último metro; a curva de chegada no
  recebedor e o bote sem entrar no corpo não o deixam atropelar o domínio); `m.pressaoHumano[time] = {tick, id, ult, ultTick}`: a histerese vale para o último escolhido dentro de
  `DEFESA_HUMANO.pressao.validade`. Na troca automática (`sim.js ganhouPosse`) o chamado fica fora (segue apertando; o
  humano vai para o mais perto depois dele). `sim.js boteIA`: o chamado (`defesa.js chamadoRecente`) não dá o bote
  fechando no condutor a mais de `FALTAS.bote.vLivre` m/s pela conta do `forcaContato` (D1, 23/10; antes, pela velocidade
  absoluta), nem
  por trás do condutor (`faltas.js chegada`), nem com o corpo entrando no dele (`forcaContato` > `FALTAS.forca.min`) —
  `defesa.js boteContidoDoChamado` —, e não faz falta tática.
- **Bola parada** (`partida.js cobrar`): os botões do cobrador humano valem na montagem; o pedido feito antes de `pronta`
  espera (renovado) e sai em `pronta`; o CHUTE fora do pênalti e do tiro livre direto vira `passe` (saída) ou
  `lancamento` (o resto; no lateral, o arremesso longo). No pênalti e no tiro livre direto o CHUTE (a cobrança a gol) só
  conta a partir de `pronta` (o bit é tirado da entrada na montagem e o chute formado antes é descartado): o toque antes
  da hora batia sozinho em `pronta`, fraco e sem a mira (`teste-botoes` B15; segurado desde a montagem, bate).
- **Pênalti**: contra — o canto do humano é `partida.js ladoPenaltiHumano(gk)` na hora do chute (`rolou`): só a
  componente do analógico AO LONGO da linha do gol (z do mundo) escolhe, com |iz| ≥ `GOLEIRO.penalti.ladoMin` (0,38 ≈
  sen 22,5°) × o módulo; com a câmera de TV (yaw −π/2: cima da tela = −z, a trave de lá; baixo = +z, a de cá) o empurrão
  para a esquerda/direita da tela vai para o batedor ou para o gol e NÃO escolhe — nem solto: palpite 0, e o goleiro
  fica com a IA do goleiro, no meio, como sem analógico (`sim.js goleiroComoLinha`; antes `iz >= 0` dava sempre +z e
  esquerda/direita escolhiam o mesmo canto: `teste-botoes` B6e, sem canto 0/24 → 24/24, igual a sem analógico 0/24 →
  24/24; cima/baixo e diagonal com z dominante 30/30 nos dois). `lerChute` compara o palpite com o meio do gol (z = 0),
  `iniciarMergulho` usa o lado escolhido (`d.z`) com `d.palpite`; a favor — a mira do humano fica em ±`ACOES.chute.penaltiCanto` m (2,5: ~8% para fora, `teste-botoes` B11);
  a IA continua mirando o canto dela (`PARTIDA.penaltiIA`, ±2,75).
- **Ações** (`acoes.js`; "humano" = o controlado de um time humano com o humano jogando — `ehHumano` exclui
  `m.iaJoga[time]`, a demo/IA jogando por ele, como no painel de equilíbrio): o LANÇAMENTO do humano na zona do cruzamento espera `ACOES.toqueDuplo` s (do soltar) antes de
  marcar o toque (dois toques = rasteiro); o pedido de primeira do humano com `j.recebe` vale até `recebe.chega +
  ACOES.primeiraFolga` s. `troca.js trocaAerea` não troca no chute do adversário nem tira o goleiro escolhido pelo
  TROCAR segurado enquanto a escolha vale (`escolhaManual` + `m.trocaManual[time].goleiro`; também no cruzamento —
  `teste-botoes` B13, sem reassumir o controle). Vencida a escolha (o meu time teve a bola), a troca aérea volta a valer
  com o goleiro controlado (`teste-botoes` B14: antes a trava ficava a partida inteira).
- Ajuda: segurar TROCAR/Q/LB leva ao goleiro; no pênalti contra o analógico para cima ou para baixo (para uma das
  traves) escolhe o canto, sem isso ele fica no meio; o PEGAR
  não vale no recuo. O botão GOLEIRO continua "segure: ele sai do gol" (decisão do dono).
- Testes: `teste-botoes` (Node, padrão; `--js` mede outra cópia), `teste-controles` (toque de verdade: ≡ com o polegar no
  analógico, Continuar com outro dedo na janela, camadas que não atravessam, Ajuda → pausa, CHUTE/TROCAR na perda, rebote,
  PEGAR com a mão valendo e escondido no recuo, TROCAR com a bola nas mãos, Esc/H → K → Esc/H, O na perda, controle na
  pausa) e `teste-entrada` (G, DIVIDIDA).

## Placar (12/10) — barra de TV no formato da referência, menor e com a cara do GOLAÇO (contrato)
Pedido do dono (12/10), com uma imagem de referência: "quero o placar assim, tem que ser algo menor e mais com a nossa
cara". Pesquisa e medidas em `PESQUISA-ESTADIO.md` §7.1. **Só DOM e CSS**: nenhuma linha da simulação mudou (`hash-igual`
IGUAL; o hash Node = Chromium do `teste-carga` continua).
- **`index.html`**: `.placar` (`data-caixa="placar"`, no canto de cima à esquerda, nas margens seguras) = `.placar-marca`
  (o símbolo do GOLAÇO, `.marca-simbolo`) | `.placar-time.t0#placar-time-0` (`.placar-cor` + `svg.placar-escudo` com
  `<use id="escudo-0">` + `#sigla-0`) | `.placar-resultado` (`#gols-0`, `.placar-x`, `#gols-1`) | `.placar-time.t1#placar-time-1`
  (`#sigla-1` + escudo `#escudo-1` + `.placar-cor`) | `#placar-relogio` (bloco verde: `#relogio` e `#relogio-tempo`). Os
  escudos são `<symbol id="escudo-golaco">` e `<symbol id="escudo-ventania">` no `svg.sprite` do começo do `body` (fictícios,
  só traço, sem texto). Igual na partida e nos treinos (nos treinos o relógio fica `hidden`).
- **`css/estilo.css`**: altura `--placar-h` (24 px; 26 no PC, `min-width: 1001px`), fundo `rgba(7,9,10,0.8)`, borda verde
  0,3, cantos de 6 px; números do placar verdes de 16 px (17 no PC), siglas de 11 px (12), relógio de 14 px (15) preto no
  bloco `--verde` (parado — intervalo e fim — o bloco fica `--verde-escuro` com letras `--texto`), "1º T +4" de 10 px; faixa de cor do time de 2 px de
  cima a baixo (casa verde depois da marca, visitante branca antes do relógio). Topo apertado (`hud.js ajustarTopo`):
  `topo-c1` tira a marca SÓ nos treinos e só se sem ela ainda encostar; `topo-c3` tira o "1º T"; `topo-c4` aperta só os
  espaços (as fontes ficam nos mínimos do H10); depois o minimapa sai do meio e encosta à direita do placar (como antes).
  Na PARTIDA o `topo-c3` vem por último: o "1º T +4", o "Intervalo" e o "Fim" só saem se nem com o minimapa ao lado couber
  (contraprova de 13/10). O topo também se refaz quando os gols mudam de número de dígitos (9 → 10).
- **`hud.js`**: `definirTimes([{sigla, nome, escudo}])` — `escudo` = id do elenco (`main.js timesDoMundo`: `e.id`; treino:
  `golaco`/`ventania`); escreve sigla, o `href` do `<use>` (id desconhecido → o do treino) e o `aria-label` do time (o nome
  só para leitor de tela: nenhum texto novo na tela; cada `.placar-time` é `role="img"` — num `<span>` sem papel o nome
  não chegava ao leitor de tela).
- **`main.js` (API de teste)**: `__golaco.placarDeTeste([a, b], relogio)` escreve o placar e o relógio como o laço passa ao
  HUD ({minuto, tempo, estado, acrescimo}); com o relógio manual parado o laço não reescreve (o próximo quadro escreve o de
  verdade).
- **Teste**: `teste-hud-minimo` H10 (CI): nas 3 telas do celular com entalhe e no PC, no jogo ("34'"), nos acréscimos
  ("45+2'" com "1º T +4") e no intervalo — formato (marca, 2 escudos certos, 2 siglas, placar, relógio no bloco verde com
  contraste ≥ 4,5:1, nessa ordem), altura ≤ 24 px (PC ≤ 26) e altura e área menores que as de antes (`PLACAR_ANTES`) e que a
  referência (248×29 px), números ≥ 14 px, siglas ≥ 11, "1º T +4" ≥ 10, escudos ≥ 12, peças sem sobrepor e dentro da barra,
  e com o minimapa ligado o placar dos acréscimos não encosta no minimapa nem no menu, mantém o "1º T +4" e, com gols 10-9,
  continua sem encostar; no treino de ataque com o minimapa e o painel nada encosta e a marca fica; a árvore de
  acessibilidade tem "Golaço FC" e "Ventania FC" (contraprova de 13/10). `--so-placar` roda só essa parte
  (sem os 2 min de jogo).

## Ponte com o Total Match (15/10; contrato)
Pedido do dono (15/10): o GOLAÇO novo vira o motor 3D das partidas do Total Match (TM). O TM grava o pedido em
`localStorage["tm3d:pedido:<id>"]` e abre `golaco/index.html?tm=<id>` num iframe (lado do TM: `legacy-total-match/js/tm3d.js`).
**Sem `?tm` nada muda**: `hash-partida`/`hash-igual` IGUAIS, a mesma tela, os mesmos testes.
- **`ponte-tm.js`** (página): `ID_TM`, `PEDIDO_TM` (lidos na importação, síncronos), `NO_QUADRO`, `MENSAGENS`, `sementeTM(id)`
  (a semente da partida pelo id: cada partida do TM é outro jogo), `avisarTM(tipo, extra)` (`window.parent.postMessage({tipo,
  id, ...}, location.origin)`), `gravarResultadoTM(r)`, `fimTM(r)` (grava + `tm3d:fim`; fora do quadro volta a `../index.html`)
  e `sairTM()` (`tm3d:sair`: o TM simula do começo — sem WebGL 2, pedido sumido, falha ao subir o 3D).
- **`tm-times.js`** (puro): `timesDoPedido(pedido)` → `{elencos: [tmcasa, tmfora], times: {0, 1}, humano, trava, mapa}`. Time 0 =
  mandante do TM (`home`). Ids 1001–1018 (casa) e 2001–2018 (fora); `mapa[id] = {tmId, nome (o curto do TM), lado}`. Formação
  do TM → `FORMACAO_TM` (as 6 do jogo). Os 11 primeiros do pedido vão às vagas pelo `hungaro` com custo = distância (m) entre a
  vaga da prancheta do TM (`slot`, convertida por `ANCORAS_Y`) e a vaga do GOLAÇO × 10 + posição × 20 (natural 0, alternativa
  1, fora 3); o goleiro fica no GOL. Atributos: ficha com `attr` explícito — o gerador do jogo (`elenco.js gerarAtributos`) pelo
  nível COMPRIMIDO (`NIVEL_TM`: 74 + (overall − 74) × 0,5, 58–88), o perfil do TM (pac/sho/pas/dri/def/phy/gk − overall)
  puxando cada chave até ±6 (`PERFIL_TM`) e a nota na posição de volta ao nível; altura do `look.height`; pé do `foot`. O
  jogador da trava que veio no banco entra no lugar do titular mais parecido (com a vaga dele).
- **`elenco.js`**: `registrarElenco(el)` (ELENCOS + fichas; o mesmo id substitui) e `atributosDe` devolve a cópia do `attr`
  explícito (as fichas do Golaço/Ventania não têm `attr`: bits iguais); `gerarAtributos(jog)` = o gerador sem o cache.
- **`partida.js`**: `criarPartida({..., humano = 0, trava = null})` — o papel 'humano' e o controlado no time `humano`;
  `m.timeHumano`; com a trava (só se o travado estiver em campo no time do humano) `m.trava = {[humano]: id}` e o controlado
  começa nele. `passoPartida` entrega a entrada ao time `m.timeHumano ?? 0`; `entradaDemoPartida` joga pelo controlado dele.
  `m.timeHumano`/`m.trava` ficam fora do hash.
- **Trava "só o meu jogador"** (Rumo ao Estrelato): `acoes.js assumirControle` recusa (devolve `false`) a troca para outro
  jogador do time travado — todo chamador passa por ela (troca, passe, posse, bola parada, goleiro, expulsão, substituição) e
  só empurra o evento 'troca' se a troca valeu; `sim.js` move o goleiro do time travado pela IA quando ele não é o travado;
  `escalacao.js aplicarEdicao` recusa a substituição do travado (código 4). Travado expulso: o controlado fica sem jogador
  (o time inteiro com a IA; a página mostra "Você foi expulso" com o "Simular o resto"). Página: TROCAR e GOLEIRO mascarados
  na entrada; `#btn-trocar`, `#btn-goleiro` e `#btn-trocar-mao` escondidos.
- **`sumula.js`** (puro): `criarSumula()`, `sumulaPasso(s, m, eventos)` (logo depois de cada `passoPartida`), `resultadoTM(s, m,
  mapa)` no formato do contrato do TM — `{homeGoals, awayGoals, gols: [{lado (beneficiado), tmId, nome, minuto, penalti, contra,
  assist}], cartoes: [{lado, tmId, nome, minuto, cor: 'yellow'|'red'}], stats: {possession, shots, onTarget}, jogador? (só com a
  trava: {tmId, nota 4,5–10, gols, assist, toques, passes})}`. Autor pelo `render/autor-gol.js`; pênalti = evento 'penalti'
  'gol' no mesmo passo; assistência = o último passe que chegou ao autor (o desvio do adversário no chute não a tira); chute,
  no alvo e posse com as definições do painel (`tools/lib/partida-medidas.mjs`; o gol sem o chute aberto conta como chute no
  alvo); 2º amarelo = 'yellow' + 'red'; minuto = o do placar (1–45 no 1º tempo, 46–90 no 2º; os acréscimos ficam em 45/90).
- **`main.js`** (só com `?tm`): os elencos registrados e toda partida criada com os times/humano/trava do pedido; `modoPagina`
  sempre a partida; a súmula alimentada em `rodarPasso`; `tm3d:pronto` no `api.pronto`; o resultado gravado já no apito; a
  faixa do fim com "Voltar ao Total Match" (`data-cmd="voltar-tm"` → `fimTM`); **"Simular o resto"** (`data-cmd="simular-resto"`):
  fecha pré-jogo, replay, comemoração, substituição e editor, a IA joga pelo humano (`entradaDemoPartida`) e `passoPartida` roda
  em pedaços de 30 ms por quadro SEM desenhar, com a faixa "Simulando o resto da partida… 63' · FLA 1 × 0 PAL"; no apito, a faixa
  do fim. `window.__golaco.tm = {id, pedido, humano, trava, mapa, controlado, simulando, mensagens, sumula(), resultado(),
  simularResto() (Promise), resultadoGravado()}` (null sem `?tm`).
- **`hud.js` / `index.html`**: `criarHud({tm: {trava, timeHumano}})` — a pausa sem "Reiniciar partida" e "Modo de jogo", com
  `#btn-simular-resto` (até o apito) e `#btn-voltar-tm` (no fim); sem "Editar time" com a trava. `faixa({..., botaoTexto,
  botaoCmd})`. O ponto do controlado no minimapa na cor do time dele.
- **Testes**: `teste-ponte-tm` (Node, padrão; P1 sem recuo, P2 tm-times, P3 humano no visitante, P4 trava, P5 resultado de
  partidas inteiras, P6 súmula com eventos montados; os pedidos em `tools/lib/pedidos-tm.mjs`) e `teste-tm-tela` (navegador; o
  TM imitado por um quadro pai na mesma origem: pronto, pausa, Simular o resto, faixa, `tm3d:fim`, Estrelato no celular, sem
  `?tm` nada muda; `--pedido <arquivo>` usa um pedido de verdade do TM).

## Identidade visual de cada time (Total Match, 15/10)
Pedido do dono: "a logo dos times, torcida, e estádio adaptáveis a cada time". Só DESENHO (render/DOM): nada entra no mundo
nem no hash; a geometria (placas, arquibancadas) não muda.
- **`js/identidade.js`** (puro): `IDENTIDADE_PADRAO` = exatamente as constantes de hoje (referência dos testes; os desenhos
  não a leem). `identidadeDoPedido(pedido)` → `{tm: true, neutro, publico, times: [{nome, sigla, cores, forte, outra,
  escura, escudo: {url, gerado, img}}], kits: {linha0, goleiro0, linha1, goleiro1, arbitro}, uniformes: {escolha,
  medidas}, torcida: {casa, fora, mosaico, acentos, foraLados}, mosaico: {texto}, faixas (12), festa, paineis (4),
  arquibancada, escanteio, fachada, torcedoresFora, estadio: {nome, placa}, hud: {mapa, faixa, placar}}`. Time 0 =
  mandante. Uniformes sem confusão por ΔE₀₀ (CIEDE2000; `deltaCamisas` = metade a cor vista de longe, metade a cor
  dominante mais parecida): visitante casa → fora → terceiro (≥ `LIMIAR.linha` 25; nenhum ≥ 15 → o mandante troca
  também; ainda assim → uniforme de reserva branco/preto/cinza), `kitEscolhido` respeitado, goleiros ≥ 25 dos 2 de linha
  e do outro goleiro, árbitro ≥ 22 dos 4 (azul, preto, amarelo, vermelho, ...). Kit do TM → `{camisa, manga, calcao,
  meiao, chuteira, acento, sola, luva, padrao (plain|stripes|halves|sash|hoops), segunda}`. Paletas ≥ 10 cores com
  neutros; faixas `[texto, fundo, letra, detalhe, corDoDetalhe?]` com letra ≥ 3:1 (9 e 11 = visitante); minimapa ≥ 22 do
  branco da bola, ≥ 3:1 no fundo, ≥ 25 entre os times; jogo neutro: o Estádio Total Match (seção "Estádio de cada clube"),
  torcida 45% misturada; `publico` 0,1–1 = ocupação.
- **Página**: `render/identidade-pagina.js identidadeDaPagina()` — null sem `?tm` (identidade.js nem é baixado: import
  dinâmico); com `?tm` decodifica os escudos (≤ 1,5 s; falhou → `urlEscudoSigla`, a sigla nas cores) ANTES de
  `criarCampo`/`criarTorcida`. main.js: `IDENT` → `criarCampo({identidade})`, `criarTorcida({identidade, mascara:
  mascaraDaIdentidade})`, `jog3d.definirKits(IDENT.kits)`, `criarPrejogo({identidade})`, `COR_TIME` (faixa ENTRA/SAI) e
  `timesDoMundo` com `extrasPlacar` (`{escudoUrl, cor, corTexto, mapa}` → hud.js `<symbol id="escudo-tm-i">` com `<image>`,
  a cor do time na faixa do placar e `COR_MAPA`). `__golaco.identidade`.
- **Desenhos** (todos com `identidade.tm`; sem ela o código de hoje): `jogador3d.js definirKits` (manga, padrões no shader
  `manequim-v4`: iPad do tronco/gola + 0,1–0,4), `campo.js` (placas `texPlacas(paineis, escudos)`, cadeiras/friso/mosaico
  `texArquibancada(cores, mascaraTexto)`, escanteio `texBandeira(cores)`), `torcida.js`/`torcida-dados.js
  gerarTorcidaNiveis(mascara, paletas)` (os MESMOS lugares e sorteios), `bandeiras.js`/`bandeiras-dados.js faixas(textos)`
  (bandeirões e bandeira com o escudo), `estadio-fora.js` (placa com escudo e nome em 1 ou 2 linhas, fachada, cobertura,
  túnel, cantos, torcedores), `prejogo-tela.js` (escudos e estádio na abertura), `escalacao-tela.js` (escudo e cor).
- **Teste**: `teste-identidade` (Node, padrão): padrão = constantes de hoje (torcida byte a byte), ΔE₀₀ nos pares de Sharma
  et al., 7 pedidos difíceis (dois vermelhos, azul × árbitro azul, preto-e-branco × branco-e-preto, 3 uniformes iguais,
  escolhido que confunde, sem identidade, neutro com público baixo) e a torcida do TM (mesmos lugares, público, neutro).

## Estádio de cada clube no pré-jogo (Total Match, 15/10)
Pedido do dono: na edição pro (licenciada) o estádio REAL do mandante; na pública, o Estádio Golaço com o nome do jogo. Só
DESENHO (hash igual): a geometria não muda (fachada |x| 93 / |z| 79 / 27,6 m, anel da cobertura, arquibancadas e placas são
os sólidos dos trilhos do pré-jogo e da bola). Sem `?tm` nada muda no desenho (estádio de fora e cadeiras bit a bit iguais)
nem nos arquivos baixados: a base, `identidade.js` e `render/fachada-estilos.js` só vêm com `?tm` (os dois últimos só na pro
com o estádio achado); o código dos módulos de sempre cresce ~3 KB (`render/estadio-fora.js` +1,6 KB,
`render/identidade-pagina.js` +1,4 KB, `render/texturas.js` +0,2 KB), nenhum arquivo novo (`teste-carga`, ≤ 4 MB).
- **`js/identidade.js`** (puro): `identidadeDoPedido(pedido, base)` — `pedido.edicao === 'pro'`, jogo não neutro e o estádio
  achado em `base` (pelo `home.identidade.estadio.nome`, senão `home.stadium`) → `estadio = {nome (o real), placa, real: true,
  edicao, motivo: 'real', chave, dados}`, `fachada = {estilo, cor, cor2, ledCor, aneis, cobertura, coberturaCor, trechos (os
  72 trechos do anel que ficam, `trechoCoberto`; null em 'total'), coberturaTons, led (o da faixa de dia; null sem LED),
  ledNoite, letreiro, testeira (a cobertura escurecida), testeiraFriso, tunel, simbolo}`,
  `arquibancada = {friso (a fachada_cor2 se aparece na parede, senão a cor do mandante), mosaico, cadeira, cadeira2, tom, tom2,
  padrao, aneis}`, mosaico da torcida = o nome do mandante. Senão (pública, neutro, sem a base, estádio fora dela) → o
  **Estádio Total Match** (`ESTADIO_TM`): `fachada`/`arquibancada` = as de `IDENTIDADE_PADRAO` (as cores de hoje), nome
  "Estádio Total Match", placa "ESTÁDIO TOTAL MATCH", mosaico "TOTAL MATCH" com a torcida no verde do Golaço (mandante de
  camisa verde, ΔE₀₀ < 20 do #19e07a: a torcida do mosaico em branco #f2f4f3, senão o mosaico some na torcida verde — só a
  camisa muda; as cadeiras do mosaico continuam #0d8447, o estádio inteiro bit a bit o padrão), `motivo` 'publica' |
  'neutro' | 'sem-base' | 'sem-dado'. Escudos, uniformes, torcida, cachecóis, faixas, bandeirões,
  placas de publicidade e bandeira de escanteio seguem os times (como antes). `normalizarNomeEstadio(nome)` = a chave da
  base (NFKD sem acento, minúsculas, ß/ø/æ/œ/ł/đ/ð/þ/ı/ħ/ŧ trocadas, o resto que não é a–z/0–9 vira espaço simples, sem
  espaço nas pontas): a MESMA função grava a base e procura nela. `dadosEstadio(e)` valida (cores `#rrggbb`, escolhas das
  listas `ESTILOS_FACHADA`/`COBERTURAS`/`PADROES_CADEIRAS`, anéis 1–3; o que vier quebrado usa a reserva), `acharEstadio`,
  `baseValida`, `TRECHOS_COBERTURA` e `trechoCoberto(tipo, i)` (os 72 trechos do contorno do anel, na ordem de
  `render/estadio-fora.js contorno`: x+ 0–7, canto 8–17, lado de cá 18–25, canto 26–35, x− 36–43, canto 44–53, lado de lá
  54–61, canto 62–71).
- **Base** `assets/tm/estadios.json` = `{versao: 1, estadios: {"<nome normalizado>": {nome, cidade?, fachada_estilo:
  'vidro'|'concreto'|'metal'|'membrana'|'tijolo'|'trelica'|'paineis', fachada_cor, fachada_cor2, fachada_led|null, cobertura:
  'total'|'lados'|'parcial'|'nenhuma', cobertura_cor, cadeiras_cor, cadeiras_cor2|null, cadeiras_padrao:
  'liso'|'misto'|'faixas'|'mosaico', aneis 1–3, marca?, confianca?, ...}}, homonimos?: {"<nome normalizado>": [Estadio &
  {clubes: [nome do clube no TM, ...]}]}}` (campos a mais são ignorados). **Estádios de mesmo nome** (ex.: "estadio
  centenario" = Montevidéu do Montevideo City Torque × Caxias do Sul do Caxias): `acharEstadio(base, nomes, clube)` usa a
  entrada de `homonimos[chave]` cujo `clubes` tem o `home.name` do pedido; nenhum clube bate (ou sem `homonimos`) →
  `estadios[chave]`.
- **`render/identidade-pagina.js`**: na pro sem jogo neutro a base é baixada JUNTO com identidade.js (`fetch`, tempo limite
  `ESPERA_BASE_MS` 2,5 s, abortado; falhou, passou do tempo ou fora do formato = como a pública, `motivo` 'sem-base'); no
  estádio genérico, `estadio.simboloImg` = o símbolo do TM (`assets/tm/simbolo.png`, o do placar) decodificado junto com os
  escudos; no estádio real, `identidade.estilos` = o módulo `render/fachada-estilos.js` e `arquibancada.corCadeira` = a
  `corCadeiraReal` dele (import dinâmico: sem `?tm` pro nada disso é baixado; falhou = o Estádio Golaço nas cores do estádio,
  com o anel inteiro e as letras do mosaico).
- **Desenho** (`render/estadio-fora.js`; o que só o estádio real usa fica em `render/fachada-estilos.js`): placa com o nome
  real e o escudo do mandante (o nome com contorno escuro de 8 px: a fachada pode ser clara) ou o símbolo do TM e
  "ESTÁDIO TOTAL MATCH"; fachada por estilo (`fachada-estilos.js texFachadaEstilo`: o mesmo ladrilho de 12 × 27,6 m com a base, o portão e o
  letreiro; o pano de 5,2 a 24 m pelo estilo — vidro: montantes de 1,5 m e travessas; concreto: paredão com a fôrma, uma
  galeria por anel e pilares a cada 3 m; metal: lâminas de 0,5 m; membrana: almofadas em losango de 2 × 2,35 m; tijolo:
  alvenaria com janelas por anel; treliça: aço em X a cada 6 m; painéis: mosaico de 2 cores de 1,5 m — com as faixas dos
  anéis; a faixa de LED na cor `fachada_led` (sem LED, cornija) e, à noite, o LED e as luzes de dentro no mapa de brilho com
  o pano a 60% da luz de fora); a face de DENTRO da fachada (DoubleSide; aparece onde a cobertura foi tirada) é um muro liso
  e apagado, sem o desenho de fora nem o LED (`fachadaPorDentro`: o material troca de programa, a malha e a chamada são as
  mesmas); cobertura pela cor (`texCobertura` com `fachada.coberturaTons`) e pelos trechos do anel (`fachada.trechos`:
  'total' = os 72, 'lados' = os lados compridos com 4 de 10 trechos de cada canto, 'parcial' = só o lado de LÁ — a tribuna
  diante da câmera de TV, a que tem a marquise no jogo, então o estádio do pré-jogo e o do jogo são o mesmo —, 'nenhuma' =
  nenhum; onde não há cobertura, um arremate de 1,6 m em cima da fachada) — a mesma 1 malha; em 'nenhuma' a marquise da
  arquibancada de lá e o teto curto da de cá (`render/campo.js`, malhas 'arquibancada-lado'/'arquibancada-ca') somem no
  pré-jogo (`esconderMarquise`: os triângulos acima de 25,2 m viram pontos, a mesma malha e a mesma chamada) e voltam
  inteiros no `dispose` do lado de fora (o jogo fica com o estádio dele; os sólidos dos trilhos não mudam;
  `marquiseEscondida()` para os testes); cadeiras dos cantos e do jogo (`texturas.js texArquibancada` com
  `cores.corCadeira` = `fachada-estilos.js corCadeiraReal` pelo `padrao`: liso; misto = as duas cores salpicadas com um
  pouco de branco; faixas = anéis alternados pelas fileiras, com 1 anel os setores entre corredores; mosaico = liso com as
  letras na 2ª cor — as letras nas cadeiras só no 'mosaico'). Custo igual ao de hoje (as mesmas chamadas por plano;
  triângulos ≤): celular Média de dia, pior plano 40 chamadas / ≤ 123,3 mil triângulos (sem `?tm` 40 / 127,3 mil). À noite
  o pior plano do celular dá 44 chamadas em todas as variantes, também sem `?tm` (já era assim antes do estádio de cada
  clube; pendente à parte: a meta de 40 do pré-jogo foi medida de dia).
- **Teste**: `teste-identidade` seção E (E1 a base no formato, E2 a normalização, E3 pública, E3b pública com mandante de
  camisa verde, E4/E4b pro achado, E5 pro sem dado/sem base/neutro, E6 campos quebrados, E7 cada estádio do arquivo achado
  pelo nome, E7b os homônimos — ensaio e arquivo —, E8 os trechos da cobertura e `fachada.trechos`; `--base <arquivo>`
  confere outra base); `teste-prejogo` item 14 (navegador, CI: `?tm` pro no celular Média de dia, Aflitos concreto/'nenhuma' e
  BUKO Stadion vidro/'parcial' — o estádio achado com o desenho dele, cada plano com cor, ≤ 40 chamadas / ≤ 130 mil
  triângulos, a marquise escondida só no pré-jogo da 'nenhuma' e de volta no jogo, 0 erros).

## Estádios de forma genérica (21/10)
Pedido do dono (21/10, depois do Maracanã): "quero isso com todos os estádios do jogo, ele pesquisou o estádio, olhou
direitinho e fez detalhes certinho". Só DESENHO (hash igual): placas, gols, túnel (boca em z = `ESTADIO.tunel.z`) e bancos são
os de `config.js`. Sem `?tm` pro nada disso é baixado (o download inicial não muda).
- **`js/estadio-generico.js`** (puro): `validarFormaGenerica(f)` → a forma completa (ou null: sem família conhecida ou o
  Maracanã, `entorno: 'maracana'`, que é de `estadio-planta.js`); `criarPlantaGenerica(forma, {dividida})` → a planta com a
  MESMA interface da do Maracanã (`lugares`, `solido`, `cameraNoLadoDeCa`, `faixas`, `bandeiras`, `bandeiroes`,
  `sinalizadores`, `ajustarPlano`, `ajustarAbertura`, `cameraGeral`) e as contas do desenho (`rF`/`rB`/`ponto`/`sDe`,
  `perfil(s, θ)`, `perfilLado(k, s)`, `tipoEm`, `sAneis`, `trechos(nCol)`, `temArquibancada`, `cobEm(θ)`, `alturaCobEm`,
  `perfilCasca`, `torres`, `marcas`, `predios`, `arvores`, `carros`, `estacionamentos`, `canteiros`, `torcedoresFora`, `agua`,
  `relevo`). Famílias: **tigela** (bacia oval), **inglesa** (4 retas de cantos abertos), **arena** (retangular de cantos
  fechados), **pista** (a curva de atletismo oficial: retas de 84,39 m, raio 36,5 m, 8 raias de 1,22 m), **pequeno**.
  Contas por ângulo polar θ como no Maracanã: 1ª e última fileira em superelipse de semi-eixos POR QUADRANTE (a pista: a
  curva de atletismo), a fileira s pela interpolação radial; a altura do degrau pelo perfil de cada lado (`la` lado de lá,
  `fa` fundo +x, `fb` fundo −x, `ca` lado de cá = o setor 0–3), misturada nos cantos fechados (±14° de ψ; nos parciais o
  canto desce); nos cantos ABERTOS a arquibancada termina numa reta (|x| ≤ X nos lados, |z| ≤ Z nos fundos) e o canto fica
  vazio. Perfil de 1–3 anéis com a face dos camarotes (vidro) ou do corredor entre eles. A 1ª fileira contém a quina das
  placas com ≥ 1,5 m e a do lado de cá fica na boca do túnel (mais longe na pista ou com recuo grande: a caixa do túnel por
  cima). Cobertura: anel/total/retrátil contínuas ou por arquibancada/parcial (só os lados cobertos), sustentação por
  treliça, pilares (cobertura quase plana), mastros, cabos/anel de compressão, balanço ou arco; sem cobertura, 4 torres de
  refletor (ou as estruturas sobre os lados: `torres_luz` com lado). Casca: fachada de membrana (ou `pele_led`) com a
  cobertura fechada sai do chão abaulada (7 m) e dobra até a borda da cobertura. Marcas próprias: arco, torres, rampas em
  espiral, mastros, telão (pendurado na cobertura ou em cima da arquibancada), estátua, cúpula, pele de LED. Entorno pelo
  tipo (urbano denso, residencial, parque, industrial, campo aberto, orla, campus: a esplanada, a densidade e a altura dos
  prédios), relevo (morros/montanhas no horizonte), água (rio, canal, lago, mar) e a malha de ruas girada (`orientacao`).
  Lugares: ~1 torcedor por lugar até ~20 mil, até 25,5 mil nos grandes (os de cima um pouco maiores e mais espaçados).
- **`render/estadio-generico.js`**: `ligarForma`, `criarTigela` (as 5 malhas de sempre: 'arquibancada-lado',
  'arquibancada-fundos' com a pista/o piso pintado, 'arquibancada-ca' com o túnel, os bancos e a cobertura de cá — fora do
  desenho com a câmera atrás da 1ª fileira de cá —, 'cobertura' e 'cobertura-estrutura' com as lâmpadas acesas à noite pelo
  mapa de brilho) e `criarForaForma` (fachada pelo estilo de `fachada-estilos.js`, a placa, o túnel, 'fora-marcas' — marcas,
  água e relevo numa malha —, esplanada, chão do bairro, prédios, árvores, carros, torcedores; ≤ 40 chamadas por plano no
  celular Média). `render/identidade-pagina.js` escolhe: forma com `entorno 'maracana'` → a do Maracanã; outra → esta.
- **Base**: `assets/tm/estadios.json` → `estadios[chave].forma = {familia, planta?, n?, cantos?, pista?, recuo: [lateral,
  fundo], lados: {la|fa|fb|ca: [profundidade, altura, anéis, coberta 0/1, camarotes 0/1]}, cob: {tipo, mat, cor, sust, alto,
  estr}, fach: {estilo, cor, cor2, led}, cad: [cores], padrao, marcas: [{tipo, lado?, n?, alto?, cor?}], entorno: {tipo,
  relevo, agua, lado?}, pistaCor?, piso?, orientacao?, capacidade, letreiro}`, gerado por `tools/estadios/gerar-formas.mjs` a
  partir da pesquisa (`tools/estadios/pesquisa-forma-*.json`: os agentes com a foto do TM e 2+ fontes por estádio) e dos
  ajustes da revisão contra as fotos (`tools/estadios/ajustes-forma.json`, por cima).
- **Campos da revisão** (21/10, os defeitos repetidos que a revisão contra as fotos achou): `cob.comp` (m coberto no meio de
  cada lado coberto: a marquise só no centro da principal; `cobEm` devolve null fora dele, a chapa, os sólidos e a sombra
  seguem); `fach.estilo 'talude'` (o barranco de grama — ou de pedra, com a cor escura — do topo da arquibancada ao chão,
  `dTal` = 0,95 × a altura, 5–20 m, com a escadaria; a fachada vira esse barranco, o `rFach` passa a ser a base dele e a
  entrada principal é o bloco `portal` com a placa no lado de cá); `fach.casca false` (a membrana sem a casca abaulada); o
  `concreto` é o MURO do estádio (pilares a cada 6 m, a fresta de ventilação no alto, uma seteira por pano: antes as
  galerias por anel pareciam prédio de escritórios); padrões de cadeira `setores` (blocos de 6 m alternados) e `raios` (a 1ª
  cor cortada por faixas finas da 2ª); marcas `bola` (a escultura da praça, os 12 gomos pretos), `cubo` (o cubo de vídeo no
  meio, só com a cobertura contínua), `torres_luz` com lado E n (n torres enfileiradas atrás daquele lado; com lado de lá/cá
  sem n, as duas estruturas largas; sem lado e n > 4, espalhadas em volta), `torres` com lado (atrás do meio dele; as sem
  rampa coladas na fachada). Limite de peças por marca: colunas 300, mastros 48, torres de luz 16, o resto 24. As raias da
  pista só no tartan (a cor saturada): o anel de terra ou de asfalto da pista antiga fica liso. Os 2 bandeirões sempre por
  slot (0 lado de lá, 1 organizada; o que a forma não tem fica `vazio`, no subsolo — o shader da torcida e o das bandeiras
  leem 2: o Barradão, sem o lado de lá, quebrava a página).
- **Testes**: `teste-estadio-generico` (Node, padrão; os 5 de exemplo + a base inteira: G1 forma válida/quina/túnel, G2
  lugares no degrau e fora dos sólidos, G3 festa, G4 câmera de TV, G5 trilhos do pré-jogo, G6 clássico, G7 desempenho, G8 sem
  forma nada muda); `teste-prejogo` item 14 com os Aflitos; prints de conferência `tools/prints-estadios.mjs`.

## Cara do Total Match no modo ?tm (15/10)
Pedido do dono: "deixa os botões, menu, tudo com a cara do total match". Só DOM/CSS (hash igual); sem `?tm` nada é baixado.
- **`index.html`**: um `<script>` antes do CSS põe `html.tm` (só com `?tm=<id>` não vazio); outro DEPOIS do importmap escreve
  `<link rel="stylesheet" href="css/tm.css">` pelo parser (última folha, bloqueia o desenho: nada pisca com a cara do
  GOLAÇO) e importa `js/tm-cara.js` (módulo antes do importmap faria o navegador ignorar o mapa).
- **`css/tm.css`**: TUDO sob `html.tm`; a cara sai do `legacy-total-match/css/styles.css` (preto #050807, painel #0f1612, verde
  #22c55e/#4ade80, texto #eef5f0, fraco #8a9d90, botão principal em pílula com `linear-gradient(120deg,#34d572,#1fae55)`,
  cartões com raio 14–18 px e borda fina, segmentados separados). Variáveis `--tm-*` para peças novas; as do GOLAÇO
  (`--verde`, `--preto`, `--fonte`...) apontam para as do TM. Fonte `'Inter TM'` (nome próprio: a "Inter" do `.faixa-subst`
  não baixa nada sem `?tm`), em `assets/tm/fontes` (OFL). Logo do TM no placar (`assets/tm/simbolo.png`), no carregamento,
  na abertura do pré-jogo, na tela "Gire o celular" (`assets/tm/logo.png`), no título da pausa/ajuda/editor e ao lado de
  "Escalação". Sem itálico nem inclinação: o GOL! e a vinheta do replay têm `@keyframes tm-*` retos, ligados só em
  `prefers-reduced-motion: no-preference`. O que o jogo MEDE fica igual: peso/espaçamento dos nomes dos botões de toque,
  alturas de 48 px. Celular deitado (360–480 px de altura): a faixa do intervalo/fim desce para baixo do lugar do aviso
  (ancorada pelo topo; com a linha ENTRA/SAI no topo, mais 42 px).
- **`js/tm-cara.js`** (página): título, `theme-color`, ícone, "Total Match" na marca do carregamento (o texto fica para o
  leitor de tela; na tela a logo), o texto do `#girar`; pede os 5 pesos da Inter e, quando chegam (ou falham), põe
  `<html data-fontes-tm="ok|falhou">` e manda `tm:fontes` na window → main.js `entrada.reposicionar()` + `hud.ajustarTopo()`
  (os nomes dos botões são medidos pelo canvas). `prejogo-tela.js`: a marca da abertura vira "Total Match" com `html.tm`.

## Disputa de pênaltis — o modo Pênaltis 3D (15/10; contrato)
Pedido do dono (15/10): "crie uma versão só de jogador de pênaltis" → "modo de pênaltis 3d igual ao golaço, só que versão de
pênaltis". `?modo=penaltis` (sem `?tm`: Golaço FC × Ventania FC), o botão "Pênaltis" no "Modo de jogo" da pausa (na linha da
Partida) e, com `?tm`, o pedido do TM com `modo: "penaltis"`. **Sem o modo nada muda**: `hash-partida`/`hash-igual` IGUAIS; os
módulos novos (`disputa.js`, `disputa-tela.js`) só por import dinâmico (fora do download do teste-carga).
- **`disputa.js`** (puro; constantes `config.js DISPUTA`). O mundo é o da partida (`criarPartida` com os times do pedido, sem a
  trava) com `m.modo = 'penaltis'` e `m.disputa = {estado, desde, gol (±1), primeiro (0|1), ordem: {0, 1} (ids), vagas: {id:
  {x, z}}, cobrancas: [{time, id, resultado, n, k, cavadinha}], placar: [a, b], chutes: [a, b], vencedor, vez, cobrador,
  goleiro, goleiroCobra, chuteTick, tocou, trave, cavadinha, ultima, alvo}`; `m.placar` = o placar da disputa.
  - Regra 10 da IFAB: `timeDaCobranca(primeiro, k)` (ABAB), `vencedorDisputa(placar, chutes, n = 5)` (nas 5: um não alcança
    mais o outro; depois, com o mesmo número de cobranças, quem fez mais), `ordemCobradores(m, t)` (os de linha pela
    finalização, o goleiro por último) e `cobradorDa(ordem, n)` (a fila dá a volta: ninguém bate a 2ª antes de todos). O gol e
    quem começa pela moeda (`m.rng`; `opc.gol`/`opc.comeca` forçam, a moeda sai do rng igual).
  - `criarDisputa({semente, elencos, times, humano, comeca, gol})` → o mundo com a 1ª cobrança começando. A cada cobrança
    (`iniciarCobranca`): `m.ataca` põe o time da vez atacando o gol da disputa; `partida.js bolaMorta(m, 'penalti')` com a bola
    na marca (ninguém toca nela); todos 'parado'; os que esperam no círculo central (duas filas de frente para o gol), o goleiro
    que defende NA linha do gol até o chute (Regra 14, que vale na Regra 10: o centro a `DISPUTA.goleiroLinha` m dela, um pé
    sobre ela; `partida.js restricaoPenalti` e `goleiro.js movimentoGoleiro` com `m.disputa` — na partida ele segue na
    bissetriz, segurado a 0,6 m), o do time que bate na linha de fundo além da linha da área (`DISPUTA.esquina`), o cobrador a
    `caminhada.dist` m atrás da marca (corte de câmera); o humano controla o cobrador dele ou o goleiro dele.
  - Estados: `caminhada` (o cobrador anda até 0,4 m atrás da bola pela locomoção do jogo: `j.guia` — o pedido de movimento
    pronto que o `sim.js` usa para quem está 'parado'; sem `j.guia`, parado como sempre) → `cobranca` (`partida.js
    prepararPenalti`: a mesma montagem do pênalti da partida, o goleiro que defende vira 'ia'; `pr.inicio` + `esperaHumano` s,
    `pr.pronta` em `DISPUTA.pronta` s e a força da IA na faixa `DISPUTA.forcaIA`) → `chute` (a bola rolou: `partida.js cobrar`/
    `rolou`) → `reacao` (`DISPUTA.reacao` s; o cobrador volta ao círculo trotando no gol, andando no erro; o goleiro com a bola
    nas mãos não repõe) → a próxima cobrança ou `fim`.
  - Fim da cobrança (Regra 10): `gol` (entrou, também depois de tocar o goleiro ou a trave), `defesa` (o goleiro TOCOU — a
    defesa dele ou a bola no corpo dele; o `goleiroBatido` é justamente quando ele não chega — e ela não entrou: nas mãos dele,
    saiu, voltando do gol, parou ou `fimChute.max` s) ou `fora`. Voltando do gol ou parada, a cobrança só acaba se a física da
    bola sem ninguém no caminho (`bola.js passoBola` por `fimChute.previsao` s) não cruza a linha entre as traves e, voltando,
    não passa a < `alcanceGoleiro` m do goleiro (o corpo dele ainda pode desviá-la para dentro). Dado o resultado, a bola está
    morta (`m.golTick` = MORTA): nenhum gol conta depois dele (revisão de 16/10: a bola na trave que voltava pela boca do gol
    era dada como perdida e entrava depois, no goleiro, com o "GOL!" na tela).
  - O goleiro da IA lê a cavadinha repetida (`DISPUTA.leituraCavadinha`): com `n` cavadinhas nas últimas 3 cobranças do time
    que bate, ele fica no meio com a chance `meio[n − 1]` (30/45/55%; sem nenhuma, os 12% da partida). Um sorteio a mais do
    `m.rng` só depois de uma cavadinha (a disputa sem elas sorteia igual). Medido: a cavadinha repetida do humano convertia 93%
    (o chute no canto, ~76%); agora a 1ª da disputa 100% e todas ~58%.
  - `passoDisputa(m, entrada)`: a entrada do humano só vale com a cobrança montada — batendo, o analógico e o CHUTE (a cavadinha
    com dois toques é a do pênalti da partida); defendendo, só o analógico (o lado antes do chute: `partida.js
    ladoPenaltiHumano`). Eventos: `disputaCobrador {time, id, n, k}`, `apito {motivo: 'cobranca'}` (bola pronta),
    `disputaCobranca {time, id, resultado, n, k, placar}`, `disputaFim {vencedor, placar}` + `fimDeJogo` (a torcida e os
    treinadores), além dos da cobrança. `entradaDemoDisputa(m)` (a IA pelo humano: `iaCobra` batendo; o goleiro para o lado
    sorteado), `resumoDisputa(m)` (cópia), `resultadoPenaltisTM(m, mapa)` → `{penaltis: {vencedor, placar: [casa, fora],
    cobrancas: [{lado, tmId, nome, resultado}]}}` (sem `homeGoals`; null antes do fim).
  - Desenho (só lê o mundo; hash igual): `poseDisputa(m, j, o)` (os gestos da comemoração por cima da pose: braços para cima no
    gol, mãos na cabeça no erro, o punho do goleiro na defesa, quem venceu pulando de braços para cima no fim),
    `planoCameraDisputa(m, out, pos)` (`abertura`/`fim`: o círculo; `cobranca`: atrás e acima do cobrador; `reacao`: de frente
    para quem reage, andando com ele) e `yawDisputa(m)` (o analógico vira mundo pela câmera da cobrança: esquerda/direita da
    tela = esquerda/direita de quem bate e o lado do mergulho).
- **Mudanças nos módulos de sempre (sem mudar nada fora da disputa)**: `partida.js` exporta `bolaMorta`, `cobrar`, `rolou` e
  `prepararPenalti` (a parte do `montarPenalti` depois de levar os outros para fora da área; a mesma ordem de sorteios);
  `sim.js` lê `j.guia` de quem está 'parado'; `goleiro.js espalmar` com `m.disputa` manda a bola espalmada perto da linha para o
  lado e para a frente (a "por fora da trave" mirando atrás da linha entrava em 3 de 4 na disputa); `partida.js
  restricaoPenalti` e `goleiro.js movimentoGoleiro` com `m.disputa`: o goleiro que defende na linha (`DISPUTA.goleiroLinha`).
- **`disputa-tela.js`** (DOM, import dinâmico): `criarTelaDisputa({times, nome})` → `{atualizar(m, timeHumano), limpar(),
  estado()}` — as bolinhas abaixo do placar (convertido verde, perdido vermelho com traço, a bater vazia, a da vez pulsando; 5
  por time e uma a mais por rodada das alternadas, as últimas 7), "Bate: nº nome" na cor do time, e as classes do `<html>`
  `modo-penaltis` (nenhum botão de toque além do CHUTE; sem minimapa nem o botão "Minimapa" da pausa; o aviso abaixo das
  bolinhas; em telas de até 359 px de altura a faixa do fim desce para baixo das bolinhas — em 568×320 cobria a ponta delas;
  a dica de teclas do PC fica, como na partida), `penaltis-bate` (a cobrança do humano montada: o CHUTE aparece) e
  `penaltis-defende`.
- **`main.js`**: `MODOS` com 'penaltis' (o import dinâmico na 1ª vez); `passoDoMundo`/`entradaDemoDoMundo` pela disputa; os gestos
  depois da pose; a câmera de cinema pelos planos da disputa; o placar sem relógio; o gol só com o "GOL!" (sem câmera do gol,
  replay automático, comemoração nem pré-jogo); as dicas de comando na 1ª vez que o humano bate e defende
  (`hud.js TEXTO_EVENTO penaltisBate/penaltisDefende`; sem toque, o aviso de bater diz a tecla: "segure K (no controle, B)"; o
  de defender, "esquerda ou direita antes do chute"); a faixa do fim "X venceu nos pênaltis" + "GLÇ 5 × 4 VNT" com "Jogar de
  novo" ou, com `?tm`, "Voltar ao Total Match" (o resultado gravado no apito; "Simular o resto" joga a disputa pela IA até o
  fim, o placar sem relógio). A semente da disputa (`sementeDisputa`): com `?semente` (ou `?tm`), a da página e a seguinte a
  cada "Jogar de novo" (no meio, "Reiniciar disputa" repete a do começo); sem elas, SORTEADA na página a cada disputa nova (a
  1ª, Reiniciar, Jogar de novo, a volta pelo Modo de jogo) — antes toda disputa começava igual (a mesma moeda, os mesmos lados
  do goleiro da IA). Ela fica no mundo (`m.semente`): o hash continua valendo. `window.__golaco.disputa` (o resumo), `telaDisputa()` e `planoCamera`.
- **`hud.js` / `index.html`**: `data-so` aceita vários modos ("partida penaltis": Replay e Reiniciar; o Editar time é só da
  partida); `em-penaltis` no `<html>`; "Reiniciar disputa"; com `?tm` o "Simular o resto" diz "até o fim da disputa" e o
  submenu "Cenas da partida" some. A Ajuda tem o item "Pênaltis" em cada coluna (`.so-disputa`, só com `modo-penaltis`: bater
  e defender pela esquerda/direita da tela) e, na disputa, esconde o "No pênalti contra, cima ou baixo" da partida
  (`.so-partida-pen`; a câmera de TV da partida é de lado).
- **Total Match** (`legacy-total-match`): `js/penaltis3d.js` (rotas `penaltis3d` — o seletor do jogo rápido para "Seu time" e
  "Adversário", o Viverde FC em "Especiais" com a senha — e `penaltis3d-fim` — o pôster do fim "X venceu nos pênaltis", o
  placar e as cobranças de cada time, "Jogar de novo" e "Voltar"); "Pênaltis 3D" em "Mais modos"; `tm3d.js jogarPenaltis(o,
  fns)` (o mesmo `abre3d`, o pedido com `modo: "penaltis"` e sem `controle`; sem WebGL 2 avisa e não abre; os textos do quadro
  são os dele — `fns.textos`: "Sair dos pênaltis 3D?" / "A disputa não conta…" / "Sair" e "Voltar" no aviso de demora; os
  da partida prometiam "a partida é simulada" e nada era simulado). "Mais modos" com 10 atalhos: 10 numa linha no PC (≥ 1100
  px), 5 + 5 até 1099 px e, no celular (3 por linha), o que sobraria sozinho ocupa a última linha inteira.
- **Testes**: `teste-disputa` (Node, padrão: A regra — árbitro independente em 3000 sequências, casos, fila; B IA × IA até o fim
  em 24 sementes; C os lugares e a caminhada, C4 o goleiro na linha no chute; D a cobrança da IA ~73/12/15 em 32 disputas; E o
  humano roteirizado bate no canto do analógico e defende pelo lado escolhido, parado a IA bate por ele, E4 a cavadinha
  repetida; F determinismo e o resultado do TM; G o fim da cobrança — G1 a bola da trave que bate no goleiro e entra é gol,
  G2 nada conta depois do resultado e 'defesa' só com toque, G3 o goleiro batido e o chute para fora = 'fora'),
  `teste-penaltis-tela` (navegador, CI e deploy: PC com a demo até o fim, bolinhas, planos, faixa e "Jogar de novo"; celular
  pelo teclado com a câmera atrás do cobrador, só o CHUTE, nada encosta; "Modo de jogo"; `?tm` até o `tm3d:fim`) e
  `legacy-total-match/ferramentas/testar-penaltis.mjs` (ponta a ponta no site montado: menu, seletor, Viverde com a senha de
  `TM_SENHA_VIVERDE`, 3D, Simular o resto, resultado no TM, Jogar de novo, nada sobre nada).

## Cobrança mirada e câmera da bola parada (16/10; contrato)

Pedido do dono (com a imagem do EA FC): câmera "quase 1ª pessoa" atrás do cobrador nos escanteios, faltas, pênaltis e tiros
de meta; a linha da trajetória com mira, força e curva no escanteio e na falta. Pesquisa: PESQUISA-ETAPA4.md §12.

- **Quem**: só a PESSOA cobrando (partida.js `cobrar`, a entrada sem `ia`/`iaCobra`, `c.porHumano`) escanteio, tiro livre
  ou tiro de meta. A IA, a demo e o humano depois de `PARTIDA.cobrancaHumanoMax` (a IA cobra por ele) cobram como antes:
  a partida IA × IA não muda (`tools/hash-partida.mjs`: demo IGUAL; a cena "humano" muda a partir da 1ª bola parada dele).
- **Estado** (`mira.js`, puro): `m.parada.mira = {ang0, ang, curva, cone, rep}` criado no 1º tick da pessoa
  (`criarMira`: `ang0` = a direção do alvo padrão `alvoPadrao` — escanteio: a marca do pênalti; tiro livre direto a ≤
  `MIRA.distChute` m: o meio do gol; outro tiro livre: 30 m na direção do gol; tiro de meta: 35 m para a frente).
  `atualizarMira` a cada tick: o componente do analógico para o LADO de `ang0` gira a mira (`MIRA.gira` rad/s, até
  `cone[tipo]`); `BOTAO.EFEITO_E`/`EFEITO_D` (teclas Z/X, analógico direito do controle, botões CURVA do toque nas vagas d e e)
  passam a curva um degrau de `curvaPasso` (segurar repete a cada `curvaRepete` s), de −1 a +1 (+ = para a direita de quem
  bate); no tiro de meta a curva fica 0.
- **Tipo pelo botão** (`tipoMirado`): LANÇAMENTO = ALTA (E + LANÇAMENTO = TENSA); CHUTE = CHUTE no tiro livre direto a ≤
  `distChute` m, TENSA no resto; PASSE/ENFIADA = CURTA; tiro de meta = LONGA (sem botão: CURTA só com PASSE/ENFIADA). ALTA,
  TENSA e CHUTE têm a trajetória (`pedido.mirada = {tipo}`; o pedido vira `lancamento`/`chute`); CURTA e LONGA são o passe
  do jogo na direção da mira (`pedido.dir` → `j.miraAuto`). A cavadinha por dois toques segue a de sempre.
- **A conta** (`chuteMirado(m, j, pr, tipo, forca, ang, curva)` → `{v, w}`): ALTA/TENSA = elevação fixa
  (`MIRA.alta/tensa.elev`), velocidade na faixa pela força, o giro do cruzamento do jogo + o efeito (`wy = −curva × giro ×
  atributo`); CHUTE = a velocidade do chute do jogo (`ACOES.chute.v` × finalização), com o efeito por cima da falta
  (`giroFalta`) e a elevação que passa por cima da barreira (`BARREIRA.alturaPassar` na distância dela) ou que chega em
  `yAlvo` pela força. **A mesma conta** no chute de verdade (`acoes.js cobrancaMirada`) e na linha (`mira-linha.js
  preverMira` → `mira.js simularLinha`: `bola.js passoBola` passo a passo até a bola tocar o chão, bater em algo ou cruzar
  a linha de fundo; no CHUTE só até `linhaChute` m além da barreira). Por cima, o erro do cobrador (o do chute do jogo: finalização, distância,
  força no máximo, `faltaErro` com barreira; no cruzamento o do lançamento: passe longo, ±m a 40 m, em ângulo e em força)
  × `MIRA.erro` (os testes zeram). O ponto do voo (`m.voo.alvo`) e quem vai nela saem da trajetória prevista (cruzamento:
  onde desce a `yAlto`); `m.voo.mirada = true`.
- **Tela** (só lê o mundo; o hash não muda), em `render/bola-parada.js` + `mira-linha.js`, carregados **sob demanda**
  (main.js `carregarBP`, na 1ª bola morta de escanteio/tiro livre/tiro de meta/pênalti: fora do download inicial, que
  está no teto de 4 MB do `teste-carga` — sobram ~0,6 KB): a linha (uma fita virada para a câmera, miolo amarelo → azul e
  bordas escuras, desbotando no fim; mais apagada antes de carregar; 1 chamada de desenho; some no chute); o painel `#mira`
  (rótulo e trilho do efeito; Z/X só sem toque; o CSS dele vem no módulo; com ele o minimapa sai: `html.mira-visivel`);
  `html.cobranca-mirada` mostra os botões CURVA (e esconde PEGAR e TROCAR da bola na mão, das mesmas vagas).
- **Câmera da bola parada** (`render/bola-parada.js CAMERA_BOLA_PARADA`, `planoBolaParada`; a mistura em `render/camera.js`): no
  escanteio, tiro livre, tiro de meta e pênalti com o cobrador sendo o controlado do humano e no pênalti CONTRA (atrás do
  cobrador adversário). Lado: o que fica mais para dentro do campo (empate: à esquerda de quem bate). Nada sólido na lente
  (`estadio-forma.js solidoEm`, folga 0,4 m) nem jogador a < 1 m: chega para a frente e sobe. A mistura com a TV entra em
  `entra` s (o corte da montagem entra direto) e volta em `sai` s no chute (posição, direção do olhar e fov misturados:
  sem salto). Com ela o analógico vira mundo pelo rumo dela (`yawEntrada` = a direção bola → alvo padrão): direita da
  tela = direita de quem bate (no pênalti contra, o goleiro escolhe o lado pela tela).
- **Testes**: `teste-mira` (Node, padrão: A a bola = a linha a ≤ 3 cm; B curva para o lado certo; C controles, rótulos,
  a linha some no chute, tiro de meta; D o erro continua; E canhão do humano roteirizado, escanteio ≤ 12% e falta 2–12%;
  F a IA não usa) e `teste-bola-parada-tela` (navegador, CI: PC 1280×720 e celular 844×390 e 568×320 — o módulo fora do
  download inicial, câmera atrás do
  cobrador nos 4 tipos e no pênalti contra, cobrador e alvo no quadro, nada na lente, a linha ≥ 150 px e ≤ +1 chamada,
  some no chute, a volta para a TV sem salto, teclado e botões CURVA).

## Modo Livre — o treino N contra M (16/10; contrato)
Pedido do dono (16/10): "adicione tbm um modo livre, como no fifa, um modo de treino, onde pode ter a quantidade de jogadores
que eu escolher, contra a quantidade de jogadores que eu escolher, pode ser adaptável durante a partida" (a Arena de Treino do
EA FC). `?modo=livre` (sem `?tm`: Golaço FC × Ventania FC), "Modo Livre <small>N contra M</small>" no "Modo de jogo" da pausa
(linha própria; os dois treinos numa `.linha-cenas`: o submenu segue com 5 linhas) e, com `?tm`, o pedido com `modo: "livre"`.
**Sem o Livre nada muda**: `hash-partida`/`hash-igual` IGUAIS contra a base; `livre.js` e `livre-pagina.js` só por import
dinâmico (o download inicial do teste-carga cresce ~7,7 KB, só dos ganchos; 3,99 MB).
- **`livre.js`** (puro; constantes `config.js LIVRE`, o porquê de cada número no cabeçalho do arquivo). O mundo é o da
  partida (`criarPartida`, sem a trava; o relógio com `LIVRE.relogioMin` minutos por tempo: nunca acaba) com `m.modo =
  'livre'` e `m.livre = {linha: [a, b], goleiro: [g0, g1], fora: {id: jogador guardado}, ajustes, pressao: [da tática]}`,
  FORA do `hashMundo`. A escolha por time: 0 a 10 de linha (o time do humano ≥ 1) e o goleiro à parte (11 sem goleiro não
  existe: as formações têm 10 vagas de linha); o número da pausa é o TOTAL (linha + goleiro).
  - Quem está fora fica na vaga como buraco (`m.times[t].expulsos`, o mesmo da expulsão) e guardado em `m.livre.fora`; os de
    linha ocupam sempre as vagas de maior prioridade (`prioridadeVagas(formacao)` por `LIVRE.prioridade`: 4-3-3 → ZE, ATA, VOL,
    PE, ZD, PD, MCE, LE, LD, MCD — o PE antes do 2º zagueiro, medido); todo jogador em campo tem vaga válida.
  - `criarLivre({semente, elencos, times, humano, linha, goleiro, log})`, `ajustarJogadores(m, escolha)` (sem recomeçar: quem
    fica não se mexe; quem sai = a vaga de menor prioridade, `LIVRE.saidaDist` m mais longe da bola valendo uma posição, nunca
    o controlado — a bola dele fica solta onde estava, a mão do goleiro solta, o controle passa; quem entra = um jogador novo
    da vaga, `teleportar`ado no ponto tático dela juntado como o da IA, a ≥ `LIVRE.afastar` m de todos; com a bola parada
    montada, ela é montada de novo — a cobrança mirada da pessoa (#490) com o cobrador ainda em campo guarda a mira e a curva
    e é montada já no passo seguinte, sem o 1 s da bola fora: a câmera atrás do cobrador e a linha não somem; evento
    `livreAjuste {linha, goleiro, saiu, entrou}`), `recomecarLivre(m, 'meio' | 'pe')`
    (saída do time do humano | a bola no pé do controlado; o placar fica), `passoLivre(m, entrada, acoes)` (as ações-objeto
    `{tipo: 'livreAjuste', linha, goleiro}` e `{tipo: 'livreRecomecar', onde}` ANTES do passo, gravadas em `m.log`, e o
    `passoPartida`), `entradaDemoLivre`, `normalizarEscolha`, `escolhaDoMundo`, `resumoLivre`.
  - Regras: as da partida com os ramos de `m.livre` — sem impedimento (`impedimento.js regraImpedimento`; nem na IA:
    a linha `A.linha` do `ia-ataque.js` deixa de ser o penúltimo adversário e fica a `LIVRE.linhaSemDefesa` m da linha de
    fundo (ou na bola), só como a forma — o centroavante espera na entrada da área; `tetoLinha`: ninguém fica preso atrás da
    defesa nem volta com pressa por estar à frente dela, a corrida não acaba por isso e o passe para quem está lá vale.
    Antes a linha só mudava com menos de 2 adversários e o Livre 11 × 11 jogava como a partida: à frente da defesa, voltando
    ~40% do tempo e 1,3% dos passes; agora ~3% e ~5%, `teste-livre` G),
    sem faltas nem cartões (`faltas.js`, `defesa.js`: o bote da IA decide pelo MESMO sorteio da partida — #481 — e o que seria
    falta ou "tirou o corpo" vira `BOTE_SEM_GANHAR`, contato sem apito com o condutor seguindo; o limpo rouba; a DIVIDIDA do
    humano que seria falta segue sem falta; `teste-livre` H), sem relógio nem intervalo. Gol vale; a saída é do time que sofreu se ele
    tiver alguém de linha, senão do outro (`partida.js montarSaida` + `temLinha`); bola fora pela partida quando quem cobra tem
    alguém de linha (o tiro de meta pelo goleiro dele vale), senão a cobrança passa ao outro (`cobrancaSemLinha`: escanteio ↔
    tiro de meta, lateral e tiro livre no mesmo ponto). As regras do goleiro continuam. O único de linha do time que cobrou toca
    de novo (`m.cobrou` limpo; senão a bola ficava parada para sempre no 1 contra 0).
  - IA: as referências das vagas ocupadas juntas perto da bola com poucos de linha (`comprimirLivre`, `LIVRE.compressao`) e a
    pressão Alta com até `LIVRE.pressaoAlta` de linha (jogo reduzido; acima, a tática do time).
  - Ganchos (`partida.js ganchosLivre = {cobranca, comprimir}`): o `livre.js` os liga ao ser carregado; a partida e a IA só os
    chamam com `m.livre` (`regrasPartida` na montagem da bola parada; `ia-tatica.js referencias`).
- **`livre-pagina.js`** (DOM, import dinâmico com o `livre.js`): `criarPaginaLivre({hud, logica, mundo, timeHumano,
  pedidoLivre, comando, acao, soltar})` — a escolha na visão do humano ([meu, adversário]; salva em `localStorage
  golaco.livre.v1`, em try/catch; com `?tm`, o `livre` do pedido como valor inicial), a pausa MÍNIMA posta no DOM na 1ª vez
  (os botões `data-so="livre"` "Jogadores <small>N contra M</small>" e "Recomeçar <small>bola no meio</small> | Bola no meu pé";
  o submenu `#menu-livre`: Voltar, "Meu time − N + [Goleiro]", "Adversário − M + [Goleiro]", Jogar) e a fila da mudança (a
  ação-objeto entra no 1º passo depois da pausa, como a edição do time). A pausa do Livre (HTML e CSS postos na 1ª vez, ≤ 5
  linhas, sem rolar em 844×390): Continuar | Replay; Jogadores | Câmera (`.linha-cenas`); Recomeçar <small>bola no meio</small>
  | Bola no meu pé; Modo de jogo (com `?tm`, "Voltar ao Total Match"); Ajuda — sem Editar time nem Reiniciar. Submenus
  `.submenu-livre` (o hud.js os fecha e o "voltar" do controle sai deles): `#menu-livre` (Jogadores) e `#menu-camera-livre`
  (as 6 câmeras em 2 linhas de 3, "Altura − N +", "Distância − N +"); na coluna das opções o segmentado TV | Aproximada dá
  lugar ao botão `#opcao-camera-livre` com o nome da câmera (abre o submenu; `html.em-livre`). Cara do TM em `css/tm.css`.
- **Câmeras do Livre** (`render/camera-livre.js`, carregado pelo `livre-pagina.js`: fora do download sem o Livre). As do EA FC
  (fifplay.com/fc-25-camera-settings, fifauteam.com/fc-26-camera): TV e Aproximada (as de hoje), Ampla (Co-op: 62 m de largura
  no foco, 24 m de altura, 46 m atrás), Alta (Tactical: 52 m de altura, 24 m atrás, 65°, 76 m de largura), Atrás (End to End:
  19 m atrás do foco pelo comprimento, 9,5 m de altura, olhando 12 m adiante, fov 42°) e Jogador (Pro: 7,5 m atrás e 3,9 m
  acima do controlado, olhando 7 m adiante no chão: ele a ~3/4 da altura do quadro, fov 48°); Altura e Distância 0–20 (10 = o perfil; 0 = 0,6×, 20 = 1,5×; a
  Distância abre o plano junto). `render/camera.js` ganhou só o gancho: `definirExtra(x)` (x.atualizar roda DEPOIS de
  posicionar a câmera de jogo, fora da câmera do gol, de cinema, do plano geral e da livre dos prints), `yaw` = o do extra,
  `definirModo` aceita os modos dele e `foco()` o dele — sem o Livre o extra é null e nada muda. A bola parada do humano
  (#490, `render/bola-parada.js`) vale também no Livre: o plano dela é misturado DEPOIS do extra (`misturarBP`, a mesma mola,
  entrada e saída da partida) — antes a câmera do Livre cobria o plano e o analógico girava pelo `bp.yaw` de uma câmera
  escondida (a mira descia na tela em vez de ir para o lado; `teste-livre-tela` H1). Rumo: as de lado em −π/2; Atrás
  e Jogador com o rumo FIXO do ataque do time do humano (`m.ataca`, 0 ou π) — o `yawEntrada` do main.js lê `cam.yaw`:
  analógico para cima = para o gol que eu ataco. Troca com o mesmo rumo: transição de 0,6 s; rumo diferente: corte. Limites
  (`segurarPose`): de lado, perto do lado de cá a câmera fica dentro da caixa da arquibancada de cá (y ≤ 26, z ≤ 70: ela sai do
  desenho) ou na frente dela (z ≤ 43,5) — saindo da caixa, ela anda pela reta até o ponto olhado e o plano abre na mesma conta
  (contínua: a borda mais perto pulava até 14 m num quadro); Atrás/Jogador antes das placas do fundo (|x| ≤ 58); Jogador
  ≥ 3,2 m de altura; depois sobe até sair de qualquer sólido (`estadio-forma.js solidoEm`). Enquadramento (`enquadrar`, em
  todas as 6): a bola e o controlado (pés e cabeça) dentro de `QUADRO` (|x| ≤ 0,92, y de −0,7 — acima do minimapa do PC — a
  0,9); fora disso o ponto olhado anda para eles o mínimo que basta (Atrás perto do meu gol, a Distância baixa nas bordas);
  os limites do foco de Ampla/Alta encolhem com a Distância (`limitesLateral`). Jogador: a troca de controlado para longe
  (o alvo pula > 3 m e fica a > 8 m do foco: `CORTE_JOGADOR`) corta. Os cantos do lado de cá (`render/cantos-livre.js`,
  só no Livre, pelo `livre-pagina.js`): o degrau de `FORA.canto` e as paredes de trás com o material dos fundos do jogo
  (Atrás e Jogador olham pelo comprimento e mostravam o vão: céu, o chão de fora, o mastro); +1 chamada, 152 triângulos. Prefs da página (`golaco.prefs.v1`): `cameraLivre` e
  `cameraAjuste {altura, distancia}`; a da partida (`camera`) não muda e volta ao sair do Livre. C/R3 no Livre = a próxima
  das 6 (aviso de comando "Câmera: <nome>"). `?camera=<uma das 6>` abre o Livre nela. Na partida, nos treinos e nos pênaltis
  nada muda. `__golaco.livre.cameras` (os nomes), `.camera` ({modo, anterior, transicao, yaw, dir, fa, fd, altura,
  distancia}), `.ajustarCamera({altura, distancia})`; `__golaco.definirCamera(nome)` vale para as 6 no Livre. Custo no celular Média
  (ao vivo, 300 quadros, 5 contra 5): TV 26–33 chamadas e 66 mil triângulos, Ampla 25–32 e 69 mil, Alta 24–30 e 56 mil, Atrás
  24–36 (quase sempre 29–31: o lado de cá entra no quadro) e 82 mil (máx. 92 mil), Jogador 24–35 e 78 mil; a TV da partida 11
  × 11 fica em 26–29 e 94 mil (máx. 100 mil): triângulos sempre abaixo dela, chamadas ≤ o teto do pré-jogo (40).
- **`main.js` / `hud.js` / `index.html`**: `MODOS` com 'livre'; `LIVRE_TM` (pedido `modo: "livre"`: sem trava; "Voltar ao Total
  Match" sempre na pausa, sem "Simular o resto" nem "Modo de jogo", e manda `tm3d:fim` com `{livre: {placar: [casa, fora]}}`
  — o TM não conta em nada); entrando no Livre a pausa abre no submenu Jogadores (nunca com `?prints=1`/`?demo=1`); o placar
  de TV sem o relógio; R = a bola no pé; `data-so="livre"` e `em-livre`; Replay da pausa vale; Editar time escondido.
  `window.__golaco.livre = {escolha(), ajustar({linha: [a, b], goleiro: [g0, g1]}) (índices dos TIMES; entra no próximo
  passo), recomecar('meio' | 'pe'), naFila}`. R / "Bola no meu pé" no meio do gol (evento `recomeco` com `livre`) descarta o
  replay daquele gol (`diretor.descartarGol`): nem toca, nem fica para a próxima saída sem gol (`teste-livre-tela` H3).
- **Pedido do TM**: `livre: {linha: [casa, fora], goleiro: [casa, fora]}` (opcional; os índices dos times do pedido).
- **Testes**: `teste-livre` (Node, padrão): A montagem N × M nas bordas e sorteadas, B mudar no meio do jogo (bola no pé de quem
  sai, controlado, goleiro com a bola nas mãos, bola parada montada), C IA × IA de 2 min (3×3 e 5×5 com os goleiros, 20
  sementes — as trocas do 3×3 variam ~2,8 por semente: sem o impedimento na IA, 6,7 nas 20 do teste e 6,6 em 60 (antes
  7,2) —: posse troca com a bola rolando média ≥ 6, chutes ≥ 2, ≤ 10% do tempo dos de linha a > 40 m da bola; 1×0 sem
  goleiros: chutes e distância), D recomeços com um time sem ninguém de linha, E determinismo e nada vaza para a partida, F o
  goleiro sozinho no canhão do teste-goleiro = o da partida, G sem impedimento na IA (Livre 11 × 11: quem está à frente da
  defesa adversária não volta por isso — ≤ 15% voltando, antes 43% — e recebe o passe — ≥ 2%, antes 0,9%), H o bote da IA
  pela régua da partida (o mesmo estado do gerador com e sem `m.livre`: limpo = roubada, o resto = sem ganhar, 0 faltas;
  antes todo bote no sorteio roubava). B2 aceita o goleiro controlado (cobrando um tiro de meta): fica em campo e controlado.
  `teste-livre-tela` (navegador, CI e deploy): A a varredura das poses em Node (as 6 câmeras × Altura/Distância × 3 telas × 2
  rumos × focos na borda + transições: fora de sólido, sem arquibancada na frente do campo; a contraprova sem os limites
  reprova; A3 a câmera não pula — ≤ 0,6 m com o foco andando 0,05 m, o limite antigo pulava 14 m —, A4 a bola e o controlado
  no quadro nas bordas do campo nos dois rumos — antes 1632 de 6600 fora —, A5 o corte do Jogador), B as 6 câmeras pela pausa
  no PC Alta de dia (a bola e o controlado no quadro, os pontos do gramado à vista com cor de grama; B0b nada cortado na pausa;
  B2 os cantos — céu em Atrás/Jogador 2,1–2,3% da tela → ~0%; B3 a bola no pé na pequena área e nos cantos do meu gol), C a tecla C, o rumo do analógico, transição × corte, Altura/Distância salvas e de volta na partida, D a pausa e
  os submenus sem rolar no celular 844×390 e as 6 câmeras de noite, E 568×320 sem nada encostando, F `?tm`, H a junção com a
  main: H1 a bola parada do humano (TV, Alta, Atrás) com a câmera atrás do cobrador e a "direita" levando a mira para a
  direita na tela, e a volta à câmera do Livre sem salto; H2 mudar os jogadores na pausa no meio da cobrança mirada sem perder
  a mira nem a câmera; H3 R no meio do gol sem replay pendente.

## Online 1×1 — duas pessoas, cada uma no seu aparelho (16/10; contrato)
Pedido do dono (16/10): "implementar esse novo golaço, no modo online, para que duas pessoas consigam jogar uma contra a
outra". A partida 11×11 de hoje, cada pessoa controlando um time no seu aparelho, por TROCA DE ENTRADAS (lockstep com
atraso de entrada: o mundo é o mesmo nos dois porque a simulação é determinística e só as entradas viajam). Entrada só no
Total Match (Mais modos → "Online 3D"; o golaco não ganha entrada de menu). O plano inteiro (netcode, formato na rede,
transporte, sala, esperas, desconexão, etapas) está no contrato do online da sessão; aqui ficam as peças do golaco, na
ordem das etapas. **Fora do online nada muda**: `hash-partida`/`hash-igual` IGUAIS em toda etapa.

### Etapa 0 — determinismo blindado
Dois aparelhos de motores diferentes (V8 de outra versão, SpiderMonkey, JavaScriptCore) têm de chegar ao MESMO mundo
com as mesmas entradas. As funções de Math que o IEEE 754 não obriga a darem o mesmo resultado (sin, cos, tan, asin, acos,
atan, atan2, exp, expm1, log*, pow, hypot, cbrt e as hiperbólicas) variam no último bit entre eles; a lógica já usava o MD
(`matdet.js`, fdlibm), mas sobravam:
- **`anim.js`** (pesEQuadril, pose, poseMergulho): a pose ENTRA na simulação — `sim.js` guarda `j.quadril =
  alturaQuadril(j, m)` a cada passo, a cabeça desenhada decide o cabeceio (`cabecaNaBola`) e o goleiro parte de `j.quadril`
  no mergulho (`goleiro.js`). Tudo pelo MD agora (44 chamadas). Medido antes (relatório do online, `sensibilidade-math`):
  com Math de outro motor, `j.quadril` diferia a partir do tick 26 (o hash ficou igual em 4 × 30 mil ticks por sorte da
  amostra, não por garantia).
- **`tm-times.js`** (custo do húngaro das vagas do pedido do TM): `MD.hypot` — um empate de ulp trocaria a vaga de um
  jogador num aparelho só.
- **`**`** (não dá para instrumentar): `anim.js` e `cabeceio.js` trocaram `a ** 2` por `a * a` (o mesmo valor no V8, que
  calcula `x ** 2` como `x * x`).
- **`.sort(`** com comparador total (o resultado de um comparador inconsistente — empate que devolve 1 dos dois lados, NaN —
  depende do algoritmo de cada motor): `partida.js` (porVaga, + desempate pelo id) e `escalacao.js` (as vagas vazias dos
  expulsos, + desempate pela ordem das vagas na formação: a mesma ordem do sort estável de antes). Os outros 9 da lógica já
  desempatavam pelo id.
- O que é LOCAL nunca entra no passo: yaw da câmera (`controle.js paraMundo` converte o analógico antes de quantizar),
  preferências, qps, `m.timeHumano` (fora do hash; o caminho de 2 humanos não o lê).
- Hash: `hash-partida --ref aeb1c685` (4 sementes × 2 cenas × 2 min por tempo; e 8 × 2 × 4 min, a partida inteira: 1568
  hashes) e `hash-igual --ref aeb1c685` (20 sementes × 3 min) IGUAIS — no V8 o MD e o Math dão o mesmo `j.quadril` quase
  sempre e a diferença de ulp que sobra não mudou nenhuma decisão nessas partidas (não é garantia de hash igual em toda
  partida: a etapa 0 podia mudá-lo, e uma partida que divergisse seria só a base nova).
- **Teste `teste-math-proibido`** (Node, padrão): (A) troca as funções proibidas de Math, `Math.random`, `Date.now` e
  `performance.now` por versões que contam, ANTES de importar a lógica, e conta só dentro da janela do passo (os times do
  pedido do TM, `criarPartida`, `passoPartida` com uma edição de cada time e a `entradaDemoPartida` do bit IA): partida
  inteira com 2 humanos, 2 sementes (a 2ª com os times de um pedido do TM), analógico e botões sorteados e quantizados a
  1/1024 — meta 0 chamadas (na base: 5,4 milhões em 2 × 2 min); (B) o TEXTO de todo módulo do grafo de imports de
  `partida.js` e `tm-times.js` (31 módulos; pega os caminhos que as partidas não visitaram, como o pênalti) sem função
  proibida, relógio nem `**` fora dos comentários — meta 0 linhas (na base: 13); (C) todo `.sort(` com comparador dentro do
  passo sai estritamente ordenado nos dois sentidos (empate só entre valores idênticos). `--onde` lista de onde vêm as
  chamadas; `--sementes N --min M` encurta.

### Etapa 1 — dois humanos na lógica
- `criarPartida({humanos: [0, 1], humano: <o MEU lado>})`: os dois times controlados por pessoas. Cada time humano começa
  com o MESMO controlado que teria sozinho (o cobrador da saída; o outro, quem a montagem da saída escolhe). `m.trava` só
  vale com 1 humano. `m.timeHumano` = o meu lado (fora do hash; o caminho de 2 humanos não o lê). Sem a opção:
  `[humano]`, bit a bit como antes.
- `passoPartida(m, {0: e0, 1: e1}, acoes)` com 2 humanos: a entrada de cada time vai só para o controlado dele; a bola
  parada é cobrada pela entrada do time do COBRADOR (`cobrar(m, entradas[c.time])`). Com 1 humano, `entrada` continua
  sendo a do time do humano.
- `entradaDemoPartida(m, time = m.timeHumano)`: a IA joga pelo controlado daquele time (o bit IA do online: menu/editor
  aberto, ausência). Escreve no mundo (`j.ia`, `j.iaT`): no online roda DENTRO do passo, nos dois aparelhos, no mesmo
  ponto (time 0 antes do 1). `m.iaJoga[t]` segue a marca `ia` da entrada de cada time.
- Já era por time (nada mudou): troca, TROCAR/GOLEIRO/PRESSÃO, a assistência de recepção, a marcação do controlado.
- **Teste `teste-dois-humanos`** (Node, padrão): A cada cobrança (saída, lateral, escanteio, tiro de meta, tiro livre,
  pênalti, dos dois times) sai pelo humano DAQUELE time, com o outro apertando sem parar (48/48), e ninguém cobra pelo
  humano parado antes do prazo (48/48); B a entrada de um time nunca muda o que o controlado do outro e o time dele
  recebem (o mesmo passo de novo com a entrada do outro trocada; os outros jogadores são IA e reagem ao mundo, que muda
  de verdade com a jogada do outro: 0 de 3.996); C TROCAR/GOLEIRO/PRESSÃO de cada um só no time dele; D o bit IA (m.iaJoga
  e IA × humano até o fim); E criarPartida e o caminho de 1 humano bit a bit. `hash-partida`/`hash-igual` IGUAIS.

### Etapa 2 — a sessão de troca de entradas (`js/online.js`, puro)
- **Lockstep com atraso de entrada D** (3–10 passos; o rollback ficou fora: medido, não cabe no celular e quebraria som,
  "GOL!", comemoração e replay). O passo n só roda com as DUAS entradas de n; a minha lida agora vale para n + D. Os D
  primeiros passos são neutros (vão e voltam como os outros). Cada lado decide o PRÓPRIO D (cada entrada leva o passo
  dela: não precisa combinar) e ele só SOBE (`ajustarAtraso`, pelo RTT p95 e pelos 30 qps de qualquer um; subir k =
  produzir já k entradas repetindo a última, sem a AÇÃO).
- **Tudo que é local sincroniza sozinho:** pausa, replay, comemoração, editor aberto — quem está nelas não roda passo nem
  produz entrada, e o outro PARA esperando (sem mensagem nenhuma). Do gol até a saída as entradas valem neutras nos dois
  (`passoOnline`: a cena é local, a regra não). Menu aberto sem parar = bit IA: a IA joga pelo meu controlado DENTRO do
  passo, nos dois (time 0 antes do 1: ela escreve na memória da IA).
- **Formato:** 6 bytes por entrada (x e z ±1024 em 12 bits, botões 15 bits + `repete`, bits IA e AÇÃO); a entrada LOCAL
  passa pela mesma codificação antes da simulação (`quantizada`). Pacote do canal 'jogo' com todas as entradas não
  confirmadas (até 16), o ack, o passo atual e o eco do relógio (RTT); inválido = descartado.
- **Relógio:** quem fica à frente (média de ~0,5 s da vantagem > 1 passo) roda 1 passo a menos no quadro
  (`passosDoQuadro`, como a vantagem de quadro do GGPO); parado esperando o outro, o tempo parado NÃO é recuperado
  depois (correr para alcançar gasta a folga do D e vira outra parada).
- **Ações** (a edição do time): marcadas na entrada do passo (bit AÇÃO) e mandadas pelo canal confiável; quem recebe
  espera a ação antes de rodar aquele passo; a de time trocado é recusada.
- **Dessincronia:** `hashMundo` a cada 60 passos pelo canal de controle; a 1ª diferença acusa (`s.dessinc`).
- **Conexão para a tela:** `estadoConexao` — 'instavel' sem pacote há 0,75 s, 'aguardando' parado ou sem pacote há 5 s.
- **Teste `teste-online`** (Node, padrão; `tools/lib/rede-memoria.mjs`): O1 formato (100 mil + extremos; pacotes
  inválidos), O2 o mesmo jogo nos dois = a referência sem rede em 5 redes (15±10; 40±20 com 2% de perda; 80±40 com 5%;
  B a 30 qps com relógio 0,5% mais rápido; 10% duplicados + degrau 20→120→20 ms + rajada de 300 ms), com replays locais,
  menu (bit IA) e edições dos dois lados: 0 diferenças; O3 ≤ 1 parada a cada 10 s fora dos replays (medido 0,17–0,33);
  O7 edições aplicadas nos dois, a de time trocado recusada; O9 ausência de 20 s ("aguardando" em 5,0 s, jogo igual
  depois); O10 dessincronia acusada nos dois em ≤ 64 passos; O12 ~15 µs por quadro, ~10 KB/s por sentido.

### Etapa 3 — o online na página (`js/online-pagina.js` + `main.js quadroOnline`)
- Liga com o pedido do TM `modo: "online"` (`online: {sala, semente, nomes, D0, proto, lado}`; a semente é a do
  anfitrião) ou, nos testes, `?online=<sala>&transporte=bc&lado=0|1` (duas abas pelo BroadcastChannel; `&ia=1` = a IA pelo
  meu controlado o tempo todo). `online.js` e `online-pagina.js` só por import dinâmico (o download inicial cresce só o
  gancho no `main.js`/`hud.js`).
- Transporte: a MessagePort que o TM entrega em resposta ao 'tm3d:pronto' ({tipo: 'tm3d:porta'}; protocolo no topo de
  `legacy-total-match/js/online3d.js`, seção 5) — {t:'j', b} pacote, {t:'c', m} controle ('acao', 'hash', 'pausa',
  'retoma', 'abandono'), {t:'estado'} da ligação; {t:'religar'} depois de 5 s sem nada.
- `quadroOnline`: só roda o passo com as duas entradas; o MEU replay, a comemoração, a minha pausa e o celular em pé
  seguram só a minha simulação (o outro espera e mostra "Aguardando <nome>…"); menu, Ajuda e o editor abertos NÃO param
  (`pausado()` do online) — a minha entrada vai com o bit IA. A edição do MEU time vira AÇÃO (canal confiável). O hash a
  cada 60 passos; um pacote por quadro (também no pré-jogo, o curto no online).
- Avisos (`#online-aviso`, no meio da tela; `#online-selo` "Conexão instável"): "Aguardando <nome>…", "Pausado por
  <nome> · 0:52", "Você pausou" com "Continuar a partida" e a contagem de 3 s, "<nome> saiu da partida. Vitória por W.O.",
  W.O. oferecido (não automático) depois de 90 s sem nada do outro ("Esperar mais" adia 60 s), dessincronia ("Os dois
  aparelhos ficaram diferentes por um erro do jogo… nada conta").
- Pausa do online: "Pausar a partida" (3 por jogador, até 60 s cada; só quem pausou retoma) e "Sair da partida" (dois
  toques; 'abandono' ao outro e 'tm3d:sair' {abandono: true} ao TM = derrota); sem Replay da pausa, Simular o resto,
  Reiniciar, Modo de jogo/Cenas e a cena de substituição (seguraria a simulação de um lado só). Fim: 'tm3d:fim'
  {resultado (a súmula: a mesma nos dois), online: {hashFinal | wo: {vencedor, motivo} | dessinc}} (`fimTM(resultado, extra)`).
- **Teste `teste-online-tela`** (navegador, CI e deploy): duas abas do mesmo Chromium jogando a mesma partida (IA nos dois
  lados): P1 andam, P2 os hashes iguais (0 de 12), P3 a pausa de A para os dois, B mostra "Pausado por", depois seguem
  iguais, P4 o menu aberto não para, P5 a partida inteira (?min=0.25) acaba igual nas duas (0 de 36), P6 a pausa do online
  em 844×390 sem rolar, 0 erros. (O Chromium sem GPU daqui desenha ~6 quadros/s com duas abas: o teste espera passos, não
  tempo.)

## Corpo humano realista — Etapa 5.1 (22/10; contrato)

SÓ DESENHO, por cima da simulação: nenhum arquivo do fecho do hash muda (`tools/fecho-hash.mjs --diff origin/main` = 0;
o fecho tem 37 módulos e inclui a `config.js` e a `comemoracao.js`). Atrás de `?corpo=humano` (o padrão continua o
manequim) até o rosto de cada jogador chegar.

- **Assets** (`assets/jogador/`, gerados por `tools/humano/`, ver o README): `corpo.json` (o índice: 25 ossos, o
  `repouso`, os 4 LODs com caixa/blocos e o sha256 do `.bin`) + `corpo.bin` (por LOD e parte — corpo, cabeça: posição
  int16 na caixa, normal int8, UV uint16, 4 ossos uint8, 4 pesos uint8 com soma 255, índices uint16); `regioes.png` (512²,
  um canal: 0 pele · 1 camisa · 2 manga · 3 gola · 4 punho · 5 calção · 6 barra · 7 meião · 8 chuteira · 9 sola ·
  10 acabamento) e `regioes.json` (a caixa da UV do número das costas, na imagem: y para baixo); `pano-normal.webp`;
  `cabeca-rb.webp`. LODs: 8.146 / 4.000 / 1.798 / 899 triângulos por boneco.
- **`repouso`** = as juntas do JOGO em pé (x frente, y cima, z direita; o tornozelo apoiado a 8 cm, o pé a 17,9°) +
  `queda` (0,045) e `abre` (0,012) do ombro do desenho + `sobeTornozelo` (0,035) + `braco`/`antebraco` (0,2865/0,2577).
- **`js/render/esqueleto.js`** (puro): `criarEsqueleto(repouso)` → `pele(pose, out, off)` escreve as matrizes de PELE
  (3×4 por linhas, 12 floats por osso) dos 25 ossos (`OSSOS`, `NOMES_OSSOS`: 19 + 6 ajudantes de meio-giro). Juntas do
  desenho (`juntasDesenho`): o ombro `queda·elevação` abaixo e `abre` para fora no referencial do peito (elevação 1 com o
  braço solto, 0 erguido), o cotovelo pela IK com a MÃO do jogo (as luvas na bola), o tornozelo preso ao pé (referencial da
  sola: o pé apoiado não sai do lugar quando a canela inclina). A torção da coxa sai das juntas do JOGO; o pé é rígido (sem
  escala). Escala ao longo do osso em [0,9; 1,1]. `peleVertice` = a mesma pele linear do shader (testes).
- **`js/render/lod-humano.js`** (puro): `escolherLods(est, n, itens, tri, teto)` → o nível de cada boneco pela altura em
  px reais (≥ 280 / 120 / 60), histerese de 10%, ≤ 2 na LOD0, ≤ 3 níveis com gente, teto de triângulos (Baixa 30 mil,
  Média 60 mil, Alta 120 mil; os mais baixos na tela descem primeiro).
- **`js/render/humano3d.js`** (sob demanda): um `Mesh` com `InstancedBufferGeometry` por LOD (`iSlot` por instância); as
  matrizes de pele numa `DataTexture` RGBA32F (75 texels × 1 linha por boneco) e o uniforme noutra (16 texels: camisa,
  2ª cor, manga, gola, punho, calção, barra, meião, chuteira, acabamento, luva, pele, padrão [tipo, n, largura, manga com
  padrão], estado [goleiro, treinador, número], cor do número, sola). Padrões pela posição de REPOUSO: 0 liso, 1 listras
  verticais, 2 aros, 3 faixa diagonal, 4 faixa no peito, 5 metades. Goleiro: manga comprida e luva; treinador: manga
  comprida e calça. `OCULTA` (1ª pessoa): escala 0 em volta da junta (cabeça no pescoço; tronco e braços no peito).
- **Fachada** `js/render/jogador3d.js`: `criarJogadores3D(cena, q, {corpo: 'humano'})` — o manequim desenha até o corpo
  chegar (e se falhar); com ele, as cápsulas ficam em 0 e a mancha de contato e as marcas continuam do manequim. Os
  uniformes dos KITS (e `definirKits` do TM) aceitam também `gola`, `punho`, `barra`, `numero`, `padraoN`, `padraoLargura`,
  `mangaPadrao` e os nomes de padrão da pesquisa (`listras_verticais`, `listras_horizontais`, `faixa_diagonal`,
  `faixa_horizontal_peito`, `metades`). `__golaco.estadio.corpo` = {pedido, pronto, erro, triangulos, niveis, bonecos}.
- **Postura do desenho** (dono, 22/10: "os jogadores parecem meio curvados, estranhos"): a pose do jogo dobra o joelho
  ~42° parado (a altura do quadril é da simulação), inclina o tronco ~22° correndo e a cabeça ~30°. `pele(pose, out, off,
  v, peso)` passa antes por `postura(pose, v, peso, out)` (exportada, com `POSTURA`): o quadril e tudo acima sobem até
  6,5 cm com os PÉS no lugar (o joelho refeito pela IK com as medidas do jogo, nenhum abaixo de 10° de dobra), inteiro até
  2,4 m/s e nada a partir de 5,6 m/s (a corrida fica a do jogo); a inclinação do tronco acima de 9° cai 55% (em volta da
  pelve); a cabeça que cai à frente do tronco acima de 17° cai 60%. Nada no ar (tornozelo mais baixo ≥ 0,13–0,22 m), deitado
  (tronco ≥ 32–48°) nem ajoelhado (joelho a < 0,22–0,32 m do chão ou dobrado ≥ 65–85°); com as DUAS mãos a < 0,30–0,45 m
  (a bola nas mãos do goleiro e do lateral) elas ficam onde o jogo as pôs — senão o braço vai junto, rígido. `v` = a
  velocidade do boneco em m/s (`main.js` pelos dois últimos passos, o anel do replay pelos passos gravados, a comemoração e
  a substituição pelos atores; sem ela, 1,5); `peso` 1 (o goleiro 0,4: a base de espera dele é dobrada de verdade). O
  repouso não muda. Medido nas partidas: joelho parado 38–42° → 10°, tronco correndo 22–24° → 15–17°, cabeça 30° → 23°.
- **Testes**: `teste-ossos` (Node: juntas ≤ 1 mm, saltos ≤ 0,03%, sola 0–1,5 cm em ≥ 95% do apoio, volume ≥ 85% a 90°,
  assets, O7 postura: joelho parado ≤ 20°, disparada muda ≤ 3°, tronco correndo ≤ 17°, nada no ar/mãos juntas/pés), `teste-lod-humano` (Node), `teste-corpo-tela` (navegador, CI: todos desenhados, chamadas ≤ manequim + 1, teto
  de triângulos, nada baixado sem `?corpo=humano`, 0 erro).

## Rostos reais — Etapa 5.2 (22/10; contrato)

A versão de TESTE com os jogadores reais: a edição **pro** do Total Match (`pedido.edicao === 'pro'`, trancada por chave
no TM), com o corpo humano. SÓ DESENHO: o fecho do hash não muda. Na edição pública e sem o TM nada é pedido. Uma liga
por PR (a 1ª: o Brasileirão, `br`).

- **Assets** (`assets/rostos-reais/`, gerados por `tools/rostos-reais/`, ver o README):
  - `<liga>.json`: o índice `{chave: {nome, pele '#rrggbb', foto: {titulo, data, autor, licenca, pagina, av, id}}}`.
    A chave é `<liga>-<clube>__<jogador>`, o nome da foto do jogador no TM (`legacy-total-match/assets/jogadores/`).
    O `av` guarda a pose e a expressão da foto (MediaPipe) e o `id` o cosseno do SFace contra a foto do TM.
  - `<liga>/<chave>.webp`: a textura da cabeça do Rocketbox (UV dela, 512², a linha 0 em cima).
  - `CREDITOS-<liga>.md`: autor, licença e página de cada foto. A textura é obra derivada, na licença da foto.
- **`main.js ligarRostosReais()`** (só com o TM, `corpo=humano` e a edição pro):
  - baixa os índices de `LIGAS_ROSTOS`;
  - monta o perfil de cada jogador do pedido (`TM.mapa[id]` → o jogador do pedido → a chave
    `<liga>-${slug(clube)}__${slug(nomeCompleto || name)}`);
  - entrega tudo em `jog3d.definirPerfis(perfil, {indice, base, ligaDe})`.
- **`render/humano3d.js`**:
  - os rostos ficam numa `DataArrayTexture`, `CAMADAS` 40, de `LADO_R` 512 na Alta e 256 nas outras qualidades;
  - `camadaDe(chave)` pede a textura na 1ª vez que o jogador é desenhado (0 enquanto não chegou);
  - só a camada nova sobe para a GPU (`addLayerUpdate`);
  - `peleDe(chave)` dá o tom do corpo;
  - no shader, com o estado do kit `kit(13).w > 0.5`, a cor da cabeça vem da camada, e senão da cabeça base tingida;
  - `rostos` = `{indice, carregados, pedidos}`, exposto em `__golaco.estadio.corpo.rostos`.
- **`render/jogador3d.js`**: `definirPerfis(fn, rostos)`. A linha do kit leva a camada e a pele real, e a chave do cache
  da linha inclui a camada (a linha refaz quando o rosto chega: `versaoRostos`).
- **Malha**: as normais dos vértices duplicados na costura da UV são soldadas na exportação (`tools/humano/exportar_bin.py
  soldar_normais`, < 60°, também entre a cabeça e o corpo no pescoço). Era um degrau de luz na costura em todos os bonecos.
- **Testes**:
  - `teste-rostos-reais` (Node): índice completo; WebP 512² ≤ 64 KB, nenhuma sobrando; licença livre e créditos; a chave
    é a foto do TM; tom de pele (L* 20–80, matiz 30–75°); foto de frente e neutra; pasta ≤ 8 MB;
  - `teste-corpo-tela` C4: num pedido pro, cada jogador com rosto pede e carrega a textura;
  - `teste-corpo-tela` C5: na pública, nada é pedido.

## Patrocínios nas camisas reais — SÓ a versão de teste (22/10; contrato)

Dono, 22/10: "pode botar os patrocinadores sim, lembra que é só aquele teste? vamos tirar dps". Só na edição **pro**,
junto com as camisas reais. Na pública, o `patrocinios.json` nem é baixado. Para TIRAR: apagar
`assets/tm/patrocinios.json` e `assets/tm/patrocinios/`. Sem a base, `comCamisasReais` não põe `decais` e o shader não
desenha nada.

- **Pesquisa** (`tools/patrocinios/pesquisa/<clube>.json`, com as fontes): o máster e os outros patrocinadores da camisa em
  outubro de 2026, cada um com a posição, os uniformes, a cor na camisa e a largura relativa, mais a marca do fornecedor.
- **Gerador** (`tools/patrocinios/gerar.mjs <pasta da pesquisa com os logos>`, Chromium): cada logo (SVG ou PNG) vira a
  MÁSCARA branca em `assets/tm/patrocinios/<clube>/<marca>.webp`, de 512 × 256, com o desenho recortado, centrado e
  encaixado.
  - Logo sem transparência: a máscara é a distância à cor da borda.
  - Logo com forma cheia e texto dentro: o texto sai vazado (Otsu do brilho; a forma é a cor da borda).
- **Índice** (`assets/tm/patrocinios.json`): `{clubes: {<nome de uniformes.json>: {casa|fora|terceira|goleiro: [{logo, asp,
  pos, lado, larg, cor, nome}]}}, cheio: {logo: fração cheia}}`.
  - `pos` ∈ peito, ombro, manga, barra_frontal, acima_numero, abaixo_numero, calcao, fornecedor.
- **Caminho**:
  - `render/identidade-pagina.js carregarUniformes` baixa junto (só na pro).
  - `identidade.js comCamisasReais` põe `decais` (com a `url`) dentro de cada kit real.
  - `render/jogador3d.js linhaKit` escreve até 6 decalques nas linhas 17–28 do kit (`TEXELS_KIT` 32):
    - A = [camada do logo, posição, largura em m, largura ÷ altura]; B = [cor, lado];
    - a largura relativa é da frente do tronco (0,34 m), com um teto de altura por posição;
    - a ordem quando passa de 6: peito, fornecedor, acima do número, manga, ombro, calção, barra, abaixo do número;
    - a cor que some no tecido vai para o contraste.
  - `render/humano3d.js`:
    - as máscaras ficam numa `DataArrayTexture` R8 de 40 camadas (`logoDe(url)` pede na 1ª vez; só a camada nova sobe);
    - o shader projeta cada decalque PLANO na posição de repouso, só na face virada para o plano (a normal de repouso pela
      derivada da tela), na região certa (camisa, manga, calção).
- **Testes**:
  - `teste-patrocinios` (Node):
    - todo clube com camisa real tem decalques;
    - logos 512 × 256 ≤ 48 KB, nenhum sobrando, ≤ 2 MB;
    - os decalques entram nos kits só com a base;
    - no máximo 3 máscaras viram mancha.
  - `teste-corpo-tela` C6/C7: na pro, os logos carregam; na pública, nada é pedido.

## Cenas das paradas — replays nas paradas, cartão, intervalo e pós-jogo (22/10; contrato)
Pedido do dono: "a cena de pós jogo, e a cena de intervalo, as cenas de cartões, e os replays de faltas e jogadas passando
na tela enquanto o jogo tá parado". Plano em `PLANO-CENAS.md`; pesquisa em `PESQUISA-CENAS-TV.md` (§0.1 o roteiro da DFL,
§0.2 SoccerNet-v2, §4 replays nas paradas). **Só desenho**: a simulação fica parada e volta no mesmo tick. Nada entra no
fecho (`tools/fecho-hash.mjs --diff origin/main` = 0): o `lances.js` só importa do fecho, e o fecho não importa dele.

- **Classificador `js/lances.js`** (puro, no download inicial; `REPLAY_PARADA` mora nele):
  - `criarLances()`; `lancesPasso(L, m, eventos)` só lê o mundo e os eventos do passo (nada alocado por passo, sem rng;
    as distâncias pelo `MD`, para os dois aparelhos do online classificarem igual).
  - Na bola morta (estado 'parada', parada nova, sem cobrador; nunca o gol, o impedimento nem o fim do tempo):
    `L.lance = {classe 'A' | 'B', tipo, chave (tick do contato ou do chute), fim (tick do desfecho), morta, ateMax, time,
    ids, x, z, lado, peso, parada}` ou null. Tipos, do mais forte ao mais fraco (`TIPOS_LANCE`): 'penalti', 'vermelho',
    'trave', 'amarelo', 'faltaPerto', 'espalmada', 'passouPerto'.
  - Classe A (pênalti; vermelho, também o 2º amarelo; bola na trave com a bola morta em ≤ `chance.mortaAte` s) fura o
    teto e o espaço. Classe B (amarelo; tiro livre direto a ≤ `faltaPerto` m do centro do gol; espalmada de chute de
    dentro da área ou a ≥ `chance.vMin` m/s; chute de dentro da área que cruzou a linha a ≤ `chance.perto` m da armação)
    fica dentro de `porTempo` por tempo e de `espaco` s de bola rolando desde o último replay automático.
  - Nunca: lateral ou tiro de meta sem lance; chute bloqueado (`bateuCorpo` de outro antes da defesa) sem trave; defesa
    com o goleiro segurando (ele repõe ao vivo); a trave com a bola já morta (depois do apito: só conta com a bola viva
    ou morta no próprio passo).
  - O vermelho com a falta no passo da bola morta (vermelho direto, 2º amarelo sem vantagem, pênalti com vermelho): o
    expulso sai do mundo nesse passo, então a chave e o desfecho ficam no `ateMax` (o último passo desenhado com ele).
  - `decidirReplay(L, lance, {tempo, ligado})`; `registrarReplay(L, tick, 'gol' | 'impedimento' | 'parada')` (o gol e o
    impedimento também recomeçam o espaço).
  - `montaNoProximoPasso(m)` → 'monta' | 'fimDoTempo' | false: a mesma conta do `partida.js regrasPartida` (com a bola
    morta sem cobrador, o fim do tempo com os acréscimos vem antes da montagem; a montagem sai com `PARTIDA.foraEspera` s
    de bola morta). O `teste-replay-paradas` P5 guarda a cópia contra mudanças no `partida.js`.
- **Roteiro** `render/replay-roteiro.js roteiroParada(anel, lance)` → `{tipo: 'parada', planos (≤ 2), lado, chave, fim,
  classe, lance, x, z}` ou null:
  - P1 'tv' 1× de chave − `tv.antes` (encolhe até `tv.antesMin`) até chave + `tv.depois` (chance: desfecho + `tv.depoisChance`).
  - P2 a `lento.vel`: 'fechada' na falta (chave − `lento.antes` até chave + `lento.depois`), 'atras' na chance (chave −
    `lento.antesChance` até o desfecho + `lento.depoisChance`).
  - ≤ `maximo` s (encolhe o começo do P1, depois o P2; ainda passando, o P2 sai); nunca atravessa corte nem passa do
    `ateMax` (o expulso sai do mundo no passo da bola morta); null com a chave fora do anel. Sem o "depois" (o vermelho
    no contato), o P2 fica com a aproximação inteira (`lento.antes + lento.depois`) antes da chave; quando o P2 sai, o P1
    volta a começar em chave − `tv.antes`.
  - Câmera 'fechada' (`render/replay.js`): a POSIÇÃO da instância de TV do replay (a mola dela) com o campo de visão ×
    `lento.fov`, e o OLHAR direto no ponto entre o lance (x, z) e a bola (`lento.mistura`) — o foco da TV fica preso
    dentro do campo e o lance perto da linha de fundo saía do quadro. O desvio do olhar fica a no máximo `lento.quadro` da
    meia-largura do quadro na distância do lance (25/10: com a bola indo para o escanteio, o lance ia a |x| 0,77 da tela).
- **Página** (`main.js`):
  - `rodarPasso` → `passoLances(eventos)`: o lance aceito ARMA o replay (`replayParada`), só fora da API dos testes
    (`!emRodarPassos`). Desarma em gol, intervalo, fim, recomeço e saída, e quando a parada do lance acaba sem montagem.
  - `seguraParaReplayParada()` no TOPO da volta do laço (antes da entrada da demo, que escreve no mundo; no online antes de
    `MOD_ON.podePassar`/`entradas`, com `segurou = true`): com o armado e `montaNoProximoPasso(m)`, o replay começa e a
    volta para sem rodar o passo. Ordem da TV: 1 s ao vivo (a bola parando, os jogadores chegando) → vinheta → replay →
    vinheta → o corte da montagem. O pulo é o do replay de hoje; na tela só "REPLAY" e o "Pular" com toque.
  - O "Replay" da pausa pedido na espera da bola morta desarma o automático daquela parada (a jogada não repete).
  - TM "só o meu jogador": a faixa "Você foi expulso" da bola morta do replay volta depois dele, com os 6 s dali.
  - Liga com `?replayParada=0|1` ou com o padrão (`REPLAY_PARADA.ligado`; desligado com webdriver, `?prints=1` e
    `?demo=1`), E com "Replays: Ligado".
  - Online: segura só o meu lado (como o replay do gol). Livre, disputa e treinos: o classificador nem é criado.
  - API `__golaco.replay.paradas`: `{ligado, armado, contagem, ultimoTick, ultimoTipo, historico, forcar(lance), ndc(x, y, z)}`.
- **Testes:** `teste-replay-paradas` (Node, padrão; P1–P5 e as bordas do roteiro P2b) e `teste-replay-paradas-tela`
  (navegador, CI; V1–V11).

### Cena do cartão (PR 2; dono, 22/10: "as cenas de cartões")
Porte da branch `golaco/cenas-jogo` (1df2ca34) para fora do fecho: `js/cenas-config.js` (`CENAS`, `CENA_CARTAO`,
`CAMERA_GERAL`; importado só pelos módulos sob demanda — nem o `main.js` nem a simulação o importam), `js/cena-atores.js` e
`js/cena-cartao.js` (puros), `render/cartao3d.js`, `js/cenas-tela.js` + `css/cenas.css` — tudo pelo `SOB.cenas` do
`main.js` (pré-carga no 1º gesto ou ociosa, como o replay e o editor; `tools/teste-carga.mjs SOB_DEMANDA_ARQ`).
- **`js/cena-atores.js`** (puro; nada alocado por tick, sem rng):
  - O árbitro e os assistentes (`criarJogador` 200–202, posição 'ARB', kit 'arbitro'); `adicionarNovo` (os treinadores).
  - `passoAtores` na ordem do `passoCena` da comemoração (desejo → `passoCorpo` → separação → `passoPassada` →
    `passoPeDesenhado` → quadril → pose + gestos); quem para e fica plantado `CENAS.parado` ticks fica FIXO, respirando.
  - `recriarAtor` (ELIPSE: só no tick de um corte); `escolherVariante(tick, id, ultima, disponiveis, penultima)` (hash;
    nunca a anterior).
  - Os gestos (`gTiraAmarelo`, `gTiraVermelho`, `gCartao` — braço reto, a mão ≥ 0,25 m acima do topo da cabeça —,
    `gAponta`, `gAnota`, `gAfasta`, `gApito`, `gAbertos`, `gCabeca`, `gDesculpa`, `gSegura`, `gTapinha`, `gAbana`, `gRosto`,
    `gPalmasAlto`, `gCintura`, `gJoelhos`, `gAperto`) e as posturas (`posturaCabisbaixo`, `cabecaCeu`, `balancaCabeca`).
  - A câmera: `camValida`, `custoCamera` (a lente longe de onde cada um está, de onde vai parar e do caminho até lá),
    `melhorCamera`, `fugirDaLente`, `caberNoQuadro`, `definirPlano`/`definirPlanoGrupo`.
  - `moverJuntas`, `inclinarTronco` e `flexionar` (com `pernaIK` e `ponta`) são CÓPIAS dos da `comemoracao.js` (lá não são
    exportados e o arquivo é do fecho).
- **`js/cena-cartao.js`** (puro):
  - `escolherCartao(eventos)`: o mais grave do passo; o 2º amarelo = UM vermelho com `segundo`.
  - `planejarCartao(m, cartao, {ultimaAmarelo, ultimaVermelho, variante, timeHumano, posAntes(id), treinadores})`: o
    expulso (já em `m.expulsos`) na posição desenhada do tick anterior (`posAntes`, pelo anel); os treinadores
    (`tecnicos.js treinadorDoTime`, ids 210/211) como cópias paradas na área técnica; `assentar` no gol (a vantagem que
    virou gol: todos freiam fora do quadro, `CENA_CARTAO.assentar` s, antes do 1º plano — a ELIPSE do corte).
  - `criarCenaCartao(plano, m)` (só cópias; o árbitro e o capitão longe já vêm correndo — pré-rolagem), `passoCenaCartao`,
    `avancarCenaCartao`, `faseCartao`, `tempoCenaCartao`, `duracaoCenaCartao`, `planoCameraCartao(c, {pequena, aspecto},
    out)` (`out.tunel` = abrir o vão das placas), `cartaoNaMao(c, pose, out)`, `consumirEventosCartao` (`cartaoCena`,
    `aplausoExpulso`), `infoAtoresCartao`.
  - Variações: amarelo `abertos`, `cabeca`, `aceita`; vermelho `cabisbaixo`, `segurado`, `rosto` (A1, A2, V1 e V2 pedem um
    companheiro a ≤ `CENA_CARTAO.companheiro` m).
  - Planos e tempos em `CENA_CARTAO.planos`: amarelo `arbitro → reacao → anota` (5,45 s); vermelho `arbitro → reacao →
    saida → tunel → torcida` (8,9 s); 2º amarelo 9,9 s. O cartão no alto fica ≥ 1,0 s DENTRO do plano do árbitro (o do
    vermelho direto vai até 2,0 s; o do 2º amarelo até 4,0 s, com a reação, a saída e o túnel mais curtos). Só o capitão e o
    punido a < `ifab` m do árbitro (A1, V2).
  - A bola parada do mundo (a página a desenha no lugar do apito): ninguém da cena passa por cima dela — o centro de cada
    ator fica a ≥ `CENAS.bola` m dela (quem começou mais perto, no máximo onde estava: `marcarBola`/`separarDaBola`), o
    desvio a contorna e o árbitro não para em cima dela.
  - Depois da ELIPSE do túnel o companheiro fica no campo (para olhando o expulso sair). A lente do túnel tem candidatas a
    mais (o V1 de 4,8 a 7,5 m atrás e até 3,2 m de lado; o V2/V3 com |x| de 4 a 10 m e z de 36,5 a 39 m); sem nenhuma livre,
    a de maior folga até o ator mais perto (`melhorCamera`).
  - O plano da torcida anda no trilho de torcida do pré-jogo (`prejogo-roteiro.js cameraDoPlano(id, s, out, ajuste)`); num
    estádio de forma própria, o da planta dele (`planejarCartao` opc `ajustePlano` = `IDENT.forma3d.planta.ajustarPlano`, o
    mesmo do `criarRoteiro` do pré-jogo).
- **Página** (`main.js`):
  - `decidirCartao(eventos)` no fim do `rodarPasso`, ANTES do `decidirSubst` (a substituição do mesmo passo espera na
    fila). Só com as cenas ligadas, o módulo baixado, fora do online, do Livre, da disputa e da API dos testes
    (`!emRodarPassos`). A simulação fica PARADA no tick do cartão (o laço não roda passo; nenhuma entrada vai ao mundo) e
    volta no mesmo tick: o hash é o mesmo com e sem a cena.
  - Ordem: falta → cartão (no tick do apito) → 1 s ao vivo → replay de parada (armado, `seguraParaReplayParada`) →
    montagem → substituição; vantagem que virou gol → comemoração → cartão no gol + 149 (`cartaoGolNoPonto`, no topo da
    volta do laço; a cortina da comemoração pulada para ali e a cena dela sai do desenho) → saída → replay do gol; replay do
    impedimento → cartão (da fila; o mundo ainda está no tick do apito). Com um replay ou outra cena em andamento, o cartão
    entra na fila (`{tipo: 'cartao'}` no `proximaCena`).
  - Os treinadores vivos não andam nem são desenhados durante a cena (a cena desenha cópias): o 1º passo gravado depois
    dela não vira corte no anel (`REPLAY.saltoTecnico`) e o replay da falta atravessa a cena inteiro.
  - O estádio anda no relógio do desenho durante a cena (`render/emocao.js criarRelogioEstadio/relogioEstadio`:
    `relEst.tSegurado`; a rede, o ânimo, a festa e o anel do replay usam o mesmo relógio; sem cena, o de antes).
  - O desenho usa os atores da cena; o cartão 3D (`render/cartao3d.js`, 11 × 16 cm, 1 chamada só visível) vai na mão
    DESENHADA do árbitro (`jog3d.poseDesenhada`: com `?corpo=humano`, a postura do desenho por cima); o vão das placas
    (`render/vao-placas.js`, o mesmo do pré-jogo, que passou a importar dele) abre no plano do túnel; `jog3d.reservar` + 3.
  - A tarja de identificação (`js/cenas-tela.js`): o cartão desenhado, a sigla, a cor e o escudo do time, o número e o
    nome — nem motivo nem minuto; entra com o cartão no alto e sai com a cena (≤ `CENAS.tarja` s), nunca por cima da bola
    rolando. É uma exceção escrita à "sem narração" (como a faixa ENTRA/SAI e o selo IMPEDIMENTO/POSIÇÃO LEGAL). O
    `#cartao-icone` não aparece para quem teve a cena (nem antes nem depois dela); sem a cena, aparece como antes.
  - TM "só o meu jogador" com o travado expulso: a faixa "Você foi expulso" espera a cena E o replay de parada daquela bola
    morta (`expulsoPendente`, `talvezFaixaExpulso`) e os 6 s contam de quando ela aparece. Na vantagem que acaba em gol ela
    espera também a comemoração, a cena do cartão no gol + 149 e o replay do gol (sai depois dele); no intervalo, o 2º tempo
    (a faixa do intervalo fica) — também a que já estava na tela com os 6 s correndo quando o 1º tempo acabou (o vermelho
    nos últimos segundos): a faixa "Intervalo" ou a cena do intervalo a tiram e ela volta a ficar pendente
    (`guardarFaixaExpulso`), de novo com 6 s no 2º tempo; no fim de jogo ela não sai (fica a do fim, com o "Voltar ao Total
    Match"); com a cena de substituição, espera ela.
  - A comemoração que a cena do cartão tira do desenho no gol + 149 continua valendo para a entrada: o passo da saída
    (gol + 150) vai com a entrada NEUTRA (`golNeutro`), como com a comemoração sem a cena — a mesma entrada por tick com e
    sem a cena (um botão segurado do gol até depois da cena não vira uma borda no passo da montagem).
  - Pular: um aperto novo (tecla, botão, clique, toque; a camada `#cena` com o "Pular" no toque) depois de
    `CENAS.pularDepois` → cortina e corte de volta ao vivo. Pulada ANTES de o cartão subir (`tempos.alto`: nem a tarja nem
    o cartão 3D apareceram), o `#cartao-icone` de sempre volta em cima de quem levou (a janela de `FALTAS.icone` inteira:
    o mundo ainda está no tick do cartão). Pausa, aba escondida e celular em pé congelam a cena.
  - A tarja: no PC `max-width: min(520px, 100vw − as margens − 80px)` (numa janela estreita o nome corta com reticências
    dentro da tela); no toque, a conta de sempre (sem chegar ao "Pular").
  - `?cenas=0|1` força; senão `prefs.cenas` ("Cenas <small>ligadas</small>" na linha das cenas do "Modo de jogo", ao lado
    de Pré-jogo e Substituição); senão desligadas com webdriver, `?prints=1` e `?demo=1`; senão `CENAS.ligadas`. Online:
    nunca (só o ícone de hoje). Sem o `SOB.cenas` baixado (cartão antes da pré-carga): o ícone de hoje, sem segurar.
  - "Simular o resto", "Jogar de novo", "Reiniciar" e o mundo novo zeram a cena, o cartão da vantagem pendente, a tarja e
    a faixa do expulso pendente (`descartarCartao`).
  - `faltaDeTeste(opc)` aceita `segundo: true` (o 2º amarelo), passa pelo `decidirCartao` e devolve também `cena`.
  - API `__golaco.cenas`: `{carregado, ligado, ligar(b | null), ativo, tipo, fila, estado ({tipo, fase, plano, tempo,
    duracao, k, tick, id, time, cor, segundo, variante, apoio, motivo, planos, tempos, camera, tarja}), atores(), pular(),
    forcarVariante(cor, v), cartaoDeTeste({id, cor, segundo}), cartao3d ({visivel, cor, x, y, z} | null), maoArbitro ({x, y,
    z} | null), naTela(id | 'cartao'), tarja ({visivel, texto, cartoes, cor, sigla, num, nome, caixa} | null),
    cartaoGolPendente, cartaoComCena, relogioEstadio, vao, expulsoPendente, custo, zerarCusto()}`;
    `__golaco.sobDemanda.estado.cenas`.
- **Testes:** `teste-cenas` (Node, padrão: A canhão de 144 cartões em estados do meio de partidas IA × IA, com as cópias
  dos treinadores onde os vivos ficam — 6 s de `passoTecnicos` com o mundo parado —, a bola parada, o cartão no alto no
  plano do árbitro e o companheiro depois da elipse; A-L 48 vermelhos na lateral de cá, z = 30; B variedade, E pureza, F
  relógio do estádio, G custo, P o plano da torcida nos trilhos das plantas: Maracanã e 6 genéricos) e `teste-cenas-tela`
  parte `cartao` (navegador, CI e deploy; C6b, C11b, C12b, C12c e o C4 em 560×400 desta revisão).

### Guardador de lances (PR 3, intervalo: a 1ª parte; PLANO-CENAS.md §4.2, R8, R9, R20)
O intervalo ("lances do 1º tempo") e o fim ("Melhores momentos") tocam lances da partida inteira; o anel do replay só tem
os últimos 10 s. `render/lances-guarda.js` (puro, sob demanda no `SOB.cenas`; `LANCES_GUARDA` no `cenas-config.js`) COPIA
cada lance do anel, comprimido, para vagas fixas — só lê o anel: o hash não muda.
- **Formato:** `LANCES_GUARDA.lances` (6) vagas de ≤ `segundos` (6) s. Os jogadores a `hz` (30) Hz — por vaga: id (Int16),
  info (Uint8: time, goleiro, treinador), x/z/rumo (Float32) e a pose em Int16 RELATIVA ao x/z do jogador (y absoluto) na
  `escala` 1/4000 m (±8,19 m; erro ≤ 0,13 mm; fora da faixa satura e conta em `G.saturou`). A bola (p + q), o relógio do
  estádio, o corte e as marcas de TODO passo (60 Hz). As batidas da bola na rede da janela (até `REDE.maxImpactos`).
  Memória fixa: 3,54 MB do guardador + 2,19 MB do mini-anel; nada alocado em `guardar` nem em `tocar`.
- `criarGuarda(LANCES_GUARDA, {vagas, nj})`, `criarMini(G)` (o mini-anel: `criarAnel` com as vagas/nj do anel e
  `LANCES_GUARDA.mini` passos, com `mini.ondas` = a rede do lance no formato de `rede-onda.js criarOndas`), `limparGuarda(G)`.
- `janelaDoLance(G, anel, lance, out, {inteira})` → `{de, ate}` ou null: [chave − `antes`, fim + `depois`] s, cortada a
  `segundos` pelo começo, sem atravessar corte (começa no último até a chave — no gol, até o gol —, acaba antes do primeiro
  depois do começo), nunca depois de `ateMax`; `inteira`: null se o começo ideal já saiu do anel (o lance guardado tarde).
- `guardar(G, anel, lance, batidas, {inteira})` → a vaga k ou −1. `lance = {tipo ('gol' | lances.js TIPOS_LANCE), classe
  ('gol' | 'A' | 'B'), peso? (o gol: `PESO_GOL` = 100; a parada: o de lances.js, 1–7), chave, fim, ateMax?, morta (a chave
  da parada: a bola morta; o gol: o tick dele), lado, time, ids, x, z, tempo}`. Cheio: sai o de menor peso (o gol nunca sai
  por uma parada); o mais antigo desempata; o novo de menor peso que todos fica de fora; a mesma parada só troca por uma
  mais forte (até 1 lance por parada).
- `tocar(G, k, mini)` → a meta (`lanceGuardado`) ou null: descomprime no mini-anel, NOS MESMOS TICKS do anel de quando foi
  guardado, a 60 Hz (os jogadores dos passos do meio interpolados: pose e x/z lineares, rumo pelo menor ângulo, casados pelo
  id; nunca através de corte), e a rede em `mini.ondas`.
- `listar(G)` (cópias, na ordem em que entraram: `{k, seq, tipo, classe, peso, chave, fim, de, ate, lado, time, ids, x, z,
  tempo, quadros, batidas, segundos}`); `escolherLances(G, {tempo, max, maxSegundos, cronologica}, out)` → os k para uma cena:
  primeiro os gols do tempo (na ordem do jogo), depois as paradas pelo peso (empate: a mais nova), até `max` e `maxSegundos`.
- **Replay de outra fonte** (`render/replay.js`, rev. R8): `diretor.iniciar(ro, fonte = anel)`; os leitores do quadro
  (`posicionar` 'tv'/'fechada'/'atras'/'lateral', `tecnicosNoTick`, `zLateralDoPlano`, o enquadramento da linha e da análise:
  `jogadorNoTick`, `defensorDaLinha`, `enquadrarSaot`) leem a fonte; `diretor.fonte`; no fim ou no pulo a fonte volta ao anel.
  `diretor.lance(fonte, meta)` = `replay-roteiro.js roteiroLance(fonte, lance)`: `{tipo: 'lance', planos: [{de, ate, vel: 1,
  cam: 'tv'}], lado, chave, fim, classe, lance, x, z}` (sem atravessar corte; null com < 0,5 s).
- **Página** (`main.js`):
  - Guardar (com ou sem replay): o gol fica pendente no passo dele (`golGuardar`) e entra no `posGol()` — e no passo da saída,
    do intervalo ou do fim, também sem diretor ou com "Replays: Desligado" (`guardarGolPendente`). A parada classificada
    (todo `lancesPasso` não nulo, aceito ou não) fica pendente (`lanceGuardar`) e entra no passo ANTES da montagem
    (`guardarParadaPendente`, no topo do `seguraParaReplayParada`, antes do replay de parada: `montaNoProximoPasso` 'monta'
    ou 'fimDoTempo'), quando a janela até o desfecho + 0,5 s já está gravada. Só na partida (onde o classificador existe).
  - Sem o módulo baixado: pede o `SOB.cenas` e guarda quando chegar (`inteira`, o fim no fim do anel de quando pediu), se
    ainda for o mesmo mundo.
  - A memória (`garantirGuarda`) só na partida: quando o módulo chega ou a partida começa com ele já baixado (nos treinos a
    pré-carga não aloca nada). As últimas 8 batidas da rede ficam num anel pequeno (`batidasRede`, `estadioPasso`).
  - `iniciarReplay(ro, {fonte, aoFim})`: o replay de dentro de uma cena chama `aoFim(pulou)` no fim ou no pulo, sem andar a
    fila (`proximaCena`); o mundo novo e o "Simular o resto" descartam o `aoFim`. O `desenharReplay` lê o quadro, o relógio do
    estádio e a rede pela fonte (`fonte.ondas ?? ondas`).
  - `tocarLanceGuardado(k, aoFim)` (para as cenas do intervalo e do fim) e `lancesGuardados()`; o mundo novo e o fim do
    "Simular o resto" esquecem os lances (`iniciarEstados`).
  - API `__golaco.cenas`: `lances`, `guarda` ({bytes, mini, saturou} | null), `historicoGuarda` ({tick, tipo, classe, chave,
    fim, k, ms, tarde}), `pendentes` ({gol, parada}), `tocarLance(k)`, `fimLance` ({k, pulou, tick, ms} | null),
    `escolherLances(o)`.
- **Teste:** `teste-lances-guarda` (Node, padrão; G1 memória, G2 quantização, G3 tocar — a bola e o relógio exatos, os
  jogadores do meio = a interpolação, a perda dos 30 Hz e a rede —, G4 prioridade e a escolha, G5 custo, G6 as janelas em 24
  partidas IA × IA, metade com os replays desligados).

### Cena do intervalo (PR 3; dono, 22/10: "a cena de intervalo"; PLANO-CENAS.md §4)
- **`js/cena-fim.js`** (puro, sob demanda pelo `SOB.cenas`; a interface já serve ao fim de jogo do PR 4):
  `planejarFim(m, 'intervalo', {...})`, `criarCenaFim`, `passoCenaFim`, `avancarCenaFim`, `faseFim`, `pularParaGeral`,
  `proximoBloco`, `tarjaPlacarVisivel`, `infoAtoresFim`. Planos: `apito` 1,5 s → `campo` 2,5 s (o placar pesa no gesto: mãos
  na cintura, nos joelhos, cabeça baixa de quem perde, apertos de mão) → `tunel` 3,5 s (ELIPSE: o funil para o túnel, a
  câmera na boca, o vão das placas aberto) → `torcida` 1,5 s → [lances do 1º tempo] → `estatisticas` 6 s → `geral` 3 s. Os
  treinadores pelo gancho `tecnicos.js treinadorDoTime` (cópias; os vivos parados).
- **Página** (`main.js`): o evento `intervalo` vira a cena (na fila, depois do replay do gol do último lance e do cartão do
  último apito); `seguraIntervalo()` segura o laço no tick do evento até o `geral`; ali o laço solta, os 3 s de
  `PARTIDA.intervalo` correm por baixo com o desenho ainda da cena (o campo vazio) e a `saida` do 2º tempo acaba a cena —
  no MESMO tick e com o MESMO hash de `?cenas=0`. A cena chama `tocarAdiados()` ao começar (o apito sem esperar). Os lances
  do 1º tempo vêm do guardador (`escolherLances`: os gols primeiro, depois a parada mais forte; até
  `CENA_FIM.lances.intervalo`) e tocam pelo diretor com a fonte = o mini-anel e `aoFim` voltando à cena. Toque/Enter/A =
  próximo bloco (no geral, a saída; depois de `CENAS.pularDepois`; o botão segurado vale UMA vez — de novo só depois de
  solto: a borda do aperto em `F.botoes`); o "Pular" (só com toque) = a saída; Esc/P/Start = a PAUSA (a cena congela; o
  `#cena-menu` abre a mesma pausa com toque). Pausa, aba escondida e celular em pé congelam. Editar time na pausa vale como
  troca do intervalo (Regra 3). Sem o `SOB.cenas` baixado: a faixa de 3 s de antes; no online, a faixa + a tarja do
  placar só nesses 3 s (sem segurar).
- **Telas** (`js/cenas-tela.js`, `css/cenas.css`): a tarja do placar (escudo, sigla, placar e os autores do tempo com os
  minutos, "(c)" e "(p)"; `sumula.js autoresPorTime`) e o painel de estatísticas do 1º tempo (só rótulos e números:
  posse, finalizações, no alvo, escanteios, faltas, cartões; `sumula.js estatisticas(s, 1)`). Exceções escritas à "sem
  narração", como a tarja do cartão: só dentro da cena. A tarja (embaixo à esquerda, cresce para cima: uma linha por autor)
  CEDE ao painel quando as duas se encostariam (folga < 4 px, conferida quando uma delas aparece: `cederAoPainel`) — a
  tela baixa com 3 ou mais autores de um lado, a janela estreita do PC; com folga, as duas juntas. No online a tarja fica no
  centro, embaixo da faixa "Intervalo" no PC e ACIMA dela com toque (embaixo ficam os botões); se com os autores ela chegaria
  ao placar do HUD, fica só a linha do placar (`caberNoOnline`).
- **`js/sumula.js`**: SEMPRE na partida (import estático: no download inicial; folga do `teste-carga` 1399 → 1347 KB);
  `escanteios[2]` contados na BOLA MORTA (a parada nova de tipo 'escanteio'), `faltas[2]` cometidas, `porTempo[1]` no apito
  do 1º tempo — o apito fecha antes o chute ainda aberto (no alvo se o goleiro já tocou), que fica no 1º tempo. O
  `resultadoTM` (o que vai ao TM) não ganha chaves.
- **Testes:** `teste-cenas` C (56 intervalos: gol no último lance, time com 10, goleiro expulso; pureza E/E3), 
  `teste-lances-guarda` (G1–G6), `teste-ponte-tm` P7 (escanteios e faltas contra contadores independentes; as chaves do
  `resultadoTM`; P7b o chute aberto no apito) e `teste-cenas-tela` seção I (I1–I8, I8b a tarja × o painel com 1–4 autores,
  I11, I12, I13 a tarja do online × os botões de toque, I14 o botão segurado = um bloco) e C12d (a faixa do expulso que o
  intervalo tirou volta no 2º tempo).

### Cena do pós-jogo (PR 4; dono, 22/10: "a cena de pós jogo"; PLANO-CENAS.md §5, §7.4)
- **`js/cena-fim.js` `planejarFim(m, 'fimDeJogo', {placar, timeHumano, treinadores, melhor, troca, estatisticas, curto,
  ajustePlano, cameraGeral})`** (puro, sob demanda pelo `SOB.cenas`; só LÊ o mundo — cópias):
  - Vitória: `apito` 1,5 → `vencedor` 3,0 → `perdedor` 2,5 → `cumprimentos` 2,0 → [`troca` 1,5] → [`treinador` 2,0] →
    `aplauso` 2,5 → `torcida` 2,0 → [`melhor` 5,0] → `placar` 8,0 → [`estatisticas` 6,0] → `geral` (até o fim). Empate:
    `neutro` 3,0 no lugar de `vencedor`/`perdedor`. Curto (o empate que continua no TM): `apito` → `neutro` → `torcida` →
    `placar` → `geral` (14,5 s; sem cumprimentos, troca, treinadores, melhor nem estatísticas). Automático: vitória 34,5 s
    (36 com a troca), empate 32 s (33,5), sem os treinadores −2 s, no TM sem as estatísticas −6 s.
  - Cumprimentos: até 6 pares de adversários (os a ≤ 6 m; os de 6 a 14 m só quando não há 3 a ≤ 6 m) andam um para o outro e
    apertam a mão NO PLANO `cumprimentos` (vitória e empate: esperam de frente até o corte − 0,2 s; no empate com as mãos na
    cintura); um jogador de linha cumprimenta o árbitro (UEFA 50.04). Os que vão cumprimentar fogem da lente (só os pares são
    o assunto). Uma ELIPSE que leva alguém de um aperto (com o par ou com o árbitro, no meio ou ainda por fazer) o encerra no
    corte (`encerrarAperto`: os dois param onde estão, ninguém volta andando). O 2º do lamento vai ao 1º só até os
    cumprimentos e enquanto o 1º está no grupo.
  - **Troca de camisa** (`plano.troca = {a, b, sx}`): 1 par de adversários de linha pelo hash do JOGO (o tick do apito e a
    semente; sem `m.rng`) — nunca goleiro, expulso, quem aperta a mão nem o melhor em campo. ELIPSE do plano `troca`: lado a
    lado, abraçados (`cena-atores.js gAbraco`), andando para a câmera; desde ali cada um tem `camisaDe` = o id do outro até o
    fim da cena. `opc.troca === false` (página: `?troca=0`) tira.
  - **Treinadores** (com os dois do gancho): ELIPSE do plano `treinador` — os dois na frente do túnel, entre as áreas
    técnicas, andando um para o outro e apertando a mão (`c.trPar`); com um só, o do vencedor comemora.
  - **Melhor em campo** (`opc.melhor`, da página: `sumula.js melhorEmCampo`): ELIPSE do plano `melhor` — ele em pé do lado
    da TV (o substituído vira um ator novo), de frente para a câmera um pouco virado para a torcida dele, batendo palmas
    (`gPalmas`) e depois o braço erguido; o close da cintura para cima. `tarjaMelhorVisivel(c)` = o plano `melhor`.
  - `tarjaPlacarVisivel(c)` = o plano `placar` (no fim pela fase). A torcida do placar no plano `torcida` (o evento
    `cenaFim`; também quando o toque pula o plano): em `emocao.js` palmas de quem ganha, palmas no empate, a vaia e o
    silêncio de quem perde; em `festa.js` a casa abre o bandeirão (os sinalizadores dela acenderam no apito) e o setor
    visitante acende os dele. No corte do plano da torcida quem está a < 4,5 m do trilho da câmera reaparece longe.
  - No corte do apito quem está DENTRO de um sólido (correu atrás da bola para dentro do gol) reaparece fora, para o meio.
  - Toque/Enter/A = o próximo bloco (`proximoBloco`: os planos de campo → `melhor` → `placar` → `estatisticas` → `geral`);
    "Pular" (o da cena, no toque) = `pularParaGeral`; Esc/P/Start = a pausa, que congela a cena (no TM ela tem o "Voltar ao
    Total Match": PLANO §5.3).
- **`js/sumula.js`**: `notaDe(s, m, id, time)` — a nota pela MESMA conta e opções do `jogador` do `resultadoTM` (a posição
  em campo ou expulso, os gols sofridos e o saldo do time dele); `melhorEmCampo(s, m)` → `{id, time, nota, gols, assist}`:
  a maior nota de quem jogou (em `m.jogadores` e os substituídos de `m.times[t].saiu`; os expulsos não), desempate gols →
  assistências → menor id. O **`resultadoTM`** ganha SÓ o campo OPCIONAL `melhor: {lado, tmId, nome, nota}`; o resto igual
  campo a campo (o TM ignora o que não conhece; o travado melhor em campo: `melhor.nota === jogador.nota`).
- **Página** (`main.js`):
  - O evento `fimDeJogo`: `gravarResultadoTM` no apito como antes (o TM lê de lá se a mensagem se perder; a cena não atrasa
    nada: o `tm3d:fim` só sai no "Voltar ao Total Match"). A cena entra no fim do passo (`decidirFimJogo`, depois do cartão
    do mesmo passo) ou na fila `{tipo: 'fim'}` (depois do replay do gol do último lance e do cartão). Sem a cena (desligada,
    sem o `SOB.cenas`, a API dos testes): a faixa do fim de hoje.
  - Fora do online a cena SEGURA o laço no tick do `fimDeJogo` até sair (mundo novo): `seguraIntervalo()` com
    `cenaFim.segura` — em `fim` só o `m.tick` andaria. No ONLINE não segura (o lockstep segue andando o tick; a cena anda no
    `quadroOnline`, só cópias); as cenas do online seguem desligadas, menos esta (`cenaFimLigada`, sem o `!ONLINE`).
  - Os treinadores vivos fora do desenho durante a cena (as cópias têm o mesmo id). `tocarAdiados()` ao começar (R6).
  - No `geral`: a camada da cena sai (`hud.cena(false)`) e a FAIXA FINAL entra: "Fim de jogo", o placar, "Jogar de novo" (com
    `?tm`, "Voltar ao Total Match") e o 2º botão "Melhores momentos" (`hud.faixa` `botao2/botao2Texto/botao2Cmd`; só com
    lances guardados): até `CENA_FIM.lances.fim` lances do guardador, os gols primeiro, ≤ `fimMax` s, na ordem do jogo, um
    ângulo cada (`tocarLanceGuardado` com o `aoFim` voltando à faixa); qualquer pulo volta à faixa.
  - O kit misto da troca: `troca:<camisa do outro>:<o resto dele>:<número do outro>` no `it.kit` (`kitTrocaDe`).
  - O toque/botão que avança o bloco fica marcado como visto (`F.botoes = ent.botoes`): só vale de novo solto e apertado (um
    botão segurado, ou o pulso de um toque preso no online sem passo, é UM bloco — no intervalo também).
  - A faixa do fim de jogo (a da cena, a de sempre sem ela e a do "Simular o resto") é `hud.faixa({..., final: true})`:
    `html.fim-faixa` tira os controles de toque enquanto ela está na tela (o arco encostava nos botões dela e a zona do
    analógico ficava com o toque da metade esquerda deles); qualquer outra faixa (ou nenhuma) os traz de volta
    (`aoFaixaFinal` → `entrada.reposicionar()`).
  - TM: sem o bloco de estatísticas; o empate é a versão curta salvo `partida.empateContinua === false` no pedido.
    "Simular o resto": sem cena. "Jogar de novo"/mundo novo: tudo zera.
  - Lado do TM (`legacy-total-match/js/tm3d.js`, v375): o `cfg.empateContinua` do modo (true/false ou uma função (gols da
    casa, gols de fora) → o modo iria a prorrogação/pênaltis com esse empate) vira `partida.empateContinua` no pedido
    (`empateContinuaDe`: com a função, a resposta quando todo empate de 0×0 a 6×6 concorda; senão o campo fica de fora = a
    versão curta). Liga, amistosos, jogo rápido, pré-temporada, Eliminatórias, Arena, Dream Team/Draft, Ultimate Online e o
    Rumo ao Estrelato: false; a carreira (`TM.comp.userPenContext`), o Modo Competição (`userPenContextComp`) e a Copa do
    Mundo (`TM.tournament.userPenContext`): a mesma conta do onDone; a Copa entre amigos: true; o Ultimate: `!!cfg.mataMata`.
    A volta com gol fora (a carreira) depende do placar do empate: sem o campo (curto).
  - Pênaltis 3D: a disputa intercepta o `fimDeJogo` (sem cena). Livre e treinos: sem fim de jogo.
  - API `__golaco.cenas` (tipo `'fim'`): `estado` (+ `resultado`, `curto`, `segura`, `melhor`, `tarjaMelhor`, `trocou`,
    `troca` {a, b, sx, kitA, kitB}, `treinadores` {aperto}, `faixaFinal`, `mm`), `fimDeTeste({placar, antes})`,
    `melhoresMomentos()`, `historicoPosJogo`, `faixaFinal`, `custoPosJogo`; `tarjas.melhor`.
- **Render:** `render/jogador3d.js` o kit `troca:…` (a camisa — cores, padrão, número e os patrocínios dela na versão de
  teste — do kit de A, o calção, o meião, a chuteira e o patrocínio do calção de B; no manequim a listra do calção e a faixa
  do meião são `acentoCalcao`, o acento de B — sem a chave, o `acento` do uniforme), registrado na 1ª vez; SEM chamada a
  mais nos dois corpos (no manequim as cores são atributos por instância; no corpo novo, uma linha da textura `tKits`). A
  chave das cores por vaga é `índice do uniforme × 10⁷ + id × 4 + time + goleiro` (os mistos só crescem a cada "Jogar de
  novo": com 64 índices por id, o 65º colidia com o id seguinte). `coresDe(id)` (testes) lê as cores do manequim.
- **Telas** (`js/cenas-tela.js`, `css/cenas.css`): a tarja do MELHOR EM CAMPO (escudo e sigla, número, nome, "Melhor em
  campo" e a nota com uma casa — "6,5"); o placar final e o painel "Partida" são os do intervalo. Exceções escritas à "sem
  narração": só dentro da cena.
- **Testes:** `teste-cenas` FIM (56 fins em vitória, derrota e empate: planos e tempos, fases, apito, corpo e câmera,
  sólidos, cumprimentos, a troca, o melhor = o argmax independente e a nota = a do TM, o close dele, o aperto dos
  treinadores, as tarjas, o toque = o próximo bloco, a festa do fim; E pureza; G custo), `teste-ponte-tm` P7/P8 (o `melhor`
  e o resto igual ao da base) e `teste-cenas-tela` seção F (navegador).

## A IA contra a pessoa — categoria D (24/10; contrato)

Dono, 24/10: "a IA correr, tanto pra marcar, tanto pra atacar, pq ela não corre". Plano em 8 PRs (D1–D8; pesquisa e
medição em `PESQUISA-CATEGORIA-D.md`). Em volume a IA já corre mais que um time real: o plano é REDISTRIBUIR (a corrida
para quem tem a bola, para perto dela e para a área), nunca somar, e sem mexer na física (`JOGADOR.*`) nem na condução que
o dono aprovou (`conducao.js`).

### O portão (`tatica.js`, puro)

- `contraPessoa(m, t)` → o time `t` é da IA e joga CONTRA uma pessoa de verdade: `pessoaJoga(m, 1 − t)` e nenhuma pessoa no
  time `t`. `pessoaJoga(m, t)` (interna): `t` está em `m.humanos`, a entrada dele no último passo não trouxe marca da IA
  (`m.iaNaEntrada[t]`, gravado pelo `sim.js` junto com o `m.iaJoga`, fora do hash: `ia` OU `iaCobra` — uma pessoa nunca manda
  nenhuma das duas; o `m.iaJoga`, só com `ia`, segue para o resto da simulação) e o travado do "só o meu jogador"
  (`m.trava[t]`, Total Match) não foi expulso — expulso, o controle fica nele (`acoes.js assumirControle`) e o time joga com a
  IA sem ninguém do outro lado (a página entrega a entrada vazia; o Simular o resto, a da demo sem marca).
- Falso: dois humanos (online, `teste-dois-humanos`, `teste-online`), dos dois lados; IA × IA — a demo do Node e o painel
  (`entradaDemoPartida`: `ia`, e só `iaCobra` nas cobranças do controlado — a saída, as laterais, os tiros de meta), o
  Simular o resto, a página com `?demo=1` e os achadores `comoPagina` (`main.js entradaDoTime` passa `iaCobra` em toda a
  entrada da demo); o travado expulso. A página com `?demo=1` é IA × IA também para a subida do #500 (antes da revisão do D2
  ela ligava ali, por só ler o `m.iaJoga`).
- `timeDaPessoa(m, t)` → `pessoaJoga(m, t)`. Para o D4.
- O nome do campo é `m.iaNaEntrada`: `m.iaMarca` é o cache da marcação do `ia.js` (escrever nele mudava a marcação do time
  da pessoa).
- **Invariante:** o que liga por `contraPessoa` nunca muda a demo nem o treino — `hash-partida` (demo IGUAL; a cena
  "humano" muda) e `hash-igual` IGUAL em todo PR "só contra a pessoa". Seção P do `teste-ia-corre`: 0 passos ligados na demo
  do Node (com as cobranças), com o travado expulso (a entrada vazia e o Simular o resto) e com dois humanos; ligado em todo
  passo contra o roteiro.

### As constantes (`config.js IA_PESSOA`)

Só o que muda contra a pessoa; cada objeto é juntado POR CIMA do da partida na carga do módulo que o lê (o `--set` das
ferramentas troca o `config.js` antes de a lógica carregar): `ia-ataque.js` `UTIL_P = {...IA_ATAQUE.utilidade,
...IA_PESSOA.utilidade}` e `CORR_P = {...IA_ATAQUE.corridas, ...IA_PESSOA.corridas}`; `ia-tatica.js` `SUAVE_APOIO_P =
{...TATICA.suaveApoio, ...IA_PESSOA.suaveApoio}` e `SUAVE_APOIO_LONGE_P = {...SUAVE_APOIO_P, ...IA_PESSOA.suaveApoioLonge.suave}`.
A escolha é por time, a cada tick. Modo novo do `para()`: `IA.modos.apoia` (os modos `pressa`/`calma`, o `para()` e o
`IA.pressaoArranca` ficam intocados: são do treino congelado).

### D2 — a IA ataca correndo (itens 67-ataque e 21; `ia-ataque.js`, `ia-tatica.js`)

- **Condutor** (`decidir`, com `U = UTIL_P`): cada uma das 7 direções da condução é avaliada no ponto aonde ele CHEGA —
  com `livreAFrente` ≥ `conduzLivre` m, a `clamp(livre − 2, conduzDist, conduzLonge)` m (dentro do campo; senão os 5 m de
  sempre) —, com `conduz` 1,0 e `conduzSolta` [2,5, 5, 0,35]; `condutorTatico` conduz a `UTIL_P.magConduz` 0,6 e o CORRER
  sai com ≥ `correrLivre` 14 m livres (transição ou antes de `correrAte` 35 m). Já conduzindo (`atual === 'conduz'`) a mais
  de `viraV` 2 m/s, só entram as direções a até `viraMax` 0,6 rad do movimento (o condutor vira aos poucos); `curtaPerto` 0
  (sem a condução curta com o MOD; a proteção `protege` com o marcador colado continua). A chance de manter a bola
  (`manter(m, j, px, pz, U)`) lê cada adversário onde ele estará em `UTIL_P.manterAntecipa` 0,12 s (`o.x + o.vx·t`; sem a
  chave — a IA × IA —, o de agora, bit a bit): só no agora o condutor conduzia para dentro de quem fechava correndo
  (roubadas no pé +25%). Com 0,1 s os pênaltis da IA no condutor da pessoa ('dribla' do `teste-faltas-sentido`, 36
  partidas) iam a 0,64 por partida (B3: ≤ 0,6; main 0,39); com 0,12 s, 0,50 (com 0,15 s 0,39, mas com 0,15 e 0,2 s o
  `teste-nao-passa` das sementes do CI reprovava por 2 casos do time da PESSOA — o sorteio caótico das sementes fixas, nenhum
  do condutor da IA). `viradaComEmbalo`, o compromisso e a histerese não mudam.
- **Apoio curto** (`apoioTatico`, papel 'apoio', sem pressa): com o ponto a mais de `IA_PESSOA.apoio.liga` m e o condutor a
  ≥ `vCond` m/s, `para(..., 'apoia')`; sai a menos de `desliga` m ou com o condutor abaixo de `vCondSai` (estado em
  `j.iaA.apoia`/`apoiaTick`, vale só com o tick anterior).
- **Apoio pela referência** (`alvoCalmo`, ramo 'apoioRef'): `SUAVE_APOIO_P` (a `volta` de 12 m) e, a mais de
  `suaveApoioLonge.bola[0]` m da bola (volta a menos de `bola[1]`; histerese em `estadoT(j).longe`), `SUAVE_APOIO_LONGE_P`
  (parado até o alvo passar de 7 m, marcha lenta até 10 m).
- **Subida com o ataque** (#500): só para quem está a até `sobeMax` m da bola (a continuação da subida não confere).
- **Corridas nas costas** (`tentarCorrida`, `cfg = CORR_P`): só quem joga na FRENTE (a vaga da formação com `sem.x` ≥ 0:
  os centroavantes), só com a linha deles nos últimos `corridas.ultimos` m, e o destino dentro da área: u em
  [MX − u[0], MX − u[1]] (clamp do destino de sempre), do lado oposto à bola, |w| de w[0] a w[1] (+0,3 × o quanto ele vem do
  lado de lá). No `estadoAtaque`, a corrida que não recebe acaba em `CORR_P.espera` s (desde o começo) e, passada a linha, em
  `CORR_P.alemMax` s — pelo time DELE (`contraPessoa(m, o.time)`). `recarga`, `max`, `folga`, `campoMin`, `vCondutor` e a
  leitura do passe não mudam.
- **Ataque à área:** pressa com o ponto a mais de `IA_PESSOA.areaCorre` m.
- **O chamado da PRESSÃO** (`defesa.js desvio`, só com o botão): `DEFESA_HUMANO.pressao.desvio.folga` 0,25 → 0,45 m — com a
  IA conduzindo, ele chegava mais vezes onde um companheiro já contém o condutor (`teste-pressao-humano` M8). O M2 do
  teste conta os casos longos com o companheiro mais perto a ≤ 8,5 m no começo (ao alcance em 1,5 s); o de todos os casos
  longos fica informativo.

### D3 — a IA marca correndo (itens 67-defesa, 19 e 20; `ia-tatica.js`)

Tudo pelo portão `contraPessoa(m, t)` (o time `t` da IA defendendo contra a pessoa); as constantes em `IA_PESSOA` (D3),
juntadas na carga do `ia-tatica.js`: `SUAVE_MARCA_P = {...TATICA.suave, ...IA_PESSOA.marcaPerto.suave}`,
`SUAVE_LINHA_MARCA_P = {...TATICA.suaveLinha, ...}`, `RECOMP_P = {...TATICA.recomp, ...IA_PESSOA.recomp}` e
`CORRIDA_P = {...IA_DEFESA.corrida, ...IA_PESSOA.corrida}`.

- **Quem marca perto da bola** (`alvoCalmo` → `suaveMarcaPessoa`, ramos `zona`, `fechaLinha`, `linha` e `cobre`): com a bola
  a até `marcaPerto.bola[0]` m (sai a mais de `bola[1]`; histerese em `estadoT(j).marcaPerto`), `SUAVE_LINHA_MARCA_P` na linha
  e `SUAVE_MARCA_P` no resto. Chaves novas do ponto calmo (lidas com o padrão de sempre quando ausentes): `div` (a intensidade
  longe do ponto é `d / div`; sem a chave, `d / 14`) e `arranque: false` (sem o `TATICA.arranque`). Os valores: `trote` [1, 0,
  0,33] (sem o teto), `div` 7, `corre` 9, `volta` [12, 1,3].
- **Encurtar** (`semBola`, o ponto da zona, antes do `alvoCalmo`): quem é do meio ou da frente (não a linha de defesa), com o
  condutor da pessoa a até `encurta[0]` m, sem o condutor rápido e com a velocidade filtrada dele (`B.cvx`, `B.cvz`) abaixo de
  `encurta[3]` m/s: o ponto vai `encurta[2]` do caminho até o ponto a `encurta[1]` m do condutor, na linha condutor → meu gol.
- **Linha de engajamento** (`blocoDoTime`): `IA_PESSOA.engaja[pressão]` no lugar do `IA_DEFESA.engaja`.
- **Recomposição** (`recompor`, `R = RECOMP_P`): a mais de `recomp.longe[0]` m da bola (quem ficou à frente dela — `u ≥ ub` —, a
  mais de `longe[2]`), intensidade `longe[1]` e sem o sprint; com `longe[3]`, o MEIO que ficou à frente da bola (nem `def` nem a
  frente da vaga, `sem.x < 0`) nunca entra no "longe" (o recuo do meio do `teste-transicao --humano`, meta ≥ 5,5 m/s); depois do
  `rumoPressa`, a **virada em arco** (`viradaEmArco`): com o pedido a mais de `arco[0]` rad da velocidade e o corpo a
  mais de `arco[1]` m/s, o pedido vira o rumo a `arco[2]` rad da velocidade, pelo lado do pedido (a menos de 0,2 rad de 180°:
  pelo lado do meu gol, o do sinal do produto vetorial velocidade × (meu gol − corpo)), com o CORRER; o `estadoT(j).qdir` do
  `rumoPressa` fica no arco.
- **Condutor rápido** (item 19) (`blocoDoTime`, `noCaminho`, `acompanhar`, `acompanhaCorredor` e o `liga` do `recompor`): `CORRIDA_P`
  (`correLonge` 4; `v` não muda).
- **O passe da IA contra a pessoa** (`ia-ataque.js decidir` → `riscoCaminho(..., ta)`, `UTIL_P.passeAntecipa`): no PASSE e na
  ENFIADA o risco é o maior entre cada adversário onde está e onde estará em `ta` s (a velocidade dele × `ta`); sem a chave
  (`IA_ATAQUE.utilidade`, a IA × IA), `ta` = 0 e a conta é a de sempre. O passe sai depois da carga do botão (`acaoIA`); a
  roubada desfeita do `teste-defesa-corrida` era o passe decidido no tick da roubada e solto na corrida de volta da pessoa.
- **Medido e fora** (PESQUISA-CATEGORIA-D.md §6): o sprint mais cedo da recomposição e a frente sprintando nos 2 s da perda,
  a cobertura do 2º homem a 6 m pelo modo pressa, `engaja` 78, `corrida.v` 6,3, o recuo antecipado do 1º homem, a contenção
  mais longe, o "longe" valendo para o meio, a intensidade 0,65 longe da bola e o passe antecipado só no agora + 0,15–0,25 s
  (sem o máximo com o agora).
- **Pendente**: (o defensor do corredor ≥ 5 m/s saiu: o dono deixou a escolha comigo em 25/10 e a meta do item 19 é a de
  chegada, arrancada do bloco armado na área ≤ 25%; a velocidade só informa) a recomposição "longe e devagar" ≤ 15%
  e o 2º e o 3º homem a ≤ 5 / ≤ 8,5 m (`teste-ia-corre` M6–M8, informativos) — os porquês nas linhas do teste.

### D4 — os companheiros da pessoa apertam o condutor da IA (item 17; `ia-tatica.js`, `defesa.js`)

Portão `contraPessoa(m, 1 − t)`: o time `t` é o da pessoa e o outro é a IA contra ela (com duas pessoas é falso: o online e o
`teste-dois-humanos` não mudam). Constantes em `IA_PESSOA.companheiros` (`cobertura`, `freio`, `engaja`). O que muda:

- **1º e 2º homem** (`blocoDoTime`): o controlado sai das duas escolhas (`semCtrl`; `B.compPessoa` marca o time) — o 1º homem
  era quase sempre ele, o mais perto, e o controlado só faz o que a pessoa manda: ninguém mais continha.
  Com a bola ALTA no ar (`m.voo.alto`, sem posse) a escolha é a de sempre: o controlado disputa a bola alta (troca aérea).
- **A linha da IA contra a pessoa** (`IA_PESSOA.engaja`, D3): a Média 67 → 69 (o PPDA contra o espelho do D4 ia a 11,0).
- **Linha de engajamento**: `IA_PESSOA.companheiros.engaja[pressão]` (Média 72) no lugar do `IA_DEFESA.engaja`.
- **Cobertura** (`cobrir`): o 2º a `companheiros.cobertura` m (5) do 1º, no lugar de `IA_DEFESA.cobertura` (8,5).
- **Chegada** (`defesa.js semAtropelar`): os companheiros (não o controlado) na curva de freada de `companheiros.freio`
  m/s² (5) no lugar de `DEFESA_HUMANO.semAtropelar.freio` (3); o controlado segue com 3 (a carga por trás do
  `teste-faltas-sentido` B2).
- **O bote** não muda: só nos gatilhos de sempre (`apertaProprio`: gatilho, perigo, a Alta, o condutor lento).
- Medido no `teste-ia-corre` C (C1 ≤ 6,2 m e C2 ≥ 40%, valendo; reprovam na main). Recalibrados com o motivo no teste: o V7
  (teto 238: a IA perde mais a bola e corre mais pelo contexto) e o M1 do `teste-pressao-humano` (com ≤ 2,0 m e Δ ≥ 0,5).

### D5 — o vai e volta da IA sem a bola (item 22; `ia-tatica.js`, `ia.js`, `ia-ataque.js`)

Vale na partida (`m.times`), IA × IA e contra a pessoa; o treino fica bit a bit igual (`hash-igual` IGUAL). Medido pelo
`teste-movimento --modo partida`: 94% das inversões eram abaixo de 1,5 m/s (o andar devagar que muda de lado), ~30% do apoio
pela referência e ~1/3 da pressa dele (a retomada e a volta do impedido). O que muda:

- **A espera da volta** do ponto calmo (`alvoCalmo`, `suave*.volta`): começada, vale até `volta[0] + TATICA.volta.folga` m
  (3; freando, o corpo ainda se afastava 0,5–2 m, passava de `volta[0]` e a espera caía) e também com o jogador QUIETO
  (`TATICA.volta.quieto`: entrando no quieto ainda andando, o passinho ia na hora para o alvo que ficou para trás).
- **A virada em arco** (`TATICA.arco` 2,5 m/s): entre 0,5 e 2,5 m/s a virada de mais de `giro[4]` do ponto calmo vai pelo
  giro, sem parar (acima de 2,5 o `para()` freia na linha, como antes; com a bola na mão do meu goleiro, de uma vez).
- **A virada parada** (`ia.js para`, `IA.viraParado` {v 0,8, cos −0,5, s 0,5}): nos modos que freiam, o pedido a mais de 120°
  do movimento de quem anda a mais de 0,8 m/s solta o analógico e, parado, espera 0,5 s. Só para quem PEDIU no tick
  (`j.ia.viraTick === s.tick`): o ponto calmo fora da marcação de perto e o modo firme.
- **O modo firme** (`IA.modos.firme`; `IA_ATAQUE.firmeRef`): a pressa da RETOMADA de quem segue a referência (o time longe
  dela, `ia.motivoP` 'trans') vai com o ponto filtrado (12 m/s), a freada e a virada parada e, logo depois de parar (o arranque
  calmo, `TATICA.arranque`), trotando. A volta do impedimento e a bola na mão do meu goleiro seguem pelo `pressa`.
- **Quem marca perto da bola fica como antes** (`TATICA.pertoBola` 12 m; ramos linha, zona, fechaLinha, cobre e marca —
  `MARCA_PERTO`): com tudo valendo também para eles, o marcador a ≤ 3 m do condutor caía 2–3 pontos (`teste-pressao`).
  Com a bola na mão do meu goleiro, também (a virada de uma vez: a "bola na mão" do teste-movimento ia de 10 a 15%).
- **O olhar** (`TATICA.olhar.giro` 1,2 → 1,4 rad/s, abaixo do 1,5 do tremor): de costas para a bola andando devagar 14,9 → 13,9%.
- O `teste-movimento --modo partida` saiu do etapa3 (5 rodadas de 8 sementes passando). Na partida, as guardas "sem recuo"
  são as da partida: a média de chutes por semente de 3 min ≥ 1,5 (main 2,75; o volume é do painel e da categoria E) e o
  marcador a ≤ 3 m ≥ 34% (main 36,6%; real 27,1%, Metrica; os 40% com as duas na Média ficam no `teste-pressao`).

### A pressão contra a pessoa (`tools/teste-pressao.mjs --humano`; D3, item 20)

- `lib/partida-tatica.mjs`: `criarJogo(L, semente, {humano})` — o time 0 é uma pessoa (sem a marca `ia`): um perfil do
  `humano-roteiro.mjs`, `'construtor'` (o ataque substituto só no time 0) ou `'espelho'` (a `entradaDemoPartida` sem o `ia`; a
  `iaCobra` das cobranças fica). `medirJogos` devolve também `porTime[t]` (o time que DEFENDE: recepções do adversário e as
  com defensor a ≤ 4,6 m em ≤ 2 s, perdas e retomadas em ≤ 5 s, os passes do adversário e as ações do PPDA).
- `teste-pressao --humano` (padrão, 3 processos): o espelho × 48 sementes × 4 min (3 fatias); a IA (time 1, Média): PPDA
  8–10,5, agressão 58–78%, retomada 34–54%. Contra os roteiros e o construtor o PPDA dá ~1,5–3 (eles quase não passam diante
  da pressão) — medida da pessoa roteirizada, não da IA. `--roteiros`, `--sementes`, `--js`, `--set`.

### A régua (`tools/lib/corrida-medidas.mjs`) e o teste (`tools/teste-ia-corre.mjs`)

- `filmarPartida({js, semente, modo: 'humano'|'demo', perfil, min, sets})` → a partida de 2 × `min` min contra o humano
  roteirizado (`tools/lib/humano-roteiro.mjs`, time 0) ou a demo, gravada a cada passo (posição, velocidade, ramo da IA com
  os submodos `:sobe`/`:apoia` e a opção do condutor), analisada por `analisar(R)` (as MESMAS contas para o rastreamento
  real: faixas, fases, distância à bola, "na tela", disparadas, reação na perda e no ganho, corridas à frente da bola e à
  área por ramo, 1º homem, condutor com a posse e as trocas, o apoio a ≤ 10 m da bola SEM o dono — `apoioPerto` — e, dele,
  com o dono conduzindo a ≥ 3 m/s — `apoioConduz` —, vai e volta por ramo) + os chutes (dentro/fora da área, sem pênalti),
  os gols e as roubadas sofridas por time (evento `roubada` de um adversário com a bola no pé do time; `roubadas`, `peMin`
  = minutos de bola rolando no pé). Até `2·min·3600 + 6000` passos, e erro se a partida não chegar ao `fim` (o filme cortado
  mediria a partida pela metade sem aviso). `juntar(lista)` → `resumo(J)` → `imprimir(nome, r)`.
- `copiaInstrumentada(js, dest?)` (D3) → uma cópia da lógica com UMA linha a mais no `para()` do `ia.js` (`j.__d`, `j.__dx`,
  `j.__dz`: a distância e o rumo até o ponto pedido, depois do filtro do modo); erro se o `para()` mudou. O `filmarPartida`
  grava `DA`/`DAA` (NaN sem o `para()` no passo) e o `analisar` conta, marcando o condutor do outro time (a bola no pé dele),
  o "longe e devagar" (ponto a > 5 m e corpo < 4 m/s; `alvo.ld`, na recomposição `alvo.rec`, por ramo/distância/ação), o 2º e
  o 3º mais perto (`h1.d2Mediana`, `d3Mediana`, ramos) e a aproximação de 4–12 m numa faixa só (`h1.a4a12`); e, na perda, o
  volume por ramo e distância (`ramos[].prd`).
- `teste-ia-corre` (grupo padrão, 3 processos; no CI 3 roteiros × 8 sementes — a amostra da decisão, desde o D3): seções **P**
  (o portão, acima; vale sempre), **A** (ataque, metas do D2), **M** (marcação, metas do D3: a aproximação do 1º homem a 4–12 m
  ≥ 5 km/h e o "longe e devagar" ≤ 18%; M6–M8 informativas), **C** (companheiros da pessoa, informativa até o D4) e **V**
  (guardas que valem sempre: m/min da IA atacando ≤ 190 e no total ≤ 195, vai e volta ≤ 4,74 por jogador-min — a base do D2
  —, gols da IA contra o roteiro ≥ 0,92 por partida, a base, as roubadas sofridas pela IA por minuto de bola no pé ≤ a base
  + 15%, 2,78, e — D3 — o m/min da IA nos 5 s depois de perder ≤ 230). As metas com `*` (`'>=*'`/`'<=*'`: as do D3, M2, M5,
  V3 e V7) reprovam só quando a medida PROVA estar do lado errado — além da meta por mais de 2 ±. O A6/A7 é o apoio SEM o condutor (a conta com ele, a do real, fica informativa:
  A6c/A7c); o A6b — com o condutor conduzindo — é o que reprova o D2 sem o apoio curto. O A10 (item 21) pede ≥ 70% dos
  chutes de dentro da área: o "≥ 55%" do plano a main já cumpria (53–64% conforme as sementes). O ± é o desvio-padrão de um
  bootstrap estratificado por roteiro sobre a própria medida agregada (`--boot`, 200; o sorteio é fixo). Opções `--js`,
  `--sementes`, `--roteiros`, `--par`, `--set`, `--json`, `--detalhe`, `--boot`. A coluna "antes" é a base do PR que ligou a
  meta (A e V1–V6: a main ebf0abc6, antes do D2; M e V7: a main 2c9e7066, antes do D3; 24 partidas). O `teste-defesa-corrida`
  ganhou `--set` (a mesma triagem).
