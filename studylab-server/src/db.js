/* ===== db.js — banco do StudyLab =====
   Com DATABASE_URL usa Postgres (é o que roda no Railway).
   Sem DATABASE_URL cai para memória, só para você testar na sua máquina —
   nesse modo os dados somem quando o servidor reinicia.                      */
import postgres from 'postgres';

const URL_BANCO = process.env.DATABASE_URL || '';
export const emMemoria = !URL_BANCO;

const sql = URL_BANCO
  ? postgres(URL_BANCO, { ssl: URL_BANCO.includes('localhost') ? false : 'require', max: 5 })
  : null;

/* ---------- modo memória ---------- */
const mem = { usuarios: new Map(), assinaturas: new Map(), uso: new Map(), codigos: new Map(), pagamentos: new Map() };

export async function migrar() {
  if (emMemoria) {
    for (const [codigo, dias] of Object.entries({ STUDYLAB30: 30, PROFESSOR: 365, TESTE7: 7 })) {
      mem.codigos.set(codigo, { codigo, dias, usosMax: 999, usos: 0 });
    }
    return;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id           text PRIMARY KEY,              -- "sub" do Google
      email        text NOT NULL,
      nome         text NOT NULL DEFAULT '',
      foto         text NOT NULL DEFAULT '',
      criado_em    timestamptz NOT NULL DEFAULT now(),
      visto_em     timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS assinaturas (
      id          bigserial PRIMARY KEY,
      usuario_id  text NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      plano       text NOT NULL,                  -- semanal | mensal | anual | codigo
      inicio      date NOT NULL DEFAULT current_date,
      fim         date NOT NULL,
      origem      text NOT NULL DEFAULT 'codigo', -- codigo | pagamento | cortesia
      referencia  text,                           -- código usado ou id do pagamento
      cancelada   boolean NOT NULL DEFAULT false,
      criada_em   timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assin_usuario ON assinaturas (usuario_id, fim DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS uso (
      usuario_id      text NOT NULL,
      dia             date NOT NULL,
      chamadas        int  NOT NULL DEFAULT 0,
      tokens_entrada  bigint NOT NULL DEFAULT 0,
      tokens_saida    bigint NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, dia)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id            bigserial PRIMARY KEY,
      usuario_id    text NOT NULL,
      plano         text NOT NULL,
      provedor      text NOT NULL DEFAULT 'mercadopago',
      referencia    text UNIQUE,                  -- id do Mercado Pago (não processar 2x)
      valor         numeric(10,2),
      status        text NOT NULL DEFAULT 'pendente',
      criado_em     timestamptz NOT NULL DEFAULT now(),
      processado_em timestamptz
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pag_usuario ON pagamentos (usuario_id, criado_em DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS codigos (
      codigo     text PRIMARY KEY,
      dias       int  NOT NULL,
      usos_max   int  NOT NULL DEFAULT 1,
      usos       int  NOT NULL DEFAULT 0,
      criado_em  timestamptz NOT NULL DEFAULT now()
    )`;
  // códigos iniciais, só se a tabela estiver vazia
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM codigos`;
  if (count === 0) {
    await sql`INSERT INTO codigos ${sql([
      { codigo: 'STUDYLAB30', dias: 30, usos_max: 50 },
      { codigo: 'PROFESSOR', dias: 365, usos_max: 20 },
      { codigo: 'TESTE7', dias: 7, usos_max: 200 },
    ])}`;
  }
}

const hoje = () => new Date().toISOString().slice(0, 10);
const somaDias = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/* ---------- usuários ---------- */
export async function salvarUsuario({ id, email, nome, foto }) {
  if (emMemoria) {
    mem.usuarios.set(id, { id, email, nome, foto });
    return mem.usuarios.get(id);
  }
  const [u] = await sql`
    INSERT INTO usuarios ${sql({ id, email, nome, foto })}
    ON CONFLICT (id) DO UPDATE SET email = excluded.email, nome = excluded.nome,
      foto = excluded.foto, visto_em = now()
    RETURNING *`;
  return u;
}

/* ---------- assinatura ---------- */
export async function assinaturaAtiva(usuarioId) {
  if (emMemoria) {
    const a = mem.assinaturas.get(usuarioId);
    return a && !a.cancelada && a.fim >= hoje() ? a : null;
  }
  const [a] = await sql`
    SELECT * FROM assinaturas
    WHERE usuario_id = ${usuarioId} AND cancelada = false AND fim >= current_date
    ORDER BY fim DESC LIMIT 1`;
  return a || null;
}

export async function criarAssinatura({ usuarioId, plano, dias, origem = 'codigo', referencia = null }) {
  const atual = await assinaturaAtiva(usuarioId);
  const base = atual ? new Date(`${atual.fim}T00:00:00Z`).getTime() : Date.now();
  const fim = new Date(base + dias * 86400000).toISOString().slice(0, 10);
  if (emMemoria) {
    const a = { usuarioId, plano, inicio: hoje(), fim, origem, referencia, cancelada: false };
    mem.assinaturas.set(usuarioId, a);
    return a;
  }
  const [a] = await sql`
    INSERT INTO assinaturas ${sql({ usuario_id: usuarioId, plano, fim, origem, referencia })}
    RETURNING *`;
  return a;
}

export async function cancelarAssinatura(usuarioId) {
  if (emMemoria) {
    const a = mem.assinaturas.get(usuarioId);
    if (a) a.cancelada = true;
    return;
  }
  await sql`UPDATE assinaturas SET cancelada = true WHERE usuario_id = ${usuarioId} AND cancelada = false`;
}

/* ---------- códigos ---------- */
export async function usarCodigo(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) return null;
  if (emMemoria) {
    const d = mem.codigos.get(c);
    if (!d || d.usos >= d.usosMax) return null;
    d.usos++;
    return { codigo: c, dias: d.dias };
  }
  const [d] = await sql`
    UPDATE codigos SET usos = usos + 1
    WHERE codigo = ${c} AND usos < usos_max
    RETURNING codigo, dias`;
  return d || null;
}

export async function criarCodigo({ codigo, dias, usosMax = 1 }) {
  const c = String(codigo).trim().toUpperCase();
  if (emMemoria) { mem.codigos.set(c, { codigo: c, dias, usosMax, usos: 0 }); return { codigo: c, dias, usosMax }; }
  const [d] = await sql`
    INSERT INTO codigos ${sql({ codigo: c, dias, usos_max: usosMax })}
    ON CONFLICT (codigo) DO UPDATE SET dias = excluded.dias, usos_max = excluded.usos_max
    RETURNING *`;
  return d;
}

/* ---------- uso (controle de custo) ---------- */
export async function usoDoDia(usuarioId) {
  if (emMemoria) return mem.uso.get(`${usuarioId}|${hoje()}`) || { chamadas: 0, tokens_entrada: 0, tokens_saida: 0 };
  const [u] = await sql`SELECT * FROM uso WHERE usuario_id = ${usuarioId} AND dia = current_date`;
  return u || { chamadas: 0, tokens_entrada: 0, tokens_saida: 0 };
}

export async function usoDoMes(usuarioId) {
  if (emMemoria) {
    const mes = hoje().slice(0, 7);
    return [...mem.uso.entries()]
      .filter(([k]) => k.startsWith(`${usuarioId}|${mes}`))
      .reduce((s, [, v]) => s + v.chamadas, 0);
  }
  const [u] = await sql`
    SELECT coalesce(sum(chamadas),0)::int AS n FROM uso
    WHERE usuario_id = ${usuarioId} AND dia >= date_trunc('month', current_date)`;
  return u?.n || 0;
}

export async function registrarUso(usuarioId, { entrada = 0, saida = 0 } = {}) {
  if (emMemoria) {
    const k = `${usuarioId}|${hoje()}`;
    const u = mem.uso.get(k) || { chamadas: 0, tokens_entrada: 0, tokens_saida: 0 };
    u.chamadas++; u.tokens_entrada += entrada; u.tokens_saida += saida;
    mem.uso.set(k, u);
    return u;
  }
  const [u] = await sql`
    INSERT INTO uso (usuario_id, dia, chamadas, tokens_entrada, tokens_saida)
    VALUES (${usuarioId}, current_date, 1, ${entrada}, ${saida})
    ON CONFLICT (usuario_id, dia) DO UPDATE SET
      chamadas = uso.chamadas + 1,
      tokens_entrada = uso.tokens_entrada + ${entrada},
      tokens_saida = uso.tokens_saida + ${saida}
    RETURNING *`;
  return u;
}

/* ---------- pagamentos ---------- */
export async function registrarPagamento({ usuarioId, plano, referencia, valor, status = 'pendente' }) {
  if (emMemoria) {
    const p = { usuarioId, plano, referencia, valor, status, processadoEm: null };
    mem.pagamentos.set(referencia, p);
    return p;
  }
  const [p] = await sql`
    INSERT INTO pagamentos ${sql({ usuario_id: usuarioId, plano, referencia, valor, status })}
    ON CONFLICT (referencia) DO UPDATE SET status = excluded.status
    RETURNING *`;
  return p;
}

/** true se este aviso do Mercado Pago já foi processado (evita liberar 2x). */
export async function jaProcessado(referencia) {
  if (emMemoria) return mem.pagamentos.get(referencia)?.status === 'pago';
  const [p] = await sql`SELECT status FROM pagamentos WHERE referencia = ${referencia}`;
  return p?.status === 'pago';
}

export async function marcarPago({ usuarioId, plano, referencia, valor }) {
  if (emMemoria) {
    mem.pagamentos.set(referencia, { usuarioId, plano, referencia, valor, status: 'pago', processadoEm: new Date().toISOString() });
    return;
  }
  await sql`
    INSERT INTO pagamentos ${sql({ usuario_id: usuarioId, plano, referencia, valor, status: 'pago' })}
    ON CONFLICT (referencia) DO UPDATE SET status = 'pago', processado_em = now()`;
  await sql`UPDATE pagamentos SET processado_em = now() WHERE referencia = ${referencia} AND processado_em IS NULL`;
}

export async function pagamentosDoUsuario(usuarioId, limite = 10) {
  if (emMemoria) return [...mem.pagamentos.values()].filter((p) => p.usuarioId === usuarioId).slice(0, limite);
  return sql`SELECT * FROM pagamentos WHERE usuario_id = ${usuarioId} ORDER BY criado_em DESC LIMIT ${limite}`;
}

/* ---------- painel simples ---------- */
export async function numeros() {
  if (emMemoria) {
    return {
      usuarios: mem.usuarios.size,
      assinantes: [...mem.assinaturas.values()].filter((a) => !a.cancelada && a.fim >= hoje()).length,
      chamadasHoje: [...mem.uso.entries()].filter(([k]) => k.endsWith(hoje())).reduce((s, [, v]) => s + v.chamadas, 0),
      pagamentos: [...mem.pagamentos.values()].filter((p) => p.status === 'pago').length,
      receita: [...mem.pagamentos.values()].filter((p) => p.status === 'pago').reduce((s, p) => s + Number(p.valor || 0), 0),
    };
  }
  const [[u], [a], [c], [p]] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM usuarios`,
    sql`SELECT count(DISTINCT usuario_id)::int AS n FROM assinaturas WHERE cancelada = false AND fim >= current_date`,
    sql`SELECT coalesce(sum(chamadas),0)::int AS n FROM uso WHERE dia = current_date`,
    sql`SELECT count(*)::int AS n, coalesce(sum(valor),0)::float AS receita FROM pagamentos WHERE status = 'pago'`,
  ]);
  return { usuarios: u.n, assinantes: a.n, chamadasHoje: c.n, pagamentos: p.n, receita: p.receita };
}
