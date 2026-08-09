import { periodScript } from "@townbus/engine";
import type { Metadata, Viewport } from "next";
import { Baloo_Thambi_2, Catamaran } from "next/font/google";

import "../index.css";
import { site } from "@/lib/site";

/** Heavy Tamil display face for the lockup — real type, never a raster. */
const baloo = Baloo_Thambi_2({
  variable: "--font-baloo",
  subsets: ["tamil", "latin"],
  weight: ["600", "800"],
  display: "swap",
});

const catamaran = Catamaran({
  variable: "--font-catamaran",
  subsets: ["tamil", "latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.titleTa} · ${site.titleLatin}`,
  description: site.description,
  applicationName: site.name,
  keywords: [
    "Tamil songs",
    "kuthu",
    "gaana",
    "town bus",
    "90s Tamil hits",
    "Deva",
    "Ilaiyaraaja",
    "தமிழ் பாட்டு",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.titleTa} · ${site.titleLatin}`,
    description: site.description,
    locale: "ta_IN",
    images: [
      {
        url: "/assets/og.jpg",
        width: 1200,
        height: 630,
        alt: `${site.titleLatin} — ${site.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.titleTa} · ${site.titleLatin}`,
    description: site.description,
    images: ["/assets/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#14100c",
  colorScheme: "dark",
  // The player card sits on the bottom edge; it needs the safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ta" suppressHydrationWarning>
      <head>
        {/*
          Resolves the IST day/night period and stamps <html data-period>. Runs
          blocking, before the bundle, so the backdrop never swaps after paint.
          The markup is a constant built at build time — no user input reaches it.
        */}
        <script dangerouslySetInnerHTML={{ __html: periodScript() }} />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://www.youtube-nocookie.com" />
      </head>
      <body className={`${baloo.variable} ${catamaran.variable}`}>{children}</body>
    </html>
  );
}
