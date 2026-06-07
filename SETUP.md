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

# 4. 全Markdown再生成（races/ horses/ sires/ trainers/ jockeys/ breeders/ owners/ dams/ views/）
npm run build
```

個別に走らせたい場合:

```bash
npm run build-races          # races/YYYY/MM/YYYY-MM-DD-レース名.md
npm run build-horses-sires   # horses/<name>.md, sires/<name>.md（プロフィール付き）
npm run build-entities       # trainers/, jockeys/, breeders/, owners/, dams/
npm run build-md             # views/news.md, views/unfiled.md, README.md
```

routine 補助スクリプト:

```bash
npm run today-mode                 # 今日のモード判定
npm run fetch-results              # 直近30日の終了レースで未取得のもの一覧
npm run fetch-results -- --all     # 終了レース全部
npm run fetch-runners              # 出走予定馬スクレイパー(精度不足・実運用は手動)
```

## 3. 馬の事典データ (`horses-profile.json`)

各馬の「ストック情報」(生年・血統・主要勝利・特徴など)を `horses-profile.json` に持つ。
RSS で日々入ってくる「フロー情報」とは独立に管理。

形式（最新スキーマ）:

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
    "major_results": [
      { "place": 2, "year": "2026", "name": "大阪杯", "grade": "G1",
        "course": "阪神", "distance": "芝2000m" },
      { "place": 1, "year": "2025", "name": "宝塚記念", "grade": "G1",
        "course": "阪神", "distance": "芝2200m" },
      { "place": 1, "year": "2024", "name": "神戸新聞杯", "grade": "G2",
        "course": "中京", "distance": "芝2200m" }
    ],
    "strengths": ["逃げ脚質", "父ゴールドシップは宝塚記念連覇"],
    "story": "父子で宝塚記念を制覇した珍しい血脈。",
    "source_url": "https://ja.wikipedia.org/wiki/..."
  }
}
```

- `place` は 1/2/3 のみ（4着以下は major にしない方針）
- 1着が🥇 / 2着が🥈 / 3着が🥉として表示される
- `race_id` をオプションで指定するとそのレースページへのリンクが張られる

`build-horses-sires` がこれを読んで馬ページ上部にプロフィール表を差し込み、
父・母・母父・生産者・馬主・調教師・主戦騎手は各 sires/dams/breeders/owners/trainers/jockeys
の専用ページにリンクされる。`build-entities` がそのリンク先のページを生成する。

## 4. レース一覧の管理 (`races.json`)

`races.json` がレースの一覧。 JRA G1 24本がベタ書きされている。
記事から新しい race_id が見つかった場合は ingest が動的追加する（origin: "article"）。

レース1件の形式:

```json
{
  "id": "2026-takarazuka-kinen",
  "name": "宝塚記念",
  "grade": "G1",
  "date": "2026-06-14",
  "course": "阪神",
  "distance": "芝2200m",
  "planned_horses": ["クロワデュノール", "メイショウタバル", "..."],
  "origin": "manual",
  "results": [
    { "place": 1, "horse": "シックスペンス", "jockey": "武豊", "time": "1:32.1", "popularity": 8 },
    { "place": 2, "horse": "ワールズエンド", "jockey": "津村明秀", "time": "1:32.1", "popularity": 7 }
  ]
}
```

- `planned_horses`: 出走予定馬。レース1週間前から日々更新（race_week モードで毎朝WebFetch）
- `results`: 1〜5着の確定結果。レース終了後に取得（race_week モードで翌朝WebFetch）
- 2着同着・3着同着は同じ `place` 値で複数エントリ

## 5. 検索

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

## 6. GitHub Actions の有効化

リポジトリ: <https://github.com/RyoyaFukasawa/umashinbun>

`.github/workflows/fetch-feeds.yml` が **毎朝 4:00 JST に RSS 取得 → raw-items.json を main にコミット** する。

### 確認手順

1. **Actions タブを開く**: <https://github.com/RyoyaFukasawa/umashinbun/actions>
2. **`fetch-feeds` ワークフロー**が表示されているか確認
3. 表示されない場合は Settings > Actions > General で "Allow all actions" を選択
4. **手動実行**: `fetch-feeds` の "Run workflow" ボタンで一度動作確認
5. 数分後、main ブランチに `chore(fetch): update raw-items.json (YYYY-MM-DD)` のコミットが入っていれば成功

### スケジュール

