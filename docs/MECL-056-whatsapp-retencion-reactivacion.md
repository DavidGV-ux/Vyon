# MECL-056 — Sistema de mensajes de retención y reactivación por WhatsApp

**Estado:** Implementado y cableado (listo para activación con credenciales Twilio).
**Tecnología:** Twilio WhatsApp (Meta Cloud API), backend hexagonal VYON.
**Fecha:** 11/11/2026.

---

## 1. Qué hace

Un sistema programado que detecta usuarios **inactivos** y les envía, por WhatsApp:

1. **Retención** — un único mensaje cuando la inactividad supera el umbral (30 días por defecto).
2. **Reactivación** — una secuencia (drip) de mensajes en días progresivos (0, 3, 7 por defecto) mientras el usuario siga inactivo.

Cada envío queda registrado en el perfil del usuario (`sentMessages`), por lo que el
dispatcher es **idempotente**: nunca repite un mensaje ya entregado.

## 2. Arquitectura (hexagonal)

```
server/src/
├── domain/messaging/
│   ├── value-objects.ts          # MessageKind (retention|reactivation), MessageStatus, idiomas
│   ├── entities.ts               # EngagementProfile, MessageTemplate, WhatsAppSendResult, DispatchOutcome
│   ├── ports.ts                  # MessagingProviderPort, MessageTemplateRepositoryPort, EngagementRepositoryPort
│   └── services/
│       ├── retention-policy.ts   # regla pura: días de inactividad → enviar/no enviar
│       └── reactivation-sequence.ts  # regla pura: qué paso del drip está vencido
├── application/use-cases/
│   ├── send-whatsapp-message.ts          # plantilla → render → proveedor → métricas
│   └── dispatch-engagement-messages.ts   # escanea inactivos y decide/envía (idempotente)
├── infrastructure/messaging/
│   ├── twilio-whatsapp-provider.ts       # POST /2010-04-01/Accounts/{sid}/Messages.json
│   ├── file-message-template-repository.ts   # prompts/messaging.v1.json
│   └── in-memory-engagement-repository.ts    # swap por Supabase/Postgres sin tocar dominio
└── composition/
    ├── container.ts               # cableado (composition root)
    └── lambda-scheduled.ts        # handler del cron diario (EventBridge)
```

### Flujo

1. EventBridge invoca `lambda-scheduled.handler` cada día.
2. `DispatchEngagementMessagesUseCase.execute()`
   - `EngagementRepositoryPort.findInactive(threshold, now)` → perfiles inactivos.
   - `RetentionPolicy.evaluate()` → días de inactividad.
   - Si no tiene `retention` enviada → decide **retención**.
   - Si ya tiene retención → `ReactivationSequence.nextUndeliveredStep()` → decide el paso vencido pendiente.
3. `SendWhatsAppMessageUseCase` resuelve la plantilla, renderiza `{{placeholders}}` y llama a `MessagingProviderPort.send()`.
4. En éxito se guarda `sentMessages` en el perfil (garantiza idempotencia) y se emiten métricas.

## 3. Configuración

| Variable | Default | Descripción |
|---|---|---|
| `WHATSAPP_PROVIDER` | `twilio` | `twilio` o cualquier otro → `unconfigured` |
| `TWILIO_ACCOUNT_SID` | — | Cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | — | Token de auth |
| `TWILIO_WHATSAPP_FROM` | — | Número remitente (`+1415...`) |
| `TWILIO_MESSAGING_SERVICE_SID` | — | Alternativa recomendada (usa plantillas aprobadas) |
| `WHATSAPP_RETENTION_ENABLED` | `true` | Activa el mensaje de retención |
| `WHATSAPP_RETENTION_THRESHOLD_DAYS` | `30` | Umbral de inactividad |
| `WHATSAPP_REACTIVATION_ENABLED` | `true` | Activa el drip de reactivación |
| `WHATSAPP_REACTIVATION_DELAYS` | `0,3,7` | Días de retardo de cada paso |
| `ENGAGEMENT_SCHEDULE_ENABLED` | `true` | Habilita el cron diario en `serverless.yml` |

Plantillas: `server/prompts/messaging.v1.json` (es/en, con `{{name}}`, `{{days}}`, `{{link}}`).

## 4. Cómo activarlo (checklist)

- [ ] Crear cuenta Twilio con canal **WhatsApp** (sandbox o número propio verificado).
- [ ] Obtener `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y el número `TWILIO_WHATSAPP_FROM`.
- [ ] (Recomendado) Crear **plantillas aprobadas por Meta** y usar `TWILIO_MESSAGING_SERVICE_SID`.
- [ ] Definir en el backend quién alimenta `EngagementRepositoryPort` con `lastActivityAt`
      (hoy `InMemoryEngagementRepository`; en producción sustituir por Supabase/Postgres — el puerto ya está listo).
- [ ] Definir `WHATSAPP_RETENTION_THRESHOLD_DAYS` y `WHATSAPP_REACTIVATION_DELAYS` según negocio.
- [ ] Deploy: `serverless deploy --stage prod` → crea la función `vyon-engagement` con cron diario.
- [ ] Verificar: `npm run uptime:check` + revisar logs de la Lambda + métricas `vyon_whatsapp_messages_total`.

## 5. Métricas

- `vyon_whatsapp_messages_total{kind,status}`
- `vyon_whatsapp_send_latency_ms{kind}`
- `vyon_engagement_dispatch_total{status}`
- `vyon_engagement_profiles_scanned` / `vyon_engagement_messages_sent`

## 6. Tests

`server/tests/unit/`: `retention-policy`, `reactivation-sequence`,
`file-message-template-repository`, `send-whatsapp-message`,
`twilio-whatsapp-provider` (fetch simulado), `dispatch-engagement-messages`
(idempotencia + escalonado del drip).

## 7. Notas de diseño

- **Idempotencia:** `referenceId = userId:kind:step` → Twilio dedupe a nivel de
  referencia y nuestro `sentMessages` evita reenvíos entre ejecuciones.
- **Sin proveedor configurado:** se usa `UnconfiguredMessagingProvider`, que nunca
  envía y devuelve un error claro (evita envíos accidentales en dev).
- **Seguridad:** credenciales solo por variables de entorno; nunca en el repo.
