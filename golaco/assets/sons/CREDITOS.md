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
| `torcida-canto-a.mp3` (laço de 22 s; canto geral e do setor visitante) | 16–40 s | "Milan Derby (Milan vs Inter) at San Siro Stadium (48khz/24Bit)" (freesound 424354) | neilraouf | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `torcida-canto-b.mp3` (laço de 24 s; canto de incentivo, organizada com bateria) | 9,5–35,5 s | "TRATADA190127_0789 organizada 4" (freesound 503091) | Bruna32U | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `torcida-canto-c.mp3` (laço de 26 s; canto de festa depois do gol) | 99–127 s | "TRATADA190127_0790 organizada já ganhou" (freesound 503094) | Bruna32U | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `torcida-batucada.mp3` (laço de 42 batidas = 16,4 s; 153,6 batidas/min) | 18–36,4 s | "batucada_carnival_Berlin.wav" (freesound 74720) | reinsamba | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `torcida-uuuh-2.mp3` | 29,6–40,2 s | "Crowd yelling huuuuu (60k persons) during a soccer game in Brazil" (freesound 612131) | felix.blume | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `torcida-vaia.mp3` | 1–12,5 s | "JM_AMB_INT_Crowd Sport 01 - Booing" (freesound 557189) | Julien_Matthey | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Os sons da festa (cantos, batucada, segundo "uuuh" e vaia; pedido de 11/10) foram montados por
`tools/sons/fazer_sons_festa.py` a partir das prévias do freesound (mesma licença do original): mono 44,1 kHz,
MP3 48 kbps, −16 LUFS (EBU R128) sem passar de −1 dBFS de pico — o LUFS final de cada arquivo fica em
`js/render/som.js` (`SOM.arquivos[*].lufs`) e o jogo nivela tudo para −16 LUFS na mixagem (os três laços antigos
também: −20,9/−20,2/−20,0 LUFS medidos). Conferidos com transcrição automática (faster-whisper): nenhuma
narração nem fala inteligível (nada de nome de clube, jogador ou palavrão). Nada da BBC (licença RemArc só para uso
pessoal/educacional) nem do pacote Sonniss (proíbe redistribuir o som solto).

Endereços das gravações originais:
- Work With Sounds: <https://commons.wikimedia.org/wiki/File:WWS_FootballAustriavs.Sweden.ogg> (origem: workwithsounds.eu, "Football Austria vs Sweden").
- Gregor Quendel: <https://opengameart.org/content/free-crowd-cheering-sounds>.
- SpliceSound: <https://commons.wikimedia.org/wiki/File:218318_splicesound_referee-whistle-blow-gymnasium.wav> (origem: freesound.org/people/SpliceSound/sounds/218318).
- neilraouf: <https://freesound.org/people/neilraouf/sounds/424354/>.
- Bruna32U: <https://freesound.org/people/Bruna32U/sounds/503091/> e <https://freesound.org/people/Bruna32U/sounds/503094/>.
- reinsamba: <https://freesound.org/people/reinsamba/sounds/74720/> ("batucada_carnival_Berlin.wav" by reinsamba, CC BY 4.0).
- felix.blume: <https://freesound.org/people/felix.blume/sounds/612131/>.
- Julien_Matthey: <https://freesound.org/people/Julien_Matthey/sounds/557189/>.

Alterações (CC BY exige dizer): recorte, mistura para mono, laço com cruzamento, nível normalizado, apito
repetido/esticado, conversão para MP3.

Sons feitos por código (Web Audio, sem arquivo): o "chuá" da bola na rede e a batida do chute (ruído filtrado
com envelope curto) — `js/render/som.js`.
