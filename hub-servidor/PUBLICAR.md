# Publicar o Hub da Família (grátis, ~10 min)

Depois disso, **todos os celulares sincronizam**: o que um publica, os outros
veem. São 2 partes gratuitas: um **banco de dados** (Neon) e a **hospedagem**
(Render).

## Parte 1 — Banco de dados (Neon, grátis e permanente)

1. Acesse **https://neon.tech** e clique em **Sign up** (dá pra entrar com o Google).
2. Crie um projeto (**Create project**) — pode deixar o nome padrão.
3. Na tela do projeto, procure **Connection string** e **copie** o texto que
   começa com `postgres://...` (é o endereço do banco). Guarde — vamos colar já já.

## Parte 2 — Hospedagem (Render, grátis)

1. Acesse **https://render.com** e clique em **Get Started** / entre com o **GitHub**.
2. Clique em **New +** → **Blueprint**.
3. Conecte o repositório **MauricioSUprir/jogo-futebol** e, quando pedir o
   **branch**, escolha **`claude/family-hub-accounts-5x3mk5`**.
4. O Render vai achar o arquivo `render.yaml` e mostrar o serviço **hub-familia**.
   Ele vai pedir a variável **DATABASE_URL** → **cole ali a string do Neon** (da Parte 1).
   O **SESSION_SECRET** ele preenche sozinho.
5. Clique em **Apply** / **Create** e aguarde alguns minutos (a primeira vez demora um pouco).
6. Quando terminar, o Render mostra um **link** tipo `https://hub-familia.onrender.com`.
   **Esse é o link do app de verdade** — mande pra família!

## Entrar

Cada um entra com o **seu e-mail e a senha combinada em família** (as 4 contas
— Maurício e Thaís como admin, Anna Luisa e Guilherme como membros — já vêm
criadas no primeiro acesso). Depois, cada um pode trocar a própria senha em
**⚙️ Conta**, e o admin pode mudar tudo (nome, e-mail, senha, papel) em
**⚙️ Contas**.

> Por segurança, as senhas não ficam escritas aqui no repositório — só os
> **hashes** (embaralhados) no código. Se precisar lembrar qual é a senha de
> alguém, me pergunte no chat.

## Observações

- No plano grátis do Render, o app **"dorme"** depois de um tempo sem uso e o
  **primeiro acesso do dia pode levar ~30 segundos** pra abrir. Depois fica rápido.
- O banco do Neon é **permanente** no plano grátis — seus dados ficam guardados.
- Qualquer dúvida em algum passo, me manda o print que eu te ajudo. 💛
