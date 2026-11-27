-- =====================================================================================================================
-- Amigo Oculto — base: perfis, configurações, eventos, participantes, restrições, sorteio, linha do tempo,
-- notificações, push e convites.
--
-- Regras de segurança que valem em TODAS as migrações:
--   * Toda tabela tem RLS ligado e permissões explícitas (revoke all + grant só do necessário).
--   * Escritas sensíveis passam por funções SECURITY DEFINER com search_path vazio e checagens explícitas.
--   * O resultado do sorteio (assignments) NÃO tem permissão nenhuma para anon/authenticated: só sai por funções que
--     devolvem ao participante o SEU próprio resultado. Nem o administrador do grupo vê os pares.
--   * O sorteio só é gravado por commit_draw, executável apenas pelo service_role (servidor), que valida a
--     permutação inteira (ninguém tira a si mesmo, cada um dá e recebe exatamente uma vez, restrições respeitadas).
-- =====================================================================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------------------------------------------------
create type public.event_status as enum ('open', 'drawn', 'finished');
create type public.participant_status as enum ('pending', 'approved', 'rejected');
create type public.participant_role as enum ('admin', 'member');
create type public.event_theme as enum ('natal', 'aniversario', 'classico', 'corporativo');
create type public.draw_mode as enum ('manual', 'scheduled');
create type public.event_visibility as enum ('private', 'public');
create type public.rsvp_status as enum ('yes', 'no', 'maybe');

-- ---------------------------------------------------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Erro com código estável (o app traduz para português em src/lib/erros.ts).
create or replace function public.fail(p_code text) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_code;
end $$;

-- Código de convite: 8 caracteres sem os ambíguos (0/O, 1/I/L), aleatoriedade criptográfica.
create or replace function public.generate_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(8);
  r text := '';
begin
  for i in 0..7 loop
    r := r || substr(alfabeto, (get_byte(b, i) % length(alfabeto)) + 1, 1);
  end loop;
  return r;
end $$;

-- Inteiro aleatório criptográfico em [0, n) (rejeição para não enviesar).
create or replace function public.secure_random_int(n int) returns int
language plpgsql volatile set search_path = '' as $$
declare
  limite bigint;
  b bytea;
  v bigint;
begin
  if n is null or n <= 0 then
    perform public.fail('invalid_range');
  end if;
  limite := (4294967296 / n) * n;
  loop
    b := extensions.gen_random_bytes(4);
    v := (get_byte(b, 0)::bigint << 24) | (get_byte(b, 1)::bigint << 16) | (get_byte(b, 2)::bigint << 8) | get_byte(b, 3)::bigint;
    exit when v < limite;
  end loop;
  return (v % n)::int;
end $$;

create or replace function public.is_anonymous_user() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Perfis e configurações
-- ---------------------------------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Convidado' check (char_length(btrim(display_name)) between 1 and 60),
  nickname text check (nickname is null or char_length(nickname) <= 40),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 500),
  bio text check (bio is null or char_length(bio) <= 280),
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  sound_effects boolean not null default true,
  vibration boolean not null default true,
  reduce_motion boolean not null default false,
  color_mode text not null default 'system' check (color_mode in ('system', 'light', 'dark')),
  updated_at timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 3 and 80),
  description text check (description is null or char_length(description) <= 2000),
  cover_path text check (cover_path is null or char_length(cover_path) <= 500),
  theme public.event_theme not null default 'natal',
  reveal_at timestamptz,
  location text check (location is null or char_length(location) <= 200),
  gift_min numeric(10, 2) check (gift_min is null or gift_min >= 0),
  gift_max numeric(10, 2) check (gift_max is null or gift_max >= 0),
  max_participants int check (max_participants is null or max_participants between 3 and 1000),
  rules text check (rules is null or char_length(rules) <= 4000),
  join_deadline timestamptz,
  draw_at timestamptz,
  draw_mode public.draw_mode not null default 'manual',
  visibility public.event_visibility not null default 'private',
  requires_approval boolean not null default false,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  status public.event_status not null default 'open',
  draw_version int not null default 0,
  drawn_at timestamptz,
  finished_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_gift_range check (gift_min is null or gift_max is null or gift_min <= gift_max),
  constraint events_scheduled_needs_date check (draw_mode = 'manual' or draw_at is not null)
);
create index events_owner_idx on public.events (owner_id);
create index events_due_draw_idx on public.events (draw_at) where draw_mode = 'scheduled' and status = 'open';
create index events_public_idx on public.events (created_at desc) where visibility = 'public' and archived_at is null;
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------------
-- Participantes
-- ---------------------------------------------------------------------------------------------------------------------
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.participant_role not null default 'member',
  status public.participant_status not null default 'approved',
  rsvp public.rsvp_status,
  gift_bought boolean not null default false,
  gift_bought_at timestamptz,
  allow_public_reveal boolean not null default false,
  result_viewed_at timestamptz,
  muted_until timestamptz,
  join_message text check (join_message is null or char_length(join_message) <= 300),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (event_id, user_id)
);
create index participants_user_idx on public.participants (user_id);
create index participants_event_status_idx on public.participants (event_id, status);

