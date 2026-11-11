import { describe, it, expect, vi, afterEach } from 'vitest'
import { TwilioWhatsAppProvider, normalizeE164, UnconfiguredMessagingProvider } from '../../src/infrastructure/messaging/twilio-whatsapp-provider.js'

describe('normalizeE164', () => {
  it('keeps an already valid E.164 number', () => {
    expect(normalizeE164('+573001112233')).toBe('+573001112233')
  })

  it('strips spaces and dashes', () => {
    expect(normalizeE164('+57 300-111-2233')).toBe('+573001112233')
  })

  it('adds the plus sign when missing', () => {
    expect(normalizeE164('573001112233')).toBe('+573001112233')
  })
})

describe('TwilioWhatsAppProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports failure when not configured', async () => {
    const provider = new TwilioWhatsAppProvider({ accountSid: '', authToken: '', from: '' })
    const result = await provider.send({ to: '+573001112233', kind: 'retention', body: 'hola' })
    expect(result.ok).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('not configured')
  })

  it('posts to the Twilio Messages endpoint with whatsapp formatting', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ sid: 'SMabc', status: 'queued' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new TwilioWhatsAppProvider({
      accountSid: 'AC123',
      authToken: 'token',
      from: '+14155238886',
      apiBase: 'https://api.twilio.test',
    })

    const result = await provider.send({ to: '+573001112233', kind: 'retention', body: 'hola' })

    expect(result.ok).toBe(true)
    expect(result.providerMessageSid).toBe('SMabc')
    expect(result.status).toBe('sent')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.twilio.test/2010-04-01/Accounts/AC123/Messages.json')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toMatch(/^Basic /)
    const body = init.body as FormData
    expect(body.get('To')).toBe('whatsapp:+573001112233')
    expect(body.get('From')).toBe('whatsapp:+14155238886')
    expect(body.get('Body')).toBe('hola')
  })

  it('uses MessagingServiceSid instead of From when configured', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ sid: 'SMsvc', status: 'queued' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new TwilioWhatsAppProvider({
      accountSid: 'AC123',
      authToken: 'token',
      from: '',
      messagingServiceSid: 'MG123',
    })

    await provider.send({ to: '+573001112233', kind: 'reactivation', body: 'hola' })
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
    expect(body.get('MessagingServiceSid')).toBe('MG123')
    expect(body.get('From')).toBeNull()
  })

  it('returns failure when Twilio responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ code: 21211, message: 'Invalid To number' }),
    })))

    const provider = new TwilioWhatsAppProvider({ accountSid: 'AC123', authToken: 'token', from: '+14155238886' })
    const result = await provider.send({ to: 'abc', kind: 'retention', body: 'hola' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid To number')
  })
})

describe('UnconfiguredMessagingProvider', () => {
  it('never sends and reports a clear error', async () => {
    const provider = new UnconfiguredMessagingProvider()
    const result = await provider.send({ to: '+573001112233', kind: 'retention', body: 'hola' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not configured')
  })
})
