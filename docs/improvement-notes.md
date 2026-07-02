# App Improvement Notes
_2026-07-01_

## Lessons — why people get confused

1. **Preview phase isn't obviously "listen and watch."** There's no text saying "here's what you're about to play" — users don't know if it's a tutorial or if they're supposed to be doing something. Many probably sit there waiting for instructions instead of paying attention to the ghost orbs.

2. **Ghost orbs don't connect to the wheel slices.** The orbs show a position but don't highlight which labeled slice (C, G, Am, etc.) they're in. A first-timer can't read "orb in the upper-left ring = C major" without that label being shown during the attempt.

3. **The score breakdown uses jargon.** "Note accuracy" and "chord quality accuracy" means nothing to someone who doesn't know the two-wheel system yet. It should say something like "left hand (chord)" and "right hand (color)."

4. **Pass threshold is a surprise.** The user finds out they needed 65% only after failing — it should be visible before they attempt so they know what they're aiming for.

5. **Lesson 5 fist-lock has no active indicator.** The hint says "make a fist to lock the chord" but nothing confirms the lock happened — no UI change, no color shift, nothing. Users don't know if the gesture registered.

6. **No warm-up for total beginners.** Lesson 1 immediately asks you to hold C major for 3 seconds, but if you've never touched the wheel you don't know how to land on C. A very short "find this chord" free-practice moment before the countdown would help a lot.

7. **Retry is buried.** After a failed step you see a big score and a disabled "Next" button — the path forward (Retry) doesn't draw the eye.

## Rest of the app

8. **GestureCoach fires after you're already lost.** It shows on first play but only after camera permission — by then many users have already given up or clicked around confused. Moving one tip into the permission card ("you'll move both hands on two wheels") would set better expectations.

9. **Nod volume control is invisible.** There's no persistent indicator that nodding does anything. A small icon somewhere would surface this feature.

10. **Spaced-repetition review is hard to find.** The "X chords due" banner only appears if you've completed lessons — it's invisible to new users and the feature never gets explained.

11. **No chord name shown while playing.** When a hand is on a wheel slice the app plays it but never says "you're playing Am7" — adding a floating label would help users build vocabulary.

12. **Mobile layout isn't tested.** The HUD bars, score overlays, and instruction text weren't designed for narrow screens.

13. **Piano mode takes too long to load.** Switching to piano downloads samples silently with no progress indicator — it just sounds broken until it's ready.
