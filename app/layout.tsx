import type { Metadata, Viewport } from "next";
import { archivo } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://treeline.aidenkopec.com"),
  title: {
    default: "Treeline — ski terrain in 3D",
    template: "%s — Treeline",
  },
  description:
    "Real pitch, aspect and vertical for marked ski runs, computed from elevation data and rendered on the actual mountain.",
};

// The resort page is a full-bleed map under a sheet that sits on the bottom
// edge, so the safe-area insets have to exist to be read.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
