# Routines 登録用プロンプト (毎朝のモード切り替え型ダイジェスト)

このリポジトリ `umashinbun` の README とスクリプトを前提に、Claude Code Routines へ以下を登録する。
スケジュールは毎朝 7:00 JST 推奨 (cron: `0 22 * * *` = 22:00 UTC) を **1本だけ**。
日付に応じて中で4つのモードを切り替える。

> **前提**: RSS の取得は GitHub Actions(`.github/workflows/fetch-feeds.yml`, 毎朝 4:00 JST)が行い、
> 結果を `raw-items.json` として main にコミットする。この日次タスクは fetch を実行せず、
> その `raw-items.json` を読んで要約する。

> 週次改善ループは [IMPROVE_PROMPT.md](IMPROVE_PROMPT.md) を参照。本ファイルの routine は
> 月曜には改善モードを併走させる。

---

## このリポジトリの「リズム」

`umashinbun` は **レース中心** のダイジェスト。毎日全方位で記事を拾うと薄い情報を積むだけになるので、
**「次のレースに向けて情報を集中的に積む」リズム** にする。1本の routine が日付を見て自動で
モードを切り替える方式:

| モード | 発火条件 | やること |
|---|---|---|
| **🗓 月末モード** (monthly_prep) | 月末3日以内 + 来月に重賞あり | 翌月の重賞のメタ情報・出走予定馬の事典化を**重点**で行う |
| **🏆 重賞週モード** (race_week) | 直近7日以内にレース | 対象レース・出走予定馬に絞って厚く要約 |
| **📅 改善モード** (weekly_review) | 月曜日 + 上記いずれでもない | ops-log/ 集計と IMPROVE_PROMPT 実行 (+軽量モードも) |
| **💤 軽量モード** (light) | 上記いずれでもない | POG・業界ニュース・血統だけ少量拾う |

モード判定は **`npm run --silent today-mode`** で行う。その JSON を読んで分岐する。

---

## タスクプロンプト本文 (ここから下を Routines に貼る)

あなたは競馬ファン向けの編集者です。今日のモードを判定し、それに合った仕事をします。

### 手順

#### 0. 今日のモードを判定する

```
npm run --silent today-mode
```

出力例:
```json
{
  "mode": "race_week",
  "target_races": [
    { "id": "2026-takarazuka-kinen", "name": "宝塚記念", "date": "2026-06-14",
      "days_until": 7, "planned_horses": ["クロワデュノール", "..."] }
  ],
  "next_month_races": [],
  "notes": ["..."]
}
```

`mode` の値に応じて、以下のいずれかの分岐に進む。`target_races` と `planned_horses` は
重賞週モード以降で「絞り込みフィルタ」として使う。

---

#### 分岐A: mode = "monthly_prep" (月末モード)

**目的**: 来月の重賞に向けて、レースのメタ情報と出走予定馬の事典化を**先に整えておく**。
12月末は加えて「翌年G1日程の取り込み」を必ず行う(年またぎ準備)。

##### A-0. 年またぎフォールバックの場合 (12/26 以降で翌年データが races.json に無い)

`notes` に「年またぎフォールバック」とある場合、まず翌年のJRA G1日程を取り込む。
**これが完了するまでこのターンを終えない。**

1. 翌年のJRA G1日程を WebFetch で取得する。情報源の優先順位:
   - `https://www.makworld.net/horse/grade/<翌年>.html` (例: 2027年なら `/grade/2027.html`)
   - Wikipedia「<翌年>年の競馬」のG1スケジュール表
   - JRA公式の重賞日程PDF
2. 翌年G1 24本(春G1 11本 + 秋G1 13本) すべてについて以下のメタを埋めて `races.json` に追加:
   ```json
   {
     "id": "2027-takarazuka-kinen",
     "name": "宝塚記念",
     "grade": "G1",
     "date": "2027-06-13",
     "course": "阪神",
     "distance": "芝2200m",
     "planned_horses": [],
     "origin": "manual"
   }
   ```
   - `id` は `<翌年>-<英小文字ハイフン形式>`。既存 2026 年と命名規則を揃える。
   - `course` `distance` は前年と通常同じだが、リニューアル等で変わる場合は WebFetch 内容を優先。
3. 取り込み後 `npm run build` を実行して翌年分のページが生成されることを確認。
4. **ここで一度コミット**: `chore(prep): import <翌年>年 G1 schedule`
5. その後、平常時の monthly_prep 手順(A-1以降)も実行できる範囲で行う。

##### A-1. 平常時の monthly_prep

