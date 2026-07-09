import { useEffect, useState } from 'react';
import { wheelGeometry } from '../engine/renderer/geometry';

// Two frosted-glass discs sitting under the wheel graphics that .main-canvas
// draws on top of. Pure decoration — backdrop-filter needs its own DOM
// element (canvas can't sample the video element behind it), so this mirrors
// wheelGeometry() as CSS custom properties rather than duplicating layout.
export default function GlassDials() {
  const [geo, setGeo] = useState(() => wheelGeometry(window.innerWidth, window.innerHeight));

  useEffect(() => {
    function onResize() {
      setGeo(wheelGeometry(window.innerWidth, window.innerHeight));
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pad = 6;
  const size = (geo.outerR + pad) * 2;

  return (
    <>
      <div
        className="glass-dial glass-dial--ready"
        style={{
          '--gd-size': `${size}px`,
          '--gd-x': `${geo.leftCx - size / 2}px`,
          '--gd-y': `${geo.leftCy - size / 2}px`,
        } as React.CSSProperties}
      />
      <div
        className="glass-dial glass-dial--ready"
        style={{
          '--gd-size': `${size}px`,
          '--gd-x': `${geo.rightCx - size / 2}px`,
          '--gd-y': `${geo.rightCy - size / 2}px`,
        } as React.CSSProperties}
      />
    </>
  );
}
