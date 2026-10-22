import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodoCalendar } from '../../src/ui/settings/TodoCalendar';

describe('TodoCalendar', () => {
  afterEach(cleanup);

  it('renders only valid solar days and selects a canonical date', () => {
    const onChange = vi.fn();
    render(<TodoCalendar calendarType="solar" value="2024-02-20" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '公历 2024年2月29日' }));
    expect(onChange).toHaveBeenCalledWith('2024-02-29');
    expect(screen.queryByRole('button', { name: '公历 2024年2月30日' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一年' }));
    expect(screen.queryByRole('button', { name: '公历 2025年2月29日' })).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '上一月' }));
    expect(screen.getByRole('button', { name: '公历 2025年1月31日' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '上一月' }));
    expect(screen.getByRole('button', { name: '公历 2024年12月31日' })).toBeInTheDocument();
  });

  it('navigates into and out of a lunar leap month without selecting dates implicitly', () => {
    const onChange = vi.fn();
    render(<TodoCalendar calendarType="lunar" value="2025-06-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '下一月' }));
    expect(screen.getByLabelText('日历月份')).toHaveValue('-6');
    expect(screen.queryByRole('button', { name: '农历 2025年闰六月三十' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '农历 2025年闰六月初一' }));
    expect(onChange).toHaveBeenCalledWith('2025--06-01');
    fireEvent.click(screen.getByRole('button', { name: '下一月' }));
    expect(screen.getByRole('button', { name: '农历 2025年七月初一' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '上一月' }));
    fireEvent.click(screen.getByRole('button', { name: '下一年' }));
    expect(screen.getByRole('button', { name: '农历 2026年六月初一' })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports direct month and year navigation and lunar year boundaries', () => {
    render(<TodoCalendar calendarType="lunar" value="2025-12-01" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '下一月' }));
    expect(screen.getByRole('button', { name: '农历 2026年正月初一' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('日历年份'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText('日历月份'), { target: { value: '-6' } });
    expect(screen.getByRole('button', { name: '农历 2025年闰六月初一' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '上一年' }));
    expect(screen.getByRole('button', { name: '农历 2024年六月初一' })).toBeInTheDocument();
  });
});
