# Modo Leilão do Total Match — plano

Pedido do dono, 14/11/2026: "consegue criar um modo de leilão? com os jogadores da liga escolhida?". As respostas dele:

| Pergunta | Resposta |
|---|---|
| Quem disputa | Amigos, online |
| O que vem depois do leilão | Leilão e mata-mata. Na tela antes do jogo cada um escolhe Jogar ou Simular |
| Como são os lances | Cada um dá os seus lances: +1, +5, +10 ou Tudo. Todos começam com R$ 100 (dinheiro do jogo) |
| Quando | Agora, no branch `claude/leilao` |

Base: as 7 fotos de modelo (prints de um site de terceiros; o pedido fala em 8, chegaram 7, e nenhuma mostra as abas
Escalação e Campeonato), os relatórios dos leitores do código, a pesquisa e duas críticas adversariais (sincronia e
segurança; produto e código), conferidas no código (commit e41aa791) e aplicadas. O que mudou com elas está na seção 8.
Todo caminho de arquivo é relativo a `legacy-total-match/`, a não ser que diga outra coisa.

As fotos dão a MECÂNICA e o fluxo. Nada do site de referência entra: nem o nome, nem a arte (a nota de R$ 100 com o
bicho), nem o amarelo, nem os nomes dos bots (técnicos reais), nem o banner de doação/Pix, nem a sala pública.

---

## 0. Resumo para o dono

**O que você vai ter:**

1. Em **Mais modos**, o atalho **Leilão** (ícone de martelo).
2. Você cria uma **sala privada** e manda o convite (código ou link). Quem entra pede, e **você aceita**. Sem chat,
   sem sala pública, sem desconhecidos.
3. Na sala você escolhe a liga, o formato (mata-mata, pontos corridos ou os dois), de 2 a 8 técnicos, os bots de
   treino e a sua formação. O time é de **11 em campo** (o 5 em campo fica para depois, jogável: decisão 3).
4. Cada técnico entra com **R$ 100** (dinheiro do jogo) e um clube com escudo desenhado. Vão a leilão os melhores da
   liga **por posição**: tem goleiro para todo mundo.
5. Cada jogador fica **10 s** no martelo. Botões **+1, +5, +10, Tudo** e outro valor; dá para **passar**. O **Tudo**
   guarda R$ 1 para cada vaga que falta e pede um 2º toque para confirmar.
6. Lance nos últimos segundos devolve o relógio a 8 s. Quando todos passam, o lote fecha na hora.
7. Depois, a **escalação** no campinho e o **campeonato**.
8. Em cada jogo seu, um botão **Jogar**, como em todo jogo do TM: abre a **tela antes do jogo** do 3D, com **Jogar
   partida** ou **Simular partida**. Contra um amigo, a mesma tela no Online 3D, com o "Simular partida" novo ao lado
   do "Pronto" (decisão 7).
9. Todos veem o mesmo resultado: ele é gravado uma vez e ninguém calcula de novo. Ninguém joga de novo até ganhar.
10. Dá para **treinar sozinho contra bots** (o 1º PR).

**A ordem e as horas** (detalhe na seção 5):

| PR | O que chega | Horas | Somadas |
|---|---|---|---|
| 1 | O leilão inteiro contra os bots, num aparelho, e a escalação | ~28 | 28 |
| 2 | **Com os amigos online:** a sala privada, o saguão e o leilão ao vivo | ~28 | 56 |
| 3 | O campeonato (os 3 formatos), no treino e online, com os jogos simulados | ~20 | 76 |
| 4 | Os seus jogos contra bots em **3D** (Jogar/Simular na tela antes do jogo) | ~10 | 86 |
| 5 | Você contra um amigo em **3D ao vivo** | ~17 | 103 |
| 6 | Notas escondidas ("leilão no olho") | ~8 | 111 |

**Estimativa:** ~111 h; conte com 110–125 h. Cada merge que mexe em `legacy-total-match/` também roda a bateria do
GOLAÇO no deploy (~25 min).

**Decisões que dependem de você:** seção 7 (cada uma com a recomendada). As novas desta revisão são a 3 (sem 5 em campo
na v1), a 6 (quem some passa, sem piloto que gasta), a 7 (Jogar/Simular na tela antes do jogo também contra amigo), a
15 (o 3D fechado no meio = W.O.) e a 16 (você aceita quem entra).

---

## 1. As regras do modo

### 1.1 A sala

- **Só privada.** Entra quem tem o código (6 letras) ou o link `?leilao=CÓDIGO` **e é aceito pelo dono da sala**
  (como o aceitar/recusar do Online 3D). Sem chat, sem lista de salas.
- **O nome** de cada um é o do perfil do TM (`TM.net.me.name`); o número `#1234-5678` desempata nomes iguais.
- **O dono da sala** aceita ou recusa os pedidos, muda a configuração no saguão (isso zera os "Pronto"), tira alguém
  antes de começar e começa o leilão. Depois do Começar ninguém novo entra; o dono só pode **passar o clube** de quem
  trocou de aparelho ou limpou os dados para o pedido de entrada dessa pessoa.
- **Técnicos:** de 2 a 8 vagas, contando os bots; dá para começar com dois. A sala só com você e bots é o **Treino**.
- **Pronto:** cada pessoa marca "Pronto"; a barra mostra "X de N prontos. Falta confirmar: …". O Começar só passa com
  todas prontas (conferido na mesma transação).
- **Edição:** a sala usa a do dono (pública ou pro). Quem entra na pública troca sozinho, como no Ultimate; na pro, só
  quem destrancou a chave (`TM.storage.suUnlocked()`).
- **Versão:** a sala grava `regras` (uma constante do `leilao.js` que só muda quando a regra muda) e a versão do TM
  (só para avisar). Na 1ª entrada vale edição + `regras`. Quem já é da sala sempre volta, mesmo depois de um deploy;
  com `regras` diferentes, fica só olhando, com o aviso para atualizar a página.
- **Fair play:** a entrada passa por `TM.fairplay.gate`, como no Online 3D.
- **Sem Total Coins** e sem dinheiro de verdade: a tela diz "dinheiro do jogo".
- **Limpeza:** a sala some quando o dono a encerra, depois de 30 min parada no saguão ou de 24 h sem atividade (o prazo
  é conferido pela hora do servidor, seção 3.3). "Minhas salas" lista as salas em que você está.

### 1.2 A liga e os lotes

**Fonte:** os clubes da liga no **mundo-base** da edição em uso: `TM.data.mundoBase()` (o `generateWorld` de
`data.js` sem o `applyCustomClub` e sem o `applyEdits`, fora do cache). Assim o leilão da mesma liga tem os mesmos
jogadores em todo aparelho, sem o Editor nem o clube criado ou o Viverde de uma carreira. Fica de fora clube ou jogador
`especial`. (Se o `mundoBase` passar de 1 s no celular, a reserva é a Criar sala recusar a liga com edições.)

**Quantos lotes:** 13 por técnico (T = técnicos, contando os bots): 52 com 4, 104 com 8, como nas fotos.

**Por posição (cota)**, pela posição principal (`pos`), medida nas 30 ligas e nas duas edições (só pela nota, os 52
melhores da Série B pro têm 0 goleiros):

| Goleiros | Defensores | Meias | Atacantes |
|---|---|---|---|
| ⌈1,5·T⌉ | (13T − GK − FW)/2, a sobra ímpar no DF | o restante | ⌈2,5·T⌉ |

Exemplo com 4: 6 GK, 18 DF, 18 MF e 10 FW = 52. Dentro do grupo, os melhores por `overall`, desempate pelo `id`.

**Ordem:** sorteio pela semente da sala, em blocos de T com posições e faixas de nota variadas; o 1º goleiro nos
primeiros 20% e nenhum no último bloco. A lista **"Próximos lotes"** (recolhível) mostra os 5 seguintes a todos.

**Retrato do lote** (gravado uma vez; ninguém lê o jogador no próprio `TM.data` para calcular nada): `id`, nome, `pos`,
`pos2`, os **grupos** (`pos` + `playerVersa`), `overall`, `attrs`, `nationId`, `clubId`, `homeClubId` (a foto depois
de transferência, `placeholders.js`), `number`, `height`, `weight`. A altura não aparece na carta (é inventada no TM).

### 1.3 O lote e o lance

| Regra | Valor |
|---|---|
| Saldo inicial | R$ 100 |
| Preço inicial | sem lance; o 1º vale ≥ R$ 1 |
| Pausa entre lotes | 1,5 s ("Vendido para X por R$ Y", botões desligados) |
| Relógio do lote | 10 s |
| Lance com menos de 8 s faltando | o relógio volta a 8 s |
| Repescagem | 6 s por lote |
| Máximo de um lance | saldo − R$ 1 × (vagas que faltam − 1) |
| Botões | +1, +5, +10 (sobre o valor VISTO), **Tudo R$ X** (2 toques: o 1º vira "Confirmar R$ X" por 2 s), outro valor, Dar lance, Passar |

- **Quem pode dar lance:** tem vaga, não passou neste lote, não lidera, tem máximo ≥ valor + 1 e o jogador **cabe**: o
  time com ele ainda encaixa em alguma das 6 formações, cada jogador numa vaga de um dos SEUS grupos (emparelhamento:
  no máximo 11 × 6, barato). Um MEI/ATA cabe como meia ou atacante, como no resto do TM (`playerVersa`, sem perda).
  Toda formação tem 1 goleiro: ninguém compra dois.
- **Botão que não pode:** apagado com o motivo ("acima do seu máximo R$ 90", "você já tem goleiro").
- **Passar** vale só para aquele lote. **Quem não pode** (completo, sem vaga que sirva, sem dinheiro) conta como
  "passou" e aparece "não pode".
- **Fecha antes da hora** quando todos, menos o líder, passaram ou não podem. **Lote que ninguém pode comprar** é
  pulado na hora.
- **Lote sem lance** vai para a **repescagem** no fim (abre a R$ 1 com 6 s); sem lance de novo, sai.
- **O leilão acaba** quando todos completaram ou acabaram os lotes e a repescagem.
- **Quem ainda tem vaga no fim** completa **de graça** com os melhores de FORA dos lotes que cabem; ordem fixa (quem
  tem menos jogadores, depois o técnico). São piores que os dos lotes: não compensa deixar de comprar.
- **Sobra de dinheiro** não vale nada no campeonato.

### 1.4 Quem some e quem sai

