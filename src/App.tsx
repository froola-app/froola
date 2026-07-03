import { Suspense, lazy } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import './App.css';

// Everything off the critical path (`/` is the instrument) loads on demand.
const ReplayShell = lazy(() => import('./components/ReplayShell'));
const OnboardingFlow = lazy(() => import('./components/onboarding/OnboardingFlow'));
const LessonCatalog = lazy(() => import('./components/learn/LessonCatalog'));
const LearnShell = lazy(() => import('./components/learn/LearnShell'));
const ReviewSession = lazy(() => import('./components/learn/ReviewSession'));

function AppRoutes() {
  const { user, profile, loading, authReady } = useAuth();

  if (loading) return null;

  // Supabase not configured yet — skip auth and go straight to the app
  if (!authReady) {
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

  // Signed in but hasn't finished onboarding
  if (user && !profile?.onboardingComplete) {
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
