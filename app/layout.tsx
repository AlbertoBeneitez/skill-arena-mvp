import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from "@/lib/productIdentity";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  applicationName: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#081522",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
