# MECL-057 — Auditoría de seguridad, limpieza de código y respaldo general

**Fecha:** 11/11/2026 · **Alcance:** backend hexagonal + repo VYON.

---

## 1. Hallazgos y correcciones

| # | Hallazgo | Riesgo | Corrección aplicada |
|---|---|---|---|
| 1 | `frontend/.env` estaba **versionado** en git (claves Supabase) | Medio | `git rm --cached` + `.gitignore` reforzado (nunca más se re-agrega) |
| 2 | `frontend/node_modules/` (11.461 archivos) y `frontend/dist/` estaban **versionados** | Bajo (ruido/repo inflado) | Des-indexados del repo; `.gitignore` los excluye |
| 3 | `frontend/deploy-error.log` versionado | Bajo | Des-indexado; `*.log` ignorado |
| 4 | **CORS wildcard** (`origin: '*'`) con `credentials: true` (inválido e inseguro) | Alto | Allowlist por env (`CORS_ORIGIN`, coma-separado); `*` → reflejar origen **sin** credenciales |
| 5 | **Sin rate limiting** en endpoints de IA (abuso → costo de tokens) | Alto | Middleware propio `rate-limit.ts` (ventana fija, sin dependencias): análisis 30/min, transcripción 20/min, `Retry-After` + 429 |
| 6 | Sin escaneo de secretos hardcodeados | — | Verificado: sin API keys/tokens/passwords hardcodeados en `src/`, `scripts/` ni `*.yml` |
| 7 | `npm audit` | — | **0 vulnerabilidades** (`npm run audit`, nivel high) |
| 8 | Errores de lint (imports sin uso, `no-undef` en `.mjs`) | Bajo | Limpiados: globals de Node para `scripts/**` y `server/tests/e2e/**`; imports/afirmaciones corregidos |
| 9 | Sin proceso de respaldo | Medio | `scripts/backup.sh` + `npm run backup` (tar.gz sin `.env`, `node_modules`, `.git`) |

## 2. Estado de seguridad del backend

- **Helmet** habilitado (headers de seguridad por defecto).
- **Autenticación Bearer (Supabase JWT)** en endpoints de negocio; `AUTH_REQUIRED` debe ser `true` en producción.
- **Errores tipados**: el error handler nunca filtra stack traces ni detalles internos al cliente (mensaje genérico en 500).
- **Validación Zod** de todos los cuerpos de entrada.
- **Presupuesto de tiempo** por petición (`REQUEST_BUDGET_MS`) y abort a proveedores externos → evita cuelgues.
- **Logs estructurados (pino)** con `requestId` para trazabilidad.

## 3. Recomendaciones pendientes (no bloqueantes)

1. **Rotar las claves Supabase** que estuvieron en el historial de git (recomendado aunque solo sea la anon key).
2. Fijar `AUTH_REQUIRED=true` en producción.
3. Limitar `CORS_ORIGIN` al dominio real (CloudFront) en `serverless.yml`.
4. Mover secretos a **AWS Secrets Manager** y referenciarlos por ARN.
5. Añadir **WAF/CloudFront** delante de la Function URL si se expone públicamente.
6. Escaneo de secretos en CI (`gitleaks`/`trufflehog`).

## 4. Respaldo general

```bash
cd frontend
npm run backup      # crea backups/vyon-backup-AAAAAMMDD-HHMMSS.tar.gz
```

El respaldo excluye `.env`, `node_modules`, `dist` y `.git`. Para cumplir con la
política de copias, subir el artefacto a S3/R2 con retención (p. ej. 30 días).

## 5. Verificación

```bash
npm run typecheck   # ✅
npm run lint        # ✅ 0 errores
npm run test        # ✅ 104 tests
npm run build       # ✅ web + server
npm run audit       # ✅ 0 vulnerabilidades
```
