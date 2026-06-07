// horses/<name>.md と sires/<name>.md を生成する。
//
// 登場した馬・種牡馬は全頭ページ化する（閾値なし）。
// レースページから出走予定馬名をクリックで遷移できるよう、すべての馬が
// 専用ページを持つ前提に揃えている。1記事しか無い馬のページも作っておけば、
// 次の記事が来た時に時系列で自然に積まれる。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb, horseCounts, sireCounts, articlesByHorse, articlesBySire,
  allRaces, safeFilename,
  type ArticleRow, type Race,
} from "../src/db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function renderArticleLine(a: ArticleRow): string {
  return `- **${a.date}** — [${a.title_ja}](${a.url}) *(出典: ${a.source})*`;
}

function renderEntityPage(
  name: string,
  kind: "horse" | "sire",
  articles: ArticleRow[],
  relatedRaces: Race[],
): string {
  const heading = kind === "horse" ? "🐎" : "🌱";
  const indexLink = kind === "horse" ? "[馬索引へ](README.md)" : "[種牡馬索引へ](README.md)";
  const lines: string[] = [];
  lines.push("---");
  lines.push(`${kind}: ${name}`);
  lines.push(`article_count: ${articles.length}`);
  lines.push(`related_races: ${relatedRaces.length}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${heading} ${name}`);
  lines.push("");
  lines.push(`関連記事 ${articles.length} 件（日付の新しい順）・ ${indexLink}`);
  lines.push("");

  // 「出走予定」または「言及あり」のレースへ戻れるようにする
  if (relatedRaces.length > 0) {
    const label = kind === "horse" ? "出走予定/関連レース" : "関連レース";
    lines.push(`## 🏆 ${label}`);
    lines.push("");
    for (const r of relatedRaces) {
      const ymm = r.date && /^\d{4}-\d{2}/.test(r.date)
        ? { y: r.date.slice(0, 4), m: r.date.slice(5, 7) }
        : { y: "tba", m: "tba" };
      // horses/<name>.md から races/YYYY/MM/<id>.md は ../races/YYYY/MM/<id>.md
      const path = `../races/${ymm.y}/${ymm.m}/${r.id}.md`;
      const dateLabel = r.date || "日付未定";
      lines.push(`- **${dateLabel}** [${r.name} (${r.grade})](${path}) ${r.course} ${r.distance}`);
    }
    lines.push("");
  }

  lines.push("## 📰 関連記事");
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
  const lines: string[] = [];
  lines.push(`# ${heading}`);
  lines.push("");
  lines.push(`登場回数の多い順。全 ${tallied.length} 件。`);
  lines.push("");
  for (const { name, count } of tallied) {
    const f = safeFilename(name);
    lines.push(`- **${count}件** [${name}](${f}.md)`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildKind(
  kind: "horse" | "sire",
  tallied: Array<{ name: string; count: number }>,
  fetch: (name: string) => ArticleRow[],
  relatedRaces: (name: string) => Race[],
): number {
  const dir = kind === "horse" ? "horses" : "sires";
  mkdirSync(join(ROOT, dir), { recursive: true });

  let written = 0;
  for (const { name } of tallied) {
    const arts = fetch(name);
    const races = relatedRaces(name);
    const f = safeFilename(name);
    writeFileSync(
      join(ROOT, dir, `${f}.md`),
      renderEntityPage(name, kind, arts, races),
      "utf-8",
    );
    written++;
  }
  writeFileSync(join(ROOT, dir, "README.md"), renderIndex(kind, tallied), "utf-8");
  return written;
}

function main() {
  const db = openDb();
  const races = allRaces(db);

  // 馬 → そのレースに planned_horses として登録されているレース一覧
  const horseRaceIndex = new Map<string, Race[]>();
  for (const r of races) {
    for (const h of r.planned_horses) {
      if (!horseRaceIndex.has(h)) horseRaceIndex.set(h, []);
      horseRaceIndex.get(h)!.push(r);
    }
  }
  // 各馬の関連レースを「日付昇順」で（次走順）
  for (const list of horseRaceIndex.values()) {
    list.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }

  const horsesTally = horseCounts(db);
  const horsesWritten = buildKind(
    "horse",
    horsesTally,
    (n) => articlesByHorse(db, n),
    (n) => horseRaceIndex.get(n) ?? [],
  );

  // 種牡馬 → 関連レースは「とりあえず無し」とする
  // (将来、産駒経由でレースを引きたくなったらここを実装)
  const siresTally = sireCounts(db);
  const siresWritten = buildKind(
    "sire",
    siresTally,
    (n) => articlesBySire(db, n),
    () => [],
  );

  db.close();
  console.log(`馬ページ: ${horsesWritten}件 / 種牡馬ページ: ${siresWritten}件（全頭ページ化）`);
}

main();
