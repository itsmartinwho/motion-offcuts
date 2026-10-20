import { DemoHero } from "../DemoHero";
import { DOCK_LINE, POSTS } from "../demo";

/* The demo with the dock's quiet style: line glyphs on faint glass. */
export default function LinePage() {
  return (
    <main className="shell">
      <DemoHero
        name="Your Name"
        tagline="Founder · Writer"
        wallpaper="/demo/wallpaper.webp"
        figure={{ src: "/demo/figure.svg" }}
        posts={POSTS}
        dock={DOCK_LINE}
      />
    </main>
  );
}
