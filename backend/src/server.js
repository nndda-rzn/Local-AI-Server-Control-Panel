import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (parent of backend/), fallback ke backend/.env
loadEnv({ path: path.resolve(__dirname, '../../.env') });
loadEnv({ path: path.resolve(__dirname, '../.env'), override: false });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes.js';
import systemRoutes from './routes/system.routes.js';
import dockerRoutes from './routes/docker.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import aiRoutes from './routes/ai.routes.js';
import auditRoutes from './routes/audit.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

import { getDb } from './db/index.js';
import { ensureSeedAdmin } from './services/user.service.js';

const app = express();
const PORT = process.env.PORT || 5500;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'panel-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

async function bootstrap() {
  getDb();
  await ensureSeedAdmin();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Panel backend running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
