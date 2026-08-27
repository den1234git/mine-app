"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Ore } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  appstore: "App Store",
  googleplay: "Google Play",
  reddit: "Reddit",
  twitter: "X/Twitter",
  chiebukuro: "知恵袋",
  "5ch": "5ch",
};

function BarChart({ data, color = "bg-accent" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-sm text-muted w-28 truncate text-right shrink-0">{d.label}</span>
          <div className="flex-1 h-7 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
              style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? "2rem" : "0" }}
            >
              <span className="text-xs font-medium text-zinc-950">{d.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WordCloud({ words }: { words: { text: string; count: number }[] }) {
  const max = Math.max(...words.map((w) => w.count), 1);
  const colors = [
    "text-amber-400", "text-amber-300", "text-orange-400",
    "text-yellow-400", "text-red-400", "text-emerald-400",
    "text-sky-400", "text-purple-400", "text-pink-400",
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center py-4">
      {words.map((w, i) => {
        const scale = 0.7 + (w.count / max) * 1.8;
        return (
          <span
            key={w.text}
            className={`${colors[i % colors.length]} font-medium transition-transform hover:scale-110 cursor-default`}
            style={{ fontSize: `${scale}rem` }}
            title={`${w.count}回`}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

function extractKeywords(ores: Ore[]): { text: string; count: number }[] {
  const stopWords = new Set([
    "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ", "ある", "いる",
    "も", "する", "から", "な", "こと", "として", "い", "や", "ない", "その", "よう",
    "ので", "この", "ます", "です", "した", "ている", "される", "という", "ため",
    "だ", "って", "けど", "ので", "から", "まで", "など", "それ", "これ", "あの",
    "ん", "よ", "ね", "か", "わ", "だけ", "でも", "じゃ", "って", "なん", "そう",
    "ほしい", "思う", "使う", "できる", "なる", "ある", "いう", "見る", "出る",
  ]);

  const freq = new Map<string, number>();

  for (const ore of ores) {
    const segments = ore.body
      .replace(/[^\p{L}\p{N}ー]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2 && w.length <= 10 && !stopWords.has(w) && !/^\d+$/.test(w));

    const seen = new Set<string>();
    for (const word of segments) {
      if (seen.has(word)) continue;
      seen.add(word);
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }

  return [...freq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([text, count]) => ({ text, count }));
}

export default function Dashboard() {
  const [ores, setOres] = useState<Ore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOres = useCallback(async () => {
    const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!isFirebaseConfigured) { setLoading(false); return; }
    try {
      const q = query(collection(getDb(), "ores"));
      const snapshot = await getDocs(q);
      setOres(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Ore[]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchOres(); }, [fetchOres]);

  const analysis = useMemo(() => {
    if (ores.length === 0) return null;

    const tagCounts = new Map<string, number>();
    const companyCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    let totalEmpathy = 0;

    for (const ore of ores) {
      totalEmpathy += ore.empathyCount;
      for (const tag of ore.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      for (const c of ore.companyNames) companyCounts.set(c, (companyCounts.get(c) || 0) + 1);
      if (ore.source) sourceCounts.set(ore.source, (sourceCounts.get(ore.source) || 0) + 1);
    }

    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([label, value]) => ({ label, value }));
    const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([label, value]) => ({ label, value }));
    const sourceData = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label: SOURCE_LABELS[label] || label, value }));

    const keywords = extractKeywords(ores);

    const mostEmpathized = [...ores].sort((a, b) => b.empathyCount - a.empathyCount).slice(0, 5);

    return { topTags, topCompanies, sourceData, keywords, totalEmpathy, mostEmpathized };
  }, [ores]);

  if (loading) {
    return <div className="text-center text-muted py-12">分析中...</div>;
  }

  if (!analysis) {
    return <div className="text-center text-muted py-12">データがありません</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">⛏ 分析ダッシュボード</h1>
        <p className="text-sm text-muted mt-1">原石データから見えるインサイト</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="総原石数" value={ores.length} />
        <StatCard label="対象企業" value={analysis.topCompanies.length} />
        <StatCard label="総わかる数" value={analysis.totalEmpathy} />
        <StatCard label="ソース数" value={analysis.sourceData.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category chart */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">カテゴリ別 不満件数</h2>
          <BarChart data={analysis.topTags} />
        </div>

        {/* Company ranking */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">企業別 不満件数</h2>
          <BarChart data={analysis.topCompanies} color="bg-red-400" />
        </div>

        {/* Source breakdown */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">ソース別 収集数</h2>
          <BarChart data={analysis.sourceData} color="bg-sky-400" />
        </div>

        {/* Word cloud */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">頻出キーワード</h2>
          <WordCloud words={analysis.keywords} />
        </div>
      </div>

      {/* Most empathized */}
      {analysis.mostEmpathized.some((o) => o.empathyCount > 0) && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">🔥 最も共感された不満 TOP5</h2>
          <div className="space-y-3">
            {analysis.mostEmpathized.map((ore, i) => (
              <div key={ore.id} className="flex gap-3 items-start">
                <span className="text-2xl font-bold text-muted w-8 shrink-0">#{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed">{ore.body}</p>
                  <div className="flex gap-2 mt-1 text-xs text-muted">
                    <span>👍 {ore.empathyCount}</span>
                    {ore.companyNames.length > 0 && <span>🏢 {ore.companyNames.join(", ")}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
