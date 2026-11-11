# MECL-021 — Mapa de Tasa de Conversión: Visitas Landing → Mensajes Bot

**Área:** Growth  
**Responsable:** Luis (COO)  
**Estado:** INICIO  
**Punto U:** 3.1  
**Presupuesto:** $800 + $250 = $1.050 USD  

---

## 1. Objetivo
Definir el modelo de medición y el embudo de conversión desde una visita a la Landing Page de Vyon hasta el primer mensaje enviado al bot por WhatsApp, permitiendo calcular la tasa de conversión real y detectar fugas en cada paso.

---

## 2. Embudo de conversión

| Paso | Evento | Canal | Definición | Métrica |
|------|--------|-------|------------|---------|
| **P1** | `page_visit` | Landing (`/`) | Usuario llega a la landing (impresión única) | Visitas totales |
| **P2** | `cta_click` | Landing | Clic en "Registrarse", "Empezar gratis" o "Ver demo" | CTR de CTA |
| **P3** | `wa_click` | Landing / Chat | Clic en número de WhatsApp o apertura de chat del bot | Tasa de apertura bot |
| **P4** | `wa_message_sent` | WhatsApp | Usuario envía su primer mensaje al bot | Tasa de conversión final |

**Tasa de conversión global** = P4 / P1 × 100  
**Target:** ≥ 8 % de visitas → primer mensaje al bot.

---

## 3. Eventos a instrumentar (frontend)

Registrar en Supabase (`analytics_events`) o enviar a stack de analytics:

```ts
type AnalyticsEvent =
  | { name: 'page_visit'; props: { referrer?: string; utm_source?: string } }
  | { name: 'cta_click'; props: { cta_label: string; position: 'hero' | 'footer' | 'nav' } }
  | { name: 'wa_click'; props: { button_label: string } }
  | { name: 'wa_message_sent'; props: { message_preview: string } };
```

Parámetros UTM a capturar: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`.

---

## 4. Fuentes de tráfico esperadas

- TikTok (orgánico y pauta)
- Instagram (orgánico, Reels, Stories, pauta)
- YouTube (orgánico, Shorts, pauta)
- WhatsApp (referido directo)
- Orgánico / Directo

---

## 5. Métricas y reportes

| Métrica | Fórmula | Target |
|---------|---------|--------|
| Visitas totales (P1) | count(page_visit) | — |
| CTR CTA (P2/P1) | count(cta_click) / count(page_visit) | ≥ 6 % |
| Apertura bot (P3/P2) | count(wa_click) / count(cta_click) | ≥ 40 % |
| Conversión final (P4/P1) | count(wa_message_sent) / count(page_visit) | ≥ 8 % |
| Costo por mensaje (si pauta) | gasto / count(wa_message_sent) | ≤ $0.50 USD |

---

## 6. Implementación técnica (referencia)

- Tabla `analytics_events` (ver migración 003 en MECL-022/024).
- El frontend captura los eventos en Landing y los envía al backend.
- El backend los almacena y el dashboard de Growth (MECL-022) los visualiza.

---

## 7. Entregable
Documento estratégico (este archivo). La instrumentación de eventos se implementa junto con MECL-022 (tablero analítica).
