-- Imported verbatim from the already-applied cloud history; not a new production operation.
create or replace function public.royalty_statements_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' and new.status <> 'draft' and (
         new.period_start is distinct from old.period_start
      or new.period_end is distinct from old.period_end
      or new.share_pct is distinct from old.share_pct
      or new.deductions is distinct from old.deductions
      or new.artist_id is distinct from old.artist_id
      or new.gross is distinct from old.gross
      or new.royalty is distinct from old.royalty
      or new.recouped is distinct from old.recouped
      or new.payout is distinct from old.payout) then
      raise exception 'Опубликованный отчёт не редактируется — верните его в черновик';
    end if;

    if old.status = 'paid' and new.status = 'draft' then
      raise exception 'Выплаченный отчёт сначала верните в «К выплате»';
    end if;

    if new.status = 'published' and old.status = 'draft' then
      new.published_at := now();
    end if;
    if new.status = 'paid' and old.status <> 'paid' then
      new.paid_at := coalesce(new.paid_at, now());
    end if;
    if new.status <> 'paid' then
      new.paid_at := null;
    end if;
    if new.status = 'draft' then
      new.published_at := null;
    end if;
  end if;
  return new;
end;
$function$;

