import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';

type Props = {
  signalRef: RefObject<GestureSignal[]>;
  guardrailRef: RefObject<boolean>;
};

export default function HandGuardrail({ signalRef, guardrailRef }: Props) {
  const [handsAbsent, setHandsAbsent] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      const signals = signalRef.current ?? [];
      const presentSignals = signals.filter(s => s.present);
      const noHands = presentSignals.length === 0;
      const tiltedHand = presentSignals.some(s => s.facingCamera === false);
      setHandsAbsent(noHands || tiltedHand);
    }, 80);
    return () => clearInterval(id);
  }, [signalRef]);

  if (!handsAbsent || guardrailRef.current === false) return null;

  return (
    <div className="hand-guardrail">
      <div className="hand-guardrail__hand hand-guardrail__hand--left">
        <img src="/hand.svg" alt="" />
      </div>
      <div className="hand-guardrail__hand hand-guardrail__hand--right">
        <img src="/hand.svg" alt="" />
      </div>
    </div>
  );
}
