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
- **N8: o `compile()` do r170 só percorre o visível** (`three.module.js:29801-29830`, `traverseVisible`). Depois de uma recriação, o cartão 3D, a placa da substituição, a linha do impedimento, os sinalizadores e a fumaça compilam quando aparecem, como já acontece na 1ª carga.
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
- **O painel com `?perf=1` fica visível em TODAS as fases** e por cima de tudo, para o minuto do dono cobrir a tela antes do jogo, o replay e as cenas. Com F3, como hoje.
- **Na queda automática não se recria o contexto no meio da partida.** Sem o `KHR_parallel_shader_compile` (0,23% dos Android) a recompilação trava a tela. Cai o pixel ratio (1,5 → 1) e saem as sombras; o MSAA fica até a próxima carga, que já abre na Baixa por causa da queda gravada.
- **A queda na sessão continua como hoje; só a GRAVAÇÃO é exigente:**
  - duas janelas lentas seguidas (2 × 2,5 s);
  - o ritmo NÃO preso num divisor da tela com pouco tremor (o rAF a 30 regular do iPhone em pouca energia ou do economizador do Android cai na sessão, como hoje, mas não grava);
  - fora de `navigator.webdriver`, `?prints=1` e `?demo=1`; o `__golaco.quedaDeTeste()` grava de propósito.
- **O xadrez da Ligue 1 fica de fora** (opção futura por liga). Vale a UEFA.

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
  - `uManchas` calibrado pela G6 (ponto de partida 0,10: ±5% de albedo, só luminância).
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
  - `uRasante` ≈ 0,22 de dia, calibrado pela G4 para longe − perto = +0,026 na TV do celular; à noite começa na metade e é medido;
  - o longe tem de ficar ≥ 0,6× o ΔL das faixas do foco e com |Δh| ≤ 2°.
- **Por que relativa (crítica 16):** com g absoluto (`g − 0,49`), as câmeras baixas clareariam o gramado inteiro em ~+11% (1ª pessoa e lateral baixa do replay, steadicam da comemoração, câmera do gol, "Jogador"/"Atrás" do Livre, bola parada), o aéreo do pré-jogo escureceria ~10%, e o corte da TV para a 1ª pessoa viraria um salto de exposição. O PC (24,6°, `config.js:397`) dá outro gradiente que o celular (15°): medido na seção N.
- **Linhas:** `diffuseColor.rgb *= uBrancoLinha` (1,8 de dia: pico 0,952; à noite medido, ≤ 0,97 também) no shader das linhas (`campo.js:155-177`). Nada de `toneMapped = false` (dá 0,98 e quebra a noite).
- **Fontes:**
  - Refletância por ângulo do dossel: Kimes 1983, Applied Optics 22(9):1364; Sandmeier et al. 1998, RSE 66:222.
  - Névoa real (Koschmieder, β = 3,912/V: 1–2% a 100 m, então não é a névoa).
  - A curva do ACES (`tonemapping_pars_fragment` r170).
- **Pode quebrar:** o `teste-rede-tela` mede "clareia o gol na TV": o fundo de grama longe fica ~+4% mais claro. Medir a base com as mesmas metas.

### Passo 4: grão ao longe (D8): medir antes — ~1 h

- A seção D do teste mede o aliasing:
  - gramado só, 1× contra 3×3 reduzido por caixa;
  - E = RMS(L₁× − L_ref) por faixa da tela (perto, foco, longe);
  - cintilação: 30 quadros com a câmera andando 0,25 px por quadro; média de |ΔL| quadro a quadro menos a da referência.
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
  - com `?perf=1`, o painel vai para o `body` (`document.body.append`) com a classe `perf-fixo`: `position: fixed`, `z-index: 62` (acima do `.carregando`, 60), `pointer-events: auto`, `user-select: text` (o dono seleciona e copia);
  - as regras que o escondem no replay, na comemoração e nas cenas (`estilo.css:990-1009`) não pegam o `.perf-fixo`.