-- Funções de acesso (SECURITY DEFINER para não cair em recursão de RLS em participants).
create or replace function public.is_event_member(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.event_id = p_event and p.user_id = (select auth.uid()) and p.status = 'approved'
  );
$$;

create or replace function public.is_event_admin(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.event_id = p_event and p.user_id = (select auth.uid()) and p.status = 'approved' and p.role = 'admin'
  );
$$;

create or replace function public.is_event_participant_any(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.event_id = p_event and p.user_id = (select auth.uid()) and p.status in ('approved', 'pending')
  );
$$;

create or replace function public.my_participant_id(p_event uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.participants p
  where p.event_id = p_event and p.user_id = (select auth.uid()) and p.status = 'approved';
$$;

-- Os dois estão aprovados num mesmo evento, ou eu sou administrador de um evento em que o outro pediu para entrar.
create or replace function public.shares_event_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.participants eu
    join public.participants outro on outro.event_id = eu.event_id
    where eu.user_id = (select auth.uid()) and outro.user_id = p_user and eu.status = 'approved'
      and (outro.status = 'approved' or eu.role = 'admin')
  );
$$;

create or replace function public.event_is_open(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event and e.status = 'open' and e.archived_at is null);
$$;

-- gift_bought_at acompanha gift_bought.
create or replace function public.participants_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.gift_bought is distinct from old.gift_bought then
    new.gift_bought_at := case when new.gift_bought then now() else null end;
  end if;
  return new;
end $$;
create trigger participants_before_update before update on public.participants
  for each row execute function public.participants_before_update();

-- ---------------------------------------------------------------------------------------------------------------------
-- Restrições ("A não pode tirar B"; mutual = nem B tira A)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.restrictions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  giver_id uuid not null references public.participants (id) on delete cascade,
  receiver_id uuid not null references public.participants (id) on delete cascade,
  mutual boolean not null default true,
  note text check (note is null or char_length(note) <= 120),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (giver_id <> receiver_id),
  unique (event_id, giver_id, receiver_id)
);
create index restrictions_event_idx on public.restrictions (event_id);

create or replace function public.restrictions_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.participants where id = new.giver_id and event_id = new.event_id)
     or not exists (select 1 from public.participants where id = new.receiver_id and event_id = new.event_id) then
    perform public.fail('restriction_other_event');
  end if;
  if not public.event_is_open(new.event_id) then
    perform public.fail('locked_after_draw');
  end if;
  return new;
end $$;
create trigger restrictions_check before insert or update on public.restrictions
  for each row execute function public.restrictions_check();

-- Apagar restrição depois do sorteio: barrado pela política de RLS (só com o evento aberto).

-- ---------------------------------------------------------------------------------------------------------------------
-- Sorteio
-- ---------------------------------------------------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  draw_version int not null,
  giver_id uuid not null references public.participants (id) on delete cascade,
  receiver_id uuid not null references public.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  receiver_blocked_messages boolean not null default false,
  giver_muted_by_admin boolean not null default false,
  check (giver_id <> receiver_id),
  unique (event_id, giver_id),
  unique (event_id, receiver_id)
);
create index assignments_receiver_idx on public.assignments (receiver_id);

