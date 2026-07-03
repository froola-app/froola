import '@testing-library/jest-dom';

// Node 22+ ships a built-in `globalThis.localStorage` that is unavailable
// (undefined) unless the process is started with `--localstorage-file`. That
// global shadows jsdom's `window.localStorage` for bare `localStorage`
// references, so tests calling `localStorage.clear()` throw. Point the global
// at jsdom's working Storage (falling back to a tiny in-memory stub).
if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== 'function') {
  const storage: Storage = window.localStorage ?? (() => {
    const map = new Map<string, string>();
    return {
      get length() { return map.size; },
      clear: () => map.clear(),
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
      key: (i: number) => Array.from(map.keys())[i] ?? null,
    } as Storage;
  })();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

// jsdom implements neither the canvas 2d context nor the FontFaceSet API.
// Several components (FroolaLogo) draw on mount, so provide
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

// jsdom doesn't implement matchMedia; some components query prefers-reduced-motion.
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
