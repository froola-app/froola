import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../supabase';

export type UserType = 'casual' | 'creator' | 'learner' | null;

// Mirrors profiles.plan (docs/PRICING.md tiers); 'free' is the DB default
// so it covers users who signed up before billing existed too.
export type Plan = 'free' | 'plus' | 'studio';

// App-owned user shape — keeps components decoupled from the SDK's type.
export interface AppUser {
  id: string;
  displayName: string | null;
  email: string | null;
  /** Provider photo (Google account picture). */
  avatarUrl: string | null;
}

interface UserProfile {
  userType: UserType;
  onboardingComplete: boolean;
  /** Custom photo the user uploaded — overrides the provider photo.
      Always null until the profiles table grows an avatar_url column
      and an upload flow exists; the UI fallback chain already handles it. */
  avatarUrl: string | null;
  plan: Plan;
  /** Raw Stripe subscription status (e.g. 'trialing', 'past_due',
      'canceled') — null if never subscribed. `plan` already reflects
      whether access should be paid or free; this is for UI copy only
      (e.g. showing a "past due" warning). */
  subscriptionStatus: string | null;
}

interface AuthContextValue {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  authReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
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
  // Google puts the account photo in avatar_url (Supabase's normalized
  // key) and/or picture (the raw OIDC claim).
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null;
  return {
    id: session.user.id,
    displayName,
    email: session.user.email ?? null,
    avatarUrl,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    // Selecting a column that doesn't exist yet fails the whole PostgREST
    // query (data comes back null), which would null the profile and
    // re-run onboarding — so the billing columns are tried first and this
    // falls back to the pre-billing column set if migration
    // 0002_billing.sql hasn't been applied to this Supabase project yet
    // (see supabase/migrations conventions: not auto-applied).
    async function fetchProfileRow(userId: string): Promise<{
      user_type: string | null;
      onboarding_complete: boolean;
      plan?: string | null;
      subscription_status?: string | null;
    } | null> {
      if (!supabase) return null;
      const full = await supabase
        .from('profiles')
        .select('user_type, onboarding_complete, plan, subscription_status')
        .eq('id', userId)
        .maybeSingle();
      if (!full.error) return full.data;
      const base = await supabase
        .from('profiles')
        .select('user_type, onboarding_complete')
        .eq('id', userId)
        .maybeSingle();
      return base.error ? null : base.data;
    }

    // Fetch the profile BEFORE committing user + profile together, so the
    // onboarding check in App.tsx never sees a signed-in user with a
    // missing profile mid-fetch (would flash an existing user through
    // /onboarding on a mid-session sign-in).
    async function handleSession(session: Session | null) {
      const nextUser = toAppUser(session);
      let nextProfile: UserProfile | null = null;
      if (nextUser && supabase) {
        try {
          const data = await fetchProfileRow(nextUser.id);
          if (data) {
            nextProfile = {
              userType: (data.user_type ?? null) as UserType,
              onboardingComplete: !!data.onboarding_complete,
              // Not selected above on purpose: asking PostgREST for a
              // column that doesn't exist yet fails the whole query,
              // which would null the profile and re-run onboarding.
              // Add avatar_url to the select once the column ships.
              avatarUrl: null,
              plan: (data.plan ?? 'free') as Plan,
              subscriptionStatus: data.subscription_status ?? null,
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

  async function signInWithEmail(email: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/popup` },
    });
    if (error) throw error;
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
    if (!error) {
      setProfile(prev => ({
        userType,
        onboardingComplete: true,
        avatarUrl: null,
        plan: prev?.plan ?? 'free',
        subscriptionStatus: prev?.subscriptionStatus ?? null,
      }));
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authReady: supabaseConfigured,
      signInWithGoogle,
      signInWithEmail,
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
