# PESQUISA.md — Etapa 1

Escopo da etapa: campo, bola com física, um jogador controlável que conduz a bola, câmera e testes. Todos os números abaixo vêm dos achados da pesquisa. Quando o número é cálculo ou dedução do próprio pesquisador, e não da fonte, aparece a marca "(cálculo da pesquisa)". Quando falta número, o texto diz **falta**.

---

## 1. Constantes

### 1.1 Bola

| Constante | Valor proposto | Fonte |
|---|---|---|
| Massa | 0,43 kg (Lei 2: 410–450 g; FIFA Quality Pro: 420–445 g) | IFAB Lei 2; FIFA Testing Manual Footballs 2018 |
| Raio | 0,110 m (69 cm / 2π = 0,1098 m; circunferência de 68–70 cm) | IFAB Lei 2 |
| Área de referência | A = πR² ≈ 0,038 m² | IFAB Lei 2 (derivada) |
| β = ρA/(2m) | ≈ 0,053 m⁻¹ | Goff & Carré 2009 (0,0530 m⁻¹) |
| Momento de inércia | I = (2/3)mR² ≈ 3,5×10⁻³ kg·m² (casca fina, α = 2/3) | Cross 2002 |
| Densidade do ar | 1,2 kg/m³; empuxo (~0,07 N) ignorado | Goff & Carré 2009/2012 |
| Número de Reynolds | Re = v·0,218/1,54×10⁻⁵ (Re×10⁻⁵ ≈ v/7 m/s) | Goff & Carré 2012 |
| C_D(v) sem spin (principal) | ~0,45 até ~10 m/s; rampa até 0,15–0,20 entre ~10 e 16 m/s; patamar de ~0,18 acima | Asai & Seo 2013; Passmore et al. 2012 |
| C_D(v) e C_L(v) em voo real (alternativa) | polinômios de 5º grau (abaixo), válidos só entre 9,3 e 29,9 m/s e travados nas pontas; multiplicar por 0,88 se A = 0,038 m² | Goff, Kelley et al. 2017 |
| Acréscimo de C_D pelo spin | +0,07 a +0,10 em Sp 0,25; +0,10 a +0,13 em Sp ≥ 0,5 | Goff & Carré 2009; Asai et al. 2007 |
| C_L de Magnus (tabela v × Sp) | 12 m/s: 0,04 (Sp 0,20), 0,225 (0,42), 0,258 (0,50). 20 m/s: 0,06 (0,10), 0,135 (0,20), 0,205 (0,29). 30 m/s: 0,185 (0,10), 0,27 (0,20). Saturar em 0,30–0,35 para Sp ≥ 0,3–0,5 | Passmore et al. 2012; Goff & Carré 2012 |
| C_L com spin baixo em Re 1,8–2,4×10⁵ | ~0 ou levemente negativo (medido até −0,08 com Sp ≲ 0,12–0,14); |C_L| ~0 em 10–12 m/s | Passmore et al. 2012; Goff et al. 2017 |
| Força lateral sem spin ("bola que flutua") | só com ω < ~10 rpm: C_lat(φ) senoidal pela orientação dos gomos, amplitude 0,05–0,10 e período de 90–180° de rotação; nada de ruído por quadro | Passmore et al. 2012 (medido de ±0,05 a ±0,17 a 30 m/s) |
| Decaimento do spin | ω(s) = ω0·e^(−k·s) com o eixo fixo; k = 0,006 m⁻¹ (faixa de 0,003 a 0,009) | Tsukada & Sakurai 2008; Goff & Carré 2009; James & Haake 2008 |
| Rolagem | dec(v) = c·v^1,35 + piso de 0,05 m/s²; c = 0,42 (gramado médio) | Gabrielsen 2004 (lei cruzada pela pesquisa) |
| Distância de rolagem por gramado | rolando a 3,2 m/s, para em 4–10 m (alvo ~7 m); curto e seco ~9–10 m; alto ou pesado ~4–5 m | FIFA Test Manual I 2024; FIFA Natural Pitch Rating; relatório FIFA 103187 |
| Atrito de deslizamento μ | ≈ 0,5 no seco (grama de tênis 0,5–0,6; saibro até 0,9); ≈ 0,2–0,3 no molhado | Cross 2008; Cross 2002 |
| Chute rasteiro sem efeito | desliza até 0,6·v0 e só então rola (casca, e_x = 0); com topspin (Rω = v) já sai rolando | Cross 2002 |
| Restituição vertical e_y | 0,62 na grama (faixa de 0,55 a 0,71): queda de 2 m dá rebote de 0,77 m (aceitável de 0,60 a 0,85 m); cai um pouco com a velocidade de impacto (inclinação: **falta**) | FIFA Test Manual I 2024; FIFA Footballs 2018; Cross 2008 |
| Restituição horizontal e_x | +0,1 a +0,4 no seco (ex.: e_y = 0,6, e_x = +0,2 e μ ≥ 0,55 dão 54% no rebote oblíquo) | Cross 2002 + ensaio FIFA (cálculo da pesquisa) |
| Passe rasteiro de referência | saída a 16,2 m/s, perda média de 7,93 m/s² | Pfaff et al. 2022 |

Polinômios de Goff et al. 2017 (v em m/s, A = 0,0333 m²):
- C_D(v) = Σδj·v^j, δ = [14,276; −3,730; 0,3801; −1,873e−2; 4,487e−4; −4,201e−6]
- C_L(v) = Σλj·v^j, λ = [−9,448; 2,675; −0,2885; 1,482e−2; −3,681e−4; 3,561e−6]
- Valores de conferência: C_D = 0,54 (9 m/s), 0,32 (10), 0,14 (12), mínimo ~0,13 em 12,5–13, 0,22 em 18–20, 0,17–0,19 em 24–28 m/s.

### 1.2 Jogador

