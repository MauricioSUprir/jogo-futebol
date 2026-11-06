# Total Match no GOLAÇO (?tm)

Arquivos usados só no modo `?tm` (css/tm.css, js/tm-cara.js); sem `?tm` nada daqui é baixado, menos as fontes da pausa (a Inter TM
400/600/800 e a TM Cond, sob demanda) e o que a tela antes do jogo e a escalação usam.

- `logo.png` e `simbolo.png`: a logo do Total Match (`legacy-total-match/assets/logo.png`, do dono), recortada sem a margem
  (480 px com o "TOTAL MATCH"; 200 px só o "TM").
- `fontes/inter-*.woff2`: Inter (SIL Open Font License 1.1, `fontes/LICENCA-Inter-OFL.txt`), as mesmas do Total Match
  (`legacy-total-match/assets/fontes/`).
- `fontes/tmcond-600-latin(-ext).woff2` e `fontes/tmcond-800-latin(-ext).woff2`: Barlow Condensed SemiBold (600) e ExtraBold
  (800), de Jeremy Tribby (SIL Open Font License 1.1, `fontes/OFL-barlow-condensed.txt`), baixadas da API css2 do Google Fonts
  (`fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800`, subconjuntos latin e latin-ext, sem mudança; o 800 é o
  mesmo arquivo do Total Match, `legacy-total-match/assets/fontes/barlow-condensed-*`). No jogo a família se chama "TM Cond"
  (`css/estilo.css`, o `--f-disp` do item 125: títulos, itens de menu, números, nomes e siglas). A 800 entrou com a escalação do
  pré-jogo (item 29) e a 600 com o sistema tipográfico do item 125; elas valem também sem `?tm` (baixam sob demanda, fora do
  download inicial: `tools/teste-carga.mjs`).
