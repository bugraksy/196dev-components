# 196dev components

A collection of niche web components: the kind you go looking for, can't
find anywhere, and end up building yourself. Each one started as something I wanted and couldn't find. A few I did find,
but every one of those came with a catch. So I built them myself and put them
here, free, for the next person searching for the same thing.

The collection keeps growing: whenever I need something that doesn't exist
yet, it lands here.

No build step, no framework, no npm install. Every component is **one ES
module file**: copy it into your project, import it, pass options.

Open `index.html` (through any local server) for a live preview of every background.
The `hero-ascii.js` black hole also hides words in the dark: the pointer is
a lens that reveals them (`hidden`, `tokens`).

## Use one

```html
<div class="hero" style="position: relative; height: 100vh">
  <canvas style="position: absolute; inset: 0; width: 100%; height: 100%"></canvas>
</div>

<script type="module">
  import { mount } from "./hero-chrome.js";

  const scene = mount(document.querySelector("canvas"), {
    colors: { ember: "#22c55e" }   // anything you leave out keeps its default
  });

  // later, e.g. when the page or component goes away:
  scene.destroy();
</script>
```

The canvas fills its closest `.hero` ancestor, or its parent element if there
is none. Give that element a size.

## Backgrounds

All of these share the same shape: `mount(canvas, options)` returns
`{ destroy() }`. Each file exports a `defaults` object listing every option
with a comment.

| File | What it is | Main options |
|---|---|---|
| `hero-chrome.js` | Liquid chrome: a flowing metal surface reflecting an imaginary studio | `speed`, `ripple`, `dim`, `colors { ink, ember, gold, cream, steel }` |
| `hero-ebru.js` | Ebru (paper marbling): click to drop ink, move the pointer to comb it | `water`, `palette`, `rings`, `clickColors`, `drip`, `dripSize`, `clickMode`, `dim` |
| `hero-guilloche.js` | Guilloché: slowly counter-rotating banknote line rosettes | `speed`, `dim`, `colors { ink, cream, gold, ember, blue, pink }` |
| `hero-halftone.js` | Halftone: two-colour riso-style dot print | `speed`, `dots`, `dim`, `colors { paper, inkA, inkB, overlap }` |
| `hero-ascii.js` | ASCII black hole drawn entirely in characters | `ramp`, `color(b)`, `background`, `holeY`, `hidden`, `tokens` |
| `hero-contour.js` | Topographic contour lines (Canvas 2D) | `step`, `minor`, `major`, `summit` |
| `hero-network.js` | Neural network of drifting, signalling nodes (Canvas 2D) | `line`, `accent`, `pulseRate` |
| `tokens.js` | Rows of drifting code tokens; `mountTokens(canvas, options)` | `lines`, `ink`, `accent`, `secrets` |

Shared options on the WebGL scenes:

- `pointer` (default `true`): react to the pointer.
- `dim` (default `false`): darken the middle so a headline on top stays readable.
- `fps` (default `30`), `speed` (default `1`).
- Colours are `"#rrggbb"` strings or `[r, g, b]` arrays in the 0..1 range.

All scenes pause while they are off screen and draw a single still frame when
the visitor prefers reduced motion.

## Text and interface

| File | What it is | API |
|---|---|---|
| `text-reveal.js` | Letters turn into place one by one | `reveal(element, options)` → `{ play() }` |
| `ghost-reveal.js` | The wider version with a long ghost trail | `reveal(element, options)` |
| `holo.js` | Holographic foil surface (WebGL) | `mountHolo(element, options)` |

## Notes

- `hero-contour.js` and `hero-network.js` keep their settings in one shared
  `CFG` object, so options passed to `mount` apply to every instance on the
  page.
- `hero-ascii.js` publishes the hole's position on `window.__blackHole` so a
  custom cursor can react to it.
- Comments inside the files are in Turkish.

## License and credit

MIT, see [LICENSE](LICENSE). Use them anywhere, commercial work included.
Each file starts with a short notice; please keep it in your copy (the MIT
license asks for this). Nothing is shown on your site.

If the pack helped you, a link back to
[196dev-components](https://github.com/bugraksy/196dev-components) or a star on
GitHub is appreciated, never required.
