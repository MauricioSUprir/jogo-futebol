# Modo Leilão — regras opcionais do Firebase (`regras-leilao-validate.json`)

**Não é preciso publicar nada para o Modo Leilão funcionar.** Com as regras de hoje (`regras-database.json`), o nó
`leiloes/` já funciona, no nível "entre amigos" de todo o online do Total Match. Este arquivo é a decisão 10 do
`PLANO-LEILAO.md`: um bloco **só de `.validate`**, que você publica no console se quiser.

## O que ele faz

O bloco só **acrescenta conferências** em `leiloes/<código>`. Ele não mexe na raiz (`.read`/`.write`), nem em `users`,
`admins`, `salas3d` ou qualquer outro modo.

| Onde | O que o servidor passa a recusar |
|---|---|
| `vivo` (o leilão ao vivo) | o `seq` que volta; o valor do lance que desce no mesmo lote; **lance depois do fim do lote** (o servidor é o juiz da hora: `now`); **apagar só o `vivo`** (a regra fica em `leiloes/<código>`, que continua existindo: por isso vale também para apagar) |
| `vivo/abre`, `vivo/t` | hora que não seja a do servidor (`now`) |
| `bate/<uid>` | batimento com hora que não seja a do servidor; batimento gravado por outra conta; a presença contínua (`ant`, `cont`, `falta`: bates anteriores) no futuro ou fora de número |
| `pres/<uid>`, `escal/<t>` | presença e escalação gravadas por outra conta (o autor tem de ser o `auth.uid` gravado em `sala/tec/<uid>/auth`) |
| `sala`, `sala/meta` | apagar só a `sala`, a `meta` ou o dono, o estado, as regras ou a criação; trocar o dono; `criada`, `atividade` e `fimLeilao` com hora que não seja a do servidor; estado fora da lista |
| `sala/tec/<uid>/auth` | trocar a conta de um técnico (só ao entrar, com a do próprio pedido); apagar só a conta |
| `sala/pedidos/<uid>` | pedido em nome de outra conta |
| `lotes` | trocar ou apagar os jogadores depois do Começar |
| `vendas/<i>`, `jogos/<j>/res` | gravar de novo um registro ou um resultado (grava uma vez) |
| `jogos/<j>` (o campeonato) | a máquina andar para trás: **o jogo feito não muda**; o reservado só nasce do nada ou do prazo aberto (nunca de volta ao aberto: uma trava nova daria outro sorteio); o resultado só sobre o reservado e com a **mesma trava**; o reservado "pelo prazo" **antes de o prazo vencer** pela hora do servidor (`now`); o prazo maior que 2 min ou que volta a crescer; o 3D reservado (o "Jogar" contra um bot) só ganha o `abriu` uma vez, com a mesma trava, quem reservou, o motivo e o início (as escalações e os técnicos, os aparelhos conferem); o par (o jogo contra um amigo no Online 3D, PR 5) só ganha o toque do outro lado (`vem0`/`vem1`) uma vez, com a hora do servidor e o resto igual; **o toque de cada lado só pela conta do técnico daquele lado** (`vem0` pela conta de `ab[0]`, `vem1` pela de `ab[1]`, achadas por `sala/ordem` e `sala/tec/<uid>/auth`; revisão do PR 5); a reserva nova do par com **um toque só**; o W.O. de quem saiu (`woPor: 'saiu'`) e o resultado do 3D do par só **com o `abriu`**; `ini`, `trava`, `inicio`, `abriu`, `vem0`, `vem1` e `ts` com hora que não seja a do servidor |
| `sala/meta/camp`, `sala/meta/fimCamp` | o começo e o fim do campeonato com hora que não seja a do servidor |

## O que ele NÃO protege

- **Apagar** a sala (o `.validate` não vale para apagar; isso exige tirar o `.write` da raiz, o que mexe em todos os
  modos online).
- **Apagar e gravar de novo em várias gravações** onde a regra só olha o próprio nó: o registro de uma venda
  (`vendas/<i>`; a verdade é o `vivo`, a tela só mostra) e o técnico inteiro (`sala/tec/<uid>` apagado, um pedido novo em
  nome de outra conta e o técnico gravado de novo com ela). Numa gravação só não passa; em duas (a venda) ou três (o
  técnico), passa.
