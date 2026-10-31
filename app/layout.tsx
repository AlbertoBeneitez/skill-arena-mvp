import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from "@/lib/productIdentity";
import MobileOnlyGate from "@/components/MobileOnlyGate";

/** Public origin for absolute social-preview URLs; set NEXT_PUBLIC_SITE_URL once a custom domain exists. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  applicationName: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png?v=125", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=125", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Galactic Games", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: PRODUCT_NAME,
    title: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: PRODUCT_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

/** Phone layout: device width, native scale (two game cards per row on a phone). */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#081522",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><MobileOnlyGate>{children}</MobileOnlyGate></body>
    </html>
  );
}
