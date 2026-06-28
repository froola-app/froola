interface Props {
  onContinue: () => void;
}

const TIPS = [
  { icon: '✋', text: 'Hold your hand flat and open in front of the camera to start playing' },
  { icon: '↕️', text: 'Move your hand up and down to change the note' },
  { icon: '↔️', text: 'Move left and right to change the chord or quality' },
  { icon: '🖱️', text: 'No camera? Mouse mode works too — just move your cursor around the canvas' },
];

export default function LearningCurveStep({ onContinue }: Props) {
  return (
    <div className="onboarding-step">
      <h2 className="onboarding-title">A quick heads-up</h2>
      <p className="onboarding-subtitle">
        Froola takes about 2 minutes to click. Here's what to know before you start.
      </p>
      <ul className="tips-list">
        {TIPS.map(({ icon, text }) => (
          <li key={icon} className="tip-item">
            <span className="tip-icon">{icon}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <button className="btn-primary" onClick={onContinue}>
        Got it →
      </button>
    </div>
  );
}
