import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('migração Teiko: guarda sem escrita real', () => {
  it('bloqueia inspeção quando não está no Firestore Emulator', () => {
    const env = { ...process.env };
    delete env.FIRESTORE_EMULATOR_HOST;
    const result = spawnSync(process.execPath, [resolve('functions/scripts/tenant-migration-dry-run.mjs')], {
      env, encoding: 'utf8', timeout: 5000,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Firestore Emulator/);
    expect(result.stdout).not.toMatch(/secret|token|customer/i);
  });
});
