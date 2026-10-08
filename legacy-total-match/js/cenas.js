/* ================= TOTAL MATCH — cenas =================
   Imagens com a cara do jogo, recortadas das capas dos modos (artes do dono)
   por ferramentas/gerar-cenas.py:
   - faixas largas (b-*.jpg) para o topo das telas principais;
   - mini cenas (m-*.jpg) para os atalhos (menu, início da carreira, "todas as
     seções").
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
    "editor": ["mesa", "Modo"], "rae": ["tunel", "Carreira"], "ut-store": ["moedas", "Total Ultimate"]
  };

  // mini cenas: rota (ou nome do atalho) -> recorte
  var MINI = {
    // carreira
    "coach-hub": "cadeira", "coach-squad": "camisa10", "coach-lineup": "quadro", "coach-youth": "valores",
    "coach-market": "cartas-lado", "coach-scouting": "janela", "coach-comps": "divisoes", "coach-world": "globo",
    "coach-finance": "moedas", "coach-contract": "mesa", "coach-shortlist": "retratos",
    "coach-honours": "trofeu", "coach-totw": "bola", "club-stadium": "arquibancada", "club-ct": "gol",
    "coach-messenger": "ping", "coach-social": "mapa", "coach-news": "tv", "coach-transfers": "livros",
    "coach-offers": "documentos", "coach-calendar": "refletores", "club-sponsors": "placas", "motivar": "tunel",
    // menu inicial
    "dream": "cartas", "draft": "cartas-lado", "arena": "moedas", "groupcomp": "gamer", "editor": "mesa",
    "saves": "tunel", "competicoes": "trofeu", "copa": "chave", "quick": "bola", "online": "gamer"
  };
  // atalhos do início da carreira, pelo nome escrito no botão
  var ROTULO = {
    "Elenco": "coach-squad", "Escalação": "coach-lineup", "Base": "coach-youth", "Competições": "coach-comps",
    "Mundo": "coach-world", "Mercado": "coach-market", "Olheiros": "coach-scouting", "Central": "coach-shortlist",
    "Finanças": "coach-finance", "Estádio": "club-stadium", "CT": "club-ct", "Meu contrato": "coach-contract",
    "Títulos": "coach-honours", "Seleção da Semana": "coach-totw", "Mensagens": "coach-messenger",
    "Patrocínios": "club-sponsors", "Motivar": "motivar", "Movimentações": "coach-transfers",
    "Calendário": "coach-calendar", "Notícias": "coach-news", "Redes Sociais": "coach-social"
  };

  function topo(rota) {
    var t = TOPO[rota];
    return t ? { img: DIR + "b-" + t[0] + ".jpg", sobre: t[1] } : null;
  }
  function mini(chave) {
    var m = MINI[chave] || MINI[ROTULO[chave]];
    return m ? DIR + "m-" + m + ".jpg" : null;
  }
  function miniPorRotulo(rotulo) {
    var base = String(rotulo || "").replace(/\s*\(.*$/, "").trim();   // "Mensagens (2)" -> "Mensagens"
    return ROTULO[base] ? mini(ROTULO[base]) : null;
  }

  TM.cenas = { topo: topo, mini: mini, miniPorRotulo: miniPorRotulo };
})(window);
