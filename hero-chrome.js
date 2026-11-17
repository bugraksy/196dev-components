/*!
 * 196dev components · hero-chrome.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Hero arka planı: sıvı krom  —  ?hero=chrome
   Yavaşça akan erimiş metal bir yüzey. Yüzeyin kendisi renksiz: bütün
   görüntü, çevredeki hayali bir stüdyonun yansıması (koyu zemin, keskin
   krem ufuk çizgisi, sıcak turuncu alt ışık, üstte lacivert-mavi dolgu
   ve ince şerit ışıklar). Yüzey eğildikçe bu ışıklar bantlar hâlinde
   kayıyor; krom hissi buradan geliyor.
   - İmleç yüzeye dokunuyor: çevresinde halka halka dalgalar yayılıyor.
   - dim: true verilirse ortadaki başlığın arkası kısılıyor (ana sayfa böyle).
   Kullanım:
     import { mount } from "./hero-chrome.js";
     const scene = mount(canvas, { speed: 1, colors: { ember: "#eb5e1f" } });
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
uniform float uRipple;   // imleç dalgasının gücü      // 1: ortadaki başlık ve motto için arka planı kıs

uniform vec3 INK;
uniform vec3 EMBER;
uniform vec3 GOLD;
uniform vec3 CREAM;
uniform vec3 STEEL;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
/* beşinci dereceden yumuşatma: türevi de pürüzsüz, yansımada kırık çizgi olmuyor */
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

/* metal yüzeyin yüksekliği */
float height(vec2 p, float t) {
  vec2 q = p * 0.72;
  q += 0.6 * vec2(noise(q * 0.9 + vec2(0.0, t * 0.05)), noise(q * 0.9 + vec2(3.7, -t * 0.04)));
  float h = noise(q * 1.3 + t * 0.03) * 0.72 + noise(q * 2.6 - t * 0.05) * 0.28;   // az oktav: iri, sakin kıvrımlar
  vec2 d = p - uMouse;
  float dl = length(d);
  h += uHover * uRipple * 0.013 * cos(dl * 30.0 - t * 2.4) * exp(-dl * dl / 0.03);   // imleç dalgası: hafif ve yavaş
  return h;
}

/* stüdyo: yansıma yönüne (r) göre gelen ışık */
vec3 studio(vec3 r) {
  float v = r.y, u = r.x;
  vec3 c = mix(vec3(0.010, 0.006, 0.018), vec3(0.20, 0.07, 0.03), smoothstep(-0.9, -0.05, v));  // zemin: alttan sıcak
  c = mix(c, EMBER, smoothstep(-0.22, -0.02, v) * 0.75);
  c = mix(c, CREAM, smoothstep(-0.03, 0.0, v) * (1.0 - smoothstep(0.02, 0.09, v)));             // keskin ufuk çizgisi
  float sky = smoothstep(0.02, 0.10, v);
  c = mix(c, mix(STEEL, vec3(0.03, 0.03, 0.08), smoothstep(0.1, 0.75, v)), sky);                // üst: mavi → koyu
  c += CREAM * smoothstep(0.80, 0.90, v) * 0.9;                                                  // tepe ışığı
  c += GOLD * smoothstep(0.90, 0.985, sin(u * 5.0 + v * 2.5)) * 0.55 * sky;                      // şerit ışıklar
  return c;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  const float e = 0.004;
  float h0 = height(p, uTime);
  float hx = height(p + vec2(e, 0.0), uTime);
  float hy = height(p + vec2(0.0, e), uTime);
  vec3 n = normalize(vec3((h0 - hx) / e, (h0 - hy) / e, 1.05));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 col = studio(r);
  col += CREAM * pow(max(dot(n, normalize(vec3(-0.35, 0.55, 0.75))), 0.0), 90.0) * 0.6;   // nokta parlaması
  col *= 0.55 + 0.6 * h0;                                                                  // çukurlar koyu
  // BUGRA'nın arkası kısık, kenarlar koyu
  col *= 1.0 - 0.55 * uDim * exp(-(p.x * p.x * 1.1 + p.y * p.y * 7.0));
  col *= 1.0 - 0.50 * uDim * exp(-(p.x * p.x * 1.6 + (p.y + 0.23) * (p.y + 0.23) * 60.0));   // motto satırı
  col *= 1.0 - 0.5 * smoothstep(0.5, 1.2, length(p * vec2(0.75, 1.0)));
  col = mix(INK, col, 0.92);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.025;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
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
  ripple: 1,         // imleç dalgasının gücü (0: kapalı)
  colors: {
    ink: "#050208",     // zemin
    ember: "#eb5e1f",   // alttan gelen sıcak ışık
    gold: "#ffbd66",    // şerit ışıklar
    cream: "#fff2de",   // ufuk çizgisi ve parlamalar
    steel: "#293d75"    // üstteki soğuk dolgu ışığı
  }
};
const COLOR_UNIFORMS = { ink: "INK", ember: "EMBER", gold: "GOLD", cream: "CREAM", steel: "STEEL" };   // seçenek adı → shader'daki ad

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
  } catch (err) { console.warn("hero-chrome: shader kurulamadı", err); return none; }
  gl.bindAttribLocation(pr, 0, "aPos");
  gl.linkProgram(pr);
  gl.useProgram(pr);
  const U = {};
  for (const n of ["uRes", "uTime", "uMouse", "uHover", "uDim", "uRipple"]) U[n] = gl.getUniformLocation(pr, n);
  gl.uniform1f(U.uDim, opts.dim ? 1 : 0);
  gl.uniform1f(U.uRipple, opts.ripple);
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
    const scale = 1;                              // yumuşak yüzey: CSS çözünürlüğü yetiyor
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
