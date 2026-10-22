import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
let sharp;
for (const candidate of [process.env.XIAOFANQIE_SHARP_MODULE, 'sharp',
  process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')].filter(Boolean)) {
  try { sharp = require(candidate); break; } catch { /* Try next installed renderer. */ }
}
if (!sharp) throw new Error('sharp is required for alpha verification.');
const icons = path.join(root, 'src-tauri/icons');
const svg = await readFile(path.join(icons, 'icon.svg'), 'utf8');
assert(!/tileEdge|<filter|<feDropShadow/.test(svg), 'SVG still has an outer decoration');
const web = await readFile(path.join(root, 'public/xiaofanqie-icon.png'));
assert(web.equals(await readFile(path.join(icons, 'icon.png'))), 'Web and desktop sources differ');
let checked = 0;
async function check(file, size) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, size, file);
  assert.equal(info.height, size, file);
  for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
    assert.equal(data[(y * size + x) * 4 + 3], 0, `${file}: corner is not transparent`);
  }
  assert.equal(data[(Math.floor(size / 2) * size + Math.floor(size / 2)) * 4 + 3], 255, `${file}: center missing`);
  checked++;
}
await check(web, 512);
for (const size of [16, 20, 24, 30, 32, 36, 40, 44, 48, 60, 64, 72, 80, 96, 128, 256]) {
  for (const form of ['', '_altform-unplated', '_altform-lightunplated']) {
    await check(path.join(icons, `Square44x44Logo.targetsize-${size}${form}.png`), size);
  }
}
for (const [name, size] of [['Square44x44Logo', 44], ['Square150x150Logo', 150], ['StoreLogo', 50]]) {
  await check(path.join(icons, `${name}.png`), size);
  for (const scale of [100, 125, 150, 200, 400]) {
    await check(path.join(icons, `${name}.scale-${scale}.png`), Math.round(size * scale / 100));
  }
}
// Verify every image in the executable ICO, including the taskbar sizes.
const ico = await readFile(path.join(icons, 'icon.ico'));
assert.equal(ico.readUInt16LE(2), 1, 'ICO header');
const count = ico.readUInt16LE(4);
const sizes = [];
for (let index = 0; index < count; index++) {
  const offset = 6 + index * 16;
  const size = ico[offset] || 256;
  sizes.push(size);
  const length = ico.readUInt32LE(offset + 8);
  const start = ico.readUInt32LE(offset + 12);
  const entry = ico.subarray(start, start + length);
  if (entry.subarray(1, 4).toString() === 'PNG') {
    await check(entry, size);
  } else {
    // Tauri's smaller ICO entries use a 32-bit bottom-up DIB plus an AND mask.
    assert.equal(entry.readUInt16LE(14), 32, `ICO ${size}: expected BGRA pixels`);
    const headerSize = entry.readUInt32LE(0);
    for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
      assert.equal(entry[headerSize + ((size - 1 - y) * size + x) * 4 + 3], 0, `ICO ${size}: opaque corner`);
    }
    checked++;
  }
}
assert(sizes.includes(16) && sizes.includes(32) && sizes.includes(48) && sizes.includes(256), 'Missing ICO shell sizes');
console.log(`PASS: ${checked} PNG/ICO images have expected dimensions and transparent corners; web/source icons match.`);
