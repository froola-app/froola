// A consistent "this is paid" marker: every gated control shows this in its
// resting state so nothing looks free that isn't (owner: no bait).
export default function LockBadge({ tier = 'plus' }: { tier?: 'plus' | 'studio' }) {
  return <span className="lock-chip" aria-label={`Requires ${tier}`}>{tier}</span>;
}
