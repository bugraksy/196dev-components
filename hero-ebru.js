/*!
 * 196dev components · hero-ebru.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Canlı ebru (kağıt marbling)
   Koyu su yüzeyine mürekkep damlıyor; damlalar birbirini iterek halka
   halka açılıyor, imleç tarak gibi içlerinden geçip deseni çekiyor.
   - Açılışta birkaç damla kendiliğinden düşüyor, gerisi kullanıcıda.
   - Tıklama: imlecin olduğu yere yeni bir damla (renkler sırayla).
   - İmleci gezdirmek: mürekkebi peşinden sürükleyip karıştırıyor.
   - Desen hiç silinmiyor. İşlem listesi dolunca en eski tarak izi
     yavaşça geri çözülüyor (o da yoksa en eski damla çekiliyor); ani
     bir değişiklik olmuyor.
   Nasıl çalışıyor: görüntü bir dokuda tutulmuyor. Yapılan her işlem
   (damla / tarak) bir listede; her piksel listeyi sondan başa geri
   sararak "bu noktadaki mürekkep ilk nereden geldi" sorusunu çözüyor
   (matematiksel ebru). Bu yüzden kenarlar her çözünürlükte keskin ve
   hiçbir şey hareket etmiyorken ekran kartı hiç çalışmıyor.
   Kullanım:
     import { mount } from "./hero-ebru.js";
     const scene = mount(canvas, { palette: { ember: "#e65c1f" } });
     scene.destroy();
   Bütün ayarlar aşağıdaki "defaults" nesnesinde.
   ========================================================= */

const N = 128;                                  // en fazla işlem (shader döngüsü)
const KEEP = N - 16;                            // bundan fazlası olunca en eskiler çözülmeye başlıyor

