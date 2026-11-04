/* ===== testes/capacidade-gemini.mjs — quanto o Gemini grátis aguenta? =====
   Roda o código DE VERDADE da escada de modelos (src/ia.js) contra um Gemini
   de mentira que aplica os limites do plano grátis (por minuto e por dia, por
   projeto) com um relógio simulado: um dia inteiro de uso em poucos segundos.

   Uso: node testes/capacidade-gemini.mjs [--rapido]
   Limites usados (AI Studio, nov/2026 — confira em aistudio.google.com/rate-limit):
     gemini-3.8-flash 5/min 20/dia · gemini-3.6-flash 5/min 20/dia
     gemini-3.5-flash-lite 10/min 500/dia · gemini-3.1-flash-lite 10/min 500/dia
     gemini-2.5-flash-lite: sem número oficial confirmado → cenário "conservador" = fora do ar   */
process.env.GEMINI_API_KEY = 'chave-falsa';
process.env.PROVEDOR = 'gemini';
process.env.CACHE_IA = '0';                       // perguntas diferentes de alunos diferentes: cache não ajuda aqui
delete process.env.ANTHROPIC_API_KEY;

/* ---------- relógio simulado ---------- */
let agora = Date.UTC(2026, 10, 9, 8, 30);         // segunda-feira, 05:30 em Brasília (logo depois da renovação)
const dataReal = Date.now;
Date.now = () => agora;
console.warn = () => {}; console.error = () => {};  // a escada avisa cada descida; aqui só queremos os números

/* ---------- Gemini de mentira com as cotas do plano grátis ---------- */
const COTAS = {
  'gemini-3.8-flash': { rpm: 5, rpd: 20 },
  'gemini-3.6-flash': { rpm: 5, rpd: 20 },
  'gemini-3.5-flash-lite': { rpm: 10, rpd: 500 },
  'gemini-3.1-flash-lite': { rpm: 10, rpd: 500 },
  'gemini-2.5-flash-lite': null,                  // conservador: não conta com ele
};
let uso;   // modelo → { minuto: [instantes], dia, diaChave }
const diaDaCota = (t) => Math.floor((t - 8 * 3600000) / 86400000);   // renova 00:00 no Pacífico = 08:00 UTC (horário de inverno)
function zerarGemini() { uso = new Map(Object.keys(COTAS).map((m) => [m, { minuto: [], dia: 0, diaChave: diaDaCota(agora) }])); }
const resposta = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url) => {
  const modelo = (String(url).match(/models\/([^:]+):/) || [])[1];
  const cota = COTAS[modelo];
  if (!cota) return resposta(404, { error: { code: 404, message: `models/${modelo} is not found for API version v1beta` } });
  const u = uso.get(modelo);
  if (u.diaChave !== diaDaCota(agora)) { u.dia = 0; u.diaChave = diaDaCota(agora); }
  u.minuto = u.minuto.filter((t) => agora - t < 60000);
  if (u.dia >= cota.rpd) {
    return resposta(429, { error: { code: 429, message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: GenerateRequestsPerDayPerProjectPerModel-FreeTier',
      details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } });
  }
  if (u.minuto.length >= cota.rpm) {
    const espera = Math.ceil((60000 - (agora - u.minuto[0])) / 1000);
    return resposta(429, { error: { code: 429, message: 'Quota exceeded: GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
      details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: `${espera}s` }] } });
  }
  u.minuto.push(agora); u.dia++;
  return resposta(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 400 } });
};

const { perguntar, zerarEscada } = await import('../src/ia.js');

/* ---------- a carga: quando os alunos perguntam (horário de Brasília) ---------- */
// peso de cada hora do dia (0h…23h BR): manhã na escola, pico depois da aula e à noite
const PESO_HORA = [0.2, 0.1, 0, 0, 0, 0, 0.3, 1, 1.5, 1.5, 1.5, 1.5, 2, 3, 4, 4.5, 5, 5, 5, 6, 7, 7, 5, 2];
const somaPeso = PESO_HORA.reduce((a, b) => a + b, 0);
let semente = 7;
const sorte = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
function instanteDoDia(base) {
  let r = sorte() * somaPeso, h = 0;
  while (r > PESO_HORA[h]) { r -= PESO_HORA[h]; h++; }
  // a cota renova às 05:00 de Brasília: madrugada (0h–4h) conta no "dia" que começou na manhã anterior
  const hBR = h < 5 ? h + 24 : h;
  return base + (hBR + 3) * 3600000 + Math.floor(sorte() * 3600000);   // +3: hora BR → UTC
}

