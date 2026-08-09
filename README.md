# ⚽ Total Match

Jogo de futebol com foco em **simulação e gestão** (sem jogabilidade 3D estilo FIFA),
desenvolvido com **HTML, CSS e JavaScript** puros. Projeto pessoal.

**Cores:** preto + dourado, com um toque leve de verde.

## 🎮 Modos planejados

- **⚡ Partida Rápida** — simulação de uma partida avulsa.
- **🎯 Carreira de Treinador** — escolher clube (várias ligas) e/ou seleção, comandar
  o elenco, fazer trocas, central do elenco, disputar copas.
- **⭐ Carreira de Jogador** — criar seu jogador (foto, país, nascimento, altura, peso,
  clube inicial) ou assumir um existente; propostas, metas, eventos, agente e convocações.
- **⚙️ Configurações** — dificuldade, realismo, tempo de jogo e outros ajustes.

## ▶️ Como rodar

Abra o `index.html` no navegador. Não precisa instalar nada.

## 📁 Estrutura

```
index.html          carrega os scripts e a tela inicial
css/styles.css      identidade visual (preto/dourado/verde)
js/
├── rng.js           gerador aleatório determinístico (mundo estável)
├── data.js          geração do mundo: 10 ligas, ~3.600 jogadores, 48 seleções
├── placeholders.js  escudos/fotos/bandeiras gerados por código (SVG)
├── storage.js       salvamento local (configurações e carreiras)
├── engine.js        motor de simulação (gol, pênalti, cartões)
├── matchview.js     transmissão imersiva ao vivo (tempo correndo)
├── competitions.js  liga + copa nacional + continental, calendário e chaves
├── ui.js            interface, roteador, splash e menu lateral
├── settings.js      modo Configurações
├── quick.js         modo Partida Rápida
├── coach.js         modo Carreira de Treinador (+ mercado/negociação)
├── player.js        modo Carreira de Jogador
└── app.js           inicialização
assets/             imagens reais (opcionais) — veja assets/README.md
data/               dados extras — veja data/README.md
```

## 🖼️ Adicionando imagens ("licenciamento")

O jogo funciona 100% sem imagens (usa placeholders gerados). Para colocar uma imagem
real, basta soltar o arquivo na pasta certa com o **id** do item:

```
assets/clubes/<id-do-clube>.png     ex: assets/clubes/br-0.png
assets/jogadores/<id-do-jogador>.png ex: assets/jogadores/p123.png
assets/selecoes/<id-da-selecao>.png  ex: assets/selecoes/nat0.png
```

## 🗺️ Roadmap

- [x] **Etapa 1** — Tela de entrada (splash) + menu de modos
- [x] **Etapa 2** — Base: geração do mundo, placeholders, salvamento, motor de simulação
- [x] **Etapa 3** — ⚡ Partida Rápida (com narração ao vivo e estatísticas)
- [x] **Etapa 4** — 🎯 Carreira de Treinador (liga, tabela, elenco, mercado)
- [x] **Etapa 5** — ⭐ Carreira de Jogador (criação, notas, propostas, metas, convocações)
- [x] **Etapa 6** — ⚙️ Configurações (dificuldade, realismo, tempo de jogo)
- [x] **Etapa 7** — 🎥 Simulação imersiva (tempo correndo, gols/pênaltis/cartões ao vivo)
- [x] **Etapa 8** — 🏆 Campeonatos na carreira: Liga + Copa nacional + Continental (Libertadores/Champions)
- [x] **Etapa 9** — 💼 Mercado com busca e negociação (com o clube e com o jogador)
- [x] **Etapa 10** — 🎨 Novas telas iniciais (emblema + menu lateral)
- [ ] **Próximo** — Fase de imagens ("licenciar"): adicionar fotos de clubes, seleções e jogadores
- [ ] **Futuro** — Campeonatos também na Carreira de Jogador; Copa do Mundo; táticas avançadas
