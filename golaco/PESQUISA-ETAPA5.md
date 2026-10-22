# Pesquisa da Etapa 5 — corpo, rosto e mocap (22/10)

Juntado das 5 pesquisas da sessão de 22/10 (código do jogo, corpo, rosto, desempenho, mocap) e do plano em PRs que saiu
delas. Os caminhos `$E/...` eram da pasta de rascunho da sessão (não estão no repositório); o que virou ferramenta está em
`golaco/tools/humano/`. O que foi aproveitado de cada fonte está dito em cada seção.

O que JÁ entrou (5.1, `?corpo=humano`): o corpo Rocketbox `Sports_Male_02` (MIT) encaixado nas medidas do jogo
(`tools/humano/encaixar.py`), os 25 ossos do desenho a partir das juntas (`js/render/esqueleto.js`, a v3 do protótipo da
seção "Desempenho" com o ombro, o cotovelo e o tornozelo do desenho), 4 níveis de detalhe (`js/render/lod-humano.js`), a
pele na GPU (`js/render/humano3d.js`) e o uniforme pintado por região (`tools/humano/regioes.py`). Diferenças medidas em
relação ao plano: o tornozelo apoiado do jogo fica a 8 cm (não 10,2), o "ombro" do jogo fica ~4,5 cm acima da articulação
(o desenho desce o ombro, e a queda some com o braço erguido — sem isso o braço esticava e a torção virava), o pé é
rígido com o referencial da sola (o balanço da canela enterrava a borda da sola) e a `config.js` está no fecho do hash
(as constantes do corpo ficam no `repouso` do `assets/jogador/corpo.json`).


---

## Plano da Etapa 5 do GOLAÇO: corpo, rosto e mocap

Data: 22/10. Base: as 5 pesquisas desta pasta (`codigo.md`, `corpo.md`, `rosto.md`, `desempenho.md`, `mocap.md`), conferidas
no repositório (`main` em `f2b84c6c`). Nada do `futebol3d/` foi lido. Pasta: `$E` =
`$E`.

## 0. Resumo

- **Corpo:** Microsoft Rocketbox `Sports_Male_02` (MIT). Já é um jogador de futebol, com camisa, calção, meião e
  chuteira modelados, pesos prontos e cabeça realista.
  - O esqueleto fica com 22 ossos mais 6 ajudantes de dobra, encaixado offline nas medidas do `anim.js` (pernas +12%).
  - O uniforme é pintado no shader por região, com as cores do `KITS` e da identidade do TM.
  - O desenho é instanciado, com a pele na GPU lendo os ossos de uma `DataTexture` (1 chamada por LOD).
  - São 4 LODs pela altura na tela.
- **Rosto:** retratos de pessoas FICTÍCIAS do SFHQ-T2I, só das imagens do FLUX.1-schnell (Apache) e do SDXL (OpenRAIL++).
  - O banco tem 256 rostos em 6 faixas de tom.
  - Cada retrato é levado à UV da cabeça do Rocketbox pelos 478 marcos do MediaPipe, achados no retrato e num render da
    própria cabeça.
  - Tira-se a luz da foto, o tom passa para o corpo e um degradê esconde a emenda.
  - No jogo, uma `DataArrayTexture` sob demanda (1 chamada para todas as cabeças).
  - Cabelos de malha num `BatchedMesh`.
- **Mocap:** uma camada pura só no desenho, lida pela fase da passada (CMU, Rocketbox e 100STYLE). Pernas e pés continuam
  sendo da simulação. Depois vêm os clipes nas cenas e a "pose estendida" (olhar, palma, rolagem do pé).
- **Regra de ouro:** nenhum PR toca o FECHO DO HASH, ou seja, os módulos que a simulação carrega (`anim.js` incluído).
  - É conferido por uma ferramenta nova (`tools/fecho-hash.mjs`), além de `hash-igual`/`hash-partida --ref origin/main`
    e do item 5 do `teste-carga`.
  - Tudo que não desenha o 1º quadro entra sob demanda: o download inicial continua em ~2,57 MB.
- **O corpo novo fica atrás da chave `?corpo=humano` até o rosto e o cabelo chegarem (PR 5.2b).** Antes disso o padrão
  continua sendo o manequim: nenhuma entrega publicada fica com cara pior (cabeça realista sem rosto em close é pior que
  o manequim).
- **10 PRs, ~73–103 h de agente mais o CI:** 5.1a–c (corpo), 5.2a–c (rosto e cabelo), 5.3a–d (mocap).

## 1. Regras que valem em TODO PR da Etapa 5

### 1.1 Só desenho: a receita da prova (vai no corpo de todo PR)

```bash
cd /home/user/jogo-futebol/golaco
node tools/fecho-hash.mjs --diff origin/main        # NOVO (5.1a): 0 arquivo do fecho do hash tocado
node tools/hash-igual.mjs --ref origin/main          # treino: IGUAL (o padrão 980b0b0 está velho: sempre --ref)
node tools/hash-partida.mjs --ref origin/main        # partida demo e humano: IGUAL
node tools/teste-carga.mjs                           # item 5: o mesmo hash no Node e no Chromium; download inicial
node tools/teste-math-proibido.mjs --sementes 1 --min 1   # nenhum módulo novo entrou no passo
```

- O `fecho-hash.mjs` é novo e entra no 5.1a. Ele percorre os `import` a partir dos pontos de entrada da simulação
  (`sim.js`, `partida.js`, `treino.js`, `sessao.js`, `disputa.js`, `livre.js`, `online.js`, `tm-times.js`, ou seja, o que
  `hash-igual`/`hash-partida`/`teste-math-proibido` carregam) e lista o fecho.
  - Com `--diff <ref>` ele cruza essa lista com `git diff --name-only`. Se houver interseção, sai com código 1.
  - Hoje o fecho tem `anim.js`, `jogador.js`, `goleiro.js`, `cabeceio.js` e `tm-times.js`.
  - **Atenção (conferido no código):** o fecho também tem a `comemoracao.js`, porque o `disputa.js` (modo Pênaltis)
    importa `gesto`, `cabeca` e `G_*` dela. **Não mexer na `comemoracao.js`.**
  - Ficam FORA do fecho: `main.js`, `render/*`, `substituicao.js`, `tecnicos.js`, `cortejo.js` e `ponte-tm.js`, que só
    são importados por `main.js`, `render/prejogo.js` e `render/replay-olhos.js`. A ferramenta confere isso a cada PR.
- Pelo CLAUDE.md, a Etapa 5 tem de medir antes → depois resposta, condução, recepção, giro e patinação. Com o fecho
  intacto, os números saem iguais por construção: rodar `teste-resposta`, `teste-conducao`, `teste-recepcao`,
  `teste-cortes` e `teste-patinacao` com `--js` da base e do PR e pôr os números lado a lado no PR (modo enxuto: o CI
  roda o resto).
- Não mexer em `RAIO_CABECA`, `NJ` do `anim.js`, `SEGMENTOS`/`RAIO_PARTE` (impedimento) nem `maoAlcanca`. A física usa
  todos eles.

### 1.2 Orçamento (celular 844×390 Média, a régua; PC 1280×720 Alta ao lado)

| Medida | Hoje (medido) | Teto da Etapa 5 | Quem cobra |
|---|---|---|---|
| Chamadas de cor, TV do jogo (celular) | 28 (jogadores: 4) | **≤ 27** (jogadores: LOD3 + mancha = 2) | `teste-corpo-tela` C1 (novo) |
| Chamadas de SOMBRA, TV do jogo | 3 (o `renderer.info` não conta) | **≤ 2** | contador de `draw*` no contexto WebGL (`teste-corpo-tela` C2, novo) |
| Pior plano do pré-jogo (cor) | 35 chamadas / 122 mil tri | **≤ 38 / ≤ 122 mil** (teto absoluto 40 / 130 mil) | `teste-prejogo` 7, `teste-livre-tela` D5 |
| Triângulos dos JOGADORES por quadro | 57 mil na TV (24) · 64 mil no pré-jogo (27) | **teto dinâmico 60 mil na Média** (TV ~22 mil), 120 mil na Alta, 30 mil na Baixa | `lod-humano.js` + `teste-lod-humano` |
| Replay | ≤ máximo ao vivo + 1 | **≤ máximo ao vivo DA MAIN + 1 (29)**. O ao vivo novo cai 2 chamadas, e o close precisa de mais LODs: comparar com a publicada, não com o novo | `teste-replay` (o teto muda de referência, documentado) |
| Técnicos | +0 chamadas, ≤ 2 bonecos | igual. `triangulosPorBoneco` passa a ser a média por boneco desenhado no quadro | `teste-tecnicos-tela` V2 |
| CPU "jogadores" (CPU 4×) | média 0,22–0,53 ms | **≤ +0,5 ms** (protótipo v3: +0,3) | `teste-desempenho-celular` (informativo) + C6 no `teste-corpo-tela` |
| Download inicial | 2,57 MB (folga ~1,4) | **+≤ 3 KB** (só a fachada e a chave) | `teste-carga` |
| VRAM dos rostos | 0 | Média ≤ 18 MB (256² × ≤ 52 camadas + mips), Baixa ≤ 5 MB | `teste-rosto-tela` |

Regras de LOD que seguram o teto:
- No máximo **2 bonecos na LOD0** ao mesmo tempo.
- No máximo **3 LODs não vazias por quadro**: a LOD do meio se junta à de cima. Assim o close fica em LODs + cabelo +
  mancha ≤ 5 chamadas.
- Passou do teto de triângulos, rebaixa os mais distantes primeiro.
- O teto lê a qualidade ATUAL (`aplicarQualidade`), então a queda automática no meio do jogo vale. Hoje a malha é
  escolhida uma vez só.

### 1.3 Carga sob demanda

- **No 1º gesto, ou `SOB_DEMANDA.esperaMs` (8 s) depois do 1º quadro**, num momento ocioso: o mesmo mecanismo do replay
  e do Editar time. Entram:
  - os módulos novos;
  - o corpo (`assets/jogador/*`);
  - os rostos só de quem está na partida;
  - cabelos e mocap.
- Até chegar, desenha o manequim. A troca acontece no próximo corte de câmera, ou em ≤ 1 s.
- O pré-jogo começa com o "Toque para começar" e leva ~10 s até aparecer gente, então chega a tempo.
- Cada arquivo novo vai para o `SOB_DEMANDA_ARQ` do `teste-carga`, que também confere que a pré-carga ociosa trouxe tudo.
- Os testes de tela esperam `__golaco.corpo.pronto`.

### 1.4 Licenças e créditos (como nos sons)

- `assets/jogador/CREDITOS.md`:
  - Rocketbox MIT, com o texto completo, "Copyright (c) 2020 Microsoft" e o commit `0943055db6ec570bcef9f2c8b41c9e5467c808f9`;
  - o que foi derivado: malha encaixada, LODs, máscara de regiões e o detalhe do pano em cinza.
  - **Não se publica a textura de cor original**: ela traz "FYA MOTORS", "ROCKETBOX" e o escudo.
- `assets/rostos/CREDITOS.md` + `manifesto.json`, com a origem de CADA rosto:
  - conjunto, modelo gerador (schnell ou SDXL) e arquivo;
  - as licenças: SFHQ-T2I MIT, FLUX.1-schnell Apache 2.0, SDXL CreativeML OpenRAIL++-M e MediaPipe Apache 2.0 (só nas
    ferramentas).
  - Retrato bruto não vai para o git: o manifesto e o `zip_remoto.py` refazem o download.
- `assets/mocap/CREDITOS.md`:
  - o agradecimento da CMU;
  - o MIT do Rocketbox;
  - "The 100STYLE Dataset - Ian Mason", CC BY 4.0, "modificado: retargetado, reamostrado pela fase, espelhado".
- Vetado: Mixamo, LAFAN1, Bandai Namco, OmniContact, FLUX.1-dev, DALL·E/Flux pro, dlib 68, FFHQ/CelebA, Generated
  Photos, e captura de vídeo de jogador real.

### 1.5 Toda entrega

- Atualizar `CONTRATOS.md`, a seção "Etapa 5" do `CLAUDE.md` e o `PESQUISA-ETAPA5.md` (criado no 5.1a juntando as 5
  pesquisas, com as fontes).
- Teste novo de navegador entra na `LISTA` do `rodar-navegador.mjs`; o tempo de cada teste novo vai para o
  `tools/lib/tempos-ci.mjs`.
- O PR traz a tabela antes → depois.
- Mexeu em `main.js` ou no desenho de gente: rodar também `teste-tm-tela` e `legacy-total-match/ferramentas/testar-3d.mjs`
  (uniformes do TM no corpo novo).
- Prints para conferência própria (PC Alta e celular Média, dia e noite, com torcida e HUD). Não se mandam ao dono.
- Link do Pages fora do artifact. Enquanto a chave estiver ativa, mandar também o link com `?corpo=humano`.

## 2. Decisões técnicas (tomadas; decidir e seguir)

| Tema | Decisão | Por quê |
|---|---|---|
| Modelo | Rocketbox `Sports_Male_02` como corpo ÚNICO de todos: jogadores, goleiros, árbitros, técnicos, cortejo, comemoração, substituição, replay, pênaltis, Livre e online | O único candidato livre que já tem uniforme e chuteira modelados. MakeHuman CC0 fica de reserva para variar o porte |
| Cabeça | A cabeça do próprio `Sports_Male_02` é o MOLDE de todos (opção B do `rosto.md`). O MediaPipe já achou os 478 marcos no render dela (`$E/out/cabeca_marcos.png`) | Não precisa costurar crânio na malha canônica, e o pescoço já casa com o corpo e o esqueleto. Do Rocketbox ficam a forma e o couro cabeludo; a pele do rosto é 100% do retrato fictício |
| Formato do corpo | Contêiner próprio: `corpo.json` (layout) + `corpo.bin` com buffers codificados por meshopt (npm `meshoptimizer`, MIT, na ferramenta), decodificados no jogo pelo `three/addons/libs/meshopt_decoder.module.js` (do próprio three 0.170, ~25 KB, sob demanda) | Sem o `GLTFLoader` (110 KB). ~150 KB contra ~400 KB do `.bin` cru. O mesmo leitor roda em Node, nos testes |
| Esqueleto | 22 ossos: pelve, coluna ×3, pescoço, cabeça, e de cada lado clavícula, braço, antebraço, mão, coxa, canela, pé e dedos. Mais 6 ajudantes de meio-giro (joelhos, cotovelos, quadris) com os pesos redistribuídos offline numa faixa de ±6 cm da junta | LBS com ajudantes segura o volume da dobra. DQS fica de reserva |
| Encaixe | Offline, no bpy: o comprimento de cada osso do descanso = o do `anim.js` (coxa e canela 0,45, braço 0,29, antebraço 0,26, coluna 0,17/0,22/0,13/0,13, quadris 0,18, ombros 0,38), lido de uma pose de pé gerada pelo próprio `anim.js` (`tools/humano/repouso-do-jogo.mjs`) | O pé desenhado cai no ponto plantado. Junta `mao` do jogo = punho da malha |
| Ossos no jogo | `js/render/esqueleto.js`, PURO (sem three): juntas → 28 matrizes 3×4, pela v3 do protótipo (`$E/bench/pagina/esqueleto-juntas.js`): tronco pelas linhas de quadril e ombros, membros por balanço + torção pelo plano da dobra (a mesma conta no descanso), ajudantes por nlerp das matrizes de pele; escala ao longo do osso = \|B−A\|/repouso limitada a [0,9; 1,1]. Só `Math.sqrt` (nada de `hypot`), `Float32Array` fixas, sem alocar por quadro | 86 saltos em 316.664 amostras, contra milhares na versão ingênua. Está fora do passo (não precisa de `MD`) |
| Pele na GPU | Um `InstancedMesh` por LOD, com `MeshStandardMaterial` + `onBeforeCompile` (trecho GLSL validado no r170, `desempenho.md` §8). Ossos numa `DataTexture` RGBA32F (3 texels por osso, 1 linha por jogador, atributo `iSlot`); dados do jogador (cores, padrão, número, rosto, cabelo, porte) numa 2ª `DataTexture`. Sombra por `customDepthMaterial` com o mesmo remendo, e cada LOD projeta a própria sombra | `SkinnedMesh` por jogador estoura o teto (32 + 32 chamadas) e o render na CPU 4× foi a 30–175 ms. O procurador de sombra único depende de detalhe interno do three: fica de reserva |
| LOD | 4 níveis pela altura projetada em px reais (histerese de ±10%). Triângulos de corpo + cabeça + cabelo: LOD0 ≥ 280 px, ≤ 9,5 mil (5,0 + 3,1 + ≤ 1,4); LOD1 120–280 px, ~4 mil; LOD2 60–120 px, ~1,8 mil; LOD3 < 60 px (TV do celular), ~0,9 mil, 2 influências, sem textura de rosto, cabelo como calota da própria cabeça. Gerados por `gltf-transform simplify`/Decimate, com o cabelo em cards fora da dizimação | TV do celular a ~57 px reais → LOD3. TV do PC a ~102 px → LOD2 |
| Uniforme | Pintado no shader: máscara de REGIÕES 256² na UV (pele de braço, mão, perna e pescoço; camisa; manga; gola; punho; calção; barra; meião; faixa; chuteira; sola; cabeça), tirada da textura do Rocketbox pela cor e pelo osso dominante, com o logotipo do peito e a barra do calção corrigidos UMA vez. Padrões do TM (listras, metades, faixa, aros) pela posição de DESCANSO do vértice (`vRest`, frente e costas coerentes, sem costura de UV). Detalhe do pano em cinza 512² (WebP). Número das costas num retângulo da UV da camisa, com um atlas de dígitos 0–9 feito offline de uma fonte OFL (Barlow Condensed, do Google Fonts) | Um corpo para todos, nada de textura por jogador. `KITS` e `definirKits` continuam valendo. Goleiro: manga comprida + luva pintadas. Técnicos: agasalho (manga comprida, calça e sapato pintados no mesmo corpo: +0 chamadas, como exige o V2). Árbitros: kit `arbitro` |
| Porte | Uma forma-alvo com sinal (`aPorte`: forte > 0, magro < 0), com peso por instância vindo do `look.build` do TM ou da força/altura do atributo no golaco. Também escala de grossura perpendicular ao osso, sem mudar comprimento | Variedade sem tirar o pé do lugar |
| Pé que gira | A pose gira o pé 40–99° num passo em ~0,6% dos passos (pé no ar). Correção SÓ no desenho: o desenhador limita a guinada do pé no ar a 12°/quadro (estado no desenho por id, zerado em corte ou teleporte > 1 m) | Corrigir no `jogador.js`/`anim.js` muda o hash. A pele mostraria o giro |
| Fachada | `render/jogador3d.js` continua sendo a fachada: `export const KITS =` (o `teste-identidade` A1 lê o texto), `OCULTA`, `criarJogadores3D(cena, q, {perfilDe})` com a mesma API (`atualizar`, `reservar`, `definirKits`, `definirSombras`, `triangulosPorBoneco`, `indicadores`). Dentro dela: o manequim de hoje + o humano por `import()`. Os 7 montadores de lista não mudam | Nenhum teste nem montador quebra |
| `perfilDe(id)` | Passado pelo `main.js` na criação: `{num, camisa, tmId, look?, rosto?, porte}`. No TM, o `look` (`skin`, `hair`, `hairColor`, `height`, `build`, `beard`) que o pedido JÁ manda ("o 3D escolhe o rosto por ela", `tm3d.js aparencia`) é lido do pedido pela página (`ponte-tm.js` + mapa id → tmId), sem tocar no `tm-times.js` (que é do fecho) | Rosto, pele e cabelo fixos por tmId, os mesmos nos dois aparelhos do online |
| 1ª pessoa | `OCULTA` = escala 0 nos ossos da cabeça, do pescoço e do tronco superior (e nos braços) do autor. O G13 continua pelo nome das juntas | — |
| Cabelo | Malhas tiradas das cabeças Rocketbox (MIT: curto, cacheado, afro, longo em cards, coque) e encaixadas no molde offline (Surface Deform/shrinkwrap), rígidas no osso da cabeça, num `BatchedMesh` (1 chamada com `WEBGL_multi_draw`, que existe em 96% dos Android). Sem a extensão: `InstancedMesh` por estilo só para LOD0–1 e os outros com o cabelo na calota. Raspado e careca pintados na textura da cabeça. Cards com `alphaTest` | O `look.hair` do TM (`short/buzz/curly/afro/bald/long/bun`) mapeia 1:1 |
| Mocap | `js/mocap.js` PURO (fora do fecho), aplicado na cópia desenhada (`main.js` logo depois de `pose(j, mundo, e.atu)`, ANTES de gravar no anel) e nas cenas. Formato próprio "smallest three" de 32 bits, num módulo JS com base64 (o Pages comprime JS) | Sem estado, sem atraso, pés e pernas da simulação. Motion matching não cabe (52 MB, ou 5,3 MB no aprendido) |

## 3. Decisões do dono (3 perguntas curtas, com recomendação)

1. **De onde vêm os rostos?** Recomendo **só o SFHQ-T2I com as imagens do FLUX.1-schnell e do SDXL**: cadeia de licença
   100% livre, ~3,9 mil candidatos e ~500 aprováveis. Os 256 eu escolho sem te mandar nada.
   - Alternativas: somar o SFHQ, que tem luz melhor, mas foi gerado pelo StyleGAN2 da NVIDIA (licença não comercial no
     modelo); ou os lotes do ChatGPT com você (o CLAUDE.md ainda lista isso como "primeira coisa", mas era o fluxo do
     projeto antigo e depende do seu tempo).
   - Se quiser vetar rostos, mando as ~8 folhas uma vez.
2. **Altura de cada jogador no corpo?** Recomendo **todos com 1,80 m na Etapa 5, variando só o porte** (forte/magro):
   é só desenho e o hash fica igual.
   - A altura real (160–205 cm) mexe na cabeça do cabeceio (`sim.js cabecaNaBola`) e no equilíbrio. Seria um PR de
     jogabilidade à parte, com o painel de 144 partidas.
3. **Foto na escalação e no cartão do gol (item 6 da fila de 17/10)?** Recomendo **usar o retrato FICTÍCIO, o mesmo do
   rosto 3D, também nas partidas do TM**. Assim o cartão bate com o rosto em campo.
   - Na edição pro do TM, a foto do TM é de pessoa real e não combinaria com o rosto do jogo. Ela continua só nas telas
     do próprio TM.

## 4. Os PRs

Legenda: **[N]** = teste Node no padrão do CI; **[T]** = teste de navegador no CI; "reprova antes" = na `main`.

---

### 5.1a — Esqueleto do desenho, pipeline do corpo e dados (nada muda na tela)

**Entra:**
- `PESQUISA-ETAPA5.md`: as 5 pesquisas juntas, com as fontes.
- Os scripts da pesquisa, levados para o repositório (a pasta de rascunho é desta sessão e se perde):
  `$E/scripts/*` → `tools/humano/`, `tools/rostos/`, `tools/mocap/`; `$E/bench/*` → `tools/humano/bench/`.
- O pipeline offline do corpo e os dados gerados.
- O solver de ossos, puro, e o `fecho-hash`.

**Arquivos novos:**
- `golaco/tools/humano/`:
  - `README.md` com os comandos: venv do bpy 4.5.14 FORA do repositório (950 MB);
    `git clone --depth 1 --filter=blob:none --no-checkout` do Rocketbox + checkout só de `LICENSE.md` e
    `Assets/Avatars/Professions/Sports_Male_02` (e das cabeças do 5.2); `npm i @gltf-transform/cli@4 meshoptimizer` numa
    pasta de ferramentas;
  - `rocketbox_glb.py`, que já funciona (FBX → 22 ossos, soma dos pesos no ancestral, ≤ 4 influências);
  - `encaixar.py` (descanso = medidas do jogo, pernas +12%, aplicar e gravar como descanso);
  - `ajudantes.py` (6 ossos de meio-giro com os pesos redistribuídos);
  - `regioes.py` (máscara 256² + correção manual guardada em `regioes-correcao.png`);
  - `porte.py` (formas-alvo forte e magro → um delta com sinal);
  - `lods.py` (LOD0–3);
  - `repouso-do-jogo.mjs` (pose de pé do `anim.js` → `repouso.json`);
  - `exportar-bin.mjs` (GLB → `corpo.bin`/`corpo.json` quantizado e com meshopt, com `sha256` no `manifesto.json`).
- `golaco/assets/jogador/`: `corpo.bin`, `corpo.json`, `regioes.png`, `pano.webp`, `numeros.webp`, `manifesto.json`,
  `CREDITOS.md`, `LICENSE-rocketbox.md`.
- `golaco/js/render/esqueleto.js` (puro) e `golaco/js/render/corpo-dados.js` (leitor puro de `corpo.json`/`.bin`, que
  usa o decodificador meshopt no navegador e em Node).
- `golaco/tools/fecho-hash.mjs` e `golaco/tools/teste-ossos.mjs` **[N]**.

**Metas (`teste-ossos`, reprova antes porque o esqueleto não existe):**