| Momento | O que acontece |
|---|---|
| Leilão: a pessoa some (sem batimento por 10 s, aba escondida, queda) | **Passa sozinha** em cada lote (qualquer aparelho grava o passe); não gasta nada; aparece "ausente". Volta ao controle quando volta. O que faltar completa de graça no fim |
| Leilão: "Sair da sala" | Confirma; o clube passa até o fim |
| Trocou de aparelho ou limpou os dados (conta nova) | O dono passa o clube para o pedido de entrada dela |
| Todas as pessoas saíram | O leilão para; quem voltar faz andar de onde parou (os bots são funções puras) |
| Campeonato: ausente | Os jogos dela esperam: o prazo só corre com alguém do jogo presente. O dono tem "Simular os pendentes" |
| 3D contra bot que fica sem resultado (fechou o app no meio) | **W.O. de quem reservou** (decisão 15). O 3D que nem chegou a abrir = simulado |
| Online 3D: sai no meio | W.O. de 3 × 0 e `TM.fairplay.recordAbandon()`, como no Online 3D; quem fica grava |
| Online 3D: a ligação não sobe, dessincroniza ou acaba sem resultado | "Tentar de novo" uma vez; depois, simulado com a semente |

### 1.5 Formação

- As 6 das fotos, que já existem em `TM.comp.FORMATIONS` (`competitions.js:140`): 4-4-2, 4-3-3, 3-5-2, 3-4-3, 5-4-1
  (Retranca) e 4-2-4 (Tudo ou nada).
- **A vaga aceita os grupos do jogador** (`pos` e `playerVersa`). A função dentro do grupo (`pos2`) custa −1/−2 no
  `adjustForSlot` (`specificPenalty`): a carta e o campinho mostram "−1"/"−2" e "fora de posição".
- **Durante o leilão:** a formação escolhida é a preferência; se a compra não cabe mais nela, muda sozinha para a que
  cabe e mais se parece, com aviso. **Durante os jogos:** muda antes de cada partida.
- **Sem reservas:** o elenco são os 11. Cartões não passam de um jogo para o outro e a **lesão fica desligada** no
  leilão (opção nova do motor, `semLesao`; sem ela, ~22% dos jogos teriam um time com um a menos: decisão 12).
- No 3D, 3-4-3 e 5-4-1 viram 3-5-2 e 4-2-4 vira 4-4-2 (`tm3d.js FORM_3D`): a Retranca e o Tudo ou nada ficam
  aproximadas no 3D.

### 1.6 Overall à mostra ou escondido

- **À mostra** (padrão): a carta inteira.
- **Escondido** (só no PR 6): a carta neutra (sem a nota, a cor da raridade, a barra e os atributos); os bots usam a
  "nota percebida" (nota ± 3); no 3D somem a nota, os números da carta e o GERAL. Quem abrir o console vê as notas
  (aceitável entre amigos). Falta saber do dono quando as notas aparecem (decisão 13).

### 1.7 Os formatos e as partidas

| Formato | Como é | Rodadas com 4 (com 8) |
|---|---|---|
| Mata-mata (padrão) | Jogo único. Empate = prorrogação com **gol de ouro** (91'–120', o 1º gol acaba); seguindo empatado, pênaltis | 2 (3) |
| Pontos corridos | Turno e returno, 3/1/0. Desempate: pontos, saldo, gols pró, confronto direto, sorteio pela semente, técnico | 6 (14) |
| Pontos corridos + mata-mata | Turno único; até 4 técnicos, os 2 primeiros fazem a final; de 5 a 8, os 4 primeiros (1º × 4º, 2º × 3º) | 4 (9) |

- Mata-mata com T que não é potência de 2: a semente escolhe quem folga. Pontos corridos com T ímpar: uma folga por
  rodada (o `roundRobin` de hoje põe um time contra ele mesmo; o leilão tem o seu rodízio).
- A Criar sala mostra a **duração estimada** do leilão (104 lotes ≈ 20–35 min) e do campeonato (8 técnicos em pontos
  corridos com 3D passam de 3 h).
- **Sala fixa para todos:** realismo 3, mando neutro, a duração do 3D (padrão 4 min por tempo) e a dificuldade dos
  bots no 3D (padrão Normal, travada: `simOpts.dificuldade3d` + `ajustesFixos3d`).

**A partida:** todo jogo tem um botão **Jogar**, como em todo jogo do TM desde o item 124.

| Confronto | Como decide |
|---|---|
| Você × bot | Jogar → a tela antes do jogo do 3D: **Jogar partida** (o 3D) ou **Simular partida**. Com a Config "Sempre simular" ou sem WebGL 2, o simulado direto |
| Você × amigo | Os dois tocam Jogar → o Online 3D do par, com a tela antes do jogo: **Pronto** ou **Simular partida** (nova). Um escolhe Simular, ou a ligação falha → simulado. Antes do PR 5 esses jogos são simulados ao abrir a rodada |
| Bot × bot | Simulado por qualquer aparelho, na hora |

**Como TODOS veem o mesmo resultado e ninguém joga de novo:**
1. **Uma máquina por jogo** em `jogos/{id}` (aberto → reservado → feito), com UMA transação por passo; o resultado mora
   dentro dela e só é gravado uma vez.
2. **Ninguém recalcula para mostrar.** As telas leem o resultado gravado; a tabela e a chave são funções puras.
3. **Simulação com semente:** `comSemente("leilao:"+código+":"+jogo+":"+trava, …)`, onde `trava` é a hora do SERVIDOR
   gravada ao reservar (assim ninguém calcula o simulado antes de escolher). Simulação + gol de ouro + pênaltis, sobre
   os retratos e a escalação gravados. O motor só usa `floor/max/min/round/abs/random`: com o `Math.random` preso à
   semente, dá o mesmo resultado em todo aparelho.
4. **Gravado ANTES de mostrar:** o 3D grava no fim da partida, antes da reprodução em 2D; o "Simular partida" grava o
   simulado e só então mostra, **sem pausa** no 2D (a pausa do 2D sorteia o resto de novo com `Math.random`,
   `matchview.js resimRest`).
5. **Prazos** (pela hora do servidor): 2 min para começar, contados só com alguém do jogo presente; o 3D tem até
   2 × duração × 1,3 + 8 min (18 min com 4 min por tempo). Vencido: o simulado (não começou) ou o W.O. (começou e não
   gravou), gravado por qualquer aparelho.
6. **Não conta** no ranking online nem no h2h, e não usa Total Coins.

### 1.8 O fim

O campeão em destaque (como o `TM.ui.posterFim`, com o escudo desenhado), a classificação final, o artilheiro, o melhor
time pela soma das notas e, com notas escondidas, todas reveladas. "Voltar" e "Criar outra sala". A sala fica para
consulta por 24 h.

---

## 2. As telas

**Cara do TM:** verde e preto pelas variáveis de `css/styles.css :root` (`--gold*` é o verde da marca), Inter,
Barlow Condensed (TM Cond) só na carta; ícones por `TM.ic` (Lucide), sem emoji; **modo claro** em todo bloco novo (o
campinho continua escuro, como o do Ultimate); **nada sobre nada** em 360×740, 390×844, 430×932, 844×390, 820×1180,
1280×800, 1440×900 e 1920×1080. Bots com nomes fictícios ("Bot Arrojado", "Bot Paciente"…). Escudo sempre desenhado,
nunca de clube real; dois técnicos não repetem a cor.

**Barra da sessão** (todas as abas): Sair da sala, Som, Como funciona, Participantes e **Vendas** (quem comprou quem e
por quanto; tocar num técnico abre o campinho dele, para ver de que posição ele ainda precisa).

### 2.1 Entrada (`leilao`)

Topo com cena (`cenas.js TOPO`: `"leilao": ["mesa", "Leilão"]`; não a "moedas", que é a das Total Coins). **Criar
sala**, **Entrar com código** (aceita o link colado, como `online3d.js limpaCodigo`), **Treinar contra bots**, **Minhas
salas** e três linhas explicando o modo. Sem rede: só o Treino (e, no treino sem internet, só o leilão e o simulado: o
3D baixa o three.js do CDN).

### 2.2 Criar sala (`leilao-criar`)

