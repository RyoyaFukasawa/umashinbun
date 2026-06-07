// 指定URLの記事本文を取得・抽出し、本文は個別ファイルに保存する。
//   npm run --silent fetch-article -- "https://www.cnbc.com/..." "<url2>" ...
//
// 用途: Routines 上の Claude が、選定した記事の本文を厚く要約するために使う。
//
// ⚠️ 設計の要点（コンテキスト爆発の回避）:
//   以前は全記事の本文(各〜6000字)をまとめて JSON で標準出力に返していたため、
//   15件×数千字が一度に routine のコンテキストへ流れ込み、タイムアウト/失敗していた。
//   そこで本文は `article-bodies/NN.txt` に個別保存し、標準出力には
//   「インデックス（url/ok/chars/path/先頭プレビュー）」だけを返す。
//   routine はインデックスを見て、必要な記事のファイルだけ Read で開いて要約する。
//
// 本文は最大 MAX_CHARS 字に切り詰める（要約には十分。コンテキスト負荷を抑える）。
//
// 出力（標準出力, JSON配列。本文テキストは含めない）:
//   [{ "url","ok","status","chars","path","preview" }, ...]

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractArticle } from "../src/extract.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BODY_DIR = join(__dirname, "..", "article-bodies");
// 1記事あたりの本文上限。本文は個別ファイルに保存し routine は「1記事ずつ」読むため、
// 同時にコンテキストへ乗るのは1記事分だけ。要約の質を優先して厚め(6000字)にしている。
// （以前の失敗は「全15件の本文を1つのJSONで一気にstdout返し」が原因で、上限値ではない。）
const MAX_CHARS = 6000;

async function fetchHtml(url: string, timeoutMs = 20000): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();
    return { status: res.status, html };
  } finally {
    clearTimeout(t);
  }
}

interface ArticleIndex {
  url: string;
  ok: boolean;
  status: number | null;
  chars: number;
  path: string | null; // 本文を保存したファイルの相対パス（ok時のみ）
  preview: string; // 本文の冒頭プレビュー（最大160字。取得確認用）
  error?: string;
}

async function fetchOne(url: string, idx: number): Promise<ArticleIndex> {
  try {
    const { status, html } = await fetchHtml(url);
    if (status < 200 || status >= 300) {
      return { url, ok: false, status, chars: 0, path: null, preview: "", error: `HTTP ${status}` };
    }
    const { text } = extractArticle(html, MAX_CHARS);
    if (text.length < 200) {
      // ペイウォール抜粋など。取れなかった扱い。
      return { url, ok: false, status, chars: text.length, path: null, preview: "" };
    }
    const rel = join("article-bodies", `${String(idx).padStart(2, "0")}.txt`);
    writeFileSync(join(__dirname, "..", rel), text, "utf-8");
    return {
      url,
      ok: true,
      status,
      chars: text.length,
      path: rel,
      preview: text.slice(0, 160).replace(/\s+/g, " "),
    };
  } catch (err) {
    return { url, ok: false, status: null, chars: 0, path: null, preview: "", error: (err as Error).message };
  }
}

async function main() {
  const urls = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a));
  if (urls.length === 0) {
    console.error('使い方: npm run --silent fetch-article -- "<URL>" ["<URL2>" ...]');
    process.exit(1);
  }

  // 保存先を毎回まっさらに（前回の本文が残らないように）
  rmSync(BODY_DIR, { recursive: true, force: true });
  mkdirSync(BODY_DIR, { recursive: true });

  const CONCURRENCY = 4;
  const results: ArticleIndex[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map((u, j) => fetchOne(u, i + j)));
    results.push(...settled);
  }

  // 進捗は stderr、インデックス(JSON・本文なし)は stdout に。
  for (const r of results) {
    const tag = r.ok ? `OK   ${r.chars}字 → ${r.path}` : `MISS ${r.error ?? "本文薄い"}`;
    console.error(`${tag}  ${r.url}`);
  }
  process.stdout.write(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
