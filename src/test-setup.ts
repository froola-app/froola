import '@testing-library/jest-dom';

// jsdom implements neither the canvas 2d context nor the FontFaceSet API.
// Several components (FroolaLogo, useLandingCanvas) draw on mount, so provide
// lightweight stubs to keep them from throwing during tests.
const ctxStub = new Proxy(
  {},
  {
    get: (_t, prop) => {
      if (prop === 'measureText')
        return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set: () => true,
  },
);

HTMLCanvasElement.prototype.getContext = (() => ctxStub) as unknown as HTMLCanvasElement['getContext'];

if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
}

// jsdom doesn't implement matchMedia; useLandingCanvas queries prefers-reduced-motion.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
