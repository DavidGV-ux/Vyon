# MECL-006 — Mapa del embudo de Onboarding (Audio → Registro → Acción)

**Área:** Operaciones  
**Responsable:** Luis (COO)  
**Estado:** INICIO  
**Punto U:** 3.3  
**Presupuesto:** $900 + $250 = $1.150 USD  

---

## 1. Objetivo
Definir el flujo de conversión del usuario desde el primer contacto por audio (bot de WhatsApp/IVR) hasta la primera acción de valor dentro de Vyon, identificando puntos de fricción y métricas de conversión por etapa.

---

## 2. Etapas del embudo

| Etapa | Canal | Acción del usuario | Métrica clave | Criterio de éxito |
|-------|-------|--------------------|---------------|-------------------|
| **Audio** | WhatsApp voz / IVR | Escucha mensaje de bienvenida, responde palabra clave o presiona opción | Tasa de respuesta al audio | ≥ 40 % responde en < 2 min |
| **Registro** | Web / WhatsApp | Completa nombre, email, contraseña y verifica cuenta | Tasa de conversión registro | ≥ 25 % de los que responden al audio se registran |
| **Acción** | Dashboard Vyon | Crea su primera tarea o proyecto (momento "Aha") | Tasa de primera acción | ≥ 50 % de registrados actúan en < 24 h |

---

## 3. Flujo detallado

### 3.1 Audio (Tofu - Top of Funnel)
1. Usuario envía audio o llama al número de WhatsApp Cloud API.
2. Bot responde con audio de bienvenida (< 30 s) explicando Vyon en 1 frase.
3. Oferta de valor: "Gestiona tus tareas por voz o chat".
4. CTA: envía la palabra "REGISTRO" o pulsa botón "Crear cuenta".
5. Si no responde en 10 min → mensaje de seguimiento automatizado (máx. 2).

### 3.2 Registro (Mofu - Middle of Funnel)
1. Clic en enlace de registro → Landing `/register`.
2. Formulario reducido: nombre completo, email, contraseña (mín. 6 caracteres).
3. Confirmación de email (opcional en MVP, obligatoria en producción).
4. Redirección automática al dashboard tras éxito.
5. Si abandona → email de recordatorio a las 24 h (máx. 1).

### 3.3 Acción (BoFu - Bottom of Funnel)
1. Dashboard vacío con CTA "Crear primera tarea".
2. Tutorial interactivo de 3 pasos (tablero, tarjeta, arrastrar columna).
3. Primera tarea creada = conversión completa.
4. Si no actúa en 24 h → notificación push/email con plantilla prellenada.

---

## 4. Métricas y seguimiento

- **TA1**: Usuarios que llegan por audio (por semana).
- **TA2**: % que completan registro (target ≥ 25 %).
- **TA3**: % que realizan primera acción en < 24 h (target ≥ 50 %).
- **TA4**: Tiempo medio de Audio → Registro (target < 10 min).
- **TA5**: Tiempo medio de Registro → Acción (target < 4 h).

Eventos recomendados para registrar en Supabase/analytics:
- `onboarding.audio_received`
- `onboarding.audio_responded`
- `onboarding.registration_started`
- `onboarding.registration_completed`
- `onboarding.first_action_completed`

---

## 5. Puntos de fricción identificados (mitigación)

| Fricción | Mitigación |
|----------|------------|
| Audio largo causa abandono | Mensaje < 30 s, opciones numéricas claras |
| Registro largo reduce conversión | Formulario de 3 campos, login social opcional |
| Dashboard vacío desanima | Plantilla de tarea prellenada + tutorial guiado |
| Falta de verificación de email | Permitir uso sin verificar, recordatorio posterior |

---

## 6. Entregable
Documento estratégico (este archivo). No requiere cambios de código en el frontend; el backend webhook (MECL-010) soporta el canal de audio.