| Meta | Antes (v1 ingênua do protótipo) | Depois |
|---|---|---|
| Juntas da malha (origem de cada osso transformada) = juntas da pose | — | ≤ 1 mm, em todo quadro |
| Saltos "do esqueleto" > 40° num passo (8 sementes de partida + mergulho, cabeceio, comemoração, técnicos, cortejo, substituição) | milhares (coxa ~2.000 por perna; ajudante ~8–9 mil) | **≤ 0,03%** (v3: 86/316.664) e tronco/cabeça ≤ 20°/passo |
| NaN e escala fora de [0,9; 1,1] | — | 0 |
| Volume da seção na dobra a 90° (joelho e cotovelo; pele na CPU com a malha real) | sem ajudantes: medir | ≥ 85% do descanso |
| Sola da chuteira no apoio (vértice mais baixo) | — | 0–1,5 cm do chão em ≥ 95% dos quadros de apoio |
| Assets = `manifesto.json` (tamanho e sha256) e triângulos por LOD dentro da tabela do §2 | — | sim |

- **Hash:** o fecho não é tocado (só `tools/`, `assets/`, `js/render/` novo e não importado). Rodar a receita do §1.1.
- **Orçamento:** nada desenha e nada é baixado (o corpo ainda não é importado). `corpo.bin` esperado em ~150–180 KB.
- **Estimativa:** **7–10 h** (encaixe e ajudantes no bpy: ~3 h; solver de 28 ossos com testes: ~3 h; exportador, leitor e
  fecho: ~2 h; CI).
- **Riscos:**
  - o encaixe +12% pode esticar a textura da canela: conferir no render do Cycles;
  - a decimação do LOD3 pode estragar a silhueta: medir o IoU da silhueta LOD3 × LOD0 a 57 px (≥ 0,9).

---

### 5.1b — O corpo humano em campo, atrás de `?corpo=humano`

**Entra:**
- O desenhador instanciado com a pele na GPU, os 4 LODs, o teto de triângulos, o uniforme pintado (regiões, padrões do TM,
  número das costas), as sombras, `OCULTA`, a guinada do pé filtrada e a troca manequim → humano.
- Todos os personagens passam pelo corpo novo: jogo, comemoração, substituição, técnicos, replay, pré-jogo, pênaltis,
  Livre e online.
- A cabeça ainda sem rosto (tom liso), com o cabelo na calota em todas as LODs. Por isso fica atrás da chave.
- `?perf=1`: um painel pequeno com qps, 1% pior, chamadas de cor + sombra e triângulos, para o dono abrir no celular dele
  se quiser.

**Arquivos novos:**
- `js/render/humano3d.js`: `InstancedMesh` por LOD, os remendos de cor e de sombra, as duas `DataTexture`, o recorte por
  esfera com margem de 3 m e `renderer.compileAsync` na carga.
- `js/render/lod-humano.js`: puro; escolha pela altura projetada, histerese, teto, ≤ 2 na LOD0 e ≤ 3 LODs.
- `tools/teste-lod-humano.mjs` **[N]** e `tools/teste-corpo-tela.mjs` **[T]**.

**Arquivos alterados:**
- `js/render/jogador3d.js`: a fachada carrega o humano, e o manequim fica como reserva e para comparação.
- `js/main.js`: `perfilDe`, a chave `?corpo=` e `__golaco.corpo`.
- `js/config.js`: `CORPO = {padrao: 'manequim', tetoTri: {baixa: 3e4, media: 6e4, alta: 1.2e5}, lod: [...]}`.
- `tools/teste-carga.mjs` (`SOB_DEMANDA_ARQ`), `teste-replay.mjs` (teto contra a main),
  `teste-tecnicos-tela.mjs` (`triangulosPorBoneco` médio), `rodar-navegador.mjs`, `lib/tempos-ci.mjs`, `CONTRATOS.md`.

**Metas (`teste-corpo-tela` reprova antes no C0: não existe corpo humano):**

| Meta | Antes | Depois |
|---|---|---|
| C0: com `?corpo=humano`, todos os itens da lista desenhados pelo humano (instâncias = itens) em 7 cenas: jogo, comemoração, substituição, técnicos, replay, pré-jogo, pênaltis/Livre | não existe | sim |
| C1: chamadas de cor na TV do celular | 28 | ≤ 27 |
| C2: chamadas de SOMBRA na TV (contador de `drawElementsInstanced`/`drawArrays*` no contexto) | 3 | ≤ 2 |
| C3: GPU = JS (como o `teste-rede`): posições da pele lidas da GPU num alvo float × a conta do `esqueleto.js`, em 6 poses (corrida, mergulho, cabeceio, comemoração com os braços no céu, técnico, fila) | — | erro ≤ 1 mm |
| C4: número das costas visível no close das costas | 0 px | ≥ 1,5% da área da camisa na cor do número |
| C5: 1ª pessoa (`OCULTA`) sem vértice da cabeça ou do tronco do autor na tela | — | 0 px |
| C6: CPU "jogadores" (CPU 4×, 32 jogadores) | 0,22–0,53 ms | ≤ +0,5 ms |
| C7: qualidade cai no meio do jogo → o teto acompanha (triângulos dos jogadores ≤ teto da qualidade nova em ≤ 1 s) | a malha não muda | sim |
| C8: troca manequim → humano sem quadro vazio nem erro no console | — | sim |
| `teste-lod-humano` [N]: ≤ 1 troca de LOD por jogador por segundo com a câmera parada; teto respeitado em 100% dos quadros do pré-jogo inteiro; ≤ 2 na LOD0; ≤ 3 LODs | — | sim |
| Pé no ar: guinada > 40° num passo (pele) | ~0,6% dos passos | ≤ 0,05% |
| `teste-prejogo` 7 e `teste-livre-tela` D5 | 35 / 122 mil | ≤ 38 / ≤ 122 mil (com `?corpo=humano`; os testes rodam nas duas chaves) |
| `teste-substituicao-tela` T9, `teste-tecnicos-tela` V2, `teste-replay`, `teste-hud-minimo` | passam | passam nas duas chaves |
| Download inicial | 2,57 MB | +≤ 3 KB. Sob demanda: ~250–290 KB (código ~35 + corpo ~165 + decodificador 25 + texturas ~35) |

- **Hash:** o fecho não é tocado; a receita do §1.1. Os uniformes do TM conferidos com `teste-tm-tela` e `testar-3d`
  (fora do CI, obrigatórios aqui).
- **Estimativa:** **14–20 h**. É o PR mais pesado:
  - shader e duas texturas: ~4 h;
  - LOD e teto: ~2 h;
  - uniforme, padrões e número: ~3 h;
  - integração nos 7 montadores, `OCULTA` e técnicos: ~2 h;
  - testes de tela (alvo float, contador de chamadas): ~3 h;
  - CI e acertos: ~2–4 h.
- **Riscos:**
  - o tempo de GPU no celular de verdade não é medido aqui (SwiftShader);
  - o `compileAsync` engasga no 1º close se esquecer um programa (há 4–6);
  - os índices são de 16 bits (≤ 65.535 vértices por malha: a LOD0 tem ~6–8 mil, ok).

---

### 5.1c — Closes: acabamento do corpo

**Entra:**
- O mapa de normais na LOD0–1 (WebP 512², ~20 KB) e o detalhe do pano 1024² só na Alta.
- Os ajudantes calibrados no close.
- A folga da cabeça à bola no cabeceio e da luva à bola na defesa, medidas e, se precisar, compensadas no DESENHO: escala
  da malha da cabeça entre 1,00 e 1,06 e luva 3 cm maior.
- O tom do corpo por id (os 8 de hoje) até o 5.2b.

**Arquivos:** `tools/humano/normais.py`, `js/render/humano3d.js`, `tools/teste-ossos.mjs` (casos novos),
`tools/teste-corpo-tela.mjs`.

**Metas:**

| Meta | Antes (5.1b) | Depois |
|---|---|---|
| Folga da cabeça desenhada à bola no tick do contato do cabeceio, p95 (pele na CPU; `teste-cabeceio`) | medir (a esfera da física é maior que uma cabeça real: espera-se 3–4 cm) | ≤ 2,5 cm |
| Luva à bola no tick da defesa (canhão do `teste-mergulho`) | medir | ≤ 6 cm em ≥ 90% |
| Volume na dobra forte (joelho a 120°, chute) | medir | ≥ 80% |

- **Hash:** a receita do §1.1.
- **Orçamento:** +0 chamadas; +~20 KB sob demanda (+53 KB na Alta).
- **Estimativa:** **5–7 h**.

---

### 5.2a — Banco de rostos fictícios (nada muda na tela; pode andar junto com o 5.1b)

**Entra:**
- As ferramentas dos rostos e o banco de 256 rostos.
- O mapa da UV canônica do MediaPipe para a UV da cabeça-molde, montado UMA vez:
  1. render frontal da cabeça com um shader que escreve a UV como cor;
  2. os 478 marcos no render;
  3. para cada texel da UV da cabeça, o triângulo e as baricêntricas na triangulação dos marcos;
  4. cada retrato vira um `cv2.remap`.
- De-lighting pela esclera e por SH9 com as normais dos marcos 3D.
- Tom (ITA, 6 faixas), cor do cabelo, barba e push-pull atrás da cabeça e nas orelhas.
- O degradê da emenda.
- A foto recortada de 96×120 para as cartas.

**Arquivos novos:**
- `golaco/tools/rostos/`:
  - `README.md`: venv do `mediapipe` 1.1.1 + `opencv-python-headless`; `apt-get install libegl1 libgles2`; o modelo
    `face_landmarker.task` do storage.googleapis.com;
  - `zip_remoto.py` (faixas de bytes do zip do Kaggle; sem conta);
  - `filtrar_t2i.py` (prompt: homem de 18 a 38, sem acessório; modelo schnell ou SDXL);
  - `triagem.py`, que ganha o filtro de olhar para a frente (`eyeLook*` < 0,3);
  - `mapa_uv_molde.py`, `desembrulhar.py`, `delight.py`, `tom.py`;
  - `folhas.py` (folhas de contato de 48, para a escolha);
  - `clip_zs.py` (só ajuda fora do jogo).
- `golaco/assets/rostos/`:
  - `r###_{128,256}.webp` (~2 + ~5 KB);
  - `r###_foto.webp` (~3 KB);
  - `manifesto.json` (id, faixa ITA, tom sRGB, cor do cabelo, barba, estilo sugerido, origem: conjunto, modelo gerador e
    arquivo);
  - `CREDITOS.md`.
- `golaco/tools/teste-rostos.mjs` **[N]**.

**Metas (`teste-rostos`, reprova antes porque o banco não existe; a emenda reprova no retrato cru):**

| Meta | Antes (cru, medido na pesquisa) | Depois |
|---|---|---|
| Rostos por faixa de ITA (I–VI) | — | ≥ 40 em cada uma, 256 no total |
| Origem e licença em cada item; nenhum FLUX.1-dev, DALL·E ou Flux pro | — | 100% |
| Emenda rosto/pescoço, ΔE00 no anel de fora (mediana / p90) | 5,6 / 15,6 | **≤ 2 / ≤ 3** |
| Luz entre as bochechas (\|E−D\|/média) | 0,37 (aprovados) | ≤ 0,08 |
| Tamanho por arquivo (256² WebP) | — | ≤ 8 KB |

- **Hash:** nada no fecho; nada no site muda.
- **Tempo de máquina:** ~1 h para varrer ~4–5 mil retratos, mais a curadoria em ~8 folhas (o agente olha cada folha e
  descarta rosto parecido com gente conhecida).
- **Estimativa:** **6–9 h**: ferramentas e mapa do molde ~3 h; varredura e curadoria ~3 h; testes e créditos ~1–2 h.
- **Riscos:**
  - uma faixa (sobretudo a VI) pode não chegar a 40 só com o T2I: mirar o prompt; se não der, baixar o mínimo daquela
    faixa para 30 ou somar o SFHQ, se o dono aceitar (pergunta 1);
  - o link assinado do Kaggle pode passar a exigir conta: baixar uma vez os escolhidos (~38 MB) e guardá-los FORA do git.

---

### 5.2b — Rosto e cabelo no jogo, e o corpo humano vira o PADRÃO

**Entra:**
- A `DataArrayTexture` dos rostos da partida, sob demanda: Média 256², Baixa 128², Alta 256² + uma 2ª de 2 camadas em
  512² para o "herói" da LOD0. É montada por `createImageBitmap` → `OffscreenCanvas` → camada, com mips.
- A atribuição do rosto:
  - golaco: 52 fixos por id no manifesto (46 jogadores, árbitros 200–203, técnicos 210/211);
  - TM: `hash(tmId)` dentro da faixa do `look.skin` (os 9 tons do TM → ITA), com barba = `look.beard` e o cabelo pelo
    `look.hair`/`hairColor`, sem repetir na partida (sondagem);
  - online: igual nos dois aparelhos.
- O tom do corpo = o tom do rosto.
- Cabelos de malha (5 estilos × 3 LODs), com o `BatchedMesh` e a reserva sem multi-draw.
- A foto fictícia nas cartas da escalação do pré-jogo e no cartão da comemoração, com número e nome (item 6, se o dono
  confirmar a pergunta 3).
- `CORPO.padrao = 'humano'`. O `?corpo=manequim` continua existindo.

**Arquivos novos:**
- `js/render/rostos.js`: carga, array e atribuição. A atribuição pura vai para `js/render/rostos-escolha.js`, testada
  em Node.
- `tools/humano/cabelos.py` → `assets/jogador/cabelos.bin`/`.json`.
- `tools/teste-rosto-tela.mjs` **[T]**.

**Arquivos alterados:**
- `js/render/humano3d.js`;
- `js/main.js` e `js/ponte-tm.js` (o `look` pelo `perfilDe`);
- `js/escalacao-tela.js`, `js/render/autor-gol.js` ou o cartão da comemoração (a foto);
- `tools/teste-rostos.mjs` (casos da atribuição);
- `teste-carga`, `CONTRATOS.md`, `CLAUDE.md`.

**Metas (`teste-rosto-tela` reprova antes porque não há rosto):**

| Meta | Antes | Depois |
|---|---|---|
| Close (reação da comemoração, fila do pré-jogo): desvio-padrão da luminância no retângulo do rosto | ~0 (tom liso) | ≥ o de um retrato de referência × 0,6 |
| Uma chamada para todas as cabeças com rosto; camadas = pessoas distintas na partida | — | sim |
| Emenda na TELA (luz do jogo): ΔE00 entre o pescoço e o rosto no close | — | ≤ 3 |
| Atribuição [N, `teste-rostos`]: 50 pedidos sorteados do TM (`tools/lib/pedidos-tm.mjs`) sem rosto repetido na partida, determinístico, faixa = `look.skin` em 100% (ou na vizinha, quando a faixa esgota), barba = `look.beard` | — | sim |
| Cabelo: chamadas no pior plano do pré-jogo, com e sem `WEBGL_multi_draw` (`?semMultiDraw=1`) | 35 | ≤ 38 / ≤ 40 |
| `teste-prejogo` 7 com o corpo PADRÃO | 35 / 122 mil | ≤ 38 / ≤ 122 mil |
| VRAM dos rostos | 0 | Média ≤ 18 MB |
| Download inicial | 2,57 MB | igual (+≤ 3 KB). Sob demanda: rostos da partida ~0,25–0,35 MB + cabelos ~60–100 KB + fotos ~0,1 MB |

- **Hash:** o fecho não é tocado (o `tm-times.js` fica intocado: o `look` vem do pedido pela página). A receita do §1.1
  + `teste-tm-tela` + `testar-3d` + `testar-online3d --golaco` (os dois lados desenham os mesmos rostos).
- **Estimativa:** **12–16 h**: array, atribuição e testes ~4 h; cabelos (encaixe offline, LODs, `BatchedMesh` e reserva)
  ~4 h; fotos nas cartas ~2 h; virar o padrão e rodar os testes de tela nas duas chaves ~2–4 h; CI.
- **Riscos:**
  - VRAM em aparelho de 3 GB: KTX2/Basis fica de reserva (transcodificador de ~0,5 MB, sob demanda);
  - o padrão vira o humano sem medir a GPU de um celular de verdade: o `?perf=1` do 5.1b, a queda automática de
    qualidade e o teto de triângulos protegem. Se o dono puder, um minuto no celular dele antes do merge.

---

### 5.2c — O rosto com a forma da pessoa, olhos e boca

**Entra:**
- A forma do rosto de cada pessoa: os marcos 3D do MediaPipe alinhados por Procrustes, a 70%, viram um delta por vértice
  da cabeça LOD0–1 numa `DataArrayTexture`, lido por `gl_VertexID` + camada (continua 1 chamada).
- Olhos com globo (2 ossos `LEye`/`REye` do Rocketbox mantidos só na LOD0).
- Boca aberta e expressões na comemoração e nos técnicos: formas-alvo `JawOpen`, `Smile` e `EyeSquint` do
  `_facial.fbx` do Rocketbox (MIT), assadas para o molde, com o interior da boca.
- Banco de 512 se a temporada do TM repetir demais.

**Metas:**
- erro do perfil do nariz e do queixo contra o retrato (marcos 2D reprojetados), mediana ≤ 2 px a 256²;
- no gol, a boca aberta na reação (abertura ≥ 1,5 cm no autor);
- olhar: os olhos apontam para a câmera ou para a bola com erro ≤ 5°;
- +0 chamadas.

**Estimativa:** **8–12 h**. Pode ir para depois do mocap se o dono preferir movimento antes de detalhe.

---

### 5.3a — Mocap: pipeline e dados (M1)

**Entra:** `tools/mocap/` (os scripts da pesquisa), mais:
- leitura de ASF/AMC, BVH e FBX (pelo bpy);
- retarget para os 22 ossos (`q_local = q_pai⁻¹ · q_fonte · Δ`);
- ciclos de 1 passada × 32 amostras pela fase, com a média das passadas, o espelho esquerda/direita e sem a raiz.

Os ciclos:
- andar: Rocketbox `m_walk_neutral`;
- trote: `m_run_slow_01`, `m_run_neutral`, CMU 16_35 e 35_17;
- corrida: CMU 09, 16_45 e 35_22;
- rápida: `m_run_fast_01/02` e CMU 143_01;
- recuo e lado: 100STYLE Neutral BR/SR/BW/SW e CMU 127_13/14;
- parado: `m_idle_breathe`.

Saem `golaco/assets/mocap/locomocao.js` (~14 KB, smallest-three em base64) e o `CREDITOS.md`.

**Metas:**
- `teste-mocap` [N], parte de dados: decodificação com erro médio ≤ 0,1° e máximo ≤ 0,2°;
- os ciclos fecham sem degrau (≤ 2° entre a amostra 31 e a 0);
- espelho simétrico.

**Hash:** nada no fecho. **Estimativa:** **4–6 h**. Os dados podem ser preparados em paralelo com o 5.2.

---

### 5.3b — Camada A: locomoção pela fase (M2)

**Entra:**
- `js/mocap.js` (puro, fora do fecho e do passo): amostra pela `j.fase`, mistura pela velocidade e pelo ângulo
  velocidade × rumo (recuo e lado).
- A pelve só gira, em torno do quadril de APOIO; o joelho do balanço é refeito por IK (a do `anim.js`, só lida) para o
  pé continuar no ponto desenhado da simulação.
- Por cima: a coluna, as clavículas, os braços e a cabeça, mais os aditivos de hoje (inclinação pela aceleração e
  rolagem na curva).
- Personalidade por `hash(id)`: 2–3 corredores misturados, sem `m.rng`.
- De 6 a 8 m/s, passagem gradual para a pose procedural.
- Peso zero no mergulho, no pulo do cabeceio, nas mãos do goleiro, na lateral, na barreira e no gesto do toque.
- Quem está na LOD3 com < 40 px fica com a pose pura.
- `?mocap=0` desliga.

**Arquivos:** `js/mocap.js`, `js/main.js` (chamada depois de `pose(j, mundo, e.atu)`, antes de `gravarNoAnel`) e o ponto
de montagem das cenas no `main.js`. Se a fase e a velocidade do ator não estiverem no item, elas são expostas em
`tecnicos.js`, `substituicao.js` e `cortejo.js`, que estão fora do fecho. A `comemoracao.js` nunca é mexida: o ator dela
(`criarAtor`) já traz a cópia do jogador (`ator.j`, com a fase e a velocidade), o `papel`, o `gesto` e o `t0`.

**Metas (`teste-mocap`, as mesmas contas do `mocap.md` §2 na pose DESENHADA; reprova antes em tudo):**

| Grandeza (3–6 m/s) | Hoje | Meta |
|---|---|---|
| Obliquidade da pelve, p5–p95 | 0° | 7–15° |
| Rolagem lateral do tronco | 2,4–3,2° | 5–14° |
| Cotovelo, ângulo interno | 97–127° | 65–90° |
| Balanço do braço até 6 m/s | 74–94° | ≤ 75° |
| Cabeça × tronco (p5–p95) | sem orientação | a cabeça oscila menos |

Garantias que continuam medidas:
- perna de apoio desenhada = `anim.js`: tornozelo ≤ 1 mm;
- ponta do pé parada no apoio: ≤ 1 cm;
- cabeça = a da simulação no pulo do cabeceio: ≤ 1 mm;
- nenhum osso > 25° num passo;
- G13 e S9 do replay seguem passando (a obliquidade muda o quadril desenhado em ~9 mm na vertical);
- `teste-ossos` sem saltos novos.

- **Hash:** o fecho não é tocado (`mocap.js` não é importado pelo passo; o `teste-math-proibido` confere).
- **Orçamento:** CPU ~63 µs por quadro para 22 jogadores no Node (≤ +0,4 ms na CPU 4×); 14 KB sob demanda; +0 chamadas.
- **Estimativa:** **6–8 h**.
- **Observação:** o dono aprovou a condução ("está bem boa, continue assim"). A camada não toca pés, bola nem ritmo; só o
  tronco e os braços, e tem a chave `?mocap=0`.

---

### 5.3c — Camada B: clipes nas cenas (M3)

**Entra:**
- Comemoração: Rocketbox `m_cheer_01..05` e `m_claphands`; CMU 79_69, 142_08/09 e 141_22.
- Técnicos: `m_idle_angry`, `m_gestic_talk_angry`, `m_gestic_shrug`, `m_claphands` e `m_idle_look_around`.
- Fila do pré-jogo e substituição: `m_idle_breathe`/`neutral` no lugar do `respirar()`; aperto de mão da CMU 18/19 e
  141_23; aceno `m_wave`.
- Clipes no lugar, os pés presos por IK nos pontos da cena e a troca por inertialization pura (0,2–0,3 s).
- A escolha do clipe pelo hash que a comemoração já usa.
- Os clipes entram sob demanda (~60–120 KB, delta int8).

**Arquivos:**
- `js/mocap.js` (clipes e inertialization) e `assets/mocap/cenas.js`.
- `js/tecnicos.js`, `js/substituicao.js` e `js/render/prejogo.js`, que estão fora do fecho.
- **Comemoração sem tocar na `comemoracao.js`** (ela é do fecho, pelo `disputa.js`): os clipes são aplicados no ponto
  onde o `main.js` monta a lista da cena (`cenaGol.atores`), por cima da pose que a cena já calcula. O gesto e o tempo
  são lidos do estado do ator, que a cena já expõe.

**Metas:**
- os testes de cena seguem passando (`teste-comemoracao`, `teste-tecnicos` T1–T16, `teste-substituicao`, `teste-cortejo`,
  e os de tela);
- pés presos ≤ 1 cm durante o clipe;
- troca sem osso > 25° num passo;
- `teste-mocap` C: cada clipe é tocado pelo menos uma vez em 20 gols roteirizados, sem repetir em seguida.

**Hash:** a receita do §1.1. **Estimativa:** **6–8 h**.

---

### 5.3d — Pose estendida: olhar, palma e rolagem do pé (M4)

**Entra:**
- 6 juntas de orientação como PONTOS no fim da pose desenhada: `cabecaFrente`, `cabecaCima`, `palmaE`, `palmaD`, `dedoE`
  e `dedoD`. Os índices `J` não mudam e a interpolação continua sendo lerp de pontos.
- O anel do replay vai de 19 para 25 juntas (3,56 → 4,7 MB de RAM, nada no download).
- O olhar para a bola: guinada da cabeça limitada a ±70° do tronco, compensando a oscilação.
- A torção da mão e a rolagem calcanhar–ponta.
- O `esqueleto.js` usa esses pontos como referência de torção.
- `replay-olhos.js` tira a frente do olho do `cabecaFrente`.

**Arquivos:** `js/mocap.js`, `js/main.js` (`interpolarPose`), `js/render/replay-anel.js`, `js/render/replay-olhos.js`,
`js/render/esqueleto.js`, os testes `teste-replay-anel` (G1–G13), `teste-saot` e `teste-ossos`.

**Metas:**
- a cabeça olha a bola: erro de guinada ≤ 10° com a bola dentro do limite;
- 1ª pessoa estável (≤ 85°/s, a régua de hoje);
- G13 e S9 passam;
- anel ≤ 4,8 MB;
- CPU ≤ +0,1 ms.

**Hash:** a receita do §1.1. O anel é desenho, e o `hash-partida` continua igual. **Estimativa:** **5–7 h**.

## 5. Ordem, paralelismo e total

```
5.1a ──► 5.1b ──► 5.1c ──► 5.2b (vira o padrão) ──► 5.2c
   └──► 5.2a (máquina ~1 h + curadoria; anda junto com o 5.1b)
                                   5.3a (dados; junto com o 5.2) ──► 5.3b ──► 5.3c ──► 5.3d
```

