# MECL-007 — Protocolo de Soporte con SLA < 15 min y Guía de Contingencia

**Área:** Soporte  
**Responsable:** Luis (COO)  
**Estado:** INICIO  
**Punto U:** 0.5  
**Presupuesto:** $250 + $250 = $500 USD  

---

## 1. Objetivo
Garantizar que cualquier incidencia de usuario reciba primera respuesta en menos de 15 minutos, definiendo canales, prioridades, escalamiento y procedimientos de contingencia ante fallas del servicio.

---

## 2. Canales de soporte

| Canal | Disponibilidad | Tiempo de primera respuesta |
|-------|---------------|-----------------------------|
| WhatsApp (bot + humano) | 7 × 24 (bot) / L-V 9-18 (humano) | < 15 min |
| Email soporte@vyón.com | L-V 9-18 | < 15 min (auto-respuesta + ticket) |
| Chat dentro del dashboard | L-V 9-18 | < 15 min |

---

## 3. Clasificación de prioridades y SLA

| Prioridad | Ejemplo | Primera respuesta | Resolución objetivo | Escalamiento |
|-----------|---------|-------------------|---------------------|--------------|
| **P1 Crítica** | Caída total del servicio, no se puede acceder | < 5 min | < 2 h | COO + CTO inmediato |
| **P2 Alta** | Funcionalidad principal rota (ej. crear tarea) | < 10 min | < 4 h | Líder de área |
| **P3 Media** | Error secundario, workaround disponible | < 15 min | < 1 día | Soporte N1 |
| **P4 Baja** | Duda de uso, mejora UX | < 15 min (auto) | < 3 días | Base de conocimiento |

---

## 4. Flujo de atención

1. **Ingreso**: mensaje llega por WhatsApp/email/chat → se crea ticket automático en Notion CRM (MECL-008).
2. **Triage**: agente N1 clasifica prioridad y asigna canal.
3. **Primera respuesta**: < 15 min (incluso si es para informar que se investiga).
4. **Resolución**: dentro del SLA de la prioridad asignada.
5. **Cierre**: usuario confirma satisfacción; ticket se cierra con registro de causa raíz.

---

## 5. Guía de contingencia por fallas

### 5.1 Caída del backend / Supabase
- **Detección**: alerta de monitoreo o reporte de usuario.
- **Acción inmediata**: publicar aviso en WhatsApp bot y dashboard ("Estamos investigando una incidencia").
- **Comunicación**: email a usuarios afectados cada 30 min hasta resolución.
- **Escalamiento**: notificar a CTO y COO por grupo de emergencia.
- **Post-mortem**: documento dentro de las 24 h posteriores.

### 5.2 Webhook de WhatsApp no responde
- Verificar URL del webhook y token de verificación en Meta for Developers.
- Revisar logs de Lambda/Function URL.
- Si persiste, cambiar temporalmente a canal de email y avisar por broadcast de WhatsApp.

### 5.3 Caída del canal de audio (bot de voz)
- Redirigir a flujo de texto (WhatsApp chat).
- Mensaje automático: "El servicio de voz está temporalmente fuera, escríbenos por aquí".

### 5.4 Pérdida de datos / transacción financiera fallida
- Detener procesos de cobro automático.
- Revisar tabla `transactions` con estado `failed` o `pending` > 1 h.
- Contactar a usuarios afectados individualmente.

---

## 6. Métricas de soporte

- % tickets con primera respuesta < 15 min (target ≥ 95 %).
- Tiempo medio de resolución por prioridad.
- CSAT (satisfacción del usuario post-cierre, target ≥ 4.5 / 5).
- Volumen de tickets P1/P2 por semana (tendencia).

---

## 7. Entregable
Documento estratégico (este archivo). Operativo por el equipo de Soporte; no requiere cambios de código directo, aunque el webhook (MECL-010) debe registrar eventos de soporte.
