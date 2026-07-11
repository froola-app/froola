# Froola Design System

_Note: this describes the original editorial light-mode design language. The
shipped app now defaults to a dark liquid-glass theme (2026-07-08, see
`docs/DECISIONS.md`); light mode is still available via manual toggle and
still uses this palette. Treat this file as the light-theme/brand-identity
spec, not the current default._

## Direction

Editorial light mode. Single accent color. Typography does the heavy lifting.
Target audience: Gen Z. Aesthetic reference: Teenage Engineering / Figma marketing.

## Color

Canon is `tokens.json` — the table below is a convenience copy, keep it in sync.

| Token | Value | Use |
|-------|-------|-----|
| `bg` | `#FAFAF8` | Page background (warm white) |
| `text` | `#111111` | Body and display text |
| `accent` | `#D4500A` | Burnt orange — buttons, smile, highlights |
| `textMuted` | `#888888` | Secondary text, labels |
| `border` | `rgba(0,0,0,0.07)` | Dividers, card borders |

## Typography

- **Font:** DM Sans (Google Fonts)
- **Display / Logo:** weight 900
- **Body:** weight 400–500
- **Style:** No decorative gradients, no neon. Confident white space.

## Logo

Wordmark: **froola** in DM Sans 900, near-black.
A burnt orange (`#D4500A`) smile arc sits below the two o's.
The oo's read as eyes purely through implication — they are untouched.

Parameters (relative to font metrics at any size):
- Smile half-width: `0.38 × oWidth`
- Smile depth: `0.17 × oWidth`
- Smile stroke: `0.72 × baseStroke`
- Smile gap from oo bottom: `0.9 × baseStroke`

See `logo-preview.html` to render at any size.

## Files

| File | Description |
|------|-------------|
| `logo-preview.html` | Live logo at multiple sizes + dark/orange variants |
| `tokens.json` | Design tokens (colors, fonts, logo params) |
| `themes/v2-stark.html` | Chosen theme — editorial light mode |
| `themes/v2-editorial.html` | Split-layout editorial variant |
| `themes/v2-tactile.html` | Chrome header/footer variant |
