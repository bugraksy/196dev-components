/*!
 * 196dev components · hero-guilloche.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Hero arka planı: giyoş (banknot / pasaport deseni)  —  ?hero=guilloche
   İç içe halkalar hâlinde ince çizgi demetleri: her halka, aynı dalganın
   faz kaydırılmış kopyalarından oluşuyor (banknotlardaki rozetler gibi).
   Halkalar zıt yönlerde çok yavaş dönüyor; çizgiler birbirinin üstünden
   kayarken dantel gibi kıpırdayan bir desen çıkıyor. Yanlarda rozetten
   kenarlara uzanan yatay dalga bantları, zeminde belli belirsiz bir
   ince çizgi dokusu var.
   - Işık: desenin üzerinden bir parlama geçiyor; imleç onu çeviriyor
     (kartı ışığa tutup eğmek gibi), parlamanın kenarında hologram
     sticker'daki gibi hafif mavi-pembe bir renk kayması var.
   Kullanım:
     import { mount } from "./hero-guilloche.js";
     const scene = mount(canvas, { speed: 1, colors: { cream: "#f5ebd6" } });
     scene.destroy();
   Bütün ayarlar aşağıdaki "defaults" nesnesinde.
   ========================================================= */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;    // imleç, p uzayında (merkez 0, yükseklik 1 birim)
uniform float uHover;
uniform float uDim;      // 1: ortadaki başlık ve motto için arka planı kıs

uniform vec3 INK;
uniform vec3 CREAM;
uniform vec3 GOLD;
uniform vec3 EMBER;
uniform vec3 BLUE;
uniform vec3 PINK;
const float TAU = 6.2831853;
const int LINES = 10;                              // bir demetteki çizgi sayısı

/* halka demeti: r = R + A·sin(k·θ + faz_j). k ve k2 tam sayı olmalı (dikiş olmasın) */
float ring(float r, float th, float R, float A, float k, float k2, float ph) {
  if (abs(r - R) > A + 0.01) return 0.0;
  float env = 0.62 + 0.38 * sin(th * k2 - ph * 0.5);    // dalga boyu çevre boyunca değişiyor
  float v = 0.0;
  for (int j = 0; j < LINES; j++) {
    float a = k * th + ph + TAU * float(j) / float(LINES);
    float slope = A * env * k * cos(a) / max(r, 0.05);
    float d = abs(r - (R + A * env * sin(a))) / sqrt(1.0 + slope * slope) * uRes.y;   // piksel
    v += 1.0 - smoothstep(0.35, 1.5, d);
  }
  return min(v, 1.6);
}

