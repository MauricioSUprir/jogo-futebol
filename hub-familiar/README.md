# NEXO — Hub da Família

Um **hub** para toda a família, com as informações do dia num só lugar. Cada
pessoa tem o **seu perfil (conta)** e entra para ver — e cuidar — das coisas da
casa. Feito para abrir no celular (dá pra instalar como app pela tela de início).

> Faz parte da família de apps **NEXO** deste repositório, no mesmo estilo do
> [Finanças de Casa](../financas-casa/). É um app estático (um só `index.html`),
> sem instalar nada.

## O que tem

- **🏠 Hoje** — o resumo do dia: suas tarefas, o cardápio de hoje, a lista de
  compras, os últimos recados e as próximas datas.
- **✅ Tarefas da casa** — quem faz o quê, com data, e marcar como feito. Filtros
  por _minhas_, _hoje_, _abertas_. Tarefas atrasadas ficam destacadas.
- **🛒 Lista de compras** — lista compartilhada; qualquer um adiciona, marca o
  que já comprou e limpa os comprados.
- **🍽️ Cardápio** — café, almoço e jantar de cada dia (navega entre os dias).
- **📌 Recados / mural** — recadinhos entre a família, com autor e horário.
- **🎂 Datas** — aniversários (repetem todo ano) e lembretes, com a contagem de
  quantos dias faltam.
- **👪 Família** — gerenciar os perfis (avatar, cor, PIN, papel), renomear a
  família e fazer **backup** dos dados.

## Contas / perfis

Na primeira vez, você cria a **família** e o **seu perfil** (você fica como
_responsável_). Depois, em **👪 Família**, o responsável adiciona as outras
pessoas. Cada perfil pode ter um **PIN de 4 dígitos** opcional — aí, para entrar
naquele perfil, o app pede o PIN.

Na tela inicial (“Quem está aí?”) cada pessoa toca no seu rostinho para entrar.
O botão **trocar ⇄** no topo volta para essa tela.

> **Papéis:** _responsável_ (admin) pode adicionar/remover membros e mudar o
> nome da família; _membro_ cuida das tarefas, compras, cardápio, recados e datas.

## Como usar

Abra o **`index.html`** no navegador (ou pelo link do GitHub Pages, em
`/hub-familiar/`). Não precisa instalar nada. No celular, use “Adicionar à tela
de início” para virar um app.

## Onde ficam os dados (camada isolada, pronta pra conectar)

Hoje os dados ficam **guardados só neste aparelho** (no `localStorage` do
navegador). Toda a persistência está isolada em **um único ponto** do
`index.html`, no objeto `Store` (`Store.load()` / `Store.save()`):

```js
const Store = {
  load(){ /* lê do localStorage */ },
  save(state){ /* grava no localStorage */ }
};
```

Para **sincronizar entre celulares** (cada pessoa vendo a mesma família de
qualquer aparelho), basta trocar o corpo dessas duas funções por chamadas de
API/servidor — o resto do app (telas, contas, listas) não muda. É a mesma
filosofia de “camada de dados isolada” do Finanças de Casa.

Enquanto isso, dá para levar os dados para outro aparelho com **Exportar** e
**Importar backup** (arquivo `.json`) em **👪 Família → Configurações**.
