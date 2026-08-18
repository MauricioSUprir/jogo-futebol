/* Testes do conferidor de código Pix.
   Também exporta montarBRCode(), usado pelo teste do servidor para dublar o
   Mercado Pago com um código Pix de verdade.                                 */
import { conferirBRCode, crc16, lerBlocos } from '../src/brcode.js';

const ehTeste = process.argv[1]?.endsWith('brcode.js');

let ok = 0, falhas = 0;
const conferir = (certo, texto, extra = '') => {
  if (certo) { ok++; console.log(`  ✓ ${texto}`); }
  else { falhas++; console.log(`  ✗ ${texto}${extra ? ' → ' + extra : ''}`); }
};

/** Monta um BR Code válido, como o Mercado Pago devolveria. */
export function montarBRCode(valor) {
  const bloco = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const corpo = bloco('00', '01') + bloco('01', '12')
    + bloco('26', bloco('00', 'BR.GOV.BCB.PIX') + bloco('01', 'chave@studylab.app'))
    + bloco('52', '0000') + bloco('53', '986')
    + bloco('54', Number(valor).toFixed(2))
    + bloco('58', 'BR') + bloco('59', 'STUDYLAB') + bloco('60', 'SAO PAULO')
    + bloco('62', bloco('05', 'STUDYLAB1'));
  const semCrc = corpo + '6304';
  return semCrc + crc16(semCrc);
}

if (!ehTeste) { /* importado por outro teste: só o montarBRCode interessa */ }
else await rodar();

async function rodar() {
console.log('\n== código Pix (BR Code) ==');
{
  const codigo = montarBRCode(29.99);
  const r = conferirBRCode(codigo, 29.99);
  conferir(r.ok && r.valor === 29.99, 'código com o valor certo passa', r.motivo);
  conferir(lerBlocos(codigo)['54'] === '29.99', 'o valor está dentro do código (campo 54) — o banco lê de lá');
  conferir(lerBlocos(codigo)['53'] === '986', 'moeda é real (986)');
}
{
  const codigo = montarBRCode(9.99);
  const r = conferirBRCode(codigo, 29.99);
  conferir(!r.ok && r.motivo.includes('valor errado'), 'valor diferente do plano é BARRADO', r.motivo);
}
{
  const bom = montarBRCode(29.99);
  const mexido = bom.slice(0, 40) + (bom[40] === '9' ? '8' : '9') + bom.slice(41);
  const r = conferirBRCode(mexido, 29.99);
  conferir(!r.ok, 'código adulterado é barrado pela soma de verificação', r.motivo);
}
{
  const cortado = montarBRCode(29.99).slice(0, -8);
  const r = conferirBRCode(cortado, 29.99);
  conferir(!r.ok, 'código truncado (copiado pela metade) é barrado', r.motivo);
}
{
  const bloco = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const semValor = bloco('00', '01') + bloco('01', '12')
    + bloco('26', bloco('00', 'BR.GOV.BCB.PIX') + bloco('01', 'chave@studylab.app'))
    + bloco('52', '0000') + bloco('53', '986') + bloco('58', 'BR')
    + bloco('59', 'STUDYLAB') + bloco('60', 'SAO PAULO');
  const semCrc = semValor + '6304';
  const r = conferirBRCode(semCrc + crc16(semCrc), 29.99);
  conferir(!r.ok && r.motivo.includes('sem valor'), 'código SEM valor é barrado (aluno teria que digitar)', r.motivo);
}
{
  conferir(!conferirBRCode('', 29.99).ok, 'código vazio é barrado');
  conferir(crc16('123456789') === '29B1', 'CRC16/CCITT-FALSE bate com o valor de referência (29B1)', crc16('123456789'));
}

console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
}