- **O painel mostra:**
  - qps desenhados e ms (p50/p95);
  - CPU do quadro p95;
  - chamadas e triângulos;
  - qualidade (escolha e atual);
  - AA: `antialias`, `SAMPLES` e o modo provável (implícito no Chrome Android/Ganesh; separado no Safari, no Mac e no Graphite; implícito emulado no SwiftShader), deduzido da GPU e do navegador;
  - buffer W×H e pixel ratio (o teto dos tablets, se aplicado);
  - GPU: `UNMASKED_RENDERER_WEBGL` pelo `WEBGL_debug_renderer_info`; no Firefox, o `gl.RENDERER` comum (lá a extensão avisa no console que está obsoleta);
  - refresh medido e teto (*n*);
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
  - O `compile()` só percorre o visível (N8): o cartão 3D, a placa da substituição, a linha do impedimento, os sinalizadores e a fumaça compilam quando aparecem, como na 1ª carga. Vai escrito no PR.
- **Queda automática:**
  - na sessão, a MESMA regra de hoje (3 s, janela de 2,5 s, `qps < 30` na Média), medindo os quadros DESENHADOS (vale com o teto do passo 8);
  - `cena3d.definirQualidade('baixa', false)`: o contexto fica, então o MSAA fica; cai o pixel ratio e as sombras;
  - **grava** `prefs.qualidadeQueda = {de, para, v: 1}` (`golaco.prefs.v1`, `main.js:302`) só se:
    - houve duas janelas lentas seguidas;
    - o ritmo não estava preso num divisor da tela com pouco tremor (a mediana dos intervalos a ±1 ms de 33,3 ou 50 ms e p90 − p10 ≤ 2 ms: o iPhone em pouca energia, o economizador do Android);
    - e fora de `navigator.webdriver`, `PRINTS` e `DEMO_ON`;
  - o `__golaco.quedaDeTeste()` grava de propósito;
  - na próxima carga com "Automática", `qAutoInicial` vira a qualidade gravada (`main.js:349-352`);
  - escolher qualidade à mão apaga a queda;
  - a linha da pausa: "Agora: Baixa (o aparelho não segurou a Média; escolha Média para tentar de novo)".
- **Perda de contexto (N7):** o ouvinte do passo 1 roda os ganchos no `webglcontextrestored`; o `main.js` reaquece a mira e redesenha. Testado pelo `WEBGL_lose_context` (seção R).
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
  - o tempo de cada um no `tools/lib/tempos-ci.mjs` (estimativa ~150 s cada; `TEMPO_NOVO` é 60): acertar pelo log do 1º CI.
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

Na referência só ficam valores agregados com tolerância, nunca o hash dos pixels. A versão do Chromium e a do SwiftShader vão gravadas: com versão diferente da gravada, as guardas "nada pior" que dependem da rasterização ganham +50% de tolerância e avisam; as metas absolutas valem sempre.

**Seções** (antes = calculado ou a gravar na main). A coluna "Reprova na main" é o que se espera pelas contas; o passo 0 confirma, e a meta que a main não reprovar vira informativa e o PR diz.

**Medido na main (C3).** A referência está em `tools/dados/graficos-ref.json`, chaves `celular` (153 valores) e `pagina` (61 valores):
- gravada da main `e41aa791` pela worktree de leitura, com `--raiz <main>/golaco --gravar-referencia`;
- Chromium 153.0.8010.12, `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`;
- tempos: ~60 s o do celular e ~236 s o da página.

A sonda é válida nos dois testes: com `antialias` pedido, o SwiftShader dá `antialias` true e `SAMPLES` 4 (`MAX_SAMPLES` 4); sem pedir, 0. O MSAA funciona no SwiftShader, o mesmo renderizador do CI.

Depois de gravar, a branch (o mesmo código da main) foi relida contra a referência: o `teste-graficos-celular` inteiro e a seção P da página. Todas as guardas "nada pior" deram iguais à ref.

Cada linha das tabelas "medido na main", abaixo de cada tabela, termina numa destas três classes:
- **vale**: a main reprova, e a mudança tem de levar a meta para dentro. É a prova antes → depois.
- **guarda**: passa na main por construção (a peça ainda não existe; é "nada pior", "chave de volta" ou estrutura). Vale a partir do C14 para nada piorar, mas não conta como prova de melhoria.
- **informativa**: meta de melhoria que a main já cumpre, ou que na main não mede nada. Fica na saída do teste, não reprova, e o PR diz. O C14 passa essas linhas a `info` no código.

**`teste-graficos-celular` (módulos):**