1. `next_month_races` 内の各レース(最大5件)に対して:
   - `races.json` の該当レコードを確認。`date` / `course` / `distance` / `planned_horses` が
     未設定なら、WebFetch でnetkeibaの該当レース紹介ページから取得して埋める。
   - **WebFetch で planned_horses を取れたら**、`races.json` の該当レコードを書き換える。
2. その月の重賞の主要出走予定馬のうち、`horses-profile.json` に未登録のものを
   Wikipedia で WebFetch して事典化する。1頭につき以下を抽出して JSON に追記する:
   - 生年月日 / 父・母・母父 / 生産者 / 馬主 / 調教師 / 主戦騎手
   - 通算成績(自由文)
   - **major_results**: 1〜3着の重賞成績(year/name/grade/**place**/course/distance)
     ※ 1着だけでなく2着・3着も含める。「主要勝利・好走」として表示される
   - strengths(得意・特徴) / story(物語) / source_url(Wikipedia URL)
3. RSS 要約は **軽量モードと同じ程度**(各カテゴリ最大3件、POG/業界ニュース中心)に抑える。
4. `npm run ingest && npm run build` で再生成し、コミット。

#### 分岐B: mode = "race_week" (重賞週モード)

**目的**: 対象レースに関する情報を集中的に拾い、レースページの厚みをピークに持っていく。

##### B-0. planned_horses を最新化する (毎朝必ず実施)

出走予定馬は刻々と変わる(特別登録段階 → 出馬投票で確定 → 直前回避)。
レース当日に近づくほど精度を上げる必要があるので、毎朝の routine 開始時に必ず取得し直す。

1. `target_races` の各レースについて、レースに対応する netkeiba の特集ページ
   または「<レース名>2026 出走予定馬」を検索して WebFetch する。
   レース別 URL の例:
   - 宝塚記念: `https://dir.netkeiba.com/keibamatome/detail.html?no=<記事ID>`
   - その他のレース: WebSearchで「<レース名> <年> 出走予定馬」を検索してヒットしたページ
2. WebFetch で **カタカナの馬名リスト** を抽出する。スクレイパー(`fetch-runners.ts`)は
   精度不足なので使わない。Claude が WebFetch の構造化抽出で正確に馬名だけ取る。
3. `races.json` の対象レースの `planned_horses` を WebFetch 結果で**上書き**する。
   - レース3日前以降(出馬投票後)は18頭以下に確定されているはず。
   - レース1週前は20頭以上の特別登録段階。
4. WebFetch が失敗した場合は既存の `planned_horses` をそのまま残し、ops-log に記録する。

##### B-0-2. 終了レースの結果取得

レースが終わった当日または翌日に、対象一覧を `fetch-results` で出して、それぞれを WebFetch で取り込む。

1. `npm run fetch-results` を実行して、結果取得が必要なレース一覧を得る。
   ```sh
   npm run fetch-results              # 直近30日の終了レース(routine 通常運用はこれ)
   npm run fetch-results -- --all     # results が空の全終了レース(過去年も)
   npm run fetch-results -- --race 2026-takarazuka-kinen  # 個別指定
   ```
   出力 JSON の `targets` 配列が、これから取得すべきレース。各エントリに
   `race_id` / `name` / `date` / `search_hints` が入っている。
2. 各 target について以下を実行:
   - WebSearch で `search_hints[0]` ("<レース名> <年> 結果") を検索
   - ヒットしたページの中から、構造化されたレース結果ページ(Wikipedia や信頼できる競馬まとめサイト)を WebFetch する
   - 上位5着までの **着順 / 馬名(カタカナ) / 騎手名 / タイム / 単勝人気** を抽出
3. 抽出結果を `races.json` の該当レースの `results` フィールドに追加。形式:
   ```json
   "results": [
     { "place": 1, "horse": "メイショウタバル", "jockey": "武豊", "time": "2:11.4", "popularity": 3 },
     { "place": 2, "horse": "クロワデュノール", "jockey": "北村友一", "time": "2:11.5", "popularity": 1 },
     { "place": 3, "horse": "コスモキュランダ", "jockey": "戸崎圭太", "time": "2:11.7", "popularity": 8 }
   ]
   ```
   2着同着・3着同着は **同じ place 値で複数エントリ** を作る(よくある現象)。
4. 上位3着の馬に `horses-profile.json` のエントリがあれば、`major_results` に新エントリを追加。
   `race_id` を指定してレースページへの双方向リンクを成立させる:
   ```json
   { "place": 1, "year": "2026", "name": "宝塚記念", "grade": "G1",
     "course": "阪神", "distance": "芝2200m", "race_id": "2026-takarazuka-kinen" }
   ```
   - エントリがまだ無い馬は、分岐A手順2(Wikipediaから事典化)を先に実行してから追加。