| Constante | Valor proposto | Fonte |
|---|---|---|
| Caminhada sem bola | 1,47 m/s (5,3 km/h); ~1,0 passada/s; passada de ~1,50 m | Hansen et al. 2017 |
| Troca entre andar e trotar | 2,14 m/s. Histerese: trota acima de 2,2 m/s e volta a andar abaixo de 1,9 m/s | Hansen et al. 2017; Hreljac et al. 2005 (1,89–2,16 m/s) |
| Trote sem bola | 2,92 m/s (10,5 km/h); 1,38 passada/s; passada de ~2,12 m; ~2,76 passos/s | Hansen et al. 2017 |
| Corrida sem bola | 3,5–7 m/s (faixa em que a velocidade sobe pelo comprimento da passada); IA sem urgência a ~0,7·v_max | Dorn et al. 2012; Konami eFootball v5 |
| Sprint sem bola: limite do modelo | S0 = 9,4 m/s (em jogo: 9,22–9,50); no teste de 30 m, v_max = 8,91 m/s | Alonso-Callejo et al. 2022; Baumgart et al. 2018 |
| Sprint sem bola: pico em jogo | 8,1–8,8 m/s conforme a posição (laterais e meias abertos são os mais rápidos) | Silva et al. 2024 |
| Velocidade com bola em jogo | 10,3 km/h (~2,9 m/s) na recepção e 12,9 km/h (~3,6 m/s) de média | Carling 2010 |
| Condução em arrancada | ~5,5–6 m/s (média de 5,66 m/s em 20 m, contra 6,22 m/s sem bola) | Preissler et al. 2023 |
| Sprint com bola | S0 × 0,94; pico em jogo de 6,9 m/s (24,9 km/h), ou ~0,8–0,85 do teto sem bola | Benhassen et al. 2026; Carling 2010 |
| Trote e corrida com bola por marcha | **falta** número direto | — |
| Razão entre velocidades de lado e de costas | lado 0,75× e costas 0,6× da velocidade à frente | Holden, controller.cpp |
| Aceleração máxima | a_max(v) = A0·max(0, 1 − v/S0), com A0 = 8,5 m/s² (em jogo: 8,26–8,68) e S0 = 9,4 m/s; o atributo varia ±0,5; τ ≈ 1,1 s | Alonso-Callejo et al. 2022; Baumgart et al. 2018 |
| Aceleração com bola | A0 × 0,76 (de 0,71 no pior condutor a 0,80 no melhor) | Benhassen et al. 2026 |
| Resposta do comando (jogador controlado) | mola criticamente amortecida com meia-vida de 0,27 s; damping = 4·ln2/(meia-vida + 1e−5) (ver incertezas) | Holden, controller.cpp |
| Frenagem máxima | média de 4,5 m/s², pico de 8,5 m/s² por apoio | Harper et al. 2020 |
| Passada × velocidade | 3,5 m/s: passo de 1,31 m, 2,62 passos/s, contato de 0,243 s. 5,2 m/s: 1,71 m, 2,94 passos/s, 0,188 s. 7,0 m/s: 2,00 m, 3,50 passos/s, 0,145 s. 9,0 m/s: 2,05 m, 4,36 passos/s, 0,118 s | Dorn et al. 2012 |
| Sprint máximo | balanço de ~0,373 s, fixo; contato = 0,19 − 0,0087·v; passada = 1,03 + 0,37·v (m); frequência = 1,5 + 0,06·v passadas/s. O atributo de velocidade escala o comprimento, não a cadência | Weyand et al. 2000 |
| Sprint de futebolista | 4,5–4,7 passos/s; passo de 1,86–1,98 m; contato ≈ voo ≈ 0,10–0,12 s | Takai et al. 2025 |
| Arrancada do repouso | a cadência chega ao patamar em 3–4 passos; o comprimento do passo cresce até ~o 24º passo | Nagahara et al. 2014 |
| Corte: fração da velocidade que sobra na saída | 45°: 1,00; 90°: 0,73; 180°: 0,55 (interpolar) | Dos'Santos, Thomas & Jones 2021 |
| Corte: velocidade típica de entrada | 5,2 m/s (45°), 4,5 m/s (90°), 4,0 m/s (180°) | Dos'Santos, Thomas & Jones 2021 |
| Corte: duração do pé de apoio travado | 0,20 s (45°), 0,30 s (90°), 0,51 s (180°) | Dos'Santos, Thomas & Jones 2021 |
| Desvio máximo por apoio | 35° a 2 m/s, 29° a 3, 24° a 4 e 17,5° a 5 m/s (acima de 5 m/s: **falta** dado) | Dos'Santos et al. 2018 |
| Corte acima de 60° com v > ~4 m/s | 1–2 passos de frenagem antes do corte; um 90° em plena corrida vira curva de 3–5 passos | Dos'Santos et al. 2018 (Schot) |
| Pivô de 180° | frenagem distribuída em 3 apoios, com a maior no antepenúltimo | Dos'Santos et al. 2021 (teste 505) |

### 1.3 Toque de condução

| Constante | Valor proposto | Fonte |
|---|---|---|
| Toques na arrancada (~5,5–6 m/s) | 1,4–2,3 toques/s; 2,5–4 m de bola por toque; um toque a cada 2–3 passos, não a cada passada | Preissler et al. 2023 (cálculo da pesquisa) |
| Toques no drible fechado ou lento | 2,3–3,0 toques/s, com cadência alta e pouco balanço lateral do corpo | Zago et al. 2016 |
| Regra de contagem de toque | mínimo local da distância bola–ponta do pé abaixo de 0,15 m, com pelo menos 0,25 s entre toques (no máximo 4 toques/s) | Schepers et al. 2025 |
| Posse típica em jogo | 1–2 toques, ~1,1 s, ~4,2 m | Carling 2010 |
| Toque por passada no trote | **falta** (EA FC 24 só diz que a marcha controlada mantém a bola mais perto) | EA FC 24 |
| Distância bola–pé na condução rápida | **falta** (a pesquisa não achou estudo; usar o avanço por toque como referência e medir) | — |

### 1.4 Alvos de teste (valores de referência)

