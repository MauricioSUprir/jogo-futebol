# Amigo Oculto — plataforma digital

Plataforma web para criar, gerenciar e realizar amigos ocultos entre amigos, famílias, condomínios, escolas e empresas:
convite por link, QR Code e WhatsApp; sorteio seguro no servidor; revelação cinematográfica; lista de desejos com
sugestões; mensagens anônimas; jogos; revelação ao vivo no telão; álbum de memórias. Funciona no celular, no tablet e no
computador e pode ser instalada como aplicativo (PWA).

**Tecnologia:** Next.js 16 (App Router, Server Actions, Route Handlers) · React 19 · TypeScript · Tailwind CSS 4 ·
Framer Motion · Lucide · Supabase (PostgreSQL, Auth, Storage, Realtime, Row Level Security) · Vercel.

---

## O que tem

| Área | Onde | O que faz |
|---|---|---|
| **Página inicial** | `/` | Logo animado, presentes flutuantes, "Criar amigo oculto", "Entrar em um grupo" com campo de código, como funciona, recursos, perguntas frequentes e **demonstração interativa** (sorteio de verdade no navegador + a revelação, sem salvar nada) |
| **Contas** | `/entrar`, `/cadastro`, `/recuperar-senha`, `/conta` | E-mail e senha, Google, recuperação de senha, foto, nome, apelido, configurações, histórico; **participação por convite sem cadastro** (sessão anônima segura do Supabase) que vira conta completa depois; exportar dados e excluir conta (LGPD) |
| **Criar amigo oculto** | `/criar` | Assistente em 6 etapas: nome, descrição, capa, tema (Natal, Aniversário, Clássico, Corporativo), data/hora da revelação, local, valores mínimo e máximo, limite, regras, prazo de entrada, data do sorteio, manual ou agendado, público ou privado, aprovação de novos participantes |
| **Convite** | `/grupo/:id/compartilhar`, `/convite/:codigo`, `/explorar` | Código exclusivo, QR Code, link e WhatsApp; página do convite para quem ainda não entrou; grupos públicos com busca |
| **Sala do grupo** | `/grupo/:id` | Capa, contagem regressiva, participantes com fotos, informações e regras, valor dos presentes, mural de avisos, chat em tempo real, enquetes, status do sorteio, confirmação de presença, quem já viu o resultado e quem já comprou |
| **Sorteio** | painel do organizador | Seguro no servidor (ver acima), restrições ("A não tira B", mútuo), agendado ou manual, refazer com confirmação |
| **Revelação cinematográfica** | `/grupo/:id/revelacao` | Caixa misteriosa → toque → 3-2-1 → abertura com luz, partículas e confete → nome e foto → lista de desejos, preferências e ideias de presente; som e vibração opcionais, modo de animações reduzidas, resultado protegido de olhares |
| **Lista de desejos** | `/lista-de-desejos` | Itens com foto, link, preço e ordem; hobbies, interesses, cores, tamanhos, o que não quer ganhar, observações; **sugestões** pelos interesses e pelo orçamento do grupo (197 ideias, regras próprias, sem IA externa) |
| **Mensagens anônimas** | `/grupo/:id/mensagens`, `/mensagens` | Perguntas, pedidos de informação, pistas, respostas e emojis entre quem tirou e quem foi tirado; notificações; bloquear e denunciar; o remetente nunca aparece, nem na API |
| **Jogos** | `/grupo/:id/jogos` | Adivinhe quem te tirou, quiz, pistas, enquetes de presentes, roleta de desafios, bingo natalino, cápsula do tempo, mural, cartões virtuais, ranking, conquistas e medalhas — nada revela o sorteio |
| **Revelação ao vivo** | `/telao/:id` + `/grupo/:id/ao-vivo/participar` | Telão em tela cheia: ordem (corrente ou aleatória), sorteio de quem começa, fotos, temporizador de discurso, pistas, revelação pelo próprio participante (ou pelo organizador com autorização), sons, comemorações, registro de quem revelou e encerramento cinematográfico |
| **Painel do organizador** | `/grupo/:id/admin` | Participantes, pedidos de entrada, edição, restrições, convites (inclusive por e-mail), sorteio, avisos, lembretes, moderação, estatísticas, revelação ao vivo, encerrar, arquivar e excluir — **sem acesso aos resultados** |
| **Painel pessoal** | `/painel` | Meus amigos ocultos (ativos, próximos, concluídos), contagens, convites pendentes, lista de desejos, mensagens, notificações, histórico |
| **Notificações** | `/notificacoes` | Internas em tempo real, por e-mail (Resend, Brevo ou SMTP) e push (Web Push), conforme a autorização de cada pessoa |
| **Álbum de memórias** | `/grupo/:id/album` | Fotos privadas, revelações autorizadas, mensagens, linha do tempo, cartões, retrospectiva animada e lembrança personalizada em PNG/PDF |
| **App** | — | Responsivo, claro/escuro, temas por evento, acessível (WCAG AA conferido com axe), instalável (PWA, com página offline) |

