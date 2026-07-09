import { useEffect, type RefObject } from 'react';
import type { InputMode } from '../engine/input';

/* The HUD floats over the live camera feed, so its readability depends on
   whatever is behind it — a dark room one minute, a sunlit white wall the
   next. This hook samples the feed at a tiny resolution, measures perceived
   brightness where the controls actually sit (top strip: corner buttons,
   bottom strip: the control row), and flags each zone on <html> as
   data-hud-top / data-hud-bottom = "light" | "dark". App.css swaps the
   glass ink/fill/stroke variables off those attributes. */

const SAMPLE_W = 32;
const SAMPLE_H = 18;
const SAMPLE_INTERVAL_MS = 400;

/* Hysteresis: flip to "light" only above ENTER, back to "dark" only below
   EXIT. The gap stops the HUD from strobing when the scene hovers around
   the threshold (e.g. a hand waving through frame). */
const LIGHT_ENTER = 0.58;
const LIGHT_EXIT = 0.46;

export type HudZone = 'top' | 'bottom';

/** Mean perceived luminance (0–1, Rec. 601 weights) of a horizontal band. */
function bandLuminance(
  data: Uint8ClampedArray, width: number, rowStart: number, rowEnd: number,
): number {
  let sum = 0;
  let count = 0;
  for (let y = rowStart; y < rowEnd; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
  }
  return count ? sum / count / 255 : 0;
}

function nextState(lum: number, current: string | null): 'light' | 'dark' {
  if (current === 'light') return lum < LIGHT_EXIT ? 'dark' : 'light';
  return lum > LIGHT_ENTER ? 'light' : 'dark';
}

export function useAmbientLuminance(
  videoRef: RefObject<HTMLVideoElement | null>,
  mode: InputMode,
) {
  useEffect(() => {
    const root = document.documentElement;

    // The asking (permission) screen renders on the app's dark background;
    // no sampling needed until the camera feed is live.
    if (mode !== 'camera') {
      root.removeAttribute('data-hud-top');
      root.removeAttribute('data-hud-bottom');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    // willReadFrequently keeps the canvas on the CPU path — we read every frame we draw.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || document.hidden) return;
      try {
        ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
      } catch {
        return; // frame not decodable yet
      }
      const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
      const topLum = bandLuminance(data, SAMPLE_W, 0, Math.round(SAMPLE_H * 0.3));
      const bottomLum = bandLuminance(data, SAMPLE_W, Math.round(SAMPLE_H * 0.65), SAMPLE_H);
      root.setAttribute('data-hud-top', nextState(topLum, root.getAttribute('data-hud-top')));
      root.setAttribute('data-hud-bottom', nextState(bottomLum, root.getAttribute('data-hud-bottom')));
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      root.removeAttribute('data-hud-top');
      root.removeAttribute('data-hud-bottom');
    };
  }, [videoRef, mode]);
}
