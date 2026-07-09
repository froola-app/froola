import { assignHandIds } from './index';
import { wheelGeometry } from '../renderer/geometry';

describe('assignHandIds', () => {
  // Desktop/landscape: wheels share one row, so this should behave like the
  // old x-only split.
  const landscape = wheelGeometry(1280, 800);

  it('labels a single hand by whichever wheel it is nearest, landscape', () => {
    expect(assignHandIds([{ rx: 0.1, ry: 0.65 }], landscape, 1280, 800)).toEqual(['left']);
    expect(assignHandIds([{ rx: 0.9, ry: 0.65 }], landscape, 1280, 800)).toEqual(['right']);
  });

  it('assigns two hands to opposite wheels regardless of detection order', () => {
    const left = { rx: 0.1, ry: 0.65 };
    const right = { rx: 0.9, ry: 0.65 };
    expect(assignHandIds([left, right], landscape, 1280, 800)).toEqual(['left', 'right']);
    expect(assignHandIds([right, left], landscape, 1280, 800)).toEqual(['right', 'left']);
  });

  // Portrait: wheels are staggered diagonally and sit close together on the
  // x-axis, so this only works with a distance-based (not x-only) split.
  const portrait = wheelGeometry(390, 844);

  it('labels a single hand by wheel proximity on the staggered portrait layout', () => {
    // Near the upper (note) wheel's center.
    expect(assignHandIds([{ rx: portrait.leftCx / 390, ry: portrait.leftCy / 844 }], portrait, 390, 844))
      .toEqual(['left']);
    // Near the lower (chord) wheel's center.
    expect(assignHandIds([{ rx: portrait.rightCx / 390, ry: portrait.rightCy / 844 }], portrait, 390, 844))
      .toEqual(['right']);
  });

  it('assigns two hands near the staggered wheels to the correct sides', () => {
    const nearLeft = { rx: portrait.leftCx / 390, ry: portrait.leftCy / 844 };
    const nearRight = { rx: portrait.rightCx / 390, ry: portrait.rightCy / 844 };
    expect(assignHandIds([nearLeft, nearRight], portrait, 390, 844)).toEqual(['left', 'right']);
    expect(assignHandIds([nearRight, nearLeft], portrait, 390, 844)).toEqual(['right', 'left']);
  });
});
