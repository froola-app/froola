import { parseSheet } from './parseSheet';

it('parses inline [C]lyric format', () => {
  const s = parseSheet('[C]Twinkle [G]twinkle');
  expect(s.lines[0].tokens).toEqual([
    { chord: 'C', lyric: 'Twinkle ' },
    { chord: 'G', lyric: 'twinkle' },
  ]);
});

it('merges chords-above-lyrics by column', () => {
  const s = parseSheet('C       G\nTwinkle twinkle');
  expect(s.lines[0].tokens).toEqual([
    { chord: 'C', lyric: 'Twinkle ' },
    { chord: 'G', lyric: 'twinkle' },
  ]);
});

it('passes plain lines through and never throws', () => {
  expect(parseSheet('just words © weird ★').lines[0].tokens)
    .toEqual([{ lyric: 'just words © weird ★' }]);
  expect(() => parseSheet('')).not.toThrow();
});

it('treats a trailing chord-only line as its own line', () => {
  const s = parseSheet('Am  F');
  expect(s.lines[0].tokens.map(t => t.chord)).toEqual(['Am', 'F']);
});

it('does not consume a bare single-letter lyric line as a chord header', () => {
  const s = parseSheet('A\nFool believes...');
  expect(s.lines[0].tokens).toEqual([{ lyric: 'A' }]);
  expect(s.lines[1].tokens).toEqual([{ lyric: 'Fool believes...' }]);
});

it('still merges a real single-chord header line', () => {
  const s = parseSheet('Am\nlyric');
  expect(s.lines[0].tokens).toEqual([{ chord: 'Am', lyric: 'lyric' }]);
});

it('still merges a multi-token bare-letter chord header line', () => {
  const s = parseSheet('C G\nlyric');
  expect(s.lines[0].tokens).toEqual([
    { chord: 'C', lyric: 'ly' },
    { chord: 'G', lyric: 'ric' },
  ]);
});

it('renders a standalone bare single letter as plain lyric', () => {
  const s = parseSheet('A');
  expect(s.lines[0].tokens).toEqual([{ lyric: 'A' }]);
});
