import net from 'node:net';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Não foi possível reservar uma porta para o E2E.'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

const [authPort, firestorePort, functionsPort] = await Promise.all([
  findFreePort(),
  findFreePort(),
  findFreePort(),
]);
const sourceConfig = JSON.parse(
  await readFile(path.join(projectRoot, 'firebase.e2e.json'), 'utf8'),
);
sourceConfig.emulators.auth.port = authPort;
sourceConfig.emulators.firestore.port = firestorePort;
sourceConfig.emulators.functions.port = functionsPort;

sourceConfig.functions.source = 'functions';
sourceConfig.firestore.rules = 'firestore.rules';
sourceConfig.firestore.indexes = 'firestore.indexes.json';
const configPath = path.join(projectRoot, `.firebase.e2e.${process.pid}.json`);
await writeFile(configPath, `${JSON.stringify(sourceConfig, null, 2)}\n`);

const firebaseCli = path.join(
  projectRoot,
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js',
);
const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(
  process.execPath,
  [
    firebaseCli,
    'emulators:exec',
    '--config',
    configPath,
    '--project',
    'sushi-cbfd2',
    '--only',
    'auth,firestore,functions',
    `${command} --prefix functions run test:e2e`,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      GCLOUD_PROJECT: 'sushi-cbfd2',
      FIREBASE_CONFIG: JSON.stringify({ projectId: 'sushi-cbfd2' }),
      AUTH_EMULATOR_PORT: String(authPort),
      FIRESTORE_EMULATOR_PORT: String(firestorePort),
      FUNCTIONS_EMULATOR_PORT: String(functionsPort),
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`,
      FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestorePort}`,
      FUNCTIONS_EMULATOR_HOST: `127.0.0.1:${functionsPort}`,
      // Cold TypeScript/Functions discovery can exceed Firebase CLI's 10s default on Windows.
      FUNCTIONS_DISCOVERY_TIMEOUT: '60',
    },
    stdio: 'inherit',
  },
);

let exitCode;
try {
  exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
} finally {
  await rm(configPath, { force: true });
}
process.exitCode = exitCode;
