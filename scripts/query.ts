// 簡易検索CLI。
//   npm run query -- --date 2026-05-30
//   npm run query -- --category politics
//   npm run query -- --month 2026-05 --category economy
//   npm run query -- --keyword Nvidia

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
  if (args.date) {
    where.push("date = ?");
    params.push(args.date);
  }
  if (args.month) {
    where.push("date LIKE ?");
    params.push(`${args.month}%`);
  }
  if (args.category) {
    where.push("category = ?");
    params.push(args.category);
  }
  if (args.keyword) {
    where.push("(title_ja LIKE ? OR title_en LIKE ? OR summary LIKE ?)");
    params.push(`%${args.keyword}%`, `%${args.keyword}%`, `%${args.keyword}%`);
  }

  const sql =
    `SELECT date, category, source, title_ja, url FROM articles` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY date DESC, category`;

  const rows = db.prepare(sql).all(...params) as ArticleRow[];
  db.close();

  if (rows.length === 0) {
    console.log("該当なし。");
    return;
  }
  for (const r of rows) {
    console.log(`[${r.date}] (${r.category}) ${r.title_ja}\n    ${r.source} — ${r.url}`);
  }
  console.log(`\n計 ${rows.length}件`);
}

main();
