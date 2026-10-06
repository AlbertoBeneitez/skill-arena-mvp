import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skill Arena",
  description: "Skill Arena — duelos móviles de habilidad.",
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
