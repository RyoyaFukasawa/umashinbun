> 🏆 次のG1: **スプリンターズステークス** (G1) — 2026-09-27 (日) ・ 中山 ・ 芝1200m ・ あと 95 日

# umashinbun 馬新聞

**レース中心の競馬ダイジェスト。** 「次の宝塚記念に向けてメイショウタバルはどんな状態？」 — それを1ページで読めるように、
毎朝、競馬ニュースを翻訳・要約してレースごと・馬ごと・種牡馬ごとに集約する。

姉妹リポ: [kawaraban](https://github.com/RyoyaFukasawa/kawaraban) (投資家向けの世界ニュースダイジェスト)。本リポはその「馬版」として構成・運用ルーチンを流用している。

## 入口

- 🏆 **レース別**: [races/](races/README.md) — 各レースの展望と出走予定馬の関連記事が1ページに集約
- 🐎 **馬別**: [horses/](horses/README.md) — 各馬の事典(プロフィール+血統+主要勝利)と関連記事
- 🌱 **種牡馬別**: [sires/](sires/README.md) — 産駒の話題が集まる種牡馬ページ
- 🎓 **調教師別**: [trainers/](trainers/README.md) — 厩舎ごとの管理馬と関連記事
- 🏇 **騎手別**: [jockeys/](jockeys/README.md) — 騎手ごとの騎乗馬と関連記事
- 🏡 **生産者別**: [breeders/](breeders/README.md) — 牧場ごとの生産馬
- 👤 **馬主別**: [owners/](owners/README.md) — 馬主ごとの所有馬
- 🐴 **繁殖牝馬別**: [dams/](dams/README.md) — 母系のページ
- 📰 **業界ニュース**: [views/news.md](views/news.md) — レースに紐づかない業界ニュースのアーカイブ

## 直近のレース

- **2026-09-27** [スプリンターズステークス (G1)](races/2026/09/2026-09-27-スプリンターズステークス.md) 中山 芝1200m
- **2026-10-18** [秋華賞 (G1)](races/2026/10/2026-10-18-秋華賞.md) 京都 芝2000m
- **2026-10-25** [菊花賞 (G1)](races/2026/10/2026-10-25-菊花賞.md) 京都 芝3000m
- **2026-11-01** [天皇賞・秋 (G1)](races/2026/11/2026-11-01-天皇賞・秋.md) 東京 芝2000m
- **2026-11-15** [エリザベス女王杯 (G1)](races/2026/11/2026-11-15-エリザベス女王杯.md) 京都 芝2200m
- **2026-11-22** [マイルチャンピオンシップ (G1)](races/2026/11/2026-11-22-マイルチャンピオンシップ.md) 京都 芝1600m
- **2026-11-29** [ジャパンカップ (G1)](races/2026/11/2026-11-29-ジャパンカップ.md) 東京 芝2400m
- **2026-12-06** [チャンピオンズカップ (G1)](races/2026/12/2026-12-06-チャンピオンズカップ.md) 中京 ダ1800m

### 終了したレース（直近）
- **2026-06-14** [宝塚記念 (G1)](races/2026/06/2026-06-14-宝塚記念.md)
- **2026-06-07** [安田記念 (G1)](races/2026/06/2026-06-07-安田記念.md)
- **2026-05-31** [日本ダービー (東京優駿) (G1)](races/2026/05/2026-05-31-日本ダービー_(東京優駿).md)

## 最新の記事5件

- **2026-06-24** [武豊とコンビを組む新馬が続々決定！億超え高額馬に新種牡馬産駒の良血、好時計を叩き出した〝大物候補〟も](https://news.yahoo.co.jp/articles/9b46db33a0e9bcbc2c7c95f31ba4eea41516a49f?source=rss) *(東スポ競馬)*
- **2026-06-24** [スカンジナビアのゴールドC制覇が示すジャスティファイ産駒の急成長](https://www.bloodhorse.com/horse-racing/articles/292693/scandinavia-highlights-hot-streak-for-justify-runners) *(BloodHorse All News)*
- **2026-06-24** [ゴドルフィンとクールモアの叩き合い！ロイヤルアスコット開催の〝個人的〟ハイライト](https://news.yahoo.co.jp/articles/fa70d155fb0d969f1e08d065b78aa3758ddd3699?source=rss) *(東スポ競馬)*
- **2026-06-24** [【障害名手・西谷誠、四位厩舎で第二章へ】「天才的。言い換えれば、ぶっ飛んでる」四位洋文師が語る、唯一無二の技術と受け継がれる馬乗りの魂](https://news.netkeiba.com/?pid=column_view&cid=59104) *(netkeiba コラム)*
- **2026-06-24** [【さきたま杯】ロードフォンスがJpnI初制覇 横山和生「この馬と一緒に勝てたのが本当にうれしい」](https://news.yahoo.co.jp/articles/22b757b7209b18138ed0c6f275d0110ca13b3f87?source=rss) *(東スポ競馬)*

## 仕組み

1. **毎朝 4:00 JST** — GitHub Actions が RSS を取得し `raw-items.json` を生成（[.github/workflows/fetch-feeds.yml](.github/workflows/fetch-feeds.yml)）。
2. **毎朝 7:00 JST** — Claude routine が `npm run today-mode` で日付に応じた仕事内容を判定して、4つのモードを切り替える（[ROUTINES_PROMPT.md](ROUTINES_PROMPT.md)）:
   - 🗓 **月末モード**: 翌月の重賞メタ情報と出走予定馬の事典化を先に整える
   - 🏆 **重賞週モード** (重賞7日以内): 対象レース・出走予定馬に絞って厚く要約
   - 📅 **改善モード** (月曜): ops-log/ 集計とプロンプト/フィードの改善PR
   - 💤 **軽量モード** (それ以外): POG・業界ニュース・血統だけ少量拾う
3. ビルドスクリプトが `articles.json` + `races.json` + `horses-profile.json` から `races/` `horses/` `sires/` `trainers/` `jockeys/` `breeders/` `owners/` `dams/` `views/` を再生成する。
4. **毎週月曜** — 直近7日の運用ログを読み、フィードや要約プロンプトの改善を PR で提案する（[IMPROVE_PROMPT.md](IMPROVE_PROMPT.md)）。

## 情報源

国内大手スポーツ紙・公式機関・海外専門紙を横断している（[src/feeds.ts](src/feeds.ts)）。

- **週末重賞・G1展望**: netkeiba ニュース＆コラム・東スポ競馬・競馬ラボ（後2者はYahoo!ニュース経由）
- **注目馬・調教・厩舎**: SPAIA競馬・馬トク報知（いずれもYahoo!ニュース経由）
- **POG・2歳・血統**: 競馬のおはなし（Yahoo!ニュース経由）
- **海外競馬**: BloodHorse（All News / Thoroughbred Racing / Thoroughbred Breeding）・Thoroughbred Daily News

※ 記事に無い情報（馬名・着順・走破時計・調教時計・斤量・人気/オッズ）は創作しない方針。
買い目の断定的な推奨はしない。あくまで「強気/弱気材料の整理」にとどめる。

## 検索

```sh
npm run query -- --category g1 --month 2026-05
npm run query -- --keyword イクイノックス
```