---

## Segurança e privacidade do sorteio

| Garantia | Como |
|---|---|
| Ninguém tira a si mesmo; cada um tira exatamente uma pessoa e é tirado uma vez; restrições respeitadas | Algoritmo em `src/lib/sorteio/algoritmo.ts` (permutação validada) **e** conferência de novo no banco (`commit_draw`) antes de gravar |
| Aleatoriedade criptográfica | `crypto.getRandomValues` com rejeição (sem viés); amostragem uniforme entre as combinações válidas (teste de qui-quadrado) |
| Combinação impossível detectada antes | Emparelhamento perfeito em grafo bipartido (Kuhn); sem combinação → erro claro, nada gravado |
| Executado só no servidor | `executarSorteio` (Server Action / cron) com a chave `service_role`; `commit_draw` só pode ser executada pelo `service_role` — nem o organizador consegue gravar pares escolhidos por ele |
| Transação atômica | `commit_draw` trava o evento (`FOR UPDATE`), confere versão, lista de participantes, permutação e restrições e grava tudo de uma vez |
| Nem o organizador vê os resultados | A tabela `assignments` não tem **nenhuma** permissão para `anon`/`authenticated`; cada um recebe só o próprio par por `my_assignment` |
| Sem alterações indevidas | Depois do sorteio: entrada, saída, remoção e restrições travadas (funções + RLS + gatilhos); refazer exige confirmação, invalida tudo e avisa todos |
| Mensagens anônimas | Tabela sem permissão direta; as funções nunca devolvem quem enviou (nem o id do par) — nem na API; denúncias chegam ao organizador sem o remetente |
| Jogos não vazam o sorteio | Palpite só tem resposta depois do encerramento e só para quem palpitou; revelação ao vivo só pelo próprio participante ou com a autorização dele |

Provas automatizadas: `tests/unidade/sorteio.test.ts` (regras, uniformidade, 1000 participantes) e
`tests/integracao/*.test.ts` (contra o Supabase de verdade: RLS, permissões das funções e respostas da API).

Outros cuidados: RLS em todas as tabelas com `revoke all` + permissões explícitas por coluna; funções
`SECURITY DEFINER` com `search_path` vazio e checagem de quem chama; CSP só com o próprio site e o Supabase;
cabeçalhos de segurança; validação no servidor (zod) e no banco (checks); limites de frequência no chat, mural, mensagens
anônimas, enquetes e cartões; uploads só na pasta do próprio usuário (álbum privado com URL assinada); exportação e
exclusão da conta (LGPD).

---

## Rodar no seu computador

Precisa de Node 22 e Docker.

```bash
cd amigo-oculto
npm install
npm run db:start      # Supabase local (Postgres, Auth, Storage, Realtime, Mailpit) + migrações
npm run db:env        # cria o .env.local apontando para o Supabase local
npm run demo          # (opcional) pessoas e grupos de demonstração — imprime e-mails e senha
npm run dev           # http://127.0.0.1:3100
```

E-mails enviados localmente aparecem no Mailpit: http://127.0.0.1:54324.

### Testes

```bash
npm run typecheck
npm test                    # unidade (algoritmo do sorteio, sugestões, validações, bingo, conquistas)
npm run test:integracao     # contra o Supabase local (segurança e privacidade)
npm run build && npm run start &   # e2e usa o build de produção na porta 3100
node tests/e2e/fluxo.mjs    # ponta a ponta no Chromium (celular e PC) + acessibilidade (axe)
```

