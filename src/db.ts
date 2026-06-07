import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = join(__dirname, "..", "digest.db");
/**
 * 正本（source of truth）は articles.json（テキスト）。
 * digest.db は articles.json から生成する検索用の派生物で、git 管理しない。
 *
 * 理由: バイナリの SQLite を毎日コミットすると (1) リポジトリが肥大化し
 * (2) git diff で「何が増えたか」が読めず (3) マージ競合が直せない。
 * テキスト(JSON)を正本にすると、差分が読めて・肥大化せず・それでいて
 * いつでも digest.db を再生成して SQL 検索できる（いいとこ取り）。
 */
export const ARTICLES_JSON = join(__dirname, "..", "articles.json");
export const RACES_JSON = join(__dirname, "..", "races.json");

/**
 * 馬名・種牡馬名 → ファイル名/URLセーフな文字列。
 * Markdown のリンクとファイル名の両方で安全に使えるよう、危ない記号を _ に置換する。
 * races と horses/sires の両方で同じ値が必要なので、ここで共通化している。
 */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]/g, "_");
}

export interface ArticleRow {
  id: number;
  date: string; // YYYY-MM-DD (記事日付)
  category: string; // g1 | horse | pog | overseas | news
  source: string;
  title_ja: string;
  title_en: string;
  url: string;
  summary: string;
  /**
   * この記事が紐づく主たるレース id（races.json の id）。
   * 例: "2026-takarazuka-kinen"。不明・該当なしは null。
   */
  race_id: string | null;
  /**
   * この記事に登場する馬名（要約Claudeが抽出）。タブ区切り文字列で保持
   * （SQLite に配列型がないので "ドウデュース\tイクイノックス" のように直列化）。
   */
  horses: string;
  /**
   * この記事に登場する種牡馬名（要約Claudeが抽出）。同上のタブ区切り。
   */
  sires: string;
  created_at: string;
}

export type NewArticle = Omit<ArticleRow, "id" | "created_at">;

/** 正本 articles.json に保存する1レコード（id は持たず、url が一意キー） */
export interface StoredArticle extends NewArticle {
  created_at: string;
}

// ---- races.json（レース一覧）の型と読み書き ------------------------------

/**
 * 1レースのメタ情報。races.json に手動で初期登録する G1 と、
 * 記事から動的に追加された地方/海外/未登録重賞の両方を保持する。
 */
export interface Race {
  /** ハイフン区切りの一意 id。例: "2026-takarazuka-kinen" */
  id: string;
  /** 表示用のレース名。例: "宝塚記念" */
  name: string;
  /** "G1" / "G2" / "G3" / "リステッド" / "OP" / "海外G1" など */
  grade: string;
  /** YYYY-MM-DD。施行日（未定なら "YYYY-MM" まで・空文字も許容） */
  date: string;
  /** "阪神" / "東京" / "Ascot" など */
  course: string;
  /** "芝2200m" / "ダ1800m" / "芝2400m(海外)" など */
  distance: string;
  /**
   * 想定出走馬の馬名リスト（記事から動的に追加）。
   * 正式な出馬表確定後はスクレイプで上書きする予定。
   */
  planned_horses: string[];
  /**
   * このエントリの出処。"manual" = 手動で初期登録、"article" = 記事から動的追加。
   */
  origin: "manual" | "article";
}

export function readRaces(path: string = RACES_JSON): Race[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("races.json は配列である必要があります");
  return raw as Race[];
}

/** races.json を書く。id 昇順で安定ソート（git 差分の安定化）。 */
export function writeRaces(races: Race[], path: string = RACES_JSON): void {
  const sorted = [...races].sort((a, b) => a.id.localeCompare(b.id));
  // planned_horses も決定的に
  for (const r of sorted) r.planned_horses = [...new Set(r.planned_horses)].sort();
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
}

// ---- 正本(articles.json)の読み書き --------------------------------------

/** articles.json を読む（無ければ空配列） */
export function readArticles(path: string = ARTICLES_JSON): StoredArticle[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("articles.json は配列である必要があります");
  // 旧スキーマ（race_id / horses / sires を持たない）との後方互換
  return (raw as Partial<StoredArticle>[]).map((a) => ({
    date: a.date ?? "",
    category: a.category ?? "",
    source: a.source ?? "",
    title_ja: a.title_ja ?? "",
    title_en: a.title_en ?? "",
    url: a.url ?? "",
    summary: a.summary ?? "",
    race_id: a.race_id ?? null,
    horses: a.horses ?? "",
    sires: a.sires ?? "",
    created_at: a.created_at ?? "",
  }));
}

/**
 * articles.json を書く。安定した git 差分のため date→category→url で決定的にソートする。
 */
export function writeArticles(articles: StoredArticle[], path: string = ARTICLES_JSON): void {
  const sorted = [...articles].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.category.localeCompare(b.category) ||
      a.url.localeCompare(b.url),
  );
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
}

/**
 * 新記事を正本にマージする。url が既出のものは無視（重複排除）。
 * @returns 実際に新規追加された件数
 */
export function appendArticles(
  newArticles: NewArticle[],
  nowIso: string,
  path: string = ARTICLES_JSON,
): number {
  const existing = readArticles(path);
  const seen = new Set(existing.map((a) => a.url));
  let added = 0;
  for (const a of newArticles) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    existing.push({ ...a, created_at: nowIso });
    added++;
  }
  writeArticles(existing, path);
  return added;
}

// ---- 検索用 digest.db の生成 ----------------------------------------------

/**
 * articles.json + races.json から SQLite を構築して返す。
 * path 省略時はインメモリDB（読み取り専用の検索に最適・ファイルを汚さない）。
 * path 指定時はそのファイルに書き出す（GUIで開く・配布する用）。
 */
