import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { AuthProvider } from '../../contexts/AuthContext';
import { useReviewProgress } from './useReviewProgress';

// This test env has no VITE_SUPABASE_* config, so supabaseConfigured is false and
// the hook must degrade gracefully — same contract as useLessonProgress.
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(AuthProvider, null, children);
}

describe('useReviewProgress (no Supabase configured)', () => {
  it('reports zero due drills without a signed-in user', async () => {
    const { result } = renderHook(() => useReviewProgress(), { wrapper });
    await waitFor(() => {
      expect(result.current.dueCount).toBe(0);
    });
    expect(result.current.dueDrills).toEqual([]);
  });

  it('recordResult resolves without throwing when Supabase is unavailable', async () => {
    const { result } = renderHook(() => useReviewProgress(), { wrapper });
    await expect(result.current.recordResult('some-drill-id', true)).resolves.toBeUndefined();
  });
});
