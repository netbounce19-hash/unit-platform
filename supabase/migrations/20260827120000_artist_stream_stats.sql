-- Показатели артиста: стримы и слушатели.
--
-- До этого цифры жили в lib/label/mockStreams — Map в памяти вкладки.
-- Менеджер вводил их у себя, артист не видел ничего, а после перезагрузки
-- значения пересеивались случайными. Раздел «Статистика» в кабинете
-- артиста без этой таблицы показывал бы выдуманные числа.
--
-- Одна строка на артиста: форма загрузки у менеджера перезаписывает
-- текущее значение, истории по периодам она не собирает.

CREATE TABLE IF NOT EXISTS public.artist_stream_stats (
  artist_id uuid PRIMARY KEY REFERENCES public.artists(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  streams bigint NOT NULL DEFAULT 0 CHECK (streams >= 0),
  listeners bigint NOT NULL DEFAULT 0 CHECK (listeners >= 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artist_stream_stats_org_idx
  ON public.artist_stream_stats(org_id);

ALTER TABLE public.artist_stream_stats ENABLE ROW LEVEL SECURITY;

-- Свои цифры видит артист, цифры своей организации — сотрудники лейбла
CREATE POLICY "stream stats: select own or org"
  ON public.artist_stream_stats FOR SELECT
  USING (artist_id = public.my_artist_id() OR public.is_org_member(org_id));

-- Вводит только лейбл: артист не должен рисовать себе стримы,
-- по которым его же и оценивают в рейтинге
CREATE POLICY "stream stats: label insert"
  ON public.artist_stream_stats FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "stream stats: label update"
  ON public.artist_stream_stats FOR UPDATE
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));
