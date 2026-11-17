/*!
 * 196dev components · holo.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Holografik folyo kart / sticker (WebGL) — tekrar kullanılabilir modül
   - Gümüş folyo zemini: sabit ince gren + soluk sedef yansıma
   - Gökkuşağı lekeleri: domain-warp'lı fbm gürültüsü, eşik üstünde
     kırmızı → turuncu → sarı → yeşil → mavi → mor bantlara eşleniyor
   - İmleç kartı eğiyor; eğim desenin akışını ve renk kaymasını
     değiştiriyor (ışık açısı değişiyormuş gibi)
   - Mürekkep (yıldız, isim, çizgi, unvan) 2D canvas'ta çiziliyor,
     doku olarak shader'a veriliyor ve folyonun üstüne basılıyor

   Kullanım:
     import { mountHolo } from "./holo.js";
     mountHolo(el, { hoverEl, maxTilt: 14 });
   el: kartın kendisi (boyutu CSS'ten), içine canvas ekleniyor.
   ========================================================= */

const DEFAULTS = {
  title: "Bugra AKSOY",
  sub: "CREATIVE AI DEVELOPER",
  ink: "#0a0a0c",
  maxTilt: 14,          // derece; sticker gibi yapışık kartlarda küçük
  hoverEl: null,        // imlecin dinlendiği alan (varsayılan: kartın kendisi)
  idle: true,           // imleç yokken kendi kendine hafif sallanma
  star: true            // üstteki dört köşeli yıldız; false ise yazı ortalanıyor
};

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uTilt;     // -1..1, kartın eğimi
uniform vec2 uLight;    // 0..1, imlecin kart üzerindeki yeri
uniform sampler2D uInk;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
vec3 hsv(float h, float s, float v){
  vec3 k = clamp(abs(fract(h + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
// pembe/magenta aralığını atlayan ton: turuncu (0.05) ile mavi (0.62) arası gidip geliyor
float safeHue(float x){ return 0.05 + 0.57 * (0.5 + 0.5 * sin(x * 6.2832)); }

// termal folyo paleti: geniş kırmızı/turuncu, ince sarı-yeşil, derin mavi-mor
vec3 therm(float h){
  vec3 c = mix(vec3(0.93, 0.24, 0.12), vec3(1.0, 0.47, 0.12), smoothstep(0.00, 0.22, h));
  c = mix(c, vec3(1.0, 0.86, 0.30), smoothstep(0.26, 0.36, h));
  c = mix(c, vec3(0.42, 0.86, 0.45), smoothstep(0.38, 0.46, h));
  c = mix(c, vec3(0.22, 0.42, 1.0), smoothstep(0.48, 0.60, h));
  c = mix(c, vec3(0.34, 0.25, 0.92), smoothstep(0.66, 0.90, h));   // mavimsi mor, pembeye kaçmıyor
  return c;
}

void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.035;

  // akış alanı: desen yavaşça kıvrılıyor, eğimle kayıyor
  vec2 q = vec2(fbm(p * 1.5 + vec2(0.0, t) + uTilt * 0.35),
                fbm(p * 1.5 + vec2(5.2, 1.3) - t - uTilt * 0.25));
  float g = fbm(p * 0.8 + q * 1.2 + uTilt * vec2(0.9, 0.6) + 3.1);

  // gümüş zemin: hafif bulutlu, soğuk gri
  float cloud = fbm(p * 3.0 + q);
  vec3 silver = vec3(0.86, 0.87, 0.89) + (cloud - 0.5) * 0.2;
  float f = fbm(p * 2.2 + q * 2.0);
  silver = mix(silver, hsv(safeHue(f * 1.6 + uTilt.x * 0.25 + uTilt.y * 0.2), 0.45, 1.0), 0.11);

  // gökkuşağı lekeleri: kenarı kırmızı, içe doğru mor
  float edge = 0.535 - uTilt.y * 0.02;
  float band = smoothstep(edge, edge + 0.025, g);
  float h = clamp((g - edge) / 0.17 + uTilt.x * 0.06, 0.0, 1.0);
  vec3 rain = therm(h);
  rain *= 0.9 + 0.2 * noise(p * 40.0);
  vec3 col = mix(silver, rain, band * 0.96);

  // ince gren: sabit (karede değişmiyor, hareket eden kare yok)
  vec2 uvPx = vUv * uRes;
  col += (hash(floor(uvPx)) - 0.5) * 0.06;

  // imleç ışığı: yumuşak parlama + kenarda yanardöner halka
  vec2 lp = (uLight - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float d = length(p - lp);
  col += exp(-d * d * 5.0) * 0.26;
  col += hsv(safeHue(d * 1.2 - uTime * 0.03), 0.5, 1.0) * exp(-pow(d - 0.45, 2.0) * 30.0) * 0.07;

  // mürekkep baskısı
  float ink = texture2D(uInk, vUv).a;
  col = mix(col, vec3(0.04, 0.04, 0.05), ink * 0.96);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export function mountHolo(el, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const canvas = document.createElement("canvas");
  canvas.className = "holo__canvas";
  canvas.setAttribute("aria-hidden", "true");
  el.appendChild(canvas);
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["uRes", "uTime", "uTilt", "uLight", "uInk"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  const inkTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, inkTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.uInk, 0);

  /* ---------- mürekkep katmanı ---------- */
  function drawInk(W, H) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = o.ink;
    g.strokeStyle = o.ink;

    const x0 = W / 2;
    // yıldız yoksa yazı grubu dikeyde ortaya kayıyor
    const dy = o.star ? 0 : -0.14;
    if (o.star) {
      // dört köşeli, içbükey yıldız
      const y0 = H * 0.27, r = H * 0.15, k = r * 0.2;
      g.beginPath();
      g.moveTo(x0, y0 - r);
      g.quadraticCurveTo(x0 + k, y0 - k, x0 + r, y0);
      g.quadraticCurveTo(x0 + k, y0 + k, x0, y0 + r);
      g.quadraticCurveTo(x0 - k, y0 + k, x0 - r, y0);
      g.quadraticCurveTo(x0 - k, y0 - k, x0, y0 - r);
      g.fill();
    }

    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.font = `800 ${Math.round(H * 0.125)}px Archivo, system-ui, sans-serif`;
    if ("letterSpacing" in g) g.letterSpacing = `${(H * 0.004).toFixed(1)}px`;
    g.fillText(o.title, x0, H * (0.69 + dy));

    g.lineWidth = Math.max(1, H * 0.0055);
    g.beginPath();
    g.moveTo(W * 0.24, H * (0.755 + dy));
    g.lineTo(W * 0.76, H * (0.755 + dy));
    g.stroke();

    g.font = `600 ${Math.round(H * 0.043)}px Archivo, system-ui, sans-serif`;
    if ("letterSpacing" in g) g.letterSpacing = `${(H * 0.019).toFixed(1)}px`;
    g.fillText(o.sub, x0 + H * 0.0095, H * (0.845 + dy));

    gl.bindTexture(gl.TEXTURE_2D, inkTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
    if (!W || !H || (W === canvas.width && H === canvas.height)) return;
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.uRes, W, H);
    drawInk(W, H);
  }

  /* ---------- etkileşim ---------- */
  const hoverEl = o.hoverEl || el;
  let tx = 0, ty = 0, cx = 0, cy = 0;     // hedef / mevcut eğim (-1..1)
  let lx = 0.5, ly = 0.5, clx = 0.5, cly = 0.5;
  let hovering = false;

  hoverEl.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    hovering = true;
    tx = Math.max(-1, Math.min(1, nx * 2 - 1));
    ty = Math.max(-1, Math.min(1, ny * 2 - 1));
    lx = nx; ly = 1 - ny;
  });
  hoverEl.addEventListener("pointerleave", () => { hovering = false; });

  let visible = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(el);
  }
  window.addEventListener("resize", () => { canvas.width = 0; });

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const t0 = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - t0) / 1000;
    if (!hovering) {
      if (o.idle && !reduce) {
        tx = Math.sin(t * 0.5) * 0.45;
        ty = Math.sin(t * 0.37 + 1.0) * 0.3;
      } else { tx = 0; ty = 0; }
      lx = 0.5 + tx * 0.35; ly = 0.5 - ty * 0.35;
    }
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    clx += (lx - clx) * 0.1; cly += (ly - cly) * 0.1;

    el.style.setProperty("--holo-ry", `${(cx * o.maxTilt).toFixed(2)}deg`);
    el.style.setProperty("--holo-rx", `${(-cy * o.maxTilt * 0.8).toFixed(2)}deg`);

    resize();
    gl.uniform1f(U.uTime, reduce ? 0 : t);
    gl.uniform2f(U.uTilt, cx, cy);
    gl.uniform2f(U.uLight, clx, cly);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const ready = document.fonts && document.fonts.load
    ? Promise.all([
        document.fonts.load('800 40px "Archivo"'),
        document.fonts.load('600 20px "Archivo"')
      ]).catch(() => {})
    : Promise.resolve();
  ready.then(() => requestAnimationFrame(frame));
  return { canvas };
}
