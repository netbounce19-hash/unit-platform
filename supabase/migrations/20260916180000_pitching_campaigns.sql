-- Питчинг релизов и промо-кампании.
--
-- От лейбла сегодня ждут сервиса: питчинг на стриминги, работа с
-- инфлюенсерами, креатив. Раньше это жило в свободном тексте «стратегии»
-- релиза, и ни команда, ни артист не видели, куда трек отправили и что из
-- этого вышло.
--
-- Ведут питчинг и кампании администратор, менеджер, маркетинг и проджект.
-- Артист видит итоги по своим релизам через my_release_promo(): куда
-- отправили, где вышло, охваты и ссылки — без стоимости, контактов и
-- внутренних заметок, поэтому прямого доступа к таблицам у него нет.

create table public.release_pitches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  release_id uuid not null references public.releases (id) on delete cascade,
  target text not null check (char_length(target) between 1 and 80),
  curator text check (char_length(curator) <= 160),
  contact text check (char_length(contact) <= 200),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'in_review', 'placed', 'declined')),
  sent_on date,
  result text check (char_length(result) <= 200),
  result_url text check (result_url ~ '^https?://' and char_length(result_url) <= 500),
  reach integer check (reach >= 0),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index release_pitches_release_idx on public.release_pitches (release_id);
create index release_pitches_org_idx on public.release_pitches (org_id, status);

create table public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  release_id uuid references public.releases (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  channel text not null default 'influencers'
    check (channel in ('influencers', 'ads', 'press', 'radio', 'offline', 'other')),
  status text not null default 'planned'
    check (status in ('planned', 'active', 'done', 'cancelled')),
  budget numeric(14, 2) check (budget >= 0),
  starts_on date,
  ends_on date,
  goal text check (char_length(goal) <= 500),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index promo_campaigns_org_idx on public.promo_campaigns (org_id, status, starts_on desc);
create index promo_campaigns_release_idx on public.promo_campaigns (release_id);

create table public.campaign_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references public.promo_campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  platform text check (char_length(platform) <= 60),
  status text not null default 'agreed' check (status in ('agreed', 'published', 'cancelled')),
  cost numeric(14, 2) check (cost >= 0),
  reach integer check (reach >= 0),
  url text check (url ~ '^https?://' and char_length(url) <= 500),
  published_on date,
  created_at timestamptz not null default now()
);

create index campaign_items_campaign_idx on public.campaign_items (campaign_id);

-- Релиз и артист должны быть из того же лейбла
create or replace function public.promo_check_org()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_table_name = 'release_pitches' then
    if not exists (select 1 from public.releases r where r.id = new.release_id and r.org_id = new.org_id) then
      raise exception 'Релиз не относится к этому лейблу';
    end if;
  elsif tg_table_name = 'promo_campaigns' then
    if not exists (select 1 from public.artists a where a.id = new.artist_id and a.org_id = new.org_id) then
      raise exception 'Артист не состоит в этом лейбле';
    end if;
    if new.release_id is not null
       and not exists (select 1 from public.releases r
                        where r.id = new.release_id and r.org_id = new.org_id and r.artist_id = new.artist_id) then
      raise exception 'Релиз не принадлежит этому артисту';
    end if;
  elsif tg_table_name = 'campaign_items' then
    if not exists (select 1 from public.promo_campaigns c where c.id = new.campaign_id and c.org_id = new.org_id) then
      raise exception 'Кампания не относится к этому лейблу';
    end if;
  end if;
  return new;
end;
$function$;

create trigger release_pitches_check_org before insert or update on public.release_pitches
  for each row execute function public.promo_check_org();
create trigger promo_campaigns_check_org before insert or update on public.promo_campaigns
  for each row execute function public.promo_check_org();
create trigger campaign_items_check_org before insert or update on public.campaign_items
  for each row execute function public.promo_check_org();

create or replace function public.promo_touch_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger release_pitches_touch before update on public.release_pitches
  for each row execute function public.promo_touch_updated_at();
create trigger promo_campaigns_touch before update on public.promo_campaigns
  for each row execute function public.promo_touch_updated_at();

alter table public.release_pitches enable row level security;
alter table public.promo_campaigns enable row level security;
alter table public.campaign_items enable row level security;

create policy "pitches: promo team" on public.release_pitches for all
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'marketing', 'project']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'marketing', 'project']));

create policy "campaigns: promo team" on public.promo_campaigns for all
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'marketing', 'project']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'marketing', 'project']));

create policy "campaign items: promo team" on public.campaign_items for all
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'marketing', 'project']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'marketing', 'project']));

-- Итоги продвижения релиза для самого артиста: без денег, контактов и заметок
create or replace function public.my_release_promo(p_release uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when not exists (
      select 1 from public.releases r
       where r.id = p_release and r.artist_id is not null and r.artist_id = public.my_artist_id()
    ) then null
    else jsonb_build_object(
      'pitches', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', p.id, 'target', p.target, 'curator', p.curator, 'status', p.status,
                 'sent_on', p.sent_on, 'result', p.result, 'result_url', p.result_url, 'reach', p.reach
               ) order by p.sent_on desc nulls last, p.created_at desc)
          from public.release_pitches p
         where p.release_id = p_release and p.status <> 'draft'
      ), '[]'::jsonb),
      'campaigns', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', c.id, 'title', c.title, 'channel', c.channel, 'status', c.status,
                 'starts_on', c.starts_on, 'ends_on', c.ends_on, 'goal', c.goal,
                 'items', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'name', i.name, 'platform', i.platform, 'reach', i.reach,
                            'url', i.url, 'published_on', i.published_on
                          ) order by i.published_on desc nulls last)
                     from public.campaign_items i
                    where i.campaign_id = c.id and i.status = 'published'
                 ), '[]'::jsonb)
               ) order by c.starts_on desc nulls last)
          from public.promo_campaigns c
         where c.release_id = p_release and c.status <> 'cancelled'
      ), '[]'::jsonb)
    )
  end;
$function$;

revoke all on function public.my_release_promo(uuid) from public, anon;
grant execute on function public.my_release_promo(uuid) to authenticated;
