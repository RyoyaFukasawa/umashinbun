// フィード設定。ここを編集すれば収集ソースを足し引きできる。
// category は 'g1' | 'horse' | 'pog' | 'overseas' | 'news' のいずれか。
//
// 競馬の「週末予想・展望」に効くソースを軸に、注目馬・調教・厩舎情報を厚めに、
// POG/育成・血統、海外競馬、業界一般ニュースで補強する構成。
// フィードURLはサイト改編で変わることがあるため、取得失敗しても他のソースは
// 止まらない設計（fetch-feeds.ts 側でスキップ）。

export type Category = "g1" | "horse" | "pog" | "overseas" | "news";

export interface FeedSource {
  /** 表示用の出典名 */
  name: string;
  /** RSS/Atom フィードのURL */
  url: string;
  /** 分類カテゴリ */
  category: Category;
  /** 本文が有料の壁の向こうか（要約はRSS記載範囲ベースになる旨の注記用） */
  paywalled?: boolean;
  /**
   * 信憑性が裏取りされていない一次情報か（例: 個人ブログ・SNSスレッド）。
   * true のソースはダイジェスト上で ⚠️ 付きの「未確認情報」として明示し、
   * 事実として断定せず「〜という投稿がある」のトーンで扱う。
   */
  unverified?: boolean;
}

export const FEEDS: FeedSource[] = [
  // --- 週末重賞・G1 展望 ---
  // 土日の重賞・特別レースの予想・展望・出馬表に関する記事を厚く拾う。
  {
    // 競馬最大手の総合メディア。展望コラム・予想印・調教評価が日次更新（無料・本文も無料）。
    name: "netkeiba ニュース",
    url: "https://news.netkeiba.com/?pid=rss",
    category: "g1",
  },
  {
    // JRA公式のお知らせ・重賞情報。一次情報として強い（無料）。
    name: "JRA お知らせ",
    url: "https://www.jra.go.jp/news/rss.xml",
    category: "g1",
  },
  {
    // サンケイスポーツの競馬専門サイト。重賞展望と予想印が手厚い（無料）。
    name: "サンスポZBAT!",
    url: "https://race.sanspo.com/keiba/rss/keiba.rdf",
    category: "g1",
  },
  {
    // 東京スポーツ競馬。トラックマンの予想・短評・追い切り評価が読める（無料）。
    name: "東スポ競馬",
    url: "https://www.tokyo-sports.co.jp/category/race/feed",
    category: "g1",
  },
  {
    // スポーツ報知の競馬欄。重賞特集・調教・前日オッズ記事（無料）。
    name: "スポーツ報知 競馬",
    url: "https://hochi.news/keiba/feed/",
    category: "g1",
  },

  // --- 注目馬・調教・厩舎情報 ---
  // 「その週末に走る個別馬」のディテール（追い切り・近況・コメント）を拾う層。
  {
    // ラジオNIKKEIの競馬。専門ラジオ局として現場取材が厚く、トレセン情報・厩舎コメントに強い（無料）。
    name: "ラジオNIKKEI 競馬",
    url: "https://www.radionikkei.jp/keiba/rss.xml",
    category: "horse",
  },
  {
    // デイリースポーツ競馬。一週前・最終追い切りの評価記事が日次で出る（無料）。
    name: "デイリースポーツ 競馬",
    url: "https://www.daily.co.jp/horse/rss.rdf",
    category: "horse",
  },
  {
    // スポニチ競馬。追い切り欄・厩舎の話が手厚い（無料）。
    name: "スポニチ 競馬",
    url: "https://www.sponichi.co.jp/gamble/rss/horse.xml",
    category: "horse",
  },
  {
    // 日刊スポーツ競馬。トラックマンの短評・本紙予想印（無料）。
    name: "日刊スポーツ 競馬",
    url: "https://www.nikkansports.com/race/horseracing/rss.xml",
    category: "horse",
  },

  // --- POG・2歳・育成・血統 ---
  // 2歳新馬・社台/ノーザン系の育成情報、種牡馬・血統トピック。
  // POG読者・血統好きが求めるレイヤー。
  {
    // netkeiba の POG / 育成 / 2歳特集の更新（無料）。
    // ※ 専用RSSが無い場合は news.netkeiba.com のタグ別RSSに置き換える前提。
    name: "netkeiba コラム",
    url: "https://news.netkeiba.com/?pid=rss_column",
    category: "pog",
  },
  {
    // JBIS血統情報サービス。種牡馬・繁殖の更新情報（無料）。
    name: "JBIS-Search お知らせ",
    url: "https://www.jbis.or.jp/news/rss.xml",
    category: "pog",
  },
  {
    // 優駿（JRA-VAN/中央競馬PRセンター）の特集。育成・血統コラム（無料）。
    name: "JRA-VAN 競馬コラム",
    url: "https://jra-van.jp/fun/rss.xml",
    category: "pog",
  },

  // --- 海外競馬 ---
  // 凱旋門賞・ブリーダーズカップ・ドバイ・香港・サウジ等、遠征組や海外G1の動向。
  {
    // 英の競馬専門紙。海外G1・調教・厩舎コメントの一次情報源（無料RSS、本文は一部ペイウォール）。
    name: "Racing Post",
    url: "https://www.racingpost.com/rss/news",
    category: "overseas",
    paywalled: true,
  },
  {
    // 米のサラブレッド業界紙。BC・米G1・米国産種牡馬情報（無料）。
    name: "BloodHorse",
    url: "https://www.bloodhorse.com/horse-racing/rss/news",
    category: "overseas",
  },
  {
    // 国際競馬統括機関JAIRSの日本語ニュース。海外G1結果と日本馬遠征情報（無料）。
    name: "JAIRS 国際競馬情報",
    url: "https://www.jairs.jp/rss/news.xml",
    category: "overseas",
  },
  {
    // Thoroughbred Daily News。米国・国際競馬の業界紙、セリ・血統情報も豊富（無料）。
    name: "Thoroughbred Daily News",
    url: "https://www.thoroughbreddailynews.com/feed/",
    category: "overseas",
  },

  // --- 競馬界一般ニュース ---
  // JRA・地方競馬の制度変更、賞金・斤量改定、騎手の動向、訃報・人事など、
  // 直接の予想材料にはならないが業界の地殻変動を捉えるソース。
  {
    // 地方競馬全国協会(NAR)公式。地方競馬のレース日程・お知らせ（無料）。
    name: "NAR 地方競馬",
    url: "https://www.keiba.go.jp/news/rss.xml",
    category: "news",
  },
  {
    // Yahoo!ニュース 競馬カテゴリ。各紙の競馬記事が横断的に流れる（無料）。
    name: "Yahoo!ニュース 競馬",
    url: "https://news.yahoo.co.jp/rss/categories/horseracing.xml",
    category: "news",
  },
  {
    // 競馬ラボ。コラム・特集が中心、業界の話題を取り上げる（無料）。
    name: "競馬ラボ",
    url: "https://www.keibalab.jp/rss/news.xml",
    category: "news",
  },
];

/** 1カテゴリあたり、ダイジェストに残す最大記事数 */
export const MAX_PER_CATEGORY = 5;

export const CATEGORY_LABELS: Record<Category, string> = {
  g1: "🏆 週末重賞・G1展望",
  horse: "🐎 注目馬・調教・厩舎",
  pog: "🌱 POG・2歳・血統",
  overseas: "🌍 海外競馬",
  news: "📰 競馬界ニュース",
};

export const CATEGORY_ORDER: Category[] = ["g1", "horse", "pog", "overseas", "news"];
