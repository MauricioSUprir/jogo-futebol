/* O avaliador das regras opcionais do Modo Leilão (firebase/regras-leilao-validate.json, o bloco .validate do
   LEIA-ME-leilao.md) para os testes: o testar-leilao.mjs (o bloco KO, em Node) e o testar-leilao-online.mjs (as páginas
   do navegador contra o banco falso) conferem cada gravação com ele, sem recusar nada — o fluxo honesto não pode ser
   recusado pelas regras. Nenhum teste fala com o Firebase de verdade. */
import fs from "node:fs";

// o avaliador das regras opcionais (firebase/regras-leilao-validate.json) com a semântica do .validate: só valores não
// nulos, no nó gravado, nos de dentro e nos de cima; `data`/`root` antes da gravação, `newData` depois, `now` a hora do
// servidor, `auth.uid` a conta de quem grava, os $ do caminho. As expressões das regras são JavaScript válido (com o
// .matches das strings): rodam como funções. Devolve confere(raizAntes, caminho, valor, hora, authUid) → [regras que recusam].
export function avaliadorRegras(arquivo) {
  const regras = JSON.parse(fs.readFileSync(arquivo, "utf8")).rules;
  if (!String.prototype.matches) Object.defineProperty(String.prototype, "matches", { value: function (re) { return re.test(String(this)); }, configurable: true });
  const fns = new Map();
  const fn = (expr, vars) => {
    const k = expr + "|" + vars.join(",");
    if (!fns.has(k)) fns.set(k, new Function("data", "newData", "root", "now", "auth", ...vars, "return (" + expr + ");"));
    return fns.get(k);
  };
  const vazio = v => v == null || (typeof v === "object" && !Object.keys(v).length);
  function limpa(v, hora) {
    if (v && typeof v === "object" && v[".sv"] === "timestamp") return hora;
    if (v == null || typeof v !== "object") return v == null ? null : v;
    const o = {}; let tem = false;
    Object.keys(v).forEach(k => { const x = limpa(v[k], hora); if (!vazio(x)) { o[k] = x; tem = true; } });
    return tem ? o : null;
  }
  const pega = (t, ps) => { let x = t; for (const p of ps) { if (x == null || typeof x !== "object") return null; x = x[p]; } return x == null ? null : x; };
  function poe(t, ps, v) {
    if (!ps.length) return v;
    const o = t && typeof t === "object" ? Object.assign({}, t) : {};
    const x = poe(o[ps[0]], ps.slice(1), v);
    if (vazio(x)) delete o[ps[0]]; else o[ps[0]] = x;
    return Object.keys(o).length ? o : null;
  }
  class Snap {
    constructor(t, ps) { this.t = t; this.ps = ps; }
    child(k) { return new Snap(this.t, this.ps.concat(String(k).split("/").filter(Boolean))); }
    parent() { return new Snap(this.t, this.ps.slice(0, -1)); }
    val() { return pega(this.t, this.ps); }
    exists() { return this.val() != null; }
    hasChildren(ks) { const v = this.val(); if (!v || typeof v !== "object") return false; return ks ? ks.every(k => v[k] != null) : true; }
    isString() { return typeof this.val() === "string"; }
    isNumber() { return typeof this.val() === "number"; }
    isBoolean() { return typeof this.val() === "boolean"; }
  }
  return function confere(antes, ps, valor, hora, uid) {
    // (o poe copia só o caminho: a árvore de antes não muda)
    const depois = poe(antes || null, ps, limpa(JSON.parse(JSON.stringify(valor === undefined ? null : valor)), hora));
    const falhas = [];
    // as regras em cada nó: os de cima do caminho gravado, ele e os de dentro (só onde o valor novo existe)
    function avalia(r, cam, vars) {
      if (!r || !r[".validate"] || pega(depois, cam) == null) return;
      const nomes = Object.keys(vars), f = fn(r[".validate"], nomes);
      let res;
      try { res = f(new Snap(antes, cam), new Snap(depois, cam), new Snap(antes, []), hora, { uid }, ...nomes.map(n => vars[n])); } catch (e) { res = false; }
      if (res !== true) falhas.push(cam.join("/") + " (" + r[".validate"].slice(0, 60) + "…)");
    }
    function filhoRegra(r, k) {
      if (!r) return [null, null];
      if (r[k]) return [r[k], null];
      const w = Object.keys(r).find(x => x[0] === "$");
      return w ? [r[w], w] : [null, null];
    }
    let r = regras, vars = {};
    avalia(r, [], vars);
    for (let i = 0; i < ps.length && r; i++) {
      const [rf, w] = filhoRegra(r, ps[i]);
      r = rf; if (w) vars = Object.assign({}, vars, { [w]: ps[i] });
      avalia(r, ps.slice(0, i + 1), vars);
    }
    (function desce(r0, cam, vs) {
      const v = pega(depois, cam);
      if (!r0 || v == null || typeof v !== "object") return;
      Object.keys(v).forEach(k => {
        const [rf, w] = filhoRegra(r0, k);
        if (!rf) return;
        const vs2 = w ? Object.assign({}, vs, { [w]: k }) : vs;
        avalia(rf, cam.concat(k), vs2);
        desce(rf, cam.concat(k), vs2);
      });
    })(r, ps, vars);
    return falhas;
  };
}
