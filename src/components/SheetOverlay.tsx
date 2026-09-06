import type { SongSheet } from '../engine/songsheet';

// Pure presentational render of a parsed lyrics+chords sheet. Chords sit
// above their lyric via inline-block column tokens (see .sheet-token/.sheet-chord
// in App.css) — no state, no fetching, just SongSheet -> markup.
export default function SheetOverlay({ sheet }: { sheet: SongSheet }) {
  return (
    <div className="sheet-overlay">
      {sheet.lines.map((line, i) => (
        <div className="sheet-line" key={i}>
          {line.tokens.map((token, j) => (
            <span className="sheet-token" key={j}>
              {token.chord !== undefined && <span className="sheet-chord">{token.chord}</span>}
              {token.lyric}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
