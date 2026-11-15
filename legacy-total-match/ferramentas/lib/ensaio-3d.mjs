/* A PÁGINA DE ENSAIO do 3D: no lugar do GOLAÇO (TM.tm3d.PASTA = "golaco/ensaio-3d.html"), servida pela rota do Playwright
   (debaixo de golaco/, que o service worker do TM deixa ir pela rede — fora dela o sw.js buscava a página sem passar pela rota).
   Usada pelo testar-3d.mjs (um caso por modo do TM), pelo testar-leilao.mjs --tela e pelo testar-leilao-online.mjs (o jogo do
   Modo Leilão contra um bot). Ela grava em localStorage["ensaio3d:ultimo"] o que o pedido trouxe e responde como o golaco, pelo
   modo em localStorage["ensaio3d:modo"]:
     simular     'tm3d:pronto' e, 250 ms depois, 'tm3d:sair' { motivo: 'simular' } (o "Simular partida" da tela, sem os titulares)
     simularTit  o mesmo, com os titulares da tela ({ home, away }: os 11 primeiros tmIds de cada lado do pedido)
     erro        'tm3d:pronto' e 'tm3d:sair' { motivo: 'erro' } (a falha do 3D)
     parado      não responde (o 3D que nem chegou a abrir: o X "Voltar e simular" do TM fica à vista)
     aberto      só 'tm3d:pronto' (o 3D aberto que nunca acaba: a página do TM fecha ou recarrega no meio)
     sair        'tm3d:pronto' e, 250 ms depois, 'tm3d:sair' sem motivo (o 3D aberto e fechado sem resultado)
     fim         'tm3d:pronto' e, 250 ms depois, 'tm3d:fim' com o resultado montado do pedido: o placar de
                 localStorage["ensaio3d:placar"] ("2-1" se não houver; "casa-fora"), os gols da casa pelos jogadores 11, 10, …
                 do pedido (o tmId), os de fora pelos 11, 10, … do outro lado (o 1º de pênalti), um amarelo para o 6º de fora e as
                 estatísticas. O mesmo resultado fica em localStorage["ensaio3d:resultado"] (o teste confere contra o gravado) */
export const ROTA_ENSAIO_3D = /\/golaco\/ensaio-3d\.html(\?|$)/;
export const PASTA_ENSAIO_3D = "golaco/ensaio-3d.html";

export const ENSAIO_3D = `<!doctype html><meta charset="utf-8"><title>ensaio</title><script>
(function () {
  var id = new URLSearchParams(location.search).get("tm"), modo = localStorage.getItem("ensaio3d:modo") || "simular", ped = null;
  try { ped = JSON.parse(localStorage.getItem("tm3d:pedido:" + id)); } catch (e) {}
  var pa = ped && ped.partida;
  localStorage.setItem("ensaio3d:ultimo", JSON.stringify({ id: id, url: location.search, titulo: ped && ped.titulo, casa: ped && ped.home && ped.home.name,
    fora: ped && ped.away && ped.away.name, nCasa: ped && ped.home ? ped.home.players.length : 0, nFora: ped && ped.away ? ped.away.players.length : 0,
    userSide: ped && ped.userSide, controle: ped && ped.controle, modo: modo,
    partida: pa ? { minutosPorTempo: pa.minutosPorTempo, dificuldade: pa.dificuldade, ajustesFixos: !!pa.ajustesFixos, neutro: pa.neutro, empateContinua: pa.empateContinua } : null,
    escudos: ped ? [ped.home, ped.away].map(function (t) { var i = t && t.identidade; return i ? { tipo: i.escudoTipo || null, svg: String(i.escudo || "").indexOf("data:image/svg") === 0 } : null; }) : null }));
  if (modo === "parado") return;
  parent.postMessage({ tipo: "tm3d:pronto", id: id }, location.origin);
  if (modo === "aberto") return;
  function ps(lado) { var t = ped && (lado ? ped.away : ped.home); return t && t.players ? t.players : []; }
  function resultado() {
    var pl = String(localStorage.getItem("ensaio3d:placar") || "2-1").split("-").map(Number), gols = [], i;
    for (i = 0; i < pl[0]; i++) { var a = ps(0)[10 - i] || {}; gols.push({ lado: 0, tmId: a.tmId, nome: a.name, minuto: 12 + i * 31 }); }
    for (i = 0; i < pl[1]; i++) { var b = ps(1)[10 - i] || {}; gols.push({ lado: 1, tmId: b.tmId, nome: b.name, minuto: 27 + i * 23, penalti: i === 0 }); }
    var c = ps(1)[5] || {};
    return { homeGoals: pl[0], awayGoals: pl[1], gols: gols, cartoes: [{ lado: 1, tmId: c.tmId, nome: c.name, minuto: 55, cor: "yellow" }],
      stats: { possession: [54, 46], shots: [pl[0] + 6, pl[1] + 4], onTarget: [pl[0] + 2, pl[1] + 1] } };
  }
  setTimeout(function () {
    if (modo === "fim") {
      var r = resultado();
      localStorage.setItem("ensaio3d:resultado", JSON.stringify(r));
      parent.postMessage({ tipo: "tm3d:fim", id: id, resultado: r }, location.origin);
    } else if (modo === "sair") parent.postMessage({ tipo: "tm3d:sair", id: id }, location.origin);
    else {
      var m = { tipo: "tm3d:sair", id: id, motivo: modo === "erro" ? "erro" : "simular" };
      if (modo === "simularTit") m.titulares = { home: ps(0).slice(0, 11).map(function (x) { return x.tmId; }), away: ps(1).slice(0, 11).map(function (x) { return x.tmId; }) };
      parent.postMessage(m, location.origin);
    }
  }, 250);
})();
</script>`;

// a rota no contexto do Playwright (todas as páginas e quadros dele)
export function servirEnsaio3d(cx) {
  return cx.route(ROTA_ENSAIO_3D, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: ENSAIO_3D }));
}
