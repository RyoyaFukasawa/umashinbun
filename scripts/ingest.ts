// Routines上のClaudeが翻訳・要約して生成した digest-input.json をDBに投入する。
//
// digest-input.json の形式（配列）:
// [
//   {
//     "date": "2026-05-30",
//     "category": "g1",
//     "source": "netkeiba ニュース＆コラム",
//     "title_ja": "日本語訳タイトル",
//     "title_en": "原題（日本語ソースなら同じでよい）",
//     "url": "https://...",
//     "summary": "8〜10行の日本語要約（改行は \\n で表現）",
//     "race_id":  "2026-takarazuka-kinen",  // 紐づくレースの id、無ければ null/省略可
//     "horses":   ["ドウデュース", "イクイノックス"],  // 登場馬名（無ければ [] / 省略可）
//     "sires":    ["ハーツクライ", "キタサンブラック"],  // 登場種牡馬
//     "jockeys":  ["武豊", "ルメール"],                  // 登場騎手
//     "trainers": ["友道康夫", "石橋守"]                 // 登場調教師
//   }, ...
// ]

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  appendArticles, openDb, DB_PATH, readRaces, writeRaces,
  type NewArticle, type Race,
} from "../src/db.ts";
import { CATEGORY_ORDER } from "../src/feeds.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = join(__dirname, "..", "digest-input.json");

const VALID_CATEGORIES = new Set<string>(CATEGORY_ORDER);

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function validate(items: unknown): NewArticle[] {
  if (!Array.isArray(items)) throw new Error("digest-input.json は配列である必要があります");
  const out: NewArticle[] = [];
  for (const [i, raw] of items.entries()) {
    const a = raw as Record<string, unknown>;
    const required = ["date", "category", "source", "title_ja", "title_en", "url", "summary"];
    for (const key of required) {
      if (typeof a[key] !== "string" || (a[key] as string).trim() === "") {
        throw new Error(`item[${i}] のフィールド "${key}" が不正です`);
      }
    }
    if (!VALID_CATEGORIES.has(a.category as string)) {
      throw new Error(`item[${i}] の category "${a.category}" は無効です`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date as string)) {
      throw new Error(`item[${i}] の date "${a.date}" は YYYY-MM-DD 形式である必要があります`);
    }
    out.push({
      date: a.date as string,
      category: a.category as string,
      source: a.source as string,
      title_ja: a.title_ja as string,
      title_en: a.title_en as string,
      url: a.url as string,
      summary: a.summary as string,
      race_id: typeof a.race_id === "string" && a.race_id.trim() !== "" ? a.race_id : null,
      horses: asStringArray(a.horses).join("\t"),
      sires: asStringArray(a.sires).join("\t"),
      jockeys: asStringArray(a.jockeys).join("\t"),
      trainers: asStringArray(a.trainers).join("\t"),
    });
  }
  return out;
}

/**
 * 記事の race_id を見て races.json に未登録のレースがあれば動的に追加し、
 * 既存レースには記事から拾った馬名を planned_horses に追記する。
 */
function syncRacesFromArticles(items: NewArticle[]): void {
  const races = readRaces();
  const byId = new Map(races.map((r) => [r.id, r]));
  let touched = false;

  for (const a of items) {
    if (!a.race_id) continue;
    const horseNames = a.horses ? a.horses.split("\t").filter(Boolean) : [];

    let race = byId.get(a.race_id);
    if (!race) {
      // 記事から動的に追加（最低限のメタ。詳細は手動 or 後段で補完する想定）
      race = {
        id: a.race_id,
        name: a.race_id,            // 暫定: id をそのまま name に。後で書き換え可能
        grade: "未分類",
        date: "",
        course: "",
        distance: "",
        planned_horses: [],
        origin: "article",
      };
      byId.set(a.race_id, race);
      races.push(race);
      touched = true;
    }
    for (const h of horseNames) {
      if (!race.planned_horses.includes(h)) {
        race.planned_horses.push(h);
        touched = true;
      }
    }
  }

  if (touched) writeRaces(races);
}

function main() {
  if (!existsSync(INPUT_PATH)) {
    console.error(`入力ファイルがありません: ${INPUT_PATH}`);
    process.exit(1);
  }
  const items = validate(JSON.parse(readFileSync(INPUT_PATH, "utf-8")));

  const nowIso = new Date().toISOString();
  const added = appendArticles(items, nowIso);
  console.log(`${items.length}件中 ${added}件を articles.json に新規追加しました（既出は重複排除）。`);

  syncRacesFromArticles(items);

  const db = openDb(DB_PATH);
  db.close();
  console.log(`検索用 digest.db を再生成しました（articles.json が正本）。`);
}

main();