| Teste | Alvo | Fonte |
|---|---|---|
| Alcance a 25°, sem lift, saindo do chão | v0 = 17 m/s → 17,5–19,5 m; v0 = 28 m/s → 44,1–47,1 m | Asai & Seo 2013 |
| Alcance sem spin, 18 m/s a 22°, ~1,1 m de altura (altura deduzida), C_D = 0,2 | alcance ÷ alcance no vácuo = 0,86 ± 0,02 | Goff & Carré 2009 |
| Chute reto de 25 m a 30 m/s, sem spin | chega em 0,94–1,00 s, a 22–25 m/s | Passmore et al. 2012 |
| Falta com curva: 36 m/s, 63 rad/s com eixo vertical, alvo a 27 m | curva lateral de 2,5–3,5 m, chegada a 17–21 m/s | Goff & Carré 2009 |
| Falta a 18,3 m saindo a 25 m/s | só elevações entre 16,5° e 17,5° passam por cima da barreira e por baixo do travessão | Bray & Kerwin 2003 |
| Spin: 25 m/s com 8 rps | aos 18 m, spin entre 6,8 e 7,6 rps; o eixo varia menos de 2° | Tsukada & Sakurai 2008 |
| Rolagem | de 3,2 m/s, para em 4–10 m (com c = 0,42: 7,8 ± 0,4 m); de 2,5 m/s, perde 0,55 ± 0,05 m/s no 1º metro | FIFA; Gabrielsen 2004 |
| Quique vertical: queda de 2,00 m na grama | 1º rebote entre 0,60 e 0,85 m | FIFA Test Manual I 2024 |
| Quique oblíquo: 13,9 m/s a 25°, sem spin | sai com 45–60% da velocidade no seco | FIFA Test Manual I 2024 |
| Modelo de Cross | e_x = −1 deixa v_x e ω inalterados; ω1 = 0 e e_x = 0 dão v_x2/v_x1 = 0,60; o momento angular no contato se conserva com erro ≤ 1e−9 | Cross 2002 |
| Simulação a 60 Hz contra 120 Hz | o alcance do chute muda menos de 1% | Goff & Carré (aplicação da pesquisa) |
| Sprint do repouso (v_max de 8,9 m/s) | 10 m em 2,1 ± 0,15 s; 30 m em 4,5 ± 0,2 s; nunca 95% da v_max antes de ~2,8 s; reprova se chegar à v_max em menos de 2 s | Baumgart et al. 2018 |
| Parada a partir de 7,3 m/s | 1,3–1,7 s e 5,8–7,8 m | Harper et al. 2020 |
| Passada a 7 m/s | 3,5 ± 0,35 passos/s; passo de 2,0 ± 0,2 m | Dorn et al. 2012 |
| Com bola contra sem bola | 5 m de 13% a 19% mais lento; 20 m de 8% a 12% mais lento; 30 m com razão de tempo de 1,2–1,3 | Benhassen et al. 2026; Manouras et al. 2023 |
| Toques em linha reta a ~5,7 m/s | 1,4–2,3 toques/s | Preissler et al. 2023 |
| Analógico girado 90° a 7 m/s | o rumo leva pelo menos 3 apoios para completar a volta | Dos'Santos et al. 2018 |
| Interpolação a 60/120/144 Hz, bola a 20 m/s | deslocamento desenhado por quadro = 20/Hz m, com erro abaixo de 1% | Fiedler 2004 |
| Encaixe do delta (vsync de 60 Hz com ruído de ±0,5 ms) | zero quadros com 0 ou 2 passos em 10.000; sem o encaixe, o teste deve reprovar | Glaiel 2019 |
| Pé desenhado (todos os quadros) | pé plantado ≤ 0,05 m/s; nenhum quadro com o pé acima de 2,5·v + 3 m/s (correndo, o pico do pé no balanço é 2,00 ± 0,15 × v; andando, ~4,6 m/s a ~1,3 m/s); no pouso, ≤ 0,19·v + 0,81 m/s (velocidade do pé ao tocar o chão) | Clark et al. 2023; van der Straaten et al. 2020 |
| rAF a 144 Hz e a 30 Hz durante 10 s | 600 ± 1 passos nos dois casos; a 33,33 ms, exatamente 2 passos por quadro | MDN rAF; Perry 2020 |
| Relógio da partida | depois de 324.000 passos, tick/60 === 5400 exatamente | medição local; Glaiel 2019 |
| Replay | mesmo hash final com render a 30, 60 e 144 Hz | Fiedler 2014 |
| Gerador de números | mesmas 10.000 saídas gravadas (teste dourado); média 0,5 ± 0,005 e qui-quadrado em 100 caixas com 10⁶ amostras | bryc |
| Zona morta | saída ≈ 0 logo acima da zona morta; erro angular abaixo de 1° numa volta de 360° com módulo 0,5 | Sutphin 2013; Pérez Ramil 2017 |
| Orçamento de download | até 4.000.000 bytes transferidos até o primeiro quadro | medição no jsDelivr |

---

## 2. Decisões de projeto que a pesquisa sustenta

### 2.1 Passo fixo de 1/60 s com interpolação
- **DT = 1/60 s com acumulador.** O que sobra no acumulador vira alpha = acumulador/DT. O render interpola anterior/atual (posição em vec3, rotação por slerp de quatérnio), e o resto nunca é integrado. Só o passo fixo reproduz bit a bit. *Fonte: Fiedler, "Fix Your Timestep!" (2004).*
- **Contra a espiral da morte:** frameTime limitado a 250 ms e no máximo 4 passos por quadro. O excesso é descartado: o jogo fica mais lento sob carga em vez de travar. *Fonte: Fiedler (2004 e "Deterministic Lockstep", 2014); Glaiel (2019) limita a 8/60 s.*
- **O delta vem do carimbo do rAF**, nunca de performance.now() no meio do quadro; o lastT é marcado no primeiro callback. *Fonte: MDN rAF; Žilys (Unity, 2020): delta de 6,51–7,42 ms a 144 qps fixos; Ladavac (2018): 24,8 e 10,7 ms com a tela estável a 16,67 ms.*
- **Encaixe do delta** em 1/30, 1/60, 1/120 ou 1/144 s com tolerância de 0,2 ms, mais média móvel de 8 deltas quando eles chegam quantizados. *Fonte: Glaiel (2019): o timer ingênuo fez 2.535 updates duplos em 10.001; MDN performance.now (resolução de 100 µs; 100 ms com resistFingerprinting no Firefox).*
- **Ressincronia** (acumulador = 0) quando a aba volta a ficar visível, no fim do carregamento e ao sair da pausa ou do replay. *Fonte: three.js r170 Timer.js; Glaiel (2019).* (No GOLAÇO o acumulador recomeça em meio passo: o tremor dos primeiros quadros, antes da média de 8 deltas, não muda a contagem de passos.)
- **O relógio é um contador inteiro de ticks**: somar 1/60 sessenta vezes dá 1,0000000000000013. *Fonte: medição local no Node v22.22; Glaiel (2019) usa inteiros de 64 bits.*
- **Euler semi-implícito basta** a 60 Hz com v ≤ 35 m/s, porque o arrasto tira menos de 0,2 m/s por passo. *Fonte: Goff & Carré (aplicação da pesquisa).*
- **Ordem por quadro:** ler a entrada → rodar os passos → renderizar. A velocidade muda antes da posição, e o impulso sai no primeiro passo do comando, sem esperar a animação. Meta: até 3 quadros (50 ms a 60 fps). *Fonte: Mick West (2008).*
- Se o jogo abrir dentro de um quadro, a página do quadro tem de ser **da mesma origem** de quem o abre: o Safari limita o rAF a 30 qps em iframe de outra origem até um toque, e o loop tem de ficar perfeito a 30 Hz. *Fonte: Perry (2020); WebKit Bugzilla 173434.*

