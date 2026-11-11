# MECL-008 — Configuración del CRM en Notion (Primera Cohorte)

**Área:** Operaciones  
**Responsable:** Luis (COO)  
**Estado:** INICIO  
**Punto U:** 3.5  
**Presupuesto:** $1.000 + $250 = $1.250 USD  

---

## 1. Objetivo
Configurar un CRM en Notion para registrar y dar seguimiento a la primera cohorte de usuarios de Vyon, centralizando datos de contacto, estado de onboarding, interacciones de soporte y conversión.

---

## 2. Estructura de bases de datos Notion

### 2.1 Base: Usuarios / Cohorte 1
| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| Nombre | Título | Nombre completo del usuario |
| Email | Email | Correo de registro |
| Teléfono | Teléfono | WhatsApp vinculado |
| Fecha de registro | Fecha | Alta en Vyon |
| Canal de origen | Select | Audio, Web, Referido |
| Estado de onboarding | Select | Pendiente, En progreso, Completado, Abandonado |
| Primera acción | Checkbox | ¿Creó su primera tarea? |
| Última interacción | Fecha | Último contacto con soporte |
| NPS / Satisfacción | Number | 1-5 (encuesta Día 3) |
| Notas | Texto | Observaciones del COO |

### 2.2 Base: Tickets de Soporte
| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| ID Ticket | Número | Correlativo |
| Usuario | Relación | → Base Usuarios |
| Prioridad | Select | P1, P2, P3, P4 |
| Estado | Select | Abierto, En proceso, Esperando usuario, Cerrado |
| Canal | Select | WhatsApp, Email, Chat |
| Primera respuesta | Fecha | Timestamp SLA < 15 min |
| Resuelto en | Fecha | Timestamp de cierre |
| Comentarios | Texto | Resolución y causa raíz |

### 2.3 Base: Interacciones / Actividades
| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| Usuario | Relación | → Base Usuarios |
| Tipo | Select | Mensaje, Llamada, Email, Reunión |
| Fecha | Fecha | |
| Resumen | Texto | Qué se trató |
| Próximo paso | Texto | Acción de seguimiento |
| Responsable | Select | Luis, Soporte N1, Producto |

---

## 3. Vistas recomendadas

- **Cohorte activa**: filtro "Estado de onboarding ≠ Abandonado".
- **Pendientes de primera acción**: filtro "Primera acción = No".
- **Soporte urgente**: filtro "Prioridad = P1 o P2" + "Estado = Abierto".
- **SLA en riesgo**: filtro tickets con primera respuesta vacía y creado hace > 10 min.

---

## 4. Automatizaciones (Notion)

1. Al crear usuario → notificar a Luis por Slack/Email.
2. Al cambiar estado a "Completado" → enviar encuesta Día 3 (MECL-009).
3. Al crear ticket P1 → alerta inmediata a Luis y CTO.

---

## 5. Integración con Vyon

- Los datos de registro fluyen desde Supabase (tabla `auth.users` + `workspaces`) vía exportación CSV semanal o integración Make/Zapier (opcional en MVP).
- Los tickets de soporte se crean manualmente desde el flujo de WhatsApp/email.

---

## 6. Entregable
Documento de configuración (este archivo). Operativo en Notion; no requiere cambios de código en el frontend, salvo que el webhook de WhatsApp (MECL-008/010) pueda registrar interacciones.
