# Plano — cenas das paradas do Total Match 3D (`golaco/`)

Pedido do dono (22/10, para logo depois dos rostos reais): "a cena de pós jogo, e a cena de intervalo, as cenas de
cartões, e os replays de faltas e jogadas passando na tela enquanto o jogo tá parado".

Base: `main` em c1f9c845. Pesquisa em `scratchpad/cenas/referencias.md` (vai para `golaco/PESQUISA-CENAS.md` no PR 1,
junto com o arquivo de mesmo nome da branch `origin/golaco/cenas-jogo`). Mapa do código em `scratchpad/cenas/mapa-codigo.md`.
Nada lido nem copiado do `futebol3d/`.

Interpretação: "replays de faltas e jogadas passando na tela enquanto o jogo tá parado" = replay em TELA CHEIA na bola
parada, como a TV. A janela pequena com o ao vivo atrás (picture-in-picture) e o telão do estádio ficam fora (§9).

---

## R. Revisão adversarial (22/10) — o que mudou neste arquivo

Conferido contra a `main` em c1f9c845 (`main.js`, `partida.js`, `render/replay*.js`, `comemoracao.js`,
`substituicao.js`, `hud.js`, `online.js`, `online-pagina.js`, `sumula.js`, `tecnicos.js`, `tools/fecho-hash.mjs`,
`tools/teste-carga.mjs`, `tools/teste-hud-minimo.mjs`). As correções já estão aplicadas nas seções abaixo (marcadas "(rev.)").

**Quebram alguma coisa (corrigidos):**

| # | Problema (onde está no código) | Correção |
|---|---|---|
| R1 | Cartão → replay da falta não sai. Os treinadores vivos andando na cena do cartão (`leituraVazia`, "como na comemoração") marcam CORTE no 1º passo gravado depois dela (`gravarNoAnel` main.js:588–594, `REPLAY.saltoTecnico` 0,25 m). O `roteiroParada` não atravessa corte, então o replay da falta com cartão (o caso mais forte) sai `null` ou só com o 1 s depois da cena. O mesmo vale para o guardador. | Na cena do cartão os treinadores VIVOS não andam nem são desenhados: a cena desenha cópias deles (`treinadorDoTime` já devolve cópia). C9 confere `anel.primeiroCorte(chave − tv.antes, tick) == null`. |
| R2 | Lugar da espera do replay de parada. No `quadro`, `entradaDemoDoMundo` ESCREVE no mundo (`j.ia`, `j.iaT`). No `quadroOnline`, `MOD_ON.entradas` CONSOME a fila de entradas. Uma checagem depois deles muda a partida ou dessincroniza. Sem `segurou = true`, o `marcarParado` conta a espera como "esperando o outro". | `seguraParaReplayParada()` fica no topo da volta, ANTES da entrada da demo e de `podePassar`/`entradas`. No online ela marca `segurou = true` (§2.4). |
| R3 | `hash-igual` e `hash-partida` rodam em Node e não carregam o `main.js`. Dão IGUAL mesmo com um gancho errado na página. | A garantia "só desenho" da página fica nos testes A/B de navegador (V4, C7, I5, F2). Eles passam a ser obrigatórios no CI, também no online (V8). |
| R4 | Súmula "sempre ligada": `sumula.js` hoje só baixa com `?tm` (main.js:131–133, import dinâmico) e tem de ler desde o 1º passo. O `main.js` lê `REPLAY_PARADA`, então o `cenas-config.js` também entra no download inicial. A §1.5 dizia que só o `lances.js` entrava. | Import estático da súmula: +14,7 KB no download inicial; o "sem `?tm` o download não cresce" muda e vai para o CLAUDE.md. `REPLAY_PARADA` vai no `lances.js`; as `CENA_*` vão no `cenas-config.js`, importado só pelos módulos sob demanda (§1.5, §6). |
| R5 | Pós-jogo: "o mundo já para no `fim`" não vale para o hash. Em `fim`, o `passoPartida` faz `m.tick++` e o laço segue rodando o `rodarPasso` (anel, `passoTecnicos` no estado 'fim'). O F2 reprovaria, e os treinadores vivos andariam e seriam desenhados junto com as cópias da cena (o mesmo id 210/211). | Fora do online, a cena do fim SEGURA o laço. Não se perde nada: em `fim` só o tick andaria, e o resultado do TM já está gravado. No online não segura (o lockstep segue; o aviso já fica escondido com `ctx.fim`) e a cena só usa cópias. Os treinadores vivos saem do desenho em toda cena nova. F2 passa a comparar no mesmo tick (§5.3). |
| R6 | Som adiado. Com gol no último lance, o apito do intervalo/fim vai para `somAdiado` (`estadioPasso` main.js:846) e só toca com a fila vazia (`proximaCena` → `tocarAdiados`). Com a cena na fila, o apito tocaria no FIM da cena, 18–35 s depois. | A cena do intervalo/fim chama `tocarAdiados()` ao começar (plano `apito`). |
| R7 | Cartão da vantagem que virou gol. A ordem certa é comemoração → cartão (gol + 149) → saída → replay do gol, e não "replay do gol → cartão". A comemoração 'solta' com cortina (`cenaRapida`, 40 passos por quadro) passaria do gol + 149, e a cópia da comemoração continuaria desenhada por baixo do cartão. | Fila reescrita (§1.3). A cortina para no gol + 149, e a comemoração sai do desenho quando o cartão começa (§3.3). |
| R8 | Replays dentro de uma cena (lances do intervalo, "Melhores momentos"): o `fimReplay` chama `proximaCena()` e tira o jogador da cena. Vários leitores do diretor leem o `anel` direto: `posicionar` 'tv'/'atras', `tecnicosNoTick`, `zLateralDoPlano`, `jogadorNoTick`, e no `main.js` o `lerQuadro` e o `tempoEstadioAnel`. | `iniciarReplay(ro, {fonte, aoFim})`: o fim volta à cena. Todos esses leitores passam a ler a `fonte` (§4.2). |
| R9 | Guardador: "guardar quando o replay de parada é armado". No armar (bola morta), o fim da janela (`fim + 0,5 s`) ainda não foi gravado. O gol só era guardado "no `iniciarReplay` do gol": com Replays: Desligado, os gols não entrariam nos melhores momentos. A chance passa de 6 s (2,5 + 4 + 0,5). | A parada é guardada no passo antes da montagem, com ou sem replay. O gol é guardado no `posGol`, com ou sem `replayAuto`. A janela é cortada a `LANCES_GUARDA.segundos` (§4.2). |
| R10 | Tarja do cartão por cima da bola rolando: 6 s depois da cena e, no online, sem cena. É texto no `#hud` com a bola rolando, contra o H2 do `teste-hud-minimo` (0 caractere) e o orçamento ≤ 11%. O `em-replay` também a esconderia. No online, a tarja do placar do intervalo (8 s) passaria 5 s por cima do 2º tempo. | A tarja só aparece DENTRO da cena e dura a cena (≤ `CENAS.tarja`). Online ou cenas desligadas: o ícone de hoje. No online a tarja do intervalo dura os 3 s da faixa (§1.4, §3.1, §4.4). |
| R11 | "Você foi expulso" (TM, travado): a faixa de 6 s (main.js:811–815) fica escondida por `em-cena`/`em-replay` (estilo.css:638–650) e o tempo dela conta escondida: some antes de ele ver. | Ela aparece depois da cena E do replay de parada, e os 6 s contam a partir dali (§3.3). |
| R12 | Apagar `origin/golaco/cenas-jogo` no fim perde os 2 cortes da comemoração (torcida e treinador) que ficaram fora do porte (§9.8). | Só apaga depois de o dono decidir esses cortes; antes, uma tag `arquivo/cenas-jogo` (§10). |

**Precisões (menores, aplicadas):**
- R13: o predicado "passo antes da montagem" copiava a regra do `partida.js`. O `acabou` (fim do tempo) vem ANTES da
  montagem em `regrasPartida`: com o tempo acabando no segundo da bola morta, o passo seguinte é o `fimDoTempo`, não a
  montagem.
  - Agora é uma função pura `montaNoProximoPasso(m)` no `lances.js`.
  - Teste P5 em Node: o predicado é verdadeiro exatamente quando o passo real seguinte monta.
  - Caso decidido: com o tempo acabando, o replay entra antes do intervalo e conta no teto.
- R14: o replay de parada só arma com `!emRodarPassos`, como o cartão e a substituição.
- R15: o `lances.js` compara com `MD` (`matdet.js`) nos limiares, para classificar igual nos dois aparelhos no online.
  Não muda a simulação.
- R16: "Na base reprova" estava errado para V4, V6, V9, C7, C10 e I5. Eles passam, ou não têm o que medir, na base
  (§8).
- R17: os escanteios da súmula são contados na bola morta (`m.parada.tipo === 'escanteio'` novo), não no evento
  `escanteio` da montagem. Assim o escanteio cuja montagem não chega (fim do tempo) também conta.
- R18: melhor em campo. A nota da tarja é a MESMA que o TM mostra: mesma função e opções do `resultadoTM`, com
  vitória/derrota. Fica testado.
- R19: troca de camisa. O kit derivado também vai no `render/humano3d.js` (`tKits` por chave; o corpo novo é o padrão
  na edição pro), com o patrocínio da camisa de A na versão de teste.
- R20: guardador.
  - Escala 1/4000 m (±8,19 m; erro 0,06 mm) em vez de 1/8000 (±4,09 m, apertado para o mergulho desenhado do goleiro).
  - Aloca na 1ª partida, não na pré-carga (que roda também nos treinos).
  - Mini-anel com o mesmo `vagas`/`nj` do anel.
  - A batida da bola na rede do lance é guardada (o `ondas` só tem as recentes).
- R21: as cenas novas entram em todos os lugares que já conhecem `cenaGol`/`cenaSub`:
  - `marcarCondutor`;
  - `bp.plano` (main.js:1078);
  - marcas e linha (escondidas como no `desenharReplay`);
  - o `break` depois do `rodarPasso` no quadro, na cortina e no online;
  - o `simularResto`, que zera cenas, replay armado, lances, guardador, tarjas e `hud.cena(false)`.
- R22: o comentário de `CENAS.ligadas` dizia "desligadas no online", mas o pós-jogo é ligado no online. Corrigido.
- R23: sem o `SOB.cenas` baixado (cartão no 1º minuto antes da pré-carga): o ícone/faixa de hoje, sem segurar.
- R24: tarjas que somem por animação CSS (C4, I2) são medidas pelo estado da página, não por tempo fixo (lição do
  `teste-hud-minimo`).
- R25: 1 quadro (16–33 ms) do ao vivo antes da montagem entre o fim do replay de parada e o corte. Fica coberto pela
  vinheta `passa` (`hud.replay`); aceito.
- R26: V8 precisa de `?replayParada=1` nas duas abas (o webdriver desliga).
- R27: as tarjas viram exceções escritas à "sem narração" no CLAUDE.md/CONTRATOS.md (hoje só o selo
  IMPEDIMENTO/POSIÇÃO LEGAL e o nome do condutor). O dono decide os autores (§9.1).

**Conferido e está certo:**
- Os módulos novos (`lances.js`, `cena-*.js`, `cenas-config.js`, `cenas-tela.js`) não entram no fecho de 37 módulos.
  Eles importam do fecho, e o fecho não importa deles.
- `prejogo-roteiro.js`, `sumula.js`, `tecnicos.js` e `render/*` estão fora do fecho.
- O relógio de jogo e as regras da bola parada contam em ticks: `foraEspera`, `paradaMax`, `cobrancaHumanoMax`,
  `pronta`, `TIRO_DE_META.esperaMax` e os acréscimos pela `contagem`. Segurar o laço não gasta tempo de jogo nem
  atrasa a cobrança ou o apito.
- Os testes de navegador de hoje rodam com `navigator.webdriver`, que desliga tudo de novo; com `?replay=0`, o replay
  de parada também cai (vale só com `replayAuto`).
- No online, o D sobe só pelo RTT (`ajustarAtraso` online.js:287): uma espera de um lado não o aumenta.
- O `hashFinal` do online não é comparado entre os aparelhos (`online3d.js`): segurar no `fim` não o estraga.
- Pausa e celular em pé congelam o replay pelo ramo `diretor.ativo` de hoje.

---

## 0. Resumo

| PR | Branch | O que entra | Base reaproveitada | Estimativa |
|---|---|---|---|---|
| 1 | `golaco/replays-paradas` | Replay da falta e da chance na bola parada: 1–2 ângulos, ≤ 8 s, até 3 por tempo. Classificador de lances `js/lances.js`. Ponto de espera "no passo antes da montagem". | diretor e anel do replay (main) | ~3 h |
| 2 | `golaco/cenas-cartao` | Cena do cartão: o árbitro vem, ergue o cartão (3 variações de amarelo e 3 de vermelho), o capitão se aproxima, o expulso sai pelo túnel; tarja de identificação de 6 s | `cena-atores.js` e `cena-cartao.js` da branch, portados para fora do fecho | ~5 h |
| 3 | `golaco/cena-intervalo` | Intervalo: apito, campo, túnel, torcida, tarja do placar com autores, 0–2 lances do 1º tempo, estatísticas e plano geral; guardador de lances; súmula sempre ligada | `cena-fim.js` da branch (intervalo) | ~6 h |
| 4 | `golaco/cena-pos-jogo` | Pós-jogo: vencedor/perdedor, cumprimentos, troca de camisa, técnicos, aplauso, torcida, melhor em campo, placar com autores, estatísticas e "Melhores momentos"; resultado do TM e empate que continua | `cena-fim.js` da branch (fim) | ~5 h |

**Por que esta ordem (a pedida, mantida):**
1. O PR 1 é o menor e não tem atores. Ele cria duas peças que os outros usam: o ponto de espera da bola parada e o
   classificador de lances (`js/lances.js`), que escolhe também os melhores momentos do intervalo e do fim.
2. O PR 2 traz a base de atores para fora do fecho: árbitro, gestos, câmera e o `js/cenas-config.js`. A ordem da TV
   (cartão → replay da falta) depende do replay do PR 1 já existir.
3. O PR 3 é o primeiro a usar a `cena-fim.js`, o guardador de lances e a tela de tarjas/estatísticas.
4. O PR 4 reaproveita tudo isso e é o único que mexe no resultado do Total Match (com o `testar-3d`), por isso fica por último.

