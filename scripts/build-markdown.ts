// articles.json を正本として、レース軸ビューでは拾いきれない記事の置き場と
// ルート README を生成する。
//
// 生成物:
//   - views/news.md             ... category=news の全アーカイブ（業界ニュースの置き場）
//   - views/unfiled.md          ... race_id が無い記事の置き場（カテゴリ不問。ロストフィルタ用）
//   - README.md                 ... 索引（races/horses/sires/views へのリンク + 最新記事5件）
//
// 旧 digests/YYYY-MM-DD.md（日付別ダイジェスト）は廃止。
// 「いつ何があったか」を時系列で振り返りたい場合は ops-log/ または `npm run query` を使う。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb, articlesByCategory, allRaces, raceFilePath,
  type ArticleRow,
} from "../src/db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function isUnverifiedSource(source: string): boolean {
  return /reddit/i.test(source);
}

function renderArticle(a: ArticleRow): string {
  const summary = a.summary.replace(/\\n/g, "\n");
  const unverified = isUnverifiedSource(a.source);
  const titleHasWarning = a.title_ja.trimStart().startsWith("⚠️");
  const heading =
    unverified && !titleHasWarning
      ? `### ⚠️ [${a.title_ja}](${a.url})`
      : `### [${a.title_ja}](${a.url})`;
  const lines = [
    heading,
    `*${a.title_en}*`,
    `出典: ${a.source} ・ ${a.date} ・ #${a.category}`,
    ``,
    summary,
    ``,
  ];
  if (unverified && !/未確認情報/.test(summary)) {
    lines.splice(-1, 0,
      `> ⚠️ **未確認情報**（${a.source}発・要裏取り）。`);
  }
  return lines.join("\n");
}

function renderCategoryView(title: string, rows: ArticleRow[]): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`全 ${rows.length} 件 / 日付の新しい順`);
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

