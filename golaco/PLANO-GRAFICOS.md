# Plano do item 45: gráficos do celular (Baixa e Média)

Salvo no repositório no commit C0 (antes ficava no rascunho da sessão). As três pesquisas (o antisserrilhado, a cor e o
gramado, e a auditoria do código) estão condensadas, com os links, em `PESQUISA-ESTADIO.md` §19; as contas de cor, em
`tools/lib/cor-aces.mjs` (`node golaco/tools/lib/cor-aces.mjs --auto` refaz e confere os números das seções 1.3 e 2).

- **Fila:** `golaco/FILA.md`, linha **219** (item 45, categoria I, aprovada pelo dono; "Urgente").
- **Base auditada:** `origin/main` = **`e41aa791`** (já com o PR #635, item 106, e o PR #638, item 130). O `golaco/js/main.js` da
  main é idêntico ao lido no #635 (diff vazio), então as linhas `main.js:NNNN` abaixo valem na main. De `048b278f` até aqui o
  `render/`, o `css/estilo.css` e o `config.js` não mudaram; o `hud.js` ganhou 6 linhas, e as citadas (1259-1263, 1300-1302,
  1310) foram conferidas.
- **Branch de trabalho:** `claude/football-game-design-q2tr7a` (hoje igual à main; uma só). Push a cada commit. O PR fica em
  rascunho desde o C0.
- **Regras que valem em todo commit:**
  - Só desenho: `fecho-hash --diff origin/main` = 0. O `config.js` é do fecho e NÃO se toca.
  - `hash-igual` e `hash-partida` IGUAIS.
  - Nada pior que a base, medido com a mesma ferramenta e a mesma amostra.
  - O celular de referência é 844×390, dpr 2, Média.
  - Download ≤ 4 MB (folga ~565 KB depois do #635; conferir no C1 pelo `teste-carga`).
  - Modo enxuto: localmente só os testes do que a mudança afeta; o CI decide o resto. Quem fez relê o próprio diff antes do push.

As linhas citadas pela FILA estão desatualizadas e são corrigidas no commit de documentação:
- `config.js:400-404` → **412-416**;
- `campo.js:667-670` → **766-773**;
- `jogador3d.js:329-336` → **339-345**.

---

## 0. O que mudou nesta revisão (11/11)

**Retomada.** O #635 e o #638 entraram. Os passos que esperavam o #635 (painel, recriação, teto) andam como os outros. A linha
"Rebase depois do #635" saiu. A branch é a `claude/football-game-design-q2tr7a`.

**Correções da crítica, conferidas no código:**

| # | Erro | Onde fica a correção |
|---|---|---|
| 1 | A guarda do redimensionar quebrava na recriação: o canvas novo nasce 300×150 e a chave igual pulava | passo 1: a chave zera em toda recriação, dentro do `definirQualidade` |
| 2 | "Um `setSize` só com o pixel ratio novo" estava errado: o `setSize` usa o `_pixelRatio` antigo (`three.module.js:29255-29276`) | passo 1: `renderer.setDrawingBufferSize(w, h, pr)` (`:29287`). Meta Z corrigida: 0 com o mesmo tamanho, 2 numa mudança |
| 3 | O `?tom=neutro` perdia a exposição, porque o `aplicarHora` grava `H.exposicao` (`cena.js:146`) | passo 1: fator dentro do `aplicarHora`; o texto "copiar o tom corrige a Alta↔Média" saiu |
| 4 | A troca pela pausa fica assíncrona, mas o `teste-estadio:112` e o `:1131-1133` trocam e desenham no mesmo `evaluate` | passo 7: caminho imediato para `__golaco.definirQualidade`, marca `trocandoQ` na pausa, véu sem transição |
| 5 | A queda gravada: o iPhone em pouca energia limita o rAF a ~30, e o limiar é `qps < 30` (`main.js:3120`); com webdriver ela gravaria nos testes | passo 7: grava só com duas janelas lentas seguidas, fora do ritmo preso e fora de webdriver/PRINTS/DEMO |
| 6 | A seção A media textura junto com geometria e misturava máscaras | seção A: máscara geométrica \|MSAA − sem AA\| > 0,01 do mesmo build, razão E_build / E_semAA; contexto pré-criado; também pela página |
| 7 | A cintilação da F, num pixel fixo, oscila até na imagem ideal | seção F: intensidade somada no corte transversal, meta ≤ k × SSAA do mesmo quadro |
| 8 | A G6 ficava contaminada pelo grão (o `d2` repete a cada 7,3 m) | seção G6: blocos de 8 m |
| 9 | O "risco 10" da chave de cache não existe: já são `grama-detalhe-0.85` e `-0.6` (`campo.js:64`, 773, 783) | passo 2: texto corrigido; o sufixo `-v2` vale também no chão de fora |
| 10 | A seção R não reprovava pelo motivo dito: na main a Média↔Baixa não recria | seção R: + Alta→Baixa no PC com o pré-jogo e o vão aberto; `?prepartida=1` e a troca pelo ≡ → Opções depois do `pronto3d` |
| 11 | O teste entrava no CI no passo 7 ou no 9 | o teste fica fora do CI até o C14 (passo 9) |
| 12 | A CPU p95 ≤ 6 ms da FILA ficava informativa | seção P: meta valendo (seção 4) |
| 13 | A A2C de bandeiras e torcida dependia da seção F, que é a dos finos | seção K nova (recortes), pela página |

**O que faltava cobrir, agora no plano:**
- 14: a silhueta com MSAA, sem `centroid` (seção K, passo 5);
- 15: os letreiros com `alphaTest` e a A2C nativa do r170 (passo 5);
- 16: a profundidade relativa ao foco (passo 3, seção G4b);
- 17: o PC na Alta muda junto (seção N);
- 18: a noite (seção N);
- 19: os tablets (passo 1, escolha D8);
- 20: a altura do buffer e a "Baixa com MSAA" (passo 5, seção Q);
- 21: a perda de contexto (passo 1, seção R);
- 22: o `compile()` só do visível (passo 7, PR);
- 23: o teto `floor(Hz/60 + 0,1)` e o rAF falso (passo 8, seção T);
- 24: o painel por cima de tudo (passo 6);
- 25: o teste dividido em dois arquivos (seção 4).

**O bloco 3 (C9–C10), a revisão e o fecho (11/11).** Os finos com largura mínima (C9, `52896f71`), as bandeiras com o alfa
compensado, o letreiro opaco com A2C e as silhuetas com `centroid` (C10, `a2561f8f`), a revisão em três lentes (`4792e0c6`,
`73f34b56`, `35f967c5`, `3c4b5719`) e o fecho (`bc01cece`, `3c4bf4c3` e este). O medido está na seção 6 ("Medido no bloco 3").
- **A F fecha** na Média e na Baixa (de 7 metas fora para 1: a queda no gol de lá, ×2,26 na corda do fundo e ×1,97 no mastro;
  decisão do C14). A A da Média continua 0,53 / 0,50 (dia) e 0,46 / 0,46 (noite).
- **A K melhora mas não fecha:** franjas das bandeiras 13,40% → 2,43% (bola) e 3,91% → 0,65% (gol no foco), a torcida na bola
  2,36% → 0,33% (meta 0,2%); a A2 da TV na bola 1,00 → 0,69 (meta 0,6; o resto das placas e das bandeiras). Decisão do C14.
- **A regressão do bloco 3 (o CI do `4792e0c6`, o V8 do `teste-tecnicos-tela`)**: o alfa que a A2C usa é o que o fragmento
  escreve, e o three r170 pede o contexto sempre com `alpha: true`; desde o C10 o buffer do canvas ficava com alfa < 1 nas bordas
  das pessoas (~15 mil px por quadro na TV do celular Média). Qualquer cópia do canvas saía translúcida: o V8 lê por `drawImage`
  num canvas 2D que guarda o quadro anterior, e o 1º desenho depois de um corte de câmera misturava o plano de antes (211 de
  costas: 207–228 px, meta < 40). Corrigido no código (`render/util.js alfaDoCanvas`: na A2C, a mistura só do canal alfa mantém o
  destino em 1; a cor sai igual bit a bit) e guardado pelo `teste-estadio` 10b (o alfa 255 em todo pixel).
- **`?gfx=antigo`** desfaz também o C10 (a torcida, as bandeiras e o ramo do impostor = o texto da main pelo FNV-1a, P3).

**O C11 (12/11; `3d5202df`, `56bf6fd2`): o painel `?perf` / `?qps`.** A P2 inteira passa (7 metas fora → 0); a P igual (31
chamadas, 92 044 triângulos, a CPU pareada +0,00 ms); o medido e o que o C12 e o C13 precisam saber estão na seção 6 ("Medido no
C11").

**O C12 (12/11; `234ba552`, `e8fcb651`, `9f3eb26f`): a troca de qualidade, a queda gravada e o contexto restaurado.** R, Q e Z: 3
metas fora → 0; as guardas novas (a mira aquecida no R1 e no R4, a tela já opaca no R1, o P14 do `teste-pausa-tela`, o
`teste-ritmo-desenho`) reprovam na base e por mutação, menos o `transition: none` do `hud.ocupado` (dito). O N8 estava errado: o
`compile()` do r170 percorre todos os objetos da cena (seção 1.2). O medido, o que mudou além do plano e o que o C13 precisa saber
estão na seção 6 ("Medido no C12").

**O C13 (12/11; `8ed33e48`, `ec4349ad`): o teto de quadros.** A T passa inteira (3 metas fora → 0; e as linhas novas: o painel
diz a tela e o n, a tela antes do jogo segue no ritmo dela); a Q igual, com uma linha nova (a 120 Hz o teto desenha 60 e a queda
não cai). Além do plano: o período pela média dos intervalos na faixa da mediana, o quadro do ritmo pelo TEMPO (não pelo
contador), a descida rápida do n numa troca de refresh e a tela antes do jogo por cima do teto. O medido e o que o C14 precisa
saber estão na seção 6 ("Medido no C13").

**A revisão do bloco 4 (C11–C13; 12/11; `e6f6df30`, `2abed4b3`, `c37f5587`, `b6be7508` e os testes `a44f0145`, `a4b9df80`,
`5ff4db63`).** Três lentes (código e estados, as medidas P2/R/Q/Z/T, regressões); cada achado conferido no código antes. O medido,
o que ficou recusado e a lista do C15 estão na seção 6 ("Medido no bloco 4").
- **Aplicadas:** a troca pela pausa com prazo (o `compileAsync` do r170 nunca resolvia com o contexto perdido: a troca e a carga
  com a tela cedo esperariam para sempre — agora uma espera própria com fim, sem a sonda que jogava um `TypeError` sem dono); a
  pausa travada debaixo do "Ajustando…" (o Esc fechava a pausa e o jogo andava sem desenho; também o foco e o anúncio do leitor de
  tela); no online a troca não compila o escondido; a queda gravada pela MEDIANA da janela que caiu e o ritmo preso só com a mesma
  cadência no nível de baixo (a regra das duas janelas quase nunca gravava: 0 de 20 com a Baixa resolvendo; o 20 saiu dos
  divisores); o painel `?perf` sem pegar toque (tapava o LANÇAMENTO, a ENFIADA, a DIVIDIDA e os botões das Opções) e debaixo da
  tela "Ajustando…"; as linhas por fase ≤ 60 letras com "> 51" acima do teto do histograma; o rótulo "rAF"; o cronômetro da GPU
  no contexto restaurado.
- **Recusadas (com o motivo, seção 6):** a queda gravada que expira (decisão de produto: vai ao "Depende do dono" 30); a queda
  automática "só no pixel ratio" (já na main, e tirar as sombras é o que a queda quer; o texto do plano foi corrigido).

---

## 1. Diagnóstico (conferido no código de hoje)

### 1.1 Os pontos do plano perdido (D1–D17): todos continuam valendo

| # | Defeito | Onde | Medida hoje | Alvo |
|---|---|---|---|---|
| D1 | A Média sem antisserrilhado | `config.js:414` (`antialias: false`, `pixelRatioMax 1.5`); `render/cena.js:74-83` cria o renderizador com `q.antialias` | buffer 1266×585 ampliado ×1,333 no 844×390 dpr 2, `SAMPLES` 0 | MSAA 4× do próprio canvas (`SAMPLES` 4), sem passada extra |
| D2 | Objetos finos tracejados | `render/campo.js:189-216`, uma malha só (`juntarGeometrias`, 211-213): hastes do véu Ø 5,6 cm (202), corda do pé Ø 2,4 cm (204), corda do fundo Ø 2,8 cm (210), mastro da bandeirinha Ø 3,6 cm (205), tampa Ø 4,4 cm (206) | a ~50 m (30 px/m): haste 1,7 px, cordas 0,7–0,8 px, mastro 1,1 px; no gol de lá 0,5–1,2 px; mastro do canto de lá 0,55 px | ≥ ~1 px contínuo, o alfa na razão do quanto cresceu ("phone-wire AA") |
| D3 | Recortes por alfa | `render/bandeiras.js:99` (`if (t.a < 0.5) discard`, sem compensar o mip, escreve alfa 1,0); `render/torcida.js:127-134` (já compensa pelo mip); `render/impostor.js:136` (fora da TV); letreiros com `alphaTest` só no pré-jogo (`estadio-fora.js:227`, `estadio-generico.js:855`, `estadio-real.js:1121`) | a bandeira some aos pedaços de longe | compensar o mip nas bandeiras; nos letreiros, a A2C nativa do r170; na torcida e nas bandeiras, A2C só se medir ganho; nenhuma franja nova na silhueta com o MSAA |
| D4 | Faixas com contraste demais | `render/texturas.js:30` (claro [96,138,64], escuro [74,114,50]) | ΔL OKLab na tela **0,104** (no albedo 0,078; o ACES amplia ×1,33) | 0,056 ± 0,008 (foto: 0,056) |
| D5 | Faixas desalinhadas das áreas | `texturas.js:15` (`105/20 = 5,25 m`), 31-38 (a partir de x = 0) | 20 faixas; a borda mais perto da grande área fica a 0,75 m dela, a da pequena área a 0,25 m | 18 faixas UEFA: 4 × 5,5 m + 5 × 6,1 m por metade, a área grande, a pequena e a marca do pênalti nas bordas, claro × escuro dos dois lados da linha do meio |
| D6 | Verde azulado e saturado | a textura já tem h 133–135°; o ACES sobe o croma ~17% | L 0,579, **C 0,128, h 134,8°** | L 0,58 ± 0,02, C 0,10 ± 0,01, h 124 ± 3° |
| D7 | Sem profundidade | shader do gramado sem termo de vista (`campo.js:55-62`); a névoa de dia começa a 150 m (`cena.js:16`, 101, 144) | longe − perto ΔL ≈ 0 | +0,026 ± 0,008 (foto; refletância rasante, Kimes 1983), RELATIVO ao foco (o foco não muda de brilho com a câmera) |
| D8 | Grão que pode cintilar ao longe | `campo.js:57-60` (`d1` a 3,6 mm/texel, `d2` a 14,3 mm; `d = d1·d2·4`, força 0,85); mip trilinear (`util.js:44-47`), aniso 4 (`cena.js:162`) | não medido; o `d2` no fundo e o `d1` no foco ficam no limite de Nyquist | medir antes; filtrar pela derivada só se o longe passar do perto |
| D9 | Manchas fracas e mudando a matiz | `texturas.js:44-62` (canvas 96×48, alfa ≤ 20/255, linha 56) | a medir no passo 0 em blocos de 8 m; puxa h | só luminância; σL na régua da foto (seção G6) |
| D10 | Linhas acinzentadas pelo ACES | `campo.js:151-152` (Lambert `0xf3f6f1`); também passam pelo grão a 35% (173-174) | pico L 0,908 | 0,952 ± 0,01 e ≤ 0,97 (×1,8 de radiância), também à noite |
| D12–D13 | A Baixa | buffer 844×390 ampliado ×2; sem sombras; gramado 1024 (`campo.js:766`); grão 256 (769); arquibancada 1024 (547); aniso 2; torcida 0,38 e parada (`torcida-dados.js:27`, 36); bandeiras paradas (`bandeiras.js:290`) | a borda das faixas a 11 cm/texel borra; sem AA | sem MSAA (D3, escolha do dono) e com o mesmo pixel ratio (está no `config.js`). Ganha tudo o que é shader: faixas exatas, cor, manchas, profundidade, linhas e finos pela mistura |
| D14 | Painel `?qps` pobre | `main.js:3100-3109` (`medirQps`: médias de 0,5 s; "qps · ms / chamadas · triângulos / qualidade"); liga por F3 (`entrada.js:58`) ou `?qps=1` (`main.js:4524`); o CSS o esconde no replay, na comemoração e nas cenas (`estilo.css:990-1009`); mora dentro do `.hud` (z 10, `pointer-events: none`, `estilo.css:86`) | sem p95, fase, AA concedido, buffer, GPU, refresh; sem `?perf=1` (a FILA pede); fica atrás da tela antes do jogo (z 35) | p50/p95/pior 1% por fase, AA (`antialias`, `SAMPLES`, modo provável), buffer e pixel ratio, GPU, refresh, teto, queda gravada; `?perf=1` sinônimo, por cima de tudo |
| D15 | Queda automática Média→Baixa silenciosa | `main.js:3112-3126` | espera 3 s, janela de 2,5 s, cai abaixo de 30 qps; não grava, não volta, só a linha da pausa (`hud.js:1259-1263`) avisa | queda gravada nas preferências (D5 do dono), dita na pausa, sem gravar por engano |
| D16 | Sem teto de quadros em 90–165 Hz | `main.js:4542-4546` (`aoQuadro` chama o `quadro` a cada quadro do navegador); `laco.js:16` só encaixa 1/30, 1/60, 1/120, 1/144 | um celular de 120 Hz desenha 120 | teto de 60 (D6 do dono), em ritmo regular, nunca abaixo de 60 |
| D17 | Sem teste de imagem | — | nenhum teste mede tom, contraste, faixas ou serrilhado | `teste-graficos-celular` + `teste-graficos-pagina` (seção 4) |

### 1.2 Achados novos (a auditoria, as pesquisas e a crítica)

- **N1: a queda automática não recria o renderizador.**
  - `main.js:3123` chama `aplicarQualidade(false)`.
  - Com MSAA na Média, a Baixa da queda fica com o canvas em MSAA. Isso é aceitável e até é o que se quer (ver passo 7).
  - O defeito é outro: `cena.js:182` passa a guardar `q = nova` (antialias false) enquanto o contexto tem MSAA. A próxima troca manual compara com o valor errado (`cena.js:169`) e recria à toa, ou deixa de recriar quando precisa.
  - Correção: o `cena.js` guarda o AA REAL do contexto (`getContextAttributes().antialias`, que no Chromium é o `DrawingBuffer::Multisample()`).
- **N2: o redimensionar realoca à toa.**
  - O `window` e o `visualViewport` disparam os dois (`main.js:3618-3619` e de novo em 4452-4453; o MESMO ouvinte no MESMO alvo não é duplicado pelo navegador: são duas fontes de evento).
  - Cada `cena.redimensionar` (`cena.js:186-189`) faz `setPixelRatio`, que no r170 chama o `setSize` (2 atribuições de `canvas.width/height`), e depois `setSize` (mais 2): 4 por chamada, até 8 por mudança.
  - Com o mesmo tamanho, o `Reshape` do Chromium volta cedo (`webgl_rendering_context_base.cc:2491`): o ganho da guarda é de JS e do provedor de recursos do canvas, que é refeito mesmo assim.
  - Numa mudança de verdade, cada dimensão que muda faz um `Reshape`. Com MSAA isso é ~24 MB realocados por dimensão, inevitável pela API.
  - Correção: guarda (largura, altura, pixel ratio) dentro de `cena.redimensionar`; a chave zera na recriação; um `setDrawingBufferSize(w, h, pr)` só.
- **N3: o painel mostra ~60 quando desenha 30 na tela antes do jogo.**
  - Em `main.js:3924` o `medirQps` roda só nos quadros desenhados, mas soma o `dtReal` de 1 quadro do navegador.
  - Correção: medir pelo intervalo entre desenhos.
- **N4: a recriação perde estado.** Já acontece hoje na troca Alta↔Média/Baixa.
  - O canvas novo copia só `id` e `class` (`cena.js:172-174`): perde o `aria-label="Campo 3D"` (`index.html:30`) e o `inert` (posto por id em `main.js:3559-3561` com a tela antes do jogo aberta, só nas chamadas de 3584/3662/3886, não a cada quadro).
  - O renderizador novo nasce sem o `localClippingEnabled` do vão das placas (`vao-placas.js:34-35`, 50).
  - O programa da mira foi aquecido no contexto velho (`main.js:438-444`).
  - O tom e a exposição NÃO se perdem: o `criarRenderer` repõe o ACES e o `aplicarHora` repõe a exposição a cada recriação.
  - Não há API para mostrar de novo a tela de carregamento (só `hud.erro()`, `hud.js:1315`; a tela cedo a tira por `hud.carregandoAtras`, 1310). O `.carregando` tem `transition: opacity 0.35s` (`estilo.css:952-956`).
- **N5: textos.** A linha da pausa diz "Média — sombras simples, boa para celular" (`hud.js:1263`): passa a dizer o antisserrilhado.
- **N6: duas fontes de verdade.** O `QUALIDADE.antialias` do `config.js` fica sem uso (a tabela nova mora no render). Isso vai escrito no contrato.
- **N7: nenhum ouvinte de perda de contexto.** Não há `webglcontextlost`/`webglcontextrestored` em lugar nenhum. O three se recupera sozinho, mas os ganchos de quem precisa saber (a A2C dos finos, a mira) não rodam. A perda fica mais provável com os +24 MB do MSAA no iOS.
- **N8 (corrigido no C12): o `compile()` do r170 percorre TODOS os objetos da cena** (`three.module.js:29801-29893`: só as luzes pelo `traverseVisible`; os materiais pelo `scene.traverse`, também os escondidos). O que já está na cena na hora da troca, escondido ou não (a mira, a placa da substituição, a linha do impedimento e o resto criado na carga), compila junto — a troca pela pausa leva mais, atrás da tela "Ajustando…", e nada engasga quando aparece depois; só o que entra na cena mais tarde (um módulo sob demanda que chega depois) compila quando aparece. ~~A versão de antes dizia "só percorre o visível".~~
- **N9: o iPhone em pouca energia limita o rAF a ~30 qps** (teste do WebKit com intervalo de 30 ms). O limiar da Média é `qps < 30` (`main.js:3120`): a queda dispara por acaso. Gravada, deixaria o aparelho na Baixa para sempre.
- **N10: tablets.** O iPad entra como celular (`pointer: coarse`, `main.js:348`) e cai na Média. Com MSAA são 2049×1536 × 4 amostras (~100 MB no Safari, mais o resolve).
- **N11: a silhueta com MSAA, sem `centroid`.** No MSAA o pixel da borda é sombreado no centro, mesmo fora do triângulo. A UV sai do quadro e lê o vizinho no atlas: torcida, bandeiras, placas, escudos, letreiros, números e patrocínios. O resultado são franjas e pixels soltos que passam no recorte, um artefato novo.

### 1.3 Contas que confirmam o plano perdido

Feitas com os shaders do three r170, a luz de dia do `cena.js` e as cores do `texturas.js`. As contas estão em
`golaco/tools/lib/cor-aces.mjs` (desde o C0); o `--auto` refaz esta tabela e confere as cópias da luz pelo texto do `cena.js`.

| Medida | Calculado | Plano perdido |
|---|---|---|
| ΔL das faixas | 0,104 | 0,10 |
| L / C / h | 0,579 / 0,128 / 134,8° | — / 0,127 / 135° |
| Pico da linha | 0,908 | 0,909 |
| Longe − perto | 0 | — |

**A UEFA conferida no PDF de 2025** (o arquivo passa de 10 MB e fica fora do repositório; o link está na seção 10): §4.3.1 "Mowing and pitch presentation", nas páginas impressas **21–22** (a folha dupla 12 do PDF), Fig. 15. O texto:
- "The first four bands of the pitch should always be exactly 5.5m wide. The five remaining bands in each half should then be of a uniform width, finishing at the halfway line (on 105m pitches these bands will be 6.10m wide …)";
- "No other form of grass cutting (diagonal, circles, etc.) is permitted for UEFA matches";
- "The final two cuts should be made towards the main camera position".

Na Fig. 15 a faixa junto da linha de fundo é clara, a 9ª (junto do meio) clara e a 10ª escura. A citação "3.2 Mowing, p. 70" de uma fonte secundária não bate com esta edição.

---

## 2. Escolhas do dono, com a recomendada aplicada

Vão para o "Depende do dono" **30** da FILA (o 29 é do item 106; conferido: não há 30 ainda).

| # | Escolha | Aplicada (recomendada) | Alternativa |
|---|---|---|---|
| D1 | Cor do gramado | verde realista: h 124°, C 0,10, ΔL 0,056; mesma C e h nas duas faixas | manter o verde de hoje e só alinhar as faixas |
| D2 | Tom | manter o ACES e corrigir no albedo (inversa exata do ACES do r170) | AgX (acinzenta o gramado: C 0,070, linha 0,832) ou Neutral (pede exposição ×1,40 e muda a cena inteira); os dois ficam só em `?tom=` para comparar |
| D3 | Baixa | sem MSAA; o `discard` continua | MSAA também na Baixa |
| D4 | Faixas | sempre iguais, sem inverter pela vista | inverter no contraplano (real, NALP, mas confunde) |
| D5 | Queda automática | GRAVADA: a próxima carga em "Automática" já abre na Baixa; escolher uma qualidade à mão apaga a queda; a pausa diz | silenciosa como hoje |
| D6 | Teto de quadros | teto de 60 desenhos, nunca abaixo de 60 | sem teto |
| D7 | Volta ao de antes | `?gfx=antigo` (tudo o que é imagem do item 45 desligado: textura antiga, sem MSAA na Média, sem profundidade, linhas e finos de antes; o painel, o teto e a queda ficam) | sem chave de volta |
| D8 | Tablets (novo) | o MSAA só com o buffer ≤ ~1,2 MP nos aparelhos de toque: a Média do tablet fica como hoje (sem MSAA, pr 1,5) | baixar o pixel ratio até caber e ligar o MSAA |
| D9 | Profundidade (novo) | relativa ao foco (`g − g(foco)`, limitada a ±8%): o meio da tela não muda de brilho com a câmera | absoluta (as câmeras baixas clareiam o gramado inteiro em ~+11%, o aéreo do pré-jogo escurece ~10%) |

Detalhes que eu decido dentro das escolhas (escritos no PR e no "Depende do dono" 30):

- **Teto de 60 em ritmo regular, só no celular** (`ehCelular`, `main.js:348`). O desenho sai a cada *n* quadros da tela, com *n* = max(1, floor(Hz/60 + 0,1)):

  | Tela | *n* | Desenhos por segundo |
  |---|---|---|
  | 60 Hz | 1 | 60 |
  | 90 Hz | 1 | 90 (sem teto: 45 regulares ou 60 aos trancos, padrão 2-1, seriam piores que a base) |
  | 120 Hz | 2 | 60 |
  | 144 Hz | 2 | 72 |
  | 165 Hz | 2 | 82,5 (o `round` dava 55, pior que 60) |
  | 240 Hz | 4 | 60 |

  O PC não muda (Alta em monitor de 144 Hz é jogo de PC; "nada pior").
  A fórmula põe o *n* em 2 a partir de ~114 Hz (a folga de 0,1 segura no 2 a tela de 120 medida em 119,5): de 114 a 119 Hz e de
  174 a 179 Hz o teto fica em 57–59,9 desenhos por segundo (nenhuma tela de celular conhecida nessas faixas). O C13 desenha pelo
  TEMPO (n − 0,5 períodos desde o último desenho), não pelo contador, e baixa o *n* na hora quando a tela fica mais lenta; a tela
  antes do jogo (30 pelo relógio) passa por cima dele (seção 6, "Medido no C13").
- **O painel com `?perf=1` fica visível em TODAS as fases** e por cima de tudo, para o minuto do dono cobrir a tela antes do jogo, o replay e as cenas. Com F3, como hoje. **Nunca pega toque** (a revisão do bloco 4: com `pointer-events: auto` ele tapava os botões de toque e os das Opções; o dono manda o print) e fica debaixo da tela "Ajustando…" e da de erro (z 63), que precisam ser lidas.
- **Na queda automática não se recria o contexto no meio da partida** (recriar descarta o renderizador e compila tudo de novo). Cai o pixel ratio (1,5 → 1) e saem as sombras; o MSAA fica até a próxima carga, que já abre na Baixa por causa da queda gravada. ~~Sem o `KHR_parallel_shader_compile` a recompilação trava a tela~~ — inexato (a revisão do bloco 4): tirar as sombras troca as defines dos shaders e recompila os programas no quadro seguinte de qualquer jeito (o `configurarSombra` marca os materiais; já na main); o que a queda evita é recriar o contexto.
- **A queda na sessão continua como hoje; só a GRAVAÇÃO é exigente** (a revisão do bloco 4 trocou a regra: a de "duas janelas lentas seguidas pelo mínimo do nível de cima" quase nunca gravava — a 2ª janela já roda no nível de baixo, e quando ele resolve nada ficava):
  - a janela que caiu lenta DE VERDADE: a mediana dos intervalos a até 1 ms abaixo do intervalo do mínimo do nível (Média 33,3 ms; Alta 20,8) — alguns soluços longos baixam o qps e a queda na sessão vem, mas não gravam;
  - o ritmo PRESO em 30 regular (a mediana a ± 1 ms de 33,3 e p90 − p10 ≤ 2 ms: o iPhone em pouca energia, o economizador do Android) só grava se a janela SEGUINTE, já no nível de baixo, desenhar mais rápido (a mediana ≥ 1 ms abaixo): a mesma cadência presa é o limite do sistema. O aparelho lento de verdade também desenha preso no vsync (a Média de 36–48 ms a cada 50,0 ms exatos); o 20 (50 ms) saiu dos divisores (nenhuma fonte de sistema que limite a 20);
  - fora de `navigator.webdriver`, `?prints=1` e `?demo=1`; o `__golaco.quedaDeTeste()` grava de propósito.
- **O xadrez da Ligue 1 fica de fora** (opção futura por liga). Vale a UEFA.
- **A profundidade nas câmeras baixas (D9; a revisão do C4–C8):** o termo se APAGA pela altura da câmera (`gramado.js
  rasanteDaCamera`: nada abaixo de 3 m, inteiro de 8 m para cima, smoothstep no meio).
  - O motivo: numa câmera baixa o raio do meio da tela toca o chão muito além do assunto, ou nem toca (steadicam 106 m,
    câmera do gol 37 m, entrada do pré-jogo 83 m, fila 20 m, cartão 18–32 m; o contraplano não toca), e o chão aos pés dele
    caía no teto de −8% (L −0,021; a G4b pede ±0,005).
  - Ficam com o termo inteiro: a TV do celular (13 m), a do PC (19 m), o escanteio (8 m), o Atrás do Livre (9,5 m), o aéreo e o
    geral do pré-jogo. Ficam sem ele (como antes do item 45): a 1ª pessoa e a lateral do replay, a steadicam, o contraplano e a
    reação da comemoração, a câmera do gol, a falta, o túnel, a entrada e as filas do pré-jogo e a cena do cartão. O Jogador
    do Livre (3,9 m) fica com 9%.
  - Alternativas que não entraram: (b) cada câmera passar o alvo (fio na comemoração, no pré-jogo, nas cenas e no replay; no
    contraplano o alvo nem é o assunto: com o chão sob ele, os pés do autor ainda dariam −4,8%); (c) limitar a distância do foco
    pela altura (a TV toca o chão a 3,9× a altura: o limite que serve às câmeras baixas pegaria a TV).
  - Sem tocar o chão (olhando acima do horizonte), o foco é o horizonte, g = 1 (antes o ponto a 50 m: salto de até 2,6% de
    brilho ao cruzar o horizonte e g 0 olhando reto para cima).

---

## 3. Passos em ordem

Ordem de risco: primeiro a régua, depois o render, por último o `main.js`. Com o #635 na main, nenhum passo espera mais nada.

### Passo 0: a régua (dois testes, sonda e medida da main gravada) — ~5 h

- **Arquivos:**
  - `golaco/tools/teste-graficos-celular.mjs` (novo; os módulos, caminho A; seção 4);
  - `golaco/tools/teste-graficos-pagina.mjs` (novo; a página, caminho B; seção 4). Dois arquivos porque o SSAA de 3798×1755 no SwiftShader, os 8 quadros por posição da F, os 30 quadros da D e as 5–8 cargas de página não cabem em ~120 s;
  - `golaco/tools/dados/graficos-ref.json` (novo);
  - `golaco/tools/lib/cor-aces.mjs` (já no C0: OKLab, a luz Lambert do r170, ACES/AgX/Neutral e a inversa exata do ACES, com o
    auto-teste `--auto`).
- **Primeiro a sonda:** confirmar que o SwiftShader do CI dá MSAA (`getContextAttributes().antialias === true` e `gl.getParameter(gl.SAMPLES) === 4` num contexto com `antialias: true`).
  - O `drawing_buffer.cc` não exclui o SwiftShader do MSAA. No Linux o ANGLE/Vulkan expõe o `GL_EXT_multisampled_render_to_texture`: o modo provável no CI é o implícito EMULADO (não a "passada separada"; essa é a do Mac, do iOS e do Graphite). A Alta, com MSAA, já roda no CI (`teste-rede-tela`, `teste-corpo-tela`).
  - Se der outra coisa, o teste reprova como "teste inválido". Nunca passa calado.
- **Como forçar o AA nos dois builds** (na main não há `?aa`):
  - caminho A: pré-criar o contexto com `canvas.getContext('webgl2', {antialias})` antes do `criarCena`. O three r170 pede o contexto por `canvas.getContext` (`three.module.js:29082-29084`), e o navegador devolve o que já existe;
  - página: um `addInitScript` que troca o `antialias` pedido pelo `getContext` do `#tela`.
- **Gravar a referência da main:** `node tools/teste-graficos-celular.mjs --raiz <worktree da main>/golaco --gravar-referencia` (e o mesmo no `teste-graficos-pagina`).
  - Grava os valores AGREGADOS (nunca o hash dos pixels) com a versão do Chromium e o `UNMASKED_RENDERER` do SwiftShader.
  - Precedentes: `--raiz` do `teste-prepartida-tela` e `--gravar-referencia` do `teste-chutes`.
- **Medir a base também:** a CPU p95 do quadro na medida do `teste-desempenho-celular` (seção P). Se a base já passar de 6 ms, isso vai ao PR e ao "Depende do dono" 30 (ver P).
- **Fonte:** o modelo do `teste-rede-tela.mjs:55-97` (cena e campo numa tela à parte, câmera de TV pelas funções puras de `render/enquadramento.js`).
- **Pode quebrar:** nada (só ferramenta). Os dois ficam **fora do CI até o C14** (passo 9).

### Passo 1: as opções de diagnóstico, a tabela de AA e o `cena.js` — ~2,5 h

- **Arquivos:**
  - `golaco/js/render/graficos-opcoes.js` (novo, ~1 KB): lê `location.search` uma vez e exporta `{aa: null|true|false, gfxAntigo, tom: 'aces'|'neutro'}`. Assim o `criarCena`/`criarCampo` não mudam de assinatura.
  - `golaco/js/render/cena.js`.
- **Mudanças no `cena.js`:**
  - `AA_QUALIDADE = {baixa: false, media: true, alta: true}`, mais `?aa=0|1` e `?gfx=antigo` (= a do `config.js`).
  - **Teto dos tablets (D8):** nos aparelhos de toque (`pointer: coarse`), o MSAA só com a área da tela (`screen`, que não muda ao girar) × min(dpr, `pixelRatioMax`)² ≤ ~1,2 MP. Exemplos: o 844×390 dá 0,74 MP e o 932×430 dá 0,90 MP (com MSAA); o iPad mini dá 1,9 MP e o iPad Pro 12,9" 3,1 MP (sem MSAA). O `?aa=1` passa por cima. No PC não há teto (a Média escolhida à mão ganha MSAA: dizer no PR).
  - `criarRenderer` usa a tabela; `aaContexto = renderer.getContextAttributes().antialias` e `amostras = gl.getParameter(gl.SAMPLES)` (N1, N6).
  - `definirQualidade(nome, recriar)` compara o AA pedido com o `aaContexto`, nunca com o `q.antialias`.
  - **Na recriação:**
    - copia TODOS os atributos do canvas velho (`aria-label` incluído) e a propriedade `inert` (N4);
    - copia do renderizador velho o `localClippingEnabled` (o único estado do renderizador que hoje se perde de fato);
    - **zera a chave do redimensionar** (o canvas novo nasce 300×150);
    - roda os ganchos `aoRecriar`.
  - `aoRecriar(fn)`: ganchos para quem precisa saber (a A2C dos finos no passo 5, a mira no passo 7). Os mesmos ganchos rodam no `webglcontextrestored` (N7). O ouvinte é posto em todo canvas que o `cena.js` cria. O `webglcontextlost` não precisa de `preventDefault` nosso: o three já faz.
  - **`redimensionar(w, h)`:** `pr = min(dpr, pixelRatioMax)`; guarda `${w}x${h}@${pr}` e, só quando muda, um `renderer.setDrawingBufferSize(w, h, pr)` (`three.module.js:29287`; faz `_pixelRatio = pr` e as 2 atribuições; o estilo não muda, como o `setSize(w, h, false)` de hoje). Devolve se mudou (N2).
  - **`?tom=neutro`:** `NeutralToneMapping` no `criarRenderer`; no `aplicarHora`, `toneMappingExposure = H.exposicao × FATOR_TOM` (1,40 com o Neutral, 1 com o ACES). Assim a exposição sobrevive à troca de hora e à recriação. É escolhido na carga (o three recompila tudo ao trocar o tom: é diagnóstico, não produto).
- **Fontes:**
  - O modo do MSAA por navegador:
    - Chrome Android/Ganesh: média das amostras na GPU por `EXT_multisampled_render_to_texture` (`drawing_buffer.cc`; padrão 4, `web_graphics_context_3d_provider.h:78`; limite 4× no Android, `gpu_driver_bug_list.json` entrada 268).
    - Safari iOS: `blitFramebuffer` por quadro (`WebGLDefaultFramebuffer.cpp`).
    - Graphite e Mac: passada separada (`gpu_finch_features.cc`).
  - O custo: "Use 4x MSAA if possible; it's not expensive" (Arm Mali Best Practices); +3% de banda no Mali-G76 (Khronos Vulkan-Samples, msaa); +10–15% de tempo de GPU no Adreno (Meta, Mobile MSAA analysis); PowerVR "2x virtually free, 4x noticeable" (Imagination).
  - Por que não FXAA/SMAA/TAA: o FXAA borra a textura e as linhas de 12 cm e no r170 perde o tom/sRGB fora do canvas (`WebGLRenderer.js:1792-1804`); o SMAA são 3 passadas e +64 KB; o `TAARenderPass` do r170 só acumula com a cena parada; o MSAA em render target do three faz cópia (`WebGLTextures.js:2016`), o caminho que a Arm proíbe.
  - O tamanho: `Reshape` com volta cedo (`webgl_rendering_context_base.cc:2491`); o atributo devolvido à página (`:3921`); o `setDrawingBufferSize` do r170.
- **Pode quebrar:**
  - **Tempo no CI.** O SwiftShader faz o MSAA na CPU, e ~20 testes de navegador abrem na Média (seção 6).
  - **Metas de pixel na Média** dos testes que medem imagem.
  - **Bateria no iPhone e no Graphite:** a média das amostras numa passada à parte, ~1,4 GB/s a 60 qps, ~140 mW pela régua da Arm. É o motivo do teto e da queda gravada.

### Passo 2: o gramado no shader (D4, D5, D6, D9; D12 na Baixa) — ~3 h

- **Arquivos:**
  - `golaco/js/render/gramado.js` (novo, puro, fora do fecho; o modelo é o `rede-onda.js`, "a conta pura testada em Node e GPU = JS"). Contém:
    - as bordas UEFA por metade, {0; 5,5; 11; 16,5; 22; 28,1; 34,2; 40,3; 46,4; 52,5} a partir de cada linha de fundo;
    - a função JS `faixaEm(x) → {indice, paridade, distBorda}`;
    - a mesma conta em GLSL, gerada das MESMAS constantes;
    - as cores lineares por hora;
    - `uManchas`, `uRasante`, `uBrancoLinha`, `uBorda`.
  - `render/texturas.js`: `texGramado` vira `texGramadoAntigo` (intacta, para o `?gfx=antigo`) + `texManchasGramado(512|256)`, só o tom (R = manchas de 3–10 m, G = desgaste, que mantém a cor amarelada por uniform; o entorno escurecido 12% vira conta no shader).
  - `render/campo.js` (`comDetalhe`, 44-66, ganha `{faixas: true}` só no gramado e `{profundidade: true}` no gramado e no chão de fora).
- **Shader:** depois do `#include <map_fragment>`.
  - O índice global I ∈ [0, 17] (a faixa 1, junto ao gol da esquerda, clara; a 9 clara; a 10 escura; a 18 escura: Fig. 15 da UEFA).
  - Filtro de caixa sobre o degrau, `w = fwidth(x) + uBorda` (0,10 m, a borda macia do corte); `t = mix(0.5, p, clamp(2·dB/w, 0, 1))`. As derivadas no topo do bloco, fora de desvio (lição do PR #631).
  - `diffuseColor.rgb = mix(uClara, uEscura, t) · desgaste · (1 + uManchas·(n − 0,5))`.
  - Atrás das linhas de fundo a alternância continua com 5,5 m.
  - ~15 operações por fragmento, 0 chamada a mais.
  - **Chave do cache:** hoje já são `'grama-detalhe-0.85'` (gramado) e `'grama-detalhe-0.6'` (chão de fora), pela força (`campo.js:64`, 773, 783): não há colisão. A chave nova mantém a força e ganha o sufixo do que mudou: `'grama-detalhe-' + forca + (faixas ? '-faixas' : '') + (prof ? '-prof' : '') + '-v2'`, também no chão de fora.
- **Cores:** albedos pela inversa do ACES do r170.
  - Claro `#6b7f45` (linear 0,1485; 0,2112; 0,0594) e escuro `#61723a` (0,1191; 0,1683; 0,0420), h 124°.
  - Chão de fora `#47541d` (hoje `0x2c5a26`, `campo.js:783`: h 143,8°).
  - `uManchas` calibrado pela G6 (ponto de partida 0,10: ±5% de albedo, só luminância). **No C6 ficou 0,17** (±8,5% de albedo
    nos extremos), com o ruído da textura (`texturas.js MANCHAS_GRAMADO`) de desvio 0,45 (29% dos texels cortados em 0 ou 1):
    com 0,10 a G6 dava 0,0060. A pesquisa dá k 0,08–0,12, e a meta 0,010 ± 0,004 é PROVISÓRIA (a régua da foto nunca foi refeita):
    a calibração foi contra ela, uma conta circular (a revisão do C4–C8). A G6 ficou informativa; a comparação k 0,10 × 0,17 em
    prints vai ao dono (seção 7).
  - **Calibrar pela MEDIDA da página, não pelo modelo** (revisão do C1–C3, item 16): o modelo prevê o ΔL das faixas 0,104 e a página mede 0,099 (−5%, 60% da tolerância de ±0,008). Ajustar as cores e o `uManchas` com o `teste-graficos-celular` (G1, G2, G6) e só conferir pelo `cor-aces`.
- **Ganho de memória:** a textura do gramado 2048×1024 (~11 MB na GPU com mips) → 512×256 (~0,7 MB). Isso compensa parte da memória do MSAA no Safari (+~24 MB).
- **Fontes:**
  - UEFA Pitch Quality Guidelines 2025, §4.3.1, pp. 21–22, Fig. 15 (conferido no PDF; texto na seção 1.3).
  - Premier League Pitch Standards Framework 2025, K.23.
  - LFP Championnat des Pelouses BKT 2024/25, art. 15 (o xadrez, fora); Ligue 1, "o gramado"; Reformsports, as medidas das faixas (secundária).
  - OKLab (Ottosson).
  - As fotos do Commons da Allianz Arena (ordem de grandeza: C 0,103–0,113, h 126–127°).
  - Filtro de caixa de um degrau (conta conferida; os artigos de Quilez não abriram daqui).
- **Pode quebrar:**
  - Metas de contraste que usam o gramado como fundo: a mira (`teste-bola-parada-tela` §7, contraste dia/noite; `teste-mira-tela`), o L* da rede (`teste-rede-tela`), a torcida/bola fora do HUD (`teste-camera-tela`).
  - O L médio fica igual (0,58), então o risco é pequeno, mas tem de ser medido.
  - À noite o albedo muda junto: medir o mesmo. No PC (Alta) também (seção N).

### Passo 3: profundidade relativa ao foco e linhas (D7, D9 do dono, D10) — ~2 h

- **Profundidade:** no mesmo trecho do shader (gramado e chão de fora, para não haver emenda nos cantos):
  - `μ = clamp(V.y/|V|, 0, 1)` com `V = cameraPosition − (x, 0, z)` (o `cameraPosition` já chega ao fragment do three);
  - `g = (1 − μ)²`;
  - **relativa ao foco:** `diffuseColor.rgb *= clamp(1 + uRasante·(g − uGFoco), 0,92; 1,08)`;
  - `uGFoco` = o g do ponto onde o raio do meio da tela toca o chão (se o raio não tocar o chão, o ponto a 50 m na direção da vista, levado ao chão). É calculado por quadro no `onBeforeRender` do gramado (`three.module.js:30471`; a sombra usa o `onBeforeShadow`, então não interfere). Assim vale para TODA câmera (TV, replay, cinema, Livre, pré-jogo) sem fio no `main.js`;
  - `uRasante` ≈ 0,22 de dia, calibrado pela G4 para longe − perto = +0,026 na TV do celular; à noite começa na metade e é medido.
    **No C7 ficou 0,41 de dia e de noite** (o 0,22 dava ~+0,014 no modelo; medido na página, 0,41 dá +0,0260 de dia e +0,0257 à
    noite; com a metade à noite, ~+0,013, fora da meta, que é a do dia). Desde a revisão do C4–C8 o uRasante de cada desenho é o
    da hora × a altura da câmera (seção 2, "A profundidade nas câmeras baixas"), e no PC a meta da G4 é a do celular × o modelo
    do ângulo (24,6° × 15°: ×1,25, 0,033 ± 0,008; medido 0,0326 de dia e 0,0324 à noite);
  - o longe tem de ficar ≥ 0,6× o ΔL das faixas do foco e com |Δh| ≤ 2°.
  - **O gancho `campo.graficos.semProfundidade(bool)` é obrigatório** (revisão do C1–C3, item 6): a G4 mede o TERMO, longe − perto com − sem ele, de dia, de noite, na Baixa e no PC. O absoluto levava as manchas (±0,004–0,007 entre os ~4 blocos de cada região) e a luz da noite (a main dá +0,0075 de dia e −0,0094 de noite: com o mesmo termo, dia e noite não cabiam juntos em ±0,008). Sem o gancho o teste conta o termo como 0.
  - **O ΔC do termo tem de ser ≤ 0:** um termo que só clareia SOBE o C ao longe (o C do OKLab cresce com o brilho). Dessaturar ~5% ao longe, como a pesquisa (a foto: C 0,108 → 0,103), ou a G4 reprova.
  - **À noite a meta da G4 é a do dia** (com − sem). Se o k da noite começar na metade, como a pesquisa sugere, o termo da noite fica ~+0,013 e reprova: decidir no C7 com o número medido (o k igual ou a meta da noite revista e dita no PR).
  - O corte TV → 1ª pessoa (G4b) conta só a parte do termo no salto (com − sem, ≤ 0,01): o salto bruto oscila com as manchas do C6.
- **Por que relativa (crítica 16):** com g absoluto (`g − 0,49`), as câmeras baixas clareariam o gramado inteiro em ~+11% (1ª pessoa e lateral baixa do replay, steadicam da comemoração, câmera do gol, "Jogador"/"Atrás" do Livre, bola parada), o aéreo do pré-jogo escureceria ~10%, e o corte da TV para a 1ª pessoa viraria um salto de exposição. O PC (24,6°, `config.js:397`) dá outro gradiente que o celular (15°): medido na seção N.
- **Linhas:** `diffuseColor.rgb *= uBrancoLinha` (1,8 de dia: pico 0,952; à noite medido, ≤ 0,97 também) no shader das linhas (`campo.js:155-177`). Nada de `toneMapped = false` (dá 0,98 e quebra a noite).
- **Fontes:**
  - Refletância por ângulo do dossel: Kimes 1983, Applied Optics 22(9):1364; Sandmeier et al. 1998, RSE 66:222.
  - Névoa real (Koschmieder, β = 3,912/V: 1–2% a 100 m, então não é a névoa).
  - A curva do ACES (`tonemapping_pars_fragment` r170).
- **Pode quebrar:** o `teste-rede-tela` mede "clareia o gol na TV": o fundo de grama longe fica ~+4% mais claro. Medir a base com as mesmas metas.

### Passo 4: grão ao longe (D8): medir antes — ~1 h

- A seção D do teste mede o aliasing:
  - gramado só, 1× contra o SSAA 3×3 do **mesmo LOD** (revisão do C1–C3, item 8: 9 desenhos 1× com a câmera a −⅓, 0 e +⅓ px. O render 3× descia o mip em log2 3 ≈ 1,58, e o build "cintilava menos que o ideal", × 0,66–0,84: a régua não decidia nada);
  - E = RMS(L₁× − L_ref) por faixa da tela (perto, foco, longe);
  - cintilação: 4 quadros com a câmera andando 0,25 px por quadro, por pixel, ÷ a da referência;
  - **o critério é entre as faixas do próprio build:** o longe (z −24…−34) ÷ o perto do foco (z 10…0), no E e na cintilação.
- **Medido na main (revisão do C1–C3):**
  - E de 0,0033 (perto) a 0,0020 (longe);
  - cintilação × 1,30–1,33 a da referência em todas as faixas;
  - longe ÷ perto: E × 0,70 e cintilação × 0,32.

  O longe NÃO passa do perto. Se o gramado do C6 não mudar isso, o C8 fica "medido, sem filtro".
- **Medido no C8 (o gramado do C6 com o termo do C7; Chromium 141 do CI, a main na mesma rodada): sem filtro.**

  | Média, dia (o build: MSAA 4×) | main | C8 |
  |---|---|---|
  | E perto (z 22…10) → longe (z −24…−34) | 0,0033 → 0,0020 | 0,0033 → 0,0020 |
  | E no perto do FOCO (z 10…0), a base da razão abaixo | 0,0029 | 0,0029 |
  | cintilação ÷ a do SSAA do mesmo LOD, por faixa | ×1,30–1,33 | ×1,33–1,36 |
  | longe (z −24…−34) ÷ perto do foco (z 10…0): E / cintilação | ×0,70 / ×0,32 | ×0,68 / ×0,29 |
  | Baixa (medida à parte, a seção D com a cena da Baixa): longe ÷ perto, E / cintilação | ×0,69 / ×0,34 | ×0,72 / ×0,29 |

  - O longe continua abaixo do perto nas duas qualidades: o filtro pela derivada NÃO entra.
  - O `campo.js` e o grão não mudam, nem as linhas, que usam o grão a 35%: a G5 fica a do C7.
  - A razão contra o SSAA é a mesma em todas as faixas, na main e no C8: ao longe o grão não cintila mais do que perto.
  - A seção D segue informativa, também no C14.
- **Só se o longe passar do perto:** o desvanecimento pela derivada (`k = 1 − smoothstep(0,5·S, S, pegada)` por escala; a média continua 1, então nada muda de brilho), com S = 0,029/0,114 m na Média e 0,057/0,23 m na Baixa.
  - Metas nesse caso: E longe ≤ 0,5× o de antes, |ΔL médio| longe ≤ 0,003 e o grão no foco ≥ o de antes.
  - Se não acusar, a seção fica informativa e o PR diz.
- **Fonte:** `EXT_texture_filter_anisotropic` (λ = log2(Pmax/N)).
- **Pode quebrar:** as linhas usam o mesmo grão a 35% (`campo.js:173-174`). Se o grão mudar, as linhas mudam junto: medir o pico da linha depois.

### Passo 5: objetos finos, bandeiras, letreiros e silhuetas (D2, D3, N11) — ~3,5 h

- **Arquivos:**
  - `render/campo.js` (`criarGols`, 189-216);
  - `render/util.js` (o `juntarGeometrias`, 57-59, só mantém o atributo que TODAS as peças têm: o atributo novo entra em todas, postes e tampas com 0);
  - `render/bandeiras.js`, `render/torcida.js`, `render/impostor.js`;
  - os letreiros: `estadio-fora.js:227`, `estadio-generico.js:855`, `estadio-real.js:1121`;
  - `main.js`: uma linha, o registro `cena3d.aoRecriar(() => campo.definirAA(cena3d.amostras))` junto da criação do campo (`main.js:4402`).
- **Largura mínima no vértice** ("phone-wire AA", Humus), em TODAS as peças finas do gol (hastes, cordas, mastros, tampas):
  - atributo `aFino` (raio) + `aEixo` (o ponto do eixo mais perto);
  - se o diâmetro na tela ficar < 1 px, o vértice sai do eixo **na direção lateral da tela** (perpendicular ao eixo projetado) até 1 px, e `vCob = largura real / largura nova`;
  - uniform `uAlturaBuffer` atualizado no `onBeforeRender` da malha: `renderer.getRenderTarget()?.height ?? gl.drawingBufferHeight`. Assim acompanha a rotação, a barra do navegador, a queda de 1,5 para 1 e a recriação, sem gancho;
  - os postes e o travessão (≥ 2,5 px) não crescem.
- **O esmaecimento:**
  - Com `SAMPLES ≥ 2` no contexto ATUAL: `material.alphaToCoverage = true`. No r170 isso tira o `#define OPAQUE` (`three.module.js:20852`) e liga o `SAMPLE_ALPHA_TO_COVERAGE` (`:23522`), com a saída `a = vCob` e sem ordenar transparências.
  - Sem MSAA (Baixa): `transparent: true`, `depthWrite: true`, `renderOrder 1` (a rede continua no 2), mistura como as linhas do campo.
  - A troca pelo `campo.definirAA(amostras)`, com o `SAMPLES` lido do contexto (o `cena.amostras`), nunca pelo nome da qualidade: a queda deixa a Baixa com MSAA. Chamado na criação, no `aoRecriar` e no `webglcontextrestored`.
- **Bandeiras:** a mesma compensação de alfa pelo nível do mip que a torcida já tem (`torcida.js:127-134`) e escrever o alfa da cobertura.
- **Letreiros com `alphaTest` (crítica 15):** com `SAMPLES ≥ 2`, `alphaToCoverage = true`. O `alphatest_fragment` do r170 já faz `smoothstep(alphaTest, alphaTest + fwidth(a), a)` com `ALPHA_TO_COVERAGE` (`three.module.js:13990`). Sem MSAA, como hoje. Medido no pré-jogo (seção K).
- **A2C na torcida e nas bandeiras** (a fórmula do Golus, `a = (a − 0,5)/max(fwidth(a), 1e-4) + 0,5`) **só se a seção K medir ganho**, em dois quadros seguidos com a câmera andando: o torcedor de poucos px pode ficar translúcido. A Baixa mantém o `discard`: sem MSAA o A2C não faz nada no GLES (texto do ES 3.0.2 no `OES_sample_variables`).
- **A silhueta com MSAA (N11, crítica 14):**
  - nos shaders próprios (torcida, bandeiras, impostor), a UV da AMOSTRA vai num varying `centroid` (no three, `centroid varying vec2 vUvC;` vira `centroid in`, válido no GLSL ES 3.00), e a DERIVADA (`fwidth`, a compensação do mip) vem da cópia sem `centroid`: as derivadas de entradas `centroid` podem sair imprecisas;
  - nos atlas lidos por material do three (placas, escudos, letreiros, números e patrocínios do corpo novo, que é desenho de outra frente): margem de 2–4 px de sangria nas células, se a seção K acusar franja;
  - medido na seção K (cores da silhueta fora da paleta do quadro sem AA).
- **O gancho físico dos testes** (revisão do C1–C3, item 9): `campo.graficos.fisico(bool)` e, na página, `__golaco.graficos.fisico(bool)`.
  - Com `true`, os desenhos seguintes saem SEM os truques: a largura mínima e o `vCob`, a A2C, a mistura sem MSAA e a compensação de alfa das bandeiras. Com `false`, voltam.
  - Os testes desenham com ele as referências (SSAA) e os quadros da máscara geométrica das seções A, A2 e F, e as referências da K.
  - Sem ele, o contexto "sem AA" deixa de ser "o mesmo build menos o MSAA" (o build lê o `SAMPLES`), e a máscara deixa de ser só geometria.
  - Sem ele, o SSAA também sai com a largura mínima do buffer 1×: o render 3× é feito por `setSize` direto, sem o `redimensionar` nem o `uAlturaBuffer`. A referência passaria a depender do código medido.
- **O canvas opaco com a A2C** (o fecho do bloco 3; a regressão do V8): a A2C escreve no buffer o MESMO alfa que usa para a
  cobertura, e o three r170 pede o contexto sempre com `alpha: true` (o `alpha: false` do renderizador só vale para a limpeza).
  Todo material com A2C passa pelo `render/util.js alfaDoCanvas(m, a2c)`: a mistura própria só do canal alfa (a cor substituída,
  o alfa do destino mantido em 1). A cor sai igual bit a bit; o `teste-estadio` 10b confere o alfa 255 em todo pixel. Material
  novo com A2C (C11 em diante) chama a mesma função.
- **Os ganchos do contexto restaurado:** o R4 estraga a A2C e o `uAlturaBuffer` ANTES do `loseContext()` (a A2C ao contrário, o uniform em −1) e só passa se o `webglcontextrestored` (ou o `onBeforeRender`) os refizer. Postos só na criação, eles NÃO passam.
- **Fontes:** Humus, Phone-wire AA; Golus, Anti-aliased Alpha Test; Castaño, Computing Alpha Mipmaps; GLSL ES 3.00 (o qualificador `centroid`); three r170 `WebGLProgram.js:744`, `WebGLPrograms.js:564` e o `alphatest_fragment`.
- **Pode quebrar:**
  - `teste-rede-tela` (a armação e a rede no mesmo quadro);
  - `teste-estadio` (gol roteirizado; a torcida ≥ 12 por print);
  - `teste-corpo-tela` C9–C11 (as bordas dos decalques com MSAA);
  - prints da rede;
  - o `fwidth`/derivada fora de desvio (lição do PR #631: as derivadas no topo do shader).

### Passo 6: o painel `?perf` / `?qps` (D14, N3) — ~2 h

- **Arquivos:**
  - `golaco/js/render/medidor-quadros.js` (novo, puro, sob demanda): anel de 240 intervalos entre DESENHOS e da CPU do quadro; p50/p95/pior 1%; acumulado por fase (jogo, replay, comemoração, cena, pré-jogo, tela antes do jogo, pausa).
  - `main.js`: `medirQps` em 3100-3109; as chamadas em 2997 e 3924 (a de 3924 passa o intervalo entre desenhos, N3); `params.get('qps')` em 4524 aceita também `perf`; `__golaco.perf()` devolve o objeto (para os testes e para colar).
  - `hud.js:1300-1302`.
  - `css/estilo.css:375-379` e 990-1009.
- **Por cima de tudo (crítica 24):**
  - o `.qps` mora dentro do `.hud`, que é `position: fixed; z-index: 10; pointer-events: none` (`estilo.css:86`) e abre contexto de empilhamento: nenhum z-index do filho passa da tela antes do jogo (35), do replay (30) ou da pausa (40);
  - com `?perf=1`, o painel vai para o `body` (`document.body.append`) com a classe `perf-fixo`: `position: fixed`, `z-index: 62` (acima do `.carregando` da carga, 60; abaixo dele na troca e no erro, 63), `pointer-events: none` e `user-select: none` (a revisão do bloco 4: com `auto` e `text` ele roubava os toques dos botões do jogo e das Opções; a seleção nem funcionava, o texto é trocado a cada 0,5 s — o dono manda o print);
  - as regras que o escondem no replay, na comemoração e nas cenas (`estilo.css:990-1009`) não pegam o `.perf-fixo`.
- **O painel mostra:**
  - qps desenhados e ms (p50/p95);
  - CPU do quadro p95;
  - chamadas e triângulos;
  - qualidade (escolha e atual);
  - AA: `antialias`, `SAMPLES` e o modo provável (implícito no Chrome Android/Ganesh; separado no Safari, no Mac e no Graphite; implícito emulado no SwiftShader), deduzido da GPU e do navegador;
  - buffer W×H e pixel ratio (o teto dos tablets, se aplicado);
  - GPU: `UNMASKED_RENDERER_WEBGL` pelo `WEBGL_debug_renderer_info`; no Firefox, o `gl.RENDERER` comum (lá a extensão avisa no console que está obsoleta);
  - o ritmo do rAF ("rAF N Hz", não "tela": numa página lenta é o ritmo dela) e o teto (*n*);
  - queda (na sessão e gravada);
  - a fase.
- **Tempo de GPU:** só com `EXT_disjoint_timer_query_webgl2` (0,43% dos Android, 0,22% dos iOS); sem ela, "—".
- **Pode quebrar:** `teste-hud-minimo` (o painel não aparece sem F3 ou `?qps`/`?perf`); `teste-carga` (a lista do que é sob demanda: o `medidor-quadros.js` entra numa lista nova "só com o painel", nunca no inicial e sem pré-carga; a lista mora no `teste-carga.mjs`, NÃO no `SOB_DEMANDA` do `config.js`, que é do fecho).

### Passo 7: a troca de qualidade, a queda gravada e a perda de contexto (D15, N1, N4, N5, N7, N8, N9) — ~3 h

- **Arquivos:**
  - `main.js`: `aplicarQualidade` 3128-3137, `adaptarQualidade` 3112-3126, o comando `qualidade` 4189-4196, a API `definirQualidade` 4949, a mira 438-444, `compilarAntesDoDesenho` 3676-3683, `qAutoInicial`/`escolhaQ` 348-352, prefs 302-312;
  - `hud.js`: API nova `ocupado(texto)`/`livre()` com a tela de carregamento por cima, SEM transição (o `.carregando` tem `transition: opacity 0.35s`, `estilo.css:952-956`: "esperar 1 quadro" mostraria o véu quase transparente e logo depois o fio trava); o texto da pausa 1259-1263;
  - `render/cena.js` (os ganchos `aoRecriar`, já do passo 1);
  - a decisão da queda numa função pura (`render/ritmo-desenho.js`, junto do teto do passo 8), testada em Node.
- **Dois caminhos para a troca manual (crítica 4):**
  - **Imediato** (`__golaco.definirQualidade`, a API dos testes): recria, roda os ganchos, `renderer.compile()` síncrono e volta. É o comportamento de hoje mais as cópias. O `teste-estadio:112` e o `:1131-1133` (trocam e desenham no mesmo `evaluate`) continuam valendo.
  - **Pela pausa** (≡ → Opções): marca `trocandoQ` (o `quadro` não desenha enquanto ela vale) → `hud.ocupado('Ajustando os gráficos…')` à vista sem transição → `await proximoQuadro()` duas vezes (a tela pintada) → recria → os ganchos (`campo.definirAA`, a mira) → `compilarAntesDoDesenho()` e o aquecimento da mira se o módulo dela estiver carregado → desenha 1 quadro (a pausa mostra o jogo congelado atrás) → `hud.livre()` → tira a marca.
  - ~~O `compile()` só percorre o visível (N8)~~ — corrigido no C12: ele percorre a cena inteira (seção 1.2); o que está nela compila junto.
- **Feito no C12** (`234ba552`, `e8fcb651`, `9f3eb26f`): o medido e o que mudou além deste passo na seção 6, "Medido no C12".
- **A revisão do bloco 4** (seção 6, "Medido no bloco 4"): a espera dos programas com prazo de 3 s e fim na perda do contexto e no
  renderizador trocado (`main.js esperarProgramas`; o `compileAsync` do r170 nunca resolvia com o contexto perdido); a pausa inert
  e travada (`tratarAcao`, `pausado()`) e o foco na tela durante a troca; no online a troca não compila a cena inteira; a regra da
  gravação pela mediana.
- **Queda automática:**
  - na sessão, a MESMA regra de hoje (3 s, janela de 2,5 s, `qps < 30` na Média), medindo os quadros DESENHADOS (vale com o teto do passo 8);
  - `cena3d.definirQualidade('baixa', false)`: o contexto fica, então o MSAA fica; cai o pixel ratio e as sombras;
  - **grava** `prefs.qualidadeQueda = {de, para, v: 1}` (`golaco.prefs.v1`, `main.js:302`) só se (a regra da revisão do bloco 4; seção 2):
    - a janela que caiu foi lenta de verdade (a mediana dos intervalos ≥ o intervalo do mínimo − 1 ms);
    - com o ritmo preso em 30 regular (a mediana a ±1 ms de 33,3 e p90 − p10 ≤ 2 ms: o iPhone em pouca energia, o economizador do Android), só se a janela seguinte, no nível de baixo, desenhou mais rápido;
    - e fora de `navigator.webdriver`, `PRINTS` e `DEMO_ON`;
  - o `__golaco.quedaDeTeste()` grava de propósito;
  - na próxima carga com "Automática", `qAutoInicial` vira a qualidade gravada (`main.js:349-352`);
  - escolher qualidade à mão apaga a queda;
  - a linha da pausa: "Agora: Baixa (o aparelho não segurou a Média; escolha Média para tentar de novo)".
- **Perda de contexto (N7):** o ouvinte do passo 1 roda os ganchos no `webglcontextrestored`; o `main.js` reaquece a mira e redesenha. Testado pelo `WEBGL_lose_context` (seção R).
- **Desde o C5 a troca Média↔Baixa também recria o renderizador** (o AA difere; na main só a Alta↔Média/Baixa recriava): o
  aquecimento da mira (`main.js:444`) fica no contexto velho e ela compila na 1ª bola parada depois da troca (um engasgo). O
  `aoRecriar` ainda não tem consumidor: este passo (C12) TEM de entrar antes do merge; se não entrar, o PR diz o engasgo (a
  revisão do C4–C8, shader 4).
- **Fonte:** `KHR_parallel_shader_compile` em 0,23% dos Android (web3dsurvey): recompilar trava. No iOS o contexto velho é liberado antes de criar o novo (o `cena.js` já faz `dispose` + `forceContextLoss`). O rAF a ~30 no modo de pouca energia: o teste do WebKit, Motion e o fórum da GreenSock.
- **Pode quebrar:**
  - `teste-pausa-tela` (o submenu Opções);
  - `teste-prepartida-tela` (o `inert` da tela);
  - `teste-estadio` (a troca imediata; tem de ficar igual);
  - o pré-jogo com o vão das placas aberto (a cópia do `localClippingEnabled`);
  - `teste-bola-parada-tela` e `teste-mira-tela` (a mira depois da troca);
  - `legacy-total-match/ferramentas/testar-3d.mjs` (o 3D no iframe, sem `?q`, com webdriver: a queda não pode gravar).

### Passo 8: o teto de quadros (D16) — ~2 h

- **Arquivos:** `golaco/js/render/ritmo-desenho.js` (novo, puro); `main.js` (`aoQuadro`, 4542-4546).
- **Como funciona:**
  - mede o refresh pela mediana dos últimos 30 intervalos do rAF (todos, não só os desenhados), refeita a cada 2 s;
  - *n* = max(1, floor(Hz/60 + 0,1)), só no celular (tabela na seção 2);
  - o `aoQuadro` pula o `quadro()` nos quadros fora do ritmo.
- **O que não muda:**
  - Fica no `aoQuadro`, nunca dentro do `quadro()`: o relógio manual dos testes (`api.relogio.avancar` → `quadro`) e o `teste-laco` ficam iguais.
  - O `dtReal` do `quadro` já é o intervalo desde o último `quadro()` (`main.js:2870`): com o teto ele passa a ser o intervalo entre desenhos, sem mudança.
  - O laço continua a 1 passo por quadro a 60 (encaixe 1/60 do `laco.js:16`).
  - A 72 ou 82,5 qps, 0 ou 1 passo por quadro sem encaixe (aceitável; um encaixe novo no `laco.js` é opcional, e o `laco.js` está fora do fecho).
  - A entrada é por evento, então nada se perde.
  - A tela antes do jogo a 30 qps (`PP_QPS`, pelo relógio), o pré-jogo, a tela cedo (`quadroTelaCedo`, rAF próprio e sem 3D) e o online seguem iguais.
- **Fonte:** o Safari do iPhone já segura o desenho perto de 60 por padrão (iGeeksBlog, Macworld), então o teto pesa no Android. Com o teto, o custo do MSAA cai pela metade nos celulares de 120 Hz.
- **Pode quebrar:** `teste-carga` (laço a 60/120/144 Hz pelo relógio manual: não passa pelo `aoQuadro`); latência (+1 quadro de 120 Hz = 8 ms; a resposta ≤ 0,1 s fica).

### Passo 9: as metas valendo, o CI e os documentos — ~3,5 h

- **Os dois testes novos:**
  - as metas passam de informativas a valendo;
  - entram na lista do `tools/rodar-navegador.mjs` (`LISTA`, 16-46);
  - o tempo de cada um no `tools/lib/tempos-ci.mjs` (estimativa ~150 s cada; `TEMPO_NOVO` é 60): acertar pelo log do 1º CI;
  - **a CPU pareada no CI** (revisão do C1–C3, item 4): o job do `teste-graficos-pagina` faz o checkout da base (`git worktree add` do `origin/main`) e passa `--base <worktree>/golaco`. A referência não tem mais CPU nenhuma; sem `--base`, a P só informa;
  - **a referência é a do Chromium do CI** (o Playwright 1.56.1 do `golaco-testes.yml`, Chromium 141). Gravar de novo sempre com ele (`NODE_PATH` e `PLAYWRIGHT_BROWSERS_PATH` de uma instalação da mesma versão). A tolerância das guardas "nada pior" só abre com outro RENDERIZADOR; outra versão do Chromium só avisa.
- **Os testes de navegador afetados:** rodar os da seção 6 contra a base nas mesmas sementes e recalibrar SÓ o que mudou de propósito (a tabela antes → depois no PR).
- **Os tempos do CI:** medir o tempo de cada um com e sem MSAA. Se algum passar de +20%, `?aa=0` só nesse teste (como o `?replay=0`) e anotar. Os de imagem, o `teste-carga` e os dois novos ficam com o MSAA.
- **Documentos:**
  - `CONTRATOS.md`: seção nova "Gráficos do celular (item 45)":
    - a tabela de AA no render e o teto dos tablets;
    - o `config.QUALIDADE.antialias` legado;
    - nenhum render target depois da passada principal (quebra a média das amostras na GPU);
    - os parâmetros `?aa`, `?gfx`, `?tom`, `?perf`;
    - a queda gravada (e quando NÃO grava) e o teto;
    - o gramado UEFA puro e a profundidade relativa ao foco;
    - a regra das silhuetas: `centroid` na amostra, derivada sem ele, sangria nos atlas;
    - os ganchos `aoRecriar` (recriação e contexto restaurado).
  - `PESQUISA-ESTADIO.md` §19 (as três pesquisas condensadas com os links já entraram no C0): a tabela antes → depois.
  - `FILA.md`: item 45, as linhas corrigidas, "Depende do dono" 30.
  - `CATEGORIAS.md`.
  - `CLAUDE.md` (parágrafo do item 45).

---

## 4. Os testes novos (navegador, CI a partir do C14)

**Dois arquivos, quadro determinístico:**

- **`golaco/tools/teste-graficos-celular.mjs`: caminho A, pelos módulos** (como o `teste-rede-tela`; o gramado, as linhas, os finos e o serrilhado da geometria do campo):
  - `criarCena` + `criarCampo` numa tela 1266×585 (844×390 com dpr 2, Média), com o contexto pré-criado quando o AA é forçado;
  - a câmera de TV do celular por `perfilCamera`/`geometriaTV`/`poseTV` de `render/enquadramento.js`, com o foco no meio, no gol de lá e no canto; e as câmeras da G4b;
  - `readPixels` no mesmo `evaluate` do desenho;
  - visibilidade por nome (`gramado`, `linhas`, `gols`, …) para isolar o gramado.
- **`golaco/tools/teste-graficos-pagina.mjs`: caminho B, pela página** (as chamadas, a torcida, os jogadores, o painel, a recriação, a queda, o teto):
  - `?prints=1&q=media&hora=dia|noite&toque=1&entalhe=1&semente=N&replay=0&comemoracao=0`, mais `?prepartida=1`/`?prejogo=1` onde dito;
  - `g.relogio.avancar`, `g.cameraLivre`, `g.desenhar`, `estado().desenhoChamadas`;
  - o AA forçado na main por um `addInitScript` sobre o `getContext` do `#tela`.

Na referência só ficam valores agregados com tolerância, nunca o hash dos pixels, e nenhuma medida da MÁQUINA (a CPU é pareada, seção P). A versão do Chromium e a do SwiftShader vão gravadas. Com OUTRO renderizador, as guardas "nada pior" que dependem da rasterização ganham +50% de tolerância e avisam; outra versão do Chromium só avisa (revisão do C1–C3, item 5: 147 dos 153 valores do `celular` saíram idênticos no 141 do CI e no 153 daqui, e os 6 outros na 5ª casa). A referência é gravada com o Chromium do CI. As metas absolutas valem sempre.

**Seções** (antes = calculado ou a gravar na main). A coluna "Reprova na main" é o que se espera pelas contas; o passo 0 confirma, e a meta que a main não reprovar vira informativa e o PR diz.

**Medido na main (C3; regravado na revisão do C1–C3).** A referência está em `tools/dados/graficos-ref.json`, chaves `celular` (281 valores) e `pagina` (79 valores, nenhum de CPU):
- gravada da main `e41aa791` pela worktree de leitura, com `--raiz <main>/golaco --gravar-referencia`;
- **Chromium 141.0.7390.37, o do CI** (Playwright 1.56.1 do `golaco-testes.yml`, por `NODE_PATH` e `PLAYWRIGHT_BROWSERS_PATH` de uma instalação à parte), `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. No C3 era o 153 daqui: os valores do `celular` não mudam entre os dois. ~~na página, só a K3 do build sem AA (cobertura 0,926 no 153, 0,986 no 141)~~ — não era a versão: a revisão do bloco 3 achou o mesmo 0,925 no 141 em 2 de 7 rodadas. A K3 não era determinística (o modelo do torcedor 3D e o impostor assado em fatias ociosas chegavam entre os quadros a e b); desde o `35f967c5` a cena ASSENTA antes de cada carga e a K3 desenha o quadro a de novo (estrutura: 0 px), e a referência foi regravada SÓ na K e na A2 (a K3 da main 0,926 / 6,05%);
- tempos com o 141: ~64 s o do celular e ~240 s o da página (com a CPU pareada, `--base`).

A sonda é válida nos dois testes: com `antialias` pedido, o SwiftShader dá `antialias` true e `SAMPLES` 4 (`MAX_SAMPLES` 4); sem pedir, 0. O MSAA funciona no SwiftShader, o mesmo renderizador do CI (conferido também no Chromium 141 do CI).

Depois de gravar, a branch (o mesmo código da main) foi relida contra a referência: o `teste-graficos-celular` inteiro e a seção P da página. Todas as guardas "nada pior" deram iguais à ref.

Cada linha das tabelas "medido na main", abaixo de cada tabela, termina numa destas três classes:
- **vale**: a main reprova, e a mudança tem de levar a meta para dentro. É a prova antes → depois.
- **guarda**: passa na main por construção (a peça ainda não existe; é "nada pior", "chave de volta" ou estrutura). Vale a partir do C14 para nada piorar, mas não conta como prova de melhoria.
- **informativa**: meta de melhoria que a main já cumpre, ou que na main não mede nada. Fica na saída do teste, não reprova, e o PR diz. O C14 passa essas linhas a `info` no código.

**`teste-graficos-celular` (módulos):**

| Sec. | O que mede | Meta (depois) | Reprova na main? |
|---|---|---|---|
| S | Sonda: um contexto com `antialias: true` dá `antialias`/`SAMPLES` = true/4. O build: Média true/4; Baixa false/0; `?aa=0` na Média 0; `?aa=1` na Baixa 4; `?gfx=antigo` na Média 0. SwiftShader sem 4 quando pedido = **teste inválido (reprova)** | como ao lado | sim (Média 0) |
| A | Serrilhado da geometria do campo. Máscara GEOMÉTRICA do mesmo build: \|MSAA − sem AA\| > 0,01 (os dois desenhados com o contexto pré-criado; com o gancho `graficos.fisico` do passo 5, os quadros da máscara saem sem os truques dos finos). E = RMS(imagem − SSAA 3×3) só nessa máscara, no foco e no gol de lá, com o SSAA do **mesmo LOD** (9 desenhos 1× com a câmera a −⅓, 0, +⅓ px: o render 3× descia o mip em log2 3 e punha um piso de textura no E) e físico. Razão E_build / E_semAA no mesmo build | Média ≤ 0,6 (na main, a Média é a sem AA: razão 1); Baixa: razão 1 por construção, e o "nada pior" é pareado com `--raiz` da base, na máscara da base (informativo no CI); noite idem | sim (Média) |
| F | Finos: N pontos ao longo da projeção de cada haste, corda e mastro (foco e gol de lá). Em cada ponto, a intensidade SOMADA no corte transversal (±3 px, contra um quadro sem os gols). "Buraco" = < 15% do SSAA (físico) do mesmo ponto. Cintilação = CV da soma por ponto em 8 quadros com a câmera a 0,25 px por quadro **perpendicular à peça na tela** (o x da câmera para as peças em pé, o y para as deitadas: andando ao longo da peça o traço é o mesmo pixel a pixel e a cintilação não mede nada — revisão do C1–C3, item 2) | **por peça, valendo a pior:** buracos ≤ 5%; cintilação ≤ 1,5 × a do SSAA do mesmo quadro (piso 0,02 no denominador); soma ±30% da do SSAA (sem "fio grosso"); também na "Baixa com MSAA" da queda (pr 1, A2C) | sim (cordas e mastro de lá) |
| G1 | Cor na faixa do foco (OKLab, gramado só) | L 0,58 ± 0,02; C 0,10 ± 0,01; h 124 ± 3° | sim (C 0,128, h 134,8°) |
| G2 | ΔL das faixas (média por faixa, x do mundo de cada pixel pelo raio até y = 0) | 0,056 ± 0,008; ao longe ≥ 0,6× o do foco | sim (0,104) |
| G3 | Faixas e bordas | 18 no campo; cada borda a ≤ max(0,10 m; 1 px) da UEFA; a linha do meio separa claro de escuro | sim (20; 0,75 m na grande área) |
| G4 | O TERMO de profundidade: longe − perto (L, C, h) com − sem o termo (o gancho `semProfundidade`; sem ele, 0), na TV do celular. O absoluto (o termo + as manchas + a luz) é informativo (revisão do C1–C3, item 6) | +0,026 ± 0,008; ΔC ≤ 0; \|Δh\| ≤ 2° | sim (0) |
| G4b | A profundidade nas outras câmeras: 1ª pessoa e lateral baixa do replay, steadicam da comemoração, câmera do gol, "Jogador"/"Atrás" do Livre, bola parada, aéreo do pré-jogo e, desde a revisão do C4–C8, as câmeras baixas das cenas (o contraplano e a reação da comemoração, a entrada, a fila e o túnel do pré-jogo, a frente e o árbitro da cena do cartão), medidas aos pés do assunto; e o corte TV → 1ª pessoa | o L do gramado no foco = o sem o termo ± 0,005 em todas; a parte do termo no salto de L do corte (com − sem) ≤ 0,01 (o salto bruto, informativo: oscila com as manchas) | — (guarda nova; no C7 reprovava em 2 das 9 e, pelo modelo, em todas as baixas novas) |
| G5 | Pico da linha (p95 no foco) | 0,952 ± 0,01 e ≤ 0,97 | sim (0,908) |
| G6 | σL das manchas em blocos de **8 m** (a mancha tem 3–10 m; o `d2` repete a cada 7,3 m e some na média do bloco), sem a média da faixa e, desde a revisão do C4–C8, sem uma QUADRÁTICA em x e z, no quadro como ele sai (com o termo: uma foto também tem a curva do ângulo; o plano não a tirava) | a régua da foto refeita em blocos de 8 m (ponto de partida 0,010 ± 0,004, PROVISÓRIO); a main medida | **informativa** até a régua da foto (a revisão do C4–C8) |
| G7 | GPU = JS: a paridade lida no pixel = `gramado.js faixaEm(x)` | 100% fora da borda | — (estrutural) |
| D | Grão: E e cintilação por faixa da tela contra o SSAA do mesmo LOD, e o longe ÷ o perto no próprio build (o critério do passo 4) | só reprova se o filtro entrou (passo 4); senão informativa | — |
| N | Noite, Baixa e PC. Noite: G2–G5 com as metas do dia, a linha ≤ 0,97 absoluta, e Δh(noite − dia) = o que o `cor-aces` prevê para o albedo do dia medido ± 0,5° (a inversa do ACES e a luz do dia dão o albedo de cada classe, que vai à luz da noite com o poço; a mesma h do dia é impossível com a luz fria, e a "ref ± 2°" caía no limite com as cores do C6: 3,3° → 5,3° — revisão do C1–C3, item 7). Baixa: G1–G5 e F. **PC 1280×720 Alta, dia e noite**: G1–G5 (a câmera a 24,6°) e A nada pior | como ao lado | parcial |

**`teste-graficos-celular`, medido na main (C3):** "forçado" é o mesmo build com o contexto pré-criado com MSAA, o que a Média ganha no C5.

| Sec. | Meta | Esperado na main | Medido na main | Fica |
|---|---|---|---|---|
| S | Sonda | true/4 | true/4 (MAX 4); sem pedir, 0 | estrutura (válido) |
| S | Build Média true/4 | reprova | false/0, buffer 1266×585 (pr 1,5) | vale |
| S | Build Baixa false/0 | — | false/0, 844×390 | guarda |
| S | `?aa=0` na Média 0 | — | 0 (a main não lê `?aa`) | guarda |
| S | `?aa=1` na Baixa 4 | reprova | 0 | vale |
| S | `?gfx=antigo` na Média 0 | — | 0 | guarda |
| A | Média, dia: razão ≤ 0,6 (gol no foco / gol de lá) | reprova (1) | 1,00 / 1,00 (forçado ×0,51 / ×0,45 contra o SSAA do mesmo LOD; com o 3× era ×0,58 / ×0,54) | vale (o MSAA deixa o foco com 0,09 de folga) |
| N | Média, noite: razão ≤ 0,6 (foco / lá) | reprova | 1,00 / 1,00 (forçado ×0,46 / ×0,45) | vale |
| N | A da Baixa, nada pior (foco / lá) | — | E 0,0430 / 0,0550 = ref | guarda (informativa no CI, como no plano) |
| N | A do PC Alta, nada pior (dia foco/lá; noite foco/lá) | — | E 0,0296 / 0,0263; 0,0227 / 0,0279 = ref | guarda |
| F | Média: buracos ≤ 5% em toda peça (foco / lá) | reprova | pior peça 33,3% (mastro) / 55,0% (corda do pé); a média de todos os pontos 20,6% / 31,8%; forçado 0% / 0% | vale |
| F | Média: cintilação ≤ 1,5× o SSAA e soma 0,7–1,3 em toda peça (foco / lá) | reprova | pior peça ×12,6 (mastro) / ×5,84 (mastro); a soma, pior 0,96 / 0,91, passa; forçado ×3,22 (mastro) / ×1,33 (corda do fundo), soma 0,93 / 0,88 | vale (com o MSAA o mastro do foco fica em ×3,22: o C9 tem de fechar) |
| F | Baixa: buracos (foco / lá) | reprova | 57,1% / 62,5% (a corda do pé nos dois) | vale |
| F | Baixa: cintilação e soma (foco / lá) | reprova | ×6,49 (corda do pé) / ×6,02 (mastro); soma 0,90 / 1,03 | vale |
| F | Baixa com MSAA (a queda): buracos (foco / lá) | reprova | 0% / 0% (forçado) | **informativa** |
| F | Baixa com MSAA: cintilação e soma, gol no foco | reprova | ×1,69 (corda do pé), soma 0,88 | vale (era informativa com a câmera só em x: ×1,28) |
| F | Baixa com MSAA: cintilação e soma, gol de lá | reprova | ×2,56 (corda do fundo), soma 0,74 | vale |
| G1 | L 0,58 ± 0,02; C 0,10 ± 0,01; h 124 ± 3° | reprova (C 0,128, h 134,8°) | L 0,582 (passa), C 0,127, h 134,7° | vale (C e h; o L é guarda) |
| G2 | ΔL 0,056 ± 0,008; ao longe ≥ 0,6× | reprova (0,104) | 0,099 perto, 0,102 longe (×1,03 passa) | vale |
| G3 | 18 faixas; bordas ≤ max(0,10 m; 1 px); o meio separa | reprova (20; 0,75 m) | 20; a pior borda a 2,59 m (x = 18,3); o meio separa (0,541 \| 0,639) | vale (as faixas e as bordas; o meio é guarda) |
| G4 | O termo (com − sem): ΔL +0,026 ± 0,008; ΔC ≤ 0; \|Δh\| ≤ 2° | reprova (0) | 0 (sem o gancho: a main não tem o termo); o absoluto, informativo: ΔL +0,0075 (as manchas, não zero), ΔC +0,0004, Δh −0,18° | vale |
| G5 | 0,952 ± 0,01 e ≤ 0,97 | reprova (0,908) | 0,909 | vale |
| G6 | 0,010 ± 0,004 | a confirmar | 0,0054 em 58 blocos (a pesquisa estimou ~0,005): fora por falta de mancha. Régua nova (quadrática): 0,0049 | **informativa** (a régua da foto não foi refeita; ver "Pendente" abaixo) |
| G7 | GPU = JS | estrutural | sem `gramado.js` | estrutura a partir do C4 |
| G4b | Com × sem o termo ≤ 0,005 nas 16 câmeras (as 9 e as 7 baixas das cenas, desde a revisão do C4–C8); a parte do termo no salto TV → 1ª pessoa ≤ 0,01 | guarda nova | sem o gancho: o L no foco vai de 0,513 a 0,650 nas 16; o salto bruto 0,0011 (informativo), a parte do termo 0 | guarda (o com × sem só com o gancho do C7) |
| D | O grão | informativa | contra o SSAA do mesmo LOD: E 0,0033 (perto) a 0,0020 (longe), cintilação ×1,30–×1,33 em todas as faixas; longe ÷ perto: E ×0,70, cintilação ×0,32 (com o SSAA 3×: E 0,0030–0,0034, ×0,66–×0,84) | informativa. **C8: medido, sem filtro** (o gramado do C6 + o termo do C7: longe ÷ perto E ×0,68, cintilação ×0,29; ×1,33–1,36 o SSAA em todas as faixas; a Baixa ×0,72 / ×0,29; passo 4) |
| N | Noite G1 | informativa (só o Δh conta) | L 0,568, C 0,124, h 138,0° | informativa |
| N | Noite G2 / G3 / G4 | reprova | 0,098 (longe ×1,00) / 20 faixas, 2,59 m / o termo 0 (absoluto ΔL −0,0094, ΔC −0,0028, Δh +0,01°) | vale |
| N | Noite G5 ≤ 0,97 | guarda (teto) | 0,902 | guarda |
| N | Δh(noite − dia) = o previsto pelo `cor-aces` ± 0,5° | guarda | 3,32° medido, 3,32° previsto (a noite prevista L 0,568 C 0,124 h 138,0° = a medida) | guarda |
| N | Baixa G1–G5 | reprova | L 0,581 C 0,127 h 134,7°; ΔL 0,099; 20 faixas, 2,60 m; o termo 0 (absoluto +0,0082, ΔC +0,0005); linha 0,909 | vale |
| N | PC Alta, dia, G1–G5 | reprova | os números da Média do dia (L 0,582 C 0,127 h 134,7°; 0,099; 20 / 2,59 m; o termo 0, absoluto +0,0075; 0,909) | vale |
| N | PC Alta, noite: G1 / G2–G4 / G5 | parcial | G1 L 0,568 C 0,124 h 138,0°; 0,098; 20 / 2,59 m; o termo 0 (absoluto ΔL −0,0057, ΔC −0,0018); linha 0,902 | G1 informativa; G2–G4 vale; G5 guarda |

**`teste-graficos-pagina` (página):**

| Sec. | O que mede | Meta (depois) | Reprova na main? |
|---|---|---|---|
| S2 | Sonda na página: Média 4 no 844×390; tablet 1366×1024 com toque e dpr 2 na Média = 0 (o teto de 1,2 MP); `?aa=1` no tablet = 4; PC 1280×720 Média = 4 | como ao lado | sim (Média 0) |
| A2 | Serrilhado do quadro inteiro (jogadores, bola, torcida, placas) com `?aa=0` × `?aa=1` (na main, o `addInitScript`): a mesma máscara geométrica (física, com o gancho), a mesma referência do mesmo LOD e a mesma razão da A | Média ≤ 0,6 | sim |
| K | Recortes e silhuetas: (1) franjas — pixels da borda no MSAA cuja cor não é mistura das cores vizinhas do quadro sem AA (distância OKLab > 0,03), na torcida, nas bandeiras, nas placas e escudos e, no pré-jogo, nos letreiros; (2) a cobertura das bandeiras a 50 e a 100 m contra o SSAA; (3) a A2C da torcida e das bandeiras: só entra se a cintilação da silhueta cair em dois quadros seguidos com a câmera andando, sem a cobertura média do torcedor cair > 10% contra o SSAA | franjas ≤ 0,2% das bordas com o **centro do pixel FORA** da região (a amostra extrapolada: o N11, o que o `centroid` muda) e ≤ o da main com o MSAA forçado; com o centro DENTRO, a franja é o fundo escondido na mistura do MSAA, um piso da medida que o `centroid` não muda (0,7% na torcida): informativa (revisão do C1–C3, item 1). Cobertura das bandeiras ≥ 0,8 × SSAA (o 3×, de propósito: o mip mais fino é a cobertura de verdade, e o afinamento do alfa no mip é o que a K2 procura); a A2C só com ganho medido | sim (bandeiras de longe) |
| P | Chamadas e triângulos no quadro fixo da TV; CPU do quadro p95 (o `medirQuadro`, sem a GPU, CPU 4×, 10 s de `?demo=1`, como o `teste-desempenho-celular`) | chamadas = ref (+0; a FILA admite ≤ +2); triângulos ≤ ref + 1%; **CPU p95 ≤ 6 ms e nada pior que a base** (PAREADO: `--base <pasta golaco da base>` abre a base junto e alterna ≥ 5 janelas de 400 quadros de cada; a mediana das diferenças por par ≤ +1,0 ms — o +0,2 reprovava o mesmo código em 2 de 5 rodadas; a CPU não vai à referência — revisão do C1–C3, item 4). A base já passa de 6 ms nessa medida (o motivo de o `teste-desempenho-celular` ser informativo): o PR mostra o número da base e vai ao "Depende do dono" 30. O `desenho` do `medirQuadro` NÃO serve de régua para os 6 ms (o ruído não separa versões: item 17) | — (guarda) |
| P2 | `?perf=1` e `?qps=1`: o painel tem p95, fase, AA, buffer, GPU, refresh; visível no replay, na tela antes do jogo (`?prepartida=1`) e na pausa (o "por cima" pela pilha do ponto, `elementsFromPoint`, com toda camada recebendo toque e nenhuma `inert` durante a leitura, e só tapa a camada à vista que PINTA ali: senão o véu, a marca REPLAY e o fundo da pausa não contavam, e a camada transparente de tela inteira contaria — item 10); a tela antes do jogo mostra ~30 (N3); `__golaco.perf()`. Desde a revisão do bloco 4: o painel NÃO pega toque — em 5 pontos de cada botão de toque e do analógico no jogo (844×390, 667×375, 568×320) e de cada controle das Opções da pausa (844×390, 568×320), o `elementFromPoint` de verdade nunca é ele (e ele passa por cima de algum alvo) | como ao lado | sim (não existe; 60 em vez de 30) |
| P3 | `?gfx=antigo` = a ref da main em G1–G5 (± tolerância) e `SAMPLES` 0 na Média; `?tom=neutro`: `NeutralToneMapping` e a exposição = `H.exposicao` × 1,40 de dia e de noite, também depois de `definirHora` e de uma recriação | como ao lado | — (chave de volta) |
| R | Recriação e contexto. (1) Celular, `?prepartida=1`, depois do `pronto3d`, pelo ≡ → Opções: Média → Baixa → Média: `SAMPLES` 4 → 0 → 4, o canvas novo com `aria-label` e `inert`, a tela "Ajustando…" aparece e some, a mira cobra (`bolaParadaDeTeste`). (2) **PC 1280×720, Alta → Baixa** com `?prejogo=1` no plano do vão aberto: o `local` do vão true, o `aria-label`. (3) `__golaco.definirQualidade` imediato: troca e desenha no mesmo `evaluate`. (4) `WEBGL_lose_context`: os ganchos ESTRAGADOS antes (a A2C ao contrário, o `uAlturaBuffer` em −1: postos só na criação, eles passavam sem o ouvinte — item 3), `loseContext()` → `restoreContext()`: os ganchos rodam de novo (A2C = `SAMPLES`, `uAlturaBuffer` = `drawingBufferHeight`), a mira cobra, o quadro desenha (pixels ≠ preto). As trocas esperam terminar (teto de 90 s; a que não termina reprova — item 12). 0 erro no console em tudo. Desde a revisão do bloco 4: no (1) a mensagem "Ajustando…" por cima de tudo e o painel `?perf` inteiro debaixo dela (a pilha do ponto: 5 pontos da mensagem, 3 do painel), a pausa `inert` e o foco na tela durante a troca, de volta na pausa no fim; no (4) o `uAlturaBuffer` é estrutura (o `onBeforeRender` o refaz a cada desenho; só a A2C prova o gancho); (5) o `KHR_parallel_shader_compile` FALSO (a GPU nunca diz "pronto": o `compileAsync` nunca resolve, como com o contexto perdido): a carga com a tela cedo chega ao pronto e as duas trocas pela pausa no jogo terminam (o prazo de 3 s); no meio delas, Esc e Esc (uma) e P (a outra) não fecham a pausa nem andam o tick | como ao lado | sim (aria-label, inert e clipping na Alta → Baixa; `SAMPLES`; o contexto restaurado sem os ganchos) |
| Q | Queda: `__golaco.quedaDeTeste()`: mesmo canvas (sem recriar), `qAtual` 'baixa', `SAMPLES` continua 4, a queda nas preferências, a linha da pausa; recarregar em Automática abre na Baixa com `SAMPLES` 0; escolher a Média apaga. A queda natural com webdriver (um rAF falso a 20 Hz, sem `?q`): cai na sessão e NÃO grava. Desde o C13, no fim: um rAF falso a 120 Hz por 8,6 s de volta na Automática (o teto desenha 60) NÃO cai | como ao lado | sim |
| Z | Redimensionar: atribuições a `canvas.width/height` (instrumentadas pelo `addInitScript`) com o mesmo tamanho (`resize` + `visualViewport`) e com um tamanho novo | mesmo tamanho: 0 (main: 8); tamanho novo: 2 (main: até 8) | sim |
| T | Teto: um `addInitScript` com um rAF falso a 90, 120, 144 e 165 Hz (o headless roda o rAF a 60); conta os desenhos pelo `renderer.render` (o `soContar`). Desde o C13 também: o painel (`__golaco.perf().refresh`) diz o rAF (o `hz` do ritmo do C13 e, desde a revisão do bloco 4, o `rafHz`, a mediana do medidor: duas contas do mesmo rAF) e o *n*; a tela antes do jogo (`?prepartida=1`) a 144 e a 165 Hz no ritmo dela | celular: 90 / 60 / 72 / 82,5 por segundo ± 1, intervalos regulares; PC sem toque: sem teto; o painel: a tela ± 1 Hz e o *n* 1 / 2 / 2 / 2 (PC null); a tela antes do jogo 28,8 e 33 ± 1 (como sem o teto) | sim (desenha todos) |

**`teste-graficos-pagina`, medido na main (C3):** "forçado" é a carga com o MSAA pelo `addInitScript`.

| Sec. | Meta | Esperado na main | Medido na main | Fica |
|---|---|---|---|---|
| S2 | Sonda | true/4 | true/4 (MAX 4); sem pedir, 0 | estrutura (válido) |
| S2 | Celular 844×390 dpr 2, Média = 4 | reprova | 0 (1266×585) | vale |
| S2 | Tablet 1366×1024 com toque, dpr 2, Média = 0 | — (o teto) | 0 (2049×1536, 3,15 MP) | guarda |
| S2 | Tablet com `?aa=1` = 4 / PC 1280×720 Média = 4 | reprova | 0 / 0 | vale |
| A2 | Razão ≤ 0,6 (TV na bola / gol no foco) | reprova | 1,00 / 1,00 (forçado ×0,70 / ×0,47 contra o SSAA do mesmo LOD; com o 3× era ×0,70 / ×0,55); máscara 1,41% / 0,97% | vale (na pose da bola, só o MSAA fica fora: 0,70; o C10 tem de baixar, senão a meta se revê no C14) |
| A2 | Carga oposta forçada; carga igual = o mesmo quadro | estrutura | `SAMPLES` 4; 0 px nos 3 quadros, o hash igual | estrutura |
| K | K1 franjas ≤ 0,2% com o centro FORA: torcida, TV na bola | reprova | 2,36% (19 de 804 px; forçado). O centro dentro, informativo: 1,32% (11 de 835); todas as bordas 1,83% | vale |
| K | K1 franjas ≤ 0,2% com o centro FORA: torcida, gol no foco | — | 0% (0 de 611). O centro dentro: 1,24% (11 de 890), todas 0,73%: era 100% piso, a meta antiga reprovava mesmo com o `centroid` certo | guarda |
| K | K1 franjas ≤ 0,2% com o centro FORA: bandeiras (bola / gol no foco) | reprova (o N11) | 13,40% (173 de 1291) / 3,91% (14 de 358) (forçado; a linha verde-clara da faixa da mureta). O centro dentro: 1,85% / 0,51% | vale |
| K | K1 franjas: placas (bola / gol no foco) | — | 0 px de borda fora / 0% de 366; o centro dentro 0% de 1262 / 219 | guarda |
| K | K1 franjas: letreiro do pré-jogo | reprova | 0 px de borda (sem a A2C o MSAA não muda um `alphaTest`) | **informativa** (na main não mede nada; ~~com a A2C do C10 vira guarda ≤ 0,2%~~ — o letreiro do Estádio Golaço é TRANSPARENTE e a A2C do C10 não o pega: continua 0 px; o opaco, o do Maracanã, só na edição pro, medido à parte no C10. O C14 decide se mede o pro aqui) |
| K | K2 cobertura das bandeiras de mastro ≥ 0,8 do SSAA (50 m / 100 m) | reprova (as de longe) | 0,966 / 0,935 sem AA; forçado 1,006 / 1,004 | **informativa** |
| K | K3 A2C da torcida | informativa | ~~sem AA: cobertura 0,986, cintilação ×1,16 (no Chromium 153: 0,926 e ×1,32); forçado 0,987 e ×1,23~~ regravada com a cena assentada (`35f967c5`): sem AA 0,926 e 6,05% (SSAA 4,60%, ×1,32); forçado 0,926 e ×1,32 | informativa |
| P | Chamadas = ref; triângulos ≤ ref + 1% | guarda | 31; 91 524 | guarda |
| P | CPU p95 ≤ 6 ms (a mediana de 6 janelas de 400 quadros) | guarda | 7 rodadas da main (C2/C3, "historicoCpu" no JSON): 5,8 a 6,8, mediana 6,2. Com o 141, pareada: 5,6; 6,9; 7,0; 6,7; 6,8 | o "≤ 6 ms" absoluto **informativo** (a base já passa dele: "Depende do dono" 30) |
| P | CPU nada pior que a base, PAREADO (`--base`): a mediana das diferenças por par ≤ +1,0 ms | guarda | a main contra ela mesma: +0,10; +0,30; +0,70; 0,00; +0,20 (5 rodadas de 6 pares). Numa delas os 6 pares ≥ 0: o efeito é da instância do navegador, e alternar as janelas não o tira | guarda. O +0,2 do plano reprovava o mesmo código em 2 de 5 rodadas; com +1,0 a guarda pega a piora de ~15% para cima (o +0,2 não se mede neste equipamento: vai ao "Depende do dono" 30 com os 6 ms) |
| P | O desenho p95 (a parte JS do render, 120 quadros) | informativo | 10,5, 9,2, 12,8, 7,8 na main (C3); pareado, medida × base: 8,3 × 9,9; 5,9 × 11,7; 9,2 × 16,6; 10,6 × 11,3 | informativo: o ruído não separa versões (item 17 da revisão). "Os 6 ms valem para o desenho" (a saída da P) NÃO serve de régua |
| P2 | `__golaco.perf()`; a fase no jogo | reprova | não existe | vale |
| P2 | O painel com p95, fase, AA, buffer, GPU e refresh | reprova | "60 qps · 16.7 ms / 25 chamadas · 91 mil tri / qualidade media" | vale |
| P2 | O painel por cima da tela antes do jogo / da pausa / no jogo, pausa e replay | reprova | escondido / escondido / no jogo à vista e 100% por cima (o "67%" do C3 era um ponto lido com a tela ainda saindo; agora a leitura espera a tela sair e só tapa a camada que pinta), na pausa e no replay escondido | vale |
| P2 | O qps da tela antes do jogo = os desenhos (N3) | reprova | mostra 60, desenhou 30,2 (×1,99; 83 desenhos em 165 quadros do rAF falso). Sem drenar a GPU antes, a 2ª carga da rodada dava "0 qps" e 0,4 desenho/s: corrigido no teste | vale |
| P3 | `?gfx=antigo`: `SAMPLES` 0 e o gramado = a ref | chave de volta | 0; L 0,586, C 0,127, h 134,4°, ΔL 0,097, 3 bordas, +0,0072, linha 0,909 (agora a ref) | guarda |
| P3 | `?tom=neutro`: Neutral e a exposição × 1,40 | — | ACES em todos; exposição 1,000 de dia e 0,980 à noite (meta 1,400 e 1,372), 2 recriações | vale (a main ignora o `?tom`) |
| R | R1 `SAMPLES` 4 → 0 → 4 | reprova | 0 → 0 → 0 (o mesmo canvas) | vale |
| R | R1 o `aria-label` e o `inert` depois das trocas | reprova | ficam (na main a troca Média ↔ Baixa NÃO recria: o AA é o mesmo) | guarda (prova de verdade quando o C5 fizer essa troca recriar) |
| R | R1 "Ajustando…" à vista e fora | reprova | visto 0× | vale |
| R | R1 / R4 a mira desenha depois | — | 3476 / 8697 px | guarda |
| R | R2 Alta → Baixa: o `localClippingEnabled` do vão e o `aria-label` | reprova | true → false; "Campo 3D" → null | vale |
| R | R3 troca e desenha no mesmo `evaluate`; R4 perde, restaura e desenha | estrutura | 96,0% / 96,1%; 94,4% não preto | estrutura |
| R | R3 `SAMPLES` pela tabela | reprova | 0 → 0 → 0 | vale |
| R | R4 os ganchos (A2C dos finos, `uAlturaBuffer`), estragados antes de perder o contexto | reprova | estragada a A2C (true com `SAMPLES` 0) continua true depois; sem `uAlturaBuffer` | vale |
| R | R1 as trocas terminam (≤ 90 s, a que não termina reprova) | estrutura | Baixa 1,4 s · Média 0,6 s | estrutura |
| Q | A queda natural com webdriver: cai, NÃO grava, a recarga abre na Média | guarda | media → baixa no quadro virtual 100 (5,0 s do rAF falso a 20 Hz); preferências `{}`; media | guarda |
| Q | `quedaDeTeste()`; a recarga depois da queda gravada abre na Baixa | reprova | não existe; media | vale |
| Q | Escolher a Média apaga a queda | — | nada a apagar | guarda a partir do C12 (na main não há como medir) |
| Z | Mesmo tamanho 0; tamanho novo 2 | reprova | 8 (4 + 4); 8 | vale |
| T | Celular a 90 Hz = 90; PC a 144 Hz sem teto | — | 90,0; 144,0 | guarda |
| T | Celular a 120 / 144 / 165 Hz = 60 / 72 / 82,5 | reprova | 120,0 / 144,0 / 165,0 (regulares) | vale |
| P2 | O painel não pega toque no jogo (844×390, 667×375, 568×320; revisão do bloco 4) | reprova | 0 pontos tomados, mas 0 sob a caixa do painel (3 linhas no `#hud`): a guarda não prova nada lá | vale |
| P2 | O painel não pega toque nas Opções da pausa (844×390, 568×320) | — | 0 de 100 nas duas (23 e 28 sob a caixa; `pointer-events: none` herdado do `#hud`) | guarda |
| R | R1 a mensagem "Ajustando…" por cima e o painel debaixo dela; a pausa `inert` e o foco na tela durante a troca (revisão do bloco 4) | reprova | 0 amostras (a main não tem a tela) | vale |
| R | R4 o `uAlturaBuffer` = a altura do buffer (estrutura) | — | não existe | estrutura |
| R | R5 o KHR falso: a carga com a tela cedo chega ao pronto; as trocas terminam; Esc, Esc e P travados (revisão do bloco 4) | reprova | NÃO chegou ao pronto em 90 s (o `await compileAsync` do item 106 sem prazo) | vale |
| T | O painel: o `rafHz` do medidor ± 1 Hz (revisão do bloco 4) | reprova | `perf()` não existe | vale |

**O que o C3 mudou no plano:**
- **7 metas de melhoria viraram informativas** porque a main já as cumpre ou nelas não mede nada (depois da revisão do C1–C3 ficam 5: a cintilação da Baixa com MSAA no foco voltou a "vale"):
  - F, Baixa com MSAA: os buracos no foco e no gol de lá ~~e a cintilação no foco~~;
  - K2: a cobertura a 50 m e a 100 m;
  - K1: o letreiro;
  - P: o "≤ 6 ms" absoluto da CPU.
- **Riscos para os próximos commits** (contas de "forçado" acima, com as réguas da revisão):
  - o MSAA sozinho NÃO fecha a A2 na pose da bola (0,70) nem a cintilação do mastro da Média no foco (×3,22 a pior peça; a "média geral" de ×1,74 escondia isso);
  - na A do foco ele fecha com 0,09 de folga (×0,51 contra o SSAA do mesmo LOD).
- **Pendente:**
  - a régua da foto da G6 em blocos de 8 m NÃO foi refeita. Fica o ponto de partida 0,010 ± 0,004, e a main sai fora dele por falta de mancha. ~~Fechar no C6, que calibra o `uManchas` por ela, antes de a G6 valer no C14~~ — o C6 NÃO a refez e calibrou o `uManchas` (0,17) contra o ponto de partida (a revisão do C4–C8: conta circular). **Agora a G6 é informativa**, com a régua nova (o quadro com o termo, sem uma quadrática em x e z: a mesma que uma foto pediria), e a comparação k 0,10 × 0,17 em prints vai ao dono (seção 7). Refazer a régua da foto (as fotos da Allianz Arena: a panorâmica não é projeção de lente, e precisa da homografia pelas linhas do campo) é o que faz a G6 valer;
  - a CPU da P vai ao "Depende do dono" 30 (no C16), com a folga do pareado (+1,0 ms: o +0,2 não se mede aqui).
- ~~A ref da `P.cpuP95` é a mediana das 7 rodadas~~: a CPU saiu da referência na revisão (a P é pareada); as 7 rodadas ficam no campo `pagina.historicoCpu` do JSON, só como história, e o `--gravar-referencia` guarda os campos extras do registro.

**O que a revisão do C1–C3 mudou** (a revisão cética, 11/11; cada item conferido no código antes):
- **Aplicadas, as 17** (os números acima já são os novos):
  1. K1: as franjas se separam pelo centro do pixel. A meta conta só o centro FORA (o N11); o centro DENTRO (o fundo escondido na mistura do MSAA) é informativo.
  2. F: a câmera anda perpendicular a cada peça na tela (dois passes, x e y da câmera), e as metas valem por peça, a pior, com piso 0,02 no denominador.
  3. R4: os ganchos são estragados antes de perder o contexto.
  4. P: a CPU é pareada (`--base`, janelas alternadas) e sai da referência.
  5. A tolerância só abre com outro renderizador, e a referência foi regravada com o Chromium do CI.
  6. G4: vale o termo (com − sem); o absoluto é informativo.
  7. Δh: contra a previsão do `cor-aces` para o albedo do dia medido, ± 0,5°.
  8. A, A2 e D: contra o SSAA do mesmo LOD; a D ganha o longe ÷ o perto do próprio build.
  9. O gancho `graficos.fisico` para as referências e as máscaras (passo 5).
  10. P2: o "por cima" pela pilha do ponto.
  11. Z: espera por condição.
  12. R1: espera com teto de 90 s e falha explícita.
  13. O contexto do `#tela` vem do que a página criou.
  14. A gravação guarda os campos extras.
  15. Q: o quadro em que caiu.
  16. As notas do C6 e do C7 (passos 2 e 3) e a G4b pela parte do termo.
  17. O desenho p95 fica informativo.
- **Com ajuste, e por quê:**
  - **Item 8:** a referência do mesmo LOD saiu por 9 desenhos 1× com a câmera deslocada −⅓, 0 e +⅓ px (as derivadas e o mip ficam os do 1×). Ficou no lugar de um gancho de viés de LOD nos shaders, que não pega a amostragem própria do gramado nem o `texture()` direto. A K2 e a K3 continuam contra o 3×, de propósito: o mip mais fino é a cobertura de verdade, e o afinamento do alfa no mip é justamente o que a K2 procura. Com isso, a razão forçada da A do foco foi de ×0,58 a ×0,51, e a A2 do gol no foco de ×0,55 a ×0,47.
  - **Item 10:** forçar `pointer-events: auto` em tudo fazia toda camada TRANSPARENTE de tela inteira (o `#toque`, a tela antes do jogo saindo com opacidade 0) "tapar" o painel: no jogo deu 0% por cima. A leitura agora é a pilha inteira do ponto (`elementsFromPoint`), com as `inert` liberadas durante a leitura (o fundo da pausa é `inert`, e o Chromium pula `inert` no teste de ponto como pula `pointer-events: none`). Só tapa a camada à vista que pinta ali.
  - **Item 4:** a folga da CPU pareada ficou em +1,0 ms, não +0,2. A main contra ela mesma deu +0,10, +0,30, +0,70, 0,00 e +0,20 em 5 rodadas.
- **Achado ao regravar** (fora da revisão): a P2 dependia de ser a 1ª carga da rodada.
  - Atrás da tela antes do jogo o SwiftShader leva ~3 s por quadro de verdade. Com um quadro em voo, a tela não desenhava nos quadros do rAF falso: 1 em 158.
  - Agora o teste drena a GPU antes de medir e espera a tela sair antes de ler o painel "no jogo".
  - A versão do C2 também quebrava assim com o Chromium 141.
- **Recusadas:** nenhuma; as afirmações conferem no código. A do item 8 ("o SSAA tem mais detalhe que a imagem ideal") depende de qual imagem se chama ideal. O efeito prático, porém, confere: a régua 3× não decidia o passo 4, porque o build "cintilava menos que o ideal". Por isso aplicada.

**O que a revisão do C4–C8 mudou** (três revisões em paralelo — o shader e o código, as medidas e a calibração, as regressões
nos testes de antes —, 11/11; cada achado conferido no código antes; commits `27928d6c`, `b0d9a938`, `7e1a5aea` e este):
- **Aplicadas:**
  1. **O termo nas câmeras baixas** (shader 1): o termo se apaga pela altura da câmera (seção 2) e a G4b ganhou as 7 câmeras
     baixas das cenas, medidas aos pés do assunto: as 16 dentro de ±0,005 (a steadicam −0,0206 → 0,0000, a câmera do gol −0,0186
     → 0,0000); o `teste-gramado` F7 confere pelo modelo 14 câmeras das cenas (reprova sem o apagamento: −0,0207).
  2. **A guarda do shader montado** (shader 2): os textos num módulo puro (`render/gramado-shader.js`) e o `teste-gramado` G (as
     derivadas explícitas e as leituras de textura com mip antes do 1º desvio de cada bloco, nenhuma nas funções; o `?gfx=antigo`
     = o hash da main no mesmo molde; as 6 chaves distintas; a troca sem o trecho avisa). A mutação da revisão (o `fwidth`
     dentro de um `if`) passava e agora reprova. As linhas novas leem o grão ANTES do `discard` (o mesmo resultado por pixel).
  3. **O foco no horizonte** (shader 3): sem tocar o chão, g = 1 (F4: o salto ao cruzar o horizonte 2,2·10⁻⁶).
  4. **A pegada uma vez** (shader 5): `glslTopoGramado(x, fw)`; o bloco do gramado com 1 `fwidth`.
  5. **A G6** (medidas 1, a saída b): informativa; a régua nova tira uma quadrática do quadro com o termo (0,0100; o piso sem as
     manchas 0,0020; a main 0,0049); a comparação k 0,10 × 0,17 vai ao dono.
  6. **O "nada pior" da A sem o contraste** (medidas 2): no PC a razão E_build/E_semAA (×0,986 / ×1,007 de dia, ×1,007 / ×1,000 à
     noite); na Baixa o E ÷ o contraste da referência na máscara (×1,015 / ×1,008; o E absoluto ×1,045 / ×1,022).
  7. **A G4 do PC pelo modelo do ângulo** (medidas 3): 0,033 ± 0,008 (medido 0,0326 e 0,0324; antes passava por 0,0014).
  8. **Os textos** (medidas 4 e 5): as faixas de z do passo 4, os valores calibrados nos passos 2 e 3, a G4b e a G6 na seção 4.
     O "G4b … FORA: 7 de 9" do relato do C8 queria dizer 7 passam e 2 reprovam (não está no plano).
  9. **A G1 e a G2 sem as manchas** (medidas 6): o gancho `semManchas`; L 0,575 → 0,581, o longe ×1,07 → ×1,00.
  10. **O download** (regressões 4): a tabela da seção 5 com o medido.
  - A referência da main foi regravada SÓ nas seções G, A e N (as réguas que mudaram), com `--raiz <main> --so G,A,N
    --gravar-referencia`: 0 valores mudados, 28 chaves novas (o contraste e o E normalizado da A, a G6 quadrática, as 7 câmeras
    da G4b).
- **Não aplicadas, e por quê:**
  - **Shader 4** (a troca Média↔Baixa passou a recriar o renderizador no C5, e a mira aquecida fica no contexto velho): é do C12
    (passo 7, os ganchos `aoRecriar`), que tem de entrar antes do merge; se não entrar, o PR diz que a troca Média↔Baixa pela
    pausa ganhou um engasgo na 1ª bola parada depois dela. Anotado no passo 7.
  - **Regressões 1** (o L5 do `teste-bola-parada-tela`, "GRAVE"): a leitura está errada. As tiras 16 e 17 que saíram da amostra
    não são "gramado ao longe dessaturado": o fundo delas tem uma LINHA do campo (a mira é a trajetória da bola, que sobe, e na
    tela passa por cima de uma linha ao fundo; conferido com a cópia instrumentada da revisão: o mesmo ponto da trajetória,
    (50,4; 28,3) m, nas 3 telas e nas 2 horas). O v máximo da tira é 0,61–0,74, contra ≤ 0,55 nas tiras de gramado puro, e o s
    mínimo 0,14–0,26; e esse v subiu exatamente como as linhas embranqueceram (0,68 → 0,73 de dia, 0,63 → 0,68 à noite: as linhas
    do C7; a trave, a rede e os jogadores não mudaram no bloco, e no PC, com MSAA nos dois lados, o v subiu igual: 0,64 → 0,69).
    A main as contava como gramado porque a linha de antes era
    esverdeada (s ≥ 0,2); a linha nova, mais branca, sai pelo próprio filtro. No
    gramado puro a mira não piorou: a pior tira de dia no 844×390 3,12 → 3,32:1, no PC 3,12 → 3,24:1, no 568×320 3,16 → 3,41:1
    (as de longe). A tira 16 do 568×320 de dia ainda passa pelo filtro (s 0,218, v 0,71: a linha) e põe a cena em 95% exatos. Vai
    ao C15: o "gramado" do L5 pela geometria (as linhas do campo projetadas) ou também pelo v; a meta do item 65 não muda.
  - **Regressões 2 e 5** (o C9b e o C11b do `teste-corpo-tela` com o MSAA da Média no PC): o teste que mudou porque a imagem mudou
    de propósito → C15 (seção 6).
  - **Regressões 3** (o CI): infraestrutura, não do bloco. Os jobs de navegador dos commits do C4–C8 caíram na instalação (o apt
    sem DNS) antes de qualquer teste; as rodadas destes commits (27928d6c, b0d9a938, 7e1a5aea) foram conferidas no fim.
  - **Medidas 7 e 8** (os cantos de baixo à noite e a cor do chão de fora nas câmeras de cá): sem meta que as meça; vão ao dono
    (seção 7).

**Medido no bloco 2** (C4–C8 com a revisão; `teste-graficos-celular`, Chromium 141 do CI, a main `e41aa791` pela referência
regravada; 70 s; 7 metas fora, todas da F, que é do C9):

| Meta | Main | Agora |
|---|---|---|
| S: Média true/4; Baixa false/0 | 0 / 0 | 4 / 0 |
| A Média dia/noite: razão ≤ 0,6 (foco / lá) | 1,00 / 1,00 · 1,00 / 1,00 | 0,51 / 0,45 · 0,46 / 0,45 |
| A Baixa, nada pior (E ÷ contraste ≤ ref × 1,10; foco / lá) | 0,590 / 0,751 | 0,598 / 0,758 (×1,015 / ×1,008) |
| A PC Alta, nada pior (razão ≤ ref × 1,10; dia foco/lá, noite foco/lá) | 0,566 / 0,514 · 0,451 / 0,525 | 0,559 / 0,518 · 0,455 / 0,525 |
| G1 L 0,58 ± 0,02, C 0,10 ± 0,01, h 124 ± 3° (sem as manchas) | 0,582 / 0,127 / 134,7° | 0,581 / 0,100 / 124,0° |
| G2 ΔL 0,056 ± 0,008; ao longe ≥ 0,6× | 0,099; ×1,03 | 0,056; ×1,00 |
| G3 18 faixas, bordas ≤ 0,10 m, o meio separa | 20; 2,59 m | 18; 0,02 m |
| G4 o termo +0,026 ± 0,008 (dia / noite / Baixa) | 0 / 0 / 0 | 0,0260 / 0,0257 / 0,0260 |
| G4 PC +0,033 ± 0,008 (o modelo do ângulo; dia / noite) | 0 / 0 | 0,0326 / 0,0324 |
| G4b com − sem ≤ 0,005 nas 16 câmeras | sem o termo | pior −0,0034 (o aéreo); as 7 baixas novas 0,0000 |
| G5 pico da linha 0,952 ± 0,01 e ≤ 0,97 (dia; noite ≤ 0,97) | 0,909; 0,902 | 0,952; 0,951 |
| G6 (informativa; régua nova) 0,010 ± 0,004 provisória | 0,0049 | 0,0100 |
| G7 GPU = JS | — | 100% |
| N Δh noite − dia = o previsto ± 0,5° | 3,32° (prev. 3,32°) | 5,20° (prev. 5,20°) |
| F Média, buracos ≤ 5% (foco / lá) | 33,3% / 55,0% | 0% / 0% |
| F Média, cintilação ≤ 1,5× (foco / lá) | ×12,6 / ×5,84 | ×3,22 (mastro) / ×1,33 — o foco fica para o C9 |
| F Baixa, buracos / cintilação (foco / lá) | 57,1% / 62,5% · ×6,49 / ×6,02 | iguais (o C9) |
| F Baixa com MSAA, cintilação (foco / lá) | ×1,69 / ×2,56 | iguais (o C9) |
| D o longe ÷ o perto do foco, E / cintilação | ×0,70 / ×0,32 | ×0,68 / ×0,29 (sem filtro) |

**O que a revisão do bloco 3 mudou** (C9–C10; três revisões em paralelo — o shader e o código, as medidas F e K, as
regressões —, 11/11; cada achado conferido antes; o medido, na seção 6, "Medido no bloco 3"):
- **Aplicadas:**
  1. **Shader 1 (GRAVE), o buraco no limiar da mistura** (`4792e0c6`): na Baixa sem MSAA, a peça que cruzava 1 px de meia
     largura entre as pontas interpolava um vértice analítico com um de fora (a razão build/física até 0,02 em 31 faixas). A
     cobertura analítica vale em todo vértice fino (o `FINOS.franja`; a chave `gols-finos-v2`). A F ganhou a pose do LIMIAR na
     Baixa (a corda do pé a 1,09 / 0,89 px nas pontas; a estrutura confere que o limiar cai dentro da peça): buracos 3,9% → 0%,
     ×4,76 → ×1,12, soma 1,34 → 1,11. Mutação (sem a largura mínima e sem a franja): 8 metas da F fora.
  2. **Shader 2, as pontas abertas à vista** (`4792e0c6`): a haste e as cordas do pé e do fundo com as pontas fechadas (+320
     triângulos; a P em 92 044, +0,57%).
  3. **Shader 3, a guarda estática** (`73f34b56`): os textos num módulo puro (`render/silhuetas-shader.js`, o `glslImpostor` e o
     `SHADER_FINOS`); o `teste-gramado` G5 (as derivadas e as leituras com mip antes do 1º desvio, nada nas funções; provada
     pelas 4 mutações da revisão), G6 (o antigo = a main pelo sha256) e G7 (o recorte dentro do `#ifdef USE_ALPHATEST` e o alfa
     em [0, 1]).
  4. **Shader 4 e regressões 1, o `?gfx=antigo` do C10** (`73f34b56`): a torcida, as bandeiras e o impostor voltam ao texto da
     main bit a bit; a P3 confere o FNV-1a dos programas.
  5. **Shader 7, o recorte** (`73f34b56`): um `aplicarTrocas` só (o que avisa), o `#ifdef` e o `clamp`.
  6. **Medidas 1 e 5** (`73f34b56`): o comentário falso das bandeiras (a A2C nelas não muda nada medido; a piora das franjas das
     bandeiras é a troca que a A2C da TORCIDA faz) e as bandeiras escrevem alfa 1.
  7. **Medidas 2, a K3 determinística** (`35f967c5`): a cena assenta antes de cada carga e a K3 desenha o quadro a de novo (0 px);
     a referência regravada só na K e na A2. Com a cena assentada, a A2C da torcida ainda ganha (K1 da torcida na bola 1,95 →
     0,33%, A2 0,75 / 0,58 → 0,69 / 0,47, K3 ×1,32 → ×1,28) e custa as franjas das bandeiras (2,22 → 2,43% e 0,26 → 0,65%) e 1 px
     da torcida com o gol no foco: fica.
  8. **Medidas 4** (`35f967c5`): a K1 do letreiro informativa e dita (acima).
  9. **Medidas 6** (`3c4bf4c3`): a F também SOBRE O GRAMADO, informativa (a guarda continua a do preto).
  10. **Regressões 2** (`4792e0c6`): o `teste-rede-tela` com o campo pelo `definirAA`, como o jogo.
  11. **Regressões 3** (`3c4b5719`): o `teste-estadio` conta a memória depois de o torcedor 3D e o impostor chegarem.
  12. **O fecho** (`bc01cece`): o canvas opaco com a A2C (a regressão do V8; seção 0) — o mesmo achado 5 das medidas, que a
      revisão só tinha tratado nas bandeiras e nos PNG dos testes: a torcida, os finos e o letreiro também escreviam o alfa.
- **Medidas só, sem mudar o código (ficam):** shader 5 (a derivada do alfa pela leitura na `vUv`: K3 igual, A2 0,0624 →
  0,0626, bandeiras 2,43 → 2,49%); shader 6 (a franja da mistura que esconde a rede: os finos depois da rede mudam o "clareia o
  gol na TV" da Baixa 17,4 → 17,6; não pesa).
- **Não aplicadas, e por quê:**
  - **Medidas 3** (a queda no gol de lá tem DUAS peças fora: a corda do fundo ×2,26 e o mastro ×1,97): é relato; a escolha
    (a mistura analítica também com MSAA, que fecha as duas — ×1,35 nessa câmera —, contra o "A2C com MSAA" do plano e o R4, ou
    rever a meta) é do C14.
  - **Medidas 7** (as metas da K1 decididas por 1 px: as placas 1 de 366 e a torcida 1 de 1737 com o gol no foco): o critério
    por contagem (binomial) mexe na régua de TODAS as linhas da K1 — com ele a torcida na bola (0,33%, 7 de 2134) também passaria
    a "não prova" contra 0,2%. Mudar a régua de uma meta que está fora é afrouxar sem prova: vai ao C14, que decide as metas.
  - **Medidas 8** (a haste quase não é medida na F: 4 pontos com o gol no foco, "poucos pontos" no gol de lá): uma pose em que a
    haste cresça na tela é uma régua nova; vai ao C14 junto com a medida 3.

**Testes Node novos (padrão, `rodar-testes.mjs`):**

- `teste-gramado`: as bordas UEFA, a paridade dos dois lados da linha do meio, a continuação atrás do gol, o GLSL gerado com as MESMAS constantes, as cores pela inversa do ACES (`tools/lib/cor-aces.mjs`) dando L/C/h/ΔL no alvo, e o `g(foco)` da profundidade.
- `teste-medidor-quadros`: p95, fase, o intervalo entre desenhos; o caso N3 (30 desenhos num rAF de 60 = 30).
- `teste-ritmo-desenho`:
  - o teto: 60, 90, 120, 144, 165 e 240 Hz com tremor de ±0,5 ms dão 60, 90, 60, 72, 82,5 e 60 desenhos, desvio dos intervalos ≤ 1 ms; a troca de refresh no meio;
  - a decisão da queda: rAF a 30 regular → cai, não grava; 25 qps com tremor em duas janelas → cai e grava; uma janela só → cai, não grava; com webdriver → nunca grava.

---

## 5. Hash, fecho e download

- **Hash:** tudo em `js/render/*`, `main.js`, `hud.js`, `css/`, `tools/`. Nenhum arquivo do fecho (40 módulos, entre eles o `config.js` e o `rede-forma.js`, que o render só lê). O `laco.js` está fora do fecho e também não se mexe nele. Conferir em cada commit: `node tools/fecho-hash.mjs --diff origin/main` = 0, `hash-igual` e `hash-partida` IGUAIS.
- **O teto não muda a partida:** o laço continua de passo fixo, e o relógio manual não passa pelo `aoQuadro`.
- **Download inicial** (`teste-carga`, 4 MB, folga mínima 120 KB, `teste-carga.mjs:25-28`):

  | Peça | Previsto | Medido (o bloco 2, com a revisão do C4–C8) |
  |---|---|---|
  | `cena.js` | +~2 KB | +6,5 KB |
  | `campo.js` | +~3 KB | +5,0 KB (+8,9 antes dos textos irem para o `gramado-shader.js`) |
  | `texturas.js` | +~1 KB | +3,7 KB |
  | `gramado.js` | ~3 KB | 19,1 KB (a maior parte, os comentários com as fontes e as medidas) |
  | `gramado-shader.js` (novo na revisão) | — | 8,5 KB |
  | `graficos-opcoes.js` | ~1 KB | 1,3 KB |
  | `ritmo-desenho.js` | ~1,5 KB | 7,9 KB no C12 (a decisão da queda e os comentários); 13,9 KB no C13 (+6,0: o teto e os comentários) |
  | `torcida.js`/`bandeiras.js`/`impostor.js` + `silhuetas-shader.js` (novo na revisão do bloco 3) | +~1 KB | o bloco 3 inteiro (C9, C10, a revisão e o fecho): +34 KB, quase tudo texto de shader e comentário |
  | `main.js`/`hud.js` | +~2,5 KB | (C9: 2 linhas; C11: +5,7 KB com o CSS — o painel, o invólucro do quadro e os comentários; C12: +10,6 KB com o `cena.js` e o CSS — main.js +7,6, hud.js +2,1; C13: main.js +1,2 KB; a revisão do bloco 4: +6 KB — a espera dos programas, a pausa travada, o `ritmo-desenho.js` e os comentários) |
  | **Total** | ~**+15 KB** (folga ~565 → ~550 KB) | **+114 KB até aqui** (o `teste-carga`: folga 561,5 → 518,4 KB no bloco 2 → 484,9 KB no fecho do bloco 3 → 479,2 KB no C11 → 461,0 KB no C12 → 454,0 KB no C13 → 447,8 KB na revisão do bloco 4; nosso 2859 → 2902 → 2936 → 2941 → 2960 → 2967 → 2973 KB) |

  O bloco 2 sozinho já passou do previsto para o item inteiro (a revisão do C4–C8, regressões 4): o resto (C9–C13) pede ~+6 KB
  pela previsão de antes, e a folga mínima é 120 KB — sobra. O código só do `?gfx=antigo` (`texGramadoAntigo`, o
  `shaderGramadoAntigo`) pode ir sob demanda se a folga apertar (precisa do `main.js` esperar o import antes do `criarCampo`).

  O `medidor-quadros.js` (18,8 KB; 21,1 KB depois da revisão do bloco 4) vai sob demanda: a lista `SO_COM_PAINEL` do `teste-carga.mjs` (nunca no inicial, sem
  pré-carga; a mutação "o medidor sempre" reprova as duas linhas dela).
- **Memória na GPU (Média):** −10 MB do gramado; +~12 MB de cor 4× e +~12 MB de profundidade 4× no 844×390 (a média na GPU do Ganesh descarta a profundidade no fim do quadro; no Safari e no Graphite é memória real). O teto de 1,2 MP limita isso a ~38 MB no pior celular com MSAA; os tablets ficam como hoje.

---

## 6. Testes existentes afetados

Medir base × PR com as mesmas sementes antes de qualquer recalibração. Recalibrar só o que mudou de propósito, com a tabela no PR.

| Teste | Por quê | Ação |
|---|---|---|
| `teste-rede-tela` (CI) | monta a própria `criarCena` com a qualidade das configs (61-70): as de celular **ganham MSAA sozinhas**; o fundo de grama muda; "mexe ≥ 1% na TV" e "clareia o gol" | medir; o L* do fio vem do shader da trama (não muda com o MSAA) |
| `teste-bola-parada-tela` §7, `teste-mira-tela` | a máscara da mira com × sem e o contraste contra o gramado; a mira depois da troca | medir dia e noite |
| `teste-corpo-tela` C9–C11 | bordas tracejadas, a nuca (estatística de borda com MSAA), as franjas dos decalques | medir; o C9b compara variantes no mesmo quadro (deve ficar) |
| `teste-estadio` | `definirQualidade` em 112 e 1131-1133 (troca e desenha no mesmo `evaluate`: o caminho imediato); torcida ≥ 12 por print; o gol roteirizado com a rede | tem de passar sem mudar o teste |
| `teste-camera-tela`, `teste-cenas-tela`, `teste-comemoracao-tela`, `teste-prejogo` (a main: 40 chamadas / 128,1 mil tri, metas ≤ 40 / 130 mil — folga 0 nas chamadas; o "35 / 122 mil" era de antes), `teste-tecnicos-tela`, `teste-replay` (G1–G6 chamadas e CPU por plano), `teste-substituicao-tela`, `teste-replay-paradas-tela`, `teste-livre-tela`, `teste-prepartida-tela`, `teste-som-jogo` | abrem na Média: MSAA no SwiftShader = mais tempo; prints | chamadas +0; tempo no `tempos-ci`; `?aa=0` só se passar de +20% |
| `teste-hud-minimo` | o painel e o orçamento do HUD | nada visível sem F3/`?qps`/`?perf` |
| `teste-pausa-tela` | o texto da Média e a troca pelas Opções (agora com a tela "Ajustando…") | medir |
| `teste-carga` | download, lista sob demanda, hash Node = Chromium, 1º quadro | +~15 KB; a lista nova |
| `teste-desempenho-celular` (informativo) | CPU com `desenhar:false` | a mesma medida vira a meta P |
| `teste-laco` (Node) | o laço | nada (o teto fica fora do `quadro`) |
| `teste-tm-tela`, `legacy-total-match/ferramentas/testar-3d.mjs` (e `--publica`) | mexeu em `main.js`/`hud.js` (regra do CLAUDE.md); o 3D no iframe sem `?q` | rodar no fim; a queda natural não pode gravar com webdriver |

**Medido no bloco 2** (C4–C8, a revisão "regressões": base `e41aa791` × HEAD `4bfd5035`, Chromium 141 do CI, cópias por
`git archive`, um teste de navegador por vez alternando a ordem; todos PASSARAM nos dois lados). A lista para o C15 (nenhuma meta
mexida agora):
- `teste-bola-parada-tela` §7 L5 — **C15, o classificador**: as tiras 16 e 17 do escanteio (o fundo com uma linha do campo)
  saíram do "gramado" no HEAD porque a linha ficou mais branca (s mínimo 0,24 → 0,20 e 0,20 → 0,17 no 844×390 de dia; v máximo
  0,68 → 0,73); o pior contraste delas 2,90 → 2,42:1 (dia) e 3,42 → 2,78:1 (noite), e o L5b ("o miolo ou o contorno") as cobre:
  100% nos dois. No gramado puro: 3,12 → 3,32:1 (844×390), 3,12 → 3,24:1 (PC), 3,16 → 3,41:1 (568×320). A tira 16 do 568×320 de
  dia ainda conta como gramado (s 0,218): 95% exatos. Ação: o "gramado" pela geometria (as linhas projetadas) ou pelo v ≤ 0,6.
- `teste-corpo-tela` C9b (informativo) — **C15**: com o MSAA da Média no PC a fronteira cabeça → corpo da máscara das partes
  ganha um pixel misturado: vermelho logo acima de verde 406 → 116 colunas, com 1 pixel no meio 9 → 296. Ação: aceitar 1–2
  pixels misturados, ou desenhar a máscara das partes sem MSAA.
- `teste-corpo-tela` C11b — **C15, anotar**: os pixels da faixa em que o shader de sempre e o implícito diferem 36 e 25 → 11 e 11
  (meta ≥ 5). Se cair mais, mais vistas ou o C11 sem MSAA.
- `teste-rede-tela`: clareia o gol na TV ΔL* 17,1 → 17,2 (celular, dia) e 15,0 → 15,4 (PC); mexe na TV 4,0 → 3,9%; o fio de perto
  L* 86,9 de dia e 89,7 à noite, iguais. Nada.
- `teste-carga`: download 3,45 → 3,49 MB; a folga 561,5 → 525,0 KB (518,4 depois da revisão, com o `gramado-shader.js`); o hash
  Node = Chromium. Nada (seção 5).
- `teste-hud-minimo`: H3 12,6% de 15 145 px → 9,4% de 17 713 px — não é do bloco (a sonda com a conta do H3: 17 846 na base,
  17 758 no HEAD, 17 769 com `?aa=0`, 17 817 com `?gfx=antigo`). Nada.
- `teste-camera-tela`: J5 28,0 chamadas e 101,2 mil triângulos nos dois; E7 29/32 e 109,8/120,8 mil nos dois; J3 9,7 → 9,6%. Nada.
- `teste-estadio`: passa sem mudar o teste (a troca Baixa → Média → Alta, a pior troca da torcida 0,0 ms); a torcida visível
  35,10 → 35,33, a do celular 10,45 → 10,43%. Nada.
- `teste-mira-tela` (saída idêntica), `teste-replay` (G4 com as mesmas chamadas: TV 26, atrás 32, 1ª pessoa 26, treinador 27),
  `teste-comemoracao-tela` (A6 37,76 → 38,09%). Nada.
- **Tempos** (uma rodada, ruído ±5%): o total 1615,8 → 1652,1 s (+2,2%); nenhum passou de +20% (o maior, o §7 da bola parada na
  Média com MSAA: +7%, +15% no `--so 7`). Sem `?aa=0` em nenhum teste; o `tempos-ci` não muda.
- **O CI do PR**: os jobs de navegador dos commits do C4–C8 caíram na instalação (`playwright install --with-deps`: o apt sem
  DNS) antes de qualquer teste — a única evidência deles é a rodada local acima. As rodadas dos commits da revisão foram
  conferidas no fim (o relato da revisão).

**Medido no bloco 3** (C9–C10 com a revisão e o fecho, 12/11; Chromium 141 do CI, SwiftShader; a main `e41aa791` pela
referência — a K e a A2 regravadas com a cena assentada no `35f967c5` —; o HEAD do fecho; `teste-graficos-celular --so F,A,N`
1 min 52 s, `teste-graficos-pagina --so K,A2,P,P3,R` 2 min 48 s). Fora: 1 meta da F (a queda), a A2 da bola e 5 linhas da K1.

| Meta | Main | Agora |
|---|---|---|
| F Média, buracos ≤ 5% (foco / lá) | 33,3% (mastro) / 55,0% (corda do pé) | 0% / 0% |
| F Média, cintilação ≤ 1,5× o SSAA e soma 0,7–1,3, a pior peça (foco / lá) | ×12,6 / ×5,84 (mastro); soma 0,96 / 0,91 | ×1,42 (mastro) / ×1,31 (corda do fundo); soma 1,13 / 0,84 |
| F Baixa, buracos (foco / lá) | 57,1% / 62,5% | 0% / 0% |
| F Baixa, cintilação e soma (foco / lá) | ×6,49 / ×6,02; 0,90 / 1,03 | ×1,17 / ×1,38 (corda do fundo); 1,07 / 1,24 |
| F Baixa, a pose do LIMIAR (nova; 1,09 / 0,89 px nas pontas): buracos / cintilação / soma | — (a pose é da revisão; no C10: 3,9% / ×4,76 / 1,34) | 0% / ×1,12 / 1,11 |
| F Baixa com MSAA (a queda), cintilação e soma (foco / lá) | ×1,69 / ×2,56; 0,88 / 0,74 | ×1,16 / **×2,26 (corda do fundo; o mastro ×1,97)**; 1,19 / 0,70 — **fora no gol de lá** (o C14) |
| F Média sobre o gramado (informativa; foco / lá) | — | ×2,91 (a haste, 4 pontos) / ×1,37; a soma da corda do pé 1,14 / **1,36** |
| A Média, razão ≤ 0,6 (dia foco / lá; noite foco / lá) | 1,00 / 1,00 · 1,00 / 1,00 | 0,53 / 0,50 · 0,46 / 0,46 |
| A Baixa, nada pior (E ÷ contraste; foco / lá) | 0,590 / 0,751 | 0,598 / 0,712 (×1,015 / ×0,947) |
| A PC Alta, nada pior (a razão; teto × 1,10; dia foco / lá, noite foco / lá) | 0,566 / 0,514 · 0,451 / 0,525 | 0,576 / 0,524 · 0,486 / 0,535 (×1,017 / ×1,019 · **×1,076** / ×1,017) |
| A2 razão ≤ 0,6 (TV na bola / gol no foco) | 1,00 / 1,00 (forçado ×0,70 / ×0,47) | **0,69** / 0,47 (E 0,0624 / 0,0534) |
| K1 torcida, centro fora ≤ 0,2% e ≤ a main forçada (bola / gol no foco) | 2,36% (19 de 804) / 0% (0 de 632) | **0,33%** (7 de 2134) / **0,06%** (1 de 1737) |
| K1 bandeiras (bola / gol no foco) | 13,40% (173 de 1291) / 4,17% (15 de 360) | **2,43%** (35 de 1439) / **0,65%** (3 de 463) |
| K1 placas (bola / gol no foco) | 0 px de borda / 0% de 366 | 0 px / **0,27%** (1 de 366; já no C9) |
| K1 letreiro (informativa: o do Estádio Golaço é transparente) | 0 px de borda | 0 px |
| K2 bandeiras de mastro ≥ 0,8 do SSAA (50 m / 100 m) | 0,966 / 0,935 sem AA (forçado 1,006 / 1,004) | 1,006 / 1,011 |
| K3 torcida (informativa): cobertura e cintilação ÷ SSAA | 0,926; 6,05% (×1,32) | 0,934; 5,87% (×1,28); a oposta 0,925 e ×1,33 |
| K3 a cena parada (estrutura nova) | — | 0 px no 1× e no SSAA, nas duas cargas |
| P chamadas = ref; triângulos ≤ ref + 1% | 31; 91 524 | 31; 92 044 (+0,57%: os finos de 16 lados +200, as pontas fechadas +320) |
| P3 `?gfx=antigo`: o texto da torcida e das bandeiras = a main (FNV-1a) | 3046274822 / 2295424622 | iguais (o build: 3205256957 / 3759878488) |
| R4 os ganchos depois do contexto restaurado (A2C dos finos e da torcida) | o restaurado sem os ganchos | passa |
| O canvas opaco (`teste-estadio` 10b, nova): px com alfa < 255 em 20 instantes da TV do celular Média | 0 (sem A2C) | 0 (no C10: ~15 mil por quadro; com o `alfaDoCanvas` desligado, 470 443 nos 20, mínimo 144) |

**A lista do C15 (o bloco 3)** — base `e41aa791` × o HEAD do fecho, um teste de navegador por vez (o HEAD do C10 pela revisão
"regressões", `a2561f8f`, quando dito). Nenhuma meta mexida agora:
- `teste-tecnicos-tela` V8 — **a regressão do C10, corrigida no CÓDIGO** (`bc01cece`, o canvas opaco; seção 0): o 211 de costas
  0 (base) → 207–228 px (C10, o CI do `4792e0c6` e do `3c4b5719`) → 0 px; de frente 255 / 216 (= o C9). A mediana do V1 193 (C9)
  → 209 (C10: as bordas clareadas pela cópia translúcida) → 189–193 (de uma rodada para outra). O teste inteiro PASSOU (V1–V8,
  3 min 17 s) e o navegador 3 de 3 do CI do `bc01cece` também. A correção reprova por mutação (o `alfaDoCanvas` desligado: o 211
  de costas 165 px). Nada a recalibrar.
- `teste-estadio` — o 10b novo (o canvas opaco, acima) e o item 1 esperando o 3D (`3c4b5719`). A torcida visível de dia 34,94 /
  35,03 (base) → 34,70 / 34,58 (C10: o mesmo artefato do alfa) → 35,77; à noite 25,17 → 25,33; no celular 10,45 → 10,43%; a
  memória da troca de qualidade 30 → 30 e 17 → 17. 66 de 66 (4 min 56 s). Nada.
- `teste-rede-tela` — **mudou o teste de propósito** (`4792e0c6`: o campo pelo `definirAA`, como o jogo; a A2C nos finos da
  Média): "clareia o gol na TV" do celular de dia ΔL* 17,4 em 25,9% (a mistura, como o teste montava) → 17,1 em 26,7% (base 17,1);
  no PC 15,4 → 15,3; "mexe na TV" 3,2–3,9% → 3,1–3,9%. Feito.
- `teste-graficos-pagina` — **a régua da K3 mudou** (a cena assentada e o quadro a de novo): a referência regravada só na K e na
  A2 (19 valores; a K3 da main 0,986 / 2,13% → 0,926 / 6,05%) e a P3 com o FNV-1a (2 chaves novas). Feito.
- `teste-graficos-celular` — a F ganhou a pose do limiar (estrutura e metas) e a linha sobre o gramado (informativa); as chaves
  novas sem referência. Feito.
- `teste-gramado` G5–G7 e `teste-torcida` (os regex nos módulos novos) — feito; os dois PASSARAM.
- `teste-prejogo` — os triângulos do pior plano +0,5–0,6 mil (os finos de 16 lados e as pontas fechadas): Estádio Golaço 128,1 →
  128,7 mil (≤ 130 mil: sobra 1,3 mil), Suppici 92,1 → 92,6, BUKO 88,2 → 88,8, Maracanã 125,3 → 125,8, Aflitos 104,3 → 104,8;
  as chamadas iguais (40 / 38 / 38 / 38). PASSOU (9 min 18 s). Nada; **o pré-jogo não tem folga de chamada (40 de 40, já na
  main)**: o C11 em diante não pode pôr nada desenhado no pré-jogo do celular.
- `teste-corpo-tela` — PASSOU; o C9b (a emenda, informativo) 424 (base) → 116 (C10) → 93 colunas (o MSAA do bloco 2, já na lista);
  o C11a de costas 10 → 21 → 3 px (meta ≤ ~92); o C11b frente / lado 11 / 22 → 11 / 24 → 44 / 7 (≥ 5). Os números andam entre
  rodadas (a cena não é a mesma a cada abertura). Nada.
- `teste-camera-tela`, `teste-replay` — as chamadas iguais (J5 28,0; E7 29 / 32; G4 TV 26, atrás 31–32); os triângulos +200 no C10
  pela revisão (as pontas fechadas, +320, não medidas aqui: a P da página mede +520 no quadro da TV). Nada.
- `teste-desempenho-celular` (informativo) — **não é do bloco**: o "Sem vazamento" dá geometrias 33 → 37 e texturas 15 → 16 na
  main e no HEAD (os mesmos números, também no CI). Sondado (uma cópia com o renderizador à mão): a memória cresce na 1ª vez que
  uma peça aparece — o torcedor 3D e o impostor chegando, uma geometria nova no passo 541, antes de qualquer substituição — e fica
  parada depois (600 passos a mais: 39 → 39). Com a espera do 3D do `teste-estadio` ainda sobram +3 geometrias nos dois lados: o
  teste pede uma régua nova (duas rodadas iguais, comparar a 2ª) → C15, fora do bloco. A CPU, ruído do SwiftShader nos dois lados:
  o jogo p95 6,10 / 6,20 ms e 6,20 / 6,00 (base / HEAD, duas rodadas; meta 6, informativa: "Depende do dono" 30); a comemoração
  p95 7,20 / 5,40 e 8,20 / 7,00 (meta: o jogo + 1).
- `teste-carga` — o nosso 2902 → 2936 KB, a folga 518,4 → 484,9 KB (seção 5); o hash Node = Chromium. Nada.
- **O CI do PR:** o do C9 (`52896f71`) passou inteiro; o do C10 não rodou (a pane do GitHub); os do `4792e0c6` e do `3c4b5719`
  reprovaram só no V8 (o navegador 3 de 3) e no `teste-desempenho-celular` informativo; o do `bc01cece` passou o navegador 3 de 3.

**Medido no C11** (o painel `?perf` / `?qps`, 12/11; Chromium 141 do CI, SwiftShader; antes = o HEAD do fecho do bloco 3,
`7fe3a1ab`, numa worktree; depois = `56bf6fd2`):

| Meta | Antes | Depois |
|---|---|---|
| P2 `__golaco.perf()` com p95, fase, AA, buffer, GPU, refresh | não existe | o objeto (qps, ms, cpu, gpu, fases, chamadas, triângulos, qualidade, aa, buffer, refresh, queda) |
| P2 o painel com p95, fase, AA, buffer, GPU e refresh | "60 qps · 16.7 ms 25 chamadas · 92 mil tri qualidade media" | "30 qps · p50 33,3 · p95 33,3 · pior 1% 34,3 ms / CPU p95 … / 25 chamadas · 92 mil tri · fase tela antes do jogo / …" |
| P2 por cima da tela antes do jogo / da pausa | escondido (no `#hud`) / escondido | 100% / 100% (`.perf-fixo`) |
| P2 no jogo, na pausa e no replay | jogo 100%; pausa e replay escondido | 100% nos três |
| P2 o qps da tela antes do jogo = os desenhos (N3) | mostra 60,0, desenhou 30,4 (× 1,97) | mostra 30,0, desenhou 30,0–30,4 (× 0,99–1,00) |
| P2 a fase no jogo | não existe | "jogo" |
| P chamadas / triângulos | 31 / 92 044 | 31 / 92 044 (o painel não desenha nada) |
| P a CPU pareada com a main (`--base` a worktree `e41aa791`) | — | +0,00 ms (medida 5,80, base 5,40 ms) |
| R (com o painel na mesma carga) | o R1 "Ajustando…" fora | igual (o R1 "Ajustando…" é do C12; o resto passa) |
| `teste-carga` nosso / folga | 2936 KB / 484,9 KB | 2941 KB / 479,2 KB; o medidor nunca pedido sem o painel |
| `teste-hud-minimo` H1 (o orçamento do HUD) | — | a linha do H1 idêntica antes × depois (pior 8,81 / 10,81 / 11,65 / 10,77%); o painel não aparece |

- **Provado por mutação:** sem o `z-index` do `.perf-fixo`, a P2 reprova "por cima da tela antes do jogo" (0%, tapa o
  `.pp-veu`) e "da pausa"; contando todo quadro do rAF (o jeito de antes), a N3 reprova (× 2,00); sem o `:not(.perf-fixo)` no
  replay, "no replay" reprova (escondido); o medidor carregado sem o painel reprova as duas linhas do `teste-carga`; no
  `teste-medidor-quadros`, sem o filtro do lixo da GPU o M6 reprova e com o intervalo pelo rAF o M1 reprova (p50 16,7 ms).
- **O cronômetro da GPU no SwiftShader:** a extensão existe e responde ~300 ms por quadro, às vezes 2^63 ns (lixo: descartado e
  contado em `invalidos`; o painel diz "o cronômetro devolve lixo" quando só há lixo).
- **Flutuações vistas (não são do C11):** o `teste-prepartida-tela` E7* ("depois do Pular: pré-jogo true", a máquina com quadros
  de segundos: 0 desenho/s atrás da tela no E15) reprovou na base 1 em 13 rodadas e no HEAD 6 em 15 (as 3 primeiras rodadas
  seguidas do HEAD reprovaram 2; nas 6 alternadas do fim, 1 a 1); sem o painel o quadro é o mesmo de antes (o invólucro só chama o
  `quadroCorpo`), e o navegador 2 de 3 do CI (com ele) passou. O `teste-substituicao-tela` T9 (programas 36 → 37) reprovou no
  navegador 1 de 3 do CI do `3d5202df` e passou no do `56bf6fd2` e aqui (37 → 37); o `teste-online-tela` P8g (o aviso "ainda está
  vendo a cena" com B em pé) reprovou no navegador 3 de 3 do `3d5202df` e passou no do `56bf6fd2` (o código das páginas sem o
  painel é o mesmo nos dois commits).
- **Para o C12 (a troca, a queda gravada e o contexto):**
  - o painel lê `info.queda = {sessao, gravada}` (cada uma `{de, para}` ou null) no `main.js infoPainel()`; o texto já mostra
    "Média → Baixa" com os dois preenchidos (`medidor-quadros.js textoPainel`, coberto pelo M8);
  - a decisão da queda pede o ritmo dos DESENHOS: o medidor tem os intervalos entre desenhos (`MED.resumo().ms`, o anel), mas só
    existe com o painel; a decisão da queda vale sem ele, então mora no `render/ritmo-desenho.js` (o plano) com a mesma conta
    (mediana e p90 − p10 dos intervalos), alimentada pelo `quadro()`;
  - a recriação troca o contexto: o cronômetro da GPU descarta as consultas do velho sozinho (`criarCronometroGpu`, M6) e o nome
    da GPU é relido quando o `gl` muda (`medGl`); o `aa`/`buffer` do painel vêm do `cena3d` a cada 0,5 s.
- **Para o C13 (o teto):**
  - o painel lê `info.teto` (o *n*: desenha 1 a cada *n* quadros da tela; null = "—") e `info.refreshHz` (o refresh do ritmo,
    que passa por cima do medido no medidor) no `main.js infoPainel()`;
  - o refresh do medidor é a mediana dos últimos 30 intervalos do rAF, todos (`MED.raf(t)` no `aoQuadro`, ANTES do `quadro()`);
    com o teto no `aoQuadro`, o `MED.raf` tem de continuar vendo todo quadro do navegador e o `quadro()` só os desenhados — os
    intervalos do painel já são entre DESENHOS (o instante do rAF de cada desenho), então o teto aparece no qps sem mudar nada;
  - o `teste-graficos-pagina` T conta os desenhos pelo `renderer.render` (o `soContar`); o painel conta pelo `cena3d.desenhar`
    envolto (`nDesenhos`): os dois veem os mesmos desenhos.

**Medido no C12** (a troca de qualidade, a queda gravada e o contexto restaurado, 12/11; Chromium 141 do CI, SwiftShader; antes =
o HEAD do C11, `37d8ac32`, numa worktree; depois = o C12; os testes do HEAD nos dois lados):

| Meta | Antes | Depois |
|---|---|---|
| Z mesmo tamanho / tamanho novo (atribuições a `canvas.width/height`) | 0 / 2 (já desde o C5) | 0 / 2 |
| R1 pelo ≡ → Opções: Média → Baixa → Média (`SAMPLES`), o `aria-label` e o `inert` | 4 → 0 → 4; "Campo 3D", inert true | iguais |
| R1 a tela "Ajustando…" à vista e fora | vista 0× e 0× | vista 45× e 3× (outra rodada 81× e 4×); fora no fim |
| R1 a tela já opaca em toda amostra à vista (nova) | — | a menor opacidade 1,000 |
| R1 a mira (o módulo baixado antes) com programa no renderizador NOVO, sem ser desenhada (nova) | (sem programa: reprova) | com programa nas duas trocas |
| R1 as trocas terminam (SwiftShader) | 0,4 / 0,6 s | 3,2–3,8 s (compila a cena inteira, também os escondidos, antes do 1º desenho) |
| R2 Alta → Baixa no pré-jogo: o recorte do vão e o `aria-label` | passa (desde o C5) | passa |
| R3 a troca imediata desenha no mesmo `evaluate`; `SAMPLES` 4 → 0 → 4 | 94,5% / 95,6% não preto | 94,5% / 94,4–95,6% |
| R4 perde e restaura: o quadro, os ganchos estragados antes, a mira desenha | passa | passa |
| R4 a mira com programa no contexto restaurado antes de ser desenhada (nova; a linha escondida) | (sem programa: reprova) | com programa |
| Q a queda natural com webdriver (rAF falso a 20 Hz com tremor): cai, NÃO grava, a recarga abre na Média | passa | passa (cai no quadro virtual 101, 5,0 s) |
| Q `__golaco.quedaDeTeste()`: o mesmo canvas, Baixa, `SAMPLES` continua 4, gravada e dita na pausa | não existe | mesmo canvas, 4 → 4, `{media, baixa, v: 1}`, "Agora: Baixa (o aparelho não segurou a Média; escolha Média para tentar de novo)" |
| Q a recarga depois da queda gravada abre na Baixa (`SAMPLES` 0) | media, 4 | baixa, 0 |
| Q escolher a Média apaga a queda | nada a apagar | apagada |
| `teste-pausa-tela` P14 (novo): a linha da queda à vista, uma linha inteira no celular, sem rolar | não existe a queda: reprova | passa de 844×390 a 568×320 (11 px no 568) e no PC (1280×720 e as janelas baixas); 318 → 327 medidas no P2, nenhuma rola |
| `teste-ritmo-desenho` (Node, novo) | — | passa (R1–R10) |
| `teste-carga` nosso / folga | 2941 KB / 479,2 KB | 2960 KB / 461,0 KB |

- **Provado por mutação:** sem o `aquecerMira()` no gancho, o R4 da mira reprova (sem programa); sem o `compilarAntesDoDesenho()`
  da troca pela pausa e sem o gancho, o R1 da mira também; o `podeGravar` sem o `navigator.webdriver`, a queda natural da Q grava
  (e a recarga abre na Baixa); sem o `display` da `.opcao-info.queda` o P14 reprova (escondida no celular) e sem os 11 px também
  (cortada em 568×320); no `teste-ritmo-desenho`, sem o ritmo preso, sem o `podeGravar`, com uma janela só, a pausa que não
  desfaz o "seguidas" e sem a espera de 3 s: cada uma reprova.
- **Não provado por mutação (dito):** o `transition: none` do `hud.ocupado`. Escondida (display none), a tela de carregar não faz
  a transição de 0,35 s de qualquer jeito — a mutação dele passa no R1 (a menor opacidade 1,000) —; ele cobre só a tela ainda
  saindo nos 400 ms depois do pronto, um caso que a pessoa não alcança pela pausa.
- **Correção do N8** (seção 1.2): o `compile()` do r170 percorre TODOS os objetos da cena (as luzes pelo `traverseVisible`, os
  materiais pelo `scene.traverse`). O que está na cena na hora da troca, escondido ou não, compila junto; por isso a troca pela
  pausa leva mais (o tempo da tela "Ajustando…") e nada engasga quando aparece depois.
- **O que mudou de propósito além do plano:**
  - a troca pela pausa sem nada a mudar (o mesmo nível e o mesmo contexto: `cena3d.precisaRecriar`) só marca a escolha, sem a
    tela e sem reaplicar (antes reaplicava e marcava todos os materiais para recompilar);
  - a troca imediata compila a cena (`renderer.compile`, síncrono) só quando recriou (a API dos testes: o `teste-estadio` 280 →
    278 s);
  - escolher a "Automática" também conta como "à mão": apaga a queda (e tenta de novo o nível do aparelho);
  - a linha da pausa no celular: a `.opcao-info` some no celular desde o item 58 (a pausa cabe sem rolar); com a queda ela
    aparece (`.queda`), numa linha (`nowrap` com o "…" de segurança) e com 11 px até 600 px de largura — 474 px a 12 px não
    cabiam nos 444 px de 568×320 (as Opções rolavam 12 px), 434 a 11 (S5: ≥ 11);
  - a gravada que não baixou o nível desta carga (a `{alta, media}` num celular, que já abre na Média) não vai à linha;
  - a Média com o antisserrilhado (N5) só quando o contexto o tem: "Média — antisserrilhado e sombras simples, boa para celular";
    o tablet com o teto e o `?aa=0` ficam com o texto de antes.
- **Os testes de navegador da seção 6 que tocam o que mudou** (base × HEAD, um por vez, a ordem sorteada; todos com os scripts
  do HEAD): `teste-carga`, `teste-hud-minimo` (as linhas iguais, menos ruído de 1 px de torcida e a barra de força à vista num
  instante do H5 — a mesma área, 1,9%), `teste-estadio` (66 de 66 nos dois, 280 → 278 s; a memória da troca de qualidade sem
  vazamento nos dois: 30 → 30 geometrias na base, 29 → 29 no HEAD), `teste-bola-parada-tela` (55 de 55 nos dois; ± 1 px na mira),
  `teste-mira-tela` (19 de 19, as mesmas linhas; o tempo 180 → 40 s não é do C12: com `--raiz` noutra pasta o teste DESENHA cada
  posição — `DESENHAR` —, e a base ia por ela), `teste-pausa-tela` (a base reprova só no P14 novo), `teste-prepartida-tela` (115
  de 115 nos dois; 765 → 753 s; o E7* não apareceu), `teste-tm-tela` (passa nos dois) e o TM de ponta a ponta (`testar-3d` pro em 105 s e `--publica` em 124 s, nenhum erro
  de página; o `testar-3d` grava `{qualidade: "baixa"}` antes — a queda nem mede lá; com webdriver ela não gravaria de qualquer
  jeito). O painel `?perf` com a `quedaDeTeste()`: "queda: sessão Média → Baixa · gravada Média → Baixa" e "AA MSAA 4× (SAMPLES 4)"
  na Baixa da queda (o contexto fica).
- **Para o C13 (o teto):**
  - o `render/ritmo-desenho.js` já existe (o C12): `criarQueda`, `QUEDA`, `NIVEIS`, `resumoJanela`, `percentilOrdenado`,
    `quedaValida`, `nivelInicial`; o teto entra no MESMO módulo (o cabeçalho já diz) e o `teste-ritmo-desenho` ganha os casos do
    teto (o R10 cobre a pureza do módulo inteiro: sem `performance`, `Date.now`, `navigator` nem `requestAnimationFrame` — o
    instante vem do `aoQuadro`);
  - o `aoQuadro` hoje: `if (MED) MED.raf(t); if (!relogioManual) quadro(t, !trocandoQ);` — o teto pula o `quadro()` nos quadros
    fora do ritmo ENTRE os dois (o `MED.raf` continua vendo todo quadro do navegador). O `trocandoQ` (a troca pela pausa) só
    tira o desenho, a lógica e o online seguem: com o teto, ele continua valendo só nos quadros do ritmo;
  - a queda já mede os DESENHOS: o `adaptarQualidade(dtReal, …)` roda no fim do `quadroCorpo` do jogo, e o `dtReal` é o
    intervalo desde o último `quadro()` — com o teto, o intervalo entre desenhos, sem mudar nada nela. Um ritmo do teto
    (60 regulares num rAF de 120) não é "preso" (só 33,3 e 50 ms contam);
  - o `proximoQuadro()` da troca pela pausa usa o rAF cru (não passa pelo teto);
  - o painel: `info.teto` e `info.refreshHz` no `infoPainel()` (a queda já vai: `info.queda = {sessao, gravada}`).

**Medido no C13** (o teto de quadros, 12/11; Chromium 141 do CI, SwiftShader; antes = o HEAD do C12, `1a81f585`, numa worktree;
depois = o C13; os testes do HEAD nos dois lados, um de navegador por vez):

| Meta | Antes | Depois |
|---|---|---|
| T celular a 90 Hz (rAF falso, regular) | 90,0 | 90,0 |
| T celular a 120 / 144 / 165 Hz = 60 / 72 / 82,5 ± 1, regulares | 120,0 / 144,0 / 165,0 (3 fora) | 60,0 / 72,0 / 82,5, desvio 0,00 ms |
| T PC sem toque a 144 Hz: sem teto | 144,0 | 144,0 |
| T o painel (`perf().refresh`): a tela ± 1 Hz e o *n* (90 → 1, 120/144/165 → 2; PC null) (nova) | o *n* null em todos | 90/1, 120/2, 144/2, 165/2; PC 144/null |
| T a tela antes do jogo a 144 / 165 Hz no ritmo dela, 28,8 / 33 ± 1 (nova) | 28,7 / 32,9 (sem teto) | 28,7 / 32,9 |
| Q a queda natural a 20 Hz com tremor: cai, não grava; `quedaDeTeste`; as recargas; escolher apaga | passa (cai no quadro virtual 82, 4,1 s) | passa (84–89, 4,2–4,4 s) |
| Q a 120 Hz por 8,6 s de volta na Automática: NÃO cai (nova; no fim da Q) | — | media → media, 60,0 desenhos/s (*n* 2) |
| `teste-ritmo-desenho` T1–T7 (Node, novos) | — | passa (abaixo) |
| `teste-carga`: nosso / folga; os passos a 60/120/144 Hz pelo relógio manual | 2960 KB / 461,0 KB; 60/60/60 | 2967 KB / 454,0 KB; 60/60/60 (a interpolação e a câmera a 144 Hz iguais) |
| `hash-igual` / `hash-partida` (contra a main) / fecho | IGUAIS / 0 | IGUAIS / 0 |
| `teste-laco` / `teste-resposta` (Node: não passam pelo `aoQuadro`) | passam | passam (o pior 0,050 s, meta ≤ 0,1) |

- **O `teste-ritmo-desenho` do teto** (os carimbos na grade da tela com tremor de ±0,5 ms, 8 sementes por caso):
  - 60/90/120/144/165/240 Hz: 60,0–60,1 / 89,9–90,0 / 60,0 / 72,0 / 82,4–82,6 / 60,0 desenhos por segundo, os intervalos a ≤ 0,99
    ms de *n* períodos, o *n* certo;
  - a conta do refresh em 200 janelas de 30 intervalos: 59,9–60,1 / 89,7–90,3 / 119,5–120,5 / 143,3–144,7 / 164,1–165,9 /
    237,4–242,8 Hz (só a mediana dava 231,4–248,1 a 240 Hz, o *n* em 3 em 4% das contas);
  - as trocas de refresh: 120 → 60 desenha todo quadro na hora (o maior intervalo 17,65 ms); 120 → 90 e 240 → 144 acertam o *n* em
    ≤ 56 e ≤ 35 ms pela descida rápida; 144 → 165 vira 82,5 na hora; 60 → 120 nunca abaixo de 60 (17,61 ms) e o teto em ≤ 2017 ms;
  - a página que perde o vsync num desenho em 3 (10 ms num quadro de 8,33): pelo TEMPO 59,9/s e o maior intervalo 17,65 ms; pelo
    contador "1 a cada *n* quadros" seriam 51,4/s e 25,95 ms (sem teto, 89,9/s);
  - n = 1 = o laço de antes (60 e 90 Hz com perdidos e a aba escondida, desligado a 240 Hz, `forcar`): todo quadro desenha;
  - a queda do C12 com o teto: 30 s na Média a 120 e a 240 Hz (60/s) e na Alta a 144 e a 165 Hz (72 e 82,5/s): nenhuma queda.
- **Provado por mutação:** no `teste-ritmo-desenho`, o contador no lugar do tempo (T4 120 → 60 e T5), sem a descida rápida (T4
  120 → 90), só a mediana (T1 e T3), folga 0 (T1, T2, T4), ligado sempre (T3, T6), `forcar` ignorado (T6), sem o atalho do *n* = 1
  (T4, T6) e a conta a cada 20 s (T1, T4) — cada uma reprova. Na página: o teto ligado também no PC (a T do PC: 72 desenhos), a tela
  antes do jogo passando pelo teto (23,6 e 27,9 por segundo, a previsão era 24 e 27,5) e um teto que desenharia 24 a 120 Hz (a Q
  nova: cai no quadro virtual 659) — cada uma reprova.
- **O que mudou de propósito além do plano:**
  - o período da tela é a MÉDIA dos intervalos a ± 25% da mediana (a mediana sozinha virava o *n* de 240 Hz em 3: acima);
  - o quadro do ritmo é pelo TEMPO: desenha quando já passaram (*n* − 0,5) períodos desde o último desenho — com o rAF regular, 1
    a cada *n* quadros; um vsync perdido não faz esperar um quadro a mais (o T5) e a tela que cai para 60 Hz desenha todo quadro;
  - a descida rápida: com *n* > 1, a média na faixa dos últimos 8 intervalos acima de 1,2 × o período baixa o *n* já (a regra "a
    cada 2 s" sozinha deixava 45 desenhos por ~2 s numa troca de 120 para 90 Hz; D6: "nunca abaixo de 60"); subir o *n* só na
    conta de 2 s;
  - a tela antes do jogo passa por cima do teto (`forcar` com `pp.aberta`): ela já desenha 30 pelo relógio; pelo teto cairia a 24
    a 144 Hz e a 27,5 a 165 ("a tela antes do jogo a 30 qps segue igual");
  - `__golaco.teto` (testes) e o refresh do teto no painel (`info.refreshHz`, por cima do medido pelo medidor; NaN antes da 1ª
    conta), o *n* em `info.teto` (null no PC: "—").
- **Uma armadilha da Q** (dita no teste): a linha nova da 120 Hz no MEIO da Q fazia a página, de volta ao render de verdade do
  SwiftShader (3–6 quadros por segundo), cair sozinha 5,5 s depois da recarga — o `quedaDeTeste` achava a Baixa e devolvia null. Ela
  fica no fim, depois de voltar à Automática.
- **Os testes de navegador da seção 6 que tocam o que mudou** (o `aoQuadro` do `main.js`; base × HEAD, um por vez, os scripts do
  HEAD): `teste-carga` (acima), `teste-online-tela` (21 de 21 nos dois; 438 → 450 s) e `teste-prepartida-tela` (115 de 115 nos
  dois, as mesmas linhas; 766 → 791 s). No headless o rAF anda a 60 Hz: o teto fica em *n* = 1 (o laço de antes, bit a bit) em todo
  teste de navegador que não liga o rAF falso — só a T e a Q o exercitam. O CI do `8ed33e48` passou inteiro (os testes e o painel
  de equilíbrio); o do `ec4349ad`, os 3 navegadores e 3 dos 4 Node no fim desta medida.
- **Para o C14 (as metas valendo):**
  - a T e a Q passam a valer como estão: a T é absoluta (90 / 60 / 72 / 82,5 ± 1, o painel, a tela antes do jogo 28,8 / 33 ± 1),
    não "nada pior" — as `T.cel*` da referência são as da main (120 / 144 / 165) e não servem de régua; as `T.tela144/165` só
    entram na referência se ela for regravada (na main seriam as mesmas 28,7 / 32,9);
  - a Q nova (120 Hz, a queda não cai) fica no FIM da Q (a armadilha acima);
  - o `teste-ritmo-desenho` já está no CI (padrão, 0,35 s);
  - fora do teto (rAF próprio, como antes): a tela cedo (`quadroTelaCedo`), o "Simular o resto" (`fatia`) e a troca de qualidade
    pela pausa (`proximoQuadro`); com o relógio manual (`api.relogio.avancar`) o teto não entra — ele só observa os quadros do
    navegador.


**Medido no bloco 4** (a revisão do C11–C13 e as correções, 12/11; Chromium 141 do CI, SwiftShader; a main `e41aa791` pela worktree
de leitura; o C13 = `95c85b23`, pelos números da revisão; agora = `5ff4db63`; os scripts do HEAD nos dois lados,
`teste-graficos-pagina --so P2,R,Q,Z,T`: o HEAD 177 s, a main 227 s — os 90 s do R5 que não chega ao pronto). Nada fora no HEAD.

| Meta | Main | C13 | Agora |
|---|---|---|---|
| P2 `__golaco.perf()`; o painel com p95, fase, AA, buffer, GPU e o rAF | não existe; "60 qps · 16.7 ms…" | passa | passa ("30 qps · p50 33,3 · p95 33,3 · pior 1% 34,3 ms…") |
| P2 por cima da tela antes do jogo / da pausa / no jogo, na pausa e no replay | escondido / escondido / jogo 100%, pausa e replay escondido | 100% em todos | 100% em todos |
| P2 o qps da tela antes do jogo = os desenhos (N3) | mostra 60,0, desenhou 30,2 (× 1,99) | 30,0 / 30,4 (× 0,99) | 30,0 / 30,4 (× 0,99) |
| P2 o painel não pega toque no jogo (844 / 667 / 568; nova) | 0 tomados, 0 sob a caixa (o guarda não prova: reprova) | (sem a guarda; a revisão: ENFIADA e LANÇAMENTO 0 toques em 568×320) | 0 de 30 nas três (8 / 9 / 30 pontos sob a caixa) |
| P2 o painel não pega toque nas Opções da pausa (844 / 568; nova) | 0 de 100 (23 / 28 sob a caixa; o `#hud`) | (a revisão: o toque na "Baixa" não trocava) | 0 de 100 (47 / 86 sob a caixa) |
| R1 Média → Baixa → Média pelo ≡ (`SAMPLES`), `aria-label`, `inert` | 0 → 0 → 0, mesmo canvas | 4 → 0 → 4 | 4 → 0 → 4, "Campo 3D", inert true |
| R1 a tela "Ajustando…" à vista e fora; opaca | 0× e 0× | 43× e 3×; 1,000 | 1× e 4× (outra rodada 8× e 4×); 1,000 |
| R1 a mensagem por cima de tudo e o painel debaixo dela (nova) | 0 amostras | (a revisão: o painel cobria a mensagem) | 5 de 5 pontos livres; o painel 0 de 3 à vista |
| R1 durante a troca a pausa `inert` e o foco na tela; no fim de volta (nova) | 0 amostras | (a revisão: `inert` false, o foco no `btn-opcoes`) | 0 amostras fora; no fim `inert` false e o foco no botão |
| R1 as trocas terminam | 1,4 / 0,6 s | 4,4 / 4,0 s | 4,0 / 5,0 s |
| R1 / R4 a mira com programa no renderizador novo / no contexto restaurado | (sem programa) | com programa | com programa (o `compile()`, sem o `compileAsync`) |
| R2 Alta → Baixa no pré-jogo: o vão e o `aria-label` | false; null | passa | passa |
| R3 a troca imediata desenha; `SAMPLES` 4 → 0 → 4 | 0 → 0 → 0 | passa | 94,5% / 95,6% não preto; 4 → 0 → 4 |
| R4 perde, restaura e desenha; a A2C dos finos e da torcida | o restaurado sem os ganchos | passa | 95,2% não preto; A2C true (SAMPLES 4) |
| R4 o `uAlturaBuffer` (agora estrutura) | não existe | 585 (passava também sem os ganchos) | 585 |
| R5 o KHR falso: a carga com a tela cedo chega ao pronto (nova) | NÃO em 90 s | (não medido: o SwiftShader não tem a extensão; a prova em Node da revisão: nunca resolve) | 5,2–6,0 s |
| R5 as duas trocas pela pausa terminam; Esc, Esc e P travados (nova) | — | — | 6,2–6,4 s; a pausa aberta e `inert` em 40 e 26 amostras, o tick parado (8 → 8) |
| Q a queda natural com webdriver: cai, NÃO grava, a recarga abre na Média | cai no quadro 100 | cai no 98 | cai no 97 (4,8 s); `{}`; media, `SAMPLES` 4 |
| Q `quedaDeTeste()`, a recarga na Baixa, escolher apaga; 120 Hz não cai | não existe; media | passa | passa (o mesmo canvas, 4 → 4; baixa, 0; apagada; media → media a 60,0/s) |
| Z o mesmo tamanho / um tamanho novo | 8 / 8 | 0 / 2 | 0 / 2 |
| T celular 90 / 120 / 144 / 165 Hz; PC 144 | 90 / 120 / 144 / 165; 144 | 90 / 60 / 72 / 82,5; 144 | 90,0 / 60,0 / 72,0 / 82,5, desvio 0,00 ms; 144,0 |
| T o painel: o `hz` do ritmo e o `rafHz` do medidor ± 1 Hz e o *n* (o `rafHz` é novo) | `perf()` não existe | hz certo (o rafHz não existia) | hz e rafHz 90/120/144/165, *n* 1/2/2/2; PC 144/144, null |
| T a tela antes do jogo a 144 / 165 Hz | 28,7 / 32,9 | 28,7 / 32,9 | 28,6 / 32,8 |

- **O que mudou, aplicado** (cada um com a guarda que reprova sem ele; as mutações em cópias do HEAD, a página com `--raiz`):
  - **A espera dos programas com fim** (`main.js esperarProgramas` + `COMPILAR_PRAZO_MS` 3 s; código 1). O `compileAsync` do r170
    sonda o `isReady` a cada 10 ms e nunca resolve com o contexto perdido; depois do prazo a sonda continuava e, com o renderizador
    recriado, jogava um `TypeError` sem dono no console (achado pelo R5). A mesma conta, com fim no prazo, na perda do contexto, no
    renderizador trocado e no material sem programa. O aquecimento da mira passou ao `compile()` (cria o programa já; ninguém
    esperava). Mutação: sem o prazo, o R5 reprova ("NÃO chegou ao pronto em 90 s"; a main igual).
  - **A pausa travada debaixo do "Ajustando…"** (código 4, regressões 2): o `hud.ocupado` põe a pausa `inert` e o foco na tela
    (devolvidos no `livre`), o `tratarAcao` ignora 'pausa', 'ajuda' e 'menu-*' durante a troca e o `pausado()` vale com ela fora
    do online. Mutação (os três tirados): a pausa fecha e o tick vai de 8 a 213 debaixo da tela; o R1 vê o `inert` false e o foco
    no botão em 37–65 amostras.
  - **O leitor de tela** (código 8): o texto entra numa tarefa depois de a região estar à vista, sem o `aria-busy` (que calava o
    anúncio). Não há leitor de tela no CI: dito, não medido.
  - **O online sem compilar o escondido** (código 10): a troca pela pausa no online não chama o `compilarAntesDoDesenho` (só o que
    está à vista compila, no 1º desenho). Medido só pelo `teste-prepartida-tela --so online` (abaixo); a duração da trava no online
    com uma GPU de verdade fica para o minuto do dono.
  - **A queda gravada pela mediana e o ritmo preso só com a mesma cadência** (código 2 e 3, medidas 3): `teste-ritmo-desenho` R2,
    R3, R6, R7 e R9 refeitos e o R11 novo (o aparelho no vsync, 6 casos × 8 sementes: a Média irregular com a Baixa resolvendo, a
    Média lenta pela GPU a 50,0 ms, o PC na Alta presa a 33,3 com a Média a 16,7 gravam; o PC com as duas a 33,3 e o iPhone em
    pouca energia não). As provas da revisão: 0 → 20 de 20 sementes nos dois casos que não gravavam. Mutações: sem a mediana (R3),
    o 50 de volta (R7, R9), a presa gravando direto (R1, R6, R11d, R11e), a presa nunca gravando (R6, R11c), o inativo sem desfazer
    a espera (R6) — cada uma reprova.
  - **O painel sem pegar toque e debaixo da tela "Ajustando…"** (código 5, medidas 1 e 2, regressões 1): `pointer-events: none`,
    `user-select: none`; a tela de carregar na troca e no erro a z 63. Mutação (o `auto` de volta e o z 63 tirado): a P2 do toque
    reprova (844×390: o ENFIADA e o LANÇAMENTO, 8 de 30 pontos; 568×320: 30 de 30; nas Opções 47 e 86 de 100: Baixa, Média, Alta,
    Automática, a hora, o som, o volume, os nomes e o tamanho) e o R1 do painel debaixo da tela (3 de 3 à vista).
  - **As linhas por fase** (medidas 6 e 7, código 6): o rótulo curto, de 100 para cima sem a casa decimal e o percentil na caixa de
    cima do histograma como "> 51" / "> 128" (o "CPU 39651,3" da revisão): a maior linha 56 letras com as 7 fases, a GPU e os
    números grandes (`teste-medidor-quadros` M8 novo; mutações: o número sem o teto, o rótulo longo).
  - **O rótulo "rAF"** (medidas 5): "rAF 120 Hz · teto 1 a cada 2"; o `rafHz` do medidor no `perf()` e na T (as duas contas do
    mesmo rAF). Mutação: o "tela" de volta reprova o M8.
  - **O cronômetro da GPU no contexto restaurado** (código 7): `reiniciar()` no gancho `aoRecriar` com o motivo 'contexto'
    (`teste-medidor-quadros` M6 novo: 20 de 20 antes da perda; restaurado sem o reiniciar 1 em 200; com ele 20 de 20; a mutação
    do reiniciar vazio reprova).
  - **O R4 do `uAlturaBuffer` virou estrutura** (medidas 4): o `onBeforeRender` da malha o refaz a cada desenho; a A2C prova o gancho.
- **Recusadas, com o motivo:**
  - **A queda gravada que expira** (código 11): é escolha de produto (a escolha D5 do dono só diz "escolher uma qualidade à mão
    apaga a queda"); quantas cargas, e se a pessoa vê a Média engasgar de novo, é decisão dele. Vai ao "Depende do dono" 30 com a
    proposta (tentar de novo o nível do aparelho a cada ~10 cargas; uma queda nova grava de novo).
  - **A queda automática só no pixel ratio** (código 9): já é assim na main (o `configurarSombra` marca os materiais e a troca das
    defines recompila); tirar as sombras é metade do que a queda quer, e "manter as sombras na Baixa da queda" faria a queda não
    aliviar a GPU. Corrigido só o texto do plano (seção 2): o motivo "sem o KHR a recompilação trava" era inexato. Medir o engasgo
    da queda numa GPU de verdade fica com o minuto do dono.
  - **"Copiar o texto do painel"** (código 6): a seleção nunca funcionou (o texto é trocado a cada 0,5 s) e, com o painel sem pegar
    toque, não há como selecionar. O dono manda o print (o §7 item 10 já pedia o print) e o `__golaco.perf()` tem o objeto inteiro.
    Um botão "Copiar" nas Opções (só com `?perf`) é opção futura: uma linha a mais nas Opções pede rever a conta da pausa sem rolar.
- **Os testes de navegador da seção 6 que tocam o que mudou** (o `main.js` da troca, do `pausado()`, do `tratarAcao` e da mira, o
  `hud.js` da tela de carregar, o CSS do painel e da tela; base `e41aa791` × HEAD `5ff4db63`, cópias por `git archive` com os
  scripts do HEAD, um teste de navegador por vez, a carga da máquina 2,6–4,6). Nenhuma meta que já existia mudou:

  | Teste | Base | HEAD | Diferença | Tempo (base → HEAD) |
  |---|---|---|---|---|
  | `teste-carga` | — | passa | nosso 2967 → 2973 KB, folga 454,0 → 447,8 KB (do C13); o medidor nunca baixado | 36 s |
  | `teste-pausa-tela` | reprova só o P14 (novo: sem a `quedaDeTeste()`) | passa | 318 → 327 medidas sem rolar; S1 online 19/49 e 28/28 → 14/38, 15/46, 42/23 (ruído, a lição abaixo) | 306 → 328 s (+7%) |
  | `teste-mira-tela` | 19/19 | 19/19 | as mesmas linhas (a mira pelo `compile()` no HEAD) | 199 → 42 s (a base desenha cada posição: `DESENHAR`) |
  | `teste-bola-parada-tela` | 55/55 | 55/55 | "nenhum programa novo quando a mira aparece" nos dois (o `compile()` cria o programa como o `compileAsync`); o L5 do escanteio de dia no 844×390 95% de 20 → 100% de 18 (o classificador do C15 do bloco 2) | 276 → 293 s (+6%) |
  | `teste-tm-tela` | 14/14 | 14/14 | só o que depende do relógio real ("Simular o resto" 7708 → 7713 passos; a nota do travado 6 → 7,1) | 41 → 41 s |
  | `teste-prepartida-tela --so cedo,online` | 35/35 | 35/35 | as mesmas linhas (E26 da tela cedo; O1*–O3 do online, a troca de qualidade de A no O3 sem a compilação inteira) | 380 → 416 s (+9%) |
  | `testar-3d` (pro / `--publica`, o golaco do HEAD) | — | passa / passa, nenhum erro de página | — | 105 s / 120 s |

- **Para o C15** (nada mexido agora; nenhuma meta existente mudou de propósito neste bloco — as que mudaram são dos testes do
  próprio item: o `teste-ritmo-desenho` e o `teste-medidor-quadros`, refeitos aqui, e as linhas novas do `teste-graficos-pagina`):
  - `tools/lib/tempos-ci.mjs`: o `teste-pausa-tela` sobe com o P14 (a sessão nova; base 306 → HEAD 328 s aqui, 296 → 378 s na
    revisão com a máquina carregada) e o `teste-graficos-pagina` entra no C14 com o R5 (+20–26 s) e a P2 do toque (+12–14 s):
    177 s para P2, R, Q, Z e T aqui;
  - `teste-pausa-tela` S1 online (regressões 3, não é do bloco): reprovou no CI do `7fe3a1ab` (15/52, 8/31, 15/41) e pede a 2ª
    medida na main também (`048b278f` 20/54, `4eb76747` 10/42, `0fed6ebc` 15/54); o que limita é o rAF da aba B (1 a 5 por
    segundo, ~1 com a pausa aberta) — a régua nova: "≥ 1 passo com a pausa aberta" (o defeito que ele guarda dá 0) ou a razão
    por quadro do rAF, não por segundo;
  - `teste-prepartida-tela` O1* (regressões 4, já na base: 1 de 3 rodadas nos dois): o `avisos` acumulado desde o O3 (a troca
    de qualidade de A, uma tarefa longa de ~40 s com duas abas no SwiftShader, B em "aguardando") reprova o O1 — zerar o
    `avisos` antes do "A pronto" ou esperar a conexão 'ok' nas duas abas. A troca do online não compila mais a cena inteira (este
    bloco): medir a duração dessa tarefa longa de novo no C15;
  - `legacy-total-match/ferramentas/testar-3d.mjs` (regressões 5, não é do bloco): "prontas ≥ 9" no Estrelato com o adversário
    sorteado (7 pedidas e 7 prontas numa rodada) → "prontas = pedidas" ou um adversário fixo; "o quadro some ≤ 0,5 s" na
    `--publica` (0,822 s uma vez sob carga; 0,019–0,025 s nas outras) → medir de novo sob carga;
  - `teste-bola-parada-tela` L5 (o classificador do C15 do bloco 2): sem mudança de régua aqui;
  - a guarda do leitor de tela (o anúncio do "Ajustando…") não tem teste: o CI não tem leitor de tela (dito no PR).
- **Lições:**
  - **A regra da queda que "exige duas janelas lentas" media a coisa errada:** a 2ª janela já roda no nível de baixo — exigir que
    ela também fique lenta é exigir que o nível de baixo NÃO resolva. Um aparelho no vsync desenha preso também quando é lento
    de verdade: a assinatura "preso" só separa o limite do sistema quando o nível de baixo mantém a mesma cadência.
  - **`compileAsync` sem prazo é uma espera sem fim** (contexto perdido, material descartado, renderizador recriado): a sonda
    dele continua depois de quem esperava desistir e joga erro sem dono. Esperar com uma conta própria, com fim.
  - **O SwiftShader do CI não tem o `KHR_parallel_shader_compile`:** sem a extensão falsa (o R5), nenhum teste passava pelo
    caminho assíncrono — o caminho das GPUs de verdade.
  - **Camada "por cima de tudo" com `pointer-events: auto` rouba toque:** a régua de "por cima" (forçar o toque em todas as
    camadas) não vê isso; a guarda do toque é o `elementFromPoint` sem forçar nada, nos alvos de verdade.
  - **Teste com várias teclas que se desfazem esconde o defeito:** o P depois do Esc reabria a pausa; uma tecla que fecha por troca.

---

## 7. O que pode dar errado e o que pedir ao dono

1. **O SwiftShader não dar 4×** → a sonda reprova. Plano B para o CI: medir o serrilhado só pelo caminho com MSAA quando houver, e o resto com `?aa=0`. Isso é decisão a escrever no PR, não passar calado.
2. **Custo no aparelho:** nada foi medido em celular. As faixas são estimativas das fontes:
   - Chrome Android/Ganesh: +5–15% de GPU, ~+0,2–0,7 ms;
   - Safari/Graphite: ~1,4 GB/s a 60 qps (~140 mW).
   - Rede de segurança: o teto, a queda gravada, o teto dos tablets e o `?aa=0`.
3. **PowerVR GE8xxx:** o 4× pesa mais. Opção a medir com o dono: a Baixa por padrão nessa GPU, pelo `WEBGL_debug_renderer_info`.
4. **Redimensionar com MSAA** realoca ~24 MB por dimensão que muda (a barra do Android); a guarda do passo 1 evita só o mesmo tamanho. Adreno 4xx/5xx emulam o redimensionar (entrada 231 da lista de defeitos).
5. **`readPixels` com o MSAA implícito falha em alguns Adreno** (entrada 280): só importa para ferramenta no aparelho.
6. **Perda de contexto no iOS** com os +24 MB: coberta pelos ganchos (passo 7, seção R); o que não volta sozinho aparece na seção R.
7. **Franjas na silhueta** dos atlas que não são nossos (o corpo novo, os patrocínios): a seção K acusa; a sangria no atlas é da frente do corpo, e o PR diz se ficou algo.
8. **Um celular que só segura 30 regulares** cai na sessão como hoje; desde a revisão do bloco 4 grava a queda quando a Baixa desenha mais rápido que os 30 (a carga era a causa) e não grava quando a Baixa fica nos mesmos 30 (o limite do sistema, como o iPhone em pouca energia — ou um aparelho lento em todo nível, que a medida não separa). O 20 regular (50 ms) grava sempre que a janela é lenta. A queda gravada não expira: só a escolha à mão a apaga (a proposta de tentar de novo a cada ~10 cargas vai ao "Depende do dono" 30).
9. **O que vai ao dono junto do "Depende do dono" 30** (a revisão do C4–C8; sem meta que meça, ou decisão de gosto):
   - **A profundidade nas câmeras baixas** (decidido, seção 2): a 1ª pessoa, a lateral do replay, a comemoração, a câmera do gol,
     a falta, o pré-jogo de perto e as cenas ficam sem o gradiente de vista (como antes do item 45); a TV, o escanteio, o Atrás do
     Livre e os aéreos com ele.
   - **As manchas, k 0,10 × 0,17** em prints, lado a lado (a G6 informativa: a régua da foto não foi refeita; a pesquisa dá
     0,08–0,12, e o 0,17 saiu de uma meta provisória).
   - **Os cantos de baixo à noite**: o poço de luz compete com as faixas — na linha de baixo do quadro do jogo uma faixa clara vai
     de 0,438 a 0,483 e a escura ao lado de 0,441 a 0,495; o degrau numa das bordas fica em 0,028 (o ΔL das faixas é 0,056; na main
     0,108 e 0,088). A G2 tira a média por faixa perto do foco e não vê.
   - **O chão de fora nas câmeras do lado de cá**: rgb 59,76,11 de dia (L 0,389, C 0,090, h 124,2°, o alvo do plano) e 26,40,4 à
     noite (na main 21,88,25). A razão C/L é 0,23, contra 0,17 do gramado: lê como oliva. Opção: C 0,07 (C/L 0,17).
10. **Pedir ao dono:**
   - 1 minuto com `?perf=1&aa=0` e `?perf=1&aa=1` num Android (Adreno ou Mali) e num iPhone, de dia, na partida;
   - o print do painel;
   - a impressão do gramado novo contra o `?gfx=antigo`;
   - o teto (C13) num celular de 120 Hz de verdade (o rAF falso do teste não tem o vsync nem a taxa adaptativa do Android): no
     minuto com `?perf=1`, a linha "rAF 120 Hz · teto 1 a cada 2" e ~60 qps no jogo (num de 90 Hz, "teto 1 a cada 1" e ~90; o
     iPhone já segura o Safari perto de 60). O "rAF" é o ritmo em que o navegador chama a página: num aparelho que não segura o
     desenho ele fica abaixo da tela (a revisão do bloco 4 trocou o "tela" por "rAF");
   - o painel não pega toque (o dono joga com ele à vista) e fica debaixo da tela "Ajustando os gráficos…": o print é o jeito de
     mandar os números.

---

## 8. Estimativa

| Passo | Horas |
|---|---|
| 0 Régua (dois testes), sonda e referência | 5 |
| 1 Opções, AA, `cena.js` (recriação, redimensionar, tablets, contexto, tom) | 2,5 |
| 2 Gramado no shader | 3 |
| 3 Profundidade relativa ao foco e linhas | 2 |
| 4 Grão (medir; filtro se acusar) | 1 |
| 5 Finos, bandeiras, letreiros e silhuetas | 3,5 |
| 6 Painel `?perf` | 2 |
| 7 Troca de qualidade, queda gravada e perda de contexto | 3 |
| 8 Teto e o teste com o rAF falso | 2 |
| 9 Metas, CI, testes afetados, documentos | 3,5 |
| **Total** | **~27,5 h** |

- A FILA dizia 12 h; o plano perdido, ~19 h; a 1ª versão deste, ~23 h.
- A diferença desta revisão: a régua em dois arquivos com a máscara geométrica e o SSAA na F, a profundidade relativa, as silhuetas, os tablets, a perda de contexto, o caminho imediato e o teste do teto.
- Faltam ~27,5 h ao começar. Atualizar a cada mensagem de andamento.

---

## 9. Commits pequenos

**Regras:**
- Branch `claude/football-game-design-q2tr7a` (hoje = `origin/main` `e41aa791`).
- **Cada commit com `git push` na hora.** O PR em rascunho aberto logo depois do C0, para nada se perder num reinício do contêiner.
- Antes de cada push: reler o próprio diff, `fecho-hash --diff origin/main` = 0 e os testes Node do que mudou.
- Mensagens em português, com as linhas de atribuição do lembrete da sessão.

| # | Commit | Arquivos | Toca `main.js`? |
|---|---|---|---|
| C0 | "Item 45 (plano): o plano e a pesquisa dos gráficos do celular" — salva este plano e as 3 pesquisas no repositório (o rascunho da sessão some num reinício) | `golaco/PLANO-GRAFICOS.md`, `golaco/PESQUISA-ESTADIO.md` §19, `golaco/tools/lib/cor-aces.mjs` | não |
| C1 | "Item 45 (teste): teste-graficos-celular, sonda e medidas pelos módulos (informativo)" | `tools/teste-graficos-celular.mjs` (S, A, F, G1–G7, G4b, D, N) | não |
| C2 | "Item 45 (teste): teste-graficos-pagina, a página (informativo)" | `tools/teste-graficos-pagina.mjs` (S2, A2, K, P, P2, P3, R, Q, Z, T) | não |
| C3 | "Item 45 (teste): a referência da main gravada" | `tools/dados/graficos-ref.json` (+ a sonda do SwiftShader e a CPU p95 da base no PR) | não |
| C4 | "Item 45: gramado.js, as faixas UEFA puras (GLSL = JS) e o teste-gramado" | `js/render/gramado.js`, `tools/teste-gramado.mjs`, `tools/rodar-testes.mjs` | não |
| C5 | "Item 45: ?aa ?gfx ?tom e a tabela de antisserrilhado no render (Média com MSAA 4×)" | `js/render/graficos-opcoes.js`, `js/render/cena.js` (AA real do contexto, teto dos tablets, cópia de atributos e do clipping, chave zerada, `setDrawingBufferSize`, `aoRecriar` + contexto restaurado, tom pelo `aplicarHora`) | não |
| C6 | "Item 45: o gramado no shader (18 faixas UEFA, verde realista, manchas, textura de 512)" | `js/render/campo.js`, `js/render/texturas.js` (`?gfx=antigo` = a textura de antes) | não |
| C7 | "Item 45: profundidade relativa ao foco e linhas mais brancas" | `js/render/campo.js`, `js/render/gramado.js` | não |
| C8 | "Item 45: grão ao longe medido" (+ o filtro pela derivada só se acusar) | `js/render/campo.js` e/ou só o teste | não |
| C9 | "Item 45: finos com largura mínima (A2C com MSAA, mistura sem ele)" | `js/render/campo.js`, `js/render/util.js`, `main.js` (o registro do `aoRecriar`) | sim (1 linha) |
| C10 | "Item 45: bandeiras com o alfa compensado, letreiros com A2C e silhuetas com centroid" (+ A2C na torcida só se a K medir ganho) | `js/render/bandeiras.js`, `torcida.js`, `impostor.js`, `estadio-fora.js`, `estadio-generico.js`, `estadio-real.js` | não |
| C11 | "Item 45: painel ?perf/?qps por fase com p95, AA, buffer e GPU (e o qps certo na tela antes do jogo)" | `js/render/medidor-quadros.js`, `tools/teste-medidor-quadros.mjs`, `main.js`, `hud.js`, `css/estilo.css`, `tools/teste-carga.mjs` (lista) | sim |
| C12 | "Item 45: troca de qualidade com a tela de carregar, queda gravada e contexto restaurado" | `main.js`, `hud.js`, `render/cena.js`, `js/render/ritmo-desenho.js` (a decisão da queda), `tools/teste-ritmo-desenho.mjs` | sim |
| C13 | "Item 45: teto de 60 desenhos no celular de 100 Hz para cima" | `js/render/ritmo-desenho.js`, `tools/teste-ritmo-desenho.mjs`, `main.js` | sim |
| B4 | a revisão do bloco 4: `e6f6df30` (a queda gravada pela mediana), `2abed4b3` (a troca com prazo, a pausa travada, o online), `c37f5587` (o painel sem toque, as linhas, o rAF, o cronômetro), `b6be7508` (a espera própria dos programas), os testes `a44f0145`, `a4b9df80`, `5ff4db63` e o plano | `js/render/ritmo-desenho.js`, `main.js`, `hud.js`, `css/estilo.css`, `js/render/medidor-quadros.js`, `js/render/bola-parada.js` (comentário), `tools/teste-ritmo-desenho.mjs`, `tools/teste-medidor-quadros.mjs`, `tools/teste-graficos-pagina.mjs` | sim |
| C14 | "Item 45 (teste): metas valendo e os dois testes na lista do CI" | `tools/teste-graficos-celular.mjs`, `tools/teste-graficos-pagina.mjs`, `tools/rodar-navegador.mjs`, `tools/lib/tempos-ci.mjs` | não |
| C15 | "Item 45 (testes): recalibração medida dos testes afetados" (só os que mudaram de propósito; tabela no PR) | testes da seção 6, `tempos-ci.mjs` | não |
| C16 | "Item 45 (docs): contrato, FILA, CATEGORIAS, CLAUDE.md e o Depende do dono 30" | `golaco/CONTRATOS.md`, `golaco/FILA.md`, `golaco/CATEGORIAS.md`, `CLAUDE.md` | não |

**Fechamento:**
- O PR sai do rascunho com a tabela antes → depois (seção 4), as fontes e o pedido ao dono (seção 7).
- Merge na `main`.
- Link do jogo fora do artifact: `https://<pages>/golaco/` e `?perf=1`.

---

## 10. Fontes

**Antisserrilhado e navegadores**
- Chromium, a escolha do modo de MSAA, o Graphite e o Mac: [drawing_buffer.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/graphics/gpu/drawing_buffer.cc) (linhas 214 e 1010-1060)
- Chromium, o `Reshape` e o atributo devolvido à página: [webgl_rendering_context_base.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc) (Reshape na 2491; antialias na 3921); o canvas: [html_canvas_element.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/html/canvas/html_canvas_element.cc)
- Chromium, as preferências e a amostragem padrão 4: [web_graphics_context_3d_provider.h](https://github.com/chromium/chromium/blob/main/third_party/blink/public/platform/web_graphics_context_3d_provider.h) e [webgraphicscontext3d_provider_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/content/renderer/webgraphicscontext3d_provider_impl.cc)
- Chromium, a lista de defeitos de driver (entradas 231, 268, 280): [gpu_driver_bug_list.json](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_driver_bug_list.json)
- Chromium, o Graphite por plataforma: [gpu_finch_features.cc](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_finch_features.cc); o experimento no Android: [commit 0d6f3f0d](https://chromium.googlesource.com/chromium/src/+/0d6f3f0d4a560deded1fa7f4194ea6d3fb408fa1); o lançamento no Mac: [blog do Google](https://blog.google/chromium/introducing-skia-graphite-chromes/)
- ANGLE: [renderergl_utils.cpp](https://chromium.googlesource.com/angle/angle/+/refs/heads/main/src/libANGLE/renderer/gl/renderergl_utils.cpp), [vk_renderer.cpp](https://chromium.googlesource.com/angle/angle/+/refs/heads/main/src/libANGLE/renderer/vulkan/vk_renderer.cpp), [FrameBufferMtl.mm](https://chromium.googlesource.com/angle/angle/+/refs/heads/main/src/libANGLE/renderer/metal/FrameBufferMtl.mm)
- Resolve implícito: [EXT_multisampled_render_to_texture](https://skia.googlesource.com/external/github.com/KhronosGroup/OpenGL-Registry/+/85d924a5165e7206f4c73c8c10307658dc2bbe10/extensions/EXT/EXT_multisampled_render_to_texture.txt) e [Chromium CL 671643005](https://codereview.chromium.org/671643005/patch/40001/50001)
- WebKit: [WebGLDefaultFramebuffer.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/canvas/WebGLDefaultFramebuffer.cpp); [GraphicsContextGLANGLE.cpp do Safari 17.4](https://github.com/WebKit/WebKit/blob/releases/Apple/Safari-17.4-macOS-14.4/Source/WebCore/platform/graphics/angle/GraphicsContextGLANGLE.cpp)
- SwiftShader: [VkPhysicalDevice.cpp](https://swiftshader.googlesource.com/SwiftShader/+/refs/heads/master/src/Vulkan/VkPhysicalDevice.cpp) e [Constants.hpp](https://swiftshader.googlesource.com/SwiftShader/+/HEAD/src/Pipeline/Constants.hpp)
- Perda de contexto: [WEBGL_lose_context](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/)
- A GPU no Firefox: [WEBGL_debug_renderer_info obsoleto no Firefox, use RENDERER](https://stackoverflow.com/questions/69055946/what-does-the-message-webgl-debug-renderer-info-is-deprecated-in-firefox-and-wi)

**Ritmo de quadros e pouca energia**
- [Teste do WebKit: rAF limitado no modo de pouca energia](https://webkit.googlesource.com/WebKit/+/2538ba1dc66c1a9ab694bc167c5d56293dae7e8e/LayoutTests/fast/animation/request-animation-frame-throttling-lowPowerMode.html)
- [Motion: quando os navegadores limitam o rAF](https://motion.dev/blog/when-browsers-throttle-requestanimationframe)
- [Fórum da GreenSock: 60 qps no modo de pouca energia](https://greensock.com/forums/topic/26826-any-way-to-keep-gsap-running-at-60fps-while-mobile-device-is-in-low-power-mode/)
- Safari e o desenho perto de 60 qps: [iGeeksBlog](https://www.igeeksblog.com/this-hidden-safari-setting-unlocks-120hz-scrolling/) e [Macworld](https://www.macworld.com/article/3040366/enable-faster-scrolling-in-safari-and-more-with-this-hidden-setting.html)

**Custo do MSAA e alternativas**
- Arm: [Mali GPU Best Practices (PDF)](https://armkeil.blob.core.windows.net/developer/Arm%20Developer%20Community/PDF/Arm%20Mali%20GPU%20Best%20Practices.pdf)
- Khronos, o exemplo de MSAA no Vulkan: [README](https://github.com/KhronosGroup/Vulkan-Samples/blob/main/samples/performance/msaa/README.adoc)
- Qualcomm: [Anti-aliasing with Adreno](https://docs.qualcomm.com/bundle/publicresource/80-71528-1/topics/anti_aliasing_with_adreno.md)
- Meta: [Mobile MSAA analysis](https://developers.meta.com/horizon/documentation/native/android/mobile-msaa-analysis/)
- Imagination (PowerVR): [MSAA performance](https://docs.imgtec.com/performance-guides/graphics-recommendations/html/topics/msaa-performance.html) e [analytical AA](https://docs.imgtec.com/performance-guides/graphics-recommendations/html/topics/preferred-analytical-aa-solution.html)
- Unity: [URP anti-aliasing](https://docs.unity3d.com/6000.1/Documentation/Manual/urp/anti-aliasing.html); Godot: [3D antialiasing](https://docs.godotengine.org/en/stable/tutorials/3d/3d_antialiasing.html); NVIDIA: [FXAA sample](https://docs.nvidia.com/gameworks/content/gameworkslibrary/graphicssamples/opengl_samples/fxaa.htm)
- web3dsurvey: [MAX_SAMPLES](https://web3dsurvey.com/webgl2/parameters/MAX_SAMPLES), [EXT_disjoint_timer_query_webgl2](https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2), [KHR_parallel_shader_compile](https://web3dsurvey.com/webgl2/extensions/KHR_parallel_shader_compile)
- Firefox: [bug 1769283](https://bugzilla.mozilla.org/show_bug.cgi?id=1769283)
- Apple: [Choosing a resource storage mode for Apple GPUs](https://developer.apple.com/documentation/metal/choosing-a-resource-storage-mode-for-apple-gpus)

**Alfa, silhuetas e objetos finos**
- Golus: [Anti-aliased Alpha Test](https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f)
- Khronos, o texto do ES 3.0.2 sobre SAMPLE_BUFFERS: [OES_sample_variables](https://skia.googlesource.com/external/github.com/KhronosGroup/OpenGL-Registry/+/master/extensions/OES/OES_sample_variables.txt)
- Khronos, o qualificador `centroid`: [GLSL ES 3.00](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
- Humus: [Phone-wire AA](http://www.humus.name/index.php?page=3D&ID=89)

**three.js r170**
- Shaders: [alphatest_fragment](https://github.com/mrdoob/three.js/blob/r170/src/renderers/shaders/ShaderChunk/alphatest_fragment.glsl.js), [tonemapping_pars_fragment](https://github.com/mrdoob/three.js/blob/r170/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js), [meshlambert](https://github.com/mrdoob/three.js/blob/r170/src/renderers/shaders/ShaderLib/meshlambert.glsl.js), [common (BRDF_Lambert)](https://github.com/mrdoob/three.js/blob/r170/src/renderers/shaders/ShaderChunk/common.glsl.js)
- Renderizador (`setPixelRatio`, `setSize`, `setDrawingBufferSize`, `compile`, `onBeforeRender`): [WebGLRenderer.js](https://github.com/mrdoob/three.js/blob/r170/src/renderers/WebGLRenderer.js), [WebGLProgram.js](https://github.com/mrdoob/three.js/blob/r170/src/renderers/webgl/WebGLProgram.js), [WebGLTextures.js](https://github.com/mrdoob/three.js/blob/r170/src/renderers/webgl/WebGLTextures.js), [TAARenderPass.js](https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/TAARenderPass.js)
- PRs: [#19696 (ACES ×1/0,6)](https://github.com/mrdoob/three.js/pull/19696), [#27366 (AgX)](https://github.com/mrdoob/three.js/pull/27366), [#27668 (Khronos Neutral)](https://github.com/mrdoob/three.js/pull/27668), [fórum: o AgX do three × o do Blender](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609)

**Tom e cor**
- AgX e Neutral fora do three: [Filament #7236](https://github.com/google/filament/pull/7236), [iolite: AgX mínimo](https://iolite-engine.com/blog_posts/minimal_agx_implementation), [model-viewer, tone mapping](https://modelviewer.dev/examples/tone-mapping), [Khronos PBR Neutral](https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral)
- Ajuste do ACES (Hill): [ltc_blit.fs](https://github.com/selfshadow/ltc_code/blob/master/webgl/shaders/ltc/ltc_blit.fs)
- OKLab: [Ottosson](https://bottosson.github.io/posts/oklab/)

**Gramado**
- Regras de corte:
  - [UEFA Pitch Quality Guidelines 2025, §4.3.1, pp. 21–22, Fig. 15](https://www.nzs.si/sites/default/files/media/document/UEFA%20Pitch%20Quality%20Guidelines%20-%202025%20Edition.pdf) (conferido no PDF; o arquivo passa de 10 MB)
  - [Premier League Pitch Standards Framework 2025, K.23](https://resources.premierleague.pulselive.com/premierleague/document/2025/06/06/6b9e7b0e-e3ac-4510-a055-7217321a819f/Premier-League-Pitch-Standards-Framework-2025-Edition.pdf)
  - [LFP Championnat des Pelouses BKT 2024/25, art. 15](https://www.lfp.fr/assets/24_25_Reglement_Championnat_Pelouses_BKT_05_08_2024_52df199c86.pdf)
  - [Ligue 1, "o gramado"](https://www.ligue1.com/Articles/NEWS/2021/09/07/user-s-manual-the-pitch)
  - [Reformsports, medidas das faixas](https://en.reformsports.com/different-specifications-on-football-stadium-construction/) (secundária)
- Mecanismo das faixas: [NALP, mowing patterns](https://blog.landscapeprofessionals.org/technically-speaking-the-art-of-mowing-patterns/)
- Refletância por ângulo: [Kimes 1983, Applied Optics 22(9):1364](https://doi.org/10.1364/AO.22.001364), [Sandmeier et al. 1998, RSE 66:222](https://doi.org/10.1016/S0034-4257(98)00060-1)
- Névoa real: [Koschmieder, β = 3,912/V](https://en.wikipedia.org/wiki/Visibility)
- Filtro anisotrópico: [EXT_texture_filter_anisotropic](https://registry.khronos.org/OpenGL/extensions/EXT/EXT_texture_filter_anisotropic.txt)
- Fotos de conferência: [Allianz Arena, panorama de dia](https://commons.wikimedia.org/wiki/File:Allianz_Arena_Playing_field_panorama.jpg) e [Allianz Arena à noite](https://commons.wikimedia.org/wiki/File:Allianz_Arena_Bayern_Mnichov_vs_Man.United.jpg)
