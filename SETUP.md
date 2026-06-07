# セットアップ手順

## 1. 前提

- Node.js **22.5以上**（`node:sqlite` と `--experimental-strip-types` を使うため）。
- 外部パッケージは不要。`npm install` も基本不要（依存ゼロ設計）。

## 2. ローカルで動作確認

```bash
# 1. フィード取得（新規候補を raw-items.json へ）
npm run fetch

# 2. （通常はRoutines上のClaudeが担当）翻訳・要約して digest-input.json を作る
#    手動で試すなら digest-input.json を手書きしてもよい

# 3. DBへ投入（重複排除あり）
npm run ingest

# 4. Markdown再生成
npm run build-md
```

## 3. 検索

```bash
npm run query -- --date 2026-05-30
npm run query -- --category g1
npm run query -- --month 2026-05 --category horse
npm run query -- --keyword イクイノックス
```

SQLiteを直接叩くなら:
```bash
sqlite3 digest.db "SELECT date,title_ja FROM articles WHERE category='g1' ORDER BY date DESC LIMIT 10;"
```

## 4. Routines への登録

`ROUTINES_PROMPT.md` の本文を Claude Code の Routines にタスクとして登録し、
スケジュールを毎朝（例: cron `0 22 * * *` = 7:00 JST）に設定する。
GitHub push まで含めて全自動で完結する。

最初の2〜3日は出力を確認し、要約の粒度やソースを `src/feeds.ts` で微調整するとよい。
RSS URL は実在を仮定しているものがあるので、初回 `npm run fetch` で死んでいるソースを
洗い出し、必要に応じて週次改善ルーチン（IMPROVE_PROMPT.md）に任せるか、手動で差し替える。

## 5. ソースの増減

`src/feeds.ts` の `FEEDS` 配列を編集するだけ。
`MAX_PER_CATEGORY` で1カテゴリの最大件数を変えられる。
カテゴリ自体を増減する場合は `Category` 型 / `CATEGORY_LABELS` / `CATEGORY_ORDER` も合わせて更新する
（`ingest.ts` の `VALID_CATEGORIES` は `CATEGORY_ORDER` を流用しているので自動追従）。
