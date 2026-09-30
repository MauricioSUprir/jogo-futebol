# LANCE A LANCE — simulador de partidas

Simulador de partidas de futebol no navegador, no estilo da tela "Simular partida" dos jogos de
futebol: a bolinha corre no campo, você acompanha o lance a lance e comanda o seu time por botões
(velocidade, táticas, substituições). Todos os clubes, jogadores e escudos são **fictícios**.

**Jogar:** https://mauriciosuprir.github.io/jogo-futebol/simulador/ (atualiza depois do merge na `main`).

## O que tem

- **Partida rápida**: 12 clubes, escolha mandante/visitante e quem você comanda (ou só assista).
  Também dá para pedir só o "Resultado direto".
- **Campeonato** (Liga das Serras): turno único, 11 rodadas, tabela, artilharia e sequência. Salvo no
  aparelho (localStorage, com validação: dados corrompidos são descartados sem travar o app).
- **Durante o jogo**: 1×/2×/4×/8×, pausar, pular até o intervalo ou o fim; abas de Lances (narração),
  Estatísticas (posse, xG, finalizações, precisão de passe, cruzamentos, desarmes, mapas de calor),
  Momento (pressão minuto a minuto) e Times (energia e nota ao vivo de cada jogador).
- **Táticas**: 5 formações, mentalidade (5 níveis), pressão (3), ritmo (3) e 5 substituições.
  O time adversário tem um técnico da IA (troca cansados, muda a postura conforme o placar).
- **Visual**: "Completo" (22 jogadores) ou "Só a bola" (faixa na cor de quem ataca).
- **Qualidade**: Auto, Baixo, Médio, Alto e Ultra. O Auto escolhe pelo aparelho e desce um nível se o
  tempo de quadro (p95) passar do orçamento por mais de 3 s.
- Teclado (`Espaço`, `1`–`4`, `T`, `N`, `Esc`), gamepad (A, LB/RB, Y, X) e toque (botões ≥ 44 px).
- PWA: manifesto e service worker (rede primeiro, cache como reserva para abrir offline).

## Como o motor funciona (`js/engine.js`)

Passo fixo de 0,05 s. Cada tempo tem 300 s "físicos" que viram 45 minutos de relógio (fator 9), com
acréscimos calculados por gols, trocas e cartões.

- **Jogadores**: posição, velocidade com aceleração limitada, energia que cai com o esforço e reduz
  velocidade, aceleração e desarme. Formação vira um bloco que sobe/desce e fecha/abre conforme a
  bola e a posse; laterais sobem com mentalidade ofensiva; atacantes seguram a linha de impedimento e
  fazem corridas em profundidade; defensores marcam por zona pelo lado do gol.
- **Bola**: rola com atrito + arrasto, voa com gravidade e quica. Passes rasteiros saem a 9–23 m/s.
- **Decisão do portador**: compara chute (modelo de xG por distância/ângulo, pressão e habilidade),
  passes (risco de interceptação na linha do passe + pressão no recebedor), cruzamento, condução em 7
  direções, chutão e segurar. Valor posicional = ameaça (tipo xT) + progresso no campo.
- **Disputas**: desarme (defesa × drible/físico), faltas (mais com pressão alta e cansaço), cartões,
  pênaltis, impedimento no momento do passe, bolas paradas com posicionamento (escanteio, falta,
  lateral, tiro de meta, saída).
- **Determinístico**: mesma semente + mesmas ordens = mesma partida (RNG `mulberry32`).

Calibração (200 partidas, `node tools/stats-report.mjs 200`), comparada a ligas reais:

| por jogo | simulador | referência real aproximada |
|---|---|---|
| gols | 2,79 | 2,6–2,9 |
| finalizações | 21,1 | 24–26 |
| no alvo | 10,3 | 8–9 |
| faltas | 17,5 | 20–24 |
| amarelos / vermelhos | 3,3 / 0,15 | 3,5–4,5 / 0,1–0,2 |
| impedimentos | 3,9 | 3,5–4,5 |
| empates | 28% | 24–27% |
| precisão de passe | 71,8% | 78–84% |
| escanteios | 4,1 | 9–10 |

Desvios conhecidos: escanteios, cruzamentos certos (~7%) e pênaltis (~0,1/jogo) abaixo do real;
precisão de passe alguns pontos abaixo. Tudo é modelado; não são dados reais.

## Arquitetura

```
index.html, css/app.css, manifest.webmanifest, sw.js, icons/
js/config.js       constantes (campo, motor, formações, táticas, qualidade, orçamentos)
js/rng.js          RNG com semente
js/teams.js        clubes/elencos fictícios, escalação por encaixe na vaga, uniformes, escudos SVG
js/engine.js       motor da partida (puro, sem DOM: roda nos testes em Node)
js/commentary.js   narração
js/league.js       campeonato (tabela de jogos, classificação, artilharia, validação do salvo)
js/render.js       canvas 2D: gramado em cache, jogadores, bola com altura, rastro, efeitos, gráficos
js/match-view.js   tela da partida (laço, controles, abas, táticas, intervalo, fim)
js/screens.js      menu, partida rápida, campeonato, configurações, ajuda, diagnóstico
js/quality.js      detecção do aparelho, níveis e monitor de quadros (AUTO)
js/storage.js      salvamento com validação   js/log.js  registro de diagnóstico   js/audio.js  sons WebAudio
```

Sem etapa de build e sem dependências externas (nem fontes de CDN).

## Testes

```bash
cd simulador
node tools/engine-test.mjs          # ~1.770 verificações: RNG, times, invariantes passo a passo, determinismo,
                                    # táticas/substituições, estatística em lote, campeonato, qualidade AUTO
node tools/stats-report.mjs 200     # médias por jogo (calibração)
# navegador (servidor: python3 -m http.server 8791 nesta pasta)
node tools/ui-shot.mjs --out /tmp/lal            # percorre todas as telas e tira prints (desktop)
node tools/ui-shot.mjs --mobile --w 390 --h 844 --flow match
node tools/e2e.mjs                  # robustez: entradas rápidas, redimensionar, segundo plano, dados corrompidos, memória
node tools/perf.mjs                 # fps/tempo de quadro por nível de qualidade (use --mobile --cpu 4 para celular médio)
```

Medições no Chromium headless (renderização por software), partida em 8×:
desktop 1440×900 → 60 fps em todos os níveis (desenho 0,4–0,5 ms, motor 0,1–0,2 ms por quadro);
celular emulado 390×844 @3× com CPU 4× mais lenta → 60 fps em Baixo/Médio/Alto e 39 fps em Ultra
(por isso o AUTO não escolhe Ultra em celular). Ainda não medido em aparelhos físicos.
