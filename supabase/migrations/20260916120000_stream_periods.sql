-- Стримы в динамике.
--
-- artist_stream_stats хранила одно число на артиста, и каждая загрузка его
-- перезаписывала: ни роста к прошлому месяцу, ни тренда, ни прогноза. Теперь
-- цифры хранятся помесячно и по площадкам. Сводная строка остаётся — её
-- читают рейтинг, ростер и дашборд артиста — и пересчитывается триггером:
--   streams   = все стримы за всю историю
--   listeners = слушатели за последний загруженный месяц (сумма по площадкам)

create table public.artist_stream_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  -- первое число месяца
  month date not null check (extract(day from month) = 1),
  -- площадка; 'all' — когда цифра общая, без разбивки
  source text not null default 'all',
  streams bigint not null default 0 check (streams >= 0),
  listeners bigint not null default 0 check (listeners >= 0),
  updated_by uuid default auth.uid() references auth.users (id),
  updated_at timestamptz not null default now(),
  unique (artist_id, month, source)
);

create index artist_stream_periods_org_month_idx on public.artist_stream_periods (org_id, month);

create trigger artist_stream_periods_artist_org
  before insert or update of artist_id, org_id on public.artist_stream_periods
  for each row execute function public.royalty_check_artist_org();

create or replace function public.stream_periods_sync_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_artist uuid := coalesce(new.artist_id, old.artist_id);
  v_org uuid := coalesce(new.org_id, old.org_id);
  v_streams bigint;
  v_listeners bigint;
  v_last date;
begin
  select coalesce(sum(streams), 0), max(month) into v_streams, v_last
    from public.artist_stream_periods where artist_id = v_artist;

  -- истории не осталось — сводную строку не трогаем
  if v_last is null then
    return null;
  end if;

  select coalesce(sum(listeners), 0) into v_listeners
    from public.artist_stream_periods where artist_id = v_artist and month = v_last;

  insert into public.artist_stream_stats (artist_id, org_id, streams, listeners, updated_by, updated_at)
  values (v_artist, v_org, v_streams, v_listeners, auth.uid(), now())
  on conflict (artist_id) do update
    set streams = excluded.streams,
        listeners = excluded.listeners,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return null;
end;
$function$;

create trigger artist_stream_periods_sync
  after insert or update or delete on public.artist_stream_periods
  for each row execute function public.stream_periods_sync_snapshot();

alter table public.artist_stream_periods enable row level security;

-- Как и сводные цифры: читают лейбл и сам артист, пишет только лейбл
create policy "stream periods: select org or own"
  on public.artist_stream_periods for select
  using (public.is_org_member(org_id) or artist_id = public.my_artist_id());

create policy "stream periods: write org"
  on public.artist_stream_periods for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
