import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Space_Grotesk, JetBrains_Mono, Inter } from "next/font/google";
import { StorageProvider } from "@/lib/storage/provider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

/**
 * Starship type system: Space Grotesk display (gauge/heading numerals),
 * JetBrains Mono microlabels, Inter body. next/font self-hosts them at build
 * time (CSP-safe, no runtime Google request). Geist stays as the ultimate
 * fallback so the app still renders if a font file is unavailable.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-hud-display",
  display: "swap",
});
const hudMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hud-mono",
  display: "swap",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Forge30",
  description:
    "A 30-day lifestyle forge: nutrition, training, mind, money, and skills in one daily loop.",
  applicationName: "Forge30",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Forge30",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // Dark hull is the default; the theme script may repaint on the client.
  themeColor: "#0a0818",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * No-FOUC theme boot: apply the stored preference (default dark) to
 * <html data-theme> before first paint. This is the one sanctioned direct
 * localStorage read — an inline pre-hydration script, not a component — and
 * it only reads the key the adapter writes (forge30:theme).
 */
const THEME_BOOT = `(function(){try{var t=JSON.parse(localStorage.getItem('forge30:theme'));document.documentElement.dataset.theme=(t==='light')?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} ${hudMono.variable} ${body.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <StorageProvider>{children}</StorageProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
