import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import RecordButton from './RecordButton';

function Harness() {
  const signalsRef = useRef([]);
  return <RecordButton signalsRef={signalsRef} vibe="warm" />;
}

describe('RecordButton', () => {
  it('shows Rec in idle state', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /rec/i })).toBeInTheDocument();
  });

  it('shows Stop after clicking Rec', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows Share after clicking Stop', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('copies shareUrl on Share click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /rec/i }));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/replay\?d=/)
    );
  });
});
