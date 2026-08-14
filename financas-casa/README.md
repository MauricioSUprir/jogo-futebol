# 🏠 Finanças de Casa

Painel para acompanhar as finanças da casa — **renda, receitas e despesas** —
com **abas** e **vários gráficos**. O foco é **visualizar** os dados: o app
**puxa** as informações de uma fonte (plataforma/planilha/API) e monta os
gráficos automaticamente — não é de digitação manual.

## Abas

- **📊 Geral** — cartões (Receitas, Despesas, Saldo, Taxa de poupança),
  linha de Receitas × Despesas mês a mês, saldo mensal (sobra/déficit),
  maiores categorias de despesa, rosca de poupança e últimos lançamentos.
- **📈 Receitas** — total, média mensal, maior fonte, receitas por mês,
  por categoria e por plataforma, e tabela das entradas.
- **📉 Despesas** — total, média mensal, maior categoria, despesas por mês,
  por categoria e por plataforma/cartão, e tabela das saídas.

Ainda dá para alternar o período (**6 / 12 meses**) e **atualizar** os dados.

## Como usar

Abra o **`index.html`** no navegador (ou pelo link do GitHub Pages). Não precisa
instalar nada.

## Conectar à sua plataforma (camada de dados isolada)

Toda a integração fica em **um único ponto** do `index.html`, na função
`DataSource.fetchData()`. Hoje ela devolve **dados de exemplo**. Para ligar na
fonte real, basta trocar o corpo dessa função para buscar de uma API, um CSV ou
uma planilha (Google Sheets), devolvendo a lista de lançamentos no formato:

```js
{
  source: "Nome da fonte",
  updatedAt: "2026-08-14T12:00:00Z",
  records: [
    { date: "2026-08-10", type: "despesa", category: "Moradia",
      source: "Banco Principal", description: "Aluguel", amount: 1500 },
    { date: "2026-08-05", type: "receita", category: "Salário",
      source: "Banco Principal", description: "Salário", amount: 4200 }
    // ...
  ]
}
```

O resto do painel (gráficos, tabelas, cálculos) já consome esse formato — nada
mais precisa mudar quando a fonte for conectada.