Uma coluna de 620 px (`.panel-narrow`): **Liga** (a lista do Draft, `build.js:378-393`, e "Os N melhores dos clubes
da {liga}"); **Formato** (3 cartões com ícone, a frase e "N rodadas com T técnicos · ~X min"); **Técnicos na sala**
− N + (2–8, "dá para começar com dois"); **Bots de treino** − N + ("Só gente de verdade" com 0); **Sua formação**
(`.segmented` 3 × 2 + o campinho com as vagas e "0/11"); **Mais opções** (fechado: tempo do lote 10/15/20 s, duração e
dificuldade do 3D). Barra fixa embaixo: o resumo + **Criar sala** (ícone `gavel`). Sem "Pública"; o "Escondido" só no
PR 6.

### 2.3 Saguão (aba Saguão)

- Abas `TM.ui.sectorBar`: **Saguão · Leilão · Escalação · Campeonato**; a concluída ganha o "check" (o `sectorBar`
  escreve o `it.ic` como texto: vai o emoji que o `icones.js` converte, ou o `sectorBar` passa a aceitar um nó).
- "Prepare seu clube." e o resumo ("Cada técnico entra com R$ 100… o que sobrar não vale nada") com as etiquetas.
- **Código** escondido (••••••) com o olho (`eye`/`eye-off`), **Copiar convite**, **Compartilhar** (só com
  `navigator.share`) e o QR (`online3d.js qrSvg`).
- **Pedidos de entrada** (só o dono): Aceitar / Recusar. **Participantes:** escudo, nome, papel, estado; o dono tem
  "Tirar".
- **Meu clube:** nome (16), sigla (3) e o escudo, num seletor tirado do Ultimate (forma, símbolo, cor); começa com o
  escudo do seu Ultimate, se houver.
- Barra fixa: "X de N prontos. Falta confirmar: …" + **Pronto / Toque para cancelar**; o dono vê **Começar**.

### 2.4 Leilão (aba Leilão)

**Celular em pé:** "Jogador 3 de 52" (ou "Repescagem 2 de 5") → a carta (`TM.ut.cardEl` `big` montada do retrato) com
nome, função por extenso + clube, bandeira + país, os grupos e o (i) → o anel do relógio → "Fulano lidera / R$ 9" e o
histórico dos últimos lances → meu clube (escudo, nome, "VOCÊ", saldo, a barra e "R$ 100 para 11 vagas · média de
R$ 9 por vaga") → os técnicos e o campinho (recolhíveis) → "Próximos lotes" (recolhível).

**A barra de lance é própria** (não o `.bottom-nav`, que fica com 620 px a partir de 760 px e some com a barra lateral):
fixa embaixo em TODO layout, linha 1 **+1 · +5 · +10 · Tudo R$ X** (≥ 48 px de altura), linha 2 **Outro valor**
(`inputmode="numeric"`), **Dar lance**, **Passar**. Com pouca altura (`max-height: 520px`, o celular deitado) a carta
fica compacta e a barra continua à vista com o relógio rodando.

**PC e tablet (≥ 760 px de largura e altura que caiba):** duas colunas (à esquerda a carta, o relógio, o líder e o
histórico; à direita meu clube, o campinho e os técnicos), a barra embaixo.

**O relógio:** SVG com `stroke-dashoffset` pela hora do servidor; o número muda 1 vez por segundo; alerta nos 3
últimos; sem pulsar com `prefers-reduced-motion`. Os botões desligam no 0 local e aparece "Fechando…" até o lote mudar.

**Retorno do lance:** pendente → aceito; "Alguém chegou antes: R$ X" (o botão reabre na hora com o preço novo: com 2
lances/s, ~60% dos "+1" chegam tarde, e é disputa legítima); "Conferindo…" quando a conexão cai no meio (o lance pode
ter entrado; resolve ao reconectar); "Você foi superado" com um lampejo; sons curtos (Web Audio, liberados no 1º toque)
e vibração no Android.

**Acessibilidade:** anel com `role="timer"` ("Tempo do lote"); UMA região `role="status" aria-live="polite"` no HTML
inicial (o lote novo, o líder no máximo a cada 2 s, "5 segundos" uma vez, "Vendido para você por R$ 12"); botões com o
valor no nome ("Lance de R$ 13").

**Tela acesa:** a Wake Lock durante o leilão, pedida de novo a cada volta à aba.

### 2.5 Escalação (aba Escalação)

O campinho do Ultimate (`.ut-pitch`, `.ut-slot`, `cardEl` `mini`, `TM.ut._i.separaCampo`) com a formação
(`.segmented`); tocar em dois troca as vagas; "fora de posição" e o "−1/−2" marcados. Prazo de 60 s depois do leilão
(ou todos prontos); depois vale a automática, que é função das compras (ninguém precisa gravar). No campeonato a aba
continua aberta: vale a partir do próximo jogo que não começou.

### 2.6 Campeonato (aba Campeonato)

A tabela (pontos corridos), a chave (mata-mata) ou as duas. **"Seu jogo"** (`.next-match`): os escudos, o prazo e um
botão **Jogar** (contra amigo: "esperando o outro tocar em Jogar" e, depois de 2 min, simulado). Os outros jogos:
"Simulado", "Jogando em 3D", "Esperando". Resultados com "Ver o jogo" (o resultado gravado em 2D, sem pausa). O dono
tem "Simular os pendentes". O fim (1.8).

---

## 3. A arquitetura

### 3.1 Arquivos novos

| Arquivo | O que é | DOM? |
|---|---|---|
| `js/leilao.js` | **Puro** (`TM.leilao`): constantes, `regras`, lotes por cota, ordem, a máquina do lote (lance, passar, fechar, repescagem, completar), máximo, emparelhamento das formações, robôs, a conferência de cada estado novo contra o anterior | não |
| `js/leilao-camp.js` | **Puro:** calendário com folga, tabela com desempate total, chave com folgas, time do técnico, simulação com semente, gol de ouro, pênaltis, a máquina do jogo | não |
| `js/leilao-rede.js` | O transporte, a mesma interface nos dois casos: `memoria()` (treino, com gravação no `localStorage`, e testes) e `firebase(codigo)`. `ler`, `ouvir`, `transacao`, `gravar`, `atualizar`, `horaServidor()`, `aoCair`, `conectado` | não |
| `js/leilao-sessao.js` | A sessão, fora das telas (como o `S` do `online3d.js`): ouve a sala, os relógios, os bots, os passes de quem sumiu, os prazos. Só "Sair da sala" a encerra | não |
| `js/leilao-tela.js` | As rotas `leilao`, `leilao-criar`, `leilao-saguao`, `leilao-lote`, `leilao-escalacao`, `leilao-camp` | sim |
| `css/styles.css` | Um bloco "LEILÃO", com tema claro (o `conferir-estilos.py` só lê este arquivo) | — |

Ordem no `index.html`: depois de `ultimate.js`, `online3d.js` e `copa.js`, antes de `app.js`. Os arquivos entram no
`SHELL` do `sw.js`; a versão sobe junto nos `?v=` e no `CACHE`.

**Por que tudo passa pelo transporte:** a sessão chama as MESMAS funções puras dentro de `transacao`, com a memória ou
com o Firebase. O treino do PR 1 já é o caminho do online, e os testes em Node rodam o leilão inteiro pelo protocolo.

### 3.2 Modelo de dados (`leiloes/{CÓDIGO}` no Realtime Database)

Técnicos por índice `t` de 0 a 7 (a ordem de `sala.ordem`).

| Caminho | Conteúdo | Quem escreve |
|---|---|---|
| `sala` | `{meta:{dono, proto, regras, versaoTM, edicao, criada, estado, semente, atividade}, cfg, tec:{uid:{nome, num, papel, pronto, auth, clube, formacao}}, pedidos, recusados, ordem}` | **só por transação**: entrar (pedido), aceitar/recusar/tirar/configurar/começar (o dono), o próprio "Pronto" |
| `pres/{uid}/{chave}` | uma entrada por conexão | o próprio (`onDisconnect().remove()`) |
| `bate/{uid}` | `{ts: TIMESTAMP, sid}` a cada 5 s com a aba à vista | o próprio |
| `lotes` | retratos × L + `fora` (para completar) | o dono, antes do Começar (o Começar confere) |
| `vivo` | o estado do leilão (abaixo) | todos, **só por transação** |
| `vendas/{i}` | registro para a tela; a verdade é o `vivo.d` | qualquer um |
| `escal/{t}` | `{formacao, tit:[índice × 11], pronto}`; índice < L = lote, ≥ L = `fora` | o próprio |
| `jogos/{id}` | `{e:'aberto'\|'reservado'\|'feito', esc, trava:TS, modo, por, inicio:TS, res, ts:TS}` | os do jogo; qualquer um nos prazos; por transação |
| `rtc/{id}` | o sinal WebRTC do par (PR 5), apagado ao ligar e no `onDisconnect` (como o `online3d.js`) | o par |

O calendário, a abertura da rodada (`abre(r) = max ts` da rodada anterior) e a escalação automática são funções puras:
ninguém grava.

**`vivo`** (~0,5–0,8 KB):

```
{ seq, fase: 'lotes'|'rep'|'fim', k: posição na fila, i: índice do lote, abre: TS, n, lider, valor, t: TS,
  h: [[t, v] × ≤5], p: "00100000" (quem passou), d: "ab-c…" (comprador de cada lote; '-' sem dono),
  sem: [lotes sem lance], cx: [[saldo, vagas, gk, df, mf, fw] × T] }
```

O `cx` e o `d` dentro do `vivo` deixam a transação conferir tudo sozinha e fazem do `vivo` a verdade das compras.
`seq` sobe a cada lote aberto (também na repescagem do mesmo `i`). As funções aceitam a falta de `p`, `h`, `sem` (o
Firebase não guarda objeto vazio).

### 3.3 Protocolo

**A sala:**

| Estado | Sai quando |
|---|---|
| `saguao` | o dono toca em Começar: transação em `sala` que confere `estado === 'saguao'`, T ≥ 2, todos prontos e os `lotes`, e grava `estado:'leilao'` e `ordem`; logo depois, o `vivo` inicial (transação de `null`) |
| `leilao` | `vivo.fase === 'fim'` → qualquer aparelho passa a `escalacao` |
| `escalacao` | todos prontos ou 60 s → `camp` |
| `camp` | todos os jogos `feito` → `fim` |
| `fim` | o dono encerra, ou 24 h |

Entrar é um pedido (transação em `sala` que confere o estado, a lotação, `recusados`, edição e `regras`); o dono aceita
noutra transação. Os batimentos e a presença ficam FORA de `sala` (dentro, cada `bate` faria as transações repetirem).

**O lote** (as funções puras de `leilao.js`, sempre dentro de `transacao(vivo)`; `fim = max(abre + espera + dur, t +
ext)`, derivado, ninguém grava):

| Ação | Aceita se | Grava |
|---|---|---|
| `lance(t, alvo, seqVisto)` | `vivo.seq === seqVisto`; o toque tem ≤ 2 s; agora ∈ [abre + espera, fim); pode (1.3); `valor + 1 ≤ alvo ≤ máximo` | `n+1`, `lider`, `valor`, `t: TIMESTAMP`, `h` |
| `passar(t, seqVisto)` | `vivo.seq === seqVisto`, não é o líder | `p[t]`; todos passaram ou não podem → **fecha na mesma transação** |
| `fechar(seqVisto)` | a hora do servidor ≥ fim (testemunha), ou todos passaram | vendido: `cx` e `d`; sem lance: `sem`; o próximo lote (pula os que ninguém pode), `seq+1`, `abre: TIMESTAMP`; sem lotes: `rep`, depois `fim` com o completar de graça |

- **"+1" é sobre o valor VISTO.** Se alguém passou na frente, aborta e a tela mostra o preço novo; nunca sobe sozinho.
- **Sem `applyLocally`** (`transaction(fn, fim, false)`): nada de líder falso piscando.
- **A hora do servidor na transação:** o `ServerValue.TIMESTAMP` vai cru e o servidor resolve (o SDK manda o
  `currentOutputSnapshotRaw`). O `onComplete` recebe a ESTIMATIVA local: a hora certa se lê depois do ack.

**Quem age (sem "martelo"):** fechar o lote, o lance de um bot, o passe de quem sumiu, simular bot × bot, o prazo de um
jogo e apagar a sala vencida são transações **idempotentes** que QUALQUER aparelho roda. Para não brigarem, o k-ésimo
presente (na `ordem`) espera 1,5 s × k depois do momento certo; o 1º age na hora. Dois ao mesmo tempo não estragam nada.
O leilão anda com qualquer um presente.

**Testemunha da hora** (o relógio de nenhum aparelho decide): antes de toda decisão por prazo (fechar, passe de
ausente, prazo de jogo, limpeza), o aparelho grava `TIMESTAMP` no próprio `bate`, espera o ack e lê o valor que o
SERVIDOR resolveu; só age se ele já passou do prazo. Custa uma ida e volta e torna impossível fechar cedo, mesmo com o
relógio do aparelho adiantado ou ajustado no meio.

**Relógio da tela:** `performance.now()` + a diferença para o servidor, recalibrada a cada `bate` (vale a amostra de
menor ida e volta numa janela). A tela nunca é a juíza.

**Presença:**
- `pres/{uid}/{chave}` por conexão, com `onDisconnect().remove()`, rearmado a cada reconexão (remover não recria a
  sala apagada, ao contrário do `set(false)`).
- **Decide-se pelo `bate` fresco** (≤ 12 s pela testemunha); o `pres` só aparece na tela. Duas abas ou dois aparelhos
  da mesma conta são distinguidos pelo `sid` (só a sessão mais recente age).
- Aba escondida para o `bate`. Ao voltar depois de > 5 s escondida: `goOffline()/goOnline()` (o iPhone deixa o socket
  meio aberto), "Atualizando…" até o ack do próximo `bate`; `bate` sem ack em 3 s = "Reconectando…".

**Reconexão:** o SDK refaz os ouvintes; tudo sai do banco, nunca só da memória; `.info/connected` falso desliga os
botões. Recarregar volta à sala por "Minhas salas" e pelo `?leilao=`.

**Conferência pelos aparelhos honestos:** cada `vivo` novo é conferido contra o anterior com as mesmas funções puras
(lance ≤ máximo, saldo só cai no fechamento e pelo valor do líder, nada do nada) e todo resultado simulado é
recalculado. Se algo não bater: "A sala foi alterada fora das regras" e o estado congela.

### 3.4 Regras do Firebase e o que se protege

- **Sem mexer nas regras** (`firebase/regras-database.json`, raiz `.read/.write = auth != null`), o nó `leiloes/`
  funciona. É o nível "entre amigos", como todo o online do TM hoje.
- **O limite real:** qualquer cliente logado que abra o console lê o banco inteiro (os códigos das salas, as notas, a
  semente, a ordem dos lotes) e grava qualquer coisa. "Ninguém de fora entra" vale pela tela: o código e o aceite do
  dono. A conferência (3.3) detecta lance e resultado simulado fora das regras; não impede lance em nome de outro,
  resultado de 3D forjado nem apagar a sala.
- **Opcional (decisão 10):** um bloco SÓ de `.validate` em `leiloes/$c`, aditivo (a raiz e os outros modos não
  mudam): `t`, `abre` e `ts` iguais a `now`, lance só com `now < fim`, valor só sobe, resultados e registros só gravam
  uma vez, autor = `auth.uid` por `tec/$uid/auth` (a conta vinculada tem `net.me.uid` ≠ `auth.uid`). Torna o servidor
  o juiz do tempo. Não protege contra apagar. O arquivo fica pronto no PR 2; o dono publica no console se quiser.
- **Blindar de verdade** exige tirar o `.write` da raiz, e isso mexe em todos os modos online.

### 3.5 Robôs

Função pura `robo(vivo, lotes, bot, semente)`; roda em qualquer aparelho, numa transação idempotente ("se o bot não
lidera e valor + passo ≤ L, dá o lance; senão aborta"). Valores do zer2 e da Rotowire.

1. **Valor do lote:** D_p = vagas abertas da posição p; rep_p = nota do (D_p + 1)-ésimo melhor lote restante de p;
   v = max(0, nota − rep_p)^1,5.
2. **Preço de mercado:** G = Σ (saldo − vagas) da sala; M = 1 + G·v / Σv dos lotes que devem ser comprados,
   recalculado a cada lote.
3. **Necessidade:** 0 se não cabe; × 1,3 com a posição escassa; × 1,5 na última vaga dela com poucos lotes restantes.
4. **Perfil sorteado:** Estrelas (× 1,25 acima do p80, × 0,8 no resto, teto 60% num lote), Equilibrado (× 1, teto
   35%), Paciente (× 0,85 na 1ª metade, × 1,15 na 2ª); agressividade 0,9–1,1 e ruído de ±10% por lote.
5. **Limite** L = min(máximo legal, M × necessidade × perfil × ruído, teto).
6. **Ação:** lance de 0,7 a 2,5 s depois (sorteado pela semente), passo +1 (ou +2 a +5 bem abaixo de L), nunca com
   menos de 0,6 s; acima de L, passa.
7. **Fim de jogo:** com vagas ≥ lotes que cabem e restam, L sobe até o necessário, sempre ≤ o máximo legal.
8. **Notas escondidas:** a nota percebida.

### 3.6 Simulação e 3D

- **O time do técnico** (`leilao-camp.js timeDoTecnico`): `{id: "leilao_"+código+"_"+t, name, short, players,
  formation, colors, escudoUT}`; os `players` na ordem das vagas, com `adjustForSlot`, camisa pela vaga (GK = 1); o id
  é único por técnico (o Online 3D trata o mesmo id como o mesmo clube, `online3d.js escolheUniformes`).
- **O motor:** `TM.engine.simulate(a, b, {realism: 3, neutral: true, semLesao: true})` dentro de `comSemente`.
- **Gol de ouro, sem mexer no motor:** simular 91'–120' (`startMinute: 91, endMinute: 120, startScore`) e cortar no 1º
  gol depois dos 90; empate de novo: `TM.engine.shootout`; tudo na mesma semente (`…:pror`).
- **O 3D contra bot:** o leilão chama `TM.matchview.play` com o `result` simulado com a semente, `pauseSide`,
  `simOpts {realism:3, neutral:true, dificuldade3d, ajustesFixos3d:true, duracao3d}`, `empateContinua: true` no
  mata-mata e o gancho novo `gravar(origem, dados)`:
  - no `fim` do 3D, ANTES do `aplicaResultado` e da reprodução 2D, o `tm3d.js jogarCfg` chama `gravar('3d', r3)` e
    espera (o `termina` já apagou o `tm3d:resultado`, e fechar o app na reprodução perdia o 3D);
  - no "Simular partida", `gravar('simulado', titulares)` faz o simulado com a semente e os titulares da tela (o
    `escalacaoDaTela` de hoje simula de novo SEM semente) e devolve o resultado;
  - com o gancho, o 2D vai sem pausa;
  - com "Sempre simular" ou sem WebGL, o leilão grava antes e chama o 2D com `pauseSide: null`.
- **Time de 11 sem banco no 3D** (`golaco/js/tm-times.js`): conferir no `testar-3d` com um pedido de 11 jogadores.
- **O Online 3D do par** (PR 5): extrair do `online3d.js` a "sessão de partida" (`criarLigacao` + `montaPedido` +
  `abre` + `entregaPorta` + `fimJogo` + `saiuJogo`) para `TM.online3d.confronto({ref, papel, meuTime3d, info,
  duracao, aoFim, aoSair})`, com o sinal em `leiloes/{c}/rtc/{jogo}`; a sala do Online 3D de hoje passa a usar a mesma
  função (o `testar-online3d.mjs` continua verde). No GOLAÇO, a tela antes do jogo do online ganha **Simular partida**
  ao lado do "Pronto" (um bit a mais no pacote da página, `online-pagina.js`/`prepartida-tela.js`): qualquer um escolhe
  Simular e os dois saem com `motivo: 'simular'`. O resultado vai ao `jogos/{id}`, não ao h2h nem ao ranking.
- **Notas escondidas no 3D** (PR 6): `partida.notasOcultas` faz o `elenco.js notaExibida` devolver "sem nota" e esconde
  os `numerosCarta` e o GERAL (`notaTime`/`estrelas`) na tela antes do jogo, no Editar time e na pausa. Sem o campo,
  nada muda (hash igual, fecho 0).

### 3.7 Mudanças fora dos arquivos novos

| Arquivo | O que muda | PR |
|---|---|---|
| `js/rng.js` | `hashStr` e `comSemente` (iguais aos de `copa.js:30-48`; o `TM.rng.make` já é o mulberry32); a `copa.js` não muda | 1 |
| `js/data.js` | `TM.data.mundoBase()`: o `generateWorld` sem as edições, fora do cache | 1 |
| `js/ultimate.js` | exportar `CORES`, `FORMAS`, `SIMBOLOS` e um seletor de escudo reaproveitável (hoje preso ao `st()` da `ut-identidade`) | 1–2 |
| `js/ui.js` | o atalho em `MAIS`; `escudoDe` (pôster) com o `escudoUT` | 1, 3 |
| `css/styles.css` | o bloco LEILÃO; a grade 7 + 6 | 1 |
| `js/cenas.js` | `"leilao": ["mesa", "Leilão"]` | 1 |
| `js/icones.js` + `ferramentas/gerar-icones.py` | `gavel`, `eye-off`, `copy`, `share-2` e o conserto da `semEmoji` (3.8) | 1 |
| `js/app.js` | `?leilao=CÓDIGO` | 2 |
| `js/engine.js` | a opção `semLesao` (sem ela, igual) | 3 |
| `js/matchview.js` | `crestOf` e o placar dos pênaltis com o `escudoUT`; a "prorrogacao" com `golDeOuro` | 3 |
| `js/pitch2d.js` | `pickColors` lê `t.colors` | 3 |
| `js/tm3d.js` | o gancho `gravar` e o 2D sem pausa; `partidaDe` lê `so.duracao3d`; PR 6: `notasOcultas` | 4, 6 |
| `js/online3d.js` | a sessão de partida separada | 5 |
| `golaco/` | "Simular partida" no online (PR 5); notas escondidas (PR 6) | 5, 6 |
| `index.html`, `sw.js` | os arquivos novos e a versão | todos |
| `.github/workflows/tm-testes.yml` | novo (4.4) | 1 |

### 3.8 "Mais modos", ícones, link e licença

- **O atalho:** `{icone: "gavel", nome: "Leilão", rota: "leilao"}` em `MAIS` (`ui.js:869`).
- **A grade com 13 atalhos** (hoje 12 numa linha a partir de 1280 px; 13 dão ~80 px e "Modo Livre 3D" quebraria):
  passa a **7 + 6** a partir da largura em que "Modo Livre 3D" cabe sem quebrar, medida com a barra de rolagem do PC
  (entre 760 e 820 px); no celular, 3 + 3 + 3 + 3 + 1. Mudam junto `testar-online3d.mjs:339-340`,
  `testar-livre.mjs:138-139` e `testar-penaltis.mjs:123`.
- **Ícones** pelo `EXTRA` do `gerar-icones.py`. Antes de rodar o gerador, levar a `semEmoji` (`icones.js:584`) para o
  `MODELO` do gerador (`:358`), senão a regeneração apaga a função que o `tm3d.js` usa. O `git diff js/icones.js` só
  pode mostrar os 4 ícones.
- **Link:** `app.js` ganha `?leilao=CÓDIGO` → `TM.ui.go("leilao", {codigo, auto: true})`, protegido contra reentrar ao
  recarregar (como o `VIEW.autoFeito` do Online 3D).
- **Licença:** como o Online 3D (fora do `PAID_ROUTES`; o cadeado está desligado).
- **Documentação:** um parágrafo "Modo Leilão" na seção TOTAL MATCH do `CLAUDE.md`, atualizado em cada PR.

---

## 4. Os testes

Nenhum teste usa o Firebase de verdade.

### 4.1 Node: `ferramentas/testar-leilao.mjs` (novo; ~20 s)

Carrega num `vm` `rng.js`, `data.js` (com um `TM.storage` falso), `viverde.js`, `competitions.js`, `engine.js` e os
arquivos do leilão (carregar o `data.js` assim é trabalho novo: o `teste-ponte-tm.mjs` só carrega o `tm3d.js`). Roda as
duas edições.

| Bloco | O que prova |
|---|---|
| L1 lotes | Nas 30 ligas × 2 edições × T de 2 a 8: 13T lotes, cota por grupo, sem especial, sem repetidos, do mundo-base (com edições e clube criado no armazenamento falso, os lotes não mudam), a mesma semente dá os mesmos lotes |
| L2 ordem | Goleiros espalhados; a mesma semente dá a mesma ordem |
| L3 lance | Mínimo R$ 1; máximo = s − (v − 1); Tudo; não cabe → recusado; completo → recusado; `seq` visto diferente → aborta (também na repescagem do mesmo lote); toque velho → aborta; valor ≤ atual → aborta; líder não passa |
| L4 relógio | fim = max(abre + espera + dur, t + ext); lance depois do fim recusado; com 3 s faltando → 8 s |
| L5 fechar | Vendido desconta o caixa e marca o `d`; sem lance → repescagem; todos passaram → fecha na hora; ninguém pode → pulado; fechar 2× = 1× |
| L6 fim | Todos com 11 que cabem numa formação, 1 goleiro; o completar usa só jogadores de fora |
| L7 robôs | Nunca passam do máximo; 1 000 leilões só de robôs: ≥ 99% completam sem a reposição; o preço cresce com a nota; a mesma semente dá o mesmo leilão; dois robôs não repetem a sequência; o mesmo robô rodado por 3 "aparelhos" dá o mesmo leilão |
| L8 protocolo | O leilão inteiro pela rede em memória (latência, transações concorrentes, ações escalonadas) = a máquina pura |
| L9 formações | O emparelhamento com os grupos (`playerVersa`): o MEI/ATA cabe como atacante; dois goleiros nunca; as vagas = as do `TM.comp.FORMATIONS` |
| L10 conferência | Um `vivo` adulterado (saldo que sobe, lance acima do máximo, venda sem dinheiro) é acusado |
| C1–C8 (PR 3) | Calendário (todos contra todos, ninguém contra si, folga com T ímpar, as rodadas certas), tabela com desempate que não depende da ordem das chaves, chave com folgas, gol de ouro corta no 1º gol, mesma semente = mesmo resultado, classificados do misto, `semLesao` sem lesão e o motor sem a opção igual, a máquina do jogo (aberto → reservado → feito; prazo; W.O.) |

### 4.2 Navegador num aparelho: `testar-leilao.mjs --tela` (PR 1, 3, 4)

Com o `golaco/tools/lib/navegador.mjs` (`abrir`, `rotearCdn`) e o relógio acelerado por gancho de teste.

- "Mais modos" com 13 atalhos: 7 + 6 no PC (com a barra de rolagem) e no tablet, 3·4 + 1 no celular, sem nome quebrado
  e sem emoji.
- O treino inteiro: criar com 3 bots, o leilão até o fim (os botões, os estados apagados com o motivo, o Tudo de dois
  toques, passar), a escalação, o campeonato e o fim; recarregar no meio e voltar ao mesmo ponto.
- Nada sobre nada nas telas nos 8 tamanhos da seção 2 (a `sobreposicao` do `testar-online3d.mjs:282-316`), a barra de
  lance à vista com o relógio rodando (também em 844×390), modo claro, a região ao vivo no HTML inicial.
- PR 4: o jogo contra bot pela página de ensaio do 3D; o 3D fechado no meio = W.O.; o "Simular partida" grava antes de
  mostrar e o 2D vem sem pausa.

### 4.3 Navegador com o banco falso: `ferramentas/testar-leilao-online.mjs` (PR 2–5)

**O banco falso vira biblioteca** (`ferramentas/lib/banco-falso.mjs`, tirado do `testar-online3d.mjs:52-200`, que passa
a importá-lo e continua verde), estendido para se comportar como o SDK:
- a transação roda a 1ª vez com o CACHE local (`null` em caminho não ouvido) e repete com o do servidor;
- `TIMESTAMP` resolvido no servidor, com a estimativa local no `onComplete`;
- `.info/serverTimeOffset` por página e um relógio do servidor ÚNICO, ligado ao relógio acelerado das páginas;
- latência por chamada; `.info/connected` que vai a falso; gravação guardada sem conexão e reenviada na volta;
- "gravou e o ack se perdeu" (`disconnect` depois de gravar); `cairPagina` (que hoje existe e nunca é chamada).

**Casos:** 2, 4 e 8 páginas com os mesmos `vivo`, compras e caixas em todas; dois lances no mesmo instante (um vence, o
outro vê "Alguém chegou antes"); o relógio de uma página ±5 s e um pulo do relógio DEPOIS da calibração (os prazos não
mudam, ninguém fecha cedo); o 1º aparelho cai (os outros continuam, os bots também); um técnico some (passa sozinho e
volta); o lance com o ack perdido ("Conferindo…" e o resultado certo); a repescagem com um lance velho guardado (é
recusado); recarregar no meio; recusas (edição, `regras` diferentes, sala cheia, código errado, recusado) e o deploy no
meio (quem é da sala volta); o pedido aceito e o recusado; passar o clube; o convite `?leilao=`; o campeonato (o mesmo
resultado e a mesma tabela em todas as páginas, o prazo vencido, o jogo reaberto que não joga de novo); PR 5: o par no
Online 3D pela página de ensaio (e com `--golaco` o 3D de verdade), a ligação que falha e vira simulado; os bytes
baixados por página.

### 4.4 Os outros e o CI

- `python3 ferramentas/conferir-estilos.py` = 0 em todo PR.
- `ferramentas/testar-sobreposicao.mjs` nas rotas `leilao` e `leilao-criar` (as da sessão ficam no 4.2/4.3).
- `testar-livre.mjs`, `testar-penaltis.mjs` e `testar-online3d.mjs` no PR 1 (a grade); `testar-3d.mjs` (e
  `--publica`) nos PRs 4 e 6; `testar-online3d.mjs` (e `--golaco`) no PR 5.
- GOLAÇO (PR 5 e 6): `teste-online-tela`, `teste-prepartida-tela` e, no 6, `teste-ponte-tm`, `teste-pausa-tela` e
  `teste-editor-tela`; `hash-igual`/`hash-partida` IGUAIS e `fecho-hash` 0.
- **CI:** hoje um PR só do TM não tem check (o `golaco-testes.yml` só olha `golaco/**`). O PR 1 cria
  `.github/workflows/tm-testes.yml` (`paths: legacy-total-match/**`) com o Node do leilão e o `conferir-estilos.py`; a
  partir do PR 2, também os de navegador (Playwright, como no `golaco-testes.yml`). O deploy não muda.

### 4.5 Reprova antes, passa depois

| PR | Reprova na main | Passa no PR |
|---|---|---|
| 1 | `testar-leilao` (sem `TM.leilao`); a grade de 13 atalhos | L1–L10 e a tela |
| 2 | `testar-leilao-online` (sem a sala) | 2/4/8 páginas, corrida, relógio, quedas, recusas |
| 3 | C1–C8; gol de ouro (a prorrogação de hoje vai a 120'); `semLesao` | idem |
| 4 | O 3D fechado no meio que jogaria de novo; o "Simular partida" que sorteia sem semente; a pausa do 2D que sorteia o resto | idem; `testar-3d` sem recuo |
| 5 | O par no Online 3D com o time do leilão; "Simular partida" no online | idem; `testar-online3d` e `teste-online-tela` sem recuo |
| 6 | A nota visível com `notasOcultas` | idem; sem o campo, o GOLAÇO igual |

---

## 5. Os PRs em ordem

**O 1º PR é o leilão contra os bots num aparelho; o online vem logo no 2º.** O núcleo (regras, relógio, robôs, telas)
é o MESMO código do online, porque passa pelo transporte; o dono sente e ajusta a mecânica cedo; e o pedido é "com
amigos online", que chega no 2º PR em vez do 3º.

| PR | Entrega | O que o dono ganha | Horas |
|---|---|---|---|
| 1 | `leilao.js`, `leilao-rede.js` (memória com gravação), `leilao-sessao.js`; telas Entrada, Criar sala (treino), Leilão, Escalação; `mundoBase`; Mais modos 7 + 6; ícones com o conserto do gerador; `rng.js`; `testar-leilao` (Node + tela); `tm-testes.yml` | O leilão inteiro contra 1–7 bots e a escalação; a aba Campeonato diz "em breve" | ~28 |
| 2 | `leilao-rede.js firebase()`; o nó `sala` (pedido, aceite, Começar por transação); Saguão (código, olho, convite, QR, pedidos, participantes, Pronto, passar o clube); o seletor de escudo; presença por conexão; testemunha da hora; ações escalonadas; ausente passa; edição e `regras`; `?leilao=`; Minhas salas; a conferência; o bloco `.validate` opcional; `lib/banco-falso.mjs`; `testar-leilao-online` | **Com os amigos online:** a sala e o leilão ao vivo | ~28 |
| 3 | `leilao-camp.js`; a aba Campeonato (3 formatos, tabela, chave, a máquina do jogo, prazos, "Simular os pendentes", "Ver o jogo", o fim); `semLesao`; o escudo desenhado no 2D; a "prorrogacao" com gol de ouro | O campeonato no treino e online, com os jogos simulados | ~20 |
| 4 | O gancho `gravar` no `tm3d.js` e o 2D sem pausa; `duracao3d`; o Jogar contra bot no 3D; o W.O. do 3D sem resultado | Os seus jogos contra bots em 3D | ~10 |
| 5 | `TM.online3d.confronto`; o par do leilão no Online 3D; "Simular partida" na tela antes do jogo do online (GOLAÇO); a ligação que falha vira simulado | Você contra um amigo em 3D ao vivo | ~17 |
| 6 | Notas escondidas: a opção, a carta neutra (`cardEl` com `semNota`), os bots com a nota percebida, o fim que revela, `partida.notasOcultas` no GOLAÇO | O "leilão no olho" | ~8 |

**Total: ~111 h** (faixa 110–125 h). Para comparar: o `online3d.js` tem 1 142 linhas e o teste dele 647; o PR 1
sozinho soma ~3 000 linhas entre lógica, robôs, sessão, telas responsivas com tema claro e testes.

Cada PR: branch a partir da main → testes locais só do que muda (modo enxuto) → o CI decide o resto → merge, link e o
parágrafo do `CLAUDE.md` atualizado.

**Depois deste plano** (não entra nas horas): o 5 em campo jogável (decisão 3), os pênaltis do mata-mata no Pênaltis 3D
(`TM.tm3d.jogarPenaltis`) depois de um empate jogado em 3D, um amigo atrasado assumir um bot no meio.

---

## 6. Riscos e o que mitigar

| Risco | Mitigação |
|---|---|
| **Plano grátis do Firebase (Spark):** 100 conexões simultâneas no TM INTEIRO (uma por aba que abriu algo online) e 10 GB/mês baixados | Um leilão de 8 com 104 lotes baixa ~2 MB por página (~16 MB no total): dá ~600 leilões por mês. Medir os bytes no PR 2. Sem conexão: "Servidor cheio, tente em alguns minutos". **Perguntar ao dono** se o projeto está no Spark |
| **Trapaça** (a raiz aberta) | Transações com as regras; tudo deriva do `vivo` e de `jogos`; a conferência pelos aparelhos honestos; o `.validate` opcional (3.4). Entre amigos |
| **Relógio** (hora errada, ajuste no meio, latência) | A testemunha da hora em toda decisão; o fim derivado; a tela nunca é a juíza; teste com ±5 s e com o pulo depois da calibração |
| **Celular que dorme** (o iPhone para o JavaScript; o socket fica meio aberto; com a aba escondida o SDK pode esperar até 5 min para reconectar) | Wake Lock; a decisão pelo `bate`, não pelo `pres`; `goOffline/goOnline` ao voltar; qualquer aparelho age; ausente passa |
| **8 pessoas ao mesmo tempo** (disputa no `vivo`) | O `vivo` pequeno; quem chega tarde aborta e vê o preço novo; teste com 8 páginas |
| **O banco falso não é o Firebase** | O falso com o comportamento do SDK (4.3); o 1º leilão real com o dono e um amigo depois do PR 2 |
| **Resultados iguais entre aparelhos** | O resultado gravado uma vez; o motor só usa contas exatas e o sorteio preso à semente |
| **Jogar de novo até ganhar** | A trava com a hora do servidor; gravar antes de mostrar; 2D sem pausa; o 3D sem resultado = W.O. (decisão 15) |
| **Licença da edição pro** | Mesma edição para todos; na pro, só com a chave |
| **Partidas longas** (8 técnicos em pontos corridos com 3D passam de 3 h) | Padrão mata-mata; a duração na Criar sala; os prazos; "Minhas salas" para voltar outro dia |
| **A grade "Mais modos"** e **o gerador de ícones** | 7 + 6 medido com a barra de rolagem; o conserto da `semEmoji` antes de regenerar |
| **Testes do TM fora do CI** | `tm-testes.yml` no PR 1 |

---

## 7. Decisões do dono (com a recomendada, para aplicar e avisar)

| # | Decisão | Recomendada |
|---|---|---|
| 1 | Treinar sozinho contra bots | **Sim**, no PR 1 (sem internet, só o leilão e o simulado: o 3D baixa do CDN) |
| 2 | O formato padrão | **Mata-mata** (a sua palavra), com os 3 formatos das fotos à escolha |
| 3 | 5 em campo | **Fica para depois, jogável.** A sua direção é "nada novo só para a simulação", e o 2D de hoje desenha 11 contra 11 num jogo de 5. Depois: 5 × 5 no 3D a partir do Modo Livre e no 2D, ~15–20 h. Alternativa: 5 em campo só simulado já na v1 (+~6 h no 2D) |
| 4 | O relógio do lance | **Abre com 10 s; lance com menos de 8 s volta a 8 s; todos passaram → fecha na hora** |
| 5 | O lote sem lance | **Repescagem no fim (6 s); quem ainda tiver vaga completa de graça** com os melhores de fora |
| 6 | Quem some no meio do leilão | **Passa sozinho e não gasta nada;** completa de graça no fim. (Antes: um piloto automático que comprava; atender uma ligação gastaria o dinheiro da pessoa) |
| 7 | Você × amigo: onde escolher Jogar ou Simular | **Na tela antes do jogo, como você disse:** um botão Jogar no cartão (como em todo jogo do TM desde o item 124) e, na tela do Online 3D, "Simular partida" ao lado do "Pronto" (~5 h no GOLAÇO, no PR 5). Alternativa: escolher no cartão do TM (Jogar ao vivo / Simular), sem mexer no GOLAÇO |
| 8 | Prazos da rodada | **2 min para começar** (só correm com alguém do jogo presente) **e 2 × duração × 1,3 + 8 min para o 3D** (18 min com 4 min por tempo); você tem "Simular os pendentes" |
| 9 | Edição da sala | **A do dono para todos;** a pública troca sozinha; a pro só com a chave. Os jogadores vêm do mundo-base (sem Editor nem carreira) |
| 10 | Segurança | **"Entre amigos"** (as regras do Firebase como estão) + a conferência pelos aparelhos. Opcional: o bloco `.validate` só do leilão, que você publica no console (não mexe nos outros modos) |
| 11 | Ranking e moedas | **Não conta no ranking online nem no h2h, e não usa Total Coins** |
| 12 | Elenco | **Só os 11, sem reservas; lesão desligada no leilão;** cartões não passam de um jogo para o outro. Alternativa: 1–3 reservas (mais lotes) |
| 13 | Notas escondidas | **Entram no PR 6.** Pergunta: as notas aparecem no fim de CADA partida (a foto diz "no fim das partidas") ou só no fim do campeonato? |
| 14 | Classificados do formato misto | **Até 4 técnicos, os 2 primeiros fazem a final; de 5 a 8, os 4 primeiros** |
| 15 | Jogo em 3D que fica sem resultado (fechou o app, o celular travou) | **W.O. de quem reservou**, a mesma regra do Online 3D; o 3D que nem chegou a abrir = simulado. Alternativa: o resto simulado a partir do placar parcial (um recado novo do 3D, +3 h) |
| 16 | Quem entra na sala | **Você aceita cada pedido** (um toque, como no Online 3D) |

**Perguntas:** o projeto do Firebase está no plano grátis (Spark)? Chegaram 7 fotos e nenhuma das abas Escalação e
Campeonato: há mais alguma antes do PR 3?

---

## 8. Revisão (depois das duas críticas)

Cada ponto foi conferido no código (e41aa791) e, na sincronia, no código-fonte do SDK do Firebase.

**Mudou no plano:**
- **Ninguém fecha cedo pelo relógio do próprio aparelho:** toda decisão por prazo passa pela testemunha da hora do
  servidor; o relógio da tela é recalibrado a cada batimento (crítica de sincronia G1).
- **Sem segunda chance:** o 3D grava no fim da partida, antes da reprodução 2D (hoje o `termina` apaga o
  `tm3d:resultado` antes); o 3D sem resultado = W.O.; o simulado grava antes de mostrar e o 2D vem sem pausa (a pausa
  sorteia o resto com `Math.random`, `matchview.js resimRest`); a semente leva a hora da trava (sincronia G2 e leve 7;
  produto M2).
- **O nó `sala`** com entrar, aceitar e começar por transação (a transação em `tec/{uid}` com `if (!cur) return cur`
  nunca deixava ninguém entrar; o Começar por `update` tinha corrida) (sincronia M1).
- **As compras moram no `vivo.d`**; `vendas` é só registro (sincronia M2). **`seq`** e o toque de ≤ 2 s contra o lance
  velho na repescagem (M3). **"Conferindo…"** para o lance com o ack perdido (M4).
- **Presença por conexão e decisão pelo `bate`**; o `sid` separa abas e aparelhos da mesma conta (M5).
- **Sem martelo:** bots, fechamento, passes de ausente, prazos e jogos de bots são transações idempotentes de qualquer
  aparelho, escalonadas; o calendário, a abertura da rodada e a escalação automática são funções puras (M6).
- **Quem some passa e não gasta** (M7; muda a decisão 6).
- **A versão do TM não tranca ninguém fora da própria sala:** vale a constante `regras` do `leilao.js` (sincronia M8;
  produto G2).
- **O campeonato:** uma máquina por jogo com o resultado dentro; prazo do 3D pela duração; quem sobra grava o W.O.; a
  ligação que falha ou dessincroniza vira simulado; o prazo de começar só corre com alguém do jogo presente; "Simular os
  pendentes" (sincronia M9; produto M6 e M7).
- **O dono aceita quem entra**; o limite real das regras escrito; o `rtc` apagado ao ligar (sincronia M10).
- **O banco falso como o SDK:** a transação pelo cache, o ack perdido, a gravação guardada sem conexão, um relógio do
  servidor só (M11). O risco "`Math.exp`/`pow` podem variar" saiu: o `engine.js` só usa contas exatas (M12), o que
  permitiu a conferência dos simulados.
- **Leves de sincronia aplicados:** o `TIMESTAMP` dentro da transação funciona (o risco aberto fechou; ler a hora
  depois do ack); a volta do iPhone com `goOffline/goOnline` e a Wake Lock pedida de novo; presença por `remove()` (o
  `set(false)` recriava a sala apagada); a limpeza pela testemunha; passar o clube; os lotes do mundo-base (o Editor
  mudaria as notas); "Próximos lotes" para todos; o leilão anda com quem voltar; técnicos por índice e o `vivo`
  menor.
- **Jogar/Simular na tela antes do jogo**, um botão Jogar no cartão, também contra amigo (produto G1; decisão 7).
- **Só 11 em campo na v1** (produto G3; decisão 3): saem as formações de 5, a cota de 5 e os 24 lotes.
- **Os grupos do jogador** (`pos` + `playerVersa`) e o emparelhamento no lugar das contagens (produto M1).
- **O escudo desenhado no 2D** (`escudoDe`, `crestOf`, o placar dos pênaltis, `pickColors`) e o seletor tirado do
  Ultimate (produto M3). **A barra da sessão** com Sair, Som, Como funciona, Participantes e Vendas (M4). **A barra de
  lance própria**, sempre à vista (M5). **Minhas salas** e o treino gravado no aparelho (M6). **A edição trocada
  sozinha** na pública (M8). **As horas** refeitas: ~80 → ~111 h (M9). **A lesão desligada** no leilão (M10).
- **Leves de produto aplicados:** a grade 7 + 6 medida com a barra de rolagem; a cena "mesa" no lugar da "moedas"; a
  licença como o Online 3D; o escudo nunca real e sem cores repetidas; a pergunta das notas escondidas; o `rng.js` só
  ganha `hashStr` e `comSemente`; o "check" das abas; mudar a configuração zera os "Pronto"; as aproximações do
  `FORM_3D`; os 8 tamanhos de tela; o Tudo de dois toques; o treino sem internet sem o 3D; os índices da escalação; o
  `homeClubId` no retrato; o deploy de ~25 min por merge.
- **A ordem dos PRs:** o online passou do 3º para o 2º PR.

**Recusado ou mudado, com o motivo:**
- **Herdeiros escalonados de um martelo** (sincronia M5): não precisa, porque o martelo saiu (todos agem, escalonados).
- **O prazo do campeonato só com "os dois do jogo presentes"** (produto M6): com uma pessoa sumida, o jogo do outro
  esperaria para sempre. Ficou "com alguém do jogo presente" + "Simular os pendentes"; sem botão de pausar.
- **W.O. só na 2ª reabertura do 3D** (produto M2): ainda daria uma segunda chance por jogo. Ficou W.O. na 1ª, com a
  exceção do 3D que nem abriu e a alternativa do placar parcial na decisão 15.
- **O `.validate` no lugar da detecção** (sincronia T): fica opcional (decisão 10), porque quem publica é o dono no
  console; a testemunha da hora já protege quem joga limpo sem ele.
- **Pênaltis 3D depois do empate no mata-mata** (produto leve 14): bom, mas fica para depois (a disputa jogada teria
  de gravar como o 3D; a v1 calcula com a semente).
- **Um amigo atrasado assumir um bot no meio** (produto leve 9): fica para depois; na v1, só o "passar o clube" de
  quem trocou de aparelho.

**Durante o PR 1** (o que o código real pediu de diferente do plano):
- **`mundoBase`** gera de novo a cada chamada (~0,2–0,3 s no Node, longe de 1 s: a reserva de recusar a liga com
  edições não precisou). As seleções são do módulo e o `generateWorld` empurra jogadores na lista de antes: o
  `mundoBase` devolve a lista e o técnico de cada seleção ao que eram, no mesmo objeto (sem isso, o mundo da carreira
  ganhava convocados).
- **O `vivo` ganhou o `f`**: no fim, o técnico de cada jogador de `fora` que completou um time de graça (a escalação
  usa índice ≥ L para eles). Sem líder é `lider: -1`, sem lance `valor: 0` e `t: 0`; o `seq` também sobe no fim
  (uma ação velha guardada aborta). Na repescagem `k` é a posição em `sem`, que fica parada (o lote sem lance de novo
  sai).
- **A extensão é `min(8 s, duração)`**: na repescagem (6 s) um lance devolve o relógio a 6 s, não a 8 s (com 8 s o
  lote passaria a durar mais que a própria repescagem). Com o lote de 10/15/20 s, 8 s.
- **O lance não fecha o lote** mesmo quando todos os outros já passaram: quem viu chama o `fechar` logo depois (o
  `passar` fecha na mesma transação, como o plano diz).
- **A conferência aceita estados pulados**: o ouvinte do Firebase pode ver o lote fechar sem ver o último lance (o
  fechamento é conferido pelo preço que saiu do caixa do comprador: ≥ o último lance visto, ≤ o máximo, de quem podia).
  Sem isso, uma sala honesta congelava. A hora não entra na conferência (a testemunha e o `.validate` cuidam dela).
- **`fora`** guarda até 1 GK, 5 DF, 5 MF e 4 FW por técnico (o máximo de cada grupo numa formação). Duas ligas com 8
  técnicos não têm atacantes que sobrem para isso (ch e py: 28 de 32); o mínimo de uma formação (1, 3, 2, 1 por
  técnico) sobra em todas, e o completar com todos passando sempre fecha os 11 (testar-leilao L6).
- **Os robôs** são `robo(vivo, ctx, bot, semente?)`: os lotes vêm no `ctx` (o contexto do leilão) e a semente, se não
  vier, é a da sala. O limite é constante dentro do lote. Nos 1 000 leilões só de robôs, 100% completam sem a
  reposição e o quartil de cima custa mais em 100%; sobram ~R$ 26 por técnico (o preço de mercado vale ~0 para quem
  está no nível da reposição): dá para apertar no ajuste fino com o dono.
- **A ordem** espalha cada grupo em passos iguais com as faixas de nota alternadas: 99% dos blocos de T com 2+
  posições e 82% com notas altas e baixas; o 1º goleiro cai, em média, a 6% da fila.
- O `testar-leilao.mjs` ganhou o bloco **R** (a rede em memória sozinha); o **L8** (o protocolo inteiro pela rede)
  entra com a sessão.
- **A sessão** (`leilao-sessao.js`, `TM.leilaoSessao`): `criarTreino`, `abrir` (o treino guardado e, nos testes, outro
  "aparelho" no mesmo banco), `salas` ("Minhas salas"), `atual`, `textoMotivo` e o gancho `acelerar`; a sessão expõe
  `ver()` (o que as telas mostram), as ações (`lance('+1'|'+5'|'+10'|'tudo'|número)`, `passar`, `mudarFormacao`, `trocar`,
  `prontoEscalacao`, `sair`, `parar`) e os eventos (`lote`, `lance`, `superado`, `vendido`, `semLance`, `formacao`, `fim`,
  `estado`, `alterada`). O treino passa pelo mesmo protocolo do online: a sala nasce no `saguao` e o Começar é uma
  transação; o `vivo` inicial é a transação de `null` do motor. A conferência (§3.3) já roda no treino.
- **O lance aborta se houve QUALQUER lance depois do que a pessoa viu** (o `n` mudou no mesmo lote), não só quando o valor
  passou do alvo: o "+5" com um lance no meio também aborta ("Alguém chegou antes: R$ X"), como diz o §1.3 ("nunca sobe
  sozinho"). Respostas do lance: `aceito`, `antes` (o preço novo), `fechado` (o lote já fechou), `recusado` (o motivo).
- **O relógio do treino é da própria sala:** anda com a página aberta e à vista, PARA com ela fechada ou escondida (a
  pessoa não perde lotes atendendo o telefone) e a hora da última ação vai para o caminho `relogio` da árvore. Recarregar
  no meio volta ao mesmo lote com o tempo que faltava (testar-leilao L8, "recarregar"). No online (PR 2) a hora é a do
  servidor e a página escondida segue a regra do ausente.
- **Os caminhos:** `lotes` = `{ l: retratos, f: fora }`; `vendas/{i}` = `{ t, v (preço), s (seq) }`, gravado por quem fechou o
  lote vendido; `escal/{t}` só leva `tit` quando a pessoa troca vagas à mão (sem `tit`, vale a automática); a sala ganhou
  `meta.treino`, `meta.fimLeilao` (a escalação vai até ele + 60 s), `cfg.ligaNome` e `tec.entrou` (a `ordem` = o dono e
  depois a ordem de entrada).
- **A escalação automática** é `TM.leilao.escalacaoDe` (pura): a formação preferida (ou a que cabe e mais se parece) e os 11
  nas vagas pelo método húngaro, com o menor custo de função (o `specificPenalty` do TM: −1/−2; cada um só numa vaga dos
  SEUS grupos). A troca à mão (`trocarVagas`) só aceita vagas dos grupos de cada um; mudar a formação volta à automática.
  Quando a compra tira a preferida, a sessão grava a nova e avisa (`formacao`).
- **Os bots do treino:** o nome pelo perfil sorteado ("Bot Arrojado/Ousado/Vistoso" para quem compra estrelas, "Bot
  Sereno/Calculista/Prudente", "Bot Paciente/Estrategista/Tranquilo"; avulsos quando acabam) e clubes inventados ("Cometa
  Azul FC", "Granito EC"…), escudo desenhado (forma e símbolo do Ultimate) e cor que não repete a de ninguém.
- **No máximo 3 treinos guardados no aparelho** (cada sala de 8 técnicos tem ~57 KB no `localStorage`, quase tudo os
  retratos dos lotes; o armazenamento é o mesmo das carreiras): o 4º tira o mais antigo. A avisar ao dono.
- **O Ultimate** só exporta pelo `TM.ut._i` as listas do escudo (`CORES`, `FORMAS`, `FORMA_ORDEM`, `SIMBOLOS`) e o
  `escudoCfg`: o `escudoEl(cfg, cor, sigla)` e o `escudoSvg(cfg, cor, sigla)` de hoje já servem a qualquer clube (não leem
  o `st()`), então não precisou de função nova.
- **A rede em memória:** `apagar()` é final (nada que já estava a caminho grava a sala de novo) e `salvarAgora()` grava no
  aparelho sem esperar (a página vai fechar).
- **testar-leilao** L8: 18 leilões pela sessão (en/T6, br/T4, it/T8) — 1 aparelho com 40 ms, 3 escalonados (0; 1,5; 3 s),
  3 ao mesmo tempo, latências sorteadas de 0 a 150 ms, o 1º aparelho caindo no meio e recarregar no meio — com um
  "humano" que age pela API da sessão; o fim e as vendas = a máquina pura nos casos determinísticos. O bloco **S** testa
  a sessão (identidades, botões e motivos, Tudo, antes/fechado, formação com aviso, trocar, Pronto → campeonato, pausa,
  aceleração, só olhar, a sala adulterada que congela, Minhas salas) e o **L9** a escalação (o ótimo contra a força
  bruta e contra qualquer troca de duas vagas).
- **As telas (o passo 3 do PR 1):**
  - O relógio do treino também PARA com a pessoa fora das telas da sala (o menu, a Entrada): `sessão.segurar("tela")`,
    junto com a página escondida (`segurar("pagina")`); a Entrada mostra "Leilão em andamento" com "Voltar à sala".
  - As abas Leilão · Escalação · Campeonato são próprias (`.lei-abas`, `nav` com `aria-current`), não o `TM.ui.sectorBar`
    (que rola de lado): cabem nos 8 tamanhos; a concluída troca o ícone pelo `circle-check`, sem emoji.
  - A barra da sessão: no celular os rótulos curtos ("Sair", "Som", "Regras", "Técnicos", "Vendas"; o nome inteiro no
    `aria-label`), os nomes completos ("Sair da sala", "Como funciona", "Participantes") a partir de 600 px e, no celular
    deitado, só os ícones na mesma linha das abas.
  - A barra de lance tem o valor que cada botão paga embaixo dele ("+5 / R$ 13"); a linha de cima mostra o retorno do
    toque por 2,5 s, senão o motivo do +1 apagado, senão "Seu máximo neste jogador: R$ X". "Conferindo…" (o ack perdido)
    e "passar o clube" só existem online: PR 2.
  - O "Começar o treino" fica no FIM da coluna da Criar, não numa barra fixa: fixa, ela ficava por cima dos campos nas
    larguras de celular (o `testar-sobreposicao` reprova). A Criar do treino não tem o Formato (PR 3) nem a duração e a
    dificuldade do 3D (PR 4); tem o tempo do lote em "Mais opções" e a duração estimada, medida com os robôs: ~0,9 × o
    relógio por lote quando todos passam rápido e relógio + 7 s quando ninguém passa (4 técnicos: 8 a 15 min; 8: 16 a 30).
  - O campinho do leilão tem sempre a proporção do celular (.62) e a carta pela largura dele (`cqw`); a separação das
    cartas (`separaCampo`) roda de novo quando a tela muda de tamanho. Com o .70 do Ultimate no PC, o goleiro encostava no
    zagueiro na 5-4-1 e na 3-5-2 (medido: folga −1,3 px; agora ≥ 8,7 px em todas as formações e tamanhos).
  - "Mais modos": o Leilão entra depois do Online 3D; 7 + 6 a partir de 790 px (o limite medido com a barra de 15 px é
    ~765), 5 + 5 + 3 de 760 a 789 px e 3 + 3 + 3 + 3 + 1 no celular.
  - A Entrada tem o título "Modo Leilão" (o sobretítulo da cena "mesa" já diz "Leilão"); o online aparece "Em breve" com
    os botões desligados. Uma rota da sala aberta sem sessão (depois de recarregar a página) oferece "Continuar o treino".
  - O "nada sobre nada" do `testar-leilao --tela` usa o critério do `testar-online3d` com a barra de lance (fixa) numa
    camada própria: o que rola por baixo dela não conta como encostar; no fim da rolagem, nada fica atrás dela.
- **A revisão do PR 1** (três lentes: regras e robôs, telas e celular, regressões no resto do TM):
  - **A conferência com estados pulados tem limites** (`confereSalto`; o `firebase()` do PR 2 se apoia nela): com o `seq`
    pulando 2 ou mais, a fase e a posição só andam; a `sem` só cresce, nos lotes, com lotes da janela (o lote de `a` e as
    posições depois dele até a de `b`; na repescagem, as da `sem`), na ordem da fila; o `seq` não passa das posições que
    podem ter aberto; cada lote novo é da janela e custou ≥ R$ 1 (o de `a` com líder, ≥ o lance, nunca para quem passou);
    quem não comprou não pagou; o lote da fila que ficou sem dono e fora da `sem` foi pulado, e ninguém pode comprá-lo no
    estado de `b` (o "pode" só diminui: vaga, máximo e "cabe" só caem com as compras). Antes, com o `seq` pulando 2, um
    lote de graça passava. **Depois do fim nada muda** (qualquer diferença é acusada) e todo vivo no fim tem o `f` refeito
    pelo completar a partir do `d` (antes, a troca dos completados com `seq`+1 passava). O `confereSozinho` ganhou as letras
    do `d`/`f`, a `sem` sem repetir, o lote aberto = o da posição `k` e o saldo ≥ as vagas que os lotes não ocuparam.
    L10: 5 935 pares honestos com saltos de qualquer tamanho (749 na repescagem, 123 no fim) e 34 adulterações com o `seq`
    pulando ou depois do fim, acusadas.
  - **Os testes de regra contra a conta feita no teste:** L1 com a fórmula das cotas (e o exemplo de 4 técnicos: 6, 18,
    18, 10), L3 com um caso positivo por formação (o 11º que só fecha cada uma) e os parciais (3º e 4º atacante, 5º
    zagueiro, 5º meia; 'posicao' quando nenhuma serve), L6 com o completar refeito (o melhor de fora que cabe, para quem
    tem menos, empate no menor índice). Cada um reprova a mutação que antes passava.
  - **A região ao vivo junta o que chega junto:** a sessão emite a venda e o lote novo na mesma conferência; trocado no
    mesmo quadro, o leitor de tela nunca ouvia o "Vendido para X por R$ Y". Agora vira uma fala ("Vendido para X por R$ Y.
    Jogador N de 52: …") e cada fala fica ≥ 1,2 s.
  - **Telas:** o retorno e o motivo da barra e o "−N fora da função" com tons escuros no claro (contraste ≥ 4,5:1); "Tudo
    ou nada" quebra em duas linhas e a Escalação tem 3 formações por linha até 1100 px; o foco não fica atrás da barra
    fixa (`scroll-padding-bottom` do documento com a altura dela, tirado ao sair da sala); as folhas deixam a tela inerte
    e prendem o Tab; o aviso da formação curto na barra ("Formação agora é 4-3-3 (não cabia na 4-4-2)", a frase inteira na
    região ao vivo) e o campo "Até R$ X"; 2 px entre o botão do bloco e o 1º item. O `--tela` passou a reprovar ENCOSTADO
    (< 2 px entre clicáveis) e texto fora do botão (o critério do `testar-sobreposicao` só via sobreposição) e mede o lote
    também com os blocos abertos (o padrão do PC).
  - **A tela guarda só os clubes do mundo-base, e só enquanto a pessoa está na sala** (o mundo inteiro ficava no heap até
    recarregar: 13,6 → 9,9 MB depois de sair do treino na pública, 12,4 → 9,3 na pro); a Criar gera o mundo e solta.

**Durante o PR 2** (o que o código real pediu de diferente do plano):
- **O banco falso** (`ferramentas/lib/banco-falso.mjs`, conferido no código do `@firebase/database` 1.0.7, o do firebase
  10.12.5): o servidor no Node e o SDK compat falso na página ou em Node, com o cache, as escritas pendentes, a transação
  pelo cache e o `.info`. O topo do arquivo diz o que ele imita e o que não imita. Três achados no SDK que mudam o código:
  - **A transação que aborta no `null` do cache nem pergunta ao servidor.** A 1ª rodada é na hora, com o cache local
    (`null` num caminho que ninguém ouve); se a função devolve `undefined` ali, o SDK encerra com `committed: false` e o
    `null` local. Por isso a `transacao` da `firebase()` OUVE o caminho e espera o 1º valor do servidor antes de rodar: o
    `feito: false` é sempre sobre um valor que veio do servidor. O "repete com o valor do servidor" do §3.3 só vale para a
    rodada que GRAVA (o servidor confere a base e responde "datastale").
  - **`set`/`update` cancelam as transações do mesmo lugar, de cima e de baixo** (`Error("set")`; a já mandada só se voltar
    "datastale"): ninguém grava com `set`/`update` dentro ou acima de `sala`/`vivo` enquanto transaciona neles.
  - **O ouvinte do SDK é chamado na hora** dentro do `on()` (cache pronto) e dentro do `set` de quem grava; a `ouvir` da
    rede entrega sempre depois, na ordem. E o `val()` devolve como LISTA o nó de chaves 0..n (a sessão já tinha `lista`).
- **A transação com a conexão caindo antes da resposta REJEITA** (`codigo: 'desconectado'`): o SDK cancela a transação já
  mandada (pode ter entrado). É o "Conferindo…" do §2.4: ler de novo depois da volta. A gravação comum (`set`/`update`)
  fica guardada e vai de novo na volta; o pedido de `onDisconnect` que estava no caminho o SDK esquece (rearmar a cada
  volta: `aoVoltar`).
- **A rede ganhou** (nas duas, para continuarem iguais): `testemunha(caminho, extra)` (grava `{...extra, ts: TS, n}` e
  devolve a hora que o servidor pôs; a marca `n` diz se a leitura depois do ack é a nossa — duas abas da mesma conta no
  mesmo `bate` dão `null`; o `.validate` opcional tem de aceitar o `n`), `aoVoltar`, `aoDesconectar(caminho)`
  (`gravar/atualizar/apagar/cancelar`; na memória roda no `_cair`), `reconectar()` e `fechar()`; os erros com `codigo`
  (`desconectado`, `permissao`, `disputa`, `sobrescrita`, `apagada`, `rede`; sem o banco do TM, `indisponivel`).
- **`horaServidor`** é o relógio MONÓTONO (`performance.now`) + a diferença da testemunha de menor ida e volta (janela de
  12); o relógio de parede que pula depois da calibração não mexe nela, e a amostra que não cruza a escolhida (o monótono
  parou com o aparelho dormindo) recomeça a janela. Antes da 1ª testemunha, `Date.now()` + `.info/serverTimeOffset`.
- **testar-leilao** ganhou o bloco **F** (a `firebase()` sobre o banco falso em Node, com o tempo de mentira) e a bateria
  comum do R e do F; o `testar-online3d.mjs` usa a biblioteca (24 ok).
