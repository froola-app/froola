# Single play page — remove `/play`

_2026-07-02_

## Problem

The play experience has two entry points: the landing page at `/` swaps in
`PlayShell` in place (URL stays `/`), and a standalone `/play` route mounts
`PlayShell` with no input state. The learn screens navigate back to `/play`,
which lands users on the camera-permission screen again even though they
already chose an input mode this session.

## Design

`/` is the only play page. The chosen input mode is remembered per session.

1. **LandingPage** writes the chosen input mode to
   `sessionStorage['froola.inputMode']` when the user clicks Enable camera /
   Use mouse, and initializes its `input` state from that key on mount. If
   set, `/` renders `PlayShell` immediately — returning from `/learn` drops
   straight into the instrument (browser camera permission persists, so no
   re-prompt). A fresh tab still sees the landing hero.
2. **App.tsx** drops the `/play` route from both route tables. The existing
   `*` catch-all already redirects unknown paths (including old `/play`
   bookmarks) to `/`.
3. **Learn back-links** (`LessonCatalog`, `ReviewSession`,
   `CompletionScreen`) navigate to `/` instead of `/play`.
4. **PlayShell** drops its dead `location.state.input` fallback; it always
   receives `initialInput` as a prop from `LandingPage`.

`sessionStorage` over React context: it survives the unmount/remount caused
by the `/learn` round trip without a provider, and resets per tab so new
visitors get the landing page.

## Testing

- `LandingPage.test.tsx`: existing tests unchanged; new test — with
  `froola.inputMode` set in sessionStorage, `/` renders `PlayShell` without
  the hero.
- Manual: land → enable camera → Learn → back → straight into play.
