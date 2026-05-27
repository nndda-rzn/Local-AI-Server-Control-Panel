<div align="center">

<img src="https://img.shields.io/badge/AI-Ops%20Dashboard-0E9F6E?style=for-the-badge&logo=docker&logoColor=white" alt="Logo" height="56" />

# Private AI Ops Dashboard

**Self-hosted control panel untuk server lokal berbasis Docker, AI inference, dan Cloudflare Tunnel.**

[![Version](https://img.shields.io/badge/version-2.0.0-0E9F6E?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-Private-64748B?style=flat-square)](#)
[![Status](https://img.shields.io/badge/status-MVP%20%2B%20V1.2-16A34A?style=flat-square)](#)
[![Platform](https://img.shields.io/badge/platform-Ubuntu%20Server-E95420?style=flat-square&logo=ubuntu&logoColor=white)](#)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](#)

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](#)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](#)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](#)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](#)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-6-0170FE?style=flat-square&logo=antdesign&logoColor=white)](#)

</div>

---

## Ringkasan

Platform admin web untuk mengelola **deployment, container Docker, model AI, monitoring, backup, dan keamanan** pada server lokal pribadi. Dirancang untuk kebutuhan operasional single-admin dengan fokus pada kemudahan, keamanan, dan transparansi audit.

Sesuai PRD v2.0, panel ini mengelola siklus penuh: **dashboard kesehatan server → kontrol container → deploy compose project → upload & aktifkan model AI → uji inference → backup otomatis → notifikasi saat down**.

> Tidak menggantikan Portainer/Coolify secara penuh. Fokus pada stack pribadi: web demo, backend API, database, dan model AI ringan (YOLOv8 / ONNX / PyTorch / scikit-learn).

---

## Fitur Utama

| Modul | Fitur |
|---|---|
| **Auth** | Login username/email, JWT 8 jam, rate limit 10x/15 menit, change password |
| **Dashboard** | CPU / RAM / Disk gauge, uptime, IP, Docker info, Cloudflared status, health check HTTP |
| **Topology** | Visualisasi service graph interaktif (React Flow), klik node untuk detail |
| **Containers** | List, start/stop/restart, log viewer, filter by project/state, search, container-prefix whitelist |
| **Projects** | Auto-scan `ALLOWED_PROJECT_ROOT`, deploy/down/restart compose, deployment history |
| **Deploy Wizard** | 5 step: pilih project → validate compose → check `.env` → check port conflict → deploy |
| **AI Models** | Upload `.pt/.pth/.onnx/.pkl` (max 500 MB), aktivasi model, edit metadata, hapus |
| **AI Settings** | Confidence threshold, image size, device, CAM method, restart inference service |
| **Inference** | Upload gambar → POST ke service inference → tampil hasil + history |
| **Audit Log** | Catat semua aksi penting dengan filter aksi & rentang tanggal |
| **Backups** | Manual `.tar.gz` per scope (db / models / uploads / projects), restore non-destruktif, scheduler cron |
| **Notifications** | Telegram + Discord + generic webhook, watchdog container down/unhealthy |
| **Users** | RBAC owner/admin/viewer, create/edit/disable/reset-password (owner only) |
| **Settings** | Profile, change password, env config readonly |

---

## Tech Stack

**Backend**
- Node.js 20 + Express 4 (ESM)
- `dockerode` untuk Docker socket access
- `node:sqlite` (built-in) dengan WAL mode
- `bcryptjs` + `jsonwebtoken` untuk auth
- `multer` untuk upload (model & inference image)
- `node-cron` untuk scheduler
- `systeminformation` untuk metrics
- `js-yaml` untuk parsing compose

**Frontend**
- React 18 + Vite 5
- Ant Design 6 sebagai UI library
- ApexCharts untuk gauge & chart
- React Flow (`@xyflow/react`) untuk topology graph
- Tailwind CSS untuk utility classes
- Day.js untuk format tanggal

**Infrastructure**
- Docker Compose (panel-frontend + panel-backend)
- Nginx sebagai reverse proxy frontend
- Cloudflare Tunnel untuk akses publik (opsional)

---

## Arsitektur

```
                          ┌────────────────────┐
                          │   Admin Browser    │
                          └──────────┬─────────┘
                                     │ HTTPS
                          ┌──────────▼─────────┐
                          │ Cloudflare Tunnel  │ (opsional)
                          └──────────┬─────────┘
                                     │
                          ┌──────────▼─────────┐
                          │  panel-frontend    │ Nginx + React build
                          │  :3000             │
                          └──────────┬─────────┘
                                     │ /api proxy
                          ┌──────────▼─────────┐
                          │  panel-backend     │ Express
                          │  :5500             │
                          └──┬────────────┬────┘
                             │            │
            ┌────────────────┘            └────────────────┐
            │                                              │
   ┌────────▼────────┐                          ┌──────────▼─────────┐
   │ Docker Engine   │                          │ SQLite (WAL)       │
   │ /var/run/docker │                          │ /server/data/      │
   │   .sock         │                          │   sqlite/panel.db  │
   └────────┬────────┘                          └────────────────────┘
            │
            ├── managed projects (cdss-web, cdss-api, ai-inference, ...)
            │
            └── monitored services
```

**Volume mounts (backend container)**

```
/var/run/docker.sock  → Docker control
/server/apps          → Project root (compose discovery)
/server/data          → SQLite + models + uploads + inference results
/server/backup        → Backup destination (tar.gz)
```

---

## Quick Start

### Prasyarat

- Ubuntu Server (atau Linux modern apa pun)
- Docker Engine + Docker Compose plugin
- Folder `/server/{apps,data,backup}` (akan dibuat otomatis kalau belum ada)
- Node.js 20+ (hanya untuk mode development)

### 1. Clone & Configure

```bash
git clone <repo-url> private-ai-ops-dashboard
cd private-ai-ops-dashboard
cp .env.example .env
nano .env
```

Wajib diganti:

```env
JWT_SECRET=isi-dengan-random-panjang-dan-acak
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password-kuat-anda
```

### 2. Production (Docker Compose)

```bash
npm run docker:up         # build + start
npm run docker:logs       # tail logs
npm run docker:ps         # status container
npm run docker:down       # stop semua
npm run docker:rebuild    # rebuild from scratch
```

Buka panel di **`http://IP-SERVER:3000`**.

### 3. Development (tanpa Docker)

```bash
npm install
npm run install:all       # install backend + frontend deps

# jalankan keduanya bersamaan
npm run dev

# atau terpisah
npm run dev:be            # backend → http://localhost:5500
npm run dev:fe            # frontend → http://localhost:5174
```


---

## Konfigurasi `.env` Lengkap

```env
# Core
NODE_ENV=development
PORT=5500
JWT_SECRET=ganti-dengan-random-panjang
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Database
DATABASE_PATH=/server/data/sqlite/panel.db

# Whitelists & Limits
ALLOWED_PROJECT_ROOT=/server/apps
ALLOWED_MODEL_ROOT=/server/data/models
ALLOWED_CONTAINER_PREFIXES=panel-,nginx-test,cdss-,ai-,postgres,redis
LOG_TAIL_LIMIT=200
MAX_MODEL_UPLOAD_MB=500
MAX_INFERENCE_UPLOAD_MB=20

# Health Check (format: name|url,name2|url2)
HEALTH_CHECK_TARGETS=

# AI Inference
AI_INFERENCE_URL=
AI_INFERENCE_CONTAINER=ai-inference

# Backup Scheduler (cron 5-field, kosong = disable)
BACKUP_SCHEDULE_CRON=
BACKUP_SCHEDULE_SCOPES=db,models
BACKUP_SCHEDULE_LABEL=auto
BACKUP_SCHEDULE_TZ=Asia/Jakarta

# Notifications (kosong = disable)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
DISCORD_WEBHOOK_URL=
GENERIC_WEBHOOK_URL=

# Watchdog Container
WATCHDOG_CRON=
WATCHDOG_TARGETS=
WATCHDOG_COOLDOWN_MS=900000
WATCHDOG_TZ=Asia/Jakarta
```

### Contoh setup scheduler harian + watchdog 2 menit + Telegram

```env
BACKUP_SCHEDULE_CRON=0 2 * * *
BACKUP_SCHEDULE_SCOPES=db,models

WATCHDOG_CRON=*/2 * * * *
WATCHDOG_TARGETS=cdss-api,ai-inference,postgres

TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-1001234567890
```

---

## Setup di Ubuntu Server

```bash
# Buat folder data
sudo mkdir -p /server/apps /server/data/{sqlite,models,uploads,inference-results} /server/backup
sudo chown -R $USER:$USER /server

# Pindahkan project
sudo mv ./private-ai-ops-dashboard /server/apps/
cd /server/apps/private-ai-ops-dashboard

# Configure
cp .env.example .env
nano .env

# Build & jalankan
docker compose up -d --build
docker ps
```

Panel siap di `http://IP-SERVER:3000`.

---

## Cloudflare Tunnel

| Hostname              | Target Lokal             | Boleh Public? |
| --------------------- | ------------------------ | ------------- |
| panel.domain.com      | http://localhost:3000    | ✅ Admin (lindungi dengan Cloudflare Access) |
| app.domain.com        | http://localhost:8081    | ✅ Web demo |
| api.domain.com        | http://localhost:8000    | ✅ Backend API |
| postgres / redis      | -                        | ❌ JANGAN dibuka |
| `/var/run/docker.sock`| -                        | ❌ JANGAN dibuka |

> Panel admin sebaiknya di belakang **Cloudflare Access** atau VPN, bukan terbuka publik dengan password saja.

---

## API Reference

### Auth
```
POST   /api/auth/login              { username|email, password }
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/change-password    { currentPassword, newPassword }
```

### System & Dashboard
```
GET    /api/system/status
GET    /api/system/health-check
GET    /api/dashboard/summary
GET    /api/topology
GET    /api/topology/nodes/:id
```

### Docker
```
GET    /api/docker/containers?inspect=true
GET    /api/docker/containers/:name/logs?tail=200
POST   /api/docker/containers/:name/{start|stop|restart}
```

### Projects
```
GET    /api/projects
GET    /api/projects/:id
GET    /api/projects/:id/history
POST   /api/projects/:id/{deploy|down|restart}
```

### Deployment Wizard
```
POST   /api/deployment/wizard/validate-compose   { projectId }
POST   /api/deployment/wizard/validate-env       { projectId, requiredVars }
POST   /api/deployment/wizard/check-port         { projectId }
POST   /api/deployment/wizard/run                { projectId }
```

### AI Models & Inference
```
GET    /api/ai/settings
PUT    /api/ai/settings              { confidence_threshold, image_size, device, cam_method }
GET    /api/ai/models
POST   /api/ai/models/upload         multipart: model + framework + version + ...
PUT    /api/ai/models/:id/metadata
POST   /api/ai/models/:id/activate
DELETE /api/ai/models/:id
POST   /api/ai/test-inference        { ... } (opsional, JSON ke AI_INFERENCE_URL)

POST   /api/ai/inference/test        multipart: image
POST   /api/ai/inference/restart-service
GET    /api/ai/inference/history?limit=50&offset=0&modelId=
GET    /api/ai/inference/history/:id
```

### Backups
```
GET    /api/backups/meta
GET    /api/backups?limit=50&offset=0
GET    /api/backups/:id
POST   /api/backups                  { scopes: [db|models|uploads|projects], label }
GET    /api/backups/:id/download
POST   /api/backups/:id/restore      (owner only, extract ke /server/backup/restored/)
DELETE /api/backups/:id
```

### Users (RBAC)
```
GET    /api/users                    (owner/admin)
GET    /api/users/:id
POST   /api/users                    (owner) { username, email, password, role }
PUT    /api/users/:id                (owner) { email, role, is_active }
PUT    /api/users/:id/password       (owner) { password }
DELETE /api/users/:id                (owner)
```

### Audit Log
```
GET    /api/audit?limit=200&action=&from=&to=
```

---

## Keamanan

| Layer | Mekanisme |
|---|---|
| **Authentication** | bcrypt hash password, JWT 8 jam, login rate limit 10x/15 menit |
| **Authorization** | Role `owner` / `admin` / `viewer`, aksi destruktif owner/admin saja, user CRUD owner only |
| **Docker socket** | Hanya backend container yang punya akses, diisolasi via volume mount |
| **Command exec** | Whitelist compose action: `up -d`, `down`, `restart`, `ps`. Tidak ada terminal bebas |
| **Path access** | Strict via `ensurePathAllowed`: project & model & backup hanya boleh di whitelist root |
| **Upload** | Validasi ekstensi (`.pt/.pth/.onnx/.pkl`), size limit, safe-name regex |
| **Container action** | Whitelist prefix di env, panel-* protected dari stop UI |
| **Audit logging** | Setiap aksi penting: login, container, project, AI, model, backup, user CRUD |
| **Backup restore** | Non-destruktif: extract ke folder timestamped, file aktif tidak ditimpa |

---

## Struktur Folder

```
private-ai-ops-dashboard/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js                # entry point + bootstrap
│       ├── db/index.js              # SQLite schema + migrations
│       ├── middleware/
│       │   └── auth.middleware.js   # requireAuth, requireRole
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── system.routes.js
│       │   ├── docker.routes.js
│       │   ├── projects.routes.js
│       │   ├── ai.routes.js
│       │   ├── inference.routes.js
│       │   ├── audit.routes.js
│       │   ├── dashboard.routes.js
│       │   ├── topology.routes.js
│       │   ├── wizard.routes.js
│       │   ├── backup.routes.js
│       │   └── users.routes.js
│       ├── services/
│       │   ├── user.service.js
│       │   ├── docker.service.js
│       │   ├── compose.service.js
│       │   ├── project.service.js
│       │   ├── ai.service.js
│       │   ├── inference.service.js
│       │   ├── audit.service.js
│       │   ├── topology.service.js
│       │   ├── wizard.service.js
│       │   ├── backup.service.js
│       │   ├── scheduler.service.js
│       │   ├── notification.service.js
│       │   └── watchdog.service.js
│       ├── scripts/seed.js
│       └── utils/paths.js
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                  # router + auth gate
│       ├── api.js                   # fetch wrapper + endpoint groups
│       ├── theme.js                 # Ant Design tokens
│       ├── styles.css
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── AppHeader.jsx
│       │   ├── PageHeader.jsx
│       │   ├── GaugeChart.jsx
│       │   ├── Feedback.jsx
│       │   ├── ConfirmModal.jsx
│       │   └── StatCard.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Topology.jsx
│       │   ├── Containers.jsx
│       │   ├── Projects.jsx
│       │   ├── DeploymentWizard.jsx
│       │   ├── AIModels.jsx
│       │   ├── AISettingsForm.jsx
│       │   ├── Inference.jsx
│       │   ├── AuditLog.jsx
│       │   ├── Backups.jsx
│       │   ├── Users.jsx
│       │   └── Settings.jsx
│       ├── hooks/useApi.js
│       └── utils/format.js
├── docker-compose.yml
├── package.json                     # monorepo runner
├── .env.example
├── PRD_extracted.txt
└── README.md
```

---

## Scripts

| Command | Deskripsi |
|---|---|
| `npm install` | Install root dev dependencies (concurrently) |
| `npm run install:all` | Install backend + frontend dependencies |
| `npm run dev` | Jalankan backend & frontend bersamaan (concurrently) |
| `npm run dev:be` | Backend only (port 5500, watch mode) |
| `npm run dev:fe` | Frontend only (port 5174, Vite HMR) |
| `npm run start:be` | Backend mode production |
| `npm run build:fe` | Build frontend production |
| `npm run preview:fe` | Preview hasil build |
| `npm run seed` | Seed admin user dari `.env` |
| `npm run docker:up` | Build + start panel containers |
| `npm run docker:down` | Stop semua container |
| `npm run docker:logs` | Tail logs |
| `npm run docker:ps` | Status container |
| `npm run docker:rebuild` | Rebuild dari awal (no-cache) |

---

## Acceptance Criteria PRD v2.0

| ID | Kriteria | Status |
|----|----------|--------|
| AC-001 | Admin dapat login dan logout | ✅ |
| AC-002 | Dashboard menampilkan CPU/RAM/disk/uptime | ✅ |
| AC-003 | Daftar container tampil lengkap | ✅ |
| AC-004 | Admin dapat restart container Nginx test | ✅ |
| AC-005 | Log Nginx dapat dibaca dari UI | ✅ |
| AC-006 | Project dengan compose file dapat dideploy dari UI | ✅ |
| AC-007 | Perubahan AI settings tersimpan | ✅ |
| AC-008 | Audit log mencatat restart/deploy/settings update | ✅ |
| AC-009 | Panel dapat dibuka melalui Cloudflare Tunnel | ⚠️ tergantung deployment |
| AC-010 | Endpoint tanpa token tidak dapat akses API admin | ✅ |

---

## Roadmap

### ✅ Selesai (MVP + V1.1 + V1.2)
- Login (username/email), JWT, change password
- Dashboard server + Docker + health check
- Container manager + log viewer + filter
- Project manager + deployment wizard
- AI model upload/activate/delete + settings
- Inference test + history
- Audit log + filter
- Backup manual + restore + scheduler cron
- Notification (Telegram/Discord/Webhook) + watchdog
- RBAC user management (owner/admin/viewer)
- Service topology graph

### 🚧 Future Scope
- Git-based deployment dari GitHub/GitLab
- Cloudflare Tunnel route manager via API
- Restore backup destruktif (overwrite file aktif)
- Model registry dengan history version antar-model
- Test webhook button (verify Telegram/Discord config)
- 2FA / TOTP login

---

## Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Docker socket terlalu powerful | Endpoint ketat, auth wajib, whitelist prefix container |
| Command injection | Tidak ada terminal bebas, semua command lewat whitelist |
| Panel admin terekspos publik | Cloudflare Access, rate limit, password kuat |
| VM mati saat host shutdown | Auto-start VM, monitoring uptime, backup ke VPS |
| Model AI terlalu berat | Limit upload size, default device CPU, model registry ringan |
| Storage penuh | Backup rotation manual, audit log retention 90 hari |

---

## Troubleshooting

**Backend tidak bisa connect ke Docker socket**
```bash
# Pastikan user dalam group docker
sudo usermod -aG docker $USER
# Atau pastikan socket mount benar
docker compose exec backend ls -la /var/run/docker.sock
```

**Port 3000 sudah dipakai**
```bash
# Edit docker-compose.yml, ganti port mapping
ports:
  - "8080:80"   # ganti dari 3000:80
```

**Backup gagal: tar not found**
```bash
# Container backend butuh tar (default ada di node:20 image)
docker compose exec backend tar --version
```

**Health check tidak muncul**
```env
# Set HEALTH_CHECK_TARGETS di .env
HEALTH_CHECK_TARGETS=API|http://cdss-api:8000/health,Web|http://cdss-web:80
```

**Notification tidak terkirim**
- Cek log backend: `docker compose logs backend | grep notify`
- Verify token Telegram & chat_id (kirim test message manual via curl)
- Pastikan container backend punya akses internet keluar

---

## Lisensi

Private project, tidak untuk distribusi publik.

---

## Credits

Dibangun dengan ❤️ menggunakan **Node.js**, **React**, **Ant Design**, dan **Docker**.

Inspired by Portainer, Coolify, dan kebutuhan operasional lab AI lokal.