- Uma tarefa de código por vez (a fila do CLAUDE.md). Só a preparação de dados (5.2a, 5.3a) roda na máquina em paralelo,
  como o dono aceitou em 12/10.
- **Total: ~73–103 h de agente**, mais ~30–45 min de CI por PR.
  - Corpo: 26–37 h.
  - Rosto e cabelo: 26–37 h.
  - Mocap: 21–29 h.
- **O dono vê:**
  - o corpo novo pelo link `?corpo=humano` desde o 5.1b;
  - o corpo como padrão no 5.2b, com rosto e cabelo;
  - o movimento mais humano no 5.3b.

## 6. Riscos gerais e o que fazer

| Risco | Mitigação |
|---|---|
| GPU do celular de verdade não medida (o CI desenha em software) | `?perf=1`, a queda automática de qualidade e o teto por qualidade. Se o dono puder, 1 minuto no celular dele antes do 5.2b |
| Orientação dos ossos só com posições (o goleiro deitado e os braços no céu) | O `teste-ossos` cobre os casos de borda desde o 5.1a; a pose estendida (5.3d) dá a torção que falta |
| Cabeça real menor que a esfera da física (`RAIO_CABECA` 0,115) | Medido no 5.1c e compensado só no desenho (escala ≤ 1,06 e o volume do cabelo); a constante não muda |
| Teto do pré-jogo (35 hoje, 40 o teto) | ≤ 3 LODs por quadro, cabelo numa chamada, o teste com e sem multi-draw |
| Semelhança de rosto de IA com pessoa real | Curadoria um a um, prompt sem nomes, veto do dono se quiser. Jogador do TM com nome real nunca recebe o rosto real |
| Licença do Rocketbox: o artigo de 2020 ainda diz "research" | Vale o `LICENSE.md` MIT do repositório desde 11/2020: guardar a cópia com o hash do commit |
| bpy (950 MB) e mediapipe (`libegl1`/`libgles2`) fora do CI | O pipeline roda local; os dados gerados vão para o repositório com o sha256 no manifesto, conferido em Node |
| Os scripts da pesquisa estão só na pasta desta sessão | O 5.1a leva todos para `golaco/tools/{humano,rostos,mocap}` antes de qualquer outra coisa |
| Atualizar o three.js quebra o remendo do shader | `teste-corpo-tela` C3 (GPU = JS) e C2 (sombra) acusam na hora |

---

## Etapa 5 — mapa do desenho ATUAL dos jogadores no GOLAÇO (`golaco/`)

Levantamento feito em 22/10 sobre `main` (último commit `f2b84c6c`). Nada do `futebol3d/` foi lido.
Medidas de custo feitas agora no Chromium headless (script em
`$E/scripts/medir-custo.mjs`).

---------------------------------------------------------------------------------------------------------------------

## 1. O caminho de um jogador até a tela

```
sim.js (passo 1/60 s)  ──►  anim.js pose(j, m, out)  ── 19 juntas × (x,y,z) no mundo, Float32Array(57)
   (a pose ENTRA na simulação: sim.js j.quadril = alturaQuadril(); cabecaNaBola() usa a cabeça da pose)
main.js rodarPasso:   estJ.get(id) = {ant, atu, des, x0,z0,x1,z1, r0,r1}   (pose 1×/passo; disputa: poseDisputa por cima)
                      gravarNoAnel → render/replay-anel.js (copia atu + x/z/rumo + bola; 26 vagas × 600 passos)
main.js desenharQuadro: interpolarPose(ant, atu, alfa, des) (lerp linear junta a junta) → item da `lista`
                      + anexarTecnicos (2 treinadores) → jog3d.atualizar(lista, camera)
```

Quem monta a `lista` e chama `jog3d.atualizar` (o ÚNICO desenhador de gente em campo):

| Onde | Linha | Quem entra | Origem da pose |
|---|---|---|---|
| `main.js desenharQuadro` — jogo | 1040–1053 | `mundo.jogadores` (até 22) | `estJ` (pose da simulação) |
| `main.js desenharQuadro` — comemoração | 1028–1038 | `cenaGol.atores` (cópias dos 22) | `js/comemoracao.js` (pose + gestos por `ik`/`ikBraco`) |
| `main.js desenharQuadro` — substituição | 1015–1027 | `cenaSub.atores` (22 + quem entra + 4º árbitro id 203) | `js/substituicao.js` |
| `main.js anexarTecnicos` | 1166–1179 | treinadores 210/211 | `js/tecnicos.js` (pose + gestos) |
| `main.js desenharReplay` | 1464–1483 | o que o anel gravou | `replay-anel.js lerQuadro` (interpola o anel) |
| `render/prejogo.js montarLista` | 211–239, 325 | cortejo (22 + árbitros 200–202) + 2 treinadores | `js/cortejo.js` (mundo à parte) + `respirar()` mexe nas juntas de cima |
| disputa de pênaltis / Modo Livre / online | — | os do mundo (ramo do jogo) | igual ao jogo |

`render/autor-gol.js`, `replay.js`, `placa-subst.js`, `escalacao-tela.js`, `campinho.js`, `prejogo-tela.js` NÃO desenham
gente 3D (a escalação do pré-jogo é DOM: cartas com número, nome da camisa e posição, sem foto; o escudo com `?tm`).

Interface de `criarJogadores3D(cena, qualidade)` (`render/jogador3d.js`, criada UMA vez em `main.js:2202`):
`{segs, cabecas, cabelos, capacidade, triangulosPorBoneco, indicadores, reservar(n), definirKits(mapa),
atualizar(lista, camera), definirSombras(b)}` + `export KITS`, `export OCULTA`.
Fora do arquivo só se usa `atualizar`, `reservar`, `definirKits`, `definirSombras`, `triangulosPorBoneco` (API de teste
`__golaco.estadio.triangulosBoneco`), `indicadores` (`__golaco.indicadores`), `KITS` (lido como TEXTO pelo
`teste-identidade` A1) e `OCULTA` (main.js replay). `segs/cabecas/cabelos/capacidade` não são usados por ninguém.

Item da lista (contrato, `jogador3d.js:491`): `{id, time, goleiro, kit?, pose (Float32Array 57, já interpolada),
controlado, proximo, pressiona, relogio, x, z, rumo, tecnico?, ocultar?}`. NÃO vem: velocidade, bola, posse, número,
nome, tmId, altura — quem precisar busca por `id` (`elenco.js fichaDe(id)` é puro e global: `num`, `camisa`, `tmId`,
`attr.altura`).

---------------------------------------------------------------------------------------------------------------------

## 2. As 19 juntas (`anim.js JUNTAS/J`) — o que são e como saem

Pose = SÓ POSIÇÕES no mundo (metros), `out[i*3..i*3+2]`. **Nenhuma rotação, nenhum quaternion, nenhuma escala.** O
manequim deriva a orientação no desenho (`jogador3d.js frente()` e o eixo de cada cápsula). Para o skinning, cada osso
terá de ter a rotação reconstruída das posições.

| # | Junta | Significado / como a pose calcula (pose de pé, `anim.js pose`) | Orientação disponível? |
|---|---|---|---|
| 0 | `pelve` | centro do quadril: (j.x,j.z) + deslocamento lateral da passada/pedalada; y = `hy` (≈ 0,94–0,96 m de pé; limitado pelo alcance das pernas e `j.quadril`) | não; "cima" = pelve→lombar, "frente" = perpendicular a quadrilE→quadrilD |
| 1 | `lombar` | pelve + `u`·0,17 (u = vetor "cima" do tronco com pitch pela vel./acel. e roll pela curva) | eixo pelve→lombar |
| 2 | `peito` | lombar + u·0,22 | eixo lombar→peito; torção = linha dos ombros |
| 3 | `pescoco` | peito + u·0,13 | eixo |
| 4 | `cabeca` | pescoco + u·0,13 + frente·0,02 (CENTRO da cabeça; sim.js testa o cabeceio com ESTE ponto) | só "cima" (pescoço→cabeça); **sem guinada própria (não olha a bola)**: a frente vem de ombros+quadris |
| 5/8 | `ombroE/ombroD` | peito + u·0,07 ± direita·0,19 (direita girada contra a torção do quadril ×1,4) | linha dos ombros (dá a torção do tronco) |
| 6/9 | `cotoveloE/D` | ombro + 0,29 na direção do balanço; nos gestos por IK (`ikBraco`, polo explícito) | plano ombro–cotovelo–mão |
| 7/10 | `maoE/maoD` | cotovelo + 0,26 (ponta do antebraço = punho/mão); IK no goleiro pronto, bola na mão, lateral, cabeceio | **sem orientação da mão nem torção do antebraço** |
| 11/15 | `quadrilE/D` | pelve − 0,03 em y ± direita do quadril·0,09 (largura 0,18) | linha dos quadris |
| 12/16 | `joelhoE/D` | IK de 2 ossos (`ik`, coxa 0,45 / canela 0,45) com polo = frente do pé + 10% para fora | plano quadril–joelho–tornozelo (some com a perna esticada) |
| 13/17 | `tornozeloE/D` | pé plantado = EXATAMENTE o ponto da simulação (y 0,08); no ar = o pé desenhado que a simulação integra | — |
| 14/18 | `pontaE/D` | tornozelo + rumo do pé·0,17 (y = ty − 0,055 + inclinação no balanço, ≥ 0,025) | direção do pé (guinada + inclinação); **sem rolagem** |

Casos especiais que trocam a pose inteira (todas devolvem as mesmas 19 posições):
`poseMergulho` (goleiro deitado/no ar: tronco horizontal, eixos de `goleiro.js eixosMergulho`), pulo do cabeceio
(`cabeceio.js quadroPulo`), salto da barreira (sobe o corpo inteiro), lateral (mãos atrás da cabeça),
`disputa.js poseDisputa` (braços), comemoração (`comemoracao.js`: joelhos, pulo, deslize, braços, abraço, giro),
treinadores (`tecnicos.js`: instruir, aplaudir, reclamar), cortejo/fila (`prejogo.js respirar`: ±1 cm nas juntas de cima).

Comprimentos de "repouso" (das contas da pose): pelve→lombar 0,17 · lombar→peito 0,22 · peito→pescoço 0,13 ·
pescoço→cabeça ≈ 0,13 · ombros 0,38 entre juntas · braço 0,29 (`BRACO`) · antebraço 0,26 (`ANTEBRACO`) · quadris 0,18
entre juntas · coxa 0,45 · canela 0,45 (`JOGADOR.coxa/canela`) · tornozelo a 0,08 do chão · tornozelo→ponta 0,17.
Altura desenhada ≈ 1,73 m (centro da cabeça ≈ 1,60 m, `RAIO_CABECA` 0,115 × 1,1). **Todos com o mesmo tamanho**: o
atributo `altura` (160–205 cm, `elenco.js`/`tm-times.js`) não chega à pose.
Os comprimentos NÃO são rígidos no desenho: `interpolarPose` é lerp linear (a corda encurta um pouco em giros rápidos),
`respirar` mexe só nas juntas de cima, e `ik` limita o alcance (`LMAX` = 0,998·0,9). O skinning tem de aguentar osso
um pouco mais curto/longo sem tirar o pé do lugar.

Consumidores das posições das juntas fora do desenho (não podem mudar):
- `sim.js:587` `j.quadril = alturaQuadril(j, m)` e `sim.js:765 cabecaNaBola` (cabeça da pose − `RAIO_CABECA` − 0,11 da
  bola) → **mexer na pose = hash diferente** (e `anim.js` só pode usar `MD`, `teste-math-proibido`).
- `goleiro.js maoAlcanca` (a mão desenhada tem de chegar à bola para a defesa valer).
- `render/replay-anel.js RAIO_PARTE/JUNTAS_VALEM` (impedimento semiautomático pelos raios de `SEGMENTOS`).
- `render/replay-olhos.js` (olho da 1ª pessoa = cabeça + frente·0,085 + cima·0,03; sólidos dos jogadores para a câmera).
- `tecnicos.js` (`RMIN = RAIO_CABECA + 0,03`, topo da cabeça) e `comemoracao.js` (altura do olho pelo peito).

---------------------------------------------------------------------------------------------------------------------

## 3. O manequim de hoje (`render/jogador3d.js`, 625 linhas)

- **16 cápsulas** (`anim.js SEGMENTOS`: [junta A, junta B, raio A, raio B, parte]) TODAS de TODOS os jogadores num
  único `InstancedMesh` "jogadores-segmentos" (instância = jogador × segmento): matriz por instância = base
  X/Y/Z (Y = eixo A→B, Z = "frente" pelos ombros `fSup` ou pelos quadris `fInf`, misturada com "cima" quando quase
  paralela) + translação em A; atributo `iDim` (raio A, raio B, comprimento, achatamento frente–trás) aplicado no vertex
  shader (`CORPO_V`). Cabeça = `SphereGeometry` escalada (0,92R, 1,1R, 1,0R) num 2º `InstancedMesh`; cabelo = calota
  (θ até 0,52π) num 3º; mancha de contato num 4º.
- **Estilos** por segmento (`estilo()` pelo NOME das juntas): achatamento do tronco 0,68, pelve 0,74 (raios afinados
  0,118/0,13), ombros 0,85, quadris 0,84 (0,088); padrão `P` = liso, manga, luva, tronco, gola, coxa, meião, chuteira.
  Goleiro (`ESTILOS_GOL`): manga comprida + luva; treinador (`ESTILOS_TECNICO`): terno/agasalho com os mesmos padrões.
- **Fragment shader** (`materialSegmentos`, `MeshStandardMaterial` roughness 0,72, cache `manequim-v4`): 3 cores por
  instância (`iC1` principal, `iC2` pele, `iC3` acento/2ª cor) + `iPad`; faixas por `vT` (ao longo do osso) e `lado`
  (ângulo em volta do eixo): manga curta com punho, luva, listra lateral no tronco, gola, calção com listra, meião com
  faixa, sola da chuteira. Padrão da camisa do TM pela fração do `iPad` (`PADRAO_FRAC`: plain 0, stripes 0,1, halves 0,2,
  sash 0,3, hoops 0,4; `padraoCamisa`). Sombra: `materialSombraSegmentos` (`MeshDepthMaterial` com a mesma deformação).
- **Sem textura nenhuma** no corpo (só cor por instância); **sem número nem nome na camisa**; sem rosto.

### Uniformes, pele, cabelo
- `KITS` (fictícios): `linha0` preto/verde, `goleiro0` lima, `linha1` branco/cinza, `goleiro1` laranja, `arbitro` azul,
  `tecnico0` terno grafite, `tecnico1` agasalho chumbo. Campos: `camisa, manga?, calcao, meiao, chuteira, acento, sola,
  luva, padrao?, segunda?` (`segunda` não é lida pelo shader: a 2ª cor do padrão é o `acento`).
- Chave do uniforme: `it.kit` (nome do KITS); sem ele, o do time×função. Partida: `main.js kitDoId` →
  `ELENCOS[elencoDoJogador(id)].uniforme.{linha|goleiro}` ('linha0'…); treinadores `kitTecnico(time)`; cortejo/árbitros
  'arbitro'; replay `lerQuadro(..., kitDoId)`.
- Total Match (`?tm`): `identidade.js resolverUniformes` → `kitDoTM` converte {shirt, sleeves, shorts, socks, pattern,
  second, trim} e resolve sem confusão (ΔE₀₀) → `jog3d.definirKits(IDENT.kits)` REESCREVE as chaves linha0/goleiro0/
  linha1/goleiro1/arbitro (o elenco do TM aponta para elas) e zera o cache de cores.
- Cache por vaga (`vagaDe`): chave = id × kit × time × goleiro; só reescreve os atributos de cor quando muda.
- Pele: 8 tons (`PELES`), cabelo: 8 cores (`CABELOS`), sorteados por `sorteio(id, 1|2)` (hash fixo do id). Nenhum
  formato de cabelo, barba, altura ou porte. **Atenção**: no TM o id é `1001+i`/`2001+i` pela ORDEM do elenco no pedido
  — o mesmo jogador do TM pode mudar de pele/cabelo de uma partida para outra; para rosto fixo, a chave tem de ser o
  `tmId` (está em `fichaDe(id).tmId`). O pedido do TM NÃO traz foto, rosto nem tom de pele dos jogadores.
- Números: `fichaDe(id).num` e `camisa` (nome) existem e já aparecem no DOM (`#nome-condutor` em cima do condutor, a
  escalação do pré-jogo, a disputa), mas não no corpo 3D.

### Sombra, LOD, culling, qualidade
- Sombra: luz direcional com mapa 1024 (Média) / 2048 PCFSoft (Alta), câmera ortográfica de ±21 m (±28 na Alta) em
  volta do foco; cápsulas, cabeças e cabelos `castShadow` (Baixa: sem sombra). Mancha de contato (blob 1,15×0,85 m sob
  a pelve, girada pelos quadris; opacidade 0,32 com sombra / 0,5 sem).
- **LOD: nenhum por distância.** Só a malha escolhida UMA vez pela qualidade inicial (`alta` = cápsula 14×4, esfera
  24×16; `media`/`baixa` = 9×2 e 14×10) — se a qualidade cai no meio do jogo (`main.js aplicarQualidade`) a malha não
  muda. `frustumCulled = false` em tudo: todos os jogadores vão sempre para a GPU (e para o mapa de sombra).
- Capacidade: `montar(32)` na criação, `reservar(22 + 2·5 + 1 + 2 = 35)` no main (cena de substituição com 10 trocas,
  4º árbitro e os treinadores); cresce sozinho ×1,25 se precisar.

### Indicadores (no mesmo arquivo)
Anel verde no chão do controlado (`it.x/z/rumo`), seta verde (sprite de tamanho constante na tela, 2,2% do menor lado)
0,42 m acima da cabeça, setas âmbar do chamado pelo PRESSÃO, anel âmbar dos 8 s do goleiro (Regra 12.3, `drawRange`),
anel discreto do "próximo da troca". Todos posicionados pela junta `cabeca` ou por x/z — não dependem das cápsulas.

### 1ª pessoa do replay (`OCULTA`)
`it.ocultar = OCULTA.cabeca | OCULTA.tronco` (só o autor no plano da 1ª pessoa, `main.js:1470`): cabeça/cabelo com
escala 0 e as cápsulas do pescoço, peito, lombar→peito, ombros e braços com raio/comprimento 0 (sobram pelve e pernas).
`tools/lib/replay-g.mjs` (G13) reproduz essa regra pelo nome das juntas.

---------------------------------------------------------------------------------------------------------------------

## 4. Quantos personagens, quanto custa

Máximo desenhado: **jogo 24** (22 + 2 treinadores) · **comemoração 24** · **pré-jogo 27** (22 + 3 árbitros + 2) ·
**substituição até 35** (22 + 10 que entram + 4º árbitro + 2) · **replay ≤ 26 vagas** · Livre ≤ 22.

Triângulos por boneco (conta da three.js 0.170, a mesma do getter `triangulosPorBoneco`):

| Qualidade | cápsula | 16 cápsulas | cabeça | cabelo | mancha | **boneco** | ×24 | ×27 | ×35 |
|---|---|---|---|---|---|---|---|---|---|
| Alta | 308 | 4 928 | 720 | 300 | 2 | **5 950** | 142,8 mil | 160,7 mil | 208 mil |
| Média/Baixa | 126 | 2 016 | 252 | 108 | 2 | **2 378** | 57,1 mil | 64,2 mil | 83,2 mil |

Medido agora (partida demo, semente 4, 600 quadros, câmera de TV):

| | chamadas (mín/med/máx) | triângulos (med/máx) | com × sem os 2 treinadores | CPU "jogadores" (interp. + matrizes) |
|---|---|---|---|---|
| celular 844×390 Média | 26 / 28 / 29 | 90,6 mil / 100,4 mil | 28 = 28 chamadas; +4 756 tri (= 2 × 2 378) | média 0,08 ms, p95 0,2 ms |
| PC 1280×720 Alta | 27 / 29 / 29 | 192,6 mil / 192,6 mil | 29 = 29; +11 900 tri | média 0,08 ms, p95 0,2 ms |

- Os jogadores custam **4 chamadas** (cápsulas, cabeças, cabelos, manchas) + até 5 dos indicadores; no mapa de sombra
  mais 3 (que o `renderer.info` NÃO conta: na three 0.170 o `info.reset()` vem depois do `shadowMap.render`).
- No celular Média os 24 bonecos são **~57 mil dos ~91 mil triângulos (63%)**; no PC Alta ~143 de ~193 mil (74%).
- Tetos que valem para o desenho dos jogadores: pré-jogo celular Média **≤ 40 chamadas / ≤ 130 mil triângulos em todo
  plano** (`teste-prejogo` item 7; hoje o pior plano tem 35 / 122 mil — só ~8 mil de folga, com 27 bonecos = 64 mil);
  o mesmo teto no Livre (`teste-livre-tela` D5); substituição ≤ jogo + 3 chamadas (`teste-substituicao-tela` T9);
  treinadores +0 chamadas e ≤ 2 bonecos de triângulos (`teste-tecnicos-tela` V2); partida ≤ treino + 2 chamadas e CPU do
  quadro p95 ≤ 6 ms / média ≤ 3 ms (`teste-desempenho-celular`); replay ≤ o máximo ao vivo + 1 chamada
  (`teste-replay`).
- Download inicial hoje 2,57 MB de 4 MB (folga ~1,4 MB; `teste-carga` exige folga ≥ 120 KB e lista o que é sob
  demanda em `SOB_DEMANDA_ARQ`). `golaco/assets/` só tem `sons/` (1,4 MB, baixam no 1º gesto) e `tm/` (588 KB); nenhum
  modelo humano, mocap ou rosto.
- Tamanho na tela: na TV do celular o jogador tem ~36–38 px de altura (rosto ~4–5 px: rosto não aparece no jogo). Os
  planos de perto: reação da comemoração 4,8 m fov 30° (o jogador ocupa ~68% da altura), steadicam 6,8 m fov 32°
  (~45%), contraplano 7,5 m, fila do pré-jogo 4,6 m (PESQUISA-PREJOGO: com rosto o trilho pode chegar a 3 m), replays
  lentos, 1ª pessoa e visão do treinador.

---------------------------------------------------------------------------------------------------------------------

## 5. Testes que conferem os jogadores (e o que cobram)

Node (CI, `tools/rodar-testes.mjs`) — conferem a POSE (anim.js), não o desenho:
`teste-patinacao` (pé plantado não desliza, todos os quadros), `teste-inclinacao`, `teste-mergulho` (`maoAlcanca`),
`teste-cabeceio` (cabeça desenhada na bola), `teste-comemoracao`, `teste-substituicao`, `teste-tecnicos`, `teste-cortejo`,
`teste-replay-anel` (G1–G13; G13 = o que a 1ª pessoa desenha), `teste-saot`, `teste-identidade` A1 (LÊ O TEXTO
`export const KITS =` de `render/jogador3d.js` e compara com `IDENTIDADE_PADRAO.kits` — mover o KITS quebra o teste),
`teste-math-proibido` (só `MD` dentro do passo: anim.js está nele), `teste-determinismo`.

Navegador (CI, lista em `tools/rodar-navegador.mjs`): `teste-carga` (erros, ≤ 4 MB com folga, sob demanda, hash Node =
Chromium em 600 passos de treino e de partida), `teste-tecnicos-tela` (V1 treinadores visíveis ≥ 40 px, V2 chamadas
iguais e ≤ 2 bonecos, V6 câmera ≥ 0,6 m da cápsula deles), `teste-prejogo` (≥ 8 andantes na tela, ≤ 40/130 mil),
`teste-replay` (chamadas/triângulos por plano, 1ª pessoa), `teste-comemoracao-tela`, `teste-substituicao-tela` (T9),
`teste-desempenho-celular`, `teste-livre-tela` (D5), `teste-controles` (`__golaco.indicadores`: PRESSÃO e anel dos 8 s),
`teste-estadio`, `teste-hud-minimo` (≤ 15% da torcida atrás do HUD; pixels), `teste-editor-tela`, `teste-penaltis-tela`,
`teste-bola-parada-tela`, `teste-online-tela`, `teste-som-jogo`, `teste-rede-tela`.
Fora do CI: `teste-tm-tela` e `legacy-total-match/ferramentas/testar-3d.mjs` (uniformes do TM; obrigatórios ao mexer em
main.js/desenho), `prints.mjs`, `prints-prejogo.mjs` (folhas de contato), `teste-custo`.

**Lacuna:** nenhum teste confere a forma do corpo desenhado contra a pose (as cápsulas seguem as juntas por
construção). Para o humano com esqueleto faltará um teste novo em Node do "solver" de ossos (juntas da malha = juntas da
pose ≤ 1 mm, sem NaN, sem torção que vira de um quadro para o outro, em poses de jogo, mergulho, cabeceio, comemoração,
treinador e fila).

---------------------------------------------------------------------------------------------------------------------

## 6. Como provar "hash igual"

- O desenho não entra no hash: `hashMundo` (sim.js) só vê a lógica; `render/jogador3d.js` nem é importado em Node.
  **`anim.js` ENTRA** (sim.js usa `pose`/`alturaQuadril`): qualquer mudança nele muda o hash e tem de usar `MD`.
- `node tools/hash-igual.mjs --ref origin/main` — treino de ataque/condução, 4 cenas × 20 sementes × 3 min, compara a cada
  600 passos com `git archive` da base (o padrão `980b0b0` é velho: usar `--ref` do merge/`origin/main`; `--rapido` = 4 ×
  1 min). Sai com código 1 na 1ª diferença.
