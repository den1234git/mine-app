"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, orderBy, limit, getDocs, addDoc, doc, updateDoc, increment } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Ore } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  appstore: "📱 App Store",
  reddit: "💬 Reddit",
  twitter: "🐦 X/Twitter",
  chiebukuro: "❓ 知恵袋",
  googleplay: "🤖 Google Play",
  "5ch": "📝 5ch",
};

interface AppGroup {
  key: string;
  name: string;
  ores: Ore[];
  totalEmpathy: number;
  sources: string[];
}

function buildGroups(ores: Ore[]): AppGroup[] {
  const map = new Map<string, Ore[]>();

  for (const ore of ores) {
    if (ore.companyNames.length > 0) {
      for (const name of ore.companyNames) {
        const list = map.get(name) || [];
        list.push(ore);
        map.set(name, list);
      }
    } else {
      const key = ore.source ? `__source__${ore.source}` : "__other__";
      const list = map.get(key) || [];
      list.push(ore);
      map.set(key, list);
    }
  }

  const groups: AppGroup[] = [];
  for (const [key, groupOres] of map) {
    const sources = [...new Set(groupOres.map((o) => o.source).filter(Boolean))] as string[];
    const name = key.startsWith("__source__")
      ? SOURCE_LABELS[key.replace("__source__", "")] || key.replace("__source__", "")
      : key === "__other__"
        ? "その他"
        : key;
    groups.push({
      key,
      name,
      ores: groupOres,
      totalEmpathy: groupOres.reduce((sum, o) => sum + o.empathyCount, 0),
      sources,
    });
  }

  groups.sort((a, b) => b.ores.length - a.ores.length);
  return groups;
}

