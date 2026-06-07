// フィード設定。ここを編集すれば収集ソースを足し引きできる。
// category は 'g1' | 'horse' | 'pog' | 'overseas' | 'news' のいずれか。
//
// 競馬の「週末予想・展望」に効くソースを軸に、注目馬・調教・厩舎情報を厚めに、
// POG/育成・血統、海外競馬、業界一般ニュースで補強する構成。
// フィードURLはサイト改編で変わることがあるため、取得失敗しても他のソースは
// 止まらない設計（fetch-feeds.ts 側でスキップ）。
//
// ★ 初期登録分は 2026-06-07 に curl で生存確認済み（HTTP 200 かつ <item> を含むこと）。
//    JRA公式 RSS は 2026-03-31 で配信終了したため不採用。サンスポZBAT!・スポニチ・
//    デイリースポーツ・ラジオNIKKEI・スポーツ報知は公開RSSが見つからず不採用。
//    その代わり、Yahoo!ニュース経由で東スポ競馬・競馬ラボ・SPAIA・馬トク報知・
//    競馬のおはなしのフィードを購読する（各社の記事が流れ込んでいる集約フィード）。

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
    // 競馬最大手の総合メディア。ニュース＆コラムの公式RSS。
    // 重賞展望・予想印・調教評価が日次更新（無料）。
    name: "netkeiba ニュース＆コラム",
    url: "https://rss.netkeiba.com/?pid=rss_netkeiba&site=netkeiba",
    category: "g1",
  },
  {
    // 東スポ競馬のYahoo!ニュース集約フィード。トラックマンの予想・短評・追い切り評価（無料）。
    name: "東スポ競馬 (Yahoo!ニュース経由)",
    url: "https://news.yahoo.co.jp/rss/media/tspkeiba/all.xml",
    category: "g1",
  },
  {
    // 競馬ラボ。コラム・特集中心、展望記事も多い（Yahoo!ニュース経由・無料）。
    name: "競馬ラボ (Yahoo!ニュース経由)",
    url: "https://news.yahoo.co.jp/rss/media/keibalab/all.xml",
    category: "g1",
  },

  // --- 注目馬・調教・厩舎情報 ---
  // 「その週末に走る個別馬」のディテール（追い切り・近況・コメント）を拾う層。
  {
    // SPAIA競馬。データ分析寄りで、馬個別の戦績・適性・傾向の記事が豊富（Yahoo!ニュース経由・無料）。
    name: "SPAIA競馬 (Yahoo!ニュース経由)",
    url: "https://news.yahoo.co.jp/rss/media/spaia/all.xml",
    category: "horse",
  },
  {
    // 馬トク報知（スポーツ報知の競馬枠）。追い切り評価・厩舎コメントが厚い（Yahoo!ニュース経由・無料）。
    name: "馬トク報知 (Yahoo!ニュース経由)",
    url: "https://news.yahoo.co.jp/rss/media/umatokuh/all.xml",
    category: "horse",
  },

  // --- POG・2歳・育成・血統 ---
  // 2歳新馬・社台/ノーザン系の育成情報、種牡馬・血統トピック。
  {
    // 競馬のおはなし。コラム・読み物寄りで、血統・POG・育成の特集が多い
    // （Yahoo!ニュース経由・無料）。
    name: "競馬のおはなし (Yahoo!ニュース経由)",
    url: "https://news.yahoo.co.jp/rss/media/keibana/all.xml",
    category: "pog",
  },

  // --- 海外競馬 ---
  // 凱旋門賞・ブリーダーズカップ・ドバイ・香港・サウジ等、海外G1とその関連情報。
  {
    // 米のサラブレッド業界紙。BC・米G1・米国産種牡馬情報、ニュース全般（無料）。
    name: "BloodHorse All News",
    url: "https://www.bloodhorse.com/horse-racing/feeds/news/all-news",
    category: "overseas",
  },
  {
    // BloodHorse のサラブレッド競走に特化したフィード。レース・結果寄り（無料）。
    name: "BloodHorse Thoroughbred Racing",
    url: "https://www.bloodhorse.com/horse-racing/feeds/news/thoroughbred-racing",
    category: "overseas",
  },
  {
    // BloodHorse の繁殖・血統に特化したフィード。海外種牡馬・繁殖情報の一次情報（無料）。
    name: "BloodHorse Thoroughbred Breeding",
    url: "https://www.bloodhorse.com/horse-racing/feeds/news/thoroughbred-breeding",
    category: "overseas",
  },
  {
    // Thoroughbred Daily News。米国・国際競馬の業界紙、セリ・血統情報も豊富（無料）。
    name: "Thoroughbred Daily News",
    url: "https://www.thoroughbreddailynews.com/feed/",
    category: "overseas",
  },

  // --- 競馬界一般ニュース ---
  // 業界の地殻変動を捉える層。Yahoo!ニュース集約フィードに専門紙が複数流れ込んでおり、
  // ここでは別カテゴリで使っていない「東スポ競馬」を news 視点でも拾うため重複登録はせず、
  // 当面 g1/horse/pog のカテゴリ越境で対応する（候補が増えたら news 専用ソースを追加）。
  // 暫定的に news 専用は空でスタートし、週次改善ルーチンで穴を埋めていく。
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
