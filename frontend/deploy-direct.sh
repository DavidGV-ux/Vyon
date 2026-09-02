#!/usr/bin/env bash
set -euo pipefail

DIST_ID="E3KQDSNJO35J3Y"
BUCKET="vyon-front-bucket"
REGION="us-east-2"
FRONTEND_DIR="/Users/davidgalvis/Documents/Vyon/frontend"

cd "$FRONTEND_DIR"

echo ""
echo "Step 1/4: Build production..."
npm run build 2>&1 | tail -6
echo ""

echo "Step 2/4: Upload dist/assets/ to s3://$BUCKET/assets/ (immutable cache)"
if [ -d dist/assets ]; then
  aws s3 sync dist/assets/ s3://$BUCKET/assets/ \
    --region "$REGION" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" 2>&1
fi
echo "Assets uploaded OK."
echo ""

echo "Step 3/4: Upload root files (index.html no-cache)"
for f in dist/*; do
  if [ -f "$f" ]; then
    base="$(basename "$f")"
    cache="public, max-age=600"
    if [ "$base" = "index.html" ]; then
      cache="public, max-age=0, s-maxage=60, must-revalidate"
    elif [[ "$base" == *.svg || "$base" == *.png || "$base" == *.ico ]]; then
      cache="public, max-age=2592000"
    fi
    echo "   -> $base [$cache]"
    aws s3 cp "$f" s3://$BUCKET/$base \
      --region "$REGION" \
      --cache-control "$cache" 2>&1 >/dev/null
  fi
done
echo "Root files uploaded OK."
echo ""

echo "Step 4/4: Invalidate CloudFront cache on /*"
INV_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text 2>&1)
echo "Invalidation ID: $INV_ID"
echo "Waiting for invalidation (max ~120s)..."
STATUS="InProgress"
for i in $(seq 1 30); do
  STATUS=$(aws cloudfront get-invalidation \
    --distribution-id "$DIST_ID" \
    --id "$INV_ID" \
    --query "Invalidation.Status" \
    --output text 2>&1)
  if [ "$STATUS" = "Completed" ]; then break; fi
  sleep 5
  echo -n "."
done
echo ""
echo "Invalidation status: $STATUS"

echo ""
echo "=========================================================="
echo " DEPLOY COMPLETE"
echo " Public URL   : https://d338wiy5v686ki.cloudfront.net"
echo " S3 Bucket    : s3://$BUCKET"
echo " CF Dist ID   : $DIST_ID"
echo " Invalidation : $INV_ID ($STATUS)"
echo "=========================================================="
echo ""
echo "Listing assets on bucket:"
aws s3 ls s3://$BUCKET/assets/ --region "$REGION" 2>&1
echo ""
