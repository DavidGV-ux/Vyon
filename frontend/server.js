const express = require('express')
const path = require('path')
const crypto = require('crypto')
const { supabaseAdmin } = require('./supabase-admin')
const { getActivePrompt, getActivePromptVersion } = require('./prompts')

const app = express()
const distDir = path.join(__dirname, 'dist')

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET

function verifyWhatsAppSignature(body, signature) {
  if (!WHATSAPP_APP_SECRET || !signature) return false
  const expected = crypto.createHmac('sha256', WHATSAPP_APP_SECRET).update(body).digest('hex')
  const received = signature.startsWith('sha256=') ? signature.slice(7) : signature
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

app.use(express.static(distDir))

// Verificación del webhook de WhatsApp Cloud API (GET challenge de Meta)
app.get('/webhooks/whatsapp', (_req, res) => {
  const mode = _req.query['hub.mode']
  const token = _req.query['hub.verify_token']
  const challenge = _req.query['hub.challenge']
  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }
  return res.sendStatus(403)
})

// Recepción de mensajes entrantes del webhook de WhatsApp Cloud API
app.post(
  '/webhooks/whatsapp',
  express.raw({ type: 'application/json' }),
  async (_req, res) => {
    if (!verifyWhatsAppSignature(_req.body, _req.headers['x-hub-signature-256'])) {
      return res.sendStatus(401)
    }

    let payload
    try {
      payload = JSON.parse(_req.body.toString('utf8'))
    } catch {
      return res.sendStatus(400)
    }

    const entry = (payload.entry || [])[0]
    const waEntryId = entry && entry.id

    await supabaseAdmin.from('whatsapp_webhook_events').insert({
      wa_entry_id: waEntryId || null,
      object: payload.object || 'whatsapp_business_account',
      raw_payload: payload,
      processed: false,
    })

    const changes = entry && entry.changes || []
    for (const change of changes) {
      const value = change.value || {}
      const messages = value.messages || []
      for (const msg of messages) {
        await supabaseAdmin.from('whatsapp_messages').insert({
          wa_message_id: msg.id,
          wa_contact_id: (value.contacts || [])[0] && (value.contacts || [])[0].wa_id || null,
          from_number: msg.from,
          to_number: value.metadata && value.metadata.display_phone_number || '',
          type: msg.type || 'text',
          body: msg.text && msg.text.body || null,
          timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000).toISOString() : null,
          direction: 'inbound',
          status: 'received',
          raw_payload: msg,
        })
      }
    }

    if (waEntryId) {
      await supabaseAdmin
        .from('whatsapp_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('wa_entry_id', waEntryId)
    }

    return res.sendStatus(200)
  }
)

// Endpoint administrativo: devuelve el Prompt Maestro activo (MECL-025)
app.get('/admin/prompt-active', (_req, res) => {
  const active = getActivePrompt()
  return res.json({
    version: getActivePromptVersion(),
    name: active.name,
    description: active.description,
    temperature: active.temperature,
    maxTokens: active.maxTokens,
    calibratedAt: active.calibratedAt,
    calibratedBy: active.calibratedBy,
    fixes: active.fixes,
  })
})

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

const PORT = process.env.PORT || 3000

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`VYON mockup running on http://localhost:${PORT}`)
  })
}

module.exports = app
