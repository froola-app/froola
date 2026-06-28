import { useAuth } from '../contexts/AuthContext';

export default function SignInPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="landing-screen">
      <img src="/favicon.svg" alt="Froola" className="landing-logo" />
      <h1 className="landing-title">froola</h1>
      <p className="landing-tagline">play music with your hands</p>
      <button className="btn-google" onClick={signInWithGoogle}>
        <img src="/google-logo.svg" alt="" width={18} height={18} />
        Continue with Google
      </button>
      <p className="signin-note">Your camera never leaves your device.</p>
    </div>
  );
}
