/*!
 * 196dev components · hero-network.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Hero arka planı 2 — nöral ağ / takımyıldız
   - Yavaşça süzülen noktalar; birbirine yaklaşınca aralarında ince
     çizgi beliriyor (yakınlaştıkça daha belirgin).
   - Ağda sinyaller dolaşıyor: bir bağlantı boyunca küçük bir ışık
     ilerliyor, vardığı nokta bir an parlıyor ve sinyal bazen oradan
     başka bir komşuya devam ediyor ("düşünen" bir ağ gibi).
   - Canvas 2D; nokta sayısı ekran alanına göre ayarlanıyor.
   ========================================================= */

const CFG = {
  density: 11000,       // px² başına bir nokta (küçük = daha çok nokta)
  minNodes: 60,
  maxNodes: 140,
  speed: [5, 13],       // px/sn
  link: 0.17,           // bağlantı mesafesi: kısa kenarın oranı
  pulseRate: 2.6,       // saniyede yeni sinyal
  pulseTime: 0.9,       // sn, sinyalin bir bağlantıyı geçme süresi
  chain: 0.6,           // sinyalin bir sonraki komşuya devam etme olasılığı
  maxPulses: 24,
  line: [210, 216, 214],
  accent: [127, 227, 196]
};

const rand = (a, b) => a + Math.random() * (b - a);

export function create() {
  let W = 0, H = 0, LINK = 140, nodes = [], pulses = [], acc = 0;
  const BUCKETS = 8;

  function makeNode() {
    const a = Math.random() * Math.PI * 2, v = rand(CFG.speed[0], CFG.speed[1]);
    return { x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(0.9, 1.8), flash: 0, nb: [] };
  }

  function resize(w, h) {
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    W = w; H = h;
    LINK = Math.max(110, Math.min(175, Math.min(w, h) * CFG.link));
    for (const n of nodes) { n.x *= sx; n.y *= sy; }
    const want = Math.max(CFG.minNodes, Math.min(CFG.maxNodes, Math.round(w * h / CFG.density)));
    while (nodes.length < want) nodes.push(makeNode());
    nodes.length = want;
    pulses = [];
  }

  function spawn(from) {
    const a = from ?? nodes[(Math.random() * nodes.length) | 0];
    if (!a.nb.length || pulses.length >= CFG.maxPulses) return;
    const b = a.nb[(Math.random() * a.nb.length) | 0];
    pulses.push({ a, b, p: 0 });
  }

  function draw(ctx, t, dt) {
    // hareket: kenarlarda yumuşakça geri dön
    for (const n of nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -20 && n.vx < 0 || n.x > W + 20 && n.vx > 0) n.vx *= -1;
      if (n.y < -20 && n.vy < 0 || n.y > H + 20 && n.vy > 0) n.vy *= -1;
      n.flash = Math.max(0, n.flash - dt * 1.6);
      n.nb.length = 0;
    }

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    // bağlantılar: opaklığa göre birkaç gruba ayırıp toplu çiz
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    const L2 = LINK * LINK;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > L2) continue;
        a.nb.push(b); b.nb.push(a);
        const k = 1 - Math.sqrt(d2) / LINK;
        const bi = Math.min(BUCKETS - 1, (k * k * BUCKETS) | 0);
        paths[bi].moveTo(a.x, a.y); paths[bi].lineTo(b.x, b.y);
      }
    }
    const [lr, lg, lb] = CFG.line;
    ctx.lineWidth = 1;
    for (let i = 0; i < BUCKETS; i++) {
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},${(0.05 + 0.33 * (i + 0.5) / BUCKETS).toFixed(3)})`;
      ctx.stroke(paths[i]);
    }

    // sinyaller
    acc += dt * CFG.pulseRate;
    while (acc >= 1) { acc -= 1; spawn(); }
    const [ar, ag, ab] = CFG.accent;
    for (let i = pulses.length - 1; i >= 0; i--) {
      const s = pulses[i];
      s.p += dt / CFG.pulseTime;
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
      // bağlantı koptuysa sinyali bırak
      if (s.p >= 1 || dx * dx + dy * dy > L2 * 1.1) {
        pulses.splice(i, 1);
        if (s.p >= 1) { s.b.flash = 1; if (Math.random() < CFG.chain) spawn(s.b); }
        continue;
      }
      const env = Math.sin(Math.PI * s.p);
      // bağlantının kendisi hafifçe renkleniyor
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(0.32 * env).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
      const x = s.a.x + dx * s.p, y = s.a.y + dy * s.p;
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${(0.16 * env).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${(0.95 * env).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill();
    }

    // noktalar
    const dots = new Path2D();
    for (const n of nodes) { dots.moveTo(n.x + n.r, n.y); dots.arc(n.x, n.y, n.r, 0, Math.PI * 2); }
    ctx.fillStyle = "rgba(232, 234, 230, 0.55)";
    ctx.fill(dots);
    for (const n of nodes) {
      if (n.flash <= 0) continue;
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${(0.18 * n.flash).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, 4 + 8 * n.flash, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${n.flash.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { resize, draw, fps: 30, centerDim: 0.7 };
}

/* Tek başına kullanım: sahneyi bir canvas'a bağlar; boyutu, döngüyü ve
   "ekranda değilken durma"yı kendi yönetir. options yukarıdaki CFG
   değerlerini değiştirir (aynı sayfadaki bütün kopyalar için geçerli).
     import { mount } from "./hero-network.js";
     const scene = mount(canvas, { accent: [127, 227, 196], pulseRate: 2.6 });
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
