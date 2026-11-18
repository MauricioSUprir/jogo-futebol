# LIFE OS — sistema operacional pessoal

Painel privado para organizar a rotina: água, hábitos, agenda, treinos e futebol, saúde, sono, bem-estar, alimentação,
estudos e metas; finanças, projetos, relatórios e IA nas próximas fases. Roda num **servidor só seu** (um computador de casa ou uma VPS), com
banco de dados próprio e login privado. Nenhum dado sai do servidor: sem rastreadores, sem CDN, sem IA externa.

Identidade: preto profundo `#080B12`, azul‑elétrico `#2563EB`, violeta `#7C3AED`, branco `#F8FAFC`, cinza
`#94A3B8` e bordas holográficas. Funciona no iPhone, no computador e no tablet, e instala como app (PWA).

## Fase 1 — Fundação

| Módulo | O que faz |
|---|---|
| **Central de Comando** (`/`) | Saudação com relógio, resumo do dia (água, hábitos, agenda, sequência), cartões da água, hábitos de hoje, agenda de hoje, próximos 7 dias, sua semana (gráfico) e Smart Insights. Nível e XP pelas conquistas. Cartões escondíveis e reordenáveis. Atualiza sozinho a cada minuto. |
| **Hydro Track** (`/agua`) | Copo, garrafa e botões rápidos configuráveis; registro personalizado (quantidade, bebida, dia e horário); outras bebidas à parte (só a água conta para a meta); meta diária ajustável (o histórico guarda a meta de cada dia); dia de treino; desfazer; gráficos de 7/30 dias com a linha da meta e por hora do dia; média, meta batida, sequência, regularidade, treino × descanso; tabela; exportação CSV. |
| **Habit Tracker** (`/habitos`) | Hábitos diários, em dias da semana ou X vezes por semana, com meta por dia (ex.: 2×); sequências só motivacionais (hoje pendente não quebra; dia de descanso é neutro); conclusão 7/30/90 dias; calendário do mês para marcar dias passados; conquistas (3, 7, 14, 30… dias); ícones e cores; arquivar; ordenar; sugestões do primeiro uso; o hábito "Registrar água" se marca sozinho quando a meta é batida. |
| **Life Calendar** (`/agenda`) | Semana, mês e dia; provas, trabalhos, aulas, consultas, treinos, partidas, eventos, aniversários, compromissos, metas e lembretes; dia inteiro e vários dias; repetição diária/semanal/mensal/anual com fim; tarefas com duração, prioridade e prazo; **planejamento automático** (encaixa as tarefas nos horários livres da sua janela do dia, com folga antes/depois dos compromissos e pausa depois de 90 min de foco — mostra a proposta antes de gravar); **modo foco** (só a atividade de agora, com contagem regressiva); exportação `.ics` (Calendário do iPhone, Google Agenda, Outlook). |
| **Registrar** (botão central) | Água, hábitos de hoje, treino, sono, refeição, estudo, "como estou" (check-in), novo evento e nova tarefa num lugar só. |
| **Segurança** (`/configuracoes/seguranca`) | Verificação em duas etapas (app autenticador + 8 códigos de recuperação), troca de senha, sessões ativas (encerrar uma ou todas as outras) e registro de acessos. |
| **Dados** (`/configuracoes/dados`) | Exportação completa em JSON, água em CSV e agenda em `.ics`. |

## Fase 2 — Saúde e rotina

