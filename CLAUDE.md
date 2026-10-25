# Instruções do projeto (lidas em toda sessão)

Repositório com vários projetos. Os estáticos (sem build) são publicados pelo GitHub
Pages a cada merge na `main` (ver `.github/workflows/deploy-pages.yml`). O CreateFlow
(Next.js, raiz) é hospedado à parte.

## Preferências do dono
- **FILA EM VIGOR (09/10): o GOLAÇO NOVO (`golaco/`), feito do zero** — "totalmente novo, nada que restou
  do outro" (dono). Etapas 1–7 na seção "GOLAÇO NOVO" abaixo; cada etapa termina com PR + merge + link + prints.
  Etapa 1 ENTREGUE (#449, #450). Etapa 2 ENTREGUE (#452). Correções (#453, #454). Etapa 3 ENTREGUE (#455: 11×11,
  tática, Editar time; ver "Etapa 3" abaixo).
  **Pedidos do dono de 10/10 depois da Etapa 3** ("o jogo tá muito bom, mas..."): controle de bola melhor; IA mais
  inteligente; jogo MAIS INTENSO e tático ("a ia não corre para trás, tem que ser algo mais profissional"); goleiro que
  pula e espalma; "quando a bola chega no jogador e eu já mudo o analógico, o jogador sai da bola — isso nunca pode
  acontecer, ele tem que sempre dominar"; efeito de rede e de gol; torcida no estádio com barulho; "não quero narração
  em cima"; "é obrigatório virar o celular pra jogar". Três PRs, todos ENTREGUES: (1) estádio + tela limpa + celular
  deitado (#456); (2) recepção que nunca sai da bola + controle por atributo + goleiro que pula e espalma (#457); (3) IA
  intensa: recomposição em disparada, contrapressão, bola solta disputada (#458). Pendente da IA: o
  grupo `etapa3` (forma, movimento, apoio, intensidade; 2/6), os chutes contra o time do humano (~10 por partida,
  main ~10,9) e a pressão mais agressiva (PPDA da Média 11,0 × 8,4 na main: aperta um pouco menos). Depois o dono
  delegou as decisões ("vc escolhe tudo", 10/10): câmera de TV do celular mais baixa e mais longe, com a torcida
  durante o jogo (#459, ENTREGUE), e em seguida a **Etapa 4** em PRs menores (seção "Etapa 4" abaixo): (1) painel de
  equilíbrio + impedimento + acréscimos (#460, ENTREGUE); (2) faltas com vantagem, cartões e expulsão, tiro livre
  direto e pênalti (#461, ENTREGUE); (3a) bolas paradas: lateral com as mãos e 3 opções, escanteio por zonas com defesa
  mista, barreira, tiro de meta com o pé e saída curta (`golaco/bolas-paradas`, ENTREGUE); (3b) goleiro: reposição com a
  mão e com o pé, recuo (Regra 12.2), 8 s, saída no 1×1 e saída no cruzamento (traz os gols de escanteio para perto dos
  2,6% reais); (4) equilíbrio com 144+ partidas (poucos chutes e precisos demais; a disputa pelo alto na bola rolando
  junto com o volume de chutes), prorrogação e pênaltis, pendências da IA acima.
  **Pedidos do dono de 11/10 (depois da 4.3)** — FILA ATUAL, nesta ordem (cada item = PR + merge + link + prints):
  (A) regras e controles: botão PRESSÃO "não funciona"; "não consigo mexer com o goleiro"; goleiro só pega com a mão
  DENTRO da área; "não pode recuo" (Regra 12.2); tiro de meta só com gente do time que cobra na área; "os jogadores não
  cabeceiam a bola, de jeito nenhum" (cabeceio na bola rolando); (B) "O JOGO TEM QUE SER MAIS INTENSO, ninguém do outro
  time corre, ninguém marca, mas tem que marcar com responsabilidade e consciência, a IA tem que ser mais inteligente";
  (C) "quero menos informação na tela / tem muita coisa na tela"; (D) mais torcida no estádio, bandeirões,
  sinalizadores e som de torcida durante o jogo; (E) cenas de pré-jogo: fora do estádio, o estádio aparecendo,
  jogadores entrando em campo, a fila, a câmera passando; no fim vários cortes de torcida e estádio; depois a escalação
  de cada time num campinho, grande na tela, com o mesmo fundo, ~10 s, sai e entra a do outro time do mesmo jeito.
  A parte 3b do goleiro (reposição, recuo, 8 s, 1×1, saída no cruzamento) entra em (A).
  Mais do dono (11/10): "se eu deixo o meu jogador parado, ninguém pega a bola, isso NÃO PODE ACONTECER" (entra em
  (A), urgente); "não quero a linha de impedimento durante o jogo; quando o jogo parar por impedimento, no replay mostra a
  linha" (entra em (C)); (F) gol e replay: "as redes têm que ser brancas, com movimentação quando a bola toca, em véu de
  noiva"; "o replay não funciona"; "não tem cena de comemoração!!!".
  **Pedidos do dono de 15/10 — FILA, nesta ordem (cada item = PR):** (1) goleiro se movimentando melhor, espalmadas e
  encaixes mais realistas e defendendo mais as bolas fáceis que as difíceis (junto com a saída no 1×1 e no cruzamento);
  (2) chute com a barra cheia mais alto, com chance de acertar o ângulo (hoje vai a meia altura); (3) lançamento mais
  reto e rápido (hoje vai muito alto); (4) movimentação melhor e jogo mais tenso.
  **Modo enxuto (dono, 15/10: "diminui os testes, para diminuir o tempo"):** localmente só os testes do que a mudança
  afeta, o CI do PR decide o resto, sem contraprova separada (quem fez relê o próprio diff antes do push).
  **Pedido do dono depois da Etapa 2:** "o movimento dos jogadores tá meio estranho, ajeite; quando a bola pega no
  goleiro, trava; quero que tenha como editar o time quando pausa; quero uma movimentação melhor e um jogo mais
  intenso". Plano: (1) PR de correções — trava no goleiro + movimento estranho — ENTREGUE (seção "Correções depois
  da Etapa 2" abaixo); (2) Etapa 3 — ENTREGUE —
  11×11 com formações, tática, IA com/sem bola mais intensa e "Editar time" na pausa (formação, escalação no
  campinho com reservas, táticas: mentalidade, pressão, largura, linha), no estilo do Gerenciar equipe do FIFA.
  Retorno do dono (09/10): "achei legal"; a movimentação/condução "está bem boa,
  continue assim" (não mexer sem motivo medido). Quer um jogo **11×11 de alto nível, tipo FIFA**: posições,
  regras, táticas, torcida **cantando alto**, **cenas de pré-jogo**, botões de **chute, passe, enfiada,
  lançamento e saída do goleiro**, e **tirar o botão CONDUÇÃO** do celular. Ordem: Etapa 2 (ações + botões +
  goleiro básico) → 3 (11×11, tática, IA) → 4 (regras, goleiro, bolas paradas, equilíbrio) → 5 (modelos humanos,
  mocap, rostos) → 6 (torcida cantando, pré-jogo, replay, comemoração) → 7.
  As filas antigas do `futebol3d/` (abaixo) ficam PARADAS; o `futebol3d/` continua publicado e intocado como RESERVA
  (desde 15/10 o Total Match joga as partidas 3D no `golaco/`; ver "Motor 3D do Total Match" abaixo), até o dono decidir
  aposentá-lo. Não copiar nem ler código do `futebol3d/`
  para o projeto novo.
- **Direção do produto (dono, 16/10): "o modo jogável 3D substituirá todos os modos simulação, e o jogo será um jogo
  jogável"** — todo modo do Total Match vai virar partida jogável no GOLAÇO (`golaco/`); peça nova já nasce pensando nisso
  (nada novo só para a simulação). O `golaco/` é PROTÓTIPO: tudo será incorporado e vira o Total Match — modo novo
  entra pelo TM (Mais modos), não no menu do golaco. **Online 1×1** (pedido de 16/10; seção "Online 1×1" abaixo): duas
  pessoas, cada uma no seu aparelho, salas privadas por código, sem chat; conexão SEM CONTA e grátis (WebRTC P2P, a
  sinalização pelo Firebase que o TM já tem, sem TURN); só no TM.
- **Dono, 22/10 (depois do #503):** "você assume o golaço agora, não é mais golaço, é Total Match ... ele já está
  implementado no Total Match, virou Total Match" — o `golaco/` É o Total Match 3D (eu cuido dele inteiro). Na versão de
  TESTE com os jogadores reais (edição pro, "Season Update", trancada por chave): "pode botar os patrocinadores sim, é só
  aquele teste, vamos tirar depois" — patrocínio e marca do fornecedor nas camisas reais são permitidos SÓ nela. "Os
  jogadores parecem meio curvados, estranhos" → corrigir a postura do corpo novo (só no desenho). FILA logo depois das
  faces: (1) cena de pós-jogo; (2) cena de intervalo; (3) cenas de cartão; (4) replays de faltas e de jogadas passando na
  tela enquanto o jogo está parado. Corpo novo funcionando = PR para ele testar (o #503 já foi; a postura no #504).
  Depois: "verifique as diversas tarefas antigas no jogo e assim que terminar, faça" — auditoria das filas antigas no
  código (o que está feito × pendente) e a fila resultante executada item a item (um PR cada) depois das cenas acima.
  **A FILA ESTÁ EM `golaco/FILA.md`** (auditoria de 22/10: 56 itens com status, evidência, plano, horas e se mexe no
  hash; listas "feito", "depende do dono" e "obsoleto"). Ordem: rostos → patrocínios → cenas (A: pós-jogo, intervalo,
  cartão, replays de falta/chance, melhores momentos; a base é a branch `origin/golaco/cenas-jogo`, 35 conflitos) →
  correções curtas (B) → goleiro e chute (C; o PR #493 rascunho `golaco/goleiro-realista` tem CI vermelho) → IA (D) →
  equilíbrio (E) → pedidos de 17/10 (F) → 3D no lugar da simulação (G) → online (H) → visual/mocap/estádios (I).
  Ao terminar cada item, marcar na FILA.md (status + PR).
  **Dono, 23/10: a fila por CATEGORIAS** (A–I da FILA.md): ele diz qual categoria fazer e nada começa sem o aval dele
  ("tem algumas coisas a mais que vou te sinalizar, que vc só cmc dps do meu aval"). Os pedidos de 23/10 são os itens 57–66:
  impedimento pelas partes do corpo (B), pausa igual à do FIFA, minimapa embaixo, nome do condutor nos cantos, a tela antes do jogo no nível do EA FC com a cara do TM (64), a mira das bolas paradas minimalista com uma curva boa (65), a câmera que acompanha a bola e mostra a área (66) (F),
  passada natural, costura da nuca e bordas dos decalques (I).
- **Pedidos do dono de 17/10:** ENTREGUES (1) o NOME em cima do jogador com a bola (`main.js marcarCondutor`,
  `#nome-condutor` fora do #hud — exceção pedida à "sem narração") e (2) os overalls da tela iguais aos do TM (`elenco.js
  notaExibida`: a ficha do TM leva `ovrTM`; o jogo continua com o nível comprimido e os atributos). **FILA (dono: "o 3 e 4
  fica pra dps"):** (3) o campinho da escalação do jogo EM PÉ (retrato), não deitado (`escalacao-tela.js`); (4) a cena de
  substituição no online (hoje desligada no online porque seguraria a simulação de um lado só). Também a escalação
  editada no TM antes do jogo agora vale no 3D (v374: formação do lado certo jogando fora, posições arrastadas pelo
  `TM.comp.fieldSlot`, sem o montador automático por cima da do usuário).
  **Mais para a fila (dono, 17/10: "coloca na lista para depois com limite"):** (5) o goleiro ESPALMA bola alta (hoje
  só rasteira e meia altura; `goleiro.js`/`anim.js` mergulho, `maoAlcanca`, `teste-mergulho`); (6) na cena de comemoração,
  a FOTO do autor com o número e o nome (`comemoracao.js` + a tela; a foto vem do pedido do TM); (7) o placar com mais a
  cara do Total Match, um pouco MAIOR e o relógio com os SEGUNDOS além dos minutos (`hud.js`, `teste-hud-minimo` H10 —
  continua cabendo no orçamento de HUD do celular).
  **Ainda para a fila (dono, 17/10: "isso tudo pra depois"):** (8) "A IA NÃO CORRE, NEM PRA DEFENDER, NEM PRA ATACAR, tem
  que ser mais difícil" — 1ª parte (21/10): medido com `tools/medir-corrida.mjs` (fases, contra o
  humano roteirizado de `tools/lib/humano-roteiro.mjs`: agressivo/conduz/calmo/passivo). A IA adversária DEFENDE forte
  (1º defensor a ~1,5–2 m do humano, ~1,6–2,7 botes/min, o humano fica ~1–2 s com a bola) e recompõe a ~6 m/s; o que não
  corria era o ATAQUE: a subida com a jogada estava desligada (`IA_ATAQUE.sobeCorrendo` 1000) — religada com histerese e
  só com o ataque progredindo, só no time da IA CONTRA uma pessoa jogando de verdade (`m.humanos` do outro lado sem
  `m.iaJoga`) e só quem está a > `sobeLonge` 12 m do condutor (`IA.modos.sobe`, corrida firme sem sprint): a IA atacando
  contra o humano 159 → ~177 m/min, corridas à frente da bola 0,44 → 0,59 por instante. A partida IA × IA (a demo, o
  painel, o Simular o resto) fica BIT A BIT igual (`hash-partida --ref`: demo IGUAL) — valendo também nela, cada rodada
  do CI reprovava outros testes de eventos raros (substituição, comemoração, treinadores, cabeceio, não passa da bola);
  subindo os companheiros do humano, a arrancada trotando dele chegava à área em 11% (teste-defesa-corrida); subindo os de
  perto do condutor, o chamado da PRESSÃO chegava menos (teste-pressao-humano M2 66 → 59%). Lição: mudança de IA que
  vale na IA × IA mexe em todas as partidas dos testes; quando o pedido é sobre o jogo contra a pessoa, ligar só nele. Testado e NÃO entrou (medido): condução mais rápida (correrLivre/correrAte/magConduz)
  e mais corridas nas costas (recarga/max/vCondutor) — pouco ganho e vai-e-volta 8,3 → 9,8–10,4/min. PENDENTE: os
  COMPANHEIROS do humano quase não apertam (1º a ~7,5–8 m do condutor, 0,1–0,2 bote/min com o humano parado) — o
  controlado é o 1º homem quando está perto, `semAtropelar` vale para o time todo do humano e a IA com a bola toca em
  < 0,5 s; excluir o controlado do 1º/2º homem não mudou (medido). **Categoria D, D2 (24/10; a IA ATACA correndo, itens 67
  e 21; `PESQUISA-CATEGORIA-D.md`, contrato "A IA contra a pessoa"):** o portão virou função (`tatica.js contraPessoa`/
  `timeDaPessoa`, pela `pessoaJoga`: sem marca da IA na entrada do lado da pessoa — `m.iaNaEntrada` do `sim.js`, `ia` OU
  `iaCobra` — e o travado do TM não expulso) e as constantes só contra a pessoa moram em `config.js IA_PESSOA` (juntadas por
  cima na carga: `UTIL_P`, `CORR_P`, `SUAVE_APOIO_P`). Em volume a IA já corria mais que o real (188 × 140 m/min, Metrica):
  REDISTRIBUIR, nunca somar. O condutor avalia a condução onde chega, conduz trotando (CORRER só com 14 m livres) e lê o
  adversário 0,12 s à frente no risco (`manterAntecipa`: só no agora ele conduzia para dentro do bote, roubadas no pé +25%;
  com 0,1 s os pênaltis da IA no 'dribla' do teste-faltas-sentido iam a 0,64 por partida, meta ≤ 0,6; com 0,15 e 0,2 s o
  teste-nao-passa do CI reprovava por casos do time da pessoa — mudança contra a pessoa embaralha todas as partidas com o
  roteiro: decidir com amostra grande e conferir depois as sementes fixas do CI),
  o apoio curto vai em corrida firme (`IA.modos.apoia`), longe da bola o apoio anda e a subida é só a ≤ 20 m dela, as
  corridas nas costas são dos centroavantes e terminam DENTRO da área. Régua `tools/lib/corrida-medidas.mjs` +
  `teste-ia-corre` (padrão; P — o portão —, A e V valendo, M e C informativas até o D3/D4; ± por bootstrap estratificado
  por roteiro): condutor 7,6 → 11,8 km/h, posse 0,50 → 0,83 s, o apoio perto com o condutor conduzindo andando 43 → 26%
  (real 33), corridas à área 3,7 → 24%, chutes da área 60 → 78% (o "≥ 55%" do plano a main já cumpria: meta ≥ 70),
  roubadas no pé 2,42 → 2,33/min (teto base + 15%), volume 182 → 171 m/min, vai e volta 5,95 → 4,74. Contra a pessoa o
  condutor já conduzindo vira no máximo 0,6 rad por decisão e não usa a condução curta (o MOD girava o corpo em volta da bola
  a ~3 m/s: teste-nao-passa 0,60 → 0,33); o chamado da PRESSÃO desvia com 0,45 m de folga (M8 4,8 → 2,8: trombava nos
  próprios companheiros que continham o condutor) e o M2 conta os casos ao alcance em 1,5 s (≤ 8,5 m; com a IA ficando com
  a bola, os longos viraram de 9–12 m — a amostra passou a medir a distância, não a PRESSÃO). Lições: a resposta do peso da
  condução é em DEGRAU (0,95 → posse 0,60 s; 1,0 → 1,1 s) e o ritmo vem do `magConduz`; com meias e pontas correndo até a
  área o meio voltava mais devagar na perda (teste-transicao `--humano` 6,1 → 5,4 m/s; o `urgente` não resolve, é física:
  quem está em disparada para lá freia antes); uma chave nova num objeto juntado por cima (`dist`) sobrescreveu a do ponto
  calmo e deu NaN — nome de chave novo nunca repete o de quem ele cobre, e o mesmo vale para campo novo no MUNDO (`m.iaMarca`
  já era o cache da marcação do `ia.js`: escrever nele mudou a partida contra a pessoa — procurar o nome antes); o portão
  que só lia o `m.iaJoga` (só a marca `ia`) ligava nas cobranças da demo do Node (`iaCobra`), na página `?demo=1` e com o
  travado do TM expulso — com o `iaNaEntrada` a página é IA × IA (também para a subida do #500); medida "perto da bola" sem
  tirar o dono mede o condutor (a do apoio passava com o apoio curto desligado: o A6b, com o condutor conduzindo, separa);
  premissa de semente de teste de navegador vira condição do próprio lance (V11 do `teste-replay-paradas-tela`: o lance onde
  a bola estava; F7 do `teste-cenas-tela`: o botão pela lista do guardador). **Categoria D, D3 (25/10; a IA MARCA correndo,
  itens 67-defesa, 19 e 20; `PESQUISA-CATEGORIA-D.md` §6, contrato "D3"):** só contra a pessoa (`IA_PESSOA` D3; `SUAVE_MARCA_P`,
  `RECOMP_P`, `CORRIDA_P` no `ia-tatica.js`; `UTIL_P.passeAntecipa` no `ia-ataque.js`), REDISTRIBUINDO — o volume dos 5 s depois
  da perda já estava no teto (229,7 m/min; Jerome 2024, p90 ~230): quem marca a até 33 m da bola sem o teto do trote (d / 7,
  sprint além de 9 m, sem o arranque calmo, a espera da volta [12 m, 1,3 s]); o da zona do meio/frente a ≤ 12 m do condutor
  ENCURTA (0,3 do caminho até 4 m dele) só na janela de um gatilho de pressão e com ele abaixo de 4 m/s (sempre ligado, subia
  no condutor que arrancava: faltas da IA 1,96 → 2,67); a Média engaja a 68 m (78 dava agressão 86%; 70, PPDA 7,6); a
  recomposição vira em ARCO (pedido > 100° a > 3 m/s: o rumo a 0,95 rad com o CORRER — acima de 112° o passoCorpo para antes
  de virar) e, a mais de 16 m da bola, volta a 0,75 sem sprint (paga o volume) — menos o MEIO que ficou à frente da bola (com o
  "longe" valendo para ele, o recuo do meio do `teste-transicao --humano` caía de 6,1 a 4,0 m/s); o bloco do corredor sprinta
  com 4 m de atraso; o PASSE e a ENFIADA da IA contra a pessoa leem cada adversário também onde ele estará em 0,5 s (o passe
  sai depois da carga do botão: a roubada desfeita do `teste-defesa-corrida` era o passe decidido no tick da roubada e solto
  ~0,5 s depois na corrida de volta da pessoa — 6,6% desses passes na main, 14% com a marcação nova, ~10% com a leitura;
  Spearman 2018). `teste-ia-corre` seção M (a lógica INSTRUMENTADA: `copiaInstrumentada` grava a distância ao ponto do
  `para()`; CI com 8 sementes; as metas do D3 com * reprovam só além de 2 ±): aproximação do 1º homem a 4–12 m 2,4 → 6,5 km/h
  (real 7,4–7,5), "longe e devagar" 31 → 16%, perda 229,7 → 232,4 m/min (dentro do ±), total 171 → 167, vai e volta 4,74 →
  4,29; `teste-pressao --humano` (padrão; a pessoa "espelho" = a decisão da IA sem a marca `ia`, 48 partidas): PPDA 11,9 →
  9,7, agressão 72 → 75% (≤ 78), retomada 36 → 41%. NÃO entrou (medido): o sprint mais cedo da recomposição e a frente
  sprintando (o "longe e devagar" dela é a ACELERAÇÃO do começo: 95% nos primeiros 0,75 s), a cobertura do 2º homem a 6 m
  pelo modo pressa, o condutor rápido a 6,3 m/s contra a pessoa (vai e volta e roubadas sofridas reprovavam), quem o condutor
  rápido já passou recompondo em disparada (derrubava o defensor do corredor de 3,8 a 2,6 m/s). PENDENTE: o defensor do
  corredor (3,90 → 3,82 m/s, meta 5 — o recuo começa ~0,8 s antes, a física dá ~4,8), a recomposição "longe e devagar" ≤ 15%
  (22%) e o 2º/3º homem (7,5/12,8 m; o 2º marcador real fica a 9,6 m). Lições: as medidas da marcação mudam entre calibrações
  vizinhas mais que o ± (PPDA 8,4 × 10,8 com o encurtar 0,30 × 0,35; o gol por chute nas arrancadas de 0 a 26%; a roubada
  desfeita 4–9%; o defensor do corredor 2,0–4,7 m/s) — 24–48 partidas, metas que reprovam quando PROVAM (2 ± ou binomial); um
  guarda que sobe em toda calibração tem MECANISMO: rastrear o lance tick a tick antes de calibrar (a desfeita era o passe na
  corrida de volta); contra os roteiros o PPDA da IA não se mede (eles quase não passam): o espelho; com a base no teto de
  uma guarda de volume, todo ganho perto da bola tem de ser pago longe dela; (9)
  editar o TEMPO de jogo e a DIFICULDADE (na pausa/antes do jogo e vindo do TM pelo pedido); (10) botão de CARRINHO
  (dividida deslizando; falta/cartão pela Regra 12 em `faltas.js`; cabe no orçamento de HUD do celular); (11) clássico mais
  PEGADO: mais faltas pela AGRESSIVIDADE dos jogadores (bote mais forte, mais contato), não pelo árbitro (o pedido do TM
  já traz `partida.classico`).
- Tudo em **português do Brasil**: textos da interface, comentários e mensagens de commit.
- Sempre mandar o **link do jogo/app** (GitHub Pages) fora do artifact. **Prints: NÃO mandar mais ao dono** (12/10: "esquece os
  print"); os testes de navegador continuam conferindo a tela, só não se enviam as imagens. Ritmo: uma máquina com várias frentes
  em paralelo, sem abrir sessões extras na nuvem (dono, 12/10: "pode ficar fazendo do jeito que tá").
- Testar antes de avançar; corrigir todo bug encontrado.
- Fluxo de entrega: branch → PR → merge na `main` (o link só atualiza depois do merge).
- Times, jogadores, marcas e anúncios dos jogos são **fictícios** (nada licenciado).
- **Falar sempre em português**, inclusive nas mensagens de andamento.
- **Sempre pesquisar melhorias** (sites, artigos, GDC, docs do three.js) antes de mexer em
  jogabilidade/animação/gráficos, citar o que foi aproveitado e **medir antes e depois**
  (clipes em `futebol3d/tools/clip.mjs`, números com as ferramentas `*-dbg.mjs`).
- Pontos que o dono já apontou e precisam de atenção contínua: condução de bola natural
  (nada robótico), animação/comemoração do gol, movimentação dos jogadores.
- Fila de tarefas: **só começar uma tarefa nova depois de terminar a atual** (anotar aqui as novas).
  Fila atual (GOLAÇO): condução natural → animação do gol → escalação no campinho com fotos
  → sombras/gráficos de dia + rostos/texturas + torcida fervorosa → **fotógrafos atrás do gol
  (hoje péssimos)** → **torcida vibrando de verdade** (pular, braços, ondas no gol/chance)
  → **cantos de torcida ao fundo** o jogo todo → **animação por captura de movimento (mocap)**
  (modelos com esqueleto + animações reais CMU/Mixamo; aprovado pelo dono, fim da fila).
- **Entrega em lote** (pedido do dono): fazer a fila inteira e só entregar (PR + merge + link)
  quando tudo estiver pronto; nas mensagens de andamento, só estimativa.
- **Urgente:** melhora extrema dos gráficos no celular (qualidade baixa/média).
- **PRIMEIRA COISA na próxima sessão:** gerar os rostos com o dono pelo ChatGPT (pedido em
  `tools/rostos/pedido-chatgpt.txt`, lotes 02–35, pasta do Drive "GOLAÇO – rostos") e colocar no jogo.
- **Jogador tem que ser um modelo humano 3D realista inteiro** (corpo e cabeça com formato de
  verdade, esqueleto, mocap). Nada de foto "colada" em cabeça/corpo de peças geométricas — o dono
  achou péssimo. O rosto é a pele da cabeça do modelo (UV), não um adesivo.
- Rostos: escolhido **retrato por IA de pessoa fictícia** projetado na cabeça 3D (opção B);
  **textura com foto, nada desenhado por código** (o dono não quer rosto procedural).
- **Sempre dar estimativa de tempo** ao começar uma tarefa e **atualizá-la** a cada
  mensagem de andamento (ex.: "faltam ~40 min").
- **Fila nova (08/10, depois da Fase 3 da auditoria):** análise da movimentação (FEITA e enviada: plano em 6 etapas —
  corpo com peso, toque planejado no giro, pé plantado no mundo + inercialização, clipes de partida/parada/pivô, IA sem
  vai-e-volta, intensidade); botão GOLEIRO, bolas paradas, bola na mão, disputa pelo alto, divididas, troca de jogador,
  goleiro na bissetriz, intensidade dos dois times e condução organizada (ENTREGUES em 09/10 num PR só; o dono escolheu a
  versão REALISTA, sem vídeos, e o merge com o equilíbrio passando na média mas não em toda rodada) → **agora:** volume
  de ataque na área (abaixo) → vai-e-volta da condução da IA → giro com bola natural e condução mais no pé (etapas 1–2
  da análise) → Fase 4 (começando por rosto × corpo: mesmo tom, sem emenda) → Fase 5.
  Estado entregue (144 partidas, `tools/painel-equilibrio.mjs`): ~24 chutes, ~2,4 gols, 10% de conversão, passe 77%,
  escanteios 2,2, goleiro 67–69% (80–84% nos chutes de longe no alvo), 29% dos gols de fora da área; intensidade OK
  (largura ~39 m, meio–ataque ~13,5 m, marcador a ≤ 3 m ~45%). A versão publicada antes tinha ~1 gol por partida de
  saída de bola roubada no tiro de meta com o adversário dentro da área (defeito da Regra 16, corrigido;
  `tools/origem-chutes.mjs` separa esses lances); sem esses lances as duas versões empatam em gols. O teste de 24
  partidas reprova ~1/3 das rodadas (média ~2,45, piso 2,3) e o goleiro de 6 a 16,5 m oscila 45–73% entre rodadas de 36
  partidas (meta ≥ 55%). Próximo PR — volume de ataque: com o goleiro na meta (≥ 66%), 2,6 gols pedem ~7,6+ chutes no
  alvo — falta volume de chance de verdade (e ~55% dos chutes ainda saem de 25 m ou mais). Pistas
  (rastro das decisões): no último terço quase todo passe fica negativo (bloco fechado = linha de passe "arriscada" no
  `laneRisk`) e o condutor dribla até perder no bote (~6 por partida) ou chutar; o cruzamento vira corte de cabeça; o
  passe para trás da linha de fundo quase nunca acha alvo. Ajuste só de peso não mudou o volume (testados: apoio por
  linha de passe, transição, corridas, passe "para quem finaliza", finalizar sob pressão). Medir com 144+ partidas
  (amostra de 48 varia ±0,25 gol).

## GOLAÇO NOVO (`golaco/`) — futebol 3D do zero (publicado em `/golaco/`)
Pedido completo do dono (09/10) guardado no histórico da sessão; resumo das regras que valem SEMPRE:
- Jogável antes de bonito: **controle de bola, passe e tática primeiro**; gráfico/animação/estádio depois e nunca
  podem piorar o que já funciona. **Sem recuo**: nenhuma entrega piora medida que já estava boa (mesma ferramenta,
  mesma amostra, comparar com a versão publicada).
- Toda mudança de jogabilidade tem teste que **reprova antes e passa depois**, com tabela antes → depois no PR.
  O GitHub Actions roda os testes (`golaco/tools/rodar-testes.mjs` + `teste-carga.mjs`) em todo PR
  (`.github/workflows/golaco-testes.yml`) e antes do deploy (`deploy-pages.yml`, job `testes-golaco`): reprovou,
  não publica. **CI em partes** (15/10): o deploy chama o mesmo `golaco-testes.yml`, que roda os testes em Node em 4
  máquinas ao mesmo tempo (`rodar-testes.mjs --parte i --de 4`) e os de navegador em 3 (`rodar-navegador.mjs`; teste
  de navegador novo entra na lista DESSE arquivo, não no YAML), divididos pelo tempo de `tools/lib/tempos-ci.mjs`;
  o check do PR continua `testes` (só passa com todas as partes).
- **Pesquisar antes de mexer** (artigos, GDC, docs do three.js, dados reais) e dizer no PR o que aproveitou de cada
  fonte. Base da Etapa 1: `golaco/PESQUISA.md` (física da bola, biomecânica, passo fixo, jogos, three.js).
- Prints sempre com torcida e HUD ligados (torcida só existe a partir da Etapa 6): PC 1280×720 Alta e celular
  844×390 Média, dia e noite. Vídeo só quando o dono pedir (quadro a quadro, relógio controlado, 30 qps).
- Honestidade nos resultados (número, quanto faltou, proposta). Decisão de produto é do dono; o resto, decidir e seguir.
- **Etapa 5 (corpo realista, mocap, rostos) NÃO pode atrapalhar a jogabilidade** (dono, 12/10: "que as partes físicas
  não atrapalhem a jogabilidade do jogo"): o modelo humano e o mocap são DESENHO por cima da simulação (hash igual;
  `hash-igual`/`hash-partida` IGUAIS em todo PR da Etapa 5), e resposta (≤ 0,1 s), condução, recepção, giro e
  patinação medidos antes → depois com as mesmas ferramentas. O dono vai mandar um modelo de condução que quer no jogo
  (referência em vídeo/descrição): analisar, medir e propor antes de mexer na condução que ele já aprovou.
- Etapas: 1 base + controle de bola (seção 4 do pedido) → 2 passes (passe, enfiada ≥ 4 m à frente, lançamento,
  cruzamento, chute, domínio) → 3 11×11 e tática (formações, IA com/sem bola, troca, jogo aéreo ≥ 90% troca para
  quem disputa) → 4 goleiro, regras (IFAB), bolas paradas e equilíbrio (painel em Node, 144+ partidas) → 5 modelo
  humano realista + mocap + rostos por IA (UV) → 6 estádio, torcida, câmera, replay, comemoração → 7 celular, menus,
  modos e desempenho.
- Técnica: three.js **0.170.0** por importmap (jsdelivr), ES modules, sem build. Lógica (`js/*.js` exceto `entrada.js`,
  `main.js`, `hud.js`, as telas `editor-time.js`/`escalacao-tela.js`/`prejogo-tela.js`/`cenas-tela.js` e `js/render/`) **sem three.js nem DOM**. Passo fixo 1/60 s + desenho interpolado (`laco.js`).
  Aleatoriedade só por `rng.js` (sfc32 com semente no mundo); mesma semente = mesmo hash (`hashMundo`). Pose =
  função pura do estado (`anim.js`). Contratos em `golaco/CONTRATOS.md`, constantes em `golaco/js/config.js`.
  Coordenadas: x = comprimento (±52,5), z = largura (±34), y para cima, rumo h → (cos h, 0, sin h).
  Código que não desenha o 1º quadro entra sob demanda (import() + pré-carga ociosa; hoje o replay e o Editar time:
  `main.js` carregarSobDemanda, `config.js` SOB_DEMANDA); o teste-carga cobra a folga (≥ 120 KB até os 4 MB) e a lista.
- Condução (Etapa 1, `js/conducao.js`): sem ímã — o toque calcula a velocidade da bola pela MESMA conta da rolagem
  (`bola.js` velParaDistancia, exata) para chegar ao ponto do pé no próximo toque, prevendo o próprio corpo com a
  mesma função de locomoção (`jogador.js` passoCorpo). Toque sincronizado com a passada (pé de apoio no chão), um
  por passada correndo, a cada passo na condução curta/proteção/freada forte; checagem de ultrapassagem (o corpo
  nunca passa por cima da bola) e de folga máxima (≤ 0,8 m); corte = a bola sai na linha do analógico (±20°) com o
  corpo segurando o rumo até o toque; domínio pela linha do analógico com erro por atributo/velocidade/pressão;
  proteção = o corpo gira em volta da bola, de costas para o marcador.
  **Condução curta** (dono, 12/10: "em tese é uma condução mais curtinha, com a bola mais no pé"; `golaco/conducao-curta`):
  só o RITMO muda — passos entre toques pela velocidade (`CONDUCAO.passosPorToque`: 1 até 3,5 m/s, 1,5 a 5,6, 2 na
  disparada; 1 e 2 alternados sem rng; guardas: domínio, inversão, freada, analógico > `angRitmo`, passe/chute
  carregando); gesto do analógico no tick do toque espera 1 tick ou sai toque de FREIO (`saltoTick`); o toque não
  manda a bola na placa; a chuteira para na superfície da bola (só o desenho: `pe.ox/oz`, hash igual). Trote 1,49 →
  2,88 toques/s e 1,98 → 0,99 m; corrida 3,0 → 2,2 m por toque; bola–corpo trote 0,48 → 0,42 m (IA 0,67 → 0,588 em 6 partidas, 0,595 em 12: meta ≤ 0,59 com 12 pendente);
  chuteira dentro da bola 61 → 46%; metas PENDENTE do `teste-conducao --estrito` que passaram a valer: bola–pé no trote
  p5–p95 0,02–0,67 → 0,40–0,58 m e tornozelo p95 0,33 → 0,30 m (só a chuteira segue pendente).
  Teste `teste-conducao-curta` (CI; `--js`, `--ia 12`), casos novos no `teste-cortes` e `teste-perda --cauda 120`
  (antes do merge). Ajuste fino do dono: o 3,5 da tabela (trote "picotado"). Defesa recalibrada pela mesma régua
  (commit 8 da especificação; a bateria reprovava teste-parado, teste-partida, teste-movimento e teste-pressao-humano):
  distâncias da bola "colada/solta" × 0,87 e a bola ENCOSTADA no marcador com os dois andando juntos é disputada
  (`ACOES.boteIA.encostada/encostadaVrel`) — antes o condutor que empurrava a bola no marcador nunca a perdia.
  Contraprova (13/10): o main.js lê o analógico uma vez por quadro — a 30 qps o 2º passo do quadro vai marcado `repete`
  (a mesma leitura) e o toque que espera o gesto espera a próxima leitura NOVA (`j.leituraTick`); sem isso, no celular a
  30 qps o toque saía com a leitura do meio do gesto (giro de 180°: 2,5 m comum, 4,2 m no tick do toque; `teste-cortes`,
  entrada a 30 qps, ≤ 0,35 m). A 60 qps nada muda (hash-igual e hash-partida IGUAIS).
- Etapa 2 (`js/acoes.js`, `goleiro.js`, `ia.js`, `sessao.js` modo 'ataque'): botões carregam força e soltam pedido
  (`j.carga`/`j.pedido`, mira guardada em `j.mira`); toque de ação no pé livre; troca de controle SEMPRE por
  `assumirControle` (carga/pedido vão junto; TROCAR pela borda do time e nunca com a bola no pé). Números da
  pesquisa em `golaco/PESQUISA-ETAPA2.md` (StatsBomb: tempos de passe, logística de defesa do goleiro, cruzamento;
  biomecânica de chute, mergulho e cabeceio). Testes: `teste-passes`, `teste-chutes`, `teste-goleiro` (canhão de
  bolas ±10 pontos da logística), `teste-aereo`, `teste-treino` (treino com a IA não trava), `teste-recomeco`;
  `teste-patinacao` mede também o treino de ataque (10 jogadores). Pendências para o dono: corte de 90° a ~7 m/s em
  2–3 apoios (PESQUISA pede 3–5); tornozelo do pé que toca até a bola p95 0,33 m (meta ≤ 0,30, só `--estrito`; 0,30 com a condução curta);
  falta com curva chega a ~24 m/s aos 27 m (vídeo: 17–21).
- Correções depois da Etapa 2 (`ia.js`, `sim.js`, `jogador.js`, `goleiro.js`; constantes em `config.js` IA e PASSADA):
  goleiro do humano com a bola na mão repõe sozinho em 3 s (`GOLEIRO.esperaHumano`), TROCAR funciona com a bola na
  mão; recuo do próprio time não é chute (goleiro recebe sempre que alcança); IA sem a bola com ponto suavizado
  (9 m/s), histerese de parar/correr, marcação sem repetir + cobertura, pressão com histerese e mirando 0,7 s à
  frente do condutor (velocidade filtrada), freia na linha antes de inverter, olha a bola devagar (velocidade de
  lado ≤ 1,5 m/s); com a bola no goleiro o time abre (vagas a 25 m do gol, ninguém a < 12 m da linha); passo
  lateral sem cruzar as pernas (`pontoPouso` semCruzar, limitado para a perna não esticar). Testes:
  `teste-goleiro-trava` e `teste-movimento` (8 sementes; aceitam `--js <pasta>` para medir a publicada). Lição:
  amostra de 4 sementes engana na pressão (±6 pontos) — decidir com 8–12; e toda mudança no pouso do pé tem que
  passar no arrasto (pé plantado) em ~12 sementes do treino de ataque, não só nas 3 do `teste-patinacao`.
  Correções 2 (contraprova adversarial): ninguém pressiona o goleiro com a bola na mão (Regra 12.3; a
  reposição batia no adversário em ~49%); reposição automática sai para a frente, sem o analógico (laço
  com o analógico para o próprio gol); no recuo o controle só vai para o goleiro quando ele pega; encaixe e
  "pegou" dão o controle ao goleiro do humano (aviso "Bola na mão: PASSE ou LANÇAMENTO"); o CORRER da IA
  estava morto (`{...para(), botoes: extra}` sobrescrevia) — com ele a pressão voltou (marcador a ≤ 3 m
  ~55%); marcação calculada 1×/tick por time com vantagem de 3 m para o par atual; cobertura de lado; giro
  parado 14 para o humano e 8 só para a IA (`IA.giroParado`). Roubadas do treino (24 → ~13 por 3 min)
  caíram com o fim do amontoado e NÃO voltam com pressão de perto (medido: depende de 2–3 na bola);
  recuperar intensidade = tática da Etapa 3 (compactação perto da bola, pressão alta configurável).
- **Etapa 3 (11×11, tática, Editar time)** — plano e pesquisa em `golaco/PESQUISA-ETAPA3.md` e `CONTRATOS.md`. A página
  abre na partida Golaço FC × Ventania FC (2 tempos de 4 min, relógio 0'–90', intervalo com troca de lado); treinos em
  `?modo=ataque` / `?modo=conducao` e no menu. Módulos puros: `elenco.js` (46 jogadores fictícios, ids 1–23 e
  101–123), `formacoes.js` (6 formações, encaixe húngaro), `escalacao.js` (dois toques, validar/aplicar edição,
  substituição na próxima parada, 5 em 3 paradas), `partida.js` (relógio, saída, lateral com o pé, escanteio, tiro de
  meta pela mão — simplificados, regra completa na Etapa 4; parede de bola parada pela locomoção), `tatica.js`
  (`posicaoTatica`: a MESMA função na prévia da tela e na IA), `ia-tatica.js` (sem bola: bloco, linha alinhada,
  zona, 1º/2º homem, gatilhos, contrapressão), `ia-ataque.js` (apoios, corredores, corridas, impedimento como forma,
  condutor por utilidade com xT), `defesa.js` (CONTER/DIVIDIDA/PRESSÃO do humano), `troca.js` (troca no jogo aéreo
  ≥ 90%). DOM: `editor-time.js` + `css/editor.css`. Tudo novo só liga com `m.times`: o treino fica BIT A BIT igual
  (`tools/hash-igual.mjs` em todo merge; `tools/hash-partida.mjs` para otimizações da partida). Testes novos no
  padrão: teste-partida, teste-editor, teste-taticas, teste-defesa-humano, teste-aereo-troca (canhão e natural),
  teste-custo; navegador: teste-editor-tela (CI), teste-desempenho-celular (informativo). Grupo `etapa3`
  (`rodar-testes --etapa3`, fora do CI até passar 5×): teste-forma, teste-pressao, teste-movimento --modo partida,
  teste-apoio, teste-intensidade — reprovam por pouco (ver o PR da Etapa 3: chutes 9/partida, passe certo 90,7%,
  atrás da bola 7,1, linha de 4 no t1, retomada 47%, à frente 21,5%). Lições: medir defesa e ataque JUNTOS (cada
  parte calibrada sozinha reprovou na integração); parede/teleporte nunca move o corpo sem a passada (pé arrasta);
  `teste-custo` mede CPU do fio, não a parede (a fila do escalonador dava picos falsos de 265 ms).
- **Recepção e goleiro** (pedidos de 10/10; `PESQUISA-RECEPCAO-GOLEIRO.md`): o controlado com a bola vindo (passe para
  ele ou bola livre que ele alcança antes dos companheiros) tem o CORPO levado ao encontro da bola (assistência de
  recepção) e o analógico só decide o 1º toque (±20°, limitado correndo por `anguloEmbalado(v)`) — nunca se afasta da
  bola; chute passando perto não puxa o controlado. Erro do domínio por faixa de atributo (`CONDUCAO.dominioCraque/
  Fraco`; entre 55 e 70 igual ao de antes). Goleiro: mergulho/salto/defesa em pé desenhados em `anim.js` a partir de
  `j.mergulho` (centro ≤ 4,6 m/s de lado, perfil Hermite, nunca dentro do gol), a defesa sorteada só vale se a mão
  desenhada chega (`maoAlcanca`), espalmada para fora conferida pela física e sem voltar para a mão (`GOLEIRO.reagarra`),
  chute desviado relido (`m.desvio`). Constantes: `RECEPCAO`, `GOLEIRO.mergulho/espalmada/bolaMao/...`. Testes:
  `teste-recepcao` e `teste-mergulho` (padrão); `medir-controle.mjs` (informativo). O treino mudou de propósito:
  `hash-igual` contra a base nova usa `--ref <commit do merge>`.
- **IA intensa** (pedido de 10/10: "MAIS INTENSO, a ia não corre para trás"; `PESQUISA-ETAPA3.md` §16): na perda, quem
  ficou à frente da bola volta CORRENDO para trás dela pelo lado do gol (`TATICA.recomp`; sprint só com urgência), os
  mais perto fazem contrapressão (`IA_DEFESA.contrapressao.s` 0/4/7 s), o meio fica atrás da bola no próprio campo
  (`TATICA.meioAtras`), toda bola solta é disputada em disparada (`IA_DEFESA.livre.disputa` null), contra-ataque na
  retomada com a defesa deles desarrumada (`IA_ATAQUE.contra`), finalização de primeira (`IA_ATAQUE.primeira`). Vale
  para os companheiros do humano. Teste: `teste-transicao` (padrão; `--humano` contra o roteiro). Lição: a triagem
  com `--set` de constantes (32 partidas por variação, demo no time 0 como o `teste-intensidade`) achou que a queda
  de chutes era a soma de efeitos pequenos — medir 96 partidas antes de decidir. Tropeço (`jogador.js` passoPassada): o pé
  de apoio além de `PASSADA.alcanceMax` sai mesmo com o outro no ar (trombada que inverte o corpo; antes o quadril
  afundava e o pé arrastava) — muda o treino só em passos raros (hash-igual DIFERENTE a partir do passo ~4200).
- **Estádio, tela limpa e celular deitado** (pedidos de 10/10; primeira versão puxada da Etapa 6; `PESQUISA-ESTADIO.md`):
  rede que balança no shader (`render/rede-onda.js`, conta pura testada em Node e GPU = JS), câmera do gol no gol da
  partida (só cortes), "GOL!" SEM autor nem minuto escritos, torcida instanciada (`render/torcida.js`/`torcida-dados.js`,
  ânimo em `render/emocao.js`, 8/13/18 mil por qualidade) e som com gravações livres (`render/som.js`,
  `assets/sons/CREDITOS.md`; liga no 1º gesto; "Som da torcida" na pausa). **Sem narração na tela:** lance nenhum vira
  texto (hud.js `TEXTO_EVENTO` só tem avisos de comando); na partida o topo é placar + minimapa + menu (painel
  "Conduzindo" só nos treinos). **Câmera do celular deitado** (`CAMERA.celular`, só com `pequena`; o PC não muda): TV
  mais baixa e mais longe (12,3 m a 46 m = 15°, o limite de cima da câmera principal da UEFA, 12–15°) — a torcida do
  outro lado entra no alto do quadro durante o jogo (40/40 instantes, mediana 11% da tela; antes 13/40) e o plano pela
  largura mantém o tamanho dos jogadores (36 → 38 px). **Celular só deitado:** em pé (com toque) a tela "Gire o celular" cobre tudo e o jogo
  para (`main.js` retratoBloqueado + `#girar`); janela estreita de PC continua jogando. O render nunca muda o hash
  (hash-igual IGUAL). Testes: `teste-rede`, `teste-torcida` (padrão), `teste-estadio` (navegador, CI; gol roteirizado
  por `tools/lib/gol-roteirizado.mjs`, sem depender de semente; item 10 = torcida durante o jogo no celular);
  `teste-controles`/`teste-editor-tela` conferem a tela de girar.
- **Estádio cheio e som da torcida no jogo** (pedido de 11/10; `PESQUISA-ESTADIO.md` §6, contrato em `CONTRATOS.md`):
  som nivelado por LUFS (`render/mixagem.js`, alvo −16) com limitador no fim (pico ≤ −1 dBFS), agenda de cantos/batucada/
  vaia/incentivo/festa em `render/festa.js` (pura, relógio do estádio), cantos decodificados sob demanda (≤ 2 na memória),
  iPhone com `audioSession.type = 'playback'` e volta depois de interrupção (gestos rearmados enquanto não 'running');
  torcida 14/20/25,6 mil (fileiras da frente ~97% na Média), arquibancada do LADO DE CÁ com o túnel (`config.js
  ESTADIO`) e os bancos — fora do desenho com a câmera de TV dentro dela (`cameraNoLadoDeCa`) —, faixas FICTÍCIAS,
  bandeiras de mastro e bandeirões no vertex shader (GPU = JS), sinalizadores só em momento marcado (saída de cada tempo,
  gol, vitória) com luz falsa por uniform (nunca `PointLight`) e fumaça no shader (Baixa sem fumaça), ola com a torcida
  calma; debaixo do bandeirão aberto ninguém fura o pano (bandeiras abaixam, torcedores seguram sem pular:
  `sobBandeirao`); vaia pela posse longa do visitante (~2 por partida). Custo: +1 chamada (faixas/bandeiras) e +1 só com
  sinalizadores acesos; pré-carga no 1º quadro desenhado (nada engasga no 1º corte). Testes: `teste-som-jogo` (navegador, CI), `teste-torcida` (seções E/F), `teste-estadio` (itens 11 e 12).
  Sons novos só CC0/CC BY (`assets/sons/CREDITOS.md`; nada da BBC nem do Sonniss).
- **Comemoração do gol** (pedido de 11/10: "não tem cena de comemoração!!!"; `PESQUISA-ESTADIO.md` §10, contrato em
  `CONTRATOS.md`): `js/comemoracao.js` (PURO) copia os 22 no tick do gol e anda com a MESMA locomoção (passoCorpo/
  passoPassada/passoPeDesenhado/alturaQuadril; o goleiro termina o mergulho) + gestos e golpes por IK (`anim.js` exporta
  `ik`/`ikBraco`): corrida para o alvo (bandeirinha, fundo diante da torcida, lateral da TV), finalização por hash do lance
  sem repetir (joelhos, pulo, céu, braços, giro), abraço de até 4 colegas, quem sofreu cabisbaixo, gol contra, cena curta
  no gol da IA contra o humano. `main.js` SEGURA o laço no passo antes da saída (gol + 149) enquanto a cena roda — a saída
  sai no mesmo tick, hash igual; a entrada do humano não vai para a simulação durante a cena. Ordem: gol → comemoração →
  replay → saída; pular a comemoração não pula o replay (pulada antes da hora, os passos que faltam rodam a 40 por quadro
  na cortina). Câmera por cortes (`camera.js definirCinema`: rede → steadicam → contraplano → reação). `?comemoracao=0`
  desliga (sem opção na pausa: não cabe em 844×390). Testes: `teste-comemoracao` (Node, padrão) e
  `teste-comemoracao-tela` (navegador, CI e deploy); os de navegador que não são dela abrem com `?comemoracao=0`.
- **Cena de substituição + faixa ENTRA/SAI** (pedido de 12/10; `PESQUISA-ESTADIO.md` §11, contrato em `CONTRATOS.md`):
  `js/substituicao.js` (PURO; cópias, a mesma locomoção; Regra 3.3 — sai pelo ponto mais perto, entra pelo meio-campo depois)
  + `render/placa-subst.js` (quarto árbitro id 203); fila única `filaCenas` em main.js (gol → comemoração → replay → substituição
  → recomeço; som adiado até a fila esvaziar); só desenho (hash igual); faixa ≥ 4 s; opção no "Modo de jogo" (desligada com
  webdriver/prints/demo; `?substituicao=1` nos testes dela). Testes: `teste-substituicao` (Node, padrão) e
  `teste-substituicao-tela` (navegador, CI e deploy).
- **Rede véu de noiva e branca** (pedido de 11/10: "as redes têm que ser brancas, ... movimentação na rede quando a bola
  toca nela, ... em véu de noiva"; `PESQUISA-ESTADIO.md` §8): sai o caixote de 2 m com teto. Forma ÚNICA em `js/rede-forma.js`
  (puro; `CAMPO.gol.veu`: hastes de 0,45 m nos cantos de cima e a parábola tangente ao chão até 2,8 m) usada pela física
  (`bola.js colidirGol`: o véu segura por dentro e a bola escorrega até a cunha do fundo — "morre no fundo"; por fora não
  entra), pela regra do gol (`sim.js verificarGol`, `treino.js`: atrás do véu não é gol) e pelo desenho (`rede-onda.js`:
  campo VETORIAL, a bolsa pela normal do véu; `campo.js`: trama colmeia procedural, fio ≥ 1 px e véu branco ao longe, luz
  própria `LUZ_GOL` de dia e de noite, armação branca com as hastes; sem textura). A bolsa começa no fim do passo da batida.
  **Muda o hash**: a condução fica IGUAL enquanto a bola não entra no gol (19/20 sementes do roteiro e 20/20 da demo); o
  treino de ataque diverge no passo seguinte ao 1º chute/lançamento cuja trajetória prevista passa da linha (base nova do
  `hash-igual`: `--ref <merge>`). Testes: `teste-rede-veu` (Node, padrão; reprova 5
  na base), `teste-rede` reescrito para o véu, `teste-rede-tela` (navegador, CI: forma, branca — fio de perto L* ≥ 85 de dia
  e ≥ 80 à noite —, clareia o gol na TV e na câmera do gol, mexe ≥ 4% na câmera do gol e ≥ 1% na TV; reprova 21 na base);
  prints do gol pelo gol roteirizado (`prints.mjs --so pc-gol-rede,...`: câmera do gol, perto, TV, atrás, perfil).
- **Comemoração do gol** (pedido de 11/10: "não tem cena de comemoração!!!"; `PESQUISA-ESTADIO.md` §10, contrato em
  `CONTRATOS.md`): `js/comemoracao.js` (PURO) copia os 22 no tick do gol e anda com a MESMA locomoção (passoCorpo/
  passoPassada/passoPeDesenhado/alturaQuadril; o goleiro termina o mergulho) + gestos e golpes por IK (`anim.js` exporta
  `ik`/`ikBraco`): corrida para o alvo (bandeirinha, fundo diante da torcida, lateral da TV), finalização por hash do lance
  sem repetir (joelhos, pulo, céu, braços, giro), abraço de até 4 colegas, quem sofreu cabisbaixo, gol contra, cena curta
  no gol da IA contra o humano. `main.js` SEGURA o laço no passo antes da saída (gol + 149) enquanto a cena roda — a saída
  sai no mesmo tick, hash igual; a entrada do humano não vai para a simulação durante a cena. Ordem: gol → comemoração →
  replay → saída; pular a comemoração não pula o replay (pulada antes da hora, os passos que faltam rodam a 40 por quadro
  na cortina). Câmera por cortes (`camera.js definirCinema`: rede → steadicam → contraplano → reação). `?comemoracao=0`
  desliga (sem opção na pausa: não cabe em 844×390). Testes: `teste-comemoracao` (Node, padrão) e
  `teste-comemoracao-tela` (navegador, CI e deploy); os de navegador que não são dela abrem com `?comemoracao=0`.
- **Placar de TV** (pedido de 12/10 com imagem de referência: "quero o placar assim, tem que ser algo menor e mais com a
  nossa cara"; `PESQUISA-ESTADIO.md` §7.1, contrato "Placar (12/10)" no `CONTRATOS.md`): uma barra só no canto de cima à
  esquerda — símbolo do GOLAÇO | faixa de cor + escudo + sigla da casa | placar em verde | sigla + escudo + faixa do
  visitante | relógio no bloco verde (verde-escuro quando parado). Escudos FICTÍCIOS em `<symbol>` no `index.html` (`escudo-golaco`,
  `escudo-ventania`; `hud.definirTimes` recebe `escudo` = id do elenco). 24 px de altura no celular e 26 no PC (antes 30/34;
  referência 29), números ≥ 14 px, siglas 11 px. Teste: `teste-hud-minimo` H10 (`--so-placar` roda só ele; o "antes" fica em
  `PLACAR_ANTES`). Igual nos treinos (sem o relógio). Só DOM/CSS: hash IGUAL. Contraprova (13/10): na partida o "1º T +4"/
  "Intervalo" só sai depois de o minimapa encostar à direita do placar; gols 9 → 10 refazem o topo; nos treinos a marca só
  sai se fizer falta; cada time é `role="img"` com o nome (leitor de tela).
- **Etapa 4 (regras IFAB, goleiro, bolas paradas, equilíbrio)** — em PRs; pesquisa em `golaco/PESQUISA-ETAPA4.md`,
  contrato em `CONTRATOS.md`. **Painel** `tools/painel-equilibrio.mjs` (seção 11 inteira, 144 partidas em ~9 min com 4
  CPUs; `--base <pasta js>` compara versões com as mesmas sementes; `--json`; `--partes a.json,b.json` junta pedaços). O CI
  roda o painel sozinho em todo PR que mexe na lógica (`golaco/js/*.js`): `.github/workflows/golaco-painel.yml`, 8 máquinas ×
  18 sementes contra a base do PR, tabela no resumo do job "junta" — usar esse em vez do local quando a máquina estiver cheia. Linha de base da publicada antes da Etapa
  4: 2,11 gols, 9,8 chutes (63% no alvo, 21% de conversão), passe 88,9%, último terço 48%, goleiro 67/58/89% (meta ok),
  40% dos gols de bola roubada perto da área. **Impedimento** (`impedimento.js`, Regra 11): foto em cada jogada do
  companheiro, infração no toque (também rebote de defesa e desvio), jogada deliberada do adversário zera, nada direto de
  tiro de meta/lateral/escanteio; tiro livre INDIRETO (`tiroLivre`, 9,15 m); linha viva amarelo-clara e a do lance parada
  no apito (`render/linha-impedimento.js`); ~1,2 por partida. **Acréscimos** (Regra 7.3): `PARTIDA.acrescimos`, "45+2'"
  e "1º T +4" no placar. HUD no celular estreito: `topo-c4` aperta o placar e, se ainda encostar, o minimapa encosta à
  direita dele (o relógio de 2 dígitos já encostava em 667/568 px). Teste: `teste-impedimento` (padrão; árbitro
  independente). Lição: a página com `?prints=1&demo=1` não refaz o laço do Node passo a passo — prints procuram o lance
  no próprio navegador. **Faltas** (`faltas.js`, Regra 12; PR 2 da Etapa 4): bote da IA, dividida do humano, carga por
  trás e falta tática (SPA); imprudente/temerária (amarelo)/força excessiva (vermelho); DOGSO = vermelho (na área
  tentando a bola: amarelo + pênalti); vantagem só clara (volta em 2,5 s); tiro livre DIRETO (a IA chuta até 30 m; a
  barreira é da parte 3); **pênalti** (Regra 14: todos fora da área e da meia-lua, goleiro na linha escolhendo o lado ANTES
  do chute — o humano pelo analógico; canhão 77/18/5% gol/defesa/fora); **expulsão** (sai de `m.jogadores`, fica na vaga
  como buraco, sem substituto; o técnico muda a vaga vazia, nunca o gol; goleiro expulso → o de linha mais perto vai
  para o gol). Calibrado: 2,6 faltas, 18% de amarelos, 0,08 vermelho por partida. Ícone do cartão sem texto
  (`#cartao-icone`). Teste: `teste-faltas` (padrão). `__golaco.faltaDeTeste()` para prints/testes de navegador.
  **Bolas paradas** (PR 3a; `lateral.js`, `bolas-paradas.js`, contrato "Bolas paradas" no CONTRATOS.md): lateral com a
  bola NAS duas mãos (o sim.js segura a bola, o arco por cima da cabeça, só PASSE/ENFIADA/LANÇAMENTO), 3 opções
  marcadas no gramado (`render/marcas-lateral.js`, a do analógico em amarelo; a IA sorteia, perto da área arremessa
  longo); escanteio com 5 nas zonas (centro, 1º pau, 2º pau, marca do pênalti, entrada da área) e defesa mista (zona na
  pequena área + 4 marcados no alto + borda + frente); barreira pela conta do ângulo (Regra 13, 9,15 m, 1–5, pula no
  chute, a bola bate nela) e a IA bate por cima dela; tiro de meta com a bola no chão e o goleiro com o pé, zagueiros
  abertos e saída curta (Regra 16); disputa pelo alto SÓ na bola parada (na bola rolando derrubou os gols de 2,8 para
  1,5 — fica para a 4.5). Canhões com estados do MEIO da partida (estados de saída são quase iguais e enganam).
  Teste: `teste-bolas-paradas` (padrão); `teste-estadio` confere os marcadores. `__golaco.bolaParadaDeTeste(tipo)`.
  Decisão do dono (11/10): publicar mesmo com os gols caindo 2,13 → 1,68 por partida e o goleiro 72,5%/64,6% (meta
  66–72/55–60) — o que saiu foram as cabeçadas fáceis de escanteio (22% dos escanteios viravam gol; real 2,6%), a
  mistura de chutes mudou. A entrega do cabeceio + IA intensa TEM de trazer os gols de volta (hoje 0 gol de cabeça:
  a cabeçada sai sempre para baixo). O tiro de meta tira os adversários da área na montagem (Regra 16).
- **Cabeceio na bola rolando e IA intensa com responsabilidade** (pedidos de 11/10; `PESQUISA-ETAPA4.md` §6, contrato
  no `CONTRATOS.md`; branch `golaco/cabeceio-ia`): `cabeceio.js` (puro) planeja o PULO (`j.cab`: contramovimento, saída,
  contato no alto do pulo, pouso, amortece) e a pose o desenha (quadril, tronco indo à bola, braços); o contato só vale com
  a CABEÇA DESENHADA na bola (`sim.js cabecaNaBola`) — nada de teletransporte para o chão. Intenção sem botão: a gol na
  área, afastar no meu terço, passe no resto (com botão só acima de 1,25 m). Disputa pelo alto também na bola rolando
  (`agendarDisputa`: o rival pula ombro com ombro; raspão quando a cabeça dele não está na bola). Goleiro lê o cruzamento
  (bissetriz do ponto onde a bola desce, `GOLEIRO.leCruzamento`). Na bola livre alta só quem TOCA encerra a vez (antes o
  1º da fila esperando um toque marcado tirava a vez do outro e a do goleiro). Escanteio: a defesa ataca a bola na zona
  dela e quem ataca tem a iniciativa (1º contato ~40%). IA: com o condutor em arrancada (≥ 6,3 m/s, `IA_DEFESA.corrida`)
  o 1º e o 2º homem acompanham pela velocidade sem subir no corredor, fecham até o bote perto do gol, o batido deixa de ser
  o 1º homem, o corredor recua junto, e o bote tira a bola para o lado do defensor com o condutor sem dominar (a roubada
  desfeita caiu de 23% para ~3%). Interceptação (dono, 12/10: "a defesa mal intercepta passe"): o marcador fica puxado
  para a linha de passe (`pontoMarcacao`) e, no passe, vai cortar quem chega a um ponto da TRAJETÓRIA antes do recebedor
  (`ia-tatica.js cortaPasse`, 0,2 s de leitura); no `sim.js` o recebedor que só marcou o domínio não tira a vez de quem
  foi cortar (antes o defensor no caminho só cortava com a bola batendo no corpo: 1 de 92 passes alcançáveis; agora
  ~60%); passe certo 88,7% → 85,1%, interceptações 8,75 → 11,3 por time por partida (acima da PL, 8,5: aqui quase todo
  passe errado é interceptação). Gols (painel de 48, mesmas sementes): main 1,79 → branch 1,50 — a defesa da arrancada
  (`corrida.v` 6,8; com 6,3 caía a 0,90) e menos gol de roubada alta (47% dos gols na main); falta volume de ataque
  (chutes 8,5 → 6,6), calibração final com a condução curta. Testes novos: `teste-cabeceio`, `teste-defesa-corrida`,
  `teste-intercepta` (os três reprovam na base; o defensor do corredor, 3,3–3,6 m/s contra a meta de 5, ficou PENDENTE); o painel ganhou `--retomar`/`--parcial` (máquina dividida), `--base-json` e `--set`. O
  `workflow_dispatch` do painel no GitHub dá 403 para a integração das sessões (roda sozinho no PR). NÃO mexer na condução nesta frente
  (a condução curta é de outra branch; a calibração final do painel é junto com ela).
- **Tela limpa** (pedidos de 11/10: "quero menos informação na tela", "não quero a linha de impedimento durante o jogo";
  `PESQUISA-ESTADIO.md` §7, contrato "Tela limpa" no `CONTRATOS.md`): a **linha viva saiu** (`IMPEDIMENTO.linhaViva`
  false; fica a do lance no apito — o replay mostra); na partida placar compacto de TV ("1º T" só no intervalo/fim/
  acréscimos), menu só com o ícone, barra de força sem texto, dica do PC some em 8 s; botões de toque translúcidos
  (80%, 55%; chave `golaco.toque.v2`) com o ícone e o NOME da função (dono, 12/10: "coloca o nome da função do botão de
  novo" — "Nomes nos botões" ligado por padrão; desligado na pausa = só o ícone), analógico quase invisível em repouso (com o dedo, igual:
  `escalaAnalogico`); minimapa desligado no celular (no PC fica, 112×73); "Minimapa" e "Nomes nos botões" são botões
  de liga/desliga na barra da pausa (na lista não cabia: a pausa continua sem rolar em 844×390); sem a seta no chão do
  controlado; marca de queda só na bola alta do time do humano. **Defesa do toque com 5 botões** no 1º anel: o CONTER
  virou a DIVIDIDA segurada (`entrada.js criarToqueOuSegura`: tocar < `ENTRADA.toqueCurto` 0,25 s = bote, segurar =
  CONTER desde o 1º quadro, como o "Sprint & Tackle" do FC Mobile; só o `pointerup` dá o bote — toque cancelado pelo
  sistema não) e a PRESSÃO foi para a vaga b; teclado e controle não mudam. O mundo recebe as mesmas máscaras
  (hash-igual IGUAL). Teste: `teste-hud-minimo` (navegador, CI e deploy; celular ≤ 11% de HUD em 3 telas, 0 texto fora
  do placar, ≤ 15% da torcida atrás do HUD, 0 linha viva, PC ≤ 2,5%, barra da pausa sem encostar). Peça nova de HUD na
  partida tem de caber nesse orçamento (ou ir para a pausa). Lição: o relógio das animações CSS do Chromium sem GPU
  atrasa 1–2 s do real com a máquina carregada — teste de algo que some por animação espera a animação, não um tempo fixo.
- **Replay** (pedidos de 11/10: "o replay não funciona"; "no impedimento, o replay mostra a linha"; `PESQUISA-ESTADIO.md`
  §9, contrato "Replay" no CONTRATOS.md, `config.js REPLAY`): `render/replay-anel.js` (puro) grava os últimos 10 s do que
  foi DESENHADO (copiado logo depois da pose; 3,36 MB fixos, ~11 µs por passo); `render/replay-roteiro.js` (puro) monta
  os roteiros; `render/replay.js` é o diretor com as câmeras. Gol: o replay entra na SAÍDA DE BOLA (TV 1× do chute − 4 s
  até o gol, atrás do gol 0,5×, lateral baixa 0,35× no golaço de ≥ 20 m; ≤ 12 s, golaço ≤ 14 s); a comemoração (outra
  frente) entra ANTES pelo gancho `posGol()` → `diretor.depoisDoGol()`. Impedimento: no apito, câmera alinhada com a
  linha, congela 1,6 s no quadro do passe (`tickFoto` no evento) com a linha do lance (`linhaImped.mostrar`; depois do
  replay ela não fica parada no jogo; a linha VIVA continua até a frente da tela limpa) e segue até o toque do impedido em
  ≤ 2,5 s reais (até 2× quando o apito vem longe do passe: 14% dos lances). "Replay" na pausa (últimos 10 s; pausa logo
  depois de uma montagem: o lance antes dela) e "Replays automáticos" (`?replay=0|1`). A SIMULAÇÃO FICA PARADA no replay (como na
  pausa): hash-igual e hash-partida IGUAIS. Qualquer tecla/botão/clique/toque pula (o aperto não vira jogada); só a marca
  "REPLAY" no canto (transmissão, não narração) e "Pular" no toque; o apito da saída toca depois. Testes:
  `teste-replay-anel` (Node, padrão) e `teste-replay` (navegador, CI); os testes de navegador e prints que não são do
  replay abrem com `?replay=0`. Lição: o laço da página entrega a entrada da IA pelo humano SEM o `ia` da
  `entradaDemoPartida` — semente achada em Node só bate com a página com `acharGol({comoPagina: true})`.
- **Análise semiautomática do impedimento** (12/10; contrato "Replay: análise semiautomática", `PESQUISA-ESTADIO.md` §9.1):
  replay do impedimento = P1 'linha' + P2 'saot' (só os do lance, parede/plano no QUADRIL, pulsos, quadro final oblíquo,
  ≤ 7,5 s); posição legal (passe ≤ 1,0 m, legal também pelas partes) no fim do replay do gol (≤ 13 s) e do da pausa. O
  selo "IMPEDIMENTO"/"POSIÇÃO LEGAL" (`hud.terco`, `#terco`) é a ÚNICA exceção à "sem narração": só no quadro final.
  Contraprova (13/10): o enquadramento confere os sólidos só no candidato que serve (S9: 415 mil → 11 mil chamadas de
  `solidoEm`, mesmo quadro) e só o cabeceio PARA O GOL marca "chute" no anel (`marcasDoPasso`: o de passe não abre a
  análise no "Replay" da pausa).
- **Replays nas paradas** (dono, 22/10: "os replays de faltas e jogadas passando na tela enquanto o jogo tá parado"; PR 1 do
  `PLANO-CENAS.md`, contrato "Cenas das paradas" no `CONTRATOS.md`): `js/lances.js` (puro, fora do fecho, no download
  inicial; `REPLAY_PARADA` mora nele) classifica a bola morta pelos eventos — pênalti, vermelho, trave (classe A, sempre),
  amarelo, falta a ≤ 25 m do gol, espalmada, chute de dentro da área a ≤ 1,5 m da trave (classe B: ≤ 3 por tempo e ≥ 30 s
  de bola rolando desde o último replay automático) —; o lance aceito fica ARMADO e toca no passo ANTES da montagem
  (`montaNoProximoPasso`, a cópia da conta do `regrasPartida`): 1 s ao vivo → TV 1× + 'fechada' (falta) ou 'atras'
  (chance) 0,5×, ≤ 8 s → a montagem. `seguraParaReplayParada()` fica no TOPO da volta do laço (antes da entrada da demo e,
  no online, de `podePassar`/`entradas`). ~2,3 por partida (24 partidas), o ar em replay (gol + impedimento + paradas) ~9,7%. `?replayParada=0|1`; desligado com
  webdriver/prints/demo; vale com "Replays: Ligado". Testes: `teste-replay-paradas` (Node, padrão: árbitro independente,
  roteiro, orçamento, pureza, predicado) e `teste-replay-paradas-tela` (navegador, CI); ferramentas `lib/paradas-node.mjs`
  (a página em Node) e `lib/acha-parada.mjs`. Mudou algo no `partida.js regrasPartida`? O P5 reprova: atualizar a cópia.
- **Cena do cartão** (dono, 22/10: "as cenas de cartões"; PR 2 do `PLANO-CENAS.md`, contrato "Cenas das paradas"): porte da
  branch `golaco/cenas-jogo` para FORA do fecho — `js/cenas-config.js` (as `CENA_*`, importado só pelos módulos sob demanda),
  `js/cena-atores.js`/`js/cena-cartao.js` (puros; cópias de `moverJuntas`/`inclinarTronco`/`flexionar` da comemoração),
  `render/cartao3d.js`, `js/cenas-tela.js` + `css/cenas.css` (tela DOM, como `editor-time.js`), tudo pelo `SOB.cenas` do
  `main.js`. No fim do passo (`decidirCartao`) o cartão mais grave vira a cena: o árbitro vem e ergue o cartão (3D, na mão
  DESENHADA: `jog3d.poseDesenhada`), 3 reações de amarelo e 3 de vermelho, o expulso sai pelo túnel (`render/vao-placas.js`,
  saiu do `prejogo.js`). Simulação PARADA no tick do cartão (hash igual); os treinadores vivos não andam nem são desenhados
  (cópias na cena: sem corte no anel, o replay da falta vem inteiro); o estádio anda no relógio do desenho (`relEst`). Ordem:
  falta → cartão → 1 s ao vivo → replay de parada; vantagem que virou gol → comemoração → cartão no gol + 149 (a cortina para
  ali; todos freiam fora do quadro: `CENA_CARTAO.assentar`) → saída → replay do gol. A TARJA de identificação (cartão, sigla,
  escudo, número, nome; sem motivo nem minuto) é uma exceção escrita à "sem narração", como a faixa ENTRA/SAI e o selo
  IMPEDIMENTO/POSIÇÃO LEGAL: só dentro da cena, nunca com a bola rolando. A faixa "Você foi expulso" (TM travado) espera a
  cena e o replay (também a comemoração e o replay do gol; no intervalo, o 2º tempo; no fim de jogo fica a faixa do fim). A
  comemoração que a cena encerra no gol + 149 deixa o passo da saída NEUTRO (`golNeutro`: a mesma entrada por tick com e sem
  a cena). Pulada antes de o cartão subir, volta o ícone de sempre. Ninguém da cena passa por cima da bola parada
  (`CENAS.bola`; a página desenha a do mundo); o plano da torcida anda no trilho do pré-jogo do estádio de forma própria
  (`ajustePlano`). "Cenas <small>ligadas</small>" na linha das cenas do "Modo de jogo" (3 botões que crescem pelo texto: numa
  linha a mais a pausa rolava em 844×390); `?cenas=0|1`; desligada com webdriver/prints/demo; online = o ícone de hoje; sem o
  módulo baixado = o ícone. API `__golaco.cenas`. Testes: `teste-cenas` (Node, padrão: A canhão de 144 com os treinadores
  onde os vivos ficam, A-L 48 vermelhos na lateral de cá, B, E, F, G, P os trilhos das plantas) e `teste-cenas-tela`
  (navegador). Download inicial: folga 1434 → 1399 KB.
- **Cena do intervalo** (dono, 22/10: "a cena de intervalo"; PR 3 do `PLANO-CENAS.md`, contrato "Cenas das paradas"):
  `js/cena-fim.js` (puro, sob demanda; já com a interface do fim de jogo do PR 4) + o GUARDADOR de lances
  (`render/lances-guarda.js`, puro: até 6 lances de ≤ 6 s, jogadores a 30 Hz em Int16 1/4000 m, bola/relógio/corte a 60 Hz,
  ~5,7 MiB fixos alocados na 1ª partida; o gol guardado no `posGol` e a parada A/B no passo antes da montagem, com ou sem
  replay) tocado num MINI-ANEL pelo diretor com fonte (`iniciarReplay(ro, {fonte, aoFim})`: o fim volta à cena). O laço fica
  parado no tick do `intervalo` até o plano `geral`; ali solta e a `saida` do 2º tempo acaba a cena no MESMO tick/hash de
  `?cenas=0`. Tarja do placar com os autores e painel de estatísticas do 1º tempo (exceções escritas à "sem narração", só
  dentro da cena). A súmula passou a import ESTÁTICO (sempre na partida; escanteios na bola morta, faltas por time,
  porTempo; o `resultadoTM` não muda) — o "sem `?tm` o download não cresce" deixou de valer para ela (folga 1399 → 1347 KB).
  Comandos: Toque/Enter/A = próximo bloco (no geral, a saída), "Pular" (toque) = a saída, Esc/P/Start = a pausa (Editar time).
  Lição: cena POR BLOCOS precisa da BORDA do aperto (`F.botoes = ent.botoes`; com `&=` o botão segurado contava como novo a
  cada quadro e atravessava os blocos). Testes: `teste-cenas` C, `teste-lances-guarda`, `teste-ponte-tm` P7/P7b,
  `teste-cenas-tela` I (e C12d).
- **Cena do pós-jogo** (dono, 22/10: "a cena de pós jogo"; PR 4 do `PLANO-CENAS.md`, contrato "Cenas das paradas"): a mesma
  `js/cena-fim.js` com `planejarFim(m, 'fimDeJogo')` — apito → vencedor/perdedor (empate: neutro) → cumprimentos → TROCA DE
  CAMISA (1 par de adversários de linha pelo hash do jogo, abraçados, cada um com a camisa do outro: o kit misto
  `troca:<camisa>:<resto>:<num>` do `render/jogador3d.js`, com o patrocínio da camisa na versão de teste — 0 chamada a mais
  medida no celular, manequim e corpo novo) → os treinadores se cumprimentam → aplauso → torcida (festa do bandeirão/
  sinalizadores de quem ganhou, vaia de quem perdeu) → MELHOR EM CAMPO (`sumula.js melhorEmCampo`; a nota pela mesma conta
  do `jogador` do `resultadoTM`, que ganha só o campo OPCIONAL `melhor: {lado, tmId, nome, nota}`) → placar final com os
  autores → estatísticas da partida (não no TM) → a faixa final com "Melhores momentos" (até 6 lances do guardador, os gols
  primeiro, ≤ 30 s; o Pular volta à faixa). ~34,5 s (36 com a troca; empate 32/33,5; o empate que continua no TM é a versão
  curta, 14,5 s — `partida.empateContinua`, que o TM v375 manda por modo: `tm3d.js empateContinuaDe`, liga = false,
  mata-mata = a mesma conta do onDone; sem o campo, curta). Fora do online o laço fica
  PARADO no tick do `fimDeJogo` até "Jogar de novo" (em `fim` só o tick andaria); NO ONLINE a cena roda sem segurar (o
  lockstep segue). O resultado do TM continua gravado no apito (a cena não atrasa nada). Tarjas do melhor em campo, do
  placar final e o painel: exceções escritas à "sem narração", só dentro da cena. API `__golaco.cenas` (tipo 'fim':
  `fimDeTeste({placar})`, `melhoresMomentos()`, `historicoPosJogo`, `faixaFinal`); `?troca=0` tira a troca. Testes:
  `teste-cenas` FIM (56 fins nos 3 desfechos; `--sem-fim`/`--min-fim` trocam a amostra), `teste-ponte-tm` P8 (`--base` compara
  o resto do resultado com a súmula da base), `teste-cenas-tela` F (navegador). Lição: a cena do fim é a 1ª com os 22 em campo
  o tempo todo — quem foge da lente, a 2ª fileira de câmeras, quem está dentro do gol/atrás das placas no apito e o trilho da
  torcida só apareceram com 7 amostras de 56 fins (uma amostra só passava).
- **Pré-jogo** (pedido de 11/10; `PESQUISA-PREJOGO.md`, contrato em `CONTRATOS.md`): antes do 1º passo (tick 0; o apito
  da saída só no fim; hash igual) — abertura "Toque para começar" (libera o som), aéreo de fora, fachada com a torcida
  chegando, o estádio por dentro, túnel, entrada com os árbitros, plano alto da fila se formando, a câmera passando pela
  fila de cada time, 4 cortes de torcida/estádio e as escalações no campinho (cada time grande, ~10 s, o mesmo fundo; a 1ª
  sai e a 2ª entra). Puros: `cortejo.js` (22 + 3 árbitros saem do túnel pela locomoção do jogo num mundo à parte; fotos e
  fila montada), `prejogo-roteiro.js` (completo ~81 s, curto ~41 s, só escalação ~21 s; trilhos Catmull–Rom centrípetos),
  `estadio-forma.js` (sólidos onde a câmera não entra + o lado de fora). Desenho: `render/prejogo.js` (diretor),
  `render/estadio-fora.js` (fachada, cobertura, cantos, túnel por dentro, esplanada, bairro, prédios, carros, torcedores —
  SÓ no pré-jogo: a TV do jogo fica dentro da arquibancada de cá), `prejogo-tela.js`, `escalacao-tela.js`, `campinho.js`
  (o campinho do editor), `css/prejogo.css`. Pular: toque/Enter/A = próximo bloco; Pular/Esc/Start = jogo. Pausa → "Modo de jogo"
  → "Pré-jogo da partida" (cada toque: completo → curto → só escalação → desligado; padrão completo; fora das opções
  porque a pausa tem de caber sem rolar no celular deitado); Reiniciar no meio = só escalação. **Desligado** com
  `navigator.webdriver`, `?prints=1` e `?demo=1`; `?prejogo=1|curto|escalacao|0` força. Testes: `teste-cortejo`,
  `teste-prejogo-roteiro` (padrão), `teste-prejogo` (navegador, CI); prints `tools/prints-prejogo.mjs` (folhas de contato).
  Celular Média: pior plano 35 chamadas / 122 mil triângulos (meta ≤ 40 / ≤ 130 mil). O HUD não aparece no pré-jogo (por
  desenho). As placas de cá ganham um vão na frente do túnel SÓ no pré-jogo (recorte por `clippingPlanes`; no jogo a bola
  bate nelas) — o cortejo passava por dentro delas; celular em pé no pré-jogo = pausa (tempo e som).
- **Regras e controles** (pedidos do dono de 11/10: "se eu deixo o meu jogador parado, ninguém pega a bola", "o botão de
  pressão não funciona", "não consigo mexer com o goleiro", "só pega com a mão dentro da área", "não pode recuo"; tudo só
  na partida — o treino segue bit a bit igual): condutor parado/lento (< 2 m/s) → o bote da IA alcança a bola parada no
  pé (ganha pela chance da DIVIDIDA; `boteErrado`) e o gatilho de ESTADO `IA_DEFESA.lento` põe o 1º homem a 0,2 m da bola
  e o 2º na cobertura (`FALTAS.bote.lento` 0,4); PRESSÃO = quem CHEGA PRIMEIRO persegue em disparada e disputa a bola
  pela velocidade, do lado do gol, com o 1º homem da IA já apertando chama outro, e setas âmbar acima dele
  (`pressionadorVisivel`) — D1 (dono, 23/10: "preciso do botão de pressão funcionando"; item 18 da FILA): um toque vale
  ~1 s (`pressao.validade` em s, só com o time defendendo; qualquer retomada encerra o pedido, também a do goleiro com a
  mão: `m.possePorTime` e `encerrarPressao`), o chamado tenta o bote correndo junto do condutor (trava "embalado" pela
  conta do `forcaContato`, a menor entre a própria e a relativa que fecha nele, `boteContidoDoChamado`; as de "por trás" e
  do corpo entrando ficam), a marca só troca de jogador com `histerese` 0,5 s (condutor) / `histeresePasse`
  1,0 s (passe da IA) e o O/RB preso como PEGAR vira PRESSÃO quando a fase vira defesa (`entrada.js RELE_NA_DEFESA`; o
  replay que começa com ele segurado não o vê como aperto novo: `main.js iniciarReplay`, `teste-replay` C7);
  todas as posses, humano parado, 1 s de botão: ganhar a bola em 3 s +2,3 → +9,4 pontos (`teste-pressao-humano` M9–M12).
  A C1 (PRESSÃO com o analógico solto faz o PRÓPRIO controlado apertar, `entradaPressaoPropria`) está LIGADA
  (`DEFESA_HUMANO.pressao.controlado` = true — dono, 24/10: "meu jogador aperta também"; +9,4 → +13,1 pontos); goleiro (`regras-goleiro.js`, IFAB 12.2/12.3/16): mão só na própria área, sem recuo (o
  goleiro domina com o pé; a IA dele passa curto ou dá chutão; a IA de linha só recua seguro), PEGAR (O/RB/botão que só
  aparece com ele com a bola no pé) com recuo ou com a bola que soltou = tiro livre indireto, 8 s com a bola nas mãos =
  escanteio (anel âmbar sem texto nos últimos 5 s; a reposição automática do humano saiu — a demo e a IA repõem),
  TROCAR segurado 0,4 s = o goleiro, o analógico o move sem a bola e com ela nas mãos até a borda da área (PASSE rola,
  LANÇAMENTO/CHUTE é o chutão, ENFIADA solta no chão); tiro de meta com os adversários fora da área na montagem.
  Testes: `teste-parado`, `teste-pressao-humano` (pareado com × sem o botão, `tools/lib/pressao-pareada.mjs`),
  `teste-goleiro-regras` (padrão); `teste-controles` (marca, PEGAR, anel). Limite físico anotado: do parado o corpo anda
  ~3,2 m no 1º segundo (o "≥ 2 m mais perto em 1 s" do diagnóstico fica informativo). Painel (144, base × agora): as
  regras tiraram gols fáceis de 6 a 16,5 m e as defesas nessa faixa foram a 60,8% (meta 55–60%) — `GOLEIRO.logit.c0Partida`
  −0,1 só na partida → 59,0% (total 68,0%, de fora 86,8%, gols 2,13 = base); nada que estava na meta saiu.
  Contraprova: PEGAR só com a bola no pé ou solta a ≤ 3 m/s (`GOLEIRO.pegaVMax`; martelando o botão o goleiro controlado
  pegava todo chute a ≤ 1 m do corpo), colado na linha do gol o goleiro com a bola nas mãos não vira para o gol nem a
  solta além dela (`GOLEIRO.soltaLinha`; virar fazia gol contra), a câmera corta no `corteBolaParada` do tiro de meta
  (testes: `teste-goleiro-regras` G3c/G5d, `teste-estadio` item 13).
- **Cavadinha com dois toques no CHUTE** (dono, 12/10; `acoes.js`, `ACOES.cavadinha`, contrato no CONTRATOS.md): o 2º
  aperto do CHUTE (K, B, CHUTE do celular — o mesmo botão, nada novo na tela) antes de o chute do 1º tocar na bola vira
  cavadinha, de qualquer lugar (também pênalti/tiro livre direto), mirando pelo analógico; a força do 2º toque deixa mais
  alta. Só do humano (`j.porHumano`: entrada sem `ia`); um toque do humano nunca é cavadinha; a IA (e a demo) seguem com
  a automática do goleiro adiantado. Medido: o chute sai 50 ms depois de soltar, então o 1º toque RÁPIDO (< 0,18 s)
  espera a janela de 0,15 s (contato +117 ms parado; correndo, no 1º apoio depois dela, até +267 ms) — só o aperto NOVO
  (`carga.novo`; o botão segurado de antes da troca de controle chuta na hora); o chute carregado sai no mesmo tick de
  antes. Bola parada: o CHUTE só cobra pênalti (Panenka: 2 gols/12, 9 fora — erro da cavadinha × pressão do pênalti;
  calibrar é decisão do dono) e tiro livre direto; no resto dois toques não fazem nada; a cobrança da demo leva `iaCobra`
  (a IA repete o botão na cobrança — sem a marca virava cavadinha; a página `?demo=1` passa a mesma marca em toda a
  entrada da demo — `main.js entradaDoTime` — e os achadores `comoPagina` também). Entrada: soltar e apertar de novo
  sem passo no meio vira solto + apertado (`entrada.js` `passoUsou`/`limparPulsos(true)`; antes o toque duplo rápido
  virava um aperto só; fora do laço — replay — `limparPulsos()` zera também o que o passo viu, e o `passoUsou` vem
  ANTES do passo: a tecla segurada no começo do replay, solta e apertada de novo, pula). De longe a pedida nunca sai mais
  rápida que o chute mais forte do jogador (sem o teto saía a até ~70 m/s). Limite medido (teste-cavadinha L): parado,
  intervalo > 150 ms ou 1º toque ≥ 0,18 s = chute. hash-igual IGUAL; hash-partida: demo IGUAL, humano IGUAL com a janela zerada e a cavadinha
  desligada (só a cavadinha muda a partida). Teste: `teste-cavadinha` (padrão; `--js` mede a base) e `teste-controles`
  (K, B, CHUTE duas vezes, reaperto no mesmo quadro, repetição da tecla, toque cancelado). Pesquisa: `PESQUISA-ETAPA2.md` §2.7a.
- **Área técnica, treinadores e as câmeras 3 e 4 do replay do gol** (pedidos de 12/10; `PESQUISA-ESTADIO.md` §12–§13,
  contrato "Área técnica, treinadores e as câmeras 3 e 4" no `CONTRATOS.md`): as duas áreas técnicas (Regra 1) na malha das
  linhas; dois treinadores FICTÍCIOS (`js/tecnicos.js`, puro, ids 210/211, kits `tecnico0`/`tecnico1`) com a locomoção do
  jogo num mundo à parte, só lendo a partida (hash igual): observam, instruem, aplaudem, reclamam, comemoram e sentem o gol,
  nunca saem da área nem tapam a TV; `treinadorDoTime(T, t)` é o GANCHO da frente `golaco/cenas-jogo`. Replay do gol: TV →
  atrás → [lateral] → 1ª PESSOA do autor (0,6×; olho estabilizado dentro da cabeça, sem balanço; giro ≤ 85°/s; o gol no
  quadro antes do chute) → VISÃO DO TREINADOR (o que ele vê → corte → ele reagindo) → [checagem]; "Pular" em qualquer plano.
  Testes: `teste-tecnicos` (T1–T16, padrão), `teste-replay-anel` G1–G13 (28 partidas), `teste-replay` G1–G6 (celular
  844×390 Média: chamadas e CPU por plano), `teste-tecnicos-tela` (CI). A animação da passada balança a cabeça até ±9 cm:
  o "≤ 6 cm do olho bruto" da 1ª pessoa vale na horizontal. Contraprova (15/10): os planos novos procuram o último corte
  até o GOL (um corte entre o chute e o gol fazia a câmera da 1ª pessoa pular 52 m; sem corrida antes do chute, sem 1ª
  pessoa — B19 e `teste-replay` G7); a lateral do golaço decide o z uma vez por plano (pulava 2,5 m ao passar por um
  treinador — T15); o treinador que andou numa cena com o mundo parado (substituição) marca corte no anel
  (`REPLAY.saltoTecnico`; deslizava ~3 m no replay — `teste-tecnicos-tela` V7); o gol roteirizado `{marcarChute}` tem 60
  passos de corrida antes do chute (o corte do teletransporte fica antes dele).
- **Motor 3D do Total Match** (dono, 15/10: "pode trocar o antigo pelo novo? e colocar as coisas certas? e na partida,
  quero que a logo dos times, torcida, e estádio, estejam adaptáveis a cada time"; contrato "Ponte com o Total Match" no
  `CONTRATOS.md`): o TM (`legacy-total-match/js/tm3d.js`) abre `golaco/index.html?tm=<id>` num quadro com o pedido v2 em
  `localStorage["tm3d:pedido:<id>"]` (os dois times com 18 jogadores, a vaga da prancheta, uniformes e a IDENTIDADE: o
  mesmo escudo que o TM mostra — real na edição pro, gerado na pública, desenhado no Ultimate —, estádio, liga; a
  partida com mando neutro, público e clássico). Lado do golaco: `ponte-tm.js` (lê o pedido na importação, postMessage
  `tm3d:pronto/fim/sair`), `tm-times.js` (puro: ids 1001+/2001+, formação do TM → as 6 daqui, húngaro pelo slot,
  atributos do TM sem desequilibrar), `sumula.js` (puro: gols com autor/contra/pênalti/assistência, cartões, chutes, no
  alvo, posse, nota do travado → o resultado do TM). Time 0 = mandante do TM; o HUMANO é variável (`criarPartida({humano,
  trava})`, `m.timeHumano`); "só o meu jogador" (Rumo ao Estrelato) = `m.trava` em `assumirControle` + TROCAR/GOLEIRO
  mascarados. Pausa do TM: "Simular o resto" (passoPartida em pedaços de 30 ms sem desenhar), sem Reiniciar/Modo de
  jogo; fim com "Voltar ao Total Match". Identidade por time (`identidade.js`, puro; padrão = as constantes de hoje):
  escudo no placar/escalação/abertura/placas/bandeirões/fachada, uniformes sem confusão (ΔE₀₀), torcida/cachecóis/faixas/
  mosaico/cadeiras pelas cores e nomes, nome do estádio do mandante, ocupação pelo público. Cara do TM só com `?tm`
  (`<html class="tm">`, `css/tm.css`, `js/tm-cara.js`, `assets/tm/` com a Inter e a logo do próprio TM). **Sem `?tm` nada
  muda** (hash-partida e hash-igual IGUAIS; o download do `teste-carga` não cresce: o que é só do TM entra por import
  dinâmico). Testes: `teste-ponte-tm`, `teste-identidade` (padrão), `teste-tm-tela` (navegador, fora do CI); ponta a ponta
  com o TM: `node legacy-total-match/ferramentas/testar-3d.mjs`. Pausa do TM: o submenu "Modo de jogo" vira "Cenas da
  partida" (pré-jogo e substituição, sem os treinos). Nota do travado na escala do Rumo ao Estrelato (média ~7,2, ≥ 8 em
  ~25%, como a simulação do TM).
- **Estádio de cada clube no pré-jogo** (dono, 15/10: "pesquisa como eles são e altera eles nas cenas pré-jogo ... com
  todos os estádios"; contrato "Estádio de cada clube no pré-jogo" no `golaco/CONTRATOS.md`): na edição PRO (pedido
  `edicao: "pro"`, jogo não neutro) o estádio REAL do mandante sai da base `golaco/assets/tm/estadios.json` (os 524
  estádios do TM pesquisados — foto do TM + web; a pesquisa com as fontes em `golaco/tools/estadios/pesquisa.json`;
  homônimos pelo clube mandante): fachada por estilo (vidro, concreto, metal, membrana, tijolo, treliça, painéis;
  `render/fachada-estilos.js`, só baixado nesse caso), cores e LED, cobertura total/lados/parcial/nenhuma, cadeiras
  (liso/misto/faixas/mosaico, também no jogo) e o nome real na placa. Edição PÚBLICA, jogo neutro ou estádio fora da
  base: o Estádio Golaço de hoje com o nome "Estádio Total Match" e o mosaico "TOTAL MATCH". A geometria não muda (trilhos
  de câmera e a bola). **Forma própria** (dono, 16/10: "não tem nada a ver com o maracanã"; 21/10, depois de ver a prévia:
  "quero isso com todos os estádios do jogo, ele pesquisou o estádio, olhou direitinho e fez detalhes certinho"):
  `js/estadio-planta.js` (puro, a fonte única das contas: forma, lugares da torcida, sólidos da câmera, trilhos) com a 1ª
  família, a TIGELA OVAL COM ANEL DE COBERTURA (o Maracanã de hoje, medidas reais; `estadios.json` → `forma`), e
  `render/estadio-real.js` (o desenho, sob demanda, com o entorno próprio do Maracanã: Maracanãzinho, trilhos, Mangueira,
  Cristo); 4 rodadas com fotos de referência. Teste `teste-estadio-forma` (padrão). **Plano dos lotes (dono, 21/10:
  "em lotes")**: (1) publicar o Maracanã; (2) as outras famílias — 4 arquibancadas à inglesa (cantos abertos/fechados),
  arena moderna fechada, com pista de atletismo, pequeno —; (3) lote 1 de estádios: os 56 do Brasil + os 58 com ≥ 50 mil
  lugares (pesquisa de cada um: forma, medidas, anéis, cobertura, fachada, marcas próprias e entorno; detalhes próprios
  nos famosos); depois os outros 409 em lotes, um PR por lote. **Planta genérica** (lote 1, 21/10; contrato "Estádios de
  forma genérica" no `CONTRATOS.md`): `js/estadio-generico.js` (puro; a mesma interface da do Maracanã) + `render/estadio-generico.js`
  (sob demanda) para as 5 famílias; a forma de cada estádio sai da pesquisa por `tools/estadios/gerar-formas.mjs` e da revisão
  contra as fotos (`tools/estadios/ajustes-forma.json`); conferir com `tools/prints-estadios.mjs` (folha por estádio) e o
  `teste-estadio-generico` (a base inteira). Os defeitos que se repetem na revisão viram CAMPO da forma (talude, `cob.comp`,
  torres de luz por lado, cadeiras em setores/raios, bola, cubo; lista no contrato), não ajuste estádio por estádio. Pesquisa grande: o Workflow roda só 2 agentes por vez nesta máquina — para
  ~100 estádios, agentes em segundo plano (Agent) gravando cada fatia num arquivo andam ~4× mais rápido. Mexeu em main.js,
  hud.js, partida.js, acoes.js ou nos desenhos de estádio/torcida? Rodar também `teste-tm-tela` e o `testar-3d`.
- **Modo Pênaltis 3D** (dono, 15/10: "crie uma versão só de jogador de pênaltis" → "modo de pênaltis 3d igual ao golaço, só
  que versão de pênaltis"; contrato "Disputa de pênaltis" no `CONTRATOS.md`): `?modo=penaltis`, "Pênaltis" no "Modo de jogo" e,
  no TM, "Pênaltis 3D" em "Mais modos" (`legacy-total-match/js/penaltis3d.js`, o pedido com `modo: "penaltis"`). `js/disputa.js`
  (puro; IFAB Regra 10: 5 alternadas com fim antecipado, alternadas, fila dos cobradores, moeda pelo `m.rng`) usa a MESMA
  cobrança do pênalti da partida (`partida.js prepararPenalti/cobrar`); o cobrador anda até a marca pela locomoção (`j.guia`
  de quem está 'parado' no `sim.js`); a câmera atrás do cobrador (o analógico pelo yaw dela); `js/disputa-tela.js` (bolinhas,
  só o CHUTE). Os dois só por import dinâmico. Sem o modo, `hash-igual`/`hash-partida` IGUAIS. Revisão (16/10): o goleiro
  que defende NA linha até o chute (Regra 14), a cobrança só acaba quando a bola não pode mais entrar (e depois dela nenhum
  gol conta), 'defesa' só com toque do goleiro, o goleiro da IA lê a cavadinha repetida, a semente sorteada sem `?semente`. Testes: `teste-disputa` (Node),
  `teste-penaltis-tela` (CI) e `legacy-total-match/ferramentas/testar-penaltis.mjs` (senha do Viverde só por `TM_SENHA_VIVERDE`).
- **Modo Livre 3D** (dono, 16/10: "um modo livre, como no fifa, um modo de treino, onde pode ter a quantidade de jogadores que
  eu escolher, contra a quantidade de jogadores que eu escolher, pode ser adaptável durante a partida, assim como a câmera";
  contrato "Modo Livre" no `CONTRATOS.md`): `?modo=livre`, "Modo Livre <small>N contra M</small>" no "Modo de jogo" e, no TM,
  "Modo Livre 3D" em "Mais modos" (`legacy-total-match/js/livre3d.js`, `TM.tm3d.jogarLivre`, pedido com `modo: "livre"` e
  `livre: {linha, goleiro}`; volta sem resultado). `js/livre.js` (puro; `config.js LIVRE`): o mundo da partida com `m.livre`
  (FORA do hash), 0–10 de linha por lado (o meu ≥ 1) + goleiro liga/desliga; mudar na pausa NÃO recomeça (quem sai vira
  buraco na vaga, quem entra aparece na vaga tática; o controlado nunca sai); sem relógio, impedimento (nem na IA:
  `LIVRE.linhaSemDefesa`), faltas e cartões (o bote que seria falta = contato sem apito, `BOTE_SEM_GANHAR`); a câmera da bola
  parada (#490) entra por cima das do Livre; R no meio do gol descarta o replay dele; time sem jogador de linha passa as cobranças ao outro; IA comprimida perto da bola
  com poucos jogadores e pressão Alta até 7 de linha. Ganchos `ganchosLivre` no `partida.js` (ligados pelo livre.js).
  Página (`js/livre-pagina.js`, submenus Jogadores e Câmera, Recomeçar/Bola no meu pé, API `__golaco.livre`), câmeras
  (`render/camera-livre.js`: TV, Aproximada, Ampla, Alta, Atrás, Jogador + Altura/Distância 0–20; Atrás/Jogador com o rumo
  FIXO do ataque do meu time, o analógico por ele; C/R3 cicla; nada atravessa arquibancada/placas; bola e controlado sempre no
  quadro) e `render/cantos-livre.js` (fecha os cantos de cá) — tudo SÓ por import dinâmico. Sem o modo, `hash-partida`/
  `hash-igual` IGUAIS. Testes: `teste-livre` (Node), `teste-livre-tela` (CI e deploy), `legacy-total-match/ferramentas/
  testar-livre.mjs` (senha do Viverde só por `TM_SENHA_VIVERDE`). Pendente para o dono: as câmeras novas também na partida.
- **Online 1×1** (dono, 16/10: "duas pessoas consigam jogar uma contra a outra, no modo jogável"; contrato "Online 1×1" no
  `CONTRATOS.md`, etapas 0–3): **troca de entradas** (lockstep com atraso D de 3–10 passos, sem rollback) — a simulação é
  determinística nos dois aparelhos (etapa 0: a pose e o húngaro do TM pelo `matdet.js`, `.sort(` com desempate total;
  `teste-math-proibido`), a partida aceita dois humanos (etapa 1: `criarPartida({humanos: [0, 1]})`, `passoPartida(m, {0, 1})`,
  a cobrança pela entrada do time do cobrador; `teste-dois-humanos`), `js/online.js` (puro, etapa 2: 6 bytes por entrada,
  D que só sobe, freio de quem está à frente, ações pelo canal confiável, hash a cada 60 passos; `teste-online` com a
  rede de mentira `tools/lib/rede-memoria.mjs`) e a página (etapa 3: `js/online-pagina.js` + `main.js quadroOnline` — só
  roda o passo com as duas entradas; replay/comemoração/pausa/celular em pé seguram só o MEU lado e o outro espera; menu e
  editor abertos = bit IA; pausa combinada 3 × 60 s; W.O.; dessincronia; `teste-online-tela` com duas abas pelo
  BroadcastChannel, `?online=<sala>&transporte=bc&lado=0|1&ia=1`). Lado do TM: `legacy-total-match/js/online3d.js` (sala
  `salas3d/{código}` no Firebase do TM, WebRTC com STUN e sem TURN, a ligação mora na página do TM e passa ao quadro por
  uma MessagePort — protocolo no topo do arquivo; `TM.tm3d.jogarOnline`). Testes do TM: `ferramentas/testar-online3d.mjs`
  (banco falso, WebRTC de verdade no loopback; `--golaco` = com o GOLAÇO de verdade). Sem o online, `hash-partida`/
  `hash-igual` IGUAIS. Pendente (fora da v1): convite pela lista de amigos, indicador de sinal no HUD, reconexão depois de
  recarregar, TURN (precisa de conta de adulto), rollback.
- **Bolas paradas no estilo FIFA** (pedido de 16/10; `mira.js` na lógica; `render/bola-parada.js` + `mira-linha.js` SOB
  DEMANDA; PESQUISA-ETAPA4.md §12, contrato "Cobrança mirada" no CONTRATOS.md): câmera atrás do cobrador no
  escanteio, falta, pênalti e tiro de meta do humano (e no pênalti contra), o analógico pela câmera dela; na cobrança da
  PESSOA o analógico gira a mira, a carga é a força e Z/X (analógico direito, botões CURVA) põem curva; a linha é a física
  da bola passo a passo (a bola real passa a 0 cm dela sem o erro do cobrador; na falta só até 4 m além da barreira). A IA
  não usa (hash-partida da demo IGUAL). Testes: `teste-mira` (Node) e `teste-bola-parada-tela` (navegador). **Download
  inicial** (`teste-carga` 4 MB): desde 21/10 os sons da torcida (~1,4 MB de MP3) baixam no 1º GESTO (`render/som.js`;
  antes dele nada toca) — 3,88 → 2,57 MB, folga ~1,4 MB; código novo que não precisa do começo continua sob demanda.
- **Etapa 5 — corpo humano realista** (dono, 22/10: "vamos trabalhar intensivamente no corpo e face dos jogadores"; plano e
  pesquisa em `golaco/PESQUISA-ETAPA5.md`, contrato "Corpo humano realista — Etapa 5.1" no `CONTRATOS.md`): o Rocketbox
  `Sports_Male_02` (MIT) encaixado nas medidas do jogo (`tools/humano/`, README), 25 ossos do desenho pelas juntas
  (`render/esqueleto.js`, puro), 4 LODs (`render/lod-humano.js`), a pele na GPU e o uniforme pintado por região
  (`render/humano3d.js`, sob demanda) — atrás de `?corpo=humano` até o rosto chegar. SÓ DESENHO: `tools/fecho-hash.mjs
  --diff origin/main` tem de dar 0 em todo PR da Etapa 5 (a `config.js` e a `comemoracao.js` são do fecho: constante do
  corpo vai no `repouso` do `corpo.json` ou no render). Testes: `teste-ossos`, `teste-lod-humano` (Node), `teste-corpo-tela`
  (navegador). Lições: o tornozelo APOIADO do jogo fica a 8 cm (a pose do treino parado dá 10,2: medir na partida); a torção
  do membro pelas juntas DESENHADAS virava (usar as do jogo na perna); o ombro do desenho tem de subir com o braço (com a
  queda fixa, o braço erguido esticava e a torção pulava 123°); a POSTURA "curvada" (joelho 42° parado) se corrige no
  desenho (`esqueleto.js postura`: sobe o quadril com os pés no lugar, endireita tronco e cabeça; as mãos juntas na bola
  ficam) — mão presa no lugar com o ombro subindo fazia o braço pular (O2 66 → 166): o braço vai junto, rígido. Rostos reais (versão de teste com senha, edição pro): fotos
  mais recentes do Commons pelas PÁGINAS (a API dá 429 para o IP desta máquina; miniaturas por thumb.wikimedia.org) e
  as camisas 2026 dos 20 clubes do Brasileirão pesquisadas (cores estimadas por foto; goleiros são o mais incerto).
  **Rostos reais 5.2** (`tools/rostos-reais/README.md`, contrato "Rostos reais — Etapa 5.2"): 112 do Brasileirão (de 273;
  quem não tem foto livre, neutra e conferida fica com a cabeça genérica). Lições:
  - **A foto manda mais que o processo:** sorriso, boné, língua e cabeça inclinada ficam gravados na pele. Por isso o
    filtro de expressão pelos blendshapes e mais candidatas pela busca de imagens do Commons (a página
    Special:MediaSearch).
  - **A busca traz outras pessoas** (até uma atriz, um "Nicanor" de 1990, a foto com dois jogadores): identidade pelo
    SFace contra a foto do TM (≥ 0,40), foto com outro jogador citado só com ≥ 0,6.
  - **A esclera clareia o rosto até o branco** quando o olho é escuro: conferir a exposição pela pele (L* 24–72) e o
    tom pela faixa de pele.
  - **A luz da foto** sai pela média local da pele.
  - **A linha no alto da cabeça** era a costura da UV (os dois lados com tons diferentes) + a borda escura das ilhas
    da textura base + normais não soldadas na malha: as três corrigidas.
  **Patrocínios na versão de teste** (22/10; contrato "Patrocínios nas camisas reais" no `CONTRATOS.md`): só na edição
  pro, com as camisas reais — 20 clubes, 161 logos (máscaras 512 × 256 em `assets/tm/patrocinios/`, índice
  `assets/tm/patrocinios.json`, gerados por `tools/patrocinios/gerar.mjs` a partir da pesquisa com as fontes), decalques
  planos no espaço de repouso no shader (`render/humano3d.js`; peito, ombro, manga, barra, número, calção, fornecedor).
  Para TIRAR: apagar o índice e a pasta. Testes: `teste-patrocinios` (Node) e `teste-corpo-tela` C6/C7.
- Testes da Etapa 1 (Node, `node golaco/tools/rodar-testes.mjs`, ~30 s): bola, determinismo, entrada/zona morta,
  laço, resposta (≤ 0,1 s), condução (16 cenas + 4), cortes/giro/puxada, perda (60 s × 20 sementes), patinação,
  domínio, proteção, dribles. Navegador (`golaco/tools/`): `teste-carga.mjs` (erros, download ≤ 4 MB, hash Node =
  Chromium), `prints.mjs`. O Chromium headless daqui não passa pelo proxy: `tools/lib/navegador.mjs` serve o CDN de
  um cache baixado com curl.

## GOLAÇO antigo (`futebol3d/`) — futebol 3D (fila PARADA; publicado como reserva — o TM usa o `golaco/` desde 15/10)
- three.js 0.170 por importmap (jsdelivr), ES modules, **sem etapa de build**.
- Identidade visual: **preto e verde**.
- Contratos entre módulos: `futebol3d/tools/CONTRACTS.md`; constantes em `js/config.js`.
  Coordenadas: x = comprimento (±52,5), z = largura (±34), y para cima;
  heading h → (cos h, 0, sin h).
- Lógica de jogo (`ball.js`, `match.js`, `ai.js`, `gk.js`, `human.js`, `player.js`, `anim.js`)
  **não pode depender de three.js/DOM** — roda nos testes em Node.
- `anim.js` é função pura do estado (o replay depende disso).
- Desempenho: jogadores e torcida instanciados; poucos draw calls; qualidade `baixa` tem
  que rodar em celular médio.
- Pasta `tools/` não vai para o site.
- **Foi o motor 3D do Total Match até 15/10** (hoje é o `golaco/`; o pedido v2 mantém os campos da v1 que ele lê).
  Histórico (dono, 09/10: "juntar tudo no Total Match"; o menu e os 8 clubes não aparecem mais
  ao público): o TM abre `futebol3d/index.html?tm=<id>` num quadro e o resultado volta para ele (`js/ponte-tm.js`; lado
  do TM em `legacy-total-match/js/tm3d.js`). **Sem `?tm` o endereço leva ao Total Match** — para abrir o menu antigo
  (desenvolvimento, links de teste para o dono) use `futebol3d/index.html?golaco`; os testes automatizados (navigator.webdriver)
  continuam abrindo o menu. Na partida do TM: titulares encaixados nas vagas pela prancheta do TM (método húngaro),
  times de fora por `teams.js` registerTeam, pausa com "Simular o resto" (sem Reiniciar/Sair) e "Controlar só o meu
  jogador" (Rumo ao Estrelato: troca bloqueada, câmera Pro, bola parada/goleiro com a IA). Mexeu em main.js/menus.js/
  teams.js? Rodar também `node legacy-total-match/ferramentas/testar-3d.mjs` (TM + 3D de ponta a ponta).
- **Visual = a cara do Total Match** (dono, 09/10: "deixa os botões, menu, tudo com a cara do total match"):
  `css/tm.css`, carregado por ÚLTIMO, troca a aparência de menus/pausa/configurações, HUD (placar com o logo TM,
  faixas, gol, cartão, escalação), controles de toque e carregamento — Inter, preto #050807 + verde #22c55e, botão
  principal em pílula com degradê verde, cartões arredondados com borda fina; nada itálico/inclinado/condensado e
  nada de emoji como ícone. Fontes locais em `assets/fontes` (Inter; Barlow Condensed só nos números das camisas e
  letras dos escudos), logo em `assets/tm-logo.png`. Peça nova de interface: usar as variáveis `--tm-*` desse arquivo.

- Rostos: fotos de pessoas que não existem (`assets/rostos/`, montado por `tools/rostos/processar.py`;
  retratos por IA em `tools/rostos/brutos/gNN.png` + banco SFHQ CC0) projetadas na cabeça escaneada
  (`assets/cabeca/`, só a forma; `tools/rostos/cabeca.py`). Pedido para o ChatGPT gerar os lotes:
  `tools/rostos/pedido-chatgpt.txt` → imagens na pasta do Drive "GOLAÇO – rostos" → copiar para
  `brutos/` como `gNN.png` e rodar `processar.py`.
- Jogador realista: `assets/jogador/corpo.{json,bin}` gerado por `tools/humano/rig.py` (corpo dos
  Human Base Meshes do Blender Studio, CC0, exportado por `tools/humano/exportar.py` com bpy; cabeça
  com a forma do escaneamento Lee Perry-Smith, CC BY 3.0). Deformado por 17 ossos no shader
  (`players3d.js`, BODY_SKIN); a malha procedural antiga só entra se o arquivo faltar.
- Condução SEM ímã (auditoria Fase 2; `match.js` controlBall/dribbleTouch): entre os toques a bola é física
  pura. No toque, o impulso é calculado pela rolagem de ball.js (`rollSpeedFor`) para a bola chegar ao pé
  no próximo toque, prevendo o caminho do próprio jogador com `integrate` (apoio, giro, aceleração). Modos:
  fase (n passadas), ajuste, arranque, giro (corte), amortece (domínio), arraste (sola). Entre toques o
  condutor "monta" na bola (`human.js` keepBall, também para a IA); em plena arrancada, um toque por passada.
  Medir: `tools/ima-test.mjs` (duas partidas; 0% de ímã, ~0,5 m correndo, p95 ≤ ~1,2 m na arrancada),
  `tools/keepball-test.mjs`, `tools/protecao-test.mjs`.
- Condução organizada (dono, 09/10: "melhorou, mas tá muito desorganizada"): na curva o toque manda a bola PELA curva
  (`match.js` dribbleTouch prevê o giro do analógico, `p.intentW` medido em `human.js` keepBall) e o corpo do jogador
  controlado segue o rumo pedido com a bola no caminho (só vai buscá-la fora de ~35° do rumo); em arrancada na curva ele
  tira o pé (~3,2 m/s² de lado com a bola). Medir: `tools/conducao-org-test.mjs` (publicado: o rumo oscilava 60–100°/s
  numa curva pedida de 30°/s, cortes sem pedir, bola até ~0,5 m fora do caminho). Pendente: o vai-e-volta da condução
  da IA (rumo pedido inverte ~25×/min, o corpo ~35–40×/min; tentativas de suavizar o rumo da IA derrubaram o ataque).
- Rostos encaixados por 478 pontos (MediaPipe) nos marcos da cabeça 3D (`tools/rostos/marcos_cabeca.py`
  → `cabeca-marcos.json`; `processar.py` deforma cada foto por triângulos e tira a luz lateral).
- Corrida/caminhada por captura de movimento (CMU, uso livre): `assets/mocap/locomocao.json`, gerado por
  `tools/mocap/retarget.py`; `anim.js` mistura pela fase da passada (`s.stride` em ciclos). Pés travados por
  IK no apoio (passada procedural sem patinar; a captura só no meio do balanço e só até ~6 m/s — acima é
  passada por comprimento conforme a velocidade). Medir: `tools/patinacao-test.mjs` (< 0,05 m/s),
  `tools/inclinacao-test.mjs` (tronco pela aceleração, `pose.acc`), `tools/giro-test.mjs` (180° ≤ 0,25 m).

- Desempenho: torcida em 16 setores por anel com recorte pela câmera e malha leve ao longe
  (`stadium-crowd.js`, updateLOD); jogadores em alta/ultra com malha detalhada só para quem aparece
  grande na tela (`players3d.js`, lodUpdate). Painel `?perf` no link (ou F3): FPS, 1% pior, CPU/GPU ms,
  draw calls, triângulos. Medir com `tools/perf-bench.mjs` (antes/depois) e `tools/lod-check.mjs` (prints).

- Jogabilidade (medidas): condução `tools/drible-medida.mjs` (alvo ~0,45 m correndo / ~0,6 m arrancada);
  dividida `tools/dividida-test.mjs`; primeira `tools/primeira-test.mjs`; agilidade `tools/agilidade.mjs`;
  chutes/gols por distância `tools/chutes-mapa.mjs`; equilíbrio `tools/equilibrio-test.mjs 24 --par 4`
  (auditoria Fase 3, configurações PADRÃO = tempos de 4 min, como a auditoria mediu: 2,3–3,5 gols/partida,
  conversão 9–14%, passe 75–88%, ≥ 1 impedimento/partida; 24 partidas variam ±0,4 gol e ±1,7 ponto de
  conversão entre execuções (8 rodadas medidas: ~1 em 4 reprova por sorteio) — para calibrar use 192; `--base pasta` mede outra versão); linha de defesa
  `tools/linha-test.mjs` (alinhada, acompanha a bola, sobe em bloco); espalmada para escanteio nunca entra
  `tools/espalmada-test.mjs`; diagnósticos `tools/chutes-diag.mjs` e `tools/passes-diag.mjs`;
  proteção `tools/protecao-test.mjs`; contato de corpo
  `tools/contato-test.mjs`; fadiga `tools/fadiga.mjs`.
- Especificação "Master Gameplay & Visual Spec" (dono): fases A–F feitas. A posse/proteção/primeiro toque/giro/
  0,93×/troca direcional; B fadiga em 2 camadas, contato por massa/força/equilíbrio, antecipação; C IA em
  `js/tactics.js` (intensidade contextual, utilidade por função, traços de personalidade — `tools/intensidade-test.mjs`);
  D modos (`MODES` em config.js) e controles de toque ajustáveis (tamanho/transparência/editor de posição,
  tocar no jogador); E cantos por setor `js/chants.js` (`tools/cantos-test.mjs`) + áudio espacial (PannerNode
  por setor e na bola); F clima (`WEATHER`, `ball.js` SURFACE, `js/rain.js`, `tools/clima-test.mjs`), câmera TV
  adaptativa (camera.js), preset gráfico Competitivo. Atributos detalhados em `teams.js` (detailAttrs).
  Celular: 4 botões (+ DIVIDIDA na defesa) e gestos — conferir com `tools/gesture-test.mjs`.

- Auditoria "reforma com provas obrigatórias" (dono): fases 1–5, uma de cada vez, cada item com teste que
  REPROVA antes e passa depois, tabela antes→depois, prints com torcida+HUD e vídeos MP4 de ≥20 s gravados
  quadro a quadro com relógio controlado (`tools/pump.mjs`: `__pump.on()`/`step(ms)`). Ferramentas:
  `tools/fase1-test.mjs` (bola interpolada a 60/120/144 Hz, zona morta radial, tremor por tempo),
  `tools/piscada-test.mjs` (300 quadros a 30 qps forçando a resolução dinâmica; reprova com canvas apagado
  ou quadro vazio), `tools/gravar.mjs --cena tv|cel|dia|noite` (vídeos), `tools/prints-fase.mjs` (PC Alta
  1280×720 e celular 844×390 dpr2 Média, dia/noite + close do rosto). Fase 1 feita (piscada, interpolação,
  analógico, tremor). Fase 2 (movimento): `patinacao-test`, `giro-test`, `inclinacao-test`,
  `velocidades-test` (IA longe da jogada anda/trota: ≥35% < 7 km/h, ≤5% > 25 km/h; `ai.js` shapeMove),
  `ima-test`; vídeos de movimento `tools/cenas.mjs --cena a|b|c`. Fase 3 (jogabilidade, IA em `ai.js`/`gk.js`):
  linha de 4 por zona que sobe em bloco, atacante na linha com erro de tempo na corrida, Regra 11 (impedido
  que disputa a bola), linha de impedimento desenhada (`js/offside-line.js`); goleiro por dificuldade,
  espalmada para escanteio (`parryOut`) e rebote na área; chute de média distância, finalização de primeira,
  cruzamento com ataque à área, pressão alta, decisão mais rápida no último terço; passe com risco por zona.
  Vídeo de lance natural IA×IA com semente (nada roteirizado): `tools/lance-clip.mjs --evento impedimento|defesa|espalmada`.
- Pedidos do dono de 08/10 (PR depois da Fase 3): botão GOLEIRO na defesa (`gk.js` gkRush; `human.js` userGKRush; tecla G/Y;
  `tools/goleiro-sai-test.mjs`, `tools/goleiro-botao-test.mjs` no celular, vídeo `tools/goleiro-clip.mjs`; contra o botão o
  atacante da IA segue com a bola em vez de bater logo — `ai.js` contraBotao, só contra o humano, IA×IA não muda); bolas paradas
  (`ai.js` alvosBolaParada/setpieceAI: tiro de meta com o adversário fora da área do começo ao fim da cobrança — Regra 16, `match.js` regra16: quem está na área
  vai para fora na montagem, com corte de câmera, e ninguém entra até a bola rolar, nem o humano; `tools/tiro-de-meta-test.mjs`;
  a IA espera os zagueiros abrirem e só o time de pressão alta (estilo ≥ 0,7) põe os atacantes na beira da área — com todos
  prontos ali a saída curta era roubada bem mais que na versão antiga; medir a saída com o painel, linha "após tiro de meta" —,
  lateral com 3 opções, escanteio
  com zona + individual; `match.js` handsPoint: a bola fica NAS mãos no lateral e com o goleiro; `tools/bola-parada-test.mjs`,
  prints `tools/bola-parada-prints.mjs`); disputa pelo alto perto das áreas (`ai.js` pontoAereo, `match.js` doHeader com duelo
  por altura/impulsão/força; `tools/disputa-aerea-test.mjs`); dividida que vale de lado (perna sai do quadril; `match.js`
  ajustaBote; `tools/dividida-test.mjs --alvo` e `--natural --alvo`); troca automática NO PASSE do adversário e com o marcador
  batido (`human.js` autoSwitch; `tools/troca-auto-test.mjs`); intensidade enxuta (bloco estreito pela forma, meio sobe 2 m e
  ataque recua 4 m, 1º marcador arranca a 3 m; a pressão a dois nos gatilhos saiu — custava ~1 chute por partida;
  `tools/intensidade-jogo-test.mjs`); goleiro na bissetriz e IA mirando
  longe dele, chute de longe menos preciso (`tools/defesas-test.mjs`: ~67% de defesas, ~2/3 espalmadas). Equilíbrio recalibrado
  com tudo isso (versão realista entregue, 8 rodadas = 192 partidas: 2,48 gols, 10,5%, 77,1% de passe, 1,75
  impedimento; o de 24 reprova ~1 em 3 por sorteio — falta volume de ataque, ver a fila). Bola parada com o time todo
  atordoado não trava mais (`tools/cobrador-test.mjs`). `tools/fase1-test.mjs` espera a bola rolar antes de medir a
  interpolação (com falta/lateral logo no começo, ~15% das partidas, reprovava por sorteio).

### Testes (rodar antes de todo commit do futebol3d)
```bash
cd futebol3d
node tools/test-ball.mjs && node tools/sim-test.mjs 3 none && node tools/sim-test.mjs 3 home \
  && node tools/shootout-test.mjs && node tools/pen-test.mjs && node tools/offside-test.mjs \
  && node tools/tournament-test.mjs && node tools/troca-test.mjs
# Fase 1 da auditoria (navegador): node tools/fase1-test.mjs && node tools/piscada-test.mjs
# Fase 2 (Node): node tools/patinacao-test.mjs && node tools/giro-test.mjs && node tools/inclinacao-test.mjs \
#   && node tools/velocidades-test.mjs 3 && node tools/ima-test.mjs 600
# Fase 3 (Node): node tools/equilibrio-test.mjs 24 --par 4 && node tools/linha-test.mjs && node tools/espalmada-test.mjs
# Pedidos de 08/10 (Node): node tools/dividida-test.mjs 200 --alvo && node tools/dividida-test.mjs 400 --natural --alvo \
#   && node tools/troca-auto-test.mjs && node tools/intensidade-jogo-test.mjs && node tools/defesas-test.mjs 36 --par 3 \
#   && node tools/goleiro-sai-test.mjs && node tools/bola-parada-test.mjs && node tools/disputa-aerea-test.mjs \
#   && node tools/cobrador-test.mjs && node tools/conducao-org-test.mjs && node tools/tiro-de-meta-test.mjs
#   (navegador, celular: node tools/goleiro-botao-test.mjs)
# navegador (servidor: python3 -m http.server 8790 em futebol3d/):
node tools/load-check.mjs && node tools/game-shot.mjs --advance 20
```
O Chromium headless não passa pelo proxy: os testes usam `tools/cdn-route.mjs`
(cache via curl) para o jsdelivr e o Google Fonts.

## TOTAL MATCH (`legacy-total-match/`) — jogo de gestão (JS puro, sem build)
- Identidade **verde e preto, profissional, sem emoji** (pedido do dono): emoji NÃO é ícone. O
  conversor de `js/icones.js` troca qualquer emoji da interface pelo ícone (Lucide, ISC) ou tira;
  emoji só fica em conteúdo (post, comentário, chat — `MANTER`). Para mudar o mapa:
  `ferramentas/gerar-icones.py`. Ícone direto no código: `TM.ic("nome")`.
- Fonte Inter em `assets/fontes/` (OFL). Cores pelas variáveis de `:root` em `css/styles.css`
  (`--gold*` = verde da marca; `--ok/--erro/--alerta` só para estado).
- **Cenas com a cara do jogo**: recortes das capas dos modos (artes do dono, originais em
  `ferramentas/capas-originais/`) feitos por `ferramentas/gerar-cenas.py` → `b-*.jpg`, só no topo das telas
  (`js/cenas.js`, `TOPO`). **Todos os atalhos (menu "Mais modos", início da carreira, "Todas as seções") ficam
  com ícone + nome** — o dono não gostou das mini imagens neles e pediu o jeito de antes (sem emoji).
  Pôsteres: próximo jogo no início da carreira (`TM.coachUI.posterJogo`) e fim de jogo nas telas de resultado
  (`TM.ui.posterFim`).
- **Cartas do Total Ultimate** (`ultimate.js` cardEl, CSS "A CARTA (Total Match)"): estilo da referência do
  dono — moldura chanfrada e brilho na cor da raridade (Base = bronze, Elite = prata, Craque = ouro, Lenda =
  **verde**; versões especiais com cor própria), nota/nome em Barlow Condensed (`assets/fontes`, OFL), faixa com
  bandeira (`assets/bandeiras`, flag-icons MIT, `ferramentas/gerar-bandeiras.mjs`) e escudo, triângulos e marca
  TM (`assets/cartas`, `ferramentas/gerar-cartas.py`), silhueta quando o jogador não tem foto real.
- **Modo claro vale também na tela inicial** (vitrine; bloco "MENU no tema claro" no CSS). **Avisos**
  (`TM.ui.toast(msg, tipo?)`) aparecem no MEIO da tela, um por vez, com selo ok/erro/alerta — o dono não quer
  aviso escondido lá embaixo.
- **Rumo ao Estrelato — mercado** (`js/rae-mercado.js`, estado em `c.mercado`; ganchos em `rae.js`: `aposRodada`
  no fim de cada jogo, cartão "Seu futuro" no centro, travas no fim de temporada/sem clube): temporada com fim
  (`(clubes-1)*2` rodadas, 30–38) e 2 janelas (4 primeiras rodadas e meio); olheiros/rumores; empresário com
  estilo; propostas de compra/empréstimo/fim de contrato/renovação com negociação; clube pode segurar (pedir para
  sair = −15 de confiança); apresentação em 5 passos (exames, assinatura, camisa, coletiva, boas-vindas);
  trajetória. O clube mais fraco do jogo tem força ~62: a faixa de clubes alarga até ter opções.
- **Total Ultimate 2.0** (pedido do dono: "algo profissional, nível muito maior", inspirado no Ultimate Team atual):
  núcleo em `js/ultimate.js` (cartas, química, pacotes, loja, escalação, clube) + módulos que conversam pela API interna
  `TM.ut._i` e pelos eventos `TM.ut._i.on/emit` ("partida", "pacote", "venda", "compra", "dme", "item", "evolucao",
  "divisao", "nivel"): `ut-modos.js` (executor de partida, elencos CPU, Rivais com prêmios da semana, Batalhas de Elenco,
  Champions, recompensas e escolha de jogador), `ut-temporada.js` (passe de 40 níveis + objetivos diários/semanais/
  temporada/Fundamentos), `ut-dme.js` (DME por categorias, melhorias repetíveis, DME de jogador, "montar com as mais
  baratas"), `ut-draft.js`, `ut-evolucoes.js`, `ut-mercado.js` (leilão, observação, lista de transferências).
  **Química** do modelo atual: 0–3 por jogador, 33 no time; clube 2/4/7, liga 3/5/8, país 2/5/8 (Pitch Notes da EA); fora de posição = 0;
  posições alternativas fixas por jogador; Ícone/Herói entram com 3 (Ícone: 2 no país e 1 em cada liga; Herói: 2 na liga). **Nota da equipe** com a correção de quem está acima
  da média (`notaEquipe`). Escudo do clube é desenhado (forma + símbolo + sigla), sem emoji. Teste de ponta a ponta:
  `node ferramentas/testar-ultimate.mjs http://localhost:8207 <pasta>` (servidor na pasta do jogo).
- **Nada sobre nada** (pedido do dono): nenhum botão/cartão pode encostar em outro nem ficar cortado na borda, em
  celular, tablet e PC. Tela de início: celular = carrossel com vão fixo (ui.js `geo`/`poe`); >= 760 px = os 7 modos
  lado a lado (grade, `.vit-palco.grade`). Campos de escalação usam `separaCampo` (afasta cartas que encostariam);
  "fora de posição" fica DENTRO da carta (`.ut-card.fora`). Conferir com `node ferramentas/testar-sobreposicao.mjs <pasta> [rota]`
  (7 larguras; tem que dar 0).
- Antes de publicar: `python3 ferramentas/conferir-estilos.py` (botão sem estilo = visual padrão do
  navegador) e versão nova em `index.html` (`?v=NNN`) + `sw.js` (`total-match-vNNN`).
- **Viverde FC** (dono, 15/10; `js/viverde.js`): time especial nas duas edições, com o elenco do dono (17 jogadores; posições
  declaradas sem perder nota — `posicoes`/`notaPos`/`todas`, lidas em `competitions.js`), no jogo rápido (seção "Especiais"
  do seletor) e na carreira (botão na entrada da Master League; entra no lugar de um clube da liga — customClub com
  `fixo: "viverde"`). Para jogar com ele: SENHA (só o SHA-256 no código; nunca escrever a senha em arquivo/commit; o aparelho
  lembra). O clube do jogo rápido fica fora das ligas, do mercado e das convocações (`especial`). Escudo provisório em
  `assets/viverde/escudo.svg` até a logo do dono chegar.
- **Partidas em 3D** (`js/tm3d.js`; dono, 09/10: o GOLAÇO vira o motor 3D do TM, tudo num jogo só; 15/10: o motor passa a
  ser o GOLAÇO NOVO, `golaco/`): antes de toda partida do seu time (matchview com `pauseSide`) aparece Jogar em 3D / Simular
  (Config → "Partidas do seu time": Perguntar / Sempre 3D / Sempre simular; só com WebGL 2). O 3D (`golaco/index.html?tm=<id>`,
  mesmo site e mesmo localStorage) recebe o pedido v2: os dois times com 18 jogadores, a vaga de cada titular na prancheta,
  os uniformes do TM (inclusive o do pré-jogo da carreira) e a identidade de cada time (`identidade`: o MESMO escudo do
  `TM.img.clubImg/nationImg` em endereço absoluto — Ultimate: `TM.ut._i.escudoSvg`, o escudo desenhado —, bandeira, liga,
  técnico, estádio com nome/capacidade/foto) e a `partida` (neutro, público, clássico, pelo `cfg.simOpts`). Devolve placar,
  gols (autor, minuto, pênalti, contra, assistência), cartões e estatísticas, aplicados no MESMO `result` — o modo segue o
  fluxo normal (pênaltis/prorrogação continuam no TM). Rumo ao Estrelato: titular joga controlando só o próprio jogador
  (`rae.js` preparaPartida/timesDaPartida; nota, gols e assistências vêm do 3D). O service worker não guarda nada de
  `golaco/` nem de `futebol3d/`. Teste de ponta a ponta: `node ferramentas/testar-3d.mjs` (como montar o site no topo do
  arquivo; `--publica` para a edição pública).
  Modos só em 3D em "Mais modos": **Pênaltis 3D** (`js/penaltis3d.js`, `jogarPenaltis`, o resultado com as cobranças) e
  **Modo Livre 3D** (`js/livre3d.js`, `jogarLivre`, treino N contra M que não conta em nada); os dois com o seletor do jogo
  rápido (Viverde em Especiais, com a senha). Testes: `ferramentas/testar-penaltis.mjs` e `ferramentas/testar-livre.mjs`.
  **Online 3D** (`js/online3d.js`, `jogarOnline`; dono, 16/10): sala privada por código/link (`?online3d=`), o anfitrião
  aceita ou recusa, cada um escolhe o SEU time, o anfitrião monta o pedido `modo: "online"`, só o anfitrião grava h2h e
  ranking, sair no meio = W.O. (fair play). Teste `ferramentas/testar-online3d.mjs [--golaco]`.

## LANCE A LANCE (`simulador/`) — simulador de partidas (a "bolinha")
- Canvas 2D, ES modules, **sem build e sem dependências externas**. Identidade: grafite + verde-limão.
- `js/engine.js` (motor), `teams.js`, `league.js`, `rng.js`, `commentary.js` **não podem depender de DOM** —
  rodam nos testes em Node. Motor determinístico: toda aleatoriedade pelo RNG com semente.
- Coordenadas: x = comprimento (±52,5), y = largura (±34); cada time tem `dir` ±1 (u = x·dir).
- Ao mexer no motor, rodar `node tools/stats-report.mjs 200` e comparar com a tabela do README.

### Testes (rodar antes de todo commit do simulador)
```bash
cd simulador
node tools/engine-test.mjs
# navegador (servidor: python3 -m http.server 8791 em simulador/):
node tools/ui-shot.mjs --out /tmp/lal && node tools/e2e.mjs
```
