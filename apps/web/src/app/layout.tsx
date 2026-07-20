import type { Metadata } from "next";
import { Archivo_Black, Figtree } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Silence Remover by Puhulab",
  description: "Remove quiet gaps from voiceovers and short videos — free, no account.",
  // Favicon comes from apps/web/src/app/icon.svg (Next.js file convention).
  // Header mark uses /brand/icon.svg from public/.
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
      </body>
    </html>
  );
}
