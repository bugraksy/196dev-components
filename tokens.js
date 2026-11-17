/*!
 * 196dev components · tokens.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Token akışı — yeniden kullanılabilir bileşen (kütüphane parçası)
   - Soluk, monospace satırlar; her satır kendi hızında sola kayıyor:
     kod parçaları + yapay zekâ token'ları.
   - Rastgele token'lar bir an vurgu renginde yanıp sönüyor ("dikkat").
   - Gizli kelimeler (secrets) arada bir akışın içinde beliriyor ve
     vurgulanıyor: küçük bir sürpriz.
   - Fare üstündeyken akış yavaşlıyor, imlecin altındaki token yanıyor.
   - Her satır bir kez ekran dışı canvas'a çiziliyor, her karede yalnızca
     kaydırılıyor. Canvas 2D, en fazla 30 fps, görünmüyorken duruyor.

   Kullanım:
     import { mountTokens } from "./tokens.js";
     const t = mountTokens(document.querySelector("canvas"), { lines: 3 });
     t.destroy();   // durdur
   Canvas'ın CSS boyutu verilmeli; lines verilirse yüksekliği bileşen ayarlar.
   ========================================================= */

const DEFAULTS = {
  lines: null,                // satır sayısı (null: canvas yüksekliği kadar)
  lineH: 24,                  // px, satır aralığı
  font: '500 12px "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
  speed: [6, 26],             // px/sn, satır hızları
  alpha: [0.07, 0.19],        // satır opaklığı aralığı
  highlightEvery: 0.09,       // sn, yeni vurgulanan token
  highlightLife: 1.8,         // sn
  background: "#0a0a0a",      // null: şeffaf
  ink: [225, 228, 222],
  accent: [127, 227, 196],
  secrets: [],                // ara sıra akışa karışan gizli kelimeler
  secretChance: 0.012,        // her token'ın gizli kelime olma olasılığı
  hover: true,                // fareyle yavaşlama + imleç altındaki token
  vocab: [
    "def", "async", "await", "return", "import", "from", "class", "const", "let", "=>", "{", "}", "()", "[]",
    "self", "None", "True", "yield", "lambda", "for", "in", "if", "else", "try:", "except", "with",
    "model", "tokens", "embed()", "attention", "softmax", "logits", "layer[12]", "q·k", "grad", "loss=0.0213",
    "agent", "plan()", "tool_call", "context", "prompt", "vector", "weights", "bias", "relu", "norm", "dropout",
    "analyse", "build", "think", "reason", "infer", "train", "eval", "batch", "epoch", "seed=196",
    "0.734", "0.0019", "1e-4", "128", "4096", "π", "∑", "∂", "→", "≈", "::", "//", "#", "λ",
    "fetch()", "map", "reduce", "filter", "stream", "parse", "render", "pipeline", "dataset", "query",
    "cursor", "index", "schema", "json", "<s>", "</s>", "[CLS]", "[SEP]", "▁the", "▁data", "▁is", "##ing"
  ]
};

