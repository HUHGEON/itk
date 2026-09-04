-- Everything lives in its own `itk` schema so this can share a Supabase
-- project with another app without touching its `public` schema.
--
-- All access goes through the `public.itk_*` functions at the bottom rather than
-- a direct Postgres connection, because many networks block outbound 5432.
-- Those functions are SECURITY DEFINER, so only `public` needs to be exposed to
-- PostgREST — no dashboard configuration required.
--
-- Apply with `npm run db:push`, or paste this whole file into the Supabase SQL
-- editor. Safe to re-run.

create schema if not exists itk;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists itk.teams (
  slug    text primary key,
  ko      text not null,
  en      text not null,
  league  text not null,
  aliases jsonb not null default '[]'::jsonb,
  crest   text,
  fd_id   integer
);

create table if not exists itk.journalists (
  id         text primary key,
  ko         text not null,
  en         text not null,
  tier       real not null,
  league     text not null,
  country    text not null default '',
  outlet     text not null default '',
  x          text not null default '',
  confidence text not null default 'medium',
  note       text not null default '',
  active     boolean not null default true
);

create table if not exists itk.journalist_teams (
  journalist_id text not null references itk.journalists(id) on delete cascade,
  team_slug     text not null references itk.teams(slug) on delete cascade,
  primary key (journalist_id, team_slug)
);

create table if not exists itk.articles (
  id            text primary key,
  url           text not null unique,
  title         text not null,
  snippet       text not null default '',
  source        text not null default '',
  published_at  timestamptz not null,
  journalist_id text references itk.journalists(id) on delete set null,
  tier          real,
  title_ko      text,
  summary_ko    text,
  image_url     text,
  -- Google News links are opaque redirect wrappers. `url` stays as-collected
  -- because `id` is sha1(url) and the notify history references it; the real
  -- article address lives here, filled in by the hydrate pass.
  resolved_url  text,
  hydrated_at   timestamptz,
  created_at    timestamptz not null default now(),

  -- Real full-text search. English stemming on the original headline, plain
  -- token matching on the Korean translation (Postgres has no Korean stemmer).
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(title_ko, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(snippet, '')), 'B')
  ) stored
);

create table if not exists itk.article_teams (
  article_id text not null references itk.articles(id) on delete cascade,
  team_slug  text not null references itk.teams(slug) on delete cascade,
  primary key (article_id, team_slug)
);

-- Discord destinations, registered from the UI rather than baked into env
-- vars, so several team/tier combinations can run side by side.
create table if not exists itk.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  -- Random token held in the browser's localStorage. Cheaper than accounts and
  -- enough for "only I see the destinations I registered": the site is public,
  -- and an unguarded list let any visitor read and delete everyone's.
  owner_key    text not null default '',
  -- bcrypt, so the same destination can be managed from another device without
  -- the browser token. Optional: without one, this browser is the only way in.
  passphrase   text,
  label        text not null default '',
  webhook_url  text not null unique,
  teams        text[] not null default '{}',
  max_tier     real not null default 1.5,
  active       boolean not null default true,
  fail_count   integer not null default 0,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Remembers what has been sent *per destination* — a global article_id key
-- meant the first subscriber to receive a story silenced it for everyone else.
create table if not exists itk.notified (
  subscription_id uuid not null references itk.subscriptions(id) on delete cascade,
  article_id      text not null references itk.articles(id) on delete cascade,
  sent_at         timestamptz not null default now(),
  primary key (subscription_id, article_id)
);

-- Per-feed HTTP state. Powers conditional requests (ETag / Last-Modified) so a
-- feed that hasn't changed costs a 304 instead of a full body, and records
-- consecutive failures so a dead feed backs off instead of being retried every
-- run forever.
create table if not exists itk.feed_state (
  url            text primary key,
  etag           text,
  last_modified  text,
  last_status    integer,
  last_ok_at     timestamptz,
  fail_count     integer not null default 0,
  last_error     text,
  updated_at     timestamptz not null default now()
);

-- MyMemory's allowance is per day and per account, but the translator counted
-- characters in a local variable — and CI starts a fresh process every twenty
-- minutes, so each run believed it had the full day's budget.
create table if not exists itk.translate_usage (
  day   date primary key,
  chars integer not null default 0
);

-- One row per collection run — the only way to notice that recall quietly
-- dropped because a source started 429ing.
create table if not exists itk.collect_runs (
  id             bigserial primary key,
  started_at     timestamptz not null default now(),
  duration_ms    integer,
  sources_ok     integer not null default 0,
  sources_304    integer not null default 0,
  sources_failed integer not null default 0,
  items_seen     integer not null default 0,
  inserted       integer not null default 0,
  failures       jsonb not null default '[]'::jsonb
);

-- `create table if not exists` above is a no-op on an existing database, so
-- columns added after the first deploy need an explicit ALTER.
alter table itk.articles add column if not exists image_url text;
-- The journalist a story credits, as distinct from the one who wrote it. The
-- biggest scoops break on X, which we can't read for free — but the outlets
-- re-reporting them name their source in the body.
alter table itk.articles add column if not exists cited_id text
  references itk.journalists(id) on delete set null;
create index if not exists idx_articles_cited on itk.articles (cited_id, published_at desc);
-- Whoever the article says wrote it, whether or not we track them.
--
-- `journalist_id` can only hold one of the 244 reporters in the registry, so
-- for every other article the byline was simply thrown away and the row showed
-- as "기자 미확인". Measured before adding this: 69% of stored articles had no
-- journalist at all, while 80% of a sample of those pages carried a readable
-- author in their own metadata. This keeps that name even when it belongs to
-- nobody we follow; `journalist_id` still fills in when it does match, and
-- carries the tier with it.
alter table itk.articles add column if not exists byline text;

-- A club announcing its own signing is the end of the story, not a report
-- about it — it belongs in the feed even though it has no byline.
alter table itk.articles add column if not exists official boolean not null default false;
-- Source language, so the translator asks for the right pair. Half the feeds
-- are Spanish, Italian or French, and sending those as `en|ko` returns
-- gibberish or nothing.
alter table itk.articles add column if not exists lang text not null default 'en';
alter table itk.subscriptions add column if not exists owner_key text not null default '';
alter table itk.subscriptions add column if not exists passphrase text;
alter table itk.articles add column if not exists resolved_url text;
alter table itk.articles add column if not exists hydrated_at timestamptz;
-- Without a record of attempts, a headline the translator cannot handle sat at
-- the head of the queue and consumed the run's budget on every pass.
alter table itk.articles add column if not exists translate_tries integer not null default 0;
create extension if not exists pgcrypto with schema extensions;
create index if not exists idx_subscriptions_owner on itk.subscriptions (owner_key);

