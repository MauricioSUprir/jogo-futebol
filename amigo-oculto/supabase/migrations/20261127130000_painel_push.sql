-- =====================================================================================================================
-- Amigo Oculto — área D (painel pessoal, notificações e push):
--   * my_pending_invites(): os convites por e-mail que esperam a pessoa (o RLS de events não deixa quem ainda não
--     entrou ver o nome do grupo; aqui ela vê só os convites endereçados ao e-mail da própria sessão).
--   * register_push_subscription(): grava a inscrição de push deste aparelho para quem está logado. O endpoint é único
--     no banco: se o mesmo navegador já estava inscrito em outra conta (aparelho compartilhado), a inscrição passa para
--     a conta atual (o endpoint é um segredo que só o próprio navegador tem).
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- Convites pendentes da pessoa (pelo e-mail da sessão; convidado anônimo não tem e-mail)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.my_pending_invites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  meu_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null then perform public.fail('not_authenticated'); end if;
  if meu_email = '' or public.is_anonymous_user() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by x ->> 'invited_at' desc)
    from (
      select jsonb_build_object(
        'id', i.id,
        'event_id', e.id,
        'name', e.name,
        'theme', e.theme,
        'cover_path', e.cover_path,
        'reveal_at', e.reveal_at,
        'invite_code', e.invite_code,
        'invited_at', i.created_at,
        'invited_by', (select pr.display_name from public.profiles pr where pr.id = i.invited_by)
      ) as x
      from public.event_invites i
      join public.events e on e.id = i.event_id
      where lower(i.email) = meu_email
        and i.revoked_at is null
        and i.accepted_at is null
        and e.archived_at is null
        and e.status = 'open'
        and (e.join_deadline is null or e.join_deadline > now())
        and not exists (select 1 from public.participants p where p.event_id = e.id and p.user_id = uid)
      order by i.created_at desc
      limit 20
    ) s
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Inscrição de push deste aparelho
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then perform public.fail('not_authenticated'); end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000
     or coalesce(char_length(p_p256dh), 0) not between 1 and 200
     or coalesce(char_length(p_auth), 0) not between 1 and 100 then
    perform public.fail('invalid_subscription');
  end if;
  -- no máximo 10 aparelhos por pessoa: os mais antigos saem
  delete from public.push_subscriptions
  where id in (
    select ps.id from public.push_subscriptions ps
    where ps.user_id = uid and ps.endpoint <> p_endpoint
    order by ps.created_at desc
    offset 9
  );
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, nullif(left(btrim(coalesce(p_user_agent, '')), 300), ''));
  insert into public.user_settings (user_id, notify_push) values (uid, true)
  on conflict (user_id) do update set notify_push = true;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------------------------------------------------
revoke execute on function public.my_pending_invites() from public, anon;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.my_pending_invites() to authenticated;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