O GitHub Actions roda tudo isso em todo PR que mexe em `amigo-oculto/` (`.github/workflows/amigo-oculto-testes.yml`).

---

## Publicar (Supabase + Vercel)

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo, `sa-east-1`).
2. Aplique as migrações (tabelas, RLS, funções, buckets e tempo real):
   ```bash
   npx supabase@3.4.0 login
   npx supabase@3.4.0 link --project-ref <ref-do-projeto>
   npx supabase@3.4.0 db push
   ```
3. **Authentication → URL Configuration:** *Site URL* = `https://seu-dominio`; *Redirect URLs* = `https://seu-dominio/**`.
4. **Authentication → Sign In / Providers:**
   - E-mail: ligado, com *Confirm email* ligado; ligue a proteção contra senhas vazadas.
   - **Allow anonymous sign-ins: ligado** (participação por convite sem cadastro).
   - **Google** (opcional): crie um *OAuth Client ID* no Google Cloud com a URI de retorno
     `https://<ref>.supabase.co/auth/v1/callback`, cole o Client ID e o Secret aqui e defina `NEXT_PUBLIC_AUTH_GOOGLE=1`.
5. **Authentication → Emails:** configure um SMTP próprio (o do Supabase é só para testes) e cole os modelos em português de
   `supabase/templates/` (confirmação, recuperação, troca de e-mail, link mágico).
6. **Settings → API:** copie a *Project URL*, a chave *anon/publishable* e a *service_role/secret*.

### 2. Vercel

1. *Add New → Project* com este repositório e **Root Directory = `amigo-oculto`** (Next.js é detectado).
2. Variáveis de ambiente (ver `.env.exemplo`):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon/publishable |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (**só servidor**) |
   | `NEXT_PUBLIC_SITE_URL` | `https://seu-dominio` |
   | `CRON_SECRET` | valor aleatório longo (`openssl rand -hex 32`) |
   | `NEXT_PUBLIC_AUTH_GOOGLE` | `1` se ligou o Google |
   | `CONTATO_EMAIL` | e-mail de contato nas páginas de privacidade e termos |
   | `EMAIL_FROM` + `RESEND_API_KEY` *ou* `BREVO_API_KEY` *ou* `SMTP_URL` | e-mails das notificações (opcional) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | notificações push (`npm run vapid`) |

3. Deploy. O `vercel.json` agenda `/api/cron` (sorteios agendados, lembretes de compra e de proximidade, encerramento
   automático e entrega de e-mail/push). No plano Hobby a Vercel roda o cron uma vez por dia; para sorteios agendados
   pontuais use o plano Pro (a cada 5–15 min) **ou** o agendador do próprio Supabase:

   ```sql
   -- SQL Editor do Supabase (extensões pg_cron e pg_net ligadas em Database → Extensions)
   select cron.schedule('amigo-oculto-cron', '*/5 * * * *', $$
     select net.http_get(
       url := 'https://seu-dominio/api/cron',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     );
   $$);
   ```

   Mesmo sem cron, um sorteio agendado vencido é feito na hora em que alguém abre a sala do grupo.

---

## Estrutura

```
amigo-oculto/
├── supabase/
│   ├── migrations/        esquema, RLS, funções (sorteio, mensagens anônimas, jogos, ao vivo, álbum), storage, realtime
│   ├── templates/         e-mails de autenticação em português
│   └── config.jsonc       Supabase local
├── src/
│   ├── app/               rotas (públicas, app logado, sala do grupo, telão, API)
│   ├── components/        interface (ui, casca, grupo, revelação, jogos, ao vivo, álbum...)
│   └── lib/
│       ├── sorteio/       algoritmo (puro) + serviço no servidor
│       ├── acoes/         Server Actions
│       ├── supabase/      clientes (servidor, navegador, admin, proxy)
│       └── servidor/      sessão, grupo, entrega de e-mail e push
├── tests/                 unidade, integração (Supabase local) e e2e (Playwright)
└── scripts/               Supabase local, tipos, dados de demonstração, ícones, VAPID
```

Convenções de código: `CONVENCOES.md`.