### 2.2 Gerador com semente: sfc32
- **sfc32** com estado de 4 int32 (passa no PractRand e no BigCrush), semeado por **splitmix32**, com as 15 primeiras saídas descartadas. *Fonte: bryc, PRNGs.md; Vigna.*
- Descartados: mulberry32 (pula um terço dos valores de 32 bits), xoshiro128** (falha em complexidade linear e posto binário nos bits baixos), PCG32 (precisa de 64 bits e, com BigInt, custa 203 ns, ~23× mais) e Math.random (não aceita semente). *Fonte: bryc; V8 blog; medição local (sfc32 a 8,7 ns por número).*
- **Uma segunda instância** para efeitos (torcida, som, partículas), que nunca entra no estado. *Fonte: Bettner & Terrano (2001): no Age of Empires, sons aleatórios dentro da simulação causavam dessincronia.*

### 2.3 Determinismo e replay
- Nos módulos de simulação ficam **proibidos Math.pow, `**`, Math.hypot e Math.random**. A distância é sempre Math.sqrt(x*x+z*z): sqrt e + − × ÷ são exatos, e o resto é "implementation-approximated". *Fonte: ECMA-262; medição local (hypot ≠ sqrt em 403.212 de 10⁶ pares); MacWright (2020); Ritter (2021); Rapier.*
- A garantia é para **o mesmo motor e a mesma versão**; o replay guarda a versão do jogo e o motor. *Fonte: MacWright; Ritter.*
- **Replay = semente + configuração + entradas por tick** (analógico em int8 por eixo e bits dos botões, gravados só quando mudam). *Fonte: Fiedler, "Deterministic Lockstep" (2014).*
- **Hash FNV-1a a cada tick, por subsistema**, com DataView little-endian, −0 convertido para 0 e NaN reprovando na hora. Ordenações sempre com desempate por id. *Fonte: Factorio FFF-47; ECMA-262 NumericToRawBytes; v8.dev/blog/array-sort.*

### 2.4 Zona morta radial escalada
- out = normalize(v)·((|v| − dz)/(1 − dz)), com **dz = 0,15–0,2** e zona morta externa (acima de 1 − dz_ext, a saída vale 1). A axial gruda nos eixos e a radial pura salta de 0 para dz. *Fonte: Sutphin (2013); Pérez Ramil (2017, 0,2 nos exemplos); Holden usa radial 0,2.*
- Curva de resposta com expoente n > 1, opcional; o valor 1,5–2 é sugestão da pesquisa, não da fonte.
- **Joystick virtual no celular:** a mesma fórmula, em fração do raio, sem filtro extra. Ao arrastar, a latência é percebida a partir de 6 ms; no toque simples, a ~69 ms. *Fonte: Cattan et al. (CHI 2017).*

### 2.5 Pés travados e corpo visual
- **O pé fica travado no mundo durante o contato** da tabela de Dorn (0,243 → 0,118 s) e voa no resto do tempo. *Fonte: Dorn et al. (2012).*
- Constantes iniciais: pé a 0,02 m do chão, destrava a 0,2 m, mistura de 0,1 s, raiz visual a no máximo 0,15 m e 90° da simulação, correção ≤ 0,5·|v|·dt por passo. O ponto travado e o instante da troca ficam no estado, para o replay. *Fonte: Holden, controller.cpp; Clavet (For Honor): centro de massa a 15 cm da simulação.*
- **A simulação manda e a animação vai por cima.** A meta é previsibilidade, não responsividade máxima. *Fonte: Clavet (GDC 2016); Rosen (GDC 2014).*
- Velocidade de reprodução e comprimento da passada ficam em [0,8; 1,2]. Fora disso, trocar de clipe ou aceitar um pouco de patinação. *Fonte: Epic/Lyra (15–20% no máximo); For Honor (no máximo +10% e −20%).*
- **Inercialização:** a lógica muda o rumo na hora e a diferença visual decai por um polinômio de grau 5 (12 µs contra 30 µs da mistura tradicional). *Fonte: Bollo (GDC 2018).*
- O comando passa por uma mola criticamente amortecida, com previsão em forma fechada do ponto do pé no próximo toque, que é onde o impulso da bola mira. *Fonte: Holden, controller.cpp.*

### 2.6 Inclinação do tronco
- **Eixo = up × aceleração do estado**, suavizado por mola de 0,25 s e com teto de ângulo. *Fonte: Kaufmann (2023).*
- O ganho de 0,64° por m/s² vem de um jogo estilizado. Para realismo, comparar com atan(a/g), que é física da pesquisa. O único dado medido é o do corte: −20,9° (45°), −18,0° (90°) e +7,4° (180°) no toque do apoio final. *Fonte: Dos'Santos, Thomas & Jones (2021).*
- No pivô de 180°, o corpo baixa e inclina para trás 2–3 passos antes do giro. *Fonte: Dos'Santos et al. (2021, teste 505).*
- O corpo não gira abaixo de ~5% da velocidade máxima, o que evita o rodopio parado. *Fonte: Kaufmann (2023).*

### 2.7 Movimento e condução
- **O mesmo integrador para a IA e para o humano:** variação de v limitada por a·dt, com aceleração e frenagem separadas, e v ≤ v_max. Arrive com slowing_distance = v²/(2·a_frenagem), uma derivação da pesquisa (Reynolds não dá valores). *Fonte: Reynolds (GDC 1999).*
- **Três marchas de condução:** trote, sprint controlado (bola mais perto) e arrancada. O toque de esforço tem distância proporcional ao tempo segurando o botão. *Fonte: EA FC 24.* O toque de esforço entra sozinho em giros bruscos. *Fonte: EA FC 26.*
- **A aceleração com bola cai com a velocidade**, e o domínio sai na direção pedida, sem a bola voltar a bater no corpo. O prazo de ~0,3 s é da pesquisa. *Fonte: Konami eFootball v5.*
- **Correr mais rápido piora o controle:** velocidade máxima maior ficou associada a menor sucesso no drible. *Fonte: Schepers et al. (2025).*

