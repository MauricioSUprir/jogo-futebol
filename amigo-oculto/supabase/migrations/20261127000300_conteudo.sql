-- =====================================================================================================================
-- Amigo Oculto — conteúdo: lista de desejos, preferências, avisos, chat, enquetes, mensagens anônimas e denúncias.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- Lista de desejos (por pessoa; aparece para quem divide um grupo com ela)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 500),
  url text check (url is null or (url ~* '^https?://' and char_length(url) <= 1000)),
  image_path text check (image_path is null or char_length(image_path) <= 500),
  price_estimate numeric(10, 2) check (price_estimate is null or price_estimate >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wishlist_items_user_idx on public.wishlist_items (user_id, position);
create trigger wishlist_items_updated_at before update on public.wishlist_items for each row execute function public.set_updated_at();

create or replace function public.wishlist_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.wishlist_items where user_id = new.user_id) >= 50 then
    perform public.fail('wishlist_full');
  end if;
  return new;
end $$;
create trigger wishlist_items_limit before insert on public.wishlist_items for each row execute function public.wishlist_limit();

create table public.gift_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  hobbies text[] not null default '{}' check (cardinality(hobbies) <= 20),
  interests text[] not null default '{}' check (cardinality(interests) <= 20),
  favorite_colors text[] not null default '{}' check (cardinality(favorite_colors) <= 10),
  shirt_size text check (shirt_size is null or char_length(shirt_size) <= 10),
  pants_size text check (pants_size is null or char_length(pants_size) <= 10),
  shoe_size text check (shoe_size is null or char_length(shoe_size) <= 10),
  dislikes text[] not null default '{}' check (cardinality(dislikes) <= 20),
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_at timestamptz not null default now()
);
create trigger gift_preferences_updated_at before update on public.gift_preferences for each row execute function public.set_updated_at();

-- todo usuário novo ganha a linha de preferências
create or replace function public.handle_new_user_prefs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gift_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger profiles_create_prefs after insert on public.profiles for each row execute function public.handle_new_user_prefs();

-- ---------------------------------------------------------------------------------------------------------------------
-- Mural de avisos (administradores)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text check (body is null or char_length(body) <= 2000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_event_idx on public.announcements (event_id, created_at desc);
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();

create or replace function public.announcements_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nome text;
begin
  select name into nome from public.events where id = new.event_id;
  perform public.notify_members(new.event_id, 'announcement', 'Novo aviso em ' || nome, new.title,
    '/grupo/' || new.event_id, new.author_id);
  perform public.log_event(new.event_id, 'announcement', jsonb_build_object('titulo', new.title));
  return new;
end $$;
create trigger announcements_after_insert after insert on public.announcements
  for each row execute function public.announcements_after_insert();

-- ---------------------------------------------------------------------------------------------------------------------
-- Chat coletivo
-- ---------------------------------------------------------------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  check (deleted_at is not null or char_length(btrim(body)) between 1 and 1000)
);
create index chat_messages_event_idx on public.chat_messages (event_id, created_at desc);

create or replace function public.can_chat(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p join public.events e on e.id = p.event_id
    where p.event_id = p_event and p.user_id = (select auth.uid()) and p.status = 'approved'
      and (p.muted_until is null or p.muted_until < now()) and e.archived_at is null
  );
$$;

create or replace function public.chat_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.chat_messages
      where user_id = new.user_id and event_id = new.event_id and created_at > now() - interval '1 minute') >= 20 then
    perform public.fail('rate_limited');
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  new.deleted_at := null;
  new.deleted_by := null;
  return new;
end $$;
create trigger chat_messages_rate before insert on public.chat_messages for each row execute function public.chat_rate_limit();

create or replace function public.delete_chat_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_message;
  if not found then perform public.fail('not_found'); end if;
  if m.user_id <> auth.uid() and not public.is_event_admin(m.event_id) then perform public.fail('forbidden'); end if;
  update public.chat_messages set body = '', deleted_at = now(), deleted_by = auth.uid() where id = p_message;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Enquetes (gerais e sobre presentes)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  question text not null check (char_length(btrim(question)) between 3 and 200),
  category text not null default 'geral' check (category in ('geral', 'presente')),
  allow_multiple boolean not null default false,
  closes_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index polls_event_idx on public.polls (event_id, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 100),
  position int not null default 0
);
create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);
create index poll_votes_poll_idx on public.poll_votes (poll_id);

