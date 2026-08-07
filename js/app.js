/* ================= TOTAL MATCH — navegação entre telas ================= */
(function () {
  "use strict";

  /** Mostra a tela com o id informado e esconde as demais. */
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (s) {
      s.classList.toggle("is-active", s.id === id);
    });
  }

  // Textos dos placeholders por modo (serão substituídos por telas reais depois)
  var MODE_INFO = {
    quick:    { title: "⚡ Partida Rápida",        text: "Aqui vamos montar a simulação de uma partida avulsa." },
    coach:    { title: "🎯 Carreira de Treinador", text: "Escolha de ligas, clubes e seleções, e o comando do elenco entram aqui." },
    player:   { title: "⭐ Carreira de Jogador",   text: "Criação do seu jogador (foto, país, físico, clube) virá nesta etapa." },
    settings: { title: "⚙️ Configurações",         text: "Dificuldade, realismo, tempo de jogo e outros ajustes ficarão aqui." }
  };

  document.addEventListener("DOMContentLoaded", function () {
    // Splash -> Modos
    document.getElementById("btn-start").addEventListener("click", function () {
      showScreen("screen-modes");
    });

    // Cartões de modo -> placeholder (por enquanto)
    document.querySelectorAll(".mode-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var info = MODE_INFO[card.dataset.mode];
        if (info) {
          document.getElementById("placeholder-title").textContent = info.title;
          document.getElementById("placeholder-text").textContent = info.text;
        }
        showScreen("screen-placeholder");
      });
    });

    // Botões de voltar
    document.querySelectorAll(".btn-back").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showScreen(btn.dataset.target);
      });
    });
  });
})();
