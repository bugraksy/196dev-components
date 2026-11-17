/*!
 * 196dev components · hero-ascii.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   Hero arka planı: ASCII kara delik (WebGL)
   - Video koymuyoruz; her kare GPU'da formülle üretiliyor, iki geçişte:
       1) HESAP: her karakter hücresi için parlaklık BİR KEZ hesaplanıp
          hücre ızgarası boyutunda küçük bir dokuya yazılıyor
          (1080p'de ~50 bin hücre — piksel başına değil).
       2) ÇİZİM: her piksel o dokudan kendi hücresinin değerini okuyup
          karakter atlasından uygun karakteri basıyor; burada ağır hesap yok.
     Kare hızı 30 fps'e sabit: sahne yavaş hareket ediyor, fark görünmüyor.
   - Sahne: karanlık gölge + foton halkası + yatay birikim diski +
     diskin ışığı bükülüp gölgenin üstünden/altından geçen halo.
   - Hareket: disk ve halo Kepler hızıyla dönüyor (içerisi hızlı),
     madde spiral çizerek içeri akıyor, disk yavaşça yalpalıyor,
     halka nefes alıyor, karakterler yer yer karışıp parlıyor,
     seyrek kıvılcımlar yörüngede dönüyor, açılışta merkezden dışa
     yayılıyor.
   - İmleç kara deliğe yaklaştıkça bir madde akıntısı imleçten deliğe
     doğru spiral çizerek çekiliyor (yaklaştıkça güçleniyor). İmlecin
     kendisinin içeri çekilmesi cursor.js'te; ikisi aynı formülü
     window.__blackHole üzerinden paylaşıyor.
   Kullanım:
     import { mount } from "./hero-ascii.js";
     const scene = mount(canvas, { holeY: 0.5, color: (b) => `hsl(20 90% ${b * 70}%)` });
     scene.destroy();
   Bütün ayarlar aşağıdaki "defaults" nesnesinde.
   ========================================================= */

