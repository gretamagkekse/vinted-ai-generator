#!/bin/bash
set -e

echo "========================================="
echo "🚀 Vinted AI Generator - GCP Deployment"
echo "========================================="

# Aktuelles gcloud Projekt prüfen
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Kein Google Cloud Projekt gesetzt. Bitte 'gcloud config set project <PROJECT_ID>' ausführen."
    exit 1
fi

REGION="europe-west1"

echo "📦 1. Deploye Backend..."
# Deploy backend
BACKEND_URL=$(gcloud run deploy vinted-backend \
  --source ./backend \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID \
  --format 'value(status.url)')

echo "✅ Backend URL: $BACKEND_URL"

echo "📦 2. Deploye Frontend..."
FRONTEND_URL=$(gcloud run deploy vinted-frontend \
  --source ./frontend \
  --region $REGION \
  --allow-unauthenticated \
  --port 80 \
  --set-env-vars BACKEND_URL=$BACKEND_URL \
  --format 'value(status.url)')

echo "✅ Frontend URL: $FRONTEND_URL"

echo "🔧 3. Konfiguriere Backend CORS..."
# Update backend with frontend URL for CORS
gcloud run services update vinted-backend \
  --region $REGION \
  --update-env-vars ALLOWED_ORIGIN=$FRONTEND_URL

echo "========================================="
echo "🎉 DEPLOYMENT ERFOLGREICH!"
echo "🌍 Deine App ist live: $FRONTEND_URL"
echo "========================================="
