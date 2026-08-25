/* ================= TOTAL MATCH — Configurações ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  TM.ui.register("settings", function (screen) {
    var s = TM.storage.settings();

    function segmented(label, key, options) {
      var wrap = el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: label }) ]);
      var seg = el("div", { class: "segmented" });
      options.forEach(function (opt) {
        var b = el("button", {
          class: "seg-btn" + (s[key] === opt.value ? " active" : ""),
          text: opt.label,
          on: { click: function () {
            s[key] = opt.value;
            seg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
          } }
        });
        seg.appendChild(b);
      });
      wrap.appendChild(seg);
      return wrap;
    }

    function slider(label, key, min, max, hints) {
      var val = el("span", { class: "slider-val", text: hints[s[key] - min] || s[key] });
      var input = el("input", { type: "range", min: min, max: max, step: 1, value: s[key], class: "slider" });
      input.addEventListener("input", function () {
        s[key] = parseInt(input.value, 10);
        val.textContent = hints[s[key] - min] || s[key];
      });
      return el("div", { class: "setting" }, [
        el("div", { class: "setting-label" }, [ document.createTextNode(label), val ]),
        input
      ]);
    }

    function toggle(label, key) {
      var t = el("button", { class: "switch" + (s[key] ? " on" : ""), on: { click: function () {
        s[key] = !s[key]; t.classList.toggle("on", s[key]);
      } } }, [ el("span", { class: "switch-knob" }) ]);
      return el("div", { class: "setting row" }, [ el("div", { class: "setting-label", text: label }), t ]);
    }

    screen.appendChild(TM.ui.topbar("⚙️ Configurações", function () { TM.ui.go("modes"); }));

    // tema com pré-visualização ao vivo
    function themeControl() {
      var wrap = el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Tema" }) ]);
      var seg = el("div", { class: "segmented" });
      [{ label: "🌙 Escuro", value: "dark" }, { label: "☀️ Claro", value: "light" }].forEach(function (opt) {
        var b = el("button", { class: "seg-btn" + (s.theme === opt.value ? " active" : ""), text: opt.label, on: { click: function () {
          s.theme = opt.value;
          seg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active");
          TM.ui.applyTheme(s.theme); // aplica na hora
          var cur = TM.storage.settings(); cur.theme = s.theme; TM.storage.saveSettings(cur); // persiste só o tema
        } } });
        seg.appendChild(b);
      });
      wrap.appendChild(seg);
      wrap.appendChild(el("div", { class: "setting-hint", text: "Escuro = preto e verde · Claro = branco e verde." }));
      return wrap;
    }

    var panel = el("div", { class: "panel-narrow" }, [
      themeControl(),
      segmented("Dificuldade", "difficulty", [
        { label: "Fácil", value: "facil" }, { label: "Normal", value: "normal" },
        { label: "Difícil", value: "dificil" }, { label: "Lenda", value: "lenda" }
      ]),
      slider("Realismo", "realism", 1, 5, ["Arcade", "Casual", "Equilibrado", "Realista", "Simulação"]),
      segmented("Tempo de jogo (velocidade)", "matchSpeed", [
        { label: "Instantâneo", value: "instantaneo" }, { label: "Rápido", value: "rapido" }, { label: "Normal", value: "normal" }, { label: "Lento", value: "lento" }
      ]),
      segmented("Evolução dos atletas", "evoRate", [
        { label: "Demorada", value: "demorada" }, { label: "Média", value: "media" }, { label: "Rápida", value: "rapida" }
      ]),
      el("div", { class: "setting-hint", text:
        "Ritmo em que os jogadores evoluem rumo ao potencial a cada temporada. " +
        "Rápida faz jovens amadurecerem antes; demorada exige mais paciência. (Nenhuma é exagerada.)" }),
      toggle("Narração dos lances", "commentary"),
      toggle("Overall dinâmico (confiança/desempenho)", "dynamicOverall"),
      el("div", { class: "setting-hint", text:
        "Overall dinâmico: nas carreiras e competições, o overall dos jogadores sobe e desce " +
        "conforme a confiança e o desempenho na temporada (▲/▼). Alguns jogadores são constantes (=)." }),
      toggle("Rivalidade (clássicos e mercado)", "rivalry"),
      el("div", { class: "setting-hint", text:
        "Rivalidade: partidas entre rivais viram CLÁSSICO (com clima especial na tela pré-jogo e nas " +
        "entrevistas). No mercado, jogadores dificilmente se transferem direto entre rivais." }),
      el("div", { class: "setting-hint", text:
        "Realismo baixo deixa o jogo mais imprevisível (mais gols e zebras). " +
        "Realismo alto faz os melhores times vencerem com mais frequência." })
    ]);
    screen.appendChild(panel);

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("Restaurar padrão", function () {
        TM.storage.saveSettings(TM.storage.defaultSettings());
        TM.ui.applyTheme("dark");
        TM.ui.toast("Configurações restauradas");
        TM.ui.go("settings");
      }, "btn ghost"),
      TM.ui.button("Salvar", function () {
        TM.storage.saveSettings(s);
        TM.ui.applyTheme(s.theme);
        TM.ui.toast("✔ Configurações salvas");
      }, "btn primary")
    ]));
  });
})(window);
