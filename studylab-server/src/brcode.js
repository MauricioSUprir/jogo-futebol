/* ===== brcode.js — conferindo o código Pix antes de mostrar para o aluno =====
   O "copia e cola" do Pix é um BR Code: um texto no formato EMV, feito de
   blocos "id + tamanho + valor". O campo 54 é o VALOR e o 63 é a soma de
   verificação (CRC16). Como o código é dinâmico, o banco lê o valor de lá e
   mostra pronto — o aluno só confirma, não digita nada.
   Aqui a gente confere isso antes de mostrar, para nunca exibir um código com
   valor errado ou truncado.                                                  */

/** Quebra o BR Code nos seus blocos (id → valor). */
export function lerBlocos(codigo) {
  const blocos = {};
  let i = 0;
  while (i + 4 <= codigo.length) {
    const id = codigo.slice(i, i + 2);
    const tam = Number(codigo.slice(i + 2, i + 4));
    if (!Number.isInteger(tam) || tam < 0) throw new Error('BR Code malformado');
    const valor = codigo.slice(i + 4, i + 4 + tam);
    if (valor.length < tam) throw new Error('BR Code truncado');
    blocos[id] = valor;
    i += 4 + tam;
  }
  return blocos;
}

/** CRC16/CCITT-FALSE — é o que o padrão do Pix usa no campo 63. */
export function crc16(texto) {
  let crc = 0xFFFF;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Confere se o código Pix está íntegro e com o valor certo.
 * @returns {{ok:true, valor:number} | {ok:false, motivo:string}}
 */
export function conferirBRCode(codigo, valorEsperado) {
  const texto = String(codigo || '').trim();
  if (texto.length < 30) return { ok: false, motivo: 'código Pix vazio ou curto demais' };

  // a soma de verificação cobre tudo até "6304" (inclusive)
  const corte = texto.lastIndexOf('6304');
  if (corte < 0) return { ok: false, motivo: 'código Pix sem soma de verificação' };
  const esperado = crc16(texto.slice(0, corte + 4));
  const informado = texto.slice(corte + 4).toUpperCase();
  if (esperado !== informado) return { ok: false, motivo: 'código Pix corrompido (soma de verificação não bate)' };

  let blocos;
  try { blocos = lerBlocos(texto); }
  catch (e) { return { ok: false, motivo: e.message }; }

  if (blocos['53'] && blocos['53'] !== '986') return { ok: false, motivo: 'código Pix não está em reais' };

  const bruto = blocos['54'];
  if (!bruto) return { ok: false, motivo: 'código Pix sem valor — o aluno teria que digitar' };
  const valor = Number(bruto);
  if (!Number.isFinite(valor)) return { ok: false, motivo: `valor ilegível no código Pix (${bruto})` };
  if (Math.abs(valor - Number(valorEsperado)) > 0.001) {
    return { ok: false, motivo: `valor errado no código Pix: R$ ${bruto} em vez de R$ ${valorEsperado}` };
  }
  return { ok: true, valor };
}
