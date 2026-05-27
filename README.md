# Local AI Server Control Panel

Web admin panel untuk mengelola server lokal berbasis Ubuntu Server + Docker. Sesuai PRD v1.0.

## Fitur MVP

- Login admin (bcrypt + JWT, rate limited)
- Dashboard server: CPU, RAM, disk, uptime, Docker, Cloudflare Tunnel
- Docker Manager: list / start / stop / restart / logs container
- Project Manager: scan & deploy compose project dari `/server/apps`
- AI Settings: confidence threshold, image size, device, CAM method, active model
- Model upload (.pt, .pth, .onnx, .pkl) ke `/server/data/models`
- Audit Log: catat aksi login, container, project, AI, model
- Health check HTTP endpoint untuk service internal

## Struktur

```txt
local-ai-server-control-panel/
├── backend/                # Node.js + Express + dockerode + better-sqlite3
│   └── src/
│       ├── db/             # SQLite schema & init
│       ├── middleware/
│       ├── routes/         # auth, system, docker, projects, ai, audit
│       ├── scripts/        # seed admin
│       ├── services/
│       └── utils/
├── frontend/               # React + Vite
│   └── src/
│       ├── components/     # Sidebar, ConfirmModal, StatCard
│       ├── pages/          # Dashboard, Containers, Projects, AIModels, AuditLog, Login
│       └── utils/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Quick Start (Monorepo Scripts)

Install semua dependencies sekaligus:
```bash
npm install
npm run install:all
```

### Development (Frontend + Backend bersamaan)

```bash
npm run dev
```

Output:
- **BE** Backend di `http://localhost:5500`
- **FE** Frontend di `http://localhost:5174` (auto-proxy `/api` → backend)

Atau jalankan terpisah di terminal berbeda:
```bash
npm run dev:be    # backend only
npm run dev:fe    # frontend only
```

### Production (Docker)

```bash
npm run docker:up         # build + start container
npm run docker:logs       # tail logs
npm run docker:ps         # status container
npm run docker:down       # stop semua
npm run docker:rebuild    # rebuild dari awal
```

Setelah `docker:up`, panel tersedia di `http://localhost:3000`.

### Lainnya

```bash
npm run seed              # seed admin user dari .env
npm run build:fe          # build frontend production
npm run preview:fe        # preview hasil build
npm run start:be          # start backend mode production
```

## Setup di Ubuntu Server

Pindahkan folder project ke:

```bash
sudo mkdir -p /server/apps
sudo cp -r ./local-ai-server-control-panel /server/apps/
cd /server/apps/local-ai-server-control-panel
```

Buat folder data yang dibutuhkan panel:

```bash
sudo mkdir -p /server/data/sqlite /server/data/models /server/data/uploads /server/backup
sudo chown -R $USER:$USER /server
```

Buat file environment:

```bash
cp .env.example .env
nano .env
```

Wajib diganti:

```env
JWT_SECRET=isi-dengan-random-panjang
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password-kuat
```

Build & jalankan:

```bash
docker compose up -d --build
```

Cek container:

```bash
docker ps
```

Buka panel:

```txt
http://IP-SERVER:3000
```

## Cloudflare Tunnel

Arahkan public hostname ke `http://localhost:3000`. Service lain seperti backend internal, database, SSH, dan Docker socket TIDAK boleh dibuka via tunnel.

| Hostname              | Target Lokal             |
| --------------------- | ------------------------ |
| panel.domain.com      | http://localhost:3000    |
| app.domain.com        | http://localhost:8081    |
| api.domain.com        | http://localhost:8000    |

## Development (tanpa Docker)

Backend:
```bash
cd backend
npm install
cp ../.env.example ./.env
# edit DATABASE_PATH ke path lokal yang writeable, misal:
# DATABASE_PATH=./panel.db
# ALLOWED_PROJECT_ROOT=./fake-apps
# ALLOWED_MODEL_ROOT=./fake-models
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
# buka http://localhost:5174 (proxy /api -> backend:5500)
```

## Keamanan

- Akses Docker socket terbatas pada backend container
- Command compose hanya whitelist: `up -d`, `down`, `restart`, `ps`
- Path access dibatasi `ALLOWED_PROJECT_ROOT` dan `ALLOWED_MODEL_ROOT`
- Container `panel-backend` dan `panel-frontend` di-protect dari aksi stop UI
- Login rate limit 10x / 15 menit
- Audit log mencatat semua aksi penting
- Panel admin sebaiknya dilindungi Cloudflare Access untuk akses publik

## API Ringkas

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/system/status
GET    /api/system/health-check

GET    /api/docker/containers
GET    /api/docker/containers/:name/logs?tail=200
POST   /api/docker/containers/:name/{start|stop|restart}

GET    /api/projects
GET    /api/projects/:id
GET    /api/projects/:id/history
POST   /api/projects/:id/{deploy|down|restart}

GET    /api/ai/settings
PUT    /api/ai/settings
GET    /api/ai/models
POST   /api/ai/models/upload
POST   /api/ai/models/:id/activate
DELETE /api/ai/models/:id

GET    /api/audit?limit=200&action=auth.login
```