**Invariantes de todos os PRs:**
- **Só desenho.**
  - `node tools/fecho-hash.mjs --diff origin/main` = 0 em todo PR.
  - Nada entra em `config.js`, `comemoracao.js` nem nos outros 35 módulos do fecho.
  - `tools/hash-igual.mjs` e `tools/hash-partida.mjs` (demo e humano) dão IGUAL em todo PR. (rev. R3) Os dois rodam
    em Node e NÃO carregam o `main.js`, então não provam nada sobre os ganchos da página. A prova da página são os
    testes A/B de navegador (V4, C7, I5, F2): a mesma semente com e sem a cena, o mesmo hash no mesmo tick. Eles são
    obrigatórios no CI, também no online (V8).
  - A simulação só fica parada (o laço não roda passo, como no replay do gol) e volta no mesmo tick.
  - (rev. R2) Toda espera nova fica no TOPO da volta do laço: antes de `entradaDemoDoMundo` (que escreve `j.ia`/`j.iaT`
    no mundo) e, no online, antes de `MOD_ON.podePassar`/`MOD_ON.entradas` (que consomem a fila de entradas).
- **Sem narração.**
  - Nenhum texto narra o lance.
  - Na tela só entra o que a transmissão mostra:
    - a marca "REPLAY", que já existe;
    - o cartão físico;
    - tarjas de IDENTIFICAÇÃO: número, nome, sigla, cartão (como a faixa ENTRA/SAI);
    - o placar com os autores (DFL);
    - rótulos de estatística com números.
- **Sem recuo.**
  - `teste-hud-minimo` continua com o HUD do celular ≤ 11%, 0 texto fora do placar, pausa sem rolar em 844×390.
  - `teste-carga` mantém a folga ≥ 120 KB, e o que é novo e não desenha o 1º quadro entra sob demanda.
  - `teste-replay`, `teste-comemoracao-tela` e `teste-substituicao-tela` continuam passando.
- **Modo enxuto (dono, 15/10):** localmente só os testes do que a mudança afeta; o CI do PR decide o resto; quem fez
  relê o próprio diff antes do push.
- **Corpo humano:** as cenas desenham pela mesma lista do `jog3d`, então `?corpo=humano` funciona sem mudança. Os
  closes mostram rosto e mãos, e é por isso que a fila vem depois dos rostos. Cada teste de tela roda também com
  `?corpo=humano`.
- **Testes de navegador:** cada teste novo entra em `tools/rodar-navegador.mjs` (não no YAML), com o tempo estimado em
  `tools/lib/tempos-ci.mjs`. Cada teste novo de Node entra em `tools/rodar-testes.mjs` (padrão).

---

## 1. Base comum

### 1.1 Constantes fora do fecho: `js/cenas-config.js` (novo; nenhum módulo da simulação importa)
- `REPLAY_PARADA` entra no PR 1. `CENAS`, `CENA_CARTAO` e `CAMERA_GERAL` entram no PR 2. `CENA_FIM` e `LANCES_GUARDA`
  entram nos PRs 3 e 4.
- As constantes de hoje (`REPLAY`, `PARTIDA`, `FALTAS`, `SUBST`, `COMEMORACAO`) continuam sendo lidas do `config.js`
  (ler não muda o fecho; o fecho vai dos pontos de entrada da simulação para a frente).
- Lista completa e fontes na §6.

### 1.2 Onde a simulação fica parada (o laço não roda passo; `laco.ultimo = agora`, sem recuperar o tempo; a entrada não vai ao mundo)

| Cena | Ponto de espera | Solta |
|---|---|---|
| comemoração (hoje) | gol + 149 (`seguraSimulacao`) | saída |
| replay do gol (hoje) | saída | fim do replay |
| replay do impedimento (hoje) | apito | fim do replay |
| **cartão (PR 2)** | tick do cartão: o apito, ou a bola morta da vantagem; no gol, gol + 149 (`cartaoGolNoPonto` da branch), DEPOIS da comemoração (rev. R7). Os treinadores vivos ficam parados e fora do desenho (rev. R1) | fim da cena |
| **replay de parada (PR 1)** | passo ANTES da montagem: `montaNoProximoPasso(mundo)` (rev. R13: `lances.js`, a mesma conta do `regrasPartida` — `p.estado === 'parada' && pr.cobrador == null && tick + 1 − pr.inicio ≥ seg(PARTIDA.foraEspera)` — e também diz se o passo será o `fimDoTempo`) | fim do replay |
| substituição (hoje) | tick das trocas | fim da cena |
| **intervalo (PR 3)** | tick do evento `intervalo`, até o fim do bloco de estatísticas | solto no plano geral: os 3 s de `PARTIDA.intervalo` correm POR BAIXO, com o desenho ainda da cena (campo vazio; rev.), e a `saida` acaba a cena |
| **pós-jogo (PR 4)** | (rev. R5) fora do online: no tick do `fimDeJogo`, ou no fim do replay do último gol, até a faixa final. Em `fim` só o `m.tick` andaria. No online: não segura (o lockstep segue com o tick) | faixa final / "Jogar de novo" |

Por que o replay de parada espera no passo antes da montagem (e não no apito):
- Assim fica a ordem da TV: ao vivo (1 s de bola saindo e jogadores reagindo) → vinheta → replay → vinheta → corte da montagem → cobrança (patente US7657836).
- O anel ainda tem o lance inteiro e ninguém foi teletransportado: o roteiro não atravessa corte.
- É o mesmo tipo de espera da comemoração (gol + 149), lida pelo `main.js` sem escrever no mundo.

### 1.3 Fila de cenas (`main.js filaCenas` :388, `proximaCena` :1449) — prioridade
(rev. R7) A ordem depende de onde o cartão sai.
- **Falta com cartão:** apito → **cartão** (no tick do apito) → 1 s ao vivo → **replay de parada** (no passo antes da
  montagem) → montagem → substituição (as trocas pendentes entram na montagem) → cobrança.
- **Cartão da vantagem que virou gol:** comemoração → **cartão** (gol + 149) → saída → replay do gol → substituição.
- **Gol no último lance:** comemoração → [cartão] → replay do gol → **intervalo / pós-jogo** → faixas.
- **Impedimento com cartão pendente da vantagem:** replay do impedimento (no apito) → **cartão** (da fila; o mundo
  ainda está no tick do apito).

Regras da fila:
- O replay de parada não entra na fila: ele fica ARMADO (`replayParada = lance`) e dispara no ponto de espera.
- Nenhuma cena corta outra em andamento.
- Cada cena chama `proximaCena()` no fim. A exceção são os replays de DENTRO de uma cena (rev. R8): lances do intervalo
  e "Melhores momentos" voltam à cena por `aoFim`.
- Com a fila vazia, os sons adiados tocam (`tocarAdiados`), como hoje. (rev. R6) A cena do intervalo/fim chama
  `tocarAdiados()` ao começar: o apito dela não espera a cena acabar.
- O `proximaCena` ganha os tipos `{tipo: 'cartao'}`, `{tipo: 'intervalo'}` e `{tipo: 'fim'}`. As faixas de função continuam como hoje.
- O pós-gol sem replay chama `proximaCena()`. Antes, um cartão na fila ficava preso; a branch corrigiu e o porte mantém.

### 1.4 HUD e tela
- `hud.cena(ativo)` põe a classe `em-cena`: do HUD de jogo só ficam o placar e o "Pular" com toque (como `em-substituicao`).
- As tarjas novas ficam em `js/cenas-tela.js` (DOM) + `css/cenas.css`, os dois sob demanda (como `editor-time.js`/`editor.css`):
  - identificação do cartão;
  - melhor em campo;
  - placar com autores;
  - estatísticas.
- Essa tela entra na lista de exceções de DOM do CLAUDE.md, ao lado de `editor-time.js`, `escalacao-tela.js` e `prejogo-tela.js`.
- Estilo das tarjas: o da faixa ENTRA/SAI, com sigla, cor e escudo pela `identidade.js` (padrão hoje; times do TM com `?tm`).
- Nada encosta no placar nem no "Pular" em 844×390, 667×375 e 568×320. Os testes de tela conferem as caixas.
- (rev. R10) As tarjas só aparecem DENTRO de uma cena, com a simulação segura. Nenhuma fica por cima da bola rolando:
  o H2 do `teste-hud-minimo` cobra 0 caractere fora do placar no `#hud`. Única exceção: no online, a tarja do placar
  do intervalo, só nos 3 s em que o mundo já está parado.
- (rev. R27) As tarjas viram exceções escritas à "sem narração" no CLAUDE.md e no CONTRATOS.md, como o selo
  IMPEDIMENTO/POSIÇÃO LEGAL.
- (rev. R21) As cenas novas entram em todos os lugares que já conhecem `cenaGol`/`cenaSub`:
  - `marcarCondutor` (o nome em cima do condutor some);
  - `bp.plano` (main.js:1078, a câmera da bola parada não entra);
  - as marcas, a linha e as opções do lateral (escondidas como no `desenharReplay`).
  - Os treinadores vivos (`tecnicos`) saem da lista de desenho: quem aparece é a cópia da cena.

### 1.5 Download
- Novo sob demanda: `SOB.cenas` em `main.js`, com `cena-atores`, `cena-cartao`, `cena-fim`, `render/cartao3d`,
  `render/lances-guarda`, `cenas-tela` e `css/cenas.css`. Pré-carga no 1º gesto ou ociosa, como o replay e o editor.
  Tudo entra no `SOB_DEMANDA_ARQ` do `teste-carga`.
- (rev. R4) O download inicial ganha o que lê cada passo desde o começo:
  - `js/lances.js` (~6 KB, com o `REPLAY_PARADA` dentro);
  - no PR 3, `js/sumula.js` (~14,7 KB): import ESTÁTICO no `main.js`, que hoje só o baixa com `?tm` (main.js:131–133).
  - O `cenas-config.js` (as `CENA_*`) só é importado pelos módulos sob demanda.
  - O PR mede e anota a folga do `teste-carga` antes → depois (hoje ~1,4 MB; mínimo 120 KB).
  - O CLAUDE.md muda a frase "sem `?tm` o download não cresce": a súmula deixa de ser só do TM.
- `roteiroParada` fica em `render/replay-roteiro.js`, que já é sob demanda.
- (rev. R20) O guardador (3,5 MB) e o mini-anel (~2 MB) são ALOCADOS na 1ª partida, depois de o módulo chegar, e não
  na pré-carga: a pré-carga ociosa roda também nos treinos.
- (rev. R23) Sem o `SOB.cenas` baixado na hora (cartão antes da pré-carga): ícone/faixa de hoje, sem segurar e sem
  esperar o download.

### 1.6 Modos

| | Partida | Online 1×1 | TM | TM "só o meu jogador" | Modo Livre | Pênaltis 3D | Treinos |
|---|---|---|---|---|---|---|---|
| Replays de parada (PR 1) | sim | sim (segura só o meu lado, como o replay do gol e o do impedimento já fazem) | sim | sim | não | não | não |
| Cartão (PR 2) | sim | não: só o ícone de hoje (rev. R10: sem tarja por cima da bola rolando) | sim | sim (o vermelho dele → replay → depois a faixa "Você foi expulso", rev. R11) | não (não há cartões) | não | não |
| Intervalo (PR 3) | sim | não: a faixa de 3 s de hoje + a tarja do placar SÓ nesses 3 s (rev. R10), que não seguram | sim | sim | não (sem relógio) | não | não |
| Pós-jogo (PR 4) | sim (segura o laço; rev. R5) | sim, SEM segurar: o lockstep segue andando o tick do `fim`; a cena só usa cópias e anda no `quadroOnline` (rev. R5) | sim (sem o bloco de estatísticas; empate que continua = versão curta) | sim | não | não (a disputa intercepta o `fimDeJogo` e tem a faixa dela) | não |

- Online sem cartão e intervalo: a cena seguraria o meu lado com durações diferentes (o "Pular" de cada um), e o outro
  ficaria "Aguardando…". É a mesma decisão da substituição (`substLigada = ONLINE ? false`, main.js:415).
  O item (4) da fila do dono ("cena de substituição no online") passa a ser "cenas no online" (pular combinado pelo
  canal de controle do `online-pagina.js`, que não é do fecho).
- Os replays de parada ficam ligados no online porque:
  - o gatilho é função pura dos eventos, igual nos dois aparelhos (rev. R15: limiares com `MD`);
  - a duração do roteiro é a mesma nos dois. O que muda de um aparelho para o outro é o "Pular" e a preferência
    "Replays", e aí o outro espera "Aguardando…";
  - o gol e o impedimento já funcionam assim;
  - só segura o MEU lado: o D do online sobe só pelo RTT (`ajustarAtraso`), então a espera não aumenta o atraso.
- Desligado com `navigator.webdriver`, `?prints=1` e `?demo=1`, como a substituição (os testes de outros assuntos
  continuam iguais). Para forçar: `?replayParada=1` e `?cenas=1`.

### 1.7 Pular (o mesmo gesto das cenas de hoje)
- **Replay de parada:** qualquer botão/tecla/toque NOVO pula (`botaoPula`). O aperto que pulou não vira jogada (`soltarTudo` + `bloquear`).
- **Cartão:** um aperto novo depois de `CENAS.pularDepois` (0,5 s) pula: cortina e volta ao vivo. (rev. R10) A tarja
  sai junto com a cena; não fica por cima da bola rolando.
- **Intervalo e pós-jogo:** como o pré-jogo.
  - Toque/Enter/A = próximo bloco (no último bloco, o fim da cena); um botão segurado vale uma vez (de novo só depois de
    solto).
  - "Pular" (só com toque) = fim da cena: no intervalo, a saída do 2º tempo; no pós-jogo, a faixa final.
  - Esc/P/Start = a PAUSA (congela a cena; no intervalo, o "Editar time" da Regra 3), não o fim da cena.
- **Pausa, aba escondida e celular em pé:** congelam a cena, que volta de onde parou (como a `cenaSub`).

### 1.8 Opções
- **"Replays: Ligado/Desligado" da pausa:** vale também para os replays de parada. O `title` passa a "Replays
  automáticos (gol, impedimento e paradas)".
