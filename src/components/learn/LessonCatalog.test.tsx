import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LessonCatalog from './LessonCatalog';
import { LEARNING_PATH } from '../../engine/lessons/curriculum';

vi.mock('../../engine/lessons/useLessonProgress', () => ({
  useLessonProgress: () => ({ allProgress: {} }),
}));
vi.mock('./ReviewBanner', () => ({ default: () => null }));

describe('LessonCatalog', () => {
  it('renders every lesson in learning-path order as one journey', () => {
    render(<MemoryRouter><LessonCatalog /></MemoryRouter>);

    const journey = screen.getByRole('heading', { name: /the journey/i }).closest('section')!;
    const titles = within(journey).getAllByRole('button').map(b => b.textContent ?? '');

    // Each lesson appears, and in path order (indexes strictly increasing).
    let lastIdx = -1;
    LEARNING_PATH.forEach(lesson => {
      const idx = titles.findIndex(t => t.includes(lesson.title));
      expect(idx, `${lesson.title} present`).toBeGreaterThanOrEqual(0);
      expect(idx, `${lesson.title} in path order`).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    });
  });

  it('surfaces the first lesson as the "start here" up-next card', () => {
    render(<MemoryRouter><LessonCatalog /></MemoryRouter>);
    expect(screen.getByText(/start here/i)).toBeInTheDocument();
  });
});
