const { spawn } = require('child_process');
const path = require('path');
require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
}

function launch(script, cwd, args = []) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: path.join(__dirname, cwd),
    stdio: 'inherit',
    env: process.env
  });
  children.push(child);
  child.on('error', error => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', code => {
    if (!stopping) stop(code || 1);
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
launch('src/server.js', 'backend');
launch('node_modules/vite/bin/vite.js', 'frontend');
