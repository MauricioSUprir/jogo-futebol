// Tempo de cada teste no CI, em segundos — só para dividir as listas em partes (lib/partes.mjs); não precisa ser
// exato, e um teste que não está aqui conta TEMPO_NOVO. Atualizar quando um teste mudar muito de tempo (os números
// saem do log do CI: "PASSOU  <nome>  (N s)").
// Node: chave = arquivo + argumentos (como na lista do rodar-testes.mjs); segundos de parede de cada teste no job
// testes-golaco do deploy da main aa16c901 (run 38805251165: 57 testes, 4 por vez numa máquina de 4 vCPU, 1685 s).
// Com a disputa da máquina inteira o número é só uma ordem de grandeza: os testes que abrem processos filhos
// (transicao, replay-anel, tecnicos, defesa-corrida) pesam mais do que ele diz, e o aereo-troca natural levou 913 s
// lá e 195 s na parte dele (PR #485). O ramo das "vagas" (teste em k processos, --par k) não muda a conta: o tempo
// aqui é o do teste inteiro.
export const TEMPO_NOVO = 60;
export const TEMPOS_NODE = {
  'teste-matdet.mjs': 2,
  'teste-bola.mjs': 1,
  'teste-determinismo.mjs': 3,
  'teste-entrada.mjs': 1,
  'teste-laco.mjs': 0.3,
  'teste-resposta.mjs': 4,
  'teste-conducao.mjs': 4,
  'teste-cortes.mjs': 30,
  'teste-perda.mjs': 27,
  'teste-patinacao.mjs': 14,
  'teste-inclinacao.mjs': 0.5,
  'teste-dominio.mjs': 41,
  'teste-recepcao.mjs': 25,
  'teste-protecao.mjs': 11,
  'teste-dribles.mjs': 1,
  'teste-conducao-curta.mjs': 160, // C1: parte C 12 → 48 partidas em 4 processos (12 em sequência levavam ~160 s no CI); estimado
  'teste-recomeco.mjs': 7,
  'teste-passes.mjs': 5,
  'teste-chutes.mjs': 90, // C2: + a barra cheia contra o goleiro realista da partida e (28/10) as metas em 9 sementes + o árbitro da curva de antes (solto, para o gol, ±17°: 1.280 chutes) + (29/10) a referência gravada da main (1.592 chutes) e o canto (232), ~2 s; medido 58–66 s aqui sozinho (era ~40)
  'teste-cavadinha.mjs': 107,
  'teste-goleiro.mjs': 6,
  'teste-mergulho.mjs': 110, // C3: + H (480 chutes de bola alta numa partida copiada) e I (540 lances: tronco fora da área, a saída no alto que falha, o goleiro atrás da bola); ~25 s a mais aqui sozinho (estimado ×3 no CI)
  'teste-aereo.mjs': 2,
  'teste-cabeceio.mjs': 70,
  'teste-treino.mjs': 14,
  'teste-goleiro-trava.mjs': 105,
  'teste-movimento.mjs': 41,
  'teste-movimento.mjs --modo partida': 150, // D5: entrou no CI (110 s aqui com a máquina dividida); C1: 32 sementes em 4 processos (estimado)
  'teste-custo.mjs': 15,
  'teste-partida.mjs': 84,
  'teste-editor.mjs': 16,
  'teste-taticas.mjs': 57,
  'teste-defesa-humano.mjs': 59,
  'teste-aereo-troca.mjs --so canhao': 125,
  'teste-aereo-troca.mjs --so natural': 913,
  'teste-transicao.mjs': 685,
  'teste-defesa-corrida.mjs': 449,
  'teste-intercepta.mjs': 560, // C1: parte A 12 → 96 partidas (10–18 s de CPU cada, 4 processos) + a parte B (~125 s de CPU); estimado
  'teste-rede.mjs': 1,
  'teste-rede-veu.mjs': 3,
  'teste-torcida.mjs': 10,
  'teste-replay-anel.mjs': 688,
  'teste-replay-paradas.mjs': 680, // 28/10: 24 → 48 partidas (localmente 623–640 s com 2 processos; as 24, 285–315 s)
  'teste-saot.mjs': 215,
  'teste-comemoracao.mjs': 294,
  'teste-substituicao.mjs': 69,
  // (23/10, PR 4: + a seção FIM, 56 fins de 2 × 0,3 min; localmente ~1 min a mais numa máquina sozinha)
  'teste-cenas.mjs': 150,
  // (22/10, estimado: 24 partidas em 4 processos, ~70 s numa máquina de 4 vCPU sozinha; no CI dividido, ~2–3×)
  'teste-lances-guarda.mjs': 200,
  'teste-tecnicos.mjs': 482,
  'teste-tecnicos.mjs --so-sinteticos --estresse': 103,
  'teste-impedimento.mjs': 156,
  'teste-faltas.mjs': 302,
  'teste-faltas-sentido.mjs': 330,
  'teste-parado.mjs': 7,
  // (24/10, D1: + os ramos de 3 s de M9–M11 e o M12; localmente 371 → 496 s com 3 processos numa máquina de 4 vCPU)
  'teste-pressao-humano.mjs': 420,
  // (24/10, D2: 12 partidas de 2 × 4 min + o portão + o bootstrap; localmente 65 s com 4 processos numa máquina de 4 vCPU
  // sozinha, 8 s dele no bootstrap. 25/10, D3: 24 partidas, a lógica instrumentada e a seção M; localmente ~200 s com 4
  // processos)
  'teste-ia-corre.mjs --sementes 8': 330,
  // (25/10, D3: 48 partidas de 4 min contra o espelho em 3 processos; localmente ~100 s)
  'teste-pressao.mjs --humano': 150,
  'teste-goleiro-regras.mjs': 146,
  'teste-goleiro-realista.mjs': 150, // (estimado: 8 sementes do canhão do goleiro em 4 processos, ~100 s na máquina de dev)
  'teste-bolas-paradas.mjs': 237,
  'teste-botoes.mjs': 95,
  'teste-cortejo.mjs': 4,
  'teste-prejogo-roteiro.mjs': 0.3,
  'teste-prejogo-roteiro.mjs --forma maracana': 0.3,
  'teste-identidade.mjs': 1,
  'teste-estadio-forma.mjs': 1,
  'teste-estadio-generico.mjs': 60,
  'teste-ossos.mjs': 25,
  'teste-lod-humano.mjs': 1,
  'teste-rostos-reais.mjs': 1,
  'teste-patrocinios.mjs': 1,
  'teste-ponte-tm.mjs': 21,
  'teste-disputa.mjs': 16,
  'teste-livre.mjs': 60,
  // online 1×1 (medidos aqui, máquina dividida; acertar pelo log do CI)
  'teste-math-proibido.mjs': 30,
  'teste-dois-humanos.mjs': 140,
  'teste-online.mjs': 30,
  // ainda fora da main (ramo golaco/dominio-sem-passar): 687 s num processo só no CI
  'teste-nao-passa.mjs': 687,
};
// Navegador: chave = arquivo; segundos de parede (um teste por vez), medidos no CI do PR #483 (run 38805241618).
export const TEMPOS_NAVEGADOR = {
  'teste-carga.mjs': 36,
  'teste-controles.mjs': 64,
  'teste-editor-tela.mjs': 51,
  'teste-estadio.mjs': 229,
  'teste-prejogo.mjs': 298,
  'teste-som-jogo.mjs': 105,
  'teste-rede-tela.mjs': 53,
  'teste-hud-minimo.mjs': 68,
  // (24/10, D1: + o C7, uma página até o impedimento do time 0, ~5300 passos; localmente 214 s com outra página junto)
  'teste-replay.mjs': 225,
  // medido aqui (máquina dividida, carga ~4 em 4 núcleos: 396 s, o online em tempo real ~285 s); acertar pelo log do CI
  'teste-replay-paradas-tela.mjs': 400,
  'teste-comemoracao-tela.mjs': 80,
  'teste-tecnicos-tela.mjs': 155,
  'teste-substituicao-tela.mjs': 164,
  // medido aqui (23/10, PR 4, máquina livre: 839 s — cartão 201 s, intervalo 68, pós-jogo 569) + o C12d, o I8b, o I13 e o I14
  // do #510 (mais 2 páginas, ~180 s); acertar pelo log do CI
  'teste-cenas-tela.mjs': 1020,
  'teste-penaltis-tela.mjs': 60,
  'teste-livre-tela.mjs': 120,
  'teste-online-tela.mjs': 160,
  'teste-corpo-tela.mjs': 150,
  'teste-desempenho-celular.mjs': 35,
};
