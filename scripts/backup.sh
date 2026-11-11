#!/usr/bin/env bash
# MECL-057 — Respaldo general del repositorio VYON.
# Genera un .tar.gz con el código fuente (sin node_modules, dist, .git ni .env)
# dentro de backups/, listo para subir a S3/R2 o conservar en frío.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/backups"
OUT_FILE="$OUT_DIR/vyon-backup-$STAMP.tar.gz"

mkdir -p "$OUT_DIR"

tar -czf "$OUT_FILE" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='backups' \
  --exclude='.serverless' \
  -C "$ROOT" .

echo "Respaldo creado: $OUT_FILE"
ls -lh "$OUT_FILE"
