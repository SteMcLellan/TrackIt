import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const defaultLogPath = path.join(repoRoot, 'dist', 'frontend', 'dev-frontend.log');
const logPath = process.env.TRACKIT_DEV_FRONTEND_LOG ?? defaultLogPath;

fs.mkdirSync(path.dirname(logPath), { recursive: true });

const ANSI_REGEX = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const stripAnsi = (s) => s.replace(ANSI_REGEX, '');

const BUILD_START_PATTERNS = [
  /\bChanges detected\b/i,
  /\bFile change detected\b/i,
  /\bRebuilding\.\.\.\b/i,
  /\bGenerating (?:browser )?application bundles?\b/i,
  /\bGenerating (?:browser )?application bundle\b/i,
  /\bBrowser application bundle generation\b/i,
];

const BUILD_END_PATTERNS = [
  /\bbundle generation complete\b/i,
  /\bApplication bundle generation complete\b/i,
  /\bCompiled successfully\b/i,
  /\bWatch mode enabled\b/i,
  /\bFailed to compile\b/i,
  /\bCompilation failed\b/i,
  /\bBuild failed\b/i,
];

let buildNumber = 0;
let inBuild = false;
let lastResetMs = 0;
let logStream = null;

function openLogStream() {
  logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
}

function resetLog(reason) {
  const now = Date.now();
  buildNumber += 1;
  inBuild = true;
  lastResetMs = now;

  if (logStream) {
    logStream.end();
    logStream = null;
  }

  const header =
    `# TrackIt dev:frontend latest build log\n` +
    `# Build: ${buildNumber}\n` +
    `# Started: ${new Date().toISOString()}\n` +
    `# Reason: ${reason}\n\n`;

  fs.writeFileSync(logPath, header, 'utf8');
  openLogStream();

  process.stdout.write(
    `[dev:frontend:log] Log reset (${reason}) -> build ${buildNumber}\n`,
  );
}

function maybeResetForBuildStart(line) {
  const clean = stripAnsi(line);
  const isStart = BUILD_START_PATTERNS.some((re) => re.test(clean));
  if (!isStart) return;

  // Debounce so we don't repeatedly truncate during the same build's chatter.
  const now = Date.now();
  if (now - lastResetMs < 1500) return;

  resetLog('rebuild detected');
}

function maybeMarkBuildEnded(line) {
  const clean = stripAnsi(line);
  const isEnd = BUILD_END_PATTERNS.some((re) => re.test(clean));
  if (isEnd) inBuild = false;
}

function writeLineToLog(line, source) {
  if (!logStream) return;
  const clean = stripAnsi(line);
  const prefix = source === 'stderr' ? '[stderr] ' : '';
  logStream.write(prefix + clean + '\n');
}

function createChunkHandler(source) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.toString('utf8');
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() ?? '';
    for (const line of parts) {
      maybeResetForBuildStart(line);
      writeLineToLog(line, source);
      maybeMarkBuildEnded(line);
    }
  };
}

resetLog('process start');
process.stdout.write(`[dev:frontend:log] Writing latest build output to: ${logPath}\n`);

function spawnNpmRunDevFrontend() {
  // Prefer spawning npm via the JS entrypoint when available (most reliable on Windows).
  // When invoked via `npm run`, `npm_execpath` is typically set.
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, 'run', 'dev:frontend'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' },
    });
  }

  // Fallback: try direct npm binary.
  const npmCmd = process.platform === 'win32' ? 'npm' : 'npm';
  return spawn(npmCmd, ['run', 'dev:frontend'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: process.platform === 'win32',
  });
}

let child;
try {
  child = spawnNpmRunDevFrontend();
} catch (err) {
  process.stderr.write(
    `[dev:frontend:log] Failed to spawn dev server: ${err?.message ?? String(err)}\n`,
  );
  process.exitCode = 1;
  if (logStream) logStream.end();
  throw err;
}

child.stdout.on('data', (chunk) => process.stdout.write(chunk));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

child.stdout.on('data', createChunkHandler('stdout'));
child.stderr.on('data', createChunkHandler('stderr'));

function shutdown(signal) {
  if (child.killed) return;
  child.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('close', (code, signal) => {
  if (logStream) logStream.end();
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
