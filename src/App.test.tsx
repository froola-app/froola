import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Firebase configured, nobody signed in — the exact state that used to
// hard-gate behind SignInPage.
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    firebaseReady: true,
    signInWithGoogle: vi.fn(),
    signOutUser: vi.fn(),
    completeOnboarding: vi.fn(),
  }),
}));

beforeEach(() => sessionStorage.clear());

describe('App routing (Firebase configured, signed out)', () => {
  it('renders the landing page at / instead of a sign-in gate', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: /make music/i })).toBeDefined();
  });
});
