# Deployment & CI/CD

JJ Studio ERP is deployed on a **shared AWS EC2 host** (alongside several other
apps) using **PM2 + NGINX** — *not* Docker. Do not introduce Docker/port changes
without checking the other tenants on the box.

## Live topology

| Piece            | Detail                                                              |
|------------------|--------------------------------------------------------------------|
| Public URL       | `http://3.105.199.228:8005/`                                       |
| Frontend         | NGINX site `jjerp` on **port 8005**, serves `frontend/dist/`        |
| API              | NGINX proxies `/api/` and `/static/` → `http://127.0.0.1:5003`      |
| Backend          | PM2 process **`jjerp-backend`** (`npm start`), listening on **5003**|
| Frontend API URL | `VITE_API_URL=/api` (same-origin; baked at build time)             |
| App dir (server) | `~/jj_studio/jj_studio_erp`                                         |
| Source repo      | `github.com/d-tableanalytics/JJ-Studio` (branch `main`)            |

> Other ports on the host are taken by other apps: 5000 surgenesis, 5001 ld-erp,
> 5002 nasher. Keep JJ Studio on 5003 / 8005.

## Files in this repo

- `scripts/deploy.sh` — the deploy routine (git pull → npm ci → vite build → pm2 restart)
- `.github/workflows/deploy.yml` — CI build check + SSH deploy on push to `main`
- `backend/.env.example` — env template (copy to `backend/.env` on the server)

## CI/CD — how it works

On every push to `main` (or a manual run via the Actions tab):
1. **build** — installs and builds both apps on a GitHub runner; fails fast if broken.
2. **deploy** — SSHes into EC2 and runs `scripts/deploy.sh`, which pulls `main`,
   reinstalls deps, rebuilds the frontend, and `pm2 restart jjerp-backend`. NGINX
   serves the new static `dist/` automatically.

### Required GitHub secrets (Settings → Secrets and variables → Actions)

| Secret         | Value                                                     |
|----------------|-----------------------------------------------------------|
| `EC2_HOST`     | EC2 public IP (e.g. `3.105.199.228`)                      |
| `EC2_USER`     | `ubuntu`                                                  |
| `EC2_SSH_KEY`  | Full contents of the `.pem` private key                  |
| `EC2_SSH_PORT` | SSH port (omit if 22)                                     |
| `EC2_APP_DIR`  | Repo path on server (default `~/jj_studio/jj_studio_erp`) |
| `PM2_APP`      | PM2 process name (default `jjerp-backend`)               |

> The EC2 public IP is **not** Elastic — it changes on stop/start. When it
> changes, update `EC2_HOST` and `frontend/.env` (dev only; prod uses `/api`).
> Assigning an Elastic IP would remove this recurring step.

## Manual deploy (on the server)

```bash
cd ~/jj_studio/jj_studio_erp
APP_DIR=$PWD scripts/deploy.sh
```

## Access

- App: `http://3.105.199.228:8005/`
- API: `http://3.105.199.228:8005/api`