async function simular({ alunos, porAluno, plus = 0.2, tentarDeNovo = true, mesmoMinuto = false }) {
  zerarGemini(); zerarEscada(); semente = 7;
  const inicioDia = Date.UTC(2026, 10, 9, 0, 0);                 // 00:00 UTC do dia simulado
  const pedidos = [];
  for (let a = 0; a < alunos; a++) {
    const nivel = sorte() < plus ? 'plus' : 'pro';
    for (let q = 0; q < porAluno; q++) {
      const x = sorte();
      const esforco = x < 0.15 ? 'low' : x < 0.9 ? 'medium' : 'high';   // 15% simples, 75% normais, 10% difíceis
      const t = mesmoMinuto ? Date.UTC(2026, 10, 9, 17, 0) + Math.floor(sorte() * 60000) : instanteDoDia(inicioDia);
      pedidos.push({ t, nivel, esforco, tentativa: 1 });
    }
  }
  const fila = pedidos.sort((p, q) => p.t - q.t);
  const r = { total: fila.length, ok: 0, depoisDeTentar: 0, demoraMax: 0, falhaMinuto: 0, falhaDia: 0, porModelo: {}, esgotouAs: null, picoPorMinuto: 0 };
  const porMinuto = new Map();
  for (let i = 0; i < fila.length; i++) {
    const p = fila[i];
    agora = p.t;
    const min = Math.floor(p.t / 60000); porMinuto.set(min, (porMinuto.get(min) || 0) + 1);
    try {
      const resp = await perguntar({ system: `aluno ${i}`, conteudo: `pergunta ${i}`, esforco: p.esforco, nivel: p.nivel, maxTokens: 1500 });
      r.ok++; if (p.tentativa > 1) { r.depoisDeTentar++; r.demoraMax = Math.max(r.demoraMax, p.t - (p.t0 || p.t)); }
      r.porModelo[resp.modelo] = (r.porModelo[resp.modelo] || 0) + 1;
    } catch {
      // todos sem cota: se ainda tem cota no dia, é o limite por minuto (o app pede para tentar em instantes)
      const aindaTemDia = [...uso.entries()].some(([m, u]) => COTAS[m] && u.dia < COTAS[m].rpd);
      if (aindaTemDia && tentarDeNovo && p.tentativa < 3) {
        // o aluno toca em "tentar de novo" ~1 min depois
        const novo = { ...p, t0: p.t0 || p.t, t: p.t + 60000 + Math.floor(sorte() * 30000), tentativa: p.tentativa + 1 };
        let j = i + 1; while (j < fila.length && fila[j].t <= novo.t) j++;
        fila.splice(j, 0, novo);
        continue;
      }
      if (aindaTemDia) r.falhaMinuto++;
      else { r.falhaDia++; if (!r.esgotouAs) r.esgotouAs = new Date(p.t - 3 * 3600000).toISOString().slice(11, 16); }
    }
  }
  r.picoPorMinuto = Math.max(...porMinuto.values());
  return r;
}

/* ---------- cenários ---------- */
const rapido = process.argv.includes('--rapido');
const cenarios = rapido
  ? [{ alunos: 20, porAluno: 8 }, { alunos: 100, porAluno: 8 }]
  : [5, 10, 25, 50, 75, 100, 150, 200].flatMap((alunos) => [4, 8, 15].map((porAluno) => ({ alunos, porAluno })));

const linhas = [];
for (const c of cenarios) {
  const r = await simular(c);
  const pct = (n) => `${Math.round((100 * n) / r.total)}%`;
  linhas.push({
    alunos: c.alunos, perguntas: c.porAluno, total: r.total, respondidas: pct(r.ok),
    falhaMinuto: r.falhaMinuto, falhaDia: r.falhaDia, esgotouAs: r.esgotouAs || '—', pico: r.picoPorMinuto,
    flash: (r.porModelo['gemini-3.8-flash'] || 0) + (r.porModelo['gemini-3.6-flash'] || 0),
    lite: (r.porModelo['gemini-3.5-flash-lite'] || 0) + (r.porModelo['gemini-3.1-flash-lite'] || 0),
  });
}
console.log('alunos | perg/aluno | pedidos | respondidas | falha p/ minuto | falha p/ dia | cota acabou (BR) | pico/min | flash | lite');
for (const l of linhas) {
  console.log([l.alunos, l.perguntas, l.total, l.respondidas, l.falhaMinuto, l.falhaDia, l.esgotouAs, l.pico, l.flash, l.lite].join(' | '));
}

/* ---------- a turma inteira perguntando no mesmo minuto (ex.: o professor manda usar na aula) ---------- */
console.log('\nturma no mesmo minuto | pedidos | na hora | depois de tentar de novo | sem resposta | maior espera');
for (const n of [10, 20, 30, 40, 60]) {
  const r = await simular({ alunos: n, porAluno: 1, mesmoMinuto: true });
  console.log([n, r.total, r.ok - r.depoisDeTentar, r.depoisDeTentar, r.total - r.ok, `${Math.round(r.demoraMax / 1000)} s`].join(' | '));
}

/* ---------- conferências (o teste reprova se a escada não fizer o que promete) ---------- */
let falhas = 0;
const conferir = (c, t, x = '') => { if (c) console.log(`  ✓ ${t}`); else { falhas++; console.log(`  ✗ ${t}${x ? ' → ' + x : ''}`); } };
const pequeno = await simular({ alunos: 20, porAluno: 8 });
conferir(pequeno.ok === pequeno.total, '20 alunos × 8 perguntas: tudo respondido', `${pequeno.ok}/${pequeno.total}`);
const teto = await simular({ alunos: 200, porAluno: 15 });
conferir(teto.ok === 1040, 'o teto do dia é exatamente a soma das cotas (1.040)', String(teto.ok));
conferir(teto.porModelo['gemini-3.8-flash'] === 20 && teto.porModelo['gemini-3.6-flash'] === 20, 'os modelos melhores são usados até o fim da cota deles');
Date.now = dataReal;
process.exit(falhas ? 1 : 0);
