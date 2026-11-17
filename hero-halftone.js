/*!
 * 196dev components · hero-halftone.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Hero arka planı: halftone / riso baskı  —  ?hero=halftone
   Siyah kağıda iki renk baskı gibi: turuncu ve krem mürekkep, her biri
   kendi açısında nokta taramasıyla basılmış. Noktalar yavaşça akan bir
   alanın değerine göre büyüyüp küçülüyor; iki katman birbirine göre
   hafif kaçık (riso baskıdaki gibi), üst üste geldikleri yer altın.
   - İmleç noktaları şişiriyor (mürekkep oraya yığılıyor).
   - Nokta kenarları ve mürekkep yoğunluğu hafif pürüzlü: baskı hissi.
   - BUGRA'nın arkasında noktalar küçülüyor, yazı okunur kalıyor.
   Kullanım:
     import { mount } from "./hero-halftone.js";
     const scene = mount(canvas, { speed: 1, colors: { inkA: "#ed6121" } });
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
uniform float uDim;
uniform float uDots;     // ekran yüksekliğine sığan nokta sayısı      // 1: ortadaki başlık ve motto için arka planı kıs

uniform vec3 INK;
uniform vec3 EMBER;
uniform vec3 CREAM;
uniform vec3 GOLD;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

/* basılan "resim": yavaşça akan yumuşak lekeler, 0..1 */
float field(vec2 p, float t) {
  vec2 q = p * 1.2;
  q += 0.35 * vec2(noise(q * 1.3 + vec2(0.0, t * 0.07)), noise(q * 1.3 + vec2(4.1, -t * 0.06)));
  return noise(q * 1.1 + t * 0.04) * 0.65 + noise(q * 2.3 - t * 0.03) * 0.35;
}

/* bir tarama katmanı: ang açısında döndürülmüş ızgarada, v'ye göre büyüyen noktalar */
float dots(vec2 px, float ang, float cell, float v, float rough) {
  float c = cos(ang), s = sin(ang);
  vec2 q = mat2(c, -s, s, c) * px / cell;
  float d = length(fract(q) - 0.5);
  float r = sqrt(clamp(v, 0.0, 1.0)) * 0.62;      // v = 1'de noktalar birbirine değiyor
  float aa = 1.2 / cell;
  return (1.0 - smoothstep(r - aa, r + aa, d + rough)) * step(0.02, v);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 p = (px - 0.5 * uRes) / uRes.y;
  float cell = max(7.0, uRes.y / uDots);           // nokta aralığı: ekranla birlikte büyüyor

  // iki katman aynı resmin biraz kaymış iki baskısı
  float va = smoothstep(0.36, 0.76, field(p, uTime));
  float vb = smoothstep(0.40, 0.78, field(p + vec2(0.07, -0.05), uTime + 3.0));

  vec2 dm = p - uMouse;
  float bump = uHover * exp(-dot(dm, dm) / 0.03);
  va += bump * 0.7;
  vb += bump * 0.45;

  // BUGRA'nın arkası sakin
  float calm = 1.0 - 0.8 * uDim * exp(-(p.x * p.x * 1.0 + p.y * p.y * 6.0));
  calm *= 1.0 - 0.7 * uDim * exp(-(p.x * p.x * 1.6 + (p.y + 0.23) * (p.y + 0.23) * 60.0));   // motto satırı
  va *= calm; vb *= calm;

  float rough = (noise(px * 0.9) - 0.5) * 0.10;   // pürüzlü nokta kenarı
  float a = dots(px, 0.26, cell, va, rough);
  float b = dots(px + cell * 0.31, 1.31, cell, vb, rough);
  float mott = 0.80 + 0.20 * noise(px * 0.33);    // mürekkep her yere eşit oturmuyor

  vec3 col = INK;
  col = mix(col, EMBER, a * mott);
  col = mix(col, CREAM, b * 0.93 * mott);
  col = mix(col, GOLD, a * b * 0.9);
  col *= 0.95 + 0.08 * hash(px);                  // kağıt greni
  col *= 1.0 - 0.45 * smoothstep(0.6, 1.25, length(p * vec2(0.75, 1.0)));
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
  dots: 62,          // ekran yüksekliğine sığan nokta sayısı (büyüdükçe noktalar küçülür)
  colors: {
    paper: "#050208",   // kağıt (zemin)
    inkA: "#ed6121",    // 1. mürekkep
    inkB: "#f2e8d4",    // 2. mürekkep
    overlap: "#ffbd61"  // iki mürekkebin üst üste bindiği yer
  }
};
const COLOR_UNIFORMS = { paper: "INK", inkA: "EMBER", inkB: "CREAM", overlap: "GOLD" };   // seçenek adı → shader'daki ad

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
  } catch (err) { console.warn("hero-halftone: shader kurulamadı", err); return none; }
  gl.bindAttribLocation(pr, 0, "aPos");
  gl.linkProgram(pr);
  gl.useProgram(pr);
  const U = {};
  for (const n of ["uRes", "uTime", "uMouse", "uHover", "uDim", "uDots"]) U[n] = gl.getUniformLocation(pr, n);
  gl.uniform1f(U.uDim, opts.dim ? 1 : 0);
  gl.uniform1f(U.uDots, opts.dots);
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
    const scale = Math.min(window.devicePixelRatio || 1, 2);   // noktalar keskin olsun
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
