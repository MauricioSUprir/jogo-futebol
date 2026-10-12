# Etapa 5 — jogadores de verdade (corpo, rosto e movimento): pesquisa

A Etapa 5 troca o manequim de cápsulas por um corpo humano inteiro. **A jogabilidade não muda**: o corpo só VESTE a pose
de 19 juntas que `anim.js` já calcula (a simulação dá o mesmo hash). Cada PR traz aqui as fontes e o que aproveitamos de
cada uma. Plano completo (5.1 a 5.7): no histórico da sessão; o contrato fica em `CONTRATOS.md` ("Etapa 5.1").

## 5.1 — corpo humano no lugar do manequim (atrás de `?corpo=novo`)

### Fontes e o que aproveitamos

| Fonte | O que aproveitamos |
|---|---|
| **MakeHuman / MPFB2, DADOS** (commit `d0a32e5`; `LICENSE.md` seção C: malha base, alvos, esqueletos e pesos em CC0 1.0). O código do MPFB2 é GPLv3 e **não** foi usado nem lido: o `tools/humano/gerar-corpo.mjs` lê os arquivos de dados por conta própria. | A malha base `hm08` (`3dobjs/base.obj`, 13 380 vértices, decímetros, Y para cima, +Z para a frente, +X = esquerda do personagem); o físico "homem jovem" pela média dos alvos `macrodetails/{african,asian,caucasian}-male-young` (1/3 cada); as regras de onde fica cada junta (`rigs/standard/rig.mixamo.json`: média de vértices ou centro da caixa de um grupo); os pesos de pele (`weights.mixamo.json`, 52 ossos → os 22 do jogo: dedos da mão somam na mão, topo da cabeça na cabeça). O nome "mixamo" é só a convenção dos nomes dos ossos: nada do serviço Mixamo da Adobe. |
| **meshoptimizer 0.22.0** (MIT; só na ferramenta, nunca no jogo) | `simplifyWithAttributes` com a normal e os pesos dos ossos como atributos (a decimação não come as juntas) e borda travada: os 3 níveis (8000 / 2000 / 1000 triângulos) **dividem os mesmos 4006 vértices** — um buffer de vértices só, três faixas do índice. |
| **three.js 0.170** (MIT): `SkinnedMesh`, `Skeleton`, os pedaços `skinbase_vertex` / `skinnormal_vertex` / `skinning_vertex` e o `WebGLShadowMap` | A conta da pele é a MESMA do `SkinnedMesh` (soma dos 4 ossos × peso, normal pela mesma matriz), trocando só DE ONDE vem a matriz: a textura de ossos de todos os jogadores (uma linha por jogador). O `teste-pele` compara pixel a pixel com o `SkinnedMesh` de verdade (0 pixel com diferença > 8 em 9 imagens). Achado da régua: no `WebGLRenderer.render` do 0.170 a ordem é `info.render.frame++` → `shadowMap.render(...)` → `info.reset()` (com `autoReset`) → passe principal, então a passada da sombra nunca apareceu na medida (3 chamadas e ~52 mil triângulos do manequim que ninguém via): o `render/cena.js` embrulha o `shadowMap.render` e guarda a diferença (`infoSombra()`), e os ganchos `onBeforeRender`/`onBeforeShadow` de cada malha dos jogadores contam o que é deles (`criarMedida`, pelo `info.render.frame`); `onBeforeShadow`/`onAfterShadow` (r163+) trocam a faixa do índice para o nível leve só na sombra. |
| **NVIDIA GPU Gems 3, cap. 2, "Animated Crowd Rendering"** (Bryan Dudash) | Multidão com pele numa chamada: as matrizes dos ossos numa textura, 3 texels por osso (matriz 3×4), e o número da instância escolhendo a linha. Aqui: textura RGBA32F de 91 texels por jogador (30 ossos × 3 + 1 texel com o tom de pele e o uniforme), lida com `texelFetch` no vertex shader. |
| **Daniel Holden, "Simple Two Joint IK"** (theorangeduck.com) | O ajuste final (IK de duas juntas pela lei dos cossenos, plano da dobra pelo joelho/cotovelo da pose) que prende o tornozelo, a ponta do pé e as mãos no ponto exato da simulação depois do retarget por direção. |
| **Mohr e Gleicher, "Building Efficient, Accurate Character Skins from Examples"** (SIGGRAPH 2003) e **Kavan et al., "Skinning with Dual Quaternions"** (I3D 2007) | Por que a pele linear "murcha" na junta dobrada (entre dois ossos girados de θ a pele fica com cos(θ/2) da largura) e a saída barata dos jogos: **ossos auxiliares** ("helper joints") na junta. Aqui: 2 por joelho e 2 por cotovelo, girando 1/3 e 2/3 da dobra, com pesos em rampa e um leve inchaço na largura (`INCHA` 0,07 × (1 − cos) da dobra). Medido no cilindro de teste: ideal 99,8% do volume, pele linear 66,9%, com os auxiliares 93,2%; no corpo, o pior caso a 120° ficou em 86,6% (meta ≥ 85%) e 0 triângulo virado. |
| **Documentação do V8** (números em "caixa": `HeapNumber`) | O custo de "não alocar": um número com casas decimais passado ou devolvido entre funções que o otimizador não juntou vira um objeto na memória. O esqueleto faz as contas num vetor de rascunho (`Float64Array` do módulo) e nenhuma função recebe/devolve número solto: 25 corpos em 0,12 ms por quadro e 0 coleta de lixo (medido direto no espaço novo do V8: 2,9 KB em 20 000 quadros, do próprio medidor). |
| **Protótipo próprio** (antes do 5.1, na pesquisa do plano) | Um `SkinnedMesh` por jogador custou 51 chamadas e travou o desenho por 175–637 ms (compilação); o corpo do protótipo (decimado sem proteger as juntas, esqueleto em pose T sobre a malha em pose A) quebrava o cotovelo: virou o CONTROLE do `teste-corpo-arquivo` (reprova: 0% de volume no cotovelo, 7 triângulos virados). |