-- The notified table was keyed on article_id alone before subscriptions
-- existed; rebuild it rather than try to guess which destination each row was.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'itk' and table_name = 'notified'
      and column_name = 'article_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'itk' and table_name = 'notified'
      and column_name = 'subscription_id'
  ) then
    drop table itk.notified;
    create table itk.notified (
      subscription_id uuid not null references itk.subscriptions(id) on delete cascade,
      article_id      text not null references itk.articles(id) on delete cascade,
      sent_at         timestamptz not null default now(),
      primary key (subscription_id, article_id)
    );
  end if;
end $$;

create index if not exists idx_articles_published    on itk.articles (published_at desc);
-- The feed's exact sort. Ordering by published_at alone left the tie-break on
-- id to a sort step over the whole table, which is most of what made an
-- unfiltered feed query take seconds rather than milliseconds.
create index if not exists idx_articles_feed_order  on itk.articles (published_at desc, id desc);
create index if not exists idx_articles_tier         on itk.articles (tier, published_at desc);
create index if not exists idx_articles_journalist   on itk.articles (journalist_id, published_at desc);
create index if not exists idx_articles_search       on itk.articles using gin (search_vector);
create index if not exists idx_article_teams_slug    on itk.article_teams (team_slug);
create index if not exists idx_journalist_teams_slug on itk.journalist_teams (team_slug);
create index if not exists idx_collect_runs_started  on itk.collect_runs (started_at desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- No role gets direct table access; the itk_* functions below are the only door.
-- Realtime still needs a SELECT policy on `articles` for the anon role.

alter table itk.teams            enable row level security;
alter table itk.journalists      enable row level security;
alter table itk.journalist_teams enable row level security;
alter table itk.articles         enable row level security;
alter table itk.article_teams    enable row level security;
alter table itk.notified         enable row level security;
alter table itk.subscriptions    enable row level security;
alter table itk.feed_state       enable row level security;
alter table itk.collect_runs     enable row level security;

-- Realtime evaluates this policy before pushing a row to a subscriber.
grant usage on schema itk to anon, authenticated;
grant select on itk.articles to anon, authenticated;
drop policy if exists articles_read on itk.articles;
create policy articles_read on itk.articles
  for select to anon, authenticated using (true);

-- ── Functions ───────────────────────────────────────────────────────────────
-- Dropped first: `create or replace` cannot change a function's return type, so
-- adding a column to itk_feed would otherwise fail on an existing database.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'itk\_%'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

-- ── Read functions (browser + server) ───────────────────────────────────────

create or replace function public.itk_feed(
  p_tiers         real[]      default null,
  p_teams         text[]      default null,
  p_journalist_id text        default null,
  p_league        text        default null,
  p_q             text        default null,
  p_before        timestamptz default null,
  p_before_id     text        default null,
  p_after         timestamptz default null,
  p_limit         integer     default 60,
  p_tiered_only   boolean     default false
)
returns table (
  id text, url text, resolved_url text, title text, snippet text, source text,
  published_at timestamptz, tier real, title_ko text, summary_ko text,
  image_url text, journalist_id text, journalist_ko text, journalist_en text,
  outlet text, handle text, cited_id text, cited_ko text, official boolean,
  teams text[], league text, byline text
)
language sql
stable
security definer
set search_path = itk, public
as $$
  select a.id, a.url, a.resolved_url, a.title, a.snippet, a.source, a.published_at, a.tier,
         a.title_ko, a.summary_ko, a.image_url, a.journalist_id,
         j.ko, j.en, j.outlet, j.x, a.cited_id, c.ko, a.official,
         coalesce(
           (select array_agg(at.team_slug) from article_teams at where at.article_id = a.id),
           '{}'::text[]),
         -- The reporter's beat is the story's category when the story itself
         -- names no tracked club. Crystal Palace is not one of the seventeen,
         -- so a Palace story can never carry a crest — but a Chelsea reporter
         -- filing it still places it in the Premier League.
         coalesce(j.league, c.league),
         a.byline
  from articles a
  left join journalists j on j.id = a.journalist_id
  left join journalists c on c.id = a.cited_id
  where
    (not p_tiered_only
       or a.journalist_id is not null
       or a.cited_id is not null
       or a.official)
    and (p_tiers is null or (a.tier = any(p_tiers) and not a.official))
    and (p_teams is null or exists (
          select 1 from article_teams at
          where at.article_id = a.id and at.team_slug = any(p_teams)))
    and (p_journalist_id is null
         or a.journalist_id = p_journalist_id
         or a.cited_id = p_journalist_id)
    -- Same expression as the badge, so a league badge always means the story
    -- is under that tab.
    and (p_league is null or coalesce(j.league, c.league) = p_league)
    and (p_q is null or (
          a.search_vector @@ websearch_to_tsquery('english', p_q)
       or a.search_vector @@ websearch_to_tsquery('simple',  p_q)))
    and (p_before is null
         or a.published_at < p_before
         or (a.published_at = p_before and a.id < p_before_id))
    and (p_after is null or a.created_at > p_after)
  order by a.published_at desc, a.id desc
  limit least(coalesce(p_limit, 60), 200)
$$;

grant execute on function public.itk_feed(real[], text[], text, text, text, timestamptz, text, timestamptz, integer, boolean)
  to anon, authenticated, service_role;

create or replace function public.itk_team_activity(
  p_hours         integer default 48,
  p_tiers         real[]  default null,
  p_journalist_id text    default null,
  p_league        text    default null,
  p_q             text    default null,
  p_tiered_only   boolean default false
)
returns table (slug text, n bigint, best_tier real)
language sql
stable
security definer
set search_path = itk, public
as $$
  select at.team_slug, count(*), min(a.tier)
  from article_teams at
  join articles a on a.id = at.article_id
  left join journalists j on j.id = a.journalist_id
  left join journalists c on c.id = a.cited_id
  where a.published_at > now() - make_interval(hours => greatest(p_hours, 1))
    and (not p_tiered_only
         or a.journalist_id is not null
         or a.cited_id is not null
         or a.official)
    -- Same rule as itk_feed: a club's own post isn't a ranked reporter's word,
    -- so a tier filter must exclude it here too or the badge overcounts.
    and (p_tiers is null or (a.tier = any(p_tiers) and not a.official))
    and (p_journalist_id is null
         or a.journalist_id = p_journalist_id
         or a.cited_id = p_journalist_id)
    and (p_league is null or coalesce(j.league, c.league) = p_league)
    and (p_q is null or (
          a.search_vector @@ websearch_to_tsquery('english', p_q)
       or a.search_vector @@ websearch_to_tsquery('simple',  p_q)))
  group by at.team_slug
$$;

-- Story count per league, for the tabs above the feed.
--
-- This function was live on the database but missing from this file, so the
-- first `db:push` after that divergence dropped it and the feed went to 500.
-- A league is the reporter's beat rather than a tag on the story: seventeen
-- clubs carry crests, but a reporter who covers the Premier League places
-- everything they file under it, which is the same expression `itk_feed` uses
-- so a tab's count always matches what opening it shows.
create or replace function public.itk_league_activity(
  p_hours         integer default 48,
  p_tiers         real[]  default null,
  p_teams         text[]  default null,
  p_journalist_id text    default null,
  p_q             text    default null,
  p_tiered_only   boolean default false
)
returns table (league text, n bigint, best_tier real)
language sql
stable
security definer
set search_path = itk, public
as $$
  select coalesce(j.league, c.league) as league, count(*), min(a.tier)
  from articles a
  left join journalists j on j.id = a.journalist_id
  left join journalists c on c.id = a.cited_id
  where a.published_at > now() - make_interval(hours => greatest(p_hours, 1))
    and coalesce(j.league, c.league) is not null
    and (not p_tiered_only
         or a.journalist_id is not null
         or a.cited_id is not null
         or a.official)
    and (p_tiers is null or (a.tier = any(p_tiers) and not a.official))
    and (p_teams is null or exists (
          select 1 from article_teams at
          where at.article_id = a.id and at.team_slug = any(p_teams)))
    and (p_journalist_id is null
         or a.journalist_id = p_journalist_id
         or a.cited_id = p_journalist_id)
    and (p_q is null or (
          a.search_vector @@ websearch_to_tsquery('english', p_q)
       or a.search_vector @@ websearch_to_tsquery('simple',  p_q)))
  group by coalesce(j.league, c.league)
$$;

-- Which journalists actually filed recently, so the picker can lead with them
-- instead of listing 244 names in registry order.
create or replace function public.itk_journalist_activity(
  p_hours  integer default 168,
  p_teams  text[]  default null,
  p_league text    default null,
  p_q      text    default null
)
returns table (journalist_id text, n bigint)
language sql
stable
security definer
set search_path = itk, public
as $$
  select coalesce(a.journalist_id, a.cited_id) as journalist_id, count(*)
  from articles a
  left join journalists j on j.id = coalesce(a.journalist_id, a.cited_id)
  where coalesce(a.journalist_id, a.cited_id) is not null
    and a.published_at > now() - make_interval(hours => greatest(p_hours, 1))
    and (p_teams is null or exists (
          select 1 from article_teams at
          where at.article_id = a.id and at.team_slug = any(p_teams)))
    and (p_league is null or j.league = p_league)
    and (p_q is null or (
          a.search_vector @@ websearch_to_tsquery('english', p_q)
       or a.search_vector @@ websearch_to_tsquery('simple',  p_q)))
  group by coalesce(a.journalist_id, a.cited_id)
$$;

-- ── Write functions (server only) ───────────────────────────────────────────

create or replace function public.itk_upsert_articles(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_inserted integer;
begin
  with input as (
    select * from jsonb_to_recordset(p_items) as t(
      id text, url text, title text, snippet text, source text,
      published_at timestamptz, journalist_id text, tier real, image_url text,
      cited_id text, official boolean, lang text, byline text)
  ), ins as (
    insert into articles
      (id, url, title, snippet, source, published_at, journalist_id, tier,
       image_url, cited_id, official, lang, byline)
    select id, url, title, snippet, source, published_at, journalist_id, tier,
           image_url, cited_id, coalesce(official, false), coalesce(lang, 'en'),
           byline
    from input
    on conflict (url) do update set
      -- a later sighting may carry the image or blurb the first one lacked
      snippet   = case when excluded.snippet <> '' then excluded.snippet else articles.snippet end,
      image_url = coalesce(excluded.image_url, articles.image_url),
      cited_id  = coalesce(articles.cited_id, excluded.cited_id),
      -- An outlet feed sees a story before the reporter's own feed does, and
      -- without this the byline never arrived — the story stayed "기자 미확인"
      -- and dropped out of the default view.
      journalist_id = coalesce(articles.journalist_id, excluded.journalist_id),
      -- A citation found on a later pass also settles the trust level.
      tier      = coalesce(articles.tier, excluded.tier),
      byline    = coalesce(articles.byline, excluded.byline)
    where articles.image_url is null or articles.snippet = ''
       or articles.cited_id is null or articles.journalist_id is null
       or articles.byline is null
    returning (xmax = 0) as is_new
  )
  select count(*) filter (where is_new) into v_inserted from ins;

  -- Tag every input row, not just the new ones: an article first seen without a
  -- club mention can pick the tag up on a later sighting.
  insert into article_teams (article_id, team_slug)
  select x.id, s.slug
  from jsonb_to_recordset(p_items) as x(id text, teams jsonb),
       lateral jsonb_array_elements_text(x.teams) as s(slug)
  where exists (select 1 from articles a where a.id = x.id)
    and exists (select 1 from teams t where t.slug = s.slug)
  on conflict do nothing;

  return v_inserted;
end $$;

create or replace function public.itk_seed_teams(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_count integer;
begin
  insert into teams (slug, ko, en, league, aliases, crest, fd_id)
  select slug, ko, en, league, coalesce(aliases, '[]'::jsonb), crest, fd_id
  from jsonb_to_recordset(p_items) as t(
    slug text, ko text, en text, league text, aliases jsonb, crest text, fd_id integer)
  on conflict (slug) do update set
    ko = excluded.ko, en = excluded.en, league = excluded.league,
    aliases = excluded.aliases,
    -- keep an existing crest if this run doesn't have one
    crest = coalesce(excluded.crest, teams.crest),
    fd_id = coalesce(excluded.fd_id, teams.fd_id);

  get diagnostics v_count = row_count;

  -- The registry is the source of truth: a club removed from teams.json is
  -- removed here too, cascading to its article and journalist tags. An empty
  -- payload means the caller failed to read the file, not that every club was
  -- deleted — deleting on it would wipe every article's club tags.
  if v_count > 0 then
    delete from teams t
    where not exists (
      select 1 from jsonb_to_recordset(p_items) as x(slug text) where x.slug = t.slug
    );
  end if;

  return v_count;
end $$;

create or replace function public.itk_seed_journalists(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_count integer;
begin
  insert into journalists (id, ko, en, tier, league, country, outlet, x, confidence, note, active)
  select id, ko, en, tier, league,
         coalesce(country, ''), coalesce(outlet, ''), coalesce(handle, ''),
         coalesce(confidence, 'medium'), coalesce(note, ''), coalesce(active, true)
  from jsonb_to_recordset(p_items) as t(
    id text, ko text, en text, tier real, league text, country text,
    outlet text, handle text, confidence text, note text, active boolean)
  on conflict (id) do update set
    ko = excluded.ko, en = excluded.en, tier = excluded.tier,
    league = excluded.league, country = excluded.country,
    outlet = excluded.outlet, x = excluded.x,
    confidence = excluded.confidence, note = excluded.note,
    active = excluded.active;

  get diagnostics v_count = row_count;

  -- Beats are replaced wholesale so a removed team doesn't linger.
  -- `where true` because Supabase enables pg_safeupdate, which rejects an
  -- unqualified DELETE.
  delete from journalist_teams where true;
  insert into journalist_teams (journalist_id, team_slug)
  select x.id, s.slug
  from jsonb_to_recordset(p_items) as x(id text, teams jsonb),
       lateral jsonb_array_elements_text(x.teams) as s(slug)
  where exists (select 1 from teams t where t.slug = s.slug)
  on conflict do nothing;

  return v_count;
end $$;


-- Articles the feed will show but that have nothing to expand: no summary and
-- no image. Oldest-first within the window so a backlog drains predictably.
create or replace function public.itk_hydrate_pending(p_limit integer default 60)
returns table (id text, url text)
language sql
stable
security definer
set search_path = itk, public
as $$
  -- Two reasons to open an article: it arrived with no summary, or it arrived
  -- with no author.
  --
  -- The second is new, and it is the larger group by far. This used to require
  -- a known journalist, which meant the stories that most needed a byline were
  -- the only ones never fetched - 69% of the table sat as "기자 미확인" because
  -- nothing ever looked at the page that would have said who wrote it.
  select a.id, a.url
  from articles a
  where a.published_at > now() - interval '14 days'
    and (
      -- Never opened, and arrived with no summary.
      (a.hydrated_at is null and coalesce(a.snippet, '') = '')
      -- Or nobody is credited. Articles stored before the page was ever read
      -- for a byline are stamped as hydrated but have no author, so this has
      -- to look past that stamp - otherwise the backlog can never be filled.
      -- Three days between attempts keeps a page that simply has no byline
      -- from being fetched on every pass.
      or (a.journalist_id is null
          and a.cited_id is null
          and a.byline is null
          and not a.official
          and (a.hydrated_at is null
               or a.hydrated_at < now() - interval '3 days'))
    )
  order by a.published_at desc
  limit greatest(least(p_limit, 300), 1);
$$;

-- Writes back what the fetch found. Always stamps hydrated_at, including for
-- rows that yielded nothing, so a dead link is not retried forever.
create or replace function public.itk_hydrate_apply(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  with incoming as (
    select
      x->>'id'           as id,
      nullif(x->>'snippet', '')      as snippet,
      nullif(x->>'image_url', '')    as image_url,
      nullif(x->>'resolved_url', '') as resolved_url,
      nullif(x->>'byline', '')       as byline,
      nullif(x->>'journalist_id', '') as journalist_id,
      (x->>'tier')::real             as tier
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
  )
  update articles a
  set snippet      = coalesce(i.snippet, a.snippet),
      image_url    = coalesce(a.image_url, i.image_url),
      resolved_url = coalesce(i.resolved_url, a.resolved_url),
      -- Never overwrite an attribution the collector already made: the feed's
      -- own byline field is more reliable than a name scraped off the page.
      byline       = coalesce(a.byline, i.byline),
      journalist_id = coalesce(a.journalist_id, i.journalist_id),
      tier         = coalesce(a.tier, case when a.journalist_id is null then i.tier end),
      hydrated_at  = now()
  from incoming i
  where a.id = i.id;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_feed_state_get(p_urls text[])
returns table (url text, etag text, last_modified text, fail_count integer, updated_at timestamptz)
language sql
stable
security definer
set search_path = itk, public
as $$
  select f.url, f.etag, f.last_modified, f.fail_count, f.updated_at
  from feed_state f where f.url = any(p_urls)
$$;



-- Drops HTTP state for sources we no longer ask for.
--
-- Every journalist has a Google News URL built from their name, country and
-- clubs, so changing how that query is built orphans the old row. After one
-- such change 250 of 543 rows were for URLs nothing fetches — enough to make
-- "73 feeds have not responded in a week" read as an outage.
--
-- Three days against a measured worst case of 10.2 hours between fetches — the
-- cold band runs every six hours and thirds the roster. Pruning a live feed by
-- mistake costs only its ETag, so it refetches in full once.
create or replace function public.itk_prune_feed_state(p_days integer default 3)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  delete from feed_state
  where updated_at < now() - make_interval(days => greatest(p_days, 2));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_feed_state_all()
returns table (url text, fail_count integer, last_error text, updated_at timestamptz)
language sql stable security definer set search_path = itk, public
as $$ select f.url, f.fail_count, f.last_error, f.updated_at from feed_state f; $$;

create or replace function public.itk_feed_state_set(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_count integer;
begin
  insert into feed_state (url, etag, last_modified, last_status, last_error)
  select url, etag, last_modified, last_status, last_error
  from jsonb_to_recordset(p_items) as t(
    url text, etag text, last_modified text, last_status integer, last_error text)
  on conflict (url) do update set
    -- Only a successful response may replace the validators. A failure carries
    -- no ETag, and overwriting with null turned every transient error into a
    -- full re-download on the next run.
    etag = case when excluded.last_error is null
                then excluded.etag else feed_state.etag end,
    last_modified = case when excluded.last_error is null
                         then excluded.last_modified else feed_state.last_modified end,
    last_status = excluded.last_status,
    last_error = excluded.last_error,
    updated_at = now(),
    last_ok_at = case when excluded.last_error is null then now() else feed_state.last_ok_at end,
    fail_count = case when excluded.last_error is null then 0 else feed_state.fail_count + 1 end;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.itk_record_run(p_stats jsonb)
returns bigint
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_id bigint;
begin
  insert into collect_runs
    (duration_ms, sources_ok, sources_304, sources_failed, items_seen, inserted, failures)
  values (
    (p_stats->>'duration_ms')::integer,
    (p_stats->>'sources_ok')::integer,
    (p_stats->>'sources_304')::integer,
    (p_stats->>'sources_failed')::integer,
    (p_stats->>'items_seen')::integer,
    (p_stats->>'inserted')::integer,
    coalesce(p_stats->'failures', '[]'::jsonb))
  returning id into v_id;
  return v_id;
end $$;


-- Characters spent today, in UTC. The provider's own reset is what matters and
-- it is not documented, so UTC is the honest approximation.
create or replace function public.itk_translate_usage(p_add integer default 0)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_chars integer;
begin
  insert into translate_usage (day, chars)
  values (current_date, greatest(coalesce(p_add, 0), 0))
  on conflict (day) do update
    set chars = translate_usage.chars + greatest(coalesce(p_add, 0), 0)
  returning chars into v_chars;

  delete from translate_usage where day < current_date - 7;
  return v_chars;
end $$;

-- Marks an attempt that produced nothing, so the row drops down the queue
-- instead of blocking it.
create or replace function public.itk_translate_failed(p_ids text[])
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  update articles set translate_tries = translate_tries + 1
  where id = any(coalesce(p_ids, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_pending_translations(
  p_limit    integer default 120,
  p_max_tier real    default 3,
  -- MyMemory's allowance barely covers headlines, so it asks for headlines
  -- only. Handing it body-only rows it can never satisfy would let them refill
  -- the limit every run and starve the headlines that still need work.
  p_bodies   boolean default true
)
returns table (id text, title text, title_ko text, snippet text, source text, tier real, lang text)
language sql
stable
security definer
set search_path = itk, public
as $$
  select a.id, a.title, a.title_ko, a.snippet, a.source, a.tier, a.lang
  from articles a
  -- A hydrated summary arrives after the headline was translated, so a row
  -- with a title but no body still needs a pass.
  where (a.title_ko is null
         or (p_bodies and a.summary_ko is null and coalesce(a.snippet, '') <> ''))
    -- Three failures is the provider telling us it cannot translate this one.
    and a.translate_tries < 3
    and (a.tier is null or a.tier <= p_max_tier)
    -- Only what the feed actually shows. The free translation budget is about
    -- 700 headlines a day against 1,000+ collected, and two thirds of those
    -- never surface — translating them starved the ones on screen.
    and (a.journalist_id is not null or a.cited_id is not null or a.official)
    -- Newest first: an old headline nobody will scroll to isn't worth quota.
    and a.published_at > now() - interval '7 days'
  order by a.published_at desc
  limit least(coalesce(p_limit, 120), 500)
$$;

create or replace function public.itk_apply_translations(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_count integer;
begin
  update articles a
  set title_ko = coalesce(nullif(t.title_ko, ''), a.title_ko),
      -- A title-only pass must not erase a summary an earlier run produced.
      summary_ko = coalesce(nullif(t.summary_ko, ''), a.summary_ko)
  from jsonb_to_recordset(p_items) as t(id text, title_ko text, summary_ko text)
  where a.id = t.id;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Drops anything older than the retention window. Transfer news has no value
-- after a couple of months, and this keeps the free-tier database small.

-- Rewrites the detected source language. Detection runs in the app because
-- Postgres has no language guesser for these pairs.

-- Headlines to run language detection over. Defaults to the ones still waiting
-- on a translation, which is where a wrong tag actually costs something.

-- Story count per reporter, counting both their own byline and the times an
-- outlet credited them. Used by the audit to find names that never land.


-- Collapses articles that turned out to be the same page.
--
-- The same story arrives twice: once as a Google News wrapper from a
-- reporter's feed, once as a direct link from the outlet's own feed. Nothing
-- could match them until the hydrate pass resolved the wrapper, so this runs
-- after it. The survivor is the row that carries attribution, and the loser's
-- club tags, notify history and translations move across before it goes.


-- Removes rows that are not stories: archive pagination, CMS artefacts, and
-- one-line social posts whose substance is in replies we never fetch. The
-- collector now rejects these on the way in; this clears what predates it.

-- Replaces an article's club tags outright. Detection lives in the app, and a
-- partial update would leave the wrong tags that prompted the recount behind.
create or replace function public.itk_retag(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  create temp table _retag on commit drop as
  select x.id, x.teams
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, teams jsonb);

  delete from article_teams t using _retag r where t.article_id = r.id;

  insert into article_teams (article_id, team_slug)
  select r.id, s.slug
  from _retag r, lateral jsonb_array_elements_text(r.teams) as s(slug)
  where exists (select 1 from teams t where t.slug = s.slug)
    and exists (select 1 from articles a where a.id = r.id)
  on conflict do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- Headlines with their outlet, for the language-detector benchmark.
create or replace function public.itk_titles_for_bench(p_offset integer default 0)
returns table (title text, source text)
language sql stable security definer set search_path = itk, public
as $$
  select a.title, a.source from articles a
  where a.published_at > now() - interval '60 days'
  order by a.published_at desc, a.id desc
  limit 1000 offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.itk_articles_for_retag(p_offset integer default 0)
returns table (id text, title text, snippet text, journalist_teams text[])
language sql stable security definer set search_path = itk, public
as $$
  select a.id, a.title, a.snippet,
         coalesce((select array_agg(jt.team_slug) from journalist_teams jt
                    where jt.journalist_id = a.journalist_id), '{}')
  from articles a
  where a.published_at > now() - interval '60 days'
  order by a.published_at desc, a.id desc
  limit 1000 offset greatest(coalesce(p_offset, 0), 0);
$$;


-- Removes stories that were taken long after they were published.
--
-- Until COLLECT_DAYS existed the ingest cutoff was the retention window, so
-- widening the Google News queries pulled in weeks-old pieces as fresh
-- arrivals. These are exactly the rows the current rule would have refused.
-- Articles that are old but were caught while they were news are kept.
create or replace function public.itk_purge_backfill(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  delete from articles
  where created_at - published_at > make_interval(days => greatest(p_days, 1));
  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- The women's game, which this feed does not cover. The collector now rejects
-- these on the way in; this clears what predates the filter.

-- Removes stories the hydrate pass identified as women's football. The title
-- gave nothing away; the fetched page did.

create or replace function public.itk_drop_articles(p_ids text[])
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  delete from articles where id = any(coalesce(p_ids, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_purge_womens()
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  delete from articles a
  where
    (
      -- Said outright in the headline, in any language we collect.
      a.title ~* '\mwomen|\mwsl\M|\mnwsl\M|\mlionesses\M|a-league women'
      or a.title ~* '여자\s?축구|여자부'
      or a.title ~* 'femminil|femenin|féminin|feminin|frauen|vrouwen'
      -- Or only in the body. A club posts "Confirmed Chelsea line up vs
      -- Auckland FC" under the same URL shape as the men's team; the summary
      -- and the image path are the only things that say otherwise.
      or coalesce(a.snippet, '') ~* 'wom[ae]n|\mwsl\M|\mnwsl\M|femminil|femenin|féminin|feminin|frauen|vrouwen|jugadora|jogadora'
      or coalesce(a.image_url, '') ~* 'wom[ae]n|\mcfcw\M|\mmufcw\M|femenin|femminil|frauen|vrouwen'
      or coalesce(a.resolved_url, a.url) ~* '/wom[ae]n|femenin|femminil|frauen|vrouwen'
      -- Female pronouns with no male one anywhere.
      or (
        coalesce(a.snippet, '') ~* '\m(her|she)\M'
        and coalesce(a.snippet, '') !~* '\m(his|he|him)\M'
      )
    )
    -- Football business is not the women's game. A woman buying a club, or a
    -- chairman whose story merely mentions one, kept getting swept up.
    and coalesce(a.snippet, '') !~* 'shareholder|stake|co-owner|consortium|takeover|chairman|voorzitter|board member|chief executive|president'
;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_purge_junk()
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  delete from articles
  where title ~* 'page [0-9]+ of [0-9]+'
     or title ~* '^allow fb ia'
     or title ~* '^(home|news|archive|tag|category|author|index)\M'
     or length(btrim(title)) < 20;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_dedupe_resolved()
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  create temp table _dupes on commit drop as
  with keyed as (
    select id, lower(coalesce(nullif(resolved_url, ''), url)) as k,
           journalist_id, cited_id, official, created_at
    from articles
    union all
    -- One outlet does not publish two stories under the same headline, but it
    -- does publish one story at two paths — L'Équipe served the same piece
    -- under /Actualites/ and /Article/. Same source, same title, same story.
    select id, 'title:' || lower(source) || '|' || lower(btrim(title)) as k,
           journalist_id, cited_id, official, created_at
    from articles
    where coalesce(source, '') <> '' and coalesce(title, '') <> ''
  ), ranked as (
    select k, id,
           row_number() over (
             partition by k
             -- Attribution first: an unattributed copy is the one the feed
             -- would have hidden anyway.
             order by (journalist_id is not null) desc,
                      (cited_id is not null) desc,
                      official desc,
                      created_at asc,
                      id asc
           ) as rn
    from keyed
  )
  select r.id as loser, (select id from ranked s where s.k = r.k and s.rn = 1) as winner
  from ranked r
  where r.rn > 1;

  insert into article_teams (article_id, team_slug)
  select d.winner, t.team_slug from _dupes d
  join article_teams t on t.article_id = d.loser
  on conflict do nothing;

  insert into notified (subscription_id, article_id, sent_at)
  select n.subscription_id, d.winner, n.sent_at from _dupes d
  join notified n on n.article_id = d.loser
  on conflict do nothing;

  -- Whatever the loser had and the winner lacks.
  update articles w
  set snippet    = case when w.snippet = '' then l.snippet else w.snippet end,
      image_url  = coalesce(w.image_url, l.image_url),
      title_ko   = coalesce(w.title_ko, l.title_ko),
      summary_ko = coalesce(w.summary_ko, l.summary_ko),
      cited_id   = coalesce(w.cited_id, l.cited_id)
  from _dupes d join articles l on l.id = d.loser
  where w.id = d.winner;

  delete from articles a using _dupes d where a.id = d.loser;

  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- What the last day looks like, for the sidebar. One round trip rather than
-- six, because the panel is above the fold on every page load.
create or replace function public.itk_pulse()
returns table (tier real, official boolean, n bigint, last_collect timestamptz)
language sql
stable
security definer
set search_path = itk, public
as $$
  select a.tier, a.official, count(*),
         (select max(started_at) from collect_runs)
  from articles a
  where (a.journalist_id is not null or a.cited_id is not null or a.official)
    and a.published_at > now() - interval '24 hours'
  group by a.tier, a.official;
$$;

create or replace function public.itk_journalist_counts()
returns table (id text, n bigint)
language sql
stable
security definer
set search_path = itk, public
as $$
  select j.id,
         (select count(*) from articles a
           where a.journalist_id = j.id or a.cited_id = j.id)
  from journalists j
  where j.active;
$$;

create or replace function public.itk_articles_for_lang(
  p_only_untranslated boolean default true,
  -- PostgREST caps a response at 1,000 rows, so the caller pages through.
  p_offset integer default 0
)
returns table (id text, title text, lang text)
language sql
stable
security definer
set search_path = itk, public
as $$
  select a.id, a.title, a.lang
  from articles a
  where (not p_only_untranslated or a.title_ko is null)
    and (a.journalist_id is not null or a.cited_id is not null or a.official)
    and a.published_at > now() - interval '30 days'
  -- id breaks ties: dozens of rows share a minute, and an unstable sort would
  -- make paging skip and repeat.
  order by a.published_at desc, a.id desc
  limit 1000
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.itk_set_langs(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  update articles a
  set lang = t.lang
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as t(id text, lang text)
  where a.id = t.id and coalesce(t.lang, '') <> '' and a.lang is distinct from t.lang;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_prune(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_deleted integer;
begin
  delete from articles
  where published_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics v_deleted = row_count;

  -- article_teams / notified cascade; feed_state is keyed by URL, not article.
  delete from collect_runs
  where started_at < now() - make_interval(days => greatest(p_days, 1));

  return v_deleted;
end $$;


-- ── Subscriptions ───────────────────────────────────────────────────────────
-- Server-only: the webhook URL is a bearer credential for a Discord channel,
-- so it is never returned to the browser in full.

create or replace function public.itk_add_subscription(
  p_owner    text,
  p_url      text,
  p_teams    text[],
  p_max_tier real default 1.5,
  p_label    text default '',
  p_pass     text default null
)
returns uuid
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_id uuid;
begin
  -- Anything that isn't a Discord webhook would turn this into an open relay.
  if p_url !~ '^https://(discord|discordapp)\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception '디스코드 웹훅 주소가 아닙니다';
  end if;
  if coalesce(array_length(p_teams, 1), 0) = 0 then
    raise exception '팀을 최소 하나 선택해야 합니다';
  end if;
  if coalesce(length(p_owner), 0) < 16 then
    raise exception '소유자 키가 없습니다';
  end if;
  if (select count(*) from subscriptions where owner_key = p_owner) >= 10 then
    raise exception '구독이 너무 많습니다 (최대 10개)';
  end if;

  insert into subscriptions (owner_key, webhook_url, teams, max_tier, label, passphrase)
  values (p_owner, p_url, p_teams, greatest(least(p_max_tier, 3), 0), coalesce(p_label, ''),
          case when public.itk_check_pass(p_pass) is not null
               then extensions.crypt(btrim(p_pass), extensions.gen_salt('bf', 10)) end)
  -- Re-registering the same webhook updates it, but only for its owner; the
  -- where clause is what stops one visitor overwriting another's destination.
  on conflict (webhook_url) do update set
    teams = excluded.teams,
    max_tier = excluded.max_tier,
    label = excluded.label,
    active = true,
    fail_count = 0,
    passphrase = coalesce(excluded.passphrase, subscriptions.passphrase)
  where subscriptions.owner_key = p_owner
  returning id into v_id;

  if v_id is null then
    raise exception '이미 다른 사용자가 등록한 웹훅입니다';
  end if;

  return v_id;
end $$;

-- Masked for display: enough to tell two destinations apart, not enough to post.
create or replace function public.itk_list_subscriptions(p_owner text)
returns table (id uuid, label text, teams text[], max_tier real,
               active boolean, has_pass boolean, last_sent_at timestamptz)
language sql
stable
security definer
set search_path = itk, public
as $$
  -- No part of the webhook here. It is a credential — anyone holding it can
  -- post to the channel — so it is fetched one row at a time, for editing.
  select s.id, s.label, s.teams, s.max_tier, s.active,
         (s.passphrase is not null), s.last_sent_at
  from subscriptions s
  where s.owner_key = p_owner and coalesce(length(p_owner), 0) >= 16
  order by s.created_at
$$;


-- Adopts a destination on a new device. The browser token is the everyday
-- path; this is the way back in after clearing site data or switching device.

-- One destination in full, for the edit screen. Separate from the list so the
-- webhook is fetched deliberately rather than shipped with every page load.

-- Minimum length for a passphrase. Short ones were being dropped in silence,
-- so someone who typed two characters believed they had set one.
create or replace function public.itk_check_pass(p_pass text)
returns text
language plpgsql
immutable
as $$
begin
  if p_pass is null or btrim(p_pass) = '' then
    return null;
  end if;
  if length(btrim(p_pass)) < 4 then
    raise exception '비밀번호는 4자 이상이어야 합니다';
  end if;
  return btrim(p_pass);
end $$;

-- Proves the caller may touch this destination.
--
-- The browser token says which rows are yours; a passphrase, once set, says it
-- is really you. Without this a stolen or shared browser profile could read the
-- webhook and repoint the channel — the token alone was the whole lock.
create or replace function public.itk_authorize_sub(p_owner text, p_id uuid, p_auth text)
returns void
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_hash text;
begin
  if coalesce(length(p_owner), 0) < 16 then
    raise exception '소유자 키가 없습니다';
  end if;

  select s.passphrase into v_hash
  from subscriptions s
  where s.id = p_id and s.owner_key = p_owner;

  if not found then
    raise exception '알림을 찾을 수 없습니다';
  end if;

  if v_hash is null then
    return;  -- registered without one: the browser token is the only lock
  end if;

  if coalesce(p_auth, '') = '' then
    raise exception '비밀번호가 필요합니다';
  end if;
  if v_hash <> extensions.crypt(p_auth, v_hash) then
    raise exception '비밀번호가 일치하지 않습니다';
  end if;
end $$;

create or replace function public.itk_get_subscription(
  p_owner text, p_id uuid, p_auth text default null
)
returns table (id uuid, label text, webhook_url text, teams text[],
               max_tier real, has_pass boolean)
language plpgsql
security definer
set search_path = itk, public
as $$
begin
  perform public.itk_authorize_sub(p_owner, p_id, p_auth);

  return query
  select s.id, s.label, s.webhook_url, s.teams, s.max_tier,
         (s.passphrase is not null)
  from subscriptions s
  where s.id = p_id and s.owner_key = p_owner;
end $$;

-- Edits an existing destination. The notify history is keyed on the
-- subscription, not the URL, so changing the channel does not replay the
-- backlog into it.
create or replace function public.itk_update_subscription(
  p_owner    text,
  p_id       uuid,
  p_url      text,
  p_teams    text[],
  p_max_tier real,
  p_label    text default '',
  p_pass     text default null,
  -- the existing passphrase, when one is set
  p_auth     text default null
)
returns uuid
language plpgsql
security definer
set search_path = itk, public
as $$
declare
  v_id  uuid;
  v_new text;
begin
  perform public.itk_authorize_sub(p_owner, p_id, p_auth);
  v_new := public.itk_check_pass(p_pass);

  if p_url !~ '^https://(discord|discordapp)\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception '디스코드 웹훅 주소가 아닙니다';
  end if;

  if coalesce(array_length(p_teams, 1), 0) = 0 then
    raise exception '팀을 하나 이상 선택하세요';
  end if;

  -- Another owner already registered this channel.
  if exists (
    select 1 from subscriptions s
    where s.webhook_url = p_url and s.id <> p_id
  ) then
    raise exception '이미 등록된 웹훅입니다';
  end if;

  update subscriptions s
  set webhook_url = p_url,
      teams       = p_teams,
      max_tier    = greatest(least(p_max_tier, 3), 0),
      label       = coalesce(p_label, ''),
      -- Blank leaves the existing one alone; there is no way to read it back,
      -- so an empty field must not silently clear it.
      passphrase  = case when v_new is not null
                         then extensions.crypt(v_new, extensions.gen_salt('bf', 10))
                         else s.passphrase end,
      active      = true,
      fail_count  = 0
  where s.id = p_id and s.owner_key = p_owner
  returning s.id into v_id;

  if v_id is null then
    raise exception '수정할 알림을 찾을 수 없습니다';
  end if;
  return v_id;
end $$;

create or replace function public.itk_claim_subscriptions(p_owner text, p_pass text)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  if coalesce(length(p_owner), 0) < 16 then
    raise exception '소유자 키가 없습니다';
  end if;
  if coalesce(length(p_pass), 0) < 4 then
    raise exception '비밀번호가 너무 짧습니다';
  end if;

  update subscriptions
  set owner_key = p_owner
  where passphrase is not null
    and passphrase = extensions.crypt(p_pass, passphrase);

  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.itk_remove_subscription(
  p_owner text, p_id uuid, p_auth text default null
)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  perform public.itk_authorize_sub(p_owner, p_id, p_auth);

  delete from subscriptions
  where id = p_id and owner_key = p_owner;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Full URLs — only the notifier calls this.
create or replace function public.itk_active_subscriptions()
returns table (id uuid, webhook_url text, teams text[], max_tier real,
               first_run boolean)
language sql
stable
security definer
set search_path = itk, public
as $$
  -- first_run tells the notifier to record the current backlog as already
  -- sent instead of delivering it: a new destination otherwise receives every
  -- stored article at once.
  select s.id, s.webhook_url, s.teams, s.max_tier, s.last_sent_at is null
  from subscriptions s
  where s.active and s.fail_count < 10
$$;

create or replace function public.itk_subscription_failed(p_id uuid, p_reset boolean default false)
returns integer
language plpgsql
security definer
set search_path = itk, public
as $$
declare v_n integer;
begin
  if p_reset then
    update subscriptions set fail_count = 0, last_sent_at = now() where id = p_id;
    return 0;
  end if;
  -- A webhook deleted on Discord's side 404s forever; stop after ten.
  update subscriptions set fail_count = fail_count + 1 where id = p_id
  returning fail_count into v_n;
  return coalesce(v_n, 0);
end $$;

-- Insert-and-report in one step: returns only the ids that were not already
-- notified, so the caller can't double-send on a retry.
create or replace function public.itk_mark_notified(p_sub uuid, p_ids text[])
returns text[]
language sql
volatile
security definer
set search_path = itk, public
as $$
  with ins as (
    insert into notified (subscription_id, article_id)
    select p_sub, unnest(p_ids)
    on conflict do nothing
    returning article_id
  )
  select coalesce(array_agg(article_id), '{}'::text[]) from ins
$$;

-- ── Function grants ─────────────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default, so every write function must be
-- revoked explicitly or the anon key could call it.

do $$
declare
  fn text;
  read_fns text[] := array[
    'public.itk_feed(real[],text[],text,text,text,timestamptz,text,timestamptz,integer,boolean)',
    'public.itk_team_activity(integer,real[],text,text,text,boolean)',
    'public.itk_league_activity(integer,real[],text[],text,text,boolean)',
    'public.itk_journalist_activity(integer,text[],text,text)'
  ];
  write_fns text[] := array[
    'public.itk_upsert_articles(jsonb)',
    'public.itk_seed_teams(jsonb)',
    'public.itk_seed_journalists(jsonb)',
    'public.itk_feed_state_get(text[])',
    'public.itk_feed_state_set(jsonb)',
    'public.itk_feed_state_all()',
    'public.itk_prune_feed_state(integer)',
    'public.itk_record_run(jsonb)',
    'public.itk_pending_translations(integer,real,boolean)',
    'public.itk_apply_translations(jsonb)',
    'public.itk_translate_usage(integer)',
    'public.itk_translate_failed(text[])',
    'public.itk_set_langs(jsonb)',
    'public.itk_articles_for_lang(boolean,integer)',
    'public.itk_journalist_counts()',
    'public.itk_mark_notified(uuid,text[])',
    'public.itk_prune(integer)',
    'public.itk_add_subscription(text,text,text[],real,text,text)',
    'public.itk_claim_subscriptions(text,text)',
    'public.itk_hydrate_apply(jsonb)',
    'public.itk_hydrate_pending(integer)',
    'public.itk_dedupe_resolved()',
    'public.itk_purge_junk()',
    'public.itk_purge_womens()',
    'public.itk_drop_articles(text[])',
    'public.itk_purge_backfill(integer)',
    'public.itk_retag(jsonb)',
    'public.itk_articles_for_retag(integer)',
    'public.itk_titles_for_bench(integer)',
    'public.itk_list_subscriptions(text)',
    'public.itk_get_subscription(text,uuid,text)',
    'public.itk_update_subscription(text,uuid,text,text[],real,text,text,text)',
    'public.itk_remove_subscription(text,uuid,text)',
    'public.itk_authorize_sub(text,uuid,text)',
    'public.itk_active_subscriptions()',
    'public.itk_subscription_failed(uuid,boolean)'
  ];
begin
  foreach fn in array read_fns loop
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to anon, authenticated, service_role', fn);
  end loop;

  foreach fn in array write_fns loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Lets the dashboard react to new articles instead of polling.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'itk'
      and tablename = 'articles'
  ) then
    alter publication supabase_realtime add table itk.articles;
  end if;
end $$;