### 2.8 Campo, câmera e render (three.js r170)
- **Importmap** com a versão exata three@0.170.0, apontando para build/three.module.min.js (171 KB em brotli), mais "three/addons/" → examples/jsm/. Addons em .min.js, sem SRI. O importmap vem antes do primeiro módulo. Só a versão exata recebe cache de 1 ano. *Fonte: medição no jsDelivr; manual r170 "Installation"; MDN importmap.*
- **Só WebGL 2**, com try/catch e tela de erro; powerPreference 'high-performance', stencil false; tratar context lost. *Fonte: Migration Guide r163; WebGLRenderer.js r170; web3dsurvey (97,75%).*
- **Uma única DirectionalLight com sombra.** castShadow só em jogador e bola. Caixa fixa de 40 m que segue a bola, com o centro arredondado a múltiplos de 40/mapSize (3,9 cm por texel com 1024). Baixa: BasicShadowMap 1024 ou disco falso; média: PCF 1024; alta: PCFSoft 2048. *Fonte: manual r170 "Shadows"; Microsoft Learn; Utsubo.*
- **Draw calls contadas com info.autoReset = false**, porque a contagem padrão deixa a sombra de fora. Meta da qualidade baixa: até 100 chamadas e ~100–150 mil triângulos. *Fonte: WebGLRenderer.js r170; Arm; Utsubo.*
- **A qualidade é decidida antes do primeiro render**, com compileAsync no carregamento. Luz e sombra nunca ligam nem desligam durante a partida (KHR_parallel_shader_compile só existe em 0,21% dos Android). *Fonte: WebGLRenderer.js r170; web3dsurvey.*
- Jogador SkinnedMesh com frustumCulled = false (ou esfera recalculada) e 1 material. *Fonte: docs InstancedMesh e Frustum.js r170.*
- **NeutralToneMapping** com exposição 1, porque o ACES desatura e não mostra verdes vivos; HUD com toneMapped = false. *Fonte: model-viewer; tonemapping_pars_fragment r170.*
- CanvasTexture do gramado com **colorSpace = SRGBColorSpace**; shaders próprios terminam com tonemapping_fragment e colorspace_fragment. *Fonte: manual r170 "Color management".*
- **Faixas do gramado:** bordas em |x| = 52,5 − {0; 5,5; 11; 16,5; 22}, depois passos de 6,10 m até o meio (18 faixas). Linhas de 12 cm; pequena área de 5,5 m, grande área de 16,5 m, pênalti a 11 m, círculo de 9,15 m, gol de 7,32 × 2,44 m. *Fonte: UEFA Pitch Quality Guidelines 2025; IFAB Lei 1.*
- **Textura do campo:** 2048×1024 na baixa e na média, 4096×2048 na alta, nunca acima de maxTextureSize, enviada uma vez só. Anisotropia só no gramado: 2/4/8, limitada pelo máximo do aparelho. *Fonte: web3dsurvey; MDN; Arm.*
- **DPR ≤ min(devicePixelRatio, 2)**: baixa em 1,0 e média em 1,25–1,5, com ajuste dinâmico em passos de 0,1 e trava depois de 3 inversões. No celular, MSAA com DPR até 1,5. *Fonte: fórum three.js; drei PerformanceMonitor; Utsubo; Arm.*

---

## 3. O que aproveitamos de cada fonte

**Bola**
- IFAB, Lei 2: massa, circunferência e pressão. https://www.theifab.com/laws/latest/the-ball/
- FIFA, Testing Manual Footballs 2018: faixas Quality Pro e quique da bola no aço. https://digitalhub.fifa.com/m/4e93a32cd03542cf/original/testing-manual-fifa-quality-programme-for-footballs-2018.pdf
- Goff & Carré 2012 (Procedia): Reynolds, forças e C_L em voo real batendo com o túnel para Sp < 0,3. https://eprints.whiterose.ac.uk/id/eprint/98035/1/1-s2.0-S1877705812016414-main.pdf
- Goff & Carré 2009 (AJP): β, teste de alcance de 21,9 m, C_D com topspin, decaimento do spin e falta de Beckham. https://wiki.penfieldrobotics.com/wiki/images/c/c0/Goff_Carre_AJP_2009.pdf
- Asai & Seo 2013: crise do arrasto por bola e testes de alcance a 17 e 28 m/s. https://pmc.ncbi.nlm.nih.gov/articles/PMC3657093/
- Passmore et al. 2012: C_D por Re, C_L(Sp), bola que flutua e chute de 25 m em 0,97 s. https://repository.lboro.ac.uk/articles/journal_contribution/The_aerodynamic_performance_of_a_range_of_FIFA-approved_footballs/9225398/1/files/16804895.pdf
- Goff, Kelley et al. 2017: polinômios de C_D e C_L em voo real. https://shura.shu.ac.uk/15728/1/Kelley%20-%20Creating%20drag%20and%20lift%20curves%20%28AM%29.pdf
- Bray & Kerwin 2003: C_D e C_L de faltas reais e janela de 16,5–17,5°. https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=12630787&rettype=abstract&retmode=text
- Tsukada & Sakurai 2008: queda de 5–15% do spin em 18 m, com o eixo fixo. https://ojs.ub.uni-konstanz.de/cpa/article/view/1988/1856
- James & Haake 2008: decaimento proporcional a ω·v, dependente da inércia. https://shura.shu.ac.uk/2132/
- FIFA, Test Manual I 2024: ensaios de rolagem, quique e rebote oblíquo. https://www.sporteimpianti.it/wp-content/uploads/2024/04/FIFA-TTM-I-Layout-v8.pdf
- FIFA, Natural Pitch Rating System: faixas de grama natural. https://digitalhub.fifa.com/m/58aa765dd3e85f26/original/FIFA-natural-pitch-rating-system_EN.pdf
- Relatório FIFA nº 103187 (2021): 7,1 m de rolagem, quique de 0,79/0,75 m e rebote de 55%/65%. https://storage.mtender.gov.md/get/8889652d-394f-493b-a481-86e49e815125-1724401134063
- Lee, Park & Kim 2006: rolagem e quique por tipo de superfície. https://koreascience.kr/article/JAKO200617317767396.do
- Gabrielsen 2004 (ISSS): desaceleração dependente de v, método por portões e regressão UEFA/NBI. https://www.isss-sportsurfacescience.org/downloads/documents/A7ZD60AH55_Gabrielsen_Ball_Roll.pdf.pdf
- Pfaff et al. 2022: passe real a 16,2 m/s com perda de 7,93 m/s². https://arxiv.org/pdf/2210.16474
- Cross 2002 (AJP): equações do quique com aderência e com deslizamento. https://www.physics.usyd.edu.au/~cross/PUBLICATIONS/20.%20HorizCOR.PDF
- Cross 2008 (Physics Today): μ da grama e e_y caindo com a velocidade. https://aip.brightspotcdn.com/PTO.v61.i9.84_1.online.pdf
- Cox 2004 (ISSS): ensaios de rebote oblíquo FIFA e UEFA. https://www.isss-sportsurfacescience.org/downloads/documents/YQOKXVAQ7B_Cox.pdf
- The FA 2007/08: faixas antigas de rebote (45–70% no seco). https://www.thefa.com/GetIntoFootball/Facilities/~/media/Files/PDF/Get%20into%20Football/AGP_Conditions_of_use_in_FA_Comps_2007_08.ashx
- Gallardo Guerrero, Sánchez-Sánchez et al. 2019: rebote menor no molhado (divergência). https://abacus.universidadeuropea.com/entities/publication/f8aa1509-e1ac-4c1c-9898-0417a12e4975/full