- **Botão novo na `linha-cenas`** do "Modo de jogo" (no TM, "Cenas da partida"), ao lado de Pré-jogo e Substituição:
  `Cenas <small>ligadas</small>`.
  - Liga/desliga cartão, intervalo e pós-jogo. Desligado = como hoje (ícone, faixa de 3 s, faixa do fim).
  - Fica salvo em `prefs.cenas`; `?cenas=0|1` força.
  - Uma opção só, porque a pausa tem de caber sem rolar no celular deitado. O FC 26 deixa desligar essas cenas porque
    "gastam segundos".

### 1.9 Testes comuns (padrão de todos os PRs)
- **Pureza (Node):**
  - `hashMundo` antes = depois da cena, e `m.tick` igual.
  - A partida rodada com o módulo novo lendo cada passo dá o mesmo hash que sem ele (24 sementes).
- **Simulação idêntica (navegador), a prova da página (rev. R3):**
  - A mesma semente, com a entrada da demo (`comoPagina`), com a cena e sem ela (`?cenas=0` / `?replayParada=0`).
  - `hashMundo` no MESMO tick depois da cena tem de ser igual nas duas abas.
  - A entrada da demo é o caminho que ESCREVE no mundo (`entradaDemoPartida`): é justamente ele que pega uma espera no
    lugar errado (rev. R2).
  - Durante a cena, o `mundo.tick` não anda. Exceção: o pós-jogo no online, onde só o tick anda e o resto do hash fica
    igual.
- **Reprova antes:**
  - O teste de Node roda com `--js <pasta da base>` (convenção do repositório) e dá REPROVOU com o motivo (módulo ausente / cena ausente).
  - O de navegador roda com `--raiz <cópia da base>` e reprova porque a cena não acontece.
  - A tabela antes → depois vai no PR.

---

## 2. PR 1 — Replays nas paradas (faltas e jogadas)

### 2.1 O que o jogador vê
- **Falta, quando o lance pede (classes abaixo):** apito → 1 s ao vivo (a bola parando, os jogadores chegando) →
  vinheta verde (a de hoje, `hud.replay`) → replay em 2 planos:
  - **P1 'tv'** na velocidade real: de 2,5 s antes do contato até 1,0 s depois. Começa no máximo no último corte e
    encolhe até 1,0 s antes do contato se o orçamento apertar.
  - **P2 'fechada'** a 0,5×: a mesma câmera de TV com o campo de visão fechado (×0,5) no ponto do contato, de 0,8 s
    antes até 0,6 s depois. É o "replay mais fechado e mais lento" da TV.
  - Depois: vinheta → volta ao vivo no mesmo tick → corte da montagem (barreira, cobrador) → cobrança.
