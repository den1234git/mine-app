import * as cheerio from "cheerio";
import type { RawComplaint, ScraperResult } from "../types";

const COMPLAINT_BOARDS = [
  { board: "greta", title: "不満" },
  { board: "smartphones", title: "スマートフォン" },
  { board: "internet", title: "インターネット" },
];

export async function scrape5ch(
  boards: typeof COMPLAINT_BOARDS = COMPLAINT_BOARDS,
  limitPerBoard = 15
): Promise<ScraperResult> {
  const complaints: RawComplaint[] = [];

  for (const { board } of boards) {
    try {
      const url = `https://menu.5ch.net/bbsmenu.html`;
      // 5ch has aggressive anti-scraping, so we use their read.cgi API pattern
      const searchUrl = `https://${board}.5ch.net/${board}/subback.html`;
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Monazilla/1.00 Mine/1.0",
        },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      $("a").slice(0, limitPerBoard).each((_, el) => {
        const title = $(el).text().trim();
        const href = $(el).attr("href") || "";

        if (title.length < 5) return;
        if (!href.includes("/test/read.cgi/")) return;

        complaints.push({
          source: "5ch",
          sourceId: `5ch:${board}:${href}`,
          rawText: title,
          url: href.startsWith("http") ? href : `https://${board}.5ch.net${href}`,
          scrapedAt: Date.now(),
        });
      });
    } catch {
      continue;
    }
  }

  return { complaints };
}
