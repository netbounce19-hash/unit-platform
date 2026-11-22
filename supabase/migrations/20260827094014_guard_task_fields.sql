-- Imported verbatim from the already-applied cloud history; not a new production operation.
CREATE OR REPLACE FUNCTION public.guard_task_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.org_id IS NOT NULL AND public.is_org_member(NEW.org_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.artist_id IS DISTINCT FROM OLD.artist_id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.release_id IS DISTINCT FROM OLD.release_id THEN
    RAISE EXCEPTION 'Артист может только отметить выполнение задачи';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_guard_fields ON public.tasks;
CREATE TRIGGER tasks_guard_fields
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_fields();

