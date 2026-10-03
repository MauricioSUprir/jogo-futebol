// Painel de desempenho (abrir o jogo com ?perf no link, ou F3 durante a partida).
// Mostra o que importa para achar gargalo numa placa de verdade:
//  - FPS médio e o "1% pior" (engasgos), tempo de CPU do quadro (simulação + montagem);
//  - tempo de GPU do quadro medido pela própria placa (EXT_disjoint_timer_query_webgl2,
//    disponível no Chrome/Edge de PC; no celular costuma não existir e aparece "—");
//  - draw calls e triângulos do quadro inteiro (sombra + cena + pós), resolução real
//    do desenho, qualidade e escala dinâmica, nome da GPU.
// Se a GPU passa de ~16 ms o gargalo é a placa (triângulos/pixels/pós); se a CPU passa,
// é o JavaScript (simulação, animação, montagem dos quadros).

export class PerfHud {
  constructor(renderer) {
    this.r = renderer;
    this.gl = renderer.getContext();
    this.on = /[?&]perf\b/.test(location.search);
    this.last = 0;
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.queries = [];          // consultas de tempo de GPU em voo
    this.active = null;
    this.gpu = []; this.cpu = []; this.dts = []; this.calls = 0; this.tris = 0; this.n = 0; this.t = 0;
    let name = '';
    try {
      const dbg = this.gl.getExtension('WEBGL_debug_renderer_info');
      name = dbg ? this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : this.gl.getParameter(this.gl.RENDERER);
    } catch { /* navegador sem a extensão */ }
    this.gpuName = String(name).replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 70);
    this.el = document.createElement('div');
    this.el.id = 'perf-hud';
    this.el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;pointer-events:none;font:12px/1.35 ui-monospace,Consolas,monospace;'
      + 'color:#c8ffd8;background:rgba(0,0,0,.72);border:1px solid #1f8f4a;border-radius:6px;padding:6px 8px;white-space:pre;display:none';
    document.body.appendChild(this.el);
    addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); this.on = !this.on; this.last = 0; this.el.style.display = this.on ? 'block' : 'none'; } });
  }

  begin() {
    if (!this.on) return;
    this.t0 = performance.now();
    if (this.ext && !this.active && this.queries.length < 4) {
      this.active = this.gl.createQuery();
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active);
    }
  }

  // info: { dt, preset, dyn }
  end(info) {
    if (!this.on) return;
    const gl = this.gl;
    this.cpu.push(performance.now() - this.t0);
    // intervalo real entre quadros (o dt do jogo é limitado a 0,25 s)
    const now = performance.now(), dt = this.last ? (now - this.last) / 1000 : info.dt;
    this.last = now;
    this.dts.push(dt);
    this.calls += this.r.info.render.calls; this.tris += this.r.info.render.triangles; this.n++;
    if (this.active) { gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.queries.push(this.active); this.active = null; }
    // resultados chegam alguns quadros depois
    while (this.queries.length) {
      const q = this.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
      if (!disjoint) this.gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q); this.queries.shift();
    }
    this.t += dt;
    if (this.t < 0.5) return;
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    const worst = [...this.dts].sort((a, b) => b - a);
    const low1 = worst[Math.floor(worst.length * 0.01)] || worst[0];
    const c = this.r.domElement, f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
    this.el.style.display = 'block';
    this.el.textContent =
      `FPS ${f(this.n / this.t, 0)}   1% pior ${f(1 / low1, 0)}\n`
      + `CPU ${f(avg(this.cpu))} ms   GPU ${this.ext ? f(avg(this.gpu)) + ' ms' : '— (sem medidor)'}\n`
      + `draw calls ${Math.round(this.calls / this.n)}   triângulos ${(this.tris / this.n / 1e6).toFixed(2)} M\n`
      + `${c.width}x${c.height}  qualidade ${info.preset}  escala ${f(info.dyn, 2)}\n`
      + this.gpuName;
    this.gpu.length = 0; this.cpu.length = 0; this.dts.length = 0; this.calls = this.tris = this.n = 0; this.t = 0;
  }
}
