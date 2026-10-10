# Análises da pesquisa (Etapa 3)

Scripts das análises próprias sobre o rastreamento aberto da Metrica Sports
(<https://github.com/metrica-sports/sample-data>, Sample Game 1 e 2, 25 Hz), citadas em
`PESQUISA-ETAPA3.md`. As medidas dos testes da partida (`tools/lib/partida-medidas.mjs`) usam as
mesmas definições.

- `analise_metrica.py` — 1ª análise ("rascunho" na pesquisa): forma, intensidade, pressão, apoio,
  corredores, corridas sem bola e deslocamento do bloco com a bola.
- `tatica_metrica.py` — 2ª análise: posição média por função (com/sem bola, por terço), linha de 4,
  linha de impedimento, pressionadores, contrapressão, cruzamentos, PPDA aproximado e disputa aérea.

Uso (Python 3 com numpy e pandas; os CSV da Metrica numa pasta):

```bash
python3 -I tools/pesquisa/analise_metrica.py <pasta-com-os-csv>
python3 -I tools/pesquisa/tatica_metrica.py <pasta-com-os-csv> <saida.json>
```

A pasta `tools/` não vai para o site.
