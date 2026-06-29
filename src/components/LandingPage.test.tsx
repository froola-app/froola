import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';

// PlayShell pulls in the audio/canvas coordinator, so stub it: we only care that
// the landing page swaps to it inline (same URL) with the chosen input mode.
vi.mock('./PlayShell', () => ({
  default: ({ initialInput }: { initialInput?: string }) => (
    <div>play shell: {initialInput}</div>
  ),
}));

beforeEach(() => localStorage.clear());

describe('LandingPage', () => {
  it('renders the tagline and both input choices', () => {
    render(<LandingPage />);
    expect(screen.getByText('play music with your hands')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable camera/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use (mouse|touch) instead/i })).toBeInTheDocument();
  });

  it('starts playing in camera mode inline when enabling the camera', async () => {
    render(<LandingPage />);
    await userEvent.click(screen.getByRole('button', { name: /enable camera/i }));
    expect(screen.getByText('play shell: camera')).toBeInTheDocument();
  });

  it('starts playing in pointer mode inline when choosing pointer input', async () => {
    render(<LandingPage />);
    await userEvent.click(screen.getByRole('button', { name: /use (mouse|touch) instead/i }));
    expect(screen.getByText('play shell: mouse')).toBeInTheDocument();
  });

  it('skips the prompt and reuses a recent choice on the next load', () => {
    localStorage.setItem(
      'froola.inputChoice',
      JSON.stringify({ mode: 'camera', expires: Date.now() + 60_000 }),
    );
    render(<LandingPage />);
    expect(screen.getByText('play shell: camera')).toBeInTheDocument();
    expect(screen.queryByText('play music with your hands')).not.toBeInTheDocument();
  });

  it('shows the prompt again once the saved choice has expired', () => {
    localStorage.setItem(
      'froola.inputChoice',
      JSON.stringify({ mode: 'camera', expires: Date.now() - 1 }),
    );
    render(<LandingPage />);
    expect(screen.getByText('play music with your hands')).toBeInTheDocument();
  });
});
