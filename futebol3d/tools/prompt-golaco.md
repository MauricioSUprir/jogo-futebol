# PROMPT — GOLAÇO (jogo de futebol 3D no navegador)

> Cole este texto inteiro numa IA de programação (ou num novo chat) para ela entender
> tudo o que já existe no GOLAÇO e continuar — ou refazer — com o mesmo padrão.

---

## 1. Quem sou eu e como quero que você trabalhe

- Fale **sempre em português do Brasil**: na interface, nos comentários do código, nas
  mensagens de commit e nas mensagens comigo.
- Quero um jogo de **qualidade profissional, nível EA FC / eFootball**, rodando no
  navegador, no **PC e no celular**.
- **Tudo fictício**: times, jogadores, escudos, estádios, patrocinadores e anúncios. Nada licenciado.
- Identidade visual: **preto e verde**.
- **Antes de mexer em jogabilidade, animação ou gráficos, pesquise** (artigos, GDC, docs do
  three.js, jogos de referência), diga o que aproveitou e **meça antes e depois** (números + prints/clipes).
- **Teste antes de entregar** e corrija todo bug encontrado.
- Sempre me mande **prints/clipes** de cada etapa e o **link do jogo** publicado.
- Dê **estimativa de tempo** ao começar e atualize a cada mensagem ("faltam ~40 min").
- Fluxo de entrega: branch → PR → merge na `main` → GitHub Pages atualiza o link.
- Só comece uma tarefa nova depois de terminar a atual.
- Pontos que eu já reclamei e que precisam de atenção sempre:
  - condução de bola **natural** (nada robótico; a bola tem que parecer estar com o jogador);
  - movimentação dos jogadores e animações;
  - comemoração do gol;
  - **jogador tem que ser um ser humano 3D realista inteiro** (corpo e cabeça com formato
    de verdade). Nada de foto "colada" em boneco geométrico;
  - rosto = **foto real (pessoa fictícia gerada por IA)** aplicada como pele da cabeça 3D,
    **nunca rosto desenhado por código**;
  - **desempenho**: o jogo não pode ficar lento nem travar no PC ou no celular.

**Link:** https://mauriciosuprir.github.io/jogo-futebol/futebol3d/
**Repositório:** `MauricioSUprir/jogo-futebol`, pasta `futebol3d/` (branch de trabalho `claude/football-game-3d-jsidcx`).

---

## 2. Tecnologia e regras de arquitetura

- **three.js 0.170** por importmap (jsdelivr), ES modules, **sem etapa de build**, arquivos
  estáticos publicados no GitHub Pages (`.github/workflows/deploy-pages.yml`).
- ~16.500 linhas de JS em `futebol3d/js/`.
- A **lógica de jogo não depende de three.js nem do DOM** e roda em Node nos testes:
  `ball.js`, `match.js`, `ai.js`, `gk.js`, `human.js`, `player.js`, `anim.js`.
- `anim.js` é **função pura do estado** (o replay depende disso).
- Coordenadas: x = comprimento (±52,5 m), z = largura (±34 m), y para cima;
  direção h → (cos h, 0, sin h). Simulação a 60 Hz (bola em sub-passos, 120 Hz).
- Desempenho: jogadores e torcida **instanciados** (poucos draw calls). A qualidade
  `baixa` tem que rodar em celular médio.
- Contratos entre módulos: `tools/CONTRACTS.md`; constantes em `js/config.js`.
- A pasta `tools/` não vai para o site (ferramentas, testes, pipelines de assets).

### Mapa dos módulos

| Arquivo | O que faz |
|---|---|
| `main.js` | laço do jogo, qualidade/resolução dinâmica, pós-processamento, câmeras da abertura e do gol, eventos → HUD/áudio |
| `match.js` | regras, fases (abertura, bola parada, jogo, gol, intervalo, prorrogação, pênaltis), posse, **condução**, chutes, desarmes, faltas, cartões, impedimento |
| `ball.js` | física da bola (arrasto, Magnus, vento, quique, rolagem, trave, rede) e previsão de trajetória |
| `player.js` | jogador: aceleração, inércia, fôlego, ações, pose (fase da passada, condução) |
| `ai.js` / `gk.js` | IA tática dos times e do goleiro; comemoração |
| `human.js` | controle humano: movimento, passes, chutes com força, drible, proteção, troca de jogador, `keepBall` e `autoReceive` |
| `anim.js` | esqueleto de 17 ossos, poses procedurais + **mocap** (corrida/caminhada/chute), IK dos pés, toque na bola |
| `players3d.js` | malha do jogador realista, skinning no shader, uniformes, números, escudo, patrocínio, rosto com foto, cabelo, LOD |
| `faces.js` | banco de rostos, escolha por tom de pele, retratos da escalação |
| `stadium*.js` | estádio: arquibancadas, estrutura, gramado, gols e redes, placas de LED, telões, refletores, céu, torcida, bandeiras, bandeirão, fotógrafos |
| `fx.js` | fogos, sinalizadores, fumaça, confete |
| `audio.js` | áudio 100% sintetizado: torcida, cantos com bateria, hino, apito, chute, trave, rede |
| `camera.js` | câmeras TV / Pro / Aérea, câmeras de cinema (replay, gol, comemoração) |
| `hud.js`, `menus.js`, `input.js` | placar, minimapa, escalação, menus, teclado/mouse/controle/toque |
| `tournament.js`, `teams.js` | Copa e Liga, 8 clubes fictícios com 18 jogadores cada |
| `mobilepost.js`, `motionblur.js`, `sunshadow.js` | pós leve para celular, desfoque de movimento, sombra do sol estável |

