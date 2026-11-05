/* ===== social-db.js — amizades, chat, foguinho e duelos (dados) =====
   Postgres quando há DATABASE_URL; memória nos testes. Toda a regra de quem
   pode falar com quem fica em social.js — aqui é só guardar e ler.           */
import { conexao as sql, emMemoria } from './db.js';

const mem = {
  perfis: new Map(),        // usuarioId → perfil
  amizades: new Map(),      // 'a|b' (a < b) → { a, b, solicitante, status, criado_em, aceita_em }
  mensagens: [],            // { id, de, para, texto, criado_em, lida }
  bloqueios: new Set(),     // 'de|alvo'
  denuncias: [],
  atividade: new Set(),     // 'usuario|AAAA-MM-DD'
  duelos: [],
};
let seqMsg = 1;
export const parDe = (x, y) => (x < y ? [x, y] : [y, x]);
const chavePar = (x, y) => parDe(x, y).join('|');

export async function migrarSocial() {
  if (emMemoria) return;
  await sql`
    CREATE TABLE IF NOT EXISTS perfis_sociais (
      usuario_id  text PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      apelido     text NOT NULL,
      nome        text NOT NULL DEFAULT '',
      avatar      text NOT NULL DEFAULT '🎓',
      sequencia   int  NOT NULL DEFAULT 0,
      ultimo_dia  date,
      criado_em   timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_perfis_apelido ON perfis_sociais (lower(apelido))`;
  await sql`
    CREATE TABLE IF NOT EXISTS amizades (
      a           text NOT NULL,
      b           text NOT NULL,
      solicitante text NOT NULL,
      status      text NOT NULL DEFAULT 'pendente',   -- pendente | aceita
      criado_em   timestamptz NOT NULL DEFAULT now(),
      aceita_em   timestamptz,
      PRIMARY KEY (a, b)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS mensagens (
      id         bigserial PRIMARY KEY,
      de         text NOT NULL,
      para       text NOT NULL,
      texto      text NOT NULL,
      criado_em  timestamptz NOT NULL DEFAULT now(),
      lida       boolean NOT NULL DEFAULT false
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_msg_par ON mensagens (de, para, id DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS bloqueios (de text NOT NULL, alvo text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (de, alvo))`;
  await sql`
    CREATE TABLE IF NOT EXISTS denuncias (
      id bigserial PRIMARY KEY, de text NOT NULL, alvo text NOT NULL, motivo text NOT NULL DEFAULT '',
      mensagem_id bigint, criado_em timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE TABLE IF NOT EXISTS atividade_dias (usuario_id text NOT NULL, dia date NOT NULL, PRIMARY KEY (usuario_id, dia))`;
  await sql`
    CREATE TABLE IF NOT EXISTS duelos (
      id text PRIMARY KEY, a text NOT NULL, b text NOT NULL, tema text NOT NULL DEFAULT '',
      placar_a int NOT NULL DEFAULT 0, placar_b int NOT NULL DEFAULT 0, vencedor text,
      criado_em timestamptz NOT NULL DEFAULT now()
    )`;
}

/* ---------- perfis ---------- */
const doBanco = (p) => p && ({
  id: p.usuario_id, apelido: p.apelido, nome: p.nome, avatar: p.avatar,
  sequencia: p.sequencia || 0, ultimoDia: p.ultimo_dia ? new Date(p.ultimo_dia).toISOString().slice(0, 10) : null,
});

export async function perfilSocial(usuarioId) {
  if (emMemoria) return doBanco(mem.perfis.get(usuarioId)) || null;
  const [p] = await sql`SELECT * FROM perfis_sociais WHERE usuario_id = ${usuarioId}`;
  return doBanco(p) || null;
}

export async function perfisPorIds(ids) {
  if (!ids.length) return [];
  if (emMemoria) return ids.map((id) => doBanco(mem.perfis.get(id))).filter(Boolean);
  return (await sql`SELECT * FROM perfis_sociais WHERE usuario_id IN ${sql(ids)}`).map(doBanco);
}

export async function perfilPorApelido(apelido) {
  const a = String(apelido || '').trim().toLowerCase();
  if (emMemoria) return doBanco([...mem.perfis.values()].find((p) => p.apelido.toLowerCase() === a)) || null;
  const [p] = await sql`SELECT * FROM perfis_sociais WHERE lower(apelido) = ${a}`;
  return doBanco(p) || null;
}

/** Cria ou muda o perfil. Devolve null se o apelido já for de outra pessoa. */
export async function salvarPerfilSocial({ usuarioId, apelido, nome, avatar }) {
  const dono = await perfilPorApelido(apelido);
  if (dono && dono.id !== usuarioId) return null;
  if (emMemoria) {
    const antigo = mem.perfis.get(usuarioId) || { sequencia: 0, ultimo_dia: null };
    mem.perfis.set(usuarioId, { ...antigo, usuario_id: usuarioId, apelido, nome, avatar });
    return perfilSocial(usuarioId);
  }
  const [p] = await sql`
    INSERT INTO perfis_sociais ${sql({ usuario_id: usuarioId, apelido, nome, avatar })}
    ON CONFLICT (usuario_id) DO UPDATE SET apelido = excluded.apelido, nome = excluded.nome, avatar = excluded.avatar
    RETURNING *`;
  return doBanco(p);
}

