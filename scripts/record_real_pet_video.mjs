import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workDir = path.join(root, 'work');
const frameDir = path.join(workDir, 'pet-video-frames');
const output = path.join(root, 'outputs', '小番茄-真实宠物演示.mp4');
const viteUrl = 'http://127.0.0.1:1420/work/pet-video-demo.html';
const cdpBase = 'http://127.0.0.1:9339';
const chrome = process.env.CHROME_PATH || 'chrome.exe';
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg.exe';
const fps = 20;
const duration = 30;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForUrl(url, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startProcess(command, args, options = {}) {
  return spawn(command, args, { windowsHide: true, stdio: 'ignore', ...options });
}

async function ensureVite() {
  try {
    await waitForUrl(viteUrl, 800);
    return null;
  } catch {
    const server = startProcess(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm run dev -- --host 127.0.0.1 --port 1420'], { cwd: root });
    await waitForUrl(viteUrl);
    return server;
  }
}

async function getPageSocket() {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    try {
      const targets = await (await fetch(`${cdpBase}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  throw new Error('Timed out waiting for Chrome DevTools Protocol');
}

class CdpClient {
  constructor(url) {
    this.nextId = 0;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function runFfmpeg() {
  await new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-framerate', String(fps),
      '-i', path.join(frameDir, 'frame_%05d.png'),
      '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    process.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    process.on('error', reject);
    process.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exited with ${code}`)));
  });
}

async function waitForDemo(client, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await client.send('Runtime.evaluate', { expression: 'Boolean(document.querySelector(".video-canvas"))', returnByValue: true });
    if (result?.result?.value === true) return;
    await sleep(200);
  }
  throw new Error('Timed out waiting for the pet demo page to render');
}

async function main() {
  if (process.env.CHROME_PATH && !existsSync(chrome)) throw new Error(`Chrome not found: ${chrome}`);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  const vite = await ensureVite();
  const profile = path.join(workDir, 'pet-video-chrome-profile');
  const chromeProcess = startProcess(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=9339', `--user-data-dir=${profile}`, '--window-size=1280,720', '--force-device-scale-factor=1',
    viteUrl,
  ]);
  try {
    const client = new CdpClient(await getPageSocket());
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await waitForDemo(client);
    await client.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
    const frameCount = duration * fps;
    for (let index = 0; index < frameCount; index += 1) {
      const time = index / fps;
      await client.send('Runtime.evaluate', { expression: `window.__setVideoTime?.(${time});` });
      await sleep(42);
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      await writeFile(path.join(frameDir, `frame_${String(index + 1).padStart(5, '0')}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    client.close();
    await runFfmpeg();
  } finally {
    chromeProcess.kill();
    if (vite) vite.kill();
  }
  await rm(frameDir, { recursive: true, force: true });
  console.log(`WROTE ${output}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
