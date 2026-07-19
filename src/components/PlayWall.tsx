import FroolaLogo from './brand/FroolaLogo';
import { GoogleButton, EmailSignIn } from './account/AuthMethods';

export default function PlayWall() {
  return (
    <div className="play-wall" role="dialog" aria-modal="true" aria-label="Sign up to keep playing">
      <div className="play-wall__card">
        <FroolaLogo size={56} />
        <h1 className="play-wall__title">Keep playing — sign up free</h1>
        <p className="play-wall__body">
          Your free trial just ended. Create a free account to keep playing froola.
        </p>
        <div className="play-wall__actions">
          <GoogleButton />
          <div className="signin-prompt__divider">or</div>
          <EmailSignIn />
        </div>
      </div>
    </div>
  );
}
