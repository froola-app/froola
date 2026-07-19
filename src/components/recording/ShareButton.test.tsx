import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from './ShareButton';

vi.mock('../../engine/recording/recordingStore', () => ({ listRecordings: vi.fn() }));
import { listRecordings } from '../../engine/recording/recordingStore';
const mockList = vi.mocked(listRecordings);

describe('ShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://froolamusic.com' },
      writable: true,
    });
    mockList.mockResolvedValue([]);
  });

  it('renders Share label by default', () => {
    render(<ShareButton />);
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('copies the app URL when there are no recordings', async () => {
    render(<ShareButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://froolamusic.com/');
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('copies the newest replay link when recordings exist', async () => {
    mockList.mockResolvedValue([
      { id: 'old1', createdAt: 1000, durationMs: 5000 },
      { id: 'new9', createdAt: 2000, durationMs: 8000 },
    ]);
    render(<ShareButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://froolamusic.com/replay?r=new9');
  });

  it('falls back to the app URL when the store rejects', async () => {
    mockList.mockRejectedValue(new Error('idb unavailable'));
    render(<ShareButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://froolamusic.com/');
  });

});
