# umashinbun 馬新聞

**レース中心の競馬ダイジェスト。** 「次の宝塚記念に向けてドウデュースはどんな状態？」 — それを1ページで読めるように、
毎朝、競馬ニュースを翻訳・要約してレースごと・馬ごと・種牡馬ごとに集約する。

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

- **2026-06-07** [安田記念 (G1)](races/2026/06/2026-yasuda-kinen.md) 東京 芝1600m
- **2026-06-14** [函館スプリントステークス (G3)](races/2026/06/2026-hakodate-sprint-s.md) 函館 芝1200m
- **2026-06-28** [宝塚記念 (G1)](races/2026/06/2026-takarazuka-kinen.md) 阪神 芝2200m
- **2026-09-27** [スプリンターズステークス (G1)](races/2026/09/2026-sprinters-stakes.md) 中山 芝1200m
- **2026-10-04** [凱旋門賞 (海外G1)](races/2026/10/2026-prix-de-larc-de-triomphe.md) ロンシャン 芝2400m
- **2026-10-18** [秋華賞 (G1)](races/2026/10/2026-shuka-sho.md) 京都 芝2000m
- **2026-10-25** [菊花賞 (G1)](races/2026/10/2026-kikuka-sho.md) 京都 芝3000m
- **2026-11-01** [天皇賞・秋 (G1)](races/2026/11/2026-tenno-sho-autumn.md) 東京 芝2000m

### 終了したレース（直近）
- **2026-05-31** [日本ダービー (東京優駿) (G1)](races/2026/05/2026-tokyo-yushun.md)
- **2026-05-24** [オークス (優駿牝馬) (G1)](races/2026/05/2026-yushun-himba.md)
- **2026-05-17** [ヴィクトリアマイル (G1)](races/2026/05/2026-victoria-mile.md)

## 最新の記事5件

- **2026-06-07** [ナイソスがメトロポリタンHを制覇、Baffert師は"最も賢い馬"と称賛](https://www.bloodmgmt.bloodhorse.com/horse-racing/articles/292314/nysos-rolls-to-victory-in-met-mile) *(BloodHorse All News)*
- **2026-06-07** [ベイシティローラー、コロネーションカップで10馬身差圧勝の番狂わせ](https://www.bloodmgmt.bloodhorse.com/horse-racing/articles/292310/bay-city-roller-flattens-competition-in-coronation-cup) *(BloodHorse All News)*
- **2026-06-07** [クリスマスデイがエプソムダービー制覇、Coolmore勢に12勝目をもたらす](https://www.bloodmgmt.bloodhorse.com/horse-racing/articles/292308/christmas-day-unwraps-epsom-derby-for-coolmore-partners) *(BloodHorse All News)*
- **2026-06-07** [【安田記念】GⅠ馬相手に実力示すガイアフォースが本命 穴ではシックスペンス、セイウンハーデスを警戒](https://news.yahoo.co.jp/articles/c0c8e6fa3f7e10b2c5f0b8e5b8d3e9e3b1f8c7d2?source=rss) *(SPAIA競馬 (Yahoo!ニュース経由))*
- **2026-06-07** [【函館スプリントS】北海道巧者カルプスペルシュが反撃態勢 高松宮記念組は複勝率20%未満](https://news.yahoo.co.jp/articles/9b3e2f7d4c8a6e1b5c2d8f9a3e6b7c4d1a2b3c5d?source=rss) *(SPAIA競馬 (Yahoo!ニュース経由))*

## 仕組み

1. **毎朝 4:00 JST** — GitHub Actions が RSS を取得し `raw-items.json` を生成（[.github/workflows/fetch-feeds.yml](.github/workflows/fetch-feeds.yml)）。
2. **毎朝 7:00 JST** — Claude routine が記事を選定し、本文を取得して競馬ファンの視点で翻訳・要約。記事ごとに「対象レース」「登場馬」「登場種牡馬」を構造化フィールドとして抽出し、`articles.json` に追記する（[ROUTINES_PROMPT.md](ROUTINES_PROMPT.md)）。
3. ビルドスクリプトが `articles.json` + `races.json` から `races/` `horses/` `sires/` `views/news.md` を再生成する。
4. **毎週月曜** — 別の Claude routine が直近7日の運用ログを読み、フィードや要約プロンプトの改善を PR で提案する（[IMPROVE_PROMPT.md](IMPROVE_PROMPT.md)）。

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
