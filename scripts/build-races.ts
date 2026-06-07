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
  openDb, allRaces, articlesByRace, articlesByHorse, safeFilename, raceFilePath,
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
  lines.push(`finished: ${race.results && race.results.length > 0}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${race.name} (${race.grade})`);
  lines.push("");
  if (race.date || race.course || race.distance) {
    const meta = [race.date, race.course, race.distance].filter(Boolean).join(" ・ ");
    lines.push(`**${meta}**`);
    lines.push("");
  }

  // 🏁 結果 (results が入っていれば表示。 馬名は horses/<name>.md にリンク)
  if (race.results && race.results.length > 0) {
    lines.push(`## 🏁 結果`);
    lines.push("");
    lines.push("| 着順 | 馬 | 騎手 | タイム | 人気 |");
    lines.push("|---|---|---|---|---|");
    // 上位5着 + 上位人気(1番人気)を必ず含める
    const top5 = race.results.filter((r) => r.place <= 5);
    const topPopRow = race.results.find((r) => r.popularity === 1);
    const extras: typeof race.results = [];
    if (topPopRow && !top5.some((r) => r.horse === topPopRow.horse)) {
      extras.push(topPopRow);
    }
    const shown = [...top5, ...extras].sort((a, b) => a.place - b.place);
    for (const r of shown) {
      const medal = r.place === 1 ? "🥇 1着" : r.place === 2 ? "🥈 2着" : r.place === 3 ? "🥉 3着" : `${r.place}着`;
      const horseLink = `[${r.horse}](../../../horses/${safeFilename(r.horse)}.md)`;
      const jockey = r.jockey ?? "";
      const time = r.time ?? "";
      const popularity = r.popularity != null ? `${r.popularity}人気` : "";
      lines.push(`| ${medal} | ${horseLink} | ${jockey} | ${time} | ${popularity} |`);
    }
    if (race.results.length > shown.length) {
      lines.push("");
      lines.push(`*全${race.results.length}頭中、上位5着 + 1番人気を表示*`);
    }
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

  // 2. 出走馬ごとに、その馬の最近の記事を時系列で
  // 結果が出ているレースは「出走馬」、まだのレースは「出走予定馬」と表現を変える
  const horsesLabel = race.results && race.results.length > 0 ? "出走馬" : "出走予定馬";
  lines.push(`## 🐎 ${horsesLabel}と関連記事 (${race.planned_horses.length}頭)`);
  lines.push("");
  if (race.planned_horses.length === 0) {
    lines.push("*出走予定馬はまだ抽出されていません。記事で名前が拾われ次第ここに並びます。*");
    lines.push("");
  } else {
    // レースページは races/YYYY/MM/<id>.md にあるので horses/ へは ../../../horses/
    // 馬名は専用ページ(horses/<safe-name>.md)へのリンクにする。
    // レースMDの相対位置から horses/ への遡り階数を決める
    // races/YYYY/MM/file.md → "../../../horses/" (3階層上)
    // races/tba/tba/file.md → "../../../horses/" (3階層上、同じ)
    const horsesPrefix = "../../../horses/";
    for (const horse of race.planned_horses) {
      const arts = horseToArticles.get(horse) ?? [];
      const safe = safeFilename(horse);
      lines.push(`### [${horse}](${horsesPrefix}${safe}.md)`);
      if (arts.length === 0) {
        lines.push("*関連記事なし。*");
      } else {
        for (const a of arts.slice(0, 20)) {
          lines.push(renderArticleLine(a));
        }
        if (arts.length > 20) {
          lines.push(`- *他 ${arts.length - 20} 件 → [${horse} のページ全体](${horsesPrefix}${safe}.md)*`);
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
    const { dir: relDir, file } = raceFilePath(race);
    const dir = join(ROOT, relDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), renderRaceFile(race, raceArts, horseIndex), "utf-8");
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
    // races/README.md からの相対パス: races/ を起点に dir/file の "races/" を剥がす
    const { dir, file } = raceFilePath(r);
    const relFromIndex = `${dir.replace(/^races\//, "")}/${file}`;
    const dateLabel = r.date || "日付未定";
    const venue = [r.course, r.distance].filter(Boolean).join(" ");
    indexLines.push(`- **${dateLabel}** [${r.name} (${r.grade})](${relFromIndex}) ${venue}`);
  }
  indexLines.push("");

  mkdirSync(join(ROOT, "races"), { recursive: true });
  writeFileSync(join(ROOT, "races", "README.md"), indexLines.join("\n"), "utf-8");

  db.close();
  console.log(`レースMarkdown生成完了: ${written}件 + races/README.md（索引）`);
}

main();
