import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skill Arena — V3.1",
  description: "V3.1 mobile-first de Skill Arena.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
