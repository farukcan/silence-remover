import type { Metadata, Viewport } from "next";
import { Archivo_Black, Figtree } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://silence-remover.puhulab.com";

const title = "Silence Remover by Puhulab";
const description =
  "Remove quiet gaps from voiceovers and short videos — free, no account.";

export const viewport: Viewport = {
  themeColor: "#0b1110",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Silence Remover",
  // Favicon: apps/web/src/app/icon.svg
  // Share preview: apps/web/src/app/opengraph-image.tsx (+ twitter-image)
  // PWA: apps/web/src/app/manifest.ts + /icon-192 + /icon-512 + /sw.js
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: title,
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Silence Remover",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
