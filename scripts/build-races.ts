// races/YYYY/MM/<race-id>.md を生成する。
//
// 各レースページの構成:
//   1. レース概要（grade / date / course / distance）
//   2. レース自体に紐づく記事（race_id = この race.id のもの）を時系列で
//   3. 出走予定馬ごとに、その馬が登場する記事を時系列で（race_id 紐づきの有無に関わらず）
//
// 「予想を立てるのにこのページを開けば全部揃っている」が目標。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb, allRaces, articlesByRace, articlesByHorse,
  type ArticleRow, type Race,
} from "../src/db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function renderArticleLine(a: ArticleRow): string {
  // 簡潔に「日付 — タイトル(出典)」だけ。本文は元記事へリンク。
  return `- **${a.date}** — [${a.title_ja}](${a.url}) *(出典: ${a.source})*`;
}

function renderArticleBlock(a: ArticleRow): string {
  const summary = a.summary.replace(/\\n/g, "\n");
  const lines = [
    `#### [${a.title_ja}](${a.url})`,
    `*${a.title_en}*`,
    `出典: ${a.source} ・ ${a.date}`,
    ``,
    summary,
    ``,
  ];
  return lines.join("\n");
}

function renderRaceFile(race: Race, raceArticles: ArticleRow[], horseToArticles: Map<string, ArticleRow[]>): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`race_id: ${race.id}`);
  lines.push(`name: ${race.name}`);
  lines.push(`grade: ${race.grade}`);
  lines.push(`date: ${race.date}`);
  lines.push(`course: ${race.course}`);
  lines.push(`distance: ${race.distance}`);
  lines.push(`planned_horses: ${race.planned_horses.length}`);
  lines.push(`articles: ${raceArticles.length}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${race.name} (${race.grade})`);
  lines.push("");
  if (race.date || race.course || race.distance) {
    const meta = [race.date, race.course, race.distance].filter(Boolean).join(" ・ ");
    lines.push(`**${meta}**`);
    lines.push("");
  }

  // 1. レース自体に紐づく記事（展望・出馬表・追い切り評価などレースを直接論じたもの）
  lines.push(`## 📰 このレースに関する記事 (${raceArticles.length}件)`);
  lines.push("");
  if (raceArticles.length === 0) {
    lines.push("*まだ記事がありません。*");
    lines.push("");
  } else {
    for (const a of raceArticles) {
      lines.push(renderArticleBlock(a));
    }
  }

  // 2. 出走予定馬ごとに、その馬の最近の記事を時系列で
  lines.push(`## 🐎 出走予定馬と関連記事 (${race.planned_horses.length}頭)`);
  lines.push("");
  if (race.planned_horses.length === 0) {
    lines.push("*出走予定馬はまだ抽出されていません。記事で名前が拾われ次第ここに並びます。*");
    lines.push("");
  } else {
    for (const horse of race.planned_horses) {
      const arts = horseToArticles.get(horse) ?? [];
      lines.push(`### ${horse}`);
      if (arts.length === 0) {
        lines.push("*関連記事なし。*");
      } else {
        for (const a of arts.slice(0, 20)) {
          lines.push(renderArticleLine(a));
        }
        if (arts.length > 20) {
          lines.push(`- *他 ${arts.length - 20} 件 → [horses/${horse}.md](../../../horses/${encodeURIComponent(horse)}.md)*`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function main() {
  const db = openDb();
  const races = allRaces(db);

  // 全馬名 → 記事リストの索引を一度作っておき、レース内で reuse する
  const horseIndex = new Map<string, ArticleRow[]>();
  for (const race of races) {
    for (const horse of race.planned_horses) {
      if (!horseIndex.has(horse)) {
        horseIndex.set(horse, articlesByHorse(db, horse));
      }
    }
  }

  let written = 0;
  for (const race of races) {
    const raceArts = articlesByRace(db, race.id);
    // 日付なしレースは "tba" ディレクトリへ
    const yymm = race.date && /^\d{4}-\d{2}/.test(race.date)
      ? { y: race.date.slice(0, 4), m: race.date.slice(5, 7) }
      : { y: "tba", m: "tba" };
    const dir = join(ROOT, "races", yymm.y, yymm.m);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${race.id}.md`), renderRaceFile(race, raceArts, horseIndex), "utf-8");
    written++;
  }

  // races/README.md（索引）
  const indexLines: string[] = [];
  indexLines.push("# レース索引");
  indexLines.push("");
  indexLines.push("施行日の昇順に並んだ全レース。");
  indexLines.push("");

  const sortedByDate = [...races].sort((a, b) => {
    const ad = a.date || "9999-99-99";
    const bd = b.date || "9999-99-99";
    return ad.localeCompare(bd) || a.id.localeCompare(b.id);
  });
  let currentMonth = "";
  for (const r of sortedByDate) {
    const ym = r.date ? r.date.slice(0, 7) : "未定";
    if (ym !== currentMonth) {
      currentMonth = ym;
      indexLines.push(`## ${ym}`);
      indexLines.push("");
    }
    const yymm = r.date && /^\d{4}-\d{2}/.test(r.date)
      ? { y: r.date.slice(0, 4), m: r.date.slice(5, 7) }
      : { y: "tba", m: "tba" };
    const path = `${yymm.y}/${yymm.m}/${r.id}.md`;
    const dateLabel = r.date || "日付未定";
    const venue = [r.course, r.distance].filter(Boolean).join(" ");
    indexLines.push(`- **${dateLabel}** [${r.name} (${r.grade})](${path}) ${venue}`);
  }
  indexLines.push("");

  mkdirSync(join(ROOT, "races"), { recursive: true });
  writeFileSync(join(ROOT, "races", "README.md"), indexLines.join("\n"), "utf-8");

  db.close();
  console.log(`レースMarkdown生成完了: ${written}件 + races/README.md（索引）`);
}

main();
