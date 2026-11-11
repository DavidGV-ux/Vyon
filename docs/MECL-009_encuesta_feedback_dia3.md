# MECL-009 — Encuesta de Feedback (Usabilidad Día 3 del Bot)

**Área:** Producto  
**Responsable:** Luis (COO)  
**Estado:** INICIO  
**Punto U:** 3.2  
**Presupuesto:** $850 + $250 = $1.100 USD  

---

## 1. Objetivo
Evaluar la usabilidad del bot de Vyon al tercer día de uso del usuario, identificando puntos de fricción en el embudio Audio → Registro → Acción y generando insights para mejorar la retención.

---

## 2. Momento de envío
- **Disparador:** 72 horas (Día 3) después del registro exitoso del usuario.
- **Canal:** WhatsApp (mensaje de plantilla aprobada por Meta) o email.
- **Frecuencia:** una sola vez por usuario.

---

## 3. Cuestionario (máx. 6 preguntas, < 2 min)

| # | Pregunta | Tipo | Opciones / Escala |
|---|----------|------|-------------------|
| 1 | ¿Qué tan fácil fue registrarte en Vyon? | Escala 1-5 | 1 Muy difícil, 5 Muy fácil |
| 2 | ¿Lograste crear tu primera tarea/proyecto? | Sí / No | Binario |
| 3 | Si no, ¿qué te impidió hacerlo? | Abierto | Texto libre |
| 4 | ¿Qué tan útil te resultó el bot de audio para empezar? | Escala 1-5 | 1 Nada útil, 5 Muy útil |
| 5 | ¿Qué característica te gustaría que tuviera Vyon? | Abierto | Texto libre |
| 6 | ¿Recomendarías Vyon a un colega? | NPS 0-10 | Escala 0-10 |

---

## 4. Flujo de envío

1. Día 3 → sistema consulta Supabase: usuarios registrados hace 72 h que no han recibido la encuesta.
2. Se envía mensaje por WhatsApp con enlace al formulario (Typeform/Google Forms/Notion form) o preguntas por botón de respuesta rápida.
3. Respuestas se almacenan en base de datos `survey_responses` (ver sección 5).
4. Si no responde en 48 h → un solo recordatorio (máximo 2 envíos totales).

---

## 5. Almacenamiento de respuestas (Supabase)

```sql
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  ease_of_registration integer check (ease_of_registration between 1 and 5),
  first_action_completed boolean,
  blocker_reason text,
  bot_usefulness integer check (bot_usefulness between 1 and 5),
  desired_feature text,
  nps_score integer check (nps_score between 0 and 10),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

## 6. Métricas esperadas

- Tasa de respuesta a la encuesta (target ≥ 30 %).
- Promedio facilidad de registro (target ≥ 4 / 5).
- % usuarios que completaron primera acción (target ≥ 50 %).
- NPS del Día 3 (target ≥ 30).
- Temas repetidos en respuestas abiertas (analizados semanalmente por Producto).

---

## 7. Uso de los resultados

- Producto prioriza mejoras de usabilidad según bloqueadores más citados.
- Operaciones ajusta el embudo de onboarding (MECL-006).
- Soporte da seguimiento individual a usuarios con puntuación ≤ 2 en cualquier pregunta.

---

## 8. Entregable
Documento de diseño de encuesta (este archivo). Operativo por Producto y Soporte; requiere la tabla `survey_responses` en Supabase (incluida en MECL-005 como referencia de extensión).