/* renk: "#rrggbb" ya da [r, g, b] (0..1) */
function rgb(c) {
  if (Array.isArray(c)) return c;
  const n = parseInt(String(c).replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* Varsayılan ayarlar: mount(canvas, { ... }) ile istediğini değiştir. */
export const defaults = {
  pointer: true,     // tıklama ve tarak açık mı
  dim: false,        // true: ortadaki başlığın arkasını kıs
  water: "#050208",  // su (zemin) rengi
  /* mürekkepler: kağıt kremi, sıcak turuncular ve termal skaladan lacivert /
     mavi / pembe. "ink" koyu ara halka: renkleri birbirinden ayırıyor */
  palette: {
    cream: "#ede3cc", ember: "#e65c1f", gold: "#fab85c",
    navy: "#0f1a4d", blue: "#387ad6", pink: "#ed5494", ink: "#09050d"
  },
  /* açılışta düşen damlalar: her satır bir nokta, renkler dıştan içe.
     Boş dizi verirsen açılışta hiç damla düşmez. */
  rings: [
    ["ember", "ink", "cream"],
    ["navy", "blue", "cream"],
    ["gold", "ink", "pink"]
  ],
  clickColors: ["cream", "ember", "blue", "gold", "pink", "navy"],  // tıklama renkleri, sırayla
  /* kendiliğinden damlama: her "drip" saniyede bir rastgele bir yere damla
     düşer (renkler clickColors'tan sırayla). 0 = kapalı */
  drip: 0,
  dripSize: 0.06     // damla yarıçapı (ekran yüksekliğine oranla)
};

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform int   uCount;
uniform vec4  uA[${N}];   // xy: yer, z: damla yarıçapı | tarak çekişi, w: 1 damla, 2 tarak
uniform vec4  uB[${N}];   // damla: renk | tarak: xy yön, z keskinlik, w uzunluk
uniform float uAA;        // kenar yumuşatma payı
uniform float uDim;       // 1: ortadaki başlık ve motto için kıs

uniform vec3 WATER;       // su (zemin) rengi

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

void main() {
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 p = p0;
  vec3 col = vec3(0.0);
  float w = 1.0;                                  // henüz boyanmamış pay

  // işlemleri yeniden eskiye geri sar
  for (int i = 0; i < ${N}; i++) {
    if (i >= uCount) break;
    vec4 a = uA[i], b = uB[i];
    if (a.w < 1.5) {
      // damla: içindeysek renk bu; dışındaysak damla bizi dışarı itmişti, geri al
      vec2 d = p - a.xy;
      float d2 = dot(d, d);
      float cov = 1.0 - smoothstep(a.z - uAA, a.z + uAA, sqrt(d2));
      col += w * cov * b.rgb;
      w *= 1.0 - cov;
      if (w < 0.01) break;
      p = a.xy + d * sqrt(max(0.0, 1.0 - a.z * a.z / max(d2, 1e-9)));
    } else {
      // tarak: çizgiye yakın mürekkep yön boyunca sürüklenmişti, geri al
      vec2 rel = p - a.xy;
      float across = abs(dot(rel, vec2(-b.y, b.x)));
      float along = dot(rel, b.xy);
      p -= b.xy * a.z * exp(-across / b.z) * exp(-along * along / (b.w * b.w));
    }
  }
  col += w * WATER;

  // kağıt dokusu: ince gren + yatay lif
  col *= 0.93 + 0.11 * hash(gl_FragCoord.xy);
  col *= 0.96 + 0.07 * noise(gl_FragCoord.xy * vec2(0.07, 0.9));
  // istenirse başlığın ve motto satırının arkası kısık
  col *= 1.0 - 0.50 * uDim * exp(-(p0.x * p0.x * 1.1 + p0.y * p0.y * 7.0));
  col *= 1.0 - 0.50 * uDim * exp(-(p0.x * p0.x * 1.6 + (p0.y + 0.23) * (p0.y + 0.23) * 60.0));
  col *= 1.0 - 0.40 * smoothstep(0.55, 1.2, length(p0 * vec2(0.75, 1.0)));
  gl_FragColor = vec4(col, 1.0);
}
`;

/* Sahneyi canvas'a bağlar; canvas, .hero'yu (yoksa kendi kutusunu) doldurur.
   Dönen nesnenin destroy() metodu her şeyi durdurup dinleyicileri kaldırır. */
export function mount(canvas, options = {}) {
  const opts = { ...defaults, ...options, palette: { ...defaults.palette, ...(options.palette || {}) } };
  const none = { destroy() {} };
  const PAL = {};
  for (const k in opts.palette) PAL[k] = rgb(opts.palette[k]);
  const host = canvas.closest(".hero") || canvas.parentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return none;

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
  } catch (err) { console.warn("hero-ebru: shader kurulamadı", err); return none; }
  gl.bindAttribLocation(pr, 0, "aPos");
  gl.linkProgram(pr);
  gl.useProgram(pr);
  const U = {};
  for (const n of ["uRes", "uCount", "uA", "uB", "uAA", "uDim"]) U[n] = gl.getUniformLocation(pr, n);
  gl.uniform1f(U.uDim, opts.dim ? 1 : 0);
  gl.uniform3fv(gl.getUniformLocation(pr, "WATER"), rgb(opts.water));
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let W = 1, H = 1, aspect = 0;
  let ops = [], clock = 0, dirty = true, clickIdx = 0;
  const A = new Float32Array(N * 4), B = new Float32Array(N * 4);
  const FADE = 0.9;                              // bir işlemin geri çözülme süresi (sn)

  /* açılış: opts.rings'teki her nokta için halka halka damlalar */
  function compose(at) {
    const spots = [[-0.28, 0.07], [0.27, -0.08], [0.02, 0.22], [-0.05, -0.26], [0.40, 0.24], [-0.42, -0.22]];
    const rings = opts.rings.slice(0, spots.length);
    const depth = Math.max(0, ...rings.map((r) => r.length));
    for (let j = 0; j < depth; j++) {
      rings.forEach((ring, i) => {
        if (!ring[j] || !PAL[ring[j]]) return;
        const [x, y] = spots[i];
        ops.push({
          type: 1, x: x * aspect + (j ? (Math.random() - 0.5) * 0.02 : 0), y: y + (j ? (Math.random() - 0.5) * 0.02 : 0),
          r: Math.max(0.03, 0.13 - j * 0.032), col: PAL[ring[j]],
          born: at + 0.4 + (j * rings.length + i) * 0.2, dur: 1.2
        });
      });
    }
    dirty = true;
  }

  function add(op) {
    ops.push(op);
    dirty = true;
    // liste doluyor: en eski tarak izini (yoksa en eski damlayı) çözmeye başla
    const live = ops.filter((o) => o.dying == null);
    if (live.length > KEEP) (live.find((o) => o.type === 2) || live[0]).dying = clock;
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    const first = aspect === 0;
    aspect = W / H;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uAA, 1.2 / canvas.height);
    if (first) compose(reduced ? -20 : 0);
    dirty = true;
  }

  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  function render() {
    ops = ops.filter((o) => o.dying == null || clock - o.dying < FADE);   // çözülmesi bitenler gidiyor
    let n = 0, moving = false;
    for (let i = ops.length - 1; i >= 0 && n < N; i--) {     // yeniden eskiye
      const o = ops[i];
      if (clock < o.born) { moving = true; continue; }
      let e = ease((clock - o.born) / o.dur);
      if (e < 1) moving = true;
      if (o.dying != null) { e *= 1 - ease((clock - o.dying) / FADE); moving = true; }
      if (e < 1e-4) continue;
      const k = n * 4;
      if (o.type === 1) {
        A[k] = o.x; A[k + 1] = o.y; A[k + 2] = o.r * Math.sqrt(e); A[k + 3] = 1;   // alan düzgün büyüsün
        B[k] = o.col[0]; B[k + 1] = o.col[1]; B[k + 2] = o.col[2]; B[k + 3] = 0;
      } else {
        A[k] = o.x; A[k + 1] = o.y; A[k + 2] = o.z * e; A[k + 3] = 2;
        B[k] = o.dx; B[k + 1] = o.dy; B[k + 2] = o.lam; B[k + 3] = o.len;
      }
      n++;
    }
    if (!dirty && !moving) return;                // değişen yok: çizme
    dirty = moving;
    gl.uniform1i(U.uCount, n);
    gl.uniform4fv(U.uA, A);
    gl.uniform4fv(U.uB, B);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const off = new AbortController();             // destroy() bütün dinleyicileri bununla kaldırıyor
  resize();
  if (reduced) {                                 // hareket istemeyenler: oturmuş tek kare
    render();
    window.addEventListener("resize", () => { resize(); render(); }, { signal: off.signal });
    return { destroy() { off.abort(); } };
  }

  /* imleç → p uzayı (merkez 0, yükseklik 1 birim, y yukarı); canvas dışındaysa null */
  const toP = (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return null;
    return [(e.clientX - rect.left - W / 2) / H, -(e.clientY - rect.top - H / 2) / H];
  };
  let anchor = null, lastStroke = 0;
  if (opts.pointer) window.addEventListener("pointermove", (e) => {
    const p = toP(e);
    if (!p) { anchor = null; return; }
    if (!anchor) { anchor = p; return; }
    const dx = p[0] - anchor[0], dy = p[1] - anchor[1], d = Math.hypot(dx, dy);
    if (d < 0.09 || clock - lastStroke < 0.09) return;       // kısa kıpırtılar iz bırakmıyor
    add({ type: 2, x: p[0], y: p[1], dx: dx / d, dy: dy / d, z: Math.min(0.14, d * 0.9), lam: 0.045, len: 0.22, born: clock, dur: 0.5 });
    anchor = p; lastStroke = clock;
  }, { passive: true, signal: off.signal });
  if (opts.pointer) window.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest("a, button")) return;
    const p = toP(e);
    if (!p) return;
    const names = opts.clickColors.filter((c) => PAL[c]);
    if (!names.length) return;
    add({ type: 1, x: p[0], y: p[1], r: 0.075, col: PAL[names[clickIdx++ % names.length]], born: clock, dur: 0.9 });
  }, { signal: off.signal });

  let visible = true, last = -1e9, prev = 0, raf = 0;
  function loop(ms) {
    raf = requestAnimationFrame(loop);
    if (!visible || ms - last < 1000 / 30 - 2) return;
    clock += prev ? Math.min(0.5, (ms - prev) / 1000) : 0;   // gizliyken saat durur
    prev = last = ms;
    if (opts.drip > 0 && clock >= nextDrip) {    // zamanlı damla
      nextDrip = clock + opts.drip * (0.75 + Math.random() * 0.5);
      const names = opts.clickColors.filter((c) => PAL[c]);
      if (names.length) add({
        type: 1, x: (Math.random() - 0.5) * aspect * 0.85, y: (Math.random() - 0.5) * 0.8,
        r: opts.dripSize * (0.7 + Math.random() * 0.6), col: PAL[names[clickIdx++ % names.length]], born: clock, dur: 0.9
      });
    }
    render();
  }
  let nextDrip = 2.5 + opts.drip;                 // açılış damlalarından sonra başla
  raf = requestAnimationFrame(loop);
  window.addEventListener("resize", resize, { signal: off.signal });
  // ekranda değilken çizme
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible) prev = 0; });
  io.observe(host);
  return { destroy() { cancelAnimationFrame(raf); off.abort(); io.disconnect(); } };
}
