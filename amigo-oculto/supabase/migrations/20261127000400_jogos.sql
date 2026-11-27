-- =====================================================================================================================
-- Amigo Oculto — minigames e interações: adivinhar quem te tirou, quiz, roleta de desafios, bingo, cápsula do tempo,
-- mural, cartões virtuais, ranking e estatísticas para as conquistas.
-- Nenhuma destas funções revela o sorteio: o palpite só tem resposta depois do encerramento e só para quem palpitou.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- Adivinhe quem te tirou
-- ---------------------------------------------------------------------------------------------------------------------
create table public.guesses (
  event_id uuid not null references public.events (id) on delete cascade,
  guesser_id uuid not null references public.participants (id) on delete cascade,
  guessed_id uuid not null references public.participants (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (event_id, guesser_id),
  check (guesser_id <> guessed_id)
);

create or replace function public.save_guess(p_event uuid, p_guessed uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
begin
  if eu is null then perform public.fail('forbidden'); end if;
  if (select status from public.events where id = p_event) <> 'drawn' then perform public.fail('guess_closed'); end if;
  if p_guessed = eu or not exists (select 1 from public.participants where id = p_guessed and event_id = p_event and status = 'approved') then
    perform public.fail('invalid_guess');
  end if;
  insert into public.guesses (event_id, guesser_id, guessed_id) values (p_event, eu, p_guessed)
  on conflict (event_id, guesser_id) do update set guessed_id = excluded.guessed_id, updated_at = now();
end $$;

-- O próprio palpite; acertou/errou só depois do encerramento (e só para quem palpitou).
create or replace function public.my_guess(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  st public.event_status;
  g public.guesses;
  real uuid;
  total int;
  acertos int;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  select status into st from public.events where id = p_event;
  select * into g from public.guesses where event_id = p_event and guesser_id = eu;
  if st <> 'finished' then
    return jsonb_build_object('status', st, 'guessed_id', g.guessed_id, 'updated_at', g.updated_at,
      'total_guesses', (select count(*) from public.guesses where event_id = p_event));
  end if;
  select giver_id into real from public.assignments where event_id = p_event and receiver_id = eu;
  select count(*), count(*) filter (where exists (
    select 1 from public.assignments a where a.event_id = p_event and a.receiver_id = gg.guesser_id and a.giver_id = gg.guessed_id))
  into total, acertos from public.guesses gg where gg.event_id = p_event;
  return jsonb_build_object('status', st, 'guessed_id', g.guessed_id, 'updated_at', g.updated_at,
    'correct', case when g.guessed_id is null then null else g.guessed_id = real end,
    'total_guesses', total, 'total_correct', acertos);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Quiz sobre os participantes (cada um faz perguntas sobre si mesmo)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  subject_id uuid not null references public.participants (id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 3 and 200),
  options text[] not null check (cardinality(options) between 2 and 4),
  correct_index smallint not null,
  created_at timestamptz not null default now(),
  check (correct_index >= 0 and correct_index < cardinality(options))
);
create index quiz_questions_event_idx on public.quiz_questions (event_id, created_at);

create table public.quiz_answers (
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  choice smallint not null,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (question_id, participant_id)
);

create or replace function public.quiz_create(p_event uuid, p_question text, p_options text[], p_correct int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  ops text[];
  novo uuid;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  select array_agg(btrim(o)) into ops from unnest(p_options) o where char_length(btrim(o)) between 1 and 80;
  if cardinality(ops) < 2 or cardinality(ops) > 4 or cardinality(ops) <> cardinality(p_options) then perform public.fail('quiz_options'); end if;
  if p_correct is null or p_correct < 0 or p_correct >= cardinality(ops) then perform public.fail('quiz_options'); end if;
  if (select count(*) from public.quiz_questions where subject_id = eu) >= 10 then perform public.fail('quiz_full'); end if;
  insert into public.quiz_questions (event_id, subject_id, question, options, correct_index)
  values (p_event, eu, btrim(p_question), ops, p_correct) returning id into novo;
  return novo;
end $$;

create or replace function public.quiz_list(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
begin
  if eu is null then perform public.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'question', q.question, 'options', to_jsonb(q.options), 'created_at', q.created_at,
      'subject_id', q.subject_id, 'subject_name', pr.display_name, 'subject_avatar', pr.avatar_path,
      'mine', q.subject_id = eu,
      'my_choice', a.choice, 'my_correct', a.is_correct,
      'correct_index', case when q.subject_id = eu or a.choice is not null then q.correct_index end,
      'answers', (select count(*) from public.quiz_answers x where x.question_id = q.id),
      'right_answers', (select count(*) from public.quiz_answers x where x.question_id = q.id and x.is_correct)
    ) order by q.created_at)
    from public.quiz_questions q
    join public.participants p on p.id = q.subject_id
    join public.profiles pr on pr.id = p.user_id
    left join public.quiz_answers a on a.question_id = q.id and a.participant_id = eu
    where q.event_id = p_event), '[]'::jsonb);