- **Pênalti:** a mesma coisa, antes da montagem do pênalti e da câmera atrás do cobrador (#490).
- **Chance (bola morta ≤ 4 s depois do chute):** P1 'tv' 1× (2,5 s antes do chute até 0,5 s depois do desfecho) +
  P2 'atras' 0,5× (atrás do gol, a câmera do replay do gol; de 0,5 s antes do chute até 0,4 s depois do desfecho).
- **Duração:** no máximo 8 s por parada (SoccerNet: 6,8 s por plano de replay; LaLiga: "se dá para resolver em dois
  ângulos, melhor que em três"). Encolhe primeiro o começo do P1 e depois o P2.
- **Na tela:** só a marca "REPLAY" no canto e o "Pular" com toque (os de hoje). Nenhum texto.
- **Frequência:**
  - Até 3 por tempo.
  - Pelo menos 30 s de bola rolando desde o último replay automático (gol, impedimento ou parada).
  - Nunca em lateral sem lance.
  - Um replay por parada (o lance mais forte).
- **Com cartão:** no PR 1 o cartão continua sendo o ícone. No PR 2 a cena do cartão entra ANTES do replay (TV:
  closes de reação → replay).

### 2.2 Classes do lance (gatilhos)
- **Classe A** (sempre, fora do teto e do espaço):
  - pênalti marcado;
  - vermelho (inclui 2º amarelo);
  - bola na trave ou no travessão (evento `trave` do `bola.js`) seguida de bola morta em ≤ 4 s.
- **Classe B** (dentro do teto e do espaço):
  - falta com amarelo;
  - falta a ≤ 25 m do centro do gol atacado (o tiro livre direto que a IA chuta; `PARTIDA.tiroLivreDireto.chuteMax` 30);
  - defesa espalmada (`defesa` modo `espalmada`) de chute de dentro da área ou a ≥ 22 m/s (`chute.v` do `acoes.js`);
  - chute de dentro da área (|x| ≥ 36, |z| ≤ 20,16) que saiu a ≤ 1,5 m da trave ou do travessão.
- **Nunca:**
  - lateral ou tiro de meta sem lance A/B;
  - o chute bloqueado (`bateuCorpo`) sem trave;
  - a defesa em que o goleiro fica com a bola. Ele repõe ao vivo; segurar ali tiraria o contra-ataque da pessoa
    ("respeitar o ao vivo", LaLiga). Fica anotado em §9.
- **Impedimento:** o replay de hoje não muda, mas conta como "último replay" para o espaço de 30 s.
- **Mais de uma classe na mesma parada:** ganha a mais forte, nesta ordem: pênalti > vermelho > trave > amarelo >
  falta perto > espalmada > passou perto.

### 2.3 Módulos
- **`js/lances.js`** (NOVO, puro; fora do fecho; no download inicial):
  - `criarLances()` cria o estado.
  - `lancesPasso(L, m, eventos)` só lê o mundo e os eventos do passo. Lê: `chute` (id, v; x/z de quem chutou), cabeceio
    a gol (`marcasDoPasso` bit0, a mesma função do anel), `trave`, `defesa` (modo), `falta` (def, id, time, x, z,
    area, grau, cartao, motivo), `cartao`, `penaltiMarcado`, `fora`, a bola morta (`m.parada` novo) e o `gol`. Na bola
    morta deixa em `L.lance` `{classe, tipo, chave (tick do contato ou do chute), fim (tick do desfecho), time, ids, x,
    z, lado, peso}` ou null.
  - `decidirReplay(L, lance, {tempo, tick, ligado})` aplica o teto por tempo e o espaço.
  - `registrarReplay(L, tick, tipo)` é chamado também quando o gol e o impedimento passam.
  - Nada alocado por passo; sem rng.
  - Os melhores momentos dos PRs 3 e 4 escolhem por este mesmo `lance.peso`.
- **`render/replay-roteiro.js`:** `roteiroParada(anel, lance)` → `{tipo: 'parada', planos (≤ 2), lado, chave}`, ou null
  se a chave já saiu do anel. Nunca atravessa corte (`ultimoCorte` / `primeiroCorte`, como os outros roteiros). Planos
  com `cam: 'tv' | 'fechada' | 'atras'`.
- **`render/replay.js`:**
  - `diretor.parada(lance)` devolve o roteiro.
  - Câmera nova `'fechada'` no `posicionar`: a instância de TV do replay com `fov × REPLAY_PARADA.lento.fov` e o alvo
    puxado para o ponto do lance (`lance.x/z`), misturado com a bola.
  - `estado()` passa a informar também `tipo: 'parada'` e `classe`.
- **`js/cenas-config.js`** (NOVO): `REPLAY_PARADA` (§6).

### 2.4 Ganchos no `main.js`
- `lances = criarLances()` no mundo novo, só com `m.partida && !m.livre && !m.disputa`; zera no "Recomeçar", no "Jogar
  de novo" e no "Simular o resto".
- **`rodarPasso`:** depois do `tratarEvento`, chama `lancesPasso(lances, mundo, eventos)`. Se veio `lances.lance` e
  `decidirReplay(...)` aceitou, arma `replayParada = lance`. (rev. R14) Só com `!emRodarPassos`: a API dos testes
  nunca arma, como o cartão e a substituição.
- **Desarma** se: gol, intervalo, fim, recomeço, ou a parada acabou sem montagem.
- **`seguraParaReplayParada()`** (rev. R2: lugar exato):
  - No `quadro`, é a 1ª linha da volta do laço, ao lado do `seguraSimulacao`. Fica ANTES de
    `const e = DEMO_ON ? entradaDemoDoMundo(mundo) …`, que escreve `j.ia`/`j.iaT`, e antes do `entrada.passoUsou`.
  - No `quadroOnline`, fica ANTES de `MOD_ON.podePassar(s)` e de `MOD_ON.entradas(s)`, que consome a fila. Quando
    segura, marca `segurou = true`: sem isso, o `MOD_ON.marcarParado` conta a espera como "esperando o outro".
  - Se o replay está armado e `montaNoProximoPasso(mundo)` (rev. R13), chama `iniciarReplay(diretor.parada(lance))` e
    para o laço do quadro (break, sem rodar o passo).
  - Com o tempo acabando nesse passo (`montaNoProximoPasso` diz `'fimDoTempo'`): o replay entra mesmo assim e o
    intervalo/fim vem depois, na fila. Testado no P5.
  - No passo antes da montagem, guarda o lance no guardador, com ou sem replay (PR 3; rev. R9).
  - Sem diretor ainda: desarma, sem segurar nada; a pré-carga chega muito antes na prática.
  - Com cena ou replay em andamento nesse tick (o cartão do PR 2), espera a cena acabar e só então checa. A
    simulação estava parada; o ponto continua o mesmo.
- **Break depois do `rodarPasso`** (rev. R21): `if ((diretor && diretor.ativo) || cenaSub || cenaSegura()) break;`,
  no `quadro`, na cortina da comemoração e no `quadroOnline`.
- **`iniciarReplay` / `fimReplay`:** sem mudança. O fim chama `proximaCena()`, que no PR 1 continua com as trocas e as faixas.
- `replayParadaLigado`: `?replayParada=0|1` força. Senão: `false` com webdriver, PRINTS e DEMO_ON; senão `REPLAY_PARADA.ligado`.
  Sempre também `&& replayAuto`.
- **API `__golaco.replay.paradas`:** `{armado, contagem (por tempo), ultimoTick, historico: [{tick, classe, tipo, dur}], forcar(lance)}`.

### 2.5 Online, TM, Livre, treinos
- **Online:** ligado.
  - Segura só o MEU lado (`quadroOnline` já trata `diretor.ativo`); o outro espera "Aguardando…", como no replay do gol.
  - O gatilho vem só dos eventos, igual nos dois. O que pode mudar é a preferência de cada um (Replays Desligado) e o "Pular".
- **TM:** ligado, como a partida. Pedido e súmula não mudam. O "Simular o resto" (`simularResto`, main.js:1937) limpa
  o armado, zera o `lances` e o histórico de replays (rev. R21).
- **Modo Livre, Pênaltis 3D e treinos:** nada (o `lances` nem é criado).

### 2.6 Contrato (texto para o `CONTRATOS.md`)
Ver §7.1.

### 2.7 Testes
- **`tools/teste-replay-paradas.mjs`** (Node, padrão; `--js <pasta>` mede a base): 24 partidas IA × IA gravando o anel
  com `tools/lib/anel-node.mjs`, que grava exatamente como o `main.js`.

  | Item | O que confere |
  |---|---|
  | P1 gatilhos | Um árbitro INDEPENDENTE escrito no teste (como o do `teste-impedimento`) classifica cada bola morta pelos eventos. `lancesPasso` tem de bater 100% nas classes A e ≥ 98% nas B; nenhum replay em lateral/tiro de meta sem lance. |
  | P2 roteiro | ≤ 2 planos, ≤ 8,0 s (`duracao`), a chave dentro do P1, o P2 a 0,5×, nenhum corte atravessado, null com a chave fora do anel. |
  | P3 orçamento | ≤ 3 por tempo; ≥ 30 s de bola rolando entre dois replays automáticos (a classe A pode furar o teto, não o "um por parada"). Média de 2–5 replays de parada por partida. Fatia do ar em replay (gol + impedimento + paradas) entre 8% e 16% do tempo de jogo (SoccerNet: 13,3%). |
  | P4 pureza | `hashMundo` igual com e sem o `lancesPasso` em cada passo; nada escrito no mundo. |
  | P5 predicado (rev. R13) | Em 24 partidas, `montaNoProximoPasso(m)` antes de cada passo bate 100% com o passo real: a parada montou (`m.parada.cobrador` saiu de null) ou o tempo acabou (`fimDoTempo`). Isso guarda a cópia da regra contra mudanças futuras no `partida.js`. |

  - Na base reprova P1–P3 e P5: `js/lances.js` e `roteiroParada` não existem. P4 não tem o que medir na base.
- **`tools/teste-replay-paradas-tela.mjs`** (navegador, CI; no `rodar-navegador.mjs`): semente achada em Node por
  `tools/lib/acha-parada.mjs` com `comoPagina: true` (a lição do `acha-gol`), página
  `?demo=1&replayParada=1&comemoracao=0&substituicao=0&cenas=0`. É preciso abrir com `?demo=1` (o webdriver desliga).

  | Item | O que confere |
  |---|---|
  | V1 | O replay começa no tick `pr.inicio + 59` (o passo antes da montagem), com `tipo: 'parada'`. |
  | V2 | O `mundo.tick` não anda durante o replay. |
  | V3 | Planos e câmeras do roteiro; a marca REPLAY; 0 texto fora do placar. |
  | V4 | O hash no tick T depois do replay é igual ao da aba com `?replayParada=0`. |
  | V5 | O "Pular" por tecla e por toque funciona, e o aperto não vira jogada. |
  | V6 | Com "Replays: Desligado", nenhum replay de parada. |
  | V7 | Celular 844×390 Média: chamadas e CPU por plano dentro da régua do `teste-replay` G6. |
  | V8 | Online com duas abas pelo BroadcastChannel (`?online=…&transporte=bc&ia=1&replayParada=1` nas DUAS, rev. R26; o webdriver desliga). Os dois mostram o replay, não há dessincronia, e o hash a cada 60 passos bate. Variante: uma aba com `?replay=0` (só um lado segura) — a outra espera e não há dessincronia. |
  | V9 | `?corpo=humano`. |
  | V10 (rev. R2) | No tick da espera, o `mundo` não foi escrito: o hash e o estado da IA (`j.ia`) de antes e de depois do quadro que começou o replay são iguais. Pega a espera depois da entrada da demo. |

  - Na base reprova V1–V3, V5, V7, V8 e V10: não há replay na parada. (rev. R16) V4, V6 e V9 passam na base porque não
    têm o que medir. Eles ficam como guarda do depois.
- **Outros:** `teste-replay`, `teste-replay-anel`, `teste-hud-minimo`, `teste-carga`, `hash-igual`, `hash-partida`,
  `fecho-hash --diff origin/main`.
- **Local (modo enxuto):** `teste-replay-paradas`, `teste-replay-anel`, `teste-replay-paradas-tela`, `teste-replay`,
  hash e fecho.

---

## 3. PR 2 — Cenas de cartão

### 3.1 O que o jogador vê
Mundo parado no tick do cartão. A Lei 12.3 já diz que o jogo não recomeça antes de a sanção ser aplicada.

- **Amarelo, 5,45 s:**
  1. `arbitro`, 1,95 s:
     - O árbitro já vem correndo de 6–8 m (pré-rolagem invisível) e para a 2,0–2,8 m do punido, de frente
       ("reasonable distance", US Soccer).
     - Tira o cartão do bolso da camisa e o ergue com o braço reto, a mão ≥ 0,25 m acima da cabeça, por 1,3 s.
     - A câmera fica longe da reta até o cartão e ninguém entra na frente.
  2. `reacao`, 2,5 s: o punido reage.
     - Variações por hash do lance, nunca a mesma duas vezes seguidas: `abertos` (braços abertos reclamando), `cabeca`
       (mãos na cabeça, dá as costas) ou `aceita` (pede desculpa).
     - Só o capitão chega a menos de 4 m do árbitro ("só o capitão", UEFA/PL 2025-26).
     - Os outros são afastados com o braço estendido, a 5,4 m (IFAB/NISOA).
  3. `anota`, 1,0 s: o árbitro anota no caderno.
- **Vermelho, 8,9 s:**
  1. `arbitro`, 1,9 s: o cartão sai de trás do calção.
  2. `reacao`, 2,5 s: `cabisbaixo`, `segurado` (companheiros seguram o punido) ou `rosto` (mãos no rosto).
  3. `saida`, 1,5 s: o expulso anda para fora pelo ponto mais perto. A Lei 12 manda sair das imediações do campo.
  4. `tunel`, 2,0 s: ELIPSE (corte) com o expulso a 10–13 m da boca do túnel; o vão das placas se abre.
  5. `torcida`, 1,0 s: a vaia ou o aplauso ao expulso (`render/emocao.js`).
- **2º amarelo, 9,9 s:** o amarelo por 1,0 s → guarda (0,35 s) → o vermelho por 1,2 s, e depois o mesmo do vermelho.
- **Tarja de identificação, até 6 s** (DFL: "identificação do jogador com cartão", 6 s):
  - Entra quando o cartão sobe e sai com a cena: amarelo 5,45 s, vermelho até 6 s. (rev. R10) Não fica por cima da
    bola rolando: seria texto fora do placar no H2 do `teste-hud-minimo`, e o `em-replay` a esconderia no replay que
    vem logo depois.
  - Mostra o cartão desenhado (amarelo, vermelho ou os dois no 2º amarelo), a sigla, a cor e o escudo do time, o
    número e o nome do jogador.
  - Não diz o motivo nem o minuto.
- O `#cartao-icone` não aparece para quem teve cena. Sem a cena (desligada, online), aparece como hoje.
- **Som:** o apito da falta já toca no evento. A vaia ao expulso vem por `emocao` (`aplausoExpulso`/vaia), no relógio do desenho.

### 3.2 Módulos (porte da branch `origin/golaco/cenas-jogo`, commit 1df2ca34)
- **`js/cenas-config.js`:** `CENAS`, `CENA_CARTAO` e `CAMERA_GERAL`, copiados do `config.js` da branch (:1274–1340),
  com as fontes (§6).
- **`js/cena-atores.js`** (branch, 746 linhas):
  - importa as constantes do `cenas-config.js`;
  - COPIA da `comemoracao.js` da main os três ajudantes que ela não exporta: `moverJuntas` (:503), `inclinarTronco`
    (:509) e `flexionar` (:642). Exportá-los mudaria um arquivo do fecho.
- **`js/cena-cartao.js`** (branch, 897 linhas). As três variações de amarelo e as três de vermelho como estão.
- **`js/prejogo-roteiro.js`:** `cameraDoPlano` (branch, +23 linhas; fora do fecho).
- **`render/vao-placas.js`** (novo): o `criarVaoPlacas` sai do `render/prejogo.js` (:50, não exportado) e é exportado
  aqui. O `prejogo.js` e as cenas importam dele, e o pré-jogo desligado não obriga a baixar o `prejogo.js`.
- **`render/cartao3d.js`** (branch, 41 linhas): cartão de 11×16 cm, cor plana #f5c518/#e5484d, 1 chamada só quando visível.
- **`render/emocao.js`:** `cartaoCena`, `aplausoExpulso` (da branch).
- **`js/cenas-tela.js` + `css/cenas.css`** (novos, sob demanda): a tarja de identificação. Os PRs 3 e 4 acrescentam as outras.
- **Fica FORA do porte:** as mudanças da branch dentro da `comemoracao.js` (o corte da torcida e o do treinador no gol;
  162 linhas, do fecho). Se o dono quiser os dois cortes, eles entram depois como planos de câmera do `main.js`, sem
  mexer na comemoração.

### 3.3 Ganchos no `main.js` (refeitos em cima da main de hoje, não mesclados: 1.769 → 3.024 linhas desde a base da branch)
- `decidirCartao(eventos)` no fim do `rodarPasso`, ao lado do `decidirSubst`, usando `escolherCartao(eventos)`: o mais
  grave do passo; o 2º amarelo vira UM vermelho com `segundo`.
  - Se há replay ou cena em andamento, vai para a fila como `{tipo: 'cartao', ...}`.
  - Se não, começa (`iniciarCartao`).
  - Com `cenasLigadas && !emRodarPassos && !ONLINE`.
- **Expulso:** copiado de `m.expulsos` (o objeto fica lá) com a posição do tick anterior pelo anel (`jogadorNoTick`, como faz a substituição).
- **`quadro`:** um ramo `cenaCartao` igual ao da `cenaSub`.
  - Laço parado. (rev. R1) Os treinadores VIVOS NÃO andam (nada de `passoTecnicos` com `leituraVazia`) e saem da lista
    de desenho; a cena desenha cópias deles (`treinadorDoTime` já devolve cópia). Se andassem, o 1º passo gravado
    depois da cena viraria CORTE no anel (`REPLAY.saltoTecnico` 0,25 m, main.js:588–594), e o replay da falta não
    atravessaria o corte.
  - O estádio anda no relógio do desenho (`estadioSegurado`).
  - O desenho (`desenharQuadro`) usa os atores da cena, e o `cartaoNaMao(c, pose, out)` põe o cartão na mão pela junta da pose.
  - No fim da cena: `corteCamera = true` e o estado de desenho dos jogadores (`estJ`) volta ao do mundo, sem
    interpolar das cópias. Os jogadores voltam para onde estavam no apito, com um corte, como no fim da `cenaSub`.
- **Ordem** (rev. R7; a §1.3 tem o quadro inteiro):
  - Falta: cartão no tick do apito → 1 s ao vivo → replay de parada (armado, PR 1) no passo antes da montagem. É a
    ordem da TV: reação → replay.
  - Vantagem que acabou em gol: o cartão espera em gol + 149 (`cartaoGolNoPonto`, branch), DEPOIS da comemoração. Ele
    começa quando a comemoração acaba ou é pulada. Com a cortina (`cenaRapida`, 40 passos por quadro), a cortina PARA no
    gol + 149, porque o `cartaoGolNoPonto` é checado no topo de cada volta, também na cortina. Ao começar, a cena da
    comemoração sai do desenho (`encerrarComemoracao` sem a saída; o `cenaGol` 'solta' não desenha mais) e o
    `hud.cortina` acaba. Depois: saída → replay do gol.
  - Cartão no mesmo passo de um replay (impedimento com o cartão pendente da vantagem): vai para a fila e entra depois
    do replay. O mundo ainda está no tick do apito.
- `jog3d.reservar(... + 3)`: hoje 35 vagas (main.js:2248), mais os 3 árbitros 200–202.
- **"Simular o resto" e "Jogar de novo":** zeram a cena, a fila, o `cartaoGolPendente`, as tarjas e o `hud.cena(false)` (rev. R21).
- TM "só o meu jogador" com o travado expulso: a cena do vermelho é dele. (rev. R11) A faixa "Você foi expulso /
  Simular o resto" (:811–815) hoje sai NO EVENTO, com `ms: 6000`. Escondida por `em-cena`/`em-replay` (estilo.css:638–650),
  o tempo dela correria sem ninguém ver. Agora ela entra depois da cena E do replay de parada (classe A, vermelho), e os
  6 s contam a partir de quando aparece. O `expulsoAvisado` (a entrada neutra) continua valendo desde o evento.
- (rev. R23) Sem o `SOB.cenas` baixado: o ícone de hoje, sem segurar.
- **API `__golaco.cenas`:** `{ligado, ligar(b), ativo, tipo, fila, pular(), forcarVariante(cor, v), atores(), cartao3d,
  naTela(id | 'cartao'), custo, zerarCusto()}`. O `faltaDeTeste` passa a devolver `cena` também.

### 3.4 Online, TM, Livre, treinos
- **Online:** desligada. Fica só o ícone de hoje (rev. R10; §1.6).
- **TM:** ligada; o pedido não muda. A súmula já conta os cartões (`resultadoTM` → `cartoes`) e não muda.
- **Livre:** não há cartões, então nada. **Pênaltis e treinos:** nada.

### 3.5 Contrato
Ver §7.2 (adaptado do contrato "Cenas de cartão e de fim de tempo" da branch, :592).

### 3.6 Testes
- **`tools/teste-cenas.mjs`** (Node, padrão; o da branch, 793 linhas, com o fim de tempo saindo para o PR 3).

  | Item | O que confere |
  |---|---|
  | A canhão de 144 cartões | Estados do MEIO de partidas IA × IA (estados de saída são quase iguais e enganam). O árbitro chega a 2,0–2,8 m. O cartão fica ≥ 0,25 m acima da cabeça por ≥ 1,0 s no plano `arbitro`. A câmera vê cartão e rosto (`tampaCartao` = 0). Ninguém além do capitão e do punido a < 4 m do árbitro. Ninguém atravessa ninguém (`separacao`), dentro de sólido nem dentro do gol. No vermelho, o expulso cruza z > 34 no plano `saida` e aparece a 10–13 m da boca no `tunel`. |
  | B variedade | As 3 + 3 variações, sem repetir a anterior; o 2º amarelo com o amarelo antes do vermelho. |
  | E pureza | `hashMundo` e `m.tick` iguais; nada escrito no mundo. |
  | F | Relógio do estádio. |
  | G custo | CPU do fio (schedstat, como o `teste-comemoracao` 12), ≤ o custo por passo da comemoração. |

  - Ajustes ao porte: o gancho do treinador com os ids 210/211 (a branch esperava ≥ 300) e as constantes do `cenas-config.js`.
  - Na base reprova (módulos ausentes).
- **`tools/teste-cenas-tela.mjs`** (navegador, CI e deploy; parte `cartao`; o da branch, 449 linhas, refeito para a
  main de hoje). `faltaDeTeste({cartao: 'amarelo' | 'vermelho'})` e o 2º amarelo.

  | Item | O que confere |
  |---|---|
  | C1 | A cena ativa, tipo `cartao`. |
  | C2 | O `mundo.tick` parado. |
  | C3 | O cartão na tela, na mão: ≤ 6 cm da junta desenhada, também com `?corpo=humano`. |
  | C4 | A tarja com número e nome enquanto a cena dura, e fora dela some (rev. R10). Medida pelo estado da página, não por tempo fixo (rev. R24: o relógio das animações CSS atrasa sem GPU). Não encosta no placar nem no "Pular" (844×390, 667×375, 568×320). |
  | C5 | Pular por toque e por tecla depois de 0,5 s; antes disso, nada. |
  | C6 | Sem `#cartao-icone` para ele. |
  | C7 | O hash no mesmo tick depois da cena é igual ao da aba com `?cenas=0`. |
  | C8 | Celular Média: ≤ 40 chamadas e ≤ 130 mil triângulos no pior plano (a meta do pré-jogo), com o manequim e com `?corpo=humano` (o teto de triângulos do `lod-humano.js`). |
  | C9 | Com o replay de parada armado, a ordem é cartão → replay → montagem. (rev. R1) O replay toca INTEIRO, com a chave − `tv.antes` dentro do P1: `anel.primeiroCorte(chave − tv.antes, tick da espera) == null`, e os treinadores vivos no mesmo x/z antes e depois da cena. |
  | C10 | O submenu "Modo de jogo" com o botão novo cabe sem rolar em 844×390. |
  | C11 (rev. R7) | Vantagem que vira gol com cartão: comemoração → cartão (o `mundo.tick` em gol + 149) → saída → replay do gol. Também com a comemoração pulada antes da hora: a cortina para no gol + 149. |
  | C12 (rev. R11) | TM travado expulso: a faixa "Você foi expulso" aparece depois da cena e do replay e fica visível ≥ 5 s. |

  - Na base reprova C1–C6, C8, C9, C11 e C12. (rev. R16) C7 e C10 passam na base porque não têm o que medir; ficam como
    guarda.
- **Outros:** `teste-hud-minimo`, `teste-controles`, `teste-tm-tela` e `testar-3d` (mexeu em main.js e hud.js), `hash-igual`, `hash-partida`, fecho.

---

## 4. PR 3 — Cena de intervalo

### 4.1 O que o jogador vê (18–30 s; toque/Enter/A = próximo bloco, no geral a saída do 2º tempo; "Pular" (toque) = a saída; Esc/P/Start = a pausa)
1. **`apito`, 1,5 s:** plano alto; o árbitro apita (`gApito`). O apito do intervalo toca no início, sem adiar. (rev.
   R6) Com gol no último lance, o apito ficou em `somAdiado` (`estadioPasso` adia o passo que traz o `intervalo` com
   gol pendente). A cena chama `tocarAdiados()` ao começar; senão o apito tocaria só no fim da cena, quando a fila
   esvazia.
2. **`campo`, 2,5 s:** os jogadores em campo. O placar pesa no gesto: quem perde de cabeça baixa; 62% com as mãos na
   cintura; 2 com as mãos nos joelhos (constantes da branch).
3. **`tunel`, 3,5 s:** ELIPSE: o funil para o túnel, a câmera na boca dele (x 6,5, y 1,6, z 38,3, fov 40) e o vão das
   placas aberto. A PL não deixa câmera no vestiário no intervalo, então a TV mostra o caminho do túnel. A tarja do
   placar do intervalo com os autores entra aqui, 4 s depois do apito, e fica 8 s. DFL: +20 s do apito por 8 s; o
   tempo de campo ÷ 11,25 ≈ 1,8 s, arredondado para depois dos dois primeiros planos para não cobrir os jogadores.
4. **`torcida`, 1,5 s:** a torcida pelo placar (palmas/vaia; `emocao`).
5. **Lances do 1º tempo, 0–2 × ≤ 6 s:** os gols do 1º tempo primeiro e depois a melhor chance A/B. Vêm do guardador e
   passam pelo diretor (TV 1×, um ângulo cada, a vinheta entre eles). Nada se o tempo não teve gol nem chance A/B.
6. **Estatísticas do 1º tempo, 6 s:** sobre o plano geral do estádio vazio (`CAMERA_GERAL`). Posse, finalizações, no
   alvo, escanteios, faltas e cartões: só rótulos e números, sem frase (wTVision).
7. **`geral`, 3 s:** o laço é SOLTO. Os 3 s de `PARTIDA.intervalo` correm por baixo; a troca de lado e a montagem da
   saída acontecem como hoje; a `saida` acaba a cena. A faixa ENTRA/SAI das trocas do intervalo (`faixaSub2T`) entra na
   saída, como hoje. DFL: aos 46', 6 s.
   - (rev.) Durante o `geral`, o desenho continua o da CENA: o campo vazio, porque os 22 da cena entraram no túnel.
     O mundo vivo, com os 22 parados no meio do campo, só aparece no corte da `saida`, já com a montagem.
   - Os treinadores vivos voltam a andar com o laço solto, mas só voltam ao desenho na saída.

- **Total:** 18 s (sem lances) a 30 s. A DFL faz ~17 min, que ÷ 11,25 = 90 s. Aqui fica bem mais curto, como os jogos
  (FC 24 cortou introduções porque a maioria pulava).
- **Fora desta versão:** a volta pelo túnel antes da saída (o cortejo curto). Entra depois se o dono pedir (+3–4 s).

### 4.2 Módulos
- **`js/cena-fim.js`** (branch, 738 linhas): `planejarFim(m, 'intervalo', {placar, timeHumano, treinadores})`,
  `criarCenaFim`, `passoCenaFim`, `avancarCenaFim`, `faseFim`, `pularParaGeral`, `planoCameraFim`, `consumirEventosFim`.
  Os treinadores pelo gancho da main, `tecnicos.js treinadorDoTime(T, t)` (210/211; tecnicos.js:1073).
- **`render/lances-guarda.js`** (NOVO, puro), o guardador de lances.
  - **Formato:** até `LANCES_GUARDA.lances` = 6 lances de ≤ 6 s, a 30 Hz.
    - Por vaga: id (Int16), info (Uint8, com o bit de corte), x/z/rumo (Float32).
    - Pose em Int16 relativa ao x/z do jogador. (rev. R20) Escala 1/4000 m: ±8,19 m, erro ≤ 0,13 mm. A 1/8000 m
      (±4,09 m) ficava apertada para o mergulho desenhado do goleiro e para o cabeceio no alto. Fora da faixa satura,
      e o G2 mede o pior caso.
    - Bola p+q (Float32), o relógio do estádio e (rev. R20) as batidas da bola na rede dentro da janela. O `ondas` da
      página só guarda as batidas recentes; sem elas, a rede de um gol do 1º tempo não balança no intervalo.
  - **Memória:** ~0,58 MB por lance, 3,5 MB fixos. (rev. R20) Alocados na 1ª partida, depois de o módulo chegar, não
    na pré-carga (que roda também nos treinos). O anel tem 3,36 MB.
  - `guardar(G, anel, lance)` copia `[lance.chave − 2,5 s, lance.fim + 0,5 s]` do anel, cortado a
    `LANCES_GUARDA.segundos` pelo começo. (rev. R9) A chance vai até 2,5 + 4 + 0,5 = 7 s.
    - (rev. R9) A parada é guardada no passo ANTES DA MONTAGEM (`seguraParaReplayParada`), com ou sem replay. É ali
      que a janela até `fim + 0,5 s` já está gravada; no armar, na bola morta, ela ainda não está.
    - (rev. R9) O gol é guardado no `posGol()`, na saída/intervalo/fim, com ou sem `replayAuto` e com ou sem o replay
      ter entrado. Com Replays: Desligado, os gols também vão para os melhores momentos.
    - Até 1 lance por parada. Cheio: sai o de menor `peso`. Gol nunca sai por chance.
  - `tocar(G, k, mini)` descomprime para um MINI-ANEL: `criarAnel({ticks: 360, vagas: CFG.REPLAY.vagas, nj: NJ})`, o
    mesmo formato do anel (rev. R20). São 6 s a 60 Hz, interpolando 30 → 60, sem interpolar através de corte, ~2 MB
    fixos. O diretor toca o lance com os leitores de hoje, sem leitor novo.
  - **Total:** ~+5,5 MB fixos (§9).
- **`render/replay.js`** (rev. R8):
  - `diretor.iniciar(ro, fonte = anel)` aceita o mini-anel como fonte. Passam a ler a `fonte` em vez do `anel` do
    fecho: `posicionar` ('tv', 'atras', 'fechada'), `jogadorNoTick`, `bolaNoTick`, `tecnicosNoTick`,
    `zLateralDoPlano`, `defensorDaLinha` e o enquadramento da SAOT.
  - No `main.js`, o `desenharReplay` lê `lerQuadro(diretor.fonte, …)` e `tempoEstadioAnel(diretor.fonte, …)`.
  - `iniciarReplay(ro, {fonte, aoFim})`: o replay de DENTRO de uma cena (os lances do intervalo, os "Melhores
    momentos") chama `aoFim` no fim ou no pulo, e não o `proximaCena()`, que tiraria o jogador da cena.
  - O "Pular" do ramo `diretor.ativo` pula o lance; o "Pular" da cena (saída/faixa; só com toque) pula o resto —
    Toque/Enter/A andam bloco a bloco e Esc/P/Start abrem a pausa.
  - Roteiro `roteiroLance(fonte, lance)`: um plano 'tv' 1×.
- **`js/sumula.js`** (fora do fecho):
  - ganha `escanteios[2]`. (rev. R17) Contados na BOLA MORTA (`m.parada` novo com `tipo === 'escanteio'`), não no
    evento `escanteio`, que só sai na montagem: o escanteio cuja montagem não chega (fim do tempo) também conta;
  - ganha `faltas[2]` (cometidas: `falta.time` é quem sofreu);
  - ganha `porTempo` (cópia dos números no apito do 1º tempo, para o intervalo);
  - `resultadoTM` não muda (o TM recebe o mesmo; `teste-ponte-tm` confere campo a campo).
  - No `main.js` a súmula passa a ser criada SEMPRE na partida (`sumula = criarSumula()`; com `?tm` é a mesma
    `sumulaTM`). Ela só lê e é barata. (rev. R4) Hoje o `sumula.js` só é baixado com `?tm` (main.js:131–133, import
    dinâmico com `PEDIDO_TM`): passa a import ESTÁTICO (+14,7 KB no download inicial, anotado no PR). O
    `sumulaPasso` continua só com `mundo.modo === 'partida'` (fora do Livre e da disputa), no `rodarPasso` e no
    `simularResto`.
- **`js/cenas-tela.js` + `css/cenas.css`:** tarja do placar com autores e painel de estatísticas.
  - **Placar com autores:** escudo, sigla e placar dos dois times. Embaixo, os autores de cada lado: "Nome 12', 38'"
    (contra = "(c)", pênalti = "(p)"), como a tarja da DFL.
  - O painel some sozinho.
- **`js/cenas-config.js`:** `CENA_FIM` (intervalo) e `LANCES_GUARDA` (§6).
- **`render/emocao.js`:** `cenaFim` (palmas/vaia pelo placar; branch).
- **`render/prejogo.js` / `render/vao-placas.js`:** o vão das placas no plano `tunel` (do PR 2).

### 4.3 Ganchos no `main.js`
- **Evento `intervalo`** (:775):
  - Com `cenasLigadas && !ONLINE && !emRodarPassos`, a cena entra na fila `{tipo: 'intervalo'}`, depois do replay do
    gol do último lance e do cartão do último apito. Sem cena, a faixa de hoje.
  - `seguraIntervalo()` no laço, ao lado do `seguraSimulacao`: parado no tick do evento enquanto a cena está antes do
    plano `geral`. Segurar em qualquer tick do intervalo é seguro: o mundo não muda nele.
  - No `geral`, o laço solta e a `saida` encerra a cena.
- **Guardador** (rev. R9): o gol no `posGol()`, com ou sem replay. A parada (classe A/B) no passo antes da montagem,
  com ou sem replay. O módulo chega pelo `SOB.cenas`; se não chegou, pede, e guarda quando chegar se a janela ainda
  estiver no anel.
- **"Editar time" na pausa:** funciona durante a cena (a pausa congela a cena). A edição entra no 1º passo depois que o
  laço solta (no `geral`, ainda no estado 'intervalo') e vale como troca do intervalo (Regra 3), como hoje.
- **"Simular o resto":** limpa a cena, a fila, o guardador, as tarjas e o `hud.cena(false)` (rev. R21).
- (rev. R23) Sem o `SOB.cenas` baixado: a faixa de 3 s de hoje, sem segurar.

### 4.4 Online, TM, Livre, treinos
- **Online:** desligada. A faixa de 3 s de hoje continua, mais a tarja do placar com autores só nesses 3 s, com o
  mundo parado (rev. R10). Os 8 s da DFL passariam 5 s por cima do 2º tempo, contra o H2 do `teste-hud-minimo`.
- **TM:** ligada (pausa "Cenas da partida"). As estatísticas vêm da mesma súmula do resultado. Pedido: nada novo.
- **Livre, Pênaltis 3D e treinos:** não têm intervalo; nada.

### 4.5 Contrato
Ver §7.3.

### 4.6 Testes
- **`tools/teste-cenas.mjs` C-intervalo** (Node): 56 intervalos de partidas IA × IA, incluindo gol no último lance,
  cartão no último apito, time com 10 e goleiro expulso.
  - Planos e tempos.
  - O árbitro apita.
  - No fim do `tunel`, os 22 dentro da boca (z > 44,5 − 0,5) ou já cortados pela elipse.
  - Ninguém em sólido; pureza.
- **`tools/teste-lances-guarda.mjs`** (Node, padrão; a base não tem o módulo e reprova):

  | Item | O que confere |
  |---|---|
  | G1 memória | Bytes iguais antes e depois de guardar 100 lances; nada alocado no `guardar` nem no `tocar`. |
  | G2 quantização | Erro ≤ 2 mm por junta e ≤ 1 mm na bola, também no pior caso medido nas partidas (mergulho do goleiro, cabeceio): nenhuma junta saturada (rev. R20). |
  | G6 janelas (rev. R9) | Em 24 partidas IA × IA, todo gol fica guardado, também com `replayAuto` falso. Toda parada A/B guardada tem a janela inteira até `fim + 0,5 s` e nenhum corte dentro dela. |
  | G3 tocar | O `lerQuadro` do mini-anel = o do anel original no mesmo tick (≤ 2 mm); o tick do meio (interpolado 30 → 60) a ≤ 1 cm. |
  | G4 prioridade | Gol nunca sai por chance; cheio, sai o de menor peso; o mais antigo desempata. |
  | G5 custo | `guardar` ≤ 2 ms e `tocar` ≤ 6 ms (CPU do fio). |

- **`tools/teste-ponte-tm.mjs`** (estendido): `escanteios` e `faltas` por time contra um contador independente; o
  `resultadoTM` campo a campo igual ao de antes.
- **`tools/teste-cenas-tela.mjs` parte `intervalo`** (navegador): partida curta, `?cenas=1`.

  | Item | O que confere |
  |---|---|
  | I1 | A cena ativa no tick do intervalo; o `mundo.tick` parado até o `geral`. |
  | I2 | A tarja do placar com autores (os nomes batem com `sumula.gols`) por 8 s, medida pelo estado da página (rev. R24). |
  | I3 | Os lances do guardador passam (planos 'tv' com a fonte = mini-anel). No fim de cada lance a cena continua, e não pula para a fila (rev. R8). |
  | I4 | As estatísticas = súmula. |
  | I5 | A saída do 2º tempo sai no MESMO tick e com o MESMO hash da aba com `?cenas=0`. |
  | I6 | Toque = próximo bloco; Pular = saída. |
  | I7 | Pausa e celular em pé congelam. |
  | I8 | Nada encosta em 844×390, 667×375 e 568×320. |
  | I9 | Celular Média: chamadas e triângulos dentro da meta. |
  | I10 | `?corpo=humano`. |
  | I11 (rev. R6) | Gol no último lance do 1º tempo: o apito do intervalo é pedido (`sonsPedidos`) no plano `apito` da cena, não no fim dela. |
  | I12 (rev.) | No `geral`, nenhum dos 22 vivos é desenhado até o corte da `saida`. |

  - Na base reprova I1–I4, I6, I11 e I12: só a faixa de 3 s. (rev. R16) I5 passa na base porque não tem o que medir;
    fica como guarda.
- **Outros:** `teste-hud-minimo`, `teste-carga` (folga ≥ 120 KB com a lista nova), `teste-tm-tela`, `testar-3d`, hash, fecho.

---

## 5. PR 4 — Cena de pós-jogo

### 5.1 O que o jogador vê (~34,5 s; toque/Enter/A = próximo bloco; "Pular" (toque) = faixa final; Esc/P/Start = a pausa, como no intervalo)
No `fim` o mundo não muda mais, mas (rev. R5) o `passoPartida` ainda faz `m.tick++` a cada passo. Fora do online, a
cena SEGURA o laço; no online, o lockstep segue andando o tick e a cena só usa cópias (§5.3). A cena substitui os 22
congelados no meio da passada.

1. **`apito`, 1,5 s:** plano alto; o árbitro apita três vezes (`gApito`). (rev. R6) Com gol no último lance, a cena
   chama `tocarAdiados()` ao começar.
2. **`vencedor`, 3,0 s:** quem ganhou comemora com os gestos e o abraço da comemoração. No empate, `neutro`, 3,0 s.
3. **`perdedor`, 2,5 s:** agachados, mãos na cabeça e nos joelhos (posturas da `cena-atores`). Não existe no empate.
4. **`cumprimentos`, 2,0 s:**
   - Até 6 duplas de adversários a ≤ 6 m se cumprimentam (aperto de mão; UEFA 50.04 na branch).
   - O árbitro cumprimenta um capitão.
   - **Troca de camisa:** 1 par sorteado por hash do jogo (sem `m.rng`). Depois de uma ELIPSE, o par aparece abraçado,
     cada um com a camisa do outro (kit misto: camisa do adversário, calção e meião próprios). É costume de fim de
     jogo e nenhuma regra proíbe. (rev. R19) O kit derivado vai no `jogador3d` (manequim) E no `humano3d` (corpo novo,
     o padrão na edição pro; `tKits` por chave). Na versão de teste, a camisa de A vai com o patrocínio dela. Se o kit
     misto custar mais de 1 chamada no celular em qualquer dos dois, a troca sai desta versão (§9).
5. **`treinador`, 2,0 s:** os dois treinadores (210/211) se cumprimentam na linha (gancho `treinadorDoTime`, que
   devolve CÓPIA). Sem treinadores (`?tecnicos=0`), o plano não entra. (rev. R5) Os treinadores vivos ficam fora do
   desenho durante a cena; senão apareceriam dois com o mesmo id.
6. **`aplauso`, 2,5 s:** ELIPSE: o time da pessoa aplaude a torcida dele, ao lado do gol.
7. **`torcida`, 2,0 s:** a festa de quem ganhou (os sinalizadores da vitória, `festa.js` :280) ou a vaia e o silêncio de quem perdeu.
8. **`melhor`, 5,0 s:** MELHOR EM CAMPO.
   - Close 3D dele andando ou aplaudindo (com o rosto real na edição pro), mais a tarja: número, nome, "Melhor em
     campo" e a nota com uma casa.
   - Escolha: `notaDoJogador` da súmula para todos que jogaram (expulso não). Desempate: gols, assistências e o menor id.
   - (rev. R18) A nota da tarja é a MESMA que o TM mostra: a mesma função e as mesmas opções (vitória/derrota) do
     `resultadoTM`. No Rumo ao Estrelato, a nota do travado na tarja = a do resultado.
   - Premier League e Globo dão o prêmio logo depois do jogo.
9. **`geral`:**
   - A tarja do placar final com os autores, 8 s (DFL).
   - Depois as estatísticas da partida, 6 s (as 6 do intervalo).
   - Depois a faixa final de hoje: "Fim de jogo" + placar + "Jogar de novo" (no TM, "Voltar ao Total Match").
   - Na faixa final, um 2º botão "Melhores momentos" passa os lances do guardador: até 6, gols primeiro, ≤ 30 s, um
     ângulo cada. Pular volta à faixa.
- **Automático:** 34,5 s; no empate 32 s; sem treinadores −2 s. A DFL faz 2:30 de campo, que ÷ 11,25 = 13,3 s; os
  planos 1–7 somam 15,5 s. As tarjas mantêm o tempo de leitura real (8 s, 6 s, 5 s): ler não acelera.
- **Melhores momentos:** fora da sequência automática. É um botão porque os jogos mostram que a maioria pula, e a TV
  põe os melhores momentos no fim do sinal.

### 5.2 Módulos
- **`js/cena-fim.js`:**
  - `planejarFim(m, 'fimDeJogo', ...)` da branch, com o plano novo `melhor` e a troca de camisa;
  - `vencedor/perdedor/neutro/cumprimentos/treinador/aplauso/torcida/geral` como na branch;
  - variante curta `fimCurto` = `apito → neutro → torcida → geral` (sem cumprimentos, troca nem melhor em campo), para
    o empate que continua no TM.
- **`js/sumula.js`:**
  - `melhorEmCampo(s, m)` devolve `{id, time, nota}`.
  - `resultadoTM` ganha o campo OPCIONAL `melhor: {lado, tmId, nome, nota}`. O TM ignora campos que não conhece;
    `teste-ponte-tm` confere que o resto não muda.
- **`js/cenas-tela.js`:** tarja do melhor em campo e o 2º botão da faixa final. O botão vai no `hud.faixa` com
  `botao2Texto/botao2Cmd`, sem quebrar as chamadas de hoje.
- **`render/jogador3d.js` e `render/humano3d.js`** (rev. R19): o kit derivado `troca:<kitA>:<kitB>` (camisa de A, com
  o patrocínio dela na versão de teste; o resto de B). Só no pós-jogo.
- **`js/cenas-config.js`:** `CENA_FIM.planos.vitoria/empate/curto`, `melhor`, `placar` e `estatisticas` (§6).
- **Lado do TM** (`legacy-total-match/js/tm3d.js partidaDe`): o pedido ganha `partida.empateContinua`.
  - Vale `true` quando o modo sabe que o empate vai para prorrogação ou pênaltis. O 3D cuida só dos 90 minutos.
  - Sem o campo, no TM, o empate usa a versão curta (é seguro nos dois casos).
  - Versão nova do TM: `?v=NNN` + `sw.js`.

### 5.3 Ganchos no `main.js`
- **Evento `fimDeJogo`** (:782):
  - O `gravarResultadoTM` no apito NÃO muda: o TM lê dali se a mensagem se perder.
  - Com `cenasLigadas`, a cena entra na fila `{tipo: 'fim'}`, depois do replay do gol do último lance e do cartão.
    Sem cena ou sem o `SOB.cenas` baixado (rev. R23), a faixa de hoje.
  - (rev. R5) Fora do online, a cena SEGURA o laço até a faixa final: `laco.ultimo = agora`, nenhum `rodarPasso`. Não
    há o que perder, porque em `fim` só o `m.tick` andaria, e o resultado do TM já está gravado no apito. Sem isso, o
    `rodarPasso` seguiria por baixo da cena: `passoTecnicos` no estado 'fim' com os treinadores vivos desenhados junto
    com as cópias da cena, o anel gravando quadros parados e CPU à toa.
  - No online não segura. Segurar só o meu lado no `fim` é inofensivo (o aviso já fica escondido com `ctx.fim`), mas a
    cena não precisa. Ela anda no `quadroOnline`, num ramo novo ao lado da `cenaGol`, só com cópias, e o lockstep
    continua andando o tick.
- **`voltarAoTM`** (:1988): continua a 1 toque pela pausa (Esc/Start → "Voltar ao Total Match"). Na cena, "Pular" leva
  à faixa final com o botão, que é o 2º toque.
- **TM:** o bloco de estatísticas não entra (o TM mostra as dele e o `TM.ui.posterFim`). Total no TM: 28,5 s.
- **"Simular o resto":** nunca mostra a cena; vai direto à faixa, como hoje (:1974–1983).
- **"Jogar de novo":** zera tudo (cena, fila, guardador, lances, súmula). O pré-jogo segue a preferência, como hoje (:2074).
- **Online:**
  - A cena roda sozinha em cada aparelho.
  - `voltarAoTM` → `fimTM(..., {online: {hashFinal}})` como hoje. O `hashFinal` inclui o tick, que anda no `fim`, mas
    o TM não compara os dois aparelhos (`online3d.js`): nada muda.
  - O W.O. e a dessincronia interrompem a cena (`fimTM` direto).
  - "Melhores momentos" no online usa o diretor: o ramo `diretor.ativo` do `quadroOnline` segura o meu lado no `fim`,
    o que é inofensivo.

### 5.4 Online, TM, Livre, treinos
- **Online:** ligado (§5.3).
- **TM:** ligado, com a versão curta no empate que continua e sem estatísticas. O resultado ganha o `melhor` opcional.
  "Só o meu jogador": a mesma cena. Se o travado for o melhor em campo, o close é dele (o TM mostra a nota dele como hoje).
- **Livre:** sem fim de jogo, nada. **Pênaltis 3D:** a disputa intercepta o `fimDeJogo` (main.js:700), nada.
  **Treinos:** nada.

### 5.5 Contrato
Ver §7.4.

### 5.6 Testes
- **`tools/teste-cenas.mjs` C-fim** (Node): 56 fins com vitória, derrota e empate; gol no último lance; cartão no
  último apito; times com 10; goleiro expulso; empate curto.
  - Planos e tempos (34,5 / 32 / curto).
  - Pares de cumprimento a ≤ 6 m.
  - Ninguém atravessa ninguém.
  - O melhor em campo = argmax da nota recalculada por um código INDEPENDENTE no teste.
  - O treinador 210/211 entra com +2 s.
  - A troca de camisa nunca no goleiro e nunca no expulso; pureza.
- **`tools/teste-ponte-tm.mjs`:** `melhor` presente e certo; o resto do resultado igual campo a campo à base.
- **`tools/teste-cenas-tela.mjs` parte `fim`** (navegador):

  | Item | O que confere |
  |---|---|
  | F1 | A cena começa no `fimDeJogo` (ou depois do replay do gol do último lance). |
  | F2 (rev. R5) | Fora do online, o `mundo.tick` e o `hashMundo` não mudam do apito até a faixa final, porque o laço está seguro. No online (duas abas pelo BroadcastChannel), só o tick anda: o hash com o tick tirado fica igual, e não há dessincronia. |
  | F10 (rev. R5/R6) | Treinadores: só as cópias da cena são desenhadas (um 210 e um 211 na lista). Com gol no último lance, o apito final é pedido no plano `apito`. |
  | F3 | A tarja do placar com os autores e as estatísticas = súmula. |
  | F4 | A tarja do melhor em campo = `sumula.melhorEmCampo`. |
  | F5 | A faixa final com os dois botões; "Melhores momentos" toca o guardador e o Pular volta à faixa. |
  | F6 | Toque = próximo bloco; Pular = faixa. |
  | F7 | TM (`?tm` com `tools/lib/pedidos-tm.mjs`): o resultado está no localStorage ANTES da cena; Pular → "Voltar ao Total Match" em 1 toque; sem bloco de estatísticas; `empateContinua` → versão curta. |
  | F8 | Celular, nada encosta. |
  | F9 | `?corpo=humano`. |

  - Na base reprova F1, F3–F7 e F10: os 22 congelados e só a faixa. Na base, o F2 reprova fora do online, porque o
    tick anda no `fim`; mede o "segura o laço".
- **Ponta a ponta:**
  - `node legacy-total-match/ferramentas/testar-3d.mjs`, edições pública e `--publica`;
  - `ferramentas/testar-online3d.mjs --golaco`: o fim do online com o hash final;
  - `teste-online-tela`.
- **Outros:** `teste-hud-minimo`, `teste-carga`, `teste-tm-tela`, hash, fecho.

---

## 6. Constantes (`golaco/js/cenas-config.js`, fora do fecho) — com as fontes

(rev. R4) O `REPLAY_PARADA` fica dentro do `js/lances.js`, que está no download inicial. O resto (`CAMERA_GERAL`,
`CENAS`, `CENA_CARTAO`, `CENA_FIM`, `LANCES_GUARDA`) fica em `js/cenas-config.js`, importado só pelos módulos sob
demanda. O `main.js` não importa o `cenas-config.js`; ele lê o que precisa pela API do módulo carregado. Os dois
arquivos ficam fora do fecho.

```js
// Cenas das paradas (pedido do dono de 22/10): replays nas paradas, cartão, intervalo e pós-jogo. FORA do fecho do hash
// (tools/fecho-hash.mjs): nenhum módulo da simulação importa este arquivo. Pesquisa e fontes em PESQUISA-CENAS.md.

// ---------------------------------------------------------------- PR 1 — replays nas paradas (em js/lances.js; rev. R4)
export const REPLAY_PARADA = {
  ligado: true,          // padrão (?replayParada=0|1; desligado com webdriver, ?prints=1 e ?demo=1); vale com "Replays: Ligado"
  // teto e espaço: SoccerNet-v2 (500 jogos) — 86,7% dos planos ao vivo, 10,9% + 2,4% em replay → ~13% do ar. Em 8 min de
  // jogo (480 s) com gol (~21 s) e impedimento (~8 s) já no ar, sobram ~40 s para as paradas → ~6 de ~6,8 s por partida
  porTempo: 3,           // replays de parada por tempo (a classe A fura o teto)
  espaco: 30,            // s de bola rolando desde o último replay automático (gol, impedimento ou parada): "nunca dois seguidos"
  maximo: 8.0,           // s por parada — SoccerNet: 6,8 s por plano de replay, 1–3 ângulos; LaLiga (Carranza, COPE
                         // 20/10/2026): "se dá para resolver em dois ângulos, melhor que em três"
  // P1: a jogada na câmera de TV, velocidade real (antesMin: até onde o começo encolhe no orçamento)
  tv: { antes: 2.5, antesMin: 1.0, depois: 1.0, depoisChance: 0.5, vel: 1 },
  // P2: mais fechado e mais lento (patente US7657836: ao vivo → reação → replay fechado e lento); 0,5× = a câmera de
  // trás do gol do replay de hoje (REPLAY.gol.vel[1]). fov: fração do da TV na câmera 'fechada'
  lento: { antes: 0.8, depois: 0.6, antesChance: 0.5, depoisChance: 0.4, vel: 0.5, fov: 0.5 },
  // gatilhos (classe B): chute de dentro da área a ≥ vMin m/s espalmado, ou que saiu a ≤ perto m da trave/travessão;
  // a bola morta até mortaAte s depois do chute; falta a ≤ faltaPerto m do centro do gol (PARTIDA.tiroLivreDireto.chuteMax 30)
  chance: { vMin: 22, perto: 1.5, mortaAte: 4 },
  faltaPerto: 25,
};

// ---------------------------------------------------------------- PR 2 — cartão (da branch golaco/cenas-jogo)
export const CAMERA_GERAL = { de: [0, 34, 78], para: [0, 3, -16], fov: 31 };   // plano geral (torcida inteira, também no celular)
export const CENAS = {
  ligadas: true,         // padrão ("Cenas" no Modo de jogo; ?cenas=0|1; desligadas com webdriver, prints e demo; no online
                         // só o pós-jogo, sem segurar — cartão e intervalo ficam fora: rev. R22)
  pularDepois: 0.5,      // s — antes disso nenhum aperto pula (o da comemoração e da substituição)
  separacao: 0.5, parado: 12, respira: { sobe: 0.01, lado: 0.012 }, lente: 2.5, camLimite: 5.5,
  idArbitro: 200, idAssistentes: [201, 202], assistentes: [[26, -34.5], [-26, 34.5]], tunel: { x: 0, z: 44.5 },
  tarja: 6,              // s, no máximo — DFL International Rundown (Bayern × Union, 26/02/2023): "identificação do jogador
                         // com cartão", 6 s; aqui ela sai com a cena (nunca por cima da bola rolando: rev. R10)
};
export const CENA_CARTAO = {
  // US Soccer (Guide to Procedures): o árbitro para a uma "distância razoável", de frente, e ergue o cartão acima da cabeça
  arbitro: { distIni: [6, 8], vel: 5.5, velForte: 6.5, para: [2.0, 2.8], preRolagem: 2.6, freio: 4.2 },
  tira: 0.55, tiraDur: 0.4, alto: 1.3, segundo: { alto1: 1.0, guarda: 0.35, alto2: 1.2 }, anota: 0.8, ombroSobe: 0.075,
  // amarelo 5,45 s (proposta da pesquisa: 4–6 s); vermelho 8,9 s; 2º amarelo 9,9 s (proposta: 8–10 s). FC 26: as cenas
  // "gastam segundos" → curtas, puláveis e com opção de desligar
  planos: {
    amarelo: [['arbitro', 1.95], ['reacao', 2.5], ['anota', 1.0]],
    // (revisão do PR 2: o cartão no alto ≥ 1,0 s dentro do plano do árbitro — com 1,9/2,9 o vermelho caía na reação)
    vermelho: [['arbitro', 2.0], ['reacao', 2.4], ['saida', 1.5], ['tunel', 2.0], ['torcida', 1.0]],
    segundo: [['arbitro', 4.0], ['reacao', 2.4], ['saida', 1.1], ['tunel', 1.4], ['torcida', 1.0]],
  },
  companheiro: 15, apoioPerto: 6,
  ifab: 4,               // m — só o capitão e o punido mais perto do árbitro ("só o capitão": UEFA EURO 2024, PL 2025-26)
  afasta: 5.4, afastaLeve: 3.6, velAfasta: 2.8,   // o árbitro isola o jogador com o braço estendido (NISOA, askasoccerreferee)
  a1: { passos: 1.3, vel: 1.1, capitao: 0.95, vCap: 3.4 }, a2: { vel: 1.0, anda: 2.6, giro: 2.4 }, a3: { desculpa: 0.8, vel: 3.6 },
  v1: { vel: 1.0 }, v2: { avanca: 1.7, vel: 1.4, recua: 1.0, vSai: 1.3 }, v3: { vel: 1.1 }, saida: { vel: 1.2 },
  tunel: { dist: [10.5, 13], cam: { x: 6.5, y: 1.6, z: 38.3 } },  // Lei 12: o expulso deixa as imediações do campo
  camera: { /* a da branch, sem mudança */ },
};

// ---------------------------------------------------------------- PR 3 e PR 4 — intervalo e pós-jogo
export const CENA_FIM = {
  planos: {
    // intervalo: os planos de campo (9 s) ≈ DFL 1:00 de "jogadores saindo / autores / técnicos / clima" ÷ 11,25 (o relógio
    // do jogo) ≈ 5,3 s, arredondado para caber o túnel; depois os blocos de tela (lances, estatísticas) e o geral solto
    intervalo: [['apito', 1.5], ['campo', 2.5], ['tunel', 3.5], ['torcida', 1.5], ['lances', 0], ['estatisticas', 6.0], ['geral', 3.0]],
    // fim: os planos de campo (15,5 s) ≈ DFL 2:30 de campo ÷ 11,25 = 13,3 s
    vitoria: [['apito', 1.5], ['vencedor', 3.0], ['perdedor', 2.5], ['cumprimentos', 2.0], ['treinador', 2.0], ['aplauso', 2.5], ['torcida', 2.0], ['melhor', 5.0], ['placar', 8.0], ['estatisticas', 6.0], ['geral', 0]],
    empate: [['apito', 1.5], ['neutro', 3.0], ['cumprimentos', 2.0], ['treinador', 2.0], ['aplauso', 2.5], ['torcida', 2.0], ['melhor', 5.0], ['placar', 8.0], ['estatisticas', 6.0], ['geral', 0]],
    curto: [['apito', 1.5], ['neutro', 3.0], ['torcida', 2.0], ['placar', 8.0], ['geral', 0]],   // TM: o empate que continua
  },
  // tarja do placar com os autores: DFL — +20 s do apito, 8 s, no intervalo e no fim (o atraso de campo ÷ 11,25 ≈ 1,8 s;
  // aqui depois dos dois primeiros planos); a leitura não encolhe com o relógio do jogo
  placar: { entra: 4.0, dura: 8.0 },
  autores: true,         // false = a tarja só com o placar (ver §9: a regra "GOL! sem autor nem minuto" é do lance, não da tarja)
  // estatísticas: wTVision — "os melhores gráficos escolhem os números que explicam a fase do jogo"; 6 s = o gráfico de evento da DFL
  estatisticas: { dura: 6.0, itens: ['posse', 'chutes', 'noAlvo', 'escanteios', 'faltas', 'cartoes'] },
  // lances: intervalo até 2 (gols primeiro); "Melhores momentos" no fim até 6 e ≤ 30 s (EA FC 25: replay dos gols no
  // pós-jogo; FC 24: introduções longas cortadas porque a maioria pulava → no fim é botão, não automático)
  lances: { intervalo: 2, fim: 6, fimMax: 30, tvAntes: 2.5, depois: 0.5 },
  melhor: { dura: 5.0 },  // Premier League (voto da torcida no apito), Globo ("Craque do Jogo" no gramado depois do jogo)
  troca: { pares: 1 },    // troca de camisa (costume do fim de jogo; nenhuma regra proíbe)
  // o resto da branch: velAnda 1.4, lenteLivre 4.6, aperto {dist 0.92, altura 1.06, pares 6, maxDist 6, ...}, cintura 0.62,
  // joelhos 2, funil {d [8, 25], vel [1.3, 1.5]}, aplauso {d [8, 10], z0 7.2, zMeio 12.5}, camera {...}
};
// guardador de lances (render/lances-guarda.js): 6 lances × 6 s a 30 Hz, pose em Int16 (1/4000 m: ±8,19 m, erro ≤ 0,13 mm;
// rev. R20 — a 1/8000 o mergulho desenhado do goleiro ficava perto da borda) → ~0,58 MB por lance, 3,5 MB fixos (o anel de
// 10 s tem 3,36 MB), alocados na 1ª partida; o mini-anel de tocar: 360 passos (6 s a 60 Hz) com as vagas/nj do anel, ~2 MB
export const LANCES_GUARDA = { lances: 6, segundos: 6, hz: 30, escala: 1 / 4000, mini: 360 };
```

---

## 7. Contrato (textos para o `golaco/CONTRATOS.md`; uma seção nova, "Cenas das paradas", crescendo a cada PR)

### 7.1 (PR 1) Replays nas paradas
## Cenas das paradas — replays nas paradas, cartão, intervalo e pós-jogo (22/10; contrato)
Pedido do dono: "a cena de pós jogo, e a cena de intervalo, as cenas de cartões, e os replays de faltas e jogadas passando
na tela enquanto o jogo tá parado". Pesquisa em `PESQUISA-CENAS.md`; constantes em `js/cenas-config.js` (FORA do fecho:
`tools/fecho-hash.mjs --diff origin/main` = 0). **Só desenho**: a simulação fica parada e volta no mesmo tick
(`hash-igual` e `hash-partida` IGUAIS).

- **Replays nas paradas — classificador `js/lances.js`** (puro, no download inicial):
  - `criarLances()`; `lancesPasso(L, m, eventos)` só lê.
  - Na bola morta: `L.lance = {classe 'A' | 'B', tipo ('penalti' | 'vermelho' | 'trave' | 'amarelo' | 'faltaPerto' |
    'espalmada' | 'passouPerto'), chave, fim, time, ids, x, z, lado, peso}` ou null.
  - Classe A (pênalti, vermelho, trave + bola morta ≤ `REPLAY_PARADA.chance.mortaAte` s) fura o teto. Classe B
    (amarelo, falta a ≤ `faltaPerto` m do gol, espalmada de dentro da área ou a ≥ `chance.vMin` m/s, chute de dentro da
    área a ≤ `chance.perto` m da trave) fica dentro de `porTempo` por tempo e de `espaco` s de bola rolando desde o
    último replay automático.
  - Nunca: lateral ou tiro de meta sem lance; chute bloqueado sem trave; defesa com o goleiro segurando.
  - `decidirReplay(L, lance, {tempo, tick, ligado})`; `registrarReplay(L, tick, tipo)` (gol e impedimento também contam).
- **Roteiro** `render/replay-roteiro.js roteiroParada(anel, lance)`:
  - P1 'tv' 1× de chave − `tv.antes` (encolhe até `tv.antesMin`) até chave + `tv.depois` (chance: desfecho + `tv.depoisChance`).
  - P2 'fechada' (falta) ou 'atras' (chance) a `lento.vel` em volta da chave.
  - ≤ `maximo` s (encolhe o começo do P1 e depois o P2); nunca atravessa corte; null com a chave fora do anel.
  - Câmera 'fechada' (`render/replay.js`): a instância de TV do replay, fov × `lento.fov`, o alvo puxado para (x, z) do lance.
- **Página** (`main.js`):
  - O lance aceito ARMA o replay (`replayParada`). Arma só fora da API dos testes (`!emRodarPassos`).
  - `seguraParaReplayParada()` dispara no passo ANTES da montagem, `montaNoProximoPasso(m)` (`lances.js`): a mesma
    conta do `regrasPartida`, `p.estado === 'parada' && pr.cobrador == null && tick + 1 − pr.inicio ≥
    seg(PARTIDA.foraEspera)`, que também diz quando o passo seguinte é o `fimDoTempo`. Primeiro 1 s ao vivo, depois a
    vinheta de hoje.
  - A checagem fica no TOPO da volta do laço: antes da entrada da demo (que escreve no mundo) e, no online, antes de
    `MOD_ON.podePassar`/`entradas`, com `segurou = true`.
  - Desarma em gol, intervalo, fim, recomeço, ou sem diretor. Com cena em andamento, espera ela acabar.
  - Liga com `?replayParada=0|1` ou com o padrão (`REPLAY_PARADA.ligado`; desligado com webdriver, PRINTS e DEMO), E
    com "Replays: Ligado".
  - O pulo é o do replay de hoje. Na tela só "REPLAY" e o "Pular" com toque.
  - Online: segura só o meu lado (como o replay do gol). Livre, disputa e treinos: nunca.
  - API `__golaco.replay.paradas`.
- **Testes:** `teste-replay-paradas` (Node, padrão; P1–P5) e `teste-replay-paradas-tela` (navegador, CI; V1–V10).

### 7.2 (PR 2) Cartão
- **`js/cena-atores.js`** (puro):
  - O árbitro e os assistentes (`criarJogador` 200–202, posição 'ARB', kit 'arbitro').
  - `passoAtores` na ordem do `passoCena` da comemoração; `recriarAtor` (ELIPSE: só no tick de um corte);
    `escolherVariante(tick, id, ultima, disponiveis)` (hash; nunca a anterior).
  - Os gestos (`gTiraAmarelo`, `gTiraVermelho`, `gCartao` — braço reto, a mão ≥ 0,25 m acima do topo da cabeça —,
    `gAponta`, `gAnota`, `gAfasta`, `gApito`, `gAbertos`, `gCabeca`, `gDesculpa`, `gSegura`, `gRosto`, `gAperto`...).
  - A câmera (`camValida`, `melhorCamera`, `fugirDaLente`, `caberNoQuadro`).
  - `moverJuntas`, `inclinarTronco` e `flexionar` são CÓPIAS dos de `comemoracao.js` (lá não são exportados e o arquivo é do fecho).
  - Nada alocado por tick; sem rng.
- **`js/cena-cartao.js`** (puro):
  - `escolherCartao(eventos)`: o mais grave; o 2º amarelo = UM vermelho com `segundo`.
  - `planejarCartao(m, cartao, {ultimaAmarelo, ultimaVermelho, variante, timeHumano})`, `criarCenaCartao(plano, m)`
    (cópias; o capitão longe; o árbitro já vem correndo — pré-rolagem), `passoCenaCartao`, `avancarCenaCartao`,
    `faseCartao`, `duracaoCenaCartao`.
  - `planoCameraCartao(c, {pequena, aspecto}, out)` (`out.tunel` = abrir o vão das placas), `cartaoNaMao(c, pose, out)`,
    `consumirEventosCartao` (`cartaoCena`, `aplausoExpulso`).
  - Variações: amarelo `abertos`, `cabeca`, `aceita`; vermelho `cabisbaixo`, `segurado`, `rosto`.
  - Planos e tempos em `CENA_CARTAO.planos`: amarelo 5,45 s; vermelho 8,9 s; 2º amarelo 9,9 s.
- **Página:**
  - `decidirCartao()` no fim do `rodarPasso`. A simulação fica PARADA no tick do cartão; com a vantagem que acabou em
    gol, no gol + 149, depois da comemoração (a cortina para ali).
  - Os treinadores vivos não andam e saem do desenho durante a cena; a cena desenha cópias (sem corte no anel depois dela).
  - Ordem: falta → cartão → 1 s ao vivo → replay de parada (armado) → montagem → substituição; gol → comemoração →
    cartão → saída → replay do gol; replay do impedimento → cartão (da fila).
  - O expulso vem de `m.expulsos`, com a posição do tick anterior pelo anel.
  - A tarja de identificação (`js/cenas-tela.js`): cartão, sigla, escudo, número e nome; só durante a cena (≤
    `CENAS.tarja` s); nem motivo nem minuto. O `#cartao-icone` não aparece para quem teve cena.
  - TM travado expulso: a faixa "Você foi expulso" depois da cena e do replay, os 6 s contando dali.
  - Pular: um aperto novo depois de `CENAS.pularDepois`. Pausa e celular em pé congelam.
  - `?cenas=0|1` e `prefs.cenas` ("Cenas" no Modo de jogo); desligadas com webdriver, PRINTS e DEMO. No ONLINE só o
    ícone. Sem o módulo baixado: o ícone.
  - Render: `render/cartao3d.js` (1 chamada só visível), `render/vao-placas.js` (o vão do túnel), `jog3d.reservar` + 3.
  - API `__golaco.cenas`.
- **Testes:** `teste-cenas` A, B, E, F, G (Node, padrão) e `teste-cenas-tela` parte `cartao` (navegador, CI e deploy).

### 7.3 (PR 3) Intervalo, guardador de lances e súmula sempre ligada
- **`js/cena-fim.js`** (puro), `planejarFim(m, 'intervalo', {placar, timeHumano, treinadores: {0, 1}})`:
  - `apito → campo → tunel (ELIPSE: o funil) → torcida → lances (0–2) → estatisticas → geral`.
  - A tarja do placar com os autores entra em `CENA_FIM.placar.entra` s e fica `placar.dura` s.
  - Os treinadores pelo `tecnicos.js treinadorDoTime(T, t)` (ids 210/211).
  - Página: a simulação fica PARADA no tick do `intervalo` até o `geral`; no `geral`, solta (os 3 s de
    `PARTIDA.intervalo`) com o desenho ainda da cena, e a `saida` acaba a cena. A faixa ENTRA/SAI das trocas do
    intervalo, na saída, como antes. A cena chama `tocarAdiados()` ao começar.
  - Online: desligada (a faixa de 3 s + a tarja só nesses 3 s).
- **`render/lances-guarda.js`** (puro):
  - `criarGuarda(LANCES_GUARDA)`: memória fixa, alocada na 1ª partida.
  - `guardar(G, anel, lance)` copia [chave − `lances.tvAntes`, fim + `lances.depois`] (cortado a
    `LANCES_GUARDA.segundos`) a 30 Hz, com a pose em Int16 relativa ao jogador (1/4000 m), os cortes e as batidas na
    rede. O gol no `posGol()`, a parada A/B no passo antes da montagem, os dois com ou sem replay. Cheio: sai o de
    menor `peso`; gol nunca sai por chance.
  - `tocar(G, k, mini)` descomprime no mini-anel (`criarAnel` com as vagas/nj do anel, 60 Hz).
  - `iniciarReplay(ro, {fonte, aoFim})`: o diretor e o `desenharReplay` leem da fonte; o fim volta à cena.
- **`js/sumula.js`:**
  - `escanteios[2]` (contados na bola morta) e `faltas[2]` (cometidas) por time.
  - Criada SEMPRE na partida (import estático; +14,7 KB no download inicial); com `?tm` é a mesma do resultado.
  - `resultadoTM` não muda.
- **Telas** (`js/cenas-tela.js`, `css/cenas.css`, sob demanda):
  - Tarja do placar: escudo, sigla e placar. Com `CENA_FIM.autores`, os autores com os minutos, "(c)" e "(p)".
  - Painel de estatísticas: só rótulos e números.
- **Testes:** `teste-cenas` C-intervalo, `teste-lances-guarda` (G1–G5), `teste-ponte-tm` (escanteios/faltas) e
  `teste-cenas-tela` parte `intervalo` (I1–I10).

### 7.4 (PR 4) Pós-jogo
- **`planejarFim(m, 'fimDeJogo', ...)`:**
  - Vitória: `apito → vencedor → perdedor → cumprimentos (+ troca de camisa) → [treinador] → aplauso → torcida →
    melhor → placar → estatisticas → geral`.
  - Empate: `neutro` no lugar de `vencedor/perdedor`.
  - Curto (TM com `partida.empateContinua`, ou empate no TM sem o campo): `apito → neutro → torcida → placar → geral`.
  - Fora do online, SEGURA o laço até a faixa final: em `fim` só o `m.tick` andaria. No online não segura (o lockstep
    segue) e usa só cópias. Os treinadores vivos ficam fora do desenho. `tocarAdiados()` ao começar.
- **`sumula.melhorEmCampo(s, m)`:** a maior `notaDoJogador` de quem jogou (expulso não), com as mesmas opções do
  `resultadoTM` (a nota da tarja = a do TM); desempate gols → assistências → menor id.
- **`resultadoTM`:** ganha o campo opcional `melhor: {lado, tmId, nome, nota}`.
- **A faixa final:**
  - "Jogar de novo" / "Voltar ao Total Match".
  - "Melhores momentos" (até `CENA_FIM.lances.fim` lances, ≤ `fimMax` s, um ângulo cada; pular volta à faixa).
- **TM:**
  - O resultado continua gravado NO APITO (antes da cena); sem o bloco de estatísticas.
  - "Simular o resto": sem cena.
  - Online: ligado, cada um no seu aparelho, sem segurar (só o tick anda); o W.O. e a dessincronia interrompem.
- **Render:** o kit derivado `troca:<A>:<B>` em `render/jogador3d.js` E `render/humano3d.js` (camisa de A, com o
  patrocínio na versão de teste; calção e meião de B).
- **Testes:** `teste-cenas` C-fim, `teste-ponte-tm` (`melhor`), `teste-cenas-tela` parte `fim` (F1–F10),
  `legacy-total-match/ferramentas/testar-3d.mjs` e `testar-online3d.mjs --golaco`.

---

## 8. Testes: antes → depois (o que vai na tabela de cada PR)

| PR | Teste | Tipo | Na base (main) | Depois |
|---|---|---|---|---|
| 1 | teste-replay-paradas P1–P3, P5 | Node, padrão | REPROVA (sem `lances.js` / `roteiroParada` / `montaNoProximoPasso`) | passa |
| 1 | teste-replay-paradas P4 (pureza) | Node | — (sem o que medir) | passa |
| 1 | teste-replay-paradas-tela V1–V3, V5, V7, V8, V10 | navegador, CI | REPROVA (nenhum replay na parada) | passa |
| 1 | teste-replay-paradas-tela V4, V6, V9 | navegador, CI | passa (vácuo; rev. R16) | passa (guarda) |
| 2 | teste-cenas A, B, G | Node, padrão | REPROVA (sem cena de cartão) | passa |
| 2 | teste-cenas-tela C1–C6, C8, C9, C11, C12 | navegador, CI e deploy | REPROVA (só o ícone) | passa |
| 2 | teste-cenas-tela C7, C10 | navegador, CI e deploy | passa (vácuo; rev. R16) | passa (guarda) |
| 3 | teste-cenas C-intervalo | Node | REPROVA | passa |
| 3 | teste-lances-guarda G1–G6 | Node, padrão | REPROVA (sem guardador) | passa |
| 3 | teste-ponte-tm (escanteios/faltas) | Node | REPROVA nos campos novos; o resto igual | passa |
| 3 | teste-cenas-tela I1–I4, I6, I11, I12 | navegador | REPROVA (faixa de 3 s) | passa |
| 3 | teste-cenas-tela I5 | navegador | passa (vácuo; rev. R16) | passa (guarda) |
| 4 | teste-cenas C-fim | Node | REPROVA | passa |
| 4 | teste-ponte-tm (`melhor`) | Node | REPROVA no `melhor`; o resto igual | passa |
| 4 | teste-cenas-tela F1–F7, F10 | navegador | REPROVA (22 congelados + faixa; o tick anda no `fim`) | passa |
| todos | `hash-igual`, `hash-partida` (demo e humano) | Node | — | IGUAIS (rev. R3: não carregam o `main.js`; a prova da página são V4/C7/I5/F2) |
| 1, 3 | `teste-carga` (download inicial) | navegador | folga ~1,4 MB | anotar a folga depois (+`lances.js`; +`sumula.js` no PR 3) e conferir ≥ 120 KB |
| todos | `fecho-hash --diff origin/main` | Node | — | 0 no fecho |
| todos | `teste-hud-minimo`, `teste-carga`, `teste-replay`, `teste-comemoracao-tela`, `teste-substituicao-tela` | navegador | passam | continuam passando |

---

## 9. Riscos, lacunas e o que fica para o dono

1. **Autores e minutos na tarja do placar** (intervalo e fim).
   - A regra "GOL! sem autor nem minuto" é do lance ao vivo. A tarja do placar do intervalo e do fim com os autores é
     gráfico de transmissão (DFL) e entra.
   - Se o dono não quiser, `CENA_FIM.autores = false` deixa só o placar. A tarja do cartão e a do melhor em campo têm
     nome e número, como a faixa ENTRA/SAI que ele pediu.
2. **Online:**
   - Cartão e intervalo desligados nesta versão (como a substituição).
   - O item (4) da fila do dono vira "cenas no online": pular combinado pelo canal de controle do `online-pagina.js`.
   - Os replays de parada ficam ligados (o gol e o impedimento já são assim). Quem pular espera o outro ("Aguardando…").
3. **Memória:** o guardador + o mini-anel = ~+5,5 MB fixos no celular, alocados na 1ª partida (nunca nos treinos). Se o
   `teste-desempenho-celular` reclamar, a alternativa é o mini-anel a 30 Hz tocado a 0,5× nos ticks (−1 MB) ou 4
   lances (−1,2 MB).
4. **Janela pequena com o ao vivo atrás (PiP) e telão do estádio:** não entram. Pedem uma 2ª câmera e outra lista de
   instâncias, o que é caro no celular. Se o dono quis dizer isso com "passando na tela", vira um PR à parte.
5. **O árbitro só existe nas cenas.** No jogo ao vivo e nos replays (o anel não o grava) não há árbitro. Ele entra pela
   pré-rolagem/corte, como na TV. Pôr o árbitro no jogo ao vivo seria outro pedido (desenho, sem mexer na regra).
6. **Troca de camisa:** depende do kit derivado custar ≤ 1 chamada no `jogador3d` E no `humano3d` (rev. R19); senão sai
   desta versão e fica anotada.
7. **Replay da defesa com o goleiro segurando a bola:** fora (segurar ali tiraria o contra-ataque da pessoa). Se o
   dono pedir, a espera seria no passo em que o goleiro pega, só com a IA de goleiro dos dois lados.
8. **Os dois cortes da comemoração da branch** (torcida e treinador no gol): ficam fora, porque mudariam a
   `comemoracao.js`, do fecho. Dá para fazer como plano de câmera do `main.js` num PR à parte.
9. **TM, empate que continua:** precisa do campo novo `partida.empateContinua` no `tm3d.js`. Sem ele, todo empate no TM
   usa a versão curta: segura, mas perde os cumprimentos no empate de liga.
10. **Frequência dos replays de parada:** calibrar `porTempo`/`espaco` com o P3 do `teste-replay-paradas` (24 partidas)
    para ~13% ± 3 do ar em replay, e anotar o número no PR (honestidade nos resultados).
10a. **(rev.) Tempo parado somado.** Numa partida de 2 × 4 min (480 s de jogo) somam-se:
     - replays de gol, ~25 s;
     - impedimento, ~9 s;
     - paradas, ~40 s;
     - comemorações, ~12 s;
     - cartões, ~3 s.
     Dá ~90 s de jogo parado, ~16% do tempo total. O dono pediu "jogo MAIS INTENSO" e o FC 26 ouviu que as cenas
     "gastam segundos". Por isso:
     - o P3 mede também a soma de TUDO o que segura a simulação, e o número vai no PR;
     - se passar de ~18%, o `porTempo` cai para 2 antes do merge.
10b. **(rev.) "Aguardando…" no online.** Com os replays de parada ligados, quem pula (ou desligou os replays) espera o
     outro mais vezes por partida: até ~6 a mais que hoje. É o comportamento de hoje no gol; o número de esperas vai no
     PR (V8).
11. **Lacunas da pesquisa:**
    - Não há roteiro público da Globo/Premiere nem da TNT/CBS; a régua de tempos de TV é a da DFL.
    - O SoccerNet não separa a duração do replay por tipo de lance (só a média de 6,8 s).
    - Não há regra escrita de diretor sobre não perder o reinício (só a prática: LaLiga, críticas da AFL).

---

## 10. Entregas (cada PR: branch → PR → CI → merge → link; sem prints ao dono)
- PR 1 `golaco/replays-paradas`, ~3 h:
  - adiciona `PESQUISA-CENAS.md` (a da branch + `referencias.md`);
  - adiciona ao `CONTRATOS.md` a seção §7.1;
  - adiciona ao `CLAUDE.md` um item da frente.
- PR 2 `golaco/cenas-cartao`, ~5 h: porte + `main.js` refeito; §7.2.
- PR 3 `golaco/cena-intervalo`, ~6 h: `cena-fim` (intervalo), guardador, súmula, telas; §7.3.
- PR 4 `golaco/cena-pos-jogo`, ~5 h: fim, melhor em campo, melhores momentos, lado do TM (`tm3d.js` + `?v=` + `sw.js`); §7.4.
- **Ao terminar a frente:**
  - (rev. R12) NÃO apagar `origin/golaco/cenas-jogo` por conta própria: os 2 cortes da comemoração (torcida e
    treinador, 162 linhas na `comemoracao.js`) ficaram fora do porte (§9.8). Antes, criar a tag `arquivo/cenas-jogo`
    no 1df2ca34. A branch só sai depois de o dono decidir esses cortes;
  - atualizar a fila do CLAUDE.md: o item (4) vira "cenas no online";
  - registrar no CLAUDE.md:
    - as exceções novas à "sem narração" (as tarjas; rev. R27);
    - a súmula no download inicial (rev. R4);
    - a regra "espera nova no topo da volta do laço, antes da entrada da demo e do `MOD_ON.entradas`" (rev. R2).
- **Link para o dono:** https://mauriciosuprir.github.io/jogo-futebol/golaco/ (atualiza depois do merge).
