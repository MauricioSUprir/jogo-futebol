# Quanto o Gemini grátis aguenta no MindTrack AI

_Relatório de 04/11/2026. O teste é `node testes/capacidade-gemini.mjs` e pode ser rodado de novo quando os limites mudarem._

## Resumo em 30 segundos

- **Plano grátis do Gemini: cerca de 1.040 respostas de IA por dia, no total, para o app inteiro.**
  - O limite vale para o projeto do Google, não para cada aluno.
  - Criar várias chaves no mesmo projeto não aumenta a cota.
- Isso atende, com folga:
  - **~130 alunos ativos por dia** que façam 8 perguntas cada;
  - **~260 alunos** que façam 4 perguntas cada;
  - **~70 alunos** que façam 15 perguntas cada.
- **Por minuto, o teto é ~30 perguntas ao mesmo tempo.**
  - Uma turma de 30 perguntando no mesmo minuto: todos são atendidos.
  - Com 60 no mesmo minuto, metade espera de 1 a 2,5 minutos (o app pede para tentar de novo).
- **As respostas instantâneas do chat não gastam cota.** Exemplos: "o que eu estudo agora?", "quais aulas tenho amanhã?", "minhas provas". Somam a esses números.
- **Atenção, mais importante que a cota:** pelos termos da API do Gemini, ela **não pode ser usada em app voltado a menores de 18 anos**. Detalhes na seção 4.

## 1. Os limites do plano grátis (por projeto)

| Modelo (ordem da escada) | Perguntas/minuto | Perguntas/dia | Papel no MindTrack |
|---|---|---|---|
| gemini-3.8-flash | 5 | 20 | o melhor; começa por ele no Plus |
| gemini-3.6-flash | 5 | 20 | começa por ele no Pro |
| gemini-3.5-flash-lite | 10 | 500 | onde vai a maior parte do dia |
| gemini-3.1-flash-lite | 10 | 500 | reserva |
| gemini-2.5-flash-lite | ? | ? | sem número oficial confirmado; o teste NÃO conta com ele |
| **Total** | **~30** | **1.040** | |

- **Quando a cota renova:** à meia-noite do horário do Pacífico, ou seja, às **05:00 de Brasília** (04:00 entre março e novembro).
- **De onde vêm os números:** do AI Studio e de guias de novembro de 2026. Confira os seus em [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit), porque o Google muda esses limites sem aviso.

## 2. O teste (uso simulado de um dia inteiro)

O teste roda o **código de verdade** da escada de modelos do servidor (`src/ia.js`) contra um Gemini de mentira que aplica os limites acima, com um relógio simulado. Como os alunos usam o app no teste:

- Perguntas espalhadas pelo dia como um aluno usa: pouco de manhã, pico das 16h às 22h.
- 20% dos alunos são Plus e 80% são Pro.
- Tipo de pedido: 15% simples, 75% normais e 10% difíceis.
- Quando o limite por minuto bate, o aluno tenta de novo depois de ~1 minuto.

| Alunos ativos no dia | Perguntas à IA por aluno | Pedidos no dia | Respondidas | Cota do dia acabou às |
|---|---|---|---|---|
| 25 | 15 | 375 | **100%** | — |
| 50 | 8 | 400 | **100%** | — |
| 50 | 15 | 750 | **100%** | — |
| 75 | 8 | 600 | **100%** | — |
| 75 | 15 | 1.125 | 92% | 22:30 |
| 100 | 8 | 800 | **100%** | — |
| 100 | 15 | 1.500 | 69% | 20:14 |
| 150 | 4 | 600 | **100%** | — |
| 150 | 8 | 1.200 | 87% | 21:48 |
| 200 | 4 | 800 | **100%** | — |
| 200 | 8 | 1.600 | 65% | 19:38 |
| 200 | 15 | 3.000 | 35% | 16:12 |

Uma turma inteira perguntando **no mesmo minuto** (por exemplo, numa aula):

| Alunos no mesmo minuto | Na hora | Depois de "tentar de novo" | Sem resposta | Maior espera |
|---|---|---|---|---|
| 20 | 20 | 0 | 0 | — |
| 30 | 29 | 1 | 0 | 85 s |
| 40 | 30 | 10 | 0 | 88 s |
| 60 | 30 | 30 | 0 | 156 s |

