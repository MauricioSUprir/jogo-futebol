# Modo Leilão — regras opcionais do Firebase (`regras-leilao-validate.json`)

**Não é preciso publicar nada para o Modo Leilão funcionar.** Com as regras de hoje (`regras-database.json`), o nó
`leiloes/` já funciona, no nível "entre amigos" de todo o online do Total Match. Este arquivo é a decisão 10 do
`PLANO-LEILAO.md`: um bloco **só de `.validate`**, que você publica no console se quiser.

## O que ele faz

O bloco só **acrescenta conferências** em `leiloes/<código>`. Ele não mexe na raiz (`.read`/`.write`), nem em `users`,
`admins`, `salas3d` ou qualquer outro modo.

| Onde | O que o servidor passa a recusar |
|---|---|
| `vivo` (o leilão ao vivo) | o `seq` que volta; o valor do lance que desce no mesmo lote; **lance depois do fim do lote** (o servidor é o juiz da hora: `now`) |
| `vivo/abre`, `vivo/t` | hora que não seja a do servidor (`now`) |
| `bate/<uid>` | batimento com hora que não seja a do servidor; batimento gravado por outra conta |
| `pres/<uid>`, `escal/<t>` | presença e escalação gravadas por outra conta (o autor tem de ser o `auth.uid` gravado em `sala/tec/<uid>/auth`) |
| `sala/meta` | trocar o dono; `criada`, `atividade` e `fimLeilao` com hora que não seja a do servidor; estado fora da lista |
| `sala/tec/<uid>/auth` | trocar a conta de um técnico (só ao entrar, com a do próprio pedido) |
| `sala/pedidos/<uid>` | pedido em nome de outra conta |
| `lotes` | trocar os jogadores depois do Começar |
| `vendas/<i>`, `jogos/<j>/res` | gravar de novo um registro ou um resultado (grava uma vez) |

## O que ele NÃO protege

- **Apagar** a sala (o `.validate` não vale para apagar; isso exige tirar o `.write` da raiz, o que mexe em todos os
  modos online).
- **Lance em nome de outro técnico** (o líder do lance é um número; as regras não conseguem achar o técnico por ele).
  A conferência que cada aparelho faz do leilão continua acusando o resto (lance acima do máximo, saldo que sobe,
  venda sem dinheiro), e a sala congela com "A sala foi alterada fora das regras".

## Atenção: a conta vinculada em dois aparelhos

Com este bloco publicado, cada técnico fica preso à **conta de autenticação do aparelho em que entrou** (o `auth.uid`).
Quem tem a conta do Total Match vinculada e abre a mesma sala em **outro aparelho** não consegue gravar o próprio
batimento, a presença nem a escalação por lá. Nesse caso, o dono da sala usa **passar o clube** para o pedido desse
aparelho. Sem o bloco publicado, nada disso acontece.

## Como publicar (opcional)

1. Abra o console do Firebase → projeto do Total Match → **Realtime Database** → aba **Regras**.
2. **Copie as regras atuais para um bloco de notas** (é o seu plano B).
3. Dentro de `"rules"`, ao lado de `"admins"` e `"users"`, cole o bloco `"leiloes": { … }` deste arquivo (só ele: a
   raiz e o resto ficam como estão).
4. Clique em **Publicar**.

Para desfazer, apague o bloco `"leiloes"` e publique de novo.

## Como conferir depois de publicar

1. Crie uma sala de leilão com um amigo e jogue alguns lotes: tudo tem de andar como antes.
2. No console do navegador, tente gravar um lance depois do fim do lote ou um `vivo/t` com uma hora inventada: tem de
   dar **PERMISSION_DENIED**.

Este bloco não foi rodado num servidor do Firebase de verdade (os testes do Total Match nunca usam o Firebase real):
conferido aqui só o formato. Por isso ele é opcional, e o plano B do passo 2 é importante.
