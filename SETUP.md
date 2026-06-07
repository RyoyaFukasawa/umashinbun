# セットアップ手順

## 1. 前提

- Node.js **22.5以上**（`node:sqlite` と `--experimental-strip-types` を使うため）。
- 外部パッケージは不要。`npm install` も不要（依存ゼロ設計）。

## 2. ローカルで動作確認

```bash
# 1. フィード取得（新規候補を raw-items.json へ）
npm run fetch

# 2. （通常はRoutines上のClaudeが担当）翻訳・要約して digest-input.json を作る
#    手動で試すなら digest-input.json を手書きしてもよい（形式は ROUTINES_PROMPT.md 参照）

# 3. articles.json に取り込み（重複排除あり、races.json も自動更新）
npm run ingest

# 4. 全Markdown再生成（races/ horses/ sires/ views/news.md + README.md）
npm run build
```

個別に走らせたい場合:
```bash
npm run build-races          # races/YYYY/MM/<id>.md
npm run build-horses-sires   # horses/<name>.md, sires/<name>.md（プロフィール付き）
npm run build-entities       # trainers/, jockeys/, breeders/, owners/, dams/
npm run build-md             # views/news.md, views/unfiled.md, README.md
```

## 馬の事典データ (`horses-profile.json`)

各馬の「ストック情報」(生年・血統・主要勝利・特徴など)を `horses-profile.json` に持つ。
RSS で日々入ってくる「フロー情報」とは独立に管理。

形式:
```json
{
  "メイショウタバル": {
    "born": "2021-04-20",
    "sex": "牡",
    "sire": "ゴールドシップ",
    "dam": "メイショウツバクロ",
    "damsire": "フレンチデピュティ",
    "breeder": "三嶋牧場",
    "owner": "松本好隆",
    "trainer": "石橋守",
    "main_jockeys": ["武豊"],
    "record": "14戦5勝（中央13戦5勝、海外1戦0勝）",
    "major_wins": [
      { "grade": "G1", "name": "宝塚記念", "year": "2025" }
    ],
    "strengths": ["逃げ脚質", "父ゴールドシップは宝塚記念連覇"],
    "story": "父子で宝塚記念を制覇した珍しい血脈。",
    "source_url": "https://ja.wikipedia.org/wiki/..."
  }
}
```

`build-horses-sires` がこれを読んで馬ページ上部にプロフィール表を差し込み、
父・母・母父・生産者・馬主・調教師・主戦騎手は各 sires/dams/breeders/owners/trainers/jockeys
の専用ページにリンクされる。`build-entities` がそのリンク先のページを生成する。

## 3. 検索

```bash
npm run query -- --date 2026-05-30
npm run query -- --category g1
npm run query -- --month 2026-05 --category overseas
npm run query -- --keyword イクイノックス
npm run query -- --race 2026-takarazuka-kinen
npm run query -- --horse ドウデュース
npm run query -- --sire ハーツクライ
```

SQLiteを直接叩くなら:
```bash
sqlite3 digest.db "SELECT date,title_ja FROM articles WHERE race_id='2026-takarazuka-kinen' ORDER BY date DESC;"
```

## 4. レース一覧の管理

`races.json` がレースの一覧。手動で初期登録した JRA G1 + 主要海外G1 と、
記事から動的に追加された未登録レース（origin: "article"）が同居する。

新しい重賞を手動で追加したい場合（来年の日程発表時など）:
```json
{
  "id": "2027-takarazuka-kinen",
  "name": "宝塚記念",
  "grade": "G1",
  "date": "2027-06-27",
  "course": "阪神",
  "distance": "芝2200m",
  "planned_horses": [],
  "origin": "manual"
}
```

## 5. Routines への登録

`ROUTINES_PROMPT.md` の本文を Claude Code の Routines にタスクとして登録し、
スケジュールを毎朝（例: cron `0 22 * * *` = 7:00 JST）に設定する。
GitHub push まで含めて全自動で完結する。

最初の数日は出力（特に race_id / horses / sires の抽出率）を確認し、
要約プロンプトやソースを `src/feeds.ts` で微調整するとよい。

## 6. ソースの増減

`src/feeds.ts` の `FEEDS` 配列を編集するだけ。
`MAX_PER_CATEGORY` で1カテゴリの最大件数を変えられる。
カテゴリ自体を増減する場合は `Category` 型 / `CATEGORY_LABELS` / `CATEGORY_ORDER` も合わせて更新する
（`ingest.ts` の `VALID_CATEGORIES` は `CATEGORY_ORDER` を流用しているので自動追従）。
