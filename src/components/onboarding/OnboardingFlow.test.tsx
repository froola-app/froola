import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import OnboardingFlow from './OnboardingFlow';

function renderFlow() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <OnboardingFlow />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('OnboardingFlow', () => {
  it('shows the first step immediately, with no read-gate cooldown', () => {
    renderFlow();
    expect(screen.getByText('How will you use Froola?')).toBeInTheDocument();
    // The old cooldown dimmed the whole step and blocked clicks; it's gone now.
    expect(document.querySelector('.onboarding-main.is-cooling-down')).toBeNull();
  });

  it('advances through the steps as the user clicks', () => {
    renderFlow();

    // Step 1 → 2: picking a user type is clickable right away.
    fireEvent.click(screen.getByText('Just for fun'));
    expect(screen.getByText('A quick heads-up')).toBeInTheDocument();

    // Step 2 → 3.
    fireEvent.click(screen.getByText('Got it →'));
    expect(
      screen.getByText("Free forever, upgrade when you're ready")
    ).toBeInTheDocument();
    expect(screen.getByText('Start playing →')).toBeInTheDocument();
  });

  it('renders a theme toggle in the header', () => {
    renderFlow();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
});