export function openDb(path: string = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    DROP TABLE IF EXISTS articles;
    DROP TABLE IF EXISTS races;
    CREATE TABLE articles (
      id          INTEGER PRIMARY KEY,
      date        TEXT    NOT NULL,
      category    TEXT    NOT NULL,
      source      TEXT    NOT NULL,
      title_ja    TEXT    NOT NULL,
      title_en    TEXT    NOT NULL,
      url         TEXT    NOT NULL UNIQUE,
      summary     TEXT    NOT NULL,
      race_id     TEXT,
      horses      TEXT    NOT NULL DEFAULT '',
      sires       TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_articles_date     ON articles(date);
    CREATE INDEX idx_articles_category ON articles(category);
    CREATE INDEX idx_articles_race_id  ON articles(race_id);
    CREATE TABLE races (
      id              TEXT    PRIMARY KEY,
      name            TEXT    NOT NULL,
      grade           TEXT    NOT NULL,
      date            TEXT    NOT NULL,
      course          TEXT    NOT NULL,
      distance        TEXT    NOT NULL,
      planned_horses  TEXT    NOT NULL DEFAULT '',
      origin          TEXT    NOT NULL
    );
    CREATE INDEX idx_races_date ON races(date);
  `);

  // articles を投入
  const articleStmt = db.prepare(`
    INSERT OR IGNORE INTO articles
      (date, category, source, title_ja, title_en, url, summary, race_id, horses, sires, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const articles = [...readArticles()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.category.localeCompare(b.category) ||
      a.url.localeCompare(b.url),
  );
  for (const a of articles) {
    articleStmt.run(
      a.date, a.category, a.source, a.title_ja, a.title_en, a.url, a.summary,
      a.race_id, a.horses, a.sires, a.created_at,
    );
  }

  // races を投入
  const raceStmt = db.prepare(`
    INSERT OR IGNORE INTO races
      (id, name, grade, date, course, distance, planned_horses, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const races = readRaces();
  for (const r of races) {
    raceStmt.run(r.id, r.name, r.grade, r.date, r.course, r.distance, r.planned_horses.join("\t"), r.origin);
  }

  return db;
}

/** 既に取り込み済みのURL集合を返す（取得段階での重複スキップに使う） */
export function existingUrls(_db?: DatabaseSync): Set<string> {
  return new Set(readArticles().map((a) => a.url));
}

export function articlesByDate(db: DatabaseSync, date: string): ArticleRow[] {
  return db
    .prepare(`SELECT * FROM articles WHERE date = ? ORDER BY category, id`)
    .all(date) as ArticleRow[];
}

export function articlesByCategory(db: DatabaseSync, category: string): ArticleRow[] {
  return db
    .prepare(`SELECT * FROM articles WHERE category = ? ORDER BY date DESC, id DESC`)
    .all(category) as ArticleRow[];
}

export function articlesByRace(db: DatabaseSync, raceId: string): ArticleRow[] {
  return db
    .prepare(`SELECT * FROM articles WHERE race_id = ? ORDER BY date DESC, id DESC`)
    .all(raceId) as ArticleRow[];
}

/**
 * 指定した馬名が `horses`(タブ区切り)に含まれる記事を取得。
 * SQLite LIKE で部分一致するため、馬名が他の馬名の一部に含まれる場合は
 * 呼び出し側で再フィルタする（運用上は固有のカタカナ馬名なので衝突は稀）。
 */
export function articlesByHorse(db: DatabaseSync, horseName: string): ArticleRow[] {
  const pattern = `%${horseName}%`;
  const rows = db
    .prepare(`SELECT * FROM articles WHERE horses LIKE ? ORDER BY date DESC, id DESC`)
    .all(pattern) as ArticleRow[];
  return rows.filter((r) => r.horses.split("\t").includes(horseName));
}

export function articlesBySire(db: DatabaseSync, sireName: string): ArticleRow[] {
  const pattern = `%${sireName}%`;
  const rows = db
    .prepare(`SELECT * FROM articles WHERE sires LIKE ? ORDER BY date DESC, id DESC`)
    .all(pattern) as ArticleRow[];
  return rows.filter((r) => r.sires.split("\t").includes(sireName));
}

export function allDates(db: DatabaseSync): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT date FROM articles ORDER BY date DESC`)
    .all() as { date: string }[];
  return rows.map((r) => r.date);
}

export function allRaces(db: DatabaseSync): Race[] {
  const rows = db
    .prepare(`SELECT * FROM races ORDER BY date DESC, id`)
    .all() as Array<Omit<Race, "planned_horses"> & { planned_horses: string }>;
  return rows.map((r) => ({
    ...r,
    planned_horses: r.planned_horses ? r.planned_horses.split("\t").filter(Boolean) : [],
  }));
}

/**
 * 出現回数つきの馬名集計。N件以上の記事に登場した馬を horses/<name>.md にする等の用途。
 */
export function horseCounts(db: DatabaseSync): Array<{ name: string; count: number }> {
  const rows = db.prepare(`SELECT horses FROM articles WHERE horses != ''`).all() as { horses: string }[];
  const tally = new Map<string, number>();
  for (const r of rows) {
    for (const name of r.horses.split("\t").filter(Boolean)) {
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function sireCounts(db: DatabaseSync): Array<{ name: string; count: number }> {
  const rows = db.prepare(`SELECT sires FROM articles WHERE sires != ''`).all() as { sires: string }[];
  const tally = new Map<string, number>();
  for (const r of rows) {
    for (const name of r.sires.split("\t").filter(Boolean)) {
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
