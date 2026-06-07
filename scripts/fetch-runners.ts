// ⚠️ **現状このスクリプトは精度不足のため実運用していない。**
// 単純な「カタカナn文字以上」フィルタでは、レース紹介ページに散らばっている
// 関連馬名・他レース名・サイトUI文言を弾ききれず、平気で 80+ 件の候補が出る。
// 「馬名らしさ」を判定する辞書は無限に膨らむ ので、続けてもいたちごっこ。
//
// 当面は **WebFetch (Claude経由) で構造化抽出 → races.json を手動更新** の運用に
// 落ち着いている。下記のヒューリスティックは、その出処を辿るための雛形として
// 残してある。改善するなら:
//   (a) HTMLの構造的位置を見る(箇条書き内のテキストノードだけ拾う)
//   (b) netkeiba の「特別登録馬」APIっぽいエンドポイントを探す(あれば最速)
//   (c) 一度Claudeに整形させた結果をキャッシュ
// のいずれか。
//
// 一次情報の取り方:
//   netkeiba の「競馬まとめ」記事(dir.netkeiba.com/keibamatome/detail.html?no=XXXX)を
//   読みに行く。記事中に登録馬リストが箇条書きで載っている。

import { readRaces, writeRaces } from "../src/db.ts";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

interface RunnersSource {
  race_id: string;
  url: string;
}

const SOURCES: RunnersSource[] = [
  { race_id: "2026-takarazuka-kinen", url: "https://dir.netkeiba.com/keibamatome/detail.html?no=5676" },
  // 他のG1は出走週が近づいてから netkeiba まとめ記事URLを順次追加していく。
];

// サイト共通の UI文言・カテゴリ名(これらはカタカナだが馬名ではない)
const NOISE_WORDS = new Set([
  "ネット", "ニュース", "コラム", "メニュー", "プロフィール", "ログイン", "ログアウト",
  "クリック", "リーグ", "サブスクリプション", "ポッドキャスト",
  "アプリ", "ブラウザ", "ダウンロード", "ホームページ", "コンテンツ",
  "プライバシー", "ポリシー", "サイトマップ", "オンライン", "ステークス",
  "オープン", "クラシック", "プラン", "コミュニティ", "プレミアム",
  "シリーズ", "アクセス", "リンク", "サポート", "アカウント",
  "ジョッキー", "トレーニングセンター", "ファクター", "ターゲット",
  "プロセス", "サンプル", "テクノロジー", "ライセンス", "システム",
  "セッション", "オファー", "ベーシック", "プロセッサ",
  "サービス", "ショップ", "データベース", "ダービー", "リニューアル",
  "プレミアムサービス", "ビルダー", "オッズ", "サーバ", "セキュリティ",
  "アンケート", "キャンペーン", "アーカイブ", "リプレイ", "アップデート",
  "ヘルプ", "ガイド", "マニュアル", "クッキー", "ロゴ", "コピー",
  "ハイライト", "ピックアップ", "ランキング", "ラインナップ",
]);

function looksLikeHorseName(s: string): boolean {
  if (s.length < 4 || s.length > 14) return false;
  if (s.includes("・") || s.includes(",") || s.includes("、") || s.includes("。")) return false;
  if (s.startsWith("ー") || s.endsWith("ー") && s.length < 6) return false;
  if (NOISE_WORDS.has(s)) return false;
  return true;
}

async function fetchHorseNames(url: string): Promise<string[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ja,en;q=0.8" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const html = await res.text();

  const candidates = new Set<string>();
  const KATAKANA = /[゠-ヿー]{4,}/g;
  for (const m of html.matchAll(KATAKANA)) {
    candidates.add(m[0]);
  }

  return [...candidates].filter(looksLikeHorseName).sort();
}

async function main(): Promise<void> {
  const races = readRaces();
  const byId = new Map(races.map((r) => [r.id, r]));

  let updated = 0;
  for (const src of SOURCES) {
    const race = byId.get(src.race_id);
    if (!race) {
      console.warn(`SKIP race_id=${src.race_id} (races.jsonに未登録)`);
      continue;
    }
    try {
      console.log(`Fetching ${src.race_id} from ${src.url} ...`);
      const horses = await fetchHorseNames(src.url);
      if (horses.length === 0) {
        console.warn(`  WARN: 0頭しか抽出できず。HTMLが変わったかも。スキップ`);
        continue;
      }
      if (horses.length > 30) {
        console.warn(`  WARN: ${horses.length}頭抽出された(多すぎ・ノイズ混入の可能性)。`);
        console.warn(`  抽出結果(先頭40件): ${horses.slice(0, 40).join(", ")}`);
        console.warn(`  手動確認を推奨。今回は上書きしない。`);
        continue;
      }
      race.planned_horses = horses;
      console.log(`  OK: ${horses.length}頭 -> ${horses.join(", ")}`);
      updated++;
    } catch (e) {
      console.warn(`  ERR: ${(e as Error).message}`);
    }
  }

  if (updated > 0) {
    writeRaces(races);
    console.log(`\n${updated}レースのplanned_horsesを更新しました。`);
  } else {
    console.log("\n更新なし。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
