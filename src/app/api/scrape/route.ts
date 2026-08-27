import { NextResponse } from "next/server";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { runPipeline } from "@/lib/pipeline";
import type { PipelineConfig } from "@/lib/pipeline";

const DEFAULT_CONFIG: PipelineConfig = {
  appstore: {
    appIds: [
      "1222370984",  // PayPay
      "1134232521",  // Mercari
      "443904275",   // LINE
    ],
    pages: 2,
  },
  reddit: {
    subreddits: ["mildlyinfuriating", "assholedesign", "CrappyDesign"],
    limit: 15,
  },
  twitter: {
    maxResults: 10,
  },
  chiebukuro: {
    limit: 10,
  },
  fivech: {
    limit: 10,
  },
};

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.SCRAPE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const config: PipelineConfig = { ...DEFAULT_CONFIG, ...body };
    const result = await runPipeline(config);

    const db = getDb();
    let saved = 0;
    let skipped = 0;
    for (const ore of result.ores) {
      const existing = await getDocs(query(collection(db, "ores"), where("body", "==", ore.body)));
      if (!existing.empty) {
        skipped++;
        continue;
      }
      await addDoc(collection(db, "ores"), {
        body: ore.body,
        tags: ore.tags,
        companyNames: ore.companyNames,
        empathyCount: 0,
        source: ore.source,
        createdAt: Date.now(),
      });
      saved++;
    }

    return NextResponse.json({
      raw: result.raw,
      normalized: result.normalized,
      rejected: result.rejected,
      saved,
      skipped,
      errors: result.errors,
      preview: result.ores.slice(0, 5).map((o) => ({
        body: o.body.slice(0, 100),
        tags: o.tags,
        companies: o.companyNames,
        source: o.source,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
