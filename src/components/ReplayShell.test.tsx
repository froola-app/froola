import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../test-utils/webAudioMock';
import { encode } from '../engine/recording/codec';
import { fetchRecording } from '../engine/recording/recordingStore';
import type { Recording } from '../engine/types';
import ReplayShell from './ReplayShell';

vi.mock('../engine/recording/recordingStore', () => ({ fetchRecording: vi.fn() }));
const mockFetchRecording = vi.mocked(fetchRecording);

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/replay${search}`]}>
      <ReplayShell />
    </MemoryRouter>
  );
}

describe('ReplayShell', () => {
  it('shows the invalid-link UI when ?d= is missing', () => {
    renderAt('');
    expect(screen.getByText(/replay link is invalid/i)).toBeInTheDocument();
  });

  it('shows the invalid-link UI when ?d= is corrupt', () => {
    renderAt('?d=not-valid-base64-payload!!!');
    expect(screen.getByText(/replay link is invalid/i)).toBeInTheDocument();
  });

  it('renders playback controls for a valid recording', () => {
    const recording: Recording = {
      samples: [{ dt: 100, noteIdx: 2, qualityIdx: 1, vibe: 0 }],
      totalMs: 100,
    };
    renderAt(`?d=${encode(recording)}`);
    expect(screen.getByRole('button', { name: '▶ Play' })).toBeInTheDocument();
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });

  it('fetches a stored recording for a ?r= link', async () => {
    const recording: Recording = {
      samples: [{ dt: 100, noteIdx: 2, qualityIdx: 1, vibe: 0 }],
      totalMs: 100,
    };
    mockFetchRecording.mockResolvedValue(encode(recording));
    renderAt('?r=aBcDeFgHiJ');
    expect(await screen.findByRole('button', { name: '▶ Play' })).toBeInTheDocument();
    expect(mockFetchRecording).toHaveBeenCalledWith('aBcDeFgHiJ');
  });

  it('shows the invalid-link UI when a ?r= id is unknown', async () => {
    mockFetchRecording.mockResolvedValue(null);
    renderAt('?r=0000000000');
    expect(await screen.findByText(/replay link is invalid/i)).toBeInTheDocument();
  });
});
