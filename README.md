# CreateFlow

Sistema de gestão de produção de conteúdo em vídeo para criadoras que publicam em
**YouTube, Instagram (Reels) e TikTok**. Fecha o ciclo:
**ideia → roteiro → gravação → edição → publicação → métricas → aprendizado → nova ideia.**

Stack: **Next.js 15 (App Router) + TypeScript + Tailwind + Postgres (Drizzle ORM)**.
Sugestões de roteiro via **Claude API** (chamada só no servidor). Timezone
`America/Sao_Paulo`, idioma pt-BR.

> **Outros projetos deste repositório** (todos estáticos, publicados pelo GitHub Pages):
> - [`studylab/`](./studylab/) — **StudyLab**, plataforma de organização, aprendizado e
>   desempenho escolar (prioridades inteligentes, revisão espaçada, questões, foco, desempenho).
> - [`looklab/`](./looklab/) — **LookLab**, guarda-roupa digital e criador de looks
>   para crianças e adolescentes.
> - [`financas-casa/`](./financas-casa/) — **NEXO**, painel de finanças da casa.
> - [`legacy-total-match/`](./legacy-total-match/) — o jogo _Total Match_, preservado.

---

## Funcionalidades (MVP)

- **Banco de ideias** — captura rápida (título + gancho + resumo + origem + plataforma-alvo),
  tags livres, pilar de conteúdo, status (ideia / aprovada / descartada). Promove ideia → pipeline.
- **Pipeline (kanban)** — colunas Ideia → Roteiro → Gravar → Editar → Agendado → Publicado,
  com **drag-and-drop** (mouse e toque) e persistência. Cada card tem plataformas, formato,
  responsável, data prevista e checklist de assets (thumbnail, legenda, trilha, CTA).
- **Editor de roteiro estruturado** — blocos nomeados (Gancho 0–3s, Contexto, Desenvolvimento,
  Clímax/entrega, CTA), contador de caracteres e **estimativa de duração falada** por bloco
  (base configurável, padrão 150 ppm). **Versionamento** (salva versões, nunca sobrescreve) e
  **diff lado a lado** entre duas versões. Legenda e hashtags separadas. **Modo teleprompter**
  (texto grande, rolagem controlada por velocidade).
- **Calendário editorial** — visão mês/semana, filtro por plataforma e por pilar, indicador de
  dias sem publicação planejada.
- **Dashboard de performance** — métricas por vídeo (views, retenção média %, tempo médio,
  likes, comentários, compartilhamentos, salvamentos, seguidores ganhos). Rankings (melhor
  retenção nos últimos 90 dias, mais compartilhados, mais seguidores), performance por pilar e
  evolução mês a mês. **Métricas são snapshots datados** (curva de crescimento).
- **Importação de métricas** — CSV nativo de cada plataforma (reimportação idempotente) e
  entrada manual.
- **Sugestões de roteiro (IA)** — envia os 10 vídeos de melhor performance + o tema à Claude API
  e recebe **JSON estruturado**: 5 ganchos, 1 estrutura de roteiro, 3 títulos e 1 CTA, cada item
  com justificativa ancorada nos dados. Vira card de ideia com 1 clique. **Guardrail:** com menos
  de 5 vídeos com métricas, a IA avisa e sugere só com base no tema — nunca inventa números.
- **Perfis** — Criadora (**admin**, acesso total) e Editor/apoio (**editor**, vê pipeline e
  roteiros; não vê métricas, IA, pilares nem configurações).

---

## Setup local

Pré-requisitos: **Node 22+** e um **Postgres** (via Docker ou local).

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
#   - defina AUTH_SECRET (openssl rand -base64 32)
#   - defina ANTHROPIC_API_KEY (para as sugestões de IA)

# 3. Banco de dados (opção A: só o Postgres via Docker)
docker run -d --name studio-pg -e POSTGRES_USER=studio -e POSTGRES_PASSWORD=studio \
  -e POSTGRES_DB=studio -p 5432:5432 postgres:16-alpine

# 4. Migrations + seed (3 pilares, 8 vídeos com métricas, admin + editor)
npm run db:migrate
npm run db:seed

# 5. Rodar
npm run dev
# http://localhost:3000  (login: admin@studio.local / admin123)
```

Scripts úteis:

| Script | O quê |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução em produção |
| `npm run db:generate` | Gera nova migration a partir do schema (`src/db/schema.ts`) |
| `npm run db:migrate` | Aplica migrations |
| `npm run db:seed` | Popula dados de exemplo (limpa e recria) |

---

## Deploy com Docker (VPS)

O `docker-compose.yml` sobe **app + Postgres**. A imagem usa a saída `standalone` do Next.

```bash
cp .env.example .env      # defina AUTH_SECRET, ANTHROPIC_API_KEY, AUTH_URL público

