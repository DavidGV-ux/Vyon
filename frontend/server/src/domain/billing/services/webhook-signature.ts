import { createHmac, timingSafeEqual } from 'node:crypto'

export const WEBHOOK_SIGNATURE_HEADER = 'x-vyon-signature'

export function signPayload(payload: string, secret: string): string {
  return `v1=${createHmac('sha256', secret).update(payload).digest('hex')}`
}

export function verifySignature(payload: string, header: string | undefined, secret: string): boolean {
  if (!header) return false
  const expected = Buffer.from(signPayload(payload, secret), 'utf8')
  const received = Buffer.from(header, 'utf8')
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
