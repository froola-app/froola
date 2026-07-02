# Froola — Marketing & Product Strategy

## What Makes Froola Special

- **Zero friction**: no download, no account, no instrument required — just open a browser and play
- **The wow moment**: hand tracking via camera is visually magical and immediately shareable
- **Privacy by default**: MediaPipe runs entirely on-device, no video is ever transmitted — this is a genuine trust differentiator and should be said loudly
- **Mouse fallback**: lowers the barrier to entry for users who aren't ready to grant camera access

---

## Target Audiences

### 1. Curious Casuals
People who encounter Froola via a share link or social post and try it on impulse.

- **Goal**: get them to the wow moment in under 30 seconds
- **Key lever**: frictionless entry (no signup, mouse mode as instant fallback)
- **Conversion path**: play → share → their friends become new casuals
- **How to reach them**: viral shares, TikTok/Reels, Twitter/X embeds

### 2. Content Creators & Streamers
YouTubers, TikTokers, Twitch streamers who want novel, visually interesting content.

- **Goal**: make Froola a recurring tool in their content stack
- **Key lever**: the visual of hands controlling music is inherently watchable — it's a performance
- **Conversion path**: free use → hit recording/watermark limits → upgrade for clean exports
- **How to reach them**: creator outreach, OBS/streaming integration, no-watermark as paid perk

### 3. Music Learners & Kids
People who want to feel like they're making music without knowing how to play an instrument.

- **Goal**: make music feel accessible and fun with no skill floor
- **Key lever**: multiple instrument modes (piano, guitar, synth, pad) give variety; low stakes = high play
- **Conversion path**: free play → want to save/share performances → upgrade
- **How to reach them**: education communities, parent/teacher word of mouth, app stores if we go native

---

## Free vs. Paid Features

### At a Glance

| Feature | Free | Paid |
|---|---|---|
| All instrument modes (synth, piano, guitar, pad) | ✅ | ✅ |
| Camera mode (hand tracking) | ✅ | ✅ |
| Mouse mode | ✅ | ✅ |
| Recordings | up to 60 seconds | unlimited |
| Share links | ✅ with watermark | ✅ watermark-free |
| Audio download (MP3/WAV) | ❌ | ✅ |
| Additional instrument & sound packs | ❌ | ✅ |
| Loop & layer tracks | ❌ | ✅ |
| Custom visual themes | ❌ | ✅ |
| MIDI export | ❌ | ✅ |
| Embed (iframe) | ❌ | ✅ |

---

### Free Tier — Details
Everything needed to experience the core magic, no account required:
- Full play experience across all four instrument modes
- Camera mode (hand tracking, fully on-device) and mouse mode
- Recordings up to 60 seconds
- Share links that work — replays load for anyone with the link, with a "Made with Froola" watermark on the replay page

### Paid Tier — Details
For creators, musicians, and anyone who wants to go deeper:
- **Unlimited recordings** — no time cap
- **Audio download** — export any recording as MP3 or WAV to use in other apps
- **Watermark-free shares** — clean replay links and iframes with no Froola branding
- **More instruments & sound packs** — additional timbres, genres, experimental sounds beyond the core four
- **Loop & layer** — record a loop, then play live over it to build up a track
- **Custom visual themes** — change canvas colors, particle styles, backgrounds
- **MIDI export** — bring performances into a DAW like Ableton or GarageBand
- **Embed (iframe)** — drop a Froola replay into any website, blog, or Notion page

### The Watermark Play
"Made with Froola" on free share links is a dual-purpose mechanic:
- Every share is an organic ad — new viewers click through and become users
- Power users (creators, musicians) who want clean output have a clear reason to pay
- Precedent: Canva, CapCut, and most creative tools use this effectively

---

## Onboarding

### The Camera Permission Problem
The camera permission prompt is the highest drop-off risk in the funnel. Users see a browser permission dialog asking for camera access before they've seen anything exciting.

**Solutions:**
1. **Show before you ask** — put a short looping video/GIF on the landing page of someone's hands playing, so users know exactly what they're signing up for before they click Play
2. **Mouse-first default** — make mouse mode the default entry point; camera becomes an upgrade ("try the real thing →") once they're already engaged
3. **Reassure proactively** — keep "Your camera never leaves your device" prominent on the permission screen; add a one-liner explaining MediaPipe is open-source and runs locally
4. **Permission screen preview** — show a blurred/demo animation behind the permission prompt so users can see what's about to happen

### First-Play Tutorial
New users don't know what gestures trigger what sounds. Ideas:
- A brief animated overlay on first play showing hand positions (can be dismissed)
- A "hint" mode that highlights which hand zones are active
- An optional interactive tutorial route (`/learn`) before the main play screen

### Returning Users
- Remember instrument preference in localStorage
- Skip the camera prompt if they've already granted permission
- Show a "your last session" nudge if they have an unsaved recording

---

## Virality & Growth Loops

### Share Links
Every recording generates a share link → `/replay?id=...`. This is the core growth loop:
- Viewer watches the replay
- Sees "Made with Froola" (free tier) or clean branding (paid)
- Clicks through to the landing page
- Tries it themselves

**To strengthen this loop:**
- Make the replay page beautiful and performant (fast load, looks great on mobile)
- Add a "Try it yourself →" CTA button on every replay page
- Consider embedding: allow iframes so creators can embed performances in blog posts, Notion, etc.

### Social Sharing
- Add one-click share to TikTok, Instagram, Twitter/X from the recording screen
- Generate a short video clip (canvas recording + audio) for platforms that don't support links well
- "Duet" mechanic: share a replay and invite someone to play along (longer-term)

### Referral / Creator Program
- Creators who drive signups get extended free tier or revenue share
- Affiliate link: `froola.app?ref=creatorname` that tracks conversions

---

## Monetization Models

### Option A: Freemium (Recommended)
- Free tier as described above
- Paid tier at ~$5–8/month or ~$40/year
- Works well because the free tier is genuinely useful and the paid upgrades are clearly valuable to power users

### Option B: Pay-per-export
- Playing is always free
- Charge per audio download or per watermark-free share link
- Lower commitment for casual users; good for creators who only need it occasionally
- Risk: feels transactional, can suppress sharing behavior

### Option C: One-time Purchase
- Buy "Froola Pro" once for a flat fee
- Simple, no subscription fatigue
- Harder to sustain for ongoing development

### Option D: Free + Brand/Licensing
- Keep everything free for individuals
- Charge businesses, schools, or platforms that want to embed or white-label Froola
- Works if the B2B use case (music education, live events, interactive installations) is real

---

## Near-Term Priorities

1. **Nail the replay page** — it's the viral entry point; it needs to load fast, look great, and have a clear CTA
2. **Add the landing page video/GIF** — reduces camera permission drop-off before any code changes to the flow
3. **Instrument mode expansion** — more sound packs are a natural paid unlock and increase replayability
4. **Recording download** — the most requested feature from any "I made something cool" user; also a clean paid gate
