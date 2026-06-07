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

export interface ArticleRow {
  id: number;
  date: string; // YYYY-MM-DD
  category: string; // technology | politics | economy
  source: string; // WSJ Technology など
  title_ja: string;
  title_en: string;
  url: string;
  summary: string;
  created_at: string;
}

export type NewArticle = Omit<ArticleRow, "id" | "created_at">;

/** 正本 articles.json に保存する1レコード（id は持たず、url が一意キー） */
export interface StoredArticle extends NewArticle {
  created_at: string;
}

// ---- 正本(articles.json)の読み書き --------------------------------------

/** articles.json を読む（無ければ空配列） */
export function readArticles(path: string = ARTICLES_JSON): StoredArticle[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("articles.json は配列である必要があります");
  return raw as StoredArticle[];
}

/**
 * articles.json を書く。安定した git 差分のため date→category→url で決定的にソートする。
 * （順序が毎回変わると、中身が同じでも差分ノイズが出るため）
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
 * articles.json から SQLite を構築して返す。
 * path 省略時はインメモリDB（読み取り専用の検索に最適・ファイルを汚さない）。
 * path 指定時はそのファイルに書き出す（GUIで開く・配布する用）。
 */
export function openDb(path: string = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    DROP TABLE IF EXISTS articles;
    CREATE TABLE articles (
      id          INTEGER PRIMARY KEY,
      date        TEXT    NOT NULL,
      category    TEXT    NOT NULL,
      source      TEXT    NOT NULL,
      title_ja    TEXT    NOT NULL,
      title_en    TEXT    NOT NULL,
      url         TEXT    NOT NULL UNIQUE,
      summary     TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_articles_date     ON articles(date);
    CREATE INDEX idx_articles_category ON articles(category);
  `);
  const rows = readArticles();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO articles (date, category, source, title_ja, title_en, url, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // 取り込み順を決定的に（date→category→url）
  const sorted = [...rows].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.category.localeCompare(b.category) ||
      a.url.localeCompare(b.url),
  );
  for (const a of sorted) {
    stmt.run(a.date, a.category, a.source, a.title_ja, a.title_en, a.url, a.summary, a.created_at);
  }
  return db;
}

/** 既に取り込み済みのURL集合を返す（取得段階での重複スキップに使う） */
export function existingUrls(_db?: DatabaseSync): Set<string> {
  // 正本(articles.json)から直接引く。引数 db は後方互換のため受け取るが未使用。
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

export function allDates(db: DatabaseSync): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT date FROM articles ORDER BY date DESC`)
    .all() as { date: string }[];
  return rows.map((r) => r.date);
}