function renderReadme(db: ReturnType<typeof openDb>): string {
  const races = allRaces(db);
  // 直近の未来 (今日以降) のレース 8件 + 過去レース 3件
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = races
    .filter((r) => r.date && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
  const past = races
    .filter((r) => r.date && r.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  // 最新記事5件
  const recent = db
    .prepare(`SELECT * FROM articles ORDER BY date DESC, id DESC LIMIT 5`)
    .all() as ArticleRow[];

  const lines: string[] = [];
  lines.push("# umashinbun 馬新聞");
  lines.push("");
  lines.push("**レース中心の競馬ダイジェスト。** 「次の宝塚記念に向けてドウデュースはどんな状態？」 — それを1ページで読めるように、");
  lines.push("毎朝、競馬ニュースを翻訳・要約してレースごと・馬ごと・種牡馬ごとに集約する。");
  lines.push("");
  lines.push("## 入口");
  lines.push("");
  lines.push("- 🏆 **レース別**: [races/](races/README.md) — 各レースの展望と出走予定馬の関連記事が1ページに集約");
  lines.push("- 🐎 **馬別**: [horses/](horses/README.md) — 各馬の事典(プロフィール+血統+主要勝利)と関連記事");
  lines.push("- 🌱 **種牡馬別**: [sires/](sires/README.md) — 産駒の話題が集まる種牡馬ページ");
  lines.push("- 🎓 **調教師別**: [trainers/](trainers/README.md) — 厩舎ごとの管理馬と関連記事");
  lines.push("- 🏇 **騎手別**: [jockeys/](jockeys/README.md) — 騎手ごとの騎乗馬と関連記事");
  lines.push("- 🏡 **生産者別**: [breeders/](breeders/README.md) — 牧場ごとの生産馬");
  lines.push("- 👤 **馬主別**: [owners/](owners/README.md) — 馬主ごとの所有馬");
  lines.push("- 🐴 **繁殖牝馬別**: [dams/](dams/README.md) — 母系のページ");
  lines.push("- 📰 **業界ニュース**: [views/news.md](views/news.md) — レースに紐づかない業界ニュースのアーカイブ");
  lines.push("");
  lines.push("## 直近のレース");
  lines.push("");
  for (const r of upcoming) {
    const { dir, file } = raceFilePath(r);
    lines.push(`- **${r.date}** [${r.name} (${r.grade})](${dir}/${file}) ${r.course} ${r.distance}`);
  }
  if (upcoming.length === 0) lines.push("*予定されている未来のレースがありません。*");
  if (past.length > 0) {
    lines.push("");
    lines.push("### 終了したレース（直近）");
    for (const r of past) {
      const { dir, file } = raceFilePath(r);
      lines.push(`- **${r.date}** [${r.name} (${r.grade})](${dir}/${file})`);
    }
  }
  lines.push("");
  lines.push("## 最新の記事5件");
  lines.push("");
  for (const a of recent) {
    lines.push(`- **${a.date}** [${a.title_ja}](${a.url}) *(${a.source})*`);
  }
  lines.push("");
  lines.push("## 仕組み");
  lines.push("");
  lines.push("1. **毎朝 4:00 JST** — GitHub Actions が RSS を取得し `raw-items.json` を生成（[.github/workflows/fetch-feeds.yml](.github/workflows/fetch-feeds.yml)）。");
  lines.push("2. **毎朝 7:00 JST** — Claude routine が `npm run today-mode` で日付に応じた仕事内容を判定して、4つのモードを切り替える（[ROUTINES_PROMPT.md](ROUTINES_PROMPT.md)）:");
  lines.push("   - 🗓 **月末モード**: 翌月の重賞メタ情報と出走予定馬の事典化を先に整える");
  lines.push("   - 🏆 **重賞週モード** (重賞7日以内): 対象レース・出走予定馬に絞って厚く要約");
  lines.push("   - 📅 **改善モード** (月曜): ops-log/ 集計とプロンプト/フィードの改善PR");
  lines.push("   - 💤 **軽量モード** (それ以外): POG・業界ニュース・血統だけ少量拾う");
  lines.push("3. ビルドスクリプトが `articles.json` + `races.json` + `horses-profile.json` から `races/` `horses/` `sires/` `trainers/` `jockeys/` `breeders/` `owners/` `dams/` `views/` を再生成する。");
  lines.push("4. **毎週月曜** — 直近7日の運用ログを読み、フィードや要約プロンプトの改善を PR で提案する（[IMPROVE_PROMPT.md](IMPROVE_PROMPT.md)）。");
  lines.push("");
  lines.push("## 情報源");
  lines.push("");
  lines.push("国内大手スポーツ紙・公式機関・海外専門紙を横断している（[src/feeds.ts](src/feeds.ts)）。");
  lines.push("");
  lines.push("- **週末重賞・G1展望**: netkeiba ニュース＆コラム・東スポ競馬・競馬ラボ（後2者はYahoo!ニュース経由）");
  lines.push("- **注目馬・調教・厩舎**: SPAIA競馬・馬トク報知（いずれもYahoo!ニュース経由）");
  lines.push("- **POG・2歳・血統**: 競馬のおはなし（Yahoo!ニュース経由）");
  lines.push("- **海外競馬**: BloodHorse（All News / Thoroughbred Racing / Thoroughbred Breeding）・Thoroughbred Daily News");
  lines.push("");
  lines.push("※ 記事に無い情報（馬名・着順・走破時計・調教時計・斤量・人気/オッズ）は創作しない方針。");
  lines.push("買い目の断定的な推奨はしない。あくまで「強気/弱気材料の整理」にとどめる。");
  lines.push("");
  lines.push("## 検索");
  lines.push("");
  lines.push("```sh");
  lines.push("npm run query -- --category g1 --month 2026-05");
  lines.push("npm run query -- --keyword イクイノックス");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const db = openDb();

  mkdirSync(join(ROOT, "views"), { recursive: true });

  // news カテゴリの全アーカイブ
  const newsRows = articlesByCategory(db, "news");
  writeFileSync(join(ROOT, "views", "news.md"), renderCategoryView("📰 競馬界ニュース — 全アーカイブ", newsRows), "utf-8");

  // race_id を持たない記事の置き場（カテゴリ問わず・拾いこぼし可視化）
  const unfiledRows = db
    .prepare(`SELECT * FROM articles WHERE race_id IS NULL ORDER BY date DESC, id DESC`)
    .all() as ArticleRow[];
  writeFileSync(join(ROOT, "views", "unfiled.md"), renderCategoryView("📂 レース未紐付け記事", unfiledRows), "utf-8");

  // ルート README
  writeFileSync(join(ROOT, "README.md"), renderReadme(db), "utf-8");

  db.close();
  console.log(`Markdown生成完了: views/news.md (${newsRows.length}件) / views/unfiled.md (${unfiledRows.length}件) / README.md`);
}

main();