---

## 3. O que o jogo já tem

### Modos e regras
- **Amistoso**, **Copa GOLAÇO** (mata-mata, 8 clubes, prorrogação e pênaltis) e **Liga
  GOLAÇO** (turno único, tabela, artilharia), com progresso salvo no aparelho.
- Clubes: Atlético Serrano, Porto Aurora EC, AC Valdoria, FC Nordhafen, Real Monteluz,
  Ferroviário Ribeira, Unión Bahía Sur, Estrela do Cerrado (18 jogadores cada, uniformes, escudos).
- Regras completas: lateral, escanteio, tiro de meta, falta direta/indireta, pênalti, vantagem,
  amarelo/vermelho, impedimento no passe, recuo para o goleiro, acréscimos, intervalo,
  prorrogação, pênaltis alternados com morte súbita.
- Dificuldades (amador → lenda), tempo por tempo configurável, câmeras TV/Pro/Aérea,
  horário: tarde de sol, fim de tarde e noite de refletores.

### Jogabilidade
- Bola com física real a 120 Hz (Magnus, vento, quique, rolagem).
- Jogadores com aceleração, inércia, fôlego e colisão. Ações: passe, lançamento, cruzamento,
  enfiada, chute com força, colocado, cavadinha, voleio, cabeceio, drible com finta,
  proteção, desarme, carrinho.
- **Condução híbrida** (como nos jogos de console): uma "bola animada" sai do pé no toque,
  abre um pouco e volta ao pé no próximo toque (curva 4u(1−u)); a bola física é puxada para
  ela. O toque é sincronizado com a passada (o pé encosta na bola, ~2 cm). Toque de esforço
  nas viradas fortes. Na arrancada, a bola vai ~1 m à frente.
  Medidas: 2,7 toques/s; bola a ~0,6 m correndo; >1,2 m só 0,1% do tempo.
- O jogador controlado **não foge da bola** e vai sozinho ao encontro do passe.
- Domínio emenda na condução; o defensor rouba quando a bola está entre um toque e outro.
- IA tática: bloco que acompanha a bola, linha de defesa, pressão, cobertura, apoio,
  infiltração sem impedimento, decisão de passe/chute/drible por risco.
- Goleiro: posicionamento, saída 1×1, mergulho com alcance real, encaixe/rebote, cruzamentos, reposição.
- Equilíbrio medido: ~8 gols por partida IA × IA (`tools/gols-media.mjs`).

### Jogador 3D realista
- Corpo do **MakeHuman / MPFB 2 (CC0)** exportado do Blender (`tools/mpfb/exportar.py`) e
  montado em `tools/mpfb/montar.py` → `assets/jogador/mh.{json,bin}`. Físico de atleta
  (volume de músculo por osso), variações de etnia por morph, peles reais do MakeHuman
  (`peles.jpg`), cabelos (`cabelos.png`), sobrancelhas.
- Cabeça com a **forma do escaneamento 3D Lee Perry-Smith** (CC BY 3.0) e mapa de relevo da pele.
- **17 ossos com skinning no shader**, todos os 22 jogadores numa única malha instanciada;
  versão leve (LOD) no celular.
- Uniforme decidido por pixel: camisa (listras, faixas, gola V/careca/polo), calção, meião,
  chuteira, número nas costas e no calção, escudo e patrocinador fictícios, trama do tecido.

### Rostos
- Fotos de **pessoas que não existem**: retratos gerados por IA + banco SFHQ (CC0), 83 hoje.
- Pipeline: `tools/rostos/marcos_cabeca.py` acha 478 pontos (MediaPipe) na cabeça 3D;
  `tools/rostos/processar.py` **deforma cada foto por triângulos** até olhos, nariz, boca e
  mandíbula caírem no relevo da cabeça, **tira a luz lateral da foto** e monta o atlas
  `assets/rostos/rostos.jpg` + `rostos.json` (tom de pele, cor do cabelo, rosto por jogador).
- No jogo a foto é projetada de frente na cabeça; laterais/nuca com cor de cabelo/pele da
  própria foto; pescoço contínuo com a gola.
- **Pendente:** gerar 34 lotes de retratos uniformes pelo ChatGPT
  (`tools/rostos/pedido-chatgpt.txt`, pasta do Drive "GOLAÇO – rostos" → `brutos/gNN.png`).

