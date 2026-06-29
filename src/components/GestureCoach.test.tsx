import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach } from 'vitest';
import GestureCoach from './GestureCoach';

beforeEach(() => localStorage.clear());

describe('GestureCoach', () => {
  it('shows the how-to-play tips on first run', () => {
    render(<GestureCoach mode="camera" />);
    expect(screen.getByRole('dialog', { name: /how to play/i })).toBeInTheDocument();
    expect(screen.getByText(/both hands on the wheels/i)).toBeInTheDocument();
  });

  it('only shows the fist-latch tip in camera mode', () => {
    const { unmount } = render(<GestureCoach mode="camera" />);
    expect(screen.getByText(/right fist/i)).toBeInTheDocument();
    unmount();
    localStorage.clear();
    render(<GestureCoach mode="mouse" />);
    expect(screen.queryByText(/right fist/i)).not.toBeInTheDocument();
  });

  it('dismisses and stays dismissed on next mount', async () => {
    const { unmount } = render(<GestureCoach mode="camera" />);
    await userEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    render(<GestureCoach mode="camera" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
