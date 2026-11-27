-- =====================================================================================================================
-- Amigo Oculto — funções do evento: criar, prévia do convite, entrar, administração, sorteio (commit atômico só pelo
-- servidor), resultado do próprio participante, lembretes, cron e fila de entrega de notificações.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- Guardas e avisos em events
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.events_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ocupados int;
begin
  if old.status <> 'open' and (
    new.draw_mode is distinct from old.draw_mode or new.draw_at is distinct from old.draw_at
    or new.max_participants is distinct from old.max_participants
    or new.join_deadline is distinct from old.join_deadline
    or new.requires_approval is distinct from old.requires_approval
  ) then
    perform public.fail('locked_after_draw');
  end if;
  if new.max_participants is not null and new.max_participants is distinct from old.max_participants then
    select count(*) into ocupados from public.participants where event_id = new.id and status in ('approved', 'pending');
    if new.max_participants < ocupados then
      perform public.fail('limit_below_count');
    end if;
  end if;
  return new;
end $$;
create trigger events_before_update before update on public.events
  for each row execute function public.events_before_update();

create or replace function public.events_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  mudou text[] := '{}';
begin
  if new.rules is distinct from old.rules then mudou := mudou || 'regras'; end if;
  if new.gift_min is distinct from old.gift_min or new.gift_max is distinct from old.gift_max then mudou := mudou || 'valor do presente'; end if;
  if new.reveal_at is distinct from old.reveal_at then mudou := mudou || 'data da revelação'; end if;
  if new.location is distinct from old.location then mudou := mudou || 'local'; end if;
  if new.draw_at is distinct from old.draw_at and new.draw_mode = 'scheduled' then mudou := mudou || 'data do sorteio'; end if;
  if cardinality(mudou) > 0 then
    perform public.notify_members(new.id, 'rules_changed', 'Mudanças em ' || new.name,
      'Atualizado: ' || array_to_string(mudou, ', ') || '.', '/grupo/' || new.id, (select auth.uid()));
    perform public.log_event(new.id, 'rules_changed', jsonb_build_object('campos', to_jsonb(mudou)));
  end if;
  return new;
end $$;
create trigger events_after_update after update of rules, gift_min, gift_max, reveal_at, location, draw_at on public.events
  for each row execute function public.events_after_update();

