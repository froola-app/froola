import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LessonCatalog from './LessonCatalog';
import { TECHNIQUE_PATH, SONG_PATH } from '../../engine/lessons/curriculum';

vi.mock('../../engine/lessons/useLessonProgress', () => ({
  useLessonProgress: () => ({ allProgress: {} }),
}));
vi.mock('./ReviewBanner', () => ({ default: () => null }));

describe('LessonCatalog', () => {
  it('groups technique drills and songs under separate section headings, each in path order', () => {
    render(<MemoryRouter><LessonCatalog /></MemoryRouter>);

    const techniqueSection = screen.getByRole('heading', { name: /technique/i }).closest('section')!;
    const songsSection = screen.getByRole('heading', { name: /songs/i }).closest('section')!;

    const techniqueTitles = within(techniqueSection).getAllByRole('button').map(b => b.textContent);
    const songTitles = within(songsSection).getAllByRole('button').map(b => b.textContent);

    TECHNIQUE_PATH.forEach(lesson => {
      expect(techniqueTitles.some(t => t?.includes(lesson.title))).toBe(true);
    });
    SONG_PATH.forEach(lesson => {
      expect(songTitles.some(t => t?.includes(lesson.title))).toBe(true);
    });

    // No song titles leaked into the technique section, and vice versa
    SONG_PATH.forEach(lesson => {
      expect(techniqueTitles.some(t => t?.includes(lesson.title))).toBe(false);
    });
  });
});
