import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Mp3Panel from './Mp3Panel';
import { listMp3s, getMp3Blob, deleteMp3 } from '../../engine/recording/mp3Store';

vi.mock('../../engine/recording/mp3Store', () => ({
  listMp3s: vi.fn(),
  getMp3Blob: vi.fn(),
  deleteMp3: vi.fn(),
}));

const META = [
  { id: 'a', createdAt: new Date('2026-07-13T12:00:00').getTime(), durationMs: 65_000 },
  { id: 'b', createdAt: new Date('2026-07-12T12:00:00').getTime(), durationMs: 4_000 },
];

describe('Mp3Panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listMp3s).mockResolvedValue(META);
  });

  it('shows an empty-state note when there are no exports', async () => {
    vi.mocked(listMp3s).mockResolvedValue([]);
    render(<Mp3Panel open />);
    expect(await screen.findByText(/record an mp3 on the play screen/i)).toBeInTheDocument();
  });

  it('lists stored exports with date and duration when open', async () => {
    render(<Mp3Panel open />);
    expect(await screen.findByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('0:04')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Download' })).toHaveLength(2);
  });

  it('does not load the list while closed', () => {
    render(<Mp3Panel open={false} />);
    expect(listMp3s).not.toHaveBeenCalled();
  });

  it('downloads the blob for a row', async () => {
    vi.mocked(getMp3Blob).mockResolvedValue(new Blob(['x'], { type: 'audio/mpeg' }));
    const createUrl = vi.fn(() => 'blob:fake');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }));
    let filename: string | null = null;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });

    render(<Mp3Panel open />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Download' }))[0]);

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(getMp3Blob).toHaveBeenCalledWith('a');
    expect(filename).toBe('froola-2026-07-13-1200.mp3');
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake');
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('deletes a row on success', async () => {
    vi.mocked(deleteMp3).mockResolvedValue(true);
    render(<Mp3Panel open />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete MP3' }))[0]);
    await waitFor(() => expect(screen.queryByText('1:05')).not.toBeInTheDocument());
    expect(deleteMp3).toHaveBeenCalledWith('a');
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });
});
