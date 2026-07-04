import { Suspense, lazy } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { storedInputMode } from './engine/input';
import LandingPage from './components/LandingPage';
import './App.css';

// `/` is the marketing page; the instrument and everything else off the
// critical path load on demand.
const PlayShell = lazy(() => import('./components/PlayShell'));
const ReplayShell = lazy(() => import('./components/ReplayShell'));
const AuthPopup = lazy(() => import('./components/AuthPopup'));
const OnboardingFlow = lazy(() => import('./components/onboarding/OnboardingFlow'));
const PricingPage = lazy(() => import('./components/PricingPage'));
const LessonCatalog = lazy(() => import('./components/learn/LessonCatalog'));
const LearnShell = lazy(() => import('./components/learn/LearnShell'));
const ReviewSession = lazy(() => import('./components/learn/ReviewSession'));

function AppRoutes() {
  const { user, profile, loading, authReady } = useAuth();
  const location = useLocation();

  // The OAuth popup window lands here mid-sign-in. Render its completer
  // ahead of every gate below — the loading blank and the onboarding
  // redirect would otherwise unmount it before it can notify the opener
  // and close itself.
  if (location.pathname === '/auth/popup') return <AuthPopup />;

  if (loading) return null;

  // Supabase not configured yet — skip auth and go straight to the app
  if (!authReady) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<PlayShell initialInput={storedInputMode() ?? 'asking'} />} />
        <Route path="/replay" element={<ReplayShell />} />
        <Route path="/learn" element={<LessonCatalog />} />
        <Route path="/learn/:lessonId" element={<LearnShell />} />
        <Route path="/learn/review" element={<ReviewSession />} />
        <Route path="/pricing" element={<PricingPage />} />
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
      <Route path="/play" element={<PlayShell initialInput={storedInputMode() ?? 'asking'} />} />
      <Route path="/replay" element={<ReplayShell />} />
      <Route path="/learn" element={<LessonCatalog />} />
      <Route path="/learn/:lessonId" element={<LearnShell />} />
      <Route path="/learn/review" element={<ReviewSession />} />
      <Route path="/pricing" element={<PricingPage />} />
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
