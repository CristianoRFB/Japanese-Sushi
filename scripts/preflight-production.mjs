import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnv() {
  const file = resolve('.env.local');
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match || match[1].startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, '$2');
  }
  return values;
}

const localEnv = loadLocalEnv();
const env = { ...localEnv, ...process.env };
const required = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];
const errors = required
  .filter((key) => !String(env[key] ?? '').trim())
  .map((key) => `${key} não foi informado`);

if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'sushi-cbfd2') {
  errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID precisa ser sushi-cbfd2');
}
if (env.NEXT_PUBLIC_USE_DEVELOPMENT_SEED === 'true') {
  errors.push('NEXT_PUBLIC_USE_DEVELOPMENT_SEED precisa estar desativado');
}
if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
  errors.push('NEXT_PUBLIC_USE_FIREBASE_EMULATORS precisa estar desativado');
}

if (errors.length) {
  console.error('Preflight de produção bloqueado:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Preflight de produção aprovado para o projeto Firebase sushi-cbfd2.');
