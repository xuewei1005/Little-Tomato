import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('single-file installer UI', () => {
  it('uses the branded modern wizard without the legacy details pane', () => {
    const bootstrap = readFileSync(resolve(root, 'scripts/installer/bootstrap.nsi'), 'utf8');

    expect(bootstrap).toContain('!include "MUI2.nsh"');
    expect(bootstrap).toContain('!define MUI_ICON "${APP_ICON}"');
    expect(bootstrap).toContain('!insertmacro MUI_PAGE_INSTFILES');
    expect(bootstrap).toContain('ShowInstDetails nevershow');
    expect(bootstrap).toContain('AutoCloseWindow true');
    expect(bootstrap).not.toContain('Page instfiles');
    expect(bootstrap).not.toContain('ShowInstDetails show');
  });

  it('runs the payload without opening a second PowerShell message box', () => {
    const bootstrap = readFileSync(resolve(root, 'scripts/installer/bootstrap.nsi'), 'utf8');
    const installScript = readFileSync(resolve(root, 'scripts/installer/install-package.ps1.in'), 'utf8');

    expect(bootstrap).toContain('-SilentUi');
    expect(installScript).toContain('[switch]$SilentUi');
    expect(installScript).toContain('if (-not $SilentUi)');
  });
});
