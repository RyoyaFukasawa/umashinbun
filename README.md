> 🏆 次のG1: **スプリンターズステークス** (G1) — 2026-09-27 (日) ・ 中山 ・ 芝1200m ・ あと 96 日

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

- **2026-06-23** [G1・4勝ラッキーライラックの子ラッキースパークルが28日福島でデビュー 松永幹「瞬発力が母に似ている」](https://news.yahoo.co.jp/articles/cc2f3335aba72f94739d84805f704de0863b5161) *(馬トク報知)*
- **2026-06-23** [POGマニア: 新種牡馬サリオス産駒が先週初勝利 2年目インディチャンプ産駒も複数勝利](https://news.yahoo.co.jp/articles/38b8ab6b6375930ffb011a15323f5a422ef5b1f3) *(馬トク報知)*
- **2026-06-23** [凱旋門賞、2027年からせん馬の出走解禁へ フランス・ギャロが歴史的決議](https://www.bloodhorse.com/horse-racing/articles/292680/prix-de-larc-de-triomphe-to-allow-geldings-next-year) *(BloodHorse)*
- **2026-06-23** [NZ年度代表種牡馬10度のサヴァビール、24歳で死亡 放牧中の事故で肩骨折](https://www.bloodhorse.com/horse-racing/articles/292590/new-zealand-champion-sire-savabeel-dies) *(BloodHorse)*
- **2026-06-23** [フォーエバーヤング、秋の米国遠征プラン確定 BCクラシック連覇へ坂井瑠星「当然勝つつもりで行く」](https://news.yahoo.co.jp/articles/088d60769e58c774dd0cbea85c878ee1ef3bb12a) *(東スポ競馬)*

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
