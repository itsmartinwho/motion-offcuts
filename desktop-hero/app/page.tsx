import { DemoHero } from "./DemoHero";
import { DOCK, POSTS } from "./demo";

export default function Page() {
  return (
    <main className="shell">
      <DemoHero
        name="Your Name"
        tagline="Founder · Writer"
        wallpaper="/demo/wallpaper.webp"
        figure={{ src: "/demo/figure.svg" }}
        posts={POSTS}
        dock={DOCK}
      />
    </main>
  );
}
