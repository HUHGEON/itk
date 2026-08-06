/**
 * Loads .env.local the same way `next dev` does.
 *
 * Next handles this for the app automatically, but the `tsx scripts/*` entry
 * points get a bare Node process — without this they see an empty
 * DATABASE_URL. Import this first, before anything that reads process.env.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", {
  info: () => {},
  error: console.error,
});
