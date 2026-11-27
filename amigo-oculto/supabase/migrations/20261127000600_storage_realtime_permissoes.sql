-- =====================================================================================================================
-- Amigo Oculto — buckets do Storage, publicação do Realtime e permissões finais das funções.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- Storage
--   media (público, só imagens, 5 MB): fotos de perfil, capas e fotos da lista de desejos; cada um grava só na pasta
--         com o próprio id ({user_id}/{arquivo}); nomes aleatórios.
--   album (privado, 8 MB): {event_id}/{user_id}/{arquivo}; só membros do grupo leem (URL assinada); só grava quem é
--         membro, com o álbum aberto e na própria pasta; apaga quem mandou ou o organizador.
-- ---------------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('album', 'album', false, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- o próprio usuário lista a sua pasta (o público lê pela URL pública do bucket)
create policy media_select_own on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy album_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'album' and public.is_event_member(public.try_uuid((storage.foldername(name))[1])));
create policy album_obj_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'album'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_event_member(public.try_uuid((storage.foldername(name))[1]))
    and public.album_open(public.try_uuid((storage.foldername(name))[1]))
  );
create policy album_obj_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'album'
    and ((storage.foldername(name))[2] = (select auth.uid())::text
         or public.is_event_admin(public.try_uuid((storage.foldername(name))[1])))
  );

-- ---------------------------------------------------------------------------------------------------------------------
-- Realtime (postgres_changes respeita o RLS de cada assinante)
-- ---------------------------------------------------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.events, public.participants, public.notifications, public.announcements, public.chat_messages, public.polls,
  public.poll_votes, public.live_sessions, public.live_reveals, public.live_clues, public.bingo_games,
  public.challenge_spins, public.wall_posts, public.album_photos, public.event_log;

-- ---------------------------------------------------------------------------------------------------------------------
-- Permissões das funções
--   1) ninguém de fora (anon/public) executa nada por padrão;
--   2) authenticated executa as funções do app (cada uma confere quem chama);
--   3) as do servidor (sorteio, cron, fila de entrega) só o service_role;
--   4) a prévia do convite e a lista de grupos públicos também para visitantes (anon).
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
  end loop;
end $$;

alter default privileges in schema public revoke execute on functions from public, anon;

revoke execute on function public.draw_input(uuid) from authenticated;
revoke execute on function public.commit_draw(uuid, jsonb, int, uuid, boolean, boolean, text) from authenticated;
revoke execute on function public.cron_due_draws() from authenticated;
revoke execute on function public.cron_reminders() from authenticated;
revoke execute on function public.cron_auto_finish() from authenticated;
revoke execute on function public.claim_notifications(int) from authenticated;
revoke execute on function public.finish_notification_delivery(uuid, text, text) from authenticated;
revoke execute on function public.fail(text) from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
revoke execute on function public.events_before_update() from authenticated;
revoke execute on function public.events_after_update() from authenticated;
revoke execute on function public.participants_before_update() from authenticated;
revoke execute on function public._admin_of_participant(uuid) from authenticated;

grant execute on function public.draw_input(uuid) to service_role;
grant execute on function public.commit_draw(uuid, jsonb, int, uuid, boolean, boolean, text) to service_role;
grant execute on function public.cron_due_draws() to service_role;
grant execute on function public.cron_reminders() to service_role;
grant execute on function public.cron_auto_finish() to service_role;
grant execute on function public.claim_notifications(int) to service_role;
grant execute on function public.finish_notification_delivery(uuid, text, text) to service_role;

grant execute on function public.event_preview(text) to anon, authenticated;
grant execute on function public.public_events(int, int) to anon, authenticated;