create or replace function public.create_poll(
  p_event uuid, p_question text, p_options text[], p_multiple boolean default false,
  p_closes_at timestamptz default null, p_category text default 'geral'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  novo uuid;
  op text;
  i int := 0;
begin
  if not public.can_chat(p_event) then perform public.fail('forbidden'); end if;
  if cardinality(p_options) < 2 or cardinality(p_options) > 8 then perform public.fail('poll_options'); end if;
  if (select count(*) from public.polls where event_id = p_event and created_by = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    perform public.fail('rate_limited');
  end if;
  insert into public.polls (event_id, question, allow_multiple, closes_at, category)
  values (p_event, btrim(p_question), coalesce(p_multiple, false), p_closes_at, coalesce(p_category, 'geral'))
  returning id into novo;
  foreach op in array p_options loop
    if char_length(btrim(op)) > 0 then
      insert into public.poll_options (poll_id, label, position) values (novo, btrim(op), i);
      i := i + 1;
    end if;
  end loop;
  if i < 2 then perform public.fail('poll_options'); end if;
  perform public.log_event(p_event, 'poll', jsonb_build_object('pergunta', btrim(p_question)));
  return novo;
end $$;

create or replace function public.vote_poll(p_poll uuid, p_options uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  po public.polls;
begin
  select * into po from public.polls where id = p_poll;
  if not found then perform public.fail('not_found'); end if;
  if not public.is_event_member(po.event_id) then perform public.fail('forbidden'); end if;
  if po.closed_at is not null or (po.closes_at is not null and po.closes_at <= now()) then perform public.fail('poll_closed'); end if;
  if not po.allow_multiple and cardinality(p_options) > 1 then perform public.fail('poll_single'); end if;
  if exists (select 1 from unnest(p_options) o where not exists (select 1 from public.poll_options x where x.id = o and x.poll_id = p_poll)) then
    perform public.fail('poll_options');
  end if;
  delete from public.poll_votes where poll_id = p_poll and user_id = auth.uid();
  insert into public.poll_votes (poll_id, option_id, user_id)
  select p_poll, o, auth.uid() from (select distinct unnest(p_options) as o) s;
end $$;

create or replace function public.close_poll(p_poll uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  po public.polls;
begin
  select * into po from public.polls where id = p_poll;
  if not found then perform public.fail('not_found'); end if;
  if po.created_by <> auth.uid() and not public.is_event_admin(po.event_id) then perform public.fail('forbidden'); end if;
  update public.polls set closed_at = now() where id = p_poll;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Mensagens anônimas entre quem tirou e quem foi tirado.
-- A tabela não tem permissão nenhuma para os clientes: tudo passa pelas funções abaixo, que NUNCA devolvem quem
-- tirou para quem foi tirado (nem o id do par).
-- ---------------------------------------------------------------------------------------------------------------------
create table public.secret_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  from_role text not null check (from_role in ('giver', 'receiver')),
  kind text not null default 'message' check (kind in ('message', 'question', 'clue', 'gift_info')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  hidden_at timestamptz
);
create index secret_messages_assignment_idx on public.secret_messages (assignment_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('chat', 'secret', 'wall', 'photo')),
  target_id uuid not null,
  reporter_id uuid references public.profiles (id) on delete set null default auth.uid(),
  reason text check (reason is null or char_length(reason) <= 300),
  snapshot text check (snapshot is null or char_length(snapshot) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution text check (resolution is null or resolution in ('dismissed', 'deleted', 'muted'))
);
create index reports_event_idx on public.reports (event_id, created_at desc);

-- O meu par como quem tirou e como quem foi tirado (internos; linha toda nula quando não há).
create or replace function public._my_giver_assignment(p_event uuid) returns public.assignments
language plpgsql stable security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  r public.assignments;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  select * into r from public.assignments where event_id = p_event and giver_id = eu;
  return r;
end $$;

create or replace function public._my_receiver_assignment(p_event uuid) returns public.assignments
language plpgsql stable security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  r public.assignments;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  select * into r from public.assignments where event_id = p_event and receiver_id = eu;
  return r;
end $$;

create or replace function public.secret_threads(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  dador public.assignments;
  recebedor public.assignments;
  status_evento public.event_status;
  nome_recebedor text;
begin
  select status into status_evento from public.events where id = p_event;
  dador := public._my_giver_assignment(p_event);
  recebedor := public._my_receiver_assignment(p_event);
  if status_evento = 'open' or dador.id is null then
    return jsonb_build_object('available', false);
  end if;
  select pr.display_name into nome_recebedor
  from public.participants p join public.profiles pr on pr.id = p.user_id where p.id = dador.receiver_id;
  return jsonb_build_object(
    'available', true,
    -- conversa com quem EU tirei (eu sou anônimo para ele)
    'with_receiver', jsonb_build_object(
      'receiver_participant_id', dador.receiver_id,
      'receiver_name', nome_recebedor,
      'blocked', dador.receiver_blocked_messages or dador.giver_muted_by_admin,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.from_role = 'giver', 'kind', m.kind,
          'body', case when m.hidden_at is null then m.body else null end, 'hidden', m.hidden_at is not null,
          'created_at', m.created_at, 'read_at', m.read_at) order by m.created_at)
        from public.secret_messages m where m.assignment_id = dador.id), '[]'::jsonb)
    ),
    -- conversa com quem ME tirou (anônimo: só o papel, nunca a pessoa)
    'with_santa', case when recebedor.id is null then null else jsonb_build_object(
      'blocked', recebedor.receiver_blocked_messages,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.from_role = 'receiver', 'kind', m.kind,
          'body', case when m.hidden_at is null then m.body else null end, 'hidden', m.hidden_at is not null,
          'created_at', m.created_at, 'read_at', m.read_at) order by m.created_at)
        from public.secret_messages m where m.assignment_id = recebedor.id), '[]'::jsonb)
    ) end
  );
