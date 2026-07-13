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
