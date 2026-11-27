// Cria dados de demonstração no Supabase LOCAL: 6 pessoas, um grupo aberto, um grupo já sorteado e um encerrado.
// Uso: node scripts/semente-demo.mjs  → imprime e-mails, senha e ids (JSON) para testes manuais e capturas.
// DEMO_SAIDA=/caminho/arquivo.json grava lá em vez de .demo.json (use com scripts/print.mjs --demo <arquivo>).
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const env = {};
const arq = new URL("../.env.local", import.meta.url);
if (existsSync(arq)) for (const l of readFileSync(arq, "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL_SB, SERV, { auth: { persistSession: false } });
const SENHA = "Demo-amigo-2026";
const sufixo = Date.now().toString(36);
const NOMES = ["Ana Clara", "Bruno Souza", "Carla Dias", "Diego Lima", "Elisa Rocha", "Fábio Nunes"];

async function usuario(nome) {
  const email = `${nome.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}.${sufixo}@demo.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: SENHA, email_confirm: true, user_metadata: { display_name: nome } });
  if (error) throw error;
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: SENHA });
  return { id: data.user.id, email, nome, c };
}
const ok = async (p) => { const { data, error } = await p; if (error) throw new Error(JSON.stringify(error)); return data; };

const pessoas = [];
for (const n of NOMES) pessoas.push(await usuario(n));
const [ana] = pessoas;

async function criar(nome, extra = {}) {
  const id = await ok(ana.c.rpc("create_event", { p_name: nome, p_gift_min: 50, p_gift_max: 120, p_location: "Casa da Ana", p_reveal_at: new Date(Date.now() + 10 * 86400e3).toISOString(), p_rules: "Presente embrulhado e com cartão.", ...extra }));
  const ev = await ok(ana.c.from("events").select("invite_code").eq("id", id).single());
  for (const p of pessoas.slice(1)) await ok(p.c.rpc("join_event", { p_code: ev.invite_code }));
  return { id, codigo: ev.invite_code };
}
for (const p of pessoas) {
  await ok(p.c.from("wishlist_items").insert([
    { title: "Livro de ficção", price_estimate: 60, url: "https://example.com/livro", position: 0 },
    { title: "Caneca térmica", price_estimate: 80, position: 1 },
  ]));
  await ok(p.c.from("gift_preferences").update({ hobbies: ["leitura", "café"], favorite_colors: ["verde"], shirt_size: "M" }).eq("user_id", p.id));
}
const aberto = await criar("Amigo Oculto da Família", { p_theme: "natal" });
const sorteado = await criar("Firma — Fim de Ano", { p_theme: "corporativo" });
const encerrado = await criar("Aniversário da Turma", { p_theme: "aniversario" });

// sorteio pelo serviço do servidor (mesmo fluxo do app): aqui chamamos o banco direto com um sorteio em ciclo aleatório
async function sortear(eventId) {
  const entrada = await ok(admin.rpc("draw_input", { p_event: eventId }));
  const ids = [...entrada.participants].sort(() => Math.random() - 0.5); // só para a demonstração
  const pares = ids.map((g, i) => ({ giver: g, receiver: ids[(i + 1) % ids.length] }));
  await ok(admin.rpc("commit_draw", { p_event: eventId, p_pairs: pares, p_expected_version: entrada.draw_version, p_actor: ana.id }));
}
await sortear(sorteado.id);
await sortear(encerrado.id);
await ok(ana.c.rpc("finish_event", { p_event: encerrado.id }));
await ok(ana.c.from("announcements").insert({ event_id: sorteado.id, title: "Data confirmada!", body: "Nosso encontro será no salão do prédio." }));
await ok(pessoas[1].c.from("chat_messages").insert({ event_id: sorteado.id, body: "Que animação! Já comecei a pensar no presente." }));

const saida = { senha: SENHA, pessoas: pessoas.map((p) => ({ nome: p.nome, email: p.email, id: p.id })), grupos: { aberto, sorteado, encerrado } };
writeFileSync(process.env.DEMO_SAIDA ?? new URL("../.demo.json", import.meta.url), JSON.stringify(saida, null, 2));
console.log(JSON.stringify(saida, null, 2));
