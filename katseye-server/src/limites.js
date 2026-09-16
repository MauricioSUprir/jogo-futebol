/* ===== limites.js — o freio de mão =====
   Este servidor é público: qualquer um que descobrir o endereço pode chamá-lo.
   A checagem de origem só vale para navegador — um script ignora. Então quem
   protege a sua chave de verdade são estes contadores.

   Tudo em memória, de propósito: sem banco, sem dependência, e reiniciar o
   servidor zera. Para o tamanho deste app, é o suficiente — e um contador
   que some no deploy é melhor do que um Postgres que ninguém mantém.       */

const num = (chave, padrao) => Number(process.env[chave]) || padrao;

export const LIMITES = {
  minuto: num('LIMITE_MINUTO', 6),
  diaIp: num('LIMITE_DIA_IP', 40),
  diaTotal: num('LIMITE_DIA_TOTAL', 800),
};

const TETO_IPS = 5000;               // não deixa a memória crescer sem fim
const porIp = new Map();
let hojeTotal = { dia: '', n: 0 };

const diaDeHoje = () => new Date().toISOString().slice(0, 10);
const minutoDeAgora = () => Math.floor(Date.now() / 60000);

/** O IP de quem chamou, respeitando o proxy do Railway. */
export function ipDe(req) {
  const encaminhado = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return encaminhado || req.socket?.remoteAddress || 'desconhecido';
}

/**
 * Confere e já conta. Devolve { ok } ou { ok:false, status, erro, esperar }.
 * Contar junto evita a corrida entre conferir e usar.
 */
export function cobrar(ip) {
  const dia = diaDeHoje();
  const minuto = minutoDeAgora();

  if (hojeTotal.dia !== dia) hojeTotal = { dia, n: 0 };
  if (hojeTotal.n >= LIMITES.diaTotal) {
    return { ok: false, status: 429, erro: 'O servidor bateu o teto de perguntas do dia. Amanhã ele zera.' };
  }

  if (porIp.size > TETO_IPS) porIp.clear();       // limpeza grosseira, mas barata
  let reg = porIp.get(ip);
  if (!reg || reg.dia !== dia) reg = { dia, nDia: 0, minuto, nMinuto: 0 };
  if (reg.minuto !== minuto) { reg.minuto = minuto; reg.nMinuto = 0; }

  if (reg.nMinuto >= LIMITES.minuto) {
    porIp.set(ip, reg);
    return { ok: false, status: 429, erro: 'Muitas perguntas seguidas. Espere um minuto.', esperar: 60 };
  }
  if (reg.nDia >= LIMITES.diaIp) {
    porIp.set(ip, reg);
    return { ok: false, status: 429, erro: `Você já fez ${LIMITES.diaIp} perguntas hoje. Amanhã o contador zera.` };
  }

  reg.nDia += 1;
  reg.nMinuto += 1;
  porIp.set(ip, reg);
  hojeTotal.n += 1;
  return { ok: true, restanteHoje: LIMITES.diaIp - reg.nDia };
}

/** Devolve a cobrança quando a chamada ao modelo falhou por culpa nossa. */
export function estornar(ip) {
  const reg = porIp.get(ip);
  if (reg) {
    reg.nDia = Math.max(0, reg.nDia - 1);
    reg.nMinuto = Math.max(0, reg.nMinuto - 1);
  }
  hojeTotal.n = Math.max(0, hojeTotal.n - 1);
}

export const numeros = () => ({
  perguntasHoje: hojeTotal.dia === diaDeHoje() ? hojeTotal.n : 0,
  ipsHoje: porIp.size,
  limites: LIMITES,
});
