import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(resolve(process.cwd(), 'src/ui/theme/tokens.css'), 'utf8');

describe('settings window layout', () => {
  it('keeps the titlebar fixed while only the content area scrolls', () => {
    expect(tokens).toMatch(/\.window-frame\s*\{[^}]*height:\s*100vh/);
    expect(tokens).toMatch(/\.window-frame\s*\{[^}]*overflow:\s*hidden/);
    expect(tokens).toMatch(/\.window-titlebar\s*\{[^}]*flex:\s*0 0 42px/);
    expect(tokens).toMatch(/\.app-shell\s*\{[^}]*min-height:\s*0/);
    expect(tokens).toMatch(/\.main-content\s*\{[^}]*min-height:\s*0/);
  });
});
