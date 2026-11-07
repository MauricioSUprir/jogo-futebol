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
- `paraMundo(ax, ay, yawCamera)` converte o analógico da tela para o mundo pelo rumo da câmera: a corrida e a condução.
- `miraPelaTela(ax, ay, cam, ox, oz)` (C6): a MIRA das ações, a direção na tela levada ao gramado pela câmera do quadro
  (contrato "Mira pela tela").

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
  Parâmetros: `?semente ?q ?hora ?camera ?demo ?marcador ?prints ?qps ?toque ?entalhe` (e, entre outros, `?prejogo` e
  `?prepartida=1|0`, a tela antes do jogo do item 64).
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
  nunca descer abaixo das mãos: ninguém fura o pano, `teste-torcida`; GPU = JS no `teste-estadio`), `alturaPelaLente(p,
  [x, y, z, liga])` e `LENTE_GLSL` (perto da lente da câmera da bola parada a bandeira de mastro abaixa: inteira com a mão a
  ≥ `BANDEIRAS.lente.raio` + `folga` m dela, 9 + 2, sumida na mão abaixo de 9 m; GPU = JS no `teste-estadio`). **`bandeiras.js`**: `criarBandeiras(cena, {qualidade, hora})` → {mesh (1 chamada, opaca, desenhada
  antes da torcida), uniforms (uAbre, uLente), atualizar(festa, t), definirQualidade (prefixo por `drawRange`), definirHora,
  definirLente(p | null), dispose}; atlas 1024² desenhado em canvas. `torcida.atualizar(t, emocao, camera, batida, desenha,
  lente)`: o main.js passa a posição da câmera quando a da bola parada está na mistura (`cam.misturaBolaParada > 0`); o
  replay, o pré-jogo e as outras câmeras passam null (as bandeiras inteiras).
- **`fumaca.js`**: `FUMACA` (vida, subida, vento para FORA do campo, tamanho, alfa, partículas por qualidade: Baixa 0; o
  quadro do núcleo e do halo, `nucleo`/`halo`), `fumacaParticula(s, p, P, t)` e `FUMACA_GLSL` (o caminho de cada partícula
  sai do shader: nada simulado na CPU), `forcaPelaLente(c, r, [x, y, z, liga])` e `LENTE_FUMACA_GLSL` (perto da lente da
  câmera da bola parada cada quadro do sinalizador — o núcleo, o halo e cada partícula, centro c e raio r — some: inteiro
  com a borda a ≥ `FUMACA.lente.raio` + `folga` m dela, 9 + 3, apagado abaixo de 9 m; multiplica a força do fogo e o alfa
  da fumaça; liga 0 = 1; GPU = JS no `teste-estadio`). **`sinalizadores.js`**: `criarSinalizadores(cena, {qualidade,
  hora})` → {mesh (1 chamada, só visível com fogo ou fumaça; núcleo + halo + fumaça numa malha instanciada, mistura
  pré-multiplicada), uniforms (uLente), atualizar(festa, t), definirQualidade, definirHora, definirLente(p | null), quantas,
  medirOverdraw(renderer, camera, escala) (em telas cheias), dispose}; a `torcida.atualizar(..., lente)` passa a mesma lente
  às bandeiras e aos sinalizadores.
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
  o começo da TV encolhe, até chute − 1,5 s, e depois o do de trás do gol, até chute − 0,3 s; nenhum plano passa de um corte
  depois do gol; 28/10, o LANCE LENTO — a bola que demora a entrar, Δ = gol − chute ≳ 2 s: o chute bloqueado que sobe,
  quica, bate na trave e entra —: se ainda passar, o de trás do gol começa até 1 s (`lentoAntes`) antes do GOL, depois sai
  a lateral do golaço — o orçamento volta a ser só de TV + atrás, 14 s no golaço — e, por último, o de trás do gol (só fora
  do golaço, Δ ≳ 5,7 s); a TV fica com o chute e o desvio inteiros e a base NUNCA passa de 12/14 s; nos gols que cabiam,
  nada muda), `roteiroImpedimento(anel, {fotoTick, apitoTick,
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
  toque (camada `#replay`); no pulo, a entrada é solta e o botão do controle segurado só vale de novo depois de solto. No
  online, com o menu, a Ajuda ou o editor abertos (lá eles não congelam o replay), nada apertado neles pula (item 129;
  contrato "Online 1×1", etapa 3: "O menu nas cenas").
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
  impedimento de verdade em Node; 28/10: o G3 confere a base de todo gol e o G3b, o gol lento sintético — `--so-g3b` —; `--de
  S` mede as partidas a partir da semente S) e `tools/teste-replay.mjs` (navegador, CI): gol roteirizado (começa na saída, mostra o
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
  checagem o roteiro é o de antes, campo a campo (`teste-saot` S6, também nos gols de verdade; 28/10: o passo novo do lance lento
  — o de trás do gol começando até 1 s antes do GOL — só roda SEM a checagem; com ela, não cabendo, sai a checagem como
  antes e a base sem ela recebe o tratamento do lance lento — a cópia `lib/varre-saot.mjs roteiroGolHoje` segue a regra
  nova do gol lento sem checagem). `roteiroMenu` também
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
- **Selo e terço de baixo** — a exceção à "sem narração" de 12/10 (dono; a única naquele dia: depois vieram a faixa ENTRA/SAI,
  o nome do condutor, as tarjas das cenas e o cartão do autor do gol, item 31): `index.html #terco` (irmão de `#replay`,
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
(A camada da passada em `poseTec` — `tc.mp`, `tc.vm`: a pelve e o tórax; os braços ficam nas posturas — está no contrato "Passada natural fora da partida (item 61)", no fim.)
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
  da 1ª pessoa, o fim da parte 2 e o começo da parte 1, nessa ordem; se ainda passar, a 1ª pessoa sai e o treinador volta
  ao plano dele, encolhendo só o que ele mesmo passar — 28/10 —; no lance lento, Δ ≳ 4,9 s, a parte 1 começa até 0,8 s,
  `REPLAY.treinador.antes`, antes do GOL: os extras ficam SEMPRE ≤ 7 s); total ≤ 19 s (golaço 21; checagem + 1), garantido
  pela base ≤ 12/14 s (+ 1) e os extras ≤ 7 s. O enquadramento vai em `plano.enq` (não enumerável).
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
  chute − `prendeAntes` s, e nada no cabeceio (o salto logo depois do agachado); 29/10, C3 (item 14): no CABECEIO, de
  chute − `cabeceioY.antes` s a chute + `cabeceioY.depois` s (rampas de `cabeceioY.rampa` s), a altura vem de uma gaussiana
  CURTA do olho bruto (σ `cabeceioY.sigma` 0,05 s) — a suavização longa ficava para trás da cabeça subindo ~0,3–0,6 m no pulo,
  o olho ia ao fundo da faixa (−0,14 m) e a lente ficava a < `proprio` do próprio corpo: no canhão de cruzamentos, a lente
  ruim e o olho a −14 cm em 33 de 33 cabeceios a gol, 0 de 33 depois (`teste-replay-anel` G18) — e a
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
  orçamentos — 28/10: a base também, em todo gol, e G3b o gol lento sintético, 24 e 14 m com Δ de 1 a 6,5 s —, anel e cortes, pênalti, olho/olhar/giro/bola/gol da 1ª pessoa, corpo na lente, as duas partes do treinador,
  a lente fora dos sólidos, a reação dele, pose gravada = ao vivo, G14 o gol de cabeça sintético com o autor seguindo para
  dentro do gol — `--so-g14` —; `--estresse` 84 partidas; o G8 cresce a amostra com as
  sementes seguintes até 48 gols com autor — 28/10: com autor e em que a 1ª pessoa CABE pelas regras fixas acima, sem corte
  a < `extras.primeiraMin` s antes do chute e com a 1ª pessoa e o treinador mínimos dentro de `extras.maximo`
  (`lib/replay-g.mjs semLugarPrimeira`, conta só do relógio do lance: a bola que demora a entrar não tem 1ª pessoa, como o gol
  contra e o gol sem chute); a presença ≥ 80% é medida nesses e uma 1ª pessoa num gol em que ela não cabe reprova),
  `teste-replay` (navegador: G1–G3 ordem, durações e quem
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
(Desde o item 61 a página anda a cena por `marcha.js avancarComMarcha(c, dt, passoCena)` — a mesma conta do `avancarCena` com a camada da passada nos atores depois de cada passo; só desenho, o `comemoracao.js` não muda. Contrato "Passada natural fora da partida (item 61)", no fim.)
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
  TV), 4,8 m, fov 30, girada em volta dele pelo giro escolhido UMA vez no começo da reação (`c.giroReacao`: entre 0, ±0,5,
  ±0,75, ±1, ±1,25 e ±1,5 rad, o de MENOS gente colada na lente — o CORPO, um cilindro de 0,6 m em volta do centro
  (`LENTE.corpo`: os pontos do quadro ficam a até 0,49 m do centro em pé e 0,57 m caído), com o ponto mais perto a < 2,2 m
  de profundidade e a borda de dentro no quadro do PC ou do celular (fov × 0,88, até 2,2:1, o eixo girado para o terço
  esquerdo) na profundidade da borda de trás — e, entre os que empatam nisso, o de menor custo
  somando a gente perto da linha de visão, integrado na reação INTEIRA (até o fim da cena: na curta ela dura até 2 s), cada
  um andando reto para o destino dele na cena (a vaga do abraço, a saída, 10 m do grupo) e parando nele; o 0 fica se ninguém
  colar na lente e o custo dele for ≤ 0,03 m·s — contraprovas: um defensor andando para a saída passava a < 1 m da lente em
  ~15% das cenas curtas; (15/10) o custo só olhava o 1º segundo e o quadro do PC e um colega correndo para o abraço passava
  rente à lente no celular; (31/10, C7) com o goleiro na linha do gol reagindo e um zagueiro saindo da pequena área para a
  lente, os 5 giros de antes tinham todos alguém colado nela e a soma única escolhia o de 1 rad, com um corpo rente à borda do
  quadro do celular a 1,87 m (1 quadro); (01/11, C7) o corpo contava pelo centro + 0,4 m de lado na profundidade do centro,
  e no CI de 522a4e36 (1º gol da semente 32, com o bloqueio do teste, a lente presa ao lado do gol) o centro ficava 1 cm
  fora da conta e o joelho, 0,5 m mais fundo, dentro do quadro do celular (13 quadros); `teste-comemoracao` 13, com mais 12
  gols naturais, e a FOLGA do bloqueio: o jogador parado nunca a < 2,3 m dentro de 1,25 × o quadro); câmera nunca além de 5,5 m das linhas nem dentro do gol; celular: fov × 0,88 e o assunto no terço
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
  ou toque na camada `#comemoracao` (o "Pular" do toque é o alvo visível); no online, com o menu, a Ajuda ou o editor abertos
  (lá eles não congelam a cena), nada apertado neles pula (item 129; contrato "Online 1×1", etapa 3: "O menu nas cenas").
  `fimComemoracao(pulou)`: estado 'solta' (a
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
- **Cartão do autor (item 31, PR #615 → item 126, PR #621; dono, 17/10: "a FOTO do autor com o número e o nome"; 05/11: "a
  foto com o nome tem que ser mais embaixo e menor, tem que ser no canto inferior"; `PESQUISA-ESTADIO.md` §10.1 e §7.6)**:
  `#autor-gol` DENTRO da camada `#comemoracao` (fora do `#hud`; some com a cena), desde o item 126 no canto de BAIXO à DIREITA,
  no PC e no celular (até o item 126: no canto de cima à direita, na linha do placar, ~4× maior no PC). **Por que esse canto**
  (6 gols × 5 telas, quadro a quadro, no protótipo e no `teste-comemoracao-tela` H15): é o único canto de BAIXO livre do autor
  e dos outros atores em todos os planos da cena — o autor vai no máximo a 59,5% da largura no PC e a 44% no celular (o
  `ajustarCelular` o põe no terço esquerdo); o de baixo à ESQUERDA (o "lower third" da TV) cobria o autor em 73–78% dos
  quadros no celular, e mudar o terço do enquadramento mexeria no `comemoracao.js` (fecho). Com o placar em cima à esquerda, os
  dois ficam em diagonal. **Com toque** o "Pular" da comemoração fica no MESMO lugar dos "Pular" do replay, da substituição e da
  cena do cartão (o `.btn-replay-pular`: `--pular-vao` 6 px do canto, `--pular-h` 52 px no `:root`; o botão não muda de lugar de
  uma cena para a outra — revisão R3: subindo para cima do cartão ele ficava solto no meio da lateral antes e depois dele e
  pulava ~61 px na passagem para o replay) e o CARTÃO sobe para logo acima dele: `--ag-sobe` = `--pular-vao + --pular-h + 10px`
  (o pé do cartão 10 px acima do topo do botão, com e sem foto; no 844×390 com o entalhe o cartão ocupa y 230–287 de 390); sem
  toque (PC) `--ag-sobe` 0 e o pé do cartão na margem (`bottom: --sa-b + --m`). Mostra a foto (só a da edição pro do TM, abaixo)
  e a coluna [pílula do time: escudo + sigla | número / NOME]: o nome COMPLETO da ficha é a linha principal, também no celular
  (o de camisa do `tm-times` corta o último nome em 10 letras sem reticências — revisão V1), desde o item 125/126 em CAIXA ALTA
  na TM Cond 800 (o `--f-disp`; cabe inteiro também em 568×320 pro, onde a Inter de antes cortava "Eduardo Pa…"), o número vai
  na pílula depois de um filete (1,3 × a sigla, TM Cond 800 `tabular-nums` — revisão V3) e a coluna fica centrada na altura da
  foto; o pé da foto escurece até a cor do fundo do cartão (42% de baixo: some a maior parte da camisa de outro clube, mas as
  listras logo abaixo do queixo continuam — revisão V2; o enquadramento foto a foto é o item 112). Sem minuto nem "GOL"; sem
  foto, só o texto numa linha da ALTURA DO PLACAR (`--placar-h`, agora no pé da tela; as letras 0,6/0,55 × a altura — revisão
  V4) — nada desenhado no lugar. **Medidas** (item 126; as variáveis no PAI, `.comemoracao`, porque o "Pular" também as usa):
  foto `--ag-foto: clamp(56px, 7.2vh, 76px)` e `--ag-pad: clamp(7px, 0.9vh, 9px)` no PC, `clamp(40px, 12vh, 48px)` e 5 px no
  celular deitado (`max-height: 519px`, o corte do `pequena` da câmera); a altura do cartão com foto FIXA, `--ag-alt` = foto +
  2 × pad (`box-sizing: border-box`: o vão de 10 px até o "Pular" é certo; com a altura pelo conteúdo, a 1ª rodada do protótipo
  deu 6 px); nome `clamp(20px, 2.6vh, 28px)` / 18 px, sigla `clamp(12px, 1.35vh, 14px)` / 11 px; `max-width: min(38vw, 480px)`
  no PC e `52vw − sa.r − m` no celular (a borda esquerda do cartão sempre além de 62% e de 48% da largura: à direita do máximo
  do autor); o nome que não couber corta com reticências. Saiu o `--ag-esq` (o `medirAutorGol` do `hud.js` que media a direita
  do placar). Antes → depois (pro, com foto, o nome "Eduardo Pacheco", medido no protótipo da especificação com o cartão de
  verdade; cartão / foto / % da altura da janela): 1920×1010 585×208 / 182 / 20,6% → 300×91 /
  73 / 9,0%; 1280×720 417×149 / 130 / 20,7% → 235×70 / 56 / 9,7%; 844×390 295×106 / 92 / 27,2% → 204×57 / 47 / 14,6%; 667×375
  291×102 / 88 → 202×55 / 45; 568×320 232×89 / 75 / 27,8% ("Eduardo Pa…") → 197×50 / 40 / 15,6% (o nome inteiro) — área 22–48% da
  de antes (com o nome de 19 letras do teste, 23% em 1920, 38% em 844 e 56,7% em 568). Sem foto: 212×28 (844), 201×26 (568).
  **Entrada** de 280 ms `cubic-bezier(0.05, 0.7, 0.1, 1)` (Material 3, "emphasized decelerate"): de `translateX(24px)` +
  `clip-path: inset(0 0 0 100%)` + opacidade 0 ao lugar — o cartão "corre" da borda da direita, como um lower third; o recorte
  final é `inset(-40px)` (revisão C-R6: com `inset(0)` mantido pelo `both` a sombra `0 8px 24px` nunca aparecia); saída em 200 ms
  para `translateX(12px)`; "reduzir movimento": só a opacidade em 150 ms. A fonte é pedida no começo da cena
  (`iniciarComemoracao` → `pedirFontesDisp(nome)`, contrato "Sistema tipográfico"): o cartão só entra ~1,6 s depois. Quando:
  `js/autor-cartao.js` (NADA mudou nele no item 126)
  (puro, estático, fora do fecho; as constantes `AUTOR_GOL` moram nele): `autorDoCartao(plano, gol)` = o autor só se ele é
  quem comemora (gol contra e sem autor = nada); `janelaCartao({rede, duracao, curta})` = entra `rede + 0,4` s (1,6 s), sai
  em `min(entra + 3,5 (curta 2,6), duracao − 0,5)`, null com menos de 1,5 s; `faseCartao(janela, t, duracao)` relê a duração
  a cada quadro (o `kFim` encurta). A página (`main.js quadroCartaoAutor`) anda pelo relógio da CENA (parado na pausa; a
  animação do CSS só enfeita: entra 0,3 s, sai 0,2 s) e mexe no DOM só nas trocas de fase; nunca antes do 1º corte; os dados
  (`dadosAutorGol`, a montagem da tarja das cenas) são lidos na entrada — com a foto já decodificada, a MESMA `<img>` da
  pré-carga (pinta no 1º quadro) —, e o cartão nunca muda de forma depois (só a foto que falhar depois de entrar — cache
  limpo, rede — o deixa só com o texto, na hora: `hud.js fotoFalhou`). Pular, a cena encerrada (saída, intervalo, fim,
  Reiniciar, Simular o resto, a cena do cartão no gol + 149) = some na hora (`apagarCartaoAutor`). Com a pausa aberta e no
  "Replay" da pausa pedido no meio da cena (o comando não espera a cena: a jogada com a bola rolando, a marca REPLAY no mesmo
  canto) ele fica escondido (`html.pausa-aberta`/`html.em-replay`, `visibility`; revisão R1) e volta onde estava se a cena
  continuar; o selo "Conexão instável" do online espera a comemoração (`html.em-comemoracao`; revisão R3). `?autorGol=0` desliga só
  ele (padrão ligado, também com webdriver: os testes de outros assuntos abrem com `?comemoracao=0`). No online, cada
  aparelho na sua cena (só desenho). Exceção escrita à "sem narração" (como o selo IMPEDIMENTO/POSIÇÃO LEGAL, a faixa
  ENTRA/SAI, o nome do condutor e as tarjas das cenas): só dentro da cena, nunca com a bola rolando. Com `?tm`, a cara do TM
  (`css/tm.css`: o painel, a borda fina e a borda esquerda de 3 px na cor do time; as letras são as do sistema tipográfico);
  sem, o molde das tarjas (`css/estilo.css`). `hud.autorGol(spec | null)`, `hud.autorGolSai()`, `hud.autorGolEstado` (as
  caixas do LAYOUT, sem o translateX da animação: funciona com `bottom`/`right`). O selo "Conexão instável" do online continua
  escondido na comemoração pela tela limpa da cena (o cartão já não divide o canto de cima com ele).
- **Fotos da edição pro (item 31)**: `js/tm-fotos.js` (puro, fora do fecho, só por `import()` com `?tm` e `edicao: 'pro'`,
  depois do `pronto`: `main.js agendarFotosTM`, `requestIdleCallback` com 1,5 s de teto) — `fotosDoPedido(pedido, TM.mapa,
  location.origin)` lê o campo `foto` do PRÓPRIO pedido pelo lado + `tmId` (o `tm-times.js` não o vê: hash igual) e
  `fotoAceita` só deixa `data:image/(jpeg|png|webp);base64` até 48 000 caracteres ou http(s) absoluto da MESMA origem.
  `garantirFoto(id)` pede uma vez (os 22 em campo, quem entra na substituição, o autor no gol) e decodifica (`img.decode()`);
  `fotoPronta(id)` só devolve a já decodificada. API `__golaco.tm.fotos` ({n, pedidas, prontas, erros, primeiraEm, prontoEm,
  de(id)}). Sem `?tm` (e na edição pública) o `tm-fotos.js` e as fotos nunca são pedidos, nem na pré-carga (`teste-carga`,
  lista `SO_TM_ARQ`; `teste-comemoracao-tela` H4: 0 pedidos).
- **API (`window.__golaco.comemoracao`)**: `ativa`, `estado` ({fase, t, duracao, k, estado: 'rodando' | 'solta', rapida,
  autor, alvo, variante, corrida, curta, time, golTick, colegas, reacao, contra, plano, kFinal, kFimFinal, kFimAbraco,
  kFim, kPulo, cartao: {id, entra, sai, fase, mostrado, foto} | null}), `cartaoTela` (o `hud.autorGolEstado`), `atores()`,
  `naTela(id?)` (caixa px da pose desenhada), `pular()`, `ligada(v?)` (sem salvar),
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
  natural, treino sem cena, CPU do quadro ≤ p95 do jogo + 1 ms, console; H (item 31; `--so A,…,H`) o cartão do autor — H1
  entra 1,55–1,75 s, ≥ 3,0 s, o número e o nome da ficha, nunca com o "GOL!", na rede, no replay nem depois da cena; H2 nada
  encosta (placar, "Pular", área segura) e nunca sobre o autor (a pose desenhada) no PC, 844×390 com o entalhe, 568×320 e no
  gol natural; H3 a foto do tmId do autor no 1º quadro (`?tm` pro, a rota `/__fotos/` com JPGs do TM) e nada no gol contra
  (`golRoteirizado({contra: true})`); H4 o TM público sem foto e sem pedido; H5 a curta; H6 pular = some no quadro; H7 as
  fotos em 404; H8 `?autorGol=0`; H9 o "Replay" da pausa com o cartão na tela (0 quadros juntos); H10 o nome completo no celular
  (o último nome de 11 letras; desde o item 126 também em 568×320 pro); H11 o nome maior que o número e a coluna no meio da foto;
  H12 sem foto na altura do placar (± 1 px) com o pé no lugar (± 1 px: a margem de baixo; com toque, 10 px acima do "Pular").
  **Item 126** (páginas novas 1920×1010 pro e 568×320 pro com as fotos): H3 passa a pedir a foto de 44–48 px no 844×390 (antes
  88–96) e o nome ≥ 16 px na TM Cond 800 CARREGADA (o `document.fonts.check` lido antes de qualquer `load` do próprio teste:
  revisão C-R7), número ≥ 12; H13 o cartão no canto de BAIXO à direita (± 1 px; com toque, o pé 10 px acima do topo do
  "Pular"); H14 menor — altura ≤ 10,5% da janela no PC e ≤ 17% no celular, foto 56–76 px no PC e 40–48 no celular, área ≤ 45%
  da medida pelo próprio teste na base 29d67bad (≤ 60% em 568×320 pro, onde a base cortava o nome de 19 letras); H15 nunca
  sobre os OUTROS atores da cena (as poses desenhadas) nos gols roteirizados (0 quadros; a base, no celular, 56–79 quadros em 2 de
  6 gols) e ≤ 30 quadros (0,5 s) no gol natural (na semente 5 um colega passa COLADO na lente no contraplano do abraço e cruza o
  canto de baixo em 20 quadros: qualquer cartão num canto de baixo, o pedido, é cruzado); H16 com toque, o "Pular" PARADO no
  canto dos "Pular" do replay (± 1 px) a cena toda, ABAIXO do cartão (≥ 8 px) e, depois do 1º corte, sem cobrir o autor; H17
  (item 125) o cartão na tela sem família sem `@font-face` e sem letra < 11 px (`tools/lib/tipografia.mjs`, contando o 1º quadro
  da animação de entrada). Na base do item 126 (29d67bad) reprovam H3, H10 (568 pro), H12, H13, H14, H15 (no celular) e H16; na
  1ª versão do item (e60e2c7c, o "Pular" em cima do cartão) H12, H13 e H16. Medido (fix final): H13 0,00 px do lugar em todas as
  telas; H14 9,0% (1920), 14,6% (844), 15,6% (568 pro); H15 0 nos roteirizados e 20/222 no natural; H16 0/352 e 0/449 quadros
  fora do canto, 0 acima ou encostado no cartão; H17 3 textos na TM Cond, mínimo 11 px.
  `teste-comemoracao` 15 (a janela, puro; não mudou). Os testes de navegador que não são da comemoração
  e atravessam um gol esperando a saída abrem com `?comemoracao=0` (`teste-estadio`, `teste-desempenho-celular` — que
  mede a cena à parte com a CPU 4× —, `prints.mjs` fora das cenas dela e das do replay).

## Cena de substituição e faixa ENTRA/SAI (pedido de 12/10; contrato)
(A camada da passada em `poseAtor` — `a.mp`, `a.vm`, a rampa pelo tempo da cena — está no contrato "Passada natural fora da partida (item 61)", no fim.)
Pedido do dono: "quando tiver substituição, quero que tenha a cena de substituição, só jogador saindo e entrando, e
embaixo, no modelo, a informação de quem entra e quem sai". Pesquisa: `PESQUISA-ESTADIO.md` §11. Constantes em `config.js
SUBST`. **Só desenho**: a troca acontece na simulação como sempre (`escalacao.js aplicarPendentes`, evento `substituicao
{time, sai, entra}`); a cena anda num mundo à parte (cópias) e a página só SEGURA o laço depois do passo das trocas
enquanto ela roda (como o replay). `hash-igual` e `hash-partida` IGUAIS; o hash no tick T + 700 é o mesmo com a cena
ligada, desligada e em Node (`teste-substituicao-tela` T1). **Sob demanda** (21/10, para caber o goleiro realista na
folga do download inicial): `js/substituicao.js` e `render/placa-subst.js` chegam pelo `main.js` SOB.subst (pré-carga
ociosa; com `?substituicao=1` já no começo; ao ligar a opção); a troca que acontece antes de o módulo chegar sai só com a
faixa ENTRA/SAI (a simulação não muda).
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
- **Online** (item 30, 06/11; contrato "Online 1×1", etapa 3; as escolhas no "Depende do dono" 26 da `FILA.md`): S1 vale a
  opção do ANFITRIÃO nos dois aparelhos (o lado 0 manda `{tipo: 'opcoes', subst}` pelo canal de controle, nunca pelo pedido;
  o convidado começa com "só a faixa" e adota a dele — `online-pagina.js substOnline`); a faixa ENTRA/SAI aparece sempre. S2
  cada aparelho roda a SUA cena segurando só a SUA simulação no `quadroOnline` (`segura = true` + `quadroSubst`, como aqui
  fora) e o lockstep faz quem acabou antes esperar, com "{nome} ainda está vendo a cena" (a marca E_CENA do pacote), sem o
  selo "Conexão instável" e sem W.O. (os dois só pela falta de pacote); o "Pular" pula só a minha. S3 a troca pelo editor
  do outro jogador chega como ação pelo canal confiável e abre a cena no mesmo tick nos dois (as dos dois juntos: uma cena
  com os 2 pares). A minha pausa combinada, o celular em pé e a aba escondida congelam a cena; o menu, a Ajuda e o editor não,
  e nada apertado neles a pula. A cena continua só desenho: a escolha diferente nos dois aparelhos nunca dessincroniza (no
  máximo um espera o outro). Antes era desligada no online (`main.js` `substLigada = ONLINE ? false : …`; ligada pela API, a
  cena congelava e a simulação andava por baixo).
- **HUD**: `hud.substituicao(ativo)` (classe `em-substituicao`: some o mesmo que na comemoração), `hud.faixaSubst(pares,
  agora, cena | null)`, `faixaSubstQuadro(agora, cena)`, `faixaSubstEstado(agora)` → `{visivel, modo: 'cena' | 'jogo',
  pagina, n, texto, restante, dur}`, `esconderFaixaSubst()`. `#faixa-subst` (role status, aria-live polite): sigla do
  time na cor dele, ▲ ENTRA número nome, ▼ SAI número nome, "1/2" com mais de um par; `data-texto` = a frase do leitor
  de tela ("Golaço FC: entra 22 Wallace Pimenta, sai 9 Diego Albuquerque"). Fica ≥ 4,0 s (mesmo com a cena pulada),
  2,5 s por par (1,8 com ≥ 4), teto 10 s; na cena, a página do plano (SAI/SAI2: o par dele; ENTRA: do 3º par em diante,
  de par em par, sem trocar a < 0,5 s do corte); no jogo (depois da cena ou sem ela) passam primeiro as páginas vistas por
  menos de 0,6·porPar (a última da cena primeiro), cada uma porPar s, e a faixa vai até max(dur, o fim delas) — todo par
  aparece ≥ 1,5 s (`teste-substituicao-tela` T11).
  Lugar: PC embaixo à esquerda (64 px da borda, 280–520 px; no jogo, sem chegar no minimapa nem no nome do jogador com a bola
  dos cantos de baixo, itens 59 e 60: `teste-substituicao-tela` T8); celular na cena embaixo à
  esquerda (área segura + 14 px, ≤ 64 px de altura, sem chegar no "Pular"); celular no jogo, uma linha compacta no lugar
  do aviso (topo + 74 px, ≤ 360 px, nomes da camisa) com o aviso descendo 42 px (`html.faixa-subst-topo`). Sem aviso de
  texto da substituição (`TEXTO_EVENTO` sem `substituicao`). Letras desde o item 125 (contrato "Sistema tipográfico"): a sigla,
  o número e "ENTRA"/"SAI" na TM Cond 800 e o NOME na 800 em CAIXA ALTA (`text-transform`: o `innerText` volta em caixa alta e o
  `teste-substituicao-tela` T3 compara sem diferenciar a caixa); a menor letra 10 → 11 px.
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
  a faixa (data-texto exato; "ENTRA 22 Wallace" e "SAI 9 Diego" na tela) e `teste-hud-minimo` H7 o submenu sem rolar. No
  online (item 30): `teste-online-tela` P8a–P8i (`--so p8`; a escolha do anfitrião, cada lado segurando só a sua, o "Pular"
  de um só, os hashes, a opção desligada, o menu, o celular em pé, o fim da espera e o selo), `teste-online` O13–O15 e
  `testar-online3d --golaco` G1c (contrato "Online 1×1").

## Pré-jogo (pedido de 11/10; contrato)
(A passada de quem anda no cortejo — a fase e o ritmo de cada um, a saída do parado, os árbitros pré-rolados, o rumo pedido com
giro limitado e a camada do braço e do tronco — está no contrato "Passada natural fora da partida (item 61)", no fim.)
Pedido do dono: cenas de fora do estádio, o estádio, a entrada dos times, a fila com a câmera passando, cortes de torcida e
as duas escalações no campinho (~10 s cada, o mesmo fundo). Pesquisa e números em `PESQUISA-PREJOGO.md`. **Só desenho**: o
pré-jogo acontece ANTES do 1º passo da partida (o mundo fica no tick 0; `hash-igual` IGUAL; `teste-prejogo` confere o hash
de `criarPartida` depois dele e 600 passos Node = Chromium) e o apito da saída (`eventosIniciais`) só toca no fim. **Desde o
item 64** a TELA ANTES DO JOGO vem antes dele em todo jogo (contrato "Tela antes do jogo (item 64)"): com ela ligada a abertura
de texto ("Toque para começar") fica CALADA atrás dela, com o aéreo de fora como fundo, e o GESTO que libera o som é o "Jogar
partida" da tela (que chama `prejogo.comecar()`); sem ela (webdriver, `?prints=1`, `?demo=1`, `?prepartida=0`, a reserva de
1,5 s) a abertura de texto continua sendo o gesto, como antes. O resto do pré-jogo (roteiro, cortejo, Pular, preferências) não
mudou.
- **`js/cortejo.js`** (puro): `CORTEJO` (velocidade 1,45 m/s, espaçamentos no túnel/andando/na fila, colunas, árbitros
  ids 200–202; desde o item 61 a saída do parado `tau` 0,7 s, `atrasoArb` [0; 0,15] s e `giroMax` 2,2 rad/s),
  `criarCortejo(times)` → `{tick, mini, andantes: [{j, id, time (0, 1 ou 2 = árbitro), arb, goleiro, kit,
  k, caminho, s0, sFim, atraso, chegou, mp, vm}]}` (`mp` = `parametrosMarcha(id)`, `vm` = o estado da camada da passada — item
  61; mini-mundo `{tick, posse, naMao, parada, voo, bola}`: só o que a pose e a
  passada leem; lê `m.times` UMA vez, nunca o mundo depois), `passoCortejo(c)` (corpo, passada, pé desenhado, quadril — a
  ordem do `sim.js`), `tempoCortejo`, `fotoCortejo(c)`/`restaurarCortejo(c, f)` (structuredClone), `filaFinal(c)` (a fila
  montada parada, sem simular), `vagaFinal(c, i)`, `chegaram(c)`, `ordemDaColuna(tm)` (capitão, goleiro, vagas),
  `pontoCaminho`, `cabeNoTunel()`, `poseAndante(c, a, out)` (a pose DESENHADA: a do jogo + a camada do braço e do tronco; o
  `render/prejogo.js` desenha por ela). Sem rng. Campo novo que `anim.js`/`jogador.js` passarem a ler do mundo tem que entrar no
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
  qualidade(), comToque(), aoFim()})` → `{iniciar(modo, {abertura, muda}) (muda: a abertura calada, a tela antes do jogo por
  cima — item 64), refazerTimes() (o time mudou no tick 0 pelo Personalizar ou pelo Livre da tela: refaz o cortejo, os
  treinadores, as fotos e as escalações com os times NOVOS do mundo; o lado de fora e o roteiro ficam), mudo(v),
  quadro(dt, agoraMs, desenhar, parado) (false quando acabou; parado = celular em pé: o tempo não anda e o som fica como na
  pausa do jogo — `som.cena(null)` e `som.atualizar(emo, true)`), acao(a) ('pausa' pula tudo), proximo, pularTudo, irPara(t),
  comecar, cancelar, ativo, naAbertura, api}`. Câmera: escreve direto em `cam.camera` (fov do roteiro = vertical em 16:9; mais
  estreito, a mesma largura; near/far e a névoa por plano, restaurados no fim). Desenha o cortejo por `jog3d.atualizar(lista)`
  (kit `arbitro`), força o lado de cá visível pelo frustum (a regra `cameraNoLadoDeCa` é do jogo), um ânimo próprio
  (`criarEmocao`) para a torcida e o som, `som.cena({ganho,
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
  pularVisivel, botaoPular, mudo(v), muda}`. Toque/clique = próximo bloco (abertura: começa); Enter/Espaço também (na captura);
  Esc/P/Start chegam pela entrada bloqueada (`main.js tratarAcao('pausa')`). `mudo(true)` (item 64) cala os três ouvintes — o
  toque da camada, o Enter/Espaço na captura e o Ⓐ do controle — e `.muda` esconde a abertura; o Ⓐ é lido sempre (`lerPad`)
  e, quando a camada volta a ouvir (`mudo(false)`, `mostrar(true)`), um Ⓐ que já estava apertado NÃO conta como aperto novo (o
  do "Jogar partida" pulava o bloco das cenas; revisão A1 do item 64).
- **`js/escalacao-tela.js`** (DOM; desde o item 29 o campinho EM PÉ — dono, 17/10: "o campinho da escalação do jogo EM PÉ
  (retrato), não deitado"): `criarEscalacaoTela(raiz, ident)` → `{montar(times), mostrar(e) (escalacaoEm + tau), esconder(),
  estado, cartas(t), folha(t), campo(t)}`. Puras e exportadas: `ESCALACAO` (L/A do campo 0,80 — a Globo 2025 — até o teto
  0,85; o passo-alvo 0,164 × a altura (o da Globo: o CENTRO das cartas das pontas ~9% para dentro; a borda decide, abaixo);
  folga 10 px; `margem` 6 / `margemMin` 5; a carta até 120 px de largura e 44–76 de altura; as letras; fora do `config.js`, que
  é do fecho), `tamanhoEscalacao(W, H, {larguraNome, alturaTela, caixa})` → `{w, h, cw, ch, passo, inset, fora, fonteNome,
  fontePos, comPos, largura, teto, naLinha}` (W = a largura máxima do grupo do campo, H = a altura da área = a altura do
  campo; `larguraNome(px)` = o nome mais largo do conjunto — os 22 titulares para a altura, os 11 da folha para a carta
  (`tamanhosDasFolhas`); celular = `alturaTela` ≤ 480, 568×320 = < 350. O que cede, nesta ordem (revisão V1: as pontas NUNCA tangentes à lateral): as cartas das
  pontas DENTRO, com a borda a `margem` 6 px da lateral (mínimo `margemMin` 5) — o campo alarga de 0,80 até 0,85 —, na letra da
  conta e depois na mínima da tela (§7.4/§7.5 do PESQUISA-ESTADIO: celular 11, 568×320 10, PC 13); senão as pontas SOBRE a
  linha, centradas nela (inset 0, `naLinha`; meia carta para fora, `fora`); senão o nome sai com "…" (`teto`; só os de
  estresse). `caixa: {w, h}` = o campo já decidido (só as cartas saem da conta). A linha da posição sai (`sem-pos`, a posição
  fica no `aria-label`) se a carta não comporta as 3 linhas (`comPos`). Janela de PC em pé: a altura desce até o grupo caber e,
  se o nome segurar a carta, a letra e as cartas pela largura), `posicaoCarta(vaga, tam)` (o centro: x = inset + (col + 2) ·
  passo; y pela grade de 5 filas do `posicaoNaTela(…, true)`: o GOL embaixo, o LE à esquerda), `nomesTitulares(times)` e
  `larguraNomes(nomes)` (TM Cond 800, caixa normal: a maior entre a tabela exata e a dos avanços arredondados ao px) e
  `tamanhosDasFolhas(W, H, {larguras: [l0, l1], alturaTela})` → `[T0, T1]` (revisões A1/V2): as DUAS folhas com a MESMA caixa
  do campo — a altura pela conta dos 22 nomes, a largura pela maior das duas folhas (cada uma com os 11 nomes dela; volta à dos
  22 se o grupo não couber) — e a carta, a letra e o inset de cada folha pelos nomes dela. O layout refaz as duas juntas: a
  escondida é medida sem aparecer (visibility), a largura do grupo sai da coluna MAIS LARGA das duas e a altura da menor; na
  janela em pé as colunas ficam com a altura da maior. O campo tem o mesmo tamanho e o mesmo topo nas duas. `campo(t)` (só
  leitura; também `prejogo.escalacao.campo(t)`) → `{x, y, w, h, viewBox, largura, cw, ch, fonteNome, fontePos, comPos, inset,
  fora, teto}`. O nome do time acima de `ESCALACAO.nomeTimeLongo` (22) letras ganha `.longo` (menor, em até 3 linhas; revisão V6).
  As linhas do campo recortadas pelo canto arredondado (`clip-path` só no SVG; as cartas podem passar da lateral); a posição na
  TM Cond, mais leve que o nome; a reserva da TM Cond = faces `local()` com `size-adjust` (revisão V5; no `css/prejogo.css` até
  o item 125, desde ele no `css/estilo.css` com o 600: contrato "Sistema tipográfico"). O
  layout refaz a conta SEM os tamanhos de antes (o campo velho seguraria a linha da grade e o grupo largo
  espremeria a coluna do time) quando a folha, a área, a coluna ou a altura da tela mudam; o `montar` pede a TM Cond com o
  texto dos nomes (`document.fonts.load`). O movimento sai do relógio do roteiro (nada de transição do CSS: o relógio manual
  dos testes e prints vale); a cascata das cartas sobe do gol ao ataque.
- **`js/campinho.js`** (puro): `svgCampinho(vertical, largura?)` → `{viewBox, html}`. `largura` (m; item 29), em pé e > 68:
  as laterais até ela e a linha do meio na largura toda, o círculo (r 9,15) e as áreas (40,32 × 16,5 e 18,32 × 5,5) no tamanho
  real e centrados, viewBox `0 0 <largura> 105` — só a distância entre as laterais estica (o FM26). Sem ela, a saída de sempre
  byte a byte (o editor e a pausa; `teste-escalacao-campo` N3 compara com o hash da base). `posicaoNaTela(vaga, W, H, cw, ch,
  vertical)` não mudou.
- **`js/letra-cond.js`** (puro, item 29): `AVANCO` (os avanços da TM Cond 800 em 1/1000 em, latin-1), `larguraCond(texto, px,
  caixaAlta = true)` (a conta do nome que não espera a fonte; o `prepartida.js` reexporta — a mesma função) e
  `larguraCondInteira(...)` (cada avanço arredondado ao px: o Chromium sem posição subpixel do texto — Linux, o CI — dá até
  +0,5 px por letra). O `@font-face` da TM Cond mora no `css/estilo.css` desde o item 125 (antes no `css/prejogo.css`; os dois
  são do download inicial; a fonte só baixa quando um texto com ela aparece ou pela pré-carga ociosa da pausa — antes do item
  125, com webdriver, nunca: `teste-carga`); o `css/prepartida.css` usa o mesmo. A tabela continua a da 800 (os nomes de camisa
  da escalação seguem na 800, em caixa normal).
- **`som.js`**: `cena({ganho, filtro})` / `cena(null)` (substitui o alvo do barramento e do passa-baixas da pausa);
  `cenaPre`. **`jogador3d.js`**: `KITS.arbitro`.
- **`main.js`** (ganchos): `modoPrejogo()` (`?prejogo=` força; webdriver/`?prints`/`?demo` desligam; senão
  `prefs.prejogo`, padrão 'completo'), `comecarPrejogo(modo, abertura, muda = false)` (bloqueia a entrada; `muda` = a tela
  antes do jogo por cima), `fimDoPrejogo()` (libera a entrada, corta a câmera, `eventosIniciais()`), `quadro()` (no pré-jogo
  o laço fica parado: `laco.ultimo = agora`), `tratarAcao`, `trocarMundo(m, {prejogo: 'preferencia'|'escalacao', prepartida,
  antesDoJogo})` (`prepartida`: a tela antes do jogo abre e o pré-jogo fica para o Jogar; `antesDoJogo`: o mundo do tick 0
  recriado com a tela e o diretor mantidos), comandos `prejogo` (valor) e `prejogo-ciclo` (o botão "Pré-jogo da partida" do
  submenu "Modo de jogo": o próximo modo; `#estado-prejogo` mostra o atual; com a tela antes do jogo aberta, a escolha nova
  vale no Jogar), API `__golaco.prejogo` (`ativo, fase, modo, bloco, plano, indice, tempo, total, fimCenas, planos, pular(),
  pularTudo(), irPara(t), comecar(), iniciar(modo, {abertura}), andantesNaTela(), posicaoAndante(id), escalacao: {visivel,
  time, cheia, cartas(t), folha(t), pular, info(t), campo(t)}, camera, desenho: {chamadas, triangulos}, somCena, parado, vao, cortejo,
  fora}`); `quadro()` passa `parado` = `retratoBloqueado()`; `desenhar()` desenha o pré-jogo quando ele está ativo.
- **Testes**: `tools/teste-cortejo.mjs`, `tools/teste-prejogo-roteiro.mjs` e `tools/teste-escalacao-campo.mjs` (item 29: as
  contas da escalação em pé, N1–N5: em pé e no teto, a carta e a letra, o campinho do editor e da pausa byte a byte, a janela
  em pé, a mesma caixa nas duas folhas) (Node, padrão do CI), `tools/teste-prejogo.mjs` (navegador, CI; itens 4b e 15: a
  escalação em pé E1–E14 — em pé, o GOL embaixo, o lado, as linhas recortadas, as cartas no campo, a letra, nada cortado nem
  pela tinta nem por fração de px, sem rolar, a mesma caixa nas duas folhas, o Pular, a TM Cond, as pontas nunca tangentes, o
  nome do time em ≤ 3 linhas, a faixa da carta na cor do time — em 11 telas do PC e no celular; com `?tm` e nomes longos em 5
  telas — `lib/pedidos-tm.mjs PED_NOMES_LONGOS` —, o pedido misto `PED_NOMES_MISTOS` (colunas diferentes, a mesma caixa, as
  pontas do time de nomes curtos dentro) e 568×320 com o arquivo da TM Cond bloqueado (a reserva não corta nome); `--so-esc` roda
  só a escalação, ~1m40s), `tools/prints-prejogo.mjs` (prints de cada plano e das escalações + folhas de contato).

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
  minuto}` (desde o item 32 também `segundo`, `estado` e `acrescimo`: seção "Placar (17/10)"), `parada` e `placar`. **Parâmetros da página:** `?modo=partida|ataque|conducao` (padrão: partida) e `?min=N`
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
O goleiro da partida (chance de defesa pela folga física, encaixe × espalmada, set, 1×1, bola solta e saída no
cruzamento) tem o contrato próprio: "Goleiro realista (16/10)", no fim deste arquivo.

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
  `minutoDeJogo` fica em 45/90); o HUD mostrava "45+2'" e "1º T +4" — desde o item 32 o relógio continua em MM:SS ("47:13")
  com o "+4" no bloco do relógio (seção "Placar (17/10)").
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

### Carrinho (item 34)
Item 34 da FILA (dono, 17/10: "botão de CARRINHO — dividida deslizando; falta/cartão pela Regra 12"; 23/10: "preciso do botão
de carrinho"). Só da PESSOA: a IA não usa nesta entrega (item 75 da FILA). Pesquisa em `PESQUISA-ETAPA4.md` §18; constantes
em `config.js DEFESA_HUMANO.carrinho` (o corpo e o contato) e `FALTAS.carrinho` (a Regra 12). As escolhas de produto com a
recomendada aplicada: "CARRIN." no toque; ninguém cai (item 76); sem "levantar rápido"; vale em toda bola baixa (condutor,
passe, bola livre, chute) e parado (o impulso de 3 m/s); L/X na defesa = carrinho, com a bola alta = lançamento; o vermelho
direto de qualquer lado; dois carrinhos que se tocam: falta só de quem não tocou a bola quando o outro tocou.
- **O plano e o quadro** (`js/carrinho.js`, puro, folha: só `config.js`, `matdet.js`, `mat.js`; nada sorteia). No aperto,
  `montarCarrinho(j, tick, {bola, prever})` grava o PLANO inteiro em `j.carrinho` (declarado `undefined` na forma única do
  jogador), como o `j.mergulho`: `tick0`; centro, velocidade, rumo e quadril no aperto; a direção travada `ux, uz`;
  `ve, tq, v1, aD, tD, tS`; o pé da bola `frente`; os tornozelos desenhados `p0`; o ponto do pé dobrado no levantar
  `levX, levZ`; `esc` (o desarme 40 → 90: 0,85–1,05); `mirou`; `tChao`, `fim`. A simulação escreve só `bola` (o tick do 1º
  toque), `tChao`/`fim` (`marcarAcerto`), `homem` e `desarmou`; o `fimDoTempo`, `congela`; a pose, nada.
  `quadroCarrinho(c, t, q)` (t em s, aceita fração) dá o centro e a velocidade por fórmulas fechadas por trecho (contínuos no
  aperto: nada de teletransporte), a pelve, o yaw, as juntas das DUAS pernas no mundo (`qd`, `jo`, `to`, `po`), os apoios e o
  ponto da mão. Fases: a pelve cai pela gravidade (`tAr` 0,25 s, em qualquer entrada) → impacto do joelho ao quadril
  (`tImpacto` 0,15 s, −`perdaImpacto`) → deslize (`desac/esc`) → chão → levantar (0,5 s; o pé dobrado plantado). Da parada
  até de pé: `chaoErrou` 1,2 s, ou `chaoAcertou` 0,5 s quando a perna ganhou a bola antes da parada. A 4,75 m/s: 1,02 s até
  parar, 2,22 s fora do lance no erro. `carrinhoAtivo(j, tick)` (a regra do `mergulhoAtivo`, com o `congela`) vale só para a
  pose e a altura do quadril; na SIMULAÇÃO, fora do lance = o plano existe (já no tick do aperto). O plano sai no começo do
  1º passo com `m.tick ≥ fim`.
- **O disparo** (`defesa.js carrinho(m, j)`, sim.js passo 2): na BORDA do bit 256 (`BOTAO.CARRINHO`), só no controlado, só
  com `m.times` (partida ou Modo Livre), estado 'jogo', sem `m.disputa` e com a bola viva (sem parada nem `m.golTick`); fora
  do goleiro, do ar, de outro carrinho, da DIVIDIDA em andamento ou sem reação; a bola fora das mãos, do pé e de um voo do
  meu time e não alta (`bolaAlta`: no ar acima de `altoBola` 0,6 m ou subindo). A direção: o analógico (sem ele, a bola a ≤
  `assistLonge` 8 m; senão o rumo) com a ajuda de mira pelo ENCONTRO (a ponta da perna no quadro × a bola prevista em
  `encontro` 0,2–1,0 s, duas voltas, até `assist` 0,35 rad) e o desvio da corrida limitado (`desvio`: 90° a 2 m/s → 45° a 6,
  e ≤ asin(4,8/v)); depois do aperto nada vira. No aperto caem a ação carregada ou pedida, a DIVIDIDA, o CONTER, a recepção,
  o toque marcado, o pulo do cabeceio ainda no chão e a disputa pelo alto; evento `carrinho {id, fase: 'inicio'}`.
- **Os ganchos** (todos condicionais ao plano): sim.js passo 2 `passoCarrinho` (o corpo pelo quadro do próximo tick; pula a
  locomoção, o `semAtropelar` e a `paredeParada`), 2b `fixarCarrinho` + `pesCarrinho` (não é empurrado; os pés do quadro), 8
  sem `passoPeDesenhado`; `boteIA`, `dividida` e `atualizarBotoesAcao` saem no topo; não domina (`bolaLivre`); a
  `colisaoCorpos` não chama a `faltaNaCarga`; o `bloqueioPerna` o pula; `anim.js alturaQuadril`/`pose` leem o quadro
  (`poseCarrinho`). Fora das listas de quem AGE ou RECEBE (alvo de passe, controle e troca, 1º/2º homem, contrapressão, bola
  livre, corte de passe, marcação, PRESSÃO, disputa pelo alto) e de quem "chega antes" à bola livre (a recepção assistida,
  `recepcao.js`; o goleiro que vai com o pé, `regras-goleiro.js`); nas contas de forma e nos obstáculos ele continua
  contando. O controle pode sair dele no meio (o plano é do corpo); com a trava do TM fica com ele e as entradas são
  ignoradas até o fim.
- **A perna na bola** (`defesa.js contatosCarrinho`, passo 5 logo depois do `passoBola`; sem sorteio): as 6 cápsulas das
  pernas do quadro (coxa 0,085, canela 0,058, chuteira 0,045 m: os raios do `SEGMENTOS`; a pose as copia sem IK, então a
  perna que toca é a desenhada) contra o caminho da bola em 4 trechos por passo, pela distância exata segmento × segmento.
  Vale com a bola viva (`vivaCarrinho`), de 0 a `tS`, com o centro dela a ≤ 0,6 m, sem dono ou do ADVERSÁRIO; um toque por
  carrinho; entre vários, o mais cedo (trecho, fração do trecho, profundidade, o time `m.tick % 2`). A física: a normal da
  cápsula, a perna a ≤ `vPernaRel` 2 m/s do corpo, `eBola` 0,3. Pelo que a bola era: o condutor com a bola a ≥ `rouboVRel`
  1 m/s dele → GANHOU (`dividida {ganhou: true, carrinho}` + `roubada {carrinho}`; o desarmado sem domínio 0,5 s;
  `marcarAcerto`; `c.desarmou`); abaixo → raspão (a posse fica; `carrinho {fase: 'bola', de: 'raspao'}`, fora de TOQUES);
  chute do adversário → `bateuCorpo {bloqueio: true, carrinho}` (desvio: o gol continua de quem chutou); passe ou bola livre
  → `roubada {carrinho, de: 'passe' | 'livre'}` (o gol contra, o impedido que desliza marcado, o passe cortado).
  `impedimento.js`, `render/autor-gol.js`, `lances.js` e `tecnicos.js` leem esses tipos sem mudar. No passo do toque o disco
  do corpo dele não rebate a bola e o `bloqueioPerna` não roda. Sem toque, `dividida {ganhou: false, motivo: 'fora',
  carrinho}` sai quando a janela do homem FECHA (`fimDoDeslize`: tS + 0,7 s no erro), e não sai se houve falta: um desfecho
  por carrinho.
- **A perna no homem e a Regra 12** (`defesa.js contatosHomemCarrinho`, no fim do passo, com o quadro e a pose do tick novo
  num buffer pré-alocado; só com a bola viva, do aperto até o começo do levantar — a perna parada depois da parada é o
  tropeço —, um contato por carrinho em `c.homem`, os carrinhos em duas voltas com o time `m.tick % 2` primeiro): as pernas
  do quadro contra as pernas DESENHADAS dos adversários a ≤ `alcanceHomem` 2,5 m da ponta (deitado, com a pelve abaixo de
  `pelveDeitado` 0,6 m: o corpo inteiro e a cabeça). `f` = a aproximação dos CORPOS na normal do contato (o tropeço conta);
  `fExc` = só a do corpo de quem desliza. `faltas.js chanceFaltaCarrinho` (sem sortear): no Livre 0; o goleiro com a bola nas
  mãos 1; antes da bola min(0,95, `antes` 0,9 × `fatorForca(f)`); depois (o "follow-through") min(0,95, `depois` [chegada]
  0,10/0,20/0,45 × (1 + `porVel` 0,15 · (v − 4,5)⁺) × `rampaForca(f)`); sem redução na própria área. `faltaNoCarrinho` faz os
  ÚNICOS sorteios do carrinho: a chance (só com 0 < p < 1), o vermelho direto (antes da bola com `fExc` ≥ `excessivoF` 6 m/s:
  `excessivoP` 0,25, de qualquer lado — IFAB 12.4) e o amarelo pela chegada (0,30/0,35/0,55); depois `montarFalta(...,
  'carrinho', tentouBola, exc, temerario)` (o 7º parâmetro é novo, padrão false: os outros chamadores não mudam).
  `tentouBola` pela INTENÇÃO: a perna tocou a bola, ou `mirou` no aperto e a bola está a ≤ `tentouLonge` 2 m da perna no
  contato. SPA na própria área tentando a bola: pênalti SEM cartão, só na origem 'carrinho' (a correção do bote da IA e da
  DIVIDIDA muda a IA × IA: item 74). Dois carrinhos opostos que se tocam: falta só de quem não tocou a bola quando o outro
  tocou, sem sorteio de chance (abaixo de `forca.min`, incidental). No adversário: com falta, a velocidade × 0,5 e, com a
  bola, sem domínio por `FALTAS.queda`; sem falta, × 0,7; ninguém cai. A falta 'depois' no jogador que a perna desarmou
  desfaz o desarme: evento `desarmeAnulado {id, de, carrinho}`, e a súmula tira o desarme, a roubada e as perdas do toque.
  Daí em diante, o caminho de sempre (`registrarFalta`, `decidirFalta`: vantagem, tiro livre direto, pênalti; o cartão na
  bola morta).
- **Bola parada, intervalo e recomeços** (`partida.js`, `livre.js`): `teleportar` zera o plano e a altura do quadril (só com
  o plano: zerar a de todos mudaria a demo); `fimDoTempo` grava `congela` (a pose para no apito; a saída do 2º tempo zera);
  na montagem, quem ainda está no carrinho, fora o cobrador, vai de pé para fora da restrição (o time que não cobra) ou a
  `bolaParada` 2,5 m da bola (o que cobra), com o corte de câmera (`tirarCarrinhos`); "Bola no meu pé" do Livre põe o
  controlado de pé no lugar.
- **As cenas** (as cópias andam o resto no relógio da cena; o plano do mundo nunca muda): `comemoracao.js copiaJogador` clona
  o plano sem o `congela`; `passoCena` e `cena-atores.js passoAtores` andam pelo quadro com `a.noCarrinho` (zerado a cada
  passo: sem gestos, não cede, não fica fixo), e os gestos entram `RAMPA_CARRINHO` 0,35 s depois de ficar de pé
  (`misturarPose`); o `levar` desloca também o plano da cópia. Cena do cartão: a `paradaPrevista` pelo fim do quadro, a
  reação do punido depois de ficar de pé (`atrasoPun`), a cópia no carrinho levada de lado para longe da bola parada antes do
  1º quadro (`desvioDaBola`; `CENA_CARTAO.folgaBola` 0,04 m, até `desvioBolaMax` 1,6 m; `plano.desvioBola`) e o assentar
  voltando também os ticks do plano, do mergulho e do pulo das cópias. `cena-fim.js` não separa dos sólidos quem está no
  carrinho; `substituicao.js` põe a cópia de pé no lugar.
- **A pose** (`anim.js poseCarrinho`, pura, só `MD`): a pelve e as pernas copiadas do quadro; o tronco para trás (`tronco`
  0,9 rad) e caído para o lado da perna dobrada (`rolagem`); a cabeça olhando a bola a ≤ 16° da linha do tronco (o passo da
  cabeça da postura do corpo novo, 17°, não age); o braço de apoio com o antebraço deitado na direção do ponto `mao`; o outro
  aberto; no levantar, o tronco e os braços terminam na pose de pé parado. Corpo novo: os portões da postura
  (`render/esqueleto.js`) zeram o joelho e o tronco. A MÃO DE APOIO no chão é só do DESENHO (item 77, 06/11; a pose não
  muda e o fecho do hash fica igual): a pose deita o antebraço na altura do cotovelo (~0,11 m) até a junta `mao` (a
  ponta da mão no manequim, o punho no corpo novo), e o `render/apoio-mao.js` (contrato "Corpo humano realista") a leva
  ao chão pela própria pose — no manequim a ponta da cápsula a 0,003 m (era 0,073), no corpo novo o punho a 0,04 m com a
  palma virada para o chão (o vértice mais baixo da mão a 0,001 m, era 0,063; a palma 93° → 0° de −Y) — e anda junto da
  mão do jogo na queda e no levantar. Vale nas cenas e no replay (desenham pela pose) e também para quem cai sentado no
  chão (o peso é pela pose, sem marca do carrinho); o mergulho do goleiro e o tronco deitado, nunca.
- **A entrada** (`entrada.js`, `main.js`): L (teclado) e X (controle) com TRÊS sentidos no `SENTIDO_FASE`
  (`[LANÇAMENTO, CARRINHO, LANÇAMENTO]`): ataque = lançamento; defesa = carrinho; defesa com a bola alta = lançamento (o
  pedido de primeira e o cabeceio para longe no cruzamento do adversário), fixado no aperto (`criarSentidoFixo().bit(id,
  apertado, fase, alta)`; `definirFase(..., alta)` com `lancaNaDefesa` = sem `m.times` ou `bolaAlta`: nos treinos L e X
  continuam lançamento). Toque: `btn-carrinho` na vaga 'e' da defesa (6 botões), "CARRIN.", o bit no `pointerdown` (a
  resposta no quadro do toque), só com `html.em-partida`; H1 do `teste-hud-minimo` 7,90 / 9,80 / 10,98% (meta ≤ 11%: peça
  nova de HUD na defesa do celular estreito não cabe; o plano B é o arrasto a partir da DIVIDIDA). O `MASCARA_TRAVA` não tira
  o bit (o travado do TM dá carrinho); o CARRINHO não entra no `BOTOES_DEFESA`.
- **Online**: o bit 256 vai nos bytes 3–4 da entrada de 9 bytes (`online.js`) sem mudança; a simulação é a mesma nos dois
  aparelhos (só `MD`, sorteios pelo `m.rng`, as guardas do disparo valem sem a fase da página, dois carrinhos sem depender da
  ordem). Junto, a correção de um defeito publicado: `entradaValida` aceita PARADINHA e PULINHO no byte 5 (antes o pacote com
  Espaço ou F apertados era descartado e o lockstep parava; `teste-online` O1d).
- **Hash**: a IA nunca liga o bit e o `hash-partida` não o sorteia; sem o aperto `j.carrinho` fica `undefined` e nenhum ramo
  novo roda nem sorteia. `hash-igual` (treino) e `hash-partida` (demo e humano) IGUAIS aos da main antes do carrinho
  (`56a64c90`); o painel do CI repete a tabela da base. O plano não entra no `hashMundo` (como o `mergulho`): o efeito entra
  pelo corpo, pelos pés e pelo rng.
- **Testes**: `teste-carrinho` (padrão, 2 processos, ~90 s; na base reprova com "não existe nesta lógica"): 0 estrutura; A
  física (A1 o deslize a 4,75 m/s em 0,95–1,15 s; A3 a pelve ≥ 0,05 m abaixo em 0,1 s; A5 1,2/0,5 s; A6 sem salto da pelve,
  das mãos e da cabeça); P pose e corpo novo (P2 as pernas = o quadro; P3 as réguas do `teste-ossos`; P6, item 77, a mão de
  apoio DESENHADA no deslize e no chão: o manequim −1 a +1,5 cm do chão e todas as cápsulas ≥ −1 cm; o corpo novo o vértice
  mais baixo da mão −1 a +1,5 cm, a palma ≤ 25° de −Y, a dobra do punho ≤ 70°, a seção da pele no cotovelo e no punho
  ≥ 85%; a continuidade — o pico da 2ª diferença da mão desenhada por fase ≤ 1,3 × o sem a mão de apoio + 2 mm; na base
  reprovam a mão dos dois corpos e a palma); B a perna na bola
  contra um árbitro independente; C o canhão de 576 carrinhos em 16 estados do meio da partida (C1 e C6 reprovam pela prova
  binomial; C2–C5 informativas contra a Wyscout no subconjunto alcançável); D a Regra 12 montada (D1–D14); E as travas; F o
  determinismo (F2 os sorteios por origem; F4 o online espelhado); G as cenas (G1–G9). E mais: `teste-entrada`,
  `teste-controles` (L, X e o toque; nos treinos, lançamento), `teste-botoes` B16, `teste-online` O1c/O1d,
  `teste-dois-humanos` C4, `teste-math-proibido` (o bit na LISTA) e `teste-hud-minimo` H1 (com 2 casas).

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
  667×375, 568×320 e, desde a revisão do item 32, 640×360, com entalhe, ataque e defesa) a união das formas do HUD (caixas
  visíveis do `#hud`, botões como círculos, analógico em repouso se a opacidade passar de 0,25) cobre ≤ 11% da tela (≤ 12% em 568×320 desde o item 32: seção
  "Placar (17/10)", decisão do dono, FILA "Depende do dono" 15); 0 caracteres fora do placar (desde os
  itens 59 e 60, também fora do nome do condutor nos cantos de baixo: exceção escrita, só "número nome"); ≤ 15%
  dos pixels de torcida atrás do HUD; 0 amostras com a linha viva; PC ≤ 2,5% depois de 9 s. Peça nova de HUD na partida
  tem de caber nisso (ou ir para a pausa). Desde os itens 59 e 60 (seção "Faixa de baixo" abaixo) o nome do jogador com a
  bola conta (o mais largo, no canto da fase) e a caixa sem fundo, sem borda e sem sombra conta pelo que se vê (o ≡ da
  partida pelo ícone): 10,95% (568×320 com entalhe, defesa, o nome de 88 px) MEDIDO COM O RELÓGIO EM "0'" (240 passos depois
  de abrir); pela régua de antes daria 11,77% — o H1 só passa com a régua nova (FILA "Depende do dono" 14). Achado do item 32:
  com o relógio de verdade aquela base já ia a 11,06% ("34'") e a 11,95–12,06% nos acréscimos em 568×320; desde o item 32 o
  H1 mede 4 estados do relógio ("34:12", "+4", "+10", intervalo) e, desde a revisão, os 4 mais largos (gols de 2 dígitos, o
  relógio de 3), sem e com a cara do TM (seção "Placar (17/10)").
- **`index.html`/`css/estilo.css`**: o placar é a barra de TV da seção "Placar (17/10)" abaixo (antes: compacto de 30 px
  no celular e 34 no PC, sem a marca; em 12/10, 24/26 px com o "1º T" só no intervalo, no fim e nos acréscimos; desde o item
  32, 28/26/30 px com o relógio MM:SS, o "+N" só nos acréscimos e "Intervalo"/"Fim" no lugar do relógio); menu só com o ícone (44×44); barra de
  força 44×6 sem o rótulo (`#carga-tipo` continua com o texto, escondido); dica de teclas do PC (`#dica`) some 8 s depois
  de `hud.pronto()` e de cada troca de modo (desde os itens 59 e 60 ela não volta quando uma camada sai: `.vista` no
  `animationend`, até o próximo `mostrarDica`). Botões de toque translúcidos (fundo 0,32, borda 1,5–2 px, sem sombra) com
  o ícone e o nome (`html.nomes-botoes`, `--ic`, `--fs`) — LIGADO sem escolha salva desde 12/10 (dono: "coloca o nome da
  função do botão de novo"; `main.js nomesLigados`); "Nomes nos botões" desligado na pausa = só o ícone (`--ic-so`). Analógico em repouso a 0,3 × a
  opacidade e sem o pino; com o dedo, como antes. Minimapa 112×73 a 0,8 (embaixo no meio; no celular também, 92×60, desde o
  item 59: "Faixa de baixo"); escondido com `html.mapa-desligado` ou, sem
  escolha salva, com `html.com-toque` sem `html.mapa-ligado` (escondido não redesenha: `hud.minimapa` sai antes).
- **Pausa**: desde o item 58 (seção "Pausa (item 58)" abaixo) o Minimapa e os Nomes nos botões são linhas liga/desliga das
  Opções da pausa (`#chip-minimapa`, `#chip-nomes`, `aria-pressed`; "Nomes nos botões" só com `html.com-toque`); o H7 do
  `teste-hud-minimo` confere o topo novo da pausa (a marca e a competição; a pílula e o X). Antes (11/10–03/11) eram dois
  botões na barra de cima da janela, para a pausa caber sem rolar em 844×390. `data-cmd="minimapa" | "nomes"` → `comando(cmd, valor?)` (sem valor alterna; 'ligado' |
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
- **Testes**: `teste-hud-minimo` (H1–H8; H12 e H13 da faixa de baixo; `--raiz <pasta>` mede outra cópia; o H5 espera a animação da dica acabar — o
  relógio das animações do Chromium sem GPU atrasa do real com a máquina carregada — e o H7 confere o topo da pausa nas 3
  telas: até o item 58 a barra com o Minimapa e os Nomes; desde ele, a marca e a competição, a pílula e o X), `teste-entrada` (5 botões, nada no 2º anel, `criarToqueOuSegura` e do toque ao jogo: tocada = bote, segurada =
  conter), `teste-controles` (lista da defesa com 5 e a DIVIDIDA tocada/segurada/cancelada pelo sistema com toque de
  verdade; volta ao tamanho salvo). `tools/prints.mjs`: sem as cenas da linha viva;
  cenas `*-jogador-ve*` sem o `?prints=1` (a página como ela abre).

## Faixa de baixo (23/10, itens 59 e 60) — o minimapa embaixo no meio e o nome do jogador com a bola nos cantos (contrato)
Pedidos do dono (23/10): "o campinho que está lá em cima tem que ficar lá embaixo" (59) e "o nome do jogador com a bola fica
tapando e atrapalhando o jogo" (60). Pesquisa e medidas em `PESQUISA-ESTADIO.md` §7.2 (o "Radar" embaixo no meio e o
"Player Box" de cada lado, espelhado, da tela da partida do PES 2019). **Só desenho, DOM e CSS**: nada no fecho do hash
(`fecho-hash --diff` = 0; as constantes moram no `entrada.js`, no `hud.js` e no `main.js`, fora do `config.js`);
`hash-igual` e `hash-partida` IGUAIS.
- **A faixa de baixo** (`entrada.js FAIXA_BAIXO` = 22 px: 3 de margem + 15 do nome + 4 de folga): `calcularLayoutToque` põe
  o arco a `max(borda, FAIXA_BAIXO)` da borda segura de baixo (dos lados e em cima, a `borda` de sempre) — o arco sobe 8–10 px
  de 70 a 100% e nada a 120% ou mais; o analógico em repouso já ficava a 22 px (`repousoAnalogico()` → `{x, y, r}`; com os
  controles escondidos por uma camada a zona é a do CSS). `layoutToque()` na interface da entrada → `{W, H, sa, botoes: [{x,
  y, d}] de TODAS as vagas posicionadas (as duas fases, PEGAR, TROCAR da mão, CURVA, estilos do pênalti, CORRER), analogico:
  {x, y, r}}` ou null sem toque; o `main.js` passa ao HUD (`criarHud({layoutToque})`). O curso do analógico, a zona da metade
  esquerda, os diâmetros e a origem com o dedo não mudam (com o dedo, a base pode passar por cima do nome da esquerda e da
  borda do minimapa: ela é desenhada por cima e o polegar está ali de qualquer jeito). Correção achada no teste novo: o
  `mostrarToque(true)` de todo pointerdown da zona chamava `baseRepouso()` no quadro seguinte sem olhar o dedo — a base voltava
  ao canto, apagada, com o dedo na tela até ele passar do raio; agora só sem dedo (como no resize).
- **Minimapa** (`hud.js ajustarBaixo`, chamado no fim de `ajustarTopo`: resize, layout dos botões, "Tamanho", o botão
  Minimapa, as fontes do TM): no celular (`html.com-toque`) embaixo no meio, com a base a `sa-b + 3 px`; o maior de 92×60,
  84×55 e 76×50 que cabe a ≥ 8 px do analógico em repouso e de todas as vagas, no meio ou deslizando de 1 em 1 px até 12% de
  W para o lado do vão (`MAPA_BAIXO`); escreve `--mapa-cx/-w/-h` no `<html>` (só quando muda). Nenhum cabe →
  `html.mapa-sem-lugar` (some; o `#chip-minimapa` continua ligado, com o `title`/`aria-description` dizendo por quê; volta
  sozinho quando o tamanho, a tela ou o entalhe mudam). No padrão (80%) cabe 92×60 nas telas medidas (em 568×320 com
  entalhe, 20 px fora do meio). Some também com a faixa do fim de jogo (`html.fim-faixa`) e com uma faixa do meio que chegue
  a ele (`html.mapa-sob-faixa`, medido em `hud.faixa`: a "Você foi expulso" em telas baixas), além das camadas, da disputa e
  da mira como antes. PC: o de sempre (112×73 embaixo no meio, a 14 px). O topo do celular fica placar | painel (treinos) |
  menu: saiu o minimapa do `caixasTopo`, o `mapaAoLado` e o 5º passo; o `encostaTopo` não devolve mais `false` com o minimapa
  escondido (os treinos com o painel passam a apertar quando encosta); na partida a ordem é c1 → c2 → c4 → c3 (o "1º T +4" — desde o
  item 32 o "+N" — é o último a sair), nos treinos c1 → c2 → c3 → c4.
- **O nome** (`index.html #nome-condutor.nome-condutor[data-caixa="nome"]` DENTRO do `#hud`, antes do `#carga`: `.nc-cor` +
  `.nc-num` + `.nc-nome`; `hud.nomeCanto(n)` com `n = null | {time, num, nome, apagado}`; `get nomeCantoEstado` → `{visivel,
  lado, texto, apagado}`): o time 0 (à esquerda no placar) no canto de baixo à ESQUERDA, `[faixa | número | nome]`; o 1 à
  DIREITA, espelhado (`.dir`, `row-reverse`) — pelo índice do time, que é a posição no placar (vale depois da troca de lado do
  intervalo, no online e com o humano visitante no TM). A faixa = a cor do placar daquele time (`times[t].cor`; sem ela, o
  verde e o claro do CSS). Número branco, nome sem caixa alta com reticências; celular 15 px de altura, letra de 11 px, a 8 px
  da borda e 3 px da base, até 88 px (≤ 600 px de largura) / 120 px e nunca além da largura livre do canto (`ajustarBaixo` →
  `--nome-livre-esq/dir`, a ≥ 4 px de todo círculo e ≥ 8 do minimapa ligado; < 56 px → `html.nome-sem-lugar-esq/dir`, some);
  PC 18 px, letra de 12, a 14 px dos cantos, até 200 px (e sem chegar ao minimapa do meio). `pointer-events: none`. Escreve no
  DOM só quando muda (`textContent`, nunca HTML). Cara do TM: `html.tm .nome-condutor` (Inter TM, o cartão do TM; desde o item
  125 o número na TM Cond 800, `teste-tm-tela` 5b).
- **Quando** (`main.js marcarCondutor(agoraMs)`, sem projetar nada): com `mundo.posse` (`NOME_SEGURA_MS` 800, `NOME_VOO_MS`
  3000) na partida e no Modo Livre (`mundo.times`), fora da disputa (`mundo.disputa`), dos prints, das cenas (gol, cartão,
  substituição, intervalo/pós-jogo), do replay, do pré-jogo e do `partida.estado` 'intervalo'/'fim'; nos treinos não aparece
  (sem `mundo.times`). Bola solta: o último dono fica apagado (opacidade 0,6) enquanto ela voa num passe/chute (`mundo.voo`,
  até 3 s) ou 0,8 s no resto, e então some; escondido, só volta depois de 0,8 s (nada de piscar a cada passe). Um rótulo por
  vez. CSS: some nas 4 camadas (`html.em-*`), com `fim-faixa`, `modo-penaltis`, `modo-prints`, `sem-hud` e sem lugar; no PC,
  com a dica de teclas na tela (`html.dica-visivel` e `--dica-w`, ligados em `mostrarDica` e a classe tirada no `animationend`
  do `#dica`) o nome da esquerda fica na mesma linha, à DIREITA dela (em cima dela, como a especificação propunha, ele
  encostava 8 px na faixa ENTRA/SAI do jogo, que mora logo acima: `teste-substituicao-tela` T8); em janela estreita (entre a
  dica e o minimapa do meio cabem < 56 px, abaixo de ~690 px) ele some até a dica sumir (`html.nome-sem-lugar-dica`, `hud.js
  nomeComDica`, refeito no resize). No `animationend` a dica ganha `.vista` (display:none) até o próximo `mostrarDica`: antes,
  cada camada que a escondia (replay, comemoração, cena, substituição) recomeçava a animação na saída e ela voltava por 8 s
  sem o `dica-visivel`, debaixo do nome (defeito da volta já existia na base; H13g liga e desliga `em-replay`/`em-cena`). O `.qps` (depuração) foi para o alto à direita também no PC. API de teste:
  `__golaco.nomeCantoDeTeste(spec | 'nenhum' | null)` e `__golaco.nomeCantoEstado`.
- **Orçamento** (`teste-hud-minimo`): o nome conta no H1 (o mais largo, forçado no canto da fase) e a régua mede pelo que se
  vê a caixa `[data-caixa]` sem fundo, sem borda e sem sombra (a união dos filhos visíveis: o ≡ da partida, alvo de 44×44
  transparente, conta o ícone de 22×22). H2: o nome é exceção escrita, só "número nome". Testes: `teste-entrada` (E-faixa),
  `teste-hud-minimo` (H1, H2, H12a–f, H13a–g), `teste-controles` (o nome não pega toque; os layouts de 70–140% com os dois
  nomes), `teste-tm-tela` 5b, `teste-substituicao-tela` T8, `teste-penaltis-tela` 1b.
- **Medidas** (base 643e2a87 → PR, `teste-hud-minimo`, `teste-entrada`): faixa livre embaixo do arco 12,0 → 22,0 px; o
  minimapa ligado no celular no alto → embaixo no meio (92×60 a 80% nas 6 telas medidas; em 568×320 com entalhe, 20 px fora do
  meio); torcida atrás dele (844×390, 8 instantes) 5,4% → 0,0%; o nome: em cima do jogador → nos cantos, 19 → 0 voltas depois
  de < 0,8 s escondido em 2 min (visível 43% → 95% do tempo: com a bola solta ele fica apagado), escritas no DOM 2913 → 207
  (59 → 4,2 por nome); H1 no pior caso (568×320 com entalhe, defesa, o nome de 88 px; medido com o relógio em "0'" — com o relógio
  de verdade a base passava dos 11% ali: 11,06% no jogo e 11,95–12,06% nos acréscimos, ver "Placar (17/10)"): régua nova 10,16%
  sem o nome → 10,95% com ele; régua de antes 10,98% → 11,77% — passa dos 11%: o H1 só passa com a régua nova (decisão do dono, FILA "Depende do dono" 14); PC (H5) 1,5% → 1,6%. `fecho-hash --diff` 0; `hash-igual` e `hash-partida` IGUAIS.

## Pausa (item 58; 04/11) — a pausa do FC 24 com o campinho do meu time no canto direito (contrato)
Pedido do dono (23/10): "não quero ele assim, quero ele igual ao do FIFA" (a pausa do EA FC 24), "só quero que tenha que
aparecer o campinho do time no canto direito". PR #602 (FILA item 58; as escolhas no "Depende do dono" 18). Pesquisa em
`PESQUISA-ESTADIO.md` §7.4. **Só DOM, CSS e página**: `index.html`,
`css/estilo.css`, `css/tm.css`, `js/hud.js`, `js/entrada.js` (fora do fecho), `js/main.js`, `js/livre-pagina.js`,
`js/online-pagina.js` e os novos `js/pausa-tela.js` + `css/pausa.css` (sob demanda); `escalacao.js`, `formacoes.js`, `elenco.js`,
`tatica.js` e `config.js` só lidos. `fecho-hash --diff` 0; `hash-igual` e `hash-partida` IGUAIS. Com a pausa aberta o mundo
fica parado como antes (no online o jogo anda, de propósito: a IA joga pelo meu controlado).
- **O DOM** (`index.html`; ids e `data-cmd` de antes mantidos): `#menu.sobreposicao.pausa[data-entrada]` > `.janela-menu`
  (`role="dialog"`, `aria-modal`, `aria-labelledby="menu-titulo"`) com a `.pausa-faixa` (o `.janela-topo`: a marca
  `<svg class="pausa-marca"><use href="#marca-golaco">` — o símbolo do placar, que passou a `<symbol id="marca-golaco">` no
  sprite — e o `h2#menu-titulo` "<span class=sr>Pausa: </span><span id=pausa-competicao>"; o `.menu-corpo` com o 1º nível
  `#menu-acoes` e os submenus `#menu-opcoes`, `#menu-modos`, `#menu-estatisticas`, cada um com a `.sub-topo` = Voltar
  (`data-cmd="<nome>-voltar"`) + o título; a `.pausa-comandos` do PC, `aria-hidden`) e a `.pausa-direita` (`.pausa-topo-dir`
  com a pílula `#pausa-placar` `role="img"` e o X `.btn-fechar[data-cmd=continuar]`, e o cartão `section#pausa-time`
  `role="region"`). O fim do 1º nível tem a âncora `<!--fim-->`: o Reiniciar, o Simular o resto e o Voltar ao TM moram antes
  dela; no fim de jogo o primário do fim (Jogar de novo / Voltar ao TM) sobe para o 1º lugar (`hud.js ordenarFim`).
- **O 1º nível, na ordem do FC 24** (o `data-so`, a trava e o online escondem; `pausa-medidas.mjs ORDEM` por modo): Voltar ao jogo
  (primário, foco ao abrir) · Editar time · Estatísticas · Replay · Opções · Modo de jogo (no TM, "Partida e cenas" — era "Cenas da
  partida" até o item 33, que pôs nele a linha "Duração | Dificuldade") · Ajuda e
  controles · Reiniciar partida · Simular o resto · Voltar ao TM. Nos treinos: Voltar · Recomeçar · Máquina de passes · Marcador
  · Opções · Modo de jogo · Ajuda. No Livre (`livre-pagina.js`, ANTES do Replay): Jogadores e Câmera (com o estado em
  `small.estado`) e a `.linha-par` "Recomeçar" (Recomeçar | Bola no meu pé). Online (`online-pagina.js`): Pausar depois do
  Voltar e Sair por último, os dois por `aoTocar`. Lista de TEXTO, sem caixas: a linha na largura toda da faixa (28–44 px no
  celular, `--item-h` no PC), o item com o foco (`.selecionado`, que segue o `focusin`; o mouse dá o foco no `pointerover`; o mousedown de compatibilidade de um TOQUE só dá o foco se o nível não mudou — o ≡ deixa o foco em Voltar ao jogo, não no X que mora no lugar dele; revisão F4) em
  800 com a barra verde e o brilho verde para a direita (`--item-f`/`--item-f-foco`). **Desde o item 125** a lista é a TM Cond
  (600; o foco na 800, caixa normal, sem espaçamento extra): 18/20 px no celular (foco 19 com ≤ 660 px de largura; 17/18 com ≤
  600), no PC `min(3,1vh, (faixa − 32 px) / 11,5)` e `min(3,9vh, (faixa − 38 px) / 8,1)` no foco (o item mais longo, "Voltar ao
  Total Match" na TM Cond 800, mede 7,9 em e o foco anda 6 px); a barra de 4 px cresce de `scaleY(0.2)` a 1 com sombra verde e o
  `.item-txt` anda `translateX(6px)`, 160 ms `cubic-bezier(0.05, 0.7, 0.1, 1)` (Material 3, "short3" e "emphasized
  decelerate"); ao abrir, a lista entra em cascata (20 ms por item, ≤ 200 ms; `animation-fill-mode: backwards` — com `both` o
  "to { opacity: 1 }" passava por cima do apagado do item desabilitado, revisão C-R1; o desabilitado entra até 0,45); "reduzir
  movimento": só a troca de estado. Até o item 125: Inter TM 500/800, a barra de 3 px parada, 15/17 px no celular e 1,13×/1,36×
  com `(faixa − 32 px) / 10,6` e `/ 14,4` no PC (revisão F1); o texto de cada item num `<span
  class="item-txt">` com "…" de SEGURANÇA (o estado à direita cede o lugar primeiro; o `teste-pausa-tela` P1 reprova qualquer
  corte, com o foco em cada item); o primário sem foco em verde-claro. A descrição de antes (`small.desc`) só para o leitor de
  tela (`aria-describedby`); o estado (`small.estado`) à direita, o único que ganha "…".
- **Opções** (`#btn-opcoes` → `#menu-opcoes`): Qualidade (+ `#info-qualidade`), Câmera, Minimapa (`#chip-minimapa`, linha
  liga/desliga com a chave desenhada, `aria-pressed`), Replays (`aria-label` "Replays automáticos"), Horário, Tela cheia (linha
  liga/desliga, `aria-pressed`; só com `document.fullscreenEnabled`), Som (`aria-label` "Som da torcida"), Volume, Nomes nos
  botões (`#chip-nomes`, só com `html.com-toque`), Tamanho e Transparência. Cada grupo `role="group"` com nome. Saíram os chips
  da barra de cima da pausa de antes (seção "Tela limpa"). **Estatísticas** (`#btn-estatisticas`, partida) → `#menu-estatisticas`
  com a `table.pausa-est` (legenda, cabeçalho com escudo e sigla, `th scope=row` no meio; posse, chutes, no alvo, escanteios,
  faltas, cartões — a `sumula.js estatisticas`, o mesmo do painel do intervalo, `ROTULOS_EST` do `cenas-tela.js`), refeita a cada
  abertura (no online, 1× por segundo com ela à vista). **Modo de jogo** como antes (no celular em grade: Jogos | Modo Livre,
  Treinos, a linha das cenas).
- **Layout** (`css/estilo.css`, bloco "Pausa (item 58)"; nada depende de JS para caber): o jogo congelado à vista, sem véu; a
  faixa escura (`#050807` a 0,9) do x 0 até o fim da lista + 16 px e o degradê depois (`--fx-cheia`, `--fx-fade` 12vw no
  celular, 18vw no PC — 22vw até o item 125); dois regimes pela ALTURA — celular deitado (≤ 480 px; a lista em px a `--sa-l +
  --pm`, `--pm` 16/14/12 px por largura, a faixa de `clamp(176px, 18vw + 80px, 236px)` — `clamp(196px, 18vw + 100px, 260px)`
  até o item 125: a TM Cond é ~25% mais estreita que a Inter —, os itens em `flex: 1 1 0` de 28 a 44 px) e PC/tablet
  (≥ 481 px; as proporções do FC 24 medidas em 1280×720: o texto em 5,2vw, a marca em 4,3vh, o 1º item em 19,3vh, o passo
  6,67vh, a letra (item 125) 3,1vh e 3,9vh no foco — antes 2,65vh e 3,6vh —, a lista em `max(21vw, min(38vh, 27vw))` — antes
  `max(24vw, min(42,66vh, 30vw))`; ~21,4vw no 16:9 (38vh), fora dele (4:3, 5:4, 16:10) cresce pela altura até 27vw —, `max(24vw,
  min(380px, a tela útil))` nas Opções, Estatísticas, Modo de jogo e nos submenus do
  Livre, a linha dos comandos em 93vh). PC baixo (481–640 px de altura: o notebook fora da tela cheia): as Opções em 2 colunas
  na faixa de até 540 px, sem o cartão nesse submenu abaixo de 860 px de largura (revisão F2/F3). Nos submenus do celular (`data-nivel="sub"` na `.janela-menu`, posto pelo `hud.js marcarNivel`; o
  `data-sub` = o id) a faixa vira a tela inteira, a competição sai (a linha do Voltar fica na altura do X), o cartão e a pílula
  saem de cena e as Opções vão em 2 colunas. Janela estreita de PC (< 560 px): só a lista. `#menu [hidden]` = `display: none
  !important` (as regras da pausa põem `display` nos itens). Com a pausa (ou a Ajuda) aberta, `html.pausa-aberta`: o HUD do
  jogo, os botões de toque e as camadas de cena saem (`visibility: hidden`; o `ajustarTopo` mede igual) e ficam `inert`; o
  `#aviso` fica à vista, FORA do `inert` (o `hud.js` põe o `inert` em cada filho do `#hud` menos ele — um `MutationObserver` pega
  as tarjas das cenas que chegam com a pausa aberta —: o leitor de tela anuncia o `role="status"`) e por cima da pausa (o `#hud`
  sobe a `z-index` 41, acima do `#menu` e abaixo do Editar time; revisão F6).
- **O canto direito**: a pílula do placar (`hud.js espelharPlacar`: o espelho do placar do HUD — siglas, gols, escudos e o
  relógio —, escrita ao abrir e, com ela aberta, nas mesmas funções que escrevem o placar; nos treinos não aparece; sem lugar
  entre o topo da faixa e o X perde o relógio e depois os escudos, `ajustarPilula`), o X no lugar do ≡ (44×44, fecha) e o
  CARTÃO do meu time em `--card-y` (66 px no celular, 72 no PC) com `--card-w` — desde o item 125 até 400 px no celular e
  `max(36vw, 300px)` no PC (o campo de dentro ≥ 280 px dá o disco de 25 px e a letra de 11); até o item 125, 300 px e
  `max(30vw, 270px)`. Quando a ALTURA é o limite (o celular) o `layout()` ajusta a largura do cartão ao campo (`Wfit =
  min(W, ⌊Hlivre / 0,8015 / 1,06⌋)` + padding e bordas; sem isso o campo ficava esticado na largura). A altura livre sai de uma
  SONDA no mesmo pai com o `max-height` computado (era `calc(100% − 99px)` e o `parseFloat` dava NaN: a conta caía no
  `innerHeight` e o campo vazava 8–9 px do cartão em 568×320, nas duas edições). Fora de cena (num submenu o cartão sai:
  `display: none`) o `layout()` sai ANTES de mexer na largura e a janela que muda de tamanho também refaz a conta (revisão C-R2:
  zerada fora de cena, o cartão voltava 2 quadros na largura do CSS e o ResizeObserver o encolhia dentro do callback — o erro
  "ResizeObserver loop completed", 2–3 por tela).
- **O cartão** (`js/pausa-tela.js` + `css/pausa.css`, sob demanda; `criarPausaTela({cartao, est})` → `{time(d), estatisticas(d),
  layout(), estado}`): o cabeçalho (escudo + NOME DO TIME com "…", na TM Cond 800 em caixa alta, `clamp(15px, 1.7vh, 20px)` no
  PC; desde o item 125 ele SAI no celular deitado — a pílula do placar ao lado já tem os escudos e as siglas — e o campo ganha a
  altura dele; o `aria-labelledby` continua apontando para ele), o MEU MEIO CAMPO EM PÉ (o `campinho.js svgCampinho(true)` com
  `viewBox "0 51 68 54.5"` e `posicaoNaTela(…, true)`, como o FIFA 23) e uma ficha por vaga: o disco na cor do uniforme (o
  goleiro com a dele) com o número e o nome de camisa embaixo ("…" quando não cabe), o cartãozinho amarelo, o ↑ de quem entra na
  próxima parada, o anel verde-claro de "você" (o controlado ou o travado do Rumo ao Estrelato) e o expulso como a vaga VAZIA
  (disco tracejado e o cartão vermelho). **Item 125**: a formação (TM Cond 800 branca, `--pt-forma-f` = 6,2% do campo, 18–40 px)
  e a mentalidade (TM Cond 600 em caixa alta, verde-claro, `--pt-ment-f` 11–15 px) GRANDES DENTRO do campo, no canto de baixo à
  esquerda (`.pt-formacao`, livre em toda formação: a fila do goleiro só tem o goleiro) numa plaquinha escura como a dos nomes
  (revisão V-R5: no celular a mentalidade passava por cima da linha da área) — o `.pt-forma`/`.pt-ment` do cabeçalho ficam no
  DOM só para o estado (escondidos); o cartão com o fundo em degradê e a borda de cima de 3 px na cor do time (`--pt-cor`); o
  campo com 11 faixas de corte sutis e as linhas a 26% (antes 20%); o disco com borda branca de 2 px, sombra e um brilho radial,
  o número na TM Cond 800 a 0,56 × o disco (`--pt-num`); o nome numa plaquinha escura (`rgba(5,8,7,.72)`) na TM Cond 800 em
  CAIXA ALTA, sem a sombra de texto; "você" com a plaquinha BRANCA e letra preta e o anel com brilho (o "selecionado" do Team
  Management do FC); o amarelo e o ↑ proporcionais ao disco. `tamanhoCampinhoPausa(W, H)` (item 125): o campo na proporção do
  meio campo com 6% a mais de altura (`h = min(H, W·0,8015·1,06)`), o disco `clamp(18, round(8 + 0,062·W), 40)` limitado pelo
  passo das 5 filas (disco + 2 + a linha do nome + 2 ≤ (h − 20)/5), a largura da coluna `⌊(W − 24)/5⌋`, a letra do nome
  `clamp(11, min(round(0,44·disco), ⌊(cw − 6)/4,8⌋), 18)` ("ALBUQUERQU", 10 letras de ~0,47 em + os 6 px da plaquinha) e 10 só
  quando o passo das filas não cabe com 11 (568×320). A plaquinha do nome passa da coluna quando há lugar (`--pt-nm-max`: até 4
  px do vizinho mais perto na mesma altura, da borda do campo e da plaquinha da formação; nunca menor que a coluna) e, ainda sem
  lugar para algum nome, os nomes do cartão TODO vão para a TM Cond 600, ~5% mais estreita (`.nomes-estreitos`; revisão V-R8).
  Até o item 125: disco `clamp(16, round(6 + W·0,056), 34)`, letra 11 (10,5 abaixo de ~250 px; a metade do disco a partir de 26),
  o campo esticado até +15%, a formação e a mentalidade no cabeçalho. Um resumo `.pt-sr` para o leitor de tela
  ("4-3-3, Equilibrada. Goleiro: …"), a região `aria-labelledby` o cabeçalho. Os dados (`main.js dadosPausaTime`): o
  `escalacao.js rascunhoDe` (o time que VAI valer, com a edição na fila), `fichaDe`, `m.partida.cartoes`, `TRAVA_TM` ou
  `m.controlado`, a cor do `IDENT.hud.placar` ou do `COR_UNIFORME` (agora exportado pelo `escalacao-tela.js`), a do goleiro pelos
  `KITS`/`IDENT.kits`; no Livre só quem está em campo (fora do `m.livre.fora`) e o texto do `#estado-livre`; null nos treinos e
  na disputa (sem cartão). Refeito só quando a chave muda (`chavePausaTime`: formação, versão, saídas, substituições na fila,
  expulsos, edição na fila, cartões, controlado, Livre, mentalidade). Tocar ou clicar no cartão abre o Editar time
  (`data-editavel="1"`: só na partida, fora do Livre e sem a trava do TM); fora da ordem do foco (o teclado e o controle usam o
  item "Editar time"). `data-pronto` quando desenhado.
- **Sob demanda** (`main.js SOB.pausa`): `import('./pausa-tela.js')` + `css/pausa.css` (antes do `prejogo.css`) + a Inter TM nos
  3 pesos (`fontesPausa`, `@font-face 'Inter TM'` 400/600/800 no `estilo.css`, ~72 KB) — fora do download inicial; a pré-carga
  ociosa de sempre traz tudo; abrir a pausa antes mostra a lista na hora (com a fonte do sistema até a Inter chegar) e o cartão
  quando chega (`teste-carga`: os 2 arquivos na lista do sob demanda e as 3 fontes nunca no inicial e pedidas depois da pré-carga).
  Desde o item 125 o `fontesPausa` pede também a TM Cond 600 e 800 latin (`FONTES_DISP`, ~44 KB; antes da fonte chegar, a
  reserva de mesma largura máxima): contrato "Sistema tipográfico".
- **Navegação** (`hud.js`): os níveis (`submenu('modos' | 'opcoes' | 'estatisticas' | null)`: abrindo, o foco vai ao escolhido
  — `aria-pressed` — ou ao 1º controle; voltando, ao item que abriu); `voltarNivel` (o B do controle e o Esc: a Ajuda fecha e
  volta à pausa se veio dela, o submenu — também os do Livre — volta ao 1º nível, o 1º fecha; P e Start fecham tudo);
  `navegarPad` ESPACIAL (`vizinho`: cima/baixo pelo menor Δy e depois o menor |Δx|, dando a volta; esquerda/direita só na mesma
  linha; nos deslizantes, esquerda/direita mudam o valor; o X fica fora); o Tab preso no nível à vista + o X (dá a volta, nunca sai
  para o jogo). **Teclado** (`entrada.js MENU_TECLA`, com o menu ou a Ajuda abertos — `opc.menuAberto`): setas → `menu-cima/
  baixo/esq/dir` (com a repetição da tecla), Esc → `menu-voltar` (sem a repetição); Ctrl/Alt/Meta ficam de fora. `entrada.
  ultimoMeio` ('teclado' | 'pad' | 'toque', pelo último keydown, botão/eixo do controle ou pointerdown) → `hud.definirEntrada` →
  `#menu[data-entrada]`: a linha dos comandos do PC mostra Enter Selecionar · Esc Voltar ou Ⓐ Selecionar · Ⓑ Voltar (some com
  o toque). **Toque**: o fundo que fecha é o jogo à vista (a área do degradê, o canto direito, a pílula), nunca a faixa da lista
  (tocar nela fora dos itens não fecha); o X no lugar exato do ≡ fecha e o mesmo toque não reabre (`engolirClique`). Fechando, o
  foco SAI da pausa (o padrão do APG o devolveria ao ≡, mas o Enter seguinte reabriria a pausa: de propósito).
- **`main.js`**: os comandos `opcoes`, `estatisticas` (`abrirEstatisticas`) e `*-voltar`; `atualizarPausa(abrindo)` a cada quadro
  com a pausa aberta (a linha dos comandos, a competição ao abrir, o cartão quando a chave muda); `hud.definirCompeticao(
  textoCompeticao())` no começo e em cada `trocarMundo` (TM: `IDENT.competicao` ou a do pedido, senão "Total Match"; online
  "Partida online"; sem eles o modo: Amistoso, Disputa de pênaltis, Modo Livre, Treino de ataque, Treino de condução). API de
  teste: `__golaco.pausa` ({aberta, nivel, sub(nome), tela, pronta, carregar(), dados(), competicao()}), `__golaco.
  comandosVistos` / `limparComandosVistos()` / `secarComandos(lista)` (os comandos que chegam ao `comando()`; os "secos" só
  registrados), `sobDemanda.estado.pausa`.
- **Cara do TM com e sem `?tm`**: as variáveis `--p-*` do `#menu` (#050807, #22c55e, #4ade80, a Inter TM) no `estilo.css`, e
  desde o item 125 a TM Cond (o `--f-disp`) na lista, no estado à direita (caixa alta, 0,04 em, `max(12px, 1,7vh)`; 11 px em
  568×320), na competição (800 caixa alta), nos títulos dos submenus (800 caixa alta), nas pílulas e nos segmentados (o nome na
  800, o `small` na 600 caixa alta), no Voltar e na pílula do placar (siglas 14 px, gols 18, relógio 14); o texto das Opções e
  das Estatísticas (rótulos) continua na Inter TM. O `tm.css` só troca a marca (`--tm-simbolo` no `::before` do topo) e guarda a
  Ajuda. Contraste medido (P8): texto 11,2:1, a barra do foco 7,1:1.
- **Item 125 nos submenus** (só no PC, ≥ 481 px de altura; o celular fica nos px de antes): o título `clamp(16px, 2.4vh, 26px)`
  (24 px em 1920×1010; antes 15), o Voltar `clamp(36px, 4.4vh, 46px)` de altura com letra `clamp(14px, 1.6vh, 18px)`, as linhas
  dos submenus `clamp(44px, 5.4vh, 56px)` com o nome `clamp(15px, 1.8vh, 19px)` e o `small` `clamp(11px, 1.3vh, 14px)`, os
  rótulos das Opções `clamp(14px, 1.7vh, 18px)`, os segmentados `clamp(14px, 1.6vh, 17px)`; as Estatísticas com a linha
  `clamp(32px, 5.4vh, 56px)`, o valor na TM Cond 800 `clamp(16px, 2.4vh, 26px)` `tabular-nums`, as siglas na 800 e a barrinha da
  POSSE de 6 px dividida na cor de CADA time (`--pe-c0`/`--pe-c1` pelo `cor1` dos dois; antes verde contra cinza). A Ajuda: só a
  tipografia (título e `h3` na TM Cond 800 caixa alta, `kbd` na 800; o layout é o item 94). Livre: o rótulo na 800 caixa alta e o
  N de 22 px; online: o aviso no `--p-fonte` (saiu o `"Inter,system-ui"` sem face) e o selo na 800 caixa alta.
- **Testes**: `teste-pausa-tela` (navegador, CI e deploy; `tools/lib/pausa-medidas.mjs` com a ORDEM por modo, os 31 COMANDOS
  e as medidas na página; `--so cel|pc|tm|online`, `--raiz` mede outra cópia): P1 a lista à esquerda na ordem por modo e o
  cartão à direita (folgas, nada cortado nem fora da área segura; CADA item do 1º nível com o foco cabe na linha —
  `FOCO_LARGURA` —, também o "Voltar ao Total Match" do fim do TM e o Sair armado do online; o selo do online fora do X, da
  pílula e do cartão); P2 sem rolar em todos os níveis × modos × telas (844×390, 667×375, 640×360 e 568×320 com entalhe;
  1280×720 e, da revisão, 1024×768, 1280×1024, 1440×900, 1280×800, 800×600, 1366×600, 1280×520 e 1000×520; e com `?tm` num
  quadro com a meta viewport); P3 o jogo à vista pelo print
  (luminância com a pausa ≥ 60% da sem ela: ≥ 40% no PC, 25% em 844, 17% em 667/640, 14% em 568); P4 o campinho (11 fichas na
  ordem da formação, letra ≥ 11 ou ≥ 10 em 568, o amarelo, o ↑, o "você" e o expulso vazio, tocar abre o editor, o 4-4-2 do
  PRONTO no cartão antes de o jogo voltar, a trava do TM sem editor, o Livre só com quem está em campo, sem cartão nos treinos e
  nos pênaltis); P5 o teclado (↓/↑, Esc um nível com o foco no item que abriu, Tab preso, fundo inert menos o aviso, que fica por cima); P6 alvos ≥ 44 × 32 px
  no celular (28 em 568×320) e ≥ 32 de altura no PC; P7 o leitor de tela (o diálogo "Pausa: …", grupos com nome, o cartão como
  região com resumo, a tabela com legenda); P8 a cara do TM sem `?tm`; P9 o toque (o X no lugar do ≡ fecha e não reabre, o jogo
  fecha, a faixa não; o toque que troca de nível deixa o foco no que o nível escolhe); P10 todo comando pelos 3 meios (toque; teclado só com setas + Enter; controle pelas ações `menu-*`) chega
  ao `comando()`, com Voltar ao jogo ≤ 2 e Editar time ≤ 2 toques e ≤ 3 teclas/apertos; S1 o mundo parado (0/60 passos com a
  pausa aberta; no online anda ≥ 40% da janela fechada); S2 0 erros; S5 a menor letra ≥ 11 px (o campinho ≥ 10 em 568×320).
  **Item 125**: as medidas com as transições e animações da pausa DESLIGADAS (o estado final: o foco anda 6 px e a cascata
  mexe nas caixas — a lição do relógio das animações sem GPU); P4 ganha a área do campo ≥ 1,30 × a da base no PC (3 telas) e em
  844×390, ≥ 1,15 em 667×375 e ≥ 1,10 sobre o campo CERTO da base em 568×320 (220×173), e o campo DENTRO do cartão em todas as
  telas; P8 a TM Cond 600/800 CARREGADA nos itens (o `document.fonts.check` lido antes de qualquer `load` do teste: revisão
  C-R7) e nenhuma família sem `@font-face` (`tools/lib/tipografia.mjs`); P12 (novo) nomes com "…" no campinho: PC 0, 844 0,
  667 ≤ 1, 568 ≤ 5; P13 (novo) em 1920×1010 a menor letra dos submenus: rótulos ≥ 14, títulos ≥ 20, valores ≥ 20. Na base
  (29d67bad) reprovam P4 (área 1,00× e o campo vazando 9 px em 568×320), P8 (a lista na Inter TM), P12 (1 nome cortado em
  844×390) e P13 (títulos de 15 px e valores de 17 px).
  Adaptados: `teste-hud-minimo` H7 (o topo novo; Minimapa e Nomes nas Opções), `teste-livre-tela` (D1, D3, E1, F: a ordem do
  Livre, o topo novo, a meta viewport no quadro do TM), `teste-replay` D4 e `teste-replay-paradas-tela` (a opção "Replays" nas
  Opções), `teste-penaltis-tela` 8 (o Minimapa escondido nas Opções), `teste-online-tela` P9 (Pausar e Sair pelo toque, o Sair
  com outro dedo no analógico), `teste-tm-tela` (a meta viewport), os de "a pausa não rola" (`teste-prejogo`,
  `teste-substituicao-tela`, `teste-cenas-tela`, `teste-penaltis-tela`, `teste-livre-tela`: a rolagem do `.menu-corpo` e do
  nível à vista) e o `teste-carga` (o sob demanda novo e as fontes).
- **Medidas** (a5abaa4e → PR, `teste-pausa-tela`; a base reprova P1–P10 e S5): rolagem do 1º nível no celular 287/302/342 px
  (667/640/568) → 0 em todas as telas e níveis (88 medidas no celular, 12 no PC, 40 no TM, 2 no online); o jogo à vista 10,7 /
  11,6 / 11,9 / 12,9% (844/667/640/568) → 30,2 / 20,7 / 21,1 / 21,6%, PC 6,2 → 44,6%; alvos pequenos 17–19 por tela (o menor
  26×32) → 0; a menor letra 10 → 11 px (o campinho 10,5 em 568×320); a fonte system-ui → Inter TM; teclado: as setas não
  andavam e o Tab saía da pausa 2 em 40 → as setas andam, 0 em 40; o Editar time pelo teclado inalcançável → 3 teclas, pelo
  controle 4 → 3 apertos; o toque: 2 toques no 1º nível e 3 nas Opções (antes 2, na própria janela). Custos que subiram (o plano
  da FILA: as opções num submenu e a ordem do FC): no teclado e no controle as opções custam 9–16 (Qualidade → Alta 9,
  Transparência 16), o Replay 5 (antes 3 no controle) e o Modo de jogo 7 (antes 6).
- **Medidas do item 125** (29d67bad → PR #621, `teste-pausa-tela`; elenco fictício): o campo do campinho 1920×1010 554×444 →
  669×568 (1,54×), 1280×720 362×290 → 439×373 (1,56×), 1024×768 285×228 → 347×295 (1,58×), 844×390 282×226 → 314×267 (1,32×),
  667×375 282×226 → 298×253 (1,18×), 568×320 220×190 VAZANDO → 236×200 dentro (1,24× sobre o certo, 220×173); disco/letra do
  nome 34/17 → 40/18, 26/13 → 35/15, 22/11 → 30/12, 22/11 → 27/11, 22/11 → 26/11, 18/10,5 → 18/10; nomes com "…" no campinho:
  na base, com o pedido da especificação (medido no protótipo), 0/1/3 (PC 1920/1280/1024) e 4/4/8 (844/667/568); no P12 final 0
  no PC e 0/0/1 no celular (a base reprova com 1 em 844×390); com os nomes longos do TM (a sonda da revisão), da 1ª versão do
  item para a revisão, 844 0 → 0, 667 2 → 0 e 568 4 → 3 (a linha de 4 da defesa a ~46 px por ficha); o jogo à vista (P3) 1280×720 44,6 → 42,9%, 844×390 30,2 → 30,0%, 667×375 20,7 → 23,8%, 640×360
  21,1 → 23,4%, 568×320 21,6 → 24,8% (a faixa mais estreita paga o cartão maior; metas 40/25/17/17/14); a letra dos itens no
  celular 15/17 → 18/20 px (568×320: 15 → 17/18); os submenus em 1920×1010 títulos 15 → 24 px, valores 17 → 24, rótulos 16–17;
  um item desabilitado (o "Pausar a partida" do online sem pausas) com a cascata ligada: opacidade 0,45 (na 1ª versão do item, 1);
  a volta de um submenu no celular: a largura do cartão [400, 400, 332…] → [332…] e 2–3 → 0 erros de laço do ResizeObserver.
- **Fica** (fora da v1, anotado; FILA itens 93–99): o tempo do `teste-pausa-tela` no `tempos-ci.mjs` (330 s, estimado aqui:
  acertar pelo log do CI; item 93); a Ajuda no estilo novo (continua janela e rola no celular como antes; item 94); a câmera de
  bastidores (o close do controlado, como os "Matchday Menus" do FC 24; render; item 95); desenhar o 3D só na mudança com a
  pausa aberta (mexe no laço; item 96); o fôlego e o capitão no campinho (o jogo não tem fôlego dinâmico; o capitão só existe na
  fila do pré-jogo, `cortejo.js`; item 97); no online, o contador da pausa combinada dentro da pausa, o "Toque de novo: sair"
  que diz "Toque" também com o mouse e o teclado, e o online nas telas 16:10 e 5:4 do PC no teste (item 98); os alvos de toque
  de 28–44 px no celular, abaixo dos 44 da Apple (revisão F7: decisão do dono, "Depende do dono" 18; item 99).
- **Limite**: 568×320 está no limite — 8 linhas de 28,6 px no 1º nível e um cartão de ~236×217 (desde o item 125 sem o
  cabeçalho: o campo 236×200, a letra das fichas 10 px e, com os nomes longos do TM, 3 nomes de 10 letras ainda com "…"). Item
  novo no 1º nível (ou modo novo com mais itens) pede rever a conta, ou entrar num submenu.
- **Modo "antes do jogo"** (item 64; o ≡ da tela antes do jogo): `hud.definirAntes(true)` → `#menu[data-antes]`, "Voltar" no
  lugar de "Voltar ao jogo" (também no `aria-label` do X) e, pelo `css/prepartida.css`, sem Editar time (a tela tem o
  Personalizar), Estatísticas, Replay, Reiniciar, Simular o resto, Pausar do online, o cartão e a pílula; a tela some atrás da
  pausa (só o véu) e o Voltar devolve o foco ao ≡ da tela. `hud.antes` lê o modo. Contrato "Tela antes do jogo (item 64)".

## Tela antes do jogo (item 64; 04/11) — a pré-partida do EA FC com a cara do TM (contrato)
Pedido do dono (23/10, com o print da pré-partida do FC): "quero que fique NESSE NÍVEL; só altere para o Total Match com cores e
etc, mas é do mesmo nível" (FILA item 64, PR #613; as escolhas no "Depende do dono" 19; o que ficou nos itens 100–107). Pesquisa
em `PESQUISA-ESTADIO.md` §7.5. A ORDEM do começo passa a ser: tela antes do jogo → (o "Jogar") → pré-jogo cinematográfico
(contrato "Pré-jogo") → o apito da saída; sem a tela (webdriver, `?prepartida=0`, a reserva), a abertura "Toque para começar" de
antes. **Só
DOM, CSS e página**: os novos `js/prepartida.js` (puro, FORA do fecho: nenhuma constante no `config.js`), `js/prepartida-tela.js`
+ `css/prepartida.css` + `assets/tm/fontes/tmcond-800-latin(-ext).woff2` (a TM Cond 800 = Barlow Condensed ExtraBold, OFL, a
letra da carta do TM; desde o item 29 o `@font-face` dela e a tabela de avanços — `js/letra-cond.js` — são comuns com a escalação
do pré-jogo: o `@font-face` no `css/prejogo.css` — desde o item 125 no `css/estilo.css`, com o 600: contrato "Sistema
tipográfico" —, a `larguraCond` reexportada pelo `prepartida.js`) + `assets/tm/cartas-triangulos.svg`, e `main.js`, `hud.js`, `prejogo-tela.js`, `render/prejogo.js`,
`editor-time.js`, `online-pagina.js`. `fecho-hash --diff` 0; `hash-igual` e `hash-partida` IGUAIS: a tela segura o laço no tick 0
(nenhum passo) e nada dela vai ao passo.
- **Quando aparece** (`main.js prepartidaLigada`): em todo JOGO — partida, TM (também o Rumo ao Estrelato), Livre, Pênaltis e
  online — ANTES do pré-jogo; nos treinos não. `?prepartida=1|0` força; sem o parâmetro, DESLIGADA com `navigator.webdriver`,
  `?prints=1` e `?demo=1` (a regra do `modoPrejogo`). Sem opção para desligar (é o portão do som e do Personalizar, como no FC).
  "Jogar de novo" (fim) e a troca de modo pela pausa a mostram de novo; o "Reiniciar partida" no meio não; o `trocarMundo` da
  API dos testes só com `opc.prepartida`. No TM, desde o item 124 (05/11), ela está NO LUGAR da janela "Jogar em 3D / Simular": o
  "Jogar" de todo modo com o time da pessoa abre o 3D direto nela (contrato "Ponte com o Total Match", parte "A tela no lugar da
  janela"); o quadro do TM pede `&prepartida=1` só nos testes (`TM.tm3d.PARAMS`: com o webdriver ela fica desligada).
- **Carga** (sob demanda, fora do download inicial): `carregarPrepartida()` no TOPO do `iniciar()` (com a tela ligada) baixa o
  `prepartida-tela.js`, o `prepartida.js`, o `css/prepartida.css` (antes do `prejogo.css`) e pede a Inter TM (600/800) e a TM Cond
  (o layout não espera as fontes: a conta do nome usa a tabela de avanços da TM Cond, `larguraCond`; desde o item 106 as fontes
  são pedidas JUNTO com o módulo e a tela cedo as espera até 0,3 s: parte "A tela cedo", abaixo). Desde o item 106 a tela abre
  ANTES do 3D (a tela cedo). **Reserva**: sem o módulo até o 3D montado, mais 1,5 s (`esperarPrepartida(PP_RESERVA_MS)`) e uma
  volta de tarefas; sem ele ainda, a abertura de texto de hoje ("Toque para começar") e nenhuma tela nessa
  partida — no TM (partida e Rumo ao Estrelato) com o botão "Simular partida" no canto de baixo à direita (item 124, revisão A6:
  sem ele a única saída era começar o jogo e usar o "Simular o resto"; contrato "Ponte com o Total Match", parte "A tela no lugar
  da janela"). Com webdriver nada disso é pedido, nem pela pré-carga ociosa (`teste-carga`, lista `SO_COM_TELA`) — menos a TM
  Cond, que desde o item 125 a pré-carga da pausa traz (nunca no download inicial: lista `FONTES_DISP`; mudou de propósito).
- **O fundo**: partida com o pré-jogo ligado → a fase `abertura` do diretor do pré-jogo de hoje (o aéreo de fora, o som abafado)
  CALADA (`prejogo.iniciar(modo, {abertura, muda})` → `prejogo-tela.mudo(true)`: os três ouvintes dela — o toque da camada, o
  Enter/Espaço na captura e o Ⓐ — não agem) e o fundo `'abertura'`; o resto (pré-jogo desligado, Livre, Pênaltis) → o JOGO PARADO
  no tick 0 (`'jogo'`). Um véu em degradê por cima (sem `backdrop-filter`); o 3D atrás desenha a 30 qps (`PP_QPS`); em pé (o
  `#girar` cobre) ou com a aba escondida não desenha. O ramo do laço (`quadroPrepartida`, no TOPO do `quadro()`): `entrada.ler`,
  as ações `menu-*` para a tela, `laco.ultimo = agora` (o tempo não se acumula) e, no online, o pacote. `pausado()` e
  `marcarCondutor` olham a tela; o HUD, os botões de toque, as cenas, o canvas e o `#prejogo` ficam `inert` atrás dela.
- **O "Jogar partida"** (`jogarPrepartida`): é o GESTO (o `som.js` cria e retoma o contexto no 1º gesto; a tela cheia deitada do
  Android dentro do handler; no TM com a tela aberta SÓ ele liga o som — `criarSom({gestoVale})` + `main.js gestoDoSom`: os toques
  no "Simular partida", na Visão tática, no Personalizar e no ≡ não criam o contexto nem baixam os ~1,35 MB da torcida; item 124,
  revisão A4); a tela some e começa o pré-jogo escolhido no "Pré-jogo da partida" (completo, curto, só escalação —
  `prejogo.comecar()` no fundo da abertura, ou `comecarPrejogo` se a escolha mudou com a tela aberta) ou, desligado, o apito
  (`eventosIniciais`). Pelo controle, se o contexto do som não estiver `running` 0,3 s depois, o aviso discreto "Toque ou aperte
  uma tecla para ligar o som" (`hud.evento('somGesto')`). O Ⓐ do Jogar, ainda segurado nos quadros seguintes, NÃO é um aperto
  novo para a camada do pré-jogo (`prejogo-tela.js lerPad(false)` ao voltar a ouvir: `mudo(false)` e `mostrar(true)`); sem isso
  ele pulava o bloco inteiro das cenas (~60 s; revisão A1). Nos Pênaltis a disputa só anda depois do "Bater pênaltis" (antes do
  item 64 andava 7–12 passos no 1º quadro); no Livre o Jogar fecha a tela com o N contra M escolhido.
- **Layout** (`prepartida.js layoutPrepartida(W, H, sa, formacao, nAbas, {canto})`, puro; o mesmo nos testes): o celular deitado
  pela ALTURA útil Hu = H − sa.t − sa.b, em px (regimes normal ≥ 352, compacto 316–351, mínimo 277–315, emergência < 277); o PC
  (Hu > 480 e W ≥ 560) pelas proporções do FC 24 medidas em 1280×720 (barra 15,5–22%, info 24,6%, campinho 32–78%, abas
  83,5–90,8% de 5% a 95% da largura, comandos 95,4%). De cima para baixo: a competição + o ≡ (e o [<] do canto), a BARRA (o
  botão de cada time com a camisa, o escudo e a sigla — no PC o nome e o selo —, a hora no meio), a linha de INFORMAÇÃO
  (estádio · data · árbitro · duração · período; `linhaInfo` corta por prioridade: período → árbitro curto → árbitro → data →
  o estádio com "…"; no PC em 2 linhas), o CAMPINHO em trapézio (topo = 0,70 da base, perspectiva verdadeira por `projetar`, 5
  fileiras de altura hc = ⌊(Hcampo − 4·folga)/5⌋), o selo da tática e o GERAL nos cantos de baixo, as ABAS e, no PC, a linha dos
  comandos (Enter/Ⓐ Selecionar · Esc/Ⓑ Voltar · Q E/LB RB Time · P/Start Opções · Ⓨ Personalizar · Ⓧ Vista). Layout só no
  `resize`, na troca de time e na troca de vista (`pp.layout()`); a cascata das fichas só ao abrir. Da revisão: nada sai cortado
  pelo CSS — a linha de informação recebe o separador como ele é DESENHADO (`linhaInfo(…, larguraSep)` = `medir('|')` + 0,9 em) e
  a tela confere no DOM e corta de novo se passar (a duração nunca sai; só o estádio leva "…"); o ícone das abas é decidido para a
  barra INTEIRA, pelo rótulo mais longo que cada aba pode mostrar (com 4 abas em 568, 640 e 667 nenhuma tem ícone); a vista
  encurta "Sem a bola ⇄" → "Sem a bola" → "Sem bola" e o Simular armado "Toque de novo: simular" → "De novo: simular" →
  "Simular?" (o `aria-label` inteiro), e o glifo Ⓐ/Ⓨ do controle sai da aba onde não caberia; a competição do celular aperta as
  letras (0,02 em), tira o ícone e, por fim, quebra em 2 linhas (nunca "…"); o selo da tática e o GERAL ficam dentro da borda
  inclinada (a posição pela largura do trapézio no ALTO do bloco, não pela base).
- **A ficha** (11 por time): a carta de campo — moldura chanfrada (`clip-path`) e filete CHEIO na cor da raridade da carta do TM
  (`raridade`: Base < 65, Elite < 75, Craque < 85, Lenda ≥ 85; a nota é a `notaExibida`, a mesma do TM e do GERAL), o busto
  VESTIDO na cor do uniforme (o goleiro com o dele), a nota, a posição e o nome de camisa em TM Cond 800 (nome = clamp(10/11,
  round(0,235·hc), 20) px; "…" só sem a fonte). No Rumo ao Estrelato a ficha do travado diz "VOCÊ" (em cima do filete, sobre o
  pé da moldura). Nos Pênaltis o campinho dá lugar à FILA dos cobradores (o goleiro + 1º…5º do `m.disputa`); no Livre só quem
  está em campo, com "N contra M". A camisa ESCURA (luminância WCAG < 0,07: some no preto da tela e da carta) clareia o ombro do
  busto e ganha um disco claro atrás do ícone da barra. O clássico do TM pelo `textoClassico` (o nome que já começa com
  "Clássico" fica como veio). A letra do resto: ≥ 11 px no celular e ≥ 12 no PC — também o VOCÊ, o "1º…5º" da ordem, as teclas
  da linha dos comandos (`max(12px, 0.85em)`) e a competição nos regimes mínimo e emergência.
- **Visão tática** (aba; Ⓧ): Escalação → Sem a bola → Com a bola (o FC IQ do FC 25), só leitura — os pontos da `posicaoTatica`
  (`pontosVisao`, a MESMA função da IA e da prévia do editor) num campo aproximado no bloco (± 6 m), discos com o NÚMERO e o nome
  só do disco em foco/tocado; `layoutVisao` afasta os discos que encostariam (≤ 4 px do ponto); a grande e a pequena área
  desenhadas, recortadas pela janela (`linhasCampinho(L, janela)`). Com discos à vista o bloco deixa de ser `aria-hidden` e vira
  um `role="group"` com o nome da vista, cada disco um `role="button"` com o rótulo ("9 Diego, ATA"); o foco num disco que some
  volta à aba. Esc volta à Escalação.
- **As abas por modo** (`abasDoModo`): partida Jogar partida · Visão tática · Personalizar; TM + **Simular partida** (armada:
  "Toque de novo: simular", 3 s contados pela HORA DO TOQUE — o `event.timeStamp`, não a hora em que o quadro o processa: com o
  quadro pesado, dois toques com 1,8 s entre eles chegavam com 3,05 s e o 2º armava de novo; item 124, revisão A5; desde o item
  106 vale também o 2º toque até 3 s depois de o pedido APARECER: parte "A tela cedo" —; o 2º toque =
  `simularNoTM()` = `sairTM({motivo: 'simular', titulares})`: o 3D volta SEM resultado e o TM simula lance a lance com os
  titulares que a tela mostrou — item 124, o "Simular" da janela que a tela substituiu; a tela fica aberta, o mundo no tick 0, até
  o TM fechar o quadro. Até o item 124 o 2º toque era o `voltarAoTM()` = o `simularResto()` do motor 3D do tick 0 → `tm3d:fim`);
  Rumo ao Estrelato Jogar · Visão · Simular (sem Personalizar; o Simular igual, e a simulação é a do Estrelato); Livre Jogar ·
  Jogadores · Câmera (os submenus do Livre; o Voltar deles volta à tela e o N contra M novo vale já, no mundo do tick 0);
  Pênaltis Bater pênaltis · Cobradores do adversário; online **Pronto** · Visão tática. O [<] do canto (armado): no TM Livre/Pênaltis "Voltar ao Total Match" (o Livre manda `tm3d:fim
  {livre}`; os Pênaltis `tm3d:sair`, sem resultado — nada é simulado, como o X do TM neles; antes da revisão A2 o `voltarAoTM()`
  simulava a disputa inteira e o TM mostrava o vencedor dela); no online "Sair da partida". O ≡ (P, Start) abre a pausa no modo
  "antes do jogo" (`hud.definirAntes`: `#menu[data-antes]`, "Voltar" no lugar de "Voltar ao jogo"; somem Editar time,
  Estatísticas, Replay, Reiniciar, Simular o resto, Pausar do online, o cartão e a pílula).
- **Dados** (`main.js dadosPrepartida()` → `prepartida.js dadosDaPartida(m, ctx)`: só LÊ o mundo): os dois times (sigla, nome,
  escudo do TM/`<symbol>`, cores do uniforme, formação, as fichas, o selo `seloTatica`, o GERAL, a pessoa no online), a competição
  (`textoCompeticao`), a hora (16:00 de dia, 21:30 à noite), o estádio (`IDENT.estadio.nome` ou "Estádio Golaço"), a data (do
  pedido do TM; fora do TM a do aparelho; no TM sem data, nenhuma), o ÁRBITRO fictício (`arbitroDe(semente)`: 32 nomes conferidos
  contra os quadros da CBF/FIFA — `tools/dados/arbitros-reais.txt`; hash da semente, nunca o `m.rng`; nenhum no Livre), a
  duração (os minutos por tempo) e o período.
- **Navegação** (`prepartida-tela.js`; WAI-ARIA APG): `role="dialog"` + `aria-modal` + `aria-labelledby` ("Antes do jogo:
  <casa> × <fora>, <hora>"), as abas numa `role="toolbar"` com tabindex itinerante, a lista `.pp-lista` só para o leitor de tela
  (posição, nome, nota), uma região `aria-live`. Foco inicial na 1ª aba (o Ⓐ do FC). Tab PRESO: a aba itinerante → os dois times
  → o ≡ → o [<] → volta. Setas: ←/→ nas abas e na barra, ↑/↓ entre as linhas (barra, discos, abas). Enter/Espaço/Ⓐ age; Esc/Ⓑ
  volta um nível (vista → escalação, adversário → o meu time; no 1º nível, no TM o foco no "Simular partida", no resto nada);
  Q/E e LB/RB trocam o time mostrado; P/Start = ≡; Ⓨ = Personalizar; Ⓧ = a próxima vista. O teclado por um ouvinte na CAPTURA da `window`; o controle pelas ações
  `menu-*` do `tratarAcao` e o Ⓨ/Ⓧ/LB/RB lidos em `pp.atualizar`. Toque: as abas e os botões por `aoTocar`; tocar no campinho =
  Personalizar (só onde é editável); na Visão tática, tocar num disco mostra o nome. No aparelho de toque, enquanto nenhuma
  tecla foi apertada, o meio é o toque e não há anel de foco (nem ao abrir); a aba com o foco tem UM indicador (o preenchimento
  verde, com o anel escuro por dentro). Com a pausa, a Ajuda, o editor ou um submenu do Livre por cima, a entrada volta a valer
  para eles (`abrirMenuDaTela`) e a tela some atrás deles, só o véu (`pp.cobrir(true)` → `#prepartida.coberta`: cada camada
  sozinha sobre o 3D, como a pausa sobre o jogo — revisões V5/V6); quando fecham, `voltarParaTela()` mostra a tela ANTES de
  devolver o foco (o ≡ escondido não o recebe), bloqueia de novo, refaz os dados e devolve o foco (ao ≡ depois das Opções, ao
  Personalizar depois do editor).
- **Personalizar antes do jogo** (aba; Ⓨ; o toque no campinho): o Editar time de hoje com `antesDoJogo` (o rótulo "Antes do
  jogo: as trocas viram a escalação"); o PRONTO NÃO passa pela fila de edições (que viraria substituição pendente no 1º passo):
  `timesAntes[TIME_HUMANO] = edicaoParaTimes(ed)` e o mundo do tick 0 é RECRIADO por `criarPartida({times})` (`trocarMundo(…,
  {antesDoJogo: true})` mantém a tela e o pré-jogo; `prejogo.refazerTimes()` refaz o cortejo, os técnicos, as fotos e as
  escalações — não o lado de fora). O reserva escalado joga, conta no resultado do TM e ninguém "saiu" (`teste-ponte-tm` P9).
  No "Simular partida" do TM a escalação da tela também vale: o `tm3d:sair` leva os titulares (`titularesTM()`: os tmIds das
  vagas do mundo do tick 0, 11 por lado) e o TM simula com eles (item 124, revisão A2; contrato "Ponte com o Total Match"). A
  formação e a tática do Personalizar não chegam ao TM: o motor dele só lê os 11.
- **Online** (§4.5 da especificação; `online.js` INTOCADO): a fase vai no byte 19 do pacote em bits definidos na PÁGINA
  (`online-pagina.js E_TELA = 8`, `E_PRONTO = 16`, `E_PREJOGO = 32`; os bits 0–2 continuam os do `online.js`); todo pacote leva a
  fase e a do outro é o MAIOR valor recebido (`faseRemota`: −1 nenhum pacote, 0 tela, 1 pronto, 2 pré-jogo, 3 jogo — um pacote
  velho não desfaz nada). "Pronto" é final: o botão vira "Aguardando {nome}…" (`aria-disabled`, a bolinha girando) e o pacote sai
  na hora; a saída conjunta é eu pronto e o outro com fase ≥ 1 (pronto ou além da tela: a reserva sem a tela manda `E_PREJOGO`)
  → `jogarPrepartida()`, conferida no EVENTO (`saidaOnlineTela`: o clique do Pronto e a mensagem que sobe a fase, `ao.fase` do
  `criarPaginaOnline`) e a cada quadro (rede de segurança) — esperar o quadro dava 900 ms com o 3D atrás da tela no Chromium sem
  GPU; no evento, 12–19 ms de um lado ao outro. O 1º passo continua decidido pelo lockstep. Com a tela aberta,
  `PAG_ONLINE.quadro(agora, {antes: true})` a cada quadro (o abandono, a ligação fechada e o "Aguardando" só sem pacote por 5 s valem; o "espera" de 0,9 s não); com 60 s
  esperando, o [<] "Sair da partida" ganha destaque (`destacarCanto`, nada automático). No jogo, com pacotes chegando e o outro
  ainda na tela ou no pré-jogo, o aviso de espera diz "{nome} ainda está antes do jogo." / "{nome} ainda está no pré-jogo." (antes:
  "A conexão parou", enganoso); o W.O. continua só sem pacote por 90 s. Sem Personalizar no online (v1: no passo ≥ D viraria
  substituição). O Sair armado = o da pausa: `PAG_ONLINE.sair()` + `tm3d:sair {abandono}` (derrota; o outro recebe o W.O.).
- **API de teste** (`__golaco.prepartida`): `ligada`, `carregada`, `aberta`, `estado` (modo, fundo, regime, abas, foco, time,
  visão, armado, aguardando, destaqueCanto), `dados()`, `layout()`, `visao()`, `jogar()`, `personalizar()`, `adversario(t)`,
  `vista()`, `simular()`, `abrir()`, `carregar()`, `timesAntes`, `desenhos`, `fechadaEm`, `escalar(ed)`; `__golaco.online` ganhou
  `fase`, `faseRemota`, `encerrado` e `aviso`; `sobDemanda.estado.prepartida`. Do item 106 (a tela cedo): `__golaco.carga`,
  `__golaco.soltar3d()`, o `?segurar3d=1` e o `estado.carregando`/`abertaEm` (parte "A tela cedo", abaixo).
- **Metas** (cobradas pelos testes abaixo; os números do PR no `PESQUISA-ESTADIO.md` §7.5): a simulação no tick 0 com a tela
  aberta (0 passos, o hash = o do Node; depois do Jogar, 600 passos = Node); 0 px de rolagem e 0 encosto em 4 telas do celular
  (844×390 com o entalhe, 667×375, 640×360, 568×320), no regime mínimo (640×304, 568×280) e em 6 do PC, × o meu time e o outro
  × as três vistas, também SEM as fontes; o nome ≥ 10 px em 568×320, ≥ 11 nos outros celulares e ≥ 13 no PC; a info ≥ 11; as
  abas ≥ 13 de letra e ≥ 177 × 40 (568) / 200 × 44 (640+); o resto ≥ 11/12; toques até o jogo: a partida com o pré-jogo 2 (Jogar
  + Pular), o pré-jogo desligado e os Pênaltis 1; o som `running` em ≤ 1 s depois do Jogar; o Personalizar com 0
  substituições; ≤ 40 chamadas, ≤ 130 mil triângulos e ≤ 31 desenhos 3D por segundo (844×390 Média); o contraste atrás do texto
  ≤ 50/255 de dia e de noite; as proporções do FC 24 no PC a ±1,5 ponto; com a tela, ≤ 140 KB TRANSFERIDOS a mais até +2,5 s
  (medido +99 KB; crus +160); online: a saída conjunta em ≤ 0,5 s (≤ 1 s com 20% de perda), os hashes iguais em todas as
  conferências até ~1200 passos (≥ 20 em comum).
  Fora do teste por enquanto (item 101): o tempo até a tela e do Jogar ao 1º plano (E8; desde o item 106 o E26a cobra, no
  Chromium sem GPU, a tela ≤ 1,5 s depois da navegação e pintada antes de a cena 3D nascer — o celular de verdade continua de
  fora), o download com `?tm` e 4 das 5 mutações da especificação.
- **Testes**: `teste-prepartida` (Node, padrão: L1 o layout da maquete medida em 11 telas × 6 formações, L2 a Visão tática sem
  encosto, L3 a linha de informação, L4 o árbitro, L5 a edição → times, L6 os dados por modo, L7 a pureza e o fecho);
  `teste-prepartida-tela` (navegador, CI e deploy; `--so pc,cel,telas,modos,pad,tm,online,carga`, `--raiz` mede a base, `--espera <s>`
  o O5): E1–E21 (liga/desliga, simulação parada e hash = Node, sem rolar e nada encosta em 10 telas também sem as fontes, letras,
  alvos, toques até o jogo, som, teclado, controle, leitor de tela, Personalizar, modos, desenho, download, contraste, em pé,
  voltas, proporções do FC 24, reserva) e O1–O7 (duas abas pelo BroadcastChannel); da revisão: E4b/E5b (os Pênaltis, o TM pro com
  o clássico e os nomes longos — 4 abas, as duas vistas, o Simular armado — e o Rumo ao Estrelato, também no regime mínimo e no PC:
  a info, as abas e a competição sem o corte do CSS, o ícone igual na barra, os cantos dentro da borda do campinho, a letra do
  resto), E11b (o Ⓐ do Jogar com o pré-jogo não pula as cenas), E12b/E12c (os discos da Visão tática para o leitor de tela; o toque
  sem anel de foco), E19b (o "Pré-jogo da partida" mudado pelo ≡ vale no Jogar, com o webdriver de um usuário), E14 dos Pênaltis
  do TM (o [<] manda `tm3d:sair`) e a tela coberta pela pausa e pelo editor (E10/E13); do item 124: E14 do TM e do Rumo ao
  Estrelato (o "Simular partida" arma no 1º toque e no 2º manda `tm3d:sair` {motivo: 'simular'} em ≤ 2 s, nenhum `tm3d:fim`, o
  mundo no tick 0; na base o motor 3D simulava e mandava `tm3d:fim` em ~6 s) e E14r com o TM num quadro — R1* em pé (390×844,
  toque: o "Gire o celular" tem o "Simular partida", que leva os 11 + 11 titulares e não liga o som), R2*/R2b (a Visão tática e o
  1º toque do Simular não ligam o som nem baixam os sons; o Jogar liga em ≤ 1,5 s), R3* (o 2º toque dentro dos 3 s vale pela hora
  do toque com o quadro preso 3,6 s) e R4* (a reserva com o "Simular partida" no canto, sem encostar no texto da abertura); os
  quatro R reprovam antes da revisão (212ec359); `teste-ponte-tm` P9; `teste-carga` (`SO_COM_TELA`).
- **Fica** (fora da v1, anotado; FILA itens 100–107 e "Depende do dono" 19): o tempo do `teste-prepartida-tela` no
  `tempos-ci.mjs` (600 s, estimado aqui; item 100); as metas da especificação que não entraram no teste — E8, o E16 com `?tm`, 4
  das 5 mutações, o O5 de 100 s e o destaque do Sair aos 60 s (item 101); o fundo escuro e desfocado como o do FC, com o
  `pixelRatio` baixo atrás da tela (item 102, decisão do dono); o nome embaixo de cada disco da Visão tática (item 103); o selo
  grande da competição no alto do PC (item 104); o Editar time com a cara da tela (item 105); a "tela cedo", durante o
  carregamento (item 106 — FEITA no #PRNUM: parte "A tela cedo", abaixo); o Personalizar no online (item 107, decisão do
  dono); as FOTOS no lugar do busto
  (feitas no item 31, #615, só a edição pro: abaixo); o clima na linha de informação (a dificuldade entrou no item 33: seção
  "Tempo de jogo e dificuldade"). Nada foi medido
  num celular de verdade.

- **A foto da edição pro nas fichas (item 31, #615)**: `criarPrepartida({…, fotoDe(id)})` (a página passa `fotoPronta`: só a já
  decodificada) e `pp.fotoChegou(id, u)` (a página liga `FOTOS.aoChegar`): a `<img class="pp-foto">` entra no `.pp-miolo` POR
  CIMA do busto (a reserva: sem foto, com erro, no regime de emergência sem rosto), recortada pelo chanfro — a ficha não muda de
  medida (L1 do `teste-prepartida` intocado). As fotos chegam depois do `pronto` e trocam o busto ficha a ficha (fade de 0,2 s),
  sem refazer a tela. As cartas da escalação do pré-jogo (item 29) ficam sem foto (não cabem no celular: item 110); as fichas
  não têm o degradê do pé da foto do cartão do autor (item 112). Teste: `teste-prepartida-tela` E22 (`--so fotos`).
- **Item 125 (05/11, PR #621; contrato "Sistema tipográfico")**: a competição, os nomes dos times (CAIXA ALTA, 0,03 em), o
  horário (`tabular-nums`) e as abas/botões de baixo (o texto a 1,12 em do de antes, a caixa da aba igual; caixa normal SEM
  espaçamento extra — com 0,01–0,04 em os pequenos saíam "Per sonalizar", "Simul ar": revisão V-R6) na TM Cond 800; a
  mentalidade do topo E a do canto do campinho (`.pp-selo`, antes na Inter: revisão V-R7 — a mesma informação saía duas vezes
  com letras diferentes) na TM Cond 600 em caixa alta, 0,06 em; a linha de informação (estádio, data, árbitro, duração) fica na
  Inter. A conta que escolhe o rótulo e o ícone de cada aba (`prepartida-tela.js cabeAba`) mede na MESMA letra do desenho, a
  pilha do `--f-disp` 800 a 1,12 em (revisão C-R5: medida na Inter 800 a 1 em ela saía 12–18% mais larga e as abas de 667×375
  perdiam o ícone à toa); antes de a fonte chegar a medida cai na reserva (erra para o lado de encurtar, sem "…") e a tela refaz
  o layout quando ela chega (`main.js carregarPrepartida`, que pede as duas faces da TM Cond). O campo, as fichas, a
  `layoutPrepartida` e a `letra-cond.js` não mudam; o tamanho do horário ficou o de antes (vem da conta do layout: a
  especificação pedia ×1,15 e mexer nela arriscava as metas de encaixe). Testes: `teste-prepartida-tela` 83/83 (E3/E4 sem rolar
  e nada encosta em 10 telas, também com as fontes BLOQUEADAS; E5 as letras; E20 as proporções do FC 24), 0 rótulo com "…" em
  568, 667, 844 e 1280; `teste-prepartida` (Node) sem mudança.
- **A tela cedo (item 106; 07/11; PR #PRNUM, base 048b278f)**: a tela à vista ENQUANTO o 3D monta (dono: "corrije e adianta"; a
  Fase 2 da especificação do item 64; as escolhas recomendadas T1–T8 no "Depende do dono" 29 da FILA). Só a página e o TM: `main.js`,
  `prepartida-tela.js`, `css/prepartida.css`, `hud.js` (`carregandoAtras()`), `ponte-tm.js` (o comentário do protocolo) e o
  `tm3d.js` do TM (v380: contrato "Ponte com o Total Match", parte "O recado tm3d:tela"); `fecho-hash --diff origin/main` 0,
  `hash-igual` e `hash-partida` IGUAIS (a tela segura o tick 0 como antes; o Personalizar antes do 3D recria o mundo do tick 0 pelo
  mesmo `criarPartida({times})` e o 3D nasce dele).
  - **A abertura** (`main.js iniciar`): logo depois do `PAG_ONLINE` e do `criarSimularTM()` (agora no começo), o `iniciar()` espera
    o módulo da tela (`esperarPrepartida`), as fontes dela (`ppFontes`: a Inter TM 600/800 e a TM Cond, pedidas no
    `carregarPrepartida()` JUNTO com o módulo — antes só depois dele, e chegavam no meio das tarefas longas: a letra trocava 3–4 s
    depois de a tela aparecer) e a identidade do TM (`identCarga`: os escudos e as cores, pedidos já, sem o 3D) no máximo
    `PP_CEDO_MS` = 300 ms, e `abrirTelaCedo()` abre a tela com `pp.abrir({…, fundo: '2d', carregando: true})` antes do
    `criarCena`/`criarCampo` (a 1ª tarefa longa). Sem o módulo a tempo, a tela abre quando ele chegar (`ppCarga.then`), sem segurar
    o 3D mais nada; a identidade que chega depois refaz a tela uma vez (`ppIdentNaTela`). Nunca abre depois do 3D pronto, da saída
    ou com o pré-jogo rodando. O `html.com-toque` é ligado antes da entrada pela MESMA regra dela (`TOQUE_INICIAL`: `?toque=1` ou
    `pointer: coarse`), o `#carregando` sai sem o "pronto" (`hud.carregandoAtras()`), o `resize` e o `visualViewport` ligados já (o
    layout da tela só se refaz quando o tamanho MUDA: `ppTam`; refeito à toa custava uma pintura inteira no meio da carga) e o
    "Tela cheia deitada" da "Gire o celular" é decidido no começo do `iniciar()` (antes só com o 3D: empurrava o Simular 36 px no
    meio do toque).
  - **O fundo 2D** (`#prepartida[data-fundo="2d"]::before`, só CSS, opaco, debaixo do véu): o preto do TM com o verde dele vindo de
    baixo. Com o 3D pronto, `ligarFundo3D()` → `pp.carregando(false, fundo)`: o fundo de hoje (a abertura do pré-jogo CALADA ou o
    jogo parado no tick 0, pela mesma `fundoDe3D()` do `abrirPrepartida`) e o 2D some em 0,3 s (o 1º quadro do 3D já está desenhado
    atrás: sem estalo); a entrada que nasceu com o 3D fica bloqueada e os botões de toque e as cenas `inert` atrás da tela.
  - **O que espera o 3D**: as abas com `espera3d` — o Jogar (e o "Bater pênaltis"), o Pronto do online, os submenus Jogadores e
    Câmera do Livre — e o ≡ (a pausa mexe na qualidade, no horário e na câmera). Com `carregando`, `aria-disabled` + `aria-busy`
    (não `disabled`: o foco fica nelas e elas voltam sozinhas), a classe `.espera` (o mesmo rótulo e a mesma medida, um pouco
    apagada) e a barra `.pp-carga` DENTRO da aba, no pé, absoluta (o layout não muda), que anda pelas etapas do `iniciar()`
    (`pp.progresso(f)`, 0,15/0,35/0,5/0,7/0,85; a variável `--carga` só na barra) com transição, SEM animação infinita (no
    renderizador por software cada quadro composto disputa a GPU com a compilação do 3D). A aba com o foco esperando fica em
    verde-escuro (`.espera.foco`), nunca no verde cheio de "pronto". O toque, o Enter ou o Espaço nelas (e o P e o ≡) não fazem nada
    além do aviso "O estádio ainda está carregando." no `#pp-aviso` e na região viva (some com o 3D: "O estádio está pronto.");
    a `acaoPrepartida` também confere `pronto3d` (`jogarPrepartida`, 'opcoes', 'jogadores', 'camera', 'pronto'). Com o 3D, as
    abas voltam SEM refazer a tela (o foco fica onde estava).
  - **O que já vale antes do 3D**: a Visão tática, a troca do time mostrado (Q/E, LB/RB, o toque na barra), o Personalizar (o
    editor por cima do fundo 2D; o PRONTO recria o mundo do tick 0 — `teste-prepartida-tela` E26e), o "Simular partida" do TM
    (também o da "Gire o celular") e o [<]. Um mini-laço (`quadroTelaCedo`, por `requestAnimationFrame`, sem entrada e sem
    desenho, até o `pronto3d`) faz o que o laço do jogo faria: o `atualizarSimularTM()` (o Simular da "Gire o celular"), o
    `avisarTelaTM()`, o `pp.cobrir` e o `voltarParaTela()` do editor/pausa e o `pp.atualizar` (o armado que expira; o controle Ⓨ,
    Ⓧ, LB e RB). O teclado da tela vale desde a abertura (o ouvinte dela, na captura da `window`); no controle, a cruz, o Ⓐ, o Ⓑ e o
    Start chegam com a entrada do jogo (`criarEntrada`, com o 3D).
  - **O editor que chega depois** (`abrirEditor`): pelo Personalizar da tela, enquanto o `editor-time.js` baixa, a aba fica
    ocupada (`pp.esperando('personalizar')`: apagada e `aria-busy`, sem `aria-disabled`) e ele só abre se a tela ainda estiver
    aberta e o Personalizar ainda valendo, e nunca com o editor já aberto (antes abria depois do Jogar, por cima do jogo começado
    e parado: passos 4 → 4; E26j).
  - **O armado do "Simular partida"** (`prepartida-tela.js armadoVale`): o 2º toque vale se foi feito até 3 s depois do 1º (a hora
    do toque, item 124) OU até 3 s depois de o "Toque de novo" APARECER (`armadoVisto`, a hora em que o 1º toque foi atendido) —
    com a tela cedo o 1º toque podia cair numa tarefa longa e ser atendido 2,6–3,8 s depois, e o 2º, feito depois de ler o pedido,
    armava de novo (3 toques). Vale também para o [<].
  - **Sair antes do 3D**: o Simular (`simularNoTM`), o [<] e o Sair do online chamam `pararCarga()` (só com `?tm`): o `iniciar()`
    para no próximo `await` (`parou()`, depois de cada etapa) e o `tm3d:pronto` nunca sai (a página do quadro é da mesma origem do
    TM: as tarefas longas do 3D travariam a tela dele).
  - **A carga mais leve com a tela à vista**: os programas do 1º desenho mandados compilar antes dele com o fio livre
    (`compilarAntesDoDesenho`: com o `KHR_parallel_shader_compile`, `renderer.compileAsync`; sem ele — o SwiftShader dos testes —,
    `renderer.compile()` e 2 quadros cedidos; um erro só deixa a compilação para o 1º desenho, como antes) e o campo nasce com a
    altura da tela (`campo.definirAlturaTela(innerHeight)` logo depois do `criarCampo`: o `resize` pode chegar antes dele, e o
    padrão 720 valeria para as cadeiras 3D até o próximo `redimensionar()`).
  - **A reserva** (sem a tela cedo, isto é, sem o módulo até o 3D montado): mais `PP_RESERVA_MS` = 1,5 s e uma volta a mais de
    tarefas (`setTimeout 0`) antes de decidir; chegando nesse meio-tempo, a tela abre (já com o 3D). O `import()` já resolvido,
    preso atrás das tarefas longas, perdia a corrida para o relógio: na base, 1 em 14 carregamentos sem a tela com o módulo baixado.
  - **API de teste**: `__golaco.carga` ('montando' → 'segurada' → 'pronta' | 'parou'), `__golaco.soltar3d()` e o `?segurar3d=1` (a
    carga para logo antes do pronto até o `soltar3d()`: os testes olham a tela cedo com o 3D "lento" de propósito, sem depender da
    máquina); o `__golaco.prepartida.estado` ganhou `carregando` e `abertaEm` (o `performance.now()` da abertura); `pp.progresso(f)`,
    `pp.carregando(v, fundo)` e `pp.esperando(id)`; o `data-fundo` ('abertura' | 'jogo' | '2d') no `#prepartida`.
  - **Medido** (3 rodadas de cada, a base e a versão nova uma logo depois da outra; Chromium sem GPU, 1280×720 Baixa, desde a
    navegação; nada num celular de verdade): a tela no DOM 2,9–3,7 → 0,27–0,29 s (partida sem `?tm`), 3,8–4,1 → 0,32–0,34 s (TM
    pública), 3,8–3,9 → 0,33–0,37 s (TM pro); pintada (aprox.: o 2º quadro depois) 4,8–5,3 → 2,1–2,2 s, 3,8–4,1 → 2,6–2,7 s,
    3,8–4,0 → 2,5–2,8 s; o 3D pronto 2,9–3,7 → 5,1–5,4 s, 3,8–4,1 → 4,8–5,3 s, 3,8–3,9 → 4,7–5,2 s. O CUSTO: o 3D (o Jogar)
    ~1–2 s mais tarde nesse ambiente — a tela à vista disputa o processo da GPU com a montagem do 3D (a rasterização em software
    ~1,5–2 s; a maior tarefa longa depois da tela, 1,8–2,4 s, é a criação da cena e do campo esperando a GPU; sem nada por cima, a
    mesma montagem leva 1,7 s) e a tela fica parada durante essas tarefas (0,1–1,7 s até atender um toque). Sem efeito (medido):
    tirar as animações, camada própria, o contexto WebGL antes da tela, o laço sem quadros, menos remontagens. Decisão do dono
    ("Depende do dono" 29).
  - **Testes**: `teste-prepartida-tela` E26 (`--so cedo`; `--casos a,c,d,h,hp,i,j,k,l` roda só esses blocos; a sonda —
    `addInitScript` — marca o quadro do navegador em que a tela fica à vista e o em que a cena 3D nasce, o 1º contexto WebGL do
    `#tela`, e faz os gestos "antes do pronto" DENTRO da página; as metas cobram a ORDEM — a cena ≥ 2 quadros depois —, não quanto
    o 3D demora): E26a a tela ≤ 1,5 s e pintada antes da cena 3D, com a TM Cond; E26b o Jogar e o ≡ esperam e voltam sozinhos, o
    foco igual; E26c o TM público num quadro (o `tm3d:tela`; o Simular antes do 3D → `tm3d:sair` 'simular' com 11 + 11 titulares
    em ≤ 2 s, sem `tm3d:pronto` nem `tm3d:fim` depois, `api.carga` 'parou'); E26d o estado "carregando" sem rolar e sem encosto
    no TM (4 abas) em 568×320, 844×390 com o entalhe e no PC, contraste ≤ 50/255; E26e o Personalizar antes do 3D; E26h com o
    pré-jogo (o fundo 2d e depois a abertura calada), os Pênaltis 3D do TM e o Rumo ao Estrelato (o 1º toque atendido 3,2 s
    depois: o 2º vale); com o 3D SEGURADO: E26i (o módulo atrasado 1,2 s abre a tela cedo quando chega; o Jogar sem o verde cheio
    e o aviso à vista; o editor de verdade antes do 3D e a tela de volta no Esc), E26k (o TM em pé: a "Gire o celular" com o
    Simular e o `tm3d:tela`; o Simular no mesmo lugar com o 3D) e E26l (os Pênaltis do TM em pé: sem o `tm3d:tela` até deitar; o
    [<] → `tm3d:sair` e a carga para); E26j (sem segurar) o editor que só baixa depois do Jogar não abre por cima do jogo. Na base
    5/13 (só os S1); 11 de 12 mutações reprovam (a 12ª, só a espera das fontes nos 300 ms, passa: pedidas cedo, elas chegam antes
    do módulo). Também `teste-ponte-tm` P14 e o `testar-3d` (contrato "Ponte com o Total Match").

## Sistema tipográfico — a letra esportiva do 3D (item 125; 05/11; contrato)
Pedido do dono (05/11, com o print da pausa no PC 1917×1010 com `?tm`, West Ham × Preston): "fontes tem que ser mais legais, o
campinho um pouco maior, tem que ser mais legal, e não é só aí". FILA item 125, PR #621 (branch `golaco/f125-visual-telas`,
base 29d67bad — o #618); as escolhas no "Depende do dono" 25; pesquisa em `PESQUISA-ESTADIO.md` §7.6. O campinho maior e a pausa
estão no contrato "Pausa (item 58)" (os blocos "item 125"); o cartão do autor (item 126, o mesmo PR) em "Comemoração do gol".
**Só DOM, CSS e página**: `css/estilo.css`, `css/tm.css`, `css/pausa.css`, `css/prepartida.css`, `css/prejogo.css`,
`css/editor.css`, `css/cenas.css`, `index.html`, `js/main.js`, `js/hud.js`, `js/tm-cara.js`, `js/pausa-tela.js`,
`js/editor-time.js`, `js/prepartida-tela.js`, `js/disputa-tela.js`, `js/livre-pagina.js`, `js/online-pagina.js`, os 2 arquivos
novos de fonte e o `assets/tm/CREDITOS.md`; nenhum módulo do fecho (`fecho-hash --diff 29d67bad` 0; `hash-igual --ref 29d67bad
--rapido` IGUAL; `hash-partida --ref 29d67bad --sementes 2 --min 1 --par 2` IGUAL, 104 hashes). O `legacy-total-match/` não
mudou (os menus do TM continuam na Inter).
- **As famílias e os arquivos** (todos self-hosted em `golaco/assets/tm/fontes/`, WOFF2 da API css2 do Google Fonts sem mudança,
  `font-display: swap`):

  | Família CSS | Fonte (licença) | Pesos | Arquivos (bytes latin / latin-ext) | Papel |
  |---|---|---|---|---|
  | `'TM Cond'` | Barlow Condensed, de Jeremy Tribby (SIL OFL 1.1, `OFL-barlow-condensed.txt`; a letra da carta do TM) | **600** (novo) e 800 (do item 29) | `tmcond-600-latin.woff2` 22.308 / `tmcond-600-latin-ext.woff2` 14.516; `tmcond-800-latin.woff2` 22.464 / `-latin-ext` 14.548 (byte a byte o `legacy-total-match/assets/fontes/barlow-condensed-*` do TM) | `--f-disp`: títulos, itens de menu, números, nomes, siglas, rótulos curtos em caixa alta |
  | `'Inter TM'` | Inter, de Rasmus Andersson (SIL OFL 1.1, `LICENCA-Inter-OFL.txt`) | 400/600/800 sem `?tm` (a pausa); 400–900 com `?tm` | os de antes (23,7–24,5 KB cada, só latin) | o texto corrido com `?tm` (o `--fonte` do `html.tm`) e o `--p-fonte` da pausa |
  | `'TM Cond reserva'` / `'TM Cond reserva larga'` | `local()` da Arial/Liberation/Helvetica/Roboto/FreeSans e da DejaVu, com `size-adjust` 71% / 62% | 600 e 800 | 0 B | a reserva enquanto a TM Cond não chega: nunca passa da largura dela (as contas das cartas da escalação são da TM Cond; revisão V5 do item 29) |

  As faces da TM Cond (600 e 800 × latin e latin-ext por `unicode-range`; a latin SEM U+2191/U+2193, que a fonte não tem —
  revisão V-R4: o "→" do "ATAQUE" saía um tracinho da reserva e virou SVG) e as reservas moram no `css/estilo.css` desde o item
  125 (antes só o 800, no `css/prejogo.css`). Declarar não baixa nada: o arquivo só vem com um texto que use a face, ou pela
  pré-carga; o latin-ext só com um nome em č/ł/ğ. Crédito e origem no `assets/tm/CREDITOS.md`. Sem 700, sem itálico, sem
  `pyftsubset` (corta 15–33%, pouco em bytes: fica para quando a folga do `teste-carga` apertar).
- **Os tokens** (`estilo.css :root`): `--f-texto: var(--fonte)` (com `?tm` o `tm.css` troca o `--fonte` pela Inter TM) e
  `--f-disp: 'TM Cond', 'TM Cond reserva', 'TM Cond reserva larga', 'Arial Narrow', sans-serif`. Peça nova de interface usa um
  dos dois, nunca uma família solta: saiu a família `"Inter"` SEM `@font-face` que as tarjas das cenas (`cenas.css`), o cartão do
  autor, a faixa ENTRA/SAI e o online (`"Inter,system-ui"`) pediam — caía na letra do aparelho (com a Inter instalada uma, sem
  ela outra).
- **Os papéis**: **D1** título grande (a formação no campinho, o horário, o "GOL!", os gols das tarjas) TM Cond 800; **D2** item de
  menu (a lista da pausa, as abas, os botões dos submenus, do editor e da faixa do fim) TM Cond 600 — o foco/escolhido na 800 —,
  caixa NORMAL e SEM espaçamento extra (revisão V-R6); **D3** nome de jogador (as fichas da pausa, o cartão do autor, as tarjas, a
  faixa ENTRA/SAI, as cartas do Editar time) TM Cond 800 em CAIXA ALTA (sem lugar, a 600, ~5% mais estreita); **D4** rótulo curto
  (o estado do item, a mentalidade, os títulos de seção, os grupos, as siglas) TM Cond 600 em caixa alta, 0,04–0,16 em (as siglas
  na 800); **N** número (o placar com `?tm`, notas, valores, o número da camisa, o relógio) TM Cond 800 `tabular-nums`; **T**
  texto (a Ajuda, as descrições, os rótulos das Opções e das Estatísticas, a informação da tela antes do jogo, os avisos, o nome
  do condutor) no `--f-texto`. Regras: condensada a partir de ~14 px; abaixo disso só em caixa alta (nomes das fichas, siglas,
  rótulos de 11–13 px); texto de 11–13 px em caixa normal fica no `--f-texto`; nada itálico nem inclinado; nenhuma letra < 11 px
  (≥ 10 só nas fichas da pausa em 568×320); contraste AA (texto ≥ 4,5:1, grande ≥ 3:1).
- **A regra antiga muda**: a cara do TM dizia "nada itálico, inclinado ou condensado" (`css/tm.css` e o CLAUDE.md, na seção do
  `futebol3d`). Desde o item 125: "nada itálico nem inclinado; condensada (a TM Cond) nos títulos, itens de menu, números, nomes e
  siglas; o texto corrido continua na Inter" — o pedido de 05/11 ("fontes tem que ser mais legais") vale mais. Registrado no
  cabeçalho do `css/tm.css`; as sobreposições do `tm.css` que desfaziam a caixa alta/o espaçamento novos saíram (`.faixa-titulo`,
  `#ajuda h2/h3`, `.ed-titulo`, `.ag-sigla`/`.ag-num`, `.pj-esc-nome`…).
- **O carregamento** (sem piscar e sem crescer o download sem `?tm`; a reserva de mesma largura máxima desenha na hora):
  - **Sem `?tm`**: o HUD do 1º quadro (placar, nome do condutor, avisos, botões de toque) fica no `--fonte` (o sistema). A
    pré-carga ociosa da pausa (`main.js fontesPausa`, ~8 s depois do 1º quadro, no 1º gesto ou com a pausa aberta) traz a TM Cond
    600 e 800 latin (`FONTES_DISP`) além da Inter TM; `pedirFontesDisp(texto?)` (sem esperar) no `baixar` do `SOB.editor` e do
    `SOB.cenas`, no `carregarPrepartida` e no COMEÇO da cena do gol (`iniciarComemoracao`, com o nome do autor como texto: o
    latin-ext vem junto se ele tiver č/ł/ğ — o cartão entra ~1,6 s depois). O "GOL!" só pede a família com a camada `.visivel`
    (no layout escondida ela baixaria no 1º quadro). Download inicial: +0 B de fonte (`teste-carga`).
  - **Exceção — o modo Pênaltis sem `?tm`**: o painel da disputa aparece no 1º quadro, então o `disputa-tela.js` pede a 800 e a
    600 na IMPORTAÇÃO (revisão C-R4: pedida quando o painel pintava, aos 4,8 s, o texto já na tela trocava de letra; agora aos
    0,4 s e carregada antes do painel) — ~44 KB a mais só nesse modo (o `teste-carga` mede a partida padrão).
  - **Com `?tm`**: o `<script>` do `<head>` escreve, antes do `tm.css`, `<link rel="preload"
    href="assets/tm/fontes/tmcond-800-latin.woff2" as="font" type="font/woff2" crossorigin>` (o placar usa o 800 no 1º quadro; o
    preload ignora o `unicode-range`: só o latin; é o mesmo arquivo do `@font-face`, então o preload é reaproveitado); o
    `tm-cara.js carregarFontes` pede os 5 pesos da Inter TM e os 2 da TM Cond (`FONTE_DISP`, `PESOS_DISP` [600, 800]) e só põe
    `data-fontes-tm="ok"` com todos; o `tm:fontes` faz a página medir de novo (o topo do HUD). +44.772 B no começo (não medido
    pelo `teste-carga`, que roda sem `?tm`).
- **A escala** (px, medida; PC 1920×1010 · 1280×720 · celular 844×390 · 667×375 · 568×320):
  item da pausa / foco 31/39 · 21/28 · 18/20 · 18/19 · 17/18; título dos submenus 24 · 17 · 16 · 16 · 15; valor das Estatísticas
  24 · 18 · 16 · 16 · 15; nome nas fichas do campinho 18 · 15 · 11 · 11 · 10; formação no campo 18–40 (6,2% do campo); placar
  com `?tm` siglas/gols/relógio 15/23/20 no PC, 14/21/19 no celular e 13/20/18 em 568×320 e 640×360 (antes 13/20/17, 12/18/16 e
  11/18/16); cartão do autor nome/número 26,3/17,7 · 20/15,6 · 18/14,3 · 18/14,3 · 18/14,3 (sem foto, o nome ≥ 15,6).
- **As outras telas** ("e não é só aí"; o que mudou em cada uma):
  - **Placar** (só com `?tm`, `css/tm.css`): siglas, gols e relógio na TM Cond 800 — letras maiores na MESMA altura (28/26/30) e a
    barra igual ou mais estreita (H10, jogo / "+10" / intervalo; o "antes" é a medida do item 32 com a DejaVu Sans do CI:
    844×390 234/258/249 → 230/253/239 px; 667×375 210/234/225 →
    206/229/215; 568×320 202/226/217 → 194/217/207; em 568×320 as siglas de 13 px para não passar da largura de antes); o H1 com o
    TM no pior caso 8,82 → 8,79% (844), 10,79 → 10,74% (667), 11,62 → 11,51% (568). Sem `?tm`, o de sempre.
  - **Nome do condutor** (só com `?tm`): o número na TM Cond 800 (14 px; 13 com toque); o nome continua na Inter TM 700 (caixa
    normal a 11–12 px: cabe e lê melhor).
  - **"GOL!"** (`#gol-tela`): TM Cond 800 RETA, caixa alta, 0,02 em, ×1,1 do tamanho (`clamp(70px, 18.7vmin, 185px)`; com toque
    `clamp(44px, 13.75vmin, 106px)`); só com a camada `.visivel`.
  - **Faixa do intervalo e do fim** (`#faixa`): o título na 800 (26 px, 0,08 em), o placar na 800 (18 px) e os botões na 800
    (17 px; o principal em caixa alta — revisão V-R7: antes os botões ficavam na Inter).
  - **REPLAY e "Pular"**: a marca na 800 (14 px, 0,16 em); o "Pular" na 800 caixa alta (17 px, 0,06 em; ≥ 112 × 52).
  - **Selo IMPEDIMENTO / POSIÇÃO LEGAL** (`#terco`): 800 caixa alta, 0,12 em, 17/15 px.
  - **Faixa ENTRA/SAI** (`.faixa-subst`): a sigla, o número e "ENTRA"/"SAI" na 800; o NOME na 800 em CAIXA ALTA (22 px; 16 com
    toque; a menor letra 10 → 11).
  - **Cenas** (`css/cenas.css`): a tarja do cartão (sigla 15, número 24/18, nome caixa alta 22/16), a tarja do placar (gols 28/20;
    os autores na Inter, 12 com toque), o painel (título 16/13 caixa alta, valores 20/16 `tabular-nums`, rótulos na Inter) e o
    melhor em campo (rótulo na 600 caixa alta 13/11, nota na 800 24/18); a família `"Inter"` sem face → `--f-texto`.
  - **Editar time** (`css/editor.css`, `js/editor-time.js`): o título "EDITAR TIME" (16/20), as abas (15/17), a nota, a posição
    (10 → 11, caixa alta), o NOME (caixa alta), o número (10 → 11), os grupos (10 → 12), o selo (10 → 11 num círculo de 16) e os
    botões na TM Cond; nenhuma letra < 11 px (o nome encolhia até 8,5 px: agora encolhe até 11 e, sem lugar, vai para a 600 e
    ganha "…"; as cartas estreitas do celular com 4 px dos lados — revisão C-R3); o recorte do nome sobe e desce 0,2 em além da
    linha (padding com a margem negativa do mesmo tanto: a caixa não muda — revisão V-R1, o til, o agudo e o cedilha das
    maiúsculas eram comidos: "GUIMARAES", "AVILA"); a seta do "ATAQUE" em SVG (V-R4). **No PC a janela cresce com a tela**:
    `min(max(1120px, 74vw), 1400px, 100%)` × `min(max(640px, 82vh), 860px, 100%)` (em 1280×720 a de antes) e `--ed-k` (1 a 1,3,
    a janela ÷ 1120×640, `escalaPC`) escala as cartas do campo, as reservas e as letras delas (revisão V-R2: a janela crescia e as
    cartas ficavam 104×64). `:where(.editor) button` (a família do `--fonte` sem passar por cima das classes com a TM Cond).
  - **Tela antes do jogo** e **escalação do pré-jogo**: contratos "Tela antes do jogo (item 64)" (o bloco do item 125) e
    "Pré-jogo" — na escalação o rótulo "ESCALAÇÃO" (600, 0,16 em), o nome do time (800 caixa alta), a formação e o número da carta
    na TM Cond; os nomes de camisa continuam na 800 em caixa NORMAL (a conta das cartas do item 29, `letra-cond.js`, e as metas N
    do `teste-escalacao-campo` são em caixa normal; caixa alta é decisão do dono).
  - **Ajuda, Livre, online e disputa**: no contrato da pausa (o bloco "Item 125 nos submenus"); a disputa de pênaltis na 800 de
    13 px (14 no PC; antes 800 de 11 px na fonte do sistema) e a vez na 600.
  - **Não mudam**: os botões de toque (o `entrada.js rotuloQueCabe` mede o nome no canvas com o `--fonte`: trocar a fonte mexeria
    no H9 e no `teste-controles`), "Gire o celular", o carregamento, a dica do PC e os textos do 3D (faixas, bandeirões, fachada).
- **O que os testes conferem**: `tools/lib/tipografia.mjs` (as funções que rodam NA PÁGINA): **T1** toda família PEDIDA (a 1ª do
  `font-family` computado do texto visível) tem `@font-face` ou é do sistema; **T2** a letra mínima ≥ 11 px (`mesmoTransparente`
  conta o 1º quadro de uma animação de entrada) — chamadas pelo `teste-pausa-tela` P8, o `teste-comemoracao-tela` H17 e o
  `teste-editor-tela` 15 (6 telas; reprova as 6 na base: letras de 10 px em 4 lugares e nomes encolhendo até 8,5 px). Também:
  `teste-editor-tela` 16 (com `?tm` e nomes longos e acentuados em 1920×1010, 568×320 e 375×667: a tinta dos acentos e do
  cedilha dentro do recorte do nome — +2,15 → −0,7/−1,86 px —, letras ≥ 11, cortado só com "…" — 0, ≤ 4, 0 —, a seta em SVG e,
  no PC, as cartas ≥ 124 × 76 com a nota ≥ 26 px; reprova as 4 coisas em e60e2c7c); `teste-pausa-tela` P4/P8/P12/P13 (contrato
  da pausa); `teste-comemoracao-tela` H3/H17 (contrato da comemoração); `teste-hud-minimo` H10/H10a (com `?tm` o relógio e os gols
  na TM Cond carregada, as letras e as larguras acima) e H1/H1b; `teste-tm-tela` 1c (o relógio na TM Cond 800 carregada) e 5b
  (o nome do condutor na Inter TM e o número na TM Cond) — mudanças DE PROPÓSITO; `teste-penaltis-tela` 1c (sem `?tm`, a TM Cond
  800 e 600 já carregadas no 1º instante do painel; reprova em e60e2c7c); `teste-carga` — a TM Cond saiu do `SO_COM_TELA`
  ("nunca com webdriver, nem na pré-carga": MUDOU DE PROPÓSITO, a pausa, as cenas e o cartão do autor a usam) e entrou em
  `FONTES_DISP` (nunca no download inicial, pedida pela pré-carga) e `FONTES_DISP_EXT` (o latin-ext nunca); `teste-prejogo` (o
  caso "a TM Cond sem carregar" da escalação em 568×320 olha a face 800, a bloqueada: a pré-carga traz a 600); `teste-substituicao-
  tela` T3 (o nome da faixa ENTRA/SAI desenhado em caixa alta: o `innerText` volta "WALLACE PIMENTA" e o teste compara pelo
  `toLocaleUpperCase('pt-BR')`); `teste-prepartida-tela` (sem mudança de meta: 83/83). `tools/lib/tempos-ci.mjs`: o
  `teste-comemoracao-tela` 85 → 115 s e o `teste-editor-tela` 51 → 70 s (estimados aqui: acertar pelo log do CI).
- **Medidas** (29d67bad → PR): download inicial sem `?tm` 2773 → 2784 KB nossos (+11 KB de CSS/JS, nenhuma fonte; folga até os 4
  MB 647,4 → 636,6 KB); a pré-carga ociosa +44.772 B (a TM Cond 600 e 800 latin); com `?tm` +44.772 B no começo; famílias sem
  `@font-face` pedidas pelo texto visível 4 lugares → 0; a menor letra do Editar time 10 px (nomes até 8,5) → 11; a pausa, o
  placar e o cartão do autor nos contratos deles.
- **Fica** (FILA itens 125 e 126 e "Depende do dono" 25): os números das camisas no canvas (`render/humano3d.js`) pedem
  "Barlow Condensed", família sem `@font-face` (desenho 3D, fora deste item); sem `?tm`, um gol nos primeiros ~8 s (antes da
  pré-carga) pode trocar a letra do "GOL!" no meio (o cartão do autor não: a fonte é pedida 1,6 s antes); 568×320 com os nomes
  longos do TM ainda corta 3 nomes de 10 letras na pausa e 2 no Editar time (o limite físico de ~46 px por ficha); a TM Cond em
  caixa normal pequena (≤ 16 px) com o espaçamento conferido só no Chromium daqui ("Per sonalizar", revisão V-R6 não
  confirmada em aparelho); o download com `?tm` fora do `teste-carga`; a régua T1/T2 fora do `teste-cenas-tela` e do
  `teste-prepartida-tela` (rodados só para ver se não quebravam); a cara do 3D se afasta um pouco dos menus do TM, que continuam
  na Inter. Não rodados aqui (modo enxuto; o CI decide): `teste-estadio` (o "GOL!"), `teste-livre-tela`, `teste-controles` e o
  `teste-cenas-tela` inteiro depois da revisão (antes dela, 122 itens; depois, `--so F`). Instáveis com a máquina carregada (a
  base também): o T9 do `teste-substituicao-tela` (36 → 37 programas de shader numa rodada), o S1 online do `teste-pausa-tela` e o
  E7* do `teste-prepartida-tela`.

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
  partida: sem reposição automática, ENFIADA = `soltarNoChao` (evento `soltou`, `regraMao.soltou`); desde o C5 (31/10) a
  partida com a bola rolando repõe com o gesto — contrato "Reposição do goleiro com a mão": PASSE arremessa, LANÇAMENTO é
  o bate-pronto, CHUTE o chutão, a IA arremessa ou dá o chutão pela pressão; tiro de meta: a IA cobra por ele em
  `PARTIDA.cobrancaHumanoMax`); `pegarDoHumano` (PEGAR na borda, bola a ≤
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
aceleração, a curva de chegada, o desvio e o bote sem entrar no corpo: `PESQUISA-ETAPA3.md` §17.3; desde 01/11, 64 partidas
em 3 processos e o M3 — o "um a mais" — pela média PAREADA caso a caso, reprovando quando o bootstrap por partida PROVA o Δ
abaixo de 1,5 m: a diferença das medianas de cada ramo quase não via o botão que não soma ninguém; ver o cabeçalho do teste)
e `teste-goleiro-regras` no padrão;
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

## Placar (17/10) — maior, com a cara do Total Match e o relógio em MM:SS (item 32; contrato)
Pedido do dono (17/10, item 32 da FILA): "o placar com mais a cara do Total Match, um pouco MAIOR e o relógio com os SEGUNDOS
além dos minutos". **Registro de 12/10**: antes, com uma imagem de referência (a barra de TV de 248×29 px numa tela de
844×390), ele tinha pedido "quero o placar assim, tem que ser algo menor e mais com a nossa cara" — o placar de 24 px (26 no
PC) com o relógio em minutos ("34'", "45+2'" com "1º T +4") e o H10 exigindo ≤ 24/26 px e menor que o de antes. O pedido
de 17/10 é POSTERIOR e é o que vale. Pesquisa e medidas em `PESQUISA-ESTADIO.md` §7.3. **Só DOM, CSS e a leitura do mundo
pelo HUD**: `fecho-hash --diff` 0 (o `partida.js`, o `config.js` e a `sumula.js` não mudam), `hash-igual` e `hash-partida`
IGUAIS.
- **O relógio (`js/relogio-placar.js`, puro, SEM import, FORA do fecho do hash; só o `main.js` e o `hud.js` o importam)**:
  - `segundoDeJogo(m)` → o segundo de jogo do placar (inteiro): 0–2700 no 1º tempo, 2700–5400 no 2º e além disso nos
    acréscimos (o relógio continua, como na TV); intervalo 2700, fim 5400. O minuto sai da MESMA conta float do
    `minutoDeJogo` (`Math.min(1, d / T) * 45`, na mesma ordem) e os segundos da fração dela, com teto de 59 — a conta inteira
    pura `floor(d·2700/T)` discordava do `minutoDeJogo` em 34 de 537.402 ticks de 17 durações (4 min, d = 4160: o minuto 12
    contra "13:00"). Nos acréscimos `base + 2700 + floor((d − T)·2700/T)`: `floor(·/60)` = o `decorrido` do
    `acrescimoDeJogo` (a mesma conta inteira). Anda 11,25 segundos de jogo por segundo real com 4 min por tempo.
  - `textoRelogio(r)` (r = `{segundo, estado, acrescimo: {anunciado} | null}`; aceita o `{minuto, acrescimo: {decorrido}}`
    de antes) → `{texto, extra, formato}`: `'34:12'` (os minutos sempre com 2 dígitos; 3 só além de 99:59 — um gol nos
    acréscimos máximos do 2º tempo, na pausa do gol), `extra` `'+4'` só com o anúncio (`formato: 'acrescimo'`),
    `'Intervalo'`/`'Fim'` com `formato: 'parado'`.
- **`main.js`**: `lerRelogio()` leva `segundo` (além de `minuto`, `tempo`, `estado`, `acrescimo`); `estado().relogio.segundo`;
  `__golaco.placarDeTeste([a, b], relogio)` aceita o `{segundo, …}` e o `{minuto, …}` de antes. Online e "Simular o resto"
  chamam o mesmo `lerRelogio` (os dois aparelhos escrevem o mesmo texto no mesmo tick). No "Simular o resto",
  `mostrarSimulando` escreve o relógio a cada pedaço simulado, ANTES de sair cedo pela faixa, que só muda com o minuto (na
  revisão; antes os segundos ficavam parados até ~1 min de jogo). A faixa "Simulando o resto da
  partida…" continua com o minuto (`${minutoTM}'`): é a faixa do meio, não o placar. A súmula e a tarja do intervalo/fim
  continuam com o minuto ("45'"/"90'" num gol nos acréscimos; o resultado do TM não muda).
- **`hud.js relogio(r)`**: saída rápida pela chave do quadro anterior (segundo, estado, anúncio; o `{minuto}` de antes) — nada
  aloca nos ~50 quadros por segundo em que o segundo não muda; escreve `#relogio` (o texto) e `#relogio-tempo` (só o "+N")
  só quando mudam (~11 escritas por segundo; 0,033 ms cada com o layout forçado, num PC); liga `.com-tempo` (acréscimo) e
  `.parado` (intervalo e fim) só na troca de formato; `ajustarTopo()` só na troca de formato, do "+N" ou do número de
  caracteres (os dígitos têm largura fixa: `tabular-nums`). Saiu o `NOME_TEMPO` ("1º T"/"2º T"): com MM:SS, 00–45 é o 1º
  tempo e 45–90 o 2º.
- **`index.html`**: o DOM é o mesmo (nenhuma peça nova): `.placar` = `.placar-marca` | `.placar-time.t0#placar-time-0`
  (`.placar-cor` + escudo `#escudo-0` + `#sigla-0`) | `.placar-resultado` (`#gols-0`, `.placar-x`, `#gols-1`) |
  `.placar-time.t1#placar-time-1` | `#placar-relogio` (`#relogio` = o MM:SS ou a palavra; `#relogio-tempo` = só o "+N").
  Escudos fictícios em `<symbol>` no `svg.sprite`; igual na partida e nos treinos (nos treinos, no Livre e na disputa o
  relógio fica `hidden`). Cada time é `role="img"` com o nome no `aria-label`.
- **`css/estilo.css`** (a geometria, a mesma nas duas páginas): `--placar-h` 28 px no celular (a referência do dono: 29), 26
  nas telas baixas (`max-width: 1000px` e `max-height: 340px`: 568×320; e, desde a revisão, `max-width: 700px` e `max-height:
  360px`: 640×360, o Android de 360 dp deitado) e 30 no PC (`min-width: 1001px`); fundo
  `rgba(7,9,10,0.82)`, borda verde 0,3, cantos de 8 px; gols de 18 px (20 no PC) com `tabular-nums`; siglas de 12 px (11 nas
  baixas, 13 no PC); escudos 15×16 (14×15 nas baixas, 16×17 no PC); faixa da cor do time de 3 px; relógio de 16 px (17) 800
  `tabular-nums` no bloco `--verde`; o "+N" de 11 px (12) dentro do bloco; parado, a palavra de 13 px (14) no bloco
  `--verde-escuro`. A marca (20 px; 24 no PC) só aparece na partida com mais de 700 px de largura (`@media (max-width:
  700px) { html.em-partida .placar-marca { display: none } }`; nos treinos fica). Topo apertado (`hud.js ajustarTopo`):
  `topo-c1` tira a marca só nos treinos; `topo-c3` tira o "+N"; `topo-c4` aperta só os espaços; na partida c1 → c2 → c4 → c3
  (com o minimapa embaixo nenhum liga POR ENCOSTAR nas telas medidas). O orçamento do HUD (revisão): no celular, na partida,
  cada dígito a mais que o placar de todo dia (gols de 1 dígito e "97:13 +10") liga os mesmos passos mesmo sem encostar.
  `digitosExtra` conta os gols ≥ 10 e o relógio ≥ 100:00, que só aparece na pausa de um gol depois dos +10. Com um dígito a
  mais liga o `topo-c4` (~15 px); com dois ou mais, também o `topo-c3` (sai o "+N"). As fontes não mudam.
- **`css/tm.css`** (só com `?tm`): a Inter TM (a `--fonte` de `html.tm`; a Inter continua sem baixar sem `?tm`) — desde o
  item 125 as siglas, os gols e o relógio na TM Cond 800 (o `--f-disp`; o 800 latin com `preload` no `<head>`): siglas 14 px
  (15 no PC, 13 nas telas baixas), gols 21 (23, 20), relógio 19 (20, 18), parado 15 (16), `tabular-nums`, as alturas
  28/26/30 iguais e a barra igual ou mais estreita (contrato "Sistema tipográfico"; `teste-hud-minimo` H10a e `teste-tm-tela` 1c
  mudaram de propósito) —, o fundo no
  degradê do cartão do TM, borda `rgba(34,197,94,.3)`, gols em `--tm-verde-cl`, o relógio no `--tm-botao` com `--tm-tinta`,
  parado no `--tm-verde-fundo` com `--tm-texto` (contraste ≈ 5:1), a marca com o `--tm-simbolo` (24 px a 18; PC 30 a 22).
- **Medidas** (b3041818 → item 32; DejaVu Sans, a fonte do CI; caixa no jogo / "+10" / intervalo, px): 844×390 202×24 /
  276×24 / 270×24 → 240×28 / 268×28 / 257×28 (com o TM 234 / 258 / 249); 667×375 → 220 / 248 / 237 (TM 210 / 234 / 225);
  568×320 → 213×26 / 241×26 / 230×26 (TM 202 / 226 / 217); 640×360 (revisão) 220×28 / 248×28 / 237×28 → 213×26 / 241×26 /
  230×26; PC 206×26 / 279×26 / 270×26 → 256×30 / 286×30 / 275×30.
  Orçamento (H1, pior caso da tela: defesa, o nome de 88 px, o pior estado do relógio, sem/com o TM): 844×390 8,66 → 8,91%
  (TM 8,82); 667×375 10,84 → 10,95% (TM 10,79); 568×320 12,06 → 11,85% (TM 11,62) — a meta passou a ≤ 12% SÓ em 568×320
  (decisão do dono, FILA "Depende do dono" 15; com MM:SS, escudos e siglas, os 11% ali pedem uma barra de ≤ 169 px a 28 px).
  H3 (torcida atrás do HUD, 844×390) 7,3 → 9,4% (≤ 15%); H5 (PC, o placar mais largo e o nome de 200 px) 2,04 → 2,21% (TM
  2,03 → 2,20; ≤ 2,5%). Revisão: a 640×360 entrou no H1 (meta 11%; com 28 px ia a 11,21% no "+10", com 26 px fica em 10,93%;
  TM 10,75%), e os 4 estados mais largos também (10-9 com "+10", "100:18 +10", 10-10 com "100:18 +10" e o intervalo com 10-9).
  Sem o aperto eles chegavam a 11,35% em 667×375, 12,37% em 568×320 e 11,65% em 640×360; com o aperto ficam em 10,92, 11,79 e
  10,88%. A folga em 667×375 no "+10" sem o TM continua 0,05 ponto (a fonte do sistema; o CI usa a DejaVu Sans).
- **Testes**: `teste-relogio-placar` (Node, padrão; R1 a conta = o `minutoDeJogo` em todos os ticks de 7 durações, nunca
  volta, 675 mudanças em 3600 ticks; R2 os acréscimos = o `decorrido`; R3 o texto; R4 a partida de verdade e o minuto da
  súmula = o do relógio limitado ao tempo regulamentar em todo tick; R5 o hash igual chamando o relógio, sem import e fora do
  fecho); `teste-hud-minimo` H1 (os 4 estados do relógio e os 4 mais largos × sem/com o TM, 4 telas), H1b (revisão: nos
  estados largos o aperto pelos passos, os textos, as fontes nos mínimos do H10 e nada sai da barra), H10 (formato, 28/26/30
  px, "um pouco": ≤ 29 px, área no jogo ≤ 1,5 × a de 12/10 e ≤ 7192 px² em 844×390, legível, nada encosta; 4 telas e o PC,
  sem e com o TM, 5 estados; a base reprova), H5 (o placar mais largo), H14 (o relógio anda: 113 s de jogo em 10 s reais, 0 voltas, escritas ≤ textos + 1,
  a largura constante; os estados com `?min=0.25`; a base reprova); `teste-controles` (MM:SS); `teste-tm-tela` 1c (30 px,
  MM:SS na Inter TM, o símbolo do TM) e 3b (revisão: no "Simular o resto" o relógio é sempre o do mundo, "Fim" no fim); `teste-replay` A6 (o texto do placar na tela do replay aceita o MM:SS);
  `teste-online-tela` P7 ("Fim" nas duas abas); `teste-penaltis-tela` 9 (com a `--placar-h` de 28 px as bolinhas da disputa
  descem 4 px: a faixa do fim desce para baixo delas também nas telas de até 380 px de altura, `disputa-tela.js`).
  `--so-placar` roda as telas do H1 (com o H1b, o H7 e o H9), o H5, o H10 e o H14, sem os 2 min de jogo.
- **Fica** (FILA itens 82–84): a tarja do intervalo/fim e a faixa do "Simular o resto" escrevem o `minutoTM` da súmula ("45'"
  num gol dos 47:13; a TV escreveria "45+2'" — o item 82 põe o acréscimo num campo opcional, sem mudar o minuto que vai ao TM);
  a folga do H1 medida só com a DejaVu Sans e em 4 telas, e o custo da escrita do relógio no celular estimado, não medido (item
  83); o tempo do `teste-hud-minimo` no `tempos-ci.mjs` é o de antes (item 84).

## Ponte com o Total Match (15/10; contrato)
Pedido do dono (15/10): o GOLAÇO novo vira o motor 3D das partidas do Total Match (TM). O TM grava o pedido em
`localStorage["tm3d:pedido:<id>"]` e abre `golaco/index.html?tm=<id>` num iframe (lado do TM: `legacy-total-match/js/tm3d.js`).
**Sem `?tm` nada muda**: `hash-partida`/`hash-igual` IGUAIS, a mesma tela, os mesmos testes.
- **`ponte-tm.js`** (página): `ID_TM`, `PEDIDO_TM` (lidos na importação, síncronos), `NO_QUADRO`, `MENSAGENS`, `sementeTM(id)`
  (a semente da partida pelo id: cada partida do TM é outro jogo), `avisarTM(tipo, extra)` (`window.parent.postMessage({tipo,
  id, ...}, location.origin)`), `gravarResultadoTM(r)`, `fimTM(r)` (grava + `tm3d:fim`; fora do quadro volta a `../index.html`)
  e `sairTM(extra)` (`tm3d:sair`, SEM resultado: o TM simula a partida lance a lance, como sem o 3D; `extra` vai na mensagem —
  `{motivo: 'simular', titulares: {home, away}}` = o "Simular partida" antes do jogo (item 124: o TM fica calado e simula com os
  titulares mostrados, tmIds, 11 por lado; desde o item 106 também antes do 3D pronto, sem `tm3d:pronto` depois), `{motivo: 'erro'}` = o 3D não roda aqui (sem WebGL 2, pedido sumido, erro no início:
  o TM avisa "O 3D não abriu: partida simulada."); sem motivo (os Pênaltis 3D antes do Bater) o TM só volta. O abandono do
  Online 3D vai pelo `avisarTM` direto: `{abandono: true}`).
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
  sempre a partida; a súmula alimentada em `rodarPasso`; `tm3d:pronto` no `api.pronto` (e, antes dele, o `tm3d:tela` da tela
  cedo — item 106, parte "O recado tm3d:tela", abaixo); o resultado gravado já no apito; a
  faixa do fim com "Voltar ao Total Match" (`data-cmd="voltar-tm"` → `fimTM`); **"Simular o resto"** (`data-cmd="simular-resto"`):
  fecha pré-jogo, replay, comemoração, substituição e editor, a IA joga pelo humano (`entradaDemoPartida`) e `passoPartida` roda
  em pedaços de 30 ms por quadro SEM desenhar, com a faixa "Simulando o resto da partida… 63' · FLA 1 × 0 PAL"; no apito, a faixa
  do fim. `window.__golaco.tm = {id, pedido, humano, trava, mapa, controlado, simulando, mensagens, sumula(), resultado(),
  simularResto() (Promise), resultadoGravado(), fotos (item 31: as da edição pro, contrato "Comemoração do gol")}` (null sem
  `?tm`).
- **`hud.js` / `index.html`**: `criarHud({tm: {trava, timeHumano}})` — a pausa sem "Reiniciar partida", com o "Modo de jogo"
  como "Partida e cenas" (a duração e a dificuldade — item 33, à vista e travadas, com o cadeado, com `partida.ajustesFixos`, e
  sem elas no fim do jogo —, o pré-jogo e as cenas, sem os treinos; era "Cenas da partida"), `#btn-simular-resto` (até o apito)
  e `#btn-voltar-tm` (no fim; desde o item 58 os dois no fim da lista e, no fim de jogo, o Voltar ao TM sobe para o 1º lugar:
  seção "Pausa (item 58)"); sem "Editar time" com a trava. `faixa({..., botaoTexto,
  botaoCmd})`. O ponto do controlado no minimapa na cor do time dele.
- **Testes**: `teste-ponte-tm` (Node, padrão; P1 sem recuo, P2 tm-times, P3 humano no visitante, P4 trava, P5 resultado de
  partidas inteiras, P6 súmula com eventos montados; os pedidos em `tools/lib/pedidos-tm.mjs`) e `teste-tm-tela` (navegador; o
  TM imitado por um quadro pai na mesma origem: pronto, pausa, Simular o resto, faixa, `tm3d:fim`, Estrelato no celular, sem
  `?tm` nada muda; `--pedido <arquivo>` usa um pedido de verdade do TM).

- **A FOTO do jogador (item 31, #615)**: campo OPCIONAL `foto` em cada jogador do pedido (`home/away.players[i]`), só na edição PRO
  (o `tm3d.js` confere `TM.storage.edition()`: o `TM.img.playerPhotoUrl` não confere e devolve o `player.photo` também na
  pública): a foto real de licença livre do TM (`assets/jogadores/…`, em endereço ABSOLUTO pelo `abs`) ou a importada pela
  carreira própria (`data:image/jpeg|png|webp`, até 48 000 caracteres cada e 240 000 por time; acima, a foto fica de fora). O
  "rae-me" do Rumo ao Estrelato nunca tem. Sem espaço no localStorage (os saves do TM moram nele), o `abre3d` grava o pedido sem
  as importadas e, se ainda faltar, sem foto nenhuma (`gravaPedido`, `TM.tm3d._gravaPedido`; `teste-ponte-tm` P11) — a foto
  sai, o 3D não. O pedido continua `v: 2`; o `tm-times.js` não copia o campo (`teste-ponte-tm` P10e:
  `timesDoPedido` e o hash iguais com e sem fotos); o golaco lê pelo lado + `tmId` (`js/tm-fotos.js`, contrato "Comemoração do
  gol"). No online, a foto do time montado num aparelho pro aparece se o pedido do anfitrião for pro (como os rostos reais).

- **A tela no lugar da janela "Jogar em 3D / Simular" (item 124, 05/11; PR #620)**. Pedido do dono (com o print da tela antes
  do jogo): "essa tela pré jogo é no lugar daqueles dois botões de jogar 3d ou simular; quando clica em jogar, já entra essa tela,
  e é em todos os modos". As escolhas E1–E5 abaixo são as recomendadas (FILA "Depende do dono" 24: o dono pode trocar). Só a
  página e o TM: `fecho-hash --diff 29d67bad` 0; `hash-igual --ref 29d67bad --rapido` e `hash-partida --ref 29d67bad` IGUAIS.
  - **E1, o "Jogar" abre o 3D direto** (`tm3d.js`): o `TM.matchview.play` embrulhado chama `jogarCfg` em todo cfg com
    `pauseSide`, `teamA`/`teamB` e `result` (`ofereceEm`), menos `ja3d`, `sem3d` e `result.penaltyOnly`; o 3D abre na tela antes
    do jogo (Jogar partida · Visão tática · Personalizar · Simular partida). Saíram a janela (`escolha()`, `api.escolha`,
    `salvaPreferencia` e o CSS `.tm3d-escolha`/`.tm3d-op*`/`.tm3d-sempre`/`.tm3d-confronto`). Sem WebGL 2: a simulação de sempre e
    o aviso "Este aparelho não tem WebGL 2, que o 3D precisa: as partidas do seu time são simuladas." UMA vez por sessão
    (`api.avisaSemWebgl`; antes, nenhum aviso). Rumo ao Estrelato titular (`rae.js`): o `jogar3d` direto (3 abas e a ficha VOCÊ);
    "entra", banco ou fora dos relacionados, "Sempre simular" ou sem WebGL 2 (com o aviso): a simulação dele. Os modos que já
    iam direto (Pênaltis 3D, Modo Livre 3D, Online 3D) não mudam. A Partida de Base entrou (`coach.js`: `pauseSide: 0`,
    `simOpts`, `empateContinua: false` e `sem3d` com menos de 11 na base — o 3D joga 11 contra 11; efeito colateral: o 2D dela
    ganhou a pausa e a tática da tela de jogo). O "Simular direto" da Partida rápida passa `sem3d` (o botão diz simular: sem o 3D;
    o "Iniciar partida" e o "Jogar de novo" abrem a tela; revisão A3). O título vai ao 3D sem emoji (`TM.icones.semEmoji`, o
    critério do conversor: "👑 Chefão das Lendas" → "Chefão das Lendas" — o conversor do TM não alcança o quadro; revisão A3).
  - **E2, o "Simular partida" = o "Simular" da janela**: o 2º toque manda `tm3d:sair {motivo: 'simular', titulares}` e o
    `jogarCfg.sair` chama `escalacaoDaTela(cfg, titulares)`: se um lado mudou (o Personalizar, ou o time que o `escalacao()` do
    `tm3d.js` remonta quando não vem montado), os 11 da tela passam à frente num ARRAY NOVO (quem fica não muda de índice, quem
    entra ocupa o lugar de quem saiu, quem saiu vira o 1º do banco; o `TM.data` intacto) e o MESMO `cfg.result` é simulado de novo
    (`Object.assign(cfg.result, TM.engine.simulate(teamA, teamB, simOpts))`, como o `aplicaResultado`); sem mudança, o result de
    sempre, bit a bit. Depois o `playOrig` com `ja3d`: a tela de jogo do TM anima lance a lance na velocidade da Config, sem o toast
    "Partida simulada." (ele saía ANTES da simulação). No Rumo ao Estrelato o `fns.sair` é a simulação dele (`jogaPartida`, com a
    escalação própria: os titulares da tela não chegam — ele não tem Personalizar). O "Simular o resto" e o "Voltar ao Total Match"
    da PAUSA, com a partida começada, continuam pelo motor 3D (`tm3d:fim`). Na página: a tela fica aberta, o mundo no tick 0, até o
    TM fechar o quadro (com o `fecharPrepartida` o jogo andava ~5 passos e aparecia nesse meio-tempo). Em pé, o `#girar` cobre a
    tela e o X do TM já sumiu no `tm3d:pronto` (desde o item 106, no `tm3d:tela`) (e o PWA do TM é travado em pé): a tela "Gire o celular" ganha o botão "Simular
    partida" (um toque, sem armar; revisão A1); na reserva da tela, o mesmo botão no canto de baixo à direita (revisão A6) —
    `main.js criarSimularTM/atualizarSimularTM`, `css/tm.css .tm-simular`; só no TM partida e Estrelato (não no Online, nos
    Pênaltis e no Livre) e só antes do jogo, com o mundo no tick 0.
  - **E3, a Config "Partidas do seu time"** (`settings.js`, `storage.js`): a chave NOVA `partidasTela` — `"tela"` (padrão, "Tela
    antes do jogo") | `"simular"` ("Sempre simular": o 3D não abre; para o celular fraco ou a carreira rápida). O `partidas3d`
    antigo (perguntar | 3d | simular, gravado pela Config e pelo "Lembrar minha escolha" da janela) é IGNORADO: a migração para a
    tela é única por construção, e o "Sempre simular" escolhido e salvo depois vale. `preferencia()` devolve `"simular"` só com
    `partidasTela === "simular"` e é lida a cada partida (nunca na carga: o `teste-ponte-tm` P11 carrega o `tm3d.js` sem o
    `TM.storage`). A dica da Config diz o que fica fora (abaixo).
  - **E4, o que fica fora do 3D, e por quê**: o Online de salas (`online.js`) e o Duelo ao vivo do Ultimate (`utonline.js`),
    `pauseSide: null` — o resultado é dividido com a outra pessoa (FILA 40); a disputa de pênaltis e a prorrogação 2D do TM
    (`penaltyOnly`, `playShootout`: o 3D cuida dos 90 minutos; FILA 36/37); o Rumo ao Estrelato no banco ou fora dos relacionados
    (FILA 38); o Palpite da Arena, sem time do jogador (FILA 39); a Partida de Base com menos de 11. Continuam no 3D, como já
    estavam pela janela: o "Enfrentar" do Ultimate Online (`utonline.js`, assíncrono contra o elenco publicado de outra pessoa; o
    placar vai ao `utRecord`) e os jogos da Copa Online (`copa.js`) — a E4 pedia o online assíncrono fora: decisão do dono
    ("Depende do dono" 24; para tirar, `sem3d: true` no cfg deles).
  - **E5, o X "Voltar e simular"** do "Abrindo o estádio 3D…" (até o `tm3d:pronto`; desde o item 106, até o `tm3d:tela`): a confirmação "Sair do 3D?" diz "A partida é
    simulada lance a lance, sem o 3D." e o "Simular" dela fecha o quadro sem resultado, calado. Ela ficava ATRÁS do quadro (z-index
    5000; o toque no X não mostrava nada): `body.tm3d-aberto .sheet-overlay` com z-index 5100, no meio da tela (440 px). Vale
    para todo quadro: o X antes do pronto passou a funcionar também nos Pênaltis 3D, no Livre e no Online 3D (no Online o "Sair"
    registra o W.O., `sair {abandono: true}`, como o texto promete; revisão A4). O "Abrindo o estádio 3D…" some quando o documento
    do quadro já tem o `#carregando` (o texto ficava por cima da marca do TM da tela de carregar; revisão A7); o aviso de demora
    (30 s, "Simular a partida") volta embaixo, com fundo próprio (`.tm3d-aviso.demora`). Fora do 3D, a `.sheet-overlay.modal` do
    TM abaixo do PC (deitado, ou de 600 a 1023 px) também fica no meio da tela (revisão A8; o celular em pé com menos de 600 px
    continua com o cartão de 380 px à esquerda, como era).
  - **`TM.tm3d`**: `PARAMS` (parâmetros a mais depois do `?tm=<id>`; os testes passam `&prepartida=1`), `avisaSemWebgl`,
    `preferencia()` ("tela" | "simular"); saíram `escolha` e `salvaPreferencia`. Versão do TM: v379.
  - **Medido** (Chromium sem GPU, com outras frentes na máquina; nada num celular de verdade): a mensagem do Simular chega ao TM
    em 0,001–0,06 s; o quadro some 1,1–9 s depois (o `remove()` do iframe desmontando o WebGL, até 6,5 s, conforme a carga); a
    tela aparece 5,4–12,9 s depois do Jogar (8,1–8,5 s na Partida rápida). Quem só simula espera esse carregamento a cada partida
    (na janela, um toque e nada do 3D baixado) — por isso a "tela cedo" (item 106) subiu de prioridade (feita: parte "O recado
    tm3d:tela", abaixo).
  - **Testes**: `legacy-total-match/ferramentas/testar-3d.mjs` — a migração (os 4 casos: perguntar, 3d, simular, nada salvo), a
    Config, o quadro sem a janela no Ultimate Rivais, na Carreira e no Rumo ao Estrelato com o golaco de verdade (a tela, o Simular
    calado com os titulares da tela, o Jogar partida → Simular o resto → `tm3d:fim`), o Personalizar + Simular (A2) e o aviso fora
    da marca (A7) na Partida rápida; um caso por modo com uma página de ENSAIO no lugar do 3D (Partida rápida, Arena Chefão com o
    título sem emoji, Batalha, Base com 14 e com 8, o Estrelato com o Simular, a falha e o "Sempre simular"), o "Simular direto", a
    falha 'erro', o X por cima do quadro, o "Sempre simular" da Config, sem WebGL 2 (um aviso) e a confirmação no meio em 960×540
    (A8). Na base 29d67bad reprovavam 19 (a 1ª versão do teste); os 6 casos da revisão reprovavam em 212ec359; depois, 66/66 na pro
    e 65/65 com `--publica`. `testar-ultimate` ("Sempre simular" pela `partidasTela`: nenhuma partida abre o 3D);
    `golaco/tools/teste-prepartida-tela` E14 e E14r (contrato "Tela antes do jogo (item 64)"). Não testados: a Copa Online e o
    "Enfrentar" (dependem do Firebase); a Base com ≥ 11 no golaco de verdade só num ensaio fora do repositório (passou).
  - **Limites conhecidos**: a formação e a tática do Personalizar não chegam ao Simular do TM (o motor dele só lê os 11); fechar o
    app com a tela aberta, na carreira sem "reiniciar partidas", não registra o placar (já era assim no 3D; agora vale para toda
    partida); a confirmação do TM fora do 3D no celular em pé com menos de 600 px segue com o cartão de 380 px.

- **O recado `tm3d:tela` e o quadro que some já (item 106, 07/11; PR #PRNUM; TM v380)**. Com a tela cedo (contrato "Tela antes do
  jogo (item 64)", parte "A tela cedo") a tela antes do jogo fica à vista ENQUANTO o 3D monta, com o "Simular partida" e o [<]: o
  aviso "Abrindo o estádio 3D…" e o X do TM não têm mais o que fazer ali (sem o recado, os dois ficariam por cima da tela até o
  3D pronto). As escolhas no
  "Depende do dono" 29 da FILA.
  - **O protocolo** (topo do `ponte-tm.js` e do `tm3d.js`): o 3D manda `{tipo: 'tm3d:tela', id}` UMA vez, quando a tela cedo está
    à vista COM uma saída à vista (`main.js avisarTelaTM`, também a cada quadro do mini-laço da tela cedo): em pé, a "Gire o
    celular" cobre a tela — com o "Simular partida" dentro dela (a partida e o Rumo ao Estrelato do TM) o recado vale já; nos
    Pênaltis, no Livre e no Online do TM ela não tem botão e o recado espera a pessoa deitar o celular (o app do TM instalado e
    travado em pé ficava sem saída nenhuma durante a carga). O `tm3d:pronto` continua no fim da carga, e a porta do Online 3D
    (`tm3d:porta`) continua vindo em resposta a ELE. Saindo antes do 3D (o Simular, o [<], o Sair do online), a carga para e o
    `tm3d:pronto` nunca sai: o TM recebe só o `tm3d:sair` (ou o abandono do online). O motor antigo (`futebol3d/`) não manda o
    `tm3d:tela`: o `tm3d:pronto` faz o de sempre.
  - **O lado do TM** (`tm3d.js abre3d`): no `tm3d:tela` (`tela3d = true`) o aviso e o X somem, o aviso de demora (30 s) é
    cancelado e o `olhaCarga` para; o `fns.pronto` NÃO é chamado (só no `tm3d:pronto`). Ao sair (`tm3d:sair`/`tm3d:fim`, o X e o botão do aviso de demora: o `termina`),
    `fecha3d(true)`: a tela do quadro some da vista NA HORA (`display: none`, sem toque) — dentro do `fns.sair`/`fns.fim` ela já
    está fora — e o `remove()` vem depois de o TM pintar (o `requestAnimationFrame` seguinte + uma tarefa; com a aba escondida,
    pelo relógio de 1 s). O `remove()` desmonta a página do 3D (o WebGL), da MESMA origem e no mesmo fio do TM: 1–9 s no Chromium
    sem GPU, e com ele síncrono o quadro ficava à vista esse tempo todo depois do Simular. O `abre3d` com um quadro aberto e o
    `api.fechar` tiram na hora, como antes (`fecha3d(false)`). Para os testes, `TM.tm3d._abre3d`. Versão do TM: v380 (`index.html`
    `?v=380`, `sw.js` `total-match-v380`); `conferir-estilos` igual à base.
  - **Medido** (Chromium sem GPU; nada num celular de verdade): no `testar-3d` (Partida rápida, o golaco de verdade) o `tm3d:tela`
    chega 1,3–1,7 s antes do `tm3d:pronto`, e no 2º toque do Simular o quadro sai da vista em 0,014–0,026 s (na base 2,44 s; o
    item 124 media 1,1–9 s até o quadro sumir). A tela à vista, desde a navegação da página do 3D: 3,8–4,1 → 0,32–0,37 s (TM
    pública e pro); o 3D pronto ~1–2 s mais tarde (o custo da tela à vista no renderizador por software: "Depende do dono" 29).
  - **Testes**: `teste-ponte-tm` P14 (o `tm3d.js` num `vm` com um DOM e relógios de mentira: o `tm3d:tela` esconde o aviso e o X,
    cancela a demora de 30 s e não chama o `fns.pronto`; no `tm3d:sair` a tela já está fora da vista dentro do `fns.sair` e o
    `remove()` vem numa tarefa depois — também com a aba escondida, pelo relógio, em ~1 s; sem o `tm3d:tela` o `tm3d:pronto` tira o
    aviso e o X como antes; o `abre3d` com um quadro aberto tira o velho na hora; reprova na base, sem o `_abre3d`);
    `legacy-total-match/ferramentas/testar-3d.mjs` (Partida rápida com o golaco de verdade: o `tm3d:tela` antes do `tm3d:pronto` e a
    tela pintada — um quadro inteiro — antes de a cena 3D nascer, o aviso e o X fora no `tm3d:tela`, o Simular antes do pronto →
    `tm3d:sair` 'simular' sem `tm3d:pronto` nem `tm3d:fim` e o quadro fora da vista ≤ 0,5 s depois do 2º toque; na base os 3
    reprovam; 69/69 na pro e 68/68 com `--publica`); `golaco/tools/teste-prepartida-tela` E26c, E26h (Pênaltis e Estrelato), E26k e
    E26l (o `tm3d:tela` em pé). Também passaram `testar-penaltis` (14), `testar-livre` (16) e `testar-online3d --golaco` (18; os
    casos do Viverde pulados sem `TM_SENHA_VIVERDE`).

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
  dinâmico); com `?tm` decodifica os escudos (≤ 1,5 s; falhou → `urlEscudoSigla`, a sigla nas cores — a letra 30/38 desce só
  quando a sigla passa de `SIGLA_CABE` 70 de largura na DejaVu Sans Bold, `larguraSiglaEm`: revisão V9 do item 29) ANTES de
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
  escolhido que confunde, sem identidade, neutro com público baixo) e a torcida do TM (mesmos lugares, público, neutro); seção G
  (item 29, revisão V9): a sigla do escudo de reserva cabe em ≤ `SIGLA_CABE` 70 de largura na DejaVu Sans Bold, e as que já
  cabiam ficam no tamanho de antes (30 com 3 letras, 38 com 2).

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
  'liso'|'misto'|'faixas'|'mosaico'|'setores'|'raios' (os dois últimos só com `forma` genérica: o padrão que ela desenha; item 69,
  PR 4), aneis 1–3, marca?, confianca?, ...}}, homonimos?: {"<nome normalizado>": [Estadio &
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
  GOLAÇO) e importa `js/tm-cara.js` (módulo antes do importmap faria o navegador ignorar o mapa). Desde o item 125 o mesmo
  `<script>` escreve, antes do `tm.css`, o `<link rel="preload">` da TM Cond 800 latin (o placar a usa no 1º quadro).
- **`css/tm.css`**: TUDO sob `html.tm`; a cara sai do `legacy-total-match/css/styles.css` (preto #050807, painel #0f1612, verde
  #22c55e/#4ade80, texto #eef5f0, fraco #8a9d90, botão principal em pílula com `linear-gradient(120deg,#34d572,#1fae55)`,
  cartões com raio 14–18 px e borda fina, segmentados separados). Variáveis `--tm-*` para peças novas; as do GOLAÇO
  (`--verde`, `--preto`, `--fonte`...) apontam para as do TM. Fonte `'Inter TM'` (nome próprio: a "Inter" do `.faixa-subst`
  não baixa nada sem `?tm`), em `assets/tm/fontes` (OFL). Logo do TM no placar (`assets/tm/simbolo.png`), no carregamento,
  na abertura do pré-jogo, na tela "Gire o celular" (`assets/tm/logo.png`), no título da pausa/ajuda/editor e ao lado de
  "Escalação". Sem itálico nem inclinação: o GOL! e a vinheta do replay têm `@keyframes tm-*` retos, ligados só em
  `prefers-reduced-motion: no-preference`. **Item 125 (05/11)**: a regra antiga "nada condensado" mudou — a TM Cond (Barlow
  Condensed, a letra da carta do TM; o `--f-disp`) nos títulos, itens de menu, números, nomes e siglas, com e sem `?tm`; o texto
  corrido continua na Inter TM; nada itálico nem inclinado (contrato "Sistema tipográfico"; registrado no cabeçalho do `tm.css`).
  O que o jogo MEDE fica igual: peso/espaçamento dos nomes dos botões de toque,
  alturas de 48 px. Celular deitado (360–480 px de altura): a faixa do intervalo/fim desce para baixo do lugar do aviso
  (ancorada pelo topo; com a linha ENTRA/SAI no topo, mais 42 px).
- **`js/tm-cara.js`** (página): título, `theme-color`, ícone, "Total Match" na marca do carregamento (o texto fica para o
  leitor de tela; na tela a logo), o texto do `#girar`; pede os 5 pesos da Inter e (item 125) os 2 da TM Cond, 600 e 800, e,
  quando chegam (ou falham), põe
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
  - Estados: `caminhada` (o cobrador anda até o ponto de partida da corrida dele — item 70, P1: contrato "Cobranças com
    corrida"; antes, até 0,4 m atrás da bola — pela locomoção do jogo: `j.guia` — o pedido de movimento
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
  **Item 64**: com a tela antes do jogo ligada (contrato "Tela antes do jogo (item 64)") a disputa NÃO anda sozinha no 1º quadro
  (antes: 7–12 passos) — o campinho da tela dá lugar à fila dos cobradores (o goleiro + 1º…5º), as abas são "Bater pênaltis" e
  "Cobradores do adversário", e o "Bater pênaltis" (1 toque) solta a disputa; no TM, o [<] "Voltar ao Total Match" antes do Bater
  manda `tm3d:sair` (sem resultado, como o X do TM). Sem a tela (webdriver, `?prepartida=0`), como antes.
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

## Câmera de TV (item 66; contrato)
Pedido do dono (23/10, com o print de um escanteio do time dele): "a câmera não acompanha a bola e não dá pra ver a área
completamente, e isso acontece durante todo o jogo ... tem que afastar muito pouco mais e centralizar mais". Pesquisa,
fontes e medidas em `PESQUISA-ESTADIO.md` §18. **Só desenho**: o `CAMERA` do `config.js` muda (× 1,06; o `fecho-hash --diff`
acusa o `config.js`, só o `CAMERA`, que a simulação não lê) e todo o resto mora fora do fecho; `hash-igual` e
`hash-partida` IGUAIS.
- **Onde mora.** `js/render/enquadramento.js` (PURO, no download inicial): os perfis da câmera de jogo (`PERFIS_CAMERA`,
  `TV_CELULAR`, `RETRATO`, `perfilCamera`, `fovPara`, `larguraVista`), a geometria da TV (`geometriaTV`, `projetarTV`,
  `poseTV`), o foco de HOJE (`alvoLegado`, `molaLegada`: a cópia exata da 79bbfbc2) e a TV nova (`ENQUADRAMENTO`,
  `criarEnquadramento`, `preencherAlvo`, `alvoTV`, `passoMola`, `limiteDuro`, `limitarBola`, `focoTV`). `render/camera.js`
  aplica no three; o `teste-camera` (Node) usa as MESMAS funções. `js/render/plano-bola-parada.js` (PURO, sob demanda com o
  `bola-parada.js`, que reexporta): `CAMERA_BOLA_PARADA`, `CAMERA_ESCANTEIO`, `perfilBolaParada`, `planoBolaParada`.
- **Constantes.** `ENQUADRAMENTO` (`enquadramento.js`, fora do fecho): `pesoBola` 0,75 e `raio` 0,22 (o controlado), `meioCondutor`
  0,5, `anteBola` 0,3 s (≤ `anteMax` 6 m), `anteVoo` 0,5 s, `filtroVel` 0,15 s, `frente` 0,07 × W (some de `frenteAte` 45 a
  `frenteDe` 25 m; anda ≤ `frenteVel` 6 m/s; `histerese` 0,5 s), `zonaMorta` 2 m, `area` {de 32, ate 18, limX 44,5, margem
  0,94}, `bola` e `bolaDuro` (NDC; `tempo` 0,25 s), `bolaCampo`, `profMin` 5 m, `bolaAlta` 18 m, `salto` 6 m, `omega` 4,5,
  `avanco` 0,5, `filtroAlvo` 0,12 s, `saltoAlvo` 3 m, `acelMax` 150 m/s², `velMax` 36 m/s, `paradaPerto` 35 m, `jogador` (a
  caixa do travado). `CAMERA` (`config.js`, × 1,06: `largura` 47,7, `distancia` 42,4, `altura` 19,4; `celular` 48,76 e 13,04;
  a `rigidez` 3,2 ficou para o foco de antes). `CAMERA_ESCANTEIO` (`plano-bola-parada.js`). Mexer no `ENQUADRAMENTO` não toca
  o fecho; no `CAMERA`, o `fecho-hash --diff` acusa o `config.js` e o hash continua IGUAL (a simulação não lê o `CAMERA`).
- **A pose.** A lente em (fx, H, fz + D) olhando (fx, oy, fz), yaw −π/2 (o rumo do analógico não muda), o fov pela largura
  (`fovPara`). TV × 1,06: celular 48,76 m e 13,04 m (15°), 42,0 m vistos no foco; PC 42,4 m e 19,4 m (24,6°), 47,7 m. A
  projeção fechada (`projetarTV`): s = z − fz, c = (D² + h(H − y) − sD)/n, NDC x = (x − fx)/(c·tanV·asp), NDC y =
  ((y − oy)D − hs)/(n·c·tanV), com h = H − oy e n = |(D, h)| — a mesma do `project` do three (teste-camera G4: 4e-14;
  teste-camera-tela J1: 0,00 px).
- **O alvo (`main.js` → `preencherAlvo(alvo, m, posDesenhada, _bp)`; o replay preenche o dele).** jx, jz, jvx, jvz (o
  controlado, como antes) e: bx, by, bz (a bola desenhada), bvx, bvy, bvz (`m.bola.v`), ax, az (a queda do voo em andamento)
  e tRest (o tempo até ela), cx, cz, cvx, cvz (o condutor: `m.posse` sem `m.naMao`, na posição DESENHADA), dir (±1: o ataque
  de quem tem a bola — posse → voo.time → ultimoToque.time; 0 sem ninguém), parada/temParada ({tipo, x, z, dir} enquanto
  a bola parada não rolou), legado (o plano 'fechada' do replay), jCaixa (o controlado TRAVADO do Rumo ao Estrelato no
  `?tm`: `main.js` TRAVA_TM — revisão R2).
- **Quem usa a TV nova.** A TV com a mistura TV ↔ aproximada em 0, em paisagem (`retrato` 0), sem o efeito de gol do treino e
  sem `alvo.legado`: o jogo, o plano 'tv' do replay (a velocidade da bola gravada à frente e o lado do lance) e a "TV" do
  Livre (lê o foco; com a Altura e a Distância dele a geometria dos limites é a da pose que ele desenha — `perfilAjustado`,
  altura × fa, distância e largura × fd — e a lente presa pelo `segurarPose` perto do foco de agora — `camera-livre.js
  segurarTV`: z ≤ 70 e a caixa da arquibancada de cá; revisão R3: com a geometria da TV padrão, a Altura 20 e a Distância 0
  deixavam a bola alta fora do quadro em 62% dos instantes na página, antes do item 66 34%). O foco de hoje fica na aproximada, no retrato, na transição de 0,6 s e no plano 'fechada' (o V11 do
  teste-replay-paradas-tela intacto); a troca parte do estado (E.ok falso: a mola começa de onde está, sem salto). Não mudam:
  a câmera do gol, a comemoração, as cenas, o plano geral, o pré-jogo, a disputa e as 5 câmeras próprias do Livre.
- **A TV nova, por quadro (`focoTV`).** (1) A bola andando > `salto` 6 m num quadro = corte. (2) O ponto da bola P: no voo,
  bola + (queda − bola)·min(1, 0,5/tRest); no pé, o condutor + metade do caminho até a bola + a velocidade dele filtrada
  (0,15 s) × 0,3 s (≤ 6 m); solta, bola + a velocidade dela filtrada × 0,3 s. (3) O lado do ataque com histerese de 0,5 s e o
  espaço à frente dir × 0,07 × W (W = a largura vista no foco), que some entre 45 e 25 m da linha atacada e anda ≤ 6 m/s.
  (4) O controlado puxa ≤ 25%, nunca a mais de 0,22·W de P. (5) A zona morta de 2 m (x e z, separados) ANTES da área. (6) A
  área: wA = suave((32 − dl)/14), dl = 52,5 − |P.x|; os 4 cantos da grande área e o alto das 2 traves com |NDC| ≤ 0,94 pela
  conta fechada (o intervalo de fz e depois o de fx; vazio = o meio); foco = lerp(foco, foco da área, wA). (7) O limite do
  foco em x = lerp(38,5; 44,5; wA), z de −22 a 23. (8) A bola no limite do ALVO (NDC x ±0,78, y de −0,62 a 0,80; a bola que
  sobe entra pela altura que terá em ≤ 0,5 s; o piso pelo CHÃO debaixo da bola e o teto pela bola na altura que cabe —
  `alturaQueCabe`, a conta fechada da altura acima da qual não há foco com a bola e o chão debaixo dela na caixa: 9,5 m no
  celular, 13,6 no PC; a TV não inclina, então acima disto a bola sai por cima e o chão, onde estão os jogadores e onde ela
  cai, fica (revisão R1: antes o foco ia até 37 m para a frente atrás do balão de 15 m, o chão saía e a bola continuava fora);
  só a bola ALTA do lado de lá leva o foco além do limite, até `bolaAlta` 18 m). Com `alvo.jCaixa` (o Rumo ao Estrelato: só o
  meu jogador, sem troca), os pés e a cabeça do travado entram na mesma conta, com prioridade menor que a bola e maior que a
  área (`ENQUADRAMENTO.jogador`: NDC x ±0,85, y de −0,80 a 0,85; o intervalo dele cruzado com o da bola, em z e depois em x —
  vazio, só a bola; fora da bola parada com a área). Sem a trava o controlado é quase sempre quem está perto da bola: nada muda. (9) A mola crítica (ω 4,5 em x e z) contra o alvo andando com 0,5 × a velocidade dele (filtrada 0,12 s; o
  alvo que salta > 3 m num quadro não tem velocidade), exata para qualquer dt (dt 0 não mexe). (10) O limite DURO na saída da
  mola (`limiteDuro`): fora de NDC x ±0,86, y de −0,72 a 0,86 (a mesma conta do chão e da altura que cabe: 10,0 m no
  celular, 14,4 no PC), a velocidade do foco no eixo passa a ser no MÍNIMO a do
  próprio limite (ele anda com a bola) + a que volta em 0,25 s — um piso, sem acumular (a 1ª versão, que somava a cada
  quadro, levou o foco a 75 m/s atrás de uma bola alta e bateu na borda: 4.946°/s²); depois o teto de aceleração 150 m/s²
  na soma dos eixos, a freada antes da caixa do campo (√(2·A·d)), o teto de velocidade 36 m/s (≤ 1,2 m por quadro a 30 qps)
  e a posição pela média das velocidades do começo e do fim do quadro (só com a velocidade mudada); a caixa (|x| ≤ 44,5,
  z de −22 − 18 a 23) como guarda final. Com a bola a < 5 m de profundidade da lente o limite da bola não vale no quadro.
- **Bola parada na TV (`alvoTV`, `paradaComArea`).** O escanteio e o tiro livre a ≤ 35 m da linha atacada, sem rolar: P =
  a bola, sem espaço à frente nem controlado, wA = 1 e o limite de x da área. O tiro livre de 30–35 m no celular (42 m no
  foco) não cabe inteiro sem abrir o plano (a bola e o gol sim): G3 do teste-camera.
- **O escanteio da pessoa (`CAMERA_ESCANTEIO`).** Atrás do cobrador e ALTO: 13 m atrás, 1,2 m de lado, 8 m de altura, a bola
  em 86% da altura do quadro e o alvo em 30%, fov 26–62°, a até 17 m da bola com a corrida (atrás do cobrador 6,5–13 m);
  a lente ≥ 2 m acima do que houver embaixo (`folgaCabeca`); dentro da caixa da arquibancada de cá ela não bloqueia (sai do
  desenho, a regra da TV); bloqueada, chega 15% e sobe 1 m por tentativa (10). As bandeiras de mastro da torcida não são
  sólidos da câmera: com ela na mistura, as de perto da lente ABAIXAM (`bandeiras-dados.js alturaPelaLente`; revisão R2 do
  item 65 — no escanteio de lá do Golaço e do Maracanã a lente, a 8 m sobre as fileiras da frente, ficava a 0,2–3,6 m de um
  pano de 2 × 1,4 m: uma placa verde e preta de 12–100% do quadro encostada na bola e no arco da curva; agora o que sobra
  fica a ≥ 8,6 m nos 106 estádios × 4 cantos × corrida, G5 do teste-camera, e o `teste-bola-parada-tela` 2b confere o de lá
  em pixels). Os sinalizadores das quinas (`festa.js`) também não: com ela na mistura, o núcleo, o halo e a fumaça perto da
  lente SOMEM (`fumaca.js forcaPelaLente`; a mesma revisão — a quina ficava a 3–4 m da lente e a fumaça passava por ela, um
  véu de até 100% do quadro por cima da bola; agora o que se vê fica a ≥ 9,5 m e ≤ 4,1% do quadro, nada sobre a bola, G5, e
  de noite no `teste-bola-parada-tela` 2b a festa a < 3 e < 6 m da lente 13–22% → 0%). Os outros tipos: o `CAMERA_BOLA_PARADA` de sempre. A volta para a TV: a mistura de 1,1 s, menos quando o olhar da bola parada e o da TV apontam para lados opostos
  (cosseno < −0,5: o escanteio de lá) — aí CORTA (`camera.js BP.corteOposto`; misturando 180°, o olhar passava pelo chão e
  a bola saía do quadro de 0,3 a 0,9 s). No Modo Livre, contra o rumo da câmera dele no chão (`est.extra.yaw`: as de lado
  olham como a TV e cortam; Atrás e Jogador, pelo comprimento, misturam; revisão R5 — antes no Livre a volta misturava e a
  bola saía de 0,27 a 0,80 s: teste-camera-tela E8).
- **API.** `cam.cortou` (o corte de verdade deste quadro: o pedido, o 1º quadro, a bola teletransportada, a volta oposta) e
  `cam.enquadramento` ({novo, wA, lado, frente, parada, duro, limX}); `__golaco.bolaParadaDeTeste(tipo, {time, lado})`.
- **Metas** (as que reprovam; `teste-camera` P nas duas telas, demo 1–6 e 'passivo' 1–4, a TV nova e o legado nas MESMAS
  partidas): M1 a bola no miolo 50% × 50% ≥ 96% (demo) / ≥ 95% ('passivo'); M2 a bola fora do quadro, até a altura que cabe,
  ≤ 0,05%, e M2b o chão debaixo dela fora = 0; M3 |NDC x| p90 ≤ 0,30 / 0,32; M4 no meio-campo com a bola no pé u mediano
  0,40–0,48 e mais quadro à frente ≥ 65%; M5 no último terço u 0,45–0,55; M6 a área inteira com a bola nela ≥ 90%, M6b a ≤ 25
  m do gol ≥ 70%, M6c a área no quadro p10 ≥ 95% e as traves ≥ 97%; M8 a largura vista no foco 41,5–43,5 / 47–49 m; M9 o
  atraso p90 com a bola a ≥ 8 m/s ≤ 7,0 / 7,5 m; M10 o vai e volta ≤ o legado + 1 por minuto; M11 a aceleração do olhar p99,9
  ≤ 200°/s² e o máximo ≤ 400; R1 o controlado ≥ 34 px no celular 844×390 e ≥ 43 no PC (mediana); T o travado inteiro no quadro
  ≥ o legado − 1 ponto em cada posição; L a bola fora e a bola alta fora ≤ as da TV de antes; G1 e G2 100%, G3 a área inteira
  ≥ 95% de 18 a 29 m (30–35 m informativo), G5 0 lente em sólido, a faixa da área ≥ 15% em ≥ 95% e o jogador na marca ≥ 18 px
  no Golaço. Na página (`teste-camera-tela`): J1 ≤ 1,5 px da projeção e ≤ 0,2 m do Node, J2 a bola atrás do HUD 0, J3 a
  torcida com ≥ 1% da tela em ≥ 95% dos instantes, J4 ≥ 34 px, J5 ≤ a base + 2 chamadas e ≤ × 1,10 triângulos, A1 12/12, E2 a
  faixa da área ≥ 18%, E3 os jogadores na área ≥ 18 / 32 px, E7 ≤ 40 chamadas e ≤ 130 mil triângulos, E8 e F1.
- **Fica** (FILA itens 85–87; as escolhas no "Depende do dono" 16): a mesma TV na aproximada, no retrato e no plano 'fechada';
  o `enquadrar` do Livre com a bola alta; o tiro livre a 30–35 m no celular sem a área inteira; a TV que gira (D5).
- **Testes.** `teste-camera` (Node, padrão; S sintético a 60 e 30 qps — S8 a bola alta: o chão debaixo dela nunca sai do
  quadro —, G geometria — a área, o escanteio e o tiro livre na TV, a projeção, o escanteio da pessoa em 106 estádios —, P 10
  partidas com o legado lado a lado, T o travado do Rumo ao Estrelato em 8 partidas, L a TV do Livre com a Altura e a
  Distância nas pontas; `--rastro` confere com a página),
  `teste-camera-tela` (navegador, CI: J a página × a projeção e × o Node, HUD, torcida, controlado, custo; A a área; E o
  escanteio da pessoa; F a bola parada da IA na TV; N noite) e `teste-tm-tela` 5c (o travado parado na tela da página). As
  cópias da pose (teste-tecnicos, teste-livre-tela, teste-rede-tela, prints) importam o módulo.

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
  `cone[tipo]`); `BOTAO.EFEITO_E`/`EFEITO_D` (teclas Z/X, analógico direito do controle e, no toque, o ARRASTO no CHUTE ou no
  LANÇAMENTO — item 65, abaixo) passam a curva um degrau de `curvaPasso` (segurar repete a cada `curvaRepete` s), de −1 a +1
  (+ = para a direita de quem bate); no tiro de meta a curva fica 0.
- **Tipo pelo botão** (`tipoMirado`): LANÇAMENTO = ALTA (E + LANÇAMENTO = TENSA); CHUTE = CHUTE no tiro livre direto a ≤
  `distChute` m, TENSA no resto; PASSE/ENFIADA = CURTA; tiro de meta = LONGA (sem botão: CURTA só com PASSE/ENFIADA). ALTA,
  TENSA e CHUTE têm a trajetória (`pedido.mirada = {tipo}`; o pedido vira `lancamento`/`chute`); CURTA e LONGA são o passe
  do jogo na direção da mira (`pedido.dir` → `j.miraAuto`). A cavadinha por dois toques segue a de sempre.
- **A conta** (`chuteMirado(m, j, pr, tipo, forca, ang, curva)` → `{v, w}`): ALTA/TENSA = elevação fixa
  (`MIRA.alta/tensa.elev`), velocidade na faixa pela força, o giro do cruzamento do jogo + o efeito (`wy = −curva × giro ×
  atributo`); CHUTE = a velocidade do chute do jogo (`ACOES.chute.v` × finalização), com o efeito por cima da falta
  (`giroFalta`) e a elevação que passa por cima da barreira (`BARREIRA.alturaPassar` na distância dela) ou que chega na
  altura da mira pela força (`alturaMiraChute`, a do chute do jogo; seção C2 abaixo): a barra cheia só sobe SEM barreira e
  com a bola SUBIDA — a que sai chutada e que a linha desenha, com o efeito — cruzando a linha do gol na faixa do canto,
  dentro da boca: meia-boca − `cheia.zCanto` ≤ |z| ≤ meia-boca (`mira.js naFaixaDoCanto`, a régua `noCanto` do chute do jogo
  com o teto na trave); a mira parada no padrão (o meio do gol), as diagonais leves, a curva que leva a bola ao meio ou para
  fora da boca, a mira bem fora do gol e a cobrança com barreira ficam na curva de antes, bit a bit (revisão de 29/10).
  **A mesma conta** no chute de verdade (`acoes.js cobrancaMirada`) e na linha (`mira-linha.js
  preverMira` → `mira.js simularLinha`: `bola.js passoBola` passo a passo até a bola tocar o chão, bater em algo ou cruzar
  a linha de fundo; no CHUTE só até `linhaChute` m além da barreira). Por cima, o erro do cobrador (o do chute do jogo: finalização, distância,
  força no máximo, `faltaErro` com barreira; no cruzamento o do lançamento: passe longo, ±m a 40 m, em ângulo e em força)
  × `MIRA.erro` (os testes zeram). O ponto do voo (`m.voo.alvo`) e quem vai nela saem da trajetória prevista (cruzamento:
  onde desce a `yAlto`); `m.voo.mirada = true`.
- **Tela** (só lê o mundo; o hash não muda), em `render/bola-parada.js` + `mira-linha.js`, carregados **sob demanda**
  (main.js `carregarBP`, na 1ª bola morta de escanteio/tiro livre/tiro de meta/pênalti: fora do download inicial) — desde o
  item 65 (23/10, dono: "essa seta, essa reta ... tem que estar com a cara do Total Match, alguma coisa mais minimalista, e
  tem que ter alguma forma de botar curva nas bolas paradas"; pesquisa em PESQUISA-ETAPA4.md §12.1):
  - **A linha**: os pontos da física (`preverMira`), desenhados só no plano de `mira-linha.js desenhoDaMira` (puro): ALTA e
    TENSA até `altaFim` (45%) do comprimento do arco até o ALVO, esmaecendo de `altaEsmaece` (30%); CHUTE a extensão de
    antes (a barreira + `MIRA.linhaChute` m ou `MIRA.semBarreira` m), esmaecendo nos últimos 30%; CURTA/LONGA os `MIRA.direcao`
    m no chão, esmaecendo nos últimos 40%; em todos começa a `inicio` 0,25 m do centro da bola e entra em 0,35 m. Largura
    CONSTANTE na tela (`render/bola-parada.js MIRA_DESENHO`, px CSS pela altura H): miolo BRANCO `max(2; 0,005·H)` e contorno
    preto do TM `#050807` a α 0,8 de `max(1; 0,002·H)` de cada lado (4 px no celular, 6,5 no PC); sem seta, sem amarelo nem
    azul; acende em 0,15 s e some no chute.
  - **O anel do alvo** (ALTA e TENSA): verde do TM `#22c55e` com o mesmo contorno, raio 0,9 m (o da marca de queda) no gramado,
    no ponto em que a bola, depois de subir além de `ACOES.cruzamento.yAlto` + 0,3 m, desce a `yAlto` — a MESMA regra do
    `m.voo.alvo` da cobrança (`acoes.js cobrancaMirada`), copiada em `desenhoDaMira` porque mira.js/acoes.js estão no fecho;
    guarda: `teste-mira` G (≤ 1 cm).
  - **O arco da curva**: verde do TM com contorno, centrado na bola e no plano da tela, do lado da curva (a direita de quem
    bate = a direita da tela com a câmera atrás do cobrador; a conta pelo lado da mira projetado), 28° por degrau (0,25 → 28°,
    1 → 112°), raio `max(1,6 × o raio da bola na tela; 0,026·H)` px (≥ 4 px de arco por degrau em 568×320); com curva 0 (e na CURTA/LONGA) não aparece. O verde (anel
    e arco) tem miolo `max(2,5; 0,0065·H)`.
  - **Custo**: uma malha, UMA chamada (polilinhas de 2 vértices por ponto; ≤ ~170 triângulos medidos, o teto do buffer 252 pontos = 496), um
    `ShaderMaterial` com o antisserrilhado analítico (`fwidth`; a Média e a Baixa não têm MSAA), `depthTest`/`depthWrite`
    false (por cima do cobrador e da barreira, como no EA FC), `renderOrder` 6, `toneMapped` false. O programa compila na
    CARGA do módulo (`main.js carregarBP` → `renderer.compileAsync(tela.malha, câmera, cena)`), não na 1ª cobrança.
  - **Sem painel e sem texto**: o painel `#mira` (rótulo ALTA/TENSA/CHUTE/CURTA/LONGA, trilho, Z/X) saiu; o rótulo continua nos
    dados (`preverMira().rotulo`). `html.mira-visivel` (a mira na tela: o minimapa sai) e `html.cobranca-mirada` (a cobrança
    mirada fora do tiro de meta: PEGAR e TROCAR da bola na mão saem das vagas d/e) continuam.
  - **Estado para os testes** (`__golaco.bolaParada.estado.linha`): `{visivel, pontos, desenhados, opacidade, tipo, larguraPx:
    {miolo, contorno}, verdePx, arco: {curva, graus, raioPx, lado} | null, alvo: {x, z} | null, anel, fimVisivel: {m, i, total,
    inicio, esmaece}, triangulos}`; `__golaco.bolaParada.arrasto` = o arrasto da curva no toque agora.
- **A curva no toque** (item 65; `entrada.js`, fora do fecho): os dois botões CURVA SAÍRAM. Segurar o CHUTE ou o LANÇAMENTO (a
  força, como sempre) e ARRASTAR o polegar para o lado (`CURVA_TOQUE`: só o eixo horizontal, relativo ao ponto do toque; zona
  morta 10 px; um degrau a cada 14 px, ±1 a 52 px; histerese — o nível sobe na fronteira e só desce 6 px aquém dela; na borda
  da tela, ≤ 8 px dela com o dedo indo para ela, o degrau repete a cada 0,15 s; o que a borda somou zera na zona morta).
  `criarArrastoCurva` (pura) dá o nível; a página o traduz em PULSOS dos bits `EFEITO_D` (+) / `EFEITO_E` (−), os mesmos do Z/X
  (`pulsoDaCurva`, pura: um pulso por vez, só como borda nova — o próximo depois de um passo ver o bit solto; ≤ 30 degraus/s a
  30, 60 e 120 qps), contados em malha aberta (vale no online, onde o mundo vê o pulso D passos depois). Soltar a batida acaba o
  arrasto e DESCARTA o pulso que nenhum passo viu: a cobrança sai com a curva que a tela mostrava. Pausa, replay, cenas
  (`limparPulsos()` fora do laço), `soltarTudo` e `bloquear` acabam o arrasto. `entrada.definirCurva(ativa, curva)` a cada
  quadro (main.js, depois de `bp.tela.desenhar`): ativa = a cobrança mirada da PESSOA esperando, fora do tiro de meta, da
  corrida do item 70 e das cenas; liga a classe `curva-arrasto` no `#toque` (os chevrons ‹ › dentro do CHUTE e do LANÇAMENTO:
  pseudo-elementos, verde do TM `var(--tm-verde, #22c55e)` / preto do TM no `.ativo`, o lado da curva em α 1 e o outro em
  0,35 pelo `data-curva`) — nada de DOM novo, sem texto. Com o CHUTE ou o LANÇAMENTO JÁ segurado quando ela liga (o dedo posto
  na montagem da falta, antes da mira, ~1 s), o arrasto começa ali, da última posição do dedo naquele botão (`ultX`, guardada no
  `pointerdown`/`pointermove` de todo botão): os chevrons do botão segurado valem (revisão 1 do item 65, R1: antes a curva
  ficava em 0 e, para tentar de novo, soltar batia). PASSE e ENFIADA ignoram o arrasto. Teclado (Z/X) e controle
  (analógico direito, |rx| > 0,55, degraus com repetição) iguais. A lógica (`mira.js`), o formato do online (9 bytes) e o hash
  NÃO mudam (`hash-igual`, `hash-partida` demo e humano IGUAIS; `fecho-hash --diff` 0).
- **Câmera da bola parada** (`render/bola-parada.js CAMERA_BOLA_PARADA`, `planoBolaParada`; a mistura em `render/camera.js`): no
  escanteio, tiro livre, tiro de meta e pênalti com o cobrador sendo o controlado do humano e no pênalti CONTRA (atrás do
  cobrador adversário). Lado: o que fica mais para dentro do campo (empate: à esquerda de quem bate). Nada sólido na lente
  (`estadio-forma.js solidoEm`, folga 0,4 m) nem jogador a < 1 m: chega para a frente e sobe. A mistura com a TV entra em
  `entra` s (o corte da montagem entra direto) e volta em `sai` s no chute (posição, direção do olhar e fov misturados:
  sem salto). Com ela o analógico vira mundo pelo rumo dela (`yawEntrada` = a direção bola → alvo padrão): direita da
  tela = direita de quem bate (no pênalti contra, o goleiro escolhe o lado pela tela).
- **Metas do desenho e do gesto** (item 65; a régua é a máscara com × sem a mira no MESMO quadro, q=media, celular dpr 2 com
  o entalhe, dia e noite; os números de antes são os do mapa do item 65 na 2a13ca14, pela mesma régua): L1 a largura da linha
  p95 ≤ 4,8 px no celular e ≤ 7,5 no PC; L2 constante ao longo dela (p95/p5 ≤ 1,35 por tipo); L4 a área da mira (linha +
  anel + arco) ≤ 75% da de antes no escanteio e no tiro de meta e ≤ 110% na falta, no 844×390 e no PC (em 568×320 só ≤ 100%,
  informativo: a largura fixa em px ocupa mais na tela pequena), e ≥ 150 px; L5 o miolo ≥ 3:1 contra o gramado no mesmo ponto
  em ≥ 95% das tiras e L5b, em qualquer fundo (barreira, placas, rede), o miolo OU o contorno ≥ 3:1 em ≥ 95%; L6 nenhum pixel
  amarelo nem azul posto pela mira; A2 o anel do escanteio ≥ 20 × 6 px no 844×390 e ≥ 95% fora do HUD; C1 com curva 0
  nenhum pixel verde junto da bola e o arco crescendo ≥ 4 px (celular) / ≥ 8 px (PC) por degrau, para o lado da curva; custo
  ≤ +1 chamada, ≤ +500 triângulos e NENHUM programa WebGL novo quando a mira aparece pela 1ª vez (a mira desligada até a 1ª
  contagem — nenhum quadro a desenha antes — e acesa pelos quadros do relógio antes da 2ª; sem o `compileAsync` reprova,
  33 → 34). HUD da cobrança mirada (`teste-hud-minimo`, a régua do H1 com o placar mais largo): H1c ≤ 11% em 844×390,
  667×375 e 640×360 e ≤ 12% em 568×320 (base 10,53 / 12,95 / 13,14 / 14,45%); H2c nenhum texto fora do placar, do nome e dos
  nomes dos botões; H1d nenhum botão CURVA; H1e folga ≥ 4 px entre as peças; H9c os chevrons ≥ 2 px dentro do círculo do
  botão e ≥ 1 px do nome. Gesto (`teste-entrada`, contra o `atualizarMira` real): os degraus a 10 / 24 / 38 / 52 px; de 0 a +1 o
  mundo chega em ≤ 0,2 s depois do dedo (medido 0,003–0,012 s a 30, 60 e 120 qps) e de +1 a −1 em ≤ 0,35 s, com a mesma
  curva final nos três ritmos; tremor de ±3 px numa fronteira = no máximo 1 troca de degrau (medido 0); soltar com degraus
  na fila = a curva mostrada no último quadro.
- **Testes**: `teste-mira` (Node, padrão: A a bola = a linha a ≤ 3 cm; B curva para o lado certo; C controles, rótulos,
  a linha some no chute, tiro de meta; D o erro continua; E canhão do humano roteirizado, escanteio ≤ 12% e falta 2–12%;
  F a IA não usa; G o anel = `m.voo.alvo` ≤ 1 cm; H o plano do desenho), `teste-entrada` (a curva por arrasto: degraus,
  histerese, borda, contra o `atualizarMira` real a 30/60/120 qps, soltar com degraus na fila), `teste-bola-parada-tela`
  (navegador, CI: PC 1280×720 e celular 844×390 e 568×320 com o entalhe — o módulo fora do download inicial, câmera atrás do
  cobrador nos 4 tipos e no pênalti contra, cobrador e alvo no quadro, nada na lente, a mira ≥ 150 px e ≤ +1 chamada, sem
  painel nem texto, some no chute, a volta para a TV sem salto, teclado e o arco no mesmo quadro, o arrasto com toque de
  verdade — seção 5, com o caso E: o CHUTE apertado na montagem da 2ª falta seguida, antes da mira e dos chevrons, e arrastado
  +40 px depois deles = 0,75 —; seção 7, a mira pelos pixels: as metas acima) e `teste-hud-minimo` H1c/H2c/H1d/H1e/H9c (a
  cobrança mirada de verdade nas 4 telas; `--so-mirada`). Na base 2a13ca14 reprovam o G/H do `teste-mira`, a seção nova do
  `teste-entrada`, 28 de 49 itens do `teste-bola-parada-tela` (3, 5 e 7) e o H1c/H2c/H1d/H1e/H9c; o caso E reprova na
  49d23386 (antes da revisão 1). Os de câmera, de cobrança e de online afetados passam (`teste-camera-tela`, `teste-controles`,
  `teste-mira-tela`, `teste-corrida-cobranca`, `teste-online`, `teste-dois-humanos`, `teste-estilos-penalti`, `teste-tm-tela`,
  `teste-carga` e o `testar-3d` do TM).

## Goleiro realista (16/10; contrato) — defesa pela dificuldade, encaixe × espalmada, set, 1×1 e saída no cruzamento

Pedido do dono (15/10: "os goleiros se movimentando melhor e as espalmas e as seguradas de bola mais realistas, ele defende
mais bolas difíceis do que fáceis") e a pendência #114 (parte 3b da Etapa 4: sair no 1×1 e no cruzamento). **Tudo só na
partida** (`m.partida`) e fora do pênalti: o treino e o pênalti seguem a logística de antes (`hash-igual` IGUAL; o
`hash-partida` muda desde o 1º passo, porque o goleiro já se posiciona diferente). Constantes em `config.js
GOLEIRO.realista`; pesquisa e números em `PESQUISA-ETAPA4.md` §13.

### Chance de defesa (`goleiro.js lerChute`)
- `alcanceReal(tau, fator)`: o alcance lateral da mão em `tau` s — o deslocamento do mergulho de antes (`aMergulho`,
  `vMergulho`, `deslocMax`) mais o braço, que cresce de `alcance.emPe` para `reflexo` em `tReflexo` s e para `esticado` em
  `tEsticar` s (o corpo parado não leva a mão a 1,6 m em 0,15 s).
- `atrasoDoEstado(j, lat)` (s): `semBase` sem os dois pés no chão ou andando a ≥ `vParado` m/s, mais o tempo de frear
  quando ele anda para o lado contrário da bola. O estado do goleiro no chute passa a contar.
- Folga = `alcanceReal(tau − atraso)` − lateral (m), com `folgaCabeceio` m a mais no cabeceio a gol (lento, lido pelo corpo
  de quem cabeceia). `chanceReal(lateral, altura, alcance, attr)`: logit = `c0 + cFolga·folga + GOLEIRO.logit.attr·nível`,
  menos `cAlto·(y − yAlto)·cFolga` na bola alta longe do corpo (lateral > `altoLado`), vezes o limite físico de antes
  (`folgaAlcance`). A distância do chute só entra pelo tempo de voo: a bola de longe e lenta é fácil; a forte no canto, não.
  De longe a leitura erra mais: a chance (não o alcance físico, nem o encaixe, nem a bola no corpo) usa o alcance menos
  `erroLonge`·(distância bola–goleiro − `dLonge`) m, inteiro com a bola até `latErro[0]` m de lado e sumindo até
  `latErro[1]` m (a do canto, que já pede o mergulho inteiro, não perde nada) — `GOLEIRO.realista.erroLonge`/`dLonge`/
  `latErro`.
- Bola no corpo (lateral ≤ `corpo` m e altura ≤ `corpoAlto` m): defesa certa (`j.defesa.corpo = true`).
- Encaixe (`segura`): no corpo pela distância do chute ao gol (`corpoDist`, pares [m, fração] interpolados por
  `mat.js tabela`: a tabela da StatsBomb); senão `emPe[k]` ou `mergulho[k]` pela altura (k: < 1 m, 1–1,8 m, ≥ 1,8 m), vezes
  `1 + kV·(vRef − v)` (limitado a `vMin`–`vMax`; a bola forte escapa mais), no mergulho vezes `folga ÷ folgaPlena` (mínimo
  `minFolga`: a da ponta dos dedos é espalmada); tudo vezes `1 + 0,3·(reflexo − 72)/100` (as tabelas são do goleiro médio).
- Defendida sem encaixe: sai para FORA (espalmada pela linha de fundo ou por cima do travessão) com a fração da StatsBomb
  pela técnica e pela altura (`rebote.foraEmPe[k]` / `foraMergulho[k]`); o resto é `j.defesa.rebote` (a bola escapa e cai
  perto, de lado).
- `j.defesa` ganha `real`, `corpo`, `rebote` e `bloqueio`; o evento `leituraGoleiro` da partida traz também
  `{folga, corpo, lat, y, t, v, mergulha}`.

### Nada atravessa o goleiro (`aplicarDefesa`, `iniciarMergulho`)
- Batido, o desenho fica fora do caminho da bola: o corpo a `batido.corpo` m e a mão a `batido.mao` m dela (`g.curta`;
  no treino 0,4 e 0,35, como antes). A bola no corpo que a mão desenhada não alcança vira espalmada (rebote pelo sorteio
  abaixo).
- `corpoNaBola(j, tick, p, p1?)`: a bola toca o corpo desenhado (tronco do quadril à cabeça e as duas pernas do quadro do
  mergulho, raios `bloqueio.tronco`/`perna`; de pé, um cilindro até `bloqueio.alto` m) — em p ou, com p1, no CAMINHO do
  passo de p a p1, em pedaços de até `bloqueio.amostra` m contra o corpo do tick (27/10: só o ponto do começo do passo
  deixava o chute forte, ~0,45 m por passo, atravessar o tronco; `teste-goleiro-realista` A5). No passo comum o caminho é
  o da bola até o passo seguinte. `corpoNoCaminho(m, j)`: o caminho de cada um dos próximos `bloqueio.ticks` + 1 passos
  contra o corpo do tick em que ele começa. Goleiro batido com a bola passando pelo corpo, em qualquer tick do lance: vira defesa
  (`d.bloqueio`, espalmada) — `uniforme ≥ bloqueio.fora` → rebote perto, senão desvio para fora. (C3, 29/10: fora da defesa
  desenhada viva — e na saída no cruzamento que falha — o corpo é o DESENHADO, na `sim.js colisaoCorpoGoleiro`: seção
  "Goleiro espalma bola alta e nada atravessa o goleiro (C3)". O bloqueio daqui, dentro da janela da defesa, segue com os
  raios de `bloqueio` — pendência anotada lá.) (31/10, ebecbcb7: no mergulho a pelve é também uma esfera de `bloqueio.quadril`
  0,25 m no quadril — a bola rasteira passava rente por baixo dela, 1,6 cm fora do tronco: `teste-goleiro-realista` A5. Na
  partida IA × IA ela quase nunca decide: nas 144 do painel do #588, 0 das 43 defesas por bloqueio do batido saíram só dela;
  e a conta nova do `estadoEspalmada` abaixo — a bola que fica jogável e DEPOIS entra é 2 — mudou a direção de 1 espalmada.
  O goleiro de 6–16,5 m fora da meta no painel do #588 não veio do goleiro: contrato "Cobranças com corrida".)
- `estadoEspalmada(b, gx, sentido)` → 0 fora do perigo, 1 jogável na zona perigosa, 2 entra no gol (`espalmadaSegura` =
  0). `espalmar` na partida: sem direção segura, fica a 1ª que não entra no gol (antes a última tentativa valia mesmo
  entrando: 1,6% das espalmadas do canhão iam para o próprio gol); se todas entram, bem aberta para o lado dela, um pouco
  para a frente e para cima.
- `rebater(m, j, d, sentido)`: a bola sai a `fv`·v (na faixa `rebote.v` m/s), para a frente, aberta `rebote.ang` rad para
  o lado em que estava (nunca para o meio nem para o gol), subindo `rebote.vy` m/s.

### Movimento (`movimentoGoleiro`, `velPosicao`; `jogador.js`, `anim.js`)
- `velPosicao(m, j, dd, vel, cabeceioVindo)`: parado dentro de `mov.zona` m do ponto, com histerese (sai além de `zonaSai`
  m; com ameaça — o dono adversário com a bola a < `ameaca` m do gol — `zonaSaiAmeaca`). Com o chute armado do dono
  (`chuteArmado`: carga ou pedido de CHUTE) ou o cruzamento chegando à cabeça em < `setCruz` s: fica set (só corrige além
  de `setRaio` m, a ≤ `vSet` m/s). Perto do ponto anda em passos curtos (`vAjuste`; com ameaça `vAjusteAmeaca`). Parado,
  até `giraSet` rad da bola ele só acompanha com os olhos.
- Com o dono adversário conduzindo a < `ameaca` m do gol, a bissetriz mira a bola `antecipa` s à frente (chega antes do
  chute e fica set). Com a bola perto da linha de fundo (escanteio, cruzamento da ponta) a profundidade vai para
  `linhaPerto` m, interpolando pela distância da bola à linha do gol ao longo do campo (até `linhaU` m).
- Base: `j.baseGk` (= `mov.base` m andando a < `vBase` m/s): `jogador.js pontoPouso` pousa os pés mais abertos (só abaixo
  de 2 m/s) e `passoPassada` termina o passo com `mov.ritmoFim` (para e fica com os dois pés no chão).
  `baseGoleiro(m, j, s)` (0–1, contínuo pela velocidade; 0 fora da partida e com a bola nas mãos): `anim.js` baixa o
  quadril `mov.agacha` m e inclina o tronco `mov.inclina` rad; `iniciarMergulho` parte da mesma inclinação (sem salto).
- Set de verdade: `velPosicao` marca `j.setGk` com a velocidade pedida zero (na zona ou set no chute armado); com ele
  `jogador.js passoPassada` só dá o passo de ajuste com o corpo a mais de `mov.alcanceSet` m de um pé (0,3 nos outros) e,
  freando a < `vSetPes` m/s, não tira mais um pé do chão. A base de goleiro (`baseGk`/`setGk`) só vale no movimento de
  goleiro: indo como jogador de linha (`goleiroComoLinha`) ela é apagada.
- A pose da base (`j.baseF`, 0–1): `atualizarBaseGoleiro` (sim.js, 1×/passo por goleiro da partida) anda para o alvo — 0 com
  a bola nas mãos ou no pé, senão 1 − v/`vBase` — a no máximo 1 ÷ `mov.tBase` por segundo; `baseGoleiro` lê `j.baseF`
  (sem o salto de 7–8 cm do quadril no passo em que a bola entrava ou saía da mão).
- Campos novos do jogador, declarados em `criarJogador` (a mesma classe oculta do V8 — sem eles a partida ficava ~35%
  mais lenta): `baseGk`, `gkParado`, `varre`, `altoLido`, `abafaAte`, `baseF`, `setGk`.

### 1×1 e bola solta (`umXumPartida`, `saida1x1Partida`, `abafar`, `varrer`)
- `umXumPartida(m, j)` (o `deveSair` da IA na partida; a regra "ninguém do meu time a menos de 0,8× minha distância"
  saiu): o dono adversário com a bola a ≤ `umXum.dist` m do gol, dentro da largura da área, vindo para o gol (ou a ≤ 11 m),
  sem companheiro de linha a < `cobre` m da linha dono → gol nem a < `colado` m dele. Evento `saidaGoleiro {modo: '1x1'}`.
- Leitura do 1×1 (27/10, `chuteDeUmXum`): set (`naBase`) diante da finalização com o pé (`vooFinalizacao`, nunca o
  cabeceio, nem depois de um desvio — `m.desvio` ≥ o `tick0` do voo) de quem estava sozinho no 1×1, o goleiro lê o corpo
  do chutador: o tempo da conta do alcance ganha `umXum.leitura` s. O evento `leituraGoleiro` leva `umXum`.
- `saida1x1Partida`: só a bola baixa do toque longo (a > `colado` m do pé do dono, a mão valendo, ele chega `chega` s antes
  do dono) — ele corre nela (evento `saidaGoleiro {modo: '1x1'}`) e cai nela (`abafar`); com a bola no pé do dono devolve
  null e o goleiro fica no posicionamento de sempre, set com o chute armado (sair na bissetriz até 5,5 m baixava a defesa
  do 1×1; StatsBomb: 70,5% a < 2 m da linha, 68,4% a 2–4 m, 41,9% a 4–6 m).
- `abafar(m, g)` (sim.js, depois dos botes, com a bola dominada): a bola baixa (< `abafa.y` m) e lenta (< `vMax` m/s) a ≤
  `alcance` m dele (+ `saindo` m saindo), mais perto dele que do pé do dono, na área com a mão: sorteio pelo reflexo
  (`abafa.p`). Pegou → a bola nas mãos (`ganhouPosse`, evento `defesa {modo: 'abafou'}`); errou → descansa `descanso` s
  (`g.abafaAte`).
- `varrer(m, j, gx)`: a bola sem dono na área, baixa (≤ `varre.y` m), a ≤ `dist` m da linha, que ele alcança antes de todo
  adversário (folga `folga` s, também no caminho dela) e sem companheiro chegando bem antes: corre nela (evento
  `saidaGoleiro {modo: 'bolaSolta'}`), a no máximo `realista.varre.vMax` m/s (a arrancada inteira passava de 0,13 m por
  passo); indo nela, o "pegou" do `sim.js bolaLivre` aceita até `varre.vPega` m/s (9 antes).
  O passe do próprio time para outro companheiro não é bola solta; a finalização do adversário no ar
  (`vooFinalizacao`: chute, colocado, cavadinha, cabeceio a gol) e a bola com a defesa dele já lida também não (é da
  leitura do chute, com o tempo de reação). Recalculado a cada 4 passos (`j.varre`); o "pegou" rápido só vale com a ida
  calculada no MESMO passo (`j.varre.vivo === m.tick`).

### Saída no cruzamento (`saidaNoAlto`, `goleiroSaiNoAlto`)
- Chamada no começo de `lerChute`. A bola do adversário no ar (cruzamento, lançamento, escanteio, falta levantada; nunca
  uma finalização — `vooFinalizacao`: chute, colocado, cavadinha, cabeceio —, nem o cabeceio), com a bola em jogo; a saída
  abandonada (`d.saidaAlta && d.fora`) não impede `lerChute` de ler a bola como chute: o 1º ponto da trajetória (`conducao.js preverBola`) com altura em `cruz.y` m,
  a ≤ `dist` m da linha, |z| ≤ `largura` m e a mão valendo, a que ele chega (`reacao` + corrida × `fCorre` + pulo `salto` +
  `chegaAntes`, em s) antes de todo adversário cabecear (folga `folga` s; o pulo pela conta do `cabeceio.js`). Contestado
  (adversário a < `contesta` s do ponto) ou a bola a > `vSoco` m/s no ponto: soco; senão encaixe; sorteio `cruz.p`.
  Reavaliada a cada `cada` passos; já correndo, desiste antes do pulo se não chega mais (`tolera` s) e volta.
- "Deixa!": os companheiros que iam cabecear essa bola e ainda não saíram do chão desistem (salvo o controlado do humano);
  `sim.js bolaAltaNoCorpo` não planeja outro cabeceio por cima dele (`goleiroSaiNoAlto`).
- O corpo corre de frente para o ponto (de frente para a bola a menos de `vira` m) e pula pelo desenho (`iniciarMergulho`
  tipo `'salto'`; a bola abaixo de 1,45 m, `'peito'`) DA CORRIDA: na saída no alto o limite do deslocamento do pulo é a
  velocidade que ele já leva (o do mergulho parado, `vPico`/`vFrente`, não tinha solução e levava o corpo para trás). `aplicarDefesa` só encaixa ou soca com a mão desenhada a ≤
  `cruz.mao` m da bola; senão a bola passa (`saidaFalhou {longe: true}`) — e bate no corpo DESENHADO do pulo se for por ele
  (C3, 29/10: `sim.js colisaoCorpoGoleiro`; também na saída que o sorteio erra, já na janela da defesa). `socar`: `soco.v` m/s, elevação `soco.el` rad,
  aberto `soco.lado` rad para o lado da bola, para longe do gol.
- Eventos: `saidaGoleiro {modo: 'cruzamento', soco}`, `defesa {modo: 'encaixe' | 'soco', saidaAlta: true}`,
  `saidaFalhou {id, longe?, desvio?}`; depois do contato quem ia cabecear perde o plano.

### Bloqueio com a perna, afastamento de cabeça e o último toque (só na partida)
- `sim.js bloqueioPerna(m, x0, z0)` (depois de `passoBola`, antes de `colisaoBolaCorpo`): nos primeiros `BLOQUEIO.ticks`
  passos do chute/colocado — ou do passe/cruzamento/enfiada saindo a ≤ `fundo` m da linha de fundo que o defensor defende
  —, o defensor de linha a ≤ `dist` m de quem bateu e de frente para ele (≤ `frente` rad) estica a perna: a bola baixa (≤
  `alto` m; o passe ainda a < `pertoPasse` m do pé de quem cruzou, ≤ `altoPasse` m) que passa no passo a < `perna` m do
  centro dele (fora do corpo, que é do `colisaoBolaCorpo`) bate nela com a chance `p` (pelo alcance, × `kAttr` pelo
  desarme), sorteada uma vez por bola e defensor (`m.bloq`). Saída pela reflexão numa canela atravessada (normal que sobe
  `phi` e vira `psi` rad, restituição `e`). Evento `bateuCorpo {bloqueio: true}`, `registrarToque(m, j, 'corpo')`,
  `m.desvio` (o goleiro relê). Não muda `m.ultimoToque` (o gol desviado é de quem chutou: `render/autor-gol.js`).
  (28/10) Saindo da canela para cima, `m.bloq.sobe` = o tick: em `bolaLivre` ninguém a domina — no pé (`tentarDominio`) nem
  no peito/cabeça (`bolaAltaNoCorpo`, também a disputa pelo alto) — enquanto ela sobe (`v.y > 0`) e o topo do voo (`y +
  v.y²/2g`) passa de `ALTO_BOLA_LIVRE` (0,45 m, a altura da bola alta); desce, outro toque (o voo some ou muda) ou posse =
  acabou; o goleiro na área ainda pega com a mão. Antes o bloqueador a matava no passo seguinte subindo a ~11 m/s, ou um
  vizinho no peito subindo a 10–19 m/s (StatsBomb: o ataque toca primeiro em 50,5% dos bloqueados que seguem em jogo;
  `PESQUISA-ETAPA4.md` §13.3; `teste-goleiro-realista` D4).
- `partida.js atualizarUltimoToque`: o toque de `m.ultimoToque` só volta a marcar com o tick MAIOR que o último marcado
  (`>`; antes `>=`): a bola que bate num corpo no mesmo passo do chute fica com quem ela acertou (escanteio, não tiro de
  meta).
- `acoes.js afastarReal` (`CABECEIO.afastaReal`, o cabeceio de afastar na partida): a testa vira até `giro` rad do rumo do
  corpo e a bola sai na direção dela com `en` da velocidade normal que trazia mais `vTesta` m/s (10: o corte da bola do
  escanteio sai a ~17 m/s, perto do `vAfasta` de antes); sem ângulo para longe do próprio gol, para cima (`elFuga`).

### Testes e medidas
`teste-goleiro-realista` (padrão; `tools/lib/goleiro-canhao.mjs`, o mesmo canhão do `medir-goleiro.mjs`): 8 partidas IA ×
IA, 12 cópias do mundo no meio de cada uma (a bola no pé de um atacante a 8–32 m do gol); de cada cópia, chutes no gol a
14–30 m/s com a mira uniforme (na hora e a 6–16,5 m) e escanteios. Metas A (defesa pela dificuldade física: lateral e
tempo de voo, sem a conta do jogo), B (segura × espalma, espalmada nunca no gol, rebote), C (set com o chute armado, sem
saltos, pés cruzados, pose), D (1×1 no canhão de contra-ataque e bola solta por chute), E (saída no escanteio; guarda do
gol de escanteio), F (colocado e cavadinha não são cruzamento) e G (contra-ataque 1×1: defesa ≥ a da main, sem cavadinha
em série). Metas pela StatsBomb (o valor real está na linha de cada item); as que o jogo ainda não alcança — C1 (set no
instante do chute: real 88,9%), D2 (bola solta da área: real 0,061 por chute) e E1 (saída no escanteio: real 10,7%) —
ficam PENDENTE e só reprovam com `--estrito`; as guardas (C1g, D3, E1g) reprovam sempre. `--js
<pasta>` mede outra lógica (a main de 21/10 reprova 10 itens; a 1ª versão, 96f66255, 7 — F1, G1, G2, D1, D3, B2, C4). `medir-goleiro.mjs` (informativo) dá o relatório inteiro
(seções 1–4). O gol de escanteio ainda acima do real (2,6%) vem do duelo pelo alto, não do goleiro: pendência da Etapa 4.5.

## Chute com a barra cheia (C2, item 13; 27/10; decisão do dono 28/10; contrato)
Pedido do dono (15/10): "chute com a barra cheia mais alto, com chance de acertar o ângulo" (a bola ia a meia altura: a mira
subia só até `yAlvo[1]` 1,7 m, medida 0,4 m antes da linha, e o canto do analógico parava a meia-boca − 0,5 m).
- **Decisão do dono (28/10): "só o chute mirado sobe — com o analógico apontado para um CANTO, a barra cheia vai no ângulo;
  sem mirar (analógico solto), o chute fica na altura de hoje"**. No chute do jogo a barra cheia sobe (2,1 m na linha, o
  canto a 0,7 m da trave: o ângulo) só com a mira do analógico no CANTO: `acoes.js zBrutoAnalogico` (a conta de sempre antes
  do limite da boca: sen(ângulo entre o analógico e a reta bola–gol no toque) × meia-boca × 1,4) com |z| ≥ meia-boca −
  `cheia.zCanto` (0,9 → 2,76 m, a régua do "no ângulo" do teste; ~33° fora da reta bola–gol). Solto (o jogo escolhe o lado
  longe do goleiro, ±(meia-boca − 0,6)), para o gol e nas diagonais leves, a curva de antes BIT A BIT: a mira (y e z), a
  saída e o voo da main (teste-chutes, o árbitro independente abaixo). `y` 2,1 e `zFolga` 0,7 ficam: as metas precisam da
  margem (com 2,08 a "≥ 1,9 m" fica a 1–2 chutes de reprovar). Na **cobrança mirada** (`chuteMirado`, o tiro livre direto)
  a mesma régua do canto, pela bola que SAI (revisão de 29/10): a barra cheia só sobe SEM barreira (a de 0 conta como sem) e
  com a bola SUBIDA — a elevação da barra cheia (`elevacaoNaLinha`: 2,1 m NA linha do gol, no voo sem o gol) com o efeito
  (a curva Z/X e o `giroFalta`), a trajetória que vai ser chutada e desenhada — cruzando a linha do gol DENTRO da boca, na
  faixa do canto: meia-boca − `zCanto` ≤ |z| ≤ meia-boca (`mira.js naFaixaDoCanto` = `noCanto` com o teto na trave).
  Senão, a conta da main BIT A BIT: com barreira (também com a borda dela além da linha, D ≤ br.dist + 1), a mira no meio
  e nas diagonais leves, a curva que leva a bola ao meio ou para fora da boca, a mira bem fora do gol (a ±17° do padrão, a
  34 m a reta cruza a linha a ±10,4 m; a 22 m, a ~±7 m) e a que não vai para o gol. Duas versões antes desta: a 1ª "subia
  sempre" (no tiro livre de 33–35 m, a mira no meio com a barra cheia cruzava a linha a 2,10 m contra 1,58 m na main); a
  b6a457dd julgava pela RETA da mira, sem o efeito e sem teto — com a curva a bola cruza a linha 0,9–2,2 m de onde a reta
  cruza (onde termina a linha desenhada que a pessoa vê): a reta no canto e a curva levando a bola ao MEIO do gol subiam
  (a 33 m, a reta a z 2,90 com a curva +1 cruzava a z −0,20 a 2,10 m; main 1,60), a reta fora do canto com a curva
  levando a bola ao ângulo não subia, e a mira bem fora do gol subia (a bola sai de qualquer jeito). **Custo** (a linha é
  refeita a cada quadro: `mira-linha.js preverMira`; a tabela no fim da seção): sem a curva (w.y = 0; o `giroFalta` é
  (uz, 0, −ux)·g) o arrasto e o Magnus ficam no plano vertical da reta e a bola cruza a linha no z da reta (a ≤ 1e-12 m):
  a conta sai sem o voo subido; com a curva, a busca da elevação subida desiste cedo quando os dois lados do intervalo da
  bissecção cruzam a linha na mesma região fora da faixa (o z anda junto com a elevação: `elevacaoNaLinha(…, corta)`) e só
  então vem a conta de antes — as mesmas saídas do voo inteiro em 115.731 cobranças com curva (a grade de 11 posições ×
  501 retas × 3 forças × 7 curvas) e em 65.982 de 66.033 sem curva (as 51 diferentes exatamente nas bordas da grade de
  1 cm, |z| = 2,76 e 3,66 m, onde o voo dá 1e-13 m).
- **Por que o canto, e não o "mirado" (`mag > 0,3`) da 2ed0d56f** (revisão de 28/10): o módulo vale também para o analógico
  apontado para o GOL e para as diagonais leves, e aí a barra cheia subia no MEIO do gol a 2,1 m, sem a chance do ângulo
  (para o gol, a bola alta no meio 18,5 → 57,3% dos chutes, por cima 3,6 → 10,0%, trave 1,8 → 8,1%; a ±17°, −5,5 e −2,8
  pontos de gol). **Limiar × subida aos poucos** (medidos, a grade por direção abaixo): o limiar no canto (o código); G =
  subir pela fração |zMira|/zMax (a altura e o limite da boca por `lerp` da curva de antes até a da barra cheia; 0 = a conta
  de antes); G2 = uma rampa de |z| 2,06 a 2,76 m (~24° a ~33°). No canto (|z| ≥ 2,76) os três sobem inteiro — as metas do
  pedido (craque, analógico a ±0,75 rad) ficam iguais —; abaixo, o limiar fica na curva de antes e os outros sobem uma parte:
  G perde no meio (−0,6 ± 0,6; a +17°, −2,1 ± 1,5, a bola alta no meio 18 → 40–44%) e nem o "para o gol" fica igual à main
  (+0,6 ± 0,5, não bit a bit); G2 é igual ao limiar nas direções medidas em relação ao gol e perde mais nas diagonais do
  mundo (onde a mira cai entre 2,06 e 2,76 m: −1,5/−2,7 × −0,7/−2,1). **Escolhido o limiar**: a menor perda (−2,2 × −2,4 ×
  −2,3) e o único em que "sem mirar e para o meio fica como hoje" vale bit a bit. O salto de altura fica na borda da zona do
  ângulo (a ~33° a mira passa de 1,7 m, medida 0,4 m antes da linha, a 2,1 m na linha; o z da mira continua o mesmo).

  Contra o goleiro realista posicionado (sonda do C2 fora do repositório: uma partida de verdade com a bola rolando, os outros
  20 longe, 1 s para o goleiro ir à posição dele; por direção, 1.080 chutes — 6–26 m, até 40°, finalização 65/80/95, forte e
  colocado, força cheia —; os mesmos chutes nas 5 versões; Δ pareado ± 1,96 ep; main 46dd59ab, com o C1 #558):

  | analógico | main | 2ed0d56f (mag > 0,3) | **C2 (limiar no canto)** | G (fração do z) | G2 (rampa 2,06–2,76 m) |
  |---|---|---|---|---|---|
  | solto | 64,5% | 0,0 | **0,0 (chute a chute)** | 0,0 | 0,0 |
  | para o gol | 24,2% | +1,9 ± 1,8 | **0,0** | +0,6 ± 0,5 | 0,0 |
  | +17° / −17° | 67,8 / 64,8% | −5,5 / −2,8 | **0,0 / 0,0** | −2,1 / −0,7 | 0,0 / 0,0 |
  | +33° / −33° | 74,0 / 71,9% | −5,8 / −4,1 | **−5,8 / −4,1** | igual | igual |
  | +45° / −45° | 70,7 / 70,3% | −2,9 / −3,5 | **−2,9 / −3,5** | igual | igual |
  | canto ±0,75 rad (a meta) | 71,5 / 69,7% | −3,6 / −3,1 | **−3,6 / −3,1** | igual | igual |
  | só para cima ±90° (do mundo) | 64,9 / 64,6% | −2,5 / −3,2 | **−2,5 / −3,2** | igual | igual |
  | diagonal do mundo ±45° | 69,4 / 69,2% | −2,3 / −4,1 | **−0,7 / −2,1** | −1,6 / −2,6 | −1,5 / −2,7 |
  | quase solto (módulo 0,35, no canto) | 69,6% | −0,9 | **−0,9** | igual | igual |
  | meio (solto, gol, ±17°; 4.320) | 55,3% | −1,6 ± 0,9 | **0,0** | −0,6 ± 0,6 | 0,0 |
  | canto (as outras 11; 11.880) | 69,6% | −3,3 ± 0,7 | **−3,0 ± 0,6** | −3,1 ± 0,6 | −3,1 ± 0,6 |
  | **total (15 direções, 16.200)** | **65,8%** | 63,0% (−2,8 ± 0,5) | **63,6% (−2,2 ± 0,5)** | 63,4% (−2,4 ± 0,5) | 63,6% (−2,3 ± 0,5) |

  **A perda real somando as direções: −2,2 ± 0,5 pontos de gol** (não os ~1,5 da estimativa levada ao dono: ela vinha da
  grade de 3 direções — solto e ±0,75, outras sementes —, −1,8 ± 1,0; nestas sementes as mesmas 3 direções dão −2,2). No
  meio, 0; no canto, −3,0 ± 0,6 (o chute forte −4,2 ± 0,9, o colocado −1,7 ± 0,9) — o preço do ângulo com as metas do
  pedido. Onde a bola cruza (a grade toda, prevista no chute): no ângulo 7,0 → 23,0% dos chutes, alta no meio 8,1 → 16,6%, por
  cima 3,5 → 7,8%, trave/travessão 4,9 → 7,1%. A tabela da revisão anterior (a grade de 3.240 chutes: main 69,5% → 67,7% com o
  "mirado") fica nas opções abaixo, como histórico.
- **A conta** (`mira.js`, puras): `alturaMiraChute(forca, cheia = true)` = a altura da mira; até `ACOES.chute.cheia.de` (0,9) é a
  curva de antes (`lerp(yAlvo, forca²)`, medida 0,4 m antes da linha, bit a bit); acima, sobe em reta até `cheia.y` (2,1 m)
  **NA linha do gol** (o travessão fica a 2,44). `zMaxMiraChute(forca)` = o maior |z| da mira do analógico: meia-boca −
  `zFolgaJogo` (0,5, como antes) até 0,9, indo a meia-boca − `zFolga` (0,7 m) na barra cheia. `saidaNaLinha(pp, gx, zMira,
  s, y, w)` = a direção e a elevação para a bola, sem o erro, cruzar a linha do gol em (y, zMira): a elevação por
  `elevacaoNaLinha` (a 1ª de baixo para cima que chega a y, passos de 0,08 rad, e a busca binária entre ela e a de antes)
  no voo SEM o gol (`bola.js passagemLivre`: a mesma física até a linha, sem traves, rede e placas); com o efeito do
  colocado, o giro por secante (o giro que não chega à linha volta para o meio do caminho; nem a reta chega: gira contra o
  efeito até chegar). `noCanto(z)` = |z| ≥ meia-boca − `cheia.zCanto` (a régua do canto, a mesma nos dois);
  `naFaixaDoCanto(z)` = `noCanto(z)` e |z| ≤ meia-boca (a da cobrança: o z de onde a bola sai cruzando a linha, com o teto na
  trave). Usadas pelo chute do jogo (`acoes.js chute`, só na bola rolando e com o analógico no canto: o pênalti, o tiro livre
  com barreira e o chute sem mirar no canto ficam na conta de antes; a mira dele fica dentro da boca, `zMaxMiraChute`, e a
  saída compensa o efeito do colocado: a bola, sem o erro, cruza a linha na mira julgada a ≤ 0,4 cm, nos dois sentidos de
  ataque, forte e colocado) e pela linha da cobrança mirada (`chuteMirado` → `elevacaoNoCanto`: tiro livre direto sem
  barreira, a barra cheia e a bola subida cruzando a linha na faixa do canto; fora dela a conta de antes): a linha continua
  a física da bola (teste-mira A, 0 cm, também com a barra cheia: no canto 2,10 m na linha, no meio 1,66 m, a curva de
  antes; com a curva, a reta no canto e a bola no meio 1,65 m, a reta fora do canto ou fora do gol e a bola no ângulo 2,10 m).
- **Por que na linha e no voo sem o gol** (revisão do C2): a mira medida 0,4 m antes da linha subia mais até ela — de perto
  a elevação é de 38–44° e a barra cheia passava a 2,24–2,49 m, no travessão, mesmo sem erro (4–9 m: 100% → 90% de gols);
  e as buscas da saída (o giro do colocado e a elevação) usavam o voo de teste COM o gol, que com a mira alta batia no
  travessão, na haste ou no véu no passo em que chegava à distância da mira e voltava 'caiu' (y negativo, lateral 0): a
  função deixava de ser monótona e a busca saltava (o colocado sem erro a 19 m passava a 8 m do gol; a 35 m, na trave).
  `alturaNaDistancia`/`elevacaoParaAltura` (as da IA) não mudaram.
- **Quem muda**: só quem segura o CHUTE até a barra passar de 0,9 (≥ 0,72 s; cheia a 0,8 s) na bola rolando COM o analógico
  no canto (28/10: a mira dele a ≥ 2,76 m do meio do gol) — o chute forte e o colocado — e a pessoa na cobrança mirada do
  tiro livre direto SEM barreira com a bola subida cruzando a linha na faixa do canto (29/10: com e sem curva). A IA chuta
  com ≤ 0,75 (`IA_ATAQUE.utilidade.chuteForca`), o pênalti dela com
  ≤ 0,9 e a falta dela com ≤ 0,9: a partida IA × IA e o treino ficam bit a bit iguais (`hash-partida` IGUAL, `hash-igual`
  IGUAL, contra a main 46dd59ab). **A margem da IA é estreita**: a maior força medida em 10 partidas IA × IA inteiras
  (sementes 101–110, 4 min por tempo; 53 chutes) é 0,8958 (43 ticks de carga, a cobrança dela) contra `cheia.de` 0,9 — um
  tick a mais na carga da IA, ou `de` abaixo de 0,896, liga a barra cheia na IA × IA (o `hash-partida` pega). O **pênalti do
  humano** fica na curva de antes: a mira dele vai só a ±`penaltiCanto` (longe do ângulo) e a mira alta só somava bola por
  cima (17% → 42% para fora; B11 do teste-botoes segurando 50 ticks, 180 cobranças). A cavadinha não muda.
- **O erro não muda**: o do chute do jogo (finalização, distância, perna, `forcaMaxErro` ×1,15, colocado ×0,6) por cima da
  mira.
- **A troca com o goleiro (decidida pelo dono em 28/10: a decisão no topo da seção)**: o goleiro do treino (a logística de antes, `GOLEIRO.logit` cAlt
  −0,219/m, cLat −1,15/m; até o C1 era também o da partida) quase não premia o ângulo (a bola no ângulo é defendida ~como a de
  meia altura) e a bola alta e aberta sai mais. Toda mira mais alta faz um pouco menos gols contra ele. Medido (craque 90–99, perna boa, metade forte e metade colocado, 18–22 m,
  analógico no canto, goleiro da IA na linha; 480 sementes 7100 + 480 sementes 13100) e na grade larga (finalização
  65/80/95, 6–26 m, até 40°, analógico solto e no canto, forte e colocado, 3.240 chutes):

  | `cheia` (y, zFolga) | ≥ 1,9 m | no ângulo | por cima | gols c/ goleiro 18–22 m | grade larga |
  |---|---|---|---|---|---|
  | main (1,7 antes da linha, 0,5) | 22% | 9% | 1% | 55% | 64,4% |
  | 1ª versão do C2 (2,15 antes da linha, 0,35) | 79% | 24% | 10% | 40% | — |
  | 2,15 na linha, 0,35 | 79% | 27% | 10% | 42% | 54,4% |
  | **2,1 na linha, 0,7 (o padrão)** | **73%** | **26%** | **8%** | **54%** | **60,6%** |
  | 2,0 na linha, 0,6 | 61% | 26% | 5% | 54% | 62,2% |

  O padrão passa as três metas do pedido com a menor perda medida (−1 ponto na amostra do teste, o bom finalizador 42% →
  41%; −4 na grade larga, quase toda de 15–20 m); 2,0/0,6 perde menos na grade larga (−2), mas só 61% passam a ≥ 1,9 m.
  A hipótese era que o goleiro realista do C1 (premiando o ângulo) desfaria a perda.
- **Remedido sobre o goleiro realista (28/10; main 46dd59ab, com o C1 #558)**: o goleiro realista (`goleiro.js chanceReal`,
  só na partida) NÃO desfaz a perda. A sonda (a mesma grade de 3.240 chutes e as populações do teste, 18–22 m, perna boa;
  pares main × C2 com as mesmas sementes) contra três goleiros: o do treino (começa na linha; no chute está a 1,8 m dela,
  andando a ~1,1 m/s), o realista FIXO na linha (uma partida de verdade com a bola rolando, os outros 20 longe) e o realista
  POSICIONADO pela IA dele (1 s para ir à bissetriz, ~1,8 m da linha, "set" com o chute armado — como no jogo):

  | goleiro | grade main → C2 | craque 7100 | craque 13100 | bom 7700 |
  |---|---|---|---|---|
  | treino (logística) | 64,4 → 60,6% (−3,8) | 55,2 → 53,9 | 54,6 → 53,3 | 41,7 → 40,8 |
  | realista fixo na linha | 64,9 → 60,8% (−4,1) | 61,4 → 61,4 | 62,9 → 60,4 | 50,8 → 50,0 |
  | realista posicionado | 69,6 → 65,4% (−4,2) | 71,7 → 69,2 | 72,5 → 65,0 | 58,8 → 51,7 |

  Onde (realista posicionado, grade): 6–10 m −1,7; 10–15 m −2,6; 15–20 m −7,0; 20–26 m −4,7; forte −5,8 × colocado −2,5;
  analógico solto −6,9 × no canto −2,8. **Por quê**: não é a defesa, é a bola que sai. Onde a bola cruza a linha (prevista no
  chute, sem o goleiro): dentro da moldura 75,5 → 67,9%, por cima 3,1 → 10,6%, trave/travessão 5,2 → 9,7% (só ~1/3 entra),
  fora de lado 13,9 → 9,0%. E não há o que ganhar subindo: o realista posicionado deixa entrar 95,6% das bolas no canto a
  meia altura (main) e 97,3% das do ângulo (C2) — o chute com a barra cheia (~28–33 m/s) no canto já é quase indefensável a
  meia altura; a altura só pesa no meio do gol (alta × meia no meio: 88 × 78% de gols no C2). Com o goleiro defendendo pouco,
  vale mais a bola no alvo — onde a main é melhor.

  As opções (as 3 metas exatas: craque, perna boa, 241 chutes, sem goleiro; os gols contra o realista posicionado):

  | mira da barra cheia | ≥ 1,9 m | ângulo | por cima | grade | craque 7100 / 13100 | bom |
  |---|---|---|---|---|---|---|
  | main | 22,0% | 9,1% | 1,2% | 69,6% | 71,7 / 72,5 | 58,8 |
  | **y 2,1, zFolga 0,7 (o padrão)** | **73,4%** | **26,1%** | **8,3%** | **65,4% (−4,2)** | 69,2 / 65,0 | 51,7 |
  | y 2,1, zFolga 0,75 | 73,4% | 25,7% | 8,3% | 65,7% (−3,9) | 70,8 / 65,4 | 51,7 |
  | y 2,08, zFolga 0,7 | 70,5% | 25,3% | 7,5% | 66,1% (−3,5) | 70,8 / 65,4 | 51,7 |
  | y 2,07, zFolga 0,7 | 70,1% | 26,1% | 7,5% | 66,6% (−3,0) | 71,3 / 65,4 | 52,1 |
  | padrão + analógico solto na curva de antes | 73,4% | 26,1% | 8,3% | 67,7% (−1,9) | 69,2 / 65,0 | 51,7 |
  | y 2,08 + analógico solto na curva de antes | 70,5% | 25,3% | 7,5% | 68,2% (−1,4) | 70,8 / 65,4 | 51,7 |
  | y 2,07 + analógico solto na curva de antes | 70,1% | 26,1% | 7,5% | 68,5% (−1,1) | — | — |

  Reprovam uma meta: (2,08, 0,75) ângulo 24,1%; (2,09, 0,75) 24,9%; (2,1, 0,8) 24,9%; (2,1, 0,85) 22,8%; (2,06, 0,75) ≥ 1,9 m
  69%. **Nenhuma opção que passa as 3 metas fica sem recuo**: "≥ 1,9 m em ≥ 70%" pede a mira a ≥ ~2,07 m na linha e, com o erro
  do chute (σ ≈ 1,2–2° por eixo no craque, Hunter 2018: o chute alto espalha mais), ~1/5 das bolas vai ao travessão ou acima
  dele. A menor perda mexendo só em y/zFolga é 2,07–2,08 (−3,0 a −3,5), com a meta "≥ 1,9 m" a 1–2 chutes de reprovar; a
  maior alavanca é o chute com o analógico SOLTO (sem mirar: o jogo escolhe o lado longe do goleiro) ficar na curva de antes —
  −1,1 a −1,9 na grade, as metas (com o analógico no canto) iguais —, mas aí a barra cheia sem mirar não sobe, o que é decisão
  de produto. **Decidido (28/10): esta** — o padrão (2,1 / 0,7) com o analógico solto na curva de antes; na 1ª versão o
  "mirado" era o módulo do analógico > 0,3 (2ed0d56f: 69,5 → 67,7% nesta grade), e a revisão pôs o critério no CANTO (a
  decisão e a grade por direção no topo da seção). Sondas: `sonda-gk.mjs`, `sonda-rev.mjs` e a por direção
  (fora do repositório, como as outras sondas do C2); no teste a linha do goleiro realista posicionado é
  informativa.
- **Pesquisa**: o canto alto é a colocação que mais converte (StatsBomb, "The Enigma of Shot Placement": canto 50–60% × meio
  12–13%; Datawrapper sobre 101 mil chutes do StatsBomb Open Data: a bola no ângulo é "quase indefensável", e o jogador
  costuma bater baixo, o mais seguro); o chute alto espalha mais que o baixo (Hunter et al. 2018, J Biomech, 8.466 chutes) —
  por isso o erro do jogo (o da pesquisa da Etapa 2: σ ≈ 1,2–2° por eixo no craque) fica como era.
- **Teste**: `teste-chutes` (seção "barra cheia"; `--so-cheia` roda só ela; `--js <pasta>` mede a main): de 18–22 m, até
  20° da frente, o analógico no canto, sem goleiro, onde a bola cruza a linha (na trave/travessão, onde cruzaria). A MIRA
  com o erro zerado: na linha a 2,0–2,2 m, no ângulo e 0 por cima/na trave (main: 1,67 m, 0% no ângulo); de perto (4–9 m,
  até 30°, forte, erro zerado) 100% de gols e 0 na trave (main igual; a 1ª versão do C2: 90,5%, 30 na trave); a varredura
  com o erro zerado (9–35 m, até 45°, solto e no canto, forte e colocado, força 0,92 e 1; 1.176 chutes) ≤ 1% sem gol (main
  3,7%, 1ª versão 6,7%, a revisão ad44206f 0,2%; com o solto na conta de antes, 0,8%: 7 dos 9 sem gol são o colocado solto de 23–35 m,
  o mesmo da main). O analógico **SOLTO, PARA O GOL e a ±17°** (28/10) contra um **árbitro independente** (sem chamar
  `acoes.js` nem `mira.js`; `--so-arbitro` roda só ele, ~7 s): com o erro zerado e com o sorteio, 9–30 m, até 40°, forte e
  colocado, força 0,92 e 1, as duas pernas (320 chutes por analógico), (1) a mira (`m.voo.mira`) recalculada pelas constantes
  do config — y = yAlvo[0] + (yAlvo[1] − yAlvo[0])·f², a força pela carga (n ticks × PASSO / cargaCheia); z solto =
  meia-boca − 0,6 do lado longe do goleiro; z mirado = sen(ângulo entre o analógico, quantizado como a entrada do jogo, e a
  reta bola–gol no toque) × meia-boca × 1,4 dentro de ±(meia-boca − 0,5), e longe do canto —, a ≤ 1e-9 m em y e 1e-6 m em z;
  (2) no chute forte com o erro zerado, a bola de verdade (o voo passo a passo no mundo) a 0,4 m da linha na altura da mira e
  na linha no z dela, a ≤ 1 cm (main: 0,000 m). O colocado fica só pela mira: a conta de antes dele não leva a bola à mira de
  longe (main: até 0,15 m). Reprova na ad44206f (o solto: 320 de 320) e na 2ed0d56f (para o gol e ±17°: 320 de 320 cada;
  o solto passa), passa na main e no C2. (Antes era a versão contra ela mesma com `cheia.de` = 1, que com `--js` na main
  não provava nada.) Com o
  sorteio, o craque com a perna boa, metade forte e metade colocado (~241 chutes por semente; antes a "perna boa" era só o
  colocado — o pePreferido andava junto com o colocado), em **9 sementes juntas** (7100, 31100, 47100, 13100, 23100, 59100,
  67100, 83100, 97100; n 2.162, ep ≤ 1 ponto; 28/10): ≥ 1,9 m em ≥ 70% (72,3%), no ângulo — y ≥ 1,9 m e |z| ≥ meia-boca −
  0,9 m, dentro do gol — em ≥ 25% (27,0%) e por cima do travessão em ≤ 25% (8,7%). Numa semente só (ep ~3 pontos) as três
  passavam na 7100 do CI e alguma reprovava em 3 das 9 (por semente: 67–76 / 23–32 / 7–12%, uma linha informativa): a meta é
  a mesma, sobre o número medido — sem "reprova só quando prova" (com o ângulo a ~2 ep da meta, aceitar o intervalo seria
  afrouxá-la); `--sem-cheia a,b,c` troca as sementes. O teste inteiro leva 58–66 s aqui, sozinho (era ~40; `tempos-ci.mjs` 90; a referência e o canto, ~2 s). Informativos
  (na 1ª semente), com a main ao lado:
  só o forte, o bom finalizador, a perna ruim e os gols, defesas, fora e trave/travessão COM o goleiro — o do treino na
  linha (craque e bom) e o REALISTA da partida posicionado pela IA dele (craque; uma partida de verdade com a bola rolando e
  os outros 20 longe, `chuteNaPartida`). Os gols por direção do analógico contra o realista (a tabela do topo) ficam só aqui:
  na partida o teste anda a ~27 chutes/s, e com menos de ~1.000 chutes por direção o Δ fica no ruído (±2–3 pontos).
- **Referência gravada da main (revisão de 29/10)**: o árbitro independente deixava passar o que não muda a mira (o efeito
  do colocado solto ×1,03, o erro do solto ×1,3 com a barra cheia, a elevação +0,002 rad) e o que ele não varria (o módulo
  0,6/0,35 para o gol, o time que ataca para −x, o limiar do canto descendo a ~26°, a cobrança mirada). Agora o
  `teste-chutes` confere também uma **referência gravada da main 46dd59ab** (`tools/lib/chutes-ref.mjs` = os casos e a
  conta; `tools/dados/chutes-ref.json` = 2.256 resultados, 67 KB; `tools/` não vai para o site): cada chute num mundo de
  treino NOVO com a semente dele (o rng recriado logo antes do toque) e o toque chamado direto (`acoes.js executarAcao`, sem
  a locomoção) — a bola rolando (984: +x e −x, forte e colocado, as duas pernas, finalização 60–99, forças 0,3–1 com a
  maioria 0,85–1, 7–31 m, até 42° da frente, com e sem goleiro; o analógico solto, para o gol com o módulo 1, 0,6 e 0,35,
  ±17° e a varredura de ±0,5° a ±32° de 0,5 em 0,5° — abaixo do canto pela geometria do próprio teste, sen(a) × meia-boca ×
  1,4 < meia-boca − 0,9 até ~32,6° —; e o QUASE SOLTO, o módulo 0,21/0,25/0,3 — o jogo lê o analógico acima de 0,2, mas só
  mira acima de 0,3: o chute é o solto —, para o gol, a ±17° e no canto, ±33,5°…±90°, quase todo com a barra cheia), o
  pênalti do humano (192, todas as direções), o tiro livre com barreira pelo chute do jogo (112, todas as direções) e a
  cobrança mirada do tiro livre direto (968: sem barreira — e com a de 0 — a reta da mira a |z| ≤ 2,7 m e as que não vão
  para o gol, efeito −1 a +1; a CURVA Z/X ±1 e ±0,5 com a reta no meio, no canto |z| 2,9–3,5 e fora do gol 4,2–9; a reta
  logo abaixo do canto, 2,3–2,65, sem efeito e com ±0,25; com barreira, todas as direções e a reta no canto com a barra
  cheia; 17–34,8 m). De cada um, os bits (SHA-1, 12 hex) da bola depois do toque (posição, v e w, COM o erro do rng), da
  mira (`m.voo.mira`) e de onde a bola cruza a linha do gol no voo só da bola (`bola.js passoBola`), mais o y e o z da
  linha arredondados para o diagnóstico. Os casos de 29/10 ficam no fim da lista: os 1.592 de antes continuam com a semente
  e o hash gravados (conferido na regravação: 0 diferentes). **Na cobrança o "fora do canto" é pela bola subida**
  (`classificarCobranca`, o ÁRBITRO, nada do `mira.js`): a velocidade e o giro da cobrança pelas constantes do config, na
  direção da mira, com a elevação de uma busca própria (passos de 0,02 rad e bissecção) que cruza a linha do gol a 2,1 m
  (a barra cheia pela força) — onde ela cruza decide: fora da faixa do canto, a main bit a bit (879 das 968); na faixa
  (59), a altura do ângulo; na borda (30: ±2 cm da borda de baixo e 3,50–3,90 m, onde a bola raspa na trave), a main bit a
  bit ou a saída da subida. E o **canto** (não gravado), com o erro zerado: a bola rolando (160: o analógico a ±33,5°…±90°)
  cruza a linha a 2,0–2,2 m, a |z| ≥ meia-boca − 0,9, dentro do gol e NA MIRA julgada (a ≤ 1 cm; medido 0,4 cm: a saída
  compensa o efeito do colocado, nos dois sentidos de ataque); a cobrança (66 com a reta no canto sem efeito e as 59 da
  lista com a bola subida na faixa, também com curva) cruza onde o árbitro diz — a altura da barra cheia a ≤ 3 cm, o z
  dele a ≤ 2 cm, na faixa — com a saída dele (velocidade, direção, giro e elevação a ≤ 0,001 rad). A main passa a
  referência e reprova o canto; a 4a3fef80 reprova a referência (518 das 879 cobranças fora da faixa: a que "subia
  sempre") e a b6a457dd também (212: a curva levando ao meio, a mira fora do gol) e o canto (44 das 59 da faixa com curva:
  a curva levando ao ângulo sem subir). **Mutações** (todas reprovam; reaplicadas por patch
  sobre este código; entre parênteses, onde): A (o solto +0,1 m), B (para o gol +0,1), C (|z| 1–2 m +0,1), G (a elevação do forte solto +0,002 rad)
  e E/E2 (`zCanto` 1,8/1,6: o limiar descendo a ~21°/~24°) no árbitro e na referência; E3 (1,4: ~26°), F (o efeito do
  colocado solto ×1,03), H (o erro do solto ×1,3), I (para o gol com o módulo < 0,7 +0,1), J (o time que ataca para −x
  +0,1), N1 (o efeito do colocado a −x perto do meio ×1,02), N2 (o erro do QUASE solto ×1,3: 77 chutes) e N6 (o quase
  solto no canto subindo: 56) na referência; K (a cobrança fora da faixa +0,1 m) e N4 (o canto da cobrança pelo ângulo da
  mira ≥ 28°) na referência e no canto; L (o limiar da cobrança a 2,26 m: 40), N3 (a barra cheia também com barreira: 53),
  X1 (a cobrança com curva subindo pela RETA da mira, com o teto: 105 na referência e o canto com curva) e X2 (o teto na
  trave removido: 167) na referência; e, no sentido oposto, M (`zCanto` 0,5: o limiar subindo a 3,16 m) no canto.
  `--so-referencia` roda só ela e o canto (~2 s). **Regravar** (`node tools/teste-chutes.mjs --gravar-referencia <pasta js>
  [--origem "texto"]`, contra a versão que passa a valer — ex.: `git archive <commit> golaco | tar -x -C /tmp/x` e
  `/tmp/x/golaco/js` —, dizendo no PR o porquê) só com mudança DE PROPÓSITO no chute fora do canto: na mira, na saída, no
  erro do chute, no toque ou na física da bola (o C4, se mexer no voo, regrava); mudar a lista dos casos na lib também pede
  regravar (o "conjunto" gravado é o hash dela; caso novo, no fim da lista). Mudança que não é do chute (a IA, a locomoção,
  o treino) não mexe nela.
- **Tabela das cobranças da pessoa (revisão de 29/10)** — na partida de verdade (o meio do jogo da semente 1001, os outros
  21 longe), a barra cheia (50 ticks), a mira no padrão (meio), girada ±17° e no canto (a reta cruzando a linha a ±3,1 m);
  onde a bola cruza a linha do gol com o erro zerado e se os bits da bola depois do toque (com o erro) são os da main:

  | cobrança | meio (main → 4a3fef80 → b6a457dd → agora) | ±17° | canto (±3,1 m) | agora = main |
  |---|---|---|---|---|
  | tiro livre direto 34 m, sem barreira | 1,58 → 2,10 → 1,58 → **1,58 m** | 1,57 → 2,10 → 2,10 → **1,57 m** (cruza a ±10,4 m: fora da boca) | 1,58 → 2,10 → 2,10 → 2,10 m | no meio e a ±17° |
  | tiro livre direto 22 m, barreira de 0 | 1,66 → 2,10 → 1,66 → **1,66 m** | 1,64–1,65 → 2,10 → 2,10 → **1,64–1,65 m** (cruza a ~±7 m) | 1,65–1,66 → 2,10 → 2,10 → 2,10 m | no meio e a ±17° |
  | tiro livre direto 22 m, barreira de 4 | 3,16 m em todas | 3,01–3,16 m em todas | 3,12–3,17 m em todas | todas |
  | pênalti (o analógico: solto, para o gol, ±17°, canto ±0,75 rad) | 1,73–1,74 m em todas | igual | igual | todas |
  | escanteio ALTA e TENSA, tiro de meta LONGA e CURTA | a queda igual em todas | igual | igual | todas |
  | lateral | não passa pelo chute (o arremesso, `lateral.js`) | | | — |
  | chute do jogo, 20 m de frente, força 1 (forte e colocado, +x e −x) | solto/para o gol (módulo 1 e 0,35)/±17°/+30°: 1,66–1,68 m em todas | | ±0,75 rad: 1,66–1,68 → 2,10 m | fora do canto, todas |

- **As cobranças com CURVA (revisão de 29/10)**, main / b6a457dd / agora, o erro zerado. (1) A grade (sonda da revisão, fora do
  repositório): 10 posições de 17–34,5 m, sem barreira e com a de 0, a reta a |z| 0–9 m (25 valores), a curva
  −1…+1 (7), a força 1 e 0,95 — 7.000 cobranças; o árbitro dela diz onde a bola subida cruza (na faixa 852, fora 5.574,
  na borda 574). (2) As 2.640 cobranças da sonda da revisão pelo caminho da partida (falta → mira → carga → soltar;
  a classe pela saída sem o erro):

  | | main | b6a457dd | agora |
  |---|---|---|---|
  | grade: subiu (≥ 0,15 m acima da main) cruzando no MEIO do gol | 0 | 528 | **0** |
  | grade: subiu cruzando fora da boca (\|z\| > 3,90) | 0 | 2.266 | **0** |
  | grade: no ângulo (2,80 ≤ \|z\| < 3,55, força 1) sem subir | 460 | 156 (todas com a reta fora do canto) | **0** |
  | grade: a bola subida fora da faixa, v e w iguais à main bit a bit | 5.574 de 5.574 | 2.642 | **5.574** |
  | grade: a bola subida na faixa, subiu como o árbitro (y ≤ 3 cm, z ≤ 2 cm) | 0 de 852 | 548 | **852** |
  | sonda (k ≥ 49, sem barreira, 447): no meio a 2,1 m | 0 | 22 (s42: a 33 m, a reta a z 2,90 e a curva +1 cruzavam a z −0,20 a 2,10 m) | **0** |
  | sonda: no ângulo sem subir | 43 | 19 | **0** |
  | sonda: fora da faixa, iguais à main (sem o erro e com o erro) | 365 de 365 | 205 | **365 / 365** |
  | sonda: na faixa, subiu como o árbitro | 1 de 47 | 26 | **47** |
  | sonda: o resto (com barreira, carga ≤ 43, pênalti, escanteio, tiro de meta), iguais à main | 1.866 de 1.866 | 1.864 | **1.866** |
  | sonda: a barra cheia pela metade (carga 45/47, força ~0,94–0,98; 291): iguais à main / subiu na faixa | 291 / 0 | 142 / 12 | **255 / 36** |

  O custo por chamada do `chuteMirado` (Node, nesta máquina, a mediana de 3 rodadas; a
  linha refaz a conta a cada quadro): a 22 m sem barreira com a barra cheia 0,22 (main) → 0,22 ms sem curva e 0,22 → 0,25
  ms com curva; a 33 m 0,34 → 0,34 e 0,36 → 0,41 ms; com barreira e na força padrão da linha, igual; todas juntas 0,262 →
  0,271 ms (a b6a457dd 0,248). Sem o atalho sem curva e o corte da busca, com curva e a barra cheia fora da faixa saía o
  dobro (0,42 e 0,68 ms: a busca subida inteira e depois a conta de antes).

## Goleiro espalma bola alta e nada atravessa o goleiro (C3, item 14; 29/10; contrato)

Pedido do dono (17/10): "o goleiro ESPALMA bola alta" (as duas palmas iam sempre à bola, como num encaixe) e as pendências
do C1 (#558) e do C2 (#567) anotadas no item 14 da FILA. Pesquisa e números em `PESQUISA-ETAPA4.md` §14 (StatsBomb open
data, 728 partidas, medido aqui). **A lógica nova vale só na partida** (`m.partida`): o treino segue bit a bit (`hash-igual`
IGUAL); a mão de cima é só desenho.
- **A mão de cima (só desenho; `anim.js poseMergulho` → `goleiro.js maoDaEspalmada(g)` e `maosMergulho(g, q, out, segura,
  umaMao)`; a simulação chama `maosMergulho` sem `umaMao`, e `maoAlcanca`/`maoNaBola`/`bolaNasMaosMergulho` continuam pelas
  duas palmas)**: no mergulho que não encaixa a bola a ≥ `GOLEIRO.mergulho.umaMao.y` m (1,63: o terço de cima do gol — "a
  escolha da mão só conta no terço de cima") com ela a ≥ `umaMao.lado` m de lado do corpo no começo da defesa, e no salto da
  bola por cima do goleiro adiantado que dá certo (`g.recuo`, fora da saída no cruzamento — "de volta para o travessão"), UMA
  mão vai à bola: a de CIMA (a do ombro mais alto no contato; para a bola à direita do goleiro, a esquerda — a dos treinadores
  para espalmar por cima ou pela trave), salvo quando ela não chega e a de baixo chega (a palma a ≤ `maoOk` do centro da bola);
  batido no mergulho, a de cima vai e fica curta. A palma encosta no lado da bola que dá para o ombro dela (`umaMao.palma` m do
  centro: atrás e embaixo, empurrando-a para fora) e a outra vai só `umaMao.outra` do caminho. Perto do corpo (o mergulho
  curto) e no salto batido ficam as duas palmas (o salto com as duas mãos acima da cabeça: teste-mergulho B10). `maoDaEspalmada`
  é pura (refaz o quadro do contato), sem gravar nada no estado; `g.recuo` (o campo novo da defesa desenhada) não entra no
  hash nem é lido pela simulação.
- **O encaixe da bola alta por cima do goleiro adiantado** (`goleiro.js lerChute`, o recuo na partida): com a bola a ≥
  `GOLEIRO.realista.segura.recuoAlto[0]` m (1,8) no ponto em que ele a alcança voltando, segura com `recuoAlto[1]` (0,15 ×
  o reflexo em volta de 72) — StatsBomb: o goleiro a ≥ 2 m da linha e a bola a ≥ 1,9 m na linha, encaixe 14,9% (14 de 94).
  Antes ia a conta do treino (`GOLEIRO.segurar.emPe` 0,6).
- **A espalmada sorteada não vira "pegou"** (`sim.js bolaLivre`, partida): com a defesa desta bola já sorteada como
  espalmada ou batido (`j.defesa` não fora, `tipo !== 'encaixe'`, a chave do voo de agora) e ainda por vir, a mão desenhada a
  `GOLEIRO.pegaMergulho` da bola antes do contato não a agarra (antes 7 de 58 defesas da bola alta a ≥ 1,2 m de lado viravam
  "pegou" assim, por cima do sorteio pela StatsBomb).
- **O goleiro ATRÁS da bola** (`lerChute`, partida): a bola entre ele e o gol nunca cruza o plano dele (`preverPassagem` dá
  null) — antes a leitura caía no cruzamento da LINHA do gol medindo só o lado (`?? linha`): o goleiro driblado no meio-campo
  "espalmava" uma cobrança a 56 m dele. Agora só a bola que ele alcança voltando (`recuoBolaAlta`: o 1º ponto antes da linha a
  que ele chega a `GOLEIRO.vRecuo` depois da reação) tem defesa; sem isso, `j.defesa = {fora: true, atras: true}`. No treino
  fica como era (`?? linha`).
- **O corpo DESENHADO como sólido** (`anim.js`, puro; revisão de 29/10): `FORMA_SEG`/`FORMA_SEG_GOL` — por segmento de
  `SEGMENTOS`, os raios [A, B] do desenho (a pelve e o quadril mais enxutos), o achatamento frente–trás (o tronco tem 0,68 da
  largura na profundidade) e a referência do "frente" (ombros ou quadris); o goleiro com a luva no antebraço — e
  `CABECA_ESCALA`/`CABELO_ESCALA`/`CABELO_DESLOCA`/`CABELO_CALOTA`: a FONTE da forma do manequim (`render/jogador3d.js` lê
  daqui; os números são os de antes, o desenho não muda). `solidosCorpo(P, goleiro, C?)` monta os sólidos da pose P (os
  mesmos referenciais do desenho: cápsulas afuniladas e achatadas, a cabeça e a calota do cabelo como elipsoides) e
  `corpoNoPonto(C, x, y, z, rb, out?)` dá a distância normalizada (< 1 = a esfera de raio rb dentro), a normal para fora e o
  quanto falta até a superfície. O corpo humano da edição pro (`?corpo=humano`) é desenho por cima com a postura corrigida
  (`esqueleto.js postura`): a simulação confere pelo manequim — alguns cm de diferença no tronco.
- **Nada atravessa o goleiro, nada bate no ar**: (1) `sim.js colisaoCorpoGoleiro(m, x0, y0, z0)` (partida, depois de
  `colisaoBolaCorpo`): QUALQUER goleiro sem a defesa desenhada viva — fora da área sem a mão (`semMao`), a leitura dizendo
  "fora", o passe ou o cruzamento que passa por ele sem leitura, o mergulho/salto depois de `defesa.tick + 2` — e, na janela
  da defesa, a saída no cruzamento que o sorteio errou (`d.saidaAlta && !d.sucesso`), com a bola ACIMA de 0,9 m (abaixo, as
  pernas de todo jogador: `colisaoBolaCorpo`, o cilindro de sempre): o caminho do passo, em pedaços de `bloqueio.amostra` m,
  contra os sólidos da pose (a do FIM do passo no mergulho/salto — o quadro é puro no tick; de pé, a pose de agora, com o
  corpo já andado neste passo); o 1º pedaço dentro → o ponto de entrada por bisseção (~1 mm), a bola fica nele e reflete pela normal do
  sólido (relativa ao corpo, a restituição da `colisaoBolaCorpo`; evento `bateuCorpo`, `m.desvio`); já dentro no começo do
  passo (o corpo andou para ela): sai pela normal até a superfície. Pula quem tem a bola, quem tocou nela há < 10 passos, a
  parada, a defesa viva, o cabeceio marcado (a cabeça desenhada decide: `cabecaNaBola`) e, longe, quem está a mais de
  `bloqueio.alcance` m do caminho. O DOMÍNIO no peito/coxa já marcado (`bolaAltaNoCorpo`, `cond.toque` 'aereo'): a bola que
  encosta no corpo antes do tick marcado fica no ponto de entrada e o domínio passa para o passo seguinte (antes ela entrava
  até ~20 cm no peito esperando o tick e, se o domínio falhava, atravessava o goleiro). Antes (o 1º C3): um cilindro fixo no
  (j.x, j.z), de 0,9 a 1,75 m — batia no ar acima da cabeça do goleiro agachado na base (até 32 cm) e deixava a bola entrar no
  peito inclinado (até 15 cm). (2) A saída no cruzamento cuja mão não chega volta ao de antes (`d.fora`, `saidaFalhou {longe:
  true}`) e o corpo do pulo é o da (1), no ponto em que a bola chega nele — no 1º C3 o bloqueio pela previsão de 8 passos
  (`corpoNoCaminho`, com os raios grossos de `bloqueio`) a rebatia até 19 cm antes do corpo desenhado (34 de 38). O bloqueio
  do mergulho batido (C1) não mudou.
- **Fica como na main (medido, iguais nas duas versões)**: dentro da janela da defesa viva o corpo ainda é o do C1
  (`corpoNaBola`: o tronco de raio 0,22 m e 0,8 m de eixo, as pernas de 0,13 m; e a previsão de `bloqueio.ticks` passos no
  contato) — num canhão de 600 chutes no corpo do goleiro dentro da área, 3 dos 4 bloqueios do mergulho batido rebatem a bola
  a 5–12 cm do corpo desenhado, e em 7 defesas que dão certo a bola entra até 13 cm no corpo um passo antes do contato das
  mãos; as pernas de todo jogador (`colisaoBolaCorpo`, o cilindro de 0,31 m no centro, só o ponto do fim do passo): batidas a
  até 8 cm do desenho e a bola até 12 cm dentro da canela. Levar o corpo desenhado à janela da defesa muda a calibração do
  C1 (as taxas de defesa e de rebote): fica para um item dele. Na saída no cruzamento que DÁ CERTO, a mão/o braço desenhado
  encosta na bola 2 passos antes do contato em 4 de 99 saídas naturais (até 10,9 cm no miolo; a main igual, as mesmas 4) —
  o encontro das mãos com a bola, não uma bola que passa pelo corpo.
- **Teste**: `teste-mergulho` seções H e I (padrão, CI; ver o cabeçalho dele): H1 mergulho espalma ≥ 85% (main 90,9%:
  guarda), H1b por cima do goleiro adiantado seguras ≤ 30% (main 36,7% → 13,3%), H2 uma mão — a de cima — na bola acima da
  cabeça e a outra longe ≥ 80% (main 2,7% → 83,3%), H3 a espalmada sai do campo ≥ 90% (100%), H4 com o rebote para fora em
  65–95% (main 81,4% → 82,5%; real 79,1%), H5 a espalmada sorteada não vira "pegou" (main 21 de 370 → 0; com o `!sorteada` tirado, 21); I pelo corpo DESENHADO entre dois limites que não dependem da conta da simulação (o MIOLO — o menor semieixo de cada
  seção, a cabeça com 0,92 do raio — sempre dentro do desenho; a CASCA — o maior semieixo, a cabeça com o cabelo, 1,24 do
  raio — sempre fora; a forma copiada do desenho no teste): I1a nas batidas do goleiro fora da área (600 chutes a 0,95–1,9 m
  no corpo, ele solto no lance), o caminho do passo chega a ≤ 5 cm da casca (main 1/1, o 1º C3 8/130 → 0/41), I1b sem bater, a
  bola nunca entra > 2 cm no miolo (main 17/600, o 1º C3 28/600 → 0; os 3 passos antes de ele dominar/pegar a bola ficam de
  fora, informativo), I2 a saída no cruzamento que falha — 450 lances: o sorteio forçado a errar, a natural e a mão
  forçada a não chegar (`cruz.mao` 2 cm; dela, só as saídas em que a mão não chegou, a entrada no miolo contada depois desse
  passo, ≥ 20 saídas e ≥ 10 batidas no corpo do pulo) —: nem dentro do miolo nem batida no ar (main 3/30 dentro, a mão 1 de 1;
  o 1º C3 34/38 no ar → 0 de 76, a mão 0 de 26 com 26 batidas, e 0 no ar), I3 o goleiro atrás da bola nunca defende longe dela (main 4/120 → 0).
  Mutações (cada uma reprova o `teste-mergulho`): a colisão pula a saída sorteada para falhar (M5 da revisão) → I2 3 de 56; a
  saída cuja mão não chega sem `d.fora` → I2 (a mão: 1 de 1 — vira "pegou"); o `!sorteada` tirado (M7) → H5 21 de 370; a
  colisão desligada → I1a, I1b, I2; todo toque no alto marcado pulando a colisão (não só o cabeceio: o domínio no peito também) → I1b; sem o goleiro atrás da bola → I3; sem o
  encaixe do recuo alto → H1b; sem a mão de cima → H2; a pose de pé no lugar da do mergulho → I2.
- **Hash e painel** (contra a main 02f4ec4a): `hash-igual` IGUAL (o treino, 4 cenas × 20 sementes × 3 min); `hash-partida`
  muda só 1 das 8 partidas (humano, semente 3, no passo 4693: na main a mão desenhada do goleiro "pega" a bola 3 passos
  antes do contato da espalmada já sorteada; aqui o `!sorteada` não deixa e ela é espalmada) — mudança de propósito: a base nova do `hash-partida` é
  o merge deste item (`--ref`). A 1ª pessoa do cabeceio e a forma do manequim lida do `anim.js` são só desenho (conferido: os 16 segmentos, com o goleiro, com
  os mesmos raios e achatamentos de antes no `render/jogador3d.js`). Painel de 144
  em duas amostras pareadas por semente: 1001–1144 (121 partidas idênticas, 23 mudam): gols 1,65 → 1,68 (Δ +0,028 ± 0,058),
  goleiro 67,2 / 57,4 / 86,7% → 67,6 / 56,6 / 87,4% (as três metas), impedimentos 1,03 → 1,01, gols de cabeça 16,7 → 15,2%;
  7001–7144 (a da revisão; 125 idênticas, 19 mudam): goleiro no alvo 66,5 → 66,3% (na meta; o 1º C3 dava 65,8%), 6–16,5 m
  54,5 → 54,0% (fora da meta nas duas), impedimentos 0,89 → 0,87 (fora nas duas). Juntas (288): impedimentos Δ −0,024 ± 0,049
  por partida (z −0,98; nas 42 que mudam, 46 → 39), goleiro 66,3 → 66,3% (IC95 do bootstrap pareado [−0,88; +0,79] ponto).
  Como o impedimento caía nas duas, a amostra NOVA de 288 (4001–4288, a mesma cópia congelada da branch; 246 idênticas, 42
  mudam) decide: impedimentos 1,03 → 1,07 (Δ +0,031 ± 0,040, o sinal ao contrário), goleiro 68,0 / 59,1 / 83,7% → 68,3 / 59,6 /
  83,1% (as três metas), gols 1,74 → 1,69 (Δ −0,049 ± 0,062). As 576 juntas (`painel-equilibrio --partes`): impedimentos
  1,00 → 1,00 (Δ +0,003 ± 0,032, z 0,22) — era sorteio: só ~15% das partidas mudam (a 1ª defesa do goleiro que vira outra
  coisa) e o resto do jogo depois dela é outro —, goleiro 67,5 / 57,6 / 84,7% → 67,6 / 57,5 / 84,6% (IC95 do bootstrap
  pareado do total [−0,52; +0,78] ponto), gols 1,72 → 1,71 (Δ −0,007 ± 0,040), gols de fora da área 16,0 → 16,7%, pênaltis 72
  / 19 / 9% → 73 / 18 / 9%, gols de cabeça 14,1 → 13,4% (Δ −0,010 ± 0,013 por partida, z −1,6: não dá para separar do sorteio).
  Nenhuma medida na meta sai dela nas 576. (Na amostra nova sozinha, os "gols de fora da área" passam de 17,6% para 18,8%, a
  faixa vai até 18%: 76 → 80 gols de fora em ~430 gols de chute — e os pênaltis 71/24/6% → 67/28/6% com 17 → 18 cobranças.)
- **Goleiro realista** (`teste-goleiro-realista`, 24 sementes 1001–1024, main × agora; o canhão sai de cópias de cada partida,
  então as cenas só são as mesmas até a partida divergir — pareadas pela cena: 4.793 registros): D2 (o goleiro vai na bola solta
  da área, partidas) 4 em 198 chutes → 3 em 200 (0,020 → 0,015 por chute; as duas abaixo da meta 0,03, PENDENTE: 1 lance de
  diferença), E1 (escanteio, sai no alto e soca) 63/737 = 8,5% → 59/711 = 8,3% (na meta 7%; a revisão via 6,0 → 4,6% em 8
  sementes), E2 (gol de escanteio, guarda ≤ 10%) 7,2% → 8,2% (53 → 58; z ≈ 0,7). B1 (no corpo, chute de ≥ 16,5 m: segura,
  50–80%, real 64,9%) 63,5% → 54,2%: das 256 cenas pareadas do B1, 227 iguais, 27 encaixe → espalmada com a bola por cima do
  goleiro adiantado (a 2,4–3,1 m da linha, a bola a 2,7–3,7 m no plano dele: o `recuoAlto` da StatsBomb, 14,9%, o H1b do
  `teste-mergulho`) e 2 outras encaixe → espalmada; sem a bola por cima dele, o B1 fica 62,0% → 64,0% (165/266 → 169/264). O canhão sorteia a altura na linha uniforme até 2,3 m com o goleiro
  a ~3 m: 68 das 334 cenas do B1 (20%) são essa bola — na StatsBomb, o goleiro a ≥ 2 m com a bola a ≥ 1,9 m é 2,3% das defesas
  (94 de 4.106). A meta do B1 continua passando (52,7% em 1009–1024, 57,9% em 1001–1008), com pouca folga.

## Lançamento mais reto e rápido (C4, item 15; 30/10; contrato)

Pedido do dono (15/10): "lançamento mais reto e rápido; hoje vai muito alto". Pesquisa e a tabela antes → depois em
`PESQUISA-ETAPA2.md` §2.5a (StatsBomb open data da Copa 2022, medido aqui; Sakamoto 2026; EA FC; Kellis & Katis 2007).
- **`acoes.js vooLancamento(pp, ux, uz, Lq, L, w)` → `{el, s}`** (puro; chamado só por `lancamentoOuCruzamento`, o ramo do
  lançamento): a elevação pela distância PEDIDA `L` (`ACOES.lancamento.elev`, 18° a 20 m → 26° a 60 m; antes 28,6–41,3°,
  hoje `elevAlta`) e a velocidade para a bola cair a `Lq` m (o ponto com o erro do lançador: `velParaPousar`, como antes).
  Se ela pede mais que `ACOES.lancamento.vMax` (33 m/s), a elevação sobe entre a baixa e `elevAlta` até a bola cair no ponto
  saindo a `vMax` (`bola.js elevacaoParaPousar(p, ux, uz, D, s, lo, hi, w)`, busca binária de 24 passos; o alcance cresce
  com a elevação abaixo de ~42°, o ângulo do alcance máximo daqui, e `elevAlta` fica abaixo dele); se nem com `elevAlta` a
  bola chega a `Lq` saindo a `vMax` (`bola.js alcancePousando`), sai a bola de antes (`elevAlta` e a velocidade que ela pede
  — a de 61+ m). Nenhuma bola sai mais alta que antes; nenhuma acima de `vMax` que antes saía abaixo dele.
- **Vale para tudo que é LANÇAMENTO**: a pessoa, a IA (`acaoIA 'lancamento'`), o tiro de meta e a falta longa da IA
  (`partida.js`), o chutão do goleiro com o pé (`ia-tatica.js`) e a reposição/chutão com a bola nas mãos (`sim.js`). Não
  mudam: o cruzamento (`cruzamento`, incluindo o escanteio), a cobrança mirada (`MIRA.alta`/`tensa`), o arremesso lateral
  (`LATERAL.elevLongo`), a enfiada alta e o cabeceio.
- **O adiantamento pela corrida do recebedor** (`r.v × tVoo`, até 5 m): `tVoo` = 0,65 + L/27,5 s (antes 0,6 + L/18), a
  mesma folga de ~1,14 × sobre o voo até o 1º quique.
- **Muda o hash de propósito**: toda partida com um lançamento (`hash-partida --ref <a main>`: DIFERENTE a partir do 1º) e o
  treino de ataque com o LANÇAMENTO (`hash-igual --ref <a main>`); a condução fica igual.
- **Testes**: `teste-passes` (a meta nova: o tempo do toque à RECEPÇÃO ≤ o p25 dos lançamentos altos certos do StatsBomb
  a 35/45/55 m; a 40 m o ápice de 3 a 5,5 m e a saída ≥ 24 m/s; nenhuma saída acima de `vMax` — a de antes, o 1º quique na
  mediana ±0,4 s, saiu: ela segurava a bola alta) e `teste-aereo-troca` (o canhão lança com a elevação do lançamento reto
  quando a lógica tem `elevAlta`; na de antes, 26–37° como era).
- **Medidas (main 4658b3a1 × agora, mesmas sementes).** `teste-passes`: do toque à recepção a 35/45/55 m 5,58 / 2,70 / —
  s → 1,60 / 2,12 / 2,60 s (na main a bola desce de cima e o recebedor a cabeceia — passe de cabeça — em vez de dominar; a
  55 m não dominou em 6,7 s); a 38,7 m, ápice 7,2 → 4,2 m, saída 23,3 → 27,2 m/s, 1º quique 2,33 → 1,75 s. Canhão do
  `teste-aereo-troca`: o controlado é quem disputa 94% (111/118) → 95% (127/134), com o analógico largado 97 → 95%, trocas
  extras 0,11 → 0,15 por bola (metas ≥ 90% e ≤ 0,3). Painel de 144 (1001–1144): gols 1,68 → 1,76 (Δ +0,08 ± 0,22), passe
  certo 86,5 → 86,5%, interceptações 10,47 → 10,88 por time, posses no último terço 43,5 → 42,6%, gols de cabeça 15,2 →
  15,4%, duelos pelo alto com a bola rolando 2,4 → 2,3 por partida, goleiro 67,6 / 56,6 / 87,4% → 67,0 / 60,2 / 82,5%. Fora
  da faixa: o goleiro de 6 a 16,5 m, 60,2% (meta 55–60; 194 de 322 — UMA defesa acima do limite; Δ +3,6, IC95 do bootstrap
  por partida [−2,7; +10,0]; a main dá 57,5% nas 576 do C3). As defesas de ≥ 16,5 m caem 87,4 → 82,5% (Δ −4,9, IC95
  [−9,1; −0,4]; na faixa 80–90%), mas não pelo lançamento: na partida IA × IA ele é raro (96 partidas: 2,4 por partida,
  acerto 46,0 → 42,7% com n 226 / 232, ápice mediano 7,8 → 4,9 m, saída 24,4 → 28,5 m/s, do toque à posse 4,3 → 3,2 s) e
  só 2 → 3 dos ~380 chutes de ≥ 16,5 m vêm de uma posse com lançamento nos 10 s antes — é a partida que diverge depois do 1º
  lançamento. `hash-igual --base <main>`: ataque-demo e ataque-roteiro DIFERENTES (passos 9000 e 1200), condução IGUAL;
  `hash-partida --base <main>`: demo 1–2 IGUAIS, demo 3–4 e humano 1–4 DIFERENTES.

## Reposição do goleiro com a mão — rolar, por cima do ombro, bate-pronto e chutão (C5, item 16; 31/10; contrato)

Item 16 da FILA (a parte 3b da Etapa 4; regras do goleiro do #470). Pesquisa e números em `PESQUISA-ETAPA4.md` §15 (StatsBomb
open data, 149 partidas medidas aqui; van den Tillaar & Ettema 2004; Linthorne & Patel 2011; EA FC 25). **Só na PARTIDA com a
bola rolando** (`sim.js goleiroComBola` → `reposicaoPartida`; o treino e a bola parada seguem como eram).
- **Escolha.** IA (e a demo / quem joga pela IA: `m.iaJoga`): depois de `GOLEIRO.esperaIA` (`esperaHumano`) s, `acoes.js
  alvoReposicao(m, g, dir, seguro)` = `escolherAlvo(m, g, 'reposicaoMao', aceita)` (`ACOES.reposicaoMao`: cone 1,35 rad em
  volta do ataque, 8–40 m; a nota do passe, ângulo + 0,3 × distância + 38 × risco) só com quem está FORA da própria área, sem
  adversário a menos de `GOLEIRO.reposicao.livre` (10) m e com `riscoLinha(..., v, true)` ≤ `riscoMax` (0,2) — v = a
  velocidade média do passe rasteiro da distância (`min(15, 8 + 0,25 L)`) ou 18 por cima. Achou: rola até `rolarMax` (30)
  m, por cima acima disso; não achou: o chutão. Humano na partida: PASSE = arremesso (o companheiro do `alvoReposicao` sem os
  filtros na direção do aperto, ou `dHumano` pela barra; por cima acima de `rolarMax` ou com a barra ≥ `ombroForca`),
  LANÇAMENTO = bate-pronto, CHUTE = chutão, ENFIADA = `soltarNoChao` (como antes). A direção é a do aperto
  (`acoes.js direcaoPedida`), no máximo `virarMax` (1,75 rad) do ataque.
- **`riscoLinha(m, j, ax, az, bx, bz, v, aoSegmento = false)`**: com `aoSegmento` (só a reposição — também na nota do
  `escolherAlvo('reposicaoMao')`), a distância do adversário ao ponto da linha em vez da distância à reta inteira (o adversário
  além do recebedor contava como na linha: risco 1 em quase toda reposição medida). O passe de sempre não muda.
- **O gesto (`js/reposicao.js`, PURO):** `iniciarReposicao(m, g, plano)` grava `g.arremessoGk = {tipo: 'rolar'|'ombro'|'bate'|
  'chutao', desde, tick0, solta, chuta, lado, pe, para, dx, dz, L, forca, rumo, o, s, feito, gx}` (`lado` = o braço/pé
  preferido; `o` = a diferença da bola para o ponto de segurar, que some na 1ª parte; `gx` = a linha do gol dele).
  `reposicaoAtiva(m, g)` (feito nulo, `m.naMao === g.id`, a mesma `segura`); `bolaReposicao(j, ar, k, out)` = o centro da bola
  no tick k: nas mãos pela curva (rolar: para trás e para baixo, sai rente ao chão a `rolarSolta`; por cima: atrás da cabeça
  e por cima do ombro a `ombroSolta` ~1,9 m; bate-pronto/chutão: as mãos levam a bola a `soltaPe` e soltam), sempre a ≥
  `GOLEIRO.soltaLinha` m aquém da linha (`teste-goleiro-regras` G3c); depois da soltura do bate-pronto/chutão, a queda livre de
  `ar.s` até o chão. `quadroReposicao(j, m, q)` = o desenho (as duas mãos com peso, o quadril que desce e o tronco que inclina
  rolando, o tornozelo do pé do chute: arma, vai à bola no tick `chuta`, segue e volta ao pé plantado). Linha do tempo:
  `solta` = tick0 + `tRolar`/`tOmbro`/`tSolta` s; o chutão bate no ar a `yChutao` m; o bate-pronto no tick DEPOIS do quique.
- **Simulação (`sim.js`).** No gesto o goleiro para e vira para `ar.rumo` (o movimento do goleiro); a bola do estado é a do
  gesto (`bolaNaReposicao`, no lugar de `bolaNaMao`). `andamentoReposicao`: na soltura do bate-pronto/chutão guarda `ar.s`; no
  tick da soltura (rolar/por cima) ou do chute: `m.naMao = null`, `ar.feito`, e `acoes.js arremessoGoleiro(m, g, ar, r)`
  (rolando: a velocidade do passe rasteiro para a distância até `vRolar` pela força e pelo passe longo, `vyRolar` para baixo,
  giro de rolamento, voo 'passe' com `solto` — não vai ao chão no tick —; por cima: elevação `elevOmbro` pela distância,
  chega a quem recebe a `yOmbro` m, até `vOmbro`, voo 'lancamento'; erro `erroBom–erroRuim` rad pelo passe e pela pressão) ou
  o LANÇAMENTO de sempre (`executarAcao` com `pedido.repos`: 'bate' usa `ACOES.batePronto` — `vooLancamento(..., cfg)` — e
  giro 4; 'chutao' é o lançamento do C4). `m.voo.reposicao` = o tipo; evento `{tipo: 'reposicao', id, modo, para}`. Depois,
  o controle do humano vai ao jogador de linha mais perto de onde a bola cai (como antes).
- **Regra 12.3 (8 s):** o relógio para no começo do gesto (`regras-goleiro.js segundosNaMao`: a bola está saindo).
- **Pose (`anim.js pose`)**: o goleiro com `j.arremessoGk` usa `quadroReposicao` (pelve − `desce`, pitch + `inclina`, a mão do
  gesto sobre a do desenho pelo peso, o tornozelo do chute sobre o desenhado; `info.pes[p].apoio` falso com o pé do chute
  no gesto). O corpo novo (`render/esqueleto.js`) desenha pelas juntas: a mão fica na bola como no manequim (medido: ≤ 0,15
  m nos dois). Cópias da cena (`comemoracao.js copiaJogador`): `arremessoGk = null`.
- **Testes:** `tools/teste-reposicao.mjs` (padrão; A: canhão de estados do meio da partida, 6 partidas da demo — fração com a
  mão 55–82%, certas ≥ 90%, distância mediana 14,3–27,4 m, nada para a própria área nem de volta ao goleiro; B: o gesto — a mão
  desenhada na bola até a soltura, alturas, o bate-pronto quica antes do pé, o chutão no ar, mais baixo e mais rápido, o
  quadril/a mão/o pé na pose, sem salto, os botões). Reprova 11 na main. `teste-goleiro-regras` G3c continua 0/24.
- **Medidas (main 973de847 × agora).** `teste-reposicao`: com a mão 0% (0/107) → 69,2% (72/104; rolar 66, por cima 6), certas
  — → 93,1%, distância mediana — → 24,5 m, perda a < 40 m do próprio gol logo depois 9/107 → 10/104; o gesto: a mão a ≤ 0,12
  m da bola (0,19 nas duas mãos do bate-pronto), soltura a 0,30 m rolando e 1,90 m por cima, o bate-pronto quica no tick 256 e
  o pé bate no 257, 12,2° e 28,6 m/s × o chutão 19,1° e 23,6 m/s. Painel de 144 (1001–1144): gols 1,76 → 1,76, passe certo
  86,5 → 86,8%, interceptações 10,88 → 10,73 por time, posses no último terço 42,6 → 42,4%, origem "erro na saída de bola"
  35 → 31% dos gols de bola rolando, goleiro 67,0 / 60,2 / 82,5% → 66,3 / 56,2 / 85,4% (a faixa de 6–16,5 m volta à meta),
  gols de fora da área 17,1 → 13,5%, gols de cabeça 15,4 → 17,0%; nenhuma meta que estava na faixa saiu. `hash-igual --base
  <main>`: IGUAL (o treino não mudou); `hash-partida --base <main>`: demo 1, 2 e 4 IGUAIS, demo 3 e humano 1–4 DIFERENTES (a
  partir da 1ª reposição com a mão).

## Mira pela tela (C6, item 68; 31/10; contrato)

Item 68 da FILA (achado na revisão do C2; aval do dono 31/10). Pesquisa e números em `PESQUISA-ETAPA2.md` §2.12.
- **A regra.** A direção da MIRA das ações é a direção do analógico NA TELA, levada ao gramado pela câmera que desenhou o
  último quadro: a reta do olho por cada ponto da tela até y = 0, a partir do ponto do gramado de onde a ação sai. Vale para
  o chute, o passe, a enfiada, o lançamento, o cruzamento, o lateral (a opção e a direção do arremesso) e a reposição do
  goleiro. A corrida, a condução, o 1º toque da recepção, o lado do goleiro no pênalti contra e o giro da cobrança mirada
  (`mira.js atualizarMira`) seguem pelo rumo (`paraMundo`). Teclado, controle e toque são iguais (o analógico combinado).
- **Página (DOM).** `controle.js miraPelaTela(ax, ay, cam, ox, oz, out)` é PURA: a jacobiana da projeção gramado → tela no
  ponto (ox, 0, oz), invertida. `cam` = {px, py, pz, rx…, ux…, fx…}: o olho e os eixos (direita, cima, frente), que
  `cameraDaMatriz(matrixWorld.elements)` lê do three.js. Devolve null com o ponto atrás do olho (zc ≤ 0,5 m), a câmera
  rasante ou o analógico zerado; aí a mira é a do rumo. `main.js desenharQuadro`, depois de `cam.atualizar`, guarda em
  `telaMira` a câmera do quadro (`updateMatrixWorld`) e o ponto de onde a ação sai: a bola, se ela está a ≤
  `ENTRADA.miraBolaPerto` (2 m) do controlado; senão o controlado. Nas câmeras das cenas (comemoração, substituição,
  cartão, intervalo/fim, plano geral), `ok = false`. `entrada.js ler()` lê `opc.tela()` e devolve `mx`, `mz` (= direção ×
  módulo do analógico; sem a câmera, = x, z). `forcar(e)` dos testes: `mx` = `e.mx` ou null.
- **Lógica (pura).** A entrada ganha `mx`, `mz` opcionais. `sim.js aplicarEntrada` quantiza em 1/1024 e guarda a direção
  unitária em `j.imx`, `j.imz` (sem `mx`: = `j.ix`, `j.iz`; só com o analógico acima de `magDirecao`, como `ix`). Quem lê a
  mira: `acoes.js mira()`, `j.mira` guardada na carga, `direcaoPedida`, `lateral.js opcaoMirada` e a direção do arremesso
  (`partida.js comecarArremesso`). A IA, a demo e as entradas montadas pela defesa/recepção não têm `mx`: a partida IA × IA
  e o treino ficam bit a bit iguais. `main.js entradaDoTime` e `rodarPassos` passam `mx`/`mz` adiante.
- **Pênalti da pessoa** (`p.penalti && p.humano`; a câmera atrás do cobrador): o z da mira do chute e da cavadinha é o
  ponto da linha do gol para onde a mira aponta (`acoes.js zNaLinhaDoGol`; para o lado ou para trás, o lado dela além da
  trave). Depois vale o limite da boca e o `penaltiCanto` (±2,5 m) de antes. Fora do pênalti, a conta do C2 não muda
  (`zBrutoAnalogico`: o canto a ~33° da reta bola–gol).
- **Online.** A mira viaja pronta (o formato de 6 → 9 bytes; contrato "Online 1×1", etapa 2). Cada aparelho faz a conta com
  a SUA câmera.
- **Teste `tools/teste-mira-tela.mjs`** (navegador, CI parte 2). A página de verdade com um controle de mentira
  (`navigator.getGamepads`) empurrando o analógico na direção em que a pessoa vê o alvo, com o CHUTE segurado; lê `j.mira`.
  Mede 364 posições do último terço, PC 1280×720 e celular 844×390:
  - M1: a mira cruza a linha do gol mais perto do alvo apontado (meio, pau de perto, pau de longe), ≥ 90% cada;
  - M2: o meio visto vira chute no meio (fora dos cantos da régua do C2), ≥ 90%;
  - M3: erro p95 ≤ 1°;
  - M4: no pênalti, meio ≤ 0,6 m e traves ≥ 2 m do lado certo;
  - M5: sem erro;
  - M6: a câmera aproximada e as câmeras Atrás e Jogador do Livre, ≥ 90% e p95 ≤ 1°.

  `--raiz <pasta>` mede outra cópia (a main: reprova 13 de 19). `teste-entrada` confere a conta pura em 4 câmeras
  inclinadas e `teste-online` O1, o formato.
- **Medidas (main 630960d4 × agora).**

  | | celular | PC |
  |---|---|---|
  | meio visto → a mira no meio | 3,8 → 100% | 6,9 → 100% |
  | pau de longe visto → a mira no pau de longe | 1,4 → 100% | 3,0 → 100% |
  | meio visto → chute num canto | 32,7 → 0% | 7,4 → 0% |
  | erro p95 | 46,6° → 0,03° | 33,8° → 0,03° |
  | pênalti, meio · traves | −2,50 · −0,54 · −2,50 → 0,00 · 2,50 · −2,50 m | igual |

  `hash-igual` IGUAL; `hash-partida` IGUAL (demo e humano: as entradas de Node não têm `mx`). `teste-online` O12: a banda
  ~10 → 11,7 KB/s por sentido (≤ 15).

## Cobranças com corrida (item 70, P1; 31/10; contrato)

Item 70 da FILA, parte 1 (pedido do dono de 29/10: "no pênalti, no escanteio e no tiro de meta o cobrador corre até a bola e
bate"; aval de 31/10 — "68, 69 é 70 faz" — com as escolhas recomendadas do "Depende do dono" 12). Pesquisa em
`PESQUISA-ETAPA4.md` §16; constantes em `config.js CORRIDA_COBRANCA`; lógica em `js/corrida.js` (PURA: sem DOM nem three.js,
matemática pelo MD, sem sorteio). A P2 (os estilos do pênalti, o goleiro na linha até o chute na partida, a leitura do goleiro)
é outro PR.
- **Quem corre.** O cobrador do pênalti, do escanteio, do tiro de meta e do tiro livre (direto e indireto). A saída de bola e o
  lateral não mudam (bit a bit). No fim da montagem (`partida.js colocarNaCorrida`, depois de `fecharMontagem` e dos sorteios
  de sempre, na mesma ordem: nenhum sorteio a mais) o cobrador vai do ponto atrás da bola ao PONTO DE PARTIDA (corte de
  câmera, como a montagem), de frente para a corrida, e o plano fica em `m.parada.corrida` (no hash: `misturarPartida`).
- **O ponto de partida** (`corrida.js planejarCorrida`): pelo perfil do tipo (`CORRIDA_COBRANCA.perfis`; cada jogador tem a
  SUA distância, ângulo e velocidade dentro da faixa, pelo id — `fracDoJogador`) e pelo pé que bate (`pePreferido`; o ponto
  fica do lado do pé de apoio): pênalti 4–5 m a 25–35°; tiro livre com chute a gol (direto, a ≤ 30 m, dentro da largura da
  área) como o pênalti; o de passe/lançamento 2,6–3,2 m a 20–30°; escanteio 2,5–4 m a 25–40°; tiro de meta longo 4–5,5 m a
  30–40° e curto 2,5–3 m (o curto pela escolha da IA, `pr.curta`; a pessoa sempre o longo). O ponto nunca passa das placas
  (`borda`) nem fica dentro do gol (`linhaGol`): a distância encolhe na mesma reta (≥ 1,8 m). O pé de apoio tem o ponto dele:
  `apoio.lado` 0,3 m ao lado do centro da bola e `apoio.atras` 0,08 m atrás.
- **Os estados** (`ESTADOS_CORRIDA`): `'espera'` — o cobrador ('parado', sem `j.guia`) no ponto de partida; a pessoa mira e
  carrega como antes (`cobrar`: a mira, o pedido que espera a bola pronta, o tiro de meta com a área livre). `'corre'` — o
  pedido formado (a pessoa soltou o botão; a IA decidiu) fica em `cr.pedido` com a mira do momento (`cr.mira0`: o analógico e
  a mira guardada; no contato valem esses, como se o pedido saísse ali; o passe/lançamento sem mira nenhuma vai no eixo da
  cobrança) e o cobrador corre — só com ele parado (|v| ≤ `paradoMax` 0,5 m/s; empurrado numa trombada enquanto espera, o
  pedido espera ele frear: 01/11, o goleiro que levou uma trombada a 3,8 m/s começava a corrida de costas e a freada com a
  virada levava o quadril a 0,59 m). O 1º toque rápido (a janela da cavadinha) e o 2º toque segurado não seguram o começo da
  corrida.
- **A corrida** é a LOCOMOÇÃO do jogo: `corrida.js guiarCorrida` (no `cobrar`, antes do passo) escreve `j.guia`, o pedido de
  movimento que o `sim.js` usa para quem está 'parado' → `passoCorpo`/`passoPassada`; nada de teletransporte, nada de mover
  o corpo ou o pé sem a passada. A velocidade e o RITMO da passada saem de uma regulagem: para k = 0…5 passadas a mais até o
  pé de apoio pousar no ponto dele e a velocidade de cruzeiro a ±`velVaria` da do perfil, o tempo até o corpo chegar ao meio
  do apoio (com a aceleração ou a freada de agora, × `acelUsa`) e o ritmo que põe a fase ali; a escolha é a mais perto da
  velocidade do perfil com o ritmo natural (dentro de `ritmo` × o da velocidade). O ritmo vai à passada pelo `ritmoVoo`
  (`corrida.js saidaCorrida`, chamado pelo `sim.js` no lugar do `saidaParaToque` do cobrador): **a regulagem estica ou
  encolhe só o VOO** — com os dois pés no ar o ritmo é o da regulagem; com um pé no chão, o da passada de sempre (natural,
  adiantado, urgente) ou o da regulagem, o mais rápido (`jogador.js passoPassada`): o apoio nunca fica mais longo que o
  natural, e o do voo nunca abaixo de `vooMin` 0,8 × o natural (`corrida.js regular`: o tempo de cada escolha com o apoio no
  natural e o resto no voo, `faseNoAr`/`ritmoDoVoo`). Na última passada o pouso do pé de apoio é marcado para quando o ponto
  de pouso (`jogador.js pontoPouso`) chega ao dele, pelo ritmo do voo (≥ `vooMin`). No começo da corrida, parado com os
  dois pés no chão e a fase a ≤ `trocaPe` de um inteiro (|sen π·fase|), a regulagem escolhe o PÉ QUE SAI PRIMEIRO (a fase
  + 1; o desenho parado é o mesmo): com ele, o pé de apoio pousa ao lado da bola num número par ou ímpar de passos. (01/11:
  com o ritmo da passada inteira a 0,8× o natural, o pé de apoio da penúltima passada ficava plantado com o corpo a ~4,8 m/s
  andando ~1 m por cima dele — o `pousoEm` passava por cima do ritmo adiantado/urgente — e o quadril caía até 0,29 m abaixo
  da altura da corrida, a cabeça até 0,38 m: no replay do gol de pênalti a 1ª pessoa balançava 7,5 cm.)
- **O contato** (`corrida.js contatoCorrida`, no passo 3 do `sim.js`, no lugar da condução do cobrador — que não roda, nem a
  "bola perdida", enquanto a parada tem corrida: `naCorrida`): o pouso do pé de apoio a ≤ `planta` m do centro da bola marca
  `cr.plantou`; no meio desse apoio (`cr.meio`) — ou com o corpo chegando à altura da bola — sai o toque de ação de sempre
  (`acoes.js executarAcao`) com o pé que bate e o pedido guardado. O gesto do pé sobe com o toque 'acao' marcado na hora
  prevista (`guiarCorrida`: até `GESTO.janela` + 0,1 s antes; `conducao.js atualizarGesto` → a pose). Trava proibida: passou
  do ponto sem o apoio certo, ou da corrida prevista + `max` s, bate assim mesmo. No mesmo passo a bola rolou
  (`ganchosCorrida.rolou` = `partida.js rolou`): o goleiro lê o pênalti com ele em aberto, a barreira pula, o escanteio marca
  os lugares — como quando a cobrança saía antes do passo. Depois do contato o cobrador freia (`j.guia.vel` 0; na partida
  ele volta a jogar).
- **A bola** fica presa no ponto até o contato (`regrasPartida`, como antes; a trava de `PARTIDA.paradaMax` não corta a corrida
  em andamento — a dela é o `max`). A linha da cobrança mirada (`mira-linha.js preverMira`) mostra, na corrida, o pedido
  guardado (tipo e força do soltar): a bola real passa a 0 cm dela sem o erro do cobrador (`teste-corrida-cobranca` C6).
- **A IA começa antes.** `cr.ticks` = a previsão da corrida (`estimarTicks`: a mesma locomoção, com a bola, na velocidade do
  perfil). A IA (`iaPodeCobrar(m, ant)`) e a IA jogando pelo humano (a demo: `entradaCobranca` aperta antes; com `iaCobra` o
  pedido não espera a bola pronta) começam a corrida `ant` ticks antes da hora de bater de antes (`pronta + atraso`), com as
  esperas também adiantadas: a zona livre conta quem sai até o fim da corrida (`zonaLivre(m, t)`: a velocidade com que a
  parede o tira + `folgaZona`) e a saída curta do tiro de meta, o zagueiro que vem vindo (`TIRO_DE_META.chegaVel`) e chega até
  lá. No pênalti a corrida da IA começa no apito (Regra 14: nada antes do sinal) e a montagem do pênalti foi de 1,5 para
  1,25 s (`PARTIDA.montagemPor.penalti`) — a bola rola no tempo de antes (o relógio não para nas bolas paradas).
- **O apito** (`partida.js apitoDaCobranca`, também na disputa): no pênalti e no tiro livre com barreira (Regras 13 e 14: a
  cobrança cerimonial), um evento `apito {motivo: 'cobranca'}` por parada, no `pronta` ou quando a corrida da IA começa antes.
  Escanteio, tiro de meta e o tiro livre sem barreira não têm apito.
- **Escanteio.** Na corrida, quem ataca a zona ESPERA no lugar dele, sem correr (`bolas-paradas.js escanteio`, `zonaAntes`
  0); a arrancada para a zona é no chute, como antes. (31/10: saindo junto com o cobrador, trotando até 0,15 do caminho, o canhão
  de escanteios do `teste-goleiro-realista` — estados do meio da partida, sementes 1001–1008 e 2001–2008 — ia de 5,1% de gols
  (main, 22 de 435) a 11,2% (57 de 507): ele chegava ao chute já andando, à frente da marcação; parado, 6,9% (33 de 480). Abaixo
  de ~0,12 ninguém sai do lugar — o ponto fica a menos de `IA.modos.pressa.retoma` —: não há meio-termo que mostre a saída sem a
  vantagem. Antes, com 0,35, o canhão do `teste-bolas-paradas` ia de 6,3 a 11,8%.)
- **A disputa de pênaltis** (`disputa.js`): a caminhada termina no ponto de partida da corrida (o mesmo `planejarCorrida`) e a
  cobrança corre de lá; o apito pelo `apitoDaCobranca`; a trava da cobrança não corta a corrida.
- **Câmera** (`render/bola-parada.js`, só desenho): o quadro é montado pelo ponto da linha bola–alvo na altura do ponto de
  partida do cobrador (os pés dele em `bolaY`, a bola mais acima, à frente dele, e o alvo em `alvoY`), com a lente atrás dele
  `atrasMin`–`atras` (3,2–4,6 m) e a até `distMax` 7,6 m da bola — o cobrador inteiro na metade de baixo (`teste-bola-parada-tela`
  item 1); o ponto é fixo na parada inteira (a câmera não anda com a corrida).
- **Mira pela tela** (`main.js telaMira`, contrato "Mira pela tela"): na cobrança do controlado a direção sai sempre da BOLA
  (ele espera longe dela, a 2,5–5 m; pelo `miraBolaPerto` ela sairia dele e o pênalti mirado no meio do gol visto ia à trave:
  `teste-mira-tela` M4).
- **Online.** A corrida é lógica determinística: os dois aparelhos rodam igual (`teste-corrida-cobranca` C8; `teste-dois-humanos`,
  `teste-online`).
- **Decisão para o dono confirmar** (escolha recomendada do item 12 aplicada): a cavadinha segue a regra escrita ("o 2º aperto
  do CHUTE antes de o chute do 1º tocar na bola vira cavadinha") — com a corrida, a janela do 2º toque vale a corrida toda
  (`partida.js correrCobranca`: o pedido guardado é renovado a cada passo; só o CHUTE conta na corrida).
- **O goleiro de 6–16,5 m (01/11).** No painel do CI (522a4e36) as defesas do goleiro de 6–16,5 m saíram da meta (main 56,2 →
  61,5%). Não é o goleiro nem a pelve do ebecbcb7 (0 defesas decididas por ela em 144 partidas): sem corrida nenhuma o PR é
  a main bit a bit. Nas sementes 1001–1144 a divisão por peças pôs o salto na corrida do PASSE de tiro livre (o cobrador segue
  correndo para a frente depois do passe curto); nas outras amostras o efeito some no sorteio (main 56,2 · 56,7 · 60,8 ×
  PR 62,4 · 61,6 · 56,5 nas 1001 · 3001 · 5001; 61,5 × 63,5 nas 7001): nas 576 partidas de cada, 58,8 × 61,1%, Δ +2,3
  pontos, IC95 [−0,4; +5,9], p = 0,053 — empate pela regra da amostra 4× (a main fora da faixa em 2 das 4). Recalibrar o
  goleiro tiraria ≥ 16,5 m e o total da meta. Nada muda no código; números, o experimento pareado e a proposta (para o dono:
  o passe de tiro livre sem a corrida) na PESQUISA-ETAPA4.md §16.
- **As formas do jogador (01/11, CI do #588).** A corrida punha o `j.guia` no cobrador depois de criado: os 22 chegavam a 12
  formas (classes ocultas do motor JS; a main já tinha 9 pelo `choque`, o `arremesso`, o `arremessoGk` e o `salto`), os acessos
  viravam megamórficos e, depois da 1ª cobrança com corrida, cada passo com a bola rolando custava ~40% mais (`teste-custo`
  2,61×, meta ≤ 2,5×; no trecho em que as duas versões jogam igual, o mesmo custo). Os cinco estão declarados em
  `jogador.js criarJogador` (1 forma; o passo ~10–15% abaixo da main; hash-partida e hash-igual IGUAIS) e o `teste-custo` ganhou
  a guarda: as chaves de cada jogador em 2 partidas inteiras, 1 forma (reprova na main e sem a declaração do `guia`).
- **Teste `tools/teste-corrida-cobranca.mjs`** (Node, padrão; reprova na main 630960d4). Cenas do COMEÇO de partidas IA × IA
  (as duas versões bit a bit iguais até a 1ª bola parada com corrida) com a parada forçada; 16 por tipo e caminho (IA, demo) +
  a pessoa: C1 anda ≥ 3,5 m no pênalti e ≥ 2 m nos outros; C2 2,5–5 m/s no contato; C3 o pé de apoio plantado a 0,2–0,45 m
  do centro da bola; C3b o pé que bate no ar com o gesto (peso ≥ 0,5, tornozelo desenhado a ≤ 0,35 m da bola); C4 a régua do
  `teste-patinacao` no cobrador e o pé plantado da simulação parado; C5 a bola morta → rolando por tipo, a média da diferença
  PAREADA com a main a ≤ ±0,2 s (os tempos da main em `tools/dados/corrida-ref.json`: `--gravar-referencia <pasta js> --origem "main <commit>"` — mudou
  de propósito o começo da partida IA × IA ou as bolas paradas da main? regravar e dizer no PR); C6 a linha da cobrança
  mirada no soltar × a bola real ≤ 3 cm; C7 a cavadinha com o 2º toque no meio da corrida; C8 dois humanos com o mesmo hash;
  C9 o apito; C10 o escanteio: quem ataca a zona espera no lugar (no contato, em média ≤ 2% do caminho da saída à zona) e não
  chega antes (ninguém além de 20%); C11 sem mergulho: do 1º passo ao contato, o quadril (o da simulação, `j.quadril`) no
  máximo 0,12 m abaixo de 0,92 m (a altura da corrida do jogo a ~4 m/s) e nenhuma corrida com ≥ 0,15 m, a cabeça desenhada
  no máximo 0,20 m abaixo da de pé (Lee & Farley 1998: o centro de massa baixa ~7 cm no apoio da corrida; Lees et al. 2010:
  o joelho de apoio a ~26° no pouso e ~42° no contato; a corrida normal do jogo a 4–5 m/s fica 0,106–0,128 m abaixo de 0,92
  no p90), nas corridas da IA, da demo, da pessoa e num CANHÃO DE COBRADORES (cada cena com outro jogador de linha do time
  batendo, como o `colocarNaCorrida`; o C3 e o C4 também neles) — 522a4e36: 0,336 m, 82 de 265 com ≥ 0,15 m, a cabeça
  0,38 m; agora 0,100 m, 0, 0,16 m. As guardas conferidas por mutação (corrida curta, pé de apoio longe, IA sem adiantar, pé
  arrastado, velocidade alta, a linha sem o pedido, a janela da cavadinha, sem apito, sorteio fora do mundo, a zona parada
  (`zonaAntes` 0,15) e a zona adiantada (0,35): cada uma reprova o item dela). O C11: a lógica de 522a4e36 (0,336 m, 82 de 265
  com ≥ 0,15 m), sem a escolha do pé que sai primeiro (`trocaPe` −1: 0,142 m, e o C3, o C5 do pênalti da demo e o C3 do canhão
  também) e sem as DUAS guardas do apoio e do voo (o `ritmoVoo` também com um pé no chão e `vooMin` 0: 0,141 m) reprovam; uma
  delas sozinha cobre a outra nestas cenas (só o apoio esticado: 0,100 m, porque com o voo ≥ 0,8 o apoio estica no máximo a
  0,93× o natural; só o voo sem piso: 0,110 m) — as duas ficam (o apoio natural é o mecanismo; o piso do voo evita o salto).

## Estilos de pênalti (item 70, P2; 01/11; contrato)

Item 70 da FILA, parte 2 (pedido do dono de 29/10: "o pênalti ganha jeitos de bater, com pulinho, com paradinha e outros";
aval de 31/10 — "68, 69 é 70 faz" — com as escolhas RECOMENDADAS do "Depende do dono" 12, registradas abaixo). Pesquisa em
`PESQUISA-ETAPA4.md` §17; constantes em `config.js ESTILO_PENALTI` (e os perfis `CORRIDA_COBRANCA.perfis.penalti*`); lógica em
`js/corrida.js` (puro: os estilos, a paradinha, o pulinho, a leitura), `partida.js` (a montagem, os botões da pessoa, a
leitura da IA no contato), `goleiro.js` (a linha, o passo do que sai cedo, a vantagem do que sai cedo para o lado certo),
`disputa.js` (os mesmos estilos), `jogador.js` (a carga do pulinho), `anim.js` (o salto do pulinho, só desenho).
- **As escolhas do dono (31/10, as recomendadas do item 12).** (1) Os comandos como no EA FC: CORRER segurado no soltar do
  CHUTE = forte; MOD = colocado; LT/L2 = paradinha; um botão para o pulinho; no toque, PARADINHA e PULINHO só na cobrança do
  pênalti da pessoa. (2) A paradinha depois da corrida é IMPOSSÍVEL por construção (sempre antes do último apoio; a Regra 14
  nunca precisa ser aplicada). (3) O rendimento REALISTA: o normal ~77% de gol; paradinha e pulinho a ± 10 pontos dele.
  (4) O goleiro fica NA LINHA até o chute também na partida (Regra 14), recalibrando para os ~77,5% de hoje. (5) A cavadinha
  de hoje continua (o 2º aperto do CHUTE antes de o 1º tocar na bola).
- **Os estilos** (`ESTILO_PENALTI.estilos`; `cr.estilo` no plano da corrida, no hash: `partida.js misturarPartida`):
  `normal` (a corrida da P1), `forte` (a corrida longa e rápida — o perfil `penaltiForte` — e a força + `forte.forca` × o que
  falta até 1), `colocado` (a corrida curta e lenta, `penaltiColocado`, e o chute colocado de sempre com o erro ×
  `colocado.erro`), `paradinha`, `pulinho` e `cavadinha` (o 2º toque no CHUTE: `corrida.js estiloNoPedido` marca no contato).
  O estilo vale no CONTATO (`corrida.js baterCorrida` → `estiloNoPedido`): só o pênalti.
- **A paradinha** (`corrida.js guiarCorrida`, `cr.fasePar`: 'antes' → 'freia' → 'pausa' → 'retoma'): com o corpo a
  `pausaEm` + a distância de freada (`distFreio`) do meio do apoio do pé de apoio, freia suave (a velocidade pedida
  √(vPausa² + 2·freio·d)) até abaixo de `abaixo` (1 m/s), fica `tPausa` s a `vPausa` m/s e retoma pela regulagem da passada
  a `vRetoma` m/s. A pausa é sempre ANTES do último apoio (o pé de apoio ainda vai pousar ao lado da bola): a finta depois de
  completada a corrida não existe. A pessoa que aperta a PARADINHA no meio da corrida só a ganha enquanto CABE
  (`cabeEstilo`: a distância de freada + `pausaEm` + 0,2 m pela frente; depois, nada muda). Os passos: antes da freada a
  passada vai no ritmo da regulagem (como a corrida normal: o 1º apoio da arrancada curto); na freada e na pausa, curtos e
  rápidos (`corrida.js saidaCorrida`: o ritmo do começo da freada × `ritmo`; com os dois pés no chão o de trás sai em `saiPe`
  s); a retomada espera o pé de apoio no chão com ≥ `faseRetoma` da fase até o próximo pouso dele — o pé que bate dá o passo
  primeiro e o de apoio pousa ao lado da bola no segundo — até `esperaApoio` s. (01/11: sem os passos curtos o corpo freava
  entre dois pés plantados longe e o quadril caía 0,18 m; sem a espera do pé, o pé de apoio pousava a 0,58 m da bola num passo
  só de ~1,5 m; sem o ritmo antes da freada, a saída caía 0,13 m — o C11 do `teste-corrida-cobranca`.)
- **O pulinho** (`guiarCorrida` `cr.pulo`; `saidaCorrida` `carga`): na última passada (o pé de apoio no ar, pousando no ponto
  dele), o pé que bate pisa (o PENÚLTIMO apoio) e sai do chão cedo — a carga desta passada é `pulinho.carga` (`jogador.js
  passoPassada`: o pé no chão sai em 2·carga da fase) — e os dois pés ficam no ar até o pé de apoio pousar ao lado da bola
  (≥ `voo` s; o ritmo do voo continua o da P1, ≥ `vooMin` × o natural). O salto é só desenho: `anim.js alturaPulinho` sobe o
  corpo h·sen²(π·v) pela fração do balanço do pé de apoio desde o começo do pulinho (`h` = `pulinho.altura`, pelo id).
- **A leitura do goleiro** (paradinha e pulinho: a estratégia que DEPENDE do goleiro). `corrida.js vigiarGoleiro` (antes de
  cada passo da corrida): o goleiro da PESSOA está comprometido com o lado do analógico desde quando o escolheu
  (`ladoPenaltiHumano`, que passou do `partida.js` para o `corrida.js` e segue exportado por ele); o da IA que SAI CEDO
  (`pr.gkCedo` > 0, sorteado na montagem) se compromete com o lado do palpite quando o contato previsto chega a `gkCedo` s.
  O que o cobrador viu até o pé de apoio pousar fica em `cr.gkLido` (`contatoCorrida`). No contato, a IA
  (`partida.js pedidoDaIA(…, contato = true)`): com um goleiro lido, o canto oposto (a `leitura.canto` m do meio, no lado
  aberto) com a chance 0,5 + 0,5·r — r a rampa de `leitura.tempo` sobre o tempo do compromisso ao contato (`rampaLeitura`) — e
  o erro × 1 + `erroTarde`·(1 − r); sem goleiro para ler, o canto que já tinha com o erro × `semLeitura`. A pessoa lê com os
  próprios olhos: na paradinha e no pulinho o analógico mira até o pé de apoio pousar (`partida.js correrCobranca`), e a troca
  de canto (`cr.troca`) erra mais quando tarde (a mesma rampa). A corrida que espera chuta `kd.forca` × a força.
- **O goleiro da IA que sai cedo** (`partida.js prepararPenalti`, três sorteios do m.rng sempre, na mesma ordem: o estilo, se
  sai cedo, quando): a chance pela paciência dele (`goleiro.paciencia` pelo id; `goleiro.cedo` [0,6 → 0,1]; ~34% na média) e
  `goleiro.antes` s antes do contato previsto. Saindo, ele dá o passo para o lado NA linha (`goleiro.js movimentoGoleiro`:
  `goleiro.passo` m; o visto no chute fica a 0,17–0,42 m do meio) e, com o lado certo, o tempo adiantado (até `ganhoMax` s;
  `m.partida.penaltiAberto.cedo`, gravado no `rolou`) soma no tempo para se mexer (`goleiro.js lerChute`: o alcance) e dá
  `ganho` × ele no logit; o goleiro que espera, `espera` no logit. O da pessoa que segura o lado desde antes ganha o mesmo.
- **O goleiro na linha até o chute (Regra 14), também na partida.** `goleiro.js movimentoGoleiro` (`naLinha` com qualquer
  pênalti montado) e `partida.js restricaoPenalti` (a parede: `DISPUTA.goleiroLinha` m, a mesma da disputa; antes a parede o
  deixava ir a 0,6 m e a IA dele ia para a bissetriz); a montagem já o põe a `goleiroLinha` m (antes 0,3).
- **A IA: um estilo por jogador** (`corrida.js estiloPreferido`, puro pelo id e `ia.pesos`; os 5 aparecem nos 46 do elenco) e
  o preferido com a chance `ia.fiel`, o resto normal (`sortearEstilo`, um sorteio do m.rng na montagem; na disputa, na entrada
  do cobrador, para a caminhada terminar no ponto de partida do estilo). O cobrador da IA sai do ponto de partida do estilo
  dele (o perfil); o da pessoa e o da demo, do normal (o estilo da pessoa sai no soltar do CHUTE ou na corrida).
- **Os comandos da pessoa** (`entrada.js`): teclado F = PARADINHA e barra de espaço = PULINHO (fora da cobrança do pênalti da
  pessoa a lógica não os lê; com a pausa aberta o espaço segue o botão em foco), Shift no soltar = forte, E = colocado, K duas
  vezes = cavadinha; o controle na cobrança do pênalti da pessoa (`PAD_PENALTI`, como o pênalti do EA FC: LT = paradinha — o
  "stutter" —, RB = colocado — o "finesse" —, LB = pulinho — o lugar da cavadinha do EA FC, que aqui é o 2º aperto do B —, RT
  no soltar = forte), ligado por `main.js` (`entrada.definirCobrancaPenalti`, a cada passo: o pênalti montado, do time da
  pessoa, com o cobrador controlado); no toque os botões PARADINHA e PULINHO (ícone + nome, vagas d e e: as do PEGAR/TROCAR
  da bola na mão e da CURVA, que não existem nela) aparecem só com a classe `cobranca-penalti` no `#toque` (css/estilo.css);
  nela saem ENFIADA e LANÇAMENTO (da marca a enfiada é o mesmo passe curto do PASSE e o lançamento, uma bola alta de 11 m)
  para o HUD caber no orçamento (≤ 11% em 568×320: com os dois a mais dava 12,0%; assim 10,0%, o mesmo do ataque) — o PASSE
  fica (o pênalti tocado para frente vale) e o teclado e o controle continuam com tudo. Na disputa (Pênaltis 3D), o toque
  mostra o CHUTE e os dois estilos na vez da pessoa (`disputa-tela.js`). `partida.js cobrar`: PARADINHA/PULINHO apertados antes do soltar ficam marcados (`pr.estiloPedido`); no soltar,
  `estiloDaPessoa` (marcado > CORRER = forte > MOD = colocado > normal); na corrida (`correrCobranca`), enquanto cabem. A ajuda
  (index.html) lista os comandos nas três colunas.
- **Online.** Os bits `BOTAO.PARADINHA` (1 << 15) e `PULINHO` (1 << 16) não cabem nos 15 bits de botões da entrada: vão no
  byte 5 (o das marcas), bits 2 e 3 (`online.js F_PARADINHA`/`F_PULINHO`); a mesma conta nos dois sentidos.
- **Não muda:** a saída de bola, o lateral, o escanteio, o tiro de meta e o tiro livre (o jogo da P1: posições, bola e `m.rng`
  iguais aos da d971fe54 do começo ao fim nas 5 partidas do `hash-partida` que mudaram, nenhuma com pênalti; `hash-igual`
  IGUAL — o treino não tem pênalti); a cavadinha (a mesma janela). O VALOR do hash difere DURANTE a corrida de toda cobrança
  (os campos dos estilos entram no hash de toda corrida: o `hash-partida` acusa 5 das 8 partidas, a 1ª amostra diferente nos
  passos 600–12300, a 1ª diferença de verdade nos passos 416–12193, sempre num tiro de meta, tiro livre ou escanteio com
  corrida); o jogo muda só a partir do 1º pênalti.
- **Teste `tools/teste-estilos-penalti.mjs`** (Node, padrão; reprova na base d971fe54: sem os estilos e com o goleiro a 0,62 m
  da linha). 8 estados da partida (sementes 5000–5007) com o gerador ressemeado por cobrança, o cobrador um dos 3 de maior
  finalização do time, a IA com o estilo forçado; 400 por estilo (normal, paradinha, pulinho), 160 (forte, colocado), 120 com
  o goleiro forçado a sair cedo (paradinha, pulinho), em 3 processos. A0 o estilo pedido; A1 forte (pareado): corrida mais
  rápida e bola ≥ +1,5 m/s; A2 colocado: corrida mais lenta, bola ≤ −1,5 m/s, o voo colocado; A3 paradinha: < 1 m/s antes do
  último apoio por ≥ 0,2 s e ≥ 2 m/s no contato, em todas; A4 pulinho: o pé que bate sai por último, os dois no ar ≥ `voo`
  s e o salto desenhado ≥ 8 cm, em todos (o normal com o voo menor em ≥ 90%); B nenhuma finta (abaixo de 1 m/s depois do
  último apoio) em ≥ 1000 cobranças (a IA e a pessoa que aperta a PARADINHA a qualquer hora); C1 contra o goleiro da IA que
  sai cedo o canto oposto em ≥ 60% (binomial); C2 o goleiro da pessoa que segura o lado desde o apito é lido (≥ 60% oposto) e
  o que escolhe depois do pé de apoio não; C3 o passo do goleiro que sai cedo, na linha; D1 o normal ~77% (reprova se prova
  fora de 72–82%); D2 paradinha e pulinho a ± 10 pontos do normal (reprova se a diferença prova fora); D3 informativo (forte,
  colocado e o padrão de Noël 2021); E1/E2 o goleiro a ≤ 0,15 m da linha do apito ao chute na partida e na disputa; F1 as
  teclas, o controle e os botões; F2 a pessoa na partida (cada comando → o estilo e a assinatura dele; a PARADINHA depois do
  último apoio não muda nada); F3 a disputa; G online (os bits na entrada; dois humanos com o pulinho, o mesmo hash); H1/H2 a
  IA (o preferido pelo id, a mesma semente = o mesmo estilo, o preferido com a chance `fiel` ± 0,1, binomial). As guardas
  conferidas por MUTAÇÃO (lista e números na §17).
- **Testes que mudaram.** `teste-corrida-cobranca` C11 com o canhão de estilos (a IA forçada em forte, colocado, paradinha e
  pulinho, cada cena com outro cobrador; a pessoa com PARADINHA e PULINHO) — o C3/C4 também neles; `teste-disputa` B4 (a bola
  rola a ≤ 4 s da montagem) passa sem mudar com a paradinha (a demo bate de 3,82 s no pior); `teste-botoes` B6d (o "fim" é 0,3 s antes do chute — com a corrida, do fim dela —, o cobrador da IA no
  estilo normal e o segurado × o certo no fim PAREADOS, reprovando quando os pares provam) e B11 (120 por mira, binomial);
  `teste-controles` (F/espaço, LT/LB e o toque na cobrança, na página), `teste-hud-minimo` H1 com a cobrança do pênalti, H11 e
  H11b (os botões só nela, a página de verdade), `teste-penaltis-tela` 4a (o CHUTE e os estilos só na vez da pessoa) e a conta
  das bolinhas do item 2 (a janela das 7 rodadas conta a que está por bater: com a disputa mais longa, o teste antigo
  esperava as 7 primeiras e a tela — certa — mostrava as 6 últimas e a vazia).

## Modo Livre — o treino N contra M (16/10; contrato)
Pedido do dono (16/10): "adicione tbm um modo livre, como no fifa, um modo de treino, onde pode ter a quantidade de jogadores
que eu escolher, contra a quantidade de jogadores que eu escolher, pode ser adaptável durante a partida" (a Arena de Treino do
EA FC). `?modo=livre` (sem `?tm`: Golaço FC × Ventania FC), "Modo Livre <small>N contra M</small>" no "Modo de jogo" da pausa
(linha própria; os dois treinos numa `.linha-cenas`: o submenu segue com 5 linhas) e, com `?tm`, o pedido com `modo: "livre"`.
**Sem o Livre nada muda**: `hash-partida`/`hash-igual` IGUAIS contra a base; `livre.js` e `livre-pagina.js` só por import
dinâmico (o download inicial do teste-carga cresce ~7,7 KB, só dos ganchos; 3,99 MB). **Item 64**: com a tela antes do jogo
ligada, ela abre no lugar do submenu Jogadores do começo — as abas Jogar · Jogadores · Câmera (os submenus de sempre; o Voltar
deles volta à tela), o campinho com quem está em campo e "N contra M", sem árbitro nem duração; o N contra M mudado nela vale
já, no mundo do tick 0 recriado (`trocarMundo(…, {antesDoJogo: true})`); no TM o [<] "Voltar ao Total Match" manda `tm3d:fim
{livre}` (contrato "Tela antes do jogo (item 64)").
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
  ação-objeto entra no 1º passo depois da pausa, como a edição do time). A pausa do Livre (desde o item 58: seção "Pausa
  (item 58)"; o HTML e o CSS próprios postos na 1ª vez; 8 linhas no 1º nível, sem rolar de 844×390 a 568×320): Voltar ao jogo;
  Jogadores e Câmera (soltos, com o estado em `small.estado`: "N contra M" e o nome da câmera); a `.linha-par` "Recomeçar"
  (Recomeçar <small>bola no meio</small> | Bola no meu pé — a única linha com dois); Replay; Opções; Modo de jogo; Ajuda — sem
  Editar time, Estatísticas nem Reiniciar; com `?tm`, sem o Modo de jogo e com "Voltar ao Total Match" por último (antes,
  16/10–03/11: ≤ 5 linhas em pares, Continuar | Replay e Jogadores | Câmera). Submenus `.submenu-livre` (níveis da pausa como
  os outros: o Esc e o B voltam ao 1º nível): `#menu-livre` (Jogadores: Meu time e Adversário em linhas empilhadas, cada uma
  com − N + e o Goleiro; Jogar) e `#menu-camera-livre` (as 6 câmeras em 2 linhas de 3, "Altura − N +", "Distância − N +");
  nas Opções o segmentado TV | Aproximada dá lugar ao botão `#opcao-camera-livre` com o nome da câmera (abre o submenu;
  `html.em-livre`). A cara é a da pausa (as variáveis `--p-*` do `estilo.css`).
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
- **Formato:** 9 bytes por entrada (x e z ±1024 em 12 bits, botões 15 bits + `repete`, bits IA e AÇÃO, e — desde o C6 — a
  mira pela tela mx e mz em 12 bits cada; sem `mx`, a do analógico); a entrada LOCAL
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
  anfitrião; desde o item 33, `partida.minutosPorTempo` = a Config "Duração em 3D" DO ANFITRIÃO — o mesmo pedido nos dois
  aparelhos: o `ticksPorTempo` está no hash do lockstep —, nunca a dificuldade, nem as preferências locais do golaço; a pausa do
  online não tem o "Modo de jogo" e o `mudarDuracao`/`definirDificuldade` recusam) ou, nos testes, `?online=<sala>&transporte=bc&lado=0|1` (duas abas pelo BroadcastChannel; `&ia=1` = a IA pelo
  meu controlado o tempo todo). `online.js` e `online-pagina.js` só por import dinâmico (o download inicial cresce só o
  gancho no `main.js`/`hud.js`).
- Transporte: a MessagePort que o TM entrega em resposta ao 'tm3d:pronto' ({tipo: 'tm3d:porta'}; protocolo no topo de
  `legacy-total-match/js/online3d.js`, seção 5) — {t:'j', b} pacote, {t:'c', m} controle ('acao', 'hash', 'pausa',
  'retoma', 'abandono' e, desde o item 30, 'opcoes' do anfitrião — o TM repassa todo controle sem ler: o `online3d.js` não
  mudou), {t:'estado'} da ligação; {t:'religar'} depois de 5 s sem nada.
- `quadroOnline`: só roda o passo com as duas entradas; o MEU replay, a comemoração, a cena de substituição (item 30), a
  minha pausa e o celular em pé seguram só a minha simulação (o outro espera e mostra "Aguardando <nome>…"); menu, Ajuda e o
  editor abertos NÃO param (`pausado()` do online) — a minha entrada vai com o bit IA — nem congelam as cenas, mas nada
  apertado neles as pula ("O menu nas cenas", abaixo). A edição do MEU time vira AÇÃO (canal
  confiável). O hash a cada 60 passos; um pacote por quadro (também no pré-jogo, o curto no online).
- **A cena de substituição no online (item 30, 06/11)**: liga com a opção do ANFITRIÃO ("Cena de substituição" do Modo de
  jogo, a regra local dele: `?substituicao`, a preferência salva, desligada com webdriver/prints/demo, o padrão), mandada pelo
  canal de controle (`{tipo: 'opcoes', subst}`, ao criar a página e de novo no 1º pacote do outro — o BroadcastChannel dos
  testes perde a 1ª; quem recebe só copia) e adotada pelo convidado (`online-pagina.js substOnline`, pura; sem a mensagem, "só
  a faixa": a cena é só desenho, a diferença nunca dessincroniza — no máximo um espera o outro); a preferência e o
  `?substituicao` do convidado não contam. Nunca pelo pedido (a cena não está no hash; a preferência é do GOLAÇO). A faixa
  ENTRA/SAI aparece sempre. Cada aparelho roda a SUA cena segurando só a SUA simulação (`segura = true` + `quadroSubst`, como
  fora do online): o lockstep faz quem acabou antes esperar o outro; o "Pular" pula só a minha; a troca pelo editor do outro
  jogador chega como ação e abre a cena no mesmo tick nos dois. A minha pausa combinada, o celular em pé e a aba escondida
  congelam a cena; o menu, a Ajuda e o editor NÃO (como na comemoração), mas com eles abertos nenhum aperto pula a cena (a
  regra "O menu nas cenas", abaixo — desde o item 129 vale também para o replay e a comemoração). Com a cena, o selo "Conexão instável" fica
  escondido (`html.em-substituicao`, como na comemoração). A espera pela cena do outro não é conexão ruim: o W.O. e o selo
  continuam só pela falta de pacote (na espera os pacotes chegam a cada quadro) e, com a cena, o `quadroOnline` não marca
  "parado" (`quer` 0); o D não sobe por ela (o freio e o D que só sobe agem como na espera pelo replay e pela comemoração).
  As escolhas (S1 a do anfitrião, S2 cada um pula a sua, S3 a troca do outro abre a cena nos dois) e as alternativas estão no
  "Depende do dono" 26 da `FILA.md`.
- **O menu nas cenas (item 30 na substituição; item 129, 06/11, no replay e na comemoração — dono: "corrige")**: no online o
  menu, a Ajuda e o editor abertos não congelam o replay, a comemoração nem a cena de substituição (lá eles não param o jogo),
  mas nada apertado neles as pula: a cena segue andando e só um aperto NOVO, com o menu fechado, pula — como fora do online.
  As ações (`tratarAcao`, `menuDoOnline`) são do menu: P/Start e o Esc fecham (a Ajuda volta ao menu; o Esc chega como
  `menu-voltar`), H abre a Ajuda, Enter aperta o botão em foco (a ação `pular` não faz nada) — antes o P, o H e o Enter pulavam
  o replay e a comemoração e deixavam o menu aberto (ou a Ajuda sem abrir). Os botões do jogo (`quadroSubst`/
  `quadroComemoracao(dt, ent, semPulo)`, `botaoPula(botoes, semPulo)`) contam como segurados enquanto `semPulo` = o menu, a
  Ajuda ou o editor abertos AGORA ou no fim do quadro anterior (`menuAntOn`: o A do controle que aperta "Voltar ao jogo" fecha
  o menu DENTRO do `entrada.ler`, antes do `quadroOnline` — sem o quadro anterior, o mesmo aperto pulava a cena); só pulam
  depois de soltos e apertados de novo. Num quadro sem passo (a cena segura a minha simulação) os pulsos que o menu segurou
  saem (`entrada.limparPulsos()`, como na cena do cartão): preso, o pulso de um toque deixava o bit sempre "segurado" e o
  aperto novo do mesmo botão não pulava a cena. Fora do online nada muda (lá o menu congela as cenas: `pausado()`). Só
  página: o fecho do hash não muda.
- **A marca E_CENA (item 30)**: o bit 64 do byte 19 do pacote (`online-pagina.js E_CENA`; o `online.js` não o lê; sobra o
  128) = este lado segura a SUA simulação por uma cena (a substituição, um replay, a comemoração no gol + 149), do quadro da
  cena até o 1º passo rodado depois dela (`marcaCena`, pura: o quadro em que a cena acaba sai sem passo e sem entrada nova) e
  só com a cena andando (sem a minha pausa e sem o celular em pé). O texto de baixo do aviso de espera (`textoEspera`, puro):
  com os pacotes do outro chegando, o motivo dele — "{nome} ainda está antes do jogo." / "no pré-jogo." / "ainda está vendo a
  cena." (E_CENA) / na espera longa sem motivo conhecido "{nome} ainda não voltou ao jogo." —; "A conexão parou. Se não
  voltar, vocês podem encerrar." só sem pacote há 5 s (antes aparecia em toda espera longa, também na do replay e da
  comemoração do outro). Com a entrada do outro para o meu próximo passo já chegada, a espera acaba no MESMO quadro
  (`conexaoNoQuadro`, puro: o `paradoDesde` só zera depois do passo — sem isso o aviso ficava um quadro a mais e piscava
  "ainda não voltou ao jogo"). W.O. e o selo continuam só pela falta de pacote.
- **Antes do 1º passo** (item 64; contrato "Tela antes do jogo (item 64)", parte Online): os dois veem a tela antes do jogo com
  "Pronto" · Visão tática; a fase de cada lado vai no byte 19 de todo pacote (bits da página `E_TELA`/`E_PRONTO`/`E_PREJOGO`; o
  `online.js` intocado) e os dois saem juntos para o pré-jogo quando os dois estão prontos; o 1º passo continua decidido pelo
  lockstep. Com a tela aberta, `PAG_ONLINE.quadro(agora, {antes: true})` (só abandono, ligação fechada e 5 s sem pacote
  valem); no jogo, com pacotes chegando e o outro ainda na tela ou no pré-jogo, o aviso de espera diz "{nome} ainda está antes
  do jogo." / "{nome} ainda está no pré-jogo." no lugar de "A conexão parou". Sem Personalizar no online (v1; item 107).
- Avisos (`#online-aviso`, no meio da tela; `#online-selo` "Conexão instável" no canto de cima à direita, dentro de `--sa-r`/
  `--sa-t`, e fora de cena com a pausa aberta — o X da pausa mora nesse canto): "Aguardando <nome>…", "Pausado por
  <nome> · 0:52", "Você pausou" com "Continuar a partida" e a contagem de 3 s, "<nome> saiu da partida. Vitória por W.O.",
  W.O. oferecido (não automático) depois de 90 s sem nada do outro ("Esperar mais" adia 60 s), dessincronia ("Os dois
  aparelhos ficaram diferentes por um erro do jogo… nada conta").
- Pausa do online: "Pausar a partida" (3 por jogador, até 60 s cada; só quem pausou retoma) e "Sair da partida" (dois
  toques — o 1º arma por 3 s com "Toque de novo: sair", curto para caber com o foco no PC e em 667×375; 'abandono' ao outro e 'tm3d:sair' {abandono: true} ao TM = derrota); sem Replay da pausa, Simular o resto,
  Reiniciar e Modo de jogo/Cenas (a cena de substituição vale desde o item 30: a opção do anfitrião, acima). Fim: 'tm3d:fim'
  {resultado (a súmula: a mesma nos dois), online: {hashFinal | wo: {vencedor, motivo} | dessinc}} (`fimTM(resultado, extra)`).
- **Teste `teste-online-tela`** (navegador, CI e deploy): duas abas do mesmo Chromium jogando a mesma partida (IA nos dois
  lados): P1 andam, P2 os hashes iguais (0 de 12), P3 a pausa de A para os dois, B mostra "Pausado por", depois seguem
  iguais, P4 o menu aberto não para, P5 a partida inteira (?min=0.25) acaba igual nas duas (0 de 36), P6 a pausa do online
  em 844×390 sem rolar, P9 (item 58: o Pausar depois do Voltar ao jogo e o Sair por último, os dois por `aoTocar`) o Pausar
  pelo toque pausa e o Sair arma com outro dedo no analógico, 0 erros; P8 (item 30; `--so p8`; duas sessões próprias de
  568×320, a semente achada em Node com as duas trocas cedo — hoje a 16, tick 380 —, cada aba pede a troca do SEU time):
  P8a a escolha do anfitrião nos dois (A `?substituicao=1`, B `=0`: as duas abrem a cena no tick do Node, 2 pares, a faixa),
  P8b cada aba segura só a sua (0 passos com a cena) e a cena anda, P8c o "Pular" de A só pula a dele (A espera parada ≤ o
  passo de B + D + 2, com "Lado 1 ainda está vendo a cena", nunca "A conexão parou", W.O. nem o selo por ≥ 1 s), P8d hashes
  iguais, P8e desligada no anfitrião (nenhuma cena, só a faixa, hashes iguais) e, da revisão, P8f o menu de A aberto na cena
  (a cena anda; nem o J segurado nem o H a pulam, o H abre a Ajuda), P8g B em pé na cena (a de B congela; A não lê "vendo a
  cena"), P8h o fim da espera sem piscar "ainda não voltou ao jogo" e P8i o selo aceso à força na cena com display none; P10
  (item 129; `--so p10`; uma sessão de 568×320, a semente achada em Node com o 1º gol cedo do time de A — hoje a 62, tick
  1239 —, A com `?comemoracao=1&replay=1`, B com os dois desligados): o menu de A aberto (pela API) em cada cena, uma tecla
  ou botão por vez com o menu reaberto antes — P10a a comemoração (P fecha o menu; J segurado, H, Esc, Enter e o A do
  controle de mentira `window.__pad`: a cena segue andando) e P10b o replay do gol (A, Enter, H, Esc, J, P; o J depois do
  H, cujo `soltarTudo` limparia o pulso dele: sem o `limparPulsos` o pulso preso reprova no replay sempre, que segura a
  simulação o tempo todo — na comemoração só depois do gol + 149), cada um com um J novo que pula depois, com o menu
  fechado; P10c hashes iguais (na base o P pulava a comemoração e o A, o replay). O
  `teste-online` O13–O15 (as funções puras), o `teste-replay-paradas-tela` V8b (a espera pelo replay do outro: "vendo a
  cena", nunca "conexão parou", sem piscar) e o `legacy-total-match/ferramentas/testar-online3d.mjs --golaco` G1c (a Ana
  com a cena ligada e o Bruno desligada: `ligada()` verdadeiro nos dois quadros, pela porta do TM) completam. (O Chromium sem
  GPU daqui desenha ~6 quadros/s com duas abas: o teste espera passos, não tempo.)

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
- **A mão de apoio do carrinho** (item 77: "a mão de apoio do manequim deitado fica 0,073 m acima do chão"; SÓ DESENHO —
  a pose do jogo, `anim.js poseCarrinho`, não muda): `js/render/apoio-mao.js` (puro, sem alocar; `APOIO_MAO`):
  - `pesoApoio(pose, lado)`: um peso contínuo 0–1 pela POSE (as cenas e o replay desenham pela pose) — o produto das
    rampas da pelve baixa (`pelve` [0,25; 0,55] m), da mão baixa (`mao` [0,14; 0,45] m), do antebraço quase deitado
    (`ante`/`sobe`), do tronco de costas até ~65° (`tronco`: o cosseno [0,26; 0,42]; deitado de lado ou de bruços = 0), do
    cotovelo dobrado (`dobra`) e das mãos separadas (`maos`: juntas = a bola nas mãos = 0);
  - `maoNoChao(pose, out, lado, w, alvoY)`: a mão desce ATÉ `desce` (0,1 m, teto macio de ±`joelho` 0,025) além da do jogo
    — não "até o chão pelo peso": assim ela anda junto da do jogo na queda e no levantar (R1 da revisão: ia ao chão de
    estalo, o dobro do pico da base) — e nunca além de `alcance` (0,95) × braço + antebraço do ombro (o piso entra macio:
    `joelhoAlcance` 0,04); o cotovelo sai da IK de dois ossos com os mesmos comprimentos, do lado do de antes;
  - manequim (`jogador3d.js poseDoManequim`, também a `poseDesenhada`): a ponta da mão ao raio da cápsula + 3 mm;
  - corpo novo (`esqueleto.js postura`): o punho a 0,04 m e a PALMA virada para o chão (`palmaNoChao`; a normal da palma
    no descanso sai da leitura do corpo, `corpo-dados.js lerCorpo` → `repouso.palma` {E, D}, pela menor variância dos
    vértices da mão): 70% da pronação no osso do antebraço e o resto, com a dobra, no punho (100% no antebraço murchava o
    cotovelo a 86%; 50%, o punho a 89%).
- **Manga comprida** (goleiro e técnico): a região de pele com o peso do braço INTEIRO abaixo da clavícula (braço,
  antebraço e o ajudante do cotovelo: `vMembro.x`) > 0,5, como o manequim — só com o antebraço sobrava uma faixa de pele
  entre o punho da manga curta e o cotovelo (R2 da revisão do item 77).
- **A cabeça sem o mapa de normais do pano** (item 62: "linha escura na nuca"; 06/11): a linha não era a costura da UV.
  O `pano-normal.webp` é do CORPO e, lido pela UV da cabeça, punha um arco escuro de orelha a orelha, uma faixa e um "V"
  na nuca e rugas no rosto: a troca `mapN.xy *= normalScale;` no `onBeforeCompile` não achava o trecho (ali os `#include`
  ainda estão FECHADOS; o `WebGLProgram` os abre depois) e passava calada. Agora o `#include <normal_fragment_maps>` sai
  pelo trecho aberto (`THREE.ShaderChunk`, `NORMAL_MAPS_F`) com `mapN` = (0, 0, 1) na cabeça (`vParte`: normal = `tbn[2]`
  = a normal da malha); o corpo fica com o pano como antes. Toda troca no texto do shader passa por `trocar()`, que avisa
  no console quando o trecho não existe (o C8 pega); `customProgramCacheKey` 'humano-v3'. Antes → depois (o mesmo quadro
  com e sem o mapa de normais, `teste-corpo-tela` C9/C9b): o occipital |ΔL*| p99 5,6–7,9 de costas e 9,5–13,5 a 3/4 → 0;
  a nuca até a gola 22,1 → 0. Fica (informativo no C9b, igual na base): a costura do MEIO da ilha da cabeça (u ≈ 0 / u ≈ 1),
  um degrau de ~2–3 L* do alto do cabelo à gola, só de perto — o caminho é um pós-processo nas texturas pelos 24 pares
  da costura (contrato "Rostos reais", Malha).
- **Testes**: `teste-ossos` (Node: juntas ≤ 1 mm, saltos ≤ 0,03%, sola 0–1,5 cm em ≥ 95% do apoio, volume ≥ 85% a 90°,
  assets, O7 postura: joelho parado ≤ 20°, disparada muda ≤ 3°, tronco correndo ≤ 17°, nada no ar/mãos juntas/pés; O8 a
  mão de apoio só no chão — IA × IA, comemorações, os mergulhos do goleiro e o tronco deitado com peso 0, as sondas das
  guardas da pelve e do tronco no deslize do carrinho; O9 a manga comprida cobre o braço), `teste-carrinho` P6 (a mão de
  apoio no chão no deslize nos dois corpos, a palma, o punho, a seção da pele e a continuidade por fase),
  `teste-lod-humano` (Node), `teste-corpo-tela` (navegador, CI: todos desenhados, chamadas ≤ manequim + 1, teto de
  triângulos, nada baixado sem `?corpo=humano`, 0 erro; C9/C9b a cabeça e a nuca até a gola sem o mapa de normais).

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
- **A nuca** (item 62, 06/11; contrato "Corpo humano realista"): a linha escura na nuca vista de costas (no túnel e na
  fila do pré-jogo) era o mapa de normais do PANO do corpo aplicado à cabeça, não a textura do rosto: a cabeça usa agora
  a normal da malha, com e sem rosto real. Nenhuma textura de rosto mudou. O rosto e a cabeça base leem por `textureLod`
  com o nível da derivada do topo do shader (`lodUv`; a regra das derivadas no contrato dos patrocínios): o mesmo mip do
  `texture()` de antes (C11a), sem o custo do `textureGrad` nas GPUs de celular. Fica a costura do meio da ilha da cabeça
  (u ≈ 0 / u ≈ 1; ~2–3 L* de perto, igual na base): o mesmo método da linha do alto (os tons dos dois lados da costura),
  agora no pós-processo das texturas, ainda por fazer.
- **Testes**:
  - `teste-rostos-reais` (Node): índice completo; WebP 512² ≤ 64 KB, nenhuma sobrando; licença livre e créditos; a chave
    é a foto do TM; tom de pele (L* 20–80, matiz 30–75°); foto de frente e neutra; pasta ≤ 8 MB;
  - `teste-corpo-tela` C4: num pedido pro, cada jogador com rosto pede e carrega a textura;
  - `teste-corpo-tela` C5: na pública, nada é pedido;
  - `teste-corpo-tela` C9 (a câmera a 1 m atrás e a 3/4 atrás da cabeça de um jogador com rosto real, o mesmo quadro com e
    sem o mapa de normais: |ΔL*| p99 ≤ 2 no disco da cabeça) e C9b (a 0,8 m atrás do pescoço, só nos pixels da parte da
    cabeça, até a gola; a emenda cabeça–corpo e a costura do meio informativas). Os dois reprovam na base 7cb052ad.

## Patrocínios nas camisas reais — SÓ a versão de teste (22/10; contrato)

Dono, 22/10: "pode botar os patrocinadores sim, lembra que é só aquele teste? vamos tirar dps". Só na edição **pro**,
junto com as camisas reais. Na pública, o `patrocinios.json` nem é baixado. Para TIRAR: apagar
`assets/tm/patrocinios.json` e `assets/tm/patrocinios/`. Sem a base, `comCamisasReais` não põe `decais` e o shader não
desenha nada.

- **Pesquisa** (`tools/patrocinios/pesquisa/<clube>.json`, com as fontes): o máster e os outros patrocinadores da camisa em
  outubro de 2026, cada um com a posição, os uniformes, a cor na camisa e a largura relativa, mais a marca do fornecedor.
- **Gerador** (`tools/patrocinios/gerar.mjs <pasta da pesquisa com os logos>`, Chromium): cada logo (SVG ou PNG) vira a
  MÁSCARA branca em `assets/tm/patrocinios/<clube>/<marca>.webp`, de 512 × 256, com o desenho recortado e centrado, e passa
  pela BORDA (abaixo) antes de gravar.
  - Logo sem transparência: a máscara é a distância à cor da borda.
  - Logo com forma cheia e texto dentro: o texto sai vazado (Otsu do brilho; a forma é a cor da borda).
- **Borda** (item 63, "retângulos tracejados brancos em volta dos números e patrocínios"; `tools/patrocinios/borda.mjs`,
  conta pura no canal alfa, `BORDA = {margem: 8, nevoa: [36, 72], desenho: 8}`):
  - a NÉVOA sai: α ≤ 36 vira 0, rampa contínua até 72 (a mistura do shader é em cor linear: α 12 de branco numa camisa
    preta já leva o L* de 0 a 25);
  - nada FORA da caixa que o shader recorta (`caixaDoShader(asp)`, o centro com a proporção do decalque);
  - o desenho (α > 8) a ≥ 8 px (2³: limpo até o mip 3) da borda da caixa: ele ENCOLHE em volta do centro pela `escala` s
    (filtro de área) e o jogo alarga a caixa por 1 ÷ s — o logo fica do mesmo tamanho na camisa e perde até 1 − s da
    resolução (hoje s de 0,72 a 1, mediana 0,92).
  - As máscaras já publicadas (os logos de origem não estão no repositório) passaram pela mesma conta em
    `tools/patrocinios/refazer-bordas.mjs` (`--conferir` só mede). A rampa da névoa NÃO é idempotente: só passa uma vez por
    logo — o registro `bordas` do índice diz quais já passaram (o refazer pula esses; rodar de novo não muda nada). Máscara
    nova fora do gerar.mjs tem de passar pelo `prepararMascara` e entrar no registro.
- **Índice** (`assets/tm/patrocinios.json`): `{clubes: {<nome de uniformes.json>: {casa|fora|terceira|goleiro: [{logo, asp,
  pos, lado, larg, cor, nome, escala?}]}}, cheio: {logo: fração cheia}, bordas: {logo: escala}}` — `escala` (ausente = 1) é
  a da borda, igual à do registro `bordas`.
  - `pos` ∈ peito, ombro, manga, barra_frontal, acima_numero, abaixo_numero, calcao, fornecedor.
- **Caminho**:
  - `render/identidade-pagina.js carregarUniformes` baixa junto (só na pro).
  - `identidade.js comCamisasReais` põe `decais` (com a `url`) dentro de cada kit real.
  - `render/jogador3d.js linhaKit` escreve até 6 decalques nas linhas 17–28 do kit (`TEXELS_KIT` 32):
    - A = [camada do logo, posição, largura em m, largura ÷ altura]; B = [cor, lado];
    - a largura relativa é da frente do tronco (0,34 m), com um teto de altura por posição; a caixa escrita é a largura ÷
      `escala` (a margem da borda fica fora do logo);
    - a ordem quando passa de 6: peito, fornecedor, acima do número, manga, ombro, calção, barra, abaixo do número;
    - a cor que some no tecido vai para o contraste.
  - `render/humano3d.js`:
    - as máscaras ficam numa `DataArrayTexture` R8 de 40 camadas (`logoDe(url)` pede na 1ª vez; só a camada nova sobe);
    - o shader projeta cada decalque PLANO na posição de repouso, só na face virada para o plano (a normal de repouso pela
      derivada da tela), na região certa (camisa, manga, calção);
    - SEM DERIVADA DENTRO DE DESVIO (item 63; GLSL ES 3.00 §8.9: a derivada implícita em fluxo não uniforme é indefinida e a
      GPU de verdade pega um mip qualquer nos quads da borda da caixa — o tracejado): `dFdx`/`dFdy` da posição de repouso
      e da UV saem no TOPO do `COR_F` (`gRx`, `gRy`, `gUx`, `gUy`); logos e dígitos leem por `textureGrad` com o gradiente
      analítico de cada projeção; a cabeça (rosto e cabeça base, sem anisotropia) por `textureLod` com o nível da mesma
      derivada (`lodUv`: o `textureGrad` é mais lento nas GPUs de celular); os `fwidth` dos padrões e do meião pela `fwR`.
      Nenhum `texture()` nas texturas com mipmap nem derivada nas funções ou depois do 1º `if` do `COR_F` (o `tReg` é sem
      mipmap). Toda troca no texto do shader passa por `trocar()` (avisa no console quando o trecho não existe: o
      `onBeforeCompile` vê os `#include` FECHADOS).
- **Testes**:
  - `teste-patrocinios` (Node):
    - todo clube com camisa real tem decalques;
    - logos 512 × 256 ≤ 48 KB, nenhum sobrando, ≤ 2 MB;
    - os decalques entram nos kits só com a base;
    - no máximo 3 máscaras viram mancha;
    - P6 a regra das derivadas no texto do shader; P7 o registro `bordas` e as escalas.
  - `teste-corpo-tela` C6/C7: na pro, os logos carregam; na pública, nada é pedido. C10: as 161 máscaras lidas como o
    jogo lê (margem ≥ 8 px, névoa ≤ 0,25%, nada fora da caixa). C11: o mesmo quadro com o shader de sempre, com a derivada
    implícita (`textureGrad`/`textureLod` → `texture()`) e com a caixa cheia/vazia — longe da borda das caixas o de sempre
    = o implícito (os gradientes analíticos e o nível da cabeça certos); na faixa de ±2 px da borda de cada logo o
    implícito mostra o defeito (pontos e blocos; ≥ 5 px) e, nos pontos que ele escurece, o de sempre é a camisa. O C11b
    depende de o navegador do teste MOSTRAR o defeito com a derivada implícita (o SwiftShader mostra parte: o ponto no
    canto da caixa e a linha pontilhada na manga): se deixar de mostrar, reprova — rever a régua, não o shader.
  - Na base 7cb052ad reprovam o P6, o P7, o C10 e o C11b.
- **Antes → depois** (item 63, 06/11): máscaras sem a margem 161/161 (pior −0,9 px) → 0 (pior 8,0 px); com névoa 16 (pior
  39,9% da caixa) → 0 (pior 0,21%); `texture()` com mipmap e derivadas fora do topo no shader 4 e 8 → 0; a cópia do shader
  com o desvio achatado, no túnel do pré-jogo: 197 e 247 px de traço claro (ΔL* médio +40–44) → 1 e 0. A pasta das
  máscaras 1285 → 1338 KB (≤ 2 MB; só na pro). Chamadas e triângulos iguais aos da base (as mesmas leituras;
  `teste-corpo-tela` C1/C2: humano 27 × manequim 26, celular 26.071 e PC 26.970 triângulos). Fica: a prova
  numa GPU de verdade (um print do túnel no aparelho do dono) e o custo do `textureGrad` dos logos e dígitos numa GPU de
  celular (só a CPU foi medida: igual); os 29 logos com `escala` < 0,85 (o menor 0,72) um pouco mais macios de perto (o
  LUBRAX, 0,77: −15% de nitidez no close de 1,5 m; igual a 8 e a 20 m) — recuperar pede os logos de origem ou máscaras
  maiores só para eles ("Depende do dono" 27 da FILA).

## Cenas das paradas — replays nas paradas, cartão, intervalo e pós-jogo (22/10; contrato)
(A camada da passada nos atores — `a.mp`, `a.vm`, `a.wm` — está no contrato "Passada natural fora da partida (item 61)", no fim.)
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
    'trave', 'amarelo', 'faltaPerto', 'espalmada', 'bloqueio', 'passouPerto', 'chuteFora' (peso 7, 6, 5, 4, 3, 2, 1,5, 1,
    0,5). Chance (`ehChance`: o P2 atrás do gol): 'trave', 'espalmada', 'bloqueio', 'passouPerto', 'chuteFora'.
  - Classe A (pênalti; vermelho, também o 2º amarelo; bola na trave com a bola morta em ≤ `chance.mortaAte` s) fura o
    teto e o espaço. Classe B fica dentro de `porTempo` por tempo e de `espaco` s de bola rolando desde o último replay
    automático:
    - amarelo;
    - 'faltaPerto' (28/10): tiro livre direto com a cobrança a ≤ `faltaPerto` m (= `BARREIRA.longe`, 33) do centro do gol
      atacado, do ponto da bola — onde o jogo monta a barreira (`bolas-paradas.js barreiraDoTiroLivre`, a mesma conta);
      o "Direct free-kick" do SoccerNet-v2 (com intenção de gol ou com barreira): a TV o repete na parada em 74,3%
      (1609/2166). Antes: ≤ 25 m do ponto da falta, sem fonte;
    - 'espalmada': chute de dentro da área ou a ≥ `chance.vMin` m/s espalmado, sem ninguém tocar antes (no alvo que vira
      escanteio: 82%, 687/836);
    - 'bloqueio' (28/10): o mesmo chute com o 1º corpo depois dele (`bateuCorpo`, também no MESMO passo do chute, depois
      dele na lista: o bloqueio da perna do `sim.js bloqueioPerna`; antes de qualquer defesa) de um adversário de linha —
      a barreira conta — e a bola morta em ESCANTEIO (fora do alvo que vira escanteio: 66%, 298/454; o chute de tiro
      livre direto que vira escanteio: 68%, 27/40). O desvio que vira lateral ou falta não (a fonte não cobre);
    - 'passouPerto': chute de dentro da área que cruzou a linha a ≤ `chance.perto` m da armação, sem ninguém tocar;
    - 'chuteFora' (28/10): chute de DENTRO DA ÁREA que saiu pela linha de fundo sem ninguém tocar (o último toque da
      partida, `partida.ultimoId`, é o de quem chutou) e virou TIRO DE META (fora do alvo que vira tiro de meta: 72%,
      2551/3560; o tiro de meta com um chute nos 15 s antes: 69,0%, 2583/3742). A fonte cobre todo chute fora, de
      qualquer distância, mas o orçamento do ar do dono (≤ 16% com 3,5 gols por partida) não comporta o forte de fora:
      com o critério da espalmada (área OU ≥ `chance.vMin` m/s) o teto do ar ia a 15,8 / 15,9 / 16,3% nas sementes 1–48,
      201–248 e 301–348 (só da área: 15,5 / 15,5 / 16,1%; `PLANO-CENAS.md` §2.7). O jogo repete 35–52% desses tiros de
      meta (a TV, 69,0%).
    Todas as chances com a bola morta em ≤ `chance.mortaAte` s do chute e sem o goleiro segurar. Fonte das taxas:
    SoccerNet-v2, rótulos públicos (Labels-v2 + Labels-cameras, 498 jogos), `PESQUISA-CENAS-TV.md` §4.
  - Nunca: lateral ou tiro de meta sem lance; chute que bateu no corpo de outro antes da defesa como espalmada, "passou
    perto" ou chute fora (só a trave vale; o do adversário de linha vira 'bloqueio' se a bola morre em escanteio); defesa
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
  (navegador, CI; V1–V11). (28/10) No P1 o árbitro acha o 1º contato depois do chute pela CINEMÁTICA da bola (no passo
  do chute, a bola fora do rumo do pé `cond.ult` ou mais lenta que o chute; depois, a bola que foge do voo livre do
  `passoBola` numa cópia; quem tocou é o mais perto) — não pelo `bateuCorpo` que o classificador lê — e a falta perto
  pelo evento 'barreira' da montagem (a conta tem de bater com ele em todas). (28/10, decisão do dono) O P3: ≤ 3 de classe
  B por tempo, ≥ 30 s de bola rolando antes de cada um e um por parada (ficam); ≤ 5 por partida (o piso de 2 SAIU: não
  tinha fonte); o ar em replay 8–16% com 2,3–3,5 gols por partida, reprovando quando a amostra prova (28/10: o teto
  acima de 16% ou o piso abaixo de 8% por mais de 1,645 erros-padrão ENTRE PARTIDAS — a linearização de Taylor, como a
  fidelidade —, nunca abaixo do piso das durações, o erro que sobra com o mesmo número de replays em toda partida; a
  meta não muda. Nas 4 amostras de 48 — 1–48, 201–248, 301–348, 401–448 — o teto dá 15,52 / 15,52 / 16,07 / 16,07% no
  goleiro realista e 15,61 / 15,91 / 15,69 / 15,70% na main de 28/10, erro-padrão 0,30–0,38: as duas na borda, e a
  comparação pontual reprovava por sorteio — a branch em 2 das 4, a main em ~1 de 5 amostras de 48); e a FIDELIDADE À TV
  POR SITUAÇÃO — os replays de parada ÷ os que a TV faria nas
  mesmas bolas mortas, cada uma pela taxa do SoccerNet-v2 da situação dela (o recomeço com cartão / com chute nos 15 s
  antes / sem nada: `TV_SIT`, `PESQUISA-CENAS-TV.md` §4 "Por situação", `tools/pesquisa/soccernet_situacao.py`) — ≥ a da
  VERSÃO PUBLICADA na mesma amostra (a regra "sem recuo"), reprovando quando a contagem prova (z < −1,645 com o
  erro-padrão entre partidas, nunca abaixo do binomial). `FID_MAIN` = a da versão publicada na amostra padrão (48
  partidas, sementes 1–48): 66,0%, a do goleiro realista (C1), que entrou com 66,0% contra 57,6% da main de 28/10 (z
  +1,65); é atualizada a cada entrega que mude a partida, como o hash de referência. No CI do PR que a atualiza o z dá
  ~0 (a régua já é a própria versão nova); a prova contra a versão de antes fica nas medições registradas
  (`PLANO-CENAS.md` §2.7: as 4 amostras com o `--fid-main` da main de cada uma). Outra amostra: `--fid-main` (a versão
  publicada: 70,1% em 201–248, 70,6% em 301–348 e 62,0% em 401–448). O P2 confere os planos com o anel do momento do
  roteiro (`lib/paradas-node.mjs` `espera.anel`: o passo depois do replay já gravou mais um; na página a simulação fica
  parada e o anel não anda).

### Cena do cartão (PR 2; dono, 22/10: "as cenas de cartões")
Porte da branch `golaco/cenas-jogo` (1df2ca34) para fora do fecho: `js/cenas-config.js` (`CENAS`, `CENA_CARTAO`,
`CAMERA_GERAL`; importado só pelos módulos sob demanda — nem o `main.js` nem a simulação o importam), `js/cena-atores.js` e
`js/cena-cartao.js` (puros), `render/cartao3d.js`, `js/cenas-tela.js` + `css/cenas.css` — tudo pelo `SOB.cenas` do
`main.js` (pré-carga no 1º gesto ou ociosa, como o replay e o editor; `tools/teste-carga.mjs SOB_DEMANDA_ARQ`).
- **`js/cena-atores.js`** (puro; nada alocado por tick, sem rng):
  - O árbitro e os assistentes (`criarJogador` 200–202, posição 'ARB', kit 'arbitro'); `adicionarNovo` (os treinadores).
  - `passoAtores` na ordem do `passoCena` da comemoração (desejo → `passoCorpo` → separação → `passoPassada` →
    `passoPeDesenhado` → quadril → pose + gestos); quem para e fica plantado `CENAS.parado` ticks fica FIXO, respirando.
    Separação (`separarCena`, centros a ≥ `CENAS.separacao`): cada um cede `a.cede` (0 = o fixo, o punido, o treinador);
    quem não cede e chega num FIXO que cede quando anda: o fixo volta a andar (`soltar`) e sai — nunca os dois parados um
    dentro do outro.
  - O FIXO NÃO ANDA (27/10): ele é desenhado pela pose de base (a da locomoção no tick em que fixou + respiração e gestos,
    que não mexem a pelve na horizontal), então o `j` dele só muda depois de `soltar` — quem a cena leva sozinho (a
    pré-rolagem do capitão depois do `assentar` da vantagem que virou gol, o `isolar` do IFAB) é solto antes. O
    `teste-cenas` confere em toda cena de A, A-L, C e F-fim a pelve desenhada de cada fixo a ≤ 0,10 m do `j` em todo tick
    (a pose a põe a ≤ 2,5 cm; antes o capitão ficava desenhado a até 8,7 m do corpo a cena inteira e saltava ao soltar).
  - `desviar(c, a, d, contorna = true)`: além de quem está à frente, a bola parada do cartão (só `a.bolaMin > 0`; o fim de
    jogo zera) é contornada pela TANGENTE de um círculo `CENAS.bolaContorno` m além do de `marcarBola` (`contornarBola`;
    olha até `CENAS.bolaOlha` m além dele; o círculo não passa do destino — `d.dist`, posto por `irPara`/`para` e pelos
    desejos que escrevem o `c._d` à mão —; dentro dele a tangente abre até `CENAS.bolaAbre` rad para fora). Raspando o
    círculo do `separarDaBola` a ~2,4 m/s, o pé que ficou plantado do lado da bola cruzava por cima dela no passo seguinte
    (o pé a 0,09 m do centro). `contorna` = false para o capitão do A1/V2 (`pontoApoio` já dá a volta nela).
  - `recriarAtor` (ELIPSE: só no tick de um corte); `escolherVariante(tick, id, ultima, disponiveis, penultima)` (hash;
    nunca a anterior).
  - Os gestos (`gTiraAmarelo`, `gTiraVermelho`, `gCartao` — braço reto, a mão ≥ 0,25 m acima do topo da cabeça —,
    `gAponta`, `gAnota`, `gAfasta`, `gApito`, `gAbertos`, `gCabeca`, `gDesculpa`, `gSegura`, `gTapinha`, `gAbana`, `gRosto`,
    `gPalmasAlto`, `gCintura`, `gJoelhos`, `gAperto`) e as posturas (`posturaCabisbaixo`, `cabecaCeu`, `balancaCabeca`).
  - A câmera: `camValida`, `custoCamera` (a lente longe de onde cada um está, de onde vai parar e do caminho até lá),
    `melhorCamera` (sem candidata livre, a de maior folga até o CAMINHO de cada um — de onde está até onde vai parar —, como
    no `custoCamera`; 28/10: só pela posição de agora, quem vinha correndo passava na lente), `fugirDaLente`,
    `caberNoQuadro`, `definirPlano`/`definirPlanoGrupo`.
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
    punido a < `ifab` m do árbitro (A1, V2). A lente do plano do árbitro: 18 candidatas a `camera.arbitro.dist` m (± 0,8) do
    ponto onde ele para, a ± `ang` rad da direção da parada; sem nenhuma livre, a 2ª fileira — as mesmas direções
    `camera.arbitro.fileira`× mais longe, com o fov fechado na mesma razão (28/10, a receita do `cena-fim.js
    melhorComFileira`: o capitão do V3 do goleiro expulso que vinha a 8,7 m/s freava a 0,43 m da lente). Quem sai da reta
    árbitro–punido guarda o lado (`a.sgAfasta`) até terminar de
    sair (27/10: o árbitro para onde o punido parou, a até ~1,4 m do ponto do plano, e quem estava a meia distância dos
    dois trocava de referência e de lado a cada passo, indo e voltando a ~3,1 m do árbitro).
  - A bola parada do mundo (a página a desenha no lugar do apito): ninguém da cena passa por cima dela — o centro de cada
    ator fica a ≥ `CENAS.bola` m dela (quem começou mais perto, no máximo onde estava: `marcarBola`/`separarDaBola`), o
    desvio a contorna pela tangente (`contornarBola`) e o árbitro não para em cima dela.
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
    rolando. É uma exceção escrita à "sem narração" (como a faixa ENTRA/SAI, o selo IMPEDIMENTO/POSIÇÃO LEGAL, o nome do
    condutor e o cartão do autor do gol na comemoração — item 31 —, que nunca fica junto dela: `teste-cenas-tela` C11). O
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
  parte `cartao` (navegador, CI e deploy; C6b, C11b, C12b, C12c e o C4 em 560×400 desta revisão). A amostra troca sem mexer
  no padrão do CI (27/10): `--estados s:t,...` (os estados do meio do A, A-L, E e G), `--sem-c N` (o canhão C) e
  `--sem-fim N` (o F-fim); a da revisão de 27/10 está no cabeçalho do teste. O "fixo no lugar" vale nos quatro canhões, e o
  "a bola do apito no ar cai" do C conta só a bola VIVA (a das mãos do goleiro fica fora do desenho e sem física).

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
  treinadores pelo gancho `tecnicos.js treinadorDoTime` (cópias; os vivos parados), cada cópia a ≥ `CENA_FIM.treinadores.margem`
  (0,6 m) das bordas da área técnica do time (31/10, C7: o vivo RECUADO para não tapar a TV, z 39,2, ou na esquiva fica mais
  perto da borda; a cena começa num corte e a cópia entra por dentro, parada; também no fim de jogo).
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

## Tempo de jogo e dificuldade (item 33, #618; 05/11; contrato)

Pedido do dono (17/10): "editar o TEMPO de jogo e a DIFICULDADE (na pausa/antes do jogo e vindo do TM pelo pedido)". Pesquisa em
`PESQUISA-DIFICULDADE.md` (EA FC 24–27, eFootball, FC Mobile e a literatura de ajuste de dificuldade). **Com a duração e a
dificuldade padrão (4 min, Normal) nada muda**: `hash-igual` e `hash-partida` IGUAIS; o campo `m.dificuldade` nem existe no Normal.

### A duração (`partida.js`, fecho)

- **Opções:** `config.js PARTIDA.duracoes` = 3, 4, 5, 6, 8, 10 minutos REAIS por tempo (o relógio mostra 45' por tempo); o padrão
  continua `PARTIDA.minutosPorTempo` 4 (o painel e as metas são medidos com 4). A duração mora num número só, o
  `m.partida.ticksPorTempo`, que já está no hash.
- `ticksDoTempo(min)` = a conta do `criarPartida` (`max(1, round(min·60/PASSO))`; 4 min = 14 400).
- `mudarDuracao(m, min)` → boolean, PURA: mantém a FRAÇÃO do tempo jogado — o d' novo é o menor tick com o segundo mostrado ≥ o
  de agora sem passar do minuto de agora; `tick0Tempo = tick − d'`, `ticksPorTempo = T'`. O minuto mostrado fica IGUAL sempre; o
  segundo, igual nas 6 opções (T' ≥ 2700 ticks; com o tick de mais de 1 s de jogo — durações de teste abaixo de 0,75 min — fica no
  máximo ⌈2700/T'⌉ s longe, e pode voltar: o minuto ganha); os acréscimos já anunciados ficam (minutos de jogo, os ticks pela
  duração nova) e o "regular" (d ≥ T) também. No intervalo só troca o T (o 2º tempo nasce com ele); no tick 0 o mundo fica IDÊNTICO
  ao de `criarPartida({minutosPorTempo})` (o Personalizar recria o mundo e dá o mesmo jogo). Recusa (false, nada muda): treinos,
  Livre, Pênaltis, online/dois humanos, fim de jogo e `min ≤ 0`.
- `segundoNoTempo(d, T)`: a MESMA expressão float do `relogio-placar.js segundoDeJogo` (o `partida.js` não pode importar aquele
  módulo, fora do fecho: `teste-relogio-placar` R5); exportada só para o `teste-partida` T2, que compara as duas.
- Nada mais depende da duração (nenhuma IA lê o relógio; não há fadiga). Os replays nas paradas ("≤ 3 por tempo, ≥ 30 s de bola
  rolando") ficam proporcionalmente mais raros nos tempos longos; o Simular o resto com 10 min leva ~2,5× o de 4.

### A dificuldade (só contra a pessoa)

- **Os níveis** (os 4 do TM): Fácil ≈ Amador/Semi-Pro do EA FC; **Normal = o jogo de hoje, bit a bit** (≈ Profissional/Classe
  Mundial); Difícil ≈ Lendário; Lenda ≈ Ultimate (sem o Competitor Mode na v1). Mexe só na VONTADE, na DECISÃO e na REAÇÃO da IA
  adversária; nada de atributo, física, alcance de bote ou de interceptação, chance de ganhar a dividida, árbitro nem nas ajudas da
  pessoa; nunca mais precisa nem mais rápida que hoje (o erro só ≥ 1, a leitura do passe e a reação do goleiro só mais lentas). Sem
  ajuste pelo placar (nada de DDA).
- **No mundo:** `m.dificuldade` = 'facil' | 'dificil' | 'lenda' ou AUSENTE (o Normal), FORA do hash (como `m.trava`): só o
  comportamento muda o hash. `criarPartida({dificuldade})` escreve o campo só fora do Normal e com 1 humano;
  `definirDificuldade(m, nivel)` → boolean (também no meio da partida; recusa treinos, Livre, Pênaltis, online e nível inválido).
- **O portão:** `tatica.js nivelContra(m, t)` = `m.dificuldade && contraPessoa(m, t) ? m.dificuldade : null` — null no Normal sem
  nem chamar o `contraPessoa`, na IA × IA (demo, painel, `?demo=1`, Simular o resto), no online, com o travado expulso, nos ticks em
  que a IA cobra pela pessoa e no time DA pessoa (os companheiros dela continuam a IA de hoje).
- **As alavancas** (`config.js DIFICULDADE`; cada uma num ponto só, pelo `nivelContra` do time de quem age; pré-juntadas por nível na
  carga do módulo — o Normal usa o MESMO objeto de hoje; nenhum sorteio novo nem mudança na ordem dos sorteios):

| Chave | Cobre | Ponto | Fácil | Normal | Difícil | Lenda |
|---|---|---|---|---|---|---|
| `boteIA.chancePorPasso` / `descanso` | `ACOES.boteIA` (a vontade de tentar o bote com a bola ao alcance; o alcance e a chance de ganhar não mudam) | `sim.js boteIA` | 0,025 / 110 | 0,08 / 45 | 0,12 / 34 | 0,22 / 20 |
| `engaja` (m) | `IA_PESSOA.engaja` (a linha de engajamento, teto 105) | `ia-tatica.js blocoDoTime` | −8 | 0 | +3 | +6 |
| `encurta` | `IA_PESSOA.encurta[2]` (quem guarda a zona encurta no gatilho) | `ia-tatica.js` (o ponto da zona) | 0,10 | 0,30 | 0,38 | 0,50 |
| `contencao` (m) | `IA_DEFESA.contencao` (a distância do 1º homem contendo; nunca abaixo de 1,25) | `ia-tatica.js semBola` (o `conter` do 1º homem) | +1,0 | 0 | −0,4 | −0,6 |
| `contrapressao` {s, max} | `IA_DEFESA.contrapressao` (quanto tempo e quantos vão no condutor depois da perda) | `ia-tatica.js blocoDoTime` | [0,1,3] / [0,1,2] | [0,3,5] / [0,2,3] | [0,4,6] / [0,2,3] | [0,5,7] / [0,3,3] |
| `utilidade.chute` / `chuteLonge` | `UTIL_P` (a vontade de chutar e o peso relativo do chute de fora; a execução não muda) | `ia-ataque.js decidir` (`utilDe`) | 2,0 / 0,6 | 3,0 / 0,25 | 3,6 / — | 4,2 / — |
| `utilidade.passeAntecipa` (s) | `IA_PESSOA.utilidade.passeAntecipa` (o passe lê a defesa da pessoa N s à frente) | idem | 0,2 | 0,5 | 0,6 | 0,7 |
| `le` (s) | `IA_DEFESA.livre.le` (ler o passe da pessoa antes de ir cortar; só mais lento) | `ia-tatica.js cortaPasse` | 0,35 | 0,20 | — | — |
| `erroChute` | × o erro do CHUTE (só ≥ 1, só no Fácil) | `acoes.js executarAcao` | 1,5 | — | — | — |

Regras da tabela (o D0 do `teste-dificuldade` confere): a vontade de chutar até 4,2; nos níveis de cima o `chuteLonge` (o peso
RELATIVO do chute de fora) nunca passa o do Normal — subir trocava a chance boa pelo chute de longe: mais chutes e menos gols (revisões
A4/B2) —; no Fácil ele pode subir (chutar de longe à toa é decidir pior: o Fácil que só chutava de perto convertia mais, revisão B3).
Saíram na revisão (sem efeito medível, B4): `avaliaTicks`, o `erro` do passe e a `reacaoGoleiro` (o `goleiro.js` saiu do diff do
fecho: ficam `acoes`, `config`, `ia-ataque`, `ia-tatica`, `partida`, `sim` e `tatica`).

Medido pelo RESULTADO (`teste-dificuldade`, partidas pareadas contra os 4 roteiros, 2 × 4 min; duas amostras de 64 por nível,
sementes 1–16 e 17–32; `PESQUISA-DIFICULDADE.md` §11): gols da IA por partida 0,64 / 0,89 / 1,08 / 1,22 e 0,66 / 0,88 / 1,06 / 1,17
(antes da revisão 0,83 / 0,89 / 0,95 / 0,94); saldo da pessoa −0,16 / −0,64 / −0,81 / −0,88 e −0,24 / −0,47 / −0,76 / −0,86; xG da
IA 0,80 / 1 / 1,24 / 1,46 e 0,63 / 1 / 1,12 / 1,09 do Normal; botes da IA 0,52 / 1 / 1,24 / 1,51 do Normal; chutes da pessoa 1,55–1,77
/ 1 / 0,79–0,86 / 0,73–0,84; faltas da IA no Lenda 1,40–1,50×. Provados nas duas amostras: gols da IA Fácil < Lenda e saldo da pessoa
Fácil > Lenda; o Difícil e o Lenda quase empatam no resultado (o Lenda se separa pelo aperto e pelas faltas).
- **Fora da v1:** a "gestão de jogo pelo placar" do Lenda (Competitor Mode); o goleiro da IA que se entrega no pênalti; a
  dificuldade no Livre e nos Pênaltis (Normal); o "2º melhor passe" do Fácil e o `antecipaPressao` (a reserva da especificação; a
  contrapressão por nível entrou na revisão).

### Onde se escolhe (página, fora do fecho)

- **`js/ajustes-partida.js`** (puro, importa o `config.js` e o `tatica.js` — só LÊ o mundo —; fora do fecho; no download inicial):
  `DURACOES`, `NIVEIS`, `NOME_NIVEL`, `minutosValidos`, `nivelValido`, `ajustesDoPedido(pedido)` → `{minutosPorTempo | null,
  dificuldade | null, fixos}` (o online: nunca a dificuldade), `proximaDuracao` (fora da lista — o `?min` dos testes — vai à menor
  opção maior), `proximoNivel`, `duracaoAnterior`/`nivelAnterior` (o ‹), `maisFacil`, `nivelDoPasso(m)` (o nível que o passo que
  acabou usou contra a pessoa, ou null), `textoDuracao` ("2 × 4 min"), `textoNivel` e `resultadoComAjustes(r, ajustes, m)`.
- **`main.js ajustes`** = `{minutosPorTempo, dificuldade, maisFacil, fixos}`: a escolha mora na PÁGINA e sobrevive ao Personalizar,
  ao Jogar de novo, ao Reiniciar e à troca de modo (todos recriam o mundo pelo `criarMundoTreino`). O começo: `?min`/`?dif` > o
  pedido do TM (no online, só a duração, a do anfitrião) > `golaco.prefs.v1` (fora do TM e do online) > 4 min, Normal. A pausa
  muda a escolha da página (salva fora do TM e do online) e, na partida em andamento, o mundo (`mudarDuracao`/`definirDificuldade`);
  no fim do jogo fora do TM muda só a escolha (o "Jogar de novo"): lá os rótulos e o próximo valor do ciclo saem da escolha da
  página, não do mundo que acabou (`partidaViva`; revisão A1 — lendo o mundo, o ciclo travava num valor e o rótulo mostrava o da
  partida jogada). `maisFacil`: a dificuldade mais fácil em que a pessoa JOGOU pelo menos um passo (`ajustes-partida.js
  nivelDoPasso` depois de cada `rodarPasso`: só a partida, com uma pessoa jogando contra a IA — a demo, o Simular o resto e o online
  não contam); zera na partida nova; um nível só atravessado no ciclo da pausa não conta (revisão A3); sem nenhum passo jogado, o
  resultado diz 'normal' (a IA × IA, onde a dificuldade não age).
- **A pausa** (`index.html #linha-ajustes`, `data-so="partida"`): a linha "Duração | Dificuldade" no "Modo de jogo" (no TM o
  submenu passa a se chamar "Partida e cenas"), dois botões de ciclo ‹ valor › (`data-ciclo`; `duracao-ciclo`: 3 → 4 → 5 → 6 → 8 →
  10; `dificuldade-ciclo`: Fácil → Normal → Difícil → Lenda; o toque ou o clique no TERÇO DA ESQUERDA volta um valor — v
  'anterior', `duracaoAnterior`/`nivelAnterior` —, o resto do botão, o Enter e o Ⓐ andam; revisão A3: o teclado e o controle só
  andam, as setas continuam movendo o foco) e os comandos `duracao`/`dificuldade` (v) da API `__golaco.ajustes`. O item do 1º nível
  mostra o que vale ("Modo de jogo · 4 min · Normal"; no TM "Partida e cenas · 6 min · Difícil"; revisão A2) — com a janela de até
  480 px de altura (o celular deitado) só o nível ("Normal"): os dois cortavam em 568×320 e 640×360 (`hud.js escreverEstadoModo`).
  Com o pedido travando (`ajustesFixos`) a linha fica À VISTA e travada (`aria-disabled`, apagada, sem as setas, com o cadeado
  depois do valor; revisão A6 — antes sumia e a pessoa não via o nível). Escondida nos treinos, no Livre, nos Pênaltis, no online
  (o "Modo de jogo" some) e no fim do jogo do TM. O modo escolhido (`aria-pressed`) tem o FUNDO verde-escuro e não a borda verde,
  que é a marca do foco (revisão A4). No celular deitado ela ocupa a célula vazia da grade (a altura do nível não muda); em ≤ 600 ×
  480 px os 4 botões das duas linhas de pares usam o MESMO padding de 11 px (o "Dificuldade" não cabia com 16; revisão A5: com 8 só
  nela, o texto ficava desalinhado do vizinho). `teste-pausa-tela` P11 (e os 2 ciclos no P10; no fim do jogo, pelo toque, os ciclos
  andam a partir da escolha e o "Jogar de novo" começa com ela).
- **A tela antes do jogo** (item 64): `prepartida.js dadosDaPartida` devolve `dificuldade: {curta: 'Normal', longa: 'Dificuldade:
  Normal'}` (`textoDificuldade`; null no online, no Livre e nos Pênaltis); a linha de informação diz "2 × 4 min | Normal" no
  celular e "2 tempos de 4 min | Dificuldade: Normal" no PC; o corte por prioridade ganhou o passo `dificuldadeCurta` (a longa vira
  a curta, logo depois do período; no PC só se a 2ª linha não couber); a duração e a dificuldade nunca saem. O ≡ abre a pausa "antes
  do jogo", onde a linha já está. `teste-prepartida` L3b; `teste-prepartida-tela` E23–E24b.
- **Rumo ao Estrelato:** vale (a IA adversária joga contra a pessoa); com o travado expulso desliga sozinha.
- **Simular o resto:** IA × IA, a dificuldade não age (a simulação do TM aplicava o `DIFF` na força do time do usuário: diferença
  pequena, aceita).

### O Total Match (v377)

- O pedido ganha em `partida`: `minutosPorTempo` (Config "Duração em 3D", `settings.tempo3d`, padrão 4), `dificuldade` (o
  `simOpts.dificuldade3d` das Batalhas, senão a Config "Dificuldade") e `ajustesFixos` (as Batalhas: a Batalha "Amador/Profissional/
  Craque Mundial/Lendário" vira Fácil/Normal/Difícil/Lenda, travada — escolher o Lendário pelos pontos e jogar no Fácil seria uma
  brecha). O online leva a duração do anfitrião e nunca a dificuldade (`online3d.js montaPedido`). O golaço ignora os dois nos
  Pênaltis e no Livre.
- O resultado volta com `minutosPorTempo` (a duração no apito) e `dificuldade` (a mais fácil usada), campos opcionais: o TM ainda não
  os usa (pontos e recompensas por dificuldade, decisão do dono).
- Testes: `teste-ponte-tm` P12; `testar-3d` (pro e `--publica`); `testar-online3d` (com e sem `--golaco`).

### Testes

- `teste-partida` T1–T5 (a duração), `teste-dificuldade` D0–D9 (CI: 4 níveis × 4 roteiros × 8 sementes = 128 partidas),
  `teste-ponte-tm` P12, `teste-prepartida` L3b, `teste-pausa-tela` P11, `teste-prepartida-tela` E23–E24b. Na base 8871b09d todos
  reprovam; o `teste-dificuldade` novo reprova também a calibração de antes da revisão (D0 e o xG do D5; nas sementes 9–16 o D9: o
  Lenda marcava menos que o Difícil, provado). As metas do CI reprovam só quando a amostra PROVA (revisão A2): os pontos pelo p5/p95,
  as provas exigidas são as que passaram nos 4 blocos de 8 sementes de 1 a 32 (botes Fácil < Normal < Lenda, xG da IA Fácil < Lenda,
  chutes da pessoa Fácil > Lenda, faltas do Lenda, nenhum lado errado provado nos gols da IA e no saldo da pessoa). O `--completo` (16
  sementes: os pontos exatos, o D7 com todos os degraus vizinhos provados nos botes e no xG, e o D9 com Fácil < Lenda provado no
  resultado) é a medida do DONO, fora do CI e não é passo antes do merge: hoje reprova no D7 (xG Normal < Difícil e Difícil < Lenda)
  e, nas sementes 17–32, também no ponto do Lenda no xG (1,09 < 1,15) — FILA, "Depende do dono" 22.
- **Download inicial sem `?tm`** (`teste-carga`): a folga até os 4 MB foi de 676,5 KB (8871b09d) a 653,1 KB no item 33 (+23,4 KB:
  main, partida, ajustes-partida, config, as IAs, hud e o index; quase tudo comentário) e a 647,4 KB depois da revisão (+5,7 KB:
  a linha travada com o cadeado, o ‹ ›, o estado do item e o nivelDoPasso no hud, no CSS e no ajustes-partida; o config e as IAs
  encolheram); acima do mínimo de 120 KB, nada sob demanda mudou (os 37 continuam fora).
- **Ficam** (FILA): os tempos do `teste-dificuldade` e do `teste-pausa-tela` no `tempos-ci.mjs` (item 114); o que não rodou depois
  da revisão — `testar-online3d`, `testar-3d --publica`, `teste-online-tela`, `testar-penaltis`, `testar-livre`, o Viverde e o
  celular de verdade (item 115); a distância entre os níveis vizinhos (item 116); o ← → nos ciclos e a duração no item do celular
  (item 117); o TM usar a `dificuldade` e o `minutosPorTempo` do resultado (item 118).

## Clássico pegado (item 35, #619; 05/11, revisão 06/11; contrato)

Pedido do dono (17/10): "clássico mais PEGADO: mais faltas pela AGRESSIVIDADE dos jogadores (bote mais forte, mais contato), não
pelo árbitro (o pedido do TM já traz `partida.classico`)". Pesquisa e calibração em `PESQUISA-CLASSICO.md` (226 clássicos reais:
faltas +11% [+8; +14], os quentes +25–50%; dois terços de MAIS DISPUTAS; a falta por disputa +4%; a pressão por minuto igual).
**Sem o clássico nada muda**: `hash-igual` e `hash-partida` IGUAIS; o campo `m.classico` nem existe.

### A marca

- `m.classico === true` só quando ligado; AUSENTE no resto (nunca `false` escrito), FORA do hash (como o `m.dificuldade`): só o
  comportamento muda o hash. `criarPartida({classico})` liga só com `=== true` (`'sim'`, `1`, `'true'` não). Vale com 1 ou 2
  humanos (o online) e na IA × IA. Não muda no meio da partida (é quem joga contra quem: sem botão na pausa, sem prefs). O Livre e
  os Pênaltis montam o próprio `opc` do `criarPartida`: nunca o recebem.
- **De onde vem** (página, fora do fecho): `?classico=1|0` (testes, demo, prints; por cima do pedido) > o pedido do TM
  (`ajustes-partida.js classicoDoPedido(pedido)`: `partida.classico === true`; no online, o pedido do ANFITRIÃO, o mesmo objeto nos
  dois aparelhos — um lado com e o outro sem dessincronizaria, e o hash do lockstep acusaria) > desligado. Função à parte do
  `ajustesDoPedido` (o P12 do `teste-ponte-tm` compara aquele objeto inteiro). `main.js criarMundoTreino` (ramo 'partida') passa
  `{classico: true}` só ligado: Jogar de novo, Reiniciar, Personalizar e a troca de modo levam junto; o Simular o resto continua no
  MESMO mundo (IA × IA: o clássico vale nos dois times).
- **A tela antes do jogo**: com `?tm`, o selo do TM como antes (o `nomeClassico`); fora do TM, com a partida pegada, "Clássico" (o
  selo `pp-classico` no PC, "Clássico · " no estádio no celular).
- **O TM não muda** (v377): o pedido já trazia `partida.classico` (`tm3d.js partidaDe`: o `derby` da carreira ou `areRivals`;
  `online3d.js montaPedido`). A Config "Rivalidade" do TM não é lida (a simulação 2D também não a lê).

### A agressividade (`config.js CLASSICO`, só alavancas do JOGADOR)

| Chave | Cobre | Valor | Onde |
|---|---|---|---|
| `vontade` (IA × IA) / `vontadePessoa` (o jogo COM uma pessoa) | `ACOES.boteIA.chancePorPasso` como TAXA: `p' = max(p, min(boteTeto, 1 − (1 − p)^v))`; e o `descanso` ÷ v: `d' = min(d, max(descansoMin, round(d / v)))` | **2,2** (0,08/45 → 0,168/20) / **1,6** (Normal 0,08/45 → 0,125/28) | `sim.js boteClassico` (na carga, `MD.pow`: `BOTE_C`, `BOTE_CP`, `BOTE_DC[nível]`), `cfgBote` |
| `boteTeto` / `descansoMin` | o envelope já jogado no item 33 (a rodada 7 da dificuldade) | 0,26 / 16 | idem |
| `segura` | × a DECISÃO do batido colado atrás do condutor de segurar (`FALTAS.tatica.chancePorPasso` no ataque promissor, `semSPA` fora dele), FORA da própria área (dentro dela a falta tática com SPA é pênalti: o `segura` não a dobra — `teste-classico` K5; a falta em si, da base, é o item 127 da FILA) | `segura` **1,5** (os dois times da IA × IA) / `seguraPessoa` **2** (só a IA contra a pessoa; os companheiros dela 1) | `faltas.js faltaTatica(m, d, c, segura = 1)`, passado pelo `sim.js boteIA` pelo `seguraClassico(m, t)` (1 sem `m.classico`) |

- **Os dois times, nunca o controlado:** o `boteIA` só roda para `guiadoPelaIA` (a IA × IA, o Simular o resto, a IA contra a
  pessoa e os companheiros dela, inclusive o chamado da PRESSÃO); o controlado tem o botão (DIVIDIDA, CARRINHO, CONTER) e ele NÃO
  muda. Portão próprio (`m.classico`), não o `nivelContra`/`contraPessoa`.
- **Duas vontades (revisão, 06/11; `PESQUISA-CLASSICO.md` §7):** o jogo com uma pessoa (`sim.js classicoComPessoa` =
  `timeDaPessoa` de algum dos dois times: os dois times dela, também o online com as duas) usa a `vontadePessoa`; sem pessoa (a
  demo, o Simular o resto — a entrada com a marca `ia`), a `vontade`. Com a 2,6 nos dois times contra a pessoa o clássico virava a
  dificuldade de cima (ela chutava 0,66× e fazia 0,60× dos gols, com os números da IA iguais) e o Difícil+C e o Lenda+C batiam no
  mesmo teto. Contra a pessoa as faltas vêm mais do segurar (o `seguraPessoa`); na IA × IA, mais do bote. Os companheiros da
  pessoa com a vontade dela e SEM o `segura` (a falta tática deles é amarelo e suspensão no TM que a pessoa não escolheu: com ele
  os cartões do time dela iam de 6 a 18 em 128 partidas e os da IA de 68 a 81). No online os dois times são de pessoas: os dois
  com a `vontadePessoa` e sem o `segura` (simétrico; o mesmo nos dois aparelhos — o portão lê a entrada do lockstep).
- **No código:** `boteClassico(b, v)` monta UMA vez na carga objetos NOVOS (`BOTE_C` da IA × IA, `BOTE_CP` do jogo com a pessoa,
  `BOTE_DC[nível]`) com o resto do `ACOES.boteIA` copiado (alcance, colada, encostada, `vParado` — o árbitro lê o
  `ACOES.boteIA.vParado` direto); `cfgBote(m, t)` escolhe (sem o clássico, a MESMA expressão de antes: o mesmo objeto, nenhum
  sorteio a mais); `seguraClassico(m, t)` dá 1 sem o clássico (× 1: o mesmo número).
- **Por que o `segura`:** a vontade satura (o bote mais cedo fecha a janela: as oportunidades caem ~45%) e SUBSTITUI a falta do
  batido (que não fica mais colado atrás do condutor): só com a vontade, botes +25% e faltas +3–6%. A decisão de segurar é do
  jogador; o apito (sempre falta) e o cartão (SPA → amarelo, segurar → sem) são os do árbitro de sempre.
- **Ficaram fora (a triagem, `PESQUISA-CLASSICO.md` §6):** o 1º homem contendo/apertando mais perto (botes +4% e a chance por
  contato +16%), a bola encostada com mais diferença de velocidade (+2–7% de botes, a chance por contato mais alta). **Ficam
  iguais de propósito:** a carga e as regras de RESPONSABILIDADE (`IA_DEFESA.desvio`, `semAtropelar.chega`, o batido que passa
  adiante, a trava do chamado `boteContidoDoChamado` — mexer nelas cria a falta "de quem só corria", `teste-faltas-sentido` B2), o
  `apertoArranca` (chegar mais rápido sobe a chance POR CONTATO pela régua), a DIVIDIDA e o carrinho da pessoa, a disputa pelo
  alto (nenhuma falta nasce no alto: item 28), o volume de pressão (engaja, encurta, contrapressão, recomposição, bola livre,
  condutor lento: no real a pressão por minuto não sobe; o jogo já corre acima do real, D8), a física e o alcance do bote, e o
  ÁRBITRO inteiro (`faltas.js` e `FALTAS.*`, `partida.js decidirFalta/aplicarCartao`).

### Com a dificuldade (item 33)

A `DIFICULDADE` vale só no time da IA contra a pessoa (`nivelContra`); o clássico em todo `guiadoPelaIA`. No time da IA contra a
pessoa os dois entram na MESMA conta, o clássico (a `vontadePessoa`) por cima do valor do nível; nos companheiros da pessoa e no
online, por cima do Normal com a `vontadePessoa`; na IA × IA e no Simular o resto, por cima do Normal com a `vontade`. Bote no jogo
com a pessoa (chance por passo / descanso): Fácil 0,025/110 → 0,040/69; Normal 0,08/45 → 0,125/28; Difícil 0,12/34 → 0,185/21;
Lenda 0,22/20 → 0,26/16 (teto/piso). A ordem ESTRITA (K0: Fácil+C < Normal+C < Difícil+C < Lenda+C, cada nível+C acima do nível
sem, o Fácil+C abaixo do Normal sem) — na versão anterior (vontade 2,6) o Difícil+C e o Lenda+C batiam os dois em 0,26/16 e o
clássico chegava a tirar botes do Lenda. Medido (`teste-classico` C10, `--completo`, 32 por nível, botes da IA por minuto de posse
da pessoa): Fácil+C/Normal+C 0,47 [0,43–0,52]; Difícil+C/Lenda+C 0,81 [0,73–0,89]; Lenda sem/Lenda+C 0,87 [0,78–0,97] (o Lenda+C
aperta mais que o Lenda); Fácil+C/Normal sem 0,60 [0,55–0,66]; **Normal+C/Difícil+C 0,93 [0,85–1,02]**: os parâmetros guardam a
razão de sem o clássico (chance × 1,48, descanso ÷ 1,33), mas o bote SATURA no jogo e o degrau de 1,25× vira ~1,07× — nesse degrau
o teste reprova só com o lado errado provado ("Depende do dono" 23); faltas da IA Lenda+C/Normal+C 1,42 [1,17–1,74] (guarda ≤
1,8×); vermelhos Difícil+C 3 e Lenda+C 0 em 32.

### O árbitro igual — como se prova

1. **A régua idêntica** (`teste-classico` K4, determinística): 1 440 cenas montadas (chegada × velocidades do defensor e do
   condutor × desarme × fora/dentro da área × chance clara, nos dois sentidos) em que `chanceFaltaBote`, `fatorForca(forcaContato)`,
   `chanceFaltaDividida`, `chanceClara`, `ataquePromissor`, `faltaNoBote`, `faltaNaCarga`, `faltaTatica` (também com o mesmo
   `segura`), `faltaNoCarrinho`, `montarFalta`, o `regrasPartida` com a falta pendente, a `chanceDividida` e o `semAtropelar` dão o
   MESMO resultado e o MESMO `m.rng` com e sem `m.classico` (25 920 chamadas).
2. **A chance média por contato** (C3b): Σ p ÷ N do árbitro nos botes e cargas avaliados, clássico ÷ sem — reprova se PROVAR fora
   de [0,90; 1,10]; e o mesmo SÓ no bote (C3c, revisão: a carga junto diluía a alta do bote). Com a configuração da revisão
   (amostras juntas): bote + carga 1,00 [0,90–1,12] na IA × IA e 1,01 [0,93–1,10] contra a pessoa; só o bote 1,08 [0,95–1,23] e
   1,07 [0,98–1,17] (o real, falta ÷ disputa +4% [+2; +6]). Na versão anterior (2,6) o só o bote ia a 1,15–1,30 conforme a amostra:
   o bote sai no começo da janela, com o defensor ainda chegando (a MESMA régua: `porVel`, `fatorForca`).

### O que muda para quem joga (2 × 4 min; a configuração da revisão, as amostras juntas: 128 pares IA × IA — sementes 1–32, 1001, 7001 e 9001 — e 192 contra os roteiros — 4 roteiros × 1–16 e 2001–2032)

| | sem → com (IA × IA) | razão | sem → com (contra a pessoa, a IA) | razão |
|---|---|---|---|---|
| botes (tentativas) | 5,50 → 8,11 | 1,47 [1,37–1,59] | 18,20 → 20,34 | 1,12 [1,07–1,17] |
| faltas marcadas | 1,73 → 2,38 | 1,38 [1,20–1,59] | 2,39 → 3,14 | 1,31 [1,20–1,44] |
| faltas esperadas (Σ p) | 1,72 → 2,31 | 1,34 [1,22–1,49] | 2,43 → 2,99 | 1,23 [1,14–1,33] |
| amarelos | 0,48 → 0,55 | 1,15 [0,89–1,49] | 0,49 → 0,65 | 1,32 [1,06–1,67] |
| gols (os dois times) | 1,79 → 1,84 | 1,03 [0,91–1,16] | 1,27 → 1,45 | 1,14 [1,01–1,30] |
| chutes (os dois times) | 8,55 → 8,26 | 0,97 [0,90–1,03] | 8,29 → 8,05 | 0,97 [0,92–1,03] |
| chutes / gols do time da pessoa | — | — | 3,20 → 2,82 / 0,28 → 0,33 | 0,88 [0,80–0,97] / 1,19 [0,92–1,59] |
| cartões: time da pessoa × IA | — | — | 10 → 16 × 108 → 141 | sem subida provada do lado da pessoa |

Os companheiros da pessoa: tentativas 0,96 → 1,29 por partida, faltas 0,18 → 0,22. Bola rolando, volume, disparada e presença:
iguais ou −1–4% (`teste-classico` C8/C9). Na página: ~0,6–0,7 falta a mais por partida e mais replays de falta perto da área
(classe B, o teto de 3 por tempo).

### Testes

- **`teste-classico`** (CI, padrão, 3 processos; 160 partidas + 21 cenas, 463 s aqui com 2 e a máquina livre): K0 a tabela, K1 a marca, K2 o hash (sem × `false` × `'sim'`
  IGUAIS; `true` DIFERENTE na demo e nos 4 roteiros), K3 os dois times e nunca o controlado (o cfg de cada tentativa =
  `cfgBote`), K4 o árbitro igual, K5 o `segura` fora da própria área (2000 sorteios numa cena montada: dentro da área segura 2 =
  segura 1; reprova antes da correção da revisão, 26 diferentes), KI a instrumentação só lê; C1–C12 pareados (bootstrap
  estratificado por modo, as metas reprovam só quando PROVAM): botes e faltas POR MODO (revisão: juntos, a demo e os roteiros se
  escondiam) — IA × IA +25–50% (reprova se provar < +20% ou > +60%), contra a pessoa botes +15–50% (reprova < +10% ou > +60%) e
  faltas +25–50% (reprova < +20% ou > +60%) —, chance por contato ±10% (C3b) e só no bote ±10% (C3c), amarelos, vermelhos ≤ 0,2
  (Poisson: Normal+C, Difícil+C e Lenda+C), gols sem queda > 25% nem alta > 10% provadas, chutes sem queda > 15%, o time da PESSOA
  (C6p gols sem queda provada > 25%, C7p chutes > 15%), bola rolando, volume/disparada/presença sem alta provada, a combinação com a
  dificuldade (C10: Fácil+C, Difícil+C, Lenda+C e Lenda sem; no CI os degraus vizinhos reprovam só com o lado errado provado; no
  `--completo`, provados — menos o Normal+C × Difícil+C, que o bote satura —; o Lenda+C nunca abaixo do Lenda), os companheiros
  (informativo) e os cartões do time da pessoa ÷ os da IA (C12, binomial condicional: sem subida provada do lado da pessoa). Medida instrumentada:
  `tools/lib/classico-medidas.mjs` (ganchos que só leem). Na base 29d67bad reprova 6 (K0, K1, K2, K3, C1, C2). Mutações: o árbitro
  × 1,3 no clássico → K4; o `cfgBote` sempre do clássico → K0 e K2; `m.classico = !!opc.classico` → K1 e K2; o `BOTE_C` com outro
  `vParado` → K0; o portão só contra a pessoa → K2 (a demo igual); o clássico no `semAtropelar` → K4; a tabela neutra → C1 e C2;
  da revisão: a `vontadePessoa` 2,6 (o teto comum) → K0 (ordem estrita 0,064 · 0,195 · 0,260 · 0,260); o `seguraPessoa` também nos
  companheiros → K0; o `cfgBote` sem o contexto da pessoa → K0; o segura dentro da área → K5. A lógica de antes da revisão (vontade
  2,6, segura 2 nos dois times) no CI reprova o K0; em 128 pares contra os roteiros (2001–2032) reprova o C12 (cartões do time da
  pessoa 6 → 22 × IA 68 → 64, P = 0,001; com a revisão 6 → 12 × 68 → 96, P = 0,33) e dá chutes da pessoa 0,79 [0,69–0,89] (com a
  revisão 0,87 [0,77–0,98]). O CI (160 partidas) PASSOU em 463 s com 2 processos; o `--completo` (96 por braço + 32 por braço da
  dificuldade; a medida do dono, fora do CI) PASSOU: IA × IA botes 1,58 [1,33–1,90], faltas esperadas 1,30, marcadas 1,13 [0,90–1,45];
  contra a pessoa botes 1,15 [1,08–1,24], faltas esperadas 1,23 [1,08–1,40], marcadas 1,25 [1,06–1,47]; chance por contato 0,98 (só o
  bote 1,06); chutes da pessoa 0,91 [0,77–1,07]; cartões pessoa 4 → 4 × IA 40 → 45; o C10 do §"Com a dificuldade".
- `teste-ponte-tm` P13 (o `classicoDoPedido`), `teste-prepartida-tela` E25 (o selo com `?classico=1`), `teste-faltas-sentido
  --classico` (B1–B4 com o clássico, a revisão: 0,00 · 0,19 · 4,88/0,13/0,13 · 0,00 — passa; a versão anterior dava 0,50 pênalti
  por partida no 'dribla', perto do teto 0,6), `painel-equilibrio --classico` (a versão medida com o clássico, a base sem: 48
  partidas IA × IA, sementes 1001–1048, a revisão — faltas 2,2 → 3,0, amarelos 0,60 → 0,71, vermelhos 0,02 → 0,08, gols 1,77 →
  1,98, chutes 9,0 → 8,8, roubadas no bote 4,04 → 5,44, passe certo 86,4 → 87,2%; o goleiro de 6 a 16,5 m 61,7 → 53,2% em 128/124
  chutes, informativo: o painel e as metas dele são do jogo sem o clássico).
- **Sem recuo:** `hash-igual --ref 29d67bad --rapido` e `hash-partida --ref 29d67bad --sementes 2 --min 1 --par 2` IGUAIS;
  `fecho-hash --diff 29d67bad`: `config.js`, `faltas.js`, `partida.js`, `sim.js` (o `ia-tatica.js` voltou à base; a revisão mexeu
  em `config.js`, `faltas.js` e `sim.js` — os dois hashes IGUAIS de novo depois dela); download inicial sem `?tm` +7,5 KB (folga
  647,4 KB na base → 642,2 na 1ª versão → 639,9 com a revisão). Passam também: `teste-faltas`, `teste-faltas-sentido`,
  `teste-cenas`, `teste-math-proibido`, `teste-dificuldade --so portao`, `teste-online`, `teste-carga`, `teste-tm-tela` e o
  `testar-3d` do TM (pro e `--publica`). Depois da revisão rodaram de novo `teste-faltas`, `teste-faltas-sentido --classico`,
  `teste-math-proibido`, `teste-dificuldade --so portao`, `teste-online`, `teste-carga` e os dois hashes; o `teste-cenas`, o
  `teste-ponte-tm`, o `teste-prepartida-tela`, o `teste-tm-tela` e o `testar-3d` não (a revisão não mexe na página nem na ponte,
  e sem o clássico o hash é igual). Não rodaram: o caso do Viverde (senha), o online com `?classico=1` nas duas abas e o celular
  de verdade.

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
- **A dificuldade** (item 33; seção "Tempo de jogo e dificuldade"): `tatica.js nivelContra(m, t)` = o nível de `m.dificuldade`
  só onde o `contraPessoa` liga; no Normal o campo não existe e tudo daqui fica bit a bit (`teste-dificuldade` D1–D3).

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
- **Com a bola a menos de `TATICA.volta.bolaPerto` m (3), qualquer ramo fica como antes** (sem a espera nova, o arco nem a
  virada parada): alguém ficava parado com o passe lento colado no pé (`teste-nao-passa`), a defesa perto da bola
  interceptava menos (`teste-intercepta` A) e a PRESSÃO do `teste-dois-humanos` C3 chegava menos.
- **A bola de lado do condutor da IA** (`conducao.js bolaDeLadoIA`, `CONDUCAO.ladoIA` {lado 0,45, antecipa 0,3, folga 0,5};
  só a IA e só na partida): com um toque marcado e a bola à frente mas a mais de 0,45 m da linha do corpo, o corpo vai para a
  linha dela (o ponto 0,3 s à frente), sem passar da velocidade dela + 0,5 m/s — seguindo o analógico reto, o toque não
  alcançava, o corpo passava da bola e o adversário ficava com ela (4 em ~140 partidas IA × IA com o D5, 0 na main).
- **As cenas que os estados novos expuseram** (só desenho, hash igual): na substituição, quem está dentro do gol na parada
  aparece 1 m para dentro do campo no corte inicial (`substituicao.js`, como a cena do fim); no cartão (`cena-cartao.js`),
  quem sai da roda do árbitro e está no caminho do capitão que chega sai de lado, longe do árbitro (IFAB: 1,38 → 4,15 m), o
  ponto do capitão que cai dentro do círculo da bola parada gira em volta do punido até a borda dela — só depois que ele
  encosta na bola do lado do giro, e a mão vai ao ombro do punido do lado dela (A1: 0 → 0,92 s a ≤ 1,2 m) e a câmera do plano do árbitro confere também a parada do punido segurada pela bola (`paradaPrevista(j, out, bola)`;
  o cartão atrás dele: 14,75 → 0%).
- **As amostras dos testes que a IA nova reembaralhou** — reprovam quando a contagem PROVA (p < 5%): o passe certo do
  `teste-intercepta` (z contra 86,5% e 80%), o canhão de tiros livres do `teste-bolas-paradas` D4 (binomial; no alvo 26,1 →
  17,6% nas sementes do teste, 24,6 × 23,9% em ~425 chutes de 3 conjuntos), os duelos pelo alto do `teste-cabeceio` (8
  partidas e Poisson; o painel de 144 dá 2,2 × 2,1 com a bola rolando) e a folga da cabeça (binomial; 88% na própria base
  com 16 partidas), o B3 do `teste-faltas-sentido` (o 'dribla' com 8 partidas e Poisson; em 48 partidas, pênaltis 0,35 ×
  0,35 e vermelhos 0,19 × 0,23 por partida, base × D5).
- **O impedimento caiu** (painel de 144: 1,16 → 0,99 e 1,23 → 1,06 por partida): a virada parada e o arco atrasam a linha que
  recuava e é mandada subir (a armadilha). A correção — a linha que sobe vira na hora (`TATICA.linhaSobe`: 1,19 nas duas
  amostras) — entra no D6 (item 23), junto com a forma da linha, porque toda mudança IA × IA troca os estados das partidas dos
  testes (`PESQUISA-CATEGORIA-D.md` §7.6).
- **O olhar** (`TATICA.olhar.giro` 1,2 → 1,4 rad/s, abaixo do 1,5 do tremor): de costas para a bola andando devagar 14,9 → 13,9%.
- O `teste-movimento --modo partida` saiu do etapa3 (5 rodadas de 8 sementes passando). Na partida, as guardas "sem recuo"
  são as da partida: a média de chutes por semente de 3 min ≥ 1,5 (main 2,75; o volume é do painel e da categoria E) e o
  marcador a ≤ 3 m ≥ 34% (main 36,6%; real 27,1%, Metrica; os 40% com as duas na Média ficam no `teste-pressao`).

### D6 — a forma sem a bola (item 23; `ia-tatica.js`, `config.js` TATICA e IA_DEFESA)

Vale na partida (`m.times`), IA × IA e contra a pessoa; o treino fica bit a bit igual. Medido pelo `teste-forma` (24 sementes) e,
faixa por faixa da bola, contra a Metrica (`PESQUISA-CATEGORIA-D.md` §8). O que muda:

- **A linha que sobe vira na hora** (`TATICA.linhaSobe`): o ramo 'linha' com o alvo à frente (no sentido do ataque) fica sem a
  virada parada e o arco do D5 (a armadilha do impedimento).
- **A linha segura; o meio aperta e cobre** (`IA_DEFESA.defesaPaga` 4 → 8 e `defesaPaga2` 6): quem é da linha de defesa paga mais
  para ser o 1º homem e, agora, também o 2º (a cobertura), com a bola mais de 3 m à frente da referência dele.
- **A cobertura do volante** (`TATICA.volanteCobre` {fora 4, alcance 20, hist 2, frente 1}): sem a bola e com ela no meu campo,
  com um defensor fora da linha (o 1º/2º homem ou a mais de 4 m da altura dela), o meio-campista mais perto da vaga (com a
  referência atrás da bola; o de antes com 2 m de vantagem) vai para ela, 1 m à frente da linha, no ramo 'linha'
  (`blocoDoTime` → `B.volante`).
- **A recomposição** (`TATICA.recomp`): no jogo organizado liga com 8 m à frente do alvo (era 15) e o sprint com 6 m de atraso
  (era 11) — quem ficava à frente da bola no meu terço era, quase sempre, quem já voltava sem chegar.
- O `teste-forma` mede com 24 sementes (com 8, o 1º terço oscilava ±0,5 entre conjuntos) e o "atrás da bola" passa a ser por
  terço contra os 4 times da Metrica (≥ 4,0 / 6,8 / 8,2; antes, a média ≥ 8, sem fonte e acima do real: 7,36).
- **Os estados novos da partida** (a IA × IA mudou, e com ela todo estado que os testes tiram dela) mostraram casos que o
  D5 não pegava. Nas cenas (fora do fecho; hash igual): na cena do cartão do IFAB, quem está perto do ponto onde o árbitro
  para (nem o punido nem o capitão) sai numa pré-rolagem invisível de até `CENA_CARTAO.esperaIfab` 0,8 s, como a do capitão
  e a do árbitro, e na cena foge do mais perto entre o árbitro e esse ponto (o colado no punido ficava a 1,6–3,4 m 1 s
  depois do cartão no alto); o desvio do caminho do capitão olha até 4 m à frente dele (era 2,5); no V2 o capitão colado
  acompanha o recuo do punido pela velocidade dele, sem o desvio de quem está na frente (era o próprio punido), e o punido
  recua a 0,9 m/s (era 0,8: 0,797 m); a câmera da saída tem mais distância de lado (+4,5 m) e uma mais atrás (+2,5 m); no
  intervalo e no fim, quem foge da lente anda (≤ `velAnda`) nos 2,05 s depois do apito; a postura do desenho tira 60% da
  inclinação do tronco (era 55%: com mais arrancadas a mediana correndo ia a 17,2°, teto 17). Nos testes: o canhão de
  cartões busca o lance perto da área até 200 s (era 100: 3 dos 8 estados ficavam sem pênalti e sem goleiro expulso); a
  falta com vantagem longa (o cartão na parada seguinte, Regra 12.3) não tem janela no guardador quando a chave fica mais
  velha que o anel (`teste-lances-guarda` G6); o ar em replay vale com os gols do real, 2,3–3,5 por partida
  (`teste-replay-paradas` P3: as sementes 1–24 iam de 37 a 24 gols só de sorteio); o controlado que o time assumiu no passo
  compara só o id e os botões (`teste-dois-humanos` B: o analógico dele no passo é o da IA, que lê o mundo); o M12 do
  `teste-pressao-humano` e o F do `teste-mira` seguem as sementes até ter casos; o E2 do `teste-mira`, o B do
  `teste-intercepta` e o C do `teste-conducao-curta` reprovam quando a conta prova (z > 1,645; o C pelo erro-padrão da
  mediana entre as partidas).

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

## Cadeiras 3D (item 69, PR 1: a cadeira e o degrau; 31/10; contrato)
Pedido do dono (29/10): "cadeiras parecidas com as reais e torcida 3D, em todos os estádios" (FILA item 69, PR 1 de 4;
pesquisa em `PESQUISA-ESTADIO.md` §14). Só DESENHO: nada do fecho do hash muda (`tools/fecho-hash.mjs --diff origin/main` = 0;
`hash-igual --ref <base>` e `hash-partida` IGUAIS).
- **A grade** (`js/render/cadeiras-dados.js`, PURO: sem three.js nem DOM; no download inicial — a textura, o degrau e a torcida
  do 1º quadro dependem dela) é a fonte única da TEXTURA das cadeiras, do DEGRAU em geometria, dos LUGARES da torcida e das
  CADEIRAS 3D de perto, com a mesma interface nas 3 malhas de estádio: `{fileiras, blocos, assentosDoBloco(i), assentoEm(...),
  iterar(cb), capacidade}`; cada cadeira `{setor, f (0 = a fileira de cima), a, x, y (o PISO do degrau), z (o centro do
  assento), rumo (para onde olha: (cos, sin) no plano xz), larg, chave}`.
  - Estádio Golaço (`gradeGolaco`; o padrão, a edição pública, os estádios sem forma): as 36 fileiras × 250 células de 0,5 m da
    textura de antes (escada de 2 células a cada 26: 24 cadeiras entre escadas), o lado de lá e o de cá com fileiras de
    0,833 × 0,517 m, os fundos com 30 de 0,867 × 0,52 m; sem cadeira em cima da boca do túnel (o piso abaixo de `TUNEL.topo`).
    Capacidade 29.556. `ARQ_GOLACO` = o `ARQUIBANCADA` de `torcida-dados.js` (reexportado).
  - Plantas curvas (`criarGradeAnel(A)`: a tigela do Maracanã — `estadio-planta.js grade` — e as genéricas —
    `estadio-generico.js grade`): as faixas de cadeira do perfil (o Maracanã: o anel de baixo e o de cima; as genéricas: os
    trechos entre as faces dos camarotes) em fileiras de ~0,8 m pela profundidade média (uma faixa com menos de 3/4 de fileira
    fica sem cadeira); em cada fileira, o u da TEXTURA em ladrilhos de 2 metades (cada metade começa com a escada: a fração
    `corredor` dela) e `n` cadeiras iguais por metade (≥ 0,5 m na fileira média, ≤ 28). O u: no Maracanã o ARCO no meio da
    profundidade (`P.uTex`, 30 ladrilhos = 60 gomos de comprimento igual; antes era o ângulo), nas genéricas o de antes (o arco
    nos cantos fechados, o x/z nos abertos). Cada metade de ladrilho × 4 fileiras = um BLOCO.
  - `perfilEmDegraus(fileiras)` / `aneisEmDegraus` / `aneisEscada(grade, base, vDe)`: o perfil em escada (bico → fundo do PISO
    → topo do ESPELHO por fileira); `sLiso(grade, s)`: a malha lisa passa pelos assentos (y = perfil(s − 0,64·Δs)).
- **A textura** pinta cada fileira da grade numa célula de duas faixas (`FAIXA_PISO` 0,6): embaixo (v menor) o PISO com o assento
  visto de cima, em cima o ESPELHO com o encosto visto de frente — as duas na cor da cadeira (de longe a mesma cor e o mesmo
  padrão de antes, de qualquer ângulo). Cor de cada cadeira: `pintorGolaco` (o de antes, com o sorteio por célula: o mosaico do
  nome, as cores do mandante e a `corCadeira` da edição pro) e `pintorAnel` (os padrões da pesquisa: 'tigela-maracana', liso,
  misto, faixas, mosaico, setores, raios) — a MESMA conta na textura e na cadeira 3D.
- **O degrau em geometria**: no Golaço cada fileira é um piso + um espelho (sempre: ~1 mil triângulos nas 4 retas). Nas curvas
  cada setor ('arquibancada-lado', '-fundos', '-ca') tem duas geometrias no MESMO Mesh — a LISA (a de antes, passando pelos
  assentos) e a em ESCADA — e `campo.js trocarLod` troca a geometria pela distância da câmera às caixas das faixas do setor
  (`DEGRAU_LOD`: escada a < 42 m — o `distMax` das cadeiras 3D: toda cadeira 3D cai num setor em escada —, lisa além de 50 m;
  com 52/62 o pré-jogo do San Siro chegava a 135 mil triângulos no celular; o `drawRange` da pré-carga do lado de cá passa
  junto). A câmera de JOGO (`camera.js deJogo`: a TV sem cinema, sem a câmera do gol e sem a da bola parada) fica SEMPRE na lisa
  (`trocarLod(..., soLisa)`: com a bola perto de um gol a TV chegava perto do fundo — San Siro +13 mil triângulos na TV do
  celular); o plano aéreo e a fachada do pré-jogo ficam na lisa pela distância (o custo de longe não muda).
- **A torcida** senta na grade: cada torcedor = uma cadeira (o piso, o centro do assento; um por cadeira). Golaço: as mesmas
  cadeiras, sorteios e quantidade de antes (só o lugar; o túnel pelo piso). Maracanã: o anel de baixo em todas as fileiras e o de
  cima em uma sim, uma não (o torcedor maior vale 2), ~+5% de lugares; genéricas: os lugares de antes puxados para a cadeira em
  que caem (sem repetir), −0% a −23%. `P.pisoEm(x, z)`: o piso da fileira do ponto (os testes F3/G2 conferem o lugar contra ele).
  Os lugares usam `assentoEm(th, s, ti, true)` (LEVE: sem o rumo e a largura) e a inversa de u dos lados abertos das genéricas é
  a regula falsi (`thDoAlvoRapido`, ~8 contas; a `thDoAlvo` das outras peças não muda). Custo na carga (Node, os 104 genéricos,
  base × agora na mesma hora, a grade junto): média 72 → 116 ms, pior 146 → 204 ms (sem essas duas: pior 443 ms + 116 da grade).
- **As cadeiras 3D de perto** (`js/render/cadeiras3d.js`, SOB DEMANDA: `main.js SOB.cadeiras`, `teste-carga` SOB_DEMANDA_ARQ):
  a cadeira rebatível (`geometriaCadeira`: concha do assento, lábio, encosto em concha inclinado, pé; 18 triângulos; 0,46 m de
  largura, assento a 0,43 m, encosto 0,36 m acima dele) instanciada (1 InstancedMesh, 1 chamada só com algum bloco perto) nos
  blocos que `escolherBlocos` escolhe por quadro: pelos px da cadeira na tela (0,5 m · alturaPx ÷ (2 · d · tan(fov/2)), d = a
  distância à esfera do bloco), entra com ≥ `pxEntra` 10 px, fica até `pxSai` 7,5 (histerese), só até `distMax` 42 m, no cone da
  câmera, com teto de instâncias por qualidade (`teto`: Baixa 0, Média 320, Alta 3.072 — o MÁXIMO da qualidade: quanto cabe em
  cada quadro quem decide é o ORÇAMENTO de triângulos do quadro, contrato "Torcedor 3D") e de blocos (`blocosMax` 20; quem já
  estava vale 20% mais no ranking); com a câmera dentro do lado de cá (a TV), nenhum bloco dele (`semSetor`). As matrizes e as
  cores só são escritas quando a escolha muda; pré-carga: o 1º quadro depois de chegar compila o programa com 0 instâncias.
  Dentro de um bloco em 3D o material das arquibancadas (`campo.js comLuzFalsa`, também o do Maracanã e das genéricas) troca a
  pintura pelo concreto do degrau (`UNIFORMS_PERTO`: até `blocosMax` caixas orientadas; o piso e o espelho pela normal); sem
  bloco perto a conta nem roda (`uPertoN` 0). API: `__golaco.estadio.cadeiras` {carregado, blocos, instancias, teto, mascara,
  torcedores, orcamento} e
  `__golaco.estadio.arquibancadas` [{nome, visivel, triangulos, emDegrau, trisLiso, trisDegrau}]; `campo.ligarCadeiras(md)`,
  `campo.definirAlturaTela(px)`, `campo.definirQualidade(q)`, `campo.grade`.
- Testes: `teste-cadeiras` (Node, padrão; reprova na main: C1–C7 — pureza, medidas da pesquisa, capacidade, textura = grade,
  lugares = cadeiras, o degrau nas 3 malhas, a escolha dos blocos com histerese/teto/lado de cá, a caixa da máscara, a cadeira);
  `teste-torcida` (o torcedor na cadeira da grade), `teste-estadio-forma` F3 e `teste-estadio-generico` G2 (o lugar no PISO da
  fileira: `P.pisoEm`); custo medido com `tools/medir-cadeiras.mjs` (TV, perto, pior plano do pré-jogo; `--tm` com o Maracanã,
  os Aflitos e o San Siro; `--raiz` mede a base).
- Para o PR 2 (torcedor 3D): o lugar do torcedor é a cadeira (`x, y, z, rumo`): virar o torcedor para `rumo` (o campo), sentar
  com o quadril a ~0,43 m do piso (o assento) e os pés no piso da mesma fileira; a cadeira 3D do bloco perto fica embaixo dele.

## Torcedor 3D (item 69, PR 2: o torcedor; 31/10; contrato)
Pedido do dono (29/10): "torcida 3D, em todos os estádios" (FILA item 69, PR 2 de 4; pesquisa em `PESQUISA-ESTADIO.md` §15;
recomendações aceitas no aval de 31/10, "Depende do dono" 11: a Baixa sem bonecos 3D, a Média só perto da câmera, a Alta
mais longe). Só DESENHO: nada do fecho do hash muda (`tools/fecho-hash.mjs --diff <base>` = 0; `hash-igual`/`hash-partida`
IGUAIS).
- **O modelo** (`assets/torcedor/torcedor.bin`, 55 KB, `TCD1`; créditos e licença MIT do Rocketbox em `assets/torcedor/`;
  como refazer em `tools/torcedor/README.md`): homem (`Adults/Male_Adult_16`) e mulher (`Adults/Female_Adult_17`), cada um em
  2 níveis — o 0 com ~300 triângulos, o 1 com ~125 (o joelho e o cotovelo protegidos no Decimate) —, regiões por vértice
  (`REGIAO`: camisa, pele, cabelo, calça, sapato, acento) e as 8 POSES da torcida (as de `torcida-dados.js POSE`) assadas
  vértice a vértice no espaço da CADEIRA: a origem no piso, no centro do assento; z para a frente (o rumo), x para a
  esquerda da pessoa, y para cima. Sentado (poses 0 e 1): as nádegas no assento (`CADEIRA.assento.altura` 0,43 m ± 1 cm), as
  costas na frente do encosto, os pés no piso da fileira; de pé (2–7): na passagem livre, os pés entre o lábio do assento e
  o bico do degrau. O cachecol (acento) é uma faixa entre as mãos SÓ no CACHECOL (nas outras poses, fechado num ponto do
  peito: área zero).
- **A textura de animação (VAT)** (`render/torcedor-dados.js vatDados`, PURO): RGBA float, largura = o maior nº de
  vértices, altura = variações × níveis × 8 poses × 2 — na linha `linha(v, l) + 2·pose` a posição e na seguinte a normal; o
  vértice é a coluna (`gl_VertexID`). `TORCEDOR_GLSL` (`torcedorLocal`, `torcedorMundo`, `torcedorNormal`) e as mesmas contas
  em JS (`torcedorLocal`, `torcedorMundo`): a escala (`aPos.w` limitada a 0,94–1,06; pivô no assento sentado e no piso de pé),
  o balanço de lado (cresce com a altura), o pulo (SÓ de pé: sentado não sai do assento) e a cadeira (`aCad` = x, z, cos e sen
  do rumo; o y do piso é o `aPos.y`).
- **A pose é a do quadro** (`render/torcedor-pose.js`, PURO, no download inicial): `ESTADO_GLSL` (os uniforms do ânimo e
  `torcedorEstado(lugar, h, info)` → pose, pulo, balanço: a regra `POSE_REGRA`, a OLA e quem fica debaixo do BANDEIRÃO
  aberto) é incluído pelos DOIS shaders — o quadro (`torcida.js`) e o 3D (`torcedor3d.js`) — com o mesmo lugar (`aPos`, com o
  sorteio de ± 6 cm) e as mesmas sementes; o material do 3D usa os MESMOS objetos de uniform da torcida (`torcida.uniforms`).
  `estadoTorcedor()` é a conta em JS (a GPU = JS no `teste-estadio` 9).
- **Quem vira 3D** (`render/torcedor3d.js`, SOB DEMANDA: chega com o `render/cadeiras3d.js`, que o cria quando a torcida liga
  — `campo.ligarTorcida(torcida)` em `main.js`; o `.bin` é pedido no 1º quadro fora da Baixa): a unidade é a FILEIRA de um
  bloco de cadeira 3D deste quadro (`escolherBlocos`; o torcedor 3D sempre senta numa cadeira 3D), pelos px da cadeira no
  meio dela (`pxCadeira`), com histerese e o teto de TRIÂNGULOS da qualidade (`TORCEDOR3D.qual`: Baixa 0 — o quadro de hoje;
  Média 9.000, a partir de 14 px; Alta 160.000, a partir de 10 px; o nível 0 a partir de 30 px na Média e 28 na Alta, com a
  saída 4 px abaixo), `escolherTorcedores` (pura). Os torcedores de cada fileira são os do quadro sentados nas cadeiras dela
  (o mapa por célula de 0,5 m; só os do nível da qualidade, `dados.nivel`); a variação (homem/mulher, 36% mulheres) pela
  semente (`variacaoDe`). Na TV (a câmera de jogo) e com as cadeiras 3D desligadas, nenhum. Uma malha por (variação, nível):
  até 4 chamadas de desenho, só com alguém nelas; as instâncias e o `aOculto` só mudam quando a escolha muda. O
  `torcedor3d.js` só diz o que QUER (`desejo(lista, cam, anteriores)`: as fileiras com px, n e o nível, pela
  `escolherTorcedores`) e desenha o que o orçamento der (`aplicarEscolha(Map chave → nível)`; `desenhados` = os triângulos
  das malhas visíveis).
- **O ORÇAMENTO de triângulos por quadro** (`render/cadeiras-dados.js`: `ORCAMENTO3D`, `corteDeCamera`, `orcamentoPerto`,
  `criarOrcamento3D` — PUROS; `render/cadeiras3d.js` o aplica; `teste-cadeiras` C8): o 3D de perto inteiro (as cadeiras 3D
  e os torcedores 3D) ganha, a cada quadro, no máximo `alvo − resto`, em QUALQUER plano e estádio. O `resto` é o total do
  último desenho (`renderer.info.render.triangles`, pelo `medidor` que o `main.js` passa: `campo.definirMedidor(() =>
  cena3d.info().render)`) menos o que o próprio 3D de perto pôs nele (as cadeiras `count × 18` e as malhas visíveis do
  torcedor; nada com o grupo do estádio escondido); a parte do 3D de perto é conhecida antes de desenhar. Alvos
  (`ORCAMENTO3D.alvo`): Baixa 0 (sem 3D de perto), Média 127.500 (o celular: a meta é 130 mil no pior plano, a folga é a
  variação do resto de um quadro para o outro), Alta 400.000 (o PC: o que ele já desenhava de perto, ~384 mil no padrão).
  Os tetos da qualidade (`CADEIRAS3D.teto`, `TORCEDOR3D.qual.teto`) continuam como o MÁXIMO. A divisão: primeiro as PESSOAS
  — as fileiras do torcedor 3D, as de mais px primeiro, cada uma com as cadeiras 3D do bloco dela (o torcedor sempre senta
  numa cadeira 3D), no nível desejado e, se não couber, no 1 — e depois as cadeiras sem ninguém, as de mais px primeiro.
  Histerese (`orcamentoPerto`): só DESCE quando o que está desenhado passa do orçamento (primeiro as cadeiras sem gente,
  depois o nível 0 de menos px vira 1, depois sai a fileira de menos px, até caber) e SOBE devagar — `sobe` 1 unidade
  inteira por quadro (a fileira, o nível 0 ou o bloco) e só abaixo de `orçamento − margem` (`margem` 2.000). No CORTE de
  câmera (`corteDeCamera`: outra câmera, entrou/saiu da câmera de jogo, pulou > 2,5 m, virou > 25° ou o campo de visão
  mudou > 20%) o resto de antes não vale: o quadro do corte não tem 3D de perto (o resto da câmera nova é medido nele) e o
  seguinte faz a escolha inteira de uma vez, sem histerese; o renderizador novo (o contador de quadros voltou) e o 1º quadro
  também esperam uma medida. A TROCA DE QUALIDADE ignora a medida seguinte (o desenho que vem logo depois ainda é o da
  qualidade de antes) e fica sem 3D de perto até a medida da nova; religar as cadeiras 3D e o torcedor 3D que passa a
  desenhar (o modelo chegou, a torcida voltou ao desenho) ou deixa de desenhar fazem a escolha inteira de novo no quadro
  seguinte (`replanejar`; subindo aos poucos, as cadeiras que já ocupam o orçamento não dariam lugar às pessoas). Sem
  medidor (quem cria o campo sem o `main.js`), só os tetos, como antes. A TV de jogo continua sem nenhum 3D de perto. API:
  `__golaco.estadio.cadeiras.orcamento` {alvo, resto, orcamento, gasto: {total, cadeiras, torcedores}, corte, esperando,
  novo, medido}; `torcedor3d.pronto` (desenha alguém agora). Medido (PESQUISA-ESTADIO §15): o plano do placar do pós-jogo
  no celular Média 137 → 125 mil triângulos (o 3D de perto de 288 cadeiras + 69 torcedores para 96 + 9); o cartão (115 mil),
  o corpo novo (106), o pré-jogo e as 24 câmeras de perto dos 4 estádios medidos não mudam (o orçamento sobra); o PC igual
  (o pior, 390 mil, abaixo dos 400).
- **O quadro de quem está em 3D sai do desenho**: `torcida.js` ganhou o atributo por instância `aOculto` (1 byte; o vertex
  shader joga o quadro para fora do recorte) e `torcida.ocultar(indices)` (só as malhas que mudaram sobem de novo), `dados` e
  `nOcultos`. Com a torcida escondida (`mostrarTorcida(false)`), o 3D some junto.
- **Cor e luz**: camisa, pele e cabelo os do torcedor do quadro (com a sombra da cobertura que já vem nelas); a calça e o tênis
  pela semente (`TORCEDOR3D.calca/sapato`); o cachecol na cor do time (`uAcento0/1`, a identidade do TM). O sol de dia pela
  normal (0,6 + 0,44·N·L, a do quadro pela normal de cada setor), os refletores à noite (0,33–0,5), a fileira da frente
  escurecendo as pernas, a luz FALSA dos sinalizadores (`luz-falsa.js`, uniform) e a névoa.
- API: `__golaco.estadio.cadeiras.torcedores` {carregado, torcedores, blocos, triangulos, lods: [nível 0, nível 1], ocultos},
  `__golaco.estadio.torcedor3d` (malhas, modelo, vat), `__golaco.estadio.torcidaObj`.
- Testes: `teste-cadeiras` C8 (o orçamento: do nada, a histerese, o corte e 6000 quadros com o resto andando ± 2,5 mil por
  quadro e pulando no corte — o total ≤ 130 mil na Média; parado, nada pisca; a troca de qualidade e o replanejar),
  `teste-estadio` 14c (o orçamento na página, celular e PC: medido, na TV nada gasto, o total do quadro = o resto + o gasto,
  o gasto ≤ o orçamento − a margem, o quadro do corte sem 3D de perto e o seguinte de uma vez), `teste-cenas-tela` F8/C8/F9 (o pior plano no
  celular ≤ 130 mil, agora com as cadeiras e os torcedores 3D de cada plano no medido), `teste-torcida` G (o modelo, sentado
  na cadeira, de pé na passagem, o rumo, a escala, as 8 poses, o cachecol, a pose
  do quadro com a ola e o bandeirão, a escolha), `teste-estadio` 9 (GPU = JS: o estado do torcedor e a VAT nas 8 poses) e 14b
  (nunca na TV; perto, fora do quadro e no teto; sem as cadeiras 3D, nenhum), `teste-carga` (os dois módulos e o `.bin` fora
  do download inicial e pedidos depois); custo com `tools/medir-cadeiras.mjs` (agora com a câmera `frente` e os torcedores
  3D por plano).
- Para o PR 3 (impostor e densidade): o impostor octaédrico pode ser assado NA CARGA a partir das mesmas malhas e poses
  (`lerModelo` + `vatDados`: 8 poses × 2 variações); a densidade real perto (1 por cadeira nos estádios grandes) muda o
  `gerarTorcidaNiveis`/`lugares` — o torcedor 3D segue sozinho (ele lê os torcedores sentados nas cadeiras da fileira).

## Impostor da torcida (item 69, PR 3: o impostor octaédrico e a densidade real perto; 01/11; contrato)
Pedido do dono (29/10): "torcida 3D, em todos os estádios" (FILA item 69, PR 3 de 4; pesquisa em `PESQUISA-ESTADIO.md` §16;
as recomendações do "Depende do dono" 11 valem: a Baixa sem bonecos 3D, a Média só perto, a Alta mais longe). Só DESENHO:
nada do fecho do hash muda (`tools/fecho-hash.mjs --diff origin/main` = 0; `hash-igual`/`hash-partida` IGUAIS).
- **O atlas** (`js/render/impostor-dados.js`, PURO, sob demanda — chega com o `render/cadeiras3d.js`): o torcedor 3D do PR 2
  (`assets/torcedor/torcedor.bin`, o nível 0 de cada variação, as 8 poses da VAT: 16 OBJETOS = variação × 8 + pose)
  fotografado de N × N direções num HEMI-OCTAEDRO de polo inclinado `IMPOSTOR.inclinacao` (45°) da vertical para a frente
  (o espaço do torcedor do `torcedor-dados.js`: x a esquerda da pessoa, y para cima, z o rumo da cadeira; `codificar(d)` →
  [u, w] ∈ [−1, 1]², `decodificar`, `direcaoDoQuadro(fx, fy, N)` — os vértices da grade; abaixo do horizonte inclinado, a
  borda). Cada foto: a base `base(d)` (bx = y × d, by = d × bx; d quase vertical: bx = x) e o RETÂNGULO do objeto (a união
  da figura em todas as fotos, relativo ao centro da caixa do objeto, mais `margem` 1,5 texel; `ret` x0, y0, largura,
  altura em m; `cen` o centro). Duas texturas RGBA8 (`a` = camisa, pele, cabelo, cobertura; `b` = calça, nx, ny, altura/2,5
  m — tudo multiplicado pela cobertura; o resto, cobertura − as 4 regiões, é o tênis ou, na pose do cachecol acima de 1 m,
  o cachecol) com o nível 1 do mipmap feito dentro de cada foto (a textura imutável com 2 níveis). `especificacao(q)`:
  Baixa null; Média N 6, fotos de 20 × 32 (480 × 768, ~3,5 MB na GPU); Alta N 8, 28 × 44 (896 × 1408, ~12 MB). A ordem no
  atlas: `porLinha` 4 objetos por linha, a foto (fx, fy) do objeto o em `origemDaFoto`.
- **O assamento** (`criarAssador(modelo, spec)`: `passo(ms)` assa até o tempo — uma unidade é o retângulo de um objeto ou uma
  foto; `assarImpostor` de uma vez nos testes): rasterizador de triângulos em JS com `ss` 2 × 2 amostras por pixel e teste
  de profundidade; a região de cada amostra é a do vértice de maior peso, a normal interpolada (virada para a câmera: dos
  dois lados) no espaço da foto, a altura pelo y. Determinístico (o mesmo resultado no Node e no navegador). Na página
  (`render/impostor.js criarImpostor`): começa quando o modelo do torcedor 3D chega (`render/torcedor3d.js`, fora da
  Baixa), em fatias de `fatiaMs` 6 ms (até 2,5 fatias quando o navegador dá mais tempo ocioso) por `requestIdleCallback`;
  a troca de qualidade com outro atlas assa de novo e fica com o de antes até o novo ficar pronto; a Baixa desliga.
- **O quadro do impostor** (`IMPOSTOR_GLSL` e as mesmas contas em JS: `quadros`, `reprojetar`, `impostorDoTorcedor`): no
  vertex shader, com a pose do quadro (`torcedorEstado`: a MESMA pose, pulo e balanço), o objeto (a variação pela semente,
  `variacaoDe`; a pose), a escala (`aPos.w` limitada a `IMPOSTOR.escala` 0,9–1,25; pelo assento sentado, pelo piso de pé),
  o pulo (de pé), o balanço (o centro de lado, pela altura), o rumo da cadeira (`aRumo`: cos e sen × 127); a direção da
  câmera no espaço do torcedor → as 3 fotos e os pesos (Brucks: o quadrado da grade e a diagonal; a foto exata pesa 1) → o
  quadro virado para a câmera (a base da direção da câmera) do tamanho do retângulo → o uv de cada canto em cada foto pela
  PROJEÇÃO VIRTUAL (o raio paralelo à câmera até o plano da foto) e a luz (o sol de dia, para cima à noite) no espaço de
  cada foto. No fragment shader: as 3 fotos que caem dentro delas somadas pelos pesos, o recorte em `alfa` 0,5, as cores
  do torcedor (as do quadro; a calça e o tênis pela semente; o cachecol do time) e a luz do torcedor 3D (0,6 + 0,44·N·L de
  dia; 0,33 + 0,17·(0,5 + 0,5·N·y) à noite; × 0,88–1,12 de cada um; a fileira da frente nas pernas pela altura; + a luz
  falsa).
- **Na torcida** (`render/torcida.js`): os shaders saem de `shaders(imp)` — sem imp, o programa de hoje (o quadro SDF); com
  `ligarImpostor({vertPars, vertMain, fragPars, fragMain, uniforms, rumo})` (o GLSL do `render/impostor.js
  GLSL_IMPOSTOR`), o material de DOIS RAMOS (`aLod` 0 = o quadro, 1 = o impostor; os uniforms são os mesmos objetos da
  torcida mais os do impostor) e os atributos `aLod` (1 byte) e `aRumo` (2 bytes) em cada grupo. `definirLod(indices)`: os
  torcedores em impostor agora (só os grupos que mudaram sobem; o grupo sem ninguém em impostor volta ao programa de hoje).
  A pré-carga do programa no 1º quadro desenhado depois de ligar (a malha perto) e a CONFERÊNCIA no seguinte (`opc.programas`
  = os programas do renderizador, `main.js`): um programa com `diagnostics.runnable` falso → `desligarImpostor(true)`, o
  quadro SDF para sempre na página. API `torcida.impostor` {ligado, falhou, torcedores, grupos, perto, precarga}.
- **A escolha por BLOCO** (`escolherImpostor(blocos, cam, anteriores, opc)`, pura; `render/impostor.js atualizar` a chama a
  cada quadro pelo `render/cadeiras3d.js`): os blocos da grade das cadeiras pelos px da CADEIRA (0,5 m) no ponto do bloco mais
  perto da câmera, no cone dela; entra com ≥ `pxEntra`, fica com ≥ `pxSai`; o teto conta torcedores desenhados (os de mais px
  primeiro; quem já estava vale `favorAnterior` 1,2); o lado de cá com a câmera dentro dele fora. `IMPOSTOR.qual`: Baixa
  nada; Média 6/5 px, 6 mil torcedores, NÃO na TV de jogo (`naTV` false: na TV do celular, o programa de hoje); Alta 4/3,3
  px, 60 mil, também na TV. Cada torcedor no bloco da sua cadeira: `blocosDosTorcedores(blocos, pos, n)` (pela caixa
  orientada do bloco; na divisa, o centro mais perto; fora de todas, o centro a até o raio) → {bloco, rumo (o do bloco,
  apontando para o campo), inicio/idx (os torcedores de cada bloco)}. Os triângulos e as chamadas NÃO mudam (o mesmo quadro).
- **A densidade real perto** (`preencherBloco(assentos, ocup, dados, q, eixo)`, pura; `render/torcedor3d.js` por bloco e
  qualidade): nos blocos das cadeiras 3D do quadro, 1 pessoa por cadeira ocupada — a ocupação alvo é `dados.publico` (o
  público do pedido do TM; `gerarTorcidaNiveis` passou a devolvê-lo) × `perto.cheio` 0,96; ficam os desenhados (nível ≤ a
  qualidade), entram os da torcida de nível acima nas cadeiras vazias e, se faltar, gente nova só nas cadeiras com alguém a
  até `raio` cadeiras (cadeiras por pessoa no bloco, 1–`raioMax` 4) na fileira dela ou nas vizinhas, com o time, o setor e
  a organizada do mais perto, a camisa de um do mesmo time no bloco e a pele e o cabelo de outros (pela chave da cadeira:
  `sorteioCadeira`). As fileiras em 3D (o plano do orçamento) desenham essas pessoas em 3D; as outras fileiras dos blocos vão
  para a MALHA PERTO da torcida (`torcida.definirPerto(P)`; o impostor, ou o quadro sem ele; a escala de verdade
  `perto.escala` 0,94–1,06; o rumo da cadeira); os desenhados desses blocos saem do quadro (`ocultar`). Custo: +1 chamada
  (só com alguém nela) e 2 triângulos por pessoa, contados no ORÇAMENTO do PR 2 (`gasto.perto`; no plano a cadeira custa 18 +
  2 com o torcedor 3D pronto). Sem o modelo do torcedor, nada disso (as cadeiras 3D com o quadro de hoje).
- API (testes): `__golaco.estadio.impostor` {pronto, assando, falhou, ms, spec, blocos, torcedores, mapeados, torcida:
  {ligado, falhou, torcedores, grupos, perto, precarga}}, `__golaco.estadio.impostorObj` (o resultado do assamento, o mapa,
  os uniforms, `pausar(v)`: o mesmo quadro sem o impostor), `cadeiras.torcedores` {…, perto, pessoas}, `cadeiras.orcamento.gasto.perto`.
- Testes: `teste-torcida` H1–H8 (Node; reprova na main: o módulo não existe) — a pureza, o mapa (ida e volta, a borda, as
  câmeras do jogo dentro, as vizinhas), as 3 fotos e os pesos (sem estalo), o atlas (toda foto com gente, nada na borda, a
  caixa = a projeção dos vértices, as regiões, a normal, a altura, determinístico, os MB), o quadro cobre o corpo 3D e a
  projeção virtual, a escolha por bloco (histerese, cone, teto, Baixa), os blocos e o rumo (Golaço e Banorte), a densidade
  real (Banorte 37% → 96%, o público, a divisa da visitante vazia); conferido por mutação (10 mutações, 9 reprovam; a que
  passa tira só a guarda do sentido do rumo, redundante com a caixa do bloco). `teste-estadio` 9c (GPU = JS das contas do
  impostor), 14d (celular e PC: pronto, a TV da Média sem impostor, de perto o mesmo custo com outra imagem, a Baixa, a
  malha perto no gasto), 14e (o programa que não compila volta ao SDF), 15 (sem o modelo, o SDF), 14b/14c com a malha perto.
  Custo com `tools/medir-cadeiras.mjs` (agora espera o impostor e mostra os blocos e torcedores dele).
- Medido (PESQUISA-ESTADIO §16, `tools/medir-cadeiras.mjs --tm`): a TV de jogo do celular e o pior plano do pré-jogo IGUAIS
  nos 4 estádios (padrão 29/99,8 mil e 40/127,8 mil); de perto no celular +1 chamada e +0,4–2,1 mil triângulos (a densidade
  real), no orçamento; o PC até 257 mil de perto (alvo 400 mil); o impostor em si não muda chamada nem triângulo.
- Para o PR 4 (os 523 estádios e a calibração): a densidade real vale em qualquer planta (a grade); a escala do quadro nos
  genéricos (até 1,3–1,5 no SDF) fica limitada a 1,25 no impostor — calibrar com os estádios; o retângulo e o atlas não
  dependem do estádio.

## Os 523 estádios (item 69, PR 4: as cadeiras, o torcedor, o impostor e a densidade calibrados em todos; 01/11; contrato)
Pedido do dono (29/10): "cadeiras parecidas com as reais e torcida 3D, em todos os estádios" (FILA item 69, PR 4 de 4; aval de
31/10, "68, 69 é 70 faz"; as escolhas abertas seguem a recomendada e ficam no "Depende do dono" 11; auditoria
`tools/auditar-cadeiras.mjs`, pesquisa em `PESQUISA-ESTADIO.md` §17). Só DESENHO: nada do fecho do hash muda
(`tools/fecho-hash.mjs --diff origin/main` = 0; `hash-igual`/`hash-partida` IGUAIS).
- **As fileiras POR METRO nas genéricas** (`render/cadeiras-dados.js criarGradeAnel(A)` com `A.metrico = {dS, sD, dp,
  amostras}`; `js/estadio-generico.js grade`): em cada faixa de cadeira a fileira j vai de j·0,8 a (j+1)·0,8 m da frente da faixa
  PELA PERPENDICULAR da fileira (`dS(th, s)` e a inversa `sD`: a profundidade (rB − rF)·cos β, β o ângulo entre o raio e a normal
  da fileira, linear em s entre a 1ª e a última; `dp(th)` dá os dois de uma vez); a última de cada ângulo fica com o que sobra
  (`nFileirasEm(d)`: 0,6–1,4 m) e, onde a faixa é mais rasa, as de trás não existem — o lado raso tem MENOS fileiras, não
  fileiras mais finas (antes: o número pela profundidade média da volta, 0,05–1,58 m). A grade ganhou `limites(r, th)` →
  [s0, s1, sAssento] da fileira no ângulo (null: não existe ali), `fileiraDe(s, th)`, `faixas`, `metrico`; cada fileira guarda o
  s TÍPICO (`s0`, `s1`, `sAssento`: o da profundidade mediana) e a textura dá a cada faixa fileiras de altura igual (`v0/vm/v1`).
  O rumo e a largura da cadeira saem da fileira de verdade (o s muda com o ângulo): a direção é a CORDA entre as bordas da
  cadeira, a largura o dobro da menor meia largura com 6% de folga e `giro` (o quanto a fileira vira na cadeira). Sem
  `metrico` (o Maracanã), tudo como antes, bit a bit.
- **Onde a cadeira existe** (as genéricas: `existe(th, r, x, z, yPiso, lim, geo)` e, por metro, o próprio `criarGradeAnel`): a
  fileira ali pela perpendicular ≥ 0,6 m (`FILEIRA_MIN`), o caimento ≤ 34° (`CAIMENTO.max`), a cadeira ≥ 0,42 m (`LARG_MIN`), a
  fileira virando ≤ 6° na largura de uma cadeira (`GIRO_MAX`: a quina da 1ª fileira dos cantos; com a largura pela menor meia
  largura, a borda da cadeira 3D não entra na escada) e nenhum sólido da planta do assento ao pulo (`ALTURAS_CAD` 0,45/1,3/1,85/2,15 m: o arco das marcas,
  as colunas, a cobertura baixa; o sólido inteiro só perto de alguma marca, torre ou cobertura — `pertoDeObstaculo`, uma
  grade de 8 m e a parte de baixo da cobertura por ângulo). As mesmas contas leves e não leves: os lugares da torcida caem
  só em cadeiras que existem.
- **O perfil com o teto de 34°** (`estadio-generico.js nosDoLado`, `CAIMENTO = {teto: 33,6, max: 34, pot: 1,12, alvo}`): a subida
  útil de cada lado dividida pelos anéis pelos alvos (1 anel 34°; 2: 27/33°; 3: 25/30/33° — o C constante do Green Guide), cada
  anel até o teto no degrau mais íngreme da curva; o que passa: o anel fica reto, depois vai para as FACES entre os anéis (os
  camarotes mais altos); com um anel só, o topo desce até o teto. Antes: frações fixas, o anel de cima com mediana de 40°.
- **O fundo sem cunha** (`rB` = o máximo SUAVE, k = 4 m, entre a superelipse/pista de antes `rB0` e rF + a profundidade do lado
  pela perpendicular da 1ª fileira — a mistura dos lados pelos pesos nos cantos fechados, a do próprio lado nos abertos):
  nos cantos a arquibancada não afina mais até 2,5 m com as mesmas fileiras. As derivadas das tabelas por ±0,01 rad (as de
  1e-3 viam as quinas das tabelas de 0,1° e a fileira por metro saía com quinas de até 60°). A fachada, a cobertura e os
  trilhos seguem a planta (o `teste-estadio-generico` G5 confere).
- **A escada de 1,2 m** (as genéricas: `corredorDe(r) = 1,3 m ÷ a meia do ladrilho na fileira`; a textura desenha a escada de cada
  fileira com a largura dela, `render/estadio-generico.js texCadeiras`): 1,1–1,8 m em 99,5% das escadas (Green Guide §12.9b/§8.5;
  antes 0,66 m na frente a 2,15 m atrás). As duas escadas por ladrilho de 12 m ficam (decisão do dono). A grade tem
  `corredorDe(r, h)` e `escadasPorLadrilho` (2; com 1, só a 1ª metade começa com escada); cada fileira, `c` e `nh[h]`.
- **O Estádio Golaço** (o padrão, a pública e os 418 sem forma; `gradeGolaco`): as células 115–116 e 133–134 (`ESCADA_TUNEL`) são
  escada nas fileiras do lado de cá ao lado da boca do túnel (eram 23 cadeiras com escada de um lado só; agora ≤ 14), e o
  poste do refletor das torres de z −56 fica numa escada de 2 células de cima a baixo do fundo (`REFLETORES_GOLACO`,
  `escadaDoPoste(setor)`: as células 200–201 do fundo +x e 36–37 do −x; o poste passava por dentro de 4 cadeiras); a malha do
  lado de cá e a dos fundos pintam o concreto da escada ali (o retalho da textura; `render/campo.js`). `gradeGolaco().escadaEm(
  setor, f, a)`; `iterar(cb, true)` devolve também as cadeiras tiradas, marcadas `fantasma`: a torcida gasta os sorteios delas e o
  resto da torcida do Golaço fica IGUAL (−28 torcedores). Capacidade 29.556 → 29.412. A escada de 1,0 m (2 células) fica
  (decisão do dono).
- **O Maracanã**: a textura aprovada nas rodadas fica (a escada de 0,45–1,18 m, as fileiras de 0,56–0,8 m: decisão do dono); só o
  torcedor de cima sai de 1,3 para 1,15 (`estadio-planta.js escala`).
- **A torcida das genéricas** (`TETO_LUGARES` 30.000, `TORCEDOR_ESC` [0,98, 1,15]): o torcedor na escala de até 1,15 (com o sorteio
  de 0,92–1,08 da `torcida-dados.js`, ≤ 1,242: dentro da escala do impostor, 0,9–1,25 — a troca do quadro pelo impostor não
  muda o tamanho de ninguém; antes até 1,52) e mais gente nos grandes no lugar de esticar (`nAlvo` = mín(30 mil, 0,75·cap + 6
  mil); antes mín(25,5 mil, 0,6·cap + 6 mil)); sem o × 1,08 da metade de cima. A densidade real perto (PR 3) vale em todas.
- **A lotação dos sem forma** (`render/torcida-dados.js gerarTorcidaNiveis`: `paletas.capacidade` → `lotacao` = mín(1,
  capacidade ÷ (`TORCIDA.lotacaoCheia` 0,9 × as cadeiras do Golaço))): um estádio de 2.500 lugares desenhado na geometria do
  Golaço tem a gente dele, não 25 mil — menos nas fileiras da frente do lado de lá (as da TV, cheias como antes); o `publico`
  devolvido (a densidade real perto) é o do pedido × a lotação, e `lotacao` à parte. A capacidade vem da base:
  `identidade.js dadosEstadio().capacidade` e `identidade.capacidade` (só o real SEM forma), passada por `render/torcida.js`.
- **As cores da base = as da cadeira 3D = as da textura** (`tools/estadios/gerar-formas.mjs sincronizarCadeiras`, que roda no fim
  do gerador): nas 104 genéricas, `cadeiras_cor`, `cadeiras_cor2` e `cadeiras_padrao` saem da forma revista contra as fotos (89
  regravadas); o Maracanã com as cores da textura aprovada (#f2c21b, #2e6fc0) e 'misto'; nos sem forma, o 'liso' com uma 2ª cor
  diferente vira 'misto' (4: o liso não desenha a 2ª cor); o homônimo da MESMA cidade ganha a forma da entrada principal (o
  Estadio Centenario do Montevideo City Torque jogava na geometria do Golaço).
- Testes: `teste-cadeiras-estadios` (Node, padrão, 3 linhas de execução, ~33 s; reprova 10 na f1b59c19: E1 escadas 1,1–1,8 m
  em ≥ 99%, E2 ≤ 28/≤ 14, E3 caimento ≤ 34° em toda cadeira, E4 0 sobreposta e a fileira ≥ 0,6 (≥ 0,7 em 99%; o Maracanã fora:
  decisão), E5 0 fora do degrau/na escada/em sólido, E6 o torcedor na cadeira e a escala 0,9–1,25, E7 a densidade perto ≥ 0,90 no
  p5, E8 as cores = a base nos 523, E9 a capacidade por família, a lotação e o homônimo; conferido por mutação: 13 mutações),
  `teste-cadeiras` (C2 com o s de cada fileira por ângulo e a capacidade do Golaço 29.400–29.700; C3 com o corredor e o v por
  fileira), `teste-estadio-generico` G2 (até `TETO_LUGARES`); a auditoria `tools/auditar-cadeiras.mjs` (por estádio) e
  `tools/medir-cadeiras.mjs --tm --estadios a,b,c` (os planos no navegador).

## Passada natural fora da partida (item 61, #632; 06/11; contrato)
Pedido do dono (23/10, com print): no túnel e na fila "parecem que estão marchando, parecendo NPC". **Só desenho** e FORA do
fecho do hash (`tools/fecho-hash.mjs --diff` = 0; `hash-igual` e `hash-partida` IGUAIS): a pose da partida (`anim.js`), a
passada (`jogador.js`), o `config.js` e a `comemoracao.js` não mudam — os jogadores DURANTE O JOGO andam e correm como antes (no corpo novo, só o cotovelo do braço solto: "Corpo
novo", abaixo; o "completo" é o mocap, itens 50–52). Fontes no cabeçalho do `js/marcha.js` e no `PESQUISA-PREJOGO.md` §10 (com o que se
aproveitou de cada uma); os números antes → depois na `FILA.md` (linha 61); a régua é o `tools/teste-marcha.mjs`.

**A variação por jogador** (tudo pelo id, o mesmo em todo pré-jogo e em toda cena): a fase inicial da passada (0–2: o pé que
sai primeiro e o ponto do ciclo), o ritmo ×[1; 1,07] da cadência da tabela (uniforme; só sobe — o `ritmoVoo` só acelera —,
então quem tem ritmo alto dá passos um pouco mais curtos: 1,96–2,09 passos/s e 0,69–0,74 m a 1,45 m/s), a amplitude do braço
×[0,8; 1,2], o atraso do pico do braço (0,04–0,12 passo), o tronco ×[0,85; 1,15], o cotovelo ±0,05 rad e o atraso de saída
(os árbitros do cortejo). Os parâmetros são independentes entre si (sais diferentes na mistura de 32 bits).

**`js/marcha.js`** (puro: sem three.js, DOM, `m.rng` nem `Math.random`; a variação sai de um sorteio pelo id):
- `MARCHA` — as constantes (`ritmo` [1; 1,07] uniforme, `rampa` 0,6 s, `vSai` [2,6; 3,2] m/s, `taxaSai` 0,5 s, `filtroV`
  0,15 s, `vCheia`, `taxaGanho` 3/s, `abreRoll` 1, `braco` 0,19 rad × [0,8; 1,2], `atraso`, `cotovelo`, `pelve`, `torax`,
  `confere` [1,5; 6] cm, `taxaConfere` 0,3 s); `ligada: false` desliga a camada (os testes comparam a mesma locomoção).
- `parametrosMarcha(id)` → `{fase, ritmo, braco, atraso, tronco, cotovelo, atrasoSaida}` (sempre os mesmos para o id);
  `espalharFase(j, fase)` — a fase inicial da passada de um jogador recém-criado, parado (o pé que sai primeiro é o de cada um).
- `conferencia(P, j)` → 0–1: o braço da pose é o da passada (1) ou de um gesto, da bola nas mãos, do lateral, do cabeceio (0).
- `marchar(P, j, mp, w = 1, est = null)` — a CAMADA sobre a pose `P` (19 juntas, alterada no lugar), depois do `anim.js pose`:
  o braço oposto à perna do mesmo lado (−cos(π(fase − atraso))), o cotovelo que dobra mais à frente (de lado e freando, a dobra
  da pose), a pelve ±4° com a perna da frente e o tórax ±3° ao contrário, o braço de fora aberto pela inclinação do tronco na
  curva; os tornozelos e os comprimentos dos ossos não mudam; o braço misturado vai pela MÃO em linha reta e o cotovelo pela
  IK com os comprimentos da pose. Entre `vSai[0]` e `[1]` a camada VIRA a pose do jogo (a fase e a amplitude do braço, a
  dobra, a pelve e o tórax): acima, nada. `w` = a rampa de entrada da cena. Parado com a fase 0 não muda nada. Devolve o peso.
- `filtrarMarcha(j, est, dt, inicio = false, P = null)` — o estado do ator `est` = `{v, f, k, g, c}`: a velocidade e a componente
  para a frente filtradas (`filtroV`), a mistura com a pose pela velocidade (no máximo 1 em `taxaSai` s), o ganho das
  amplitudes (no máximo `taxaGanho` por s) e, com a pose `P`, a conferência (no máximo 1 em `taxaConfere` s); `inicio` recomeça
  do de agora. UMA vez por tick do ator, com a pose dele já feita (o `marchar` com o `est` não o altera).
- `rampaMarcha(t)` — a rampa de entrada pelo tempo da cena (smoothstep em `rampa` s).
- `marcharAtores(atores, dt)` / `avancarComMarcha(c, dt, passoCena)` — a comemoração (o `comemoracao.js` é do fecho): o mesmo
  laço do `comemoracao.js avancarCena` com a camada DEPOIS de cada `passoCena`, em cada ator `{j, atu, id, mp?, vm?, wm?}`
  (pulados — e a rampa recomeça — no mergulho, carrinho, joelhos, pulo, no ar, parado fixo e agachado; os braços com gesto
  ficam pela conferência). A página (`main.js quadroComemoracao`) e o teste chamam este.

**Quem usa** (os campos novos não vão para o mundo da partida):
- `cortejo.js` — cada andante tem `mp` e `vm` (o estado, avançado uma vez por tick em `poseAndante(c, a, out)`; redesenhado no
  mesmo tick, reaproveita; depois de um salto no tempo recomeça); `j.rumoCmd` no jogador do cortejo (o rumo pedido gira no
  máximo `CORTEJO.giroMax` 2,2 rad/s: a quina da coluna e a meia-volta dos árbitros; a foto e a restauração o levam). A
  saída do parado: o ponto do caminho acelera como 1 − e^(−u/τ) (`CORTEJO.tau` 0,7 s), começando τ antes — no regime, o ponto
  de antes. Os árbitros têm `atraso` = `atrasoArb` [0; 0,15] s e a rampa deles começa τ ANTES do tick 0: `criarCortejo`
  PRÉ-ROLA esse trecho só com eles (chegam ao tick 0 andando, no ponto de antes menos o atraso). `render/prejogo.js` desenha
  por `poseAndante`.
- `cena-atores.js` (intervalo, fim, cartão) — `a.mp`, `a.vm`, `a.wm` (a rampa por ator: 0 no 1º quadro e no carrinho; cheia
  na elipse) em `marcharAtor`; `ritmoAtor` dá a `saida` do ritmo de cada um; `recriarAtor` espalha a fase.
- `substituicao.js poseAtor` — `a.mp`, `a.vm`, a rampa pelo tempo da cena (`t`).
- `tecnicos.js poseTec` — `tc.mp`, `tc.vm`: na prática a pelve e o tórax (os braços ficam nas posturas — mãos nas costas,
  cruzados, na cintura —, `teste-marcha` T2 informativo).

**Contrato implícito com o `jogador.js passoPassada` (R5 da revisão):** o cortejo e as cenas passam `saida = {ritmoVoo}` SEM `pe`
nem `em`, e só andando (0,5 < v < `MARCHA.vRitmo`, antes da vaga): com os dois pés no chão o `passoPassada` trata a `saida` como
`pedido`, e sem `pe` (`faseLocal(f0, undefined)` = NaN) nada acontece — só o ritmo muda (`Math.max` com o natural: o apoio nunca
fica mais longo). Parado, a `saida` faria a passada andar no lugar. O `teste-marcha` G7 compara bit a bit `{ritmoVoo: natural}` ×
sem `saida` andando (com os dois pés no chão também): uma refatoração do `jogador.js` que mude isso reprova ali.

**Corpo novo (`render/esqueleto.js juntasDesenho`, `maoSolta`; A1 da revisão):** com o braço SOLTO (elevação ≥ ~0,95) e o
cotovelo do jogo até ~50°, a mão do desenho desce junto com o ombro descido o que falta para o cotovelo do corpo novo ficar com
a dobra do jogo (no mínimo 15°); antes, com a mão do jogo no lugar e o ombro 4,5 cm abaixo, o cotovelo ficava a 48–63° a
passada inteira ("segurando uma bandeja"). Vale também no jogo para quem anda ou está parado (o desenho do corpo novo; na
partida s3 a mão muda > 1 cm em 58,6% dos quadros, até 4,7 cm, e o cotovelo andando p50 59° → 46°; correndo, igual).

**Testes:** `teste-marcha` (padrão, ~30 s no CI; `--sem-cenas` ~10 s; `--js <pasta>` mede outra versão; o cortejo da semente
7, 25 andantes × 50 s, no manequim e no corpo novo pelo `render/esqueleto.js`, e as cenas de intervalo, fim, substituição,
cartão e comemoração): C0–C10 (o cortejo: os pares lado a lado no mesmo pé, também nos 3 s depois de sair, os 3 árbitros, a
onda na coluna, o 1º pé, a cadência e o walk ratio de cada um, a saída do parado, as chegadas na fila, o trio na frente das
colunas e em linha), B1–B6 (braço × perna oposta, amplitude, cotovelo, pelve, tórax, o cotovelo do corpo novo — os dois
corpos), G1–G9 (guardas: tornozelos e ossos, o tranco da mão por boneco e por tick, parado com a fase 0, o custo ≤ o da pose,
a mão na coxa, a virilha na curva, o contrato da `saida`, a conferência, a faixa de saída), T1–T2 (treinadores), S1–S4 (as
cenas e a comemoração; o 1º quadro com × sem a camada). Na base 7cb052ad reprova 23 itens e no 80b0e50d (a 1ª versão do item
61) 14; as mutações das guardas (a camada fora dos treinadores, sem a rampa do 1º quadro, sem a fase espalhada, sem a rampa da
substituição, sem a conferência, `pe ?? 0` no `jogador.js`, sem a camada na comemoração) reprovam. Continuam conferindo: o
`teste-cortejo` (pé plantado 0 m/s, corpos ≥ 0,85 m, a fila, o último aos 42,4 s, foto/restauração), o `teste-patinacao`, o
`teste-prejogo` (navegador: andantes na tela e o pior plano do celular), `teste-cenas`, `teste-substituicao`,
`teste-comemoracao`, `teste-tecnicos`, `teste-ossos` (O2: 117 → 168 saltos, 0,0231% ≤ 0,03% — os novos nos treinadores e na
comemoração; na partida, 66 como antes) e `teste-corpo-tela`.

**O custo nos treinadores (06/11, depois do deploy do #632):** a camada levou o T14 do `teste-tecnicos` (o custo dos dois
treinadores e das duas poses por passo, meta ≤ 50 µs) de 43 para 50,7 µs no CI do deploy (aqui, 18 → 24,5 µs). Sem mudar
o desenho (as poses dos treinadores bit a bit iguais em 4 partidas inteiras, 59 mil poses cada): (1) o `Math.hypot` do
`marcha.js` virou `Math.sqrt` da soma (mais rápido no V8; no Float32 da pose, igual); (2) no `poseTec`, com as DUAS mãos
presas por inteiro na postura ou no gesto (peso 1, sem mistura nem a troca medida no passo) a camada não calcula o braço
(`marchar(..., semBraco)`): o `aplicarMao` refaz cada braço do ombro ao alvo com o polo fixo e o braço da camada nunca chegava
ao desenho; (3) a conferência do braço do treinador é 1 por construção (a pose dele é sempre a da passada: os gestos e as
posturas entram depois) e não é mais calculada a cada passo. Aqui: 24,5 → ~21 µs (a base, 18). Testado e NÃO entrou: pular a
camada com o treinador parado (muda a pose em até 39 mm: a camada também endireita a pelve e o tórax de quem para).
