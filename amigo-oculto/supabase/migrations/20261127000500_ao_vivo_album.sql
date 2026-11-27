-- =====================================================================================================================
-- Amigo Oculto — modo revelação ao vivo e álbum de memórias.
-- No telão só aparece o par que o PRÓPRIO participante revelou (ou que ele autorizou o organizador a revelar).
-- No modo "corrente", quem apresenta em seguida é a pessoa que acabou de ser revelada (já pública naquele momento);
-- sem revelação, o próximo é sorteado entre os que faltam — a ordem nunca entrega um par antes da hora.
-- =====================================================================================================================

create table public.live_sessions (
  event_id uuid primary key references public.events (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'finished')),
  mode text not null default 'chain' check (mode in ('chain', 'random')),
  queue uuid[] not null default '{}',
  presented uuid[] not null default '{}',
  current_id uuid references public.participants (id) on delete set null,
  speech_seconds int not null default 60 check (speech_seconds between 10 and 600),
  timer_ends_at timestamptz,
  timer_paused_left int,
  started_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger live_sessions_updated_at before update on public.live_sessions for each row execute function public.set_updated_at();

create table public.live_reveals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  giver_id uuid not null references public.participants (id) on delete cascade,
  receiver_id uuid not null references public.participants (id) on delete cascade,
  method text not null check (method in ('self', 'presenter')),
  revealed_at timestamptz not null default now(),
  unique (event_id, giver_id)
);
create index live_reveals_event_idx on public.live_reveals (event_id, revealed_at);

create table public.live_clues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index live_clues_event_idx on public.live_clues (event_id, created_at);

create or replace function public._live_random_remaining(p_event uuid, p_excluir uuid[]) returns uuid
language sql volatile security definer set search_path = '' as $$
  select p.id from public.participants p
  where p.event_id = p_event and p.status = 'approved' and not (p.id = any (coalesce(p_excluir, '{}')))
  order by extensions.gen_random_bytes(8) limit 1;
$$;

create or replace function public.live_start(p_event uuid, p_mode text default 'chain', p_seconds int default 60) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  primeiro uuid;
  fila uuid[];
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  select * into e from public.events where id = p_event for update;
  if e.status <> 'drawn' then perform public.fail('not_drawn'); end if;
  if exists (select 1 from public.live_sessions where event_id = p_event) then perform public.fail('live_already_started'); end if;
  if p_mode not in ('chain', 'random') then perform public.fail('invalid_mode'); end if;
  primeiro := public._live_random_remaining(p_event, '{}');
  if p_mode = 'random' then
    select coalesce(array_agg(id order by extensions.gen_random_bytes(8)), '{}') into fila
    from public.participants where event_id = p_event and status = 'approved' and id <> primeiro;
  else
    fila := '{}';
  end if;
  insert into public.live_sessions (event_id, mode, queue, current_id, speech_seconds, started_by)
  values (p_event, p_mode, fila, primeiro, least(greatest(coalesce(p_seconds, 60), 10), 600), auth.uid());
  perform public.log_event(p_event, 'live_started', '{}'::jsonb);
  perform public.notify_members(p_event, 'live_start', 'A revelação de ' || e.name || ' começou!',
    'Acompanhe pelo celular e revele quando for a sua vez.', '/grupo/' || p_event || '/ao-vivo/participar', auth.uid());
end $$;

