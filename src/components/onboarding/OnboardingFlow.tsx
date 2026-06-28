import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserType } from '../../contexts/AuthContext';
import UserTypeStep from './UserTypeStep';
import LearningCurveStep from './LearningCurveStep';
import PricingStep from './PricingStep';

type Step = 'user-type' | 'learning-curve' | 'pricing';

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('user-type');
  const [selectedType, setSelectedType] = useState<UserType>(null);
  const { completeOnboarding } = useAuth();
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
    navigate('/play');
  }

  return (
    <div className="onboarding-shell">
      {step === 'user-type' && (
        <UserTypeStep onSelect={handleUserTypeSelect} />
      )}
      {step === 'learning-curve' && (
        <LearningCurveStep onContinue={handleLearningCurveContinue} />
      )}
      {step === 'pricing' && (
        <PricingStep onContinue={handlePricingContinue} />
      )}
    </div>
  );
}