- `node tools/hash-partida.mjs` (repo × HEAD; ou `--ref origin/main`) — partidas 11×11 demo e humano, a cada 300 passos.
- `node tools/teste-carga.mjs` item 5 — o mesmo hash no Node e no Chromium.
- Prova mais forte para um PR da Etapa 5: `git diff --stat origin/main -- golaco/js/*.js` sem nenhum arquivo de lógica
  (só `js/render/`, `assets/`, `tools/`) + os dois hashes IGUAIS.

---------------------------------------------------------------------------------------------------------------------

## 7. O que isso significa para a troca pelo humano realista

1. **Manter a interface** `criarJogadores3D(cena, qualidade)` / `atualizar(lista, camera)` e o formato da lista: os 7
   montadores de lista (jogo, comemoração, substituição, treinadores, replay, pré-jogo ×2) ficam intocados. Dados que
   faltam (número, nome, tmId, altura, rosto) por um `perfilDe(id)` passado na criação (como o `kitDoId`), em vez de
   mexer nos montadores.
2. **Rotações reconstruídas no desenho** a partir das 19 posições (um módulo PURO em `js/render/`, testável em Node):
   osso longo = eixo A→B + referência de torção (ombros/quadris como o `frente()` de hoje; plano do membro para coxa e
   braço, com o `fInf/fSup` quando o membro está esticado); escala ao longo do osso = |B−A|/repouso (limitada) para o pé
   plantado não sair do lugar; a cabeça na posição da pose (o cabeceio é testado com ela). O que a pose NÃO tem e terá de
   ser inventado no desenho: guinada/olhar da cabeça (pode olhar a bola, que o anel também grava), torção do antebraço,
   mão e dedos, rolagem do pé, clavícula (ombro fixo no peito), respiração, roupa.
3. **Uma chamada para todos**: three 0.170 não tem `SkinnedMesh` instanciado; 24–35 `SkinnedMesh` soltos = 24–35
   chamadas (+ sombra) e estoura o teto de 40. Caminho: skinning instanciado próprio (matrizes de osso de todos numa
   `DataTexture`, `gl_InstanceID`, as cores/padrões por instância como hoje; o mesmo truque no material de sombra) →
   1–2 chamadas, como o manequim.
4. **LOD obrigatório**: com 27 bonecos no pré-jogo e só ~8 mil triângulos de folga, o corpo detalhado só pode ir para
   quem está grande na tela (closes); o resto ~2–2,5 mil triângulos (o de hoje). Precisa de LOD por distância/tamanho na
   tela, que hoje não existe.
5. **Rosto**: só aparece nos closes; atlas/`DataArrayTexture` de retratos FICTÍCIOS carregado sob demanda (fora do
   download inicial), índice por instância, chave estável por `tmId` (o id do TM muda com a ordem do elenco).
6. **1ª pessoa**: o novo corpo tem de saber esconder cabeça e tronco (`OCULTA`) e o G13 tem de continuar valendo.
7. **Física × desenho**: `RAIO_CABECA` 0,115 (cabeça de ~21–25 cm) é constante da física do cabeceio, do impedimento
   (`RAIO_PARTE`) e das câmeras; uma cabeça realista (~15–16 cm de largura) fica menor que a esfera da física — o toque de
   cabeça pode parecer "no ar" ~3–4 cm; não mexer na constante (muda o hash), compensar no desenho (cabelo/volume).
8. **Altura igual para todos**: variar a altura no desenho sem mexer nas pernas (o pé plantado) só no tronco/pescoço
   (±5 cm); pernas maiores fariam o pé patinar.

---

## Etapa 5: modelo humano 3D do jogador (corpo, cabeça, esqueleto). Pesquisa e testes de 22/10

Pasta de trabalho: `$E/`
(abaixo, `$E`). Os downloads ficam em `$E/dl/`, os scripts em `$E/scripts/`, as saídas (GLB e renders) em `$E/out/`.
Não li nem copiei nada de `futebol3d/`.

## 1. Recomendação

Base: **Microsoft Rocketbox Avatar Library, avatar `Sports_Male_02`**. Licença **MIT** (o `LICENSE.md` do repositório,
"Copyright (c) 2020 Microsoft"). É um **jogador de futebol de verdade**: camisa com manga, calção, meião e chuteira com
travas modelados na malha, cabeça realista separada do corpo por material, esqueleto Biped com 80 ossos (52 do corpo,
com os dedos, e 28 do rosto) e pesos de pele prontos. Tem 8.146 triângulos (corpo 5.018, cabeça 3.128) e texturas de 2048².

Ao lado dele:

- **Cabeças e cabelos**: as cabeças dos outros ~70 avatares masculinos do mesmo pacote (mesmo esqueleto, a costura
  do pescoço bate a 1–5 cm, escondida pela gola). Vêm com afro, cacheado em cards com transparência, rabo de cavalo,
  raspado, careca, loiro e tons de pele variados.
- **Animações**: as 471 do próprio Rocketbox (MIT, mesmo esqueleto Bip01: `m_cheer_01..05`, aplausos, ociosos,
  reclamação). Servem para comemoração, pré-jogo e treinadores. Para o jogo em si, a pose continua vindo do `anim.js`.
- **Reserva para variar o corpo, se precisar**: MakeHuman/MPFB2 (CC0). Tem corpo paramétrico (altura, peso, músculo),
  proxies de 3.140 e 1.460 triângulos, rig `game_engine` com pesos e cabelos CC0. Não tem uniforme nem chuteira.

Medido aqui (tudo funcionou nesta máquina):

| item | número |
|---|---|
| LOD0 (close/pré-jogo) | 8.146 tri (corpo 5.018 + cabeça 3.128). Com cabelo em cards (Sports_Male_03): 9.534 |
| LOD1 (TV), Decimate do Blender | 1.798 tri (corpo 1.107 + cabeça 691). `gltf-transform simplify` deu 1.790 |
| Esqueleto do jogo | 22 ossos (pelve, 3 de coluna, pescoço, cabeça, 2×(clavícula, braço, antebraço, mão), 2×(coxa, canela, pé, dedos)) |
| GLB LOD0+LOD1 do corpo e da cabeça | 402 KB bruto → **130 KB com meshopt** (103 KB em gzip) |
| Outras cabeças (corpo+cabeça, 2 LODs, meshopt) | 115–170 KB por avatar |
| Texturas em WebP | cor do corpo 1024² 58 KB (512² 23 KB); cabeça 1024² 58 KB (512² 17 KB); normal 512² 8–23 KB; detalhe do pano em cinza 1024² 53 KB |
| three.js 0.170 + GLTFLoader + MeshoptDecoder (Chromium headless) | carrega em 27 ms, 4 SkinnedMesh, 22 ossos, 0 erro |
| Manequim de hoje (`jogador3d.js`, a conta da geometria) | ~6 mil tri por jogador na Alta e ~2,4 mil na Média/Baixa → o **LOD1 (1,8 mil) é mais barato que o manequim do celular** |

## 2. Candidatos conferidos (a licença foi lida no texto original)

| candidato | licença (fonte) | formato / polígonos / LOD | esqueleto | roupa | veredito |
|---|---|---|---|---|---|
| **Microsoft Rocketbox** (github.com/microsoft/Microsoft-Rocketbox) | **MIT** (`LICENSE.md`; o README diz "11/2020 Updated license to MIT"). O artigo de 2020 ainda fala "research and academic", mas o arquivo de licença do repositório vale | FBX 7.4 (`Export/*.fbx`, ~0,5 MB) + TGA 2048² (cor, normal, especular; cabeça à parte). Só o hipoly está no FBX: 7–10 mil tri. Os LODs do artigo (5 mil/2,5 mil/500) estão só no `.max` | Biped 80 ossos (52 de corpo com dedos + 28 de rosto); `_facial.fbx` com 176 formas-alvo (ARKit 52, FACS, visemas) | `Sports_Male_02` e `_03` com uniforme de futebol e chuteira; `_01` só de sunga (corpo quase nu); 4 Sports masculinos, 2 femininos, 21 adultos | **ESCOLHIDO** |
| **MakeHuman 1.x / MPFB2** (makehumancommunity) | Recursos **CC0** (`LICENSE.ASSETS.md`; `packs/makehuman_system_assets.json` traz `"license": "CC0"` por item); código AGPL/GPL (não vai para o site) | base hm08 13.380 v (~27 mil tri); proxies `male1591` **3.140 tri**, `proxy741` **1.460 tri**, `male_generic` 27 mil; 1.554 alvos (macros de altura/peso/músculo) | `default` (163), `game_engine` (53) com pesos (MPFB2 `data/rigs/standard`) | corpo nu; roupas CC0 e CC-BY sem uniforme de futebol nem chuteira; cabelos CC0 (`short04` 1.050 tri, `short03` 1.922, `afro01` 2.192) | reserva (variação de corpo) |
| **Blender Studio Human Base Meshes v1.4.1** (download.blender.org) | **CC0** (página "Demo Files": "49 MB – CC0") | `.blend`; corpo masculino realista 10.582 v / **21.160 tri** (multires 3); cabeça de animação 6.480 tri | **sem esqueleto e sem pesos** | nu, sem textura | só forma; caro de rigar |
| **Anny** (naver/anny) | código Apache-2.0; dados do MakeHuman CC0; topologia SMPL-X só não comercial | é o MakeHuman em PyTorch (13 mil v) | 104 ossos | nu | não acrescenta nada para o jogo |
| **Mesh2Motion** (scottpetrovic/mesh2motion-app) | código MIT; "art assets CC0" (`LICENSE-CC0.MD`) | manequim estilizado; as "variations" humanas são de terceiros com licença por modelo | sim | — | só as animações CC0 (`human-base/mocap-animations.glb`) |
| **three.js examples** | `LeePerrySmith`: CC BY 3.0, escaneamento de uma pessoa real (só cabeça); `Xbot`/`Michelle`/`Soldier`: "model from mixamo.com" (Adobe, não é CC, não redistribuir solto) | glb | Mixamo | — | descartado |
| **Quaternius Universal Base Characters** | o itch.io diz CC0, mas o site agora publica a "Quaternius Asset Licence" (proíbe redistribuir como pacote/arquivo solto) | ~13 mil tri, estilizado | humanoide | 20 cabelos | descartado (licença incerta, estilo) |
| **Kenney** | CC0 | blocado/estilizado | sim | — | não é realista |
| **CMU** | captura de movimento sem malha (uso livre) | — | — | — | Etapa 5 mocap, não é corpo |
| **Sketchfab CC0/CC-BY** | depende do modelo; o download exige conta e token | — | — | — | não testado: o download pede login |
| SMPL/STAR/MetaHuman/Mixamo/Ready Player Me | não comercial ou EULA fechado | — | — | — | proibidos para o site aberto |

## 3. Comandos que funcionaram

```bash
E=$E
## Blender como módulo Python (Python 3.11 desta máquina): wheel bpy 4.5.14 LTS = 372,8 MB, venv 950 MB, ~2 min
python3 -m venv $E/venv-bpy && $E/venv-bpy/bin/pip install bpy==4.5.14   # importa io_scene_fbx e io_scene_gltf2
$E/venv-bpy/bin/pip install pillow numpy
## Rocketbox: clone raso SEM blobs (o repositório tem GB); depois checkout só do que precisa
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/microsoft/Microsoft-Rocketbox $E/dl/rocketbox
cd $E/dl/rocketbox && git checkout HEAD -- LICENSE.md Assets/Avatars/Professions/Sports_Male_02
##   (atenção: `git ls-tree -l` e `git grep` num clone sem blobs baixam blob por blob, muito devagar; use --name-only)
## MakeHuman (CC0): pacotes zip diretos (o repositório git makehuman-assets não responde mais)
curl -O https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip  # 281 MB
curl -O https://files2.makehumancommunity.org/asset_packs/hair01/hair01_cc0.zip                                     # 228 MB
curl -O https://files2.makehumancommunity.org/asset_packs/skins02/skins02_cc0.zip                                   # 76 MB
## Blender Human Base Meshes (CC0, 50 MB)
curl -O https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip
## gltf-transform (registry do npm é direto): meshopt, quantize, simplify, webp
cd $E/npm && npm install @gltf-transform/cli@4
## Conversão (scripts em $E/scripts, rodar sempre com -I):
$E/venv-bpy/bin/python -I $E/scripts/rocketbox_glb.py <Sports_Male_02.fbx> $E/out/sm02 1800   # < 1 s
$E/npm/node_modules/.bin/gltf-transform meshopt $E/out/sm02_lods.glb $E/out/sm02_lods_mo.glb --level medium
$E/npm/node_modules/.bin/gltf-transform simplify $E/out/sm02_lod0.glb $E/out/sm02_simpl.glb --ratio 0.22 --error 0.01
## Rostos: MediaPipe 1.1.1 (só a API Tasks; o mp.solutions saiu) + modelo de 3,7 MB do storage.googleapis.com
python3 -m venv $E/venv-mp && $E/venv-mp/bin/pip install mediapipe opencv-python-headless   # 13 s, 618 MB
curl -o $E/modelos/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```

Bloqueios da rede: a API do GitHub (`api.github.com`) e as páginas `github.com` dão 403 nesta sessão, mas o
`git clone`/`ls-remote` de repositório público funciona. `www.makehumancommunity.org` tem certificado errado; use
`static.` e `files2.`.

Scripts (todos em `$E/scripts/`):
- `rocketbox_glb.py`: FBX → GLB com 22 ossos. Soma os pesos dos ossos tirados no ancestral, deixa no máximo 4
  influências normalizadas, separa corpo e cabeça (o cabelo com opacidade vai junto da cabeça), faz o LOD1 por
  Decimate e exporta sem textura nem animação.
- `inspecionar.py`, `cabecas.py`, `costura.py`, `facial.py`, `ossos.py`, `inspec_blend.py`: as medições.
- `regioes_render.py`, `comparar_render.py`, `cabeca_render.py`, `variacoes_render.py`: as provas em Cycles na CPU.
- `texturas.py`: o peso das texturas e o mapa de detalhe.
- `marcos.py`: os 478 marcos do MediaPipe num render da cabeça.
- `teste-glb-web.mjs`: o GLB no three.js 0.170 dentro do Chromium, usando o `tools/lib/navegador.mjs` do jogo só para leitura.

Provas visuais (todas em `$E/out/`):
- `comparar.png`: Rocketbox LOD0 e LOD1, MakeHuman male1591 e proxy741, HBM realista.
- `regioes.png`: regiões do uniforme + pose de corrida, LOD0 e LOD1.
- `variacoes.png`: o mesmo corpo com 3 uniformes, 3 cabeças trocadas e as formas normal, forte e magro.
- `cabeca.png`: cabeça LOD0 e LOD1 texturizadas + grade da UV.
- `cabeca_marcos.png`: os 478 marcos achados no render da cabeça.
- `web.png`: o GLB com meshopt no three.js.
- `folha_cabecas.png`: as 25 cabeças masculinas de Adults e Sports.

## 4. Por que o Rocketbox vence

1. **Já é jogador de futebol**: camisa com manga, barra do calção, meião e chuteira com travas existem na geometria.
   Os outros candidatos são corpo nu, e o uniforme teria de ser modelado em cima: mais triângulos e calção
   "pintado" na coxa.
2. **UV por região**: a textura do corpo tem ilhas separadas para camisa (frente e costas, com o número), mangas,
   calção, meião, chuteira e pele. A cabeça tem UV cilíndrica, com o rosto no miolo quase sem distorção (a grade de
   `cabeca.png` mostra as células F4/F5/E4/E5 retas no rosto). Isso serve para projetar o retrato frontal.
3. **Esqueleto e pesos prontos e bons**: a dobra do joelho e do quadril com o calção, em `regioes.png` e `web.png`,
   não rasga. Reduzir a 22 ossos manteve os pesos (soma no ancestral).
4. **Variedade sem trabalho de modelagem**: mais de 70 cabeças masculinas com o mesmo esqueleto, cabelos de todos os
   tipos, 176 expressões faciais e 471 animações.
5. **Licença MIT**: dá para publicar no Pages. Precisa levar o aviso de copyright e a licença num `CREDITOS.md`,
   como já se faz com os sons.
6. O artigo (Gonzalez-Franco et al. 2020) diz que os rostos saíram de fotos de pessoas reais "misturadas e
   fortemente modificadas" para que os avatares sejam "humanos genéricos que não existem". Mesmo assim, o rosto
   será trocado pelo retrato de IA de pessoa fictícia (opção B do dono). Do Rocketbox fica só a forma da cabeça e o
   cabelo.

## 5. Caminho proposto (só desenho; hash igual)

**5.1 Pipeline offline** (bpy + gltf-transform; ferramentas em `golaco/tools/humano/`, fora do site):

1. Importar o FBX e reduzir a 22 ossos (`rocketbox_glb.py`, já funciona). Se o close do rosto pedir olhos que mexem,
   manter `REye`/`LEye` (2 ossos a mais).
2. **Encaixar no esqueleto do jogo.** O Rocketbox tem coxa 0,40, canela 0,40, tornozelo a 0,10 m e quadril 0,177. O
   `config.js JOGADOR` tem coxa 0,45, canela 0,45, tornozelo 0,08 e quadril 0,18. As pernas precisam de +12%:
   escalar os ossos da perna no descanso, aplicar a deformação e gravar como descanso novo, uma vez só e
   determinístico. Assim o pé desenhado cai onde o `anim.js` diz e a bola não muda.
3. **Regiões do uniforme por vértice** (atributo `regiao`: camisa, manga, gola, calção, meião, chuteira, pele). A
   classificação pela cor da textura e pelo osso dominante já acerta quase tudo (`regioes.png`). Erra o logotipo do
   peito e a barra do calção, que viram pele ou camisa. Isso se corrige uma vez numa máscara 256² na UV, porque o corpo
   é um só para todos.
4. Gerar 2 formas-alvo (forte e magro) e o LOD1 pelo `gltf-transform simplify` ou pelo Decimate. O cabelo em cards
   não deve ser dizimado: no LOD1 ele vira uma calota.
5. `gltf-transform meshopt` + texturas WebP. Corpo e cabeça com 2 LODs: ~130 KB. Mapa de detalhe do pano: 53 KB.

**5.2 No jogo** (`js/render/`, sob demanda depois do 1º quadro, com o manequim de hoje até carregar):

- **Da pose aos ossos**: o `anim.js` dá 19 juntas (posições). Para cada osso, a rotação leva a direção do descanso à
  direção da pose (A→B). O giro vem do plano do joelho/cotovelo e, na pelve e no peito, da linha quadril/ombros. É
  conta só do desenho; a simulação não muda e o hash fica igual.
- **Desenho em instância** (como o `jogador3d.js` faz hoje com as cápsulas):
  - Uma `InstancedMesh` com o corpo LOD1 e as matrizes dos 22 ossos de cada jogador numa `DataTexture`
    (27 × 22 × 4 texels, 88×27 RGBA32F, atualizada por quadro). O shader faz o skinning lendo por `gl_InstanceID`
    (patch do `skinning_pars_vertex` por `onBeforeCompile`, e o mesmo no material da sombra).
  - Resultado: corpo = 1 chamada + 1 de sombra.
  - Como comparação, 6 clones `SkinnedMesh` deram 12 chamadas (`web.png`); 27 clones dariam 54 + sombra.
  - Referências: InstancedSkinnedMesh (fórum do three.js e dev.to) e o three-sbml, com matrizes em textura.
- **Cabeças em instância**: uma cabeça-molde LOD1 com UV única, embrulhada (shrinkwrap) na forma de cada cabeça
  Rocketbox. A forma de cada uma vai numa textura de posições lida por `gl_VertexID`, e as texturas de rosto são
  "assadas" para a UV do molde (bake do Cycles) e guardadas numa `DataArrayTexture`.
  - Resultado: 1 chamada para todas as cabeças.
  - O cabelo de malha (afro, cacheado, comprido) fica numa `InstancedMesh` por estilo, até 4.
  - Cabelo curto ou raspado fica pintado na textura da cabeça.
  - O LOD0 (close, pré-jogo, comemoração) usa `SkinnedMesh` comum para os ≤ 4 jogadores grandes na tela.
- **Uniforme no shader**: cor por região vinda do `KITS`/identidade do TM, como hoje. Listras, faixas, gola e manga
  saem da UV da ilha da camisa (vertical na UV = vertical no corpo). O detalhe do pano em cinza multiplica a cor. O
  número das costas sai de uma textura de números.
- **Pele**: o tom do corpo (braços e pernas) é a média da bochecha do retrato do jogador. Em `variacoes.png`, o corpo
  com a cor fixa destoa da cabeça: tem de sair do rosto.
- **Orçamento**: no jogo, 25 × 1,8 mil = 45 mil tri, abaixo das cápsulas de hoje na Alta (~150 mil). No pré-jogo,
  ~45 mil + 4 closes × 6,3 mil ≈ 70 mil para os jogadores. Chamadas: corpo + cabeça + até 4 estilos de cabelo + 2
  sombras ≈ 8, contra 3 + sombra hoje. O pior plano do pré-jogo (35 chamadas) vai a ~40, no limite, e **tem de ser
  medido**.
- **Download**: tudo depois do 1º quadro (o modelo da `SOB_DEMANDA` e dos sons).
  - Elenco de 46 jogadores com ~12 formas de cabeça: 12 × ~70 KB + 46 rostos 512² × 17 KB ≈ 1,6 MB, mais o
    corpo (~0,25 MB).
  - O download inicial (2,57 MB) não cresce.

**5.3 Variações**

- **Porte**: as formas-alvo forte/magro (deslocamento pela normal pesado pelos músculos; prova em `variacoes.png`)
  e a escala de grossura por osso no shader (perpendicular ao osso, sem mudar o comprimento).
- **Altura**: hoje todos têm as mesmas juntas no `anim.js`. Altura variável só no desenho desencaixaria a cabeça do
  cabeceio (`sim.js cabecaNaBola` usa a cabeça desenhada da pose). Ou fica fora, ou entra no `anim.js` com revisão de
  hash: é decisão à parte.
- **Cabelo**: as cabeças Rocketbox já trazem o cabelo. Cabelos CC0 do MakeHuman (`short04` 1.050 tri, `afro01` 2.192)
  podem ser reencaixados por Surface Deform.
- **Expressões**: o `_facial.fbx` tem `JawOpen`, `MouthStretch`, `Smile`, `EyeSquint` etc. Dá para assar 3–4
  formas-alvo (grito do gol, sorriso, cabisbaixo, olhos fechados) só na cabeça LOD0.

## 6. Rostos (próxima frente, já verificado que funciona)

- A UV da cabeça tem o rosto frontal no meio (`cabeca.png`).
- O MediaPipe Face Landmarker (1.1.1, Tasks) achou os 478 marcos no render da cabeça 3D (`cabeca_marcos.png`).
- Caminho:
  1. Render frontal da cabeça com um shader que escreve a UV como cor (tabela pixel → UV).
  2. Marcos no render e no retrato de IA.
  3. Warp do retrato por triângulos dos marcos.
  4. Gravar na textura da cabeça pela tabela pixel → UV.
  5. Emendar com a pele do Rocketbox em degradê, com transferência de cor em Lab.
  6. Tirar a luz lateral do retrato.
- Nada desenhado por código: é foto.

## 7. Riscos e pendências

- **Licença**: o artigo de 2020 diz "free for research and academic use", mas o `LICENSE.md` do repositório é MIT
  desde 11/2020 e é ele que vale. Guardar a cópia do LICENSE com o hash do commit
  (`0943055db6ec570bcef9f2c8b41c9e5467c808f9`) no `CREDITOS.md`.
- **Marcas na textura original**: "FYA MOTORS", "ROCKETBOX" e o escudo são fictícios do Rocketbox, mas não usamos:
  o uniforme é repintado por região e a textura do corpo só entra como detalhe em cinza.
- **Pernas mais curtas** que o esqueleto do jogo (−11%): sem o encaixe do 5.1.2, o pé desenhado não chega à bola.
- **Instância com skinning** não existe pronta no three.js 0.170: é shader próprio (patch do skinning + material de
  sombra). A cabeça única por molde exige o embrulho e o bake; sem isso, cada forma de cabeça é 1 chamada a mais.
  BatchedMesh não tem skinning e depende de `WEBGL_multi_draw` no celular.
- **LOD1 da cabeça com cabelo em cards** fica feio se dizimado: usar calota no LOD1.
- **Chamadas no pré-jogo** (35 → ~40): no limite de 40, medir com o `teste-prejogo` e o `teste-desempenho-celular`.
- **Altura variável** mexe no cabeceio (cabeça desenhada da pose): decisão à parte.
- Os LODs "oficiais" do Rocketbox (5 mil/2,5 mil/500) só existem no `.max` (3ds Max). Usamos os nossos, gerados por
  Decimate ou simplify (testados).
- Pesos: o bpy no CI teria 950 MB. O pipeline roda local e os GLB/WebP gerados vão para o repositório, como as
  fotos de rosto do pedido do ChatGPT.

## 8. Fontes

