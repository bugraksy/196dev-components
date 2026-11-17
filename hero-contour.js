/*!
 * 196dev components · hero-contour.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Hero arka planı 1 — topografik kontur çizgileri
   - Yavaşça akan bir gürültü "arazisi"nin eşyükselti çizgileri
     (marching squares). BUGRA yazısı arazinin zirvesinde: çizgiler
     onun etrafında halkalanıyor.
   - Her 5. çizgi biraz daha parlak (haritalardaki ana kontur gibi).
   - Canvas 2D, WebGL yok: ekran kartına neredeyse yük binmiyor.
   ========================================================= */

const CFG = {
  cell: 10,            // px, örnekleme ızgarası (küçük = daha yumuşak çizgi, daha çok iş)
  step: 0.075,         // iki çizgi arası yükseklik farkı (küçük = daha sık çizgi)
  scale: 1 / 280,      // arazinin ölçeği (küçük = daha geniş tepeler)
  flow: 0.012,         // yatay akış hızı
  morph: 0.04,         // şekil değiştirme hızı
  summit: 0.85,        // BUGRA'nın arkasındaki tepenin yüksekliği (0: yok)
  minor: "rgba(225, 228, 222, 0.16)",
  major: "rgba(127, 227, 196, 0.42)",
  majorEvery: 5
};

/* ---- 3B Perlin gürültüsü ---- */
const P = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u),
      lerp(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u),
      lerp(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v),
    w);
}

// marching squares: köşe bitleri sol-üst 8, sağ-üst 4, sağ-alt 2, sol-alt 1
// kenarlar: 0 üst, 1 sağ, 2 alt, 3 sol — her çift bir çizgi parçası
const SEG = [[], [3, 2], [2, 1], [3, 1], [0, 1], [3, 0, 2, 1], [0, 2], [3, 0],
  [3, 0], [0, 2], [0, 1, 3, 2], [0, 1], [3, 1], [2, 1], [3, 2], []];

export function create() {
  let W = 0, H = 0, cols = 0, rows = 0, f = null;

  function resize(w, h) {
    W = w; H = h;
    cols = Math.ceil(w / CFG.cell);
    rows = Math.ceil(h / CFG.cell);
    f = new Float32Array((cols + 1) * (rows + 1));
  }

  function sample(t) {
    const s = CFG.scale, cx = W / 2, cy = H * 0.48, r = Math.min(W, H) * 0.4;
    const ox = t * CFG.flow, z1 = t * CFG.morph, z2 = t * CFG.morph * 1.5;
    let i = 0;
    for (let ry = 0; ry <= rows; ry++) {
      const y = ry * CFG.cell, ny = y * s, dy = (y - cy) / r;
      for (let rx = 0; rx <= cols; rx++) {
        const x = rx * CFG.cell, nx = x * s + ox, dx = (x - cx) / (r * 1.7);
        f[i++] = noise3(nx, ny, z1) * 0.95
          + noise3(nx * 2.2 + 11.3, ny * 2.2 - 7.1, z2) * 0.3
          + CFG.summit * Math.exp(-(dx * dx + dy * dy));
      }
    }
  }

  function draw(ctx, t) {
    sample(t);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    const minor = new Path2D(), major = new Path2D();
    const C = CFG.cell, st = CFG.step, w1 = cols + 1;
    for (let ry = 0; ry < rows; ry++) {
      const y0 = ry * C;
      for (let rx = 0; rx < cols; rx++) {
        const i = ry * w1 + rx;
        const a = f[i], b = f[i + 1], c = f[i + w1 + 1], d = f[i + w1];
        const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
        const k0 = Math.ceil(lo / st), k1 = Math.floor(hi / st);
        if (k1 < k0) continue;
        const x0 = rx * C;
        for (let k = k0; k <= k1; k++) {
          const lv = k * st;
          const idx = (a >= lv ? 8 : 0) | (b >= lv ? 4 : 0) | (c >= lv ? 2 : 0) | (d >= lv ? 1 : 0);
          const seg = SEG[idx];
          if (!seg.length) continue;
          const path = ((k % CFG.majorEvery) + CFG.majorEvery) % CFG.majorEvery === 0 ? major : minor;
          for (let s = 0; s < seg.length; s += 2) {
            for (let e = 0; e < 2; e++) {
              const edge = seg[s + e];
              let px, py;
              if (edge === 0) { px = x0 + C * (lv - a) / (b - a); py = y0; }
              else if (edge === 1) { px = x0 + C; py = y0 + C * (lv - b) / (c - b); }
              else if (edge === 2) { px = x0 + C * (lv - d) / (c - d); py = y0 + C; }
              else { px = x0; py = y0 + C * (lv - a) / (d - a); }
              if (e === 0) path.moveTo(px, py); else path.lineTo(px, py);
            }
          }
        }
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = CFG.minor; ctx.stroke(minor);
    ctx.strokeStyle = CFG.major; ctx.stroke(major);
  }

  return { resize, draw, fps: 24, centerDim: 0.55 };
}

/* Tek başına kullanım: sahneyi bir canvas'a bağlar; boyutu, döngüyü ve
   "ekranda değilken durma"yı kendi yönetir. options yukarıdaki CFG
   değerlerini değiştirir (aynı sayfadaki bütün kopyalar için geçerli).
     import { mount } from "./hero-contour.js";
     const scene = mount(canvas, { major: "rgba(127, 227, 196, 0.42)", step: 0.075 });
     scene.destroy(); */
export function mount(canvas, options = {}) {
  Object.assign(CFG, options);
  const scene = create();
  const ctx = canvas.getContext("2d", { alpha: false });
  let visible = false, last = 0, t = 0, raf = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (!r.width || !r.height) return;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene.resize(r.width, r.height, dpr);
    scene.draw(ctx, t, 0);
  };
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
  const ro = new ResizeObserver(resize);
  io.observe(canvas); ro.observe(canvas);
  const gap = 1000 / (scene.fps || 30);
  const frame = (ms) => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden || ms - last < gap - 2) return;
    const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
    last = ms; t += dt;
    scene.draw(ctx, t, dt);
  };
  raf = requestAnimationFrame(frame);
  return { destroy() { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); } };
}
