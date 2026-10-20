import type { Metadata, Viewport } from "next";
import { Aboreto, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

/* The hero's two faces, as the custom properties it reads: capitals in
   Aboreto (the name, labels), captions in Cormorant Garamond. */
const caps = Aboreto({ weight: "400", subsets: ["latin"], variable: "--hero-caps" });
const serif = Cormorant_Garamond({ weight: ["500", "600"], subsets: ["latin"], variable: "--hero-serif" });

export const metadata: Metadata = {
  title: "Desktop hero",
  description: "A personal-desktop hero: a wallpaper under fluted glass, posts as live file icons, and a dock.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${caps.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
