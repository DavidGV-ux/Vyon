-- ============================================================================
-- VYON — Migración 003: Analítica, retención y consumo por cohorte
-- Soporte para MECL-021, MECL-022, MECL-023, MECL-024
-- ============================================================================

-- ------------------------------------------------------------
-- Eventos de analítica (Landing -> bot, CTA, etc.)
-- ------------------------------------------------------------
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null,
  event_properties jsonb not null default '{}'::jsonb,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_analytics_events_created_at on analytics_events(created_at);
create index idx_analytics_events_event_name on analytics_events(event_name);
create index idx_analytics_events_user_id on analytics_events(user_id);
create index idx_analytics_events_utm_source on analytics_events(utm_source);

-- ------------------------------------------------------------
-- Seguimiento de retención Día 3 / Día 7 (MECL-023)
-- ------------------------------------------------------------
create table user_retention_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  registered_at timestamptz not null default now(),
  first_action_at timestamptz,
  day3_retained boolean not null default false,
  day3_evaluated_at timestamptz,
  day3_action_taken boolean not null default false,
  day3_message_sent boolean not null default false,
  day7_retained boolean not null default false,
  day7_evaluated_at timestamptz,
  day7_action_taken boolean not null default false,
  day7_message_sent boolean not null default false,
  status text not null default 'active' check (status in ('active', 'retained', 'churned')),
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_retention_user on user_retention_tracking(user_id);
create index idx_user_retention_registered_at on user_retention_tracking(registered_at);
create index idx_user_retention_status on user_retention_tracking(status);
create index idx_user_retention_day3_retained on user_retention_tracking(day3_retained) where day3_retained = false;
create index idx_user_retention_day7_retained on user_retention_tracking(day7_retained) where day7_retained = false;

-- ------------------------------------------------------------
-- Consumo de tokens y base de datos por cohorte (MECL-024)
-- ------------------------------------------------------------
create table cohort_consumption (
  id uuid primary key default gen_random_uuid(),
  cohort_date date not null,
  cohort_size integer not null default 0,
  tokens_used integer not null default 0,
  db_read_operations integer not null default 0,
  db_write_operations integer not null default 0,
  db_storage_bytes bigint not null default 0,
  active_users_day3 integer not null default 0,
  active_users_day7 integer not null default 0,
  avg_revenue_per_user_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_date)
);

create index idx_cohort_consumption_date on cohort_consumption(cohort_date);

-- RLS
alter table analytics_events enable row level security;
alter table user_retention_tracking enable row level security;
alter table cohort_consumption enable row level security;

create policy "analytics_events_insert_service" on analytics_events
  for insert with check (true);
create policy "analytics_events_select_admin" on analytics_events
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = analytics_events.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );

create policy "user_retention_tracking_service_full" on user_retention_tracking
  for all using (true) with check (true);
create policy "user_retention_select_admin" on user_retention_tracking
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = user_retention_tracking.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );

create policy "cohort_consumption_service_full" on cohort_consumption
  for all using (true) with check (true);
create policy "cohort_consumption_select_admin" on cohort_consumption
  for select using (true);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_user_retention_tracking_updated_at
  before update on public.user_retention_tracking
  for each row
  execute function set_updated_at();

create trigger set_cohort_consumption_updated_at
  before update on public.cohort_consumption
  for each row
  execute function set_updated_at();

comment on table analytics_events is 'Eventos de analítica de tráfico y conversión (MECL-021/022)';
comment on table user_retention_tracking is 'Seguimiento de retención Día 3 y Día 7 (MECL-023)';
comment on table cohort_consumption is 'Consumo de tokens y DB por cohorte de usuarios (MECL-024)';
