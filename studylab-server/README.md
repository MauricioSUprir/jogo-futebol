# 🔐 studylab-server

O servidor do **StudyLab**. Ele existe por um motivo só: **a chave da Claude API não pode
ficar no celular do aluno**. Se ficasse, qualquer um copiaria e gastaria o seu dinheiro.

O que ele faz:

1. confere o login do Google;
2. devolve uma **sessão de 30 dias** para o app (o aluno não relogar toda hora);
3. checa **quem é assinante**;
4. só então chama a Claude API — com a sua chave, que nunca sai daqui;
5. conta o uso de cada aluno e corta quem passar do limite.

Sem dependência pesada: `node:http` puro + `jose` (valida o token do Google) + `postgres`.

---

## Rotas

| Rota | O que faz |
| --- | --- |
| `GET /saude` | está no ar? mostra modelo, banco e se a chave está configurada |
| `POST /entrar` | `{ idToken }` do Google **ou** `{ dispositivo }` → sessão de 30 dias + plano |
| `GET /eu` | quem sou eu, meu plano e meu uso de hoje |
| `POST /codigo` | `{ codigo }` → ativa o Pro |
| `GET /planos` | os planos e preços (o servidor é a fonte da verdade do valor) |
| `POST /pagar` | `{ planoId, forma }` → link do Mercado Pago (`unico` · `recorrente`) |
| `POST /pagar/pix` | `{ planoId, email }` → **QR Code e código copia-e-cola**, para pagar dentro do app |
| `POST /pagar/cartao` | `{ planoId, cartao }` → cobra o cartão **sem sair do app** (recebe só o token) |
| `GET /pagamento/chave-publica` | a chave pública do Mercado Pago, que monta o formulário do cartão |
| `GET /pagamento/:id` | o app pergunta "já caiu?" — se caiu, libera o Pro na hora |
| `POST /webhook/mercadopago` | o Mercado Pago avisa aqui quando alguém paga → libera o Pro |
| `GET /meus-pagamentos` | histórico do aluno |
| `POST /ia` | o Study AI (**só para assinante**) |
| `POST /cancelar` | cancela a assinatura |
| `GET /admin/numeros?token=` | usuários, assinantes e chamadas de hoje |
| `POST /admin/codigo?token=` | `{ codigo, dias, usosMax }` cria um código |

Tudo protegido por `Authorization: Bearer <sessão>`, CORS restrito às origens que você listar
e um freio por IP.

---

## Começar DE GRAÇA (Gemini)

Não quer gastar nada para testar? O servidor também fala com o **Gemini**, do Google,
que tem uma faixa gratuita **sem cartão**:

1. Entre em [aistudio.google.com](https://aistudio.google.com) com uma conta Google
   → **Get API key** → crie a chave.
2. No Railway, em vez de `ANTHROPIC_API_KEY`, configure `GEMINI_API_KEY`.
3. Pronto: o Study AI funciona de verdade, custo zero.

Regras de convivência das chaves:

- Só `GEMINI_API_KEY` → usa o Gemini (grátis).
- Só `ANTHROPIC_API_KEY` → usa a Claude (paga por uso).
- As duas → a **Claude vence** (mais estável para quem paga); `PROVEDOR=gemini` inverte.
- `MODELO_GEMINI` troca o modelo do Gemini (padrão `gemini-2.5-flash`).

⚠️ O limite do plano grátis do Gemini é **do app inteiro**, não por aluno — serve para
testar e para os primeiros usuários, mas quando houver assinantes pagando, ponha a
chave da Claude para ninguém ficar na fila (os limites por aluno continuam valendo
igual nos dois provedores).

---

## Publicar no Railway (10 minutos)

1. No Railway, **New Project → Deploy from GitHub repo** e escolha `jogo-futebol`.
2. Em **Settings → Root Directory**, coloque `studylab-server`.
3. **+ New → Database → Postgres**. O Railway cria a `DATABASE_URL` sozinho — as tabelas são
   criadas no primeiro start.
4. Em **Variables**, adicione:
   - `GEMINI_API_KEY` **ou** `ANTHROPIC_API_KEY` — a chave da IA (uma das duas é obrigatória;
     a do Gemini é grátis — veja a seção acima)
   - `SEGREDO` — frase longa e aleatória, assina as sessões **(obrigatória)** — o app gera uma
     para você em ⚙️ Configurações → Área do criador → *Gerar SEGREDO*
   - `ORIGENS` — `https://mauriciosuprir.github.io`
   - `ADMIN_TOKEN` — outra frase secreta, para o painel
   - `GOOGLE_CLIENT_ID` — **opcional**: sem ele o aluno entra por conta de aparelho e assina
     do mesmo jeito; com ele, ganha login do Google e recupera a conta em outro celular
5. **Generate Domain**. Abra `https://SEU-DOMINIO/saude` e confira que veio
   `chaveConfigurada: true`.
6. Cole esse domínio em `studylab/js/produto.js` → `SERVIDOR` e publique o app.

Pronto: o Study AI passa a funcionar para quem tem o Pro, e a sua chave fica só no servidor.

> `GET /saude` responde com um **checklist do que ainda falta** (`falta: [...]`,
> `studyAiPronto`, `pagamentoPronto`). O app mostra isso na Área do criador, então dá para
> conferir tudo pelo celular, sem abrir o Railway.

### Contas de aparelho (sem Google)

Se `GOOGLE_CLIENT_ID` não estiver configurado, o app sorteia um id e uma senha na primeira
abertura e guarda no próprio celular — dá para usar o Study AI e assinar normalmente. Quem
sabe só o id não entra: precisa da senha, que nunca sai do aparelho. A troca é que, sem
Google, o aluno não recupera a assinatura em outro celular.

---

## Ligar o pagamento (Mercado Pago) — Pix e cartão

1. Entre em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers) → **Suas
   integrações** → crie uma aplicação (produto: **Checkout Pro**).
