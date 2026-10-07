import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  display: "swap",
  // Axa de lățime dă titlurile condensate de pe afișe (.headline); opsz ține literele curate la mărimi mari.
  axes: ["wdth", "opsz"],
});

const instrument = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Ticketeanu",
    template: "%s · Ticketeanu",
  },
  description: "Bilete și rezervări pentru petreceri, concerte și evenimente. Organizatorul își face singur pagina, în câteva minute.",
};

export const viewport: Viewport = {
  themeColor: "#0b0a14",
  width: "device-width",
  initialScale: 1,
};

// Aproape totul depinde de baza de date și de sesiune: nimic nu se prerenderizează la build.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
