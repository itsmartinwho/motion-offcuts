/* motion-offcuts runtime: mounts sketches, runs their frames only while they
   are on screen and the tab is showing, and draws their controls.

   A page places a sketch with
     <div class="stage" data-sketch="./coins.js#coins"></div>          (a loop)
     <div class="stage" data-mode="scroll" data-sketch="./helix.js#helix"></div>
   and loads this file as a module. The module exports
     export const sketches = { name: async (env) => Sketch }

   env (what a factory gets):
     env.stage        the element to draw into (absolute children fill it)
     env.canvas(type) a canvas filling the stage at the device's density (max 2);
                      returns { canvas, ctx, w, h, dpr } — w/h are CSS px and are
                      kept current on resize (read them in render)
     env.img(src)     Promise<HTMLImageElement>, src relative to the page
     env.settings     the page's toggle state (<div class="seg" data-setting="name">)
     env.reduced      prefers-reduced-motion

   Sketch (what a factory returns):
     mode: "loop" (default) — render(u, time, dt) with u 0 → 1 over `duration` s,
           a scrubber and play button under the stage; `still` is where it rests
           under reduced motion (default 0.5)
     mode: "scroll" — the stage scrolls; render(s, time, dt) with s in screens
           (0 … screens); `screens` the track's length; `rests` the s of each
           card at rest; optional `labels` (one per rest) for the index overlay
     resize(w, h)  optional, CSS px

   Scroll stages read three optional toggles: settings.smooth (the camera eases
   toward the scroll), settings.settle (after the reader stops mid-turn the
   stage eases to the nearer rest; any input cancels it) and settings.index.
   MIT licence, see LICENSE. */

const cache = new Map();
export function img(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      new Promise((res, rej) => {
        const i = new Image();
        i.decoding = "async";
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = new URL(name, document.baseURI).href;
      }),
    );
  }
  return cache.get(name);
}

