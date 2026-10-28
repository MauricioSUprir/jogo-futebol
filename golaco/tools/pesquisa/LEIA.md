# Análises da pesquisa (Etapa 3)

Scripts das análises próprias sobre o rastreamento aberto da Metrica Sports
(<https://github.com/metrica-sports/sample-data>, Sample Game 1 e 2, 25 Hz), citadas em
`PESQUISA-ETAPA3.md`. As medidas dos testes da partida (`tools/lib/partida-medidas.mjs`) usam as
mesmas definições.

- `analise_metrica.py` — 1ª análise ("rascunho" na pesquisa): forma, intensidade, pressão, apoio,
  corredores, corridas sem bola e deslocamento do bloco com a bola.
- `tatica_metrica.py` — 2ª análise: posição média por função (com/sem bola, por terço), linha de 4,
  linha de impedimento, pressionadores, contrapressão, cruzamentos, PPDA aproximado e disputa aérea.
- `apoio_metrica.py` — D7 (item 24; `PESQUISA-CATEGORIA-D.md` §9): o "à frente / de lado / atrás" do
  teste-apoio por faixa de 10 m do portador, quem conduz em cada faixa e a posição de cada função em
  relação a quem conduz; a saída JSON é a tabela `METRICA` de `tools/apoio-faixa.mjs` (o mesmo no jogo).
- `intensidade_metrica.py` — D8 (item 25; `PESQUISA-CATEGORIA-D.md` §10): os m/min por jogador de
  linha no jogo organizado e nos lances rápidos com a definição do `teste-intensidade`, por jogo e por
  janela de 15 min (o p90 é o teto da meta).

- `soccernet_situacao.py` — replays nas paradas (28/10; `PESQUISA-CENAS-TV.md` §4 "Por situação"): nos rótulos
  públicos do SoccerNet-v2 (SoccerNet/SN-Labels: `Labels-v2.json` + `Labels-cameras.json` de cada jogo), a fração das
  paradas com replay por recomeço × cartão × chute nos 15 s antes — a tabela `TV_SIT` do `teste-replay-paradas` (P3).
  Só a biblioteca padrão: `python3 -I tools/pesquisa/soccernet_situacao.py <pasta com os jogos>`.

- `soccernet_duracao.py` — quanto dura o replay da TV nas paradas (28/10; `PLANO-CENAS.md` §2.7, o orçamento do ar):
  nos mesmos rótulos, a soma dos planos de replay de cada parada com replay, por recomeço × situação. Só a biblioteca
  padrão: `python3 -I tools/pesquisa/soccernet_duracao.py <pasta com os jogos>`.

Uso (Python 3 com numpy e pandas; os CSV da Metrica numa pasta):

```bash
python3 -I tools/pesquisa/analise_metrica.py <pasta-com-os-csv>
python3 -I tools/pesquisa/tatica_metrica.py <pasta-com-os-csv> <saida.json>
python3 -I tools/pesquisa/apoio_metrica.py <pasta-com-os-csv> [saida.json]
python3 -I tools/pesquisa/intensidade_metrica.py <pasta-com-os-csv>
```

A pasta `tools/` não vai para o site.
