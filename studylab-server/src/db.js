/* ===== db.js — banco do MindTrack =====
   Com DATABASE_URL usa Postgres (é o que roda no Railway).
   Sem DATABASE_URL cai para memória, só para você testar na sua máquina —
   nesse modo os dados somem quando o servidor reinicia.                      */
import crypto from 'node:crypto';
import postgres from 'postgres';

const URL_BANCO = process.env.DATABASE_URL || '';
export const emMemoria = !URL_BANCO;

/* O endereço INTERNO do banco do Render (host sem ponto, ex.: dpg-xxxx-a) e o
   localhost não usam SSL; os endereços públicos (Railway, Render externo) exigem. */
function precisaSsl(url) {
  try {
    const host = new URL(url).hostname;
    return host !== 'localhost' && host.includes('.');
  } catch { return true; }
}

const sql = URL_BANCO
  ? postgres(URL_BANCO, { ssl: precisaSsl(URL_BANCO) ? 'require' : false, max: 5 })
  : null;
/** A mesma conexão, para os outros módulos (social.js) não abrirem outra. */
export const conexao = sql;

/* ---------- modo memória ---------- */
const mem = { usuarios: new Map(), assinaturas: new Map(), uso: new Map(), codigos: new Map(), pagamentos: new Map(), conexoes: new Map() };