**Biomecânica**
- Dorn, Schache & Pandy 2012: tabela de passo, frequência e contato por velocidade. https://journals.biologists.com/jeb/article-pdf/215/11/1944/1445059/1944.pdf
- Weyand et al. 2000: balanço fixo, contato em função de v; o atributo escala o comprimento. https://journals.physiology.org/doi/full/10.1152/jappl.2000.89.5.1991
- Hansen et al. 2017 (cita Hreljac et al. 2005): caminhada, transição e trote. https://pmc.ncbi.nlm.nih.gov/articles/PMC5435734/
- Takai et al. 2025: sprint de futebolistas. https://pmc.ncbi.nlm.nih.gov/articles/PMC12047830/
- Nagahara et al. 2014: cadência no patamar ao ~4º passo. https://pmc.ncbi.nlm.nih.gov/articles/PMC4133722/
- Baumgart et al. 2018: v_max de 8,91 m/s, τ de 1,10 s e tempos de 10/30 m. https://pmc.ncbi.nlm.nih.gov/articles/PMC6316512/
- Alonso-Callejo et al. 2022: perfil linear aceleração–velocidade, A0 e S0 em jogo. https://pmc.ncbi.nlm.nih.gov/articles/PMC9649751/
- Silva et al. 2024: pico em jogo por posição e curvas de subida e queda. https://pmc.ncbi.nlm.nih.gov/articles/PMC11694206/
- Harper et al. 2020: frenagem máxima (média, pico, tempo e distância). https://knowledge.lancashire.ac.uk/id/eprint/33971/1/33971%20Manuscript%20-%20Measuring%20Max%20Decel%20%28AAM%29.pdf
- Harper, Carling & Kiely 2019: em jogo, as desacelerações fortes são mais frequentes que as acelerações. https://pmc.ncbi.nlm.nih.gov/articles/PMC6851047/
- Dos'Santos, Thomas & Jones 2021 (ângulo): tabela de corte a 45/90/180° e inclinação do tronco. https://salford-repository.worktribe.com/OutputFile/1486606
- Dos'Santos et al. 2018 (ângulo × velocidade): desvio por apoio e 90° como curva de 3–5 passos. https://pmc.ncbi.nlm.nih.gov/articles/PMC6132493/
- Dos'Santos et al. 2021 (505): frenagem maior no antepenúltimo apoio. https://salford-repository.worktribe.com/output/1348620/how-early-should-you-brake-during-a-180-turn-a-kinetic-comparison-of-the-antepenultimate-penultimate-and-final-foot-contacts-during-a-505-change-of-direction-speed-test
- Benhassen et al. 2026: a bola tira ~24% de F0 e ~6% de V0. https://jhk.termedia.pl/Effects-of-Dribbling-Constraints-on-Sprint-Acceleration-Performance-and-the-Force,204820,0,2.html
- Preissler et al. 2023: −9% de velocidade com bola e toques por segundo. https://pmc.ncbi.nlm.nih.gov/articles/PMC9807573/
- Carling 2010: posse típica e pico com bola de 6,9 m/s. https://knowledge.lancashire.ac.uk/12267
- Zago et al. 2016: 2,3–3,0 toques/s e trajeto estreito no drible. https://air.unimi.it/handle/2434/282240
- Schepers et al. 2025: regra de contagem de toque; velocidade alta não garante drible. https://arxiv.org/html/2506.22503
- Manouras et al. 2023: 30 m com bola ~28,7% mais lentos (jovens). https://pmc.ncbi.nlm.nih.gov/articles/PMC10594421/

**Passo fixo e determinismo**
- Fiedler, "Fix Your Timestep!": acumulador, alpha e limite de 0,25 s. https://gafferongames.com/post/fix_your_timestep/
- Fiedler, "Deterministic Lockstep" (com "Floating Point Determinism", 2010): replay por entradas e no máximo 4 passos por quadro. https://gafferongames.com/post/deterministic_lockstep/
- Glaiel 2019: encaixe do delta, ressincronia e relógio inteiro. https://medium.com/@tglaiel/how-to-make-your-game-run-at-60fps-24c61210fe75
- Žilys 2020 (Unity) e Ladavac 2018: o tremor vem do delta medido no lugar errado. https://unity.com/blog/engine-platform/fixing-time-deltatime-in-unity-2020-2-for-smoother-gameplay
- MDN, requestAnimationFrame: carimbo do quadro e pausa em segundo plano. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- MDN, performance.now: resolução reduzida e tolerâncias. https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- Perry 2020 (com WebKit 173434/170534): limite de 30 qps no Safari em iframe de outra origem. https://motion.dev/magazine/when-browsers-throttle-requestanimationframe
- three.js r170, Timer.js: delta zero com a aba oculta e reset ao voltar. https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/misc/Timer.js
- ECMA-262: o que é exato (sqrt e as quatro operações) e o que é aproximado. https://tc39.es/ecma262/multipage/numbers-and-dates.html
- MacWright 2020 (com Ritter 2021 e Rapier): Math.* muda entre versões e motores. https://macwright.com/2020/02/14/math-keeps-changing
- bryc, PRNGs.md: escolha do sfc32 e da semente por splitmix32. https://github.com/bryc/code/blob/master/jshash/PRNGs.md
- Vigna, "A PRNG shootout": avaliação do xoshiro128. prng.di.unimi.it
- V8 blog, Math.random: sem semente, xorshift128+. https://v8.dev/blog/math-random
- O'Neill, PCG: precisa de 64 bits (descartado em JS puro). pcg-random.org
- Factorio FFF-47 (com Bettner & Terrano 2001): hash por tick para achar a primeira divergência. https://www.factorio.com/blog/post/fff-47
- V8 blog, array-sort: sort estável desde a v7.0. v8.dev/blog/array-sort

