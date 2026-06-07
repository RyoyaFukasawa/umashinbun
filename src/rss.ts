// 外部依存なしの軽量 RSS 2.0 / Atom パーサ。
// 完璧なXMLパーサではないが、主要ニュースフィードのitem/entry抽出には十分。

export interface FeedItem {
  title: string;
  link: string;
  description: string; // RSSのdescription / Atomのsummary（HTMLタグは除去済み）
  pubDate?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function clean(s: string | undefined): string {
  if (!s) return "";
  return decodeEntities(stripHtml(stripCdata(s))).trim();
}

/** 指定タグの中身（最初の一致）を取り出す */
function tagContent(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1] : undefined;
}

/** Atom の <link href="..."/> を取り出す */
function atomLink(block: string): string | undefined {
  // rel="alternate" を優先、なければ最初のlink
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alt) return alt[1];
  const any = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return any ? any[1] : undefined;
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  // RSS 2.0: <item>...</item>
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssItems) {
    const title = clean(tagContent(block, "title"));
    const link = clean(tagContent(block, "link"));
    const description = clean(
      tagContent(block, "description") ?? tagContent(block, "content:encoded"),
    );
    const pubDate = clean(tagContent(block, "pubDate") ?? tagContent(block, "dc:date"));
    if (title && link) items.push({ title, link, description, pubDate });
  }

  // Atom: <entry>...</entry>
  const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomEntries) {
    const title = clean(tagContent(block, "title"));
    const link = atomLink(block) ?? "";
    const description = clean(
      tagContent(block, "summary") ?? tagContent(block, "content"),
    );
    const pubDate = clean(tagContent(block, "updated") ?? tagContent(block, "published"));
    if (title && link) items.push({ title, link, description, pubDate });
  }

  return items;
}
