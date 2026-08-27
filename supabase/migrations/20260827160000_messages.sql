-- Переписка артиста с менеджером.
--
-- До этого у каждой стороны был свой Map в памяти вкладки: артист писал
-- в lib/label/mockMessages из своего кабинета, менеджер — из своего, и
-- друг друга они не видели. Всё стиралось при перезагрузке.
--
-- Ветка одна на артиста: (org_id, artist_id). Обе стороны пишут в неё,
-- from_side говорит, кто автор реплики.

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  from_side text NOT NULL CHECK (from_side IN ('artist', 'label')),
  body text NOT NULL DEFAULT '',
  -- Прикреплённая задача, файл или заявка: {type, title, meta}.
  -- Менеджер отправляет их из быстрых действий в переписке.
  attachment jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Пустая реплика имеет смысл только если она несёт вложение
  CONSTRAINT messages_body_check CHECK (length(btrim(body)) > 0 OR attachment IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS messages_thread_idx
  ON public.messages(artist_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Ветку видят обе её стороны: сам артист и сотрудники его лейбла
CREATE POLICY "messages: select own thread or org"
  ON public.messages FOR SELECT
  USING (artist_id = public.my_artist_id() OR public.is_org_member(org_id));

-- Нельзя писать от чужого имени: сторона реплики должна совпадать с тем,
-- кто её вставляет, а sender_id — с текущим пользователем
CREATE POLICY "messages: insert as self"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (from_side = 'artist' AND artist_id = public.my_artist_id())
      OR (from_side = 'label' AND public.is_org_member(org_id))
    )
  );

-- Свою реплику можно удалить, чужую — нет. Правок не предусмотрено:
-- переписка должна оставаться тем, что в ней написали.
CREATE POLICY "messages: delete own"
  ON public.messages FOR DELETE
  USING (sender_id = auth.uid());