const rand = (a, b) => a + Math.random() * (b - a);
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a.toFixed(3)})`;

export function mountTokens(canvas, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const ctx = canvas.getContext("2d");
  const measure = document.createElement("canvas").getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, lines = [], hl = [], acc = 0, slow = 1, mouse = null, raf = 0, alive = true;

  if (o.lines) canvas.style.height = `${o.lines * o.lineH}px`;

  function build() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measure.font = o.font;

    const n = o.lines || Math.ceil(H / o.lineH) + 1;
    lines = [];
    for (let li = 0; li < n; li++) {
      const toks = [];
      let x = rand(0, 40);
      while (x < W + 500) {
        const secret = o.secrets.length && Math.random() < o.secretChance;
        const text = secret ? o.secrets[(Math.random() * o.secrets.length) | 0] : o.vocab[(Math.random() * o.vocab.length) | 0];
        const tw = measure.measureText(text).width;
        toks.push({ x, w: tw, text, a: rand(0.55, 1), secret });
        x += tw + rand(12, 34);
      }
      const stripW = Math.ceil(x);
      const cv = document.createElement("canvas");
      cv.width = Math.ceil(stripW * dpr); cv.height = Math.ceil(o.lineH * dpr);
      const c = cv.getContext("2d");
      c.scale(dpr, dpr);
      c.font = o.font; c.textBaseline = "middle";
      const la = rand(o.alpha[0], o.alpha[1]);
      for (const t of toks) {
        c.fillStyle = rgba(o.ink, la * t.a);
        c.fillText(t.text, t.x, o.lineH / 2);
      }
      lines.push({ cv, toks, stripW, off: rand(0, stripW), speed: rand(o.speed[0], o.speed[1]), y: li * o.lineH });
    }
    hl = [];
  }

  const screenX = (L, t) => { let x = t.x - L.off; if (x < -t.w) x += L.stripW; return x; };

  function glow(L, tk, env, strong) {
    const x = screenX(L, tk), y = L.y + o.lineH / 2;
    ctx.fillStyle = rgba(o.accent, (strong ? 0.16 : 0.09) * env);
    ctx.fillRect(x - 4, y - 9, tk.w + 8, 18);
    ctx.fillStyle = rgba(o.accent, 0.92 * env);
    ctx.fillText(tk.text, x, y);
  }

  function draw(dt) {
    if (o.background) { ctx.fillStyle = o.background; ctx.fillRect(0, 0, W, H); }
    else ctx.clearRect(0, 0, W, H);
    slow += ((mouse ? 0.15 : 1) - slow) * Math.min(1, dt * 4);

    for (const L of lines) {
      L.off = (L.off + L.speed * slow * dt) % L.stripW;
      const x = -L.off;
      ctx.drawImage(L.cv, x, L.y, L.stripW, o.lineH);
      if (x + L.stripW < W) ctx.drawImage(L.cv, x + L.stripW, L.y, L.stripW, o.lineH);
    }

    ctx.font = o.font; ctx.textBaseline = "middle";

    // ekrandaki gizli kelimeler her zaman hafifçe yanıyor
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 420);
    for (const L of lines) {
      for (const tk of L.toks) {
        if (!tk.secret) continue;
        const sx = screenX(L, tk);
        if (sx > -tk.w && sx < W) glow(L, tk, pulse, true);
      }
    }

    acc += dt;
    while (acc >= o.highlightEvery) {
      acc -= o.highlightEvery;
      const L = lines[(Math.random() * lines.length) | 0];
      const tk = L.toks[(Math.random() * L.toks.length) | 0];
      const sx = screenX(L, tk);
      if (!tk.secret && sx > 20 && sx < W - 80) hl.push({ L, tk, age: 0 });
    }
    for (let i = hl.length - 1; i >= 0; i--) {
      const h = hl[i];
      h.age += dt;
      const p = h.age / o.highlightLife;
      if (p >= 1) { hl.splice(i, 1); continue; }
      glow(h.L, h.tk, p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 1.6), false);
    }

    // imlecin altındaki token
    if (mouse) {
      const L = lines[Math.floor(mouse.y / o.lineH)];
      if (L) {
        for (const tk of L.toks) {
          const sx = screenX(L, tk);
          if (mouse.x >= sx - 6 && mouse.x <= sx + tk.w + 6) { glow(L, tk, 1, true); break; }
        }
      }
    }
  }

  let visible = true, last = 0;
  const io = window.IntersectionObserver && new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
  io && io.observe(canvas);

  function frame(ms) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden || ms - last < 1000 / 30 - 2) return;
    const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
    last = ms;
    draw(dt);
  }

  const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onLeave = () => { mouse = null; };
  if (o.hover) {
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
  }

  let rt = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduced) draw(0); }, 120); });

  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
    if (!alive) return;
    build();
    ro.observe(canvas);
    if (reduced) { draw(0); return; }
    raf = requestAnimationFrame(frame);
  });

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      io && io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    }
  };
}
