// 外部依存なしの軽量・本文抽出器。
// 完璧な可読性抽出（Readabilityアルゴリズム）ではないが、主要ニュースサイトの
// 本文段落をそれなりに拾うには十分。取れなければ空文字を返し、呼び出し側は
// RSSのdescriptionにフォールバックする想定。

/** <script><style> など本文に不要なブロックをまるごと除去 */
function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2019;/g, "’")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8212;/g, "—")
    .replace(/&#8211;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** <article> ブロックがあればその中身を優先的に返す（最も長いものを採用） */
function pickArticleBlock(html: string): string | null {
  const blocks = html.match(/<article[\s>][\s\S]*?<\/article>/gi);
  if (!blocks || blocks.length === 0) return null;
  // 最も長い article ブロックを本文とみなす
  return blocks.sort((a, b) => b.length - a.length)[0];
}

/** <p> 段落を全部集めて、それらしい本文段落だけ残す */
function collectParagraphs(html: string): string[] {
  const ps = html.match(/<p[\s>][\s\S]*?<\/p>/gi) ?? [];
  const out: string[] = [];
  for (const p of ps) {
    const text = decodeEntities(stripTags(p));
    // 短すぎる断片（キャプション・UIラベル等）は捨てる
    if (text.length < 40) continue;
    // リンクだらけ・記号だらけの段落は本文でないことが多い
    const letters = text.replace(/[^A-Za-z぀-ヿ一-鿿]/g, "").length;
    if (letters < text.length * 0.5) continue;
    out.push(text);
  }
  return out;
}

export interface ExtractResult {
  text: string; // 抽出した本文（空なら失敗）
  paragraphs: number; // 採用した段落数
  chars: number; // 文字数
}

/** HTML文字列から本文を抽出する */
export function extractArticle(html: string, maxChars = 6000): ExtractResult {
  const cleaned = stripNoise(html);
  // <article> があればその中の段落を、なければ全体から段落を集める
  const scope = pickArticleBlock(cleaned) ?? cleaned;
  let paragraphs = collectParagraphs(scope);

  // article スコープで段落が極端に少なければ、全体から拾い直す
  if (paragraphs.length < 3 && scope !== cleaned) {
    paragraphs = collectParagraphs(cleaned);
  }

  let text = paragraphs.join("\n\n");
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + "…";
  }
  return { text, paragraphs: paragraphs.length, chars: text.length };
}
