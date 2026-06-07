# umashinbun 馬新聞

毎朝、週末の競馬を読み解くための自動ダイジェスト。
週末の重賞・特別レースの予想と展望、その週末に走る注目馬・厩舎・調教、
POG・血統、海外競馬、競馬界のニュースを日本語に翻訳・要約して毎日蓄積する。

単なる結果速報ではなく、**この週末のレースをどう読むか・どの馬の見え方がどう変わるか**を
読者が立体的に掴めるよう、予想含意・注目馬・適性・血統の視点で読み解くことを重視する。

姉妹リポジトリに [kawaraban](https://github.com/) （投資家向けの世界ニュース・ダイジェスト）。
本リポはその「馬版」として、構成・運用ルーチンを流用している。

- **正本**: `articles.json`（テキスト）。重複排除もここ。git で差分が読める。
- **検索**: `digest.db`（SQLite）。`articles.json` から生成する派生物（git管理外）。
- **日付で読む**: `digests/YYYY/MM/YYYY-MM-DD.md`
- **カテゴリで読む**: `views/g1.md` / `views/horse.md` / `views/pog.md` / `views/overseas.md` / `views/news.md`

## 仕組み

1. **毎朝 6:50 JST** — GitHub Actions が RSS を取得し `raw-items.json` を生成（[.github/workflows/fetch-feeds.yml](.github/workflows/fetch-feeds.yml)）。
2. **毎朝 7:00 JST** — Claude routine が記事を選定し、選んだ記事の本文を取得して競馬ファンの視点で翻訳・要約し、SQLite と Markdown に蓄積（[ROUTINES_PROMPT.md](ROUTINES_PROMPT.md)）。
3. **毎週月曜** — 別の Claude routine が直近7日の運用ログ（`ops-log/`）を全件読み、(A)複数レンズのagentでブレスト→(B)推進派⇄懐疑派の対立議論＋ジャッジ裁定で改善を練る。結論に基づくフィード改善を PR で提案する（[IMPROVE_PROMPT.md](IMPROVE_PROMPT.md)）。

## 情報源

国内大手スポーツ紙・公式機関・海外専門紙を横断している（[src/feeds.ts](src/feeds.ts)）。

- **🏆 週末重賞・G1展望**: netkeiba ニュース＆コラム・東スポ競馬・競馬ラボ（後2者はYahoo!ニュース経由）
- **🐎 注目馬・調教・厩舎**: SPAIA競馬・馬トク報知（いずれもYahoo!ニュース経由）
- **🌱 POG・2歳・血統**: 競馬のおはなし（Yahoo!ニュース経由）
- **🌍 海外競馬**: BloodHorse（All News / Thoroughbred Racing / Thoroughbred Breeding）・Thoroughbred Daily News
- **📰 競馬界ニュース**: *(暫定空。週次改善ルーチンで追加予定)*

※ 各 RSS URL はサイト改編で死ぬことがあるため、週次改善ルーチンが運用ログから死活を判定し、
差し替え PR を出す設計。**初期登録分は 2026-06-07 に curl で生存確認済み（HTTP 200 かつ `<item>` を含むこと）。**
JRA公式 RSS は 2026-03-31 で配信終了。ラジオNIKKEI・サンスポZBAT!・スポニチ・デイリースポーツは
公開RSSが見つからなかったため不採用（Yahoo!ニュース経由で東スポ・スポーツ報知・競馬ラボ・SPAIA等を拾う構成）。
記事に無い情報（馬名・着順・走破時計・調教時計・斤量・人気/オッズ）は創作しない方針。
買い目の断定的な推奨はしない。あくまで「強気/弱気材料の整理」にとどめる。

## 検索

CLI で手軽に（内部で `articles.json` から `digest.db` を生成して検索）:

```sh
npm run query -- --category g1 --month 2026-05
npm run query -- --keyword イクイノックス
```

SQL を直接叩きたい場合（`npm run ingest` 等で生成された `digest.db` に対して）:

```sql
-- 2026年5月の週末重賞記事だけ
SELECT date, title_ja, source FROM articles
WHERE category='g1' AND date LIKE '2026-05%'
ORDER BY date DESC;
```

## セットアップ

[SETUP.md](SETUP.md) を参照。
