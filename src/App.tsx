import { Suspense, lazy } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import './App.css';

// Everything off the critical path (`/` is the instrument) loads on demand.
const ReplayShell = lazy(() => import('./components/ReplayShell'));
const SignInPage = lazy(() => import('./components/SignInPage'));
const OnboardingFlow = lazy(() => import('./components/onboarding/OnboardingFlow'));
const LessonCatalog = lazy(() => import('./components/learn/LessonCatalog'));
const LearnShell = lazy(() => import('./components/learn/LearnShell'));
const ReviewSession = lazy(() => import('./components/learn/ReviewSession'));

function AppRoutes() {
  const { user, profile, loading, firebaseReady } = useAuth();

  if (loading) return null;

  // Firebase not configured yet — skip auth and go straight to the app
  if (!firebaseReady) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/replay" element={<ReplayShell />} />
        <Route path="/learn" element={<LessonCatalog />} />
        <Route path="/learn/:lessonId" element={<LearnShell />} />
        <Route path="/learn/review" element={<ReviewSession />} />
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
      <Route path="/replay" element={<ReplayShell />} />
      <Route path="/learn" element={<LessonCatalog />} />
      <Route path="/learn/:lessonId" element={<LearnShell />} />
      <Route path="/learn/review" element={<ReviewSession />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </AuthProvider>
  );
}
