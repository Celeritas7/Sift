// Bundle each tests/*.test.ts with rolldown (the app's TS has extensionless imports) and run it in Node.
import { build } from 'rolldown';
import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const out = mkdtempSync(join(tmpdir(), 'sift-test-')); let failed = 0;
try {
  for (const f of readdirSync(dir).filter(f => f.endsWith('.test.ts'))) {
    const file = join(out, f.replace(/\.ts$/, '.mjs'));
    await build({ input: join(dir, f), platform: 'node', transform: { define: { 'import.meta.env': '{}' } }, output: { file, format: 'esm' }, logLevel: 'silent' });
    console.log(`\n# ${f}`);
    try { execFileSync(process.execPath, [file], { stdio: 'inherit' }); } catch { failed++; }
  }
} finally { rmSync(out, { recursive: true, force: true }); }
process.exit(failed ? 1 : 0);
