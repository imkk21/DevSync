// A short burst of confetti for wins (milestone done, all tests passing). Skipped when the
// system asks for reduced motion. No library: ~60 particles on a throwaway canvas.
const COLORS = ['#08872B', '#4AC26B', '#0969DA', '#BF3989', '#D29922', '#8250DF'];

export function celebrate() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-motion')) return;
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '80' });
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const parts = Array.from({ length: 70 }, (_, i) => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 9,
    size: 5 + Math.random() * 5,
    spin: Math.random() * Math.PI,
    color: COLORS[i % COLORS.length],
  }));
  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += 0.2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
