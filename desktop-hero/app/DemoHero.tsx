"use client";

import Link from "next/link";
import { Hero, type HeroProps } from "@/hero";

/* In the Next.js App Router, pass `Link` from a client component like this
   one: a server component cannot hand a function to a client one. */
export function DemoHero(props: Omit<HeroProps, "linkComponent">) {
  return <Hero {...props} linkComponent={Link} />;
}
