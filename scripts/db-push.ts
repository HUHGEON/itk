/**
 * Applies supabase/schema.sql.
 *
 * DDL can't go through PostgREST, so this uses the Supabase Management API over
 * HTTPS — which matters because plenty of networks block outbound 5432.
 * Needs a personal access token: https://supabase.com/dashboard/account/tokens
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run db:push
 *
 * Without a token it prints the file so you can paste it into the SQL editor.
 */
import "../lib/load-env";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_FILE = path.join(process.cwd(), "supabase", "schema.sql");

function projectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.");
  const host = new URL(url).hostname;
  const ref = host.split(".")[0];
  if (!ref) throw new Error(`프로젝트 ref를 알아낼 수 없습니다: ${url}`);
  return ref;
}

async function main() {
  const sql = fs.readFileSync(SCHEMA_FILE, "utf8");
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!token) {
    console.log(
      [
        "SUPABASE_ACCESS_TOKEN이 없습니다. 둘 중 하나로 진행하세요.",
        "",
        "  A) 토큰 발급 후 자동 적용 (권장)",
        "     https://supabase.com/dashboard/account/tokens 에서 생성 →",
        "     .env.local 에 SUPABASE_ACCESS_TOKEN=sbp_... 추가 → 다시 실행",
        "",
        "  B) 수동 적용",
        `     ${SCHEMA_FILE} 내용을 복사해서`,
        `     https://supabase.com/dashboard/project/${projectRef()}/sql/new 에 붙여넣고 실행`,
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef()}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${await res.text()}`);
  }

  console.log("✓ 스키마 적용 완료");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
