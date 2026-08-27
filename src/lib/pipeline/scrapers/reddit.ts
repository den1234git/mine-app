import type { RawComplaint, ScraperResult } from "../types";

const COMPLAINT_SUBREDDITS = [
  "mildlyinfuriating",
  "assholedesign",
  "CrappyDesign",
  "softwaregore",
  "firstworldproblems",
];

export async function scrapeReddit(
  subreddits: string[] = COMPLAINT_SUBREDDITS,
  limitPerSub = 25,
  after?: string
): Promise<ScraperResult> {
  const complaints: RawComplaint[] = [];
  let nextCursor: string | undefined;

  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${limitPerSub}${after ? `&after=${after}` : ""}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mine/1.0 (complaint-aggregator)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const posts = data?.data?.children;
      if (!Array.isArray(posts)) continue;

      nextCursor = data?.data?.after || undefined;

      for (const post of posts) {
        const d = post?.data;
        if (!d?.selftext && !d?.title) continue;

        const text = d.selftext
          ? `${d.title}\n\n${d.selftext}`
          : d.title;

        complaints.push({
          source: "reddit",
          sourceId: `reddit:${d.id}`,
          rawText: text,
          subreddit: sub,
          url: `https://reddit.com${d.permalink}`,
          scrapedAt: Date.now(),
        });
      }
    } catch {
      continue;
    }
  }

  return { complaints, nextCursor };
}
