import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import LandingPage from './LandingPage';

// PlayShell pulls in the audio/canvas coordinator, so stub it: we only care that
// the landing page swaps to it inline (same URL) with the chosen input mode.
vi.mock('./PlayShell', () => ({
  default: ({ initialInput }: { initialInput?: string }) => (
    <div>play shell: {initialInput}</div>
  ),
}));

describe('LandingPage', () => {
  it('renders the headline and both input choices', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /enable camera/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /use (mouse|touch) instead/i }).length).toBeGreaterThan(0);
  });

  it('starts playing in camera mode inline when enabling the camera', async () => {
    render(<LandingPage />);
    await userEvent.click(screen.getAllByRole('button', { name: /enable camera/i })[0]);
    expect(screen.getByText('play shell: camera')).toBeInTheDocument();
  });

  it('starts playing in pointer mode inline when choosing pointer input', async () => {
    render(<LandingPage />);
    await userEvent.click(screen.getAllByRole('button', { name: /use (mouse|touch) instead/i })[0]);
    expect(screen.getByText('play shell: mouse')).toBeInTheDocument();
  });
});
