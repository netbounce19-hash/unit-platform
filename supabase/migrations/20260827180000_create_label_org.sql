-- Самостоятельная регистрация лейбла.
--
-- Завести организацию было нельзя: у organizations нет INSERT-политики,
-- а memberships требует is_org_member(org_id) — то есть уже быть внутри
-- той организации, которую только собираешься создать. Замкнутый круг,
-- из-за которого кабинет лейбла существовал только для засеянных вручную
-- аккаунтов.
--
-- Разрывать его политиками нельзя: открытый INSERT в organizations
-- позволил бы кому угодно плодить организации и вступать в чужие.
-- Поэтому одна security-definer функция, которая делает обе вставки
-- атомарно и только для самого себя.

CREATE OR REPLACE FUNCTION public.create_label_org(org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  clean text := btrim(org_name);
  new_id uuid;
  existing uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Нужно войти в аккаунт';
  END IF;

  IF clean = '' THEN
    RAISE EXCEPTION 'Название лейбла не может быть пустым';
  END IF;

  -- Уже состоит в лейбле — возвращаем его, а не плодим второй
  SELECT org_id INTO existing FROM public.memberships WHERE user_id = uid LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.organizations (name) VALUES (clean) RETURNING id INTO new_id;

  -- Создатель становится администратором своего лейбла
  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (new_id, uid, 'label_admin');

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_label_org(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_label_org(text) TO authenticated;
