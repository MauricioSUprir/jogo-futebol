# LookLab — seu estilista digital

Plataforma de **organização de roupas e criação de looks para crianças e
adolescentes**. A pessoa cadastra as peças que já tem e o LookLab passa a
entender o guarda-roupa inteiro: monta combinações, sugere o que está faltando,
organiza looks por ocasião e acompanha tendências.

> **Regra de produto:** o LookLab avalia **as roupas** — cor, ocasião, clima e
> equilíbrio entre as peças. Ele **nunca** comenta corpo, peso, altura ou
> aparência de quem veste, e não usa foto de pessoa em nenhuma função.

Abra o **`index.html`** no navegador (ou pelo link do GitHub Pages). Não precisa
instalar nada — é um app de arquivo único, funciona offline e pode ser
instalado na tela de início do celular (PWA).

---

## O que dá para fazer

| Aba | O que tem |
| --- | --- |
| 🏠 **Início** | Contagem do guarda-roupa, **look sugerido para hoje**, peças esquecidas, paleta de cores e os desafios do guarda-roupa. |
| 👕 **Guarda-roupa** | Cadastro completo das peças (categoria, marca, cor, estampa, material, estilo, tamanho, clima, ocasiões, data e preço), busca e filtros, **adicionar por foto**, e a página de cada peça. |
| ✨ **Criar Look** | Montagem por espaços (casaco / cima / baixo / calçado / acessório), **⚡ Monte meu look** (ocasião + estilo + clima → `GERAR LOOK`) e a **avaliação do look**. |
| 🤖 **Estilista** | A **Style AI**: pergunte “quero um look para o shopping”, “cria 3 looks para dia frio”, “o que está faltando aqui?” e ela responde com looks montados a partir das suas peças. |
| 📅 **Calendário** | Planejamento dia a dia, aviso quando o mesmo look já foi usado na semana e **planejar os próximos 7 dias** de uma vez. |
| 🔥 **Tendências** | Radar com força e direção (🔥 crescendo, ⭐ popular, ➡️ estável, 📉 caindo) e, para cada uma, **quantas peças suas já entram nessa linha**. |
| 💡 **Inspirações** | Receitas de look que viram “**criar algo parecido com minhas roupas**”. |
| ❤️ **Desejos** | Lista de compras futuras com duas contas úteis: **com quantas peças suas aquilo combinaria** e se é **parecida demais** com o que já existe. |
| 🧳 **Viagens** | Destino + duração + tipo + clima → mala montada, com o look de cada dia. |
| 👤 **Perfil** | Vários perfis (um guarda-roupa por pessoa), estilos preferidos, conquistas, tema e a **área dos responsáveis**. |

### Como a sugestão é feita

Não há chamada de rede nem modelo externo: o motor é local e considera, para cada peça,

1. **ocasião** marcada na peça × ocasião pedida;
2. **clima** da peça × clima do dia;
3. **estilo** da peça × estilo pedido e estilos preferidos do perfil;
4. **há quanto tempo** a peça não é usada (peça parada ganha prioridade; peça usada ontem perde).

Depois o conjunto inteiro é avaliado em quatro critérios — combinação de cores,
harmonia das peças, adequação à ocasião e ao clima — e as melhores combinações
distintas são apresentadas com a explicação do porquê.

A **combinação de cores** segue regras simples: neutro combina com tudo; duas
cores vizinhas ficam harmônicas; cores opostas criam contraste; três cores
fortes ao mesmo tempo é o caso difícil.

### Adicionar por foto

A foto é reduzida para 360 px e analisada **no próprio aparelho** (nenhuma
imagem sai do navegador). O app lê a **cor predominante** do miolo da imagem e
já sugere a cor e um nome para a peça — é só conferir e ajustar.

### Perfis e responsáveis

- **Perfil da criança/adolescente:** ver o guarda-roupa, criar e favoritar looks, planejar o calendário.
- **Área dos responsáveis** (protegida por um PIN de 4 dígitos definido no primeiro acesso):
  gasto do mês, valor total cadastrado, peças mais e menos usadas com **custo por uso**,
  ciclo das roupas (ativa → pouco usada → arquivada, com destino: doar, guardar, passar, vender),
  gerenciamento de perfis e as **permissões** de cada perfil (cadastrar peças, ver preços, editar a lista de desejos).

> O PIN organiza a navegação entre os dois modos no mesmo aparelho — não é
> controle de acesso com segurança criptográfica.

---

## Dados

Tudo fica **no próprio aparelho** (`localStorage`, chave `looklab.v1`). Nada é
enviado para servidor nenhum. Na área dos responsáveis dá para **exportar um
backup** em JSON, **importar** de volta e **recomeçar do guarda-roupa de
exemplo** (3 perfis já preenchidos, para ver o app funcionando na hora).

## Ligar as tendências numa fonte real

As tendências de hoje são **dados de exemplo**. A integração está isolada em um
único ponto do `index.html`, na função `TrendSource.fetch()`, que devolve:

```js
{
  updatedAt: "2026-08-01",
  trends: [
    { id: "cargo", nome: "Bermuda e calça cargo", emoji: "🩳",
      nivel: 86, status: "crescendo", grupo: "Peças",
      match: { cats: ["bermuda", "calça"], styles: ["streetwear"] },
      dica: "Cargo pede parte de cima simples." }
  ]
}
```

Troque o corpo dessa função por uma chamada de API/catálogo devolvendo esse
formato: o radar, os agrupamentos e o cruzamento com o guarda-roupa continuam
funcionando sem mais nenhuma mudança.

## Ícones

Os PNGs de `assets/` são gerados por `scripts/make-looklab-icons.mjs`
(na raiz do repositório, sem dependências):

```bash
node scripts/make-looklab-icons.mjs
```
