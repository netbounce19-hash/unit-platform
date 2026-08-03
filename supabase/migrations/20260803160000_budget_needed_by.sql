-- «Когда нужны средства» + доставка заявки менеджеру.
--
-- Заявки артиста повторяли историю релизов: createBudgetRequest заполнял
-- только owner_id, поэтому org_id оставался NULL, а кабинет лейбла читает
-- заявки через .eq(org_id) — менеджер их не видел. Срок «когда нужны
-- деньги» адресован именно менеджеру, так что без привязки поле было бы
-- некому читать.

-- 1. Срок, к которому нужны средства
ALTER TABLE public.budget_requests ADD COLUMN IF NOT EXISTS needed_by date;

-- 2. Вердикт по заявке ставит только сотрудник лейбла.
--    RLS разрешает владельцу обновлять свою строку целиком (нужно для
--    правок описания и суммы), поэтому решение защищаем триггером —
--    иначе артист мог бы сам себе проставить approved.
CREATE OR REPLACE FUNCTION public.guard_budget_decision()
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
    NEW.status := 'pending';
    NEW.decided_by := NULL;
    NEW.decided_at := NULL;
    NEW.decision_comment := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.decision_comment IS DISTINCT FROM OLD.decision_comment THEN
    RAISE EXCEPTION 'Решение по заявке принимает только сотрудник лейбла';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budget_requests_guard_decision ON public.budget_requests;
CREATE TRIGGER budget_requests_guard_decision
BEFORE INSERT OR UPDATE ON public.budget_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_budget_decision();

-- 3. Существующие заявки артистов подвязываем к их лейблу, иначе они
--    так и останутся невидимыми для менеджера.
UPDATE public.budget_requests b
SET org_id = a.org_id, artist_id = a.id
FROM public.artists a
WHERE a.user_id = b.owner_id AND b.org_id IS NULL;
