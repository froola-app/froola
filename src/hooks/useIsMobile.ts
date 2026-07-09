import { useEffect, useState } from 'react';

// Below this width the play HUD switches to its simplified mobile layout
// (see PlayShell.tsx) — matches phones, not tablets (iPad starts at 768px).
const MOBILE_BREAKPOINT = 700;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
