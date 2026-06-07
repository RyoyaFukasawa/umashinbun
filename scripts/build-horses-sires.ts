// horses/<name>.md と sires/<name>.md を生成する。
//
// 登場した馬・種牡馬は全頭ページ化する（閾値なし）。
// 馬ページには horses-profile.json があれば「📖 プロフィール」セクションを差し込み、
// 父・母・母父・生産者・馬主・調教師・主戦騎手を相応のエンティティページにリンクする。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb, horseCounts, sireCounts, articlesByHorse, articlesBySire,
  allRaces, safeFilename, readHorseProfiles, raceFilePath,
  type ArticleRow, type Race, type HorseProfile,
} from "../src/db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function renderArticleLine(a: ArticleRow): string {
  return `- **${a.date}** — [${a.title_ja}](${a.url}) *(出典: ${a.source})*`;
}

// 馬ページ(horses/<name>.md)から各種エンティティページへの相対リンク。
// 全エンティティは horses/ と同じくリポジトリ直下のディレクトリに置かれる。
function linkFromHorse(kind: "sires" | "dams" | "breeders" | "owners" | "trainers" | "jockeys", name: string): string {
  return `[${name}](../${kind}/${safeFilename(name)}.md)`;
}

/**
 * major_results の各エントリのレース名を、可能ならレースページへのリンクにする。
 * race_id が指定されていて、races.json に該当レースがあればリンクを張る。
 * 無ければプレーンテキスト。
 */
function makeRaceLabelFromHorse(race_id: string | undefined, name: string, raceById: Map<string, Race>): string {
  if (!race_id) return name;
  const race = raceById.get(race_id);
  if (!race) return name;
  // horses/<name>.md (1階層) → races/.../<file>.md なので "../" + dir/file
  const { dir, file } = raceFilePath(race);
  return `[${name}](../${dir}/${file})`;
}

function renderProfileSection(profile: HorseProfile, raceById: Map<string, Race>): string {
  const rows: Array<[string, string]> = [];
  if (profile.born) rows.push(["生年月日", profile.born]);
  if (profile.sex) rows.push(["性別" + (profile.coat ? "・毛色" : ""), profile.sex + (profile.coat ? ` ・ ${profile.coat}` : "")]);
  if (profile.sire) rows.push(["父", linkFromHorse("sires", profile.sire)]);
  if (profile.dam) rows.push(["母", linkFromHorse("dams", profile.dam)]);
  if (profile.damsire) rows.push(["母父", linkFromHorse("sires", profile.damsire)]);
  if (profile.breeder) rows.push(["生産者", linkFromHorse("breeders", profile.breeder)]);
  if (profile.owner) rows.push(["馬主", linkFromHorse("owners", profile.owner)]);
  if (profile.trainer) rows.push(["調教師", linkFromHorse("trainers", profile.trainer)]);
  if (profile.main_jockeys?.length) {
    rows.push(["主戦騎手", profile.main_jockeys.map((j) => linkFromHorse("jockeys", j)).join(" / ")]);
  }
  if (profile.record) rows.push(["通算成績", profile.record]);

  const lines: string[] = [];
  lines.push("## 📖 プロフィール");
  lines.push("");
  lines.push("| 項目 | 内容 |");
  lines.push("|---|---|");
  for (const [k, v] of rows) lines.push(`| **${k}** | ${v} |`);
  lines.push("");

  // major_results は新フィールド名。readHorseProfiles() で旧 major_wins から
  // 正規化済みなので、profile.major_results を見るだけでよい。
  const results = profile.major_results ?? [];
  if (results.length > 0) {
    lines.push("### 主要勝利・好走");
    lines.push("");
    for (const r of results) {
      // 1着=🥇 / 2着=🥈 / 3着=🥉。place が無い旧データは🥇に倒れる(後方互換)。
      const medal = r.place === 2 ? "🥈" : r.place === 3 ? "🥉" : "🥇";
      // race_id があってraces.jsonに該当レースがあればレース名をリンク化
      const raceLabel = makeRaceLabelFromHorse(r.race_id, r.name, raceById);
      // コース/距離が両方ある場合は ` — 阪神 芝2200m` で末尾に併記、
      // どちらかしか無ければそれだけ、両方無ければ表記なし。
      const venue = [r.course, r.distance].filter(Boolean).join(" ");
      const venueLabel = venue ? ` — ${venue}` : "";
      lines.push(`- ${medal} **${r.year}年 ${raceLabel} (${r.grade})**${venueLabel}`);
    }
    lines.push("");
  }

  if (profile.strengths?.length) {
    lines.push("### 得意・特徴");
    lines.push("");
    for (const s of profile.strengths) lines.push(`- ${s}`);
    lines.push("");
  }

  if (profile.story) {
    lines.push("### 物語");
    lines.push("");
    lines.push(`> ${profile.story}`);
    lines.push("");
  }

  if (profile.source_url) {
    lines.push(`*出典: [${profile.source_url}](${profile.source_url})*`);
    lines.push("");
  }

  return lines.join("\n");
}

