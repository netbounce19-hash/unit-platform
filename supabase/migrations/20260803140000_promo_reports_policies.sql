-- Подтверждения промо-действий: артист присылает ссылку, менеджер принимает.
--
-- Таблица promo_reports заведена миграцией кабинета лейбла, но осталась без
-- единой политики при включённом RLS — то есть была недоступна и артисту,
-- и менеджеру. Здесь открываем ровно то, что нужно каждой стороне.

-- Артист заводит отчёт только от своего имени
CREATE POLICY "promo_reports: artist insert"
  ON public.promo_reports FOR INSERT
  WITH CHECK (artist_id = public.my_artist_id());

-- Свои отчёты видит артист, отчёты своей организации — сотрудники лейбла
CREATE POLICY "promo_reports: select own or org"
  ON public.promo_reports FOR SELECT
  USING (artist_id = public.my_artist_id() OR public.is_org_member(org_id));

-- Вердикт («принято» / «нужны правки») ставит только лейбл: без этого
-- артист мог бы сам себе проставить accepted
CREATE POLICY "promo_reports: label update"
  ON public.promo_reports FOR UPDATE
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- Пока менеджер не отсмотрел, артист может отозвать свой отчёт
CREATE POLICY "promo_reports: artist delete own"
  ON public.promo_reports FOR DELETE
  USING (artist_id = public.my_artist_id() AND status = 'submitted');