5. WebFetch が失敗した target は ops-log に記録して次回再試行する(targets リストに残り続ける)。
6. 全件処理後、`npm run build` を実行して `races/...md` の 🏁 結果セクションと、
   馬ページの「主要勝利・好走」のレースリンクが反映されることを確認。

##### B-1. 記事選定 + 要約

1. `target_races` の各レースについて、対象の `planned_horses` リスト(B-0 で更新済み)をメモする。
   これが「今日拾うべき馬」のホワイトリスト。
2. `raw-items.json` を読み、以下のいずれかに該当する記事を**優先的に**選ぶ:
   - タイトル/本文に対象レース名 (例: "宝塚記念") が含まれる
   - タイトル/本文に対象馬名 (planned_horses 内のいずれか) が含まれる
   - 関連する厩舎・騎手のコメント記事
   全カテゴリで最大15記事まで。**ホワイトリスト外の馬しか登場しない記事は除外**してよい。
3. 選んだ記事の本文を `npm run --silent fetch-article` で取得し、要約する。
   要約時に必ず以下を抽出:
   - `race_id`: target_races の id のいずれか。当てはまらない記事は null
   - `horses`: 記事に登場する馬名。**ただし、過去回顧で名前が出ただけの馬は除く**。
     「今この記事が語っているレースに関わる馬」だけ拾う
   - `sires` / `jockeys` / `trainers`: 同様の方針で抽出
4. 各記事の対象馬で `horses-profile.json` に未登録のものは Wikipedia で事典化(分岐A手順2と同じ)。
5. `digest-input.json` に書き出し → `npm run ingest && npm run build`。
6. その日の重賞情報・出走予定馬・追い切り情報を厚くコメントする要約を心がけ、
   8〜10行の summary に加え、`🎯 予想含意:` `🐎 注目馬:` `📊 適性・条件:` `⚖️ 強気/弱気:`
   `📅 次の注目:` を埋める。

#### 分岐C: mode = "weekly_review" (改善モード)

**目的**: 月曜の軽量ダイジェスト。改善 PR の作成は別 routine の仕事。

1. **このルーチンでは IMPROVE_PROMPT.md は実行しない。**
   週次の自己改善 (ops-log 集計・INSIGHTS.md 更新・改善PR) は
   別の routine `umashinbun-weekly-improve` が同じ月曜の 8:00 JST に動いて担当する。
   こちらは weekly_review モードでも「**軽量モード(分岐D)と同じ仕事だけ**」をする。
2. 分岐D の手順をそのまま実行する。

#### 分岐D: mode = "light" (軽量モード)

**目的**: 過剰に拾わず、地殻変動だけ抑える。

1. `raw-items.json` から、以下を中心に **最大5件**選ぶ:
   - POG・新馬戦・2歳戦の話題 (category=pog)
   - 種牡馬・繁殖の話題
   - 業界ニュース (JRA/NAR制度変更、引退・人事、訃報、薬物処分など)
   - 海外G1の話題 (category=overseas で重要なもの)
   - 重賞以外の特別戦で目立った好走・新星
2. 普段の要約と同じく `race_id` / `horses` / `sires` / `jockeys` / `trainers` を抽出。
   ただし重賞絡みの記事は「重賞週モードの担当」なので軽く扱うか、無理に拾わない。
3. `digest-input.json` → `npm run ingest && npm run build`。

---

### 全モード共通の手順

#### 要約フォーマット

```json
{
  "date": "YYYY-MM-DD",
  "category": "g1 / horse / pog / overseas / news",
  "source": "出典名",
  "title_ja": "日本語タイトル",
  "title_en": "原題",
  "url": "https://...",
  "summary": "8〜10行の要約。改行は \\n。末尾に予想含意・注目馬・適性等の箇条書き。",
  "race_id": "2026-takarazuka-kinen | null",
  "horses": ["..."],
  "sires": ["..."],
  "jockeys": ["..."],
  "trainers": ["..."]
}
```

#### 馬の事典化(共通)

新しい馬名を `horses` に入れる場合、まだ `horses-profile.json` に登録されていなければ、
Wikipedia の馬個別ページ(`https://ja.wikipedia.org/wiki/<馬名>` または `<馬名>_(競走馬)`)から
WebFetch で次の情報を取り、追記する:

- 生年月日 (born) / 性別 (sex) / 父・母・母父 (sire/dam/damsire)
- 生産者 (breeder) / 馬主 (owner) / 調教師 (trainer)
- 主戦騎手 (main_jockeys, 1〜2人)
- 通算成績の自由文 (record)
- **major_results**: 1〜3着の重賞成績。各エントリは {place, year, name, grade, course, distance}
  - place は 1/2/3 のみ(4着以下は major にしない方針)
  - course は "東京"/"阪神"/"中山" など、distance は "芝2200m"/"ダ1600m" など