end $$;

create or replace function public.quiz_answer(p_question uuid, p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q public.quiz_questions;
  eu uuid;
  certo boolean;
begin
  select * into q from public.quiz_questions where id = p_question;
  if not found then perform public.fail('not_found'); end if;
  eu := public.my_participant_id(q.event_id);
  if eu is null then perform public.fail('forbidden'); end if;
  if q.subject_id = eu then perform public.fail('quiz_own'); end if;
  if p_choice < 0 or p_choice >= cardinality(q.options) then perform public.fail('quiz_options'); end if;
  if exists (select 1 from public.quiz_answers where question_id = p_question and participant_id = eu) then
    perform public.fail('quiz_answered');
  end if;
  certo := p_choice = q.correct_index;
  insert into public.quiz_answers (question_id, participant_id, choice, is_correct) values (p_question, eu, p_choice, certo);
  return jsonb_build_object('correct', certo, 'correct_index', q.correct_index);
end $$;

create or replace function public.quiz_delete(p_question uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q public.quiz_questions;
begin
  select * into q from public.quiz_questions where id = p_question;
  if not found then perform public.fail('not_found'); end if;
  if q.subject_id is distinct from public.my_participant_id(q.event_id) and not public.is_event_admin(q.event_id) then
    perform public.fail('forbidden');
  end if;
  delete from public.quiz_questions where id = p_question;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Roleta de desafios leves e opcionais
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.challenge_catalog() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'Conte a lembrança mais engraçada que você tem com alguém do grupo.',
    'Faça um elogio sincero para a pessoa à sua direita.',
    'Imite o seu personagem de filme favorito por 10 segundos.',
    'Cante o refrão de uma música de fim de ano.',
    'Conte qual foi o melhor presente que você já ganhou.',
    'Faça uma pose para a foto do grupo.',
    'Diga três palavras que descrevem este ano para você.',
    'Conte uma meta sua para o próximo ano.',
    'Faça a sua melhor dança de comemoração por 10 segundos.',
    'Conte um talento escondido seu.',
    'Diga qual é a sua comida de festa preferida e por quê.',
    'Agradeça alguém do grupo por algo deste ano.',
    'Conte uma piada (vale piada ruim).',
    'Descreva o presente dos sonhos em uma frase.',
    'Fale uma curiosidade sobre você que pouca gente sabe.',
    'Escolha uma música para tocar agora.',
    'Faça um brinde com uma mensagem para todos.',
    'Conte qual foi o dia mais feliz do seu ano.',
    'Imite um animal até alguém adivinhar qual é.',
    'Diga qual superpoder você escolheria e por quê.',
    'Conte o seu filme ou série favorito do ano.',
    'Mande um áudio carinhoso para alguém da família.',
    'Faça um desenho rápido do seu amigo oculto (sem mostrar!).',
    'Diga um apelido carinhoso para cada pessoa da sua mesa.',
    'Conte uma viagem que você ainda quer fazer.',
    'Fale uma qualidade sua de que você se orgulha.',
    'Escolha alguém para tirar uma selfie com você.',
    'Conte qual tradição de fim de ano você mais gosta.',
    'Diga o que você faria com um dia inteiro livre.',
    'Faça uma rima com o nome de alguém do grupo.'
  ]::text[];
$$;

create table public.challenge_spins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  challenge_index int not null,
  challenge_text text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index challenge_spins_event_idx on public.challenge_spins (event_id, created_at desc);

create or replace function public.spin_challenge(p_event uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  cat text[] := public.challenge_catalog();
  i int;
  novo public.challenge_spins;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  if exists (select 1 from public.challenge_spins where participant_id = eu and status = 'pending') then
    perform public.fail('challenge_pending');
  end if;
  if (select count(*) from public.challenge_spins where participant_id = eu and created_at > now() - interval '1 hour') >= 10 then
    perform public.fail('rate_limited');
  end if;
  i := public.secure_random_int(cardinality(cat));
  insert into public.challenge_spins (event_id, participant_id, challenge_index, challenge_text)
  values (p_event, eu, i, cat[i + 1]) returning * into novo;
  return jsonb_build_object('id', novo.id, 'index', i, 'text', novo.challenge_text, 'total', cardinality(cat));
end $$;

create or replace function public.update_challenge(p_spin uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.challenge_spins;
begin
  select * into s from public.challenge_spins where id = p_spin;
  if not found then perform public.fail('not_found'); end if;
  if s.participant_id is distinct from public.my_participant_id(s.event_id) then perform public.fail('forbidden'); end if;
  if p_status not in ('done', 'skipped') then perform public.fail('invalid_status'); end if;
  update public.challenge_spins set status = p_status, updated_at = now() where id = p_spin;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Bingo natalino (75 itens; o texto de cada número fica no app)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.bingo_games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'running', 'finished')),
  called int[] not null default '{}',
  winners uuid[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index bingo_games_event_idx on public.bingo_games (event_id, created_at desc);

create table public.bingo_cards (
  game_id uuid not null references public.bingo_games (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  cells int[] not null check (cardinality(cells) = 25),
  marked int[] not null default '{12}',
  bingo_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (game_id, participant_id)
);

create or replace function public.bingo_new(p_event uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  novo uuid;
begin
  if not public.is_event_admin(p_event) then perform public.fail('forbidden'); end if;
  update public.bingo_games set status = 'finished', finished_at = now() where event_id = p_event and status <> 'finished';
  insert into public.bingo_games (event_id) values (p_event) returning id into novo;
  perform public.notify_members(p_event, 'bingo', 'Bingo natalino aberto!', 'Pegue a sua cartela antes do início.',
    '/grupo/' || p_event || '/jogos/bingo', auth.uid());
  return novo;
end $$;

-- 24 números diferentes de 0 a 74, embaralhados com aleatoriedade criptográfica; o centro (posição 12) é livre (-1).
create or replace function public.bingo_join(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.bingo_games;
  eu uuid;
  nums int[];
begin
  select * into g from public.bingo_games where id = p_game;
  if not found then perform public.fail('not_found'); end if;
  eu := public.my_participant_id(g.event_id);
  if eu is null then perform public.fail('forbidden'); end if;
  if g.status = 'finished' then perform public.fail('bingo_finished'); end if;
  if exists (select 1 from public.bingo_cards where game_id = p_game and participant_id = eu) then return; end if;
  select array_agg(n) into nums from (
    select n from generate_series(0, 74) n order by extensions.gen_random_bytes(8) limit 24
  ) s;
  nums := nums[1:12] || array[-1] || nums[13:24];
  insert into public.bingo_cards (game_id, participant_id, cells) values (p_game, eu, nums);
end $$;

create or replace function public.bingo_call(p_game uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  g public.bingo_games;
  restantes int[];
  n int;
begin
  select * into g from public.bingo_games where id = p_game for update;
  if not found then perform public.fail('not_found'); end if;
  if not public.is_event_admin(g.event_id) then perform public.fail('forbidden'); end if;
  if g.status = 'finished' then perform public.fail('bingo_finished'); end if;
  select array_agg(x) into restantes from generate_series(0, 74) x where not (x = any (g.called));
  if restantes is null then perform public.fail('bingo_empty'); end if;
  n := restantes[public.secure_random_int(cardinality(restantes)) + 1];
  update public.bingo_games set called = called || n, status = 'running', started_at = coalesce(started_at, now())
  where id = p_game;
  return n;
end $$;

create or replace function public.bingo_mark(p_game uuid, p_position int) returns int[]
language plpgsql security definer set search_path = '' as $$
declare
  g public.bingo_games;
  c public.bingo_cards;
  eu uuid;
begin
  select * into g from public.bingo_games where id = p_game;
  if not found then perform public.fail('not_found'); end if;
  eu := public.my_participant_id(g.event_id);
  select * into c from public.bingo_cards where game_id = p_game and participant_id = eu;
  if not found then perform public.fail('forbidden'); end if;
  if p_position < 0 or p_position > 24 or p_position = 12 then perform public.fail('invalid_cell'); end if;
  if p_position = any (c.marked) then
    update public.bingo_cards set marked = array_remove(marked, p_position) where game_id = p_game and participant_id = eu
    returning marked into c.marked;
  else
    if not (c.cells[p_position + 1] = any (g.called)) then perform public.fail('bingo_not_called'); end if;
    update public.bingo_cards set marked = marked || p_position where game_id = p_game and participant_id = eu
    returning marked into c.marked;
  end if;
  return c.marked;
end $$;

create or replace function public.bingo_claim(p_game uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  g public.bingo_games;
  c public.bingo_cards;
  eu uuid;
  linhas int[][] := array[
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]];
  i int;
  ok boolean := false;
  nome text;
begin
  select * into g from public.bingo_games where id = p_game for update;
  if not found then perform public.fail('not_found'); end if;
  eu := public.my_participant_id(g.event_id);
  select * into c from public.bingo_cards where game_id = p_game and participant_id = eu;
  if not found then perform public.fail('forbidden'); end if;
  if c.bingo_at is not null then return true; end if;
  for i in 1..12 loop
    if (select bool_and(pos = 12 or (pos = any (c.marked) and c.cells[pos + 1] = any (g.called)))
        from unnest(linhas[i:i][1:5]) pos) then
      ok := true;
      exit;
    end if;
  end loop;
  if not ok then return false; end if;
  update public.bingo_cards set bingo_at = now() where game_id = p_game and participant_id = eu;
  update public.bingo_games set winners = winners || eu where id = p_game;
  select pr.display_name into nome from public.participants p join public.profiles pr on pr.id = p.user_id where p.id = eu;
  perform public.log_event(g.event_id, 'bingo', jsonb_build_object('nome', nome));
  perform public.notify_members(g.event_id, 'bingo', 'BINGO! ' || nome || ' completou uma linha', null,
    '/grupo/' || g.event_id || '/jogos/bingo', auth.uid());
  return true;
end $$;

create or replace function public.bingo_finish(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.bingo_games;
begin
  select * into g from public.bingo_games where id = p_game;
  if not found then perform public.fail('not_found'); end if;
  if not public.is_event_admin(g.event_id) then perform public.fail('forbidden'); end if;
  update public.bingo_games set status = 'finished', finished_at = now() where id = p_game;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Cápsula do tempo (lacrada até a data escolhida: nem o grupo lê antes)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  open_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index time_capsules_event_idx on public.time_capsules (event_id, open_at);

create or replace function public.capsule_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.time_capsules where event_id = new.event_id and user_id = new.user_id) >= 5 then
    perform public.fail('capsule_full');
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger time_capsules_limit before insert on public.time_capsules for each row execute function public.capsule_limit();

-- Contagem das cápsulas lacradas (sem conteúdo), para o grupo saber quantas existem e quando abrem.
create or replace function public.capsule_summary(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_event_member(p_event) then perform public.fail('forbidden'); end if;
  return jsonb_build_object(
    'sealed', (select count(*) from public.time_capsules where event_id = p_event and open_at > now()),
    'next_open_at', (select min(open_at) from public.time_capsules where event_id = p_event and open_at > now()),
    'opened', (select count(*) from public.time_capsules where event_id = p_event and open_at <= now())
  );
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Mural de mensagens
-- ---------------------------------------------------------------------------------------------------------------------
create table public.wall_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  color text not null default 'ouro' check (color in ('ouro', 'vermelho', 'verde', 'neve', 'rosa', 'azul')),
  created_at timestamptz not null default now()
);
create index wall_posts_event_idx on public.wall_posts (event_id, created_at desc);

create or replace function public.wall_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.wall_posts where user_id = new.user_id and event_id = new.event_id
      and created_at > now() - interval '10 minutes') >= 10 then
    perform public.fail('rate_limited');
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger wall_posts_rate before insert on public.wall_posts for each row execute function public.wall_rate_limit();

-- ---------------------------------------------------------------------------------------------------------------------
-- Cartões virtuais (assinados para qualquer pessoa do grupo, ou anônimos só para quem você tirou)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid not null references public.participants (id) on delete cascade,
  recipient_id uuid not null references public.participants (id) on delete cascade,
  anonymous boolean not null default false,
  template text not null check (template in ('estrela', 'arvore', 'presente', 'neve', 'bolo', 'balao', 'classico', 'brinde')),
  title text check (title is null or char_length(title) <= 80),
  body text not null check (char_length(btrim(body)) between 1 and 600),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index cards_recipient_idx on public.cards (recipient_id, created_at desc);
create index cards_sender_idx on public.cards (sender_id, created_at desc);

create or replace function public.send_card(
  p_event uuid, p_recipient uuid, p_template text, p_title text, p_body text, p_anonymous boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  destino uuid;
  novo uuid;
  nome_eu text;
  nome_evento text;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  if not exists (select 1 from public.participants where id = p_recipient and event_id = p_event and status = 'approved') then
    perform public.fail('participant_not_found');
  end if;
  if coalesce(p_anonymous, false) and not exists (
    select 1 from public.assignments where event_id = p_event and giver_id = eu and receiver_id = p_recipient
  ) then
    perform public.fail('card_anonymous_only_receiver');
  end if;
  if (select count(*) from public.cards where sender_id = eu and created_at > now() - interval '1 hour') >= 20 then
    perform public.fail('rate_limited');
  end if;
  insert into public.cards (event_id, sender_id, recipient_id, anonymous, template, title, body)
  values (p_event, eu, p_recipient, coalesce(p_anonymous, false), p_template, nullif(btrim(p_title), ''), btrim(p_body))
  returning id into novo;
  select user_id into destino from public.participants where id = p_recipient;
  select pr.display_name into nome_eu from public.profiles pr where pr.id = auth.uid();
  select name into nome_evento from public.events where id = p_event;
  perform public.notify(destino, p_event, 'card',
    case when p_anonymous then 'Você recebeu um cartão do seu amigo oculto' else nome_eu || ' te mandou um cartão' end,
    'Em ' || nome_evento || '.', '/grupo/' || p_event || '/jogos/cartoes');
  return novo;
end $$;

create or replace function public.my_cards(p_event uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := public.my_participant_id(p_event);
  r jsonb;
begin
  if eu is null then perform public.fail('forbidden'); end if;
  select jsonb_build_object(
    'received', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'template', c.template, 'title', c.title, 'body', c.body, 'created_at', c.created_at,
        'read_at', c.read_at, 'anonymous', c.anonymous,
        'sender_name', case when c.anonymous then null else pr.display_name end,
        'sender_avatar', case when c.anonymous then null else pr.avatar_path end) order by c.created_at desc)
      from public.cards c
      join public.participants p on p.id = c.sender_id join public.profiles pr on pr.id = p.user_id
      where c.recipient_id = eu), '[]'::jsonb),
    'sent', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'template', c.template, 'title', c.title, 'body', c.body, 'created_at', c.created_at,
        'anonymous', c.anonymous, 'recipient_name', pr.display_name, 'recipient_avatar', pr.avatar_path) order by c.created_at desc)
      from public.cards c
      join public.participants p on p.id = c.recipient_id join public.profiles pr on pr.id = p.user_id
      where c.sender_id = eu), '[]'::jsonb)
  ) into r;
  update public.cards set read_at = now() where recipient_id = eu and read_at is null;
  return r;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Ranking de participação e estatísticas (para as conquistas). Não conta mensagens anônimas.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.participation_stats(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_event_member(p_event) then perform public.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(x order by (x ->> 'points')::int desc, x ->> 'display_name')
    from (
      select jsonb_build_object(
        'participant_id', p.id, 'user_id', p.user_id, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path,
        'chat', c.chat, 'wall', c.wall, 'votes', c.votes, 'quiz_answers', c.quiz_answers, 'quiz_correct', c.quiz_correct,
        'quiz_questions', c.quiz_questions, 'wishlist', c.wishlist, 'cards', c.cards, 'capsules', c.capsules,
        'challenges', c.challenges, 'bingo', c.bingo, 'photos', c.photos,
        'rsvp', p.rsvp is not null, 'gift_bought', p.gift_bought, 'viewed', p.result_viewed_at is not null,
        'points', least(c.chat, 30) * 1 + least(c.wall, 10) * 3 + c.votes * 3 + c.quiz_answers * 3 + c.quiz_correct * 5
          + least(c.quiz_questions, 5) * 5 + least(c.wishlist, 5) * 4 + least(c.cards, 10) * 4 + least(c.capsules, 3) * 5
          + c.challenges * 6 + c.bingo * 15 + least(c.photos, 10) * 3
          + case when p.rsvp is not null then 10 else 0 end + case when p.gift_bought then 15 else 0 end
          + case when p.result_viewed_at is not null then 10 else 0 end
      ) as x
      from public.participants p
      join public.profiles pr on pr.id = p.user_id
      cross join lateral (
        select
          (select count(*) from public.chat_messages m where m.event_id = p_event and m.user_id = p.user_id and m.deleted_at is null)::int as chat,
          (select count(*) from public.wall_posts w where w.event_id = p_event and w.user_id = p.user_id)::int as wall,
          (select count(distinct v.poll_id) from public.poll_votes v join public.polls po on po.id = v.poll_id
            where po.event_id = p_event and v.user_id = p.user_id)::int as votes,
          (select count(*) from public.quiz_answers a where a.participant_id = p.id)::int as quiz_answers,
          (select count(*) from public.quiz_answers a where a.participant_id = p.id and a.is_correct)::int as quiz_correct,
          (select count(*) from public.quiz_questions q where q.subject_id = p.id)::int as quiz_questions,
          (select count(*) from public.wishlist_items w where w.user_id = p.user_id)::int as wishlist,
          (select count(*) from public.cards cc where cc.sender_id = p.id)::int as cards,
          (select count(*) from public.time_capsules t where t.event_id = p_event and t.user_id = p.user_id)::int as capsules,
          (select count(*) from public.challenge_spins s where s.participant_id = p.id and s.status = 'done')::int as challenges,
          (select count(*) from public.bingo_cards b where b.participant_id = p.id and b.bingo_at is not null)::int as bingo,
          (select count(*) from public.album_photos ph where ph.event_id = p_event and ph.uploader_id = p.user_id)::int as photos
      ) c
      where p.event_id = p_event and p.status = 'approved'
    ) s), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.guesses enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.challenge_spins enable row level security;
