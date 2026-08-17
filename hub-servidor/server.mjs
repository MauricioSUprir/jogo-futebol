import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "./lib/db.mjs";
import { seedIfEmpty } from "./seed.mjs";
import { hashPassword, verifyPassword, makeToken, readToken } from "./lib/auth.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;
const uid = () => crypto.randomUUID();

// Normaliza os campos de perfil vindos do cliente.
function normProfile(b) {
  const photo = b.photo ? String(b.photo).slice(0, 3 * 1024 * 1024) : null;
  const birthday = b.birthday ? String(b.birthday).slice(0, 10) : null;
  const age = (b.age === 0 || b.age) && isFinite(Number(b.age)) ? Math.max(0, Math.min(150, parseInt(b.age, 10))) : null;
  const bio = b.bio ? String(b.bio).slice(0, 500) : null;
  return { photo, birthday, age, bio };
}

/* ---------------- helpers HTTP ---------------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json", ".ico": "image/x-icon" };
function sendJSON(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
function parseCookies(req) {
  const out = {}; const h = req.headers.cookie; if (!h) return out;
  h.split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = ""; let tooBig = false;
    req.on("data", (c) => { data += c; if (data.length > 12 * 1024 * 1024) { tooBig = true; req.destroy(); } });
    req.on("end", () => { if (tooBig) return resolve(null); try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(null); } });
    req.on("error", () => resolve(null));
  });
}
async function currentMember(req) {
  const id = readToken(parseCookies(req).sess);
  if (!id) return null;
  const [m] = await sql`SELECT id,name,email,role,emoji,color FROM members WHERE id=${id} LIMIT 1`;
  return m || null;
}

/* ---------------- carga de dados p/ o cliente ---------------- */
async function buildData(me) {
  const admin = me.role === "admin";
  const [settings] = await sql`SELECT family, point_value FROM settings WHERE id=1`;
  const members = await sql`SELECT id,name,email,role,emoji,color,photo,to_char(birthday,'YYYY-MM-DD') AS birthday,age,bio FROM members ORDER BY created_at`;
  const anns = await sql`SELECT id,author_id,body,image,targets,created_at FROM announcements ORDER BY created_at DESC`;
  const comments = await sql`SELECT id,announcement_id,author_id,body,created_at FROM comments ORDER BY created_at`;
  const activities = await sql`SELECT id,title,points,assigned_to,adate,created_by,created_at,done,done_by,done_at,status,proof FROM activities ORDER BY created_at DESC`;
  const pointLog = await sql`SELECT id,member_id,delta,reason,kind,by_id,activity_id,created_at FROM point_log ORDER BY created_at DESC`;
  const menuRows = await sql`SELECT to_char(day,'YYYY-MM-DD') AS day, cafe, almoco, jantar FROM menu`;
  const meetings = await sql`SELECT id,title,to_char(mdate,'YYYY-MM-DD') AS mdate,mtime,place,note,created_by FROM meetings ORDER BY mdate, mtime`;
  const shopping = await sql`SELECT id,name,qty,done,added_by,created_at FROM shopping ORDER BY created_at`;

  const cmtByAnn = {};
  comments.forEach((c) => { (cmtByAnn[c.announcement_id] ||= []).push({ id: c.id, authorId: c.author_id, text: c.body, createdAt: c.created_at }); });

  const visibleAnns = anns
    .filter((a) => admin || a.targets.includes("all") || a.targets.includes(me.id))
    .map((a) => ({ id: a.id, authorId: a.author_id, text: a.body, image: a.image, targets: a.targets, createdAt: a.created_at, comments: cmtByAnn[a.id] || [] }));

  const menu = {};
  menuRows.forEach((r) => { menu[r.day] = { cafe: r.cafe, almoco: r.almoco, jantar: r.jantar }; });

  // Totais de pontos por membro (visíveis a todos, p/ o placar).
  const points = {};
  pointLog.forEach((p) => { points[p.member_id] = (points[p.member_id] || 0) + p.delta; });

  // Extrato detalhado: membro vê só o seu; admin vê de todos.
  const logOut = pointLog
    .filter((p) => admin || p.member_id === me.id)
    .map((p) => ({ id: p.id, memberId: p.member_id, delta: p.delta, reason: p.reason, kind: p.kind, byId: p.by_id, activityId: p.activity_id, createdAt: p.created_at }));

  const pubMember = (m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, emoji: m.emoji, color: m.color, photo: m.photo || null, birthday: m.birthday || null, age: m.age ?? null, bio: m.bio || null });

  const meFull = members.find((m) => m.id === me.id) || me;
  return {
    family: settings?.family || "Família",
    pointValue: Number(settings?.point_value ?? 0.5),
    me: pubMember(meFull),
    members: members.map(pubMember),
    points,
    announcements: visibleAnns,
    activities: activities.map((a) => ({ id: a.id, title: a.title, points: a.points, assignedTo: a.assigned_to, date: a.adate && a.adate.toISOString ? a.adate.toISOString().slice(0, 10) : a.adate, createdBy: a.created_by, createdAt: a.created_at, done: a.done, doneBy: a.done_by, doneAt: a.done_at, status: a.status || "aberta", proof: (admin || a.done_by === me.id) ? (a.proof || null) : null })),
    pointLog: logOut,
    menu,
    meetings: meetings.map((m) => ({ id: m.id, title: m.title, date: m.mdate, time: m.mtime, place: m.place, note: m.note, createdBy: m.created_by })),
    shopping: shopping.map((s) => ({ id: s.id, name: s.name, qty: s.qty, done: s.done, addedBy: s.added_by, createdAt: s.created_at })),
  };
}

