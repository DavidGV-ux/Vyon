-- ============================================================================
-- VYON — Esquema inicial de Base de Datos (Supabase / PostgreSQL)
-- Tareas y Finanzas
-- Buenas prácticas: RLS habilitado, soft delete, timestamps de auditoría,
-- constraints de integridad, índices para consultas frecuentes y enums tipados.
-- ============================================================================

-- ------------------------------------------------------------
-- Extensiones y tipos enum
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

create type task_status as enum ('todo', 'in_progress', 'done', 'blocked', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type transaction_type as enum ('income', 'expense');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'disputed');
create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- ------------------------------------------------------------
-- Tablas base
-- ------------------------------------------------------------

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  color text default '#94A3B8',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TAREAS
-- ------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_date timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_tags (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (task_id, tag)
);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- FINANZAS
-- ------------------------------------------------------------

create table wallets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null default 'Billetera principal',
  currency text not null default 'USD' check (char_length(currency) = 3),
  balance_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type transaction_type not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status payment_status not null default 'pending',
  description text,
  reference_id text,
  external_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  customer_name text not null,
  customer_email text,
  invoice_number text unique not null,
  status invoice_status not null default 'draft',
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Índices para consultas frecuentes
-- ------------------------------------------------------------

create index idx_tasks_workspace on tasks(workspace_id);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_assignee on tasks(assignee_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_deleted_at on tasks(deleted_at) where deleted_at is not null;

create index idx_task_tags_task on task_tags(task_id);

create index idx_task_comments_task on task_comments(task_id);
create index idx_task_comments_author on task_comments(author_id);

create index idx_wallets_workspace on wallets(workspace_id);

create index idx_transactions_wallet on transactions(wallet_id);
create index idx_transactions_workspace on transactions(workspace_id);
create index idx_transactions_type on transactions(type);
create index idx_transactions_status on transactions(status);
create index idx_transactions_occurred_at on transactions(occurred_at);

create index idx_invoices_workspace on invoices(workspace_id);
create index idx_invoices_status on invoices(status);
create index idx_invoices_due_date on invoices(due_date);

-- ------------------------------------------------------------
-- Timestamps automáticos (updated_at)
-- ------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare tbl text;
begin
  for tbl in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in (
        'workspaces','projects','tasks','wallets','transactions','invoices',
        'task_comments'
      )
  loop
    execute format(
      $f$
      create trigger set_%1$I_updated_at
      before update on public.%1$I
      for each row
      execute function set_updated_at();
      $f$,
      tbl
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- ------------------------------------------------------------

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_tags enable row level security;
alter table task_comments enable row level security;
alter table wallets enable row level security;
alter table transactions enable row level security;
alter table invoices enable row level security;

-- Workspaces: miembros ven su workspace; dueño puede gestionar
create policy "workspaces_select_member" on workspaces
  for select using (
    auth.uid() = owner_id or
    exists (select 1 from workspace_members wm where wm.workspace_id = workspaces.id and wm.user_id = auth.uid())
  );
create policy "workspaces_insert_owner" on workspaces
  for insert with check (auth.uid() = owner_id);
create policy "workspaces_update_owner" on workspaces
  for update using (auth.uid() = owner_id);
create policy "workspaces_delete_owner" on workspaces
  for delete using (auth.uid() = owner_id);

-- Workspace members
create policy "workspace_members_select" on workspace_members
  for select using (
    user_id = auth.uid() or
    exists (select 1 from workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid())
  );
create policy "workspace_members_insert_owner" on workspace_members
  for insert with check (
    exists (select 1 from workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid())
  );

-- Projects
create policy "projects_select_member" on projects
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = projects.workspace_id and wm.user_id = auth.uid())
  );
create policy "projects_insert_admin" on projects
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = projects.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );
create policy "projects_update_admin" on projects
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = projects.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );
create policy "projects_delete_admin" on projects
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = projects.workspace_id and wm.user_id = auth.uid() and wm.role = 'owner')
  );

-- Tasks
create policy "tasks_select_member" on tasks
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid())
  );
create policy "tasks_insert_member" on tasks
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid())
  );
create policy "tasks_update_member" on tasks
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid())
  );
create policy "tasks_delete_member" on tasks
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );

-- Task tags & comments (heredan visibilidad de tarea)
create policy "task_tags_select_task" on task_tags
  for select using (
    exists (select 1 from tasks t where t.id = task_tags.task_id and exists (
      select 1 from workspace_members wm where wm.workspace_id = t.workspace_id and wm.user_id = auth.uid()
    ))
  );
create policy "task_tags_insert_task" on task_tags
  for insert with check (
    exists (select 1 from tasks t where t.id = task_tags.task_id and exists (
      select 1 from workspace_members wm where wm.workspace_id = t.workspace_id and wm.user_id = auth.uid()
    ))
  );
create policy "task_comments_select_task" on task_comments
  for select using (
    exists (select 1 from tasks t where t.id = task_comments.task_id and exists (
      select 1 from workspace_members wm where wm.workspace_id = t.workspace_id and wm.user_id = auth.uid()
    ))
  );
create policy "task_comments_insert_member" on task_comments
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = (
      select workspace_id from tasks where id = task_comments.task_id
    ) and wm.user_id = auth.uid())
  );

-- Wallets & transactions & invoices
create policy "finance_select_member" on wallets
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = wallets.workspace_id and wm.user_id = auth.uid())
  );
create policy "finance_insert_admin" on wallets
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = wallets.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );
create policy "finance_update_admin" on wallets
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = wallets.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );
create policy "finance_delete_admin" on wallets
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = wallets.workspace_id and wm.user_id = auth.uid() and wm.role = 'owner')
  );

create policy "transactions_select_member" on transactions
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = transactions.workspace_id and wm.user_id = auth.uid())
  );
create policy "transactions_insert_member" on transactions
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = transactions.workspace_id and wm.user_id = auth.uid())
  );
create policy "transactions_update_admin" on transactions
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = transactions.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );

create policy "invoices_select_member" on invoices
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = invoices.workspace_id and wm.user_id = auth.uid())
  );
create policy "invoices_insert_member" on invoices
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = invoices.workspace_id and wm.user_id = auth.uid())
  );
create policy "invoices_update_admin" on invoices
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = invoices.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin'))
  );
create policy "invoices_delete_admin" on invoices
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = invoices.workspace_id and wm.user_id = auth.uid() and wm.role = 'owner')
  );

-- ------------------------------------------------------------
-- Comentarios de documentación
-- ------------------------------------------------------------
comment on table tasks is 'Tareas y tablero Kanban por workspace';
comment on table wallets is 'Billeteras por workspace con saldo en centavos';
comment on table transactions is 'Movimientos financieros (ingresos/gastos)';
comment on table invoices is 'Facturas emitidas por workspace';
comment on column transactions.amount_cents is 'Monto en centavos (enteros, sin decimales) para evitar errores de punto flotante';