/* renk: "#rrggbb" ya da [r, g, b] (0..1) */
function rgb(c) {
  if (Array.isArray(c)) return c;
  const n = parseInt(String(c).replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* Varsayılan ayarlar: mount(canvas, { ... }) ile istediğini değiştir. */
export const defaults = {
  ramp: " .'`,:;-~=+*cxoO0#%&@",   // karakterler, koyudan parlağa
  color: colorFor,                  // parlaklık (0..1) → CSS rengi veren fonksiyon
  background: "#050208",
  holeY: 0.48,                      // kara deliğin dikey yeri (yükseklik oranı)
  pointer: true,                    // imleç madde akıntısı çeksin mi
  /* gizli kelimeler: her satırda kelimeler kayıyor ama karanlıkta kaldıkları
     için görünmüyorlar. İmleç bir mercek gibi çevresini büküp aydınlatıyor,
     altındaki kelimeler okunur oluyor. false = kapalı */
  hidden: true,
  tokens: [
    "attention", "embedding", "transformer", "latent", "gradient", "softmax",
    "logits", "tokenizer", "context", "prompt", "agent", "inference", "vector",
    "<bos>", "<eos>", "[MASK]", "lr=3e-4", "temperature=0.7", "def forward(x):",
    "import torch", "model.eval()", "x @ W + b", "await think()", "return y", "git push"
  ]
};
const LEVELS = 32;
const VARIANTS = 3;                           // her seviyede komşu karakterlerden 3 çeşit
const TAPE_LEN = 2048;                        // kelime şeridinin uzunluğu (karakter)
const GLYPHS = 95;                            // ASCII 32..126
const ACOLS = VARIANTS + GLYPHS;              // atlas sütunu: önce ramp çeşitleri, sonra ASCII

function buildTape(words) {
  const a = new Uint8Array(TAPE_LEN).fill(32);
  const list = words.map((w) => String(w).replace(/[^ -~]/g, "")).filter(Boolean);
  if (!list.length) return a;
  let i = 0, k = 0, sd = 196;
  const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  while (i < TAPE_LEN) {
    const w = list[(k++ * 7 + Math.floor(rnd() * list.length)) % list.length];
    if (i + w.length > TAPE_LEN) break;
    for (let j = 0; j < w.length; j++) a[i++] = w.charCodeAt(j);
    i += 1 + Math.floor(rnd() * 3);
  }
  return a;
}

/* ---------------- karakter atlası ----------------
   satır = parlaklık seviyesi, sütun = çeşit. Shader buradan okuyor. */

function colorFor(b) {
  // koyu kızıl → turuncu → altın → sıcak beyaz
  const r = Math.round(80 + 175 * Math.min(1, b * 1.35));
  const g = Math.round(20 + 205 * Math.pow(b, 1.6));
  const bl = Math.round(10 + 170 * Math.pow(b, 3.4));
  return `rgb(${r},${g},${bl})`;
}

function buildAtlas(cw, ch, RAMP, colorFor) {
  const c = document.createElement("canvas");
  c.width = cw * VARIANTS;
  c.height = ch * LEVELS;
  c.width = cw * ACOLS;
  const x = c.getContext("2d");
  x.font = `600 ${Math.round(ch * 1.02)}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  x.textBaseline = "alphabetic";
  x.textAlign = "center";
  const n = RAMP.length - 1;
  for (let i = 1; i < LEVELS; i++) {
    const b = i / (LEVELS - 1);
    const base = Math.round(b * n);
    x.fillStyle = colorFor(b);
    x.shadowColor = colorFor(b);
    x.shadowBlur = b > 0.7 ? (ch / 3) * (b - 0.7) / 0.3 : 0;   // en parlaklara hafif ışıma
    for (let k = 0; k < VARIANTS; k++) {
      const idx = Math.max(1, Math.min(n, base + (k === 0 ? 0 : k === 1 ? -1 : 1)));
      x.fillText(RAMP[idx], k * cw + cw / 2, i * ch + ch * 0.86);
    }
    x.shadowBlur = 0;                           // kelime harfleri: komşuya taşmasın
    for (let g = 1; g < GLYPHS; g++) x.fillText(String.fromCharCode(32 + g), (VARIANTS + g) * cw + cw / 2, i * ch + ch * 0.86);
  }
  return c;
}

/* ---------------- shader ---------------- */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/* 1) HESAP geçişi: çıktı dokusunun her pikseli = bir karakter hücresi */
const COMP = `
precision highp float;

uniform vec2  uGrid;     // hücre ızgarası (sütun, satır)
uniform vec2  uCell;     // hücre boyutu, cihaz pikseli
uniform vec2  uCenter;   // kara delik merkezi, cihaz pikseli (üstten)
uniform vec2  uCursor;   // imleç, cihaz pikseli (üstten)
uniform float uPull;     // imlecin çekim gücü 0..1 (yaklaştıkça artar)
uniform float uR;        // gölge yarıçapı, cihaz pikseli
uniform float uTime;
uniform float uTilt;
uniform float uBreath;
uniform float uIntro;
uniform float uLens;     // imleç merceği: imleç sahnede mi (0..1, yumuşatılmış; 0 = kapalı)
uniform sampler2D uTape; // kelime şeridi (karakter kodları)
uniform float uTokensOn; // 1: kelimeler imleç olmadan da parlak bölgelerde yazsın
const float TAPE = ${TAPE_LEN}.0;

const float PI = 3.14159265;
const float FLOW_P = 7.0;   // akış dokusunun sıfırlanma periyodu (sn)

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
/* açıya göre dikişsiz (cos/sin üzerinden), iki oktav — dönen girdap dokusu */
float swirl(float ang, float rr, float t) {
  vec2 cs = vec2(cos(ang), sin(ang));
  float n1 = vnoise(cs * 3.0 + vec2(rr * 7.0 - t * 0.9, rr * 2.5));
  float n2 = vnoise(cs * 7.5 + vec2(rr * 16.0 + 11.0, rr * 5.0 - t * 1.4));
  return n1 * 0.65 + n2 * 0.35;
}

/* bir hücrenin parlaklığı. x,y: R biriminde, merkeze göre (y aşağı +) */
float shade(float x, float y, float rho, float phi, float t) {
  float beam = 0.5 + 0.5 * (-x / (rho + 0.001));            // sol (yaklaşan) taraf parlak
  float v = 0.0;

  /* 1) foton halkası: ince, nefes alan, üzerinde dalgalanan parlaklık */
  float r1 = 1.0 + uBreath * 0.012;
  float ring  = exp(-pow((rho - r1) / 0.038, 2.0));
  float ring2 = exp(-pow((rho - r1 - 0.11) / 0.03, 2.0)) * 0.45;
  float ripple = 0.75 + 0.25 * sin(phi * 9.0 - t * 3.2) * sin(phi * 4.0 + t * 1.3);
  v += (ring * 0.9 + ring2) * (0.35 + 0.45 * beam) * ripple;

  /* 2) bükülmüş halo: diskin arka yüzü gölgenin üstünden/altından geçer */
  if (rho > 0.97) {
    float s = abs(sin(phi));
    float above = y < 0.0 ? 1.0 : 0.55;                     // üst yay daha güçlü
    float reach = 0.14 + 0.8 * pow(s, 1.2) * (y < 0.0 ? 1.0 : 0.75);
    float fall = exp(-(rho - 1.0) / reach);
    float om = 1.25 / pow(rho, 1.5);                        // Kepler: içte hızlı
    float spiral = log(rho) * 2.2;                          // içe akan spiral kolları
    /* farklı hızda dönen halkalar zamanla dokuyu sonsuza dek sarar; bunu
       önlemek için iki fazlı akış: biri sıfırlanırken öteki görünür */
    float wA = mod(t, FLOW_P) / FLOW_P;
    float wB = fract(wA + 0.5);
    float kA = 1.0 - abs(2.0 * wA - 1.0);
    float n = mix(swirl(phi + wB * FLOW_P * om + spiral, rho + 3.7, t),
                  swirl(phi + wA * FLOW_P * om + spiral, rho, t), kA);
    float streak = 0.2 + 1.5 * n * n;
    v += fall * above * streak * (0.4 + 1.0 * beam) * 1.9;
  }

  /* 3) yatay birikim diski: öne doğru geçen bant, sola uzun kuyruk.
        uTilt: diskin yavaş yalpalaması (eğim + kalınlık) */
  // ön çizgi kıpırdasın: üzerinde ilerleyen hafif bir dalga
  float wave = sin(x * 7.0 - t * 2.6) * 0.012 + sin(x * 17.0 + t * 4.1) * 0.005;
  float dy = y - 0.06 - x * (0.025 + uTilt * 0.03) - wave;
  float ax = abs(x);
  float thick = (0.045 + 0.1 * min(1.0, ax / 2.4)) * (1.0 + uTilt * 0.35);
  float side = x < 0.0 ? 3.3 : 2.2;                         // sol uzun, sağ kısa
  if (ax < side && abs(dy) < thick * 3.0) {
    float band = exp(-pow(dy / thick, 2.0));
    float taper = pow(1.0 - ax / side, 1.1);
    // diskin önü soldan sağa akıyor; içe yakın kısım daha hızlı
    float om = 1.8 / pow(max(ax, 0.55), 1.5);
    float wA = mod(t, FLOW_P) / FLOW_P;
    float wB = fract(wA + 0.5);
    float kA = 1.0 - abs(2.0 * wA - 1.0);
    float fA = x * 6.0 - wA * FLOW_P * om * 2.4;
    float fB = x * 6.0 - wB * FLOW_P * om * 2.4 + 31.0;
    float nA = vnoise(vec2(fA, dy * 40.0 + t * 0.6)) * 0.7 + vnoise(vec2(fA * 2.3 + 5.0, dy * 70.0)) * 0.3;
    float nB = vnoise(vec2(fB, dy * 40.0 + t * 0.6)) * 0.7 + vnoise(vec2(fB * 2.3 + 5.0, dy * 70.0)) * 0.3;
    float n = mix(nB, nA, kA);
    // ön çizgide ilerleyen parlak atımlar
    float pulse = pow(0.5 + 0.5 * sin(x * 4.5 - t * 3.4), 4.0) * 0.9
                + pow(0.5 + 0.5 * sin(x * 11.0 - t * 5.3 + 1.7), 6.0) * 0.5;
    float inner = ax < 0.97 ? 0.6 + pulse : 1.0 + pulse * 0.35;
    v += band * taper * (0.25 + 2.1 * n * n) * (x < 0.0 ? 1.9 : 1.05) * inner;
  }

  /* imleç akıntısı: imleçten deliğe spiral çizerek çekilen madde */
  if (uPull > 0.01) {
    vec2 m = (uCursor - uCenter) / uR;
    float rm = length(m);
    if (rm > 1.05 && rho > 0.97 && rho < rm + 0.1) {
      float am = atan(m.y, m.x);
      float u = clamp((rm - rho) / (rm - 1.0), 0.0, 1.0);    // 0: imleç, 1: halka
      float a = am + u * u * 1.6;                            // düştükçe sarılıyor
      float da = mod(phi - a + PI, 2.0 * PI) - PI;
      float dist = abs(da) * rho;
      float w = 0.05 + 0.17 * (1.0 - u) * (0.4 + 0.6 * uPull);            // imleçte geniş, delikte ince
      float g = exp(-pow(dist / w, 2.0));
      float fl = vnoise(vec2(u * 16.0 - t * 7.0, da * 30.0));  // içeri doğru akan topaklar
      float ends = smoothstep(0.0, 0.12, u);
      v += g * ends * (0.45 + 1.8 * fl * fl) * (0.6 + 0.9 * u) * sqrt(uPull) * 2.6;
    }
    // imlecin etrafı hafifçe aydınlanıyor
    float dm = length(vec2(x, y) - m);
    v += exp(-pow(dm / (0.14 + 0.12 * uPull), 2.0)) * sqrt(uPull) * 0.8
       * (0.6 + 0.4 * vnoise(vec2(x, y) * 30.0 + t * 3.0));
  }

  /* 4) gölgenin içi kapkara (ön diskin ince çizgisi hariç) */
  if (rho < 0.95) {
    float inDisk = abs(dy) < thick * 1.2 ? 0.7 : 0.0;
    v *= exp(-(0.95 - rho) * 20.0) * 0.3 + inDisk;
  }

  /* 5) dışa doğru kararma */
  v *= 1.0 / (1.0 + pow(rho / 2.3, 6.0));
  return v;
}

/* seyrek toz: halo dışında diske paralel basık yörüngede dönen kıvılcımlar */
float dust(float x, float y, float rho, float t, float ci) {
  if (rho < 1.15 || rho > 3.2) return 0.0;
  float phi = atan(y * 2.2, x);
  float a = phi + t * 0.6 / pow(rho, 1.5);
  float h = hash(vec2(floor(a * 26.0), floor(rho * 14.0)));
  if (h < 0.965) return 0.0;
  float tw = 0.5 + 0.5 * sin(t * 4.0 + h * 50.0 + ci * 0.3);
  return tw * 0.5 * (1.0 - rho / 3.2);
}

void main() {
  // bu piksel = hücre (sütun, üstten satır)
  vec2 cell = vec2(floor(gl_FragCoord.x), uGrid.y - 1.0 - floor(gl_FragCoord.y));
  vec2 c = ((cell + 0.5) * uCell - uCenter) / uR;
  float y0 = c.y;                                            // bükülmemiş satır
  float t = uTime;

  /* imleç merceği: imleç ikinci bir kütle gibi çevresini büküyor */
  vec2 dc = c - (uCursor - uCenter) / uR;
  float d2 = dot(dc, dc);
  c -= dc * uLens * 0.02 / (d2 + 0.03);
  float rho = length(c);

  float v = 0.0;
  if (rho < 3.6 && rho < uIntro) {
    v = shade(c.x, c.y, rho, atan(c.y, c.x), t);
    if (v < 0.07) v = dust(c.x, c.y, rho, t, cell.x);
    if (uIntro < 99.0) v *= min(1.0, (uIntro - rho) * 2.0);
  }
  // merceğin içi aydınlanıyor: karanlıkta kalan kelimeler okunur oluyor
  v += exp(-d2 / 0.09) * uLens * 0.55 * (0.55 + 0.45 * vnoise(c * 30.0 + t * 3.0));

  // hücre başına titreşim: tarama dokusu (saniyede 9 kez değişiyor)
  float hv = hash(cell + vec2(floor(t * 9.0) * 31.0, 0.0));
  v *= 0.86 + 0.28 * hv;

  /* kelime şeridi: her satır yatay kayıyor. Üst yarı sola, alt yarı sağa;
     merkeze yakın satırlar hızlı (dönme hissi) */
  float code = 0.0;
  if (uLens > 0.0 || uTokensOn > 0.5) {
    float rh = hash(vec2(cell.y, 7.0));
    float speed = (3.0 + 9.0 * rh) / (0.6 + abs(y0 - 0.06));
    float dirn = y0 < 0.0 ? 1.0 : -1.0;
    float idx = mod(cell.x + floor(rh * TAPE) + dirn * floor(t * speed), TAPE);
    code = floor(texture2D(uTape, vec2((idx + 0.5) / TAPE, 0.5)).r * 255.0 + 0.5);
    if (v < 0.2 || code < 33.0 || hv > 0.96) code = 0.0;   // sönükler ramp karakteri kalıyor
  }

  // r: parlaklık (0..1.6 → 0..1), g: çeşit için rastgele, b: karakter kodu (0 = ramp)
  gl_FragColor = vec4(clamp(v / 1.6, 0.0, 1.0), hv, code / 255.0, 1.0);
}
`;

/* 2) ÇİZİM geçişi: her piksel kendi hücresinin değerini okuyup karakteri basıyor */
const DRAW = `
precision highp float;

uniform vec2  uRes;      // canvas, cihaz pikseli
uniform vec2  uCell;     // hücre boyutu, cihaz pikseli
uniform vec2  uGrid;     // hücre ızgarası (sütun, satır)
uniform vec3  uBg;
uniform sampler2D uAtlas;
uniform sampler2D uVal;  // hesap geçişinin çıktısı

const float LEVELS = ${LEVELS}.0;
const float VARIANTS = ${VARIANTS}.0;
const float ACOLS = ${ACOLS}.0;

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);   // üstten piksel
  vec2 cell = floor(p / uCell);
  vec2 local = fract(p / uCell);
  vec4 d = texture2D(uVal, vec2((cell.x + 0.5) / uGrid.x, 1.0 - (cell.y + 0.5) / uGrid.y));
  float v = d.r * 1.6;
  float hv = d.g;

  vec3 col = uBg;
  float lv = min(LEVELS - 1.0, floor(v * (LEVELS - 1.0)));
  if (v >= 0.07 && lv >= 1.0) {
    // karakter karışması: parlak bölgelerde daha sık
    float variant = hv > 0.8 - v * 0.25 ? (hv > 0.93 ? 2.0 : 1.0) : 0.0;
    float code = floor(d.b * 255.0 + 0.5);
    float colIdx = code > 32.5 ? VARIANTS + code - 32.0 : variant;
    vec2 uv = vec2((colIdx + local.x) / ACOLS, (lv + local.y) / LEVELS);
    vec4 g = texture2D(uAtlas, uv);
    col = mix(uBg, g.rgb, g.a);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ---------------- kurulum ----------------
   Sahneyi canvas'a bağlar; canvas, .hero'yu (yoksa kendi kutusunu) doldurur.
   Dönen nesnenin destroy() metodu her şeyi durdurup dinleyicileri kaldırır. */

export function mount(canvas, options = {}) {
  const opts = { ...defaults, ...options };
  const heroEl = canvas.closest(".hero") || canvas.parentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const off = new AbortController();             // destroy() bütün dinleyicileri bununla kaldırıyor
  let raf = 0, io = null;

  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  let progC, progD, UC = {}, UD = {}, atlasTex, valTex, fbo;
  let W = 0, H = 0, dpr = 1, cellW = 5, cellH = 8, cols = 1, rows = 1;
  let mx = -1e4, my = -1e4;                     // imleç, ekran pikseli
  let pull = 0, seen = 0;                                  // yumuşatılmış çekim gücü
  /* kara deliğin ekrandaki yeri: cursor.js imleci buna göre içeri çekiyor */
  const hole = (window.__blackHole = { x: 0, y: 0, r: 1, active: false });
  let t0 = 0;
  /* kara deliğin dikey yeri (hero yüksekliğinin oranı). hero-bugra.js de
     aynı değeri kullanıyor: ikisini birlikte değiştir. Kara delik + BUGRA +
     motto grubu, alttaki kağıt geçişi dahil hero'nun ortasına otursun diye. */
  const HOLE_Y = opts.holeY;

  function program(fragSrc, names, store) {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.bindAttribLocation(pr, 0, "aPos");        // iki program aynı üçgeni kullanıyor
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    for (const n of names) store[n] = gl.getUniformLocation(pr, n);
    return pr;
  }

  function makeTex(unit, filter) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function setup() {
    progC = program(COMP, ["uGrid", "uCell", "uCenter", "uCursor", "uPull", "uR",
                           "uTime", "uTilt", "uBreath", "uIntro", "uLens", "uTape", "uTokensOn"], UC);
    progD = program(DRAW, ["uRes", "uCell", "uGrid", "uBg", "uAtlas", "uVal"], UD);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    atlasTex = makeTex(0, gl.LINEAR);              // birim 0: karakter atlası
    valTex = makeTex(1, gl.NEAREST);               // birim 1: hücre değerleri (hesap çıktısı)
    fbo = gl.createFramebuffer();

    gl.useProgram(progD);
    gl.uniform1i(UD.uAtlas, 0);
    gl.uniform1i(UD.uVal, 1);
    // birim 2: kelime şeridi (1 piksel yüksek, karakter kodları)
    const tape = makeTex(2, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, TAPE_LEN, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, buildTape(opts.tokens || []));
    gl.useProgram(progC);
    gl.uniform1i(UC.uTape, 2);
    gl.uniform1f(UC.uTokensOn, 0);
    gl.uniform3fv(UD.uBg, rgb(opts.background));
  }

  function resize() {
    const rect = heroEl.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // dar ekranda hücre biraz büyük: okunur kalsın
    const small = W < 720;
    const cssW = small ? 6 : 5, cssH = small ? 10 : 8;
    // hücreyi tam cihaz pikseline yuvarla: karakterler bulanıklaşmasın
    cellW = Math.max(3, Math.round(cssW * dpr));
    cellH = Math.max(5, Math.round(cssH * dpr));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    cols = Math.ceil(canvas.width / cellW);
    rows = Math.ceil(canvas.height / cellH);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas(cellW, cellH, opts.ramp, opts.color));

    // hesap çıktısı: ızgara boyutunda doku + ona yazan framebuffer
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, valTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, valTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(progC);
    gl.uniform2f(UC.uGrid, cols, rows);
    gl.uniform2f(UC.uCell, cellW, cellH);
    gl.uniform2f(UC.uCenter, canvas.width * 0.5, canvas.height * HOLE_Y);
    gl.uniform1f(UC.uR, Math.min(canvas.width * 0.115, canvas.height * 0.2));   // gölge yarıçapı

    gl.useProgram(progD);
    gl.uniform2f(UD.uRes, canvas.width, canvas.height);
    gl.uniform2f(UD.uCell, cellW, cellH);
    gl.uniform2f(UD.uGrid, cols, rows);
  }

  /* imleç → çekim gücü: halkanın ~3.8 katı uzaklıkta başlar, halkada 1 olur.
     cursor.js de aynı formülü kullanıyor (bkz. window.__blackHole). */
  function pullAt(q) {
    const s = Math.min(1, Math.max(0, (3.8 - q) / 2.8));
    return Math.pow(s, 1.6);
  }

  function frame(ms) {
    const t = (ms - t0) / 1000;
    const rect = canvas.getBoundingClientRect();
    const hr = Math.min(W * 0.115, H * 0.2);
    hole.x = rect.left + W * 0.5;
    hole.y = rect.top + H * HOLE_Y;
    hole.r = hr;
    const q = Math.hypot(mx - hole.x, my - hole.y) / hr;
    pull += (pullAt(q) - pull) * 0.12;
    const inside = mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom;
    seen += ((inside ? 1 : 0) - seen) * 0.15;

    // 1) hesap: ızgara boyutunda, hücre başına bir kez
    gl.useProgram(progC);
    gl.uniform2f(UC.uCursor, (mx - rect.left) * dpr, (my - rect.top) * dpr);
    gl.uniform1f(UC.uPull, pull);
    gl.uniform1f(UC.uLens, opts.hidden && opts.pointer ? seen : 0);
    gl.uniform1f(UC.uTime, t);
    gl.uniform1f(UC.uTilt, Math.sin(t * 0.35) * 0.6 + Math.sin(t * 0.13) * 0.4);
    gl.uniform1f(UC.uBreath, Math.sin(t * 1.1));
    // açılış: merkezden dışa doğru ~1.6 sn'de yayılıyor
    gl.uniform1f(UC.uIntro, reduced ? 99 : Math.min(99, Math.pow(Math.max(t, 0) / 1.6, 1.4) * 3.6));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, cols, rows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2) çizim: tam ekran, sadece doku okuma
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(progD);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------------- döngü ---------------- */

  let visible = true;
  let last = -1e9;
  const FRAME_MS = 1000 / 30;                    // 30 fps

  function loop(ms) {
    raf = requestAnimationFrame(loop);
    hole.active = visible;
    // 60/120 Hz ekranda her 2./4. karede çiz; küçük sapmalar için 2 ms pay
    if (!visible || ms - last < FRAME_MS - 2) return;
    last = ms;
    frame(ms);
  }

  function start() {
    if (!gl) return;                             // WebGL yoksa düz koyu zemin kalır
    try { setup(); } catch (err) { console.warn("hero-ascii: shader kurulamadı", err); return; }
    resize();
    t0 = performance.now();
    if (reduced) {
      const draw = () => frame(t0 + 4000);
      draw();
      window.addEventListener("resize", () => { resize(); draw(); }, { signal: off.signal });
      return;
    }
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize, { signal: off.signal });
    if (opts.pointer) window.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true, signal: off.signal });
    document.addEventListener("mouseleave", () => { mx = my = -1e4; }, { signal: off.signal });
    // hero ekrandan çıkınca çizimi durdur
    io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(heroEl);
  }

  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);

  return { destroy() { cancelAnimationFrame(raf); off.abort(); if (io) io.disconnect(); hole.active = false; } };
}