### Decisões do 5.1 (e o porquê)
- **Pernas iguais às da simulação** (coxa 0,45, canela 0,45, quadris a ±0,09, ponta do pé 0,17 à frente e 0,055 abaixo do
  tornozelo, sola 0,08 abaixo): o corpo é ajustado à pose de repouso da simulação por mapas por osso (translação + escala
  no eixo; o pé com escala vertical 0,08/altura do tornozelo), misturados pelos pesos. Altura final 1,78 m.
- **Retarget por direção, não por ângulo**: cada osso aponta da junta de cima para a de baixo da pose (o tronco pelos
  pontos exatos da pose com escala no comprimento; a clavícula sai do eixo do tronco a 7/13 do caminho peito → pescoço com
  0,19 de comprimento, o que põe o ombro exato); braço e pescoço esticam até ±10% / −10…+15% para seguir a pose (a pose
  não tem ossos rígidos: peito → ombro varia de 0,177 a 0,225 m); o pé estica até 15% e os dedos dobram até 75°.
- **Fidelidade medida só nas poses do passo** (as interpoladas entre dois passos não são poses de verdade: o joelho
  "pula" de um passo para o outro quando a passada troca de fase); o pé apoiado é medido em TODOS os quadros (a 240 qps).
- **Uniforme provisório pintado por pixel** a partir da posição de REPOUSO do vértice (a região não escorrega com a
  pele): camisa, manga (comprida + luva no goleiro), calção, meião com faixa, chuteira, sola, gola em anel, olhos. As
  cores são as de hoje (`KITS`). Cabelo = a calota de hoje presa no osso da cabeça.
- **Nível de detalhe pela altura na tela** (px físicos) com histerese de 15% e um teto de triângulos por qualidade
  (Baixa 25 mil, Média 50 mil, Alta 120 mil; os menores na tela perdem detalhe primeiro). A sombra usa sempre o leve.

### O que ficou de fora (honesto)
- **Palmas do lateral a ≤ 2 cm da bola**: o corpo segue a pose (0,00 mm das mãos da simulação), mas a POSE deixa a
  palma até ~3–6 cm da superfície da bola no fim do arco (o braço da simulação, 0,29 + 0,26, não alcança). É conta da
  animação (`anim.js`), não do corpo: proposta para o 5.6 (ombro que sobe no arremesso, sem mudar a simulação).
- **Ponta do pé em poses degeneradas**: em ~2 a 27 quadros por execução o goleiro deitado tem o pé da pose encolhido a
  8,6–10,5 cm (a trava da ponta no chão da animação); o corpo não encolhe o pé abaixo de 13,5 cm e erra ali até ~5–7 cm
  na ponta. Saem como INFO no `teste-esqueleto`.
