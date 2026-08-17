# Hub da Família

Um **hub** para toda a família, com login por conta. Cada pessoa entra com
**e-mail e senha** e vê os avisos, o cardápio, as atividades e o placar de
pontos. Feito para abrir no celular (dá pra instalar como app pela tela de
início).

> App estático (um só `index.html`, sem instalar nada), no mesmo estilo do
> [Finanças de Casa](../financas-casa/) deste repositório.

## Contas (4 fixas)

- **2 admins:** Maurício e Thaís.
- **2 membros:** os filhos.
- Cada um entra na **primeira página** com **e-mail + senha**.

Senhas temporárias no primeiro acesso: todas `1234`, com os e-mails
`mauricio@familia`, `thais@familia`, `membro1@familia`, `membro2@familia`.
Um admin muda nome, e-mail, senha, papel, avatar e cor de cada conta em
**⚙️ Contas**.

### O que cada papel faz

**Admins ditam, não fazem** (não pontuam nem fazem atividades). Eles podem:
- Publicar **avisos/comunicados** (texto + imagem), para **todos** ou para
  **pessoas escolhidas**.
- Montar o **cardápio da semana**.
- Criar **atividades** e definir quantos **pontos** cada uma vale.
- **Marcar encontros**.
- **Ajustar pontos** (dar ou **tirar** pontos de um membro).

**Membros** (os filhos):
- Fazem **atividades** e ganham os pontos.
- **Comentam** nos avisos.
- Acompanham seus pontos e quanto isso vale em dinheiro.

## Abas

- **📣 Avisos** (principal) — mural de comunicados dos admins. Cada aviso pode
  ter **imagem e texto** e ser **para todos** ou **para pessoas específicas**.
  Os membros **comentam**.
- **⭐ Atividades** — admin cria (título, pontos, para quem, data); o membro
  vê as suas e clica em **Concluir** para ganhar os pontos.
- **🍽️ Cardápio** — café, almoço e jantar de cada dia da semana (admin edita,
  todos veem). Navega entre as semanas.
- **🏆 Placar** — ranking dos membros por **pontos**, com o **valor em dinheiro**
  ao lado, e os **totais**. Admin ajusta pontos e vê o histórico.
- **📅 Encontros** — encontros marcados pelos admins (data, hora, local).
- **⚙️ Conta / Contas** — membro troca a própria senha; admin gerencia as 4
  contas, o nome da família e o **valor do ponto**.

## Pontos valem dinheiro

Cada ponto vale, de início, **R$ 0,50** (o admin pode mudar em Contas). O app
soma os pontos de cada membro e mostra o total em pontos **e em reais**, por
pessoa e no total da família.

## Como usar

Abra o **`index.html`** no navegador (ou pelo link do GitHub Pages, em
`/hub-familiar/`). No celular, use “Adicionar à tela de início” para virar app.

## Onde ficam os dados (camada isolada, pronta pra conectar)

Hoje tudo fica **guardado só neste aparelho** (no `localStorage`). A
persistência e o login ficam isolados no objeto `Store` (`load`/`save`) e na
função `auth()` do `index.html`. Para **sincronizar entre celulares** (cada
pessoa entrando na sua conta de qualquer aparelho), basta trocar essas funções
por chamadas de API/servidor — o resto do app não muda.

Enquanto isso, dá para levar os dados para outro aparelho com **Exportar** e
**Importar backup** (arquivo `.json`) em **⚙️ Contas → Configurações**.

> **Aviso de segurança:** por ser um app estático, as senhas ficam neste
> aparelho (não são protegidas por servidor). Não use senhas sensíveis aqui;
> a versão com servidor guarda tudo com segurança.
