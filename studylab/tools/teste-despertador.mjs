/* Testa as contas do despertador: node tools/teste-despertador.mjs */
import { devemTocar, aposTocar, soneca, proximoToque, faltaTexto, descreverDias, chaveMinuto } from '../js/despertador.js';

let ok = 0, falhas = 0;
const conferir = (c, t, x = '') => { if (c) { ok++; console.log(`  ✓ ${t}`); } else { falhas++; console.log(`  ✗ ${t}${x ? ' → ' + x : ''}`); } };

const seg7h = new Date(2026, 10, 2, 7, 0, 20);   // segunda, 07:00
const sab7h = new Date(2026, 10, 7, 7, 0, 5);    // sábado, 07:00
const semana = { id: 'a', hora: '07:00', dias: [1, 2, 3, 4, 5], rotulo: 'Estudar', ativo: true };
const umaVez = { id: 'b', hora: '07:00', dias: [], rotulo: 'Prova', ativo: true };

conferir(devemTocar([semana], seg7h).length === 1, 'toca na segunda às 07:00');
conferir(devemTocar([semana], sab7h).length === 0, 'não toca no sábado (só dias de semana)');
conferir(devemTocar([{ ...semana, ativo: false }], seg7h).length === 0, 'desligado não toca');
conferir(devemTocar([semana], new Date(2026, 10, 2, 7, 1)).length === 0, 'às 07:01 não toca mais');

const depois = aposTocar(semana, seg7h);
conferir(devemTocar([depois], new Date(2026, 10, 2, 7, 0, 50)).length === 0, 'não toca duas vezes no mesmo minuto');
conferir(depois.ativo === true, 'o de dias de semana continua ligado');
conferir(aposTocar(umaVez, seg7h).ativo === false, 'o de uma vez só desliga depois de tocar');

const zz = soneca(aposTocar(umaVez, seg7h), seg7h);
conferir(zz.ativo === true && zz.sonecaAte === '2026-11-02T07:05', 'soneca marca 07:05 e religa', zz.sonecaAte);
conferir(devemTocar([zz], new Date(2026, 10, 2, 7, 5, 1)).length === 1, 'a soneca toca às 07:05');
const zzTocou = aposTocar(zz, new Date(2026, 10, 2, 7, 5, 1));
conferir(zzTocou.sonecaAte === null && zzTocou.ativo === true, 'depois da soneca, o de uma vez continua ligado até desligar');

const sexNoite = new Date(2026, 10, 6, 22, 0);   // sexta 22h
const prox = proximoToque(semana, sexNoite);
conferir(prox && prox.getDay() === 1 && prox.getHours() === 7, 'de sexta à noite, o próximo é segunda 07:00', String(prox));
conferir(faltaTexto(prox, sexNoite) === 'em 2 dias e 9 h', 'texto do tempo que falta', faltaTexto(prox, sexNoite));
conferir(faltaTexto(new Date(2026, 10, 2, 7, 45), new Date(2026, 10, 2, 7, 0)) === 'em 45 min', '45 minutos');
conferir(proximoToque({ ...semana, ativo: false }, sexNoite) === null, 'desligado não tem próximo toque');
conferir(descreverDias([1, 2, 3, 4, 5]) === 'Dias de semana' && descreverDias([]) === 'Uma vez'
  && descreverDias([6, 0]) === 'Fim de semana' && descreverDias([1, 3]) === 'Seg, Qua', 'nomes dos dias');
conferir(chaveMinuto(new Date(2026, 0, 5, 9, 3)) === '2026-01-05T09:03', 'chave do minuto');

console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
