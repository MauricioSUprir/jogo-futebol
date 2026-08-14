# 🏠 Finanças de Casa

App simples para controlar as finanças da casa: **renda**, **receitas** e **despesas**.

## Como usar

Abra o arquivo **`index.html`** no navegador (duplo clique). Não precisa instalar nada,
não precisa de internet e não precisa de servidor.

## O que dá pra fazer

- Registrar **receitas** (entradas) e **despesas** (saídas) por data e categoria.
- Marcar entradas como **renda fixa / recorrente** (salário, aluguel etc.) — o painel
  mostra a "Renda fixa" separada do total de receitas.
- Ver os **cards do mês**: Renda fixa, Receitas, Despesas e **Saldo** (sobra ou falta).
- Navegar entre os **meses** (‹ / ›).
- Ver **onde vai o dinheiro**: despesas por categoria, em barras e em %.
- **Exportar / importar backup** em JSON e carregar um **exemplo** para testar.

## Onde ficam os dados

Tudo é salvo **localmente no seu navegador** (`localStorage`), só neste computador.
Nada é enviado para nenhum servidor. Use o botão **Exportar backup** de vez em quando
para guardar uma cópia do arquivo `financas-casa-backup.json`.