end $$;

create or replace function public.send_secret_message(p_event uuid, p_to text, p_kind text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  dador public.assignments;
  recebedor public.assignments;
  alvo public.assignments;
  papel text;
  destino uuid;
  nome_evento text;
  novo uuid;
  status_evento public.event_status;
begin
  if p_to not in ('receiver', 'santa') then perform public.fail('invalid_target'); end if;
  if coalesce(p_kind, 'message') not in ('message', 'question', 'clue', 'gift_info') then perform public.fail('invalid_kind'); end if;
  select status, name into status_evento, nome_evento from public.events where id = p_event;
  if status_evento = 'open' then perform public.fail('not_drawn'); end if;
  dador := public._my_giver_assignment(p_event);
  recebedor := public._my_receiver_assignment(p_event);
  if p_to = 'receiver' then
    alvo := dador; papel := 'giver';
    if alvo.id is null then perform public.fail('not_drawn'); end if;
    if alvo.receiver_blocked_messages or alvo.giver_muted_by_admin then perform public.fail('secret_blocked'); end if;
    select user_id into destino from public.participants where id = alvo.receiver_id;
  else
    alvo := recebedor; papel := 'receiver';
    if alvo.id is null then perform public.fail('not_drawn'); end if;
    if alvo.receiver_blocked_messages then perform public.fail('secret_blocked'); end if;
    select user_id into destino from public.participants where id = alvo.giver_id;
  end if;
  if (select count(*) from public.secret_messages
      where assignment_id = alvo.id and from_role = papel and created_at > now() - interval '1 hour') >= 30 then
    perform public.fail('rate_limited');
  end if;
  insert into public.secret_messages (event_id, assignment_id, from_role, kind, body)
  values (p_event, alvo.id, papel, coalesce(p_kind, 'message'), btrim(p_body))
  returning id into novo;
  if papel = 'giver' then
    perform public.notify(destino, p_event, 'secret_message',
      case p_kind when 'clue' then 'Nova pista do seu amigo oculto' when 'question' then 'Seu amigo oculto te fez uma pergunta'
                  else 'Mensagem anônima do seu amigo oculto' end,
      'Em ' || nome_evento || '. Toque para ler.', '/grupo/' || p_event || '/mensagens');
  else
    perform public.notify(destino, p_event, 'secret_message', 'Quem você tirou respondeu',
      'Em ' || nome_evento || '. Toque para ler.', '/grupo/' || p_event || '/mensagens');
  end if;
  return novo;
end $$;

create or replace function public.mark_secret_read(p_event uuid, p_side text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  dador public.assignments;
  recebedor public.assignments;
begin
  dador := public._my_giver_assignment(p_event);
  recebedor := public._my_receiver_assignment(p_event);
  if p_side = 'receiver' and dador.id is not null then
    update public.secret_messages set read_at = now() where assignment_id = dador.id and from_role = 'receiver' and read_at is null;
  elsif p_side = 'santa' and recebedor.id is not null then
    update public.secret_messages set read_at = now() where assignment_id = recebedor.id and from_role = 'giver' and read_at is null;
  end if;
end $$;

-- Quem foi tirado bloqueia (ou desbloqueia) as mensagens do seu amigo oculto.
create or replace function public.block_secret_santa(p_event uuid, p_block boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  dador public.assignments;
  recebedor public.assignments;
begin
  dador := public._my_giver_assignment(p_event);
  recebedor := public._my_receiver_assignment(p_event);
  if recebedor.id is null then perform public.fail('not_drawn'); end if;
  update public.assignments set receiver_blocked_messages = coalesce(p_block, true) where id = recebedor.id;
end $$;

-- Denúncia de mensagem anônima: só quem RECEBEU a mensagem; a mensagem some para ele; o administrador vê o texto,
-- nunca quem mandou.
create or replace function public.report_secret_message(p_message uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.secret_messages;
  a public.assignments;
  eu uuid;
begin
  select * into m from public.secret_messages where id = p_message;
  if not found then perform public.fail('not_found'); end if;
  select * into a from public.assignments where id = m.assignment_id;
  eu := public.my_participant_id(m.event_id);
  if eu is null or (m.from_role = 'giver' and a.receiver_id <> eu) or (m.from_role = 'receiver' and a.giver_id <> eu) then
    perform public.fail('forbidden');
  end if;
  update public.secret_messages set hidden_at = now() where id = p_message;
  insert into public.reports (event_id, kind, target_id, reason, snapshot)
  values (m.event_id, 'secret', m.id, nullif(left(btrim(p_reason), 300), ''), left(m.body, 1000));
  perform public.notify_members(m.event_id, 'report', 'Uma mensagem anônima foi denunciada',
    'Veja no painel do organizador.', '/grupo/' || m.event_id || '/admin', auth.uid(), true);
end $$;

-- Denúncia de conteúdo público (chat, mural, foto)
create or replace function public.report_content(p_kind text, p_target uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ev uuid;
  texto text;
begin
  if p_kind = 'chat' then
    select event_id, body into ev, texto from public.chat_messages where id = p_target;
  elsif p_kind = 'wall' then
    select event_id, body into ev, texto from public.wall_posts where id = p_target;
  elsif p_kind = 'photo' then
    select event_id, caption into ev, texto from public.album_photos where id = p_target;
  else
    perform public.fail('invalid_kind');
  end if;
  if ev is null or not public.is_event_member(ev) then perform public.fail('forbidden'); end if;
  if exists (select 1 from public.reports where target_id = p_target and reporter_id = auth.uid() and resolved_at is null) then
    return;
  end if;
  insert into public.reports (event_id, kind, target_id, reason, snapshot)
  values (ev, p_kind, p_target, nullif(left(btrim(p_reason), 300), ''), left(texto, 1000));
  perform public.notify_members(ev, 'report', 'Novo conteúdo denunciado', 'Veja no painel do organizador.',
    '/grupo/' || ev || '/admin', auth.uid(), true);
end $$;

-- Resolver denúncia: ignorar, apagar o conteúdo ou silenciar quem mandou (na mensagem anônima, sem saber quem é).
create or replace function public.resolve_report(p_report uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.reports;
  autor uuid;
begin
  select * into r from public.reports where id = p_report;
  if not found then perform public.fail('not_found'); end if;
  if not public.is_event_admin(r.event_id) then perform public.fail('forbidden'); end if;
  if p_action not in ('dismissed', 'deleted', 'muted') then perform public.fail('invalid_action'); end if;
  if p_action in ('deleted', 'muted') then
    if r.kind = 'chat' then
      select user_id into autor from public.chat_messages where id = r.target_id;
      update public.chat_messages set body = '', deleted_at = now(), deleted_by = auth.uid() where id = r.target_id;
    elsif r.kind = 'wall' then
      select user_id into autor from public.wall_posts where id = r.target_id;
      delete from public.wall_posts where id = r.target_id;
    elsif r.kind = 'photo' then
      select uploader_id into autor from public.album_photos where id = r.target_id;
      delete from public.album_photos where id = r.target_id;
    elsif r.kind = 'secret' then
      update public.secret_messages set hidden_at = coalesce(hidden_at, now()) where id = r.target_id;
      if p_action = 'muted' then
        update public.assignments a set giver_muted_by_admin = true
        from public.secret_messages m where m.id = r.target_id and a.id = m.assignment_id and m.from_role = 'giver';
      end if;
    end if;
    if p_action = 'muted' and autor is not null then
      update public.participants set muted_until = now() + interval '7 days'
      where event_id = r.event_id and user_id = autor and role <> 'admin';
    end if;
  end if;
  update public.reports set resolved_at = now(), resolved_by = auth.uid(), resolution = p_action where id = p_report;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.wishlist_items enable row level security;
alter table public.gift_preferences enable row level security;
alter table public.announcements enable row level security;
alter table public.chat_messages enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.secret_messages enable row level security;
alter table public.reports enable row level security;

revoke all on public.wishlist_items, public.gift_preferences, public.announcements, public.chat_messages, public.polls,
  public.poll_options, public.poll_votes, public.secret_messages, public.reports from anon, authenticated;

grant select, insert, update, delete on public.wishlist_items to authenticated;
create policy wishlist_select on public.wishlist_items for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_event_with(user_id));
create policy wishlist_insert on public.wishlist_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy wishlist_update on public.wishlist_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wishlist_delete on public.wishlist_items for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update on public.gift_preferences to authenticated;
create policy prefs_select on public.gift_preferences for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_event_with(user_id));
create policy prefs_insert on public.gift_preferences for insert to authenticated with check (user_id = (select auth.uid()));
create policy prefs_update on public.gift_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, delete on public.announcements to authenticated;
grant update (title, body, pinned) on public.announcements to authenticated;
create policy announcements_select on public.announcements for select to authenticated using (public.is_event_member(event_id));
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.is_event_admin(event_id) and author_id = (select auth.uid()));
create policy announcements_update on public.announcements for update to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy announcements_delete on public.announcements for delete to authenticated using (public.is_event_admin(event_id));

grant select, insert on public.chat_messages to authenticated;
create policy chat_select on public.chat_messages for select to authenticated using (public.is_event_member(event_id));
create policy chat_insert on public.chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_chat(event_id));

grant select on public.polls, public.poll_options, public.poll_votes to authenticated;
grant delete on public.polls to authenticated;
create policy polls_select on public.polls for select to authenticated using (public.is_event_member(event_id));
create policy polls_delete on public.polls for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_event_admin(event_id));
create policy poll_options_select on public.poll_options for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and public.is_event_member(p.event_id)));
create policy poll_votes_select on public.poll_votes for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and public.is_event_member(p.event_id)));

-- secret_messages: nenhuma permissão direta.

grant select on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (public.is_event_admin(event_id) or reporter_id = (select auth.uid()));
-- Ao administrador a denúncia de mensagem anônima mostra o texto, nunca o remetente (a tabela não guarda o remetente).

revoke execute on function public.wishlist_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user_prefs() from public, anon, authenticated;
revoke execute on function public.announcements_after_insert() from public, anon, authenticated;
revoke execute on function public.chat_rate_limit() from public, anon, authenticated;
revoke execute on function public._my_giver_assignment(uuid) from public, anon, authenticated;
revoke execute on function public._my_receiver_assignment(uuid) from public, anon, authenticated;