| Módulo | O que faz |
|---|---|
| **Fitness Center** (`/treinos`) | **Musculação:** fichas com exercícios (grupo muscular, séries, repetições, carga, intervalo), favoritas, semana de treinamento (a ficha de cada dia e os dias de recuperação), sessão pela ficha com a carga da última vez já preenchida, cronômetro de intervalo (+15 s, pausa, vibração), histórico, evolução da carga por exercício e observações de técnica. **Futebol:** partidas (minutos, gols, assistências, posição, placar, desempenho percebido), treinos técnicos e recreativo; estatísticas por temporada, participações em gol a cada 90 min, por posição, jogos por mês e comparação entre temporadas. **Cardio:** caminhada, corrida, bicicleta, esteira, natação; distância e ritmo. **Recuperação:** descanso planejado, cansaço, recuperação e dor percebidos, desconfortos, o sono das últimas noites e **alertas para não acumular esforço sem descanso** (6+ dias seguidos, carga da semana muito acima das anteriores, cansaço alto, dor). Esforço percebido 0–10 (CR-10). Registrar uma atividade marca o dia de treino no Hydro Track. |
| **Health Center** (`/saude/central`) | Consultas (as marcadas vão para a agenda), vacinas com a próxima dose, exames, medicamentos prescritos e orientações, alergias, lesões e dores, sintomas, **documentos de saúde** (PDF/imagem até 5 MB, cifrados no banco), **informações para emergências** (tela grande para mostrar a alguém, contatos com toque para ligar) e o **diário de saúde** (energia, disposição, o sono da noite e a atividade do dia, com os padrões dos seus registros — sem diagnóstico). |
| **Sleep Lab** (`/sono`) | Hora de dormir e de acordar (a virada da meia-noite no seu fuso), tempo até pegar no sono, despertares, qualidade, diário de sono; meta ajustável (padrão 9 h — não é recomendação médica); gráficos de 7/30 dias; regularidade dos horários; dias de aula × fim de semana ("jet lag social"); energia depois de noites com × sem a meta; aviso "hora de preparar o descanso" no painel. |
| **Mind Center** (`/mente`) | Humor, energia, estresse e emoções do dia; histórico e padrões de estresse (dia da semana, noites curtas, véspera de prova); **diário privado** (acontecimentos, reflexões, pensamentos, "3 coisas boas") sempre cifrado e com **senha extra opcional**; exercícios de respiração (caixa, 4-7-8, coerência); apoio sempre à vista (CVV 188). |
| **Nutrition Hub** (`/alimentacao`) | Diário de refeições com horário, grupos de alimentos, fome e saciedade; frutas, vegetais e variedade; planejamento de lanches e refeições (também para dias de treino); lista de compras; receitas favoritas. Sem calorias, peso nem dieta restritiva. |
| **Study Center** (`/estudos`) | Matérias com média alvo e meta semanal; provas e trabalhos na agenda com **checklist antes da prova**; **Pomodoro** que registra a sessão sozinho; horas estudadas por matéria × meta e "Planejar a semana na agenda" (cria as tarefas para o planejamento automático); conteúdos com dificuldades e **revisões programadas** (1, 3, 7, 14, 30 dias); **flashcards** (caixas de Leitner); simulados e resumos; **notas e quanto falta** para a média; painel escolar por matéria. |
| **Goals Center** (`/metas`) | Metas nas 7 categorias do plano, com prazo (vai para a agenda), prioridade, objetivo anual, etapas ou valor numérico com histórico de progresso; concluídas e conquistas. |
| **Como estou** (painel, Saúde, Registrar) | Check-in do dia (energia, humor, estresse, disposição, emoções) compartilhado pelo Health Center e pelo Mind Center. |

O painel ganhou um cartão por módulo (todos escondíveis e reordenáveis) e os Smart Insights de todos eles; os
próximos módulos aparecem em **Todos os módulos** (`/mais`) com a fase em que chegam.

## Segurança e privacidade

- **Conta única.** A primeira tela (`/configurar`) cria a conta e só funciona com o código `LIFEOS_SETUP_TOKEN` do
  `.env`; depois disso ninguém cria outra.
- **Senha** com scrypt (N = 2¹⁷, r = 8, p = 1 — parâmetros da OWASP). Mesma mensagem para usuário inexistente e senha
  errada (não revela quem existe).
- **Duas etapas** (TOTP, RFC 6238): o segredo fica cifrado com AES‑256‑GCM (`LIFEOS_ENCRYPTION_KEY`); o mesmo código
  não vale duas vezes; códigos de recuperação de uso único guardados só como hash.
- **Sessões no banco**, revogáveis: o cookie (`httpOnly`, `SameSite=Lax`, `Secure` em produção) leva um token
  aleatório e o banco guarda só o SHA‑256 dele. 30 dias, renovados enquanto você usa.
- **Limite de tentativas:** 5 erros por usuário (ou 20 por IP) em 15 minutos bloqueiam o login.
- **Cabeçalhos:** CSP só com o próprio servidor, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS.
- **Banco fechado:** no Docker Compose o PostgreSQL não abre porta nenhuma; o app só escuta em `127.0.0.1`.
- **Diário do Mind Center:** título e texto sempre cifrados (AES‑256‑GCM). Com a senha extra, a chave sai da senha
  (scrypt) e o servidor guarda só o sal e um verificador; destrancado, a chave fica 15 minutos num cookie `httpOnly`
  cifrado com a chave do servidor (some ao sair ou ao trancar). Esqueceu a senha extra, as entradas não voltam.