-- ---------------------------------------------------------------------------------------------------------------------
-- Criar evento (o criador entra como administrador)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.create_event(
  p_name text,
  p_description text default null,
  p_cover_path text default null,
  p_theme public.event_theme default 'natal',
  p_reveal_at timestamptz default null,
  p_location text default null,
  p_gift_min numeric default null,
  p_gift_max numeric default null,
  p_max_participants int default null,
  p_rules text default null,
  p_join_deadline timestamptz default null,
  p_draw_at timestamptz default null,
  p_draw_mode public.draw_mode default 'manual',
  p_visibility public.event_visibility default 'private',
  p_requires_approval boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  novo uuid;
  tentativa int := 0;
begin
  if uid is null then perform public.fail('not_authenticated'); end if;
  if public.is_anonymous_user() then perform public.fail('guest_cannot_create'); end if;
  if (select count(*) from public.events where owner_id = uid and created_at > now() - interval '1 hour') >= 20 then
    perform public.fail('rate_limited');
  end if;
  if p_draw_mode = 'scheduled' and (p_draw_at is null or p_draw_at < now() - interval '1 minute') then
    perform public.fail('draw_date_invalid');
  end if;
  loop
    begin
      insert into public.events (owner_id, name, description, cover_path, theme, reveal_at, location, gift_min, gift_max,
        max_participants, rules, join_deadline, draw_at, draw_mode, visibility, requires_approval, invite_code)
      values (uid, btrim(p_name), nullif(btrim(p_description), ''), nullif(p_cover_path, ''), coalesce(p_theme, 'natal'),
        p_reveal_at, nullif(btrim(p_location), ''), p_gift_min, p_gift_max, p_max_participants, nullif(btrim(p_rules), ''),
        p_join_deadline, p_draw_at, coalesce(p_draw_mode, 'manual'), coalesce(p_visibility, 'private'),
        coalesce(p_requires_approval, false), public.generate_invite_code())
      returning id into novo;
      exit;
    exception when unique_violation then
      tentativa := tentativa + 1;
      if tentativa > 5 then raise; end if;
    end;
  end loop;
  insert into public.participants (event_id, user_id, role, status, approved_at, rsvp)
  values (novo, uid, 'admin', 'approved', now(), 'yes');
  perform public.log_event(novo, 'created', '{}'::jsonb);
  return novo;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Prévia pelo código (também para quem ainda não entrou na conta)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.event_preview(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  dono text;
  n int;
  meu public.participants;
begin
  select * into e from public.events where invite_code = upper(btrim(p_code));
  if not found then return null; end if;
  select display_name into dono from public.profiles where id = e.owner_id;
  select count(*) into n from public.participants where event_id = e.id and status = 'approved';
  if auth.uid() is not null then
    select * into meu from public.participants where event_id = e.id and user_id = auth.uid();
  end if;
  return jsonb_build_object(
    'id', e.id, 'name', e.name, 'description', e.description, 'cover_path', e.cover_path, 'theme', e.theme,
    'reveal_at', e.reveal_at, 'location', e.location, 'gift_min', e.gift_min, 'gift_max', e.gift_max,
    'max_participants', e.max_participants, 'join_deadline', e.join_deadline, 'requires_approval', e.requires_approval,
    'status', e.status, 'archived', e.archived_at is not null, 'participant_count', n, 'owner_name', dono,
    'accepting', e.status = 'open' and e.archived_at is null
      and (e.join_deadline is null or e.join_deadline > now())
      and (e.max_participants is null or n < e.max_participants),
    'my_status', meu.status
  );
end $$;

-- Grupos públicos (lista para explorar)
create or replace function public.public_events(p_limit int default 24, p_offset int default 0) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', e.id, 'name', e.name, 'description', left(e.description, 240), 'cover_path', e.cover_path, 'theme', e.theme,
      'reveal_at', e.reveal_at, 'gift_min', e.gift_min, 'gift_max', e.gift_max, 'invite_code', e.invite_code,
      'requires_approval', e.requires_approval, 'max_participants', e.max_participants, 'created_at', e.created_at,
      'participant_count', (select count(*) from public.participants p where p.event_id = e.id and p.status = 'approved'),
      'owner_name', (select display_name from public.profiles where id = e.owner_id)
    ) as x
    from public.events e
    where e.visibility = 'public' and e.archived_at is null and e.status = 'open'
      and (e.join_deadline is null or e.join_deadline > now())
    order by e.created_at desc
    limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
  ) s;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Entrar no grupo pelo código (ou pelo id, se for público)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.join_event(p_code text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  e public.events;
  existente public.participants;
  ocupados int;
  convidado boolean;
  novo_status public.participant_status;
  nome text;
begin
  if uid is null then perform public.fail('not_authenticated'); end if;
  select * into e from public.events where invite_code = upper(btrim(p_code)) for update;
  if not found then perform public.fail('invalid_code'); end if;

  select * into existente from public.participants where event_id = e.id and user_id = uid;
  if found then
    if existente.status = 'rejected' then perform public.fail('join_rejected'); end if;
    return jsonb_build_object('event_id', e.id, 'status', existente.status);
  end if;

  if e.archived_at is not null or e.status <> 'open' then perform public.fail('event_closed'); end if;
  if e.join_deadline is not null and e.join_deadline <= now() then perform public.fail('deadline_passed'); end if;
  select count(*) into ocupados from public.participants where event_id = e.id and status in ('approved', 'pending');
  if e.max_participants is not null and ocupados >= e.max_participants then perform public.fail('event_full'); end if;

  convidado := exists (
    select 1 from public.event_invites i
    where i.event_id = e.id and i.revoked_at is null and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
  novo_status := case when e.requires_approval and not convidado then 'pending' else 'approved' end;

  insert into public.participants (event_id, user_id, role, status, approved_at, join_message)
  values (e.id, uid, 'member', novo_status, case when novo_status = 'approved' then now() end,
          nullif(left(btrim(p_message), 300), ''));
  update public.event_invites set accepted_at = now()
  where event_id = e.id and accepted_at is null and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  select display_name into nome from public.profiles where id = uid;
  if novo_status = 'approved' then
    perform public.log_event(e.id, 'joined', jsonb_build_object('nome', nome));
    perform public.notify_members(e.id, 'new_participant', nome || ' entrou em ' || e.name, null,
      '/grupo/' || e.id || '/participantes', uid, true);
  else
    perform public.notify_members(e.id, 'join_request', nome || ' pediu para entrar em ' || e.name,
      coalesce(nullif(left(btrim(p_message), 200), ''), 'Aprove ou recuse no painel do grupo.'),
      '/grupo/' || e.id || '/admin', uid, true);
  end if;
  return jsonb_build_object('event_id', e.id, 'status', novo_status);
end $$;

create or replace function public.join_public_event(p_event uuid, p_message text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  codigo text;
begin
  select invite_code into codigo from public.events where id = p_event and visibility = 'public';
  if codigo is null then perform public.fail('invalid_code'); end if;
  return public.join_event(codigo, p_message);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Administração
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public._admin_of_participant(p_participant uuid) returns public.participants
language plpgsql security definer set search_path = '' as $$
declare
  alvo public.participants;
begin
  select * into alvo from public.participants where id = p_participant;
  if not found then perform public.fail('participant_not_found'); end if;
  if not public.is_event_admin(alvo.event_id) then perform public.fail('forbidden'); end if;
  return alvo;
end $$;

create or replace function public.approve_participant(p_participant uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  alvo public.participants := public._admin_of_participant(p_participant);
  e public.events;
  ocupados int;
  nome text;
begin
  select * into e from public.events where id = alvo.event_id for update;
  if alvo.status <> 'pending' then perform public.fail('not_pending'); end if;
  if p_approve and (e.status <> 'open' or e.archived_at is not null) then perform public.fail('event_closed'); end if;
  select display_name into nome from public.profiles where id = alvo.user_id;
  if p_approve then
    select count(*) into ocupados from public.participants where event_id = e.id and status = 'approved';
    if e.max_participants is not null and ocupados >= e.max_participants then perform public.fail('event_full'); end if;
    update public.participants set status = 'approved', approved_at = now() where id = alvo.id;
    perform public.log_event(e.id, 'joined', jsonb_build_object('nome', nome));
    perform public.notify(alvo.user_id, e.id, 'approved', 'Você entrou em ' || e.name || '!',
      'Seu pedido foi aprovado. Monte sua lista de desejos.', '/grupo/' || e.id);
  else
    update public.participants set status = 'rejected' where id = alvo.id;
    perform public.notify(alvo.user_id, e.id, 'rejected', 'Pedido não aprovado em ' || e.name, null, '/painel');
  end if;
end $$;

create or replace function public.remove_participant(p_participant uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  alvo public.participants := public._admin_of_participant(p_participant);
  e public.events;
  nome text;
begin
  select * into e from public.events where id = alvo.event_id for update;
  if e.status <> 'open' then perform public.fail('locked_after_draw'); end if;
  if alvo.user_id = e.owner_id then perform public.fail('cannot_remove_owner'); end if;
  select display_name into nome from public.profiles where id = alvo.user_id;
  delete from public.participants where id = alvo.id;
  perform public.log_event(e.id, 'removed', jsonb_build_object('nome', nome));
  perform public.notify(alvo.user_id, e.id, 'removed', 'Você foi removido de ' || e.name, null, '/painel');
end $$;

create or replace function public.leave_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  eu public.participants;
  nome text;
begin
  select * into e from public.events where id = p_event for update;
  if not found then perform public.fail('event_not_found'); end if;
  select * into eu from public.participants where event_id = p_event and user_id = auth.uid();
  if not found then perform public.fail('participant_not_found'); end if;
  if eu.status = 'approved' and e.status <> 'open' then perform public.fail('locked_after_draw'); end if;
  if e.owner_id = auth.uid() then perform public.fail('owner_cannot_leave'); end if;
  select display_name into nome from public.profiles where id = eu.user_id;
  delete from public.participants where id = eu.id;
  if eu.status = 'approved' then
    perform public.log_event(e.id, 'left', jsonb_build_object('nome', nome));
  end if;
end $$;

create or replace function public.set_participant_role(p_participant uuid, p_role public.participant_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  alvo public.participants := public._admin_of_participant(p_participant);
  e public.events;
begin
  select * into e from public.events where id = alvo.event_id;
  if alvo.status <> 'approved' then perform public.fail('not_approved'); end if;
  if alvo.user_id = e.owner_id and p_role <> 'admin' then perform public.fail('cannot_demote_owner'); end if;
  update public.participants set role = p_role where id = alvo.id;
  if p_role = 'admin' then
    perform public.notify(alvo.user_id, e.id, 'role', 'Agora você organiza ' || e.name,
      'Você ganhou acesso ao painel do organizador.', '/grupo/' || e.id || '/admin');
  end if;
end $$;

create or replace function public.mute_participant(p_participant uuid, p_minutes int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  alvo public.participants := public._admin_of_participant(p_participant);
begin
  if alvo.role = 'admin' then perform public.fail('cannot_mute_admin'); end if;
  update public.participants
  set muted_until = case when coalesce(p_minutes, 0) <= 0 then null else now() + make_interval(mins => least(p_minutes, 60 * 24 * 30)) end
  where id = alvo.id;
end $$;

create or replace function public.regenerate_invite_code(p_event uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  codigo text;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  loop
    begin
      codigo := public.generate_invite_code();
      update public.events set invite_code = codigo where id = p_event;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return codigo;
end $$;

create or replace function public.archive_event(p_event uuid, p_archive boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  update public.events set archived_at = case when p_archive then now() else null end where id = p_event;
  perform public.log_event(p_event, case when p_archive then 'archived' else 'unarchived' end, '{}'::jsonb);
end $$;

create or replace function public.finish_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  select * into e from public.events where id = p_event for update;
  if e.status <> 'drawn' then perform public.fail('not_drawn'); end if;
  update public.events set status = 'finished', finished_at = now() where id = p_event;
  perform public.log_event(p_event, 'finished', '{}'::jsonb);
  perform public.notify_members(p_event, 'finished', e.name || ' foi encerrado',
    'O álbum de memórias está aberto: mande suas fotos!', '/grupo/' || p_event || '/album');
end $$;

create or replace function public.delete_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.events where id = p_event and owner_id = auth.uid()) then
    perform public.fail('forbidden');
  end if;
  delete from public.events where id = p_event;
end $$;

-- Convidar por e-mail (o servidor manda o e-mail; quem já tem conta recebe a notificação aqui)
create or replace function public.invite_emails(p_event uuid, p_emails text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  em text;
  n int := 0;
  destino uuid;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  select * into e from public.events where id = p_event;
  if e.status <> 'open' then perform public.fail('event_closed'); end if;
  if cardinality(p_emails) > 50 then perform public.fail('too_many'); end if;
  foreach em in array p_emails loop
    em := lower(btrim(em));
    continue when em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';
    insert into public.event_invites (event_id, email, invited_by) values (p_event, em, auth.uid())
    on conflict (event_id, lower(email)) do update set revoked_at = null, invited_by = excluded.invited_by;
    n := n + 1;
    select u.id into destino from auth.users u where lower(u.email) = em and not coalesce(u.is_anonymous, false) limit 1;
    if destino is not null and not exists (select 1 from public.participants where event_id = p_event and user_id = destino) then
      perform public.notify(destino, p_event, 'invite', 'Convite para ' || e.name,
        'Toque para ver o grupo e participar.', '/convite/' || e.invite_code);
    end if;
  end loop;
  return n;
end $$;

-- Lembretes manuais do administrador (no máximo 1 de cada tipo a cada 6 h)
create or replace function public.send_reminder(p_event uuid, p_kind text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  n int := 0;
  ultimo timestamptz;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  if p_kind not in ('buy_gift', 'view_result', 'rsvp', 'wishlist') then perform public.fail('invalid_kind'); end if;
  select * into e from public.events where id = p_event;
  select sent_at into ultimo from public.reminder_log where event_id = p_event and kind = 'manual_' || p_kind and target = '*';
  if ultimo is not null and ultimo > now() - interval '6 hours' then perform public.fail('reminder_too_soon'); end if;
  if p_kind in ('buy_gift', 'view_result') and e.status <> 'drawn' then perform public.fail('not_drawn'); end if;

  insert into public.notifications (user_id, event_id, kind, title, body, link)
  select p.user_id, e.id, 'reminder',
    case p_kind
      when 'buy_gift' then 'Já comprou o presente?'
      when 'view_result' then 'Seu amigo oculto está esperando!'
      when 'rsvp' then 'Você vai ao encontro?'
      else 'Monte sua lista de desejos' end,
    case p_kind
      when 'buy_gift' then 'Lembrete do grupo ' || e.name || '. Marque quando comprar.'
      when 'view_result' then 'Abra o seu presente em ' || e.name || ' e descubra quem você tirou.'
      when 'rsvp' then 'Confirme sua presença em ' || e.name || '.'
      else 'Ajude quem te tirou em ' || e.name || ': adicione ideias de presente.' end,
    case p_kind
      when 'view_result' then '/grupo/' || e.id || '/revelacao'
      when 'wishlist' then '/lista-de-desejos'
      else '/grupo/' || e.id end
  from public.participants p
  where p.event_id = e.id and p.status = 'approved'
    and case p_kind
      when 'buy_gift' then not p.gift_bought
      when 'view_result' then p.result_viewed_at is null
      when 'rsvp' then p.rsvp is null
      else not exists (select 1 from public.wishlist_items w where w.user_id = p.user_id) end;
  get diagnostics n = row_count;
  insert into public.reminder_log (event_id, kind, target, sent_at) values (p_event, 'manual_' || p_kind, '*', now())
  on conflict (event_id, kind, target) do update set sent_at = now();
  return n;
end $$;

create or replace function public.admin_event_stats(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  select jsonb_build_object(
    'approved', count(*) filter (where p.status = 'approved'),
    'pending', count(*) filter (where p.status = 'pending'),
    'viewed', count(*) filter (where p.status = 'approved' and p.result_viewed_at is not null),
    'bought', count(*) filter (where p.status = 'approved' and p.gift_bought),
    'rsvp_yes', count(*) filter (where p.status = 'approved' and p.rsvp = 'yes'),
    'rsvp_no', count(*) filter (where p.status = 'approved' and p.rsvp = 'no'),
    'rsvp_maybe', count(*) filter (where p.status = 'approved' and p.rsvp = 'maybe'),
    'with_wishlist', count(*) filter (where p.status = 'approved' and exists (select 1 from public.wishlist_items w where w.user_id = p.user_id)),
    'guests', count(*) filter (where p.status = 'approved' and exists (select 1 from public.profiles pr where pr.id = p.user_id and pr.is_guest))
  ) into r
  from public.participants p where p.event_id = p_event;
  return r || jsonb_build_object(
    'chat_messages', (select count(*) from public.chat_messages where event_id = p_event and deleted_at is null),
    'restrictions', (select count(*) from public.restrictions where event_id = p_event),
    'open_reports', (select count(*) from public.reports where event_id = p_event and resolved_at is null),
    'invites', (select count(*) from public.event_invites where event_id = p_event and revoked_at is null),
    'invites_accepted', (select count(*) from public.event_invites where event_id = p_event and accepted_at is not null)
  );
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Sorteio (só o servidor, com a chave service_role)
-- ---------------------------------------------------------------------------------------------------------------------
-- Dados para o algoritmo: os aprovados e as restrições.
create or replace function public.draw_input(p_event uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', e.status, 'archived', e.archived_at is not null, 'draw_version', e.draw_version,
    'name', e.name, 'draw_mode', e.draw_mode, 'draw_at', e.draw_at,
    'participants', coalesce((select jsonb_agg(p.id order by p.created_at) from public.participants p
                              where p.event_id = e.id and p.status = 'approved'), '[]'::jsonb),
    'pending', (select count(*) from public.participants p where p.event_id = e.id and p.status = 'pending'),
    'restrictions', coalesce((select jsonb_agg(jsonb_build_object('giver', r.giver_id, 'receiver', r.receiver_id, 'mutual', r.mutual))
                              from public.restrictions r where r.event_id = e.id), '[]'::jsonb)
  )
  from public.events e where e.id = p_event;
$$;

-- Grava o sorteio numa transação só, conferindo TUDO de novo com o evento travado.
create or replace function public.commit_draw(
  p_event uuid, p_pairs jsonb, p_expected_version int, p_actor uuid default null,
  p_scheduled boolean default false, p_redraw boolean default false, p_reason text default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  n_roster int;
  n_pares int;
  n_dar int;
  n_receber int;
  nova_versao int;
  tipo text;
  dadores uuid[];
  recebedores uuid[];
begin
  select * into e from public.events where id = p_event for update;
  if not found then perform public.fail('event_not_found'); end if;
  if e.archived_at is not null then perform public.fail('event_archived'); end if;
  if e.draw_version <> p_expected_version then perform public.fail('version_conflict'); end if;
  if e.status = 'finished' then perform public.fail('event_finished'); end if;
  if e.status = 'drawn' and not p_redraw then perform public.fail('already_drawn'); end if;
  if e.status = 'open' and p_redraw then perform public.fail('not_drawn'); end if;
  if p_redraw and exists (select 1 from public.live_sessions l where l.event_id = p_event) then
    perform public.fail('live_already_started');
  end if;
  if p_actor is not null and not exists (
    select 1 from public.participants where event_id = p_event and user_id = p_actor and status = 'approved' and role = 'admin'
  ) then
    perform public.fail('forbidden');
  end if;
  tipo := case when p_redraw then 'redraw' else 'draw' end;

  -- quem ainda estava pendente fica de fora
  with recusados as (
    update public.participants set status = 'rejected'
    where event_id = p_event and status = 'pending' returning user_id
  )
  insert into public.notifications (user_id, event_id, kind, title, body, link)
  select user_id, p_event, 'rejected', 'O sorteio de ' || e.name || ' já aconteceu',
         'Seu pedido não foi aprovado a tempo.', '/painel' from recusados;

  if jsonb_typeof(p_pairs) <> 'array' then perform public.fail('roster_changed'); end if;
  select array_agg((x ->> 'giver')::uuid order by o), array_agg((x ->> 'receiver')::uuid order by o)
  into dadores, recebedores
  from jsonb_array_elements(p_pairs) with ordinality as t(x, o);

  select count(*) into n_roster from public.participants where event_id = p_event and status = 'approved';
  select count(*), count(distinct giver), count(distinct receiver) into n_pares, n_dar, n_receber
  from unnest(dadores, recebedores) as s(giver, receiver);

  if n_roster < 3 then perform public.fail('not_enough_participants'); end if;
  if n_pares <> n_roster or n_dar <> n_roster or n_receber <> n_roster then perform public.fail('roster_changed'); end if;
  if exists (
    select 1 from unnest(dadores, recebedores) as s(giver, receiver)
    where s.giver is null or s.receiver is null
      or not exists (select 1 from public.participants p where p.id = s.giver and p.event_id = p_event and p.status = 'approved')
      or not exists (select 1 from public.participants p where p.id = s.receiver and p.event_id = p_event and p.status = 'approved')
  ) then
    perform public.fail('roster_changed');
  end if;
  if exists (select 1 from unnest(dadores, recebedores) as s(giver, receiver) where giver = receiver) then perform public.fail('invalid_draw_self'); end if;
  if exists (
    select 1 from unnest(dadores, recebedores) as s(giver, receiver) join public.restrictions r on r.event_id = p_event
    where (r.giver_id = s.giver and r.receiver_id = s.receiver)
       or (r.mutual and r.giver_id = s.receiver and r.receiver_id = s.giver)
  ) then
    perform public.fail('invalid_draw_restriction');
  end if;

  nova_versao := e.draw_version + 1;
  delete from public.assignments where event_id = p_event;   -- invalida o resultado anterior (mensagens anônimas vão junto)
  delete from public.guesses where event_id = p_event;
  insert into public.assignments (event_id, draw_version, giver_id, receiver_id)
  select p_event, nova_versao, giver, receiver from unnest(dadores, recebedores) as s(giver, receiver);
  update public.participants set result_viewed_at = null where event_id = p_event;
  update public.events set status = 'drawn', draw_version = nova_versao, drawn_at = now() where id = p_event;

  insert into public.draw_log (event_id, version, kind, performed_by, scheduled, participant_count, reason)
  values (p_event, nova_versao, tipo, p_actor, p_scheduled, n_roster, nullif(left(btrim(p_reason), 300), ''));
  insert into public.event_log (event_id, kind, actor_id, data)
  values (p_event, tipo, p_actor, jsonb_build_object('versao', nova_versao, 'participantes', n_roster, 'agendado', p_scheduled));

  if p_redraw then
    perform public.notify_members(p_event, 'redraw', 'O sorteio de ' || e.name || ' foi refeito',
      'O resultado anterior não vale mais. Abra o presente de novo para ver quem você tirou.', '/grupo/' || p_event || '/revelacao');
  else
    perform public.notify_members(p_event, 'draw', 'O sorteio de ' || e.name || ' foi realizado!',
      'Abra o seu presente e descubra quem você tirou.', '/grupo/' || p_event || '/revelacao');
  end if;
  return nova_versao;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Resultado do PRÓPRIO participante (ninguém mais)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.my_assignment(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  e public.events;
  a public.assignments;
  pr public.profiles;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  select * into e from public.events where id = p_event;
  if e.status = 'open' then
    return jsonb_build_object('status', e.status, 'draw_at', e.draw_at, 'draw_mode', e.draw_mode);
  end if;
  select * into a from public.assignments where event_id = p_event and giver_id = eu;
  if not found then
    return jsonb_build_object('status', e.status, 'missing', true);
  end if;
  select pr2.* into pr from public.participants p join public.profiles pr2 on pr2.id = p.user_id where p.id = a.receiver_id;
  return jsonb_build_object(
    'status', e.status, 'draw_version', a.draw_version, 'viewed_at', a.viewed_at,
    'receiver', jsonb_build_object('participant_id', a.receiver_id, 'user_id', pr.id, 'display_name', pr.display_name,
      'nickname', pr.nickname, 'avatar_path', pr.avatar_path, 'bio', pr.bio)
  );
end $$;

create or replace function public.mark_result_viewed(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
begin
  if eu is null then perform public.fail('forbidden'); end if;
  update public.assignments set viewed_at = coalesce(viewed_at, now()) where event_id = p_event and giver_id = eu;
  if found then
    update public.participants set result_viewed_at = coalesce(result_viewed_at, now()) where id = eu;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Cron (servidor): sorteios agendados vencidos, lembretes automáticos, encerramento automático
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.cron_due_draws() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.events
  where draw_mode = 'scheduled' and status = 'open' and archived_at is null and draw_at <= now()
  order by draw_at limit 50;
$$;

create or replace function public.cron_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare
  total int := 0;
  n int;
  ev record;
begin
  -- presente não comprado, 3 dias antes da revelação
  for ev in
    select e.* from public.events e
    where e.status = 'drawn' and e.archived_at is null and e.reveal_at between now() and now() + interval '3 days'
      and not exists (select 1 from public.reminder_log r where r.event_id = e.id and r.kind = 'auto_buy_gift')
  loop
    insert into public.notifications (user_id, event_id, kind, title, body, link)
    select p.user_id, ev.id, 'reminder', 'Faltam poucos dias para ' || ev.name,
           'Já comprou o presente? Marque quando estiver tudo pronto.', '/grupo/' || ev.id
    from public.participants p where p.event_id = ev.id and p.status = 'approved' and not p.gift_bought;
    get diagnostics n = row_count; total := total + n;
    insert into public.reminder_log (event_id, kind) values (ev.id, 'auto_buy_gift') on conflict do nothing;
  end loop;

  -- o encontro é amanhã (ou nas próximas 24 h)
  for ev in
    select e.* from public.events e
    where e.status in ('open', 'drawn') and e.archived_at is null and e.reveal_at between now() and now() + interval '24 hours'
      and not exists (select 1 from public.reminder_log r where r.event_id = e.id and r.kind = 'auto_event_soon')
  loop
    n := public.notify_members(ev.id, 'event_soon', ev.name || ' é em menos de 24 horas!',
      coalesce('Local: ' || ev.location || '. ', '') || 'Não esqueça o presente.', '/grupo/' || ev.id);
    total := total + n;
    insert into public.reminder_log (event_id, kind) values (ev.id, 'auto_event_soon') on conflict do nothing;
  end loop;

  -- resultado ainda não visto 24 h depois do sorteio
  for ev in
    select e.* from public.events e
    where e.status = 'drawn' and e.archived_at is null and e.drawn_at < now() - interval '24 hours'
      and not exists (select 1 from public.reminder_log r where r.event_id = e.id and r.kind = 'auto_view_result_v' || e.draw_version)
  loop
    insert into public.notifications (user_id, event_id, kind, title, body, link)
    select p.user_id, ev.id, 'reminder', 'Você ainda não abriu o seu presente',
           'Descubra quem você tirou em ' || ev.name || '.', '/grupo/' || ev.id || '/revelacao'
    from public.participants p where p.event_id = ev.id and p.status = 'approved' and p.result_viewed_at is null;
    get diagnostics n = row_count; total := total + n;
    insert into public.reminder_log (event_id, kind) values (ev.id, 'auto_view_result_v' || ev.draw_version) on conflict do nothing;
  end loop;
  return total;
end $$;

create or replace function public.cron_auto_finish() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  ev record;
begin
  for ev in
    select e.* from public.events e
    where e.status = 'drawn' and e.reveal_at is not null and e.reveal_at < now() - interval '2 days'
      and not exists (select 1 from public.live_sessions l where l.event_id = e.id and l.status = 'running')
  loop
    update public.events set status = 'finished', finished_at = now() where id = ev.id;
    insert into public.event_log (event_id, kind, data) values (ev.id, 'finished', '{"automatico": true}'::jsonb);
    perform public.notify_members(ev.id, 'finished', ev.name || ' foi encerrado',
      'O álbum de memórias está aberto: mande suas fotos!', '/grupo/' || ev.id || '/album');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Fila de entrega por e-mail e push (o servidor reivindica um lote e informa o resultado)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.claim_notifications(p_limit int default 50) returns table (
  id uuid, user_id uuid, event_id uuid, kind text, title text, body text, link text,
  email text, send_email boolean, send_push boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with lote as (
    select n.id from public.notifications n
    where (n.email_status = 'pending' or n.push_status = 'pending') and n.created_at > now() - interval '2 days'
    order by n.created_at
    limit least(greatest(p_limit, 1), 200)
    for update skip locked
  ),
  info as (
    select n.id, n.user_id, n.event_id, n.kind, n.title, n.body, n.link,
      case when u.is_anonymous or u.email is null then null else u.email end::text as email,
      (n.email_status = 'pending' and coalesce(s.notify_email, true) and not coalesce(u.is_anonymous, false) and u.email is not null
        and n.kind in ('draw', 'redraw', 'reminder', 'event_soon', 'live_start', 'rules_changed', 'announcement', 'invite',
                       'approved', 'join_request', 'finished')) as quer_email,
      (n.push_status = 'pending' and coalesce(s.notify_push, true)
        and exists (select 1 from public.push_subscriptions ps where ps.user_id = n.user_id)) as quer_push
    from public.notifications n
    join lote l on l.id = n.id
    left join auth.users u on u.id = n.user_id
    left join public.user_settings s on s.user_id = n.user_id
  ),
  marca as (
    update public.notifications n set
      email_status = case when n.email_status <> 'pending' then n.email_status when i.quer_email then 'sending' else 'skipped' end,
      push_status = case when n.push_status <> 'pending' then n.push_status when i.quer_push then 'sending' else 'skipped' end
    from info i where i.id = n.id
    returning n.id
  )
  select i.id, i.user_id, i.event_id, i.kind, i.title, i.body, i.link, i.email, i.quer_email, i.quer_push
  from info i join marca m on m.id = i.id
  where i.quer_email or i.quer_push;
end $$;

create or replace function public.finish_notification_delivery(p_id uuid, p_channel text, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent', 'failed', 'skipped') then perform public.fail('invalid_status'); end if;
  if p_channel = 'email' then
    update public.notifications set email_status = p_status where id = p_id;
  elsif p_channel = 'push' then
    update public.notifications set push_status = p_status where id = p_id;
  else
    perform public.fail('invalid_channel');
  end if;
end $$;
