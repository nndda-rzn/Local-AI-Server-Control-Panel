import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../.env') });
loadEnv({ path: path.resolve(__dirname, '../../.env'), override: false });

import { ensureSeedAdmin } from '../services/user.service.js';

ensureSeedAdmin()
  .then(() => {
    console.log('[seed] done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  });