**Condução e movimento em jogos**
- Reynolds 1999: integrador de steering, seek, arrive e pursuit. https://www.red3d.com/cwr/steer/gdc99/
- Holden, Motion-Matching: mola de 0,27 s, razões de velocidade, constantes de pé travado e correção da raiz. https://github.com/orangeduck/Motion-Matching/blob/main/controller.cpp
- Clark, Ryan, Weyand et al. 2023 (J Hum Kinet), "Horizontal Foot Speed During Submaximal and Maximal Running": pico do pé no balanço = 2,00 ± 0,15 × a velocidade (3,1–10 m/s) e velocidade do pé ao tocar o chão (GSD) = 0,19·v + 0,81 m/s — usados no limite por quadro do teste de patinação, no perfil do balanço e no limite da passada acelerada. https://pmc.ncbi.nlm.nih.gov/articles/PMC10203846/
- van der Straaten et al. 2020 (J Appl Biomech): pé a ~4,6 m/s no meio do balanço andando — piso do limite do pé em baixa velocidade e perfil do balanço (pico ≈ 1,35 × a média).
- Clavet/For Honor (Game Anim): previsibilidade acima de responsividade, 15 cm, taxa de reprodução de −20% a +10%. https://www.gameanim.com/?p=13538
- Epic/Lyra: limite de 15–20% para taxa de reprodução e stride warping. https://www.unrealengine.com/tech-blog/adapting-lyra-animation-to-your-ue5-game
- Bollo, GDC 2018: inercialização por polinômio de grau 5. https://www.gdcvault.com/play/mediaProxy.php?sid=1025331
- Kaufmann 2023: inclinação pela aceleração e frenagem mais rápida que a aceleração. https://blog.littlepolygon.com/posts/loco1/
- Rosen, GDC 2014: física primeiro, poucas poses-chave (não conferido). https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach
- EA FC 24: três marchas de condução e toque de esforço. https://www.ea.com/en-gb/games/ea-sports-fc/pitch-notes/news/fc-24-gameplay-deepdive
- EA FC 26 (com o FC 27): toque de esforço automático, tipos de aceleração e condução desequilibrada. https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive
- Konami eFootball v5: aceleração com bola caindo com a velocidade e IA a 70% da velocidade. https://www.konami.com/efootball/en/page/v5/versioninfo_v5-00
- Sutphin 2013: zona morta radial escalada. https://www.gamedeveloper.com/business/doing-thumbstick-dead-zones-right
- Pérez Ramil 2017: zona morta híbrida, zona externa e curva de resposta. https://github.com/Minimuino/thumbstick-deadzones
- Mick West 2008: ordem do quadro e meta de 3 quadros de latência. https://www.gamedeveloper.com/design/measuring-responsiveness-in-video-games
- Cattan et al. 2017: limiares de latência ao arrastar e ao tocar. http://tripet.imag.fr/publs/2017/CHI17_Cattan_lag_learn.pdf

**three.js e campo**
- Medição no jsDelivr: tamanho do núcleo e cache por versão. https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js
- jsDelivr, addons .min.js: minificação sob demanda, sem SRI. https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.min.js
- Manual three.js r170, "Installation": importmap com addons. https://raw.githubusercontent.com/mrdoob/three.js/r170/docs/manual/en/introduction/Installation.html
- MDN, importmap: ordem e barra final nas chaves. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap
- Migration Guide: só WebGL 2 desde a r163 e espaço de cor desde a r152. https://raw.githubusercontent.com/wiki/mrdoob/three.js/Migration-Guide.md
- web3dsurvey: suporte a WebGL 2, extensões, maxTextureSize e anisotropia. https://web3dsurvey.com/webgl2
- WebGLRenderer.js r170: contagem de chamadas, recompilação e compileAsync. https://raw.githubusercontent.com/mrdoob/three.js/r170/src/renderers/WebGLRenderer.js
- Manual three.js r170, "Shadows" (com shadowmap_pars_fragment): custo por tipo de sombra. https://raw.githubusercontent.com/mrdoob/three.js/r170/manual/en/shadows.html
- Microsoft Learn: arredondar a projeção da luz ao texel contra a tremulação. https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps
- Utsubo, 100 dicas: tamanho do mapa de sombra, orçamento no celular e DPR ≤ 2. https://www.utsubo.com/blog/threejs-best-practices-100-tips
- Arm, Mali Performance 5 e Game Set and Batch: orçamento de draw calls. https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/mali-performance-5-an-application-s-performance-responsibilities
- docs InstancedMesh e Frustum.js r170: esfera de recorte calculada uma vez só. https://raw.githubusercontent.com/mrdoob/three.js/r170/src/math/Frustum.js
- Manual three.js r170, "Color management": colorSpace sRGB nas texturas de cor. https://raw.githubusercontent.com/mrdoob/three.js/r170/docs/manual/en/introduction/Color-management.html
- MDN, WebGL best practices: custo dos mipmaps. https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Arm GPU Best Practices: custo da anisotropia e MSAA 4x. https://support.arm.com/documentation/101897/0304/Buffers-and-textures/Anisotropic-sampling-performance
- UEFA Pitch Quality Guidelines 2025: faixas de corte do gramado. https://www.nzs.si/sites/default/files/media/document/UEFA%20Pitch%20Quality%20Guidelines%20-%202025%20Edition.pdf
- IFAB, Lei 1: medidas do campo e das linhas. https://www.theifab.com/laws/latest/the-field-of-play/
- model-viewer, Tone Mapping (com tonemapping_pars_fragment r170): escolha do Neutral. https://modelviewer.dev/examples/tone-mapping
- Fórum three.js e drei PerformanceMonitor: ajuste dinâmico de resolução. https://discourse.threejs.org/t/changing-pixelratio-based-on-fps-good-or-bad-idea/34563

---

## 4. Pontos de incerteza

