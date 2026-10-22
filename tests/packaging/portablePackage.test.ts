import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('portable delivery builder', () => {
  it('uses the requested portable filename and validates the release version', () => {
    const script = readFileSync(resolve(root, 'scripts/build-portable.ps1'), 'utf8');

    expect(script).toContain('v2610-A');
    expect(script).toContain('[char]0x5C0F');
    expect(script).toContain('[char]0x5B89');
    expect(script).toContain('VersionInfo.FileVersion');
    expect(script).toContain('Package.appxmanifest');
    expect(script).toContain('obsoleteNames');
  });
});