function renderEntityPage(
  name: string,
  kind: "horse" | "sire",
  articles: ArticleRow[],
  relatedRaces: Race[],
  profile: HorseProfile | undefined,
  raceById: Map<string, Race>,
): string {
  const heading = kind === "horse" ? "🐎" : "🌱";
  const indexLink = kind === "horse" ? "[馬索引へ](README.md)" : "[種牡馬索引へ](README.md)";
  const lines: string[] = [];
  lines.push("---");
  lines.push(`${kind}: ${name}`);
  lines.push(`article_count: ${articles.length}`);
  lines.push(`related_races: ${relatedRaces.length}`);
  if (profile) lines.push(`has_profile: true`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${heading} ${name}`);
  lines.push("");
  lines.push(`関連記事 ${articles.length} 件 ・ ${indexLink}`);
  lines.push("");

  // プロフィール
  if (kind === "horse" && profile) {
    lines.push(renderProfileSection(profile, raceById));
  }

  // 出走予定/関連レース
  if (relatedRaces.length > 0) {
    const label = kind === "horse" ? "出走予定/関連レース" : "関連レース";
    lines.push(`## 🏆 ${label}`);
    lines.push("");
    for (const r of relatedRaces) {
      // horses/<name>.md (1階層) → races/.../<file>.md なので "../" + dir/file
      const { dir, file } = raceFilePath(r);
      const path = `../${dir}/${file}`;
      const dateLabel = r.date || "日付未定";
      lines.push(`- **${dateLabel}** [${r.name} (${r.grade})](${path}) ${r.course} ${r.distance}`);
    }
    lines.push("");
  }

  lines.push("## 📰 関連記事");
  lines.push("");
  for (const a of articles) lines.push(renderArticleLine(a));
  lines.push("");

  if (articles.length > 0) {
    lines.push("## 最近の記事要約（上位5件）");
    lines.push("");
    for (const a of articles.slice(0, 5)) {
      lines.push(`### [${a.title_ja}](${a.url})`);
      lines.push(`*${a.title_en}* / 出典: ${a.source} ・ ${a.date}`);
      lines.push("");
      lines.push(a.summary.replace(/\\n/g, "\n"));
      lines.push("");
    }
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
  profileOf: (name: string) => HorseProfile | undefined,
  raceById: Map<string, Race>,
): number {
  const dir = kind === "horse" ? "horses" : "sires";
  mkdirSync(join(ROOT, dir), { recursive: true });

  let written = 0;
  for (const { name } of tallied) {
    const arts = fetch(name);
    const races = relatedRaces(name);
    const profile = profileOf(name);
    const f = safeFilename(name);
    writeFileSync(
      join(ROOT, dir, `${f}.md`),
      renderEntityPage(name, kind, arts, races, profile, raceById),
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
  const profiles = readHorseProfiles();
  // race_id → Race の索引(主要勝利・好走のレース名をリンク化するときに使う)
  const raceById = new Map<string, Race>(races.map((r) => [r.id, r]));

  // 馬 → そのレースに planned_horses として登録されているレース一覧
  const horseRaceIndex = new Map<string, Race[]>();
  for (const r of races) {
    for (const h of r.planned_horses) {
      if (!horseRaceIndex.has(h)) horseRaceIndex.set(h, []);
      horseRaceIndex.get(h)!.push(r);
    }
  }
  for (const list of horseRaceIndex.values()) {
    list.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }

  // 登場馬の集計に「horses-profile.json にだけ載っていて記事0件の馬」も足す
  // さらに planned_horses にだけ登場する馬 (出走予定だが記事もプロフィールもまだない馬) も足す
  const articleTally = horseCounts(db);
  const tallyMap = new Map<string, number>(articleTally.map((t) => [t.name, t.count]));
  for (const name of Object.keys(profiles)) {
    if (!tallyMap.has(name)) tallyMap.set(name, 0);
  }
  for (const name of horseRaceIndex.keys()) {
    if (!tallyMap.has(name)) tallyMap.set(name, 0);
  }
  const horsesTally = [...tallyMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const horsesWritten = buildKind(
    "horse",
    horsesTally,
    (n) => articlesByHorse(db, n),
    (n) => horseRaceIndex.get(n) ?? [],
    (n) => profiles[n],
    raceById,
  );

  const siresTally = sireCounts(db);
  const siresWritten = buildKind(
    "sire",
    siresTally,
    (n) => articlesBySire(db, n),
    () => [],
    () => undefined,
    raceById,
  );

  db.close();
  console.log(`馬ページ: ${horsesWritten}件 / 種牡馬ページ: ${siresWritten}件（全頭ページ化）`);
}

main();