**Bola**
- **Onde cai a crise do arrasto.** Asai & Seo dão o Re crítico entre 2,2 e 3,3×10⁵, conforme a bola. Passmore dá a queda entre 1,2 e 2,2×10⁵ (≈8–15 m/s). Em voo real, Goff et al. 2017 acham o mínimo em 12,5–13 m/s (Re ≈ 1,7×10⁵). A rampa proposta (10–16 m/s) é um meio-termo.
- **C_D no patamar alto diverge:** 0,15–0,18 (Asai), 0,13–0,24 (Passmore), 0,17–0,22 (Goff 2017), 0,2 e 0,17 (Goff & Carré 2009) e 0,25–0,30 em faltas reais com spin (Bray & Kerwin).
- **Os polinômios de Goff 2017** têm confiança média: divergem fora de 9,3–29,9 m/s e usam outra área de referência (0,0333 m², daí o fator 0,88).
- **A saturação do Magnus** tem poucos pontos: Passmore dá 0,258 em Sp 0,50 a ~12 m/s, e Goff & Carré 2012 dão ~0,35 em Sp 0,5 a 14 m/s. O valor de 0,30–0,35 é interpolação.
- **A bola que flutua:** a forma senoidal, a amplitude de 0,05–0,10 e o período de 90–180° são proposta da pesquisa. Passmore só mediu a faixa de ±0,05 a ±0,17 a 30 m/s.
- **O decaimento do spin** tem faixa ampla (k de 0,003 a 0,009, um fator 3). O valor 0,006 é o ponto médio.
- **A lei de rolagem c·v^1,35** é cálculo da pesquisa (cruza dois ensaios, confiança média), com c entre 0,31 e 0,57. Com c = 0,42 a bola para em 7,8 m, contra o alvo de ~7 m da FIFA. O piso de 0,05 m/s² é só um exemplo.
- **O passe real com 7,93 m/s² de perda:** a explicação (deslizamento + arrasto) é hipótese da pesquisa, e o μ ≈ 0,5 vem de quadra de tênis (Wimbledon), não de gramado de futebol.
- **e_y caindo com a velocidade:** **falta** a inclinação, e a fonte é sobre bola de tênis.
- **O e_x de +0,1 a +0,4** é cálculo da pesquisa para fechar o rebote oblíquo da FIFA. A chuva diverge: a FIFA aceita rebote maior no molhado, enquanto Sánchez-Sánchez et al. (2019) mediram rebote menor. O ensaio da UEFA (15°) não é comparável.
- A altura de ~1,1 m no teste de Goff & Carré 2009 foi deduzida pela pesquisa. A falta de Beckham vem de análise de vídeo (confiança média).

**Jogador**
- **Teto de velocidade:** 8,91 m/s no teste de 30 m (Alemanha), S0 de 9,22–9,50 m/s em jogo (Espanha) e pico em jogo de 8,1–8,8 m/s (Brasil). Ligas, métodos e épocas diferentes.
- **A0** vale 8,26–8,68 m/s² em dia de jogo e 5,7–6,6 em treino (confiança média).
- **Responsividade contra realismo:** a meia-vida de 0,27 s do Holden (personagem genérico, com corrida de 4,0 m/s) responde bem mais rápido que o τ ≈ 1,1 s medido em futebolistas, e o teste do Baumgart reprova a v_max em menos de 2 s. O exemplo de Kaufmann (0,5 s para acelerar e 0,25 s para frear) é estilizado. A escolha precisa ser medida.
- **Passada perto de 9 m/s:** Dorn (corredores) dá 4,36 passos/s e passo de 2,05 m a 8,99 m/s; Takai (futebolistas) dá 4,73 passos/s e 1,98 m a 9,33 m/s.
- **Frenagem:** os 4,45 m/s² vêm de universitários de futebol, rúgbi e netbol, não só de futebolistas.
- **Corte:** a revisão traz duas tabelas de ângulo executado (17,5–34,9° e 25,5–39,5°). A atribuição de Hader (4,3 m a 45° e 7,1 m a 90°) é ambígua. Acima de 5 m/s não há dado. Do estudo do 505 só se leu o resumo, sem forças absolutas. **Todos os dados de corte são sem bola**: **falta** dado de corte com bola.
- **Penalidade da bola diverge:** profissionais (Benhassen: +16% em 5 m e +10% em 20 m; os percentuais por posição do texto não batem com a tabela), jovens (Manouras: +28,7% em 30 m) e mulheres profissionais (Preissler: −9% de velocidade média em 20 m). O fator de 0,8–0,85 do Carling compara ligas e épocas diferentes.
- **Velocidades de trote e corrida com bola por marcha:** **falta** número direto.

**Toque de condução**
- **Toque por passada no trote:** **falta** fonte com número; a EA só descreve em termos qualitativos.
- **Distância bola–pé na condução rápida:** **falta** (a pesquisa não achou estudo).
- Os toques por segundo na arrancada são cálculo da pesquisa a partir de "5 a 8 toques em 20 m". Zago é estudo pequeno, com jovens, e vale como tendência. Os intervalos de toque da EA FC 26 não foram publicados, nem a curva de aceleração com bola da Konami. O prazo de 0,3 s sem a bola voltar a bater no corpo é da pesquisa.

**Animação e controle**
- **Ganho da inclinação:** 0,64° por m/s² é de jogo estilizado e atan(a/g) é física da pesquisa. O único dado medido é o tronco no corte.
- O expoente de 1,5–2 da curva do analógico é sugestão da pesquisa. A zona morta ideal depende do controle (0,1 a 0,25).
- Rosen (GDC 2014) tem confiança baixa: vídeo e slides não foram conferidos.
- slowing_distance = v²/(2·a_frenagem) é derivação da pesquisa; Reynolds não dá valores padrão.

**Determinismo e render**
- sin, cos, atan2 e exp só dão replay garantido no mesmo motor e na mesma versão. O hash entre Node e Chromium vale só porque os dois usam V8.
- O benchmark dos geradores é uma medição local (confiança média).
- Orçamentos de draw calls divergem: abaixo de 50 (Arm 2013), algumas centenas (Arm 2015) e abaixo de 100 (Utsubo).
- O ajuste dinâmico de DPR tem confiança média e se apoia em números de fórum. **Falta** o valor de normalBias da sombra ("a calibrar"). **Faltam** os ms de GPU de cada tipo de sombra e de cada nível de anisotropia (têm de ser medidos).

**Fora da pesquisa (falta para a Etapa 1)**
- **Câmera:** nenhum número de altura, distância, FOV ou suavização foi pesquisado.
- **Jogador:** faltam altura, massa, raio de colisão, alcance do pé e tempo de reação.
- **Chute:** não há tabela de velocidade de saída por tipo de chute; só referências soltas (passe a 16,2 m/s, chutes medidos entre 19 e 31 m/s, faltas a 25–36 m/s).
