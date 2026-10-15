// 全フィードを取得し、未取得(新規)の候補記事を raw-items.json に書き出す。
// 翻訳・要約は行わない（それはRoutines上のClaudeが担当）。
// 失敗したフィードはスキップして他を続行する。

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FEEDS } from "../src/feeds.ts";
import { parseFeed, type FeedItem } from "../src/rss.ts";
import { existingUrls } from "../src/db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "raw-items.json");

// 鮮度フィルタ: pubDate がこの時間より古い記事は候補から除外する。
// 毎朝1回の実行で「前日分＋余裕」をカバーしつつ、前々日以前の古いニュースや、
// RSSが返してくる大昔の記事（例: WSJが1年前の記事を混ぜてくる）を弾くため。
// これにより「昨日と同じ事件の別記事」が翌日また選ばれて重複するのを根本から防ぐ。
const FRESHNESS_HOURS = 36;

/**
 * pubDate が新鮮（FRESHNESS_HOURS 以内）かを判定する。
 * - pubDate が無い／パースできない場合は true（安全側：捨てない）。
 *   日付不明という理由で良い記事を落とすより、通して routine の選定に委ねる。
 */
function isFresh(pubDate: string | undefined, nowMs: number): boolean {
  if (!pubDate) return true;
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return true; // パース不能は通す
  const ageHours = (nowMs - t) / 3_600_000;
  return ageHours <= FRESHNESS_HOURS;
}

export interface RawCandidate {
  source: string;
  category: string;
  paywalled: boolean;
  /** 信憑性が裏取りされていない一次情報（Reddit等）。ダイジェストで⚠️付き報告の対象。 */
  unverified: boolean;
  title_en: string;
  url: string;
  description: string;
  pubDate?: string;
}

async function fetchFeed(url: string, timeoutMs = 15000): Promise<FeedItem[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 一部サイトはUA無しを弾くため明示
        "User-Agent": "news-digest-bot/1.0 (+https://github.com/)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml);
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  // 既出URL（正本 articles.json から直接引く）で取得段階の重複をスキップ
  const seen = existingUrls();
  const nowMs = Date.now();

  const candidates: RawCandidate[] = [];
  const perCategoryUrls = new Set<string>(); // 同一実行内の重複も排除
  let staleTotal = 0; // 鮮度フィルタで除外した総数

  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed.url);
      let kept = 0;
      let stale = 0;
      for (const item of items) {
        const url = item.link.trim();
        if (!url) continue;
        if (seen.has(url) || perCategoryUrls.has(url)) continue; // 重複排除
        if (!isFresh(item.pubDate, nowMs)) {
          stale++; // 古い記事は除外（前日以前の事件の再掲を防ぐ）
          continue;
        }
        perCategoryUrls.add(url);
        // 取得時の機械的 news 分類（ROUTINES_PROMPT の選定時文脈判断と役割が異なる）。
        // 訃報・処分・JRA抹消など業界 news 性の高いキーワードにマッチした場合のみ上書き。
        const NEWS_KEYWORDS = [
          "訃報", "死去", "死亡", "永眠",
          "騎乗停止", "制裁", "懲戒",
          "転厩", "転籍", "JRA抹消", "登録抹消", "廃業", "廃止",
        ];
        const isNewsTitle =
          NEWS_KEYWORDS.some((k) => item.title.includes(k)) ||
          /\d{3,4}勝/.test(item.title);
        const category = isNewsTitle ? "news" : feed.category;
        candidates.push({
          source: feed.name,
          category,
          paywalled: !!feed.paywalled,
          unverified: !!feed.unverified,
          title_en: item.title,
          url,
          description: item.description,
          pubDate: item.pubDate,
        });
        kept++;
      }
      staleTotal += stale;
      const staleNote = stale > 0 ? ` / 古い${stale}件除外` : "";
      console.log(`OK   ${feed.name}: ${items.length}件取得 / 新規${kept}件${staleNote}`);
    } catch (err) {
      // 1本死んでも全体は止めない
      console.warn(`SKIP ${feed.name}: 取得失敗 (${(err as Error).message})`);
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(candidates, null, 2), "utf-8");
  console.log(
    `\n候補 ${candidates.length}件を ${OUT_PATH} に書き出しました` +
      `（鮮度フィルタ${FRESHNESS_HOURS}hで ${staleTotal}件を除外）。`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