| Sec. | O que mede | Meta (depois) | Reprova na main? |
|---|---|---|---|
| S | Sonda: um contexto com `antialias: true` dá `antialias`/`SAMPLES` = true/4. O build: Média true/4; Baixa false/0; `?aa=0` na Média 0; `?aa=1` na Baixa 4; `?gfx=antigo` na Média 0. SwiftShader sem 4 quando pedido = **teste inválido (reprova)** | como ao lado | sim (Média 0) |
| A | Serrilhado da geometria do campo. Máscara GEOMÉTRICA do mesmo build: \|MSAA − sem AA\| > 0,01 (os dois desenhados com o contexto pré-criado). E = RMS(imagem − SSAA 3×3 reduzido por caixa) só nessa máscara, no foco e no gol de lá. Razão E_build / E_semAA no mesmo build | Média ≤ 0,6 (na main, a Média é a sem AA: razão 1); Baixa: razão 1 por construção, e o "nada pior" é pareado com `--raiz` da base, na máscara da base (informativo no CI); noite idem | sim (Média) |
| F | Finos: N pontos ao longo da projeção de cada haste, corda e mastro (foco e gol de lá). Em cada ponto, a intensidade SOMADA no corte transversal (±3 px, contra um quadro sem os gols). "Buraco" = < 15% do SSAA do mesmo ponto. Cintilação = CV da soma por ponto em 8 quadros com a câmera a 0,25 px por quadro | buracos ≤ 5%; cintilação ≤ 1,5 × a do SSAA do mesmo quadro; soma ±30% da do SSAA (sem "fio grosso"); também na "Baixa com MSAA" da queda (pr 1, A2C) | sim (cordas e mastro de lá) |
| G1 | Cor na faixa do foco (OKLab, gramado só) | L 0,58 ± 0,02; C 0,10 ± 0,01; h 124 ± 3° | sim (C 0,128, h 134,8°) |
| G2 | ΔL das faixas (média por faixa, x do mundo de cada pixel pelo raio até y = 0) | 0,056 ± 0,008; ao longe ≥ 0,6× o do foco | sim (0,104) |
| G3 | Faixas e bordas | 18 no campo; cada borda a ≤ max(0,10 m; 1 px) da UEFA; a linha do meio separa claro de escuro | sim (20; 0,75 m na grande área) |
| G4 | Longe − perto (L), ΔC, Δh na TV do celular | +0,026 ± 0,008; ΔC ≤ 0; \|Δh\| ≤ 2° | sim (≈ 0) |
| G4b | A profundidade nas outras câmeras: 1ª pessoa e lateral baixa do replay, steadicam da comemoração, câmera do gol, "Jogador"/"Atrás" do Livre, bola parada, aéreo do pré-jogo; e o corte TV → 1ª pessoa | o L do gramado no foco = o sem o termo ± 0,005 em todas; o salto de L no meio da tela no corte ≤ 0,01 além do da main | — (guarda nova) |
| G5 | Pico da linha (p95 no foco) | 0,952 ± 0,01 e ≤ 0,97 | sim (0,908) |
| G6 | σL das manchas em blocos de **8 m** (a mancha tem 3–10 m; o `d2` repete a cada 7,3 m e some na média do bloco), sem a média da faixa e sem um plano de perspectiva | a régua da foto refeita em blocos de 8 m no passo 0 (ponto de partida 0,010 ± 0,004); a main medida | a confirmar no passo 0 |
| G7 | GPU = JS: a paridade lida no pixel = `gramado.js faixaEm(x)` | 100% fora da borda | — (estrutural) |
| D | Grão: E e cintilação por faixa da tela | só reprova se o filtro entrou (passo 4); senão informativa | — |
| N | Noite, Baixa e PC. Noite: G2–G5 com as metas do dia, a linha ≤ 0,97 absoluta, e Δh(noite − dia) = o da main ± 2° (a mesma h do dia é impossível com a luz fria). Baixa: G1–G5 e F. **PC 1280×720 Alta, dia e noite**: G1–G5 (a câmera a 24,6°) e A nada pior | como ao lado | parcial |

**`teste-graficos-celular`, medido na main (C3):** "forçado" é o mesmo build com o contexto pré-criado com MSAA, o que a Média ganha no C5.

