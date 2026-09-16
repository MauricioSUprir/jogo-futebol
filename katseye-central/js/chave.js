/* ===== chave.js — a chave que vem embutida no app =====

   COLE A SUA CHAVE NA LINHA `CHAVE_EMBUTIDA`, LÁ EMBAIXO.
   Com ela preenchida, quem abrir o link já encontra o Conselheiro ligado,
   sem configurar nada. Com ela vazia, o app abre no motor local e mostra o
   campo para a pessoa colar a própria chave.

   LEIA ANTES
   ----------
   Este app é um site estático e público: tudo que está aqui é lido por
   qualquer visitante no "ver código-fonte" do navegador. Portanto:

   · A chave abaixo NÃO é secreta. Quem abrir o app pode copiá-la e gastar
     a cota dela.
   · O Google varre repositórios públicos e costuma revogar automaticamente
     as chaves que encontra. Se o Conselheiro parar de responder do nada, é
     quase certo que foi isso: gere outra em
     https://aistudio.google.com/apikey e troque a linha.
   · Se a chave falhar, o app NÃO quebra: ele avisa, volta para o motor
     local e mostra o campo para colar outra.

   Quer o chat ligado para outras pessoas SEM esse problema? Use o
   `katseye-server/` — ele guarda a chave fora do navegador, e o README dele
   tem o passo a passo do Railway (5 minutos).                              */

/** Cole aqui entre as aspas. Vazio = app abre no motor local. */
export const CHAVE_EMBUTIDA = '';

/** De qual provedor é a chave acima: 'gemini' ou 'anthropic'. */
export const PROVEDOR_EMBUTIDO = 'gemini';

export const temChaveEmbutida = () => CHAVE_EMBUTIDA.trim().length > 0;
