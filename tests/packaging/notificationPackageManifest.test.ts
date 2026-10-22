import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Windows application package manifest', () => {
  it('declares the app identity without system notification access and includes pet logos', () => {
    const manifest = readFileSync(resolve(root, 'src-tauri/manifest/Package.appxmanifest'), 'utf8');

    expect(manifest).toContain('Name="com.xiaofanqie.desktop"');
    expect(manifest).toContain('Publisher="CN=XiaoFanQie"');
    expect(manifest).toContain('TargetDeviceFamily Name="Windows.Desktop"');
    expect(manifest).not.toContain('userNotificationListener');
    expect(manifest).toContain('StoreLogo.png');
    expect(manifest).toContain('Square44x44Logo.png');
    expect(manifest).toContain('Square150x150Logo.png');
    expect(manifest).not.toContain('AppListEntry="none"');
  });

  it('has a staged executable name instead of the AppX token after packaging', () => {
    const sourceManifest = readFileSync(resolve(root, 'src-tauri/manifest/Package.appxmanifest'), 'utf8');
    const manifest = sourceManifest.replace('$targetnametoken$.exe', 'xiaofanqie.exe');

    expect(manifest).not.toContain('$targetnametoken$');
    expect(manifest).toContain('Executable="xiaofanqie.exe"');
  });

  it('leaves only the named portable app and Todo sync file in outputs', () => {
    for (const file of ['小番茄-安装（v2610-A）.exe', '小番茄-Todo.csv']) {
      expect(existsSync(resolve(root, 'outputs', file))).toBe(true);
    }
    for (const file of [
      '小番茄-安装.exe',
      '小番茄-便携版.exe',
      '小番茄-通知版.msix',
      '小番茄-通知版.cer',
      '小番茄-通知版-安装说明.txt',
      '小番茄-应用.msix',
      '小番茄-应用.cer',
      '小番茄-应用-安装说明.txt',
    ]) {
      expect(existsSync(resolve(root, 'outputs', file))).toBe(false);
    }
  });
});
