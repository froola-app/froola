import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WheelEditor from './WheelEditor';

describe('WheelEditor', () => {
  it('prefills a new wheel with the diatonic slices', () => {
    render(<WheelEditor keyOffset={0} scale="major" initial={null}
      onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    const qualitySelects = screen.getAllByLabelText(/quality/i);
    expect(qualitySelects).toHaveLength(7);
    expect((qualitySelects[2] as HTMLSelectElement).value).toBe('min'); // iii
    expect((qualitySelects[6] as HTMLSelectElement).value).toBe('dim'); // vii°
  });

  it('saves edited slices (iii → III)', () => {
    const onSave = vi.fn();
    render(<WheelEditor keyOffset={0} scale="major" initial={null}
      onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getAllByLabelText(/quality/i)[2], { target: { value: 'maj' } });
    fireEvent.change(screen.getByLabelText(/wheel name/i), { target: { value: 'my wheel' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(
      'my wheel',
      expect.arrayContaining([expect.objectContaining({ interval: 4, quality: 'maj' })]),
      undefined,
    );
  });

  it('shows delete only when editing an existing wheel', () => {
    const wheel = { id: 'w1', name: 'pop', slices: [
      { interval: 0, quality: 'maj' as const }, { interval: 2, quality: 'min' as const },
      { interval: 4, quality: 'maj' as const }, { interval: 5, quality: 'maj' as const },
      { interval: 7, quality: 'maj' as const }, { interval: 9, quality: 'min' as const },
      { interval: 10, quality: 'maj' as const },
    ]};
    const onDelete = vi.fn();
    render(<WheelEditor keyOffset={0} scale="major" initial={wheel}
      onSave={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('w1');
  });
});
