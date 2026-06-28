import { Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import PlayShell from './components/PlayShell';
import ReplayShell from './components/ReplayShell';
import SignInPage from './components/SignInPage';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import './App.css';

function AppRoutes() {
  const { user, profile, loading, firebaseReady } = useAuth();

  if (loading) return null;

  // Firebase not configured yet — skip auth and go straight to the app
  if (!firebaseReady) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<PlayShell />} />
        <Route path="/replay" element={<ReplayShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Not signed in → show sign-in page (replay is always public)
  if (!user) {
    return (
      <Routes>
        <Route path="/replay" element={<ReplayShell />} />
        <Route path="*" element={<SignInPage />} />
      </Routes>
    );
  }

  // Signed in but hasn't finished onboarding
  if (!profile?.onboardingComplete) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<PlayShell />} />
      <Route path="/replay" element={<ReplayShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
