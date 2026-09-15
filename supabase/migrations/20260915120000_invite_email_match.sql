-- Приглашение принимает только владелец почты, на которую оно выписано.
--
-- Раньше accept_artist_invite() проверяла лишь токен: кто получил ссылку
-- (переслали, утекла из чата), тот и привязывал к лейблу любой свой аккаунт.
-- Почту берём из auth.users, а не из JWT: в токене она может отстать от
-- смены адреса. Сессия есть только у подтверждённой почты, так что владение
-- адресом уже доказано входом.

create or replace function public.accept_artist_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invite public.artist_invites;
  v_email text;
begin
  select * into v_invite from public.artist_invites
   where token = p_token
   for update;

  if not found then
    raise exception 'Приглашение не найдено';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Приглашение уже использовано';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Срок приглашения истёк';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null or lower(v_email) <> lower(v_invite.email) then
    raise exception 'Приглашение выписано на другую почту — войдите под адресом, на который оно пришло';
  end if;

  update public.artist_invites
     set accepted_at = now()
   where id = v_invite.id;  -- триггер artist_invites_on_accept свяжет артиста

  return v_invite.org_id;
end;
$function$;