/** Procura por apelido (começo) ou nome (pedaço). */
export async function buscarPerfis(termo, limite = 20) {
  const t = String(termo || '').trim().toLowerCase();
  if (t.length < 2) return [];
  if (emMemoria) {
    return [...mem.perfis.values()]
      .filter((p) => p.apelido.toLowerCase().startsWith(t) || p.nome.toLowerCase().includes(t))
      .slice(0, limite).map(doBanco);
  }
  const like = `%${t.replace(/[%_\\]/g, '')}%`;
  const comeco = `${t.replace(/[%_\\]/g, '')}%`;
  return (await sql`
    SELECT * FROM perfis_sociais
    WHERE lower(apelido) LIKE ${comeco} OR lower(nome) LIKE ${like}
    ORDER BY (lower(apelido) LIKE ${comeco}) DESC, apelido LIMIT ${limite}`).map(doBanco);
}

/* ---------- foguinho: os dias em que estudou ---------- */
export async function registrarAtividade(usuarioId, { sequencia, dia }) {
  if (emMemoria) {
    const p = mem.perfis.get(usuarioId);
    if (p) { p.sequencia = sequencia; if (dia) p.ultimo_dia = dia; }
    if (dia) mem.atividade.add(`${usuarioId}|${dia}`);
    return;
  }
  await sql`UPDATE perfis_sociais SET sequencia = ${sequencia},
    ultimo_dia = coalesce(${dia}::date, ultimo_dia) WHERE usuario_id = ${usuarioId}`;
  if (dia) await sql`INSERT INTO atividade_dias (usuario_id, dia) VALUES (${usuarioId}, ${dia}) ON CONFLICT DO NOTHING`;
}

export async function diasAtivos(usuarioId, desde) {
  if (emMemoria) {
    return [...mem.atividade].filter((k) => k.startsWith(`${usuarioId}|`)).map((k) => k.split('|')[1]).filter((d) => d >= desde);
  }
  return (await sql`SELECT dia FROM atividade_dias WHERE usuario_id = ${usuarioId} AND dia >= ${desde}`)
    .map((r) => new Date(r.dia).toISOString().slice(0, 10));
}

/* ---------- amizades ---------- */
const amizadeDoBanco = (r) => r && ({
  a: r.a, b: r.b, solicitante: r.solicitante, status: r.status,
  criadoEm: new Date(r.criado_em).toISOString(), aceitaEm: r.aceita_em ? new Date(r.aceita_em).toISOString() : null,
});

export async function amizade(x, y) {
  if (emMemoria) return amizadeDoBanco(mem.amizades.get(chavePar(x, y))) || null;
  const [a, b] = parDe(x, y);
  const [r] = await sql`SELECT * FROM amizades WHERE a = ${a} AND b = ${b}`;
  return amizadeDoBanco(r) || null;
}

export async function amizadesDe(usuarioId) {
  if (emMemoria) return [...mem.amizades.values()].filter((r) => r.a === usuarioId || r.b === usuarioId).map(amizadeDoBanco);
  return (await sql`SELECT * FROM amizades WHERE a = ${usuarioId} OR b = ${usuarioId}`).map(amizadeDoBanco);
}

export async function pedirAmizade(de, para) {
  const [a, b] = parDe(de, para);
  if (emMemoria) {
    mem.amizades.set(chavePar(de, para), { a, b, solicitante: de, status: 'pendente', criado_em: new Date(), aceita_em: null });
    return;
  }
  await sql`INSERT INTO amizades ${sql({ a, b, solicitante: de })} ON CONFLICT (a, b) DO NOTHING`;
}

export async function aceitarAmizade(x, y) {
  if (emMemoria) {
    const r = mem.amizades.get(chavePar(x, y));
    if (r) { r.status = 'aceita'; r.aceita_em = new Date(); }
    return;
  }
  const [a, b] = parDe(x, y);
  await sql`UPDATE amizades SET status = 'aceita', aceita_em = now() WHERE a = ${a} AND b = ${b}`;
}

export async function apagarAmizade(x, y) {
  if (emMemoria) { mem.amizades.delete(chavePar(x, y)); return; }
  const [a, b] = parDe(x, y);
  await sql`DELETE FROM amizades WHERE a = ${a} AND b = ${b}`;
}

