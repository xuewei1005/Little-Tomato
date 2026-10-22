// Code-native SVG is the single source for web, executable and packaged icons.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const candidates = [
  process.env.XIAOFANQIE_SHARP_MODULE,
  'sharp',
  process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.cache', 'codex-runtimes',
    'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'sharp'),
].filter(Boolean);
let sharp;
for (const candidate of candidates) {
  try { sharp = require(candidate); break; } catch { /* Try the next installed renderer. */ }
}
if (!sharp) throw new Error('Install sharp or set XIAOFANQIE_SHARP_MODULE to its absolute module directory.');

const icons = path.join(root, 'src-tauri', 'icons');
const svgPath = path.join(icons, 'icon.svg');
const result = spawnSync(process.execPath, [
  path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
  'icon', svgPath, '--output', icons,
], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`tauri icon exited with ${result.status}`);

const svg = await readFile(svgPath);
async function render(size, destination) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  await writeFile(destination, png);
}
await render(512, path.join(icons, 'icon.png'));
await render(512, path.join(root, 'public', 'xiaofanqie-icon.png'));

// Windows chooses target-size assets for the taskbar; all three theme forms
// have the same transparent silhouette. Manifest logos retain their base names.
for (const size of [16, 20, 24, 30, 32, 36, 40, 44, 48, 60, 64, 72, 80, 96, 128, 256]) {
  for (const form of ['', '_altform-unplated', '_altform-lightunplated']) {
    await render(size, path.join(icons, `Square44x44Logo.targetsize-${size}${form}.png`));
  }
}
for (const [name, size] of [['Square44x44Logo', 44], ['Square150x150Logo', 150], ['StoreLogo', 50]]) {
  await render(size, path.join(icons, `${name}.png`));
  for (const scale of [100, 125, 150, 200, 400]) {
    await render(Math.round(size * scale / 100), path.join(icons, `${name}.scale-${scale}.png`));
  }
}
console.log('Generated transparent web, Tauri and MSIX icons from src-tauri/icons/icon.svg.');
