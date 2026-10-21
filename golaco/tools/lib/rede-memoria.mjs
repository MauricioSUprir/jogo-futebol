// Rede de mentira para os testes do online (Node): dois sentidos, cada pacote com latência + variação, perda (também em
// rajada), duplicação, e o canal de controle confiável e ordenado (com a mesma latência). Sorteios pelo próprio gerador
// (semente), nunca pelo do mundo. O relógio é o do teste (ms), avançado por ele.
export function criarRede(opc = {}) {
  const LAT = opc.lat ?? 40, VAR = opc.var ?? 20, PERDA = opc.perda ?? 0, DUP = opc.dup ?? 0;
  const RAJADA = opc.rajada ?? null;          // {de, ate} (ms): tudo perdido nessa janela, nos dois sentidos
  let r = ((opc.semente ?? 1) * 2654435761 >>> 0) || 1;
  const sorteio = () => { r ^= r << 13; r >>>= 0; r ^= r >>> 17; r ^= r << 5; r >>>= 0; return r / 4294967296; };
  const filas = [[], []];                      // fila do que chega em cada lado: {t, tipo: 'j'|'c', dado}
  const ultimoCtrl = [0, 0];                   // o controle chega em ordem (nunca antes do anterior)
  let latExtra = 0;                            // degrau de latência (o teste muda no meio)
  const rede = {
    agora: 0,
    enviados: 0, perdidos: 0,
    definirLatencia(ms) { latExtra = ms - LAT; },
    /** De `de` (0|1) para o outro: pacote do jogo (ArrayBuffer). */
    jogo(de, ab) {
      rede.enviados++;
      const para = 1 - de;
      if (RAJADA && rede.agora >= RAJADA.de && rede.agora < RAJADA.ate) { rede.perdidos++; return; }
      if (sorteio() < PERDA) { rede.perdidos++; return; }
      const n = sorteio() < DUP ? 2 : 1;
      for (let i = 0; i < n; i++) filas[para].push({ t: rede.agora + LAT + latExtra + sorteio() * VAR, tipo: 'j', dado: ab.slice(0) });
    },
    /** De `de` para o outro: mensagem de controle (confiável e ordenada). */
    controle(de, obj) {
      const para = 1 - de;
      const t = Math.max(ultimoCtrl[para], rede.agora + LAT + latExtra + sorteio() * VAR);
      ultimoCtrl[para] = t;
      filas[para].push({ t, tipo: 'c', dado: JSON.parse(JSON.stringify(obj)) });
    },
    /** O que chegou em `lado` até agora (em ordem de chegada). */
    entregar(lado) {
      const f = filas[lado], saem = [];
      for (let i = f.length - 1; i >= 0; i--) if (f[i].t <= rede.agora) { saem.push(f[i]); f.splice(i, 1); }
      saem.sort((a, b) => a.t - b.t);
      return saem;
    },
  };
  return rede;
}
