/**
 * Package the built extension (dist/) into a .zip whose ROOT contains the manifest.
 * Usage: npm run build:all && npm run package
 *
 * Zero dependencies — writes a minimal ZIP (stored entries, UTF-8 names, no compression).
 * Chrome Web Store / Firefox Add-ons accept stored ZIPs; this file can be uploaded directly.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (!existsSync(distDir)) {
  console.error('✗ dist/ not found — run `npm run build:all` first.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const files = walk(distDir)
  .map((f) => ({ abs: f, rel: relative(distDir, f).split(/[\\/]/).join('/') }))
  .sort((a, b) => a.rel.localeCompare(b.rel));
if (files.length === 0) {
  console.error('✗ dist/ is empty — run `npm run build:all` first.');
  process.exit(1);
}
if (!files.some((f) => f.rel === 'manifest.json')) {
  console.error('✗ dist/manifest.json missing — build is incomplete.');
  process.exit(1);
}

// ---- CRC32 (shared table) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function dosDateTime(date) {
  const y = Math.max(1980, date.getFullYear());
  return {
    date: ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  };
}

function dosTime(ms) {
  const d = new Date(ms);
  return dosDateTime(d);
}

const locals = []; // local file header + data
const centrals = []; // central directory entries
let offset = 0;

for (const f of files) {
  const data = readFileSync(f.abs);
  const name = Buffer.from(f.rel, 'utf8');
  const { date, time } = dosTime(statSync(f.abs).mtimeMs);
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // flags: UTF-8 filenames
  local.writeUInt16LE(0, 8); // method: stored (no compression)
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18); // compressed size
  local.writeUInt32LE(data.length, 22); // uncompressed size
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28); // extra length

  locals.push(local, name, data);

  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); // central directory header signature
  cen.writeUInt16LE(20, 4); // version made by (DOS/system 0)
  cen.writeUInt16LE(20, 6); // version needed
  cen.writeUInt16LE(0x0800, 8); // flags
  cen.writeUInt16LE(0, 10); // method
  cen.writeUInt16LE(time, 12);
  cen.writeUInt16LE(date, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(data.length, 20); // compressed size
  cen.writeUInt32LE(data.length, 24); // uncompressed size
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt16LE(0, 30); // extra length
  cen.writeUInt16LE(0, 32); // comment length
  cen.writeUInt16LE(0, 34); // disk start
  cen.writeUInt16LE(0, 36); // internal attributes
  cen.writeUInt32LE(0, 38); // external attributes
  cen.writeUInt32LE(offset, 42); // local header offset
  centrals.push(cen, name);

  offset += 30 + name.length + data.length;
}

const cdStart = offset;
const cdSize = centrals.reduce((a, c) => a + c.length, 0);

const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
eocd.writeUInt16LE(0, 4); // disk number
eocd.writeUInt16LE(0, 6); // cd disk
eocd.writeUInt16LE(files.length, 8); // entries on disk
eocd.writeUInt16LE(files.length, 10); // total entries
eocd.writeUInt32LE(cdSize, 12);
eocd.writeUInt32LE(cdStart, 16);
eocd.writeUInt16LE(0, 20); // comment length

const zip = Buffer.concat([...locals, ...centrals, eocd]);
const outPath = join(root, `${pkg.name}-${pkg.version}.zip`);
writeFileSync(outPath, zip);

console.log(`✓ Wrote ${outPath} (${(zip.length / 1024).toFixed(1)} KB, ${files.length} files)`);
console.log('  Load unpacked: select the dist/ folder.');
console.log('  Store upload:  upload this zip (manifest.json is at zip root).');
