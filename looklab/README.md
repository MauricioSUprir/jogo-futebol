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
instalado na tela de início do celular (PWA). Na primeira vez o app pede para
**criar uma conta** (e-mail e senha) — veja [Conta e senha](#conta-e-senha).

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
| 👤 **Perfil** | Vários perfis (um guarda-roupa por pessoa), estilos preferidos, conquistas, tema, **conta** (trocar senha, sair, excluir) e a **área dos responsáveis**. |

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

## Conta e senha

O app abre numa tela de **cadastro / login com e-mail e senha**. Cada conta tem
o seu próprio guarda-roupa, e várias contas podem conviver no mesmo aparelho.

Como funciona por dentro:

- a senha **não é guardada** em lugar nenhum — nem no aparelho. O que fica salvo
  é a derivação **PBKDF2-SHA256 com 210 mil rodadas** e um **sal aleatório de
  16 bytes por conta** (WebCrypto), e a comparação no login é feita em tempo
  constante;
- ao criar a conta você escolhe **começar do zero** ou **começar com o
  guarda-roupa de exemplo** (Lucas, Marina e Pedro — só para experimentar);
- a sessão continua aberta entre uma visita e outra; **Perfil → Conta** tem
  *trocar senha*, *sair* e *excluir conta*;
- quem já usava a versão anterior (sem login) não perde nada: os dados que
  estavam no aparelho são herdados pela **primeira conta criada**.

### O que este login é — e o que não é

É uma **tranca local do app**, não autenticação de servidor. Sem back-end:

- os dados **não sincronizam** entre celular, tablet e computador — cada
  aparelho tem o seu;
- **não existe recuperação de senha por e-mail**. Esquecendo a senha, restam
  dois caminhos: restaurar um backup exportado numa conta nova, ou apagar a
  conta (a tela “Esqueci minha senha” faz isso);
- quem tiver acesso físico ao aparelho desbloqueado consegue ler o
  `localStorage` pelo navegador. Serve para separar contas e evitar que alguém
  abra o app por cima do seu ombro, não para proteger segredo de valor.

Para login de verdade (recuperação por e-mail e sincronização entre aparelhos)
seria preciso um servidor — dá para ligar depois num serviço como o Supabase ou
no back-end do próprio repositório, sem refazer o app.

## Dados

Tudo fica **no próprio aparelho** (`localStorage`): as contas em
`looklab.contas` e o guarda-roupa de cada uma em `looklab.dados.<id da conta>`.
Nada é enviado para servidor nenhum. Na área dos responsáveis dá para
**exportar um backup** em JSON (só o guarda-roupa — o backup **não** carrega
e-mail nem senha), **importar** de volta, **esvaziar o guarda-roupa** e
**recomeçar do exemplo**.

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
