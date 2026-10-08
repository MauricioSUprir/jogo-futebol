/* ================= TOTAL MATCH — cenas =================
   Imagens com a cara do jogo, recortadas das capas dos modos (artes do dono)
   por ferramentas/gerar-cenas.py:
   - faixas largas (b-*.jpg) para o topo das telas principais;
   - mini cenas (m-*.jpg) para os atalhos do menu ("Mais modos").
   Onde não há cena, o atalho fica com o ícone num fundo no mesmo estilo. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var DIR = "assets/cenas/";

  // topo das telas: rota -> [faixa, sobretítulo]
  var TOPO = {
    "coach-squad": ["camisa", "Carreira"], "coach-lineup": ["quadro", "Carreira"],
    "coach-youth": ["tunel", "Carreira"], "coach-market": ["mesa", "Carreira"],
    "coach-scouting": ["escritorio", "Carreira"], "coach-comps": ["trofeu", "Carreira"],
    "coach-world": ["mapa", "Carreira"], "coach-finance": ["moedas", "Carreira"],
    "coach-contract": ["escritorio", "Carreira"], "coach-calendar": ["estadio", "Carreira"],
    "coach-transfers": ["mesa", "Carreira"], "coach-offers": ["escritorio", "Carreira"],
    "coach-honours": ["trofeu", "Carreira"], "coach-totw": ["estadio", "Carreira"],
    "coach-shortlist": ["cartas", "Carreira"], "club-ct": ["tunel", "Clube"],
    "club-sponsors": ["mesa", "Clube"],
    "quick": ["bola", "Jogar"], "compmode": ["trofeu", "Jogar"], "compmode-list": ["trofeu", "Jogar"],
    "online": ["gamer", "Online"], "copa": ["chave", "Online"], "groupcomp": ["estadio", "Online"],
    "dream": ["cartas", "Modo"], "draft": ["cartas", "Modo"], "arena": ["moedas", "Total Coins"],
    "coins": ["moedas", "Total Coins"], "saves": ["tunel", "Modo"], "competicoes": ["trofeu", "Informações"],
    "editor": ["mesa", "Modo"], "rae": ["tunel", "Carreira"], "ut-store": ["moedas", "Total Ultimate"],
    "rae-mercado": ["escritorio", "Rumo ao Estrelato"], "rae-trajetoria": ["tunel", "Rumo ao Estrelato"]
  };

  // mini cenas do menu ("Mais modos"): rota -> recorte. Os atalhos da carreira ficam
  // com ícone + nome: o dono preferiu assim.
  var MINI = {
    "dream": "cartas", "draft": "cartas-lado", "arena": "moedas", "groupcomp": "gamer", "editor": "mesa",
    "saves": "tunel", "competicoes": "trofeu"
  };

  function topo(rota) {
    var t = TOPO[rota];
    return t ? { img: DIR + "b-" + t[0] + ".jpg", sobre: t[1] } : null;
  }
  function mini(rota) {
    var m = MINI[rota];
    return m ? DIR + "m-" + m + ".jpg" : null;
  }

  TM.cenas = { topo: topo, mini: mini };
})(window);
