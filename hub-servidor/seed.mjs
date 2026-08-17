import crypto from "node:crypto";
import { sql, ensureSchema } from "./lib/db.mjs";

const uid = () => crypto.randomUUID();
function ymd(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const TODAY = ymd(new Date());
function addDays(s, n) { const d = new Date(s); d.setDate(d.getDate() + n); return ymd(d); }

/*
 * As 4 contas da família. As senhas ficam apenas como HASH bcrypt (o texto puro
 * nunca entra no repositório). Um admin pode trocar qualquer senha depois, dentro
 * do app, em ⚙️ Contas. Senhas iniciais combinadas com a família.
 */
const ACCOUNTS = [
  { name: "Maurício",   email: "mauricio@gruposuprir.com",             role: "admin",  emoji: "👨", color: "#2563eb", hash: "$2a$10$kxvh2rRJUcACp45gGqTrGuBd6m6CEIezOclEOIWytEr3jd/QX/8Y2" },
  { name: "Thaís",      email: "tha.fdr@gmail.com",                    role: "admin",  emoji: "👩", color: "#db2777", hash: "$2a$10$0St//nt7vuYoz/lmM4j.veMNpCkdDb3yAI7yLZfrJMyB3cvvzMk.a" },
  { name: "Anna Luisa", email: "diasrodriguesannaluisa@gmail.com",     role: "membro", emoji: "👧", color: "#e0592b", hash: "$2a$10$4EDkGGr4KnMTW4AJwb9IG.JXENEAmeE7SlM0ahO85X7zhJgIrWuka" },
  { name: "Guilherme",  email: "gui.drodrigues21@gmail.com",           role: "membro", emoji: "👦", color: "#7c3aed", hash: "$2a$10$es7r/HQYD4D37a/Guqjti.ap5h/Ahv6cec.3bAEsiNtA2.qPijDZi" },
];

export async function seedIfEmpty() {
  await ensureSchema();
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM members`;
  if (count > 0) return false;

  const ids = {};
  for (const a of ACCOUNTS) {
    const id = uid();
    ids[a.email] = id;
    await sql`INSERT INTO members (id, name, email, pass_hash, role, emoji, color)
              VALUES (${id}, ${a.name}, ${a.email.toLowerCase()}, ${a.hash}, ${a.role}, ${a.emoji}, ${a.color})`;
  }
  const tha = ids["tha.fdr@gmail.com"], mau = ids["mauricio@gruposuprir.com"];

  await sql`INSERT INTO settings (id, family, point_value) VALUES (1, ${"Família Rodrigues"}, ${0.5})
            ON CONFLICT (id) DO NOTHING`;

  await sql`INSERT INTO announcements (id, author_id, body, targets)
            VALUES (${uid()}, ${tha}, ${"Bem-vindos ao nosso Hub da Família! 💛 Aqui os avisos, o cardápio e as atividades ficam num lugar só."}, ${sql.array(["all"])})`;

  await sql`INSERT INTO activities (id, title, points, assigned_to, adate, created_by)
            VALUES (${uid()}, ${"Arrumar a cama"}, ${5}, ${null}, ${TODAY}, ${mau})`;
  await sql`INSERT INTO activities (id, title, points, assigned_to, adate, created_by)
            VALUES (${uid()}, ${"Ajudar a lavar a louça"}, ${10}, ${null}, ${TODAY}, ${tha})`;

  await sql`INSERT INTO menu (day, cafe, almoco, jantar)
            VALUES (${TODAY}, ${"Café, pão e frutas"}, ${"Arroz, feijão, frango e salada"}, ${"Sopa"})
            ON CONFLICT (day) DO NOTHING`;

  const dow = new Date(TODAY).getDay();
  const toSunday = (7 - dow) % 7 || 7;
  await sql`INSERT INTO meetings (id, title, mdate, mtime, place, note, created_by)
            VALUES (${uid()}, ${"Almoço em família"}, ${addDays(TODAY, toSunday)}, ${"12:30"}, ${"Casa"}, ${"Todo mundo presente 🙂"}, ${tha})`;

  return true;
}

// Execução direta: node seed.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty()
    .then((did) => { console.log(did ? "Seed criado (4 contas + exemplos)." : "Já havia dados — nada a semear."); return sql.end(); })
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