create or replace function public.live_timer(p_event uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.live_sessions;
  resta int;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  select * into s from public.live_sessions where event_id = p_event for update;
  if not found or s.status <> 'running' then perform public.fail('live_not_running'); end if;
  if p_action = 'start' then
    resta := coalesce(s.timer_paused_left, s.speech_seconds);
    update public.live_sessions set timer_ends_at = now() + make_interval(secs => resta), timer_paused_left = null where event_id = p_event;
  elsif p_action = 'pause' then
    if s.timer_ends_at is not null then
      update public.live_sessions
      set timer_paused_left = greatest(0, ceil(extract(epoch from (s.timer_ends_at - now())))::int), timer_ends_at = null
      where event_id = p_event;
    end if;
  elsif p_action = 'reset' then
    update public.live_sessions set timer_ends_at = null, timer_paused_left = null where event_id = p_event;
  else
    perform public.fail('invalid_action');
  end if;
end $$;

create or replace function public.live_set_seconds(p_event uuid, p_seconds int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  update public.live_sessions set speech_seconds = least(greatest(coalesce(p_seconds, 60), 10), 600) where event_id = p_event;
end $$;

-- Grava a revelação do apresentador da vez (pelo próprio, ou pelo organizador com a autorização dele).
create or replace function public._live_do_reveal(p_event uuid, p_giver uuid, p_method text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.live_sessions;
  a public.assignments;
  nome_dador text;
  nome_recebedor text;
begin
  select * into s from public.live_sessions where event_id = p_event for update;
  if not found or s.status <> 'running' then perform public.fail('live_not_running'); end if;
  if s.current_id is distinct from p_giver then perform public.fail('live_not_your_turn'); end if;
  if exists (select 1 from public.live_reveals where event_id = p_event and giver_id = p_giver) then return; end if;
  select * into a from public.assignments where event_id = p_event and giver_id = p_giver;
  if not found then perform public.fail('not_drawn'); end if;
  insert into public.live_reveals (event_id, giver_id, receiver_id, method) values (p_event, p_giver, a.receiver_id, p_method);
  select pr.display_name into nome_dador from public.participants p join public.profiles pr on pr.id = p.user_id where p.id = p_giver;
  select pr.display_name into nome_recebedor from public.participants p join public.profiles pr on pr.id = p.user_id where p.id = a.receiver_id;
  perform public.log_event(p_event, 'reveal', jsonb_build_object('de', nome_dador, 'para', nome_recebedor));
end $$;

create or replace function public.live_reveal(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
begin
  if eu is null then perform public.fail('forbidden'); end if;
  perform public._live_do_reveal(p_event, eu, 'self');
end $$;

create or replace function public.live_reveal_for(p_event uuid, p_participant uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  if not exists (select 1 from public.participants where id = p_participant and event_id = p_event and allow_public_reveal) then
    perform public.fail('reveal_not_authorized');
  end if;
  perform public._live_do_reveal(p_event, p_participant, 'presenter');
end $$;

create or replace function public.live_next(p_event uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.live_sessions;
  apresentados uuid[];
  proximo uuid;
  revelado uuid;
  fila uuid[];
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  select * into s from public.live_sessions where event_id = p_event for update;
  if not found or s.status <> 'running' then perform public.fail('live_not_running'); end if;
  apresentados := s.presented;
  if s.current_id is not null and not (s.current_id = any (apresentados)) then
    apresentados := apresentados || s.current_id;
  end if;
  fila := s.queue;
  if s.mode = 'chain' and s.current_id is not null then
    select receiver_id into revelado from public.live_reveals where event_id = p_event and giver_id = s.current_id;
    if revelado is not null and not (revelado = any (apresentados))
       and exists (select 1 from public.participants where id = revelado and status = 'approved') then
      proximo := revelado;
    end if;
  end if;
  if proximo is null and s.mode = 'random' then
    while cardinality(fila) > 0 and proximo is null loop
      if not (fila[1] = any (apresentados)) then proximo := fila[1]; end if;
      fila := fila[2:];
    end loop;
  end if;
  if proximo is null then
    proximo := public._live_random_remaining(p_event, apresentados);
  end if;
  update public.live_sessions
  set presented = apresentados, current_id = proximo, queue = fila, timer_ends_at = null, timer_paused_left = null
  where event_id = p_event;
  return proximo;
end $$;

create or replace function public.live_clue(p_event uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  s public.live_sessions;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  select * into s from public.live_sessions where event_id = p_event;
  if not found or s.status <> 'running' then perform public.fail('live_not_running'); end if;
  if s.current_id is distinct from eu then perform public.fail('live_not_your_turn'); end if;
  if (select count(*) from public.live_clues where event_id = p_event and participant_id = eu) >= 10 then
    perform public.fail('rate_limited');
  end if;
  insert into public.live_clues (event_id, participant_id, body) values (p_event, eu, btrim(p_body));
end $$;

create or replace function public.live_finish(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  select * into e from public.events where id = p_event for update;
  update public.live_sessions
  set status = 'finished', finished_at = now(), current_id = null, timer_ends_at = null, timer_paused_left = null,
      presented = case when current_id is not null and not (current_id = any (presented)) then presented || current_id else presented end
  where event_id = p_event and status = 'running';
  if not found then perform public.fail('live_not_running'); end if;
  if e.status = 'drawn' then
    update public.events set status = 'finished', finished_at = now() where id = p_event;
  end if;
  perform public.log_event(p_event, 'live_finished', '{}'::jsonb);
  perform public.notify_members(p_event, 'finished', 'Que noite! ' || e.name || ' foi encerrado',
    'O álbum de memórias está aberto: mande suas fotos e recados.', '/grupo/' || p_event || '/album');
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Álbum de memórias (privado; abre com a revelação ao vivo ou com o encerramento)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  storage_path text not null unique check (char_length(storage_path) <= 300),
  caption text check (caption is null or char_length(caption) <= 200),
  width int check (width is null or width between 1 and 10000),
  height int check (height is null or height between 1 and 10000),
  created_at timestamptz not null default now()
);
create index album_photos_event_idx on public.album_photos (event_id, created_at);

create or replace function public.album_open(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event and e.status = 'finished')
      or exists (select 1 from public.live_sessions l where l.event_id = p_event);
$$;

create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.album_photo_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.album_photos where event_id = new.event_id and uploader_id = new.uploader_id) >= 100 then
    perform public.fail('album_full');
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger album_photos_limit before insert on public.album_photos for each row execute function public.album_photo_limit();

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.live_sessions enable row level security;
alter table public.live_reveals enable row level security;
alter table public.live_clues enable row level security;
alter table public.album_photos enable row level security;
revoke all on public.live_sessions, public.live_reveals, public.live_clues, public.album_photos from anon, authenticated;

grant select on public.live_sessions, public.live_reveals, public.live_clues to authenticated;
create policy live_sessions_select on public.live_sessions for select to authenticated using (public.is_event_member(event_id));
create policy live_reveals_select on public.live_reveals for select to authenticated using (public.is_event_member(event_id));
create policy live_clues_select on public.live_clues for select to authenticated using (public.is_event_member(event_id));

grant select, insert, delete on public.album_photos to authenticated;
grant update (caption) on public.album_photos to authenticated;
create policy album_select on public.album_photos for select to authenticated using (public.is_event_member(event_id));
create policy album_insert on public.album_photos for insert to authenticated
  with check (
    uploader_id = (select auth.uid()) and public.is_event_member(event_id) and public.album_open(event_id)
    and storage_path like event_id::text || '/' || (select auth.uid())::text || '/%'
  );
create policy album_update on public.album_photos for update to authenticated
  using (uploader_id = (select auth.uid())) with check (uploader_id = (select auth.uid()));
create policy album_delete on public.album_photos for delete to authenticated
  using (uploader_id = (select auth.uid()) or public.is_event_admin(event_id));

revoke execute on function public._live_random_remaining(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public._live_do_reveal(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.album_photo_limit() from public, anon, authenticated;
