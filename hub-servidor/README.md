# Hub da Família — servidor

Versão **com servidor** do Hub da Família: login de verdade por **e-mail + senha**
(senhas protegidas com **hash bcrypt**), dados em **banco Postgres** e
**sincronização entre celulares** — cada pessoa entra na sua conta de qualquer
aparelho e vê os mesmos dados.

> É a evolução da versão estática em [`../hub-familiar/`](../hub-familiar/): mesmas
> telas, mas agora os dados ficam no servidor, não no aparelho.

## O que tem

- **4 contas**: 2 admins (Maurício e Thaís) e 2 membros (Anna Luisa e Guilherme).
- **📣 Avisos** — admins publicam comunicados (texto + imagem) para **todos** ou
  **pessoas escolhidas**; todos comentam.
- **⭐ Atividades** — admins criam e definem os **pontos**; só **membros** fazem e
  ganham. Admins ditam, não pontuam.
- **🏆 Placar** — ranking de pontos por membro + **valor em dinheiro**
  (cada ponto = R$ 0,50, editável) e totais. Admins ajustam/tiram pontos.
- **🍽️ Cardápio da semana**, **📅 Encontros** (admins) e **⚙️ Contas** (admins
  editam as 4 contas; membros trocam a própria senha).

## Stack

Node puro (sem framework) + **Postgres** (biblioteca [`postgres`](https://github.com/porsager/postgres)) +
**bcryptjs** para as senhas. Sessão por **cookie assinado** (HttpOnly). Um só
processo `node server.mjs` que serve a interface (em `public/`) e a API (`/api/...`).

## Rodar localmente

Pré-requisitos: **Node 20+** e um **Postgres**.

```bash
cd hub-servidor
npm install
cp .env.example .env         # defina DATABASE_URL e SESSION_SECRET
npm start                    # http://localhost:3000
```

Na primeira execução o servidor **cria as tabelas e semeia as 4 contas**
automaticamente (só se o banco estiver vazio).

## Publicar (produção)

O app é um servidor Node **sempre ligado** — funciona em qualquer lugar que
rode um processo Node com um Postgres: **Railway, Render, Fly.io, ou uma VPS**
(via Docker). Passos gerais:

1. **Crie um banco Postgres** (ex.: [Neon](https://neon.tech) grátis,
   Railway, Supabase) e copie a connection string.
2. **Suba o servidor** apontando as variáveis:
   - `DATABASE_URL` = a connection string do passo 1
   - `SESSION_SECRET` = um valor aleatório e secreto
     (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`)
3. Acesse a URL pública e faça login. As tabelas e contas são criadas sozinhas.

### Com Docker

```bash
docker build -t hub-familia .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgres://.../hub?sslmode=require" \
  -e SESSION_SECRET="seu-segredo" \
  hub-familia
```

### Railway (mais direto)

Crie um projeto, adicione o plugin **Postgres**, aponte o serviço para esta
pasta (`hub-servidor`) e defina `SESSION_SECRET`. O `DATABASE_URL` o Railway
injeta sozinho. O `Dockerfile` já está pronto.

> Observação: **Vercel** é serverless (sem processo sempre ligado); para rodar lá
> seria preciso adaptar a API para funções. Railway/Render/Fly/VPS rodam este
> servidor sem mudanças.

## Contas e segurança

- As senhas iniciais são as combinadas com a família; **troque-as** depois em
  **⚙️ Contas** (admin) ou cada membro na sua conta.
- No repositório ficam apenas os **hashes** das senhas (nunca o texto puro).
- Defina sempre um `SESSION_SECRET` forte em produção.

## Estrutura

```
hub-servidor/
├─ server.mjs            # servidor HTTP + API
├─ seed.mjs              # cria/seedeia as 4 contas (idempotente)
├─ lib/db.mjs            # conexão Postgres + criação das tabelas
├─ lib/auth.mjs          # hash de senha + cookie de sessão
├─ public/              # interface (index.html + ícones + manifest)
├─ Dockerfile
└─ .env.example
```
