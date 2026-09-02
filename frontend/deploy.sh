#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# VYON — Despliegue automático SPA en AWS: S3 Static Website + CloudFront CDN
# + Invalidación de caché CloudFront ("cancelar caché").
#
# Arquitectura AISLADA (100% independiente de Lambdas/roles existentes):
#   - Bucket S3 exclusivo:  vyon-mockup-site-<region>-<stage>
#   - Distribución CloudFront propia con OAC (Origin Access Control)
#   - Política S3 bucket restrictiva (solo CloudFront accede al contenido)
#   - Invalidación de caché /* al finalizar cada despliegue
#
# REQUISITOS (1 solo pase):
#   1. AWS CLI 2.x instalado y configurado: `aws configure`
#      (IAM user con políticas al final de este script)
#   2. Node 20+ y npm
#   3. Archivo .env en frontend/ con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
#
# USO:
#   chmod +x deploy.sh
#   ./deploy.sh                # stage = dev,   region = us-east-1
#   ./deploy.sh prod           # stage = prod
#   ./deploy.sh dev eu-west-1  # stage + región custom
# =============================================================================

STAGE="${1:-dev}"
REGION="${2:-us-east-1}"
NODE_BIN="${NODE_BIN:-$(which node)}"
if [[ -z "$NODE_BIN" ]] ; then
  # Si node principal está roto (problema conocido homebrew node@22 simdjson),
  # intenta node@26.
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
  NODE_BIN="$(which node)"
fi

echo ""
echo "🚀  VYON Deploy — Stage=$STAGE  Region=$REGION"
echo "============================================"

# ---------- 0. Validaciones previas ----------------------------------------
cd "$(dirname "$0")"   # siempre desde /frontend
FRONTEND_DIR="$(pwd)"

if ! command -v aws >/dev/null 2>&1; then
  echo "❌  AWS CLI no encontrado. Instálalo: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

aws sts get-caller-identity >/dev/null 2>&1 || {
  echo "❌  AWS CLI no autenticado. Ejecuta: aws configure"
  exit 1
}

if [[ ! -f "$FRONTEND_DIR/.env" ]]; then
  echo "❌  Falta .env. Copia .env.example a .env y edita SUPABASE credenciales."
  exit 1
fi

# ---------- 1. Nombres de recursos (exclusivos) ----------------------------
BUCKET_NAME="vyon-mockup-site-${REGION}-${STAGE}"
STACK_NAME="vyon-mockup-s3-cf-stack-${STAGE}"
CALLER_REF="vyon-mockup-cf-${STAGE}-$(date +%s)"
DIST_DIR="${FRONTEND_DIR}/dist"

echo "📦  Bucket S3  : $BUCKET_NAME"
echo "🧩  Stack CFN  : $STACK_NAME"
echo "📍  Región     : $REGION"
echo ""

# ---------- 2. Build -------------------------------------------------------
echo "🛠️   (2/6) Build producción..."
export PATH="$(dirname "$NODE_BIN"):$PATH"
cd "$FRONTEND_DIR"
npm run build 2>&1 | tail -5
echo ""

# ---------- 3. Desplegar infraestructura (S3 + CloudFront + OAC) vía CFN --
echo "🏗️   (3/6) Creando/actualizando infraestructura (CloudFormation)..."

CFN_TEMPLATE="${FRONTEND_DIR}/cfn-spa-stack.json"

CURRENT_STATUS=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "NONE")
if [[ "$CURRENT_STATUS" == "REVIEW_IN_PROGRESS" || "$CURRENT_STATUS" == "CREATE_FAILED" || "$CURRENT_STATUS" == "ROLLBACK_COMPLETE" ]]; then
  echo "   ⚠️  Stack anterior en estado $CURRENT_STATUS — limpiando..."
  aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK_NAME" || true
  echo "      Esperando borrado (max ~ 30s)..."
  for i in $(seq 1 12); do
    S=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "GONE")
    if [[ "$S" == "GONE" || "$S" == "DELETE_COMPLETE" ]]; then break; fi
    sleep 3
    echo -n "."
  done
  echo ""
fi

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$CFN_TEMPLATE" \
  --parameter-overrides \
    BucketName="${BUCKET_NAME}" \
    OriginAccessControlName="vyon-mockup-oac-${STAGE}" \
    CallerReference="${CALLER_REF}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

