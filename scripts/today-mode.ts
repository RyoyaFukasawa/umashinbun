// 今日の routine モードを判定する小さなヘルパー。
//
// 毎朝の routine は1本だけだが、 日付に応じて4つのモードを切り替える。
// このスクリプトは「今日のモード + 対象レース + 対象馬」を構造化して出力するだけで、
// 実際の要約・ingest・build は Claude routine が ROUTINES_PROMPT.md に従って行う。
//
// モード判定ロジック(優先度の高い順):
//
//   1. monthly_prep (月末モード)
//      - 今日が月末(28-31日)で、来月以降に重賞が登録されている
//      - 仕事: 翌月のレース一覧と出走予定馬の事前準備(records.json/horses-profile.json の補強)
//
//   2. race_week (重賞週モード)
//      - 直近7日以内(今日を含む)に races.json の重賞がある
//      - 仕事: 対象レースの planned_horses に絞って RSS をフィルタし要約
//      - 複数レースが7日以内に並ぶときは「最も近い」レースを最優先
//
//   3. weekly_review (週次改善モード)
//      - 月曜日
//      - 仕事: ops-log/ を集計して INSIGHTS.md と改善PRを作る
//      - 注: race_week とは排他ではなく重複OK(月曜に重賞週もあり得る)
//
//   4. light (軽量モード)
//      - 上記いずれにも当てはまらない日
//      - 仕事: POG・業界ニュース・種牡馬の話題などレースに紐づかない記事を中心に少量だけ拾う
//
// 引数 --date YYYY-MM-DD で日付を上書きできる(動作確認用)。
// 引数なしなら process.env.UMASHINBUN_TODAY か、なければハードコードされた基準日を使う。
// (実運用では GitHub Actions の date コマンドで動的に取得して環境変数で渡す想定)

import { readRaces, type Race } from "../src/db.ts";

interface TodayContext {
  today: string; // YYYY-MM-DD
  weekday: number; // 0=日, 1=月, ...
  daysToMonthEnd: number; // 月末まで何日(月末当日は0)
}

interface ModeResult {
  mode: "monthly_prep" | "race_week" | "weekly_review" | "light";
  /** race_week / monthly_prep のとき主対象のレース。複数ある場合もある */
  target_races: Array<{ id: string; name: string; date: string; days_until: number; planned_horses: string[] }>;
  /** monthly_prep のとき、来月の全重賞 */
  next_month_races: Array<{ id: string; name: string; date: string }>;
  /** 説明用の人間向けメモ */
  notes: string[];
}

function parseArgs(argv: string[]): { date?: string } {
  const out: { date?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--date" && argv[i + 1]) out.date = argv[++i];
  }
  return out;
}

function getToday(arg?: string): string {
  // 優先度: 引数 > env > 今日(JSTで)
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg;
  const env = process.env.UMASHINBUN_TODAY;
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  // new Date() は今の環境では使えない可能性があるので process.env.TZ で日本時間を仮定
  const d = new Date();
  // JSTを意識せず単に YYYY-MM-DD を採る(ローカル時刻でOK、GitHub ActionsならUTC)
  return d.toISOString().slice(0, 10);
}

function buildContext(today: string): TodayContext {
  // 引数の today から weekday を出すための、 Date.UTC を使った安全な計算
  const [y, m, d] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = utc.getUTCDay();
  // 月末: 翌月1日の前日 = この月の最終日
  const lastDayUtc = new Date(Date.UTC(y, m, 0)); // m を 1-12 で渡すと「m月の最終日」
  const lastDay = lastDayUtc.getUTCDate();
  const daysToMonthEnd = lastDay - d;
  return { today, weekday, daysToMonthEnd };
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  const aMs = Date.UTC(ya, ma - 1, da);
  const bMs = Date.UTC(yb, mb - 1, db);
  return Math.round((bMs - aMs) / (1000 * 60 * 60 * 24));
}

function decide(today: string, races: Race[]): ModeResult {
  const ctx = buildContext(today);
  const notes: string[] = [];
  notes.push(`today=${today} weekday=${ctx.weekday} daysToMonthEnd=${ctx.daysToMonthEnd}`);

  // 直近7日以内のレース(今日含む、過去を除く)
  const upcoming7d = races
    .filter((r) => r.date)
    .map((r) => ({ r, days: daysBetween(today, r.date) }))
    .filter(({ days }) => days >= 0 && days <= 7)
    .sort((a, b) => a.days - b.days);

  // 月末(残り3日以内) かつ 来月以降にレースがある
  const isMonthEnd = ctx.daysToMonthEnd <= 3;
  const nextMonth = (() => {
    const [y, m] = today.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  })();
  const nextMonthRaces = races
    .filter((r) => r.date && r.date.startsWith(nextMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  // モード優先度: monthly_prep > race_week > weekly_review > light
  // ただし weekly_review は他モードと "両立可能" な扱い(月曜が race_week の中にあっても、ops-logもやる)
  // 出力上は1つのモードに丸めるので、ここでは weekly_review 単独表記はしない方針:
  // 月曜なら notes に「ops-log/INSIGHTS の更新も実施」と書き、メインモードは別途確定する。

  if (ctx.weekday === 1) {
    notes.push("月曜日: ops-log の集計 / INSIGHTS.md の更新 / 週次改善PR も併せて行う");
  }

  if (isMonthEnd && nextMonthRaces.length > 0) {
    notes.push(`月末モード(残${ctx.daysToMonthEnd}日)。来月(${nextMonth})に${nextMonthRaces.length}件のレースあり`);
    return {
      mode: "monthly_prep",
      target_races: nextMonthRaces.slice(0, 5).map(({ id, name, date, planned_horses }) => ({
        id, name, date,
        days_until: daysBetween(today, date),
        planned_horses: planned_horses ?? [],
      })),
      next_month_races: nextMonthRaces.map(({ id, name, date }) => ({ id, name, date })),
      notes,
    };
  }

  if (upcoming7d.length > 0) {
    notes.push(`重賞週モード: 7日以内に${upcoming7d.length}件の重賞`);
    return {
      mode: "race_week",
      target_races: upcoming7d.map(({ r, days }) => ({
        id: r.id, name: r.name, date: r.date,
        days_until: days,
        planned_horses: r.planned_horses ?? [],
      })),
      next_month_races: [],
      notes,
    };
  }

  if (ctx.weekday === 1) {
    notes.push("月曜日かつ重賞週でも月末でもないので軽量+改善モード");
    return { mode: "weekly_review", target_races: [], next_month_races: [], notes };
  }

  notes.push("軽量モード: POG・業界ニュース・血統話題のみ拾う");
  return { mode: "light", target_races: [], next_month_races: [], notes };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const today = getToday(args.date);
  const races = readRaces();
  const result = decide(today, races);
  // JSON1行で標準出力 → routine がこれをそのまま読んで分岐
  // 人間向けに整形した notes は stderr に分けたほうが綺麗だが、ここでは1つにまとめる
  console.log(JSON.stringify(result, null, 2));
}

main();
