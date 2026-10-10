# Sons do GOLAÇO — fontes, autores e licenças

Todos os sons são gravações de verdade com licença livre (nada licenciado de jogo/clube/liga). Os recortes,
laços e o nível foram feitos por `tools/sons/fazer_sons.py` (mono, 44,1 kHz, MP3 56–64 kbps; laços com
cruzamento de potência igual e 0,25 s de margem periódica dos dois lados — o jogo toca de `loopInicio` a
`loopFim`, ver `js/render/som.js`) e conferidos por `tools/sons/conferir_laco.py` (emenda sem estalo depois do
MP3). As gravações originais não ficam no repositório (baixar pelos endereços abaixo).

| Arquivo | Trecho usado | Fonte | Autor | Licença |
|---|---|---|---|---|
| `torcida-ambiente.mp3` (laço de 18 s) | 21–41 s | "Football Austria vs. Sweden" — torcida no estádio Ernst Happel (Viena), eliminatória da Eurocopa | Work With Sounds / Torsten Nilsson | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `torcida-agito.mp3` (laço de 13 s) | 77–92 s | idem | idem | CC BY 4.0 |
| `torcida-canto.mp3` (laço de 14 s) | 188,5–204,5 s | idem (trecho com a torcida cantando junto) | idem | CC BY 4.0 |
| `torcida-uuuh.mp3` | 57,7–66,5 s | idem (reação a um lance perigoso) | idem | CC BY 4.0 |
| `torcida-gol.mp3` | 5,3–22,5 s (a partir da subida: o grito já sai alto) | "Free Crowd Cheering Sounds" — 03 "Strong cheering - I" | Gregor Quendel (gregorquendel.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `torcida-palmas.mp3` | 1,2–12,8 s | "Free Crowd Cheering Sounds" — 06 "Soft cheering - II" | Gregor Quendel | CC BY 4.0 |
| `apito.mp3`, `apito-intervalo.mp3`, `apito-fim.mp3` | o sopro inteiro; o sopro longo estica o meio (0,15–0,45 s) | "Referee's whistle blowing inside a gymnasium" (freesound 218318) | SpliceSound | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Endereços das gravações originais:
- Work With Sounds: <https://commons.wikimedia.org/wiki/File:WWS_FootballAustriavs.Sweden.ogg> (origem: workwithsounds.eu, "Football Austria vs Sweden").
- Gregor Quendel: <https://opengameart.org/content/free-crowd-cheering-sounds>.
- SpliceSound: <https://commons.wikimedia.org/wiki/File:218318_splicesound_referee-whistle-blow-gymnasium.wav> (origem: freesound.org/people/SpliceSound/sounds/218318).

Alterações (CC BY exige dizer): recorte, mistura para mono, laço com cruzamento, nível normalizado, apito
repetido/esticado, conversão para MP3.

Sons feitos por código (Web Audio, sem arquivo): o "chuá" da bola na rede e a batida do chute (ruído filtrado
com envelope curto) — `js/render/som.js`.
