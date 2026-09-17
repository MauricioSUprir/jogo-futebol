# Regras de segurança do Firebase — travar o ganho de Total Coins

## O problema

O saldo de Total Coins fica em `users/<uid>/coins` no Realtime Database e é
escrito **pelo próprio navegador**. Com as regras abertas (`".write": "auth != null"`),
qualquer pessoa abre o console do navegador e faz:

```js
firebase.database().ref("users/" + firebase.auth().currentUser.uid + "/coins").set(999999)
```

e ganha coins infinitas. Isso esvazia a premiação do Draft, a do Dream Team e,
principalmente, o painel de administração — se todo mundo pode se dar coins, o
presente do administrador não vale nada.

## O que as regras deste arquivo fazem

| | |
|---|---|
| Gastar (diminuir o saldo) | continua livre |
| Ganhar (aumentar o saldo) | no máximo **250 por vez** e **1 vez a cada 8 segundos** |
| Carimbo de tempo (`coinGate`) | só pode ser gravado com a hora **do servidor**, não dá para forjar |
| Administrador | sem limite nenhum |

O maior prêmio do jogo é 100 coins (campeão do Draft), então o teto de 250 não
atrapalha nada legítimo. O carimbo de tempo é gravado na **mesma operação** do
ganho, então não adianta gravar só um dos dois.

## Como aplicar

1. Abra <https://console.firebase.google.com> → projeto **total-match-af5e1**
2. Menu **Realtime Database** → aba **Regras** (Rules)
3. **Copie as regras atuais para um bloco de notas** (é o seu plano B)
4. Cole o conteúdo de `regras-database.json` e clique em **Publicar**

## Antes de publicar: cadastre os administradores

As regras dão passe livre para quem estiver em `admins/<uid>`. Sem isso, o
painel de administração para de funcionar.

1. No console, **Realtime Database** → aba **Dados**
2. Ache o `uid` de cada administrador em `users/` (é a chave de cada conta;
   dá para conferir pelo `number` da conta)
3. Crie o nó `admins` e, dentro dele, uma entrada por administrador:

```
admins
  └── <uid do mauricio@gruposuprir.com>: true
  └── <uid do gui.drodrigues21@gmail.com>: true
```

## Como testar depois de publicar

1. Entre no jogo, jogue um Draft e veja se o prêmio cai normalmente
2. No console do navegador, tente `...ref("users/<seu uid>/coins").set(999999)`
   — tem que dar **PERMISSION_DENIED**
3. Com a conta de administrador, dê coins para outra conta pelo painel — tem
   que funcionar

## Se der problema

Volte para as regras que você copiou no passo 3. O jogo continua funcionando
como antes; só o exploit volta junto.

## Importante

Eu **não consigo testar estas regras daqui** — elas ficam no console do
Firebase, que só você acessa. Publique com as regras antigas salvas à mão.
