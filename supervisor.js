import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logDirectory = path.join(projectDirectory, 'logs');
const logFile = path.join(logDirectory, 'bot.log');
mkdirSync(logDirectory, { recursive: true });

const logStream = createWriteStream(logFile, { flags: 'a' });
let childProcess;
let stopping = false;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  process.stdout.write(line);
  logStream.write(line);
}

function forwardOutput(stream) {
  stream.on('data', (chunk) => {
    process.stdout.write(chunk);
    logStream.write(chunk);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    childProcess?.kill(signal);
  });
}

while (!stopping) {
  log('Iniciando o processo do bot.');
  childProcess = spawn(process.execPath, [path.join(projectDirectory, 'src', 'index.js')], {
    cwd: projectDirectory,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  forwardOutput(childProcess.stdout);
  forwardOutput(childProcess.stderr);

  const exitCode = await new Promise((resolve) => {
    childProcess.once('error', (error) => {
      log(`Falha ao iniciar o processo do bot: ${error.message}`);
      resolve(1);
    });
    childProcess.once('close', (code) => resolve(code ?? 1));
  });

  childProcess = undefined;
  if (stopping) break;

  const delaySeconds = exitCode === 75 ? 2 : 30;
  log(`O processo do bot encerrou com código ${exitCode}; nova tentativa em ${delaySeconds} segundos.`);
  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
}

logStream.end();
