/* ================= TOTAL MATCH — Editor (editar/criar/transferir) ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  function edits() { return TM.storage.read("edits", { players: {}, moves: {}, created: [] }) || { players: {}, moves: {}, created: [] }; }
  function saveEdits(e) { TM.storage.write("edits", e); TM.data.resetWorld(); }
  var POS = [["GK", "Goleiro"], ["DF", "Defensor"], ["MF", "Meio"], ["FW", "Atacante"]];

  function clubOptions() {
    return TM.data.world().clubs.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (c) { return [c.id, c.name]; });
  }

  TM.ui.register("editor", function (screen) {
    screen.appendChild(TM.ui.topbar("✏️ Editor", function () { TM.ui.go("modes"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    body.appendChild(el("p", { class: "intro-text", text: "Edite jogadores (nome, posição, overall), faça transferências entre clubes ou crie novos jogadores. As mudanças valem em todo o jogo." }));
    body.appendChild(el("div", { class: "editor-actions" }, [
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("editor-find"); } } }, [ el("span", { class: "hub-ic", text: "🔍" }), el("span", { text: "Editar / Transferir jogador" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("editor-create"); } } }, [ el("span", { class: "hub-ic", text: "➕" }), el("span", { text: "Criar jogador" }) ]),
      el("button", { class: "hub-btn", on: { click: function () { TM.ui.go("editor-club"); } } }, [ el("span", { class: "hub-ic", text: "🛡️" }), el("span", { text: "Escudo do clube" }) ]),
      el("button", { class: "hub-btn", on: { click: function () {
        TM.ui.confirm("Desfazer todas as edições?", "Volta o jogo ao estado original (jogadores, transferências e criados do Editor).", "Desfazer", function () {
          TM.storage.remove("edits"); TM.data.resetWorld(); TM.ui.toast("Edições desfeitas"); TM.ui.go("editor");
        }, true);
      } } }, [ el("span", { class: "hub-ic", text: "↩️" }), el("span", { text: "Desfazer edições" }) ])
    ]));
  });

  TM.ui.register("editor-find", function (screen) {
    screen.appendChild(TM.ui.topbar("🔍 Escolha o jogador", function () { TM.ui.go("editor"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var input = el("input", { class: "text-input", type: "text", placeholder: "Buscar jogador pelo nome…" });
    body.appendChild(input);
    var list = el("div", { class: "editor-list" });
    body.appendChild(list);
    function render(q) {
      TM.ui.clear(list);
      if (!q || q.length < 2) { list.appendChild(el("p", { class: "intro-text", text: "Digite ao menos 2 letras." })); return; }
      var W = TM.data.world(), out = [], ql = q.toLowerCase();
      for (var id in W.playersById) { var p = W.playersById[id]; if (p.name && p.name.toLowerCase().indexOf(ql) >= 0) { out.push(p); if (out.length >= 40) break; } }
      out.sort(function (a, b) { return b.overall - a.overall; });
      out.forEach(function (p) {
        var club = TM.data.club(p.clubId);
        var row = el("button", { class: "editor-row", on: { click: function () { TM.ui.go("editor-player", { id: p.id }); } } }, [
          TM.img.playerImg(p, "er-face"),
          el("div", { class: "er-info" }, [ el("div", { class: "er-name", text: p.name }), el("div", { class: "er-sub", text: TM.data.posLabel(p) + " · " + p.overall + " · " + (club ? club.name : "Sem clube") }) ]),
          el("span", { class: "er-go", text: "›" })
        ]);
        list.appendChild(row);
      });
      if (!out.length) list.appendChild(el("p", { class: "intro-text", text: "Nenhum jogador encontrado." }));
    }
    var t = null;
    input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { render(input.value.trim()); }, 180); });
    input.focus();
  });

  /* ---------- escudo do clube (enviar imagem do aparelho) ---------- */
  TM.ui.register("editor-club", function (screen) {
    screen.appendChild(TM.ui.topbar("🛡️ Escolha o clube", function () { TM.ui.go("editor"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var input = el("input", { class: "text-input", type: "text", placeholder: "Buscar clube pelo nome…" });
    body.appendChild(input);
    var list = el("div", { class: "editor-list" });
    body.appendChild(list);
    function render(q) {
      TM.ui.clear(list);
      var W = TM.data.world(), ql = (q || "").toLowerCase();
      var out = W.clubs.filter(function (c) { return !ql || c.name.toLowerCase().indexOf(ql) >= 0; }).slice(0, 40);
      out.forEach(function (c) {
        list.appendChild(el("button", { class: "editor-row", on: { click: function () { TM.ui.go("editor-crest", { id: c.id }); } } }, [
          TM.img.clubImg(c, "er-face"),
          el("div", { class: "er-info" }, [ el("div", { class: "er-name", text: c.name }), el("div", { class: "er-sub", text: (TM.data.league(c.leagueId) ? TM.data.league(c.leagueId).name : c.leagueId) + (c.crestData ? " · escudo personalizado" : "") }) ]),
          el("span", { class: "er-go", text: "›" })
        ]));
      });
      if (!out.length) list.appendChild(el("p", { class: "intro-text", text: "Nenhum clube encontrado." }));
    }
    var t = null;
    input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { render(input.value.trim()); }, 180); });
    render("");
  });
  TM.ui.register("editor-crest", function (screen, params) {
    var c = params && params.id ? TM.data.club(params.id) : null;
    if (!c) { TM.ui.go("editor-club"); return; }
    screen.appendChild(TM.ui.topbar("🛡️ " + c.name, function () { TM.ui.go("editor-club"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var e = edits(); e.clubs = e.clubs || {};
    var saved = e.clubs[c.id] || {};
    var draft = { crestData: saved.crestData || c.crestData || null, colors: { primary: (saved.colors && saved.colors.primary) || c.colors.primary, secondary: (saved.colors && saved.colors.secondary) || c.colors.secondary } };
    var preview = el("div", { class: "crest-preview" }, [ draft.crestData ? el("img", { src: draft.crestData, class: "crest-big" }) : TM.img.clubImg(c, "crest-big") ]);
    body.appendChild(preview);
    body.appendChild(el("p", { class: "intro-text", text: "Envie uma imagem do aparelho (PNG com fundo transparente fica melhor). O escudo vale em todo o jogo: menus, partidas, carreira e online." }));
    var fileIn = el("input", { type: "file", accept: "image/*", style: "display:none" });
    fileIn.addEventListener("change", function () {
      var f = fileIn.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (ev) { var img = new Image(); img.onload = function () {
        var cv = document.createElement("canvas"), sc = Math.min(1, 256 / Math.max(img.width, img.height));
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        draft.crestData = cv.toDataURL("image/png");
        TM.ui.clear(preview); preview.appendChild(el("img", { src: draft.crestData, class: "crest-big" }));
        TM.ui.toast("Escudo carregado — toque em Salvar");
      }; img.src = ev.target.result; };
      r.readAsDataURL(f);
    });
    body.appendChild(fileIn);
    // cores do clube (uniforme / identidade visual)
    var cPrim = el("input", { type: "color", class: "cc-color", value: draft.colors.primary });
    var cSec = el("input", { type: "color", class: "cc-color", value: draft.colors.secondary });
    var swatch = el("div", { class: "color-swatch", style: "background:linear-gradient(90deg," + draft.colors.primary + " 50%," + draft.colors.secondary + " 50%)" });
    function upd() { swatch.style.background = "linear-gradient(90deg," + draft.colors.primary + " 50%," + draft.colors.secondary + " 50%)"; }
    cPrim.addEventListener("input", function () { draft.colors.primary = cPrim.value; upd(); });
    cSec.addEventListener("input", function () { draft.colors.secondary = cSec.value; upd(); });
    body.appendChild(el("div", { class: "list-head", text: "Cores do clube" }));
    body.appendChild(el("div", { class: "color-row" }, [ el("label", { class: "color-lbl" }, [ el("span", { text: "Principal" }), cPrim ]), el("label", { class: "color-lbl" }, [ el("span", { text: "Secundária" }), cSec ]), swatch ]));
    body.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("📁 Enviar imagem do escudo", function () { fileIn.click(); }, "btn"),
      TM.ui.button("💾 Salvar", function () {
        var ed = edits(); ed.clubs = ed.clubs || {}; ed.clubs[c.id] = { crestData: draft.crestData || null, colors: { primary: draft.colors.primary, secondary: draft.colors.secondary } };
        saveEdits(ed); TM.ui.toast(c.name + " atualizado!"); TM.ui.go("editor-club");
      }, "btn primary big"),
      (e.clubs[c.id]) ? TM.ui.button("↩️ Voltar ao original (escudo e cores)", function () {
        var ed = edits(); if (ed.clubs) delete ed.clubs[c.id]; saveEdits(ed); TM.ui.toast("Escudo original restaurado"); TM.ui.go("editor-club");
      }, "btn ghost") : null
    ]));
  });

  TM.ui.register("editor-player", function (screen, params) {
    var p = TM.data.player(params.id);
    if (!p) { TM.ui.go("editor-find"); return; }
    screen.appendChild(TM.ui.topbar("✏️ " + p.name, function () { TM.ui.go("editor-find"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var draft = { name: p.name, pos: p.pos, overall: p.overall, age: p.age, clubId: p.clubId, photo: p.photo || null };

    // cabeçalho com a foto (clicável para trocar) + upload
    var faceImg = TM.img.playerImg(p, "eh-face");
    var fileIn = el("input", { type: "file", accept: "image/*", style: "display:none" });
    var head = el("div", { class: "editor-head" }, [
      el("div", { class: "eh-face-wrap", style: "cursor:pointer;position:relative", on: { click: function () { fileIn.click(); } } }, [ faceImg, el("span", { class: "eh-face-edit", text: "📷" }) ]),
      fileIn,
      el("div", {}, [ el("div", { class: "eh-name", text: p.name }), el("div", { class: "eh-sub", text: (TM.data.club(p.clubId) ? TM.data.club(p.clubId).name : "Sem clube") + " · " + (p.nationName || "") }), el("button", { class: "btn ghost small", style: "margin-top:6px", text: "📷 Trocar foto", on: { click: function () { fileIn.click(); } } }) ])
    ]);
    fileIn.addEventListener("change", function () {
      var f = fileIn.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (ev) { var img = new Image(); img.onload = function () {
        var cv = document.createElement("canvas"), sc = Math.min(1, 256 / Math.max(img.width, img.height));
        cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        draft.photo = cv.toDataURL("image/jpeg", 0.82);
        var nf = el("img", { src: draft.photo, class: "eh-face" }); faceImg.parentNode.replaceChild(nf, faceImg); faceImg = nf;
        TM.ui.toast("Foto carregada — salve para aplicar");
      }; img.src = ev.target.result; };
      r.readAsDataURL(f);
    });
    body.appendChild(head);
    var nameIn = el("input", { class: "text-input", type: "text", maxlength: "26", value: draft.name });
    nameIn.addEventListener("input", function () { draft.name = nameIn.value; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Nome" }), nameIn ]));

    body.appendChild(TM.ui.dropdown("Posição", POS, draft.pos, function (v) { draft.pos = v; }));

    var ovVal = el("span", { class: "range-val", text: draft.overall });
    var ovSlider = el("input", { type: "range", min: 40, max: 99, step: 1, value: draft.overall, class: "slider" });
    ovSlider.addEventListener("input", function () { draft.overall = parseInt(ovSlider.value, 10); ovVal.textContent = draft.overall; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Overall "), ovVal ]), ovSlider ]));

    var ageVal = el("span", { class: "range-val", text: draft.age });
    var ageSlider = el("input", { type: "range", min: 15, max: 42, step: 1, value: draft.age, class: "slider" });
    ageSlider.addEventListener("input", function () { draft.age = parseInt(ageSlider.value, 10); ageVal.textContent = draft.age; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Idade "), ageVal ]), ageSlider ]));

    body.appendChild(TM.ui.dropdown("Clube (transferência)", clubOptions(), draft.clubId, function (v) { draft.clubId = v; }));

    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("💾 Salvar", function () {
        var e = edits();
        e.players[p.id] = { name: draft.name, pos: draft.pos, overall: draft.overall, age: draft.age };
        if (draft.photo) e.players[p.id].photo = draft.photo;
        if (draft.clubId && draft.clubId !== p.clubId) e.moves[p.id] = draft.clubId; else if (e.moves[p.id]) delete e.moves[p.id];
        saveEdits(e);
        TM.ui.toast("✔ Jogador salvo");
        TM.ui.go("editor-find");
      }, "btn primary big")
    ]));
  });

  TM.ui.register("editor-create", function (screen) {
    screen.appendChild(TM.ui.topbar("➕ Criar jogador", function () { TM.ui.go("editor"); }));
    var body = el("div", { class: "panel-narrow" });
    screen.appendChild(body);
    var draft = { name: "", pos: "MF", overall: 72, age: 20, clubId: clubOptions()[0][0] };
    var nameIn = el("input", { class: "text-input", type: "text", maxlength: "26", placeholder: "Nome do jogador" });
    nameIn.addEventListener("input", function () { draft.name = nameIn.value; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label", text: "Nome" }), nameIn ]));
    body.appendChild(TM.ui.dropdown("Posição", POS, draft.pos, function (v) { draft.pos = v; }));
    var ovVal = el("span", { class: "range-val", text: draft.overall });
    var ovSlider = el("input", { type: "range", min: 40, max: 99, step: 1, value: draft.overall, class: "slider" });
    ovSlider.addEventListener("input", function () { draft.overall = parseInt(ovSlider.value, 10); ovVal.textContent = draft.overall; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Overall "), ovVal ]), ovSlider ]));
    var ageVal = el("span", { class: "range-val", text: draft.age });
    var ageSlider = el("input", { type: "range", min: 15, max: 42, step: 1, value: draft.age, class: "slider" });
    ageSlider.addEventListener("input", function () { draft.age = parseInt(ageSlider.value, 10); ageVal.textContent = draft.age; });
    body.appendChild(el("div", { class: "setting" }, [ el("div", { class: "setting-label" }, [ document.createTextNode("Idade "), ageVal ]), ageSlider ]));
    body.appendChild(TM.ui.dropdown("Clube", clubOptions(), draft.clubId, function (v) { draft.clubId = v; }));
    screen.appendChild(el("div", { class: "actions" }, [
      TM.ui.button("➕ Criar", function () {
        if (!draft.name.trim()) { TM.ui.toast("Dê um nome ao jogador"); return; }
        var e = edits();
        e.created = e.created || [];
        e.created.push({ id: "ed" + Date.now(), name: draft.name.trim(), pos: draft.pos, overall: draft.overall, age: draft.age, clubId: draft.clubId });
        saveEdits(e);
        TM.ui.toast("✔ Jogador criado no " + TM.data.club(draft.clubId).name);
        TM.ui.go("editor");
      }, "btn primary big")
    ]));
  });
})(window);
