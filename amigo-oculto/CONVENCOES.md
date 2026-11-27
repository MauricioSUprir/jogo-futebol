# Convenções do Amigo Oculto (leia antes de escrever código)

Tudo em **português do Brasil**: textos, comentários, nomes de funções/arquivos sempre que possível.
Next.js **16.4** (App Router, `src/proxy.ts`, `params`/`searchParams` são Promises, `after()`, `useActionState`) — na dúvida
sobre uma API, leia `node_modules/next/dist/docs/` (ver `AGENTS.md`). React 19, Tailwind 4, framer-motion 14, lucide-react,
zod 4, @supabase/ssr 0.12.

## Ambiente compartilhado (vários agentes ao mesmo tempo)
- Já existe um servidor de desenvolvimento em **http://127.0.0.1:3100** (`NEXT_DIST_DIR=.next-dev`). Use esse. **Nunca** rode
  `next dev`, `next build`, `npm run build`, `supabase db reset` nem comandos `git`.
- Tipos: `npx tsc --noEmit` (se criar rota nova, antes `npx next typegen`). Testes de unidade:
  `npx vitest run --project unidade tests/unidade/<arquivo>.test.ts`. Integração (Supabase local): `--project integracao`.
- Supabase local já no ar (`.env.local`). Dados de demonstração: `node scripts/semente-demo.mjs` cria pessoas e 3 grupos
  (aberto, sorteado, encerrado) e grava `.demo.json` (e-mails, senha, ids). Ana (pessoa 0) organiza os grupos.
  Para dados só seus: `DEMO_SAIDA=/tmp/claude-0/demo-<area>.json node scripts/semente-demo.mjs` e `print.mjs --demo <arquivo>`.
- Captura de tela: `node scripts/print.mjs --url /grupo/<id> --saida /tmp/claude-0/prints/<area>-<nome>.png --largura 390`
  (`--pessoa 1` entra como Bruno, `--anonimo` sem login, `--escuro`, `--pagina-inteira`). Veja a imagem com a ferramenta Read.
  Confira **390 px e 1280 px, claro e escuro**, e que `erros` venha vazio.

## Banco (Supabase)
- O esquema está em `supabase/migrations/*.sql` — **leia antes**: tabelas, RLS e as funções (RPC) com as regras. Tipos em
  `src/lib/database.types.ts` (gerados; `npm run db:types`).
- Precisa mudar o banco? Crie um arquivo NOVO de migração na sua faixa de horário reservada (no seu briefing), aplique com
  `node scripts/supabase.mjs migration up` e gere os tipos. Nunca edite migrações existentes. RLS ligado em tudo,
  `revoke all` + `grant` explícito, funções `security definer set search_path = ''` com checagem de quem chama,
  `public.fail('codigo')` para erros (e a mensagem em `src/lib/erros.ts`, só acrescentando).
- Clientes: `clienteServidor()` (Server Components/Actions, RLS vale), `clienteNavegador()` (tempo real, uploads),
  `clienteAdmin()` **só** em `lib/sorteio`, `lib/servidor/entrega` e no cron. Nunca leia dados para uma pessoa com o admin.
- **Sigilo do sorteio**: o resultado só sai por `my_assignment` (o próprio). Mensagens anônimas, palpites, quiz e cartões só
  pelas funções. Nada na interface ou na API pode revelar quem tirou quem.

## Padrões de código
- Server Actions em `src/lib/acoes/<area>.ts` com `"use server"`, devolvendo `Resultado` (`sucesso`, `falha`, `validar` de
  `src/lib/acoes/resultado.ts`, zod 4). Confira a sessão (`usuarioAtual()`), chame as RPCs, `revalidatePath(...)` e, se a
  ação gera notificações, `entregarEmSegundoPlano()` (`src/lib/servidor/entrega.ts`).
- Sala do grupo: `carregarGrupo(id)` (`src/lib/servidor/grupo.ts`, com cache por requisição) dá `evento`, `eu`, `admin`,
  `aprovado`, `aoVivo`, `totalAprovados`. O layout da sala já desenha a capa e as abas (`src/components/grupo/`).
- Tempo real: componente cliente com `clienteNavegador().channel(...).on("postgres_changes", { event, schema: "public",
  table, filter: \`event_id=eq.${id}\` }, ...)`, depois `router.refresh()` ou estado local; `removeChannel` ao desmontar.
  Tabelas na publicação: events, participants, notifications, announcements, chat_messages, polls, poll_votes,
  live_sessions, live_reveals, live_clues, bingo_games, challenge_spins, wall_posts, album_photos, event_log.
- Imagens: `prepararImagem`, `enviarMidia` (bucket público `media`) e `enviarFotoAlbum` (bucket privado `album`) em
  `src/lib/imagem.ts`; mostrar com `urlPublicaDaMidia(caminho)` (`src/lib/env.ts`) ou URL assinada (álbum).
- Datas: `src/lib/formatos.ts` (`dataHora`, `relativo`, `paraInputLocal`/`deInputLocal` — fuso de São Paulo, `dinheiro`).

## Interface (identidade premium)
- Componentes prontos (`src/components/ui`): `Botao`, `BotaoLink`, `BotaoIcone`, `Cartao`, `TituloCartao`, `Selo`, `Vazio`,
  `Campo`, `AreaTexto`, `Selecao`, `Interruptor`, `Dialogo`, `useAvisos` (toasts), `Avatar`, `Logo`, `MarcaPresente`,
  `Girando`, `Esqueleto`, `CarregandoPagina`, `Contagem`; efeitos em `src/components/efeitos` (`Confete`, `tocar`, `vibrar`,
  `usePreferencias`); `EnfeitesTema` em `src/components/grupo/enfeites.tsx`.
- Classes: `vidro`, `vidro-forte`, `fundo-festivo`, `texto-ouro`, `fita-ouro`, `brilho`, `flutuar`, `cintilar`; cores
  `rubi`, `esmeralda`, `ouro`, `t1`/`t2`/`t3` (cores do tema do evento), `texto`, `suave`, `borda`; títulos `font-titulo`.
  Cartões `rounded-cartao`. Use os tokens (funcionam no claro e no escuro); nada de cor fixa que suma no escuro.
- Celular primeiro (390 px), depois tablet e PC. Toda grade com `grid-cols-1` no celular. Áreas de toque ≥ 44 px.
- **Nenhum botão decorativo, nenhuma função de mentira.** Se depende de configuração (e-mail, push), mostre o estado real.
- Estados de carregamento (`carregando`, `useFormStatus`, `useTransition`), erro (mensagem clara), vazio (`Vazio`).
- Acessibilidade: rótulos em todo campo, `aria-*`, foco visível, teclado, contraste AA, `aria-live` em atualizações ao vivo,
  `prefers-reduced-motion` e a preferência da conta (`usePreferencias().menosMovimento`) nas animações.
- Ícones lucide-react. Emoji não é ícone de interface (emojis são bem-vindos no conteúdo que as pessoas escrevem).