function OreGridCard({ ore, onEmpathy }: { ore: Ore; onEmpathy: (id: string) => void }) {
  const [voted, setVoted] = useState(false);

  const handleEmpathy = () => {
    if (voted) return;
    setVoted(true);
    onEmpathy(ore.id);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between gap-3 min-h-[140px]">
      <p className="text-sm leading-relaxed line-clamp-4">{ore.body}</p>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <button
          onClick={handleEmpathy}
          disabled={voted}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors shrink-0 ${
            voted
              ? "bg-amber-400/20 text-amber-400"
              : "bg-zinc-800 text-muted hover:bg-zinc-700 hover:text-foreground"
          }`}
        >
          👍 わかる {ore.empathyCount + (voted ? 1 : 0)}
        </button>
        {ore.tags.length > 0 && (
          <span className="text-xs text-muted truncate">
            {ore.tags.slice(0, 2).join(" / ")}
          </span>
        )}
      </div>
    </div>
  );
}

function PostForm({ onPost }: { onPost: (body: string, tags: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      await onPost(body.trim(), tags.trim());
      setBody("");
      setTags("");
      setOpen(false);
    } finally {
      setPosting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-card border border-border rounded-xl p-4 text-left text-muted hover:border-accent/50 transition-colors"
      >
        ⛏ 不満を投げ込む...
      </button>
    );
  }

  return (
    <div className="bg-card border border-accent/50 rounded-xl p-4 space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="「〇〇が〇〇でクソだった」まで砕いて書く。個人名はNG、企業名・製品名はOK。"
        rows={4}
        autoFocus
        className="w-full bg-transparent border-none outline-none resize-none text-base placeholder:text-muted/60"
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="タグ（カンマ区切り）: UX, 配送, カスタマーサポート"
        className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted/60"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          キャンセル
        </button>
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || posting}
          className="px-4 py-2 text-sm bg-accent text-zinc-950 font-medium rounded-lg hover:bg-amber-300 disabled:opacity-50 transition-colors"
        >
          {posting ? "投稿中..." : "投げ込む"}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [ores, setOres] = useState<Ore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const fetchOres = useCallback(async () => {
    const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (isFirebaseConfigured) {
      try {
        const q = query(collection(getDb(), "ores"), orderBy("empathyCount", "desc"), limit(200));
        const snapshot = await getDocs(q);
        setOres(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Ore[]
        );
        setLoading(false);
        return;
      } catch {
        // fall through to demo data
      }
    }
    setOres([
      {
        id: "demo-1",
        body: "Amazonの返品、理由選択が20個もあるのに「その他」を選ばないと自由記述できない。結局毎回「その他」。",
        tags: ["UX", "EC"],
        companyNames: ["Amazon"],
        empathyCount: 42,
        createdAt: Date.now(),
      },
      {
        id: "demo-2",
        body: "銀行のワンタイムパスワードアプリ、機種変したら再登録に窓口行かないといけない。2024年にもなって。",
        tags: ["銀行", "認証"],
        companyNames: [],
        empathyCount: 128,
        createdAt: Date.now(),
      },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOres();
  }, [fetchOres]);

  const groups = useMemo(() => buildGroups(ores), [ores]);

  useEffect(() => {
    if (groups.length > 0 && selectedTab === null) {
      setSelectedTab(groups[0].key);
    }
  }, [groups, selectedTab]);

  const activeGroup = groups.find((g) => g.key === selectedTab) || groups[0];

  const handlePost = async (body: string, tagsStr: string) => {
    const tags = tagsStr
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const companyNames: string[] = [];
    const ore = {
      body,
      tags,
      companyNames,
      empathyCount: 0,
      createdAt: Date.now(),
    };
    try {
      const docRef = await addDoc(collection(getDb(), "ores"), ore);
      setOres((prev) => [{ ...ore, id: docRef.id }, ...prev]);
    } catch {
      setOres((prev) => [{ ...ore, id: `local-${Date.now()}` }, ...prev]);
    }
  };

  const handleEmpathy = async (id: string) => {
    setOres((prev) =>
      prev.map((o) => (o.id === id ? { ...o, empathyCount: o.empathyCount + 1 } : o))
    );
    try {
      await updateDoc(doc(getDb(), "ores", id), { empathyCount: increment(1) });
    } catch {}
  };

  if (loading) {
    return <div className="text-center text-muted py-12">掘削中...</div>;
  }

  return (
    <div className="space-y-4">
      <PostForm onPost={handlePost} />

      {/* Tab sidebar + grid layout */}
      <div className="flex gap-4 min-h-[60vh]">
        {/* Left: app tabs */}
        <nav className="w-40 shrink-0 space-y-1 hidden sm:block">
          <h2 className="text-xs font-medium text-muted px-3 py-2 uppercase tracking-wider">アプリ</h2>
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelectedTab(g.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                selectedTab === g.key
                  ? "bg-accent text-zinc-950 font-medium"
                  : "text-muted hover:bg-zinc-800 hover:text-foreground"
              }`}
            >
              <div className="truncate">{g.name}</div>
              <div className="text-xs opacity-70">{g.ores.length}件</div>
            </button>
          ))}
        </nav>

        {/* Mobile: horizontal tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden w-full">
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelectedTab(g.key)}
              className={`shrink-0 px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedTab === g.key
                  ? "bg-accent text-zinc-950 font-medium"
                  : "bg-zinc-800 text-muted"
              }`}
            >
              {g.name} ({g.ores.length})
            </button>
          ))}
        </div>

        {/* Right: card grid */}
        <div className="flex-1 min-w-0">
          {activeGroup && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-medium">{activeGroup.name}</h2>
                <span className="text-xs text-muted">
                  {activeGroup.ores.length}件の不満
                  {activeGroup.totalEmpathy > 0 && ` · 👍 ${activeGroup.totalEmpathy}`}
                </span>
                {activeGroup.sources.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-muted">
                    {activeGroup.sources.map((s) => SOURCE_LABELS[s] || s).join(" / ")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeGroup.ores.map((ore) => (
                  <OreGridCard key={ore.id} ore={ore} onEmpathy={handleEmpathy} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
