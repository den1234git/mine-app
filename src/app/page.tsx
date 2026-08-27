"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, addDoc, doc, updateDoc, increment } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Ore } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  appstore: "📱 App Store",
  reddit: "💬 Reddit",
  twitter: "🐦 X/Twitter",
  chiebukuro: "❓ 知恵袋",
  "5ch": "📝 5ch",
};

interface AppGroup {
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
      name,
      ores: groupOres,
      totalEmpathy: groupOres.reduce((sum, o) => sum + o.empathyCount, 0),
      sources,
    });
  }

  groups.sort((a, b) => b.ores.length - a.ores.length);
  return groups;
}

function OreItem({ ore, onEmpathy }: { ore: Ore; onEmpathy: (id: string) => void }) {
  const [voted, setVoted] = useState(false);

  const handleEmpathy = () => {
    if (voted) return;
    setVoted(true);
    onEmpathy(ore.id);
  };

  return (
    <div className="border-t border-zinc-800 pt-3 space-y-2">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{ore.body}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleEmpathy}
          disabled={voted}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${
            voted
              ? "bg-amber-400/20 text-amber-400"
              : "bg-zinc-800 text-muted hover:bg-zinc-700 hover:text-foreground"
          }`}
        >
          👍 わかる {ore.empathyCount + (voted ? 1 : 0)}
        </button>
        {ore.tags.length > 0 && ore.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800/50 text-muted">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function AppCard({ group, onEmpathy }: { group: AppGroup; onEmpathy: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const preview = group.ores.slice(0, 2);
  const rest = group.ores.slice(2);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-lg shrink-0">
            {group.name === "その他" ? "📦" : "🏢"}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-base truncate">{group.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>{group.ores.length}件の不満</span>
              {group.totalEmpathy > 0 && (
                <span>👍 {group.totalEmpathy}</span>
              )}
              {group.sources.length > 0 && (
                <span className="truncate">
                  {group.sources.map((s) => SOURCE_LABELS[s] || s).join(" / ")}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className="text-muted text-lg shrink-0 ml-2">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      <div className="px-4 pb-4 space-y-3">
        {preview.map((ore) => (
          <OreItem key={ore.id} ore={ore} onEmpathy={onEmpathy} />
        ))}
        {rest.length > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-center text-xs text-accent hover:text-amber-300 py-2"
          >
            他 {rest.length}件を表示
          </button>
        )}
        {expanded && rest.map((ore) => (
          <OreItem key={ore.id} ore={ore} onEmpathy={onEmpathy} />
        ))}
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
    } catch {
      // offline or demo mode
    }
  };

  const groups = buildGroups(ores);

  return (
    <div className="space-y-4">
      <PostForm onPost={handlePost} />

      <div className="flex items-center gap-2 pt-2">
        <span className="text-accent text-lg">⛏</span>
        <h2 className="text-sm font-medium text-muted">
          アプリ別 — 不満の多い順
        </h2>
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">掘削中...</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <AppCard key={group.name} group={group} onEmpathy={handleEmpathy} />
          ))}
        </div>
      )}
    </div>
  );
}
