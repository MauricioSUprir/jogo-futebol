# data/

Aqui ficam os **dados do jogo** em arquivos JSON (ligas, clubes, seleções, jogadores).
A ideia é separar dados de código: você edita/adiciona aqui sem mexer na lógica.

Estrutura planejada (será criada nas próximas etapas):

```
data/
├── ligas.json        lista de ligas
├── clubes.json       clubes + qual liga + escudo (assets/clubes/...)
├── selecoes.json     seleções + bandeira (assets/selecoes/...)
└── jogadores.json    jogadores + atributos + foto (assets/jogadores/...)
```

Exemplo de como um clube vai se ligar a uma imagem:

```json
{
  "id": "rio-atletico",
  "nome": "Rio Atlético",
  "liga": "liga-brasil",
  "escudo": "assets/clubes/rio-atletico.png"
}
```
