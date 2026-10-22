import capabilities from '../../src-tauri/capabilities/default.json';
import { describe, expect, it } from 'vitest';

describe('主窗口原生控件权限', () => {
  it('允许自定义标题栏执行最小化、最大化还原和隐藏', () => {
    expect(capabilities.permissions).toEqual(expect.arrayContaining([
      'core:window:allow-minimize',
      'core:window:allow-toggle-maximize',
      'core:window:allow-hide',
    ]));
  });
});
