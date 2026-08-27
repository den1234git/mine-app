import * as cheerio from "cheerio";
import type { RawComplaint, ScraperResult } from "../types";

const GP_APP_NAMES: Record<string, string> = {
  "jp.ne.paypay.android.app": "PayPay",
  "com.kouzoh.mercari": "メルカリ",
  "jp.naver.line.android": "LINE",
  "com.ubercab.eats": "Uber Eats",
  "jp.co.rakuten.pay": "楽天ペイ",
  "jp.go.cas.mpa": "マイナポータル",
  "com.instagram.android": "Instagram",
  "jp.co.yahoo.android.apps.transit": "Yahoo!乗換案内",
  "com.twitter.android": "Twitter",
  "au.com.aupay": "au PAY",
};

export async function scrapeGooglePlay(
  appIds: string[] = Object.keys(GP_APP_NAMES),
  lang = "ja",
  country = "jp"
): Promise<ScraperResult> {
  const complaints: RawComplaint[] = [];

  for (const appId of appIds) {
    try {
      const url = `https://play.google.com/store/apps/details?id=${appId}&hl=${lang}&gl=${country}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "ja,en;q=0.5",
        },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      $("[data-reviewid]").each((_, el) => {
        const reviewEl = $(el);
        const stars = reviewEl.find("[aria-label]").first().attr("aria-label");
        const rating = stars ? parseInt(stars.replace(/[^0-9]/g, ""), 10) : 0;
        if (rating > 2) return;

        const text = reviewEl.find("[jsname='bN97Pc']").text().trim()
          || reviewEl.find("span[jsname]").last().text().trim();
        if (!text || text.length < 10) return;

        const reviewId = reviewEl.attr("data-reviewid") || `${Date.now()}`;

        complaints.push({
          source: "googleplay",
          sourceId: `gplay:${appId}:${reviewId}`,
          rawText: text,
          rating,
          appName: GP_APP_NAMES[appId] || undefined,
          url: `${url}&reviewId=${reviewId}`,
          scrapedAt: Date.now(),
        });
      });
    } catch {
      continue;
    }
  }

  return { complaints };
}