| Sec. | Meta | Esperado na main | Medido na main | Fica |
|---|---|---|---|---|
| S | Sonda | true/4 | true/4 (MAX 4); sem pedir, 0 | estrutura (válido) |
| S | Build Média true/4 | reprova | false/0, buffer 1266×585 (pr 1,5) | vale |
| S | Build Baixa false/0 | — | false/0, 844×390 | guarda |
| S | `?aa=0` na Média 0 | — | 0 (a main não lê `?aa`) | guarda |
| S | `?aa=1` na Baixa 4 | reprova | 0 | vale |
| S | `?gfx=antigo` na Média 0 | — | 0 | guarda |
| A | Média, dia: razão ≤ 0,6 (gol no foco / gol de lá) | reprova (1) | 1,00 / 1,00 (forçado ×0,58 / ×0,54) | vale (só o MSAA deixa o foco com 0,02 de folga) |
| N | Média, noite: razão ≤ 0,6 (foco / lá) | reprova | 1,00 / 1,00 (forçado ×0,54 / ×0,44) | vale |
| N | A da Baixa, nada pior (foco / lá) | — | E 0,0473 / 0,0623 = ref | guarda (informativa no CI, como no plano) |
| N | A do PC Alta, nada pior (dia foco/lá; noite foco/lá) | — | E 0,0313 / 0,0312; 0,0270 / 0,0323 = ref | guarda |
| F | Média: buracos ≤ 5% (foco / lá) | reprova | 34,3% / 26,3% (corda do pé 57% / 40%, mastro 33% / 12%); forçado 0% / 0% | vale |
| F | Média: cintilação ≤ 1,5× o SSAA e soma 0,7–1,3 (foco / lá) | reprova | ×13,3 / ×9,5; a soma 0,85 / 0,87 passa; forçado ×1,74 / ×1,19, soma 1,00 / 0,98 | vale (só com o MSAA o foco fica fora: o C9 fecha) |
| F | Baixa: buracos (foco / lá) | reprova | 67,3% / 30,6% | vale |
| F | Baixa: cintilação e soma (foco / lá) | reprova | ×15,6 / ×8,6; soma 0,49 / 1,30 | vale |
| F | Baixa com MSAA (a queda): buracos (foco / lá) | reprova | 0% / 0% (forçado) | **informativa** |
| F | Baixa com MSAA: cintilação e soma, gol no foco | reprova | ×1,28, soma 0,81 | **informativa** |
| F | Baixa com MSAA: cintilação e soma, gol de lá | reprova | ×1,73, soma 0,86 | vale |
| G1 | L 0,58 ± 0,02; C 0,10 ± 0,01; h 124 ± 3° | reprova (C 0,128, h 134,8°) | L 0,582 (passa), C 0,127, h 134,7° | vale (C e h; o L é guarda) |
| G2 | ΔL 0,056 ± 0,008; ao longe ≥ 0,6× | reprova (0,104) | 0,099 perto, 0,102 longe (×1,03 passa) | vale |
| G3 | 18 faixas; bordas ≤ max(0,10 m; 1 px); o meio separa | reprova (20; 0,75 m) | 20; a pior borda a 2,59 m (x = 18,3); o meio separa (0,541 \| 0,639) | vale (as faixas e as bordas; o meio é guarda) |
| G4 | ΔL +0,026 ± 0,008; ΔC ≤ 0; \|Δh\| ≤ 2° | reprova (≈ 0) | ΔL +0,0075 (as manchas da textura, não zero); ΔC +0,0004; Δh −0,18° | vale pelo ΔL (o ΔC fica fora por 0,0004, ruído) |
| G5 | 0,952 ± 0,01 e ≤ 0,97 | reprova (0,908) | 0,909 | vale |
| G6 | 0,010 ± 0,004 | a confirmar | 0,0054 em 58 blocos (a pesquisa estimou ~0,005): fora por falta de mancha | vale, provisória (ver "Pendente" abaixo) |
| G7 | GPU = JS | estrutural | sem `gramado.js` | estrutura a partir do C4 |
| G4b | Com × sem o termo ≤ 0,005 nas 9 câmeras; o salto TV → 1ª pessoa ≤ ref + 0,01 | guarda nova | sem o gancho: o L no foco vai de 0,529 a 0,650 nas 9; o salto 0,0011 (agora a ref) | guarda (o com × sem só com o gancho do C7) |
| D | O grão | informativa | E 0,0030–0,0034; cintilação ×0,66–×0,84 a do SSAA | informativa |
| N | Noite G1 | informativa (só o Δh conta) | L 0,568, C 0,124, h 138,0° | informativa |
| N | Noite G2 / G3 / G4 | reprova | 0,098 (longe ×1,00) / 20 faixas, 2,59 m / ΔL −0,0094, ΔC −0,0028, Δh +0,01° | vale |
| N | Noite G5 ≤ 0,97 | guarda (teto) | 0,902 | guarda |
| N | Δh(noite − dia) = ref ± 2° | guarda | 3,32° (agora a ref) | guarda |
| N | Baixa G1–G5 | reprova | L 0,581 C 0,127 h 134,7°; ΔL 0,099; 20 faixas, 2,60 m; ΔL longe +0,0082, ΔC +0,0005; linha 0,909 | vale |
| N | PC Alta, dia, G1–G5 | reprova | os números da Média do dia (L 0,582 C 0,127 h 134,7°; 0,099; 20 / 2,59 m; +0,0075; 0,909) | vale |
| N | PC Alta, noite: G1 / G2–G4 / G5 | parcial | G1 L 0,568 C 0,124 h 138,0°; 0,098; 20 / 2,59 m; ΔL −0,0057, ΔC −0,0018; linha 0,902 | G1 informativa; G2–G4 vale; G5 guarda |