cron: `0 19 * * *` = 19:00 UTC = 04:00 JST。
GitHub Actions の schedule は高負荷時間帯に遅延する仕様で、実測50分〜1時間半ずれることがある。
Routines の 7:00 JST までに完了するよう2時間のマージンを確保している。

## 7. Claude Code Routines への登録

Claude Code の Routines に **2 本**登録する: 日次ダイジェスト用と週次改善用。
プロンプト本文はリポジトリ内 (`ROUTINES_PROMPT.md` / `IMPROVE_PROMPT.md`) に置き、
routine 側はそれを "Read して従え" の短い指示だけ。プロンプト更新は git push するだけで反映される。

### routine 1: `umashinbun-daily-digest` (毎朝 7:00 JST)

- **Prompt**: `ROUTINES_PROMPT.md` を Read して、その「タスクプロンプト本文」セクションの手順に従って作業する旨を書く
  (実物は [SETUP.md レシピ](#daily-routine-prompt-text) または kawaraban-daily-digest を参考)
- **Repositories**: `RyoyaFukasawa/umashinbun`
- **Environment**: Default (Trusted)
- **Trigger**: Schedule、毎日 7:00 JST (cron `0 22 * * *`)
- **Permissions**: "Allow unrestricted branch pushes" を有効化 (main に直接 push する設計)
- **Allowed tools**: Bash / Read / Write / Edit / Glob / Grep / WebFetch / WebSearch

### routine 2: `umashinbun-weekly-improve` (月曜 8:00 JST)

- **Prompt**: `IMPROVE_PROMPT.md` を Read して従う旨を書く (kawaraban-weekly-improve と同じ構造)
- **Repositories**: `RyoyaFukasawa/umashinbun`
- **Environment**: Default (Trusted)
- **Trigger**: Schedule、月曜 8:00 JST (cron `0 23 * * 0`)
- **Permissions**: main 直 push **しない**(改善は PR で出す設計)。 ops-log/ のみ main 直コミット可
- **Allowed tools**: 上記 + **Agent + Task** (複数サブエージェントを立ててブレスト+対立議論を回すため)

### 2本の役割分担

- daily routine の `weekly_review` モード(月曜)は IMPROVE_PROMPT を実行 **しない**。
  日次ダイジェスト routine が二重に改善を回すのを避けるため、 weekly_review モードの実体は light モードと同じ軽量ダイジェスト。
- 週次の本格改善 (ops-log 集計・ブレスト・対立議論・改善PR) は weekly-improve routine だけが担当する。

### モードと対応する仕事

routine 開始時に `npm run today-mode` を実行し、日付に応じた4モードを切り替える:

| モード | 発火条件 | 仕事 |
|---|---|---|
| 🗓 `monthly_prep` | 月末3日以内 + 翌月に重賞 | 翌月の事典化と出走予定馬整備 |
| 🏆 `race_week` | 直近7日以内に重賞 | 対象レース・対象馬に絞った重点要約 + 結果取得 |
| 📅 `weekly_review` | 月曜 + 上記いずれでもない | ops-log 集計と改善PR + 軽量モード |
| 💤 `light` | それ以外 | POG・業界ニュースだけ軽量に |

詳細は [ROUTINES_PROMPT.md](ROUTINES_PROMPT.md) を参照。
週次改善ループは [IMPROVE_PROMPT.md](IMPROVE_PROMPT.md) を参照（routine 内から呼ばれる）。

### 動作確認

最初の数週間は以下を確認:

1. **日次の routine ログ**: ops-log/YYYY-MM-DD.md にモード判定結果と抽出率が記録される
2. **race_week モードの精度**: 対象レース・対象馬の抽出が機能しているか
3. **monthly_prep モードの事典化**: horses-profile.json に未登録の馬が自動追加されているか
4. **B-0-2 結果取得**: レース終了翌朝に races.json の results が埋まり、馬ページの主要勝利・好走にリンクが張られるか

問題があれば `ROUTINES_PROMPT.md` を編集して PR、または `src/feeds.ts` のソース調整で対応。

## 8. ソースの増減

`src/feeds.ts` の `FEEDS` 配列を編集するだけ。
`MAX_PER_CATEGORY` で1カテゴリの最大件数を変えられる。
カテゴリ自体を増減する場合は `Category` 型 / `CATEGORY_LABELS` / `CATEGORY_ORDER` も合わせて更新する
（`ingest.ts` の `VALID_CATEGORIES` は `CATEGORY_ORDER` を流用しているので自動追従）。