2. Em **Credenciais de produção**, copie o **Access token** → variável `MP_ACCESS_TOKEN`.
3. Em **Webhooks**, cadastre `https://SEU-SERVIDOR/webhook/mercadopago`, marque os eventos de
   **pagamento** e de **assinatura**, e copie a **assinatura secreta** → `MP_WEBHOOK_SECRET`.
   (No Railway o servidor já descobre o próprio endereço, então o webhook das compras avulsas
   funciona mesmo sem esse cadastro — mas cadastre para as renovações.)
4. `URL_APP` com o endereço do app, para onde o aluno volta depois de pagar.

### As formas de pagar

| Forma | Como funciona | Observação |
| --- | --- | --- |
| **Pix dentro do app** (`POST /pagar/pix`) | O StudyLab mostra o **QR Code e o código copia-e-cola** na própria tela e fica consultando até o pagamento cair | O aluno não sai do app. Pix não tem cobrança automática: compra os dias e, quando acabar, compra de novo |
| **Cartão dentro do app** (`POST /pagar/cartao`) | O formulário é o do Mercado Pago (SDK deles) renderizado na tela do StudyLab; ele devolve só um **token**, e o número do cartão nunca chega ao nosso servidor | Precisa da `MP_PUBLIC_KEY`. Sem ela, cai automaticamente no Checkout Pro |
| **Cartão pelo Checkout Pro** (`forma: 'unico'`) | Abre o Mercado Pago em outra tela | Plano B, sempre disponível |
| **Cartão que renova** (`forma: 'recorrente'`) | Assinatura: cobra sozinho a cada período até cancelar | Só cartão |

Boleto fica de fora de propósito (demora dias para compensar e o aluno ficaria sem acesso).

### O valor já vem dentro do código Pix

O "copia e cola" é um **BR Code dinâmico**: o valor está gravado dentro dele (campo `54` do
padrão EMV). O banco lê de lá e mostra o valor pronto — **o aluno não digita nada**, só
confirma. Não existe a chance de ele pagar R$ 2,99 em vez de R$ 29,99.

Para nunca exibir um código ruim, `src/brcode.js` **confere antes de mostrar**:

- a soma de verificação (CRC16/CCITT-FALSE) bate → o código não veio corrompido nem cortado;
- o campo `54` existe → não é um código "aberto", daqueles em que o pagador digita o valor;
- o valor do campo `54` é **exatamente** o preço do plano;
- a moeda é real (`986`).

Se qualquer uma falhar, o servidor recusa e o aluno vê "tente de novo" — em vez de um Pix com
valor errado. Os testes cobrem código válido, valor trocado, código adulterado, código
truncado e código sem valor.

**Como o Pro é liberado sem depender de sorte:** o webhook do Mercado Pago libera assim que o
aviso chega, e o app **também** consulta `GET /pagamento/:id` a cada 4 segundos enquanto a tela
do Pix está aberta. Os dois caminhos passam pela mesma trava de "já processado", então quem
paga é liberado na hora — e ninguém ganha dias em dobro.

