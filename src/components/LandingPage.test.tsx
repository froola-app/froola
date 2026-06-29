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
  it('renders the tagline and both input choices', () => {
    render(<Harness />);
    expect(screen.getByText('play music with your hands')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable camera/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use (mouse|touch) instead/i })).toBeInTheDocument();
  });

  it('navigates to /play when enabling the camera', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /enable camera/i }));
    expect(screen.getByText('play shell')).toBeInTheDocument();
  });

  it('navigates to /play when choosing pointer input', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /use (mouse|touch) instead/i }));
    expect(screen.getByText('play shell')).toBeInTheDocument();
  });
});
