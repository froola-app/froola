import { ParticleSystem } from './particles';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('ParticleSystem', () => {
  it('starts with zero particles', () => {
    const ps = new ParticleSystem();
    expect(ps.count).toBe(0);
  });

  it('spawns particles proportional to amplitude', () => {
    const ps = new ParticleSystem();
    ps.spawn(100, 100, 1.0, 0.0);
    expect(ps.count).toBeGreaterThan(0);
    expect(ps.count).toBeLessThanOrEqual(3);
  });

  it('spawns no particles when amplitude is 0', () => {
    const ps = new ParticleSystem();
    ps.spawn(100, 100, 0, 0.5);
    expect(ps.count).toBe(0);
  });

  it('never exceeds MAX (60) particles', () => {
    const ps = new ParticleSystem();
    for (let i = 0; i < 100; i++) {
      ps.spawn(100, 100, 1.0, 0.5);
    }
    expect(ps.count).toBeLessThanOrEqual(60);
  });

  it('tick reduces particle count over time (particles decay)', () => {
    const ps = new ParticleSystem();
    const ctx = makeCtx();
    ps.spawn(100, 100, 1.0, 0.0);
    const initial = ps.count;
    for (let i = 0; i < 100; i++) ps.tick(ctx);
    expect(ps.count).toBeLessThan(initial);
  });

  it('tick calls ctx.save and ctx.restore once per call', () => {
    const ps = new ParticleSystem();
    const ctx = makeCtx();
    ps.spawn(100, 100, 1.0, 0.0);
    ps.tick(ctx);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