export async function svgImg(name, color = "#fff") {
  const key = `${name}|${color}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const text = await (await fetch(new URL(name, document.baseURI))).text();
        const svg = text.replace(/fill="[^"]*"/, `fill="${color}"`);
        const i = new Image();
        i.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        await i.decode();
        return i;
      })(),
    );
  }
  return cache.get(key);
}

/* ── Settings: the toggle groups (<div class="seg" data-setting="name">) ── */
export const settings = {};
const listeners = [];
for (const seg of document.querySelectorAll(".seg[data-setting]")) {
  const name = seg.dataset.setting;
  const buttons = [...seg.querySelectorAll("button[data-value]")];
  const on = buttons.find((b) => b.getAttribute("aria-pressed") === "true") ?? buttons[0];
  settings[name] = parse(on.dataset.value);
  for (const b of buttons) {
    b.setAttribute("aria-pressed", String(b === on));
    b.addEventListener("click", () => {
      for (const o of buttons) o.setAttribute("aria-pressed", String(o === b));
      settings[name] = parse(b.dataset.value);
      for (const fn of listeners) fn(name, settings[name]);
    });
  }
}
function parse(v) {
  return v === "on" ? true : v === "off" ? false : v;
}
export const onSetting = (fn) => listeners.push(fn);

/* ── Frames ── */
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const live = new Set();
let last = 0;
let raf = 0;
function tick(now) {
  raf = 0;
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
  last = now;
  for (const r of live) if (r.visible) r.frame(now / 1000, dt);
  schedule();
}
function schedule() {
  if (raf || document.hidden) return;
  for (const r of live) {
    if (r.visible && r.wants()) {
      raf = requestAnimationFrame(tick);
      return;
    }
  }
  last = 0;
}
document.addEventListener("visibilitychange", () => {
  last = 0;
  schedule();
});
const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const r = e.target.__runner;
      if (r) r.visible = e.isIntersecting;
    }
    schedule();
  },
  { rootMargin: "120px" },
);



async function mount(stage) {
  const [path, name] = stage.dataset.sketch.split("#");
  let mod;
  try {
    mod = await import(new URL(path, document.baseURI).href);
  } catch (e) {
    console.error(e);
    stage.dataset.state = "missing";
    return;
  }
  const factory = mod.sketches?.[name];
  if (!factory) {
    stage.dataset.state = "missing";
    return;
  }
  const scroll = stage.dataset.mode === "scroll";
  let sk = null;
  let view = stage;
  let track = null;
  if (scroll) {
    track = document.createElement("div");
    track.className = "track";
    view = document.createElement("div");
    view.className = "view";
    track.append(view);
    stage.append(track);
  }
  const canvases = [];
  const env = {
    stage: view,
    img,
    svgImg,
    settings,
    reduced,
    canvas(type = "2d") {
      const canvas = document.createElement("canvas");
      canvas.className = "fill";
      view.append(canvas);
      const c = { canvas, ctx: type ? canvas.getContext(type) : null, w: 1, h: 1, dpr: 1 };
      canvases.push(c);
      size(c);
      return c;
    },
  };
  function size(c) {
    const r = view.getBoundingClientRect();
    c.dpr = Math.min(2, devicePixelRatio || 1);
    c.w = Math.max(1, Math.round(r.width));
    c.h = Math.max(1, Math.round(r.height || stage.clientHeight));
    c.canvas.width = Math.round(c.w * c.dpr);
    c.canvas.height = Math.round(c.h * c.dpr);
  }
  await document.fonts.load("40px Aboreto").catch(() => {});
  if (scroll) sizeTrack();
  sk = await factory(env);
  stage.dataset.state = "ready";
  const fig = stage.closest("figure") ?? stage.parentElement;

  // ── loop mode: scrubber + play ──
  let u = sk.still ?? 0.5;
  let playing = !reduced;
  let scrubbing = false;
  let range = null;
  let play = null;
  if (!scroll) {
    const bar = document.createElement("div");
    bar.className = "scrub";
    play = document.createElement("button");
    play.type = "button";
    play.className = "play";
    range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "1000";
    range.id = `scrub-${stage.dataset.sketch.replace(/[^a-z0-9]+/gi, "-")}`;
    range.setAttribute("aria-label", "Scrub the sketch");
    bar.append(play, range);
    stage.after(bar);
    const label = () => (play.textContent = playing ? "Pause" : "Play");
    label();
    play.addEventListener("click", () => {
      playing = !playing;
      label();
      schedule();
    });
    range.addEventListener("input", () => {
      scrubbing = true;
      playing = false;
      label();
      u = +range.value / 1000;
      sk.render(u, performance.now() / 1000, 0);
    });
    range.addEventListener("change", () => (scrubbing = false));
    range.value = String(Math.round(u * 1000));
  }

  // ── scroll mode: smoothing, settle, tour, index ──
  let target = 0;
  let shown = 0;
  let touring = false;
  let tourAt = 0;
  let settleTimer = 0;
  let hud = null;
  let tourBtn = null;
  let quietUntil = 0;
  const setScroll = (v) => {
    quietUntil = performance.now() + 120;
    stage.scrollTop = v * stage.clientHeight;
  };
  function sizeTrack() {
    const h = stage.clientHeight;
    view.style.height = `${h}px`;
    track.style.height = `${h * ((sk?.screens ?? 4) + 1)}px`;
  }
  if (scroll) {
    sizeTrack();
    const start = sk.start ?? 0;
    setScroll(start);
    target = shown = start;
    stage.addEventListener(
      "scroll",
      () => {
        target = stage.scrollTop / stage.clientHeight;
        clearTimeout(settleTimer);
        if (performance.now() < quietUntil) return schedule();
        if (!touring && settings.settle === true) settleTimer = setTimeout(settle, sk.settleDelay ?? 450);
        schedule();
      },
      { passive: true },
    );
    for (const ev of ["wheel", "touchstart", "pointerdown"]) stage.addEventListener(ev, () => stopTour(), { passive: true });
    hud = document.createElement("ol");
    hud.className = "hud";
    const labels = sk.labels ?? sk.rests.map((_, i) => `Card ${i + 1}`);
    hud.innerHTML = labels.map((n, i) => `<li><span>${String(i).padStart(2, "0")}</span> ${n}</li>`).join("");
    view.append(hud);
    const bar = document.createElement("div");
    bar.className = "scrub";
    tourBtn = document.createElement("button");
    tourBtn.type = "button";
    tourBtn.className = "play";
    tourBtn.textContent = "Play";
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Or scroll inside the frame";
    bar.append(tourBtn, hint);
    stage.after(bar);
    tourBtn.addEventListener("click", () => (touring ? stopTour() : startTour()));
  }
  function nearestRest(s) {
    let best = sk.rests[0];
    for (const r of sk.rests) if (Math.abs(r - s) < Math.abs(best - s)) best = r;
    return best;
  }
  function settle() {
    if (settings.settle !== true || touring) return;
    const r = nearestRest(target);
    if (Math.abs(r - target) > 0.004) stage.scrollTo({ top: r * stage.clientHeight, behavior: "smooth" });
  }
  // The tour: a reader who scrolls one turn, stops on the card to look, scrolls
  // on; from the first card (or the card the reader is on) to the last.
  const PER = 3.1; // seconds a card: 1.7 moving, 1.4 looking
  let tourFirst = 0;
  function startTour() {
    let i = sk.rests.indexOf(nearestRest(target));
    if (i >= sk.rests.length - 1) {
      i = 0;
      setScroll(sk.rests[0]);
      target = shown = sk.rests[0];
    }
    tourFirst = i;
    touring = true;
    tourAt = performance.now() / 1000;
    tourBtn.textContent = "Stop";
    schedule();
  }
  function stopTour() {
    if (!touring) return;
    touring = false;
    tourBtn.textContent = "Play";
  }
  function tourAtTime(t) {
    const rests = sk.rests;
    const k = t / PER;
    const i = tourFirst + Math.floor(k);
    if (i >= rests.length - 1) {
      stopTour();
      return rests[rests.length - 1];
    }
    const m = Math.min(1, (k % 1) / 0.55);
    const e = m < 0.5 ? 2 * m * m : 1 - (-2 * m + 2) ** 2 / 2;
    return rests[i] + (rests[i + 1] - rests[i]) * e;
  }

  const runner = {
    visible: false,
    wants: () => (scroll ? touring || Math.abs(target - shown) > 1e-4 || sk.alwaysAnimate : playing),
    frame(time, dt) {
      if (scroll) {
        if (touring) {
          const s = tourAtTime(time - tourAt);
          setScroll(s);
          target = s;
        }
        if (settings.smooth !== false) shown += (target - shown) * (1 - Math.exp(-dt / 0.11));
        else shown = target;
        if (Math.abs(target - shown) < 1e-4) shown = target;
        sk.render(shown, time, dt);
        if (hud) {
          hud.hidden = settings.index !== true;
          const r = nearestRest(shown);
          const active = sk.rests.indexOf(r);
          hud.querySelectorAll("li").forEach((li, i) => li.classList.toggle("on", i === active));
        }
      } else {
        if (playing && !scrubbing) {
          u = (u + dt / (sk.duration ?? 8)) % 1;
          range.value = String(Math.round(u * 1000));
        }
        sk.render(u, time, dt);
      }
    },
  };
  stage.__runner = runner;
  live.add(runner);
  seen.observe(stage);
  onSetting(() => {
    if (scroll) sk.render(shown, performance.now() / 1000, 0);
    else sk.render(u, performance.now() / 1000, 0);
    if (scroll && hud) hud.hidden = settings.index !== true;
  });
  new ResizeObserver(() => {
    if (scroll) {
      sizeTrack();
      setScroll(target);
    }
    for (const c of canvases) size(c);
    const r = view.getBoundingClientRect();
    sk.resize?.(Math.round(r.width), Math.round(r.height));
    sk.render(scroll ? shown : u, performance.now() / 1000, 0);
  }).observe(stage);
  sk.render(scroll ? shown : u, performance.now() / 1000, 0);
  if (hud) hud.hidden = settings.index !== true;
  schedule();
}

function grounds() {
  for (const s of document.querySelectorAll('.stage[data-mode="scroll"]')) {
    s.classList.toggle("ground-ink", settings.ground !== "white");
    s.classList.toggle("ground-white", settings.ground === "white");
  }
}
grounds();
onSetting((name) => name === "ground" && grounds());

for (const stage of document.querySelectorAll("[data-sketch]")) mount(stage);