### Animação
- Corrida, caminhada e chute com **captura de movimento real (CMU)**, retargetadas por
  `tools/mocap/retarget.py` → `assets/mocap/locomocao.json`, misturadas pela fase da passada.
- Demais ações (passe, cabeceio, carrinho, goleiro, giros, comemoração) ainda procedurais.

### Abertura, gol e apresentação
- **Cerimônia de abertura** (~36 s): times saem do túnel, caminham, **perfilam em frente à
  tribuna**, close nos jogadores, escalação no campinho com fotos, torcida, hino e cantos;
  qualquer botão pula.
- **Gol**: câmera lenta curta, autor corre para a torcida e faz gesto, abraço coletivo,
  câmera de mão, replay com câmeras de cinema (7,5 s).

### Estádio e torcida
- Arquibancadas, cobertura, refletores, vidros, placas de LED e telões animados, gols com rede física.
- **Torcida instanciada** que vibra: pula, levanta os braços, faz ola, reage a chance/gol/lamento,
  bandeiras, cachecóis, **bandeirão (tifo)**, sinalizadores e fumaça.
- **Fotógrafos 3D** atrás dos gols (coletes de imprensa, teleobjetivas, flashes).
- Gramado com padrão de corte, desgaste e texturas (ambientCG, CC0).

### Gráficos e desempenho
- Qualidades **baixa / média / alta / ultra** + automática com resolução dinâmica.
  - baixa: sem pós, cor no material, vinheta em CSS (celular);
  - média: um passe único leve (ACES, cor, nitidez, bloom em 1/4);
  - alta: bloom, sombra 2048, resolução até 1,5×;
  - ultra: + GTAO (oclusão), sombra 4096, até 2×.
- Sombra do sol estável, desfoque de movimento, PBR.

### Áudio (todo sintetizado em código)
- Torcida em camadas que reage aos lances, cantos com bateria e coro em loop, hino,
  "GOOOL" coletivo, vaias, aplausos, apito, chute, trave, rede, reverberação de estádio.

### Controles
- Teclado (WASD/setas, Shift corre, Espaço passe/pressão, K chute/carrinho, L longo,
  I enfiada, O colocado, P cavadinha, Q troca, F drible, E proteção, Esc pausa),
  controle (gamepad) e toque (joystick + botões que mudam no ataque/defesa).

---

## 4. Testes e ferramentas (rodar antes de todo commit)

```bash
cd futebol3d
node tools/test-ball.mjs && node tools/sim-test.mjs 3 none && node tools/sim-test.mjs 3 home \
  && node tools/shootout-test.mjs && node tools/pen-test.mjs && node tools/offside-test.mjs \
  && node tools/tournament-test.mjs
# navegador (servidor: python3 -m http.server 8790 em futebol3d/):
node tools/load-check.mjs && node tools/game-shot.mjs --advance 20
```

- Medidas: `tools/drible-medida.mjs`, `tools/dribble-nat.mjs`, `tools/keepball-test.mjs`,
  `tools/gols-media.mjs`, `tools/intro-test.mjs`.
- Clipes e prints: `tools/clip.mjs`, `tools/drible-clip.mjs`, `tools/face-shot.mjs`,
  `tools/intro-shot.mjs`, `tools/goal-clip.mjs`.
- O Chromium dos testes usa `tools/cdn-route.mjs` (cache do jsdelivr/Google Fonts).

---

## 5. Problemas conhecidos / o que ainda não estou gostando

1. **Desempenho no PC**: o jogo ficou lento/travando em alguns computadores (cena pesada:
   ~3 milhões de triângulos, torcida com 2 milhões, jogadores com 35 mil cada).
   Precisa de **perfilamento numa GPU real** e cortes de verdade (LOD da torcida, sombra dos
   jogadores com malha leve, impostores para torcida distante).
2. Teve **tela preta no PC** (NaN em shader espalhado pelo bloom/GTAO) — corrigido com
   proteções, mas precisa ser validado em placas diferentes.
3. **Abertura** só aparece direito se o jogo estiver rápido; com poucos quadros ela parecia
   travada (jogadores parados no túnel).
4. **Rostos**: ainda misturam bancos com luz diferente; faltam os 34 lotes do ChatGPT.
5. **Animações**: só corrida/caminhada/chute têm mocap; passe, cabeceio, carrinho, goleiro,
   giros e comemoração ainda parecem robóticos.
6. A sensação geral ainda não chega no nível de um jogo de console: preciso de mais
   naturalidade nos movimentos, peso, contato com a bola e apresentação de TV.

---

## 6. O que eu quero de você agora

Use tudo acima como base. Antes de mudar qualquer coisa:
1. Rode o jogo e os testes, **meça** (FPS por qualidade, triângulos, tempo por quadro) e me
   mostre prints.
2. Proponha um plano priorizado (desempenho primeiro, depois naturalidade dos movimentos,
   depois visual), com estimativa de tempo.
3. Execute uma etapa por vez, sempre medindo antes/depois e me mandando prints e o link.
