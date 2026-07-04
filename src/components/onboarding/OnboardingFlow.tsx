import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserType } from '../../contexts/AuthContext';
import { useTheme } from '../../useTheme';
import FroolaLogo from '../FroolaLogo';
import ThemeToggle from '../ThemeToggle';
import UserTypeStep from './UserTypeStep';
import LearningCurveStep from './LearningCurveStep';
import PricingStep from './PricingStep';

type Step = 'user-type' | 'learning-curve' | 'pricing';

const ORDER: Step[] = ['user-type', 'learning-curve', 'pricing'];

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('user-type');
  const [selectedType, setSelectedType] = useState<UserType>(null);
  const { completeOnboarding } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleUserTypeSelect(type: UserType) {
    setSelectedType(type);
    setStep('learning-curve');
  }

  function handleLearningCurveContinue() {
    setStep('pricing');
  }

  async function handlePricingContinue() {
    await completeOnboarding(selectedType);
    navigate('/');
  }

  const stepIndex = ORDER.indexOf(step);
  const inkColor = theme === 'dark' ? '#f5f5f7' : '#1d1d1f';

  return (
    <div className="onboarding-shell" data-theme={theme}>
      <header className="onboarding-header">
        <FroolaLogo size={40} color={inkColor} />
        <div className="onboarding-header__end">
          <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${ORDER.length}`}>
            {ORDER.map((s, i) => (
              <span
                key={s}
                className={
                  'onboarding-progress__dot' +
                  (i === stepIndex ? ' is-active' : i < stepIndex ? ' is-done' : '')
                }
              />
            ))}
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="onboarding-main">
        {step === 'user-type' && (
          <UserTypeStep onSelect={handleUserTypeSelect} />
        )}
        {step === 'learning-curve' && (
          <LearningCurveStep onContinue={handleLearningCurveContinue} />
        )}
        {step === 'pricing' && (
          <PricingStep onContinue={handlePricingContinue} />
        )}
      </main>
    </div>
  );
}