/* ---------- bloqueio e denúncia ---------- */
export async function bloquear(de, alvo) {
  if (emMemoria) { mem.bloqueios.add(`${de}|${alvo}`); return; }
  await sql`INSERT INTO bloqueios (de, alvo) VALUES (${de}, ${alvo}) ON CONFLICT DO NOTHING`;
}
/** true se um dos dois bloqueou o outro. */
export async function bloqueado(x, y) {
  if (emMemoria) return mem.bloqueios.has(`${x}|${y}`) || mem.bloqueios.has(`${y}|${x}`);
  const [r] = await sql`SELECT 1 FROM bloqueios WHERE (de = ${x} AND alvo = ${y}) OR (de = ${y} AND alvo = ${x}) LIMIT 1`;
  return !!r;
}
export async function bloqueadosPor(usuarioId) {
  if (emMemoria) return [...mem.bloqueios].filter((k) => k.startsWith(`${usuarioId}|`) || k.endsWith(`|${usuarioId}`)).map((k) => k.split('|').find((x) => x !== usuarioId));
  return (await sql`SELECT de, alvo FROM bloqueios WHERE de = ${usuarioId} OR alvo = ${usuarioId}`).map((r) => (r.de === usuarioId ? r.alvo : r.de));
}
export async function denunciar({ de, alvo, motivo = '', mensagemId = null }) {
  if (emMemoria) { mem.denuncias.push({ de, alvo, motivo, mensagemId, em: new Date().toISOString() }); return; }
  await sql`INSERT INTO denuncias ${sql({ de, alvo, motivo: String(motivo).slice(0, 300), mensagem_id: mensagemId })}`;
}
export const _denunciasMem = () => mem.denuncias;

/* ---------- mensagens ---------- */
const msgDoBanco = (m) => m && ({ id: Number(m.id), de: m.de, para: m.para, texto: m.texto, em: new Date(m.criado_em).toISOString(), lida: !!m.lida });

export async function salvarMensagem(de, para, texto) {
  if (emMemoria) {
    const m = { id: seqMsg++, de, para, texto, criado_em: new Date(), lida: false };
    mem.mensagens.push(m);
    return msgDoBanco(m);
  }
  const [m] = await sql`INSERT INTO mensagens ${sql({ de, para, texto })} RETURNING *`;
  return msgDoBanco(m);
}

export async function mensagensEntre(x, y, { antes = null, limite = 50 } = {}) {
  if (emMemoria) {
    return mem.mensagens.filter((m) => ((m.de === x && m.para === y) || (m.de === y && m.para === x)) && (!antes || m.id < antes))
      .slice(-limite).map(msgDoBanco);
  }
  const lista = await sql`
    SELECT * FROM mensagens
    WHERE ((de = ${x} AND para = ${y}) OR (de = ${y} AND para = ${x})) AND (${antes}::bigint IS NULL OR id < ${antes})
    ORDER BY id DESC LIMIT ${limite}`;
  return lista.reverse().map(msgDoBanco);
}

export async function marcarLidas(para, de) {
  if (emMemoria) { mem.mensagens.forEach((m) => { if (m.para === para && m.de === de) m.lida = true; }); return; }
  await sql`UPDATE mensagens SET lida = true WHERE para = ${para} AND de = ${de} AND lida = false`;
}

/** Por amigo: quantas não lidas e a última mensagem (para a lista de amigos). */
export async function resumoConversas(usuarioId) {
  const saida = new Map();
  if (emMemoria) {
    for (const m of mem.mensagens) {
      if (m.de !== usuarioId && m.para !== usuarioId) continue;
      const outro = m.de === usuarioId ? m.para : m.de;
      const r = saida.get(outro) || { naoLidas: 0, ultima: null };
      if (m.para === usuarioId && !m.lida) r.naoLidas++;
      r.ultima = msgDoBanco(m);
      saida.set(outro, r);
    }
    return saida;
  }
  const ultimas = await sql`
    SELECT DISTINCT ON (outro) *, CASE WHEN de = ${usuarioId} THEN para ELSE de END AS outro
    FROM mensagens WHERE de = ${usuarioId} OR para = ${usuarioId}
    ORDER BY outro, id DESC`;
  for (const m of ultimas) saida.set(m.outro, { naoLidas: 0, ultima: msgDoBanco(m) });
  const nl = await sql`SELECT de, count(*)::int AS n FROM mensagens WHERE para = ${usuarioId} AND lida = false GROUP BY de`;
  for (const r of nl) saida.set(r.de, { ...(saida.get(r.de) || { ultima: null }), naoLidas: r.n });
  return saida;
}

/* ---------- duelos ---------- */
export async function salvarDuelo(d) {
  if (emMemoria) { mem.duelos.push({ ...d, criado_em: new Date().toISOString() }); return; }
  await sql`INSERT INTO duelos ${sql({ id: d.id, a: d.a, b: d.b, tema: d.tema || '', placar_a: d.placarA, placar_b: d.placarB, vencedor: d.vencedor })}
    ON CONFLICT (id) DO NOTHING`;
}

/** Vitórias de cada um contra o outro. */
export async function placarEntre(x, y) {
  let lista;
  if (emMemoria) lista = mem.duelos.filter((d) => (d.a === x && d.b === y) || (d.a === y && d.b === x));
  else lista = await sql`SELECT vencedor FROM duelos WHERE (a = ${x} AND b = ${y}) OR (a = ${y} AND b = ${x})`;
  return { eu: lista.filter((d) => d.vencedor === x).length, ele: lista.filter((d) => d.vencedor === y).length, empates: lista.filter((d) => !d.vencedor).length };
}
