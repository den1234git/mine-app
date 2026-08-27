import { NextResponse } from "next/server";
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

    // TODO: Write to Firestore when configured
    // for (const ore of result.ores) {
    //   await addDoc(collection(db, "ores"), ore);
    // }

    return NextResponse.json({
      raw: result.raw,
      normalized: result.normalized,
      rejected: result.rejected,
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
