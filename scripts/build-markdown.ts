// articles.json を正本として、閲覧用Markdownを再生成する（内部で digest.db を生成して読む）:
//   - digests/YYYY/MM/YYYY-MM-DD.md  (日付ビュー)
//   - views/<category>.md            (カテゴリ別ビュー, 日付逆順)
//   - README.md                      (索引: 最新の日付へのリンク)

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb,
  articlesByDate,
  articlesByCategory,
  allDates,
  type ArticleRow,
} from "../src/db.ts";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "../src/feeds.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Reddit 等の未確認ソースを出典名から機械的に判定する。
// routine 側でも⚠️を付ける運用だが、書き忘れの保険としてここでも自動付与する。
// 注: 正本(articles.json)/DB は unverified 列を持たないため、ここでは source 名で判定している。
//     feeds.ts に unverified ソースを増やしたら、その出典名がこの正規表現に乗るか確認すること
//     （乗らない命名のソースを足す場合は、ここのパターンも更新する）。
function isUnverifiedSource(source: string): boolean {
  return /reddit/i.test(source);
}

function renderArticle(a: ArticleRow): string {
  const tags = `#${a.category} #${a.date}`;
  // summary 内の \n を実改行に
  const summary = a.summary.replace(/\\n/g, "\n");
  const unverified = isUnverifiedSource(a.source);
  // 未確認ソースは見出しに⚠️を付け、末尾に注記を添える（事実断定を避ける明示）。
  // ただし routine 側でも ⚠️/注記を入れる運用のため、二重にならないよう冪等にする
  // （title が既に⚠️で始まる/summaryに既に未確認注記がある場合は重ねて足さない）。
  const titleHasWarning = a.title_ja.trimStart().startsWith("⚠️");
  const summaryHasNote = /未確認情報/.test(summary);
  const heading =
    unverified && !titleHasWarning
      ? `### ⚠️ [${a.title_ja}](${a.url})`
      : `### [${a.title_ja}](${a.url})`;
  const lines = [
    heading,
    `*${a.title_en}*`,
    `出典: ${a.source} ・ ${tags}`,
    ``,
    summary,
  ];
  if (unverified && !summaryHasNote) {
    lines.push(
      `> ⚠️ **未確認情報**（${a.source}発・要裏取り）。コミュニティの話題であり、事実は確認されていません。`,
    );
  }
  lines.push(``);
  return lines.join("\n");
}

function renderDateFile(date: string, rows: ArticleRow[]): string {
  const cats = [...new Set(rows.map((r) => r.category))];
  const lines: string[] = [];
  lines.push("---");
  lines.push(`date: ${date}`);
  lines.push(`categories: [${cats.join(", ")}]`);
  lines.push(`count: ${rows.length}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${date} ニュースダイジェスト`);
  lines.push("");

  for (const cat of CATEGORY_ORDER) {
    const inCat = rows.filter((r) => r.category === cat);
    if (inCat.length === 0) continue;
    lines.push(`## ${CATEGORY_LABELS[cat as Category]}`);
    lines.push("");
    for (const a of inCat) lines.push(renderArticle(a));
  }
  return lines.join("\n");
}

function renderCategoryView(cat: Category, rows: ArticleRow[]): string {
  const lines: string[] = [];
  lines.push(`# ${CATEGORY_LABELS[cat]} — 全アーカイブ`);
  lines.push("");
  lines.push(`全${rows.length}件 / 日付の新しい順`);
  lines.push("");
  let currentDate = "";
  for (const a of rows) {
    if (a.date !== currentDate) {
      currentDate = a.date;
      lines.push(`## ${a.date}`);
      lines.push("");
    }
    lines.push(renderArticle(a));
  }
  return lines.join("\n");
}