**`teste-graficos-pagina` (página):**

| Sec. | O que mede | Meta (depois) | Reprova na main? |
|---|---|---|---|
| S2 | Sonda na página: Média 4 no 844×390; tablet 1366×1024 com toque e dpr 2 na Média = 0 (o teto de 1,2 MP); `?aa=1` no tablet = 4; PC 1280×720 Média = 4 | como ao lado | sim (Média 0) |
| A2 | Serrilhado do quadro inteiro (jogadores, bola, torcida, placas) com `?aa=0` × `?aa=1` (na main, o `addInitScript`): a mesma máscara geométrica e a mesma razão da A | Média ≤ 0,6 | sim |
| K | Recortes e silhuetas: (1) franjas — pixels da borda no MSAA cuja cor não é mistura das cores vizinhas do quadro sem AA (distância OKLab > 0,03), na torcida, nas bandeiras, nas placas e escudos e, no pré-jogo, nos letreiros; (2) a cobertura das bandeiras a 50 e a 100 m contra o SSAA; (3) a A2C da torcida e das bandeiras: só entra se a cintilação da silhueta cair em dois quadros seguidos com a câmera andando, sem a cobertura média do torcedor cair > 10% contra o SSAA | franjas ≤ 0,2% dos pixels de borda e ≤ o da main com o MSAA forçado; cobertura das bandeiras ≥ 0,8 × SSAA; a A2C só com ganho medido | sim (bandeiras de longe) |
| P | Chamadas e triângulos no quadro fixo da TV; CPU do quadro p95 (o `medirQuadro`, sem a GPU, CPU 4×, 10 s de `?demo=1`, como o `teste-desempenho-celular`) | chamadas = ref (+0; a FILA admite ≤ +2); triângulos ≤ ref + 1%; **CPU p95 ≤ 6 ms e nada pior que a base** (pareado com `--raiz`, ≤ +0,2 ms). Se a base já passar de 6 ms nessa medida (o motivo de o `teste-desempenho-celular` ser informativo), o PR mostra o número da base e os 6 ms valem para a parte do quadro que o item muda (o `desenho` do `medirQuadro`, o painel, o ritmo); vai ao "Depende do dono" 30 | — (guarda) |
| P2 | `?perf=1` e `?qps=1`: o painel tem p95, fase, AA, buffer, GPU, refresh; visível no replay, na tela antes do jogo (`?prepartida=1`) e na pausa; a tela antes do jogo mostra ~30 (N3); `__golaco.perf()` | como ao lado | sim (não existe; 60 em vez de 30) |
| P3 | `?gfx=antigo` = a ref da main em G1–G5 (± tolerância) e `SAMPLES` 0 na Média; `?tom=neutro`: `NeutralToneMapping` e a exposição = `H.exposicao` × 1,40 de dia e de noite, também depois de `definirHora` e de uma recriação | como ao lado | — (chave de volta) |
| R | Recriação e contexto. (1) Celular, `?prepartida=1`, depois do `pronto3d`, pelo ≡ → Opções: Média → Baixa → Média: `SAMPLES` 4 → 0 → 4, o canvas novo com `aria-label` e `inert`, a tela "Ajustando…" aparece e some, a mira cobra (`bolaParadaDeTeste`). (2) **PC 1280×720, Alta → Baixa** com `?prejogo=1` no plano do vão aberto: o `local` do vão true, o `aria-label`. (3) `__golaco.definirQualidade` imediato: troca e desenha no mesmo `evaluate`. (4) `WEBGL_lose_context`: `loseContext()` → `restoreContext()`: os ganchos rodam (A2C = `SAMPLES`, `uAlturaBuffer` = `drawingBufferHeight`), a mira cobra, o quadro desenha (pixels ≠ preto). 0 erro no console em tudo | como ao lado | sim (aria-label, inert e clipping na Alta → Baixa; `SAMPLES`; o contexto restaurado sem os ganchos) |
| Q | Queda: `__golaco.quedaDeTeste()`: mesmo canvas (sem recriar), `qAtual` 'baixa', `SAMPLES` continua 4, a queda nas preferências, a linha da pausa; recarregar em Automática abre na Baixa com `SAMPLES` 0; escolher a Média apaga. A queda natural com webdriver (um rAF falso a 20 Hz, sem `?q`): cai na sessão e NÃO grava | como ao lado | sim |
| Z | Redimensionar: atribuições a `canvas.width/height` (instrumentadas pelo `addInitScript`) com o mesmo tamanho (`resize` + `visualViewport`) e com um tamanho novo | mesmo tamanho: 0 (main: 8); tamanho novo: 2 (main: até 8) | sim |
| T | Teto: um `addInitScript` com um rAF falso a 90, 120, 144 e 165 Hz (o headless roda o rAF a 60); conta os desenhos pelo `renderer.info.render.frame` | celular: 90 / 60 / 72 / 82,5 por segundo ± 1, intervalos regulares; PC sem toque: sem teto | sim (desenha todos) |

