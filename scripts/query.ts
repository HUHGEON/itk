/**
 * Runs a one-off SQL query against the database, for debugging.
 *
 * Uses the Management API rather than a Postgres connection, because outbound
 * 5432 is blocked on many networks — same reason the app itself is HTTPS-only.
 * Needs SUPABASE_ACCESS_TOKEN.
 *
 *   npm run query "select count(*) from itk.articles"
 */
import "../lib/load-env";
async function main() {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: process.argv.slice(2).join(" ") }),
  });
  const body = await res.text();
  if (!res.ok) { console.error(res.status, body); process.exitCode = 1; return; }
  console.table(JSON.parse(body));
}
main();