### Como o dinheiro chega até você

1. O aluno paga no site do Mercado Pago — **o cartão e a chave Pix nunca passam pelo StudyLab**.
2. O valor cai na **conta Mercado Pago dona do `MP_ACCESS_TOKEN`**, já descontada a taxa deles
   (Pix costuma ser a mais barata; cartão varia com o prazo de recebimento).
3. No app ou site do Mercado Pago, em **Seu dinheiro → Transferir**, você manda para a sua
   conta bancária. Dá para deixar **transferência automática** todo dia.
4. Para receber de verdade a conta precisa estar **verificada** (documento e dados bancários) e
   ser de alguém com 18 anos ou mais — sem isso o dinheiro entra mas fica preso.

Enquanto testa, use as **credenciais de teste** do Mercado Pago: o fluxo é idêntico e nenhum
dinheiro de verdade se move.

---

## Quanto custa (a conta que decide o preço)

Os planos têm **dois níveis** — os preços de verdade ficam em `src/pagamento.js`:

| Plano | Preço | Perguntas | Fotos |
| --- | --- | --- | --- |
| Pro semanal | R$ 7,90 | 30/dia · 400/mês | 5/dia (2 por pergunta) |
| Pro mensal | R$ 24,90 | 30/dia · 400/mês | 5/dia |
| Pro anual | R$ 199,90 | 30/dia · 400/mês | 5/dia |
| Plus mensal | R$ 44,90 | 80/dia · 1000/mês | 25/dia (4 por pergunta) |
| Plus anual | R$ 379,90 | 80/dia · 1000/mês | 25/dia |

Uma pergunta típica do Study AI manda ~2.500 tokens (as matérias, provas e erros do aluno) e
recebe ~500 de volta. Por pergunta: Haiku 4.5 ~US$ 0,005 (~R$ 0,03) · Sonnet 5 ~US$ 0,014 ·
Opus 5 ~US$ 0,025 (~R$ 0,13).

**O modelo padrão é o `claude-haiku-4-5`** — é o que garante lucro mesmo no pior caso:

- Pro: aluno que usa TUDO (400 perguntas/mês) custa ~R$ 12 → sobra ~R$ 13 dos R$ 24,90.
- Plus: pior caso (1000/mês, com fotos) custa ~R$ 35 → sobra ~R$ 10 dos R$ 44,90.
- O aluno comum (5–10 perguntas/dia) custa R$ 3–8/mês — o resto é margem.

Com Opus 5 o pior caso dá prejuízo, então só suba de modelo quando tiver margem. Variáveis:

```
MODELO=claude-haiku-4-5        # modelo de todo mundo (padrão)
MODELO_PLUS=claude-sonnet-5    # opcional: modelo melhor SÓ para o Plus
```

Os limites são a sua trava de segurança — mesmo o aluno mais intenso tem teto de custo:
`LIMITE_DIARIO`/`LIMITE_MENSAL` (Pro, padrão 30/400), `LIMITE_DIARIO_PLUS`/`LIMITE_MENSAL_PLUS`
(padrão 80/1000), `FOTOS_DIA`/`FOTOS_DIA_PLUS` (padrão 5/25). Se mudar os limites, atualize
também `LIMITES_PLANO` em `studylab/js/produto.js` (o que as telas mostram).

---

## Rodar na sua máquina

```bash
cd studylab-server
npm install
cp .env.example .env      # preencha ANTHROPIC_API_KEY e SEGREDO
node --env-file=.env src/index.js
```

Sem `DATABASE_URL` ele roda **em memória** — perfeito para testar, mas os dados somem quando
o servidor reinicia.

## Testes

```bash
npm run teste
```

Sobe o servidor em memória, com login simulado e a Claude API + Mercado Pago dublados, e
confere 36 pontos: login, sessão inválida, paywall, código de acesso, resposta do Study AI,
contagem de uso, limite diário, isolamento entre alunos, cancelamento, criação da assinatura,
webhook liberando o Pro, aviso repetido sendo ignorado, renovação somando dias e o painel do
admin (incluindo receita).

> `MODO_TESTE=1` liga um atalho que aceita login simulado. **Nunca** use isso em produção —
> o servidor avisa em letras garrafais no start quando essa variável está ligada.