- Microsoft Rocketbox: https://github.com/microsoft/Microsoft-Rocketbox (LICENSE.md MIT, README com o histórico de
  licença, blendshapes e animações). Artigo: Gonzalez-Franco et al., "The Rocketbox library and the utility of freely
  available rigged avatars", Frontiers in VR 2020, https://www.frontiersin.org/articles/10.3389/frvir.2020.561558/full
  (LODs 10k/5k/2,5k/500, texturas 2048², rostos genéricos a partir de fotos modificadas).
- MakeHuman: https://github.com/makehumancommunity/makehuman (`LICENSE.ASSETS.md`, CC0);
  https://static.makehumancommunity.org/assets/assetpacks.html (lista de pacotes CC0 e CC-BY);
  https://files2.makehumancommunity.org/asset_packs/; MPFB2: https://github.com/makehumancommunity/mpfb2.
- Blender Human Base Meshes: https://www.blender.org/download/demo-files/ ("49 MB – CC0");
  https://download.blender.org/demo/asset-bundles/human-base-meshes/.
- Anny: https://github.com/naver/anny (Apache-2.0 + dados CC0 do MakeHuman).
- Mesh2Motion: https://github.com/scottpetrovic/mesh2motion-app (MIT + CC0).
- three.js examples: `examples/models/gltf/LeePerrySmith/LeePerrySmith_License.txt` (CC BY 3.0);
  `webgl_animation_skinning_blending.html` ("model from mixamo.com").
- Quaternius: https://quaternius.itch.io/universal-base-characters (CC0 na página) e o guia
  https://app.cinevva.com/de/guides/free-rigged-3d-character-models (QAL v1.0).
- Instância com skinning: https://dev.to/sagacheng/using-instancedskinnedmesh-in-threejs-enabling-the-rendering-of-hundreds-of-3d-characters-on-screen-simultaneously-15gm,
  https://discourse.threejs.org/t/optimization-of-large-amounts-100-1000-of-skinned-meshes-cpu-bottlenecks/58196,
  https://unpkg.com/three-sbml-guestgd@0.0.3/README.md.
- gltf-transform (meshopt, simplify, webp): https://gltf-transform.dev/cli ; meshoptimizer (EXT_meshopt_compression).
- MediaPipe Face Landmarker: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

---

## Etapa 5: rosto dos jogadores (pesquisa + teste de ponta a ponta)

Data: 22/10. Pasta de trabalho: `$E/`
(scripts em `scripts/`, saídas em `saida/`, imagens baixadas em `baixados/`, modelos em `modelos/`).
Nada aqui foi para o repositório. Não li nem copiei nada do `futebol3d/`.

## 0. Resumo em 10 linhas

1. **Fonte dos rostos: o SFHQ.** São 4 partes com ~425 mil retratos de 1024². No Kaggle a licença é **CC0** (conferida pela API
   do Kaggle) e o repositório no GitHub é MIT. Também serve o **SFHQ-T2I**: 122,7 mil retratos, licença **MIT** no Kaggle e
   prompts no CSV. Dele usar só as imagens do FLUX.1-schnell (Apache 2.0) e do SDXL (OpenRAIL++). As do FLUX.1-dev
   ficam de fora, porque exigem aviso de "gerado por IA" e têm uma cláusula conflitante.
2. **Dá para baixar daqui sem conta.** O Kaggle redireciona para um zip assinado no Google Cloud Storage. O
   `scripts/zip_remoto.py` lê o diretório central do zip (de 15 a 24 GB) e puxa só os arquivos escolhidos, por faixas de
   bytes (Range). Baixei 184 retratos em ~70 s, cerca de 150 KB cada.
3. **Marcos: o MediaPipe Face Landmarker** (`pip install mediapipe` 1.1.1, licença Apache 2.0). Ele instala no venv, mas
   precisou de `apt-get install libegl1 libgles2`. Detectou **184 de 184 rostos, a 22 ms por imagem** na CPU, e entrega
   478 pontos, 52 blendshapes e a matriz de pose.
4. **Projeção na UV:** os 468 vértices da **malha canônica do MediaPipe** (Apache 2.0, com UV própria) são a correspondência
   entre o retrato e a cabeça. Uma deformação por triângulos da própria malha (898 triângulos, as baricêntricas calculadas
   uma vez) desembrulha cada retrato em ~0,8 s.
5. **Tirar a luz:** primeiro o balanço de branco e a exposição pela esclera (o branco do olho, achado pelos 10 marcos da íris).
   Depois a luz é estimada por harmônicos esféricos de ordem 2 (regularizados), com as normais do rosto da PRÓPRIA pessoa
   (marcos 3D), e dividida. Depois a pele em volta preenche o brilho especular.
   Resultado: a diferença de luz entre a bochecha esquerda e a direita caiu de 0,37 para 0,06 nos aprovados (−83%) e de
   0,60 para 0,16 em todos.
6. **Tom da pele:** a mediana do albedo nas bochechas e na testa. Esse valor vira a cor do corpo (pescoço, braços e pernas)
   e da parte de trás da cabeça. Sem um degradê na borda, a emenda tem ΔE00 de 5,6 a 8,3 (mediana). O degradê é
   obrigatório; meta ΔE00 ≤ 2 no anel de fora.
7. **Preencher atrás da cabeça e as orelhas:** push-pull a partir da pele do próprio retrato e degradê até o tom. O resto da
   cabeça leva o tom mais um recorte de pele da própria foto como detalhe repetido. Nada desenhado por código.
8. **Tamanho da textura:** a maior cena de perto hoje é a "reação" da comemoração (4,8 m, fov 30). Nela a cabeça ocupa
   ~9% da altura da tela: ~70 px físicos no celular e ~100 px num PC 1080p. Na TV do jogo são ~10 px.
   Proposta: **Baixa 128², Média 128² (256² nas cenas), Alta 256²; 512² só se surgir uma câmera mais perto.**
   Os arquivos são minúsculos: em WebP, 256² dá ~4–7 KB e 512² ~12–22 KB. Tudo entra sob demanda, depois do 1º quadro.
   No desenho, uma `DataArrayTexture` com uma camada por rosto mantém **1 chamada de desenho** para todas as cabeças.
9. **Quantos rostos:** 52 fixos no golaco (46 jogadores, 3 árbitros, o 4º árbitro e 2 técnicos). No TM são ~42 por partida.
   **Banco de 256** em 6 faixas de tom (ITA), com ≥ 40 rostos por faixa e variedade de traços, idade de 18 a 36 e barba.
   Cada jogador recebe um rosto por hash do id, sem repetir na partida. Depois o banco pode ir a 512.
10. **A triagem automática aprova 3–15% dos retratos do SFHQ e ~14% dos candidatos do T2I** (pose, expressão, luz,
    cabelo e acessórios). Para 256 rostos é preciso varrer ~3–5 mil retratos (≈ 1 h de máquina) e escolher à mão em
    ~8 folhas de contato. O CLIP em ONNX ajuda a separar homem, mulher, criança e idoso (acertou 67 de 72 contra os prompts).

## 1. Fontes de rostos sintéticos: licença conferida no texto

| Fonte | O que é | Licença (onde conferi) | Serve? |
|---|---|---|---|
| **SFHQ partes 1–4** (David Beniaguev, 2022) | ~425 mil retratos 1024², alinhados como o FFHQ, com marcos (110), segmentação e atributos CLIP | Kaggle: **"CC0: Public Domain"** nas 4 partes (API `datasets/view`); GitHub: MIT; README: "no privacy issues or license issues" | **SIM (principal)**. Ressalva: gerado pelo StyleGAN2 (licença NVIDIA não comercial sobre o código e o modelo; as imagens não são citadas) e treinado no FFHQ (fotos reais), então há chance pequena de um rosto parecer alguém real (Webster et al. 2021, "This Person (Probably) Exists"). |
| **SFHQ-T2I** (2024) | 122.726 retratos de FLUX.1 pro/dev/schnell, SDXL e DALL-E 3, com o prompt de cada um (CSV de 59 MB) | Kaggle: **MIT** | **SIM, filtrando o modelo**: FLUX.1-schnell (Apache 2.0) e SDXL (CreativeML OpenRAIL++-M, a saída é livre). **FLUX.1-dev NÃO**: a licença permite a saída "for any purpose", mas exige aviso de IA (2e) e a seção 4(a) conflita. DALL-E 3 e Flux pro: os termos são da API; evitar. Muitas fotos têm luz de cinema, então a triagem descarta mais. |
| Retrato pelo ChatGPT (o dono) | o caminho já anotado no CLAUDE.md | os termos da OpenAI cedem a saída ao usuário | Complemento para casos específicos. Depende do tempo do dono. |
| Gerar aqui (SD 1.5 na CPU) | ~1–2 min por imagem de 512² | CreativeML OpenRAIL-M | Possível, mas com qualidade pior que a do SFHQ. FLUX-schnell precisa de ~24 GB de RAM (a máquina tem 15). O SDXL-Turbo tem licença NÃO comercial. Não vale a pena. |
| Generated Photos / 100k-faces | banco comercial | pago, com atribuição e sem redistribuição | **NÃO** (pedido do dono) |
| thispersondoesnotexist | StyleGAN2 | sem licença explícita | NÃO |
| Microsoft Face Synthetics / DigiFace-1M | renderizações 3D | só pesquisa, não comercial | NÃO |
| FFHQ / CelebA | pessoas REAIS | CC (Flickr) / pesquisa | **NÃO** (pessoas reais) |

**Recomendação de licença:** o banco sai do SFHQ (CC0) e do T2I filtrado (schnell e SDXL). Cada rosto guarda a origem
(parte e arquivo) num manifesto (`assets/rostos/CREDITOS.md` + JSON), como já é feito com os sons. Nenhum retrato bruto vai
para o git: o manifesto e o `zip_remoto.py` refazem o download.

## 2. Download testado daqui (sem conta, sem custo)

- `GET https://www.kaggle.com/api/v1/datasets/download/selfishgene/<dataset>` responde **302** para um zip assinado em
  `storage.googleapis.com` (anônimo). Atenção: `curl -L` sem faixa começa a baixar os 15 GB inteiros.
- `scripts/zip_remoto.py <url> <pasta> listar|extrair <regex> [n]` lê o fim do zip (EOCD/zip64) e o diretório central
  (~360 a 500 mil entradas, que ficam guardadas em `diretorio.json`) e extrai só os arquivos pedidos, por faixa de bytes.
- Medido: parte 1 (14,9 GB, 359.720 entradas: images, landmarks, segmentations, features) com 40 imagens em 14 s; partes 3
  e 4 com 36 cada; T2I (24,4 GB) com o CSV e mais 72 imagens em 45 s. No total foram **184 retratos 1024²**.
- Folhas de contato: `saida/folha_p1.jpg`, `saida/folha_t2i.jpg`, `saida/folha_clip.jpg`.

## 3. Marcos faciais

| Opção | Pontos | Licença | Teste aqui |
|---|---|---|---|
| **MediaPipe Face Landmarker** (`face_landmarker.task`, float16, 3,7 MB) | 478 (468 da malha + 10 da íris) + 52 blendshapes + matriz de pose 4×4 | **Apache 2.0** (código e modelo) | `pip install mediapipe` 1.1.1 OK; precisou de `apt-get install libegl1 libgles2` (sem isso: `libEGL.so.1` não encontrada). **184/184 detectados, 22 ms por imagem**. A API antiga `mp.solutions` não existe mais, só a `mediapipe.tasks`. |
| MediaPipe Selfie Multiclass (256×256, 16 MB) | máscara: fundo, cabelo, pele do corpo, pele do rosto, roupa, acessórios | Apache 2.0 | OK. Serve para a máscara de pele, cabelo na testa e acessórios. |
| dlib 68 pontos | 68 | código Boost; o modelo `shape_predictor_68` vem do iBUG 300-W, que **exclui uso comercial** | não usar |
| face_alignment (Bulat) | 68 (2D/3D) | código BSD-3; o modelo precisa ser conferido | desnecessário |

A **malha canônica** (`canonical_face_model.obj`: 468 vértices, 898 triângulos, UV por vértice sem conflito, normais
para fora, 15,5 × 17,7 cm) é a peça-chave. O índice do marco é o índice do vértice, então a correspondência
retrato → UV é exata, sem ajuste.

## 4. Projeção do retrato na UV (método e resultado)

`scripts/desembrulhar.py`:
1. **Uma vez só:** rasteriza os 898 triângulos na UV (1024² por dentro, 512² na saída) e guarda, para cada pixel, o
   triângulo e as baricêntricas. A UV do rosto cobre **65% do quadrado**.
2. **Para cada retrato:** a posição na foto de cada pixel da UV é a soma das baricêntricas × os marcos dos 3 vértices,
   aplicada com `cv2.remap` (bilinear). É uma deformação afim por triângulo (piecewise affine), como no `skimage`, só que
   com a triangulação da própria malha e sem Delaunay. A rotação no plano (roll) some sozinha.
3. **Seleção:** |yaw| ≤ 8°, pitch dentro de ±10° da mediana, boca fechada (`jawOpen` < 0,15), sorriso < 0,35, olhos abertos.
   Fica faltando no script, mas é preciso: olhar para a frente (`eyeLook*` < 0,3). Para yaw entre 8° e 15°, dá para
   espelhar o lado escondido (a UV canônica é simétrica em u = 0,5); testei e criou sobrancelha dupla, por isso ficou de fora.
4. **Forma da pessoa (opcional, testado):** os marcos 3D do MediaPipe, alinhados à canônica por Procrustes (com escala), a
   70%, dão o nariz, o queixo e a largura do rosto da própria foto (`scripts/render_face.py`). A textura e a forma combinam.
   No jogo: 1 delta por vértice num `DataArrayTexture`, lido no vertex shader por `gl_VertexID` + camada (continua 1 chamada).

Imagens: `saida/folha_antes_depois.jpg` (retrato → UV final, 20 aprovados) e `saida/render3d.jpg` (a textura na malha 3D,
de frente, a 35° e de perfil, e o mesmo rosto em 96, 32 e 12 px).
Conclusão visual: de frente e a 3/4 parece um rosto 3D de verdade. A 12 px, o tamanho da TV do jogo, vira uma mancha de pele
com olhos e barba escuros. Por isso, no jogo, 32–64² bastam.

## 5. Tirar a luz do retrato (de-lighting)

Testado em 3 versões. A 1ª, com SH9 nas normais canônicas e sem balanço, deixou o nariz estourado e a borda escura. A final:
1. **Balanço de branco e exposição pela esclera:** contorno do olho (16 marcos) menos o círculo da íris (marcos 468/473 e
   raio pelos 469–472, × 1,15); a mediana dos 50% mais claros recebe o alvo sRGB (0,80, 0,78, 0,76). A exposição é
   aplicada só em parte (fator entre 0,7 e 1,6) e a cor da luz é corrigida a 70%. Ideia da cor da esclera como referência
   de branco. O ganho de cor medido tem mediana 1,50 (p90 3,19) em todos e 1,25 nos aprovados. Acima de 1,45 = "luz
   colorida", e o retrato é descartado.
2. **Harmônicos esféricos de ordem 2** (Ramamoorthi & Hanrahan 2001; Basri & Jacobs 2003), por canal, só na pele: sem olhos,
   boca, sobrancelhas e narinas, só a classe "pele do rosto" do segmentador e só onde a normal olha para a câmera (> 0,35).
   Pesos pela frontalidade e regularização de Tikhonov (forte na banda 2). As **normais vêm dos marcos 3D da própria
   pessoa**, e não da malha canônica: isso tirou o nariz estourado. A luz entra limitada entre 0,55 e 1,8 e com expoente
   0,85, ou seja, tira ~85% e não exagera.
3. **Brilho especular:** o pixel da pele mais de 1,35× acima da vizinhança (desfoque normalizado de σ 9) sai e é preenchido
   pelos vizinhos (push-pull).

Medida, com |E − D| / média da luminância linear entre as bochechas:

| Amostra | Antes (mediana / p90) | Depois (mediana / p90) | Testa × bochechas (mediana) |
|---|---|---|---|
| todos (184) | 0,601 / 1,341 | **0,160 / 0,751** | 0,522 → 0,270 |
| aprovados (20) | 0,369 / 0,835 | **0,062 / 0,223** | 0,490 → 0,282 |

Limites honestos: a luz dura do T2I (fotos de cinema) deixa sombra debaixo da sobrancelha. A triagem descarta esses
casos (`sombra forte que ficou`, assimetria depois > 0,35). O SFHQ (alinhado como o FFHQ, luz mais suave) sai melhor.
Melhoria possível sem custo: um modelo aberto de relighting. Não procurei um com licença livre; fica pendente.

## 6. Tom do rosto × tom do corpo (sem emenda)

