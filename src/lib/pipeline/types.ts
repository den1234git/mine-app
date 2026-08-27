export interface RawComplaint {
  source: "appstore" | "googleplay" | "reddit" | "twitter" | "chiebukuro" | "5ch" | "manual";
  sourceId: string;
  rawText: string;
  rating?: number;
  author?: string;
  appName?: string;
  subreddit?: string;
  url?: string;
  scrapedAt: number;
}

export interface NormalizedOre {
  body: string;
  tags: string[];
  companyNames: string[];
  source: RawComplaint["source"];
  sourceId: string;
  sourceUrl?: string;
  empathyCount: number;
  createdAt: number;
  authorId: string;
}

export interface ScraperResult {
  complaints: RawComplaint[];
  nextCursor?: string;
}
