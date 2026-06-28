import type { UserType } from '../../contexts/AuthContext';

interface Props {
  onSelect: (type: UserType) => void;
}

const OPTIONS: { type: UserType; emoji: string; label: string; description: string }[] = [
  { type: 'casual',  emoji: '🎵', label: 'Just for fun',     description: 'I want to mess around and see what happens' },
  { type: 'creator', emoji: '🎬', label: 'Content creator',  description: "I'm making videos, streams, or social content" },
  { type: 'learner', emoji: '🎹', label: 'Learning music',   description: "I'm exploring music and want to build intuition" },
];

export default function UserTypeStep({ onSelect }: Props) {
  return (
    <div className="onboarding-step">
      <p className="onboarding-eyebrow">Welcome</p>
      <h2 className="onboarding-title">How will you use Froola?</h2>
      <p className="onboarding-subtitle">We'll tune the experience to fit.</p>
      <div className="user-type-grid">
        {OPTIONS.map(({ type, emoji, label, description }) => (
          <button
            key={type}
            className="user-type-card"
            onClick={() => onSelect(type)}
          >
            <span className="user-type-emoji">{emoji}</span>
            <span className="user-type-text">
              <span className="user-type-label">{label}</span>
              <span className="user-type-description">{description}</span>
            </span>
            <span className="user-type-arrow" aria-hidden>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
