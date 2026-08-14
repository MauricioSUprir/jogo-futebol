# Deploy do CreateFlow no Railway

Guia passo a passo para colocar o CreateFlow no ar (app + banco Postgres) no
[Railway](https://railway.app). Não precisa mexer em código — o repositório já
está configurado (`railway.json` + `Dockerfile`), e as migrations + o usuário
admin são criados automaticamente no primeiro deploy.

---

## 1. Criar a conta

1. Acesse **https://railway.app** e clique em **Login** → **Login with GitHub**.
2. Autorize o Railway a acessar sua conta do GitHub.

## 2. Criar o projeto a partir do repositório

1. Clique em **New Project** → **Deploy from GitHub repo**.
2. Escolha o repositório **`MauricioSUprir/jogo-futebol`**.
3. Em **branch**, selecione a branch que tem o CreateFlow:
   - Se você já mesclou o PR, use **`main`**.
   - Se ainda não mesclou, use **`claude/video-content-management-system-ec1jki`**.
4. O Railway vai detectar o `Dockerfile` e começar a preparar o build.

## 3. Adicionar o banco de dados

1. Dentro do projeto, clique em **New** → **Database** → **Add PostgreSQL**.
2. Pronto — o Railway cria o Postgres e uma variável `DATABASE_URL` no serviço do banco.

## 4. Configurar as variáveis de ambiente do app

Abra o **serviço do app** (o card do CreateFlow, não o do Postgres) →
aba **Variables** → **New Variable**, e adicione estas:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(referência ao banco — o Railway completa sozinho ao digitar `${{`)* |
| `AUTH_SECRET` | `ztDfbYB8Z2rJjsmQrn86hgImcqZ0rgCkmyKSH3S5V1A=` *(já gerei um pra você; pode usar esse)* |
| `AUTH_TRUST_HOST` | `true` |
| `ANTHROPIC_API_KEY` | sua chave da Claude API (para as sugestões de IA) |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `SEED_ADMIN_EMAIL` | seu email de login (ex.: `mauricio@gruposuprir.com`) |
| `SEED_ADMIN_PASSWORD` | uma senha forte que **você** escolher |
| `SEED_ADMIN_NOME` | seu nome (ex.: `Criadora`) |

> **Não** defina `PORT` — o Railway injeta automaticamente.
> A chave da Claude API vive só aqui, no servidor; nunca vai para o navegador.

## 5. Gerar o endereço público

1. No serviço do app → **Settings** → **Networking** → **Generate Domain**.
2. O Railway cria uma URL tipo `https://createflow-production.up.railway.app`.
3. *(Opcional, recomendado)* copie essa URL e adicione uma variável
   `AUTH_URL` com esse valor.

## 6. Deploy

O Railway faz o deploy sozinho a cada push. No primeiro deploy ele:

1. Constrói a imagem (Dockerfile).
2. Roda **migrations** + **bootstrap** (cria o admin, 3 pilares e a config) —
   isso está no `railway.json`, você não precisa fazer nada.
3. Sobe o app.

Quando aparecer **Deployed / Success**, abra a URL do passo 5 e faça login com o
`SEED_ADMIN_EMAIL` e a `SEED_ADMIN_PASSWORD` que você definiu. 🎉

---

## Dados de exemplo (opcional)

O bootstrap cria só o essencial (admin + pilares) para você começar do zero.
Se quiser popular os **8 vídeos de exemplo com métricas** (útil pra testar o
dashboard e a IA), rode uma vez, apontando para o banco do Railway:

```bash
# pegue a "Postgres Connection URL" pública em: serviço Postgres → Variables → DATABASE_PUBLIC_URL
DATABASE_URL="<cole a DATABASE_PUBLIC_URL aqui>" npm run db:seed
```

> ⚠️ O `db:seed` **recria** os dados (apaga o que existir). Use só para demonstração.

## Custos

- Railway tem um **crédito de teste** para começar de graça.
- Depois, o plano **Hobby (~US$5/mês)** cobre o app + o Postgres para uso pequeno/médio.
- A **Claude API** é cobrada à parte, por uso (só quando você gera sugestões).

## Atualizações

Toda vez que você (ou eu) fizer push na branch conectada, o Railway
**reconstrói e sobe sozinho** — e as migrations rodam de novo automaticamente,
sem apagar seus dados.