export async function migrar() {
  if (emMemoria) {
    for (const [codigo, d] of Object.entries({
      MINDTRACK30: { dias: 30, nivel: 'pro' },
      PROFESSOR: { dias: 365, nivel: 'plus' },
      TESTE7: { dias: 7, nivel: 'pro' },
    })) {
      mem.codigos.set(codigo, { codigo, dias: d.dias, nivel: d.nivel, usosMax: 999, usos: 0 });
    }
    return;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id           text PRIMARY KEY,              -- "sub" do Google
      email        text NOT NULL,
      nome         text NOT NULL DEFAULT '',
      foto         text NOT NULL DEFAULT '',
      provedor     text NOT NULL DEFAULT 'google',   -- google | dispositivo
      senha_hash   text,                             -- só para contas de aparelho
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
  // colunas novas em bancos que já existiam
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS provedor text NOT NULL DEFAULT 'google'`;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_hash text`;
  await sql`
    CREATE TABLE IF NOT EXISTS uso (
      usuario_id      text NOT NULL,
      dia             date NOT NULL,
      chamadas        int  NOT NULL DEFAULT 0,
      fotos           int  NOT NULL DEFAULT 0,
      tokens_entrada  bigint NOT NULL DEFAULT 0,
      tokens_saida    bigint NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, dia)
    )`;
  await sql`ALTER TABLE uso ADD COLUMN IF NOT EXISTS fotos int NOT NULL DEFAULT 0`;
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
      nivel      text NOT NULL DEFAULT 'pro',    -- pro | plus
      usos_max   int  NOT NULL DEFAULT 1,
      usos       int  NOT NULL DEFAULT 0,
      criado_em  timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`ALTER TABLE codigos ADD COLUMN IF NOT EXISTS nivel text NOT NULL DEFAULT 'pro'`;
  // conta Google ligada a uma conta de aparelho (o id da conta não muda)
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub text`;
  // conta com e-mail e senha (criada no app): e-mail de login, telefone (WhatsApp) e foto
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_login text`;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado boolean NOT NULL DEFAULT false`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_login ON usuarios (lower(email_login)) WHERE email_login IS NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_google ON usuarios (google_sub) WHERE google_sub IS NOT NULL`;
  // Conexões: o que o aluno ligou (Google Agenda, Classroom, Drive, calendário por link).
  // O segredo (refresh token do Google ou o link privado do calendário) fica CIFRADO.
  await sql`
    CREATE TABLE IF NOT EXISTS conexoes (
      usuario_id       text NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      servico          text NOT NULL,                -- agenda | classroom | drive | ics
      conta            text NOT NULL DEFAULT '',     -- e-mail ou nome do calendário (só para mostrar)
      segredo          text NOT NULL,                -- cifrado (AES-256-GCM)
      escopos          text NOT NULL DEFAULT '',
      criado_em        timestamptz NOT NULL DEFAULT now(),
      sincronizado_em  timestamptz,
      PRIMARY KEY (usuario_id, servico)
    )`;
  // códigos iniciais, só se a tabela estiver vazia
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM codigos`;
  if (count === 0) {
    await sql`INSERT INTO codigos ${sql([
      { codigo: 'MINDTRACK30', dias: 30, nivel: 'pro', usos_max: 50 },
      { codigo: 'PROFESSOR', dias: 365, nivel: 'plus', usos_max: 20 },
      { codigo: 'TESTE7', dias: 7, nivel: 'pro', usos_max: 200 },
    ])}`;
  }
}

const hoje = () => new Date().toISOString().slice(0, 10);
const somaDias = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/* ---------- usuários ---------- */
export async function salvarUsuario({ id, email, nome, foto, provedor = 'google' }) {
  if (emMemoria) {
    const antigo = mem.usuarios.get(id) || {};
    mem.usuarios.set(id, { ...antigo, id, email, nome, foto, provedor });
    return mem.usuarios.get(id);
  }
  const [u] = await sql`
    INSERT INTO usuarios ${sql({ id, email, nome, foto, provedor })}
    ON CONFLICT (id) DO UPDATE SET email = excluded.email, nome = excluded.nome,
      foto = excluded.foto, visto_em = now()
    RETURNING *`;
  return u;
}

/* ---------- conta com e-mail e senha ----------
   A senha nunca é guardada: só o hash scrypt com sal ("scrypt$sal$hash"). */
export function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('base64url');
  const h = crypto.scryptSync(String(senha), sal, 32).toString('base64url');
  return `scrypt$${sal}$${h}`;
}
export function senhaConfere(senha, guardado) {
  const [tipo, sal, h] = String(guardado || '').split('$');
  if (tipo !== 'scrypt' || !sal || !h) return false;
  const tentativa = crypto.scryptSync(String(senha), sal, 32);
  const certo = Buffer.from(h, 'base64url');
  return certo.length === tentativa.length && crypto.timingSafeEqual(certo, tentativa);
}

export async function contaPorEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  if (emMemoria) return [...mem.usuarios.values()].find((u) => (u.email_login || '').toLowerCase() === e) || null;
  const [u] = await sql`SELECT * FROM usuarios WHERE lower(email_login) = ${e}`;
  return u || null;
}

/**
 * Cria a conta com e-mail e senha. Se o aluno já usava o app (conta de aparelho),
 * a MESMA conta vira conta de verdade: o plano e o histórico continuam.
 * Devolve null se o e-mail já tem conta.
 */
export async function criarContaEmail({ nome, email, telefone, senha, foto = '', verificado = false }, contaAtualId = null) {
  if (await contaPorEmail(email)) return null;
  const campos = {
    email: String(email).trim(), email_login: String(email).trim().toLowerCase(), nome, telefone, foto,
    provedor: 'email', senha_hash: hashSenha(senha), email_verificado: !!verificado,
  };
  if (emMemoria) {
    const atual = contaAtualId && mem.usuarios.get(contaAtualId);
    if (atual && atual.provedor === 'dispositivo') { Object.assign(atual, campos); return atual; }
    const id = `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    mem.usuarios.set(id, { id, ...campos });
    return mem.usuarios.get(id);
  }
  if (contaAtualId) {
    const [u] = await sql`UPDATE usuarios SET ${sql(campos)}, visto_em = now()
      WHERE id = ${contaAtualId} AND provedor = 'dispositivo' RETURNING *`;
    if (u) return u;
  }
  const id = `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const [u] = await sql`INSERT INTO usuarios ${sql({ id, ...campos })} RETURNING *`;
  return u;
}

/** Senha nova pelo código do e-mail (o e-mail fica confirmado). Devolve a conta ou null. */
export async function trocarSenha(email, senha) {
  const u = await contaPorEmail(email);
  if (!u) return null;
  const senha_hash = hashSenha(senha);
  if (emMemoria) { Object.assign(u, { senha_hash, email_verificado: true }); return u; }
  const [n] = await sql`UPDATE usuarios SET senha_hash = ${senha_hash}, email_verificado = true WHERE id = ${u.id} RETURNING *`;
  return n || null;
}

export async function atualizarFoto(usuarioId, foto) {
  if (emMemoria) { const u = mem.usuarios.get(usuarioId); if (u) u.foto = foto; return; }
  await sql`UPDATE usuarios SET foto = ${foto} WHERE id = ${usuarioId}`;
}

export async function usuarioPorId(id) {
  if (emMemoria) return mem.usuarios.get(id) || null;
  const [u] = await sql`SELECT * FROM usuarios WHERE id = ${id}`;
  return u || null;
}

/**
 * Entrada pelo Google (fluxo das Conexões). Ordem:
 * 1) já existe conta com este Google → é ela;
 * 2) o aluno estava numa conta de aparelho → liga o Google nela (plano e dados ficam);
 * 3) senão → conta nova com o id do Google.
 */
export async function entrarComGoogle({ sub, email, nome, foto }, contaAtualId = null) {
  if (emMemoria) {
    const achada = [...mem.usuarios.values()].find((u) => u.google_sub === sub || (u.id === sub && u.provedor === 'google'));
    if (achada) { Object.assign(achada, { email, nome: nome || achada.nome, foto, google_sub: sub }); return achada; }
    const atual = contaAtualId && mem.usuarios.get(contaAtualId);
    if (atual) { Object.assign(atual, { email, nome: nome || atual.nome, foto, provedor: 'google', google_sub: sub }); return atual; }
    const u = { id: sub, email, nome, foto, provedor: 'google', google_sub: sub };
    mem.usuarios.set(sub, u);
    return u;
  }
  const [achada] = await sql`SELECT * FROM usuarios WHERE google_sub = ${sub} OR (id = ${sub} AND provedor = 'google') LIMIT 1`;
  if (achada) {
    const [u] = await sql`UPDATE usuarios SET email = ${email}, nome = ${nome || achada.nome}, foto = ${foto},
      google_sub = ${sub}, visto_em = now() WHERE id = ${achada.id} RETURNING *`;
    return u;
  }
  if (contaAtualId) {
    const [u] = await sql`UPDATE usuarios SET email = ${email}, nome = coalesce(nullif(${nome}, ''), nome), foto = ${foto},
      provedor = 'google', google_sub = ${sub}, visto_em = now() WHERE id = ${contaAtualId} RETURNING *`;
    if (u) return u;
  }
  const [u] = await sql`
    INSERT INTO usuarios ${sql({ id: sub, email, nome, foto, provedor: 'google', google_sub: sub })}
    RETURNING *`;
  return u;
}

/* ---------- conexões ---------- */
export async function salvarConexao({ usuarioId, servico, conta = '', segredo, escopos = '' }) {
  if (emMemoria) {
    mem.conexoes.set(`${usuarioId}|${servico}`, { usuario_id: usuarioId, servico, conta, segredo, escopos, criado_em: new Date().toISOString(), sincronizado_em: null });
    return;
  }
  await sql`
    INSERT INTO conexoes ${sql({ usuario_id: usuarioId, servico, conta, segredo, escopos })}
    ON CONFLICT (usuario_id, servico) DO UPDATE SET conta = excluded.conta, segredo = excluded.segredo,
      escopos = excluded.escopos, criado_em = now(), sincronizado_em = NULL`;
}

export async function conexoesDo(usuarioId) {
  if (emMemoria) return [...mem.conexoes.values()].filter((c) => c.usuario_id === usuarioId);
  return sql`SELECT * FROM conexoes WHERE usuario_id = ${usuarioId} ORDER BY criado_em`;
}

export async function conexaoDe(usuarioId, servico) {
  if (emMemoria) return mem.conexoes.get(`${usuarioId}|${servico}`) || null;
  const [c] = await sql`SELECT * FROM conexoes WHERE usuario_id = ${usuarioId} AND servico = ${servico}`;
  return c || null;
}

export async function apagarConexao(usuarioId, servico) {
  if (emMemoria) { mem.conexoes.delete(`${usuarioId}|${servico}`); return; }
  await sql`DELETE FROM conexoes WHERE usuario_id = ${usuarioId} AND servico = ${servico}`;
}

export async function marcarSincronizado(usuarioId, servico) {
  if (emMemoria) { const c = mem.conexoes.get(`${usuarioId}|${servico}`); if (c) c.sincronizado_em = new Date().toISOString(); return; }
  await sql`UPDATE conexoes SET sincronizado_em = now() WHERE usuario_id = ${usuarioId} AND servico = ${servico}`;
}

/**
 * Conta de aparelho: o app sorteia um id e uma senha na primeira vez e guarda
 * no próprio celular. Serve para o aluno usar o MindTrack (e assinar) sem
 * precisar de conta Google. Quem sabe só o id não entra: precisa da senha.
 */
export async function entrarPorDispositivo({ id, segredo, nome }) {
  const hash = crypto.createHash('sha256').update(String(segredo)).digest('hex');
  if (emMemoria) {
    const u = mem.usuarios.get(id);
    if (!u) { mem.usuarios.set(id, { id, email: '', nome, foto: '', provedor: 'dispositivo', senha_hash: hash }); return mem.usuarios.get(id); }
    if (u.senha_hash !== hash) return null;
    u.nome = nome || u.nome;
    return u;
  }
  const [existente] = await sql`SELECT * FROM usuarios WHERE id = ${id}`;
  if (!existente) {
    const [u] = await sql`
      INSERT INTO usuarios ${sql({ id, email: '', nome, foto: '', provedor: 'dispositivo', senha_hash: hash })}
      RETURNING *`;
    return u;
  }
  if (existente.senha_hash !== hash) return null;
  const [u] = await sql`UPDATE usuarios SET nome = ${nome || existente.nome}, visto_em = now() WHERE id = ${id} RETURNING *`;
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
    return { codigo: c, dias: d.dias, nivel: d.nivel || 'pro' };
  }
  const [d] = await sql`
    UPDATE codigos SET usos = usos + 1
    WHERE codigo = ${c} AND usos < usos_max
    RETURNING codigo, dias, nivel`;
  return d || null;
}

export async function criarCodigo({ codigo, dias, usosMax = 1, nivel = 'pro' }) {
  const c = String(codigo).trim().toUpperCase();
  const n = nivel === 'plus' ? 'plus' : 'pro';
  if (emMemoria) { mem.codigos.set(c, { codigo: c, dias, nivel: n, usosMax, usos: 0 }); return { codigo: c, dias, nivel: n, usosMax }; }
  const [d] = await sql`
    INSERT INTO codigos ${sql({ codigo: c, dias, nivel: n, usos_max: usosMax })}
    ON CONFLICT (codigo) DO UPDATE SET dias = excluded.dias, nivel = excluded.nivel, usos_max = excluded.usos_max
    RETURNING *`;
  return d;
}

/* ---------- uso (controle de custo) ---------- */
export async function usoDoDia(usuarioId) {
  if (emMemoria) return mem.uso.get(`${usuarioId}|${hoje()}`) || { chamadas: 0, fotos: 0, tokens_entrada: 0, tokens_saida: 0 };
  const [u] = await sql`SELECT * FROM uso WHERE usuario_id = ${usuarioId} AND dia = current_date`;
  return u || { chamadas: 0, fotos: 0, tokens_entrada: 0, tokens_saida: 0 };
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

export async function registrarUso(usuarioId, { entrada = 0, saida = 0, fotos = 0 } = {}) {
  if (emMemoria) {
    const k = `${usuarioId}|${hoje()}`;
    const u = mem.uso.get(k) || { chamadas: 0, fotos: 0, tokens_entrada: 0, tokens_saida: 0 };
    u.chamadas++; u.fotos = (u.fotos || 0) + fotos; u.tokens_entrada += entrada; u.tokens_saida += saida;
    mem.uso.set(k, u);
    return u;
  }
  const [u] = await sql`
    INSERT INTO uso (usuario_id, dia, chamadas, fotos, tokens_entrada, tokens_saida)
    VALUES (${usuarioId}, current_date, 1, ${fotos}, ${entrada}, ${saida})
    ON CONFLICT (usuario_id, dia) DO UPDATE SET
      chamadas = uso.chamadas + 1,
      fotos = uso.fotos + ${fotos},
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
      receita: Math.round([...mem.pagamentos.values()].filter((p) => p.status === 'pago').reduce((s, p) => s + Number(p.valor || 0), 0) * 100) / 100,
    };
  }
  const [[u], [a], [c], [p]] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM usuarios`,
    sql`SELECT count(DISTINCT usuario_id)::int AS n FROM assinaturas WHERE cancelada = false AND fim >= current_date`,
    sql`SELECT coalesce(sum(chamadas),0)::int AS n FROM uso WHERE dia = current_date`,
    sql`SELECT count(*)::int AS n, coalesce(sum(valor),0)::float AS receita FROM pagamentos WHERE status = 'pago'`,
  ]);
  return { usuarios: u.n, assinantes: a.n, chamadasHoje: c.n, pagamentos: p.n, receita: Math.round(p.receita * 100) / 100 };
}
