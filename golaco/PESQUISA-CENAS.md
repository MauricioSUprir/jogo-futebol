# Pesquisa — cenas de cartão, de fim de tempo e cortes de torcida e treinador no gol

Pedido do dono (12/10): "temos que ter cenas de final de primeiro tempo, final de segundo tempo, cartão amarelo (3 cenas
diferentes) e cartão vermelho (outras 3 cenas diferentes). Quando sai gol, pode ter cenas de torcida e treinador
comemorando." Contrato em `CONTRATOS.md` ("Cenas de cartão e de fim de tempo"); constantes em `js/config.js` (`CENAS`,
`CENA_CARTAO`, `CENA_FIM`, `COMEMORACAO.torcida`, `COMEMORACAO.treinador`).

## O que cada fonte deu ao jogo

| Fonte | O que foi aproveitado |
|---|---|
| US Soccer, *Guide to Procedures for Referees* (p. 38 e 43) | O árbitro chama o jogador, para a uma "distância razoável" (2,0–2,8 m, `CENA_CARTAO.arbitro.para`) e mostra o cartão com o braço reto acima da cabeça (`gCartao`: a mão ≥ 0,25 m acima do topo da cabeça, teste A); o cartão da vantagem sai na parada seguinte, mesmo que seja o fim do período (a fila: cartão antes do fim de tempo); na expulsão só recomeça depois que o jogador saiu (o laço parado até o fim da cena); no fim do jogo, apita e aponta o meio-campo (`gApito` + `gAponta` no plano `apito`) |
| Wikipedia, "Penalty card" | O cartão no alto olhando/apontando o jogador (a outra mão aponta o punido); no 2º amarelo, o amarelo de novo e depois o vermelho (`segundo`: amarelo 1,0 s → guarda → vermelho 1,2 s) |
| NSS Sports (fonte secundária) | Amarelo no bolso da frente da camisa (`gTiraAmarelo`), vermelho no bolso de trás do calção (`gTiraVermelho`) |
| IFAB, "Only the captain" (Leis 2025/26) | Só o capitão a menos de 4 m do árbitro nas cenas de reclamação (A1, V2: `CENA_CARTAO.ifab`, os outros vão a 5,4 m; teste A "IFAB"); o gesto de afastar (`gAfasta`: pulsos cruzados acima da cabeça e palmas empurrando) |
| IFAB, Regras 1, 5 e 12 | Apito no fim de cada tempo; o expulso deixa as imediações do campo (o plano `tunel` termina com z > 34); a área técnica (1 m de cada lado do banco e até 1 m da linha: o gancho do treinador fica dentro dela) |
| Lex et al. 2015 | Reclamar aumenta os amarelos: a reclamação é uma das três reações (A1) |
| Jordet e Lian (Copa 2022) | Linguagem corporal emocional — braços para cima de frustração, mãos na cabeça (A2) |
| Moll, Jordet e Pepping 2010 | Comemorar com os DOIS braços para cima (o fim com vitória: ≥ 3 vencedores com os dois pulsos acima da cabeça, teste C) |
| UEFA, Art. 50.04 (Nations League) e 53 (Champions League) | Cumprimentos no apito final: apertos de mão entre adversários e com o árbitro (teste C: ≥ 3 e ≥ 1) |
| Kolo Touré (2010) e Klopp | Aplaudir a própria torcida também na derrota e no empate (plano `aplauso`); socos no ar para a torcida (o treinador do gancho) |
| Tunnel cam do Man City (2015) e regras da Premier League 2025/26 | Reações no túnel no intervalo e no fim (plano `tunel`, com o vão das placas aberto); câmeras no gramado na comemoração |
| Ekin, Tekalp e Mehrotra (WO2004014061A2) e US8761260B2 | A reação e a torcida ANTES do replay; closes com planos de torcida entre eles (o corte da torcida no fim do abraço, antes da reação e do replay) |
| SoccerNet-v2 | 71% das transições são cortes secos e ~1 corte a cada 9 s; classes "Public" e "Close-up side staff" (todo plano novo é um corte seco pelo nome) |
| TUM (56 jogos) | A comemoração masculina dura quase 1 min na TV: os ~1,5 s a mais do corte da torcida cabem sem aumentar a cena |
| Diretor de Anfield ("fans on five", "manager on 13") | A ordem dos cortes no gol: torcida e depois treinador |
| Bob Fishman (CBS) | Contrapor vencedor e perdedor (planos `vencedor` e `perdedor` no fim) |
| Barça 6×1 PSG | Uma câmera de cada vez (um plano por vez; nada de tela dividida) |
| HBS, Copa 2026 | Câmeras de cinema para túnel, torcida e closes (lente fechada nos closes; ninguém de fora a menos de 4,6 m: `CENA_FIM.lenteLivre`) |
| UEFA, Guia de Iluminação 2024 | Torcida com ≥ 100 lux o tempo todo para os planos de reação: à noite o corte da torcida tem luma ≥ 60% da de dia (teste de tela 9) |
| Football365 | Não perder a saída por causa do replay (a ordem: comemoração → replay → cartão → saída) |
| EA FC 24/25/26 | Pular sem segurar ("Hold to Skip" desligado: um aperto novo depois de 0,5 s); pular a própria cena sem pular a próxima; "Celebration Camera Focus" (o gol da IA contra o humano continua curto, sem torcida) |
| EA FC 26 e FIFA 21 | Cenas de cartão como padrão da série; o técnico entra no campo no apito final (o plano do treinador, atrás do gancho) |
| Fórum da EA | Variar as cenas para quebrar a repetição: 3 + 3 variações, nunca a mesma em seguida (teste B) |

## Decisões e números

- **Cenas de desenho num mundo à parte** (a receita da comemoração): cópias dos jogadores andando com a MESMA locomoção;
  a simulação não muda (`hash-igual` e `hash-partida` IGUAIS; `hashMundo` igual antes e depois de cada cena).
- **Cartão 3D a 1,5× o real** (11 × 16 cm em vez de 7,5 × 10,5): o real some a 8 m com a lente do celular a 844 × 390 (o
  teste de tela pede ≥ 10 px no celular e ≥ 14 px no PC, com a cor certa no pixel do meio).
- **Lente livre**: a câmera do próximo plano é escolhida 0,9 s antes do corte e quem não é do plano sai da frente dela
  (`fugirDaLente`); no corte ninguém está a menos de 2,5 m da lente (teste A e C).
- **Elipses** (`recriarAtor`): o expulso perto do túnel, os times no funil do intervalo e o time no aplauso reaparecem SÓ
  no tick de um corte, com a passada zerada (o teste exige que todo salto > 0,5 m num tick coincida com um corte).
- **Fica de fora** (pendência): "deitado de costas no gramado" do perdedor e a camisa de pano no V3 (hoje as mãos na
  frente do rosto, sem pano); o peso das variações pelo motivo do cartão (para garantir a variedade medida); os treinadores
  (gancho pronto, à espera da frente da área técnica).
