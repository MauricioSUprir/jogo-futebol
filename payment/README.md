# Total Match — Venda por link (Kiwify + chave validada por servidor)

Este pacote deixa o jogo pronto pra vender: a pessoa compra no **Kiwify**, recebe uma
**chave única**, e destrava o jogo. A chave é validada por um **servidor grátis
(Cloudflare Worker)** que impede a mesma chave de rodar em vários aparelhos.

```
Comprador  →  Kiwify (Pix/cartão)  →  recebe a chave  →  digita no jogo
                                                          ↓
                                       Worker (Cloudflare) valida e amarra ao aparelho
                                                          ↓
                                                  Jogo desbloqueado
```

O que fica livre na **demonstração**: Partida Rápida e Competições.
O que **exige compra**: Carreiras (Treinador/Dirigente), Online, Dream Team, Draft, Grupo e Editor.
(Dá pra mudar isso em `legacy-total-match/js/license.js`, em `FREE_ROUTES` / `PAID_ROUTES`.)

---

## Passo 1 — Subir o servidor (Cloudflare, grátis) — ~10 min

Precisa de uma conta grátis na Cloudflare e do Node instalado.

```bash
cd payment

# 1. Login na Cloudflare
npx wrangler login

# 2. Cria o "banco" de chaves ativadas (KV) e copia o id que aparecer
npx wrangler kv namespace create LICENSES
#    → cole o id em wrangler.toml (campo id = "...")

# 3. Cria o segredo (INVENTE uma frase longa e guarde bem — você vai usar a MESMA no passo 2)
npx wrangler secret put LICENSE_SECRET
#    → cole sua frase secreta quando pedir

# 4. Publica o servidor
npx wrangler deploy
```

No fim ele mostra a URL, algo como:
`https://tm-license.SEU-USUARIO.workers.dev`

Teste abrindo essa URL no navegador — tem que aparecer **"Total Match license OK"**.

---

## Passo 2 — Gerar as chaves — ~1 min

Use **a mesma frase secreta** do passo anterior.

```bash
# na raiz do projeto
LICENSE_SECRET="sua-frase-secreta-igual-a-do-worker" node payment/mint-keys.mjs 200
```

Isso cria `payment/keys.csv` com 200 chaves (troque o número como quiser).
⚠️ **Não suba o keys.csv pro GitHub** (já está no .gitignore). Guarde num lugar seguro.

---

## Passo 3 — Configurar o Kiwify — ~15 min

1. Crie a conta em [kiwify.com.br](https://kiwify.com.br) e cadastre seus dados/Pix.
2. **Criar produto** → tipo **Digital** → defina nome (*Total Match — Versão Completa*) e preço.
3. Em **conteúdo/entrega**, use a opção de **códigos/liberação por lista** (o Kiwify entrega
   um código diferente para cada comprador). Cole as chaves do `keys.csv`.
   - Se a sua conta não tiver "lista de códigos", use a **entrega por e-mail/liberação manual**
   e mande a chave; ou me avise que eu adapto o fluxo para *1 link = 1 chave via webhook*.
4. Ative **Pix** (e cartão/boleto se quiser). Publique o produto e copie o **link de checkout**.

---

## Passo 4 — Ligar o cadeado no jogo — ~2 min

Abra `legacy-total-match/js/license.js` e edite o bloco `CONFIG`:

```js
var CONFIG = {
  PAYWALL: true,                                   // liga o cadeado
  API: "https://tm-license.SEU-USUARIO.workers.dev", // URL do Passo 1
  BUY_URL: "https://pay.kiwify.com.br/SEU-LINK",     // link do Passo 3
  PRICE_LABEL: "R$ 9,90",                           // aparece na tela (opcional)
  ...
};
```

Depois é só publicar o site (subir para o GitHub Pages, como sempre). Pronto:
os modos pagos passam a pedir a chave, e quem comprou destrava na hora.

> Enquanto `PAYWALL: false`, o jogo continua **aberto** — bom pra você gravar os vídeos
> e testar sem trava. Ligue só quando os passos 1–3 estiverem prontos.

---

## Como testar antes de vender

1. Gere as chaves (Passo 2) com o mesmo secret do Worker.
2. No jogo (com `PAYWALL: true`), tente entrar numa Carreira → aparece a tela de compra.
3. Cole uma chave do `keys.csv` → deve desbloquear.
4. Tente a MESMA chave noutro navegador/aparelho → deve recusar ("já ativada em outro aparelho").

## Segurança (resumo honesto)

- A validade da chave é provada por assinatura (HMAC) — ninguém "inventa" chave sem o secret.
- O KV impede a mesma chave em 2 aparelhos.
- Guarde o `LICENSE_SECRET` e o `keys.csv` em segredo. Se o secret vazar, troque-o e gere chaves novas.