alter table public.bingo_games enable row level security;
alter table public.bingo_cards enable row level security;
alter table public.time_capsules enable row level security;
alter table public.wall_posts enable row level security;
alter table public.cards enable row level security;

revoke all on public.guesses, public.quiz_questions, public.quiz_answers, public.challenge_spins, public.bingo_games,
  public.bingo_cards, public.time_capsules, public.wall_posts, public.cards from anon, authenticated;

-- palpites, quiz e cartões: só pelas funções (nenhuma permissão direta)

grant select on public.challenge_spins to authenticated;
create policy spins_select on public.challenge_spins for select to authenticated using (public.is_event_member(event_id));

grant select on public.bingo_games to authenticated;
create policy bingo_games_select on public.bingo_games for select to authenticated using (public.is_event_member(event_id));
grant select on public.bingo_cards to authenticated;
create policy bingo_cards_select on public.bingo_cards for select to authenticated
  using (exists (select 1 from public.participants p where p.id = participant_id and p.user_id = (select auth.uid())));

grant select, insert, delete on public.time_capsules to authenticated;
create policy capsules_select on public.time_capsules for select to authenticated
  using (user_id = (select auth.uid()) or (open_at <= now() and public.is_event_member(event_id)));
create policy capsules_insert on public.time_capsules for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_event_member(event_id)
              and open_at > now() + interval '1 hour' and open_at < now() + interval '5 years');
create policy capsules_delete on public.time_capsules for delete to authenticated
  using (user_id = (select auth.uid()) and open_at > now());

grant select, insert, delete on public.wall_posts to authenticated;
create policy wall_select on public.wall_posts for select to authenticated using (public.is_event_member(event_id));
create policy wall_insert on public.wall_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_chat(event_id));
create policy wall_delete on public.wall_posts for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_event_admin(event_id));

revoke execute on function public.wall_rate_limit() from public, anon, authenticated;
revoke execute on function public.capsule_limit() from public, anon, authenticated;
