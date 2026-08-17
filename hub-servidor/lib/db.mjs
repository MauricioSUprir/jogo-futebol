import postgres from "postgres";

// Conexão com o Postgres. Em produção, defina DATABASE_URL (ex.: Neon, Railway,
// Supabase). Localmente cai num padrão de desenvolvimento.
let url =
  process.env.DATABASE_URL ||
  "postgres://hub@127.0.0.1:5433/hub";

// Compatibilidade com Postgres gerenciado (Neon/Supabase). O endereço com
// "-pooler" usa PgBouncer, e o driver não faz channel binding — removemos esse
// parâmetro pra evitar erro de conexão.
try {
  const u = new URL(url);
  u.searchParams.delete("channel_binding");
  url = u.toString();
} catch {}

const managed = /neon\.tech|supabase|railway|render|sslmode=require|amazonaws/i.test(url);

export const sql = postgres(url, {
  onnotice: () => {},
  // Necessário com pooler/PgBouncer em transaction mode (ex.: Neon "-pooler").
  prepare: false,
  ssl: managed ? "require" : undefined,
});

// Cria as tabelas se ainda não existirem (idempotente).
export async function ensureSchema() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS members (
      id         text PRIMARY KEY,
      name       text NOT NULL,
      email      text NOT NULL UNIQUE,
      pass_hash  text NOT NULL,
      role       text NOT NULL DEFAULT 'membro',
      emoji      text NOT NULL DEFAULT '🙂',
      color      text NOT NULL DEFAULT '#0f766e',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS settings (
      id          int PRIMARY KEY DEFAULT 1,
      family      text NOT NULL DEFAULT 'Família',
      point_value numeric NOT NULL DEFAULT 0.5
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id         text PRIMARY KEY,
      author_id  text NOT NULL,
      body       text NOT NULL DEFAULT '',
      image      text,
      targets    text[] NOT NULL DEFAULT ARRAY['all']::text[],
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS comments (
      id              text PRIMARY KEY,
      announcement_id text NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      author_id       text NOT NULL,
      body            text NOT NULL,
      created_at      timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS activities (
      id          text PRIMARY KEY,
      title       text NOT NULL,
      points      int  NOT NULL DEFAULT 1,
      assigned_to text,
      adate       date NOT NULL DEFAULT CURRENT_DATE,
      created_by  text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      done        boolean NOT NULL DEFAULT false,
      done_by     text,
      done_at     timestamptz
    );
    CREATE TABLE IF NOT EXISTS point_log (
      id          text PRIMARY KEY,
      member_id   text NOT NULL,
      delta       int  NOT NULL,
      reason      text NOT NULL DEFAULT '',
      by_id       text,
      activity_id text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS menu (
      day    date PRIMARY KEY,
      cafe   text NOT NULL DEFAULT '',
      almoco text NOT NULL DEFAULT '',
      jantar text NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id         text PRIMARY KEY,
      title      text NOT NULL,
      mdate      date NOT NULL,
      mtime      text NOT NULL DEFAULT '',
      place      text NOT NULL DEFAULT '',
      note       text NOT NULL DEFAULT '',
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS shopping (
      id         text PRIMARY KEY,
      name       text NOT NULL,
      qty        text NOT NULL DEFAULT '',
      done       boolean NOT NULL DEFAULT false,
      added_by   text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}
