import { periodScript } from "@townbus/engine";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Baloo_Thambi_2, Catamaran } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";

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

/**
 * Metadata stays Latin. Tamil script belongs to the lockup on the page, not to
 * the tab title, the share card's text, or the search snippet — those get read
 * in a lot of places that render it badly or truncate it mid-glyph.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.titleLatin,
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
    "Vidyasagar",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: site.titleLatin,
    description: site.description,
    locale: "en_IN",
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
    title: site.titleLatin,
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
    // The interface is English; the Tamil that appears is tagged `lang="ta"`
    // at the element, which is what screen readers and search engines want.
    <html lang="en" suppressHydrationWarning>
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
      <body className={`${baloo.variable} ${catamaran.variable}`}>
        {/*
          nuqs needs an adapter to reach the router. It reads `useSearchParams`,
          which under `output: "export"` has nothing to read at build time, so
          everything below it has to sit inside a Suspense boundary or the build
          refuses. The fallback is never seen in practice — the boundary
          resolves on hydration.
        */}
        <NuqsAdapter>
          <Suspense fallback={null}>{children}</Suspense>
        </NuqsAdapter>
        {/*
          Vercel Analytics. Cookieless and page-level, which is all the PRD's
          success metrics need — unique visitors, session length, and how many
          mobile sessions get as far as a play (§11).

          Rendered last so its script never sits ahead of the backdrop or the
          player in the loading order.
        */}
        <Analytics />
      </body>
    </html>
  );
}
