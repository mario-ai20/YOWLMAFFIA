import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electronBin = path.join(root, 'node_modules', 'electron', 'cli.js');

let closing = false;
let viteProcess = null;
let electronProcess = null;

function spawnProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1'
    }
  });

  child.on('exit', (code, signal) => {
    if (closing) {
      return;
    }

    closing = true;

    if (viteProcess && viteProcess.pid && !viteProcess.killed) {
      viteProcess.kill();
    }

    if (electronProcess && electronProcess.pid && !electronProcess.killed) {
      electronProcess.kill();
    }

    const exitCode = typeof code === 'number' ? code : signal ? 1 : 0;
    process.exit(exitCode);
  });

  return child;
}

function cleanup() {
  if (closing) {
    return;
  }

  closing = true;

  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill();
  }

  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }

  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

viteProcess = spawnProcess('vite', process.execPath, [viteBin]);
electronProcess = spawnProcess('electron', process.execPath, [electronBin, '.']);