**`teste-graficos-pagina`, medido na main (C3):** "forçado" é a carga com o MSAA pelo `addInitScript`.

| Sec. | Meta | Esperado na main | Medido na main | Fica |
|---|---|---|---|---|
| S2 | Sonda | true/4 | true/4 (MAX 4); sem pedir, 0 | estrutura (válido) |
| S2 | Celular 844×390 dpr 2, Média = 4 | reprova | 0 (1266×585) | vale |
| S2 | Tablet 1366×1024 com toque, dpr 2, Média = 0 | — (o teto) | 0 (2049×1536, 3,15 MP) | guarda |
| S2 | Tablet com `?aa=1` = 4 / PC 1280×720 Média = 4 | reprova | 0 / 0 | vale |
| A2 | Razão ≤ 0,6 (TV na bola / gol no foco) | reprova | 1,00 / 1,00 (forçado ×0,70 / ×0,55); máscara 1,41% / 0,97% | vale (na pose da bola, só o MSAA fica fora: 0,70; o C10 tem de baixar, senão a meta se revê no C14) |
| A2 | Carga oposta forçada; carga igual = o mesmo quadro | estrutura | `SAMPLES` 4; 0 px nos 3 quadros, o hash igual | estrutura |
| K | K1 franjas ≤ 0,2%: torcida (bola / gol no foco) | reprova | 1,83% / 0,73% (forçado) | vale |
| K | K1 franjas ≤ 0,2%: bandeiras (bola / gol no foco) | reprova (o N11) | 10,50% / 1,42% (forçado; a linha verde-clara da faixa da mureta) | vale |
| K | K1 franjas: placas (bola / gol no foco) | — | 0% / 0% em 1262 / 585 px de borda | guarda |
| K | K1 franjas: letreiro do pré-jogo | reprova | 0 px de borda (sem a A2C o MSAA não muda um `alphaTest`) | **informativa** (na main não mede nada; com a A2C do C10 vira guarda ≤ 0,2%) |
| K | K2 cobertura das bandeiras de mastro ≥ 0,8 do SSAA (50 m / 100 m) | reprova (as de longe) | 0,966 / 0,935 sem AA; forçado 1,006 / 1,004 | **informativa** |
| K | K3 A2C da torcida | informativa | sem AA: cobertura 0,926, cintilação ×1,32; forçado 0,987 e ×1,23 | informativa |
| P | Chamadas = ref; triângulos ≤ ref + 1% | guarda | 31; 91 524 | guarda |
| P | CPU p95 ≤ 6 ms e ≤ ref + 0,2 ms | guarda | 7 rodadas da main: 5,8, 6,2, 6,5 (C2); 6,6, 5,6, 5,4, 6,8 (C3). Mediana 6,2 (a ref), acima de 6 em 4 das 7. A 8ª, na branch com o mesmo código: 6,1 | o "≤ 6 ms" absoluto **informativo** (a base já passa dele: "Depende do dono" 30); o "nada pior" só pareado no C14 (base × branch na mesma rodada, mais janelas: ±0,7 ms entre rodadas > 0,2) |
| P | O desenho p95 (a parte JS do render, 120 quadros) | informativo | 10,5, 9,2, 12,8, 7,8 na main (C3) e 11,7 na branch com o mesmo código (C2: 6–7,6) | informativo. Também passa de 6 ms: "os 6 ms valem para o desenho" (a saída da P) só com mais quadros |
| P2 | `__golaco.perf()`; a fase no jogo | reprova | não existe | vale |
| P2 | O painel com p95, fase, AA, buffer, GPU e refresh | reprova | "60 qps · 16.7 ms / 25 chamadas · 91 mil tri / qualidade media" | vale |
| P2 | O painel por cima da tela antes do jogo / da pausa / no jogo, pausa e replay | reprova | escondido / escondido / no jogo à vista (67% por cima), na pausa e no replay escondido | vale |
| P2 | O qps da tela antes do jogo = os desenhos (N3) | reprova | mostra 60, desenhou 30,0 (×2,00) | vale |
| P3 | `?gfx=antigo`: `SAMPLES` 0 e o gramado = a ref | chave de volta | 0; L 0,586, C 0,127, h 134,4°, ΔL 0,097, 3 bordas, +0,0072, linha 0,909 (agora a ref) | guarda |
| P3 | `?tom=neutro`: Neutral e a exposição × 1,40 | — | ACES em todos; exposição 1,000 de dia e 0,980 à noite (meta 1,400 e 1,372), 2 recriações | vale (a main ignora o `?tom`) |
| R | R1 `SAMPLES` 4 → 0 → 4 | reprova | 0 → 0 → 0 (o mesmo canvas) | vale |
| R | R1 o `aria-label` e o `inert` depois das trocas | reprova | ficam (na main a troca Média ↔ Baixa NÃO recria: o AA é o mesmo) | guarda (prova de verdade quando o C5 fizer essa troca recriar) |
| R | R1 "Ajustando…" à vista e fora | reprova | visto 0× | vale |
| R | R1 / R4 a mira desenha depois | — | 3476 / 8697 px | guarda |
| R | R2 Alta → Baixa: o `localClippingEnabled` do vão e o `aria-label` | reprova | true → false; "Campo 3D" → null | vale |
| R | R3 troca e desenha no mesmo `evaluate`; R4 perde, restaura e desenha | estrutura | 96,0% / 96,1%; 94,4% não preto | estrutura |
| R | R3 `SAMPLES` pela tabela | reprova | 0 → 0 → 0 | vale |
| R | R4 os ganchos (A2C dos finos, `uAlturaBuffer`) | reprova | A2C false, sem `uAlturaBuffer` | vale |
| Q | A queda natural com webdriver: cai, NÃO grava, a recarga abre na Média | guarda | media → baixa em 173 quadros; preferências `{}`; media | guarda |
| Q | `quedaDeTeste()`; a recarga depois da queda gravada abre na Baixa | reprova | não existe; media | vale |
| Q | Escolher a Média apaga a queda | — | nada a apagar | guarda a partir do C12 (na main não há como medir) |
| Z | Mesmo tamanho 0; tamanho novo 2 | reprova | 8 (4 + 4); 8 | vale |
| T | Celular a 90 Hz = 90; PC a 144 Hz sem teto | — | 90,0; 144,0 | guarda |
| T | Celular a 120 / 144 / 165 Hz = 60 / 72 / 82,5 | reprova | 120,0 / 144,0 / 165,0 (regulares) | vale |

