export type SheetToken = { chord?: string; lyric: string };
export type SheetLine = { tokens: SheetToken[] };
export type SongSheet = { lines: SheetLine[] };

// "C", "Am", "F#maj7", "Bbm7", "Gsus4", "D/F#" — permissive on purpose;
// misparses degrade to plain text, never errors.
const CHORD = /^[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*(\/[A-G][#b]?)?$/;
const INLINE = /\[([^\]]+)\]/;

// A single bare letter (no suffix/accidental) is ambiguous with a one-word
// lyric line ("A", "I", "E"-as-exclamation, etc.) — never treat it as a
// chord header, even though it matches CHORD.
const BARE_LETTER = /^[A-G]$/;

const isChordLine = (line: string) => {
  const words = line.trim().split(/\s+/);
  if (words.length === 1 && BARE_LETTER.test(words[0])) return false;
  return words.length > 0 && words.every(w => CHORD.test(w));
};

function parseInline(line: string): SheetLine {
  const tokens: SheetToken[] = [];
  let rest = line;
  let m = rest.match(INLINE);
  if (m && m.index! > 0) { tokens.push({ lyric: rest.slice(0, m.index) }); rest = rest.slice(m.index!); m = rest.match(INLINE); }
  while (m) {
    const after = rest.slice(m.index! + m[0].length);
    const next = after.search(/\[[^\]]+\]/);
    const lyric = next === -1 ? after : after.slice(0, next);
    tokens.push({ chord: m[1], lyric });
    rest = next === -1 ? '' : after.slice(next);
    m = rest ? rest.match(INLINE) : null;
  }
  if (rest) tokens.push({ lyric: rest });
  return { tokens };
}

function mergeChordLine(chordLine: string, lyricLine: string): SheetLine {
  // Split the lyric line at each chord's column position.
  const cols: { chord: string; col: number }[] = [];
  const re = /\S+/g;
  for (let m = re.exec(chordLine); m; m = re.exec(chordLine)) cols.push({ chord: m[0], col: m.index });
  const tokens: SheetToken[] = [];
  if (cols[0]?.col > 0) tokens.push({ lyric: lyricLine.slice(0, cols[0].col) });
  cols.forEach((c, i) => {
    const end = i + 1 < cols.length ? cols[i + 1].col : undefined;
    tokens.push({ chord: c.chord, lyric: lyricLine.slice(c.col, end) });
  });
  return { tokens };
}

export function parseSheet(source: string): SongSheet {
  const raw = source.split('\n');
  const lines: SheetLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (!line.trim()) { lines.push({ tokens: [{ lyric: '' }] }); continue; }
    if (INLINE.test(line)) { lines.push(parseInline(line)); continue; }
    if (isChordLine(line)) {
      const next = raw[i + 1];
      if (next && next.trim() && !isChordLine(next) && !INLINE.test(next)) {
        lines.push(mergeChordLine(line, next)); i++; continue;
      }
      lines.push({ tokens: line.trim().split(/\s+/).map(chord => ({ chord, lyric: '' })) });
      continue;
    }
    lines.push({ tokens: [{ lyric: line }] });
  }
  return { lines };
}