function renderReadme(dates: string[]): string {
  const lines: string[] = [];
  lines.push("# umashinbun 馬新聞");
  lines.push("");
  lines.push("毎朝、週末の競馬を読み解くための自動ダイジェスト。");
  lines.push("週末の重賞・特別レースの予想と展望、その週末に走る注目馬・厩舎・調教、");
  lines.push("POG・血統、海外競馬、競馬界のニュースを日本語に翻訳・要約して毎日蓄積する。");
  lines.push("");
  lines.push("単なる結果速報ではなく、**この週末のレースをどう読むか・どの馬の見え方がどう変わるか**を");
  lines.push("読者が立体的に掴めるよう、予想含意・注目馬・適性・血統の視点で読み解くことを重視する。");
  lines.push("");
  lines.push("- **正本**: `articles.json`（テキスト）。重複排除もここ。git で差分が読める。");
  lines.push("- **検索**: `digest.db`（SQLite）。`articles.json` から生成する派生物（git管理外）。");
  lines.push("- **日付で読む**: `digests/YYYY/MM/YYYY-MM-DD.md`");
  lines.push("- **カテゴリで読む**: `views/g1.md` / `views/horse.md` / `views/pog.md` / `views/overseas.md` / `views/news.md`");
  lines.push("");
  lines.push("## 仕組み");
  lines.push("");
  lines.push("1. **毎朝 6:50 JST** — GitHub Actions が RSS を取得し `raw-items.json` を生成（[.github/workflows/fetch-feeds.yml](.github/workflows/fetch-feeds.yml)）。");
  lines.push("2. **毎朝 7:00 JST** — Claude routine が記事を選定し、選んだ記事の本文を取得（[scripts/fetch-article.ts](scripts/fetch-article.ts)）して競馬ファンの視点で翻訳・要約し、SQLite と Markdown に蓄積（[ROUTINES_PROMPT.md](ROUTINES_PROMPT.md)）。");
  lines.push("3. **毎週月曜** — 別の Claude routine が直近7日の運用ログ（`ops-log/`）を全件読み、(A)複数レンズのagentでブレスト→(B)推進派⇄懐疑派の対立議論＋ジャッジ裁定で改善を練る。結論に基づくフィード改善を PR で提案する（ブレスト/議論ログは [ops-log/DEBATES/](ops-log/DEBATES/) に蓄積）（[IMPROVE_PROMPT.md](IMPROVE_PROMPT.md)）。");
  lines.push("");
  lines.push("## 情報源");
  lines.push("");
  lines.push("国内大手スポーツ紙・公式機関・海外専門紙を横断している（[src/feeds.ts](src/feeds.ts)）。");
  lines.push("");
  lines.push("- **週末重賞・G1展望**: netkeiba ニュース・JRA お知らせ・サンスポZBAT!・東スポ競馬・スポーツ報知");
  lines.push("- **注目馬・調教・厩舎**: ラジオNIKKEI 競馬・デイリースポーツ・スポニチ・日刊スポーツ");
  lines.push("- **POG・2歳・血統**: netkeiba コラム・JBIS-Search・JRA-VAN コラム");
  lines.push("- **海外競馬**: Racing Post・BloodHorse・JAIRS・Thoroughbred Daily News");
  lines.push("- **競馬界ニュース**: NAR 地方競馬・Yahoo!ニュース 競馬・競馬ラボ");
  lines.push("");
  lines.push("※ 無料媒体は記事本文まで取得して厚く要約する。Racing Post 等の海外専門紙はペイウォール部分があり、要約は RSS のリード文の範囲。");
  lines.push("コミュニティ発は ⚠️ 付きで「未確認情報」として明示し、事実断定を避ける。");
  lines.push("記事に無い情報（馬名・着順・走破時計・調教時計・斤量・人気/オッズ）は創作しない方針。");
  lines.push("買い目の断定的な推奨はしない。あくまで「強気/弱気材料の整理」にとどめる。");
  lines.push("");
  lines.push("## 最近のダイジェスト");
  lines.push("");
  for (const d of dates.slice(0, 14)) {
    const [y, m] = d.split("-");
    lines.push(`- [${d}](digests/${y}/${m}/${d}.md)`);
  }
  lines.push("");
  lines.push("## 検索");
  lines.push("");
  lines.push("CLI で手軽に（内部で `articles.json` から `digest.db` を生成して検索）:");
  lines.push("");
  lines.push("```sh");
  lines.push("npm run query -- --category g1 --month 2026-05");
  lines.push("npm run query -- --keyword イクイノックス");
  lines.push("```");
  lines.push("");
  lines.push("SQL を直接叩きたい場合（`npm run ingest` 等で生成された `digest.db` に対して）:");
  lines.push("");
  lines.push("```sql");
  lines.push("-- 2026年5月の週末重賞記事だけ");
  lines.push("SELECT date, title_ja, source FROM articles");
  lines.push("WHERE category='g1' AND date LIKE '2026-05%'");
  lines.push("ORDER BY date DESC;");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const db = openDb();
  const dates = allDates(db);

  // 日付ビュー（全日付を再生成）
  for (const date of dates) {
    const rows = articlesByDate(db, date);
    const [y, m] = date.split("-");
    const dir = join(ROOT, "digests", y, m);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${date}.md`), renderDateFile(date, rows), "utf-8");
  }

  // カテゴリビュー
  mkdirSync(join(ROOT, "views"), { recursive: true });
  for (const cat of CATEGORY_ORDER) {
    const rows = articlesByCategory(db, cat);
    writeFileSync(join(ROOT, "views", `${cat}.md`), renderCategoryView(cat as Category, rows), "utf-8");
  }

  // README索引
  writeFileSync(join(ROOT, "README.md"), renderReadme(dates), "utf-8");

  db.close();
  console.log(`Markdown生成完了: 日付${dates.length}件 + カテゴリ${CATEGORY_ORDER.length}件 + README`);
}

main();
