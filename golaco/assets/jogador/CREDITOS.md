# Créditos do corpo dos jogadores (`assets/jogador/`)

Todo arquivo desta pasta tem a origem e a licença aqui (o `tools/teste-creditos-jogador.mjs` confere). Só entram
dados CC0, CC BY ou de uso livre equivalente. Fora, sempre: Mixamo (Adobe), LAFAN1 (Ubisoft), Bandai Namco, modelos do
Sketchfab (jogadores reais), a cabeça escaneada Lee Perry-Smith (pessoa real) e o CÓDIGO do MPFB2 (GPLv3). Nada da
pasta `futebol3d/`.

| Arquivo | O que é | Origem | Licença |
|---|---|---|---|
| `corpo.bin` | Corpo humano masculino com 22 ossos (+ 8 auxiliares de joelho e cotovelo), 3 níveis de detalhe (8000 / 2000 / 1000 triângulos), pesos de pele e as regiões do uniforme; formato próprio lido por `js/render/corpo-leitor.js` | Gerado por `tools/humano/gerar-corpo.mjs` a partir dos **dados** do MakeHuman / MPFB2 (commit `d0a32e5`): malha base `3dobjs/base.obj` (hm08), alvos `targets/macrodetails/{african,asian,caucasian}-male-young.target.gz`, esqueleto `rigs/standard/rig.mixamo.json` (só as regras de onde fica cada junta) e pesos `rigs/standard/weights.mixamo.json` ("license": "CC0"). Ajustado às proporções da simulação do jogo; decimado com o meshoptimizer (MIT, só na ferramenta) | **CC0 1.0** (MPFB2 `LICENSE.md`, seção C: "The base mesh and proxies, Targets and modifiers, ... Rigs, poses and expressions ... have been released under CC0 1.0 Universal"; seção D: o que sai do MPFB é do usuário). Créditos (opcionais no CC0): MakeHuman Team, Data Collection AB, Joel Palmius, Jonas Hauquier |
| `CREDITOS.md` | Este arquivo | — | — |

O nome "mixamo" do esqueleto do MPFB2 é só uma convenção de nomes de ossos: nenhum arquivo do serviço Mixamo da Adobe
foi usado. Nenhuma linha de código do MPFB2 entra no jogo nem na ferramenta: o script lê os dados (OBJ, JSON e alvos)
por conta própria.
