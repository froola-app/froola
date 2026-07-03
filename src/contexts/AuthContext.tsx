import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../supabase';

export type UserType = 'casual' | 'creator' | 'learner' | null;

// App-owned user shape — keeps components decoupled from the SDK's type.
export interface AppUser {
  id: string;
  displayName: string | null;
}

interface UserProfile {
  userType: UserType;
  onboardingComplete: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  authReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  completeOnboarding: (userType: UserType) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAppUser(session: Session | null): AppUser | null {
  if (!session) return null;
  const meta = session.user.user_metadata as Record<string, unknown>;
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null;
  return { id: session.user.id, displayName };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    // Fetch the profile BEFORE committing user + profile together, so the
    // onboarding check in App.tsx never sees a signed-in user with a
    // missing profile mid-fetch (would flash an existing user through
    // /onboarding on a mid-session sign-in).
    async function handleSession(session: Session | null) {
      const nextUser = toAppUser(session);
      let nextProfile: UserProfile | null = null;
      if (nextUser && supabase) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('user_type, onboarding_complete')
            .eq('id', nextUser.id)
            .maybeSingle();
          if (data) {
            nextProfile = {
              userType: (data.user_type ?? null) as UserType,
              onboardingComplete: !!data.onboarding_complete,
            };
          }
        } catch { /* profile stays null */ }
      }
      if (cancelled) return;
      setUser(nextUser);
      setProfile(nextProfile);
      setLoading(false);
    }

    void supabase.auth.getSession().then(({ data }) => handleSession(data.session));

    // The SDK warns against awaiting other client calls inside this
    // callback (internal lock can deadlock) — defer to a macrotask.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setTimeout(() => { void handleSession(session); }, 0);
      },
    );

    // The OAuth popup pings us when it finishes; cross-tab storage sync
    // usually fires onAuthStateChange too, but don't rely on it alone.
    function onMessage(e: MessageEvent) {
      if (e.origin === window.location.origin && e.data === 'froola:signed-in') {
        void supabase?.auth.getSession().then(({ data }) => handleSession(data.session));
      }
    }
    window.addEventListener('message', onMessage);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener('message', onMessage);
    };
  }, []);

  async function signInWithGoogle() {
    if (!supabase) return;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: `${window.location.origin}/auth/popup`,
      },
    });
    if (error || !data.url) throw error ?? new Error('no oauth url');
    const popup = window.open(data.url, 'froola-signin', 'popup,width=500,height=650');
    if (!popup) throw new Error('popup blocked');
  }

  async function signOutUser() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function completeOnboarding(userType: UserType) {
    if (!user || !supabase) return;
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      user_type: userType,
      onboarding_complete: true,
    });
    if (!error) setProfile({ userType, onboardingComplete: true });
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authReady: supabaseConfigured,
      signInWithGoogle,
      signOutUser,
      completeOnboarding,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Context + hook intentionally live together; a hook export is fine to lose
// fast-refresh state over, and splitting files would force exporting the raw
// context (which this rule also flags).
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
