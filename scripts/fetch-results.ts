// レース結果取得の「対象一覧出力」スクリプト。
//
// このスクリプト自体は WebFetch しない。理由:
//   - GitHub Actions の allowlist 制限で外部HTMLが取れないことがある
//   - HTML パーサで馬名・着順を機械抽出すると精度不足(fetch-runners.ts と同じ問題)
//   - Claude routine が WebFetch で構造化抽出する方が信頼できる
//
// 役割は「結果取得が必要なレースの一覧」を JSON で出すだけ。
// routine の Claude がそれを読み、WebFetch でレースごとに結果を取りに行く。
//
// 出力フォーマット:
// {
//   "targets": [
//     {
//       "race_id": "2026-tokyo-yushun",
//       "name": "日本ダービー (東京優駿)",
//       "date": "2026-05-31",
//       "days_since": 7,
//       "search_hints": [
//         "<レース名> <西暦> 結果",
//         "<レース名> <西暦> 結果 着順"
//       ]
//     }
//   ],
//   "total_considered": 24,
//   "scope": "recent_30d"
// }
//
// CLI:
//   npm run fetch-results                            # デフォルト: 直近30日のみ
//   npm run fetch-results -- --all                   # results が空の終了レース全部
//   npm run fetch-results -- --race 2026-tokyo-yushun  # 個別指定
//   npm run fetch-results -- --date 2026-06-08       # 基準日を明示(動作確認用)

import { readRaces, type Race } from "../src/db.ts";

interface FetchTarget {
  race_id: string;
  name: string;
  date: string;
  days_since: number; // 開催日から何日経ったか
  search_hints: string[];
}

interface FetchPlan {
  targets: FetchTarget[];
  total_considered: number;
  scope: "recent_30d" | "all" | "single";
}

function parseArgs(argv: string[]): { all: boolean; race?: string; date?: string } {
  const out: { all: boolean; race?: string; date?: string } = { all: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--all") out.all = true;
    else if (argv[i] === "--race" && argv[i + 1]) out.race = argv[++i];
    else if (argv[i] === "--date" && argv[i + 1]) out.date = argv[++i];
  }
  return out;
}

function getToday(arg?: string): string {
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg;
  const env = process.env.UMASHINBUN_TODAY;
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 86400000);
}

function hasNoResults(r: Race): boolean {
  return !r.results || r.results.length === 0;
}

function isFinished(r: Race, today: string): boolean {
  if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return false;
  return r.date < today || r.date === today;
}

function makePlan(today: string, races: Race[], args: ReturnType<typeof parseArgs>): FetchPlan {
  // 個別指定モード
  if (args.race) {
    const r = races.find((x) => x.id === args.race);
    if (!r) return { targets: [], total_considered: 0, scope: "single" };
    return {
      targets: [toTarget(r, today)],
      total_considered: 1,
      scope: "single",
    };
  }

  // 全件 or 直近30日
  const candidates = races.filter((r) => isFinished(r, today) && hasNoResults(r));
  const inScope = args.all
    ? candidates
    : candidates.filter((r) => daysBetween(today, r.date) <= 30);

  return {
    targets: inScope
      .map((r) => toTarget(r, today))
      .sort((a, b) => a.days_since - b.days_since),
    total_considered: candidates.length,
    scope: args.all ? "all" : "recent_30d",
  };
}

function toTarget(r: Race, today: string): FetchTarget {
  const yearMatch = r.date.match(/^(\d{4})/);
  const year = yearMatch ? yearMatch[1] : "";
  return {
    race_id: r.id,
    name: r.name,
    date: r.date,
    days_since: daysBetween(today, r.date),
    search_hints: [
      `${r.name} ${year} 結果`,
      `${r.name} ${year} 結果 着順 騎手 タイム`,
    ],
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const today = getToday(args.date);
  const races = readRaces();
  const plan = makePlan(today, races, args);
  console.log(JSON.stringify(plan, null, 2));
}

main();
