import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('OnboardingFlow — cooldown between steps', () => {
  it('disables the step content immediately after it mounts', () => {
    renderFlow();
    expect(document.querySelector('.onboarding-main.is-cooling-down')).toBeInTheDocument();
  });

  it('enables the step content after the cooldown elapses', () => {
    renderFlow();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(document.querySelector('.onboarding-main.is-cooling-down')).not.toBeInTheDocument();
  });

  it('re-applies the cooldown when advancing to the next step', () => {
    renderFlow();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(document.querySelector('.onboarding-main.is-cooling-down')).not.toBeInTheDocument();

    act(() => { fireEvent.click(screen.getByText('Just for fun')); });

    expect(document.querySelector('.onboarding-main.is-cooling-down')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(document.querySelector('.onboarding-main.is-cooling-down')).not.toBeInTheDocument();
  });
});