- strengths (得意・特徴) / story (物語的記述) / source_url (Wikipedia URL)

Wikipedia に項目がない馬は無理に作らない(`horses` には入れるが profile は空のまま)。

#### 運用ログ (全モード共通)

この日の実行を振り返り、 `ops-log/YYYY-MM-DD.md` を作成 (同日再実行なら上書き) する。
フォーマットは [ops-log/README.md](ops-log/README.md) に従う。

具体的に記録する内容:

- **モード判定**: `npm run today-mode` の出力(mode / target_races / next_month_races / notes)
- **fetch 結果**: 各ソースの 成功/SKIP、 取得件数・新規件数、 SKIP の理由(HTTPコード等)
  - 成功ソース数 / 全ソース数、 候補総数を必ず残す
- **カテゴリ別 採用状況**: g1 / horse / pog / overseas / news それぞれの 候補数・採用数
- **構造化抽出率**: 採用記事のうち race_id / horses / sires / jockeys / trainers がそれぞれ非空だった割合
  - これが低いとレースページ・馬ページ・エンティティページが薄くなる。 直接の品質指標
- **事典化した馬の数** (monthly_prep / race_week モードのみ):
  - horses-profile.json に追記した馬と Wikipedia URL
  - 取得失敗 (Wikipedia 項目なし等) の馬
- **出走予定馬 / 結果取得の成否** (race_week モードのみ):
  - B-0 planned_horses 更新の結果 (何頭 → 何頭、 どのレース)
  - B-0-2 結果取得の対象と成否
- **気づき・改善候補**: 継続的に失敗しているソース、 候補が薄いカテゴリ、 重複が多い等を簡潔に。
  新ソース候補に心当たりがあればURLとともにメモする。

**「プロジェクト改善考察」欄を必ず書く** ([ops-log/README.md](ops-log/README.md) の該当節の問いを使う)。
これは記事内容の感想ではなく、 **この仕組みをどう良くするか** —— fetch の仕組みは妥当か、
重賞週に厚い情報が集まっているか、 ソース構成に穴はないか、 構造化抽出の精度は十分か、
馬の事典化が機能しているか、 planned_horses/results の最新化が動いているか —— についての所感を書く。

書く前に `ops-log/INSIGHTS.md` (累積考察) を **読み**、 既出の論点は「継続/悪化/解消」が
分かるように書く。 その日に言えることだけでよい (全問に答えなくてよい)。

⚠️ これは **記録だけ**。 `src/feeds.ts` や `ROUTINES_PROMPT.md` 等のコードは
**この日次タスクでは変更しない** (コード改善は週次の改善 routine が PR で行う)。
**`INSIGHTS.md` も日次では書き換えない** (読むだけ。 追記するのは週次 routine)。

#### コミット

コミットメッセージ:
- monthly_prep: `chore(prep): YYYY-MM-DD prep <翌月>`
- race_week: `chore(digest): YYYY-MM-DD race-week (<対象レース名>)`
- weekly_review: `chore(digest): YYYY-MM-DD light (weekly_review)`
- light: `chore(digest): YYYY-MM-DD light`

main に push する。 push できない構成ならブランチで PR を作り、 人手マージ可能な状態で停止する。

追加・変更されるのは:
- `articles.json` (記事の正本)
- `races.json` (planned_horses 更新・results 追加された場合)
- `horses-profile.json` (新出馬の事典化)
- `races/**` / `horses/**` / `sires/**` / `trainers/**` / `jockeys/**` /
  `breeders/**` / `owners/**` / `dams/**` / `views/**` / `README.md` (build 派生物)
- `ops-log/YYYY-MM-DD.md` (この日の運用ログ)

コミットしないもの:
- `digest.db` (git 管理外。 検索用の派生物)
- `raw-items.json` (GitHub Actions が管理するファイル。 この routine ではコミットしない)
- `digest-input.json` (中間生成物。 .gitignore 済み)
- `article-bodies/` (中間生成物。 .gitignore 済み)
- `ops-log/INSIGHTS.md` (日次では書かない)
- `ops-log/DEBATES/` (日次では書かない)

### 注意

- 事実を創作しない。RSSにない情報(馬名・着順・走破時計・調教時計・斤量・人気/オッズ)を足さない。
- 買い目の断定的な推奨はしない(「狙い目」「妙味」程度の表現にとどめる)。
- 騎手・調教師に関する記述は中立的に。推測・噂は載せない。
- 馬名表記は記事内の表記に従う。
- **重賞週モードでホワイトリスト外の馬しか登場しない記事は除外して良い**が、
  重要な業界ニュース(訃報・処分・制度変更)は別枠で1〜2件は拾う。