# Leer outputs del stack
DIST_ID=$(aws cloudformation describe-stacks --region "$REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
DIST_DOMAIN=$(aws cloudformation describe-stacks --region "$REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" --output text)
ACTUAL_BUCKET=$(aws cloudformation describe-stacks --region "$REGION" \
  --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)

echo "   ✅  Stack: $STACK_NAME"
echo "      🎯  Distribution : $DIST_ID"
echo "      🌐  CF Domain    : https://$DIST_DOMAIN"
echo "      🗑️   Bucket       : $ACTUAL_BUCKET"
echo ""

# ---------- 4. Subir assets (index.html vs caché largo) --------------------
echo "☁️   (4/6) Subiendo archivos a S3..."

# /assets: nombres con hash → cache largo 1 año, immutable
if [[ -d "$DIST_DIR/assets" ]]; then
  aws s3 sync "$DIST_DIR/assets/" "s3://$ACTUAL_BUCKET/assets/" \
    --region "$REGION" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --content-encoding gzip \
    >/dev/null 2>&1 || \
  aws s3 sync "$DIST_DIR/assets/" "s3://$ACTUAL_BUCKET/assets/" \
    --region "$REGION" \
    --delete \
    --cache-control "public, max-age=31536000, immutable"
fi

# favicon y otros estáticos
for f in "$DIST_DIR"/*; do
  if [[ -f "$f" ]]; then
    base="$(basename "$f")"
    cache="public, max-age=600"
    if [[ "$base" == "index.html" ]]; then
      cache="public, max-age=0, s-maxage=60, must-revalidate"
    elif [[ "$base" == *.svg || "$base" == *.png || "$base" == *.ico ]]; then
      cache="public, max-age=2592000"
    fi
    aws s3 cp "$f" "s3://$ACTUAL_BUCKET/$base" \
      --region "$REGION" \
      --cache-control "$cache" >/dev/null
  fi
done

echo "   ✅  Archivos subidos"
echo ""

# ---------- 5. Invalidación caché CloudFront ------------------------------
echo "🧹  (5/6) Invalidando caché CloudFront (/*) — cancelar caché global..."
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" \
  --paths "/*" --query "Invalidation.Id" --output text)
echo "      ID invalidación: $INVALIDATION_ID"

# Esperar (opcional) — mostrar status sin bloquear para siempre
echo "      Esperando invalidación... (max ~ 120s)"
for i in $(seq 1 24); do
  STATUS=$(aws cloudfront get-invalidation --distribution-id "$DIST_ID" \
    --id "$INVALIDATION_ID" --query "Invalidation.Status" --output text)
  if [[ "$STATUS" == "Completed" ]]; then
    echo "      ✅  Invalidación completada"
    break
  fi
  sleep 5
  echo -n "."
done
echo ""

# ---------- 6. Output final ------------------------------------------------
echo "🎉  (6/6) Despliegue finalizado exitosamente"
echo ""
echo "================================================================"
echo " URL pública    :  https://$DIST_DOMAIN"
echo " Stack CFN      :  $STACK_NAME    (region: $REGION)"
echo " Bucket S3      :  s3://$ACTUAL_BUCKET"
echo " CloudFront ID  :  $DIST_ID"
echo " Invalidation   :  $INVALIDATION_ID  ($STATUS)"
echo "================================================================"
echo ""
echo "🛑   Para ELIMINAR TODOS los recursos (aislado, no toca nada más):"
echo "      aws cloudformation delete-stack --region $REGION --stack-name $STACK_NAME"
echo ""
echo "🔁  Para RE-DESPLEGAR cambios (solo sube + invalida):"
echo "      ./deploy.sh $STAGE $REGION"
echo ""

# =============================================================================
# 🛂 POLÍTICA IAM MÍNIMA para el usuario AWS que ejecuta deploy.sh
# =============================================================================
# Crea esta política y adhiérela al IAM user/role que corre `aws configure`.
# (El usuario que despliega TradeBridge/FYN NO necesita mezclarse — crea
#  uno nuevo llamado vyon-deploy-user para aislamiento TOTAL.)
#
# {
#   "Version": "2012-10-17",
#   "Statement": [
#     {
#       "Sid": "CloudFormationVyonStack",
#       "Effect": "Allow",
#       "Action": [
#         "cloudformation:CreateStack",
#         "cloudformation:UpdateStack",
#         "cloudformation:DescribeStacks",
#         "cloudformation:DeleteStack",
#         "cloudformation:DescribeStackEvents",
#         "cloudformation:CreateChangeSet",
#         "cloudformation:ExecuteChangeSet",
#         "cloudformation:ValidateTemplate",
#         "cloudformation:ListStackResources"
#       ],
#       "Resource": "arn:aws:cloudformation:*:*:stack/vyon-mockup-*/*"
#     },
#     {
#       "Sid": "S3VyonBuckets",
#       "Effect": "Allow",
#       "Action": [
#         "s3:CreateBucket",
#         "s3:DeleteBucket",
#         "s3:PutBucketPolicy",
#         "s3:PutBucketPublicAccessBlock",
#         "s3:PutBucketVersioning",
#         "s3:PutEncryptionConfiguration",
#         "s3:PutBucketTagging",
#         "s3:ListBucket",
#         "s3:GetObject",
#         "s3:PutObject",
#         "s3:DeleteObject",
#         "s3:PutObjectAcl"
#       ],
#       "Resource": [
#         "arn:aws:s3:::vyon-mockup-*",
#         "arn:aws:s3:::vyon-mockup-*/*"
#       ]
#     },
#     {
#       "Sid": "CloudFrontVyon",
#       "Effect": "Allow",
#       "Action": [
#         "cloudfront:CreateDistribution",
#         "cloudfront:UpdateDistribution",
#         "cloudfront:GetDistribution",
#         "cloudfront:CreateInvalidation",
#         "cloudfront:GetInvalidation",
#         "cloudfront:TagResource",
#         "cloudfront:ListTagsForResource",
#         "cloudfront:CreateOriginAccessControl",
#         "cloudfront:UpdateOriginAccessControl",
#         "cloudfront:DeleteOriginAccessControl",
#         "cloudfront:GetOriginAccessControl",
#         "cloudfront:CreateCachePolicy",
#         "cloudfront:UpdateCachePolicy",
#         "cloudfront:DeleteCachePolicy",
#         "cloudfront:GetCachePolicy"
#       ],
#       "Resource": "*"
#     },
#     {
#       "Sid": "IAMPassRoleAndCheck",
#       "Effect": "Allow",
#       "Action": [
#         "iam:GetRole",
#         "iam:PassRole"
#       ],
#       "Resource": "*",
#       "Condition": {
#         "StringEquals": {
#           "iam:PassedToService": [
#             "cloudfront.amazonaws.com",
#             "s3.amazonaws.com"
#           ]
#         }
#       }
#     },
#     {
#       "Sid": "STSCheckIdentity",
#       "Effect": "Allow",
#       "Action": "sts:GetCallerIdentity",
#       "Resource": "*"
#     }
#   ]
# }
#
