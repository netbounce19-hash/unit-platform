-- Удаление аккаунта не должно упираться в историю.
--
-- Девять ссылок на auth.users были без правила удаления: стоило сотруднику
-- лейбла хоть раз загрузить стримы, одобрить заявку или написать артисту —
-- удалить его аккаунт (уволить, стереть по запросу о персональных данных)
-- было нельзя. Теперь запись остаётся, а автор становится пустым.
--
-- budget_guard_columns срабатывает и на такое обнуление (действия внешнего
-- ключа запускают триггеры), поэтому служебные операции без пользователя
-- он пропускает — так же, как уже делают остальные защитные триггеры.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('artist_advances', 'created_by'),
      ('artist_stream_periods', 'updated_by'),
      ('artist_stream_stats', 'updated_by'),
      ('budget_requests', 'decided_by'),
      ('messages', 'sender_id'),
      ('releases', 'approved_by'),
      ('releases', 'moderated_by'),
      ('royalty_statements', 'created_by'),
      ('tasks', 'created_by')
    ) as t(tbl, col)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null',
      r.tbl, r.tbl || '_' || r.col || '_fkey', r.col
    );
  end loop;
end $$;

-- Сообщение уволенного сотрудника остаётся в переписке — сторону хранит from_side
alter table public.messages alter column sender_id drop not null;

create or replace function public.budget_guard_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_org_member(new.org_id) then
    -- Лейбл трогает только поля решения.
    if new.amount is distinct from old.amount
       or new.category is distinct from old.category
       or new.purpose is distinct from old.purpose
       or new.comment is distinct from old.comment
       or new.artist_id is distinct from old.artist_id
       or new.org_id is distinct from old.org_id then
      raise exception 'Лейбл может менять только решение по заявке';
    end if;
    if (new.status is distinct from old.status or new.decision_comment is distinct from old.decision_comment)
       and not public.has_org_role(new.org_id, array['label_admin', 'label_manager', 'project', 'finance']) then
      raise exception 'Решение по заявке принимает проджект, финансы или менеджер';
    end if;
    if new.status is distinct from old.status then
      new.decided_by := coalesce(new.decided_by, auth.uid());
      new.decided_at := coalesce(new.decided_at, now());
    end if;
    return new;
  end if;

  -- Артист не подписывает решение сам и правит заявку только пока она ждёт.
  if new.status is distinct from old.status
     or new.decided_by is distinct from old.decided_by
     or new.decided_at is distinct from old.decided_at
     or new.decision_comment is distinct from old.decision_comment then
    raise exception 'Решение по заявке принимает лейбл';
  end if;
  if old.status <> 'pending' then
    raise exception 'Заявка уже рассмотрена';
  end if;

  return new;
end;
$function$;
