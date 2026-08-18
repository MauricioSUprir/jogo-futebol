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
| `POST /entrar` | `{ idToken }` do Google → sessão de 30 dias + plano |
| `GET /eu` | quem sou eu, meu plano e meu uso de hoje |
| `POST /codigo` | `{ codigo }` → ativa o Pro |
| `GET /planos` | os planos e preços (o servidor é a fonte da verdade do valor) |
| `POST /pagar` | `{ planoId }` → link de pagamento no Mercado Pago |
| `POST /webhook/mercadopago` | o Mercado Pago avisa aqui quando alguém paga → libera o Pro |
| `GET /meus-pagamentos` | histórico do aluno |
| `POST /ia` | o Study AI (**só para assinante**) |
| `POST /cancelar` | cancela a assinatura |
| `GET /admin/numeros?token=` | usuários, assinantes e chamadas de hoje |
| `POST /admin/codigo?token=` | `{ codigo, dias, usosMax }` cria um código |

Tudo protegido por `Authorization: Bearer <sessão>`, CORS restrito às origens que você listar
e um freio por IP.

---

## Publicar no Railway (10 minutos)

1. No Railway, **New Project → Deploy from GitHub repo** e escolha `jogo-futebol`.
2. Em **Settings → Root Directory**, coloque `studylab-server`.
3. **+ New → Database → Postgres**. O Railway cria a `DATABASE_URL` sozinho — as tabelas são
   criadas no primeiro start.
4. Em **Variables**, adicione:
   - `ANTHROPIC_API_KEY` — a sua chave do console.anthropic.com
   - `SEGREDO` — uma frase longa e aleatória (assina as sessões)
   - `GOOGLE_CLIENT_ID` — o mesmo do app
   - `ORIGENS` — `https://mauriciosuprir.github.io`
   - `ADMIN_TOKEN` — outra frase secreta, para o painel
5. **Generate Domain**. Abra `https://SEU-DOMINIO/saude` e confira que veio
   `chaveConfigurada: true`.
6. Cole esse domínio em `studylab/js/produto.js` → `SERVIDOR` e publique o app.

Pronto: o Study AI passa a funcionar para quem tem o Pro, e a sua chave fica só no servidor.

---

## Ligar o pagamento (Mercado Pago)

1. Entre em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers) → **Suas
   integrações** → crie uma aplicação (tipo: pagamentos online, modelo: assinaturas).
2. Em **Credenciais de produção**, copie o **Access token** → variável `MP_ACCESS_TOKEN`.
3. Em **Webhooks**, cadastre a URL `https://SEU-SERVIDOR/webhook/mercadopago` e marque os
   eventos de **assinatura** (`preapproval` e `authorized payment`). Copie a
   **assinatura secreta** → variável `MP_WEBHOOK_SECRET`.
4. Coloque `URL_APP` com o endereço do app (para onde o aluno volta depois de pagar).

Como funciona: o app chama `POST /pagar`, o servidor cria a assinatura no Mercado Pago e
devolve o link do checkout. O aluno paga lá (o cartão nunca passa pelo seu código). Quando o
Mercado Pago confirma, ele chama o seu `/webhook`, o servidor **confere o aviso na API deles**
antes de liberar e soma os dias na assinatura. Avisos repetidos são ignorados, então ninguém
ganha 60 dias por um pagamento de 30. As renovações mensais chegam pelo mesmo caminho e
estendem a assinatura sozinhas.

**Sem `MP_WEBHOOK_SECRET` a verificação é pulada** — o servidor avisa no start. Configure antes
de vender de verdade: sem isso, qualquer um que descubra a URL poderia forjar um aviso.

Os preços ficam em `src/pagamento.js` → `PLANOS`. **O valor cobrado é o do servidor**, não o
que o app mostra — assim ninguém consegue pagar R$ 0,01 mexendo no navegador.

---

## Quanto custa (a conta que decide o preço)

Uma pergunta típica do Study AI manda ~2.500 tokens (as matérias, provas e erros do aluno) e
recebe ~500 de volta.

| Modelo | Por pergunta | 10 perguntas/dia = 300/mês |
| --- | --- | --- |
| `claude-opus-5` (padrão) | ~US$ 0,025 | ~US$ 7,50 (**R$ 41**) |
| `claude-sonnet-5` | ~US$ 0,014 | ~US$ 4,20 (**R$ 23**) |
| `claude-haiku-4-5` | ~US$ 0,005 | ~US$ 1,50 (**R$ 8**) |

Com a mensalidade de **R$ 29,99**, o Opus 5 só fecha a conta se o aluno perguntar pouco
(até ~5 vezes por dia). O Haiku 4.5 dá folga confortável. Para trocar, é uma variável:

```
MODELO=claude-haiku-4-5
```

Os limites `LIMITE_DIARIO` (padrão 40) e `LIMITE_MENSAL` (padrão 400) são a sua trava de
segurança: mesmo que um aluno resolva usar o dia inteiro, o prejuízo tem teto.

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
