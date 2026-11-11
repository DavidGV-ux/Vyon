-- ============================================================================
-- VYON — Migración 002: Webhook WhatsApp Cloud API y encuestas
-- Soporte para MECL-009 (encuesta Día 3) y MECL-010 (webhook WhatsApp)
-- ============================================================================

create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  wa_message_id text not null,
  wa_contact_id text,
  from_number text not null,
  to_number text not null,
  type text not null default 'text',
  body text,
  timestamp timestamptz not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null default 'received',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_whatsapp_messages_from on whatsapp_messages(from_number);
create index idx_whatsapp_messages_wa_id on whatsapp_messages(wa_message_id);
create index idx_whatsapp_messages_created_at on whatsapp_messages(created_at);

create table whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  wa_entry_id text,
  object text not null default 'whatsapp_business_account',
  raw_payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_whatsapp_webhook_events_processed on whatsapp_webhook_events(processed);
create index idx_whatsapp_webhook_events_created_at on whatsapp_webhook_events(created_at);

-- Tabla de respuestas de encuesta (MECL-009)
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  ease_of_registration integer check (ease_of_registration between 1 and 5),
  first_action_completed boolean,
  blocker_reason text,
  bot_usefulness integer check (bot_usefulness between 1 and 5),
  desired_feature text,
  nps_score integer check (nps_score between 0 and 10),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_survey_responses_user on survey_responses(user_id);
create index idx_survey_responses_sent_at on survey_responses(sent_at);

-- Habilitar RLS en tablas nuevas
alter table whatsapp_messages enable row level security;
alter table whatsapp_webhook_events enable row level security;
alter table survey_responses enable row level security;

-- Políticas: service role (backend) gestiona todo; usuarios solo lecturan lo suyo
create policy "whatsapp_messages_service_full" on whatsapp_messages
  for all using (true) with check (true);
create policy "whatsapp_webhook_events_service_full" on whatsapp_webhook_events
  for all using (true) with check (true);
create policy "survey_responses_own" on survey_responses
  for select using (auth.uid() = user_id);
create policy "survey_responses_insert_service" on survey_responses
  for insert with check (true);

-- Trigger updated_at no aplica (sin columna updated_at en estas tablas)

comment on table whatsapp_messages is 'Mensajes entrantes/salientes de WhatsApp Cloud API';
comment on table whatsapp_webhook_events is 'Eventos crudos del webhook de WhatsApp';
comment on table survey_responses is 'Respuestas de encuesta de usabilidad Día 3 (MECL-009)';
