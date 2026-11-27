-- =====================================================================================================================
-- Amigo Oculto — correção do aviso de mudanças no evento.
-- Em events_after_update(), `mudou || 'regras'` (text[] || literal) era lido pelo Postgres como array || array e o
-- literal virava um array malformado: QUALQUER edição de regras, valor, data da revelação, local ou data do sorteio
-- falhava com "malformed array literal". Mesma função, com array_append. Os privilégios da função são mantidos
-- (create or replace não mexe neles).
-- =====================================================================================================================

create or replace function public.events_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  mudou text[] := '{}';
begin
  if new.rules is distinct from old.rules then mudou := array_append(mudou, 'regras'); end if;
  if new.gift_min is distinct from old.gift_min or new.gift_max is distinct from old.gift_max then
    mudou := array_append(mudou, 'valor do presente');
  end if;
  if new.reveal_at is distinct from old.reveal_at then mudou := array_append(mudou, 'data da revelação'); end if;
  if new.location is distinct from old.location then mudou := array_append(mudou, 'local'); end if;
  if new.draw_at is distinct from old.draw_at and new.draw_mode = 'scheduled' then
    mudou := array_append(mudou, 'data do sorteio');
  end if;
  if cardinality(mudou) > 0 then
    perform public.notify_members(new.id, 'rules_changed', 'Mudanças em ' || new.name,
      'Atualizado: ' || array_to_string(mudou, ', ') || '.', '/grupo/' || new.id, (select auth.uid()));
    perform public.log_event(new.id, 'rules_changed', jsonb_build_object('campos', to_jsonb(mudou)));
  end if;
  return new;
end $$;

revoke execute on function public.events_after_update() from public, anon, authenticated;
