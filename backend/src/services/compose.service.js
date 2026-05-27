import { spawn } from 'node:child_process';

const COMPOSE_BIN = process.env.COMPOSE_BIN || 'docker';

const ALLOWED_COMPOSE_ACTIONS = new Set(['up', 'down', 'restart', 'ps']);

export function runCompose({ projectDir, composeFile, action, timeoutMs = 180000 }) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_COMPOSE_ACTIONS.has(action)) {
      const error = new Error(`Compose action not allowed: ${action}`);
      error.status = 400;
      return reject(error);
    }

    const args = ['compose', '-f', composeFile];

    if (action === 'up') args.push('up', '-d');
    else if (action === 'down') args.push('down');
    else if (action === 'restart') args.push('restart');
    else if (action === 'ps') args.push('ps');

    const start = Date.now();
    const child = spawn(COMPOSE_BIN, args, {
      cwd: projectDir,
      env: { ...process.env, COMPOSE_INTERACTIVE_NO_CLI: '1' },
      shell: false
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

    child.on('close', (code) => {
      clearTimeout(timer);
      const duration = Date.now() - start;
      const output = `${stdout}\n${stderr}`.trim();

      if (killed) {
        const error = new Error(`Compose command timed out after ${timeoutMs}ms`);
        error.status = 504;
        error.output = output;
        error.duration = duration;
        return reject(error);
      }

      if (code === 0) {
        return resolve({ code, output, duration });
      }

      const error = new Error(`Compose exited with code ${code}`);
      error.status = 500;
      error.output = output;
      error.duration = duration;
      reject(error);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
