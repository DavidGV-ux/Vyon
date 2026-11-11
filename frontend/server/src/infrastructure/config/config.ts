export type AppConfig = {
  readonly nodeEnv: string
  readonly port: number
  readonly logLevel: string
  readonly corsOrigin: string
  readonly requestBudgetMs: number
  readonly ai: {
    readonly provider: string
    readonly timeoutMs: number
    readonly maxTokens: number
    readonly temperature: number
    readonly cacheTtlMs: number
    readonly cacheMaxEntries: number
    readonly maxTokensByKind: Record<string, number>
    readonly anthropic: { readonly apiKey: string; readonly model: string }
    readonly openai: { readonly apiKey: string; readonly baseUrl: string; readonly model: string }
  }
  readonly whisper: {
    readonly provider: string
    readonly apiBase: string
    readonly apiKey: string
    readonly model: string
    readonly language: string
  }
  readonly supabase: { readonly url: string; readonly anonKey: string }
  readonly whatsapp: {
    readonly provider: string
    readonly defaultLanguage: string
    readonly twilio: {
      readonly accountSid: string
      readonly authToken: string
      readonly from: string
      readonly messagingServiceSid: string
      readonly apiBase: string
      readonly timeoutMs: number
    }
    readonly retention: { readonly enabled: boolean; readonly inactivityThresholdDays: number }
    readonly reactivation: { readonly enabled: boolean; readonly delaysDays: readonly number[] }
  }
  readonly authRequired: boolean
  readonly metricsEnabled: boolean
  readonly version: string
}

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  return raw.toLowerCase() === 'true' || raw === '1'
}

function envNumberList(key: string, fallback: readonly number[]): readonly number[] {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  const parsed = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0)
  return parsed.length > 0 ? parsed : fallback
}

export function loadConfig(): AppConfig {
  return {
    nodeEnv: env('NODE_ENV', 'development'),
    port: envNumber('PORT', 3000),
    logLevel: env('LOG_LEVEL', 'info'),
    corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
    requestBudgetMs: envNumber('REQUEST_BUDGET_MS', 3800),
    ai: {
      provider: env('AI_PROVIDER', 'deterministic'),
      timeoutMs: envNumber('AI_TIMEOUT_MS', 3800),
      maxTokens: envNumber('AI_MAX_TOKENS', 2048),
      temperature: envNumber('AI_TEMPERATURE', 0.2),
      cacheTtlMs: envNumber('AI_CACHE_TTL_MS', 30 * 60 * 1000),
      cacheMaxEntries: envNumber('AI_CACHE_MAX_ENTRIES', 200),
      maxTokensByKind: {
        finanzas: envNumber('AI_MAX_TOKENS_FINANZAS', 1600),
        tareas: envNumber('AI_MAX_TOKENS_TAREAS', 1600),
        resumenes: envNumber('AI_MAX_TOKENS_RESUMENES', 1200),
      },
      anthropic: {
        apiKey: env('ANTHROPIC_API_KEY', ''),
        model: env('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest'),
      },
      openai: {
        apiKey: env('OPENAI_API_KEY', ''),
        baseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        model: env('OPENAI_MODEL', 'gpt-4o-mini'),
      },
    },
    whisper: {
      provider: env('WHISPER_PROVIDER', 'openai'),
      apiBase: env('WHISPER_API_BASE', 'https://api.openai.com/v1'),
      apiKey: env('WHISPER_API_KEY', ''),
      model: env('WHISPER_MODEL', 'whisper-1'),
      language: env('WHISPER_LANGUAGE', 'es'),
    },
    supabase: {
      url: env('SUPABASE_URL', ''),
      anonKey: env('SUPABASE_ANON_KEY', ''),
    },
    whatsapp: {
      provider: env('WHATSAPP_PROVIDER', 'twilio'),
      defaultLanguage: env('WHATSAPP_DEFAULT_LANGUAGE', 'es'),
      twilio: {
        accountSid: env('TWILIO_ACCOUNT_SID', ''),
        authToken: env('TWILIO_AUTH_TOKEN', ''),
        from: env('TWILIO_WHATSAPP_FROM', ''),
        messagingServiceSid: env('TWILIO_MESSAGING_SERVICE_SID', ''),
        apiBase: env('TWILIO_API_BASE', 'https://api.twilio.com'),
        timeoutMs: envNumber('TWILIO_TIMEOUT_MS', 8000),
      },
      retention: {
        enabled: envBool('WHATSAPP_RETENTION_ENABLED', true),
        inactivityThresholdDays: envNumber('WHATSAPP_RETENTION_THRESHOLD_DAYS', 30),
      },
      reactivation: {
        enabled: envBool('WHATSAPP_REACTIVATION_ENABLED', true),
        delaysDays: envNumberList('WHATSAPP_REACTIVATION_DELAYS', [0, 3, 7]),
      },
    },
    authRequired: envBool('AUTH_REQUIRED', false),
    metricsEnabled: envBool('METRICS_ENABLED', true),
    version: '0.2.0',
  }
}