- **Lance em nome de outro técnico** (o líder do lance é um número; as regras não conseguem achar o técnico por ele).
  A conferência que cada aparelho faz do leilão continua acusando o resto (lance acima do máximo, saldo que sobe,
  venda sem dinheiro), e a sala congela com "A sala foi alterada fora das regras".
- **No campeonato, o resultado inventado** e a escalação com jogadores de outro técnico: as regras não recalculam a
  partida (o resultado do 3D nem os aparelhos recalculam: conferem só a forma, o lado e quem reservou; o W.O. do 3D antes
  do prazo também passa pelas regras — os aparelhos acusam, menos o W.O. aceito por quem reservou, com o `desistiu`). Quem recalcula é cada aparelho (o simulado com a semente da sala e a trava do jogo), e a sala congela. Também
  passa **apagar um jogo** (o `.validate` não vale para apagar): os aparelhos que já o tinham visto congelam a sala.

**Uma nota técnica sobre o toque do par:** a regra do `vem0`/`vem1` acha o técnico pelo índice gravado em `ab` (um número) e
usa `'' + número` para virar o nome do filho de `sala/ordem` (o `child()` das regras pede texto). Ela foi conferida pelo
avaliador dos testes (`ferramentas/lib/regras-leilao.mjs`, que roda as expressões como JavaScript) e não no emulador do
Firebase; se o console recusar a conversão ao publicar, troque o trecho pela comparação com cada índice
(`ab/0 === 0 && …ordem/0…`) — a estrutura de hoje (`sala/ordem` e `sala/tec/<uid>/auth`) já basta. O `ts ≥ abriu` do W.O. e do
3D do par, os aparelhos conferem (a regra só exige o `abriu`).

## Atenção: a conta vinculada em dois aparelhos

Com este bloco publicado, cada técnico fica preso à **conta de autenticação do aparelho em que entrou** (o `auth.uid`).
Quem tem a conta do Total Match vinculada e abre a mesma sala em **outro aparelho** entra como o mesmo técnico (o número
do TM é o mesmo), mas o servidor recusa o batimento, a presença e a escalação desse aparelho: ele fica em
"Reconectando…" e o técnico passa sozinho nos lotes, como quem sumiu. **Ainda não há remédio dentro da sala** (o
"passar o clube" é para outra conta, com outro número; trocar só a conta de autenticação de um técnico fica para depois,
`PLANO-LEILAO.md` §8): jogue a sala no aparelho em que entrou. Sem o bloco publicado, nada disso acontece.

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

Este bloco não foi rodado num servidor do Firebase de verdade (os testes do Total Match nunca usam o Firebase real).
Na revisão do PR 2 ele passou por um avaliador das regras (a mesma semântica do `.validate`: só valores não nulos, no nó
gravado, nos de dentro e nos de cima) ligado em cada gravação do leilão online dos testes: 6 673 gravações, nenhuma
honesta recusada (só o batimento de uma aba velha logo antes de ela virar "outra aba", sem efeito, e o batimento que
chegou depois de a sala ser encerrada, que deve mesmo ser recusado). No PR 3 o avaliador virou parte dos testes
(`ferramentas/lib/regras-leilao.mjs`, que lê ESTE arquivo): no `testar-leilao.mjs` (bloco KO) o campeonato online de 2,
4 e 8 aparelhos passa por ele em cada gravação (~2 900; nenhuma recusada) e as adulterações da máquina do jogo são
recusadas; no `testar-leilao-online.mjs` (o G3) cada gravação das páginas do navegador, do saguão ao campeão (~270 no
caso de 2 páginas, ~1 500 no de 4, ~2 800 no de 8; nenhuma honesta recusada). Uma recusa é de propósito: o batimento (ou
a presença) que estava a caminho no instante em que o dono passa o clube a outro aparelho — a conta já não é da sala. A
sessão não toma essa recusa por queda de conexão (antes do PR 3, o aparelho velho ficava em "Reconectando…"; o caso
`passar` do bloco KO roda com as regras VALENDO). Por isso ele é opcional, e o plano B do passo 2 é importante.
