import { normalize } from "./normalize";
import { scrapeAppStore } from "./scrapers/appstore";
import { scrapeReddit } from "./scrapers/reddit";
import { scrapeTwitter } from "./scrapers/twitter";
import { scrapeChiebukuro } from "./scrapers/chiebukuro";
import { scrape5ch } from "./scrapers/fivech";
import { scrapeGooglePlay } from "./scrapers/googleplay";
import type { RawComplaint, NormalizedOre } from "./types";

export interface PipelineConfig {
  appstore?: { appIds: string[]; pages?: number };
  googleplay?: { appIds?: string[] };
  reddit?: { subreddits?: string[]; limit?: number };
  twitter?: { queries?: string[]; maxResults?: number };
  chiebukuro?: { keywords?: string[]; limit?: number };
  fivech?: { boards?: { board: string; title: string }[]; limit?: number };
}

export interface PipelineResult {
  raw: number;
  normalized: number;
  rejected: number;
  ores: NormalizedOre[];
  errors: string[];
}

export async function runPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const allRaw: RawComplaint[] = [];
  const errors: string[] = [];

  const tasks: Promise<void>[] = [];

  if (config.appstore) {
    for (const appId of config.appstore.appIds) {
      tasks.push(
        scrapeAppStore(appId, config.appstore.pages)
          .then((r) => { allRaw.push(...r.complaints); })
          .catch((e) => { errors.push(`appstore:${appId}: ${e.message}`); })
      );
    }
  }

  if (config.googleplay) {
    tasks.push(
      scrapeGooglePlay(config.googleplay.appIds)
        .then((r) => { allRaw.push(...r.complaints); })
        .catch((e) => { errors.push(`googleplay: ${e.message}`); })
    );
  }

  if (config.reddit) {
    tasks.push(
      scrapeReddit(config.reddit.subreddits, config.reddit.limit)
        .then((r) => { allRaw.push(...r.complaints); })
        .catch((e) => { errors.push(`reddit: ${e.message}`); })
    );
  }

  if (config.twitter) {
    tasks.push(
      scrapeTwitter(config.twitter.queries, config.twitter.maxResults)
        .then((r) => { allRaw.push(...r.complaints); })
        .catch((e) => { errors.push(`twitter: ${e.message}`); })
    );
  }

  if (config.chiebukuro) {
    tasks.push(
      scrapeChiebukuro(config.chiebukuro.keywords, config.chiebukuro.limit)
        .then((r) => { allRaw.push(...r.complaints); })
        .catch((e) => { errors.push(`chiebukuro: ${e.message}`); })
    );
  }

  if (config.fivech) {
    tasks.push(
      scrape5ch(config.fivech.boards, config.fivech.limit)
        .then((r) => { allRaw.push(...r.complaints); })
        .catch((e) => { errors.push(`5ch: ${e.message}`); })
    );
  }

  await Promise.all(tasks);

  const seen = new Set<string>();
  const ores: NormalizedOre[] = [];
  let rejected = 0;

  for (const raw of allRaw) {
    if (seen.has(raw.sourceId)) continue;
    seen.add(raw.sourceId);

    const ore = normalize(raw);
    if (ore) {
      ores.push(ore);
    } else {
      rejected++;
    }
  }

  return {
    raw: allRaw.length,
    normalized: ores.length,
    rejected,
    ores,
    errors,
  };
}