Pontos que o teste confirma:
- A escada usa os modelos melhores até acabar a cota deles. Só as **40 primeiras perguntas do dia** saem dos modelos "flash"; as outras saem dos "flash-lite", que são bons, mas um pouco mais simples.
- O dia nunca passa de 1.040 respostas de IA.
- Quando a cota acaba, o app avisa e as respostas instantâneas continuam funcionando.

## 3. E se crescer? (plano pago do Gemini)

Com cobrança ligada no projeto do Google, os limites sobem para milhares por minuto e cada pergunta passa a custar.

**Custo estimado:** ~2.500 tokens de entrada e ~500 de saída por pergunta, com dólar a R$ 5,50.

| Modelo | Preço (entrada / saída, por 1 milhão de tokens) | Custo por pergunta | 400 perguntas (o máximo do Pro no mês) |
|---|---|---|---|
| gemini-3.5-flash-lite | US$ 0,30 / US$ 2,50 | ~R$ 0,01 | ~R$ 4,50 |
| gemini-3.6-flash | US$ 0,75–1,50 / US$ 3,75–7,50 | ~R$ 0,02–0,04 | ~R$ 8–16 |

- O Pro custa R$ 24,90/mês. Mesmo o aluno que usa tudo dá lucro com o flash-lite.
- Os preços do 3.6-flash variam entre as fontes. Confira em [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing).
- **No plano pago o Google também para de usar as perguntas para melhorar os produtos dele.** Ver a seção 4.

## 4. ⚠️ Os termos de uso do Gemini (ler antes de lançar)

Os [Termos Adicionais da API do Gemini](https://aistudio.google.com/docs/terms) dizem:

1. **"You must be 18 years of age or older to use the APIs"**: quem cria e usa a chave precisa ser maior de idade. A chave deve ser criada na conta do responsável.
2. **Não pode ser usada em site ou app "directed towards or is likely to be accessed by individuals under the age of 18"**: um app de estudos para alunos de escola se encaixa nisso, **no plano grátis e no pago**.
3. No plano grátis, **o Google pode usar perguntas e respostas para melhorar os produtos dele, e pessoas podem ler** esse conteúdo. Os termos pedem para não mandar dados pessoais. O app já manda o mínimo, mas inclui as matérias e o que o aluno escreve.

**O que fazer (decisão do dono, com o responsável):**
- **Para testar agora**, com poucos usuários de teste: dá para usar o Gemini grátis, sabendo desses limites.
- **Para lançar para alunos menores de idade**, são três caminhos:
  - **(a) Claude, da Anthropic**, que o servidor já suporta (é só trocar a chave). A [política de uso da Anthropic](https://www.anthropic.com/legal/aup) permite que empresas atendam menores desde que coloquem proteções extras (confira os requisitos atuais antes). É pago: em torno de R$ 0,01 a R$ 0,03 por pergunta com o modelo menor.
  - **(b) Lançar só para maiores de 18**, como cursinho, pré-vestibular ou faculdade.
  - **(c) Pedir uma orientação jurídica** antes, se o público for de escola.

## 5. Como rodar o teste de novo

```bash
cd studylab-server
npm run capacidade            # todos os cenários (menos de 1 segundo)
```

Se o Google mudar os limites, troque os números de `COTAS` no começo de `testes/capacidade-gemini.mjs`.

Fontes:
- [Limites do plano grátis — scriptbyai](https://www.scriptbyai.com/gemini-api-free-tier-limits/)
- [Rate limits — AI Studio](https://aistudio.google.com/docs/rate-limits)
- [Termos da API do Gemini](https://aistudio.google.com/docs/terms)
- [Preços — getmaxim](https://www.getmaxim.ai/articles/gemini-api-pricing-in-2026-and-how-to-cut-what-you-pay/)
- [Preços — dev.to](https://dev.to/hassann/gemini-36-flash-pricing-what-it-actually-costs-in-2026-59he)
- [Preços — laozhang](https://blog.laozhang.ai/en/posts/gemini-api-pricing.md)
