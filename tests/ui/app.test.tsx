import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/ui/app/App';

describe('小番茄应用入口', () => {
  it('展示产品名和桌面宠物入口', () => {
    render(<App />);

    expect(screen.getAllByText('小番茄').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '打开设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '最小化' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '最大化' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭窗口' })).toBeInTheDocument();
  });
});
