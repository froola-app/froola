import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import { useAuth } from '../contexts/AuthContext';

// LandingPage's CTAs navigate to /play; capture the navigation instead of
// mounting the real router destination.
const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: MemoryRouter });

// LandingPage renders ProfileButton (the nav sign-in entry point), which
// needs AuthContext — mock it the same way ProfileButton.test.tsx does.
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mocked(useAuth).mockReturnValue({
  user: null,
  profile: null,
  loading: false,
  authReady: true,
  signInWithGoogle: vi.fn().mockResolvedValue(undefined),
  signOutUser: vi.fn(),
  completeOnboarding: vi.fn(),
});

// PricingSection calls useAuth, which needs an AuthProvider these tests
// don't set up — not relevant to input-mode behavior, so stub it out.
vi.mock('./PricingSection', () => ({
  default: () => <div>pricing section</div>,
}));

describe('LandingPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    navigate.mockClear();
  });

  it('renders the marketing hero even with a stored input mode', () => {
    sessionStorage.setItem('froola.inputMode', 'camera');
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders the headline and both input choices', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /enable camera/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /use (mouse|touch) instead/i }).length).toBeGreaterThan(0);
  });

  it('stores camera mode and navigates to /play when enabling the camera', async () => {
    render(<LandingPage />);
    await userEvent.click(screen.getAllByRole('button', { name: /enable camera/i })[0]);
    expect(sessionStorage.getItem('froola.inputMode')).toBe('camera');
    expect(navigate).toHaveBeenCalledWith('/play');
  });

  it('stores pointer mode and navigates to /play when choosing pointer input', async () => {
    render(<LandingPage />);
    await userEvent.click(screen.getAllByRole('button', { name: /use (mouse|touch) instead/i })[0]);
    expect(sessionStorage.getItem('froola.inputMode')).toBe('mouse');
    expect(navigate).toHaveBeenCalledWith('/play');
  });
});