- **Documentos de saúde:** cifrados no banco (AES‑256‑GCM); upload só do próprio site (Origin conferido), tipo pelo
  conteúdo do arquivo; download só do dono, registrado no registro de acessos.
- **IA:** nada é enviado para fora. O assistente (Fase 3) será opcional e só lerá os módulos que você autorizar.
- O sistema mostra padrões dos seus registros, **não diagnostica** nada. A meta de água é sua, ajustável — não é
  recomendação médica.

## Instalar no seu servidor (Docker Compose)

Precisa de: um computador ligado (Linux, Mac ou Windows com Docker) ou uma VPS, e o
[Docker](https://docs.docker.com/get-docker/).

```bash
git clone <este repositório> && cd jogo-futebol/life-os
cp .env.exemplo .env
# Gere e cole no .env:
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"    # POSTGRES_PASSWORD
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # LIFEOS_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"    # LIFEOS_SETUP_TOKEN
docker compose up -d --build
```

Sobem quatro serviços: `db` (PostgreSQL 16), `migrar` (aplica as migrações e sai), `app` (o LIFE OS, em
`127.0.0.1:3000`) e `backup` (um backup por dia em `./backups`, guarda 14). Guarde uma cópia do `.env` num lugar
seguro: sem a `LIFEOS_ENCRYPTION_KEY`, a verificação em duas etapas precisa ser refeita.

### Acesso de qualquer lugar, com HTTPS e sem abrir o servidor para a internet (recomendado: Tailscale)

1. Instale o [Tailscale](https://tailscale.com/download) no servidor e no iPhone/computador, na mesma conta.
2. No servidor: `tailscale serve --bg 3000`
3. O LIFE OS fica em `https://<nome-do-servidor>.<sua-rede>.ts.net` — com certificado válido, só para os seus
   aparelhos. Abra `/configurar`, crie a conta e ligue a verificação em duas etapas em **Segurança**.

Alternativa com domínio próprio: um [Caddy](https://caddyserver.com) na frente (`seu.dominio { reverse_proxy
127.0.0.1:3000 }`) dá HTTPS automático. Nesse caso o site fica na internet: use senha forte e as duas etapas.

### Na nuvem (Railway)

O `railway.json` desta pasta já configura tudo: build pelo `Dockerfile`, migrações do banco antes de cada deploy
(`sh /migrar/migrar.sh`), verificação em `/api/saude` e deploy só quando algo em `life-os/` muda.

1. Projeto novo no Railway → **Database → PostgreSQL**.
2. **New → GitHub Repo** com este repositório, branch `main`, e em **Settings → Root Directory**: `life-os`.
3. Variáveis do serviço: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `LIFEOS_ENCRYPTION_KEY`, `LIFEOS_SETUP_TOKEN`,
   `LIFEOS_TRUST_PROXY=1`.
4. **Settings → Networking → Generate Domain** e abra `/configurar` nesse endereço.

Na nuvem o site fica na internet (com HTTPS): use senha forte e ligue a verificação em duas etapas logo no início.

### Instalar como app no iPhone

Abra o endereço no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**. Abre em tela cheia, com a barra
inferior (Início, Saúde, Registrar, Agenda, Mais). Funciona igual no Android (Chrome → Instalar app) e no computador.

### Atualizar

```bash
git pull && docker compose up -d --build   # as migrações novas rodam sozinhas antes do app
```

### Backup e restauração

Os backups ficam em `life-os/backups/lifeos-AAAA-MM-DD-HHMM.sql.gz` (cada um já apaga e recria as tabelas ao ser
restaurado). Copie de tempos em tempos para outro lugar (HD externo, outro computador). Para restaurar:

```bash
docker compose stop app
gunzip -c backups/lifeos-2026-11-17-0300.sql.gz | docker compose exec -T db psql -U lifeos -d lifeos
docker compose start app
```

Num servidor novo: `docker compose up -d db`, restaure com o comando acima e depois `docker compose up -d`.

## Desenvolvimento

```bash
cd life-os
npm install
cp .env.exemplo .env          # DATABASE_URL de um PostgreSQL local + as duas chaves
npx prisma migrate deploy     # cria as tabelas
npm run dev                   # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run typecheck` | Tipos (TypeScript estrito) |
| `npm test` | Testes de unidade (vitest): datas e fusos, TOTP pelos vetores das RFCs 4226/6238, senha, cifra, sequências, planejador, recorrência, água, insights, iCalendar/CSV |
| `npm run build` | Build de produção (`output: standalone`) |
| `node tests/e2e/fluxo.mjs` | Ponta a ponta no Chromium contra o build e um banco zerado (`E2E_DATABASE_URL`, que é **apagado**): conta, água, hábitos, agenda e planejamento, duas etapas (código reutilizado recusado, código de recuperação), exportação, celular (iPhone, sem rolagem lateral) e limite de tentativas. `--sem-servidor --url <endereço>` testa um servidor já rodando (ex.: o do Docker, com `E2E_TOKEN`). |
| `node scripts/gerar-icones.mjs` | Refaz os ícones do app a partir da marca |

O CI (`.github/workflows/life-os-testes.yml`) roda tudo isso em cada PR que mexe em `life-os/`.

### Estrutura

```
life-os/
├── prisma/                 schema e migrações (PostgreSQL)
├── src/
│   ├── app/(publico)/      configurar, entrar, verificação, offline
│   ├── app/(app)/          painel, agua, habitos, agenda (+foco), treinos, saude (+central), sono, mente,
│   │                       alimentacao, estudos, metas, mais, configuracoes
│   ├── app/api/            exportar (JSON, CSV, ICS), documentos (saúde) e saude (verificação do servidor)
│   ├── acoes/              server actions (uma por módulo) — toda ação confere a sessão e o dono do registro
│   ├── lib/                regras PURAS e testadas (datas, habitos, planejador, recorrencia, agua, insights, ics,
│   │                       treinos, saude, sono, checkin, mente, alimentacao, estudos, metas)
│   ├── lib/seguranca/      senha (scrypt), totp, cifra (AES-256-GCM), cifra de arquivos, chave do diário
│   ├── lib/servidor/       sessão, limite de tentativas, registro de acessos, leituras do banco
│   └── components/         interface (componentes no estilo shadcn/ui, feitos com Tailwind)
├── public/                 ícones, service worker (sw.js), robots.txt
├── tests/                  unidade (vitest) e ponta a ponta (Playwright)
├── Dockerfile, docker-compose.yml
```

### Contrato de um módulo

Cada módulo mora nas suas pastas (rota em `app/(app)/<rota>`, `acoes/<modulo>.ts`, `lib/<modulo>.ts` puro e testado,
`lib/servidor/<modulo>.ts`, `components/<modulo>/`) e entrega à casca comum:

- `CartaoPainel<Nome>({ user, hojeK })` — cartão do painel (servidor);
- `RegistroRapido…` + `dadosRegistroRapido<Nome>(user, hojeK)` — formulário do botão Registrar (montado no layout);
- `insights<Nome>(user, hojeK)` — até 2 Smart Insights (padrões, nunca diagnóstico);
- `exportar<Nome>(userId)` — a parte do módulo na exportação JSON;
- `tests/e2e/modulos/<NN>-<modulo>.mjs` — o teste de ponta a ponta, carregado pelo `fluxo.mjs`
  (`E2E_MODULOS=10-treinos` roda só ele; `E2E_PORTA` muda a porta).

### Decisões técnicas

- **Next.js 16 + TypeScript + Tailwind 4 + Prisma 7 (PostgreSQL) + Recharts**, como no plano. Um projeto só (front e
  back juntos); o servidor sai em modo *standalone* (imagem de ~435 MB).
- **Autenticação própria em vez do Auth.js:** o plano pede controle de sessões (ver e encerrar) e duas etapas; o
  provedor de senha do Auth.js só trabalha com sessões JWT, que não dá para revogar no servidor. Aqui são poucas peças
  conhecidas (scrypt, token aleatório + SHA‑256 no banco, TOTP), todas com testes.
- **shadcn/ui e Framer Motion:** os componentes seguem o estilo do shadcn/ui mas foram escritos à mão (sem dependências
  de Radix) e as animações são CSS (respeitam "reduzir movimento"); menos código baixado no celular.
- **Dias no fuso do usuário:** água, hábitos e tarefas usam a data local (`America/Sao_Paulo` por padrão, ajustável no
  perfil); horários ficam em UTC no banco.

## Próximas fases

- **Fase 3 — Inteligência:** Analytics Center (relatórios diário/semanal/mensal, PDF), notificações (Web Push no
  iPhone), Finance Center, Project Hub (Kanban) e Life Intelligence (assistente de IA opcional, local ou por API, só com
  o que você autorizar).
- **Fase 4 — Ultimate:** comandos de voz, widgets personalizáveis, integrações autorizadas (Google Calendar), cofre de
  documentos, diário de momentos com fotos.
