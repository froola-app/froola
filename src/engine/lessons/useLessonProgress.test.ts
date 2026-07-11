import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { AuthProvider } from '../../contexts/AuthContext';
import { useLessonProgress } from './useLessonProgress';

// This test env has no VITE_SUPABASE_* config, so supabaseConfigured is false —
// mirrors a guest session, which is how /learn is reachable without signing in.
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(AuthProvider, null, children);
}

describe('useLessonProgress (no Supabase configured)', () => {
  it('updates local progress from save() even without a signed-in user', async () => {
    const { result } = renderHook(() => useLessonProgress('first-chord'), { wrapper });

    await act(async () => {
      await result.current.save({
        lessonId: 'first-chord',
        stepResults: [],
        totalScore: 95,
        completedAt: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current.progress?.bestScore).toBe(95);
    });
  });
});
