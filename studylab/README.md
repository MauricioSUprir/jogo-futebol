# 📚 StudyLab

**Plataforma de organização, aprendizado e desempenho escolar.**
O aluno abre o app e sabe na hora: *o que eu faço agora, o que está atrasado, qual matéria
precisa de mim, quando revisar, quanto falta para a prova e se eu estou melhorando.*

App **100% estático** (HTML + CSS + JavaScript puro, sem build). Tudo é salvo no próprio
navegador e funciona **offline** (PWA, dá para instalar na tela inicial). Entra com o Google
ou sem conta, e o **Study AI** é o recurso do plano pago.

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

## Conta e primeiro acesso

O app **começa vazio**. No primeiro acesso o aluno passa por um cadastro de 4 passos:

1. **Entrar com o Google** ou continuar sem conta.
2. Nome e em que ano está.
3. **Quais matérias ele tem** — o StudyLab não adivinha a grade da escola: mostra as matérias
   típicas do nível (fundamental ou médio) para marcar em um toque, e aceita outras digitadas.
4. Quanto tempo pretende estudar por dia.

Pronto: as matérias são criadas e o app já funciona com a escola dele. Nada de dados de exemplo
— quem quiser ver o app "cheio" tem o link *ver o app com dados de exemplo* na tela de entrada.

**Login com o Google:** já implementado (Google Identity Services, direto no navegador).
Falta só criar o Client ID e colar em `js/produto.js` → `GOOGLE_CLIENT_ID`, autorizando a
origem do Pages. Enquanto isso o botão explica o passo a passo e o aluno entra sem conta.

**Sem Google também dá:** com o servidor ligado, quem escolhe "continuar sem conta" ganha uma
**conta de aparelho** — id e senha sorteados na primeira abertura e guardados só no celular.
Serve para usar o Study AI e assinar. O que se perde é a recuperação em outro aparelho.

---

## Study AI — exclusivo do plano Pro

O aluno **nunca vê chave de API**. Quem assina fala com o modelo através do servidor do
StudyLab (`js/produto.js` → `SERVIDOR`), que guarda a chave e confere a assinatura.
Sem assinatura, cada tela mostra o convite para assinar.

O que continua **grátis para todo mundo**, porque não depende de IA:

| Função | No plano grátis |
| --- | --- |
| Resumo | resumo **extrativo** — escolhe as frases mais representativas, sem reescrever |
| Questões | monta questões a partir dos seus flashcards |
| Flashcards | extrai de textos "termo: definição" ou de frases com termos-chave |
| Dividir tarefa | receitas por tipo de trabalho (redação, seminário, lista, relatório…) |
| Mapa mental | agrupamento automático por termo-chave |

Prioridades, revisão espaçada, domínio, planos de prova, simulados, foco, desempenho,
notas, metas e gamificação **nunca** dependem de IA.

**O servidor já existe:** [`studylab-server/`](../studylab-server/). Ele guarda a chave,
confere o login do Google, valida a assinatura, cobra pelo Mercado Pago, chama a Claude API e
conta o uso de cada aluno.

**O aluno nunca coloca chave nenhuma.** O caminho é: ele paga o Pix → o Mercado Pago confirma
→ o servidor libera o Pro → o Study AI já está pronto. Quando ele pergunta algo, o app fala
com o servidor, e é o servidor que chama a Claude com a **sua** chave.

Depois de publicar (o README de lá tem o passo a passo do Railway), **não precisa mexer no
código**: abra a **Área do criador** — uma rota escondida (`#/criador`), fora do menu, que abre
tocando 5 vezes na linha da versão no rodapé das Configurações — cole o endereço do servidor e
aperte *Testar servidor*.

Essa é a **única** tela do StudyLab que fala em chave, e o aluno não chega nela. Lá também dá
para testar a IA com uma chave sua antes do servidor existir — só naquele aparelho.

## Planos

| Plano | Preço | Observação |
| --- | --- | --- |
| Semanal | **R$ 5,99** | para experimentar |
| Mensal | **R$ 29,99** | o mais escolhido |
| Anual | **R$ 99,99** | sai por R$ 8,33/mês |

Preços e textos ficam em `js/produto.js` → `PLANOS`. O que é grátis e o que é Pro fica em
`js/ui.js` → `RECURSOS`, e **um porteiro só** decide tudo:

```js
liberado('ia_chat')   // { ok: false, motivo: 'Study AI — o tutor que…' }
ehPro()               // assinatura ativa? (respeita a data de vencimento)
```

**Como alguém vira Pro:**

- **Pagando** — a tela de planos abre uma **tela de pagamento dentro do app**: o aluno escolhe
  a forma e, no Pix, vê o **QR Code e o código copia-e-cola** ali mesmo — com o **valor já
  gravado dentro do código**, então o banco mostra quanto é e ele só confirma. A tela fica olhando o
  pagamento e, assim que ele cai, **libera o Pro sozinha** — sem comprovante, sem espera. No
  cartão, o Mercado Pago abre para digitar os dados. Precisa do servidor com `MP_ACCESS_TOKEN`.
- **Por código de acesso** — para testes, cortesia ou venda combinada. Com servidor, o código
  é conferido no banco (com limite de usos); sem servidor, cai para `js/produto.js` →
  `CODIGOS`, no aparelho, o que serve só para testes.

O **valor cobrado é o do servidor** (`studylab-server/src/pagamento.js` → `PLANOS`), não o que
o app mostra — mexer no navegador não muda o preço.

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
    ├── produto.js        login, servidor, planos e códigos (o que você configura)
    ├── auth.js           entrar com o Google
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
