#!/bin/bash

# ============================================
# Deploy: Consolidado local → Arthur2091/R2
# Uso: bash deploy.sh TU_GITHUB_TOKEN
# ============================================

TOKEN=$1
USUARIO="Arthur2091"
REPO="R2"
API="https://api.github.com"
FILE="index.html"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_FILE="$SCRIPT_DIR/$FILE"

if [ -z "$TOKEN" ]; then
  echo "❌ Uso: bash deploy.sh TU_GITHUB_TOKEN"
  exit 1
fi

if [ ! -f "$LOCAL_FILE" ]; then
  echo "❌ No se encontró $LOCAL_FILE"
  exit 1
fi

echo ""
echo "============================================"
echo "  🚀 DEPLOY: Consolidado → $USUARIO/$REPO"
echo "============================================"
echo ""

# 1. Encode local file to base64
echo "📦 Leyendo archivo local..."
CONTENT=$(base64 -w 0 "$LOCAL_FILE" 2>/dev/null || base64 "$LOCAL_FILE")

if [ -z "$CONTENT" ]; then
  echo "❌ No se pudo leer $LOCAL_FILE"
  exit 1
fi
echo "✅ Archivo leído"

# 2. Obtener SHA actual del archivo en el repo (necesario para actualizarlo)
echo "📋 Verificando repo remoto..."

REMOTE=$(curl -s \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "$API/repos/$USUARIO/$REPO/contents/$FILE")

REMOTE_SHA=$(echo $REMOTE | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))" 2>/dev/null)

if [ -z "$REMOTE_SHA" ]; then
  echo "⚠️  Archivo no encontrado en el repo — se creará uno nuevo"
  SHA_FIELD=""
else
  echo "✅ Repo verificado (SHA: ${REMOTE_SHA:0:8}...)"
  SHA_FIELD=",\"sha\":\"$REMOTE_SHA\""
fi

# 3. Confirmar deploy
echo ""
echo "⚠️  Vas a sobreescribir $USUARIO/$REPO/$FILE"
read -p "   ¿Confirmás el deploy? (s/n): " CONFIRM

if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
  echo "❌ Deploy cancelado"
  exit 0
fi

# 4. Push al repo
echo ""
echo "📤 Subiendo a GitHub..."

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
TMPFILE=$(mktemp /tmp/deploy_payload.XXXXXX.json)
CONTENTFILE=$(mktemp /tmp/deploy_content.XXXXXX.txt)

echo -n "$CONTENT"   > "$CONTENTFILE"
echo -n "$REMOTE_SHA" > "${CONTENTFILE}.sha"

python - "$CONTENTFILE" "${CONTENTFILE}.sha" "$TIMESTAMP" << 'PYEOF'
import json, sys
with open(sys.argv[1]) as f: content = f.read().strip()
with open(sys.argv[2]) as f: sha = f.read().strip()
ts = sys.argv[3]
d = {'message': f'Deploy Consolidado - {ts}', 'content': content}
if sha: d['sha'] = sha
with open(sys.argv[1] + '.json', 'w') as f: json.dump(d, f)
PYEOF

mv "${CONTENTFILE}.json" "$TMPFILE"
rm -f "$CONTENTFILE" "${CONTENTFILE}.sha"

DEPLOY=$(curl -s -X PUT \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  "$API/repos/$USUARIO/$REPO/contents/$FILE" \
  --data "@$TMPFILE")

rm -f "$TMPFILE"

RESULT=$(echo $DEPLOY | python -c "import sys,json; d=json.load(sys.stdin); print('ok' if 'content' in d else d.get('message','error'))" 2>/dev/null)

if [ "$RESULT" = "ok" ]; then
  echo ""
  echo "============================================"
  echo "✅ DEPLOY EXITOSO — $TIMESTAMP"
  echo "   URL: https://$USUARIO.github.io/$REPO"
  echo "   (Puede tardar 1-2 minutos en reflejarse)"
  echo "============================================"
else
  echo "❌ Error en deploy: $RESULT"
fi
