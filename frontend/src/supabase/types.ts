export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TransactionType = 'income' | 'expense';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'disputed';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  workspace_id: string;
  assignee_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTag {
  id: string;
  task_id: string;
  tag: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  workspace_id: string;
  name: string;
  currency: string;
  balance_cents: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  workspace_id: string;
  type: TransactionType;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  reference_id: string | null;
  external_id: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  customer_name: string;
  customer_email: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  workspace_id: string | null;
  wa_message_id: string;
  wa_contact_id: string | null;
  from_number: string;
  to_number: string;
  type: string;
  body: string | null;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  status: string;
  raw_payload: any;
  created_at: string;
}

export interface WhatsAppWebhookEvent {
  id: string;
  wa_entry_id: string | null;
  object: string;
  raw_payload: any;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  user_id: string;
  workspace_id: string | null;
  ease_of_registration: number | null;
  first_action_completed: boolean | null;
  blocker_reason: string | null;
  bot_usefulness: number | null;
  desired_feature: string | null;
  nps_score: number | null;
  sent_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  event_properties: any;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface UserRetentionTracking {
  id: string;
  user_id: string;
  workspace_id: string | null;
  registered_at: string;
  first_action_at: string | null;
  day3_retained: boolean;
  day3_evaluated_at: string | null;
  day3_action_taken: boolean;
  day3_message_sent: boolean;
  day7_retained: boolean;
  day7_evaluated_at: string | null;
  day7_action_taken: boolean;
  day7_message_sent: boolean;
  status: 'active' | 'retained' | 'churned';
  evaluated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CohortConsumption {
  id: string;
  cohort_date: string;
  cohort_size: number;
  tokens_used: number;
  db_read_operations: number;
  db_write_operations: number;
  db_storage_bytes: number;
  active_users_day3: number;
  active_users_day7: number;
  avg_revenue_per_user_cents: number;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      workspaces: { Row: Workspace; Insert: Partial<Workspace>; Update: Partial<Workspace> };
      workspace_members: { Row: WorkspaceMember; Insert: Partial<WorkspaceMember>; Update: Partial<WorkspaceMember> };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> };
      task_tags: { Row: TaskTag; Insert: Partial<TaskTag>; Update: Partial<TaskTag> };
      task_comments: { Row: TaskComment; Insert: Partial<TaskComment>; Update: Partial<TaskComment> };
      wallets: { Row: Wallet; Insert: Partial<Wallet>; Update: Partial<Wallet> };
      transactions: { Row: Transaction; Insert: Partial<Transaction>; Update: Partial<Transaction> };
      invoices: { Row: Invoice; Insert: Partial<Invoice>; Update: Partial<Invoice> };
      whatsapp_messages: { Row: WhatsAppMessage; Insert: Partial<WhatsAppMessage>; Update: Partial<WhatsAppMessage> };
      whatsapp_webhook_events: { Row: WhatsAppWebhookEvent; Insert: Partial<WhatsAppWebhookEvent>; Update: Partial<WhatsAppWebhookEvent> };
      survey_responses: { Row: SurveyResponse; Insert: Partial<SurveyResponse>; Update: Partial<SurveyResponse> };
      analytics_events: { Row: AnalyticsEvent; Insert: Partial<AnalyticsEvent>; Update: Partial<AnalyticsEvent> };
      user_retention_tracking: { Row: UserRetentionTracking; Insert: Partial<UserRetentionTracking>; Update: Partial<UserRetentionTracking> };
      cohort_consumption: { Row: CohortConsumption; Insert: Partial<CohortConsumption>; Update: Partial<CohortConsumption> };
    };
    Views: {};
    Functions: {};
    Enums: {
      task_status: TaskStatus;
      task_priority: TaskPriority;
      transaction_type: TransactionType;
      payment_status: PaymentStatus;
      invoice_status: InvoiceStatus;
    };
    CompositeTypes: {};
  };
}
