import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ws pulls in optional native addons the bundler shouldn't try to resolve.
  serverExternalPackages: ["ws"],
  // Two lockfiles exist above this directory; pin the root so Turbopack stops guessing.
  turbopack: { root: __dirname },

  /**
   * The crests are content-addressed, so they can be cached forever.
   *
   * `scripts/cache-crests.ts` puts a hash of the source URL in every filename,
   * which means a given path can never change what it points at - replacing a
   * badge writes a new name and the old one stops being referenced. That is
   * exactly the condition `immutable` asks for, and it turns the seventeen
   * crest requests on a repeat visit into none at all.
   *
   * The pitch photograph is not hashed, so it gets a week rather than a year.
   */
  async headers() {
    return [
      {
        source: "/crests/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Baked ball maps: regenerated only when the pattern code changes, and
        // committed alongside it, so a week is safe and a repeat visitor pays
        // nothing for them.
        source: "/ball/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/pitch.jpg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
