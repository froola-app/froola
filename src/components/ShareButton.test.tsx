import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from './ShareButton';

describe('ShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://froola.app' },
      writable: true,
    });
  });

  it('renders Share label by default', () => {
    render(<ShareButton />);
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('copies /play URL on click and shows Copied!', async () => {
    render(<ShareButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://froola.app/play');
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

});
