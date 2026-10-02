# Instruções do projeto (lidas em toda sessão)

Repositório com vários projetos. Os estáticos (sem build) são publicados pelo GitHub
Pages a cada merge na `main` (ver `.github/workflows/deploy-pages.yml`). O CreateFlow
(Next.js, raiz) é hospedado à parte.

## Preferências do dono
- Tudo em **português do Brasil**: textos da interface, comentários e mensagens de commit.
- Sempre mandar o **link do jogo/app** (GitHub Pages) fora do artifact, e **prints** a cada etapa.
- Testar antes de avançar; corrigir todo bug encontrado.
- Fluxo de entrega: branch → PR → merge na `main` (o link só atualiza depois do merge).
- Times, jogadores, marcas e anúncios dos jogos são **fictícios** (nada licenciado).
- **Falar sempre em português**, inclusive nas mensagens de andamento.
- **Sempre dar estimativa de tempo** ao começar uma tarefa e **atualizá-la** a cada
  mensagem de andamento (ex.: "faltam ~40 min").

## GOLAÇO (`futebol3d/`) — futebol 3D
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

### Testes (rodar antes de todo commit do futebol3d)
```bash
cd futebol3d
node tools/test-ball.mjs && node tools/sim-test.mjs 3 none && node tools/sim-test.mjs 3 home \
  && node tools/shootout-test.mjs && node tools/pen-test.mjs && node tools/offside-test.mjs \
  && node tools/tournament-test.mjs
# navegador (servidor: python3 -m http.server 8790 em futebol3d/):
node tools/load-check.mjs && node tools/game-shot.mjs --advance 20
```
O Chromium headless não passa pelo proxy: os testes usam `tools/cdn-route.mjs`
(cache via curl) para o jsdelivr e o Google Fonts.
