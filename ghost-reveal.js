/*!
 * 196dev components · ghost-reveal.js
 * (c) 2026 Buğra Arda Aksoy · https://github.com/bugraksy/196dev-components
 * MIT License: free to use, change and share; keep this notice in copies.
 */
/* =========================================================
   GHOST REVEAL — text-reveal.js'in kaydedilmiş bir varyantı:
   harfler uzaktan, geniş aralıklı ve uzun hayalet iziyle geliyor.
   (text-reveal.js referans videoya göre daha sıkı ayarlandı.)

   Harf harf "havadan beliren" yazı animasyonu
   Referans kayıttan kare kare çıkarıldı:
   - Yazı tamamen görünmez başlıyor, harfler soldan sağa sırayla geliyor.
   - Her harf, kendi solundaki bir nokta etrafında saat yönünde dönmüş
     halde ve biraz aşağıda başlıyor (sağa doğru aşağı inen bir yay).
     Bu yüzden henüz gelmemiş harfler aşağı kıvrılan bir kuyruk gibi görünüyor.
   - Başta görünmez, çok bulanık ve lavanta/mor; yerine oturdukça
     netleşip beyaza dönüyor.
   - Harf başına ~0.9 sn, harfler arası ~0.11 sn (30 fps kayıtta ~3.4 kare).

   Kullanım:
     import { reveal } from "./ghost-reveal.js";
     const anim = reveal(document.querySelector(".baslik"));
     anim.play();    // yeniden oynat
   ========================================================= */

const DEFAULTS = {
  delay: 120,          // ms, ilk harften önce
  stagger: 100,        // ms, harfler arası
  duration: 1050,      // ms, tek harfin süresi
  angle: 26,           // derece, harfin başladığı yana yatma
  turn: -62,           // derece, 3B dönüş (Y ekseni): harf yandan/arkadan geliyor
  perspective: 420,    // px
  grow: 1.35,          // başlangıç büyüklüğü
  shiftX: 1.3,         // em, başlangıçta sağa kayma: harf sağdan sola süzülüyor, iz sağa uzuyor
  drop: 0.45,          // em, harfin başladığı ek aşağı kayma
  pivot: -0.7,         // em, dönüş noktası (harfin solunda)
  trail: 6,            // hareket izi için hayalet kopya sayısı
  trailLag: 32,        // ms, her hayaletin gecikmesi
  trailOpacity: 0.45,  // hayaletlerin en yüksek opaklığı
  blur: 9,             // px, başlangıç bulanıklığı
  from: "#9a8ce0",     // başlangıç rengi (lavanta)
  mid: "#c9bff3",      // yarı yolda
  to: null             // bitiş rengi (null: öğenin kendi rengi)
};

export function reveal(el, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const text = el.textContent;
  el.setAttribute("aria-label", text);
  el.textContent = "";

  /* Her karakter bir kutu: içinde asıl harf + arkasından gelen birkaç
     "hayalet" kopya. Hayaletler aynı yolu biraz gecikmeli izliyor ve
     daha soluk: harfin arkasında videodaki gibi bir hareket izi (smear)
     bırakıyorlar. Sonda hepsi asıl harfin üstüne oturup kayboluyor. */
  const chars = [...text].map((ch) => {
    const box = document.createElement("span");
    box.className = "tr-ch";
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "display:inline-block;position:relative;";
    const glyph = ch === " " ? "\u00a0" : ch;
    const layers = [];
    for (let k = 0; k <= o.trail; k++) {
      const g = document.createElement("span");
      g.textContent = glyph;
      g.style.cssText = k === 0
        ? "display:inline-block;opacity:0;will-change:transform,opacity,filter;"
        : "position:absolute;left:0;top:0;display:inline-block;opacity:0;pointer-events:none;will-change:transform,opacity;";
      box.appendChild(g);
      layers.push(g);
    }
    el.appendChild(box);
    return layers;
  });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let anims = [];

  // başlangıç pozu: harf arkaya doğru 3B dönmüş (Y ekseninde), yana yatmış,
  // biraz aşağıda ve büyük; yaklaştıkça düzleşip yerine oturuyor
  function pose(p) {
    // p: 0 başlangıç, 1 son
    const q = 1 - p;
    return `perspective(${o.perspective}px) ` +
      `translate3d(${(o.shiftX * q).toFixed(3)}em, ${(o.drop * q).toFixed(3)}em, 0) ` +
      `rotateY(${(o.turn * q).toFixed(2)}deg) rotate(${(o.angle * q).toFixed(2)}deg) ` +
      `scale(${(1 + (o.grow - 1) * q).toFixed(3)})`;
  }

  function play() {
    anims.forEach((a) => a.cancel());
    anims = [];
    const end = o.to || getComputedStyle(el).color;

    chars.forEach((layers, i) => {
      layers.forEach((g, k) => {
        if (reduced) { g.style.opacity = k === 0 ? "1" : "0"; return; }
        g.style.transformOrigin = `${o.pivot}em 60%`;
        const main = k === 0;
        // hayaletler: gecikmeli ve soluk; sonunda tamamen kayboluyor
        const peak = main ? 1 : o.trailOpacity * (1 - k / (o.trail + 1));
        const frames = [
          { opacity: 0, color: o.from, filter: `blur(${o.blur}px)`, transform: pose(0) },
          { opacity: main ? 0.9 : peak, color: o.from, filter: `blur(${(o.blur * 0.45).toFixed(1)}px)`, transform: pose(0.25), offset: 0.3 },
          { color: o.mid, filter: `blur(${(o.blur * 0.2).toFixed(1)}px)`, offset: 0.6 },
          { opacity: main ? 1 : 0, color: end, filter: "blur(0px)", transform: pose(1) }
        ];
        const a = g.animate(frames, {
          duration: o.duration,
          delay: o.delay + i * o.stagger + k * o.trailLag,
          // uzun süre eğik kalıyor, sonra hızla yerine oturuyor
          easing: "cubic-bezier(.55, 0, .2, 1)",
          fill: "both"
        });
        anims.push(a);
        if (main) a.onfinish = () => { g.style.opacity = "1"; g.style.willChange = "auto"; };
      });
    });
  }

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(play);
  return { play };
}
