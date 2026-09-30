# Céu do Rio: simulador de voo

Simulador de Cessna 172 sobre o Rio de Janeiro que roda no navegador, em PC e celular.
Usa three.js (WebGL 2) e não tem etapa de build: são arquivos estáticos, publicados pelo GitHub Pages em `/aviao/`.

## Fase 1: protótipo de voo (esta entrega)

- **O Rio de verdade.** São 32 × 32 km jogáveis com relevo Copernicus de 30 m e imagem Sentinel-2 de 7,8 m/px. O horizonte vai até 64 km.
- **Paisagem.** Água da baía, do oceano e da Lagoa com ondas e reflexo do céu. A Terra tem curvatura no horizonte.
- **Aeroportos reais.** Santos Dumont e Galeão com pistas nas posições reais (OurAirports), sinalização ICAO, luzes de borda e de cabeceira e PAPI.
- **Cidade e marcos.** São 57 mil prédios gerados sobre a mancha urbana real, e as janelas acendem à noite. Há também o Cristo Redentor, a Ponte Rio–Niterói e o Maracanã.
- **Física de voo.** São 6 graus de liberdade com derivadas aerodinâmicas típicas do C172:
  - estol com queda de asa, torque e fator P;
  - flapes elétricos, compensador e densidade do ar pela altitude;
  - vento, rajadas e limite estrutural de carga G;
  - trem de pouso com mola, amortecedor, freio e bequilha que esterça.
- **Desempenho medido contra o avião real:**

  | Item | Simulador | Cessna real |
  |---|---|---|
  | Corrida de decolagem | 324 m | ~290 m |
  | Subida a Vy | 690 pés/min | 730 pés/min |
  | Cruzeiro a 75% | 107 kt | ~110 kt |
  | Estol sem flape | 41 kt indicados | 44 kt |
  | Planeio | 9,4:1 | ~9:1 |

- **Cabine e câmeras.** Painel "six-pack" completo (velocímetro, horizonte artificial, altímetro, coordenador de curva, giro direcional, variômetro e tacômetro), manche que se mexe, e quatro câmeras: cabine, perseguição, órbita e torre.
- **Céu e clima.** Sol na posição astronômica real sobre o Rio, céu de dispersão atmosférica, estrelas, nuvens cúmulo, névoa de perspectiva aérea e luzes da cidade à noite.
- **Controles.** Teclado e mouse, gamepad, manche USB, e no celular manche virtual com manete ou inclinação do aparelho. Há três níveis de assistência.
- **Pousos e acidentes.** Nota do pouso pela razão de descida no toque. Acidentes detectados contra o chão, a água, os prédios, os marcos e por excesso de carga.
- **Ícone na tela de início.** No celular, use "Adicionar à tela de início": o jogo ganha o próprio logo e abre em tela cheia.
- **Qualidade.** Automática ou manual (Baixa, Média, Alta e Ultra) com resolução dinâmica. O som do motor, do vento e da buzina de estol é gerado por procedimento.

## Fase 2: missões e controle simples (esta entrega)

- **Controle Simples (WASD), o padrão:**
  - W acelera, S desacelera e freia, A/D fazem curva e ↑/↓ sobem e descem;
  - o avião decola sozinho a 55 nós, sobe até 500 pés e voa nivelado quando o jogador solta as teclas;
  - por baixo continua a mesma física realista.
- **Controle Simulador:** o modo realista da Fase 1 continua disponível no menu.
- **Seis missões com até 3 estrelas:**
  - Primeiro voo;
  - Argolas na orla (do Leme ao Leblon);
  - Pouso no Santos Dumont;
  - Circuito no Galeão;
  - Pane no motor;
  - Volta ao Cristo.
- **Durante a missão:**
  - argolas 3D;
  - seta de navegação com distância e altitude;
  - cronômetro;
  - avaliação do pouso pela razão de descida no toque e pela distância ao eixo;
  - voz da torre pelo sintetizador de voz do navegador;
  - recorde de estrelas salvo no aparelho.

## Rodar localmente

```bash
cd aviao && python3 -m http.server 8000   # abra http://localhost:8000
```

Parâmetros úteis na URL: `?quality=low|medium|high|ultra`, `?autostart=1&start=air-copa&time=por`, `?fps=1`.

## Regerar os dados

Rode `python3 tools/build_assets.py <pasta_downloads> .`. O script baixa os tiles da imagem sozinho. Os DEMs vêm de
`https://copernicus-dem-30m.s3.amazonaws.com/` (tiles S23/S24 × W044/W043) e `runways.csv` vem do OurAirports.

## Créditos e licenças

- Copernicus GLO-30 DEM, © DLR e Airbus, fornecido pela ESA.
- Sentinel-2 cloudless 2020, de EOX IT Services GmbH (s2maps.eu), **CC BY-NC-SA 4.0, uso não comercial**.
- OurAirports (domínio público), ambientCG (CC0) e three.js (MIT).
