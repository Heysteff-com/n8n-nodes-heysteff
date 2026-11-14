// Copia los íconos (.svg) junto a los .js compilados: n8n los busca ahí.
import { cpSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.svg')) cpSync(p, join(root, 'dist', relative(root, p)));
  }
}
for (const dir of ['nodes', 'credentials']) walk(join(root, dir));
