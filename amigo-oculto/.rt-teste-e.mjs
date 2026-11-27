import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = {}; for (const l of readFileSync(".env.local","utf8").split("\n")) { const m=/^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]]=m[2]; }
const demo = JSON.parse(readFileSync("/tmp/claude-0/demo-e.json","utf8"));
const G = demo.grupos.encerrado.id;
const b = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
await b.auth.signInWithPassword({ email: demo.pessoas[1].email, password: demo.senha });
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sa } = await a.auth.signInWithPassword({ email: demo.pessoas[0].email, password: demo.senha });
const eventos = [];
await new Promise((ok) => b.channel("t").on("postgres_changes", { event: "*", schema: "public", table: "album_photos" }, (p) => eventos.push(["sem filtro", p.eventType, p.old, p.new?.id]))
  .on("postgres_changes", { event: "*", schema: "public", table: "album_photos", filter: `event_id=eq.${G}` }, (p) => eventos.push(["filtro", p.eventType, p.old, p.new?.id])).subscribe((s) => s === "SUBSCRIBED" && ok()));
const path = `${G}/${sa.user.id}/rt-${Date.now()}.webp`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const ins = await a.from("album_photos").insert({ event_id: G, storage_path: path, width: 1, height: 1 }).select("id").single();
await new Promise((r) => setTimeout(r, 2000));
await a.from("album_photos").delete().eq("id", ins.data.id);
await new Promise((r) => setTimeout(r, 2500));
console.log(JSON.stringify(eventos, null, 1));
process.exit(0);
