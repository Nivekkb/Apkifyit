const fs = require('fs');
const path = require('path');

const outDir = path.join(process.cwd(), 'out');

if (!fs.existsSync(outDir)) {
  console.error('\n[mobile] Missing out/ directory. Run `npm run mobile:export` first.\n');
  process.exit(1);
}

const indexFile = path.join(outDir, 'index.html');
if (!fs.existsSync(indexFile)) {
  console.error('\n[mobile] out/ exists but index.html is missing. Re-run `npm run mobile:export`.\n');
  process.exit(1);
}

console.log('[mobile] out/ directory found.');
