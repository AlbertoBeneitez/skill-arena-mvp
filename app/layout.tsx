import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillArena — Torneos de habilidad",
  description: "MVP de una plataforma de torneos deterministas de habilidad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
