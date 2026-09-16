# 🛰️ katseye-server

O servidor do **[KATSEYE Central](../katseye-central/)**. Ele existe por um motivo só:

> **guardar a sua chave de IA fora do navegador de quem usa o app.**

O app é um site estático e público. Qualquer chave escrita nele é lida por qualquer visitante
no "ver código-fonte" — não tem jeito, é como a web funciona. Com este servidor no meio, a
chave fica aqui, o app só conhece o endereço dele, e quem abrir o link já encontra o
Conselheiro funcionando sem configurar nada.

**Sem banco, sem dependência, sem `node_modules`.** Dois arquivos e o Node puro.

---

## O que ele faz

| Rota | O quê |
| --- | --- |
| `GET /saude` | Está no ar? Qual provedor e modelo estão ligados? Quanto foi usado hoje? |
| `POST /conselho` | Recebe `{ mensagens }`, devolve `{ texto }` |

`POST /conselho` aceita `sistema` e `modelo` no corpo (é o que o app manda) e **ignora os
dois de propósito**. Se o servidor obedecesse ao prompt de quem chama, ele viraria um proxy
de IA genérico com a sua chave — bastaria alguém mandar outro prompt. Aqui ele só sabe ser o
Conselheiro do KATSEYE.

### Navegação e pesquisa

O servidor manda `google_search` e `url_context` junto da pergunta, então o modelo busca no
Google e lê páginas. A resposta devolve `fontes` e `buscas` para o app citar.

**Essas ferramentas exigem faturamento ativo** no Google Cloud do projeto da chave. Sem isso a
API responde 429 falando em *billing* — e o servidor, em vez de falhar, refaz a pergunta sem
ferramenta e devolve `semWeb: true`. Para desligá-las de vez, `WEB=0`.

### O freio de mão

O endereço é público: quem descobrir pode chamar. A checagem de origem (`ORIGENS`) só vale
para navegador — um script ignora. Então quem protege a sua chave de verdade são os
contadores, todos ajustáveis por variável de ambiente:

| Variável | Padrão | O quê |
| --- | --- | --- |
| `LIMITE_MINUTO` | 6 | perguntas por minuto, por IP |
| `LIMITE_DIA_IP` | 40 | perguntas por dia, por IP |
| `LIMITE_DIA_TOTAL` | 800 | teto do servidor inteiro por dia |
| `SENHA` | vazio | se preenchida, exige o cabeçalho `x-senha` — deixa o servidor só seu |
| `WEB` | 1 | `0` desliga a busca e a leitura de páginas |

Os contadores vivem em memória e zeram quando o servidor reinicia. É de propósito: para o
tamanho deste app, um contador que some no deploy é melhor do que um banco que ninguém mantém.

---

## Publicar no Railway (5 minutos)

1. **Pegue a chave do Gemini** — https://aistudio.google.com/apikey → *Create API key*.
   É grátis e não pede cartão.

2. **Crie o projeto** — em [railway.app](https://railway.app): *New Project* →
   *Deploy from GitHub repo* → escolha `jogo-futebol`.

3. **Aponte para esta pasta** — em *Settings → Root Directory*, escreva `katseye-server`.
   Sem isso o Railway tenta subir o repositório inteiro.

4. **Coloque a chave** — em *Variables*, adicione:

   ```
   GEMINI_API_KEY   = a chave que você pegou no passo 1
   ORIGENS          = https://mauriciosuprir.github.io
   ```

5. **Pegue o endereço** — em *Settings → Networking* → *Generate Domain*. Vai sair algo como
   `https://katseye-server-production.up.railway.app`.

6. **Confira** — abra `SEU-ENDEREÇO/saude` no navegador. Tem que responder:

   ```json
   { "ok": true, "ia": { "provedor": "gemini", "modelo": "gemini-2.5-flash" } }
   ```

   Se `"ia"` vier `null`, a variável `GEMINI_API_KEY` não chegou — confira o passo 4.

7. **Ligue no app** — no KATSEYE Central: **Sistema → Conselheiro → 🛰️ Servidor meu** →
   cole o endereço → *Salvar servidor*. Pronto: o chat passa a responder pela sua chave,
   para qualquer pessoa que abrir o link, e ninguém nunca vê a chave.

> **Trocar a chave depois** é só editar a variável no Railway. O app não muda.

---

## Rodar na sua máquina

```bash
cd katseye-server
cp .env.example .env          # preencha GEMINI_API_KEY
node --env-file=.env src/index.js
# http://localhost:3000/saude
```

Para o app local falar com ele, inclua a origem:
`ORIGENS=https://mauriciosuprir.github.io,http://localhost:8000`

## Testes

```bash
npm test          # ou: node testes/roda.js
```

Sobe uma API do Gemini dublada e confere o servidor inteiro: caminho feliz, a chave indo para
o Google mas **nunca** para o app, o prompt do servidor vencendo o do cliente, origem
bloqueada, corpo malformado recusado antes de gastar chamada, o 429 do Google virando frase
em português e os limites travando. Nenhuma chamada real, nenhuma chave de verdade.

## Anthropic no lugar do Gemini

Defina `ANTHROPIC_API_KEY` em vez de (ou junto com) `GEMINI_API_KEY`. Com as duas, o Gemini
vence; `PROVEDOR=anthropic` inverte. Modelos em `MODELO_GEMINI` e `MODELO_ANTHROPIC`.

## Estrutura

```
katseye-server/
├── src/index.js     servidor HTTP: rotas, CORS, leitura do corpo
├── src/ia.js        Gemini e Anthropic + o system prompt (que é daqui)
├── src/limites.js   os contadores por IP e do dia
├── testes/roda.js   o servidor inteiro contra uma API dublada
├── railway.json     build e healthcheck
└── .env.example     todas as variáveis, comentadas
```
