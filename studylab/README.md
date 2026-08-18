# 📚 StudyLab

**Plataforma de organização, aprendizado e desempenho escolar.**
O aluno abre o app e sabe na hora: *o que eu faço agora, o que está atrasado, qual matéria
precisa de mim, quando revisar, quanto falta para a prova e se eu estou melhorando.*

App **100% estático** (HTML + CSS + JavaScript puro, sem build, sem servidor, sem login).
Tudo é salvo no próprio navegador e funciona **offline** (PWA, dá para instalar na tela inicial).

> Abra o `index.html` no navegador ou acesse pelo link do GitHub Pages: **/studylab/**

---

## O que já está funcionando

### 🧠 O motor (é onde mora a inteligência do app)

| Peça | O que faz |
| --- | --- |
| **Nota de prioridade (0–100)** | Combina prazo, importância, quanto vale em nota, dificuldade e tamanho. Tarefa atrasada nunca cai abaixo de 90. Toque na nota e o app **mostra a conta**. |
| **Ordem recomendada do dia** | Divide tarefas grandes em blocos, **alterna matérias** (para não ficar 2h no mesmo assunto), encaixa pausas e respeita o tempo diário que você definiu. |
| **Revisão espaçada** | Escada 1 → 3 → 7 → 14 → 30 dias, com fator de facilidade por item (SM-2 simplificado). Errou, volta hoje e recomeça; achou fácil, o intervalo estica. |
| **Índice de domínio (0–100%)** | Calculado com acerto recente (peso maior nas últimas questões), cobertura de questões/flashcards do assunto, força na escada de revisão e **esquecimento pelo tempo sem revisar**. |
| **Semáforo** | 🟢 80–100 dominado · 🟡 60–79 revisar · 🟠 40–59 atenção · 🔴 0–39 prioridade. |
| **Preparo para a prova** | Domínio médio dos conteúdos que caem + execução do plano de estudo. |
| **Plano automático de prova** | Distribui os dias até a prova dando mais tempo ao que você domina menos, e reserva **simulado** (véspera–1) e **revisão rápida** (véspera). |
| **Modo recuperação** | "Estou atrasado 😵‍💫": você diz quanto tempo tem hoje e o app monta um plano de emergência — dizendo **na cara** o que ficou de fora. |
| **Divisão de tarefas** | Trabalho grande vira 5–8 passos concretos (receitas por tipo: redação, seminário, lista, relatório…) ou uma divisão sob medida com IA. |

### 🖥️ As telas

- **🏠 Início** — saudação com o resumo do dia, **modo anti-procrastinação** ("faça só isto agora"), ordem recomendada, agenda de hoje, prioridades, provas com barra de preparo, revisões vencidas, progresso da semana e **fechamento do dia**. Botão de **missão de 5 minutos** para os dias sem vontade.
- **📅 Agenda** — calendário **dia / semana / mês**, horário escolar editável, **mochila digital** e **planejamento semanal** (compara o que a semana pede com a sua capacidade real).
- **✅ Tarefas** — filtros (hoje, semana, atrasadas, concluídas), ordenação por prioridade/prazo/matéria, status, subtarefas e o plano do dia.
- **🎯 Provas** — central com contagem regressiva, conteúdos que caem com semáforo, preparo em %, plano dia a dia com check, simulado, treino e registro da nota.
- **📚 Matérias** — média, meta, domínio e o **mapa do conhecimento** em árvore (conteúdo → sub-conteúdo), com diagnóstico.
- **🧠 Aprender** — **me explica** (6 modos: normal, simples, do zero, exemplos, analogia, perguntando), **professor socrático**, **resumos** (6 formatos), **mapas mentais** e **leitura de PDF / foto da atividade**.
- **📝 Questões** — banco próprio, **gerador** (objetiva, discursiva, V/F, associação, interpretação × fácil → insano), **modo prova** cronometrado, **desafio com 3 vidas**, **boss battle** (80% para vencer) e **diagnóstico**. Toda sessão termina com gabarito comentado e desempenho por conteúdo.
- **🃏 Flashcards** — criação manual, geração a partir de qualquer texto, sessão com card que vira e avaliação (errei / difícil / ok / fácil) alimentando a revisão espaçada.
- **🔁 Revisão** — o que vence hoje, **banco de erros** (com motivo provável e "já superou?"), agenda das próximas revisões e uma aba explicando como o método funciona.
- **⏱️ Foco** — cronômetro em tela cheia, **pomodoro** completo (foco / pausa curta / pausa longa) e **ambiente sonoro** gerado no próprio navegador (chuva, cafeteria, floresta, lareira, oceano, ruído branco).
- **📊 Desempenho** — tempo, questões, taxa de acerto, evolução, gráficos (barras, linha, pizza, ranking), tabela por matéria, **central de notas**, **simulador de notas** ("quanto preciso tirar para fechar com 8?" e "e se eu tirar 9?") e **metas**.
- **🏆 Conquistas** — XP, 50 níveis com títulos, 14 conquistas, mapa de calor da sequência e **loja de StudyCoins** (avatares e cores — moeda ganha estudando, nunca com dinheiro).
- **📂 Biblioteca** — materiais por matéria e por tipo, favoritos, **anotações de aula** (com "organizar com IA") e **arquivo escolar por ano**.
- **🤖 Study AI** — conversa com um assistente que recebe seus dados reais. O botão **"👁️ o que ele sabe"** mostra exatamente o texto enviado.
- **🔍 Barra superior** — pesquisa global (matérias, conteúdos, tarefas, provas, questões, flashcards, materiais e erros), **quick add**, sequência, notificações inteligentes e perfil.

---

## Study AI (opcional)

O StudyLab não tem servidor: para usar IA, o aluno cola uma **chave da Claude API**
em *⚙️ Configurações → Study AI*. A chamada vai **direto do navegador para a Anthropic**.

- A chave fica salva **só neste aparelho** (`localStorage`) — quem usar o mesmo navegador consegue lê-la. Não use em computador compartilhado.
- O consumo é cobrado na conta Anthropic de quem colou a chave.
- Modelo padrão: `claude-opus-5` (dá para trocar por Sonnet 5 ou Haiku 4.5 nas configurações).
- Tem botão de **testar conexão** e de **apagar a chave**.

**Sem chave o app continua inteiro.** O que muda:

| Função | Com Study AI | Sem Study AI (modo local) |
| --- | --- | --- |
| Gerar questões | questões novas sobre qualquer conteúdo | monta questões a partir dos seus flashcards |
| Flashcards | lê qualquer material e escreve os cards | extrai de textos "termo: definição" ou frases-chave |
| Resumo | 6 formatos, reescrito | resumo **extrativo** (escolhe as frases mais representativas, sem reescrever) |
| Mapa mental | estrutura de conceitos | agrupamento automático por termo-chave |
| Dividir tarefa | passos sob medida | receitas por tipo de trabalho |
| Explicar / socrático / ler PDF e foto | ✅ | ❌ (o app avisa, não finge que funciona) |

Prioridades, revisão espaçada, domínio, planos de prova, simulados, foco, desempenho,
notas, metas e gamificação **nunca** dependem de IA.

---

## Modo pago (desenhado, ainda desligado)

Toda a decisão passa por **um porteiro só**, em `js/ui.js`:

```js
COBRANCA_ATIVA          // false hoje -> nada é bloqueado
RECURSOS                // lista de recursos, cada um marcado pro: true|false
LIMITES_FREE            // { iaPorDia, arquivosPorDia, simuladosIaPorSemana }
ehPro(estado)           // o aluno é assinante?
liberado(estado, id)    // { ok: true } | { ok: false, motivo }
dentroDaCota(estado)    // cota diária de IA no plano gratuito
```

**Gratuito para sempre:** motor de prioridades, revisão espaçada, domínio, planos de prova,
tarefas, provas, matérias, foco, flashcards, desempenho, gamificação e o Study AI **com a
chave do próprio aluno**.

**Ideias para o Pro:** Study AI incluso (sem chave e sem cartão), sem limite diário, leitura
ilimitada de PDF/foto, correção de redação, sincronizar celular + computador com backup na
nuvem, relatório semanal para o responsável, cronograma de longo prazo (ENEM/vestibular),
banco de questões pronto por série, relatórios avançados em PDF e personalizações exclusivas.

O Pro incluso exige um backend simples (um proxy que guarda a chave e conta o uso) — é a
única parte que ainda não existe. O resto já está preparado: virar `COBRANCA_ATIVA` para
`true` faz as telas respeitarem limites e mostrarem o selo PRO.

---

## Estrutura

```
studylab/
├── index.html            casca do app (menu, barra superior, modal, toasts)
├── manifest.webmanifest  PWA
├── sw.js                 cache offline
├── css/app.css           folha de estilo única (tema escuro e claro)
├── assets/               marca (frasco + livro) em SVG e ícones do PWA
├── tools/bundle.mjs      gera o app inteiro em UM arquivo HTML (para Artifact/offline)
└── js/
    ├── app.js            rotas, menu, notificações, rotina diária
    ├── store.js          estado único + localStorage + CRUD
    ├── seed.js           dados de exemplo do primeiro acesso
    ├── engine.js         prioridades, revisão espaçada, domínio, planos, XP, conquistas
    ├── ai.js             Claude API (direto do navegador) + fallbacks locais
    ├── ui.js             componentes e gráficos em SVG puro (sem biblioteca)
    ├── util.js           datas, formatação, helpers de DOM
    └── views/            uma tela por arquivo (16 telas + formulários comuns)
```

Sem dependências, sem build, sem `node_modules`. É só abrir.

Precisa do app em um arquivo só (para publicar como Artifact, mandar por e-mail ou usar
totalmente offline)?

```bash
node studylab/tools/bundle.mjs saida.html              # HTML completo
node studylab/tools/bundle.mjs saida.html --artifact   # só o conteúdo (Artifacts do Claude)
```

> Dentro de um Artifact/preview a política de segurança da página bloqueia chamadas
> externas — ou seja, o **Study AI não funciona lá**. Todo o resto funciona igual.
> Para usar a IA, abra o app pelo link normal (GitHub Pages ou o arquivo local).

---

## Seus dados

Tudo mora no `localStorage` deste navegador. Em *⚙️ Configurações → Seus dados* dá para
**exportar backup** (JSON), **importar**, **restaurar o exemplo** ou **apagar tudo**.
Limpar os dados do site apaga o app inteiro — faça backup de vez em quando.
