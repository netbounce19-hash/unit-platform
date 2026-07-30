-- Обложка и ручной порядок демо.
-- Идемпотентна.

alter table public.assets
  add column if not exists cover_path text,
  add column if not exists sort_order integer;

comment on column public.assets.cover_path is 'Обложка демо в бакете artist-files.';
comment on column public.assets.sort_order is 'Ручной порядок демо у владельца: меньше — выше.';

-- Бэкфилл для уже загруженных демо: сохраняем текущий порядок (новые сверху).
with ordered as (
  select id, row_number() over (partition by owner_id order by created_at desc) as rn
  from public.assets
  where kind = 'audio' and release_id is null and sort_order is null
)
update public.assets a
set sort_order = o.rn
from ordered o
where a.id = o.id;

create index if not exists assets_owner_sort_idx on public.assets (owner_id, sort_order);
