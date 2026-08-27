-- Имя артиста при приёме приглашения.
--
-- Когда приглашение выписано на email без заранее заведённой строки artists,
-- триггер создавал артиста с именем из части адреса до «@». В ростере это
-- выглядело как «nova-artist-1787834964606», хотя при регистрации человек
-- указал «Nova Waves».
--
-- Берём имя из профиля (его заполняет handle_new_user из метаданных
-- регистрации) и падаем на прежнее поведение, только если там пусто.

CREATE OR REPLACE FUNCTION public.artist_invites_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_name text;
begin
  if new.accepted_at is not null and old.accepted_at is null then
    if new.artist_id is not null then
      update public.artists
        set user_id = coalesce(user_id, auth.uid()),
            status  = 'active'
        where id = new.artist_id;
    else
      select nullif(btrim(p.artist_name), '')
        into v_name
        from public.profiles p
       where p.id = auth.uid();

      insert into public.artists (org_id, user_id, stage_name, status)
      values (
        new.org_id,
        auth.uid(),
        coalesce(v_name, split_part(new.email, '@', 1)),
        'active'
      );
    end if;
  end if;
  return new;
end;
$$;
