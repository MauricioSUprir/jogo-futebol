# 👁️ KATSEYE Central

**Painel de gestão criativa dedicado ao KATSEYE** (HYBE × Geffen Records — Manon, Sophia,
Daniela, Lara, Megan e Yoonchae). Você abre e sabe na hora: o que acontece hoje, o que está
atrasado, o que vem pela frente, e tem ao lado um estúdio para produzir a peça e um
conselheiro para pensar junto.

App **100% estático** (HTML + CSS + JavaScript puro, sem build, sem `node_modules`). Tudo é
salvo no próprio navegador e funciona **offline** — é um PWA, dá para instalar na tela inicial.

> Abra o `index.html` no navegador ou acesse pelo GitHub Pages: **/katseye-central/**

---

## Os seis módulos

### 1. 🛰️ Command Center
A tela inicial em estilo *mission control*: saudação com a data, **índice de controle do
planejamento** (0–100, calculado com atraso, entregas e agenda), **contagem regressiva** para o
próximo compromisso, **relógio mundial ao vivo** (São Paulo, Los Angeles, Seul, Manila e mais
quatro cidades), quatro indicadores de produtividade, **feed dinâmico** que mistura o que está
chegando na agenda com o registro de atividade e os aniversários de lançamento, atalhos
rápidos, gráfico das entregas dos últimos 7 dias e o painel de destaques do grupo.

### 2. 👑 Enciclopédia
Grade das seis integrantes, cada uma com gradiente próprio, e o **perfil completo** em
`#/membros/<id>`: lore, ficha (origem, função, idiomas), **galeria com lightbox** (setas,
teclado, legenda), discografia e linha do tempo do projeto. **Tudo editável** — dá para
corrigir qualquer campo, adicionar integrante, adicionar/remover lançamento e restaurar os
dados originais.

### 3. 📅 Agenda inteligente
Calendário em **mês / semana / dia**, e a peça central: a **captura em linguagem natural**.

```
reunião de pauta sexta 15h no estúdio   → 🗓️ Reunião · sexta às 15:00 · estúdio
comeback dia 28/06                      → 💿 Comeback · 28/06
gravar teaser com a Megan hoje 18h      → 🎬 Conteúdo · hoje às 18:00 · com Megan
lembrar de fechar o cartaz até quinta   → ✅ Tarefa · prazo quinta
ensaio toda sexta 19:30                 → 🎬 Conteúdo · sexta 19:30 · repete semanal
daqui a 3 dias entregar o roteiro urgente → ✅ Tarefa · em 3 dias · urgente
```

Ele entende data relativa (*hoje, amanhã, depois de amanhã, daqui a 3 dias*), dia da semana,
`dd/mm`, *28 de junho*, hora (*15h, 15h30, às 9:45*), repetição (*toda sexta, todo mês*), tipo
do compromisso, local e qual integrante está envolvida. **Mostra o que entendeu antes de
salvar** — e, se leu como compromisso e era tarefa, um botão troca os dois.

Tarefas têm **nota de prioridade 0–100** (prazo + importância + esforço; atrasada nunca cai
abaixo de 90), filtros, ordenação e busca. Os **resumos do dia e da semana** são escritos pelo
motor do app, sem IA e sem internet.

### 4. 🎨 Estúdio Criativo
Suite de design embutida, desenhando em Canvas no tamanho real do projeto.

| | |
| --- | --- |
| **Formatos** | Cartaz 4:5 · Flyer story 9:16 · Post 1:1 · **Ingresso colecionável** · Cartaz A4 (150 dpi) |
| **Paletas** | Íris, Obsidiana, Neon, Aurora, Brasa e Papel (clara, para impressão) |
| **Fundos** | Malha, raios, degradê, grade e sólido — com grão de filme e brilho opcionais |
| **Edição** | Selo, título, subtítulo, data, hora, local, rodapé, alinhamento, escala do texto, caixa alta, cor de acento por integrante |
| **Imagem** | Foto de fundo com opacidade e enquadramento vertical |
| **Exportação** | PNG em **1×, 2× ou 3×** · **PDF** pela janela de impressão, no tamanho exato da peça |

O **ingresso** tem canhoto destacável, picote, setor, preço, nome do portador e um código de
barras derivado da série — a mesma série gera sempre o mesmo padrão. As peças ficam salvas e
podem ser reabertas para edição.

### 5. 🧠 Conselheiro Estratégico
Um chat contínuo que **enxerga o app**: recebe sua agenda, suas tarefas, suas peças e os dados
do grupo como contexto, e responde tanto sobre o projeto quanto sobre **como usar o próprio
app**. O botão **👁️ o que ele sabe** mostra exatamente o texto enviado — sem caixa-preta. As
respostas podem ser **lidas em voz alta** (`speechSynthesis`).

Três modos, e a tela **diz em qual está, mensagem por mensagem**:

| Modo | O que é |
| --- | --- |
| 🧩 **Motor local** (padrão) | **Não é IA, e o app não finge que é.** Um motor determinístico que aplica frameworks sobre os seus próprios dados: leitura da semana, ordem do dia, ideias de campanha, plano de evento em 30/14/7 dias, protocolo de desbloqueio, diagnóstico e manual do app. Funciona offline e nunca inventa número. |
| 🔑 **Chave neste aparelho** | **Google Gemini** (o AI Studio dá chave de graça, com limite por minuto e por dia) ou **Anthropic**. A chave fica só no `localStorage` deste navegador. |
| 🛰️ **Servidor seu** | O app faz `POST /conselho` com `{ sistema, mensagens, modelo }` e espera `{ texto }`. É o caminho certo para publicar: a chave fica no servidor. |

Se a chamada falhar (limite estourado, internet fora), ele **avisa e responde pelo motor local**
em vez de travar.

### 6. ⚙️ Sistema
Tema escuro/claro, densidade, cor de acento, chave para desligar animações, escolha das cidades
do relógio, configuração da IA, **exportar/importar backup em JSON**, apagar tudo, limpeza de
cache do service worker, medição de espaço usado e o **registro de atividade** completo.

---

## Sobre os dados do grupo — leia isto

Os dados que já vêm preenchidos são uma **semente**, não uma base oficial. Eles trazem só o que
é amplamente conhecido sobre o KATSEYE — formação, integrantes, país de origem e os
lançamentos principais — e **deixam de fora, de propósito, o que não dá para confirmar**: datas
de nascimento vêm em branco, e listas de faixas só aparecem quando existem.

Tudo é editável dentro do app, e o que você editar passa a valer por cima da semente. Se um
dado estiver errado ou desatualizado, **corrija na tela** — não precisa mexer no código.
O app também não embute nenhuma foto do grupo: a galeria é sua, com as imagens que você tem
direito de usar.

---

## Seus dados

Tudo mora **no seu navegador**: o estado no `localStorage` e as imagens no `IndexedDB`. Nada é
enviado para servidor nenhum — a única exceção são as perguntas que você fizer com a IA ligada,
que vão para o provedor escolhido.

Em **Sistema → Seus dados** dá para exportar um backup em JSON, importar e apagar tudo.
Limpar os dados do site apaga o app inteiro: faça backup de vez em quando.

> ⚠️ **Se for publicar o app para outras pessoas**, não use o modo "chave neste aparelho": a
> chave salva ali roda no navegador de quem abrir. Use o modo servidor.

---

## Estrutura

```
katseye-central/
├── index.html            casca do app (menu, barra superior, modal, toasts)
├── manifest.webmanifest  PWA
├── sw.js                 cache offline (rede primeiro, cache como rede de segurança)
├── css/app.css           design system único — tokens, primitivas e módulos
├── assets/               ícones do PWA (o olho, em SVG)
└── js/
    ├── app.js            rotas, menu, busca global, notificações, boot
    ├── store.js          estado único + localStorage + migração + gancho de nuvem
    ├── util.js           datas, DOM, formatação, cores, texto
    ├── motion.js         animação sobre a Web Animations API
    ├── ui.js             componentes reutilizáveis + gráficos em SVG puro
    ├── engine.js         linguagem natural, prioridade, métricas, resumos
    ├── dados.js          a semente de conhecimento do grupo
    ├── cartaz.js         renderizador Canvas (cartaz, flyer, post, ingresso)
    ├── fotos.js          imagens no IndexedDB
    ├── ia.js             Conselheiro: Gemini, Anthropic, servidor ou motor local
    └── views/            uma tela por arquivo (+ comum.js com as peças compartilhadas)
```

**Arquitetura em uma frase:** um estado único que avisa quem escuta (`store.js`), um motor sem
efeito colateral que calcula tudo (`engine.js`), uma biblioteca de componentes (`ui.js`) e telas
que só montam DOM. Nenhuma tela conhece o `localStorage`; nenhum módulo de cálculo conhece o DOM.

---

## Acessibilidade e desempenho

- **Mobile-first de verdade:** menu lateral vira gaveta, barra inferior com cinco destinos,
  alvos de toque de 37px+ e zero rolagem horizontal em 390px.
- **Movimento reduzido:** respeita `prefers-reduced-motion` e tem chave própria nas
  Configurações — com ela ligada, nada anima.
- **Teclado:** `Ctrl/⌘ K` abre a busca global, `Esc` fecha modal e lightbox, setas navegam a
  galeria, `Enter` envia a captura rápida.
- **Erro não derruba a tela:** o roteador isola a exceção e mostra um cartão com o erro e um
  botão de recarregar, em vez de deixar a página em branco.
- **Sem dependência:** nenhum pacote, nenhum CDN, nenhum build. O que carrega é o que você vê.

---

## Rodando

```bash
# não precisa de nada: é só abrir
open katseye-central/index.html

# ou, para testar o service worker e o PWA, sirva por HTTP
python3 -m http.server 8000
# http://localhost:8000/katseye-central/
```

Precisa recomeçar do zero? Abra com `?zerar` no endereço (`.../katseye-central/?zerar`) — ele
pede confirmação antes de apagar.
