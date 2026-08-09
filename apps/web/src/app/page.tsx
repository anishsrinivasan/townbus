import { tracks } from "@townbus/content";
import Backdrops from "@/components/backdrop";
import Lockup from "@/components/lockup";
import Radio from "@/components/radio";
import TopBar from "@/components/top-bar";
import { site } from "@/lib/site";

/**
 * One page. Painted backdrop behind everything, lockup centred, and the deck
 * floating clear of the bottom edge — the same arrangement in both
 * orientations, laid out so a phone gets a portrait page rather than a cropped
 * desktop one.
 */
export default function Home() {
  return (
    <>
      <Backdrops />

      <main className="relative z-1 flex min-h-svh flex-col">
        <TopBar />

        <div className="flex flex-1 items-center justify-center px-5 pb-24">
          <Lockup />
        </div>

        <div className="sticky bottom-0 px-3 pt-2 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          <Radio />
        </div>
      </main>

      {/* Structured data: this is a music playlist, and it should read as one. */}
      <script
        type="application/ld+json"
        // Serialised from the track list at build time; no user input reaches it.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "MusicPlaylist",
            name: `${site.titleTa} · ${site.titleLatin}`,
            description: site.description,
            url: site.url,
            numTracks: tracks.length,
            track: tracks.map((track) => ({
              "@type": "MusicRecording",
              name: track.title,
              alternateName: track.titleTa,
              inAlbum: { "@type": "MusicAlbum", name: track.movie },
              byArtist: { "@type": "Person", name: track.composer },
              datePublished: String(track.year),
            })),
          }),
        }}
      />
    </>
  );
}
