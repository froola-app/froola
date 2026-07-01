import { pointerHandId } from './index';

describe('pointerHandId', () => {
  it('labels the left half of the screen as the note wheel', () => {
    expect(pointerHandId(0)).toBe('left');
    expect(pointerHandId(0.2)).toBe('left');
    expect(pointerHandId(0.49)).toBe('left');
  });

  it('labels the right half of the screen as the extension wheel', () => {
    expect(pointerHandId(0.5)).toBe('right');
    expect(pointerHandId(0.8)).toBe('right');
    expect(pointerHandId(1)).toBe('right');
  });
});
