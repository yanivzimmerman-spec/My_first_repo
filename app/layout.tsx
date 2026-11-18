import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Heebo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heebo",
  display: "swap",
});

const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["500", "700", "900"],
  variable: "--font-frank",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "נדל״ן מול סנופי | סימולטור דירה להשקעה מול S&P 500",
  description:
    "סימולטור 'מה אם' ישראלי: השוואת שווי נטו בין דירה להשקעה במינוף משכנתא לבין השקעה במדד S&P 500 — כולל מס רכישה, מס שבח, מס שכירות ומס רווחי הון ריאלי.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E1110",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased tabular-nums">{children}</body>
    </html>
  );
}