- O tom é a mediana do albedo, em linear, nas bochechas e na testa → sRGB → Lab → **ITA°** (Chardon 1991; faixas de
  Del Bino 2013: I > 55 muito clara, II 41–55 clara, III 28–41 intermediária, IV 10–28 morena, V −30 a 10 marrom,
  VI < −30 escura). Como referência visual para o dono, a **Monk Skin Tone Scale** (10 tons, CC BY 4.0: #f6ede4 … #292420).
  O ITA foi medido depois do balanço pela esclera. Sem esse balanço, o ITA caía artificialmente (a exposição do retrato pesa).
- **O corpo herda o tom do rosto**, e não o contrário. A lista `PELES` sorteada por id em `render/jogador3d.js` passa a ser
  o `tom` do manifesto.
- Emenda medida, sem degradê: o anel logo fora da malha tem ΔE00 mediano de 5,6 (p90 15,6) para o tom, e a borda do rosto
  tem 8,3 (p90 21,4), puxada pelo cabelo no alto e pela barba no queixo. **É preciso um degradê até o tom nos últimos ~8%
  do raio do rosto.** Meta para o teste: ΔE00 ≤ 2 no anel, com variação suave.
- A mesma luz do jogo nos dois lados: rosto e corpo saem do mesmo material, com a pele vinda da textura ou do tom
  (MeshStandard com `onBeforeCompile`), para não mudar a resposta à luz entre o rosto e o pescoço.

## 7. Atrás da cabeça, orelhas e pescoço

- Fora da malha, a **pele do próprio retrato se estende por push-pull** (Gortler et al. 1996, o mesmo método de preencher
  buracos usado em lightmaps): `empurra_puxa()` no script.
- Para o resto da cabeça (nuca, couro cabeludo e orelhas): o **tom** mais um **recorte de 64² da bochecha da própria foto,
  em passa-alta**, repetido como detalhe. O cabelo é malha à parte, com a **cor tirada do retrato** (mediana dos pixels
  "cabelo" do segmentador, depois do balanço). Barba e sobrancelha ficam na textura.
- **Cabeça (para a frente do corpo combinar):**
  - **A (recomendada para o 1º PR):** a frente da cabeça é a própria malha canônica do MediaPipe (Apache 2.0). Costura-se
    nela uma calota (crânio, nuca e pescoço), feita fora do jogo em Python, a partir das 36 bordas do oval, mais as
    orelhas de uma base CC0. A UV do rosto é a canônica, então nenhum ajuste é preciso.
  - **B (se a frente do corpo escolher uma cabeça CC0:** MakeHuman/MPFB ou Human Base Meshes do Blender Studio): desenhar a
    cabeça de frente, rodar o MediaPipe NO DESENHO dela, levar os 478 pontos de volta à malha por raio e montar uma vez o
    mapa "UV canônica → UV da cabeça". Todo rosto é reamostrado fora do jogo para a UV dessa cabeça.
- **Triângulos:** hoje a cabeça é uma esfera de ~252 triângulos na Média (14×10) e ~720 na Alta (24×16). O pior plano do
  pré-jogo está em 122 mil de 130 mil. A cabeça nova precisa ficar em **≤ ~500 triângulos na Média**: a malha canônica
  reduzida (as UVs ficam por vértice) mais uma calota leve. Os ~1,3 mil (malha inteira + calota) só na Alta, ou só nas
  cenas, se couber.

## 8. Tamanho da textura por qualidade e carga sob demanda

Altura da cabeça (≈ 0,23 m) na tela, pelas câmeras de hoje (fov vertical do three.js):

| Câmera | Distância / fov | % da altura | Celular 844×390 dpr 2 (780 px) | PC 1080p |
|---|---|---|---|---|
| TV do jogo (celular) | ~46 m | ~1,3% | ~10 px | ~14 px |
| Fila do pré-jogo (`filaMandante`) | 4,6 m / 38° | 7,3% | ~57 px | ~79 px |
| Steadicam da comemoração | ~6,9 m / 32° | 5,8% | ~45 px | ~63 px |
| Reação da comemoração | 4,8 m / 30° | **9,0%** | **~70 px** | **~97 px** |

O rosto ocupa ~70% da cabeça na tela. Com 128², ~85 px do rosto chegam à textura, o que basta para as cenas de hoje.
256² dá folga para 4K e para a próxima câmera mais perto.

| Qualidade | Jogo (mip) | Cenas (pré-jogo, comemoração, replay) | VRAM (48 camadas, RGBA8 + mips) |
|---|---|---|---|
| Baixa | 64² | 128² | 1,0 / 4,2 MB |
| Média | 128² | 128² (256² se houver memória) | 4,2 / 16,8 MB |
| Alta | 256² | 256² (512² com câmera nova) | 16,8 / 67 MB |

Arquivo por rosto, medido em 20 aprovados (mediana / máx.):

| Lado | JPEG q85 | WebP q80 |
|---|---|---|
| 64² | 1,3 / 1,5 KB | 0,8 / 1,0 KB |
| 128² | 3,2 / 4,0 KB | 1,8 / 2,4 KB |
| 256² | 9,2 / 11,6 KB | **4,3 / 6,6 KB** |
| 512² | 32 / 45 KB | 12 / 22 KB |

- Uma partida com 42 rostos em 256² WebP ≈ **0,2 MB**, e o banco inteiro de 256 ≈ 1,1–1,7 MB no servidor. Tudo **sob
  demanda**: o 1º quadro desenha com o tom liso (como hoje), e os rostos entram por `import()` + `fetch` ociosos. O download
  inicial não cresce, e o `teste-carga` cobra isso.
- **Formato no jogo:** uma `THREE.DataArrayTexture` (o WebGL 2 já é obrigatório), uma camada por rosto da partida,
  `SRGBColorSpace`, mips gerados. Cada camada vem do WebP decodificado por `createImageBitmap`, passa por um
  `OffscreenCanvas` e vira `getImageData`. A cabeça instanciada ganha um atributo `iRosto`, e o shader lê
  `texture(rostos, vec3(uv, iRosto))`. Continua 1 chamada (+1 na sombra) para todas as cabeças. Atlas 2D de 8×8 só como
  reserva (precisa de borda contra a mistura entre células nos mips).
- KTX2/Basis (UASTC ou ETC1S) reduziria a VRAM 4–8×, mas o transcodificador WASM (~0,5 MB) só compensa na Alta e com 512².
  Fica para depois.

## 9. Quantos rostos e diversidade

- **golaco:** 46 jogadores (ids 1–23 e 101–123), 3 árbitros + o 4º árbitro (id 203) e 2 técnicos (210/211) = **52 fixos**,
  escolhidos à mão no manifesto (`rosto` por id), com mistura de tons e traços. A mesma foto, recortada do retrato
  sintético, pode ser a **foto do jogador** na escalação e no cartão da comemoração (pedido 6 do dono, de 17/10), para o
  elenco do golaco. O TM já manda as fotos dele.
- **TM:** ~42 por partida (2 × 18 + 4 árbitros + 2 técnicos). São milhares de jogadores, alguns com nome real na edição pro:
  o rosto vem SEMPRE do banco fictício (nunca o rosto real), por `hash(id)`, e na partida cada um recebe um rosto
  diferente (sondagem quando dois caem no mesmo).
- **Tamanho do banco: 256** (mínimo de 160, depois 512). A conta: dois times da mesma região, com quase todo mundo numa
  faixa de tom, pedem ≥ 36 rostos diferentes nessa faixa. Por isso são **≥ 40 por faixa × 6 faixas ≈ 240**, mais ~16 para
  equilibrar os traços. Numa temporada do TM (~500 jogadores), cada rosto aparece ~2×.
- **Diversidade:** as 6 faixas de ITA (I a VI) com ≥ 40 cada. Os traços variam dentro de cada faixa: europeu, latino-
  americano, africano, do Oriente Médio, do sul da Ásia, do leste da Ásia, indígena e misto. Idade de 18 a 36, ~35% com
  barba, bigode ou barba por fazer. Sem óculos, chapéu, maquiagem ou piercing. Na amostra baixada, as 6 faixas aparecem.
  Os aprovados de uma amostra pequena saíram desiguais (I 6, II 2, III 2, IV 8, V 1, VI 1), então a coleta tem de mirar a faixa.
- **Atribuição no TM:** a nacionalidade dá uma **distribuição** de probabilidade entre as faixas (nunca um tom fixo: toda faixa
  tem chance em todo país). O hash do id escolhe a faixa e o rosto dentro dela. Sem nacionalidade, vale a distribuição geral.
  É só desenho: o hash da simulação não muda, e os dois aparelhos do online desenham o mesmo rosto.

## 10. Triagem (o que passa) e o tempo para montar o banco

Taxa de aprovação automática medida (`scripts/triagem.py`):

| Fonte | Aprovados | Principais motivos de descarte |
|---|---|---|
| SFHQ p1 | 6/40 (15%) | virado 13, luz colorida 9, sem cor (P&B) 5, expressão 4 |
| SFHQ p3 | 1/36 (3%) | expressão 15 (a p3 sorri muito), virado 14 |
| SFHQ p4 | 3/36 (8%) | expressão 10, luz colorida 9, sombra que ficou 4 |
| T2I (pré-filtrado pelo prompt: homem de 18 a 38, sem acessório) | 10/72 (14%) | virado 26, luz colorida 12, inclinado 8 |

- O T2I tem **3.868 candidatos** (homem de 18 a 38, sem acessório no prompt; 3.487 deles de schnell ou SDXL). A ~14%, isso dá
  ~500 rostos. O SFHQ tem gênero e idade misturados: pelo CLIP, nas 112 imagens das partes 1, 3 e 4,
  ~52% são homens e ~25% são idosos.
- O **CLIP ViT-B/32 em ONNX** (Xenova, quantizado, 150 MB, `onnxruntime`) faz 184 imagens em 9 s e acertou "homem" em 67 de 72
  contra os prompts. Para óculos, dá muito falso positivo. Só como ajuda FORA do jogo: o cartão do modelo desaconselha
  classificar pessoas em uso implantado. A decisão final é de quem olha a folha.
- Faltam filtros: olhar para a frente (`eyeLook*`), óculos (o segmentador só pegou uma parte; folha manual), cabelo nos olhos.
- **Tempo estimado para 256 rostos:** varrer ~4–5 mil retratos (download por faixas com 8 em paralelo: ~10 min; marcos e
  CLIP: ~5 min; desembrulhar a ~0,8 s cada, com 4 processos: ~15 min). Depois, folhas de 48 para a escolha (~8 folhas).
  São ~1 h de máquina mais a escolha.

## 11. Ordem proposta dos PRs (só desenho: `hash-igual`/`hash-partida` IGUAIS em todos)

1. **Ferramentas** em `golaco/tools/rostos/` (que não vão para o site): `zip_remoto.py`, `marcos.py`, `desembrulhar.py`,
   `triagem.py`, `clip_zs.py` e o manifesto. O banco de 256 em `golaco/assets/rostos/` (128², 256² e o JSON).
2. **Cabeça com a UV canônica** (opção A ou B, combinada com a frente do corpo) e o rosto numa `DataArrayTexture`, sob
   demanda. O corpo passa a usar o tom do manifesto. Testes: Node (manifesto: faixas ≥ 40, tamanho por arquivo, nenhum rosto
   repetido nas partidas de 50 sementes, rosto do TM determinístico) e navegador (chamadas e triângulos do pior plano do
   pré-jogo ≤ 40 / ≤ 130 mil na Média; ΔE00 da emenda ≤ 2; download inicial sem crescer).
3. **Forma da pessoa** (deltas dos marcos 3D) e o recorte da foto na escalação e no cartão da comemoração.
4. Depois: olhos com globo (hoje são pintados na pele; na reação a ~100 px ainda passam), boca aberta na comemoração
   (blendshape + interior da boca) e o banco de 512.

## 12. Riscos

- Semelhança com pessoa real (o StyleGAN foi treinado em fotos reais do FFHQ; os modelos de texto viram celebridades). Mitigação:
  T2I sem nomes no prompt, a curadoria olha um por um e descarta rosto parecido com alguém conhecido, e o dono pode vetar.
- Cadeia de licença do SFHQ: o dataset é CC0, mas foi gerado com StyleGAN2, cujo código e modelo são NVIDIA NC. As imagens
  não são citadas na licença, e o jogo é grátis. Se o dono quiser uma cadeia 100% limpa, usar só o T2I schnell (Apache) +
  SDXL (OpenRAIL++), que têm ~3,5 mil candidatos e bastam.
- O link assinado do Kaggle pode exigir conta no futuro. Mitigação: baixar o banco escolhido uma vez (~256 × 150 KB ≈ 38 MB)
  e guardar fora do git, com o manifesto.
- O `mediapipe` 1.1.1 precisa de `libegl1`/`libgles2` no sistema. É só nas ferramentas; o CI não precisa.
- A luz dura do T2I deixa sombra residual: descartar pela triagem e preferir o SFHQ p1/p4.
- Orçamento do celular: a cabeça nova tem de caber em ~500 triângulos na Média, ou o pré-jogo passa de 130 mil.
- A emenda rosto/pescoço é visível sem o degradê (ΔE00 de 5,6 a 8,3): tem teste próprio.

## Fontes

- SFHQ: https://github.com/SelfishGene/SFHQ-dataset (README e LICENSE MIT) e Kaggle `selfishgene/synthetic-faces-high-quality-sfhq-part-{1..4}` (licenseName "CC0: Public Domain")
- SFHQ-T2I: https://github.com/SelfishGene/SFHQ-T2I-dataset e Kaggle `selfishgene/sfhq-t2i-synthetic-faces-from-text-2-image-models` (MIT)
- Licença do FLUX.1-dev: https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md (2d, 2e, 4a)
- MediaPipe (Apache 2.0): https://github.com/google-ai-edge/mediapipe; malha canônica: `mediapipe/modules/face_geometry/data/canonical_face_model.obj`; modelos em storage.googleapis.com/mediapipe-models (face_landmarker float16 v1, selfie_multiclass_256x256)
- CLIP ONNX: https://huggingface.co/Xenova/clip-vit-base-patch32; cartão do modelo: https://huggingface.co/openai/clip-vit-base-patch32
- Monk Skin Tone Scale: https://en.wikipedia.org/wiki/Monk_Skin_Tone_Scale (CC BY 4.0, skintone.google)
- ITA°: Chardon et al. 1991 (Int J Cosmet Sci); faixas de Del Bino & Bernerd 2013 (Br J Dermatol)
- Harmônicos esféricos: Ramamoorthi & Hanrahan 2001 ("An Efficient Representation for Irradiance Environment Maps"); Basri & Jacobs 2003
- Push-pull: Gortler et al. 1996 ("The Lumigraph")
- Semelhança de GAN com pessoas reais: Webster et al. 2021 ("This Person (Probably) Exists")

---

## Etapa 5 — desempenho: 25–40 humanos com pele no celular (three.js 0.170)

Pesquisa + protótipo medido (22/10). Nada foi mexido no repositório. O protótipo fica em
`$E/bench/`:

- `pagina/esqueleto-juntas.js` monta os ossos a partir das juntas (versão 3, sem saltos);
- `pagina/bench.js` desenha as 4 cenas no Chromium;
- `bench-esqueleto.mjs` mede a CPU em Node;
- `saltos.mjs` mede os saltos de orientação;
- `rodar-navegador.mjs` roda no Chromium com a CPU 4× mais lenta e grava os prints `print-*.png`.

## 0. Recomendação em uma linha

Um `InstancedMesh` por LOD (no máximo 4, quase sempre 1–2 na TV), com **skinning na GPU** lendo os ossos de **uma única
`DataTexture` RGBA32F** (3 texels por osso, uma linha por jogador), com **ossos de mundo montados direto das 19 juntas** da pose (sem
hierarquia `THREE.Bone`, sem `SkinnedMesh`), LBS (skinning linear), 25 ossos (19 + 6 ajudantes), sombra por **um procurador LOD3 só na
passada da sombra** (1 chamada). Custo medido: **~0,6 ms de CPU por quadro para 32 jogadores com a CPU 4× mais lenta** (+0,3 ms sobre o
manequim de hoje), **2–5 chamadas na tela + 1 na sombra** (hoje: 4 + 3), e na TV do celular **menos triângulos que hoje**.

## 1. Ponto de partida (o que existe e o orçamento)

- **Pose**: `anim.js` entrega as 19 juntas no mundo (`Float32Array(19×3)`) e o `main.js` interpola. O manequim (`render/jogador3d.js`)
  monta uma base (eixo + "frente") para cada um dos 16 segmentos e desenha tudo num InstancedMesh de cápsulas. A cabeça, o cabelo e a
  mancha de contato ficam em mais 3 InstancedMesh. **A pele nova lê exatamente o mesmo `jg.pose`.** Por isso o replay (o anel grava a
  pose desenhada), a comemoração, a substituição, os técnicos e o cortejo continuam funcionando sem mudança, e o hash fica igual.
- **Manequim hoje, medido**: **2.378 triângulos por jogador na Média** (76.098 para 32). São **~1.520 vértices**: 16 cápsulas de 80,
  mais a cabeça com 165 e o cabelo com 78. Ele usa 4 chamadas na tela e **mais 3 na sombra**.
- **Pegadinha do contador**: no r170, `renderer.info.render.calls` **não conta a passada da sombra**. O `shadowMap.render` vem na
  linha 1218 do `WebGLRenderer.js` e o `info.reset()` na linha 1224, logo depois. O teto "≤ 40 chamadas" dos testes, portanto, é só
  da passada de cor.
- **Teto do celular Média**: pior plano do pré-jogo ≤ 40 chamadas e ≤ 130 mil triângulos. Hoje dá 35 chamadas e 122 mil, e os
  jogadores são ~25 × 2,4 mil ≈ **60 mil** disso.
- **Download inicial ≤ 4 MB**: o `teste-carga` conta bytes **brutos** (o servidor lê o arquivo, sem gzip), medidos 2,5 s depois do
  1º quadro. A folga é de ~1,4 MB.
- **Tamanho do jogador na tela**:
  - TV do celular deitado: 1,8 m = **~38 px CSS = ~57 px reais** (Média 1,5×; a TV mostra 45 m × 0,88 em 844 px);
  - TV do PC Alta: ~51 px CSS, ~102 px reais;
  - closes do pré-jogo, replay e comemoração: 300–585 px reais de altura.
- **Sombra na Média**: mapa de 1024 cobrindo 2 × 21 m, ou seja, texel de 4,1 cm. A sombra de um jogador tem ~44 × 12 texels.

## 2. As opções, comparadas

| Opção | Chamadas (32 jogadores) | CPU por quadro | Serve à pose procedural? | Veredito |
|---|---|---|---|---|
| **`SkinnedMesh` por jogador** (o padrão do three) | 32 na tela **+ 32 na sombra** (+1 por material extra: cabeça e cabelo em material à parte = 64–96) e **32 texturas de ossos** enviadas por quadro | Hierarquia `Bone` + `updateMatrixWorld` + `skeleton.update()`: **240–510 µs** em Node (5–7× o direto); escrevendo `matrixWorld` direto: 57–90 µs | sim | **Não.** Estoura o teto de 40 (o pré-jogo já usa 35). No Chromium do CI (SwiftShader, CPU 4×), a mediana do render foi de 30–100 ms contra 1,1–2 ms do instanciado |
| **`InstancedMesh` + skinning na GPU por `DataTexture`** (Skinned Instancing do GPU Gems 3, cap. 2) | **1 por LOD** (1–4) + 1 na sombra | **0,6 ms (CPU 4×)** para 32, versão 3; 45–145 µs em Node | **sim**: os ossos saem das juntas a cada quadro, nada pré-assado | **Recomendado.** Prototipado no r170 com `onBeforeCompile` e conferido por prints contra o manequim (mesma pose) |
| **`BatchedMesh`** | 1 com `WEBGL_multi_draw` (Android 96%, iOS 99,99%); **sem a extensão, o r170 cai em 1 chamada por instância** | ordena e recorta por instância na CPU | o r170 **não tem skinning** (o `batching_pars_vertex` só traz matriz e cor por instância); daria para remendar com `gl_DrawID` | Não para o corpo. **Sim para o cabelo** (rígido no osso da cabeça: a matriz por instância = a do osso; vários penteados numa chamada só) |
| **VAT** (vertex animation texture) ou animação de ossos pré-assada | 1 | ~0 | **não**: assa clipes fechados, e a pose aqui é função do estado (IK, pé plantado, toque na bola). Exemplo de limite: o "Mesh Animation" (codewriter) só assa no editor e vai até 2.048 vértices por malha | Fora para os jogadores. Serviria para a torcida, que já tem shader próprio |
| **`@three.ez/instanced-mesh`** (InstancedMesh2, MIT, three ≥ 0.159, depende do bvh.js) | 1 por LOD, LOD de sombra, recorte por instância | o `setBonesAt` multiplica `matrixWorld × boneInverse` em 4×4 com a hierarquia `Bone` + `AnimationMixer` (caminho C) | sim | Boa referência (4 texels por osso, envio parcial da textura), mas são ~74 KB de código não minificado e uma dependência a mais, sem build. Melhor um módulo nosso de ~200 linhas, no padrão do `jogador3d.js` |

## 3. Medições do protótipo

Poses **reais**: partida IA × IA do golaco (semente 7), 300 quadros × 22 jogadores, com as vagas 23–32 em cópias. São 25 ossos.

### 3.1 CPU em Node (Xeon 2,1 GHz, máquina compartilhada, 3 rodadas)

| Caminho | 32 jogadores | 40 jogadores |
|---|---|---|
| B) manequim de hoje (16 cápsulas + cabeça + cabelo + mancha) | 37–47 µs | 56–89 µs |
| A) ossos de mundo direto (versão ingênua: mira + referência) → `DataTexture` | 41–45 µs | 48–70 µs |
| **E) versão 3, sem saltos (tronco pelas linhas do corpo, balanço + torção, ajudantes por nlerp)** | **117–145 µs** | **117 µs** |
| D) `THREE.Skeleton`, `matrixWorld` escrita direto | 56–65 µs | 74–90 µs |
| C) `THREE.SkinnedMesh` com hierarquia `Bone` (local = pai⁻¹ × mundo, `decompose`, `updateMatrixWorld`, `update`) | 240–383 µs | 388–509 µs |

- **`Math.hypot` custa 3× no V8.** A mesma conta com `Math.hypot` levou 120–132 µs; com `Math.sqrt(x*x+y*y+z*z)`, 41–44 µs. No
  caminho quente do desenho, só `sqrt`. O desenho não entra no hash, então não precisa do `matdet.js`.
- A versão 3 ainda tem folga de otimização: o laço com desestruturação e as closures. Dá para descer perto dos ~70 µs.

### 3.2 Chromium do CI (SwiftShader, CPU 4× pelo CDP, como o `teste-desempenho-celular`), 844×390, 32 jogadores

| Cena | JS por quadro (média; p95) | Render (mediana) | Chamadas (tela) | Triângulos |
|---|---|---|---|---|
| manequim de hoje (`criarJogadores3D` do jogo, 'media') | 0,22–0,53 ms; 0,9–1,2 | 0,1–1,0 ms | 5 | 76 mil |
| 32 `SkinnedMesh` (LOD1, 3,9 mil tri) | 0,55–1,42 ms; 1,4–4,3 | **30–175 ms** | 33 (+32 na sombra, fora da conta) | 124 mil |
| **1 InstancedMesh com pele na GPU (LOD1)** | **0,24–0,62 ms; 1,0–1,8** | **1,1–2,0 ms** | **2** (+1 na sombra) | 124 mil |
| 3 LODs (4 × 14,2 mil + 8 × 3,9 mil + 20 × 0,86 mil) + procurador de sombra | 0,30–0,74 ms; 1,0–1,7 | 1,6–3,6 ms | **4** (+1 na sombra) | 105 mil |

- **Cuidado ao ler**: o SwiftShader rasteriza na CPU, então médias e p95 do render têm picos de fila do processo de GPU (até
  centenas de ms com a máquina carregada; a carga média chegou a 4 nos 4 núcleos). Comparar só a **mediana** e a **razão** entre as
  cenas. Tempo de GPU não serve aqui: medir num aparelho de verdade.
- `performance.now()` no Chromium vem arredondado a 0,1 ms. Vale a média de 240 quadros.
- **Prints de conferência**: `print-instanciado-perto.png` × `print-manequim-perto.png` mostram a **mesma pose** com os corpos com
  pele (ossos das juntas) e o manequim. `print-lods-tv.png` mostra a TV com a sombra do procurador.

### 3.3 Bytes por quadro

O caminho recomendado envia **uma** textura: 25 ossos × 3 texels × 16 B = **1,2 KB por jogador**. São 38,4 KB para 32 e 48 KB para
40, por `texSubImage2D`: o r170 usa `texStorage2D` uma vez e depois só sub-envio. O `SkinnedMesh` envia 32 texturas de 12×12
(2,3 KB cada) e faz 32 trocas de textura.

## 4. Ossos a partir das juntas (o coração da coisa, e o risco nº 1)

A pose só tem **posições**. A rotação de cada osso precisa ser inventada sem saltos. O protótipo mediu isso em 4 partidas
(316.664 jogador × passo de 1/60 s, sem os teletransportes dos recomeços). "Do esqueleto" quer dizer giro > 40° num passo com as
juntas do osso mudando < 20°, ou seja, salto inventado pela montagem.

| Versão | Como monta | Saltos "do esqueleto" |
|---|---|---|
| v1 ingênua | eixo + "frente" projetada no chão + dobra com o sinal escolhido pelo lateral; ajudantes pela soma dos eixos | milhares (coxa/joelho ~2.000 por perna; ajudante do quadril ~8.000–9.000) |
| v2 | polo da dobra + mistura com "cima" | pior nas pernas (5.500 na canela, 7.900 no pé) |
| **v3** | **tronco pelas LINHAS do corpo** (X = quadril E→D ou ombro E→D, Y = coluna), bem definido também deitado, no mergulho do goleiro; **membros: balanço** (menor arco do eixo "parado em relação ao pai" no bind até o eixo de agora; só é singular com o membro invertido em relação ao pai, o que é anatomicamente impossível) **+ torção** só na coxa e no braço, pela normal do plano da dobra com o **sinal natural**, misturada (como vetor) à referência de membro reto (perna: pé × coxa; braço: sem torção) e **com a mesma conta no bind** (torção zero por construção); **ajudantes = nlerp das matrizes de PELE** (perto da identidade; o nlerp das matrizes de MUNDO caía no caso antípoda, pelve com Y para cima × coxa com Y para baixo) | **86 em 316.664 (0,03%)**. Tronco e cabeça: no máximo **19°/passo**, 0 saltos |

**Achado do lado da pose**: o pé (tornozelo → ponta) da `anim.js` gira **40–99° num único passo** em ~0,6% dos passos (~485 por perna
por partida de 2 × 1 min). Acontece no pé no ar, no começo do balanço, pelo `pe.lrumo`. A chuteira do manequim faz o mesmo hoje. A
pele vai mostrar igual, porque a torção da coxa segue o pé quando a perna está quase reta. Isso é um ajuste separado na
`jogador.js`/`anim.js`: suavizar o rumo do pé no ar. **Mexe na pose e, portanto, no hash** (a pose entra na simulação pela
`alturaQuadril` e pela cabeça no cabeceio). Ou então suavizar só no desenho.

**Teste a criar** (`teste-ossos`, Node, padrão): 0 saltos "do esqueleto" > 40°/passo fora dos cortes, e tronco ≤ 20°/passo, em
≥ 8 sementes. O modelo é o `saltos.mjs`. Casos de borda a cobrir: mergulho do goleiro, cabeceio (pulo), comemoração (braços para o
céu, joelhos), cortejo.

Detalhes que já valem:

- `OCULTA` (1ª pessoa do replay): escrever matriz de escala zero nos ossos da cabeça e do tronco.
- Altura por jogador: a pose usa 1,8 m e coxa/canela de 0,45 m para todos. Esticar o corpo tiraria o pé do ponto plantado. Variar
  só o "porte" (morph de largura por instância) e talvez cabeça e pescoço.

## 5. LBS × dual quaternion

- **Linear (LBS)**: é o do three. Tem custo mínimo e aceita escala. O defeito conhecido é o "doce embrulhado" (*candy wrapper*,
  perda de volume na torção) e o joelho e cotovelo "murchos" em dobra forte. **Aqui a torção é pouca**: a mão não tem rotação
  própria (sai do antebraço e do plano do cotovelo), então o antebraço não torce. A torção do tronco (ombros × quadris, até ~45–60° no
  chute) vai repartida entre pelve → lombar → peito, e a da coxa é pequena. Os 6 ajudantes de meio-giro (joelhos, cotovelos,
  quadris; nlerp na CPU, quase de graça) seguram o volume nas dobras.
- **Dual quaternion (DQS, Kavan et al. 2007)**: ~7 instruções a mais no vertex shader. Sem escala e cisalhamento (precisa de uma
  segunda passada, +29 instruções). Pode "virar" pelo caminho mais curto. O artigo da Disney (2013) diz que não é troca direta,
  precisa ser misturado com o LBS. O three não tem DQS nativo.
- **Decisão: LBS + coluna em 3 ossos + ajudantes.** DQS só se os closes mostrarem defeito que os ajudantes não resolvem.

## 6. LOD (níveis de detalhe)

Base das fontes:

- guia de geometria do Android: triângulo > 10 px² e −50% por nível. A demo "Armies" desenha personagens de **~360 triângulos**;
- Assassin's Creed Unity (GDC 2015): multidão distante com **~1,7–2 mil polígonos e 11 ossos**, perto com até **20 mil e 300 ossos**,
  limitado a 40;
- GPU Gems 3: LOD escolhido por instância, por quadro, na CPU.

Na TV do celular o jogador tem ~57 px reais por ~15 de largura, ~500 px² de silhueta. O manequim de hoje (2,4 mil triângulos, ~1.200
de frente) já fica **abaixo de 0,5 px² por triângulo**, densidade sobrando.

| LOD | Quando (altura projetada em px reais; histerese de ±10%) | Triângulos (corpo + cabeça) | Influências | Texturas | Onde aparece |
|---|---|---|---|---|---|
| LOD0 | ≥ 280 px | **8–10 mil** (cabeça ~2–2,5 mil) | 4 | rosto 512² (o "herói" do close: 1024²), mapa de normais | close do pré-jogo, comemoração, 1ª pessoa e visão do treinador no replay. **No máximo 2 de uma vez** |
| LOD1 | 120–280 px | **~4 mil** | 4 | rosto 256², normais | planos médios, câmera da bola parada |
| LOD2 | 60–120 px | **~1,6–2 mil** | 2–3 | rosto 128² (mip) | TV do PC Alta (~102 px) |
| LOD3 | < 60 px | **~800–1.000** | 2 | **sem rosto** (cor da pele e do cabelo, como hoje), sem normais | **TV do celular no jogo** (~57 px). Também é o procurador da sombra de todos |

- **Teto dinâmico de triângulos dos jogadores**: na Média, **≤ 60 mil**, o mesmo que o manequim gasta hoje no pré-jogo, sem recuo.
  Escolher a LOD pela altura na tela e, se a soma passar do teto, rebaixar os mais distantes primeiro.
- TV do celular no jogo: 25 × ~0,9 mil ≈ **22 mil**, contra os ~60 mil de hoje. **Sobram ~38 mil para o estádio e a torcida.**
- Pior caso do pré-jogo dentro do teto, por exemplo: 2 × 10 mil + 5 × 4 mil + 8 × 1,8 mil + 10 × 0,9 mil ≈ 63 mil. O teto rebaixa um
  LOD2 e cabe nos 130 mil.
- Chamadas: 1 por LOD não vazia (na TV, 1–2) + mancha 1 + sombra 1 (fora da conta do `info`). Hoje são 4 + 3 na sombra.
- O protótipo usou cápsulas (14,2 mil / 3,9 mil / 0,86 mil). Os números da tabela são para a malha humana de verdade (topologia
  limpa, triângulos perto de equiláteros; o guia do Android pede evitar os finos e compridos).

## 7. Sombras

- **Procurador só da sombra**: um InstancedMesh com a LOD3 de todos, `castShadow = true`, e as LODs da tela com
  `castShadow = false`. Resulta em **1 chamada de sombra** com ~25 × 450 vértices.
- **Atenção, r170**: a passada da sombra testa as **camadas da câmera PRINCIPAL** (`WebGLShadowMap.js`, linha 335:
  `object.layers.test(camera.layers)`, onde `camera` é a da tela). **Pôr o procurador numa camada só da luz não funciona**: testado,
  a sombra sumiu.
- **O que funciona (testado, print com a sombra)**: na passada de cor, `onBeforeRender` põe `count = 0` e `onAfterRender` devolve o
  `count`. O `renderInstances` do r170 sai sem desenhar com 0 instâncias (`if (primcount === 0) return`).
- **Alternativa mais simples**: cada LOD projeta a própria sombra (1–4 chamadas de sombra). Na TV fica tudo na LOD3, então 1.
- O material de sombra (`customDepthMaterial` = `MeshDepthMaterial` com o mesmo remendo do skinning) já é o padrão do manequim
  (`materialSombraSegmentos`).
- Sem sombra (Baixa): a mancha de contato de hoje (1 chamada).

## 8. Materiais

- `MeshStandardMaterial` com `onBeforeCompile`, como o manequim, mantém a mesma luz, sombra, névoa e tonemapping do estádio.
  `MeshLambertMaterial` na Baixa. O custo por fragmento é pequeno na TV (32 × ~500 px²) e só pesa nos closes, onde são 1–2
  jogadores.
- **Remendo validado no r170** (os trechos existem no `meshphysical` e no `depth`):

