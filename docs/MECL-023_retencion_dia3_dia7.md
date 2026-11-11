# MECL-023 — Protocolo de Seguimiento Automatizado: Retención Día 3 y Día 7

**Área:** Soporte  
**Responsable:** Luis (COO)  
**Estado:** INICIO  
**Punto U:** 0.5  
**Presupuesto:** $250 + $250 = $500 USD  

---

## 1. Objetivo
Definir un protocolo automatizado de seguimiento a usuarios nuevos en el Día 3 y Día 7 después del registro, con el fin de medir retención, detectar abandono temprano y disparar acciones de recuperación antes de que el usuario se desactive.

---

## 2. Definición de hitos

| Hito | Momento | Criterio de retención | Acción si no retiene |
|------|---------|----------------------|----------------------|
| **Día 3** | 72 h post-registro | Ha creado ≥ 1 tarea o interactuado con el bot ≥ 1 vez | Enviar encuesta usabilidad (MECL-009) + recordatorio por WhatsApp |
| **Día 7** | 168 h post-registro | Ha iniciado sesión o enviado mensaje al bot en los últimos 7 días | Campaña de reactivación con incentivo (tutorial, plantilla prellenada) |

---

## 3. Flujo automatizado

1. **Registro**: se crea registro en `user_retention_tracking` con `registered_at`.
2. **Día 3 (T+72h)**: job/cron evalúa si el usuario cumplió el criterio de retención.
   - Si sí → marca `day3_retained = true`, no envía nada.
   - Si no → dispara mensaje por WhatsApp/email y registra `day3_action_taken`.
3. **Día 7 (T+168h)**: mismo evaluación.
   - Si sí → marca `day7_retained = true`.
   - Si no → dispara campaña de reactivación y registra `day7_action_taken`.
4. **Cierre**: a los 30 días se clasifica al usuario como retenido o perdido.

---

## 4. Canales de comunicación

| Canal | Día 3 | Día 7 |
|-------|-------|-------|
| WhatsApp (bot) | Mensaje corto: "¿Cómo va tu tablero? Te ayudamos a crear tu primera tarea" | Campaña reactivación |
| Email | Encuesta usabilidad (MECL-009) | Recordatorio de beneficios + plantilla |
| Push (dashboard) | Notificación interna | Banner de bienvenida de vuelta |

Máximo 2 contactos por usuario en la ventana de 7 días (anti-spam).

---

## 5. Métricas de retención

| Métrica | Cálculo | Target |
|---------|---------|--------|
| Retención Día 3 | usuarios día3_retained / usuarios cohorte | ≥ 45 % |
| Retención Día 7 | usuarios día7_retained / usuarios cohorte | ≥ 30 % |
| Tasa de respuesta a contacto | respuestas / mensajes enviados | ≥ 20 % |
| Recuperación Día 7 | usuarios que actúan tras contacto día7 / contactados | ≥ 15 % |

---

## 6. Implementación técnica (referencia)

- Tabla `user_retention_tracking` (ver migración 003 en MECL-024).
- El backend ejecuta un job programado (cron/serverless) cada 24 h evaluando cohortes pendientes.
- Se integra con el webhook de WhatsApp (MECL-010) para enviar mensajes.

---

## 7. Entregable
Documento de protocolo (este archivo). Operativo por Soporte y Growth; requiere la tabla de seguimiento y el job de evaluación (MECL-024 provee la base de datos).
