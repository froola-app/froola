type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;   // 1.0 → 0.0
  decay: number;
  radius: number;
  r: number; g: number; b: number;
};

const MAX = 60;

// Lerp tension (0–1) → RGB: amber (0.0) → orange (0.5) → indigo (1.0)
function tensionRGB(tension: number): [number, number, number] {
  if (tension <= 0.5) {
    const t = tension * 2;
    return [
      Math.round(245 + (251 - 245) * t),
      Math.round(158 + (100 - 158) * t),
      Math.round(11  + (0   - 11)  * t),
    ];
  }
  const t = (tension - 0.5) * 2;
  return [
    Math.round(251 + (99  - 251) * t),
    Math.round(100 + (102 - 100) * t),
    Math.round(0   + (241 - 0)   * t),
  ];
}

export class ParticleSystem {
  private particles: Particle[] = [];

  get count(): number {
    return this.particles.length;
  }

  spawn(x: number, y: number, amplitude: number, tension: number): void {
    const n = Math.floor(amplitude * 3);
    const [r, g, b] = tensionRGB(tension);

    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + amplitude * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.01,
        radius: 1.5 + Math.random() * 2,
        r, g, b,
      });
    }
  }

  tick(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${(p.life * 0.6).toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
    this.particles = this.particles.filter(p => p.life > 0);
  }
}