```glsl
// declarações (depois de #include <common>)
attribute vec4 skinIndex; attribute vec4 skinWeight;   // sem USE_SKINNING o three não declara
attribute float iSlot;                                  // linha do jogador na textura (as LODs reordenam as instâncias)
uniform highp sampler2D uOssos;                         // RGBA32F, NEAREST, largura = 3 × nº de ossos
mat4 ossoDe(float i) {
  int x = int(i) * 3, y = int(iSlot);
  vec4 a = texelFetch(uOssos, ivec2(x, y), 0), b = texelFetch(uOssos, ivec2(x + 1, y), 0), c = texelFetch(uOssos, ivec2(x + 2, y), 0);
  return mat4(a.x, b.x, c.x, 0., a.y, b.y, c.y, 0., a.z, b.z, c.z, 0., a.w, b.w, c.w, 1.); // 3×4 por linhas → mat4
}
// depois de #include <skinbase_vertex>: soma as matrizes (1 multiplicação por vértice em vez de 4)
mat4 mPele = ossoDe(skinIndex.x) * skinWeight.x + ossoDe(skinIndex.y) * skinWeight.y
           + ossoDe(skinIndex.z) * skinWeight.z + ossoDe(skinIndex.w) * skinWeight.w;
// depois de #include <skinnormal_vertex>:  objectNormal = mat3(mPele) * objectNormal;
// depois de #include <skinning_vertex>:    transformed = (mPele * vec4(transformed, 1.0)).xyz;
```

- **Custo por vértice**: 12 `texelFetch` + ~100 operações. Na LOD3 cai para 6 fetches (2 influências, por `#define` da LOD).
  Comparando com hoje: na TV, ~450–550 vértices por jogador com um shader ~3–4× mais caro, contra os ~1.520 baratos do manequim. **O
  custo de vértice fica parecido com o de hoje.** Se ficar preso em vértice: osso em 2 texels (quatérnion + translação).
- **Dados por jogador numa 2ª `DataTexture`**, não em atributos: cores do uniforme, pele, número, camada do rosto, penteado,
  bandeiras. O WebGL2 garante só 16 atributos, e já se usam `position`, `normal`, `uv`, `skinIndex`, `skinWeight`,
  `instanceMatrix` (4), `instanceColor` e `iSlot` = 11.
- Padrões do uniforme (listras, metades, faixa, aros do TM) pelos **UVs**, com uma textura de **máscara de partes** comum a todos
  (camisa, calção, meião, chuteira, detalhe). O número das costas sai de um **atlas de 10 dígitos** com o número por jogador. Nada de
  textura por jogador para o uniforme.
- Compilar os programas na carga com `renderer.compileAsync` (r158+, `KHR_parallel_shader_compile`), para não engasgar no 1º close.
  São ~4–6 programas: cor por LOD + sombra.

## 9. Rostos e cabelo

- **Rosto = pele da cabeça pela UV**, numa `DataArrayTexture` (`sampler2DArray`). O WebGL2 garante ≥ 256 camadas e o r170 tem
  `DataArrayTexture` com envio por camada (`addLayerUpdate`).
  - 256² RGBA8 com mips ≈ 350 KB por jogador, **~11 MB** para 32;
  - herói do close em 1024² (2 camadas, ~11 MB).
  - Arquivos: JPEG/WebP de ~15–25 KB cada (46 do elenco ≈ 1 MB), **baixados sob demanda** depois do 1º gesto, como os sons.
  - Na LOD3 não usa rosto.
- KTX2/Basis (ASTC/ETC2 na GPU, 4–8× menos memória) é opcional. O transcodificador custa 515 KB brutos de wasm + 56 KB de js
  (247 + 15 KB com gzip), sempre sob demanda.
- **Cabelo**: malha rígida presa ao osso da cabeça, num **`BatchedMesh`** com 4–6 penteados. É 1 chamada com `WEBGL_multi_draw`
  (Android 96%, iOS 99,99%, segundo o web3dsurvey); sem a extensão, o r170 faz 1 chamada por instância. A matriz por instância é a
  matriz de mundo do osso da cabeça (já calculada). O alternativo é o cabelo como parte da cabeça, pintado na própria camada do rosto
  (0 chamada a mais).

## 10. Limites do WebGL2 no celular (web3dsurvey)

| Limite | Android | iOS | O que decide |
|---|---|---|---|
| `MAX_VERTEX_UNIFORM_VECTORS` | **256** em 41% dos aparelhos (todos ≥ 256) | 1024 | 32 esqueletos × 25 ossos × 3 vec4 = **2.400 vec4: não cabe em uniform** → textura |
| `MAX_UNIFORM_BLOCK_SIZE` | ≥ 16 KB em 100%, 64 KB em 97% | **16 KB** em 100% (64 KB em 1%) | UBO de 1.024 vec4 também não cabe → textura |
| `MAX_TEXTURE_SIZE` | ≥ 4096 em 100% | ≥ 8192 | a textura dos ossos tem 75 × 40 texels; o atlas e o array de rostos cabem com folga |
| Textura float em vertex shader | RGBA32F com NEAREST + `texelFetch` é núcleo do ES 3.0, sem extensão | idem | não precisa de `OES_texture_float_linear` |
| Atributos de vértice | mínimo 16 | 16 | ver §8 (usar a textura de dados por jogador) |
| Índices | só 16 bits garantidos: **≤ 65.535 vértices por malha** (guia do Android) | — | a LOD0 tem ~6–8 mil vértices |
| `WEBGL_multi_draw` | 96,4% | 99,99% | `BatchedMesh` numa chamada (cabelo) |

Precisão: guardar os ossos em float32 no mundo. Com half-float, a ±52 m o passo seria de ~3 cm. Só valeria com os ossos relativos à
pelve e a pelve num atributo float32, e não compensa: são 48 KB por quadro.

## 11. CPU por quadro, estimativa para 40 esqueletos

- **Ossos (v3)**: ~120–150 µs no Xeon e **~0,6 ms com a CPU 4×**, a régua do repositório para o celular. São +0,3 ms sobre o
  manequim. Otimizada, a v3 deve chegar a ~0,4–0,5 ms. Um aparelho de entrada (~8×) fica em ~1 ms.
- Envio: 48 KB por quadro (`texSubImage2D`), 1 vez.
- Escolha da LOD + recorte por esfera: 40 testes, desprezível.
- **Cabe no `teste-desempenho-celular`**: CPU por quadro com média ≤ 3 ms e p95 ≤ 6 ms com a CPU 4×. A parcela "jogadores" de hoje
  já é medida à parte (`medirQuadro`): cobrar ≤ +0,5 ms nela.
- **Não usar**:
  - `THREE.Bone`/`SkinnedMesh` (5–7× mais caro na CPU e N chamadas);
  - `Math.hypot` no laço (3×);
  - alocação por quadro (usar `Float32Array` fixas e escrever direto no `.image.data` da `DataTexture`).

## 12. Download e carga

- **Corpo (4 LODs ≈ 11–12 mil vértices)**: quantizado a ~24 B por vértice (posição int16, normal oct8, UV uint16, ossos e pesos
  uint8) + índices de 16 bits.
  - ≈ **0,4 MB brutos** num `.bin` próprio, convertido offline por uma ferramenta em `tools/`, com leitor de ~3 KB;
  - ou ~150 KB com meshopt, mais 25 KB brutos do decodificador e 110 KB do `GLTFLoader`.
  - Recomendação: o `.bin` próprio, sem `GLTFLoader`.
- Carregar **depois do 1º quadro / no "Toque para começar"**, com o manequim desenhando até chegar (troca só de desenho, hash igual).
  Assim não entra no download inicial (o `teste-carga` conta até 2,5 s depois do 1º quadro).
- Rostos (~1 MB) e penteados sob demanda.

## 13. Riscos

1. **Orientação dos ossos**: resolvido no protótipo (86 saltos em 316 mil), mas ainda sem a malha humana de verdade nem os casos de
   borda (mergulho, cabeceio, comemoração). Exige o `teste-ossos`.
2. **O pé da pose gira 40–99° num passo** (~0,6% dos passos): a pele mostra. Corrigir na pose mexe no hash. Corrigir só no desenho
   não mexe. Decidir.
3. A GPU do celular **não foi medida** (o CI desenha em software). Medir num Android médio (Mali-G52/G57) e num iPhone antes do
   merge, com `?perf` e `EXT_disjoint_timer_query_webgl2` onde existir.
4. Memória de textura dos rostos (~11–22 MB sem compressão) nos aparelhos de 3 GB. KTX2 se precisar.
5. LBS nos closes: joelho e cotovelo em dobra forte. Os ajudantes seguram; DQS fica de reserva.
6. Compilação de shaders no 1º close: `compileAsync` na carga.
7. O `info.render.calls` não conta a sombra: o teto de 40 dos testes é só da cor. Contar a sombra à parte num teste novo, para a pele
   não esconder custo.

## 14. Fontes

- three.js r170, código lido:
  - `ShaderChunk/skinning_pars_vertex` (4 texels por osso, `texelFetch`);
  - `objects/Skeleton.js` (`computeBoneTexture`: textura quadrada de float por esqueleto; `update()` multiplica `matrixWorld × boneInverse`);
  - `webgl/WebGLObjects.js` (`skeleton.update()` 1×/quadro dentro do render);
  - `objects/BatchedMesh.js` e `ShaderChunk/batching_pars_vertex` (sem skinning; `gl_DrawID`/`_gl_DrawID`);
  - `WebGLRenderer.js` (fallback do multi-draw = 1 chamada por desenho; `info.reset` depois do `shadowMap.render`);
  - `webgl/WebGLShadowMap.js` (camadas da câmera principal);
  - `webgl/WebGLIndexedBufferRenderer.js` (0 instâncias não desenha);
  - `objects/InstancedMesh.js` (`setMorphAt` / `morphTexture` por instância);
  - `webgl/WebGLTextures.js` (`texStorage2D` + `texSubImage2D`). Tudo de cdn.jsdelivr.net/npm/three@0.170.0/src/.
- Fórum do three.js:
  - "Animated Instanced Skinned Meshes (GLTF)": https://discourse.threejs.org/t/animated-instanced-skinned-meshes-gltf/41958 e a página 2 (o `getBoneMatrix` com `gl_InstanceID`, a correção do Sceat, as LODs do agargaro com menos ossos);
  - InstancedMesh2: https://discourse.threejs.org/t/three-ez-instancedmesh2-enhanced-instancedmesh-with-frustum-culling-fast-raycasting-bvh-sorting-visibility-management-lod-skinning-and-more/69344, https://github.com/agargaro/instanced-mesh e o código do pacote no npm (`src/core/feature/Skeleton.js`);
  - textura por instância (`DataArrayTexture` + índice): https://discourse.threejs.org/t/how-to-change-texture-per-instance-in-instancedmesh/36304;
  - pose por juntas → rotação dos ossos (o problema da torção): https://discourse.threejs.org/t/how-to-transfer-3d-joints-position-to-rotation-of-limbs-torso/48645.
- NVIDIA:
  - GPU Gems 3, cap. 2, "Animated Crowd Rendering" (Dudash): https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch02.html (3 texels por osso, LOD por instância na CPU, ~9.500 personagens a 34 qps numa 8800 GTX);
  - white paper "Skinned Instancing": https://developer.download.nvidia.com/SDK/10/direct3d/Source/SkinnedInstancing/doc/SkinnedInstancingWhitePaper.pdf.
- GDC 2015, "Massive Crowd on Assassin's Creed Unity: AI Recycling" (Cournoyer, Ubisoft): https://gdcvault.com/play/1022141/Massive-Crowd-on-Assassin-s, com os números das camadas no resumo da Game Watch: https://game.watch.impress.co.jp/docs/news/20150307_691715.html.
- Android, otimização de geometria (micro-triângulos, −50% por LOD, 16 bits, Armies com 360 triângulos): https://developer.android.com/games/optimize/geometry.
- Kavan et al., "Skinning with Dual Quaternions": https://users.cs.utah.edu/~ladislav/dq/.
- Disney, "Enhanced Dual Quaternion Skinning for Production Use": https://www.disneyanimation.com/publications/enhanced-dual-quaternion-skinning-for-production-use/.
- Autodesk Maya, métodos de skinning (o "bow tie/candy wrapper"): https://help.autodesk.com/cloudhelp/ENU/MayaCRE-CharacterAnimation/files/GUID-630C335C-B63E-4F2E-A4A4-AEA1DD00B0D6.htm.
- web3dsurvey:
  - https://web3dsurvey.com/webgl2/parameters/MAX_VERTEX_UNIFORM_VECTORS
  - https://web3dsurvey.com/webgl2/parameters/MAX_UNIFORM_BLOCK_SIZE
  - https://web3dsurvey.com/webgl2/parameters/MAX_TEXTURE_SIZE
  - https://web3dsurvey.com/webgl2/extensions/WEBGL_multi_draw
- VAT e os limites do pré-assado: https://gitee.com/wuwuhb/UnityGpuInstancedAnimation e https://awesome.ecosyste.ms/projects/github.com%2Fcodewriter-packages%2Fmesh-animation.
- Orçamentos de chamadas na web (regras práticas, não oficiais): https://abratabia.com/mobile-browser-performance/reducing-draw-calls.php.

---

## Etapa 5: captura de movimento (mocap) no GOLAÇO. Pesquisa e medições de 22/10

Pasta de trabalho: `$E/` (abaixo `$E`).
Downloads em `$E/dl/` (`cmu/`, `cmu2/`, `rb-anim/`, `100style/`, `lmm/`), scripts em `$E/scripts/`. Não li nem copiei nada de
`futebol3d/`. Nada pago foi usado.

## 0. Resumo e decisão

- **O que fazer:** uma camada de mocap **só no desenho**, por cima da pose de hoje. Ela é uma função pura de
  `(pose do anim.js, j.fase, velocidade, aceleração, id, cena/clipe, tempo)` e escreve na CÓPIA desenhada (`e.atu` no
  `main.js`). Nunca entra no `sim.js`. O `anim.js` não muda, então `hash-igual` e `hash-partida` ficam IGUAIS, a resposta
  não ganha atraso (a camada não guarda estado) e os pés continuam os pontos plantados da simulação.
- **Duas camadas:**
  - **A, locomoção (o jogo todo):** ciclos de andar, trotar e correr capturados, reamostrados pela FASE da passada que o
    jogo já tem (`j.fase`: o pé 0 pousa nos inteiros pares, o pé 1 nos ímpares) e misturados pela velocidade. A camada A
    mexe em pelve (só rotação), coluna, clavículas, braços, cabeça e rolagem do pé. As pernas continuam pela IK do jogo.
  - **B, cenas (comemoração, treinadores, pré-jogo, substituição):** clipes de corpo inteiro gravados no lugar, com os pés
    presos por IK nos pontos que a cena já calcula. A troca de um clipe para outro é feita por inertialization pura.
- **Fontes que servem** (licença lida no texto original): **CMU** ("free for all uses", sem revender os dados),
  **Microsoft Rocketbox** (MIT, e é o MESMO esqueleto do corpo escolhido pelo estudo do corpo: corridas, comemorações,
  aplausos, gestos de reclamar, respiração parada) e **100STYLE** (CC BY 4.0, com crédito: andar e correr de costas e de
  lado). **Não servem:** Bandai Namco (CC BY-NC 4.0), LAFAN1 da Ubisoft (CC BY-NC-ND 4.0), Mixamo (proíbe distribuir os
  arquivos brutos, e um jogo web entrega o arquivo a quem abre a página), OmniContact (CC BY-NC 4.0) e o conjunto de
  futebol do SMGDiff (sem licença publicada). **Não achei mocap de futebol livre** (drible, proteção, carrinho).
- **Por que vale a pena (medido):** a pose de hoje tem a pelve sempre nivelada (obliquidade 0° contra 8–13° na captura),
  o tronco quase não balança de lado (2,4–3,2° contra 6–13°), o cotovelo fica aberto demais (97–127° contra 66–83° no
  ângulo interno) e o braço balança demais em velocidade (94–106° contra 52–67°). Na captura, a cabeça oscila menos que o
  tronco (11 de 14 ensaios); hoje a cabeça é só um ponto, sem orientação.
- **Tamanho e custo:** 32 bits por quaternion ("smallest three") com erro médio de 0,09° (máximo 0,19°). A camada A
  inteira (8 ciclos × 32 amostras × 14 ossos) ocupa **~14 KB**. Os clipes de cena (22 ossos a 30 Hz) custam 2,6 KB/s
  sem compressão e **1,0–1,6 KB/s** em delta int8 com gzip: ~60–120 KB para 40–60 s de cenas, carregados sob demanda.
  Na CPU, 22 jogadores × 14 ossos levaram **63 µs por quadro** no Node desta máquina; no celular devem ficar em ~0,3–0,4 ms.
- **Motion matching (For Honor, The Last of Us Part II) e o HyperMotion (FIFA) não cabem aqui.** O MM de locomoção do
  artigo do Learned Motion Matching ocupa 52 MB, o LMM 5,3 MB, e o PFNN leva 1.370 µs por personagem. Os três precisam de
  horas de captura própria e mandam no corpo (raiz e pés), e aqui quem manda é a simulação. Aproveito as ideias: a fase,
  casar poucos ossos (os pés), inertialization e dance cards caso o dono grave capturas próprias no futuro.
- **Dá para entregar ANTES do corpo realista:** a camada A também melhora o manequim de cápsulas de hoje, porque ela sai
  como posições de junta (pose estendida, ver §5.4). Com o corpo realista, as juntas extras (olhar, palma, dedos do pé)
  dão as rotações que as 19 juntas não têm.

## 1. O que a pose faz hoje (`golaco/js/anim.js`)

- **Saída:** 19 juntas, só POSIÇÕES no mundo (`Float32Array(57)`). Não há rotação: a orientação de cada osso sai das
  posições no desenho.
- **A pose ENTRA na simulação.** `sim.js` guarda `j.quadril = alturaQuadril(j, m)`, e `cabecaNaBola` confere o cabeceio
  com a cabeça da `pose()`. Por isso o `anim.js` só usa `MD` (online 1×1), e qualquer mudança nele muda o hash.
  **Conclusão:** o mocap NÃO pode morar no `anim.js`. Ele mora numa função à parte, aplicada na cópia desenhada.
- **Passada procedural pela fase** (`jogador.js`: `j.fase` em passos, que nunca salta):
  - pé no chão = exatamente o ponto plantado;
  - pé no ar = o "pé desenhado" que a simulação integra;
  - IK de dois ossos na perna (coxa 0,45 m, canela 0,45 m) com o joelho para a frente do pé;
  - quadril baixando ao alcance das pernas, com o balanço vertical `cos(2π·fase)`.
- **Tronco:**
  - inclinação `0,03 + 0,022·v + 0,8·atan2(a_frente, g)`;
  - rolagem só pela curva (`0,7·atan2(a_lado, g)`);
  - torção da pelve `0,08·sin(π·fase)` rad, com os ombros girando ao contrário (×1,4);
  - quadris sempre na MESMA altura (`qy = hy − 0,03`), então a obliquidade é zero.
- **Braços:** contrafase com amplitude `lerp(0,25; 0,95 rad; v/7)` e cotovelo `lerp(0,35; 1,45 rad; v/5)`. Há vários casos
  especiais por IK: o goleiro com as mãos prontas ou segurando a bola, a lateral, o seguimento do arremesso e os braços no
  pulo do cabeceio. O mergulho tem a pose própria (`poseMergulho`).
- **Cabeça:** um ponto no eixo do tronco, um pouco à frente. Não há olhar, guinada nem estabilização.
- **Cenas** (`comemoracao.js`, `tecnicos.js`, `substituicao.js`, `cortejo.js`): copiam os jogadores e andam com a MESMA
  locomoção, com gestos por `ik`/`ikBraco` por cima. O cabeçalho da comemoração já prevê "trocar por clipes na Etapa 5
  (mocap)". O pré-jogo tem um `respirar()` procedural (`render/prejogo.js`).

## 2. Medido: captura × pose do jogo

Método:

- **Captura:** `scripts/cmu_medir.py` lê ASF/AMC, faz a cinemática direta e mede no trecho de velocidade estável (≥ 80% do
  pico). Foram 14 ensaios de corrida da CMU de 2,65 a 4,18 m/s (sujeitos 02, 09, 16, 35, 127), mais o 143_01 a 6,0 m/s.
- **Jogo:** `scripts/medir-pose-jogo.mjs` mede as MESMAS contas na `pose()` da partida IA × IA. São 3 sementes, trechos de
  ≥ 0,67 s sem a bola, |a| ≤ 1,5 m/s² e o corpo alinhado com a velocidade.
- **Faixas:** p5–p95 dentro de cada trecho.

| grandeza | CMU 2,6–4,2 m/s (mín–mediana–máx) | CMU 6,0 m/s | jogo 2,4–3,0 | jogo 3,8–4,6 | jogo 5,5–6,5 | jogo 8–9,5 |
|---|---|---|---|---|---|---|
| braço (úmero) no plano sagital, p5–p95 | 30–**52**–67° | 67° | 57° | 74° | 94° | 106° |
| cotovelo, ângulo interno médio | 66–**76**–83° | 75° | 127° | 108° | 97° | 97° |
| torção ombros × quadris, p5–p95 | 11–**18**–22° | 18° | 11° | 18° | 22° | 22° |
| obliquidade da pelve, p5–p95 | 8–**12**–13° | 14° | **0°** | **0°** | **0°** | **0°** |
| rolagem lateral do tronco, p5–p95 | 6–**9**–14° | 11° | 2,5° | 2,4° | 3,2° | 3,2° |
| flexão do tronco na passada, p5–p95 | 5–**8**–20° | 11° | 3,1° | 7,3° | 4,0° | 2,7° |
| inclinação da cabeça, p5–p95 | 2–**5**–13° (menor que a do tronco em 11 de 14) | 7° | sem orientação | | | |
| passos/s (pé com o mesmo pé ≥ 0,3 s) | 2,55–3,1 | — | (tabela `PASSADA`: 2,7–2,9) | | | |

Trechos estáveis no jogo: 112 em 2,4–3,0 m/s, 233 em 5,5–6,5 m/s e 122 em 8–9,5 m/s. **Um quarto da corrida estável do
jogo é acima de 8 m/s, e nenhuma fonte livre tem captura nessa faixa** (a mais rápida tem 6,0 m/s).

O que muda com o mocap:

- **Muda:** a pelve passa a cair do lado da perna no ar; o tronco ganha balanço lateral e "respira" na passada; os
  cotovelos ficam mais dobrados e o braço balança menos em velocidade; a cabeça fica estável.
- **Não muda:** a torção ombros × quadris, que hoje já bate.

Rocketbox (`scripts/medir_rb_anim.py` com o Blender 4.5 em Python; 1 ciclo de 2 passos por clipe, 30 qps):

| clipe | velocidade | passos/s (2 ÷ duração) | tabela `PASSADA` |
|---|---|---|---|
| `m_walk_neutral` | 1,40 m/s | 1,87 | 1,96 a 1,47 m/s |
| `m_run_slow_01` | 2,41 m/s | 2,6 | |
| `m_run_neutral` | 3,07 m/s | 2,6 | 2,7 |
| `m_run_fast_01` | 5,84 m/s | 3,3 | ~3,15 |
| `m_run_fast_02` | 5,91 m/s | 3,75 | |

- Cotovelo interno: 84–106° na corrida e 147–159° andando.
- Cadência e velocidade conferem com a tabela do jogo. A origem (captura ou animação à mão) não está documentada no
  repositório nem no artigo (Gonzalez-Franco et al. 2020).

100STYLE, estilo "Neutral" (`scripts/bvh_medir.py`; os BVH baixados por faixa do zip de 1,47 GB com `scripts/zip_faixas.py`):

| movimento | velocidade mediana | p90 | máximo |
|---|---|---|---|
| correr para a frente | 1,32 m/s | 1,64 | 1,92 |
| correr para trás | 0,93 m/s | 1,18 | 1,41 |
| correr de lado | 1,08 m/s | — | 1,77 |

Duração de 35 a 144 s por movimento, a 60 qps. São **lentos**: servem para o recuo e o passo lateral andando ou trotando
(a marcação de perto). Não servem para o recuo correndo.

## 3. Fontes de mocap (licença conferida no texto original)

