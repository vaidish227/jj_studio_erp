#!/usr/bin/env bash
# ─── JJ Studio ERP — production deploy (PM2 + NGINX) ──────────────────────────
# Pulls latest main, installs deps, rebuilds the frontend, and restarts the
# PM2 backend. NGINX serves the freshly built static dist/ automatically.
#
# Run on the EC2 host (or invoked by CI over SSH):
#   APP_DIR=~/jj_studio/jj_studio_erp scripts/deploy.sh
#
# Overridable env:
#   APP_DIR   path to the repo on the server  (default: ~/jj_studio/jj_studio_erp)
#   PM2_APP   PM2 process name for the backend (default: jjerp-backend)
#   BRANCH    git branch to deploy             (default: main)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/jj_studio/jj_studio_erp}"
PM2_APP="${PM2_APP:-jjerp-backend}"
BRANCH="${BRANCH:-main}"

echo "▶ Deploying $BRANCH in $APP_DIR (PM2 app: $PM2_APP)"
cd "$APP_DIR"

echo "▶ Fetching latest code"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "▶ Backend dependencies"
( cd backend && npm ci --omit=dev )

echo "▶ Frontend build (uses .env.production → VITE_API_URL=/api)"
( cd frontend && npm ci && npm run build )

echo "▶ Restarting backend via PM2"
pm2 restart "$PM2_APP" --update-env
pm2 save

echo "▶ Reloading NGINX (no-op if config unchanged)"
sudo nginx -t && sudo nginx -s reload || echo "  (nginx reload skipped)"

echo "✅ Deploy complete"
pm2 describe "$PM2_APP" | grep -E "status|name" || true
