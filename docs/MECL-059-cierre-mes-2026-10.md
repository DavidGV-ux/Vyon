# MECL-059 — Sello de cierre de mes y verificación de estabilidad 24/7

**Periodo cerrado:** octubre 2026 · **Fecha de sellado:** 11/11/2026.

---

## 1. Sello de cierre (GitHub)

El cierre de mes se sella mediante un **commit firmado en la rama principal
del trabajo** y su push a `origin`, de modo que el estado del sistema queda
inmutable y auditable en GitHub.

- **Rama:** `feat/hexagonal-architecture-mecl-011-014`
- **Mensaje:** `MECL-056..059 — WhatsApp engagement, auditoría seguridad, optimización tokens, cierre de mes`
- **Contenido:** bounded context `messaging` (Twilio), cache + presupuestos de
  tokens, endurecimiento HTTP (CORS allowlist, rate limit), limpieza del repo
  (des-indexado de `node_modules`/`dist`/`.env`), respaldo y sonda de uptime.

### Procedimiento de sello

```bash
git add -A
git commit -S -m "MECL-056..059 — cierre de mes octubre 2026"
git push origin feat/hexagonal-architecture-mecl-011-014
```

> Nota: se evita cambiar de rama para no interferir con otras ventanas de
> trabajo activas sobre el mismo árbol.

## 2. Estabilidad 24/7

### 2.1 Sonda de salud

```bash
cd frontend
npm run uptime:check
# HEALTHY in Xms: http://localhost:3000/api/v1/health status=ok
```

- Script: `scripts/uptime-check.mjs` (exit code ≠ 0 si no está sano).
- Configurable con `HEALTH_URL` y `HEALTH_TIMEOUT_MS`.
- Puede correr desde un cron/Lambda cada minuto contra el health endpoint
  (`GET /api/v1/health` → `{ status: "ok" }`).

### 2.2 Alarmas en AWS (serverless.yml)

La función `api` ya tiene alarmas configuradas:

| Alarma | Métrica | Umbral |
|---|---|---|
| `Errors` | Errors | > 5 en 2 min |
| `DurationP95` | Duration p95 | > 4000 ms (3 min) |
| `Throttles` | Throttles | > 1 en 1 min |

### 2.3 Observabilidad

- Logs estructurados (pino) con `requestId` → CloudWatch.
- Métricas Prometheus en `/metrics` (latencia, tokens, costo USD, mensajes
  WhatsApp, dispatch de engagement).
- Presupuesto de tiempo por petición (`REQUEST_BUDGET_MS`) + timeouts a
  proveedores externos → evita cuelgues y cold starts prolongados.

## 3. Checklist de cierre

- [x] `npm run typecheck` — sin errores de tipos.
- [x] `npm run lint` — 0 errores.
- [x] `npm run test` — 104 tests / 19 archivos en verde.
- [x] `npm run build` — build de web + server correcto.
- [x] `npm run audit` — 0 vulnerabilidades.
- [x] `npm run backup` — respaldo general generado en `backups/`.
- [x] `.gitignore` reforzado (sin `.env`, `node_modules`, `dist`, logs).
- [x] Commit de cierre en la rama y push a `origin`.

## 4. Post-sello (operación)

1. `serverless deploy --stage prod` para publicar el cambio (incluye la
   función programada `vyon-engagement`).
2. Activar credenciales Twilio (ver `docs/MECL-056-whatsapp-retencion-reactivacion.md`).
3. Programar la sonda `uptime:check` cada minuto (EventBridge/CloudWatch Synthetics).
4. Revisar semanalmente `vyon_ai_cost_usd_total` contra ingresos para
   confirmar margen >85% (ver `docs/MECL-058-optimizacion-tokens.md`).