| fonte | licença | o que tem de útil | veredito |
|---|---|---|---|
| **CMU Graphics Lab Motion Capture Database** (mocap.cs.cmu.edu) | Página inicial: "This dataset of motions is free for all uses" e "You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form". FAQ: "may be copied, modified, or redistributed without permission". Agradecimento pedido: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." | ASF/AMC a 120 Hz, 31 ossos, ~2.600 ensaios. Corrida/trote 2,6–4,2 m/s (09, 16, 35, 127); 6,0 m/s (143_01); arrancar e parar (127, 143); passo lateral correndo (127_13/14); "very happy" (79_69); Happy e Joy (142_08/09, 22–25 s); toque de mão e aperto de mão (141_22/23, 18/19, 20/21 com dois sujeitos); chute (10, 11, 74, 143_24); aceno e reclamação (13, 14, 18) | **USAR** (corrida, gestos, aperto de mão do pré-jogo) |
| **Microsoft Rocketbox, animações** (`Assets/Animations`) | **MIT** (`LICENSE.md`, "Copyright (c) 2020 Microsoft"; README: "12/2020: Updated license to MIT"; "4/2022: Release of 417 animations") | 471 FBX nas versões no lugar (`motextr_static`) e com deslocamento (`_xy`, `_xyz`), esqueleto Bip01 (o MESMO do corpo `Sports_Male_02` do estudo do corpo). Corrida lenta, neutra e rápida; andar; arrancar e parar; giros de 60–180°; `m_cheer_01..05` (4–25 s); `m_claphands_01/02`; `m_idle_breathe/neutral/look_around`; `m_idle_angry`; `m_gestic_talk_angry`; `m_gestic_shrug`; `m_wave` | **USAR** (comemoração, treinadores, fila do pré-jogo e respiração; também os ciclos de corrida para variar) |
| **100STYLE** (Mason, Starke, Komura 2022; Zenodo 8127870) | **CC BY 4.0** (metadado do Zenodo e a página do autor: "credit the dataset, for example 'The 100STYLE Dataset - Ian Mason'") | 100 estilos × FW/FR/BW/BR/SW/SR/ID/TR a 60 qps; o "Neutral" tem andar e correr de costas e de lado (lentos, §2) | **USAR** para o recuo e o passo lateral (com crédito e indicando que foi modificado) |
| **Mesh2Motion** (`human-mocap-animations.glb`) | Arte **CC0** (`LICENSE-CC0.MD`; README: "art assets ... all licensed under CC0") | 16 clipes: Cheer_One_arm, Cheering_Two_Hands, Salute, Insult, giros | Só com cautela: a ORIGEM das capturas não está documentada |
| Bandai Namco Research Motiondataset | **CC BY-NC 4.0** nos dois conjuntos (README do repositório) | estilos de andar, gestos | **NÃO** (não comercial) |
| Ubisoft LaForge LAFAN1 | **CC BY-NC-ND 4.0** (README) | 4,6 h, a base do demo de Motion Matching de Holden | **NÃO** (não comercial e sem obras derivadas; retargetar é derivar) |
| Mixamo (Adobe) | FAQ da Adobe: "the only thing you can't do is distribute the raw character and animation files"; também proíbe pacotes que redistribuam os arquivos brutos e treinar modelos de IA; precisa de conta | — | **NÃO** (num jogo web o arquivo de animação é baixável por qualquer um) |
| OmniContact (Hugging Face) | **CC BY-NC 4.0**, acesso restrito | chutar e carregar a bola | **NÃO** |
| SMGDiff (arXiv 2411.16216) | o artigo cita "over 1.08 million frames of diverse soccer motions", sem licença nem link de download | drible | **NÃO** (indisponível) |
| SFU, HDM05, Truebones, Rokoko, Quaternius | não conferido nesta rodada | — | fora até ler a licença |

Observação sobre "tudo fictício": a captura é o movimento anônimo de voluntários (CMU, Rocketbox, 100STYLE). Não é
imagem nem nome de ninguém. Fica vetado capturar de vídeo de jogador real.

## 4. Indústria (GDC e afins): o que fazem e o que serve aqui

- **Motion matching, Ubisoft:**
  - Simon Clavet, "Motion Matching and The Road to Next-Gen Animation", GDC 2016 (For Honor).
  - Kristjan Zadziuk, Ubisoft Toronto, GDC 2016, com as "dance cards".
  - Em vez de uma máquina de estados de clipes curtos, há longas capturas sem estrutura. A cada poucos quadros o jogo
    procura o quadro cujas características (trajetória futura + posição e velocidade dos pés e do quadril) mais se parecem
    com o pedido. Clavet: basta casar poucos ossos, "mostly the positions and velocities of the feet".
  - Dance cards = roteiros de captura que cobrem todas as mudanças de direção e velocidade com o mínimo de redundância.
  - **Aqui:** o pé já é da simulação (pé plantado e pé desenhado). O casamento pelos pés JÁ vem de graça: a fase da
    passada do jogo é o "índice" do quadro. Não precisamos de busca.
- **The Last of Us Part II**, Michal Mach e Maksym Zhuravlov, "Motion Matching in The Last of Us Part II", GDC 2021: MM na
  locomoção, na travessia, no corpo a corpo e na cobertura; a palestra fala do entusiasmo, da frustração e das soluções
  (cobertura de dados e marcação).
- **Learned Motion Matching** (Holden, Kanoun, Perepichka, Popa; SIGGRAPH 2020), tabela 3, cenário Locomoção:
  - MM: 52,1 MB (características 9,4 + poses 42,7); 90 µs por busca, ou ~9 µs por quadro buscando a cada 10;
  - LMM: 5,3 MB;
  - PFNN: 9,3 MB e **1.370 µs por quadro**.
  - Mesmo "aprendido" não cabe na folga de ~1,4 MB, e o PFNN com 22 jogadores no celular custaria dezenas de ms.
  - Segundo o artigo, a compressão de animação de ponta dá ~5× (ACL, Frechette 2019).
- **Inertialization**, David Bollo, Microsoft, GDC 2018 (Gears of War 4): a troca vira um pós-processo. Guarda-se o
  desvio entre a pose antiga e a nova no instante da troca e ele é apagado com uma curva. É 60% mais barato que misturar os
  dois estados (SIGGRAPH 2017). **Dead blending** (Holden 2023): extrapola o clipe de origem e faz a mistura.
  - **Aqui:** as duas pontas são funções puras do tempo. O desvio no instante t0 sai recalculando as duas no t0, então a
    transição continua pura (serve para o replay e não guarda estado).
- **EA FIFA:**
  - FIFA 22 HyperMotion: 22 jogadores com roupa Xsens em partidas 11×11; 8,7 milhões de quadros; 4.000+ animações novas;
    aprendizado de máquina gerando transições.
  - FIFA 23 HyperMotion2: 6.000+ animações, 9,2 milhões de quadros, duas partidas inteiras.
  - FC 24 HyperMotionV: vídeo volumétrico de 180+ partidas (segundo a Trusted Reviews).
  - **Aqui:** a "cara de futebol" vem da captura de FUTEBOL, e não há captura livre de futebol. O que dá é captura
    genérica no tronco e nos braços, com a parte de futebol procedural (bola, toque, proteção, corte) como já é hoje.
- **David Rosen, "An Indie Approach to Procedural Animation"**, GDC 2014 (Overgrowth): animação procedural com pouquíssimos
  quadros-chave. É a escola do `anim.js` de hoje. O mocap entra só como detalhe por cima, sem tirar o controle da física.
- **PFNN** (Holden, Komura, Saito 2017) e 100STYLE / Local Motion Phases (Starke): a FASE da passada como variável de
  controle. O jogo já tem essa variável (`j.fase`, que nunca salta), e é ela que permite usar ciclos capturados sem busca.

## 5. Proposta para um jogo web sem build

### 5.1 Camada A: locomoção pela fase (jogo, replay, cenas que andam)

1. **Ciclos:** andar (1,4 m/s, Rocketbox/CMU), trote (2,6–3,1), corrida (3,5–4,2, CMU 09/16/35), corrida rápida (5,8–6,0,
   Rocketbox fast_01/02 + CMU 143_01), recuo e passo lateral (100STYLE BR/SR/BW/SW, CMU 127_13/14) e parado (Rocketbox
   breathe/neutral, 100STYLE ID). Cada ciclo é UMA passada (2 passos) com 32 amostras pela fase: a amostra 0 é o pé 0
   pousando e a 16 é o pé 1.
2. **Amostragem:** `u = (j.fase mod 2)/2`. Duas amostras vizinhas com nlerp, e dois ciclos vizinhos na velocidade (como um
   "blend space 1D"). Para trás e de lado: o peso vem do ângulo entre a velocidade e o rumo do tronco (`j.rumo`). A cadência
   é SEMPRE a da simulação, e o mocap só dá a forma.
3. **Máscara por osso:**
   - **Do mocap:** coluna (3), pescoço, cabeça, clavículas, braço, antebraço e mão, mais a ROTAÇÃO da pelve (obliquidade,
     anteversão, guinada) em torno do quadril do pé de APOIO.
   - **Da IK do jogo:** pernas e pés. Girar a pelve em torno do quadril de apoio deixa a perna de apoio exatamente como
     está, e o lado do balanço desce (é o que acontece de verdade) sem a perna perder alcance.
4. **Aditivos procedurais por cima:** a inclinação pela aceleração e a rolagem na curva de hoje (o mocap é em linha reta);
   o "com bola" (braços mais abertos, tronco mais baixo; não há captura de drible livre); o olhar para a bola (só na
   cabeça e no pescoço, que compensam a oscilação do tronco como na captura).
5. **Velocidade acima de 6 m/s:** não há captura. De 6 a 8 m/s a camada passa gradualmente para a pose procedural de hoje
   (que tem o braço maior, como na arrancada). Fica a medir depois se dá para extrapolar o ciclo de 6 m/s.
6. **Pesos zero (a pose de hoje manda):**
   - mergulho do goleiro;
   - pulo do cabeceio (`puloAtivo`), porque a cabeça desenhada tem de bater com a da simulação no contato;
   - mãos prontas e bola nas mãos do goleiro;
   - lateral e seguimento do arremesso;
   - salto da barreira;
   - pedalada e gesto do toque (só os braços).
   - A mistura usa o mesmo peso que a pose já calcula (`pronto`, `segura`, `braco`, `segue`).
7. **Personalidade:** cada jogador mistura 2–3 corredores capturados (CMU 09, 16, 35, Rocketbox) com pesos fixos por
   `hash(id)`. Cada um corre de um jeito e nada sai do `m.rng`.
8. **LOD:** quem está pequeno na tela (< ~40 px) fica com a pose procedural pura.

### 5.2 Camada B: cenas

- **Comemoração** (`comemoracao.js`): os gestos por IK viram clipes no tronco e nos braços, enquanto a corrida da cena
  continua pela locomoção. Fontes:
  - Rocketbox `m_cheer_01..05` e `m_claphands`;
  - CMU 79_69 (very happy), 142_08/09 (Happy e Joy), 141_22 (toque de mão);
  - Mesh2Motion Cheer (só depois de confirmar a origem).
- **Treinadores** (`tecnicos.js`): Rocketbox `m_idle_angry`, `m_gestic_talk_angry_01/02`, `m_gestic_shrug`, `m_claphands`,
  `m_cheer` e `m_idle_look_around`.
- **Pré-jogo e substituição:**
  - fila e espera: Rocketbox `m_idle_breathe` e `m_idle_neutral`, no lugar do `respirar()`;
  - aperto de mão: CMU 18/19 (dois sujeitos) e 141_23;
  - aceno: Rocketbox `m_wave`.
- **Pés presos:** clipes no lugar (`motextr_static`). A raiz do clipe é tirada e o quadril vai ao ponto da cena. Os
  tornozelos são presos por `ik()` nos pontos plantados quando o clipe marca o pé no chão (contato detectado no
  pré-processamento pela altura e velocidade do pé). Quando a cena anda, ela manda nas pernas e o clipe só no tronco e nos
  braços.
- **Transição:** inertialization pura (§4), de 0,2–0,3 s.
- **Aleatoriedade:** a escolha do clipe sai do hash que a comemoração já usa (`hash32` do tick do gol e do autor), sem
  `m.rng`.

### 5.3 Onde roda e o contrato com a simulação

- **`js/mocap.js` (novo, PURO, sem three.js nem DOM, testável em Node):**
  - `aplicarMocap(dados, pose19, entrada, out)`, em que a entrada é `{fase, vx, vz, ax, az, rumo, id, posse, pesos de
    sobreposição, clipe?, t?}`;
  - `decodificar(buffer)`;
  - `inertializar(...)`.
  - Usa `Math` (não entra no hash). Como não guarda estado, a mesma entrada dá a mesma saída.
- **Quem chama:**
  - `main.js`, logo depois de `pose(j, mundo, e.atu)` (linhas ~495 e ~553), na cópia desenhada. O `sim.js` continua com a
    `pose()` dele (`_poseCab`), sem a camada;
  - as cenas puras (`comemoracao.js`, `tecnicos.js`, `substituicao.js`, `cortejo.js`) chamam a mesma função depois da pose
    delas.
- **Sem os dados carregados:** a camada não faz nada e o jogo fica como hoje.
- **Online 1×1:** cada aparelho desenha o seu e não há nada para sincronizar.

### 5.4 Replay: "pose estendida" (recomendado)

- **Contrato de hoje:** o anel grava O QUE FOI DESENHADO (`replay-anel.js`). Se a camada escrever antes da gravação, o
  replay sai igual por construção.
- **O problema:** as 19 juntas não guardam guinada nem olhar da cabeça, torção da mão nem rolagem dos dedos do pé.
- **A proposta:** acrescentar no FIM da pose desenhada ~6 juntas "de orientação": `cabecaFrente`, `cabecaCima`, `palmaE`,
  `palmaD`, `dedoE`, `dedoD`.
  - Os índices `J` de hoje não mudam, e o anel já aceita `nj`.
  - Custo: (19 + 6) × 3 floats × 26 vagas × 600 passos = **4,7 MB de RAM** (hoje 3,56 MB). Não entra no download.
  - A reconstrução das rotações (o estudo do código, `codigo.md` §7.2) usa esses pontos como referência de torção.
- **Alternativa:** gravar só `fase`, velocidade, clipe e tempo (~10 bytes por vaga e passo, ~160 KB) e recalcular a camada
  no replay. Ocupa menos memória, mas quebra o "grava o que desenhou" e obriga o replay a ter os dados de mocap.

### 5.5 Formato compacto e tamanho (protótipo `scripts/mocap_compacto.py`, CMU retargetada para os 22 ossos)

| formato (22 ossos, 30 Hz) | KB/s | KB/s com gzip | erro angular |
|---|---|---|---|
| float32 | 10,3 | 9,3 | 0 |
| smallest three 10+10+10+2 bits | **2,6** | 1,9–2,2 | média 0,09°, máximo 0,19° |
| delta int8 (1º quadro float16) | 2,6 | **1,0–1,6** | máximo 0,41° |

- **Camada A:** 8 ciclos × 32 amostras × 14 ossos × 4 B = **~14 KB**. Decodificada uma vez, ocupa 56 KB de Float32 na
  memória. Cabe até no 1º quadro, mas a recomendação é carregar ociosa logo depois dele, com a pose procedural até chegar.
- **Camada B:** ~40–60 s de clipes ≈ **60–120 KB**, sob demanda (`import()` no padrão `SOB_DEMANDA`, pré-carga ociosa ao
  abrir o pré-jogo ou no 1º gol). Entra na lista do `teste-carga`.
- **Como servir:** um módulo JS com os dados em base64 (o Pages comprime JS). O `.bin` talvez saia sem gzip: medir no
  `teste-carga`.
- **Alternativa padrão, glTF + gltfpack** (`-ar 12` bits de rotação, `-af 30` Hz, EXT_meshopt_compression, já lido pelo
  `MeshoptDecoder` do estudo do corpo): os 16 clipes do Mesh2Motion (66 ossos, com malha) caíram de 1.978 KB para
  484 KB (257 KB com gzip). Serve para quem usar `AnimationMixer`. Como aqui a amostragem é pela fase e tem de rodar em
  Node, o formato próprio de ~60 linhas é mais simples.

### 5.6 CPU (protótipo `scripts/bench-mocap.mjs`)

- 22 jogadores × 14 ossos (2 nlerps de fase + 1 de velocidade + composição): **63 µs por quadro** no Node 22 desta máquina.
- No celular médio, estimo 4–6× mais: ~0,3–0,4 ms. Rodando no passo da simulação (60 Hz), a interpolação de quadro de
  hoje cobre o resto.
- A GPU não muda (é a mesma matriz de osso que o corpo realista já vai mandar).

### 5.7 Retarget (offline, Python em `tools/mocap/`; FBX do Rocketbox pelo Blender local, sem ir para o CI)

1. **Cinemática direta da fonte:** ASF/AMC e BVH com numpy (feito em `scripts/cmu_medir.py` e `scripts/bvh_medir.py`); o
   FBX pelo `bpy`.
2. **Rotação local no esqueleto do jogo** (22 ossos: pelve, 3 de coluna, pescoço, cabeça, 2×(clavícula, braço, antebraço,
   mão), 2×(coxa, canela, pé, dedos)): `q_local = q_pai_global⁻¹ · q_fonte_global · Δ_osso`. O `Δ` corrige a diferença
   de pose de repouso (T × A), e é o que o `SkeletonUtils.retargetClip` do three.js 0.170 faz.
   - O mapa CMU → jogo está em `scripts/mocap_compacto.py` (`MAPA`).
   - O Rocketbox já é Bip01 e só reduz de 121 para 22 ossos. Os dedos ficam fora (para aplauso em close, duas poses de
     mão: aberta e fechada).
3. **Ciclo:** contatos dos pés → fase. Reamostrar cada passada em 32 pela fase, tirar a média das passadas (com o sinal
   do quaternion alinhado) e ESPELHAR esquerda e direita, o que dobra os dados, deixa o ciclo simétrico e emenda sem degrau.
4. **Raiz:** sai toda a translação (quem manda é a simulação). Fica só a rotação da pelve em relação ao rumo. Na pose de
   referência de cada ciclo, o "parado ereto" é subtraído para a parte aditiva.
5. **Escala:** como só rotações viajam, o tamanho dos ossos não importa (a perna do Rocketbox é 11% mais curta, mas as
   pernas são da IK).

### 5.8 Testes (regra: reprova antes, passa depois)

- **`hash-igual` e `hash-partida`:** IGUAIS (a camada é só desenho).
- **`teste-mocap` (Node, novo; as mesmas contas do §2 na pose desenhada).** Hoje reprova em tudo:
  - obliquidade da pelve p5–p95 de 7 a 15° em 3–6 m/s (hoje 0);
  - rolagem lateral do tronco de 5 a 14° (hoje 2,4–3,2);
  - cotovelo interno de 65 a 90° em 3–6 m/s (hoje 97–127);
  - braço p5–p95 ≤ 75° até 6 m/s (hoje 74–94);
  - cabeça p5–p95 < tronco p5–p95.
- **Garantias:**
  - perna de apoio desenhada = a do `anim.js` (tornozelo ≤ 1 mm);
  - ponta do pé parada no apoio (rolagem calcanhar–ponta: a ponta não anda > 1 cm);
  - cabeça desenhada = a da simulação no pulo do cabeceio (≤ 1 mm);
  - nenhum osso gira > 25° num passo de 1/60 s (troca de velocidade, de clipe ou de sobreposição).
- **`teste-carga`:** o download inicial não cresce além dos ~14 KB (ou nada, se ocioso), e a lista `SOB_DEMANDA` é
  atualizada.
- **`teste-desempenho-celular`:** quadro p95 ≤ 6 ms. **`teste-replay-anel` G13:** a 1ª pessoa continua valendo. **Medir
  também** resposta, condução e patinação com as ferramentas de sempre (devem sair iguais, porque a simulação não muda).

### 5.9 Créditos (`golaco/assets/mocap/CREDITOS.md`, como nos sons)

- CMU: o texto de agradecimento pedido pela base.
- Rocketbox: o aviso MIT completo ("Copyright (c) 2020 Microsoft").
- 100STYLE: "The 100STYLE Dataset - Ian Mason", CC BY 4.0, link para a licença e "modificado: retargetado, reamostrado
  pela fase, espelhado".

## 6. Motion matching é viável aqui? Não agora

1. **Autoridade:** no MM a animação escolhe a pose inteira (raiz e pés). Aqui a simulação determinística escolhe os pés
   e o quadril. O MM teria de virar só o "tronco", e para isso a fase já resolve sem busca.
2. **Estado:** o MM busca a cada N quadros e mistura (tem estado). A pose tem de ser função pura do estado (replay,
   comemoração copiando o mundo, testes).
3. **Dados:** precisa de horas de captura própria com dance cards no esqueleto do jogo. As bases livres têm 1–3 s por
   ensaio de corrida (CMU), nenhuma arrancada acima de 6 m/s e nada de futebol.
4. **Memória e CPU:** 52 MB (MM) ou 5,3 MB (LMM) contra ~1,4 MB de folga; o PFNN gasta 1.370 µs por personagem.

O que dá para fazer no futuro, se o dono quiser: gravar as próprias capturas de futebol (drible, proteção, comemoração)
com o MediaPipe Pose (já usado no estudo do rosto, `venv-mp`) a partir de um vídeo de alguém do time (nunca de jogador
real), limpar o tremor (filtro "one euro") e marcar os contatos. Elas entram como mais ciclos e clipes no MESMO formato.
Fica a medir a qualidade.

## 7. Riscos e pendências

- **Arrancada (7–9,4 m/s) sem captura livre:** 25% da corrida estável do jogo fica na pose procedural (com transição de 6
  a 8 m/s).
- **Origem do Rocketbox não documentada** (captura ou à mão; a licença MIT vale de qualquer jeito). **Mesh2Motion:**
  origem das capturas não documentada, então só com cautela.
- **100STYLE lento** (recuo ≤ 1,4 m/s): pela fase dá para usar no trote. Acima disso, a pose de hoje.
- **CMU tem ensaios curtos** (1–1,3 s estáveis): a média das passadas e o espelhamento pedem 2–4 passadas boas por ciclo.
  É preciso escolher os ensaios (127 inclina o tronco 29–35°; 09, 16 e 35 são os mais "neutros").
- **Replay semiautomático do impedimento** (`replay-saot.js`): o plano no quadril sai da pose gravada, e a obliquidade
  muda o quadril desenhado em até ~9 mm na vertical (quase nada na horizontal). A decisão da Regra 11 continua na
  simulação; conferir o S9 e o quadro final.
- **"Pose estendida":** mexe na coordenação com o estudo do código (o 19 → 25 no anel e no desenho) e com o do corpo
  (rotações reconstruídas).
- **Pages e gzip do `.bin`:** confirmar no `teste-carga`. Se não comprimir, usar o módulo JS em base64.

## 8. Plano em PRs (só depois do dono aprovar a direção do corpo)

1. **M1, pipeline e dados** (~3–4 h): `tools/mocap/` (leitura CMU/BVH/FBX, retarget, ciclos, espelho, codificador),
   `assets/mocap/locomocao.js` (~14 KB), `CREDITOS.md`, e o `teste-mocap` só com os decodificadores.
2. **M2, camada A no manequim de hoje** (~4–6 h): `js/mocap.js` + chamada no `main.js` e nas cenas. O `teste-mocap`
   reprova na `main` e passa (§5.8). Hash igual. Medir o celular.
3. **M3, camada B nas cenas** (~4–6 h): comemoração, treinadores, fila e aperto de mão do pré-jogo, com pés presos e
   inertialization. Os testes de cena seguem passando.
4. **M4, com o corpo realista** (junto com a frente do corpo): juntas de orientação (olhar, palma, dedos), rolagem do pé,
   cabeça estabilizada olhando a bola.

## 9. Fontes

- CMU: http://mocap.cs.cmu.edu/ (página inicial e FAQ, texto copiado em `$E/cmu-home.html` e `$E/cmu-faq.html`)
- Rocketbox: https://github.com/microsoft/Microsoft-Rocketbox (LICENSE.md, README.md, Assets/Animations);
  Gonzalez-Franco et al. 2020, https://www.frontiersin.org/articles/10.3389/frvir.2020.561558/full
- 100STYLE: https://zenodo.org/records/8127870 e https://www.ianxmason.com/100style/
- Mesh2Motion: https://github.com/scottpetrovic/mesh2motion-app e https://github.com/Mesh2Motion/mesh2motion-assets
- Bandai Namco: https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset (README, seção License)
- LAFAN1: https://github.com/ubisoft/ubisoft-laforge-animation-dataset (README)
- Mixamo FAQ: https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775
- OmniContact: https://huggingface.co/datasets/lightcone02/OmniContact-Dataset ; SMGDiff: https://arxiv.org/abs/2411.16216
- Motion matching: https://gdcvault.com/play/1022985 (Clavet, GDC 2016); https://gamedeveloper.com/programming/most-inspiring-game-animation-tech-talks-of-2016 ;
  Zadziuk e as dance cards: https://www.gameanim.com/?p=14043 e https://docs.o3de.org/blog/posts/blog-motionmatching/
- The Last of Us Part II: https://www.naughtydog.com/blog/naughty_dog_at_gdc_2021
- Learned Motion Matching: https://www.theorangeduck.com/media/uploads/other_stuff/Learned_Motion_Matching.pdf (tabela 3) ;
  https://github.com/orangeduck/Motion-Matching (a base sai do LAFAN1)
- Inertialization: https://www.gdcvault.com/play/1025165/Inertialization ; https://history.siggraph.org/wp-content/uploads/2022/09/2017-Talks-Bollo_High-Performance-Animation-in-Gears-of-War-4.pdf
- Dead blending: https://theorangeduck.com/page/dead-blending
- FIFA: https://80.lv/articles/ea-uses-machine-learning-for-animations-in-fifa-22 ;
  https://videogameschronicle.com/news/fifa-22-release-date-and-machine-learning-animations-announced-in-first-trailer ;
  https://www.ea.com/news/pitch-notes-fifa-23-gameplay-deep-dive ; https://www.trustedreviews.com/explainer/what-is-hypermotion-v-4352934
- Overgrowth: https://gamedeveloper.com/design/video-an-indie-approach-to-procedural-animation
- three.js 0.170: `examples/jsm/utils/SkeletonUtils.js` (`retarget`, `retargetClip`), `Quaternion.slerpFlat`
- gltfpack 1.3.0 (`-ar`, `-at`, `-af`, `-ac`): https://github.com/zeux/meshoptimizer/tree/master/gltf
- Scripts desta pesquisa: `$E/scripts/cmu_medir.py`, `bvh_medir.py`, `zip_faixas.py`, `medir_rb_anim.py`,
  `medir-pose-jogo.mjs`, `mocap_compacto.py`, `bench-mocap.mjs`, `glb-anims.mjs`
