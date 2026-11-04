/* Testa as contas do cronômetro e do timer: node tools/teste-relogio.mjs */
import * as R from '../js/relogio.js';

let ok = 0, falhas = 0;
const conferir = (c, t, x = '') => { if (c) { ok++; console.log(`  ✓ ${t}`); } else { falhas++; console.log(`  ✗ ${t}${x ? ' → ' + x : ''}`); } };

console.log('== cronômetro ==');
let c = R.cronometroNovo();
c = R.iniciarCronometro(c, 1000);
conferir(R.tempoCronometro(c, 6000) === 5000, 'conta 5 s rodando');
c = R.voltaCronometro(c, 4000);
c = R.voltaCronometro(c, 9000);
c = R.pausarCronometro(c, 11000);
conferir(R.tempoCronometro(c, 99999) === 10000, 'pausado fica parado em 10 s');
c = R.iniciarCronometro(c, 20000);
conferir(R.tempoCronometro(c, 22500) === 12500, 'retoma de onde parou (pausa não conta)');
const v = R.listaVoltas(c);
conferir(v.length === 2 && v[0].n === 2 && v[0].volta === 5000 && v[1].volta === 3000, 'voltas com a duração de cada uma, a última em cima');
conferir(R.voltaCronometro(R.pausarCronometro(c, 23000), 24000).voltas.length === 2, 'pausado não marca volta');
conferir(R.tempoCronometro(R.zerarCronometro(), 5) === 0, 'zerar volta a 0');

console.log('== timer ==');
let t = R.definirTimer(R.timerNovo(), 60000);
t = R.iniciarTimer(t, 0);
conferir(R.restanteTimer(t, 15000) === 45000, 'faltam 45 s depois de 15 s');
t = R.pausarTimer(t, 15000);
conferir(R.restanteTimer(t, 999999) === 45000, 'pausado não anda');
t = R.iniciarTimer(t, 100000);
conferir(!R.timerAcabou(t, 144999) && R.timerAcabou(t, 145000), 'acaba exatamente quando zera');
t = R.marcarTocou(t);
conferir(!R.timerAcabou(t, 200000) && R.restanteTimer(t, 200000) === 0, 'depois de tocar não toca de novo');
t = R.somarTimer(t, 60000, 200000);
conferir(R.restanteTimer(t, 200000) === 60000 && !t.tocou, '+1 min depois de acabar deixa 1 min');
t = R.iniciarTimer(t, 300000);
t = R.somarTimer(t, 60000, 310000);
conferir(R.restanteTimer(t, 310000) === 110000, '+1 min rodando soma no fim');
t = R.iniciarTimer(R.marcarTocou(R.definirTimer(t, 30000)), 0);
conferir(R.restanteTimer(t, 0) === 30000, 'acabado: Iniciar começa de novo do tempo escolhido');
conferir(R.definirTimer(t, 10).duracao === 1000 && R.definirTimer(t, 1e12).duracao === 24 * 3600000, 'duração entre 1 s e 24 h');
conferir(R.restanteTimer(R.reiniciarTimer(R.iniciarTimer(R.definirTimer(t, 90000), 0)), 50000) === 90000, 'reiniciar volta ao tempo escolhido');

console.log('== texto ==');
conferir(R.formatar(0) === '00:00' && R.formatar(65000) === '01:05' && R.formatar(3723000) === '1:02:03', 'mm:ss e h:mm:ss');
conferir(R.formatar(65432, { centesimos: true }) === '01:05,43', 'com centésimos');
conferir(R.formatar(59001, { paraCima: true }) === '01:00' && R.formatar(59001) === '00:59', 'o timer arredonda para cima, o cronômetro para baixo');

console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
