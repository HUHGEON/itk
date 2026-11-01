import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocketImpl from "ws";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase client.
 *
 * Everything goes over HTTPS rather than a direct Postgres connection: plenty
 * of networks block outbound 5432, and this also removes the pooler / prepared
 * statement dance on serverless.
 *
 * Uses the secret (service_role) key, so it must never be imported into a
 * client component — the env var deliberately has no NEXT_PUBLIC_ prefix.
 */
export function supabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 가 설정되지 않았습니다.\n" +
        "Supabase → Settings → API Keys 에서 확인하세요 (.env.example 참고).",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "itk" } },
    realtime: {
      // supabase-js wires up a realtime client on construction even when only
      // RPC is used, and Node < 22 has no global WebSocket. Nothing here
      // subscribes — this just satisfies the constructor.
      transport: (globalThis.WebSocket ?? WebSocketImpl) as never,
    },
  });
  return client;
}

/**
 * Calls a `itk_*` database function and throws on error.
 *
 * supabase-js returns `{ data, error }` rather than rejecting, which is easy to
 * ignore by accident — a silent null here would look like "no articles" instead
 * of "the query failed".
 */
/**
 * Errors worth a second attempt: clock skew, transport blips, gateway hiccups,
 * and the database's own statement timeout - a query that takes 0.1s normally
 * passing 8s while a collection run is writing. Measured over a week of the
 * scheduled workflow: six failed runs, every one of them that timeout, on
 * queries that answered at once when rerun.
 */
function isTransient(message: string): boolean {
  return /issued at future|JWT|fetch failed|ECONNRESET|ETIMEDOUT|502|503|504|statement timeout/i.test(
    message,
  );
}

export async function rpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  let lastMessage = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await supabase().rpc(fn, args);
    if (!error) return data as T;

    lastMessage = `${error.message}${error.hint ? ` (${error.hint})` : ""}`;
    if (!isTransient(error.message) || attempt === 3) break;
    // A busy database needs longer than a dropped connection does.
    const wait = /statement timeout/i.test(error.message) ? 2000 * attempt : 250 * attempt;
    await new Promise((r) => setTimeout(r, wait));
  }

  throw new Error(`${fn} 실패: ${lastMessage}`);
}
