import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const repoRoot = process.cwd();
const isWindows = process.platform === 'win32';

function parsePort(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function detectAgentIdFromPath() {
  const base = path.basename(repoRoot).toLowerCase();
  return base === 'a' || base === 'b' || base === 'c' ? base : null;
}

function computePorts() {
  const agentId = detectAgentIdFromPath();
  const offset =
    agentId === 'a' ? 1 : agentId === 'b' ? 2 : agentId === 'c' ? 3 : 0;

  const defaultFrontendPort = 4200 + offset;
  const defaultApiPort = 7071 + offset;

  return {
    agentId,
    frontendPort: parsePort(process.env.TRACKIT_FRONTEND_PORT, defaultFrontendPort),
    apiPort: parsePort(process.env.TRACKIT_API_PORT, defaultApiPort),
  };
}

async function assertPortAvailable(port, label) {
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`[dev:all] invalid ${label} port: ${String(port)}`);
  }

  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.once('error', (err) => {
      server.close(() => {
        const msg =
          err?.code === 'EADDRINUSE'
            ? `[dev:all] ${label} port ${port} is already in use. ` +
              `Set TRACKIT_${label.toUpperCase()}_PORT to override, or stop the process using that port.`
            : `[dev:all] failed to check ${label} port ${port}: ${err?.message ?? String(err)}`;
        reject(new Error(msg));
      });
    });

    server.listen(port, () => {
      server.close(resolve);
    });
  });
}

function spawnNpm(args, label) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : isWindows ? 'cmd.exe' : 'npm';
  const childArgs = npmExecPath
    ? [npmExecPath, ...args]
    : isWindows
      ? ['/d', '/s', '/c', `npm ${args.join(' ')}`]
      : args;

  process.stdout.write(`[dev:all] starting ${label}: npm ${args.join(' ')}\n`);
  const child = spawn(command, childArgs, { stdio: 'inherit', env: process.env });
  child.on('error', (err) => {
    process.stderr.write(`[dev:all] ${label} failed to start: ${err?.message ?? String(err)}\n`);
  });
  return child;
}

function writeProxyConfig(apiPort) {
  const proxyPath = path.join(repoRoot, 'frontend', 'src', 'proxy.conf.json');
  const proxyJson = {
    '/api/**': {
      target: `http://localhost:${apiPort}`,
      secure: false,
    },
  };

  fs.mkdirSync(path.dirname(proxyPath), { recursive: true });
  fs.writeFileSync(proxyPath, JSON.stringify(proxyJson, null, 2) + '\n', 'utf8');
  process.stdout.write(
    `[dev:all] proxy updated: frontend/src/proxy.conf.json -> ${proxyJson['/api/**'].target}\n`,
  );
}

let shuttingDown = false;
async function shutdown(children) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child?.pid || child.killed) continue;
    try {
      child.kill('SIGINT');
    } catch {
      try {
        child.kill();
      } catch {
        // ignore
      }
    }
  }

  await new Promise((r) => setTimeout(r, 1500));

  if (isWindows) {
    for (const child of children) {
      if (!child?.pid || child.killed) continue;
      try {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
  }
}

const { agentId, frontendPort, apiPort } = computePorts();
process.stdout.write(
  `[dev:all] ports: frontend=${frontendPort} api=${apiPort}` +
    (agentId ? ` (agent ${agentId})\n` : ' (main)\n'),
);

await assertPortAvailable(frontendPort, 'frontend');
await assertPortAvailable(apiPort, 'api');

writeProxyConfig(apiPort);

const frontend = spawnNpm(['run', 'dev:frontend:log', '--', '--port', String(frontendPort)], 'frontend');
const apiWatch = spawnNpm(['--workspace', 'api', 'run', 'watch'], 'api:watch');
const apiHost = spawnNpm(
  ['--workspace', 'api', 'run', 'start:host', '--', '--port', String(apiPort)],
  'api:host',
);

process.on('SIGINT', () => shutdown([frontend, apiWatch, apiHost]));
process.on('SIGTERM', () => shutdown([frontend, apiWatch, apiHost]));

const children = [
  { label: 'frontend', child: frontend },
  { label: 'api:watch', child: apiWatch },
  { label: 'api:host', child: apiHost },
];

const exitPromises = children.map(
  ({ label, child }) =>
    new Promise((resolve) => {
      child.on('exit', (code, signal) => resolve({ label, code, signal }));
    }),
);

const firstExit = await Promise.race(exitPromises);
if (!shuttingDown) {
  const details = firstExit.signal
    ? `${firstExit.label} exited via signal ${firstExit.signal}`
    : `${firstExit.label} exited with code ${firstExit.code ?? 0}`;
  process.stderr.write(`[dev:all] ${details}; shutting down all processes.\n`);
}

await shutdown([frontend, apiWatch, apiHost]);

const allExits = await Promise.all(exitPromises);
const failed = allExits.some((s) => (s.signal ? true : (s.code ?? 0) !== 0));
process.exitCode = failed ? 1 : 0;