/* ---------------- API ---------------- */
async function handleApi(req, res, url) {
  const seg = url.pathname.replace(/^\/api\//, "").split("/"); // ex.: ["activities","<id>","done"]
  const top = seg[0];
  const method = req.method;

  // login / logout são públicos
  if (top === "login" && method === "POST") {
    const body = await readBody(req); if (!body) return sendJSON(res, 400, { error: "bad" });
    const email = String(body.email || "").toLowerCase().trim();
    const [m] = await sql`SELECT * FROM members WHERE email=${email} LIMIT 1`;
    if (!m || !(await verifyPassword(body.password || "", m.pass_hash))) return sendJSON(res, 401, { error: "credenciais" });
    const cookie = `sess=${makeToken(m.id)}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`;
    return sendJSON(res, 200, { ok: true, me: { id: m.id, name: m.name, role: m.role } }, { "Set-Cookie": cookie });
  }
  if (top === "logout" && method === "POST") {
    return sendJSON(res, 200, { ok: true }, { "Set-Cookie": "sess=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax" });
  }

  // daqui pra baixo exige sessão
  const me = await currentMember(req);
  if (!me) {
    if (top === "data" && method === "GET") return sendJSON(res, 200, { authenticated: false });
    return sendJSON(res, 401, { error: "não autenticado" });
  }
  const admin = me.role === "admin";
  const requireAdmin = () => { if (!admin) { sendJSON(res, 403, { error: "só admin" }); return false; } return true; };

  if (top === "data" && method === "GET") return sendJSON(res, 200, await buildData(me));

  if (top === "announcements") {
    if (method === "POST") {
      if (!requireAdmin()) return;
      const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
      const text = String(b.text || "").trim();
      const image = b.image ? String(b.image).slice(0, 8 * 1024 * 1024) : null;
      let targets = Array.isArray(b.targets) && b.targets.length ? b.targets.map(String) : ["all"];
      if (!text && !image) return sendJSON(res, 400, { error: "vazio" });
      await sql`INSERT INTO announcements (id, author_id, body, image, targets) VALUES (${uid()}, ${me.id}, ${text}, ${image}, ${sql.array(targets)})`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "DELETE" && seg[1]) {
      if (!requireAdmin()) return;
      await sql`DELETE FROM announcements WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
  }

  if (top === "comments") {
    if (method === "POST" && !seg[1]) {
      const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
      const text = String(b.text || "").trim(); if (!text) return sendJSON(res, 400, { error: "vazio" });
      const [a] = await sql`SELECT targets FROM announcements WHERE id=${b.announcementId} LIMIT 1`;
      if (!a) return sendJSON(res, 404, { error: "aviso" });
      if (!(admin || a.targets.includes("all") || a.targets.includes(me.id))) return sendJSON(res, 403, { error: "sem acesso" });
      await sql`INSERT INTO comments (id, announcement_id, author_id, body) VALUES (${uid()}, ${b.announcementId}, ${me.id}, ${text})`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "DELETE" && seg[1]) {
      // autor do comentário ou admin pode apagar
      const [c] = await sql`SELECT author_id FROM comments WHERE id=${seg[1]} LIMIT 1`;
      if (!c) return sendJSON(res, 404, { error: "comentário" });
      if (!admin && c.author_id !== me.id) return sendJSON(res, 403, { error: "sem acesso" });
      await sql`DELETE FROM comments WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
  }

  if (top === "activities") {
    if (method === "POST" && !seg[1]) {
      if (!requireAdmin()) return;
      const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
      const title = String(b.title || "").trim(); const points = Math.max(0, parseInt(b.points, 10) || 0);
      if (!title) return sendJSON(res, 400, { error: "dados" });
      await sql`INSERT INTO activities (id, title, points, assigned_to, adate, created_by)
                VALUES (${uid()}, ${title}, ${points}, ${b.assignedTo || null}, ${b.date || sql`CURRENT_DATE`}, ${me.id})`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "DELETE" && seg[1]) {
      if (!requireAdmin()) return;
      await sql`DELETE FROM point_log WHERE activity_id=${seg[1]}`;
      await sql`DELETE FROM activities WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
    // Filho conclui: envia com FOTO obrigatória -> fica pendente de aprovação.
    if (method === "POST" && seg[1] && seg[2] === "done") {
      const [a] = await sql`SELECT * FROM activities WHERE id=${seg[1]} LIMIT 1`;
      if (!a) return sendJSON(res, 404, { error: "atividade" });
      if (admin) return sendJSON(res, 403, { error: "admin não faz atividade" });
      if (a.assigned_to && a.assigned_to !== me.id) return sendJSON(res, 403, { error: "não é sua" });
      if (a.status && a.status !== "aberta") return sendJSON(res, 409, { error: "já enviada" });
      const b = await readBody(req);
      const proof = b && b.proof ? String(b.proof).slice(0, 8 * 1024 * 1024) : null;
      if (!proof) return sendJSON(res, 400, { error: "imagem obrigatória" });
      await sql`UPDATE activities SET status='pendente', done=false, done_by=${me.id}, done_at=now(), proof=${proof} WHERE id=${a.id}`;
      return sendJSON(res, 200, { ok: true });
    }
    // Admin aprova: agora sim os pontos vão pro filho.
    if (method === "POST" && seg[1] && seg[2] === "approve") {
      if (!requireAdmin()) return;
      const [a] = await sql`SELECT * FROM activities WHERE id=${seg[1]} LIMIT 1`;
      if (!a) return sendJSON(res, 404, { error: "atividade" });
      if (a.status !== "pendente") return sendJSON(res, 409, { error: "não está pendente" });
      await sql`UPDATE activities SET status='aprovada', done=true WHERE id=${a.id}`;
      if (a.points > 0 && a.done_by) {
        await sql`INSERT INTO point_log (id, member_id, delta, reason, kind, by_id, activity_id)
                  VALUES (${uid()}, ${a.done_by}, ${a.points}, ${"Atividade: " + a.title}, ${"atividade"}, ${me.id}, ${a.id})`;
      }
      return sendJSON(res, 200, { ok: true });
    }
    // Admin reprova: anula (sem pontos) e reabre a atividade.
    if (method === "POST" && seg[1] && seg[2] === "reject") {
      if (!requireAdmin()) return;
      const [a] = await sql`SELECT status FROM activities WHERE id=${seg[1]} LIMIT 1`;
      if (!a) return sendJSON(res, 404, { error: "atividade" });
      if (a.status !== "pendente") return sendJSON(res, 409, { error: "não está pendente" });
      await sql`UPDATE activities SET status='aberta', done=false, done_by=null, done_at=null, proof=null WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
    // Admin reabre uma já aprovada: estorna pontos e reabre.
    if (method === "POST" && seg[1] && seg[2] === "reopen") {
      if (!requireAdmin()) return;
      await sql`DELETE FROM point_log WHERE activity_id=${seg[1]}`;
      await sql`UPDATE activities SET status='aberta', done=false, done_by=null, done_at=null, proof=null WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
  }

  if (top === "points") {
    if (method === "POST") {
      if (!requireAdmin()) return;
      const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
      const delta = parseInt(b.delta, 10); if (!b.memberId || !delta) return sendJSON(res, 400, { error: "dados" });
      const [tgt] = await sql`SELECT role FROM members WHERE id=${b.memberId} LIMIT 1`;
      if (!tgt || tgt.role !== "membro") return sendJSON(res, 400, { error: "só membros pontuam" });
      await sql`INSERT INTO point_log (id, member_id, delta, reason, by_id)
                VALUES (${uid()}, ${b.memberId}, ${delta}, ${String(b.reason || "").trim() || "Ajuste do admin"}, ${me.id})`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "DELETE" && seg[1]) {
      if (!requireAdmin()) return;
      await sql`DELETE FROM point_log WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
  }

  if (top === "menu" && method === "PUT") {
    if (!requireAdmin()) return;
    const b = await readBody(req); if (!b || !b.day || !["cafe", "almoco", "jantar"].includes(b.slot)) return sendJSON(res, 400, { error: "dados" });
    const val = String(b.value || "").trim();
    await sql`INSERT INTO menu (day, ${sql(b.slot)}) VALUES (${b.day}, ${val})
              ON CONFLICT (day) DO UPDATE SET ${sql(b.slot)} = ${val}`;
    return sendJSON(res, 200, { ok: true });
  }

  if (top === "meetings") {
    if (method === "POST") {
      if (!requireAdmin()) return;
      const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
      const title = String(b.title || "").trim(); if (!title || !b.date) return sendJSON(res, 400, { error: "dados" });
      await sql`INSERT INTO meetings (id, title, mdate, mtime, place, note, created_by)
                VALUES (${uid()}, ${title}, ${b.date}, ${String(b.time || "")}, ${String(b.place || "").trim()}, ${String(b.note || "").trim()}, ${me.id})`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "DELETE" && seg[1]) {
      if (!requireAdmin()) return;
      await sql`DELETE FROM meetings WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
  }

  if (top === "shopping") {
    if (method === "POST" && seg[1] === "clear-done") {
      await sql`DELETE FROM shopping WHERE done=true`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "POST" && !seg[1]) {
      const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
      const name = String(b.name || "").trim(); if (!name) return sendJSON(res, 400, { error: "dados" });
      await sql`INSERT INTO shopping (id, name, qty, added_by) VALUES (${uid()}, ${name}, ${String(b.qty || "").trim()}, ${me.id})`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "POST" && seg[1] && seg[2] === "toggle") {
      await sql`UPDATE shopping SET done = NOT done WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
    if (method === "DELETE" && seg[1]) {
      await sql`DELETE FROM shopping WHERE id=${seg[1]}`;
      return sendJSON(res, 200, { ok: true });
    }
  }

  if (top === "members" && method === "PUT" && seg[1]) {
    if (!requireAdmin()) return;
    const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
    const name = String(b.name || "").trim(); const email = String(b.email || "").toLowerCase().trim();
    if (!name || !email) return sendJSON(res, 400, { error: "dados" });
    const dup = await sql`SELECT id FROM members WHERE email=${email} AND id<>${seg[1]} LIMIT 1`;
    if (dup.length) return sendJSON(res, 409, { error: "e-mail já usado" });
    const role = b.role === "admin" ? "admin" : "membro";
    const pr = normProfile(b);
    await sql`UPDATE members SET name=${name}, email=${email}, role=${role}, emoji=${String(b.emoji || "🙂")}, color=${String(b.color || "#0f766e")},
              photo=${pr.photo}, birthday=${pr.birthday}, age=${pr.age}, bio=${pr.bio} WHERE id=${seg[1]}`;
    if (b.password) await sql`UPDATE members SET pass_hash=${await hashPassword(b.password)} WHERE id=${seg[1]}`;
    return sendJSON(res, 200, { ok: true });
  }

  if (top === "me" && seg[1] === "password" && method === "PUT") {
    const b = await readBody(req); if (!b || !b.password) return sendJSON(res, 400, { error: "dados" });
    await sql`UPDATE members SET pass_hash=${await hashPassword(b.password)} WHERE id=${me.id}`;
    return sendJSON(res, 200, { ok: true });
  }

  // Cada pessoa edita o próprio perfil (nome, foto, idade, aniversário, sobre).
  if (top === "me" && seg[1] === "profile" && method === "PUT") {
    const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
    const name = String(b.name || "").trim(); if (!name) return sendJSON(res, 400, { error: "nome" });
    const pr = normProfile(b);
    await sql`UPDATE members SET name=${name}, emoji=${String(b.emoji || me.emoji || "🙂")}, color=${String(b.color || me.color || "#0f766e")},
              photo=${pr.photo}, birthday=${pr.birthday}, age=${pr.age}, bio=${pr.bio} WHERE id=${me.id}`;
    return sendJSON(res, 200, { ok: true });
  }

  // Resgatar dinheiro: tira do saldo (só membros têm saldo).
  if (top === "redeem" && method === "POST") {
    if (admin) return sendJSON(res, 403, { error: "admin não tem saldo" });
    const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
    const [{ pv }] = await sql`SELECT point_value AS pv FROM settings WHERE id=1`;
    const value = Number(pv) || 0.5;
    const [{ total }] = await sql`SELECT COALESCE(SUM(delta),0)::int AS total FROM point_log WHERE member_id=${me.id}`;
    const amount = Number(b.amount);
    if (!(amount > 0)) return sendJSON(res, 400, { error: "valor inválido" });
    const pts = Math.floor(amount / value + 1e-9);
    if (pts < 1) return sendJSON(res, 400, { error: "valor abaixo de 1 ponto" });
    if (pts > total) return sendJSON(res, 400, { error: "saldo insuficiente" });
    const reais = pts * value;
    await sql`INSERT INTO point_log (id, member_id, delta, reason, kind, by_id)
              VALUES (${uid()}, ${me.id}, ${-pts}, ${"Resgate de R$ " + reais.toFixed(2).replace(".", ",")}, ${"resgate"}, ${me.id})`;
    return sendJSON(res, 200, { ok: true, pts, reais });
  }

  if (top === "settings" && method === "PUT") {
    if (!requireAdmin()) return;
    const b = await readBody(req); if (!b) return sendJSON(res, 400, { error: "bad" });
    const fam = String(b.family || "").trim(); const pv = Number(b.pointValue);
    if (fam) await sql`UPDATE settings SET family=${fam} WHERE id=1`;
    if (pv >= 0 && isFinite(pv)) await sql`UPDATE settings SET point_value=${pv} WHERE id=1`;
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { error: "rota" });
}

/* ---------------- estáticos ---------------- */
function serveStatic(req, res, url) {
  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.join(PUBLIC, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(full, (err, data) => {
    if (err) {
      // SPA: cai no index pra rotas do cliente
      return fs.readFile(path.join(PUBLIC, "index.html"), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end("not found"); }
        res.writeHead(200, { "Content-Type": MIME[".html"] }); res.end(html);
      });
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600" });
    res.end(data);
  });
}

/* ---------------- servidor ---------------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (url.pathname === "/health") return sendJSON(res, 200, { ok: true });
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { error: "erro interno" });
    else res.end();
  }
});

seedIfEmpty()
  .then((did) => { if (did) console.log("Banco semeado com as 4 contas."); })
  .catch((e) => console.error("Falha ao semear:", e))
  .finally(() => { server.listen(PORT, () => console.log(`Hub da Família no ar em http://localhost:${PORT}`)); });
