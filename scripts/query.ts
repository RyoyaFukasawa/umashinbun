// 簡易検索CLI。
//   npm run query -- --date 2026-05-30
//   npm run query -- --category g1
//   npm run query -- --month 2026-05 --category overseas
//   npm run query -- --keyword イクイノックス
//   npm run query -- --race 2026-takarazuka-kinen
//   npm run query -- --horse ドウデュース
//   npm run query -- --sire ハーツクライ

import { openDb, type ArticleRow } from "../src/db.ts";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openDb();

  const where: string[] = [];
  const params: string[] = [];
  if (args.date)     { where.push("date = ?");         params.push(args.date); }
  if (args.month)    { where.push("date LIKE ?");      params.push(`${args.month}%`); }
  if (args.category) { where.push("category = ?");     params.push(args.category); }
  if (args.race)     { where.push("race_id = ?");      params.push(args.race); }
  if (args.horse)    { where.push("horses LIKE ?");    params.push(`%${args.horse}%`); }
  if (args.sire)     { where.push("sires LIKE ?");     params.push(`%${args.sire}%`); }
  if (args.keyword) {
    where.push("(title_ja LIKE ? OR title_en LIKE ? OR summary LIKE ?)");
    params.push(`%${args.keyword}%`, `%${args.keyword}%`, `%${args.keyword}%`);
  }

  const sql =
    `SELECT date, category, source, title_ja, url, race_id, horses, sires FROM articles` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY date DESC, category`;

  let rows = db.prepare(sql).all(...params) as ArticleRow[];

  // LIKE で部分一致しすぎないよう、horse / sire は配列要素として再確認
  if (args.horse) rows = rows.filter((r) => r.horses.split("\t").includes(args.horse));
  if (args.sire)  rows = rows.filter((r) => r.sires.split("\t").includes(args.sire));

  db.close();

  if (rows.length === 0) {
    console.log("該当なし。");
    return;
  }
  for (const r of rows) {
    const extras: string[] = [];
    if (r.race_id) extras.push(`race=${r.race_id}`);
    if (r.horses)  extras.push(`horses=${r.horses.replace(/\t/g, ",")}`);
    const tag = extras.length ? ` {${extras.join(" / ")}}` : "";
    console.log(`[${r.date}] (${r.category}) ${r.title_ja}${tag}\n    ${r.source} — ${r.url}`);
  }
  console.log(`\n計 ${rows.length}件`);
}

main();
