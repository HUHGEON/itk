import { NextResponse, type NextRequest } from "next/server";

/**
 * The introduction is for people who have not been here before.
 *
 * The front page sells the tier list: what the site is, how many reporters it
 * follows, why the first byline matters. That is worth a minute once, and then
 * it is a page standing between a daily reader and the stories they came for.
 *
 * So the browser gets a mark the first time it loads anything here, and after
 * that the root goes straight to the feed. `?intro` overrides it, which is
 * what the rail's "ITK+ 소개" link and /about both use, so the pitch is still
 * reachable on purpose - just not by accident, every day.
 *
 * The redirect is temporary rather than permanent: a 308 would be cached by
 * the browser and would keep redirecting even after the reader cleared the
 * mark, which is the one thing that must still work.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.searchParams.has("intro")) return NextResponse.next();
  if (!req.cookies.has("itk_seen")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/feed";
  url.search = "";
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Only the root. Everything else is untouched, so this costs one check on
  // one path rather than running in front of the whole site.
  matcher: "/",
};
