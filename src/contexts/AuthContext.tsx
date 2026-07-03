import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseConfigured } from '../firebase';

export type UserType = 'casual' | 'creator' | 'learner' | null;

interface UserProfile {
  userType: UserType;
  onboardingComplete: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  firebaseReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  completeOnboarding: (userType: UserType) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    // loading is initialized to firebaseConfigured, and auth is only null when
    // Firebase isn't configured — so loading is already false here.
    if (!firebaseConfigured || !auth) return;
    return onAuthStateChanged(auth, async (firebaseUser) => {
      let nextProfile: UserProfile | null = null;
      if (firebaseUser && db) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          nextProfile = profileDoc.exists() ? (profileDoc.data() as UserProfile) : null;
        } catch {
          nextProfile = null;
        }
      }
      // Commit user + profile together so App.tsx's onboarding check never sees
      // a signed-in user with a stale/missing profile mid-fetch (would flash
      // an existing user through /onboarding on a mid-session sign-in).
      setUser(firebaseUser);
      setProfile(nextProfile);
      setLoading(false);
    });
  }, []);

  async function signInWithGoogle() {
    if (!auth) return;
    await signInWithPopup(auth, googleProvider);
  }

  async function signOutUser() {
    if (!auth) return;
    await signOut(auth);
  }

  async function completeOnboarding(userType: UserType) {
    if (!user || !db) return;
    const profileData: UserProfile = { userType, onboardingComplete: true };
    await setDoc(doc(db, 'users', user.uid), profileData);
    setProfile(profileData);
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      firebaseReady: firebaseConfigured,
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