**O que o C3 mudou no plano:**
- **7 metas de melhoria viraram informativas** porque a main já as cumpre ou nelas não mede nada:
  - F, Baixa com MSAA: os buracos no foco e no gol de lá, e a cintilação no foco;
  - K2: a cobertura a 50 m e a 100 m;
  - K1: o letreiro;
  - P: o "≤ 6 ms" absoluto da CPU.
- **Riscos para os próximos commits** (contas de "forçado" acima):
  - o MSAA sozinho NÃO fecha a A2 na pose da bola (0,70) nem a cintilação dos finos da Média no foco (×1,74);
  - na A do foco, ele fecha com 0,02 de folga.
- **Pendente:**
  - a régua da foto da G6 em blocos de 8 m NÃO foi refeita. Fica o ponto de partida 0,010 ± 0,004, e a main sai fora dele por falta de mancha. Fechar no C6, que calibra o `uManchas` por ela, antes de a G6 valer no C14;
  - a CPU da P vai ao "Depende do dono" 30 (no C16).
- **A ref da `P.cpuP95` é a mediana das 7 rodadas, não a da rodada que gravou (6,6):**
  - as rodadas estão no campo `pagina.cpuBase` do JSON;
  - um novo `--gravar-referencia` troca pela da rodada.

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

  | Peça | Tamanho |
  |---|---|
  | `cena.js` | +~2 KB |
  | `campo.js` | +~3 KB |
  | `texturas.js` | +~1 KB |
  | `gramado.js` | ~3 KB |
  | `graficos-opcoes.js` | ~1 KB |
  | `ritmo-desenho.js` | ~1,5 KB |
  | `torcida.js`/`bandeiras.js`/`impostor.js` | +~1 KB |
  | `main.js`/`hud.js` | +~2,5 KB |
  | **Total** | ~**+15 KB** (folga ~565 → ~550 KB) |

  O `medidor-quadros.js` vai sob demanda (lista nova no `teste-carga.mjs`).
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
| `teste-camera-tela`, `teste-cenas-tela`, `teste-comemoracao-tela`, `teste-prejogo` (35 chamadas / 122 mil tri ≤ 40 / 130 mil), `teste-tecnicos-tela`, `teste-replay` (G1–G6 chamadas e CPU por plano), `teste-substituicao-tela`, `teste-replay-paradas-tela`, `teste-livre-tela`, `teste-prepartida-tela`, `teste-som-jogo` | abrem na Média: MSAA no SwiftShader = mais tempo; prints | chamadas +0; tempo no `tempos-ci`; `?aa=0` só se passar de +20% |
| `teste-hud-minimo` | o painel e o orçamento do HUD | nada visível sem F3/`?qps`/`?perf` |
| `teste-pausa-tela` | o texto da Média e a troca pelas Opções (agora com a tela "Ajustando…") | medir |
| `teste-carga` | download, lista sob demanda, hash Node = Chromium, 1º quadro | +~15 KB; a lista nova |
| `teste-desempenho-celular` (informativo) | CPU com `desenhar:false` | a mesma medida vira a meta P |
| `teste-laco` (Node) | o laço | nada (o teto fica fora do `quadro`) |
| `teste-tm-tela`, `legacy-total-match/ferramentas/testar-3d.mjs` (e `--publica`) | mexeu em `main.js`/`hud.js` (regra do CLAUDE.md); o 3D no iframe sem `?q` | rodar no fim; a queda natural não pode gravar com webdriver |

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
8. **Um celular que só segura 30 regulares** cai na sessão como hoje, mas não grava a queda (a regra do ritmo preso não distingue do iPhone em pouca energia). Vai ao "Depende do dono" 30.
9. **Pedir ao dono:**
   - 1 minuto com `?perf=1&aa=0` e `?perf=1&aa=1` num Android (Adreno ou Mali) e num iPhone, de dia, na partida;
   - o print do painel;
   - a impressão do gramado novo contra o `?gfx=antigo`.

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
