import type { Metadata } from "next";
import { archivo } from "./fonts";
import { SiteFooter } from "@/components/site-footer";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
