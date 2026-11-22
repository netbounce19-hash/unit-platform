-- Reconcile the final legacy schema without replaying historical migrations.
-- Imported cloud task-guard history is retained, but its obsolete duplicate
-- trigger/function must not reappear on a fresh database.
begin;
alter table public.messages add column if not exists attachment jsonb;
alter table public.messages alter column body set default '';
drop trigger if exists tasks_guard_fields on public.tasks;
drop function if exists public.guard_task_fields();
commit;