docker compose up -d --build

# Migrations e seed (uma vez), rodando dentro do container da app:
docker compose exec app node dist-scripts/migrate.js
docker compose exec app node dist-scripts/seed.js   # opcional (dados de exemplo)
```

A app fica em `http://<vps>:3000`. Recomenda-se um proxy reverso (Nginx/Caddy) na frente
com HTTPS, apontando `AUTH_URL` para o domínio público e mantendo `AUTH_TRUST_HOST=true`.

> A **chave da Claude API** vive apenas como variável de ambiente do servidor
> (`ANTHROPIC_API_KEY`) — nunca é enviada ao navegador nem incluída no bundle do client.

---

## Como importar CSV de cada plataforma

Em **Métricas → Importar / registrar**, escolha a plataforma, a data de coleta
(“coletado em”) e envie o arquivo `.csv` exportado — ou cole o conteúdo. Reimportar a
**mesma data** não duplica (atualiza); **datas diferentes** preservam a curva de crescimento.
O casamento com vídeos existentes é por **ID externo** e, na falta dele, pelo **título**.
Os cabeçalhos são reconhecidos em português e inglês (case-insensitive), com estes aliases:

### YouTube
Em **YouTube Studio → Analytics → Avançado**, exporte a tabela de vídeos (CSV).
Colunas reconhecidas:

| Métrica | Cabeçalhos aceitos |
| --- | --- |
| ID | `Content`, `Video ID`, `ID do vídeo` |
| Título | `Video title`, `Título do vídeo` |
| Publicado em | `Video publish time`, `Data de publicação` |
| Views | `Views`, `Visualizações` |
| Retenção % | `Average percentage viewed (%)`, `Porcentagem média assistida (%)` |
| Tempo médio | `Average view duration`, `Duração média da visualização` (aceita `mm:ss`) |
| Likes | `Likes`, `Curtidas` |
| Comentários | `Comments added`, `Comentários` |
| Compartilhamentos | `Shares`, `Compartilhamentos` |
| Salvamentos | `Saves`, `Videos added to playlists`, `Adicionados a playlists` |
| Seguidores | `Subscribers`, `Inscritos`, `Subscribers gained` |

> A linha de **totais** (`Total`) do export é ignorada automaticamente.

### Instagram
Exporte os insights de Reels (Meta Business Suite / conta profissional). Aliases:
ID `Post ID`/`Permalink`, Título `Description`/`Legenda`, Views `Views`/`Plays`/`Reach`,
Retenção `Average watch percentage`, Tempo médio `Average watch time`, Likes/Comentários/
Compartilhamentos/Salvamentos (`Saves`/`Salvos`), Seguidores `Follows`/`Seguidores ganhos`.

### TikTok
Em **TikTok Studio / Analytics**, exporte o CSV de vídeos. Aliases: ID `Video ID`,
Título `Video title`/`Caption`, Views `Video views`/`Visualizações`, Retenção
`Average watch time %`, Tempo médio `Average watch time`, Likes/Comentários/Compartilhamentos,
Salvamentos `Saves`/`Favoritos`, Seguidores `New followers`/`Novos seguidores`.

> A API pública de analytics do TikTok exige aprovação; por isso a importação por CSV é o
> caminho principal, com o adapter isolado para trocar depois (ver Arquitetura).

---

## Modelo de dados

`pilares` · `ideias` · `conteudos` · `roteiros` (versionado) · `publicacoes` · `metricas`
(snapshots datados, `UNIQUE(publicacao_id, coletado_em, fonte)`) · `sugestoes_ia` · `usuarios`
(RBAC) · `config`. Schema em [`src/db/schema.ts`](./src/db/schema.ts); migrations em
[`drizzle/`](./drizzle/).

## Arquitetura da camada de integração (Fase 2)

`src/lib/csv-adapters.ts` define um **adapter por plataforma** com contrato comum
(`parseCsv` no MVP; `fetchVideos`/`fetchMetrics` reservados para o sync automático da Fase 2).
Como o formato normalizado é o mesmo, trocar CSV manual por API (YouTube Data + Analytics,
Instagram Graph, TikTok) não muda o resto do app.

## Testes

`npm run build` cobre a checagem de tipos. O smoke test dos critérios de aceite que não
dependem de UI (ranking de retenção em 90 dias e idempotência de importação) está em
[`scripts/smoke.ts`](./scripts/smoke.ts):

```bash
DATABASE_URL=postgres://studio:studio@localhost:5432/studio node --import tsx scripts/smoke.ts
```
