// The pasteable one-file function must match the real function files.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { oneFile, outFile } from '../scripts/one-file-function.mjs';
const root = pathToFileURL(process.cwd() + '/'); // npm test runs from the repository root
const ok = readFileSync(outFile(root), 'utf8') === oneFile(root);
console.log((ok ? 'PASS ' : 'FAIL ') + 'supabase/sift-ai-one-file.ts is up to date' + (ok ? '' : ' (run: npm run function:one-file)'));
if (!ok) process.exit(1); console.log('\nALL PASSED');
