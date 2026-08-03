-- Релизы артиста доходят до менеджера.
--
-- Раньше артистский кабинет создавал релиз с org_id = NULL и статусом
-- 'upcoming', а кабинет лейбла читал релизы через .eq(org_id), поэтому
-- менеджер физически не видел ничего, что создал артист, и «принято ли
-- менеджером» показать было неоткуда.
--
-- Здесь: выпиливаем неиспользуемую артистскую колонку даты, оставляем
-- единственную planned_date, сводим два словаря статусов в один и
-- закрываем дыру — без триггера владелец релиза мог сам проставить себе
-- status = 'approved'.

-- 1. Артистская text-колонка даты не заполнялась ни одним кодовым путём:
--    UI для неё не существовал, в карусели вместо даты показывалось
--    «Создан <дата создания>». Единственная дата теперь — planned_date.
ALTER TABLE public.releases DROP COLUMN IF EXISTS release_date;

-- 2. Легаси-статусы артистского кабинета переводим в общий словарь.
--    'upcoming' означал «готовится» — это ровно pending_approval.
--    Делаем это до создания триггера: он запретил бы такой UPDATE.
UPDATE public.releases SET status = 'pending_approval' WHERE status = 'upcoming';
UPDATE public.releases SET status = 'released' WHERE status = 'live';

-- 3. Словарь статусов теперь один.
ALTER TABLE public.releases DROP CONSTRAINT IF EXISTS releases_status_check;
ALTER TABLE public.releases ADD CONSTRAINT releases_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'pending_approval', 'approved', 'in_progress', 'released', 'rejected'
  ]));

ALTER TABLE public.releases ALTER COLUMN status SET DEFAULT 'pending_approval';

-- 4. Вердикт по релизу ставит только сотрудник лейбла.
--    RLS разрешает владельцу обновлять свою строку целиком (это нужно для
--    названия, обложки и даты), поэтому ограничение по колонкам делаем
--    триггером, а не политикой.
CREATE OR REPLACE FUNCTION public.guard_release_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Сервисный контекст (миграции, бэкофис) — без ограничений
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Сотрудник лейбла решает всё
  IF NEW.org_id IS NOT NULL AND public.is_org_member(NEW.org_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Артист не заводит уже утверждённый релиз
    NEW.status := 'pending_approval';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Статус приёмки релиза меняет только сотрудник лейбла';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS releases_guard_decision ON public.releases;
CREATE TRIGGER releases_guard_decision
BEFORE INSERT OR UPDATE ON public.releases
FOR EACH ROW EXECUTE FUNCTION public.guard_release_decision();
