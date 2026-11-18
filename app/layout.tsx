import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heebo",
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
  themeColor: "#F8FAFC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen antialiased tabular-nums">{children}</body>
    </html>
  );
}