create table public.draw_log (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  version int not null,
  kind text not null check (kind in ('draw', 'redraw')),
  performed_by uuid references public.profiles (id) on delete set null,
  scheduled boolean not null default false,
  participant_count int not null,
  reason text check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
create index draw_log_event_idx on public.draw_log (event_id, created_at desc);

-- Linha do tempo do evento (nunca guarda nada que revele o sorteio).
create table public.event_log (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index event_log_event_idx on public.event_log (event_id, created_at desc);

create or replace function public.log_event(p_event uuid, p_kind text, p_data jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.event_log (event_id, kind, actor_id, data) values (p_event, p_kind, (select auth.uid()), coalesce(p_data, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Notificações (internas; o servidor entrega por e-mail e push conforme as preferências)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) <= 140),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or (char_length(link) <= 300 and link like '/%')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  push_status text not null default 'pending' check (push_status in ('pending', 'sending', 'sent', 'skipped', 'failed'))
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (created_at)
  where email_status = 'pending' or push_status = 'pending';

-- Funções internas (sem EXECUTE para os clientes; ver o fim do arquivo).
create or replace function public.notify(
  p_user uuid, p_event uuid, p_kind text, p_title text, p_body text default null, p_link text default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, event_id, kind, title, body, link)
  values (p_user, p_event, p_kind, left(p_title, 140), left(p_body, 500), p_link);
$$;

create or replace function public.notify_members(
  p_event uuid, p_kind text, p_title text, p_body text default null, p_link text default null,
  p_except uuid default null, p_only_admins boolean default false
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  insert into public.notifications (user_id, event_id, kind, title, body, link)
  select p.user_id, p_event, p_kind, left(p_title, 140), left(p_body, 500), p_link
  from public.participants p
  where p.event_id = p_event and p.status = 'approved'
    and (p_except is null or p.user_id <> p_except)
    and (not p_only_admins or p.role = 'admin');
  get diagnostics n = row_count;
  return n;
end $$;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- Convites por e-mail
-- ---------------------------------------------------------------------------------------------------------------------
create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create unique index event_invites_unique on public.event_invites (event_id, lower(email));

-- Lembretes já enviados (o cron e o botão do administrador não repetem o mesmo lembrete).
create table public.reminder_log (
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null,
  target text not null default '*',
  sent_at timestamptz not null default now(),
  primary key (event_id, kind, target)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Usuário novo → perfil, configurações (e preferências de presente, criadas na migração de conteúdo)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nome text;
begin
  nome := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Convidado'
  );
  insert into public.profiles (id, display_name, avatar_path, is_guest)
  values (
    new.id,
    left(nome, 60),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), 500), ''),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set is_guest = coalesce(new.is_anonymous, false)
  where id = new.id and is_guest is distinct from coalesce(new.is_anonymous, false);
  return new;
end $$;
create trigger on_auth_user_updated after update of is_anonymous on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.restrictions enable row level security;
alter table public.assignments enable row level security;
alter table public.draw_log enable row level security;
alter table public.event_log enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.event_invites enable row level security;
alter table public.reminder_log enable row level security;

revoke all on public.profiles, public.user_settings, public.events, public.participants, public.restrictions,
  public.assignments, public.draw_log, public.event_log, public.notifications, public.push_subscriptions,
  public.event_invites, public.reminder_log from anon, authenticated;

-- perfis
grant select on public.profiles to authenticated;
grant update (display_name, nickname, avatar_path, bio) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_event_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- configurações: só o próprio
grant select, insert, update on public.user_settings to authenticated;
create policy user_settings_all on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- eventos: participantes (também pendentes) e grupos públicos; edição só de administradores e só nas colunas livres
grant select on public.events to authenticated;
grant update (name, description, cover_path, theme, reveal_at, location, gift_min, gift_max, max_participants, rules,
  join_deadline, draw_at, draw_mode, visibility, requires_approval) on public.events to authenticated;
create policy events_select on public.events for select to authenticated
  using (public.is_event_participant_any(id) or (visibility = 'public' and archived_at is null));
create policy events_update on public.events for update to authenticated
  using (public.is_event_admin(id)) with check (public.is_event_admin(id));

-- participantes
grant select on public.participants to authenticated;
grant update (rsvp, gift_bought, allow_public_reveal) on public.participants to authenticated;
create policy participants_select on public.participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or (status = 'approved' and public.is_event_member(event_id))
    or public.is_event_admin(event_id)
  );
create policy participants_update_own on public.participants for update to authenticated
  using (user_id = (select auth.uid()) and status = 'approved')
  with check (user_id = (select auth.uid()) and status = 'approved');

-- restrições: só administradores (podem ser sensíveis, ex.: casais)
grant select, insert, delete on public.restrictions to authenticated;
create policy restrictions_select on public.restrictions for select to authenticated using (public.is_event_admin(event_id));
create policy restrictions_insert on public.restrictions for insert to authenticated
  with check (public.is_event_admin(event_id) and public.event_is_open(event_id));
create policy restrictions_delete on public.restrictions for delete to authenticated
  using (public.is_event_admin(event_id) and public.event_is_open(event_id));

-- assignments: NENHUMA permissão para os clientes (nem select). Só pelas funções do sorteio.

-- histórico do sorteio e linha do tempo: membros
grant select on public.draw_log, public.event_log to authenticated;
create policy draw_log_select on public.draw_log for select to authenticated using (public.is_event_member(event_id));
create policy event_log_select on public.event_log for select to authenticated using (public.is_event_member(event_id));

-- notificações: as próprias (marcar como lida e apagar)
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- inscrições de push: as próprias
grant select, insert, delete on public.push_subscriptions to authenticated;
create policy push_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- convites: administradores; quem foi convidado vê os seus (pelo e-mail da sessão)
grant select, insert, update (revoked_at) on public.event_invites to authenticated;
create policy invites_select on public.event_invites for select to authenticated
  using (public.is_event_admin(event_id) or (lower(email) = lower((select auth.jwt()) ->> 'email') and revoked_at is null));
create policy invites_insert on public.event_invites for insert to authenticated
  with check (public.is_event_admin(event_id) and invited_by = (select auth.uid()));
create policy invites_update on public.event_invites for update to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- reminder_log: só o servidor

-- Funções internas: ninguém de fora executa.
revoke execute on function public.notify(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_members(uuid, text, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.log_event(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_updated() from public, anon, authenticated;
revoke execute on function public.generate_invite_code() from public, anon, authenticated;
revoke execute on function public.secure_random_int(int) from public, anon, authenticated;
revoke execute on function public.restrictions_check() from public, anon, authenticated;
