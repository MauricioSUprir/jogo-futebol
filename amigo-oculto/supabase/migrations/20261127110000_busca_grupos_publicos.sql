-- =====================================================================================================================
-- Amigo Oculto — busca de grupos públicos por nome (página Explorar).
-- Igual a public_events (mesmos campos, mesmas regras: só públicos, abertos, não arquivados e dentro do prazo), com um
-- filtro opcional pelo nome que ignora maiúsculas e acentos. Funciona para visitantes (anon), como a lista original.
-- =====================================================================================================================

create or replace function public.search_public_events(p_query text default null, p_limit int default 24, p_offset int default 0)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with termo as (
    select nullif(
      translate(lower(btrim(left(coalesce(p_query, ''), 80))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      ''
    ) as t
  )
  select coalesce(jsonb_agg(x order by x ->> 'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', e.id, 'name', e.name, 'description', left(e.description, 240), 'cover_path', e.cover_path, 'theme', e.theme,
      'reveal_at', e.reveal_at, 'gift_min', e.gift_min, 'gift_max', e.gift_max, 'invite_code', e.invite_code,
      'requires_approval', e.requires_approval, 'max_participants', e.max_participants, 'created_at', e.created_at,
      'participant_count', (select count(*) from public.participants p where p.event_id = e.id and p.status = 'approved'),
      'owner_name', (select display_name from public.profiles where id = e.owner_id)
    ) as x
    from public.events e, termo
    where e.visibility = 'public' and e.archived_at is null and e.status = 'open'
      and (e.join_deadline is null or e.join_deadline > now())
      and (
        termo.t is null
        or translate(lower(e.name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
           like '%' || replace(replace(replace(termo.t, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      )
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 24), 1), 60) offset greatest(coalesce(p_offset, 0), 0)
  ) s;
$$;

revoke execute on function public.search_public_events(text, int, int) from public;
grant execute on function public.search_public_events(text, int, int) to anon, authenticated;
