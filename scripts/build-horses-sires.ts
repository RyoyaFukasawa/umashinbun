// horses/<name>.md と sires/<name>.md を生成する。
//
// 全ての登場馬を機械的にページ化すると、1記事しか無い馬ばかりで価値が薄いので
// 「3記事以上で言及された馬」だけページ化する閾値を設けている。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb, horseCounts, sireCounts, articlesByHorse, articlesBySire,
  type ArticleRow,
} from "../src/db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/** ページ化する最低記事数（これ未満は索引リンクだけ） */
const PAGE_THRESHOLD = 3;

function safeFilename(name: string): string {
  // Markdownリンクが化けない範囲で、ファイル名として無難な形に。
  // 記号類は全角でも半角でも _ に置換、空白も _ に。
  return name.replace(/[\\/:*?"<>|\s]/g, "_");
}

function renderArticleLine(a: ArticleRow): string {
  return `- **${a.date}** — [${a.title_ja}](${a.url}) *(出典: ${a.source})*`;
}

function renderEntityPage(name: string, kind: "horse" | "sire", articles: ArticleRow[]): string {
  const heading = kind === "horse" ? "🐎" : "🌱";
  const lines: string[] = [];
  lines.push("---");
  lines.push(`${kind}: ${name}`);
  lines.push(`article_count: ${articles.length}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${heading} ${name}`);
  lines.push("");
  lines.push(`関連記事 ${articles.length} 件（日付の新しい順）`);
  lines.push("");
  for (const a of articles) lines.push(renderArticleLine(a));
  lines.push("");
  // 要約をブロックで再掲（最近5件）
  lines.push("## 最近の記事要約（上位5件）");
  lines.push("");
  for (const a of articles.slice(0, 5)) {
    lines.push(`### [${a.title_ja}](${a.url})`);
    lines.push(`*${a.title_en}* / 出典: ${a.source} ・ ${a.date}`);
    lines.push("");
    lines.push(a.summary.replace(/\\n/g, "\n"));
    lines.push("");
  }
  return lines.join("\n");
}

function renderIndex(
  kind: "horse" | "sire",
  tallied: Array<{ name: string; count: number }>,
): string {
  const heading = kind === "horse" ? "🐎 馬索引" : "🌱 種牡馬索引";
  const dir = kind === "horse" ? "horses" : "sires";
  const lines: string[] = [];
  lines.push(`# ${heading}`);
  lines.push("");
  lines.push(`登場回数の多い順。${PAGE_THRESHOLD}件以上の記事に出てきたものに専用ページを設けている。`);
  lines.push("");
  for (const { name, count } of tallied) {
    if (count >= PAGE_THRESHOLD) {
      const f = safeFilename(name);
      lines.push(`- **${count}件** [${name}](${f}.md)`);
    } else {
      lines.push(`- ${count}件 ${name}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function buildKind(
  kind: "horse" | "sire",
  tallied: Array<{ name: string; count: number }>,
  fetch: (name: string) => ArticleRow[],
): number {
  const dir = kind === "horse" ? "horses" : "sires";
  mkdirSync(join(ROOT, dir), { recursive: true });

  let written = 0;
  for (const { name, count } of tallied) {
    if (count < PAGE_THRESHOLD) continue;
    const arts = fetch(name);
    const f = safeFilename(name);
    writeFileSync(join(ROOT, dir, `${f}.md`), renderEntityPage(name, kind, arts), "utf-8");
    written++;
  }
  writeFileSync(join(ROOT, dir, "README.md"), renderIndex(kind, tallied), "utf-8");
  return written;
}

function main() {
  const db = openDb();

  const horsesTally = horseCounts(db);
  const horsesWritten = buildKind("horse", horsesTally, (n) => articlesByHorse(db, n));

  const siresTally = sireCounts(db);
  const siresWritten = buildKind("sire", siresTally, (n) => articlesBySire(db, n));

  db.close();
  console.log(
    `馬ページ: ${horsesWritten}件 / ${horsesTally.length}頭中、` +
    `種牡馬ページ: ${siresWritten}件 / ${siresTally.length}頭中（閾値 ${PAGE_THRESHOLD}記事以上）`,
  );
}

main();
