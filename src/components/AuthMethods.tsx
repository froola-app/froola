import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function GoogleButton({ onDone }: { onDone?: () => void }) {
  const { signInWithGoogle } = useAuth();
  return (
    <button
      className="signin-prompt__google"
      onClick={() => {
        signInWithGoogle()
          .then(() => onDone?.())
          .catch(() => { /* popup blocked or closed — button stays for retry */ });
      }}
    >
      <img src="/google-logo.svg" alt="" width={16} height={16} />
      Continue with Google
    </button>
  );
}

type EmailSignInStatus = 'idle' | 'sending' | 'sent';

export function EmailSignIn() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<EmailSignInStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  if (status === 'sent') {
    return (
      <p className="signin-prompt__email-sent">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form
      className="signin-prompt__email-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setStatus('sending');
        signInWithEmail(email)
          .then(() => setStatus('sent'))
          .catch(() => {
            setStatus('idle');
            setError("Couldn't send the link. Try again.");
          });
      }}
    >
      <input
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        value={email}
        disabled={status === 'sending'}
        onChange={(e) => setEmail(e.target.value)}
        className="signin-prompt__email-input"
      />
      <button
        type="submit"
        className="signin-prompt__email-submit"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {error && <p className="signin-prompt__email-error">{error}</p>}
    </form>
  );
}
