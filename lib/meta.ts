import type { Metadata } from "next";

/**
 * A page's title and description, and the same pair for link previews.
 *
 * Next does not carry `title` into og:title, and the root layout's Open Graph
 * title would otherwise stand for every page - a shared Heatmap link read
 * "ITK+ 축구 이적 소식". Each page says its own.
 *
 * Setting a page's `openGraph` replaces the root's whole object, images and
 * all - measured: /feed went out with no og:image - so the site picture is
 * named again here. A route with its own picture passes it: measured, the
 * page's own openGraph.images beats a sibling opengraph-image file, so a
 * game left on the default went out with the site card.
 */
export function pageMeta(title: string, description: string, image = "/opengraph-image"): Metadata {
  // With its size: without og:image:width/height Slack falls back to a small
  // square thumbnail cropped from the middle.
  const img = { url: image, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    openGraph: { title, description, images: [img] },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}
