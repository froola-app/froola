import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';

function Harness() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<div>play shell</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LandingPage', () => {
  it('renders title and tagline', () => {
    render(<Harness />);
    expect(screen.getByText('froola')).toBeInTheDocument();
    expect(screen.getByText('play music with your hands')).toBeInTheDocument();
  });

  it('navigates to /play on button click', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(screen.getByText('play shell')).toBeInTheDocument();
  });
});
