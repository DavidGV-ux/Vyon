import type { Logger } from '../../domain/shared/ports.js'

export type AuthUser = { readonly id: string; readonly email: string | null }

export interface AuthPort {
  authenticate(token: string): Promise<AuthUser | null>
}

export class SupabaseAuthAdapter implements AuthPort {
  constructor(
    private readonly supabaseUrl: string,
    private readonly anonKey: string,
    private readonly logger: Logger,
  ) {}

  async authenticate(token: string): Promise<AuthUser | null> {
    if (!this.supabaseUrl || !this.anonKey) return null
    try {
      const response = await fetch(`${this.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: this.anonKey },
      })
      if (!response.ok) return null
      const data = (await response.json()) as { id?: string; email?: string }
      if (!data.id) return null
      return { id: data.id, email: data.email ?? null }
    } catch (error) {
      this.logger.warn('supabase auth check failed', { error: String(error) })
      return null
    }
  }
}

export class NoopAuthAdapter implements AuthPort {
  async authenticate(): Promise<AuthUser | null> {
    return null
  }
}
