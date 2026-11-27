-- =====================================================================================================================
-- Convite por e-mail sem e-mail em dobro: a ação do organizador já manda o convite direto para cada endereço; a
-- notificação 'invite' (para quem já tem conta) fica só no app e no push. Mesma função, sem 'invite' na lista de e-mail.
-- =====================================================================================================================

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
        and n.kind in ('draw', 'redraw', 'reminder', 'event_soon', 'live_start', 'rules_changed', 'announcement',
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

revoke execute on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
