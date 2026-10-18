# Bulging grid

A page of hairline squares that bulge under the pointer, and on their own under three slow swells that drift across the page and breathe. It was the background behind jjmartin.co's blog, press and contact pages, with the cards' glass over it, until October 2026. One ES module, `grid.js`, with no dependencies.

Open `index.html` through any static server. From the repo root:

```
python3 -m http.server
# then http://localhost:8000/bulging-grid/
```

![The grid, a swell pushing it out](screenshots/grid.jpg)

## How it moves

A lattice of points, one every 50px. Each frame every point is pushed away from the pointer (within 180px, by up to 25px) and from each of three swells (within 250px, by up to 18px, times the swell's breath). The push falls off linearly to nothing at the edge of its reach. The point is then eased toward where it is pushed with a time constant of 0.13s, so the cloth settles instead of snapping, at any frame rate. The lines are drawn row by row and column by column through the moved points, all in one path.

The swells' centres move on sines and their breaths on another, each a whole number of turns in the 40 second loop, so the loop has no seam. The scrubber under the stage moves it by hand. Under reduced motion it rests on one frame until you press play.

## Options

There is no options object on the stage. The choices are the `GRID` constant at the top of `grid.js`:

| Key | What it sets |
| --- | --- |
| `spacing` | Pixels between lines. |
| `ink`, `line`, `ground` | The lines' colour and width, and the colour under them. |
| `pointer` | The pointer's reach (`radius`) and push (`strength`). |
| `swell` | The swells' reach and push. |
| `swells` | Per swell: its centre's path as shares of the stage, the whole turns it makes on each axis in a loop, where they start, and how many breaths it takes. |
| `ease` | How quickly a point follows its push, in seconds. |

## Use it

On a stage, through `../shared/runtime.js`:

```html
<div class="stage" data-sketch="./grid.js#grid"></div>
<script type="module" src="../shared/runtime.js"></script>
```

Behind a whole page, the way the site used it: one fixed canvas under everything, the pointer read anywhere on the page. `mountBackground` takes the same keys as `GRID`, plus `duration`, and returns a function that takes it down.

```html
<script type="module">
  import { mountBackground } from "./grid.js";
  mountBackground({ spacing: 44 });
</script>
```

Or drive the cloth yourself: `createGrid()` returns `{ resize(w, h), step(u, dt), draw(ctx), pointer }`. Call `resize` with the size in CSS pixels, set `pointer.x`, `pointer.y` and `pointer.on`, and each frame call `step` with the loop's phase and the seconds since the last frame, then `draw`.

MIT licence, see `../LICENSE`.
