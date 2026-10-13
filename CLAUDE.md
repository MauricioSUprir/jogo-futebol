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
  As filas antigas do `futebol3d/` (abaixo) ficam PARADAS; o `futebol3d/` continua publicado e intocado porque o
  Total Match usa ele nas partidas 3D, até o dono decidir aposentá-lo. Não copiar nem ler código do `futebol3d/`
  para o projeto novo.
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
  não publica.
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
  `main.js`, `hud.js`, as telas `editor-time.js`/`escalacao-tela.js`/`prejogo-tela.js` e `js/render/`) **sem three.js nem DOM**. Passo fixo 1/60 s + desenho interpolado (`laco.js`).
  Aleatoriedade só por `rng.js` (sfc32 com semente no mundo); mesma semente = mesmo hash (`hashMundo`). Pose =
  função pura do estado (`anim.js`). Contratos em `golaco/CONTRATOS.md`, constantes em `golaco/js/config.js`.
  Coordenadas: x = comprimento (±52,5), z = largura (±34), y para cima, rumo h → (cos h, 0, sin h).
- Condução (Etapa 1, `js/conducao.js`): sem ímã — o toque calcula a velocidade da bola pela MESMA conta da rolagem
  (`bola.js` velParaDistancia, exata) para chegar ao ponto do pé no próximo toque, prevendo o próprio corpo com a
  mesma função de locomoção (`jogador.js` passoCorpo). Toque sincronizado com a passada (pé de apoio no chão), um
  por passada correndo, a cada passo na condução curta/proteção/freada forte; checagem de ultrapassagem (o corpo
  nunca passa por cima da bola) e de folga máxima (≤ 0,8 m); corte = a bola sai na linha do analógico (±20°) com o
  corpo segurando o rumo até o toque; domínio pela linha do analógico com erro por atributo/velocidade/pressão;
  proteção = o corpo gira em volta da bola, de costas para o marcador.
- Etapa 2 (`js/acoes.js`, `goleiro.js`, `ia.js`, `sessao.js` modo 'ataque'): botões carregam força e soltam pedido
  (`j.carga`/`j.pedido`, mira guardada em `j.mira`); toque de ação no pé livre; troca de controle SEMPRE por
  `assumirControle` (carga/pedido vão junto; TROCAR pela borda do time e nunca com a bola no pé). Números da
  pesquisa em `golaco/PESQUISA-ETAPA2.md` (StatsBomb: tempos de passe, logística de defesa do goleiro, cruzamento;
  biomecânica de chute, mergulho e cabeceio). Testes: `teste-passes`, `teste-chutes`, `teste-goleiro` (canhão de
  bolas ±10 pontos da logística), `teste-aereo`, `teste-treino` (treino com a IA não trava), `teste-recomeco`;
  `teste-patinacao` mede também o treino de ataque (10 jogadores). Pendências para o dono: corte de 90° a ~7 m/s em
  2–3 apoios (PESQUISA pede 3–5); tornozelo do pé que toca até a bola p95 0,33 m (meta ≤ 0,30, só `--estrito`);
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
  (`pressionadorVisivel`); goleiro (`regras-goleiro.js`, IFAB 12.2/12.3/16): mão só na própria área, sem recuo (o
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
- Testes da Etapa 1 (Node, `node golaco/tools/rodar-testes.mjs`, ~30 s): bola, determinismo, entrada/zona morta,
  laço, resposta (≤ 0,1 s), condução (16 cenas + 4), cortes/giro/puxada, perda (60 s × 20 sementes), patinação,
  domínio, proteção, dribles. Navegador (`golaco/tools/`): `teste-carga.mjs` (erros, download ≤ 4 MB, hash Node =
  Chromium), `prints.mjs`. O Chromium headless daqui não passa pelo proxy: `tools/lib/navegador.mjs` serve o CDN de
  um cache baixado com curl.

## GOLAÇO antigo (`futebol3d/`) — futebol 3D (fila PARADA; segue publicado para o Total Match)
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
- **É o motor 3D do Total Match** (dono, 09/10: "juntar tudo no Total Match"; o menu e os 8 clubes não aparecem mais
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
- **Partidas em 3D** (`js/tm3d.js`; dono, 09/10: o GOLAÇO vira o motor 3D do TM, tudo num jogo só): antes de toda
  partida do seu time (matchview com `pauseSide`) aparece Jogar em 3D / Simular (Config → "Partidas do seu time":
  Perguntar / Sempre 3D / Sempre simular). O 3D (`futebol3d/`, mesmo site e mesmo localStorage) recebe os dois times
  com 18 jogadores, a vaga de cada titular na prancheta, os uniformes do TM (inclusive o do pré-jogo da carreira) e
  devolve placar, gols (autor, minuto, pênalti, contra), cartões e estatísticas, aplicados no MESMO `result` — o modo
  segue o fluxo normal (pênaltis/prorrogação continuam no TM). Rumo ao Estrelato: titular joga controlando só o
  próprio jogador (`rae.js` preparaPartida/timesDaPartida; nota, gols e assistências vêm do 3D). O service worker não
  guarda nada de `futebol3d/`. Teste de ponta a ponta: `node ferramentas/testar-3d.mjs` (como montar o site no topo do arquivo).

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
