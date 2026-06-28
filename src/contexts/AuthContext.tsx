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
    if (!firebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && db) {
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        setProfile(profileDoc.exists() ? (profileDoc.data() as UserProfile) : null);
      } else {
        setProfile(null);
      }
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
