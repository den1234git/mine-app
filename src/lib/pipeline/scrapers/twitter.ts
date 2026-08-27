import type { RawComplaint, ScraperResult } from "../types";

// Twitter/X API requires Bearer Token (API v2)
// Set TWITTER_BEARER_TOKEN in .env.local

const SEARCH_QUERIES = [
  "クソすぎ lang:ja -is:retweet",
  "使いにくい lang:ja -is:retweet",
  "不便すぎ lang:ja -is:retweet",
  "改悪 lang:ja -is:retweet",
  "なんでこんな仕様 lang:ja -is:retweet",
];

export async function scrapeTwitter(
  queries: string[] = SEARCH_QUERIES,
  maxResults = 20,
  bearerToken?: string
): Promise<ScraperResult> {
  const token = bearerToken || process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    console.warn("TWITTER_BEARER_TOKEN not set, skipping Twitter scrape");
    return { complaints: [] };
  }

  const complaints: RawComplaint[] = [];

  for (const q of queries) {
    try {
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=${maxResults}&tweet.fields=created_at,author_id`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const tweets = data?.data;
      if (!Array.isArray(tweets)) continue;

      for (const tweet of tweets) {
        complaints.push({
          source: "twitter",
          sourceId: `twitter:${tweet.id}`,
          rawText: tweet.text,
          url: `https://x.com/i/status/${tweet.id}`,
          scrapedAt: Date.now(),
        });
      }
    } catch {
      continue;
    }
  }

  return { complaints };
}