/* yatay dalga bandı: y = A·sin(k·x + faz_j) */
float band(vec2 q, float A, float k, float ph) {
  if (abs(q.y) > A + 0.01) return 0.0;
  float v = 0.0;
  for (int j = 0; j < 8; j++) {
    float a = k * q.x + ph + TAU * float(j) / 8.0;
    float slope = A * k * cos(a);
    float d = abs(q.y - A * sin(a)) / sqrt(1.0 + slope * slope) * uRes.y;
    v += 1.0 - smoothstep(0.35, 1.5, d);
  }
  return min(v, 1.6);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float aspect = uRes.x / uRes.y;
  float s = min(1.0, aspect / 1.25);                // dar ekranda rozet küçülüyor
  vec2 c = (p - vec2(0.0, 0.02)) / s;               // rozetin merkezi: BUGRA'nın ortası
  float r = length(c), th = atan(c.y, c.x);
  float t = uTime;

  // halkalar: içten dışa, komşular zıt yönde dönüyor
  float inner = ring(r, th, 0.150, 0.042, 6.0, 3.0,  t * 0.10);
  float mid1  = ring(r, th, 0.262, 0.052, 10.0, 5.0, -t * 0.07);
  float mid2  = ring(r, th, 0.372, 0.040, 16.0, 4.0,  t * 0.05);
  float outer = ring(r, th, 0.458, 0.028, 28.0, 7.0, -t * 0.04);
  float halo  = ring(r, th, 0.545, 0.046, 12.0, 6.0,  t * 0.03);

  // yan bantlar: rozetten kenarlara
  float side = smoothstep(0.56, 0.80, abs(c.x));
  float bands = (band(c, 0.085 * side, 17.0, t * 0.25 * sign(c.x))
               + band(c - vec2(0.0, 0.30), 0.030 * side, 34.0, -t * 0.2)
               + band(c + vec2(0.0, 0.30), 0.030 * side, 34.0,  t * 0.2)) * step(0.01, side);

  // zemin dokusu: çok ince, hafif dalgalı yatay çizgiler
  float gy = (p.y + 0.012 * sin(p.x * 11.0 + t * 0.1)) * uRes.y / 5.0;
  float ground = (1.0 - smoothstep(0.12, 0.30, abs(fract(gy) - 0.5))) * 0.045;

  // ışık: desenin üzerinden geçen parlama; imleç yönünü çeviriyor
  float ang = t * 0.12 + uHover * (uMouse.x * 2.4 - uMouse.y * 1.2);
  float sweep = 0.5 + 0.5 * cos(th - ang + r * 2.5);
  float light = 0.30 + 0.70 * sweep * sweep;
  float edge = sweep * (1.0 - sweep) * 4.0;          // parlamanın kenarı: renk kayması burada

  vec3 col = INK + CREAM * ground;
  col += vec3(0.10, 0.04, 0.03) * exp(-r * r * 5.0);                     // merkezde hafif sıcaklık
  vec3 tint = mix(CREAM, mix(BLUE, PINK, 0.5 + 0.5 * sin(th * 2.0 + t * 0.2)), edge * 0.35);
  col += mix(GOLD, tint, 0.55) * inner * light * 0.50;
  col += tint  * mid1  * light * 0.62;
  col += mix(EMBER, GOLD, sweep) * mid2 * light * 0.70;
  col += tint  * outer * light * 0.55;
  col += mix(GOLD, CREAM, 0.4) * halo * light * 0.38;
  col += mix(EMBER, tint, 0.5) * bands * (0.30 + 0.5 * light) * 0.55;

  // BUGRA'nın arkası biraz kısık, kenarlar koyu
  col *= 1.0 - 0.35 * uDim * exp(-(p.x * p.x * 1.4 + (p.y - 0.02) * (p.y - 0.02) * 9.0));
  col *= 1.0 - 0.45 * smoothstep(0.6, 1.3, length(p * vec2(0.75, 1.0)));
  gl_FragColor = vec4(col, 1.0);
}
`;

/* renk: "#rrggbb" ya da [r, g, b] (0..1) */
function rgb(c) {
  if (Array.isArray(c)) return c;
  const n = parseInt(String(c).replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* Varsayılan ayarlar: mount(canvas, { ... }) ile istediğini değiştir. */
export const defaults = {
  speed: 1,          // akış hızı çarpanı
  pointer: true,     // imlece tepki versin mi
  dim: false,        // true: ortadaki başlığın arkasını kıs
  fps: 30,
  colors: {
    ink: "#050208",     // zemin
    cream: "#f5ebd6",   // ana çizgi rengi
    gold: "#ffb861",    // iç ve dış halkalar
    ember: "#eb6121",   // orta halka ve yan bantlar
    blue: "#4d8ff2",    // parlamadaki renk kayması
    pink: "#fa61a8"     // parlamadaki renk kayması
  }
};
const COLOR_UNIFORMS = { ink: "INK", cream: "CREAM", gold: "GOLD", ember: "EMBER", blue: "BLUE", pink: "PINK" };   // seçenek adı → shader'daki ad

/* Sahneyi canvas'a bağlar; canvas, .hero'yu (yoksa kendi kutusunu) doldurur.
   Dönen nesnenin destroy() metodu her şeyi durdurup dinleyicileri kaldırır. */
export function mount(canvas, options = {}) {
  const opts = { ...defaults, ...options, colors: { ...defaults.colors, ...(options.colors || {}) } };
  const none = { destroy() {} };
  const host = canvas.closest(".hero") || canvas.parentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return none;                          // WebGL yoksa düz zemin kalır

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const pr = gl.createProgram();
  try {
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
  } catch (err) { console.warn("hero-guilloche: shader kurulamadı", err); return none; }
  gl.bindAttribLocation(pr, 0, "aPos");
  gl.linkProgram(pr);
  gl.useProgram(pr);
  const U = {};
  for (const n of ["uRes", "uTime", "uMouse", "uHover", "uDim"]) U[n] = gl.getUniformLocation(pr, n);
  gl.uniform1f(U.uDim, opts.dim ? 1 : 0);
  for (const [key, name] of Object.entries(COLOR_UNIFORMS)) {
    gl.uniform3fv(gl.getUniformLocation(pr, name), rgb(opts.colors[key]));
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let W = 1, H = 1, mx = -1e4, my = -1e4, sx = 0, sy = 0, hover = 0, clock = 20;
  const off = new AbortController();             // destroy() bütün dinleyicileri bununla kaldırıyor
  const on = (target, type, fn) => target.addEventListener(type, fn, { passive: true, signal: off.signal });

  function resize() {
    const rect = host.getBoundingClientRect();
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    const scale = Math.min(window.devicePixelRatio || 1, 2);   // ince çizgiler keskin olsun
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
  }

  function frame() {
    const rect = canvas.getBoundingClientRect();
    const inside = mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom;
    hover += ((inside ? 1 : 0) - hover) * 0.08;
    if (inside) {
      const tx = (mx - rect.left - W / 2) / H, ty = -(my - rect.top - H / 2) / H;
      sx += (tx - sx) * 0.18; sy += (ty - sy) * 0.18;         // imleci yumuşak takip
    }
    gl.uniform1f(U.uTime, clock);
    gl.uniform2f(U.uMouse, sx, sy);
    gl.uniform1f(U.uHover, hover);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  on(window, "resize", () => { resize(); if (reduced) frame(); });
  if (reduced) {                                 // hareket istemeyenler: tek kare
    frame();
    return { destroy() { off.abort(); } };
  }

  let visible = true, last = -1e9, prev = 0, raf = 0;
  const gap = 1000 / opts.fps;
  function loop(ms) {
    raf = requestAnimationFrame(loop);
    if (!visible || ms - last < gap - 2) return;
    clock += (prev ? Math.min(0.1, (ms - prev) / 1000) : 0) * opts.speed;
    prev = last = ms;
    frame();
  }
  raf = requestAnimationFrame(loop);
  if (opts.pointer) {
    on(window, "pointermove", (e) => { mx = e.clientX; my = e.clientY; });
    on(document, "mouseleave", () => { mx = my = -1e4; });
  }
  // ekranda değilken çizme
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible) prev = 0; });
  io.observe(host);
  return { destroy() { cancelAnimationFrame(raf); off.abort(); io.disconnect(); } };
}
