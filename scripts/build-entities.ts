// trainers / jockeys / breeders / owners / dams のエンティティページを生成する。
//
// それぞれのページに載るのは:
//   - 関連する馬の一覧（horses-profile.json でその人/牧場と紐づいてる馬 + articles.json の
//     jockeys/trainers カラムで言及された馬）
//   - 関連する記事の一覧（jockeys/trainers のみ。breeders/owners/dams は記事抽出していない）
//
// trainers/jockeys と breeders/owners/dams の違い:
//   - trainers/jockeys は「人」で、記事中に言及されることが多いので、articles テーブルから
//     登場記事を直接引ける（jockeys/trainers カラム）。
//   - breeders/owners/dams は「組織や繁殖牝馬」で、記事に直接登場することは少ない。
//     horses-profile.json で各馬のメタとして持っている情報からのみエンティティを起こす。
//     その馬の関連記事を集約することで間接的にコンテンツが入る。
//
// 5エンティティはどれもジェネリックに扱えるので、1スクリプトでまとめて回す。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb, safeFilename, readHorseProfiles,
  articlesByHorse, articlesByJockey, articlesByTrainer,
  jockeyCounts, trainerCounts,
  type ArticleRow, type HorseProfile,
} from "../src/db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

type EntityKind = "trainers" | "jockeys" | "breeders" | "owners" | "dams";

const EMOJI: Record<EntityKind, string> = {
  trainers: "🎓",
  jockeys: "🏇",
  breeders: "🏡",
  owners: "👤",
  dams: "🐴",
};

const LABEL: Record<EntityKind, string> = {
  trainers: "調教師",
  jockeys: "騎手",
  breeders: "生産者・牧場",
  owners: "馬主",
  dams: "繁殖牝馬・母",
};

interface EntityData {
  name: string;
  /** この人/組織と紐づく馬名のリスト（horses-profile.json から拾った関係） */
  horses: string[];
  /** 直接記事に登場したケース（jockey/trainer の場合のみ非空） */
  directArticles: ArticleRow[];
}

function horseLinkFromEntity(name: string): string {
  // entities/<name>.md は horses/ と同階層なので ../horses/...
  return `[${name}](../horses/${safeFilename(name)}.md)`;
}

function articleLine(a: ArticleRow): string {
  return `- **${a.date}** — [${a.title_ja}](${a.url}) *(出典: ${a.source})*`;
}

function renderEntityPage(kind: EntityKind, data: EntityData, allArticles: ArticleRow[]): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`kind: ${kind}`);
  lines.push(`name: ${data.name}`);
  lines.push(`related_horses: ${data.horses.length}`);
  lines.push(`related_articles: ${allArticles.length}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${EMOJI[kind]} ${data.name}`);
  lines.push(`*${LABEL[kind]}*`);
  lines.push("");
  lines.push(`[索引へ](README.md)`);
  lines.push("");

  // 関連馬
  lines.push(`## 🐎 関連する馬 (${data.horses.length}頭)`);
  lines.push("");
  if (data.horses.length === 0) {
    lines.push("*まだ関連馬がありません。*");
  } else {
    for (const h of data.horses.sort()) {
      lines.push(`- ${horseLinkFromEntity(h)}`);
    }
  }
  lines.push("");

  // 関連記事
  lines.push(`## 📰 関連記事 (${allArticles.length}件)`);
  lines.push("");
  if (allArticles.length === 0) {
    lines.push("*まだ関連記事がありません。*");
  } else {
    for (const a of allArticles) lines.push(articleLine(a));
  }
  lines.push("");

  return lines.join("\n");
}

function renderIndex(kind: EntityKind, items: EntityData[]): string {
  const lines: string[] = [];
  lines.push(`# ${EMOJI[kind]} ${LABEL[kind]} 索引`);
  lines.push("");
  lines.push(`全 ${items.length} 件 ・ 関連馬の多い順`);
  lines.push("");
  for (const it of items) {
    const f = safeFilename(it.name);
    lines.push(`- **${it.horses.length}頭** [${it.name}](${f}.md)`);
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const db = openDb();
  const profiles = readHorseProfiles();

  // エンティティ種別ごとに { name: EntityData } を組み立てる
  const buckets: Record<EntityKind, Map<string, EntityData>> = {
    trainers: new Map(),
    jockeys: new Map(),
    breeders: new Map(),
    owners: new Map(),
    dams: new Map(),
  };

  const ensure = (kind: EntityKind, name: string): EntityData => {
    if (!buckets[kind].has(name)) {
      buckets[kind].set(name, { name, horses: [], directArticles: [] });
    }
    return buckets[kind].get(name)!;
  };

  // 1. horses-profile.json から各馬 → 関係エンティティを引く
  for (const [horseName, p] of Object.entries(profiles)) {
    if (p.trainer) ensure("trainers", p.trainer).horses.push(horseName);
    if (p.breeder) ensure("breeders", p.breeder).horses.push(horseName);
    if (p.owner) ensure("owners", p.owner).horses.push(horseName);
    if (p.dam) ensure("dams", p.dam).horses.push(horseName);
    for (const j of p.main_jockeys ?? []) ensure("jockeys", j).horses.push(horseName);
  }

  // 2. articles.json の jockeys/trainers カラム → 記事に登場した人物を追加
  //    (関連馬は記事の horses カラムから合流させる)
  const jockeyTally = jockeyCounts(db);
  for (const { name } of jockeyTally) {
    const arts = articlesByJockey(db, name);
    const entity = ensure("jockeys", name);
    entity.directArticles = arts;
    for (const a of arts) {
      for (const h of a.horses.split("\t").filter(Boolean)) {
        if (!entity.horses.includes(h)) entity.horses.push(h);
      }
    }
  }
  const trainerTally = trainerCounts(db);
  for (const { name } of trainerTally) {
    const arts = articlesByTrainer(db, name);
    const entity = ensure("trainers", name);
    entity.directArticles = arts;
    for (const a of arts) {
      for (const h of a.horses.split("\t").filter(Boolean)) {
        if (!entity.horses.includes(h)) entity.horses.push(h);
      }
    }
  }

  // 3. 各エンティティについて、関連馬の記事を全部集約して記事一覧を作る
  //    (重複URLは除外、日付降順)
  let totalWritten = 0;
  for (const kind of Object.keys(buckets) as EntityKind[]) {
    const dir = join(ROOT, kind);
    mkdirSync(dir, { recursive: true });
    const items = [...buckets[kind].values()]
      .map((it) => ({ ...it, horses: [...new Set(it.horses)] }))
      .sort((a, b) => b.horses.length - a.horses.length || a.name.localeCompare(b.name));

    for (const it of items) {
      // 直接記事 + 関連馬経由の記事を統合
      const seen = new Set<string>();
      const allArticles: ArticleRow[] = [];
      for (const a of it.directArticles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      for (const h of it.horses) {
        for (const a of articlesByHorse(db, h)) {
          if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
        }
      }
      allArticles.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

      const f = safeFilename(it.name);
      writeFileSync(join(dir, `${f}.md`), renderEntityPage(kind, it, allArticles), "utf-8");
      totalWritten++;
    }

    writeFileSync(join(dir, "README.md"), renderIndex(kind, items), "utf-8");
  }

  db.close();
  console.log(`エンティティページ生成: 計 ${totalWritten} 件（trainers/jockeys/breeders/owners/dams）`);
}

main();
